import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { loadPack, syncPack } from './lib/pack.js';
import { buildIndex } from './lib/search.js';
import { ping, onAuth, currentUser, config, table, rpc } from './lib/api.js';
import { pushDrafts } from './lib/characters.js';
import Search from './views/Search.jsx';
import Characters from './views/Characters.jsx';
import Settings from './views/Settings.jsx';
import Blog from './views/Blog.jsx';
import People from './views/People.jsx';
import { applyTheme } from './lib/theme.js';
import { isNative } from './lib/native.js';

// [mã, tên, tên ngắn trên điện thoại, biểu tượng]
const TABS = [
  ['truyen', 'Truyện ma', 'Truyện', '鬼'],
  ['tra-cuu', 'Sổ phép', 'Sổ phép', '符'],
  ['nhan-vat', 'Nhân vật', 'Nhân vật', '人'],
  ['phieu', 'Phiếu của tôi', 'Phiếu', '冊'],
  ['cai-dat', 'Cài đặt', 'Cài đặt', '⚙'],
];
// Đường dẫn dạng #truyen/gui, #nhan-vat/pc/<mã> ...
const route = () => {
  const [h, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
  return TABS.some(([k]) => k === h) ? { tab: h, path: rest.filter(Boolean) } : { tab: 'truyen', path: [] };
};
applyTheme();

export default function App() {
  const [{ tab, path }, setRoute] = useState(route);
  const [queue, setQueue] = useState(0);
  const [pack, setPack] = useState(null);
  const [online, setOnline] = useState(false);
  const [user, setUser] = useState(currentUser);
  const [role, setRole] = useState(null);
  const [toast, setToast] = useState(null);
  const [update, setUpdate] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const toastTimer = useRef();

  const say = useCallback((text, kind = 'ok') => {
    setToast({ text, kind });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const index = useMemo(() => (pack ? buildIndex(pack.entries) : []), [pack]);

  // Kiểm tra mạng, cập nhật gói, đẩy nháp
  const refresh = useCallback(async (quiet = true) => {
    const ok = await ping();
    setOnline(ok);
    if (!ok) { if (!quiet) say(config.ready ? 'Đang offline, chưa cập nhật được.' : 'Chưa cài đặt database.', 'warn'); return; }
    try {
      const cur = pack || (await loadPack());
      const r = await syncPack(cur);
      setPack(r.pack);
      if (!quiet) say(`Đã cập nhật: ${r.changed} mục mới hoặc đổi, ${r.deleted} mục bị xoá.`);
    } catch (e) { if (!quiet) say('Lỗi cập nhật: ' + e.message, 'bad'); }
    if (currentUser()) {
      const { pushed, conflicts: c } = await pushDrafts();
      if (pushed) say(`Đã đồng bộ ${pushed} phiếu sửa lúc offline.`);
      if (c.length) setConflicts(c);
    }
  }, [pack, say]);

  useEffect(() => { loadPack().then(setPack); }, []);
  useEffect(() => { if (pack) refresh(true); /* eslint-disable-next-line */ }, [!!pack]);

  useEffect(() => {
    const on = () => refresh(true);
    const off = () => setOnline(false);
    const hash = () => { setRoute(route()); window.scrollTo(0, 0); };
    addEventListener('online', on); addEventListener('offline', off); addEventListener('hashchange', hash);
    const unsub = onAuth(setUser);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); removeEventListener('hashchange', hash); unsub(); };
  }, [refresh]);

  // Vai trò (GM hay người chơi)
  useEffect(() => {
    if (!user || !online) { if (!user) setRole(null); return; }
    table.select('profiles', `select=role&id=eq.${user.id}`).then((r) => setRole(r[0]?.role || 'player')).catch(() => {});
  }, [user, online]);

  // Service worker: offline và báo khi có bản mới
  useEffect(() => {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:' || isNative) return;
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      const watch = (w) => w && w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) setUpdate(w);
      });
      if (reg.waiting && navigator.serviceWorker.controller) setUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => watch(reg.installing));
    }).catch(() => {});
    // Chỉ tải lại khi thay bản cũ bằng bản mới. Lần cài đầu tiên thì không, kẻo mất chữ đang gõ.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  }, []);

  // Số bài truyện chờ duyệt, để GM thấy ngay trên menu
  useEffect(() => {
    if (role !== 'gm' || !online) { setQueue(0); return; }
    rpc('gm_posts', { p_status: 'pending' }).then((r) => setQueue(r?.length || 0)).catch(() => {});
  }, [role, online, tab]);

  const nav = (h) => { if (location.hash !== '#' + h) location.hash = h; else setRoute(route()); };
  const ctx = { pack, setPack, index, online, user, role, say, refresh, conflicts, setConflicts, path, nav, setQueue };

  return (
    <>
      <header className="top">
        <div className="wrap top-in">
          <a className="logo" href="#truyen">BÁN LỘ TRỪ MA</a>
          <span className={'status ' + (online ? 'on' : 'off')} title={online ? 'Đang nối database' : 'Đang dùng dữ liệu trên máy'}>
            {online ? 'ONLINE' : 'OFFLINE'}
          </span>
          <nav className="tabs" aria-label="Mục chính">
            {TABS.map(([k, label, short, icon]) => (
              <a key={k} href={'#' + k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined}>
                <span className="tab-ic" aria-hidden="true">{icon}</span>
                <span className="tab-long">{label}</span><span className="tab-short">{short}</span>
                {k === 'truyen' && queue > 0 && <span className="badge" title={queue + ' bài chờ duyệt'}>{queue}</span>}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {update && (
        <div className="banner wrap">
          <span>&gt; Có bản app mới.</span>
          <button type="button" className="pri" onClick={() => update.postMessage('skip-waiting')}>Tải lại để cập nhật</button>
        </div>
      )}

      <main className="wrap">
        {!pack ? <p className="muted boot">&gt; đang nạp gói dữ liệu<span className="caret" /></p> : (
          <>
            {tab === 'truyen' && <Blog {...ctx} />}
            {tab === 'tra-cuu' && <Search {...ctx} />}
            {tab === 'nhan-vat' && <People {...ctx} />}
            {tab === 'phieu' && <Characters {...ctx} />}
            {tab === 'cai-dat' && <Settings {...ctx} />}
          </>
        )}
      </main>

      <footer className="wrap foot">Bán Lộ Trừ Ma · gói {pack ? pack.entries.length : '…'} mục · {isNative ? 'app Android' : 'bản web'} · {String(typeof __BUILD__ !== 'undefined' ? __BUILD__ : '').slice(0, 10)}</footer>

      {toast && <div className={'toast ' + toast.kind} role="status">{toast.text}</div>}
    </>
  );
}
