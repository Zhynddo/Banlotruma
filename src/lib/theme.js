// Theme giao diện. Tên phải khớp với [data-theme="..."] trong styles.css.
import { prefs } from './store.js';

export const THEMES = [
  { k: 'crt', name: 'Phốt-pho xanh', note: 'màn hình xanh đời cũ, chữ phát sáng', bar: '#031a0a', sw: ['#020b05', '#1d6b3a', '#3dff7f'] },
  { k: 'term', name: 'Đen trắng', note: 'terminal hiện đại', bar: '#161616', sw: ['#0c0c0c', '#4a4a4a', '#e8e8e8'] },
];
const KEYS = THEMES.map((t) => t.k);

export const getTheme = () => document.documentElement.dataset.theme || 'crt';

export function setTheme(k) {
  const t = THEMES.find((x) => x.k === k) || THEMES[0];
  document.documentElement.dataset.theme = t.k;
  prefs.set('theme', t.k);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bar);
  dispatchEvent(new Event('bltm-ui'));
}

// Theme cũ (giấy báo cáo, giấy ngà, đêm mực) đã bỏ: đổi về xanh
export const applyTheme = () => setTheme(KEYS.includes(prefs.get('theme')) ? prefs.get('theme') : 'crt');

// Kiểu tài liệu: "paper" = giấy thật (lá bùa vàng, giấy trắng), "text" = chữ terminal
export const DOCS = [
  { k: 'paper', name: 'Giấy thật' },
  { k: 'text', name: 'Chữ terminal' },
];
export const getDocs = () => (prefs.get('docs') === 'text' ? 'text' : 'paper');
export function setDocs(k) { prefs.set('docs', k === 'text' ? 'text' : 'paper'); dispatchEvent(new Event('bltm-ui')); }
