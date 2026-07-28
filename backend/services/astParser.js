/**
 * Lightweight C++ AST Parser & Big-O Complexity Estimator
 * Phân tích cấu trúc cú pháp thực tế của code C++:
 * - Cây phân cấp khối lệnh (Scopes & Block Depth)
 * - Khai báo hàm, tham số, câu lệnh return và danh sách lời gọi hàm (Call Graph)
 * - Khai báo mảng/vector và truy cập chỉ mục
 * - Đệ quy (Direct & Mutual recursion)
 * - Ước lượng độ phức tạp thời gian Big-O: O(1), O(N), O(N^2), O(N^3), O(log N)
 */

/**
 * Tokenize code C++ cơ bản
 */
export function tokenizeCpp(code) {
  if (!code) return []
  // Strip string literals & comments first to avoid fake tokens
  let clean = code.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""')
  clean = clean.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  const tokenRegex = /\b(int|double|float|char|string|bool|void|long|auto|for|while|do|if|else|switch|case|return|break|continue|struct|class|vector|include|using|namespace|cin|cout|std)\b|[a-zA-Z_]\w*|\d+(?:\.\d+)?|==|!=|<=|>=|&&|\|\||\+\+|--|->|<<|>>|[{}()\[\];,+\-*\/%=<>!&|]/g
  
  const tokens = []
  let match
  while ((match = tokenRegex.exec(clean)) !== null) {
    tokens.push({ text: match[0], index: match.index })
  }
  return tokens
}

/**
 * Phân tích AST của C++ source code
 */
export function parseCppAST(code) {
  if (!code || typeof code !== 'string') {
    return {
      functions: [],
      loops: [],
      conditionals: [],
      arrays: [],
      maxNestDepth: 0,
      estimatedBigO: 'O(1)',
      hasRecursion: false,
      hasMain: false,
      callGraph: {}
    }
  }

  // Strip strings and comments
  let cleanCode = code.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""')
  cleanCode = cleanCode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  const lines = cleanCode.split('\n')
  const functions = []
  const loops = []
  const conditionals = []
  const arrays = []

  // Track function definitions: e.g. void sapXep(int a[], int n) { ... }
  const funcRegex = /\b(void|int|double|float|bool|string|long long|long)\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/g
  let fMatch
  while ((fMatch = funcRegex.exec(cleanCode)) !== null) {
    const returnType = fMatch[1]
    const name = fMatch[2]
    const params = fMatch[3].trim()
    const startIndex = fMatch.index

    // Extract body using brace matching
    let depth = 0, bodyEnd = startIndex
    let foundStart = false
    for (let i = startIndex; i < cleanCode.length; i++) {
      if (cleanCode[i] === '{') { depth++; foundStart = true }
      else if (cleanCode[i] === '}') {
        depth--
        if (foundStart && depth === 0) { bodyEnd = i; break }
      }
    }
    const body = cleanCode.substring(startIndex, bodyEnd + 1)
    functions.push({ name, returnType, params, body, startIndex, bodyEnd })
  }

  // Track call graph & recursion
  const callGraph = {}
  let hasRecursion = false
  functions.forEach(fn => {
    callGraph[fn.name] = []
    functions.forEach(otherFn => {
      const callRegex = new RegExp(`\\b${otherFn.name}\\s*\\(`, 'g')
      const matches = fn.body.match(callRegex) || []
      if (matches.length > 0) {
        callGraph[fn.name].push(otherFn.name)
        if (fn.name === otherFn.name && fn.name !== 'main') {
          hasRecursion = true
        }
      }
    })
  })

  // Track loop nesting depth accurately using line-by-line block stack
  let currentDepth = 0
  let maxLoopNestDepth = 0
  let currentLoopDepth = 0

  const loopStartRegex = /\b(for|while)\s*\(/
  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim()
    if (loopStartRegex.test(trimmed)) {
      currentLoopDepth++
      loops.push({ lineIndex: lineIdx, depth: currentLoopDepth, text: trimmed })
      if (currentLoopDepth > maxLoopNestDepth) {
        maxLoopNestDepth = currentLoopDepth
      }
    }
    for (const char of trimmed) {
      if (char === '{') currentDepth++
      else if (char === '}') {
        currentDepth = Math.max(0, currentDepth - 1)
        if (currentLoopDepth > currentDepth) {
          currentLoopDepth = currentDepth
        }
      }
    }
  })

  // Detect Array / Vector declarations & indexing
  const arrayDeclRegex = /\b(int|double|float|char|string)\s+([a-zA-Z_]\w*)\s*\[\s*(\d+|\w+)\s*\]/g
  let aMatch
  while ((aMatch = arrayDeclRegex.exec(cleanCode)) !== null) {
    arrays.push({ name: aMatch[2], type: aMatch[1], size: aMatch[3], isVector: false })
  }
  const vectorDeclRegex = /\b(?:std::)?vector\s*<\s*([^>]+)\s*>\s+([a-zA-Z_]\w*)/g
  let vMatch
  while ((vMatch = vectorDeclRegex.exec(cleanCode)) !== null) {
    arrays.push({ name: vMatch[2], type: vMatch[1], size: 'dynamic', isVector: true })
  }

  // Estimate Big-O Time Complexity based on nesting and patterns
  let estimatedBigO = 'O(1)'
  if (hasRecursion) {
    const recursiveFn = functions.find(f => f.name !== 'main' && callGraph[f.name]?.includes(f.name))
    if (recursiveFn) {
      const callsCount = (recursiveFn.body.match(new RegExp(`\\b${recursiveFn.name}\\s*\\(`, 'g')) || []).length
      if (callsCount >= 2) estimatedBigO = 'O(2^N)'
      else if (recursiveFn.body.includes('/ 2') || recursiveFn.body.includes('/2')) estimatedBigO = 'O(log N)'
      else estimatedBigO = 'O(N)'
    } else {
      estimatedBigO = 'O(N)'
    }
  } else if (maxLoopNestDepth >= 3) {
    estimatedBigO = 'O(N^3)'
  } else if (maxLoopNestDepth === 2) {
    estimatedBigO = 'O(N^2)'
  } else if (maxLoopNestDepth === 1) {
    const hasLogStep = /\/=\s*2|\*=\s*2|>>=\s*1/.test(cleanCode)
    estimatedBigO = hasLogStep ? 'O(log N)' : 'O(N)'
  }

  const hasMain = functions.some(f => f.name === 'main')

  return {
    functions,
    loops,
    arrays,
    maxNestDepth: maxLoopNestDepth,
    estimatedBigO,
    hasRecursion,
    hasMain,
    callGraph
  }
}
