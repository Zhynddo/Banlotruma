import { useEffect, useMemo, useRef, useState } from 'react';
import { STATS, SKILLS, TRUONG, NHANH, TINH_TRUONG, LUC_TINH, MENH, derive, fmt } from '../lib/rules.js';
import { local, cloud, drafts, isLocal } from '../lib/characters.js';
import { searchLocal } from '../lib/search.js';
import { EntryView } from './Search.jsx';

const toNum = (v) => (v === '' ? null : Number(v));

function Field({ label, children, wide }) {
  return <label className={wide ? 'wide' : ''}>{label}{children}</label>;
}
function Num({ value, onChange, min, max, ...rest }) {
  return <input type="number" inputMode="numeric" value={value ?? ''} min={min} max={max} onChange={(e) => onChange(toNum(e.target.value))} {...rest} />;
}
function Dots({ n, filled, onToggle, label, lostStyle }) {
  return (
    <div className="dots" role="group" aria-label={label}>
      {Array.from({ length: n }, (_, i) => (
        <button key={i} type="button" className={lostStyle ? 'lost' : ''} aria-pressed={!!filled[i]} aria-label={`${label} ${i + 1}`} onClick={() => onToggle(i)} />
      ))}
    </div>
  );
}
function Out({ label, value, hint }) {
  return <div className="out"><span>{label}</span><b>{value ?? '–'}</b>{hint && <small>{hint}</small>}</div>;
}

export default function Sheet({ char, onClose, onUpload, online, pack, index, say }) {
  const [c, setC] = useState(char);
  const [status, setStatus] = useState(isLocal(char) ? 'Lưu trên máy này' : 'Đã đồng bộ');
  const [conflict, setConflict] = useState(false);
  const [spellQ, setSpellQ] = useState('');
  const [peek, setPeek] = useState(null);
  const [delArm, setDelArm] = useState(false);
  const latest = useRef(char);
  const timer = useRef(null);
  const saving = useRef(false);
  const again = useRef(false);

  const d = c.data;
  const x = useMemo(() => derive(d), [d]);
  const byId = useMemo(() => new Map(pack.entries.map((e) => [e.id, e])), [pack]);
  const cans = useMemo(() => pack.entries.filter((e) => e.type === 'can').sort((a, b) => (a.data?.d20 || 0) - (b.data?.d20 || 0)), [pack]);

  const persist = async () => {
    if (saving.current) { again.current = true; return; }
    saving.current = true;
    const cur = latest.current;
    try {
      if (isLocal(cur)) {
        const s = await local.save(cur); latest.current = { ...latest.current, rev: s.rev }; setStatus('Đã lưu trên máy này');
      } else if (!online) {
        await drafts.set(cur); setStatus('Nháp trên máy · chờ có mạng để đồng bộ');
      } else {
        const s = await cloud.save(cur); latest.current = { ...latest.current, rev: s.rev };
        setC((p) => ({ ...p, rev: s.rev })); setStatus('Đã lưu lên mạng');
      }
    } catch (e) {
      if (e.code === '40001') { await drafts.set(cur); setConflict(true); setStatus('Xung đột: phiếu vừa được sửa ở nơi khác'); }
      else if (e.offline) { await drafts.set(cur); setStatus('Nháp trên máy · chờ có mạng để đồng bộ'); }
      else { await drafts.set(cur); setStatus('Chưa lưu được: ' + e.message); }
    } finally {
      saving.current = false;
      if (again.current) { again.current = false; persist(); }
    }
  };

  const update = (patch) => {
    setC((p) => {
      const data = { ...p.data, ...patch };
      const next = { ...p, data, name: (data.ten || '').trim() || 'Nhân vật mới' };
      latest.current = { ...next, rev: latest.current.rev };
      return next;
    });
    setStatus('Đang lưu...');
    clearTimeout(timer.current);
    timer.current = setTimeout(persist, 900);
  };
  const set = (k) => (v) => update({ [k]: v });
  const setStat = (k, v) => update({ stats: { ...d.stats, [k]: v } });
  const toggleIn = (k, val) => update({ [k]: d[k].includes(val) ? d[k].filter((y) => y !== val) : [...d[k], val] });
  const flip = (k, i) => update({ [k]: d[k].map((v, j) => (j === i ? !v : v)) });

  // Lưu ngay khi rời phiếu
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); persist(); } }, []); // eslint-disable-line

  const resolve = async (keepMine) => {
    try {
      const remote = await cloud.fetchOne(c.id);
      if (!remote) { setConflict(false); return; }
      if (keepMine) {
        latest.current = { ...latest.current, rev: remote.rev };
        await persist();
      } else {
        await drafts.del(c.id);
        const next = { ...remote, data: { ...d, ...remote.data } };
        latest.current = next; setC(next); setStatus('Đã lấy bản trên mạng');
      }
      setConflict(false);
    } catch (e) { say('Chưa xử lý được: ' + e.message, 'bad'); }
  };

  const remove = async () => {
    if (!delArm) { setDelArm(true); setTimeout(() => setDelArm(false), 4000); return; }
    clearTimeout(timer.current); timer.current = null;
    try {
      if (isLocal(c)) await local.remove(c.id); else await cloud.remove(c.id);
      say('Đã xoá phiếu.'); onClose();
    } catch (e) { say('Không xoá được: ' + e.message, 'bad'); }
  };

  const spellsKnown = d.phep.map((p) => ({ ...p, e: byId.get(p.id) })).filter((p) => p.e);
  const prepared = d.phep.filter((p) => p.chuan_bi).length;
  const spellHits = useMemo(() => (spellQ.trim() ? searchLocal(index, spellQ, 'spell').slice(0, 12) : []), [index, spellQ]);
  const hpRatio = x.hpMax && d.mau != null ? d.mau / x.hpMax : null;
  const tinhTrang = hpRatio == null ? '' : d.mau <= 0 ? 'Hấp Hối' : hpRatio <= 1 / 3 ? 'Trọng Thương' : hpRatio <= 1 / 2 ? 'Chấn Thương' : 'Bình thường';
  const canEntry = cans.find((e) => e.name === d.can);

  return (
    <section className="sheet">
      <div className="row between sheet-top">
        <button type="button" onClick={onClose}>← Danh sách</button>
        <span className={'save ' + (conflict ? 'bad' : status.startsWith('Nháp') || status.startsWith('Chưa') ? 'warn' : '')} role="status">{status}</span>
      </div>
      <h1>{c.name}</h1>

      {conflict && (
        <div className="panel warnbox">
          <p>Phiếu này vừa được sửa ở nơi khác (máy khác, hoặc GM). Em muốn giữ bản nào?</p>
          <div className="row">
            <button type="button" className="pri" onClick={() => resolve(true)}>Giữ bản của em</button>
            <button type="button" onClick={() => resolve(false)}>Lấy bản trên mạng</button>
          </div>
        </div>
      )}

      <details open className="sec">
        <summary>Thông tin chung</summary>
        <div className="form">
          <Field label="Tên nhân vật"><input value={d.ten} onChange={(e) => set('ten')(e.target.value)} /></Field>
          <Field label="Người chơi"><input value={d.nguoi_choi} onChange={(e) => set('nguoi_choi')(e.target.value)} /></Field>
          <Field label="Trường (4.3)">
            <select value={d.truong} onChange={(e) => update({ truong: e.target.value, nhanh: '' })}>
              <option value="">chưa chọn</option>{TRUONG.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Nhánh (từ cấp 3)">
            <select value={d.nhanh} onChange={(e) => set('nhanh')(e.target.value)} disabled={!d.truong}>
              <option value="">chưa chọn</option>{(NHANH[d.truong] || []).map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Cấp"><Num value={d.cap} min={1} max={20} onChange={set('cap')} /></Field>
          <Field label="Kinh nghiệm"><Num value={d.kinh_nghiem} min={0} onChange={set('kinh_nghiem')} /></Field>
          <Field label="Căn (d20, 2.7)">
            <select value={d.can} onChange={(e) => { const en = cans.find((y) => y.name === e.target.value); update({ can: e.target.value, can_duoc: en?.data?.duoc || '', can_mat: en?.data?.mat || '' }); }}>
              <option value="">chưa tung</option>{cans.map((e) => <option key={e.id} value={e.name}>{e.data?.d20}. {e.name}</option>)}
            </select>
          </Field>
          <Field label="Mệnh (1.5)">
            <select value={d.menh} onChange={(e) => set('menh')(e.target.value)}>
              <option value="">chưa chọn</option>{MENH.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Duyên (ai dẫn vào nghề)"><input value={d.duyen} onChange={(e) => set('duyen')(e.target.value)} /></Field>
          <Field label="Giới (điều kiêng)"><input value={d.gioi} onChange={(e) => set('gioi')(e.target.value)} /></Field>
          <Field label="Nghề đời thường"><input value={d.nghe} onChange={(e) => set('nghe')(e.target.value)} /></Field>
          <Field label="Tuổi"><Num value={d.tuoi} min={8} onChange={set('tuoi')} /></Field>
          <Field label="Thọ (10 + 10 × 1d8)"><Num value={d.tho} min={20} max={90} onChange={set('tho')} /></Field>
        </div>
        {d.can && (
          <dl className="kv"><div><dt>Được</dt><dd>{d.can_duoc || canEntry?.data?.duoc}</dd></div><div><dt>Mất</dt><dd>{d.can_mat || canEntry?.data?.mat}</dd></div></dl>
        )}
        {d.tuoi != null && d.tho != null && d.tuoi >= d.tho && <p className="msg bad">Tuổi đã chạm Thọ (2.5).</p>}
      </details>

      <details open className="sec">
        <summary>Thất Khiếu</summary>
        <div className="outs">
          <Out label="Thông thạo" value={'+' + x.pb} />
          <Field label="Chỉ số chính">
            <select value={d.chi_so_chinh} onChange={(e) => set('chi_so_chinh')(e.target.value)}>
              <option value="">chưa chọn</option>{STATS.filter((s) => s.k !== 'via').map((s) => <option key={s.k} value={s.k}>{s.name}</option>)}
            </select>
          </Field>
        </div>
        <table className="grid stats">
          <thead><tr><th>Chỉ số</th><th>Điểm</th><th>Mod</th><th>Thạo chống</th><th>Saving throw</th></tr></thead>
          <tbody>
            {STATS.map((s) => (
              <tr key={s.k}>
                <th scope="row">{s.name}<small> {s.group}</small></th>
                <td><Num value={d.stats[s.k]} min={1} max={30} onChange={(v) => setStat(s.k, v)} aria-label={'Điểm ' + s.name} /></td>
                <td className="num">{fmt(x.mods[s.k])}{s.k === 'via' && x.lost ? <small> (gốc {fmt(x.viaGoc)})</small> : null}</td>
                <td><input type="checkbox" checked={d.thao_chong.includes(s.k)} onChange={() => toggleIn('thao_chong', s.k)} aria-label={'Thạo chống ' + s.name} /></td>
                <td className="num">{fmt(x.saves[s.k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">Vía càng cao, vía càng nhẹ. Mỗi vía mất: mod Vía +1, tối đa +5 (2.2).</p>
      </details>

      <details className="sec">
        <summary>Kỹ năng</summary>
        <table className="grid">
          <thead><tr><th>Kỹ năng</th><th>Thạo</th><th>Gấp đôi</th><th>Tổng</th></tr></thead>
          <tbody>
            {SKILLS.map((s) => (
              <tr key={s.k}>
                <th scope="row">{s.name}<small> {STATS.find((y) => y.k === s.stat).name}</small></th>
                <td><input type="checkbox" checked={d.ky_nang_thao.includes(s.k)} onChange={() => toggleIn('ky_nang_thao', s.k)} aria-label={'Thạo ' + s.name} /></td>
                <td><input type="checkbox" checked={d.ky_nang_doi.includes(s.k)} disabled={!d.ky_nang_thao.includes(s.k)} onChange={() => toggleIn('ky_nang_doi', s.k)} aria-label={'Gấp đôi ' + s.name} /></td>
                <td className="num">{fmt(x.skills[s.k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="form"><Field label="Thông thạo khác, ngôn ngữ" wide><textarea value={d.thong_thao_khac} onChange={(e) => set('thong_thao_khac')(e.target.value)} /></Field></div>
      </details>

      <details open className="sec">
        <summary>Sinh mạng</summary>
        <div className="outs">
          <Out label="Máu tối đa" value={x.hpMax} hint={x.hpBase != null ? `gốc ${x.hpBase} theo tuổi + mod Thể` : 'cần Tuổi và Thể'} />
          <Field label="Máu hiện tại"><Num value={d.mau} onChange={set('mau')} /></Field>
          <Field label="Máu ảo"><Num value={d.mau_ao} min={0} onChange={set('mau_ao')} /></Field>
          <Out label="Tình trạng" value={tinhTrang || '–'} />
          <Field label="Máu cộng thêm"><Num value={d.mau_them} onChange={set('mau_them')} /></Field>
          <label className="check"><input type="checkbox" checked={d.thien_on_mau} onChange={(e) => set('thien_on_mau')(e.target.checked)} /> Trường thọ: cộng mod Thể thêm lần nữa</label>
        </div>
        <h3>Bảy vía <small className="muted">(bấm vào vía đã mất)</small></h3>
        <Dots n={7} filled={d.via_mat} onToggle={(i) => flip('via_mat', i)} label="Vía đã mất" lostStyle />
        {d.via_mat.some(Boolean) && (
          <div className="form">
            {d.via_mat.map((m, i) => m && (
              <Field key={i} label={`Hậu quả vía ${i + 1}`}><input value={d.via_hau_qua[i]} onChange={(e) => update({ via_hau_qua: d.via_hau_qua.map((v, j) => (j === i ? e.target.value : v)) })} /></Field>
            ))}
          </div>
        )}
        {x.lost >= 7 && <p className="msg bad">Mất vía thứ 7: còn 49 ngày để làm lễ gọi vía (2.2).</p>}
        <div className="cols">
          <div><h3>Ba hồn <small className="muted">(bấm vào hồn đã mất)</small></h3><Dots n={3} filled={d.hon_mat} onToggle={(i) => flip('hon_mat', i)} label="Hồn đã mất" lostStyle /></div>
          <div><h3>Death save thành công</h3><Dots n={3} filled={[0, 1, 2].map((i) => i < d.death_ok)} onToggle={(i) => set('death_ok')(d.death_ok === i + 1 ? i : i + 1)} label="Death save thành công" /></div>
        </div>
        <p className="muted small">Mỗi lần death save thất bại mất một hồn, mất cả ba là chết (2.4).</p>
        <h3>Phúc <small className="muted">{d.phuc}/10</small></h3>
        <Dots n={10} filled={Array.from({ length: 10 }, (_, i) => i < d.phuc)} onToggle={(i) => set('phuc')(d.phuc === i + 1 ? i : i + 1)} label="Phúc" />
        {x.tuyetPhuc && <p className="msg bad">Tuyệt Phúc: xin keo không bao giờ ra Thánh (2.6).</p>}
        <div className="form">
          <Field label="Năm thọ đã hao"><Num value={d.tho_hao} min={0} onChange={set('tho_hao')} /></Field>
          <Field label="Hạn sắp tới" wide><input value={d.han} onChange={(e) => set('han')(e.target.value)} /></Field>
        </div>
      </details>

      <details open className="sec">
        <summary>Giao tranh</summary>
        <div className="outs">
          <Out label="AC" value={x.ac} hint="10 + Mẫn + đồ" />
          <Field label="Đồ hộ thân (+AC)"><Num value={d.ac_do} onChange={set('ac_do')} /></Field>
          <Out label="Initiative" value={fmt(x.mods.man)} />
          <Field label="Di chuyển (ft)"><Num value={d.di_chuyen} onChange={set('di_chuyen')} /></Field>
          <Out label="Trấn Vía" value={fmt(x.tranVia)} hint="d20 + Tuệ; DC + mod Vía" />
          <Out label="Át Vía" value={fmt(x.skills['at-via'])} hint="d20 + Mị" />
        </div>
        <h3>Đòn đánh</h3>
        <div className="attacks">
          {d.don_danh.map((a, i) => (
            <div key={i} className="attack">
              {['ten', 'ar', 'sat_thuong', 'loai'].map((k) => (
                <input key={k} value={a[k]} placeholder={{ ten: 'Tên', ar: 'AR', sat_thuong: 'Sát thương', loai: 'Loại (Dương, Âm...)' }[k]} aria-label={k}
                       onChange={(e) => update({ don_danh: d.don_danh.map((y, j) => (j === i ? { ...y, [k]: e.target.value } : y)) })} />
              ))}
              <button type="button" className="ghost" aria-label="Xoá đòn" onClick={() => update({ don_danh: d.don_danh.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button type="button" onClick={() => update({ don_danh: [...d.don_danh, { ten: '', ar: '', sat_thuong: '', loai: '' }] })}>+ Thêm đòn</button>
        </div>
      </details>

      <details open className="sec">
        <summary>Linh pháp</summary>
        <div className="outs">
          <Out label="Linh tối đa" value={x.linhMax} hint={x.linhMax == null ? 'cần chỉ số và chỉ số chính' : '4.1'} />
          <Field label="Linh hiện tại"><Num value={d.linh} onChange={set('linh')} /></Field>
          <Field label="Linh cộng thêm"><Num value={d.linh_them} onChange={set('linh_them')} /></Field>
          <Out label="AR linh thuật" value={fmt(x.ar)} />
          <Out label="DC" value={x.dc} />
          <Out label="Phép chuẩn bị" value={x.phepNgay != null ? `${prepared}/${x.phepNgay}` : prepared} />
        </div>
        <h3>Lục Tính</h3>
        <div className="chips">
          {LUC_TINH.map((t) => <button key={t} type="button" aria-pressed={d.luc_tinh.includes(t)} onClick={() => toggleIn('luc_tinh', t)}>{t}</button>)}
          {d.truong && <button type="button" className="ghost" onClick={() => update({ luc_tinh: [...new Set([...d.luc_tinh, ...TINH_TRUONG[d.truong]])] })}>+ tính của {d.truong}</button>}
        </div>
        <h3>Sổ phép</h3>
        <div className="searchbar">
          <label htmlFor="sq" className="sr">Thêm phép</label>
          <input id="sq" type="search" value={spellQ} onChange={(e) => setSpellQ(e.target.value)} placeholder="tìm phép để thêm..." autoComplete="off" />
        </div>
        {spellHits.length > 0 && (
          <div className="list short">
            {spellHits.map((e) => {
              const has = d.phep.some((p) => p.id === e.id);
              return (
                <button key={e.id} type="button" className="item" disabled={has}
                        onClick={() => { update({ phep: [...d.phep, { id: e.id, chuan_bi: false }] }); setSpellQ(''); }}>
                  <b>{has ? '✓ ' : '+ '}{e.name}</b><small>{e.data?.bac} · {[].concat(e.data?.tinh || []).join(' + ')} · {e.data?.gia} linh</small>
                </button>
              );
            })}
          </div>
        )}
        <table className="grid">
          <thead><tr><th>Phép</th><th>Bậc</th><th>Giá</th><th>Chuẩn bị</th><th></th></tr></thead>
          <tbody>
            {spellsKnown.length === 0 && <tr><td colSpan={5} className="muted">Chưa có phép nào.</td></tr>}
            {spellsKnown.map((p) => {
              const miss = [].concat(p.e.data?.tinh || []).filter((t) => !d.luc_tinh.includes(t));
              return (
                <tr key={p.id}>
                  <th scope="row"><button type="button" className="link" onClick={() => setPeek(peek === p.id ? null : p.id)}>{p.e.name}</button>{miss.length > 0 && d.luc_tinh.length > 0 && <small className="warn"> thiếu tính {miss.join(', ')}</small>}</th>
                  <td>{p.e.data?.bac}</td>
                  <td className="num">{p.e.data?.gia}</td>
                  <td><input type="checkbox" checked={!!p.chuan_bi} aria-label={'Chuẩn bị ' + p.e.name} onChange={() => update({ phep: d.phep.map((y) => (y.id === p.id ? { ...y, chuan_bi: !y.chuan_bi } : y)) })} /></td>
                  <td><button type="button" className="ghost" aria-label={'Bỏ ' + p.e.name} onClick={() => update({ phep: d.phep.filter((y) => y.id !== p.id) })}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {peek && <div className="panel"><EntryView e={byId.get(peek)} onClose={() => setPeek(null)} /></div>}
      </details>

      <details className="sec">
        <summary>Tính năng, Ngộ, hành trang</summary>
        <div className="form">
          <Field label="Tính năng Trường và Nhánh (ghi cả số lần dùng)" wide><textarea value={d.tinh_nang} onChange={(e) => set('tinh_nang')(e.target.value)} /></Field>
          <Field label="Ngộ, ASI" wide><textarea value={d.ngo} onChange={(e) => set('ngo')(e.target.value)} /></Field>
          <Field label="Hành trang, đồ lễ, tiền bạc" wide><textarea value={d.hanh_trang} onChange={(e) => set('hanh_trang')(e.target.value)} /></Field>
          <Field label="Pháp bảo (nhận chủ, bản mệnh, lần còn, tính nết)" wide><textarea value={d.phap_bao} onChange={(e) => set('phap_bao')(e.target.value)} /></Field>
        </div>
      </details>

      <details className="sec">
        <summary>Con người và câu chuyện</summary>
        <div className="form">
          <Field label="Ngoại hình" wide><textarea value={d.ngoai_hinh} onChange={(e) => set('ngoai_hinh')(e.target.value)} /></Field>
          <Field label="Ba người tôi thương" wide><input value={d.ba_nguoi_thuong} onChange={(e) => set('ba_nguoi_thuong')(e.target.value)} /></Field>
          <Field label="Một món nợ chưa trả" wide><input value={d.mon_no} onChange={(e) => set('mon_no')(e.target.value)} /></Field>
          <Field label="Một người đã khuất tôi chưa buông được" wide><input value={d.nguoi_da_khuat} onChange={(e) => set('nguoi_da_khuat')(e.target.value)} /></Field>
          <Field label="Vì sao tôi thấy được ma" wide><input value={d.vi_sao_thay_ma} onChange={(e) => set('vi_sao_thay_ma')(e.target.value)} /></Field>
          <Field label="Tiểu sử" wide><textarea value={d.tieu_su} onChange={(e) => set('tieu_su')(e.target.value)} /></Field>
        </div>
      </details>

      <details className="sec">
        <summary>Sổ ân oán và vụ ma</summary>
        <div className="form">
          <Field label="Ân oán với người âm, thần thánh (nợ ai, lời hứa, hạn)" wide><textarea value={d.an_oan} onChange={(e) => set('an_oan')(e.target.value)} /></Field>
          <Field label="Vong đang theo vụ (tên thật, cách chết, muốn gì, Chấp, bằng chứng)" wide><textarea value={d.vu_ma} onChange={(e) => set('vu_ma')(e.target.value)} /></Field>
          <Field label="Ghi chú khác" wide><textarea value={d.ghi_chu} onChange={(e) => set('ghi_chu')(e.target.value)} /></Field>
        </div>
      </details>

      <div className="row between sheet-bottom">
        <div className="row">
          {onUpload && <button type="button" className="pri" onClick={() => onUpload(latest.current)}>Đưa phiếu này lên mạng</button>}
        </div>
        <button type="button" className={delArm ? 'danger' : ''} onClick={remove}>{delArm ? 'Bấm lần nữa để xoá hẳn' : 'Xoá phiếu'}</button>
      </div>
    </section>
  );
}
