# NEU-CodeLens

## Chạy local

Yêu cầu Node.js 20+ và npm.

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
cp .env.example .env
npm run dev
```

Frontend mặc định chạy tại `http://localhost:5173`, backend tại `http://localhost:3001`.

## Biến môi trường production

- `JWT_SECRET`: chuỗi ngẫu nhiên bí mật, tối thiểu 32 ký tự.
- `FRONTEND_URL`: origin frontend chính xác được phép gọi API.
- `DATABASE_PATH`: đường dẫn SQLite bền vững.
- `GEMINI_API_KEY`: tùy chọn; nếu thiếu, chat ghi rõ đang dùng phân tích luật thay vì giả làm AI.
- `ENABLE_LOCAL_RUNNER`: chỉ bật khi backend chạy trong sandbox cô lập. Không bật trên Vercel/shared server.
- `SEED_DEMO_DATA`: chỉ đặt `true` ở môi trường demo; production mặc định khởi tạo database rỗng.
- `VITE_ENABLE_DEMO_LOGIN`: chỉ đặt `true` cho bản demo; production không hiển thị mật khẩu nhanh.

## Kiểm thử

```bash
npm run test:unit          # AST/adapter tests (21)
node backend/tests/process_metrics.test.mjs  # Process analytics tests (17)
node backend/tests/rubric_judge.test.mjs     # Rubric + judge tests (26)
npm run test:e2e           # E2E toàn luồng (gồm process-telemetry, exam-mode, research-export, plagiarism)
```

Bộ E2E tạo database tạm và kiểm tra đăng nhập, chính sách mật khẩu, refresh-token rotation, phân quyền theo lớp, filter/sort/pagination, chống sao chép đáp án mẫu, nộp/chấm code, chat, định dạng lỗi API, **telemetry quá trình làm bài** (flush → nộp kèm sự kiện → phân quyền xem events → EWS process signals), **exam mode** (single attempt + timer + hide scores) và **research export + plagiarism** (4-sheet CSV zip + Jaccard 5-gram).

## Phase 1 — Programming Process Analytics

Hệ thống thu thập **ngầm** dữ liệu quá trình gõ code của sinh viên (nền tảng: Jadud ICER'06 — Error Quotient, Leinonen SIGCSE'16 — keystroke latency, ProgSnap2):

- Editor CodeMirror 6 thay cho textarea; mỗi thay đổi/gõ phím/dán/rời tab được ghi thành sự kiện.
- **Riêng tư:** chỉ lưu số lượng + timestamp + độ trễ — KHÔNG lưu nội dung ký tự đã gõ.
- Sự kiện gửi kèm bài nộp (`session_id` + `process_events`) hoặc flush định kỳ qua `POST /api/submissions/events/flush`.
- Server tính metrics lưu `submissions.process_metrics_json`: thời gian hoạt động, delete-ratio, paste-ratio, median keystroke latency, EQ-lite (thrashing index), flags cảnh báo, process_risk 0–1.
- Giảng viên xem panel "Hành vi làm bài" trong chi tiết buổi học; EWS bổ sung kênh `processWarnings`.
- Metrics chỉ là **tín hiệu tham khảo**, không tự động thay đổi điểm sinh viên.

## Phase 2 — LLM-as-a-Judge (rubric) & Mixed-Initiative

Theo nguyên tắc RTSF: **T1 (độ đúng đắn) vẫn thuộc test runner**; LLM chỉ chấm **7 tiêu chí định tính** theo thang 0–5 (đồng thuận người–LLM cao nhất theo arXiv 2601.03444):

- T2: `naming` (10) · `comments` (8) · `structure_efficiency` (12) · `idiomatic` (5)
- T3: `decomposition` (8) · `abstraction` (7) · `pattern_reuse` (5) + `debugging_process` (5) — tiêu chí 3.4 đo bằng **process telemetry** (Phase 1), không qua LLM

**Mixed-initiative merge** (`backend/services/rubric.js`): mỗi tiêu chí có *engine proxy* deterministic. Điểm LLM được tự áp khi `confidence ≥ 0.65` VÀ (proxy low-quality HOẶC lệch proxy ≤ 1 bậc); ngược lại bài nộp vào hàng đợi **⚖️ Duyệt chấm** của giảng viên với giá trị tạm = proxy.

- `GET /api/submissions/needs-review` — hàng đợi duyệt (teacher, lớp của mình)
- `PATCH /api/submissions/:id/review` — chấp nhận điểm LLM (`accept_llm`) hoặc chỉnh từng tiêu chí (`scores`)
- `GET /api/submissions/agreement-stats` — **Cohen's κ** giữa LLM ↔ GV trên các bài đã duyệt (dữ liệu RQ1 cho paper)

Không có API key → hệ thống chạy chế độ `engine_only`, mọi luồng vẫn hoạt động. Tắt hoàn toàn bằng `LLM_JUDGE_ENABLED=false`.

## Phase 3 — Exam Mode có giám sát

Bài tập có thể tạo ở **chế độ thi** (`is_exam=1`) với các ràng buộc:

- **Một lần nộp duy nhất**, **đếm ngược** theo `duration_minutes` (5–300′), hết giờ tự động nộp.
- **Chặn dán** (`allow_paste=false`) — frontend chặn `paste` và đếm `paste_blocked_count`; **yêu cầu fullscreen** (`require_fullscreen`) — thoát fullscreen bị ghi nhận.
- **Trộn đề** (`shuffle_questions`) — thứ tự test cases hiển thị với SV được trộn deterministic theo `student_id:assignment_id`.
- **Giấu điểm** — điểm + feedback bị ẩn với SV khi `status=open` hoặc `hide_scores_until` còn trong tương lai; GV công bố bằng `PATCH /assignments/:id {hide_scores_until:null}` + `PATCH /assignments/:id/status {closed}`.
- **Giám sát** — bảng `exam_sessions` lưu `started_at/expires_at/submitted_at`, `focus_lost_count/paste_blocked_count/fullscreen_exits`; GV xem tại `GET /submissions/exam/:assignmentId/sessions`.

Endpoints chính:

- `POST /submissions/exam/start` — SV bấm “Bắt đầu làm bài” (tạo `exam_sessions`, tính `expires_at`)
- `GET /submissions/exam/:assignmentId/session` — phiên hiện tại + `remaining`
- `POST /submissions/exam/:assignmentId/event` — báo cáo `focus_lost|paste_blocked|fullscreen_exit`
- `GET /submissions/exam/:assignmentId/sessions` — GV giám sát live
- `POST /submissions` với `is_exam` — enforce `EXAM_NOT_STARTED` / `EXAM_EXPIRED` / `EXAM_ALREADY_SUBMITTED` (409) và ẩn điểm khi `scores_hidden`

Tạo bài thi (teacher): `POST /assignments {is_exam:true, duration_minutes:60, allow_paste:false, require_fullscreen:true, shuffle_questions:false, hide_scores_until:ISO}`. UI: TeacherDashboard toggle “📝 Chế độ Thi”, StudentDashboard hiển thị badge `📝 Thi`, nút `Vào thi`, màn hình thi với timer + chặn paste + fullscreen, và thông báo `🔒 Chờ công bố` khi đã nộp.

## Phase 4 — Research Export & Plagiarism (A+B)

**A) Research Export** khớp `data_collection_template.md` (4 sheets) + `statistical_analysis.py`:

- `GET /admin/research/export?classroomId=1&format=json|csv|excel` — xuất ẩn danh `T001…` (không email/tên thật), 4 sheets: `students` (pre/post/final/dropout), `submissions` (tier1/2/3/total, week, test_pass_rate, teacher_reviewed), `llm_vs_human` (calibration từ `review_status=reviewed`), `early_warning` (risk_score, actual/predicted at-risk). `csv` trả `zip` 4 CSV + `README.txt`; `excel` (cần `npm install exceljs --prefix backend`) trả `.xlsx` 4 sheets; `json` trả trực tiếp.
- `GET /admin/research/stats?classroomId=1` — tóm tắt `counts`, `mae` cho dashboard. Trả `counts.students/submissions/reviewed` để kiểm tra đủ `≥32/nhóm`, `≥50 calibration` trước khi chạy `statistical_analysis.py`.
- UI: `AdminPage` tab **📊 Research Export** + `TeacherDashboard` tab **📊 Research** (`ResearchPanel.tsx`): chọn lớp, xem stats, nút **Tải JSON / CSV Zip / Excel**, ghi chú ẩn danh và lệnh `python statistical_analysis.py --data student_data.xlsx`.

**B) Plagiarism Detection** (Jaccard 5-gram, bỏ comment/`#include`, chuẩn hoá whitespace, ngưỡng 0.5–0.95, mặc định 0.8):

- `GET /assignments/:id/plagiarism?threshold=0.8` (teacher) và `GET /admin/research/plagiarism?assignmentId=...` — so sánh `latest` code mỗi SV trong cùng assignment, tính `similarity=|A∩B|/|A∪B|`, trả `pairs[]` sorted, `shared`, `a_len/b_len`, highlight `>0.9` đỏ, `>0.85` vàng. Kết hợp với `ai_suspicion` + `process_metrics` (paste_ratio, process_risk) trong `plagiarism.js:enhancedAiSuspicion`.
- UI: `ResearchPanel` chọn bài tập + slider ngưỡng + **Kiểm tra**, `TeacherDashboard` → chọn bài tập → card **🔍 Kiểm tra đạo văn** hiện bảng cặp nghi vấn.

Chạy phân tích sau khi xuất: `pip install pandas numpy scipy statsmodels scikit-learn matplotlib seaborn openpyxl && python research_docs/statistical_analysis.py --data neu-codelens-export.xlsx --output results/` → ra `baseline_equivalence.png`, `rq1_llm_accuracy.png`, `rq3/4/5…` + `research_results_summary.json`.

## B4 Pilot — Chạy thử 4 tuần

Xem `docs/PILOT_GUIDE.md` (timeline W0-W4, checklist, Go/No-Go `κ≥0.61`). Khởi tạo nhanh:

```bash
DATABASE_PATH=./pilot.db JWT_SECRET=... node backend/scripts/pilot_setup.js --class=PILOT-2026 --students=15
# SV: pilot01@neu.edu.vn … pilot15@neu.edu.vn / Pilot123!Aa  — 3 bài pilot, deadline +7d
# Sau đó: Admin → Research → Tải JSON → node backend/scripts/json_to_excel.js pilot.json pilot.xlsx
```

Log vận hành + survey mẫu: `research_docs/pilot_log.md`.

## API tóm tắt

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/auth/login` | — | Đăng nhập, trả `access_token` (30m) + `refresh_token` |
| POST | `/auth/refresh` | — | Xoay refresh token |
| GET | `/assignments/classroom/:id` | teacher/student | List bài + `avgScore`, `sample_test_cases` (SV chỉ thấy `!hidden`) |
| POST | `/assignments` | teacher | Tạo bài, hỗ trợ `is_exam/duration/allow_paste/require_fullscreen/shuffle/hide_scores_until` |
| POST | `/submissions` | student | Nộp code, trả `202 pending` → poll `GET /submissions/:id`, enforce exam single-attempt + hide scores |
| POST | `/submissions/exam/start` | student | Bắt đầu thi, trả `expires_at` |
| GET | `/admin/research/export?format=json|csv|excel` | teacher | Xuất 4 sheets ẩn danh |
| GET | `/assignments/:id/plagiarism?threshold=0.8` | teacher | Jaccard 5-gram pairs |

`POST /submissions` trả `202` khi `Vercel=false` (poll 40×500ms), `201` khi serverless (đã chấm xong). Lỗi chuẩn `{success:false, error:{code, message}, status}`.

## Ghi chú triển khai

SQLite trên Vercel không phải kho lưu trữ bền vững (`/tmp` ephemeral). Khi triển khai thật, dùng volume bền vững trên VM/Render (`DATABASE_PATH=/var/data/skillslab.db`) hoặc chuyển sang PostgreSQL. `render.yaml` đã có `disk` + `healthCheckPath: /api/health`. Việc chạy code C++ phải nằm trong sandbox cô lập; production `ENABLE_LOCAL_RUNNER=false`.
