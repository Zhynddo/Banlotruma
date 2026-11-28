// Màn hình khởi động như máy đời cũ: đếm bộ nhớ, nạp trình điều khiển, rồi vào desktop.
// Bấm phím hay chạm màn hình là bỏ qua. Mỗi phiên trình duyệt chỉ chạy một lần.
import { useEffect, useRef, useState } from 'react';
import { reduced, hex } from './ui.js';

export const bootedThisSession = () => { try { return sessionStorage.getItem('bltm.booted') === '1'; } catch { return false; } };
const mark = () => { try { sessionStorage.setItem('bltm.booted', '1'); } catch { /* không lưu được thì thôi */ } };

export default function Boot({ count, online, onDone }) {
  const lines = useRef([
    'BÁN LỘ BIOS v2.04   (C) 1987-2026 Hội Bán Lộ',
    'CPU: ÂM-DƯƠNG 486DX  33 MHz',
    '@MEM',
    'Ổ đĩa A: ......................... KHÔNG CÓ ĐĨA',
    'Ổ đĩa C: ......................... ĐÃ GẮN',
    '',
    'Nạp HỆ ĐIỀU HÀNH BÁN LỘ v6.22...',
    'DEVICE=C:\\BANLO\\AMDUONG.SYS ........ OK',
    'DEVICE=C:\\BANLO\\TRAN.SYS ........... OK',
    'DEVICE=C:\\BANLO\\KHE.SYS ............ OK',
    `Kiểm tra vía ...................... 7/7`,
    `Kho dữ liệu ....................... ${count ?? '...'} MỤC`,
    `Máy chủ ........................... ${online ? 'ONLINE' : 'ĐANG DÒ...'}`,
    `Mã phiên .......................... ${hex(4)}-${hex(4)}`,
    '',
    'C:\\> WIN',
  ]).current;
  const [n, setN] = useState(0);
  const [mem, setMem] = useState(0);
  const finished = useRef(false);

  const finish = () => { if (finished.current) return; finished.current = true; mark(); onDone(); };

  useEffect(() => {
    if (reduced()) { finish(); return undefined; }
    const skip = () => finish();
    addEventListener('keydown', skip); addEventListener('pointerdown', skip);
    return () => { removeEventListener('keydown', skip); removeEventListener('pointerdown', skip); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (finished.current) return undefined;
    if (lines[n] === '@MEM' && mem < 640) { const t = setTimeout(() => setMem((m) => Math.min(640, m + 64)), 30); return () => clearTimeout(t); }
    if (n >= lines.length) { const t = setTimeout(finish, 450); return () => clearTimeout(t); }
    const t = setTimeout(() => setN((x) => x + 1), lines[n] === '' ? 120 : 70 + Math.random() * 90);
    return () => clearTimeout(t);
  }, [n, mem]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="boot-screen" role="status" aria-label="Đang khởi động">
      <pre>
        {lines.slice(0, n + 1).map((l, i) => (l === '@MEM' ? `Kiểm tra bộ nhớ: ${String(mem).padStart(3, ' ')}K ${mem >= 640 ? 'OK' : ''}` : l)).join('\n')}
        <span className="cursor" />
      </pre>
      <p className="boot-skip">bấm phím bất kỳ để bỏ qua</p>
    </div>
  );
}
