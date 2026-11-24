// Tìm kiếm trên máy (offline). Cách chấm điểm gần giống search_entries trong database:
// tên trùng khớp lên đầu, rồi tới khớp trong tên, tag, nội dung. Gõ dở chữ vẫn ra.
import { norm, tokens } from './norm.js';

export function buildIndex(entries) {
  return entries.map((e) => ({
    e,
    name: ' ' + norm(e.name),
    tags: ' ' + norm((e.tags || []).join(' ')),
    all: ' ' + norm([e.summary, e.body, JSON.stringify(e.data || {})].join(' ')),
  }));
}

export function searchLocal(index, q, type = 'all') {
  const pool = type === 'all' ? index : index.filter((x) => x.e.type === type);
  const toks = tokens(q);
  if (!toks.length) return pool.map((x) => x.e).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const nq = toks.join(' ');
  const out = [];
  for (const x of pool) {
    let s = 0, ok = true;
    for (const t of toks) {
      const w = ' ' + t;
      if (x.name.includes(w)) s += 20;
      else if (x.tags.includes(w)) s += 8;
      else if (x.all.includes(w)) s += 3;
      else { ok = false; break; }
    }
    if (!ok) continue;
    const n = x.name.trim();
    if (n === nq) s += 100; else if (n.startsWith(nq)) s += 50; else if (n.includes(nq)) s += 25;
    out.push([s, x.e]);
  }
  return out.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name, 'vi')).map((p) => p[1]);
}
