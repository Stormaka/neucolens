import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

const DEMOS = [
  {
    email: 'teacher@neu.edu.vn',
    password: 'teacher123',
    label: 'TS. Nguyễn Minh Đức',
    role: 'Giảng viên · LTCB-2026A',
    icon: '👨‍🏫',
    color: 'var(--r)',
    glow: 'var(--rg)',
    badge: 'bdr',
  },
  {
    email: 'an@neu.edu.vn',
    password: 'student123',
    label: 'Nguyễn Văn An',
    role: 'Sinh viên Giỏi · 11201234',
    icon: '🚀',
    color: 'var(--gn)',
    glow: 'var(--gng)',
    badge: 'bdg',
  },
  {
    email: 'tuan@neu.edu.vn',
    password: 'student123',
    label: 'Lê Minh Tuấn',
    role: 'Sinh viên At-Risk · 11204567',
    icon: '⚠️',
    color: 'var(--yw)',
    glow: 'var(--ywg)',
    badge: 'bdy',
  },
]

const FEATURES = [
  '🧠 3-Tier Rubric',
  '📊 Concept Heatmap',
  '🚨 Early Warning System',
  '🤖 AI Detection',
  '📈 Progress Tracking',
  '🔬 Code Knowledge Graph',
]

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const doLogin = async (e?: string, p?: string) => {
    const em = e || email, pw = p || password
    if (!em || !pw) { setErr('Vui lòng điền đầy đủ thông tin'); return }
    setLoading(true); setErr('')
    try {
      await login(em, pw)
      navigate('/')
    } catch (er: any) {
      setErr(er.error || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg0)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* ── Ambient orbs ── */}
      <div className="orb orb-red" style={{
        width: 700, height: 700,
        top: '-200px', left: '-180px',
        animationDelay: '0s',
      }} />
      <div className="orb orb-blue" style={{
        width: 550, height: 550,
        bottom: '-120px', right: '-120px',
        animationDelay: '-4s',
      }} />
      <div className="orb orb-pu" style={{
        width: 400, height: 400,
        top: '40%', left: '50%',
        animationDelay: '-8s',
      }} />

      {/* ── Grid pattern ── */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(var(--b1) 1px, transparent 1px),
          linear-gradient(90deg, var(--b1) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        opacity: .4,
        pointerEvents: 'none',
      }} />

      {/* ── Nav ── */}
      <nav style={{
        position: 'relative', zIndex: 10,
        padding: '0 28px',
        height: '60px',
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid var(--b1)',
        background: 'rgba(6,8,16,.6)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, var(--r), var(--rd))',
            borderRadius: 'var(--r8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: '16px', color: '#fff',
            boxShadow: '0 0 16px var(--rg2)',
            fontFamily: 'var(--display)',
          }}>N</div>
          <span style={{ fontWeight: 700, fontSize: '.95rem', fontFamily: 'var(--display)' }}>
            NEU <span style={{ color: 'var(--rl)' }}>CodeLens</span>
          </span>
        </div>
      </nav>

      {/* ── Main ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 20px',
        position: 'relative', zIndex: 1,
      }}>
        {/* Hero text */}
        <div className="animate-fade-in-up" style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'var(--rg2)',
            border: '1px solid var(--rg)',
            borderRadius: 'var(--rpill)',
            padding: '5px 16px',
            fontSize: '.76rem', fontWeight: 700, color: 'var(--rl)',
            marginBottom: '20px',
            letterSpacing: '.04em',
          }}>
            🔬 LLM + Understand-Anything · NEU 2026
          </div>

          <h1 style={{
            fontFamily: 'var(--display)',
            fontSize: 'clamp(1.8rem, 5vw, 2.8rem)',
            fontWeight: 900,
            letterSpacing: '-.03em',
            lineHeight: 1.1,
            marginBottom: '14px',
          }}>
            NEU-CodeLens{' '}
            <span className="gradient-text">Skills Lab</span>
          </h1>

          <p style={{
            color: 'var(--t2)',
            fontSize: '.9rem',
            maxWidth: '480px',
            lineHeight: 1.75,
            margin: '0 auto',
          }}>
            Hệ thống phân tích năng lực lập trình sinh viên qua từng buổi học, hỗ trợ bởi AI
          </p>
        </div>

        {/* Cards grid */}
        <div className="animate-fade-in-up" style={{
          display: 'grid',
          gridTemplateColumns: 'clamp(300px, 38vw, 420px) clamp(260px, 30vw, 340px)',
          gap: '20px',
          width: '100%',
          maxWidth: '820px',
          animationDelay: '.08s',
        }}>
          {/* ── Login Form ── */}
          <div className="glass-card" style={{ padding: '32px' }}>
            <h2 style={{
              fontFamily: 'var(--display)',
              fontSize: '1.15rem',
              fontWeight: 700,
              marginBottom: '8px',
            }}>
              Đăng nhập vào hệ thống
            </h2>
            <p style={{ fontSize: '.78rem', color: 'var(--t3)', marginBottom: '24px' }}>
              Sử dụng tài khoản portal.neu.edu.vn của bạn
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Email field */}
              <div>
                <label className="label">Email</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-email"
                    className="input"
                    type="email"
                    placeholder="email@neu.edu.vn"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    onKeyDown={e => e.key === 'Enter' && doLogin()}
                    style={{
                      paddingLeft: '40px',
                      transition: 'all var(--t-fast) var(--ease)',
                    }}
                  />
                  <span style={{
                    position: 'absolute', left: '13px', top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '14px', opacity: focusedField === 'email' ? 1 : .5,
                    transition: 'opacity var(--t-fast)',
                  }}>✉️</span>
                </div>
              </div>

              {/* Password field */}
              <div>
                <label className="label">Mật khẩu</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-pass"
                    className="input"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    onKeyDown={e => e.key === 'Enter' && doLogin()}
                    style={{ paddingLeft: '40px' }}
                  />
                  <span style={{
                    position: 'absolute', left: '13px', top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '14px', opacity: focusedField === 'password' ? 1 : .5,
                    transition: 'opacity var(--t-fast)',
                  }}>🔑</span>
                </div>
              </div>

              {/* Error */}
              {err && (
                <div style={{
                  color: 'hsl(0, 90%, 70%)',
                  fontSize: '.8rem',
                  padding: '10px 14px',
                  background: 'rgba(229,62,62,.08)',
                  border: '1px solid rgba(229,62,62,.22)',
                  borderRadius: 'var(--r8)',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  ⚠️ {err}
                </div>
              )}

              <button
                id="btn-login"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: '4px' }}
                onClick={() => doLogin()}
                disabled={loading}
              >
                {loading
                  ? <><span className="spin" style={{ borderWidth: '2px' }} />Đang xác thực...</>
                  : '🔐 Đăng nhập'
                }
              </button>

              <div style={{
                textAlign: 'center',
                color: 'var(--t4)',
                fontSize: '.73rem',
                paddingTop: '4px',
              }}>
                Hệ thống demo — không cần đăng ký tài khoản mới
              </div>
            </div>
          </div>

          {/* ── Demo Accounts ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div style={{
              fontSize: '.76rem',
              fontWeight: 700,
              color: 'var(--t2)',
              marginBottom: '12px',
              display: 'flex', alignItems: 'center', gap: '7px',
              letterSpacing: '.04em',
            }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6,
                borderRadius: '50%', background: 'var(--gn)',
                boxShadow: '0 0 6px var(--gn)',
              }} />
              ĐĂNG NHẬP NHANH
            </div>

            {DEMOS.map((d, i) => (
              <div
                key={i}
                className="glass-card card-hover"
                style={{
                  padding: '16px',
                  cursor: 'pointer',
                  marginBottom: '10px',
                  borderColor: `hsla(from ${d.color} h s l / .18)`,
                  animationDelay: `${(i + 2) * .06}s`,
                }}
                onClick={() => { setEmail(d.email); setPassword(d.password); doLogin(d.email, d.password) }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                  <div style={{
                    width: 38, height: 38,
                    borderRadius: 'var(--r10)',
                    background: `linear-gradient(135deg, ${d.color}26, ${d.color}0d)`,
                    border: `1px solid ${d.color}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', flexShrink: 0,
                  }}>
                    {d.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '.87rem', marginBottom: '2px' }}>
                      {d.label}
                    </div>
                    <div style={{ fontSize: '.73rem', color: 'var(--t2)' }}>{d.role}</div>
                    <div style={{
                      fontSize: '.67rem',
                      color: 'var(--t4)',
                      fontFamily: 'var(--mono)',
                      marginTop: '4px',
                    }}>
                      {d.email}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '1rem',
                    color: 'var(--t4)',
                    transition: 'transform var(--t-fast)',
                  }}>›</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Feature Badges ── */}
        <div className="animate-fade-in" style={{
          display: 'flex',
          gap: '8px',
          marginTop: '32px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          animationDelay: '.3s',
        }}>
          {FEATURES.map((f, i) => (
            <span
              key={f}
              className="badge bdn animate-fade-in"
              style={{ animationDelay: `${.3 + i * .05}s` }}
            >
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        textAlign: 'center',
        padding: '20px',
        color: 'var(--t4)',
        fontSize: '.73rem',
        position: 'relative', zIndex: 1,
        borderTop: '1px solid var(--b1)',
      }}>
        Đại học Kinh tế Quốc dân · Khoa CNTT · NEU CodeLens 2026
      </div>
    </div>
  )
}
