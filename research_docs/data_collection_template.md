# 📊 BƯỚC 3 — PHỤ LỤC: TEMPLATE THU THẬP DỮ LIỆU
## Data Collection Spreadsheet Schema
### File: `student_data.xlsx` (4 sheet)

> **Hướng dẫn sử dụng:** Tạo file Excel với 4 sheet theo schema dưới đây.
> Tất cả tên cột phải đúng chính xác (không dấu cách, dùng underscore) để script phân tích đọc được.
> **QUAN TRỌNG:** Thay tên thật bằng mã sinh viên (SV001...) ngay khi nhập để đảm bảo ẩn danh.

---

## SHEET 1: `students` — Danh Sách Sinh Viên

> Mỗi hàng = 1 sinh viên. Nhập vào Tuần 1 (Pre-test) và cập nhật khi có dữ liệu mới.

| Tên cột | Kiểu dữ liệu | Ví dụ | Ghi chú |
|---------|-------------|-------|---------|
| `student_id` | Text | C001, T001 | **C** = Control, **T** = Treatment. Mã dùng xuyên suốt |
| `group` | Text | control / treatment | Phải viết chính xác "control" hoặc "treatment" |
| `gender` | Text | M / F / Other | Giới tính |
| `age` | Integer | 19 | Tuổi khi bắt đầu học |
| `major` | Text | CNTT, Toan Tin, HTTT | Ngành học |
| `class_code` | Text | CNTT-K65-01 | Mã lớp |
| `consent_signed` | Boolean | TRUE / FALSE | Đã ký phiếu đồng ý tham gia chưa? |
| `pre_score` | Float | 28.5 | Điểm Pre-test (0-60) |
| `pre_test_date` | Date | 2026-09-01 | Ngày làm pre-test |
| `post_score` | Float | 42.0 | Điểm Post-test (0-60). Nhập sau Tuần 15 |
| `post_test_date` | Date | 2026-12-15 | Ngày làm post-test |
| `midterm_grade` | Float | 6.5 | Điểm giữa kỳ chính thức (0-10) |
| `final_grade` | Float | 7.2 | Điểm thi cuối kỳ chính thức (0-10) × 10 |
| `dropout` | Integer | 0 / 1 | 1 = bỏ học/không hoàn thành, 0 = hoàn thành |
| `dropout_week` | Integer | 9 | Tuần nào bỏ học (để trống nếu không dropout) |
| `dropout_reason` | Text | Bỏ môn | Lý do dropout (nếu biết) |
| `interview_done` | Boolean | FALSE | Đã phỏng vấn chưa? |
| `notes` | Text | Nghỉ ốm tuần 3 | Ghi chú đặc biệt |

**Ví dụ dữ liệu:**
```
student_id | group     | gender | age | pre_score | post_score | final_grade | dropout
C001       | control   | M      | 19  | 25.0      | 38.0       | 65.0        | 0
C002       | control   | F      | 20  | 31.5      | 44.0       | 72.0        | 0
T001       | treatment | M      | 19  | 27.0      | 46.5       | 78.0        | 0
T002       | treatment | F      | 18  | 22.0      | 12.0       | 30.0        | 1
```

---

## SHEET 2: `submissions` — Bài Nộp Hàng Tuần

> Mỗi hàng = 1 bài nộp của 1 sinh viên trong 1 tuần.
> Tổng: 80 sinh viên × 15 tuần = **1,200 hàng** (lý tưởng).

| Tên cột | Kiểu dữ liệu | Ví dụ | Ghi chú |
|---------|-------------|-------|---------|
| `student_id` | Text | T001 | Khớp với Sheet 1 |
| `group` | Text | treatment | Khớp với Sheet 1 |
| `week` | Integer | 3 | Tuần số (1-15) |
| `assignment_id` | Text | BT03 | Mã bài tập |
| `submitted_at` | DateTime | 2026-09-15 14:30 | Thời điểm nộp bài cuối |
| `submissions_count` | Integer | 4 | Tổng số lần nộp (kể cả thử-sai) |
| `time_to_submit_hours` | Float | 6.5 | Tổng thời gian từ khi giao bài đến khi nộp |
| `git_commits` | Integer | 8 | Số commits (nếu dùng GitHub Classroom) |
| `test_pass_rate` | Float | 0.75 | % test cases pass (0.0-1.0) |
| **`tier1_score`** | Float | 31.0 | Điểm Tầng 1: Correctness (0-40) |
| **`tier2_score`** | Float | 22.5 | Điểm Tầng 2: Code Quality (0-35) |
| **`tier3_score`** | Float | 14.0 | Điểm Tầng 3: Computational Thinking (0-25) |
| **`total_score`** | Float | 67.5 | Tổng = tier1 + tier2 + tier3 (0-100) |
| `llm_proficiency_level` | Integer | 3 | Mức độ LLM đánh giá: 1-5 |
| `llm_feedback_length` | Integer | 342 | Số ký tự feedback LLM (proxy cho độ chi tiết) |
| `teacher_reviewed` | Boolean | FALSE | Giáo viên đã xem và confirm chưa? |
| `teacher_override_score` | Float |  | Điểm giáo viên sửa lại (để trống nếu giữ nguyên) |

**Ví dụ dữ liệu:**
```
student_id | group     | week | tier1_score | tier2_score | tier3_score | total_score
T001       | treatment | 1    | 25.0        | 14.0        | 5.0         | 44.0
T001       | treatment | 2    | 28.0        | 16.5        | 6.5         | 51.0
T001       | treatment | 7    | 35.0        | 22.0        | 12.0        | 69.0
T001       | treatment | 15   | 38.0        | 28.5        | 18.0        | 84.5
```

---

## SHEET 3: `llm_vs_human` — Calibration (So Sánh LLM vs Giảng Viên)

> Dùng để trả lời **RQ1**.
> Chọn **50-100 bài nộp** đại diện cho tất cả mức độ.
> 2-3 giảng viên chấm độc lập, sau đó so sánh với kết quả LLM.

| Tên cột | Kiểu dữ liệu | Ví dụ | Ghi chú |
|---------|-------------|-------|---------|
| `submission_id` | Text | CAL001 | Mã bài dùng để calibration |
| `student_id` | Text | T023 | Mã sinh viên (ẩn danh) |
| `week` | Integer | 5 | Tuần của bài nộp |
| **`human_score_g1`** | Float | 68.0 | Điểm của giảng viên 1 (0-100) |
| **`human_score_g2`** | Float | 72.0 | Điểm của giảng viên 2 |
| **`human_score_g3`** | Float | 65.0 | Điểm của giảng viên 3 (nếu có) |
| **`human_score_avg`** | Float | 68.3 | Trung bình điểm các giảng viên ← Ground truth |
| **`llm_score`** | Float | 70.5 | Điểm từ hệ thống LLM |
| `human_level` | Integer | 3 | Mức độ theo giảng viên (1-5) |
| `llm_level` | Integer | 3 | Mức độ theo LLM (1-5) |
| `grader_disagreement` | Boolean | FALSE | Các GV có bất đồng > 10 điểm không? |
| `notes` | Text | | Trường hợp đặc biệt cần bàn luận |

**Quy trình nhập:**
1. Export 50-100 bài nộp ngẫu nhiên (ẩn tên sinh viên)
2. Gửi cho từng GV chấm ĐỘC LẬP (không thảo luận trước)
3. Nhập điểm của từng GV vào cột tương ứng
4. Tính `human_score_avg` = AVERAGE(g1, g2, g3)
5. Chạy hệ thống LLM trên cùng bài, nhập vào `llm_score`
6. Tính `human_level` và `llm_level` tự động bằng công thức:
   ```excel
   =IF(H2>=90,5,IF(H2>=75,4,IF(H2>=55,3,IF(H2>=35,2,1))))
   ```

---

## SHEET 4: `early_warning` — Theo Dõi Cảnh Báo Sớm

> Dùng để trả lời **RQ5**.
> Nhập hàng tuần, so sánh dự đoán của hệ thống với kết quả thực cuối học kỳ.

| Tên cột | Kiểu dữ liệu | Ví dụ | Ghi chú |
|---------|-------------|-------|---------|
| `student_id` | Text | C015 | Mã sinh viên |
| `group` | Text | control | Nhóm |
| `week_assessed` | Integer | 4 | Tuần hệ thống đưa ra cảnh báo |
| `system_flag` | Boolean | TRUE | Hệ thống có cắm cờ "at-risk" không? |
| `system_risk_score` | Float | 0.78 | Điểm nguy cơ (0.0-1.0, từ model) |
| `teacher_notified` | Boolean | FALSE | Giáo viên đã được thông báo chưa? |
| `intervention_done` | Boolean | FALSE | Đã có can thiệp (hỗ trợ thêm) chưa? |
| `actual_at_risk` | Integer | 1 | **Kết quả thực tế:** 1=at-risk (điểm <50 hoặc dropout), 0=ổn |
| `predicted_at_risk` | Integer | 1 | **Dự đoán của model:** 1=at-risk, 0=ổn |
| `outcome_notes` | Text | Rớt môn | Ghi chú về kết quả cuối kỳ |

**Định nghĩa "at-risk" (actual_at_risk = 1) khi:**
- Điểm cuối kỳ `final_grade` < 50 điểm (dưới 5/10), HOẶC
- `dropout` = 1 (bỏ học)

---

## 📋 BẢNG KIỂM TRA TRƯỚC KHI PHÂN TÍCH

Trước khi chạy `statistical_analysis.py`, kiểm tra:

| # | Hạng mục | Yêu cầu | Đã đạt? |
|---|----------|---------|---------|
| 1 | Số sinh viên | ≥ 32 mỗi nhóm | ☐ |
| 2 | Sheet `students` hoàn chỉnh | Tất cả SV có pre_score + post_score + final_grade | ☐ |
| 3 | Sheet `submissions` | ≥ 10 tuần dữ liệu cho mỗi SV | ☐ |
| 4 | Sheet `llm_vs_human` | ≥ 50 bài calibration, đủ 2+ giảng viên chấm | ☐ |
| 5 | Sheet `early_warning` | Có actual_at_risk cho tất cả SV | ☐ |
| 6 | Ẩn danh hóa | Không có tên thật trong file Excel | ☐ |
| 7 | Backup | File được backup lên Google Drive / USB | ☐ |

---

## 🔐 QUY TRÌNH BẢO MẬT DỮ LIỆU

```
1. Lưu file Excel ở 2 nơi: máy tính cá nhân + Google Drive riêng tư
2. Đặt mật khẩu cho file Excel (Review → Protect Workbook)
3. Tạo file mapping riêng: "real_name ↔ student_id" (KHÔNG chia sẻ)
4. Chỉ 1 người (PI - Principal Investigator) biết file mapping
5. Sau khi nghiên cứu kết thúc, xóa file mapping (giữ lại file ẩn danh)
6. Báo cáo và bài báo chỉ dùng mã sinh viên, không bao giờ tên thật
```

---

## 🚀 CÁCH CHẠY PHÂN TÍCH

```bash
# Cài đặt thư viện
pip install pandas numpy scipy statsmodels scikit-learn matplotlib seaborn openpyxl

# Chạy với dữ liệu thật
python statistical_analysis.py --data student_data.xlsx --output results/

# Chạy thử với mock data (khi chưa có dữ liệu thật)
python statistical_analysis.py --output results/

# Kết quả sẽ có:
# results/baseline_equivalence.png   ← Kiểm tra 2 nhóm tương đồng
# results/rq1_llm_accuracy.png       ← Độ chính xác LLM vs human
# results/rq3_learning_outcomes.png  ← Hiệu quả giáo dục
# results/rq4_progression.png        ← Mô hình tiến bộ
# results/rq5_early_warning.png      ← Cảnh báo sớm
# results/research_results_summary.json ← Tổng hợp kết quả
```

---

*📅 Data Collection Template v1.0 — 15/06/2026*
