# 🧪 B4 Pilot Study — Hướng dẫn vận hành (4 tuần, ~15 SV)

> Mục đích: chạy thử nhỏ trước Main Study để phát hiện lỗi rubric, hệ thống, quy trình. Thành công khi `Cohen κ ≥ 0.61` giữa 3 GV trên 20 bài.

## 1) Timeline 4 tuần

| Tuần | GV làm gì | SV làm gì | Hệ thống |
|------|-----------|-----------|----------|
| **W0 (chuẩn bị)** | Tạo lớp `PILOT-2026` (15 SV), tạo 3 bài pilot (Basic I/O, Functions, Loops), in phiếu đồng ý, setup `SEED_DEMO_DATA=false` | Ký consent, làm **Pre-test** (30') `research_docs/pretest_posttest.md` | Seed pilot classroom, kiểm tra `health`, `system/check` |
| **W1** | Dạy bình thường, giao BT1 | Nộp BT1 (2-3 lần cho phép), xem feedback LLM | Thu `submissions` + `process_metrics`, GV xem `ProcessPanel` |
| **W2** | Giao BT2 (Functions), theo dõi `EWS` | Nộp BT2, trả **Survey S1** (giữa kỳ rút gọn) | Thu `llm_scores`, `rubric_breakdown` |
| **W3** | Giao BT3 (Loops), chọn 20 bài đa dạng mức độ | Nộp BT3 | Chuẩn bị `Research Export` |
| **W4 Calibration** | 3 GV chấm độc lập 20 bài + LLM chấm cùng 20 bài → tính κ | Phỏng vấn 4-5 SV (20') | `GET /submissions/agreement-stats` + `GET /admin/research/export?format=json` → chạy `statistical_analysis.py` trên 20 bài |

**Quyết định sau W4:**
- Nếu `κ ≥ 0.61` và không có bug blocking → sang **B5 Main Study** (80 SV, 15 tuần)
- Nếu `κ < 0.61` → điều chỉnh rubric/prompt trong `services/llmJudge.js:prompt` và `rubric.js:QUALITATIVE_CRITERIA`, chạy lại calibration 10 bài

## 2) Checklist trước khi bấm Start

- [ ] `.env` production: `JWT_SECRET≥32`, `FRONTEND_URL` chính xác, `DATABASE_PATH=/var/data/skillslab.db` (Render Disk), `SEED_DEMO_DATA=false`, `ENABLE_LOCAL_RUNNER=false`, `LLM_JUDGE_ENABLED=true`, `GEMINI_API_KEY` + `DEEPSEEK_API_KEY` (fallback)
- [ ] `npm run test:e2e` PASS (bao gồm `exam-mode` + `research-export`)
- [ ] `npm run build --prefix frontend` PASS
- [ ] Tạo lớp pilot: chạy `node backend/scripts/pilot_setup.js --class PILOT-2026 --students 15` (tạo SV `pilot01@neu.edu.vn`…`pilot15@neu.edu.vn` / `Pilot123!Aa`)
- [ ] Tạo 3 bài pilot trong `TeacherDashboard` → **Create Assignment** (hoặc via script)
- [ ] In 15 bản `Phiếu Đồng Ý` (`experimental_design.md:348`), thu chữ ký, lưu `consent_signed=true`
- [ ] Gửi link `Pre-test` (Google Form từ `pretest_posttest.md`), chốt `pre_score` nhập vào Sheet `students`
- [ ] Kiểm tra `GET /admin/research/stats?classroomId=X` → `students=15`, `submissions` tăng dần

## 3) Vận hành hàng tuần (GV)

1. **Giao bài:** `TeacherDashboard` → `assignments` → `Create` (điền `sample_code` + `test_cases` với `hidden` cho edge cases)
2. **Theo dõi:** `TeacherDashboard` → `Students` → click SV → xem `ProcessPanel` (paste_ratio, eq_lite, risk), `EWS` tab, `CodeGraph`
3. **Duyệt LLM:** `Review Queue` (⚖️) → mỗi bài `needs_review` → xem `score_llm/confidence/evidence` → `Chấp nhận LLM` hoặc chỉnh `0-5` → `Lưu`
4. **Can thiệp sớm:** nếu `EWS atRisk` hoặc `processWarnings` → nhắn SV, ghi `intervention_done=true` trong Sheet `early_warning`
5. **Cuối tuần:** `Admin` → `Research Export` → `Tải JSON` kiểm tra đủ 4 sheets, ẩn danh `T001…` (không email/tên)

## 4) Thu thập feedback pilot

- **SV Survey (W2):** 5 câu Likert `LLM01-05` + `EX01-05` (`experimental_design.md:171`), Google Form, ẩn danh
- **GV phỏng vấn (W4):** 4 câu `T01-T04` (`experimental_design.md:254`), 20' / GV, ghi âm (có consent)
- **Log lỗi:** mọi bug → ghi `research_docs/pilot_log.md` (template): `ngày | người | mô tả | ảnh hưởng | fix`

## 5) Dữ liệu cần có cuối pilot để chạy phân tích thử

```bash
# Xuất từ hệ thống
curl -H "Authorization: Bearer $TEACHER_TOKEN" \
  "http://localhost:3001/api/admin/research/export?classroomId=1&format=json" -o pilot_data.json

# Hoặc via UI: Admin → Research → Tải JSON → lưu pilot_data.json
# Chuyển JSON → Excel nếu cần (script có sẵn)
node backend/scripts/json_to_excel.js pilot_data.json pilot_data.xlsx

# Chạy phân tích thử (dùng mock nếu thiếu)
pip install pandas numpy scipy statsmodels scikit-learn matplotlib seaborn openpyxl
python research_docs/statistical_analysis.py --data pilot_data.xlsx --output pilot_results/
# Kỳ vọng với 15 SV pilot: baseline p>0.05, κ có thể thấp (mẫu nhỏ) — chỉ để test pipeline
```

## 6) Tiêu chí Go/No-Go sang Main Study

| Tiêu chí | Ngưỡng | Kiểm tra |
|----------|--------|----------|
| Hệ thống không crash | 0 crash 4 tuần | `health` 99% |
| Kappa người-người | κ ≥ 0.6 | 3 GV chấm 20 bài |
| Kappa LLM-người | κ ≥ 0.61 (mục tiêu) | `agreement-stats` |
| SV hoàn thành ≥80% | 12/15 nộp ≥2 bài | `stats` |
| Feedback LLM hữu ích | ≥3.5/5 Likert | Survey S1 |

Nếu fail 1 tiêu chí → điều chỉnh rồi chạy thêm 1 tuần pilot bổ sung.

## 7) Liên hệ & Hỗ trợ

- Kỹ thuật: `backend/server.js` logs, `GET /api/health`, `GET /api/system/check` (teacher)
- Nghiên cứu: `research_docs/experimental_design.md:476` Pilot Protocol, `statistical_analysis.py:114` mock data
- Bảo mật: file `pilot_data.json` đã ẩn danh `T001…`, không chứa `email`, giữ `mapping real→anon` riêng, xóa sau nghiên cứu

---
*📅 PILOT_GUIDE v1.0 — 27/08/2026 — dùng cho B4 trước khi B5 Main Study*
