/**
 * Dynamic LLM Analysis Service — Storm v4
 * Rule-based scoring (deterministic) + Gemini Flash feedback (qualitative)
 * Không cho điểm ảo — code rác phải nhận điểm thấp
 */
import { execSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ── Gemini Flash client ────────────────────────────────────────────────────────
const GEMINI_KEY = process.env.GEMINI_API_KEY || ''
let geminiModel = null
try {
  if (GEMINI_KEY && GEMINI_KEY.length > 10) {
    const genAI = new GoogleGenerativeAI(GEMINI_KEY)
    geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    console.log('🤖 Gemini Flash LLM: ACTIVE')
  } else {
    console.log('⚠️  Gemini: No API key — using rule-based feedback only')
  }
} catch (e) { console.log('⚠️  Gemini init failed:', e.message) }

/**
 * Gọi Gemini để tạo feedback chi tiết bằng tiếng Việt
 * @param {string} code
 * @param {object} assignment
 * @param {object} ruleResult - {total, t1, t2, t3, misconceptions}
 * @returns {Promise<string>} feedback text
 */
async function getGeminiFeedback(code, assignment, ruleResult) {
  if (!geminiModel) return null
  try {
    const { total, t1, t2, t3, misconceptions } = ruleResult
    const prompt = `Bạn là trợ giảng môn Lập trình C++ tại NEU (Đại học Kinh tế Quốc dân). 
Phân tích bài nộp của sinh viên và đưa ra nhận xét bằng tiếng Việt.

BÀI TẬP: ${assignment.title}
MÔ TẢ: ${assignment.description || ''}
KHÁI NIỆM CẦN KIỂM TRA: ${(assignment.concepts || []).join(', ')}

CODE SINH VIÊN:
\`\`\`cpp
${code.substring(0, 1500)}
\`\`\`

KẾT QUẢ CHẤM TỰ ĐỘNG:
- Tổng điểm: ${total}/100
- T1 (Độ đúng đắn): ${t1}/${assignment.weight_t1 || 40}
- T2 (Chất lượng code): ${t2}/${assignment.weight_t2 || 35}  
- T3 (Tư duy lập trình): ${t3}/${assignment.weight_t3 || 25}
${misconceptions.length > 0 ? `- Lỗi phát hiện: ${misconceptions.join('; ')}` : ''}

Viết nhận xét ngắn gọn (3-5 câu) bằng tiếng Việt:
1. Điểm mạnh của code
2. Lỗi/điểm cần cải thiện cụ thể
3. Gợi ý sửa nếu có lỗi
KHÔNG giải thích lại điểm số. Trả lời trực tiếp, không dùng markdown headers.`

    const result = await geminiModel.generateContent(prompt)
    const text = result.response.text().trim()
    return text.substring(0, 800) // giới hạn độ dài
  } catch (e) {
    console.log('⚠️  Gemini feedback error:', e.message)
    return null
  }
}

/**
 * Chạy code C++ với test case thực — trả về % test pass
 * @param {string} code - Source code C++
 * @param {Array} testCases - [{input: string, expected: string}]
 * @returns {{ passCount: number, totalCount: number, errors: string[] }}
 */
async function runCppTestCases(code, testCases) {
  if (!testCases || testCases.length === 0) return { passCount: 0, totalCount: 0, errors: [] }

  // Tìm g++ — thử PATH thường trước, sau đó MSYS2 ucrt64
  const GPP_PATHS = [
    'g++',
    'C:\\msys64\\ucrt64\\bin\\g++.exe',
    'C:\\msys64\\mingw64\\bin\\g++.exe',
    'C:\\mingw64\\bin\\g++.exe',
    'C:\\Program Files\\mingw-w64\\bin\\g++.exe',
  ]

  let GPP_CMD = null
  for (const gpp of GPP_PATHS) {
    try {
      execSync(`"${gpp}" --version`, { timeout: 3000, stdio: 'pipe' })
      GPP_CMD = gpp
      break
    } catch { }
  }

  if (!GPP_CMD) {
    return { passCount: 0, totalCount: 0, errors: ['g++ không khả dụng — cài MinGW hoặc MSYS2'] }
  }

  const tmpDir = os.tmpdir()
  const srcFile = path.join(tmpDir, `neu_code_${Date.now()}.cpp`)
  const exeFile = path.join(tmpDir, `neu_code_${Date.now()}.exe`)

  let passCount = 0
  const errors = []

  try {
    // Ghi source file
    fs.writeFileSync(srcFile, code, 'utf8')

    // Compile với GPP_CMD tìm được
    const compileResult = spawnSync(GPP_CMD, [srcFile, '-o', exeFile, '-O0', '-w'], {
      timeout: 10000, encoding: 'utf8',
      env: { ...process.env, PATH: `C:\\msys64\\ucrt64\\bin;${process.env.PATH}` }
    })

    if (compileResult.status !== 0) {
      errors.push(`Lỗi compile: ${(compileResult.stderr || '').substring(0, 200)}`)
      return { passCount: 0, totalCount: testCases.length, errors }
    }

    // Chạy từng test case
    for (const tc of testCases) {
      try {
        const runResult = spawnSync(exeFile, [], {
          input: tc.input || '',
          timeout: 2000,
          encoding: 'utf8',
        })

        if (runResult.status === null) {
          errors.push(`Test "${tc.input?.substring(0, 20)}": Timeout`)
          continue
        }

        const actual = (runResult.stdout || '').trim().replace(/\r/g, '')
        const expected = (tc.expected || '').trim()

        if (actual === expected) {
          passCount++
        } else {
          errors.push(`Test "${tc.input?.substring(0, 20)}": got "${actual}", expected "${expected}"`)
        }
      } catch {
        errors.push(`Test crash`)
      }
    }
  } catch (e) {
    errors.push(`Runtime error: ${e.message}`)
  } finally {
    // Cleanup
    try { fs.unlinkSync(srcFile) } catch { }
    try { fs.unlinkSync(exeFile) } catch { }
  }

  return { passCount, totalCount: testCases.length, errors }
}

// ── Concept keyword library ───────────────────────────────────────────────────
const CONCEPT_KEYWORDS = {
  'Variables': ['int ', 'double ', 'float ', 'string ', 'char ', 'bool ', 'long '],
  'I/O': ['cin', 'cout', 'printf', 'scanf', 'input(', 'print(', 'console.log'],
  'Arithmetic': ['+', '-', '*', '/', '%', 'pow(', 'sqrt(', 'abs('],
  'Conditionals': ['if(', 'if (', 'else if', 'else {', 'switch(', 'switch (', 'elif ', 'else:'],
  'Boolean Logic': ['&&', '||', '!', 'and ', 'or ', 'not ', '==', '!=', '<=', '>='],
  'Loops': ['for(', 'for (', 'while(', 'while (', 'do {', 'for ', 'while '],
  'Nested Loops': ['for', 'while'],
  'Pattern Printing': ['cout', 'print(', 'endl'],
  'Arrays': ['int a[', 'double a[', 'float a[', 'array', 'vector<', '[]'],
  'Linear Search': ['found', 'search', 'indexOf'],
  'Functions': ['void ', 'return ', 'def ', 'function ', 'fn '],
  'Recursion': [],   // special detection
  'Base Case': ['n == 0', 'n == 1', 'n <= 0', 'n <= 1', 'i == 0'],
  'Sorting Algorithm': ['swap', 'int t =', 'int temp =', 'temp =', 't = a'],
  'Pointers': ['ptr', 'pointer', 'malloc', 'free'],
  'Memory': ['malloc', 'free', 'new ', 'delete'],
  'OOP': ['class ', 'new '],
  'String Manipulation': ['substring', 'split', 'trim', 'replace', 'strlen', 'string'],
}

// ── Kiểm tra code có phải C++ hợp lệ tối thiểu không ─────────────────────────
function isValidCppCode(code) {
  const trim = code.trim()
  if (!trim || trim.length < 10) return false

  // Phải có ít nhất một trong: main(), #include, khai báo biến, hàm
  const hasMain = /int\s+main\s*\(/.test(code)
  const hasInclude = /#include/.test(code)
  const hasVarDecl = /\b(int|double|float|char|string|bool|long)\s+\w+/.test(code)
  const hasFuncDecl = /\b(void|int|double|float|bool|string)\s+\w+\s*\(/.test(code)
  const hasKeyword = /\b(if|for|while|return|cout|cin)\b/.test(code)

  // Code hợp lệ = có ít nhất 2 dấu hiệu
  const signals = [hasMain, hasInclude, hasVarDecl, hasFuncDecl, hasKeyword].filter(Boolean).length
  return signals >= 2
}

// ── Phát hiện code là random text / không phải code ──────────────────────────
function detectGarbageCode(code, lang) {
  const trim = code.trim()
  if (!trim) return { isGarbage: true, reason: 'Code trống' }

  // Quá ngắn
  if (trim.length < 20) return { isGarbage: true, reason: 'Code quá ngắn (< 20 ký tự)' }

  // Toàn ký tự đặc biệt lặp lại
  const alphanumRatio = (trim.match(/[a-zA-Z0-9_]/g) || []).length / trim.length
  if (alphanumRatio < 0.3) return { isGarbage: true, reason: 'Code không chứa đủ chữ/số (có thể là ký tự ngẫu nhiên)' }

  // Không có keyword lập trình nào cả
  const progKeywords = ['if', 'for', 'while', 'int', 'return', 'void', 'cout', 'cin',
    'include', 'main', 'double', 'float', 'string', 'bool', 'char',
    'print', 'def', 'class', 'function', 'var', 'let', 'const']
  const hasAnyKeyword = progKeywords.some(kw => new RegExp(`\\b${kw}\\b`).test(code))
  if (!hasAnyKeyword) return { isGarbage: true, reason: 'Không có từ khoá lập trình nào' }

  // Với C++: phải có ít nhất 1 dấu hiệu
  if (lang === 'C++' && !isValidCppCode(code)) {
    return { isGarbage: true, reason: 'Code C++ không có cấu trúc hợp lệ' }
  }

  return { isGarbage: false, reason: '' }
}

// ── Tính điểm concept thực chất ───────────────────────────────────────────────
function scoreConcept(concept, code) {
  // Nested Loops: phải có >= 2 vòng lặp thực sự
  if (concept === 'Nested Loops') {
    const forCount = (code.match(/for\s*\(/g) || []).length
    const whileCount = (code.match(/while\s*\(/g) || []).length
    const total = forCount + whileCount
    if (total >= 2) return 100
    if (total === 1) return 30
    return 0
  }

  // Recursion: hàm phải gọi lại chính mình
  if (concept === 'Recursion') {
    const fnDefs = [...code.matchAll(/\b(\w{3,})\s*\([^)]*\)\s*\{/g)]
    const fnNames = fnDefs.map(m => m[1]).filter(n => !['main', 'while', 'for', 'if'].includes(n))
    const hasRecursion = fnNames.some(fn => {
      const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const matches = (code.match(new RegExp(`\\b${escaped}\\s*\\(`, 'g')) || []).length
      return matches >= 2 // khai báo + gọi lại
    })
    return hasRecursion ? 100 : 0
  }

  // Arrays: chỉ tính nếu khai báo mảng thực sự
  if (concept === 'Arrays') {
    const hasArrayDecl = /\b(int|double|float|char|string)\s+\w+\s*\[\d*\]/.test(code)
    const hasIndexAccess = /\w+\s*\[\s*\w+\s*\]/.test(code)
    if (hasArrayDecl && hasIndexAccess) return 100
    if (hasArrayDecl || hasIndexAccess) return 60
    return 0
  }

  // Variables: phải có khai báo rõ ràng
  if (concept === 'Variables') {
    const declCount = (code.match(/\b(int|double|float|char|string|bool|long)\s+\w+/g) || []).length
    if (declCount >= 2) return 100
    if (declCount === 1) return 60
    return 0
  }

  // Sorting: phải có swap pattern (biến tạm + gán)
  if (concept === 'Sorting Algorithm') {
    const hasTemp = /\b(int|double|float|char)\s+t\s*=|\btemp\s*=|\bswap\s*\(/.test(code)
    const hasLoop = /for\s*\(/.test(code)
    const hasNestedLoop = (code.match(/for\s*\(/g) || []).length >= 2
    if (hasNestedLoop && hasTemp) return 100
    if (hasTemp && hasLoop) return 70
    if (hasTemp) return 40
    return 0
  }

  // Conditionals: phải có if/else thực sự
  if (concept === 'Conditionals') {
    const hasIf = /\bif\s*\(/.test(code)
    const hasElse = /\belse\b/.test(code)
    const hasElseIf = /else\s+if\s*\(/.test(code)
    if (hasElseIf) return 100
    if (hasIf && hasElse) return 85
    if (hasIf) return 50
    return 0
  }

  // Functions: phải có định nghĩa hàm ngoài main
  if (concept === 'Functions') {
    const funcDefs = [...code.matchAll(/\b(void|int|double|float|bool|string)\s+(\w+)\s*\([^)]*\)\s*\{/g)]
    const nonMain = funcDefs.filter(m => m[2] !== 'main')
    if (nonMain.length >= 2) return 100
    if (nonMain.length === 1) return 80
    if (funcDefs.length >= 1) return 30
    return 0
  }

  // I/O: cin + cout cả 2
  if (concept === 'I/O') {
    const hasCin = /\bcin\s*>>/.test(code)
    const hasCout = /\bcout\s*<</.test(code)
    const hasPrompt = /cout\s*<<\s*"/.test(code)
    if (hasCin && hasCout && hasPrompt) return 100
    if (hasCin && hasCout) return 80
    if (hasCin || hasCout) return 40
    return 0
  }

  // Loops: phải có vòng lặp thực sự với body
  if (concept === 'Loops') {
    const hasFor = /for\s*\([^)]+\)\s*\{/.test(code) || /for\s*\([^)]+\)\s*\w+/.test(code)
    const hasWhile = /while\s*\([^)]+\)\s*\{/.test(code)
    if (hasFor && hasWhile) return 100
    if (hasFor || hasWhile) return 80
    return 0
  }

  // Generic: keyword matching nhưng nghiêm ngặt hơn
  const keywords = CONCEPT_KEYWORDS[concept] || [concept.toLowerCase()]
  if (keywords.length === 0) return 0

  let hits = 0
  keywords.forEach(kw => {
    if (code.toLowerCase().includes(kw.toLowerCase())) hits++
  })

  // KHÔNG có điểm cơ bản — phải match thực sự
  const ratio = hits / keywords.length
  if (ratio === 0) return 0
  if (ratio <= 0.25) return 20
  if (ratio <= 0.5) return 50
  if (ratio <= 0.75) return 75
  return 100
}

// ── Main analysis function ────────────────────────────────────────────────────
export async function analyzeCode(code, assignment, studentName = '') {
  await new Promise(r => setTimeout(r, 800 + Math.random() * 600))

  const concepts = assignment.concepts || []
  const lang = assignment.lang || 'C++'
  const maxT1 = assignment.weight_t1 || 40
  const maxT2 = assignment.weight_t2 || 35
  const maxT3 = assignment.weight_t3 || 25

  // ── Bước 1: Kiểm tra code trống ─────────────────────────────────────────
  if (!code || !code.trim()) {
    return {
      score_total: 0, score_t1: 0, score_t2: 0, score_t3: 0,
      status: 'failed',
      llm_feedback: '❌ Chưa nộp code hoặc code trống.',
      ai_suspicion_flag: 0, ai_suspicion_confidence: 0, ai_suspicion_reason: '',
      misconceptions_json: '["Chưa nộp code"]',
      misconceptions: [],
      concept_scores: {}
    }
  }

  // ── Bước 2: Phát hiện code rác / không hợp lệ ───────────────────────────
  const garbage = detectGarbageCode(code, lang)
  if (garbage.isGarbage) {
    return {
      score_total: 0, score_t1: 0, score_t2: 0, score_t3: 0,
      status: 'failed',
      llm_feedback: `❌ Code không hợp lệ: ${garbage.reason}\n\nVui lòng nộp code ${lang} đúng cú pháp. Code phải có ít nhất: khai báo biến, vòng lặp/điều kiện, hoặc hàm main().`,
      ai_suspicion_flag: 0, ai_suspicion_confidence: 0, ai_suspicion_reason: '',
      misconceptions_json: '["Nộp code không hợp lệ hoặc không phải code lập trình"]',
      misconceptions: ['Nộp code không hợp lệ hoặc không phải code lập trình'],
      concept_scores: {}
    }
  }

  // ── Bước 3: Phát hiện lỗi logic cụ thể ─────────────────────────────────
  const hasInfiniteLoop = detectInfiniteLoop(code)
  const hasOffByOne = detectOffByOne(code, concepts)
  const hasMultipleIf = detectMultipleIfChain(code)
  const aiResult = detectAIGenerated(code, concepts, lang)
  const misconceptions = []

  // ── Bước 4: Tính T1 — Correctness ───────────────────────────────────────
  // Dựa trên concept coverage THỰC SỰ
  let conceptCoverageScore = 0
  const concept_scores = {}

  if (concepts.length > 0) {
    concepts.forEach(c => {
      concept_scores[c] = scoreConcept(c, code)
    })
    const totalConceptScore = concepts.reduce((sum, c) => sum + (concept_scores[c] || 0), 0)
    conceptCoverageScore = Math.round(totalConceptScore / concepts.length) // 0-100
  } else {
    // Không có concept → chấm dựa trên cấu trúc code
    const hasMain = /int\s+main/.test(code)
    const hasLogic = /if|for|while/.test(code)
    const hasIO = /cin|cout/.test(code)
    conceptCoverageScore = [hasMain, hasLogic, hasIO].filter(Boolean).length * 33
  }

  // ── Storm v4: Chạy Test Cases thực (nếu có) ─────────────────────────────
  let testResult = { passCount: 0, totalCount: 0, errors: [] }
  const testCases = (() => {
    try { return JSON.parse(assignment.test_cases_json || '[]') } catch { return [] }
  })()

  if (lang === 'C++' && testCases.length > 0 && !hasInfiniteLoop) {
    testResult = await runCppTestCases(code, testCases)
  }

  // T1 = kết hợp test case (50%) + concept coverage (50%)
  // Nếu không có test case → dùng 100% concept coverage
  let t1ConceptPart = Math.round(maxT1 * conceptCoverageScore / 100)
  let t1TestPart = 0
  let t1

  if (testResult.totalCount > 0) {
    const testPassRate = testResult.passCount / testResult.totalCount
    t1TestPart = Math.round((maxT1 * 0.5) * testPassRate)
    t1ConceptPart = Math.round((maxT1 * 0.5) * conceptCoverageScore / 100)
    t1 = t1TestPart + t1ConceptPart
  } else {
    t1 = t1ConceptPart
  }

  if (hasInfiniteLoop) {
    t1 = Math.round(t1 * 0.2)  // phạt nặng
    misconceptions.push('Vòng lặp vô hạn — while loop thiếu lệnh cập nhật biến')
  } else if (hasOffByOne) {
    t1 = Math.round(t1 * 0.7)
    misconceptions.push('Off-by-one error — dùng i<=n thay vì i<n khi duyệt mảng C++')
  } else if (hasMultipleIf) {
    t1 = Math.round(t1 * 0.75)
    misconceptions.push('Nhiều if độc lập thay vì if-else chain')
  }

  // ── Bước 5: Tính T2 — Code Quality ──────────────────────────────────────
  const hasComments = /\/\/[^\n]+|\/\*[\s\S]*?\*\//.test(code)
  const hasGoodNaming = checkGoodNaming(code)
  const hasPrompt = /cout\s*<<\s*"[^"]+".*cin/.test(code) || /cout\s*<<\s*"[^"]+"/.test(code)
  const hasReturn0 = /return\s+0\s*;/.test(code)
  const lineCount = code.split('\n').filter(l => l.trim()).length

  let t2Quality = 0
  if (hasComments) t2Quality += 30
  if (hasGoodNaming) t2Quality += 30
  if (hasPrompt) t2Quality += 20
  if (hasReturn0) t2Quality += 10
  if (lineCount >= 8) t2Quality += 10  // đủ dài

  let t2 = Math.round(maxT2 * t2Quality / 100)
  if (aiResult.flag && aiResult.confidence > 0.7) t2 = Math.round(t2 * 0.8)

  // ── Bước 6: Tính T3 — Computational Thinking ─────────────────────────────
  // Dựa trên concept scores thực
  let t3 = 0
  if (concepts.length > 0) {
    const covered = concepts.filter(c => (concept_scores[c] || 0) >= 60).length
    const partial = concepts.filter(c => (concept_scores[c] || 0) >= 30 && (concept_scores[c] || 0) < 60).length
    t3 = Math.round(maxT3 * (covered + partial * 0.5) / concepts.length)
  } else {
    // No concepts: check general logic
    const hasAlgorithm = /for.*for|while.*if|recursion/.test(code)
    t3 = hasAlgorithm ? Math.round(maxT3 * 0.8) : Math.round(maxT3 * 0.4)
  }
  if (hasInfiniteLoop) t3 = Math.round(t3 * 0.3)

  // ── Bước 7: Tổng điểm ────────────────────────────────────────────────────
  const total = Math.min(100, Math.max(0, t1 + t2 + t3))
  const status = total >= 70 ? 'passed' : total >= 50 ? 'warning' : 'failed'

  const ruleFeedback = buildFeedback({
    code, status, total, t1, t2, t3, maxT1, maxT2, maxT3,
    hasInfiniteLoop, hasOffByOne, hasMultipleIf,
    isAI: aiResult.flag && aiResult.confidence > 0.7,
    aiResult, concepts, concept_scores,
    hasComments, hasGoodNaming, hasPrompt, conceptCoverageScore, lang,
    testResult
  })

  // ── Storm v4: Gemini Flash feedback (bổ sung qualitative analysis) ─────────
  let llm_feedback = ruleFeedback
  const geminiFb = await getGeminiFeedback(code, { ...assignment, concepts }, { total, t1, t2, t3, misconceptions })
  if (geminiFb) {
    llm_feedback = ruleFeedback + '\n\n💬 Nhận xét từ AI:\n' + geminiFb
  }

  return {
    score_total: total, score_t1: t1, score_t2: t2, score_t3: t3,
    status, llm_feedback,
    ai_suspicion_flag: aiResult.flag ? 1 : 0,
    ai_suspicion_confidence: aiResult.confidence,
    ai_suspicion_reason: aiResult.reason,
    misconceptions_json: JSON.stringify(misconceptions),
    misconceptions,
    concept_scores
  }
}

function checkGoodNaming(code) {
  // Có biến tên có nghĩa (>=4 ký tự, không chỉ là i/j/n/x)
  const vars = [...code.matchAll(/\b(?:int|double|float|char|string|bool)\s+([a-zA-Z_]\w*)/g)]
    .map(m => m[1])
    .filter(n => !['main', 'i', 'j', 'k', 'n', 'm', 't', 'x', 'y', 'a', 'b', 'c'].includes(n))
  return vars.length >= 1
}

function buildFeedback({ code, status, total, t1, t2, t3, maxT1, maxT2, maxT3,
    hasInfiniteLoop, hasOffByOne, hasMultipleIf, isAI, aiResult,
    concepts, concept_scores, hasComments, hasGoodNaming, hasPrompt,
    conceptCoverageScore, lang, testResult = {} }) {
  const parts = []
  const { passCount = 0, totalCount = 0, errors: tcErrors = [] } = testResult

  // ── Storm v4: Test Case Results ────────────────────────────────
  if (totalCount > 0) {
    const allPass = passCount === totalCount
    const icon = allPass ? '✅' : passCount > 0 ? '⚠️' : '❌'
    parts.push(`${icon} Test Cases: ${passCount}/${totalCount} tử nghiệm pass`)
    if (!allPass && tcErrors.length > 0) {
      tcErrors.slice(0, 3).forEach(e => parts.push(`  └ ${e}`))
    }
  }

  // Status header
  if (hasInfiniteLoop) {
    parts.push(`🔴 LỖI NGHIÊM TRỌNG: Vòng lặp while thiếu lệnh cập nhật biến điều kiện → chương trình chạy vô hạn.`)
  } else if (hasOffByOne) {
    parts.push(`⚠️ LỖI OFF-BY-ONE: Vòng lặp dùng i <= n thay vì i < n khi duyệt mảng (C++ chỉ mục 0 đến n-1).`)
  } else if (hasMultipleIf) {
    parts.push(`⚠️ LỖI TƯ DUY: Dùng nhiều if độc lập thay vì if-else if chain → in nhiều kết quả cùng lúc.`)
  } else if (total >= 80) {
    parts.push(`✅ Bài làm tốt (${total}/100)! Code đúng cấu trúc và áp dụng đúng khái niệm.`)
  } else if (total >= 60) {
    parts.push(`⚠️ Bài cần cải thiện (${total}/100). Kiểm tra lại phần áp dụng các khái niệm.`)
  } else {
    parts.push(`❌ Bài chưa đạt (${total}/100). Code thiếu nhiều khái niệm yêu cầu.`)
  }

  // Concept breakdown
  if (concepts.length > 0) {
    const missing = concepts.filter(c => (concept_scores[c] || 0) < 30)
    const weak = concepts.filter(c => (concept_scores[c] || 0) >= 30 && (concept_scores[c] || 0) < 60)
    const strong = concepts.filter(c => (concept_scores[c] || 0) >= 80)

    if (missing.length > 0) parts.push(`❌ Chưa áp dụng: ${missing.join(', ')}`)
    if (weak.length > 0) parts.push(`📌 Cần củng cố thêm: ${weak.join(', ')}`)
    if (strong.length > 0) parts.push(`⭐ Nắm vững: ${strong.join(', ')}`)
  }

  // Quality feedback
  if (!hasComments && code.split('\n').length > 8) {
    parts.push(`💡 Thêm comment // giải thích các bước quan trọng để tăng điểm T2.`)
  }
  if (!hasGoodNaming) {
    parts.push(`💡 Đặt tên biến có nghĩa hơn (VD: soLuong, banKinh, ketQua thay vì biến 1 ký tự).`)
  }
  if (!hasPrompt) {
    parts.push(`💡 Thêm thông báo trước mỗi lệnh cin (VD: cout << "Nhap n: "; cin >> n;).`)
  }

  if (isAI) {
    parts.push(`🚨 CẢNH BÁO AI: Code sử dụng kỹ thuật nâng cao chưa học (${Math.round(aiResult.confidence * 100)}% confidence). Giảng viên sẽ xem xét.`)
  }

  return parts.join('\n\n')
}

// ── Detection helpers ─────────────────────────────────────────────────────────

function detectInfiniteLoop(code) {
  // Tìm while blocks thực sự (có ngoặc)
  const whileBlocks = code.match(/while\s*\([^)]+\)\s*\{([^}]*)\}/gs) || []
  for (const block of whileBlocks) {
    const body = block.replace(/while\s*\([^)]+\)\s*\{/, '').replace(/\}$/, '')
    if (!/\+\+|--|[\+\-\*\/]=/. test(body)) return true
  }
  return false
}

function detectOffByOne(code, concepts) {
  const arrConcepts = ['Arrays', 'Linear Search', 'Sorting Algorithm', 'Nested Loops']
  if (!concepts.some(c => arrConcepts.includes(c))) return false
  return /for\s*\([^)]*;\s*\w+\s*<=\s*n\s*;/.test(code)
}

function detectMultipleIfChain(code) {
  const lines = code.split('\n').filter(l => /^\s*if\s*\(/.test(l))
  return lines.length >= 3 && !code.includes('else if')
}

function detectAIGenerated(code, concepts, lang) {
  const signals = []
  let confidence = 0.05

  if (lang === 'C++') {
    if (/std::vector|vector</.test(code)) { signals.push('std::vector (chưa học)'); confidence += 0.35 }
    if (/\[.*\]\s*\(/.test(code)) { signals.push('Lambda'); confidence += 0.3 }
    if (/\bauto\b/.test(code)) { signals.push('auto keyword'); confidence += 0.2 }
    if (/l\s*\+\s*\(r\s*-\s*l\)/.test(code)) { signals.push('Binary search tối ưu'); confidence += 0.3 }
  }

  const academicComments = (code.match(/\/\/.*(?:O\(|Time complexity|Space O\(|Algorithm:)/gi) || []).length
  if (academicComments >= 2) { signals.push('Academic comments'); confidence += 0.15 }

  // Code quá hoàn hảo so với level sinh viên
  if (code.split('\n').filter(l => l.trim().startsWith('//')).length >= 5) {
    signals.push('Quá nhiều comment học thuật'); confidence += 0.1
  }

  confidence = Math.min(confidence, 0.98)
  return { flag: confidence > 0.65, confidence, reason: signals.join('; ') }
}

/**
 * Update student profile after new submission
 */
export function updateStudentProfile(db, studentId, classroomId, concepts, conceptScores = {}) {
  // ── Storm v4: EWMA (Exponential Weighted Moving Average, α=0.3) ────────────
  const ALPHA = 0.3  // trọng số submission mới nhất

  const subs = db.prepare(`
    SELECT s.score_total, s.status, a.concepts_json, s.submitted_at
    FROM submissions s JOIN assignments a ON s.assignment_id=a.id
    WHERE s.student_id=? AND a.classroom_id=? AND s.status != 'pending' AND s.score_total > 0
    ORDER BY s.submitted_at ASC
  `).all(studentId, classroomId)

  if (!subs.length) return

  // EWMA mastery theo từng concept: S_t = α*x_t + (1-α)*S_{t-1}
  const ewma = {}  // current EWMA per concept

  subs.forEach(sub => {
    const concs = JSON.parse(sub.concepts_json || '[]')
    concs.forEach(c => {
      if (ewma[c] === undefined) ewma[c] = sub.score_total  // khởi tạo
      else ewma[c] = ALPHA * sub.score_total + (1 - ALPHA) * ewma[c]  // EWMA update
    })
  })

  // Merge với concept_scores mới nhất (EWMA update một bước)
  Object.entries(conceptScores).forEach(([c, s]) => {
    if (typeof s !== 'number') return
    if (ewma[c] === undefined) ewma[c] = s
    else ewma[c] = ALPHA * s + (1 - ALPHA) * ewma[c]
  })

  const mastery_json = {}
  Object.keys(ewma).forEach(c => { mastery_json[c] = Math.round(Math.max(0, Math.min(100, ewma[c]))) })

  // ── Overall average ────────────────────────────────────────────────────────
  const overallAvg = Math.round(subs.reduce((a, b) => a + b.score_total, 0) / subs.length)

  // ── Trend: so sánh nửa đầu vs nửa cuối ───────────────────────────────────
  const half = Math.ceil(subs.length / 2)
  const firstAvg = subs.slice(0, half).reduce((a, b) => a + b.score_total, 0) / Math.max(1, half)
  const lastAvg  = subs.slice(-half).reduce((a, b) => a + b.score_total, 0) / Math.max(1, half)
  const trend = lastAvg > firstAvg + 5 ? 'improving' : lastAvg < firstAvg - 5 ? 'declining' : 'stable'

  // ── Risk score (0-1) — dựa trên điểm thấp và xu hướng sa sút ─────────────
  let riskScore = 0
  if (overallAvg < 40) riskScore = 0.95
  else if (overallAvg < 55) riskScore = 0.75 + (55 - overallAvg) / 80
  else if (overallAvg < 70) riskScore = 0.3 + (70 - overallAvg) / 60
  else riskScore = 0.05
  if (trend === 'declining') riskScore = Math.min(0.95, riskScore + 0.15)
  riskScore = Math.round(riskScore * 100) / 100

  // ── Profile type ──────────────────────────────────────────────────────────
  const aiFlags = db.prepare(`
    SELECT COUNT(*) as c FROM submissions s JOIN assignments a ON s.assignment_id=a.id
    WHERE s.student_id=? AND a.classroom_id=? AND s.ai_suspicion_flag=1
  `).get(studentId, classroomId).c

  let profileType = 'on-track'
  if (aiFlags >= 2) profileType = 'ai-warning'
  else if (overallAvg >= 85 && trend !== 'declining') profileType = 'advanced'
  else if (riskScore >= 0.7) profileType = 'at-risk'

  db.prepare(`INSERT OR REPLACE INTO student_profiles
    (student_id,classroom_id,mastery_json,overall_score,profile_type,risk_score,trend,updated_at)
    VALUES (?,?,?,?,?,?,?,datetime('now'))`).run(
    studentId, classroomId, JSON.stringify(mastery_json), overallAvg, profileType, riskScore, trend
  )
}
