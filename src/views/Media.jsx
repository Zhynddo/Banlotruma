// Hiện hình vẽ của một mục. Hình được service worker lưu lại, mất mạng vẫn xem được.
import { useEffect, useState } from 'react';
import { media } from '../lib/api.js';

export function Img({ path, alt = '', className, lazy = true }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [path]);
  if (!path || bad) return <span className={'img-miss ' + (className || '')}>hình chưa có trên máy</span>;
  return (
    <img src={media.url(path)} alt={alt} className={className} crossOrigin="anonymous"
         loading={lazy ? 'lazy' : 'eager'} decoding="async" onError={() => setBad(true)} />
  );
}

export function Gallery({ items }) {
  const [open, setOpen] = useState(-1);
  useEffect(() => {
    if (open < 0) return undefined;
    const key = (e) => {
      if (e.key === 'Escape') setOpen(-1);
      if (e.key === 'ArrowRight') setOpen((i) => (i + 1) % items.length);
      if (e.key === 'ArrowLeft') setOpen((i) => (i - 1 + items.length) % items.length);
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [open, items.length]);
  if (!items?.length) return null;
  const [first, ...rest] = items;
  const cur = items[open];
  return (
    <div className="gallery">
      <button type="button" className="shot main" onClick={() => setOpen(0)} aria-label={'Phóng to hình' + (first.alt ? ': ' + first.alt : '')}>
        <Img path={first.path} alt={first.alt} />
      </button>
      {(first.alt || first.credit) && <p className="muted small cap">{first.alt}{first.credit ? ' · hình: ' + first.credit : ''}</p>}
      {rest.length > 0 && (
        <div className="thumbs">
          {rest.map((h, i) => (
            <button key={h.path} type="button" className="shot" onClick={() => setOpen(i + 1)} aria-label={'Phóng to hình ' + (i + 2) + (h.alt ? ': ' + h.alt : '')}>
              <Img path={h.thumb || h.path} alt={h.alt} />
            </button>
          ))}
        </div>
      )}
      {cur && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Xem hình" onClick={() => setOpen(-1)}>
          <Img path={cur.path} alt={cur.alt} lazy={false} />
          <p className="small">{open + 1}/{items.length}{cur.alt ? ' · ' + cur.alt : ''}{cur.credit ? ' · hình: ' + cur.credit : ''} · bấm để đóng</p>
        </div>
      )}
    </div>
  );
}
