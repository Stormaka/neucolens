// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { admin, assignments, classrooms } from '../api'
import { useToast } from './ui'

export default function ResearchPanel({ classroomId }: { classroomId?: number }) {
  const { toast, ToastContainer } = useToast()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [classroomsList, setClassroomsList] = useState<any[]>([])
  const [selClass, setSelClass] = useState<number | ''>(classroomId || '')
  // Plagiarism
  const [asgns, setAsgns] = useState<any[]>([])
  const [selAsgn, setSelAsgn] = useState<number | ''>('')
  const [threshold, setThreshold] = useState(0.8)
  const [plagPairs, setPlagPairs] = useState<any[]>([])
  const [plagLoading, setPlagLoading] = useState(false)

  useEffect(() => {
    classrooms.list().then(setClassroomsList).catch(() => {})
  }, [])
  useEffect(() => {
    if (classroomId) setSelClass(classroomId)
  }, [classroomId])

  const loadStats = async () => {
    setLoading(true)
    try {
      const s = await admin.research.stats(selClass || undefined)
      setStats(s)
    } catch (e: any) { toast(e.message || 'Lỗi tải stats', true) }
    finally { setLoading(false) }
  }
  useEffect(() => { loadStats() }, [selClass])

  const loadAsgns = async () => {
    if (!selClass) return
    try {
      const list = await assignments.byClassroom(Number(selClass))
      setAsgns(list)
      if (list.length) setSelAsgn(list[0].id)
    } catch {}
  }
  useEffect(() => { loadAsgns() }, [selClass])

  const download = async (format: 'json' | 'csv' | 'excel') => {
    try {
      if (format === 'json') {
        const data = await admin.research.exportJson(selClass || undefined)
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `neu-codelens-export-${selClass || 'all'}.json`; a.click(); URL.revokeObjectURL(url)
        toast('✅ Đã tải JSON (ẩn danh)')
      } else if (format === 'csv') {
        // Use fetch directly for blob (axios interceptor would try to camelCase)
        const token = localStorage.getItem('access_token')
        const base = import.meta.env.VITE_API_URL || (location.hostname !== 'localhost' ? '/api' : 'http://localhost:3001/api')
        const url = `${base}/admin/research/export?format=csv${selClass ? `&classroomId=${selClass}` : ''}`
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        if (!r.ok) throw new Error((await r.json()).error?.message || 'Lỗi tải CSV')
        const blob = await r.blob()
        const u = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = u; a.download = `neu-codelens-${selClass || 'all'}-${Date.now()}.zip`; a.click(); URL.revokeObjectURL(u)
        toast('✅ Đã tải CSV Zip (4 sheets)')
      } else {
        const token = localStorage.getItem('access_token')
        const base = import.meta.env.VITE_API_URL || (location.hostname !== 'localhost' ? '/api' : 'http://localhost:3001/api')
        const url = `${base}/admin/research/export?format=excel${selClass ? `&classroomId=${selClass}` : ''}`
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        if (r.headers.get('content-type')?.includes('json')) {
          const j = await r.json()
          // fallback JSON note
          const blob = new Blob([JSON.stringify(j, null, 2)], { type: 'application/json' })
          const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = `neu-codelens-${selClass || 'all'}.json`; a.click(); URL.revokeObjectURL(u)
          toast('ℹ️ Excel chưa cài exceljs — đã tải JSON thay thế')
        } else {
          const blob = await r.blob()
          const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = `neu-codelens-${selClass || 'all'}.xlsx`; a.click(); URL.revokeObjectURL(u)
          toast('✅ Đã tải Excel 4 sheets')
        }
      }
    } catch (e: any) { toast(e.message || 'Lỗi tải export', true) }
  }

  const checkPlag = async () => {
    if (!selAsgn) return toast('Chọn bài tập', true)
    setPlagLoading(true)
    try {
      const r = await assignments.plagiarism(Number(selAsgn), threshold)
      setPlagPairs(r.pairs || [])
      if (!r.pairs?.length) toast('✅ Không phát hiện cặp nghi vấn với ngưỡng này')
    } catch (e: any) { toast(e.message || 'Lỗi kiểm tra', true) }
    finally { setPlagLoading(false) }
  }

  if (loading && !stats) return <div style={{ padding: '24px', color: 'var(--t3)' }}>⏳ Đang tải thống kê nghiên cứu...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <ToastContainer />
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '.95rem', fontFamily: 'var(--display)' }}>📊 Research Data Export — 4 sheets (data_collection_template.md)</div>
            <div style={{ fontSize: '.74rem', color: 'var(--t2)' }}>Ẩn danh SV → T001…, khớp schema để chạy `python statistical_analysis.py --data student_data.xlsx`</div>
          </div>
          <select className="input" value={selClass} onChange={e => setSelClass(e.target.value ? Number(e.target.value) : '')} style={{ width: '180px' }}>
            <option value="">Tất cả lớp</option>
            {classroomsList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: '12px', marginBottom: '16px' }}>
            {[
              ['SV', stats.counts?.students ?? '—'],
              ['Submissions', stats.counts?.submissions ?? '—'],
              ['Đã duyệt (Kappa)', stats.counts?.reviewed ?? '—'],
              ['MAE', stats.llm_vs_human?.mae ?? '—'],
            ].map(([lbl, v]) => (
              <div key={lbl} style={{ background: 'var(--bg3)', borderRadius: 'var(--r10)', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '.68rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{lbl}</div>
                <div style={{ fontWeight: 800, fontSize: '1.3rem', fontFamily: 'var(--display)', marginTop: '4px' }}>{v}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={() => download('json')}>📄 Tải JSON</button>
          <button className="btn btn-secondary btn-sm" onClick={() => download('csv')}>📦 Tải CSV Zip (4 sheets)</button>
          <button className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--b2)' }} onClick={() => download('excel')}>📊 Tải Excel (.xlsx)</button>
          <button className="btn btn-ghost btn-sm" onClick={loadStats}>🔄 Làm mới stats</button>
        </div>
        <div style={{ fontSize: '.68rem', color: 'var(--t3)', marginTop: '10px' }}>Mẹo: Tải JSON → `python -c "import json, pandas as pd; d=json.load(open('export.json')); pd.DataFrame(d['students']).to_excel('student_data.xlsx',index=False)"` hoặc dùng CSV Zip nhập thẳng vào Excel.</div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, fontSize: '.92rem', marginBottom: '12px', fontFamily: 'var(--display)' }}>🔍 Plagiarism Check — Jaccard 5-gram (bỏ comment/#include)</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
          <select className="input" value={selAsgn} onChange={e => setSelAsgn(e.target.value ? Number(e.target.value) : '')} style={{ flex: 1, minWidth: '200px' }}>
            <option value="">-- Chọn bài tập --</option>
            {asgns.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '.74rem', color: 'var(--t3)' }}>Ngưỡng:</span>
            <input type="range" min={0.5} max={0.95} step={0.05} value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
            <span style={{ fontSize: '.78rem', fontWeight: 700, fontFamily: 'var(--mono)' }}>{threshold.toFixed(2)}</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={checkPlag} disabled={plagLoading || !selAsgn}>{plagLoading ? '⏳ Đang so sánh...' : '🔍 Kiểm tra'}</button>
        </div>
        {plagPairs.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
              <thead><tr style={{ color: 'var(--t3)', borderBottom: '1px solid var(--b2)', textAlign: 'left' }}><th style={{ padding: '6px 8px' }}>Cặp SV</th><th style={{ padding: '6px 8px' }}>Jaccard</th><th style={{ padding: '6px 8px' }}>Shared 5-gram</th><th style={{ padding: '6px 8px' }}>Độ dài</th></tr></thead>
              <tbody>{plagPairs.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--b1)', background: p.similarity > 0.9 ? 'rgba(248,113,113,.08)' : p.similarity > 0.85 ? 'rgba(251,191,36,.08)' : 'transparent' }}>
                  <td style={{ padding: '7px 8px' }}>{p.aName} <span style={{ color: 'var(--t3)' }}>#{p.aStudent}</span> ↔ {p.bName} <span style={{ color: 'var(--t3)' }}>#{p.bStudent}</span></td>
                  <td style={{ padding: '7px 8px', fontWeight: 800, color: p.similarity > 0.9 ? '#f87171' : p.similarity > 0.85 ? '#fbbf24' : 'inherit' }}>{(p.similarity * 100).toFixed(1)}%</td>
                  <td style={{ padding: '7px 8px' }}>{p.shared}</td>
                  <td style={{ padding: '7px 8px', color: 'var(--t3)' }}>{p.aLen} / {p.bLen} tokens</td>
                </tr>
              ))}</tbody>
            </table>
            <div style={{ fontSize: '.68rem', color: 'var(--t3)', marginTop: '8px' }}>Ngưỡng {threshold}: {plagPairs.length} cặp nghi vấn. Màu đỏ &gt;0.9, vàng &gt;0.85. Kiểm tra thủ công trước khi kết luận.</div>
          </div>
        ) : (
          <div style={{ color: 'var(--t3)', fontSize: '.78rem', padding: '12px', textAlign: 'center', background: 'var(--bg3)', borderRadius: 'var(--r8)' }}>
            {selAsgn ? 'Chưa có kết quả — bấm Kiểm tra' : 'Chọn lớp và bài tập để kiểm tra'}
          </div>
        )}
      </div>
    </div>
  )
}
