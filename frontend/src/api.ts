// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck  -- API layer uses dynamic types from backend; strict typing applied at component level
import axios from 'axios'

const camelKey = (key: string) => key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
const toCamelCase = (value: any): any => {
  if (Array.isArray(value)) return value.map(toCamelCase)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [camelKey(key), toCamelCase(child)]))
}

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
      ? '/api'
      : 'http://localhost:3001/api')
})

// Small in-memory cache for read-heavy dashboard data. Private data never goes
// to browser disk and is discarded on reload/logout.
const readCache = new Map<string, { expires: number; value: Promise<any> }>()
const cachedGet = (url: string, ttlMs = 30_000) => {
  const hit = readCache.get(url)
  if (hit && hit.expires > Date.now()) return hit.value
  const value = (API.get(url) as Promise<any>).catch(error => { readCache.delete(url); throw error })
  readCache.set(url, { expires: Date.now() + ttlMs, value })
  return value
}
const clearReadCache = () => readCache.clear()

API.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Unwrap .data so callers receive plain objects/arrays directly
let refreshPromise: Promise<string> | null = null
API.interceptors.response.use(r => toCamelCase(r.data), async err => {
  const original = err.config
  const refreshToken = localStorage.getItem('refresh_token')
  if (err.response?.status === 401 && refreshToken && !original?._retry && !String(original?.url).includes('/auth/')) {
    original._retry = true
    refreshPromise ||= axios.post(`${API.defaults.baseURL}/auth/refresh`, { refresh_token: refreshToken })
      .then(r => {
        localStorage.setItem('access_token', r.data.access_token)
        localStorage.setItem('refresh_token', r.data.refresh_token)
        return r.data.access_token
      }).finally(() => { refreshPromise = null })
    try {
      const accessToken = await refreshPromise
      original.headers.Authorization = `Bearer ${accessToken}`
      return API(original)
    } catch {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    }
  }
  const payload = err.response?.data
  const message = payload?.error?.message || payload?.error || 'Lỗi kết nối server'
  return Promise.reject({
    status: err.response?.status,
    code: payload?.error?.code || payload?.code || 'REQUEST_FAILED',
    message,
    error: message
  })
})

export const auth = {
  login: (email: string, password: string) => API.post('/auth/login', { email, password }) as Promise<any>,
  register: (data: any) => API.post('/auth/register', data) as Promise<any>,
  me: () => API.get('/auth/me') as Promise<any>,
  refresh: (refresh_token: string) => API.post('/auth/refresh', { refresh_token }) as Promise<any>,
  logout: (refresh_token?: string | null) => { clearReadCache(); return API.post('/auth/logout', { refresh_token }) as Promise<any> },
}

export const classrooms = {
  list: () => cachedGet('/classrooms') as Promise<any[]>,
  get: (id: number) => cachedGet(`/classrooms/${id}`) as Promise<any>,
  create: (data: any) => { clearReadCache(); return API.post('/classrooms', data) as Promise<any> },
  /** #6: Paginated. Returns flat array for backward compat (unwraps .data) */
  students: (id: number, opts?: { page?: number; limit?: number }) => {
    const params = opts ? `?page=${opts.page || 1}&limit=${opts.limit || 50}` : ''
    return cachedGet(`/classrooms/${id}/students${params}`).then(r => r.data ?? r)
  },
  stats: (id: number) => cachedGet(`/classrooms/${id}/stats`) as Promise<any>,
  enroll: (id: number, studentEmail: string) => API.post(`/classrooms/${id}/enroll`, { studentEmail }) as Promise<any>,
}

export const assignments = {
  /** #7: Paginated. Returns flat array for backward compat (unwraps .data) */
  byClassroom: (classId: number, opts?: { page?: number; limit?: number }) => {
    const params = opts ? `?page=${opts.page || 1}&limit=${opts.limit || 50}` : ''
    return cachedGet(`/assignments/classroom/${classId}${params}`).then(r => r.data ?? r)
  },
  get: (id: number) => cachedGet(`/assignments/${id}`) as Promise<any>,
  create: (data: any) => { clearReadCache(); return API.post('/assignments', data) as Promise<any> },
  update: (id: number, data: any) => { clearReadCache(); return API.patch(`/assignments/${id}`, data) as Promise<any> },
  setStatus: (id: number, status: string) => { clearReadCache(); return API.patch(`/assignments/${id}/status`, { status }) as Promise<any> },
  submissions: (id: number) => API.get(`/assignments/${id}/submissions`) as Promise<any[]>,
}

export const submissions = {
  submit: (assignment_id: number, code: string, process?: { session_id?: string; process_events?: any[] }) =>
    { clearReadCache(); return API.post('/submissions', { assignment_id, code, ...process }) as Promise<any> },
  list: (query: Record<string, string | number> = {}) => API.get(`/submissions?${new URLSearchParams(Object.entries(query).map(([k,v]) => [k, String(v)])).toString()}`) as Promise<any>,
  poll: (id: number) => API.get(`/submissions/${id}`) as Promise<any>,
  me: (assignmentId: number) => API.get(`/submissions/me/${assignmentId}`) as Promise<any[]>,
  /** #5/#15: Fetch latest submission for multiple assignments in one request.
   *  Returns { [assignmentId]: submission } */
  batchMy: (assignmentIds: number[]) => API.get(`/submissions/me/batch?assignmentIds=${assignmentIds.join(',')}`) as Promise<Record<number, any>>,
  byStudent: (studentId: number, classId: number) => API.get(`/submissions/student/${studentId}/classroom/${classId}`) as Promise<any[]>,
  /** Phase 1: dữ liệu quá trình làm bài của một submission */
  processEvents: (submissionId: number) => API.get(`/submissions/${submissionId}/process-events`) as Promise<any>,
  /** Phase 2: hàng đợi duyệt chấm mixed-initiative */
  needsReview: (opts?: { page?: number; limit?: number }) =>
    API.get(`/submissions/needs-review?page=${opts?.page || 1}&limit=${opts?.limit || 20}`) as Promise<any>,
  /** GV duyệt rubric: scores {criterionId:0..5} hoặc accept_llm=true */
  review: (submissionId: number, payload: { scores?: Record<string, number>; accept_llm?: boolean }) =>
    API.patch(`/submissions/${submissionId}/review`, payload) as Promise<any>,
  /** Cohen's κ giữa LLM và GV (RQ1) */
  agreementStats: () => API.get('/submissions/agreement-stats') as Promise<any>,
  /** Phase 3: Exam Mode — phiên thi có giám sát */
  startExam: (assignmentId: number) => { clearReadCache(); return API.post('/submissions/exam/start', { assignment_id: assignmentId }) as Promise<any> },
  examSession: (assignmentId: number) => API.get(`/submissions/exam/${assignmentId}/session`) as Promise<any>,
  examEvent: (assignmentId: number, type: 'focus_lost' | 'paste_blocked' | 'fullscreen_exit') => API.post(`/submissions/exam/${assignmentId}/event`, { type }) as Promise<any>,
  examSessions: (assignmentId: number) => API.get(`/submissions/exam/${assignmentId}/sessions`) as Promise<any[]>,
}

export const chats = {
  getOrCreate: (assignmentId: number) => API.get(`/chats/${assignmentId}`) as Promise<any>,
  getMessages: (assignmentId: number) => API.get(`/chats/${assignmentId}/messages`) as Promise<any[]>,
  sendMessage: (assignmentId: number, content: string, sender: 'student' | 'ai') =>
    API.post(`/chats/${assignmentId}/messages`, { content, sender }) as Promise<any>,
  ask: (assignmentId: number, content: string) =>
    API.post(`/chats/${assignmentId}/ask`, { content }) as Promise<{ response: string; provider: string; model: string | null }>,
  teacherViewChatLog: (studentId: number, assignmentId: number) =>
    API.get(`/chats/teacher/student/${studentId}/assignment/${assignmentId}`) as Promise<any>,
}

export const misconceptions = {
  byClassroom: (classId: number) => API.get(`/misconceptions/classroom/${classId}`) as Promise<any>,
  byStudent: (studentId: number, classId?: number) =>
    API.get(`/misconceptions/student/${studentId}${classId ? `?classId=${classId}` : ''}`) as Promise<any[]>,
}

export const profiles = {
  me: (classroomId?: number | null) => API.get(`/profile/me${classroomId ? `?classroomId=${classroomId}` : ''}`) as Promise<any>,
  student: (studentId: number, classId: number) => API.get(`/profile/${studentId}/classroom/${classId}`) as Promise<any>,
  ews: (classId: number) => API.get(`/profile/classroom/${classId}/ews`) as Promise<any>,
}

export const system = {
  check: () => API.get('/system/check') as Promise<any>,
  health: () => API.get('/health') as Promise<any>,
}

export const admin = {
  users: {
    list: (opts?: { role?: string; search?: string }) => {
      const params = new URLSearchParams()
      if (opts?.role) params.append('role', opts.role)
      if (opts?.search) params.append('search', opts.search)
      return API.get(`/admin/users?${params.toString()}`) as Promise<any[]>
    },
    create: (data: any) => API.post('/admin/users', data) as Promise<any>,
    delete: (id: number) => API.delete(`/admin/users/${id}`) as Promise<any>,
  },
  classrooms: {
    list: () => API.get('/admin/classrooms') as Promise<any[]>,
    create: (data: any) => API.post('/admin/classrooms', data) as Promise<any>,
    enroll: (id: number, studentEmail: string) => API.post(`/admin/classrooms/${id}/enroll`, { studentEmail }) as Promise<any>,
    removeStudent: (classId: number, studentId: number) => API.delete(`/admin/classrooms/${classId}/students/${studentId}`) as Promise<any>,
  },
  assignments: {
    extendDeadline: (id: number, deadline: string) => API.patch(`/admin/assignments/${id}/deadline`, { deadline }) as Promise<any>,
    setStatus: (id: number, status: string) => API.patch(`/admin/assignments/${id}/status`, { status }) as Promise<any>,
  }
}

export default API
