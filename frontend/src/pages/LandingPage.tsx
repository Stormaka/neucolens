import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import React from 'react'

const FEATURES = [
  {
    icon: '🧠',
    color: 'var(--pu)',
    colorGlow: 'var(--pug)',
    title: 'Knowledge Graph Tự Động',
    desc: 'Upload project — hệ thống phân tích toàn bộ codebase và sinh knowledge graph tương tác trong vài phút.',
  },
  {
    icon: '🏗️',
    color: 'var(--bl)',
    colorGlow: 'var(--blg)',
    title: 'Báo Cáo Kiến Trúc',
    desc: 'Tự động nhận dạng các tầng kiến trúc (UI, API, Service, Data) và sinh báo cáo chi tiết cho giảng viên.',
  },
  {
    icon: '💬',
    color: 'var(--gn)',
    colorGlow: 'var(--gng)',
    title: '/understand-chat',
    desc: 'Sinh viên hỏi về code của chính mình bằng tiếng Việt. AI trả lời dựa trên context thực tế của project.',
  },
  {
    icon: '👨‍🏫',
    color: 'var(--r)',
    colorGlow: 'var(--rg)',
    title: 'Review Nhanh Cho GV',
    desc: 'Giảng viên xem knowledge graph thay vì đọc code từng dòng. Tiết kiệm 80% thời gian review.',
  },
  {
    icon: '🔍',
    color: 'var(--yw)',
    colorGlow: 'var(--ywg)',
    title: 'Phân Tích Đa Ngôn Ngữ',
    desc: 'Hỗ trợ Java, Python, JavaScript/TypeScript, C#, PHP — các ngôn ngữ phổ biến trong KLTN NEU.',
  },
  {
    icon: '📊',
    color: 'var(--or)',
    colorGlow: 'var(--org)',
    title: 'So Sánh Kiến Trúc',
    desc: 'Giảng viên so sánh kiến trúc giữa các KLTN, phát hiện điểm mạnh/yếu nhanh chóng.',
  },
]

const STATS = [
  { value: '3 phút', label: 'Thời gian phân tích TB', icon: '⚡' },
  { value: '80%', label: 'Giảm thời gian review GV', icon: '📉' },
  { value: '12+', label: 'Ngôn ngữ được hỗ trợ', icon: '🔤' },
  { value: '100%', label: 'Dữ liệu bảo mật NEU', icon: '🔒' },
]

const HOW_IT_WORKS = [
  { step: '01', title: 'Upload Project', desc: 'Sinh viên nén project thành .zip hoặc dán link GitHub và upload lên hệ thống.', icon: '📤' },
  { step: '02', title: 'Phân Tích Tự Động', desc: 'Understand-Anything quét toàn bộ codebase, trích xuất file, hàm, class, import/export và phụ thuộc.', icon: '🔍' },
  { step: '03', title: 'Sinh Knowledge Graph', desc: 'Pipeline đa agent tạo ra knowledge graph dạng JSON với nodes, edges, architectural layers và guided tour.', icon: '🕸️' },
  { step: '04', title: 'Dashboard Tương Tác', desc: 'Sinh viên và giảng viên khám phá graph qua dashboard web — zoom, tìm kiếm, click node để xem chi tiết.', icon: '📊' },
  { step: '05', title: 'Chat Về Code', desc: 'Dùng /understand-chat để hỏi về logic của chính mình. AI trả lời dựa trên graph đã phân tích.', icon: '💬' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState<'student' | 'lecturer' | null>(null)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg0)', position: 'relative', overflow: 'hidden' }}>
      {/* ── Ambient Orbs ── */}
      <div className="orb orb-red" style={{ width: 800, height: 800, top: '-300px', left: '-200px', animationDelay: '0s', zIndex: 0 }} />
      <div className="orb orb-blue" style={{ width: 600, height: 600, top: '30%', right: '-200px', animationDelay: '-5s', zIndex: 0 }} />
      <div className="orb orb-pu" style={{ width: 500, height: 500, bottom: '-100px', left: '20%', animationDelay: '-10s', zIndex: 0 }} />

      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(6, 8, 16, .85)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid var(--b1)',
        padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '64px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 36, height: 36,
            background: 'linear-gradient(135deg, var(--r), var(--rd))',
            borderRadius: 'var(--r8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: 900, color: '#fff',
            boxShadow: '0 0 20px var(--rg2)',
            fontFamily: 'var(--display)',
          }}>N</div>
          <span style={{ fontWeight: 700, fontSize: '1.05rem', fontFamily: 'var(--display)', letterSpacing: '-.01em' }}>
            NEU <span style={{ color: 'var(--rl)' }}>CodeLens</span>
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '.78rem', color: 'var(--t3)' }}>Đại học Kinh tế Quốc dân</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setRole('lecturer')}>
            👨‍🏫 Giảng viên
          </button>
          <button className="btn btn-primary btn-sm animate-pulse-glow" onClick={() => setRole('student')}>
            🎓 Sinh viên
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        padding: 'clamp(80px, 12vw, 140px) 2rem clamp(60px, 8vw, 100px)',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Grid pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(var(--b1) 1px, transparent 1px),
            linear-gradient(90deg, var(--b1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          opacity: .3,
          pointerEvents: 'none',
        }} />

        <div className="animate-fade-in-up" style={{ position: 'relative', zIndex: 1 }}>
          <div className="badge badge-red animate-scale-in" style={{ marginBottom: '28px', display: 'inline-flex', fontSize: '.75rem', padding: '5px 16px' }}>
            🎓 Dành cho sinh viên CNTT · Toán Tin · HTTT — NEU
          </div>

          <h1 style={{
            fontFamily: 'var(--display)',
            fontSize: 'clamp(2.4rem, 7vw, 5rem)',
            fontWeight: 900,
            lineHeight: 1.05,
            marginBottom: '28px',
            letterSpacing: '-.03em',
          }}>
            Hiểu Đồ án của bạn<br />
            <span className="gradient-text">sâu hơn, nhanh hơn.</span>
          </h1>

          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.2rem)',
            color: 'var(--t2)',
            maxWidth: '660px',
            margin: '0 auto 44px',
            lineHeight: 1.75,
          }}>
            Sinh viên upload project — hệ thống tự động phân tích codebase,
            sinh <strong style={{ color: 'var(--t1)' }}>knowledge graph</strong> và{' '}
            <strong style={{ color: 'var(--t1)' }}>báo cáo kiến trúc</strong>.
            Giảng viên review KLTN nhanh hơn 80%.
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '64px' }}>
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

          {/* Graph Preview */}
          <div className="animate-float" style={{ display: 'flex', justifyContent: 'center' }}>
            <MiniGraphPreview />
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{
        padding: '48px 2rem',
        borderTop: '1px solid var(--b1)',
        borderBottom: '1px solid var(--b1)',
        background: 'var(--glass)',
        backdropFilter: 'blur(8px)',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          maxWidth: '960px', margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '40px',
          textAlign: 'center',
        }}>
          {STATS.map((s, i) => (
            <div key={s.label} className="animate-fade-in-up" style={{ animationDelay: `${i * .07}s` }}>
              <div style={{ fontSize: '1.6rem', marginBottom: '6px' }}>{s.icon}</div>
              <div style={{
                fontFamily: 'var(--display)',
                fontSize: 'clamp(2rem, 4vw, 2.8rem)',
                fontWeight: 900,
                color: 'var(--rl)',
                lineHeight: 1,
                marginBottom: '6px',
                letterSpacing: '-.02em',
              }}>
                {s.value}
              </div>
              <div style={{ fontSize: '.82rem', color: 'var(--t3)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: 'clamp(60px, 8vw, 100px) 2rem', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div className="badge bdn" style={{ marginBottom: '16px', display: 'inline-flex' }}>✨ Tính năng</div>
            <h2 style={{
              fontFamily: 'var(--display)',
              fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
              fontWeight: 800,
              marginBottom: '16px',
              letterSpacing: '-.02em',
            }}>
              Tính năng <span className="gradient-text-red">nổi bật</span>
            </h2>
            <p style={{ color: 'var(--t2)', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
              Được xây dựng trên nền tảng Understand-Anything — pipeline đa agent phân tích codebase chuyên sâu.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px',
          }}>
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="glass-card card-hover animate-fade-in-up"
                style={{ padding: '28px 28px 32px', animationDelay: `${i * .07}s` }}
              >
                <div style={{
                  width: '52px', height: '52px',
                  borderRadius: 'var(--r12)',
                  background: `linear-gradient(135deg, ${f.colorGlow}, transparent)`,
                  border: `1px solid ${f.colorGlow}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.6rem',
                  marginBottom: '20px',
                  boxShadow: `0 8px 24px ${f.colorGlow}`,
                }}>
                  {f.icon}
                </div>
                <h3 style={{
                  fontFamily: 'var(--display)',
                  fontWeight: 700,
                  marginBottom: '10px',
                  fontSize: '1.05rem',
                  color: 'var(--t1)',
                }}>
                  {f.title}
                </h3>
                <p style={{ color: 'var(--t2)', fontSize: '.88rem', lineHeight: 1.75 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{
        padding: 'clamp(60px, 8vw, 100px) 2rem',
        background: 'var(--glass)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid var(--b1)',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ maxWidth: '780px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div className="badge bdn" style={{ marginBottom: '16px', display: 'inline-flex' }}>🔄 Quy trình</div>
            <h2 style={{
              fontFamily: 'var(--display)',
              fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
              fontWeight: 800,
              letterSpacing: '-.02em',
            }}>
              Quy trình <span className="gradient-text-red">hoạt động</span>
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.step}
                className="animate-fade-in-up"
                style={{
                  display: 'flex', gap: '28px', alignItems: 'flex-start',
                  paddingBottom: i < HOW_IT_WORKS.length - 1 ? '44px' : '0',
                  position: 'relative',
                  animationDelay: `${i * .1}s`,
                }}
              >
                {/* Connector line */}
                {i < HOW_IT_WORKS.length - 1 && (
                  <div style={{
                    position: 'absolute',
                    left: '26px', top: '56px',
                    width: '2px',
                    height: 'calc(100% - 12px)',
                    background: 'linear-gradient(180deg, var(--rg) 0%, transparent 100%)',
                  }} />
                )}

                {/* Step circle */}
                <div style={{
                  width: '54px', height: '54px',
                  background: 'linear-gradient(135deg, var(--r), var(--rd))',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '.75rem', fontWeight: 800, color: '#fff',
                  flexShrink: 0,
                  boxShadow: '0 0 20px var(--rg2), var(--sh2)',
                  zIndex: 1,
                  fontFamily: 'var(--display)',
                  position: 'relative',
                }}>
                  {step.step}
                </div>

                {/* Content */}
                <div
                  className="glass-card"
                  style={{
                    flex: 1,
                    padding: '20px 24px',
                    border: '1px solid var(--b1)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '1.3rem' }}>{step.icon}</span>
                    <h3 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: '1rem' }}>{step.title}</h3>
                  </div>
                  <p style={{ color: 'var(--t2)', fontSize: '.88rem', lineHeight: 1.7 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        padding: 'clamp(80px, 10vw, 120px) 2rem',
        textAlign: 'center',
        position: 'relative', zIndex: 1,
      }}>
        {/* Gradient blob behind CTA */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px', height: '300px',
          background: 'radial-gradient(ellipse, var(--rg3) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: '620px', margin: '0 auto', position: 'relative' }}>
          <div className="badge badge-red" style={{ marginBottom: '24px', display: 'inline-flex' }}>🚀 Bắt đầu ngay</div>
          <h2 style={{
            fontFamily: 'var(--display)',
            fontSize: 'clamp(1.8rem, 5vw, 2.8rem)',
            fontWeight: 900,
            marginBottom: '16px',
            letterSpacing: '-.02em',
            lineHeight: 1.15,
          }}>
            Sẵn sàng bắt đầu?
          </h2>
          <p style={{ color: 'var(--t2)', marginBottom: '36px', lineHeight: 1.7 }}>
            Đăng nhập bằng tài khoản NEU của bạn và upload đồ án đầu tiên ngay hôm nay.
          </p>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-lg animate-pulse-glow" onClick={() => navigate('/student')}>
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
        borderTop: '1px solid var(--b1)',
        padding: '28px 2rem',
        textAlign: 'center',
        color: 'var(--t4)',
        fontSize: '.82rem',
        position: 'relative', zIndex: 1,
        background: 'var(--glass)',
      }}>
        <div style={{ marginBottom: '6px' }}>
          <strong style={{ color: 'var(--t2)', fontFamily: 'var(--display)' }}>NEU CodeLens</strong>
          {' '}— Hệ thống Hỗ trợ Đồ án / KLTN
        </div>
        <div>
          Đại học Kinh tế Quốc dân (NEU) · Khoa CNTT · Powered by{' '}
          <a
            href="https://github.com/Lum1104/Understand-Anything"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--rl)', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            Understand-Anything
          </a>
        </div>
      </footer>

      {/* ── Login Modal ── */}
      {role && (
        <LoginModal role={role} onClose={() => setRole(null)} onSwitchRole={() => setRole(role === 'student' ? 'lecturer' : 'student')} />
      )}
    </div>
  )
}

/* ── Mini Graph Preview ── */
function MiniGraphPreview() {
  const nodes = [
    { x: 300, y: 80, r: 14, color: '#60a5fa', label: 'AuthService' },
    { x: 160, y: 185, r: 10, color: '#a78bfa', label: 'login()' },
    { x: 300, y: 205, r: 12, color: '#34d399', label: 'UserController' },
    { x: 460, y: 175, r: 10, color: '#fb923c', label: 'JWT Utils' },
    { x: 100, y: 295, r: 9,  color: '#94a3b8', label: 'config.ts' },
    { x: 220, y: 315, r: 11, color: '#f472b6', label: 'UserModel' },
    { x: 385, y: 305, r: 10, color: '#fbbf24', label: '/api/auth' },
    { x: 500, y: 285, r: 9,  color: '#60a5fa', label: 'Database' },
  ]
  const edges = [
    [0, 1], [0, 2], [0, 3], [2, 5], [2, 6], [3, 0], [1, 4], [6, 7], [5, 7],
  ]

  return (
    <div style={{
      width: '640px',
      maxWidth: '100%',
      background: 'rgba(13,16,24,.8)',
      border: '1px solid var(--b2)',
      borderRadius: 'var(--r20)',
      padding: '16px',
      boxShadow: '0 24px 80px rgba(0,0,0,.6), 0 0 80px var(--rg3)',
      backdropFilter: 'blur(12px)',
    }}>
      {/* Window chrome */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
        {['#ef4444', '#f59e0b', '#22c55e'].map(c => (
          <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
        ))}
        <span style={{ fontSize: '.72rem', color: 'var(--t3)', marginLeft: '10px', fontFamily: 'var(--mono)' }}>
          knowledge-graph.json — thesis-ecommerce
        </span>
      </div>

      <svg viewBox="0 0 600 380" style={{ width: '100%', height: '260px' }}>
        <defs>
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
          </pattern>
          <radialGradient id="glow-blue" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity=".4" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glow-red" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e53e3e" stopOpacity=".3" />
            <stop offset="100%" stopColor="#e53e3e" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="600" height="380" fill="url(#grid)" />

        {/* Edges */}
        {edges.map(([a, b], i) => (
          <line key={i}
            x1={nodes[a].x} y1={nodes[a].y}
            x2={nodes[b].x} y2={nodes[b].y}
            stroke="rgba(255,255,255,0.09)" strokeWidth="1.5"
          />
        ))}

        {/* Nodes */}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={n.r + 10} fill={n.color} opacity="0.07" />
            <circle cx={n.x} cy={n.y} r={n.r + 4} fill={n.color} opacity="0.15" />
            <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} opacity="0.9" />
            <text
              x={n.x} y={n.y + n.r + 14}
              textAnchor="middle"
              style={{ fontSize: '9px', fill: 'rgba(255,255,255,0.55)', fontFamily: 'Inter, sans-serif' }}
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

/* ── Login Modal ── */
function LoginModal({
  role, onClose, onSwitchRole,
}: {
  role: 'student' | 'lecturer'; onClose: () => void; onSwitchRole: () => void
}) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState('')

  const validateEmail = (val: string) => {
    if (!val.endsWith('@neu.edu.vn')) {
      setEmailError('Email phải thuộc domain @neu.edu.vn')
      return false
    }
    const prefix = val.split('@')[0].toLowerCase()
    if (role === 'student' && !prefix.startsWith('sv.')) {
      setEmailError('Tài khoản sinh viên phải có dạng sv.xxx@neu.edu.vn')
      return false
    }
    if (role === 'lecturer' && !prefix.startsWith('ts.') && !prefix.startsWith('gv.') && !prefix.startsWith('ths.')) {
      setEmailError('Tài khoản giảng viên phải có dạng ts.xxx@neu.edu.vn hoặc gv.xxx@neu.edu.vn')
      return false
    }
    setEmailError('')
    return true
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateEmail(email)) return
    navigate(role === 'student' ? '/student' : '/lecturer')
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.75)',
        backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card animate-scale-in"
        style={{ width: '420px', padding: '40px' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
          <h2 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: '1.4rem' }}>
            {role === 'student' ? '🎓 Sinh viên NEU' : '👨‍🏫 Giảng viên NEU'}
          </h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ padding: '4px 8px', fontSize: '1rem' }}
          >✕</button>
        </div>
        <p style={{ color: 'var(--t3)', fontSize: '.83rem', marginBottom: '28px' }}>
          Đăng nhập bằng tài khoản NEU của bạn
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <input
              className="input"
              type="email"
              autoFocus
              placeholder={role === 'student' ? 'sv.xxx@neu.edu.vn' : 'ts.xxx@neu.edu.vn'}
              value={email}
              onChange={e => { setEmail(e.target.value); if (emailError) validateEmail(e.target.value) }}
              onBlur={() => email && validateEmail(email)}
              style={{ borderColor: emailError ? 'rgba(229,62,62,.6)' : undefined }}
            />
            {emailError && (
              <div style={{ fontSize: '.77rem', color: 'hsl(0,90%,70%)', marginTop: '5px' }}>
                ⚠️ {emailError}
              </div>
            )}
          </div>
          <input
            className="input"
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" style={{ marginTop: '8px', justifyContent: 'center', padding: '12px' }}>
            Đăng nhập
          </button>
        </form>

        <p style={{ fontSize: '.73rem', color: 'var(--t4)', textAlign: 'center', marginTop: '14px' }}>
          Sử dụng tài khoản portal.neu.edu.vn của bạn
        </p>
        <p style={{ fontSize: '.77rem', textAlign: 'center', marginTop: '10px' }}>
          <span style={{ color: 'var(--t3)' }}>
            {role === 'student' ? 'Bạn là giảng viên? ' : 'Bạn là sinh viên? '}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onSwitchRole}
            style={{ fontSize: '.77rem', padding: '2px 8px', display: 'inline-flex' }}
          >
            {role === 'student' ? 'Đăng nhập Giảng viên →' : 'Đăng nhập Sinh viên →'}
          </button>
        </p>
      </div>
    </div>
  )
}
