// Mục Nhân vật: mọi hồ sơ như nhau (phiếu người chơi tự công khai + hồ sơ GM lập).
// Ai có Căn thì gắn dấu ★.
// #nhan-vat            danh sách
// #nhan-vat/pc/<mã>    hồ sơ một PC
// #nhan-vat/npc/<mã>   hồ sơ một NPC
import { useEffect, useMemo, useState } from 'react';
import { rpc } from '../lib/api.js';
import { kv } from '../lib/store.js';
import { norm } from '../lib/norm.js';
import { Img } from './Media.jsx';
import { PcDossier, NpcDossier } from './Dossier.jsx';
import Editor from './Editor.jsx';

const CACHE = 'public-chars';

// Có Căn: phiếu có ô Căn, hoặc hồ sơ GM lập có ô “Căn”
export const canOf = (d) => String(d?.can || d?.Can || '').trim();

function Card({ href, photo, name, line, can }) {
  return (
    <a className="person" href={href}>
      <span className="person-photo">{photo ? <Img path={photo} alt="" /> : <span className="initial" aria-hidden="true">{(name || '?').trim().split(/\s+/).pop()[0]}</span>}</span>
      <span className="person-t">
        <b>{name}</b>
        <small>{line}</small>
        {can && <span className="person-tag can" title={'Có Căn: ' + can}>★ {can}</span>}
      </span>
    </a>
  );
}

export default function People({ pack, setPack, online, role, say, path, nav }) {
  const gm = role === 'gm';
  const [pcs, setPcs] = useState(null);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [edit, setEdit] = useState(null); // 'new' | mã NPC
  useEffect(() => { if (path[0] === 'them' && gm) setEdit('new'); }, [path[0], gm]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let stop = false;
    kv.get(CACHE).then((c) => { if (!stop && c && pcs === null) setPcs(c); });
    if (online) {
      rpc('public_characters').then(async (r) => { if (!stop) { setPcs(r || []); await kv.set(CACHE, r || []); } })
        .catch(() => { if (!stop) setPcs((p) => p || []); });
    } else setPcs((p) => p || []);
    return () => { stop = true; };
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  const npcs = useMemo(() => pack.entries.filter((e) => e.type === 'npc' && (gm || e.status !== 'draft')), [pack, gm]);
  const people = useMemo(() => {
    const all = [
      ...(pcs || []).map((c) => ({
        key: 'pc/' + c.id, can: canOf(c.data), name: c.data?.ten || c.name, photo: c.data?.chan_dung?.thumb || c.data?.chan_dung?.path,
        line: [c.data?.truong, c.data?.cap ? 'cấp ' + c.data.cap : '', c.data?.noi_o || c.data?.que_quan].filter(Boolean).join(' · '),
      })),
      ...npcs.map((e) => ({
        key: 'npc/' + e.id, can: canOf(e.data), name: e.name, photo: e.data?.hinh?.[0]?.thumb || e.data?.hinh?.[0]?.path,
        line: (e.status === 'draft' ? 'nháp · ' : '') + (e.summary || Object.values(e.data || {}).filter((v) => typeof v === 'string').slice(0, 2).join(' · ')),
      })),
    ];
    const nq = norm(q.trim());
    return all.filter((p) => (kind === 'all' || !!p.can) && (!nq || norm(p.name + ' ' + p.line).includes(nq)))
      .sort((a, b) => (!!b.can - !!a.can) || a.name.localeCompare(b.name, 'vi'));
  }, [pcs, npcs, q, kind]);

  // ---- một hồ sơ ----
  const [k, id] = path;
  if (k === 'pc' && id) {
    const c = (pcs || []).find((x) => x.id === id);
    return (
      <section>
        <p><a href="#nhan-vat">← Tất cả nhân vật</a></p>
        {c ? <PcDossier char={c} player={c.player} /> : <p className="muted">{pcs === null ? 'Đang tải hồ sơ...' : 'Hồ sơ này không còn công khai, hoặc chưa tải được khi offline.'}</p>}
      </section>
    );
  }
  if (k === 'npc' && id) {
    const e = npcs.find((x) => x.id === id);
    if (edit === id && e) {
      return (
        <section>
          <Editor entry={e} pack={pack} setPack={setPack} online={online} say={say} types={['npc']}
                  onDone={(nid) => { setEdit(null); if (!nid) nav('nhan-vat'); }} />
        </section>
      );
    }
    return (
      <section>
        <div className="row between">
          <a href="#nhan-vat">← Tất cả nhân vật</a>
          {gm && e && <button type="button" onClick={() => setEdit(id)}>Sửa hồ sơ</button>}
        </div>
        {e ? <NpcDossier e={e} /> : <p className="muted">Không tìm thấy hồ sơ này.</p>}
      </section>
    );
  }

  if (edit === 'new') {
    return (
      <section>
        <Editor entry={null} defaultType="npc" types={['npc']} pack={pack} setPack={setPack} online={online} say={say}
                onDone={(nid) => { setEdit(null); if (nid) nav('nhan-vat/npc/' + nid); }} />
      </section>
    );
  }

  // ---- danh sách ----
  const allCount = (pcs || []).length + npcs.length;
  const canCount = (pcs || []).filter((c) => canOf(c.data)).length + npcs.filter((e) => canOf(e.data)).length;
  return (
    <section>
      <div className="row between">
        <h1>Nhân vật</h1>
        {gm && <button type="button" className="pri" disabled={!online} onClick={() => setEdit('new')}>+ Lập hồ sơ</button>}
      </div>
      <p className="muted">Hồ sơ đã công khai. Người có Căn được gắn dấu ★.</p>
      <div className="searchbar">
        <label htmlFor="pq" className="sr">Tìm nhân vật</label>
        <input id="pq" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="tìm theo tên, trường, nơi ở..." autoComplete="off" />
      </div>
      <div className="chips" role="group" aria-label="Lọc">
        {[['all', 'Tất cả', allCount], ['can', '★ Có Căn', canCount]].map(([v, l, n]) => (
          <button key={v} type="button" aria-pressed={kind === v} onClick={() => setKind(v)}>{l} <span className="n">{n}</span></button>
        ))}
      </div>
      {pcs === null && <p className="muted">Đang tải hồ sơ...</p>}
      {pcs !== null && people.length === 0 && <p className="muted">Chưa có hồ sơ nào{q ? ' khớp với “' + q + '”' : ''}.</p>}
      <div className="people">
        {people.map((p) => <Card key={p.key} href={'#nhan-vat/' + p.key} {...p} />)}
      </div>
    </section>
  );
}
