// Blog truyện ma, trình bày như một BBS đời cũ: màn hình xanh, dòng lệnh có dấu nháy.
// Khách nộp bài không cần tài khoản, GM duyệt rồi mới đăng.
// #truyen          danh sách bài đã đăng
// #truyen/<mã>     đọc một bài
// #truyen/duyet    GM duyệt bài
import { useCallback, useEffect, useRef, useState } from 'react';
import { rpc } from '../lib/api.js';
import { usePosts } from '../lib/posts.js';
const PER = 12;
const pad = (n, w = 2) => String(n).padStart(w, '0');
const day = (iso) => { if (!iso) return '--/--/----'; const t = new Date(iso); return `${pad(t.getDate())}/${pad(t.getMonth() + 1)}/${t.getFullYear()}`; };
const paras = (t) => String(t || '').split(/\n\s*\n|\r\n\s*\r\n/).map((x) => x.trim()).filter(Boolean);
export const words = (t) => String(t || '').split(/\s+/).filter(Boolean).length;
const typing = (el) => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !el.classList.contains('cmd-input')) || el.tagName === 'SELECT');

// Khung màn hình: thanh tiêu đề, nội dung, dòng lệnh có dấu nháy, thanh phím tắt
function Term({ title, who, keys, onCommand, msg, children }) {
  const [cmd, setCmd] = useState('');
  const [note, setNote] = useState('');
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  useEffect(() => setNote(msg || ''), [msg]);
  useEffect(() => {
    const down = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Chỉ nhận phím khi cửa sổ này đang ở trên cùng và không có menu nào đang mở
      const win = boxRef.current?.closest('.win');
      if ((win && !win.classList.contains('active')) || document.querySelector('.mb-drop')) return;
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
    <div className="term" ref={boxRef} onClick={(e) => { if (e.target === e.currentTarget) inputRef.current?.focus(); }}>
      <p className="term-sub">NGƯỜI DÙNG: {who} · NODE 01 · 9600 BAUD · {title}</p>
      <div className="term-body">
        {children}
        {note && <p className="term-note" role="status">*** {note}</p>}
        {onCommand !== null && (
          <form className="term-prompt" onSubmit={submit} onClick={() => inputRef.current?.focus()}>
            <label htmlFor="bbs-cmd">C:\TRUYEN&gt;</label>
            <span className="typed" aria-hidden="true">{cmd}</span><span className="cursor" aria-hidden="true" />
            <input id="bbs-cmd" ref={inputRef} className="cmd-input" value={cmd} onChange={(e) => setCmd(e.target.value)}
                   onKeyDown={(e) => {
                     // Dòng lệnh còn trống: bấm một phím tắt là chạy ngay, như BBS thật
                     if (cmd || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
                     const k = keys.find((x) => x.k.length === 1 && /\D/.test(x.k) && x.k.toLowerCase() === e.key.toLowerCase());
                     if (k) { e.preventDefault(); k.run(); }
                   }}
                   autoComplete="off" autoCapitalize="characters" spellCheck="false" enterKeyHint="go" autoFocus={!('ontouchstart' in window)} />
          </form>
        )}
      </div>
      <div className="term-keys">
        {keys.map((k) => <button key={k.k} type="button" onClick={k.run}><kbd>{k.k}</kbd> {k.label}</button>)}
      </div>
    </div>
  );
}

function List({ posts, err, gm, nav }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil((posts || []).length / PER));
  const rows = (posts || []).slice(page * PER, page * PER + PER);
  const keys = [
    { k: 'G', label: 'Gửi tệp', run: () => nav('viet') },
    { k: 'F', label: 'Tìm hồ sơ', run: () => nav('tim') },
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
      <p className="term-dim">CONNECT 9600 · CHÀO MỪNG TỚI BÁN LỘ BBS.</p>
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
    { k: 'G', label: 'Gửi tệp', run: () => nav('viet') },
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
