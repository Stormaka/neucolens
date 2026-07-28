/**
 * Python Language Adapter
 * Handles parsing, AST inspection, test execution, and keyword rules for Python
 */

export const pythonAdapter = {
  lang: 'Python',
  extensions: ['.py'],

  parseAST(code) {
    if (!code) return { maxNestDepth: 0, functions: [], loops: [], hasRecursion: false, estimatedBigO: 'O(1)' }
    
    // Lightweight Python indentation/nesting counter
    const lines = code.split('\n')
    let maxNestDepth = 0, currentDepth = 0
    const functions = []
    const loops = []
    let hasRecursion = false

    lines.forEach((line, idx) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      
      const indent = line.search(/\S/)
      if (indent >= 0) currentDepth = Math.floor(indent / 4) + 1

      if (/^def\s+(\w+)\s*\(/.test(trimmed)) {
        const fnName = trimmed.match(/^def\s+(\w+)/)?.[1]
        if (fnName) {
          functions.push({ name: fnName, line: idx })
          if (code.match(new RegExp(`\\b${fnName}\\s*\\(`, 'g'))?.length > 1) {
            hasRecursion = true
          }
        }
      }

      if (/^(for|while)\b/.test(trimmed)) {
        loops.push({ line: idx, depth: currentDepth })
        if (currentDepth > maxNestDepth) maxNestDepth = currentDepth
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
