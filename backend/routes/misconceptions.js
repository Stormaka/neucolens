import express from 'express'
import { getDb } from '../db/database.js'
import { authenticate } from './auth.js'

const router = express.Router()

// GET /api/misconceptions/classroom/:classId
// — Thống kê ngộ nhận theo lớp (cho giảng viên)
router.get('/classroom/:classId', authenticate, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Chỉ giảng viên' })

  const db = getDb()
  const { classId } = req.params

  // Tổng hợp theo concept
  const stats = db.prepare(`
    SELECT m.concept, COUNT(DISTINCT m.student_id) as student_count,
           COUNT(*) as occurrence_count,
           GROUP_CONCAT(DISTINCT u.name) as student_names
    FROM misconceptions m
    JOIN users u ON m.student_id = u.id
    WHERE m.classroom_id = ?
    GROUP BY m.concept
    ORDER BY student_count DESC
  `).all(classId)

  // Chi tiết theo từng SV
  const details = db.prepare(`
    SELECT m.*, u.name as student_name, a.title as assignment_title,
           s.code as student_code
    FROM misconceptions m
    JOIN users u ON m.student_id = u.id
    JOIN assignments a ON m.assignment_id = a.id
    LEFT JOIN submissions s ON s.student_id = m.student_id
      AND s.assignment_id = m.assignment_id
      AND s.attempt_number = (
        SELECT MAX(attempt_number) FROM submissions
        WHERE student_id = m.student_id AND assignment_id = m.assignment_id
      )
    WHERE m.classroom_id = ?
    ORDER BY m.detected_at DESC
  `).all(classId)

  res.json({ stats, details })
})

// GET /api/misconceptions/student/:studentId?classId=X
// — Ngộ nhận của một sinh viên
router.get('/student/:studentId', authenticate, (req, res) => {
  const db = getDb()
  const { studentId } = req.params
  const { classId } = req.query

  // SV chỉ xem của mình, GV xem tất cả
  if (req.user.role === 'student' && req.user.id !== parseInt(studentId)) {
    return res.status(403).json({ error: 'Không có quyền' })
  }

  let query = `
    SELECT m.*, a.title as assignment_title
    FROM misconceptions m
    JOIN assignments a ON m.assignment_id = a.id
    WHERE m.student_id = ?
  `
  const params = [studentId]
  if (classId) { query += ' AND m.classroom_id = ?'; params.push(classId) }
  query += ' ORDER BY m.detected_at DESC'

  const list = db.prepare(query).all(...params)
  res.json(list)
})

// POST /api/misconceptions — thêm ngộ nhận mới
router.post('/', authenticate, (req, res) => {
  const db = getDb()
  const { student_id, assignment_id, classroom_id, concept, description } = req.body

  if (!student_id || !assignment_id || !classroom_id || !concept) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' })
  }

  const result = db.prepare(
    'INSERT INTO misconceptions (student_id, assignment_id, classroom_id, concept, description) VALUES (?,?,?,?,?)'
  ).run(student_id, assignment_id, classroom_id, concept, description || '')

  res.json({ id: result.lastInsertRowid, concept, description })
})

export default router
