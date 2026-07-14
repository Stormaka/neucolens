import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { projectStore } from '../data/projectStore'
import type { ProjectMeta } from '../data/projectStore'

export default function LecturerDashboard() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectMeta[]>(() => projectStore.getAll())
  const [savedToast, setSavedToast] = useState(false)

  // Sync khi có project mới (sinh viên upload)
  useEffect(() => {
    return projectStore.subscribe(() => {
      setProjects([...projectStore.getAll()])
    })
  }, [])

  const filtered = projects
    .filter(p => p.status !== 'error')
    .filter(p => filter === 'all' || p.reviewStatus === filter)
    .filter(p =>
      p.student.toLowerCase().includes(search.toLowerCase()) ||
      p.studentId.includes(search) ||
      p.name.toLowerCase().includes(search.toLowerCase())
    )

  const selectedProj = projects.find(p => p.id === selectedId) ?? null

  // Stats tính từ store thực
  const totalProjects = projects.filter(p => p.status !== 'error').length
  const pendingCount = projects.filter(p => p.reviewStatus === 'pending' && p.status === 'done').length
  const reviewedCount = projects.filter(p => p.reviewStatus === 'reviewed').length
  const scoredProjects = projects.filter(p => p.reviewScore > 0)
  const avgScore = scoredProjects.length > 0
    ? (scoredProjects.reduce((s, p) => s + p.reviewScore, 0) / scoredProjects.length).toFixed(1)
    : '—'

  const STATS_OVERVIEW = [
    { label: 'Tổng KLTN đã nộp', value: String(totalProjects), icon: '📁', color: '#60a5fa' },
    { label: 'Đang chờ review', value: String(pendingCount), icon: '⏳', color: '#fbbf24' },
    { label: 'Đã review xong', value: String(reviewedCount), icon: '✅', color: '#34d399' },
    { label: 'Điểm trung bình', value: String(avgScore), icon: '📊', color: '#a78bfa' },
  ]

  const handleSaveReview = (id: string, comment: string, score: number) => {
    projectStore.updateReview(id, comment, score)
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2500)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-root)' }}>
      <NavBar role="lecturer" userName="TS. Nguyễn Minh Đức" />

      {/* Toast thông báo lưu thành công */}
      {savedToast && (
        <div style={{
          position: 'fixed', top: '80px', right: '24px', zIndex: 999,
          background: '#34d399', color: '#000', padding: '12px 20px',
          borderRadius: 'var(--radius-md)', fontWeight: 600,
          boxShadow: '0 4px 20px rgba(52,211,153,0.4)',
          animation: 'fadeIn 0.3s ease',
        }}>
          ✅ Đã lưu nhận xét & điểm thành công!
        </div>
      )}

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

        <div style={{ display: 'grid', gridTemplateColumns: selectedProj ? '1fr 440px' : '1fr', gap: '24px' }}>
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
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '48px', textAlign: 'center' }}>
                          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔍</div>
                          <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '0.95rem' }}>
                            Không tìm thấy project nào
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm
                          </div>
                        </td>
                      </tr>
                    ) : filtered.map((proj, i) => (
                      <tr
                        key={proj.id}
                        style={{
                          borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                          transition: 'background 0.15s',
                          cursor: 'pointer',
                          background: selectedId === proj.id ? 'rgba(192,57,43,0.08)' : 'transparent',
                        }}
                        onMouseEnter={e => {
                          if (selectedId !== proj.id)
                            (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-glass)'
                        }}
                        onMouseLeave={e => {
                          if (selectedId !== proj.id)
                            (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                        }}
                        onClick={() => setSelectedId(selectedId === proj.id ? null : proj.id)}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{proj.student}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {proj.studentId}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', maxWidth: '200px' }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{proj.name}</div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                            {proj.lang}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {proj.analyzedAt}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {proj.status === 'done' ? (
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
                          <ReviewStatusBadge reviewStatus={proj.reviewStatus} score={proj.reviewScore} />
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={e => { e.stopPropagation(); navigate(`/project/${proj.id}?from=lecturer`) }}
                              disabled={proj.status !== 'done'}
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
              {/* key=selectedId đảm bảo khi chọn project khác, ReviewPanel mount lại từ đầu
                  → tránh lỗi nhận xét cũ bị copy sang project mới */}
              <ReviewPanel
                key={selectedProj.id}
                proj={selectedProj}
                onClose={() => setSelectedId(null)}
                onSave={handleSaveReview}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Badge trạng thái review ── */
function ReviewStatusBadge({ reviewStatus, score }: { reviewStatus: string; score: number }) {
  if (reviewStatus === 'reviewed') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span className="badge badge-green">✓ Đã review</span>
        {score > 0 && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Điểm: {score}/100
          </span>
        )}
      </div>
    )
  }
  return <span className="badge badge-yellow">⏳ Chờ review</span>
}

/* ── Review panel ── */
function ReviewPanel({
  proj,
  onClose,
  onSave,
}: {
  proj: ProjectMeta
  onClose: () => void
  onSave: (id: string, comment: string, score: number) => void
}) {
  const navigate = useNavigate()
  // Khởi tạo từ giá trị đã lưu trong store
  const [comment, setComment] = useState(proj.reviewComment)
  const [score, setScore] = useState<number | ''>(proj.reviewScore > 0 ? proj.reviewScore : '')
  const [scoreError, setScoreError] = useState('')

  const handleScoreChange = (val: string) => {
    if (val === '') { setScore(''); setScoreError(''); return }
    const num = Number(val)
    if (isNaN(num) || num < 0 || num > 100) {
      setScoreError('Điểm phải từ 0 đến 100')
    } else {
      setScoreError('')
    }
    setScore(val === '' ? '' : num)
  }

  const handleSave = () => {
    const numScore = score === '' ? 0 : Number(score)
    if (numScore < 0 || numScore > 100) { setScoreError('Điểm phải từ 0 đến 100'); return }
    if (!comment.trim()) return
    onSave(proj.id, comment, numScore)
  }

  const metrics = [
    { label: 'Kiến trúc', value: proj.score, color: '#60a5fa' },
    { label: 'Độ phức tạp', value: Math.max(0, proj.score - 4), color: '#a78bfa' },
    { label: 'Cohesion', value: Math.min(100, proj.score + 3), color: '#34d399' },
  ]

  const canSave = comment.trim().length > 0 && score !== '' && !scoreError

  return (
    <div className="glass-card" style={{ padding: '24px', position: 'sticky', top: '80px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{proj.student}</div>
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
        {proj.name}
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
            { v: proj.layers, l: 'Tầng', c: 'var(--node-service)' },
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
      {proj.layerNames.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Tầng kiến trúc:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {proj.layerNames.map(l => <span key={l} className="tag">{l}</span>)}
          </div>
        </div>
      )}

      {/* ── Cho điểm ── */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>
          ⭐ Điểm của giảng viên (0–100):
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="number"
            min={0}
            max={100}
            className="input"
            style={{
              width: '100px',
              fontSize: '1.2rem',
              fontWeight: 700,
              textAlign: 'center',
              borderColor: scoreError ? '#f87171' : undefined,
            }}
            placeholder="0–100"
            value={score}
            onChange={e => handleScoreChange(e.target.value)}
          />
          {score !== '' && !scoreError && (
            <div style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: Number(score) >= 85 ? '#34d399' : Number(score) >= 65 ? '#fbbf24' : '#f87171',
            }}>
              {Number(score) >= 85 ? '🌟 Xuất sắc' : Number(score) >= 75 ? '✅ Tốt' : Number(score) >= 65 ? '⚠️ Trung bình' : '❌ Yếu'}
            </div>
          )}
        </div>
        {scoreError && (
          <div style={{ fontSize: '0.8rem', color: '#f87171', marginTop: '4px' }}>{scoreError}</div>
        )}
        {proj.reviewedAt && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            Đã chấm lúc: {proj.reviewedAt}
          </div>
        )}
      </div>

      {/* ── Nhận xét ── */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>
          💬 Nhận xét của giảng viên:
        </div>
        <textarea
          className="input"
          rows={4}
          placeholder="Nhập nhận xét về kiến trúc, chất lượng code..."
          value={comment}
          onChange={e => setComment(e.target.value)}
          style={{ resize: 'vertical', minHeight: '90px' }}
        />
        {!comment.trim() && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            * Cần có nhận xét trước khi lưu
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
        <button
          className="btn btn-primary"
          style={{ justifyContent: 'center' }}
          onClick={() => navigate(`/project/${proj.id}?from=lecturer`)}
        >
          📊 Xem Knowledge Graph
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary btn-sm"
            style={{
              flex: 1, justifyContent: 'center',
              opacity: canSave ? 1 : 0.5,
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
            disabled={!canSave}
            onClick={handleSave}
          >
            💾 Lưu nhận xét & điểm
          </button>
          <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate(`/project/${proj.id}?tab=report&from=lecturer`)}>
            📄 Xuất báo cáo
          </button>
        </div>
      </div>
    </div>
  )
}
