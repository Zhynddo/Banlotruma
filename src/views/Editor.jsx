// Màn hình GM sửa kho tra cứu: thêm, sửa, ẩn (nháp), xoá một mục.
import { useMemo, useState } from 'react';
import { table, request } from '../lib/api.js';
import { patchPack } from '../lib/pack.js';
import { norm } from '../lib/norm.js';

const BAC = ['Cấp thấp', 'Sơ', 'Trung', 'Cao'];

export const TYPE_NAMES = {
  spell: 'Phép', rite: 'Nghi lễ', can: 'Căn', item: 'Pháp bảo',
  npc: 'NPC', monster: 'Vong, yêu quỷ', place: 'Địa điểm', rule: 'Luật', lore: 'Truyền thuyết',
};

// Ô riêng của từng loại: [khoá, nhãn, kiểu, lựa chọn]
const FIELDS = {
  spell: [
    ['bac', 'Bậc', 'select', BAC], ['tinh', 'Tính', 'list'], ['gia', 'Giá (linh)', 'number'],
    ['hanh_dong', 'Hành động', 'text'], ['thi', 'Thi (tầm, cách đánh)', 'text'], ['goc', 'Gốc D&D', 'text'],
    ['muc', 'Mục luật', 'text'], ['duy_tri', 'Cần duy trì', 'bool'], ['nhap', 'Luật còn đang thử', 'bool'],
    ['ghi_chu', 'Ghi chú', 'area'],
  ],
  rite: [['tinh', 'Tính', 'list'], ['thoi_gian', 'Thời gian', 'text'], ['muc', 'Mục luật', 'text']],
  can: [['d20', 'Số d20', 'number'], ['muc', 'Mục luật', 'text'], ['duoc', 'Được', 'area'], ['mat', 'Mất', 'area']],
  item: [['bac', 'Bậc', 'select', BAC], ['loai', 'Loại', 'text'], ['tinh', 'Tính', 'list'], ['muc', 'Mục luật', 'text']],
};

const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'muc-moi';
const isPlain = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v) || (Array.isArray(v) && v.every((x) => typeof x !== 'object'));
const toText = (v) => (Array.isArray(v) ? v.join(', ') : v === true ? 'có' : v === false ? 'không' : v ?? '');
const fromText = (t) => {
  const s = t.trim();
  if (s === '') return '';
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s === 'có') return true;
  if (s === 'không') return false;
  return s;
};
const clean = (row) => { const r = { ...row }; delete r.search; return r; };

function toForm(e, type) {
  const d = e?.data || {};
  const known = new Set((FIELDS[type] || []).map((f) => f[0]));
  return {
    name: e?.name || '', status: e?.status || 'published', summary: e?.summary || '', body: e?.body || '',
    tags: (e?.tags || []).join(', '), source: e?.source || '',
    data: Object.fromEntries((FIELDS[type] || []).map(([k, , kind]) => [k, kind === 'list' ? toText(d[k]) : kind === 'bool' ? !!d[k] : d[k] ?? ''])),
    extra: Object.entries(d).filter(([k, v]) => !known.has(k) && isPlain(v)).map(([k, v]) => ({ k, v: toText(v) })),
    kept: Object.fromEntries(Object.entries(d).filter(([k, v]) => !known.has(k) && !isPlain(v))),
  };
}

function fromForm(f, type) {
  const data = { ...f.kept };
  for (const [k, , kind] of FIELDS[type] || []) {
    const v = f.data[k];
    if (kind === 'list') data[k] = String(v).split(',').map((x) => x.trim()).filter(Boolean);
    else if (kind === 'number') data[k] = v === '' ? null : Number(v);
    else if (kind === 'bool') data[k] = !!v;
    else data[k] = v;
  }
  for (const { k, v } of f.extra) if (k.trim()) data[slug(k).replace(/-/g, '_')] = fromText(v);
  return {
    name: f.name.trim(), status: f.status, summary: f.summary.trim() || null, body: f.body.trim() || null,
    tags: f.tags.split(',').map((x) => x.trim()).filter(Boolean), source: f.source.trim() || null, data,
  };
}

const why = (err) => {
  const m = err.message || '';
  if (err.offline) return 'Mất mạng rồi, có mạng lại em lưu lần nữa nha.';
  if (/entry_deletions/.test(m)) return 'Database chưa được cập nhật. Em chạy file supabase/update-01.sql trong Supabase rồi thử lại.';
  if (/row-level security|permission/i.test(m)) return 'Tài khoản này chưa có quyền GM.';
  if (/duplicate key/.test(m)) return 'Mã mục này đã có rồi, em đổi tên khác chút nha.';
  return m;
};

export default function Editor({ entry, pack, setPack, online, say, onDone }) {
  const isNew = !entry;
  const [type, setType] = useState(entry?.type || 'npc');
  const [f, setF] = useState(() => toForm(entry, entry?.type || 'npc'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [conflict, setConflict] = useState(false);

  const ids = useMemo(() => new Set(pack.entries.map((e) => e.id)), [pack]);
  const newId = useMemo(() => {
    const base = type + '.' + slug(f.name);
    let id = base, n = 2;
    while (ids.has(id)) id = base + '-' + n++;
    return id;
  }, [type, f.name, ids]);

  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const setD = (k) => (v) => setF((x) => ({ ...x, data: { ...x.data, [k]: v } }));
  const changeType = (t) => { setType(t); setF((x) => ({ ...toForm(null, t), name: x.name, status: x.status, summary: x.summary, body: x.body, tags: x.tags, source: x.source })); };

  const save = async (ev) => {
    ev.preventDefault();
    setErr(''); setConflict(false);
    if (!f.name.trim()) { setErr('Mục nào cũng cần có tên.'); return; }
    setBusy(true);
    try {
      const row = fromForm(f, type);
      let saved;
      if (isNew) {
        saved = await table.insert('entries', { id: newId, type, ...row });
      } else {
        const q = `id=eq.${encodeURIComponent(entry.id)}` + (entry.rev ? `&rev=eq.${entry.rev}` : '');
        const r = await table.update('entries', q, row);
        if (!r?.length) { setConflict(true); setBusy(false); return; }
        saved = r[0];
      }
      setPack(await patchPack(pack, { put: clean(saved) }));
      say(isNew ? 'Đã thêm “' + saved.name + '”.' : 'Đã lưu “' + saved.name + '”.');
      onDone(saved.id);
    } catch (e2) { setErr(why(e2)); }
    setBusy(false);
  };

  const reload = async () => {
    try {
      const r = await table.select('entries', `select=*&id=eq.${encodeURIComponent(entry.id)}`);
      if (r[0]) { const e = clean(r[0]); setPack(await patchPack(pack, { put: e })); say('Đã lấy bản mới nhất.'); onDone(e.id, true); }
    } catch (e2) { setErr(why(e2)); }
  };

  const remove = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    setBusy(true); setErr('');
    try {
      const r = await request(`/rest/v1/entries?id=eq.${encodeURIComponent(entry.id)}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
      if (!r?.length) throw new Error('row-level security');
      setPack(await patchPack(pack, { del: entry.id }));
      say('Đã xoá “' + entry.name + '”.');
      onDone(null);
    } catch (e2) { setErr(why(e2)); setBusy(false); }
  };

  return (
    <form className="editor" onSubmit={save}>
      <div className="row between">
        <h2>{isNew ? 'Thêm mục mới' : 'Sửa: ' + entry.name}</h2>
        <button type="button" className="ghost" onClick={() => onDone(entry?.id || null)} aria-label="Huỷ, không lưu">✕</button>
      </div>
      {!online && <p className="warnbox pad">&gt; Đang offline. Sửa kho cần có mạng.</p>}

      <div className="form">
        <label className="wide">Tên<input value={f.name} onChange={(e) => set('name')(e.target.value)} required autoFocus={isNew} /></label>
        <label>Loại
          <select value={type} disabled={!isNew} onChange={(e) => changeType(e.target.value)}>
            {Object.entries(TYPE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Hiển thị
          <select value={f.status} onChange={(e) => set('status')(e.target.value)}>
            <option value="published">Đăng (ai cũng thấy)</option>
            <option value="draft">Nháp (chỉ GM thấy)</option>
          </select>
        </label>
      </div>
      <p className="muted small">Mã: <code>{isNew ? newId : entry.id}</code>{isNew ? ' · tự đặt theo tên, sau này không đổi được' : ''}</p>

      {(FIELDS[type] || []).length > 0 && (
        <div className="form">
          {FIELDS[type].map(([k, label, kind, opts]) => {
            const v = f.data[k];
            if (kind === 'bool') return <label key={k} className="check"><input type="checkbox" checked={!!v} onChange={(e) => setD(k)(e.target.checked)} />{label}</label>;
            if (kind === 'select') return (
              <label key={k}>{label}
                <select value={v} onChange={(e) => setD(k)(e.target.value)}><option value="">—</option>{opts.map((o) => <option key={o}>{o}</option>)}</select>
              </label>
            );
            if (kind === 'area') return <label key={k} className="wide">{label}<textarea value={v} onChange={(e) => setD(k)(e.target.value)} /></label>;
            return (
              <label key={k}>{label}{kind === 'list' ? ' (cách nhau dấu phẩy)' : ''}
                <input value={v} inputMode={kind === 'number' ? 'numeric' : undefined} onChange={(e) => setD(k)(e.target.value)} />
              </label>
            );
          })}
        </div>
      )}

      <div className="form">
        {type !== 'can' && <label className="wide">Nội dung<textarea rows={6} value={f.body} onChange={(e) => set('body')(e.target.value)} /></label>}
        <label className="wide">Tóm tắt một dòng (không bắt buộc)<input value={f.summary} onChange={(e) => set('summary')(e.target.value)} /></label>
        <label>Thẻ (cách nhau dấu phẩy)<input value={f.tags} onChange={(e) => set('tags')(e.target.value)} /></label>
        <label>Nguồn<input value={f.source} onChange={(e) => set('source')(e.target.value)} placeholder="ví dụ: Bản tổng hợp 21/11" /></label>
      </div>

      <h3>Thông tin thêm</h3>
      <p className="muted small">Ô tự đặt, ví dụ NPC có “Ở đâu”, “Biết phép”, vong có “Máu”, “AC”.</p>
      {f.extra.map((x, i) => (
        <div key={i} className="row extra">
          <input aria-label="Tên ô" placeholder="tên ô" value={x.k} onChange={(e) => set('extra')(f.extra.map((y, j) => (j === i ? { ...y, k: e.target.value } : y)))} />
          <input aria-label={'Giá trị ' + (x.k || 'ô mới')} placeholder="giá trị" value={x.v} onChange={(e) => set('extra')(f.extra.map((y, j) => (j === i ? { ...y, v: e.target.value } : y)))} />
          <button type="button" className="ghost" aria-label={'Bỏ ô ' + x.k} onClick={() => set('extra')(f.extra.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" onClick={() => set('extra')([...f.extra, { k: '', v: '' }])}>+ Thêm ô</button>
      {Object.keys(f.kept).length > 0 && <p className="muted small">Giữ nguyên, sửa trong Supabase: {Object.keys(f.kept).join(', ')}</p>}

      {conflict && (
        <div className="warnbox pad">
          <p>&gt; Mục này vừa được sửa ở máy khác. Lưu bây giờ sẽ đè mất phần đó.</p>
          <button type="button" onClick={reload}>Lấy bản mới nhất (bỏ phần em đang sửa)</button>
        </div>
      )}
      {err && <p className="bad" role="alert">&gt; {err}</p>}

      <div className="row between actions">
        <div className="row">
          <button type="submit" className="pri" disabled={busy || !online}>{busy ? 'Đang lưu...' : 'Lưu'}</button>
          <button type="button" onClick={() => onDone(entry?.id || null)}>Huỷ</button>
        </div>
        {!isNew && (
          <button type="button" className="danger" disabled={busy || !online} onClick={remove} onBlur={() => setConfirmDel(false)}>
            {confirmDel ? 'Bấm lần nữa để xoá hẳn' : 'Xoá mục'}
          </button>
        )}
      </div>
    </form>
  );
}
