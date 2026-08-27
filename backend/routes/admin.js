import express from 'express'
import bcrypt from 'bcryptjs'
import AdmZip from 'adm-zip'
import { getDb } from '../db/database.js'
import { authenticate, requireRole } from './auth.js'
import { buildResearchExport, toCsv } from '../services/exportService.js'
import { detectPlagiarism } from '../services/plagiarism.js'

const router = express.Router()

// All admin routes require teacher role
router.use(authenticate, requireRole('teacher'))

// GET /api/admin/users — list all users with optional filters
router.get('/users', (req, res) => {
  const db = getDb()
  const { role, search } = req.query
  let query = 'SELECT id, email, name, role, mssv, created_at FROM users WHERE 1=1'
  const params = []
  if (role && ['teacher', 'student'].includes(role)) {
    query += ' AND role=?'
    params.push(role)
  }
  if (search) {
    const esc = String(search).replace(/[%_\\]/g, '\\$&')
    query += ' AND (name LIKE ? ESCAPE \'\\\' OR email LIKE ? ESCAPE \'\\\' OR mssv LIKE ? ESCAPE \'\\\')'
    const like = `%${esc}%`
    params.push(like, like, like)
  }
  query += ' ORDER BY role, name'
  const users = db.prepare(query).all(...params)
  res.json(users)
})

// POST /api/admin/users — create a new user
const strongPassword = pw => typeof pw === 'string' && pw.length >= 12 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)
const isValidEmail = e => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
router.post('/users', (req, res) => {
  const { email, password, name, role, mssv } = req.body
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc (email, password, name, role)' })
  }
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Email không hợp lệ', code: 'INVALID_EMAIL' })
  if (!['teacher', 'student'].includes(role)) {
    return res.status(400).json({ error: 'Vai trò không hợp lệ. Chỉ chấp nhận: teacher, student' })
  }
  if (!strongPassword(password)) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt', code: 'WEAK_PASSWORD' })
  }
  const db = getDb()
  const existing = db.prepare('SELECT id FROM users WHERE email=?').get(email)
  if (existing) return res.status(409).json({ error: 'Email đã được sử dụng' })
  const hash = bcrypt.hashSync(password, 10)
  try {
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, name, role, mssv) VALUES (?,?,?,?,?)'
    ).run(email, hash, name, role, mssv || null)
    res.status(201).json({ id: result.lastInsertRowid, email, name, role, mssv: mssv || null })
  } catch (e) {
    console.error('Create user error:', e.message)
    res.status(500).json({ error: 'Lỗi tạo tài khoản. Vui lòng thử lại.', code: 'CREATE_USER_FAILED' })
  }
})

// DELETE /api/admin/users/:id — delete a user
router.delete('/users/:id', (req, res) => {
  const db = getDb()
  const user = db.prepare('SELECT id, role FROM users WHERE id=?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' })
  // Prevent teacher from deleting themselves
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Không thể xóa tài khoản của chính mình' })
  }
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id)
  res.json({ success: true })
})

// GET /api/admin/classrooms — list all classrooms
router.get('/classrooms', (req, res) => {
  const db = getDb()
  const rooms = db.prepare(`
    SELECT c.*, u.name as lecturer_name,
      (SELECT COUNT(*) FROM enrollments WHERE classroom_id=c.id) as student_count,
      (SELECT COUNT(*) FROM assignments WHERE classroom_id=c.id) as assignment_count
    FROM classrooms c JOIN users u ON c.lecturer_id=u.id
    ORDER BY c.id DESC
  `).all()
  res.json(rooms)
})

// POST /api/admin/classrooms — create a new classroom
router.post('/classrooms', (req, res) => {
  const { name, description, lang, semester, lecturer_id } = req.body
  if (!name) return res.status(400).json({ error: 'Tên lớp là bắt buộc' })
  const db = getDb()
  // Use provided lecturer_id or fall back to current teacher
  const teacherId = lecturer_id || req.user.id
  const lecturer = db.prepare('SELECT id FROM users WHERE id=? AND role="teacher"').get(teacherId)
  if (!lecturer) return res.status(400).json({ error: 'Giảng viên không tồn tại' })
  const result = db.prepare(
    'INSERT INTO classrooms (name, description, lecturer_id, lang, semester) VALUES (?,?,?,?,?)'
  ).run(name, description || '', teacherId, lang || 'C++', semester || '')
  res.status(201).json({ id: result.lastInsertRowid, name, description, lecturer_id: teacherId, lang, semester })
})

// POST /api/admin/classrooms/:id/enroll — enroll a student by email
router.post('/classrooms/:id/enroll', (req, res) => {
  const { studentEmail } = req.body
  if (!studentEmail) return res.status(400).json({ error: 'Email sinh viên là bắt buộc' })
  const db = getDb()
  const student = db.prepare('SELECT id, name FROM users WHERE email=? AND role="student"').get(studentEmail)
  if (!student) return res.status(404).json({ error: 'Không tìm thấy sinh viên với email này' })
  const room = db.prepare('SELECT id FROM classrooms WHERE id=?').get(req.params.id)
  if (!room) return res.status(404).json({ error: 'Không tìm thấy lớp học' })
  try {
    db.prepare('INSERT INTO enrollments (student_id, classroom_id) VALUES (?,?)').run(student.id, req.params.id)
    res.json({ success: true, student: { id: student.id, name: student.name, email: studentEmail } })
  } catch {
    res.status(409).json({ error: 'Sinh viên đã trong lớp này' })
  }
})

// DELETE /api/admin/classrooms/:id/students/:studentId — remove student from class
router.delete('/classrooms/:id/students/:studentId', (req, res) => {
  const db = getDb()
  const result = db.prepare(
    'DELETE FROM enrollments WHERE classroom_id=? AND student_id=?'
  ).run(req.params.id, req.params.studentId)
  if (result.changes === 0) return res.status(404).json({ error: 'Sinh viên không ở trong lớp này' })
  res.json({ success: true })
})

// PATCH /api/admin/assignments/:id/deadline — extend deadline
router.patch('/assignments/:id/deadline', (req, res) => {
  const { deadline } = req.body
  if (!deadline) return res.status(400).json({ error: 'Deadline là bắt buộc' })
  const db = getDb()
  const asgn = db.prepare('SELECT id FROM assignments WHERE id=?').get(req.params.id)
  if (!asgn) return res.status(404).json({ error: 'Không tìm thấy bài tập' })
  db.prepare('UPDATE assignments SET deadline=? WHERE id=?').run(deadline, req.params.id)
  res.json({ success: true, deadline })
})

// PATCH /api/admin/assignments/:id/status — open or close assignment
router.patch('/assignments/:id/status', (req, res) => {
  const { status } = req.body
  if (!['open', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Status không hợp lệ. Chỉ chấp nhận: open, closed' })
  }
  const db = getDb()
  const asgn = db.prepare('SELECT id FROM assignments WHERE id=?').get(req.params.id)
  if (!asgn) return res.status(404).json({ error: 'Không tìm thấy bài tập' })
  db.prepare('UPDATE assignments SET status=? WHERE id=?').run(status, req.params.id)
  res.json({ success: true, status })
})

// ── Phase 4A: Research Export (Excel 4 sheets / CSV zip / JSON) ──────────
// GET /api/admin/research/export?classroomId=1&format=json|csv|excel
router.get('/research/export', (req, res) => {
  const classroomId = req.query.classroomId ? Number(req.query.classroomId) : null
  const format = String(req.query.format || 'json').toLowerCase()
  const db = getDb()
  if (classroomId) {
    const owns = db.prepare('SELECT 1 FROM classrooms WHERE id=? AND lecturer_id=?').get(classroomId, req.user.id)
    if (!owns) return res.status(403).json({ error: 'Không có quyền xuất dữ liệu lớp này', code: 'FORBIDDEN_CLASSROOM' })
  }
  const data = buildResearchExport(classroomId)

  if (format === 'csv') {
    const zip = new AdmZip()
    const sheets = {
      'students.csv': { rows: data.students, cols: ['student_id','group','gender','age','major','class_code','consent_signed','pre_score','pre_test_date','post_score','post_test_date','midterm_grade','final_grade','dropout','dropout_week','dropout_reason','interview_done','notes'] },
      'submissions.csv': { rows: data.submissions, cols: ['student_id','group','week','assignment_id','submitted_at','submissions_count','time_to_submit_hours','git_commits','test_pass_rate','tier1_score','tier2_score','tier3_score','total_score','llm_proficiency_level','llm_feedback_length','teacher_reviewed','teacher_override_score'] },
      'llm_vs_human.csv': { rows: data.llm_vs_human, cols: ['submission_id','student_id','week','human_score_g1','human_score_g2','human_score_g3','human_score_avg','llm_score','human_level','llm_level','grader_disagreement','notes'] },
      'early_warning.csv': { rows: data.early_warning, cols: ['student_id','group','week_assessed','system_flag','system_risk_score','teacher_notified','intervention_done','actual_at_risk','predicted_at_risk','outcome_notes'] },
    }
    for (const [name, { rows, cols }] of Object.entries(sheets)) {
      zip.addFile(name, Buffer.from(toCsv(rows, cols), 'utf8'))
    }
    // Thêm README
    zip.addFile('README.txt', Buffer.from('NEU-CodeLens Research Export — 4 sheets matching data_collection_template.md\nGenerated: ' + new Date().toISOString() + '\nAnonymized: student_id = T001...\n', 'utf8'))
    const buf = zip.toBuffer()
    res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="neu-codelens-export-${classroomId||'all'}-${Date.now()}.zip"`, 'Content-Length': buf.length })
    return res.send(buf)
  }

  if (format === 'excel') {
    // Thử dùng exceljs nếu có, fallback về JSON
    import('exceljs').then(async ({ default: ExcelJS }) => {
      const wb = new ExcelJS.Workbook()
      wb.creator = 'NEU-CodeLens'
      wb.created = new Date()
      const addSheet = (name, rows, cols) => {
        const ws = wb.addWorksheet(name)
        ws.addRow(cols)
        const header = ws.getRow(1)
        header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } }
        header.commit()
        rows.forEach(r => ws.addRow(cols.map(c => r[c] ?? '')))
        ws.columns.forEach(col => { col.width = 14 })
      }
      addSheet('students', data.students, ['student_id','group','gender','age','major','class_code','consent_signed','pre_score','pre_test_date','post_score','post_test_date','midterm_grade','final_grade','dropout','dropout_week','dropout_reason','interview_done','notes'])
      addSheet('submissions', data.submissions, ['student_id','group','week','assignment_id','submitted_at','submissions_count','time_to_submit_hours','git_commits','test_pass_rate','tier1_score','tier2_score','tier3_score','total_score','llm_proficiency_level','llm_feedback_length','teacher_reviewed','teacher_override_score'])
      addSheet('llm_vs_human', data.llm_vs_human, ['submission_id','student_id','week','human_score_g1','human_score_g2','human_score_g3','human_score_avg','llm_score','human_level','llm_level','grader_disagreement','notes'])
      addSheet('early_warning', data.early_warning, ['student_id','group','week_assessed','system_flag','system_risk_score','teacher_notified','intervention_done','actual_at_risk','predicted_at_risk','outcome_notes'])
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="neu-codelens-${classroomId||'all'}-${Date.now()}.xlsx"` })
      await wb.xlsx.write(res)
      res.end()
    }).catch(() => {
      // Fallback JSON nếu chưa cài exceljs
      res.json({ ...data, note: 'exceljs not installed — run npm install exceljs --prefix backend for .xlsx, fallback JSON', _anonMap: undefined })
    })
    return
  }

  // default json (anonymized)
  res.json({ ...data, _anonMap: undefined })
})

// GET /api/admin/research/stats?classroomId=1 — tóm tắt cho dashboard
router.get('/research/stats', (req, res) => {
  const classroomId = req.query.classroomId ? Number(req.query.classroomId) : null
  const db = getDb()
  if (classroomId) {
    const owns = db.prepare('SELECT 1 FROM classrooms WHERE id=? AND lecturer_id=?').get(classroomId, req.user.id)
    if (!owns) return res.status(403).json({ error: 'Không có quyền', code: 'FORBIDDEN_CLASSROOM' })
  }
  const data = buildResearchExport(classroomId)
  // Tính nhanh kappa từ llm_vs_human nếu có
  let kappa = null, mae = null, r = null
  if (data.llm_vs_human.length >= 5) {
    const diffs = data.llm_vs_human.map(x => Math.abs((x.llm_score||0) - (x.human_score_avg||0)))
    mae = diffs.length ? Math.round(diffs.reduce((a,b)=>a+b,0)/diffs.length * 100)/100 : null
  }
  res.json({
    classroomId,
    counts: {
      students: data.students.length,
      submissions: data.submissions.length,
      reviewed: data.llm_vs_human.length,
      early_warning: data.early_warning.length,
    },
    llm_vs_human: { n: data.llm_vs_human.length, mae },
    kappa_target: 0.61,
    note: 'Dùng /research/export?format=excel để chạy statistical_analysis.py',
  })
})

// ── Phase 4B: Plagiarism quick check (admin) ───────────────────────────
// GET /api/admin/research/plagiarism?assignmentId=15&threshold=0.8
router.get('/research/plagiarism', (req, res) => {
  const assignmentId = Number(req.query.assignmentId)
  const threshold = Math.min(0.95, Math.max(0.5, Number(req.query.threshold) || 0.8))
  if (!assignmentId) return res.status(400).json({ error: 'Thiếu assignmentId', code: 'MISSING_ASSIGNMENT' })
  const db = getDb()
  const asgn = db.prepare('SELECT classroom_id FROM assignments WHERE id=?').get(assignmentId)
  if (!asgn) return res.status(404).json({ error: 'Không tìm thấy bài tập' })
  const owns = db.prepare('SELECT 1 FROM classrooms WHERE id=? AND lecturer_id=?').get(asgn.classroom_id, req.user.id)
  if (!owns) return res.status(403).json({ error: 'Không có quyền', code: 'FORBIDDEN_CLASSROOM' })
  const subs = db.prepare(`
    SELECT s.id, s.student_id, s.code, u.name student_name
    FROM submissions s JOIN users u ON u.id=s.student_id
    WHERE s.assignment_id=? AND s.code IS NOT NULL AND length(s.code) > 20
    GROUP BY s.student_id HAVING MAX(s.id) = s.id
  `).all(assignmentId)
  // Lấy latest per student (group by)
  const latest = db.prepare(`
    SELECT s.id, s.student_id, s.code, u.name student_name
    FROM submissions s JOIN users u ON u.id=s.student_id
    WHERE s.assignment_id=?
    ORDER BY s.student_id, s.id DESC
  `).all(assignmentId)
  const map = new Map()
  latest.forEach(r => { if (!map.has(r.student_id)) map.set(r.student_id, r) })
  const uniq = [...map.values()]
  const pairs = detectPlagiarism(uniq, threshold)
  res.json({ assignmentId, threshold, total_submissions: uniq.length, pairs, note: 'Jaccard 5-gram trên code đã chuẩn hoá (bỏ comment/#include)' })
})

export default router
