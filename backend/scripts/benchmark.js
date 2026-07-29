/**
 * Benchmark Script — NEU CodeLens Scoring System
 * Đánh giá chất lượng chấm điểm so với ground truth
 * Run: node backend/scripts/benchmark.js
 *
 * Chỉ số đánh giá:
 * - RMSE (Root Mean Squared Error): sai lệch tổng điểm
 * - MAE  (Mean Absolute Error): sai lệch tuyệt đối trung bình
 * - Cohen's Kappa: độ đồng thuận phân loại pass/warning/fail
 * - Per-concept accuracy: % concept được phát hiện đúng
 */

import { analyzeCode } from '../services/llmService.js'

// ─────────────────────────────────────────────────────────────────────────────
// Internal Regression Benchmark Dataset (24 mẫu thử nghiệm nội bộ)
// 📌 Ghi chú phương pháp: Đây là bộ test hồi quy quy tắc nội bộ (Regression Benchmark)
// giúp đảm bảo các hàm phân tích AST & adapter không bị tụt lùi khi nâng cấp code.
// ─────────────────────────────────────────────────────────────────────────────
const GROUND_TRUTH = [
  // === NHÓM 1: Vòng lặp & I/O ===
  {
    label: 'loop_io_perfect',
    concepts: ['Loops', 'I/O', 'Variables'],
    test_cases_json: '[{"input":"3","expected":"1\\n2\\n3"}]',
    code: `#include <iostream>
using namespace std;
int main() {
    int n;
    cin >> n;
    for (int i = 1; i <= n; i++) {
        cout << i << endl;
    }
    return 0;
}`,
    expected_status: 'passed',
    expected_score_min: 70,
    expected_concepts: { 'Loops': true, 'I/O': true, 'Variables': true }
  },
  {
    label: 'loop_empty_exploit',
    concepts: ['Loops', 'I/O'],
    code: `#include <iostream>
using namespace std;
int main() { for(;;){} return 0; }`,
    expected_status: 'failed',
    expected_score_max: 30,
    expected_concepts: { 'Loops': false }
  },
  {
    label: 'loop_io_no_cin',
    concepts: ['I/O'],
    code: `#include <iostream>
using namespace std;
int main() { cout << "Hello"; return 0; }`,
    expected_status: 'warning',
    expected_score_min: 20,
    expected_score_max: 65,
    expected_concepts: { 'I/O': false }  // only cout, not both
  },

  // === NHÓM 2: Đệ quy ===
  {
    label: 'recursion_factorial',
    concepts: ['Recursion', 'Functions', 'Base Case'],
    test_cases_json: '[{"input":"","expected":"120"}]',
    code: `#include <iostream>
using namespace std;
int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
int main() { cout << factorial(5); return 0; }`,
    expected_status: 'passed',
    expected_score_min: 70,
    expected_concepts: { 'Recursion': true, 'Functions': true, 'Base Case': true }
  },
  {
    label: 'recursion_false_positive',
    concepts: ['Recursion'],
    code: `#include <iostream>
using namespace std;
void sapXep(int arr[], int n) {
    for (int i = 0; i < n-1; i++)
        for (int j = 0; j < n-i-1; j++)
            if (arr[j] > arr[j+1]) { int t=arr[j]; arr[j]=arr[j+1]; arr[j+1]=t; }
}
int main() { int a[]={5,3,1,4,2}; sapXep(a,5); return 0; }`,
    expected_status: 'failed',
    expected_score_max: 40,
    expected_concepts: { 'Recursion': false }
  },

  // === NHÓM 3: Vòng lặp lồng nhau ===
  {
    label: 'nested_loop_real',
    concepts: ['Nested Loops', 'Pattern Printing'],
    test_cases_json: '[{"input":"","expected":"*\\n**\\n***\\n****\\n*****"}]',
    code: `#include <iostream>
using namespace std;
int main() {
    int n = 5;
    for (int i = 1; i <= n; i++) {
        for (int j = 1; j <= i; j++) cout << "*";
        cout << endl;
    }
    return 0;
}`,
    expected_status: 'passed',
    expected_score_min: 65,
    expected_concepts: { 'Nested Loops': true, 'Pattern Printing': true }
  },
  {
    label: 'nested_loop_sequential_exploit',
    concepts: ['Nested Loops'],
    code: `#include <iostream>
using namespace std;
int main() {
    for (int i = 0; i < 5; i++) cout << i;
    for (int j = 0; j < 5; j++) cout << j;
    return 0;
}`,
    expected_status: 'failed',
    expected_score_max: 40,
    expected_concepts: { 'Nested Loops': false }
  },
  {
    label: 'nested_loop_inline',
    concepts: ['Nested Loops'],
    code: `int main(){for(int i=0;i<5;i++){for(int j=0;j<5;j++){int x=i*j;}}}`,
    expected_status: 'warning',
    expected_score_min: 30,
    expected_concepts: { 'Nested Loops': true }
  },

  // === NHÓM 4: Hàm ===
  {
    label: 'functions_stub_exploit',
    concepts: ['Functions'],
    code: `#include <iostream>
using namespace std;
void a(){} void b(){} int main(){ return 0; }`,
    expected_status: 'failed',
    expected_score_max: 30,
    expected_concepts: { 'Functions': false }
  },
  {
    label: 'functions_real',
    concepts: ['Functions', 'Variables'],
    test_cases_json: '[{"input":"","expected":"8 4"}]',
    code: `#include <iostream>
using namespace std;
int tinh_tong(int a, int b) { return a + b; }
double tinh_trung_binh(int a, int b) { return (a + b) / 2.0; }
int main() {
    int x = 5, y = 3;
    cout << tinh_tong(x, y) << " " << tinh_trung_binh(x, y);
    return 0;
}`,
    expected_status: 'passed',
    expected_score_min: 70,
    expected_concepts: { 'Functions': true, 'Variables': true }
  },

  // === NHÓM 5: Conditionals ===
  {
    label: 'conditionals_empty_exploit',
    concepts: ['Conditionals'],
    code: `#include <iostream>
using namespace std;
int main() { int x; cin>>x; if(x){} else{} return 0; }`,
    expected_status: 'failed',
    expected_score_max: 35,
    expected_concepts: { 'Conditionals': false }
  },
  {
    label: 'conditionals_real_elseif',
    concepts: ['Conditionals', 'I/O'],
    test_cases_json: '[{"input":"75","expected":"Kha"}]',
    code: `#include <iostream>
using namespace std;
int main() {
    int diem; cin >> diem;
    if (diem >= 90) cout << "Xuat sac";
    else if (diem >= 70) cout << "Kha";
    else if (diem >= 50) cout << "Trung binh";
    else cout << "Yeu";
    return 0;
}`,
    expected_status: 'passed',
    expected_score_min: 65,
    expected_concepts: { 'Conditionals': true, 'I/O': true }
  },

  // === NHÓM 6: Mảng & tìm kiếm ===
  {
    label: 'array_linear_search',
    concepts: ['Arrays', 'Linear Search', 'Loops'],
    test_cases_json: '[{"input":"3 10 20 30 20","expected":"1"}]',
    code: `#include <iostream>
using namespace std;
int main() {
    int arr[10], n, key;
    cin >> n;
    for (int i = 0; i < n; i++) cin >> arr[i];
    cin >> key;
    bool found = false;
    for (int i = 0; i < n; i++) {
        if (arr[i] == key) { cout << i; found = true; break; }
    }
    if (!found) cout << -1;
    return 0;
}`,
    expected_status: 'passed',
    expected_score_min: 70,
    expected_concepts: { 'Arrays': true, 'Linear Search': true, 'Loops': true }
  },

  // === NHÓM 7: Sắp xếp ===
  {
    label: 'bubble_sort',
    concepts: ['Sorting Algorithm', 'Arrays', 'Nested Loops'],
    test_cases_json: '[{"input":"3 3 1 2","expected":"1 2 3 "}]',
    code: `#include <iostream>
using namespace std;
int main() {
    int n; cin >> n;
    int arr[100];
    for (int i = 0; i < n; i++) cin >> arr[i];
    for (int i = 0; i < n-1; i++)
        for (int j = 0; j < n-i-1; j++)
            if (arr[j] > arr[j+1]) { int t=arr[j]; arr[j]=arr[j+1]; arr[j+1]=t; }
    for (int i = 0; i < n; i++) cout << arr[i] << " ";
    return 0;
}`,
    expected_status: 'passed',
    expected_score_min: 72,
    expected_concepts: { 'Sorting Algorithm': true, 'Arrays': true, 'Nested Loops': true }
  },

  // === NHÓM 8: OOP ===
  {
    label: 'oop_basic_class',
    concepts: ['OOP', 'Functions'],
    test_cases_json: '[{"input":"","expected":"15 16"}]',
    code: `#include <iostream>
using namespace std;
class HinhChuNhat {
public:
    double chieuDai, chieuRong;
    double dienTich() { return chieuDai * chieuRong; }
    double chuVi() { return 2 * (chieuDai + chieuRong); }
};
int main() {
    HinhChuNhat h;
    h.chieuDai = 5; h.chieuRong = 3;
    cout << h.dienTich() << " " << h.chuVi();
    return 0;
}`,
    expected_status: 'passed',
    expected_score_min: 65,
    expected_concepts: { 'OOP': true, 'Functions': true }
  },

  // === NHÓM 9: Code rác / garble ===
  {
    label: 'garbage_random_text',
    concepts: ['Variables'],
    code: 'lkajsdhflkasdjhflksdjfhklsjdhfksdjhfkljsdhf',
    expected_status: 'failed',
    expected_score_max: 0,
    expected_concepts: {}
  },
  {
    label: 'garbage_empty',
    concepts: ['Loops'],
    code: '',
    expected_status: 'failed',
    expected_score_max: 0,
    expected_concepts: {}
  },

  // === NHÓM 10: Pointer & Memory ===
  {
    label: 'pointers_basic',
    concepts: ['Pointers', 'Variables'],
    test_cases_json: '[{"input":"","expected":"10 20"}]',
    code: `#include <iostream>
using namespace std;
int main() {
    int x = 10;
    int *ptr = &x;
    cout << *ptr << " ";
    *ptr = 20;
    cout << x;
    return 0;
}`,
    expected_status: 'passed',
    expected_score_min: 65,
    expected_concepts: { 'Pointers': true, 'Variables': true }
  },
  {
    label: 'memory_new_delete',
    concepts: ['Memory Management', 'Pointers'],
    test_cases_json: '[{"input":"","expected":"0 2 4 6 8 "}]',
    code: `#include <iostream>
using namespace std;
int main() {
    int* arr = new int[5];
    for (int i = 0; i < 5; i++) arr[i] = i * 2;
    for (int i = 0; i < 5; i++) cout << arr[i] << " ";
    delete[] arr;
    return 0;
}`,
    expected_status: 'passed',
    expected_score_min: 65,
    expected_concepts: { 'Memory Management': true, 'Pointers': true }
  },

  // === NHÓM 11: Chuỗi ===
  {
    label: 'string_manipulation',
    concepts: ['String Manipulation', 'I/O'],
    test_cases_json: '[{"input":"hello","expected":"5 hel 1"}]',
    code: `#include <iostream>
#include <string>
using namespace std;
int main() {
    string s;
    getline(cin, s);
    cout << s.length() << " " << s.substr(0, 3) << " " << s.find('e');
    return 0;
}`,
    expected_status: 'passed',
    expected_score_min: 65,
    expected_concepts: { 'String Manipulation': true, 'I/O': true }
  },

  // === NHÓM 12: Boolean Logic ===
  {
    label: 'boolean_logic',
    concepts: ['Boolean Logic', 'Conditionals'],
    test_cases_json: '[{"input":"5 3","expected":"Ca hai duong"}]',
    code: `#include <iostream>
using namespace std;
int main() {
    int a, b; cin >> a >> b;
    bool isPositive = a > 0 && b > 0;
    bool eitherPositive = a > 0 || b > 0;
    if (isPositive) cout << "Ca hai duong";
    else if (eitherPositive) cout << "Mot duong";
    else cout << "Khong duong";
    return 0;
}`,
    expected_status: 'passed',
    expected_score_min: 65,
    expected_concepts: { 'Boolean Logic': true, 'Conditionals': true }
  },

  // === NHÓM 13: Edge cases ===
  {
    label: 'only_main_no_logic',
    concepts: ['Variables', 'I/O'],
    code: `#include <iostream>
using namespace std;
int main() { return 0; }`,
    expected_status: 'failed',
    expected_score_max: 30,
    expected_concepts: { 'Variables': false, 'I/O': false }
  },
  {
    label: 'copy_of_sample',  // tests sample_code detection (no sample_code here so just scores low)
    concepts: ['Loops', 'I/O'],
    code: `#include <iostream>
using namespace std;
int main() {
    // Chỉ có cout không cin
    cout << "Hello World";
    return 0;
}`,
    expected_status: 'warning',
    expected_score_min: 10,
    expected_score_max: 55,
    expected_concepts: { 'Loops': false, 'I/O': false }
  },
  {
    label: 'arithmetic_basic',
    concepts: ['Arithmetic', 'Variables', 'I/O'],
    test_cases_json: '[{"input":"10 2","expected":"12 8 20 5"}]',
    code: `#include <iostream>
using namespace std;
int main() {
    double a, b;
    cin >> a >> b;
    cout << a+b << " " << a-b << " " << a*b << " " << a/b;
    return 0;
}`,
    expected_status: 'passed',
    expected_score_min: 65,
    expected_concepts: { 'Arithmetic': true, 'Variables': true, 'I/O': true }
  }
]

// ─────────────────────────────────────────────────────────────────────────────
// Chỉ số thống kê
// ─────────────────────────────────────────────────────────────────────────────

function rmse(predicted, actual) {
  if (!predicted.length) return 0
  const sum = predicted.reduce((s, p, i) => s + (p - actual[i]) ** 2, 0)
  return Math.sqrt(sum / predicted.length)
}

function mae(predicted, actual) {
  if (!predicted.length) return 0
  return predicted.reduce((s, p, i) => s + Math.abs(p - actual[i]), 0) / predicted.length
}

function scoreToCategory(score) {
  if (score >= 70) return 'passed'
  if (score >= 50) return 'warning'
  return 'failed'
}

function cohensKappa(predicted, actual, labels = ['passed', 'warning', 'failed']) {
  const n = predicted.length
  if (n === 0) return 0
  
  // Build confusion matrix
  const conf = {}
  labels.forEach(a => { conf[a] = {}; labels.forEach(b => { conf[a][b] = 0 }) })
  for (let i = 0; i < n; i++) conf[actual[i]][predicted[i]]++
  
  // Po = observed agreement
  const po = labels.reduce((s, l) => s + (conf[l][l] || 0), 0) / n
  
  // Pe = expected agreement
  const pe = labels.reduce((s, a) => {
    const rowSum = labels.reduce((r, b) => r + (conf[a][b] || 0), 0)
    const colSum = labels.reduce((r, b) => r + (conf[b][a] || 0), 0)
    return s + (rowSum / n) * (colSum / n)
  }, 0)
  
  return pe === 1 ? 1 : (po - pe) / (1 - pe)
}

// ─────────────────────────────────────────────────────────────────────────────
// Run Benchmark
// ─────────────────────────────────────────────────────────────────────────────

async function runBenchmark() {
  console.log('🔬 NEU CodeLens — Internal Regression Benchmark (Offline Deterministic Scoring)')
  console.log('📌 Kiểm thử hồi quy nội bộ quy tắc chấm AST & Adapter (Offline mode)')
  console.log('═'.repeat(70))
  
  const predictedScores = []
  const actualScoresMid = []  // midpoint of expected range
  const predictedCats = []
  const actualCats = []
  
  let conceptTP = 0, conceptFP = 0, conceptFN = 0, conceptTN = 0
  const perConceptAcc = {}
  
  let passed_count = 0, failed_count = 0

  for (const sample of GROUND_TRUTH) {
    const fakeAssignment = {
      id: 0, title: sample.label, description: '', lang: 'C++', 
      concepts: sample.concepts, test_cases_json: sample.test_cases_json || '[]',
      weight_t1: 40, weight_t2: 35, weight_t3: 25
    }
    
    let result
    try {
      result = await analyzeCode(sample.code, fakeAssignment, 'benchmark_student', { skipLLM: true })
    } catch (err) {
      console.error(`  ❌ Error on ${sample.label}:`, err.message)
      continue
    }
    
    const predicted = result.score_total ?? 0
    const actual_mid = ((sample.expected_score_min ?? 0) + (sample.expected_score_max ?? 100)) / 2
    predictedScores.push(predicted)
    actualScoresMid.push(actual_mid)
    predictedCats.push(result.status === 'ungraded' ? 'failed' : scoreToCategory(predicted))
    actualCats.push(sample.expected_status)
    
    // Score range check
    const inRange = (result.status === sample.expected_status) ||
      ((sample.expected_score_min === undefined || predicted >= sample.expected_score_min)
      && (sample.expected_score_max === undefined || predicted <= sample.expected_score_max))
    
    // Concept accuracy
    const conceptScores = result.concept_scores || {}
    for (const [concept, shouldBePresent] of Object.entries(sample.expected_concepts || {})) {
      const detected = (conceptScores[concept] ?? 0) >= 60
      if (!perConceptAcc[concept]) perConceptAcc[concept] = { tp: 0, fp: 0, fn: 0, tn: 0 }
      if (shouldBePresent && detected) { conceptTP++; perConceptAcc[concept].tp++ }
      else if (shouldBePresent && !detected) { conceptFN++; perConceptAcc[concept].fn++ }
      else if (!shouldBePresent && detected) { conceptFP++; perConceptAcc[concept].fp++ }
      else { conceptTN++; perConceptAcc[concept].tn++ }
    }
    
    const icon = inRange ? '✅' : '❌'
    if (inRange) passed_count++; else failed_count++
    const t1Info = result.score_t1 === null ? 'T1=null' : `T1=${result.score_t1}`
    const predStr = result.score_total === null ? 'null' : String(predicted)
    console.log(`${icon} [${sample.label.padEnd(35)}] pred=${predStr.padStart(4)} status=${result.status.padEnd(8)} ${t1Info.padEnd(10)} (expected: ${sample.expected_status})`)
  }
  
  console.log('\n' + '─'.repeat(70))
  console.log('📊 Statistical Metrics')
  console.log('─'.repeat(70))
  console.log(`  Samples:     ${GROUND_TRUTH.length}`)
  console.log(`  In-range:    ${passed_count}/${GROUND_TRUTH.length} (${Math.round(passed_count/GROUND_TRUTH.length*100)}%)`)
  
  const rmsVal = rmse(predictedScores, actualScoresMid)
  const maeVal = mae(predictedScores, actualScoresMid)
  console.log(`  RMSE:        ${rmsVal.toFixed(2)} (Root Mean Squared Error vs expected midpoint)`)
  console.log(`  MAE:         ${maeVal.toFixed(2)} (Mean Absolute Error)`)
  
  const kappa = cohensKappa(predictedCats, actualCats)
  console.log(`  Cohen's κ:   ${kappa.toFixed(3)} ${kappa > 0.8 ? '(Almost Perfect ✅)' : kappa > 0.6 ? '(Substantial ✅)' : kappa > 0.4 ? '(Moderate ⚠️)' : '(Fair ❌)'}`)
  
  console.log('\n📌 Concept Detection (per-concept precision/recall)')
  console.log('─'.repeat(70))
  for (const [concept, counts] of Object.entries(perConceptAcc)) {
    const { tp, fp, fn, tn } = counts
    const precision = tp + fp > 0 ? tp / (tp + fp) : 1
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0
    const icon = f1 >= 0.8 ? '✅' : f1 >= 0.5 ? '⚠️' : '❌'
    console.log(`  ${icon} ${concept.padEnd(25)} P=${precision.toFixed(2)} R=${recall.toFixed(2)} F1=${f1.toFixed(2)}`)
  }
  
  const overallF1 = conceptTP + conceptFP + conceptFN > 0
    ? (2 * conceptTP) / (2 * conceptTP + conceptFP + conceptFN)
    : 0
  console.log(`\n  Overall Concept F1: ${overallF1.toFixed(3)}`)
  console.log('═'.repeat(70))
  
  if (kappa >= 0.6 && rmsVal <= 20) {
    console.log('✅ Hệ thống đạt ngưỡng chất lượng tối thiểu (κ≥0.6, RMSE≤20)')
  } else {
    console.log('⚠️  Hệ thống chưa đạt ngưỡng — cần review scoring rules')
  }
  
  process.exit(0)
}

runBenchmark().catch(e => { console.error('Benchmark error:', e); process.exit(1) })
