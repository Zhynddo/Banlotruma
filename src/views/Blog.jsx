// Blog truyện ma, trình bày như một BBS đời cũ: màn hình xanh, dòng lệnh có dấu nháy.
// Khách nộp bài không cần tài khoản, GM duyệt rồi mới đăng.
// #truyen          danh sách bài đã đăng
// #truyen/<mã>     đọc một bài
// #truyen/gui      nộp bài
// #truyen/duyet    GM duyệt bài
import { useCallback, useEffect, useRef, useState } from 'react';
import { table, rpc, config } from '../lib/api.js';
import { kv, prefs } from '../lib/store.js';

const CACHE = 'posts';
const COLS = 'select=id,title,author_name,body,published_at&status=eq.published&order=published_at.desc&limit=200';
const PER = 12;
const pad = (n, w = 2) => String(n).padStart(w, '0');
const day = (iso) => { if (!iso) return '--/--/----'; const t = new Date(iso); return `${pad(t.getDate())}/${pad(t.getMonth() + 1)}/${t.getFullYear()}`; };
const paras = (t) => String(t || '').split(/\n\s*\n|\r\n\s*\r\n/).map((x) => x.trim()).filter(Boolean);
const words = (t) => String(t || '').split(/\s+/).filter(Boolean).length;
const typing = (el) => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !el.classList.contains('cmd-input')) || el.tagName === 'SELECT');

function usePosts(online) {
  const [posts, setPosts] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const cached = await kv.get(CACHE);
    if (cached) setPosts((p) => p || cached);
    if (!online || !config.ready) { setPosts((p) => p || cached || []); return; }
    try { const r = await table.select('posts', COLS); setPosts(r); setErr(''); await kv.set(CACHE, r); }
    catch (e) { setErr(e.message); setPosts((p) => p || cached || []); }
  }, [online]);
  useEffect(() => { load(); }, [load]);
  return { posts, err, load };
}

function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 15000); return () => clearInterval(i); }, []);
  return <span><span className="cl-d">{day(t.toISOString())} </span>{pad(t.getHours())}:{pad(t.getMinutes())}</span>;
}

// Khung màn hình: thanh tiêu đề, nội dung, dòng lệnh có dấu nháy, thanh phím tắt
function Term({ title, who, keys, onCommand, msg, children }) {
  const [cmd, setCmd] = useState('');
  const [note, setNote] = useState('');
  const inputRef = useRef(null);
  useEffect(() => setNote(msg || ''), [msg]);
  useEffect(() => {
    const down = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') { const k = keys.find((x) => x.k === 'ESC'); if (k) { e.preventDefault(); k.run(); } return; }
      if (typing(document.activeElement) || document.activeElement === inputRef.current) return;
      const k = keys.find((x) => x.k.length === 1 && x.k.toLowerCase() === e.key.toLowerCase());
      if (k) { e.preventDefault(); k.run(); return; }
      if (/^[0-9]$/.test(e.key) && onCommand) { inputRef.current?.focus(); }
    };
    addEventListener('keydown', down);
    return () => removeEventListener('keydown', down);
  }, [keys, onCommand]);
  const submit = (e) => {
    e.preventDefault();
    const c = cmd.trim(); setCmd('');
    if (!c) return;
    const k = keys.find((x) => x.k.toLowerCase() === c.toLowerCase());
    if (k) { k.run(); setNote(''); return; }
    const r = onCommand ? onCommand(c) : false;
    setNote(r === true ? '' : typeof r === 'string' ? r : `LỆNH “${c.toUpperCase()}” KHÔNG HỢP LỆ`);
  };
  return (
    <div className="term">
      <div className="term-screen">
        <div className="term-bar"><span><span className="cl-d">BÁN LỘ BBS · </span>{title}</span><Clock /></div>
        <div className="term-sub"><span>NGƯỜI DÙNG: {who}</span><span>NODE 01<span className="cl-d"> · 9600 BAUD</span></span></div>
        <div className="term-body">{children}</div>
        {note && <p className="term-note" role="status">*** {note}</p>}
        {onCommand !== null && (
          <form className="term-prompt" onSubmit={submit} onClick={() => inputRef.current?.focus()}>
            <label htmlFor="bbs-cmd">LỆNH ==&gt;</label>
            <span className="typed" aria-hidden="true">{cmd}</span><span className="cursor" aria-hidden="true" />
            <input id="bbs-cmd" ref={inputRef} className="cmd-input" value={cmd} onChange={(e) => setCmd(e.target.value)}
                   autoComplete="off" autoCapitalize="characters" spellCheck="false" enterKeyHint="go" />
          </form>
        )}
        <div className="term-keys">
          {keys.map((k) => <button key={k.k} type="button" onClick={k.run}><kbd>{k.k}</kbd> {k.label}</button>)}
        </div>
      </div>
    </div>
  );
}

function List({ posts, err, gm, nav }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil((posts || []).length / PER));
  const rows = (posts || []).slice(page * PER, page * PER + PER);
  const keys = [
    { k: 'N', label: 'Nộp bài', run: () => nav('truyen/gui') },
    ...(gm ? [{ k: 'D', label: 'Duyệt bài', run: () => nav('truyen/duyet') }] : []),
    ...(page > 0 ? [{ k: 'T', label: 'Trang trước', run: () => setPage((p) => p - 1) }] : []),
    ...(page < pages - 1 ? [{ k: 'S', label: 'Trang sau', run: () => setPage((p) => p + 1) }] : []),
  ];
  const open = (c) => {
    const n = parseInt(c, 10);
    if (!Number.isFinite(n)) return false;
    const p = (posts || [])[n - 1];
    if (!p) return `KHÔNG CÓ BÀI SỐ ${n}`;
    nav('truyen/' + p.id); return true;
  };
  return (
    <Term title="TRUYỆN MA" who={gm ? 'GM' : 'KHÁCH'} keys={keys} onCommand={open} msg={err ? 'CHƯA TẢI ĐƯỢC BÀI MỚI' : ''}>
      <p className="term-dim">CONNECT 9600<br />CHÀO MỪNG TỚI BÁN LỘ BBS.</p>
      <h1 className="term-h">TRUYỆN MA</h1>
      <p>Chuyện người ta kể lại. Thật giả không bàn.</p>
      {posts === null ? <p>ĐANG TẢI<span className="dots" /></p> : posts.length === 0 ? <p>CHƯA CÓ BÀI NÀO.</p> : (
        <>
          <div className="bbs-list" role="list">
            <div className="bbs-row head" aria-hidden="true"><span className="n">SỐ</span><span className="d">NGÀY</span><span className="a">NGƯỜI KỂ</span><span className="t">TÊN TRUYỆN</span></div>
            {rows.map((p, i) => (
              <a key={p.id} className="bbs-row" role="listitem" href={'#truyen/' + p.id}>
                <span className="n">{pad(page * PER + i + 1)}</span>
                <span className="d">{day(p.published_at)}</span>
                <span className="a">{p.author_name}</span>
                <span className="t">{p.title}</span>
              </a>
            ))}
          </div>
          <p className="term-dim">{posts.length} BÀI · TRANG {page + 1}/{pages} · GÕ SỐ RỒI ENTER ĐỂ ĐỌC</p>
        </>
      )}
    </Term>
  );
}

function Read({ post, posts, gm, nav }) {
  const i = posts.findIndex((p) => p.id === post.id);
  const prev = posts[i + 1], next = posts[i - 1];
  const keys = [
    { k: 'ESC', label: 'Danh sách', run: () => nav('truyen') },
    ...(next ? [{ k: 'S', label: 'Bài mới hơn', run: () => nav('truyen/' + next.id) }] : []),
    ...(prev ? [{ k: 'T', label: 'Bài cũ hơn', run: () => nav('truyen/' + prev.id) }] : []),
    { k: 'N', label: 'Nộp bài', run: () => nav('truyen/gui') },
  ];
  return (
    <Term title={`BÀI ${pad(i + 1)}`} who={gm ? 'GM' : 'KHÁCH'} keys={keys} onCommand={null}>
      <article className="bbs-read">
        <p className="term-dim">TỪ: {post.author_name.toUpperCase()}<br />NGÀY: {day(post.published_at)} · {words(post.body)} CHỮ</p>
        <h1 className="term-h">{post.title}</h1>
        <div className="bbs-text">{paras(post.body).map((p, k) => <p key={k}>{p}</p>)}</div>
        <p className="term-end">--- HẾT ---</p>
      </article>
    </Term>
  );
}

function Submit({ online, gm, say, nav }) {
  const saved = prefs.get('post-draft') || {};
  const [f, setF] = useState({ title: saved.title || '', author: saved.author || '', body: saved.body || '', contact: saved.contact || '' });
  const [trap, setTrap] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) prefs.set('post-draft', f); }, [f, done]); // ghi ngay, tắt trang cũng không mất
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const ready = online && config.ready;

  const send = async (e) => {
    e?.preventDefault(); setErr('');
    if (!f.title.trim()) { setErr('THIẾU TÊN TRUYỆN.'); return; }
    if (f.body.trim().length < 20) { setErr('NỘI DUNG QUÁ NGẮN.'); return; }
    setBusy(true);
    try {
      await rpc('submit_post', { p_title: f.title, p_body: f.body, p_author: f.author, p_contact: f.contact, p_trap: trap });
      prefs.del('post-draft'); setDone(true); say('Đã nộp bài.');
    } catch (e2) { setErr(e2.offline ? 'MẤT KẾT NỐI. BÀI VẪN ĐƯỢC LƯU TRÊN MÁY, CÓ MẠNG THÌ NỘP LẠI.' : e2.message.toUpperCase()); }
    setBusy(false);
  };

  if (done) {
    return (
      <Term title="NỘP BÀI" who={gm ? 'GM' : 'KHÁCH'} onCommand={null} keys={[
        { k: 'ESC', label: 'Danh sách', run: () => nav('truyen') },
        { k: 'N', label: 'Nộp bài khác', run: () => { setF({ title: '', author: f.author, body: '', contact: f.contact }); setDone(false); } },
      ]}>
        <h1 className="term-h">ĐÃ NHẬN BÀI</h1>
        <p>Bài sẽ được đăng sau khi duyệt.</p>
      </Term>
    );
  }
  return (
    <Term title="NỘP BÀI" who={gm ? 'GM' : 'KHÁCH'} onCommand={null} keys={[{ k: 'ESC', label: 'Danh sách', run: () => nav('truyen') }]}>
      <h1 className="term-h">NỘP BÀI</h1>
      <p className="term-dim">KHÔNG CẦN TÀI KHOẢN. BÀI ĐƯỢC DUYỆT RỒI MỚI ĐĂNG.<br />BẢN ĐANG VIẾT ĐƯỢC LƯU TRÊN MÁY.</p>
      {!ready && <p>*** ĐANG OFFLINE. CÓ MẠNG THÌ NỘP.</p>}
      <form className="bbs-form" onSubmit={send}>
        <label><span>TÊN TRUYỆN ...:</span><input maxLength={200} value={f.title} onChange={set('title')} /></label>
        <label><span>BÚT DANH .....:</span><input maxLength={80} value={f.author} onChange={set('author')} placeholder="để trống: Người giấu tên" autoComplete="nickname" /></label>
        <label><span>LIÊN HỆ ......:</span><input maxLength={200} value={f.contact} onChange={set('contact')} placeholder="không bắt buộc, chỉ người duyệt thấy" /></label>
        <label className="full"><span>NỘI DUNG (xuống dòng hai lần để sang đoạn mới):</span><textarea rows={14} maxLength={60000} value={f.body} onChange={set('body')} /></label>
        <label className="trap" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
        <div className="bbs-actions">
          <span className="term-dim">{words(f.body)} CHỮ</span>
          <button type="submit" className="bbs-btn" disabled={busy || !ready}>{busy ? '[ ĐANG NỘP... ]' : '[ NỘP BÀI ]'}</button>
        </div>
        {err && <p className="term-note" role="alert">*** {err}</p>}
      </form>
    </Term>
  );
}

const STATUS = [['1', 'pending', 'Chờ duyệt'], ['2', 'published', 'Đã đăng'], ['3', 'rejected', 'Đã từ chối']];

function Queue({ online, say, setQueue, reloadPublic, nav }) {
  const [st, setSt] = useState('pending');
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);
  const [draft, setDraft] = useState({});
  const [arm, setArm] = useState(null);
  const load = useCallback(async () => {
    try {
      const r = await rpc('gm_posts', { p_status: st }); setRows(r || []);
      if (st === 'pending') setQueue((r || []).length);
    } catch (e) { setRows([]); say(e.message, 'bad'); }
  }, [st, say, setQueue]);
  useEffect(() => { if (online) load(); }, [load, online]);

  const act = async (p, status) => {
    if (status === 'deleted' && arm !== p.id) { setArm(p.id); return; }
    const d = draft[p.id] || {};
    try {
      await rpc('moderate_post', { p_id: p.id, p_status: status, p_title: d.title ?? null, p_body: d.body ?? null, p_author: d.author ?? null });
      say({ published: 'Đã đăng “' + (d.title || p.title) + '”.', rejected: 'Đã từ chối.', pending: 'Đã gỡ xuống, chuyển về chờ duyệt.', deleted: 'Đã xoá hẳn.' }[status]);
      setOpen(null); setArm(null); await load(); reloadPublic();
      if (st !== 'pending') rpc('gm_posts', { p_status: 'pending' }).then((r) => setQueue((r || []).length)).catch(() => {});
    } catch (e) { say(e.message, 'bad'); }
  };
  const edit = (id, k) => (e) => setDraft((x) => ({ ...x, [id]: { ...x[id], [k]: e.target.value } }));
  const keys = [
    { k: 'ESC', label: 'Danh sách', run: () => nav('truyen') },
    ...STATUS.map(([k, v, l]) => ({ k, label: l, run: () => { setSt(v); setOpen(null); } })),
  ];

  return (
    <Term title="DUYỆT BÀI" who="GM" keys={keys} onCommand={null} msg={online ? '' : 'ĐANG OFFLINE, CHƯA TẢI ĐƯỢC HÀNG CHỜ'}>
      <h1 className="term-h">DUYỆT BÀI · {STATUS.find((x) => x[1] === st)[2].toUpperCase()}</h1>
      {rows === null ? <p>ĐANG TẢI<span className="dots" /></p> : rows.length === 0 ? <p>KHÔNG CÓ BÀI NÀO.</p> : (
        <div className="queue">
          {rows.map((p, i) => {
            const d = draft[p.id] || {};
            const isOpen = open === p.id;
            return (
              <div key={p.id} className={'q-item' + (isOpen ? ' open' : '')}>
                <button type="button" className="q-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.id)}>
                  <b>{pad(i + 1)}. {d.title ?? p.title}</b>
                  <small>{d.author ?? p.author_name} · nộp {day(p.created_at)}{p.contact ? ' · liên hệ: ' + p.contact : ''} · {words(p.body)} chữ</small>
                </button>
                {isOpen && (
                  <div className="q-body bbs-form">
                    <label><span>TÊN TRUYỆN ...:</span><input value={d.title ?? p.title} onChange={edit(p.id, 'title')} /></label>
                    <label><span>BÚT DANH .....:</span><input value={d.author ?? p.author_name} onChange={edit(p.id, 'author')} /></label>
                    <label className="full"><span>NỘI DUNG (sửa được trước khi đăng):</span><textarea rows={14} value={d.body ?? p.body} onChange={edit(p.id, 'body')} /></label>
                    <div className="bbs-actions">
                      <span>
                        {p.status !== 'published' && <button type="button" className="bbs-btn" onClick={() => act(p, 'published')}>[ DUYỆT, ĐĂNG LÊN ]</button>}
                        {p.status === 'published' && <button type="button" className="bbs-btn" onClick={() => act(p, 'published')}>[ LƯU CHỖ SỬA ]</button>}
                        {p.status === 'published' && <button type="button" className="bbs-btn" onClick={() => act(p, 'pending')}>[ GỠ XUỐNG ]</button>}
                        {p.status === 'pending' && <button type="button" className="bbs-btn" onClick={() => act(p, 'rejected')}>[ TỪ CHỐI ]</button>}
                        {p.status === 'rejected' && <button type="button" className="bbs-btn" onClick={() => act(p, 'pending')}>[ ĐƯA LẠI HÀNG CHỜ ]</button>}
                      </span>
                      <button type="button" className="bbs-btn warn" onClick={() => act(p, 'deleted')} onBlur={() => setArm(null)}>{arm === p.id ? '[ BẤM LẦN NỮA ĐỂ XOÁ HẲN ]' : '[ XOÁ HẲN ]'}</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Term>
  );
}

export default function Blog({ online, role, say, path, nav, setQueue }) {
  const { posts, err, load } = usePosts(online);
  const gm = role === 'gm';
  const [k] = path;
  if (k === 'gui') return <Submit online={online} gm={gm} say={say} nav={nav} />;
  if (k === 'duyet') {
    return gm ? <Queue online={online} say={say} setQueue={setQueue} reloadPublic={load} nav={nav} />
      : <Term title="DUYỆT BÀI" who="KHÁCH" onCommand={null} keys={[{ k: 'ESC', label: 'Danh sách', run: () => nav('truyen') }]}><p>*** TRUY CẬP BỊ TỪ CHỐI. CHỈ GM VÀO ĐƯỢC.</p></Term>;
  }
  if (k) {
    const post = (posts || []).find((p) => p.id === k);
    if (post) return <Read post={post} posts={posts} gm={gm} nav={nav} />;
    return (
      <Term title="TRUYỆN MA" who={gm ? 'GM' : 'KHÁCH'} onCommand={null} keys={[{ k: 'ESC', label: 'Danh sách', run: () => nav('truyen') }]}>
        <p>{posts === null ? <>ĐANG TẢI<span className="dots" /></> : '*** KHÔNG TÌM THẤY BÀI NÀY. CÓ THỂ BÀI ĐÃ BỊ GỠ, HOẶC CHƯA ĐƯỢC TẢI VỀ MÁY.'}</p>
      </Term>
    );
  }
  return <List posts={posts} err={err} gm={gm} nav={nav} />;
}
