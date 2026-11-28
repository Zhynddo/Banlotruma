// Các ứng dụng trên desktop. Mã (k) cũng là đường dẫn: #truyen, #tra-cuu/...
export const APPS = [
  { k: 'truyen', name: 'Truyện ma', title: 'TRUYỆN MA', exe: 'TRUYENMA.EXE', glyph: '鬼', term: true,
    boot: ['Mở kho truyện', 'Nạp bảng mục lục', 'Nối đường dây BBS'] },
  { k: 'tim', name: 'Tìm hồ sơ', title: 'TÌM HỒ SƠ', exe: 'TIMHOSO.EXE', glyph: '⌕', term: true,
    boot: ['Gắn ổ lưu trữ', 'Dựng chỉ mục', 'Mở cổng dò tìm'] },
  { k: 'viet', name: 'Gửi tệp', title: 'SOẠN THẢO', exe: 'SOANTHAO.EXE', glyph: '✎', term: true,
    boot: ['Nạp trình soạn thảo', 'Mở tệp nháp'] },
  { k: 'tra-cuu', name: 'Sổ phép', title: 'SỔ PHÉP', exe: 'SOPHEP.EXE', glyph: '符',
    boot: ['Mở sổ phép', 'Nạp chữ Hán', 'Dựng chỉ mục tìm kiếm'] },
  { k: 'nhan-vat', name: 'Nhân vật', title: 'HỒ SƠ NHÂN VẬT', exe: 'HOSO.EXE', glyph: '人',
    boot: ['Mở tủ hồ sơ', 'Nạp ảnh chân dung'] },
  { k: 'phieu', name: 'Phiếu của tôi', title: 'PHIẾU CỦA TÔI', exe: 'PHIEU.EXE', glyph: '冊',
    boot: ['Mở phiếu nhân vật', 'Đồng bộ bản nháp'] },
  { k: 'cai-dat', name: 'Cài đặt', title: 'CÀI ĐẶT', exe: 'CAIDAT.EXE', glyph: '⚙',
    boot: ['Đọc cấu hình'] },
];
export const appOf = (k) => APPS.find((a) => a.k === k);

// #truyen/gui → { tab: 'truyen', path: ['gui'] }; không khớp ứng dụng nào → tab null (desktop)
export function route() {
  const [h, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
  // Đường dẫn cũ #truyen/gui giờ là ứng dụng Gửi tệp
  if (h === 'truyen' && rest[0] === 'gui') return { tab: 'viet', path: [] };
  return appOf(h) ? { tab: h, path: rest.filter(Boolean) } : { tab: null, path: [] };
}
