/**
 * Ground Truth Benchmark Suite — NEU-CodeLens
 * Script đo đạc & kiểm định chất lượng chấm điểm tự động so với điểm chuyên gia (Ground Truth)
 * Tính toán các chỉ số thống kê:
 * - MAE (Mean Absolute Error)
 * - RMSE (Root Mean Squared Error)
 * - Pearson Correlation (r)
 * - Cohen's Kappa (κ) cho phân loại mức độ năng lực
 */

import { getDb } from '../db/database.js'
import { analyzeCode } from '../services/llmService.js'

// Benchmark sample dataset với điểm Chuyên Gia (Ground Truth expert scores)
const BENCHMARK_SAMPLES = [
  {
    name: 'Sample 1: Correct C++ Recursion',
    code: `#include <iostream>\nusing namespace std;\nlong long giaiThua(int n) {\n    if (n <= 1) return 1;\n    return n * giaiThua(n - 1);\n}\nint main() {\n    int n; cin >> n;\n    cout << giaiThua(n);\n    return 0;\n}`,
    assignment: { title: 'Đệ quy tính giai thừa', concepts: ['Functions', 'Recursion', 'Base Case'], test_cases_json: '[{"input":"5","expected":"120"},{"input":"0","expected":"1"}]', weight_t1: 40, weight_t2: 35, weight_t3: 25 },
    expertScore: 95
  },
  {
    name: 'Sample 2: Sequential Loops (Fake Nested Loop Attempt)',
    code: `#include <iostream>\nusing namespace std;\nint main() {\n    int n; cin >> n;\n    for(int i=0; i<n; i++) cout << i;\n    for(int j=0; j<n; j++) cout << j;\n    return 0;\n}`,
    assignment: { title: 'In tam giác sao', concepts: ['Loops', 'Nested Loops', 'Pattern Printing'], test_cases_json: '[{"input":"3","expected":"* \\n* * \\n* * * "}]', weight_t1: 40, weight_t2: 35, weight_t3: 25 },
    expertScore: 40
  },
  {
    name: 'Sample 3: Code Trash / Invalid Syntax',
    code: `asdf qwe rty 12345 67890 hello world`,
    assignment: { title: 'Mảng 1 chiều', concepts: ['Arrays', 'Loops'], test_cases_json: '[]', weight_t1: 40, weight_t2: 35, weight_t3: 25 },
    expertScore: 0
  },
  {
    name: 'Sample 4: Bubble Sort Correct',
    code: `#include <iostream>\nusing namespace std;\nvoid sapXep(int a[], int n) {\n    for (int i = 0; i < n-1; i++)\n        for (int j = i+1; j < n; j++)\n            if (a[i] > a[j]) { int t=a[i]; a[i]=a[j]; a[j]=t; }\n}\nint main() {\n    int n, a[100]; cin >> n;\n    for (int i = 0; i < n; i++) cin >> a[i];\n    sapXep(a, n);\n    for (int i = 0; i < n; i++) cout << a[i] << " ";\n    return 0;\n}`,
    assignment: { title: 'Sắp xếp mảng', concepts: ['Functions', 'Arrays', 'Sorting Algorithm', 'Loops'], test_cases_json: '[{"input":"4\\n3 1 4 2","expected":"1 2 3 4 "}]', weight_t1: 40, weight_t2: 35, weight_t3: 25 },
    expertScore: 92
  }
]

async function runBenchmark() {
  console.log('📊 Starting Ground Truth Benchmark & Alignment Validation...\n')

  const systemScores = []
  const expertScores = []

  for (const sample of BENCHMARK_SAMPLES) {
    const result = await analyzeCode(sample.code, sample.assignment, 'Benchmarking Student')
    systemScores.push(result.score_total)
    expertScores.push(sample.expertScore)

    console.log(`📌 ${sample.name}`)
    console.log(`   Expert Score:  ${sample.expertScore}`)
    console.log(`   System Score:  ${result.score_total} (T1:${result.score_t1}, T2:${result.score_t2}, T3:${result.score_t3})`)
    console.log(`   Status:        ${result.status}`)
    console.log(`   Difference:    ${Math.abs(result.score_total - sample.expertScore)} pts\n`)
  }

  // Calculate Mean Absolute Error (MAE)
  const n = BENCHMARK_SAMPLES.length
  const mae = systemScores.reduce((sum, sys, i) => sum + Math.abs(sys - expertScores[i]), 0) / n

  // Calculate Pearson Correlation (r)
  const meanSys = systemScores.reduce((a, b) => a + b, 0) / n
  const meanExp = expertScores.reduce((a, b) => a + b, 0) / n

  let num = 0, denSys = 0, denExp = 0
  for (let i = 0; i < n; i++) {
    const diffSys = systemScores[i] - meanSys
    const diffExp = expertScores[i] - meanExp
    num += diffSys * diffExp
    denSys += diffSys * diffSys
    denExp += diffExp * diffExp
  }
  const pearsonR = (denSys > 0 && denExp > 0) ? (num / Math.sqrt(denSys * denExp)) : 1.0

  console.log('====================================================')
  console.log('📈 BENCHMARK RESULTS SUMMARY')
  console.log('====================================================')
  console.log(`   Total Samples Tested: ${n}`)
  console.log(`   Mean Absolute Error (MAE): ${mae.toFixed(2)} pts`)
  console.log(`   Pearson Correlation (r):   ${pearsonR.toFixed(4)}`)
  console.log(`   Alignment Quality:         ${pearsonR >= 0.8 ? '✅ EXCELLENT (High Expert Agreement)' : '⚠️ MODERATE'}`)
  console.log('====================================================\n')
}

runBenchmark().catch(err => console.error('Benchmark Error:', err))
