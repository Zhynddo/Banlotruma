import { useEffect, useMemo, useRef, useState } from 'react';
import { STATS, SKILLS, TRUONG, NHANH, TINH_TRUONG, LUC_TINH, MENH, derive, fmt } from '../lib/rules.js';
import { local, cloud, drafts, isLocal } from '../lib/characters.js';
import { searchLocal } from '../lib/search.js';
import { EntryView } from './Folio.jsx';
import { Paper, Sec } from './Dossier.jsx';
import { Img } from './Media.jsx';
import { media, currentUser } from '../lib/api.js';
import { prepareImage, newKey } from '../lib/image.js';

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
  const [photoBusy, setPhotoBusy] = useState(false);
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

  const photoPath = d.chan_dung?.path;
  const canPublish = !isLocal(c);
  const pickPhoto = async (file) => {
    if (!file) return;
    if (!online) { say('Cần có mạng để tải ảnh lên.', 'warn'); return; }
    setPhotoBusy(true);
    try {
      const { big, small, ext } = await prepareImage(file, 900);
      const key = `chan-dung/${c.owner_id || currentUser()?.id}/${newKey()}`;
      const h = { path: `${key}.${ext}`, thumb: `${key}-nho.${ext}` };
      await media.upload(h.path, big.blob);
      await media.upload(h.thumb, small.blob);
      const old = d.chan_dung;
      update({ chan_dung: h });
      if (old) media.remove([old.path, old.thumb].filter(Boolean));
      say('Đã dán ảnh vào hồ sơ.');
    } catch (e) { say('Chưa tải ảnh được: ' + e.message, 'bad'); }
    setPhotoBusy(false);
  };
  const photo = (
    <div className="cv-photo-edit">
      {photoPath ? <Img path={photoPath} alt={'Chân dung ' + (d.ten || c.name)} lazy={false} /> : <span>Ảnh<br />3 × 4</span>}
      {canPublish ? (
        <label className={'photo-btn' + (photoBusy || !online ? ' off' : '')}>
          <input type="file" accept="image/*" disabled={photoBusy || !online} onChange={(e) => { pickPhoto(e.target.files[0]); e.target.value = ''; }} />
          {photoBusy ? 'Đang dán...' : photoPath ? 'Đổi ảnh' : 'Dán ảnh'}
        </label>
      ) : null}
    </div>
  );
  const badge = (
    <div className="cv-public">
      {canPublish ? (
        <label className="check">
          <input type="checkbox" checked={!!d.cong_khai} onChange={(e) => set('cong_khai')(e.target.checked)} />
          Công khai hồ sơ trong mục Nhân vật
        </label>
      ) : <p className="muted small">Phiếu đang nằm trên máy. Đưa lên mạng thì mới dán ảnh và công khai được.</p>}
      {d.cong_khai && canPublish && <a className="small" href={'#nhan-vat/pc/' + c.id}>Xem hồ sơ như người khác thấy →</a>}
    </div>
  );
  // Hàm thường (không phải component) để ô nhập không bị dựng lại, mất con trỏ khi gõ
  const L = (label, child) => <li key={label}><label><span className="cv-k">{label}:</span>{child}</label></li>;
  const T = (k, ph) => <input value={d[k] ?? ''} placeholder={ph || '…'} onChange={(e) => set(k)(e.target.value)} />;
  const A = (k, ph) => <textarea value={d[k] ?? ''} placeholder={ph || ''} onChange={(e) => set(k)(e.target.value)} />;

  return (
    <section className="sheet">
      <div className="row between sheet-top">
        <button type="button" onClick={onClose}>← Danh sách</button>
        <span className={'save ' + (conflict ? 'bad' : status.startsWith('Nháp') || status.startsWith('Chưa') ? 'warn' : '')} role="status">{status}</span>
      </div>

      {conflict && (
        <div className="panel warnbox">
          <p>Phiếu này vừa được sửa ở nơi khác (máy khác, hoặc GM). Em muốn giữ bản nào?</p>
          <div className="row">
            <button type="button" className="pri" onClick={() => resolve(true)}>Giữ bản của em</button>
            <button type="button" onClick={() => resolve(false)}>Lấy bản trên mạng</button>
          </div>
        </div>
      )}

      <Paper kicker="Hồ sơ thầy pháp · phiếu nhân vật" title={c.name} sub="(tự khai)" photo={photo} badge={badge}
             sign={d.ten} date={c.updated_at} sealed={!!d.cong_khai}>
        <Sec n={0} title="SƠ LƯỢC BẢN THÂN">
          <ol className="cv-lines edit">
            {L('Họ và tên', T('ten', 'tên nhân vật'))}
            {L('Giới tính', T('gioi_tinh'))}
            {L('Tuổi', <Num value={d.tuoi} min={8} onChange={set('tuoi')} />)}
            {L('Thọ (10 + 10 × 1d8)', <Num value={d.tho} min={20} max={90} onChange={set('tho')} />)}
            {L('Quê quán', T('que_quan'))}
            {L('Nơi ở hiện nay', T('noi_o'))}
            {L('Mệnh (1.5)', <select value={d.menh} onChange={(e) => set('menh')(e.target.value)}>
                <option value="">chưa chọn</option>{MENH.map((t) => <option key={t}>{t}</option>)}
              </select>)}
            {L('Tôn giáo, đạo', T('ton_giao'))}
            {L('Nghề nghiệp đời thường', T('nghe'))}
            {L('Trường (4.3)', <select value={d.truong} onChange={(e) => update({ truong: e.target.value, nhanh: '' })}>
                <option value="">chưa chọn</option>{TRUONG.map((t) => <option key={t}>{t}</option>)}
              </select>)}
            {L('Nhánh (từ cấp 3)', <select value={d.nhanh} onChange={(e) => set('nhanh')(e.target.value)} disabled={!d.truong}>
                <option value="">chưa chọn</option>{(NHANH[d.truong] || []).map((t) => <option key={t}>{t}</option>)}
              </select>)}
            {L('Cấp bậc', <Num value={d.cap} min={1} max={20} onChange={set('cap')} />)}
            {L('Kinh nghiệm', <Num value={d.kinh_nghiem} min={0} onChange={set('kinh_nghiem')} />)}
            {L('Căn (d20, 2.7)', <select value={d.can} onChange={(e) => { const en = cans.find((y) => y.name === e.target.value); update({ can: e.target.value, can_duoc: en?.data?.duoc || '', can_mat: en?.data?.mat || '' }); }}>
                <option value="">chưa tung</option>{cans.map((e) => <option key={e.id} value={e.name}>{e.data?.d20}. {e.name}</option>)}
              </select>)}
            {L('Duyên vào nghề', T('duyen', 'ai dẫn vào nghề'))}
            {L('Giới (điều kiêng)', T('gioi'))}
            {L('Người chơi', T('nguoi_choi'))}
          </ol>
          {d.can && (
            <dl className="kv"><div><dt>Căn được</dt><dd>{d.can_duoc || canEntry?.data?.duoc}</dd></div><div><dt>Căn mất</dt><dd>{d.can_mat || canEntry?.data?.mat}</dd></div></dl>
          )}
          {d.tuoi != null && d.tho != null && d.tuoi >= d.tho && <p className="msg bad">Tuổi đã chạm Thọ (2.5).</p>}
        </Sec>

        <Sec n={1} title="QUAN HỆ – ÂN OÁN">
          <ol className="cv-lines edit">
            {L('Ba người tôi thương', T('ba_nguoi_thuong'))}
            {L('Một món nợ chưa trả', T('mon_no'))}
            {L('Người đã khuất tôi chưa buông được', T('nguoi_da_khuat'))}
          </ol>
          <label className="cv-area"><span className="cv-k">Ân oán với người âm, thần thánh (nợ ai, lời hứa, hạn):</span>{A('an_oan')}</label>
        </Sec>

        <Sec n={2} title="QUÁ TRÌNH BẢN THÂN">
          <label className="cv-area"><span className="cv-k">Vì sao tôi thấy được ma:</span>{A('vi_sao_thay_ma')}</label>
          <label className="cv-area"><span className="cv-k">Ngoại hình:</span>{A('ngoai_hinh')}</label>
          <label className="cv-area"><span className="cv-k">Tiểu sử (từ nhỏ tới nay):</span>{A('tieu_su')}</label>
        </Sec>

        <Sec n={3} title="NĂNG LỰC CHUYÊN MÔN">
          <div className="outs">
            <Out label="Thông thạo" value={'+' + x.pb} />
            <Field label="Chỉ số chính">
              <select value={d.chi_so_chinh} onChange={(e) => set('chi_so_chinh')(e.target.value)}>
                <option value="">chưa chọn</option>{STATS.filter((s) => s.k !== 'via').map((s) => <option key={s.k} value={s.k}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <table className="grid stats">
            <caption className="cv-cap">Bảng 1. Thất Khiếu</caption>
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
          <details className="cv-more">
            <summary>Bảng 2. Kỹ năng</summary>
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
            <label className="cv-area"><span className="cv-k">Thông thạo khác, ngôn ngữ:</span>{A('thong_thao_khac')}</label>
          </details>

          <h4 className="cv-h4">Linh pháp</h4>
          <div className="outs">
            <Out label="Linh tối đa" value={x.linhMax} hint={x.linhMax == null ? 'cần chỉ số và chỉ số chính' : '4.1'} />
            <Field label="Linh hiện tại"><Num value={d.linh} onChange={set('linh')} /></Field>
            <Field label="Linh cộng thêm"><Num value={d.linh_them} onChange={set('linh_them')} /></Field>
            <Out label="AR linh thuật" value={fmt(x.ar)} />
            <Out label="DC" value={x.dc} />
            <Out label="Phép chuẩn bị" value={x.phepNgay != null ? `${prepared}/${x.phepNgay}` : prepared} />
          </div>
          <p className="cv-k">Lục Tính:</p>
          <div className="chips">
            {LUC_TINH.map((t) => <button key={t} type="button" aria-pressed={d.luc_tinh.includes(t)} onClick={() => toggleIn('luc_tinh', t)}>{t}</button>)}
            {d.truong && <button type="button" className="ghost" onClick={() => update({ luc_tinh: [...new Set([...d.luc_tinh, ...TINH_TRUONG[d.truong]])] })}>+ tính của {d.truong}</button>}
          </div>
          <p className="cv-k">Sổ phép đã chép:</p>
          <div className="searchbar">
            <label htmlFor="sq" className="sr">Thêm phép</label>
            <input id="sq" type="search" value={spellQ} onChange={(e) => setSpellQ(e.target.value)} placeholder="tìm phép để chép thêm..." autoComplete="off" />
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
            <caption className="cv-cap">Bảng 3. Phép đã chép</caption>
            <thead><tr><th>Phép</th><th>Bậc</th><th>Giá</th><th>Chuẩn bị</th><th></th></tr></thead>
            <tbody>
              {spellsKnown.length === 0 && <tr><td colSpan={5} className="muted">Chưa chép phép nào.</td></tr>}
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
          {peek && <div className="peek"><EntryView e={byId.get(peek)} onClose={() => setPeek(null)} /></div>}
          <label className="cv-area"><span className="cv-k">Tính năng Trường và Nhánh (ghi cả số lần dùng):</span>{A('tinh_nang')}</label>
          <label className="cv-area"><span className="cv-k">Ngộ, ASI:</span>{A('ngo')}</label>
        </Sec>

        <Sec n={4} title="SỨC KHOẺ – GIAO TRANH">
          <div className="outs">
            <Out label="Máu tối đa" value={x.hpMax} hint={x.hpBase != null ? `gốc ${x.hpBase} theo tuổi + mod Thể` : 'cần Tuổi và Thể'} />
            <Field label="Máu hiện tại"><Num value={d.mau} onChange={set('mau')} /></Field>
            <Field label="Máu ảo"><Num value={d.mau_ao} min={0} onChange={set('mau_ao')} /></Field>
            <Out label="Tình trạng" value={tinhTrang || '–'} />
            <Field label="Máu cộng thêm"><Num value={d.mau_them} onChange={set('mau_them')} /></Field>
            <label className="check"><input type="checkbox" checked={d.thien_on_mau} onChange={(e) => set('thien_on_mau')(e.target.checked)} /> Trường thọ: cộng mod Thể thêm lần nữa</label>
          </div>
          <h4 className="cv-h4">Bảy vía <small className="muted">(bấm vào vía đã mất)</small></h4>
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
            <div><h4 className="cv-h4">Ba hồn <small className="muted">(bấm vào hồn đã mất)</small></h4><Dots n={3} filled={d.hon_mat} onToggle={(i) => flip('hon_mat', i)} label="Hồn đã mất" lostStyle /></div>
            <div><h4 className="cv-h4">Death save thành công</h4><Dots n={3} filled={[0, 1, 2].map((i) => i < d.death_ok)} onToggle={(i) => set('death_ok')(d.death_ok === i + 1 ? i : i + 1)} label="Death save thành công" /></div>
          </div>
          <p className="muted small">Mỗi lần death save thất bại mất một hồn, mất cả ba là chết (2.4).</p>
          <div className="outs">
            <Out label="AC" value={x.ac} hint="10 + Mẫn + đồ" />
            <Field label="Đồ hộ thân (+AC)"><Num value={d.ac_do} onChange={set('ac_do')} /></Field>
            <Out label="Initiative" value={fmt(x.mods.man)} />
            <Field label="Di chuyển (ft)"><Num value={d.di_chuyen} onChange={set('di_chuyen')} /></Field>
            <Out label="Trấn Vía" value={fmt(x.tranVia)} hint="d20 + Tuệ; DC + mod Vía" />
            <Out label="Át Vía" value={fmt(x.skills['at-via'])} hint="d20 + Mị" />
          </div>
          <p className="cv-k">Đòn đánh:</p>
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
        </Sec>

        <Sec n={5} title="KHEN THƯỞNG – KỶ LUẬT">
          <h4 className="cv-h4">Phúc <small className="muted">{d.phuc}/10</small></h4>
          <Dots n={10} filled={Array.from({ length: 10 }, (_, i) => i < d.phuc)} onToggle={(i) => set('phuc')(d.phuc === i + 1 ? i : i + 1)} label="Phúc" />
          {x.tuyetPhuc && <p className="msg bad">Tuyệt Phúc: xin keo không bao giờ ra Thánh (2.6).</p>}
          <ol className="cv-lines edit">
            {L('Năm thọ đã hao', <Num value={d.tho_hao} min={0} onChange={set('tho_hao')} />)}
            {L('Hạn sắp tới', T('han'))}
          </ol>
        </Sec>

        <Sec n={6} title="TÀI SẢN, PHÁP BẢO">
          <label className="cv-area"><span className="cv-k">Pháp bảo (nhận chủ, bản mệnh, lần còn, tính nết):</span>{A('phap_bao')}</label>
          <label className="cv-area"><span className="cv-k">Hành trang, đồ lễ, tiền bạc:</span>{A('hanh_trang')}</label>
        </Sec>

        <Sec n={7} title="GHI CHÉP RIÊNG (chỉ em và GM xem)">
          <label className="cv-area"><span className="cv-k">Vong đang theo vụ (tên thật, cách chết, muốn gì, Chấp, bằng chứng):</span>{A('vu_ma')}</label>
          <label className="cv-area"><span className="cv-k">Ghi chú khác:</span>{A('ghi_chu')}</label>
        </Sec>
      </Paper>

      <div className="row between sheet-bottom">
        <div className="row">
          {onUpload && <button type="button" className="pri" onClick={() => onUpload(latest.current)}>Đưa phiếu này lên mạng</button>}
        </div>
        <button type="button" className={delArm ? 'danger' : ''} onClick={remove}>{delArm ? 'Bấm lần nữa để xoá hẳn' : 'Xoá phiếu'}</button>
      </div>
    </section>
  );
}
