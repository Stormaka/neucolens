---
name: neu-understand
description: Phân tích dự án Đồ án/KLTN của sinh viên NEU, sinh knowledge graph và báo cáo kiến trúc chi tiết cho giảng viên
argument-hint: ["[project_path]"]
---

# /neu-understand

Công cụ này giúp quét toàn bộ dự án Đồ án/Khóa luận tốt nghiệp của sinh viên Đại học Kinh tế Quốc dân (NEU), sau đó sử dụng các tác nhân (Agents) chuyên biệt để sinh ra:
1. **Knowledge Graph** (`.understand-anything/knowledge-graph.json`) hiển thị cấu trúc các tầng và thành phần.
2. **Báo cáo Kiến trúc** (`.understand-anything/architecture-analysis.json`) bằng tiếng Việt để giảng viên hướng dẫn chấm điểm và đánh giá nhanh.

## Hướng dẫn sử dụng cho AI Agent

Khi nhận được lệnh `/neu-understand [path]`:

1. **Phát hiện thư mục dự án (PROJECT_ROOT)**:
   - Nếu không truyền tham số `[path]`, mặc định sử dụng thư mục hiện tại.
   - Kiểm tra xem thư mục có tồn tại không. Tạo thư mục `.understand-anything/` bên trong dự án.

2. **Chạy NEU Project Scanner (Phase 1)**:
   - Sử dụng Agent Prompt tại `plugin-integration/agents/neu-project-scanner.md` để quét dự án.
   - Đọc các file quan trọng: `README.md`, `package.json`, `pom.xml`, `requirements.txt`...
   - Phân tích cấu trúc thư mục, ngôn ngữ, framework.
   - Ghi kết quả tổng quan vào `.understand-anything/project-summary.json`.

3. **Xây dựng Knowledge Graph (Phase 2 & 3)**:
   - Quét qua danh sách các file mã nguồn (Java, JS, TS, Python, C#, PHP...).
   - Trích xuất các lớp (Classes), Dịch vụ (Services), Bộ điều khiển (Controllers), Kho lưu trữ (Repositories), Mô hình (Entities/Tables), và các API Endpoints.
   - Thiết lập các liên kết: gọi hàm (`calls`), cấu hình (`configures`), đọc ghi (`reads_from` / `writes_to`), định tuyến (`routes`), truyền dữ liệu (`transforms`).
   - Ghi Knowledge Graph vào `.understand-anything/knowledge-graph.json`.

4. **Chạy NEU Architecture Analyzer (Phase 4)**:
   - Sử dụng Agent Prompt tại `plugin-integration/agents/neu-architecture-analyzer.md`.
   - Đọc thông tin từ Knowledge Graph vừa tạo và danh sách tệp nguồn.
   - Đánh giá kiến trúc phân tầng (Presentation, Business, Data, Domain), phát hiện các Design Patterns (Repository, DTO, Singleton...) và cảnh báo Anti-patterns (Fat Controller, God Class, N+1 Query...).
   - Đưa ra nhận xét tiếng Việt bằng văn phong học thuật, thực tế cho giảng viên NEU.
   - Ghi báo cáo đánh giá vào `.understand-anything/architecture-analysis.json`.

5. **Hoàn thành**:
   - Báo cáo lại số lượng tệp đã quét, các tầng kiến trúc chính và điểm đánh giá sơ bộ.
   - Thông báo cho giảng viên rằng họ có thể mở Dashboard NEU CodeLens để xem trực quan hóa hoặc dùng `/understand-chat` để truy vấn codebase.
