/**
 * Plagiarism detection — token Jaccard + winnowing-lite
 * MVP for Phase 4B: phát hiện copy/paste giữa SV trong cùng assignment.
 * Không cần Moss, dùng normalize + k-gram Jaccard (k=5) — đủ cho C++ intro.
 */

export function normalizeCode(code = '', lang = 'C++') {
  let s = String(code)
  // Remove C/C++ comments //... and /* ... */
  s = s.replace(/\/\/.*$/gm, '')
  s = s.replace(/\/\*[\s\S]*?\*\//g, '')
  // Remove #include, #define lines (boilerplate)
  s = s.replace(/^\s*#.*$/gm, '')
  // Collapse whitespace, lower-case for comparison (keep case for strings? simple)
  s = s.replace(/\s+/g, ' ').trim().toLowerCase()
  // Remove punctuation that doesn't affect logic? keep; but normalize
  return s
}

export function tokenize(normalized) {
  // Split on non-alphanumeric _ (keep numbers)
  return normalized.split(/[^a-z0-9_]+/).filter(Boolean)
}

export function kGrams(tokens, k = 5) {
  if (tokens.length < k) return new Set([tokens.join(' ')])
  const set = new Set()
  for (let i = 0; i <= tokens.length - k; i++) {
    set.add(tokens.slice(i, i + k).join(' '))
  }
  return set
}

export function jaccard(setA, setB) {
  if (!setA.size && !setB.size) return 1
  let inter = 0
  for (const x of setA) if (setB.has(x)) inter++
  const uni = setA.size + setB.size - inter
  return uni === 0 ? 0 : inter / uni
}

/**
 * Detect plagiarism among submissions of one assignment.
 * @param {Array<{id:number, student_id:number, student_name:string, code:string}>} subs
 * @param {number} threshold 0..1
 * @returns {Array<{a_id:number,b_id:number,a_student:number,b_student:number,a_name:string,b_name:string,similarity:number,shared:number}>}
 */
export function detectPlagiarism(subs, threshold = 0.8) {
  if (!Array.isArray(subs) || subs.length < 2) return []
  // Precompute k-gram sets
  const pre = subs.map(s => {
    const norm = normalizeCode(s.code || '', s.lang)
    const toks = tokenize(norm)
    return { ...s, grams: kGrams(toks, 5), len: toks.length }
  }).filter(x => x.len >= 5) // bỏ code quá ngắn

  const pairs = []
  for (let i = 0; i < pre.length; i++) {
    for (let j = i + 1; j < pre.length; j++) {
      const a = pre[i], b = pre[j]
      // Quick length filter: nếu chênh > 50% thì skip
      const maxLen = Math.max(a.len, b.len)
      const minLen = Math.min(a.len, b.len)
      if (minLen / maxLen < 0.5) continue
      const sim = jaccard(a.grams, b.grams)
      if (sim >= threshold) {
        const inter = [...a.grams].filter(x => b.grams.has(x)).length
        pairs.push({
          a_id: a.id, b_id: b.id,
          a_student: a.student_id, b_student: b.student_id,
          a_name: a.student_name, b_name: b.student_name,
          similarity: Math.round(sim * 1000) / 1000,
          shared: inter,
          a_len: a.len, b_len: b.len,
        })
      }
    }
  }
  pairs.sort((x, y) => y.similarity - x.similarity)
  return pairs
}

/**
 * AI-suspicion v2: kết hợp tín hiệu cũ + plagiarism + process
 * Trả về {flag, confidence, reasons[]}
 */
export function enhancedAiSuspicion({ code, aiSuspicion, processMetrics, isPlagiarized }) {
  let flag = !!aiSuspicion?.flag
  let conf = aiSuspicion?.confidence || 0
  const reasons = aiSuspicion?.reasons ? [...aiSuspicion.reasons] : []
  if (aiSuspicion?.reason) reasons.push(aiSuspicion.reason)

  if (isPlagiarized) {
    flag = true
    conf = Math.max(conf, 0.85)
    reasons.push('Trùng khớp cao với bạn cùng lớp (plagiarism ≥0.8)')
  }
  const pm = processMetrics || {}
  // Process signals from Phase 1: paste_ratio cao + focus ít + eq thấp
  if (pm.paste_char_ratio && pm.paste_char_ratio > 0.6) {
    flag = true
    conf = Math.max(conf, 0.7)
    reasons.push(`paste_ratio=${pm.paste_char_ratio.toFixed(2)}`)
  }
  if (pm.process_risk && pm.process_risk > 0.7) {
    conf = Math.max(conf, 0.65)
    reasons.push(`process_risk=${pm.process_risk}`)
  }
  return { flag, confidence: Math.round(conf * 100) / 100, reasons: reasons.slice(0, 4) }
}
