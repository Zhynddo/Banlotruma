import { useEffect, useMemo, useRef, useState } from 'react';
import { searchLocal } from '../lib/search.js';
import { rpc } from '../lib/api.js';
import Editor from './Editor.jsx';
import { Img } from './Media.jsx';
import { EntryView, TYPES } from './Folio.jsx';

export { EntryView, TYPES };

const BAC = ['Cấp thấp', 'Sơ', 'Trung', 'Cao'];
// NPC nằm ở mục Nhân vật, không hiện trong sổ phép
const HERE = (e) => e.type !== 'npc';

export default function Search({ pack, setPack, index, online, role, say, path = [] }) {
  const gm = role === 'gm';
  const [edit, setEdit] = useState(null); // null | 'new' | id
  const [q, setQ] = useState(() => sessionStorage.getItem('bltm.q') || '');
  const [type, setType] = useState('all');
  const [bac, setBac] = useState('');
  const [remote, setRemote] = useState(null);
  const [sel, setSel] = useState(null);
  const detailRef = useRef(null);
  const byId = useMemo(() => new Map(pack.entries.map((e) => [e.id, e])), [pack]);
  const seen = (e) => HERE(e) && (gm || e.status !== 'draft');
  const counts = useMemo(() => {
    const c = { all: 0 };
    for (const e of pack.entries) if (seen(e)) { c.all++; c[e.type] = (c[e.type] || 0) + 1; }
    return c;
  }, [pack, gm]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { try { sessionStorage.setItem('bltm.q', q); } catch { /* bỏ qua */ } }, [q]);
  // #tra-cuu/them: thêm mục mới (GM); #tra-cuu/<mã mục>: mở thẳng mục đó
  const p0 = path[0];
  useEffect(() => {
    if (p0 === 'them') { if (gm) setEdit('new'); }
    else if (p0 && pack.entries.some((e) => e.id === p0)) { setSel(p0); setEdit(null); }
  }, [p0, gm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Có mạng thì tìm trong database (kết quả mới nhất), lỗi thì dùng kết quả trên máy
  useEffect(() => {
    setRemote(null);
    if (!online || !q.trim()) return;
    let stop = false;
    const t = setTimeout(async () => {
      try {
        const rows = await rpc('search_entries', { q, types: type === 'all' ? null : [type], lim: 100 });
        if (!stop) setRemote(rows.map((r) => byId.get(r.id) || { ...r, data: {}, tags: [] }).filter(seen));
      } catch { /* dùng kết quả trên máy */ }
    }, 200);
    return () => { stop = true; clearTimeout(t); };
  }, [q, type, online, byId]);

  const local = useMemo(() => searchLocal(index, q, type), [index, q, type]);
  let results = (remote || local).filter(seen);
  if (bac) results = results.filter((e) => e.data?.bac === bac);

  const pick = (e) => {
    setSel(e.id); setEdit(null);
    if (matchMedia('(max-width: 760px)').matches) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };

  return (
    <section>
      <div className="row between">
        <h1>Sổ phép &amp; nghi lễ</h1>
        {gm && <button type="button" className="pri" disabled={!online} title={online ? '' : 'Cần có mạng'} onClick={() => { setEdit('new'); setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30); }}>+ Thêm mục</button>}
      </div>
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
            <button key={e.id} type="button" role="listitem" className={'item' + (sel === e.id ? ' sel' : '') + (e.data?.hinh?.length ? ' has-pic' : '')} onClick={() => pick(e)}>
              {e.data?.hinh?.length ? <Img className="tn" path={e.data.hinh[0].thumb || e.data.hinh[0].path} /> : null}
              <b>{e.name}{e.status === 'draft' ? <span className="draft">nháp</span> : null}</b>
              <small>{TYPES[e.type] || e.type}{e.data?.bac ? ' · ' + e.data.bac : ''}{e.data?.tinh ? ' · ' + [].concat(e.data.tinh).join(' + ') : ''}{e.data?.d20 ? ' · d20: ' + e.data.d20 : ''}</small>
            </button>
          ))}
        </div>
        <div className="detail" ref={detailRef}>
          {edit ? (
            <Editor key={edit} defaultType="spell" types={['spell', 'rite', 'can', 'item', 'monster', 'place', 'rule', 'lore']} entry={edit === 'new' ? null : byId.get(edit)} pack={pack} setPack={setPack} online={online} say={say}
                    onDone={(id) => { setEdit(null); setSel(id); }} />
          ) : (
            <EntryView e={sel ? byId.get(sel) : null} onClose={sel ? () => setSel(null) : null}
                       onEdit={gm && sel && byId.get(sel) ? () => setEdit(sel) : null} />
          )}
        </div>
      </div>
    </section>
  );
}
