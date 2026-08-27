// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — Rubric LLM-as-a-Judge & Mixed-Initiative Merge
//
// Thiết kế bám theo:
//   · rubric_framework.md (11 tiêu chí, khung T1/T2/T3)
//   · RTSF (ACM 2024): tiêu chí static-analysis do ENGINE quyết, KHÔNG để LLM tự
//     quyết mọi thứ → LLM chỉ chấm tiêu chí định tính (T2 + phần tư duy của T3)
//   · Mixed-initiative pipeline (arXiv 2603.16357): LLM chắc tay thì áp,
//     không chắc / mâu thuẫn engine thì GẮN CỜ cho giảng viên duyệt
//   · Thang 0–5 mỗi tiêu chí (arXiv 2601.03444 bảng 5: đồng thuận người–LLM cao nhất)
//
// Tiêu chí 3.4 Debugging Strategy: trong hệ thống này đo bằng PROCESS TELEMETRY
// (Phase 1: eq_lite, paste flags) thay vì git history — vẫn do quy tắc quyết,
// không phải LLM.
// ─────────────────────────────────────────────────────────────────────────────

/** Ngưỡng tin cậy tối thiểu để tự động áp điểm LLM (mixed-initiative) */
export const AUTO_APPLY_CONFIDENCE = 0.65

/** Chênh lệch tối đa (trên thang 0–5) giữa LLM và engine proxy để coi là "đồng thuận" */
export const AGREEMENT_TOLERANCE = 1

/**
 * 7 tiêu chí định tính do LLM chấm (thang 0–5).
 * proxy_quality: độ tin cậy của engine-proxy tương ứng
 *   high   — heuristic engine đo trực tiếp được → cần đồng thuận mới áp điểm LLM
 *   low    — engine gần như mù tiêu chí này → đủ confidence là áp điểm LLM
 */
export const QUALITATIVE_CRITERIA = [
  { id: 'naming',               tier: 'T2', max: 10, name_vi: 'Đặt tên biến/hàm & dễ đọc',      proxy_quality: 'high' },
  { id: 'comments',             tier: 'T2', max: 8,  name_vi: 'Comment & tài liệu hoá',          proxy_quality: 'high' },
  { id: 'structure_efficiency', tier: 'T2', max: 12, name_vi: 'Cấu trúc code & hiệu quả',        proxy_quality: 'high' },
  { id: 'idiomatic',            tier: 'T2', max: 5,  name_vi: 'Idiomatic C++ (chất ngôn ngữ)',   proxy_quality: 'low' },
  { id: 'decomposition',        tier: 'T3', max: 8,  name_vi: 'Chia nhỏ vấn đề (decomposition)', proxy_quality: 'low' },
  { id: 'abstraction',          tier: 'T3', max: 7,  name_vi: 'Trừu tượng hoá & tổng quát hoá',  proxy_quality: 'low' },
  { id: 'pattern_reuse',        tier: 'T3', max: 5,  name_vi: 'Nhận diện pattern & tái sử dụng', proxy_quality: 'low' },
]

// Điểm tối đa lý thuyết của 2 tầng định tính (dùng để scale theo weight_t2/t3 của đề)
export const T2_MAX = QUALITATIVE_CRITERIA.filter(c => c.tier === 'T2').reduce((s, c) => s + c.max, 0) // 35
export const T3_MAX = 25 // 20đ LLM + 5đ debugging-via-process
const DEBUG_PROCESS_MAX = 5

const clamp05 = v => Math.max(0, Math.min(5, Math.round(Number(v) || 0)))

/**
 * Engine proxy (0–5) cho từng tiêu chí từ quality_signals của analyzeCode.
 * Đây là "đối chứng deterministic" dùng trong phép kiểm tra đồng thuận.
 */
export function computeEngineProxies(qs) {
  qs = qs || {}
  const extraFn = qs.extraFunctionCount || 0
  return {
    naming: { score: qs.hasGoodNaming ? 4 : 2, quality: 'high' },
    comments: { score: qs.meaningfulComments ? 4 : (qs.hasComments ? 2 : 1), quality: 'high' },
    structure_efficiency: {
      score: clampProxy((extraFn > 0 ? 3 : 1) + (qs.isReasonableComplexity ? 1 : 0) +
        (['O(N^3)', 'O(2^N)'].includes(qs.estimatedBigO) ? -1 : 0)),
      quality: 'high',
    },
    idiomatic: { score: 3, quality: 'low' },
    decomposition: { score: extraFn >= 2 ? 4 : extraFn === 1 ? 3 : 1, quality: 'low' },
    abstraction: { score: 3, quality: 'low' },
    pattern_reuse: { score: 3, quality: 'low' },
  }
}
const clampProxy = v => Math.max(1, Math.min(5, v))

/**
 * Tiêu chí 3.4 (Debugging Strategy) — quy tắc từ process metrics (Phase 1).
 * Trả về điểm 0–5 hoặc null nếu KHÔNG có telemetry (bài nộp cũ).
 */
export function computeProcessDebuggingScore(pm) {
  if (!pm || typeof pm !== 'object') return null
  let s = 3
  const eq = Number(pm.eq_lite ?? 0)
  if (eq >= 40) s -= 2
  else if (eq >= 25) s -= 1
  const f = Array.isArray(pm.flags) ? pm.flags : []
  if (f.includes('burst_paste_dominant')) s -= 1
  if (f.includes('high_paste_ratio')) s -= 1
  if ((Number(pm.submit_attempts) || 0) >= 4 && eq >= 20) s -= 1
  if (f.length === 0 && eq < 10 && (Number(pm.submit_attempts) || 0) <= 1) s += 1
  return Math.max(0, Math.min(DEBUG_PROCESS_MAX, s))
}

/**
 * Quyết định mixed-initiative cho MỘT tiêu chí.
 * @returns applied_score (thang 0–5 sẽ được áp chính thức), source, needs_review
 */
export function decideCriterion(criterion, llmItem, proxyItem) {
  const conf = Math.max(0, Math.min(1, Number(llmItem?.confidence) || 0))
  const hasLlm = llmItem && Number.isFinite(Number(llmItem.score))
  const llmScore = hasLlm ? clamp05(llmItem.score) : null
  const proxyScore = clamp05(proxyItem?.score ?? 3)

  // Không có điểm LLM → dùng proxy engine, không cờ (chế độ engine-only)
  if (!hasLlm) {
    return { score_llm: null, confidence: conf, evidence: '', applied_score: proxyScore, source: 'engine', needs_review: false }
  }

  const agrees = Math.abs(llmScore - proxyScore) <= AGREEMENT_TOLERANCE
  const canAutoApply =
    conf >= AUTO_APPLY_CONFIDENCE &&
    (criterion.proxy_quality === 'low' || agrees)

  if (canAutoApply) {
    return { score_llm: llmScore, confidence: conf, evidence: String(llmItem.evidence || '').slice(0, 240), applied_score: llmScore, source: 'llm', needs_review: false }
  }
  // Không chắc / mâu thuẫn engine → giữ proxy làm giá trị tạm, gắn cờ duyệt
  return { score_llm: llmScore, confidence: conf, evidence: String(llmItem.evidence || '').slice(0, 240), applied_score: proxyScore, source: 'engine_pending', needs_review: true }
}

/**
 * Dựng breakdown hoàn chỉnh + quyết định review_status + điểm T2/T3 theo thang 0–5.
 * @param opts { llmCriteria: [{id,score,confidence,evidence}], qualitySignals, processMetrics }
 * @returns { breakdown, review_status, earned_t2_05, earned_t3_05 } — earned theo thang điểm đã chia 5
 */
export function buildRubricBreakdown(opts = {}) {
  const proxies = computeEngineProxies(opts.qualitySignals)
  const llmMap = new Map((Array.isArray(opts.llmCriteria) ? opts.llmCriteria : []).map(c => [String(c.id), c]))
  const dbgScore = computeProcessDebuggingScore(opts.processMetrics)

  const breakdown = []
  let anyNeedsReview = false

  for (const crit of QUALITATIVE_CRITERIA) {
    const d = decideCriterion(crit, llmMap.get(crit.id), proxies[crit.id])
    if (d.needs_review) anyNeedsReview = true
    breakdown.push({ id: crit.id, tier: crit.tier, max: crit.max, name_vi: crit.name_vi, ...d })
  }

  // Tiêu chí 3.4 — process-based, không qua LLM
  breakdown.push({
    id: 'debugging_process', tier: 'T3', max: DEBUG_PROCESS_MAX, name_vi: 'Chiến lược debug (từ telemetry)',
    score_llm: null, confidence: 1, evidence: '',
    applied_score: dbgScore === null ? 3 : dbgScore,       // không có dữ liệu → mặc định trung lập 3/5
    source: dbgScore === null ? 'default' : 'process',
    needs_review: false,
  })

  const earned = { T2: 0, T3: 0 }
  for (const b of breakdown) earned[b.tier] += (b.applied_score / 5) * b.max

  return {
    breakdown,
    review_status: anyNeedsReview ? 'needs_review' : 'auto',
    earned_t2_05: +earned.T2.toFixed(2),
    earned_t3_05: +earned.T3.toFixed(2),
  }
}

/** Scale điểm tầng sang trọng số của đề bài: earned/max * weight */
export function scaleTier(earnedPoints, tierMax, weight) {
  return Math.max(0, Math.round((earnedPoints / tierMax) * weight))
}

/** Tổng hợp lại total/status sau khi rubric thay đổi T2/T3 */
export function recomputeTotals(scoreT1, newT2, newT3) {
  if (scoreT1 === null || scoreT1 === undefined) return { total: null, status: 'ungraded' }
  const total = Math.min(100, Math.max(0, Math.round(scoreT1 + newT2 + newT3)))
  return { total, status: total >= 70 ? 'passed' : total >= 50 ? 'warning' : 'failed' }
}

/**
 * Áp quyết định duyệt của giảng viên lên breakdown hiện có.
 * @param teacherScores {criterionId: 0..5} — bỏ qua key lạ; accept_llm=true → lấy điểm LLM cho các tiêu chí còn lại
 */
export function applyTeacherReview(existingBreakdown, teacherScores = {}, acceptLlm = false) {
  const scores = teacherScores && typeof teacherScores === 'object' ? teacherScores : {}
  const out = existingBreakdown.map(b => {
    const t = scores[b.id]
    if (t !== undefined && Number.isFinite(Number(t))) {
      return { ...b, applied_score: clamp05(t), source: 'teacher', needs_review: false }
    }
    if (acceptLlm && b.score_llm !== null && b.score_llm !== undefined) {
      return { ...b, applied_score: clamp05(b.score_llm), source: 'teacher_llm_accept', needs_review: false }
    }
    return { ...b, needs_review: false }
  })
  const earned = { T2: 0, T3: 0 }
  for (const b of out) earned[b.tier] += (b.applied_score / 5) * b.max
  return {
    breakdown: out,
    review_status: 'reviewed',
    earned_t2_05: +earned.T2.toFixed(2),
    earned_t3_05: +earned.T3.toFixed(2),
  }
}

/**
 * Cohen's κ (không trọng số) trên thang 0–5 giữa hai chuỗi điểm.
 * Dùng cho RQ1: mức đồng thuận LLM ↔ giảng viên.
 */
export function cohensKappa05(pairs) {
  const labels = [0, 1, 2, 3, 4, 5]
  const valid = (pairs || []).filter(p => Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
  const n = valid.length
  if (n === 0) return { kappa: null, n: 0, exact_agreement: null, adjacent_agreement: null, mae: null }
  const conf = {}
  labels.forEach(a => { conf[a] = {}; labels.forEach(b => { conf[a][b] = 0 }) })
  let exact = 0, adjacent = 0, absSum = 0
  for (const [llm, tea] of valid) {
    const l = clamp05(llm), t = clamp05(tea)
    conf[t][l]++
    if (l === t) exact++
    if (Math.abs(l - t) <= 1) adjacent++
    absSum += Math.abs(l - t)
  }
  const po = exact / n
  const pe = labels.reduce((s, a) => {
    const rowSum = labels.reduce((r, b) => r + conf[a][b], 0)
    const colSum = labels.reduce((r, b) => r + conf[b][a], 0)
    return s + (rowSum / n) * (colSum / n)
  }, 0)
  const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe)
  return {
    kappa: +kappa.toFixed(4),
    n,
    exact_agreement: +(exact / n).toFixed(4),
    adjacent_agreement: +(adjacent / n).toFixed(4),
    mae: +(absSum / n).toFixed(4),
  }
}
