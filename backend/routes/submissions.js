import express from 'express'
import { getDb } from '../db/database.js'
import { authenticate, requireRole } from './auth.js'
import { analyzeCode, updateStudentProfile } from '../services/llmService.js'

const router = express.Router()

// In-memory rate limit: max 5 submissions / phút / student
// Note: resets on server restart (acceptable for dev; for production use Redis/DB)
const _rateMap = new Map()
function isRateLimited(studentId) {
  const now = Date.now(), window = 60_000, max = 5
  const prev = (_rateMap.get(studentId) || []).filter(t => now - t < window)
  if (prev.length >= max) return true
  _rateMap.set(studentId, [...prev, now])
  // Auto-clear old entries to prevent unbounded memory growth
  if (_rateMap.size > 5000) {
    for (const [k, v] of _rateMap) {
      if (v.every(t => now - t >= window)) _rateMap.delete(k)
    }
  }
  return false
}

// POST /api/submissions — nộp bài
router.post('/', authenticate, requireRole('student'), async (req, res) => {
  const { assignment_id, code } = req.body
  if (!assignment_id || code === undefined)
    return res.status(400).json({ error: 'Thiếu assignment_id hoặc code', status: 400 })

  // 4.4 Guard: giới hạn kích thước source code
  if (typeof code !== 'string' || code.length > 50_000)
    return res.status(413).json({ error: 'Code vượt quá giới hạn 50,000 ký tự', code: 'CODE_TOO_LARGE' })

  // Rate limit
  if (isRateLimited(req.user.id))
    return res.status(429).json({ error: 'Bạn đã nộp quá 5 lần trong 1 phút. Vui lòng chờ.', code: 'RATE_LIMITED' })

  const db = getDb()
  const asgn = db.prepare('SELECT * FROM assignments WHERE id=?').get(assignment_id)
  if (!asgn) return res.status(404).json({ error: 'Không tìm thấy bài tập', status: 404 })

  const enrolled = db.prepare('SELECT 1 FROM enrollments WHERE student_id=? AND classroom_id=?')
    .get(req.user.id, asgn.classroom_id)
  if (!enrolled)
    return res.status(403).json({ error: 'Bạn chưa được ghi danh vào lớp chứa bài tập này', code: 'NOT_ENROLLED' })

  if (asgn.status === 'closed')
    return res.status(400).json({ error: 'Bài tập đã đóng, không thể nộp', status: 400 })

  if (asgn.sample_code && code.replace(/\s+/g, '') === asgn.sample_code.replace(/\s+/g, ''))
    return res.status(422).json({ error: 'Bài nộp trùng hoàn toàn đáp án mẫu; hãy tự triển khai lời giải', code: 'SAMPLE_CODE_COPY' })

  // 4.13 Fix: dùng transaction để tránh race condition attempt_number
  let subId
  try {
    const insertTx = db.transaction(() => {
      const prevCount = db.prepare(
        'SELECT COUNT(*) as c FROM submissions WHERE assignment_id=? AND student_id=?'
      ).get(assignment_id, req.user.id).c
      const attemptNum = prevCount + 1
      const r = db.prepare(`
        INSERT INTO submissions (assignment_id, student_id, code, attempt_number, status, submitted_at)
        VALUES (?, ?, ?, ?, 'pending', datetime('now'))
      `).run(assignment_id, req.user.id, code, attemptNum)
      return r.lastInsertRowid
    })
    subId = insertTx()
  } catch (err) {
    console.error('Submission insert error:', err.message)
    return res.status(409).json({ error: 'Lỗi tạo bài nộp. Vui lòng thử lại.', code: 'INSERT_FAILED' })
  }

  // Durable lock-safe queue worker for submission grading
  const isServerless = Boolean(process.env.VERCEL)
  if (isServerless) {
    const completedSub = await processSubmissionGrading(subId)
    if (completedSub) {
      const { misconceptions_json, ...clean } = completedSub
      return res.status(201).json({ ...clean, misconceptions: JSON.parse(misconceptions_json || '[]') })
    }
    return res.status(201).json({ id: subId, status: 'failed', message: 'Lỗi phân tích bài nộp' })
  } else {
    res.status(202).json({ id: subId, status: 'pending', message: 'Bài nộp đang được phân tích...' })
    processSubmissionGrading(subId).catch(err => console.error('Queue grading error:', err))
  }
})

// ── #5/#15: Batch endpoint — trả latest submission cho nhiều assignments trong 1 request ──
// GET /api/submissions/me/batch?assignmentIds=1,2,3,4,5
// Returns: { [assignmentId]: latestSubmission }
router.get('/me/batch', authenticate, (req, res) => {
  const raw = req.query.assignmentIds || ''
  const ids = String(raw).split(',').map(Number).filter(n => n > 0)
  if (!ids.length) return res.json({})

  const db = getDb()
  const placeholders = ids.map(() => '?').join(',')
  // One query: get latest submission per assignment using subquery
  const subs = db.prepare(`
    SELECT s.*
    FROM submissions s
    INNER JOIN (
      SELECT assignment_id, MAX(id) as latest_id
      FROM submissions
      WHERE student_id = ? AND assignment_id IN (${placeholders})
      GROUP BY assignment_id
    ) lsub ON s.id = lsub.latest_id
    WHERE s.student_id = ?
  `).all(req.user.id, ...ids, req.user.id)

  const result = {}
  subs.forEach(s => {
    const { misconceptions_json, ...clean } = s
    result[s.assignment_id] = { ...clean, misconceptions: JSON.parse(misconceptions_json || '[]') }
  })
  res.json(result)
})

// GET /api/submissions/me/:assignmentId — (#2) chuẩn hóa /me/ thay vì /my/
router.get('/me/:assignmentId', authenticate, (req, res) => {
  const db = getDb()
  const subs = db.prepare(`SELECT * FROM submissions WHERE assignment_id=? AND student_id=? ORDER BY submitted_at DESC`).all(req.params.assignmentId, req.user.id)
  res.json(subs.map(s => { const { misconceptions_json, ...c } = s; return { ...c, misconceptions: JSON.parse(misconceptions_json || '[]') } }))
})

// GET /api/submissions?status=passed&from=ISO&to=ISO&sort=submitted_at&order=desc&page=1&limit=20
router.get('/', authenticate, (req, res) => {
  const db = getDb()
  const page = Math.max(1, Number.parseInt(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit) || 20))
  const filters = [], params = []
  if (req.user.role === 'student') { filters.push('s.student_id=?'); params.push(req.user.id) }
  else { filters.push('c.lecturer_id=?'); params.push(req.user.id) }
  if (req.query.status) {
    if (!['pending','passed','warning','failed'].includes(req.query.status)) return res.status(400).json({ error: 'Status không hợp lệ', code: 'INVALID_STATUS' })
    filters.push('s.status=?'); params.push(req.query.status)
  }
  if (req.query.from) { filters.push('s.submitted_at>=?'); params.push(req.query.from) }
  if (req.query.to) { filters.push('s.submitted_at<=?'); params.push(req.query.to) }
  if (req.query.classroom_id) { filters.push('a.classroom_id=?'); params.push(Number(req.query.classroom_id)) }
  const sortMap = { submitted_at: 's.submitted_at', score_total: 's.score_total', status: 's.status' }
  const sort = sortMap[req.query.sort] || 's.submitted_at'
  const order = String(req.query.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC'
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
  const base = `FROM submissions s JOIN assignments a ON a.id=s.assignment_id JOIN classrooms c ON c.id=a.classroom_id ${where}`
  const total = db.prepare(`SELECT COUNT(*) c ${base}`).get(...params).c
  const rows = db.prepare(`SELECT s.*,a.title assignment_title ${base} ORDER BY ${sort} ${order},s.id ${order} LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit)
  const data = rows.map(({ misconceptions_json, ...row }) => ({ ...row, misconceptions: JSON.parse(misconceptions_json || '[]') }))
  res.json({ data, total, page, limit })
})

// GET /api/submissions/student/:studentId/classroom/:classId — teacher view
// 4.12a Fix: thêm requireRole('teacher') + kiểm tra classroom ownership
router.get('/student/:studentId/classroom/:classId', authenticate, requireRole('teacher'), (req, res) => {
  const db = getDb()

  // 4.12a: Teacher chỉ được xem lớp của mình
  const classroom = db.prepare('SELECT 1 FROM classrooms WHERE id=? AND lecturer_id=?')
    .get(req.params.classId, req.user.id)
  if (!classroom)
    return res.status(403).json({ error: 'Bạn không có quyền xem dữ liệu lớp này', code: 'FORBIDDEN_CLASSROOM' })

  const subs = db.prepare(`
    SELECT s.*, a.title as assignment_title, a.concepts_json, a.id as assignment_id,
      (SELECT COUNT(*) FROM submissions
       WHERE student_id=s.student_id AND assignment_id=s.assignment_id) as total_attempts
    FROM submissions s JOIN assignments a ON s.assignment_id=a.id
    WHERE s.student_id=? AND a.classroom_id=?
    ORDER BY a.id ASC, s.submitted_at DESC
  `).all(req.params.studentId, req.params.classId)

  const grouped = {}
  subs.forEach(sub => {
    if (!grouped[sub.assignment_id]) {
      const { concepts_json, misconceptions_json, ...clean } = sub
      grouped[sub.assignment_id] = {
        ...clean,
        concepts: JSON.parse(concepts_json || '[]'),
        misconceptions: JSON.parse(misconceptions_json || '[]'),
      }
    }
  })
  res.json(Object.values(grouped))
})

// PATCH /api/submissions/:id/override — Giảng viên sửa điểm tay
// 4.12b Fix: kiểm tra submission thuộc classroom của teacher
router.patch('/:id/override', authenticate, requireRole('teacher'), (req, res) => {
  const db = getDb()
  const sub = db.prepare(`
    SELECT s.*, a.classroom_id
    FROM submissions s JOIN assignments a ON s.assignment_id=a.id
    WHERE s.id=?
  `).get(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Không tìm thấy submission', status: 404 })

  // 4.12b: Teacher chỉ được sửa điểm submission thuộc classroom của mình
  const owns = db.prepare('SELECT 1 FROM classrooms WHERE id=? AND lecturer_id=?')
    .get(sub.classroom_id, req.user.id)
  if (!owns)
    return res.status(403).json({ error: 'Bạn không có quyền sửa điểm submission này', code: 'FORBIDDEN_OVERRIDE' })

  const { score_total, score_t1, score_t2, score_t3, status, llm_feedback } = req.body

  // Validate score ranges
  const asgn = db.prepare('SELECT weight_t1, weight_t2, weight_t3 FROM assignments WHERE id=?').get(sub.assignment_id)
  const maxT1 = asgn?.weight_t1 ?? 40
  const maxT2 = asgn?.weight_t2 ?? 35
  const maxT3 = asgn?.weight_t3 ?? 25

  const newT1 = (score_t1 !== undefined && score_t1 !== null) ? Number(score_t1) : sub.score_t1
  const newT2 = score_t2 !== undefined ? Number(score_t2) : sub.score_t2
  const newT3 = score_t3 !== undefined ? Number(score_t3) : sub.score_t3

  if (newT1 !== null && (!Number.isFinite(newT1) || newT1 < 0 || newT1 > maxT1)) {
    return res.status(400).json({ error: `score_t1 phải là số hợp lệ từ 0–${maxT1}`, code: 'INVALID_SCORE' })
  }
  if (!Number.isFinite(newT2) || newT2 < 0 || newT2 > maxT2) {
    return res.status(400).json({ error: `score_t2 phải là số hợp lệ từ 0–${maxT2}`, code: 'INVALID_SCORE' })
  }
  if (!Number.isFinite(newT3) || newT3 < 0 || newT3 > maxT3) {
    return res.status(400).json({ error: `score_t3 phải là số hợp lệ từ 0–${maxT3}`, code: 'INVALID_SCORE' })
  }

  const validStatuses = ['pending', 'passed', 'warning', 'failed', 'ungraded']
  if (status !== undefined && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `status phải thuộc: ${validStatuses.join(', ')}`, code: 'INVALID_STATUS' })
  }

  if (llm_feedback !== undefined && (typeof llm_feedback !== 'string' || llm_feedback.length > 5000)) {
    return res.status(400).json({ error: 'llm_feedback phải là chuỗi không quá 5000 ký tự', code: 'INVALID_FEEDBACK' })
  }

  const expectedTotal = newT1 !== null ? (newT1 + newT2 + newT3) : null
  if (score_total !== undefined && score_total !== null && (!Number.isFinite(Number(score_total)) || (expectedTotal !== null && Number(score_total) !== expectedTotal))) {
    return res.status(400).json({ error: `score_total (${score_total}) không hợp lệ hoặc không bằng tổng T1+T2+T3`, code: 'INVALID_TOTAL' })
  }

  const newTotal = score_total !== undefined ? (score_total !== null ? Number(score_total) : null) : expectedTotal
  const newStatus = status || (newTotal !== null ? (newTotal >= 70 ? 'passed' : newTotal >= 50 ? 'warning' : 'failed') : 'ungraded')
  const newFeedback = llm_feedback !== undefined ? llm_feedback : sub.llm_feedback

  db.prepare(`
    UPDATE submissions SET score_total=?, score_t1=?, score_t2=?, score_t3=?, status=?, llm_feedback=?
    WHERE id=?
  `).run(newTotal, newT1, newT2, newT3, newStatus, newFeedback, req.params.id)

  const updated = db.prepare('SELECT * FROM submissions WHERE id=?').get(req.params.id)
  const { misconceptions_json, ...clean } = updated
  res.json({ ...clean, misconceptions: JSON.parse(misconceptions_json || '[]') })
})

const activeGradingJobs = new Set()

export async function processSubmissionGrading(subId) {
  if (activeGradingJobs.has(subId)) return null
  const db = getDb()

  // DB-backed atomic claim to prevent race conditions across multi-instance processes
  const claimed = db.prepare(`
    UPDATE submissions 
    SET grading_status = 'processing' 
    WHERE id = ? AND (status = 'pending' OR grading_status IN ('queued', 'failed'))
  `).run(subId)

  if (claimed.changes === 0) return null
  activeGradingJobs.add(subId)

  try {
    const sub = db.prepare(`
      SELECT s.*, a.title, a.description, a.concepts_json, a.weight_t1, a.weight_t2, a.weight_t3, a.test_cases_json, a.lang, a.classroom_id, u.name as student_name
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      JOIN users u ON s.student_id = u.id
      WHERE s.id = ?
    `).get(subId)

    if (!sub) return null

    const asgn = {
      title: sub.title, description: sub.description, lang: sub.lang,
      concepts: JSON.parse(sub.concepts_json || '[]'),
      test_cases_json: sub.test_cases_json,
      weight_t1: sub.weight_t1, weight_t2: sub.weight_t2, weight_t3: sub.weight_t3
    }

    const analysis = await analyzeCode(sub.code, asgn, sub.student_name || '')
    db.prepare(`
      UPDATE submissions SET score_total=?, score_t1=?, score_t2=?, score_t3=?, status=?, grading_status='completed',
        llm_feedback=?, ai_suspicion_flag=?, ai_suspicion_confidence=?, ai_suspicion_reason=?,
        misconceptions_json=?
      WHERE id=?
    `).run(
      analysis.score_total, analysis.score_t1, analysis.score_t2, analysis.score_t3, analysis.status,
      analysis.llm_feedback, analysis.ai_suspicion_flag, analysis.ai_suspicion_confidence,
      analysis.ai_suspicion_reason, analysis.misconceptions_json, subId
    )

    const detectedMisconceptions = JSON.parse(analysis.misconceptions_json || '[]')
    if (detectedMisconceptions.length > 0) {
      const insertMisc = db.prepare(
        'INSERT OR IGNORE INTO misconceptions (student_id, assignment_id, classroom_id, concept, description) VALUES (?,?,?,?,?)'
      )
      detectedMisconceptions.forEach(desc => {
        const concept = desc.split('—')[0].replace(/^[🔴⚠️📌⭐💡🚨\s]+/, '').trim().substring(0, 100)
        try { insertMisc.run(sub.student_id, sub.assignment_id, sub.classroom_id, concept, desc) } catch { }
      })
    }

    updateStudentProfile(db, sub.student_id, sub.classroom_id,
      JSON.parse(sub.concepts_json || '[]'),
      analysis.concept_scores || {}
    )
    return db.prepare('SELECT * FROM submissions WHERE id=?').get(subId)
  } catch (err) {
    console.error(`Analysis error for submission #${subId}:`, err)
    getDb().prepare(`UPDATE submissions SET status='failed', grading_status='failed', llm_feedback=? WHERE id=?`)
      .run('Lỗi phân tích bài nộp. Vui lòng thử lại.', subId)
    return null
  } finally {
    activeGradingJobs.delete(subId)
  }
}

export async function recoverPendingSubmissions() {
  const db = getDb()
  const pendings = db.prepare(`SELECT id FROM submissions WHERE status = 'pending' OR grading_status IN ('queued', 'processing')`).all()

  if (!pendings.length) return

  console.log(`⏳ [DB Queue Recovery] Found ${pendings.length} pending submission(s). Processing...`)
  for (const sub of pendings) {
    await processSubmissionGrading(sub.id)
  }
}

// POST /api/submissions/:id/rate-feedback — Đánh giá chất lượng phản hồi AI
router.post('/:id/rate-feedback', authenticate, async (req, res) => {
  const { rating, comment, helpfulness_category } = req.body
  const numericRating = Number(rating)
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ error: 'Đánh giá phải từ 1 đến 5 sao', code: 'INVALID_RATING' })
  }

  const validCategories = ['helpful', 'incorrect', 'unclear', 'too_generic', 'unsafe']
  const finalCategory = validCategories.includes(helpfulness_category) ? helpfulness_category : 'helpful'

  if (comment && comment.length > 500) {
    return res.status(400).json({ error: 'Comment không vượt quá 500 ký tự', code: 'COMMENT_TOO_LONG' })
  }

  const db = getDb()
  const sub = db.prepare(`
    SELECT s.*, a.classroom_id
    FROM submissions s JOIN assignments a ON a.id = s.assignment_id
    WHERE s.id=?
  `).get(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Không tìm thấy bài nộp', status: 404 })

  if (req.user.role === 'student' && sub.student_id !== req.user.id) {
    return res.status(403).json({ error: 'Bạn chỉ được đánh giá phản hồi bài nộp của chính mình' })
  }

  // Teacher: kiểm tra classroom ownership
  if (req.user.role === 'teacher') {
    const owns = db.prepare('SELECT 1 FROM classrooms WHERE id=? AND lecturer_id=?')
      .get(sub.classroom_id, req.user.id)
    if (!owns) {
      return res.status(403).json({ error: 'Bạn không có quyền đánh giá submission của lớp khác', code: 'FORBIDDEN_CLASSROOM' })
    }
  }

  try {
    // UPSERT: cùng user + cùng submission → cập nhật thay vì tạo trùng
    const existing = db.prepare('SELECT id FROM feedback_ratings WHERE submission_id=? AND user_id=?')
      .get(req.params.id, req.user.id)

    let ratingId
    if (existing) {
      db.prepare(`
        UPDATE feedback_ratings SET rating=?, comment=?, helpfulness_category=? WHERE id=?
      `).run(numericRating, comment || '', finalCategory, existing.id)
      ratingId = existing.id
    } else {
      const result = db.prepare(`
        INSERT INTO feedback_ratings (submission_id, user_id, user_role, rating, comment, helpfulness_category)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(req.params.id, req.user.id, req.user.role, numericRating, comment || '', finalCategory)
      ratingId = result.lastInsertRowid
    }

    res.status(existing ? 200 : 201).json({
      success: true,
      rating_id: ratingId,
      submission_id: Number(req.params.id),
      rating: numericRating,
      updated: Boolean(existing),
      message: existing ? 'Đã cập nhật đánh giá của bạn.' : 'Cảm ơn bạn đã đánh giá phản hồi AI!'
    })
  } catch (err) {
    console.error('Rate feedback error:', err.message)
    res.status(500).json({ error: 'Lỗi lưu đánh giá. Vui lòng thử lại.', code: 'RATE_FAILED' })
  }
})


// GET /api/submissions/:id — polling result (phải ở sau các named routes)
// 4.12c Fix: student chỉ xem submission của chính mình; teacher chỉ xem lớp mình quản lý
router.get('/:id', authenticate, (req, res) => {
  const db = getDb()
  const sub = db.prepare('SELECT * FROM submissions WHERE id=?').get(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Không tìm thấy submission', status: 404 })

  if (req.user.role === 'student' && sub.student_id !== req.user.id)
    return res.status(403).json({ error: 'Không có quyền xem submission này', status: 403 })

  if (req.user.role === 'teacher') {
    const asgn = db.prepare('SELECT classroom_id FROM assignments WHERE id=?').get(sub.assignment_id)
    const owns = db.prepare('SELECT 1 FROM classrooms WHERE id=? AND lecturer_id=?').get(asgn?.classroom_id, req.user.id)
    if (!owns) return res.status(403).json({ error: 'Không có quyền xem submission này', status: 403 })
  }

  const { misconceptions_json, ...clean } = sub
  res.json({ ...clean, misconceptions: JSON.parse(misconceptions_json || '[]') })
})

export default router
