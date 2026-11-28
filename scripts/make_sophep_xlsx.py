"""Tạo file Excel sổ phép (mẫu điền + 125 phép hiện có) từ public/data/core.json.
Chạy: python3 scripts/make_sophep_xlsx.py  →  public/files/BanLoTruMa_SoPhep.xlsx"""
import json, re, sys
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'public/files/BanLoTruMa_SoPhep.xlsx'
BAC = ['Cấp thấp', 'Sơ', 'Trung', 'Cao']
TINH = ['Âm', 'Dương', 'Khẩu', 'Thủ', 'Huyết', 'Hương', 'Khế', 'Trấn', 'Nhập', 'Xuất', 'Cổ', 'Kim']

# Giống src/lib/spell.js: tách ô "thi" cũ thành các trường riêng
RANGE = re.compile(r'(ft|feet|chạm|bản thân|tại chỗ|dặm|tầm nhìn|mét|\bm\b|km|cõi)', re.I)
TIME = re.compile(r'(tức thì|phút|giờ|ngày|lượt|tuần|tháng|năm|đêm|vĩnh viễn|tới khi|đến khi|tới nghỉ|giấc)', re.I)
HIT = re.compile(r'^(AR|thử |thắng |cứu )', re.I)
def split_thi(thi, hd):
    out = dict(hanh_dong='', tam='', thoi_han='', cach='', kem='', duy_tri=False)
    parts = [p.strip() for p in (thi or '').split('·') if p.strip()]
    if not parts: return out
    if not hd or parts[0] == hd or not RANGE.search(parts[0]): out['hanh_dong'] = parts.pop(0)
    extra = []
    for x in parts:
        if re.search(r',\s*duy trì$', x, re.I): out['duy_tri'] = True; x = re.sub(r',\s*duy trì$', '', x, flags=re.I)
        if not out['tam'] and RANGE.search(x) and not TIME.search(x): out['tam'] = x
        elif HIT.search(x): out['cach'] = (out['cach'] + ', ' if out['cach'] else '') + x
        elif not out['thoi_han'] and TIME.search(x): out['thoi_han'] = x
        else: extra.append(x)
    out['kem'] = ', '.join(extra)
    return out

# (tiêu đề, bắt buộc, độ rộng, giải thích, ví dụ)
COLS = [
    ('Mã', False, 22, 'Để trống khi thêm phép mới: app tự đặt theo tên. Đừng sửa mã của phép đã có, app dựa vào mã để biết đang sửa phép nào.', 'spell.han-thu'),
    ('Tên', True, 20, 'Tên phép.', 'Hàn Thủ'),
    ('Bậc', True, 11, 'Chọn trong danh sách: Cấp thấp, Sơ, Trung, Cao.', 'Cấp thấp'),
    ('Tính', False, 16, 'Một hoặc nhiều Tính, cách nhau bằng dấu +. 12 Tính: ' + ', '.join(TINH) + '.', 'Thủ + Trấn'),
    ('Giá (linh)', False, 9, 'Số linh tốn khi dùng. Phép cấp thấp thường là 0.', '2'),
    ('Hành động', False, 16, 'Mất gì để dùng: Action, Bonus action, Reaction khi..., 1 phút, 10 phút...', 'Action'),
    ('Tầm', False, 12, 'Khoảng cách: 60ft, chạm, bản thân, tại chỗ, trong cõi...', '60ft'),
    ('Thời hạn', False, 14, 'Phép kéo dài bao lâu. Bỏ trống nếu tức thì.', '1 phút'),
    ('Duy trì', False, 9, 'Có nếu phải giữ tâm (bị đánh trúng thì thử Thể).', 'Không'),
    ('Cách trúng', False, 14, 'AR nếu tung đánh trúng; hoặc chỉ số mục tiêu thử để tránh (thử Mẫn, thử Vía...).', 'AR'),
    ('Kèm theo', False, 16, 'Giá phụ hay điều kiện: 1 máu, ngoài trời, tối đa 4 người...', '1 máu'),
    ('Mô tả', True, 60, 'Phép làm gì. Xuống dòng trong ô: Alt+Enter.', '1d8 Âm. Mục tiêu không hồi máu tới đầu lượt sau của bạn'),
    ('Ở bậc cao hơn', False, 30, 'Mạnh hơn thế nào khi trả thêm linh hoặc lên cấp. Bỏ trống nếu không có.', '+1d8 ở cấp 5, 11, 17'),
    ('Gốc D&D', False, 18, 'Phép D&D làm gốc, để đối chiếu.', 'Chill Touch'),
    ('Mục luật', False, 9, 'Số mục trong bản luật.', '12.1'),
    ('Ghi chú GM', False, 24, 'Ghi chú thêm, hiện bên lề trang sổ.', ''),
    ('Thẻ', False, 16, 'Từ khoá để tìm, cách nhau bằng dấu phẩy.', 'Âm, Cấp thấp'),
    ('Trạng thái', False, 11, 'Đăng: ai cũng thấy. Nháp: chỉ GM thấy.', 'Đăng'),
    ('Luật thử', False, 9, 'Có nếu luật của phép còn đang thử nghiệm.', 'Không'),
]

FONT = 'Arial'
HEAD = PatternFill('solid', start_color='1F4A32')
REQ = PatternFill('solid', start_color='2E6B47')
BAND = PatternFill('solid', start_color='EEF5EC')
INPUT = PatternFill('solid', start_color='FFF8D6')
thin = Side(style='thin', color='B7CDBB')

entries = json.loads((ROOT / 'public/data/core.json').read_text())
spells = [e for e in entries if e['type'] == 'spell']
spells.sort(key=lambda e: (BAC.index(e['data'].get('bac')) if e['data'].get('bac') in BAC else 9, e['name']))

wb = Workbook()

# ---- Sheet Hướng dẫn ----
ws = wb.active; ws.title = 'Hướng dẫn'
ws.sheet_view.showGridLines = False
ws.column_dimensions['A'].width = 18; ws.column_dimensions['B'].width = 11; ws.column_dimensions['C'].width = 70; ws.column_dimensions['D'].width = 30
ws['A1'] = 'BÁN LỘ TRỪ MA · SỔ PHÉP'; ws['A1'].font = Font(name=FONT, size=16, bold=True, color='1F4A32')
ws['A2'] = 'Mỗi dòng ở sheet “Phép” là một phép. Điền xong, GM mở app: Sổ phép → Tệp → Nhập phép từ Excel, chọn file này.'
ws['A2'].font = Font(name=FONT, size=11)
steps = [
    '1. Sửa phép cũ: sửa thẳng trong dòng của phép đó, giữ nguyên cột Mã.',
    '2. Thêm phép mới: thêm dòng ở cuối bảng, để trống cột Mã.',
    '3. Cột có dấu * là bắt buộc (Tên, Bậc, Mô tả). Dòng thiếu sẽ bị bỏ qua và app báo dòng nào lỗi.',
    '4. Xoá một dòng trong file KHÔNG xoá phép trong app. Muốn ẩn phép thì đổi Trạng thái thành Nháp.',
    '5. Trước khi ghi, app cho xem trước: phép nào mới, phép nào sửa, sửa ô nào. Có thể huỷ.',
    '6. Ô nền vàng nhạt là ô để điền. Có thể thêm cột riêng ở bên phải, app sẽ bỏ qua cột lạ.',
]
for i, t in enumerate(steps):
    c = ws.cell(row=4 + i, column=1, value=t); c.font = Font(name=FONT, size=11)
r0 = 4 + len(steps) + 1
for j, h in enumerate(['Cột', 'Bắt buộc', 'Điền gì', 'Ví dụ']):
    c = ws.cell(row=r0, column=1 + j, value=h); c.font = Font(name=FONT, bold=True, color='FFFFFF'); c.fill = HEAD
for i, (h, req, w, note, ex) in enumerate(COLS):
    r = r0 + 1 + i
    vals = [h, 'Có' if req else '', note, ex]
    for j, v in enumerate(vals):
        c = ws.cell(row=r, column=1 + j, value=v); c.font = Font(name=FONT, size=10, bold=(j == 0)); c.alignment = Alignment(wrap_text=True, vertical='top')
        if i % 2 == 0: c.fill = BAND
        c.border = Border(bottom=thin)

# ---- Sheet Danh mục (cho danh sách chọn) ----
dm = wb.create_sheet('Danh mục')
for j, (h, vals) in enumerate([('Bậc', BAC), ('Tính', TINH), ('Có / Không', ['Có', 'Không']), ('Trạng thái', ['Đăng', 'Nháp'])]):
    c = dm.cell(row=1, column=1 + j, value=h); c.font = Font(name=FONT, bold=True, color='FFFFFF'); c.fill = HEAD
    dm.column_dimensions[get_column_letter(1 + j)].width = 14
    for i, v in enumerate(vals): dm.cell(row=2 + i, column=1 + j, value=v).font = Font(name=FONT)

# ---- Sheet Phép ----
sp = wb.create_sheet('Phép', 1)
for j, (h, req, w, note, ex) in enumerate(COLS):
    c = sp.cell(row=1, column=1 + j, value=h + (' *' if req else ''))
    c.font = Font(name=FONT, bold=True, color='FFFFFF'); c.fill = REQ if req else HEAD
    c.alignment = Alignment(vertical='center', wrap_text=True)
    sp.column_dimensions[get_column_letter(1 + j)].width = w
sp.row_dimensions[1].height = 30
yn = lambda b: 'Có' if b else 'Không'
for i, e in enumerate(spells):
    d = e['data']; x = split_thi(d.get('thi'), d.get('hanh_dong'))
    row = [
        e['id'], e['name'], d.get('bac', ''), ' + '.join(d.get('tinh') or []),
        d.get('gia') if d.get('gia') not in (None, '') else None,
        d.get('hanh_dong') or x['hanh_dong'], d.get('tam') or x['tam'], d.get('thoi_han') or x['thoi_han'],
        yn(d.get('duy_tri') or x['duy_tri']), d.get('cach') or x['cach'], d.get('kem') or x['kem'],
        e.get('body') or '', d.get('bac_cao', ''), d.get('goc', ''), d.get('muc', ''), d.get('ghi_chu', ''),
        ', '.join(e.get('tags') or []), 'Nháp' if e.get('status') == 'draft' else 'Đăng', yn(d.get('nhap')),
    ]
    for j, v in enumerate(row):
        c = sp.cell(row=2 + i, column=1 + j, value=v)
        c.font = Font(name=FONT, size=10, color='000000' if j else '6B6B6B')
        c.alignment = Alignment(vertical='top', wrap_text=j in (11, 12, 15))
        if j == 4: c.number_format = '0'
        c.fill = INPUT if j else PatternFill()
        c.border = Border(bottom=thin)
last = 1 + len(spells)
# Chừa sẵn 60 dòng trống để thêm phép mới, vẫn có danh sách chọn
END = last + 60
for r in range(last + 1, END + 1):
    for j in range(len(COLS)):
        c = sp.cell(row=r, column=1 + j); c.fill = INPUT if j else PatternFill(); c.font = Font(name=FONT, size=10); c.border = Border(bottom=thin)
sp.freeze_panes = 'C2'
sp.auto_filter.ref = f'A1:{get_column_letter(len(COLS))}{last}'

def dv(col, src, prompt):
    v = DataValidation(type='list', formula1=src, allow_blank=True, showErrorMessage=True, errorTitle='Giá trị không hợp lệ', error='Chọn trong danh sách.')
    v.promptTitle = COLS[col][0]; v.prompt = prompt; v.showInputMessage = True
    sp.add_data_validation(v); L = get_column_letter(col + 1); v.add(f'{L}2:{L}{END}')
dv(2, "='Danh mục'!$A$2:$A$5", 'Cấp thấp, Sơ, Trung hoặc Cao')
dv(8, "='Danh mục'!$C$2:$C$3", 'Có nếu phải giữ tâm')
dv(17, "='Danh mục'!$D$2:$D$3", 'Đăng: ai cũng thấy. Nháp: chỉ GM thấy')
dv(18, "='Danh mục'!$C$2:$C$3", 'Có nếu luật còn đang thử')
g = DataValidation(type='whole', operator='between', formula1='0', formula2='99', allow_blank=True, showErrorMessage=True, error='Giá là số nguyên từ 0.')
g.promptTitle = 'Giá (linh)'; g.prompt = 'Số linh, ví dụ 0, 1, 2'; g.showInputMessage = True
sp.add_data_validation(g); g.add(f'E2:E{END}')
t = DataValidation(type='custom', formula1='TRUE', allow_blank=True)
t.promptTitle = 'Tính'; t.prompt = 'Cách nhau bằng dấu +. ' + ', '.join(TINH); t.showInputMessage = True
sp.add_data_validation(t); t.add(f'D2:D{END}')

wb.active = 1
OUT.parent.mkdir(parents=True, exist_ok=True)
wb.save(OUT)
print('Đã tạo', OUT, '·', len(spells), 'phép')
