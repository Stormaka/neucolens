import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDb } from '../db/database.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'neu-codelens-secret-2026'

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc', status: 400 })

  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng', status: 401 })

  const valid = bcrypt.compareSync(password, user.password_hash)
  if (!valid) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng', status: 401 })

  // #18: 24h expiry (down from 7d). #19: no PII (name) in JWT payload
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' })
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, mssv: user.mssv } })
})

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { email, password, name, role, mssv } = req.body
  if (!email || !password || !name || !role) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc', status: 400 })

  const db = getDb()
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) return res.status(409).json({ error: 'Email đã được sử dụng', status: 409 })

  const hash = bcrypt.hashSync(password, 10)
  try {
    const result = db.prepare('INSERT INTO users (email,password_hash,name,role,mssv) VALUES (?,?,?,?,?)').run(email, hash, name, role, mssv || null)
    const token = jwt.sign({ id: result.lastInsertRowid, role }, JWT_SECRET, { expiresIn: '24h' })
    res.status(201).json({ token, user: { id: result.lastInsertRowid, email, name, role, mssv, student_code: mssv } })
  } catch (e) {
    res.status(500).json({ error: 'Lỗi tạo tài khoản', status: 500 })
  }
})

// GET /api/auth/me (protected)
router.get('/me', authenticate, (req, res) => {
  const db = getDb()
  const user = db.prepare('SELECT id,email,name,role,mssv,created_at FROM users WHERE id=?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'Không tìm thấy user', status: 404 })
  res.json({ ...user, student_code: user.mssv })
})

// Middleware
export function authenticate(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Không có token xác thực', status: 401 })
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn', status: 401 })
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) return res.status(403).json({ error: `Chỉ ${role} mới có quyền truy cập`, status: 403 })
    next()
  }
}

/**
 * Storm v4: Middleware phân quyền theo lớp học
 * - Teacher: phải là người tạo lớp
 * - Student: phải đã được ghi danh vào lớp
 */
export async function verifyClassroomAccess(req, res, next) {
  try {
    // getDb được export từ database.js — dùng dynamic require để tránh circular
    const { getDb } = await Promise.resolve().then(() => import('../db/database.js'))
    const db = getDb()
    const cid = req.params.classroomId || req.params.id || req.body?.classroom_id
    if (!cid) return next()

    const user = req.user
    if (user.role === 'teacher') {
      const cls = db.prepare('SELECT id FROM classrooms WHERE id=? AND lecturer_id=?').get(cid, user.id)
      if (!cls) return res.status(403).json({ error: 'Bạn không có quyền truy cập lớp này' })
    } else {
      const enrolled = db.prepare('SELECT id FROM enrollments WHERE classroom_id=? AND student_id=?').get(cid, user.id)
      if (!enrolled) return res.status(403).json({ error: 'Bạn chưa được ghi danh vào lớp này' })
    }
    next()
  } catch { next() }
}

export default router
