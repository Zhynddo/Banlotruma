// Gói nội dung offline: lần đầu lấy gói đi kèm app (data/core.json),
// có mạng thì gọi changes_since để tải phần mới và xoá phần đã bỏ.
import { kv } from './store.js';
import { rpc } from './api.js';

const EPOCH = '1970-01-01T00:00:00Z';

export async function loadPack() {
  const saved = await kv.get('pack');
  if (saved?.entries?.length) return saved;
  const res = await fetch('./data/core.json');
  const entries = await res.json();
  const pack = { at: EPOCH, source: 'bundled', entries };
  await kv.set('pack', pack);
  return pack;
}

export async function syncPack(pack) {
  const data = await rpc('changes_since', { since: pack.at });
  const map = new Map(pack.entries.map((e) => [e.id, e]));
  for (const e of data.changed || []) map.set(e.id, e);
  for (const id of data.deleted || []) map.delete(id);
  const next = { at: data.now, source: 'synced', entries: [...map.values()] };
  await kv.set('pack', next);
  return { pack: next, changed: (data.changed || []).length, deleted: (data.deleted || []).length };
}

export async function resetPack() {
  await kv.del('pack');
  return loadPack();
}
