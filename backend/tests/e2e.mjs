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
    for (let i = 0; i < 20; i++) {
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
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 150))
      const res = await json(`/submissions/me/15`, { headers: authHeaders(studentToken) })
      if (res.body?.[0] && res.body[0].status !== 'pending') { goodBody = res.body[0]; break }
    }
  }
  assert((good.response.status === 201 || good.response.status === 202) && goodBody.score_total > badBody.score_total && goodBody.status !== 'pending', 'Chấm bài hợp lệ lỗi')

  const historyBefore = await json('/chats/15/messages', { headers: authHeaders(studentToken) })
  const chat = await json('/chats/15/ask', { method: 'POST', headers: authHeaders(studentToken), body: JSON.stringify({ content: 'Hãy nhận xét bài gần nhất của tôi' }) })
  assert(chat.response.status === 200 && chat.body.response && chat.body.provider, 'Chat backend lỗi')
  const history = await json('/chats/15/messages', { headers: authHeaders(studentToken) })
  assert(history.body.length === historyBefore.body.length + 2, `Chat không lưu đủ hai phía (${historyBefore.body.length} -> ${history.body.length}; ${JSON.stringify(chat.body)})`)

  const errorShape = await json('/not-a-real-route')
  assert(errorShape.body.success === false && errorShape.body.error?.code && errorShape.body.error?.message, 'Error format chưa chuẩn')
  console.log('E2E PASS: auth, password policy, refresh rotation, RBAC, pagination/filtering, anti-copy, scoring, chat, error format')
} finally {
  child.kill('SIGTERM')
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.rmSync(dbPath + suffix) } catch {}
  }
}
