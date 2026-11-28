// Trạng thái giao diện dùng chung: theme, kiểu tài liệu, có giảm chuyển động không
import { useEffect, useState } from 'react';
import { getTheme, getDocs } from '../lib/theme.js';

export const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const narrow = () => typeof matchMedia !== 'undefined' && matchMedia('(max-width: 760px)').matches;

export function useUi() {
  const [ui, setUi] = useState(() => ({ theme: getTheme(), docs: getDocs() }));
  useEffect(() => {
    const f = () => setUi({ theme: getTheme(), docs: getDocs() });
    addEventListener('bltm-ui', f);
    return () => removeEventListener('bltm-ui', f);
  }, []);
  return ui;
}

export function useNarrow() {
  const [n, setN] = useState(narrow);
  useEffect(() => {
    const m = matchMedia('(max-width: 760px)');
    const f = () => setN(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return n;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const pad = (n, w = 2) => String(n).padStart(w, '0');
export const hex = (n = 4) => Array.from({ length: n }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
