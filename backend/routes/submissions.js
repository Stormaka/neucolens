import express from 'express'
import { getDb } from '../db/database.js'
import { authenticate } from './auth.js'
import { analyzeCode, updateStudentProfile } from '../services/llmService.js'

const router = express.Router()

// POST /api/submissions — nộp bài + trigger LLM analysis
router.post('/', authenticate, async (req, res) => {
  const { assignment_id, code } = req.body
  if (!assignment_id || code === undefined) return res.status(400).json({ error: 'Thiếu assignment_id hoặc code' })

  const db = getDb()
  const asgn = db.prepare('SELECT * FROM assignments WHERE id=?').get(assignment_id)
  if (!asgn) return res.status(404).json({ error: 'Không tìm thấy bài tập' })
  if (asgn.status === 'closed') return res.status(400).json({ error: 'Bài tập đã đóng, không thể nộp' })

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
        // Extract concept từ description (lấy phần trước dấu — hoặc dùng nguyên)
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

// GET /api/submissions/:id — lấy kết quả submission (polling)
router.get('/:id', authenticate, (req, res) => {
  const db = getDb()
  const sub = db.prepare('SELECT * FROM submissions WHERE id=?').get(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Không tìm thấy submission' })
  if (sub.student_id !== req.user.id && req.user.role !== 'teacher') return res.status(403).json({ error: 'Không có quyền' })
  res.json({ ...sub, misconceptions: JSON.parse(sub.misconceptions_json || '[]') })
})

// GET /api/submissions/my/:assignmentId — lịch sử nộp bài của sinh viên
router.get('/my/:assignmentId', authenticate, (req, res) => {
  const db = getDb()
  const subs = db.prepare(`SELECT * FROM submissions WHERE assignment_id=? AND student_id=? ORDER BY submitted_at DESC`).all(req.params.assignmentId, req.user.id)
  res.json(subs.map(s => ({ ...s, misconceptions: JSON.parse(s.misconceptions_json || '[]') })))
})

// GET /api/submissions/student/:studentId/classroom/:classId — tất cả submissions của 1 SV (teacher)
router.get('/student/:studentId/classroom/:classId', authenticate, (req, res) => {
  const db = getDb()
  const subs = db.prepare(`
    SELECT s.*, a.title as assignment_title, a.concepts_json, a.id as assignment_id
    FROM submissions s JOIN assignments a ON s.assignment_id=a.id
    WHERE s.student_id=? AND a.classroom_id=?
    ORDER BY a.id ASC, s.submitted_at DESC
  `).all(req.params.studentId, req.params.classId)

  // Group by assignment — take latest per assignment
  const grouped = {}
  subs.forEach(sub => {
    if (!grouped[sub.assignment_id]) {
      grouped[sub.assignment_id] = {
        ...sub,
        concepts: JSON.parse(sub.concepts_json || '[]'),
        misconceptions: JSON.parse(sub.misconceptions_json || '[]'),
        attempt_number: db.prepare('SELECT COUNT(*) as c FROM submissions WHERE assignment_id=? AND student_id=?').get(sub.assignment_id, req.params.studentId).c
      }
    }
  })
  res.json(Object.values(grouped))
})

export default router
