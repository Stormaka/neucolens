// @ts-nocheck
import React, { useEffect, useState, useRef, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { cpp } from '@codemirror/lang-cpp'
import { oneDark } from '@codemirror/theme-one-dark'
import { submissions } from '../api'

function fmtLeft(ms: number) {
  if (ms <= 0) return '00:00'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function ExamPanel({ assignment, session, code, setCode, onSubmit, submitting, telemetry, toast }: any) {
  const containerRef = useRef<HTMLDivElement>(null)
  const allowPaste = assignment.allowPaste ?? assignment.allow_paste ?? true
  const requireFullscreen = assignment.requireFullscreen ?? assignment.require_fullscreen ?? false
  const duration = assignment.durationMinutes ?? assignment.duration_minutes ?? 60
  const sid = session.sessionId || session.session_id
  const expAt = session.expiresAt || session.expires_at
  const [remaining, setRemaining] = useState(() => Math.max(0, Date.parse(expAt) - Date.now()))
  const [fsOn, setFsOn] = useState(false)
  const [blockedCount, setBlockedCount] = useState(0)
  const autoSubmitted = useRef(false)

  // Timer
  useEffect(() => {
    const id = setInterval(() => {
      const r = Math.max(0, Date.parse(expAt) - Date.now())
      setRemaining(r)
      if (r <= 0 && !autoSubmitted.current && !submitting) {
        autoSubmitted.current = true
        toast('⏰ Hết giờ — tự động nộp bài...', false)
        onSubmit()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [expAt, submitting, onSubmit, toast])

  // Fullscreen listener
  useEffect(() => {
    const onFs = () => {
      const on = !!document.fullscreenElement
      setFsOn(on)
      if (!on && requireFullscreen) {
        submissions.examEvent(assignment.id, 'fullscreen_exit').catch(() => {})
        toast('⚠️ Bạn đã thoát fullscreen — đã ghi nhận', true)
      }
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [assignment.id, requireFullscreen, toast])

  // Focus lost / visibility
  useEffect(() => {
    const onBlur = () => { submissions.examEvent(assignment.id, 'focus_lost').catch(() => {}) }
    const onVis = () => { if (document.hidden) submissions.examEvent(assignment.id, 'focus_lost').catch(() => {}) }
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVis)
    return () => { window.removeEventListener('blur', onBlur); document.removeEventListener('visibilitychange', onVis) }
  }, [assignment.id])

  const enterFs = useCallback(() => {
    if (containerRef.current?.requestFullscreen) containerRef.current.requestFullscreen().catch(() => {})
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (!allowPaste) {
      e.preventDefault()
      submissions.examEvent(assignment.id, 'paste_blocked').catch(() => {})
      setBlockedCount(c => c + 1)
      toast('🚫 Bài thi không cho phép dán code — hãy tự gõ', true)
    }
  }, [allowPaste, assignment.id, toast])

  const pct = Math.max(0, Math.min(100, (remaining / (duration * 60000)) * 100))
  const urgent = remaining < 5 * 60_000

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: fsOn ? 'var(--bg0)' : undefined, padding: fsOn ? '12px' : 0 }} onPaste={handlePaste}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', background: urgent ? 'rgba(248,113,113,.12)' : 'var(--bg3)', border: `1px solid ${urgent ? 'rgba(248,113,113,.4)' : 'var(--b1)'}`, borderRadius: 'var(--r10)', padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: 800, fontSize: '.92rem', fontFamily: 'var(--display)' }}>📝 {assignment.title}</span>
          <span className={`badge ${urgent ? 'bdr' : 'bdy'}`} style={{ fontSize: '.78rem', fontFamily: 'var(--mono)' }}>⏱ {fmtLeft(remaining)}</span>
          {blockedCount > 0 && <span className="badge bdy" style={{ fontSize: '.62rem' }}>🚫 Paste chặn: {blockedCount}</span>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {requireFullscreen && (
            <button className="btn btn-ghost btn-sm" onClick={enterFs} style={{ border: `1px solid ${fsOn ? 'var(--gn)' : 'var(--or)'}` }}>
              {fsOn ? '⛶ Đang fullscreen' : '⛶ Vào fullscreen'}
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={onSubmit} disabled={submitting} style={{ fontWeight: 700 }}>
            {submitting ? '⏳ Đang nộp...' : '📤 Nộp bài thi'}
          </button>
        </div>
      </div>

      <div style={{ height: '6px', borderRadius: '6px', background: 'var(--bg4)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: urgent ? '#f87171' : 'var(--gn)', transition: 'width 1s linear' }} />
      </div>

      {requireFullscreen && !fsOn && (
        <div style={{ background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.4)', borderRadius: 'var(--r8)', padding: '8px 12px', fontSize: '.76rem', color: '#fbbf24' }}>
          ⚠️ Bài thi yêu cầu chế độ fullscreen. Vui lòng bấm “Vào fullscreen” — mỗi lần thoát sẽ được ghi nhận cho giảng viên.
        </div>
      )}
      {!allowPaste && (
        <div style={{ fontSize: '.7rem', color: 'var(--t3)' }}>🚫 Chế độ thi: dán code bị chặn — hệ thống ghi nhận mọi lần dán. Hãy tự gõ lời giải.</div>
      )}

      <div style={{ border: '1px solid var(--b1)', borderRadius: 'var(--r10)', overflow: 'hidden', fontSize: '13.5px' }}>
        <CodeMirror
          value={code}
          height="380px"
          theme={oneDark}
          extensions={[cpp()]}
          basicSetup={{ lineNumbers: true, foldGutter: false, autocompletion: false, highlightActiveLine: true }}
          placeholder={'// Viết lời giải của bạn ở đây...\n#include <iostream>\nusing namespace std;\nint main(){ \n  // ...\n  return 0;\n}'}
          onChange={(val: string) => setCode(val)}
          onUpdate={(vu: any) => {
            let ins = 0, del = 0
            try {
              vu.changes.iterChanges((fromA: number, toA: number, _fb: number, _tb: number, inserted: any) => {
                const insLen = inserted.length
                const delLen = toA - fromA
                if (insLen) ins += insLen
                if (delLen) del += delLen
              })
            } catch {}
            telemetry?.recordEdit(ins, del)
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setCode('')}>🗑 Xoá</button>
        <span style={{ fontSize: '.7rem', color: 'var(--t4)', alignSelf: 'center' }}>Phiên thi: {sid?.slice(0, 8)}… • Hết hạn {new Date(expAt).toLocaleString('vi-VN')}</span>
      </div>
    </div>
  )
}
