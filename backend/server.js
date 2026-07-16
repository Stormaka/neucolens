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

const app = express()
const PORT = process.env.PORT || 3001

// ── Security: hide server fingerprint ───────────────────────────────────────
app.disable('x-powered-by') // #27: don't disclose Express version

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,           // Custom domain từ env
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile, curl, etc.) or matching origins
    if (!origin) return cb(null, true)
    if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app')) {
      return cb(null, true)
    }
    cb(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true
}))
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  const db = getDb()
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c
  res.json({ status: 'ok', users: userCount, time: new Date().toISOString() })
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
  checks.gpp = { available: gppFound, version: gppVer, path: gppFound ? 'C:\\msys64\\ucrt64\\bin\\g++.exe' : null }

  // Check Gemini API key
  const geminiKey = process.env.GEMINI_API_KEY || ''
  checks.gemini = {
    configured: geminiKey.length > 10,
    model: 'gemini-1.5-flash',
    note: geminiKey.length > 10 ? 'Active — Gemini Flash feedback enabled' : 'No key — rule-based feedback only'
  }

  // Check DB
  const db = getDb()
  const stats = {
    users:       db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    classrooms:  db.prepare('SELECT COUNT(*) as c FROM classrooms').get().c,
    assignments: db.prepare('SELECT COUNT(*) as c FROM assignments').get().c,
    submissions: db.prepare('SELECT COUNT(*) as c FROM submissions').get().c,
    students:    db.prepare("SELECT COUNT(*) as c FROM users WHERE role='student'").get().c,
    chats:       db.prepare('SELECT COUNT(*) as c FROM ai_chats').get().c,
    misconceptions: db.prepare('SELECT COUNT(*) as c FROM misconceptions').get().c,
  }
  checks.database = { type: 'SQLite', path: 'backend/db/skillslab.db', stats }

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
app.use('/api/profiles', profilesRouter)
app.use('/api/chats', chatsRouter)
app.use('/api/misconceptions', misconceptionsRouter)

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
  await seedDatabase()

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
      console.log(`   📚 Routes: /auth /classrooms /assignments /submissions /profiles /chats /misconceptions`)
      console.log(`   🗄️  Database: SQLite · 15 bài · 10 SV`)
      console.log(`   🤖 Gemini Flash: ${geminiActive ? '✅ ACTIVE' : '⚠️  No key (rule-based only)'}`)
      console.log(`   🧪 Test Runner (g++): ${gppStatus}\n`)
    })
  } else {
    console.log('🚀 Running in Vercel Serverless environment (app.listen skipped)')
  }
}

start().catch(err => { console.error('❌ Server startup error:', err); process.exit(1) })

export default app
