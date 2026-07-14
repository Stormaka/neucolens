// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck  -- API layer uses dynamic types from backend; strict typing applied at component level
import axios from 'axios'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
})

API.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Unwrap .data so callers receive plain objects/arrays directly
API.interceptors.response.use(
  r => r.data,
  err => Promise.reject(err.response?.data || { error: 'Lỗi kết nối server' })
)

export const auth = {
  login: (email: string, password: string) => API.post('/auth/login', { email, password }) as Promise<any>,
  register: (data: any) => API.post('/auth/register', data) as Promise<any>,
  me: () => API.get('/auth/me') as Promise<any>,
}

export const classrooms = {
  list: () => API.get('/classrooms') as Promise<any[]>,
  get: (id: number) => API.get(`/classrooms/${id}`) as Promise<any>,
  create: (data: any) => API.post('/classrooms', data) as Promise<any>,
  students: (id: number) => API.get(`/classrooms/${id}/students`) as Promise<any[]>,
  stats: (id: number) => API.get(`/classrooms/${id}/stats`) as Promise<any>,
  enroll: (id: number, studentEmail: string) => API.post(`/classrooms/${id}/enroll`, { studentEmail }) as Promise<any>,
}

export const assignments = {
  byClassroom: (classId: number) => API.get(`/assignments/classroom/${classId}`) as Promise<any[]>,
  get: (id: number) => API.get(`/assignments/${id}`) as Promise<any>,
  create: (data: any) => API.post('/assignments', data) as Promise<any>,
  setStatus: (id: number, status: string) => API.patch(`/assignments/${id}/status`, { status }) as Promise<any>,
  submissions: (id: number) => API.get(`/assignments/${id}/submissions`) as Promise<any[]>,
}

export const submissions = {
  submit: (assignment_id: number, code: string) => API.post('/submissions', { assignment_id, code }) as Promise<any>,
  poll: (id: number) => API.get(`/submissions/${id}`) as Promise<any>,
  my: (assignmentId: number) => API.get(`/submissions/my/${assignmentId}`) as Promise<any[]>,
  byStudent: (studentId: number, classId: number) => API.get(`/submissions/student/${studentId}/classroom/${classId}`) as Promise<any[]>,
}

export const chats = {
  getOrCreate: (assignmentId: number) => API.get(`/chats/${assignmentId}`) as Promise<any>,
  getMessages: (assignmentId: number) => API.get(`/chats/${assignmentId}/messages`) as Promise<any[]>,
  sendMessage: (assignmentId: number, content: string, sender: 'student' | 'ai') =>
    API.post(`/chats/${assignmentId}/messages`, { content, sender }) as Promise<any>,
  teacherViewChatLog: (studentId: number, assignmentId: number) =>
    API.get(`/chats/teacher/student/${studentId}/assignment/${assignmentId}`) as Promise<any>,
}

export const misconceptions = {
  byClassroom: (classId: number) => API.get(`/misconceptions/classroom/${classId}`) as Promise<any>,
  byStudent: (studentId: number, classId?: number) =>
    API.get(`/misconceptions/student/${studentId}${classId ? `?classId=${classId}` : ''}`) as Promise<any[]>,
}

export const profiles = {
  me: (classroomId?: number | null) => API.get(`/profiles/me${classroomId ? `?classroomId=${classroomId}` : ''}`) as Promise<any>,
  student: (studentId: number, classId: number) => API.get(`/profiles/${studentId}/classroom/${classId}`) as Promise<any>,
  ews: (classId: number) => API.get(`/profiles/classroom/${classId}/ews`) as Promise<any>,
}

export const system = {
  check: () => API.get('/system/check') as Promise<any>,
  health: () => API.get('/health') as Promise<any>,
}

export default API
