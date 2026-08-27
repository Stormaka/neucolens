// Unit tests — Phase 2: Rubric LLM-as-a-Judge & mixed-initiative merge
// Run: node backend/tests/rubric_judge.test.mjs
import assert from 'node:assert'
import {
  QUALITATIVE_CRITERIA, computeEngineProxies, computeProcessDebuggingScore,
  decideCriterion, buildRubricBreakdown, scaleTier, recomputeTotals,
  applyTeacherReview, cohensKappa05, AUTO_APPLY_CONFIDENCE,
} from '../services/rubric.js'
import { parseJudgeResponse } from '../services/llmJudge.js'

let passed = 0, failed = 0
const T = (name, fn) => {
  try { fn(); passed++; console.log(`  ✅ ${name}`) }
  catch (e) { failed++; console.error(`  ❌ ${name}\n     ${e.message}`) }
}

console.log('── Rubric định nghĩa ──')
T('7 tiêu chí LLM, tổng T2 = 35đ đúng rubric gốc', () => {
  assert.equal(QUALITATIVE_CRITERIA.length, 7)
  const t2 = QUALITATIVE_CRITERIA.filter(c => c.tier === 'T2').reduce((s, c) => s + c.max, 0)
  const t3llm = QUALITATIVE_CRITERIA.filter(c => c.tier === 'T3').reduce((s, c) => s + c.max, 0)
  assert.equal(t2, 35)
  assert.equal(t3llm, 20) // + 5đ debugging_process = 25
})

console.log('── Engine proxies ──')
T('Proxy naming/comments phản ánh quality_signals', () => {
  const p = computeEngineProxies({ hasGoodNaming: true, meaningfulComments: true, extraFunctionCount: 2, isReasonableComplexity: true, estimatedBigO: 'O(N)' })
  assert.ok(p.naming.score >= 4)
  assert.ok(p.comments.score >= 4)
  assert.ok(p.structure_efficiency.score >= 4)
})
T('Proxy structure bị phạt khi BigO tệ', () => {
  const p = computeEngineProxies({ hasGoodNaming: false, extraFunctionCount: 0, isReasonableComplexity: false, estimatedBigO: 'O(N^3)' })
  assert.ok(p.structure_efficiency.score <= 1)
})

console.log('── decideCriterion (mixed-initiative) ──')
const critHigh = { id: 'naming', proxy_quality: 'high' }
const critLow = { id: 'idiomatic', proxy_quality: 'low' }

T('LLM chắc tay + đồng thuận proxy(high) → áp điểm LLM', () => {
  const d = decideCriterion(critHigh, { score: 4, confidence: 0.9 }, { score: 4 })
  assert.equal(d.applied_score, 4)
  assert.equal(d.source, 'llm')
  assert.equal(d.needs_review, false)
})
T('LLM chắc tay nhưng lệch proxy > 1 (high) → needs_review', () => {
  const d = decideCriterion(critHigh, { score: 5, confidence: 0.95 }, { score: 2 })
  assert.equal(d.needs_review, true)
  assert.equal(d.applied_score, 2)          // giữ proxy tạm thời
  assert.equal(d.source, 'engine_pending')
})
T('Tiêu chí low-quality: đủ confidence là áp, không cần đồng thuận', () => {
  const d = decideCriterion(critLow, { score: 5, confidence: 0.8 }, { score: 2 })
  assert.equal(d.applied_score, 5)
  assert.equal(d.needs_review, false)
})
T('Confidence thấp → luôn needs_review dù đồng thuận', () => {
  const d = decideCriterion(critLow, { score: 3, confidence: 0.4 }, { score: 3 })
  assert.equal(d.needs_review, true)
})
T('Không có LLM → engine fallback không cờ', () => {
  const d = decideCriterion(critHigh, null, { score: 3 })
  assert.equal(d.source, 'engine')
  assert.equal(d.needs_review, false)
})

console.log('── computeProcessDebuggingScore ──')
T('Không telemetry → null (default trung lập)', () => {
  assert.equal(computeProcessDebuggingScore(null), null)
})
T('EQ cao + burst paste → điểm thấp; sạch → điểm cao', () => {
  assert.ok(computeProcessDebuggingScore({ eq_lite: 60, flags: ['burst_paste_dominant'] }) <= 1)
  assert.equal(computeProcessDebuggingScore({ eq_lite: 0, flags: [], submit_attempts: 1 }), 4)
})

console.log('── buildRubricBreakdown ──')
T('Đủ 8 tiêu chí (7 LLM + debugging_process), review_status auto khi mọi thứ ổn', () => {
  const r = buildRubricBreakdown({
    llmCriteria: [
      { id: 'naming', score: 4, confidence: 0.9 },
      { id: 'comments', score: 4, confidence: 0.9 },
      { id: 'structure_efficiency', score: 4, confidence: 0.85 },
      { id: 'idiomatic', score: 3, confidence: 0.8 },
      { id: 'decomposition', score: 3, confidence: 0.8 },
      { id: 'abstraction', score: 3, confidence: 0.75 },
      { id: 'pattern_reuse', score: 4, confidence: 0.7 },
    ],
    qualitySignals: { hasGoodNaming: true, meaningfulComments: true, extraFunctionCount: 1, isReasonableComplexity: true },
    processMetrics: { eq_lite: 5, flags: [], submit_attempts: 1 },
  })
  assert.equal(r.breakdown.length, 8)
  assert.equal(r.review_status, 'auto')
})
T('Một tiêu chí mâu thuẫn → needs_review toàn bài nộp', () => {
  const r = buildRubricBreakdown({
    llmCriteria: [{ id: 'naming', score: 5, confidence: 0.99 }],
    qualitySignals: { hasGoodNaming: false },   // proxy=2 vs LLM=5 → lệch 3
    processMetrics: null,
  })
  assert.equal(r.review_status, 'needs_review')
  const nb = r.breakdown.find(b => b.id === 'naming')
  assert.equal(nb.needs_review, true)
})
T('Thiếu tiêu chí LLM → tiêu chí đó dùng proxy engine, vẫn auto', () => {
  const r = buildRubricBreakdown({
    llmCriteria: [{ id: 'naming', score: 4, confidence: 0.9 }],
    qualitySignals: { hasGoodNaming: true },
    processMetrics: null,
  })
  const idi = r.breakdown.find(b => b.id === 'idiomatic')
  assert.equal(idi.source, 'engine')
  assert.equal(r.review_status, 'auto')
})

console.log('── Scale & totals ──')
T('scaleTier đúng tỉ lệ', () => {
  assert.equal(scaleTier(35, 35, 35), 35)   // full marks
  assert.equal(scaleTier(17.5, 35, 35), 18) // half → round
  assert.equal(scaleTier(10, 25, 25), 10)
})
T('recomputeTotals giữ nguyên logic ngưỡng 70/50', () => {
  assert.deepEqual(recomputeTotals(38, 30, 24), { total: 92, status: 'passed' })
  assert.deepEqual(recomputeTotals(20, 20, 8), { total: 48, status: 'failed' })
  assert.deepEqual(recomputeTotals(null, 30, 20), { total: null, status: 'ungraded' })
})

console.log('── applyTeacherReview ──')
T('GV sửa 1 tiêu chí → source teacher, reviewed, tính lại earned', () => {
  const r0 = buildRubricBreakdown({ llmCriteria: [], qualitySignals: {}, processMetrics: { eq_lite: 0, flags: [] } })
  const r1 = applyTeacherReview(r0.breakdown, { naming: 5 }, false)
  assert.equal(r1.review_status, 'reviewed')
  const nb = r1.breakdown.find(b => b.id === 'naming')
  assert.equal(nb.applied_score, 5)
  assert.equal(nb.source, 'teacher')
})
T('accept_llm=true áp điểm LLM cho các tiêu chí có điểm LLM', () => {
  const r0 = buildRubricBreakdown({
    llmCriteria: [{ id: 'idiomatic', score: 5, confidence: 0.9 }],
    qualitySignals: {}, processMetrics: null,
  })
  const r1 = applyTeacherReview(r0.breakdown, {}, true)
  const idi = r1.breakdown.find(b => b.id === 'idiomatic')
  assert.equal(idi.applied_score, 5)
  assert.equal(idi.source, 'teacher_llm_accept')
})
T('Bỏ qua key lạ trong scores', () => {
  const r0 = buildRubricBreakdown({ llmCriteria: [], qualitySignals: {}, processMetrics: null })
  const r1 = applyTeacherReview(r0.breakdown, { hacker_key: 5 }, false)
  assert.equal(r1.breakdown.length, 8)
})

console.log('── cohensKappa05 ──')
T('Đồng thuận hoàn hảo → κ = 1', () => {
  const pairs = [[4, 4], [3, 3], [5, 5], [2, 2]]
  const r = cohensKappa05(pairs)
  assert.equal(r.kappa, 1)
  assert.equal(r.exact_agreement, 1)
})
T('Ngẫu nhiên hoàn toàn → κ ≈ 0 hoặc âm', () => {
  const pairs = [[0, 5], [5, 0], [1, 4], [4, 1], [2, 3], [3, 2]]
  assert.ok(cohensKappa05(pairs).kappa <= 0.01)
})
T('Mẫu rỗng → null an toàn', () => {
  const r = cohensKappa05([])
  assert.equal(r.kappa, null)
  assert.equal(r.n, 0)
})
T('MAE tính đúng', () => {
  const r = cohensKappa05([[4, 3], [2, 2]])
  assert.equal(r.mae, 0.5)
})

console.log('── parseJudgeResponse ──')
T('Parse JSON thuần', () => {
  const c = parseJudgeResponse('{"criteria":[{"id":"naming","score":4,"confidence":0.9,"evidence":"ten tot"}]}')
  assert.equal(c.length, 1)
  assert.equal(c[0].score, 4)
})
T('Parse JSON trong code fence + text xung quanh', () => {
  const raw = 'Đây là kết quả:\n```json\n{"criteria":[{"id":"idiomatic","score":5,"confidence":0.7}]}\n```\nCảm ơn!'
  const c = parseJudgeResponse(raw)
  assert.equal(c[0].id, 'idiomatic')
})
T('Bỏ tiêu chí lạ / thiếu score; clamp score > 5 và confidence', () => {
  const c = parseJudgeResponse('{"criteria":[{"id":"hack","score":9},{"id":"naming","score":12,"confidence":5},{"id":"comments"}]}')
  assert.equal(c.length, 1)
  assert.equal(c[0].score, 5)
  assert.equal(c[0].confidence, 1)
})
T('Text rác → null', () => {
  assert.equal(parseJudgeResponse('xin chào'), null)
  assert.equal(parseJudgeResponse(''), null)
  assert.equal(parseJudgeResponse(null), null)
})

console.log(`\nKết quả: ${passed} pass · ${failed} fail`)
process.exit(failed ? 1 : 0)
