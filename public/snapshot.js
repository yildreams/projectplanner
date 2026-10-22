/* PNG export – draws the plan straight from the data model onto a canvas (no DOM capture, no deps) */
const FONT = '"Segoe UI",system-ui,-apple-system,Roboto,sans-serif';

function wrapText(ctx, text, maxW, maxLines) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (let word of para.split(/\s+/).filter(Boolean)) {
      const tryL = line ? line + ' ' + word : word;
      if (ctx.measureText(tryL).width <= maxW) { line = tryL; continue; }
      if (line) out.push(line);
      while (ctx.measureText(word).width > maxW && word.length > 1) {   // break words longer than the box
        let k = word.length - 1; while (k > 1 && ctx.measureText(word.slice(0, k)).width > maxW) k--;
        out.push(word.slice(0, k)); word = word.slice(k);
      }
      line = word;
    }
    out.push(line);
  }
  if (out.length > maxLines) {
    out.length = maxLines;
    let l = out[maxLines - 1]; while (l && ctx.measureText(l + '…').width > maxW) l = l.slice(0, -1);
    out[maxLines - 1] = l + '…';
  }
  return out;
}
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function pill(ctx, text, cx, y, bg, fg, minX, maxX) {
  ctx.font = `700 11.5px ${FONT}`;
  const w = ctx.measureText(text).width + 18, x = clamp(cx - w / 2, minX, maxX - w);
  ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
  rrect(ctx, x, y, w, 18, 9); ctx.fillStyle = bg; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + w / 2, y + 9.5);
}

function planCanvas() {
  const n = plan.sprints, R = LN(), loc = locale(), s0 = startDate(), PAD = 28;
  const sd = i => new Date(s0.getTime() + i * plan.sprintDays * DAY);
  const gw = LW + n * CW, gh = TH + HH * 2 + R * RH, W = gw + PAD * 2, gx = PAD, gy = PAD + 64, H = gy + gh + PAD;
  const scale = Math.min(2, 32000 / W, 32000 / H, Math.sqrt(2e8 / (W * H)));   // stay inside browser canvas limits
  const cv = document.createElement('canvas'); cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
  const ctx = cv.getContext('2d'); ctx.scale(scale, scale);
  const txt = (s, x, y, font, color, align = 'left', base = 'alphabetic') => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(s, x, y); };
  const hline = (x1, x2, y, color, w = 1, dash = []) => { ctx.beginPath(); ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); ctx.setLineDash([]); };
  const vline = (x, y1, y2, color, w = 1, dash = []) => { ctx.beginPath(); ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke(); ctx.setLineDash([]); };

  // page + title
  ctx.fillStyle = '#f6f5f9'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e8883b'; ctx.fillRect(PAD, PAD, 6, 32);
  txt(plan.title || 'Project Plan', PAD + 16, PAD + 26, `700 26px ${FONT}`, '#23233f');
  const end = sd(n); end.setDate(end.getDate() - 1);
  const dmy = { day: 'numeric', month: 'short', year: 'numeric' };
  txt(`${s0.toLocaleDateString(loc, dmy)} – ${end.toLocaleDateString(loc, dmy)}  ·  ${n} ${t('sprintsU')} × ${plan.sprintDays} ${t('daysU')}`, PAD + 16, PAD + 50, `400 13px ${FONT}`, '#6b6b82');

  // card
  ctx.shadowColor = 'rgba(35,35,63,.14)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
  rrect(ctx, gx, gy, gw, gh, 12); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.save(); rrect(ctx, gx, gy, gw, gh, 12); ctx.clip();

  // header: corner, months, sprints
  const cx0 = gx + LW, ly = gy + TH + HH * 2;
  ctx.fillStyle = '#23233f'; ctx.fillRect(gx, gy, LW, TH + HH * 2);
  for (let i = 0; i < n;) {
    const d = sd(i), key = d.getFullYear() * 12 + d.getMonth(); let j = i;
    while (j + 1 < n) { const e = sd(j + 1); if (e.getFullYear() * 12 + e.getMonth() !== key) break; j++; }
    const x = cx0 + i * CW, w = (j - i + 1) * CW, m = d.toLocaleDateString(loc, { month: 'long', year: 'numeric' });
    ctx.fillStyle = '#23233f'; ctx.fillRect(x, gy + TH, w, HH);
    vline(x + w - .5, gy + TH, gy + TH + HH, '#3a3a5c');
    ctx.save(); ctx.beginPath(); ctx.rect(x, gy + TH, w, HH); ctx.clip();
    txt(m.charAt(0).toUpperCase() + m.slice(1), x + w / 2, gy + TH + HH / 2 + 1, `600 14px ${FONT}`, '#fff', 'center', 'middle');
    ctx.restore();
    i = j + 1;
  }
  const nowX = (new Date() - s0) / (plan.sprintDays * DAY) * CW, nowS = nowX >= 0 && nowX <= n * CW ? Math.floor(nowX / CW) : -1;
  for (let i = 0; i < n; i++) {
    const x = cx0 + i * CW, y = gy + TH + HH, cur = i === nowS;
    ctx.fillStyle = cur ? '#fde3c8' : '#ecebf3'; ctx.fillRect(x, y, CW, HH);
    vline(x + CW - .5, y, y + HH, '#dcdbe6');
    txt(`${t('sprint')} ${i + 1}`, x + CW / 2, y + 15, `600 12px ${FONT}`, cur ? '#a85a14' : '#23233f', 'center');
    txt(sd(i).toLocaleDateString(loc, { day: 'numeric', month: 'short' }), x + CW / 2, y + 27, `400 10px ${FONT}`, cur ? '#a85a14' : '#6b6b82', 'center');
  }

  // rows: label column + cells
  let line = 0;
  plan.rows.forEach(row => {
    const L = row.lanes || 1, y = ly + line * RH, h = L * RH;
    for (let k = 0; k < L; k++) {
      const yb = ly + (line + k + 1) * RH;
      if (k === L - 1) hline(cx0, gx + gw, yb - 1, '#c9c7d8', 2); else hline(cx0, gx + gw, yb - .5, '#e3e2ec', 1, [3, 3]);
    }
    for (let c = 0; c < n; c++) vline(cx0 + (c + 1) * CW - .5, y, y + h, '#eeedf4');
    ctx.font = `400 12px ${FONT}`;
    const sub = row.sub ? wrapText(ctx, row.sub, LW - 28, Math.max(1, Math.floor((h - 30) / 15))) : [];
    let ty = y + h / 2 - (18 + sub.length * 15) / 2 + 13;
    ctx.font = `700 14px ${FONT}`;
    txt(wrapText(ctx, row.label, LW - 24, 1)[0], gx + LW / 2, ty, ctx.font, '#23233f', 'center'); ty += 18;
    sub.forEach(s => { txt(s, gx + LW / 2, ty, `400 12px ${FONT}`, '#6b6b82', 'center'); ty += 15; });
    hline(gx, cx0, y + h - 1, '#c9c7d8', 2);
    line += L;
  });
  vline(cx0 - 1, ly, gy + gh, '#dcdbe6', 2);

  // components
  plan.items.forEach(it => {
    const x = cx0 + it.col * CW + 2, y = ly + it.row * RH + 3, w = it.w * CW - 4, h = it.h * RH - 6, gl = it.type === 'golive';
    const fg = gl && it.color.toLowerCase() === '#ffffff' ? '#e8883b' : textColor(it.color);
    ctx.shadowColor = 'rgba(35,35,63,.15)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
    rrect(ctx, x, y, w, h, 9); ctx.fillStyle = it.color; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.lineWidth = gl ? 2 : 1; ctx.strokeStyle = gl ? '#e8883b' : 'rgba(0,0,0,.16)';
    rrect(ctx, x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth, 9); ctx.stroke();
    ctx.save(); rrect(ctx, x, y, w, h, 9); ctx.clip();
    const n = linesOf(it).length, iw = w - 18;
    ctx.font = `700 12.5px ${FONT}`;
    const tl = wrapText(ctx, (gl ? '◆ ' : '') + it.title, iw - (n ? 22 : 0), Math.max(1, Math.floor((h - 10) / 15)));
    ctx.font = `400 11px ${FONT}`;
    const bl = it.body ? wrapText(ctx, it.body, iw, Math.max(0, Math.floor((h - 10 - tl.length * 15 - 2) / 13.2))) : [];
    const top = y + h / 2 - (tl.length * 15 + (bl.length ? 2 + bl.length * 13.2 : 0)) / 2;   // vertically centred block, like the DOM
    tl.forEach((s, i) => txt(s, x + 9, top + i * 15 + 11.5, `700 12.5px ${FONT}`, fg));
    ctx.globalAlpha = .85;
    bl.forEach((s, i) => txt(s, x + 9, top + tl.length * 15 + 2 + i * 13.2 + 10, `400 11px ${FONT}`, fg));
    if (n) txt(`≡ ${n}`, x + w - 7, y + 13, `700 10px ${FONT}`, fg, 'right');
    ctx.globalAlpha = 1; ctx.restore();
  });

  // today + date lines over everything
  const minX = gx + 4, maxX = gx + gw - 4, now = new Date();
  if (nowS >= 0) {
    vline(cx0 + nowX, gy, gy + gh, '#e8883b', 2, [6, 4]);
    pill(ctx, `${t('today')} · ${now.toLocaleDateString(loc, { day: 'numeric', month: 'short' })}`, cx0 + nowX, gy + 4, '#e8883b', '#fff', minX, maxX);
  }
  plan.markers.forEach(m => {
    const x = mkX(m.date); if (x < 0 || x > n * CW) return;
    vline(cx0 + x, gy, gy + gh, m.color, 2);
    pill(ctx, m.label, cx0 + x, gy + 4, m.color, textColor(m.color), minX, maxX);
  });
  ctx.restore();
  return cv;
}

const pngName = () => ((plan.title || 'project-plan').replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'project-plan') + '.png';
const pngBlob = () => new Promise((ok, no) => planCanvas().toBlob(b => b ? ok(b) : no(new Error('canvas')), 'image/png'));
async function exportPng() {
  const a = document.createElement('a'); a.href = URL.createObjectURL(await pngBlob()); a.download = pngName();
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
async function copyPng() {
  // ClipboardItem accepts a promise, which keeps the user-gesture alive in Safari while the PNG is encoded
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob() })]);
}
