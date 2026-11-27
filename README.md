# Bán Lộ Trừ Ma · app tra cứu và phiếu nhân vật

Web app (cài được lên điện thoại, mất mạng vẫn dùng) và app Android cho module Bán Lộ Trừ Ma.

- **Tra cứu**: phép, nghi lễ, Căn, pháp bảo, sau này thêm NPC, vong, hình vẽ. Có mạng thì tìm trong database, mất mạng thì tìm trong gói dữ liệu trên máy. Gõ có dấu hay không dấu đều được.
- **Phiếu nhân vật**: người chơi đăng nhập để lưu phiếu lên mạng, GM thấy và sửa được mọi phiếu. Chưa đăng nhập vẫn tạo phiếu trên máy được. Sửa lúc mất mạng thì lưu nháp, có mạng tự đồng bộ. Hai nơi cùng sửa một phiếu thì app hỏi giữ bản nào.

Hướng dẫn cài đặt từng bước: xem tài liệu "Hướng dẫn cài Bán Lộ Trừ Ma".

## Cấu trúc

| Thư mục | Là gì |
|---|---|
| `src/` | Code React. `lib/` là phần dữ liệu (API, offline, công thức), `views/` là các màn hình |
| `src/lib/rules.js` | Công thức trên phiếu: mod, thông thạo, máu, linh, AC, DC... theo luật bản 21/11/2026 |
| `src/lib/sheet.js` | Cấu trúc dữ liệu một phiếu nhân vật |
| `public/data/core.json` | Gói dữ liệu đi kèm app (dùng khi chưa có mạng lần nào) |
| `public/sw.js` | Service worker: lưu app để mất mạng vẫn mở được |
| `supabase/` | SQL tạo database: `schema.sql` → `storage.sql` → `seed.sql` |
| `scripts/build.mjs` | Build bằng esbuild ra `dist/` |
| `test/` | Server Supabase giả và kịch bản test bằng trình duyệt |
| `.github/workflows/build.yml` | GitHub tự build web lên Pages, và APK khi bấm tay |

## Chạy trên máy tính (tuỳ chọn)

```bash
npm install
npm run serve        # mở http://localhost:8080
python3 test/e2e.py  # cần Python + Playwright; chạy sau npm run build
```

## Cập nhật nội dung

- GM đăng nhập, vào **Tra cứu**: nút **+ Thêm mục** để thêm, chọn một mục rồi bấm **Sửa** để sửa, ẩn (chọn Nháp) hoặc xoá. App của mọi người tự tải phần mới khi có mạng; mục Nháp chỉ GM thấy.
- Vẫn sửa trực tiếp được trong Supabase (Table Editor → `entries`).
- Database tạo trước 27/11/2026 cần chạy thêm `supabase/update-01.sql` một lần.
- Muốn gói đi kèm app cũng mới theo: xuất bảng `entries` ra JSON, thay `public/data/core.json`.

## Ghi chú kỹ thuật

- Không dùng thư viện Supabase: `src/lib/api.js` gọi thẳng REST API (PostgREST + Auth), tự làm mới phiên đăng nhập.
- Tìm kiếm trên máy dùng đúng quy tắc chuẩn hoá chữ như hàm `f_norm` trong database.
- Lưu phiếu qua hàm `save_character` có kiểm tra `rev`, nên không ghi đè bản người khác vừa sửa.
- Khoá anon của Supabase để công khai được: mọi quyền đã khoá bằng Row Level Security trong `supabase/schema.sql`.
