// Hồ sơ đọc được của một nhân vật, trình bày như tờ sơ yếu lý lịch.
// Dùng cho PC công khai và NPC.
import { STATS, derive, fmt } from '../lib/rules.js';
import { normalizeSheet } from '../lib/sheet.js';
import { Img, Gallery } from './Media.jsx';
import { useUi } from '../shell/ui.js';

const canOf = (d) => String(d?.can || d?.Can || '').trim();

const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const has = (v) => v !== null && v !== undefined && String(v).trim() !== '' && v !== false;
const ngay = (iso) => {
  const t = iso ? new Date(iso) : new Date();
  return `ngày ${t.getDate()} tháng ${t.getMonth() + 1} năm ${t.getFullYear()}`;
};

function Lines({ rows }) {
  const r = rows.filter(([, v]) => has(v));
  if (!r.length) return <p className="cv-empty">(chưa khai)</p>;
  return (
    <ol className="cv-lines">
      {r.map(([k, v]) => <li key={k}><span className="cv-k">{k}:</span> <span className="cv-v">{v}</span></li>)}
    </ol>
  );
}

function Prose({ rows, alone }) {
  const r = rows.filter(([, v]) => has(v));
  if (!r.length) return alone ? <p className="cv-empty">(chưa khai)</p> : null;
  return r.map(([k, v]) => (
    <div key={k} className="cv-prose">
      <p className="cv-k">{k}:</p>
      {String(v).split(/\n{2,}/).map((t, i) => <p key={i} className="cv-v">{t}</p>)}
    </div>
  ));
}

export function Paper({ kicker, title, sub, photo, children, sign, date, sealed, badge }) {
  const { docs } = useUi();
  return (
    <article className={'cv ' + (docs === 'text' ? 'doc-text' : 'doc-paper')}>
      <header className="cv-head">
        <div className="cv-org">
          <p>BÁN LỘ TRỪ MA</p>
          <p className="small">{kicker}</p>
        </div>
        <div className="cv-motto"><p>Âm – Dương – Trấn – Khế</p><p className="small">Trừ tà · Độ vong · Giữ người</p></div>
      </header>
      <div className="cv-title-row">
        <div className="cv-title">
          <h2>SƠ YẾU LÝ LỊCH</h2>
          <p className="cv-sub">{sub}</p>
          {badge}
        </div>
        <div className="cv-photo">{photo || <span>Ảnh<br />3 × 4</span>}</div>
      </div>
      <p className="cv-name">{title}</p>
      {children}
      <footer className="cv-sign">
        <p className="cv-oath">Tôi xin cam đoan những lời khai trên là đúng sự thật, nếu sai tôi xin chịu trách nhiệm trước âm phủ và dương gian.</p>
        <div className="cv-sign-row">
          <div className="cv-gm">
            <p>Xác nhận của GM</p>
            {sealed && <span className="cv-seal" aria-label="Đã đóng dấu">BÁN LỘ<br />TRỪ MA<br /><small>ĐÃ LƯU</small></span>}
          </div>
          <div className="cv-me">
            <p className="small">{ngay(date)}</p>
            <p>Người khai</p>
            <p className="cv-hand">{sign}</p>
          </div>
        </div>
      </footer>
    </article>
  );
}

export function Sec({ n, title, children }) {
  return (
    <section className="cv-sec">
      <h3><span>{roman[n] || n}.</span> {title}</h3>
      {children}
    </section>
  );
}

// ---------- PC ----------
export function PcDossier({ char, player }) {
  const d = normalizeSheet(char.data);
  const x = derive(d);
  const photo = d.chan_dung?.path ? <Img path={d.chan_dung.path} alt={'Chân dung ' + (d.ten || char.name)} /> : null;
  const spells = (d.phep || []).length;
  return (
    <Paper kicker="Hồ sơ nhân vật" title={d.ten || char.name} sub="(tự khai)" photo={photo} sign={d.ten || char.name} date={char.updated_at} sealed
           badge={d.can ? <p className="cv-star">★ Có Căn: {d.can}</p> : null}>
      <Sec n={0} title="SƠ LƯỢC BẢN THÂN">
        <Lines rows={[
          ['Họ và tên', d.ten || char.name], ['Giới tính', d.gioi_tinh], ['Tuổi', has(d.tuoi) ? d.tuoi + (has(d.tho) ? ` (thọ ${d.tho})` : '') : ''],
          ['Quê quán', d.que_quan], ['Nơi ở hiện nay', d.noi_o], ['Mệnh', d.menh], ['Tôn giáo, đạo', d.ton_giao],
          ['Nghề nghiệp đời thường', d.nghe], ['Trường, nhánh', [d.truong, d.nhanh].filter(Boolean).join(' · ')],
          ['Cấp bậc', has(d.cap) ? 'Cấp ' + d.cap : ''], ['Căn', d.can], ['Duyên vào nghề', d.duyen], ['Giới (điều kiêng)', d.gioi],
          ['Người chơi', d.nguoi_choi],
        ]} />
      </Sec>
      <Sec n={1} title="QUAN HỆ – ÂN OÁN">
        <Lines rows={[['Ba người tôi thương', d.ba_nguoi_thuong], ['Một món nợ chưa trả', d.mon_no], ['Người đã khuất chưa buông được', d.nguoi_da_khuat]]} />
        <Prose rows={[['Ân oán với người âm, thần thánh', d.an_oan]]} />
      </Sec>
      <Sec n={2} title="QUÁ TRÌNH BẢN THÂN">
        <Prose alone rows={[['Vì sao thấy được ma', d.vi_sao_thay_ma], ['Ngoại hình', d.ngoai_hinh], ['Tiểu sử', d.tieu_su]]} />
      </Sec>
      <Sec n={3} title="NĂNG LỰC CHUYÊN MÔN">
        <table className="cv-table">
          <thead><tr>{STATS.map((s) => <th key={s.k} scope="col">{s.name}</th>)}</tr></thead>
          <tbody><tr>{STATS.map((s) => <td key={s.k}><b>{d.stats[s.k] ?? '–'}</b><small>{fmt(x.mods[s.k])}</small></td>)}</tr></tbody>
        </table>
        <Lines rows={[
          ['Máu tối đa', x.hpMax], ['Giáp (AC)', x.ac], ['Linh tối đa', x.linhMax], ['DC linh thuật', x.dc],
          ['Lục Tính', (d.luc_tinh || []).join(', ')], ['Số phép đã chép', spells ? spells + ' phép' : ''],
        ]} />
      </Sec>
      <Sec n={4} title="KHEN THƯỞNG – KỶ LUẬT">
        <Lines rows={[
          ['Phúc', `${d.phuc}/10` + (x.tuyetPhuc ? ' · Tuyệt Phúc' : '')],
          ['Vía đã mất', x.lost ? `${x.lost}/7` : 'chưa mất vía nào'],
          ['Năm thọ đã hao', d.tho_hao || ''], ['Hạn sắp tới', d.han],
        ]} />
      </Sec>
      <Sec n={5} title="TÀI SẢN, PHÁP BẢO">
        <Prose alone rows={[['Pháp bảo', d.phap_bao], ['Hành trang', d.hanh_trang]]} />
      </Sec>
    </Paper>
  );
}

// ---------- NPC (mục trong kho, loại npc) ----------
const NPC_SKIP = new Set(['hinh']);
const lab = (k) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export function NpcDossier({ e }) {
  const d = e.data || {};
  const pics = Array.isArray(d.hinh) ? d.hinh : [];
  const rows = Object.entries(d).filter(([k, v]) => !NPC_SKIP.has(k) && (typeof v !== 'object' || Array.isArray(v)))
    .map(([k, v]) => [lab(k), Array.isArray(v) ? v.join(', ') : v === true ? 'có' : v]);
  return (
    <Paper kicker="Hồ sơ nhân vật" title={e.name} sub="(tự khai)" sign={e.name}
           badge={canOf(d) ? <p className="cv-star">★ Có Căn: {canOf(d)}</p> : null}
           photo={pics[0] ? <Img path={pics[0].path} alt={pics[0].alt || 'Chân dung ' + e.name} /> : null} date={e.updated_at} sealed>
      <Sec n={0} title="SƠ LƯỢC BẢN THÂN">
        <Lines rows={[['Họ và tên', e.name], ['Lời ngắn', e.summary], ...rows]} />
      </Sec>
      <Sec n={1} title="QUÁ TRÌNH BẢN THÂN">
        <Prose alone rows={[['Tiểu sử', e.body]]} />
      </Sec>
      {pics.length > 1 && (
        <Sec n={2} title="ẢNH KÈM HỒ SƠ">
          <Gallery items={pics.slice(1)} />
        </Sec>
      )}
    </Paper>
  );
}
