// Desktop: thanh menu trên cùng (sổ xuống), biểu tượng ứng dụng, các cửa sổ, thanh trạng thái dưới đáy.
// Địa chỉ #ứng-dụng/đường-dẫn luôn chỉ cửa sổ đang ở trên cùng, nên nút Back và link vẫn chạy.
import { useCallback, useEffect, useRef, useState } from 'react';
import { APPS, appOf, route } from './apps.js';
import MenuBar from './Menu.jsx';
import Window from './Window.jsx';
import Boot, { bootedThisSession } from './Boot.jsx';
import { useNarrow, useUi, pad } from './ui.js';
import { THEMES, DOCS, setTheme, setDocs } from '../lib/theme.js';

function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 15000); return () => clearInterval(i); }, []);
  return <span className="clock">{pad(t.getHours())}:{pad(t.getMinutes())}</span>;
}

export default function Desktop({ ctx, render, queue }) {
  const narrow = useNarrow();
  const ui = useUi();
  const [boot, setBoot] = useState(() => !bootedThisSession());
  const [wins, setWins] = useState([]);
  const z = useRef(10);
  const winsRef = useRef(wins);
  winsRef.current = wins;

  const setHash = (k, path = []) => {
    const h = k ? '#' + [k, ...path].join('/') : location.pathname + location.search;
    if (location.hash !== (k ? h : '')) history.replaceState(null, '', h);
  };

  // Mở (hoặc đưa lên trên) cửa sổ của một ứng dụng
  const open = useCallback((k, path = []) => {
    setWins((ws) => {
      const w = ws.find((x) => x.k === k);
      z.current += 1;
      if (w) return ws.map((x) => (x.k === k ? { ...x, path, z: z.current } : x));
      // Xếp lớp so le trong vùng màn hình (trừ thanh menu và thanh trạng thái)
      const n = ws.length % 6;
      const scr = document.querySelector('.screen')?.getBoundingClientRect() || { width: innerWidth, height: innerHeight - 64 };
      const W = Math.max(360, Math.min(1000, scr.width - 170 - 5 * 32));
      const H = Math.max(300, Math.min(760, scr.height - 40 - 5 * 26));
      return [...ws, { k, path, z: z.current, max: false, x: Math.max(8, Math.min(140 + n * 32, scr.width - W - 12)), y: 22 + n * 26, w: W, h: H }];
    });
  }, []);

  useEffect(() => {
    const sync = () => { const r = route(); if (r.tab) open(r.tab, r.path); };
    sync();
    addEventListener('hashchange', sync);
    addEventListener('popstate', sync);
    return () => { removeEventListener('hashchange', sync); removeEventListener('popstate', sync); };
  }, [open]);

  const focus = (k) => {
    const w = winsRef.current.find((x) => x.k === k);
    if (!w) return;
    const top = Math.max(...winsRef.current.map((x) => x.z));
    if (w.z !== top) { z.current += 1; setWins((ws) => ws.map((x) => (x.k === k ? { ...x, z: z.current } : x))); }
    setHash(k, w.path);
  };
  const close = (k) => {
    const rest = winsRef.current.filter((x) => x.k !== k);
    setWins(rest);
    const top = rest.sort((a, b) => b.z - a.z)[0];
    setHash(top?.k, top?.path);
  };
  const patch = (k, p) => setWins((ws) => ws.map((x) => (x.k === k ? { ...x, ...p } : x)));
  const go = (h) => { location.hash = h; };

  const gm = ctx.role === 'gm';
  const top = wins.reduce((a, b) => (!a || b.z > a.z ? b : a), null);

  const viewItems = [
    ...THEMES.map((t) => ({ label: 'Màn hình: ' + t.name, checked: ui.theme === t.k, run: () => setTheme(t.k) })),
    { sep: true },
    ...DOCS.map((d) => ({ label: 'Tài liệu: ' + d.name, checked: ui.docs === d.k, run: () => setDocs(d.k) })),
  ];
  const sysMenus = [
    { label: '≡ BÁN LỘ', short: '≡', items: [
      { label: 'Cài đặt', run: () => go('cai-dat') },
      { label: 'Đồng bộ dữ liệu ngay', run: () => ctx.refresh(false) },
      { label: 'Khởi động lại máy', run: () => setBoot(true) },
      { sep: true },
      { label: 'Đóng hết cửa sổ', run: () => { setWins([]); setHash(null); }, disabled: !wins.length },
    ] },
    { label: 'Truyện', badge: gm && queue ? queue : 0, items: [
      { label: 'Đọc truyện', run: () => go('truyen') },
      { label: 'Tìm hồ sơ', run: () => go('tim') },
      { label: 'Gửi tệp', run: () => go('viet') },
      gm && { label: 'Duyệt bài', badge: queue || 0, run: () => go('truyen/duyet') },
    ] },
    { label: 'Sổ phép', short: 'Phép', items: [
      { label: 'Mở sổ phép', run: () => go('tra-cuu') },
      gm && { label: 'Thêm mục vào sổ', run: () => go('tra-cuu/them'), disabled: !ctx.online },
      gm && { label: 'Nhập phép từ Excel', run: () => go('tra-cuu/nhap') },
    ] },
    { label: 'Nhân vật', short: 'Hồ sơ', items: [
      { label: 'Tủ hồ sơ', run: () => go('nhan-vat') },
      { label: 'Phiếu của tôi', run: () => go('phieu') },
      gm && { label: 'Lập hồ sơ mới', run: () => go('nhan-vat/them'), disabled: !ctx.online },
    ] },
    { label: 'Xem', items: viewItems },
  ];

  const winMenus = (a, w) => [
    { label: 'Tệp', items: [
      a.k === 'truyen' && { label: 'Gửi tệp mới', run: () => go('viet') },
      a.k === 'truyen' && { label: 'Tìm hồ sơ', run: () => go('tim') },
      a.k === 'truyen' && gm && { label: 'Duyệt bài', badge: queue || 0, run: () => go('truyen/duyet') },
      a.k === 'tra-cuu' && gm && { label: 'Thêm mục', run: () => go('tra-cuu/them'), disabled: !ctx.online },
      a.k === 'tra-cuu' && gm && { label: 'Nhập phép từ Excel', run: () => go('tra-cuu/nhap') },
      a.k === 'nhan-vat' && gm && { label: 'Lập hồ sơ mới', run: () => go('nhan-vat/them'), disabled: !ctx.online },
      { label: 'Đóng cửa sổ', run: () => close(a.k) },
    ] },
    { label: 'Xem', items: [
      ...(w.path.length ? [{ label: 'Về trang đầu', run: () => go(a.k) }, { sep: true }] : []),
      ...(!narrow ? [{ label: w.max ? 'Thu cửa sổ lại' : 'Phóng to cửa sổ', run: () => patch(a.k, { max: !w.max }) }, { sep: true }] : []),
      ...viewItems,
    ] },
  ];

  return (
    <div className={'desktop' + (top ? ' has-win' : '')}>
      {boot && <Boot count={ctx.pack?.entries.length} online={ctx.online} onDone={() => setBoot(false)} />}
      <MenuBar menus={sysMenus} className="sysbar" label="Menu hệ thống"
               right={<><span className={'status ' + (ctx.online ? 'on' : 'off')}>{ctx.online ? 'ONLINE' : 'OFFLINE'}</span><Clock /></>} />

      <div className="screen">
        <div className="wallpaper" aria-hidden="true">
          <p className="wp-big">BÁN LỘ TRỪ MA</p>
          <p>HỆ ĐIỀU HÀNH ÂM DƯƠNG · v6.22</p>
          <p>{ctx.pack ? ctx.pack.entries.length : '...'} mục trong kho · {ctx.online ? 'đã nối máy chủ' : 'đang chạy trên máy'}</p>
        </div>
        <nav className="icons" aria-label="Ứng dụng">
          {APPS.map((a) => (
            <a key={a.k} href={'#' + a.k} className={'icon' + (wins.some((w) => w.k === a.k) ? ' running' : '')}>
              <span className="icon-box" aria-hidden="true">{a.glyph}</span>
              <span className="icon-name">{a.name}{a.k === 'truyen' && gm && queue ? <span className="badge">{queue}</span> : null}</span>
            </a>
          ))}
        </nav>

        {wins.map((w) => {
          const a = appOf(w.k);
          return (
            <Window key={w.k} app={a} win={w} active={top?.k === w.k} narrow={narrow} menus={winMenus(a, w)}
                    onFocus={() => focus(w.k)} onClose={() => close(w.k)} onMax={() => patch(w.k, { max: !w.max })}
                    onMove={(p) => patch(w.k, p)}>
              {render(a.k, w.path)}
            </Window>
          );
        })}
      </div>

      <footer className="statusline">
        {wins.length === 0 ? <span className="sl-hint">Chọn một ứng dụng để mở</span> : [...wins].sort((a, b) => APPS.findIndex((x) => x.k === a.k) - APPS.findIndex((x) => x.k === b.k)).map((w, i) => (
          <button key={w.k} type="button" className={top?.k === w.k ? 'on' : ''} onClick={() => focus(w.k)}>
            <kbd>{i + 1}</kbd> {appOf(w.k).name}
          </button>
        ))}
        <span className="sl-right">{ctx.pack ? ctx.pack.entries.length : '…'} mục</span>
      </footer>
    </div>
  );
}
