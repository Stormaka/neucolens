# 🗺️ TỔNG KẾT TIẾN TRÌNH NGHIÊN CỨU
## "LLM-Assisted Adaptive Assessment for Introductory Programming"

> Cập nhật lần cuối: 15/06/2026

---

## ✅ TIẾN ĐỘ TỔNG QUAN

```
[██████████████████████░░░░░░░░░░░░░░░░░░] 38% hoàn thành
 Giai đoạn Chuẩn bị (Pre-study) ← Đang ở đây
```

| Giai đoạn | Bước | Trạng thái | File |
|-----------|------|-----------|------|
| **Chuẩn bị** | B1: Literature Review | ✅ Xong | `literature_review.md` |
| **Chuẩn bị** | B2: Rubric Framework | ✅ Xong | `rubric_framework.md` |
| **Chuẩn bị** | B2: Python Prototype | ✅ Xong | `assessment_pipeline.py` |
| **Chuẩn bị** | B3: Experimental Design | ✅ Xong | `experimental_design.md` |
| **Chuẩn bị** | B3: Pre-test / Post-test | ✅ Xong | `pretest_posttest.md` |
| **Chuẩn bị** | B3: Statistical Scripts | ✅ Xong | `statistical_analysis.py` |
| **Chuẩn bị** | B3: Data Collection Template | ✅ Xong | `data_collection_template.md` |
| **Thực thi** | B4: Pilot Study (4 tuần) | ⬜ Chưa bắt đầu | — |
| **Thực thi** | B4: Điều chỉnh sau Pilot | ⬜ Chưa bắt đầu | — |
| **Thực thi** | B5: Main Study (1 học kỳ) | ⬜ Chưa bắt đầu | — |
| **Phân tích** | B6: Chạy phân tích thống kê | ⬜ Chưa bắt đầu | — |
| **Phân tích** | B6: Phỏng vấn định tính | ⬜ Chưa bắt đầu | — |
| **Viết bài** | B7: Draft bài báo | ⬜ Chưa bắt đầu | — |
| **Viết bài** | B7: Peer review nội bộ | ⬜ Chưa bắt đầu | — |
| **Công bố** | B8: Submit hội nghị | ⬜ Chưa bắt đầu | — |

---

## 📁 DANH SÁCH FILE ĐÃ TẠO

### 📚 Nghiên cứu & Lý thuyết
| File | Mô tả | Dùng cho |
|------|-------|---------|
| `research_proposal.md` | Đề xuất nghiên cứu tổng thể | Thuyết phục hội đồng, xin tài trợ |
| `literature_review.md` | Tổng quan 15 bài báo (2023-2026) | Phần Related Work trong bài báo |
| `rubric_framework.md` | Khung 3 tầng + 11 tiêu chí đánh giá | LLM prompt, calibration với GV |

### 🔬 Thực nghiệm
| File | Mô tả | Dùng cho |
|------|-------|---------|
| `experimental_design.md` | Thiết kế thực nghiệm đầy đủ | Phần Methodology trong bài báo |
| `pretest_posttest.md` | Bộ câu hỏi Pre/Post-test + đáp án | Đo Learning Gain |
| `data_collection_template.md` | Schema 4 sheet Excel + hướng dẫn | Thu thập dữ liệu trong học kỳ |

### 💻 Code
| File | Mô tả | Chạy như thế nào |
|------|-------|-----------------|
| `assessment_pipeline.py` | Pipeline LLM chấm điểm đầy đủ | `python assessment_pipeline.py` |
| `statistical_analysis.py` | Toàn bộ phân tích thống kê (RQ1-5) | `python statistical_analysis.py --data student_data.xlsx` |

---

## 🎯 VIỆC CẦN LÀM TIẾP THEO

### Tuần này (Ngay bây giờ):
- [ ] **In và đọc** `literature_review.md` → xác nhận các bài báo là đúng topic
- [ ] **Review rubric** với 1 giảng viên đồng nghiệp → xin ý kiến về tiêu chí
- [ ] **Cài đặt môi trường:** `pip install openai pylint python-dotenv`
- [ ] **Tạo file .env** với API key và chạy thử `assessment_pipeline.py`

### Tuần tới:
- [ ] Liên hệ xin phép giảng viên dạy CS101 tham gia nghiên cứu
- [ ] Xin phê duyệt từ Ban chủ nhiệm khoa / IRB (nếu trường yêu cầu)
- [ ] Chuẩn bị bộ bài tập 15 tuần (dựa trên template trong `experimental_design.md`)
- [ ] Setup GitHub Classroom để thu thập revision history

### Tháng tới:
- [ ] Chạy **Pilot Study** (4 tuần, ~15 SV tình nguyện)
- [ ] Thực hiện **Calibration session** (3 GV chấm 20 bài cùng nhau)
- [ ] Tính Kappa — nếu κ ≥ 0.6 → bắt đầu Main Study
- [ ] Bắt đầu **Main Study** (học kỳ chính thức)

---

## 📊 BƯỚC TIẾP THEO CÒN LẠI (B4-B8)

### B4: Pilot Study → Main Study
Khi xong chuẩn bị, triển khai theo timeline trong `experimental_design.md`

### B5: Thu Thập Dữ Liệu
Dùng file `data_collection_template.md` để nhập dữ liệu vào Excel mỗi tuần

### B6: Phân Tích
Sau học kỳ, chạy:
```bash
python statistical_analysis.py --data student_data.xlsx --output results/
```
→ Tự động tạo tất cả biểu đồ và báo cáo JSON

### B7: Viết Bài Báo
Cấu trúc bài báo đã có trong `research_proposal.md` (Phần 13).
Nội dung từng section sẽ lấy từ:
- Introduction ← `research_proposal.md`
- Related Work ← `literature_review.md`
- Methodology ← `experimental_design.md` + `rubric_framework.md`
- Results ← output của `statistical_analysis.py`

### B8: Submit
- SIGCSE deadline: thường tháng 8-9
- EDM deadline: thường tháng 2
- Computers & Education: rolling submission

---

## 💡 GHI NHỚ QUAN TRỌNG

> **Điểm mới nhất của nghiên cứu này** (để nhấn mạnh khi viết bài):
> 1. Lần đầu tiên đánh giá **Tầng 3 (Computational Thinking)** bằng LLM có hệ thống
> 2. Lần đầu tiên phân tích **revision history (git commits)** bằng LLM để hiểu quá trình tư duy
> 3. Hệ thống **tích hợp toàn bộ** (assessment + tracking + early warning) trong 1 pipeline
> 4. Được thực hiện tại **Việt Nam** — bối cảnh chưa được nghiên cứu trong literature quốc tế

---

*📅 Cập nhật: 15/06/2026 | Phiên bản: 1.0*
