import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import KnowledgeGraph from '../components/KnowledgeGraph'
import ArchitectureReport from '../components/ArchitectureReport'
import { SAMPLE_GRAPH } from '../data/sampleGraph'

type Tab = 'graph' | 'report' | 'tour' | 'layers'

export default function ProjectView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('graph')
  const [selectedNode, setSelectedNode] = useState<any>(null)

  const project = {
    id: id || 'proj-1',
    name: 'Hệ thống Quản lý Bán hàng Online',
    student: 'Nguyễn Văn An',
    studentId: '11201234',
    lang: 'Java · Spring Boot',
    analyzedAt: '2026-06-05 14:32',
    commit: 'a3f8b2c',
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-root)' }}>
      <NavBar role="student" userName={project.student} />

      {/* ── Sub-header ── */}
      <div style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
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
            onClick={() => navigate('/student')}
            style={{ padding: '6px 8px' }}
          >
            ← Quay lại
          </button>
          <div className="divider" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{project.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
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
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 16px',
                borderBottom: activeTab === tab.key
                  ? '2px solid var(--neu-red)'
                  : '2px solid transparent',
                background: 'transparent',
                color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '0.85rem',
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: 'pointer',
                border: 'none',
                transition: 'all 0.15s',
                fontFamily: 'var(--font-sans)',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate(`/chat/${id}`)}
          >
            💬 Hỏi về code
          </button>
          <button className="btn btn-secondary btn-sm">
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
                data={SAMPLE_GRAPH}
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
                <GraphSummaryPanel />
              )}
            </div>
          </>
        )}

        {activeTab === 'report' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
            <ArchitectureReport project={project} graph={SAMPLE_GRAPH} />
          </div>
        )}

        {activeTab === 'tour' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
            <GuidedTour tour={SAMPLE_GRAPH.tour} />
          </div>
        )}

        {activeTab === 'layers' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
            <LayersView layers={SAMPLE_GRAPH.layers} nodes={SAMPLE_GRAPH.nodes} />
          </div>
        )}
      </div>
    </div>
  )
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

function GraphSummaryPanel() {
  const items = [
    { icon: '🌐', label: 'Nodes', value: '87', desc: 'file, class, function, service' },
    { icon: '🔗', label: 'Edges', value: '134', desc: 'imports, calls, inherits...' },
    { icon: '🏗️', label: 'Tầng', value: '4', desc: 'Controller, Service, Repo, Entity' },
    { icon: '📚', label: 'Tour steps', value: '5', desc: 'hướng dẫn theo thứ tự học' },
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
