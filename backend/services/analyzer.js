/**
 * analyzer.js
 * 
 * Orchestrator dịch vụ phân tích mã nguồn sinh viên NEU,
 * sử dụng các script tĩnh của Understand-Anything (scan + batch + extract-structure)
 * và tự động sinh knowledge-graph.json hoàn toàn KHÔNG dùng Gemini API.
 *
 * Pipeline:
 *   Phase 1: scan-project.mjs  → scan-result.json
 *   Phase 2: compute-batches.mjs → batches.json
 *   Phase 3: extract-structure.mjs → batch-<n>.json (một batch cho mỗi nhóm files)
 *   Phase 4: Gộp thủ công thành knowledge-graph.json
 *   Phase 5: Phân tích kiến trúc tự động (pure rule-based)
 */

import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import {
  existsSync, readFileSync, writeFileSync,
  mkdirSync, readdirSync, rmSync
} from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Đường dẫn tới Understand-Anything ──────────────────────────────────────
const UA_REPO = resolve(
  process.env.UA_DIR
    ? join(process.env.UA_DIR, '..')
    : join(process.env.USERPROFILE || process.env.HOME, '.understand-anything', 'repo')
)
const UA_PLUGIN = join(UA_REPO, 'understand-anything-plugin')
const SKILL_DIR = join(UA_PLUGIN, 'skills', 'understand')

// ─── Kiểm tra môi trường ─────────────────────────────────────────────────────
export function checkEnvironment() {
  const scanScript = join(SKILL_DIR, 'scan-project.mjs')
  const batchScript = join(SKILL_DIR, 'compute-batches.mjs')
  const extractScript = join(SKILL_DIR, 'extract-structure.mjs')
  const coreIndex = join(UA_PLUGIN, 'packages', 'core', 'dist', 'index.js')

  const missing = []
  if (!existsSync(scanScript)) missing.push('scan-project.mjs')
  if (!existsSync(batchScript)) missing.push('compute-batches.mjs')
  if (!existsSync(extractScript)) missing.push('extract-structure.mjs')
  if (!existsSync(coreIndex)) missing.push('@understand-anything/core (dist/index.js)')

  return { ok: missing.length === 0, missing, SKILL_DIR, UA_PLUGIN }
}

// ─── Tiện ích chạy lệnh ─────────────────────────────────────────────────────
function runNode(scriptPath, args = [], cwd = undefined) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [scriptPath, ...args], {
      cwd: cwd || dirname(scriptPath),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    })

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', d => stdout += d.toString())
    proc.stderr.on('data', d => stderr += d.toString())

    proc.on('close', code => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`Script ${scriptPath} exited with code ${code}\nSTDERR: ${stderr}`))
    })
    proc.on('error', reject)
  })
}

// ─── Phân loại kiến trúc theo quy tắc tĩnh ──────────────────────────────────
function detectArchitectureFromFiles(files) {
  const paths = files.map(f => f.path.toLowerCase())
  
  // Phát hiện tech stack
  const isSpring = paths.some(p => p.includes('controller') || p.includes('service') || p.includes('repository') || p.endsWith('.java'))
  const isReact = paths.some(p => p.endsWith('.tsx') || p.endsWith('.jsx') || p.includes('component'))
  const isDjango = paths.some(p => p.includes('views.py') || p.includes('models.py') || p.includes('urls.py'))
  const isExpress = paths.some(p => p.includes('routes') || p.includes('middleware'))
  const isLaravel = paths.some(p => p.includes('controller') && p.endsWith('.php'))

  let stack = 'unknown'
  let layers = []
  
  if (isSpring) {
    stack = 'java-spring'
    layers = detectSpringLayers(files)
  } else if (isDjango) {
    stack = 'python-django'
    layers = detectDjangoLayers(files)
  } else if (isReact && isExpress) {
    stack = 'react-express'
    layers = detectReactExpressLayers(files)
  } else if (isReact) {
    stack = 'react'
    layers = detectReactLayers(files)
  } else if (isExpress) {
    stack = 'express'
    layers = detectExpressLayers(files)
  } else if (isLaravel) {
    stack = 'php-laravel'
    layers = detectLaravelLayers(files)
  }

  return { stack, layers }
}

function detectSpringLayers(files) {
  const layers = []
  const controllers = files.filter(f => f.path.toLowerCase().includes('controller'))
  const services = files.filter(f => f.path.toLowerCase().includes('service'))
  const repos = files.filter(f => f.path.toLowerCase().includes('repository') || f.path.toLowerCase().includes('dao'))
  const entities = files.filter(f => f.path.toLowerCase().includes('entity') || f.path.toLowerCase().includes('model'))

  if (controllers.length) layers.push({ name: 'Controller Layer', files: controllers.map(f => f.path), description: 'Xử lý HTTP requests, validation đầu vào' })
  if (services.length) layers.push({ name: 'Service Layer', files: services.map(f => f.path), description: 'Logic nghiệp vụ chính của ứng dụng' })
  if (repos.length) layers.push({ name: 'Repository Layer', files: repos.map(f => f.path), description: 'Tương tác cơ sở dữ liệu qua JPA/Hibernate' })
  if (entities.length) layers.push({ name: 'Domain Layer', files: entities.map(f => f.path), description: 'Domain model, Entity classes' })
  
  return layers
}

function detectDjangoLayers(files) {
  const layers = []
  const views = files.filter(f => f.path.includes('views.py') || f.path.includes('views/'))
  const models = files.filter(f => f.path.includes('models.py') || f.path.includes('models/'))
  const urls = files.filter(f => f.path.includes('urls.py'))
  const serializers = files.filter(f => f.path.includes('serializers.py') || f.path.includes('serializers/'))

  if (urls.length) layers.push({ name: 'URL Routing', files: urls.map(f => f.path), description: 'Định tuyến URL tới Views' })
  if (views.length) layers.push({ name: 'View Layer', files: views.map(f => f.path), description: 'Xử lý request và trả về response' })
  if (serializers.length) layers.push({ name: 'Serializer Layer', files: serializers.map(f => f.path), description: 'Chuyển đổi dữ liệu Model thành JSON' })
  if (models.length) layers.push({ name: 'Model Layer', files: models.map(f => f.path), description: 'Database models, ORM với Django' })
  
  return layers
}

function detectReactExpressLayers(files) {
  const layers = []
  const components = files.filter(f => (f.path.endsWith('.tsx') || f.path.endsWith('.jsx')) && (f.path.includes('components') || f.path.includes('pages')))
  const routes = files.filter(f => f.path.includes('routes') || f.path.includes('router'))
  const controllers = files.filter(f => f.path.includes('controller') || f.path.includes('handlers'))
  const models = files.filter(f => f.path.includes('models') || f.path.includes('schema'))

  if (components.length) layers.push({ name: 'UI Components', files: components.map(f => f.path), description: 'React components và pages' })
  if (routes.length) layers.push({ name: 'API Routes', files: routes.map(f => f.path), description: 'Định nghĩa các API endpoint Express' })
  if (controllers.length) layers.push({ name: 'Controllers', files: controllers.map(f => f.path), description: 'Xử lý logic API request' })
  if (models.length) layers.push({ name: 'Data Models', files: models.map(f => f.path), description: 'Schema và models cơ sở dữ liệu' })
  
  return layers
}

function detectReactLayers(files) {
  const layers = []
  const pages = files.filter(f => f.path.includes('pages') || f.path.includes('views'))
  const components = files.filter(f => f.path.includes('components'))
  const hooks = files.filter(f => f.path.includes('hooks') || f.path.startsWith('use'))
  const services = files.filter(f => f.path.includes('services') || f.path.includes('api'))

  if (pages.length) layers.push({ name: 'Pages', files: pages.map(f => f.path), description: 'Các trang React chính' })
  if (components.length) layers.push({ name: 'Components', files: components.map(f => f.path), description: 'UI components có thể tái sử dụng' })
  if (hooks.length) layers.push({ name: 'Hooks', files: hooks.map(f => f.path), description: 'Custom React hooks quản lý trạng thái' })
  if (services.length) layers.push({ name: 'Services', files: services.map(f => f.path), description: 'API calls và business logic' })
  
  return layers
}

function detectExpressLayers(files) {
  const layers = []
  const routes = files.filter(f => f.path.includes('routes') || f.path.includes('router'))
  const controllers = files.filter(f => f.path.includes('controller') || f.path.includes('handler'))
  const middleware = files.filter(f => f.path.includes('middleware'))
  const models = files.filter(f => f.path.includes('models') || f.path.includes('schema'))

  if (routes.length) layers.push({ name: 'Routes', files: routes.map(f => f.path), description: 'Định nghĩa API endpoints' })
  if (controllers.length) layers.push({ name: 'Controllers', files: controllers.map(f => f.path), description: 'Business logic xử lý request' })
  if (middleware.length) layers.push({ name: 'Middleware', files: middleware.map(f => f.path), description: 'Xử lý auth, logging, validation' })
  if (models.length) layers.push({ name: 'Models', files: models.map(f => f.path), description: 'Database schema và models' })
  
  return layers
}

function detectLaravelLayers(files) {
  const layers = []
  const controllers = files.filter(f => f.path.includes('Controller') && f.path.endsWith('.php'))
  const models = files.filter(f => f.path.includes('Models') || (f.path.includes('Model') && f.path.endsWith('.php')))
  const routes = files.filter(f => f.path.includes('routes'))
  const middleware = files.filter(f => f.path.includes('Middleware'))

  if (routes.length) layers.push({ name: 'Routes', files: routes.map(f => f.path), description: 'Định nghĩa web và API routes' })
  if (controllers.length) layers.push({ name: 'Controllers', files: controllers.map(f => f.path), description: 'Xử lý HTTP request và response' })
  if (middleware.length) layers.push({ name: 'Middleware', files: middleware.map(f => f.path), description: 'Auth, validation middleware' })
  if (models.length) layers.push({ name: 'Models', files: models.map(f => f.path), description: 'Eloquent ORM models' })
  
  return layers
}

// ─── Tính điểm kiến trúc tự động ────────────────────────────────────────────
function computeScores(scanResult, extractResults, architectureInfo) {
  const codeFiles = (scanResult.files || []).filter(f => f.fileCategory === 'code')
  const totalFiles = scanResult.totalFiles || 1
  const { stack, layers } = architectureInfo

  // Điểm phân tầng (0-100)
  let architectureScore = 50
  if (layers.length >= 4) architectureScore = 85
  else if (layers.length === 3) architectureScore = 75
  else if (layers.length === 2) architectureScore = 65
  else if (layers.length <= 1 && totalFiles > 5) architectureScore = 40

  // Điểm phức tạp (cao = phức tạp hơn, không nhất thiết là tốt hơn)
  const avgLinesPerFile = codeFiles.reduce((s, f) => s + (f.sizeLines || 0), 0) / Math.max(1, codeFiles.length)
  let complexityScore = 50
  if (avgLinesPerFile < 100) complexityScore = 85  // files nhỏ, tốt
  else if (avgLinesPerFile < 200) complexityScore = 70
  else if (avgLinesPerFile < 400) complexityScore = 55
  else complexityScore = 40  // files rất lớn, có thể God Class

  // Điểm gắn kết (cohesion)
  let cohesionScore = 60
  if (stack !== 'unknown') cohesionScore += 10
  if (layers.length >= 3) cohesionScore += 10
  cohesionScore = Math.min(100, cohesionScore)

  // Điểm tổng hợp
  const overallScore = Math.round((architectureScore + complexityScore + cohesionScore) / 3)

  return { architectureScore, complexityScore, cohesionScore, overallScore }
}

// ─── Tạo knowledge-graph.json từ extract results ─────────────────────────────
function buildKnowledgeGraph(projectId, scanResult, allExtractResults, architectureInfo) {
  const { stack, layers } = architectureInfo
  const nodes = []
  const edges = []
  const layerDefs = []
  const nodeIds = new Set()

  const addNode = (node) => {
    if (nodeIds.has(node.id)) return
    nodeIds.add(node.id)
    nodes.push(node)
  }

  // Tạo nodes từ extract results
  for (const result of allExtractResults) {
    for (const fileResult of (result.results || [])) {
      const fileId = `file:${fileResult.path}`
      
      // Phân loại loại node theo fileCategory
      let nodeType = 'file'
      if (fileResult.fileCategory === 'config') nodeType = 'config'
      else if (fileResult.fileCategory === 'docs') nodeType = 'document'

      const tags = []
      if (fileResult.path.toLowerCase().includes('controller')) tags.push('api-handler')
      if (fileResult.path.toLowerCase().includes('service')) tags.push('service')
      if (fileResult.path.toLowerCase().includes('repository') || fileResult.path.toLowerCase().includes('dao')) tags.push('data-access')
      if (fileResult.path.toLowerCase().includes('test') || fileResult.path.toLowerCase().includes('spec')) tags.push('test')
      if (fileResult.path.toLowerCase().includes('component')) tags.push('component')
      if (fileResult.path.toLowerCase().includes('model') || fileResult.path.toLowerCase().includes('entity')) tags.push('data-model')
      if (fileResult.path.toLowerCase().includes('middleware')) tags.push('middleware')
      if (fileResult.path.toLowerCase().includes('router') || fileResult.path.toLowerCase().includes('routes')) tags.push('routing')
      if (fileResult.path.toLowerCase().includes('util') || fileResult.path.toLowerCase().includes('helper')) tags.push('utility')
      if (tags.length === 0) tags.push('module')

      // Tính complexity từ metrics
      const metrics = fileResult.metrics || {}
      const nonEmpty = fileResult.nonEmptyLines || 0
      let complexity = 'simple'
      if (nonEmpty > 200) complexity = 'complex'
      else if (nonEmpty > 50) complexity = 'moderate'

      const name = fileResult.path.split('/').pop() || fileResult.path
      addNode({
        id: fileId,
        type: nodeType,
        name,
        filePath: fileResult.path,
        summary: `File ${name} (${fileResult.language || 'unknown'}) — ${fileResult.totalLines || 0} dòng`,
        tags,
        complexity
      })

      // Thêm function nodes cho các hàm đáng chú ý
      for (const fn of (fileResult.functions || [])) {
        if ((fn.endLine - fn.startLine) < 5) continue // bỏ qua hàm quá nhỏ
        const fnId = `function:${fileResult.path}:${fn.name}`
        addNode({
          id: fnId,
          type: 'function',
          name: fn.name,
          filePath: fileResult.path,
          lineRange: [fn.startLine, fn.endLine],
          summary: `Hàm ${fn.name} trong ${name}`,
          tags: ['function'],
          complexity: (fn.endLine - fn.startLine > 50) ? 'complex' : (fn.endLine - fn.startLine > 15) ? 'moderate' : 'simple'
        })
        edges.push({ source: fileId, target: fnId, type: 'contains', direction: 'forward', weight: 1.0 })
      }

      // Thêm class nodes
      for (const cls of (fileResult.classes || [])) {
        const clsId = `class:${fileResult.path}:${cls.name}`
        addNode({
          id: clsId,
          type: 'class',
          name: cls.name,
          filePath: fileResult.path,
          lineRange: [cls.startLine, cls.endLine],
          summary: `Class ${cls.name} trong ${name}`,
          tags: ['class'],
          complexity: (cls.endLine - cls.startLine > 100) ? 'complex' : 'moderate'
        })
        edges.push({ source: fileId, target: clsId, type: 'contains', direction: 'forward', weight: 1.0 })
      }
    }
  }

  // Tạo edges dựa trên phân tích kiến trúc (layer connections)
  for (let i = 0; i < layers.length - 1; i++) {
    const fromLayer = layers[i]
    const toLayer = layers[i + 1]
    for (const fromFile of fromLayer.files.slice(0, 3)) {
      for (const toFile of toLayer.files.slice(0, 3)) {
        const fromId = `file:${fromFile}`
        const toId = `file:${toFile}`
        if (nodeIds.has(fromId) && nodeIds.has(toId)) {
          edges.push({ source: fromId, target: toId, type: 'imports', direction: 'forward', weight: 0.7 })
        }
      }
    }
  }

  // Tạo layer definitions
  const allNodeIds = Array.from(nodeIds)
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i]
    const layerNodeIds = layer.files
      .map(f => `file:${f}`)
      .filter(id => nodeIds.has(id))
    
    layerDefs.push({
      id: `layer:${layer.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: layer.name,
      description: layer.description,
      nodeIds: layerNodeIds
    })
  }

  // Gán các node chưa có layer vào layer "Other"
  const assignedNodeIds = new Set(layerDefs.flatMap(l => l.nodeIds))
  const unassignedFileNodes = nodes
    .filter(n => (n.type === 'file' || n.type === 'config' || n.type === 'document') && !assignedNodeIds.has(n.id))
    .map(n => n.id)
  
  if (unassignedFileNodes.length > 0) {
    layerDefs.push({
      id: 'layer:other',
      name: 'Other',
      description: 'Các file khác (config, test, docs)',
      nodeIds: unassignedFileNodes
    })
  }

  return {
    version: '1.0.0',
    project: {
      id: projectId,
      name: scanResult.projectName || 'Đồ án NEU',
      languages: scanResult.languages || Object.keys(scanResult.stats?.byLanguage || {}),
      frameworks: [],
      description: `Dự án được phân tích bởi NEU CodeLens. Stack: ${stack}`,
      analyzedAt: new Date().toISOString(),
    },
    nodes,
    edges,
    layers: layerDefs,
    tour: []
  }
}

// ─── Sinh báo cáo kiến trúc thuần rule-based ─────────────────────────────────
function buildArchitectureReport(scanResult, architectureInfo, scores) {
  const { stack, layers } = architectureInfo
  const { architectureScore, complexityScore, cohesionScore, overallScore } = scores

  const stackNames = {
    'java-spring': 'Java Spring Boot (MVC + Layered)',
    'python-django': 'Python Django (MVT)',
    'react-express': 'Node.js Full-stack (React + Express)',
    'react': 'React (SPA Frontend)',
    'express': 'Node.js Express (REST API)',
    'php-laravel': 'PHP Laravel (MVC)',
    'unknown': 'Chưa xác định'
  }

  const recommendations = []
  
  if (layers.length < 3) {
    recommendations.push({
      priority: 'high',
      title: 'Cải thiện phân tầng kiến trúc',
      description: 'Dự án chưa có sự phân tầng rõ ràng. Nên tổ chức code thành ít nhất 3 tầng: Presentation, Business Logic và Data Access.',
      effort: '2-3 ngày'
    })
  }

  const codeFiles = (scanResult.files || []).filter(f => f.fileCategory === 'code')
  const hasTests = codeFiles.some(f =>
    f.path.toLowerCase().includes('test') || f.path.toLowerCase().includes('spec')
  )
  if (!hasTests) {
    recommendations.push({
      priority: 'high',
      title: 'Thiếu Unit Tests',
      description: 'Không phát hiện file test trong dự án. Hãy bổ sung unit tests cho Service layer để đảm bảo chất lượng.',
      effort: '3-5 ngày'
    })
  }

  const hasReadme = (scanResult.files || []).some(f =>
    f.path.toLowerCase() === 'readme.md' || f.path.toLowerCase().endsWith('/readme.md')
  )
  if (!hasReadme) {
    recommendations.push({
      priority: 'medium',
      title: 'Thiếu tài liệu README',
      description: 'Nên bổ sung README.md mô tả mục đích dự án, hướng dẫn cài đặt và chạy ứng dụng.',
      effort: '0.5 ngày'
    })
  }

  const strengths = []
  const weaknesses = []

  if (layers.length >= 3) strengths.push('Phân tầng kiến trúc rõ ràng')
  if (stack !== 'unknown') strengths.push(`Sử dụng ${stackNames[stack]} — framework phổ biến, cộng đồng lớn`)
  if (hasTests) strengths.push('Có viết unit tests')
  if (hasReadme) strengths.push('Có tài liệu README')

  if (layers.length < 3) weaknesses.push('Chưa phân tầng rõ ràng, có thể gây khó bảo trì')
  if (!hasTests) weaknesses.push('Thiếu unit tests — rủi ro cao khi refactor')
  if (!hasReadme) weaknesses.push('Thiếu tài liệu — khó onboard thành viên mới')
  if (complexityScore < 60) weaknesses.push('Một số file có độ phức tạp cao, nên tách nhỏ')

  const neuReviewNote = `Dự án ${overallScore >= 70 ? 'đạt yêu cầu cơ bản' : 'cần cải thiện thêm'} về mặt kiến trúc. ` +
    `Stack công nghệ sử dụng: ${stackNames[stack]}. ` +
    `Phát hiện ${layers.length} tầng kiến trúc. ` +
    `Điểm tổng hợp: ${overallScore}/100. ` +
    (weaknesses.length > 0 ? `Điểm cần cải thiện: ${weaknesses[0]}.` : 'Kiến trúc nhìn chung tốt.')

  return {
    overallScore,
    architecturePattern: stack,
    layers: layers.map(l => ({
      name: l.name,
      nodeIds: l.files,
      description: l.description,
      quality: architectureScore >= 75 ? 'good' : architectureScore >= 60 ? 'needs-improvement' : 'poor',
      issues: []
    })),
    designPatterns: [],
    antiPatterns: [],
    recommendations,
    strengths: strengths.length > 0 ? strengths : ['Dự án đã được phân tích tự động'],
    weaknesses: weaknesses.length > 0 ? weaknesses : ['Tiếp tục cải thiện chất lượng code'],
    neuReviewNote,
    scores: { architectureScore, complexityScore, cohesionScore }
  }
}

// ─── Hàm chính: analyzeProject ───────────────────────────────────────────────
export async function analyzeProject(projectId, projectRoot, onProgress) {
  const log = (msg) => {
    console.log(`[analyzer][${projectId}] ${msg}`)
    if (onProgress) onProgress(msg)
  }

  // Kiểm tra môi trường
  const env = checkEnvironment()
  if (!env.ok) {
    throw new Error(`Understand-Anything chưa được cài đặt đúng. Thiếu: ${env.missing.join(', ')}`)
  }

  const uaDir = join(projectRoot, '.understand-anything')
  const intermediateDir = join(uaDir, 'intermediate')
  const tmpDir = join(uaDir, 'tmp')
  mkdirSync(intermediateDir, { recursive: true })
  mkdirSync(tmpDir, { recursive: true })

  // ─── PHASE 1: Scan Project ───────────────────────────────────────────────
  log('[Phase 1/4] Đang quét cấu trúc dự án...')
  const scanOutput = join(intermediateDir, 'scan-result.json')
  await runNode(join(SKILL_DIR, 'scan-project.mjs'), [projectRoot, scanOutput])
  
  const scanResult = JSON.parse(readFileSync(scanOutput, 'utf-8'))
  log(`[Phase 1 ✓] Tìm thấy ${scanResult.totalFiles} files, độ phức tạp: ${scanResult.estimatedComplexity}`)

  // ─── PHASE 2: Compute Batches ────────────────────────────────────────────
  log('[Phase 2/4] Đang chia nhóm files để phân tích...')
  await runNode(join(SKILL_DIR, 'compute-batches.mjs'), [projectRoot])
  
  const batchesFile = join(intermediateDir, 'batches.json')
  const batchesData = JSON.parse(readFileSync(batchesFile, 'utf-8'))
  const batches = batchesData.batches || batchesData
  const totalBatches = Array.isArray(batches) ? batches.length : Object.keys(batches).length
  log(`[Phase 2 ✓] Chia thành ${totalBatches} nhóm phân tích`)

  // ─── PHASE 3: Extract Structure ──────────────────────────────────────────
  log(`[Phase 3/4] Đang trích xuất cấu trúc code (${totalBatches} nhóm)...`)
  const batchArray = Array.isArray(batches) ? batches : Object.values(batches)
  const allExtractResults = []

  for (let i = 0; i < batchArray.length; i++) {
    const batch = batchArray[i]
    const batchIndex = batch.batchIndex !== undefined ? batch.batchIndex : i
    const batchFiles = batch.files || batch.batchFiles || []
    
    if (batchFiles.length === 0) continue

    const inputFile = join(tmpDir, `ua-extract-input-${batchIndex}.json`)
    const outputFile = join(tmpDir, `ua-extract-output-${batchIndex}.json`)

    writeFileSync(inputFile, JSON.stringify({
      projectRoot,
      batchFiles,
      batchImportData: batch.batchImportData || {}
    }, null, 2))

    try {
      await runNode(join(SKILL_DIR, 'extract-structure.mjs'), [inputFile, outputFile])
      if (existsSync(outputFile)) {
        const extractResult = JSON.parse(readFileSync(outputFile, 'utf-8'))
        allExtractResults.push(extractResult)
        log(`  Batch ${batchIndex + 1}/${totalBatches}: ${extractResult.filesAnalyzed || 0} files`)
      }
    } catch (err) {
      log(`  [!] Batch ${batchIndex + 1} lỗi (bỏ qua): ${err.message.substring(0, 100)}`)
    }
  }

  log(`[Phase 3 ✓] Trích xuất xong ${allExtractResults.reduce((s, r) => s + (r.filesAnalyzed || 0), 0)} files`)

  // ─── PHASE 4: Build Knowledge Graph ─────────────────────────────────────
  log('[Phase 4/4] Đang xây dựng đồ thị tri thức và báo cáo kiến trúc...')
  
  const architectureInfo = detectArchitectureFromFiles(scanResult.files || [])
  const scores = computeScores(scanResult, allExtractResults, architectureInfo)
  
  const knowledgeGraph = buildKnowledgeGraph(projectId, scanResult, allExtractResults, architectureInfo)
  const architectureReport = buildArchitectureReport(scanResult, architectureInfo, scores)

  // Lưu kết quả
  const kgPath = join(uaDir, 'knowledge-graph.json')
  const archPath = join(uaDir, 'architecture-analysis.json')
  writeFileSync(kgPath, JSON.stringify(knowledgeGraph, null, 2))
  writeFileSync(archPath, JSON.stringify(architectureReport, null, 2))

  log(`[Phase 4 ✓] Đồ thị: ${knowledgeGraph.nodes.length} nodes, ${knowledgeGraph.edges.length} edges`)
  log(`[✓] Phân tích hoàn tất! Điểm tổng hợp: ${scores.overallScore}/100`)

  return {
    nodes: knowledgeGraph.nodes.length,
    edges: knowledgeGraph.edges.length,
    layers: knowledgeGraph.layers.length,
    architectureScore: scores.architectureScore,
    complexityScore: scores.complexityScore,
    cohesionScore: scores.cohesionScore,
    overallScore: scores.overallScore,
    stack: architectureInfo.stack,
    languages: Object.keys(scanResult.stats?.byLanguage || {}),
    totalFiles: scanResult.totalFiles || 0
  }
}
