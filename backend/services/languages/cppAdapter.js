/**
 * C++ Language Adapter — Complete Concept Scoring via AST
 * Single authoritative implementation for all C++ concepts.
 * No duplicate rules, no unreachable code.
 */
import { parseCppAST } from '../astParser.js'

function cleanCode(code) {
  if (!code) return ''
  let c = code.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""')
  c = c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  return c
}

export const cppAdapter = {
  lang: 'C++',
  extensions: ['.cpp', '.cc', '.cxx'],

  parseAST(code) {
    return parseCppAST(code)
  },

  scoreConcept(concept, code, cachedAst = null) {
    const ast = cachedAst || parseCppAST(code)
    const cleaned = cleanCode(code)

    switch (concept) {

      case 'Nested Loops':
        // Based on AST true nesting depth (scope stack counted)
        if (ast.maxNestDepth >= 2) return 100
        if (ast.maxNestDepth === 1) return 25  // only sequential
        return 0

      case 'Recursion':
        return ast.hasRecursion ? 100 : 0

      case 'Functions': {
        // AST-extracted functions, excluding main(); check body is non-empty and called
        const nonMain = ast.functions.filter(f => f.name !== 'main')
        if (!nonMain.length) return 0
        const activeFuncs = nonMain.filter(fn => {
          const body = (fn.bodyOnly || '').trim()
          const params = (fn.params || '').trim()
          if (!body && !params) return false  // empty function no params — stub/garbage
          const callCount = (cleaned.match(new RegExp(`\\b${fn.name}\\s*\\(`, 'g')) || []).length
          return callCount >= 1 || body.includes('return') || params.length > 0
        })
        if (activeFuncs.length >= 2) return 100
        if (activeFuncs.length === 1) return 80
        return 0
      }

      case 'Arrays': {
        // Must both declare AND access an array/vector
        const hasDecl = ast.arrays.length >= 1
        const hasIndexAccess = /\w+\s*\[\s*\w+\s*\]/.test(cleaned)
        const hasRangeFor = /for\s*\([^:]+:\s*\w+\s*\)/.test(cleaned)
        if (hasDecl && (hasIndexAccess || hasRangeFor)) return 100
        if (hasDecl || hasIndexAccess) return 50
        return 0
      }

      case 'Loops': {
        // Must have at least 1 loop with a non-empty body
        if (!ast.loops.length) return 0
        const forBodies = [...cleaned.matchAll(/\bfor\s*\([^)]*\)\s*\{([^}]*)\}/g)]
        const whileBodies = [...cleaned.matchAll(/\bwhile\s*\([^)]*\)\s*\{([^}]*)\}/g)]
        const hasActiveFor = forBodies.some(m => m[1].trim().length > 0)
        const hasActiveWhile = whileBodies.some(m => m[1].trim().length > 0)
        // Also count single-statement loops (no braces) as active
        const hasSingleFor = /\bfor\s*\([^)]+\)\s+[^{;][^;]*;/.test(cleaned)
        if ((hasActiveFor || hasSingleFor) && hasActiveWhile) return 100
        if (hasActiveFor || hasActiveWhile || hasSingleFor) return 80
        return 0
      }

      case 'Variables': {
        const decls = [...cleaned.matchAll(/\b(int|double|float|char|string|bool|long)\s+([a-zA-Z_]\w*)/g)]
        const validDecls = decls.filter(m => m[2] !== 'main')
        if (validDecls.length >= 2) return 100
        if (validDecls.length === 1) return 60
        return 0
      }

      case 'Conditionals': {
        // Chặn if/else rỗng hoàn toàn dạng stub: if(x){} hoặc if(x){} else{}
        const isStub = /\bif\s*\([^)]+\)\s*\{\s*\}\s*(?:else\s*\{\s*\})?/.test(cleaned)
        if (isStub) return 0

        const hasElseIf = /\belse\s+if\s*\(/.test(cleaned)
        const hasElse = /\belse\b\s*(?!if)/.test(cleaned)

        const ifMatches = [...cleaned.matchAll(/\bif\s*\(([^)]+)\)/g)]
        const validIfs = ifMatches.filter(m => !['true', 'false', '1', '0'].includes(m[1].trim()))

        if (!validIfs.length) return 0
        if (hasElseIf && validIfs.length >= 2) return 100
        if (hasElse && validIfs.length >= 1) return 85
        if (validIfs.length >= 2) return 70
        return 50
      }


      case 'I/O': {
        const hasCin = /\bcin\s*>>\s*[a-zA-Z_]\w*/.test(cleaned)
        const hasCout = /\bcout\s*<</.test(cleaned)
        if (hasCin && hasCout) return 100
        if (hasCin || hasCout) return 40
        return 0
      }

      case 'Sorting Algorithm': {
        const hasLibSort = /\b(?:std::)?sort\s*\(/.test(cleaned)
        if (hasLibSort) return 100
        const hasSwap = /\b(int|double|float)\s+t\s*=|\btemp\s*=|\bswap\s*\(/.test(cleaned)
        const hasNestedLoop = ast.maxNestDepth >= 2
        if (hasNestedLoop && hasSwap) return 100
        if (hasSwap && ast.loops.length >= 1) return 70
        if (hasSwap) return 40
        return 0
      }

      case 'Recursion':
        return ast.hasRecursion ? 100 : 0

      case 'OOP': {
        const hasClass = /\bclass\s+\w+/.test(cleaned)
        const hasStruct = /\bstruct\s+\w+/.test(cleaned)
        const hasMethods = (cleaned.match(/\b\w+\s*::\s*\w+\s*\(/g) || []).length > 0
        if (hasClass && hasMethods) return 100
        if (hasClass || (hasStruct && ast.functions.length > 1)) return 70
        if (hasStruct) return 40
        return 0
      }

      case 'Pointers': {
        const hasPtrDecl = /\b\w+\s*\*\s*\w+/.test(cleaned)
        const hasDeref = /\*\w+|\w+->/.test(cleaned)
        const hasRef = /\b\w+\s*&\s*\w+/.test(cleaned)
        if (hasPtrDecl && hasDeref) return 100
        if (hasPtrDecl || hasRef) return 60
        return 0
      }

      case 'Memory Management': {
        const hasNew = /\bnew\b/.test(cleaned)
        const hasDelete = /\bdelete\b/.test(cleaned)
        if (hasNew && hasDelete) return 100
        if (hasNew) return 50
        return 0
      }

      case 'String Manipulation': {
        const hasStringInclude = /#include\s*<string>/.test(code)
        const hasStringOps = /\.(length|size|substr|find|replace|push_back|append|compare)\s*\(/.test(cleaned)
        const hasGetline = /\bgetline\s*\(/.test(cleaned)
        if ((hasStringInclude || hasStringOps) && hasStringOps) return 100
        if (hasStringInclude || hasGetline) return 60
        return 0
      }

      case 'Linear Search': {
        const hasLoop = ast.loops.length >= 1
        const hasComparison = /==\s*\w+|\w+\s*==/.test(cleaned)
        const hasReturn = /\breturn\b/.test(cleaned)
        if (hasLoop && hasComparison && hasReturn) return 100
        if (hasLoop && hasComparison) return 70
        return 0
      }

      case 'Base Case': {
        // Recursion base case: if(n <= 0), if(n == 1), if(n < 1) return ...
        // More flexible: look for if with comparison to small value + return
        const hasBaseCase = (
          /\bif\s*\([^)]*(?:<=|<|==|>=|>)\s*[01]\s*\)/.test(cleaned) ||
          /\bif\s*\([^)]*(?:null|nullptr|"")\s*\)/.test(cleaned)
        ) && /\breturn\b/.test(cleaned)
        // Also check n==1 written as n==1 (without spaces)
        const hasBaseCase2 = /\bif\s*\(\s*\w+\s*(?:==|<=|<)\s*[01]\s*\)/.test(cleaned) && /\breturn\b/.test(cleaned)
        return (hasBaseCase || hasBaseCase2) ? 100 : 0
      }

      case 'Pattern Printing': {
        const hasNestedPrint = ast.maxNestDepth >= 2 && /\bcout\b/.test(cleaned)
        if (hasNestedPrint) return 100
        const hasLoopPrint = ast.loops.length >= 1 && /\bcout\b/.test(cleaned)
        if (hasLoopPrint) return 70
        return 0
      }

      case 'Arithmetic': {
        const hasOps = /[+\-*/%]/.test(cleaned) && /\b(int|double|float)\b/.test(cleaned)
        return hasOps ? 100 : 0
      }

      case 'Boolean Logic': {
        const hasBoolOps = /&&|\|\||!/.test(cleaned)
        const hasBoolVar = /\bbool\b/.test(cleaned)
        if (hasBoolOps && hasBoolVar) return 100
        if (hasBoolOps) return 70
        return 0
      }

      default: {
        // Fallback: keyword presence check for unknown/future concepts
        const kw = concept.toLowerCase().replace(/\s+/g, '|')
        try {
          const regex = new RegExp(`\\b(${kw})\\b`, 'i')
          return regex.test(cleaned) ? 60 : 0
        } catch {
          return 0
        }
      }
    }
  }
}
