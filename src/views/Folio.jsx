// Trình bày một mục trong kho như đồ thật:
//   phép    → lá bùa dán bên cạnh một trang sổ phép chép tay, luật chơi ghi bên lề
//   nghi lễ → lá sớ
//   còn lại → trang sổ chép tay
import { Gallery } from './Media.jsx';
import { useUi } from '../shell/ui.js';
import { spellInfo } from '../lib/spell.js';

export const TYPES = {
  all: 'Tất cả', spell: 'Phép', rite: 'Nghi lễ', can: 'Căn', item: 'Pháp bảo',
  npc: 'Nhân vật', monster: 'Vong, yêu quỷ', place: 'Địa điểm', rule: 'Luật', lore: 'Truyền thuyết',
};

// Chữ Hán trang trí cho từng Tính và từng bậc
const HAN = { Âm: '陰', Dương: '陽', Khẩu: '口', Thủ: '手', Huyết: '血', Hương: '香', Khế: '契', Trấn: '鎮', Nhập: '入', Xuất: '出', Cổ: '蠱', Kim: '金' };
const BAC_HAN = { 'Cấp thấp': '下', Sơ: '初', Trung: '中', Cao: '高' };
const KIND_HAN = { spell: '符', rite: '疏', can: '根', item: '寶', monster: '鬼', npc: '人', place: '地', rule: '律', lore: '傳' };

const list = (v) => [].concat(v ?? []).filter((x) => x !== '' && x != null);
const paras = (t) => String(t || '').split(/\n{2,}|\r\n\r\n/).map((x) => x.trim()).filter(Boolean);
const steps = (t) => String(t || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);

// Trường riêng của từng loại, để hiện thành ghi chú bên lề
const NOTE = {
  hanh_dong: 'Hành động', thi: 'Thi', gia: 'Giá', duy_tri: 'Duy trì', goc: 'Gốc D&D', muc: 'Mục luật',
  ghi_chu: 'Ghi chú', thoi_gian: 'Thời gian', loai: 'Loại', d20: 'Số d20',
};
const SKIP = new Set(['bac', 'tinh', 'cua', 'duoc', 'mat', 'nhap', 'hinh', 'gia', 'duy_tri', 'muc', 'd20', 'thi', 'tam', 'thoi_han', 'cach', 'kem', 'bac_cao', 'hanh_dong', 'goc', 'ghi_chu']);
const label = (k) => NOTE[k] || k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const val = (v) => (Array.isArray(v) ? v.join(' + ') : v === true ? 'có' : v === false ? 'không' : String(v));

function Talisman({ e }) {
  const d = e.data || {};
  const tinh = list(d.tinh);
  return (
    <div className="talisman" aria-hidden="true">
      <span className="t-top">敕令</span>
      <span className="t-ring">{tinh.length ? tinh.map((t) => HAN[t] || t[0]).join('') : KIND_HAN[e.type]}</span>
      <span className="t-name">{e.name}</span>
      <span className="t-foot">急急如律令</span>
      {d.bac && <span className="t-seal">{BAC_HAN[d.bac] || '印'}</span>}
    </div>
  );
}

function Margin({ d, extra = [] }) {
  const rows = [
    ...extra,
    ...Object.entries(d).filter(([k, v]) => !SKIP.has(k) && v !== null && v !== '' && v !== false && (typeof v !== 'object' || Array.isArray(v)))
      .map(([k, v]) => [label(k), val(v)]),
  ].filter(([, v]) => v !== '' && v != null);
  if (!rows.length) return null;
  return (
    <aside className="margin" aria-label="Ghi chú luật chơi">
      {rows.map(([k, v]) => <p key={k}><b>{k}:</b> {v}</p>)}
    </aside>
  );
}

function Body({ text, dropcap = true }) {
  const ps = paras(text);
  if (!ps.length) return null;
  return <div className={'text' + (dropcap ? ' drop' : '')}>{ps.map((p, i) => <p key={i}>{p}</p>)}</div>;
}

function Tags({ e }) {
  if (!(e.tags || []).length && !e.source) return null;
  return (
    <footer className="folio-foot">
      {(e.tags || []).map((t) => <span key={t}>#{t}</span>)}
      {e.source && <span className="src">{e.source}</span>}
    </footer>
  );
}

function SpellPage({ e }) {
  const d = e.data || {};
  const x = spellInfo(d);
  const meta = [d.bac && 'bậc ' + d.bac, list(d.tinh).length && 'tính ' + list(d.tinh).join(' + '), d.gia != null && d.gia !== '' && d.gia + ' linh'].filter(Boolean).join(' · ');
  const stats = [
    ['Hành động', x.hanh_dong], ['Tầm', x.tam], ['Thời hạn', [x.thoi_han, x.duy_tri && 'cần duy trì'].filter(Boolean).join(', ')],
    ['Cách trúng', x.cach], ['Kèm theo', x.kem],
  ].filter(([, v]) => v);
  const extra = [
    d.goc ? ['Gốc D&D', d.goc] : null,
    d.muc ? ['Xem luật', '§' + d.muc] : null,
    d.ghi_chu ? ['Ghi chú', d.ghi_chu] : null,
  ].filter(Boolean);
  return (
    <article className="folio spell">
      <Talisman e={e} />
      <div className="page">
        <p className="kicker">Sổ phép · {meta}</p>
        <h2>{e.name}</h2>
        {e.summary && <p className="lede">{e.summary}</p>}
        {stats.length > 0 && <dl className="spell-stats">{stats.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
        <Gallery items={Array.isArray(d.hinh) ? d.hinh : []} />
        <Body text={e.body} />
        {x.bac_cao && <p className="upcast"><b>Ở bậc cao hơn.</b> {x.bac_cao}</p>}
        {Array.isArray(d.cua) && (
          <table className="ledger">
            <caption>Tám cửa</caption>
            <tbody>{d.cua.map((c) => <tr key={c.cua}><th scope="row">{c.cua}</th><td>{c.mo}</td></tr>)}</tbody>
          </table>
        )}
        <Margin d={d} extra={extra} />
        <Tags e={e} />
      </div>
    </article>
  );
}

function RitePage({ e }) {
  const d = e.data || {};
  const tinh = list(d.tinh);
  const st = steps(e.body);
  return (
    <article className="folio rite">
      <div className="so">
        <p className="so-han" aria-hidden="true">疏</p>
        <p className="kicker">Lá sớ · nghi lễ</p>
        <h2>{e.name}</h2>
        {e.summary && <p className="lede">{e.summary}</p>}
        <dl className="so-meta">
          {tinh.length > 0 && <div><dt>Tính</dt><dd>{tinh.join(' + ')}</dd></div>}
          {d.thoi_gian && <div><dt>Thời gian</dt><dd>{d.thoi_gian}</dd></div>}
          {d.muc && <div><dt>Xem luật</dt><dd>§{d.muc}</dd></div>}
        </dl>
        <Gallery items={Array.isArray(d.hinh) ? d.hinh : []} />
        {st.length > 1 ? <ol className="so-steps">{st.map((s, i) => <li key={i}>{s.replace(/^(\d+[.)]|[-•])\s*/, '')}</li>)}</ol> : <Body text={e.body} dropcap={false} />}
        <p className="so-end">Cẩn sớ.</p>
        <span className="seal" aria-hidden="true">{tinh.length ? tinh.map((t) => HAN[t] || '').join('') : '祭'}</span>
        <Margin d={Object.fromEntries(Object.entries(d).filter(([k]) => k !== 'thoi_gian'))} extra={[]} />
        <Tags e={e} />
      </div>
    </article>
  );
}

function PlainPage({ e }) {
  const d = e.data || {};
  const kicker = { can: `Căn · số ${d.d20 ?? '?'} trên d20`, item: 'Pháp bảo' + (d.bac ? ' · bậc ' + d.bac : '') + (list(d.tinh).length ? ' · tính ' + list(d.tinh).join(' + ') : '') }[e.type] || TYPES[e.type] || e.type;
  return (
    <article className={'folio plain ' + e.type}>
      <div className="page">
        <span className="kind-han" aria-hidden="true">{KIND_HAN[e.type] || '記'}</span>
        <p className="kicker">{kicker}</p>
        <h2>{e.name}</h2>
        {e.summary && <p className="lede">{e.summary}</p>}
        <Gallery items={Array.isArray(d.hinh) ? d.hinh : []} />
        {e.type === 'can' ? (
          <div className="duoc-mat">
            <div><h3>Được</h3><p>{d.duoc}</p></div>
            <div><h3>Mất</h3><p>{d.mat}</p></div>
          </div>
        ) : <Body text={e.body} />}
        <Margin d={d} extra={[['Hành động', d.hanh_dong], ['Gốc D&D', d.goc], ['Xem luật', d.muc ? '§' + d.muc : ''], ['Ghi chú', d.ghi_chu]].filter(([, v]) => v)} />
        <Tags e={e} />
      </div>
    </article>
  );
}

// Bản chữ terminal: cùng nội dung, trình bày như một tệp hồ sơ trên màn hình
function TextPage({ e }) {
  const d = e.data || {};
  const tinh = list(d.tinh);
  const x = e.type === 'spell' ? spellInfo(d) : {};
  const rows = [
    ['Loại', TYPES[e.type] || e.type], ['Bậc', d.bac], ['Tính', tinh.join(' + ')], ['Giá', d.gia != null && d.gia !== '' ? d.gia + ' linh' : ''],
    ['Hành động', x.hanh_dong || (e.type !== 'spell' ? d.hanh_dong : '')], ['Tầm', x.tam], ['Thời hạn', [x.thoi_han, x.duy_tri && 'cần duy trì'].filter(Boolean).join(', ')],
    ['Cách trúng', x.cach], ['Kèm theo', x.kem],
    ['Số d20', d.d20], ['Thời gian', d.thoi_gian], ['Loại đồ', d.loai],
    ...Object.entries(d).filter(([k, v]) => !SKIP.has(k) && !['thoi_gian', 'loai'].includes(k) && v !== null && v !== '' && v !== false && (typeof v !== 'object' || Array.isArray(v))).map(([k, v]) => [label(k), val(v)]),
    ['Gốc D&D', d.goc], ['Xem luật', d.muc ? '§' + d.muc : ''],
  ].filter(([, v]) => v !== '' && v != null && v !== false);
  const st = e.type === 'rite' ? steps(e.body) : [];
  return (
    <article className={'tdoc ' + e.type}>
      <header className="tdoc-head">
        <span className="tdoc-han" aria-hidden="true">{tinh.length ? tinh.map((t) => HAN[t] || '').join('') : KIND_HAN[e.type] || '記'}</span>
        <h2>{e.name}</h2>
        {e.summary && <p className="tdoc-sum">{e.summary}</p>}
      </header>
      <dl className="tdoc-kv">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <Gallery items={Array.isArray(d.hinh) ? d.hinh : []} />
      {e.type === 'can' ? (
        <dl className="tdoc-kv tdoc-dm"><div><dt>ĐƯỢC</dt><dd>{d.duoc}</dd></div><div><dt>MẤT</dt><dd>{d.mat}</dd></div></dl>
      ) : st.length > 1 ? (
        <ol className="tdoc-steps">{st.map((x, i) => <li key={i}>{x.replace(/^(\d+[.)]|[-•])\s*/, '')}</li>)}</ol>
      ) : (
        <div className="tdoc-body">{paras(e.body).map((x, i) => <p key={i}>{x}</p>)}</div>
      )}
      {x.bac_cao && <p className="tdoc-up"><b>Ở BẬC CAO HƠN.</b> {x.bac_cao}</p>}
      {Array.isArray(d.cua) && (
        <dl className="tdoc-kv"><div className="tdoc-cap"><dt>TÁM CỬA</dt><dd /></div>{d.cua.map((c) => <div key={c.cua}><dt>{c.cua}</dt><dd>{c.mo}</dd></div>)}</dl>
      )}
      {d.ghi_chu && <p className="tdoc-note">; {d.ghi_chu}</p>}
      {((e.tags || []).length > 0 || e.source) && <p className="tdoc-foot">{(e.tags || []).map((t) => '#' + t).join(' ')}{e.source ? ' · ' + e.source : ''}</p>}
      <p className="tdoc-end">--- HẾT TỆP ---</p>
    </article>
  );
}

export function EntryView({ e, onClose, onEdit }) {
  const { docs } = useUi();
  if (!e) return <p className="muted pick-hint">Chọn một mục bên trái để mở trang sổ.</p>;
  const d = e.data || {};
  return (
    <div className="entry">
      <div className="row between entry-bar">
        <p className="muted small">
          {TYPES[e.type] || e.type} · <code>{e.id}</code>
          {d.nhap ? <span className="draft">luật thử</span> : null}
          {e.status === 'draft' ? <span className="draft hidden-tag">nháp, chỉ GM thấy</span> : null}
        </p>
        <div className="row">
          {onEdit && <button type="button" onClick={onEdit}>Sửa</button>}
          {onClose && <button type="button" className="ghost" onClick={onClose} aria-label="Đóng chi tiết">✕</button>}
        </div>
      </div>
      {docs === 'text' ? <TextPage e={e} /> : e.type === 'spell' ? <SpellPage e={e} /> : e.type === 'rite' ? <RitePage e={e} /> : <PlainPage e={e} />}
    </div>
  );
}
