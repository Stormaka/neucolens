import { spawn } from 'node:child_process'
import fs from 'node:fs'

const port = 3199
const base = `http://127.0.0.1:${port}/api`
const dbPath = `/tmp/neu-codelens-e2e-${process.pid}.db`
const child = spawn(process.execPath, ['server.js'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PORT: String(port), DATABASE_PATH: dbPath, JWT_SECRET: 'e2e-only-secret-with-at-least-32-characters', SEED_DEMO_DATA: 'true' },
  stdio: ['ignore', 'pipe', 'pipe']
})
// Forward backend logs để chẩn đoán lỗi khi test thất bại
child.stdout.on('data', d => process.stdout.write(`[backend] ${d}`))
child.stderr.on('data', d => process.stderr.write(`[backend] ${d}`))

const assert = (condition, message) => { if (!condition) throw new Error(message) }
const json = async (path, options = {}) => {
  const response = await fetch(base + path, options)
  const body = response.status === 204 ? null : await response.json()
  return { response, body }
}
const authHeaders = token => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' })

try {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(base + '/health')).ok) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
    if (i === 79) throw new Error('Backend không khởi động')
  }

  const teacherLogin = await json('/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'teacher@neu.edu.vn', password: 'teacher123' }) })
  assert(teacherLogin.response.status === 200, 'Teacher login thất bại')
  assert(teacherLogin.body.access_token && teacherLogin.body.refresh_token, 'Thiếu access/refresh token')
  assert(!teacherLogin.body.user && !teacherLogin.body.token, 'Login vẫn trả user/token cũ')

  const jwtPayload = JSON.parse(Buffer.from(teacherLogin.body.access_token.split('.')[1], 'base64url'))
  assert(jwtPayload.exp - jwtPayload.iat === 1800, 'Access token không phải 30 phút')
  assert(Object.keys(jwtPayload).every(k => ['id', 'role', 'type', 'iat', 'exp'].includes(k)), 'JWT chứa PII')

  const me = await json('/auth/me', { headers: authHeaders(teacherLogin.body.access_token) })
  assert(me.response.status === 200 && me.body.role === 'teacher', '/auth/me lỗi')
  assert(!('mssv' in me.body) && 'student_code' in me.body, 'API vẫn lộ field mssv')

  const weakRegistration = await json('/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'weak@example.com', password: '123456', name: 'Weak', role: 'student' }) })
  assert(weakRegistration.response.status === 400 && weakRegistration.body.error.code === 'WEAK_PASSWORD', 'Password policy chưa hoạt động')

  const rotated = await json('/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: teacherLogin.body.refresh_token }) })
  assert(rotated.response.status === 200 && rotated.body.refresh_token !== teacherLogin.body.refresh_token, 'Refresh rotation lỗi')
  const reused = await json('/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: teacherLogin.body.refresh_token }) })
  assert(reused.response.status === 401, 'Refresh token cũ vẫn dùng lại được')

  const oldRoute = await json('/submissions/my/1', { headers: authHeaders(rotated.body.access_token) })
  assert(oldRoute.response.status === 404, 'Route /submissions/my vẫn tồn tại')

  const assignments = await json('/assignments/classroom/1?page=1&limit=2', { headers: authHeaders(rotated.body.access_token) })
  assert(assignments.response.status === 200 && assignments.body.data.length === 2 && assignments.body.total >= 15, 'Pagination assignment lỗi')
  const students = await json('/classrooms/1/students?page=1&limit=2', { headers: authHeaders(rotated.body.access_token) })
  assert(students.response.status === 200 && students.body.data.length === 2, 'Pagination student lỗi')
  assert(!('mssv' in students.body.data[0]) && students.body.data[0].student_code, 'Student list chưa chuẩn hóa student_code')

  const filtered = await json('/submissions?status=passed&sort=score_total&order=desc&page=1&limit=3', { headers: authHeaders(rotated.body.access_token) })
  assert(filtered.response.status === 200 && filtered.body.data.length <= 3 && filtered.body.total > 0, 'Filter/sort/pagination submission lỗi')

  const open = await json('/assignments/15/status', { method: 'PATCH', headers: authHeaders(rotated.body.access_token), body: JSON.stringify({ status: 'open' }) })
  assert(open.response.ok, 'Không mở được bài test')

  const studentLogin = await json('/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'an@neu.edu.vn', password: 'student123' }) })
  const studentToken = studentLogin.body.access_token
  const sample = await json('/assignments/15', { headers: authHeaders(studentToken) })
  const copied = await json('/submissions', { method: 'POST', headers: authHeaders(studentToken), body: JSON.stringify({ assignment_id: 15, code: sample.body.sample_code }) })
  assert(copied.response.status === 422 && copied.body.error.code === 'SAMPLE_CODE_COPY', 'Chưa chặn copy sample code')
  const teacherSubmit = await json('/submissions', { method: 'POST', headers: authHeaders(rotated.body.access_token), body: JSON.stringify({ assignment_id: 15, code: 'int main(){return 0;}' }) })
  assert(teacherSubmit.response.status === 403, 'Teacher vẫn có thể nộp bài')
  const bad = await json('/submissions', { method: 'POST', headers: authHeaders(studentToken), body: JSON.stringify({ assignment_id: 15, code: 'abc xyz' }) })
  let badBody = bad.body
  if (bad.response.status === 202) {
    // g++ compile có thể mất vài giây trên máy lạnh — đợi tối đa ~12s
    for (let i = 0; i < 80 && (!badBody || badBody.status === 'pending'); i++) {
      await new Promise(r => setTimeout(r, 150))
      const res = await json(`/submissions/me/15`, { headers: authHeaders(studentToken) })
      if (res.body?.[0] && res.body[0].status !== 'pending') { badBody = res.body[0]; break }
    }
  }
  assert((bad.response.status === 201 || bad.response.status === 202) && badBody.score_total === 0 && badBody.status === 'failed', 'Code rác vẫn được điểm')

  const goodCode = '#include <iostream>\n#include <vector>\n#include <algorithm>\nusing namespace std;\nint main(){int n;cin>>n;vector<int>a(n);for(int &x:a)cin>>x;sort(a.begin(),a.end());for(int x:a)cout<<x<<" ";return 0;}'
  const good = await json('/submissions', { method: 'POST', headers: authHeaders(studentToken), body: JSON.stringify({ assignment_id: 15, code: goodCode }) })
  let goodBody = good.body
  if (good.response.status === 202) {
    for (let i = 0; i < 80 && (!goodBody || goodBody.status === 'pending'); i++) {
      await new Promise(r => setTimeout(r, 150))
      const res = await json(`/submissions/me/15`, { headers: authHeaders(studentToken) })
      if (res.body?.[0] && res.body[0].status !== 'pending') { goodBody = res.body[0]; break }
    }
  }
  assert((good.response.status === 201 || good.response.status === 202) && goodBody.score_total > badBody.score_total && goodBody.status !== 'pending',
    `Chấm bài hợp lệ lỗi — good=${JSON.stringify({ status: good.response.status, score: goodBody?.score_total, st: goodBody?.status, fb: String(goodBody?.llm_feedback || '').slice(0, 200) })} bad=${JSON.stringify({ score: badBody?.score_total, st: badBody?.status })}`)

  // ── Phase 1: Process telemetry ────────────────────────────────────────────
  // 1) Flush định kỳ trước khi nộp (submission_id NULL, gắn sau bằng session_id)
  const now = Date.now()
  const flush = await json('/submissions/events/flush', { method: 'POST', headers: authHeaders(studentToken), body: JSON.stringify({
    assignment_id: 15, session_id: 'e2e-session-0001',
    events: [
      { type: 'session.start', ts: now - 180_000 },
      { type: 'edit', ts: now - 150_000, ins: 400, del: 20 },
      { type: 'keystroke', ts: now - 140_000, latency: 120 },
      { type: 'paste', ts: now - 120_000, chars: 900 },
      { type: 'focus.lost', ts: now - 100_000 },
    ]
  }) })
  assert(flush.response.status === 201 && flush.body.stored === 5, `Flush telemetry lỗi (${flush.response.status})`)

  const badFlush = await json('/submissions/events/flush', { method: 'POST', headers: authHeaders(studentToken), body: JSON.stringify({ assignment_id: 15, session_id: 'x', events: [] }) })
  assert(badFlush.response.status === 400, 'session_id yếu vẫn được chấp nhận')
  const teacherFlush = await json('/submissions/events/flush', { method: 'POST', headers: authHeaders(rotated.body.access_token), body: JSON.stringify({ assignment_id: 15, session_id: 'teacher-session-01', events: [] }) })
  assert(teacherFlush.response.status === 403, 'Teacher không được flush telemetry SV')

  // 2) Nộp bài kèm session_id + batch sự kiện cuối
  const telCode = goodCode + '\n// attempt with telemetry'
  const telSub = await json('/submissions', { method: 'POST', headers: authHeaders(studentToken), body: JSON.stringify({
    assignment_id: 15, code: telCode, session_id: 'e2e-session-0001',
    process_events: [
      { type: 'session.start', ts: now - 60_000 },
      { type: 'edit', ts: now - 30_000, ins: 120, del: 5 },
      { type: 'submit.attempt', ts: now - 1000 },
    ]
  }) })
  assert(telSub.response.status === 202 || telSub.response.status === 201, 'Nộp kèm telemetry thất bại')
  let telId = null
  for (let i = 0; i < 80 && !telId; i++) {
    await new Promise(r => setTimeout(r, 150))
    const res = await json('/submissions/me/15', { headers: authHeaders(studentToken) })
    const latest = (res.body || []).reduce((a, b) => (!a || Number(b.id) > Number(a.id)) ? b : a, null)
    if (latest && latest.status !== 'pending') telId = latest.id
  }
  assert(telId, 'Không xác định được submission có telemetry')

  // 3) Owner đọc được events + metrics; metrics gộp cả batch flush (paste 900 ký tự)
  const pev = await json(`/submissions/${telId}/process-events`, { headers: authHeaders(studentToken) })
  assert(pev.response.status === 200 && Array.isArray(pev.body.events), 'process-events lỗi với owner')
  assert(pev.body.events.length >= 8, `Sự kiện bị mất: chỉ thấy ${pev.body.events?.length}`)
  assert(pev.body.metrics && typeof pev.body.metrics.eq_lite === 'number' && pev.body.metrics.paste_count >= 1, 'Metrics không gộp sự kiện flush')

  // 4) Teacher cùng lớp đọc được; SV khác bị chặn
  const pevTeacher = await json(`/submissions/${telId}/process-events`, { headers: authHeaders(rotated.body.access_token) })
  assert(pevTeacher.response.status === 200 && pevTeacher.body.events.length === pev.body.events.length, 'Teacher không đọc được process-events lớp mình')
  const otherLogin = await json('/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'binh@neu.edu.vn', password: 'student123' }) })
  const pevOther = await json(`/submissions/${telId}/process-events`, { headers: authHeaders(otherLogin.body.access_token) })
  assert(pevOther.response.status === 403, 'SV khác vẫn đọc được process-events của bạn nó')

  // 5) EWS bổ sung process signals
  const ews = await json('/profile/classroom/1/ews', { headers: authHeaders(rotated.body.access_token) })
  assert(ews.response.status === 200 && Array.isArray(ews.body.process_warnings), 'EWS thiếu processWarnings')

  // ── Phase 2: Rubric LLM-as-a-Judge & mixed-initiative ─────────────────────
  // Không có API key trong e2e → judge bỏ qua (review_status='engine_only') nhưng
  // breakdown vẫn được dựng từ engine-proxy → GV vẫn duyệt được.
  const pev2 = await json(`/submissions/${telId}/process-events`, { headers: authHeaders(studentToken) })
  void pev2
  const telRow = await json(`/submissions/${telId}`, { headers: authHeaders(studentToken) })
  assert(Array.isArray(telRow.body?.rubric_breakdown) && telRow.body.rubric_breakdown.length === 8,
    `Thiếu rubric_breakdown 8 tiêu chí — http=${telRow.response.status} keys=${JSON.stringify(Object.keys(telRow.body || {}))} rs=${telRow.body?.review_status} rb=${typeof telRow.body?.rubric_breakdown}`)

  const needsReview = await json('/submissions/needs-review', { headers: authHeaders(rotated.body.access_token) })
  assert(needsReview.response.status === 200 && Array.isArray(needsReview.body.data), 'needs-review lỗi')

  const badReview = await json(`/submissions/${telId}/review`, { method: 'PATCH', headers: authHeaders(rotated.body.access_token), body: JSON.stringify({}) })
  assert(badReview.response.status === 400 && badReview.body.error.code === 'EMPTY_REVIEW', 'Review rỗng vẫn được nhận')
  const badCriterion = await json(`/submissions/${telId}/review`, { method: 'PATCH', headers: authHeaders(rotated.body.access_token), body: JSON.stringify({ scores: { hacker: 5 } }) })
  assert(badCriterion.response.status === 400 && badCriterion.body.error.code === 'INVALID_CRITERION', 'Tiêu chí lạ vẫn được nhận')

  const review = await json(`/submissions/${telId}/review`, { method: 'PATCH', headers: authHeaders(rotated.body.access_token), body: JSON.stringify({ scores: { naming: 5, comments: 4 } }) })
  assert(review.response.status === 200 && review.body.review_status === 'reviewed', `Duyệt rubric lỗi: ${JSON.stringify(review.body).slice(0, 200)}`)
  const nb = (review.body.rubric_breakdown || []).find(x => x.id === 'naming')
  assert(nb && nb.applied_score === 5 && nb.source === 'teacher', 'Điểm GV không được áp vào breakdown')
  assert(review.body.score_total === review.body.score_t1 + review.body.score_t2 + review.body.score_t3, 'Total không khớp T1+T2+T3 sau review')

  const otherReview = await json(`/submissions/${telId}/review`, { method: 'PATCH', headers: authHeaders(otherLogin.body.access_token) })
  void otherLogin
  assert(otherReview.response.status !== 200, 'Sinh viên không được gọi /review')
  const stats = await json('/submissions/agreement-stats', { headers: authHeaders(rotated.body.access_token) })
  assert(stats.response.status === 200 && stats.body.overall && Array.isArray(stats.body.by_criterion ? Object.keys(stats.body.by_criterion) : []), 'agreement-stats lỗi shape')

  const historyBefore = await json('/chats/15/messages', { headers: authHeaders(studentToken) })
  const chat = await json('/chats/15/ask', { method: 'POST', headers: authHeaders(studentToken), body: JSON.stringify({ content: 'Hãy nhận xét bài gần nhất của tôi' }) })
  assert(chat.response.status === 200 && chat.body.response && chat.body.provider, 'Chat backend lỗi')
  const history = await json('/chats/15/messages', { headers: authHeaders(studentToken) })
  assert(history.body.length === historyBefore.body.length + 2, `Chat không lưu đủ hai phía (${historyBefore.body.length} -> ${history.body.length}; ${JSON.stringify(chat.body)})`)

  const errorShape = await json('/not-a-real-route')
  assert(errorShape.body.success === false && errorShape.body.error?.code && errorShape.body.error?.message, 'Error format chưa chuẩn')

  // ── Phase 3: Exam Mode có giám sát ───────────────────────────────────────
  // Dùng SV khác (binh) để tránh rate-limit 5/phút của SV an đã nộp nhiều lần trước đó
  const examStudentToken = otherLogin.body.access_token
  const examCreate = await json('/assignments', { method: 'POST', headers: authHeaders(rotated.body.access_token), body: JSON.stringify({
    classroom_id: 1, title: 'Thi E2E Exam', description: 'Đề thi E2E', lang: 'C++',
    deadline: new Date(Date.now() + 86400000).toISOString(), concepts: ['Loops'],
    sample_code: 'int main(){return 0;}', test_cases: [{ input: '1', expected: '1', hidden: false }],
    is_exam: true, duration_minutes: 10, allow_paste: false, require_fullscreen: true, shuffle_questions: true, hide_scores_until: new Date(Date.now() + 3600000).toISOString()
  }) })
  assert(examCreate.response.status === 201 && examCreate.body.is_exam === true, `Tạo exam lỗi ${JSON.stringify(examCreate.body).slice(0,200)}`)
  const examId = examCreate.body.id
  const noStart = await json('/submissions', { method: 'POST', headers: authHeaders(examStudentToken), body: JSON.stringify({ assignment_id: examId, code: 'int main(){int a=1;return a;}' }) })
  assert(noStart.response.status === 403 && (noStart.body.error?.code || noStart.body.code) === 'EXAM_NOT_STARTED', 'Chưa start vẫn nộp được')
  const start = await json('/submissions/exam/start', { method: 'POST', headers: authHeaders(examStudentToken), body: JSON.stringify({ assignment_id: examId }) })
  assert([200,201].includes(start.response.status) && (start.body.session_id || start.body.sessionId), 'Start exam lỗi')
  const sessId = start.body.session_id || start.body.sessionId
  const start2 = await json('/submissions/exam/start', { method: 'POST', headers: authHeaders(examStudentToken), body: JSON.stringify({ assignment_id: examId }) })
  assert(start2.response.status === 200 && (start2.body.session_id || start2.body.sessionId) === sessId, 'Start idempotent lỗi')
  const examCode = '#include <iostream>\nusing namespace std;\nint main(){int n;cin>>n;cout<<n;return 0;}'
  const subExam = await json('/submissions', { method: 'POST', headers: authHeaders(examStudentToken), body: JSON.stringify({ assignment_id: examId, code: examCode, session_id: sessId }) })
  assert([201,202].includes(subExam.response.status) && (subExam.body.scores_hidden === true || subExam.body.scoresHidden === true), `Nộp exam không hidden ${JSON.stringify(subExam.body).slice(0,200)}`)
  const subExamId = subExam.body.id
  let polledExam = null
  for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 300)); const p = await json(`/submissions/${subExamId}`, { headers: authHeaders(examStudentToken) }); polledExam = p.body; if (p.body.scores_hidden || p.body.scoresHidden) break }
  assert(polledExam && (polledExam.scores_hidden || polledExam.scoresHidden), 'Poll exam không hidden')
  const secondSub = await json('/submissions', { method: 'POST', headers: authHeaders(examStudentToken), body: JSON.stringify({ assignment_id: examId, code: examCode }) })
  assert(secondSub.response.status === 409 && (secondSub.body.error?.code || secondSub.body.code) === 'EXAM_ALREADY_SUBMITTED', 'Thi 1 lần vẫn nộp lại được')
  const batchExam = await json(`/submissions/me/batch?assignmentIds=${examId}`, { headers: authHeaders(examStudentToken) })
  assert(batchExam.body[examId]?.scores_hidden === true || batchExam.body[examId]?.scoresHidden === true, 'Batch exam không hidden')
  const teacherSess = await json(`/submissions/exam/${examId}/sessions`, { headers: authHeaders(rotated.body.access_token) })
  assert(teacherSess.response.status === 200 && teacherSess.body.length === 1, 'GV không xem được exam sessions')
  await json(`/assignments/${examId}`, { method: 'PATCH', headers: authHeaders(rotated.body.access_token), body: JSON.stringify({ hide_scores_until: null }) })
  await json(`/assignments/${examId}/status`, { method: 'PATCH', headers: authHeaders(rotated.body.access_token), body: JSON.stringify({ status: 'closed' }) })
  const polledAfter = await json(`/submissions/${subExamId}`, { headers: authHeaders(examStudentToken) })
  assert(polledAfter.body.scores_hidden !== true && polledAfter.body.scoresHidden !== true && polledAfter.body.score_total !== null, 'Reveal sau close không hiện điểm')
  const examEvent = await json(`/submissions/exam/${examId}/event`, { method: 'POST', headers: authHeaders(examStudentToken), body: JSON.stringify({ type: 'focus_lost' }) })
  assert(examEvent.response.status === 200 && examEvent.body.success === true, 'Exam event focus_lost lỗi')

  console.log('E2E PASS: auth, password policy, refresh rotation, RBAC, pagination/filtering, anti-copy, scoring, chat, error format, process-telemetry, exam-mode')
} finally {
  child.kill('SIGTERM')
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.rmSync(dbPath + suffix) } catch {}
  }
}
