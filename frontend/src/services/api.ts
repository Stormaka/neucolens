/**
 * api.ts — Wrapper gọi Backend API thật của NEU CodeLens
 * Tất cả các request đều đi qua đây, không còn mock data.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  studentId: string
  studentName: string
  title: string
  lang: string
  frameworks: string[]
  status: 'analyzing' | 'done' | 'error' | 'reviewed'
  submittedAt: string
  analyzedAt: string | null
  nodes: number
  edges: number
  layers: number
  architectureScore: number
  complexityScore: number
  cohesionScore: number
  overallScore: number
  tags: string[]
  githubUrl?: string
  reviewStatus: 'pending' | 'reviewed'
  reviewComment: string
  reviewScore: number
  reviewedAt?: string
  errorMessage?: string
}

export interface GraphNode {
  id: string
  type: string
  name: string
  filePath?: string
  summary: string
  tags: string[]
  complexity: 'simple' | 'moderate' | 'complex'
  lineRange?: [number, number]
}

export interface GraphEdge {
  source: string
  target: string
  type: string
  direction: string
  weight: number
}

export interface KnowledgeGraph {
  version: string
  project: {
    id: string
    name: string
    languages: string[]
    frameworks: string[]
    description: string
    analyzedAt: string
  }
  nodes: GraphNode[]
  edges: GraphEdge[]
  layers: Array<{
    id: string
    name: string
    description: string
    nodeIds: string[]
  }>
  tour: Array<{
    order: number
    title: string
    description: string
    nodeIds: string[]
  }>
}

export interface ArchitectureReport {
  projectId: string
  generatedAt: string
  overallScore: number
  architecturePattern: string
  layers: Array<{
    name: string
    nodeIds: string[]
    description: string
    quality: 'good' | 'needs-improvement' | 'poor'
    issues: string[]
  }>
  designPatterns: Array<{
    name: string
    found: boolean
    examples: string[]
    description: string
  }>
  antiPatterns: Array<{
    name: string
    severity: string
    instances: string[]
    description: string
  }>
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low'
    title: string
    description: string
    effort: string
  }>
  strengths: string[]
  weaknesses: string[]
  neuReviewNote: string
  scores: {
    architectureScore: number
    complexityScore: number
    cohesionScore: number
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  return apiFetch<{ token: string; user: { id: string; name: string; email: string; role: string } }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }
  )
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function getProjects(params?: { studentId?: string; role?: string }): Promise<Project[]> {
  const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
  return apiFetch<Project[]>(`/projects${query}`)
}

export async function getProject(id: string): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`)
}

/**
 * Upload project ZIP file
 */
export async function uploadProjectZip(
  file: File,
  meta: { title?: string; studentId?: string; studentName?: string }
): Promise<Project> {
  const formData = new FormData()
  formData.append('file', file)
  if (meta.title) formData.append('title', meta.title)
  if (meta.studentId) formData.append('studentId', meta.studentId)
  if (meta.studentName) formData.append('studentName', meta.studentName)

  const res = await fetch(`${API_BASE}/api/projects`, {
    method: 'POST',
    body: formData,
    // KHÔNG set Content-Type — browser tự đặt boundary cho multipart
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Submit via GitHub URL
 */
export async function submitGithubProject(
  githubUrl: string,
  meta: { title?: string; studentId?: string; studentName?: string }
): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ githubUrl, ...meta }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Lấy knowledge graph của project
 */
export async function getProjectGraph(id: string): Promise<KnowledgeGraph> {
  const res = await fetch(`${API_BASE}/api/projects/${id}/graph`)
  if (res.status === 202) {
    throw new Error('ANALYZING') // đang phân tích
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Lấy báo cáo kiến trúc
 */
export async function getProjectReport(id: string): Promise<ArchitectureReport> {
  return apiFetch<ArchitectureReport>(`/projects/${id}/report`)
}

/**
 * Gửi câu hỏi chat
 */
export async function chatWithProject(id: string, message: string) {
  return apiFetch<{ response: string; contextNodes: string[]; confidence: number }>(`/projects/${id}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

/**
 * Lưu nhận xét của giảng viên
 */
export async function reviewProject(id: string, comment: string, score: number) {
  return apiFetch<{ success: boolean; project: Project }>(`/projects/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ comment, score }),
  })
}

/**
 * Lấy thống kê tổng hợp
 */
export async function getStats() {
  return apiFetch<{
    totalProjects: number
    pending: number
    reviewed: number
    analyzing: number
    done: number
    averageScore: number
  }>('/stats')
}

/**
 * Polling cho đến khi project hoàn thành phân tích
 * Gọi callback mỗi khi trạng thái thay đổi
 */
export function pollProjectStatus(
  id: string,
  onUpdate: (project: Project) => void,
  intervalMs = 3000
): () => void {
  let active = true
  
  const poll = async () => {
    if (!active) return
    try {
      const project = await getProject(id)
      onUpdate(project)
      if (project.status === 'analyzing') {
        setTimeout(poll, intervalMs)
      }
    } catch {
      if (active) setTimeout(poll, intervalMs * 2)
    }
  }

  setTimeout(poll, intervalMs)
  
  return () => { active = false }
}
