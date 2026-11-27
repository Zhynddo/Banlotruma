// Service worker: lưu sẵn app để mất mạng vẫn mở được.
// Mã phiên bản và danh sách file do scripts/build.mjs điền lúc build.
const VERSION = '__VERSION__';
const CACHE = 'bltm-' + VERSION;
const FILES = __FILES__;
const MEDIA = 'media-v1'; // không bị xoá khi app lên bản mới

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bltm-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  // Font Google: dùng bản đã lưu nếu có, có mạng thì lưu thêm
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(CACHE + '-fonts').then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        try { const res = await fetch(req); if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }
        catch { return new Response('', { status: 504 }); }
      })
    );
    return;
  }
  // Hình vẽ trong kho: mỗi file có tên riêng, không bao giờ đổi, nên lưu một lần dùng mãi
  if (url.pathname.includes('/storage/v1/object/public/media/')) {
    e.respondWith(
      caches.open(MEDIA).then(async (c) => {
        const hit = await c.match(req, { ignoreVary: true });
        if (hit) return hit;
        try { const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }
        catch { return new Response('', { status: 504 }); }
      })
    );
    return;
  }
  if (url.origin !== self.location.origin) return; // Supabase và nơi khác: không đụng tới
  // Mở trang: thử mạng trước, mất mạng thì dùng bản đã lưu
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html', { ignoreSearch: true }).then((r) => r || caches.match('./'))));
    return;
  }
  // File của app: dùng bản đã lưu, không có mới tải
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
