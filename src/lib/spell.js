// Các trường của một phép, dùng chung cho khung chỉ số, màn sửa và nhập Excel.
// Bản cũ gộp hết vào "thi" (vd "Action · 60ft · AR"): tự tách ra nếu chưa có trường riêng.

export const BAC = ['Cấp thấp', 'Sơ', 'Trung', 'Cao'];
export const TINH = ['Âm', 'Dương', 'Khẩu', 'Thủ', 'Huyết', 'Hương', 'Khế', 'Trấn', 'Nhập', 'Xuất', 'Cổ', 'Kim'];

const RANGE = /(ft|feet|chạm|bản thân|tại chỗ|dặm|tầm nhìn|mét|\bm\b|km|cõi)/i;
const TIME = /(tức thì|phút|giờ|ngày|lượt|tuần|tháng|năm|đêm|vĩnh viễn|tới khi|đến khi|tới nghỉ|giấc)/i;
const HIT = /^(AR|thử |thắng |cứu )/i;

export function splitThi(thi, hanhDong) {
  const out = { hanh_dong: '', tam: '', thoi_han: '', cach: '', kem: '', duy_tri: false };
  const parts = String(thi || '').split('·').map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return out;
  if (!hanhDong || parts[0] === hanhDong || !RANGE.test(parts[0])) out.hanh_dong = parts.shift();
  const extra = [];
  for (const p of parts) {
    let x = p;
    if (/,\s*duy trì$/i.test(x)) { out.duy_tri = true; x = x.replace(/,\s*duy trì$/i, ''); }
    if (!out.tam && RANGE.test(x) && !TIME.test(x)) out.tam = x;
    else if (HIT.test(x)) out.cach = out.cach ? out.cach + ', ' + x : x;
    else if (!out.thoi_han && TIME.test(x)) out.thoi_han = x;
    else extra.push(x);
  }
  out.kem = extra.join(', ');
  return out;
}

// Thông tin đầy đủ để hiển thị, ưu tiên trường riêng, thiếu thì tách từ "thi"
export function spellInfo(d = {}) {
  const old = splitThi(d.thi, d.hanh_dong);
  const pick = (k) => (d[k] !== undefined && d[k] !== null && d[k] !== '' ? d[k] : old[k]);
  return {
    hanh_dong: pick('hanh_dong'), tam: pick('tam'), thoi_han: pick('thoi_han'), cach: pick('cach'),
    kem: pick('kem'), duy_tri: !!(d.duy_tri || old.duy_tri), bac_cao: d.bac_cao || '',
  };
}

export const listOf = (v) => [].concat(v ?? []).flatMap((x) => String(x).split(/\s*[,+]\s*/)).map((x) => x.trim()).filter(Boolean);
