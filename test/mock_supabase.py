"""Server giả lập Supabase để test app (không đưa lên GitHub cũng được).
Phục vụ app ở /  và API giả ở /sb/...  Chạy: python3 test/mock_supabase.py 8899
"""
import json, sys, uuid, time, unicodedata, re
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
ANON = 'anon-test-key'
now = lambda: datetime.now(timezone.utc).isoformat()

def norm(s):
    s = (s or '').replace('đ', 'd').replace('Đ', 'D')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()

ENTRIES = {e['id']: {**e, 'status': 'published', 'rev': 1, 'updated_at': now()} for e in json.load(open(DIST / 'data/core.json'))}
# một mục mới chỉ có trên server, để test đồng bộ gói
ENTRIES['npc.ba-dong-tu'] = {'id': 'npc.ba-dong-tu', 'type': 'npc', 'name': 'Bà đồng Tư', 'summary': None, 'body': 'Bà đồng ở bến Phà Cũ, hầu giá Chầu.', 'tags': ['npc'], 'data': {}, 'status': 'published', 'rev': 1, 'updated_at': now(), 'source': 'test'}
DELETED = {}
FILES = {}      # path -> (content-type, bytes)
USERS = {}      # email -> {id, password, display_name}
PROFILES = {}   # id -> {id, display_name, role}
TOKENS = {}     # token -> user id
CHARS = {}      # id -> row
LOG = []

def make_session(uid):
    at, rt = 'at-' + uuid.uuid4().hex, 'rt-' + uuid.uuid4().hex
    TOKENS[at] = uid; TOKENS[rt] = uid
    u = next(x for x in USERS.values() if x['id'] == uid)
    return {'access_token': at, 'refresh_token': rt, 'expires_in': 3600, 'token_type': 'bearer', 'user': {'id': uid, 'email': u['email']}}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def send(self, code, obj=None, ctype='application/json', raw=None):
        body = raw if raw is not None else (b'' if obj is None else json.dumps(obj, ensure_ascii=False).encode())
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Methods', '*')
        self.end_headers(); self.wfile.write(body)

    def do_OPTIONS(self): self.send(204)

    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return json.loads(self.rfile.read(n) or b'null') if n else None

    def uid(self):
        tok = (self.headers.get('Authorization') or '').replace('Bearer ', '')
        return TOKENS.get(tok) if tok.startswith('at-') else None

    def is_gm(self):
        u = self.uid(); return bool(u and PROFILES.get(u, {}).get('role') == 'gm')

    def static(self, path):
        p = path if path != '/' else '/index.html'
        f = DIST / p.lstrip('/')
        if f.is_file():
            t = {'html': 'text/html', 'js': 'text/javascript', 'css': 'text/css', 'json': 'application/json', 'webmanifest': 'application/manifest+json', 'png': 'image/png'}.get(f.suffix[1:], 'application/octet-stream')
            return self.send(200, raw=f.read_bytes(), ctype=t)
        self.send(404, {'message': 'not found'})

    def route(self, method):
        u = urlparse(self.path); path = u.path; q = parse_qs(u.query)
        if not path.startswith('/sb/'):
            return self.static(path) if method == 'GET' else self.send(405)
        if method == 'GET' and path.startswith('/sb/storage/v1/object/public/media/'):
            f = FILES.get(path[len('/sb/storage/v1/object/public/media/'):])
            return self.send(200, raw=f[1], ctype=f[0]) if f else self.send(400, {'message': 'Object not found'})
        if self.headers.get('apikey') != ANON:
            return self.send(401, {'message': 'Invalid API key'})
        p = path[3:]
        LOG.append((method, p))
        # ---- auth ----
        if p == '/auth/v1/signup':
            b = self.body()
            if b['email'] in USERS: return self.send(422, {'msg': 'User already registered', 'error_code': 'user_already_exists'})
            uid = str(uuid.uuid4())
            USERS[b['email']] = {'id': uid, 'email': b['email'], 'password': b['password']}
            PROFILES[uid] = {'id': uid, 'display_name': (b.get('data') or {}).get('display_name') or b['email'].split('@')[0], 'role': 'player'}
            return self.send(200, make_session(uid))
        if p == '/auth/v1/token':
            b = self.body(); g = q.get('grant_type', [''])[0]
            if g == 'password':
                usr = USERS.get(b['email'])
                if not usr or usr['password'] != b['password']: return self.send(400, {'error': 'invalid_grant', 'error_description': 'Invalid login credentials'})
                return self.send(200, make_session(usr['id']))
            if g == 'refresh_token':
                uid = TOKENS.get(b['refresh_token'])
                if not uid: return self.send(400, {'error_description': 'Invalid Refresh Token'})
                return self.send(200, make_session(uid))
        if p == '/auth/v1/logout': return self.send(204)
        # ---- storage ----
        if p.startswith('/storage/v1/object/media'):
            if not self.is_gm(): return self.send(403, {'message': 'new row violates row-level security policy'})
            if method == 'POST':
                key = p[len('/storage/v1/object/media/'):]
                if key in FILES: return self.send(400, {'message': 'The resource already exists'})
                n = int(self.headers.get('Content-Length') or 0)
                FILES[key] = (self.headers.get('Content-Type'), self.rfile.read(n))
                return self.send(200, {'Key': 'media/' + key})
            if method == 'DELETE':
                gone = [k for k in self.body()['prefixes'] if FILES.pop(k, None)]
                return self.send(200, [{'name': k} for k in gone])
        # ---- rpc ----
        if p == '/rest/v1/rpc/changes_since':
            since = self.body()['since']
            ch = [{k: v for k, v in e.items() if k != 'search'} for e in ENTRIES.values() if e['updated_at'] > since and (e['status'] == 'published' or self.is_gm())]
            return self.send(200, {'now': now(), 'changed': ch, 'deleted': [i for i, t in DELETED.items() if t > since]})
        if p == '/rest/v1/rpc/search_entries':
            b = self.body(); nq = norm(b['q']).strip(); toks = re.sub('[^a-z0-9 ]', ' ', nq).split()
            res = []
            for e in ENTRIES.values():
                if e['status'] != 'published' and not self.is_gm(): continue
                if b.get('types') and e['type'] not in b['types']: continue
                hay = norm(e['name'] + ' ' + ' '.join(e['tags']) + ' ' + (e['body'] or ''))
                if all((' ' + t) in (' ' + hay.replace('-', ' ')) for t in toks):
                    score = 3 if norm(e['name']) == nq else 1.5 if norm(e['name']).startswith(nq) else 1
                    res.append((score, e))
            res.sort(key=lambda x: -x[0])
            return self.send(200, [{'id': e['id'], 'type': e['type'], 'name': e['name'], 'summary': None, 'rank': s} for s, e in res[: b.get('lim', 30)]])
        if p == '/rest/v1/rpc/save_character':
            b = self.body(); me = self.uid(); c = CHARS.get(b['char_id'])
            if not me: return self.send(401, {'message': 'JWT required'})
            if not c or (c['owner_id'] != me and not self.is_gm()): return self.send(400, {'code': 'P0002', 'message': 'not found'})
            if c['rev'] != b['expected_rev']: return self.send(409, {'code': '40001', 'message': 'conflict: phiếu đã được sửa ở nơi khác'})
            c.update(name=b['new_name'] or c['name'], data=b['new_data'], rev=c['rev'] + 1, updated_at=now())
            return self.send(200, c['rev'])
        # ---- tables ----
        if p == '/rest/v1/entries':
            vis = lambda e: e['status'] == 'published' or self.is_gm()
            rows = [e for e in ENTRIES.values() if vis(e)]
            if 'id' in q: rows = [e for e in rows if 'eq.' + e['id'] == q['id'][0]]
            if 'rev' in q: rows = [e for e in rows if 'eq.' + str(e['rev']) == q['rev'][0]]
            if method == 'GET':
                return self.send(200, rows[:1] if q.get('limit') else rows)
            if not self.is_gm():
                return self.send(200 if method != 'POST' else 403, [] if method != 'POST' else {'message': 'new row violates row-level security policy for table "entries"'})
            if method == 'POST':
                b = self.body()
                if b['id'] in ENTRIES: return self.send(409, {'code': '23505', 'message': 'duplicate key value violates unique constraint "entries_pkey"'})
                ENTRIES[b['id']] = {'summary': None, 'body': None, 'tags': [], 'data': {}, 'status': 'published', 'source': None, **b, 'rev': 1, 'updated_at': now(), 'search': 'x'}
                return self.send(201, [ENTRIES[b['id']]])
            if method == 'PATCH':
                b = self.body(); out = []
                for e in rows:
                    if e['status'] == 'published' and b.get('status') == 'draft': DELETED[e['id']] = now()
                    e.update(b); e['rev'] += 1; e['updated_at'] = now(); out.append(e)
                return self.send(200, out)
            if method == 'DELETE':
                for e in rows: del ENTRIES[e['id']]; DELETED[e['id']] = now()
                return self.send(200, rows)
        if p == '/rest/v1/profiles':
            me = self.uid(); rows = [r for r in PROFILES.values() if r['id'] == me or self.is_gm()]
            if 'id' in q: rows = [r for r in rows if 'eq.' + r['id'] == q['id'][0]]
            return self.send(200, rows)
        if p == '/rest/v1/characters':
            me = self.uid()
            if not me: return self.send(401, {'message': 'JWT required'})
            vis = lambda c: c['owner_id'] == me or self.is_gm()
            if method == 'GET':
                rows = [c for c in CHARS.values() if vis(c)]
                if 'id' in q: rows = [c for c in rows if 'eq.' + c['id'] == q['id'][0]]
                return self.send(200, sorted(rows, key=lambda c: c['updated_at'], reverse=True))
            if method == 'POST':
                b = self.body(); cid = str(uuid.uuid4())
                CHARS[cid] = {'id': cid, 'owner_id': me, 'name': b.get('name', 'Nhân vật mới'), 'data': b.get('data', {}), 'rev': 1, 'created_at': now(), 'updated_at': now()}
                return self.send(201, [CHARS[cid]])
            if method == 'DELETE':
                cid = q['id'][0][3:]
                if cid in CHARS and vis(CHARS[cid]): del CHARS[cid]
                return self.send(204)
        # ---- điều khiển test ----
        if p == '/test/state': return self.send(200, {'files': {k: [v[0], len(v[1])] for k, v in FILES.items()}, 'chars': list(CHARS.values()), 'profiles': PROFILES, 'log': LOG[-50:]})
        if p == '/test/make_gm':
            b = self.body(); usr = USERS[b['email']]; PROFILES[usr['id']]['role'] = 'gm'; return self.send(200, {'ok': True})
        if p == '/test/entry': return self.send(200, raw=json.dumps(ENTRIES.get(self.body()['id']), ensure_ascii=False).encode())
        if p == '/test/bump_entry':
            e = ENTRIES[self.body()['id']]; e['rev'] += 1; e['updated_at'] = now(); e['body'] = 'sửa từ máy khác'; return self.send(200, e)
        if p == '/test/bump':
            b = self.body(); c = CHARS[b['id']]; c['data'] = {**c['data'], **b.get('data', {})}; c['rev'] += 1; c['updated_at'] = now()
            return self.send(200, c)
        self.send(404, {'message': 'no route ' + p})

    def do_GET(self): self.route('GET')
    def do_POST(self): self.route('POST')
    def do_DELETE(self): self.route('DELETE')
    def do_PATCH(self): self.route('PATCH')

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
    ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
