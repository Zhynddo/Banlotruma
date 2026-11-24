// Phiếu nhân vật: trên mạng (Supabase) và trên máy (khi chưa đăng nhập hoặc mất mạng).
// Sửa khi mất mạng thì lưu nháp kèm rev lúc mở; có mạng thì đồng bộ bằng save_character.
import { kv } from './store.js';
import { table, rpc, ApiError } from './api.js';
import { normalizeSheet, blankSheet } from './sheet.js';

const LOCAL = 'local-chars';
const DRAFT = 'draft:';
const CACHE = 'cloud-chars';

export const isLocal = (c) => String(c.id).startsWith('local-');

// ---------- phiếu trên máy ----------
export const local = {
  async list() { return (await kv.get(LOCAL)) || []; },
  async create(name = 'Nhân vật mới') {
    const c = { id: 'local-' + Date.now().toString(36), name, data: { ...blankSheet(), ten: name }, rev: 1, updated_at: new Date().toISOString() };
    await kv.set(LOCAL, [c, ...(await this.list())]);
    return c;
  },
  async save(c) {
    const list = await this.list();
    const next = { ...c, rev: (c.rev || 0) + 1, updated_at: new Date().toISOString() };
    await kv.set(LOCAL, list.map((x) => (x.id === c.id ? next : x)));
    return next;
  },
  async remove(id) { await kv.set(LOCAL, (await this.list()).filter((x) => x.id !== id)); },
};

// ---------- phiếu trên mạng ----------
export const cloud = {
  async list() {
    const rows = await table.select('characters', 'select=id,name,owner_id,rev,data,updated_at&order=updated_at.desc');
    await kv.set(CACHE, rows);
    return rows;
  },
  async cached() { return (await kv.get(CACHE)) || []; },
  async create(name = 'Nhân vật mới') {
    return table.insert('characters', { name, data: { ...blankSheet(), ten: name } });
  },
  // Trả về rev mới. Ném ApiError code 40001 khi phiếu đã bị sửa ở nơi khác.
  async save(c) {
    const rev = await rpc('save_character', { char_id: c.id, new_name: c.name, new_data: c.data, expected_rev: c.rev });
    await kv.del(DRAFT + c.id);
    return { ...c, rev, updated_at: new Date().toISOString() };
  },
  async fetchOne(id) {
    const rows = await table.select('characters', `select=id,name,owner_id,rev,data,updated_at&id=eq.${encodeURIComponent(id)}`);
    return rows[0] || null;
  },
  async remove(id) { await table.remove('characters', `id=eq.${encodeURIComponent(id)}`); await kv.del(DRAFT + id); },
  async profiles() {
    try { return await table.select('profiles', 'select=id,display_name,role'); } catch { return []; }
  },
};

// ---------- nháp chờ đồng bộ ----------
export const drafts = {
  get: (id) => kv.get(DRAFT + id),
  set: (c) => kv.set(DRAFT + c.id, { ...c, draft_at: new Date().toISOString() }),
  del: (id) => kv.del(DRAFT + id),
  async all() { return Promise.all((await kv.keys(DRAFT)).map((k) => kv.get(k))); },
};

// Đẩy hết nháp lên. Trả về danh sách phiếu bị xung đột để người chơi chọn.
export async function pushDrafts() {
  const conflicts = [];
  let pushed = 0;
  for (const d of await drafts.all()) {
    if (!d) continue;
    try { await cloud.save(d); pushed++; }
    catch (e) {
      if (e instanceof ApiError && e.offline) break;
      if (e.code === '40001') conflicts.push(d);
      else if (e.code === 'P0002') await drafts.del(d.id);
    }
  }
  return { pushed, conflicts };
}

export const prepare = (c) => ({ ...c, data: normalizeSheet(c.data) });
