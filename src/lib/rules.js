// Các công thức tính trên phiếu, theo bản tổng hợp 21/11/2026.
// Số trong ngoặc là mục luật.

export const STATS = [
  { k: 'luc', name: 'Lực', group: 'Thân' },
  { k: 'man', name: 'Mẫn', group: 'Thân' },
  { k: 'the', name: 'Thể', group: 'Thân' },
  { k: 'tri', name: 'Trí', group: 'Tâm' },
  { k: 'tue', name: 'Tuệ', group: 'Tâm' },
  { k: 'mi', name: 'Mị', group: 'Tâm' },
  { k: 'via', name: 'Vía', group: 'Vía' },
];

// (2.1)
export const SKILLS = [
  ['suc-manh', 'Sức mạnh', 'luc'],
  ['than-phap', 'Thân pháp', 'man'], ['thu-phap', 'Thủ pháp', 'man'], ['an-phap', 'Ẩn pháp', 'man'],
  ['han-nom', 'Hán Nôm', 'tri'], ['le-nghi', 'Lễ Nghi', 'tri'], ['phong-thuy', 'Phong Thủy', 'tri'],
  ['dieu-tra', 'Điều Tra', 'tri'], ['dien-tich', 'Điển Tịch', 'tri'], ['y-thuat', 'Y Thuật', 'tri'],
  ['thuan-thu', 'Thuần Thú', 'tue'], ['doc-vi', 'Đọc Vị', 'tue'], ['giac-quan', 'Giác Quan', 'tue'], ['sinh-ton', 'Sinh Tồn', 'tue'],
  ['thuyet-phuc', 'Thuyết Phục', 'mi'], ['uy-ap', 'Uy Áp', 'mi'], ['tra-thuat', 'Trá Thuật', 'mi'], ['ky-nghe', 'Kỹ Nghệ', 'mi'], ['at-via', 'Át Vía', 'mi'],
  ['cam-am', 'Cảm Âm', 'via'], ['thong-linh', 'Thông Linh', 'via'], ['xuat-hon', 'Xuất Hồn', 'via'],
].map(([k, name, stat]) => ({ k, name, stat }));

export const TRUONG = ['Thuật Sỹ', 'Chú Sư', 'Đạo Sỹ', 'Tế Sư', 'Thông Linh Sư', 'Khí Cụ Sư'];
// (4.3)
export const NHANH = {
  'Thuật Sỹ': ['Thiên', 'Địa', 'Nhân (chờ)'],
  'Chú Sư': ['Chú Ngôn', 'Thủ Ấn'],
  'Đạo Sỹ': ['Trấn', 'Khế', 'Khiển (chờ)'],
  'Tế Sư': ['Huyết Tế', 'Hương Hỏa', 'Hiến Vật (chờ)'],
  'Thông Linh Sư': ['Nhập', 'Xuất', 'Hoán (chờ)'],
  'Khí Cụ Sư': ['Cổ', 'Kim'],
};
export const TINH_TRUONG = {
  'Thuật Sỹ': ['Âm', 'Dương'], 'Chú Sư': ['Khẩu', 'Thủ'], 'Đạo Sỹ': ['Khế', 'Trấn'],
  'Tế Sư': ['Huyết', 'Hương'], 'Thông Linh Sư': ['Nhập', 'Xuất'], 'Khí Cụ Sư': ['Cổ', 'Kim'],
};
export const LUC_TINH = ['Âm', 'Dương', 'Khẩu', 'Thủ', 'Huyết', 'Hương', 'Khế', 'Trấn', 'Nhập', 'Xuất', 'Cổ', 'Kim'];
export const MENH = ['Kim', 'Mộc', 'Thủy', 'Hỏa', 'Thổ'];

const num = (v) => (v === '' || v == null || Number.isNaN(+v) ? null : +v);
export const mod = (score) => (num(score) == null ? null : Math.floor((num(score) - 10) / 2));
export const fmt = (n) => (n == null ? '–' : n >= 0 ? '+' + n : String(n));

// (3) bảng lên cấp
export const proficiency = (cap) => {
  const c = Math.min(20, Math.max(1, num(cap) || 1));
  return c <= 4 ? 2 : c <= 8 ? 3 : c <= 12 ? 4 : c <= 16 ? 5 : 6;
};

// (2.4) máu gốc theo tuổi
export const baseHp = (tuoi) => {
  const t = num(tuoi);
  if (t == null) return null;
  if (t < 10) return 10; if (t < 12) return 11; if (t < 14) return 12; if (t < 16) return 13; if (t < 18) return 14;
  if (t < 30) return 15; if (t < 40) return 14; if (t < 50) return 13; if (t < 60) return 12; if (t < 70) return 11;
  return 10;
};

// Tính tất cả số trên phiếu từ dữ liệu người chơi nhập
export function derive(d) {
  const s = d.stats || {};
  const m = Object.fromEntries(STATS.map(({ k }) => [k, mod(s[k])]));
  const lost = (d.via_mat || []).filter(Boolean).length;
  // (2.2) mỗi vía mất: mod Vía +1, tối đa +5. Linh dùng vía ban đầu (4.1)
  const viaNow = m.via == null ? null : m.via + Math.min(5, lost);
  const pb = proficiency(d.cap);
  const main = d.chi_so_chinh && d.chi_so_chinh !== 'via' ? m[d.chi_so_chinh] : null;
  const mainPos = main == null ? null : Math.max(0, main);

  const linhBase = ['tue', 'tri', 'mi', 'via'].every((k) => m[k] != null)
    ? Math.max(0, m.tue + m.tri + m.mi + m.via) : null;
  const linhMax = linhBase == null || mainPos == null ? null
    : linhBase + ((num(d.cap) || 1) - 1) * mainPos + (num(d.linh_them) || 0);

  const hpBase = baseHp(d.tuoi);
  const hpMax = hpBase == null || m.the == null ? null
    : hpBase + m.the + (d.thien_on_mau ? m.the : 0) + (num(d.mau_them) || 0);

  const ac = m.man == null ? null : 10 + m.man + (num(d.ac_do) || 0);
  const saves = Object.fromEntries(STATS.map(({ k }) => {
    const base = k === 'via' ? viaNow : m[k];
    return [k, base == null ? null : base + ((d.thao_chong || []).includes(k) ? pb : 0)];
  }));
  const skills = Object.fromEntries(SKILLS.map(({ k, stat }) => {
    const base = stat === 'via' ? viaNow : m[stat];
    const prof = (d.ky_nang_thao || []).includes(k) ? pb * ((d.ky_nang_doi || []).includes(k) ? 2 : 1) : 0;
    return [k, base == null ? null : base + prof];
  }));

  return {
    mods: { ...m, via: viaNow }, viaGoc: m.via, lost, pb, main,
    ar: main == null ? null : main + pb,
    dc: main == null ? null : 8 + pb + main,
    phepNgay: main == null ? null : Math.max(1, main + pb),
    linhMax, hpBase, hpMax, ac, saves, skills,
    tranVia: m.tue, dinhThan: m.tue, atVia: m.mi,
    tuyetPhuc: (num(d.phuc) ?? 5) <= 0,
  };
}
