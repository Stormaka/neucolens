import express from 'express'
import { getDb } from '../db/database.js'
import { authenticate } from './auth.js'

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

  res.json({
    ...profile,
    conceptMastery: parseMastery(profile),
    classroomConcepts: uniqueConcepts,
    strengths: JSON.parse(profile.strengths_json || '[]'),
    improvements: JSON.parse(profile.improvements_json || '[]'),
    misconceptions: JSON.parse(profile.misconceptions_json || '[]')
  })
})

// GET /api/profiles/:studentId/classroom/:classId — hồ sơ SV (teacher view)
router.get('/:studentId/classroom/:classId', authenticate, (req, res) => {
  const db = getDb()
  const profile = db.prepare('SELECT * FROM student_profiles WHERE student_id=? AND classroom_id=?').get(req.params.studentId, req.params.classId)
  if (!profile) return res.status(404).json({ error: 'Chưa có hồ sơ' })

  const user = db.prepare('SELECT id,name,email,mssv FROM users WHERE id=?').get(req.params.studentId)

  // All concepts across this classroom's assignments
  const concepts = db.prepare(`
    SELECT DISTINCT concepts_json FROM assignments WHERE classroom_id=? AND concepts_json IS NOT NULL
  `).all(req.params.classId).flatMap(r => { try { return JSON.parse(r.concepts_json) } catch { return [] } })
  const uniqueConcepts = [...new Set(concepts)]

  res.json({
    ...profile,
    ...user,
    conceptMastery: parseMastery(profile),
    classroomConcepts: uniqueConcepts,
    strengths: JSON.parse(profile.strengths_json || '[]'),
    improvements: JSON.parse(profile.improvements_json || '[]'),
    misconceptions: JSON.parse(profile.misconceptions_json || '[]')
  })
})

// GET /api/profiles/classroom/:classId/ews — Early Warning System data
router.get('/classroom/:classId/ews', authenticate, (req, res) => {
  const db = getDb()
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

  res.json({
    atRisk: atRisk.map(s => ({ ...s, misconceptions: JSON.parse(s.misconceptions_json || '[]') })),
    aiWarning
  })
})

export default router
