# NEU CodeLens — Hệ thống Hỗ trợ Sinh viên Hiểu Đồ án & Khóa luận Tốt nghiệp

> **Đề tài ứng dụng thực tế tại Viện Công nghệ thông tin & Kinh tế số (AIT) — Đại học Kinh tế Quốc dân (NEU)**
>
> *Giải pháp tự động phân tích cấu trúc mã nguồn, sinh bản đồ tri thức (Knowledge Graph) và báo cáo kiến trúc bằng Tiếng Việt dựa trên công nghệ **Understand-Anything**.*

---

## 📌 1. Bối cảnh & Bài toán Thực tế tại NEU

Trong quá trình thực hiện Đồ án môn học và Khóa luận tốt nghiệp (KLTN) của sinh viên các ngành **Công nghệ thông tin**, **Toán tin**, và **Hệ thống thông tin quản lý** tại NEU:
- **Khó khăn của Giảng viên hướng dẫn (GVHD) & Hội đồng:** Mỗi đợt bảo vệ, một giảng viên phải đánh giá hàng chục đồ án. Mỗi dự án có hàng nghìn tới hàng chục nghìn dòng code với các tech stack khác nhau (Spring Boot, Node.js, Django, Laravel...). Việc cài đặt chạy thử và đọc hiểu chi tiết codebase của từng sinh viên để đánh giá tính trung thực, chất lượng thiết kế là cực kỳ tốn thời gian.
- **Khó khăn của Sinh viên:** Nhiều sinh viên gặp khó khăn trong việc nắm bắt bức tranh toàn cảnh về kiến trúc dự án (đặc biệt khi tham khảo hoặc phát triển tiếp các thư viện mã nguồn mở), dẫn đến lúng túng khi bị GVHD phản biện về luồng dữ liệu, phân tầng, hoặc bảo mật trong buổi bảo vệ chính thức.

### 💡 Giải pháp: NEU CodeLens
Hệ thống cho phép sinh viên tải dự án lên (dưới dạng file `.zip` hoặc đường dẫn `GitHub`). Hệ thống sẽ kích hoạt bộ công cụ **Understand-Anything** chạy qua một pipeline đa tác nhân (Multi-Agent Pipeline) để tự động phân tích codebase và cung cấp cho GVHD cũng như sinh viên các công cụ mạnh mẽ:
1. **Interactive Knowledge Graph:** Biểu đồ tương tác 2D trực quan hóa toàn bộ file, class, method, endpoint và cách chúng gọi nhau.
2. **Architecture Report:** Báo cáo kiến trúc chi tiết bằng tiếng Việt, chấm điểm chất lượng thiết kế, phát hiện các mẫu thiết kế (Design Patterns) và các cảnh báo vi phạm thiết kế (Anti-patterns).
3. **Understand Chat (`/understand-chat`):** Trình chat thông minh về code giúp sinh viên tự ôn tập, GVHD nhanh chóng kiểm tra kiến thức của sinh viên bằng các câu hỏi gợi ý sát sườn.

---

## 🏗️ 2. Kiến trúc Hệ thống

Dự án được cấu trúc rõ ràng thành 3 phần chính nằm trong thư mục `neu-codelens/`:

```
neu-codelens/
├── frontend/               # Ứng dụng React + Vite + TS (Giao diện người dùng)
│   ├── src/
│   │   ├── pages/          # Các trang chính: Trang chủ, Dashboard SV, Dashboard GV, Chi tiết dự án, Trò chuyện
│   │   ├── components/     # UI Components: Bản đồ tri thức (D3.js), Báo cáo kiến trúc, Vùng tải lên
│   │   └── data/           # Mock data & Dữ liệu mẫu (sampleGraph.ts) đại diện dự án Spring Boot mẫu
├── backend/                # Server Node.js + Express API (Mô phỏng backend & API kết nối)
│   ├── server.js           # Xử lý các endpoints xác thực, quản lý dự án, chat AI, và chấm điểm
│   └── package.json        # Định nghĩa dependencies (Express, Cors, Multer...)
├── plugin-integration/     # Cấu hình tích hợp plugin hệ thống Understand-Anything
│   ├── agents/             # Prompts chuyên biệt: NEU Project Scanner & NEU Architecture Analyzer
│   └── skills/             # Định nghĩa lệnh `/neu-understand` cho CLI
├── package.json            # Cấu hình workspace root (Orchestrator bằng Concurrently)
└── README.md               # Hướng dẫn dự án bằng Tiếng Việt (Tệp này)
```

---

## ✨ 3. Các Tính Năng Nổi Bật

### 🖥️ Giao diện Dashboard Sinh viên & Giảng viên
- **Dashboard Sinh viên:** Tải dự án lên, theo dõi trạng thái phân tích theo thời gian thực (pipeline 7 bước), xem điểm kiến trúc sơ bộ, và trò chuyện trực tiếp với AI về mã nguồn của mình.
- **Dashboard Giảng viên:** Bảng điều khiển quản lý danh sách sinh viên nộp bài, xem nhanh các chỉ số cốt lõi (Điểm kiến trúc, Độ phức tạp, Độ kết dính), xem cảnh báo lỗi thiết kế và điền nhận xét, điểm số đánh giá trực tiếp.

### 📊 Bản đồ Tri thức Tương tác (D3.js force-directed Graph)
- Trực quan hóa cấu trúc dự án thành các lớp (Architectural Layers): Tầng hiển thị (Controller), Tầng nghiệp vụ (Service), Tầng dữ liệu (Repository), Thực thể dữ liệu (Entity/Model), Cấu hình (Config), DTOs...
- Cho phép tìm kiếm nhanh (Fuzzy search), highlight các node và các cạnh liên quan khi click.
- Tích hợp **Guided Tour (Lộ trình học tập):** AI tự động sinh ra lộ trình đọc code tối ưu theo thứ tự phụ thuộc (từ config -> entity -> repository -> service -> controller) giúp giảng viên review mã nguồn theo đúng trình tự logic.

### 📝 Báo cáo Kiến trúc & Đánh giá Code (Tiếng Việt)
- Phân tích và chấm điểm (Score 0-100) dựa trên tiêu chí thiết kế.
- Liệt kê các **Design Patterns** áp dụng đúng (ví dụ: Dependency Injection, Repository Pattern, DTO Pattern...).
- Cảnh báo các **Anti-patterns** nguy hiểm (ví dụ: Fat Controller, God Class, Hardcoded Config...).
- Đưa ra khuyến nghị khắc phục cụ thể và nhận xét tổng quan bằng tiếng Việt học thuật định hướng cho GVHD chấm điểm.

### 💬 Trò chuyện Thông minh về Code (`/understand-chat`)
- Giao diện chat mô phỏng hoạt động hỏi đáp về codebase.
- Tự động gợi ý các câu hỏi chuyên sâu (ví dụ: *"Giải thích luồng đăng nhập trong dự án"*, *"Kiến trúc tầng của dự án hoạt động thế nào?"*, *"Chỉ ra các thành phần dễ gây tắc nghẽn hiệu năng"*).
- Trích xuất các thành phần liên quan (context nodes) tương ứng với nội dung câu hỏi để hiển thị trên đồ thị.

---

## 🚀 4. Hướng dẫn Cài đặt & Chạy Thử

### Yêu cầu hệ thống
- Đã cài đặt **Node.js** (Phiên bản >= 18)
- Trình duyệt Chrome, Edge hoặc Firefox hiện đại hỗ trợ SVG/D3.js

### Các bước khởi chạy nhanh:

1. **Clone/Giải nén dự án** và truy cập vào thư mục gốc `neu-codelens/`.
2. **Cài đặt toàn bộ dependencies** cho cả root, frontend và backend:
   ```bash
   npm run install-all
   ```
   *(Lệnh này sẽ tự động cài đặt `concurrently` ở thư mục gốc, sau đó chạy cài đặt thư viện cho `backend` và `frontend`).*

3. **Khởi chạy hệ thống ở chế độ phát triển (Development):**
   ```bash
   npm run dev
   ```
   Lệnh trên sẽ chạy đồng thời:
   - **Backend API:** cổng `3001` (http://localhost:3001)
   - **Frontend App (Vite):** cổng `5173` (http://localhost:5173)

4. **Truy cập Giao diện:**
   Mở trình duyệt và truy cập: **[http://localhost:5173](http://localhost:5173)**

---

## 🔒 5. Tài khoản Đăng nhập Demo

Hệ thống đã tích hợp sẵn cơ chế phân quyền tài khoản demo tại trang chủ để người xem dễ dàng kiểm thử:

- **Tài khoản Sinh viên:**
  - **Email:** `sv.nguyenvanan@neu.edu.vn` (Hoặc bất kỳ email nào chứa `sv`)
  - **Mật khẩu:** Bất kỳ mật khẩu nào (ví dụ: `123456`)
  - **Quyền hạn:** Tải project lên, xem phân tích project cá nhân, chat hỏi đáp code.

- **Tài khoản Giảng viên:**
  - **Email:** `ts.nguyenminhduc@neu.edu.vn` (Hoặc bất kỳ email nào chứa `ts.`)
  - **Mật khẩu:** Bất kỳ mật khẩu nào (ví dụ: `123456`)
  - **Quyền hạn:** Xem danh sách tất cả sinh viên nộp bài, xem chi tiết báo cáo và đồ thị của từng dự án, thực hiện chấm điểm và viết nhận xét.

---

## 🛠️ 6. Quy trình Tích hợp và Phân tích Dự án Thật bằng CLI

Để tích hợp với dự án thật của sinh viên bằng dòng lệnh (CLI):

1. Xem hướng dẫn cấu hình chi tiết tại [plugin-integration/README.md](file:///c:/Users/Acer/Downloads/neu-codelens/plugin-integration/README.md).
2. Khi chạy lệnh `/neu-understand`, thư viện `Understand-Anything` sẽ gọi các agent được định nghĩa trong `plugin-integration/agents/` để sinh ra file cấu trúc đồ thị `.understand-anything/knowledge-graph.json` và tệp báo cáo kiến trúc `.understand-anything/architecture-analysis.json`.
3. Giao diện frontend sẽ tự động đọc các tệp này từ backend để hiển thị chính xác đồ thị mã nguồn thực tế thay vì dữ liệu mock.

---
*Dự án được xây dựng bởi sự phối hợp giữa sinh viên Viện CNTT & Kinh tế số NEU và AI Pair Programmer.*
