// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { admin, classrooms } from '../api'
import { Loader, useToast, avBg, avTx } from '../components/ui'
import ResearchPanel from '../components/ResearchPanel'

export default function AdminPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { toast, ToastContainer } = useToast()

  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // User form
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'student', mssv: '' })
  const [showAddUser, setShowAddUser] = useState(false)

  // Classroom form
  const [newRoom, setNewRoom] = useState({ name: '', description: '', lang: 'C++', semester: '', lecturerId: '' })
  const [showAddRoom, setShowAddRoom] = useState(false)

  // Enrollment form
  const [selectedRoomId, setSelectedRoomId] = useState<number | ''>('')
  const [enrollEmail, setEnrollEmail] = useState('')

  useEffect(() => {
    if (user?.role !== 'teacher') {
      navigate('/')
      return
    }
    loadData()
  }, [user])

  async function loadData() {
    setLoading(true)
    try {
      const [userList, roomList] = await Promise.all([
        admin.users.list(),
        admin.classrooms.list()
      ])
      setUsers(userList)
      setRooms(roomList)
      if (roomList.length > 0) {
        setSelectedRoomId(roomList[0].id)
      }
    } catch (e: any) {
      toast(e.error || 'Lỗi tải dữ liệu admin', true)
    } finally {
      setLoading(false)
    }
  }

  // User Actions
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    if (!newUser.email || !newUser.password || !newUser.name || !newUser.role) {
      toast('Vui lòng điền các trường bắt buộc', true)
      return
    }
    try {
      await admin.users.create(newUser)
      toast('Đã tạo tài khoản thành công!')
      setNewUser({ email: '', password: '', name: '', role: 'student', mssv: '' })
      setShowAddUser(false)
      const updatedUsers = await admin.users.list()
      setUsers(updatedUsers)
    } catch (e: any) {
      toast(e.error || 'Lỗi tạo người dùng', true)
    }
  }

  async function handleDeleteUser(id: number) {
    if (!window.confirm('Bạn có chắc chắn muốn xóa người dùng này? Hành động này không thể hoàn tác.')) return
    try {
      await admin.users.delete(id)
      toast('Đã xóa người dùng!')
      setUsers(users.filter(u => u.id !== id))
    } catch (e: any) {
      toast(e.error || 'Lỗi khi xóa người dùng', true)
    }
  }

  // Classroom Actions
  async function handleCreateClassroom(e: React.FormEvent) {
    e.preventDefault()
    if (!newRoom.name) {
      toast('Tên lớp học là bắt buộc', true)
      return
    }
    try {
      // Find a teacher to assign, fallback to current user if none selected
      const lecturerId = newRoom.lecturerId ? Number(newRoom.lecturerId) : user.id
      await admin.classrooms.create({ ...newRoom, lecturer_id: lecturerId })
      toast('Đã tạo lớp học mới!')
      setNewRoom({ name: '', description: '', lang: 'C++', semester: '', lecturerId: '' })
      setShowAddRoom(false)
      const updatedRooms = await admin.classrooms.list()
      setRooms(updatedRooms)
    } catch (e: any) {
      toast(e.error || 'Lỗi tạo lớp học', true)
    }
  }

  // Enrollment Actions
  async function handleEnrollStudent(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRoomId || !enrollEmail) {
      toast('Vui lòng chọn lớp học và điền email sinh viên', true)
      return
    }
    try {
      await admin.classrooms.enroll(Number(selectedRoomId), enrollEmail)
      toast(`Đã thêm sinh viên vào lớp thành công!`)
      setEnrollEmail('')
      // Refresh classrooms to update student count
      const updatedRooms = await admin.classrooms.list()
      setRooms(updatedRooms)
    } catch (e: any) {
      toast(e.error || 'Lỗi ghi danh sinh viên', true)
    }
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = !userSearch || 
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.mssv?.includes(userSearch)
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter
    return matchesSearch && matchesRole
  })

  const teachers = users.filter(u => u.role === 'teacher')

  if (loading) return <div style={{ minHeight: '100vh', background: 'var(--bg0)', display: 'flex' }}><Loader msg="Đang tải trang Admin..." /></div>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg0)', display: 'flex', flexDirection: 'column' }}>
      <ToastContainer />

      {/* ── Nav ── */}
      <nav className="nav">
        <div className="nav-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div className="nav-logo" style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: '14px' }}>🛡️</div>
          <span style={{ fontFamily: 'var(--display)' }}>
            NEU-CodeLens <span style={{ color: 'var(--r)', fontWeight: 700, fontSize: '.82rem' }}>ADMIN PANEL</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/teacher')}>← Về Dashboard Giảng viên</button>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--r), var(--pu))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#fff', boxShadow: '0 0 0 2px var(--bg0), 0 0 0 4px var(--b2)' }}>
            A
          </div>
          <div style={{ fontSize: '.82rem', color: 'var(--t2)', fontWeight: 500 }}>Admin ({user?.name})</div>
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login') }}>Đăng xuất</button>
        </div>
      </nav>

      <div className="page-wrap">
        {/* Header */}
        <div className="animate-fade-in-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--display)', fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '6px' }}>
              Hệ thống Quản trị NEU-CodeLens
            </h1>
            <p style={{ color: 'var(--t2)', fontSize: '.85rem' }}>Quản lý người dùng, phân phối giảng viên và quản trị lớp học</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: '24px' }}>
          {[['users', '👥 Người dùng'], ['classrooms', '🏫 Lớp học'], ['enrollment', '➕ Ghi danh'], ['research', '📊 Research Export']].map(([id, lbl]) => (
            <button key={id} className={`tab ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>{lbl}</button>
          ))}
        </div>

        {/* TAB: USERS */}
        {activeTab === 'users' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '280px' }}>
                <input className="input" placeholder="🔍 Tìm tên, email, MSSV..." value={userSearch} onChange={e => setUserSearch(e.target.value)} style={{ flex: 1 }} />
                <select className="input" value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)} style={{ width: '130px' }}>
                  <option value="all">Tất cả</option>
                  <option value="teacher">Giảng viên</option>
                  <option value="student">Sinh viên</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={() => setShowAddUser(!showAddUser)}>
                {showAddUser ? 'Đóng form' : '+ Thêm người dùng'}
              </button>
            </div>

            {/* Create user form */}
            {showAddUser && (
              <form onSubmit={handleCreateUser} className="card animate-fade-in-up" style={{ padding: '20px', background: 'var(--bg2)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div style={{ gridColumn: '1 / -1' }}><h3 style={{ margin: 0, fontSize: '.95rem', fontWeight: 700 }}>Thêm tài khoản người dùng mới</h3></div>
                
                <div>
                  <label style={{ fontSize: '.76rem', color: 'var(--t2)', display: 'block', marginBottom: '6px' }}>Họ và tên *</label>
                  <input className="input" placeholder="Ví dụ: Nguyễn Văn A" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} required />
                </div>
                
                <div>
                  <label style={{ fontSize: '.76rem', color: 'var(--t2)', display: 'block', marginBottom: '6px' }}>Email đăng nhập *</label>
                  <input className="input" type="email" placeholder="example@neu.edu.vn" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required />
                </div>

                <div>
                  <label style={{ fontSize: '.76rem', color: 'var(--t2)', display: 'block', marginBottom: '6px' }}>Mật khẩu (tối thiểu 6 ký tự) *</label>
                  <input className="input" type="password" placeholder="Mật khẩu" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required />
                </div>

                <div>
                  <label style={{ fontSize: '.76rem', color: 'var(--t2)', display: 'block', marginBottom: '6px' }}>Vai trò *</label>
                  <select className="input" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                    <option value="student">Sinh viên</option>
                    <option value="teacher">Giảng viên</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '.76rem', color: 'var(--t2)', display: 'block', marginBottom: '6px' }}>MSSV (Chỉ dành cho sinh viên)</label>
                  <input className="input" placeholder="Ví dụ: 11210001" value={newUser.mssv} onChange={e => setNewUser({ ...newUser, mssv: e.target.value })} disabled={newUser.role !== 'student'} />
                </div>

                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddUser(false)}>Hủy</button>
                  <button type="submit" className="btn btn-primary btn-sm">Tạo tài khoản</button>
                </div>
              </form>
            )}

            {/* Users list table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--b2)', fontSize: '.74rem', color: 'var(--t3)' }}>
                      <th style={{ padding: '12px 16px' }}>Họ và tên</th>
                      <th style={{ padding: '12px 16px' }}>Email</th>
                      <th style={{ padding: '12px 16px' }}>Vai trò</th>
                      <th style={{ padding: '12px 16px' }}>MSSV</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--t3)', fontSize: '.84rem' }}>Không tìm thấy người dùng</td>
                      </tr>
                    ) : (
                      filteredUsers.map((u, i) => (
                        <tr key={u.id} style={{ borderBottom: '1px solid var(--b1)', fontSize: '.82rem', background: i % 2 === 0 ? 'transparent' : 'var(--bg1)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div className="avatar" style={{ width: '28px', height: '28px', background: avBg(i), color: avTx(i), fontSize: '.68rem' }}>{u.name?.split(' ').pop()?.slice(0, 2).toUpperCase() || '??'}</div>
                              <span style={{ fontWeight: 600 }}>{u.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--t2)' }}>{u.email}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span className={`badge ${u.role === 'teacher' ? 'bdr' : 'bdg'}`} style={{ fontSize: '.68rem' }}>
                              {u.role === 'teacher' ? '👨‍🏫 Giảng viên' : '👨‍🎓 Sinh viên'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'var(--mono)', color: 'var(--t2)' }}>{u.mssv || '—'}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--or)' }} onClick={() => handleDeleteUser(u.id)} disabled={u.id === user.id}>Xóa</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: CLASSROOMS */}
        {activeTab === 'classrooms' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '.95rem' }}>Danh sách lớp học toàn hệ thống</div>
              <button className="btn btn-primary" onClick={() => setShowAddRoom(!showAddRoom)}>
                {showAddRoom ? 'Đóng form' : '+ Tạo lớp học mới'}
              </button>
            </div>

            {/* Create classroom form */}
            {showAddRoom && (
              <form onSubmit={handleCreateClassroom} className="card animate-fade-in-up" style={{ padding: '20px', background: 'var(--bg2)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div style={{ gridColumn: '1 / -1' }}><h3 style={{ margin: 0, fontSize: '.95rem', fontWeight: 700 }}>Tạo lớp học mới</h3></div>

                <div>
                  <label style={{ fontSize: '.76rem', color: 'var(--t2)', display: 'block', marginBottom: '6px' }}>Tên lớp học *</label>
                  <input className="input" placeholder="Ví dụ: Kỹ thuật lập trình - Lớp 01" value={newRoom.name} onChange={e => setNewRoom({ ...newRoom, name: e.target.value })} required />
                </div>

                <div>
                  <label style={{ fontSize: '.76rem', color: 'var(--t2)', display: 'block', marginBottom: '6px' }}>Mô tả ngắn</label>
                  <input className="input" placeholder="Mô tả lớp học" value={newRoom.description} onChange={e => setNewRoom({ ...newRoom, description: e.target.value })} />
                </div>

                <div>
                  <label style={{ fontSize: '.76rem', color: 'var(--t2)', display: 'block', marginBottom: '6px' }}>Ngôn ngữ chính</label>
                  <select className="input" value={newRoom.lang} onChange={e => setNewRoom({ ...newRoom, lang: e.target.value })}>
                    <option value="C++">C++</option>
                    <option value="Python">Python</option>
                    <option value="JavaScript">JavaScript</option>
                    <option value="C">C</option>
                    <option value="Java">Java</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '.76rem', color: 'var(--t2)', display: 'block', marginBottom: '6px' }}>Học kỳ</label>
                  <input className="input" placeholder="Ví dụ: HK1 - 2026" value={newRoom.semester} onChange={e => setNewRoom({ ...newRoom, semester: e.target.value })} />
                </div>

                <div>
                  <label style={{ fontSize: '.76rem', color: 'var(--t2)', display: 'block', marginBottom: '6px' }}>Giảng viên phụ trách</label>
                  <select className="input" value={newRoom.lecturerId} onChange={e => setNewRoom({ ...newRoom, lecturerId: e.target.value })}>
                    <option value="">-- Chọn giảng viên (Mặc định: Bạn) --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddRoom(false)}>Hủy</button>
                  <button type="submit" className="btn btn-primary btn-sm">Tạo lớp học</button>
                </div>
              </form>
            )}

            {/* Classrooms Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {rooms.map(room => (
                <div key={room.id} className="card card-sm card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span className="badge bdr">🏫 Lớp #{room.id}</span>
                    <span className="badge bdb">{room.lang}</span>
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '.95rem', fontWeight: 800 }}>{room.name}</h3>
                    <p style={{ margin: 0, fontSize: '.76rem', color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{room.description || 'Chưa có mô tả'}</p>
                  </div>
                  <div style={{ marginTop: 'auto', borderTop: '1px solid var(--b1)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '.74rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--t3)' }}>Giảng viên:</span>
                      <span style={{ fontWeight: 600 }}>{room.lecturer_name || `ID: ${room.lecturer_id}`}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--t3)' }}>Học kỳ:</span>
                      <span style={{ fontWeight: 600 }}>{room.semester || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--t3)' }}>Số sinh viên:</span>
                      <span className="badge bdg" style={{ fontSize: '.68rem' }}>{room.student_count || 0} học sinh</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--t3)' }}>Bài tập:</span>
                      <span style={{ fontWeight: 600 }}>{room.assignment_count || 0} bài</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: ENROLLMENT */}
        {activeTab === 'enrollment' && (
          <div className="animate-fade-in card" style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.05rem', fontWeight: 800 }}>Ghi danh học sinh vào lớp</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '.8rem', color: 'var(--t2)' }}>
              Nhập email của sinh viên để ghi danh họ vào một lớp học hiện có. Lưu ý sinh viên phải có tài khoản trước khi ghi danh.
            </p>

            <form onSubmit={handleEnrollStudent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '.76rem', color: 'var(--t2)', display: 'block', marginBottom: '6px' }}>Chọn lớp học *</label>
                <select className="input" value={selectedRoomId} onChange={e => setSelectedRoomId(e.target.value ? Number(e.target.value) : '')} required>
                  <option value="">-- Chọn lớp học --</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>{room.name} ({room.lang} · {room.student_count || 0} SV)</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '.76rem', color: 'var(--t2)', display: 'block', marginBottom: '6px' }}>Email sinh viên *</label>
                <input className="input" type="email" placeholder="student@neu.edu.vn" value={enrollEmail} onChange={e => setEnrollEmail(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Ghi danh học sinh</button>
              </div>
            </form>
          </div>
        )}

        {/* TAB: RESEARCH EXPORT */}
        {activeTab === 'research' && (
          <div className="animate-fade-in">
            <ResearchPanel classroomId={selectedRoomId ? Number(selectedRoomId) : undefined} />
          </div>
        )}
      </div>
    </div>
  )
}
