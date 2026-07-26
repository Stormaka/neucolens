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
npm run build --prefix frontend
npm run test:e2e
```

Bộ E2E tạo database tạm và kiểm tra đăng nhập, chính sách mật khẩu, refresh-token rotation, phân quyền theo lớp, filter/sort/pagination, chống sao chép đáp án mẫu, nộp/chấm code, chat và định dạng lỗi API.

## Ghi chú triển khai

SQLite trên Vercel không phải kho lưu trữ bền vững. Khi triển khai thật, dùng volume bền vững trên VM/Render hoặc chuyển database sang PostgreSQL. Việc chạy code C++ của sinh viên phải nằm trong dịch vụ sandbox chuyên dụng; production mặc định tắt trình chạy native.
