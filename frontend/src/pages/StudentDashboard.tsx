import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import UploadZone from '../components/UploadZone'
import { projectStore, buildProjectFromZip } from '../data/projectStore'
import type { ProjectMeta } from '../data/projectStore'


export default function StudentDashboard() {
  const navigate = useNavigate()
  const [showUpload, setShowUpload] = useState(false)
  const [activeTab, setActiveTab] = useState<'projects' | 'chat'>('projects')
  const [projects, setProjects] = useState<ProjectMeta[]>(() => projectStore.getAll())

  // Sync với store khi có project mới
  useEffect(() => {
    return projectStore.subscribe(() => {
      setProjects([...projectStore.getAll()])
    })
  }, [])

  const firstDoneProject = projects.find(p => p.status === 'done')

  const handleUpload = (fileOrUrl: File | string) => {
    let newProject: ProjectMeta
    if (fileOrUrl instanceof File) {
      newProject = buildProjectFromZip(fileOrUrl.name)
    } else {
      // GitHub URL — lấy tên repo từ URL
      const repoName = (fileOrUrl as string).split('/').pop() || 'my-project'
      newProject = buildProjectFromZip(repoName)
    }
    projectStore.addProject(newProject)
    setTimeout(() => {
      setShowUpload(false)
      navigate(`/project/${newProject.id}`)
    }, 500)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-root)' }}>
      <NavBar role="student" userName="Nguyễn Văn An" studentId="11201234" />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Welcome banner ── */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(192,57,43,0.15), rgba(146,43,33,0.08))',
          border: '1px solid rgba(192,57,43,0.25)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px',
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '6px' }}>
              Chào mừng, Văn An 👋
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Mã SV: 11201234 · Khoa CNTT · KLTN 2025–2026
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn btn-primary"
              onClick={() => setShowUpload(true)}
            >
              + Upload Project Mới
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => firstDoneProject && navigate(`/chat/${firstDoneProject.id}`)}
              disabled={!firstDoneProject}
            >
              💬 Hỏi về Code
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="tab-bar" style={{ marginBottom: '24px', maxWidth: '400px' }}>
          <button
            className={`tab-item ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            📁 Đồ án của tôi
          </button>
          <button
            className={`tab-item ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            💬 Hỏi về Code
          </button>
        </div>

        {activeTab === 'projects' && (
          <>
            {/* ── Project list ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
              {projects.map((proj) => (
                <ProjectCard key={proj.id} project={proj} onOpen={() => navigate(`/project/${proj.id}`)} />
              ))}

              {/* Upload card */}
              <div
                className="glass-card"
                style={{
                  padding: '32px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: '16px', cursor: 'pointer',
                  border: '2px dashed var(--border-medium)',
                  minHeight: '220px',
                  background: 'transparent',
                  transition: 'all 0.3s',
                }}
                onClick={() => setShowUpload(true)}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--neu-red)'
                  ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(192,57,43,0.05)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-medium)'
                  ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
                }}
              >
                <div style={{
                  width: 56, height: 56,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px',
                }}>+</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Upload Project Mới</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Kéo thả .zip hoặc dán link GitHub
                  </div>
                </div>
              </div>
            </div>

            {/* ── Usage tips ── */}
            <div style={{ marginTop: '40px' }}>
              <h2 style={{ fontWeight: 700, marginBottom: '16px', fontSize: '1.1rem' }}>
                💡 Gợi ý sử dụng
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {[
                  { icon: '📊', title: 'Xem Knowledge Graph', desc: 'Nhấp vào project → "Xem Graph" để khám phá kiến trúc hệ thống của bạn.' },
                  { icon: '💬', title: 'Hỏi về Code', desc: 'Dùng tab "Hỏi về Code" để đặt câu hỏi về project bằng tiếng Việt.' },
                  { icon: '📄', title: 'Báo cáo Kiến trúc', desc: 'Tạo báo cáo tự động để nộp kèm theo KLTN cho giảng viên.' },
                ].map(tip => (
                  <div key={tip.title} style={{
                    display: 'flex', gap: '16px',
                    padding: '16px',
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                  }}>
                    <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{tip.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>{tip.title}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{tip.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'chat' && (
          <div style={{ maxWidth: '700px' }}>
            <div className="glass-card" style={{ padding: '28px', marginBottom: '20px' }}>
              <h2 style={{ fontWeight: 700, marginBottom: '8px', fontSize: '1.1rem' }}>
                💬 Hỏi về Code của bạn
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '20px' }}>
                Chọn project và đặt câu hỏi. AI sẽ trả lời dựa trên knowledge graph đã phân tích.
              </p>
              <select
                className="input"
                style={{ marginBottom: '16px' }}
                id="chat-project-select"
              >
                {projects.filter(p => p.status === 'done').map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.lang})</option>
                ))}
              </select>
              <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Câu hỏi gợi ý:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {[
                  'Kiến trúc tổng thể của project này là gì?',
                  'Luồng xử lý đăng nhập hoạt động như thế nào?',
                  'Module nào phức tạp nhất trong project?',
                  'Service layer được tổ chức ra sao?',
                  'Có những design pattern nào được sử dụng?',
                  'Cách kết nối database được xử lý như thế nào?',
                ].map(q => (
                  <button
                    key={q}
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const sel = document.getElementById('chat-project-select') as HTMLSelectElement
                      const pid = sel?.value || firstDoneProject?.id || 'proj-1'
                      navigate(`/chat/${pid}`)
                    }}
                    style={{ fontSize: '0.8rem', textAlign: 'left' }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => {
                const sel = document.getElementById('chat-project-select') as HTMLSelectElement
                const pid = sel?.value || firstDoneProject?.id || 'proj-1'
                navigate(`/chat/${pid}`)
              }}
            >
              💬 Mở giao diện Chat
            </button>
          </div>
        )}
      </div>

      {/* ── Upload Modal ── */}
      {showUpload && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
            padding: '24px',
          }}
          onClick={() => setShowUpload(false)}
        >
          <div
            className="glass-card animate-fade-in"
            style={{ width: '100%', maxWidth: '600px', padding: '40px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: '1.3rem', marginBottom: '4px' }}>
                  Upload Project
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Hỗ trợ .zip hoặc GitHub repository URL
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowUpload(false)}
              >✕</button>
            </div>
            <UploadZone onUpload={handleUpload} />
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Project card ── */
function ProjectCard({ project, onOpen }: { project: ProjectMeta; onOpen: () => void }) {
  const statusColors = { done: '#34d399', processing: '#60a5fa', error: '#f87171' }
  const statusLabels = { done: 'Hoàn thành', processing: 'Đang phân tích...', error: 'Lỗi' }

  return (
    <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>{project.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {project.lang}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div className={`status-dot ${project.status === 'done' ? 'success' : project.status === 'processing' ? 'processing' : 'error'}`} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {statusLabels[project.status as keyof typeof statusLabels]}
          </span>
        </div>
      </div>

      {project.status === 'done' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--node-file)' }}>{project.nodes}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nodes</div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--node-class)' }}>{project.edges}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Edges</div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Kiến trúc tầng:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {project.layerNames.map(l => <span key={l} className="tag">{l}</span>)}
            </div>
          </div>

          {/* Score */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Điểm kiến trúc</span>
              <span style={{ fontWeight: 600, color: project.score >= 80 ? '#34d399' : '#fbbf24' }}>
                {project.score}/100
              </span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${project.score}%` }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {project.tags.map(t => <span key={t} className="badge badge-blue">{t}</span>)}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px 0' }}>
          <div className="spinner" style={{ width: '32px', height: '32px' }} />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Đang phân tích codebase...
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
        <button
          className="btn btn-primary btn-sm"
          style={{ flex: 1, justifyContent: 'center' }}
          onClick={onOpen}
          disabled={project.status !== 'done'}
        >
          📊 Xem Graph
        </button>
        <button
          className="btn btn-secondary btn-sm"
          style={{ flex: 1, justifyContent: 'center' }}
          disabled={project.status !== 'done'}
        >
          📄 Báo cáo
        </button>
      </div>
    </div>
  )
}
