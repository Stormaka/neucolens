// @ts-nocheck
import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { classrooms, assignments, submissions, chats } from '../api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// ── Phân tích code thực của sinh viên ────────────────────────────────────────

function analyzeStudentCode(code: string, concepts: string[]) {
  if (!code || !code.trim()) return null

  const lines = code.split('\n')
  const lower = code.toLowerCase()

  const findings: string[] = []
  const strengths: string[] = []
  const issues: string[] = []
  const suggestions: string[] = []

  // Phát hiện các patterns tốt
  if (/\/\//.test(code)) strengths.push('✅ Có comment giải thích code')
  if (/[a-zA-Z]{4,}/.test(code) && !/\baa\b|\bbb\b|\bx\b\s*=/.test(code)) strengths.push('✅ Đặt tên biến tương đối có nghĩa')
  if (/cout\s*<<\s*"[^"]+"\s*<</.test(code)) strengths.push('✅ Có prompt nhập liệu rõ ràng')
  if (/return\s+0/.test(code)) strengths.push('✅ Có return 0 trong main()')

  // Phát hiện lỗi / vấn đề
  // Infinite loop
  const whileBlocks = code.match(/while\s*\([^)]+\)\s*\{([^}]*)\}/gs) || []
  for (const b of whileBlocks) {
    if (!/\+\+|--|[\+\-\*\/]=/.test(b)) {
      issues.push('🔴 NGUY HIỂM: while loop không có cập nhật biến → vòng lặp vô hạn!')
    }
  }

  // Off-by-one
  if (/for\s*\([^)]*;\s*\w+\s*<=\s*n\s*;/.test(code)) {
    issues.push('⚠️ Có thể lỗi Off-by-one: `i <= n` trong vòng lặp mảng (nên dùng `i < n`)')
  }

  // Multiple independent ifs
  const ifLines = lines.filter(l => /^\s*if\s*\(/.test(l))
  if (ifLines.length >= 3 && !code.includes('else if')) {
    issues.push('⚠️ Nhiều `if` độc lập thay vì `if-else if` → có thể in nhiều kết quả cùng lúc')
  }

  // Missing includes
  if (code.includes('cout') && !code.includes('#include <iostream>')) {
    issues.push('⚠️ Dùng cout nhưng thiếu `#include <iostream>`')
  }
  if (code.includes('sqrt') && !code.includes('#include <cmath>')) {
    issues.push('⚠️ Dùng sqrt() nhưng thiếu `#include <cmath>`')
  }
  if (code.includes('M_PI') && !code.includes('<cmath>')) {
    issues.push('⚠️ Dùng M_PI nhưng thiếu `#include <cmath>`')
  }

  // Array declaration
  const arrayMatch = code.match(/int\s+\w+\s*\[(\d+)\]/)
  if (arrayMatch) {
    const size = parseInt(arrayMatch[1])
    if (size < 100 && code.includes('cin') && code.includes('n')) {
      suggestions.push(`💡 Khai báo mảng kích thước ${size} — nên dùng int a[100] để đủ an toàn`)
    }
  }

  // Recursion without base case
  if (concepts.includes('Recursion')) {
    const funcDefs = code.match(/(\w+)\s*\([^)]*\)\s*\{/g) || []
    const funcNames = funcDefs.map(f => f.match(/(\w+)\s*\(/)?.[1]).filter(Boolean)
    const hasBaseCase = /if\s*\(.*==\s*0|if\s*\(.*==\s*1|if\s*\(n\s*<=/.test(code)
    if (!hasBaseCase && funcNames.some(fn => fn && (new RegExp(fn, 'g').exec(code) || []).length > 1)) {
      issues.push('⚠️ Hàm đệ quy có thể thiếu base case (điều kiện dừng) → Stack Overflow!')
    }
  }

  // Code quality
  if (lines.length > 20 && !code.includes('//')) {
    suggestions.push('💡 Code dài nhưng thiếu comment — thêm giải thích cho các bước quan trọng')
  }

  // Detect variable names
  const singleLetterVars = (code.match(/\b(?:int|double|float|char)\s+([a-z])\b/g) || [])
    .map(m => m.match(/\s+([a-z])$/)?.[1]).filter(Boolean)
  if (singleLetterVars.length > 2) {
    suggestions.push(`💡 Nhiều biến 1 ký tự (${[...new Set(singleLetterVars)].join(', ')}) — nên đặt tên có nghĩa hơn`)
  }

  return {
    lines: lines.length,
    hasCode: true,
    strengths,
    issues,
    suggestions,
    hasIssues: issues.length > 0,
    hasSuggestions: suggestions.length > 0,
  }
}

// ── AI Response với context code thực ────────────────────────────────────────

function getAIResponse(question: string, asgn: any, studentCode: string | null, analysis: any): string {
  const q = question.toLowerCase()
  const title = asgn?.title || 'bài tập'
  const concepts: string[] = asgn?.concepts || []
  const lang = asgn?.lang || 'C++'
  const hasCode = studentCode && studentCode.trim().length > 10
  const isCpp = lang === 'C++'

  // ── Hỏi về code của chính sinh viên ────────────────────────────────────────

  // Review tổng quan code
  if (q.includes('review') || q.includes('nhận xét') || q.includes('xem code') || q.includes('đánh giá code') || q.includes('code của tôi') || q.includes('code tôi')) {
    if (!hasCode) return `Bạn chưa nộp bài tập **"${title}"** này. Hãy nộp code trước, tôi sẽ review ngay! 📝`
    
    const parts = [`**🔍 Review Code của bạn — "${title}"** (${analysis?.lines || '?'} dòng)\n`]
    
    if (analysis?.strengths?.length) {
      parts.push(`**✅ Điểm tốt:**\n${analysis.strengths.map((s: string) => `- ${s}`).join('\n')}\n`)
    }
    if (analysis?.issues?.length) {
      parts.push(`**⚠️ Vấn đề cần sửa:**\n${analysis.issues.map((i: string) => `- ${i}`).join('\n')}\n`)
    }
    if (analysis?.suggestions?.length) {
      parts.push(`**💡 Gợi ý cải thiện:**\n${analysis.suggestions.map((s: string) => `- ${s}`).join('\n')}\n`)
    }
    if (!analysis?.issues?.length && !analysis?.suggestions?.length) {
      parts.push(`**🎉 Code trông ổn!** Không phát hiện lỗi rõ ràng. Hãy test thêm với các edge case.`)
    }
    
    return parts.join('\n')
  }

  // Debug lỗi cụ thể
  if (q.includes('lỗi') || q.includes('error') || q.includes('sai') || q.includes('debug') || q.includes('không chạy') || q.includes('bug') || q.includes('fix')) {
    if (!hasCode) {
      return `Bạn chưa nộp bài **"${title}"**. Paste code vào đây hoặc nộp bài để tôi debug giúp!\n\n**Các lỗi phổ biến với bài này:**\n${concepts.map(c => getCommonError(c)).filter(Boolean).map(e => `- ${e}`).join('\n')}`
    }
    
    if (analysis?.issues?.length) {
      const parts = [`**🐛 Phân tích lỗi trong code bài "${title}" của bạn:**\n`]
      analysis.issues.forEach((issue: string) => {
        parts.push(`**${issue}**`)
        if (issue.includes('while') && issue.includes('vô hạn')) {
          parts.push(`\`\`\`cpp\n// Code của bạn có thể bị:\nwhile (i <= n) {\n    // xử lý\n    // ❌ THIẾU: i++ hoặc i--\n}\n\n// ✅ Sửa lại:\nwhile (i <= n) {\n    // xử lý\n    i++;  // Nhớ cập nhật!\n}\n\`\`\``)
        }
        if (issue.includes('Off-by-one') || issue.includes('i <= n')) {
          parts.push(`\`\`\`cpp\n// ❌ Dễ bị off-by-one:\nfor (int i = 0; i <= n; i++) cin >> a[i];  // Truy xuất a[n] ngoài mảng!\n\n// ✅ Đúng:\nfor (int i = 0; i < n; i++) cin >> a[i];  // Chỉ số 0 đến n-1\n\`\`\``)
        }
        if (issue.includes('if') && issue.includes('độc lập')) {
          parts.push(`\`\`\`cpp\n// ❌ Code của bạn dùng if độc lập:\nif (diem >= 8) cout << "Gioi";\nif (diem >= 6.5) cout << "Kha";  // Cả 2 đều in nếu diem >= 8!\n\n// ✅ Dùng else-if:\nif (diem >= 8) cout << "Gioi";\nelse if (diem >= 6.5) cout << "Kha";\n\`\`\``)
        }
      })
      return parts.join('\n\n')
    }
    
    return `**🔍 Tôi đã xem code "${title}" của bạn** — không phát hiện lỗi nghiêm trọng rõ ràng.\n\n${analysis?.suggestions?.length ? `**Có thể cải thiện:**\n${analysis.suggestions.join('\n')}` : '**Code trông ổn!** Nếu vẫn lỗi, hãy mô tả cụ thể:\n- Bạn nhập gì?\n- Output mong muốn là gì?\n- Output thực tế là gì?'}`
  }

  // Hỏi về logic cụ thể trong code
  if (q.includes('tại sao') || q.includes('why') || q.includes('giải thích') || q.includes('explain') || q.includes('ý nghĩa') || q.includes('đoạn code')) {
    if (!hasCode) return `Bạn chưa nộp bài. Paste đoạn code bạn muốn giải thích vào đây!`
    
    return `**💬 Tôi đã đọc code "${title}" của bạn** (${analysis?.lines} dòng).\n\nĐể giải thích chính xác hơn, bạn có thể:\n1. **Paste đoạn code cụ thể** bạn muốn hiểu\n2. Hỏi về dòng cụ thể, ví dụ: "dòng 10 làm gì?"\n3. Hỏi về một khái niệm: "${concepts[0]}", "${concepts[1] || 'loops'}"\n\n${analysis?.issues?.length ? `\n⚠️ **Lưu ý:** Code của bạn có ${analysis.issues.length} vấn đề cần xem xét — dùng lệnh **"review code"** để xem chi tiết!` : ''}`
  }

  // Cải thiện code
  if (q.includes('cải thiện') || q.includes('tối ưu') || q.includes('improve') || q.includes('optimize') || q.includes('hay hơn') || q.includes('đẹp hơn')) {
    if (!hasCode) return `Nộp bài trước để tôi gợi ý cải thiện code cho bài **"${title}"**!`
    
    const parts = [`**✨ Gợi ý cải thiện Code "${title}" của bạn:**\n`]
    
    if (analysis?.suggestions?.length) {
      parts.push(...analysis.suggestions)
      parts.push('')
    }
    
    // Generic improvements based on concepts
    if (concepts.includes('I/O') && !studentCode?.includes('"')) {
      parts.push(`**Thêm prompt nhập liệu:**\n\`\`\`cpp\n// Thay vì:\ncin >> n;\n// Nên viết:\ncout << "Nhap so phan tu n: ";\ncin >> n;\n\`\`\``)
    }
    if (!studentCode?.includes('//') && (analysis?.lines || 0) > 8) {
      parts.push(`**Thêm comment:**\n\`\`\`cpp\n// === NHAP DU LIEU ===\ncin >> n;\n// === XU LY ===\nfor (int i = 0; i < n; i++) { ... }\n// === XUAT KET QUA ===\ncout << ketQua;\n\`\`\``)
    }
    
    return parts.join('\n')
  }

  // So sánh với code mẫu
  if (q.includes('so sánh') || q.includes('đáp án') || q.includes('mẫu') || q.includes('chuẩn') || q.includes('compare')) {
    if (!hasCode) return `Nộp bài trước rồi tôi so sánh với đáp án mẫu của bài **"${title}"**!`
    
    return `**📊 So sánh Code bài "${title}" của bạn:**\n\n${analysis?.issues?.length
      ? `Code bạn có **${analysis.issues.length} vấn đề** so với chuẩn:\n${analysis.issues.join('\n')}`
      : '**Code khá tốt!** Cấu trúc tương đương với đáp án mẫu.'
    }\n\n${analysis?.strengths?.length
      ? `**Điểm mạnh của bạn:**\n${analysis.strengths.join('\n')}`
      : ''
    }\n\n💡 *Tôi không hiển thị đáp án đầy đủ để bạn tự học — hãy thử fix lỗi trước!*`
  }

  // Hỏi có nộp bài chưa
  if (q.includes('nộp chưa') || q.includes('submission') || q.includes('đã nộp') || q.includes('kết quả')) {
    if (!hasCode) return `Bạn **chưa nộp** bài **"${title}"** hoặc chưa có submission nào. Hãy vào tab "📤 Nộp bài" để submit code!`
    return `Bạn **đã nộp** bài **"${title}"** — tôi đang đọc code submission mới nhất của bạn (${analysis?.lines} dòng).\n\nHỏi tôi: "review code", "debug lỗi", "cải thiện code" để tôi phân tích chi tiết!`
  }

  // ── Câu hỏi lý thuyết / kiến thức (có thêm context code) ────────────────

  const codeContext = hasCode
    ? `\n\n*📄 Đang xem code của bạn (${analysis?.lines} dòng) — hỏi "review code" để tôi phân tích!*`
    : `\n\n*📝 Bạn chưa nộp bài này — sau khi nộp tôi có thể phân tích code của bạn!*`

  // Về đề bài
  if (q.includes('đề bài') || q.includes('yêu cầu') || q.includes('bài tập này') || q.includes('làm gì')) {
    return `**📋 Yêu cầu bài "${title}":**\n\n${asgn?.description}\n\n**Khái niệm cần áp dụng:**\n${concepts.map(c => `- ⭐ **${c}**`).join('\n')}\n\n**Ngôn ngữ:** ${lang}${codeContext}`
  }

  // Gợi ý hướng làm
  if (q.includes('hướng') || q.includes('gợi ý') || q.includes('bắt đầu') || q.includes('làm thế nào') || q.includes('cách làm') || q.includes('hint')) {
    const steps = [
      `**📌 Hướng tiếp cận bài "${title}":**`,
      hasCode ? `\n*(Tôi đã đọc code của bạn — bạn đã ${analysis?.lines > 5 ? 'có code rồi' : 'mới bắt đầu'})*` : '',
      '',
      `**Bước 1:** Xác định Input/Output`,
      `- Nhập: gì? (số, mảng, chuỗi?)`,
      `- Xuất: kết quả gì?`,
      '',
      `**Bước 2:** Chọn cấu trúc — Bài này cần:`,
      ...concepts.slice(0, 3).map(c => `- **${c}**: ${getConceptHint(c)}`),
      '',
      `**Bước 3:** Code từng bước nhỏ → test từng phần`,
      '',
      `💡 *Paste code vào đây hoặc hỏi "review code" để tôi xem code hiện tại của bạn!*`,
    ]
    return steps.filter(s => s !== null).join('\n')
  }

  // Lý thuyết về biến
  if (q.includes('biến') || q.includes('khai báo') || q.includes('variable') || q.includes('kiểu dữ liệu')) {
    return `**📦 Khai báo biến trong ${lang}:**\n\n\`\`\`cpp\nint soNguyen = 10;\ndouble soThuc = 3.14;\nstring chuoi = "Hello";\nbool dungSai = true;\n\`\`\`\n\n${hasCode ? `**Trong code của bạn:** Tôi thấy bạn ${getCodeSnippetInfo(studentCode!, 'variables')}` : ''}${codeContext}`
  }

  // Lý thuyết vòng lặp
  if (q.includes('vòng lặp') || q.includes('for') || q.includes('while') || q.includes('lặp') || q.includes('loop')) {
    return `**🔄 Vòng lặp trong ${lang}:**\n\n\`\`\`cpp\n// FOR: dùng khi biết số lần lặp\nfor (int i = 0; i < n; i++) { /* ... */ }\n\n// WHILE: dùng khi không biết trước\nint i = 0;\nwhile (i < n) {\n    // ...\n    i++;  // ⚠️ PHẢI có! Nếu không → vô hạn\n}\n\`\`\`\n\n${hasCode && analysis?.issues?.some((i: string) => i.includes('while')) ? '**⚠️ Tôi phát hiện có thể bạn đang bị lỗi vòng lặp trong code! Dùng "debug lỗi" để xem chi tiết.**' : ''}${codeContext}`
  }

  // Lý thuyết mảng
  if (q.includes('mảng') || q.includes('array') || q.includes('phần tử') || q.includes('index')) {
    return `**📋 Mảng trong ${lang}:**\n\n\`\`\`cpp\nint a[100], n;\ncin >> n;\nfor (int i = 0; i < n; i++) cin >> a[i];   // i < n !\nfor (int i = 0; i < n; i++) cout << a[i];\n\`\`\`\n\n${hasCode && analysis?.issues?.some((i: string) => i.includes('Off-by-one')) ? '**⚠️ Code bạn có thể bị lỗi off-by-one! Dùng "debug lỗi" để xem.**' : ''}${codeContext}`
  }

  // Lý thuyết hàm
  if (q.includes('hàm') || q.includes('function') || q.includes('void') || q.includes('return')) {
    return `**⚙️ Hàm trong ${lang}:**\n\n\`\`\`cpp\n// Khai báo hàm TRƯỚC main()\nint tinhTong(int a[], int n) {\n    int s = 0;\n    for (int i = 0; i < n; i++) s += a[i];\n    return s;\n}\n\nint main() {\n    int a[100], n;\n    cin >> n;\n    for (int i = 0; i < n; i++) cin >> a[i];\n    cout << tinhTong(a, n);  // Gọi hàm\n    return 0;\n}\n\`\`\`\n${codeContext}`
  }

  // Lý thuyết đệ quy
  if (q.includes('đệ quy') || q.includes('recursion') || q.includes('giai thừa') || q.includes('base case')) {
    return `**🔁 Đệ quy = Hàm gọi lại chính mình:**\n\n\`\`\`cpp\nlong long giaiThua(int n) {\n    if (n == 0 || n == 1) return 1;  // BASE CASE — Bắt buộc!\n    return n * giaiThua(n - 1);      // Recursive call\n}\n\`\`\`\n\n${hasCode && analysis?.issues?.some((i: string) => i.includes('base case')) ? '**⚠️ Code của bạn có thể thiếu base case! Kiểm tra ngay!**' : ''}${codeContext}`
  }

  // Sắp xếp
  if (q.includes('sắp xếp') || q.includes('sort') || q.includes('tăng dần') || q.includes('giảm dần')) {
    return `**🔢 Sắp xếp mảng trong ${lang}:**\n\n\`\`\`cpp\nvoid sapXep(int a[], int n) {\n    for (int i = 0; i < n - 1; i++)\n        for (int j = i + 1; j < n; j++)\n            if (a[i] > a[j]) {        // Đổi dấu để sắp xếp giảm dần\n                int t = a[i];\n                a[i] = a[j];\n                a[j] = t;\n            }\n}\n\`\`\`\n${codeContext}`
  }

  // Nhập/xuất
  if (q.includes('nhập') || q.includes('xuất') || q.includes('cin') || q.includes('cout') || q.includes('in ra')) {
    return `**🖥️ Nhập/Xuất trong ${lang}:**\n\n\`\`\`cpp\n#include <iostream>\nusing namespace std;\nint main() {\n    double x;\n    cout << "Nhap x: ";  // Thông báo trước khi nhập\n    cin >> x;\n    cout << "Ket qua: " << x * 2 << endl;\n    return 0;\n}\n\`\`\`\n${codeContext}`
  }

  // Paste code để phân tích
  if (q.includes('```') || q.includes('#include') || q.includes('int main') || q.includes('void ')) {
    // User pasted code in the chat
    const pastedCode = question
    const pastedAnalysis = analyzeStudentCode(pastedCode, concepts)
    if (pastedAnalysis) {
      const parts = [`**🔍 Phân tích Code bạn vừa paste:**\n`]
      if (pastedAnalysis.strengths.length) parts.push(`**Tốt:**\n${pastedAnalysis.strengths.join('\n')}`)
      if (pastedAnalysis.issues.length) parts.push(`**Cần sửa:**\n${pastedAnalysis.issues.join('\n')}`)
      if (pastedAnalysis.suggestions.length) parts.push(`**Gợi ý:**\n${pastedAnalysis.suggestions.join('\n')}`)
      if (!pastedAnalysis.issues.length) parts.push('✅ Không phát hiện lỗi rõ ràng trong đoạn code này!')
      return parts.join('\n\n')
    }
  }

  // Default
  const codeStatus = hasCode
    ? `📄 **Code của bạn (${analysis?.lines} dòng):** ${analysis?.issues?.length ? `Có ${analysis.issues.length} vấn đề cần xem` : 'Trông ổn!'}\n\n`
    : ''

  return `${codeStatus}Bạn hỏi về **"${question}"** trong bài **"${title}"**.\n\nTôi có thể giúp bạn:\n- **"review code"** — Xem xét code bạn đã nộp\n- **"debug lỗi"** — Tìm lỗi cụ thể trong code\n- **"cải thiện code"** — Gợi ý nâng cao chất lượng\n- **"gợi ý hướng làm"** — Hướng tiếp cận bài\n- Hoặc **paste code** vào đây để tôi phân tích!\n\n**Khái niệm bài:** ${concepts.join(' · ')}`
}

function getCommonError(concept: string): string {
  const map: Record<string, string> = {
    'Loops': 'Vòng lặp vô hạn (thiếu i++ trong while)',
    'Arrays': 'Off-by-one (dùng i<=n thay vì i<n)',
    'Conditionals': 'Dùng nhiều if độc lập thay vì if-else if',
    'Recursion': 'Thiếu base case → Stack Overflow',
    'Functions': 'Quên khai báo hàm trước main()',
    'I/O': 'Thiếu cout trước cin để thông báo nhập',
  }
  return map[concept] || ''
}

function getConceptHint(concept: string): string {
  const map: Record<string, string> = {
    'Variables': 'Khai báo biến đúng kiểu (int, double, string...)',
    'I/O': 'cin để nhập, cout để xuất',
    'Conditionals': 'if-else if chain cho nhiều trường hợp loại trừ nhau',
    'Boolean Logic': '&&, ||, ! để kết hợp điều kiện',
    'Loops': 'for loop khi biết số lần, while khi không biết',
    'Nested Loops': 'Vòng lặp lồng nhau để in hình / xử lý 2D',
    'Arrays': 'int a[100], chỉ số từ 0 đến n-1',
    'Functions': 'Khai báo trước main(), gọi trong main()',
    'Recursion': 'Base case + recursive case',
    'Sorting Algorithm': 'Vòng lặp lồng + biến tạm để hoán vị',
  }
  return map[concept] || 'Xem tài liệu'
}

function getCodeSnippetInfo(code: string, type: string): string {
  if (type === 'variables') {
    const vars = [...(code.match(/(?:int|double|float|string|bool|char)\s+(\w+)/g) || [])]
      .slice(0, 3).map(v => v.split(/\s+/).pop())
    return vars.length > 0 ? `khai báo biến: \`${vars.join(', ')}\`` : 'có khai báo biến'
  }
  return ''
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const asgnIdParam = searchParams.get('asgnId')

  const [asgns, setAsgns] = useState<any[]>([])
  const [selAsgn, setSelAsgn] = useState<any>(null)
  const [studentCode, setStudentCode] = useState<string | null>(null)
  const [latestSub, setLatestSub] = useState<any>(null)
  const [loadingCode, setLoadingCode] = useState(false)
  const [loadingAsgns, setLoadingAsgns] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showCodePreview, setShowCodePreview] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { loadAssignments() }, [])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadAssignments() {
    try {
      const rooms = await classrooms.list()
      if (!rooms.length) { setLoadingAsgns(false); return }
      const asgnList = await assignments.byClassroom(rooms[0].id)
      setAsgns(asgnList)
      let picked = asgnList.find((a: any) => String(a.id) === asgnIdParam)
        || asgnList.find((a: any) => a.status === 'open')
        || asgnList[asgnList.length - 1]
      if (picked) await selectAssignment(picked)
    } catch { }
    finally { setLoadingAsgns(false) }
  }

  async function selectAssignment(asgn: any) {
    setSelAsgn(asgn)
    setStudentCode(null)
    setLatestSub(null)
    setShowCodePreview(false)
    setLoadingCode(true)

    // Tải code submission mới nhất của sinh viên
    let code: string | null = null
    let sub: any = null
    try {
      const subs = await submissions.my(asgn.id)
      if (subs?.length) {
        sub = subs[0] // Mới nhất
        code = sub.code || null
      }
    } catch { }
    finally {
      setStudentCode(code)
      setLatestSub(sub)
      setLoadingCode(false)
    }

    // ── Storm v4: Load lịch sử chat từ DB ───────────────────────────────
    try {
      const dbMessages = await chats.getMessages(asgn.id)
      if (dbMessages && dbMessages.length > 0) {
        // Có lịch sử → restore từ DB
        setMessages(dbMessages.map((m: any) => ({
          id: String(m.id),
          role: m.sender === 'student' ? 'user' : 'assistant',
          content: m.content,
          timestamp: new Date(m.sent_at),
        })))
        return // Không cần greeting mới
      }
    } catch { }

    const hasCode = code && code.trim().length > 10
    const analysis = hasCode ? analyzeStudentCode(code!, asgn.concepts || []) : null

    const greetingContent = buildGreeting(user?.name, asgn, hasCode, sub, analysis)
    const greeting: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: greetingContent,
      timestamp: new Date(),
    }
    setMessages([greeting])
    // Lưu greeting vào DB
    try { await chats.sendMessage(asgn.id, greetingContent, 'ai') } catch { }
  }

  function buildGreeting(name: string | undefined, asgn: any, hasCode: boolean, sub: any, analysis: any): string {
    const firstName = name?.split(' ').pop() || 'bạn'
    const concepts: string[] = asgn?.concepts || []

    if (hasCode) {
      const issueCount = analysis?.issues?.length || 0
      const strengthCount = analysis?.strengths?.length || 0
      return `Xin chào **${firstName}**! 👋 Tôi đã đọc xong code bài **"${asgn.title}"** của bạn.\n\n**📊 Tổng quan nhanh:**\n- 📄 ${analysis?.lines} dòng code | Lần nộp #${sub?.attempt_number || 1}\n- 🏆 Điểm: **${sub?.score_total || 0}/100** (${sub?.status || 'pending'})\n- ✅ ${strengthCount} điểm tốt${issueCount > 0 ? ` | ⚠️ ${issueCount} vấn đề cần xem` : ' | Không phát hiện lỗi'}\n\nBạn có thể hỏi tôi:\n- **"review code"** — Phân tích chi tiết code của bạn\n- **"debug lỗi"** — Tìm và giải thích lỗi\n- **"cải thiện code"** — Gợi ý nâng cao chất lượng\n- Hoặc bất kỳ câu hỏi nào về bài học 🚀`
    }

    return `Xin chào **${firstName}**! 👋 Tôi là AI trợ giảng cho bài:\n\n> 📋 **${asgn.title}**\n\n**Khái niệm:** ${concepts.map((c: string) => `⭐ ${c}`).join(' · ')}\n\n📭 **Bạn chưa nộp bài này.** Sau khi nộp code, tôi sẽ đọc và phân tích giúp bạn!\n\nNgay bây giờ tôi vẫn có thể giúp: giải thích lý thuyết, gợi ý hướng tiếp cận, hoặc bạn có thể **paste code** vào đây để tôi xem thử 🚀`
  }

  const analysis = selAsgn && studentCode
    ? analyzeStudentCode(studentCode, selAsgn?.concepts || [])
    : null

  const SUGGESTED_WITH_CODE = selAsgn && studentCode ? [
    '📋 Review toàn bộ code của tôi',
    '🐛 Debug lỗi trong code',
    '✨ Gợi ý cải thiện code',
    '📊 So sánh code với đáp án mẫu',
    '💡 Gợi ý hướng tiếp cận',
    '📖 Giải thích đề bài',
  ] : [
    '📖 Giải thích đề bài',
    '💡 Gợi ý hướng tiếp cận',
    '📝 Cách khai báo biến',
    '🔄 Hướng dẫn vòng lặp',
    '⚙️ Cách viết hàm',
    '🐛 Lỗi thường gặp của bài này',
  ]

  const sendMessage = async (text: string) => {
    if (!text.trim() || !selAsgn) return
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)
    await new Promise(r => setTimeout(r, 700 + Math.random() * 500))

    // Nếu user paste code trong chat → phân tích code đó
    let codeToAnalyze = studentCode
    let analysisToUse = analysis
    if (text.includes('#include') || text.includes('int main') || text.includes('void ')) {
      codeToAnalyze = text
      analysisToUse = analyzeStudentCode(text, selAsgn?.concepts || [])
    }

    const response = getAIResponse(text, selAsgn, codeToAnalyze, analysisToUse)
    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, aiMsg])
    setIsTyping(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const hasCode = studentCode && studentCode.trim().length > 10

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg0)' }}>
      {/* ── Nav ── */}
      <nav className="nav">
        <div className="nav-brand">
          <div className="nav-logo" style={{ fontFamily: 'var(--display)', fontWeight: 900 }}>🔬</div>
          <span style={{ fontFamily: 'var(--display)' }}>
            NEU-CodeLens <span style={{ color: 'var(--t3)', fontWeight: 400, fontSize: '.85rem' }}>AI Trợ giảng</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {hasCode && (
            <span className="badge bdg" style={{ fontSize: '.65rem' }}>
              <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'var(--gn)', boxShadow: '0 0 4px var(--gn)', marginRight: 4 }} />
              Đã đọc code của bạn
            </span>
          )}
          <div style={{ fontSize: '.72rem', color: 'var(--t3)' }}>
            Understand-Anything Engine · {selAsgn?.lang || 'C++'}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/student')}>← Về Dashboard</button>
        </div>
      </nav>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ── Sidebar ── */}
        <div style={{
          width: '290px', flexShrink: 0,
          background: 'var(--bg1)',
          borderRight: '1px solid var(--b1)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Assignment list */}
          <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid var(--b1)', flexShrink: 0 }}>
            <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '9px' }}>
              📋 Chọn Bài tập
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {loadingAsgns ? (
                <div style={{ color: 'var(--t3)', fontSize: '.78rem', textAlign: 'center', padding: '10px' }}>⏳ Đang tải...</div>
              ) : asgns.map(a => (
                <button
                  key={a.id}
                  onClick={() => selectAssignment(a)}
                  style={{
                    textAlign: 'left', padding: '9px 10px',
                    lineHeight: 1.4, fontSize: '.77rem', height: 'auto', whiteSpace: 'normal',
                    background: selAsgn?.id === a.id ? 'var(--rg2)' : 'var(--glass2)',
                    border: `1px solid ${selAsgn?.id === a.id ? 'var(--rg)' : 'var(--b1)'}`,
                    borderRadius: 'var(--r8)',
                    color: selAsgn?.id === a.id ? 'var(--rl)' : 'var(--t2)',
                    cursor: 'pointer',
                    transition: 'all var(--t-fast)',
                    fontFamily: 'var(--sans)',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</span>
                  </div>
                  <div style={{ fontSize: '.67rem', opacity: .7 }}>{(a.concepts || []).slice(0, 2).join(' · ')}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Code status & preview */}
          {selAsgn && (
            <div style={{ padding: '12px', borderBottom: '1px solid var(--b1)', flexShrink: 0 }}>
              {loadingCode ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.75rem', color: 'var(--t3)' }}>
                  <span className="spin" style={{ width: 12, height: 12, borderWidth: 2 }} />
                  Đang tải code của bạn...
                </div>
              ) : hasCode ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--gn)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gn)', boxShadow: '0 0 5px var(--gn)', display: 'inline-block' }} />
                      Code đã nộp — {analysis?.lines} dòng
                    </div>
                    <button
                      onClick={() => setShowCodePreview(v => !v)}
                      style={{
                        fontSize: '.65rem', padding: '2px 8px',
                        background: 'var(--bg3)', border: '1px solid var(--b2)',
                        borderRadius: 'var(--rpill)', color: 'var(--t3)',
                        cursor: 'pointer', fontFamily: 'var(--sans)',
                      }}
                    >
                      {showCodePreview ? 'Thu gọn' : 'Xem code'}
                    </button>
                  </div>

                  {/* Score badge */}
                  {latestSub && (
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      <span className={`badge ${latestSub.status === 'passed' ? 'bdg' : latestSub.status === 'failed' ? 'bdr' : 'bdy'}`} style={{ fontSize: '.62rem' }}>
                        {latestSub.status === 'passed' ? '✅' : latestSub.status === 'failed' ? '❌' : '⚠️'} {latestSub.score_total || 0}/100
                      </span>
                      <span className="badge bdn" style={{ fontSize: '.62rem' }}>Lần #{latestSub.attempt_number}</span>
                    </div>
                  )}

                  {/* Quick analysis */}
                  {analysis?.issues?.length ? (
                    <div style={{ background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 'var(--r8)', padding: '7px 9px' }}>
                      <div style={{ fontSize: '.65rem', fontWeight: 700, color: '#f87171', marginBottom: '4px' }}>⚠️ {analysis.issues.length} vấn đề phát hiện</div>
                      <div style={{ fontSize: '.63rem', color: 'var(--t2)', lineHeight: 1.5 }}>{analysis.issues[0].replace('🔴 NGUY HIỂM: ', '').replace('⚠️ ', '').substring(0, 70)}...</div>
                    </div>
                  ) : (
                    <div style={{ background: 'rgba(52,211,153,.06)', border: '1px solid rgba(52,211,153,.15)', borderRadius: 'var(--r8)', padding: '7px 9px' }}>
                      <div style={{ fontSize: '.65rem', color: '#34d399' }}>✅ Không phát hiện lỗi rõ ràng</div>
                    </div>
                  )}

                  {/* Code preview */}
                  {showCodePreview && (
                    <div style={{
                      marginTop: '8px',
                      maxHeight: '180px', overflowY: 'auto',
                      background: 'var(--bg0)',
                      border: '1px solid var(--b2)',
                      borderRadius: 'var(--r8)',
                      padding: '8px',
                    }}>
                      <pre style={{ fontFamily: 'var(--mono)', fontSize: '.65rem', color: '#cdd6f4', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {studentCode}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 'var(--r8)', padding: '9px 10px' }}>
                  <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--bl)', marginBottom: '3px' }}>📭 Chưa nộp bài này</div>
                  <div style={{ fontSize: '.63rem', color: 'var(--t3)', lineHeight: 1.5 }}>Sau khi nộp, tôi sẽ đọc và phân tích code của bạn tự động</div>
                </div>
              )}
            </div>
          )}

          {/* Suggested questions */}
          <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
            <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>
              💡 Hỏi nhanh
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {SUGGESTED_WITH_CODE.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q.replace(/^[^\s]+ /, ''))}
                  disabled={!selAsgn || isTyping}
                  style={{
                    textAlign: 'left', padding: '8px 10px',
                    lineHeight: 1.45, fontSize: '.77rem', height: 'auto', whiteSpace: 'normal',
                    background: 'var(--glass2)',
                    border: '1px solid var(--b1)',
                    borderRadius: 'var(--r8)',
                    color: 'var(--t2)',
                    cursor: 'pointer',
                    transition: 'all var(--t-fast)',
                    fontFamily: 'var(--sans)',
                    opacity: (!selAsgn || isTyping) ? 0.5 : 1,
                  }}
                  onMouseEnter={e => {
                    if (!selAsgn || isTyping) return
                    e.currentTarget.style.background = 'var(--glass3)'
                    e.currentTarget.style.borderColor = 'var(--rg)'
                    e.currentTarget.style.color = 'var(--t1)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--glass2)'
                    e.currentTarget.style.borderColor = 'var(--b1)'
                    e.currentTarget.style.color = 'var(--t2)'
                  }}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Concept tags */}
            {selAsgn && (selAsgn.concepts || []).length > 0 && (
              <div style={{ marginTop: '12px', padding: '10px', background: 'var(--bg3)', borderRadius: 'var(--r10)', border: '1px solid var(--b1)' }}>
                <div style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--t3)', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  🎯 Khái niệm
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {(selAsgn.concepts || []).map((c: string) => (
                    <span
                      key={c}
                      className="badge bdp"
                      style={{ fontSize: '.6rem', cursor: 'pointer' }}
                      onClick={() => sendMessage(`Giải thích khái niệm ${c}`)}
                    >
                      ⭐ {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Chat area ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg0)' }}>
          {/* Header */}
          {selAsgn && (
            <div style={{
              padding: '10px 20px',
              background: 'var(--bg1)',
              borderBottom: '1px solid var(--b1)',
              display: 'flex', alignItems: 'center', gap: '12px',
              flexShrink: 0,
            }}>
              <div style={{
                width: 34, height: 34,
                background: hasCode
                  ? 'linear-gradient(135deg, var(--gn), hsl(158,60%,32%))'
                  : 'linear-gradient(135deg, var(--r), var(--rd))',
                borderRadius: 'var(--r8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '15px', flexShrink: 0,
                boxShadow: hasCode ? '0 0 12px rgba(52,211,153,.3)' : '0 0 12px var(--rg2)',
              }}>
                {hasCode ? '🔍' : '🧠'}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '.88rem', fontFamily: 'var(--display)' }}>
                  {hasCode ? `Đang phân tích code bài "${selAsgn.title}"` : `Trợ giảng AI — ${selAsgn.title}`}
                </div>
                <div style={{ fontSize: '.7rem', color: 'var(--t3)', marginTop: '1px' }}>
                  {hasCode
                    ? `${analysis?.lines} dòng · ${analysis?.issues?.length || 0} vấn đề · ${analysis?.strengths?.length || 0} điểm tốt`
                    : `${(selAsgn.concepts || []).join(' · ')} · ${selAsgn.lang || 'C++'}`
                  }
                </div>
              </div>
              {hasCode && latestSub && (
                <div style={{ marginLeft: 'auto' }}>
                  <span className={`badge ${latestSub.status === 'passed' ? 'bdg' : latestSub.status === 'failed' ? 'bdr' : 'bdy'}`}>
                    {latestSub.status === 'passed' ? '✅' : latestSub.status === 'failed' ? '❌' : '⚠️'} {latestSub.score_total || 0}/100
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!selAsgn && !loadingAsgns && (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--t3)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📋</div>
                <div style={{ fontWeight: 600, fontFamily: 'var(--display)' }}>Chọn bài tập để bắt đầu</div>
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  gap: '10px',
                  alignItems: 'flex-end',
                  animation: 'fadeInUp .2s ease both',
                }}
              >
                {msg.role === 'assistant' && (
                  <div style={{
                    width: 32, height: 32,
                    background: 'linear-gradient(135deg, var(--r), var(--rd))',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 900, color: '#fff',
                    flexShrink: 0,
                    boxShadow: '0 0 12px var(--rg2)',
                    fontFamily: 'var(--display)',
                  }}>N</div>
                )}
                <div style={{ maxWidth: msg.role === 'user' ? '65%' : '78%', minWidth: 0 }}>
                  <div
                    className={msg.role === 'user' ? 'bubble-user' : 'bubble-ai'}
                    style={{ wordBreak: 'break-word' }}
                    dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                  />
                  <div style={{
                    fontSize: '.64rem', color: 'var(--t4)', marginTop: '3px',
                    textAlign: msg.role === 'user' ? 'right' : 'left',
                  }}>
                    {msg.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div style={{
                    width: 32, height: 32,
                    background: 'linear-gradient(135deg, var(--bl), hsl(213,80%,50%))',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, color: '#fff',
                    flexShrink: 0,
                  }}>
                    {user?.name?.split(' ').pop()?.[0]?.toUpperCase() || 'SV'}
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', animation: 'fadeInUp .2s ease both' }}>
                <div style={{
                  width: 32, height: 32,
                  background: 'linear-gradient(135deg, var(--r), var(--rd))',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 900, color: '#fff',
                  fontFamily: 'var(--display)',
                }}>N</div>
                <div className="bubble-ai" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div style={{
            padding: '12px 20px 16px',
            background: 'rgba(6,8,16,.95)',
            borderTop: '1px solid var(--b1)',
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex', gap: '10px', alignItems: 'flex-end',
              background: 'var(--bg3)',
              border: '1px solid var(--b2)',
              borderRadius: 'var(--r14)',
              padding: '10px 14px',
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!selAsgn}
                placeholder={
                  selAsgn
                    ? hasCode
                      ? `Hỏi về code bài "${selAsgn.title}"... hoặc paste code để tôi phân tích (Enter gửi)`
                      : `Hỏi về bài "${selAsgn.title}"... hoặc paste code vào đây (Enter gửi)`
                    : 'Chọn bài tập để bắt đầu...'
                }
                rows={1}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  color: 'var(--t1)',
                  fontSize: '.9rem',
                  fontFamily: 'var(--sans)',
                  lineHeight: 1.6,
                  maxHeight: '200px',
                }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
                }}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isTyping || !selAsgn}
                style={{ flexShrink: 0, borderRadius: 'var(--r10)', padding: '8px 16px' }}
              >
                Gửi →
              </button>
            </div>
            <div style={{ fontSize: '.66rem', color: 'var(--t4)', marginTop: '6px', textAlign: 'center' }}>
              🧠 AI đọc code thật của bạn · Bạn cũng có thể paste code vào đây để phân tích · Understand-Anything Engine
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatMessage(content: string): string {
  return content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)/gm, '<blockquote style="border-left:3px solid var(--rg);padding:6px 12px;margin:6px 0;background:var(--rg2);border-radius:0 var(--r8) var(--r8) 0;color:var(--t1)">$1</blockquote>')
    .replace(/`([^`]+)`/g, `<code style="background:rgba(255,255,255,0.08);padding:2px 7px;border-radius:5px;font-family:var(--mono);font-size:.85em;color:var(--rl)">$1</code>`)
    .replace(/```[\w]*\n?([\s\S]+?)```/g, `<pre style="background:var(--bg0);border:1px solid var(--b2);padding:12px 14px;border-radius:9px;margin:10px 0;font-family:var(--mono);font-size:.78em;overflow-x:auto;color:#cdd6f4;line-height:1.7;white-space:pre">$1</pre>`)
    .replace(/\n/g, '<br />')
}
