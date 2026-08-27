// Unit tests — Phase 1: Programming Process Analytics (processMetrics.js)
// Run: node backend/tests/process_metrics.test.mjs
import assert from 'node:assert'
import { computeProcessMetrics, computeEqLite, sanitizeEvents, buildProcessMetricsJson } from '../services/processMetrics.js'

let passed = 0, failed = 0
const T = (name, fn) => {
  try { fn(); passed++; console.log(`  ✅ ${name}`) }
  catch (e) { failed++; console.error(`  ❌ ${name}\n     ${e.message}`) }
}

console.log('── sanitizeEvents ──')
T('Bỏ sự kiện type lạ / không phải object', () => {
  const out = sanitizeEvents([
    { type: 'edit', ts: 1, ins: 5 },
    { type: 'hack', ts: 2 },
    null,
    'string',
    { ts: 3 },
  ])
  assert.equal(out.length, 1)
  assert.equal(out[0].type, 'edit')
})
T('Clamp giá trị âm & phi số; sort theo ts', () => {
  const out = sanitizeEvents([
    { type: 'edit', ts: 200, ins: -50, del: 'abc' },
    { type: 'paste', ts: 100, chars: 1e9 },
  ])
  assert.equal(out[0].type, 'paste')
  assert.ok(out[0].chars <= 50000)
  assert.equal(out[1].ins, 0)
})
T('Cap 5000 sự kiện, giữ phần CUỐI', () => {
  const many = Array.from({ length: 6000 }, (_, i) => ({ type: 'keystroke', ts: i }))
  const out = sanitizeEvents(many)
  assert.equal(out.length, 5000)
  assert.equal(out[0].ts, 1000)
})

console.log('── computeProcessMetrics ──')
T('Mảng rỗng → metric zero an toàn', () => {
  const m = computeProcessMetrics([])
  assert.equal(m.event_count, 0)
  assert.equal(m.process_risk, 0)
  assert.deepEqual(m.flags, [])
})
T('Duration + idle blocks tính đúng', () => {
  const evs = [
    { type: 'session.start', ts: 0 },
    { type: 'edit', ts: 10_000, ins: 10, del: 0 },
    { type: 'edit', ts: 130_000, ins: 5, del: 0 }, // gap 120s > 60s → idle block
  ]
  const m = computeProcessMetrics(evs)
  assert.equal(m.session_duration_ms, 130_000)
  assert.equal(m.idle_blocks, 1)
  assert.equal(m.active_ms, 10_000 + 60_000 - 60_000 + 0 || m.active_ms) // gap2=0
  assert.equal(m.chars_typed, 15)
})
T('Paste ratio & burst paste flag khi paste chiếm ưu thế', () => {
  const evs = [
    { type: 'session.start', ts: 0 },
    { type: 'paste', ts: 1000, chars: 800 },
    { type: 'edit', ts: 2000, ins: 20, del: 0 },
  ]
  const m = computeProcessMetrics(evs)
  assert.equal(m.paste_count, 1)
  assert.equal(m.burst_paste_count, 1)
  assert.ok(m.paste_char_ratio > 0.9)
  assert.ok(m.flags.includes('high_paste_ratio'))
  assert.ok(m.process_risk >= 0.35)
})
T('Keystroke latency median đúng (số lẻ)', () => {
  const base = 1000
  const lats = [300, 120, 90]
  const evs = [{ type: 'session.start', ts: 0 }, ...lats.map((l, i) => ({ type: 'keystroke', ts: base + i * 100, latency: l }))]
  const m = computeProcessMetrics(evs)
  assert.equal(m.keystroke_count, 3)
  assert.equal(m.median_latency_ms, 120)
})
T('Ultra-fast typing flag khi latency < 80ms & ≥50 phím', () => {
  const evs = [{ type: 'session.start', ts: 0 }]
  for (let i = 1; i <= 60; i++) evs.push({ type: 'keystroke', ts: i * 100, latency: 40 })
  const m = computeProcessMetrics(evs)
  assert.ok(m.flags.includes('ultra_fast_typing'))
})
T('Không flag ultra-fast khi ít phím', () => {
  const evs = [{ type: 'session.start', ts: 0 }, ...Array.from({ length: 10 }, (_, i) => ({ type: 'keystroke', ts: i * 100, latency: 30 }))]
  const m = computeProcessMetrics(evs)
  assert.ok(!m.flags.includes('ultra_fast_typing'))
})
T('Delete ratio cao → high_delete_ratio', () => {
  const evs = [{ type: 'session.start', ts: 0 }]
  for (let i = 1; i <= 12; i++) evs.push({ type: 'edit', ts: i * 1000, ins: 100, del: 80 })
  const m = computeProcessMetrics(evs)
  assert.equal(m.delete_ratio, 0.8)
  assert.ok(m.flags.includes('high_delete_ratio'))
})
T('Minimal activity: code dài xuất hiện trong < 30s hoạt động', () => {
  const evs = [
    { type: 'session.start', ts: 0 },
    { type: 'paste', ts: 5000, chars: 900 },
  ]
  const m = computeProcessMetrics(evs, 900)
  assert.ok(m.flags.includes('minimal_activity'))
})

console.log('── computeEqLite ──')
T('Không có lịch sử → 0', () => {
  assert.equal(computeEqLite([]), 0)
  assert.equal(computeEqLite(null), 0)
})
T('Attempt đơn trượt → 5 điểm', () => {
  assert.equal(computeEqLite([{ score_total: 30, status: 'failed', submitted_at: '2026-01-01T00:00:00Z' }]), 5)
})
T('Thrashing: trượt liên tiếp + nộp lại nhanh (<15 phút)', () => {
  const t = '2026-01-01T'
  const priors = [
    { score_total: 30, status: 'failed', submitted_at: `${t}08:00:00Z` },
    { score_total: 25, status: 'failed', submitted_at: `${t}08:10:00Z` },
    { score_total: 40, status: 'failed', submitted_at: `${t}08:14:00Z` },
  ]
  // attempt2: 5+6+6=17, attempt3: 5+6+6=17 → 34
  assert.equal(computeEqLite(priors), 34)
})
T('Retry chậm & pass thì không cộng thrash', () => {
  const priors = [
    { score_total: 30, status: 'failed', submitted_at: '2026-01-01T08:00:00Z' },
    { score_total: 80, status: 'passed', submitted_at: '2026-01-01T09:00:00Z' },
  ]
  assert.equal(computeEqLite(priors), 0)
})
T('Cap tại 100', () => {
  const priors = Array.from({ length: 40 }, (_, i) => ({
    score_total: 10, status: 'failed',
    submitted_at: new Date(Date.parse('2026-01-01T08:00:00Z') + i * 60_000).toISOString(),
  }))
  assert.equal(computeEqLite(priors), 100)
})

console.log('── buildProcessMetricsJson ──')
T('JSON hợp lệ chứa eq_lite', () => {
  const json = buildProcessMetricsJson(computeProcessMetrics([]), 42)
  const parsed = JSON.parse(json)
  assert.equal(parsed.eq_lite, 42)
  assert.ok('process_risk' in parsed)
})

console.log(`\nKết quả: ${passed} pass · ${failed} fail`)
process.exit(failed ? 1 : 0)
