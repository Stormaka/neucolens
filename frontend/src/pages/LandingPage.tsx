import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const FEATURES = [
  {
    icon: '🧠',
    title: 'Knowledge Graph Tự Động',
    desc: 'Upload project — hệ thống phân tích toàn bộ codebase và sinh knowledge graph tương tác trong vài phút.',
  },
  {
    icon: '🏗️',
    title: 'Báo Cáo Kiến Trúc',
    desc: 'Tự động nhận dạng các tầng kiến trúc (UI, API, Service, Data) và sinh báo cáo chi tiết cho giảng viên.',
  },
  {
    icon: '💬',
    title: '/understand-chat',
    desc: 'Sinh viên hỏi về code của chính mình bằng tiếng Việt. AI trả lời dựa trên context thực tế của project.',
  },
  {
    icon: '👨‍🏫',
    title: 'Review Nhanh Cho GV',
    desc: 'Giảng viên xem knowledge graph thay vì đọc code từng dòng. Tiết kiệm 80% thời gian review.',
  },
  {
    icon: '🔍',
    title: 'Phân Tích Đa Ngôn Ngữ',
    desc: 'Hỗ trợ Java, Python, JavaScript/TypeScript, C#, PHP — các ngôn ngữ phổ biến trong KLTN NEU.',
  },
  {
    icon: '📊',
    title: 'So Sánh Kiến Trúc',
    desc: 'Giảng viên so sánh kiến trúc giữa các KLTN, phát hiện điểm mạnh/yếu nhanh chóng.',
  },
]

const STATS = [
  { value: '3 phút', label: 'Thời gian phân tích trung bình' },
  { value: '80%', label: 'Giảm thời gian review cho GV' },
  { value: '12+', label: 'Ngôn ngữ lập trình hỗ trợ' },
  { value: '100%', label: 'Dữ liệu bảo mật nội bộ NEU' },
]

const HOW_IT_WORKS = [
  { step: '01', title: 'Upload Project', desc: 'Sinh viên nén project thành .zip hoặc dán link GitHub và upload lên hệ thống.' },
  { step: '02', title: 'Phân Tích Tự Động', desc: 'Understand-Anything quét toàn bộ codebase, trích xuất file, hàm, class, import/export và phụ thuộc.' },
  { step: '03', title: 'Sinh Knowledge Graph', desc: 'Pipeline đa agent tạo ra knowledge graph dạng JSON với nodes, edges, architectural layers và guided tour.' },
  { step: '04', title: 'Dashboard Tương Tác', desc: 'Sinh viên và giảng viên khám phá graph qua dashboard web — zoom, tìm kiếm, click node để xem chi tiết.' },
  { step: '05', title: 'Chat Về Code', desc: 'Dùng /understand-chat để hỏi về logic của chính mình. AI trả lời dựa trên graph đã phân tích.' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState<'student' | 'lecturer' | null>(null)

  return (
    <div className="noise-bg" style={{ minHeight: '100vh', background: 'var(--bg-root)' }}>
      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10, 11, 14, 0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 2rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '64px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 36, height: 36,
            background: 'linear-gradient(135deg, var(--neu-red), #7b1c1c)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: 800, color: '#fff',
            boxShadow: '0 0 20px var(--neu-red-glow)',
          }}>N</div>
          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
            NEU <span style={{ color: 'var(--neu-red-light)' }}>CodeLens</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Đại học Kinh tế Quốc dân</span>
          <button className="btn btn-primary btn-sm" onClick={() => setRole('student')}>
            Đăng nhập
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        padding: '100px 2rem 80px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
          width: '600px', height: '300px',
          background: 'radial-gradient(ellipse, rgba(192,57,43,0.2) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div className="animate-fade-in" style={{ position: 'relative', zIndex: 1 }}>
          <div className="badge badge-red" style={{ marginBottom: '24px', display: 'inline-flex' }}>
            🎓 Dành cho sinh viên CNTT · Toán Tin · HTTT — NEU
          </div>

          <h1 style={{
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: '24px',
            letterSpacing: '-0.02em',
          }}>
            Hiểu Đồ án của bạn<br />
            <span className="neu-text-gradient">sâu hơn, nhanh hơn.</span>
          </h1>

          <p style={{
            fontSize: '1.2rem',
            color: 'var(--text-secondary)',
            maxWidth: '640px',
            margin: '0 auto 40px',
            lineHeight: 1.7,
          }}>
            Sinh viên upload project — hệ thống tự động phân tích codebase,
            sinh <strong style={{ color: 'var(--text-primary)' }}>knowledge graph</strong> và{' '}
            <strong style={{ color: 'var(--text-primary)' }}>báo cáo kiến trúc</strong>.
            Giảng viên review KLTN nhanh hơn 80%.
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-lg animate-pulse-glow"
              onClick={() => navigate('/student')}
            >
              🎓 Tôi là Sinh viên
            </button>
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => navigate('/lecturer')}
            >
              👨‍🏫 Tôi là Giảng viên
            </button>
          </div>
        </div>

        {/* Floating graph preview */}
        <div className="animate-float" style={{
          marginTop: '60px',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <MiniGraphPreview />
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{
        padding: '40px 2rem',
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
      }}>
        <div style={{
          maxWidth: '900px', margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '32px', textAlign: 'center',
        }}>
          {STATS.map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--neu-red-light)', marginBottom: '4px' }}>
                {s.value}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '80px 2rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '12px' }}>
              Tính năng nổi bật
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Được xây dựng trên nền tảng Understand-Anything — pipeline đa agent phân tích codebase chuyên sâu.
            </p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
          }}>
            {FEATURES.map((f) => (
              <div key={f.title} className="glass-card" style={{ padding: '28px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>{f.icon}</div>
                <h3 style={{ fontWeight: 700, marginBottom: '8px', fontSize: '1.05rem' }}>{f.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{
        padding: '80px 2rem',
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '48px', textAlign: 'center' }}>
            Quy trình hoạt động
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.step} style={{
                display: 'flex', gap: '24px', alignItems: 'flex-start',
                paddingBottom: i < HOW_IT_WORKS.length - 1 ? '40px' : '0',
                position: 'relative',
              }}>
                {/* Connector line */}
                {i < HOW_IT_WORKS.length - 1 && (
                  <div style={{
                    position: 'absolute',
                    left: '23px', top: '52px',
                    width: '2px',
                    height: 'calc(100% - 12px)',
                    background: 'linear-gradient(180deg, var(--neu-red) 0%, transparent 100%)',
                    opacity: 0.4,
                  }} />
                )}
                <div style={{
                  width: '48px', height: '48px',
                  background: 'linear-gradient(135deg, var(--neu-red), #7b1c1c)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 800, color: '#fff',
                  flexShrink: 0,
                  boxShadow: '0 0 16px var(--neu-red-glow)',
                  zIndex: 1,
                }}>
                  {step.step}
                </div>
                <div style={{ paddingTop: '10px' }}>
                  <h3 style={{ fontWeight: 700, marginBottom: '6px' }}>{step.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '80px 2rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '16px' }}>
            Sẵn sàng bắt đầu?
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
            Đăng nhập bằng tài khoản NEU của bạn và upload đồ án đầu tiên ngay hôm nay.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/student')}>
              🚀 Bắt đầu với tư cách Sinh viên
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => navigate('/lecturer')}>
              📋 Xem Dashboard Giảng viên
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '32px 2rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.85rem',
      }}>
        <div style={{ marginBottom: '8px' }}>
          <strong style={{ color: 'var(--text-secondary)' }}>NEU CodeLens</strong> — Hệ thống Hỗ trợ Đồ án / KLTN
        </div>
        <div>
          Đại học Kinh tế Quốc dân (NEU) · Khoa CNTT · Powered by{' '}
          <a href="https://github.com/Lum1104/Understand-Anything" target="_blank" rel="noopener noreferrer">
            Understand-Anything
          </a>
        </div>
      </footer>

      {/* ── Login Modal ── */}
      {role && (
        <LoginModal role={role} onClose={() => setRole(null)} />
      )}
    </div>
  )
}

/* ── Mini Graph SVG preview ── */
function MiniGraphPreview() {
  const nodes = [
    { x: 300, y: 80, r: 14, color: '#60a5fa', label: 'AuthService' },
    { x: 160, y: 180, r: 10, color: '#a78bfa', label: 'login()' },
    { x: 300, y: 200, r: 12, color: '#34d399', label: 'UserController' },
    { x: 460, y: 170, r: 10, color: '#fb923c', label: 'JWT Utils' },
    { x: 100, y: 290, r: 9, color: '#94a3b8', label: 'config.ts' },
    { x: 220, y: 310, r: 11, color: '#f472b6', label: 'UserModel' },
    { x: 380, y: 300, r: 10, color: '#fbbf24', label: '/api/auth' },
    { x: 500, y: 280, r: 9, color: '#60a5fa', label: 'Database' },
  ]
  const edges = [
    [0, 1], [0, 2], [0, 3], [2, 5], [2, 6], [3, 0], [1, 4], [6, 7], [5, 7],
  ]

  return (
    <div style={{
      width: '600px', maxWidth: '100%',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      padding: '16px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 60px rgba(192,57,43,0.1)',
    }}>
      <div style={{
        display: 'flex', gap: '8px', marginBottom: '12px',
      }}>
        {['#ef4444','#f59e0b','#22c55e'].map(c => (
          <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
        ))}
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
          knowledge-graph.json — Project: thesis-ecommerce
        </span>
      </div>
      <svg viewBox="0 0 600 380" style={{ width: '100%', height: '280px' }}>
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="600" height="380" fill="url(#grid)" />
        {/* Edges */}
        {edges.map(([a, b], i) => (
          <line key={i}
            x1={nodes[a].x} y1={nodes[a].y}
            x2={nodes[b].x} y2={nodes[b].y}
            stroke="rgba(255,255,255,0.1)" strokeWidth="1.5"
          />
        ))}
        {/* Nodes */}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={n.r + 6} fill={n.color} opacity="0.1" />
            <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} opacity="0.9" />
            <text x={n.x} y={n.y + n.r + 14} textAnchor="middle"
              style={{ fontSize: '9px', fill: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif' }}>
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

/* ── Login Modal ── */
function LoginModal({ role, onClose }: { role: 'student' | 'lecturer'; onClose: () => void }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    navigate(role === 'student' ? '/student' : '/lecturer')
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        className="glass-card animate-fade-in"
        style={{ width: '400px', padding: '40px' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ fontWeight: 700, marginBottom: '4px', fontSize: '1.4rem' }}>
          {role === 'student' ? '🎓 Sinh viên NEU' : '👨‍🏫 Giảng viên NEU'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '32px' }}>
          Đăng nhập bằng tài khoản NEU của bạn
        </p>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            className="input"
            type="email"
            placeholder="Email (@neu.edu.vn)"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" style={{ marginTop: '8px' }}>
            Đăng nhập
          </button>
        </form>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '16px' }}>
          Sử dụng tài khoản portal.neu.edu.vn của bạn
        </p>
      </div>
    </div>
  )
}
