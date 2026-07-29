// @ts-nocheck
import React, { useState, useCallback, useRef, KeyboardEvent } from 'react'

// ── Concept presets per language ──────────────────────────────────────────────
export const LANG_CONCEPT_PRESETS: Record<string, string[]> = {
  'C++':        ['Variables','I/O','Arithmetic','Conditionals','Boolean Logic','Loops','Nested Loops','Arrays','Pointers','References','Functions','Recursion','Base Case','Sorting Algorithm','OOP','Classes'],
  'Python':     ['Variables','I/O','Conditionals','Loops','List','Dictionary','Functions','Recursion','List Comprehension','Lambda','Decorators','Classes','Exceptions','File I/O','Modules'],
  'JavaScript': ['Variables','I/O','Conditionals','Loops','Functions','Arrays','Objects','Closures','Promises','Async/Await','Event Loop','Classes','Modules','DOM Manipulation'],
  'TypeScript': ['Variables','Types','Interfaces','Conditionals','Loops','Functions','Generics','Classes','Async/Await','Decorators','Modules'],
  'Java':       ['Variables','I/O','Conditionals','Loops','Arrays','Methods','OOP','Inheritance','Polymorphism','Interfaces','Exceptions','Collections','Generics'],
  'C':          ['Variables','I/O','Arithmetic','Conditionals','Loops','Arrays','Pointers','Functions','Memory Management','Structs','File I/O'],
}

// ── ConceptTagInput ───────────────────────────────────────────────────────────
interface ConceptTagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  lang?: string
  placeholder?: string
}
export function ConceptTagInput({ value, onChange, lang = 'C++', placeholder = 'Gõ tên khái niệm...' }: ConceptTagInputProps) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeLang, setActiveLang] = useState(lang)
  const inputRef = useRef<HTMLInputElement>(null)

  const presets = LANG_CONCEPT_PRESETS[activeLang] || LANG_CONCEPT_PRESETS['C++']
  const filtered = presets.filter(p => !value.includes(p) && (input === '' || p.toLowerCase().includes(input.toLowerCase())))

  const addTag = (tag: string) => {
    const t = tag.trim()
    if (t && !value.includes(t)) { onChange([...value, t]); setInput(''); inputRef.current?.focus() }
  }
  const removeTag = (tag: string) => onChange(value.filter(t => t !== tag))
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) { e.preventDefault(); addTag(input) }
    if (e.key === 'Backspace' && !input && value.length > 0) removeTag(value[value.length - 1])
  }

  return (
    <div>
      {/* Language quick-pick */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
        {Object.keys(LANG_CONCEPT_PRESETS).map(l => (
          <button key={l} onClick={() => setActiveLang(l)} style={{ padding: '2px 9px', fontSize: '.68rem', fontWeight: 700, borderRadius: 99, border: `1px solid ${activeLang === l ? 'var(--r)' : 'var(--b2)'}`, background: activeLang === l ? 'rgba(192,57,43,.18)' : 'var(--bg3)', color: activeLang === l ? '#f87171' : 'var(--t2)', cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      {/* Tag container */}
      <div onClick={() => inputRef.current?.focus()} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--b2)', borderRadius: 'var(--r6)', cursor: 'text', minHeight: 44, alignItems: 'center' }}>
        {value.map(tag => (
          <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(192,57,43,.18)', color: '#f87171', border: '1px solid rgba(192,57,43,.3)', borderRadius: 99, padding: '2px 9px 2px 10px', fontSize: '.74rem', fontWeight: 600 }}>
            {tag}
            <button onClick={e => { e.stopPropagation(); removeTag(tag) }} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0, fontSize: '.8rem', lineHeight: 1, opacity: .7 }}>✕</button>
          </span>
        ))}
        <input ref={inputRef} value={input} onChange={e => { setInput(e.target.value); setShowSuggestions(true) }}
          onKeyDown={onKeyDown} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={value.length === 0 ? placeholder : '+ Thêm...'} style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--t1)', fontSize: '.82rem', minWidth: 120, fontFamily: 'var(--sans)' }} />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filtered.length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--b2)', borderRadius: 'var(--r6)', marginTop: 4, padding: 6, display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 120, overflowY: 'auto' }}>
          {filtered.slice(0, 18).map(p => (
            <button key={p} onMouseDown={() => addTag(p)} style={{ padding: '3px 10px', fontSize: '.72rem', borderRadius: 99, border: '1px solid var(--b2)', background: 'var(--bg3)', color: 'var(--t2)', cursor: 'pointer', transition: 'all .15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(192,57,43,.15)', e.currentTarget.style.color = '#f87171')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg3)', e.currentTarget.style.color = 'var(--t2)')}>
              {p}
            </button>
          ))}
        </div>
      )}
      <div style={{ fontSize: '.66rem', color: 'var(--t3)', marginTop: 5 }}>
        Enter hoặc dấu phẩy để thêm · Backspace để xóa tag cuối · Click gợi ý bên dưới
      </div>
    </div>
  )
}



// ── Color helpers ──────────────────────────────────────────────────────────
export const scoreColor = (v: number | null | undefined) => (v === null || v === undefined) ? 'var(--t3)' : v >= 85 ? '#34d399' : v >= 70 ? '#60a5fa' : v >= 50 ? '#fbbf24' : '#f87171'
export const hmBg = (v: number) => v >= 85 ? 'rgba(22,163,74,.3)' : v >= 70 ? 'rgba(37,99,235,.28)' : v >= 50 ? 'rgba(202,138,4,.28)' : v >= 30 ? 'rgba(220,38,38,.22)' : 'rgba(127,29,29,.38)'
export const hmColor = (v: number) => v >= 85 ? '#16a34a' : v >= 70 ? '#2563eb' : v >= 50 ? '#ca8a04' : v >= 30 ? '#dc2626' : '#7f1d1d'

export const PROFILE_BADGE: Record<string, { c: string; i: string; l: string }> = {
  advanced: { c: 'bdg', i: '🚀', l: 'Advanced' },
  'on-track': { c: 'bdb', i: '✅', l: 'On Track' },
  'at-risk': { c: 'bdr', i: '⚠️', l: 'At Risk' },
  'ai-warning': { c: 'bdy', i: '🤖', l: 'AI Warning' },
}
export const STATUS_BADGE: Record<string, { c: string; i: string; l: string }> = {
  passed: { c: 'bdg', i: '✅', l: 'Passed' },
  failed: { c: 'bdr', i: '❌', l: 'Failed' },
  warning: { c: 'bdy', i: '⚠️', l: 'Warning' },
  pending: { c: 'bdn', i: '⏳', l: 'Chưa nộp' },
  ungraded: { c: 'bdb', i: 'ℹ️', l: 'Chưa chấm T1' },
}

export const CONCEPTS = ['variables', 'conditionals', 'loops', 'arrays', 'functions']
export const CON_LBL: Record<string, string> = { variables: 'Biến & I/O', conditionals: 'Rẽ nhánh', loops: 'Vòng lặp', arrays: 'Mảng', functions: 'Hàm' }
export const CON_EM: Record<string, string> = { variables: '📦', conditionals: '🔀', loops: '🔄', arrays: '📊', functions: '⚙️' }

export const AV_BG = ['rgba(192,57,43,.22)', 'rgba(96,165,250,.22)', 'rgba(16,185,129,.22)', 'rgba(251,191,36,.22)']
export const AV_TX = ['#f87171', '#93c5fd', '#6ee7b7', '#fde68a']
export const avBg = (i: number) => AV_BG[i % 4]
export const avTx = (i: number) => AV_TX[i % 4]

export const fmtDate = (d: string) => !d ? 'Chưa nộp' : new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// ── Toast hook ─────────────────────────────────────────────────────────────
interface Toast { id: number; msg: string; error?: boolean }
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const toast = useCallback((msg: string, error = false) => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, error }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])
  const ToastContainer = () => (
    <div className="toast-wrap">
      {toasts.map(t => <div key={t.id} className={`toast show ${t.error ? 'error' : ''}`}>{t.error ? '✗' : '✓'} {t.msg}</div>)}
    </div>
  )
  return { toast, ToastContainer }
}

// ── Radar Chart SVG ────────────────────────────────────────────────────────
// NOTE: `mastery` keys can be PascalCase (e.g. "Variables", "Loops") from API.
// We derive the axis list dynamically from the mastery object so no key-case mismatch.
export function RadarChart({ mastery, size = 200 }: { mastery: Record<string, number>; size?: number }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 34

  // Use dynamic keys from actual mastery data; fall back to 5 legacy lowercase keys
  const keys = Object.keys(mastery).length > 0 ? Object.keys(mastery) : CONCEPTS
  const count = Math.max(keys.length, 3)

  const pts = keys.map((k, i) => ({ key: k, ang: i * (360 / count) - 90, v: mastery[k] ?? 0 }))
  const xy = (ang: number, v: number) => ({ x: cx + (v / 100) * r * Math.cos(ang * Math.PI / 180), y: cy + (v / 100) * r * Math.sin(ang * Math.PI / 180) })
  const area = pts.map(p => xy(p.ang, p.v))
  const polyPts = area.map(p => `${p.x},${p.y}`).join(' ')

  // Label: use CON_LBL if available (legacy lowercase), else display key as-is
  const getLabel = (k: string) => CON_LBL[k.toLowerCase()] || k
  const getEmoji = (k: string) => CON_EM[k.toLowerCase()] || '📌'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      {[25, 50, 75, 100].map(g => {
        const gp = pts.map(p => xy(p.ang, g))
        return <polygon key={g} points={gp.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="rgba(255,255,255,.055)" strokeWidth={g === 100 ? 1 : .6} strokeDasharray={g < 100 ? '2 3' : undefined} />
      })}
      {pts.map((p, i) => { const o = xy(p.ang, 100); return <line key={i} x1={cx} y1={cy} x2={o.x} y2={o.y} stroke="rgba(255,255,255,.055)" strokeWidth=".6" /> })}
      <polygon points={polyPts} fill="rgba(192,57,43,.2)" stroke="#e74c3c" strokeWidth="1.8" strokeLinejoin="round" />
      {area.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#e74c3c" stroke="#07090c" strokeWidth="1.5" />)}
      {pts.map((p, i) => {
        const lp = xy(p.ang, 100 + 20)
        const ang = ((p.ang % 360) + 360) % 360
        const anc = ang > 20 && ang < 160 ? 'start' : ang > 200 && ang < 340 ? 'end' : 'middle'
        return <text key={i} x={lp.x} y={lp.y + 3} textAnchor={anc as any} fontSize="9" fill="#8e98a8">{getEmoji(p.key)} {getLabel(p.key)} ({p.v}%)</text>
      })}
    </svg>
  )
}

// ── Concept Heatmap ────────────────────────────────────────────────────────
export function ConceptHeatmap({ students, concepts }: { students: any[]; concepts?: string[] }) {
  // Build dynamic concept list from all students' mastery keys if not provided
  const allConcepts: string[] = concepts && concepts.length > 0
    ? concepts
    : [...new Set(students.flatMap(s => Object.keys(s.conceptMastery || {})))].slice(0, 12)

  if (!allConcepts.length) return <div style={{ textAlign: 'center', color: 'var(--t3)', padding: 24, fontSize: '.82rem' }}>Chưa có dữ liệu khái niệm</div>

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '5px' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', fontSize: '.68rem', color: 'var(--t3)', padding: '3px 7px', whiteSpace: 'nowrap' }}>SINH VIÊN</th>
            {allConcepts.map(c => <th key={c} style={{ fontSize: '.63rem', color: 'var(--t3)', textAlign: 'center', minWidth: '64px', maxWidth: '80px', padding: '2px 4px', wordBreak: 'break-word', lineHeight: 1.3 }}>{c}</th>)}
            <th style={{ fontSize: '.68rem', color: 'var(--t3)', textAlign: 'center' }}>TB</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, si) => {
            const cm = s.conceptMastery || {}
            const vals = allConcepts.map(c => cm[c] || 0)
            const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
            const pb = PROFILE_BADGE[s.profile_type] || PROFILE_BADGE['on-track']
            return (
              <tr key={s.id}>
                <td style={{ padding: '5px 7px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div className="avatar" style={{ width: '28px', height: '28px', background: avBg(si), color: avTx(si), fontSize: '.66rem' }}>{s.name?.split(' ').slice(-1)[0]?.slice(0, 2).toUpperCase() || '??'}</div>
                    <div>
                      <div style={{ fontSize: '.8rem', fontWeight: 600 }}>{s.name}</div>
                      <span className={`badge ${pb.c}`} style={{ fontSize: '.58rem' }}>{pb.i} {pb.l}</span>
                    </div>
                  </div>
                </td>
                {allConcepts.map((c, ci) => {
                  const v = cm[c] || 0
                  return <td key={c} style={{ textAlign: 'center' }}><div className="hm-cell" title={`${c}: ${v}%`} style={{ width: '50px', height: '36px', margin: 'auto', background: hmBg(v), border: `1px solid ${hmColor(v)}30`, color: hmColor(v), fontSize: '.72rem' }}>{v}</div></td>
                })}
                <td style={{ textAlign: 'center', fontSize: '.88rem', fontWeight: 800, color: scoreColor(avg) }}>{avg}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap', fontSize: '.68rem', color: 'var(--t3)' }}>
        {[['rgba(127,29,29,.38)', '<30'], ['rgba(220,38,38,.22)', '30-49'], ['rgba(202,138,4,.28)', '50-69'], ['rgba(37,99,235,.28)', '70-84'], ['rgba(22,163,74,.3)', '≥85']].map(([bg, lbl]) => (

          <div key={lbl}><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: bg, marginRight: '4px' }} />{lbl}</div>
        ))}
      </div>
    </div>
  )
}

// ── Code highlighter ───────────────────────────────────────────────────────
export function CodeBlock({ code, lang = 'C++' }: { code: string; lang?: string }) {
  const hl = (c: string) => c
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(\/\/.*$)/gm, '<span style="color:#585b70;font-style:italic">$1</span>')
    .replace(/\b(int|double|float|long|void|bool|char|return|if|else|for|while|do|switch|case|break|continue|class|struct|include|using|namespace|std|const|auto|endl|cin|cout|true|false)\b/g, '<span style="color:#cba6f7">$1</span>')
    .replace(/\b([A-Za-z_]\w*)\s*(?=\()/g, '<span style="color:#89b4fa">$1</span>')
    .replace(/"([^"]*)"/g, '<span style="color:#a6e3a1">"$1"</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#fab387">$1</span>')
    .replace(/#(\w+)/g, '<span style="color:#f38ba8">#$1</span>')
  return (
    <div className="code-block">
      <div className="code-hdr">💻 Code ({lang})</div>
      <pre className="code-body" dangerouslySetInnerHTML={{ __html: hl(code) }} />
    </div>
  )
}

// ── Loading spinner ────────────────────────────────────────────────────────
export function Loader({ msg = 'Đang tải...' }: { msg?: string }) {
  return <div className="loading"><div className="spin" style={{ width: '28px', height: '28px', borderWidth: '3px' }} /><span style={{ fontSize: '.88rem' }}>{msg}</span></div>
}

// ── Progress Session Chart (SVG) ───────────────────────────────────────────
export function SessionChart({ sessions }: { sessions: any[] }) {
  const W = 600, H = 180, pl = 42, pr = 16, pt = 16, pb = 28
  const cw = W - pl - pr, ch = H - pt - pb
  const clr = ['#34d399', '#f87171', '#60a5fa', '#fbbf24']
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
      {[0, 25, 50, 75, 100].map(g => {
        const y = pt + ch * (1 - g / 100)
        return <g key={g}><line x1={pl} y1={y} x2={W - pr} y2={y} stroke="rgba(255,255,255,.04)" strokeWidth="1" /><text x={pl - 5} y={y + 4} textAnchor="end" fontSize="9" fill="#525c6b">{g}</text></g>
      })}
      {sessions[0]?.map((_: any, i: number) => {
        const x = pl + cw * (i / Math.max(sessions[0].length - 1, 1))
        return <text key={i} x={x} y={H - pb + 14} textAnchor="middle" fontSize="9" fill="#525c6b">B{i + 1}</text>
      })}
      {sessions.map((s: any[], si) => {
        if (!s?.length) return null
        const pts = s.map((v, i) => ({ x: pl + cw * (i / Math.max(s.length - 1, 1)), y: pt + ch * (1 - (v || 0) / 100) }))
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
        return (
          <g key={si}>
            <path d={d} fill="none" stroke={clr[si % 4]} strokeWidth="1.8" strokeLinejoin="round" opacity=".9" strokeDasharray={si === 1 ? '4 2' : undefined} />
            {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={clr[si % 4]} stroke="#07090c" strokeWidth="1.5" />)}
          </g>
        )
      })}
    </svg>
  )
}
