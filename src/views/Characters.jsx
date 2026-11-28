import { useCallback, useEffect, useState } from 'react';
import { auth, config } from '../lib/api.js';
import { local, cloud, drafts, isLocal, prepare } from '../lib/characters.js';
import Sheet from './Sheet.jsx';

function AuthBox({ online, say }) {
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  if (!config.ready) {
    return <div className="panel"><p className="muted">Chưa nối database nên chỉ dùng được phiếu trên máy. Vào thẻ <a href="#cai-dat">Cài đặt</a> để nối.</p></div>;
  }
  const submit = async (e) => {
    e.preventDefault();
    if (!online) { setMsg({ kind: 'warn', text: 'Đang offline. Đăng nhập cần có mạng.' }); return; }
    setBusy(true); setMsg(null);
    try {
      if (mode === 'in') { await auth.signIn(email, pass); say('Đã đăng nhập.'); }
      else {
        const r = await auth.signUp(email, pass, name);
        setMsg(r.signedIn ? { kind: 'ok', text: 'Đã tạo tài khoản và đăng nhập.' } : { kind: 'ok', text: 'Đã tạo tài khoản. Mở email để xác nhận, rồi đăng nhập.' });
      }
    } catch (err) {
      const t = /invalid login/i.test(err.message) ? 'Sai email hoặc mật khẩu.' : /already registered/i.test(err.message) ? 'Email này đã có tài khoản.' : err.message;
      setMsg({ kind: 'bad', text: t });
    } finally { setBusy(false); }
  };
  return (
    <form className="panel" onSubmit={submit}>
      <div className="row between">
        <h2>{mode === 'in' ? 'Đăng nhập' : 'Tạo tài khoản'}</h2>
        <button type="button" className="ghost" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); }}>
          {mode === 'in' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
        </button>
      </div>
      <p className="muted small">Đăng nhập để lưu phiếu lên mạng, dùng được trên nhiều máy, GM xem được.</p>
      <div className="form">
        {mode === 'up' && <label>Tên hiển thị<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" /></label>}
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label>Mật khẩu (từ 6 ký tự)<input type="password" required minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></label>
      </div>
      <div className="row"><button className="pri" type="submit" disabled={busy}>{busy ? 'Đang gửi...' : mode === 'in' ? 'Đăng nhập' : 'Tạo tài khoản'}</button></div>
      {msg && <p className={'msg ' + msg.kind}>{msg.text}</p>}
    </form>
  );
}

export default function Characters(props) {
  const { online, user, role, say, conflicts, setConflicts } = props;
  const [cloudList, setCloudList] = useState([]);
  const [localList, setLocalList] = useState([]);
  const [names, setNames] = useState({});
  const [pending, setPending] = useState(new Set());
  const [open, setOpen] = useState(null);

  const reload = useCallback(async () => {
    setLocalList(await local.list());
    const ds = await drafts.all();
    setPending(new Set(ds.filter(Boolean).map((d) => d.id)));
    if (!user) { setCloudList([]); return; }
    let rows;
    try { rows = online ? await cloud.list() : await cloud.cached(); }
    catch { rows = await cloud.cached(); }
    // Bản nháp trên máy mới hơn thì hiện bản nháp
    const dmap = new Map(ds.filter(Boolean).map((d) => [d.id, d]));
    setCloudList(rows.map((r) => dmap.get(r.id) || r));
    if (role === 'gm' && online) {
      const ps = await cloud.profiles();
      setNames(Object.fromEntries(ps.map((p) => [p.id, p.display_name || 'không tên'])));
    }
  }, [user, online, role]);

  useEffect(() => { reload(); }, [reload]);

  const create = async () => {
    try {
      const c = user && online ? await cloud.create() : await local.create();
      await reload(); setOpen(prepare(c));
    } catch (e) { say('Không tạo được phiếu: ' + e.message, 'bad'); }
  };

  const upload = async (c) => {
    try {
      const created = await cloud.create(c.name);
      const saved = await cloud.save({ ...created, name: c.name, data: c.data });
      await local.remove(c.id); await reload(); setOpen(prepare(saved));
      say('Đã đưa phiếu lên mạng.');
    } catch (e) { say('Chưa đưa lên được: ' + e.message, 'bad'); }
  };

  const resolve = async (d, keepMine) => {
    try {
      const remote = await cloud.fetchOne(d.id);
      if (!remote) { await drafts.del(d.id); }
      else if (keepMine) { await cloud.save({ ...d, rev: remote.rev }); say('Đã giữ bản trên máy này.'); }
      else { await drafts.del(d.id); say('Đã lấy bản trên mạng.'); }
    } catch (e) { say('Chưa xử lý được: ' + e.message, 'bad'); return; }
    setConflicts(conflicts.filter((x) => x.id !== d.id));
    reload();
  };

  if (open) {
    return <Sheet {...props} char={open} onClose={() => { setOpen(null); reload(); }} onUpload={user && online && isLocal(open) ? upload : null} />;
  }

  return (
    <section>
      <h1>Phiếu nhân vật</h1>

      {conflicts.length > 0 && (
        <div className="panel warnbox">
          <h2>Phiếu bị sửa ở hai nơi</h2>
          {conflicts.map((d) => (
            <div key={d.id} className="row between conflict">
              <span>“{d.name}”: sửa lúc offline, trong lúc đó bản trên mạng cũng đã đổi.</span>
              <span className="row">
                <button type="button" className="pri" onClick={() => resolve(d, true)}>Giữ bản trên máy này</button>
                <button type="button" onClick={() => resolve(d, false)}>Lấy bản trên mạng</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {!user ? <AuthBox online={online} say={say} /> : (
        <div className="row between who">
          <span className="muted">&gt; {user.email}{role === 'gm' ? ' · GM, thấy mọi phiếu' : ''}</span>
          <button type="button" onClick={() => auth.signOut()}>Đăng xuất</button>
        </div>
      )}

      <div className="row between">
        <h2>{user ? 'Phiếu của ' + (role === 'gm' ? 'cả bàn' : 'em') : 'Phiếu trên máy này'}</h2>
        <button type="button" className="pri" onClick={create}>+ Phiếu mới</button>
      </div>
      {user && !online && <p className="msg warn">Đang offline: sửa vẫn được, có mạng sẽ tự đồng bộ.</p>}

      <div className="cards">
        {(user ? cloudList : []).map((c) => (
          <button key={c.id} type="button" className="card" onClick={() => setOpen(prepare(c))}>
            <b>{c.name}</b>
            <small>{[c.data?.truong, c.data?.cap ? 'cấp ' + c.data.cap : '', role === 'gm' && names[c.owner_id] ? 'của ' + names[c.owner_id] : ''].filter(Boolean).join(' · ') || 'chưa điền'}</small>
            {pending.has(c.id) && <small className="draft">chờ đồng bộ</small>}
          </button>
        ))}
        {localList.map((c) => (
          <button key={c.id} type="button" className="card local" onClick={() => setOpen(prepare(c))}>
            <b>{c.name}</b>
            <small>{[c.data?.truong, c.data?.cap ? 'cấp ' + c.data.cap : ''].filter(Boolean).join(' · ') || 'chưa điền'}</small>
            <small className="muted">lưu trên máy này</small>
          </button>
        ))}
        {!cloudList.length && !localList.length && <p className="muted">&gt; chưa có phiếu nào. bấm “+ Phiếu mới”.</p>}
      </div>
    </section>
  );
}
