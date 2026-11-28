// Blog truyện ma. Khách gửi bài không cần tài khoản, GM duyệt rồi mới hiện.
// #truyen          danh sách bài đã đăng
// #truyen/<mã>     đọc một bài
// #truyen/gui      gửi truyện
// #truyen/duyet    GM duyệt bài
import { useCallback, useEffect, useState } from 'react';
import { table, rpc, config } from '../lib/api.js';
import { kv, prefs } from '../lib/store.js';

const CACHE = 'posts';
const COLS = 'select=id,title,author_name,body,published_at&status=eq.published&order=published_at.desc&limit=200';
const day = (iso) => (iso ? new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const paras = (t) => String(t || '').split(/\n\s*\n|\r\n\s*\r\n/).map((x) => x.trim()).filter(Boolean);
const cut = (t, n = 240) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, s.lastIndexOf(' ', n)) + '…' : s; };
const minutes = (t) => Math.max(1, Math.round(String(t || '').split(/\s+/).length / 220));

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

function Read({ post }) {
  return (
    <article className="story">
      <p><a href="#truyen">← Tất cả truyện</a></p>
      <header>
        <p className="kicker">Truyện ma</p>
        <h1>{post.title}</h1>
        <p className="byline">Người kể: <b>{post.author_name}</b> · {day(post.published_at)} · {minutes(post.body)} phút đọc</p>
      </header>
      <div className="story-body">{paras(post.body).map((p, i) => <p key={i}>{p}</p>)}</div>
      <p className="story-end" aria-hidden="true">— hết —</p>
    </article>
  );
}

function Submit({ online, say, nav }) {
  const saved = prefs.get('post-draft') || {};
  const [f, setF] = useState({ title: saved.title || '', author: saved.author || '', body: saved.body || '', contact: saved.contact || '' });
  const [trap, setTrap] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) prefs.set('post-draft', f); }, [f, done]); // ghi ngay, tắt trang cũng không mất
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const send = async (e) => {
    e.preventDefault(); setErr('');
    if (f.body.trim().length < 20) { setErr('Nội dung quá ngắn.'); return; }
    setBusy(true);
    try {
      await rpc('submit_post', { p_title: f.title, p_body: f.body, p_author: f.author, p_contact: f.contact, p_trap: trap });
      prefs.del('post-draft'); setDone(true); say('Đã nộp bài.');
    } catch (e2) { setErr(e2.offline ? 'Mất kết nối. Bài vẫn được lưu trên máy, có mạng thì nộp lại.' : e2.message); }
    setBusy(false);
  };

  if (done) {
    return (
      <section className="panel">
        <h1>Đã nhận bài</h1>
        <p>Bài sẽ được đăng sau khi duyệt.</p>
        <div className="row"><a className="btn pri" href="#truyen">Về trang truyện</a><button type="button" onClick={() => { setF({ title: '', author: f.author, body: '', contact: f.contact }); setDone(false); }}>Nộp bài khác</button></div>
      </section>
    );
  }
  return (
    <section>
      <p><a href="#truyen">← Tất cả truyện</a></p>
      <h1>Nộp bài</h1>
      <p className="muted">Không cần tài khoản. Bài được duyệt rồi mới đăng. Bản đang viết được lưu trên máy.</p>
      {(!config.ready || !online) && <p className="msg warn">Đang offline. Bài vẫn được lưu trên máy, có mạng thì nộp.</p>}
      <form className="form story-form" onSubmit={send}>
        <label className="wide">Tên truyện<input required maxLength={200} value={f.title} onChange={set('title')} /></label>
        <label>Bút danh (để trống: Người giấu tên)<input maxLength={80} value={f.author} onChange={set('author')} autoComplete="nickname" /></label>
        <label>Liên hệ (không bắt buộc, chỉ người duyệt thấy)<input maxLength={200} value={f.contact} onChange={set('contact')} placeholder="email, Zalo, Facebook" /></label>
        <label className="wide">Nội dung<textarea required rows={16} maxLength={60000} value={f.body} onChange={set('body')} placeholder="Xuống dòng hai lần để sang đoạn mới." /></label>
        <label className="trap" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
        <div className="wide row between">
          <span className="muted small">{f.body.trim().split(/\s+/).filter(Boolean).length} chữ</span>
          <button type="submit" className="pri" disabled={busy || !online || !config.ready}>{busy ? 'Đang nộp...' : 'Nộp bài'}</button>
        </div>
        {err && <p className="msg bad wide" role="alert">{err}</p>}
      </form>
    </section>
  );
}

const STATUS = [['pending', 'Chờ duyệt'], ['published', 'Đã đăng'], ['rejected', 'Đã từ chối']];

function Queue({ online, say, setQueue, reloadPublic }) {
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

  return (
    <section>
      <p><a href="#truyen">← Tất cả truyện</a></p>
      <h1>Duyệt truyện</h1>
      {!online && <p className="msg warn">Đang offline, chưa tải được hàng chờ.</p>}
      <div className="chips" role="group" aria-label="Lọc theo trạng thái">
        {STATUS.map(([k, l]) => <button key={k} type="button" aria-pressed={st === k} onClick={() => { setSt(k); setOpen(null); }}>{l}</button>)}
      </div>
      {rows === null ? <p className="muted">Đang tải...</p> : rows.length === 0 ? <p className="muted">Không có bài nào.</p> : (
        <div className="queue">
          {rows.map((p) => {
            const d = draft[p.id] || {};
            const isOpen = open === p.id;
            return (
              <div key={p.id} className={'q-item' + (isOpen ? ' open' : '')}>
                <button type="button" className="q-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.id)}>
                  <b>{d.title ?? p.title}</b>
                  <small>{d.author ?? p.author_name} · gửi {day(p.created_at)}{p.contact ? ' · liên hệ: ' + p.contact : ''} · {String(p.body).split(/\s+/).length} chữ</small>
                </button>
                {isOpen && (
                  <div className="q-body">
                    <div className="form">
                      <label className="wide">Tên truyện<input value={d.title ?? p.title} onChange={edit(p.id, 'title')} /></label>
                      <label>Bút danh<input value={d.author ?? p.author_name} onChange={edit(p.id, 'author')} /></label>
                      <label className="wide">Nội dung (sửa được trước khi đăng)<textarea rows={14} value={d.body ?? p.body} onChange={edit(p.id, 'body')} /></label>
                    </div>
                    <div className="row between">
                      <div className="row">
                        {p.status !== 'published' && <button type="button" className="pri" onClick={() => act(p, 'published')}>Duyệt, đăng lên</button>}
                        {p.status === 'published' && <button type="button" className="pri" onClick={() => act(p, 'published')}>Lưu chỗ sửa</button>}
                        {p.status === 'published' && <button type="button" onClick={() => act(p, 'pending')}>Gỡ xuống</button>}
                        {p.status === 'pending' && <button type="button" onClick={() => act(p, 'rejected')}>Từ chối</button>}
                        {p.status === 'rejected' && <button type="button" onClick={() => act(p, 'pending')}>Đưa lại hàng chờ</button>}
                      </div>
                      <button type="button" className={arm === p.id ? 'danger' : ''} onClick={() => act(p, 'deleted')} onBlur={() => setArm(null)}>{arm === p.id ? 'Bấm lần nữa để xoá hẳn' : 'Xoá hẳn'}</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function Blog({ online, role, say, path, nav, setQueue }) {
  const { posts, err, load } = usePosts(online);
  const [k] = path;
  if (k === 'gui') return <Submit online={online} say={say} nav={nav} />;
  if (k === 'duyet') return role === 'gm' ? <Queue online={online} say={say} setQueue={setQueue} reloadPublic={load} /> : <p className="muted">Chỉ GM mới vào được hàng duyệt bài.</p>;
  if (k) {
    const post = (posts || []).find((p) => p.id === k);
    if (post) return <Read post={post} />;
    return <section><p><a href="#truyen">← Tất cả truyện</a></p><p className="muted">{posts === null ? 'Đang tải truyện...' : 'Không tìm thấy bài này. Có thể bài đã bị gỡ, hoặc chưa được tải về máy.'}</p></section>;
  }

  const [lead, ...rest] = posts || [];
  return (
    <section className="blog">
      <header className="masthead">
        <p className="kicker">Bán Lộ Trừ Ma</p>
        <h1>Truyện ma</h1>
        <p className="muted">Chuyện người ta kể lại. Thật giả không bàn.</p>
        <div className="row">
          <a className="btn pri" href="#truyen/gui">Nộp bài</a>
          {role === 'gm' && <a className="btn" href="#truyen/duyet">Duyệt bài</a>}
        </div>
      </header>
      {err && <p className="msg warn">Chưa tải được bài mới.</p>}
      {posts === null && <p className="muted">Đang tải...</p>}
      {posts && posts.length === 0 && <p className="muted">Chưa có bài nào.</p>}
      {lead && (
        <a className="lead-story" href={'#truyen/' + lead.id}>
          <span className="kicker">Mới nhất</span>
          <b>{lead.title}</b>
          <span className="byline">{lead.author_name} · {day(lead.published_at)}</span>
          <span className="excerpt">{cut(lead.body, 420)}</span>
          <span className="more">Đọc tiếp</span>
        </a>
      )}
      <div className="stories">
        {rest.map((p) => (
          <a key={p.id} className="story-card" href={'#truyen/' + p.id}>
            <b>{p.title}</b>
            <span className="byline">{p.author_name} · {day(p.published_at)}</span>
            <span className="excerpt">{cut(p.body)}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
