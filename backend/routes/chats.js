import express from 'express'
import { getDb } from '../db/database.js'
import { authenticate } from './auth.js'

const router = express.Router()

/**
 * #16: Authorization middleware — verify student is enrolled in the classroom
 * that owns the given assignment before allowing chat access.
 * Teachers bypass this check.
 */
function verifyChatAccess(req, res, next) {
  if (req.user.role === 'teacher') return next()
  const db = getDb()
  const { assignmentId } = req.params
  if (!assignmentId) return next()

  const asgn = db.prepare('SELECT classroom_id FROM assignments WHERE id=?').get(assignmentId)
  if (!asgn) return res.status(404).json({ error: 'Không tìm thấy bài tập', status: 404 })

  const enrolled = db.prepare('SELECT id FROM enrollments WHERE classroom_id=? AND student_id=?').get(asgn.classroom_id, req.user.id)
  if (!enrolled) return res.status(403).json({ error: 'Bạn chưa được ghi danh vào lớp chứa bài tập này', status: 403 })

  next()
}

// ── GET /api/chats/teacher/student/:studentId/assignment/:assignmentId ─────────
// NOTE: Phải đặt TRƯỚC route /:assignmentId để tránh conflict
// Giảng viên xem chat log của sinh viên
router.get('/teacher/student/:studentId/assignment/:assignmentId', authenticate, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Chỉ giảng viên mới xem được', status: 403 })

  const db = getDb()
  const { studentId, assignmentId } = req.params

  const chat = db.prepare('SELECT * FROM ai_chats WHERE student_id=? AND assignment_id=?')
    .get(studentId, assignmentId)

  if (!chat) return res.json({ chat: null, messages: [] })

  const messages = db.prepare('SELECT * FROM ai_messages WHERE chat_id=? ORDER BY sent_at ASC')
    .all(chat.id)

  res.json({ chat, messages })
})

// ── GET /api/chats/:assignmentId — lấy hoặc tạo phiên chat cho SV + assignment ─
router.get('/:assignmentId', authenticate, verifyChatAccess, (req, res) => {
  const db = getDb()
  const { assignmentId } = req.params
  const studentId = req.user.id

  let chat = db.prepare('SELECT * FROM ai_chats WHERE student_id=? AND assignment_id=?')
    .get(studentId, assignmentId)

  if (!chat) {
    const result = db.prepare('INSERT INTO ai_chats (student_id, assignment_id) VALUES (?,?)')
      .run(studentId, assignmentId)
    chat = db.prepare('SELECT * FROM ai_chats WHERE id=?').get(result.lastInsertRowid)
  }

  res.json(chat)
})

// ── GET /api/chats/:assignmentId/messages — lấy toàn bộ lịch sử tin nhắn ──────
router.get('/:assignmentId/messages', authenticate, verifyChatAccess, (req, res) => {
  const db = getDb()
  const { assignmentId } = req.params
  const studentId = req.user.id

  const chat = db.prepare('SELECT * FROM ai_chats WHERE student_id=? AND assignment_id=?')
    .get(studentId, assignmentId)

  if (!chat) return res.json([])

  const messages = db.prepare('SELECT * FROM ai_messages WHERE chat_id=? ORDER BY sent_at ASC')
    .all(chat.id)

  res.json(messages)
})

// ── POST /api/chats/:assignmentId/messages — gửi và lưu tin nhắn ─────────────
router.post('/:assignmentId/messages', authenticate, verifyChatAccess, (req, res) => {
  const db = getDb()
  const { assignmentId } = req.params
  const studentId = req.user.id
  const { content, sender } = req.body

  if (!content || !sender) return res.status(400).json({ error: 'Thiếu content hoặc sender', status: 400 })
  if (!['student', 'ai'].includes(sender)) return res.status(400).json({ error: 'sender phải là student hoặc ai', status: 400 })

  let chat = db.prepare('SELECT * FROM ai_chats WHERE student_id=? AND assignment_id=?')
    .get(studentId, assignmentId)

  if (!chat) {
    const result = db.prepare('INSERT INTO ai_chats (student_id, assignment_id) VALUES (?,?)')
      .run(studentId, assignmentId)
    chat = db.prepare('SELECT * FROM ai_chats WHERE id=?').get(result.lastInsertRowid)
  }

  const insertResult = db.prepare('INSERT INTO ai_messages (chat_id, sender, content) VALUES (?,?,?)')
    .run(chat.id, sender, content)

  const message = db.prepare('SELECT * FROM ai_messages WHERE id=?').get(insertResult.lastInsertRowid)
  res.json(message)
})

export default router
