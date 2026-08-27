// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — Programming Process Analytics
// Nền tảng nghiên cứu:
//   · Jadud (ICER 2006)      — Error Quotient: lặp lại lỗi qua nhiều lần nộp = "thrashing"
//   · Watson et al. (2013/14)— Watwin Score; hành vi khi gõ giải thích ~56% phương sai điểm
//   · Carter et al. (ICER'15)— NPSM: hai trục cú pháp × ngữ nghĩa
//   · Leinonen (SIGCSE'16)   — keystroke latency phân biệt novice/expert (18–29% phương sai)
//   · ProgSnap2 (Stamper)    — chuẩn sự kiện: File.Edit / Compile / Submit…
// Quy tắc riêng tư: KHÔNG lưu nội dung ký tự. Chỉ đếm (số lượng, độ trễ, timestamp).
// LLM/engine chấm điểm KHÔNG dùng metrics này để quyết điểm cuối (mixed-initiative,
// chỉ làm tín hiệu cảnh báo cho giảng viên — xem RTSF '24, arXiv 2607.02432).
// ─────────────────────────────────────────────────────────────────────────────

export const IDLE_GAP_MS = 60_000        // gap > 60s giữa 2 sự kiện → tính là idle block
export const MAX_EVENTS = 5_000          // cap an toàn chống payload khổng lồ
const MAX_EVENT_JSON_CHARS = 512

const EVENT_TYPES = new Set([
  'session.start', 'edit', 'keystroke', 'paste', 'cut',
  'focus.lost', 'focus.gained', 'submit.attempt',
])

const clampInt = (v, min, max, fallback = 0) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** Làm sạch sự kiện client gửi lên — whitelist + clamp, loại mọi thứ lạ */
export function sanitizeEvents(rawEvents, nowMs = Date.now()) {
  if (!Array.isArray(rawEvents)) return []
  // Giữ 5000 sự kiện GẦN NHẤT (client có thể gửi nhiều lần do flush định kỳ)
  const events = rawEvents.length > MAX_EVENTS ? rawEvents.slice(-MAX_EVENTS) : rawEvents
  const maxTs = nowMs + 30_000
  const out = []
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue
    const type = String(ev.type || '')
    if (!EVENT_TYPES.has(type)) continue
    const item = { type, ts: clampInt(ev.ts ?? Date.now(), 0, maxTs, Date.now()) }
    for (const [key, max] of [['ins', 2000], ['del', 2000], ['chars', 50_000], ['latency', 60_000]]) {
      if (ev[key] !== undefined && Number.isFinite(Number(ev[key]))) {
        item[key] = Math.min(max, Math.max(0, Math.round(Number(ev[key]))))
      }
    }
    out.push(item)
  }
  out.sort((a, b) => a.ts - b.ts)
  return out
}

/**
 * Tính metric quá trình từ chuỗi sự kiện.
 * @returns metrics object — lưu vào submissions.process_metrics_json
 */
export function computeProcessMetrics(events, codeLength = 0) {
  const ev = sanitizeEvents(events)
  const m = {
    event_count: ev.length,
    session_duration_ms: 0,
    active_ms: 0,
    idle_blocks: 0,
    edit_events: 0,
    chars_typed: 0,
    chars_deleted: 0,
    delete_ratio: 0,
    paste_count: 0,
    paste_chars: 0,
    paste_char_ratio: 0,
    burst_paste_count: 0,
    keystroke_count: 0,
    median_latency_ms: null,
    mean_latency_ms: null,
    focus_lost_count: 0,
    submit_attempts: 0,
    code_length: clampInt(codeLength, 0, 200_000),
    flags: [],
    process_risk: 0,
  }
  if (ev.length === 0) return m

  m.session_duration_ms = Math.max(0, ev[ev.length - 1].ts - ev[0].ts)

  // Active time & idle blocks — bỏ qua gap > IDLE_GAP_MS
  let activeMs = 0
  for (let i = 1; i < ev.length; i++) {
    const gap = ev[i].ts - ev[i - 1].ts
    if (gap > IDLE_GAP_MS) m.idle_blocks++
    else activeMs += gap
  }
  m.active_ms = activeMs

  const latencies = []
  for (const e of ev) {
    switch (e.type) {
      case 'edit':
        m.edit_events++
        m.chars_typed += clampInt(e.ins, 0, 2000)
        m.chars_deleted += clampInt(e.del, 0, 2000)
        break
      case 'paste':
        m.paste_count++
        m.paste_chars += clampInt(e.chars, 0, 50_000)
        if ((e.chars || 0) >= 200) m.burst_paste_count++
        break
      case 'cut':
        m.chars_deleted += clampInt(e.chars, 0, 2000)
        break
      case 'keystroke':
        m.keystroke_count++
        if (e.latency !== undefined && e.latency <= 60_000) latencies.push(e.latency)
        break
      case 'focus.lost':
        m.focus_lost_count++
        break
      case 'submit.attempt':
        m.submit_attempts++
        break
    }
  }

  m.delete_ratio = m.chars_typed > 0 ? +(m.chars_deleted / m.chars_typed).toFixed(3) : 0
  const totalInput = m.chars_typed + m.paste_chars
  m.paste_char_ratio = totalInput > 0 ? +(m.paste_chars / totalInput).toFixed(3) : 0

  if (latencies.length > 0) {
    latencies.sort((a, b) => a - b)
    const mid = Math.floor(latencies.length / 2)
    m.median_latency_ms = latencies.length % 2 ? latencies[mid] : Math.round((latencies[mid - 1] + latencies[mid]) / 2)
    m.mean_latency_ms = Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length)
  }

  // ── Flags (tín hiệu, không phải kết luận) ──
  const flags = []
  if (m.paste_char_ratio >= 0.6 && m.paste_chars >= 300) flags.push('high_paste_ratio')
  if (m.burst_paste_count >= 1 && m.chars_typed < 300) flags.push('burst_paste_dominant')
  if (m.median_latency_ms !== null && m.median_latency_ms < 80 && m.keystroke_count >= 50) flags.push('ultra_fast_typing')
  if (m.median_latency_ms !== null && m.median_latency_ms > 1500 && m.keystroke_count >= 100) flags.push('very_slow_typing')
  if (m.delete_ratio > 0.4 && m.chars_deleted >= 500) flags.push('high_delete_ratio')
  if (m.active_ms < 30_000 && totalInput >= 800) flags.push('minimal_activity')
  if (m.focus_lost_count >= 10) flags.push('excessive_focus_lost')
  m.flags = flags

  // Risk tổng hợp 0..1 — trọng số cố định, minh bạch cho paper
  const W = {
    high_paste_ratio: 0.35,
    burst_paste_dominant: 0.25,
    ultra_fast_typing: 0.30,
    minimal_activity: 0.30,
    very_slow_typing: 0.15,
    high_delete_ratio: 0.15,
    excessive_focus_lost: 0.10,
  }
  m.process_risk = +Math.min(1, flags.reduce((s, f) => s + (W[f] || 0), 0)).toFixed(3)
  return m
}

/**
 * EQ-lite — Error Quotient rút gọn theo tinh thần Jadud (ICER 2006), thích ứng
 * với hệ thống nộp-bài-chấm-sau thay vì compile-event:
 *   +5  mỗi attempt trượt (score < 50)
 *   +6  trượt liên tiếp giống attempt trước (repeated failure)
 *   +6  nộp lại trong < 15 phút sau attempt trượt (rapid retry, không phản tư)
 * Thang 0–100, càng cao càng "thrashing".
 * @param priorAttempts [{score_total, status, submitted_at}] sắp xếp tăng dần thời gian
 */
export function computeEqLite(priorAttempts) {
  if (!Array.isArray(priorAttempts)) return 0
  let eq = 0
  for (let i = 1; i < priorAttempts.length; i++) {
    const cur = priorAttempts[i]
    const prev = priorAttempts[i - 1]
    const curFail = isFailed(cur)
    const prevFail = isFailed(prev)
    if (curFail) eq += 5
    if (curFail && prevFail) eq += 6
    const delta = new Date(cur.submitted_at) - new Date(prev.submitted_at)
    if (curFail && Number.isFinite(delta) && delta >= 0 && delta < 15 * 60_000) eq += 6
  }
  // Attempt đầu tiên trượt cũng cộng nhẹ
  if (priorAttempts.length === 1 && isFailed(priorAttempts[0])) eq += 5
  return Math.min(100, eq)
}

const isFailed = s => s && (Number(s.score_total) < 50 || s.status === 'failed')

/** Gộp metrics + eq_lite thành JSON lưu cột process_metrics_json */
export function buildProcessMetricsJson(metrics, eqLite) {
  return JSON.stringify({ ...metrics, eq_lite: clampInt(eqLite, 0, 100) })
}
