// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — LLM-as-a-Judge: chấm rubric định tính, bắt buộc trả JSON.
// Gemini Flash (temperature 0, JSON mode) → DeepSeek fallback (temperature 0).
// LLM KHÔNG quyết T1 (độ đúng đắn) — T1 thuộc về test runner (nguyên tắc RTSF).
// ─────────────────────────────────────────────────────────────────────────────
import https from 'https'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { QUALITATIVE_CRITERIA, computeEngineProxies } from './rubric.js'

const GEMINI_KEY = process.env.GEMINI_API_KEY || ''
let geminiJudgeModel = null
try {
  if (GEMINI_KEY.length > 10) {
    const genAI = new GoogleGenerativeAI(GEMINI_KEY)
    geminiJudgeModel = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: 1200 },
    })
  }
} catch { /* im lặng — judge là tính năng tăng cường */ }

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_AVAILABLE = DEEPSEEK_KEY.length > 10

function callDeepSeekJson(systemPrompt, userPrompt) {
  if (!DEEPSEEK_AVAILABLE) return Promise.resolve(null)
  return new Promise(resolve => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1200,
      temperature: 0,
      response_format: { type: 'json_object' },
    })
    const req = https.request({
      hostname: 'api.deepseek.com', path: '/chat/completions', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        try { resolve(JSON.parse(data)?.choices?.[0]?.message?.content?.trim() || null) }
        catch { resolve(null) }
      })
    })
    req.on('error', () => resolve(null))
    req.setTimeout(25_000, () => { req.destroy(); resolve(null) })
    req.write(body)
    req.end()
  })
}

// ── Parse & validate phản hồi JSON của judge (pure — unit-test được) ─────────
export function parseJudgeResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') return null
  let text = rawText.trim()
  // Bỏ code fence ```json ... ```
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  // Cắt từ dấu { đầu tiên đến } cuối cùng (chống LLM nói chuyện dài dòng)
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  let parsed
  try { parsed = JSON.parse(text.slice(start, end + 1)) } catch { return null }

  const arr = Array.isArray(parsed?.criteria) ? parsed.criteria : Array.isArray(parsed) ? parsed : null
  if (!arr) return null

  const knownIds = new Set(QUALITATIVE_CRITERIA.map(c => c.id))
  const criteria = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const id = String(item.id || '')
    if (!knownIds.has(id)) continue
    const score = Number(item.score)
    if (!Number.isFinite(score)) continue
    criteria.push({
      id,
      score: Math.max(0, Math.min(5, Math.round(score))),
      confidence: Math.max(0, Math.min(1, Number.isFinite(Number(item.confidence)) ? Number(item.confidence) : 0.5)),
      evidence: String(item.evidence || item.justification || '').slice(0, 240),
    })
  }
  return criteria.length ? criteria : null
}

/** Prompt chấm rubric — rubric-grounded + CoT ngắn + yêu cầu evidence */
export function buildJudgePrompt({ code, assignmentTitle, assignmentDesc, lang, concepts, qualitySignals }) {
  const criteriaBlock = QUALITATIVE_CRITERIA.map(c =>
    `- id="${c.id}" (${c.name_vi}, thang 0-5): ${ANCHORS[c.id] || ''}`).join('\n')
  const qs = qualitySignals || {}
  return {
    system: `Ban la giam khao cham doan ma nguon sinh vien theo rubric. CHI tra ve JSON hop le, khong viet gi khac. Diem tung tieu chi theo thang nguyen 0-5 (0=khong dat, 1=rat yeu, 2=yeu, 3=trung binh, 4=tot, 5=xuat sac). confidence la so 0..1 the hien ban chac chan den dau ve diem minh. evidence: bang chung cu the trong code (<=200 ky tu, tieng Viet).`,
    user: `BAI TAP: ${assignmentTitle}
MO TA: ${assignmentDesc || '(khong co)'}
NGON NGU: ${lang || 'C++'} | KHAI NIEM: ${(concepts || []).join(', ') || '(khong ro)'}

BO TIEU CHI CAN CHAM:
${criteriaBlock}

NGU CANH TU MAY CHAM DONG (tham khao, khong copy lai):
- BigO uoc luong: ${qs.estimatedBigO || '?'} | So ham phu: ${qs.extraFunctionCount ?? '?'}
- Co comment y nghia: ${qs.meaningfulComments ? 'co' : 'khong'} | Dat ten tot: ${qs.hasGoodNaming ? 'co' : 'khong'}
- Test pass: ${qs.testPassCount ?? '?'}/${qs.testTotalCount ?? '?'} | Trang thai runner: ${qs.runnerStatus || '?'}

CODE SINH VIEN:
\`\`\`${(lang || 'cpp').toLowerCase()}
${String(code).substring(0, 6000)}
\`\`\`

Tra ve dung dinh dang:
{"criteria":[{"id":"naming","score":3,"confidence":0.8,"evidence":"..."},{"id":"comments",...}]}
Gom DU 7 tieu chi: naming, comments, structure_efficiency, idiomatic, decomposition, abstraction, pattern_reuse.`,
  }
}

const ANCHORS = {
  naming: '5=ten mo ta ro vai tro, dat theo convention; 3=hau het ten hieu duoc; 1=ten 1 chu cai loan lan.',
  comments: '5=comment giai thich y dinh nhung cho logic phuc tap; 3=vai comment don le; 0-1=khong co.',
  structure_efficiency: '5=DRY, to chuc ro rang, do phuc tap thich hop; 3=co the refactor; 1=lap lai nhieu, lon xon.',
  idiomatic: '5=dung thu thuat dac trung ngon ngu (STL, range-for...); 1=viet kieu C thuần/old-school.',
  decomposition: '5=cac ham nho moi ham mot nhiem vu, tai su dung duoc; 1=toan bo trong main().',
  abstraction: '5=tong quat, dung parameters/constants, khong hard-code; 1=hard-code gan het.',
  pattern_reuse: '5=nhan ra pattern, goi ham/built-in thay vi copy-paste; 1=copy-paste la chinh.',
}

/**
 * Điều phối chính: gọi Gemini → DeepSeek, trả về criteria đã validate hoặc null.
 * @returns null khi không cấu hình key / lỗi / parse thất bại (caller fallback engine-only)
 */
export async function judgeSubmission(context) {
  const { system, user } = buildJudgePrompt(context)

  if (geminiJudgeModel) {
    try {
      const result = await geminiJudgeModel.generateContent(user)
      const parsed = parseJudgeResponse(result?.response?.text?.())
      if (parsed) return { provider: 'gemini', model: 'gemini-1.5-flash', criteria: parsed }
    } catch (e) {
      console.error('⚠️ Judge Gemini error:', e.message)
    }
  }
  if (DEEPSEEK_AVAILABLE) {
    const text = await callDeepSeekJson(system, user)
    const parsed = parseJudgeResponse(text)
    if (parsed) return { provider: 'deepseek', model: 'deepseek-chat', criteria: parsed }
  }
  return null
}

/** Proxy engine đi kèm context (tiện cho caller) */
export function proxiesForContext(qualitySignals) {
  return computeEngineProxies(qualitySignals)
}
