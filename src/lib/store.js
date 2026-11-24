// Kho trên máy: IndexedDB (dữ liệu lớn: gói nội dung, phiếu, nháp).
// Trình duyệt chặn IndexedDB thì tự lùi về localStorage.
const DB = 'bltm', STORE = 'kv';
let dbp = null;

const open = () => {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    if (!('indexedDB' in globalThis)) return rej(new Error('no idb'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }).catch((e) => { dbp = null; throw e; });
  return dbp;
};

const tx = async (mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
};

const ls = {
  get: (k) => { try { const v = localStorage.getItem('bltm.' + k); return v == null ? undefined : JSON.parse(v); } catch { return undefined; } },
  set: (k, v) => { try { localStorage.setItem('bltm.' + k, JSON.stringify(v)); } catch { /* đầy hoặc bị chặn */ } },
  del: (k) => { try { localStorage.removeItem('bltm.' + k); } catch { /* bỏ qua */ } },
};

export const kv = {
  async get(k) { try { return await tx('readonly', (s) => s.get(k)); } catch { return ls.get(k); } },
  async set(k, v) { try { await tx('readwrite', (s) => s.put(v, k)); } catch { ls.set(k, v); } },
  async del(k) { try { await tx('readwrite', (s) => s.delete(k)); } catch { ls.del(k); } },
  async keys(prefix = '') {
    try { const all = await tx('readonly', (s) => s.getAllKeys()); return all.filter((k) => String(k).startsWith(prefix)); }
    catch { return []; }
  },
};

// Cài đặt nhỏ, đọc đồng bộ được
export const prefs = ls;
