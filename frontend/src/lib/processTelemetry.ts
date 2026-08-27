// Phase 1 — Programming Process Telemetry (client)
// Thu thập NGẦM dữ liệu quá trình gõ code theo tinh thần ProgSnap2 /
// IDE-based learning analytics (Hundhausen et al., TOCE 2017):
//   · edit      — mỗi thay đổi CodeMirror (số ký tự thêm/xoá, KHÔNG lưu nội dung)
//   · keystroke — nhịp phím + độ trễ giữa 2 lần gõ (Leinonen et al., SIGCSE 2016)
//   · paste/cut — dán/cắt (chỉ độ dài chuỗi)
//   · focus     — rời/khôi phục cửa sổ (tab-switch)
//   · submit.attempt — bấm nộp
// Riêng tư: buffer chỉ chứa con số & timestamp — không thể tái dựng code từ log.
import { useEffect, useMemo, useRef } from 'react'
import API from '../api'

export interface TelemetryEvent {
  type: string
  ts: number
  ins?: number
  del?: number
  chars?: number
  latency?: number
}

const MAX_BUFFER = 5000
const FLUSH_INTERVAL_MS = 45_000

class ProcessTelemetry {
  readonly sessionId: string
  private buffer: TelemetryEvent[] = []
  private dropped = 0
  private lastKeyTs = 0
  private disposed = false
  private editorEl: HTMLElement | null = null
  private startedAt = 0

  // bound handlers để removeEventListener sạch sẽ
  private onKeydown = (e: KeyboardEvent) => {
    const now = Date.now()
    const latency = this.lastKeyTs ? now - this.lastKeyTs : undefined
    this.lastKeyTs = now
    // Chỉ lưu độ trễ — không lưu nội dung phím (riêng tư)
    void e.key
    this.push({
      type: 'keystroke', ts: now,
      latency: latency !== undefined && latency <= 60_000 && latency >= 0 ? latency : undefined,
    })
  }
  private onPaste = (e: ClipboardEvent) => {
    const text = e.clipboardData?.getData('text') ?? ''
    if (text.length) this.push({ type: 'paste', ts: Date.now(), chars: text.length })
  }
  private onCut = () => {
    const sel = (this.editorEl as any)?.cmView?.view?.state?.selection?.main
    this.push({ type: 'cut', ts: Date.now(), chars: sel ? Math.max(0, sel.to - sel.from) : 0 })
  }
  private onBlur = () => this.push({ type: 'focus.lost', ts: Date.now() })
  private onFocus = () => this.push({ type: 'focus.gained', ts: Date.now() })
  private onVisibility = () => {
    this.push({ type: document.hidden ? 'focus.lost' : 'focus.gained', ts: Date.now() })
  }

  constructor() {
    this.sessionId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().slice(0, 36)
        : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }

  start() {
    this.startedAt = Date.now()
    this.push({ type: 'session.start', ts: this.startedAt })
    window.addEventListener('blur', this.onBlur)
    window.addEventListener('focus', this.onFocus)
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  dispose() {
    this.disposed = true
    window.removeEventListener('blur', this.onBlur)
    window.removeEventListener('focus', this.onFocus)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.detachEditor()
  }

  attachEditor(el: HTMLElement | null) {
    this.detachEditor()
    if (!el) return
    this.editorEl = el
    el.addEventListener('keydown', this.onKeydown)
    el.addEventListener('paste', this.onPaste)
    el.addEventListener('cut', this.onCut)
  }

  detachEditor() {
    if (!this.editorEl) return
    this.editorEl.removeEventListener('keydown', this.onKeydown)
    this.editorEl.removeEventListener('paste', this.onPaste)
    this.editorEl.removeEventListener('cut', this.onCut)
    this.editorEl = null
  }

  recordEdit(ins: number, del: number) {
    if (!ins && !del) return
    this.push({ type: 'edit', ts: Date.now(), ins: Math.max(0, ins), del: Math.max(0, del) })
  }

  recordSubmitAttempt() {
    this.push({ type: 'submit.attempt', ts: Date.now() })
  }

  private push(ev: TelemetryEvent) {
    if (this.disposed) return
    if (this.buffer.length >= MAX_BUFFER) {
      this.buffer.shift()
      this.dropped++
    }
    this.buffer.push(ev)
  }

  /** Lấy và xoá toàn bộ sự kiện đang chờ (dùng khi flush / nộp bài) */
  drain(): TelemetryEvent[] {
    const out = this.buffer
    this.buffer = []
    return out
  }

  get pendingCount() { return this.buffer.length }
}

/**
 * Hook quản lý vòng đời telemetry cho MỘT assignment.
 * Reset phiên mỗi khi đổi bài; tự flush định kỳ để chống mất dữ liệu khi crash tab.
 */
export function useProcessTelemetry(asgnId: number | null) {
  const session = useMemo(() => new ProcessTelemetry(), [asgnId])
  const sessionRef = useRef(session)
  sessionRef.current = session

  useEffect(() => {
    session.start()
    const timer = setInterval(() => {
      const s = sessionRef.current
      if (s.pendingCount === 0) return
      API.post('/submissions/events/flush', {
        assignment_id: asgnId,
        session_id: s.sessionId,
        events: s.drain(),
      }).catch(() => { /* im lặng — flush là best-effort */ })
    }, FLUSH_INTERVAL_MS)
    return () => {
      clearInterval(timer)
      session.dispose()
    }
  }, [session, asgnId])

  return session
}
