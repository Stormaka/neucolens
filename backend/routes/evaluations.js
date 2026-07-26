import express from 'express'
import { getDb } from '../db/database.js'
import { authenticate, requireRole } from './auth.js'
import { getValidationMetrics, seedExpertGroundTruth } from '../services/validationService.js'

const router = express.Router()

// GET /api/evaluations/metrics/classroom/:classroomId — 4-Factor Scientific Metrics
router.get('/metrics/classroom/:classroomId', authenticate, requireRole('teacher'), async (req, res) => {
  try {
    const metrics = await getValidationMetrics(req.params.classroomId)
    res.json(metrics)
  } catch (e) {
    res.status(500).json({ error: 'Lỗi tính toán chỉ số kiểm chứng: ' + e.message, status: 500 })
  }
})

// GET /api/evaluations/expert/submission/:submissionId — Lấy Ground Truth của bài nộp
router.get('/expert/submission/:submissionId', authenticate, (req, res) => {
  const db = getDb()
  const evalData = db.prepare(`
    SELECT ee.*, u.name as evaluator_name
    FROM expert_evaluations ee
    JOIN users u ON ee.evaluator_id = u.id
    WHERE ee.submission_id = ?
  `).get(req.params.submissionId)

  res.json(evalData || null)
})

// POST /api/evaluations/expert — Giảng viên lưu điểm Ground Truth cho 1 bài nộp
router.post('/expert', authenticate, requireRole('teacher'), (req, res) => {
  const db = getDb()
  const {
    submission_id,
    expert_score_total,
    expert_score_t1,
    expert_score_t2,
    expert_score_t3,
    expert_classification,
    expert_feedback,
    misconceptions_identified
  } = req.body

  if (!submission_id || expert_score_total === undefined) {
    return res.status(400).json({ error: 'Thiếu submission_id hoặc expert_score_total', status: 400 })
  }

  const sub = db.prepare('SELECT id FROM submissions WHERE id=?').get(submission_id)
  if (!sub) return res.status(404).json({ error: 'Không tìm thấy submission', status: 404 })

  const t1 = expert_score_t1 !== undefined ? expert_score_t1 : Math.round(expert_score_total * 0.4)
  const t2 = expert_score_t2 !== undefined ? expert_score_t2 : Math.round(expert_score_total * 0.35)
  const t3 = expert_score_t3 !== undefined ? expert_score_t3 : Math.round(expert_score_total * 0.25)
  const classification = expert_classification || (expert_score_total >= 85 ? 'advanced' : expert_score_total >= 60 ? 'on-track' : 'at-risk')
  const miscJson = JSON.stringify(misconceptions_identified || [])

  db.prepare(`
    INSERT INTO expert_evaluations (
      submission_id, evaluator_id, expert_score_total, expert_score_t1,
      expert_score_t2, expert_score_t3, expert_classification, expert_feedback,
      misconceptions_identified_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(submission_id) DO UPDATE SET
      evaluator_id = excluded.evaluator_id,
      expert_score_total = excluded.expert_score_total,
      expert_score_t1 = excluded.expert_score_t1,
      expert_score_t2 = excluded.expert_score_t2,
      expert_score_t3 = excluded.expert_score_t3,
      expert_classification = excluded.expert_classification,
      expert_feedback = excluded.expert_feedback,
      misconceptions_identified_json = excluded.misconceptions_identified_json,
      updated_at = datetime('now')
  `).run(submission_id, req.user.id, expert_score_total, t1, t2, t3, classification, expert_feedback || '', miscJson)

  const updated = db.prepare('SELECT * FROM expert_evaluations WHERE submission_id=?').get(submission_id)
  res.json(updated)
})

// POST /api/evaluations/seed-benchmark — Sinh dữ liệu Ground Truth thực nghiệm để test hệ thống
router.post('/seed-benchmark', authenticate, requireRole('teacher'), (req, res) => {
  const { classroomId } = req.body
  if (!classroomId) return res.status(400).json({ error: 'Thiếu classroomId', status: 400 })

  const count = seedExpertGroundTruth(classroomId, req.user.id)
  res.json({ message: `Đã khởi tạo ${count} điểm Ground Truth thực nghiệm cho lớp.`, seededCount: count })
})

export default router
