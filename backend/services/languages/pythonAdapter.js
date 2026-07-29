/**
 * Python Language Adapter
 * Handles parsing, AST inspection, test execution, and keyword rules for Python
 */

export const pythonAdapter = {
  lang: 'Python',
  extensions: ['.py'],

  parseAST(code) {
    if (!code) return { maxNestDepth: 0, functions: [], loops: [], hasRecursion: false, estimatedBigO: 'O(1)' }
    
    // Lightweight Python indentation/nesting counter (normalized for function scope)
    const lines = code.split('\n')
    let maxNestDepth = 0
    const functions = []
    const loops = []
    let hasRecursion = false
    // 1. Parse functions and extract body content for recursion check
    const fnBodies = {}
    let activeFnName = null
    let activeFnIndent = -1
    let currentFnIndent = null

    lines.forEach((line, idx) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const indent = line.search(/\S/)
      const rawDepth = indent >= 0 ? Math.floor(indent / 4) + 1 : 1

      if (/^def\s+(\w+)\s*\(/.test(trimmed)) {
        const match = trimmed.match(/^def\s+(\w+)/)
        if (match) {
          activeFnName = match[1]
          activeFnIndent = indent
          currentFnIndent = indent
          fnBodies[activeFnName] = ''
          functions.push({ name: activeFnName, line: idx })
        }
      } else if (activeFnName && indent > activeFnIndent) {
        fnBodies[activeFnName] += trimmed + '\n'
      } else if (activeFnName && indent <= activeFnIndent && !/^def\b/.test(trimmed)) {
        activeFnName = null
        currentFnIndent = null
      }

      if (/^(for|while)\b/.test(trimmed)) {
        const fnBaseDepth = currentFnIndent !== null ? Math.floor(currentFnIndent / 4) + 1 : 0
        const loopDepth = Math.max(1, rawDepth - fnBaseDepth)
        loops.push({ line: idx, depth: loopDepth })
        if (loopDepth > maxNestDepth) maxNestDepth = loopDepth
      }
    })

    // Detect recursion strictly if function calls itself within its own body
    functions.forEach(fn => {
      const body = fnBodies[fn.name] || ''
      const selfCallRegex = new RegExp(`\\b${fn.name}\\s*\\(`, 'g')
      if (selfCallRegex.test(body)) {
        hasRecursion = true
      }
    })

    const estimatedBigO = maxNestDepth >= 2 ? 'O(N^2)' : maxNestDepth === 1 ? 'O(N)' : 'O(1)'

    return {
      maxNestDepth,
      functions,
      loops,
      hasRecursion,
      estimatedBigO
    }
  },

  scoreConcept(concept, code, ast) {
    const parsedAst = ast || this.parseAST(code)
    
    if (concept === 'Nested Loops') return parsedAst.maxNestDepth >= 2 ? 100 : (parsedAst.maxNestDepth === 1 ? 30 : 0)
    if (concept === 'Recursion') return parsedAst.hasRecursion ? 100 : 0
    if (concept === 'Functions') return parsedAst.functions.length >= 1 ? 100 : 0
    if (concept === 'Loops') return parsedAst.loops.length >= 1 ? 100 : 0

    const lower = code.toLowerCase()
    if (concept === 'Conditionals' && /\b(if|elif|else)\b/.test(lower)) return 100
    if (concept === 'I/O' && /\b(input|print)\b/.test(lower)) return 100
    if (concept === 'Arrays' && /\[.*\]|\b(list|append)\b/.test(lower)) return 100
    if (concept === 'OOP' && /\bclass\b/.test(lower)) return 100

    return 50
  }
}
