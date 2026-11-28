// Đọc file Excel (.xlsx) ngay trên trình duyệt, không cần thư viện ngoài.
// .xlsx là một file zip chứa các tệp XML: giải nén bằng DecompressionStream rồi đọc XML.
// Trả về { [tên sheet]: [[ô, ô, ...], ...] } với giá trị dạng chuỗi.

async function inflate(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const out = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

// Đọc mục lục ở cuối file zip để lấy danh sách tệp bên trong
async function unzip(buf) {
  const v = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('File không phải .xlsx (không đọc được).');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const files = {};
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nlen));
    files[name] = { method, csize, local };
    p += 46 + nlen + xlen + clen;
  }
  const read = async (name) => {
    const f = files[name];
    if (!f) return null;
    const start = f.local + 30 + v.getUint16(f.local + 26, true) + v.getUint16(f.local + 28, true);
    const raw = new Uint8Array(buf, start, f.csize);
    const data = f.method === 0 ? raw : await inflate(raw);
    return new TextDecoder().decode(data);
  };
  return { files, read };
}

const xml = (s) => new DOMParser().parseFromString(s, 'application/xml');
const tagAll = (node, name) => [...node.getElementsByTagNameNS('*', name)];
const colIndex = (ref) => { let n = 0; for (const ch of ref.replace(/[0-9]/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

export async function readXlsx(file) {
  const { read } = await unzip(await file.arrayBuffer());
  const wb = await read('xl/workbook.xml');
  if (!wb) throw new Error('File không phải .xlsx (thiếu workbook).');
  const rels = xml((await read('xl/_rels/workbook.xml.rels')) || '<x/>');
  const target = Object.fromEntries(tagAll(rels, 'Relationship').map((r) => [r.getAttribute('Id'), r.getAttribute('Target')]));
  const ssXml = await read('xl/sharedStrings.xml');
  const shared = ssXml ? tagAll(xml(ssXml), 'si').map((si) => tagAll(si, 't').map((t) => t.textContent).join('')) : [];
  const out = {};
  for (const sh of tagAll(xml(wb), 'sheet')) {
    const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    let path = target[rid] || '';
    path = path.startsWith('/') ? path.slice(1) : 'xl/' + path.replace(/^\.\//, '');
    const sx = await read(path);
    if (!sx) continue;
    const rows = [];
    for (const r of tagAll(xml(sx), 'row')) {
      const ri = Number(r.getAttribute('r')) - 1;
      const row = [];
      for (const c of tagAll(r, 'c')) {
        const t = c.getAttribute('t');
        const vEl = tagAll(c, 'v')[0];
        let val = '';
        if (t === 's') val = shared[Number(vEl?.textContent)] ?? '';
        else if (t === 'inlineStr') val = tagAll(c, 't').map((x) => x.textContent).join('');
        else if (t === 'b') val = vEl?.textContent === '1' ? 'TRUE' : 'FALSE';
        else val = vEl?.textContent ?? '';
        row[colIndex(c.getAttribute('r') || '')] = val;
      }
      rows[ri] = Array.from(row, (x) => (x ?? '').toString());
    }
    out[sh.getAttribute('name')] = Array.from(rows, (x) => x || []);
  }
  return out;
}
