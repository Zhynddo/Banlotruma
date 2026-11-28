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
import Writer from './views/Writer.jsx';
import Finder from './views/Finder.jsx';
import Desktop from './shell/Desktop.jsx';
import { applyTheme } from './lib/theme.js';
import { isNative } from './lib/native.js';

applyTheme();

export default function App() {
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
    addEventListener('online', on); addEventListener('offline', off);
    const unsub = onAuth(setUser);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); unsub(); };
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
  }, [role, online]);

  // Mở ứng dụng hoặc trang khác: đổi địa chỉ, desktop tự mở cửa sổ tương ứng
  const nav = useCallback((h) => {
    if (location.hash === '#' + h) dispatchEvent(new HashChangeEvent('hashchange'));
    else location.hash = h;
  }, []);
  const ctx = { pack, setPack, index, online, user, role, say, refresh, conflicts, setConflicts, nav, setQueue };

  const render = (k, path) => {
    if (!pack) return <p className="muted">ĐANG NẠP GÓI DỮ LIỆU<span className="cursor" /></p>;
    const c = { ...ctx, path };
    if (k === 'truyen') return <Blog {...c} />;
    if (k === 'tim') return <Finder {...c} />;
    if (k === 'viet') return <Writer {...c} />;
    if (k === 'tra-cuu') return <Search {...c} />;
    if (k === 'nhan-vat') return <People {...c} />;
    if (k === 'phieu') return <Characters {...c} />;
    if (k === 'cai-dat') return <Settings {...c} />;
    return null;
  };

  return (
    <>
      <Desktop ctx={ctx} render={render} queue={queue} />
      {update && (
        <div className="banner" role="status">
          <span>*** CÓ BẢN APP MỚI.</span>
          <button type="button" className="pri" onClick={() => update.postMessage('skip-waiting')}>Tải lại để cập nhật</button>
        </div>
      )}
      {toast && <div className={'toast ' + toast.kind} role="status">{toast.text}</div>}
    </>
  );
}
