// Chuyển bảng Excel sổ phép thành các mục trong kho, và so với kho hiện tại.
// Cột nhận theo TÊN tiêu đề (có dấu hay không đều được), thứ tự cột không quan trọng.
import { norm } from './norm.js';
import { BAC, TINH } from './spell.js';

export const COLUMNS = [
  { h: 'Mã', k: 'id' },
  { h: 'Tên', k: 'name', req: true },
  { h: 'Bậc', k: 'bac', req: true },
  { h: 'Tính', k: 'tinh' },
  { h: 'Giá (linh)', k: 'gia', alt: ['Giá'] },
  { h: 'Hành động', k: 'hanh_dong' },
  { h: 'Tầm', k: 'tam' },
  { h: 'Thời hạn', k: 'thoi_han' },
  { h: 'Duy trì', k: 'duy_tri' },
  { h: 'Cách trúng', k: 'cach' },
  { h: 'Kèm theo', k: 'kem' },
  { h: 'Mô tả', k: 'body', req: true },
  { h: 'Ở bậc cao hơn', k: 'bac_cao' },
  { h: 'Gốc D&D', k: 'goc' },
  { h: 'Mục luật', k: 'muc' },
  { h: 'Ghi chú GM', k: 'ghi_chu', alt: ['Ghi chú'] },
  { h: 'Thẻ', k: 'tags' },
  { h: 'Trạng thái', k: 'status' },
  { h: 'Luật thử', k: 'nhap' },
];
const DATA_KEYS = ['bac', 'tinh', 'gia', 'hanh_dong', 'tam', 'thoi_han', 'duy_tri', 'cach', 'kem', 'bac_cao', 'goc', 'muc', 'ghi_chu', 'nhap'];
const LABEL = Object.fromEntries(COLUMNS.map((c) => [c.k, c.h]));

const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const yes = (v) => /^(có|co|x|v|true|1|yes|y|rồi|roi)$/i.test(String(v).trim());
const split = (v) => String(v || '').split(/\s*[+,;]\s*/).map((x) => x.trim()).filter(Boolean);

// Tìm sheet có dòng tiêu đề chứa cột "Tên", ưu tiên sheet tên "Phép"
function findTable(book) {
  const names = Object.keys(book).sort((a, b) => (norm(b) === 'phep') - (norm(a) === 'phep'));
  for (const name of names) {
    const rows = book[name];
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const hs = (rows[i] || []).map((x) => norm(x).replace(/\s*\*$/, '').trim());
      if (hs.includes('ten') && (hs.includes('bac') || hs.includes('mo ta'))) return { name, headerRow: i, headers: hs, rows };
    }
  }
  return null;
}

export function parseSheet(book) {
  const t = findTable(book);
  if (!t) throw new Error('Không thấy bảng phép: cần một sheet có dòng tiêu đề với cột “Tên”, “Bậc”, “Mô tả”.');
  const col = {};
  for (const c of COLUMNS) {
    const keys = [c.h, ...(c.alt || [])].map((h) => norm(h));
    const i = t.headers.findIndex((h) => keys.includes(h));
    if (i >= 0) col[c.k] = i;
  }
  const missing = COLUMNS.filter((c) => c.req && col[c.k] === undefined).map((c) => c.h);
  if (missing.length) throw new Error('Thiếu cột: ' + missing.join(', ') + '.');

  const items = [], errors = [], warns = [];
  t.rows.slice(t.headerRow + 1).forEach((r, i) => {
    const line = t.headerRow + i + 2;
    const get = (k) => (col[k] === undefined ? undefined : String(r[col[k]] ?? '').trim());
    if (!(r || []).some((x) => String(x || '').trim())) return; // dòng trống
    const name = get('name');
    if (!name) { errors.push(`Dòng ${line}: thiếu Tên.`); return; }
    const bacRaw = get('bac');
    const bac = BAC.find((b) => norm(b) === norm(bacRaw));
    if (!bac) { errors.push(`Dòng ${line} (${name}): Bậc “${bacRaw}” không hợp lệ, chọn một trong: ${BAC.join(', ')}.`); return; }
    const body = get('body');
    if (!body) { errors.push(`Dòng ${line} (${name}): thiếu Mô tả.`); return; }
    const giaRaw = get('gia');
    const gia = giaRaw === undefined || giaRaw === '' ? null : Number(giaRaw.replace(',', '.'));
    if (giaRaw && !Number.isFinite(gia)) { errors.push(`Dòng ${line} (${name}): Giá “${giaRaw}” không phải số.`); return; }
    const tinh = split(get('tinh')).map((x) => {
      const hit = TINH.find((y) => norm(y) === norm(x));
      if (!hit) warns.push(`Dòng ${line} (${name}): Tính “${x}” chưa có trong danh sách 12 Tính.`);
      return hit || x;
    });
    const data = {
      bac, tinh, gia,
      hanh_dong: get('hanh_dong') || '', tam: get('tam') || '', thoi_han: get('thoi_han') || '',
      duy_tri: yes(get('duy_tri') || ''), cach: get('cach') || '', kem: get('kem') || '',
      bac_cao: get('bac_cao') || '', goc: get('goc') || '', muc: get('muc') || '', ghi_chu: get('ghi_chu') || '',
      nhap: yes(get('nhap') || ''),
    };
    for (const k of DATA_KEYS) if (col[k] === undefined) delete data[k]; // cột không có trong file thì giữ nguyên giá trị cũ
    const st = get('status');
    items.push({
      line, id: get('id') || 'spell.' + slug(name), name, body,
      tags: col.tags === undefined ? undefined : split(get('tags')),
      status: st === undefined || st === '' ? undefined : /nh[aá]p|draft/i.test(st) ? 'draft' : 'published',
      data,
    });
  });
  const seen = new Map();
  for (const it of items) {
    if (seen.has(it.id)) errors.push(`Dòng ${it.line} (${it.name}): trùng mã với dòng ${seen.get(it.id)}, chỉ lấy dòng đầu.`);
    else seen.set(it.id, it.line);
  }
  return { sheet: t.name, rows: items.filter((it) => seen.get(it.id) === it.line), errors, warns };
}

const same = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');

// So với kho: phép mới, phép sửa (kèm danh sách ô đổi), giữ nguyên
export function plan(rows, entries) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const out = { add: [], change: [], keep: [] };
  for (const it of rows) {
    const old = byId.get(it.id);
    if (!old) { out.add.push({ it }); continue; }
    if (old.type !== 'spell') { out.change.push({ it, old, diff: ['Loại: ' + old.type + ' → phép'] }); continue; }
    const diff = [];
    if (old.name !== it.name) diff.push('Tên');
    if ((old.body || '') !== it.body) diff.push('Mô tả');
    if (it.tags !== undefined && !same(old.tags || [], it.tags)) diff.push('Thẻ');
    if (it.status !== undefined && old.status !== it.status) diff.push('Trạng thái');
    for (const [k, v] of Object.entries(it.data)) {
      const o = old.data?.[k];
      const empty = (x) => x === undefined || x === null || x === '' || x === false || (Array.isArray(x) && !x.length);
      if (empty(o) && empty(v)) continue;
      if (!same(o, v)) diff.push(LABEL[k] || k);
    }
    if (old.data?.thi !== undefined && diff.length) diff.push('(bỏ ô Thi cũ)');
    (diff.length ? out.change : out.keep).push({ it, old, diff });
  }
  return out;
}

// Dòng ghi vào database
export function toRow(it, old) {
  const data = { ...(old?.data || {}), ...it.data };
  delete data.thi;
  const row = { name: it.name, body: it.body, data };
  if (it.tags !== undefined) row.tags = it.tags;
  if (it.status !== undefined) row.status = it.status;
  if (!old) return { id: it.id, type: 'spell', source: 'Nhập từ Excel', ...row, tags: it.tags || [] };
  return { type: 'spell', ...row };
}
