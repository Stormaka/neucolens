import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { getDb } from '../db/database.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'development-only-secret-change-before-production' : '')
if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error('JWT_SECRET phải có ít nhất 32 ký tự trong production')
const ACCESS_TOKEN_TTL = '30m'
const ACCESS_TOKEN_TTL_SECONDS = 30 * 60
const REFRESH_TOKEN_TTL_DAYS = 7
const loginAttempts = new Map()
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 8
const strongPassword = password => typeof password === 'string' && password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password)

function loginRateLimit(req, res, next) {
  const key = req.ip || 'unknown'
  const now = Date.now()
  const entry = loginAttempts.get(key)
  if (!entry || now - entry.startedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, startedAt: now }); return next()
  }
  if (entry.count >= LOGIN_MAX_ATTEMPTS) return res.status(429).json({ error: 'Quá nhiều lần đăng nhập. Vui lòng thử lại sau.', code: 'LOGIN_RATE_LIMITED' })
  entry.count += 1
  next()
}

function signAccessToken(user) {
  return jwt.sign({ id: user.id, role: user.role, type: 'access' }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL })
}

function createRefreshToken(db, userId) {
  const token = crypto.randomBytes(48).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  db.prepare(`INSERT INTO refresh_tokens (user_id,token_hash,expires_at)
    VALUES (?,?,datetime('now', ?))`).run(userId, tokenHash, `+${REFRESH_TOKEN_TTL_DAYS} days`)
  return token
}

function tokenResponse(db, user) {
  return {
    access_token: signAccessToken(user),
    refresh_token: createRefreshToken(db, user.id),
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS
  }
}

// POST /api/auth/login
router.post('/login', loginRateLimit, (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc', status: 400 })

  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng', status: 401 })

  const valid = bcrypt.compareSync(password, user.password_hash)
  if (!valid) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng', status: 401 })

  loginAttempts.delete(req.ip || 'unknown')
  res.json(tokenResponse(db, user))
})

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { email, password, name, role, mssv } = req.body
  if (!email || !password || !name || !role) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc', status: 400 })
  if (!strongPassword(password)) return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt', code: 'WEAK_PASSWORD' })
  if (!['teacher', 'student'].includes(role)) return res.status(400).json({ error: 'Vai trò không hợp lệ', code: 'INVALID_ROLE' })

  const db = getDb()
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) return res.status(409).json({ error: 'Email đã được sử dụng', status: 409 })

  const hash = bcrypt.hashSync(password, 10)
  try {
    const result = db.prepare('INSERT INTO users (email,password_hash,name,role,mssv) VALUES (?,?,?,?,?)').run(email, hash, name, role, mssv || null)
    res.status(201).json(tokenResponse(db, { id: result.lastInsertRowid, role }))
  } catch (e) {
    res.status(500).json({ error: 'Lỗi tạo tài khoản', status: 500 })
  }
})

router.post('/refresh', (req, res) => {
  const refreshToken = req.body?.refresh_token
  if (!refreshToken) return res.status(400).json({ error: 'Thiếu refresh_token', code: 'REFRESH_TOKEN_REQUIRED' })
  const db = getDb()
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
  const stored = db.prepare(`SELECT rt.id,rt.user_id,u.role FROM refresh_tokens rt
    JOIN users u ON u.id=rt.user_id
    WHERE rt.token_hash=? AND rt.revoked_at IS NULL AND rt.expires_at > datetime('now')`).get(tokenHash)
  if (!stored) return res.status(401).json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn', code: 'INVALID_REFRESH_TOKEN' })
  const rotate = db.transaction(() => {
    db.prepare("UPDATE refresh_tokens SET revoked_at=datetime('now') WHERE id=?").run(stored.id)
    return tokenResponse(db, { id: stored.user_id, role: stored.role })
  })
  res.json(rotate())
})

router.post('/logout', (req, res) => {
  const refreshToken = req.body?.refresh_token
  if (refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    getDb().prepare("UPDATE refresh_tokens SET revoked_at=datetime('now') WHERE token_hash=?").run(tokenHash)
  }
  res.status(204).end()
})

// GET /api/auth/me (protected)
router.get('/me', authenticate, (req, res) => {
  const db = getDb()
  const user = db.prepare('SELECT id,email,name,role,mssv,created_at FROM users WHERE id=?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'Không tìm thấy user', status: 404 })
  res.json(user)
})

// Middleware
export function authenticate(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Không có token xác thực', status: 401 })
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET)
    if (req.user.type !== 'access') throw new Error('Sai loại token')
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
    const { getDb } = await Promise.resolve().then(() => import('../db/database.js'))
    const db = getDb()
    const cid = req.params.classroomId || req.params.id || req.body?.classroom_id
    if (!cid) return next()

    const user = req.user
    if (user.role === 'teacher') {
      const cls = db.prepare('SELECT id FROM classrooms WHERE id=? AND lecturer_id=?').get(cid, user.id)
      if (!cls) return res.status(403).json({ error: 'Bạn không có quyền truy cập lớp này', code: 'FORBIDDEN_CLASSROOM' })
    } else {
      const enrolled = db.prepare('SELECT id FROM enrollments WHERE classroom_id=? AND student_id=?').get(cid, user.id)
      if (!enrolled) return res.status(403).json({ error: 'Bạn chưa được ghi danh vào lớp này', code: 'NOT_ENROLLED' })
    }
    next()
  } catch (e) {
    console.error('verifyClassroomAccess error:', e.message)
    return res.status(500).json({ error: 'Lỗi phân quyền lớp học', code: 'CLASSROOM_AUTH_ERROR' })
  }
}

export default router
