import { useEffect, useMemo, useRef, useState } from 'react';
import { searchLocal } from '../lib/search.js';
import { rpc } from '../lib/api.js';
import Editor from './Editor.jsx';
import Import from './Import.jsx';
import { Img } from './Media.jsx';
import { EntryView, TYPES } from './Folio.jsx';
import { BAC, TINH, listOf, spellInfo } from '../lib/spell.js';

export { EntryView, TYPES };

// NPC nằm ở mục Nhân vật, không hiện trong sổ phép
const HERE = (e) => e.type !== 'npc';

export default function Search({ pack, setPack, index, online, role, say, nav, path = [] }) {
  const gm = role === 'gm';
  const [edit, setEdit] = useState(null); // null | 'new' | id
  const [q, setQ] = useState(() => sessionStorage.getItem('bltm.q') || '');
  const [type, setType] = useState('all');
  const [bac, setBac] = useState('');
  const [tinh, setTinh] = useState('');
  const [duy, setDuy] = useState(false);
  const [sort, setSort] = useState(null); // { k, dir }
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
  if (tinh) results = results.filter((e) => listOf(e.data?.tinh).includes(tinh));
  if (duy) results = results.filter((e) => spellInfo(e.data).duy_tri);
  // Sắp xếp theo cột như 5e.tools; chưa chọn cột thì giữ thứ tự liên quan nhất
  const COL = {
    name: (e) => e.name,
    bac: (e) => (BAC.indexOf(e.data?.bac) + 1) || (e.data?.d20 ? 10 + Number(e.data.d20) : 99),
    tinh: (e) => listOf(e.data?.tinh).join(' '),
    gia: (e) => (e.data?.gia === '' || e.data?.gia == null ? 999 : Number(e.data.gia)),
    hd: (e) => spellInfo(e.data).hanh_dong || '',
    tam: (e) => spellInfo(e.data).tam || '',
  };
  if (sort) {
    const f = COL[sort.k];
    results = [...results].sort((a, b) => { const x = f(a), y = f(b); return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'vi')) * sort.dir; });
  }
  const tinhs = TINH.filter((t) => pack.entries.some((e) => seen(e) && listOf(e.data?.tinh).includes(t)));
  const th = (k, label, cls = '') => (
    <th scope="col" className={cls} aria-sort={sort?.k === k ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
      <button type="button" onClick={() => setSort(sort?.k === k ? (sort.dir > 0 ? { k, dir: -1 } : null) : { k, dir: 1 })}>
        {label}{sort?.k === k ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );

  const pick = (e) => {
    setSel(e.id); setEdit(null);
    if (matchMedia('(max-width: 760px)').matches) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };

  return (
    <section>
      <div className="row between">
        <h1>Sổ phép &amp; nghi lễ</h1>
        {gm && (
          <div className="row">
            <button type="button" onClick={() => nav('tra-cuu/nhap')}>Nhập từ Excel</button>
            <button type="button" className="pri" disabled={!online} title={online ? '' : 'Cần có mạng'} onClick={() => { setEdit('new'); setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30); }}>+ Thêm mục</button>
          </div>
        )}
      </div>
      {p0 === 'nhap' && gm ? <Import pack={pack} setPack={setPack} online={online} say={say} onClose={() => nav('tra-cuu')} /> : (<>
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
        <>
          <div className="chips" role="group" aria-label="Lọc theo bậc phép">
            {BAC.map((b) => <button key={b} type="button" aria-pressed={bac === b} onClick={() => setBac(bac === b ? '' : b)}>{b}</button>)}
            <button type="button" aria-pressed={duy} onClick={() => setDuy(!duy)}>Cần duy trì</button>
          </div>
          <div className="chips" role="group" aria-label="Lọc theo Tính">
            {tinhs.map((t) => <button key={t} type="button" aria-pressed={tinh === t} onClick={() => setTinh(tinh === t ? '' : t)}>{t}</button>)}
          </div>
        </>
      )}
      <p className="muted small">&gt; {results.length} kết quả · {remote ? 'tìm trong database' : 'tìm trên máy'}</p>
      <div className="split">
        <div className="list table-wrap">
          {results.length === 0 ? <p className="muted pad">&gt; không thấy gì. thử bỏ bớt bộ lọc hoặc gõ ngắn hơn.</p> : (
            <table className="spell-table">
              <thead>
                <tr>{th('name', 'Tên')}{th('bac', 'Bậc')}{th('tinh', 'Tính')}{th('gia', 'Giá', 'num')}{th('hd', 'Hành động', 'c-hd')}{th('tam', 'Tầm', 'c-tam')}<th scope="col" className="c-dt" title="Cần duy trì">D</th></tr>
              </thead>
              <tbody>
                {results.slice(0, 400).map((e) => {
                  const x = e.type === 'spell' ? spellInfo(e.data) : {};
                  return (
                    <tr key={e.id} className={'item' + (sel === e.id ? ' sel' : '')} onClick={() => pick(e)}>
                      <td>
                        <button type="button" className="row-btn" onClick={(ev) => { ev.stopPropagation(); pick(e); }}>
                          {e.data?.hinh?.length ? <Img className="tn" path={e.data.hinh[0].thumb || e.data.hinh[0].path} /> : null}
                          <b>{e.name}</b>
                        </button>
                        {e.status === 'draft' ? <span className="draft">nháp</span> : null}
                        {e.type !== 'spell' && <small> {TYPES[e.type] || e.type}</small>}
                      </td>
                      <td>{e.data?.bac || (e.data?.d20 ? 'd20 · ' + e.data.d20 : '')}</td>
                      <td>{listOf(e.data?.tinh).join(' + ')}</td>
                      <td className="num">{e.data?.gia ?? ''}</td>
                      <td className="c-hd">{x.hanh_dong || e.data?.thoi_gian || ''}</td>
                      <td className="c-tam">{x.tam || ''}</td>
                      <td className="c-dt">{x.duy_tri ? '◆' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
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
      </>)}
    </section>
  );
}
