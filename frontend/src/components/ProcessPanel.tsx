// Phase 1 — Panel "Hành vi làm bài" cho giảng viên
// Hiển thị process analytics của một submission: thời gian hoạt động, nhịp gõ,
// paste-ratio, EQ-lite (Jadud-style thrashing), timeline hoạt động theo phút.
import { useEffect, useState } from 'react'
import { submissions } from '../api'
import { scoreColor } from './ui'

const FLAG_LABEL: Record<string, { label: string; icon: string; color: string }> = {
  high_paste_ratio: { label: 'Tỷ lệ dán code cao', icon: '📋', color: '#f87171' },
  burst_paste_dominant: { label: 'Dán số lượng lớn, gõ ít', icon: '📥', color: '#f87171' },
  ultra_fast_typing: { label: 'Gõ nhanh bất thường (<80ms/phím)', icon: '⚡', color: '#f97316' },
  very_slow_typing: { label: 'Gõ rất chậm — có thể đang lúng túng', icon: '🐢', color: '#fbbf24' },
  high_delete_ratio: { label: 'Xoá/sửa nhiều — dấu hiệu thrashing', icon: '🌀', color: '#fbbf24' },
  minimal_activity: { label: 'Hoạt động ít nhưng code dài xuất hiện nhanh', icon: '❓', color: '#f87171' },
  excessive_focus_lost: { label: 'Rời tab quá nhiều lần', icon: '🚪', color: '#f97316' },
}

const fmtDuration = (ms: number) => {
  if (!ms || ms < 0) return '—'
  const s = Math.round(ms / 1000)
  const mm = Math.floor(s / 60), ss = s % 60
  return `${mm}p ${String(ss).padStart(2, '0')}s`
}

function Metric({ label, value, sub, color }: { label: string; value: any; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg3)', borderRadius: 'var(--r10)', padding: '10px 12px', border: '1px solid var(--b1)' }}>
      <div style={{ fontSize: '.62rem', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontFamily: 'var(--display)', fontSize: '1.15rem', fontWeight: 800, color: color || 'var(--t1)', lineHeight: 1.3 }}>{value}</div>
      {sub && <div style={{ fontSize: '.64rem', color: 'var(--t4)' }}>{sub}</div>}
    </div>
  )
}

export default function ProcessPanel({ submissionId }: { submissionId: number }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true); setData(null)
    submissions.processEvents(submissionId)
      .then((r: any) => { if (alive) setData(r) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [submissionId])

  if (loading) {
    return <div style={{ marginTop: '14px', fontSize: '.75rem', color: 'var(--t3)' }}>⏳ Đang tải dữ liệu quá trình làm bài...</div>
  }

  const metrics = data?.metrics
  const events: any[] = data?.events || []
  if (!metrics && events.length === 0) {
    return (
      <div style={{ marginTop: '14px', fontSize: '.75rem', color: 'var(--t4)', background: 'var(--bg3)', borderRadius: 'var(--r10)', padding: '10px 14px' }}>
        📊 Chưa có dữ liệu quá trình làm bài cho bài nộp này (nộp trước khi tính năng telemetry được kích hoạt).
      </div>
    )
  }

  // Timeline: bucket theo phút (tối đa 60 cột)
  const durationMs = Math.max(1, metrics?.session_duration_ms || 0)
  const bucketCount = Math.min(60, Math.max(6, Math.ceil(durationMs / 60_000)))
  const bucketMs = durationMs / bucketCount
  const buckets = Array.from({ length: bucketCount }, () => ({ total: 0, paste: 0 }))
  for (const ev of events) {
    if (!ev.type || ev.ts === undefined || ev.ts === null) continue
    const firstTs = events[0]?.ts ?? 0
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor((ev.ts - firstTs) / Math.max(1, bucketMs))))
    buckets[idx].total++
    if (ev.type === 'paste') buckets[idx].paste += (ev.chars || 0) >= 200 ? 1 : 0
  }
  const maxBucket = Math.max(1, ...buckets.map(b => b.total))

  const risk = Number(metrics?.process_risk ?? 0)
  const eqLite = metrics?.eq_lite

  return (
    <div style={{ marginTop: '16px', border: '1px solid var(--b1)', borderRadius: 'var(--r12)', padding: '14px 16px', background: 'var(--bg2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontWeight: 700, fontSize: '.82rem', fontFamily: 'var(--display)' }}>📊 Hành vi làm bài — phân tích ngầm</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '.68rem', color: 'var(--t3)' }}>Process risk</span>
          <div style={{ width: '110px', height: '7px', borderRadius: '4px', background: 'var(--bg4)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(risk * 100)}%`, height: '100%', background: scoreColor(Math.round(100 - risk * 100)) }} />
          </div>
          <b style={{ fontSize: '.72rem', color: scoreColor(Math.round(100 - risk * 100)) }}>{Math.round(risk * 100)}%</b>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', marginBottom: '12px' }}>
        <Metric label="Thời gian hoạt động" value={fmtDuration(metrics?.active_ms)} sub={`Phiên ${fmtDuration(metrics?.session_duration_ms)}`} />
        <Metric label="Số phím ghi nhận" value={metrics?.keystroke_count ?? '—'} sub={metrics?.median_latency_ms != null ? `Median latency ${metrics.median_latency_ms}ms` : undefined} />
        <Metric label="Ký tự tự gõ" value={metrics?.chars_typed ?? 0} sub={`Xoá ${(Number(metrics?.delete_ratio || 0) * 100).toFixed(0)}%`} />
        <Metric label="Dán (paste)" value={metrics?.paste_count ?? 0} sub={`${((Number(metrics?.paste_char_ratio || 0)) * 100).toFixed(0)}% ký tự`} color={Number(metrics?.paste_char_ratio || 0) >= 0.5 ? '#f87171' : undefined} />
        <Metric label="Rời tab" value={metrics?.focus_lost_count ?? 0} />
        <Metric label="EQ-lite (thrashing)" value={eqLite != null ? eqLite : '—'} sub="Jadud ICER'06" color={Number(eqLite || 0) >= 40 ? '#f87171' : undefined} />
        <Metric label="Lần bấm Nộp" value={metrics?.submit_attempts ?? 0} />
      </div>

      {/* Timeline hoạt động */}
      <div style={{ fontSize: '.66rem', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' }}>
        Timeline hoạt động ({bucketCount} bucket × ~{Math.round(bucketMs / 1000)}s)
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '44px', marginBottom: '10px' }}>
        {buckets.map((b, i) => (
          <div key={i}
            title={`${b.total} sự kiện${b.paste ? ` · ${b.paste} paste lớn` : ''}`}
            style={{
              flex: 1, height: `${Math.max(6, (b.total / maxBucket) * 100)}%`,
              minHeight: '3px', borderRadius: '2px 2px 0 0',
              background: b.paste > 0 ? '#f87171' : 'var(--bl)',
              opacity: b.total ? 0.9 : 0.25,
            }} />
        ))}
      </div>

      {/* Flags */}
      {(metrics?.flags || []).length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {(metrics.flags as string[]).map(f => {
            const info = FLAG_LABEL[f] || { label: f, icon: '•', color: 'var(--t2)' }
            return (
              <div key={f} style={{ fontSize: '.74rem', color: info.color, fontWeight: 600 }}>
                {info.icon} {info.label}
              </div>
            )
          })}
          <div style={{ fontSize: '.64rem', color: 'var(--t4)', marginTop: '2px' }}>
            ⚠️ Tín hiệu tham khảo cho giảng viên — không tự động thay đổi điểm của sinh viên.
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '.74rem', color: 'var(--gn)' }}>✅ Không phát hiện tín hiệu bất thường trong quá trình làm bài.</div>
      )}
    </div>
  )
}
