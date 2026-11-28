// Bài truyện đã đăng: tải từ database, giữ một bản trên máy để đọc offline
import { useCallback, useEffect, useState } from 'react';
import { table, config } from './api.js';
import { kv } from './store.js';

const CACHE = 'posts';
const COLS = 'select=id,title,author_name,body,published_at&status=eq.published&order=published_at.desc&limit=500';

export function usePosts(online) {
  const [posts, setPosts] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const cached = await kv.get(CACHE);
    if (cached) setPosts((p) => p || cached);
    if (!online || !config.ready) { setPosts((p) => p || cached || []); return; }
    try { const r = await table.select('posts', COLS); setPosts(r); setErr(''); await kv.set(CACHE, r); }
    catch (e) { setErr(e.message); setPosts((p) => p || cached || []); }
  }, [online]);
  useEffect(() => { load(); }, [load]);
  return { posts, err, load };
}

