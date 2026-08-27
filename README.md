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
npm run test:e2e           # E2E toàn luồng (gồm process-telemetry)
```

Bộ E2E tạo database tạm và kiểm tra đăng nhập, chính sách mật khẩu, refresh-token rotation, phân quyền theo lớp, filter/sort/pagination, chống sao chép đáp án mẫu, nộp/chấm code, chat, định dạng lỗi API và **telemetry quá trình làm bài** (flush → nộp kèm sự kiện → phân quyền xem events → EWS process signals).

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

## Ghi chú triển khai

SQLite trên Vercel không phải kho lưu trữ bền vững. Khi triển khai thật, dùng volume bền vững trên VM/Render hoặc chuyển database sang PostgreSQL. Việc chạy code C++ của sinh viên phải nằm trong dịch vụ sandbox chuyên dụng; production mặc định tắt trình chạy native.
