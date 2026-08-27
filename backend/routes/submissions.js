import express from 'express'
import crypto from 'node:crypto'
import { getDb } from '../db/database.js'
import { authenticate, requireRole } from './auth.js'
import { analyzeCode, updateStudentProfile } from '../services/llmService.js'
import { computeProcessMetrics, computeEqLite, sanitizeEvents, buildProcessMetricsJson, MAX_EVENTS } from '../services/processMetrics.js'
import { buildRubricBreakdown, scaleTier, recomputeTotals, applyTeacherReview, cohensKappa05, QUALITATIVE_CRITERIA, T2_MAX, T3_MAX } from '../services/rubric.js'
import { judgeSubmission } from '../services/llmJudge.js'

const router = express.Router()

const T2_CRITERIA_MAX = T2_MAX   // 35
const T3_CRITERIA_MAX = T3_MAX   // 25

// ── Phase 3: Exam helpers ──
function isExamScoresHidden(assignment, nowMs = Date.now()) {
  if (!assignment?.is_exam) return false
  if (assignment.hide_scores_until) {
    const t = Date.parse(assignment.hide_scores_until)
    if (!Number.isNaN(t) && nowMs < t) return true
  }
  // Giấu điểm mặc định khi bài thi còn open (chờ GV đóng / công bố)
  if (assignment.status === 'open') return true
  return false
}
function stripScoresForStudent(row) {
  return {
    ...row,
    score_total: null, score_t1: null, score_t2: null, score_t3: null,
    status: row.status === 'pending' ? 'pending' : 'ungraded',
    llm_feedback: null, ai_suspicion_flag: 0, misconceptions: [],
    rubric_breakdown: null, llm_scores: null,
    scores_hidden: true,
  }
}

/** Chuẩn hoá row submissions → JSON trả client (parse *_json, không lộ raw) */
function serializeSubmission(row) {
  if (!row) return row
  const { misconceptions_json, process_metrics_json, llm_scores_json, rubric_breakdown_json, ...clean } = row
  const parse = s => { try { return s ? JSON.parse(s) : null } catch { return null } }
  // rubric_breakdown luôn là MẢNG tiêu chí cho client (unwrap wrapper khi lưu từ pipeline)
  const rbRaw = parse(rubric_breakdown_json)
  const rubricBreakdown = Array.isArray(rbRaw) ? rbRaw : Array.isArray(rbRaw?.breakdown) ? rbRaw.breakdown : null
  return {
    ...clean,
    misconceptions: JSON.parse(misconceptions_json || '[]'),
    process_metrics: parse(process_metrics_json),
    llm_scores: parse(llm_scores_json),
    rubric_breakdown: rubricBreakdown,
  }
}

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

// Rate limit riêng cho flush telemetry: 30 lần / phút / student (flush mỗi ~45s)
const _flushMap = new Map()
function flushRateLimited(studentId) {
  const now = Date.now(), window = 60_000, max = 30
  const prev = (_flushMap.get(studentId) || []).filter(t => now - t < window)
  if (prev.length >= max) return false
  _flushMap.set(studentId, [...prev, now])
  if (_flushMap.size > 5000) {
    for (const [k, v] of _flushMap) {
      if (v.every(t => now - t >= window)) _flushMap.delete(k)
    }
  }
  return true
}

/** Batch-insert sự kiện telemetry. Không bao giờ ném lỗi ra ngoài luồng nộp bài. */
function insertEvents(db, cleanEvents, { studentId, assignmentId, sessionId, submissionId }) {
  if (!cleanEvents.length) return 0
  const ins = db.prepare(`
    INSERT INTO submission_events (student_id, assignment_id, session_id, submission_id, event_type, payload_json, client_ts)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const tx = db.transaction(events => {
    let n = 0
    for (const e of events) {
      const payload = { ...e }
      delete payload.type
      delete payload.ts
      try { ins.run(studentId, assignmentId, sessionId, submissionId, e.type, JSON.stringify(payload), e.ts); n++ } catch { }
    }
    return n
  })
  return tx(cleanEvents)
}

// POST /api/submissions/events/flush — flush định kỳ sự kiện quá trình (trước khi nộp)
// Sự kiện lưu với submission_id = NULL, sẽ được gắn vào submission khi sinh viên nộp.
router.post('/events/flush', authenticate, requireRole('student'), (req, res) => {
  const { assignment_id, session_id, events } = req.body || {}
  const db = getDb()
  const asgn = db.prepare('SELECT classroom_id FROM assignments WHERE id=?').get(assignment_id)
  if (!asgn) return res.status(404).json({ error: 'Không tìm thấy bài tập', status: 404 })

  const enrolled = db.prepare('SELECT 1 FROM enrollments WHERE student_id=? AND classroom_id=?')
    .get(req.user.id, asgn.classroom_id)
  if (!enrolled) return res.status(403).json({ error: 'Bạn chưa được ghi danh vào lớp này', code: 'NOT_ENROLLED' })

  if (!flushRateLimited(req.user.id))
    return res.status(429).json({ error: 'Flush quá tần suất. Vui lòng chờ.', code: 'RATE_LIMITED' })
  if (typeof session_id !== 'string' || session_id.length < 8 || session_id.length > 64)
    return res.status(400).json({ error: 'session_id không hợp lệ', code: 'INVALID_SESSION' })

  // Chỉ nhận tối đa MAX_EVENTS/batch — phần dư client sẽ gửi ở lần nộp cuối
  const cleanEvents = sanitizeEvents(events).slice(-MAX_EVENTS)
  insertEvents(db, cleanEvents, { studentId: req.user.id, assignmentId: assignment_id, sessionId: session_id, submissionId: null })

  res.status(201).json({ success: true, stored: cleanEvents.length })
})

// ── Phase 3: Exam Mode — start exam + session ──
router.post('/exam/start', authenticate, requireRole('student'), (req, res) => {
  const { assignment_id } = req.body || {}
  if (!assignment_id) return res.status(400).json({ error: 'Thiếu assignment_id', code: 'MISSING_ASSIGNMENT' })
  const db = getDb()
  const asgn = db.prepare('SELECT * FROM assignments WHERE id=?').get(assignment_id)
  if (!asgn) return res.status(404).json({ error: 'Không tìm thấy bài tập', code: 'NOT_FOUND' })
  if (!asgn.is_exam) return res.status(400).json({ error: 'Bài tập này không phải chế độ thi', code: 'NOT_EXAM' })
  if (asgn.status === 'closed') return res.status(400).json({ error: 'Bài thi đã đóng', code: 'EXAM_CLOSED' })
  const enrolled = db.prepare('SELECT 1 FROM enrollments WHERE student_id=? AND classroom_id=?').get(req.user.id, asgn.classroom_id)
  if (!enrolled) return res.status(403).json({ error: 'Bạn chưa được ghi danh', code: 'NOT_ENROLLED' })
  // Single attempt: đã có submission thì không cho start lại
  const existingSub = db.prepare('SELECT id FROM submissions WHERE assignment_id=? AND student_id=? LIMIT 1').get(assignment_id, req.user.id)
  if (existingSub) return res.status(409).json({ error: 'Bạn đã nộp bài thi này (chỉ 1 lần)', code: 'EXAM_ALREADY_SUBMITTED' })
  const existing = db.prepare('SELECT * FROM exam_sessions WHERE student_id=? AND assignment_id=?').get(req.user.id, assignment_id)
  if (existing) {
    // Nếu đã hết hạn mà chưa nộp → vẫn trả về để client auto-submit, nhưng báo expired
    const expired = Date.parse(existing.expires_at) < Date.now() && !existing.submitted_at
    return res.json({ ...existing, expired, duration_minutes: asgn.duration_minutes })
  }
  const duration = asgn.duration_minutes || 60
  const now = new Date()
  const expires = new Date(now.getTime() + duration * 60_000)
  const sessionId = crypto.randomUUID()
  try {
    db.prepare('INSERT INTO exam_sessions (student_id, assignment_id, session_id, started_at, expires_at) VALUES (?,?,?,?,?)')
      .run(req.user.id, assignment_id, sessionId, now.toISOString(), expires.toISOString())
  } catch (e) {
    const dup = db.prepare('SELECT * FROM exam_sessions WHERE student_id=? AND assignment_id=?').get(req.user.id, assignment_id)
    if (dup) return res.json({ ...dup, duration_minutes: duration })
    return res.status(500).json({ error: 'Không thể tạo phiên thi', code: 'EXAM_START_FAILED' })
  }
  const created = db.prepare('SELECT * FROM exam_sessions WHERE session_id=?').get(sessionId)
  res.status(201).json({ ...created, duration_minutes: duration })
})

router.get('/exam/:assignmentId/session', authenticate, requireRole('student'), (req, res) => {
  const db = getDb()
  const asgn = db.prepare('SELECT is_exam, duration_minutes, hide_scores_until, status FROM assignments WHERE id=?').get(req.params.assignmentId)
  if (!asgn) return res.status(404).json({ error: 'Không tìm thấy bài tập', code: 'NOT_FOUND' })
  const sess = db.prepare('SELECT * FROM exam_sessions WHERE student_id=? AND assignment_id=?').get(req.user.id, req.params.assignmentId)
  if (!sess) return res.json(null)
  const expired = Date.parse(sess.expires_at) < Date.now() && !sess.submitted_at
  res.json({ ...sess, duration_minutes: asgn.duration_minutes, expired, scores_hidden: isExamScoresHidden(asgn) })
})

// Phase 3: client báo cáo vi phạm giám sát (paste bị chặn / thoát fullscreen / mất focus) — chỉ đếm, không chặn nộp
router.post('/exam/:assignmentId/event', authenticate, requireRole('student'), (req, res) => {
  const { type } = req.body || {}
  if (!['focus_lost', 'paste_blocked', 'fullscreen_exit'].includes(type)) return res.status(400).json({ error: 'type không hợp lệ', code: 'INVALID_TYPE' })
  const db = getDb()
  const sess = db.prepare('SELECT id FROM exam_sessions WHERE student_id=? AND assignment_id=?').get(req.user.id, req.params.assignmentId)
  if (!sess) return res.status(404).json({ error: 'Chưa bắt đầu thi', code: 'NOT_STARTED' })
  const col = type === 'focus_lost' ? 'focus_lost_count' : type === 'paste_blocked' ? 'paste_blocked_count' : 'fullscreen_exits'
  db.prepare(`UPDATE exam_sessions SET ${col}=${col}+1 WHERE id=?`).run(sess.id)
  res.json({ success: true })
})

// Teacher xem danh sách phiên thi (giám sát)
router.get('/exam/:assignmentId/sessions', authenticate, requireRole('teacher'), (req, res) => {
  const db = getDb()
  const asgn = db.prepare('SELECT classroom_id FROM assignments WHERE id=?').get(req.params.assignmentId)
  if (!asgn) return res.status(404).json({ error: 'Không tìm thấy bài tập' })
  const owns = db.prepare('SELECT 1 FROM classrooms WHERE id=? AND lecturer_id=?').get(asgn.classroom_id, req.user.id)
  if (!owns) return res.status(403).json({ error: 'Không có quyền', code: 'FORBIDDEN' })
  const rows = db.prepare(`
    SELECT es.*, u.name student_name, u.mssv student_code,
      (SELECT id FROM submissions s WHERE s.student_id=es.student_id AND s.assignment_id=es.assignment_id LIMIT 1) as submission_id
    FROM exam_sessions es JOIN users u ON u.id=es.student_id
    WHERE es.assignment_id=? ORDER BY es.started_at DESC
  `).all(req.params.assignmentId)
  res.json(rows)
})

// GET /api/submissions/needs-review — hàng đợi duyệt chấm của giảng viên (mixed-initiative)
router.get('/needs-review', authenticate, requireRole('teacher'), (req, res) => {
  const db = getDb()
  const page = Math.max(1, Number.parseInt(req.query.page) || 1)
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit) || 20))
  const base = `FROM submissions s JOIN assignments a ON a.id=s.assignment_id JOIN classrooms c ON c.id=a.classroom_id JOIN users u ON u.id=s.student_id
    WHERE s.review_status='needs_review' AND c.lecturer_id=?`
  const params = [req.user.id]
  const total = db.prepare(`SELECT COUNT(*) c ${base}`).get(...params).c
  const rows = db.prepare(`
    SELECT s.id, s.score_total, s.score_t1, s.score_t2, s.score_t3, s.status, s.submitted_at, s.attempt_number,
      u.name student_name, u.mssv student_code, a.id assignment_id, a.title assignment_title
    ${base} ORDER BY s.submitted_at DESC LIMIT ? OFFSET ?
  `).all(...params, limit, (page - 1) * limit)
  res.json({ data: rows, total, page, limit })
})

// GET /api/submissions/agreement-stats — Cohen's κ giữa điểm LLM và điểm GV đã duyệt (RQ1)
router.get('/agreement-stats', authenticate, requireRole('teacher'), (req, res) => {
  const db = getDb()
  const rows = db.prepare(`
    SELECT s.rubric_breakdown_json FROM submissions s
    JOIN assignments a ON a.id=s.assignment_id JOIN classrooms c ON c.id=a.classroom_id
    WHERE c.lecturer_id=? AND s.review_status='reviewed' AND s.rubric_breakdown_json IS NOT NULL
    ORDER BY s.id DESC LIMIT 2000
  `).all(req.user.id)

  const perCriterion = {}
  const allPairs = []
  for (const r of rows) {
    let bd
    try { bd = JSON.parse(r.rubric_breakdown_json)?.breakdown } catch { continue }
    if (!Array.isArray(bd)) continue
    for (const b of bd) {
      if (b.source !== 'teacher' && b.source !== 'teacher_llm_accept') continue
      if (b.score_llm === null || b.score_llm === undefined) continue   // tiêu chí không có điểm LLM thì không ghép cặp
      ;(perCriterion[b.id] ||= []).push([b.score_llm, b.applied_score])
      allPairs.push([b.score_llm, b.applied_score])
    }
  }

  res.json({
    reviewed_submissions: rows.length,
    overall: cohensKappa05(allPairs),
    by_criterion: Object.fromEntries(Object.entries(perCriterion).map(([k, v]) => [k, cohensKappa05(v)])),
    note: 'κ ≥ 0.61 = Substantial (mục tiêu nghiên cứu RQ1); n nhỏ chưa có ý nghĩa thống kê.',
  })
})

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

  // Phase 3: Exam guards — single attempt + timer
  if (asgn.is_exam) {
    const examSess = db.prepare('SELECT * FROM exam_sessions WHERE student_id=? AND assignment_id=?').get(req.user.id, assignment_id)
    if (!examSess) return res.status(403).json({ error: 'Bạn phải bấm “Bắt đầu làm bài” trước khi nộp (exam not started)', code: 'EXAM_NOT_STARTED' })
    if (examSess.submitted_at) return res.status(409).json({ error: 'Bài thi chỉ được nộp 1 lần', code: 'EXAM_ALREADY_SUBMITTED' })
    const alreadySub = db.prepare('SELECT id FROM submissions WHERE assignment_id=? AND student_id=? LIMIT 1').get(assignment_id, req.user.id)
    if (alreadySub) {
      db.prepare("UPDATE exam_sessions SET submitted_at=datetime('now') WHERE id=?").run(examSess.id)
      return res.status(409).json({ error: 'Bạn đã nộp bài thi này', code: 'EXAM_ALREADY_SUBMITTED' })
    }
    const nowMs = Date.now()
    const expMs = Date.parse(examSess.expires_at)
    if (!Number.isNaN(expMs) && nowMs > expMs) {
      return res.status(403).json({ error: 'Đã hết thời gian làm bài', code: 'EXAM_EXPIRED', expires_at: examSess.expires_at })
    }
    // session_id gửi kèm phải khớp exam session (chống giả)
    const bodySid = req.body.session_id
    if (bodySid && bodySid !== examSess.session_id) {
      // cho phép legacy auto-generated nhưng cảnh báo — vẫn chấp nhận để không chặn oan khi client flush id khác
    }
  }

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

  // ── Phase 1: Process telemetry — gắn sự kiện + tính metrics (không bao giờ chặn nộp bài) ──
  try {
    const sessionId = typeof req.body.session_id === 'string' && req.body.session_id.length >= 8
      ? req.body.session_id.slice(0, 64) : `srv-${subId}-${Date.now()}`
    const cleanEvents = sanitizeEvents(req.body.process_events)

    // Gắn các event đã flush trước đó (submission_id NULL) vào submission này
    db.prepare(`
      UPDATE submission_events SET submission_id=?
      WHERE student_id=? AND assignment_id=? AND session_id=? AND submission_id IS NULL
    `).run(subId, req.user.id, assignment_id, sessionId)

    insertEvents(db, cleanEvents, { studentId: req.user.id, assignmentId: assignment_id, sessionId, submissionId: subId })

    // EQ-lite từ lịch sử nộp TRƯỚC attempt này (Jadud-style thrashing index)
    const priors = db.prepare(`
      SELECT score_total, status, submitted_at FROM submissions
      WHERE assignment_id=? AND student_id=? AND id != ?
      ORDER BY id ASC
    `).all(assignment_id, req.user.id, subId)

    // Metrics tính trên TOÀN BỘ sự kiện đã liên kết (flush định kỳ + batch cuối)
    const linkedRows = db.prepare('SELECT event_type, payload_json, client_ts FROM submission_events WHERE submission_id=?').all(subId)
    const allEvents = linkedRows.map(row => {
      let payload = {}
      try { payload = JSON.parse(row.payload_json || '{}') } catch { }
      return {
        type: row.event_type,
        ts: Number(row.client_ts ?? payload.ts ?? 0),
        ins: payload.ins, del: payload.del,
        chars: payload.chars, latency: payload.latency,
      }
    })

    const metrics = computeProcessMetrics(allEvents, code.length)
    const metricsJson = buildProcessMetricsJson(metrics, computeEqLite(priors))
    db.prepare('UPDATE submissions SET process_metrics_json=? WHERE id=?').run(metricsJson, subId)
  } catch (telErr) {
    console.error('⚠️ Telemetry processing skipped:', telErr.message)
  }

  // Phase 3: đánh dấu exam submitted
  if (asgn.is_exam) {
    try { db.prepare("UPDATE exam_sessions SET submitted_at=datetime('now') WHERE student_id=? AND assignment_id=? AND submitted_at IS NULL").run(req.user.id, assignment_id) } catch {}
  }

  // Durable lock-safe queue worker for submission grading
  const isServerless = Boolean(process.env.VERCEL)
  if (isServerless) {
    const completedSub = await processSubmissionGrading(subId)
    if (completedSub) {
      const ser = serializeSubmission(completedSub)
      if (isExamScoresHidden(asgn)) return res.status(201).json({ ...stripScoresForStudent(ser), id: ser.id, status: ser.status, message: 'Đã nộp bài thi — điểm sẽ được công bố sau' })
      return res.status(201).json(ser)
    }
    return res.status(201).json({ id: subId, status: 'failed', message: 'Lỗi phân tích bài nộp' })
  }

  if (asgn.is_exam && isExamScoresHidden(asgn)) {
    res.status(202).json({ id: subId, status: 'pending', scores_hidden: true, message: 'Đã nộp bài thi — điểm sẽ được công bố sau khi hết giờ/ GV công bố' })
  } else {
    res.status(202).json({ id: subId, status: 'pending', message: 'Bài nộp đang được phân tích...' })
  }
  processSubmissionGrading(subId).catch(err => console.error('Queue grading error:', err))
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
  // Phase 3: hide scores cho exam
  const asgnMap = {}
  if (req.user.role === 'student' && subs.length) {
    const aIds = [...new Set(subs.map(s => s.assignment_id))]
    const aRows = db.prepare(`SELECT id, is_exam, hide_scores_until, status FROM assignments WHERE id IN (${aIds.map(() => '?').join(',')})`).all(...aIds)
    aRows.forEach(a => { asgnMap[a.id] = a })
  }
  subs.forEach(s => {
    const ser = serializeSubmission(s)
    const a = asgnMap[s.assignment_id]
    result[s.assignment_id] = (a && isExamScoresHidden(a)) ? { ...stripScoresForStudent(ser), id: ser.id, assignment_id: ser.assignment_id } : ser
  })
  res.json(result)
})

// GET /api/submissions/me/:assignmentId — (#2) chuẩn hóa /me/ thay vì /my/
// Tie-breaker id DESC: hai bài nộp cùng giây phải trả bài mới nhất trước
router.get('/me/:assignmentId', authenticate, (req, res) => {
  const db = getDb()
  const asgn = db.prepare('SELECT is_exam, hide_scores_until, status FROM assignments WHERE id=?').get(req.params.assignmentId)
  const subs = db.prepare(`SELECT * FROM submissions WHERE assignment_id=? AND student_id=? ORDER BY submitted_at DESC, id DESC`).all(req.params.assignmentId, req.user.id)
  if (asgn && isExamScoresHidden(asgn)) {
    return res.json(subs.map(s => {
      const ser = serializeSubmission(s)
      return { ...stripScoresForStudent(ser), id: ser.id, assignment_id: ser.assignment_id }
    }))
  }
  res.json(subs.map(serializeSubmission))
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
  // Phase 3: cần a.is_exam... để hide
  const rows = db.prepare(`SELECT s.*,a.title assignment_title, a.is_exam, a.hide_scores_until, a.status assignment_status ${base} ORDER BY ${sort} ${order},s.id ${order} LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit)
  const data = rows.map(r => {
    const { assignment_status, is_exam, hide_scores_until, ...rest } = r
    const ser = serializeSubmission(rest)
    if (req.user.role === 'student' && isExamScoresHidden({ is_exam, hide_scores_until, status: assignment_status })) {
      return { ...stripScoresForStudent(ser), id: ser.id, status: ser.status }
    }
    return ser
  })
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
      const { concepts_json, ...clean } = sub
      grouped[sub.assignment_id] = {
        ...serializeSubmission(clean),
        concepts: JSON.parse(concepts_json || '[]'),
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
  res.json(serializeSubmission(updated))
})

// PATCH /api/submissions/:id/review — GV duyệt rubric LLM (mixed-initiative)
// body: { scores: {criterionId: 0..5}, accept_llm?: boolean }
router.patch('/:id/review', authenticate, requireRole('teacher'), (req, res) => {
  const db = getDb()
  const sub = db.prepare(`
    SELECT s.*, a.classroom_id, a.weight_t2, a.weight_t3
    FROM submissions s JOIN assignments a ON s.assignment_id=a.id
    WHERE s.id=?
  `).get(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Không tìm thấy submission', status: 404 })

  const owns = db.prepare('SELECT 1 FROM classrooms WHERE id=? AND lecturer_id=?')
    .get(sub.classroom_id, req.user.id)
  if (!owns) return res.status(403).json({ error: 'Bạn không có quyền duyệt submission này', code: 'FORBIDDEN_REVIEW' })

  let breakdown
  try { breakdown = JSON.parse(sub.rubric_breakdown_json || 'null')?.breakdown } catch { }
  if (!Array.isArray(breakdown)) {
    return res.status(400).json({ error: 'Bài nộp chưa có rubric breakdown để duyệt. Dùng /override để sửa điểm thủ công.', code: 'NO_RUBRIC_BREAKDOWN' })
  }

  const validIds = new Set(QUALITATIVE_CRITERIA.map(c => c.id).concat(['debugging_process']))
  const rawScores = req.body?.scores
  const scores = {}
  if (rawScores !== undefined && (rawScores === null || typeof rawScores !== 'object' || Array.isArray(rawScores))) {
    return res.status(400).json({ error: 'scores phải là object {criterionId: 0..5}', code: 'INVALID_SCORES' })
  }
  for (const [k, v] of Object.entries(rawScores || {})) {
    if (!validIds.has(k)) return res.status(400).json({ error: `Tiêu chí không hợp lệ: ${k}`, code: 'INVALID_CRITERION' })
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0 || n > 5) return res.status(400).json({ error: `Điểm của ${k} phải trong khoảng 0–5`, code: 'INVALID_SCORE' })
    scores[k] = n
  }
  const acceptLlm = Boolean(req.body?.accept_llm)
  if (!acceptLlm && Object.keys(scores).length === 0) {
    return res.status(400).json({ error: 'Cần scores hoặc accept_llm=true', code: 'EMPTY_REVIEW' })
  }

  const reviewed = applyTeacherReview(breakdown, scores, acceptLlm)
  const newT2 = scaleTier(reviewed.earned_t2_05, T2_CRITERIA_MAX, sub.weight_t2 || 35)
  const newT3 = scaleTier(reviewed.earned_t3_05, T3_CRITERIA_MAX, sub.weight_t3 || 25)
  // T1 không đổi — giữ nguyên giá trị hiện tại trên row
  const { total, status } = recomputeTotals(sub.score_t1, newT2, newT3)

  db.prepare(`
    UPDATE submissions SET score_total=?, score_t2=?, score_t3=?, status=?,
      rubric_breakdown_json=?, review_status='reviewed'
    WHERE id=?
  `).run(total, newT2, newT3, status,
    JSON.stringify({ ...reviewed, scaled: { t2: newT2, t3: newT3 } }),
    req.params.id)

  const updated = db.prepare('SELECT * FROM submissions WHERE id=?').get(req.params.id)
  res.json(serializeSubmission(updated))
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

    // ── Phase 2: LLM-as-a-Judge (rubric định tính) + mixed-initiative ──
    // Chỉ judge khi code vượt qua garbage-check (có quality_signals) — T1 vẫn thuộc engine.
    if (analysis.quality_signals && process.env.LLM_JUDGE_ENABLED !== 'false') {
      try {
        let pmJson = null
        try { pmJson = sub.process_metrics_json ? JSON.parse(sub.process_metrics_json) : null } catch { }
        const judged = await judgeSubmission({
          code: sub.code,
          assignmentTitle: sub.title,
          assignmentDesc: sub.description,
          lang: sub.lang,
          concepts: JSON.parse(sub.concepts_json || '[]'),
          qualitySignals: analysis.quality_signals,
        })
        const llmScores = judged
          ? { provider: judged.provider, model: judged.model, criteria: judged.criteria, judged_at: new Date().toISOString() }
          : null
        const rubric = buildRubricBreakdown({
          llmCriteria: judged?.criteria || [],
          qualitySignals: analysis.quality_signals,
          processMetrics: pmJson,
        })
        const newT2 = scaleTier(rubric.earned_t2_05, T2_CRITERIA_MAX, sub.weight_t2 || 35)
        const newT3 = scaleTier(rubric.earned_t3_05, T3_CRITERIA_MAX, sub.weight_t3 || 25)
        const { total, status } = recomputeTotals(analysis.score_t1, newT2, newT3)

        db.prepare(`
          UPDATE submissions SET score_total=?, score_t2=?, score_t3=?, status=?,
            llm_scores_json=?, rubric_breakdown_json=?, review_status=?
          WHERE id=?
        `).run(
          total, newT2, newT3, status,
          llmScores ? JSON.stringify(llmScores) : null,
          JSON.stringify({ ...rubric, scaled: { t2: newT2, t3: newT3 } }),
          llmScores ? rubric.review_status : 'engine_only',
          subId
        )
      } catch (judgeErr) {
        console.error(`⚠️ LLM judge skipped for #${subId}:`, judgeErr.message)
      }
    }

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


// GET /api/submissions/:id/process-events — dữ liệu quá trình làm bài (owner hoặc GV lớp)
router.get('/:id/process-events', authenticate, (req, res) => {
  const db = getDb()
  const sub = db.prepare(`
    SELECT s.id, s.student_id, s.process_metrics_json, a.classroom_id
    FROM submissions s JOIN assignments a ON s.assignment_id=a.id
    WHERE s.id=?
  `).get(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Không tìm thấy submission', status: 404 })

  if (req.user.role === 'student') {
    if (sub.student_id !== req.user.id)
      return res.status(403).json({ error: 'Không có quyền xem dữ liệu này', code: 'FORBIDDEN' })
  } else {
    const owns = db.prepare('SELECT 1 FROM classrooms WHERE id=? AND lecturer_id=?').get(sub.classroom_id, req.user.id)
    if (!owns) return res.status(403).json({ error: 'Không có quyền xem dữ liệu này', code: 'FORBIDDEN_CLASSROOM' })
  }

  const events = db.prepare(`
    SELECT event_type, payload_json, client_ts FROM submission_events
    WHERE submission_id=? ORDER BY id ASC LIMIT ?
  `).all(req.params.id, MAX_EVENTS)

  let metrics = null
  try { metrics = sub.process_metrics_json ? JSON.parse(sub.process_metrics_json) : null } catch { }

  res.json({
    submission_id: sub.id,
    metrics,
    events: events.map(e => {
      let payload = {}
      try { payload = JSON.parse(e.payload_json || '{}') } catch { }
      return { type: e.event_type, ts: e.client_ts, ...payload }
    }),
  })
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

  const { misconceptions_json, process_metrics_json, llm_scores_json, rubric_breakdown_json, ...clean } = sub
  const parse = s => { try { return s ? JSON.parse(s) : null } catch { return null } }
  const rbRaw = parse(rubric_breakdown_json)
  const ser = {
    ...clean,
    misconceptions: JSON.parse(misconceptions_json || '[]'),
    process_metrics: parse(process_metrics_json),
    llm_scores: parse(llm_scores_json),
    rubric_breakdown: Array.isArray(rbRaw) ? rbRaw : Array.isArray(rbRaw?.breakdown) ? rbRaw.breakdown : null,
  }
  if (req.user.role === 'student') {
    const asgn = db.prepare('SELECT is_exam, hide_scores_until, status FROM assignments WHERE id=?').get(sub.assignment_id)
    if (isExamScoresHidden(asgn)) return res.json({ ...stripScoresForStudent(ser), id: ser.id, status: ser.status, submitted_at: ser.submitted_at, assignment_id: ser.assignment_id })
  }
  res.json(ser)
})

export default router
