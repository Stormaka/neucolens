/**
 * Lightweight C++ AST Parser & Big-O Complexity Estimator — Fixed
 * Features:
 * - Accurate Function Body Extraction (excluding declaration signature header)
 * - Scope Stack Tracking for braced and single-statement sequential loops
 * - Call Graph & Direct/Mutual Recursion Analysis
 * - Accurate Big-O Time Complexity estimation
 */

export function tokenizeCpp(code) {
  if (!code) return []
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

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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

  // Strip string literals & comments
  let cleanCode = code.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""')
  cleanCode = cleanCode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  const functions = []
  const loops = []
  const arrays = []

  // 1. Extract Function Definitions & strictly isolate bodyOnly (after '{')
  const funcRegex = /\b(void|int|double|float|bool|string|long long|long)\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/g
  let fMatch
  while ((fMatch = funcRegex.exec(cleanCode)) !== null) {
    const returnType = fMatch[1]
    const name = fMatch[2]
    const params = fMatch[3].trim()
    const startIndex = fMatch.index
    const openingBraceIndex = cleanCode.indexOf('{', startIndex)

    let depth = 0, bodyEnd = openingBraceIndex
    let foundStart = false
    for (let i = openingBraceIndex; i < cleanCode.length; i++) {
      if (cleanCode[i] === '{') { depth++; foundStart = true }
      else if (cleanCode[i] === '}') {
        depth--
        if (foundStart && depth === 0) { bodyEnd = i; break }
      }
    }

    // Body ONLY — content between { and } (excluding function header)
    const bodyOnly = cleanCode.substring(openingBraceIndex + 1, bodyEnd)
    functions.push({ name, returnType, params, bodyOnly, startIndex, bodyEnd })
  }

  // 2. Build Call Graph & Recursion Detection using bodyOnly
  const callGraph = {}
  let hasRecursion = false

  functions.forEach(fn => {
    callGraph[fn.name] = []
    functions.forEach(otherFn => {
      const callRegex = new RegExp(`\\b${escapeRegex(otherFn.name)}\\s*\\(`, 'g')
      const matches = (fn.bodyOnly.match(callRegex) || []).length
      if (matches > 0) {
        callGraph[fn.name].push(otherFn.name)
      }
    })
  })

  // DFS Cycle Detection across callGraph for arbitrary cycle lengths (A -> B -> C -> A)
  const visitedNodes = new Set()
  const recStack = new Set()

  function dfsCycle(node) {
    visitedNodes.add(node)
    recStack.add(node)
    const neighbors = callGraph[node] || []
    for (const neighbor of neighbors) {
      if (!visitedNodes.has(neighbor)) {
        if (dfsCycle(neighbor)) return true
      } else if (recStack.has(neighbor)) {
        return true
      }
    }
    recStack.delete(node)
    return false
  }

  for (const fnName of Object.keys(callGraph)) {
    if (fnName !== 'main' && !visitedNodes.has(fnName)) {
      if (dfsCycle(fnName)) {
        hasRecursion = true
        break
      }
    }
  }

  // 3. Track Loop Nesting via character-by-character scan (handles same-line nesting)
  let maxLoopNestDepth = 0
  {
    const loopOpenRegex = /\b(for|while)\s*\(/g
    // Find all loop opener positions and their parenthesis-close positions
    const loopPositions = [] // { start, parenEnd }
    let m
    while ((m = loopOpenRegex.exec(cleanCode)) !== null) {
      // Find matching ')' for the condition
      let depth = 0, parenEnd = -1
      for (let i = m.index + m[0].length - 1; i < cleanCode.length; i++) {
        if (cleanCode[i] === '(') depth++
        else if (cleanCode[i] === ')') { depth--; if (depth === 0) { parenEnd = i; break } }
      }
      if (parenEnd !== -1) loopPositions.push({ start: m.index, parenEnd, keyword: m[1] })
    }

    // For each loop, determine its body start and use brace depth to count nesting
    const scopeStack2 = [] // { loopStart, bodyStart, depth }

    // Process character by character to maintain brace depth
    let braceDepth2 = 0
    let parenDepth2 = 0
    let loopIdx = 0 // pointer into sorted loopPositions

    for (let ci = 0; ci < cleanCode.length; ci++) {
      // Check if a loop starts here (before processing the char so parenDepth is current)
      while (loopIdx < loopPositions.length && loopPositions[loopIdx].start === ci) {
        const lp = loopPositions[loopIdx]
        loopIdx++
        // Determine body start: after parenEnd, skip whitespace and look for { or statement
        let bodyStart = lp.parenEnd + 1
        while (bodyStart < cleanCode.length && /\s/.test(cleanCode[bodyStart])) bodyStart++
        const hasBrace = cleanCode[bodyStart] === '{'
        const currentLevel = scopeStack2.filter(s => s.type === 'loop').length + 1
        maxLoopNestDepth = Math.max(maxLoopNestDepth, currentLevel)
        loops.push({ lineIndex: cleanCode.substring(0, lp.start).split('\n').length - 1, depth: currentLevel, keyword: lp.keyword })
        scopeStack2.push({ type: 'loop', hasBrace, startBraceDepth: braceDepth2, bodyStart, isSingleStatement: !hasBrace })
      }

      const ch = cleanCode[ci]
      if (ch === '(') {
        parenDepth2++
      } else if (ch === ')') {
        parenDepth2 = Math.max(0, parenDepth2 - 1)
      } else if (ch === '{') {
        braceDepth2++
      } else if (ch === '}') {
        braceDepth2--
        // Pop any braced loop scopes whose brace closed
        while (scopeStack2.length > 0) {
          const top = scopeStack2[scopeStack2.length - 1]
          if (!top.isSingleStatement && braceDepth2 < top.startBraceDepth + 1) {
            scopeStack2.pop()
          } else break
        }
      } else if (ch === ';' && parenDepth2 === 0) {
        // Only pop single-statement loops at statement-level semicolons
        // (not the semicolons inside for(init; cond; incr))
        while (scopeStack2.length > 0 && scopeStack2[scopeStack2.length - 1].isSingleStatement) {
          scopeStack2.pop()
        }
      }
    }

    // Override the loops array with our recomputed one (clear previous line-by-line remnants)
    loops.splice(0, loops.length, ...loops.filter(l => l.keyword))
  } // end block #3

  // 4. Detect Arrays & Vectors
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

  // Check if any loop has a dynamic (variable) upper bound e.g. i < n vs constant i < 10
  let hasDynamicLoopBound = false
  const loopBoundRegex = /\b(?:for|while)\s*\([^;)]*;\s*[^;)]*?[<>=!]+\s*([a-zA-Z_]\w*)/g
  let boundMatch
  while ((boundMatch = loopBoundRegex.exec(cleanCode)) !== null) {
    if (!/^\d+$/.test(boundMatch[1])) {
      hasDynamicLoopBound = true
      break
    }
  }

  // 5. Estimate Big-O Time Complexity
  let estimatedBigO = 'O(1)'
  if (hasRecursion) {
    // Find the recursive function
    const recursiveFn = functions.find(f => f.name !== 'main' && callGraph[f.name]?.includes(f.name))
    if (recursiveFn) {
      const callsCount = (recursiveFn.bodyOnly.match(new RegExp(`\\b${recursiveFn.name}\\s*\\(`, 'g')) || []).length
      if (callsCount >= 2) estimatedBigO = 'O(2^N)'
      else if (recursiveFn.bodyOnly.includes('/ 2') || recursiveFn.bodyOnly.includes('/2')) estimatedBigO = 'O(log N)'
      else estimatedBigO = 'O(N)'
    } else {
      estimatedBigO = 'O(N)'
    }
  } else if (!hasDynamicLoopBound && maxLoopNestDepth > 0) {
    // All loops have constant bounds (e.g. 0..10), complexity is O(1)
    estimatedBigO = 'O(1)'
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
