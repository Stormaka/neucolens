import express from 'express'
import cors from 'cors'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Mock database ──
const projects = [
  {
    id: 'proj-1',
    studentId: '11201234',
    studentName: 'Nguyễn Văn An',
    title: 'Hệ thống Quản lý Bán hàng Online',
    lang: 'java',
    frameworks: ['spring-boot', 'spring-security'],
    status: 'done',
    submittedAt: '2026-06-05T14:32:00Z',
    analyzedAt: '2026-06-05T14:35:00Z',
    nodes: 87,
    edges: 134,
    layers: 4,
    architectureScore: 82,
    complexityScore: 78,
    cohesionScore: 85,
    tags: ['spring-boot', 'mysql', 'rest-api'],
  },
  {
    id: 'proj-2',
    studentId: '11201567',
    studentName: 'Trần Thị Bích',
    title: 'Web App Quản lý Nhân sự',
    lang: 'javascript',
    frameworks: ['react', 'express'],
    status: 'pending',
    submittedAt: '2026-06-04T09:15:00Z',
    analyzedAt: '2026-06-04T09:18:00Z',
    nodes: 63,
    edges: 91,
    layers: 3,
    architectureScore: 75,
    complexityScore: 70,
    cohesionScore: 80,
    tags: ['react', 'express', 'mongodb'],
  },
]

// ── Routes ──

// Health check
const apiRouter = express.Router()

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', service: 'NEU CodeLens API' })
})

// Auth
apiRouter.post('/auth/login', (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email và password là bắt buộc' })
  }
  // Mock auth
  const isStudent = email.includes('sv') || !email.includes('ts.')
  res.json({
    token: 'mock-jwt-token-' + Date.now(),
    user: {
      id: isStudent ? '11201234' : 'gv-001',
      name: isStudent ? 'Nguyễn Văn An' : 'TS. Nguyễn Minh Đức',
      email,
      role: isStudent ? 'student' : 'lecturer',
    },
  })
})

// Projects
apiRouter.get('/projects', (req, res) => {
  const { studentId, role } = req.query
  if (role === 'student' && studentId) {
    return res.json(projects.filter(p => p.studentId === studentId))
  }
  res.json(projects) // lecturer gets all
})

apiRouter.get('/projects/:id', (req, res) => {
  const project = projects.find(p => p.id === req.params.id)
  if (!project) return res.status(404).json({ error: 'Project không tìm thấy' })
  res.json(project)
})

apiRouter.post('/projects', (req, res) => {
  const { title, githubUrl, studentId, studentName } = req.body
  const newProject = {
    id: 'proj-' + Date.now(),
    studentId,
    studentName,
    title,
    lang: 'unknown',
    frameworks: [],
    status: 'analyzing',
    submittedAt: new Date().toISOString(),
    analyzedAt: null,
    nodes: 0,
    edges: 0,
    layers: 0,
    architectureScore: 0,
    complexityScore: 0,
    cohesionScore: 0,
    tags: [],
    githubUrl,
  }
  projects.push(newProject)

  // Simulate analysis completing after 15 seconds
  setTimeout(() => {
    const proj = projects.find(p => p.id === newProject.id)
    if (proj) {
      proj.status = 'done'
      proj.analyzedAt = new Date().toISOString()
      proj.nodes = Math.floor(40 + Math.random() * 100)
      proj.edges = Math.floor(60 + Math.random() * 150)
      proj.layers = Math.floor(3 + Math.random() * 4)
      proj.architectureScore = Math.floor(65 + Math.random() * 30)
      proj.complexityScore = Math.floor(60 + Math.random() * 35)
      proj.cohesionScore = Math.floor(70 + Math.random() * 25)
      proj.tags = ['spring-boot', 'mysql']
    }
  }, 15000)

  res.status(201).json(newProject)
})

// Knowledge graph
apiRouter.get('/projects/:id/graph', (req, res) => {
  const project = projects.find(p => p.id === req.params.id)
  if (!project) return res.status(404).json({ error: 'Project không tìm thấy' })
  if (project.status !== 'done') {
    return res.status(202).json({ status: 'analyzing', message: 'Graph đang được tạo...' })
  }
  // Return mock graph (in real system, read from file)
  res.json({ projectId: req.params.id, status: 'ready', graphUrl: `/api/projects/${req.params.id}/graph/data` })
})

// Analysis report
apiRouter.get('/projects/:id/report', (req, res) => {
  const project = projects.find(p => p.id === req.params.id)
  if (!project) return res.status(404).json({ error: 'Project không tìm thấy' })

  res.json({
    projectId: req.params.id,
    generatedAt: new Date().toISOString(),
    summary: {
      architectureScore: project.architectureScore,
      complexityScore: project.complexityScore,
      cohesionScore: project.cohesionScore,
      overallScore: Math.round((project.architectureScore + project.complexityScore + project.cohesionScore) / 3),
    },
    recommendations: [
      { level: 'warning', title: 'Thêm Unit Tests', description: 'Phát hiện ít test coverage' },
      { level: 'info', title: 'API Documentation', description: 'Thêm Swagger docs' },
      { level: 'success', title: 'Kiến trúc phân tầng', description: 'Đã áp dụng đúng nguyên tắc' },
    ],
  })
})

// Chat
apiRouter.post('/projects/:id/chat', (req, res) => {
  const { message } = req.body
  if (!message) return res.status(400).json({ error: 'Message là bắt buộc' })

  // Mock AI response based on keywords
  const lower = message.toLowerCase()
  let response

  if (lower.includes('kiến trúc') || lower.includes('architecture')) {
    response = 'Project sử dụng kiến trúc 3-tier: Controller → Service → Repository. Spring Boot với JPA/Hibernate giao tiếp MySQL database.'
  } else if (lower.includes('đăng nhập') || lower.includes('login') || lower.includes('auth')) {
    response = 'Luồng đăng nhập: POST /api/auth/login → AuthController → AuthService.authenticate() → UserRepository.findByEmail() → BCrypt.matches() → JwtTokenProvider.generateToken()'
  } else if (lower.includes('phức tạp') || lower.includes('complex')) {
    response = 'Các module phức tạp nhất: OrderService (orchestrate nhiều service), SecurityConfig (Spring Security setup), và OrderController (nhiều endpoints với validation phức tạp).'
  } else {
    response = `Dựa trên knowledge graph của project (${projects.find(p => p.id === req.params.id)?.nodes || 87} nodes), tôi có thể giải thích chi tiết hơn về "${message}". Bạn muốn tìm hiểu về phần nào cụ thể?`
  }

  res.json({
    response,
    contextNodes: ['AuthService', 'UserRepository', 'JwtTokenProvider'],
    confidence: 0.85,
  })
})

// Lecturer: add review/comment
apiRouter.post('/projects/:id/review', (req, res) => {
  const { comment, score } = req.body
  const project = projects.find(p => p.id === req.params.id)
  if (!project) return res.status(404).json({ error: 'Project không tìm thấy' })

  project.status = 'reviewed'
  project.reviewComment = comment
  project.reviewScore = score
  project.reviewedAt = new Date().toISOString()

  res.json({ success: true, project })
})

// Stats (lecturer)
apiRouter.get('/stats', (req, res) => {
  res.json({
    totalProjects: projects.length,
    pending: projects.filter(p => p.status === 'pending').length,
    reviewed: projects.filter(p => p.status === 'reviewed').length,
    analyzing: projects.filter(p => p.status === 'analyzing').length,
    averageScore: Math.round(projects
      .filter(p => p.architectureScore > 0)
      .reduce((sum, p) => sum + p.architectureScore, 0) /
      Math.max(1, projects.filter(p => p.architectureScore > 0).length)),
  })
})

// Mount router under /api and / to handle both experimental services and serverless functions
app.use('/api', apiRouter)
app.use('/', apiRouter)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint không tồn tại' })
})

// Error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Lỗi server nội bộ' })
})

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║  NEU CodeLens API Server                  ║
║  Đại học Kinh tế Quốc dân                 ║
╠═══════════════════════════════════════════╣
║  Running on: http://localhost:${PORT}         ║
║  Health:     http://localhost:${PORT}/api/health ║
╚═══════════════════════════════════════════╝
    `)
  })
}

export default app
