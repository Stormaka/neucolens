import express from 'express'
import bcrypt from 'bcryptjs'
import { getDb } from '../db/database.js'
import { authenticate, requireRole } from './auth.js'

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
    query += ' AND (name LIKE ? OR email LIKE ? OR mssv LIKE ?)'
    const like = `%${search}%`
    params.push(like, like, like)
  }
  query += ' ORDER BY role, name'
  const users = db.prepare(query).all(...params)
  res.json(users)
})

// POST /api/admin/users — create a new user
router.post('/users', (req, res) => {
  const { email, password, name, role, mssv } = req.body
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc (email, password, name, role)' })
  }
  if (!['teacher', 'student'].includes(role)) {
    return res.status(400).json({ error: 'Vai trò không hợp lệ. Chỉ chấp nhận: teacher, student' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' })
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
    res.status(500).json({ error: 'Lỗi tạo tài khoản: ' + (e.message || '') })
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

export default router
