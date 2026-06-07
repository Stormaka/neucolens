# Hướng dẫn tích hợp với Understand-Anything cho Đồ án NEU

Thư mục này chứa cấu hình Agent và Skill tùy chỉnh để tích hợp **Understand-Anything** vào quy trình chấm đồ án / KLTN tại Đại học Kinh tế Quốc dân (NEU).

## Cấu trúc thư mục

- `agents/`: Chứa định nghĩa Agent Prompts chuyên biệt cho NEU.
  - `neu-project-scanner.md`: Agent quét cấu trúc thư mục, phát hiện tech stack và đặc trưng đồ án NEU.
  - `neu-architecture-analyzer.md`: Agent đánh giá chất lượng kiến trúc phần mềm, chỉ ra các lỗi thiết kế phổ biến và gợi ý cải thiện (bằng Tiếng Việt).
- `skills/`:
  - `neu-understand/`: Chứa skill `/neu-understand` để quét dự án, sinh đồ thị quan hệ (knowledge graph) và báo cáo kiến trúc tự động.

## Cách cài đặt và sử dụng

### Bước 1: Cài đặt Understand-Anything CLI
Đối với giảng viên và sinh viên sử dụng IDE hỗ trợ (VS Code, Cursor, Copilot, Claude Code...), cài đặt công cụ thông qua lệnh sau trong terminal:

```bash
# Đối với Claude Code
/plugin install understand-anything

# Đối với các nền tảng khác (PowerShell trên Windows)
iwr -useb https://raw.githubusercontent.com/Lum1104/Understand-Anything/main/install.ps1 | iex
```

### Bước 2: Tải và cấu hình Custom Agents cho NEU
Sao chép hai tệp trong thư mục `agents/` vào thư mục cấu hình của Understand-Anything trên máy:
- Đường dẫn đích thông thường: `~/.understand-anything/agents/` hoặc thư mục dự án dưới `.understand-anything/agents/`.

### Bước 3: Chạy phân tích đồ án sinh viên
Khi sinh viên nộp project, chạy lệnh sau trong thư mục gốc của project để bắt đầu phân tích:

```bash
/neu-understand
```

Lệnh này sẽ tự động chạy quy trình:
1. Quét toàn bộ codebase thông qua **NEU Project Scanner**.
2. Phân tích các hàm, các class và sự phụ thuộc, tạo ra `.understand-anything/knowledge-graph.json`.
3. Chạy **NEU Architecture Analyzer** để phân tích sâu kiến trúc phân tầng, sinh ra báo cáo đánh giá `.understand-anything/architecture-analysis.json` bằng tiếng Việt.

### Bước 4: Xem kết quả trên Dashboard
Khởi chạy giao diện trực quan hóa **NEU CodeLens Dashboard** (nằm trong thư mục `frontend/` của đồ án này) để:
- Xem sơ đồ cấu trúc Codebase dưới dạng Đồ thị tương tác 3D/2D (D3.js).
- Đọc báo cáo kiến trúc tự động và xem các khuyến nghị từ AI.
- Sử dụng khung Chat `/understand-chat` để trực tiếp hỏi đáp về codebase của sinh viên.
