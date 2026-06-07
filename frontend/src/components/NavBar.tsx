import { useNavigate } from 'react-router-dom'

interface NavBarProps {
  role: 'student' | 'lecturer'
  userName?: string
  studentId?: string
}

export default function NavBar({ role, userName, studentId }: NavBarProps) {
  const navigate = useNavigate()

  return (
    <nav style={{
      height: '60px',
      background: 'rgba(10,11,14,0.95)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      {/* Logo */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        onClick={() => navigate('/')}
      >
        <div style={{
          width: 32, height: 32,
          background: 'linear-gradient(135deg, var(--neu-red), #7b1c1c)',
          borderRadius: '7px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '15px', fontWeight: 800, color: '#fff',
          boxShadow: '0 0 14px var(--neu-red-glow)',
        }}>N</div>
        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
          NEU <span style={{ color: 'var(--neu-red-light)' }}>CodeLens</span>
        </span>
      </div>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {role === 'student' ? (
          <>
            <NavLink label="📁 Đồ án" path="/student" />
            <NavLink label="💬 Chat" path="/chat/proj-1" />
          </>
        ) : (
          <>
            <NavLink label="📋 Dashboard" path="/lecturer" />
            <NavLink label="📊 Thống kê" path="/lecturer" />
          </>
        )}
      </div>

      {/* User info */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{userName}</div>
          {studentId && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {studentId}
            </div>
          )}
        </div>
        <div style={{
          width: 34, height: 34,
          background: role === 'student'
            ? 'linear-gradient(135deg, #60a5fa, #3b82f6)'
            : 'linear-gradient(135deg, #34d399, #10b981)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', fontWeight: 700, color: '#fff',
        }}>
          {userName?.[0] ?? (role === 'student' ? 'S' : 'G')}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate('/')}
          style={{ fontSize: '0.78rem' }}
        >
          Đăng xuất
        </button>
      </div>
    </nav>
  )
}

function NavLink({ label, path }: { label: string; path: string }) {
  const navigate = useNavigate()
  const isActive = window.location.pathname === path
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => navigate(path)}
      style={{
        fontSize: '0.85rem',
        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
        background: isActive ? 'var(--bg-elevated)' : 'transparent',
        borderColor: isActive ? 'var(--border-medium)' : 'transparent',
      }}
    >
      {label}
    </button>
  )
}
