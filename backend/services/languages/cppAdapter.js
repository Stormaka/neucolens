/**
 * C++ Language Adapter
 * Handles parsing, AST inspection, test execution, and keyword rules for C++
 */
import { parseCppAST } from '../astParser.js'

export const cppAdapter = {
  lang: 'C++',
  extensions: ['.cpp', '.cc', '.cxx'],

  parseAST(code) {
    return parseCppAST(code)
  },

  scoreConcept(concept, code, ast) {
    const parsedAst = ast || parseCppAST(code)
    
    if (concept === 'Nested Loops') return parsedAst.maxNestDepth >= 2 ? 100 : (parsedAst.maxNestDepth === 1 ? 30 : 0)
    if (concept === 'Recursion') return parsedAst.hasRecursion ? 100 : 0
    if (concept === 'Functions') return parsedAst.functions.filter(f => f.name !== 'main').length >= 1 ? 100 : 0
    if (concept === 'Arrays') return parsedAst.arrays.length >= 1 ? 100 : 0
    if (concept === 'Loops') return parsedAst.loops.length >= 1 ? 100 : 0

    // Fallback keyword search for basic concepts
    const lower = code.toLowerCase()
    if (concept === 'Variables' && /\b(int|double|float|char|string|bool)\s+\w+/.test(lower)) return 100
    if (concept === 'Conditionals' && /\b(if|switch)\b/.test(lower)) return 100
    if (concept === 'I/O' && /\b(cin|cout|printf|scanf)\b/.test(lower)) return 100
    if (concept === 'OOP' && /\b(class|struct)\b/.test(lower)) return 100
    
    return 50
  }
}
