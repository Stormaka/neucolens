# 🎓 Đề Xuất Nghiên Cứu Khoa Học

## Tên đề tài (Tiêu đề đề xuất)

> **"LLM-Assisted Adaptive Assessment: Leveraging Large Language Models for Automated Proficiency Tracking and Personalized Feedback in Introductory Programming Education"**
>
> *(Tiếng Việt: Đánh Giá Thích Ứng Hỗ Trợ LLM: Ứng Dụng Mô Hình Ngôn Ngữ Lớn Để Theo Dõi Năng Lực Lập Trình Và Phản Hồi Cá Nhân Hóa Trong Giáo Dục Lập Trình Căn Bản)*

---

## 1. 🌍 Bối Cảnh & Động Lực Nghiên Cứu

### Vấn đề hiện tại
- Các lớp học lập trình nhập môn thường có **sĩ số lớn** (30–100 sinh viên), giáo viên không thể theo dõi chi tiết từng sinh viên.
- Bài tập lập trình truyền thống chỉ đánh giá **đúng/sai** (pass/fail) mà bỏ qua **chất lượng tư duy**, **phong cách code**, **điểm yếu cụ thể**.
- Sinh viên không nhận được **phản hồi kịp thời** và **cá nhân hóa**, dẫn đến bỏ cuộc hoặc tiến bộ chậm.
- Giáo viên thiếu công cụ để **hiểu mức độ tiến bộ tổng thể** của cả lớp theo thời gian.

### Tại sao LLM là giải pháp tiềm năng?
- LLM (GPT-4, Claude, Gemini, CodeLlama...) có khả năng **đọc hiểu và phân tích code** ở mức độ ngữ nghĩa, không chỉ cú pháp.
- Có thể sinh **phản hồi tự nhiên bằng ngôn ngữ** phù hợp với trình độ sinh viên.
- Có thể **phát hiện các pattern** tư duy lập trình (debugging strategy, abstraction level, code smell...).

---

## 2. 🎯 Câu Hỏi Nghiên Cứu (Research Questions)

| # | Câu hỏi | Loại |
|---|---------|------|
| RQ1 | LLM có thể đánh giá năng lực lập trình của sinh viên chính xác như thế nào so với chuyên gia con người? | Độ chính xác |
| RQ2 | Những chiều kích nào của năng lực lập trình mà LLM có thể nhận diện được từ code submission? | Phân loại |
| RQ3 | Phản hồi từ LLM có thực sự cải thiện kết quả học tập của sinh viên không? | Hiệu quả |
| RQ4 | Mô hình tiến bộ (progression model) nào phản ánh chính xác nhất sự phát triển năng lực theo thời gian? | Mô hình hóa |
| RQ5 | Có thể phát hiện sớm sinh viên có nguy cơ bỏ cuộc (early dropout prediction) không? | Dự đoán |

---

## 3. 🏗️ Kiến Trúc Hệ Thống Đề Xuất

```
┌─────────────────────────────────────────────────────────────────┐
│                    STUDENT SUBMISSION PORTAL                    │
│         (Web App: submit code, view feedback, history)          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Code + Metadata
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CODE ANALYSIS PIPELINE                        │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Static     │  │ Test Runner  │  │ LLM Prompt Engine      │  │
│  │ Analysis   │  │ (pytest,     │  │ (multi-turn, CoT       │  │
│  │ (AST, CC,  │  │  judge0)     │  │  reasoning, rubric)    │  │
│  │  Linting)  │  └──────────────┘  └────────────────────────┘  │
│  └────────────┘                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                 PROFICIENCY MODELING ENGINE                     │
│  ┌────────────────────┐    ┌──────────────────────────────────┐ │
│  │ Skill Taxonomy     │    │ Temporal Progression Tracker     │ │
│  │ (Bloom's + Code)   │    │ (IRT / Knowledge Tracing model)  │ │
│  └────────────────────┘    └──────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
┌─────────────────────┐     ┌───────────────────────┐
│  STUDENT DASHBOARD  │     │  TEACHER DASHBOARD    │
│  - Feedback report  │     │  - Class heatmap      │
│  - My skill radar   │     │  - At-risk students   │
│  - Progress chart   │     │  - Topic weak spots   │
└─────────────────────┘     └───────────────────────┘
```

---

## 4. 📐 Khung Phân Tích Năng Lực (Proficiency Taxonomy)

Đề xuất **Khung 3 tầng** kết hợp Bloom's Taxonomy + Code Quality Dimensions:

### Tầng 1 – Correctness (Tính đúng đắn)
- Bài toán có được giải đúng không?
- Test case pass rate
- Edge case handling

### Tầng 2 – Code Quality (Chất lượng code)
- **Readability**: tên biến, comment, formatting
- **Efficiency**: độ phức tạp thời gian/không gian
- **Modularity**: sử dụng hàm, tách logic
- **Idiomatic**: viết đúng phong cách ngôn ngữ

### Tầng 3 – Computational Thinking (Tư duy lập trình)
- **Decomposition**: chia nhỏ vấn đề
- **Abstraction**: mức độ tổng quát hóa
- **Pattern recognition**: tái sử dụng giải pháp
- **Debugging strategy**: cách tiếp cận sửa lỗi (qua revision history)

> **Đây là điểm độc đáo của nghiên cứu**: đánh giá cả Tầng 3 – thứ mà các hệ thống truyền thống bỏ qua hoàn toàn.

---

## 5. 🔬 Phương Pháp Nghiên Cứu

### 5.1 Thiết kế nghiên cứu
**Mixed-Methods Research Design** (kết hợp định lượng + định tính):

```
Phase 1: System Development (3 tháng)
  → Xây dựng pipeline LLM analysis
  → Thiết kế rubric đánh giá
  → Calibration với chuyên gia

Phase 2: Pilot Study (1 học kỳ)
  → 1-2 lớp học (~50-80 SV)
  → Thu thập data: code submissions, revision history, grades

Phase 3: Main Study (1-2 học kỳ)
  → Control group (đánh giá truyền thống)
  → Treatment group (đánh giá + feedback từ LLM)
  → So sánh kết quả học tập

Phase 4: Analysis & Validation (2 tháng)
  → Statistical analysis
  → Qualitative interviews với SV & GV
  → Expert validation
```

### 5.2 Dữ liệu thu thập

| Loại dữ liệu | Nguồn | Mục đích |
|---|---|---|
| Code submissions | LMS / GitHub Classroom | Phân tích chính |
| Revision history | Git commits | Phân tích debugging |
| Test results | Auto-grader | Ground truth |
| Teacher grades | Manual grading | Validation baseline |
| Student surveys | Google Forms | Trải nghiệm người dùng |
| Learning outcomes | Final exam scores | Đo hiệu quả intervention |

### 5.3 Kỹ thuật LLM Prompting

**Chiến lược đề xuất:**
1. **Chain-of-Thought (CoT) Prompting**: yêu cầu LLM giải thích từng bước đánh giá
2. **Rubric-Grounded Evaluation**: cung cấp rubric chi tiết trong prompt
3. **Comparative Prompting**: so sánh submission hiện tại với submission trước của cùng sinh viên
4. **Persona Prompting**: LLM đóng vai mentor lập trình kinh nghiệm
5. **Iterative Refinement**: multi-turn dialogue để làm rõ điểm yếu

---

## 6. 📊 Chỉ Số Đánh Giá (Evaluation Metrics)

### Về độ chính xác của LLM
- **Cohen's Kappa** (κ): độ đồng thuận giữa LLM và chuyên gia
- **Pearson/Spearman correlation**: tương quan điểm LLM vs. điểm thầy
- **Precision/Recall/F1** cho từng chiều kỹ năng

### Về hiệu quả giáo dục
- **Learning Gain Score**: (Post-test − Pre-test) / (Max − Pre-test)
- **Code quality improvement rate** qua các tuần
- **Time-to-completion** giảm hay tăng?
- **Dropout/Disengagement rate** của nhóm treatment vs. control

### Về trải nghiệm người dùng
- **SUS Score** (System Usability Scale) cho giáo viên & sinh viên
- **Qualitative themes** từ phỏng vấn

---

## 7. 💡 Điểm Mới & Đóng Góp Khoa Học (Novelty & Contributions)

> [!IMPORTANT]
> Đây là những yếu tố giúp bài báo được chấp nhận tại các hội nghị/tạp chí uy tín.

1. **Khung đánh giá 3 tầng mới**: Kết hợp Bloom's Taxonomy với Code Quality Dimensions — chưa có trong literature.

2. **Phân tích revision history**: Dùng LLM để hiểu *quá trình* tư duy qua các lần commit, không chỉ sản phẩm cuối.

3. **Mô hình tiến bộ theo thời gian**: Ứng dụng Deep Knowledge Tracing (DKT) kết hợp với LLM embedding để track skill trajectory.

4. **Early Warning System**: Hệ thống cảnh báo sớm sinh viên có nguy cơ học kém dựa trên behavioral patterns.

5. **Human-AI Calibration Study**: Nghiên cứu so sánh có hệ thống giữa LLM và chuyên gia con người — cung cấp benchmark cho cộng đồng.

---

## 8. 🛠️ Technology Stack Đề Xuất

### Backend
- **Language**: Python
- **LLM API**: OpenAI GPT-4o / Anthropic Claude / Google Gemini (so sánh nhiều model)
- **Code Execution**: Judge0 API hoặc Docker sandbox
- **Static Analysis**: `ast` (Python), `pylint`, `radon` (cyclomatic complexity)
- **ML**: scikit-learn, PyTorch (cho Knowledge Tracing models)

### Data Storage
- **PostgreSQL**: lưu submissions, grades, metadata
- **MongoDB**: lưu LLM responses (unstructured)
- **Redis**: caching LLM responses

### Frontend Dashboard
- **React + TypeScript** (Teacher Dashboard)
- **Next.js** (Student Portal)
- **Recharts / D3.js** (visualization)

### Infrastructure
- **GitHub Classroom**: thu thập submissions và revision history
- **Jupyter Notebooks**: analysis và reproducible experiments

---

## 9. 📅 Kế Hoạch Thực Hiện (Timeline)

```
Tháng 1-2  : Literature review, xác định gap, thiết kế framework
Tháng 3-4  : Xây dựng hệ thống (pipeline + dashboard MVP)
Tháng 5    : Pilot study (1 lớp nhỏ, ~20 SV), thu thập feedback
Tháng 6    : Tinh chỉnh prompts, rubric, system
Tháng 7-9  : Main study (2 lớp: treatment + control)
Tháng 10   : Data analysis, viết kết quả
Tháng 11   : Viết bài báo, peer review nội bộ
Tháng 12   : Submit bài báo
```

---

## 10. 📚 Hướng Công Bố (Publication Strategy)

### Hội nghị mục tiêu (Tier A/B)
| Venue | Deadline thường | Phạm vi |
|-------|----------------|---------|
| **SIGCSE** (ACM) | Tháng 8-9 | CS Education flagship |
| **EDM** (Educational Data Mining) | Tháng 2 | Learning analytics |
| **L@S** (Learning at Scale) | Tháng 1-2 | Large-scale education |
| **ICER** (ACM) | Tháng 3-4 | CS Education research |
| **NeurIPS Workshop on AI4Ed** | Tháng 9 | AI in Education |

### Tạp chí mục tiêi (nếu muốn journal)
- *Computers & Education* (Elsevier, Q1)
- *ACM Transactions on Computing Education (TOCE)*
- *Journal of Educational Data Mining*

---

## 11. ⚠️ Thách Thức & Hướng Giải Quyết

| Thách thức | Giải pháp |
|-----------|-----------|
| LLM hallucinate/đánh giá sai | Rubric-grounded prompting + human-in-the-loop validation |
| Chi phí API LLM cao | Dùng local models (CodeLlama, Ollama) + caching |
| Vấn đề privacy của sinh viên | Anonymize data, IRB approval |
| Sinh viên dùng AI để làm bài | Nghiên cứu thêm về AI-assisted coding detection |
| Ground truth ít/không nhất quán | Inter-rater reliability study với nhiều chuyên gia |
| Lớp học ngôn ngữ khác (C, Java...) | Thiết kế language-agnostic pipeline |

---

## 12. 🧩 Các Hướng Mở Rộng (Future Work)

1. **Multilingual support**: Mở rộng sang C/C++, Java, JavaScript
2. **Adaptive problem recommendation**: LLM gợi ý bài tập phù hợp với trình độ từng sinh viên
3. **Peer learning facilitation**: Ghép cặp sinh viên có thể học hỏi lẫn nhau
4. **Teacher professional development**: LLM giúp giáo viên cải thiện đề bài
5. **Federated learning**: Huấn luyện mô hình trên nhiều trường mà không chia sẻ dữ liệu nhạy cảm

---

## 13. 📋 Cấu Trúc Bài Báo Đề Xuất

```
1. Abstract
2. Introduction
   2.1 Problem Statement
   2.2 Research Contributions
3. Related Work
   3.1 Automated Code Assessment
   3.2 LLMs in Education
   3.3 Student Proficiency Modeling
4. Methodology
   4.1 System Architecture
   4.2 Proficiency Taxonomy
   4.3 LLM Prompting Strategy
   4.4 Temporal Modeling
5. Experimental Setup
   5.1 Dataset & Participants
   5.2 Evaluation Protocol
6. Results & Analysis
   6.1 RQ1: LLM vs. Human Agreement
   6.2 RQ2: Skill Dimensions Identified
   6.3 RQ3: Learning Outcome Impact
   6.4 RQ4: Progression Model Performance
   6.5 RQ5: Early Warning System
7. Discussion
   7.1 Findings Interpretation
   7.2 Limitations
   7.3 Ethical Considerations
8. Conclusion & Future Work
References
Appendix (Prompt Templates, Rubrics, Survey Instruments)
```

---

> [!TIP]
> **Gợi ý ưu tiên**: Bắt đầu với RQ1 và RQ2 để có một bài báo ngắn (short paper) submit SIGCSE trong khi chạy main study. Sau đó mở rộng thành full paper với RQ3–RQ5.
