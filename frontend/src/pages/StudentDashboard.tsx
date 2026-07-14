// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { classrooms, assignments, submissions, profiles } from '../api'
import { RadarChart, scoreColor, PROFILE_BADGE, STATUS_BADGE, Loader, useToast, fmtDate, CodeBlock, CON_LBL, CON_EM } from '../components/ui'
import CodeGraph from '../components/CodeGraph'

const PIPE_STEPS = [
  { i: '📨', n: 'Nhận bài nộp', d: 'Xác thực file code, kiểm tra định dạng' },
  { i: '🔍', n: 'UA Scanner — AST', d: 'Phân tích cú pháp, xây dựng call graph' },
  { i: '📐', n: 'Static Analysis', d: 'Naming conventions, cyclomatic complexity' },
  { i: '⚙️', n: 'Test Runner', d: 'Chạy test cases, kiểm tra output đúng đắn' },
  { i: '🧠', n: 'LLM Rubric Analysis', d: 'Correctness + Code Quality + Computational Thinking' },
  { i: '💾', n: 'Cập nhật Hồ sơ', d: 'Merge kết quả vào student profile' },
]

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { toast, ToastContainer } = useToast()

  const [classroom, setClassroom] = useState<any>(null)
  const [asgns, setAsgns] = useState<any[]>([])
  const [myProfile, setMyProfile] = useState<any>(null)
  const [mySubs, setMySubs] = useState<Record<number, any>>({})
  const [activeTab, setActiveTab] = useState('asgn')
  const [selAsgn, setSelAsgn] = useState<any>(null)
  const [code, setCode] = useState('')
  const [pipeState, setPipeState] = useState<('idle' | 'active' | 'done')[]>(PIPE_STEPS.map(() => 'idle'))
  const [submitting, setSubmitting] = useState(false)
  const [subResult, setSubResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [classId, setClassId] = useState<number | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const rooms: any[] = await classrooms.list()
      if (!rooms.length) return setLoading(false)
      const room = rooms[0]; setClassroom(room); setClassId(room.id)
      const [asgnList, prof] = await Promise.all([assignments.byClassroom(room.id), profiles.me(room.id)])
      setAsgns(asgnList); setMyProfile(prof)
      if (asgnList.length > 0) setSelAsgn(asgnList.find((a: any) => a.status === 'open') || asgnList[asgnList.length - 1])
      const subsMap: Record<number, any> = {}
      for (const a of asgnList) {
        const subs = await submissions.my(a.id)
        if (subs?.length) subsMap[a.id] = subs[0]
      }
      setMySubs(subsMap)
    } catch (e: any) { toast(e.error || 'Lỗi tải dữ liệu', true) }
    finally { setLoading(false) }
  }

  async function submit() {
    if (!selAsgn || !code.trim()) { toast('Vui lòng chọn bài tập và nhập code', true); return }
    if (selAsgn.status === 'closed') { toast('Bài tập đã đóng', true); return }
    setSubmitting(true); setSubResult(null)
    setPipeState(PIPE_STEPS.map(() => 'idle'))
    try {
      const res = await submissions.submit(selAsgn.id, code)
      const subId = res.id
      for (let i = 0; i < PIPE_STEPS.length; i++) {
        setPipeState(s => s.map((x, j) => j === i ? 'active' : x))
        await new Promise(r => setTimeout(r, 900 + Math.random() * 400))
        setPipeState(s => s.map((x, j) => j === i ? 'done' : x))
      }
      let result: any = null
      for (let t = 0; t < 15; t++) {
        await new Promise(r => setTimeout(r, 500))
        try {
          result = await submissions.poll(subId)
          if (result.status !== 'pending') break
        } catch { break }
      }
      setSubResult(result)
      toast('Phân tích hoàn tất!')
      const subs = await submissions.my(selAsgn.id)
      setMySubs(prev => ({ ...prev, [selAsgn.id]: subs?.[0] }))
      const prof = await profiles.me(classId || undefined)
      setMyProfile(prof)
    } catch (e: any) { toast(e.error || 'Lỗi nộp bài', true) }
    finally { setSubmitting(false) }
  }

  if (loading) return <div style={{ minHeight: '100vh', background: 'var(--bg0)', display: 'flex' }}><Loader /></div>

  const pb = myProfile ? (PROFILE_BADGE[myProfile.profile_type] || PROFILE_BADGE['on-track']) : PROFILE_BADGE['on-track']
  const passCount = Object.values(mySubs).filter((s: any) => s?.status === 'passed').length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg0)', display: 'flex', flexDirection: 'column' }}>
      <ToastContainer />

      {/* ── Nav ── */}
      <nav className="nav">
        <div className="nav-brand">
          <div className="nav-logo" style={{ fontFamily: 'var(--display)', fontWeight: 900 }}>🔬</div>
          <span style={{ fontFamily: 'var(--display)' }}>
            NEU-CodeLens <span style={{ color: 'var(--t3)', fontWeight: 400, fontSize: '.85rem' }}>Skills Lab</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {myProfile && <span className={`badge ${pb.c}`}>{pb.i} {pb.l} · {myProfile.overall_score || 0}/100</span>}
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--bl), hsl(213,80%,50%))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#fff', boxShadow: '0 0 0 2px var(--bg0), 0 0 0 4px var(--b2)', fontFamily: 'var(--display)' }}>
            {user?.name?.split(' ').pop()?.[0] ?? 'S'}
          </div>
          <div style={{ fontSize: '.82rem', color: 'var(--t2)', fontWeight: 500 }}>{user?.name}</div>
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login') }}>Đăng xuất</button>
        </div>
      </nav>

      <div className="page-wrap">
        {/* ── Page Header ── */}
        <div style={{ marginBottom: '28px' }} className="animate-fade-in-up">
          <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' }}>
            {myProfile && <span className={`badge ${pb.c}`}>{pb.i} {pb.l}</span>}
            <span className="badge bdp">LTCB-2026A · C++ Căn bản</span>
          </div>
          <h1 style={{
            fontFamily: 'var(--display)',
            fontSize: 'clamp(1.4rem, 3vw, 1.8rem)',
            fontWeight: 800,
            letterSpacing: '-.02em',
            marginBottom: '6px',
          }}>
            Xin chào, {user?.name?.split(' ').pop()} 👋
          </h1>
          <p style={{ color: 'var(--t2)', fontSize: '.85rem' }}>Theo dõi tiến trình học lập trình của bạn qua từng buổi</p>

          <div style={{ marginTop: '14px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/chat${selAsgn ? `?asgnId=${selAsgn.id}` : ''}`)}>
              💬 Hỏi đáp AI về bài tập
            </button>
          </div>
        </div>

        {/* ── Quick Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }} className="animate-fade-in-up">
          {[
            { v: `${passCount}/${asgns.length}`, c: 'var(--gn)', l: 'Buổi Pass', i: '✅' },
            { v: myProfile?.overall_score || 0, c: scoreColor(myProfile?.overall_score || 0), l: 'Điểm TB', i: '🎯' },
            { v: Object.values(mySubs).length, c: 'var(--bl)', l: 'Đã nộp', i: '📤' },
            { v: (myProfile?.misconceptions || []).length, c: '#f87171', l: 'Misconceptions', i: '⚠️' },
          ].map(x => (
            <div key={x.l} className="stat-card">
              <div>
                <div className="stat-lbl">{x.l}</div>
                <div className="stat-val" style={{ color: x.c, fontSize: '1.6rem' }}>{x.v}</div>
              </div>
              <div className="stat-icon" style={{ background: `${x.c}18`, fontSize: '1.3rem' }}>{x.i}</div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="tabs" style={{ marginBottom: '24px' }}>
          {[['asgn', '📋 Bài tập của tôi'], ['submit', '📤 Nộp bài'], ['profile', '🎯 Hồ sơ Năng lực']].map(([id, lbl]) => (
            <button key={id} className={`tab ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>{lbl}</button>
          ))}
        </div>

        {/* ── TAB: ASSIGNMENTS ── */}
        {activeTab === 'asgn' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }} className="g2 animate-fade-in">
            <div>
              <div style={{ fontWeight: 700, marginBottom: '16px', color: 'var(--t2)', fontSize: '.82rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                📋 Bài tập — {classroom?.name}
              </div>
              {asgns.map((a) => {
                const sub = mySubs[a.id]
                const sb = sub ? (STATUS_BADGE[sub.status] || STATUS_BADGE.pending) : STATUS_BADGE.pending
                return (
                  <div key={a.id} className="card card-sm" style={{
                    marginBottom: '12px',
                    borderColor: a.status === 'open' ? 'var(--rg)' : undefined,
                    background: a.status === 'open' ? 'var(--rg3)' : undefined,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '7px' }}>
                          <span className={`badge ${a.status === 'open' ? 'bdr' : 'bdn'}`}>{a.status === 'open' ? '🟢 Đang mở' : '⚫ Đã đóng'}</span>
                          <span className={`badge ${sb.c}`}>{sb.i} {sb.l}</span>
                          {sub?.ai_suspicion_flag ? <span className="badge bdy">🤖 AI Warning</span> : null}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: '4px' }}>{a.title}</div>
                        <div style={{ fontSize: '.78rem', color: 'var(--t2)' }}>{a.description?.substring(0, 90)}...</div>
                        <div style={{ fontSize: '.7rem', color: 'var(--t3)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🗓 DL: {fmtDate(a.deadline)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <div style={{
                          width: '56px', height: '56px',
                          borderRadius: '50%',
                          background: `conic-gradient(${scoreColor(sub?.score_total || 0)} ${((sub?.score_total || 0) / 100) * 360}deg, var(--bg4) 0deg)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          position: 'relative',
                        }}>
                          <div style={{
                            width: '42px', height: '42px',
                            borderRadius: '50%',
                            background: 'var(--bg2)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: 900, fontFamily: 'var(--display)', color: scoreColor(sub?.score_total || 0), lineHeight: 1 }}>
                              {sub?.score_total || '—'}
                            </span>
                          </div>
                        </div>
                        {a.status === 'open' && (
                          <button className="btn btn-primary btn-sm" style={{ marginTop: '8px', fontSize: '.72rem' }} onClick={() => { setSelAsgn(a); setActiveTab('submit') }}>
                            📤 Nộp
                          </button>
                        )}
                      </div>
                    </div>
                    {sub?.llm_feedback && (
                      <div style={{ marginTop: '12px', padding: '10px 13px', background: 'var(--bg3)', borderRadius: 'var(--r8)', borderLeft: `3px solid ${sub.status === 'passed' ? '#34d399' : sub.status === 'failed' ? '#f87171' : '#fbbf24'}` }}>
                        <div style={{ fontSize: '.63rem', fontWeight: 700, color: 'var(--t3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.06em' }}>🤖 LLM Feedback</div>
                        <div style={{ fontSize: '.78rem', color: 'var(--t2)', lineHeight: 1.6 }}>{sub.llm_feedback.substring(0, 140)}...</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Summary sidebar */}
            <div className="card card-sm">
              <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: '16px' }}>📊 Tóm tắt của tôi</div>
              {myProfile && (
                <>
                  <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--t3)', marginBottom: '10px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Radar Năng lực
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                    <RadarChart mastery={myProfile.conceptMastery || {}} size={240} />
                  </div>
                  <div className="divider" style={{ marginBottom: '14px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(myProfile.conceptMastery || {}).slice(0, 5).map(([c, v]: [string, any]) => (
                      <div key={c} className="cbar">
                        <div className="cbar-lbl">{c}</div>
                        <div className="prog-wrap" style={{ flex: 1, height: '4px' }}>
                          <div className="prog-bar" style={{ width: `${v}%`, background: scoreColor(v) }} />
                        </div>
                        <div className="cbar-pct" style={{ color: scoreColor(v) }}>{v}%</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: SUBMIT ── */}
        {activeTab === 'submit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="animate-fade-in">

            {/* Top row: selector + code editor side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '18px', alignItems: 'start' }} className="g2">
              {/* Assignment selector */}
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📋 Chọn Bài tập
                </div>
                {asgns.filter(a => a.status === 'open').map(a => (
                  <div key={a.id} onClick={() => setSelAsgn(a)} style={{
                    padding: '11px 14px',
                    borderRadius: 'var(--r10)',
                    border: `1px solid ${selAsgn?.id === a.id ? 'var(--rg)' : 'var(--b1)'}`,
                    background: selAsgn?.id === a.id ? 'var(--rg3)' : 'var(--bg3)',
                    cursor: 'pointer', marginBottom: '7px',
                    transition: 'all var(--t-fast) var(--ease)',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{a.title}</div>
                    <div style={{ fontSize: '.7rem', color: 'var(--t3)', marginTop: '3px' }}>📅 DL: {fmtDate(a.deadline)}</div>
                  </div>
                ))}
                {selAsgn && (
                  <div style={{ background: 'var(--bg3)', borderRadius: 'var(--r10)', padding: '12px', border: '1px solid var(--b1)', marginTop: '12px' }}>
                    <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--t3)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>📖 Đề bài</div>
                    <div style={{ fontSize: '.84rem', lineHeight: 1.7 }}>{selAsgn.description}</div>
                    <div style={{ display: 'flex', gap: '5px', marginTop: '10px', flexWrap: 'wrap' }}>
                      {(selAsgn.concepts || []).map((c: string) => (
                        <span key={c} className="badge bdp">{CON_EM[c]} {CON_LBL[c]}</span>
                      ))}
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ marginTop: '10px', width: '100%', justifyContent: 'center' }}
                      onClick={() => navigate(`/chat?asgnId=${selAsgn.id}`)}
                    >
                      💬 Hỏi AI về bài này
                    </button>
                  </div>
                )}
              </div>

              {/* Code editor */}
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>💻 Viết hoặc dán Code</span>
                  {selAsgn && <span className="badge bdn" style={{ fontSize: '.65rem' }}>{selAsgn.lang || 'C++'}</span>}
                </div>
                <textarea
                  className="input"
                  style={{ fontFamily: 'var(--mono)', fontSize: '.82rem', minHeight: '320px', lineHeight: 1.8, background: 'var(--bg0)', borderColor: 'var(--b1)' }}
                  placeholder={'#include <iostream>\nusing namespace std;\n\nint main() {\n    // Viết code tại đây...\n    return 0;\n}'}
                  value={code}
                  onChange={e => setCode(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '10px', marginTop: '13px', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={submit} disabled={submitting || !selAsgn}>
                    {submitting ? <><span className="spin" />Đang phân tích...</> : '🚀 Nộp bài & Phân tích'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setCode('#include <iostream>\nusing namespace std;\n\nvoid sapXep(int a[], int n) {\n    for (int i = 0; i < n-1; i++)\n        for (int j = i+1; j < n; j++)\n            if (a[i] > a[j]) {\n                int t = a[i]; a[i] = a[j]; a[j] = t;\n            }\n}\n\nint main() {\n    int n;\n    cout << "Nhap so phan tu: ";\n    cin >> n;\n    int a[100];\n    for (int i = 0; i < n; i++) cin >> a[i];\n    sapXep(a, n);\n    for (int i = 0; i < n; i++) cout << a[i] << " ";\n    return 0;\n}')}>
                    📝 Code mẫu
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setCode('')}>
                    🗑 Xoá
                  </button>
                </div>
              </div>
            </div>

            {/* Pipeline — full width */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚙️ <span>LLM + UA Analysis Pipeline</span>
                {submitting && <span className="badge bdy" style={{ fontSize: '.63rem' }}>⏳ Đang xử lý...</span>}
                {!submitting && pipeState.every(p => p === 'done') && <span className="badge bdg" style={{ fontSize: '.63rem' }}>✅ Hoàn tất</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
                {PIPE_STEPS.map((step, i) => (
                  <div key={i} className={`pipe-step ${pipeState[i] === 'active' ? 'active' : pipeState[i] === 'done' ? 'done' : ''}`}
                    style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '8px', padding: '14px 10px' }}>
                    <div className="pipe-icon" style={{
                      background: pipeState[i] === 'done'
                        ? 'rgba(16,185,129,.15)'
                        : pipeState[i] === 'active'
                          ? 'var(--rg2)'
                          : 'var(--bg4)',
                    }}>
                      {pipeState[i] === 'active' ? <span className="spin" /> : step.i}
                    </div>
                    <div>
                      <div style={{ fontSize: '.74rem', fontWeight: 600 }}>{step.n}</div>
                      <div style={{ fontSize: '.64rem', color: 'var(--t3)', marginTop: '2px' }}>{step.d}</div>
                    </div>
                    <div style={{ fontSize: '.68rem', marginTop: '2px' }}>
                      {pipeState[i] === 'done'
                        ? <span style={{ color: '#34d399', fontWeight: 700 }}>✓ Done</span>
                        : pipeState[i] === 'active'
                          ? <span className="spin" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
                          : <span style={{ color: 'var(--t4)' }}>○ Wait</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── RESULTS — full width, beautiful ── */}
            {subResult && subResult.status !== 'pending' && (
              <div className="card animate-fade-in-up" style={{ border: `1px solid ${subResult.status === 'passed' ? 'rgba(52,211,153,.25)' : subResult.status === 'failed' ? 'rgba(248,113,113,.25)' : 'rgba(251,191,36,.25)'}`, background: subResult.status === 'passed' ? 'rgba(16,185,129,.03)' : subResult.status === 'failed' ? 'rgba(229,62,62,.03)' : 'rgba(251,191,36,.03)' }}>

                {/* Result header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--b1)' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', fontFamily: 'var(--display)', marginBottom: '4px' }}>📊 Kết quả Phân tích</div>
                    <div style={{ fontSize: '.78rem', color: 'var(--t3)' }}>{selAsgn?.title} · Lần nộp #{subResult.attempt_number || 1}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--display)', fontSize: '3.5rem', fontWeight: 900, lineHeight: 1, color: subResult.status === 'passed' ? '#34d399' : subResult.status === 'failed' ? '#f87171' : '#fbbf24' }}>
                        {subResult.score_total || 0}
                      </div>
                      <div style={{ fontSize: '.75rem', color: 'var(--t3)', marginTop: '2px' }}>/100 điểm</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span className={`badge ${subResult.status === 'passed' ? 'bdg' : subResult.status === 'failed' ? 'bdr' : 'bdy'}`} style={{ fontSize: '.88rem', padding: '8px 18px' }}>
                        {subResult.status === 'passed' ? '✅ PASSED' : subResult.status === 'failed' ? '❌ FAILED' : '⚠️ WARNING'}
                      </span>
                      {subResult.ai_suspicion_flag ? (
                        <div className="badge bdy" style={{ marginTop: '6px', fontSize: '.7rem' }}>🤖 AI Detected</div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* 3 Tier scores — big beautiful */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '24px' }}>
                  {[
                    { n: 'T1: Correctness', desc: 'Cú pháp & Logic', v: subResult.score_t1, m: 40, c: 'var(--bl)', bg: 'rgba(59,130,246,.08)', icon: '🎯' },
                    { n: 'T2: Code Quality', desc: 'Đặt tên & Comment', v: subResult.score_t2, m: 35, c: 'var(--pu)', bg: 'rgba(139,92,246,.08)', icon: '✨' },
                    { n: 'T3: Comp. Thinking', desc: 'Tư duy giải toán', v: subResult.score_t3, m: 25, c: 'var(--or)', bg: 'rgba(249,115,22,.08)', icon: '🧠' },
                  ].map(t => (
                    <div key={t.n} style={{
                      background: t.bg,
                      border: `1px solid ${t.c}33`,
                      borderRadius: 'var(--r14)',
                      padding: '20px 22px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '1.3rem' }}>{t.icon}</span>
                        <div>
                          <div style={{ fontSize: '.75rem', fontWeight: 700, color: t.c }}>{t.n}</div>
                          <div style={{ fontSize: '.68rem', color: 'var(--t3)' }}>{t.desc}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', marginBottom: '10px' }}>
                        <div style={{ fontFamily: 'var(--display)', fontSize: '2.4rem', fontWeight: 900, color: t.c, lineHeight: 1 }}>{t.v || 0}</div>
                        <div style={{ fontSize: '.85rem', color: 'var(--t3)', marginBottom: '6px' }}>/{t.m}</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,.2)', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '6px',
                          width: `${((t.v || 0) / t.m) * 100}%`,
                          background: `linear-gradient(90deg, ${t.c}, ${t.c}cc)`,
                          transition: 'width 1s cubic-bezier(.34,1.56,.64,1)',
                        }} />
                      </div>
                      <div style={{ fontSize: '.7rem', color: 'var(--t3)', marginTop: '6px', textAlign: 'right' }}>
                        {Math.round(((t.v || 0) / t.m) * 100)}%
                      </div>
                    </div>
                  ))}
                </div>

                {/* Content: LLM feedback + code graph */}
                <div style={{ display: 'grid', gridTemplateColumns: code.trim() ? '1fr 1fr' : '1fr', gap: '20px', alignItems: 'start' }} className="g2">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                    {/* LLM Feedback */}
                    {subResult.llm_feedback && (
                      <div className={`fb ${subResult.status === 'passed' ? 'fb-pass' : subResult.status === 'failed' ? 'fb-fail' : 'fb-warn'}`}>
                        <div className="fb-lbl" style={{ fontSize: '.78rem', marginBottom: '10px' }}>🤖 LLM Analysis Feedback</div>
                        <div style={{ whiteSpace: 'pre-line', lineHeight: 1.8, fontSize: '.86rem' }}>{subResult.llm_feedback}</div>
                      </div>
                    )}

                    {/* AI Alert */}
                    {subResult.ai_suspicion_flag && (
                      <div className="fb fb-ai">
                        <div className="fb-lbl" style={{ color: '#f97316', fontSize: '.78rem' }}>
                          🚨 AI-Generated Code Alert — Confidence: {Math.round(subResult.ai_suspicion_confidence * 100)}%
                        </div>
                        <div style={{ color: '#fed7aa', fontSize: '.82rem', marginTop: '6px' }}>{subResult.ai_suspicion_reason}</div>
                      </div>
                    )}

                    {/* Misconceptions */}
                    {(subResult.misconceptions || []).length > 0 && (
                      <div style={{ padding: '16px', background: 'rgba(248,113,113,.06)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 'var(--r12)' }}>
                        <div style={{ fontWeight: 700, fontSize: '.8rem', color: '#f87171', marginBottom: '10px' }}>⚠️ Lỗi Tư duy Phát hiện</div>
                        {(subResult.misconceptions || []).map((m: string, i: number) => (
                          <div key={i} className="misc" style={{ fontSize: '.8rem' }}>⚠️ {m}</div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/chat?asgnId=${selAsgn?.id}`)}>
                        💬 Hỏi AI về kết quả này
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setSubResult(null); setPipeState(PIPE_STEPS.map(() => 'idle')) }}>
                        🔄 Nộp lại
                      </button>
                    </div>
                  </div>

                  {/* Code Graph */}
                  {code.trim() && (
                    <div>
                      <div style={{ fontSize: '.74rem', fontWeight: 700, color: 'var(--t3)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        🔬 Knowledge Graph — Code của bạn
                      </div>
                      <CodeGraph
                        code={code}
                        lang={selAsgn?.lang || 'C++'}
                        concepts={selAsgn?.concepts || []}
                        height={420}
                        title={`Code Graph — ${selAsgn?.title}`}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: PROFILE ── */}
        {activeTab === 'profile' && myProfile && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }} className="g2 animate-fade-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Radar */}
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: '4px', fontFamily: 'var(--display)' }}>🎯 Biểu đồ Năng lực Tổng hợp</div>
                <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginBottom: '18px' }}>
                  Tích lũy qua {Object.values(mySubs).filter(Boolean).length} buổi học
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <RadarChart mastery={myProfile.conceptMastery || {}} size={240} />
                </div>
                <div className="divider" style={{ margin: '16px 0' }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                  {Object.entries(myProfile.conceptMastery || {}).map(([c, v]: [string, any]) => (
                    <div key={c} style={{ fontSize: '.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ color: scoreColor(v) }}>●</span>
                      <span style={{ color: 'var(--t2)' }}>{c}:</span>
                      <b style={{ color: scoreColor(v) }}>{v}%</b>
                    </div>
                  ))}
                </div>
              </div>

              {/* Strengths / Improvements */}
              <div className="card">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--gn)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      ✅ Điểm mạnh
                    </div>
                    {(myProfile.strengths || []).map((x: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: '7px', marginBottom: '8px', fontSize: '.78rem', color: 'var(--t2)', lineHeight: 1.55 }}>
                        <span style={{ color: 'var(--gn)', flexShrink: 0, marginTop: '1px' }}>★</span>{x}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '.85rem', color: '#f87171', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🎯 Cần cải thiện
                    </div>
                    {(myProfile.improvements || []).map((x: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: '7px', marginBottom: '8px', fontSize: '.78rem', color: 'var(--t2)', lineHeight: 1.55 }}>
                        <span style={{ color: '#f87171', flexShrink: 0, marginTop: '1px' }}>→</span>{x}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Progress history */}
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: '16px', fontFamily: 'var(--display)' }}>📅 Lịch sử Tiến trình</div>
                {asgns.map((a) => {
                  const sub = mySubs[a.id]
                  const sc = sub?.score_total || 0
                  const sbc = sub ? (STATUS_BADGE[sub.status] || STATUS_BADGE.pending) : STATUS_BADGE.pending
                  return (
                    <div key={a.id} style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--b1)', position: 'relative' }}>
                      <div style={{
                        width: 30, height: 30,
                        borderRadius: '50%',
                        background: sub ? (sub.status === 'passed' ? 'var(--gng)' : sub.status === 'failed' ? 'rgba(229,62,62,.15)' : 'var(--ywg)') : 'var(--bg4)',
                        border: `2px solid ${sub ? (sub.status === 'passed' ? '#34d399' : sub.status === 'failed' ? '#f87171' : '#fbbf24') : 'var(--b2)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '.8rem', flexShrink: 0,
                      }}>
                        {sbc.i}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: '.86rem', fontWeight: 600 }}>{a.title}</div>
                          <span style={{ fontFamily: 'var(--display)', fontSize: '.92rem', fontWeight: 800, color: scoreColor(sc) }}>{sc || '—'}</span>
                        </div>
                        <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginTop: '3px' }}>
                          {sub ? fmtDate(sub.submitted_at) : 'Chưa nộp'}
                        </div>
                        {sub?.llm_feedback && (
                          <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginTop: '4px', lineHeight: 1.5 }}>
                            {sub.llm_feedback.substring(0, 80)}...
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Misconceptions */}
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: '14px', fontFamily: 'var(--display)' }}>🧠 Lỗi Tư duy Cần khắc phục</div>
                {(myProfile.misconceptions || []).length
                  ? (myProfile.misconceptions || []).map((m: string, i: number) => (
                    <div key={i} className="misc">
                      <span style={{ flexShrink: 0 }}>⚠️</span>
                      <div>
                        {m}
                        <div style={{ marginTop: '4px', fontSize: '.68rem', color: 'var(--t3)' }}>
                          💡 Gợi ý: Ôn lại concept và làm thêm bài tập liên quan
                        </div>
                      </div>
                    </div>
                  ))
                  : (
                    <div style={{ textAlign: 'center', color: 'var(--t3)', padding: '28px', fontSize: '.85rem' }}>
                      🎉 Chưa có lỗi tư duy nào được ghi nhận. Tiếp tục giữ vững!
                    </div>
                  )
                }
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && !myProfile && (
          <div className="card" style={{ textAlign: 'center', padding: '60px', animation: 'fadeInUp .35s ease both' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>📊</div>
            <div style={{ fontWeight: 600, color: 'var(--t2)', fontFamily: 'var(--display)' }}>Nộp ít nhất 1 bài tập để xem hồ sơ năng lực</div>
          </div>
        )}
      </div>
    </div>
  )
}
