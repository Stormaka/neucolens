import express from 'express'
import { getDb } from '../db/database.js'
import { authenticate, requireRole, verifyClassroomAccess } from './auth.js'

const router = express.Router()

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
    return {
      ...aClean,
      concepts: JSON.parse(concepts_json || '[]'),
      avgScore: Math.round(avg_score || 0),
      sample_test_cases: sampleTests
    }
  })

  res.json({ data, total, page, limit })
})

// GET /api/assignments/:id — 4.9 Fix: giáo viên nhận được test_cases, sinh viên chỉ nhận sample tests
router.get('/:id', authenticate, verifyAssignmentAccess(), (req, res) => {
  const db = getDb()
  const a = db.prepare('SELECT * FROM assignments WHERE id=?').get(req.params.id)
  if (!a) return res.status(404).json({ error: 'Không tìm thấy bài tập' })
  const { concepts_json, test_cases_json, ...clean } = a
  const allTestCases = JSON.parse(test_cases_json || '[]')
  // Teacher thấy tất cả; Student chỉ thấy public test cases
  const visibleTests = req.user.role === 'teacher'
    ? allTestCases
    : allTestCases.filter(tc => !tc.hidden)
  res.json({ ...clean, concepts: JSON.parse(concepts_json || '[]'), sample_test_cases: visibleTests })
})

// POST /api/assignments — 4.9 Fix: nhận test_cases array (public + hidden)
router.post('/', authenticate, requireRole('teacher'), verifyClassroomAccess, (req, res) => {
  const { classroom_id, title, description, lang, deadline, concepts, sample_code,
    weight_t1, weight_t2, weight_t3, test_cases } = req.body
  if (!classroom_id || !title) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' })

  // Validate test_cases format nếu có
  const testCasesArr = Array.isArray(test_cases) ? test_cases.map(tc => ({
    input: String(tc.input ?? ''),
    expected: String(tc.expected ?? ''),
    hidden: Boolean(tc.hidden)   // true = ẩn khỏi student
  })) : []

  const db = getDb()
  const result = db.prepare(`
    INSERT INTO assignments (classroom_id,title,description,lang,deadline,concepts_json,sample_code,weight_t1,weight_t2,weight_t3,status,test_cases_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,'open',?)
  `).run(
    classroom_id, title, description || '', lang || 'C++', deadline || null,
    JSON.stringify(concepts || []), sample_code || '',
    weight_t1 || 40, weight_t2 || 35, weight_t3 || 25,
    JSON.stringify(testCasesArr)
  )
  res.status(201).json({
    id: result.lastInsertRowid, title, status: 'open',
    concepts: concepts || [],
    test_case_count: testCasesArr.length,
    hidden_test_count: testCasesArr.filter(t => t.hidden).length
  })
})

// PATCH /api/assignments/:id — cập nhật thông tin (bao gồm sample_code, concepts, test_cases)
router.patch('/:id', authenticate, requireRole('teacher'), verifyAssignmentAccess({ teacherOnly: true }), (req, res) => {
  const { title, description, deadline, concepts, sample_code, lang, test_cases } = req.body
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
  if (!updates.length) return res.status(400).json({ error: 'Không có gì cập nhật' })
  vals.push(req.params.id)
  db.prepare(`UPDATE assignments SET ${updates.join(',')} WHERE id=?`).run(...vals)
  const updated = db.prepare('SELECT * FROM assignments WHERE id=?').get(req.params.id)
  const { concepts_json: uj, test_cases_json: utj, ...updClean } = updated
  res.json({ ...updClean, concepts: JSON.parse(uj || '[]'), test_case_count: JSON.parse(utj || '[]').length })
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
    const { misconceptions_json, ...clean } = s
    return { ...clean, misconceptions: JSON.parse(misconceptions_json || '[]') }
  }))
})

export default router
