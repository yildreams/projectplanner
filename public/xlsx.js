// Zero-dependency .xlsx writer for the project planner (inline strings, styles, merges, zip).
// Runs in Node (server-side export) and in the browser (static hosting such as GitHub Pages).
(() => {
'use strict';

/* ---------- zip (Node: deflate via zlib; browser: stored entries, still a valid .xlsx) ---------- */
const deflate = typeof require === 'function' ? require('zlib').deflateRawSync : null;
const utf8 = s => new TextEncoder().encode(s);
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const concat = arrs => { const out = new Uint8Array(arrs.reduce((a, x) => a + x.length, 0)); let o = 0; for (const x of arrs) { out.set(x, o); o += x.length; } return out; };
function zip(files) {
  const parts = [], central = []; let offset = 0;
  const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const method = deflate ? 8 : 0;
  for (const f of files) {
    const name = utf8(f.name), raw = utf8(f.data), comp = deflate ? new Uint8Array(deflate(raw)) : raw, crc = crc32(raw);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, method, true); lh.setUint16(10, time, true); lh.setUint16(12, date, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, comp.length, true); lh.setUint32(22, raw.length, true); lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, comp);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, comp.length, true); ch.setUint32(24, raw.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + comp.length;
  }
  const cd = concat(central), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cd.length, true); end.setUint32(16, offset, true);
  return concat([...parts, cd, new Uint8Array(end.buffer)]);
}

/* ---------- xlsx primitives ---------- */
const esc = s => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

class Registry {
  constructor() {
    this.fonts = [];
    this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    this.xfs = []; this.map = new Map(); this.numFmts = [];
    this.xf({});
  }
  idx(arr, xml) { let i = arr.indexOf(xml); if (i < 0) { arr.push(xml); i = arr.length - 1; } return i; }
  numFmt(code) { return code ? 164 + this.idx(this.numFmts, code) : 0; }
  font(f = {}) { return this.idx(this.fonts, `<font>${f.b ? '<b/>' : ''}${f.i ? '<i/>' : ''}${f.u ? '<u/>' : ''}<sz val="${f.sz || 10}"/><color rgb="FF${f.c || '23233F'}"/><name val="Arial"/><family val="2"/></font>`); }
  fill(c) { return c ? this.idx(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`) : 0; }
  border(bd) {
    if (!bd) return 0;
    const side = (n, k) => bd[k] ? `<${n} style="${bd[k][0]}"><color rgb="FF${bd[k][1]}"/></${n}>` : `<${n}/>`;
    return this.idx(this.borders, `<border>${side('left', 'l')}${side('right', 'r')}${side('top', 't')}${side('bottom', 'b')}<diagonal/></border>`);
  }
  xf(s = {}) {
    const key = JSON.stringify(s); if (this.map.has(key)) return this.map.get(key);
    const al = `<alignment${s.h ? ` horizontal="${s.h}"` : ''} vertical="${s.v || 'center'}"${s.wrap ? ' wrapText="1"' : ''}${s.indent ? ` indent="${s.indent}"` : ''}/>`;
    const nf = this.numFmt(s.nf);
    const xml = `<xf numFmtId="${nf}" fontId="${this.font(s.f)}" fillId="${this.fill(s.fill)}" borderId="${this.border(s.bd)}" xfId="0"${nf ? ' applyNumberFormat="1"' : ''} applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${al}</xf>`;
    this.xfs.push(xml); const i = this.xfs.length - 1; this.map.set(key, i); return i;
  }
  xml() {
    const blk = (tag, arr) => `<${tag} count="${arr.length}">${arr.join('')}</${tag}>`;
    const nfs = this.numFmts.length ? `<numFmts count="${this.numFmts.length}">${this.numFmts.map((c, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(c)}"/>`).join('')}</numFmts>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${NS}">${nfs}${blk('fonts', this.fonts)}${blk('fills', this.fills)}${blk('borders', this.borders)}` +
      `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>${blk('cellXfs', this.xfs)}` +
      `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }
}

class Sheet {
  constructor(name) { this.name = name; this.cells = new Map(); this.merges = []; this.heights = new Map(); this.widths = []; this.freeze = null; this.grid = true; this.filter = null; this.links = []; this.tab = null; this.footer = null; }
  cell(r, c, o) { this.cells.set(r * 1000 + c, o); }
  range(r1, c1, r2, c2, o) {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) this.cell(r, c, { s: o.s });
    this.cell(r1, c1, o);
    if (r2 > r1 || c2 > c1) this.merges.push(`${colName(c1)}${r1}:${colName(c2)}${r2}`);
  }
  height(r, h) { this.heights.set(r, h); }
  xml(first) {
    const rows = new Map(); let maxR = 1, maxC = 1;
    for (const [k, o] of this.cells) { const r = Math.floor(k / 1000), c = k % 1000; if (!rows.has(r)) rows.set(r, []); rows.get(r).push([c, o]); maxR = Math.max(maxR, r); maxC = Math.max(maxC, c); }
    for (const r of this.heights.keys()) { if (!rows.has(r)) rows.set(r, []); maxR = Math.max(maxR, r); }
    const run = x => `<r><rPr>${x.b ? '<b/>' : ''}${x.i ? '<i/>' : ''}<sz val="${x.sz || 10}"/><color rgb="FF${x.c || '23233F'}"/><rFont val="Arial"/><family val="2"/></rPr><t xml:space="preserve">${esc(x.t)}</t></r>`;
    const cellXml = (r, c, o) => {
      const ref = colName(c) + r, s = o.s ? ` s="${o.s}"` : '';
      if (o.rich) return `<c r="${ref}"${s} t="inlineStr"><is>${o.rich.map(run).join('')}</is></c>`;
      if (o.v !== undefined && o.v !== null && o.v !== '') return typeof o.v === 'number' ? `<c r="${ref}"${s}><v>${o.v}</v></c>` : `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(o.v)}</t></is></c>`;
      return `<c r="${ref}"${s}/>`;
    };
    let data = '';
    for (const r of [...rows.keys()].sort((a, b) => a - b)) {
      const h = this.heights.get(r), cs = rows.get(r).sort((a, b) => a[0] - b[0]);
      data += `<row r="${r}"${h ? ` ht="${h}" customHeight="1"` : ''}>${cs.map(([c, o]) => cellXml(r, c, o)).join('')}</row>`;
    }
    let pane = '';
    if (this.freeze) {
      const { x, y } = this.freeze, act = x && y ? 'bottomRight' : y ? 'bottomLeft' : 'topRight';
      pane = `<pane${x ? ` xSplit="${x}"` : ''}${y ? ` ySplit="${y}"` : ''} topLeftCell="${colName(x + 1)}${y + 1}" activePane="${act}" state="frozen"/><selection pane="${act}"/>`;
    }
    const cols = this.widths.length ? `<cols>${this.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS}"><sheetPr>${this.tab ? `<tabColor rgb="FF${this.tab}"/>` : ''}<pageSetUpPr fitToPage="1"/></sheetPr>` +
      `<dimension ref="A1:${colName(maxC)}${maxR}"/><sheetViews><sheetView workbookViewId="0"${this.grid ? '' : ' showGridLines="0"'}${first ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews>` +
      `<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${data}</sheetData>` +
      (this.filter ? `<autoFilter ref="${this.filter}"/>` : '') +
      (this.merges.length ? `<mergeCells count="${this.merges.length}">${this.merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '') +
      (this.links.length ? `<hyperlinks>${this.links.map(([ref, loc, disp]) => `<hyperlink ref="${ref}" location="${esc(loc)}" display="${esc(disp)}"/>`).join('')}</hyperlinks>` : '') +
      `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>` +
      (this.footer ? `<headerFooter><oddFooter>${esc(this.footer)}</oddFooter></headerFooter>` : '') + '</worksheet>';
  }
}

/* ---------- input ---------- */
function sanitize(p) {
  p = p && typeof p === 'object' ? p : {};
  const num = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, Math.round(v))) : d; };
  const col = (c, d = '#FFFFFF') => /^#[0-9a-f]{6}$/i.test(c) ? c : d;
  const str = (s, n = 500) => String(s ?? '').slice(0, n);
  const obj = x => x && typeof x === 'object';
  const out = { lang: p.lang === 'tr' ? 'tr' : 'en', title: str(p.title, 200), start: /^\d{4}-\d\d-\d\d$/.test(p.start) ? p.start : '2026-10-01', sprintDays: num(p.sprintDays, 1, 60, 14), sprints: num(p.sprints, 1, 52, 12) };
  out.rows = (Array.isArray(p.rows) ? p.rows : []).filter(obj).slice(0, 100).map(r => ({ label: str(r.label, 200), sub: str(r.sub, 300), lanes: num(r.lanes, 1, 20, 1) }));
  if (!out.rows.length) out.rows = [{ label: '', sub: '', lanes: 1 }];
  const LN = out.rows.reduce((a, r) => a + r.lanes, 0);
  out.items = (Array.isArray(p.items) ? p.items : []).filter(obj).slice(0, 2000).map(i => {
    const c = num(i.col, 0, out.sprints - 1, 0), r = num(i.row, 0, LN - 1, 0);
    return { type: str(i.type, 20), title: str(i.title, 300), body: str(i.body, 500), notes: str(i.notes, 5000), color: col(i.color), col: c, row: r,
      w: num(i.w, 1, out.sprints - c, 1), h: num(i.h, 1, LN - r, 1) };
  });
  out.markers = (Array.isArray(p.markers) ? p.markers : []).filter(m => obj(m) && /^\d{4}-\d\d-\d\d$/.test(m.date)).slice(0, 200).map(m => ({ date: m.date, label: str(m.label, 100), color: col(m.color, '#1F8F5F') }));
  return out;
}

const DICT = {
  en: { loc: 'en-GB', sprint: 'Sprint', dateLines: 'Date lines', today: 'Today', details: 'Details', row: 'Row', component: 'Component', type: 'Type', sprints: 'Sprints', start: 'Start', end: 'End', barText: 'Bar text', content: 'Content', dateLine: 'Date line', exported: 'Exported', days: 'days', plan: 'Plan', detailsSheet: 'Details', noContent: 'No content yet.', sprintLen: 'sprints', dur: 'Days',
    types: { build: 'Build', design: 'Design', test: 'E2E & UAT', golive: 'Go-live', rollout: 'Rollout & parallel run', demo: 'Demo', note: 'Note', freeze: 'Freeze (TBC)' } },
  tr: { loc: 'tr-TR', sprint: 'Sprint', dateLines: 'Tarih çizgileri', today: 'Bugün', details: 'Detaylar', row: 'Satır', component: 'Bileşen', type: 'Tür', sprints: 'Sprintler', start: 'Başlangıç', end: 'Bitiş', barText: 'Çubuk metni', content: 'İçerik', dateLine: 'Tarih çizgisi', exported: 'Dışa aktarım', days: 'gün', plan: 'Plan', detailsSheet: 'Detaylar', noContent: 'Henüz içerik yok.', sprintLen: 'sprint', dur: 'Gün',
    types: { build: 'Geliştirme', design: 'Tasarım', test: 'E2E & UAT', golive: 'Go-live', rollout: 'Yaygınlaştırma & paralel çalışma', demo: 'Demo', note: 'Not', freeze: 'Dondurma (TBD)' } }
};

const NAVY = '23233F', OR = 'E8883B', LINE = 'DCDBE6', GRID = 'EEEDF4', GROUP = 'C9C7D8', MUTE = '6B6B82';
const hex = c => c.slice(1).toUpperCase();
const lum = h => { const n = parseInt(h, 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
const ink = h => lum(h) > 150 ? NAVY : 'FFFFFF';
const accent = h => lum(h) > 225 ? OR : h;
const lines = it => it.notes.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const box = (st, c) => ({ l: [st, c], r: [st, c], t: [st, c], b: [st, c] });

/* ---------- workbook ---------- */
function buildXlsx(input) {
  const plan = sanitize(input), L = DICT[plan.lang], reg = new Registry();
  const N = plan.sprints, s0 = new Date(plan.start + 'T00:00:00'), SPR = plan.sprintDays * 864e5;
  // each sprint is split into K narrow sub-columns so date lines land within a day or two of their real position
  const K = Math.min(plan.sprintDays, 7), NC = N * K, last = NC + 1, sc = s => 2 + s * K;
  const sd = i => { const d = new Date(s0); d.setDate(d.getDate() + i * plan.sprintDays); return d; };
  const fmt = (d, o) => d.toLocaleDateString(L.loc, o);
  const serial = d => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 864e5;
  const dm = { day: 'numeric', month: 'short' }, dmy = { day: 'numeric', month: 'short', year: 'numeric' };
  const groupOf = [], laneEnd = new Set(); let total = 0;
  plan.rows.forEach((r, gi) => { for (let k = 0; k < r.lanes; k++) groupOf.push(gi); total += r.lanes; laneEnd.add(total - 1); });
  const rowStart = plan.rows.map((_, gi) => groupOf.indexOf(gi));
  const taken = new Set();   // drop overlapping items so merged ranges can never collide (Excel would flag the file as corrupt)
  const sorted = [...plan.items].sort((a, b) => a.row - b.row || a.col - b.col).filter(it => {
    const keys = []; for (let r = it.row; r < it.row + it.h; r++) for (let c = it.col; c < it.col + it.w; c++) keys.push(r * 1000 + c);
    if (keys.some(k => taken.has(k))) return false; keys.forEach(k => taken.add(k)); return true;
  });
  const span = it => it.w === 1 ? `${L.sprint} ${it.col + 1}` : `${L.sprint} ${it.col + 1}–${it.col + it.w}`;
  const itemStart = it => sd(it.col), itemEnd = it => { const d = sd(it.col + it.w); d.setDate(d.getDate() - 1); return d; };
  const title = plan.title || 'Project Plan', footer = `&L${title.replace(/&/g, '&&')}&R&P / &N`;

  /* ===== Plan sheet ===== */
  const sh = new Sheet(L.plan); sh.grid = false; sh.tab = OR; sh.footer = footer;
  sh.widths = [30, ...Array(NC).fill(+(((7 * 15 + 5) / K - 5) / 7).toFixed(2))];   // one sprint ≈ one 15-char column
  const end = sd(N); end.setDate(end.getDate() - 1);
  sh.range(1, 1, 1, last, { v: title, s: reg.xf({ f: { b: 1, sz: 20 }, h: 'left', bd: { b: ['medium', OR] } }) }); sh.height(1, 38);
  sh.range(2, 1, 2, last, { v: `${fmt(s0, dmy)} – ${fmt(end, dmy)}  ·  ${N} ${L.sprintLen} × ${plan.sprintDays} ${L.days}  ·  ${L.exported} ${fmt(new Date(), dmy)}`, s: reg.xf({ f: { sz: 9, c: MUTE, i: 1 }, h: 'left' }) }); sh.height(2, 18);
  sh.height(3, 8);
  const navyCell = { f: { b: 1, sz: 11, c: 'FFFFFF' }, fill: NAVY, h: 'center', bd: { r: ['thin', '3A3A5C'] } };
  sh.range(4, 1, 5, 1, { v: '', s: reg.xf({ fill: NAVY }) });
  for (let i = 0; i < N;) {
    const d = sd(i), key = d.getFullYear() * 12 + d.getMonth(); let j = i;
    while (j + 1 < N) { const e = sd(j + 1); if (e.getFullYear() * 12 + e.getMonth() !== key) break; j++; }
    const m = fmt(d, { month: 'long', year: 'numeric' });
    sh.range(4, sc(i), 4, sc(j + 1) - 1, { v: m.charAt(0).toUpperCase() + m.slice(1), s: reg.xf(navyCell) });
    i = j + 1;
  }
  sh.height(4, 22);
  const now = new Date(), nx = (now - s0) / SPR, todaySprint = nx >= 0 && nx < N ? Math.floor(nx) : -1;
  for (let i = 0; i < N; i++) {
    const cur = i === todaySprint, c = cur ? 'A85A14' : NAVY;
    sh.range(5, sc(i), 5, sc(i + 1) - 1, { rich: [{ t: `${L.sprint} ${i + 1}`, b: 1, sz: 10, c }, { t: '\n' + fmt(sd(i), dm), sz: 8, c: cur ? 'A85A14' : MUTE }], s: reg.xf({ fill: cur ? 'FDE3C8' : 'ECEBF3', h: 'center', wrap: 1, bd: { r: ['thin', LINE] } }) });
  }
  sh.height(5, 32);

  // date lines (markers + today): a labelled band above the lanes, then a vertical line through every lane
  const dl = plan.markers.map(m => ({ label: m.label, date: new Date(m.date + 'T00:00:00'), color: hex(m.color), st: 'medium' }));
  if (todaySprint >= 0) dl.push({ label: L.today, date: now, color: OR, st: 'mediumDashed' });
  const vis = dl.filter(m => m.date >= s0).map(m => ({ ...m, b: Math.round((m.date - s0) / SPR * K) })).filter(m => m.b <= NC).sort((a, b) => a.b - b.b);
  const lineAt = new Map(); vis.forEach(m => { if (!lineAt.has(m.b)) lineAt.set(m.b, m); });
  const vline = (j, bd) => {   // j = 0-based sub-column; a line at boundary b is the left edge of sub-column b
    const a = lineAt.get(j), z = lineAt.get(j + 1);
    if (a) bd.l = [a.st, a.color];
    if (z) bd.r = [z.st, z.color];
    return bd;
  };
  const gridR = j => (j % K === K - 1 ? ['thin', GRID] : undefined);
  const bands = [];   // labels are one sprint wide; ones that would overlap go to the next band row
  vis.forEach(m => {
    const c1 = Math.min(m.b, NC - K), c2 = c1 + K - 1;
    let band = bands.find(b => b.every(([a, z]) => c2 < a || c1 > z));
    if (!band) bands.push(band = []);
    band.push([c1, c2, m]);
  });
  if (bands.length) sh.range(6, 1, 5 + bands.length, 1, { v: L.dateLines, s: reg.xf({ f: { b: 1, sz: 10, c: 'A85A14' }, fill: 'FFF4E8', h: 'center', wrap: 1, bd: { b: ['thin', LINE], r: ['medium', LINE] } }) });
  bands.forEach((band, k) => {
    const r = 6 + k, lastBand = k === bands.length - 1;
    for (let j = 0; j < NC; j++) sh.cell(r, j + 2, { s: reg.xf({ fill: 'FFF4E8', bd: vline(j, { r: gridR(j), b: lastBand ? ['thin', LINE] : undefined }) }) });
    band.forEach(([c1, c2, m]) => sh.range(r, c1 + 2, r, c2 + 2, {
      rich: [{ t: m.label, b: 1, sz: 9, c: ink(m.color) }, { t: '\n' + fmt(m.date, dm), sz: 8, c: ink(m.color) }],
      s: reg.xf({ fill: m.color, h: 'left', indent: 1, wrap: 1, bd: { l: ['medium', m.color], t: ['thin', 'FFF4E8'], b: ['thin', lastBand ? LINE : 'FFF4E8'] } })
    }));
    sh.height(r, 30);
  });
  const base = 6 + bands.length;

  // lanes: empty cells first
  for (let ln = 0; ln < total; ln++) {
    const lastLane = laneEnd.has(ln);
    sh.height(base + ln, 48);
    for (let j = 0; j < NC; j++) sh.cell(base + ln, j + 2, { s: reg.xf({ bd: vline(j, { r: gridR(j), b: lastLane ? ['medium', GROUP] : ['thin', GRID] }) }) });
  }
  plan.rows.forEach((r, gi) => {
    const r1 = base + rowStart[gi], r2 = r1 + r.lanes - 1, rich = [{ t: r.label, b: 1, sz: 12 }];
    if (r.sub) rich.push({ t: '\n' + r.sub, sz: 9, c: MUTE });
    sh.range(r1, 1, r2, 1, { rich, s: reg.xf({ h: 'center', wrap: 1, bd: { r: ['medium', LINE], b: ['medium', GROUP] } }) });
  });
  for (const it of sorted) {
    const r1 = base + it.row, r2 = r1 + it.h - 1, gl = it.type === 'golive' && it.color.toUpperCase() === '#FFFFFF', fill = hex(it.color), fc = gl ? OR : ink(fill);
    const rich = [{ t: (it.type === 'golive' ? '◆ ' : '') + it.title, b: 1, sz: 10, c: fc }];
    if (it.body) rich.push({ t: '\n' + it.body, sz: 9, c: fc });
    const bd = gl ? box('medium', OR) : { l: ['thin', 'FFFFFF'], r: ['thin', 'FFFFFF'], t: ['thin', 'FFFFFF'], b: laneEnd.has(it.row + it.h - 1) ? ['medium', GROUP] : ['thin', 'FFFFFF'] };
    sh.range(r1, sc(it.col), r2, sc(it.col + it.w) - 1, { rich, s: reg.xf({ fill: gl ? 'FFFFFF' : fill, h: 'left', indent: 1, wrap: 1, bd }) });
  }
  const planRef = it => `'${L.plan}'!${colName(sc(it.col))}${base + it.row}`;

  // details boxes
  let row = base + total;
  sh.height(row, 16); row++;
  const withNotes = sorted.filter(i => lines(i).length);
  sh.range(row, 1, row, last, { v: `${L.details} (${withNotes.length})`, s: reg.xf({ f: { b: 1, sz: 14 }, h: 'left', bd: { b: ['medium', OR] } }) }); sh.height(row, 28); row++;
  sh.height(row, 8); row++;
  if (!withNotes.length) {
    sh.range(row, 2, row, last, { v: L.noContent, s: reg.xf({ f: { i: 1, c: MUTE }, h: 'left' }) }); row++;
  }
  const perBand = N >= 10 ? 3 : N >= 6 ? 2 : 1, boxW = Math.max(1, Math.floor((N - (perBand - 1)) / perBand)), cpl = Math.max(8, Math.floor(boxW * 15 * 1.05) - 4);
  for (let b = 0; b < withNotes.length; b += perBand) {
    const band = withNotes.slice(b, b + perBand), maxL = Math.max(...band.map(x => lines(x).length));
    const hts = Array.from({ length: maxL }, (_, i) => Math.max(...band.map(x => { const t = lines(x)[i]; return t ? Math.max(1, Math.ceil((t.length + 2) / cpl)) : 1; })));
    sh.height(row, 24); sh.height(row + 1, 16); hts.forEach((h, i) => sh.height(row + 2 + i, 14 * h + 4));
    band.forEach((it, k) => {
      const c1 = sc(k * (boxW + 1)), c2 = sc(k * (boxW + 1) + boxW) - 1, fill = hex(it.color), gl = it.type === 'golive' && fill === 'FFFFFF', ac = accent(fill);
      const side = { l: ['medium', ac], r: ['thin', LINE] };
      sh.range(row, c1, row, c2, { v: (it.type === 'golive' ? '◆ ' : '') + it.title, s: reg.xf({ f: { b: 1, sz: 11, c: gl ? OR : ink(fill) }, fill, h: 'left', indent: 1, bd: { ...side, t: ['thin', LINE] } }) });
      sh.range(row + 1, c1, row + 1, c2, { v: `${plan.rows[groupOf[it.row]].label} · ${span(it)} · ${fmt(itemStart(it), dm)} – ${fmt(itemEnd(it), dm)}`, s: reg.xf({ f: { sz: 9, c: MUTE }, fill: 'F6F5F9', h: 'left', indent: 1, bd: side }) });
      const ls = lines(it);
      for (let i = 0; i < maxL; i++) {
        const lastRow = i === maxL - 1;
        sh.range(row + 2 + i, c1, row + 2 + i, c2, { v: ls[i] ? '• ' + ls[i] : '', s: reg.xf({ f: { sz: 10 }, fill: 'FFFFFF', h: 'left', indent: 1, wrap: 1, v: 'top', bd: { ...side, b: lastRow ? ['thin', LINE] : undefined } }) });
      }
    });
    row += 2 + maxL; sh.height(row, 12); row++;
  }
  sh.freeze = { x: 1, y: base - 1 };

  /* ===== Details sheet ===== */
  const ds = new Sheet(L.detailsSheet); ds.tab = NAVY; ds.footer = footer;
  ds.widths = [5, 26, 32, 22, 14, 14, 14, 8, 28, 64];
  const head = [['#', 'center'], [L.row, 'left'], [L.component, 'left'], [L.type, 'center'], [L.sprints, 'center'], [L.start, 'center'], [L.end, 'center'], [L.dur, 'center'], [L.barText, 'left'], [L.content, 'left']];
  head.forEach(([t, h], i) => ds.cell(1, i + 1, { v: t, s: reg.xf({ f: { b: 1, c: 'FFFFFF' }, fill: NAVY, h, indent: h === 'left' ? 1 : 0, bd: { r: ['thin', '3A3A5C'] } }) }));
  ds.height(1, 26);
  let r = 2;
  const z = n => (n % 2 ? 'F6F5F9' : 'FFFFFF'), DF = 'd mmm yyyy';
  sorted.forEach((it, n) => {
    const ls = lines(it), fill = hex(it.color), gl = it.type === 'golive' && fill === 'FFFFFF', bg = z(n), bd = { b: ['thin', GRID] };
    const base = { fill: bg, bd, wrap: 1, v: 'center' }, s = itemStart(it), e = itemEnd(it);
    ds.height(r, Math.max(22, ls.length * 14 + 8));
    ds.cell(r, 1, { v: n + 1, s: reg.xf({ ...base, f: { c: MUTE }, h: 'center' }) });
    ds.cell(r, 2, { v: plan.rows[groupOf[it.row]].label, s: reg.xf({ ...base, f: { b: 1 }, h: 'left', indent: 1 }) });
    ds.cell(r, 3, { v: it.title, s: reg.xf({ ...base, f: { b: 1, u: 1, c: '2B5FD9' }, h: 'left', indent: 1 }) });
    ds.links.push([`C${r}`, planRef(it), it.title]);
    ds.cell(r, 4, { v: L.types[it.type] || it.type, s: reg.xf({ ...base, f: { b: 1, sz: 9, c: gl ? OR : ink(fill) }, fill, bd: gl ? box('thin', OR) : { ...bd, l: ['thin', 'FFFFFF'], r: ['thin', 'FFFFFF'] }, h: 'center' }) });
    ds.cell(r, 5, { v: span(it), s: reg.xf({ ...base, h: 'center' }) });
    ds.cell(r, 6, { v: serial(s), s: reg.xf({ ...base, h: 'center', nf: DF }) });
    ds.cell(r, 7, { v: serial(e), s: reg.xf({ ...base, h: 'center', nf: DF }) });
    ds.cell(r, 8, { v: serial(e) - serial(s) + 1, s: reg.xf({ ...base, h: 'center' }) });
    ds.cell(r, 9, { v: it.body, s: reg.xf({ ...base, f: { c: MUTE }, h: 'left', indent: 1 }) });
    ds.cell(r, 10, { v: ls.map(l => '• ' + l).join('\n'), s: reg.xf({ ...base, h: 'left', indent: 1 }) });
    r++;
  });
  plan.markers.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((m, k) => {
    const n = sorted.length + k, bg = z(n), fill = hex(m.color), bd = { b: ['thin', GRID] }, base = { fill: bg, bd, wrap: 1, v: 'center' }, d = new Date(m.date + 'T00:00:00');
    ds.height(r, 22);
    ds.cell(r, 1, { v: n + 1, s: reg.xf({ ...base, f: { c: MUTE }, h: 'center' }) });
    ds.cell(r, 2, { v: '', s: reg.xf(base) });
    ds.cell(r, 3, { v: m.label, s: reg.xf({ ...base, f: { b: 1 }, h: 'left', indent: 1 }) });
    ds.cell(r, 4, { v: L.dateLine, s: reg.xf({ ...base, f: { b: 1, sz: 9, c: ink(fill) }, fill, bd: { ...bd, l: ['thin', 'FFFFFF'], r: ['thin', 'FFFFFF'] }, h: 'center' }) });
    ds.cell(r, 5, { v: '', s: reg.xf(base) });
    ds.cell(r, 6, { v: serial(d), s: reg.xf({ ...base, h: 'center', nf: DF }) });
    ds.cell(r, 7, { v: serial(d), s: reg.xf({ ...base, h: 'center', nf: DF }) });
    for (let c = 8; c <= 10; c++) ds.cell(r, c, { v: '', s: reg.xf(base) });
    r++;
  });
  ds.freeze = { x: 0, y: 1 }; ds.filter = `A1:J${Math.max(2, r - 1)}`;

  const sheets = [sh, ds];
  const q = s => `'${esc(s.replace(/'/g, "''"))}'`;
  const names = `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="1" hidden="1">${q(ds.name)}!$A$1:$J$${Math.max(2, r - 1)}</definedName>` +
    `<definedName name="_xlnm.Print_Titles" localSheetId="0">${q(sh.name)}!$A:$A,${q(sh.name)}!$4:$${base - 1}</definedName>` +
    `<definedName name="_xlnm.Print_Titles" localSheetId="1">${q(ds.name)}!$1:$1</definedName></definedNames>`;
  const stamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', CT = 'application/vnd.openxmlformats-';
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="${CT}package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${CT}officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${CT}officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="${CT}officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="${CT}package.core-properties+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>Project Planner</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${stamp}</dcterms:modified></cp:coreProperties>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS}" xmlns:r="${REL}"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${names}</workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>` },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: s.xml(i === 0) })),
    { name: 'xl/styles.xml', data: reg.xml() }
  ];
  return zip(files);
}

if (typeof module === 'object' && module.exports) module.exports = { buildXlsx }; else globalThis.buildXlsx = buildXlsx;
})();
