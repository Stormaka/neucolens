import express from 'express'
import { getDb } from '../db/database.js'
import { authenticate, requireRole, verifyClassroomAccess } from './auth.js'

const router = express.Router()

// Phase 3: helpers cho Exam Mode
function serializeExamFields(row) {
  if (!row) return row
  return {
    ...row,
    is_exam: !!row.is_exam,
    allow_paste: !!row.allow_paste,
    require_fullscreen: !!row.require_fullscreen,
    shuffle_questions: !!row.shuffle_questions,
  }
}
function shuffleArray(arr, seed) {
  // Deterministic shuffle per student+assignment (seed = hash) — Fisher-Yates với xorshift
  const a = [...arr]
  let s = seed >>> 0
  const rand = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296 }
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
function hashSeed(studentId, assignmentId) {
  let h = 2166136261
  const str = `${studentId}:${assignmentId}`
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function isScoresHidden(assignment, nowMs = Date.now()) {
  if (!assignment) return false
  if (assignment.hide_scores_until) {
    const t = Date.parse(assignment.hide_scores_until)
    if (!Number.isNaN(t) && nowMs < t) return true
  }
  // Mặc định exam giấu điểm khi còn open (chờ GV công bố bằng closed hoặc hide_scores_until)
  if (assignment.is_exam && assignment.status === 'open') return true
  return false
}

function verifyAssignmentAccess({ teacherOnly = false } = {}) {
  return (req, res, next) => {
    const db = getDb()
    const assignment = db.prepare('SELECT classroom_id FROM assignments WHERE id=?').get(req.params.id)
    if (!assignment) return res.status(404).json({ error: 'Không tìm thấy bài tập' })
    if (req.user.role === 'teacher') {
      const owns = db.prepare('SELECT 1 FROM classrooms WHERE id=? AND lecturer_id=?').get(assignment.classroom_id, req.user.id)
      if (!owns) return res.status(403).json({ error: 'Không có quyền với bài tập này', code: 'ASSIGNMENT_ACCESS_DENIED' })
    } else {
      if (teacherOnly) return res.status(403).json({ error: 'Chỉ giảng viên mới có quyền truy cập' })
      const enrolled = db.prepare('SELECT 1 FROM enrollments WHERE classroom_id=? AND student_id=?').get(assignment.classroom_id, req.user.id)
      if (!enrolled) return res.status(403).json({ error: 'Bạn chưa được ghi danh vào lớp này' })
    }
    next()
  }
}

// GET /api/assignments/classroom/:id
router.get('/classroom/:id', authenticate, verifyClassroomAccess, (req, res) => {
  const db = getDb()
  // #7: Pagination support — defaults to page 1, limit 50 (backward-compat for current UI)
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50))
  const offset = (page - 1) * limit

  const total = db.prepare('SELECT COUNT(*) as c FROM assignments WHERE classroom_id=?').get(req.params.id).c

  const asgns = db.prepare(`
    SELECT a.*,
      COUNT(DISTINCT s.student_id) as submitted_count,
      AVG(CASE WHEN s.attempt_number>0 THEN s.score_total END) as avg_score
    FROM assignments a
    LEFT JOIN submissions s ON a.id=s.assignment_id
    WHERE a.classroom_id=?
    GROUP BY a.id ORDER BY a.id
    LIMIT ? OFFSET ?
  `).all(req.params.id, limit, offset)

  // #11: Use only camelCase avgScore; #10: strip raw concepts_json since concepts (parsed) is included
  const data = asgns.map(a => {
    const { avg_score, concepts_json, test_cases_json, ...aClean } = a
    const allTests = JSON.parse(test_cases_json || '[]')
    const sampleTests = req.user.role === 'teacher' ? allTests : allTests.filter(t => !t.hidden)
    const serialized = serializeExamFields(aClean)
    return {
      ...serialized,
      concepts: JSON.parse(concepts_json || '[]'),
      avgScore: Math.round(avg_score || 0),
      sample_test_cases: sampleTests
    }
  })

  res.json({ data, total, page, limit })
})

// GET /api/assignments/:id — 4.9 Fix: giáo viên nhận được test_cases, sinh viên chỉ nhận sample tests
// Phase 3: nếu shuffle_questions + is_exam, SV nhận test order đã trộn (deterministic per student)
router.get('/:id', authenticate, verifyAssignmentAccess(), (req, res) => {
  const db = getDb()
  const a = db.prepare('SELECT * FROM assignments WHERE id=?').get(req.params.id)
  if (!a) return res.status(404).json({ error: 'Không tìm thấy bài tập' })
  const { concepts_json, test_cases_json, ...clean } = a
  const serialized = serializeExamFields(clean)
  const allTestCases = JSON.parse(test_cases_json || '[]')
  let visibleTests = req.user.role === 'teacher'
    ? allTestCases
    : allTestCases.filter(tc => !tc.hidden)
  if (req.user.role === 'student' && a.is_exam && a.shuffle_questions) {
    visibleTests = shuffleArray(visibleTests, hashSeed(req.user.id, a.id))
  }
  // Phase 3: kèm exam_session hiện tại cho SV (nếu là exam)
  let exam_session = null
  if (a.is_exam && req.user.role === 'student') {
    exam_session = db.prepare('SELECT session_id, started_at, expires_at, submitted_at FROM exam_sessions WHERE student_id=? AND assignment_id=?').get(req.user.id, a.id) || null
  }
  res.json({ ...serialized, concepts: JSON.parse(concepts_json || '[]'), sample_test_cases: visibleTests, exam_session })
})

// POST /api/assignments — 4.9 Fix: nhận test_cases array (public + hidden)
router.post('/', authenticate, requireRole('teacher'), verifyClassroomAccess, (req, res) => {
  const { classroom_id, title, description, lang, deadline, concepts, sample_code,
    weight_t1, weight_t2, weight_t3, test_cases,
    is_exam, duration_minutes, allow_paste, require_fullscreen, shuffle_questions, hide_scores_until } = req.body
  if (!classroom_id || !title) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' })

  // Phase 3: validate exam fields
  const isExam = is_exam ? 1 : 0
  let duration = null
  if (isExam) {
    duration = parseInt(duration_minutes)
    if (!duration || duration < 5 || duration > 300) return res.status(400).json({ error: 'duration_minutes phải 5–300 phút cho bài thi' })
  }
  const hideUntil = hide_scores_until ? new Date(hide_scores_until).toISOString() : null
  if (hide_scores_until && !hideUntil) return res.status(400).json({ error: 'hide_scores_until không hợp lệ (ISO datetime)' })

  // Validate test_cases format nếu có
  const testCasesArr = Array.isArray(test_cases) ? test_cases.map(tc => ({
    input: String(tc.input ?? ''),
    expected: String(tc.expected ?? ''),
    hidden: Boolean(tc.hidden)   // true = ẩn khỏi student
  })) : []

  const db = getDb()
  const result = db.prepare(`
    INSERT INTO assignments (classroom_id,title,description,lang,deadline,concepts_json,sample_code,weight_t1,weight_t2,weight_t3,status,test_cases_json,is_exam,duration_minutes,allow_paste,require_fullscreen,shuffle_questions,hide_scores_until)
    VALUES (?,?,?,?,?,?,?,?,?,?,'open',?,?,?,?,?,?,?)
  `).run(
    classroom_id, title, description || '', lang || 'C++', deadline || null,
    JSON.stringify(concepts || []), sample_code || '',
    weight_t1 || 40, weight_t2 || 35, weight_t3 || 25,
    JSON.stringify(testCasesArr),
    isExam, duration, allow_paste === false || allow_paste === 0 ? 0 : 1,
    require_fullscreen ? 1 : 0, shuffle_questions ? 1 : 0, hideUntil
  )
  res.status(201).json({
    id: result.lastInsertRowid, title, status: 'open',
    is_exam: !!isExam, duration_minutes: duration,
    concepts: concepts || [],
    test_case_count: testCasesArr.length,
    hidden_test_count: testCasesArr.filter(t => t.hidden).length
  })
})

// PATCH /api/assignments/:id — cập nhật thông tin (bao gồm sample_code, concepts, test_cases)
router.patch('/:id', authenticate, requireRole('teacher'), verifyAssignmentAccess({ teacherOnly: true }), (req, res) => {
  const { title, description, deadline, concepts, sample_code, lang, test_cases,
    is_exam, duration_minutes, allow_paste, require_fullscreen, shuffle_questions, hide_scores_until } = req.body
  const db = getDb()
  const updates = []
  const vals = []
  if (title !== undefined) { updates.push('title=?'); vals.push(title) }
  if (description !== undefined) { updates.push('description=?'); vals.push(description) }
  if (deadline !== undefined) { updates.push('deadline=?'); vals.push(deadline) }
  if (concepts !== undefined) { updates.push('concepts_json=?'); vals.push(JSON.stringify(concepts)) }
  if (sample_code !== undefined) { updates.push('sample_code=?'); vals.push(sample_code) }
  if (lang !== undefined) { updates.push('lang=?'); vals.push(lang) }
  if (test_cases !== undefined) {
    const testCasesArr = Array.isArray(test_cases) ? test_cases.map(tc => ({
      input: String(tc.input ?? ''),
      expected: String(tc.expected ?? ''),
      hidden: Boolean(tc.hidden)
    })) : []
    updates.push('test_cases_json=?'); vals.push(JSON.stringify(testCasesArr))
  }
  // Phase 3 exam fields
  if (is_exam !== undefined) { updates.push('is_exam=?'); vals.push(is_exam ? 1 : 0) }
  if (duration_minutes !== undefined) {
    const d = duration_minutes === null ? null : parseInt(duration_minutes)
    if (d !== null && (d < 5 || d > 300)) return res.status(400).json({ error: 'duration_minutes phải 5–300 hoặc null' })
    updates.push('duration_minutes=?'); vals.push(d)
  }
  if (allow_paste !== undefined) { updates.push('allow_paste=?'); vals.push(allow_paste ? 1 : 0) }
  if (require_fullscreen !== undefined) { updates.push('require_fullscreen=?'); vals.push(require_fullscreen ? 1 : 0) }
  if (shuffle_questions !== undefined) { updates.push('shuffle_questions=?'); vals.push(shuffle_questions ? 1 : 0) }
  if (hide_scores_until !== undefined) {
    const v = hide_scores_until ? new Date(hide_scores_until).toISOString() : null
    if (hide_scores_until && !v) return res.status(400).json({ error: 'hide_scores_until không hợp lệ' })
    updates.push('hide_scores_until=?'); vals.push(v)
  }
  if (!updates.length) return res.status(400).json({ error: 'Không có gì cập nhật' })
  vals.push(req.params.id)
  db.prepare(`UPDATE assignments SET ${updates.join(',')} WHERE id=?`).run(...vals)
  const updated = db.prepare('SELECT * FROM assignments WHERE id=?').get(req.params.id)
  const { concepts_json: uj, test_cases_json: utj, ...updClean } = updated
  const ser = serializeExamFields(updClean)
  res.json({ ...ser, concepts: JSON.parse(uj || '[]'), test_case_count: JSON.parse(utj || '[]').length })
})

// PATCH /api/assignments/:id/status
router.patch('/:id/status', authenticate, requireRole('teacher'), verifyAssignmentAccess({ teacherOnly: true }), (req, res) => {
  const { status } = req.body
  if (!['open','closed'].includes(status)) return res.status(400).json({ error: 'Status không hợp lệ' })
  const db = getDb()
  db.prepare('UPDATE assignments SET status=? WHERE id=?').run(status, req.params.id)
  res.json({ success: true, status })
})

// GET /api/assignments/:id/submissions — tất cả submissions (Teacher)
// #4: expose student_code alias for mssv; #10: strip misconceptions_json raw
router.get('/:id/submissions', authenticate, requireRole('teacher'), verifyAssignmentAccess({ teacherOnly: true }), (req, res) => {
  const db = getDb()
  const subs = db.prepare(`
    SELECT s.*, u.name as student_name, u.mssv as student_code
    FROM submissions s JOIN users u ON s.student_id=u.id
    WHERE s.assignment_id=? ORDER BY s.submitted_at DESC
  `).all(req.params.id)
  res.json(subs.map(s => {
    const { misconceptions_json, process_metrics_json, llm_scores_json, rubric_breakdown_json, ...clean } = s
    const parse = x => { try { return x ? JSON.parse(x) : null } catch { return null } }
    const rbRaw = parse(rubric_breakdown_json)
    return {
      ...clean,
      misconceptions: JSON.parse(misconceptions_json || '[]'),
      process_metrics: parse(process_metrics_json),
      llm_scores: parse(llm_scores_json),
      rubric_breakdown: Array.isArray(rbRaw) ? rbRaw : Array.isArray(rbRaw?.breakdown) ? rbRaw.breakdown : null,
    }
  }))
})

export default router
