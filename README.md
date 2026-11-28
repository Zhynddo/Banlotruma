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
- Trong màn hình Sửa có phần **Hình vẽ**: hình được thu nhỏ trên máy (tối đa 1600px, kèm bản nhỏ 360px) rồi tải lên bucket `media`. Đường dẫn hình lưu ở `data.hinh` của mục. Người chơi xem hình nào thì máy tự giữ lại; Cài đặt có nút tải hết hình để xem offline.
- Vẫn sửa trực tiếp được trong Supabase (Table Editor → `entries`).
- Database tạo trước 27/11/2026 cần chạy thêm `supabase/update-01.sql` một lần.
- Blog truyện ma, hồ sơ PC công khai và ảnh chân dung cần `supabase/update-02.sql` (chạy một lần, kể cả database mới tạo: schema → storage → seed → update-02).

## Giao diện: desktop kiểu DOS

Mở app là màn hình khởi động chạy chữ (mỗi phiên một lần, bấm phím để bỏ qua), rồi tới desktop có biểu tượng.
Mỗi ứng dụng mở trong một cửa sổ khung kẻ đôi kiểu Turbo Vision: `[■]` đóng, `[↑]` phóng to, kéo thanh tiêu đề để dời,
kéo góc `◢` để đổi cỡ. Trên điện thoại cửa sổ tự phóng kín màn hình. Thanh menu trên cùng và trong mỗi cửa sổ sổ xuống khi bấm.
Code: `src/shell/` (Desktop, Window, Menu, Boot, apps.js).

| Ứng dụng | Địa chỉ | Ghi chú |
|---|---|---|
| Truyện ma | `#truyen` | BBS: gõ số rồi Enter để đọc, phím tắt G/F/S/T/ESC; GM duyệt ở `#truyen/duyet` |
| Tìm hồ sơ | `#tim` | tìm trong truyện, sổ phép, NPC, PC công khai; hiệu ứng dò kho rồi giải mã |
| Gửi tệp | `#viet` | trình soạn thảo có số dòng, Ctrl+S gửi, Ctrl+X thoát; khách không cần tài khoản |
| Sổ phép | `#tra-cuu`, `#tra-cuu/<mã>`, `#tra-cuu/them` | |
| Nhân vật | `#nhan-vat`, `#nhan-vat/pc/<mã>`, `#nhan-vat/npc/<mã>`, `#nhan-vat/them` | |
| Phiếu của tôi | `#phieu` | phiếu dạng sơ yếu lý lịch |
| Cài đặt | `#cai-dat` | |

Sổ phép nhập từ Excel: GM mở Sổ phép → Tệp → Nhập phép từ Excel (`#tra-cuu/nhap`). File được đọc ngay trên trình duyệt
(`src/lib/xlsx.js`, không cần thư viện), cột nhận theo tên tiêu đề (`src/lib/spellSheet.js`). File mẫu `public/files/BanLoTruMa_SoPhep.xlsx`
tạo bằng `python3 scripts/make_sophep_xlsx.py` từ `public/data/core.json`. Phép trùng mã thì sửa, mã mới thì thêm, không xoá phép nào.
Trường phép: bac, tinh, gia, hanh_dong, tam, thoi_han, duy_tri, cach, kem, bac_cao, goc, muc, ghi_chu, nhap (ô `thi` đời cũ được tách tự động).

Theme: `crt` (phốt-pho xanh, mặc định) và `term` (đen trắng). Kiểu tài liệu: giấy thật hoặc chữ terminal
(menu Xem, hoặc Cài đặt). Ai bật giảm chuyển động trong máy thì không có hiệu ứng chạy chữ.

## App Android

Workflow build APK mỗi lần đưa code lên `main`, đăng vào Releases với tag `app-android`; link tải cố định:
`https://github.com/<chủ>/<repo>/releases/latest/download/ban-lo-tru-ma.apk`.
Khoá ký nằm ở `android-keystore/debug.keystore` để bản sau cài đè được bản trước. Biểu tượng và màn hình chờ lấy từ `assets/`.
- Muốn gói đi kèm app cũng mới theo: xuất bảng `entries` ra JSON, thay `public/data/core.json`.

## Ghi chú kỹ thuật

- Không dùng thư viện Supabase: `src/lib/api.js` gọi thẳng REST API (PostgREST + Auth), tự làm mới phiên đăng nhập.
- Tìm kiếm trên máy dùng đúng quy tắc chuẩn hoá chữ như hàm `f_norm` trong database.
- Lưu phiếu qua hàm `save_character` có kiểm tra `rev`, nên không ghi đè bản người khác vừa sửa.
- Khoá anon của Supabase để công khai được: mọi quyền đã khoá bằng Row Level Security trong `supabase/schema.sql`.
