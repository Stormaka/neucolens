# 📝 Pilot Log — Ghi chép vận hành thử (B4)

| Ngày | Người | Bài/SV | Mô tả lỗi / Ghi chú | Ảnh hưởng | Cách fix | Đã fix? |
|------|-------|--------|---------------------|-----------|----------|---------|
| 2026-08-28 | GV | BT1 | Ví dụ: SV báo không nộp được (403) dù đã start thi | Block 2/15 SV | Kiểm tra `exam_sessions` `is_exam` flag, sửa `assignments.js` | ☐ |
| | | | | | | |

## Mẫu Survey S1 (rút gọn, 5 Likert)

- `S1-1` Phản hồi LLM giúp tôi hiểu lỗi sai (1-5)
- `S1-2` Tôi đọc feedback sau mỗi lần nộp (1-5)
- `S1-3` Hệ thống dễ dùng (SUS 1-5)
- `S1-4` Tôi lo lắng không theo kịp (1-5, đảo)
- `S1-5` Ghi chú tự do: khó khăn lớn nhất?

## Mẫu phỏng vấn SV (4 câu, 10')

1. Lần nào feedback LLM giúp bạn "à ha" hiểu ra?
2. Lần nào feedback sai/không hữu ích?
3. Khi gặp lỗi, bạn làm gì đầu tiên (trước/sau khi có hệ thống)?
4. Muốn cải thiện 1 điều gì ở hệ thống?

## Mẫu phỏng vấn GV (T01-T04, 15')

- T01 Khác biệt 2 nhóm? T02 Thay đổi cách dạy? T03 Tin tưởng LLM? T04 Hạn chế?

> Lưu file này trong `research_docs/` và backup cùng `pilot_data.xlsx`
