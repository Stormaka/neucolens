import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'

const SUBMISSIONS = [
  {
    id: 'proj-1',
    studentName: 'Nguyễn Văn An',
    studentId: '11201234',
    title: 'Hệ thống Quản lý Bán hàng Online',
    lang: 'Java · Spring Boot · MySQL',
    submittedAt: '2026-06-05 14:32',
    status: 'reviewed',
    score: 82,
    nodes: 87,
    edges: 134,
    layers: ['Controller', 'Service', 'Repository', 'Entity'],
    architectureScore: 82,
    complexityScore: 78,
    cohesionScore: 85,
    comment: 'Kiến trúc rõ ràng, phân tầng tốt. Cần bổ thêm unit test.',
    tags: ['spring-boot', 'rest-api', 'mysql'],
  },
  {
    id: 'proj-2',
    studentName: 'Trần Thị Bích',
    studentId: '11201567',
    title: 'Web App Quản lý Nhân sự',
    lang: 'Node.js · React · MongoDB',
    submittedAt: '2026-06-04 09:15',
    status: 'pending',
    score: 0,
    nodes: 63,
    edges: 91,
    layers: ['Frontend', 'API', 'Service', 'Database'],
    architectureScore: 75,
    complexityScore: 70,
    cohesionScore: 80,
    comment: '',
    tags: ['react', 'express', 'mongodb'],
  },
  {
    id: 'proj-3',
    studentName: 'Lê Minh Khoa',
    studentId: '11201890',
    title: 'App Đặt lịch Khám bệnh Trực tuyến',
    lang: 'Python · Django · PostgreSQL',
    submittedAt: '2026-06-06 11:00',
    status: 'analyzing',
    score: 0,
    nodes: 0,
    edges: 0,
    layers: [],
    architectureScore: 0,
    complexityScore: 0,
    cohesionScore: 0,
    comment: '',
    tags: ['django', 'postgresql'],
  },
  {
    id: 'proj-4',
    studentName: 'Phạm Thu Hương',
    studentId: '11202011',
    title: 'Hệ thống Gợi ý Sản phẩm bằng ML',
    lang: 'Python · Flask · scikit-learn',
    submittedAt: '2026-06-03 16:45',
    status: 'reviewed',
    score: 91,
    nodes: 55,
    edges: 78,
    layers: ['API', 'ML Pipeline', 'Data Processing', 'Storage'],
    architectureScore: 91,
    complexityScore: 88,
    cohesionScore: 93,
    comment: 'Xuất sắc! ML pipeline được thiết kế rất chuyên nghiệp.',
    tags: ['flask', 'sklearn', 'pandas'],
  },
]

const STATS_OVERVIEW = [
  { label: 'Tổng KLTN đã nộp', value: '24', icon: '📁', color: '#60a5fa' },
  { label: 'Đang chờ review', value: '7', icon: '⏳', color: '#fbbf24' },
  { label: 'Đã review xong', value: '15', icon: '✅', color: '#34d399' },
  { label: 'Điểm trung bình', value: '81.5', icon: '📊', color: '#a78bfa' },
]

export default function LecturerDashboard() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('all')
  const [selectedProj, setSelectedProj] = useState<typeof SUBMISSIONS[0] | null>(null)

  const filtered = SUBMISSIONS
    .filter(p => filter === 'all' || p.status === filter)
    .filter(p =>
      p.studentName.toLowerCase().includes(search.toLowerCase()) ||
      p.studentId.includes(search) ||
      p.title.toLowerCase().includes(search.toLowerCase())
    )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-root)' }}>
      <NavBar role="lecturer" userName="TS. Nguyễn Minh Đức" />

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '8px' }}>
            📋 Dashboard Giảng viên
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            TS. Nguyễn Minh Đức · Khoa CNTT · Học kỳ 2, 2025–2026
          </p>
        </div>

        {/* ── Stats ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}>
          {STATS_OVERVIEW.map(s => (
            <div key={s.label} className="glass-card" style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{
                width: 48, height: 48,
                background: `${s.color}20`,
                border: `1px solid ${s.color}40`,
                borderRadius: 'var(--radius-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem',
              }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selectedProj ? '1fr 420px' : '1fr', gap: '24px' }}>
          {/* ── Submission list ── */}
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <input
                className="input"
                style={{ maxWidth: '300px' }}
                placeholder="Tìm kiếm sinh viên, MSSV, tên đề tài..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <div className="tab-bar" style={{ maxWidth: '300px' }}>
                {(['all', 'pending', 'reviewed'] as const).map(f => (
                  <button
                    key={f}
                    className={`tab-item ${filter === f ? 'active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? 'Tất cả' : f === 'pending' ? 'Chờ review' : 'Đã review'}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {['Sinh viên', 'Đề tài KLTN', 'Ngôn ngữ', 'Nộp lúc', 'Graph', 'Trạng thái', 'Thao tác'].map(h => (
                        <th key={h} style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((proj, i) => (
                      <tr
                        key={proj.id}
                        style={{
                          borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                          transition: 'background 0.15s',
                          cursor: 'pointer',
                          background: selectedProj?.id === proj.id ? 'rgba(192,57,43,0.08)' : 'transparent',
                        }}
                        onMouseEnter={e => {
                          if (selectedProj?.id !== proj.id)
                            (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-glass)'
                        }}
                        onMouseLeave={e => {
                          if (selectedProj?.id !== proj.id)
                            (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                        }}
                        onClick={() => setSelectedProj(selectedProj?.id === proj.id ? null : proj)}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{proj.studentName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {proj.studentId}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', maxWidth: '200px' }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{proj.title}</div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                            {proj.lang}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {proj.submittedAt}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {proj.status !== 'analyzing' ? (
                            <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem' }}>
                              <span style={{ color: 'var(--node-file)' }}>{proj.nodes}N</span>
                              <span style={{ color: 'var(--text-muted)' }}>·</span>
                              <span style={{ color: 'var(--node-class)' }}>{proj.edges}E</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Đang phân tích...</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <StatusBadge status={proj.status} />
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={e => { e.stopPropagation(); navigate(`/project/${proj.id}`) }}
                              disabled={proj.status === 'analyzing'}
                              style={{ whiteSpace: 'nowrap' }}
                            >
                              📊 Graph
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Detail panel ── */}
          {selectedProj && (
            <div className="animate-slide-right">
              <ReviewPanel proj={selectedProj} onClose={() => setSelectedProj(null)} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    reviewed: { cls: 'badge-green', label: '✓ Đã review' },
    pending: { cls: 'badge-yellow', label: '⏳ Chờ review' },
    analyzing: { cls: 'badge-blue', label: '🔄 Đang phân tích' },
  }
  const s = map[status] ?? { cls: 'badge-red', label: status }
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}

function ReviewPanel({ proj, onClose }: { proj: typeof SUBMISSIONS[0]; onClose: () => void }) {
  const navigate = useNavigate()
  const [comment, setComment] = useState(proj.comment)

  const metrics = [
    { label: 'Kiến trúc', value: proj.architectureScore, color: '#60a5fa' },
    { label: 'Độ phức tạp', value: proj.complexityScore, color: '#a78bfa' },
    { label: 'Cohesion', value: proj.cohesionScore, color: '#34d399' },
  ]

  return (
    <div className="glass-card" style={{ padding: '24px', position: 'sticky', top: '80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{proj.studentName}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {proj.studentId}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>

      <div style={{
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-md)',
        padding: '12px',
        marginBottom: '20px',
        fontSize: '0.875rem',
        fontWeight: 500,
      }}>
        {proj.title}
      </div>

      {/* Metrics */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Phân tích Kiến trúc
        </div>
        {metrics.map(m => (
          <div key={m.label} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{m.label}</span>
              <span style={{ fontWeight: 600, color: m.color }}>{m.value}/100</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${m.value}%`, background: `linear-gradient(90deg, ${m.color}99, ${m.color})` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Graph info */}
      {proj.nodes > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: '8px', marginBottom: '20px',
        }}>
          {[
            { v: proj.nodes, l: 'Nodes', c: 'var(--node-file)' },
            { v: proj.edges, l: 'Edges', c: 'var(--node-class)' },
            { v: proj.layers.length, l: 'Tầng', c: 'var(--node-service)' },
          ].map(item => (
            <div key={item.l} style={{
              textAlign: 'center', background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)', padding: '10px',
            }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: item.c }}>{item.v}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Layers */}
      {proj.layers.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Tầng kiến trúc:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {proj.layers.map(l => <span key={l} className="tag">{l}</span>)}
          </div>
        </div>
      )}

      {/* Comment */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>
          Nhận xét của giảng viên:
        </div>
        <textarea
          className="input"
          rows={4}
          placeholder="Nhập nhận xét về kiến trúc, chất lượng code..."
          value={comment}
          onChange={e => setComment(e.target.value)}
          style={{ resize: 'vertical', minHeight: '80px' }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
        <button
          className="btn btn-primary"
          style={{ justifyContent: 'center' }}
          onClick={() => navigate(`/project/${proj.id}`)}
        >
          📊 Xem Knowledge Graph
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
            💾 Lưu nhận xét
          </button>
          <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
            📄 Xuất báo cáo
          </button>
        </div>
      </div>
    </div>
  )
}
