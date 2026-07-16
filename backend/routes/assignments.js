import express from 'express'
import { getDb } from '../db/database.js'
import { authenticate, requireRole } from './auth.js'

const router = express.Router()

// GET /api/assignments/classroom/:id
router.get('/classroom/:id', authenticate, (req, res) => {
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
    const { avg_score, concepts_json, ...aClean } = a
    return {
      ...aClean,
      concepts: JSON.parse(concepts_json || '[]'),
      avgScore: Math.round(avg_score || 0)
    }
  })

  res.json({ data, total, page, limit })
})

// GET /api/assignments/:id — include sample_code (#10: strip raw JSON fields)
router.get('/:id', authenticate, (req, res) => {
  const db = getDb()
  const a = db.prepare('SELECT * FROM assignments WHERE id=?').get(req.params.id)
  if (!a) return res.status(404).json({ error: 'Không tìm thấy bài tập' })
  const { concepts_json, test_cases_json, ...clean } = a
  res.json({ ...clean, concepts: JSON.parse(concepts_json || '[]') })
})

// POST /api/assignments — tạo bài tập mới (với sample_code & dynamic concepts)
router.post('/', authenticate, requireRole('teacher'), (req, res) => {
  const { classroom_id, title, description, lang, deadline, concepts, sample_code, weight_t1, weight_t2, weight_t3 } = req.body
  if (!classroom_id || !title) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' })
  const db = getDb()
  const result = db.prepare(`INSERT INTO assignments (classroom_id,title,description,lang,deadline,concepts_json,sample_code,weight_t1,weight_t2,weight_t3,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,'open')`).run(
    classroom_id, title, description || '', lang || 'C++', deadline || null,
    JSON.stringify(concepts || []), sample_code || '',
    weight_t1 || 40, weight_t2 || 35, weight_t3 || 25
  )
  res.status(201).json({ id: result.lastInsertRowid, title, status: 'open', concepts: concepts || [] })
})

// PATCH /api/assignments/:id — cập nhật thông tin (bao gồm sample_code, concepts)
router.patch('/:id', authenticate, requireRole('teacher'), (req, res) => {
  const { title, description, deadline, concepts, sample_code, lang } = req.body
  const db = getDb()
  const updates = []
  const vals = []
  if (title !== undefined) { updates.push('title=?'); vals.push(title) }
  if (description !== undefined) { updates.push('description=?'); vals.push(description) }
  if (deadline !== undefined) { updates.push('deadline=?'); vals.push(deadline) }
  if (concepts !== undefined) { updates.push('concepts_json=?'); vals.push(JSON.stringify(concepts)) }
  if (sample_code !== undefined) { updates.push('sample_code=?'); vals.push(sample_code) }
  if (lang !== undefined) { updates.push('lang=?'); vals.push(lang) }
  if (!updates.length) return res.status(400).json({ error: 'Không có gì cập nhật' })
  vals.push(req.params.id)
  db.prepare(`UPDATE assignments SET ${updates.join(',')} WHERE id=?`).run(...vals)
  const updated = db.prepare('SELECT * FROM assignments WHERE id=?').get(req.params.id)
  const { concepts_json: uj, test_cases_json: utj, ...updClean } = updated
  res.json({ ...updClean, concepts: JSON.parse(uj || '[]') })
})

// PATCH /api/assignments/:id/status
router.patch('/:id/status', authenticate, requireRole('teacher'), (req, res) => {
  const { status } = req.body
  if (!['open','closed'].includes(status)) return res.status(400).json({ error: 'Status không hợp lệ' })
  const db = getDb()
  db.prepare('UPDATE assignments SET status=? WHERE id=?').run(status, req.params.id)
  res.json({ success: true, status })
})

// GET /api/assignments/:id/submissions — tất cả submissions (Teacher)
// #4: expose student_code alias for mssv; #10: strip misconceptions_json raw
router.get('/:id/submissions', authenticate, requireRole('teacher'), (req, res) => {
  const db = getDb()
  const subs = db.prepare(`
    SELECT s.*, u.name as student_name, u.mssv, u.mssv as student_code
    FROM submissions s JOIN users u ON s.student_id=u.id
    WHERE s.assignment_id=? ORDER BY s.submitted_at DESC
  `).all(req.params.id)
  res.json(subs.map(s => {
    const { misconceptions_json, ...clean } = s
    return { ...clean, misconceptions: JSON.parse(misconceptions_json || '[]') }
  }))
})

export default router
