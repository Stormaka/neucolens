/**
 * Dynamic LLM Analysis Service — Storm v4
 * Rule-based scoring (deterministic) + Gemini Flash / DeepSeek feedback (qualitative)
 * Không cho điểm ảo — code rác phải nhận điểm thấp
 */
import { execSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import https from 'https'
import crypto from 'crypto'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { parseCppAST } from './astParser.js'


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

// ── DeepSeek client (OpenAI-compatible API) ───────────────────────────────────
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_AVAILABLE = DEEPSEEK_KEY && DEEPSEEK_KEY.length > 10
if (DEEPSEEK_AVAILABLE) {
  console.log('🧠 DeepSeek LLM: ACTIVE (fallback provider)')
} else {
  console.log('⚠️  DeepSeek: No API key configured')
}

/**
 * Gọi DeepSeek Chat API (OpenAI-compatible)
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<string|null>}
 */
async function callDeepSeek(systemPrompt, userPrompt) {
  if (!DEEPSEEK_AVAILABLE) return null
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 600,
      temperature: 0.7
    })
    const options = {
      hostname: 'api.deepseek.com',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          const text = parsed?.choices?.[0]?.message?.content?.trim()
          resolve(text || null)
        } catch { resolve(null) }
      })
    })
    req.on('error', () => resolve(null))
    req.setTimeout(15000, () => { req.destroy(); resolve(null) })
    req.write(body)
    req.end()
  })
}

/**
 * Tạo nội dung prompt phân tích code chung
 */
function buildCodeAnalysisPrompt(code, assignment, ruleResult) {
  const { total, t1, t2, t3, misconceptions } = ruleResult
  return `Bạn là trợ giảng môn Lập trình C++ tại NEU (Đại học Kinh tế Quốc dân). 
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
}

/**
 * Gọi Gemini (ưu tiên) hoặc DeepSeek (fallback) để tạo feedback
 * @param {string} code
 * @param {object} assignment
 * @param {object} ruleResult - {total, t1, t2, t3, misconceptions}
 * @returns {Promise<string>} feedback text
 */
async function getAIFeedback(code, assignment, ruleResult) {
  const prompt = buildCodeAnalysisPrompt(code, assignment, ruleResult)

  // Ưu tiên Gemini
  if (geminiModel) {
    try {
      const result = await geminiModel.generateContent(prompt)
      const text = result.response.text().trim()
      if (text) return { text: text.substring(0, 800), provider: 'gemini' }
    } catch (e) {
      console.log('⚠️  Gemini feedback error:', e.message, '→ trying DeepSeek fallback')
    }
  }

  // Fallback: DeepSeek
  if (DEEPSEEK_AVAILABLE) {
    try {
      const text = await callDeepSeek(
        'Bạn là trợ giảng lập trình C++ tại Đại học Kinh tế Quốc dân (NEU). Luôn trả lời bằng tiếng Việt ngắn gọn, rõ ràng.',
        prompt
      )
      if (text) return { text: text.substring(0, 800), provider: 'deepseek' }
    } catch (e) {
      console.log('⚠️  DeepSeek feedback error:', e.message)
    }
  }

  return null
}

/**
 * Chạy code C++ với test case thực — trả về % test pass
 * @param {string} code - Source code C++
 * @param {Array} testCases - [{input: string, expected: string}]
 * @returns {{ passCount: number, totalCount: number, errors: string[] }}
 */
async function runCppTestCases(code, testCases) {
  if (!testCases || testCases.length === 0) return { passCount: 0, totalCount: 0, errors: [] }
  const localRunnerAllowed = process.env.ENABLE_LOCAL_RUNNER === 'true' || process.env.NODE_ENV !== 'production'
  if (!localRunnerAllowed) {
    return { passCount: 0, totalCount: 0, errors: ['Trình chạy mã native đang tắt trong production; cần môi trường sandbox chuyên dụng.'] }
  }

  // 4.4 Guard: Chặn code nguy hiểm trước khi compile/chạy khi không có full sandbox
  const dangerousPatterns = [
    /\bsystem\s*\(/i,
    /\bpopen\s*\(/i,
    /\bfork\s*\(/i,
    /\bexec[vlp]?\s*\(/i,
    /\bRemoveDirectory\b/i,
    /\bDeleteFile\b/i,
    /#include\s*<windows\.h>/i,
    /#include\s*<sys\/socket\.h>/i,
    /#include\s*<winsock2\.h>/i
  ]
  const cleanedForScan = cleanCodeForAnalysis(code)
  if (dangerousPatterns.some(pat => pat.test(cleanedForScan))) {
    return {
      passCount: 0,
      totalCount: testCases.length,
      errors: ['🔴 AN NINH: Mã nguồn chứa lệnh hệ thống bị cấm (system, popen, fork, socket...).']
    }
  }

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
  const randomSuffix = crypto.randomBytes(4).toString('hex')
  const srcFile = path.join(tmpDir, `neu_code_${Date.now()}_${randomSuffix}.cpp`)
  const exeFile = path.join(tmpDir, `neu_code_${Date.now()}_${randomSuffix}.exe`)

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

        // 4.8 Fix: floating-point tolerance (±0.001)
        const numActual = parseFloat(actual), numExpected = parseFloat(expected)
        const isClose = !isNaN(numActual) && !isNaN(numExpected) && Math.abs(numActual - numExpected) < 0.001
        if (actual === expected || isClose) {
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

/**
 * Helper: Strip comments and string literals to prevent fake keyword matches
 */
function cleanCodeForAnalysis(code) {
  if (!code) return ''
  let cleaned = code.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""')
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')
  cleaned = cleaned.replace(/\/\/[^\n]*/g, '')
  return cleaned
}

// ── Tính điểm concept thực chất (AST & Context-Aware) ───────────────────────
function scoreConcept(concept, rawCode, cachedAst = null) {
  const ast = cachedAst || parseCppAST(rawCode)
  const cleanedCode = cleanCodeForAnalysis(rawCode)

  // Nested Loops: Dựa trên AST maxNestDepth thực sự (loại bỏ lặp nối tiếp)
  if (concept === 'Nested Loops') {
    if (ast.maxNestDepth >= 2) return 100
    if (ast.maxNestDepth === 1) return 30  // chỉ lồng 1 tầng hoặc nối tiếp
    return 0
  }

  // Recursion: Dựa trên AST callGraph & direct/mutual recursion
  if (concept === 'Recursion') {
    return ast.hasRecursion ? 100 : 0
  }

  // Functions: Phải khai báo hàm riêng biệt ngoài main() trong AST
  if (concept === 'Functions') {
    const nonMainFuncs = ast.functions.filter(f => f.name !== 'main')
    if (nonMainFuncs.length >= 2) return 100
    if (nonMainFuncs.length === 1) return 85
    return 0
  }

  // Arrays: Khai báo mảng/vector trong AST
  if (concept === 'Arrays') {
    if (ast.arrays.length >= 1) return 100
    const hasIndexAccess = /\w+\s*\[\s*\w+\s*\]/.test(cleanedCode)
    return hasIndexAccess ? 60 : 0
  }

  // Loops: Có ít nhất 1 loop trong AST
  if (concept === 'Loops') {
    if (ast.loops.length >= 2) return 100
    if (ast.loops.length === 1) return 80
    return 0
  }


  // Arrays: chỉ tính nếu khai báo mảng thực sự và truy cập chỉ mục
  if (concept === 'Arrays') {
    const hasArrayDecl = /\b(int|double|float|char|string)\s+\w+\s*\[\d+\]/.test(cleanedCode)
    const hasVectorDecl = /\b(?:std::)?vector\s*<[^>]+>\s+\w+/.test(cleanedCode)
    const hasIndexAccess = /\w+\s*\[\s*\w+\s*\]/.test(cleanedCode)
    const hasRangeIteration = /for\s*\([^:]+:\s*\w+\s*\)/.test(cleanedCode)
    if ((hasArrayDecl || hasVectorDecl) && (hasIndexAccess || hasRangeIteration)) return 100
    if (hasArrayDecl || hasVectorDecl || hasIndexAccess) return 60
    return 0
  }

  // Variables: phải khai báo biến thực sự có sử dụng
  if (concept === 'Variables') {
    const decls = [...cleanedCode.matchAll(/\b(int|double|float|char|string|bool|long)\s+([a-zA-Z_]\w*)/g)]
    const validDecls = decls.filter(m => m[2] !== 'main')
    if (validDecls.length >= 2) return 100
    if (validDecls.length === 1) return 60
    return 0
  }

  // Sorting: phải có swap pattern thực sự hoặc std::sort
  if (concept === 'Sorting Algorithm') {
    const hasLibrarySort = /\b(?:std::)?sort\s*\(/.test(cleanedCode)
    if (hasLibrarySort) return 100
    const hasTemp = /\b(int|double|float|char)\s+t\s*=|\btemp\s*=|\bswap\s*\(/.test(cleanedCode)
    const hasLoop = /for\s*\(/.test(cleanedCode)
    const hasNestedLoop = (cleanedCode.match(/for\s*\(/g) || []).length >= 2
    if (hasNestedLoop && hasTemp) return 100
    if (hasTemp && hasLoop) return 70
    if (hasTemp) return 40
    return 0
  }

  // Conditionals: phải có if/else với body chứa câu lệnh thực sự (chống lách if(){} else{})
  if (concept === 'Conditionals') {
    const ifBlocks = [...cleanedCode.matchAll(/\bif\s*\(([^)]+)\)\s*\{([^}]*)\}/g)]
    const activeIfs = ifBlocks.filter(m => {
      const cond = m[1].trim()
      const body = m[2].trim()
      if (['true', '1', '0', 'false'].includes(cond)) return false
      return body.length > 0 && body !== ';'
    })
    const hasElse = /\belse\b/.test(cleanedCode)
    const hasElseIf = /else\s+if\s*\(/.test(cleanedCode)

    if (hasElseIf && activeIfs.length > 0) return 100
    if (hasElse && activeIfs.length > 0) return 85
    if (activeIfs.length > 0) return 50
    return 0
  }

  // Functions: phải có định nghĩa hàm thực sự có thân lệnh hoặc tham số (chống void a(){} void b(){})
  if (concept === 'Functions') {
    const funcDefs = [...cleanedCode.matchAll(/\b(void|int|double|float|bool|string)\s+(\w+)\s*\(([^)]*)\)\s*\{([^}]*)\}/g)]
    const nonMain = funcDefs.filter(m => m[2] !== 'main')
    
    if (!nonMain.length) return 0

    const activeFuncs = nonMain.filter(m => {
      const name = m[2]
      const params = m[3].trim()
      const body = m[4].trim()
      if (!body && !params) return false // Hàm rỗng không tham số -> rác
      const callMatches = (cleanedCode.match(new RegExp(`\\b${name}\\s*\\(`, 'g')) || []).length
      return callMatches >= 2 || body.includes('return') || params.length > 0
    })

    if (activeFuncs.length >= 2) return 100
    if (activeFuncs.length === 1) return 80
    return 0
  }

  // I/O: cin >> var VÀ cout << expr
  if (concept === 'I/O') {
    const hasCin = /\bcin\s*>>\s*[a-zA-Z_]\w*/.test(cleanedCode)
    const hasCout = /\bcout\s*<</.test(cleanedCode)
    const hasPrompt = /cout\s*<<\s*""/.test(cleanedCode) || /cout\s*<<\s*"[^"]*"/.test(rawCode)
    if (hasCin && hasCout && hasPrompt) return 100
    if (hasCin && hasCout) return 80
    if (hasCin || hasCout) return 40
    return 0
  }

  // Loops: phải có vòng lặp với body thực sự (chống for(;;){})
  if (concept === 'Loops') {
    const forMatches = [...cleanedCode.matchAll(/\bfor\s*\([^)]*\)\s*\{([^}]*)\}/g)]
    const whileMatches = [...cleanedCode.matchAll(/\bwhile\s*\([^)]*\)\s*\{([^}]*)\}/g)]
    const hasActiveFor = forMatches.some(m => m[1].trim().length > 0)
    const hasActiveWhile = whileMatches.some(m => m[1].trim().length > 0)

    if (hasActiveFor && hasActiveWhile) return 100
    if (hasActiveFor || hasActiveWhile) return 80
    return 0
  }

  // Generic Concept Keyword Matching: quét trên cleanedCode (đã strip comment & string)
  const keywords = CONCEPT_KEYWORDS[concept] || [concept.toLowerCase()]
  if (keywords.length === 0) return 0

  let hits = 0
  keywords.forEach(kw => {
    if (cleanedCode.toLowerCase().includes(kw.toLowerCase())) hits++
  })

  const ratio = hits / keywords.length
  if (ratio === 0) return 0
  if (ratio <= 0.25) return 20
  if (ratio <= 0.5) return 50
  if (ratio <= 0.75) return 75
  return 100
}

// ── Main analysis function ────────────────────────────────────────────────────
export async function analyzeCode(code, assignment, studentName = '') {
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

  // 4.5 Fix: phan biet ro NO_TEST_CASES vs RUNNER_DISABLED vs COMPILE_FAILED
  let testResult = { passCount: 0, totalCount: 0, errors: [] }
  let runnerStatus = 'NO_TEST_CASES'
  const testCases = (() => {
    try { return JSON.parse(assignment.test_cases_json || '[]') } catch { return [] }
  })()

  if (lang === 'C++' && testCases.length > 0 && !hasInfiniteLoop) {
    const localRunnerAllowed = process.env.ENABLE_LOCAL_RUNNER === 'true' || process.env.NODE_ENV !== 'production'
    if (!localRunnerAllowed) {
      runnerStatus = 'RUNNER_DISABLED'
    } else {
      testResult = await runCppTestCases(code, testCases)
      if (testResult.errors.some(e => e.includes('compile') || e.includes('Compile'))) {
        runnerStatus = 'COMPILE_FAILED'
      } else if (testResult.errors.some(e => e.includes('Timeout'))) {
        runnerStatus = 'RUNNER_TIMEOUT'
      } else {
        runnerStatus = 'SUCCESS'
      }
    }
  }

  // ── Bước 4: Tính T1 — Functional Correctness (Execution 100%) ─────────────
  // Khắc phục double-counting: T1 thuần túy đo tính đúng đắn khi thực thi test cases
  let t1 = 0
  if (runnerStatus === 'SUCCESS' && testResult.totalCount > 0) {
    const testPassRate = testResult.passCount / testResult.totalCount
    t1 = Math.round(maxT1 * testPassRate)
  } else if (runnerStatus === 'RUNNER_DISABLED' && testCases.length > 0) {
    // Trình chạy bị tắt trên serverless: tính 50% baseline cho việc hoàn thành bài
    t1 = Math.round(maxT1 * 0.50)
  } else if (runnerStatus === 'COMPILE_FAILED') {
    t1 = 0  // Lỗi biên dịch -> 0 điểm đúng đắn
  } else {
    // Không có test cases: Đánh giá bằng cấu trúc thực thi C++ tối thiểu
    const ast = parseCppAST(code)
    const hasSyntax = ast.hasMain || ast.functions.length > 0
    t1 = hasSyntax ? Math.round(maxT1 * 0.8) : 0
  }

  if (hasInfiniteLoop) {
    t1 = Math.round(t1 * 0.2)
    misconceptions.push('Vòng lặp vô hạn — while loop thiếu lệnh cập nhật biến')
  } else if (hasOffByOne) {
    t1 = Math.round(t1 * 0.7)
    misconceptions.push('Off-by-one error — dùng i<=n thay vì i<n khi duyệt mảng C++')
  } else if (hasMultipleIf) {
    t1 = Math.round(t1 * 0.75)
    misconceptions.push('Nhiều if độc lập thay vì if-else chain')
  }

  // ── Bước 5: Tính T2 — Code Quality (4.3 Fix) ───────────────────────────
  const hasComments = /\/\/[^\n]+|\/\*[\s\S]*?\*\//.test(code)
  const hasGoodNaming = checkGoodNaming(code)

  const meaningfulComments = (() => {
    const coms = code.match(/\/\/[^\n]{5,}/g) || []
    return coms.filter(c => !/^\/\/\s*(int|double|float|cout|cin|\d+)\b/.test(c)).length > 0
  })()

  const ast = parseCppAST(code)
  const hasExtraFunctions = ast.functions.filter(f => f.name !== 'main').length > 0

  const branchCount = (code.match(/\b(if|else if|for|while|case)\b/g) || []).length
  const isReasonableComplexity = branchCount >= 1 && branchCount <= 20

  let t2Quality = 0
  if (meaningfulComments) t2Quality += 35
  if (hasGoodNaming)      t2Quality += 40
  if (hasExtraFunctions)  t2Quality += 15
  if (isReasonableComplexity) t2Quality += 10

  const t2 = Math.round(maxT2 * t2Quality / 100)

  // ── Bước 6: Tính T3 — Computational Thinking & AST Big-O Complexity ──────
  // T3 tập trung 100% vào Tư duy lập trình, Khái niệm & Độ phức tạp thuật toán (Big-O)
  let t3 = 0
  if (concepts.length > 0) {
    const covered = concepts.filter(c => (concept_scores[c] || 0) >= 60).length
    const partial = concepts.filter(c => (concept_scores[c] || 0) >= 30 && (concept_scores[c] || 0) < 60).length
    const conceptRatio = (covered + partial * 0.5) / concepts.length

    // T3 = 70% Concept Mastery + 30% Algorithmic Efficiency (Big-O)
    let bigOBonus = 1.0
    if (['O(N^3)', 'O(2^N)'].includes(ast.estimatedBigO)) bigOBonus = 0.6  // phạt thuật toán chậm
    else if (['O(1)', 'O(log N)', 'O(N)'].includes(ast.estimatedBigO)) bigOBonus = 1.0

    t3 = Math.round(maxT3 * (conceptRatio * 0.70 + bigOBonus * 0.30))
  } else {
    t3 = ast.hasMain ? Math.round(maxT3 * 0.7) : Math.round(maxT3 * 0.3)
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
    hasComments, hasGoodNaming, meaningfulComments, hasExtraFunctions,
    conceptCoverageScore, lang, testResult, runnerStatus
  })

  // ── Storm v4: AI feedback (Gemini → DeepSeek fallback) ───────────────────
  let llm_feedback = ruleFeedback
  const aiFb = await getAIFeedback(code, { ...assignment, concepts }, { total, t1, t2, t3, misconceptions })
  if (aiFb) {
    const providerLabel = aiFb.provider === 'deepseek' ? '🧠 Nhận xét từ DeepSeek AI' : '💬 Nhận xét từ Gemini AI'
    llm_feedback = ruleFeedback + `\n\n${providerLabel}:\n` + aiFb.text
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

export async function generateChatReply({ question, assignment, submission }) {
  const code = submission?.code || ''
  const feedback = submission?.llm_feedback || ''

  const systemMsg = 'Ban la tro giang lap trinh NEU. Tra loi tieng Viet, ngan gon, khong cho dap an khi sinh vien xin.'
  const userMsg = [
    'Bai tap: ' + assignment.title,
    'Mo ta: ' + (assignment.description || ''),
    'Khai niem: ' + (assignment.concepts || []).join(', '),
    'Code gan nhat:\n' + (code.substring(0, 4000) || '(chua nop)'),
    'Ket qua cham: ' + (submission ? (submission.score_total + '/100; ' + feedback.substring(0, 400)) : '(chua co)'),
    'Cau hoi: ' + question.substring(0, 2000)
  ].join('\n')

  // Priority 1: Gemini
  if (geminiModel) {
    try {
      const result = await geminiModel.generateContent(systemMsg + '\n\n' + userMsg)
      return { content: result.response.text().trim().substring(0, 4000), provider: 'gemini', model: 'gemini-1.5-flash' }
    } catch (e) { console.log('Gemini chat error:', e.message, '=> DeepSeek fallback') }
  }

  // Priority 2: DeepSeek
  if (DEEPSEEK_AVAILABLE) {
    try {
      const text = await callDeepSeek(systemMsg, userMsg)
      if (text) return { content: text.substring(0, 4000), provider: 'deepseek', model: 'deepseek-chat' }
    } catch (e) { console.log('DeepSeek chat error:', e.message) }
  }

  // Fallback
  const scoreLine = submission ? ('Score: ' + submission.score_total + '/100.') : 'No submission.'
  return { content: 'AI not configured. ' + scoreLine, provider: 'rule_based', model: null }
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
    concepts, concept_scores, hasComments, hasGoodNaming, meaningfulComments, hasExtraFunctions,
    conceptCoverageScore, lang, testResult = {}, runnerStatus = 'NO_TEST_CASES' }) {
  const parts = []
  const { passCount = 0, totalCount = 0, errors: tcErrors = [] } = testResult

  // ── Storm v4: Test Case Results ────────────────────────────────
  // 4.5: Hien thi runner status ro rang
  if (runnerStatus === 'RUNNER_DISABLED' && totalCount === 0) {
    parts.push('⚠️ Runner bi tat tren production. T1 tinh theo concept coverage (co giam).Giao vien: bat ENABLE_LOCAL_RUNNER=true.')
  } else if (runnerStatus === 'COMPILE_FAILED') {
    parts.push('❌ COMPILE ERROR: Code khong bien dich duoc. T1 = 5%. Kiem tra cu phap C++.')
  }

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

  if (isAI) {
    parts.push(`🚨 CẢNH BÁO AI: Code sử dụng kỹ thuật nâng cao chưa học (${Math.round(aiResult.confidence * 100)}% confidence). Giảng viên sẽ xem xét.`)
  }

  return parts.join('\n\n')
}

// ── Detection helpers ─────────────────────────────────────────────────────────

// ── Detection helpers (Fixed False Positives) ───────────────────────────

function detectInfiniteLoop(code) {
  const cleaned = cleanCodeForAnalysis(code)

  // 1. Check while loops without increment/update
  const whileBlocks = [...cleaned.matchAll(/\bwhile\s*\([^)]+\)\s*\{([^}]*)\}/g)]
  for (const match of whileBlocks) {
    const body = match[1]
    if (!/\+\+|--|[\+\-\*\/]=|\bbreak\b|\breturn\b/.test(body)) return true
  }

  // 2. Check for(;;) or infinite for loops without update
  const infiniteFor = /\bfor\s*\(\s*;\s*;\s*\)/.test(cleaned) || /\bfor\s*\([^;]*;\s*[^;]*;\s*\)\s*\{([^}]*)\}/.test(cleaned)
  if (infiniteFor) {
    const forBlocks = [...cleaned.matchAll(/\bfor\s*\([^;]*;\s*([^;]*);\s*\)\s*\{([^}]*)\}/g)]
    for (const match of forBlocks) {
      const cond = match[1].trim()
      const body = match[2]
      if (cond && !/\+\+|--|[\+\-\*\/]=|\bbreak\b|\breturn\b/.test(body)) return true
    }
  }

  return false
}

function detectOffByOne(code, concepts = []) {
  const arrConcepts = ['Arrays', 'Linear Search', 'Sorting Algorithm']
  const safeConcepts = concepts || []
  if (!safeConcepts.some(c => arrConcepts.includes(c))) return false

  const cleaned = cleanCodeForAnalysis(code)
  const hasZeroStartLoop = /for\s*\(\s*int\s+(\w+)\s*=\s*0\s*;\s*\1\s*<=\s*(\w+)\s*;/.test(cleaned)
  const hasArrayIndexWithLoopVar = /\w+\s*\[\s*[a-zA-Z_]\w*\s*\]/.test(cleaned)

  return hasZeroStartLoop && hasArrayIndexWithLoopVar
}

function detectMultipleIfChain(code, concepts = []) {
  const safeConcepts = concepts || []
  if (!safeConcepts.includes('Conditionals')) return false

  const cleaned = cleanCodeForAnalysis(code)
  const lines = cleaned.split('\n').filter(l => /^\s*if\s*\(/.test(l))
  
  if (lines.length >= 3 && !cleaned.includes('else if')) {
    const varsTested = lines.map(l => l.match(/if\s*\(\s*([a-zA-Z_]\w*)/)?.[1]).filter(Boolean)
    const uniqueVars = new Set(varsTested)
    if (uniqueVars.size === 1) return true
  }

  return false
}

function detectAIGenerated(code, concepts, lang) {
  const signals = []
  let confidence = 0.05
  const cleaned = cleanCodeForAnalysis(code)

  if (lang === 'C++') {
    // Only flag std::vector or lambda if NOT part of assignment concepts (e.g. Week 15 explicitly uses vector & sort)
    const conceptsIncludeVectorOrSort = concepts.some(c => ['Arrays', 'Sorting Algorithm', 'OOP'].includes(c))

    if (!conceptsIncludeVectorOrSort && /std::vector|vector</.test(cleaned)) {
      signals.push('std::vector (chưa học)')
      confidence += 0.25
    }
    if (/\[.*\]\s*\(/.test(cleaned)) {
      signals.push('Lambda')
      confidence += 0.25
    }
    if (!conceptsIncludeVectorOrSort && /\bauto\b/.test(cleaned)) {
      signals.push('auto keyword')
      confidence += 0.15
    }
    if (/l\s*\+\s*\(r\s*-\s*l\)/.test(cleaned)) {
      signals.push('Binary search tối ưu')
      confidence += 0.25
    }
  }

  const academicComments = (code.match(/\/\/.*(?:O\(|Time complexity|Space O\(|Algorithm:)/gi) || []).length
  if (academicComments >= 2) { signals.push('Academic comments'); confidence += 0.15 }

  confidence = Math.min(confidence, 0.98)
  return { flag: confidence > 0.70, confidence, reason: signals.join('; ') }
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
