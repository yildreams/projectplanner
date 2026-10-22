/* One-page project planner – vanilla JS, grid with drag/drop/resize components */
const CW = 116, RH = 72, LW = 210, HH = 30, TH = 26, DAY = 864e5;
const TYPES = [
  { k: 'build',   c: '#23233f', w: 2, h: 1 },
  { k: 'design',  c: '#cfcbe0', w: 2, h: 1 },
  { k: 'test',    c: '#e8883b', w: 1, h: 1 },
  { k: 'golive',  c: '#ffffff', w: 1, h: 1 },
  { k: 'rollout', c: '#f3cfa8', w: 2, h: 1 },
  { k: 'demo',    c: '#fff4e8', w: 1, h: 1 },
  { k: 'note',    c: '#fff3b0', w: 2, h: 1 },
  { k: 'freeze',  c: '#e4e3ee', w: 1, h: 2 }
];
const SW = ['#23233f', '#e8883b', '#cfcbe0', '#f3cfa8', '#ffffff', '#fff3b0', '#bfe3c8', '#f4b6b6'];
const I18N = {
  en: { panel: 'Components', hint: 'Drag a component onto the grid, or click it to add automatically. Click a component to edit it and write its content. Hover a row name to split it into parallel lanes.',
    addRow: '+ Add row', start: 'Start date', days: 'Sprint days', count: 'Sprints', print: 'Print', name: 'Title', noteL: 'Bar text', notesL: 'Content · one item per line', details: 'Details', boxes: 'Boxes', list: 'List', noContent: 'No content yet. Click a component and write items in its content field.', exportX: 'Excel (.xlsx)', exportFail: 'Export failed.',
    exportM: 'Export', exportXs: 'Plan + details, sortable dates', exportP: 'PNG image', exportPs: 'High-resolution picture of the plan', copyP: 'Copy image', copyPs: 'Paste into slides, mail or chat', copied: 'Image copied to clipboard.', sprintsU: 'sprints', daysU: 'days',
    color: 'Color', size: 'Size (cols × rows)', dup: 'Duplicate', del: 'Delete', close: 'Close', today: 'Today', sprint: 'Sprint',
    rows: 'Rows', newRow: 'New row', rowName: 'Row name', rowSub: 'Subtitle', split: 'Split row (add a parallel lane)', merge: 'Remove last lane', marker: 'Date line', live: 'Live', mDate: 'Date', add: 'Add', ptitle: 'Project title', delRow: 'Delete row', noSpace: 'No free space for this component.',
    build: 'Build', design: 'Design', test: 'E2E & UAT', golive: 'Go-live', rollout: 'Rollout & parallel run', demo: 'Demo', note: 'Note', freeze: 'Freeze (TBC)' },
  tr: { panel: 'Bileşenler', hint: 'Bileşeni ızgaraya sürükleyip bırak ya da tıklayarak otomatik ekle. Düzenlemek ve içerik yazmak için bileşene tıkla. Satır adının üzerine gelip satırı paralel şeritlere bölebilirsin.',
    addRow: '+ Satır ekle', start: 'Başlangıç', days: 'Sprint günü', count: 'Sprint sayısı', print: 'Yazdır', name: 'Başlık', noteL: 'Çubuk metni', notesL: 'İçerik · her satır bir madde', details: 'Detaylar', boxes: 'Kutular', list: 'Liste', noContent: 'Henüz içerik yok. Bir bileşene tıkla ve içerik alanına madde yaz.', exportX: 'Excel (.xlsx)', exportFail: 'Dışa aktarım başarısız.',
    exportM: 'Dışa aktar', exportXs: 'Plan + detaylar, sıralanabilir tarihler', exportP: 'PNG görsel', exportPs: 'Planın yüksek çözünürlüklü görseli', copyP: 'Görseli kopyala', copyPs: 'Sunuma, maile ya da sohbete yapıştır', copied: 'Görsel panoya kopyalandı.', sprintsU: 'sprint', daysU: 'gün',
    color: 'Renk', size: 'Boyut (sütun × satır)', dup: 'Çoğalt', del: 'Sil', close: 'Kapat', today: 'Bugün', sprint: 'Sprint',
    rows: 'Satırlar', newRow: 'Yeni satır', rowName: 'Satır adı', rowSub: 'Alt metin', split: 'Satırı böl (paralel şerit ekle)', merge: 'Son şeridi kaldır', marker: 'Tarih çizgisi', live: 'Live', mDate: 'Tarih', add: 'Ekle', ptitle: 'Proje başlığı', delRow: 'Satırı sil', noSpace: 'Bu bileşen için boş yer yok.',
    build: 'Geliştirme', design: 'Tasarım', test: 'E2E & UAT', golive: 'Go-live', rollout: 'Yaygınlaştırma & paralel çalışma', demo: 'Demo', note: 'Not', freeze: 'Dondurma (TBD)' }
};

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => 'i' + Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const t = k => I18N[plan.lang][k] || k;
const byId = id => plan.items.find(i => i.id === id);
const linesOf = it => String(it.notes || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
let plan, sel = null, saveTimer;
const LN = () => plan.rows.reduce((a, r) => a + (r.lanes || 1), 0);
const groupStart = r => plan.rows.slice(0, r).reduce((a, x) => a + (x.lanes || 1), 0);
function insertLine(pos) { plan.items.forEach(i => { if (i.row >= pos) i.row++; else if (i.row + i.h > pos) i.h++; }); }
function removeLines(start, count) {
  plan.items = plan.items.filter(i => {
    const ov = Math.max(0, Math.min(i.row + i.h, start + count) - Math.max(i.row, start));
    if (ov >= i.h) return false;
    i.h -= ov;
    if (i.row >= start + count) i.row -= count; else if (i.row > start) i.row = start;
    return true;
  });
}

function seed() {
  const it = (type, title, col, row, w, h = 1, body = '', notes = '') => ({ id: uid(), type, title, body, notes, col, row, w, h, color: TYPES.find(x => x.k === type).c });
  const lang = (navigator.language || 'en').startsWith('tr') ? 'tr' : 'en', L = (en, tr) => lang === 'tr' ? tr : en;
  const rw = (label, sub, lanes) => ({ id: uid(), label, sub, lanes });
  // sample project, dated relative to today (start = Monday two weeks ago) so the demo never looks stale
  const s = new Date(); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - ((s.getDay() + 6) % 7) - 14);
  const day = n => { const d = new Date(s); d.setDate(d.getDate() + n); return d; };
  const short = n => day(n).toLocaleDateString(L('en-GB', 'tr-TR'), { day: 'numeric', month: 'short' });
  // item.row is a flat lane index: Discovery = 0, Backend = 1-2, Mobile app = 3-4, Launch = 5-6
  return {
    title: L('Mobile Ordering App', 'Mobil Sipariş Uygulaması'), lang, start: iso(s), sprintDays: 14, sprints: 12, ui: { boxes: true, list: true },
    markers: [{ id: uid(), date: iso(day(100)), label: L('Pilot', 'Pilot'), color: '#3a6df0' }, { id: uid(), date: iso(day(129)), label: L('Launch', 'Lansman'), color: '#1f8f5f' }],
    rows: [
      rw(L('Discovery & UX', 'Keşif & UX'), L('Research, flows, visual design', 'Araştırma, akışlar, görsel tasarım'), 1),
      rw(L('Backend & API', 'Backend & API'), L('Ordering, payments, loyalty', 'Sipariş, ödeme, sadakat'), 2),
      rw(L('Mobile app', 'Mobil uygulama'), L('iOS & Android', 'iOS & Android'), 2),
      rw(L('Launch', 'Lansman'), L('Pilot stores, then all stores', 'Önce pilot şubeler, sonra tümü'), 2)
    ],
    items: [
      it('design', L('User research', 'Kullanıcı araştırması'), 0, 0, 1, 1, '', L('Interviews with 12 regular customers\nBarista workshop\nCompetitor app review', '12 düzenli müşteriyle görüşme\nBarista atölyesi\nRakip uygulama incelemesi')),
      it('design', L('UX & visual design', 'UX & görsel tasarım'), 1, 0, 2, 1, '', L('Order and pick-up flows\nDesign system\nAccessibility review', 'Sipariş ve teslim alma akışları\nTasarım sistemi\nErişilebilirlik incelemesi')),
      it('demo', L('Prototype demo', 'Prototip demosu'), 3, 0, 1),
      it('build', L('Menu & ordering API', 'Menü & sipariş API'), 1, 1, 3, 1, '', L('Menu, prices and stock per store\nOrder status updates\nAdmin panel for store managers', 'Şube bazlı menü, fiyat ve stok\nSipariş durum bildirimleri\nŞube müdürleri için yönetim paneli')),
      it('build', L('Payments', 'Ödeme'), 4, 1, 2, 1, L('Card + wallet', 'Kart + cüzdan'), L('Card payments and 3-D Secure\nApple Pay / Google Pay\nRefunds', 'Kartla ödeme ve 3-D Secure\nApple Pay / Google Pay\nİadeler')),
      it('test', L('Load & security tests', 'Yük & güvenlik testleri'), 6, 1, 1),
      it('build', L('POS integration', 'POS entegrasyonu'), 2, 2, 2, 1, '', L('Orders print at the bar\nNightly stock sync', 'Siparişler bar yazıcısına düşer\nGece stok senkronizasyonu')),
      it('build', L('Loyalty points', 'Sadakat puanları'), 4, 2, 3, 1, L('Stamp card → points', 'Kaşe kartı → puan')),
      it('build', L('iOS & Android app', 'iOS & Android uygulaması'), 2, 3, 4, 1, L('One release per sprint', 'Her sprint bir sürüm'), L('Browse menu and customise drinks\nOrder ahead, pick a pick-up time\nPush notification when ready\nOrder history and reorder', 'Menüyü gez, içeceği özelleştir\nÖnceden sipariş, teslim saati seç\nHazır olunca bildirim\nSipariş geçmişi ve tekrar sipariş')),
      it('test', L('E2E & UAT', 'E2E & UAT'), 6, 3, 1, 1, '', L('Test with staff in two stores\nApp store review', 'İki şubede personelle test\nUygulama mağazası onayı')),
      it('golive', L('Pilot go-live', 'Pilot canlıya geçiş'), 7, 3, 1),
      it('freeze', L('Holiday freeze (TBC)', 'Tatil dönemi dondurma (TBD)'), 9, 3, 1, 2),
      it('demo', L('Sprint demo', 'Sprint demosu'), 3, 4, 1), it('demo', L('Sprint demo', 'Sprint demosu'), 5, 4, 1),
      it('rollout', L('Pilot in 3 stores', '3 şubede pilot'), 7, 5, 2, 1, '', L('Daily feedback from baristas\nFix-forward releases\nGo / no-go for full launch', 'Baristalardan günlük geri bildirim\nHızlı düzeltme sürümleri\nTam lansman için karar toplantısı')),
      it('golive', L('Launch ~' + short(129), 'Lansman ~' + short(129)), 9, 5, 1),
      it('rollout', L('Rollout to all stores', 'Tüm şubelere yaygınlaştırma'), 10, 5, 2),
      it('note', L('Marketing campaign', 'Pazarlama kampanyası'), 7, 6, 3, 1, L('Social, in-store, email', 'Sosyal medya, şube içi, e-posta'), L('Free drink with first app order\nPosters and table cards in stores\nLaunch email to loyalty members', 'İlk uygulama siparişine bedava içecek\nŞubelerde afiş ve masa kartı\nSadakat üyelerine lansman e-postası'))
    ]
  };
}

/* ---------- persistence ---------- */
const LS_KEY = 'planner.plan.v2';
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const body = JSON.stringify(plan);
    try { localStorage.setItem(LS_KEY, body); } catch {}
    fetch('/api/plan', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
  }, 300);
}
async function load() {
  let p = null;
  try { const r = await fetch('/api/plan'); if (r.ok) p = await r.json(); } catch {}
  if (!p) { try { p = JSON.parse(localStorage.getItem(LS_KEY)); } catch {} }
  try { localStorage.removeItem('plan'); } catch {}   // pre-v2 key held the old sample project
  plan = p && p.items ? p : seed();
  plan.rows.forEach(r => { r.lanes = r.lanes || 1; r.sub = r.sub || ''; });
  plan.markers = plan.markers || [];
  plan.ui = plan.ui || { boxes: true, list: true };
  plan.items.forEach(i => { i.notes = i.notes || ''; });
  init();
}

/* ---------- helpers ---------- */
const textColor = hex => {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#23233f' : '#ffffff';
};
const locale = () => plan.lang === 'tr' ? 'tr-TR' : 'en-GB';
let toastTimer;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 2500); }
const startDate = () => new Date(plan.start + 'T00:00:00');
function free(it, c, r, w, h) {
  if (c < 0 || r < 0 || c + w > plan.sprints || r + h > LN()) return false;
  return !plan.items.some(o => o !== it && c < o.col + o.w && c + w > o.col && r < o.row + o.h && r + h > o.row);
}
function firstFree(w, h, it) {
  for (let r = 0; r + h <= LN(); r++) for (let c = 0; c + w <= plan.sprints; c++) if (free(it, c, r, w, h)) return { c, r };
  return null;
}
function pos(el, it) {
  el.style.left = it.col * CW + 2 + 'px'; el.style.top = it.row * RH + 3 + 'px';
  el.style.width = it.w * CW - 4 + 'px'; el.style.height = it.h * RH - 6 + 'px';
}

/* ---------- rendering ---------- */
function render() {
  const g = $('#grid'), n = plan.sprints, R = LN(), s0 = startDate(), loc = locale();
  const root = document.documentElement.style;
  root.setProperty('--n', n); root.setProperty('--r', R);
  root.setProperty('--cw', CW + 'px'); root.setProperty('--rh', RH + 'px'); root.setProperty('--lw', LW + 'px');
  const sd = i => new Date(s0.getTime() + i * plan.sprintDays * DAY);
  let h = `<div class="corner"></div><div class="strip" style="grid-column:2/${n + 2}"></div>`;
  for (let i = 0; i < n;) {
    const d = sd(i), key = d.getFullYear() * 12 + d.getMonth();
    let j = i;
    while (j + 1 < n) { const e = sd(j + 1); if (e.getFullYear() * 12 + e.getMonth() !== key) break; j++; }
    h += `<div class="mh" style="grid-row:2;grid-column:${i + 2}/${j + 3}">${d.toLocaleDateString(loc, { month: 'long', year: 'numeric' })}</div>`;
    i = j + 1;
  }
  for (let i = 0; i < n; i++)
    h += `<div class="sh" data-s="${i}" style="grid-row:3;grid-column:${i + 2}">${esc(t('sprint'))} ${i + 1}<small>${sd(i).toLocaleDateString(loc, { day: 'numeric', month: 'short' })}</small></div>`;
  let line = 0;
  plan.rows.forEach((row, r) => {
    const L = row.lanes || 1;
    h += `<div class="rl" style="grid-row:${line + 4}/span ${L};grid-column:1">` +
      `<input class="rn" data-r="${r}" data-f="label" value="${esc(row.label)}" placeholder="${esc(t('rowName'))}" aria-label="${esc(t('rowName'))} ${r + 1}">` +
      `<textarea class="rs" rows="2" data-r="${r}" data-f="sub" placeholder="${esc(t('rowSub'))}" aria-label="${esc(t('rowSub'))} ${r + 1}">${esc(row.sub)}</textarea>` +
      `<div class="tools"><button data-a="split" data-r="${r}" title="${esc(t('split'))}" aria-label="${esc(t('split'))}">＋</button>` +
      (L > 1 ? `<button data-a="merge" data-r="${r}" title="${esc(t('merge'))}" aria-label="${esc(t('merge'))}">−</button>` : '') +
      `<button data-a="del" data-r="${r}" title="${esc(t('delRow'))}" aria-label="${esc(t('delRow'))}">×</button></div></div>`;
    for (let k = 0; k < L; k++) for (let c = 0; c < n; c++) h += `<div class="cell${k === L - 1 ? ' last' : ''}" style="grid-row:${line + k + 4};grid-column:${c + 2}"></div>`;
    line += L;
  });
  g.innerHTML = h + '<div id="layer"></div><div id="today"></div>';
  renderItems(); markToday(); renderMarkers();
}
function renderItems() {
  const layer = $('#layer'); layer.innerHTML = '';
  plan.items.forEach(it => {
    const el = document.createElement('div');
    el.className = 'item' + (it.type === 'golive' ? ' golive' : '') + (it.id === sel ? ' sel' : '');
    el.dataset.id = it.id;
    const fg = it.type === 'golive' && it.color.toLowerCase() === '#ffffff' ? '#e8883b' : textColor(it.color);
    el.style.background = it.color; el.style.color = fg;
    el.innerHTML = `<div class="it">${it.type === 'golive' ? '◆ ' : ''}${esc(it.title)}</div>${it.body ? `<div class="ib">${esc(it.body)}</div>` : ''}${linesOf(it).length ? `<span class="nb">≡ ${linesOf(it).length}</span>` : ''}<i class="rz e"></i><i class="rz s"></i><i class="rz se"></i>`;
    pos(el, it); layer.appendChild(el);
  });
  renderDetails();
}
/* ---------- details: boxes + list ---------- */
const lumOf = hex => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
const accentOf = c => lumOf(c) > 225 ? '#e8883b' : c;
const groupOfLine = line => { let a = 0; for (let r = 0; r < plan.rows.length; r++) { a += plan.rows[r].lanes || 1; if (line < a) return r; } return plan.rows.length - 1; };
const spanOf = it => it.w === 1 ? `${t('sprint')} ${it.col + 1}` : `${t('sprint')} ${it.col + 1}–${it.col + it.w}`;
function datesOf(it) {
  const f = startDate(), e = startDate(), o = { day: 'numeric', month: 'short' };
  f.setDate(f.getDate() + it.col * plan.sprintDays); e.setDate(e.getDate() + (it.col + it.w) * plan.sprintDays - 1);
  return f.toLocaleDateString(locale(), o) + ' – ' + e.toLocaleDateString(locale(), o);
}
function renderDetails() {
  const body = $('#dbody'); if (!body) return;
  const ui = plan.ui;
  document.querySelectorAll('.dv').forEach(b => b.classList.toggle('on', !!ui[b.dataset.v]));
  const sorted = [...plan.items].sort((a, b) => a.row - b.row || a.col - b.col);
  const withNotes = sorted.filter(i => linesOf(i).length);
  const boxes = withNotes.length ? withNotes.map(i => `<article class="box" data-id="${i.id}" tabindex="0" style="--c:${accentOf(i.color)}"><h4><i style="background:${i.color}"></i>${i.type === 'golive' ? '◆ ' : ''}${esc(i.title)}</h4><div class="meta">${esc(plan.rows[groupOfLine(i.row)].label)} · ${esc(spanOf(i))} · ${esc(datesOf(i))}</div><ul>${linesOf(i).map(l => `<li>${esc(l)}</li>`).join('')}</ul></article>`).join('') : `<p class="empty">${esc(t('noContent'))}</p>`;
  let list = '';
  plan.rows.forEach((row, r) => {
    const its = sorted.filter(i => groupOfLine(i.row) === r); if (!its.length) return;
    list += `<section class="lg"><h4>${esc(row.label)}${row.sub ? `<small>${esc(row.sub)}</small>` : ''}</h4><ul>${its.map(i => `<li data-id="${i.id}"><div class="lt"><i style="background:${i.color}"></i><b>${esc(i.title)}</b><span>${esc(spanOf(i))}</span></div>${linesOf(i).length ? `<ul>${linesOf(i).map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ul></section>`;
  });
  if (plan.markers.length) list += `<section class="lg"><h4>${esc(t('marker'))}</h4><ul>${[...plan.markers].sort((a, b) => a.date.localeCompare(b.date)).map(m => `<li><div class="lt"><i style="background:${m.color}"></i><b>${esc(m.label)}</b><span>${esc(new Date(m.date + 'T00:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }))}</span></div></li>`).join('')}</ul></section>`;
  body.className = 'dwrap' + (ui.boxes && ui.list ? ' both' : '');
  body.innerHTML = (ui.boxes ? `<div class="boxes">${boxes}</div>` : '') + (ui.list ? `<div class="lists">${list}</div>` : '');
}
function markToday() {
  const el = $('#today'); if (!el) return;
  const now = new Date(), x = (now - startDate()) / (plan.sprintDays * DAY) * CW;
  document.querySelectorAll('.sh.now').forEach(e => e.classList.remove('now'));
  if (x < 0 || x > plan.sprints * CW) { el.style.display = 'none'; return; }
  el.style.display = ''; el.style.left = LW + x + 'px';
  el.innerHTML = `<span>${esc(t('today'))} · ${now.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}</span>`;
  const th = document.querySelector(`.sh[data-s="${Math.floor(x / CW)}"]`); if (th) th.classList.add('now');
}
function renderPalette() {
  $('#palette').innerHTML = TYPES.map(ty => `<div class="pal" data-k="${ty.k}" tabindex="0"><i style="background:${ty.c}${ty.k === 'golive' ? ';border:2px solid #e8883b' : ''}"></i>${esc(t(ty.k))}<small>${ty.w}×${ty.h}</small></div>`).join('') + markerPal();
}
function applyLang() {
  document.documentElement.lang = plan.lang;
  document.querySelectorAll('[data-i]').forEach(e => e.textContent = t(e.dataset.i));
  document.querySelectorAll('.lang button').forEach(b => b.classList.toggle('on', b.dataset.l === plan.lang));
  $('#ptitle').placeholder = t('ptitle');
  renderPalette();
}

/* ---------- interaction ---------- */
const cellAt = ev => { const r = $('#layer').getBoundingClientRect(); return { c: Math.floor((ev.clientX - r.left) / CW), r: Math.floor((ev.clientY - r.top) / RH) }; };
function select(id) { sel = id; document.querySelectorAll('.item').forEach(e => e.classList.toggle('sel', e.dataset.id === id)); }

function itemPointerDown(e) {
  const el = e.target.closest('.item'); if (!el || e.button) return;
  const it = byId(el.dataset.id); select(it.id); closeEditor();
  const rz = e.target.closest('.rz'), mode = rz ? (rz.classList.contains('se') ? 'se' : rz.classList.contains('e') ? 'e' : 's') : 'move';
  const p = cellAt(e), o = { ...it }; e.preventDefault();
  let moved = false;
  if (mode === 'move') el.classList.add('drag');
  const mv = ev => {
    if (Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) > 4) moved = true;
    const q = cellAt(ev); let c = o.col, r = o.row, w = o.w, h = o.h;
    if (mode === 'move') { c = clamp(o.col + q.c - p.c, 0, plan.sprints - o.w); r = clamp(o.row + q.r - p.r, 0, LN() - o.h); }
    else { if (mode !== 's') w = clamp(q.c - o.col + 1, 1, plan.sprints - o.col); if (mode !== 'e') h = clamp(q.r - o.row + 1, 1, LN() - o.row); }
    const ok = free(it, c, r, w, h); el.classList.toggle('bad', !ok);
    if (ok) { Object.assign(it, { col: c, row: r, w, h }); pos(el, it); }
  };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); el.classList.remove('drag', 'bad'); save(); if (!moved && mode === 'move') openEditor(it, el); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}

function addItem(type, c, r) {
  const ty = TYPES.find(x => x.k === type);
  const item = { id: uid(), type, title: t(type), body: '', col: c, row: r, w: ty.w, h: ty.h, color: ty.c };
  plan.items.push(item); select(item.id); renderItems(); save(); return item;
}
function paletteDown(e) {
  const pal = e.target.closest('.pal'); if (!pal || e.button) return;
  if (pal.dataset.k === 'marker') return markerPaletteDown(e, pal);
  const ty = TYPES.find(x => x.k === pal.dataset.k); e.preventDefault();
  const sx = e.clientX, sy = e.clientY; let moved = false, ghost = null, snap = null;
  const mv = ev => {
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
    if (!moved) {
      moved = true; ghost = document.createElement('div'); ghost.id = 'ghost'; ghost.textContent = t(ty.k);
      ghost.style.background = ty.c; ghost.style.color = textColor(ty.c); document.body.appendChild(ghost);
      snap = document.createElement('div'); snap.id = 'snap'; $('#layer').appendChild(snap);
    }
    ghost.style.left = ev.clientX + 10 + 'px'; ghost.style.top = ev.clientY + 10 + 'px';
    const q = cellAt(ev), c = clamp(q.c, 0, plan.sprints - ty.w), r = clamp(q.r, 0, LN() - ty.h);
    const lr = $('#layer').getBoundingClientRect();
    const inside = ev.clientX >= lr.left && ev.clientX <= lr.right && ev.clientY >= lr.top && ev.clientY <= lr.bottom;
    snap.style.display = inside ? '' : 'none';
    snap.style.left = c * CW + 2 + 'px'; snap.style.top = r * RH + 3 + 'px'; snap.style.width = ty.w * CW - 4 + 'px'; snap.style.height = ty.h * RH - 6 + 'px';
    snap.classList.toggle('bad', !free(null, c, r, ty.w, ty.h));
  };
  const up = ev => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
    if (ghost) ghost.remove(); if (snap) snap.remove();
    if (!moved) { const f = firstFree(ty.w, ty.h); if (f) addItem(ty.k, f.c, f.r); else alert(t('noSpace')); return; }
    const lr = $('#layer').getBoundingClientRect();
    if (ev.clientX < lr.left || ev.clientX > lr.right || ev.clientY < lr.top || ev.clientY > lr.bottom) return;
    const q = cellAt(ev), c = clamp(q.c, 0, plan.sprints - ty.w), r = clamp(q.r, 0, LN() - ty.h);
    if (free(null, c, r, ty.w, ty.h)) addItem(ty.k, c, r);
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}

/* ---------- editor popover ---------- */
let editing = null;
function openEditor(it, el) {
  editing = it; const ed = $('#editor');
  $('#eTitle').value = it.title; $('#eBody').value = it.body; $('#eNotes').value = it.notes || ''; $('#eColor').value = it.color; $('#eW').value = it.w; $('#eH').value = it.h;
  ed.hidden = false;
  const r = el.getBoundingClientRect();
  ed.style.left = clamp(r.left, 8, innerWidth - 300) + 'px';
  ed.style.top = clamp(r.bottom + 8, 8, innerHeight - ed.offsetHeight - 8) + 'px';
  $('#eTitle').focus(); $('#eTitle').select();
}
function closeEditor() { $('#editor').hidden = true; editing = null; }
function liveEdit(fn) { if (!editing) return; fn(editing); renderItems(); save(); }
function resizeFromInputs() {
  if (!editing) return;
  const w = clamp(+$('#eW').value || 1, 1, plan.sprints), h = clamp(+$('#eH').value || 1, 1, LN());
  if (free(editing, editing.col, editing.row, w, h)) liveEdit(i => { i.w = w; i.h = h; });
  else { $('#eW').value = editing.w; $('#eH').value = editing.h; }
}

/* ---------- date lines (markers) ---------- */
const MK_SW = ['#1f8f5f', '#d93025', '#3a6df0', '#e8883b', '#23233f', '#8a4fd6'];
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const mkX = date => (new Date(date + 'T00:00:00') - startDate()) / (plan.sprintDays * DAY) * CW;
const dateAtX = x => { const d = startDate(); d.setDate(d.getDate() + Math.round(x / CW * plan.sprintDays)); return iso(d); };
const newMarker = (date) => ({ id: uid(), date: date || iso(new Date()), label: t('live'), color: MK_SW[0] });
const markerPal = () => `<div class="pal" data-k="marker" tabindex="0"><i style="width:4px;height:18px;margin:0 11px;border:0;border-radius:2px;background:#1f8f5f"></i>${esc(t('marker'))}</div>`;
let mEd = null;

function renderMarkers() {
  const g = $('#grid'); if (!g) return;
  g.querySelectorAll('.mk').forEach(e => e.remove());
  plan.markers.forEach(m => {
    const x = mkX(m.date); if (x < 0 || x > plan.sprints * CW) return;
    const el = document.createElement('div'); el.className = 'mk'; el.dataset.id = m.id;
    el.style.left = LW + x + 'px'; el.style.borderLeftColor = m.color;
    el.innerHTML = `<span style="background:${m.color};color:${textColor(m.color)}" title="${esc(m.date)}">${esc(m.label)}</span>`;
    g.appendChild(el);
  });
}
function openMEditor(m, isNew, rect, pick) {
  mEd = { m, isNew }; closeEditor();
  const ed = $('#mEditor');
  $('#mTitle').value = m.label; $('#mDate').value = m.date; $('#mColor').value = m.color;
  $('#mAdd').hidden = !isNew; $('#mDel').hidden = isNew;
  ed.hidden = false;
  ed.style.left = clamp(isNew && pick ? rect.right + 8 : rect.left, 8, innerWidth - 300) + 'px';
  ed.style.top = clamp(isNew && pick ? rect.top : rect.bottom + 8, 8, innerHeight - ed.offsetHeight - 8) + 'px';
  if (isNew) { $('#mDate').focus(); try { $('#mDate').showPicker(); } catch {} }
  else { $('#mTitle').focus(); $('#mTitle').select(); }
}
function closeM(silent) { if (!mEd) return; $('#mEditor').hidden = true; mEd = null; if (!silent) save(); }
function mEdit(fn) { if (!mEd) return; fn(mEd.m); if (!mEd.isNew) { renderMarkers(); save(); } }
function markerDown(e) {
  const sp = e.target.closest('.mk span'); if (!sp || e.button) return;
  const m = plan.markers.find(x => x.id === sp.parentNode.dataset.id); if (!m) return; e.preventDefault();
  closeM(true); closeEditor();
  const sx = e.clientX, x0 = mkX(m.date); let moved = false;
  const mv = ev => { if (!moved && Math.abs(ev.clientX - sx) < 4) return; moved = true; m.date = dateAtX(x0 + ev.clientX - sx); renderMarkers(); };
  const up = () => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
    if (moved) save();
    else { const el = document.querySelector(`.mk[data-id="${m.id}"] span`); if (el) openMEditor(m, false, el.getBoundingClientRect()); }
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}
function markerPaletteDown(e, pal) {
  e.preventDefault();
  const sx = e.clientX, sy = e.clientY; let moved = false, ghost = null;
  const mv = ev => {
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
    if (!moved) { moved = true; ghost = document.createElement('div'); ghost.id = 'ghost'; ghost.textContent = t('live'); ghost.style.background = MK_SW[0]; ghost.style.color = '#fff'; document.body.appendChild(ghost); }
    ghost.style.left = ev.clientX + 10 + 'px'; ghost.style.top = ev.clientY + 10 + 'px';
  };
  const up = ev => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
    if (ghost) ghost.remove();
    if (!moved) return openMEditor(newMarker(), true, pal.getBoundingClientRect(), true);
    const lr = $('#layer').getBoundingClientRect(), gr = $('#grid').getBoundingClientRect();
    if (ev.clientX < lr.left || ev.clientX > lr.right || ev.clientY < gr.top || ev.clientY > gr.bottom) return;
    openMEditor(newMarker(dateAtX(ev.clientX - lr.left)), true, { left: ev.clientX, right: ev.clientX, top: ev.clientY, bottom: ev.clientY });
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}

/* ---------- init ---------- */
function init() {
  applyLang();
  $('#ptitle').value = plan.title; document.title = plan.title || 'Project Planner';
  $('#sStart').value = plan.start; $('#sDays').value = plan.sprintDays; $('#sCount').value = plan.sprints;
  $('#eSw').innerHTML = SW.map(c => `<b data-c="${c}" style="background:${c}" role="button" aria-label="${c}"></b>`).join('');
  render();

  $('#ptitle').oninput = e => { plan.title = e.target.value; document.title = plan.title || 'Project Planner'; save(); };
  $('#toggle').onclick = () => $('#side').classList.toggle('collapsed');
  $('#print').onclick = () => print();
  const exportXlsx = async () => {
    let blob = null;
    try { const r = await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plan) }); if (r.ok) blob = await r.blob(); } catch {}
    // static hosting (e.g. GitHub Pages) has no server: build the workbook in the browser
    if (!blob) blob = new Blob([buildXlsx(plan)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = ((plan.title || 'project-plan').replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'project-plan') + '.xlsx';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };
  const exMenu = open => { $('#exMenu').hidden = !open; $('#export').setAttribute('aria-expanded', open); if (open) $('#exMenu button').focus(); };
  $('#export').onclick = () => exMenu($('#exMenu').hidden);
  $('#exMenu').onclick = async e => {
    const x = e.target.closest('[data-x]')?.dataset.x; if (!x) return;
    exMenu(false);
    try {
      if (x === 'xlsx') await exportXlsx();
      else if (x === 'png') await exportPng();
      else { await copyPng(); toast(t('copied')); }
    } catch (err) { alert(t('exportFail') + ' ' + (err.message || '')); }
  };
  $('#exMenu').onkeydown = e => {
    const bs = [...$('#exMenu').querySelectorAll('button')], i = bs.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); bs[(i + (e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus(); }
    if (e.key === 'Escape') { exMenu(false); $('#export').focus(); }
  };
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.xm')) exMenu(false); });
  document.querySelectorAll('.dv').forEach(b => b.onclick = () => {
    const v = b.dataset.v; plan.ui[v] = !plan.ui[v];
    if (!plan.ui.boxes && !plan.ui.list) plan.ui[v] = true;
    renderDetails(); save();
  });
  $('#details').addEventListener('click', e => {
    const x = e.target.closest('[data-id]'); if (!x) return;
    select(x.dataset.id);
    const el = document.querySelector(`.item[data-id="${x.dataset.id}"]`);
    if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  });
  document.querySelectorAll('.lang button').forEach(b => b.onclick = () => { plan.lang = b.dataset.l; applyLang(); render(); save(); });
  $('#sStart').onchange = e => { if (e.target.value) { plan.start = e.target.value; render(); save(); } };
  $('#sDays').onchange = e => { plan.sprintDays = clamp(+e.target.value || 14, 1, 60); e.target.value = plan.sprintDays; render(); save(); };
  $('#sCount').onchange = e => {
    plan.sprints = clamp(+e.target.value || 12, 1, 52); e.target.value = plan.sprints;
    plan.items = plan.items.filter(i => i.col < plan.sprints); plan.items.forEach(i => i.w = Math.min(i.w, plan.sprints - i.col));
    render(); save();
  };
  $('#addRow').onclick = () => { plan.rows.push({ id: uid(), label: t('newRow'), sub: '', lanes: 1 }); render(); save(); };

  const grid = $('#grid');
  grid.addEventListener('input', e => { const r = e.target.dataset.r, f = e.target.dataset.f; if (r !== undefined && f) { plan.rows[+r][f] = e.target.value; save(); } });
  grid.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const r = +b.dataset.r, row = plan.rows[r], L = row.lanes || 1, start = groupStart(r);
    if (b.dataset.a === 'split') { insertLine(start + L); row.lanes = L + 1; }
    else if (b.dataset.a === 'merge' && L > 1) { removeLines(start + L - 1, 1); row.lanes = L - 1; }
    else if (b.dataset.a === 'del' && plan.rows.length > 1) { removeLines(start, L); plan.rows.splice(r, 1); }
    else return;
    select(null); render(); save();
  });
  grid.addEventListener('pointerdown', e => { if (e.target.closest('.mk span')) markerDown(e); else if (e.target.closest('.item')) itemPointerDown(e); else { select(null); } });
  $('#palette').addEventListener('pointerdown', paletteDown);
  $('#palette').addEventListener('keydown', e => {
    const pal = e.target.closest('.pal'); if (!pal || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    if (pal.dataset.k === 'marker') return openMEditor(newMarker(), true, pal.getBoundingClientRect(), true);
    const ty = TYPES.find(x => x.k === pal.dataset.k), f = firstFree(ty.w, ty.h);
    if (f) addItem(ty.k, f.c, f.r); else alert(t('noSpace'));
  });

  $('#eTitle').oninput = e => liveEdit(i => i.title = e.target.value);
  $('#eBody').oninput = e => liveEdit(i => i.body = e.target.value);
  $('#eNotes').oninput = e => liveEdit(i => i.notes = e.target.value);
  $('#eColor').oninput = e => liveEdit(i => i.color = e.target.value);
  $('#eSw').onclick = e => { const c = e.target.dataset.c; if (c) { $('#eColor').value = c; liveEdit(i => i.color = c); } };
  $('#eW').onchange = resizeFromInputs; $('#eH').onchange = resizeFromInputs;
  $('#eClose').onclick = closeEditor;
  $('#eDel').onclick = () => { if (!editing) return; plan.items = plan.items.filter(i => i !== editing); closeEditor(); sel = null; renderItems(); save(); };
  $('#eDup').onclick = () => {
    if (!editing) return; const f = firstFree(editing.w, editing.h, null);
    if (!f) return alert(t('noSpace'));
    const copy = { ...editing, id: uid(), col: f.c, row: f.r }; plan.items.push(copy); closeEditor(); select(copy.id); renderItems(); save();
  };
  document.addEventListener('pointerdown', e => { if (!$('#editor').hidden && !e.target.closest('#editor') && !e.target.closest('.item')) closeEditor(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeEditor(); closeM(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      plan.items = plan.items.filter(i => i.id !== sel); sel = null; renderItems(); save();
    }
  });
  $('#mSw').innerHTML = MK_SW.map(c => `<b data-c="${c}" style="background:${c}" role="button" aria-label="${c}"></b>`).join('');
  $('#mTitle').oninput = e => mEdit(m => m.label = e.target.value);
  $('#mDate').onchange = e => { if (e.target.value) mEdit(m => m.date = e.target.value); };
  $('#mColor').oninput = e => mEdit(m => m.color = e.target.value);
  $('#mSw').onclick = e => { const c = e.target.dataset.c; if (c) { $('#mColor').value = c; mEdit(m => m.color = c); } };
  $('#mClose').onclick = closeM;
  $('#mAdd').onclick = () => { if (!mEd || !mEd.isNew) return; plan.markers.push(mEd.m); closeM(true); renderMarkers(); save(); };
  $('#mDel').onclick = () => { if (!mEd || mEd.isNew) return; plan.markers = plan.markers.filter(x => x !== mEd.m); closeM(true); renderMarkers(); save(); };
  document.addEventListener('pointerdown', e => { if (mEd && !e.target.closest('#mEditor') && !e.target.closest('.mk span') && !e.target.closest('.pal')) closeM(); });
  setInterval(markToday, 60000);
}
load();
