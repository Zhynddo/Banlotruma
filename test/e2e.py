"""Test toàn bộ app bằng trình duyệt thật + server Supabase giả.
Chạy: npm run build && python3 test/e2e.py
"""
import json, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
PORT = 8899
BASE = f'http://127.0.0.1:{PORT}'
SB = BASE + '/sb'
KEY = 'anon-test-key'
fails = []

def api(path, body=None):
    req = urllib.request.Request(SB + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'apikey': KEY, 'Content-Type': 'application/json'}, method='POST' if body is not None else 'GET')
    return json.load(urllib.request.urlopen(req))

def check(name, cond, extra=''):
    print(('  ok   ' if cond else '  FAIL ') + name + (f'  [{extra}]' if extra and not cond else ''))
    if not cond: fails.append(name)

srv = subprocess.Popen([sys.executable, str(ROOT / 'test/mock_supabase.py'), str(PORT)])
time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 1200, 'height': 900}, service_workers='allow')
        ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        pg = ctx.new_page()
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))

        print('1. Mở app lần đầu (chưa nối database)')
        pg.goto(BASE + '/')
        expect(pg.locator('h1')).to_have_text('Tra cứu kho Bán Lộ')
        check('trạng thái OFFLINE khi chưa cài database', pg.inner_text('.status') == 'OFFLINE')
        pg.fill('#q', 'han thu'); pg.wait_for_timeout(300)
        check('tìm offline "han thu" ra Hàn Thủ đầu tiên', pg.locator('.item b').first.inner_text() == 'Hàn Thủ')
        pg.locator('.item').first.click()
        check('chi tiết hiện Chill Touch', 'Chill Touch' in pg.inner_text('.detail'))

        print('2. Nối database trong Cài đặt')
        pg.click('text=Cài đặt')
        pg.fill('input[placeholder^="https://"]', SB); pg.fill('input[placeholder="eyJ..."]', KEY)
        pg.click('text=Lưu và kết nối'); pg.wait_for_timeout(800)
        check('trạng thái ONLINE', pg.inner_text('.status') == 'ONLINE')
        check('gói được cập nhật có 171 mục', '171 mục' in pg.inner_text('main'), pg.inner_text('main')[:200])

        print('3. Tìm online')
        pg.click('nav >> text=Tra cứu'); pg.fill('#q', 'ba dong'); pg.wait_for_timeout(700)
        check('tìm trong database', 'tìm trong database' in pg.inner_text('section'))
        check('ra NPC mới đồng bộ về', 'Bà đồng Tư' in pg.inner_text('.list'))

        print('4. Đăng ký và tạo phiếu trên mạng')
        pg.click('nav >> text=Phiếu nhân vật')
        pg.click('text=Chưa có tài khoản?')
        pg.fill('input[autocomplete=nickname]', 'Ngân'); pg.fill('input[type=email]', 'p1@test.vn'); pg.fill('input[type=password]', 'matkhau1')
        pg.click('button[type=submit]'); pg.wait_for_timeout(700)
        check('đã đăng nhập', 'p1@test.vn' in pg.inner_text('main'))
        pg.click('text=+ Phiếu mới'); pg.wait_for_timeout(700)
        check('mở phiếu mới', pg.locator('.sheet').count() == 1)
        pg.get_by_label('Tên nhân vật').fill('Cô Ba Thông Linh')
        pg.get_by_label('Trường (4.3)').select_option('Thông Linh Sư')
        pg.get_by_label('Tuổi').fill('20')
        for k, v in {'Lực': '10', 'Mẫn': '14', 'Thể': '14', 'Trí': '12', 'Tuệ': '16', 'Mị': '13', 'Vía': '15'}.items():
            pg.get_by_label('Điểm ' + k).fill(v)
        pg.get_by_label('Chỉ số chính').select_option('tue')
        pg.get_by_label('Cấp', exact=True).fill('3')
        pg.wait_for_timeout(1600)
        st = api('/test/state'); ch = st['chars'][0] if st['chars'] else {}
        check('đã lưu lên server', ch.get('name') == 'Cô Ba Thông Linh' and ch['data']['stats']['tue'] == 16, json.dumps(ch)[:200])
        txt = pg.inner_text('.sheet')
        # Máu = 15 (tuổi 20) + mod Thể 2 = 17; AC = 10+2 = 12; Linh = (3+1+1+2) + 2*3 = 13; AR = 3+2=5; DC=8+2+3=13
        check('máu tối đa 17', 'Máu tối đa\n17' in txt)
        check('AC 12', 'AC\n12' in txt)
        check('linh tối đa 13', 'Linh tối đa\n13' in txt)
        check('DC 13', 'DC\n13' in txt)
        check('trạng thái đã lưu', 'Đã lưu lên mạng' in pg.inner_text('.save'), pg.inner_text('.save'))

        print('5. Thêm phép vào sổ')
        pg.fill('#sq', 'bao binh'); pg.wait_for_timeout(300)
        hits = pg.locator('.list.short .item')
        check('tìm phép trong phiếu', hits.count() >= 1)
        pg.fill('#sq', 'han thu'); pg.wait_for_timeout(300); pg.locator('.list.short .item').first.click()
        pg.get_by_label('Chuẩn bị Hàn Thủ').check(); pg.wait_for_timeout(1500)
        ch = api('/test/state')['chars'][0]
        check('phép được lưu và đánh dấu chuẩn bị', ch['data']['phep'] == [{'id': 'spell.han-thu', 'chuan_bi': True}], json.dumps(ch['data']['phep']))

        print('6. Xung đột khi phiếu bị sửa ở nơi khác')
        api('/test/bump', {'id': ch['id'], 'data': {'ghi_chu': 'GM sửa'}})
        pg.get_by_label('Người chơi').fill('Ngân'); pg.wait_for_timeout(1500)
        check('báo xung đột', pg.locator('.warnbox').count() == 1)
        pg.click('text=Giữ bản của em'); pg.wait_for_timeout(800)
        ch = api('/test/state')['chars'][0]
        check('giữ bản của em và lưu được', ch['data']['nguoi_choi'] == 'Ngân' and pg.locator('.warnbox').count() == 0, json.dumps(ch['data'].get('nguoi_choi')))

        print('7. Mất mạng: mở lại app, tra cứu, sửa phiếu')
        pg.click('text=← Danh sách'); pg.wait_for_timeout(500)
        pg.wait_for_function('navigator.serviceWorker.controller !== null', timeout=5000)
        ctx.set_offline(True)
        pg.reload(); pg.wait_for_timeout(800)
        check('app vẫn mở khi mất mạng', pg.locator('h1').count() == 1)
        check('trạng thái OFFLINE', pg.inner_text('.status') == 'OFFLINE')
        pg.click('nav >> text=Tra cứu'); pg.fill('#q', 'ba dong tu'); pg.wait_for_timeout(300)
        check('tra cứu offline thấy cả mục đã đồng bộ', 'Bà đồng Tư' in pg.inner_text('.list'))
        pg.click('nav >> text=Phiếu nhân vật'); pg.wait_for_timeout(400)
        check('danh sách phiếu offline vẫn có', 'Cô Ba Thông Linh' in pg.inner_text('.cards'))
        pg.click('.card'); pg.wait_for_timeout(300)
        pg.get_by_label('Nghề đời thường').fill('bán nhang'); pg.wait_for_timeout(1500)
        check('lưu nháp khi offline', 'Nháp' in pg.inner_text('.save'), pg.inner_text('.save'))
        pg.click('text=← Danh sách'); pg.wait_for_timeout(400)
        check('thẻ báo chờ đồng bộ', 'chờ đồng bộ' in pg.inner_text('.cards'))

        print('8. Có mạng lại: tự đồng bộ nháp')
        ctx.set_offline(False)
        pg.evaluate('dispatchEvent(new Event("online"))'); pg.wait_for_timeout(1500)
        ch = api('/test/state')['chars'][0]
        check('nháp đã lên server', ch['data'].get('nghe') == 'bán nhang', json.dumps(ch['data'].get('nghe')))

        print('9. Phiếu trên máy khi chưa đăng nhập, rồi GM thấy mọi phiếu')
        pg.click('text=Đăng xuất'); pg.wait_for_timeout(500)
        pg.click('text=+ Phiếu mới'); pg.wait_for_timeout(400)
        pg.get_by_label('Tên nhân vật').fill('Phiếu nháp trên máy'); pg.wait_for_timeout(1300)
        check('lưu phiếu trên máy', 'Đã lưu trên máy này' in pg.inner_text('.save'))
        pg.click('text=← Danh sách'); pg.wait_for_timeout(400)
        check('phiếu trên máy hiện trong danh sách', 'Phiếu nháp trên máy' in pg.inner_text('.cards'))
        # tạo tài khoản GM
        pg.click('text=Chưa có tài khoản?'); pg.fill('input[type=email]', 'gm@test.vn'); pg.fill('input[type=password]', 'matkhau1')
        pg.click('button[type=submit]'); pg.wait_for_timeout(600)
        api('/test/make_gm', {'email': 'gm@test.vn'})
        pg.reload(); pg.wait_for_timeout(1200); pg.click('nav >> text=Phiếu nhân vật'); pg.wait_for_timeout(900)
        txt = pg.inner_text('main')
        check('GM thấy chữ GM', 'GM, thấy mọi phiếu' in txt, txt[:300])
        check('GM thấy phiếu của người chơi kèm tên chủ', 'Cô Ba Thông Linh' in txt and 'của Ngân' in txt)

        print('10. Đưa phiếu trên máy lên mạng')
        pg.locator('.card.local').click(); pg.wait_for_timeout(300)
        pg.click('text=Đưa phiếu này lên mạng'); pg.wait_for_timeout(1000)
        names = [c['name'] for c in api('/test/state')['chars']]
        check('phiếu trên máy đã lên server', 'Phiếu nháp trên máy' in names, str(names))

        print('10b. GM sửa kho tra cứu')
        pg.click('nav >> text=Tra cứu'); pg.wait_for_timeout(500)
        check('GM thấy nút thêm mục', pg.locator('text=+ Thêm mục').count() == 1)
        pg.click('text=+ Thêm mục'); pg.wait_for_timeout(200)
        pg.get_by_label('Tên', exact=True).fill('Ông Từ Giữ Đền')
        check('mã tự đặt theo tên', 'npc.ong-tu-giu-den' in pg.inner_text('.editor'))
        pg.get_by_label('Nội dung').fill('Ông từ già, biết chuyện cõi âm quanh làng.')
        pg.click('text=+ Thêm ô')
        pg.locator('.extra input').nth(0).fill('Ở đâu'); pg.locator('.extra input').nth(1).fill('Đền Bà Chúa Xứ')
        pg.click('.editor button[type=submit]'); pg.wait_for_timeout(700)
        e = api('/test/entry', {'id': 'npc.ong-tu-giu-den'})
        check('mục mới lên server', e and e['data'].get('o_dau') == 'Đền Bà Chúa Xứ', json.dumps(e, ensure_ascii=False)[:200])
        check('mục mới hiện ngay ở chi tiết', 'Ông Từ Giữ Đền' in pg.inner_text('.detail') and 'Đền Bà Chúa Xứ' in pg.inner_text('.detail'))
        check('mục mới tìm được trên máy', pg.evaluate("document.querySelector('footer').innerText").find('172 mục') >= 0, pg.inner_text('footer'))

        pg.fill('#q', 'han thu'); pg.wait_for_timeout(700); pg.locator('.item').first.click(); pg.wait_for_timeout(200)
        pg.click('.detail >> text=Sửa')
        check('form điền sẵn giá trị cũ', pg.get_by_label('Gốc D&D').input_value() == 'Chill Touch')
        pg.get_by_label('Giá (linh)').fill('1'); pg.get_by_label('Hiển thị').select_option('draft')
        pg.click('.editor button[type=submit]'); pg.wait_for_timeout(700)
        e = api('/test/entry', {'id': 'spell.han-thu'})
        check('sửa giá và chuyển nháp', e['data']['gia'] == 1 and e['status'] == 'draft' and e['data']['goc'] == 'Chill Touch' and e['data']['tinh'] == ['Âm'], json.dumps(e['data'], ensure_ascii=False))
        check('danh sách đánh dấu nháp', 'nháp' in pg.locator('.item').first.inner_text())

        pg.fill('#q', 'ap linh'); pg.wait_for_timeout(700); pg.locator('.item').first.click(); pg.wait_for_timeout(200)
        pg.click('.detail >> text=Sửa')
        api('/test/bump_entry', {'id': 'spell.ap-linh'})
        pg.get_by_label('Nội dung').fill('bản của GM')
        pg.click('.editor button[type=submit]'); pg.wait_for_timeout(600)
        check('báo sửa trùng', pg.locator('.editor .warnbox').count() == 1)
        pg.click('text=Lấy bản mới nhất'); pg.wait_for_timeout(600)
        check('lấy được bản mới', 'sửa từ máy khác' in pg.inner_text('.detail'), pg.inner_text('.detail')[:200])

        pg.fill('#q', 'ong tu'); pg.wait_for_timeout(700); pg.locator('.item').first.click(); pg.wait_for_timeout(200)
        pg.click('.detail >> text=Sửa'); pg.click('text=Xoá mục'); pg.click('text=Bấm lần nữa để xoá hẳn'); pg.wait_for_timeout(600)
        check('xoá mục trên server', api('/test/entry', {'id': 'npc.ong-tu-giu-den'}) is None)
        check('xoá mục trên máy', 'Ông Từ' not in pg.inner_text('.list'))

        print('10c. Người chơi không thấy mục nháp')
        p2 = b.new_context(viewport={'width': 1200, 'height': 900})
        p2.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        q2 = p2.new_page(); q2.goto(BASE + '/'); q2.wait_for_timeout(300)
        q2.click('text=Cài đặt'); q2.fill('input[placeholder^="https://"]', SB + '/rest/v1/ '); q2.fill('input[placeholder="eyJ..."]', ' ' + KEY + ' ')
        q2.click('text=Lưu và kết nối'); q2.wait_for_timeout(900)
        check('URL thừa đuôi /rest/v1 vẫn nối được', q2.inner_text('.status') == 'ONLINE')
        q2.click('nav >> text=Tra cứu'); q2.fill('#q', 'han thu'); q2.wait_for_timeout(700)
        check('người chơi không thấy Hàn Thủ (nháp)', 'Hàn Thủ' not in q2.inner_text('.list'), q2.inner_text('.list')[:200])
        q2.fill('#q', ''); q2.wait_for_timeout(300)
        check('người chơi không có nút sửa', q2.locator('text=+ Thêm mục').count() == 0)
        p2.close()

        print('11. Điện thoại')
        m = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        m.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        mp = m.new_page(); mp.goto(BASE + '/'); mp.wait_for_timeout(600)
        sw = mp.evaluate('document.documentElement.scrollWidth')
        check('không tràn ngang trên điện thoại', sw <= 390, str(sw))
        mp.fill('#q', 'kiem'); mp.wait_for_timeout(300)
        mp.screenshot(path=str(ROOT / 'test/shot-mobile.png'))
        pg.goto(BASE + '/#phieu'); pg.reload(); pg.wait_for_timeout(1000); pg.locator('.card').first.click(); pg.wait_for_timeout(400)
        pg.screenshot(path=str(ROOT / 'test/shot-sheet.png'), full_page=False)

        check('không có lỗi JavaScript', not errors, '; '.join(errors)[:300])
        b.close()
finally:
    srv.terminate()

print('\nKẾT QUẢ:', 'TẤT CẢ ĐẠT' if not fails else f'{len(fails)} lỗi: ' + ', '.join(fails))
sys.exit(1 if fails else 0)
