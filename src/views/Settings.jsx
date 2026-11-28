import { useEffect, useMemo, useState } from 'react';
import { config, media } from '../lib/api.js';
import { resetPack } from '../lib/pack.js';
import { THEMES, setTheme, getTheme, DOCS, setDocs, getDocs } from '../lib/theme.js';
import { isNative, APK_URL } from '../lib/native.js';

const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
const MEDIA = 'media-v1'; // trùng tên với public/sw.js
const hasCache = typeof caches !== 'undefined';

// Hình vẽ để xem offline: đếm, tải hết về máy, hoặc xoá cho nhẹ máy
function OfflineArt({ pack, online, say }) {
  const urls = useMemo(() => [...new Set(pack.entries.flatMap((e) => (Array.isArray(e.data?.hinh) ? e.data.hinh : []).flatMap((h) => [h.path, h.thumb])).filter(Boolean))].map(media.url), [pack]);
  const [have, setHave] = useState(null);
  const [mb, setMb] = useState(null);
  const [job, setJob] = useState('');
  const count = async () => {
    if (!hasCache) return;
    const c = await caches.open(MEDIA);
    let n = 0;
    for (const u of urls) if (await c.match(u, { ignoreVary: true })) n++;
    setHave(n);
    try { const est = await navigator.storage?.estimate(); if (est) setMb(Math.round((est.usage || 0) / 1048576)); } catch { /* không đo được */ }
  };
  useEffect(() => { count(); }, [urls]); // eslint-disable-line react-hooks/exhaustive-deps
  const fetchAll = async () => {
    const c = await caches.open(MEDIA);
    let done = 0, fail = 0;
    try { await navigator.storage?.persist?.(); } catch { /* trình duyệt không cho thì thôi */ }
    for (const u of urls) {
      setJob(`Đang tải ${done + 1}/${urls.length}...`);
      if (!(await c.match(u, { ignoreVary: true }))) {
        try { const r = await fetch(u, { mode: 'cors' }); if (r.ok) await c.put(u, r); else fail++; } catch { fail++; }
      }
      done++;
    }
    setJob(''); await count();
    say(fail ? `Tải xong, còn ${fail} file lỗi. Thử lại sau nha.` : 'Đã lưu hết hình về máy.', fail ? 'warn' : 'ok');
  };
  const clear = async () => { await caches.delete(MEDIA); await count(); say('Đã xoá hình lưu trên máy.'); };
  if (!hasCache) return null;
  return (
    <div className="panel">
      <h2>Hình vẽ offline</h2>
      <p>{urls.length ? `${have ?? '…'}/${urls.length} file hình đã có trên máy` : 'Kho chưa có hình nào.'}{mb !== null ? ` · app đang dùng khoảng ${mb} MB` : ''}</p>
      {urls.length > 0 && (
        <div className="row">
          <button type="button" className="pri" disabled={!!job || !online || have === urls.length} onClick={fetchAll}>{job || 'Tải hết hình về máy'}</button>
          <button type="button" disabled={!!job || !have} onClick={clear}>Xoá hình trên máy</button>
        </div>
      )}
      <p className="muted small">Hình nào đã xem lúc có mạng thì tự được giữ lại. Bấm tải hết trước buổi chơi nếu chỗ chơi không có mạng.</p>
    </div>
  );
}

export default function Settings({ pack, setPack, online, refresh, say }) {
  const [url, setUrl] = useState(config.url);
  const [key, setKey] = useState(config.key);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [theme, setThemeState] = useState(getTheme);
  const [docs, setDocsState] = useState(getDocs);

  const connect = async (e) => {
    e.preventDefault();
    config.save(url, key);
    setBusy(true); await refresh(false); setBusy(false);
  };
  const reset = async () => {
    if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 4000); return; }
    setPack(await resetPack()); setConfirm(false); say('Đã nạp lại gói đi kèm app.');
  };
  const at = pack.at.startsWith('1970') ? 'gói đi kèm app, chưa cập nhật lần nào' : new Date(pack.at).toLocaleString('vi-VN');

  return (
    <section>
      <h1>Cài đặt</h1>

      <div className="panel">
        <h2>Gói dữ liệu trên máy</h2>
        <p>{pack.entries.length} mục · {at}</p>
        <div className="row">
          <button type="button" className="pri" disabled={busy} onClick={async () => { setBusy(true); await refresh(false); setBusy(false); }}>
            {busy ? 'Đang cập nhật...' : 'Cập nhật ngay'}
          </button>
          <button type="button" className={confirm ? 'danger' : ''} onClick={reset}>{confirm ? 'Bấm lần nữa để nạp lại' : 'Nạp lại gói gốc'}</button>
        </div>
        <p className="muted small">App tự cập nhật mỗi lần mở mà có mạng. Phiếu nhân vật không bị ảnh hưởng.</p>
      </div>

      <OfflineArt pack={pack} online={online} say={say} />

      <div className="panel">
        <h2>Giao diện</h2>
        <div className="themes" role="group" aria-label="Chọn theme">
          {THEMES.map((t) => (
            <button key={t.k} type="button" className="theme-btn" aria-pressed={theme === t.k} onClick={() => { setTheme(t.k); setThemeState(t.k); }}>
              <span className="theme-sw" aria-hidden="true">{t.sw.map((c) => <i key={c} style={{ background: c }} />)}</span>
              <b>{t.name}</b><small>{t.note}</small>
            </button>
          ))}
        </div>
        <h3>Kiểu tài liệu</h3>
        <div className="chips" role="group" aria-label="Kiểu tài liệu">
          {DOCS.map((d) => <button key={d.k} type="button" aria-pressed={docs === d.k} onClick={() => { setDocs(d.k); setDocsState(d.k); }}>{d.name}</button>)}
        </div>
        <p className="muted small">Giấy thật: lá bùa vàng, lá sớ, sơ yếu lý lịch giấy trắng. Chữ terminal: mọi thứ là chữ trên màn hình. Mỗi máy nhớ lựa chọn riêng.</p>
      </div>

      <div className="panel">
        <h2>{isNative ? 'App Android' : 'Cài app'}</h2>
        {isNative ? (
          <p>Đang dùng app Android. Có bản mới thì tải file APK mới về cài đè lên, dữ liệu vẫn giữ nguyên.{APK_URL && <> <a href={APK_URL}>Tải bản mới nhất</a>.</>}</p>
        ) : (
          <>
            {APK_URL && <p><a className="btn pri" href={APK_URL}>Tải app Android (APK)</a></p>}
            <p className="muted small">Lần đầu cài, Android sẽ hỏi cho phép cài app từ nguồn ngoài: bấm cho phép. Cài bản mới thì cài đè lên bản cũ.</p>
            {ios && <p>Trên iPhone chưa có app riêng: mở trang này bằng <b>Safari</b>, bấm <b>Chia sẻ</b>, chọn <b>Thêm vào MH chính</b>. Mở từ biểu tượng đó thì mất mạng vẫn dùng được.</p>}
          </>
        )}
      </div>

      <div className="panel">
        <h2>Database</h2>
        <p>Trạng thái: <b className={online ? 'ok' : 'warn'}>{online ? 'đang nối' : config.ready ? 'không vào được (đang offline?)' : 'chưa cài đặt'}</b></p>
        {config.baked ? (
          <p className="muted small">App đã được cài sẵn địa chỉ database lúc build.</p>
        ) : (
          <form onSubmit={connect}>
            <p className="muted small">Lấy trong Supabase: Project Settings → API. Khoá anon để công khai được, vì phân quyền đã khoá ở database.</p>
            <div className="form">
              <label className="wide">Project URL<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoComplete="off" /></label>
              <label className="wide">Anon key<input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJ..." autoComplete="off" /></label>
            </div>
            <div className="row"><button className="pri" type="submit" disabled={busy}>Lưu và kết nối</button></div>
          </form>
        )}
      </div>
    </section>
  );
}
