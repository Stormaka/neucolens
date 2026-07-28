import express from 'express'
import cors from 'cors'
import { execSync } from 'child_process'
import { getDb, seedDatabase } from './db/database.js'
import authRouter from './routes/auth.js'
import classroomsRouter from './routes/classrooms.js'
import assignmentsRouter from './routes/assignments.js'
import submissionsRouter from './routes/submissions.js'
import profilesRouter from './routes/profiles.js'
import chatsRouter from './routes/chats.js'
import misconceptionsRouter from './routes/misconceptions.js'
import adminRouter from './routes/admin.js'

const app = express()
const PORT = process.env.PORT || 3001
const snakeKey = key => key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
const toSnakeCase = value => {
  if (Array.isArray(value)) return value.map(toSnakeCase)
  if (!value || typeof value !== 'object' || Buffer.isBuffer(value)) return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key === 'mssv' ? 'student_code' : snakeKey(key), toSnakeCase(child)]))
}

// ── Security: hide server fingerprint ───────────────────────────────────────
app.disable('x-powered-by') // #27: don't disclose Express version

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile, curl, etc.) or matching origins
    if (!origin) return cb(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) {
      return cb(null, true)
    }
    const error = new Error('Origin không được phép')
    error.status = 403
    cb(error)
  },
  credentials: true
}))
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true }))

app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
  })
  const json = res.json.bind(res)
  res.json = body => {
    if (res.statusCode >= 400 && body?.error && typeof body.error === 'string') {
      const code = body.code || `HTTP_${res.statusCode}`
      return json({ success: false, error: { code, message: body.error }, status: res.statusCode })
    }
    return json(toSnakeCase(body))
  }
  next()
})

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  getDb().prepare('SELECT 1').get()
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// ── Storm v4: System capabilities check ────────────────────────────────────
app.get('/api/system/check', (_, res) => {
  const checks = {}

  // Check g++ — thử nhiều path
  const GPP_PATHS = ['g++', 'C:\\msys64\\ucrt64\\bin\\g++.exe', 'C:\\msys64\\mingw64\\bin\\g++.exe']
  let gppFound = false, gppVer = null
  for (const gpp of GPP_PATHS) {
    try {
      gppVer = execSync(`"${gpp}" --version`, { timeout: 3000, encoding: 'utf8' }).split('\n')[0].trim()
      gppFound = true; break
    } catch { }
  }
  const localRunnerAllowed = process.env.ENABLE_LOCAL_RUNNER === 'true' || process.env.NODE_ENV !== 'production'
  checks.gpp = { available: gppFound && localRunnerAllowed, version: gppVer, local_runner_enabled: localRunnerAllowed }

  // Check Gemini API key
  const geminiKey = process.env.GEMINI_API_KEY || ''
  checks.gemini = {
    configured: geminiKey.length > 10,
    model: 'gemini-1.5-flash',
    note: geminiKey.length > 10 ? 'Active — Gemini Flash feedback enabled' : 'No key — rule-based feedback only'
  }

  // Check DB
  getDb().prepare('SELECT 1').get()
  checks.database = { type: 'SQLite', available: true }

  res.json({
    status: 'ok',
    version: 'Storm v4 — NEU-CodeLens',
    checks,
    timestamp: new Date().toISOString()
  })
})

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter)
app.use('/api/classrooms', classroomsRouter)
app.use('/api/assignments', assignmentsRouter)
app.use('/api/submissions', submissionsRouter)
app.use('/api/profile', profilesRouter)
app.use('/api/chats', chatsRouter)
app.use('/api/misconceptions', misconceptionsRouter)
app.use('/api/admin', adminRouter)

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use('/api/*', (_, res) => res.status(404).json({ error: 'API endpoint không tồn tại', status: 404 }))

// ── Global error handler (#14) ────────────────────────────────────────────────
// Catches any unhandled errors thrown in route handlers
app.use((err, req, res, _next) => {
  console.error('❌ Unhandled error:', err.message || err)
  const status = err.status || err.statusCode || 500
  res.status(status).json({
    error: err.message || 'Lỗi máy chủ nội bộ',
    status,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  })
})


// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  getDb()
  // 4.14 Fix: đọc từ env thay vì hardcode true
  // Local dev: mặc định seed; Production: phải set SEED_DEMO_DATA=true tường minh
  const shouldSeedDemo = process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO_DATA === 'true'
  if (shouldSeedDemo) await seedDatabase()

  // Check g++ on startup — thử nhiều path
  let gppStatus = '❌ Không khả dụng'
  const GPP_STARTUP_PATHS = ['g++', 'C:\\msys64\\ucrt64\\bin\\g++.exe', 'C:\\msys64\\mingw64\\bin\\g++.exe']
  for (const gpp of GPP_STARTUP_PATHS) {
    try { execSync(`"${gpp}" --version`, { timeout: 3000, stdio: 'pipe' }); gppStatus = `✅ ${gpp}`; break } catch { }
  }

  const geminiActive = (process.env.GEMINI_API_KEY || '').length > 10

  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`\n🚀 NEU-CodeLens Skills Lab — Storm v4`)
      console.log(`   🌐 http://localhost:${PORT}/api/health`)
      console.log(`   🔧 http://localhost:${PORT}/api/system/check`)
      console.log(`   📚 Routes: /auth /classrooms /assignments /submissions /profile /chats /misconceptions`)
      console.log(`   🗄️  Database: SQLite · ${shouldSeedDemo ? 'demo seed enabled' : 'production data only'}`)
      console.log(`   🤖 Gemini Flash: ${geminiActive ? '✅ ACTIVE' : '⚠️  No key (rule-based only)'}`)
      console.log(`   🧪 Test Runner (g++): ${gppStatus}\n`)
    })
  } else {
    console.log('🚀 Running in Vercel Serverless environment (app.listen skipped)')
  }
}

start().catch(err => { console.error('❌ Server startup error:', err); process.exit(1) })

export default app
