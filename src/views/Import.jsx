// GM nhập phép từ file Excel: chọn file, xem trước thay đổi, rồi ghi vào kho.
import { useState } from 'react';
import { table } from '../lib/api.js';
import { patchPack } from '../lib/pack.js';
import { readXlsx } from '../lib/xlsx.js';
import { parseSheet, plan, toRow } from '../lib/spellSheet.js';

const TEMPLATE = './files/BanLoTruMa_SoPhep.xlsx';

export default function Import({ pack, setPack, online, say, onClose }) {
  const [file, setFile] = useState(null);
  const [res, setRes] = useState(null);   // { sheet, rows, errors, warns, plan }
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [done, setDone] = useState(null);
  const [showKeep, setShowKeep] = useState(false);

  const pick = async (f) => {
    setErr(''); setRes(null); setDone(null); setFile(f);
    if (!f) return;
    if (typeof DecompressionStream === 'undefined') { setErr('Trình duyệt này quá cũ, không đọc được .xlsx. Dùng Chrome, Edge hoặc Safari bản mới.'); return; }
    try {
      const book = await readXlsx(f);
      const p = parseSheet(book);
      setRes({ ...p, plan: plan(p.rows, pack.entries) });
    } catch (e) { setErr(e.message); }
  };

  const run = async () => {
    const jobs = [...res.plan.add, ...res.plan.change];
    let next = pack, ok = 0;
    const fail = [];
    for (let i = 0; i < jobs.length; i++) {
      const { it, old } = jobs[i];
      setBusy(`Đang ghi ${i + 1}/${jobs.length}: ${it.name}`);
      try {
        const row = toRow(it, old);
        const r = old ? await table.update('entries', 'id=eq.' + encodeURIComponent(it.id), row) : await table.insert('entries', row);
        const saved = Array.isArray(r) ? r[0] : r;
        if (!saved) throw new Error('không có quyền ghi');
        const clean = { ...saved }; delete clean.search;
        next = await patchPack(next, { put: clean });
        ok++;
      } catch (e) { fail.push(`${it.name}: ${e.offline ? 'mất mạng' : e.message}`); }
    }
    setPack(next); setBusy(''); setDone({ ok, fail });
    say(fail.length ? `Đã nhập ${ok} phép, ${fail.length} phép lỗi.` : `Đã nhập ${ok} phép.`, fail.length ? 'warn' : 'ok');
  };

  const n = res ? res.plan.add.length + res.plan.change.length : 0;
  return (
    <section className="import">
      <div className="row between">
        <h2>Nhập phép từ Excel</h2>
        <button type="button" className="ghost" onClick={onClose} aria-label="Đóng màn nhập">✕</button>
      </div>
      <p className="muted">Điền phép vào file Excel theo mẫu (mỗi dòng một phép), rồi chọn file ở đây. Phép trùng Mã (hoặc trùng tên nếu để trống Mã) sẽ được cập nhật, phép mới được thêm vào. Không phép nào bị xoá.</p>
      <div className="row">
        <label className="upload">
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={!!busy}
                 onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }} />
          {file ? 'Chọn file khác' : 'Chọn file .xlsx'}
        </label>
        <a className="btn" href={TEMPLATE} download>Tải file mẫu (đủ 125 phép)</a>
      </div>
      {!online && <p className="msg warn">Đang offline. Đọc và xem trước được, nhưng cần mạng mới ghi vào kho.</p>}
      {err && <p className="msg bad" role="alert">{err}</p>}

      {res && (
        <div className="imp-res">
          <p>Đọc <b>{file?.name}</b> · sheet “{res.sheet}” · {res.rows.length} phép hợp lệ</p>
          <p className="imp-sum">
            <span className="add">+ {res.plan.add.length} phép mới</span>
            <span className="chg">~ {res.plan.change.length} phép sửa</span>
            <span>= {res.plan.keep.length} giữ nguyên</span>
            {res.errors.length > 0 && <span className="bad">! {res.errors.length} dòng lỗi (bỏ qua)</span>}
          </p>
          {res.errors.length > 0 && <ul className="imp-err">{res.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          {res.warns.length > 0 && <ul className="imp-warn">{res.warns.map((e) => <li key={e}>{e}</li>)}</ul>}
          {n > 0 && (
            <table className="spell-table imp-table">
              <thead><tr><th scope="col">Dòng</th><th scope="col">Thay đổi</th><th scope="col">Phép</th><th scope="col">Ô đổi</th></tr></thead>
              <tbody>
                {res.plan.add.map(({ it }) => <tr key={it.id}><td>{it.line}</td><td className="add">MỚI</td><td>{it.name}</td><td className="muted">{it.id}</td></tr>)}
                {res.plan.change.map(({ it, diff }) => <tr key={it.id}><td>{it.line}</td><td className="chg">SỬA</td><td>{it.name}</td><td>{diff.join(', ')}</td></tr>)}
              </tbody>
            </table>
          )}
          {res.plan.keep.length > 0 && (
            <p><button type="button" className="ghost" onClick={() => setShowKeep(!showKeep)}>{showKeep ? 'Ẩn' : 'Xem'} {res.plan.keep.length} phép giữ nguyên</button></p>
          )}
          {showKeep && <p className="muted small">{res.plan.keep.map(({ it }) => it.name).join(' · ')}</p>}
          {done ? (
            <div className="panel">
              <p>Đã nhập {done.ok} phép.{done.fail.length ? ` ${done.fail.length} phép lỗi:` : ''}</p>
              {done.fail.length > 0 && <ul className="imp-err">{done.fail.map((e) => <li key={e}>{e}</li>)}</ul>}
              <button type="button" onClick={onClose}>Xem sổ phép</button>
            </div>
          ) : (
            <div className="row">
              <button type="button" className="pri" disabled={!n || !!busy || !online} onClick={run}>{busy || (n ? `Nhập ${n} phép vào kho` : 'Không có gì để nhập')}</button>
              <button type="button" onClick={onClose} disabled={!!busy}>Huỷ</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
