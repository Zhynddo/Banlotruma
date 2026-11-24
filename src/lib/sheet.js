// Cấu trúc dữ liệu một phiếu nhân vật (cột characters.data trong database).
export const SHEET_VERSION = 1;

export const blankSheet = () => ({
  v: SHEET_VERSION,
  // Thông tin chung
  ten: '', nguoi_choi: '', truong: '', nhanh: '', cap: 1, kinh_nghiem: 0,
  can: '', can_duoc: '', can_mat: '', duyen: '', gioi: '', menh: '', nghe: '',
  tuoi: null, tho: null, chi_so_chinh: '',
  // Thất Khiếu
  stats: { luc: null, man: null, the: null, tri: null, tue: null, mi: null, via: null },
  thao_chong: [], ky_nang_thao: [], ky_nang_doi: [], thong_thao_khac: '',
  // Sinh mạng
  mau: null, mau_ao: 0, mau_them: 0, thien_on_mau: false,
  via_mat: [false, false, false, false, false, false, false],
  via_hau_qua: ['', '', '', '', '', '', ''],
  hon_mat: [false, false, false],
  death_ok: 0,
  tho_hao: 0, han: '',
  phuc: 5,
  // Giao tranh
  ac_do: 0, di_chuyen: 30,
  don_danh: [{ ten: '', ar: '', sat_thuong: '', loai: '' }],
  // Linh pháp
  linh: null, linh_them: 0,
  luc_tinh: [],
  phep: [], // [{ id, chuan_bi }]
  // Tính năng, hành trang
  tinh_nang: '', ngo: '',
  hanh_trang: '', phap_bao: '',
  // Câu chuyện
  ngoai_hinh: '', ba_nguoi_thuong: '', mon_no: '', nguoi_da_khuat: '', vi_sao_thay_ma: '',
  tieu_su: '', an_oan: '', vu_ma: '', ghi_chu: '',
});

// Gộp dữ liệu cũ hoặc thiếu trường vào mẫu mới, không làm mất gì
export const normalizeSheet = (d) => {
  const b = blankSheet();
  const out = { ...b, ...(d || {}) };
  out.stats = { ...b.stats, ...(d?.stats || {}) };
  for (const k of ['via_mat', 'via_hau_qua', 'hon_mat']) {
    const arr = Array.isArray(d?.[k]) ? d[k] : [];
    out[k] = b[k].map((v, i) => (arr[i] === undefined ? v : arr[i]));
  }
  for (const k of ['thao_chong', 'ky_nang_thao', 'ky_nang_doi', 'luc_tinh', 'phep', 'don_danh']) {
    if (!Array.isArray(out[k])) out[k] = b[k];
  }
  out.v = SHEET_VERSION;
  return out;
};
