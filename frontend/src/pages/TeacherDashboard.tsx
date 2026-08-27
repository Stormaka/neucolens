// @ts-nocheck
import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { classrooms, assignments, profiles, submissions, misconceptions, chats, system } from '../api'
import { ConceptHeatmap, RadarChart, scoreColor, PROFILE_BADGE, STATUS_BADGE, Loader, useToast, avBg, avTx, fmtDate, SessionChart, CodeBlock, ConceptTagInput } from '../components/ui'
import CodeGraph from '../components/CodeGraph'
import ProcessPanel from '../components/ProcessPanel'
import ReviewQueue from '../components/ReviewQueue'
import ResearchPanel from '../components/ResearchPanel'

export default function TeacherDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { toast, ToastContainer } = useToast()

  const [classroom, setClassroom] = useState<any>(null)
  const [students, setStudents] = useState<any[]>([])
  const [asgns, setAsgns] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [ewsData, setEwsData] = useState<any>(null)
  const [selStudent, setSelStudent] = useState<any>(null)
  const [selSvSessions, setSelSvSessions] = useState<any[]>([])
  const [selSession, setSelSession] = useState<any>(null)
  const [selStudentChatLog, setSelStudentChatLog] = useState<Record<number, {chat: any, messages: any[]}>>({}) // Storm v4: chat logs
  const [miscData, setMiscData] = useState<any>(null)  // Storm v4: misconceptions
  const [miscSelected, setMiscSelected] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [svSearch, setSvSearch] = useState('')
  const [svFilter, setSvFilter] = useState('all')
  const [showCreateAsgn, setShowCreateAsgn] = useState(false)
  const [newAsgn, setNewAsgn] = useState({ title: '', description: '', deadline: '', lang: 'C++', concepts: [] as string[], sample_code: '', weight_t1: 40, weight_t2: 35, weight_t3: 25, is_exam: false, duration_minutes: 60, allow_paste: true, require_fullscreen: false, shuffle_questions: false, hide_scores_until: '' })
  const [showSampleGraph, setShowSampleGraph] = useState(false)
  const [showStudentGraph, setShowStudentGraph] = useState(false)
  const [selAsgnId, setSelAsgnId] = useState<number | null>(null)
  const [asgnSubs, setAsgnSubs] = useState<any[]>([])
  const [asgnSubsLoading, setAsgnSubsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [classId, setClassId] = useState<number | null>(null)
  const [systemChecks, setSystemChecks] = useState<any>(null)
  const [reviewCount, setReviewCount] = useState(0)
  const [examSessions, setExamSessions] = useState<any[]>([])
  const [plagPairs, setPlagPairs] = useState<any[]>([])
  const [plagLoading, setPlagLoading] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      system.check().then(setSystemChecks).catch(() => setSystemChecks(null))
      const rooms: any[] = await classrooms.list()
      if (!rooms.length) return setLoading(false)
      const room = rooms[0]
      setClassroom(room); setClassId(room.id)
      const [svs, asgnList, statsData, ewsRes] = await Promise.all([
        classrooms.students(room.id),
        assignments.byClassroom(room.id),
        classrooms.stats(room.id),
        profiles.ews(room.id),
      ])
      setStudents(svs); setAsgns(asgnList); setStats(statsData); setEwsData(ewsRes)
      // Storm v4: load misconceptions data
      try {
        const miscRes = await misconceptions.byClassroom(room.id)
        setMiscData(miscRes)
      } catch { }
      // Phase 2: đếm hàng đợi duyệt chấm
      try {
        const nr = await submissions.needsReview({ limit: 1 })
        setReviewCount(nr.total || 0)
      } catch { setReviewCount(0) }
    } catch (e: any) { toast(e.error || 'Lỗi tải dữ liệu', true) }
    finally { setLoading(false) }
  }

  async function selectStudent(sv: any) {
    setSelStudent(sv); setSelSession(null)
    if (!classId) return
    try {
      const subs = await submissions.byStudent(sv.id, classId)
      setSelSvSessions(subs)
    } catch { setSelSvSessions([]) }
    // Storm v4: load chat logs for each assignment
    const chatLogs: Record<number, any> = {}
    try {
      const asgnList = asgns
      await Promise.all(asgnList.map(async (a: any) => {
        try {
          const log = await chats.teacherViewChatLog(sv.id, a.id)
          if (log && log.messages?.length > 0) chatLogs[a.id] = log
        } catch { }
      }))
    } catch { }
    setSelStudentChatLog(chatLogs)
  }

  async function createAssignment() {
    if (!newAsgn.title || !classId) { toast('Điền đầy đủ thông tin', true); return }
    if (newAsgn.is_exam && (!newAsgn.duration_minutes || newAsgn.duration_minutes < 5 || newAsgn.duration_minutes > 300)) { toast('Thời lượng thi phải 5–300 phút', true); return }
    try {
      const payload: any = { ...newAsgn, classroom_id: classId }
      // Phase 3: exam fields — normalize hide_scores_until to ISO or null
      if (!payload.is_exam) { delete payload.duration_minutes; delete payload.hide_scores_until; delete payload.allow_paste; delete payload.require_fullscreen; delete payload.shuffle_questions }
      else {
        if (payload.hide_scores_until) payload.hide_scores_until = new Date(payload.hide_scores_until).toISOString()
        else payload.hide_scores_until = new Date(Date.now() + 7 * 24 * 3600_000).toISOString() // mặc định giấu 7 ngày
        payload.allow_paste = payload.allow_paste ? 1 : 0
        payload.require_fullscreen = payload.require_fullscreen ? 1 : 0
        payload.shuffle_questions = payload.shuffle_questions ? 1 : 0
      }
      await assignments.create(payload)
      toast(payload.is_exam ? '✅ Đã tạo bài thi có giám sát!' : 'Đã tạo bài tập mới!')
      setShowCreateAsgn(false)
      setNewAsgn({ title: '', description: '', deadline: '', lang: 'C++', concepts: [], sample_code: '', weight_t1: 40, weight_t2: 35, weight_t3: 25, is_exam: false, duration_minutes: 60, allow_paste: true, require_fullscreen: false, shuffle_questions: false, hide_scores_until: '' })
      setShowSampleGraph(false)
      const updated = await assignments.byClassroom(classId)
      setAsgns(updated)
    } catch (e: any) { toast(e.error || 'Lỗi tạo bài tập', true) }
  }

  const classroomConcepts = useMemo(() => {
    return [...new Set(students.flatMap(s => s.classroomConcepts || Object.keys(s.conceptMastery || {})))]
  }, [students])

  const selAsgn = useMemo(() => asgns.find(a => a.id === selAsgnId) || null, [asgns, selAsgnId])

  async function selectAssignment(a: any) {
    setSelAsgnId(a.id)
    setAsgnSubsLoading(true)
    setExamSessions([])
    setPlagPairs([])
    try {
      const subs = await assignments.submissions(a.id)
      setAsgnSubs(subs)
    } catch { setAsgnSubs([]) }
    setAsgnSubsLoading(false)
    if (a.isExam) {
      try { const sess = await submissions.examSessions(a.id); setExamSessions(sess || []) } catch { setExamSessions([]) }
    }
  }
  async function checkPlagiarism() {
    if (!selAsgn) return
    setPlagLoading(true)
    try {
      const r = await assignments.plagiarism(selAsgn.id, 0.8)
      setPlagPairs(r.pairs || [])
      if (!r.pairs?.length) toast('✅ Không phát hiện cặp nghi vấn (ngưỡng 0.8)')
    } catch (e: any) { toast(e.message || 'Lỗi kiểm tra plagiarism', true) }
    finally { setPlagLoading(false) }
  }

  const filtered = students.filter(s =>
    (!svSearch || s.name?.toLowerCase().includes(svSearch.toLowerCase()) || s.studentCode?.includes(svSearch)) &&
    (svFilter === 'all' || s.profile_type === svFilter)
  )

  if (loading) return <div style={{ minHeight: '100vh', background: 'var(--bg0)', display: 'flex' }}><Loader msg="Đang tải dữ liệu..." /></div>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg0)', display: 'flex', flexDirection: 'column' }}>
      <ToastContainer />

      {/* ── Nav ── */}
      <nav className="nav">
        <div className="nav-brand">
          <div className="nav-logo" style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: '14px' }}>🔬</div>
          <span style={{ fontFamily: 'var(--display)' }}>
            NEU-CodeLens <span style={{ color: 'var(--t3)', fontWeight: 400, fontSize: '.82rem' }}>Skills Lab</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="badge bdg" style={{ fontSize: '.65rem' }}>
            <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'var(--gn)', boxShadow: '0 0 4px var(--gn)' }} />
            LLM+UA Active
          </span>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gn), hsl(158,60%,32%))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#fff', boxShadow: '0 0 0 2px var(--bg0), 0 0 0 4px var(--b2)' }}>
            {user?.name?.split(' ').pop()?.[0] ?? 'G'}
          </div>
          <div style={{ fontSize: '.82rem', color: 'var(--t2)', fontWeight: 500 }}>{user?.name}</div>
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login') }}>Đăng xuất</button>
        </div>
      </nav>

      <div className="page-wrap">
        {/* ── Page Header ── */}
        <div className="animate-fade-in-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <span className="badge bdr">🏫 {classroom?.name}</span>
              <span className="badge bdb">{classroom?.lang} · {asgns.length} Bài tập</span>
              <span className="badge bdp">{classroom?.semester}</span>
            </div>
            <h1 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '6px' }}>
              Dashboard Giảng viên
            </h1>
            <p style={{ color: 'var(--t2)', fontSize: '.85rem' }}>Phân tích năng lực lập trình qua LLM + Understand-Anything Pipeline</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-ghost" onClick={() => navigate('/admin')} style={{ border: '1px solid var(--b2)' }}>
              🛡️ Quản trị hệ thống
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreateAsgn(true)}>
              + Tạo Bài tập mới
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '24px' }} className="g4 animate-fade-in-up">
            {[
              { l: 'Tổng Sinh viên', v: stats.studentCount, c: 'var(--t1)', ic: '👥', bg: 'var(--glass3)' },
              { l: 'Điểm TB Lớp', v: `${stats.avgScore}/100`, c: 'var(--pu)', ic: '📊', bg: 'var(--pug)' },
              { l: 'Nguy cơ Cao', v: stats.atRiskCount, c: '#f87171', ic: '🚨', bg: 'rgba(248,113,113,.12)' },
              { l: 'Nghi vấn AI', v: stats.aiWarnCount, c: 'var(--yw)', ic: '🛡️', bg: 'var(--ywg)' },
            ].map(s => (
              <div key={s.l} className="stat-card">
                <div>
                  <div className="stat-lbl">{s.l}</div>
                  <div className="stat-val" style={{ color: s.c, fontSize: '1.6rem', fontFamily: 'var(--display)' }}>{s.v}</div>
                </div>
                <div className="stat-icon" style={{ background: s.bg, fontSize: '1.3rem' }}>{s.ic}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="tabs" style={{ marginBottom: '24px' }}>
          {[['overview', '📊 Tổng quan'], ['assignments', '📋 Bài tập'], ['students', '👥 Sinh viên'], ['misconceptions', '🧠 Ngộ nhận'], ['ews', '🚨 EWS & Cảnh báo'], ['review', `⚖️ Duyệt chấm${reviewCount > 0 ? ` (${reviewCount})` : ''}`], ['research', '📊 Research']].map(([id, lbl]) => (
            <button key={id} className={`tab ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>{lbl}</button>
          ))}
        </div>

        {/* ── TAB: OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px', alignItems: 'start' }} className="g2 animate-fade-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Heatmap */}
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: '.92rem', marginBottom: '5px', fontFamily: 'var(--display)' }}>🌡️ Concept Heatmap — Ma trận Năng lực Toàn lớp</div>
                <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginBottom: '16px' }}>Hàng = Sinh viên · Cột = Khái niệm · Màu: 🔴 Yếu → 🟢 Tốt</div>
                <ConceptHeatmap students={students} />
              </div>

              {/* Session progress chart */}
              {stats?.sessionProgress && (
                <div className="card">
                  <div style={{ fontWeight: 700, fontSize: '.92rem', marginBottom: '5px', fontFamily: 'var(--display)' }}>📈 Điểm TB Lớp theo Buổi học</div>
                  <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginBottom: '16px' }}>Điểm trung bình theo từng bài tập đã giao</div>
                  <svg viewBox="0 0 600 180" style={{ width: '100%', overflow: 'visible' }}>
                    {[0, 25, 50, 75, 100].map(g => {
                      const y = 16 + 136 * (1 - g / 100)
                      return (
                        <g key={g}>
                          <line x1="42" y1={y} x2="584" y2={y} stroke="var(--b1)" strokeWidth="1" />
                          <text x="37" y={y + 4} textAnchor="end" fontSize="9" fill="var(--t4)">{g}</text>
                        </g>
                      )
                    })}
                    {stats.sessionProgress.map((sp: any, i: number) => {
                      const x = 42 + 542 * (i / Math.max(stats.sessionProgress.length - 1, 1))
                      const y = 16 + 136 * (1 - (sp.avg_score || 0) / 100)
                      return (
                        <g key={i}>
                          {i > 0 && (() => {
                            const prev = stats.sessionProgress[i - 1]
                            const px = 42 + 542 * ((i - 1) / Math.max(stats.sessionProgress.length - 1, 1))
                            const py = 16 + 136 * (1 - (prev.avg_score || 0) / 100)
                            return <line x1={px} y1={py} x2={x} y2={y} stroke="var(--pu)" strokeWidth="2" strokeLinecap="round" />
                          })()}
                          <circle cx={x} cy={y} r={5} fill="var(--pu)" stroke="var(--bg0)" strokeWidth="2" />
                          <text x={x} y={168} textAnchor="middle" fontSize="9" fill="var(--t4)">B{i + 1}</text>
                          <text x={x} y={y - 10} textAnchor="middle" fontSize="8" fill="var(--pu)" fontWeight="700">{Math.round(sp.avg_score || 0)}</text>
                        </g>
                      )
                    })}
                  </svg>
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Quick alerts */}
              <div className="card card-sm">
                <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⚡ Cảnh báo Nhanh
                  {(ewsData?.atRisk?.length || 0) + (ewsData?.aiWarning?.length || 0) > 0 && (
                    <span className="badge bdr" style={{ fontSize: '.62rem' }}>{(ewsData?.atRisk?.length || 0) + (ewsData?.aiWarning?.length || 0)}</span>
                  )}
                </div>
                {ewsData?.atRisk?.map((s: any) => (
                  <div key={s.id} className="ews ews-d" style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '1.1rem' }}>🚨</div>
                    <div>
                      <b style={{ fontSize: '.84rem' }}>{s.name}</b><br />
                      <span style={{ fontSize: '.73rem', color: 'var(--t2)' }}>Điểm: {s.overall_score}/100 · Risk: {Math.round(s.risk_score * 100)}%</span>
                    </div>
                  </div>
                ))}
                {ewsData?.aiWarning?.map((s: any) => (
                  <div key={s.id} className="ews ews-w" style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '1.1rem' }}>🤖</div>
                    <div>
                      <b style={{ fontSize: '.84rem' }}>{s.name}</b><br />
                      <span style={{ fontSize: '.73rem', color: 'var(--t2)' }}>{s.ai_flag_count} buổi có nghi vấn AI</span>
                    </div>
                  </div>
                ))}
                {!ewsData?.atRisk?.length && !ewsData?.aiWarning?.length && (
                  <div style={{ textAlign: 'center', color: 'var(--gn)', padding: '14px', fontSize: '.82rem' }}>✅ Không có cảnh báo nghiêm trọng</div>
                )}
              </div>

              {/* Concept averages */}
              <div className="card card-sm">
                <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '14px', fontFamily: 'var(--display)' }}>📐 Năng lực TB Toàn lớp</div>
                {classroomConcepts.length === 0 ? (
                  <div style={{ color: 'var(--t3)', fontSize: '.78rem', textAlign: 'center', padding: '12px' }}>Chưa có dữ liệu khái niệm</div>
                ) : classroomConcepts.slice(0, 8).map(c => {
                  const avg = students.length ? Math.round(students.reduce((a, s) => a + (s.conceptMastery?.[c] || 0), 0) / students.length) : 0
                  return (
                    <div key={c} className="cbar">
                      <span className="cbar-lbl">● {c}</span>
                      <div style={{ flex: 1 }}>
                        <div className="prog-wrap">
                          <div className="prog-bar" style={{ width: `${avg}%`, background: scoreColor(avg) }} />
                        </div>
                      </div>
                      <span className="cbar-pct" style={{ color: scoreColor(avg) }}>{avg}%</span>
                    </div>
                  )
                })}
              </div>

              {/* Pipeline status */}
              <div className="card card-sm">
                <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '12px' }}>🔬 UA Pipeline Status</div>
                {[
                  ['📨', 'Code Receiver', Boolean(systemChecks)],
                  ['🔍', 'Rule Analyzer', Boolean(systemChecks)],
                  ['🗄️', 'Database', Boolean(systemChecks?.checks?.database?.available)],
                  ['⚙️', 'Test Runner', Boolean(systemChecks?.checks?.gpp?.available)],
                  ['🧠', 'LLM Engine', Boolean(systemChecks?.checks?.gemini?.configured)],
                ].map(([ic, n, ready]) => (
                  <div key={String(n)} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '6px 0', borderBottom: '1px solid var(--b1)' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: ready ? 'var(--gn)' : 'var(--or)', boxShadow: ready ? '0 0 6px var(--gn)' : 'none', flexShrink: 0 }} />
                    <span style={{ fontSize: '.74rem', color: 'var(--t2)' }}>{String(ic)} {String(n)}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '.65rem', color: ready ? 'var(--gn)' : 'var(--or)', fontWeight: 700, letterSpacing: '.06em' }}>{ready ? 'READY' : 'OFF'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: ASSIGNMENTS ── */}
        {activeTab === 'assignments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="animate-fade-in">
            {/* Assignment grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '13px' }}>
              {asgns.map(a => (
                <div
                  key={a.id}
                  className="card card-sm card-hover"
                  onClick={() => selectAssignment(a)}
                  style={{
                    borderColor: selAsgnId === a.id ? 'var(--rg)' : 'var(--b1)',
                    background: selAsgnId === a.id ? 'var(--rg3)' : 'var(--bg2)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '7px' }}>
                        <span className={`badge ${a.status === 'open' ? 'bdg' : 'bdn'}`}>{a.status === 'open' ? '🟢 Mở' : '⚫ Đóng'}</span>
                        {a.isExam && <span className="badge bdy" title={`Thi ${a.durationMinutes || a.duration_minutes || 60}'`}>📝 Thi {a.durationMinutes || a.duration_minutes || 60}'</span>}
                        {a.isExam && a.hideScoresUntil && <span className="badge bdo" title={a.hideScoresUntil}>🔒 Giấu điểm</span>}
                        {a.isExam && !a.allowPaste && <span className="badge bdn" style={{ fontSize: '.56rem' }}>🚫 Paste</span>}
                        {a.isExam && a.requireFullscreen && <span className="badge bdn" style={{ fontSize: '.56rem' }}>⛶ Fullscreen</span>}
                        <span className="badge bdn" style={{ fontSize: '.62rem' }}>{a.lang || 'C++'}</span>
                        <span style={{ fontSize: '.65rem', color: 'var(--t3)' }}>📅 DL: {fmtDate(a.deadline)}</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '4px' }}>{a.title}</div>
                      <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginBottom: '8px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{a.description}</div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {(a.concepts || []).slice(0, 4).map((c: string) => (
                          <span key={c} className="badge bdp" style={{ fontSize: '.6rem' }}>★ {c}</span>
                        ))}
                        {(a.concepts || []).length > 4 && <span className="badge bdn" style={{ fontSize: '.6rem' }}>+{(a.concepts || []).length - 4}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'var(--display)', fontSize: '1.5rem', fontWeight: 800, color: scoreColor(a.avgScore || 0) }}>{a.submitted_count || 0}</div>
                      <div style={{ fontSize: '.62rem', color: 'var(--t3)' }}>/{students.length} nộp</div>
                      <div style={{ fontSize: '.72rem', fontWeight: 700, color: scoreColor(a.avgScore || 0), marginTop: '3px' }}>{a.avgScore || 0}đ</div>
                    </div>
                  </div>
                  {a.sample_code && <div style={{ marginTop: '9px', fontSize: '.66rem', color: 'var(--gn)', display: 'flex', alignItems: 'center', gap: '4px' }}>✅ Có đáp án mẫu</div>}
                </div>
              ))}
            </div>

            {/* Selected assignment detail */}
            {selAsgn && (
              <div>
                <div className="card" style={{ marginBottom: '24px', background: 'var(--bg2)', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.02rem', fontFamily: 'var(--display)' }}>⚙️ Quản lý Bài tập: {selAsgn.title}</h3>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                        <span className={`badge ${selAsgn.status === 'open' ? 'bdg' : 'bdn'}`}>{selAsgn.status === 'open' ? '🟢 Đang mở' : '⚫ Đã đóng'}</span>
                        {selAsgn.isExam && <span className="badge bdy">📝 Thi {(selAsgn.durationMinutes || selAsgn.duration_minutes || 60)} phút</span>}
                        {selAsgn.isExam && <span className="badge bdn">{selAsgn.allowPaste ? '📋 Paste OK' : '🚫 Chặn paste'}</span>}
                        {selAsgn.isExam && selAsgn.requireFullscreen && <span className="badge bdn">⛶ Yêu cầu fullscreen</span>}
                        {selAsgn.isExam && selAsgn.shuffleQuestions && <span className="badge bdp">🔀 Trộn đề</span>}
                        <span style={{ fontSize: '.76rem', color: 'var(--t2)' }}>
                          Hạn chót: <strong style={{ color: 'var(--t1)' }}>{fmtDate(selAsgn.deadline)}</strong>
                        </span>
                      </div>
                      {selAsgn.isExam && selAsgn.hideScoresUntil && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '.74rem', color: 'var(--or)' }}>🔒 Giấu điểm đến {fmtDate(selAsgn.hideScoresUntil)}</span>
                          <button className="btn btn-sm btn-primary" onClick={async () => {
                            if (!window.confirm('Công bố điểm ngay? Sinh viên sẽ thấy điểm tức thì.')) return
                            try { await assignments.update(selAsgn.id, { hide_scores_until: null }); toast('✅ Đã công bố điểm!'); const u = await assignments.byClassroom(classId); setAsgns(u); setSelAsgnId(selAsgn.id) } catch (e: any) { toast(e.error || 'Lỗi', true) }
                          }}>🔓 Công bố điểm ngay</button>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Extend deadline */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input type="datetime-local" className="input" id="extend-dl-input" defaultValue={selAsgn.deadline ? new Date(new Date(selAsgn.deadline).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} style={{ padding: '5px 8px', fontSize: '.74rem', width: '180px' }} />
                        <button className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--b2)' }} onClick={async () => {
                          const val = (document.getElementById('extend-dl-input') as HTMLInputElement)?.value
                          if (!val) { toast('Chọn thời gian gia hạn', true); return }
                          try {
                            const isoVal = new Date(val).toISOString()
                            await assignments.update(selAsgn.id, { deadline: isoVal })
                            toast('Gia hạn bài tập thành công!')
                            // Refresh
                            const updated = await assignments.byClassroom(classId)
                            setAsgns(updated)
                            setSelAsgnId(selAsgn.id)
                          } catch (err: any) {
                            toast(err.error || 'Lỗi gia hạn bài tập', true)
                          }
                        }}>Gia hạn</button>
                      </div>

                      {/* Toggle status */}
                      <button className={`btn btn-sm ${selAsgn.status === 'open' ? 'btn-ghost' : 'btn-primary'}`} style={selAsgn.status === 'open' ? { border: '1px solid var(--b2)', color: '#f87171' } : {}} onClick={async () => {
                        const nextStatus = selAsgn.status === 'open' ? 'closed' : 'open'
                        if (!window.confirm(`Bạn có chắc chắn muốn ${nextStatus === 'open' ? 'mở lại' : 'đóng'} bài nộp này?`)) return
                        try {
                          await assignments.setStatus(selAsgn.id, nextStatus)
                          toast(`Đã ${nextStatus === 'open' ? 'mở lại' : 'đóng'} bài nộp thành công!`)
                          // Refresh
                          const updated = await assignments.byClassroom(classId)
                          setAsgns(updated)
                          setSelAsgnId(selAsgn.id)
                        } catch (err: any) {
                          toast(err.error || 'Lỗi cập nhật trạng thái bài nộp', true)
                        }
                      }}>
                        {selAsgn.status === 'open' ? '🔒 Đóng nộp bài' : '🔓 Mở lại nộp bài'}
                      </button>
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '.92rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--display)' }}>
                  🔬 Code Graphs — <span style={{ color: 'var(--rl)' }}>{selAsgn.title}</span>
                  <span style={{ fontSize: '.73rem', fontWeight: 400, color: 'var(--t3)' }}>Code Knowledge Graph của từng sinh viên</span>
                </div>
                {selAsgn.sample_code && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--gn)', marginBottom: '9px' }}>💡 Đáp án Mẫu — Graph chuẩn</div>
                    <CodeGraph code={selAsgn.sample_code} lang={selAsgn.lang || 'C++'} concepts={selAsgn.concepts || []} height={360} title={`Graph Mẫu — ${selAsgn.title}`} />
                  </div>
                )}
                {asgnSubsLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--t3)' }}>⏳ Đang tải submissions...</div>
                ) : asgnSubs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--t3)', fontSize: '.82rem', background: 'var(--bg2)', borderRadius: 'var(--r14)', border: '1px dashed var(--b2)' }}>
                    Chưa có sinh viên nộp bài
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: '18px' }}>
                    {asgnSubs.filter(s => s.code && s.code.trim()).map(sub => {
                      const sv = students.find(s => s.id === sub.student_id)
                      const pb = STATUS_BADGE[sub.status] || STATUS_BADGE['pending']
                      return (
                        <div key={sub.id}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px' }}>
                            <div style={{ fontWeight: 700, fontSize: '.84rem' }}>{sub.student_name || sv?.name || `SV #${sub.student_id}`}</div>
                            <span className={`badge ${pb.c}`} style={{ fontSize: '.63rem' }}>{pb.i} {pb.l}</span>
                            <span style={{ fontSize: '.73rem', color: 'var(--t3)', marginLeft: 'auto' }}>🏆 {sub.score_total !== null && sub.score_total !== undefined ? `${sub.score_total}/100` : 'Chưa chấm T1'}</span>
                            <span style={{ fontSize: '.68rem', color: 'var(--t4)' }}>Lần {sub.attempt_number}</span>
                          </div>
                          <CodeGraph
                            code={sub.code}
                            lang={selAsgn.lang || 'C++'}
                            concepts={selAsgn.concepts || []}
                            height={320}
                            title={`${sub.student_name || 'Sinh viên'} — ${selAsgn.title}`}
                            studentName={sub.student_name}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
                {/* Plagiarism (Phase 4B) */}
                <div className="card" style={{ marginTop: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 700, fontSize: '.9rem', fontFamily: 'var(--display)' }}>🔍 Kiểm tra đạo văn — Jaccard 5-gram (ngưỡng 0.8)</div>
                    <button className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--b2)' }} onClick={checkPlagiarism} disabled={plagLoading || !selAsgn}>
                      {plagLoading ? '⏳ Đang so sánh...' : '🔍 Kiểm tra ngay'}
                    </button>
                  </div>
                  {plagPairs.length === 0 ? (
                    <div style={{ color: 'var(--t3)', fontSize: '.78rem', padding: '12px', textAlign: 'center', background: 'var(--bg3)', borderRadius: 'var(--r8)' }}>Chưa có kết quả — bấm Kiểm tra để so sánh {asgnSubs.filter(s=>s.code&&s.code.length>20).length} bài nộp</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
                        <thead><tr style={{ color: 'var(--t3)', borderBottom: '1px solid var(--b2)', textAlign: 'left' }}><th style={{ padding: '6px 8px' }}>Cặp SV</th><th style={{ padding: '6px 8px' }}>Jaccard</th><th style={{ padding: '6px 8px' }}>Shared</th><th style={{ padding: '6px 8px' }}>Độ dài</th></tr></thead>
                        <tbody>{plagPairs.map((p, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--b1)', background: p.similarity > 0.9 ? 'rgba(248,113,113,.08)' : p.similarity > 0.85 ? 'rgba(251,191,36,.08)' : 'transparent' }}>
                            <td style={{ padding: '7px 8px' }}>{p.aName} <span style={{ color: 'var(--t3)', fontSize: '.68rem' }}>#{p.aStudent}</span> ↔ {p.bName} <span style={{ color: 'var(--t3)', fontSize: '.68rem' }}>#{p.bStudent}</span></td>
                            <td style={{ padding: '7px 8px', fontWeight: 800, color: p.similarity > 0.9 ? '#f87171' : p.similarity > 0.85 ? '#fbbf24' : 'inherit' }}>{(p.similarity * 100).toFixed(1)}%</td>
                            <td style={{ padding: '7px 8px' }}>{p.shared}</td>
                            <td style={{ padding: '7px 8px', color: 'var(--t3)' }}>{p.aLen} / {p.bLen}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
                {selAsgn.isExam && (
                  <div className="card" style={{ marginTop: '18px' }}>
                    <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: '12px', fontFamily: 'var(--display)' }}>👁️ Giám sát Thi — {examSessions.length} phiên đã bắt đầu</div>
                    {examSessions.length === 0 ? (
                      <div style={{ color: 'var(--t3)', fontSize: '.78rem', padding: '12px', textAlign: 'center' }}>Chưa có sinh viên nào bấm “Bắt đầu làm bài”</div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
                          <thead><tr style={{ color: 'var(--t3)', borderBottom: '1px solid var(--b2)', textAlign: 'left' }}><th style={{ padding: '6px 8px' }}>Sinh viên</th><th style={{ padding: '6px 8px' }}>Bắt đầu</th><th style={{ padding: '6px 8px' }}>Hết hạn</th><th style={{ padding: '6px 8px' }}>Nộp</th><th style={{ padding: '6px 8px' }}>Focus mất</th><th style={{ padding: '6px 8px' }}>Paste chặn</th><th style={{ padding: '6px 8px' }}>Thoát FS</th></tr></thead>
                          <tbody>{examSessions.map((es: any) => (
                            <tr key={es.id} style={{ borderBottom: '1px solid var(--b1)' }}>
                              <td style={{ padding: '7px 8px', fontWeight: 600 }}>{es.student_name} <span style={{ color: 'var(--t3)', fontSize: '.68rem' }}>{es.student_code}</span></td>
                              <td style={{ padding: '7px 8px' }}>{new Date(es.started_at).toLocaleString('vi-VN')}</td>
                              <td style={{ padding: '7px 8px', color: Date.parse(es.expires_at) < Date.now() ? '#f87171' : 'var(--t1)' }}>{new Date(es.expires_at).toLocaleString('vi-VN')}</td>
                              <td style={{ padding: '7px 8px' }}>{es.submitted_at ? '✅ ' + new Date(es.submitted_at).toLocaleString('vi-VN') : es.submission_id ? '✅' : '⏳ Chưa nộp'}</td>
                              <td style={{ padding: '7px 8px', color: es.focus_lost_count > 5 ? '#f87171' : 'inherit' }}>{es.focus_lost_count}</td>
                              <td style={{ padding: '7px 8px', color: es.paste_blocked_count > 0 ? '#fbbf24' : 'inherit' }}>{es.paste_blocked_count}</td>
                              <td style={{ padding: '7px 8px', color: es.fullscreen_exits > 2 ? '#f87171' : 'inherit' }}>{es.fullscreen_exits}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="g2">
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '14px', fontFamily: 'var(--display)' }}>📊 Tỉ lệ Nộp bài theo Buổi</div>
                {asgns.map((a, i) => {
                  const sub = a.submitted_count || 0
                  const pct = students.length ? Math.round(sub / students.length * 100) : 0
                  return (
                    <div key={a.id} style={{ marginBottom: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.76rem', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600 }}>B{i + 1} — {a.title.split(':')[1]?.trim() || a.title}</span>
                        <span style={{ color: scoreColor(a.avgScore || 0), fontWeight: 700 }}>{sub}/{students.length} · {a.avgScore || 0}đ</span>
                      </div>
                      <div className="prog-wrap">
                        <div className="prog-bar" style={{ width: `${pct}%`, background: scoreColor(a.avgScore || 0) }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '14px', fontFamily: 'var(--display)' }}>📐 Năng lực TB Toàn lớp (Top 8)</div>
                {classroomConcepts.length === 0 ? (
                  <div style={{ color: 'var(--t3)', fontSize: '.78rem', textAlign: 'center', padding: '12px' }}>Chưa có dữ liệu</div>
                ) : classroomConcepts.slice(0, 8).map(c => {
                  const avg = students.length ? Math.round(students.reduce((a, s) => a + (s.conceptMastery?.[c] || 0), 0) / students.length) : 0
                  return (
                    <div key={c} className="cbar">
                      <span className="cbar-lbl">★ {c}</span>
                      <div style={{ flex: 1 }}><div className="prog-wrap"><div className="prog-bar" style={{ width: `${avg}%`, background: scoreColor(avg) }} /></div></div>
                      <span className="cbar-pct" style={{ color: scoreColor(avg) }}>{avg}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: STUDENTS ── */}
        {activeTab === 'students' && (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }} className="g2 animate-fade-in">
            {/* Student list sidebar */}
            <div style={{ position: 'sticky', top: '70px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="card card-sm">
                <input className="input" placeholder="🔍 Tìm tên, MSSV..." value={svSearch} onChange={e => setSvSearch(e.target.value)} style={{ marginBottom: '10px' }} />
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {[['all', 'Tất cả'], ['advanced', '🚀 Giỏi'], ['on-track', '✅ Đạt'], ['at-risk', '⚠️ Nguy cơ'], ['ai-warning', '🤖 AI']].map(([v, l]) => (
                    <button
                      key={v}
                      onClick={() => setSvFilter(v)}
                      style={{
                        padding: '3px 10px',
                        fontSize: '.68rem',
                        fontWeight: 700,
                        borderRadius: 'var(--rpill)',
                        border: '1px solid',
                        borderColor: svFilter === v ? 'transparent' : 'var(--b2)',
                        background: svFilter === v ? 'var(--r)' : 'var(--bg3)',
                        color: svFilter === v ? '#fff' : 'var(--t2)',
                        cursor: 'pointer',
                        transition: 'all var(--t-fast)',
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card card-sm" style={{ padding: '12px' }}>
                <div style={{ fontWeight: 700, fontSize: '.78rem', marginBottom: '8px', color: 'var(--t1)' }}>➕ Thêm sinh viên vào lớp</div>
                <form onSubmit={async (e) => {
                  e.preventDefault()
                  const form = e.currentTarget
                  const emailInput = form.elements.namedItem('studentEmail') as HTMLInputElement
                  const email = emailInput.value.trim()
                  if (!email || !classId) return
                  try {
                    await classrooms.enroll(classId, email)
                    toast('Đã thêm sinh viên vào lớp!')
                    emailInput.value = ''
                    const svs = await classrooms.students(classId)
                    setStudents(svs)
                    const updatedStats = await classrooms.stats(classId)
                    setStats(updatedStats)
                  } catch (err: any) {
                    toast(err.error || 'Lỗi thêm sinh viên', true)
                  }
                }} style={{ display: 'flex', gap: '6px' }}>
                  <input name="studentEmail" className="input" type="email" placeholder="email@neu.edu.vn" style={{ flex: 1, padding: '5px 8px', fontSize: '.74rem' }} required />
                  <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '4px 10px', fontSize: '.74rem', minWidth: 'fit-content' }}>Thêm</button>
                </form>
              </div>
              <div className="card card-sm" style={{ padding: '7px', maxHeight: '60vh', overflowY: 'auto' }}>
                {filtered.map((s, si) => {
                  const pb = PROFILE_BADGE[s.profile_type] || PROFILE_BADGE['on-track']
                  return (
                    <div key={s.id} className={`sv-row ${selStudent?.id === s.id ? 'selected' : ''}`} onClick={() => selectStudent(s)}>
                      <div className="avatar" style={{ width: '36px', height: '36px', background: avBg(si), color: avTx(si), fontSize: '.82rem' }}>
                        {s.name?.split(' ').slice(-1)[0]?.slice(0, 2).toUpperCase() || '??'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: '.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                          <span className={`badge ${pb.c}`} style={{ fontSize: '.6rem', flexShrink: 0 }}>{pb.i}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                          <span style={{ fontSize: '.7rem', color: 'var(--t3)', fontFamily: 'var(--mono)' }}>{s.studentCode}</span>
                          <span style={{ fontSize: '.7rem', fontWeight: 700, color: scoreColor(s.overall_score || 0) }}>{s.overall_score || 0}/100</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Student detail */}
            {selStudent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Profile card */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', paddingBottom: '18px', borderBottom: '1px solid var(--b1)' }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <div className="avatar" style={{ width: '50px', height: '50px', fontSize: '1.1rem', background: avBg(students.indexOf(selStudent)), color: avTx(students.indexOf(selStudent)), boxShadow: '0 0 0 3px var(--bg0), 0 0 0 5px var(--b2)' }}>
                        {selStudent.name?.split(' ').slice(-1)[0]?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontFamily: 'var(--display)', fontSize: '1.15rem', fontWeight: 800 }}>{selStudent.name}</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '5px' }}>
                          <span style={{ fontSize: '.74rem', color: 'var(--t2)' }}>Mã sinh viên: <b style={{ fontFamily: 'var(--mono)' }}>{selStudent.studentCode}</b></span>
                          <span className={`badge ${(PROFILE_BADGE[selStudent.profile_type] || PROFILE_BADGE['on-track']).c}`}>
                            {(PROFILE_BADGE[selStudent.profile_type] || PROFILE_BADGE['on-track']).i} {(PROFILE_BADGE[selStudent.profile_type] || PROFILE_BADGE['on-track']).l}
                          </span>
                          {selStudent.ai_flag_count > 0 && <span className="badge bdy">🤖 {selStudent.ai_flag_count} AI flags</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.64rem', color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Điểm TB</div>
                      <div style={{ fontFamily: 'var(--display)', fontSize: '2.2rem', fontWeight: 900, color: scoreColor(selStudent.overall_score || 0), lineHeight: 1 }}>
                        {selStudent.overall_score || 0}
                      </div>
                      <div style={{ fontSize: '.66rem', color: 'var(--t3)', marginTop: '3px' }}>
                        {selStudent.trend === 'improving' ? '📈 Tốt hơn' : selStudent.trend === 'declining' ? '📉 Giảm' : '➡️ Ổn định'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '24px', alignItems: 'start' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--t3)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Biểu đồ Năng lực</div>
                      <RadarChart mastery={selStudent.conceptMastery || {}} size={190} />
                    </div>
                    <div>
                      <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--t3)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Chỉ số Thành thạo</div>
                      {Object.entries(selStudent.conceptMastery || {}).map(([c, v]: [string, any]) => (
                        <div key={c} className="cbar">
                          <span className="cbar-lbl">● {c}</span>
                          <div style={{ flex: 1 }}><div className="prog-wrap"><div className="prog-bar" style={{ width: `${v}%`, background: scoreColor(v) }} /></div></div>
                          <span className="cbar-pct" style={{ color: scoreColor(v) }}>{v}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Session history */}
                <div className="card">
                  <div style={{ fontWeight: 700, marginBottom: '14px', fontFamily: 'var(--display)' }}>📅 Lịch sử Buổi học — Click để xem code + feedback</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
                    {selSvSessions.map((sess, i) => {
                      const sb = STATUS_BADGE[sess.status] || STATUS_BADGE.pending
                      return (
                        <div key={i} className={`sess-card ${selSession?.assignment_id === sess.assignment_id ? 'active' : ''}`} onClick={() => setSelSession(sess)}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span style={{ fontSize: '.67rem', fontWeight: 700, color: 'var(--t3)' }}>B{i + 1}</span>
                            <span style={{ display: 'flex', gap: '4px' }}>
                              {(sess.process_metrics?.flags || []).some((f: string) => f.startsWith('high_paste') || f === 'burst_paste_dominant')
                                ? <span className="badge bdy" title="Tín hiệu dán code bất thường" style={{ fontSize: '.56rem' }}>📋 Paste</span> : null}
                              {sess.review_status === 'needs_review'
                                ? <span className="badge bdy" title="Chờ GV duyệt rubric LLM" style={{ fontSize: '.56rem' }}>⚖️ Duyệt</span> : null}
                              {sess.ai_suspicion_flag ? <span className="badge bdy" style={{ fontSize: '.56rem' }}>🤖 AI</span> : null}
                            </span>
                          </div>
                          <div style={{ fontSize: '.76rem', fontWeight: 600, lineHeight: 1.35, marginBottom: '8px' }}>
                            {sess.assignment_title?.replace(/Buổi \d+: /, '') || `Bài ${i + 1}`}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className={`badge ${sb.c}`} style={{ fontSize: '.58rem' }}>{sb.i} {sb.l}</span>
                            <span style={{ fontFamily: 'var(--display)', fontSize: '.92rem', fontWeight: 800, color: scoreColor(sess.score_total) }}>{sess.score_total !== null && sess.score_total !== undefined ? sess.score_total : '—'}</span>
                          </div>
                          <div style={{ fontSize: '.65rem', color: 'var(--t4)', marginTop: '5px' }}>{sess.attempt_number || 0} lần nộp</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Session detail */}
                {selSession && (
                  <div className="card animate-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '.95rem', fontFamily: 'var(--display)' }}>{selSession.assignment_title}</div>
                        <div style={{ fontSize: '.72rem', color: 'var(--t2)', marginTop: '3px' }}>{selSession.attempt_number} lần nộp · {fmtDate(selSession.submitted_at)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ fontFamily: 'var(--display)', fontSize: '1.6rem', fontWeight: 900, color: scoreColor(selSession.score_total) }}>{selSession.score_total !== null && selSession.score_total !== undefined ? selSession.score_total : '—'}</div>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowStudentGraph(v => !v)}>
                          {showStudentGraph ? '📄 Ẩn Graph' : '🔬 Xem Graph'}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
                      {[{ n: 'T1 Correctness', v: selSession.score_t1, max: 40, c: 'var(--bl)' }, { n: 'T2 Code Quality', v: selSession.score_t2, max: 35, c: 'var(--pu)' }, { n: 'T3 CT', v: selSession.score_t3, max: 25, c: 'var(--or)' }].map(t => (
                        <div key={t.n} className="tier-blk" style={{ borderColor: t.c }}>
                          <div style={{ fontSize: '.62rem', fontWeight: 700, color: 'var(--t3)', marginBottom: '4px' }}>{t.n}</div>
                          <div style={{ fontFamily: 'var(--display)', fontSize: '1.25rem', fontWeight: 800, color: t.c }}>{t.v || 0}<span style={{ fontSize: '.72rem' }}>/{t.max}</span></div>
                          <div className="prog-wrap" style={{ marginTop: '6px' }}><div className="prog-bar" style={{ width: `${((t.v || 0) / t.max) * 100}%`, background: t.c }} /></div>
                        </div>
                      ))}
                    </div>

                    {selSession.llm_feedback && (
                      <div className={`fb ${selSession.status === 'passed' ? 'fb-pass' : selSession.status === 'failed' ? 'fb-fail' : 'fb-warn'}`} style={{ marginBottom: '12px' }}>
                        <div className="fb-lbl">🤖 LLM Analysis Feedback</div>
                        <div style={{ whiteSpace: 'pre-line' }}>{selSession.llm_feedback}</div>
                      </div>
                    )}
                    {selSession.ai_suspicion_flag && (
                      <div className="fb fb-ai" style={{ marginBottom: '12px' }}>
                        <div className="fb-lbl" style={{ color: '#f97316' }}>🚨 AI-Generated Code — Confidence: {Math.round(selSession.ai_suspicion_confidence * 100)}%</div>
                        <div style={{ color: '#fed7aa' }}>{selSession.ai_suspicion_reason}</div>
                      </div>
                    )}

                    {/* Phase 1: Process analytics — hành vi làm bài */}
                    <ProcessPanel submissionId={selSession.id} />

                    {selSession.code && (
                      showStudentGraph ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                          <div>
                            <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--t3)', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '.06em' }}>💻 Code Sinh viên</div>
                            <CodeBlock code={selSession.code} lang={selSession.lang || 'C++'} />
                          </div>
                          <div>
                            <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--t3)', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '.06em' }}>🔬 Knowledge Graph</div>
                            <CodeGraph
                              code={selSession.code}
                              lang={selSession.lang || 'C++'}
                              concepts={selSession.concepts || []}
                              height={360}
                              title={`Code Graph — ${selStudent.name?.split(' ').pop()}`}
                              compact={false}
                            />
                          </div>
                        </div>
                      ) : (
                        <CodeBlock code={selSession.code} lang={selSession.lang || 'C++'} />
                      )
                    )}
                  </div>
                )}

                {selStudent.misconceptions?.length > 0 && (
                  <div className="card">
                    <div style={{ fontWeight: 700, marginBottom: '12px', fontFamily: 'var(--display)' }}>🧠 Lỗi Tư duy Tích lũy</div>
                    {selStudent.misconceptions.map((m: string, i: number) => <div key={i} className="misc"><span>⚠️</span>{m}</div>)}
                  </div>
                )}

                {/* ── Storm v4: Chat Log Viewer ── */}
                {Object.keys(selStudentChatLog).length > 0 && (
                  <div className="card">
                    <div style={{ fontWeight: 700, marginBottom: '5px', fontFamily: 'var(--display)' }}>💬 Lịch sử Chat AI — {selStudent.name?.split(' ').pop()}</div>
                    <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginBottom: '16px' }}>Cuộc trò chuyện giữa sinh viên và AI trợ giảng</div>
                    {asgns.filter((a: any) => selStudentChatLog[a.id]).map((a: any) => {
                      const log = selStudentChatLog[a.id]
                      return (
                        <details key={a.id} style={{ marginBottom: '12px' }}>
                          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '.84rem', padding: '8px', borderRadius: 'var(--r8)', background: 'var(--bg3)', border: '1px solid var(--b1)', userSelect: 'none' }}>
                            📋 {a.title} · <span style={{ color: 'var(--t3)', fontWeight: 400 }}>{log.messages?.length} tin nhắn</span>
                          </summary>
                          <div style={{ padding: '12px 0 4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {log.messages?.map((msg: any) => (
                              <div key={msg.id} style={{ display: 'flex', gap: '8px', justifyContent: msg.sender === 'student' ? 'flex-end' : 'flex-start' }}>
                                <div style={{
                                  maxWidth: '80%', padding: '8px 12px', borderRadius: msg.sender === 'student' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                  background: msg.sender === 'student' ? 'var(--rg3)' : 'var(--bg3)',
                                  border: `1px solid ${msg.sender === 'student' ? 'var(--rg)' : 'var(--b1)'}`,
                                  fontSize: '.78rem', lineHeight: 1.55,
                                }}>
                                  <div style={{ fontWeight: 600, fontSize: '.67rem', color: 'var(--t3)', marginBottom: '4px' }}>
                                    {msg.sender === 'student' ? '👤 Sinh viên' : '🤖 AI'} · {new Date(msg.sent_at).toLocaleTimeString('vi')}
                                  </div>
                                  {msg.content.substring(0, 200)}{msg.content.length > 200 ? '...' : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )
                    })}
                    {Object.keys(selStudentChatLog).length === 0 && (
                      <div style={{ color: 'var(--t3)', fontSize: '.84rem', textAlign: 'center', padding: '20px' }}>
                        Sinh viên chưa có cuộc hội thoại nào với AI
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👆</div>
                <div style={{ fontWeight: 600, color: 'var(--t2)', fontFamily: 'var(--display)' }}>Chọn một sinh viên để xem hồ sơ năng lực chi tiết</div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: EWS ── */}
        {activeTab === 'ews' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }} className="g2 animate-fade-in">
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: '.92rem', marginBottom: '5px', fontFamily: 'var(--display)' }}>🚨 At-Risk Students</div>
              <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginBottom: '16px' }}>Phát hiện qua điểm số, lịch sử nộp và LLM analysis</div>
              {ewsData?.atRisk?.map((s: any) => (
                <div key={s.id} className="ews ews-d" style={{ flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div className="avatar" style={{ width: '36px', height: '36px', background: avBg(students.findIndex(x => x.id === s.id)), color: avTx(students.findIndex(x => x.id === s.id)), fontSize: '.78rem' }}>
                      {s.name?.split(' ').slice(-1)[0]?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <b style={{ fontSize: '.88rem' }}>{s.name} ({s.studentCode})</b><br />
                      <span style={{ fontSize: '.73rem', color: 'var(--t2)' }}>Điểm: {s.overall_score}/100 · Risk: {Math.round(s.risk_score * 100)}%</span>
                    </div>
                  </div>
                  {JSON.parse(s.misconceptions_json || '[]').slice(0, 2).map((m: string, i: number) => <div key={i} className="misc" style={{ fontSize: '.72rem' }}>{m}</div>)}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-sm btn-danger" onClick={() => toast(`Đã gửi cảnh báo đến ${s.name}`)}>📧 Gửi cảnh báo</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => { setActiveTab('students'); selectStudent(students.find(x => x.id === s.id)) }}>👁️ Xem hồ sơ</button>
                  </div>
                </div>
              ))}
              {!ewsData?.atRisk?.length && <div style={{ textAlign: 'center', color: 'var(--gn)', padding: '24px', fontSize: '.85rem' }}>✅ Không có sinh viên nguy cơ cao</div>}
            </div>

            <div className="card">
              <div style={{ fontWeight: 700, fontSize: '.92rem', marginBottom: '5px', fontFamily: 'var(--display)' }}>🤖 AI-Generated Code Alerts</div>
              <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginBottom: '16px' }}>Phát hiện phong cách code bất thường qua nhiều buổi</div>
              {ewsData?.aiWarning?.map((s: any) => (
                <div key={s.id} className="ews ews-w" style={{ flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div className="avatar" style={{ width: '36px', height: '36px', background: avBg(students.findIndex(x => x.id === s.id)), color: avTx(students.findIndex(x => x.id === s.id)), fontSize: '.78rem' }}>
                      {s.name?.split(' ').slice(-1)[0]?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <b style={{ fontSize: '.88rem' }}>{s.name} ({s.studentCode})</b><br />
                      <span style={{ fontSize: '.73rem', color: 'var(--t2)' }}>{s.ai_flag_count} buổi bị cảnh báo AI</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => toast(`Đã lên lịch phỏng vấn ${s.name}`)}>🎤 Lên lịch phỏng vấn</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => { setActiveTab('students'); selectStudent(students.find(x => x.id === s.id)) }}>👁️ Xem</button>
                  </div>
                </div>
              ))}
              {!ewsData?.aiWarning?.length && <div style={{ textAlign: 'center', color: 'var(--gn)', padding: '24px', fontSize: '.85rem' }}>✅ Không có nghi vấn AI</div>}
            </div>

            {/* Rubric overview */}
            <div className="card" style={{ gridColumn: '1/-1' }}>
              <div style={{ fontWeight: 700, fontSize: '.92rem', marginBottom: '18px', fontFamily: 'var(--display)' }}>📊 Rubric 3 Tầng — Phân tích Chi tiết</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
                {[
                  { n: 'Tầng 1: Correctness', desc: 'Cú pháp · Chức năng · Edge cases', max: 40, c: 'var(--bl)', items: ['Cú pháp đúng (10đ)', 'Pass test cases cơ bản (20đ)', 'Xử lý edge cases (10đ)'] },
                  { n: 'Tầng 2: Code Quality', desc: 'Đặt tên · Tài liệu · Cấu trúc · Idiomatic', max: 35, c: 'var(--pu)', items: ['Đặt tên biến/hàm rõ (10đ)', 'Comment phù hợp (8đ)', 'Cấu trúc rõ ràng (12đ)', 'Idiomatic code (5đ)'] },
                  { n: 'Tầng 3: Comp. Thinking', desc: 'Phân rã · Trừu tượng · Tái sử dụng', max: 25, c: 'var(--or)', items: ['Phân rã bài toán (8đ)', 'Trừu tượng hóa (7đ)', 'Tái sử dụng pattern (5đ)', 'Chiến lược Debug (5đ)'] },
                ].map(t => (
                  <div key={t.n} style={{ background: 'var(--bg3)', border: '1px solid var(--b1)', borderRadius: 'var(--r14)', padding: '20px', borderTop: `3px solid ${t.c}` }}>
                    <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: '4px', fontFamily: 'var(--display)' }}>{t.n}</div>
                    <div style={{ fontSize: '.71rem', color: 'var(--t3)', marginBottom: '12px' }}>{t.desc}</div>
                    <div style={{ fontFamily: 'var(--display)', fontSize: '1.8rem', fontWeight: 900, color: t.c, marginBottom: '8px' }}>/{t.max}</div>
                    {t.items.map(it => (
                      <div key={it} style={{ fontSize: '.72rem', color: 'var(--t2)', display: 'flex', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ color: t.c, flexShrink: 0 }}>•</span>{it}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: MISCONCEPTIONS (Storm v4) ── */}
        {activeTab === 'misconceptions' && (
          <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', alignItems: 'start' }}>
            {/* Sidebar: top misconceptions */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: '.92rem', marginBottom: '5px', fontFamily: 'var(--display)' }}>🧠 Top Ngộ nhận Phổ biến</div>
              <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginBottom: '16px' }}>Số sinh viên mắc mỗi lỗi tư duy</div>
              {!miscData?.stats?.length ? (
                <div style={{ textAlign: 'center', color: 'var(--gn)', padding: '32px 0', fontSize: '.85rem' }}>✅ Chưa ghi nhận ngộ nhận nào</div>
              ) : miscData.stats.map((m: any) => (
                <div key={m.concept}
                  onClick={() => setMiscSelected(miscSelected === m.concept ? null : m.concept)}
                  style={{
                    padding: '10px 12px', borderRadius: 'var(--r10)', marginBottom: '8px', cursor: 'pointer',
                    border: `1px solid ${miscSelected === m.concept ? 'var(--rg)' : 'var(--b1)'}`,
                    background: miscSelected === m.concept ? 'var(--rg3)' : 'var(--bg3)',
                    transition: 'all .15s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '.84rem' }}>⚠️ {m.concept}</span>
                    <span className="badge" style={{ background: 'rgba(248,113,113,.15)', color: '#f87171', fontSize: '.68rem' }}>
                      {m.student_count} SV
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--b1)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(m.student_count / students.length) * 100}%`, background: '#f87171', borderRadius: 3, transition: 'width .4s' }} />
                  </div>
                  <div style={{ fontSize: '.67rem', color: 'var(--t3)', marginTop: '4px' }}>
                    {m.occurrence_count} lần xuất hiện · {m.student_names?.split(',').slice(0, 3).join(', ')}
                  </div>
                </div>
              ))}
            </div>

            {/* Detail panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Score distribution chart */}
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: '.92rem', marginBottom: '5px', fontFamily: 'var(--display)' }}>📊 Phân bổ Điểm Tổng — Toàn lớp</div>
                <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginBottom: '20px' }}>Theo thang điểm 100</div>
                {(() => {
                  const ranges = [
                    { label: '0–39', color: '#f87171', min: 0, max: 39 },
                    { label: '40–59', color: '#fb923c', min: 40, max: 59 },
                    { label: '60–69', color: '#fbbf24', min: 60, max: 69 },
                    { label: '70–79', color: '#34d399', min: 70, max: 79 },
                    { label: '80–89', color: '#60a5fa', min: 80, max: 89 },
                    { label: '90–100', color: '#a78bfa', min: 90, max: 100 },
                  ]
                  const allScores = students.map((s: any) => s.overall_score || 0)
                  const maxCount = Math.max(...ranges.map(r => allScores.filter(s => s >= r.min && s <= r.max).length), 1)
                  return (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', height: 140, padding: '0 4px' }}>
                      {ranges.map(r => {
                        const count = allScores.filter(s => s >= r.min && s <= r.max).length
                        return (
                          <div key={r.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                            <div style={{ fontSize: '.75rem', fontWeight: 700, color: r.color }}>{count}</div>
                            <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', height: 90 }}>
                              <div style={{
                                width: '100%', height: `${count === 0 ? 4 : (count / maxCount) * 90}px`,
                                background: r.color, borderRadius: '4px 4px 0 0',
                                opacity: 0.85, transition: 'height .4s',
                              }} />
                            </div>
                            <div style={{ fontSize: '.67rem', color: 'var(--t3)', textAlign: 'center' }}>{r.label}</div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>

              {/* Misconception detail for selected concept */}
              {miscSelected && (
                <div className="card">
                  <div style={{ fontWeight: 700, fontSize: '.92rem', marginBottom: '16px', fontFamily: 'var(--display)' }}>
                    🔍 Chi tiết: <span style={{ color: '#f87171' }}>{miscSelected}</span>
                  </div>
                  {miscData?.details?.filter((d: any) => d.concept === miscSelected).map((d: any, i: number) => (
                    <div key={i} style={{ padding: '12px', border: '1px solid var(--b1)', borderRadius: 'var(--r10)', marginBottom: '10px', background: 'var(--bg3)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontWeight: 600, fontSize: '.85rem' }}>👤 {d.student_name}</div>
                        <div style={{ fontSize: '.72rem', color: 'var(--t3)' }}>📋 {d.assignment_title} · {fmtDate(d.detected_at)}</div>
                      </div>
                      {d.description && (
                        <div style={{ fontSize: '.78rem', color: 'var(--t2)', marginBottom: '8px', lineHeight: 1.6 }}>📌 {d.description}</div>
                      )}
                      {d.student_code && (
                        <details style={{ cursor: 'pointer' }}>
                          <summary style={{ fontSize: '.72rem', color: 'var(--t3)', marginBottom: '6px' }}>💻 Xem code của sinh viên</summary>
                          <CodeBlock code={d.student_code.substring(0, 400)} lang="C++" />
                        </details>
                      )}
                    </div>
                  ))}
                  {!miscData?.details?.filter((d: any) => d.concept === miscSelected).length && (
                    <div style={{ color: 'var(--t3)', fontSize: '.84rem', textAlign: 'center', padding: '20px' }}>Chưa có chi tiết</div>
                  )}
                </div>
              )}

              {!miscSelected && (
                <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--t3)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🧠</div>
                  <div style={{ fontWeight: 600 }}>Chọn một ngộ nhận để xem chi tiết sinh viên</div>
                  <div style={{ fontSize: '.8rem', marginTop: '8px' }}>Bao gồm code minh họa lỗi</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: REVIEW QUEUE (Phase 2 — mixed-initiative) ── */}
        {activeTab === 'review' && (
          <div className="animate-fade-in">
            <ReviewQueue />
          </div>
        )}

        {/* ── TAB: RESEARCH EXPORT (Phase 4A+B) ── */}
        {activeTab === 'research' && (
          <div className="animate-fade-in">
            <ResearchPanel classroomId={classId || undefined} />
          </div>
        )}
      </div>

      {/* ── Create Assignment Modal ── */}
      {showCreateAsgn && (
        <div className="ov2 open" onClick={e => e.target === e.currentTarget && setShowCreateAsgn(false)}>
          <div className="mp2" style={{ maxWidth: '780px', width: '96vw', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--b1)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 10,
            }}>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: '1.05rem' }}>+ Tạo Bài tập Mới</div>
              <button style={{ background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px 8px' }} onClick={() => { setShowCreateAsgn(false); setShowSampleGraph(false) }}>✕</button>
            </div>
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '12px' }}>
                <div><label className="label">Tên buổi học *</label><input className="input" placeholder="VD: Buổi 7: Con trỏ & Địa chỉ" value={newAsgn.title} onChange={e => setNewAsgn({ ...newAsgn, title: e.target.value })} /></div>
                <div>
                  <label className="label">Ngôn ngữ</label>
                  <select className="input" value={newAsgn.lang} onChange={e => setNewAsgn({ ...newAsgn, lang: e.target.value, concepts: [] })}>
                    {['C++', 'C', 'Python', 'JavaScript', 'TypeScript', 'Java'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Đề bài / Yêu cầu</label><textarea className="input" rows={3} placeholder="Mô tả yêu cầu bài tập, input/output mong đợi..." value={newAsgn.description} onChange={e => setNewAsgn({ ...newAsgn, description: e.target.value })} /></div>
              <div><label className="label">Deadline</label><input className="input" type="datetime-local" value={newAsgn.deadline} onChange={e => setNewAsgn({ ...newAsgn, deadline: e.target.value })} /></div>
              <div>
                <label className="label" style={{ marginBottom: '9px', display: 'block' }}>🏷️ Khái niệm cần đánh giá</label>
                <ConceptTagInput value={newAsgn.concepts} onChange={tags => setNewAsgn({ ...newAsgn, concepts: tags })} lang={newAsgn.lang} />
                {newAsgn.concepts.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '9px' }}>
                    {newAsgn.concepts.map(c => <span key={c} className="badge bdp">★ {c}</span>)}
                  </div>
                )}
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '9px' }}>
                  <label className="label" style={{ marginBottom: 0 }}>💡 Đáp án Mẫu <span style={{ color: 'var(--t3)', fontWeight: 400, fontSize: '.72rem' }}>(chỉ giảng viên thấy)</span></label>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowSampleGraph(s => !s)} disabled={!newAsgn.sample_code.trim()}>
                    {showSampleGraph ? '📄 Ẩn Graph' : '🔬 Xem Graph'}
                  </button>
                </div>
                <textarea
                  className="input"
                  style={{ fontFamily: 'var(--mono)', fontSize: '.78rem', minHeight: '160px', lineHeight: 1.7, background: 'var(--bg0)' }}
                  placeholder={`// Nhập đáp án mẫu cho ${newAsgn.lang}...`}
                  value={newAsgn.sample_code}
                  onChange={e => setNewAsgn({ ...newAsgn, sample_code: e.target.value })}
                />
                {showSampleGraph && newAsgn.sample_code.trim() && (
                  <div style={{ marginTop: '13px' }}>
                    <CodeGraph code={newAsgn.sample_code} lang={newAsgn.lang} concepts={newAsgn.concepts} height={360} title="Knowledge Graph — Đáp án Mẫu" />
                  </div>
                )}
              </div>
              {/* Phase 3: Exam Mode */}
              <div style={{ border: '1px solid var(--b1)', borderRadius: '10px', padding: '14px', background: newAsgn.is_exam ? 'var(--bg3)' : 'transparent' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '.9rem' }}>
                  <input type="checkbox" checked={newAsgn.is_exam} onChange={e => setNewAsgn({ ...newAsgn, is_exam: e.target.checked, allow_paste: e.target.checked ? false : true, require_fullscreen: e.target.checked ? true : false })} />
                  📝 Chế độ Thi có giám sát (Exam Mode)
                </label>
                {newAsgn.is_exam && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px' }}>
                      <div><label className="label">Thời lượng (phút) *</label><input className="input" type="number" min={5} max={300} value={newAsgn.duration_minutes} onChange={e => setNewAsgn({ ...newAsgn, duration_minutes: +e.target.value })} /></div>
                      <div><label className="label">Giấu điểm đến</label><input className="input" type="datetime-local" value={newAsgn.hide_scores_until} onChange={e => setNewAsgn({ ...newAsgn, hide_scores_until: e.target.value })} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.82rem' }}><input type="checkbox" checked={!!newAsgn.allow_paste} onChange={e => setNewAsgn({ ...newAsgn, allow_paste: e.target.checked })} /> Cho phép dán (paste)</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.82rem' }}><input type="checkbox" checked={!!newAsgn.require_fullscreen} onChange={e => setNewAsgn({ ...newAsgn, require_fullscreen: e.target.checked })} /> Yêu cầu fullscreen</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.82rem' }}><input type="checkbox" checked={!!newAsgn.shuffle_questions} onChange={e => setNewAsgn({ ...newAsgn, shuffle_questions: e.target.checked })} /> Trộn đề (shuffle test order)</label>
                    </div>
                    <div style={{ fontSize: '.7rem', color: 'var(--t3)' }}>Thi: 1 lần nộp duy nhất • Hết giờ auto-nộp • Điểm ẩn tới khi GV công bố (đóng bài hoặc hết hide_until) • Ghi nhận paste/fullscreen/focus.</div>
                  </div>
                )}
              </div>
              <div>
                <label className="label" style={{ marginBottom: '9px', display: 'block' }}>⚖️ Trọng số Rubric 3 Tầng</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[['T1: Correctness', 'weight_t1', 'var(--bl)'], ['T2: Code Quality', 'weight_t2', 'var(--pu)'], ['T3: Comp. Thinking', 'weight_t3', 'var(--or)']].map(([lbl, key, c]) => (
                    <div key={key} style={{ flex: 1 }}>
                      <div style={{ fontSize: '.72rem', color: c, marginBottom: '4px', fontWeight: 600 }}>{lbl}</div>
                      <input className="input" type="number" min={5} max={70} value={(newAsgn as any)[key]} onChange={e => setNewAsgn({ ...newAsgn, [key]: +e.target.value })} />
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '.68rem', color: 'var(--t3)', marginTop: '6px' }}>Tổng: {newAsgn.weight_t1 + newAsgn.weight_t2 + newAsgn.weight_t3}/100 điểm</div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '6px', padding: '12px' }} onClick={createAssignment}>
                ✓ Tạo bài tập & thông báo sinh viên
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
