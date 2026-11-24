// Build: bundle src/ bằng esbuild, chép public/ sang dist/, đóng service worker.
// Chạy:  npm run build            (ra thư mục dist/)
//        npm run serve            (build rồi mở http://localhost:8080)
// Biến môi trường (đặt trong GitHub → Settings → Secrets and variables → Actions → Variables):
//   SUPABASE_URL, SUPABASE_ANON_KEY
import * as esbuild from 'esbuild';
import { cp, rm, mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const serve = process.argv.includes('--serve');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(join(root, 'public'), dist, { recursive: true });

const build = new Date().toISOString();
await esbuild.build({
  entryPoints: [join(root, 'src/main.jsx')],
  bundle: true,
  minify: !serve,
  sourcemap: serve,
  format: 'esm',
  target: ['es2020', 'safari15'],
  jsx: 'automatic',
  loader: { '.js': 'jsx' },
  outfile: join(dist, 'app.js'),
  define: {
    __SUPABASE_URL__: JSON.stringify(process.env.SUPABASE_URL || ''),
    __SUPABASE_ANON_KEY__: JSON.stringify(process.env.SUPABASE_ANON_KEY || ''),
    __BUILD__: JSON.stringify(build),
    'process.env.NODE_ENV': JSON.stringify(serve ? 'development' : 'production'),
  },
  logLevel: 'info',
});

// Danh sách file cho service worker lưu offline, kèm mã phiên bản theo nội dung
const files = [];
const walk = async (dir, base = '') => {
  for (const name of await readdir(dir)) {
    const p = join(dir, name), rel = base + name;
    if ((await stat(p)).isDirectory()) await walk(p, rel + '/');
    else if (rel !== 'sw.js' && !rel.endsWith('.map')) files.push(rel);
  }
};
await walk(dist);
const hash = createHash('sha256');
for (const f of files.sort()) hash.update(f).update(await readFile(join(dist, f)));
const version = hash.digest('hex').slice(0, 12);
const sw = (await readFile(join(root, 'public/sw.js'), 'utf8'))
  .replace('__VERSION__', version)
  .replace('__FILES__', JSON.stringify(['./', ...files.map((f) => './' + f)]));
await writeFile(join(dist, 'sw.js'), sw);
console.log(`dist/ xong · ${files.length} file · bản ${version}`);

if (serve) {
  const { createServer } = await import('node:http');
  const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', webmanifest: 'application/manifest+json', png: 'image/png', svg: 'image/svg+xml' };
  createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    try {
      const body = await readFile(join(dist, p));
      res.writeHead(200, { 'content-type': types[p.split('.').pop()] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  }).listen(8080, () => console.log('http://localhost:8080'));
}
