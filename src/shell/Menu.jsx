// Thanh menu kiểu chương trình DOS: bấm vào tên là sổ xuống một khung danh sách.
// menus = [{ label, items: [{ label, run, checked, disabled, badge, sep }] }]
import { useEffect, useRef, useState } from 'react';

export default function MenuBar({ menus, className = '', right = null, label = 'Menu' }) {
  const [open, setOpen] = useState(-1);
  const ref = useRef(null);

  useEffect(() => {
    if (open < 0) return undefined;
    const out = (e) => { if (!ref.current?.contains(e.target)) setOpen(-1); };
    const key = (e) => {
      if (e.key === 'Escape') { setOpen(-1); ref.current?.querySelectorAll('.mb-top')[open]?.focus(); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setOpen((i) => (i + (e.key === 'ArrowRight' ? 1 : -1) + menus.length) % menus.length);
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = [...(ref.current?.querySelectorAll('.mb-drop button:not([disabled])') || [])];
        const i = items.indexOf(document.activeElement);
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }
    };
    addEventListener('pointerdown', out);
    addEventListener('keydown', key);
    return () => { removeEventListener('pointerdown', out); removeEventListener('keydown', key); };
  }, [open, menus.length]);

  useEffect(() => {
    if (open >= 0) ref.current?.querySelector('.mb-drop button:not([disabled])')?.focus({ preventScroll: true });
  }, [open]);

  const pick = (it) => { setOpen(-1); it.run?.(); };

  return (
    <div className={'menubar ' + className} ref={ref} role="menubar" aria-label={label}>
      {menus.map((m, i) => (
        <div key={m.label} className={'mb-item' + (open === i ? ' open' : '')}>
          <button type="button" className="mb-top" role="menuitem" aria-haspopup="true" aria-expanded={open === i}
                  onClick={() => setOpen(open === i ? -1 : i)} onPointerEnter={() => { if (open >= 0 && open !== i) setOpen(i); }}>
            {m.short ? <><span className="mb-long">{m.label}</span><span className="mb-short" aria-hidden="true">{m.short}</span></> : m.label}{m.badge ? <span className="badge">{m.badge}</span> : null}
          </button>
          {open === i && (
            <div className="mb-drop" role="menu" aria-label={String(m.label)}>
              {m.items.filter(Boolean).map((it, j) => (it.sep ? <hr key={'s' + j} /> : (
                <button key={it.label} type="button" role={it.checked !== undefined ? 'menuitemradio' : 'menuitem'}
                        aria-checked={it.checked !== undefined ? !!it.checked : undefined} disabled={it.disabled} onClick={() => pick(it)}>
                  <span className="mb-check" aria-hidden="true">{it.checked === undefined ? ' ' : it.checked ? '√' : ' '}</span>
                  <span className="mb-label">{it.label}</span>
                  {it.badge ? <span className="badge">{it.badge}</span> : null}
                  {it.key && <span className="mb-key">{it.key}</span>}
                </button>
              )))}
            </div>
          )}
        </div>
      ))}
      {right && <div className="mb-right">{right}</div>}
    </div>
  );
}
