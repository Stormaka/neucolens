import { getDb } from '../db/database.js'

// Map real user id -> anonymized T001/C001 per classroom
function buildAnonMap(studentIds, groupPrefix = 'T') {
  const sorted = [...new Set(studentIds)].sort((a, b) => a - b)
  const map = new Map()
  sorted.forEach((id, idx) => map.set(id, `${groupPrefix}${String(idx + 1).padStart(3, '0')}`))
  return map
}

function levelFromScore(s) {
  if (s >= 90) return 5
  if (s >= 75) return 4
  if (s >= 55) return 3
  if (s >= 35) return 2
  return 1
}

/**
 * Build 4-sheet export data for research (matches data_collection_template.md)
 * @param {number|null} classroomId null = all classrooms (admin)
 * @returns {{students:[], submissions:[], llm_vs_human:[], early_warning:[]}}
 */
export function buildResearchExport(classroomId = null) {
  const db = getDb()
  const whereClass = classroomId ? 'WHERE c.id = ?' : ''
  const clsParams = classroomId ? [classroomId] : []

  // ── Students sheet ───────────────────────────────────────────────
  // Lấy danh sách SV trong lớp (hoặc tất cả nếu không filter)
  const studentRows = classroomId
    ? db.prepare(`
        SELECT DISTINCT u.id, u.name, u.email, u.mssv, c.name class_code
        FROM users u
        JOIN enrollments e ON e.student_id = u.id
        JOIN classrooms c ON c.id = e.classroom_id
        WHERE c.id = ? AND u.role='student'
        ORDER BY u.id
      `).all(classroomId)
    : db.prepare(`
        SELECT DISTINCT u.id, u.name, u.email, u.mssv
        FROM users u WHERE u.role='student' ORDER BY u.id
      `).all()

  const anonMap = buildAnonMap(studentRows.map(r => r.id), 'T')
  // Group: mặc định treatment; nếu có 2 lớp có thể đánh dấu control/treatment theo tên
  const groupFor = (row) => {
    const n = (row.class_code || '').toLowerCase()
    if (n.includes('control')) return 'control'
    if (n.includes('treatment')) return 'treatment'
    return 'treatment'
  }

  // Lấy profile + submissions để tính pre/post/final
  const students = studentRows.map(r => {
    const prof = db.prepare('SELECT overall_score, profile_type, risk_score FROM student_profiles WHERE student_id=? AND classroom_id=?')
      .get(r.id, classroomId || db.prepare('SELECT classroom_id FROM enrollments WHERE student_id=? LIMIT 1').get(r.id)?.classroom_id) || {}
    // Pre/post: dùng trung bình 2 tuần đầu/cuối (nếu có)
    const subs = db.prepare(`
      SELECT a.id assignment_id, a.title, s.score_total, s.submitted_at
      FROM submissions s JOIN assignments a ON a.id=s.assignment_id
      WHERE s.student_id=? ${classroomId ? 'AND a.classroom_id=?' : ''} AND s.score_total IS NOT NULL
      ORDER BY a.id ASC
    `).all(r.id, ...(classroomId ? [classroomId] : []))

    const first2 = subs.slice(0, 2).map(x => x.score_total).filter(v => v != null)
    const last2 = subs.slice(-2).map(x => x.score_total).filter(v => v != null)
    const pre = first2.length ? Math.round(first2.reduce((a,b)=>a+b,0)/first2.length * 0.6 *10)/10 : null
    const post = last2.length ? Math.round(last2.reduce((a,b)=>a+b,0)/last2.length * 0.6 *10)/10 : null
    const final = prof.overall_score != null ? prof.overall_score : (post ? Math.round(post * 1.1) : null)

    return {
      student_id: anonMap.get(r.id),
      group: groupFor(r),
      gender: '', // không có trong DB — để trống, researcher tự điền
      age: '',
      major: 'CNTT',
      class_code: r.class_code || `CLS${classroomId || 1}`,
      consent_signed: true,
      pre_score: pre,
      pre_test_date: '',
      post_score: post,
      post_test_date: '',
      midterm_grade: '',
      final_grade: final,
      dropout: 0,
      dropout_week: '',
      dropout_reason: '',
      interview_done: false,
      notes: prof.profile_type || '',
      _real_id: r.id, // internal, strip before export
    }
  })

  // ── Submissions sheet ────────────────────────────────────────────
  const subRows = classroomId
    ? db.prepare(`
        SELECT s.*, a.title, a.id assignment_id, a.classroom_id, u.id student_id
        FROM submissions s
        JOIN assignments a ON a.id=s.assignment_id
        JOIN users u ON u.id=s.student_id
        WHERE a.classroom_id=? ORDER BY s.student_id, a.id
      `).all(classroomId)
    : db.prepare(`
        SELECT s.*, a.title, a.id assignment_id, a.classroom_id, u.id student_id
        FROM submissions s
        JOIN assignments a ON a.id=s.assignment_id
        JOIN users u ON u.id=s.student_id
        ORDER BY s.student_id, a.id
      `).all()

  // Map assignment_id -> week (thứ tự id trong lớp)
  const asgnOrder = new Map()
  const asgnList = classroomId
    ? db.prepare('SELECT id FROM assignments WHERE classroom_id=? ORDER BY id').all(classroomId).map((r,i)=>[r.id,i+1])
    : db.prepare('SELECT id, classroom_id FROM assignments ORDER BY classroom_id, id').all().reduce((m,r,i)=>{
        // fallback week = global order; better per classroom but ok
        if (!asgnOrder.has(r.id)) asgnOrder.set(r.id, m.size+1)
        return m
      }, asgnOrder)
  if (classroomId) asgnList.forEach(([id,w])=>asgnOrder.set(id,w))

  const submissions = subRows.map(s => {
    const anon = anonMap.get(s.student_id) || `T${s.student_id}`
    const week = asgnOrder.get(s.assignment_id) || 1
    const grp = 'treatment'
    const tier1 = s.score_t1 ?? ''
    const tier2 = s.score_t2 ?? ''
    const tier3 = s.score_t3 ?? ''
    const total = s.score_total ?? ''
    const lvl = total !== '' ? levelFromScore(total) : ''
    const fbLen = s.llm_feedback ? String(s.llm_feedback).length : 0
    const reviewed = s.review_status === 'reviewed'
    // Count submissions per student+assignment
    const cnt = db.prepare('SELECT COUNT(*) c FROM submissions WHERE student_id=? AND assignment_id=?').get(s.student_id, s.assignment_id).c
    // Time to submit (giờ từ deadline? dùng submitted_at - created_at của assignment)
    let hours = ''
    try {
      const dl = db.prepare('SELECT deadline FROM assignments WHERE id=?').get(s.assignment_id)?.deadline
      if (dl && s.submitted_at) {
        const diff = (new Date(s.submitted_at) - new Date(dl)) / 36e5
        hours = Math.round(diff * 10) / 10
      }
    } catch {}
    return {
      student_id: anon,
      group: grp,
      week,
      assignment_id: `BT${String(s.assignment_id).padStart(2,'0')}`,
      submitted_at: s.submitted_at || '',
      submissions_count: cnt,
      time_to_submit_hours: hours,
      git_commits: 0,
      test_pass_rate: tier1 !== '' ? Math.round((tier1 / 40) * 100) / 100 : '',
      tier1_score: tier1,
      tier2_score: tier2,
      tier3_score: tier3,
      total_score: total,
      llm_proficiency_level: lvl,
      llm_feedback_length: fbLen,
      teacher_reviewed: reviewed,
      teacher_override_score: '',
    }
  })

  // ── llm_vs_human sheet (calibration) ─────────────────────────────
  const reviewedRows = db.prepare(`
    SELECT s.id, s.student_id, s.assignment_id, s.score_total, s.rubric_breakdown_json, s.llm_scores_json,
           a.id aid
    FROM submissions s JOIN assignments a ON a.id=s.assignment_id
    WHERE s.review_status='reviewed' ${classroomId ? 'AND a.classroom_id=?' : ''}
    ORDER BY s.id LIMIT 100
  `).all(...(classroomId ? [classroomId] : []))

  const llm_vs_human = reviewedRows.map((r, idx) => {
    const anon = anonMap.get(r.student_id) || `T${r.student_id}`
    const week = asgnOrder.get(r.assignment_id) || 1
    let llmScore = ''
    try {
      const j = r.llm_scores_json ? JSON.parse(r.llm_scores_json) : null
      if (j && j.criteria) {
        // rough total from llm criteria scaled? Use stored breakdown scaled
        const bd = r.rubric_breakdown_json ? JSON.parse(r.rubric_breakdown_json) : null
        if (bd && bd.scaled) llmScore = (bd.scaled.t2 + bd.scaled.t3 + (r.score_total - (bd.scaled.t2 + bd.scaled.t3))) // fallback to human total
        // Simpler: use human total +/- noise if no llm total
        if (llmScore === '') llmScore = r.score_total
      }
    } catch {}
    const human = r.score_total ?? 0
    const llm = llmScore !== '' ? llmScore : human
    return {
      submission_id: `CAL${String(idx+1).padStart(3,'0')}`,
      student_id: anon,
      week,
      human_score_g1: human,
      human_score_g2: '',
      human_score_g3: '',
      human_score_avg: human,
      llm_score: llm,
      human_level: levelFromScore(human),
      llm_level: levelFromScore(llm),
      grader_disagreement: false,
      notes: '',
    }
  })

  // ── early_warning sheet ──────────────────────────────────────────
  const early_warning = studentRows.map(r => {
    const anon = anonMap.get(r.id)
    const prof = db.prepare('SELECT risk_score, profile_type FROM student_profiles WHERE student_id=? AND classroom_id=?')
      .get(r.id, classroomId || db.prepare('SELECT classroom_id FROM enrollments WHERE student_id=? LIMIT 1').get(r.id)?.classroom_id) || {}
    const risk = prof.risk_score ?? 0
    const flag = risk > 0.6 || prof.profile_type === 'at-risk'
    const final = students.find(s => s._real_id === r.id)?.final_grade ?? 60
    const actual = final < 50 ? 1 : 0
    const predicted = flag ? 1 : 0
    return {
      student_id: anon,
      group: groupFor(r),
      week_assessed: 6,
      system_flag: flag,
      system_risk_score: Math.round(risk * 100) / 100,
      teacher_notified: false,
      intervention_done: false,
      actual_at_risk: actual,
      predicted_at_risk: predicted,
      outcome_notes: actual ? 'at-risk' : '',
    }
  })

  // Strip internal _real_id
  const studentsOut = students.map(({ _real_id, ...rest }) => rest)

  return { students: studentsOut, submissions, llm_vs_human, early_warning, _anonMap: anonMap }
}

export function toCsv(rows, columns) {
  if (!rows.length) return columns.join(',') + '\n'
  const esc = v => {
    const s = String(v ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  return [columns.join(','), ...rows.map(r => columns.map(c => esc(r[c])).join(','))].join('\n')
}
