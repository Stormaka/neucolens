import express from 'express'
import { getDb } from '../db/database.js'
import { authenticate } from './auth.js'
import { generateChatReply } from '../services/llmService.js'

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
  const ownsClassroom = db.prepare(`SELECT 1 FROM assignments a JOIN classrooms c ON c.id=a.classroom_id
    JOIN enrollments e ON e.classroom_id=c.id AND e.student_id=?
    WHERE a.id=? AND c.lecturer_id=?`).get(studentId, assignmentId, req.user.id)
  if (!ownsClassroom) return res.status(403).json({ error: 'Không có quyền xem cuộc trò chuyện này', code: 'CHAT_ACCESS_DENIED' })

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

router.post('/:assignmentId/ask', authenticate, verifyChatAccess, async (req, res, next) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Chỉ sinh viên mới gửi câu hỏi', code: 'STUDENT_ONLY' })
    const content = String(req.body?.content || '').trim()
    if (!content) return res.status(400).json({ error: 'Nội dung câu hỏi là bắt buộc', code: 'CONTENT_REQUIRED' })
    if (content.length > 4000) return res.status(413).json({ error: 'Câu hỏi vượt quá 4000 ký tự', code: 'CONTENT_TOO_LONG' })

    const db = getDb()
    const assignment = db.prepare('SELECT * FROM assignments WHERE id=?').get(req.params.assignmentId)
    if (!assignment) return res.status(404).json({ error: 'Không tìm thấy bài tập', code: 'ASSIGNMENT_NOT_FOUND' })
    assignment.concepts = JSON.parse(assignment.concepts_json || '[]')
    const submission = db.prepare(`SELECT * FROM submissions WHERE assignment_id=? AND student_id=?
      ORDER BY submitted_at DESC,id DESC LIMIT 1`).get(req.params.assignmentId, req.user.id)

    let chat = db.prepare('SELECT * FROM ai_chats WHERE student_id=? AND assignment_id=?')
      .get(req.user.id, req.params.assignmentId)
    if (!chat) {
      const created = db.prepare('INSERT INTO ai_chats (student_id,assignment_id) VALUES (?,?)')
        .run(req.user.id, req.params.assignmentId)
      chat = { id: created.lastInsertRowid }
    }

    const reply = await generateChatReply({ question: content, assignment, submission })
    const save = db.transaction(() => {
      const userResult = db.prepare("INSERT INTO ai_messages (chat_id,sender,content) VALUES (?,'student',?)").run(chat.id, content)
      const aiResult = db.prepare("INSERT INTO ai_messages (chat_id,sender,content) VALUES (?,'ai',?)").run(chat.id, reply.content)
      return {
        user_message_id: userResult.lastInsertRowid,
        ai_message_id: aiResult.lastInsertRowid
      }
    })()
    res.json({ ...save, response: reply.content, provider: reply.provider, model: reply.model })
  } catch (error) {
    next(error)
  }
})

// ── POST /api/chats/:assignmentId/messages — gửi và lưu tin nhắn ─────────────
router.post('/:assignmentId/messages', authenticate, verifyChatAccess, (req, res) => {
  const db = getDb()
  const { assignmentId } = req.params
  const studentId = req.user.id
  const { content } = req.body
  const sender = req.user.role === 'student' ? 'student' : null

  if (!content || !sender) return res.status(400).json({ error: 'Thiếu content hoặc vai trò không hợp lệ', status: 400 })

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
