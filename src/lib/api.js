// Gọi thẳng API của Supabase (PostgREST + Auth), không cần thư viện.
import { prefs } from './store.js';

/* global __SUPABASE_URL__, __SUPABASE_ANON_KEY__ */
const BAKED_URL = typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '';
const BAKED_KEY = typeof __SUPABASE_ANON_KEY__ !== 'undefined' ? __SUPABASE_ANON_KEY__ : '';

const cleanUrl = (u) => (u || '').trim().replace(/\/+$/, '').replace(/\/(rest|auth)\/v1$/, '').replace(/\/+$/, '');

export const config = {
  get url() { return cleanUrl(prefs.get('url') || BAKED_URL); },
  get key() { return (prefs.get('key') || BAKED_KEY || '').replace(/\s+/g, ''); },
  get baked() { return !!(BAKED_URL && BAKED_KEY); },
  get ready() { return !!(this.url && this.key); },
  save(url, key) { prefs.set('url', url.trim()); prefs.set('key', key.trim()); },
  clear() { prefs.del('url'); prefs.del('key'); },
};

export class ApiError extends Error {
  constructor(message, { status = 0, code = '', offline = false } = {}) {
    super(message); this.status = status; this.code = code; this.offline = offline;
  }
}

// ---------- phiên đăng nhập ----------
let session = prefs.get('session') || null;
const listeners = new Set();
export const onAuth = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const setSession = (s) => {
  session = s && s.access_token
    ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: s.user }
    : null;
  if (session) prefs.set('session', session); else prefs.del('session');
  listeners.forEach((fn) => fn(session?.user || null));
};
export const currentUser = () => session?.user || null;

const raw = async (path, { method = 'GET', body, headers = {}, auth = true } = {}) => {
  if (!config.ready) throw new ApiError('Chưa cài đặt database', { offline: true });
  const h = { apikey: config.key, 'Content-Type': 'application/json', ...headers };
  // Chỉ gửi Authorization khi đã đăng nhập. Khoá anon/publishable chỉ cần nằm ở header apikey.
  if (auth && session) h.Authorization = 'Bearer ' + session.access_token;
  let res;
  try {
    res = await fetch(config.url + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError('Không kết nối được máy chủ', { offline: true });
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = data?.msg || data?.message || data?.error_description || data?.error || ('Lỗi ' + res.status);
    throw new ApiError(msg, { status: res.status, code: data?.code || data?.error_code || '' });
  }
  return data;
};

let refreshing = null;
const refresh = async () => {
  if (!session?.refresh_token) return false;
  refreshing ||= raw('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token }, auth: false })
    .then((s) => { setSession(s); return true; })
    .catch((e) => { if (!e.offline) setSession(null); return false; })
    .finally(() => { refreshing = null; });
  return refreshing;
};

// Gọi có đăng nhập: tự làm mới phiên khi sắp hết hạn, thử lại một lần khi bị 401
export const request = async (path, opts = {}) => {
  if (session && session.expires_at - 60 < Date.now() / 1000) await refresh();
  try { return await raw(path, opts); }
  catch (e) {
    if (e.status === 401 && session && await refresh()) return raw(path, opts);
    throw e;
  }
};

export const auth = {
  async signUp(email, password, displayName) {
    const r = await raw('/auth/v1/signup', { method: 'POST', auth: false, body: { email, password, data: { display_name: displayName || undefined } } });
    if (r?.access_token) { setSession(r); return { signedIn: true }; }
    return { signedIn: false }; // Supabase đang bật xác nhận email
  },
  async signIn(email, password) {
    setSession(await raw('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email, password } }));
  },
  async signOut() {
    try { await raw('/auth/v1/logout', { method: 'POST' }); } catch { /* vẫn đăng xuất trên máy */ }
    setSession(null);
  },
};

export const rpc = (fn, args) => request('/rest/v1/rpc/' + fn, { method: 'POST', body: args });

export const table = {
  select: (t, query) => request(`/rest/v1/${t}?${query}`),
  insert: (t, row) => request(`/rest/v1/${t}`, { method: 'POST', body: row, headers: { Prefer: 'return=representation' } }).then((r) => r[0]),
  update: (t, query, patch) => request(`/rest/v1/${t}?${query}`, { method: 'PATCH', body: patch, headers: { Prefer: 'return=representation' } }),
  remove: (t, query) => request(`/rest/v1/${t}?${query}`, { method: 'DELETE' }),
};

// Kho hình (Supabase Storage, bucket công khai 'media'; chỉ GM tải lên được)
export const media = {
  url: (path) => (path ? `${config.url}/storage/v1/object/public/media/${path}` : ''),
  async upload(path, blob) {
    if (!session) throw new ApiError('Cần đăng nhập để tải hình lên');
    if (session.expires_at - 60 < Date.now() / 1000) await refresh();
    let res;
    try {
      res = await fetch(`${config.url}/storage/v1/object/media/${path}`, {
        method: 'POST', body: blob,
        headers: { apikey: config.key, Authorization: 'Bearer ' + session.access_token, 'Content-Type': blob.type, 'x-upsert': 'false', 'cache-control': '31536000' },
      });
    } catch { throw new ApiError('Không kết nối được máy chủ', { offline: true }); }
    if (!res.ok) {
      let m = 'Lỗi ' + res.status;
      try { const d = await res.json(); m = d.message || d.error || m; } catch { /* giữ lỗi số */ }
      throw new ApiError(m, { status: res.status });
    }
  },
  // Xoá file, lỗi thì bỏ qua (file thừa không ảnh hưởng gì)
  remove: (paths) => (paths.length ? request('/storage/v1/object/media', { method: 'DELETE', body: { prefixes: paths } }).catch(() => null) : Promise.resolve()),
};

// Kiểm tra đường tới database còn sống không
export const ping = async () => {
  if (!config.ready || !navigator.onLine) return false;
  try { await raw('/rest/v1/entries?select=id&limit=1', { auth: false }); return true; }
  catch { return false; }
};
