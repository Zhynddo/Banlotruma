// Cửa sổ kiểu Turbo Vision: khung kẻ đôi ╔═╗, nút [■] đóng bên trái, [↑] phóng to bên phải,
// kéo thanh tiêu đề để dời, kéo góc ◢ để đổi cỡ. Mở ra thì chạy vài dòng lệnh rồi mới hiện nội dung.
import { useEffect, useRef, useState } from 'react';
import MenuBar from './Menu.jsx';
import { reduced } from './ui.js';

function BootLines({ app, keep, done, onDone }) {
  const all = [
    `C:\\BANLO> ${app.exe}`,
    ...app.boot.map((b) => `${b} ${'.'.repeat(Math.max(3, 22 - b.length))} OK`),
    `${app.exe} sẵn sàng.`,
  ];
  const [n, setN] = useState(reduced() ? all.length : 0);
  useEffect(() => {
    if (n >= all.length) { const t = setTimeout(onDone, reduced() ? 0 : 120); return () => clearTimeout(t); }
    const t = setTimeout(() => setN((x) => x + 1), 55 + Math.random() * 60);
    return () => clearTimeout(t);
  }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  if (done && !keep) return null;
  return (
    <pre className="win-boot" aria-hidden={done ? 'true' : undefined}>
      {all.slice(0, n).join('\n')}{!done && <span className="cursor" />}
    </pre>
  );
}

export default function Window({ app, win, active, narrow, menus, onFocus, onClose, onMax, onMove, children }) {
  const [booted, setBooted] = useState(false);
  const drag = useRef(null);
  const max = win.max || narrow;

  const start = (mode) => (e) => {
    if (max || e.button !== 0) return;
    e.preventDefault();
    drag.current = { mode, sx: e.clientX, sy: e.clientY, x: win.x, y: win.y, w: win.w, h: win.h };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (d.mode === 'move') {
      onMove({ x: Math.min(Math.max(d.x + dx, -d.w + 120), innerWidth - 80), y: Math.min(Math.max(d.y + dy, 0), innerHeight - 90) });
    } else {
      onMove({ w: Math.max(340, d.w + dx), h: Math.max(240, d.h + dy) });
    }
  };
  const end = () => { drag.current = null; };

  const style = max ? undefined : { left: win.x, top: win.y, width: win.w, height: win.h };
  return (
    <section className={'win' + (active ? ' active' : '') + (max ? ' max' : '') + (app.term ? ' termapp' : '')}
             style={{ ...style, zIndex: win.z }} onPointerDown={onFocus} aria-label={app.title} role="region">
      <div className="win-title" onPointerDown={start('move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
           onDoubleClick={() => !narrow && onMax()}>
        <button type="button" className="win-btn" aria-label={'Đóng ' + app.name} onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>[■]</button>
        <h2 className="win-name">{app.title}</h2>
        {!narrow && <button type="button" className="win-btn" aria-label={win.max ? 'Thu cửa sổ lại' : 'Phóng to cửa sổ'} onPointerDown={(e) => e.stopPropagation()} onClick={onMax}>[{win.max ? '↓' : '↑'}]</button>}
      </div>
      {menus && <MenuBar menus={menus} className="win-menu" label={'Menu ' + app.name} />}
      <div className="win-body">
        <BootLines app={app} keep={app.term} done={booted} onDone={() => setBooted(true)} />
        {booted && children}
      </div>
      {!max && <span className="win-grip" aria-hidden="true" onPointerDown={start('size')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>◢</span>}
    </section>
  );
}
