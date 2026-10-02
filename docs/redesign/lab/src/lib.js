/* POMOĆNE FUNKCIJE ZA SVE KONCEPTE (SVG i formatiranje). Čisto prikazno — nikakva poslovna logika. */
const pace = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const kmf = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');
const nf = (n, d = 1) => n.toFixed(d).replace('.', ',');
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const ICON = {
  today: (sw = 1.9) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5"/><circle cx="12" cy="15" r="2.4" fill="currentColor" stroke="none"/></svg>`,
  plan: (sw = 1.9) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" aria-hidden="true"><path d="M8.5 6h11M8.5 12h11M8.5 18h11"/><circle cx="4.4" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.4" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.4" cy="18" r="1.4" fill="currentColor" stroke="none"/></svg>`,
  rec: (sw = 1.8) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.4 7.1a4.55 4.55 0 0 0-6.45 0L12 9.05 10.05 7.1a4.55 4.55 0 1 0-6.45 6.45L12 21.9l8.4-8.35a4.55 4.55 0 0 0 0-6.45Z"/><path d="M3.4 13.1h3.9l1.5-2.5 2.2 4.3 1.7-2.9 1.1 1.1h4.8"/></svg>`,
  race: (sw = 1.9) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4"/><path d="M5 4h13l-2.5 4L18 12H5"/></svg>`,
  crowd: (sw = 1.8) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.3"/><path d="M3.2 19.2c.5-3.1 3-5.2 5.8-5.2s5.3 2.1 5.8 5.2"/><path d="M16.4 5.2a3.3 3.3 0 0 1 0 6.1M17.6 14.4c2.1.6 3.7 2.4 4.1 4.8"/></svg>`,
  check: (sw = 2.4) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  chev: (sw = 2) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>`,
  down: (sw = 2) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg>`,
  arrow: (sw = 2.2) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>`,
  gear: (sw = 1.8) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/></svg>`,
  flag: (sw = 2) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4"/><path d="M5 4h13l-2.5 4L18 12H5"/></svg>`,
  close: (sw = 2) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`
};
const NAV = [
  ['today', 'Danas'],
  ['plan', 'Plan'],
  ['rec', 'Oporavak'],
  ['race', 'Trka'],
  ['crowd', 'Zajednica']
];

/* PRSTEN — animira se kroz CSS (`.ring-val` koristi --c i --o). */
function ring(share, o = {}) {
  const { size = 80, sw = 8, color = 'currentColor', track = 'rgba(127,127,127,.22)', text = '', tsize = 24, tfont = 'inherit', tcolor = 'currentColor', cap = 'round', tw = 700 } = o;
  const r = 50 - sw / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - clamp(share, 0, 1));
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><circle cx="50" cy="50" r="${r}" fill="none" stroke="${track}" stroke-width="${sw}"/><circle class="ring-val" cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="${cap}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" style="--c:${c.toFixed(1)}" transform="rotate(-90 50 50)"/>${
    text ? `<text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-size="${tsize}" font-weight="${tw}" fill="${tcolor}" style="font-family:${tfont};font-variant-numeric:tabular-nums">${text}</text>` : ''
  }</svg>`;
}

/* SPARKLINE */
function spark(vals, o = {}) {
  const { w = 80, h = 28, color = 'currentColor', sw = 1.6, fill = '', dot = true, min, max, pad = 3, dash = '', cls = '' } = o;
  const lo = min ?? Math.min(...vals);
  const hi = max ?? Math.max(...vals);
  const X = (i) => pad + (i / (vals.length - 1)) * (w - pad * 2);
  const Y = (v) => h - pad - ((v - lo) / (hi - lo || 1)) * (h - pad * 2);
  const pts = vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
  const area = fill ? `<polygon points="${pad},${h - pad} ${pts.join(' ')} ${w - pad},${h - pad}" fill="${fill}" stroke="none"/>` : '';
  const last = vals.length - 1;
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${area}<polyline class="draw" pathLength="1" points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${dash ? `stroke-dasharray="${dash}"` : ''}/>${dot ? `<circle cx="${X(last).toFixed(1)}" cy="${Y(vals[last]).toFixed(1)}" r="${sw + 1}" fill="${color}"/>` : ''}</svg>`;
}

/* SESIJA — profil intenziteta po vremenu (visina stuba = brzina). Segmenti: zagrevanje, 7 × (brzo + oporavak), hlađenje. */
function sessionSegments() {
  const s = D.session;
  const segs = [{ k: 'wu', t: s.wuSec, p: s.easyPace }];
  for (let i = 0; i < s.reps; i++) {
    segs.push({ k: 'rep', t: s.repSec, p: s.workPace, i });
    segs.push({ k: 'rec', t: s.restSec, p: s.easyPace, i });
  }
  segs.pop(); /* posle poslednjeg ponavljanja ide odmah hlađenje */
  segs.push({ k: 'cd', t: s.cdSec, p: s.easyPace });
  return segs;
}
function profile(o = {}) {
  const { w = 340, h = 110, pad = 0, gap = 1.2, easy = '#777', work = '#fff', rec, r = 2, base = '', ymin = 225, ymax = 330, labels = false, cls = '', txt = '#888', font = '' } = o;
  const segs = sessionSegments();
  const total = segs.reduce((a, s) => a + s.t, 0);
  let x = pad;
  const inner = w - pad * 2;
  let out = '';
  const Y = (p) => pad + ((p - ymin) / (ymax - ymin)) * (h - pad * 2 - 14);
  const bottom = h - 14 - pad;
  const spans = {};
  segs.forEach((s) => {
    const sw = (s.t / total) * inner;
    const top = Y(s.p);
    const col = s.k === 'rep' ? work : s.k === 'rec' && rec ? rec : easy;
    out += `<rect class="pbar" style="--d:${(x / w).toFixed(2)}" x="${(x + gap / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${Math.max(1, sw - gap).toFixed(1)}" height="${(bottom - top + 14 * 0).toFixed(1)}" rx="${r}" fill="${col}"/>`;
    spans[s.k] = spans[s.k] || [x, x];
    spans[s.k][1] = x + sw;
    x += sw;
  });
  if (base) out += `<line x1="${pad}" y1="${bottom + 0.5}" x2="${w - pad}" y2="${bottom + 0.5}" stroke="${base}"/>`;
  if (labels) {
    const L = (a, b, t, anchor = 'middle') => `<text x="${anchor === 'middle' ? (a + b) / 2 : a}" y="${h - 2}" text-anchor="${anchor}" font-size="9" fill="${txt}" style="font-family:${font}">${t}</text>`;
    out += L(spans.wu[0], spans.wu[1], `ZAGREVANJE ${kmf(D.session.wuKm)} km`);
    out += L(spans.rep[0], spans.cd[0], `7 × 60 s`);
    out += L(spans.cd[0], spans.cd[1], `HLAĐENJE ${kmf(D.session.cdKm)} km`);
  }
  return { svg: `<svg class="${cls}" viewBox="0 0 ${w} ${h}" width="100%" aria-hidden="true">${out}</svg>`, spans, total, w, h, bottom };
}

/* NEDELJNI OBIM — plan (kontura/blago) naspram ostvarenog (puno). */
function weekBars(o = {}) {
  const { w = 340, h = 130, l = 22, b = 18, t = 8, gap = 5, plan = 'rgba(255,255,255,.18)', real = '#fff', cur = '', txt = '#888', font = '', phaseColors = null, labels = true, grid = 'rgba(255,255,255,.07)', max = 48, curW = D.today.week, r = 2, ticks = [0, 12, 24, 36, 48], upto = true, planStroke = '', cls = '' } = o;
  const n = D.W.length;
  const bw = (w - l - 4) / n - gap;
  const Y = (v) => t + (1 - v / max) * (h - t - b);
  let g = '';
  ticks.forEach((v) => (g += `<line x1="${l}" x2="${w}" y1="${Y(v)}" y2="${Y(v)}" stroke="${grid}"/>${labels ? `<text x="${l - 4}" y="${Y(v) + 3}" text-anchor="end" font-size="8.5" fill="${txt}" style="font-family:${font}">${v}</text>` : ''}`));
  D.W.forEach((k, i) => {
    const x = l + i * (bw + gap) + gap / 2;
    const pc = phaseColors ? phaseColors[k.ph] : plan;
    g += `<rect x="${x.toFixed(1)}" y="${Y(k.plan).toFixed(1)}" width="${bw.toFixed(1)}" height="${(h - b - Y(k.plan)).toFixed(1)}" rx="${r}" fill="${planStroke ? 'none' : pc}" ${planStroke ? `stroke="${planStroke}" stroke-width="1"` : ''} opacity="${phaseColors && !planStroke ? 0.38 : 1}"/>`;
    if (k.real > 0) g += `<rect class="rbar" style="--d:${i * 0.05}s" x="${x.toFixed(1)}" y="${Y(k.real).toFixed(1)}" width="${bw.toFixed(1)}" height="${(h - b - Y(k.real)).toFixed(1)}" rx="${r}" fill="${phaseColors ? phaseColors[k.ph] : real}"/>`;
    if (labels) g += `<text x="${(x + bw / 2).toFixed(1)}" y="${h - 5}" text-anchor="middle" font-size="9" font-weight="${k.w === curW ? 800 : 500}" fill="${k.w === curW ? cur || real : txt}" style="font-family:${font}">${k.w}</text>`;
  });
  if (cur) {
    const i = curW - 1;
    const x = l + i * (bw + gap) + gap / 2;
    g += `<rect x="${(x - 2).toFixed(1)}" y="${t - 2}" width="${(bw + 4).toFixed(1)}" height="${h - b - t + 4}" rx="3" fill="none" stroke="${cur}" stroke-width="1.2"/>`;
  }
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" width="100%" aria-hidden="true">${g}</svg>`;
}

/* VDOT KROZ VREME — izmereno / procenjeno / projektovano. Koordinate: dani od 02.10. (0) do 20.12. (79). */
function vdotChart(o = {}) {
  const { w = 340, h = 190, l = 30, r = 12, t = 16, b = 22, font = '', ymin = 47.8, ymax = 51.2,
    col = { est: '#7fb2ff', meas: '#fff', proj: '#bbb', goal: '#ff7a1a', grid: 'rgba(255,255,255,.08)', txt: '#888', now: 'rgba(255,255,255,.35)', area: '' },
    estW = 2.2, projW = 2, estDash = '', projDash = '4 5', measShape = 'diamond', ticks = [48, 49, 50, 51],
    showGoal = true, showProj = true, showTest = true, showNow = true, dots = true, grid = true,
    labels = { goal: true, proj: true, est: true, test: false }, ls = 9.5, estDots = true, cls = '' } = o;
  const X = (d) => l + (d / 79) * (w - l - r);
  const Y = (v) => t + (1 - (v - ymin) / (ymax - ymin)) * (h - t - b);
  const days = [0, 7, 14, 21, 28, 32];
  const est = D.vdot.series.map(([, v], i) => [X(days[i]), Y(v)]);
  let g = '';
  if (grid) ticks.forEach((v) => (g += `<line x1="${l}" x2="${w - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${col.grid}"/><text x="${l - 6}" y="${Y(v) + 3}" text-anchor="end" font-size="9" fill="${col.txt}" style="font-family:${font};font-variant-numeric:tabular-nums">${v}</text>`));
  [['okt', 0], ['nov', 30], ['dec', 60]].forEach(([m, d]) => (g += `<text x="${X(d)}" y="${h - 5}" font-size="9" fill="${col.txt}" style="font-family:${font}">${m}</text>`));
  if (col.area) g += `<polygon class="est" points="${X(0)},${Y(ymin)} ${est.map((p) => p.join(',')).join(' ')} ${X(32)},${Y(ymin)}" fill="${col.area}"/>`;
  if (showGoal) g += `<g class="goal"><line x1="${l}" x2="${w - r}" y1="${Y(D.vdot.goal)}" y2="${Y(D.vdot.goal)}" stroke="${col.goal}" stroke-width="1.3" stroke-dasharray="2 4"/>${labels.goal ? `<text x="${l + 2}" y="${Y(D.vdot.goal) - 5}" font-size="${ls}" font-weight="700" fill="${col.goal}" style="font-family:${font}">${typeof labels.goal === 'string' ? labels.goal : `CILJ ${nf(D.vdot.goal)} · 19:59`}</text>` : ''}</g>`;
  if (showProj) {
    const x0 = X(32), y0 = Y(D.vdot.now), x1 = X(79), y1 = Y(D.vdot.projected);
    g += `<g class="proj wipe"><line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${col.proj}" stroke-width="${projW}" stroke-dasharray="${projDash}" stroke-linecap="round"/><circle cx="${x1}" cy="${y1}" r="4.5" fill="none" stroke="${col.proj}" stroke-width="${projW}"/>${labels.proj ? `<text x="${x1 - 8}" y="${y1 - 10}" text-anchor="end" font-size="${ls}" font-weight="600" fill="${col.proj}" style="font-family:${font}">${typeof labels.proj === 'string' ? labels.proj : `projekcija ${nf(D.vdot.projected)}`}</text>` : ''}</g>`;
  }
  g += `<g class="est"><polyline class="draw" pathLength="1" points="${est.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${col.est}" stroke-width="${estW}" stroke-linecap="round" stroke-linejoin="round" ${estDash ? `stroke-dasharray="${estDash}"` : ''}/>${estDots ? est.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === est.length - 1 ? 4.2 : 2.2}" fill="${i === est.length - 1 ? col.est : 'transparent'}" stroke="${col.est}" stroke-width="1.4"/>`).join('') : ''}${labels.est ? `<text x="${est[5][0] + 9}" y="${est[5][1] + 16}" text-anchor="start" font-size="${ls}" font-weight="700" fill="${col.est}" style="font-family:${font}">${typeof labels.est === 'string' ? labels.est : `sada ${nf(D.vdot.now)}`}</text>` : ''}</g>`;
  if (showTest) {
    const x = X(23), y = Y(D.vdot.test.vdot);
    const shape = measShape === 'diamond' ? `<rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" transform="rotate(45 ${x} ${y})" fill="${col.meas}"/>` : `<circle cx="${x}" cy="${y}" r="4.5" fill="${col.meas}"/>`;
    g += `<g class="meas">${shape}${labels.test ? `<text x="${x}" y="${y - 12}" text-anchor="middle" font-size="${ls}" font-weight="700" fill="${col.meas}" style="font-family:${font}">${typeof labels.test === 'string' ? labels.test : `test 3 km ${D.vdot.test.time}`}</text>` : ''}</g>`;
  }
  if (showNow) g += `<line x1="${X(33)}" x2="${X(33)}" y1="${t}" y2="${h - b}" stroke="${col.now}" stroke-dasharray="1 3"/>`;
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" width="100%" aria-hidden="true">${g}</svg>`;
}

/* tipovi trening-dana → ključ za boju koncepta */
const KIND = { lako: 'e', lr: 'l', tempo: 't', int: 'i', fartlek: 'i', snaga: 's', odmor: 'r' };


/* „fotografija“ — topografske izohipse (zamena za fotografiju korisnika; u produkciji bi ovde stajao Strava/korisnički snimak ili generisana mapa rute). */
function topo(w, h, o = {}) {
  const { bg = '#2e2a22', line = '#8c7e5c', accent = '#d9683f', n = 16, seed = 1, op = 0.55 } = o;
  let out = `<rect width="${w}" height="${h}" fill="${bg}"/>`;
  const rnd = (i) => Math.sin(i * 127.1 + seed * 311.7) * 0.5 + 0.5;
  const hills = [[w * 0.28, h * 0.62, 1], [w * 0.78, h * 0.34, 0.8], [w * 0.55, h * 0.95, 0.9]];
  hills.forEach(([cx, cy, sc], hi) => {
    for (let k = 1; k <= n; k++) {
      const r0 = k * (h / 15) * sc;
      let d = '';
      for (let a = 0; a <= 72; a++) {
        const t = (a / 72) * Math.PI * 2;
        const r = r0 * (1 + 0.14 * Math.sin(3 * t + hi + seed) + 0.08 * Math.sin(5 * t + k * 0.15 + hi));
        d += `${a ? 'L' : 'M'}${(cx + Math.cos(t) * r * 1.35).toFixed(1)},${(cy + Math.sin(t) * r).toFixed(1)}`;
      }
      out += `<path d="${d}Z" fill="none" stroke="${line}" stroke-width="${k % 4 === 0 ? 1.1 : 0.6}" opacity="${op * (1 - k / (n * 1.4))}"/>`;
    }
  });
  out += `<path d="M-10,${h * 0.9} C${w * 0.25},${h * 0.55} ${w * 0.45},${h * 0.85} ${w * 0.62},${h * 0.5} S${w * 0.9},${h * 0.2} ${w + 10},${h * 0.12}" fill="none" stroke="${accent}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1 0"/><circle cx="${w * 0.62}" cy="${h * 0.5}" r="5" fill="${accent}"/><circle cx="${w * 0.62}" cy="${h * 0.5}" r="11" fill="none" stroke="${accent}" opacity=".4"/>`;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${out}</svg>`;
}
