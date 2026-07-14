import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import {
  BookOpen,
  Award,
  AlertTriangle,
  TrendingUp,
  User,
  Clock,
  Code2,
  Play,
  RotateCcw,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Brain,
  ShieldAlert
} from 'lucide-react'

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface SessionProgress {
  sessionId: number
  sessionName: string
  status: 'passed' | 'failed' | 'warning' | 'pending'
  score: number
  codeSnippet: string
  attempts: number
  misconceptions: string[]
  llmFeedback: string
  submittedAt: string
}

interface Student {
  id: string
  name: string
  mssv: string
  profileType: 'advanced' | 'on-track' | 'at-risk' | 'warning'
  overallScore: number
  conceptMastery: {
    variables: number
    conditionals: number
    loops: number
    arrays: number
    functions: number
  }
  progress: SessionProgress[]
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const INITIAL_STUDENTS: Student[] = [
  {
    id: 'std-1',
    name: 'Nguyễn Văn An',
    mssv: '11201234',
    profileType: 'advanced',
    overallScore: 92,
    conceptMastery: { variables: 95, conditionals: 90, loops: 92, arrays: 90, functions: 94 },
    progress: [
      {
        sessionId: 1,
        sessionName: 'Buổi 1: Biến & Nhập xuất',
        status: 'passed',
        score: 95,
        codeSnippet: `// Buổi 1: Tính diện tích hình tròn\n#include <iostream>\nusing namespace std;\n\nint main() {\n    double r;\n    cout << "Nhập bán kính: ";\n    cin >> r;\n    double s = 3.14 * r * r;\n    cout << "Diện tích: " << s;\n    return 0;\n}`,
        attempts: 1,
        misconceptions: [],
        llmFeedback: 'Bài làm rất tốt. Code sạch đẹp, đặt tên biến rõ ràng. Đã hiểu đúng cơ chế nhập xuất.',
        submittedAt: '2026-06-01T08:30:00Z'
      },
      {
        sessionId: 2,
        sessionName: 'Buổi 2: Câu lệnh Rẽ nhánh',
        status: 'passed',
        score: 90,
        codeSnippet: `// Buổi 2: Tìm năm nhuận\n#include <iostream>\nusing namespace std;\n\nint main() {\n    int year;\n    cin >> year;\n    if ((year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)) {\n        cout << year << " là năm nhuận";\n    } else {\n        cout << year << " không là năm nhuận";\n    }\n    return 0;\n}`,
        attempts: 2,
        misconceptions: [],
        llmFeedback: 'Logic rẽ nhánh chính xác, biểu thức điều kiện tối ưu và sử dụng các toán tử logic hợp lý.',
        submittedAt: '2026-06-03T09:15:00Z'
      },
      {
        sessionId: 3,
        sessionName: 'Buổi 3: Vòng lặp',
        status: 'passed',
        score: 92,
        codeSnippet: `// Buổi 3: In hình tam giác sao vuông\n#include <iostream>\nusing namespace std;\n\nint main() {\n    int n;\n    cin >> n;\n    for (int i = 1; i <= n; i++) {\n        for (int j = 1; j <= i; j++) {\n            cout << "* ";\n        }\n        cout << "\\n";\n    }\n    return 0;\n}`,
        attempts: 1,
        misconceptions: [],
        llmFeedback: 'Khống chế tốt hai vòng lặp lồng nhau. Sử dụng biến đếm i, j rất chuẩn xác.',
        submittedAt: '2026-06-05T08:45:00Z'
      },
      {
        sessionId: 4,
        sessionName: 'Buổi 4: Mảng/Danh sách',
        status: 'passed',
        score: 90,
        codeSnippet: `// Buổi 4: Tìm Max Min trong mảng\n#include <iostream>\nusing namespace std;\n\nint main() {\n    int n;\n    cin >> n;\n    int a[100];\n    for (int i = 0; i < n; i++) cin >> a[i];\n    int maxVal = a[0], minVal = a[0];\n    for (int i = 1; i < n; i++) {\n        if (a[i] > maxVal) maxVal = a[i];\n        if (a[i] < minVal) minVal = a[i];\n    }\n    cout << "Max: " << maxVal << ", Min: " << minVal;\n    return 0;\n}`,
        attempts: 1,
        misconceptions: [],
        llmFeedback: 'Duyệt mảng chính xác. Khởi tạo giá trị maxVal, minVal bằng phần tử đầu mảng là cách xử lý tốt nhất để tránh lỗi ngoài biên.',
        submittedAt: '2026-06-08T10:00:00Z'
      },
      {
        sessionId: 5,
        sessionName: 'Buổi 5: Hàm',
        status: 'passed',
        score: 94,
        codeSnippet: `// Buổi 5: Tính giai thừa dùng hàm đệ quy\n#include <iostream>\nusing namespace std;\n\nlong long tinhGiaiThua(int n) {\n    if (n == 0 || n == 1) return 1;\n    return n * tinhGiaiThua(n - 1);\n}\n\nint main() {\n    int n;\n    cin >> n;\n    cout << tinhGiaiThua(n);\n    return 0;\n}`,
        attempts: 2,
        misconceptions: [],
        llmFeedback: 'Hàm đệ quy cấu trúc chuẩn, điều kiện dừng (base case) chính xác. Code mô-đun hóa tốt.',
        submittedAt: '2026-06-10T14:20:00Z'
      }
    ]
  },
  {
    id: 'std-2',
    name: 'Lê Minh Tuấn',
    mssv: '11204567',
    profileType: 'at-risk',
    overallScore: 48,
    conceptMastery: { variables: 75, conditionals: 60, loops: 35, arrays: 10, functions: 0 },
    progress: [
      {
        sessionId: 1,
        sessionName: 'Buổi 1: Biến & Nhập xuất',
        status: 'passed',
        score: 75,
        codeSnippet: `// Buổi 1: Tính diện tích\n#include <iostream>\nusing namespace std;\nint main() {\n    int a, b;\n    cin >> a >> b;\n    int s = a * b;\n    cout << s;\n    return 0;\n}`,
        attempts: 2,
        misconceptions: [],
        llmFeedback: 'Đã hoàn thành. Tuy nhiên nên viết thêm gợi ý nhập cho người dùng.',
        submittedAt: '2026-06-01T09:12:00Z'
      },
      {
        sessionId: 2,
        sessionName: 'Buổi 2: Câu lệnh Rẽ nhánh',
        status: 'passed',
        score: 60,
        codeSnippet: `// Buổi 2: Đánh giá điểm thi\n#include <iostream>\nusing namespace std;\nint main() {\n    double diem;\n    cin >> diem;\n    if (diem >= 8) cout << "GIOI";\n    if (diem >= 6.5) cout << "KHA"; // Thiếu check chặn trên\n    if (diem >= 5) cout << "TB";\n    else cout << "YEU";\n    return 0;\n}`,
        attempts: 5,
        misconceptions: ['Thiếu cấu trúc else-if khiến in ra nhiều kết quả trùng lắp (diem = 9 in ra cả GIOI, KHA, TB)'],
        llmFeedback: 'Sinh viên đang dùng nhiều câu lệnh if độc lập thay vì if-else chain. Điều này làm cho chương trình kiểm tra nhiều điều kiện sai cùng lúc.',
        submittedAt: '2026-06-03T10:45:00Z'
      },
      {
        sessionId: 3,
        sessionName: 'Buổi 3: Vòng lặp',
        status: 'failed',
        score: 35,
        codeSnippet: `// Buổi 3: Tính tổng số từ 1 đến N\n#include <iostream>\nusing namespace std;\nint main() {\n    int n;\n    cin >> n;\n    int i = 1;\n    int tong = 0;\n    while (i <= n) {\n        tong = tong + i;\n        // Quên tăng i khiến lặp vô hạn\n    }\n    cout << tong;\n    return 0;\n}`,
        attempts: 18,
        misconceptions: ['Lặp vô hạn (Infinite loop) do không tăng biến đếm', 'Không hiểu cách cập nhật điều kiện dừng'],
        llmFeedback: 'Sinh viên quên cập nhật biến lặp `i` bên trong thân vòng lặp `while`. Gặp khó khăn nghiêm trọng trong việc chuyển đổi từ tư duy tuần tự sang tư duy vòng lặp.',
        submittedAt: '2026-06-06T15:30:00Z'
      },
      {
        sessionId: 4,
        sessionName: 'Buổi 4: Mảng/Danh sách',
        status: 'pending',
        score: 10,
        codeSnippet: `// Buổi 4: Nhập mảng\n#include <iostream>\nusing namespace std;\nint main() {\n    int n;\n    cin >> n;\n    int a[10];\n    for(int i=0; i<=n; i++) { // Lỗi tràn mảng nếu n > 10 và lỗi index out of bounds khi i == n\n        cin >> a[i];\n    }\n}`,
        attempts: 6,
        misconceptions: ['Lỗi tràn bộ đệm mảng tĩnh', 'Lỗi Off-by-one (chỉ mục chạy đến <= n thay vì < n)'],
        llmFeedback: 'Sinh viên bị kẹt nghiêm trọng. Chưa nắm được quy tắc khai báo kích thước mảng tĩnh và chỉ mục bắt đầu từ 0 của C++.',
        submittedAt: '2026-06-09T09:30:00Z'
      },
      {
        sessionId: 5,
        sessionName: 'Buổi 5: Hàm',
        status: 'pending',
        score: 0,
        codeSnippet: ``,
        attempts: 0,
        misconceptions: ['Chưa nộp bài'],
        llmFeedback: 'Học sinh chưa hoàn thành nộp bài. Có dấu hiệu buông xuôi do bị kẹt từ bài tập vòng lặp và mảng.',
        submittedAt: ''
      }
    ]
  },
  {
    id: 'std-3',
    name: 'Trần Thị Bình',
    mssv: '11202345',
    profileType: 'on-track',
    overallScore: 78,
    conceptMastery: { variables: 90, conditionals: 85, loops: 75, arrays: 70, functions: 72 },
    progress: [
      {
        sessionId: 1,
        sessionName: 'Buổi 1: Biến & Nhập xuất',
        status: 'passed',
        score: 90,
        codeSnippet: `// Buổi 1: Tính diện tích HCN\n#include <iostream>\nusing namespace std;\nint main() {\n    double d, r;\n    cout << "Dai: "; cin >> d;\n    cout << "Rong: "; cin >> r;\n    cout << "S: " << d * r;\n    return 0;\n}`,
        attempts: 1,
        misconceptions: [],
        llmFeedback: 'Tốt. Code chạy đúng, định dạng rõ ràng.',
        submittedAt: '2026-06-01T08:45:00Z'
      },
      {
        sessionId: 2,
        sessionName: 'Buổi 2: Câu lệnh Rẽ nhánh',
        status: 'passed',
        score: 85,
        codeSnippet: `// Buổi 2: Kiểm tra số chẵn lẻ\n#include <iostream>\nusing namespace std;\nint main() {\n    int n;\n    cin >> n;\n    if (n % 2 == 0) {\n        cout << n << " chan";\n    } else {\n        cout << n << " le";\n    }\n    return 0;\n}`,
        attempts: 1,
        misconceptions: [],
        llmFeedback: 'Bài làm đạt yêu cầu. Tư duy logic rẽ nhánh đơn giản rất tốt.',
        submittedAt: '2026-06-03T09:20:00Z'
      },
      {
        sessionId: 3,
        sessionName: 'Buổi 3: Vòng lặp',
        status: 'passed',
        score: 75,
        codeSnippet: `// Buổi 3: In bảng cửu chương 2\n#include <iostream>\nusing namespace std;\nint main() {\n    for (int i = 1; i <= 10; i++) {\n        cout << "2 x " << i << " = " << 2*i << endl;\n    }\n    return 0;\n}`,
        attempts: 3,
        misconceptions: [],
        llmFeedback: 'Bài làm đúng. Đã bắt đầu hiểu vòng lặp đơn. Khuyến khích viết code lồng nhau ở các buổi sau.',
        submittedAt: '2026-06-05T09:10:00Z'
      },
      {
        sessionId: 4,
        sessionName: 'Buổi 4: Mảng/Danh sách',
        status: 'passed',
        score: 70,
        codeSnippet: `// Buổi 4: Tính tổng mảng\n#include <iostream>\nusing namespace std;\nint main() {\n    int n;\n    cin >> n;\n    int a[100];\n    for (int i = 0; i < n; i++) cin >> a[i];\n    int s = 0;\n    for (int i = 0; i <= n; i++) { // Lỗi off-by-one ở vòng lặp tính tổng\n        s += a[i];\n    }\n    cout << s;\n    return 0;\n}`,
        attempts: 4,
        misconceptions: ['Lỗi Off-by-one: i chạy đến n thay vì n-1, cộng thêm 1 giá trị rác ở ô nhớ a[n]'],
        llmFeedback: 'Vòng lặp tính tổng chạy quá giới hạn mảng (i <= n). Trong C++, chỉ mục mảng chạy từ 0 đến n-1, phần tử a[n] không xác định và chứa dữ liệu rác.',
        submittedAt: '2026-06-08T11:15:00Z'
      },
      {
        sessionId: 5,
        sessionName: 'Buổi 5: Hàm',
        status: 'passed',
        score: 72,
        codeSnippet: `// Buổi 5: Hàm tính số mũ\n#include <iostream>\nusing namespace std;\n\ndouble tinhMu(double coSo, int soMu) {\n    double res = 1;\n    for(int i = 0; i < soMu; i++) res *= coSo;\n    return res;\n}\n\nint main() {\n    cout << tinhMu(2, 5);\n    return 0;\n}`,
        attempts: 2,
        misconceptions: [],
        llmFeedback: 'Đã hoàn thành. Hàm hoạt động chính xác với số mũ dương. Chưa xử lý số mũ âm nhưng đạt yêu cầu căn bản.',
        submittedAt: '2026-06-10T15:10:00Z'
      }
    ]
  },
  {
    id: 'std-4',
    name: 'Phạm Hồng Sơn',
    mssv: '11203456',
    profileType: 'warning',
    overallScore: 82,
    conceptMastery: { variables: 90, conditionals: 85, loops: 80, arrays: 85, functions: 70 },
    progress: [
      {
        sessionId: 1,
        sessionName: 'Buổi 1: Biến & Nhập xuất',
        status: 'passed',
        score: 90,
        codeSnippet: `// Buổi 1: Tính chu vi\n#include <iostream>\nusing namespace std;\nint main() {\n    int x;\n    cin >> x;\n    cout << x * 4;\n    return 0;\n}`,
        attempts: 1,
        misconceptions: [],
        llmFeedback: 'Code chạy tốt, viết đơn giản.',
        submittedAt: '2026-06-01T08:50:00Z'
      },
      {
        sessionId: 2,
        sessionName: 'Buổi 2: Câu lệnh Rẽ nhánh',
        status: 'passed',
        score: 85,
        codeSnippet: `// Buổi 2: Số lớn nhất trong 3 số\n#include <iostream>\nusing namespace std;\nint main() {\n    int a, b, c;\n    cin >> a >> b >> c;\n    int max = a;\n    if (b > max) max = b;\n    if (c > max) max = c;\n    cout << max;\n    return 0;\n}`,
        attempts: 2,
        misconceptions: [],
        llmFeedback: 'Logic thuật toán tìm số lớn nhất đúng và gọn gàng.',
        submittedAt: '2026-06-03T09:32:00Z'
      },
      {
        sessionId: 3,
        sessionName: 'Buổi 3: Vòng lặp',
        status: 'warning',
        score: 80,
        codeSnippet: `// Buổi 3: Sắp xếp mảng (Nhưng buổi 3 chỉ dạy Vòng lặp đơn)\n#include <iostream>\n#include <vector>\n#include <algorithm>\n\n// Sử dụng Lambda expressions và vector nâng cao của C++11\nvoid printSorted(std::vector<int>& vec) {\n    std::sort(vec.begin(), vec.end(), [](int a, int b) {\n        return a < b;\n    });\n    for (const auto& item : vec) {\n        std::cout << item << " ";\n    }\n}\n\nint main() {\n    std::vector<int> data = {5, 2, 8, 1, 9};\n    printSorted(data);\n    return 0;\n}`,
        attempts: 1,
        misconceptions: ['Sử dụng cú pháp C++11 (vector, lambda, auto) chưa học', 'Phong cách code thay đổi đột ngột so với buổi 1, 2'],
        llmFeedback: 'CẢNH BÁO ĐẠO VĂN/DÙNG AI: Sinh viên viết code sử dụng thư viện `vector`, `algorithm`, hàm Lambda và từ khóa `auto` vượt xa trình độ buổi 3 (vòng lặp cơ bản). Nghi vấn chép code hoặc nhờ AI viết hộ mà không tự tay gõ.',
        submittedAt: '2026-06-06T19:30:00Z'
      },
      {
        sessionId: 4,
        sessionName: 'Buổi 4: Mảng/Danh sách',
        status: 'warning',
        score: 75,
        codeSnippet: `// Buổi 4: Tìm kiếm nhị phân\n#include <iostream>\nusing namespace std;\n\n// Code viết cực kỳ chuẩn chỉ kèm comment chi tiết\nint binarySearch(int arr[], int l, int r, int x) {\n    while (l <= r) {\n        int m = l + (r - l) / 2;\n        if (arr[m] == x) return m;\n        if (arr[m] < x) l = m + 1;\n        else r = m - 1;\n    }\n    return -1;\n}`,
        attempts: 1,
        misconceptions: ['Comment chuẩn học thuật bất thường'],
        llmFeedback: 'CẢNH BÁO AI-GENERATED: Cấu trúc code tìm kiếm nhị phân mẫu mực kèm cách viết tối ưu tránh tràn số `l + (r-l)/2` là kỹ thuật chuyên nghiệp. Các comment rập khuôn giống ChatGPT sinh ra.',
        submittedAt: '2026-06-09T22:15:00Z'
      },
      {
        sessionId: 5,
        sessionName: 'Buổi 5: Hàm',
        status: 'warning',
        score: 80,
        codeSnippet: `// Buổi 5: Hàm kiểm tra số nguyên tố nâng cao\n#include <iostream>\n#include <cmath>\nusing namespace std;\n\nbool isPrime(int n) {\n    if (n <= 1) return false;\n    if (n <= 3) return true;\n    if (n % 2 == 0 || n % 3 == 0) return false;\n    for (int i = 5; i * i <= n; i += 6) {\n        if (n % i == 0 || n % (i + 2) == 0) return false;\n    }\n    return true;\n}`,
        attempts: 1,
        misconceptions: ['Giải thuật tối ưu Prime O(sqrt(N)) phức tạp bất thường'],
        llmFeedback: 'CẢNH BÁO: Thuật toán kiểm tra số nguyên tố nhảy cóc bước 6 (`i += 6` và kiểm tra `i` và `i+2`) là thuật toán cực kỳ tối ưu, thường không bao giờ được viết bởi một người mới bắt đầu lập trình 5 buổi mà không có sự trợ giúp hoặc sao chép.',
        submittedAt: '2026-06-11T08:00:00Z'
      }
    ]
  }
]

export default function ClassroomDashboard() {
  const navigate = useNavigate()
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS)
  const [selectedStudentId, setSelectedStudentId] = useState<string>('std-2') // Lê Minh Tuấn mặc định
  const [searchTerm, setSearchTerm] = useState('')
  const [profileFilter, setProfileFilter] = useState<'all' | 'advanced' | 'on-track' | 'at-risk' | 'warning'>('all')

  // Simulation State
  const [showSimulate, setShowSimulate] = useState(false)
  const [simStudentId, setSimStudentId] = useState('std-2')
  const [simSessionId, setSimSessionId] = useState('3')
  const [simCode, setSimCode] = useState('')
  const [simulating, setSimulating] = useState(false)
  const [simProgress, setSimProgress] = useState(0)
  const [simLogs, setSimLogs] = useState<string[]>([])

  const selectedStudent = students.find(s => s.id === selectedStudentId) || students[0]

  // Filter sinh viên
  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.mssv.includes(searchTerm)
    const matchesFilter = profileFilter === 'all' || s.profileType === profileFilter
    return matchesSearch && matchesFilter
  })

  // Thống kê lớp học
  const totalCount = students.length
  const advancedCount = students.filter(s => s.profileType === 'advanced').length
  const onTrackCount = students.filter(s => s.profileType === 'on-track').length
  const atRiskCount = students.filter(s => s.profileType === 'at-risk').length
  const warningCount = students.filter(s => s.profileType === 'warning').length

  const classAvgScore = Math.round(students.reduce((sum, s) => sum + s.overallScore, 0) / totalCount)

  // Điểm làm chủ khái niệm trung bình của lớp
  const classConceptMastery = {
    variables: Math.round(students.reduce((sum, s) => sum + s.conceptMastery.variables, 0) / totalCount),
    conditionals: Math.round(students.reduce((sum, s) => sum + s.conceptMastery.conditionals, 0) / totalCount),
    loops: Math.round(students.reduce((sum, s) => sum + s.conceptMastery.loops, 0) / totalCount),
    arrays: Math.round(students.reduce((sum, s) => sum + s.conceptMastery.arrays, 0) / totalCount),
    functions: Math.round(students.reduce((sum, s) => sum + s.conceptMastery.functions, 0) / totalCount)
  }

  // Khởi động mô phỏng chấm bài
  const runSimulation = () => {
    if (!simCode.trim()) return
    setSimulating(true)
    setSimProgress(0)
    setSimLogs([])

    const logs = [
      '🚀 Bắt đầu nhận bài nộp từ Cổng Lịch sử nộp bài...',
      '🔍 Khởi tạo AST Scanner - Quét cấu trúc cú pháp...',
      '📊 So sánh đối chiếu bài học: Tìm kiếm các hàm, biến và vòng lặp trong mã nguồn...',
      '🧠 Gọi LLM Cognitive Engine - Chẩn đoán tư duy và logic lập trình...',
      '🛡️ Chạy bộ phát hiện gian lận & Đánh giá độ tương đồng...',
      '💾 Lưu kết quả, cập nhật Hồ sơ Năng lực sinh viên...'
    ]

    let currentLogIndex = 0
    const interval = setInterval(() => {
      setSimProgress(prev => {
        const next = prev + 20
        if (next >= 100) {
          clearInterval(interval)
          setTimeout(() => {
            // Cập nhật sinh viên trong database giả lập
            setStudents(prevStudents => {
              return prevStudents.map(s => {
                if (s.id === simStudentId) {
                  // Cập nhật lại buổi học tương ứng
                  const updatedProgress = s.progress.map(p => {
                    if (p.sessionId === Number(simSessionId)) {
                      let status: 'passed' | 'failed' | 'warning' = 'passed'
                      let score = 80
                      let feedback = ''
                      let misconceptions: string[] = []

                      const codeLower = simCode.toLowerCase()
                      if (codeLower.includes('vector') || codeLower.includes('lambda') || codeLower.includes('sort')) {
                        status = 'warning'
                        score = 75
                        feedback = 'CẢNH BÁO AI-GENERATED: Code sử dụng cú pháp thư viện cao cấp C++11 chưa được dạy trong 5 buổi lập trình căn bản.'
                        misconceptions = ['Dùng thư viện vector và lambda bất thường']
                      } else if (simSessionId === '3' && !simCode.includes('++') && !simCode.includes('+=') && simCode.includes('while')) {
                        status = 'failed'
                        score = 30
                        feedback = 'LỖI NHẬN THỨC VÒNG LẶP: Quên tăng biến chạy i trong vòng lặp while, gây lặp vô hạn.'
                        misconceptions = ['Lặp vô hạn (Infinite loop) do quên tăng biến chạy']
                      } else {
                        feedback = 'Chúc mừng sinh viên đã giải quyết đúng bài tập theo đúng các khái niệm được học.'
                      }

                      return {
                        ...p,
                        status,
                        score,
                        codeSnippet: simCode,
                        attempts: p.attempts + 1,
                        misconceptions,
                        llmFeedback: feedback,
                        submittedAt: new Date().toISOString()
                      }
                    }
                    return p
                  })

                  // Tính toán lại điểm trung bình & Concept Mastery
                  const passedSessions = updatedProgress.filter(p => p.status === 'passed')
                  const calculatedOverall = Math.round(
                    updatedProgress.reduce((sum, p) => sum + p.score, 0) / updatedProgress.length
                  )

                  // Điều chỉnh chỉ số năng lực
                  const baseMastery = { ...s.conceptMastery }
                  if (simSessionId === '3') {
                    baseMastery.loops = updatedProgress.find(p => p.sessionId === 3)?.status === 'passed' ? 85 : 35
                  } else if (simSessionId === '4') {
                    baseMastery.arrays = updatedProgress.find(p => p.sessionId === 4)?.status === 'passed' ? 80 : 20
                  }

                  // Tự động phân loại Profile Type
                  let profileType: Student['profileType'] = s.profileType
                  const failedOrZero = updatedProgress.filter(p => p.status === 'failed' || p.score < 50).length
                  const warnings = updatedProgress.filter(p => p.status === 'warning').length

                  if (warnings > 0) profileType = 'warning'
                  else if (failedOrZero >= 2) profileType = 'at-risk'
                  else if (calculatedOverall >= 85) profileType = 'advanced'
                  else profileType = 'on-track'

                  return {
                    ...s,
                    profileType,
                    overallScore: calculatedOverall,
                    conceptMastery: baseMastery,
                    progress: updatedProgress
                  }
                }
                return s
              })
            })
            setSimulating(false)
            setShowSimulate(false)
            setSimCode('')
          }, 600)
          return 100
        }
        if (currentLogIndex < logs.length) {
          setSimLogs(curr => [...curr, logs[currentLogIndex]])
          currentLogIndex++
        }
        return next
      })
    }, 400)
  }

  // Tiện ích vẽ biểu đồ Radar SVG bằng React
  const renderRadarChart = (mastery: Student['conceptMastery']) => {
    const center = 80
    const r = 60
    const points = [
      { angle: 0, val: mastery.variables, label: 'Biến' },
      { angle: 72, val: mastery.conditionals, label: 'Rẽ nhánh' },
      { angle: 144, val: mastery.loops, label: 'Vòng lặp' },
      { angle: 216, val: mastery.arrays, label: 'Mảng' },
      { angle: 288, val: mastery.functions, label: 'Hàm' }
    ]

    const getCoords = (angleDeg: number, value: number) => {
      const angleRad = (angleDeg - 90) * (Math.PI / 180)
      const dist = (value / 100) * r
      const x = center + dist * Math.cos(angleRad)
      const y = center + dist * Math.sin(angleRad)
      return { x, y }
    }

    const gridCircles = [25, 50, 75, 100]
    const polygonPoints = points.map(p => {
      const { x, y } = getCoords(p.angle, p.val)
      return `${x},${y}`
    }).join(' ')

    return (
      <svg width="220" height="180" style={{ margin: '0 auto', overflow: 'visible' }}>
        {/* Background grids */}
        {gridCircles.map(gc => (
          <circle
            key={gc}
            cx={center}
            cy={center}
            r={(gc / 100) * r}
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth="0.8"
            strokeDasharray={gc < 100 ? '2 2' : 'none'}
          />
        ))}

        {/* Axis lines */}
        {points.map(p => {
          const outer = getCoords(p.angle, 100)
          return (
            <line
              key={p.label}
              x1={center}
              y1={center}
              x2={outer.x}
              y2={outer.y}
              stroke="var(--border-subtle)"
              strokeWidth="0.8"
            />
          )
        })}

        {/* Polygon Area */}
        <polygon
          points={polygonPoints}
          fill="rgba(192, 57, 43, 0.25)"
          stroke="var(--neu-red)"
          strokeWidth="1.5"
        />

        {/* Data points dots */}
        {points.map(p => {
          const { x, y } = getCoords(p.angle, p.val)
          return (
            <circle
              key={p.label}
              cx={x}
              cy={y}
              r="3.5"
              fill="var(--neu-red-light)"
              stroke="#fff"
              strokeWidth="1"
            />
          )
        })}

        {/* Labels */}
        {points.map(p => {
          const labelDist = r + 15
          const angleRad = (p.angle - 90) * (Math.PI / 180)
          const x = center + labelDist * Math.cos(angleRad)
          const y = center + labelDist * Math.sin(angleRad)
          let anchor: "inherit" | "end" | "start" | "middle" | undefined = 'middle'
          if (p.angle === 72 || p.angle === 144) anchor = 'start'
          if (p.angle === 216 || p.angle === 288) anchor = 'end'

          return (
            <text
              key={p.label}
              x={x}
              y={y + 4}
              textAnchor={anchor}
              fontSize="10"
              fill="var(--text-secondary)"
              fontWeight="600"
            >
              {p.label} ({p.val}%)
            </text>
          )
        })}
      </svg>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-root)' }}>
      <NavBar role="lecturer" userName="TS. Nguyễn Minh Đức" />

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-red">🧠 LLM Cognitive Tracker</span>
              <span className="badge badge-blue">5 Buổi Lập Trình Căn Bản</span>
            </div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', marginBottom: '4px' }}>
              🏫 Đánh Giá Năng Lực Học Viên Căn Bản
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Ứng dụng LLM chẩn đoán lỗ hổng nhận thức và phân tích tiến độ học tập của từng học viên.
            </p>
          </div>
          <div>
            <button className="btn btn-primary" onClick={() => setShowSimulate(true)}>
              <Sparkles size={16} /> Mô phỏng Sinh viên Nộp bài
            </button>
          </div>
        </div>

        {/* ── Thống kê tổng quan lớp học ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '32px'
        }}>
          {/* Stats Card 1 */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>TỔNG SỐ HỌC VIÊN</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{totalCount}</div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
              👥
            </div>
          </div>

          {/* Stats Card 2 */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>ĐIỂM TRUNG BÌNH LỚP</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#a78bfa', marginTop: '4px' }}>{classAvgScore}/100</div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(167,139,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
              📊
            </div>
          </div>

          {/* Stats Card 3 */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>CẢNH BÁO NGUY CƠ</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f87171', marginTop: '4px' }}>{atRiskCount}</div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(248,113,113,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
              ⚠️
            </div>
          </div>

          {/* Stats Card 4 */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>CẢNH BÁO GIAN LẬN</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>{warningCount}</div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(251,191,36,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
              🛡️
            </div>
          </div>
        </div>

        {/* ── Main Layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignItems: 'start' }}>

          {/* ── Sidebar: Danh sách sinh viên ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Filters */}
            <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={16} className="text-secondary" />
                <input
                  className="input"
                  style={{ flex: 1, padding: '8px 12px' }}
                  placeholder="Tìm học viên, MSSV..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>PHÂN LOẠI HỌC LỰC</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {[
                    { val: 'all', label: 'Tất cả' },
                    { val: 'advanced', label: 'Giỏi' },
                    { val: 'on-track', label: 'Đạt' },
                    { val: 'at-risk', label: 'Nguy cơ' },
                    { val: 'warning', label: 'Ghi vấn' }
                  ].map(f => (
                    <button
                      key={f.val}
                      onClick={() => setProfileFilter(f.val as any)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.72rem',
                        borderRadius: '4px',
                        border: '1px solid var(--border-subtle)',
                        background: profileFilter === f.val ? 'var(--neu-red)' : 'var(--bg-elevated)',
                        color: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Students List */}
            <div className="glass-card" style={{ padding: '8px', maxHeight: '500px', overflowY: 'auto' }}>
              {filteredStudents.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Không tìm thấy sinh viên nào
                </div>
              ) : filteredStudents.map(std => {
                const isSelected = std.id === selectedStudentId
                let badgeClass = 'badge-blue'
                let badgeText = 'On Track'
                if (std.profileType === 'advanced') { badgeClass = 'badge-green'; badgeText = 'Advanced'; }
                else if (std.profileType === 'at-risk') { badgeClass = 'badge-red'; badgeText = 'At Risk'; }
                else if (std.profileType === 'warning') { badgeClass = 'badge-yellow'; badgeText = 'Warning'; }

                return (
                  <div
                    key={std.id}
                    onClick={() => setSelectedStudentId(std.id)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: isSelected ? 'rgba(192,57,43,0.12)' : 'transparent',
                      border: isSelected ? '1px solid rgba(192,57,43,0.3)' : '1px solid transparent',
                      marginBottom: '4px'
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--bg-glass-hover)'
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isSelected ? '#fff' : 'var(--text-primary)' }}>
                        {std.name}
                      </span>
                      <span className={`badge ${badgeClass}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{badgeText}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        MSSV: {std.mssv}
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {std.overallScore}/100
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Chi tiết sinh viên ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-card" style={{ padding: '28px' }}>
              {/* Header chi tiết */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '20px', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{selectedStudent.name}</h2>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <span>MSSV: <strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedStudent.mssv}</strong></span>
                    <span>•</span>
                    <span>Xếp hạng:
                      <strong style={{
                        marginLeft: '4px',
                        color: selectedStudent.profileType === 'advanced' ? '#34d399' : selectedStudent.profileType === 'at-risk' ? '#f87171' : selectedStudent.profileType === 'warning' ? '#fbbf24' : '#60a5fa'
                      }}>
                        {selectedStudent.profileType.toUpperCase()}
                      </strong>
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ĐIỂM TRUNG BÌNH</span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--neu-red-light)', lineHeight: 1 }}>
                    {selectedStudent.overallScore}
                  </div>
                </div>
              </div>

              {/* Grid 2 cột: Radar chart & Concept List */}
              <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '24px', marginBottom: '32px' }}>
                {/* Radar Chart */}
                <div style={{ borderRight: '1px solid var(--border-subtle)', paddingRight: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '12px', textAlign: 'center' }}>
                    BIỂU ĐỒ NĂNG LỰC
                  </div>
                  {renderRadarChart(selectedStudent.conceptMastery)}
                </div>

                {/* Concept mastery list */}
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    TÌNH TRẠNG LÀM CHỦ KIẾN THỨC
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { label: 'Buổi 1: Biến & Cơ chế gán', value: selectedStudent.conceptMastery.variables, desc: 'Hiểu kiểu dữ liệu, khai báo và tính toán số học.' },
                      { label: 'Buổi 2: Logic điều kiện', value: selectedStudent.conceptMastery.conditionals, desc: 'Hiểu cấu trúc if-else và biểu thức logic phức tạp.' },
                      { label: 'Buổi 3: Vòng lặp đơn/lồng nhau', value: selectedStudent.conceptMastery.loops, desc: 'Hiểu biến lặp, điều kiện dừng và luồng lặp lồng nhau.' },
                      { label: 'Buổi 4: Mảng & Chỉ mục', value: selectedStudent.conceptMastery.arrays, desc: 'Hiểu truy xuất index mảng, tràn mảng tĩnh.' },
                      { label: 'Buổi 5: Định nghĩa & Gọi Hàm', value: selectedStudent.conceptMastery.functions, desc: 'Hiểu tham số truyền vào, giá trị trả về và phạm vi biến.' }
                    ].map(concept => (
                      <div key={concept.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.82rem' }}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{concept.label}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>- {concept.desc}</span>
                          </div>
                          <span style={{ fontWeight: 700, color: concept.value >= 80 ? '#34d399' : concept.value >= 60 ? '#fbbf24' : '#f87171' }}>
                            {concept.value}%
                          </span>
                        </div>
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${concept.value}%`,
                              background: concept.value >= 80 ? 'linear-gradient(90deg, #10b981, #34d399)' : concept.value >= 60 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #dc2626, #f87171)'
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lịch sử tiến trình qua 5 buổi học */}
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} className="text-accent" /> Tiến trình 5 Buổi Nộp Bài & Chẩn Đoán Lỗi Nhận Thức (AI Analyzer)
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {selectedStudent.progress.map((prog, index) => {
                    let statusColor = 'rgba(255,255,255,0.05)'
                    let borderColor = 'var(--border-subtle)'
                    let statusLabel = 'Chưa nộp'
                    let icon = <Clock size={16} style={{ color: 'var(--text-muted)' }} />

                    if (prog.status === 'passed') {
                      statusColor = 'rgba(52, 211, 153, 0.05)'
                      borderColor = 'rgba(52, 211, 153, 0.2)'
                      statusLabel = `Đạt (${prog.score}đ)`
                      icon = <CheckCircle2 size={16} style={{ color: '#34d399' }} />
                    } else if (prog.status === 'failed') {
                      statusColor = 'rgba(248, 113, 113, 0.05)'
                      borderColor = 'rgba(248, 113, 113, 0.2)'
                      statusLabel = `Lỗi tư duy (${prog.score}đ)`
                      icon = <XCircle size={16} style={{ color: '#f87171' }} />
                    } else if (prog.status === 'warning') {
                      statusColor = 'rgba(251, 191, 36, 0.05)'
                      borderColor = 'rgba(251, 191, 36, 0.2)'
                      statusLabel = `Nghi vấn chép/AI (${prog.score}đ)`
                      icon = <ShieldAlert size={16} style={{ color: '#fbbf24' }} />
                    }

                    return (
                      <div
                        key={prog.sessionId}
                        style={{
                          background: statusColor,
                          border: `1px solid ${borderColor}`,
                          borderRadius: 'var(--radius-lg)',
                          padding: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        {/* Session Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {icon}
                            <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{prog.sessionName}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', fontSize: '0.78rem' }}>
                            <span className="tag">Submit {prog.attempts} lần</span>
                            {prog.submittedAt && (
                              <span className="tag">{new Date(prog.submittedAt).toLocaleDateString('vi-VN')}</span>
                            )}
                            <span style={{
                              fontWeight: 700,
                              color: prog.status === 'passed' ? '#34d399' : prog.status === 'failed' ? '#f87171' : prog.status === 'warning' ? '#fbbf24' : 'var(--text-muted)'
                            }}>
                              {statusLabel}
                            </span>
                          </div>
                        </div>

                        {/* Code + Feedback Grid */}
                        {prog.codeSnippet ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '4px' }}>
                            {/* Code snippet */}
                            <div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>MÃ NGUỒN ĐÃ NỘP:</div>
                              <pre style={{
                                background: '#07080a',
                                padding: '12px',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.78rem',
                                color: '#a7b2c1',
                                fontFamily: 'var(--font-mono)',
                                overflowX: 'auto',
                                maxHeight: '180px',
                                border: '1px solid rgba(255,255,255,0.03)'
                              }}>
                                <code>{prog.codeSnippet}</code>
                              </pre>
                            </div>

                            {/* Diagnosis & Feedback */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Brain size={14} style={{ color: 'var(--neu-red-light)' }} />
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>CHẨN ĐOÁN CỦA LLM:</span>
                              </div>

                              {/* Misconceptions */}
                              {prog.misconceptions.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {prog.misconceptions.map((m, idx) => (
                                    <div
                                      key={idx}
                                      style={{
                                        fontSize: '0.78rem',
                                        color: prog.status === 'warning' ? '#fcd34d' : '#fca5a5',
                                        background: prog.status === 'warning' ? 'rgba(251,191,36,0.1)' : 'rgba(248,113,113,0.1)',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        borderLeft: `2.5px solid ${prog.status === 'warning' ? '#fbbf24' : '#ef4444'}`
                                      }}
                                    >
                                      ❌ Lỗi: {m}
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div style={{
                                fontSize: '0.82rem',
                                color: 'var(--text-secondary)',
                                lineHeight: 1.5,
                                background: 'rgba(255,255,255,0.02)',
                                padding: '10px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid rgba(255,255,255,0.04)',
                                flex: 1
                              }}>
                                {prog.llmFeedback}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', background: 'rgba(255,255,255,0.01)', borderRadius: 'var(--radius-md)' }}>
                            Chưa có bài nộp nào cho buổi học này.
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Simulation Modal ── */}
      {showSimulate && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
            padding: '24px'
          }}
          onClick={() => !simulating && setShowSimulate(false)}
        >
          <div
            className="glass-card"
            style={{ width: '100%', maxWidth: '700px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} className="text-accent" /> Mô Phỏng Chấm Bài Với LLM Cognitive Engine
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px' }}>
                Chọn một học viên, chọn buổi học và paste mã nguồn để chạy phân tích của AI.
              </p>
            </div>

            {simulating ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '40px 0' }}>
                <div className="spinner" style={{ width: '48px', height: '48px' }} />
                <div style={{ width: '100%', maxWidth: '400px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Đang phân tích mã nguồn...</span>
                    <span style={{ fontWeight: 600 }}>{simProgress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${simProgress}%` }} />
                  </div>
                </div>
                <div style={{
                  width: '100%',
                  background: '#07080a',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  {simLogs.map((log, i) => <div key={i}>{log}</div>)}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>HỌC VIÊN:</label>
                    <select
                      className="input"
                      value={simStudentId}
                      onChange={e => setSimStudentId(e.target.value)}
                    >
                      {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.mssv})</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>BUỔI HỌC:</label>
                    <select
                      className="input"
                      value={simSessionId}
                      onChange={e => setSimSessionId(e.target.value)}
                    >
                      <option value="1">Buổi 1: Biến & Nhập xuất</option>
                      <option value="2">Buổi 2: Câu lệnh Rẽ nhánh</option>
                      <option value="3">Buổi 3: Vòng lặp</option>
                      <option value="4">Buổi 4: Mảng/Danh sách</option>
                      <option value="5">Buổi 5: Hàm</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>MÃ NGUỒN NỘP (C++):</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                        onClick={() => setSimCode(`// Vòng lặp while lỗi lặp vô hạn\n#include <iostream>\nusing namespace std;\nint main() {\n    int n;\n    cin >> n;\n    int i = 1, sum = 0;\n    while(i <= n) {\n        sum += i;\n        // Thiếu tăng i++\n    }\n    cout << sum;\n}`)}
                      >
                        Mẫu 1: Lặp vô hạn
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                        onClick={() => setSimCode(`// Code nâng cao bất thường (nghi ChatGPT)\n#include <iostream>\n#include <vector>\n#include <numeric>\n#include <algorithm>\n\nint main() {\n    std::vector<int> nums = {1, 2, 3, 4, 5};\n    int sum = std::accumulate(nums.begin(), nums.end(), 0, [](int a, int b) {\n        return a + b;\n    });\n    std::cout << sum;\n}`)}
                      >
                        Mẫu 2: AI Code
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="input"
                    rows={8}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', resize: 'vertical' }}
                    placeholder="Paste code C++ của học viên vào đây..."
                    value={simCode}
                    onChange={e => setSimCode(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                  <button className="btn btn-secondary" onClick={() => setShowSimulate(false)}>Hủy</button>
                  <button
                    className="btn btn-primary"
                    disabled={!simCode.trim()}
                    onClick={runSimulation}
                  >
                    <Play size={14} /> Bắt đầu Phân tích LLM
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
