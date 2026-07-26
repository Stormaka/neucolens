import express from 'express'
import { getDb } from '../db/database.js'
import { authenticate, requireRole } from './auth.js'
import { analyzeCode, updateStudentProfile } from '../services/llmService.js'

const router = express.Router()

// POST /api/submissions — nộp bài + trigger LLM analysis
router.post('/', authenticate, requireRole('student'), async (req, res) => {
  const { assignment_id, code } = req.body
  if (!assignment_id || code === undefined) return res.status(400).json({ error: 'Thiếu assignment_id hoặc code', status: 400 })

  const db = getDb()
  const asgn = db.prepare('SELECT * FROM assignments WHERE id=?').get(assignment_id)
  if (!asgn) return res.status(404).json({ error: 'Không tìm thấy bài tập', status: 404 })
  const enrolled = db.prepare('SELECT 1 FROM enrollments WHERE student_id=? AND classroom_id=?').get(req.user.id, asgn.classroom_id)
  if (!enrolled) return res.status(403).json({ error: 'Bạn chưa được ghi danh vào lớp chứa bài tập này', code: 'NOT_ENROLLED' })
  if (asgn.status === 'closed') return res.status(400).json({ error: 'Bài tập đã đóng, không thể nộp', status: 400 })
  if (asgn.sample_code && code.replace(/\s+/g, '') === asgn.sample_code.replace(/\s+/g, '')) {
    return res.status(422).json({ error: 'Bài nộp trùng hoàn toàn đáp án mẫu; hãy tự triển khai lời giải', code: 'SAMPLE_CODE_COPY' })
  }

  // Count attempt number
  const prevCount = db.prepare('SELECT COUNT(*) as c FROM submissions WHERE assignment_id=? AND student_id=?').get(assignment_id, req.user.id).c
  const attemptNum = prevCount + 1

  // Insert pending submission
  const insertResult = db.prepare(`INSERT INTO submissions (assignment_id,student_id,code,attempt_number,status,submitted_at)
    VALUES (?,?,?,?,'pending',datetime('now'))`).run(assignment_id, req.user.id, code, attemptNum)
  const subId = insertResult.lastInsertRowid

  // Phân tích trong cùng request để serverless không đóng băng tác vụ nền sau khi response.
  try {
    const analysis = await analyzeCode(code, { ...asgn, concepts: JSON.parse(asgn.concepts_json || '[]') }, req.user.name)
    db.prepare(`UPDATE submissions SET score_total=?,score_t1=?,score_t2=?,score_t3=?,status=?,
      llm_feedback=?,ai_suspicion_flag=?,ai_suspicion_confidence=?,ai_suspicion_reason=?,misconceptions_json=?
      WHERE id=?`).run(
      analysis.score_total, analysis.score_t1, analysis.score_t2, analysis.score_t3, analysis.status,
      analysis.llm_feedback, analysis.ai_suspicion_flag, analysis.ai_suspicion_confidence, analysis.ai_suspicion_reason,
      analysis.misconceptions_json, subId
    )
    // ── Storm v4: Insert vào bảng misconceptions riêng biệt ──────────────
    const detectedMisconceptions = JSON.parse(analysis.misconceptions_json || '[]')
    if (detectedMisconceptions.length > 0) {
      const insertMisc = db.prepare(
        'INSERT INTO misconceptions (student_id, assignment_id, classroom_id, concept, description) VALUES (?,?,?,?,?)'
      )
      detectedMisconceptions.forEach(desc => {
        const concept = desc.split('—')[0].replace(/^[🔴⚠️📌⭐💡🚨\s]+/, '').trim().substring(0, 100)
        try {
          insertMisc.run(req.user.id, assignment_id, asgn.classroom_id, concept, desc)
        } catch { /* ignore duplicates */ }
      })
    }
    // Update student profile with dynamic concept scores
    updateStudentProfile(db, req.user.id, asgn.classroom_id,
      JSON.parse(asgn.concepts_json || '[]'),
      analysis.concept_scores || {}
    )
    const completed = db.prepare('SELECT * FROM submissions WHERE id=?').get(subId)
    const { misconceptions_json, ...clean } = completed
    return res.status(201).json({ ...clean, misconceptions: JSON.parse(misconceptions_json || '[]') })
  } catch (err) {
    console.error('LLM analysis error:', err)
    db.prepare(`UPDATE submissions SET status='failed',llm_feedback=? WHERE id=?`).run('Lỗi phân tích. Vui lòng thử lại.', subId)
    return res.status(500).json({ error: 'Không thể phân tích bài nộp', code: 'ANALYSIS_FAILED' })
  }
})

// ── #5/#15: Batch endpoint — trả latest submission cho nhiều assignments trong 1 request ──
// GET /api/submissions/me/batch?assignmentIds=1,2,3,4,5
// Returns: { [assignmentId]: latestSubmission }
router.get('/me/batch', authenticate, (req, res) => {
  const raw = req.query.assignmentIds || ''
  const ids = String(raw).split(',').map(Number).filter(n => n > 0)
  if (!ids.length) return res.json({})

  const db = getDb()
  const placeholders = ids.map(() => '?').join(',')
  // One query: get latest submission per assignment using subquery
  const subs = db.prepare(`
    SELECT s.*
    FROM submissions s
    INNER JOIN (
      SELECT assignment_id, MAX(submitted_at) as latest_at
      FROM submissions
      WHERE student_id = ? AND assignment_id IN (${placeholders})
      GROUP BY assignment_id
    ) lsub ON s.assignment_id = lsub.assignment_id AND s.submitted_at = lsub.latest_at
    WHERE s.student_id = ?
  `).all(req.user.id, ...ids, req.user.id)

  const result = {}
  subs.forEach(s => {
    const { misconceptions_json, ...clean } = s
    result[s.assignment_id] = { ...clean, misconceptions: JSON.parse(misconceptions_json || '[]') }
  })
  res.json(result)
})

// GET /api/submissions/me/:assignmentId — (#2) chuẩn hóa /me/ thay vì /my/
router.get('/me/:assignmentId', authenticate, (req, res) => {
  const db = getDb()
  const subs = db.prepare(`SELECT * FROM submissions WHERE assignment_id=? AND student_id=? ORDER BY submitted_at DESC`).all(req.params.assignmentId, req.user.id)
  res.json(subs.map(s => { const { misconceptions_json, ...c } = s; return { ...c, misconceptions: JSON.parse(misconceptions_json || '[]') } }))
})

// GET /api/submissions?status=passed&from=ISO&to=ISO&sort=submitted_at&order=desc&page=1&limit=20
router.get('/', authenticate, (req, res) => {
  const db = getDb()
  const page = Math.max(1, Number.parseInt(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit) || 20))
  const filters = [], params = []
  if (req.user.role === 'student') { filters.push('s.student_id=?'); params.push(req.user.id) }
  else { filters.push('c.lecturer_id=?'); params.push(req.user.id) }
  if (req.query.status) {
    if (!['pending','passed','warning','failed'].includes(req.query.status)) return res.status(400).json({ error: 'Status không hợp lệ', code: 'INVALID_STATUS' })
    filters.push('s.status=?'); params.push(req.query.status)
  }
  if (req.query.from) { filters.push('s.submitted_at>=?'); params.push(req.query.from) }
  if (req.query.to) { filters.push('s.submitted_at<=?'); params.push(req.query.to) }
  if (req.query.classroom_id) { filters.push('a.classroom_id=?'); params.push(Number(req.query.classroom_id)) }
  const sortMap = { submitted_at: 's.submitted_at', score_total: 's.score_total', status: 's.status' }
  const sort = sortMap[req.query.sort] || 's.submitted_at'
  const order = String(req.query.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC'
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
  const base = `FROM submissions s JOIN assignments a ON a.id=s.assignment_id JOIN classrooms c ON c.id=a.classroom_id ${where}`
  const total = db.prepare(`SELECT COUNT(*) c ${base}`).get(...params).c
  const rows = db.prepare(`SELECT s.*,a.title assignment_title ${base} ORDER BY ${sort} ${order},s.id ${order} LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit)
  const data = rows.map(({ misconceptions_json, ...row }) => ({ ...row, misconceptions: JSON.parse(misconceptions_json || '[]') }))
  res.json({ data, total, page, limit })
})

// GET /api/submissions/student/:studentId/classroom/:classId — teacher view
// #5: fixed N+1 — attempt count now computed in the SQL subquery (single DB call)
router.get('/student/:studentId/classroom/:classId', authenticate, (req, res) => {
  const db = getDb()
  const subs = db.prepare(`
    SELECT s.*, a.title as assignment_title, a.concepts_json, a.id as assignment_id,
      (SELECT COUNT(*) FROM submissions
       WHERE student_id=s.student_id AND assignment_id=s.assignment_id) as total_attempts
    FROM submissions s JOIN assignments a ON s.assignment_id=a.id
    WHERE s.student_id=? AND a.classroom_id=?
    ORDER BY a.id ASC, s.submitted_at DESC
  `).all(req.params.studentId, req.params.classId)

  const grouped = {}
  subs.forEach(sub => {
    if (!grouped[sub.assignment_id]) {
      // #10: strip raw JSON fields
      const { concepts_json, misconceptions_json, ...clean } = sub
      grouped[sub.assignment_id] = {
        ...clean,
        concepts: JSON.parse(concepts_json || '[]'),
        misconceptions: JSON.parse(misconceptions_json || '[]'),
      }
    }
  })
  res.json(Object.values(grouped))
})

// PATCH /api/submissions/:id/override — Giảng viên sửa điểm tay khi cần
router.patch('/:id/override', authenticate, requireRole('teacher'), (req, res) => {
  const db = getDb()
  const { score_total, score_t1, score_t2, score_t3, status, llm_feedback } = req.body
  const sub = db.prepare('SELECT * FROM submissions WHERE id=?').get(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Không tìm thấy submission', status: 404 })

  const newTotal = score_total !== undefined ? Number(score_total) : sub.score_total
  const newT1 = score_t1 !== undefined ? Number(score_t1) : sub.score_t1
  const newT2 = score_t2 !== undefined ? Number(score_t2) : sub.score_t2
  const newT3 = score_t3 !== undefined ? Number(score_t3) : sub.score_t3
  const newStatus = status || (newTotal >= 70 ? 'passed' : newTotal >= 50 ? 'warning' : 'failed')
  const newFeedback = llm_feedback !== undefined ? llm_feedback : sub.llm_feedback

  db.prepare(`
    UPDATE submissions
    SET score_total=?, score_t1=?, score_t2=?, score_t3=?, status=?, llm_feedback=?
    WHERE id=?
  `).run(newTotal, newT1, newT2, newT3, newStatus, newFeedback, req.params.id)

  const updated = db.prepare('SELECT * FROM submissions WHERE id=?').get(req.params.id)
  const { misconceptions_json, ...clean } = updated
  res.json({ ...clean, misconceptions: JSON.parse(misconceptions_json || '[]') })
})

// GET /api/submissions/:id — polling result (must be after named routes)
router.get('/:id', authenticate, (req, res) => {
  const db = getDb()
  const sub = db.prepare('SELECT * FROM submissions WHERE id=?').get(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Không tìm thấy submission', status: 404 })
  if (sub.student_id !== req.user.id && req.user.role !== 'teacher') return res.status(403).json({ error: 'Không có quyền', status: 403 })
  const { misconceptions_json, ...clean } = sub
  res.json({ ...clean, misconceptions: JSON.parse(misconceptions_json || '[]') })
})

export default router
