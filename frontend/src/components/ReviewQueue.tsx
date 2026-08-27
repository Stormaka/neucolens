// Phase 2 — Hàng đợi duyệt chấm LLM-as-a-Judge (mixed-initiative)
// GV xem từng tiêu chí: điểm LLM + confidence + evidence, rồi chấp nhận hoặc chỉnh.
import { useEffect, useState, useCallback } from 'react'
import { submissions } from '../api'
import { scoreColor, useToast } from './ui'

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  llm: { label: '🤖 LLM', cls: 'bdp' },
  engine: { label: '⚙️ Engine', cls: 'bdn' },
  engine_pending: { label: '⏳ Chờ duyệt', cls: 'bdy' },
  teacher: { label: '👨‍🏫 GV', cls: 'bdg' },
  teacher_llm_accept: { label: '✅ GV nhận LLM', cls: 'bdg' },
  process: { label: '📈 Telemetry', cls: 'bdb' },
  default: { label: '—', cls: 'bdn' },
}

function AgreementBanner({ stats }: { stats: any }) {
  if (!stats?.overall) return null
  const o = stats.overall
  const k = o.kappa
  return (
    <div className="card card-sm" style={{ marginBottom: '14px' }}>
      <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: '8px', fontFamily: 'var(--display)' }}>
        📐 Mức đồng thuận LLM ↔ Giảng viên (Cohen's κ)
      </div>
      {k === null ? (
        <div style={{ fontSize: '.78rem', color: 'var(--t3)' }}>
          Chưa có cặp điểm nào (cần GV duyệt ít nhất 1 bài có điểm LLM). Mục tiêu nghiên cứu: κ ≥ 0.61.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '.68rem', color: 'var(--t3)', display: 'block' }}>κ tổng hợp</span>
            <b style={{ fontSize: '1.4rem', fontFamily: 'var(--display)', color: k >= 0.61 ? 'var(--gn)' : '#fbbf24' }}>{k.toFixed(2)}</b>
          </div>
          <div><span style={{ fontSize: '.68rem', color: 'var(--t3)', display: 'block' }}>Trùng khớp tuyệt đối</span>{(o.exact_agreement * 100).toFixed(0)}%</div>
          <div><span style={{ fontSize: '.68rem', color: 'var(--t3)', display: 'block' }}>Sai lệch ≤ 1 bậc</span>{(o.adjacent_agreement * 100).toFixed(0)}%</div>
          <div><span style={{ fontSize: '.68rem', color: 'var(--t3)', display: 'block' }}>MAE (thang 0–5)</span>{o.mae}</div>
          <div><span style={{ fontSize: '.68rem', color: 'var(--t3)', display: 'block' }}>Số cặp / bài đã duyệt</span>{o.n} / {stats.reviewed_submissions}</div>
        </div>
      )}
    </div>
  )
}

function ReviewCard({ item, onDone }: { item: any; onDone: () => void }) {
  const { toast } = useToast()
  const [detail, setDetail] = useState<any>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    submissions.poll(item.id).then((d: any) => {
      if (!alive) return
      setDetail(d)
      const init: Record<string, number> = {}
      ;(d.rubric_breakdown || []).forEach((b: any) => { init[b.id] = b.applied_score ?? 3 })
      setScores(init)
    }).catch(() => {})
    return () => { alive = false }
  }, [item.id])

  const save = async (acceptLlm: boolean) => {
    setSaving(true)
    try {
      await submissions.review(item.id, acceptLlm ? { accept_llm: true } : { scores })
      toast(acceptLlm ? '✅ Đã chấp nhận điểm LLM' : '✅ Đã lưu điều chỉnh của bạn')
      onDone()
    } catch (e: any) { toast(e.message || 'Lỗi lưu review', true) }
    finally { setSaving(false) }
  }

  const bd = detail?.rubric_breakdown || []
  const hasLlmScores = bd.some((b: any) => b.score_llm !== null && b.score_llm !== undefined)

  return (
    <div className="card" style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '.92rem', fontFamily: 'var(--display)' }}>{item.student_name} · {item.assignment_title}</div>
          <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginTop: '2px' }}>
            Lần {item.attempt_number} · {new Date(item.submitted_at).toLocaleString('vi-VN')} · Hiện tại: <b style={{ color: scoreColor(item.score_total || 0) }}>{item.score_total ?? '—'}/100</b> (T1 {item.score_t1 ?? '—'} · T2 {item.score_t2 ?? '—'} · T3 {item.score_t3 ?? '—'})
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" disabled={saving || !hasLlmScores} onClick={() => save(true)} title={hasLlmScores ? '' : 'Bài này không có điểm LLM'}>
            ✅ Chấp nhận điểm LLM
          </button>
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => save(false)}>💾 Lưu điểm đã chỉnh</button>
        </div>
      </div>

      {!detail ? (
        <div style={{ fontSize: '.78rem', color: 'var(--t3)' }}>⏳ Đang tải rubric...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
            <thead>
              <tr style={{ color: 'var(--t3)', textAlign: 'left', borderBottom: '1px solid var(--b2)' }}>
                <th style={{ padding: '6px 8px' }}>Tiêu chí</th>
                <th style={{ padding: '6px 8px' }}>Tầng/Max</th>
                <th style={{ padding: '6px 8px' }}>LLM</th>
                <th style={{ padding: '6px 8px' }}>Conf.</th>
                <th style={{ padding: '6px 8px' }}>Điểm áp dụng</th>
                <th style={{ padding: '6px 8px' }}>Nguồn</th>
              </tr>
            </thead>
            <tbody>
              {bd.map((b: any) => {
                const sb = SOURCE_BADGE[b.source] || SOURCE_BADGE.default
                return (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--b1)' }}>
                    <td style={{ padding: '7px 8px' }}>
                      <div style={{ fontWeight: 600 }}>{b.name_vi}</div>
                      {b.evidence && <div style={{ fontSize: '.68rem', color: 'var(--t3)', marginTop: '2px' }}>💡 {b.evidence}</div>}
                    </td>
                    <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>{b.tier}/5 (max {b.max})</td>
                    <td style={{ padding: '7px 8px', fontWeight: 700, color: b.score_llm !== null && b.score_llm !== undefined ? 'var(--pu)' : 'var(--t4)' }}>
                      {b.score_llm !== null && b.score_llm !== undefined ? `${b.score_llm}/5` : '—'}
                    </td>
                    <td style={{ padding: '7px 8px' }}>{b.confidence != null ? `${Math.round(b.confidence * 100)}%` : '—'}</td>
                    <td style={{ padding: '7px 8px' }}>
                      <select
                        className="input"
                        style={{ padding: '4px 8px', width: '70px', fontSize: '.8rem' }}
                        value={scores[b.id] ?? 3}
                        onChange={e => setScores(s => ({ ...s, [b.id]: Number(e.target.value) }))}
                      >
                        {[0, 1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '7px 8px' }}><span className={`badge ${sb.cls}`} style={{ fontSize: '.62rem' }}>{sb.label}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function ReviewQueue() {
  const [queue, setQueue] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [q, s] = await Promise.all([
        submissions.needsReview({ limit: 50 }),
        submissions.agreementStats().catch(() => null),
      ])
      setQueue(q.data || [])
      setStats(s)
    } catch { setQueue([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--t3)' }}>⏳ Đang tải hàng đợi duyệt...</div>

  return (
    <div>
      <AgreementBanner stats={stats} />
      {queue.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--t3)' }}>
          🎉 Không có bài nộp nào cần duyệt. Hệ thống chỉ gắn cờ khi điểm LLM không chắc tay hoặc mâu thuẫn với engine.
        </div>
      ) : queue.map(item => (
        <ReviewCard key={item.id} item={item} onDone={load} />
      ))}
    </div>
  )
}
