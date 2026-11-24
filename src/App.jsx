import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { loadPack, syncPack } from './lib/pack.js';
import { buildIndex } from './lib/search.js';
import { ping, onAuth, currentUser, config, table } from './lib/api.js';
import { pushDrafts } from './lib/characters.js';
import Search from './views/Search.jsx';
import Characters from './views/Characters.jsx';
import Settings from './views/Settings.jsx';

const TABS = [
  ['tra-cuu', 'Tra cứu'],
  ['phieu', 'Phiếu nhân vật'],
  ['cai-dat', 'Cài đặt'],
];
const tabFromHash = () => {
  const h = location.hash.replace('#', '');
  return TABS.some(([k]) => k === h) ? h : 'tra-cuu';
};

export default function App() {
  const [tab, setTab] = useState(tabFromHash);
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
    const hash = () => setTab(tabFromHash());
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
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      const watch = (w) => w && w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) setUpdate(w);
      });
      if (reg.waiting && navigator.serviceWorker.controller) setUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => watch(reg.installing));
    }).catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
  }, []);

  const go = (k) => { location.hash = k; setTab(k); };
  const ctx = { pack, setPack, index, online, user, role, say, refresh, conflicts, setConflicts };

  return (
    <>
      <header className="top">
        <div className="wrap top-in">
          <a className="logo" href="#tra-cuu" onClick={() => go('tra-cuu')}>&gt; BÁN LỘ TRỪ MA</a>
          <span className={'status ' + (online ? 'on' : 'off')} title={online ? 'Đang nối database' : 'Đang dùng dữ liệu trên máy'}>
            {online ? 'ONLINE' : 'OFFLINE'}
          </span>
          <nav className="tabs" aria-label="Mục chính">
            {TABS.map(([k, label]) => (
              <a key={k} href={'#' + k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined}
                 onClick={(e) => { e.preventDefault(); go(k); }}>{label}</a>
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
            {tab === 'tra-cuu' && <Search {...ctx} />}
            {tab === 'phieu' && <Characters {...ctx} />}
            {tab === 'cai-dat' && <Settings {...ctx} />}
          </>
        )}
      </main>

      <footer className="wrap foot">Bán Lộ Trừ Ma · gói {pack ? pack.entries.length : '…'} mục · bản build {String(typeof __BUILD__ !== 'undefined' ? __BUILD__ : '').slice(0, 10)}</footer>

      {toast && <div className={'toast ' + toast.kind} role="status">{toast.text}</div>}
    </>
  );
}
