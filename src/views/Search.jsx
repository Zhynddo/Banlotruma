import { useEffect, useMemo, useRef, useState } from 'react';
import { searchLocal } from '../lib/search.js';
import { rpc } from '../lib/api.js';

export const TYPES = {
  all: 'Tất cả', spell: 'Phép', rite: 'Nghi lễ', can: 'Căn', item: 'Pháp bảo',
  npc: 'NPC', monster: 'Vong, yêu quỷ', place: 'Địa điểm', rule: 'Luật', lore: 'Truyền thuyết',
};
const BAC = ['Cấp thấp', 'Sơ', 'Trung', 'Cao'];
const LABEL = {
  bac: 'Bậc', tinh: 'Tính', gia: 'Giá (linh)', thi: 'Thi', hanh_dong: 'Hành động', duy_tri: 'Duy trì',
  goc: 'Gốc D&D', muc: 'Mục luật', d20: 'd20', loai: 'Loại', thoi_gian: 'Thời gian', ghi_chu: 'Ghi chú',
};
const HIDE = new Set(['cua', 'duoc', 'mat', 'nhap']);

const show = (v) => (Array.isArray(v) ? v.join(' + ') : v === true ? 'Có' : v === false ? 'Không' : String(v));

export function EntryView({ e, onClose }) {
  if (!e) return <p className="muted">&gt; chọn một mục để xem chi tiết.</p>;
  const d = e.data || {};
  const rows = Object.entries(d).filter(([k, v]) => !HIDE.has(k) && v !== null && v !== '' && (typeof v !== 'object' || Array.isArray(v)));
  return (
    <article className="entry">
      <div className="row between">
        <p className="muted small">{TYPES[e.type] || e.type} · <code>{e.id}</code>{d.nhap ? <span className="draft">nháp</span> : null}</p>
        {onClose && <button type="button" className="ghost" onClick={onClose} aria-label="Đóng chi tiết">✕</button>}
      </div>
      <h2>{e.name}</h2>
      <dl className="kv">
        {rows.map(([k, v]) => <div key={k}><dt>{LABEL[k] || k}</dt><dd>{show(v)}</dd></div>)}
      </dl>
      {e.type === 'can' ? (
        <dl className="kv">
          <div><dt>Được</dt><dd>{d.duoc}</dd></div>
          <div><dt>Mất</dt><dd>{d.mat}</dd></div>
        </dl>
      ) : <p className="body">{e.body}</p>}
      {Array.isArray(d.cua) && (
        <>
          <h3>Tám cửa</h3>
          <dl className="kv">{d.cua.map((c) => <div key={c.cua}><dt>{c.cua}</dt><dd>{c.mo}</dd></div>)}</dl>
        </>
      )}
      <p className="tags">{(e.tags || []).map((t) => <span key={t} className="tag">#{t}</span>)}</p>
      {e.source && <p className="muted small">{e.source}</p>}
    </article>
  );
}

export default function Search({ pack, index, online }) {
  const [q, setQ] = useState(() => sessionStorage.getItem('bltm.q') || '');
  const [type, setType] = useState('all');
  const [bac, setBac] = useState('');
  const [remote, setRemote] = useState(null);
  const [sel, setSel] = useState(null);
  const detailRef = useRef(null);
  const byId = useMemo(() => new Map(pack.entries.map((e) => [e.id, e])), [pack]);
  const counts = useMemo(() => {
    const c = { all: pack.entries.length };
    for (const e of pack.entries) c[e.type] = (c[e.type] || 0) + 1;
    return c;
  }, [pack]);

  useEffect(() => { try { sessionStorage.setItem('bltm.q', q); } catch { /* bỏ qua */ } }, [q]);

  // Có mạng thì tìm trong database (kết quả mới nhất), lỗi thì dùng kết quả trên máy
  useEffect(() => {
    setRemote(null);
    if (!online || !q.trim()) return;
    let stop = false;
    const t = setTimeout(async () => {
      try {
        const rows = await rpc('search_entries', { q, types: type === 'all' ? null : [type], lim: 100 });
        if (!stop) setRemote(rows.map((r) => byId.get(r.id) || { ...r, data: {}, tags: [] }));
      } catch { /* dùng kết quả trên máy */ }
    }, 200);
    return () => { stop = true; clearTimeout(t); };
  }, [q, type, online, byId]);

  const local = useMemo(() => searchLocal(index, q, type), [index, q, type]);
  let results = remote || local;
  if (bac) results = results.filter((e) => e.data?.bac === bac);

  const pick = (e) => {
    setSel(e.id);
    if (matchMedia('(max-width: 760px)').matches) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };

  return (
    <section>
      <h1>Tra cứu kho Bán Lộ</h1>
      <div className="searchbar">
        <label htmlFor="q" className="sr">Tìm trong kho</label>
        <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="gõ có dấu hay không dấu: han thu, kiem, vong..." autoComplete="off" enterKeyHint="search" />
      </div>
      <div className="chips" role="group" aria-label="Lọc theo loại">
        {Object.entries(TYPES).filter(([k]) => k === 'all' || counts[k]).map(([k, v]) => (
          <button key={k} type="button" aria-pressed={type === k} onClick={() => { setType(k); if (k !== 'spell' && k !== 'all') setBac(''); }}>
            {v} <span className="n">{counts[k] || 0}</span>
          </button>
        ))}
      </div>
      {(type === 'spell' || type === 'all') && (
        <div className="chips" role="group" aria-label="Lọc theo bậc phép">
          {BAC.map((b) => <button key={b} type="button" aria-pressed={bac === b} onClick={() => setBac(bac === b ? '' : b)}>{b}</button>)}
        </div>
      )}
      <p className="muted small">&gt; {results.length} kết quả · {remote ? 'tìm trong database' : 'tìm trên máy'}</p>
      <div className="split">
        <div className="list" role="list">
          {results.length === 0 && <p className="muted pad">&gt; không thấy gì. thử bỏ bớt bộ lọc hoặc gõ ngắn hơn.</p>}
          {results.slice(0, 300).map((e) => (
            <button key={e.id} type="button" role="listitem" className={'item' + (sel === e.id ? ' sel' : '')} onClick={() => pick(e)}>
              <b>{e.name}</b>
              <small>{TYPES[e.type] || e.type}{e.data?.bac ? ' · ' + e.data.bac : ''}{e.data?.tinh ? ' · ' + [].concat(e.data.tinh).join(' + ') : ''}{e.data?.d20 ? ' · d20: ' + e.data.d20 : ''}</small>
            </button>
          ))}
        </div>
        <div className="detail" ref={detailRef}>
          <EntryView e={sel ? byId.get(sel) : null} onClose={sel ? () => setSel(null) : null} />
        </div>
      </div>
    </section>
  );
}
