/**
 * Unit Test Suite — NEU CodeLens
 * Run: node backend/tests/unit_test.js
 */

import { parseCppAST } from '../services/astParser.js'
import { cppAdapter } from '../services/languages/cppAdapter.js'
import { getLanguageAdapter } from '../services/languages/index.js'

let passed = 0
let failed = 0
const failures = []

function assert(label, condition, context = '') {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${label}${context ? ` (${context})` : ''}`)
    failed++
    failures.push({ label, context })
  }
}

function group(name, fn) {
  console.log(`\n🔷 ${name}`)
  fn()
}

// ─────────────────────────────────────────────────────────
// 1. AST Parser — Sequential loops must NOT be nested
// ─────────────────────────────────────────────────────────
group('astParser: Sequential vs Nested loops', () => {
  const seq = `
    #include <iostream>
    int main() {
      for (int i = 0; i < 5; i++) { std::cout << i; }
      for (int j = 0; j < 5; j++) { std::cout << j; }
    }
  `
  const astSeq = parseCppAST(seq)
  assert('Sequential loops: maxNestDepth === 1', astSeq.maxNestDepth === 1, `got ${astSeq.maxNestDepth}`)

  const nested = `
    #include <iostream>
    int main() {
      for (int i = 0; i < 5; i++) {
        for (int j = 0; j < 5; j++) {
          std::cout << i << " " << j;
        }
      }
    }
  `
  const astNested = parseCppAST(nested)
  assert('Braced nested loops: maxNestDepth === 2', astNested.maxNestDepth >= 2, `got ${astNested.maxNestDepth}`)

  const singleStmt = `
    int main() {
      for (int i = 0; i < 5; i++)
        for (int j = 0; j < 5; j++)
          std::cout << i * j;
    }
  `
  const astSingle = parseCppAST(singleStmt)
  assert('Single-statement nested loops: maxNestDepth >= 2', astSingle.maxNestDepth >= 2, `got ${astSingle.maxNestDepth}`)
})

// ─────────────────────────────────────────────────────────
// 2. AST Parser — Recursion detection
// ─────────────────────────────────────────────────────────
group('astParser: Recursion detection', () => {
  const recurse = `
    int factorial(int n) {
      if (n <= 1) return 1;
      return n * factorial(n - 1);
    }
    int main() { std::cout << factorial(5); }
  `
  const ast = parseCppAST(recurse)
  assert('Recursive function detected', ast.hasRecursion === true)

  const normal = `
    void printHello() { std::cout << "Hello"; }
    void printWorld() { std::cout << "World"; }
    int main() { printHello(); printWorld(); }
  `
  const ast2 = parseCppAST(normal)
  assert('Non-recursive function NOT flagged', ast2.hasRecursion === false)
})

// ─────────────────────────────────────────────────────────
// 3. Concept Scorer — Nested Loops
// ─────────────────────────────────────────────────────────
group('cppAdapter.scoreConcept: Nested Loops', () => {
  const seqCode = `int main(){for(int i=0;i<5;i++){std::cout<<i;}for(int j=0;j<5;j++){std::cout<<j;}}`
  const score1 = cppAdapter.scoreConcept('Nested Loops', seqCode)
  assert('Sequential loops score < 50', score1 < 50, `got ${score1}`)

  const nestedCode = `int main(){for(int i=0;i<5;i++){for(int j=0;j<5;j++){std::cout<<i*j;}}}`
  const score2 = cppAdapter.scoreConcept('Nested Loops', nestedCode)
  assert('True nested loops score === 100', score2 === 100, `got ${score2}`)
})

// ─────────────────────────────────────────────────────────
// 4. Concept Scorer — Functions (no stub exploitation)
// ─────────────────────────────────────────────────────────
group('cppAdapter.scoreConcept: Functions', () => {
  const stubs = `void a(){} void b(){} int main(){}`
  const score1 = cppAdapter.scoreConcept('Functions', stubs)
  assert('Empty stub functions score === 0', score1 === 0, `got ${score1}`)

  const real = `
    int add(int a, int b){ return a + b; }
    int mul(int a, int b){ return a * b; }
    int main(){ std::cout << add(2,3) << mul(2,3); }
  `
  const score2 = cppAdapter.scoreConcept('Functions', real)
  assert('Real functions with calls score === 100', score2 === 100, `got ${score2}`)
})

// ─────────────────────────────────────────────────────────
// 5. Concept Scorer — Conditionals (no empty-body exploit)
// ─────────────────────────────────────────────────────────
group('cppAdapter.scoreConcept: Conditionals', () => {
  const empty = `int main(){ if(x){} else{} }`
  const score1 = cppAdapter.scoreConcept('Conditionals', empty)
  assert('Empty if-else body scores 0', score1 === 0, `got ${score1}`)

  const real = `int main(){ int x=5; if(x>3){ std::cout<<x; } else{ std::cout<<0; } }`
  const score2 = cppAdapter.scoreConcept('Conditionals', real)
  assert('Real if-else with non-trivial body scores >= 85', score2 >= 85, `got ${score2}`)
})

// ─────────────────────────────────────────────────────────
// 6. Concept Scorer — I/O (coupled cin+cout)
// ─────────────────────────────────────────────────────────
group('cppAdapter.scoreConcept: I/O', () => {
  const onlyCout = `int main(){ std::cout << "Hello"; }`
  const score1 = cppAdapter.scoreConcept('I/O', onlyCout)
  assert('Only cout scores < 100', score1 < 100, `got ${score1}`)

  const both = `int main(){ int n; std::cin >> n; std::cout << n; }`
  const score2 = cppAdapter.scoreConcept('I/O', both)
  assert('cin + cout together scores 100', score2 === 100, `got ${score2}`)
})

// ─────────────────────────────────────────────────────────
// 7. Concept Scorer — Loops (no empty for(;;){} exploit)
// ─────────────────────────────────────────────────────────
group('cppAdapter.scoreConcept: Loops', () => {
  const empty = `int main(){ for(;;){} }`
  const score1 = cppAdapter.scoreConcept('Loops', empty)
  assert('Empty for(;;){} scores 0', score1 === 0, `got ${score1}`)

  const real = `int main(){ for(int i=0;i<5;i++){ std::cout<<i; } }`
  const score2 = cppAdapter.scoreConcept('Loops', real)
  assert('Real loop with body scores >= 80', score2 >= 80, `got ${score2}`)
})

// ─────────────────────────────────────────────────────────
// 8. Language registry adapter resolution
// ─────────────────────────────────────────────────────────
group('getLanguageAdapter: registry keys', () => {
  const a1 = getLanguageAdapter('C++')
  assert('C++ key resolves to adapter', a1 && a1.lang === 'C++')

  const a2 = getLanguageAdapter('CPP')
  assert('CPP key resolves to adapter', a2 && a2.lang === 'C++')

  const a3 = getLanguageAdapter('python')
  assert('python (lowercase) resolves to Python adapter', a3 && a3.lang === 'Python')
})

// ─────────────────────────────────────────────────────────
// 9. Recursion — Not falsely flagged by signature line
// ─────────────────────────────────────────────────────────
group('astParser: Recursion — no false positive from signature', () => {
  const code = `
    void sapXep(int arr[], int n) {
      for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - i - 1; j++) {
          if (arr[j] > arr[j+1]) {
            int t = arr[j]; arr[j] = arr[j+1]; arr[j+1] = t;
          }
        }
      }
    }
    int main() { int a[] = {5,3,1,4,2}; sapXep(a, 5); }
  `
  const ast = parseCppAST(code)
  assert('Bubble sort NOT flagged as recursive', ast.hasRecursion === false, `hasRecursion=${ast.hasRecursion}`)
})

// ─────────────────────────────────────────────────────────
// 10. Python Adapter — Recursion false-positive fix
// ─────────────────────────────────────────────────────────
group('pythonAdapter: Recursion — no false positive from outside calls', () => {
  const pyAdapter = getLanguageAdapter('Python')
  const nonRecursiveCode = `
def calculate(x):
    return x + 1

print(calculate(3))
`
  const astNonRec = pyAdapter.parseAST(nonRecursiveCode)
  assert('Python normal function call outside body NOT flagged as recursion', astNonRec.hasRecursion === false, `hasRecursion=${astNonRec.hasRecursion}`)

  const recursiveCode = `
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print(factorial(5))
`
  const astRec = pyAdapter.parseAST(recursiveCode)
  assert('Python self-call inside body correctly flagged as recursion', astRec.hasRecursion === true, `hasRecursion=${astRec.hasRecursion}`)
})

// ─────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}  Total: ${passed + failed}`)
if (failures.length > 0) {
  console.log('\nFailed cases:')
  failures.forEach(f => console.error(`  - ${f.label}${f.context ? ` (${f.context})` : ''}`))
  process.exit(1)
} else {
  console.log('All tests passed! 🎉')
  process.exit(0)
}
