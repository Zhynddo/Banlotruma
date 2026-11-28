// Trình bày một mục trong kho như đồ thật:
//   phép    → lá bùa dán bên cạnh một trang sổ phép chép tay, luật chơi ghi bên lề
//   nghi lễ → lá sớ
//   còn lại → trang sổ chép tay
import { Gallery } from './Media.jsx';

export const TYPES = {
  all: 'Tất cả', spell: 'Phép', rite: 'Nghi lễ', can: 'Căn', item: 'Pháp bảo',
  npc: 'NPC', monster: 'Vong, yêu quỷ', place: 'Địa điểm', rule: 'Luật', lore: 'Truyền thuyết',
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
const SKIP = new Set(['bac', 'tinh', 'cua', 'duoc', 'mat', 'nhap', 'hinh', 'gia', 'duy_tri', 'muc', 'd20']);
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
  const meta = [d.bac && 'bậc ' + d.bac, list(d.tinh).length && 'tính ' + list(d.tinh).join(' + '), d.gia != null && d.gia !== '' && d.gia + ' linh'].filter(Boolean).join(' · ');
  const extra = [
    d.duy_tri ? ['Duy trì', 'phải giữ tâm, bị đánh trúng thì thử Thể'] : null,
    d.muc ? ['Xem luật', '§' + d.muc] : null,
  ].filter(Boolean);
  return (
    <article className="folio spell">
      <Talisman e={e} />
      <div className="page">
        <p className="kicker">Sổ phép · {meta}</p>
        <h2>{e.name}</h2>
        {e.summary && <p className="lede">{e.summary}</p>}
        <Gallery items={Array.isArray(d.hinh) ? d.hinh : []} />
        <Body text={e.body} />
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
        <Margin d={d} extra={d.muc ? [['Xem luật', '§' + d.muc]] : []} />
        <Tags e={e} />
      </div>
    </article>
  );
}

export function EntryView({ e, onClose, onEdit }) {
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
      {e.type === 'spell' ? <SpellPage e={e} /> : e.type === 'rite' ? <RitePage e={e} /> : <PlainPage e={e} />}
    </div>
  );
}
