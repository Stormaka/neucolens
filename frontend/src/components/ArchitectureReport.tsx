interface Props {
  project: {
    name: string
    student: string
    studentId: string
    lang: string
    analyzedAt: string
    commit: string
  }
  graph: {
    nodes: any[]
    edges: any[]
    layers: any[]
    tour: any[]
    project: any
  }
}

export default function ArchitectureReport({ project, graph }: Props) {
  const stats = {
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    layers: graph.layers.length,
    files: graph.nodes.filter(n => n.type === 'file').length,
    classes: graph.nodes.filter(n => n.type === 'class').length,
    functions: graph.nodes.filter(n => n.type === 'function').length,
    services: graph.nodes.filter(n => n.type === 'service').length,
    endpoints: graph.nodes.filter(n => n.type === 'endpoint').length,
    complex: graph.nodes.filter(n => n.complexity === 'complex').length,
    moderate: graph.nodes.filter(n => n.complexity === 'moderate').length,
    simple: graph.nodes.filter(n => n.complexity === 'simple').length,
  }

  const edgeTypes = graph.edges.reduce((acc: Record<string, number>, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1
    return acc
  }, {})

  const topEdgeTypes = (Object.entries(edgeTypes) as [string, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const allTags = graph.nodes.flatMap((n: any) => n.tags || [])
  const tagCounts = allTags.reduce((acc: Record<string, number>, t: string) => {
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {})
  const topTags = (Object.entries(tagCounts) as [string, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(192,57,43,0.12), rgba(10,11,14,0))',
        border: '1px solid rgba(192,57,43,0.2)',
        borderRadius: 'var(--radius-xl)',
        padding: '32px',
        marginBottom: '32px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '6px', textTransform: 'uppercase' }}>
              Báo cáo Kiến trúc · NEU CodeLens
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '4px' }}>{project.name}</h1>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {project.student} · MSSV: {project.studentId} · {project.lang}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Phân tích lúc</div>
            <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{project.analyzedAt}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              commit: {project.commit}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
            🖨️ In báo cáo
          </button>
          <button className="btn btn-secondary btn-sm">
            📤 Xuất PDF
          </button>
          <button className="btn btn-secondary btn-sm">
            📋 Copy link
          </button>
        </div>
      </div>

      {/* Overview metrics */}
      <SectionTitle>1. Tổng quan Project</SectionTitle>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '12px',
        marginBottom: '32px',
      }}>
        {[
          { label: 'Tổng Nodes', value: stats.totalNodes, color: '#60a5fa', icon: '⬡' },
          { label: 'Tổng Edges', value: stats.totalEdges, color: '#a78bfa', icon: '⟶' },
          { label: 'Tầng KT', value: stats.layers, color: '#34d399', icon: '🏗️' },
          { label: 'Files', value: stats.files, color: '#fb923c', icon: '📄' },
          { label: 'Classes', value: stats.classes, color: '#34d399', icon: '🧩' },
          { label: 'Functions', value: stats.functions, color: '#a78bfa', icon: 'ƒ' },
          { label: 'Services', value: stats.services, color: '#fb923c', icon: '⚙️' },
          { label: 'Endpoints', value: stats.endpoints, color: '#fbbf24', icon: '🔌' },
        ].map(m => (
          <div key={m.label} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.4rem', marginBottom: '2px' }}>{m.icon}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Complexity distribution */}
      <SectionTitle>2. Phân bố Độ phức tạp</SectionTitle>
      <div className="glass-card" style={{ padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          {[
            { label: 'Simple', value: stats.simple, total: stats.totalNodes, color: '#34d399' },
            { label: 'Moderate', value: stats.moderate, total: stats.totalNodes, color: '#fbbf24' },
            { label: 'Complex', value: stats.complex, total: stats.totalNodes, color: '#f87171' },
          ].map(c => (
            <div key={c.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{c.label}</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{
                  width: `${(c.value / c.total) * 100}%`,
                  background: `linear-gradient(90deg, ${c.color}80, ${c.color})`,
                }} />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {Math.round((c.value / c.total) * 100)}%
              </div>
            </div>
          ))}
        </div>
        <div style={{
          background: 'rgba(251,191,36,0.1)',
          border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
        }}>
          ⚠️ Có <strong style={{ color: '#f87171' }}>{stats.complex} modules phức tạp</strong> — nên review kỹ các module này và xem xét refactoring nếu cần.
        </div>
      </div>

      {/* Architecture layers */}
      <SectionTitle>3. Kiến trúc Tầng (Layered Architecture)</SectionTitle>
      <div style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {graph.layers.map((layer: any, i: number) => {
          const colors = ['#60a5fa', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#fbbf24']
          const color = colors[i % colors.length]
          const percent = Math.round((layer.nodeIds.length / stats.totalNodes) * 100)
          return (
            <div key={layer.id} className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                  <strong style={{ color }}>{layer.name}</strong>
                </div>
                <span className="badge badge-blue">{layer.nodeIds.length} nodes · {percent}%</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.6 }}>
                {layer.description}
              </p>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${color}60, ${color})` }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Edge types */}
      <SectionTitle>4. Phân tích Quan hệ (Edge Types)</SectionTitle>
      <div className="glass-card" style={{ padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {topEdgeTypes.map(([type, count]) => (
            <div key={type} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '10px 14px',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {type}
              </span>
              <span style={{ fontWeight: 700, color: 'var(--node-file)' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tags cloud */}
      <SectionTitle>5. Công nghệ & Patterns</SectionTitle>
      <div className="glass-card" style={{ padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {topTags.map(([tag, count]) => (
            <div key={tag} style={{
              padding: '6px 14px',
              background: `rgba(96,165,250,${Math.min(0.3, count * 0.05)})`,
              border: '1px solid rgba(96,165,250,0.25)',
              borderRadius: '999px',
              fontSize: `${Math.max(0.75, Math.min(1.1, 0.75 + count * 0.05))}rem`,
              color: '#60a5fa',
              fontFamily: 'var(--font-mono)',
            }}>
              {tag} <span style={{ opacity: 0.6, fontSize: '0.75em' }}>×{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <SectionTitle>6. Khuyến nghị cải thiện</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
        {[
          {
            level: 'warning',
            title: 'Thêm Unit Tests',
            desc: 'Phát hiện ít test files. Nên thêm JUnit/Mockito tests cho Service layer để đảm bảo chất lượng.',
          },
          {
            level: 'info',
            title: 'Documentation',
            desc: 'Bổ sung Swagger/OpenAPI documentation cho REST endpoints để dễ maintain và review.',
          },
          {
            level: 'success',
            title: 'Phân tầng tốt',
            desc: 'Kiến trúc Controller → Service → Repository được áp dụng đúng cách. Tuân thủ nguyên tắc SRP.',
          },
        ].map(r => {
          const colors = { warning: '#fbbf24', info: '#60a5fa', success: '#34d399' }
          const icons = { warning: '⚠️', info: 'ℹ️', success: '✓' }
          const color = colors[r.level as keyof typeof colors]
          return (
            <div key={r.title} style={{
              display: 'flex', gap: '14px',
              background: `rgba(${r.level === 'success' ? '52,211,153' : r.level === 'warning' ? '251,191,36' : '96,165,250'},0.07)`,
              border: `1px solid ${color}30`,
              borderRadius: 'var(--radius-md)',
              padding: '16px',
            }}>
              <span style={{ fontSize: '1.2rem' }}>{icons[r.level as keyof typeof icons]}</span>
              <div>
                <strong style={{ color, fontSize: '0.9rem' }}>{r.title}</strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.6 }}>
                  {r.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        padding: '24px',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
      }}>
        Báo cáo được tạo tự động bởi <strong>NEU CodeLens</strong> · Powered by Understand-Anything
        <br />
        Đại học Kinh tế Quốc dân · Khoa CNTT · {new Date().getFullYear()}
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: '1rem',
      fontWeight: 700,
      color: 'var(--text-secondary)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: '16px',
      paddingBottom: '8px',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      {children}
    </h2>
  )
}
