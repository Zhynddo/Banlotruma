// Tìm hồ sơ: gõ từ khoá, máy "dò kho" (cuộn nhanh tên tệp, mã ngẫu nhiên),
// rồi kết quả hiện ra dạng ký tự loạn và giải mã dần thành tên thật.
// Tìm trong truyện đã đăng, sổ phép, NPC và hồ sơ PC công khai.
import { useEffect, useMemo, useRef, useState } from 'react';
import { rpc } from '../lib/api.js';
import { kv } from '../lib/store.js';
import { norm } from '../lib/norm.js';
import { usePosts } from '../lib/posts.js';
import { TYPES } from './Folio.jsx';
import { reduced, hex, pad } from '../shell/ui.js';

const GLYPH = '█▓▒░#$%&@*+=<>?/\\|ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const rnd = (s) => s[Math.floor(Math.random() * s.length)];
const slug = (t) => norm(t).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase().slice(0, 22);

function Decode({ text, delay = 0 }) {
  const [shown, setShown] = useState(reduced() ? text.length : -1);
  useEffect(() => {
    if (reduced()) return undefined;
    let i = 0;
    const start = setTimeout(() => {
      const t = setInterval(() => { i += Math.max(1, Math.ceil(text.length / 18)); setShown(i); if (i >= text.length) clearInterval(t); }, 32);
      cleanup.t = t;
    }, delay);
    const cleanup = { t: null };
    return () => { clearTimeout(start); clearInterval(cleanup.t); };
  }, [text, delay]);
  const [, tick] = useState(0);
  useEffect(() => {
    if (shown >= text.length) return undefined;
    const t = setInterval(() => tick((x) => x + 1), 45);
    return () => clearInterval(t);
  }, [shown, text.length]);
  return <>{text.split('').map((c, i) => (i < shown || c === ' ' ? c : rnd(GLYPH))).join('')}</>;
}

function snippet(src, terms) {
  const s = String(src || '').replace(/\s+/g, ' ');
  const n = norm(s);
  const at = Math.max(0, Math.min(...terms.map((t) => { const i = n.indexOf(t); return i < 0 ? Infinity : i; })));
  if (!Number.isFinite(at)) return s.slice(0, 120);
  const a = Math.max(0, at - 50);
  return (a > 0 ? '…' : '') + s.slice(a, a + 140) + (a + 140 < s.length ? '…' : '');
}

export default function Finder({ pack, online, role, path }) {
  const { posts } = usePosts(online);
  const [pcs, setPcs] = useState([]);
  const [q, setQ] = useState(path[0] ? decodeURIComponent(path[0]) : '');
  const [runs, setRuns] = useState([]); // các lần tìm: { q, phase, scan[], hits[] }
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const gm = role === 'gm';

  useEffect(() => {
    kv.get('public-chars').then((c) => c && setPcs(c));
    if (online) rpc('public_characters').then((r) => { setPcs(r || []); kv.set('public-chars', r || []); }).catch(() => {});
  }, [online]);

  // Mọi thứ tìm được, gom về một dạng
  const corpus = useMemo(() => [
    ...(posts || []).map((p) => ({ kind: 'TRUYỆN', file: 'TRUYEN/' + slug(p.title) + '.TXT', title: p.title, text: p.title + ' ' + p.author_name + ' ' + p.body, body: p.body, href: '#truyen/' + p.id })),
    ...pack.entries.filter((e) => gm || e.status !== 'draft').map((e) => ({
      kind: (TYPES[e.type] || e.type).toUpperCase(), file: (e.type === 'npc' ? 'HOSO/' : 'SOPHEP/') + slug(e.name) + '.DAT', title: e.name,
      text: [e.name, e.summary, e.body, ...Object.values(e.data || {}).filter((v) => typeof v === 'string')].join(' '), body: e.summary || e.body || e.data?.duoc,
      href: e.type === 'npc' ? '#nhan-vat/npc/' + e.id : '#tra-cuu/' + e.id,
    })),
    ...pcs.map((c) => ({ kind: 'PC', file: 'HOSO/PC_' + slug(c.data?.ten || c.name) + '.DAT', title: c.data?.ten || c.name,
      text: [c.data?.ten, c.name, c.player, c.data?.truong, c.data?.que_quan, c.data?.tieu_su].join(' '), body: c.data?.tieu_su, href: '#nhan-vat/pc/' + c.id })),
  ].map((x) => ({ ...x, n: norm(x.text), nt: norm(x.title) })), [posts, pack, pcs, gm]);

  const run = (query) => {
    const terms = norm(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return;
    const hits = corpus.filter((x) => terms.every((t) => x.n.includes(t)))
      .map((x) => ({ ...x, score: terms.reduce((s, t) => s + (x.nt.includes(t) ? 3 : 1), 0) }))
      .sort((a, b) => b.score - a.score).slice(0, 40);
    const id = Date.now();
    setRuns((r) => [...r.slice(-3), { id, q: query, terms, phase: reduced() ? 'done' : 'scan', scan: [], hits }]);
    if (reduced()) return;
    // Dò kho: cuộn nhanh tên tệp trong kho, đánh dấu tệp khớp
    let k = 0;
    const hitSet = new Set(hits.map((h) => h.file));
    const pool = corpus.length ? corpus : [{ file: 'TRONG.DAT' }];
    const t = setInterval(() => {
      k += 1;
      const batch = Array.from({ length: 3 }, () => {
        const x = Math.random() < 0.7 ? rnd(pool) : { file: `SYS/${hex(4)}_${hex(2)}.BIN` };
        const ok = hitSet.has(x.file);
        return { s: `0x${hex(4)}:${hex(4)}  ${x.file.padEnd(36, ' ').slice(0, 36)} ${String(Math.floor(Math.random() * 90) + 1).padStart(2, ' ')}.${Math.floor(Math.random() * 10)}K  ${ok ? '[KHỚP]' : '......'}`, ok };
      });
      setRuns((r) => r.map((x) => (x.id === id ? { ...x, scan: [...x.scan, ...batch].slice(-14) } : x)));
      if (k > 26) { clearInterval(t); setRuns((r) => r.map((x) => (x.id === id ? { ...x, phase: 'done' } : x))); }
    }, 42);
  };

  useEffect(() => { if (path[0]) { run(decodeURIComponent(path[0])); setQ(''); } }, [corpus.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [runs]);

  const submit = (e) => { e.preventDefault(); const v = q.trim(); if (!v) return; setQ(''); run(v); };
  const ready = posts !== null;

  return (
    <div className="term finder" onClick={() => inputRef.current?.focus()}>
      <div className="term-body">
        <p className="term-dim">KHO: {corpus.length} TỆP ({(posts || []).length} TRUYỆN · {pack.entries.length} MỤC SỔ · {pcs.length} HỒ SƠ PC){ready ? '' : ' · ĐANG NẠP...'}</p>
        <p className="term-dim">Gõ từ khoá rồi Enter. Có dấu hay không dấu đều được: ma da, han thu, cho doc...</p>
        {runs.map((r) => (
          <div key={r.id} className="find-run">
            <p>C:\HOSO&gt; TIM "{r.q.toUpperCase()}"</p>
            {r.phase === 'scan' && <pre className="scan" aria-hidden="true">{r.scan.map((x) => x.s).join('\n')}</pre>}
            {r.phase === 'done' && (
              <>
                <p className="term-dim">ĐÃ DÒ {corpus.length} TỆP · {r.hits.length ? `${r.hits.length} TỆP KHỚP` : 'KHÔNG CÓ TỆP NÀO KHỚP'}</p>
                <ol className="hits">
                  {r.hits.map((h, i) => (
                    <li key={h.file + i}>
                      <a href={h.href} onClick={(e) => e.stopPropagation()}>
                        <span className="h-n">{pad(i + 1)}</span>
                        <span className="h-k">[{h.kind}]</span>
                        <span className="h-t"><Decode text={h.title} delay={i * 70} /></span>
                      </a>
                      {h.body && <span className="h-s">{snippet(h.body, r.terms)}</span>}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        ))}
        <form className="term-prompt" onSubmit={submit}>
          <label htmlFor="find-q">C:\HOSO&gt; TIM</label>
          <span className="typed" aria-hidden="true">{q}</span><span className="cursor" aria-hidden="true" />
          <input id="find-q" ref={inputRef} className="cmd-input" value={q} onChange={(e) => setQ(e.target.value)}
                 autoComplete="off" spellCheck="false" enterKeyHint="search" autoFocus={!('ontouchstart' in window)} />
        </form>
        <span ref={endRef} />
      </div>
    </div>
  );
}
