import express from 'express'
import { getDb } from '../db/database.js'
import { authenticate, requireRole, verifyClassroomAccess } from './auth.js'

const router = express.Router()

// GET /api/classrooms — lớp của giảng viên hoặc sinh viên đã tham gia
router.get('/', authenticate, (req, res) => {
  const db = getDb()
  let rooms
  if (req.user.role === 'teacher') {
    rooms = db.prepare(`SELECT c.*, u.name as lecturer_name,
      (SELECT COUNT(*) FROM enrollments WHERE classroom_id=c.id) as student_count,
      (SELECT COUNT(*) FROM assignments WHERE classroom_id=c.id) as assignment_count
      FROM classrooms c JOIN users u ON c.lecturer_id=u.id WHERE c.lecturer_id=?`).all(req.user.id)
  } else {
    rooms = db.prepare(`SELECT c.*, u.name as lecturer_name,
      (SELECT COUNT(*) FROM enrollments WHERE classroom_id=c.id) as student_count
      FROM classrooms c JOIN users u ON c.lecturer_id=u.id
      JOIN enrollments e ON c.id=e.classroom_id WHERE e.student_id=?`).all(req.user.id)
  }
  res.json(rooms)
})

// POST /api/classrooms — tạo lớp mới (teacher only)
router.post('/', authenticate, requireRole('teacher'), (req, res) => {
  const { name, description, lang, semester } = req.body
  if (!name) return res.status(400).json({ error: 'Tên lớp là bắt buộc' })
  const db = getDb()
  const result = db.prepare('INSERT INTO classrooms (name,description,lecturer_id,lang,semester) VALUES (?,?,?,?,?)').run(name, description || '', req.user.id, lang || 'C++', semester || '')
  res.status(201).json({ id: result.lastInsertRowid, name, description, lecturer_id: req.user.id, lang, semester })
})

// GET /api/classrooms/:id — chi tiết lớp
router.get('/:id', authenticate, verifyClassroomAccess, (req, res) => {
  const db = getDb()
  const room = db.prepare('SELECT c.*,u.name as lecturer_name FROM classrooms c JOIN users u ON c.lecturer_id=u.id WHERE c.id=?').get(req.params.id)
  if (!room) return res.status(404).json({ error: 'Không tìm thấy lớp học' })
  res.json(room)
})

// GET /api/classrooms/:id/students — danh sách sinh viên + profiles (dynamic mastery)
router.get('/:id/students', authenticate, requireRole('teacher'), verifyClassroomAccess, (req, res) => {
  const db = getDb()
  // #6: Pagination — default limit 50 (backward compat); future UI can pass ?limit=20&page=2
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50))
  const offset = (page - 1) * limit

  const total = db.prepare('SELECT COUNT(*) as c FROM enrollments WHERE classroom_id=?').get(req.params.id).c

  const students = db.prepare(`
    SELECT u.id, u.name, u.email, u.mssv,
      sp.mastery_json, sp.overall_score,
      sp.profile_type, sp.risk_score, sp.trend,
      sp.strengths_json, sp.improvements_json, sp.misconceptions_json,
      (SELECT COUNT(*) FROM submissions s JOIN assignments a ON s.assignment_id=a.id
       WHERE s.student_id=u.id AND a.classroom_id=? AND s.attempt_number>0) as total_submissions,
      (SELECT COUNT(*) FROM submissions s JOIN assignments a ON s.assignment_id=a.id
       WHERE s.student_id=u.id AND a.classroom_id=? AND s.status='passed') as passed_count,
      (SELECT COUNT(*) FROM submissions s JOIN assignments a ON s.assignment_id=a.id
       WHERE s.student_id=u.id AND a.classroom_id=? AND s.ai_suspicion_flag=1) as ai_flag_count
    FROM users u
    JOIN enrollments e ON u.id=e.student_id
    LEFT JOIN student_profiles sp ON u.id=sp.student_id AND sp.classroom_id=?
    WHERE e.classroom_id=?
    ORDER BY sp.overall_score DESC
    LIMIT ? OFFSET ?
  `).all(req.params.id, req.params.id, req.params.id, req.params.id, req.params.id, limit, offset)

  // Aggregate classroom concepts from all assignments
  const classroomConcepts = db.prepare(
    'SELECT DISTINCT concepts_json FROM assignments WHERE classroom_id=? AND concepts_json IS NOT NULL'
  ).all(req.params.id).flatMap(r => { try { return JSON.parse(r.concepts_json) } catch { return [] } })
  const uniqueConcepts = [...new Set(classroomConcepts)]

  const data = students.map(s => {
    // #9/#10: Strip raw *_json blobs — expose only parsed values
    const { mastery_json, strengths_json, improvements_json, misconceptions_json, ...sClean } = s
    return {
      ...sClean,
      strengths: JSON.parse(s.strengths_json || '[]'),
      improvements: JSON.parse(s.improvements_json || '[]'),
      misconceptions: JSON.parse(s.misconceptions_json || '[]'),
      conceptMastery: (() => {
        try { return JSON.parse(s.mastery_json || '{}') } catch { return {} }
      })(),
      classroomConcepts: uniqueConcepts
    }
  })

  res.json({ data, total, page, limit })
})


// GET /api/classrooms/:id/stats — thống kê tổng quan
router.get('/:id/stats', authenticate, requireRole('teacher'), verifyClassroomAccess, (req, res) => {
  const db = getDb()
  const cid = req.params.id

  const studentCount = db.prepare('SELECT COUNT(*) as c FROM enrollments WHERE classroom_id=?').get(cid).c
  const avgScore = db.prepare(`SELECT AVG(sp.overall_score) as avg FROM student_profiles sp WHERE sp.classroom_id=?`).get(cid).avg || 0
  const atRiskCount = db.prepare(`SELECT COUNT(*) as c FROM student_profiles WHERE classroom_id=? AND profile_type='at-risk'`).get(cid).c
  const aiWarnCount = db.prepare(`SELECT COUNT(*) as c FROM student_profiles WHERE classroom_id=? AND profile_type='ai-warning'`).get(cid).c

  // Session progress: avg score per assignment
  const sessionProgress = db.prepare(`
    SELECT a.id, a.title, a.status,
      AVG(CASE WHEN s.attempt_number>0 THEN s.score_total END) as avg_score,
      COUNT(CASE WHEN s.attempt_number>0 THEN 1 END) as submission_count,
      COUNT(CASE WHEN s.status='passed' THEN 1 END) as passed_count
    FROM assignments a
    LEFT JOIN submissions s ON a.id=s.assignment_id
    WHERE a.classroom_id=?
    GROUP BY a.id ORDER BY a.id
  `).all(cid)

  res.json({
    studentCount,
    avgScore: Math.round(avgScore),
    atRiskCount,
    aiWarnCount,
    sessionProgress
  })
})

// POST /api/classrooms/:id/enroll — thêm sinh viên vào lớp
router.post('/:id/enroll', authenticate, requireRole('teacher'), (req, res) => {
  const { studentEmail } = req.body
  const db = getDb()
  const student = db.prepare('SELECT id FROM users WHERE email=? AND role="student"').get(studentEmail)
  if (!student) return res.status(404).json({ error: 'Không tìm thấy sinh viên' })
  try {
    db.prepare('INSERT INTO enrollments (student_id,classroom_id) VALUES (?,?)').run(student.id, req.params.id)
    res.json({ success: true })
  } catch {
    res.status(409).json({ error: 'Sinh viên đã trong lớp này' })
  }
})

export default router
