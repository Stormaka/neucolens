import { useNavigate, useLocation } from 'react-router-dom'

interface NavBarProps {
  role: 'student' | 'lecturer'
  userName?: string
  studentId?: string
  firstProjectId?: string
  onLogout?: () => void
}

export default function NavBar({ role, userName, studentId, firstProjectId, onLogout }: NavBarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const studentLinks = [
    { label: '📁 Đồ án', path: '/student' },
    { label: '💬 Chat AI', path: `/chat/${firstProjectId ?? 'proj-1'}` },
  ]
  const lecturerLinks = [
    { label: '📋 Dashboard', path: '/lecturer' },
  ]
  const links = role === 'student' ? studentLinks : lecturerLinks

  const initials = userName
    ? userName.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (role === 'student' ? 'SV' : 'GV')

  return (
    <nav style={{
      height: '60px',
      background: 'rgba(6, 8, 16, .88)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderBottom: '1px solid var(--b1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* ── Logo ── */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        onClick={() => navigate('/')}
      >
        <div style={{
          width: 32, height: 32,
          background: 'linear-gradient(135deg, var(--r), var(--rd))',
          borderRadius: 'var(--r8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px', fontWeight: 900, color: '#fff',
          boxShadow: '0 0 16px var(--rg2), 0 2px 8px rgba(0,0,0,.4)',
          fontFamily: 'var(--display)',
          flexShrink: 0,
          position: 'relative',
        }}>
          N
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: 'var(--r8)',
            background: 'linear-gradient(135deg, rgba(255,255,255,.2), transparent)',
            pointerEvents: 'none',
          }} />
        </div>
        <span style={{
          fontWeight: 700,
          fontSize: '0.95rem',
          fontFamily: 'var(--display)',
          letterSpacing: '-.01em',
        }}>
          NEU <span style={{ color: 'var(--rl)' }}>CodeLens</span>
        </span>
      </div>

      {/* ── Nav Links ── */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {links.map(link => {
          const isActive = location.pathname === link.path || location.pathname.startsWith(link.path + '/')
          return (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--r8)',
                border: '1px solid',
                borderColor: isActive ? 'var(--b2)' : 'transparent',
                background: isActive ? 'var(--glass3)' : 'transparent',
                color: isActive ? 'var(--t1)' : 'var(--t3)',
                fontSize: '0.83rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--sans)',
                transition: 'all var(--t-fast) var(--ease)',
                display: 'flex', alignItems: 'center', gap: '6px',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--t2)'
                  e.currentTarget.style.background = 'var(--glass2)'
                  e.currentTarget.style.borderColor = 'var(--b1)'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--t3)'
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'transparent'
                }
              }}
            >
              {link.label}
            </button>
          )
        })}
      </div>

      {/* ── User Info ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {userName && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--t1)', lineHeight: 1.3 }}>
              {userName}
            </div>
            {studentId && (
              <div style={{ fontSize: '0.7rem', color: 'var(--t3)', fontFamily: 'var(--mono)' }}>
                {studentId}
              </div>
            )}
          </div>
        )}

        {/* Avatar */}
        <div style={{
          width: 34, height: 34,
          background: role === 'student'
            ? 'linear-gradient(135deg, var(--bl), hsl(213, 80%, 50%))'
            : 'linear-gradient(135deg, var(--gn), hsl(158, 60%, 32%))',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 700, color: '#fff',
          boxShadow: '0 0 0 2px var(--bg0), 0 0 0 4px var(--b2)',
          flexShrink: 0,
          fontFamily: 'var(--display)',
        }}>
          {initials}
        </div>

        {/* Role Badge */}
        <span className={`badge ${role === 'student' ? 'bdb' : 'bdg'}`} style={{ fontSize: '.65rem' }}>
          {role === 'student' ? '🎓 SV' : '👨‍🏫 GV'}
        </span>

        {onLogout && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onLogout}
            style={{ fontSize: '0.76rem', padding: '5px 10px' }}
          >
            Đăng xuất
          </button>
        )}
      </div>
    </nav>
  )
}
