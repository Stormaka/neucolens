# 📐 BƯỚC 2: KHUNG TIÊU CHÍ ĐÁNH GIÁ (RUBRIC FRAMEWORK)
## "Programming Proficiency Rubric for LLM-Assisted Assessment"

> **Mục đích:** Đây là "bộ luật" mà LLM sẽ dùng để chấm điểm code sinh viên.  
> Rubric được thiết kế theo **khung 3 tầng** (3-Tier Framework), mỗi tầng có **điểm số rõ ràng** và **mô tả cụ thể** cho từng mức độ.

---

## 🏗️ Tổng Quan Khung Điểm

| Tầng | Tên | Trọng số | Điểm tối đa |
|------|-----|----------|-------------|
| **Tầng 1** | Correctness (Tính Đúng Đắn) | 40% | 40 điểm |
| **Tầng 2** | Code Quality (Chất Lượng Code) | 35% | 35 điểm |
| **Tầng 3** | Computational Thinking (Tư Duy Lập Trình) | 25% | 25 điểm |
| | **TỔNG** | **100%** | **100 điểm** |

---

## 🔵 TẦNG 1: CORRECTNESS — Tính Đúng Đắn (40 điểm)

> **Định nghĩa:** Code có giải quyết được bài toán đặt ra không?

### Tiêu chí 1.1 — Syntax & Execution (10 điểm)

| Mức | Điểm | Mô tả |
|-----|------|-------|
| **Xuất sắc** | 10 | Code chạy không lỗi. Không có lỗi cú pháp (syntax error), không có runtime error với mọi input hợp lệ. |
| **Tốt** | 7–9 | Code chạy được với hầu hết input. Có thể có 1–2 runtime error nhỏ ở trường hợp đặc biệt. |
| **Trung bình** | 4–6 | Code chạy được nhưng thường xuyên gặp lỗi. Hoặc code chạy được một phần logic nhưng không hoàn chỉnh. |
| **Yếu** | 1–3 | Code có syntax error, không thể chạy được. Hoặc cấu trúc cơ bản rất sai. |
| **Không có** | 0 | Không nộp hoặc chỉ có template rỗng. |

---

### Tiêu chí 1.2 — Functional Correctness (20 điểm)

| Mức | Điểm | Mô tả |
|-----|------|-------|
| **Xuất sắc** | 18–20 | Vượt qua **tất cả** test cases, bao gồm cả các edge cases (input rỗng, số âm, giá trị cực đại/cực tiểu). |
| **Tốt** | 13–17 | Vượt qua **>75%** test cases. Thất bại ở 1–2 edge cases không phổ biến. |
| **Trung bình** | 7–12 | Vượt qua **50–75%** test cases. Logic cơ bản đúng nhưng thiếu xử lý nhiều trường hợp. |
| **Yếu** | 1–6 | Vượt qua **<50%** test cases. Logic bị sai về cơ bản ở một phần quan trọng. |
| **Không có** | 0 | Không pass được test case nào. |

---

### Tiêu chí 1.3 — Edge Case Handling (10 điểm)

| Mức | Điểm | Mô tả |
|-----|------|-------|
| **Xuất sắc** | 9–10 | Có kiểm tra và xử lý đầy đủ các trường hợp đặc biệt: input rỗng, None/null, số âm, overflow, kiểu dữ liệu sai. |
| **Tốt** | 6–8 | Xử lý được phần lớn edge cases quan trọng nhưng bỏ sót 1–2 trường hợp ít phổ biến. |
| **Trung bình** | 3–5 | Chỉ xử lý được 1–2 edge case đơn giản nhất. Nhiều trường hợp còn bị bỏ qua. |
| **Yếu** | 1–2 | Gần như không có xử lý edge case nào. |
| **Không có** | 0 | Hoàn toàn không quan tâm đến edge cases. |

---

## 🟡 TẦNG 2: CODE QUALITY — Chất Lượng Code (35 điểm)

> **Định nghĩa:** Code có được viết theo chuẩn tốt, dễ đọc, dễ bảo trì không?

### Tiêu chí 2.1 — Naming & Readability (10 điểm)

| Mức | Điểm | Mô tả | Ví dụ |
|-----|------|-------|-------|
| **Xuất sắc** | 9–10 | Tên biến/hàm có ý nghĩa rõ ràng, phản ánh đúng vai trò. Tuân thủ convention (snake_case cho Python). | `student_scores`, `calculate_average()`, `is_valid_input()` |
| **Tốt** | 6–8 | Hầu hết tên biến có ý nghĩa. Đôi khi có vài tên hơi mơ hồ nhưng vẫn hiểu được. | `scores`, `calc_avg()`, `check()` |
| **Trung bình** | 3–5 | Nhiều tên biến ngắn, không có ý nghĩa. Có thể hiểu được sau khi đọc kỹ code. | `arr`, `temp`, `fn1()`, `res` |
| **Yếu** | 1–2 | Dùng tên biến 1 chữ cái la liệt (`a`, `b`, `x`, `i`). Rất khó đoán ý nghĩa. | `a`, `b`, `c`, `d`, `e`, `f` |
| **Không có** | 0 | Tên hoàn toàn không thể hiểu được hoặc random. | `asdf`, `thing1`, `xyz123` |

---

### Tiêu chí 2.2 — Comments & Documentation (8 điểm)

| Mức | Điểm | Mô tả |
|-----|------|-------|
| **Xuất sắc** | 7–8 | Có docstring cho mọi hàm (mô tả input, output, chức năng). Comment giải thích những đoạn logic phức tạp. Không comment những thứ quá hiển nhiên. |
| **Tốt** | 5–6 | Có comment ở phần quan trọng. Có docstring cho hầu hết các hàm chính. |
| **Trung bình** | 3–4 | Chỉ có vài dòng comment đơn lẻ. Thiếu docstring. |
| **Yếu** | 1–2 | Hầu như không có comment. Chỉ có 1–2 dòng không liên quan. |
| **Không có** | 0 | Hoàn toàn không có comment hay documentation. |

---

### Tiêu chí 2.3 — Code Structure & Efficiency (12 điểm)

| Mức | Điểm | Mô tả |
|-----|------|-------|
| **Xuất sắc** | 11–12 | Không có code lặp lại (DRY principle). Logic được tổ chức rõ ràng. Độ phức tạp thuật toán tối ưu (ví dụ: dùng `O(n)` thay vì `O(n²)` khi có thể). |
| **Tốt** | 8–10 | Một vài đoạn code có thể refactor được nhưng về cơ bản cấu trúc tốt. Thuật toán không tối ưu nhất nhưng chấp nhận được. |
| **Trung bình** | 4–7 | Code bị lặp lại đáng kể (copy-paste). Có thể dùng vòng lặp/hàm để gọn hơn. Thuật toán có thể cải thiện nhiều. |
| **Yếu** | 1–3 | Code rất lộn xộn, lặp lại nhiều, khó theo dõi luồng thực thi. |
| **Không có** | 0 | Code là một "khối" không có cấu trúc, viết tất cả trong 1 function duy nhất hoặc không có function. |

---

### Tiêu chí 2.4 — Idiomatic Code (5 điểm)
*("Idiomatic" = Viết đúng "chất" của ngôn ngữ, dùng đúng tính năng đặc trưng)*

| Mức | Điểm | Mô tả | Ví dụ (Python) |
|-----|------|-------|----------------|
| **Xuất sắc** | 5 | Sử dụng thành thạo các tính năng đặc trưng của ngôn ngữ. | Dùng list comprehension, `enumerate()`, `zip()`, f-string, context managers |
| **Tốt** | 3–4 | Biết dùng một số tính năng phù hợp nhưng chưa thuần thục. | Biết dùng f-string nhưng vẫn dùng `.format()` ở chỗ khác |
| **Trung bình** | 2 | Dùng cách "old-school" hoặc C-style thay vì Pythonic. | Dùng `for i in range(len(arr)):` thay vì `for item in arr:` |
| **Yếu/Không có** | 0–1 | Viết code theo phong cách của ngôn ngữ khác, không tận dụng được tính năng ngôn ngữ. | |

---

## 🔴 TẦNG 3: COMPUTATIONAL THINKING — Tư Duy Lập Trình (25 điểm)

> **Định nghĩa:** Đây là tầng phân biệt người học GIỎI và người chỉ học THUỘC.  
> Đây là **điểm đột phá duy nhất** của nghiên cứu này — chưa có hệ thống nào đánh giá tầng này bằng LLM một cách có hệ thống.

### Tiêu chí 3.1 — Problem Decomposition (8 điểm)
*(Khả năng chia nhỏ vấn đề)*

| Mức | Điểm | Mô tả | Dấu hiệu nhận biết trong code |
|-----|------|-------|-------------------------------|
| **Xuất sắc** | 7–8 | Bài toán được chia thành các hàm nhỏ, mỗi hàm giải quyết **một** nhiệm vụ duy nhất (Single Responsibility). Các hàm có thể tái sử dụng. | 3+ hàm riêng biệt, mỗi hàm < 20 dòng, tên hàm mô tả rõ nhiệm vụ |
| **Tốt** | 5–6 | Có chia hàm nhưng một số hàm còn đảm nhiệm quá nhiều việc. | 2 hàm, nhưng 1 hàm quá dài (>30 dòng) |
| **Trung bình** | 3–4 | Chỉ có 1 hàm main hoặc có hàm nhưng chia không hợp lý. | Hầu hết code nằm trong `main()` hoặc global scope |
| **Yếu** | 1–2 | Toàn bộ code trong 1 khối, không có hàm nào (trừ main). | Code dài 50+ dòng không có hàm con |
| **Không có** | 0 | Viết code procedurally hoàn toàn, không có ý thức về hàm. | |

---

### Tiêu chí 3.2 — Abstraction Level (7 điểm)
*(Khả năng tổng quát hóa)*

| Mức | Điểm | Mô tả | Ví dụ |
|-----|------|-------|-------|
| **Xuất sắc** | 6–7 | Giải pháp có tính tổng quát, có thể áp dụng cho nhiều trường hợp tương tự. Không hard-code giá trị. Biết dùng parameters, constants. | `def calculate_grade(score, max_score=100, pass_threshold=60):` thay vì hard-code `60` |
| **Tốt** | 4–5 | Có một số mức tổng quát nhưng vẫn còn hard-code ở vài chỗ. | Hầu hết dùng params nhưng đôi khi vẫn dùng magic number |
| **Trung bình** | 2–3 | Hard-code nhiều nhưng cấu trúc code cho thấy hiểu một phần về abstraction. | |
| **Yếu** | 1 | Hard-code hầu hết mọi thứ. Giải pháp chỉ đúng với đúng bài toán đó, không thể mở rộng. | `if score >= 60: print("Pass")` — số 60 hard-code |
| **Không có** | 0 | Không có ý thức về tổng quát hóa. | |

---

### Tiêu chí 3.3 — Pattern Recognition & Reuse (5 điểm)
*(Khả năng nhận ra và tái sử dụng pattern)*

| Mức | Điểm | Mô tả |
|-----|------|-------|
| **Xuất sắc** | 5 | Nhận ra các pattern lặp lại và tạo abstraction (hàm/class). Tái sử dụng hàm đã viết thay vì copy-paste. Biết dùng built-in functions phù hợp (`sum()`, `max()`, `sorted()`). |
| **Tốt** | 3–4 | Một phần pattern được nhận ra. Đôi khi tái sử dụng hàm nhưng đôi khi vẫn copy-paste. |
| **Trung bình** | 2 | Copy-paste code khá nhiều thay vì tạo hàm. Ít sử dụng built-in functions sẵn có. |
| **Yếu/Không có** | 0–1 | Không nhận ra pattern. Copy-paste là phong cách chính. Tự viết lại những gì đã có sẵn. |

---

### Tiêu chí 3.4 — Debugging Strategy (5 điểm)
*(Phân tích qua revision history — Git commits)*

> ⚠️ **Lưu ý:** Tiêu chí này KHÔNG đánh giá code cuối cùng. Đây là phân tích DUY NHẤT dựa trên **lịch sử commit** của sinh viên (git log, revision history). Đây là điểm **HOÀN TOÀN MỚI** của nghiên cứu này.

| Mức | Điểm | Mô tả | Dấu hiệu trong commit history |
|-----|------|-------|-------------------------------|
| **Xuất sắc** | 5 | Có chiến lược debug có hệ thống. Thay đổi từng bước một, mỗi commit giải quyết một vấn đề cụ thể. Commit messages mô tả rõ vấn đề gặp phải và cách giải quyết. | Commits: "Fix: array index out of range when input is empty" → "Add: edge case for negative numbers" → "Refactor: extract validation into separate function" |
| **Tốt** | 3–4 | Debug có hướng nhưng đôi khi thay đổi quá nhiều thứ cùng lúc. Commit messages tạm chấp nhận. | Commits: "Fixed bug" → "Working now" → "Added check" |
| **Trung bình** | 2 | Debug kiểu thử-và-sai. Thay đổi nhiều thứ cùng lúc, khó xác định commit nào giải quyết vấn đề gì. | Commits: "update" → "update2" → "final" |
| **Yếu** | 1 | Rất ít commit. Hầu như chỉ 1–2 commit: "initial" và "submit". Không có quá trình debug có thể quan sát được. | Commits: "first commit" → "done" |
| **Không có** | 0 | Chỉ có 1 commit duy nhất hoặc không có revision history. | |

---

## 📊 Bảng Điểm Tổng Hợp Cho LLM

Khi LLM chấm điểm, nó sẽ trả về JSON theo cấu trúc sau:

```json
{
  "student_id": "SV001",
  "assignment_id": "BT03",
  "submission_timestamp": "2026-06-14T15:30:00",
  "tier1_correctness": {
    "1_1_syntax_execution": { "score": 10, "max": 10, "justification": "Code chạy hoàn toàn không lỗi." },
    "1_2_functional_correctness": { "score": 17, "max": 20, "justification": "Pass 8/10 test cases. Thất bại với input là list rỗng và số âm." },
    "1_3_edge_case_handling": { "score": 4, "max": 10, "justification": "Chỉ kiểm tra input rỗng, bỏ qua số âm và overflow." },
    "tier1_subtotal": 31
  },
  "tier2_code_quality": {
    "2_1_naming_readability": { "score": 8, "max": 10, "justification": "Hầu hết tên biến có ý nghĩa. Biến 'res' nên đổi thành 'result' hoặc 'total_score'." },
    "2_2_comments_documentation": { "score": 4, "max": 8, "justification": "Có comment ở vài chỗ nhưng thiếu docstring cho hàm chính." },
    "2_3_structure_efficiency": { "score": 7, "max": 12, "justification": "Code có cấu trúc tương đối. Đoạn tính trung bình có thể dùng built-in sum() thay vì vòng lặp thủ công." },
    "2_4_idiomatic_code": { "score": 3, "max": 5, "justification": "Có dùng f-string nhưng dùng range(len()) thay vì enumerate(). Chưa dùng list comprehension." },
    "tier2_subtotal": 22
  },
  "tier3_computational_thinking": {
    "3_1_problem_decomposition": { "score": 5, "max": 8, "justification": "Có 2 hàm riêng biệt nhưng hàm process_data() quá dài (45 dòng) và làm quá nhiều việc." },
    "3_2_abstraction_level": { "score": 4, "max": 7, "justification": "Phần lớn dùng parameters tốt nhưng còn hard-code ngưỡng 60 ở dòng 23." },
    "3_3_pattern_recognition": { "score": 3, "max": 5, "justification": "Nhận ra được pattern tính trung bình và tạo hàm riêng. Tuy nhiên có 2 đoạn validation bị lặp lại." },
    "3_4_debugging_strategy": { "score": 3, "max": 5, "justification": "Có 7 commits. Từ commit 3-5 cho thấy đang cố gắng fix edge case nhưng commit messages chưa rõ ràng ('fix bug' x3)." },
    "tier3_subtotal": 15
  },
  "total_score": 68,
  "proficiency_level": "Intermediate",
  "strengths": [
    "Code chạy tốt, không có lỗi cú pháp",
    "Biết chia bài toán thành các hàm nhỏ",
    "Có ý thức về việc dùng parameters thay vì hard-code"
  ],
  "weaknesses": [
    "Chưa xử lý đầy đủ edge cases",
    "Thiếu documentation (docstring)",
    "Hàm process_data() quá dài và vi phạm Single Responsibility Principle"
  ],
  "specific_recommendations": [
    "Tách hàm process_data() thành: validate_input(), calculate_scores(), format_output()",
    "Thêm docstring theo format: '''Mô tả. Args: ... Returns: ...'''",
    "Kiểm tra trường hợp list rỗng: if not scores: return None",
    "Thay 'for i in range(len(scores)):' bằng 'for score in scores:'"
  ],
  "next_suggested_topic": "Đọc về List Comprehension và Python Best Practices. Thử bài tập về Error Handling."
}
```

---

## 🏷️ Phân Loại Mức Độ Năng Lực (Proficiency Levels)

| Mức | Tên | Điểm | Mô tả tổng quát |
|-----|-----|------|-----------------|
| **Level 5** | 🏆 Expert | 90–100 | Code không chỉ đúng mà còn thanh lịch. Tư duy lập trình xuất sắc. Có thể là TA cho lớp. |
| **Level 4** | ⭐ Advanced | 75–89 | Code tốt, ít lỗi. Hiểu về code quality. Đang phát triển tư duy tốt. |
| **Level 3** | 📈 Intermediate | 55–74 | Code chạy được, đúng phần lớn. Hiểu cơ bản nhưng còn nhiều điểm cần cải thiện. |
| **Level 2** | 📚 Developing | 35–54 | Code hay lỗi. Đang học những khái niệm cơ bản. Cần hỗ trợ thêm. |
| **Level 1** | 🆘 Beginner | 0–34 | Đang gặp khó khăn căn bản. Cần can thiệp sớm từ giáo viên. |

---

## 🔄 Quy Trình Đánh Giá (Evaluation Workflow)

```
Sinh viên nộp code
       │
       ▼
┌──────────────────┐
│  Static Analysis │  ← Chạy pylint, ast, radon (tự động, không cần LLM)
│  (5 giây)        │    → Xuất: syntax_errors, complexity_score, line_count
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Test Runner     │  ← Chạy test cases tự động (Judge0 hoặc subprocess)
│  (10 giây)       │    → Xuất: pass_rate, failed_tests, execution_time
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Git Analysis    │  ← Phân tích commit history (nếu có)
│  (2 giây)        │    → Xuất: commit_count, time_distribution, msg_quality
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  LLM Analysis (GPT-4 / Claude)      │  ← Gửi code + static analysis results
│  (15–30 giây)                       │    + commit history + RUBRIC này
│                                     │    → Xuất: JSON điểm số từng tiêu chí
└────────┬────────────────────────────┘
         │
         ▼
┌──────────────────┐
│  Dashboard       │  ← Hiển thị cho giáo viên + sinh viên
│  (real-time)     │    → Radar chart, progress timeline, feedback text
└──────────────────┘
```

---

## 📝 Hướng Dẫn Dùng Rubric Này Với Chuyên Gia

Để đảm bảo **độ tin cậy (inter-rater reliability)** của nghiên cứu, cần thực hiện:

### Bước Calibration (Hiệu chỉnh)
1. Chọn **20 bài nộp mẫu** đại diện cho 5 mức độ khác nhau
2. Mời **2–3 giảng viên** chấm độc lập bằng rubric này (không dùng LLM)
3. Tính **Cohen's Kappa (κ)** giữa các giảng viên → Mục tiêu: κ > 0.6
4. Thảo luận các trường hợp không đồng thuận để làm rõ tiêu chí
5. Sau khi đạt κ > 0.6 giữa người-người, dùng cùng 20 bài đó để chấm bằng LLM
6. So sánh kết quả LLM với kết quả người chuyên gia → Đây là **RQ1** của nghiên cứu

### Điều chỉnh theo Cấp độ Bài Tập
| Loại bài tập | Tầng 1 | Tầng 2 | Tầng 3 |
|---|---|---|---|
| Bài tập tuần 1–2 (Basic I/O) | 60% | 30% | 10% |
| Bài tập tuần 3–5 (Functions) | 45% | 35% | 20% |
| Bài tập tuần 6–10 (Data Structures) | 35% | 35% | 30% |
| Đồ án cuối kỳ (Project) | 30% | 30% | 40% |

---

*📅 Rubric Framework v1.0 — Ngày tạo: 14/06/2026*  
*🔄 Cần review và cập nhật sau mỗi pilot study*
