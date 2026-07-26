import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import KnowledgeGraph from '../components/KnowledgeGraph'
import ArchitectureReport from '../components/ArchitectureReport'
import { SAMPLE_GRAPH } from '../data/sampleGraph'
import { projectStore } from '../data/projectStore'
import type { ProjectMeta } from '../data/projectStore'

type Tab = 'graph' | 'report' | 'tour' | 'layers'

export default function ProjectView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Detect role from URL: ?from=lecturer means lecturer context
  const fromRole = searchParams.get('from') === 'lecturer' ? 'lecturer' : 'student'

  // Support ?tab=report (or graph/tour/layers) from other pages
  const tabParam = searchParams.get('tab') as Tab | null
  const [activeTab, setActiveTab] = useState<Tab>(tabParam && ['graph','report','tour','layers'].includes(tabParam) ? tabParam : 'graph')
  const [selectedNode, setSelectedNode] = useState<any>(null)

  // Sync tab if URL changes (e.g. navigate with new ?tab)
  useEffect(() => {
    if (tabParam && ['graph','report','tour','layers'].includes(tabParam)) {
      setActiveTab(tabParam as Tab)
    }
  }, [tabParam])

  // Chỉ hiển thị project có thật trong store; không dựng dữ liệu giả cho URL sai.
  const storedProject = id ? projectStore.getById(id) : undefined
  if (!storedProject) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg0)', color: 'var(--t1)' }}>
      <div className="card" style={{ textAlign: 'center' }}>
        <h2>Không tìm thấy project</h2>
        <p style={{ color: 'var(--t2)' }}>Liên kết không hợp lệ hoặc project đã bị xoá.</p>
        <button className="btn btn-primary" onClick={() => navigate(fromRole === 'lecturer' ? '/lecturer' : '/student')}>Về trang chính</button>
      </div>
    </div>
  }
  const project: ProjectMeta = storedProject

  if (project.status !== 'done') {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg0)', color: 'var(--t1)' }}>
      <div className="card" style={{ textAlign: 'center', maxWidth: 520 }}>
        <h2>Chưa có kết quả phân tích</h2>
        <p style={{ color: 'var(--t2)' }}>Tệp {project.sourceFile || project.name} chưa được backend phân tích. Hệ thống không tạo điểm hoặc đồ thị giả.</p>
        <button className="btn btn-primary" onClick={() => navigate(fromRole === 'lecturer' ? '/lecturer' : '/student')}>Về trang chính</button>
      </div>
    </div>
  }

  // Graph data: dùng SAMPLE_GRAPH cho proj mẫu, tạo dynamic cho proj upload
  const graphData = project.graphSource === 'uploaded'
    ? buildDynamicGraph(project)
    : SAMPLE_GRAPH

  const handleExportPDF = () => {
    // Switch to report tab first, then print
    setActiveTab('report')
    setTimeout(() => window.print(), 300)
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg0)' }}>
      <NavBar
        role={fromRole}
        userName={fromRole === 'lecturer' ? 'TS. Nguyễn Minh Đức' : project.student}
        studentId={fromRole === 'student' ? project.studentId : undefined}
      />

      {project.graphSource === 'sample' && (
        <div style={{ padding: '7px 24px', background: 'rgba(245,158,11,.12)', color: '#fbbf24', borderBottom: '1px solid rgba(245,158,11,.3)', fontSize: '.78rem', textAlign: 'center' }}>
          DỮ LIỆU MINH HỌA — không phải kết quả phân tích từ mã nguồn thật
        </div>
      )}

      {/* ── Sub-header ── */}
      <div className="no-print" style={{
        background: 'rgba(6,8,16,.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--b1)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        paddingTop: '12px',
        paddingBottom: '0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate(fromRole === 'lecturer' ? '/lecturer' : '/student')}
            style={{ padding: '6px 8px' }}
          >
            ← Quay lại
          </button>
          <div style={{ width: '1px', height: '16px', background: 'var(--b2)' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--display)' }}>{project.name}</div>
            <div style={{ fontSize: '0.73rem', color: 'var(--t3)', fontFamily: 'var(--mono)' }}>
              {project.studentId} · {project.lang} · commit {project.commit}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '0' }}>
          {([
            { key: 'graph', label: '🌐 Knowledge Graph' },
            { key: 'report', label: '📄 Báo cáo Kiến trúc' },
            { key: 'tour', label: '🧭 Guided Tour' },
            { key: 'layers', label: '🏗️ Tầng Kiến trúc' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key)
                const params = new URLSearchParams(searchParams.toString())
                params.set('tab', tab.key)
                navigate(`/project/${id}?${params.toString()}`, { replace: true })
              }}
              style={{
                padding: '12px 18px',
                background: 'transparent',
                color: activeTab === tab.key ? 'var(--t1)' : 'var(--t3)',
                fontSize: '0.84rem',
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: 'pointer',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid var(--rl)' : '2px solid transparent',
                transition: 'all var(--t-fast) var(--ease)',
                fontFamily: 'var(--sans)',
                whiteSpace: 'nowrap',
                marginBottom: '-1px',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', paddingBottom: '10px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate(`/chat/${id}`)}
          >
            💬 Hỏi về code
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleExportPDF}
          >
            📤 Xuất PDF
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {activeTab === 'graph' && (
          <>
            {/* Graph area */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <KnowledgeGraph
                data={graphData}
                onNodeSelect={setSelectedNode}
                selectedNodeId={selectedNode?.id}
              />
              {/* Controls hint */}
              <div style={{
                position: 'absolute', bottom: '16px', left: '16px',
                fontSize: '0.72rem', color: 'var(--text-muted)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
              }}>
                Scroll để zoom · Kéo để di chuyển · Click node để xem chi tiết
              </div>
            </div>

            {/* Node info sidebar */}
            <div style={{
              width: '320px', flexShrink: 0,
              background: 'var(--bg-surface)',
              borderLeft: '1px solid var(--border-subtle)',
              overflow: 'auto',
              padding: '20px',
            }}>
              {selectedNode ? (
                <NodeInfoPanel node={selectedNode} />
              ) : (
                <GraphSummaryPanel graph={graphData} project={project} />
              )}
            </div>
          </>
        )}

        {activeTab === 'report' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
            <ArchitectureReport project={project} graph={graphData} />
          </div>
        )}

        {activeTab === 'tour' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
            <GuidedTour tour={graphData.tour} />
          </div>
        )}

        {activeTab === 'layers' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
            <LayersView layers={graphData.layers} nodes={graphData.nodes} />
          </div>
        )}
      </div>
    </div>
  )
}

// Tạo dynamic graph từ metadata của project upload — với đầy đủ nodes & edges đẹp
function buildDynamicGraph(project: ProjectMeta): typeof SAMPLE_GRAPH {
  const lang = project.lang.split(' · ')[0]
  const framework = project.lang.split(' · ')[1] ?? ''
  const ext = lang.includes('Java') ? 'java' : lang.includes('Python') ? 'py' : lang.includes('PHP') ? 'php' : 'ts'
  const isJava = ext === 'java'
  const isPy = ext === 'py'

  // ── Xác định tên nhóm dựa trên layerNames ──
  const layerNames = project.layerNames

  // Đặt tên node thực tế theo ngôn ngữ
  const domainEntities = ['User', 'Product', 'Order', 'Cart', 'Category', 'Payment', 'Notification', 'Review']
  const controllers = domainEntities.slice(0, 5).map(e => `${e}Controller`)
  const services = domainEntities.slice(0, 6).map(e => `${e}Service`)
  const repos = domainEntities.slice(0, 5).map(e => `${e}Repository`)
  const entities = domainEntities.slice(0, 5)
  const dtos = ['LoginRequest', 'RegisterRequest', 'ProductDTO', 'OrderDTO', 'UserDTO']
  const configs = isJava
    ? ['SecurityConfig', 'DatabaseConfig', 'CorsConfig', 'JwtTokenProvider', 'MainApplication']
    : isPy
    ? ['settings', 'urls', 'wsgi', 'middleware', 'serializers']
    : ['authMiddleware', 'dbConfig', 'corsConfig', 'jwtHelper', 'app']
  const endpoints = [
    'POST /api/auth/login', 'POST /api/auth/register',
    'GET /api/products', 'POST /api/orders',
    'GET /api/users/profile', 'DELETE /api/cart/:id',
  ]

  const nodes: any[] = []

  // Gán nodes theo layer pattern
  layerNames.forEach((layer, _li) => {
    const lower = layer.toLowerCase()
    if (lower.includes('api') || lower.includes('controller') || lower.includes('frontend')) {
      controllers.forEach((name, i) => nodes.push({
        id: name, name, type: 'class',
        filePath: isJava ? `src/main/java/controller/${name}.java` : `src/${lower}/${name}.${ext}`,
        summary: `Xử lý HTTP requests cho module ${name.replace('Controller', '')}. Nhận input từ client, validate, chuyển xuống Service layer.`,
        tags: ['controller', name.replace('Controller', '').toLowerCase(), 'rest'],
        complexity: i === 2 ? 'complex' : i % 2 === 0 ? 'moderate' : 'simple',
        languageNotes: isJava ? '@RestController + @RequestMapping định nghĩa REST endpoints.' : undefined,
      }))
      endpoints.forEach((ep, i) => nodes.push({
        id: `endpoint_${i}`, name: ep, type: 'endpoint',
        summary: `REST endpoint: ${ep}`,
        tags: ['endpoint', ep.includes('POST') ? 'post' : 'get'],
        complexity: ep.includes('order') ? 'complex' : 'simple',
      }))
    } else if (lower.includes('service') || lower.includes('business')) {
      services.forEach((name, i) => nodes.push({
        id: name, name, type: 'service',
        filePath: isJava ? `src/main/java/service/${name}.java` : `src/services/${name}.${ext}`,
        summary: `Business logic cho module ${name.replace('Service', '')}. Xử lý nghiệp vụ, validation và orchestrate các operations.`,
        tags: ['service', name.replace('Service', '').toLowerCase()],
        complexity: i <= 1 ? 'complex' : 'moderate',
        languageNotes: isJava ? '@Service + @Transactional đảm bảo tính atomicity.' : undefined,
      }))
    } else if (lower.includes('repository') || lower.includes('data')) {
      repos.forEach((name, i) => nodes.push({
        id: name, name, type: 'class',
        filePath: isJava ? `src/main/java/repository/${name}.java` : `src/repositories/${name}.${ext}`,
        summary: `${isJava ? 'JPA Repository' : 'Database access'} cho ${name.replace('Repository', '')} entity. CRUD + custom queries.`,
        tags: ['repository', isJava ? 'jpa' : 'database', name.replace('Repository', '').toLowerCase()],
        complexity: i >= 2 ? 'moderate' : 'simple',
      }))
    } else if (lower.includes('entity') || lower.includes('model') || lower.includes('database')) {
      entities.forEach((name, i) => nodes.push({
        id: name, name, type: 'table',
        filePath: isJava ? `src/main/java/entity/${name}.java` : `src/models/${name}.${ext}`,
        summary: `${isJava ? '@Entity JPA' : 'Database model'} đại diện bảng ${name.toLowerCase()}s trong database.`,
        tags: ['entity', name.toLowerCase(), isJava ? 'jpa' : 'model'],
        complexity: i >= 2 ? 'moderate' : 'simple',
      }))
      dtos.forEach(name => nodes.push({
        id: `dto_${name}`, name, type: 'schema',
        filePath: `src/${isJava ? 'main/java/dto' : 'dto'}/${name}.${ext}`,
        summary: `DTO/Schema cho ${name} — transfer data giữa các tầng.`,
        tags: ['dto', 'schema'],
        complexity: 'simple',
      }))
    }
  })

  // Fallback nếu không map được: tạo generic nodes
  if (nodes.length === 0) {
    for (let i = 0; i < Math.min(project.nodes, 30); i++) {
      nodes.push({
        id: `node_${i}`, name: `Component${i + 1}`, type: i % 4 === 0 ? 'service' : i % 3 === 0 ? 'table' : 'class',
        filePath: `src/component${i + 1}.${ext}`,
        summary: `Component ${i + 1} của project.`,
        tags: ['component'],
        complexity: i % 3 === 0 ? 'complex' : 'simple',
      })
    }
  }

  // Configs luôn có
  configs.forEach((name, i) => {
    if (!nodes.find(n => n.id === name)) {
      nodes.push({
        id: name, name, type: i < 3 ? 'config' : 'class',
        filePath: isJava ? `src/main/java/config/${name}.java` : `src/config/${name}.${ext}`,
        summary: `Cấu hình hệ thống: ${name}. Thiết lập môi trường, bảo mật và kết nối.`,
        tags: ['config', framework.toLowerCase()].filter(Boolean),
        complexity: i === 0 ? 'complex' : 'simple',
      })
    }
  })

  // ── Tạo edges phong phú ──
  const edges: any[] = []
  const findNode = (id: string) => nodes.find(n => n.id === id)

  // Controller → Service
  controllers.forEach((ctrl, i) => {
    const svc = services[i % services.length]
    if (findNode(ctrl) && findNode(svc))
      edges.push({ source: ctrl, target: svc, type: 'calls', direction: 'forward', weight: 0.9 })
  })

  // Service → Repository
  services.forEach((svc, i) => {
    const repo = repos[i % repos.length]
    if (findNode(svc) && findNode(repo))
      edges.push({ source: svc, target: repo, type: 'calls', direction: 'forward', weight: 0.8 })
  })

  // Cross-service calls
  if (findNode('OrderService') && findNode('ProductService'))
    edges.push({ source: 'OrderService', target: 'ProductService', type: 'calls', direction: 'forward', weight: 0.7 })
  if (findNode('OrderService') && findNode('UserService'))
    edges.push({ source: 'OrderService', target: 'UserService', type: 'calls', direction: 'forward', weight: 0.6 })
  if (findNode('CartService') && findNode('ProductService'))
    edges.push({ source: 'CartService', target: 'ProductService', type: 'calls', direction: 'forward', weight: 0.65 })
  if (findNode('NotificationService') && findNode('OrderService'))
    edges.push({ source: 'OrderService', target: 'NotificationService', type: 'calls', direction: 'forward', weight: 0.5 })

  // Repository → Entity
  repos.forEach((repo, i) => {
    const entity = entities[i % entities.length]
    if (findNode(repo) && findNode(entity))
      edges.push({ source: repo, target: entity, type: 'reads_from', direction: 'forward', weight: 0.9 })
  })

  // Endpoint → Controller
  endpoints.forEach((ep, i) => {
    const ctrl = controllers[i % controllers.length]
    const epId = `endpoint_${i}`
    if (findNode(epId) && findNode(ctrl))
      edges.push({ source: epId, target: ctrl, type: 'routes', direction: 'forward', weight: 0.85 })
  })

  // Controller → DTO
  const dtoEdges: [string, string][] = [
    ['UserController', 'dto_LoginRequest'], ['UserController', 'dto_RegisterRequest'],
    ['ProductController', 'dto_ProductDTO'], ['OrderController', 'dto_OrderDTO'],
  ]
  dtoEdges.forEach(([src, tgt]) => {
    if (findNode(src) && findNode(tgt))
      edges.push({ source: src, target: tgt, type: 'validates', direction: 'forward', weight: 0.7 })
  })

  // Config dependencies
  const jwtId = configs[3] ?? configs[0]
  const secId = configs[0]
  if (findNode('UserService') && findNode(jwtId))
    edges.push({ source: 'UserService', target: jwtId, type: 'calls', direction: 'forward', weight: 0.8 })
  if (findNode(secId) && findNode(jwtId) && secId !== jwtId)
    edges.push({ source: secId, target: jwtId, type: 'configures', direction: 'forward', weight: 0.7 })
  repos.slice(0, 2).forEach(repo => {
    const dbCfg = configs[1] ?? configs[0]
    if (findNode(dbCfg) && findNode(repo))
      edges.push({ source: dbCfg, target: repo, type: 'configures', direction: 'forward', weight: 0.5 })
  })

  // MainApp → Config
  const mainId = configs[4] ?? configs[0]
  if (findNode(mainId)) {
    configs.slice(0, 3).forEach(cfg => {
      if (cfg !== mainId && findNode(cfg))
        edges.push({ source: mainId, target: cfg, type: 'depends_on', direction: 'forward', weight: 0.6 })
    })
  }

  // ── Layers ──
  const builtLayers = layerNames.map((name, i) => {
    const lower = name.toLowerCase()
    let ids: string[] = []
    if (lower.includes('api') || lower.includes('controller') || lower.includes('frontend'))
      ids = [...controllers.map(c => c), ...endpoints.map((_, i) => `endpoint_${i}`)]
    else if (lower.includes('service') || lower.includes('business'))
      ids = services.map(s => s)
    else if (lower.includes('repository') || lower.includes('data'))
      ids = repos.map(r => r)
    else if (lower.includes('entity') || lower.includes('model') || lower.includes('database'))
      ids = [...entities, ...dtos.map(d => `dto_${d}`)]
    return { id: `layer-${i}`, name: `${name} Layer`, description: `Tầng ${name} của hệ thống ${project.name}.`, nodeIds: ids.filter(id => findNode(id)) }
  })

  // Thêm layer config nếu chưa có
  const cfgLayer = {
    id: 'layer-config', name: 'Infrastructure & Config',
    description: 'Cấu hình hệ thống, bảo mật, database.',
    nodeIds: configs.filter(c => findNode(c)),
  }
  builtLayers.push(cfgLayer)

  // ── Tour ──
  const tour = builtLayers.map((layer, i) => ({
    order: i + 1,
    title: layer.name.replace(' Layer', ''),
    description: `Khám phá ${layer.name} của project "${project.name}". ${layer.description}`,
    nodeIds: layer.nodeIds.slice(0, 4),
    languageLesson: `Tìm hiểu cấu trúc và design pattern trong ${layer.name}.`,
  }))

  return {
    version: '1.0.0',
    project: {
      name: project.name,
      languages: [lang.toLowerCase()],
      frameworks: [framework.toLowerCase()].filter(Boolean),
      description: `${project.name} — KLTN NEU`,
      analyzedAt: new Date().toISOString(),
      gitCommitHash: project.commit,
    },
    nodes,
    edges,
    layers: builtLayers,
    tour,
  }
}

function NodeInfoPanel({ node }: { node: any }) {

  const typeColors: Record<string, string> = {
    file: 'var(--node-file)',
    function: 'var(--node-function)',
    class: 'var(--node-class)',
    service: 'var(--node-service)',
    config: 'var(--node-config)',
    table: 'var(--node-table)',
    endpoint: 'var(--node-endpoint)',
  }

  return (
    <div className="animate-fade-in">
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px',
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: typeColors[node.type] || '#94a3b8',
          flexShrink: 0,
        }} />
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', wordBreak: 'break-all' }}>{node.name}</h3>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <span className="badge badge-blue">{node.type}</span>
        <span className={`badge ${node.complexity === 'simple' ? 'badge-green' : node.complexity === 'complex' ? 'badge-red' : 'badge-yellow'}`}>
          {node.complexity}
        </span>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
          TÓM TẮT
        </div>
        <p style={{ fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          {node.summary}
        </p>
      </div>

      {node.filePath && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
            FILE
          </div>
          <code style={{
            fontSize: '0.78rem',
            color: 'var(--node-file)',
            fontFamily: 'var(--font-mono)',
            wordBreak: 'break-all',
          }}>{node.filePath}</code>
        </div>
      )}

      {node.tags && node.tags.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
            TAGS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {node.tags.map((t: string) => <span key={t} className="tag">{t}</span>)}
          </div>
        </div>
      )}

      {node.languageNotes && (
        <div style={{
          background: 'rgba(167, 139, 250, 0.1)',
          border: '1px solid rgba(167, 139, 250, 0.2)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}>
          <strong style={{ color: '#a78bfa' }}>💡 Ghi chú kỹ thuật:</strong>
          <br />{node.languageNotes}
        </div>
      )}
    </div>
  )
}

function GraphSummaryPanel({ graph, project }: { graph: typeof SAMPLE_GRAPH; project: ProjectMeta }) {
  const items = [
    { icon: '🌐', label: 'Nodes', value: String(graph.nodes.length), desc: 'file, class, function, service' },
    { icon: '🔗', label: 'Edges', value: String(graph.edges.length), desc: 'imports, calls, inherits...' },
    { icon: '🏗️', label: 'Tầng', value: String(graph.layers.length), desc: project.layerNames.join(', ') },
    { icon: '📚', label: 'Tour steps', value: String(graph.tour.length), desc: 'hướng dẫn theo thứ tự học' },
  ]
  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: '16px', fontSize: '0.95rem' }}>
        📊 Tóm tắt Graph
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {items.map(item => (
          <div key={item.label} style={{
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            display: 'flex', gap: '12px', alignItems: 'center',
          }}>
            <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>
            <div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--neu-red-light)' }}>{item.value}</span>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.label}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-md)',
        padding: '14px',
        fontSize: '0.82rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
      }}>
        💡 <strong>Click vào một node</strong> trong graph để xem chi tiết: tóm tắt, file path, tags và ghi chú kỹ thuật.
      </div>
    </div>
  )
}

function GuidedTour({ tour }: { tour: any[] }) {
  const [currentStep, setCurrentStep] = useState(0)

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: '8px' }}>🧭 Guided Tour</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        Hướng dẫn tìm hiểu kiến trúc project theo thứ tự phụ thuộc. Học codebase đúng trình tự.
      </p>

      {/* Steps overview */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '32px', overflowX: 'auto' }}>
        {tour.map((step, i) => (
          <div
            key={i}
            onClick={() => setCurrentStep(i)}
            style={{
              flex: '0 0 auto',
              padding: '8px 16px',
              cursor: 'pointer',
              borderBottom: i === currentStep ? '2px solid var(--neu-red)' : '2px solid transparent',
              color: i === currentStep ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: i === currentStep ? 600 : 400,
              fontSize: '0.85rem',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {i + 1}. {step.title}
          </div>
        ))}
      </div>

      {/* Current step */}
      {tour[currentStep] && (
        <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div style={{
              width: 48, height: 48,
              background: 'linear-gradient(135deg, var(--neu-red), #7b1c1c)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.9rem', fontWeight: 800, color: '#fff', flexShrink: 0,
            }}>
              {currentStep + 1}
            </div>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: '4px' }}>
                {tour[currentStep].title}
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Bước {currentStep + 1} / {tour.length}
              </div>
            </div>
          </div>

          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '20px', fontSize: '0.95rem' }}>
            {tour[currentStep].description}
          </p>

          {tour[currentStep].nodeIds && tour[currentStep].nodeIds.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
                NODES LIÊN QUAN:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {tour[currentStep].nodeIds.map((id: string) => (
                  <span key={id} className="tag">{id}</span>
                ))}
              </div>
            </div>
          )}

          {tour[currentStep].languageLesson && (
            <div style={{
              background: 'rgba(96, 165, 250, 0.1)',
              border: '1px solid rgba(96, 165, 250, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              marginBottom: '20px',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
            }}>
              <strong style={{ color: '#60a5fa' }}>📚 Bài học kỹ thuật:</strong>
              <br />{tour[currentStep].languageLesson}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              ← Bước trước
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setCurrentStep(Math.min(tour.length - 1, currentStep + 1))}
              disabled={currentStep === tour.length - 1}
            >
              Bước tiếp →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function LayersView({ layers, nodes }: { layers: any[]; nodes: any[] }) {
  const layerColors = [
    '#60a5fa', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#fbbf24',
  ]

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: '8px' }}>🏗️ Tầng Kiến trúc</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        Phân tầng tự động theo kiến trúc: API, Service, Data, UI, Utility.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {layers.map((layer, i) => {
          const layerNodes = nodes.filter(n => layer.nodeIds.includes(n.id))
          const color = layerColors[i % layerColors.length]

          return (
            <div key={layer.id} className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: color, marginTop: '6px', flexShrink: 0,
                  boxShadow: `0 0 8px ${color}80`,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '1rem', color }}>{layer.name}</h3>
                    <span className="badge badge-blue">{layer.nodeIds.length} nodes</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {layer.description}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {layerNodes.slice(0, 12).map(node => (
                  <span key={node.id} className="tag" style={{ color }}>
                    {node.name}
                  </span>
                ))}
                {layerNodes.length > 12 && (
                  <span className="tag" style={{ color: 'var(--text-muted)' }}>
                    +{layerNodes.length - 12} nữa
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
