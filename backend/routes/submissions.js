import express from 'express'
import { getDb } from '../db/database.js'
import { authenticate } from './auth.js'
import { analyzeCode, updateStudentProfile } from '../services/llmService.js'

const router = express.Router()

// POST /api/submissions — nộp bài + trigger LLM analysis
router.post('/', authenticate, async (req, res) => {
  const { assignment_id, code } = req.body
  if (!assignment_id || code === undefined) return res.status(400).json({ error: 'Thiếu assignment_id hoặc code', status: 400 })

  const db = getDb()
  const asgn = db.prepare('SELECT * FROM assignments WHERE id=?').get(assignment_id)
  if (!asgn) return res.status(404).json({ error: 'Không tìm thấy bài tập', status: 404 })
  if (asgn.status === 'closed') return res.status(400).json({ error: 'Bài tập đã đóng, không thể nộp', status: 400 })

  // Count attempt number
  const prevCount = db.prepare('SELECT COUNT(*) as c FROM submissions WHERE assignment_id=? AND student_id=?').get(assignment_id, req.user.id).c
  const attemptNum = prevCount + 1

  // Insert pending submission
  const insertResult = db.prepare(`INSERT INTO submissions (assignment_id,student_id,code,attempt_number,status,submitted_at)
    VALUES (?,?,?,?,'pending',datetime('now'))`).run(assignment_id, req.user.id, code, attemptNum)
  const subId = insertResult.lastInsertRowid

  // Respond immediately with pending status (SSE or polling)
  res.json({ id: subId, status: 'pending', attempt_number: attemptNum, message: 'Đang phân tích...' })

  // Run LLM analysis in background
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
  } catch (err) {
    console.error('LLM analysis error:', err)
    db.prepare(`UPDATE submissions SET status='failed',llm_feedback=? WHERE id=?`).run('Lỗi phân tích. Vui lòng thử lại.', subId)
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
    result[s.assignment_id] = { ...s, misconceptions: JSON.parse(s.misconceptions_json || '[]') }
  })
  res.json(result)
})

// GET /api/submissions/me/:assignmentId — (#2) chuẩn hóa /me/ thay vì /my/
router.get('/me/:assignmentId', authenticate, (req, res) => {
  const db = getDb()
  const subs = db.prepare(`SELECT * FROM submissions WHERE assignment_id=? AND student_id=? ORDER BY submitted_at DESC`).all(req.params.assignmentId, req.user.id)
  res.json(subs.map(s => ({ ...s, misconceptions: JSON.parse(s.misconceptions_json || '[]') })))
})

// GET /api/submissions/my/:assignmentId — backward compat alias (#2)
router.get('/my/:assignmentId', authenticate, (req, res) => {
  const db = getDb()
  const subs = db.prepare(`SELECT * FROM submissions WHERE assignment_id=? AND student_id=? ORDER BY submitted_at DESC`).all(req.params.assignmentId, req.user.id)
  res.json(subs.map(s => ({ ...s, misconceptions: JSON.parse(s.misconceptions_json || '[]') })))
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

// GET /api/submissions/:id — polling result (must be after named routes)
router.get('/:id', authenticate, (req, res) => {
  const db = getDb()
  const sub = db.prepare('SELECT * FROM submissions WHERE id=?').get(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Không tìm thấy submission', status: 404 })
  if (sub.student_id !== req.user.id && req.user.role !== 'teacher') return res.status(403).json({ error: 'Không có quyền', status: 403 })
  res.json({ ...sub, misconceptions: JSON.parse(sub.misconceptions_json || '[]') })
})

export default router
