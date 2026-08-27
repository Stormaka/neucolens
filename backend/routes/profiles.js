import express from 'express'
import { getDb } from '../db/database.js'
import { authenticate, requireRole } from './auth.js'

const router = express.Router()

/** Helper: parse mastery — supports both new mastery_json and legacy columns */
function parseMastery(profile) {
  if (profile.mastery_json && profile.mastery_json !== '{}') {
    try { return JSON.parse(profile.mastery_json) } catch {}
  }
  // Fallback to legacy 5-column format
  const m = {}
  if (profile.mastery_variables !== undefined) m['Variables'] = profile.mastery_variables
  if (profile.mastery_conditionals !== undefined) m['Conditionals'] = profile.mastery_conditionals
  if (profile.mastery_loops !== undefined) m['Loops'] = profile.mastery_loops
  if (profile.mastery_arrays !== undefined) m['Arrays'] = profile.mastery_arrays
  if (profile.mastery_functions !== undefined) m['Functions'] = profile.mastery_functions
  return m
}

// GET /api/profiles/me?classroomId=X — hồ sơ của bản thân
router.get('/me', authenticate, (req, res) => {
  const { classroomId } = req.query
  const db = getDb()

  let profile
  if (classroomId) {
    profile = db.prepare('SELECT * FROM student_profiles WHERE student_id=? AND classroom_id=?').get(req.user.id, classroomId)
  } else {
    profile = db.prepare('SELECT * FROM student_profiles WHERE student_id=? ORDER BY updated_at DESC').get(req.user.id)
  }

  if (!profile) return res.json(null)

  // Get classroom concepts from assignments if available
  const classId = classroomId || profile.classroom_id
  const concepts = db.prepare(`
    SELECT DISTINCT concepts_json FROM assignments WHERE classroom_id=? AND concepts_json IS NOT NULL
  `).all(classId).flatMap(r => { try { return JSON.parse(r.concepts_json) } catch { return [] } })
  const uniqueConcepts = [...new Set(concepts)]

  // #9/#10: Omit raw *_json fields — expose only parsed values
  const { mastery_json, strengths_json, improvements_json, misconceptions_json, ...profileClean } = profile

  res.json({
    ...profileClean,
    conceptMastery: parseMastery(profile),
    classroomConcepts: uniqueConcepts,
    strengths: JSON.parse(profile.strengths_json || '[]'),
    improvements: JSON.parse(profile.improvements_json || '[]'),
    misconceptions: JSON.parse(profile.misconceptions_json || '[]')
  })
})

// GET /api/profiles/:studentId/classroom/:classId — hồ sơ SV (teacher view, hoặc SV xem chính mình)
router.get('/:studentId/classroom/:classId', authenticate, (req, res) => {
  const db = getDb()
  const sid = Number(req.params.studentId), cid = Number(req.params.classId)
  if (req.user.role === 'student' && req.user.id !== sid) return res.status(403).json({ error: 'Chỉ được xem hồ sơ của chính mình', code: 'FORBIDDEN_PROFILE' })
  if (req.user.role === 'teacher') {
    const owns = db.prepare('SELECT 1 FROM classrooms WHERE id=? AND lecturer_id=?').get(cid, req.user.id)
    if (!owns) return res.status(403).json({ error: 'Không có quyền với lớp này', code: 'FORBIDDEN_CLASSROOM' })
  }
  const profile = db.prepare('SELECT * FROM student_profiles WHERE student_id=? AND classroom_id=?').get(sid, cid)
  if (!profile) return res.status(404).json({ error: 'Chưa có hồ sơ' })

  const user = db.prepare('SELECT id,name,email,mssv FROM users WHERE id=?').get(req.params.studentId)

  // All concepts across this classroom's assignments
  const concepts = db.prepare(`
    SELECT DISTINCT concepts_json FROM assignments WHERE classroom_id=? AND concepts_json IS NOT NULL
  `).all(req.params.classId).flatMap(r => { try { return JSON.parse(r.concepts_json) } catch { return [] } })
  const uniqueConcepts = [...new Set(concepts)]

  // #9/#10: Omit raw *_json fields
  const { mastery_json, strengths_json, improvements_json, misconceptions_json, ...profileClean2 } = profile

  res.json({
    ...profileClean2,
    ...user,
    conceptMastery: parseMastery(profile),
    classroomConcepts: uniqueConcepts,
    strengths: JSON.parse(profile.strengths_json || '[]'),
    improvements: JSON.parse(profile.improvements_json || '[]'),
    misconceptions: JSON.parse(profile.misconceptions_json || '[]')
  })
})

// GET /api/profiles/classroom/:classId/ews — Early Warning System data (teacher only)
router.get('/classroom/:classId/ews', authenticate, requireRole('teacher'), (req, res) => {
  const db = getDb()
  const owns = db.prepare('SELECT 1 FROM classrooms WHERE id=? AND lecturer_id=?').get(req.params.classId, req.user.id)
  if (!owns) return res.status(403).json({ error: 'Không có quyền với lớp này', code: 'FORBIDDEN_CLASSROOM' })
  const atRisk = db.prepare(`
    SELECT u.id,u.name,u.mssv,sp.overall_score,sp.risk_score,sp.trend,sp.misconceptions_json
    FROM student_profiles sp JOIN users u ON sp.student_id=u.id
    WHERE sp.classroom_id=? AND sp.profile_type='at-risk'
    ORDER BY sp.risk_score DESC
  `).all(req.params.classId)

  const aiWarning = db.prepare(`
    SELECT u.id,u.name,u.mssv,sp.overall_score,
      (SELECT COUNT(*) FROM submissions s JOIN assignments a ON s.assignment_id=a.id
       WHERE s.student_id=u.id AND a.classroom_id=? AND s.ai_suspicion_flag=1) as ai_flag_count
    FROM student_profiles sp JOIN users u ON sp.student_id=u.id
    WHERE sp.classroom_id=? AND sp.profile_type='ai-warning'
  `).all(req.params.classId, req.params.classId)

  // ── Process analytics tổng hợp theo SV (từ các bài nộp gần nhất có telemetry) ──
  const procRows = db.prepare(`
    SELECT s.student_id, s.process_metrics_json, s.submitted_at
    FROM submissions s JOIN assignments a ON s.assignment_id=a.id
    WHERE a.classroom_id=? AND s.process_metrics_json IS NOT NULL
    ORDER BY s.id DESC LIMIT 500
  `).all(req.params.classId)

  const byStudent = new Map()
  for (const row of procRows) {
    if (!byStudent.has(row.student_id)) byStudent.set(row.student_id, [])
    try { byStudent.get(row.student_id).push(JSON.parse(row.process_metrics_json)) } catch { }
  }
  const summarize = list => {
    if (!list.length) return null
    const avg = k => list.reduce((s, m) => s + (Number(m?.[k]) || 0), 0) / list.length
    const eqAvg = avg('eq_lite')
    return {
      submissions_analyzed: list.length,
      avg_paste_ratio: +avg('paste_char_ratio').toFixed(3),
      burst_paste_total: list.reduce((s, m) => s + (m?.burst_paste_count || 0), 0),
      median_latency_ms: Math.round(avg('median_latency_ms') || 0),
      avg_eq_lite: +eqAvg.toFixed(1),
      max_process_risk: +Math.max(...list.map(m => Number(m?.process_risk) || 0)).toFixed(3),
    }
  }
  const procSummary = new Map()
  for (const [sid, list] of byStudent) procSummary.set(sid, summarize(list))

  // SV chưa thuộc at-risk nhưng hành vi gõ code đáng lo → kênh cảnh báo thứ ba
  const riskIds = new Set(atRisk.map(s => s.id))
  const processWarnings = []
  for (const [sid, sum] of procSummary) {
    if (riskIds.has(sid)) continue
    const concerning =
      (sum.avg_eq_lite >= 40) ||
      (sum.burst_paste_total >= 3 && sum.avg_paste_ratio >= 0.4) ||
      sum.max_process_risk >= 0.5
    if (!concerning) continue
    const u = db.prepare('SELECT id,name,mssv FROM users WHERE id=?').get(sid)
    if (u) processWarnings.push({ ...u, ...sum })
  }

  res.json({
    atRisk: atRisk.map(s => { const { misconceptions_json, ...clean } = s; return { ...clean, misconceptions: JSON.parse(misconceptions_json || '[]'), process_summary: procSummary.get(clean.id) || null } }),
    aiWarning,
    processWarnings,
  })
})

export default router
