import { useState } from 'react';
import { config } from '../lib/api.js';
import { resetPack } from '../lib/pack.js';

const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

export default function Settings({ pack, setPack, online, refresh, say }) {
  const [url, setUrl] = useState(config.url);
  const [key, setKey] = useState(config.key);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

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

      <div className="panel">
        <h2>Cài lên màn hình điện thoại</h2>
        {ios ? (
          <p>Trên iPhone: mở trang này bằng <b>Safari</b>, bấm nút <b>Chia sẻ</b>, chọn <b>Thêm vào MH chính</b>. Mở từ biểu tượng đó thì mất mạng vẫn dùng được.</p>
        ) : (
          <p>Trên Android: bấm menu <b>⋮</b> của Chrome, chọn <b>Cài đặt ứng dụng</b> hoặc <b>Thêm vào màn hình chính</b>. Hoặc cài file APK do GM gửi.</p>
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
