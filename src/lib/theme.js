// Theme giao diện. Tên phải khớp với [data-theme="..."] trong styles.css.
import { prefs } from './store.js';

export const THEMES = [
  { k: 'bao-cao', name: 'Giấy báo cáo', note: 'giấy in sọc xanh đời cũ', bar: '#e7efdf', sw: ['#f3f6ec', '#dcebd5', '#1f4a32'] },
  { k: 'crt', name: 'Màn hình xanh', note: 'màn hình phốt-pho, chữ phát sáng', bar: '#020b05', sw: ['#020b05', '#14532b', '#5dff8f'] },
  { k: 'giay', name: 'Sổ giấy ngà', note: 'giấy ngà, mực nâu', bar: '#eadcc0', sw: ['#f1e7d0', '#dccaa8', '#3b2a1a'] },
  { k: 'dem', name: 'Đêm mực', note: 'nền tối, điểm son đỏ', bar: '#121110', sw: ['#121110', '#45413b', '#d94f3d'] },
];

export const getTheme = () => document.documentElement.dataset.theme || 'bao-cao';

export function setTheme(k) {
  const t = THEMES.find((x) => x.k === k) || THEMES[0];
  document.documentElement.dataset.theme = t.k;
  prefs.set('theme', t.k);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bar);
}

// Gọi một lần lúc mở app để thanh trạng thái điện thoại đúng màu
export const applyTheme = () => setTheme(prefs.get('theme') || 'bao-cao');
