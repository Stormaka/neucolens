# 🔬 BƯỚC 3: THIẾT KẾ THỰC NGHIỆM (EXPERIMENTAL DESIGN)
## Nghiên cứu: "LLM-Assisted Adaptive Assessment for Introductory Programming"

> **Mục tiêu của bước này:** Định nghĩa CHÍNH XÁC cách thu thập dữ liệu, ai là đối tượng nghiên cứu, so sánh cái gì với cái gì, và đo lường bằng chỉ số nào.  
> Đây là phần **Methodology** trong bài báo khoa học — nếu phần này yếu, cả nghiên cứu sẽ bị phản biện từ chối.

---

## 1. 📐 Tổng Quan Thiết Kế Nghiên Cứu

### Loại thiết kế: **Quasi-Experimental Mixed-Methods Design**

```
        THỰC NGHIỆM
        (1 Học Kỳ)
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
NHÓM CONTROL      NHÓM TREATMENT
(n ≈ 35-40 SV)    (n ≈ 35-40 SV)

Học bình thường   Học bình thường
+ Chấm điểm       + Chấm điểm
  truyền thống       truyền thống
  (giáo viên)        (giáo viên)
                   + HỆ THỐNG LLM
                     cung cấp phản
                     hồi tức thì
                     sau mỗi bài nộp
    │                 │
    └────────┬─────────┘
             │
             ▼
    ĐO LƯỜNG & SO SÁNH
    • Điểm số cuối kỳ
    • Chất lượng code
    • Tốc độ tiến bộ
    • Trải nghiệm học
```

### Lý do chọn thiết kế này:
- **Quasi-experimental** (thay vì RCT): Vì không thể random hoàn toàn trong lớp học thực (có thể dùng 2 lớp học khác nhau cùng môn học)
- **Mixed-methods**: Kết hợp dữ liệu định lượng (điểm số) + định tính (phỏng vấn, survey) để có bức tranh toàn diện
- **Longitudinal**: Theo dõi suốt 1 học kỳ (15-16 tuần) để thấy được sự tiến bộ

---

## 2. 👥 Đối Tượng Nghiên Cứu (Participants)

### 2.1 Tiêu chí lựa chọn

**✅ Tiêu chí bao gồm (Inclusion Criteria):**
- Sinh viên đang học môn **Lập trình căn bản** (hoặc CS101 tương đương)
- Chưa có kinh nghiệm lập trình trước đó (người mới bắt đầu)
- Tự nguyện tham gia nghiên cứu và ký đồng thuận

**❌ Tiêu chí loại trừ (Exclusion Criteria):**
- Sinh viên đã từng học lập trình (có kinh nghiệm trước)
- Sinh viên đăng ký học lại (retake) môn học
- Sinh viên không tham gia >20% các buổi học

### 2.2 Cỡ mẫu (Sample Size)

**Tính toán cỡ mẫu:**
- Dựa trên nghiên cứu tương tự: effect size d = 0.5 (medium)
- Mức ý nghĩa α = 0.05 (tiêu chuẩn khoa học)
- Statistical power = 0.80 (đủ để phát hiện hiệu ứng thực)
- → **Cần tối thiểu 32 sinh viên mỗi nhóm**
- → **Mục tiêu: 40 sinh viên/nhóm (tổng 80 SV)** để bù cho dropout

### 2.3 Phân nhóm thực tế

| Nhóm | Mô tả | Cách thực hiện |
|------|-------|---------------|
| **Control** (Nhóm đối chứng) | 1 lớp học CS101 (~40 SV) | Dạy và chấm bình thường, không có LLM feedback |
| **Treatment** (Nhóm thực nghiệm) | 1 lớp học CS101 (~40 SV) | Có hệ thống LLM tạo phản hồi tự động sau mỗi bài nộp |

> **Cách đảm bảo 2 nhóm tương đồng:**
> - Cùng giáo viên dạy
> - Cùng giáo trình, cùng bài tập, cùng thời lượng
> - Kiểm tra trước (Pre-test) để đảm bảo baseline điểm tương đương

---

## 3. 📊 Các Biến Nghiên Cứu (Variables)

### 3.1 Biến độc lập (Independent Variable — "Nguyên nhân")
- **Có hay không có LLM feedback** (nhóm treatment vs control)

### 3.2 Biến phụ thuộc (Dependent Variables — "Kết quả đo lường")

| # | Biến | Đo bằng cách nào | Thời điểm đo |
|---|------|-------------------|-------------|
| DV1 | Điểm tổng kết môn học | Điểm cuối kỳ chính thức | Cuối học kỳ |
| DV2 | Chất lượng code | Hệ thống LLM chấm theo Rubric 3 tầng | Mỗi tuần |
| DV3 | Tốc độ tiến bộ | Slope của điểm số theo thời gian | Liên tục |
| DV4 | Code quality improvement | Điểm Tầng 2 và Tầng 3 thay đổi qua tuần | Liên tục |
| DV5 | Mức độ gắn kết (engagement) | Số lần nộp/tuần, thời gian trung bình | Liên tục |
| DV6 | Trải nghiệm học tập | Survey 5-Likert (SUS, survey tự thiết kế) | Giữa và cuối học kỳ |

### 3.3 Biến kiểm soát (Control Variables — "Yếu tố cần giữ cố định")

| Biến | Cách kiểm soát |
|------|---------------|
| Giáo viên | Cùng 1 giáo viên dạy cả 2 lớp |
| Tài liệu học | Cùng slide, bài tập, video |
| Thời lượng | Cùng số buổi, cùng số giờ |
| Đề thi cuối kỳ | Cùng 1 đề thi |
| Trình độ ban đầu | Kiểm tra bằng Pre-test (điều chỉnh trong phân tích) |

---

## 4. 📋 Công Cụ Thu Thập Dữ Liệu (Data Collection Instruments)

### 🛠️ Công cụ 1: Pre-test & Post-test (Kiểm tra đầu và cuối)

**Pre-test (Tuần 1):** Đánh giá trình độ ban đầu
```
Phần A — Tư duy logic (10 câu trắc nghiệm):
  Q1. Cho dãy số [3,1,4,1,5,9], sort tăng dần ra kết quả gì?
  Q2. Vòng lặp nào in ra: 1, 3, 5, 7, 9?
  ...

Phần B — Bài toán ngắn (không cần code, chỉ viết thuật toán):
  Q11. Mô tả từng bước bạn sẽ làm để tìm số lớn nhất trong list?
  Q12. Nếu cần tính tổng 1+2+3+...+100, bạn sẽ làm gì?
  ...
```

**Post-test (Tuần 15):** Đánh giá sau học kỳ — CÙNG cấu trúc với pre-test nhưng bài khác để tránh học thuộc

**Chỉ số tính từ Pre/Post-test:**
```
Learning Gain = (Post_score - Pre_score) / (Max_score - Pre_score) × 100%
```

---

### 🛠️ Công cụ 2: Bộ Bài Tập Chuẩn Hóa (Standardized Assignments)

**15 tuần = 15 bài tập** được thiết kế theo độ khó tăng dần:

| Tuần | Chủ đề | Độ khó | Tên bài |
|------|--------|--------|---------|
| 1 | Variables & I/O | ⭐ | In thông tin cá nhân |
| 2 | Conditional | ⭐ | Kiểm tra số chẵn lẻ |
| 3 | Loops | ⭐⭐ | Bảng cửu chương |
| 4 | Functions (basic) | ⭐⭐ | Tính diện tích hình học |
| 5 | Lists | ⭐⭐ | Quản lý danh sách điểm |
| 6 | Strings | ⭐⭐ | Xử lý họ tên sinh viên |
| 7 | Functions (advanced) | ⭐⭐⭐ | Tính điểm trung bình và xếp loại |
| 8 | File I/O | ⭐⭐⭐ | Đọc/ghi file điểm sinh viên |
| 9 | Dictionaries | ⭐⭐⭐ | Quản lý từ điển mini |
| 10 | Recursion | ⭐⭐⭐⭐ | Tính giai thừa, Fibonacci |
| 11 | Error Handling | ⭐⭐⭐ | Xử lý lỗi nhập liệu |
| 12 | OOP basics | ⭐⭐⭐⭐ | Class Student |
| 13 | OOP advanced | ⭐⭐⭐⭐ | Kế thừa, đa hình |
| 14 | Mini Project (setup) | ⭐⭐⭐⭐⭐ | Hệ thống quản lý lớp học |
| 15 | Mini Project (submit) | ⭐⭐⭐⭐⭐ | Hoàn thiện & demo |

**Mỗi bài tập có:**
- Mô tả đề bài (tiếng Việt, rõ ràng)
- Bộ test cases chuẩn (10 test/bài, bao gồm edge cases)
- Tiêu chí chấm điểm theo Rubric (đã thiết kế ở Bước 2)

---

### 🛠️ Công cụ 3: Bộ Khảo Sát (Surveys)

#### Survey S1 — Khảo sát trải nghiệm học tập (Giữa kỳ, Tuần 8)

```
PHẦN 1: Thông tin cơ bản
  SV01. Giới tính: □ Nam  □ Nữ  □ Khác
  SV02. Đây là lần đầu bạn học lập trình? □ Có  □ Không
  SV03. Bạn dành bao nhiêu giờ/tuần tự học thêm lập trình?
        □ <1h  □ 1-3h  □ 3-5h  □ >5h

PHẦN 2: Về hệ thống phản hồi LLM (chỉ dành cho nhóm Treatment)
  [Thang đo Likert 5 mức: 1=Hoàn toàn không đồng ý → 5=Hoàn toàn đồng ý]
  
  LLM01. Phản hồi từ hệ thống giúp tôi hiểu lỗi sai của mình.
          □1  □2  □3  □4  □5
  LLM02. Phản hồi đủ cụ thể để tôi biết phải sửa gì.
          □1  □2  □3  □4  □5
  LLM03. Tôi đọc phản hồi của hệ thống sau mỗi lần nộp bài.
          □1  □2  □3  □4  □5
  LLM04. Phản hồi của hệ thống tốt hơn/bằng/kém hơn phản hồi của thầy cô?
          □ Tốt hơn  □ Tương đương  □ Kém hơn
  LLM05. Tôi cảm thấy tự tin hơn khi lập trình nhờ hệ thống này.
          □1  □2  □3  □4  □5

PHẦN 3: Trải nghiệm học lập trình chung
  EX01. Tôi cảm thấy thoải mái khi đối mặt với lỗi trong code.
        □1  □2  □3  □4  □5
  EX02. Khi gặp bài khó, tôi cố gắng tự giải quyết trước.
        □1  □2  □3  □4  □5
  EX03. Tôi hiểu TẠI SAO code của mình đúng hoặc sai (không chỉ biết kết quả).
        □1  □2  □3  □4  □5
  EX04. Tôi lo lắng mình sẽ không theo kịp môn học này.
        □1  □2  □3  □4  □5
  EX05. Tôi muốn học thêm về lập trình sau môn này.
        □1  □2  □3  □4  □5

PHẦN 4: Câu hỏi mở (tự do viết)
  OPEN01. Điều gì giúp bạn học lập trình hiệu quả nhất?
  OPEN02. Khó khăn lớn nhất bạn đang gặp là gì?
  OPEN03. Bạn muốn nhận được hỗ trợ thêm về điều gì?
```

#### Survey S2 — Khảo sát cuối kỳ (Tuần 15)
*Tương tự S1 nhưng bổ sung thêm:*
```
  FINAL01. Nhìn lại, điều gì đã giúp bạn tiến bộ nhất trong học kỳ này?
  FINAL02. Nếu có thể thay đổi 1 điều trong cách dạy/học môn này, bạn muốn thay gì?
  FINAL03. So với đầu học kỳ, bạn cảm thấy kỹ năng lập trình của mình:
           □ Tốt hơn rất nhiều  □ Tốt hơn  □ Không đổi  □ Kém hơn
```

---

### 🛠️ Công cụ 4: Phỏng Vấn Bán Cấu Trúc (Semi-structured Interview)

**Mục đích:** Thu thập dữ liệu định tính sâu hơn để giải thích các số liệu định lượng.

**Đối tượng phỏng vấn:**
- 8-10 sinh viên nhóm Treatment (chọn đại diện các mức độ: giỏi, trung bình, yếu)
- 2-3 giáo viên tham gia nghiên cứu

**Thời gian:** 20-30 phút/người, thu âm (với sự đồng ý)

**Câu hỏi phỏng vấn sinh viên:**
```
[Dành cho sinh viên nhóm Treatment]

Phần 1 — Trải nghiệm với hệ thống LLM:
  I01. Bạn mô tả cách bạn sử dụng phản hồi của hệ thống như thế nào?
  I02. Có lần nào phản hồi của hệ thống giúp bạn "à ha!" hiểu ra điều gì đó không?
       Kể cho tôi nghe?
  I03. Có lần nào phản hồi của hệ thống sai hoặc không hữu ích không? Ví dụ?

Phần 2 — Quá trình học:
  I04. Khi gặp lỗi trong code, bạn thường làm gì đầu tiên?
       (Trước và sau khi có hệ thống LLM)
  I05. Bạn có nhận thấy mình lập trình khác đi so với đầu học kỳ không?
       Khác như thế nào?

Phần 3 — Feedback về hệ thống:
  I06. Nếu bạn có thể cải thiện 1 điều về hệ thống phản hồi, bạn muốn thay gì?
  I07. Bạn có nghĩ hệ thống này nên được dùng rộng rãi không? Tại sao?
```

**Câu hỏi phỏng vấn giáo viên:**
```
  T01. Giáo viên nhận thấy điểm khác biệt nào giữa 2 nhóm trong quá trình dạy?
  T02. Hệ thống LLM có thay đổi cách giáo viên tổ chức lớp học không?
  T03. Giáo viên tin tưởng vào kết quả đánh giá của hệ thống LLM không?
       Ở mức độ nào?
  T04. Những hạn chế nào của hệ thống mà giáo viên quan sát được?
```

---

## 5. 📏 Chỉ Số Đánh Giá (Evaluation Metrics)

### 5.1 Về Độ Chính Xác Của LLM (Trả lời RQ1)

| Chỉ số | Công thức | Mục tiêu |
|--------|-----------|----------|
| **Cohen's Kappa (κ)** | κ = (Po - Pe) / (1 - Pe) | κ > 0.61 (Substantial agreement) |
| **Pearson Correlation (r)** | r(LLM_score, Human_score) | r > 0.75 |
| **Mean Absolute Error (MAE)** | Σ\|LLM - Human\| / n | MAE < 5 điểm (trên thang 100) |
| **Bias Analysis** | Mean(LLM - Human) | Gần 0 (không có systematic bias) |

### 5.2 Về Hiệu Quả Giáo Dục (Trả lời RQ3)

| Chỉ số | Đo bằng | Kỳ vọng |
|--------|---------|---------|
| **Learning Gain** | (Post - Pre) / (Max - Pre) | Treatment > Control |
| **Grade Improvement Rate** | % SV cải thiện điểm từ giữa kỳ → cuối kỳ | Treatment > Control |
| **Code Quality Growth** | Slope của Rubric score qua 15 tuần | Treatment có slope dốc hơn |
| **Tier 3 Growth** | Điểm Tầng 3 tuần 15 - tuần 1 | Treatment > Control (đây là điểm đột phá) |

### 5.3 Về Mô Hình Tiến Bộ (Trả lời RQ4)

| Chỉ số | Phương pháp | Mô tả |
|--------|-------------|-------|
| **Skill Trajectory** | Linear regression trên score theo thời gian | Slope > 0 = tiến bộ |
| **Learning Rate** | Slope của điểm số qua các tuần | So sánh 2 nhóm |
| **Knowledge Stability** | Std deviation của điểm số | Thấp = ổn định hơn |
| **Tier-specific growth** | Phân tích riêng từng tầng | Tầng nào tiến bộ nhanh nhất? |

### 5.4 Về Phát Hiện Sớm (Trả lời RQ5)

| Chỉ số | Công thức | Mục tiêu |
|--------|-----------|---------|
| **Precision** | TP / (TP + FP) | > 0.80 |
| **Recall** | TP / (TP + FN) | > 0.75 |
| **F1 Score** | 2 × P × R / (P + R) | > 0.77 |
| **Early Detection Rate** | % SV at-risk phát hiện trước tuần 6 | > 70% |

---

## 6. 📅 Kế Hoạch Thu Thập Dữ Liệu (Data Collection Timeline)

### Mỗi Tuần Trong Học Kỳ:

```
TUẦN 1:
  □ Phát và giải thích phiếu đồng ý (Informed Consent Form)
  □ Chạy Pre-test (30 phút đầu buổi học)
  □ Setup hệ thống: nhóm Treatment được hướng dẫn dùng hệ thống
  □ Thu thập thông tin cơ bản (demographics form)
  □ Nộp Bài tập 01

TUẦN 2-7:
  □ Mỗi tuần: thu thập code submissions từ cả 2 nhóm
  □ Nhóm Treatment: hệ thống LLM tự động phân tích và gửi feedback
  □ Nhóm Control: giáo viên chấm bình thường
  □ Ghi lại: submission_count, time_of_submission, code per student

TUẦN 8 (GIỮA KỲ):
  □ Chạy Survey S1 (Khảo sát giữa kỳ)
  □ Kiểm tra giữa kỳ (do nhà trường tổ chức)
  □ Bắt đầu phỏng vấn 4-5 SV đầu tiên (nhóm Treatment)

TUẦN 9-14:
  □ Tiếp tục thu thập submissions
  □ Monitor at-risk students qua ProficiencyTracker
  □ Ghi nhận các can thiệp (nếu có) của giáo viên

TUẦN 15:
  □ Nộp bài tập cuối (Mini Project)
  □ Chạy Survey S2 (Khảo sát cuối kỳ)
  □ Chạy Post-test

SAU HỌC KỲ:
  □ Thu thập điểm thi cuối kỳ chính thức
  □ Phỏng vấn thêm 4-5 SV còn lại
  □ Phỏng vấn giáo viên
  □ Export toàn bộ dữ liệu để phân tích
```

---

## 7. 🔐 Đạo Đức Nghiên Cứu (Research Ethics)

### Phiếu Đồng Ý Tham Gia (Informed Consent Form)

```
╔══════════════════════════════════════════════════════════════╗
║          PHIẾU ĐỒNG Ý THAM GIA NGHIÊN CỨU KHOA HỌC         ║
╚══════════════════════════════════════════════════════════════╝

Tên nghiên cứu: Ứng dụng LLM trong đánh giá năng lực lập trình
Đơn vị thực hiện: [Tên trường/khoa]
Người nghiên cứu: [Tên nghiên cứu viên]

MỤC ĐÍCH NGHIÊN CỨU:
Nghiên cứu này nhằm tìm hiểu xem hệ thống phản hồi tự động có giúp
sinh viên học lập trình hiệu quả hơn không.

DỮ LIỆU SẼ THU THẬP:
✓ Code bài tập của bạn (ẩn danh hoá trước khi phân tích)
✓ Điểm số và kết quả test cases
✓ Lịch sử nộp bài (thời gian, số lần)
✓ Câu trả lời khảo sát (ẩn danh)
✓ Phỏng vấn (nếu bạn đồng ý, có thể rút lui bất kỳ lúc nào)

CAM KẾT BẢO MẬT:
✓ Mọi dữ liệu được mã hóa và ẩn danh hóa
✓ Không chia sẻ dữ liệu cá nhân với bất kỳ bên thứ ba nào
✓ Không ảnh hưởng đến điểm số chính thức của bạn
✓ Bạn có thể rút khỏi nghiên cứu bất kỳ lúc nào không cần giải thích

Bằng cách ký tên dưới đây, tôi đồng ý tham gia nghiên cứu.

Họ tên: _________________ Ngày: _______
Chữ ký: _________________
```

### Nguyên Tắc Bảo Mật Dữ Liệu:
1. **Ẩn danh hóa:** Thay tên bằng mã (SV001, SV002...) ngay khi thu thập
2. **Lưu trữ an toàn:** Database mã hóa AES-256, chỉ nghiên cứu viên chính có quyền truy cập
3. **Thời hạn lưu:** Tối đa 5 năm sau khi nghiên cứu kết thúc
4. **Không ảnh hưởng điểm:** Kết quả từ hệ thống LLM KHÔNG được dùng làm điểm chính thức

---

## 8. 📊 Kế Hoạch Phân Tích Thống Kê (Statistical Analysis Plan)

### 8.1 Kiểm Tra Sự Tương Đồng Ban Đầu (Baseline Equivalence)

```python
# Sau khi có Pre-test, kiểm tra 2 nhóm có tương đồng không
# Nếu p > 0.05 → 2 nhóm không có sự khác biệt đáng kể ban đầu → tốt

from scipy import stats

# Independent samples t-test cho điểm Pre-test
t_stat, p_value = stats.ttest_ind(control_pretest_scores, 
                                   treatment_pretest_scores)
print(f"Pre-test equivalence: t={t_stat:.3f}, p={p_value:.3f}")
# Mục tiêu: p > 0.05
```

### 8.2 Phân Tích Hiệu Quả Chính (Main Effects)

```python
# So sánh Learning Gain giữa 2 nhóm
# Mann-Whitney U test (vì dữ liệu thường không có phân phối chuẩn với n nhỏ)

from scipy.stats import mannwhitneyu

stat, p = mannwhitneyu(control_learning_gains, treatment_learning_gains,
                        alternative='less')  # H1: Treatment > Control
effect_size_r = stat / (len(control) * len(treatment))  # Effect size

# Cohen's d cho Effect Size
import numpy as np
pooled_std = np.sqrt((np.std(control)**2 + np.std(treatment)**2) / 2)
cohens_d = (np.mean(treatment) - np.mean(control)) / pooled_std
```

### 8.3 Phân Tích Tiến Bộ Theo Thời Gian (Longitudinal Analysis)

```python
# Repeated Measures ANOVA hoặc Mixed-effects model
# Để phân tích điểm số thay đổi như thế nào qua 15 tuần

from statsmodels.formula.api import mixedlm
import pandas as pd

# Model: score ~ week * group + (1|student_id)
# week: biến thời gian (1-15)
# group: control/treatment
# (1|student_id): random effect cho từng sinh viên

model = mixedlm("score ~ week * group", data=df,
                 groups=df["student_id"])
result = model.fit()
print(result.summary())
```

### 8.4 Phân Tích Độ Chính Xác LLM (LLM Accuracy Analysis)

```python
from sklearn.metrics import cohen_kappa_score
from scipy.stats import pearsonr
import numpy as np

# So sánh điểm LLM vs điểm giáo viên (trên cùng tập 50 bài)
llm_scores = [72, 68, 85, 45, ...]    # Điểm từ hệ thống LLM
human_scores = [75, 65, 82, 50, ...]  # Điểm từ giáo viên

# Cohen's Kappa (phân loại mức độ)
llm_levels = [classify_level(s) for s in llm_scores]
human_levels = [classify_level(s) for s in human_scores]
kappa = cohen_kappa_score(llm_levels, human_levels)

# Pearson Correlation (điểm số liên tục)
r, p = pearsonr(llm_scores, human_scores)

# Mean Absolute Error
mae = np.mean(np.abs(np.array(llm_scores) - np.array(human_scores)))

print(f"Cohen's Kappa: κ = {kappa:.3f}")
print(f"Pearson r = {r:.3f} (p = {p:.4f})")
print(f"MAE = {mae:.2f} điểm")
```

---

## 9. 🧪 Pilot Study Protocol (Nghiên Cứu Thử)

> **Lý do quan trọng:** Trước khi chạy main study trên 80 SV, phải chạy thử nhỏ để phát hiện vấn đề với rubric, hệ thống, và quy trình.

### Timeline Pilot Study (4 tuần, trước học kỳ chính):

```
Pilot Tuần 1:
  • Tuyển 10-15 sinh viên tình nguyện (không phải sample chính)
  • Setup toàn bộ hệ thống kỹ thuật
  • Chạy thử Pre-test với nhóm nhỏ

Pilot Tuần 2-3:
  • Cho SV nộp 3 bài tập mẫu
  • Hệ thống LLM chạy thử, kiểm tra output
  • Giáo viên xem xét feedback của LLM: "Có hợp lý không?"

Pilot Tuần 4 (Calibration):
  • 3 giáo viên chấm độc lập 20 bài mẫu
  • LLM chấm cùng 20 bài đó
  • Tính Cohen's Kappa giữa người-người và người-LLM
  • Nếu κ < 0.6: điều chỉnh lại rubric và prompt
  • Nếu κ ≥ 0.6: tiến hành main study

Sau Pilot:
  • Thu thập feedback từ SV tình nguyện về UX
  • Sửa lỗi kỹ thuật nếu có
  • Hoàn thiện bộ survey và phỏng vấn
  • Phê duyệt từ Hội đồng đạo đức (nếu trường yêu cầu)
```

---

## 10. 📅 Gantt Chart — Kế Hoạch Toàn Bộ Nghiên Cứu

```
                    T1  T2  T3  T4  T5  T6  T7  T8  T9  T10 T11 T12
                   ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
Literature Review  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
Thiết kế Rubric    ░░░░████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
Xây dựng hệ thống  ░░░░████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
Pilot Study        ░░░░░░░░████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
Điều chỉnh system  ░░░░░░░░░░██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
► MAIN STUDY ◄     ░░░░░░░░░░░░████████████░░░░░░░░░░░░░░░░░░░░
  (1 học kỳ)
Phân tích dữ liệu  ░░░░░░░░░░░░░░░░░░░░░░░░████░░░░░░░░░░░░░░░░
Phỏng vấn + QA     ░░░░░░░░░░░░░░░░░░░░░░░░░░██░░░░░░░░░░░░░░░░
Viết bài báo       ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████░░░░░░░░░░░░
Peer review nội bộ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██░░░░░░░░░░
Submit bài báo     ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██░░░░░░░░
Revise & resubmit  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██░░░░
                   T1  T2  T3  T4  T5  T6  T7  T8  T9  T10 T11 T12
```

---

## 11. ✅ Checklist Hoàn Thành Bước 3

- [ ] Xin phê duyệt từ Hội đồng đạo đức nghiên cứu (IRB) của trường
- [ ] Liên hệ và xin phép giáo viên dạy CS101 tham gia
- [ ] Xin phép ban chủ nhiệm khoa/bộ môn
- [ ] Finalize bộ bài tập 15 tuần (có đáp án và test cases)
- [ ] Deploy hệ thống kỹ thuật lên server của trường
- [ ] Thử nghiệm kỹ thuật với dữ liệu giả
- [ ] In và phát phiếu đồng ý tham gia
- [ ] Huấn luyện giáo viên cách sử dụng Teacher Dashboard
- [ ] Chạy Pilot Study (4 tuần)
- [ ] Đánh giá và điều chỉnh sau Pilot
- [ ] **Bắt đầu Main Study**

---

*📅 Experimental Design v1.0 — Ngày: 15/06/2026*
*🔄 Cần review với giáo viên hướng dẫn trước khi triển khai*
