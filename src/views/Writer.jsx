// Gửi tệp: soạn truyện như viết code trong terminal (kiểu nano/vi), rồi gửi cho GM duyệt.
// Ctrl+S gửi tệp. Bản đang viết được lưu trên máy liên tục.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { rpc, config } from '../lib/api.js';
import { prefs } from '../lib/store.js';
import { sleep, reduced } from '../shell/ui.js';

const words = (t) => String(t || '').split(/\s+/).filter(Boolean).length;
const fileName = (t) => (t.trim() ? t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase().slice(0, 24) : 'TRUYEN_MOI') + '.TXT';

export default function Writer({ online, say, nav }) {
  const saved = prefs.get('post-draft') || {};
  const [f, setF] = useState({ title: saved.title || '', author: saved.author || '', body: saved.body || '', contact: saved.contact || '' });
  const [trap, setTrap] = useState('');
  const [log, setLog] = useState([]);       // dòng in ra khi gửi
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [pos, setPos] = useState({ line: 1, col: 1 });
  const ta = useRef(null);
  const mirror = useRef(null);
  const box = useRef(null);
  const ready = online && config.ready;

  useEffect(() => { if (!sent) prefs.set('post-draft', f); }, [f, sent]); // ghi ngay, tắt trang cũng không mất
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  // Ô soạn thảo cao theo nội dung, số dòng khớp với dòng thật (kể cả dòng tự xuống)
  useLayoutEffect(() => {
    if (ta.current && mirror.current) ta.current.style.height = mirror.current.offsetHeight + 'px';
  });

  const caret = () => {
    const el = ta.current; if (!el) return;
    const before = el.value.slice(0, el.selectionStart).split('\n');
    setPos({ line: before.length, col: before[before.length - 1].length + 1 });
  };

  const print = (line) => setLog((l) => [...l, line]);
  const send = async () => {
    if (busy) return;
    setLog([]);
    const name = fileName(f.title);
    if (!f.title.trim()) { print('LỖI: THIẾU DÒNG # TÊN TRUYỆN'); return; }
    if (f.body.trim().length < 20) { print('LỖI: NỘI DUNG QUÁ NGẮN'); return; }
    if (!ready) { print('LỖI: ĐANG OFFLINE. TỆP VẪN ĐƯỢC LƯU TRÊN MÁY, CÓ MẠNG THÌ GỬI LẠI.'); return; }
    setBusy(true);
    const fast = reduced();
    print(`C:\\TRUYEN> GUI ${name}`);
    if (!fast) { await sleep(160); print(`Đóng gói ${name} ... ${new Blob([f.body]).size} BYTE`); await sleep(220); }
    try {
      await rpc('submit_post', { p_title: f.title, p_body: f.body, p_author: f.author, p_contact: f.contact, p_trap: trap });
      if (!fast) { for (const p of [25, 60, 100]) { print(`Truyền ... [${'█'.repeat(p / 10)}${'░'.repeat(10 - p / 10)}] ${p}%`); await sleep(140); } }
      print('ĐÃ GỬI. TỆP ĐANG CHỜ DUYỆT.');
      prefs.del('post-draft'); setSent(true); say('Đã gửi tệp.');
    } catch (e) {
      print('LỖI: ' + (e.offline ? 'MẤT KẾT NỐI. TỆP VẪN ĐƯỢC LƯU TRÊN MÁY.' : e.message.toUpperCase()));
    }
    setBusy(false);
  };
  const fresh = () => { setF((x) => ({ title: '', author: x.author, body: '', contact: x.contact })); setSent(false); setLog([]); };

  // Phím tắt kiểu nano: Ctrl+S gửi, Ctrl+X thoát
  useEffect(() => {
    const down = (e) => {
      const win = box.current?.closest('.win');
      if (win && !win.classList.contains('active')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (!sent) send(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') { e.preventDefault(); nav('truyen'); }
    };
    addEventListener('keydown', down);
    return () => removeEventListener('keydown', down);
  });

  const lines = f.body.split('\n');
  return (
    <div className="editor-term" ref={box}>
      <div className="ed-bar">
        <span>SOẠN THẢO 1.0</span><span>TỆP: {fileName(f.title)}</span>
        <span>{sent ? 'ĐÃ GỬI' : f.body || f.title ? 'ĐÃ LƯU NHÁP' : 'TỆP MỚI'}</span>
      </div>

      {sent ? (
        <div className="ed-out">
          <pre>{log.join('\n')}</pre>
          <p>Tệp sẽ được đăng sau khi duyệt.</p>
          <p className="term-keys-inline">
            <button type="button" onClick={fresh}><kbd>N</kbd> Soạn tệp mới</button>
            <button type="button" onClick={() => nav('truyen')}><kbd>^X</kbd> Về Truyện ma</button>
          </p>
        </div>
      ) : (
        <>
          <div className="ed-head">
            <label><span className="ln">1</span><span className="cm"># TÊN TRUYỆN :</span><input value={f.title} maxLength={200} onChange={set('title')} spellCheck="false" /></label>
            <label><span className="ln">2</span><span className="cm"># BÚT DANH   :</span><input value={f.author} maxLength={80} onChange={set('author')} placeholder="để trống: Người giấu tên" autoComplete="nickname" /></label>
            <label><span className="ln">3</span><span className="cm"># LIÊN HỆ    :</span><input value={f.contact} maxLength={200} onChange={set('contact')} placeholder="không bắt buộc, chỉ người duyệt thấy" /></label>
            <p className="ed-sep"><span className="ln">4</span><span className="cm"># ---- nội dung bên dưới, xuống dòng hai lần để sang đoạn mới ----</span></p>
            <label className="trap" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
          </div>
          <div className="ed-code">
            <div className="ed-mirror" ref={mirror} aria-hidden="true">
              {lines.map((l, i) => <div key={i} data-n={i + 5}>{l || '\u200b'}</div>)}
            </div>
            <textarea ref={ta} aria-label="Nội dung truyện" value={f.body} onChange={(e) => { set('body')(e); caret(); }} onKeyUp={caret} onClick={caret}
                      maxLength={60000} spellCheck="false" />
          </div>
          {log.length > 0 && <pre className="ed-log" role="status">{log.join('\n')}</pre>}
        </>
      )}

      <div className="ed-status">
        {!sent && <button type="button" onClick={send} disabled={busy}><kbd>^S</kbd> {busy ? 'Đang gửi...' : 'Gửi tệp'}</button>}
        <button type="button" onClick={() => nav('truyen')}><kbd>^X</kbd> Thoát</button>
        <span className="ed-pos">Dòng {pos.line + 4} · Cột {pos.col} · {words(f.body)} chữ{ready ? '' : ' · OFFLINE'}</span>
      </div>
    </div>
  );
}
