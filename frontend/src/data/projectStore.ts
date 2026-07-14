// ── Global project store ──────────────────────────────────────────
// Lưu tất cả project (mẫu + vừa upload) để dùng chung giữa các trang

export interface ProjectMeta {
  id: string
  name: string
  student: string
  studentId: string
  lang: string
  commit: string
  analyzedAt: string
  nodes: number
  edges: number
  layers: number
  score: number
  status: 'done' | 'processing' | 'error'
  tags: string[]
  layerNames: string[]
  // graph data URL — null nếu dùng SAMPLE_GRAPH
  graphSource: 'sample' | 'uploaded'
  // tên file zip gốc (nếu upload)
  sourceFile?: string
  // ── Review của giảng viên ──
  reviewStatus: 'pending' | 'reviewed'
  reviewComment: string
  reviewScore: number   // 0–100, 0 = chưa chấm
  reviewedAt?: string
}

// Mock projects mặc định
const DEFAULT_PROJECTS: ProjectMeta[] = [
  {
    id: 'proj-1',
    name: 'Hệ thống Quản lý Bán hàng',
    student: 'Nguyễn Văn An',
    studentId: '11201234',
    lang: 'Java · Spring Boot',
    commit: 'a3f8b2c',
    analyzedAt: '2026-06-05 14:32',
    nodes: 87,
    edges: 134,
    layers: 4,
    score: 82,
    status: 'done',
    tags: ['spring-boot', 'mysql', 'rest-api'],
    layerNames: ['API', 'Service', 'Repository', 'Entity'],
    graphSource: 'sample',
    reviewStatus: 'reviewed',
    reviewComment: 'Kiến trúc rõ ràng, phân tầng tốt. Cần bổ thêm unit test.',
    reviewScore: 82,
    reviewedAt: '2026-06-06 08:00',
  },
  {
    id: 'proj-2',
    name: 'Web App Quản lý Nhân sự',
    student: 'Nguyễn Văn An',
    studentId: '11201234',
    lang: 'Node.js · React',
    commit: 'f9c3d1a',
    analyzedAt: '2026-06-04 09:18',
    nodes: 63,
    edges: 91,
    layers: 3,
    score: 75,
    status: 'done',
    tags: ['react', 'express', 'mongodb'],
    layerNames: ['Frontend', 'API', 'Database'],
    graphSource: 'sample',
    reviewStatus: 'pending',
    reviewComment: '',
    reviewScore: 0,
  },
]

// ── In-memory store (tồn tại suốt phiên làm việc) ──────────────────
let _projects: ProjectMeta[] = [...DEFAULT_PROJECTS]
let _listeners: (() => void)[] = []

export const projectStore = {
  /** Lấy tất cả projects */
  getAll(): ProjectMeta[] {
    return _projects
  },

  /** Lấy project theo id */
  getById(id: string): ProjectMeta | undefined {
    return _projects.find(p => p.id === id)
  },

  /** Thêm project mới (khi upload) */
  addProject(proj: ProjectMeta) {
    _projects = [proj, ..._projects]
    _listeners.forEach(fn => fn())
  },

  /** Cập nhật project (ví dụ: sau khi phân tích xong) */
  updateProject(id: string, patch: Partial<ProjectMeta>) {
    _projects = _projects.map(p => (p.id === id ? { ...p, ...patch } : p))
    _listeners.forEach(fn => fn())
  },

  /** Subscribe để re-render khi store thay đổi */
  subscribe(fn: () => void) {
    _listeners.push(fn)
    return () => {
      _listeners = _listeners.filter(l => l !== fn)
    }
  },

  /** Giảng viên lưu nhận xét + điểm */
  updateReview(id: string, comment: string, score: number) {
    const now = new Date()
    const reviewedAt = now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    _projects = _projects.map(p =>
      p.id === id
        ? { ...p, reviewComment: comment, reviewScore: score, reviewStatus: 'reviewed', reviewedAt }
        : p
    )
    _listeners.forEach(fn => fn())
  },
}

/** Tạo project metadata từ tên file zip */
export function buildProjectFromZip(
  fileName: string,
  studentInfo?: { name: string; studentId: string }
): ProjectMeta {
  // Bỏ extension, convert thành tên đẹp
  const baseName = fileName.replace(/\.(zip|tar\.gz|tgz)$/i, '')
  const displayName = baseName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())

  // Detect ngôn ngữ từ tên file
  let lang = 'Unknown'
  const lower = baseName.toLowerCase()
  if (lower.includes('spring') || lower.includes('java')) lang = 'Java · Spring Boot'
  else if (lower.includes('react') || lower.includes('next')) lang = 'TypeScript · React'
  else if (lower.includes('django') || lower.includes('python') || lower.includes('flask')) lang = 'Python · Django'
  else if (lower.includes('node') || lower.includes('express')) lang = 'Node.js · Express'
  else if (lower.includes('laravel') || lower.includes('php')) lang = 'PHP · Laravel'
  else if (lower.includes('dotnet') || lower.includes('aspnet') || lower.includes('csharp')) lang = 'C# · ASP.NET'
  else if (lower.includes('go') || lower.includes('gin')) lang = 'Go · Gin'

  const now = new Date()
  const analyzedAt = now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  return {
    id: 'proj-upload-' + Date.now(),
    name: displayName,
    student: studentInfo?.name ?? 'Nguyễn Văn An',
    studentId: studentInfo?.studentId ?? '11201234',
    lang,
    commit: Math.random().toString(16).slice(2, 9),
    analyzedAt,
    nodes: Math.floor(30 + Math.random() * 120),
    edges: Math.floor(50 + Math.random() * 200),
    layers: Math.floor(3 + Math.random() * 3),
    score: Math.floor(65 + Math.random() * 30),
    status: 'done',
    tags: detectTags(lower),
    layerNames: ['API', 'Service', 'Repository', 'Entity'],
    graphSource: 'uploaded',
    sourceFile: fileName,
    reviewStatus: 'pending',
    reviewComment: '',
    reviewScore: 0,
  }
}

function detectTags(lower: string): string[] {
  const tags: string[] = []
  if (lower.includes('spring')) tags.push('spring-boot')
  if (lower.includes('mysql') || lower.includes('sql')) tags.push('mysql')
  if (lower.includes('mongo')) tags.push('mongodb')
  if (lower.includes('postgres') || lower.includes('pg')) tags.push('postgresql')
  if (lower.includes('react')) tags.push('react')
  if (lower.includes('next')) tags.push('nextjs')
  if (lower.includes('rest') || lower.includes('api')) tags.push('rest-api')
  if (lower.includes('jwt') || lower.includes('auth')) tags.push('jwt')
  if (tags.length === 0) tags.push('project', 'kltn')
  return tags
}
