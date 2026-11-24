// Chuẩn hoá chữ để tìm không dấu. Phải giống hệt hàm f_norm trong database.
export const norm = (s = '') =>
  String(s ?? '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export const tokens = (s) => norm(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
