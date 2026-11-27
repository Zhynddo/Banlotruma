// Thu nhỏ hình ngay trên máy trước khi tải lên: đỡ tốn chỗ trong kho miễn phí
// và người chơi tải nhanh hơn. Ảnh lớn tối đa 1600px, ảnh nhỏ cho danh sách 360px.

async function bitmap(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode(); return img;
    } finally { URL.revokeObjectURL(url); }
  }
}

function encode(canvas, quality) {
  return new Promise((ok) => canvas.toBlob((b) => {
    if (b && b.type === 'image/webp') return ok(b);
    canvas.toBlob((j) => ok(j), 'image/jpeg', quality); // máy không xuất được webp
  }, 'image/webp', quality));
}

async function shrink(src, max, quality) {
  const w0 = src.width, h0 = src.height;
  const k = Math.min(1, max / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h);
  return { blob: await encode(c, quality), w, h };
}

export async function prepareImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('“' + file.name + '” không phải file hình.');
  const src = await bitmap(file);
  const big = await shrink(src, 1600, 0.85);
  const small = await shrink(src, 360, 0.8);
  src.close?.();
  const ext = big.blob.type === 'image/webp' ? 'webp' : 'jpg';
  return { big, small, ext };
}

export const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
