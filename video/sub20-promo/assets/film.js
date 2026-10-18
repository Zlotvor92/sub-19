/* Sub-20 promo — ceo timeline. Vreme dolazi iz window.__SUB20_T (tools/timing.mjs): scene, reči naracije, outro.
   Pravila: jedan pauziran timeline; početna stanja kroz tl.set(…, 0); posle toga samo to() tweenovi; bez Math.random/Date. */
(function () {
  const T = window.__SUB20_T;
  const S = (n) => T.scenes[n - 1];
  const st = (n) => S(n).start;
  const end = (n) => S(n).start + S(n).dur;
  const W = (n, which) => {
    const s = S(n);
    let i = which;
    if (typeof which === 'string') {
      const k = which.split('#');
      let hit = -1, skip = k[1] ? Number(k[1]) : 0;
      s.words.forEach((w, j) => { if (hit < 0 && w.toLowerCase().replace(/[^\p{L}\d-]/gu, '').startsWith(k[0])) { if (skip-- === 0) hit = j; } });
      i = Math.max(0, hit);
    }
    return s.wt[i];
  };
  const q1 = (q) => document.querySelector(q);
  const qa = (q) => Array.from(document.querySelectorAll(q));

  /* seeded PRNG (mulberry32) */
  let seed = 20261018;
  const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out', duration: 0.5 } });
  const TOTAL = T.total;

  /* pozicioniranje objekata po CENTRU (obj je apsolutan u 0,0; w×h iz CSS-a) */
  const box = (el) => ({ w: el.offsetWidth, h: el.offsetHeight });
  const C = (el, cx, cy, extra = {}) => { const b = box(el); return Object.assign({ x: cx - b.w / 2, y: cy - b.h / 2 }, extra); };
  const set = (q, v, t = 0) => tl.set(q, v, t);
  const to = (q, v, t) => tl.to(q, v, t);

  /* brojač bez callback-a: tekst se smenjuje tl.set-om u trenucima po krivoj power2.out; poslednja vrednost tačno */
  function counter(el, from, toV, t, dur, f) {
    const n = Math.abs(toV - from), dir = Math.sign(toV - from);
    set(el, { textContent: f(from) });
    for (let k = 1; k <= n; k++) {
      const p = k / n; const tp = 1 - Math.sqrt(1 - p);
      set(el, { textContent: f(from + dir * k) }, t + dur * tp);
    }
  }

  /* ---------- naslovi ---------- */
  const TITLES = [
    ['t1a', 'Sat ti kaže vreme.', 'day'],
    ['t1b', 'Ne kaže <em>zašto</em>.', 'day'],
    ['t2', 'Do sub 20 fali <em>26 sekundi</em>.', 'day'],
    ['t3', 'Na 4. km tempo <em>padne</em>.', 'day'],
    ['t4', 'Plan koji <em>nije</em> tvoj.', 'day'],
    ['t5', 'Umor koji <em>ne vidiš</em>.', 'day'],
    ['t6', 'Četiri taba. <em>U ponoć.</em>', 'night'],
    ['t7', 'Zato postoji <em>Sub-20</em>.', 'day'],
    ['t8', 'Svaki dan znaš <em>šta</em> trčiš.', 'day'],
    ['t9', 'Plan iz <em>tvog</em> VDOT-a.', 'day'],
    ['t10', 'Vidiš <em>gde</em> je otišlo.', 'day'],
    ['t11', 'Kad da stisneš. <em>Kad da staneš.</em>', 'night'],
    ['t12', 'Sub-20 ti pokazuje <em>gde</em>.', 'day']
  ];
  const titles = q1('#titles');
  for (const [id, html, theme] of TITLES) {
    const d = document.createElement('div');
    d.className = 'title' + (theme === 'night' ? ' night' : '');
    d.id = id;
    const parts = html.split(/(<em>.*?<\/em>)/);
    const pieces = [];
    for (const p of parts) {
      if (!p) continue;
      const acc = p.startsWith('<em>');
      const txt = acc ? p.slice(4, -5) : p;
      txt.split(/(\s+)/).forEach((w) => { if (w) pieces.push({ w, acc }); });
    }
    let prev = null, gap = true;
    for (const p of pieces) {
      if (/^\s+$/.test(p.w)) { d.appendChild(document.createTextNode(' ')); gap = true; continue; }
      /* interpunkcija zalepljena za prethodnu reč (bez razmaka) ide u isti blok, da ne padne u novi red */
      if (!gap && prev && !p.acc && /^[.,:;!?…]+$/.test(p.w)) {
        const tail = document.createElement('span'); tail.className = 'p'; tail.textContent = p.w; prev.appendChild(tail); continue;
      }
      const s = document.createElement('span');
      s.className = 'w' + (p.acc ? ' acc' : '');
      s.textContent = p.w;
      d.appendChild(s);
      prev = s; gap = false;
    }
    titles.appendChild(d);
  }
  set('.title .w', { opacity: 0, y: 70, rotation: 3 });
  /* ulaz: obične reči od t, akcenat-reči od tAcc (udarna reč naracije); svaka reč sa malim pomakom */
  function titleIn(id, t, tAcc) {
    const plain = qa(`#${id} .w:not(.acc)`), acc = qa(`#${id} .w.acc`);
    plain.forEach((w, i) => to(w, { opacity: 1, y: 0, rotation: 0, duration: 0.5, ease: 'power3.out' }, t + i * 0.055));
    acc.forEach((w, i) => {
      set(w, { y: 40, scale: 0.86, rotation: -4 }, 0);
      to(w, { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(2.2)' }, (tAcc ?? t) + i * 0.07);
    });
  }
  /* izlaz počinje pre reza i završava se pre nego što sledeći naslov krene (bez preklapanja dva naslova) */
  function titleOut(id, t) {
    const ws = qa(`#${id} .w`);
    const t0 = t - 0.2 - ws.length * 0.012;
    ws.forEach((w, i) => to(w, { opacity: 0, y: -46, rotation: -2, duration: 0.18, ease: 'power2.in' }, t0 + i * 0.012));
  }

  /* ---------- pozadina, dekor, zvezde ---------- */
  set('#blob1', { x: -380, y: 520 }); set('#blob2', { x: 380, y: 1150 }); set('#blob3', { x: 300, y: -260 });
  const drift = (q, dx, dy, d) => to(q, { x: `+=${dx}`, y: `+=${dy}`, duration: d, ease: 'sine.inOut', repeat: Math.floor(TOTAL / d), yoyo: true }, 0);
  drift('#blob1', 120, -90, 7.3); drift('#blob2', -140, 70, 8.1); drift('#blob3', 90, 120, 6.7);

  const deco = q1('#deco');
  const DECO = [];
  for (let i = 0; i < 9; i++) {
    const d = document.createElement('div');
    const sz = Math.round(18 + rnd() * 34);
    d.className = 'deco' + (i % 3 === 2 ? ' peach' : '');
    d.style.width = d.style.height = sz + 'px';
    deco.appendChild(d);
    const ang = (i / 9) * Math.PI * 2 + rnd() * 0.5;
    const r = 330 + rnd() * 260;
    DECO.push({ el: d, sz, tx: 540 + Math.cos(ang) * r * 0.95, ty: 1060 + Math.sin(ang) * r * 1.25 });
  }
  /* zvezde: deterministički raspored, trepere */
  const stars = q1('#stars');
  for (let i = 0; i < 70; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const sz = 2 + rnd() * 4.5;
    s.style.width = s.style.height = sz.toFixed(1) + 'px';
    stars.appendChild(s);
    set(s, { x: rnd() * 1080, y: rnd() * 1500, opacity: 0.25 + rnd() * 0.6 });
    to(s, { opacity: 0.15, duration: 0.8 + rnd() * 1.6, ease: 'sine.inOut', repeat: Math.floor(TOTAL / 1.2), yoyo: true }, rnd());
  }
  set('#stars', { opacity: 0 });

  /* ---------- kamera: blag, neprekidan potisak po sceni ---------- */
  set('#cam', { scale: 1, transformOrigin: '50% 55%' });
  for (let n = 1; n <= 12; n++) to('#cam', { scale: n % 2 ? 1.03 : 1.0, duration: S(n).dur, ease: 'sine.inOut' }, st(n));

  /* ================= SCENA 1 — kugla pada ================= */
  const ball = q1('#ball');
  const BALLC = (cx, cy, s, extra = {}) => C(ball, cx, cy, Object.assign({ scale: s }, extra));
  set(ball, BALLC(540, -420, 1));
  set('#ball .in', { scale: 1 });
  set('#ball .in2', { scaleX: 1, scaleY: 1 });
  set('#shadow', C(q1('#shadow'), 540, 1318, { scale: 0.2, opacity: 0 }));
  const t1 = st(1);
  const land = T.ev.land;
  to(ball, { y: 1040 - 300, duration: 0.5, ease: 'power2.in' }, t1);
  to('#shadow', { scale: 1, opacity: 1, duration: 0.5, ease: 'power2.in' }, t1);
  to('#ball .in2', { scaleX: 1.24, scaleY: 0.78, duration: 0.08, ease: 'power2.out' }, land);
  to('#ball .in2', { scaleX: 0.92, scaleY: 1.09, duration: 0.14, ease: 'power2.out' }, land + 0.08);
  to('#ball .in2', { scaleX: 1, scaleY: 1, duration: 0.3, ease: 'elastic.out(1, 0.45)' }, land + 0.22);
  to(ball, { y: 1040 - 300 - 70, duration: 0.24, ease: 'power2.out' }, land + 0.08);
  to(ball, { y: 1040 - 300, duration: 0.22, ease: 'power2.in' }, land + 0.32);
  to('#shadow', { scale: 0.82, duration: 0.24, ease: 'power2.out' }, land + 0.08);
  to('#shadow', { scale: 1, duration: 0.22, ease: 'power2.in' }, land + 0.32);
  to('#ball .in2', { scaleX: 1.08, scaleY: 0.93, duration: 0.07 }, land + 0.54);
  to('#ball .in2', { scaleX: 1, scaleY: 1, duration: 0.4, ease: 'elastic.out(1, 0.5)' }, land + 0.61);
  /* disanje kugle (nikad potpuno mirna) */
  to('#ball .in', { scale: 1.018, duration: 0.9, ease: 'sine.inOut', repeat: Math.floor(TOTAL / 0.9), yoyo: true }, land + 1.0);
  /* kuglice se razlete iz tačke doskoka i ostanu da plutaju (3 sloja paralakse po veličini) */
  DECO.forEach((d, i) => {
    set(d.el, { x: 540 - d.sz / 2, y: 1300 - d.sz / 2, scale: 0, opacity: 0 });
    to(d.el, { x: d.tx - d.sz / 2, y: d.ty - d.sz / 2, scale: 1, opacity: 1, duration: 0.9 + i * 0.04, ease: 'power3.out' }, land + 0.02 + i * 0.03);
    const amp = 8 + d.sz * 0.35;
    to(d.el, { y: `+=${amp}`, duration: 1.6 + (i % 4) * 0.35, ease: 'sine.inOut', repeat: Math.floor(TOTAL / 1.6), yoyo: true }, land + 1.1 + i * 0.05);
  });
  titleIn('t1a', W(1, 'sat'));
  titleOut('t1a', W(1, 'ali') - 0.02);
  titleIn('t1b', W(1, 'ali') + 0.02, W(1, 'zašto'));

  /* ================= SCENA 2 — kontura 19:59 ================= */
  const t2 = st(2);
  const contour = q1('#contour');
  set(contour, C(contour, 540, 1405, { scale: 0.82, opacity: 1 }));
  set('#contourC', { strokeDashoffset: 1640, attr: { 'stroke-dasharray': '1640 1640' } });
  set('#contour text', { opacity: 0, y: 30 });
  set('#dots', C(q1('#dots'), 540, 1106, { scaleY: 0 }));
  set('#gap', { x: 600, y: 1030, opacity: 0, scale: 0.7 });
  titleOut('t1b', t2 - 0.05);
  to(ball, { x: 540 - 300, y: 830 - 300, scale: 0.75, duration: 0.75, ease: 'power3.inOut' }, t2);
  to('#shadow', { opacity: 0, duration: 0.4 }, t2);
  to('#contourC', { strokeDashoffset: 0, duration: 0.85, ease: 'power2.inOut' }, t2 + 0.2);
  to('#contourC', { attr: { 'stroke-dasharray': '20 16' }, duration: 0.01 }, t2 + 1.06);
  to('#contour text', { opacity: 1, y: 0, duration: 0.5 }, t2 + 0.45);
  to('#dots', { scaleY: 1, duration: 0.45, ease: 'power2.out' }, W(2, 'fali'));
  to('#gap', { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, T.ev.gap);
  counter(q1('#gapN'), 0, 26, T.ev.gap, 0.55, (v) => String(v));
  titleIn('t2', S(2).voStart, W(2, 'dvadeset#1'));

  /* ================= SCENA 3 — sprinter „4" ================= */
  const t3 = st(3);
  const BX = 540, BY = 1080, BS3 = 0.78;
  titleOut('t2', t3 - 0.05);
  to(ball, { x: BX - 300, y: BY - 300, scale: BS3, duration: 0.7, ease: 'power3.inOut' }, t3);
  to(contour, { x: BX - 300, y: BY - 300, scale: 0.923, opacity: 0.35, duration: 0.75, ease: 'power3.inOut' }, t3 + 0.04);
  to('#contour text', { opacity: 0, duration: 0.3 }, t3);
  to('#dots', { scaleY: 0, duration: 0.3, ease: 'power2.in' }, t3 + 0.02);
  to('#gap', { opacity: 0, y: '-=40', duration: 0.3, ease: 'power2.in' }, t3 + 0.06);
  const sp = q1('#sprinter');
  set(sp, C(sp, 1260, 1360, { scaleX: 1 }));
  set('#sprinter .in', { scaleX: 1, scaleY: 1, transformOrigin: '50% 92%' });
  set('#legL', { rotation: 0, svgOrigin: '-31 78' }); set('#legR', { rotation: 0, svgOrigin: '31 78' });
  set('#sprinter .lid', { scaleY: 0, svgOrigin: '0 -78' });
  set('#sprinter .drip', { attr: { r: 0 } });
  set('#puddle', { attr: { rx: 0, ry: 0 } });
  set('#spMouth', { attr: { ry: 4 } });
  /* trčanje: noge naizmenično */
  const runT0 = T.ev.run, runT1 = T.ev.gasp;
  to('#legL', { rotation: 28, duration: 0.11, ease: 'sine.inOut', repeat: 9, yoyo: true }, runT0);
  to('#legR', { rotation: -28, duration: 0.11, ease: 'sine.inOut', repeat: 9, yoyo: true }, runT0);
  to('#sprinter .in', { scaleY: 0.94, scaleX: 1.04, duration: 0.11, ease: 'sine.inOut', repeat: 9, yoyo: true }, runT0);
  to(sp, { x: 330 - 160, y: 1420 - 190, duration: 0.55, ease: 'power1.in' }, runT0);
  set(sp, { scaleX: -1 }, runT0 + 0.56);
  to(sp, { x: 840 - 160, y: 1380 - 190, duration: 0.55, ease: 'power2.out' }, runT0 + 0.56);
  /* zadiše se */
  to('#spMouth', { attr: { ry: 16 }, duration: 0.12 }, runT1);
  to('#sweat', { opacity: 1, duration: 0.15 }, runT1);
  to('#sprinter .in', { scaleY: 0.9, scaleX: 1.08, duration: 0.14, ease: 'sine.inOut', repeat: 3, yoyo: true }, runT1);
  to('#sprinter .lid', { scaleY: 1, duration: 0.25 }, runT1 + 0.35);
  /* istopi se (na „popusti") */
  const melt = T.ev.melt;
  to('#sprinter .in', { scaleY: 0.18, scaleX: 1.25, duration: 0.6, ease: 'power2.in' }, melt);
  to('#sweat', { opacity: 0, duration: 0.2 }, melt);
  qa('#sprinter .drip').forEach((d, i) => {
    to(d, { attr: { r: 22 - i * 3, cy: 150 + i * 6 }, duration: 0.5, ease: 'power2.in' }, melt + 0.05 * i);
  });
  to('#puddle', { attr: { rx: 120, ry: 20 }, duration: 0.5, ease: 'power2.out' }, melt + 0.35);
  to('#legs', { opacity: 0, duration: 0.25 }, melt + 0.15);
  to('#spFace', { opacity: 0, y: 60, duration: 0.4, ease: 'power2.in' }, melt + 0.1);
  /* kugla gubi komad: ugriz + kapljica koja se otkine u „−12 s" */
  const chunkA = T.ev.chunkA;
  to('#biteA', { attr: { r: 82 }, duration: 0.45, ease: 'power2.out' }, chunkA);
  set('#dripA', { attr: { r: 0, cx: 190, cy: 185 } });
  to('#dripA', { attr: { r: 46 }, duration: 0.2 }, chunkA);
  to('#dripA', { attr: { cx: 236, cy: 320, r: 30 }, duration: 0.45, ease: 'power2.in' }, chunkA + 0.2);
  to('#dripA', { attr: { r: 0 }, duration: 0.08 }, chunkA + 0.65);
  const pA = q1('#pieceA'), pB = q1('#pieceB'), pC = q1('#pieceC');
  const PARK = { A: [330, 720], B: [540, 680], C: [750, 720] };
  for (const p of [pA, pB, pC]) set(p, C(p, 540, 1080, { scale: 0, opacity: 0 }));
  set(pA, C(pA, BX + 236 * BS3, BY + 320 * BS3, { scale: 0, opacity: 1 }));
  to(pA, { scale: 0.62, duration: 0.15 }, chunkA + 0.62);
  to(pA, { x: PARK.A[0] - 90, y: PARK.A[1] - 90, scale: 1, duration: 0.8, ease: 'power3.out' }, chunkA + 0.75);
  to(pA, { rotation: -8, duration: 0.8, ease: 'sine.inOut' }, chunkA + 0.75);
  to(pA, { y: `+=12`, duration: 1.3, ease: 'sine.inOut', repeat: Math.max(0, Math.floor((st(6) - chunkA - 1.6) / 1.3) - 1), yoyo: true }, chunkA + 1.6);
  titleIn('t3', S(3).voStart, W(3, 'padne'));

  /* ================= SCENA 4 — plan koji nije tvoj ================= */
  const t4 = st(4);
  titleOut('t3', t4 - 0.05);
  to('#puddle', { attr: { rx: 0, ry: 0 }, duration: 0.4, ease: 'power2.in' }, t4 + 0.1);
  to('#sprinter .in', { opacity: 0, duration: 0.35 }, t4 + 0.1);
  set('#sprinter', { visibility: 'hidden' }, t4 + 0.5);
  to('#sprinter .drip', { attr: { r: 0 }, duration: 0.3 }, t4 + 0.1);
  const pp = q1('#paper');
  set(pp, C(pp, -220, 1560));
  set('#paper .in2', { skewX: -10, transformOrigin: '50% 100%' });
  set('#paper .in', { scaleX: 1, scaleY: 1, transformOrigin: '50% 95%' });
  set('#ppMouth', { attr: { ry: 6 } }); set('#ppTeeth', { attr: { height: 0 } });
  /* dva skoka do pozicije */
  const hop = (t, x, y) => {
    to(pp, { x: x - 170, duration: 0.42, ease: 'none' }, t);
    to(pp, { y: y - 190 - 150, duration: 0.21, ease: 'power2.out' }, t);
    to(pp, { y: y - 190, duration: 0.21, ease: 'power2.in' }, t + 0.21);
    to('#paper .in', { scaleY: 0.8, scaleX: 1.14, duration: 0.07 }, t + 0.42);
    to('#paper .in', { scaleY: 1, scaleX: 1, duration: 0.3, ease: 'elastic.out(1, 0.5)' }, t + 0.49);
  };
  hop(t4 + 0.05, 60, 1420);
  hop(t4 + 0.6, 230, 1330);
  to('#paper .in2', { skewX: 4, duration: 0.8, ease: 'sine.inOut' }, t4 + 0.05);
  /* zagriz na „osam" */
  const bite = T.ev.bite;
  to(pp, { x: 300 - 170, y: 1140 - 190, duration: 0.25, ease: 'power3.in' }, bite - 0.25);
  to('#paper .in2', { skewX: 12, duration: 0.25, ease: 'power3.in' }, bite - 0.25);
  to('#ppMouth', { attr: { ry: 52 }, duration: 0.18 }, bite - 0.3);
  to('#ppTeeth', { attr: { height: 14 }, duration: 0.18 }, bite - 0.3);
  to('#ppMouth', { attr: { ry: 6 }, duration: 0.1, ease: 'power4.in' }, bite);
  to('#ppTeeth', { attr: { height: 0 }, duration: 0.1 }, bite);
  qa('.biteB').forEach((c, i) => to(c, { attr: { r: [62, 52, 46][i] }, duration: 0.16, ease: 'power3.out' }, bite + 0.01 + i * 0.03));
  to('#ball .in2', { scaleX: 0.95, scaleY: 1.05, duration: 0.08 }, bite);
  to('#ball .in2', { scaleX: 1, scaleY: 1, duration: 0.4, ease: 'elastic.out(1, 0.45)' }, bite + 0.08);
  set(pB, C(pB, BX - 236 * BS3, BY - 76 * BS3, { scale: 0, opacity: 1 }), bite);
  to(pB, { scale: 0.7, duration: 0.12 }, bite + 0.05);
  to(pB, { x: PARK.B[0] - 90, y: PARK.B[1] - 90, scale: 1, rotation: 6, duration: 0.8, ease: 'power3.out' }, bite + 0.18);
  to(pB, { y: `+=12`, duration: 1.4, ease: 'sine.inOut', repeat: Math.max(0, Math.floor((st(6) - bite - 1.0) / 1.4) - 1), yoyo: true }, bite + 1.0);
  /* žvaće, pa odskakuće napolje */
  to('#paper .in', { scaleY: 0.88, duration: 0.1, ease: 'sine.inOut', repeat: 5, yoyo: true }, bite + 0.12);
  to(pp, { x: 230 - 170, y: 1330 - 190, duration: 0.35, ease: 'power2.out' }, bite + 0.1);
  to('#paper .in2', { skewX: 0, duration: 0.35, ease: 'power2.out' }, bite + 0.1);
  to(pp, { x: -260 - 170, y: 1500 - 190, duration: 0.55, ease: 'power2.in' }, end(4) + 0.1);
  to('#paper .in2', { skewX: -14, duration: 0.55, ease: 'power2.in' }, end(4) + 0.1);
  titleIn('t4', S(4).voStart, W(4, 'nije'));

  /* ================= SCENA 5 — umor koji ne vidiš ================= */
  const t5 = st(5);
  titleOut('t4', t5 - 0.05);
  const cl = q1('#cloud');
  set(cl, C(cl, 1340, 1470, { opacity: 0.0 }));
  set('#cloud .in', { scale: 1, transformOrigin: '50% 60%' });
  set('#cloud .lid', { scaleY: 1, svgOrigin: '0 -8' });
  set('#vortex', { rotation: 0, svgOrigin: '-140 70', scale: 0.4, opacity: 0 });
  set('#clMouth', { attr: { ry: 6 } });
  to(cl, { x: 830 - 230, opacity: 1, duration: 0.85, ease: 'power3.out' }, t5);
  to('#cloud .in', { scale: 1.04, duration: 1.1, ease: 'sine.inOut', repeat: 3, yoyo: true }, t5 + 0.5);
  /* zev */
  to('#clMouth', { attr: { ry: 22 }, duration: 0.4, ease: 'sine.inOut' }, t5 + 0.45);
  to('#cloud .lid', { scaleY: 0.55, duration: 0.4 }, t5 + 0.45);
  /* vrtlog i mlaz */
  const L = 330;
  set('#stream', { attr: { 'stroke-dasharray': `${L} ${L}` }, strokeDashoffset: L, opacity: 1 });
  to('#vortex', { opacity: 1, scale: 1, duration: 0.3 }, t5 + 0.7);
  to('#vortex', { rotation: -720, duration: 2.2, ease: 'none' }, t5 + 0.7);
  to('#stream', { strokeDashoffset: 0, duration: 0.55, ease: 'power2.in' }, t5 + 0.75);
  to('#biteC', { attr: { r: 58 }, duration: 0.9, ease: 'power1.inOut' }, t5 + 0.8);
  to(ball, { scale: 0.70, duration: 1.1, ease: 'power1.inOut' }, t5 + 0.8);
  const snap = T.ev.snap;
  to('#stream', { strokeDashoffset: -L, duration: 0.35, ease: 'power2.in' }, snap);
  set(pC, C(pC, 690, 1370, { scale: 0, opacity: 1 }), snap);
  to(pC, { scale: 0.7, duration: 0.12 }, snap + 0.1);
  to(pC, { x: PARK.C[0] - 90, y: PARK.C[1] - 90, scale: 1, rotation: -5, duration: 0.85, ease: 'power3.out' }, snap + 0.2);
  if (st(6) - snap - 1.05 > 1.2) to(pC, { y: `+=12`, duration: 1.2, ease: 'sine.inOut', repeat: Math.max(0, Math.floor((st(6) - snap - 1.05) / 1.2) - 1), yoyo: true }, snap + 1.05);
  to('#vortex', { opacity: 0, scale: 0.4, duration: 0.3 }, snap + 0.2);
  to('#cloud .lid', { scaleY: 1, duration: 0.5 }, snap + 0.3);
  to('#clMouth', { attr: { ry: 5 }, duration: 0.3 }, snap + 0.3);
  titleIn('t5', S(5).voStart, W(5, 'ne'));
  /* likovi van svojih scena: skriveni (nisu clip elementi) */
  set('#paper', { visibility: 'hidden' }, t5 + 0.8);
  set('#peek', { visibility: 'hidden' });
  set('#peek', { visibility: 'visible' }, st(10));
  set('#peek', { visibility: 'hidden' }, st(11));
  set('#ball2', { visibility: 'hidden' });
  set('#ball2', { visibility: 'visible' }, T.outro.lockup - 0.05);

  /* ================= SCENA 6 — ponoć, četiri taba ================= */
  const t6 = st(6);
  titleOut('t5', t6 - 0.05);
  to('#bg-night', { opacity: 1, duration: 0.6, ease: 'power2.inOut' }, t6);
  to('#stars', { opacity: 1, duration: 0.8 }, t6 + 0.2);
  to(cl, { x: 1200 - 230, opacity: 0, duration: 0.7, ease: 'power2.in' }, t6);
  set(cl, { visibility: 'hidden' }, t6 + 0.75);
  to(DECO.map((d) => d.el), { opacity: 0.35, duration: 0.6 }, t6);
  to(contour, { opacity: 0, duration: 0.4 }, t6);
  /* komadi odlete gore (vraćaju se u sceni 12) */
  [pA, pB, pC].forEach((p, i) => to(p, { y: -300, opacity: 0, duration: 0.6, ease: 'power2.in' }, t6 + 0.05 + i * 0.06));
  /* kugla → sat */
  const ck = q1('#clock');
  set(ck, C(ck, 540, 1080, { scale: 0.7 * 0.6, opacity: 0, rotation: -25 }));
  set('#hHour', { rotation: -60, svgOrigin: '0 0', scaleY: 0 }); set('#hMin', { rotation: -60, svgOrigin: '0 0', scaleY: 0 });
  to('#ball .in2', { scaleX: 1.12, scaleY: 0.88, duration: 0.12 }, t6 + 0.1);
  to(ball, { opacity: 0, scale: 0.6, duration: 0.18, ease: 'power2.in' }, t6 + 0.22);
  to(ck, { opacity: 1, scale: 0.7, rotation: 0, duration: 0.55, ease: 'back.out(1.8)' }, t6 + 0.26);
  to('#hHour', { scaleY: 1, rotation: 353.5 - 360, duration: 0.6, ease: 'back.out(1.6)' }, t6 + 0.45);
  to('#hMin', { scaleY: 1, rotation: 282, duration: 0.7, ease: 'back.out(1.4)' }, t6 + 0.5);
  to('#hMin', { rotation: 288, duration: 0.25, ease: 'steps(1)', repeat: 0 }, t6 + 2.2);
  const dg = q1('#digital');
  set(dg, C(dg, 540, 1352, { opacity: 0, y: 1352 - 45 + 30 }));
  to(dg, { opacity: 1, y: 1352 - 45, duration: 0.45 }, t6 + 0.7);
  /* kartice „tabova" na reči naracije */
  const CARDS = [['#cStrava', 230, 770, -16, 'stravu'], ['#cXlsx', 830, 830, 15, 'tabelu'], ['#cCalc', 240, 1400, 12, 'kalkulator'], ['#cHrv', 840, 1330, -14, 'ejč']];
  set('#cards', { perspective: 1200 });
  CARDS.forEach(([q, x, y, ry, w], i) => {
    const el = q1(q);
    set(el, { x: x - 190, y: y - 125 + 60, rotationY: ry * 2, rotationX: 10, scale: 0.6, opacity: 0, transformPerspective: 1000 });
    const ti = T.ev.cards[i]; void w;
    to(el, { y: y - 125, rotationY: ry, scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.5)' }, ti);
    to(el, { y: `+=${14 + i * 3}`, rotation: i % 2 ? 2 : -2, duration: 1.3 + i * 0.2, ease: 'sine.inOut', repeat: 3, yoyo: true }, ti + 0.6);
  });
  titleIn('t6', S(6).voStart + 0.1, W(6, 'ponoć'));

  /* ================= SCENA 7 — Sub-20 (sat → kugla → glava trkača) ================= */
  const t7 = st(7);
  titleOut('t6', t7 - 0.05);
  CARDS.forEach(([q, x, y], i) => to(q, { x: (x < 540 ? -700 : 1500), y: `-=${120 + i * 30}`, rotation: x < 540 ? -20 : 20, opacity: 0, duration: 0.45, ease: 'power2.in' }, t7 + i * 0.04));
  to(dg, { opacity: 0, y: '+=30', duration: 0.3, ease: 'power2.in' }, t7);
  to('#bg-night', { opacity: 0, duration: 0.7, ease: 'power2.inOut' }, t7 + 0.15);
  to('#stars', { opacity: 0, duration: 0.5 }, t7 + 0.1);
  to(DECO.map((d) => d.el), { opacity: 1, duration: 0.6 }, t7 + 0.3);
  to(ck, { scale: 0.62, opacity: 0, rotation: 20, duration: 0.22, ease: 'power2.in' }, t7 + 0.12);
  to(ball, { opacity: 1, scale: 0.7, duration: 0.25, ease: 'back.out(2)' }, t7 + 0.18);
  to('#ball .in2', { scaleX: 1, scaleY: 1, duration: 0.3 }, t7 + 0.18);
  /* logo: glava trkača je u (52,7 %, 27,9 %) logoa, prečnik 10,2 % */
  const LG = { left: 260, top: 740, size: 560 };
  const HEAD = { x: LG.left + 0.527 * LG.size, y: LG.top + 0.279 * LG.size, d: 0.102 * LG.size };
  set('#logo', { clipPath: 'circle(0px at 52.7% 27.9%)', scale: 0.96, transformOrigin: '52.7% 27.9%' });
  const shrink = T.ev.shrink;
  to('#ballTxt', { opacity: 0, duration: 0.2 }, shrink);
  to(ball, { x: HEAD.x - 300, y: HEAD.y - 300, scale: HEAD.d / 520, duration: 0.6, ease: 'power3.inOut' }, shrink);
  to('#ballWhite', { opacity: 1, duration: 0.25 }, shrink + 0.35);
  qa('#ball .hl').forEach((h) => to(h, { opacity: 0, duration: 0.2 }, shrink + 0.3));
  /* zalečeni ugrizi da glava bude okrugla (pravi povratak komada je u sceni 12) */
  to(['#biteA', '#biteC'], { attr: { r: 0 }, duration: 0.3 }, shrink + 0.2);
  to('.biteB', { attr: { r: 0 }, duration: 0.3 }, shrink + 0.2);
  const reveal = T.ev.reveal;
  to('#logo', { clipPath: 'circle(140% at 52.7% 27.9%)', duration: 0.65, ease: 'power3.in' }, reveal);
  to('#logo', { scale: 1, duration: 0.9, ease: 'power3.out' }, reveal + 0.3);
  set(ball, { opacity: 0 }, reveal + 0.3);
  titleIn('t7', S(7).voStart, W(7, 'sab'));
  /* brzi pan sa motion blurom u telefon */
  const pan = T.ev.pan;
  titleOut('t7', pan - 0.05);
  to(['#pan', '#stage'], { x: -1300, duration: 0.42, ease: 'power3.inOut' }, pan);
  to(['#pan', '#stage'], { keyframes: { filter: ['blur(0px)', 'blur(26px)', 'blur(0px)'] }, duration: 0.42, ease: 'none' }, pan);
  set(['#pan', '#stage'], { filter: 'blur(0px)', x: 0 });

  /* ================= SCENA 8 — Danas ================= */
  const t8 = st(8);
  set('#phone', { scale: 1, transformOrigin: '50% 30%' });
  set('#uiPlan', { y: 1446 }); set('#uiOpor', { y: 1446 }); set('#uiDanas', { y: 0 });
  to('#phone', { scale: 1.035, duration: S(8).dur + 0.4, ease: 'sine.inOut' }, t8);
  /* ručno nacrtan krug oko „3:55 /km · oko 32 min" (ekran px: 0,571 × px slike) */
  const k = 668 / 1170;
  const handOval = (cx, cy, rx, ry, sd) => {
    let s2 = sd; const r2 = () => { s2 = (s2 * 9301 + 49297) % 233280; return s2 / 233280; };
    const pts = []; const a0 = -2.3, a1 = a0 + Math.PI * 2 + 0.55;
    for (let i = 0; i <= 26; i++) { const a = a0 + (a1 - a0) * (i / 26); const j = 1 + (r2() - 0.5) * 0.07 + (i / 26) * 0.08; pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]); }
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length - 1; i++) { const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1]; d += ` Q${p1[0].toFixed(1)} ${p1[1].toFixed(1)} ${((p1[0] + p2[0]) / 2).toFixed(1)} ${((p1[1] + p2[1]) / 2).toFixed(1)}`; void p0; }
    return d;
  };
  const draw = (q, d, t, dur = 0.55) => {
    const el = q1(q); el.setAttribute('d', d); const len = Math.ceil(el.getTotalLength());
    set(el, { attr: { 'stroke-dasharray': `${len} ${len}` }, strokeDashoffset: len, opacity: 1 });
    to(el, { strokeDashoffset: 0, duration: dur, ease: 'power2.inOut' }, t);
    return len;
  };
  draw('#annDanas', handOval(103 * 3 * k, 263 * 3 * k, 100 * 3 * k, 34, 11), T.ev.circle8);
  titleIn('t8', S(8).voStart, W(8, 'šta'));
  set('#note span', { opacity: 0 });
  to('#noteDemo', { opacity: 1, duration: 0.4 }, t8 + 0.3);

  /* ================= SCENA 9 — plan iz tvog VDOT-a ================= */
  const t9 = st(9);
  titleOut('t8', t9 - 0.05);
  to('#annDanas', { opacity: 0, duration: 0.2 }, t9);
  to('#uiDanas', { y: -1446, duration: 0.65, ease: 'power3.inOut' }, t9 + 0.05);
  to('#uiPlan', { y: 0, duration: 0.65, ease: 'power3.inOut' }, t9 + 0.05);
  to('#phone', { scale: 1.0, duration: S(9).dur, ease: 'sine.inOut' }, t9);
  set('#vdot', { opacity: 0, y: 90, scale: 0.72, rotationX: 18, rotationY: -10, transformPerspective: 1100, transformOrigin: '50% 50%' });
  to('#vdot', { opacity: 1, y: 0, scale: 1, rotationX: 6, rotationY: -4, duration: 0.7, ease: 'back.out(1.4)' }, t9 + 0.5);
  to('#vdot', { rotationY: 3, duration: 2.4, ease: 'sine.inOut' }, t9 + 1.2);
  /* mala kugla „20:25" doleti i postane „48,6" (VDOT iz tvog vremena) */
  const mini = q1('#mini');
  const VD = { x: 160 + (87.5 / 350) * 760, y: 1183 + (66 / 108) * 235 };
  set(mini, C(mini, -160, 900, { scale: 0.9, opacity: 1, rotation: -30 }));
  set('#miniG', { opacity: 0 }); set('#miniT2', { opacity: 0 }); set('#miniT1', { opacity: 1 });
  const fly9 = T.ev.fly9;
  to(mini, { x: VD.x - 100, duration: 0.7, ease: 'power2.out' }, fly9);
  to(mini, { y: VD.y - 100 - 160, duration: 0.35, ease: 'power2.out' }, fly9);
  to(mini, { y: VD.y - 100, duration: 0.35, ease: 'power2.in' }, fly9 + 0.35);
  to(mini, { rotation: 0, duration: 0.7 }, fly9);
  to('#miniG', { opacity: 1, duration: 0.25 }, fly9 + 0.5);
  to('#miniT1', { opacity: 0, duration: 0.15 }, fly9 + 0.5);
  to('#miniT2', { opacity: 1, duration: 0.15 }, fly9 + 0.58);
  to(mini, { scale: 1.08, duration: 0.12 }, fly9 + 0.7);
  to(mini, { scale: 0.35, opacity: 0, duration: 0.35, ease: 'power3.in' }, fly9 + 0.95);
  draw('#annCheck', `M${VD.x + 150} ${VD.y - 70} l26 30 l60 -78`, T.ev.check9, 0.35);
  titleIn('t9', S(9).voStart, W(9, 'tvog'));

  /* ================= SCENA 10 — prolazi po kilometru ================= */
  const t10 = st(10);
  titleOut('t9', t10 - 0.05);
  to('#vdot', { opacity: 0, y: -160, x: -220, rotation: -8, duration: 0.45, ease: 'power2.in' }, t10);
  to('#annCheck', { opacity: 0, duration: 0.2 }, t10);
  to('#phone', { scale: 0.86, opacity: 0.22, filter: 'blur(6px)', duration: 0.6, ease: 'power2.inOut' }, t10 + 0.05);
  set('#tblWrap', { opacity: 0, y: 120, scale: 0.84, transformOrigin: '34% 57%' });
  set('#tbl', { clipPath: 'inset(0px 0px 760px 0px round 30px)' });
  to('#tblWrap', { opacity: 1, y: 0, scale: 1, duration: 0.65, ease: 'power3.out' }, t10 + 0.2);
  /* redovi se otkrivaju jedan po jedan (dno reda u px isečka: 900/1050 × css*3) */
  const kk = 900 / 1050;
  const rowBottom = (css) => Math.round(962 - css * 3 * kk);
  [81.5, 119.5, 157.5, 195.5, 233.5, 271.5, 309.5].forEach((y, i) => {
    to('#tbl', { clipPath: `inset(0px 0px ${Math.max(0, rowBottom(y + 38))}px 0px round 30px)`, duration: 0.14, ease: 'power2.out' }, T.ev.rows10 + i * 0.13);
  });
  to('#tbl', { clipPath: 'inset(0px 0px 0px 0px round 30px)', duration: 0.3 }, T.ev.rows10 + 7 * 0.13);
  const R4 = { cx: 215, cy: (195.5 + 19) * 3 * kk };
  draw('#annRow', handOval(R4.cx, R4.cy, 245, 62, 23), T.ev.circle10, 0.6);
  /* sprinter iz scene 3 proviri pored reda „4" */
  const pk = q1('#peek');
  set(pk, C(pk, 1260, 619 + R4.cy + 30, { rotation: -14 }));
  const peekT = T.ev.peek10;
  to(pk, { x: 1035 - 160, rotation: -22, duration: 0.35, ease: 'back.out(2)' }, peekT);
  to(pk, { x: 1260 - 160, rotation: -10, duration: 0.3, ease: 'power2.in' }, peekT + 0.75);
  titleIn('t10', S(10).voStart, W(10, 'gde'));
  to('#noteDemo', { opacity: 0, duration: 0.25 }, t10);
  to('#noteTrka', { opacity: 1, duration: 0.4 }, t10 + 0.3);

  /* ================= SCENA 11 — oporavak (ulazak kroz „4:12") ================= */
  const t11 = st(11);
  titleOut('t10', t11 - 0.05);
  to('#annRow', { opacity: 0, duration: 0.15 }, t11);
  to('#tblWrap', { scale: 7, opacity: 0, filter: 'blur(14px)', duration: 0.65, ease: 'power3.in' }, t11);
  to('#bg-navy', { opacity: 1, duration: 0.7, ease: 'power2.inOut' }, t11 + 0.2);
  to('#stars', { opacity: 1, duration: 0.8 }, t11 + 0.35);
  to('#moon', { opacity: 1, y: -20, duration: 1.2, ease: 'power2.out' }, t11 + 0.4);
  to(DECO.map((d) => d.el), { opacity: 0.25, duration: 0.6 }, t11 + 0.2);
  set('#uiPlan', { y: -1446 }, t11 + 0.3); set('#uiOpor', { y: 0 }, t11 + 0.3);
  to('#phone', { scale: 0.92, opacity: 1, filter: 'blur(0px)', duration: 0.75, ease: 'power3.out' }, t11 + 0.4);
  /* tri kugle kruže oko telefona i stanu na „staneš" */
  const orbs = ['#orb1', '#orb2', '#orb3'].map(q1);
  set(orbs, { opacity: 0, scale: 0 });
  const stopT = T.ev.stop11;
  /* orbita bez callback-a: putanja je unapred izračunata (ugao po krivoj power1.inOut), keyframes linearno */
  const oT0 = t11 + 0.6, oDur = stopT - oT0, A0 = -1.0, A1 = Math.PI * 2 + Math.PI * 0.5 - (Math.PI * 2) / 3, STEPS = 36;
  const inOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  const pos = (a) => ({ x: 540 + Math.cos(a) * 455 - 100, y: 1500 + Math.sin(a) * 95 - 100 });
  orbs.forEach((o, i) => {
    const off = (i * Math.PI * 2) / 3;
    set(o, pos(A0 + off));
    const kf = [];
    for (let j = 1; j <= STEPS; j++) kf.push(pos(A0 + off + (A1 - A0) * inOut(j / STEPS)));
    to(o, { keyframes: kf, duration: oDur, ease: 'none' }, oT0);
    to(o, { opacity: 1, scale: 0.92 + 0.1 * (i === 0), duration: 0.45, ease: 'back.out(2)' }, t11 + 0.6 + i * 0.12);
  });
  /* „Olakšaj" na ekranu: krug + pečat */
  draw('#annOpor', handOval(75 * 3 * k, 200.7 * 3 * k, 125, 50, 37), stopT - 0.25, 0.5);
  set('#stampOpor', { x: 292, y: 282, rotation: -24, scale: 2.4, opacity: 0, fontSize: 50, borderWidth: 7, padding: '8px 20px 10px' });
  to('#stampOpor', { rotation: -9, scale: 1, opacity: 1, duration: 0.28, ease: 'power4.in' }, stopT + 0.3);
  to('#phone', { y: 10, duration: 0.08, ease: 'power2.out', yoyo: true, repeat: 1 }, stopT + 0.58);
  titleIn('t11', S(11).voStart, W(11, 'kad#1'));
  to('#noteTrka', { opacity: 0, duration: 0.25 }, t11);
  to('#noteOpor', { opacity: 1, duration: 0.4 }, t11 + 0.5);

  /* ================= SCENA 12 — sekunde se vraćaju ================= */
  const t12 = st(12);
  titleOut('t11', t12 - 0.05);
  set('#stage', { x: 0 }, t12);
  to('#noteOpor', { opacity: 0, duration: 0.25 }, t12);
  to('#bg-navy', { opacity: 0, duration: 0.7, ease: 'power2.inOut' }, t12 + 0.1);
  to('#stars', { opacity: 0, duration: 0.5 }, t12 + 0.1);
  to('#moon', { opacity: 0, duration: 0.4 }, t12);
  to(DECO.map((d) => d.el), { opacity: 1, duration: 0.6 }, t12 + 0.4);
  to('#phone', { y: 1500, opacity: 0, filter: 'blur(10px)', duration: 0.6, ease: 'power3.in' }, t12 + 0.05);
  /* kugle se skupe u jednu narandžastu kuglu (sa ugrizima — komadi još nisu vraćeni) */
  orbs.forEach((o, i) => to(o, { x: 540 - 100, y: 1080 - 100, scale: 0.4, opacity: 0, duration: 0.5, ease: 'power3.in' }, t12 + i * 0.05));
  set('#biteA', { attr: { r: 82 } }, t12); set('#biteC', { attr: { r: 58 } }, t12);
  qa('.biteB').forEach((c, i) => set(c, { attr: { r: [62, 52, 46][i] } }, t12));
  set('#ballWhite', { opacity: 0 }, t12); set('#ballTxt', { opacity: 1 }, t12);
  set('#ball .hl', { opacity: 0.45 }, t12);
  set(ball, BALLC(540, 1080, 0.35, { opacity: 0 }), t12);
  to(ball, { scale: 0.70, opacity: 1, duration: 0.5, ease: 'back.out(2.2)' }, t12 + 0.4);
  set(contour, C(contour, 540, 1080, { scale: 0.923, opacity: 0 }), t12);
  set('#contourC', { attr: { 'stroke-dasharray': '20 16' }, strokeDashoffset: 0 }, t12);
  to(contour, { opacity: 0.45, duration: 0.5 }, t12 + 0.6);
  /* komadi se vraćaju na svoja mesta (svaki „pop") */
  const HOME = { A: [540 + 190 * 0.7, 1080 + 185 * 0.7, '#biteA'], B: [540 - 236 * 0.7, 1080 - 76 * 0.7, '.biteB'], C: [540 + 92 * 0.7, 1080 + 250 * 0.7, '#biteC'] };
  const ret0 = T.ev.ret12;
  [['A', pA, -200, 820], ['B', pB, 1280, 700], ['C', pC, 1280, 1420]].forEach(([key, p, sx, sy], i) => {
    const [hx, hy, bq] = HOME[key];
    set(p, { x: sx - 90, y: sy - 90, scale: 0.8, opacity: 1, rotation: 0 }, t12);
    const ti = ret0 + i * 0.32;
    to(p, { x: hx - 90, y: hy - 90, scale: 0.55, duration: 0.5, ease: 'power3.in' }, ti);
    to(p, { scale: 0, opacity: 0, duration: 0.12 }, ti + 0.5);
    to(bq, { attr: { r: 0 }, duration: 0.18, ease: 'power3.out' }, ti + 0.48);
    to('#ball .in2', { scaleX: 1.07, scaleY: 0.94, duration: 0.07 }, ti + 0.5);
    to('#ball .in2', { scaleX: 1, scaleY: 1, duration: 0.22, ease: 'elastic.out(1, 0.5)' }, ti + 0.57);
  });
  /* kugla raste do konture, broj 20:25 → 19:59 */
  const grow = T.ev.grow12;
  to(ball, { scale: 0.923, duration: 0.6, ease: 'back.out(1.6)' }, grow);
  to(contour, { opacity: 1, duration: 0.3 }, grow);
  to('#contourC', { attr: { 'stroke-dasharray': '1640 0' }, duration: 0.01 }, grow + 0.55);
  const fmt = (v) => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
  counter(q1('#ballTxt'), 1225, 1199, grow + 0.1, 0.85, fmt);
  set('#stampCilj', { x: 640, y: 780, rotation: -26, scale: 2.4, opacity: 0 });
  const stampT = T.ev.stamp12;
  to('#stampCilj', { rotation: -10, scale: 1, opacity: 1, duration: 0.28, ease: 'power4.in' }, stampT);
  to(ball, { y: '+=8', duration: 0.07, ease: 'power2.out', yoyo: true, repeat: 1 }, stampT + 0.28);
  titleIn('t12', S(12).voStart, W(12, 'gde'));

  /* ---------- 3D prolet kroz kadrove ---------- */
  const fly = T.outro.fly, flyDur = T.outro.ai - T.outro.fly;
  titleOut('t12', fly - 0.1);
  to(['#stage', '#stampCilj', '#deco'], { scale: 0.35, opacity: 0, duration: 0.5, ease: 'power3.in', transformOrigin: '50% 55%' }, fly - 0.05);
  set('#fly', { opacity: 0 }); to('#fly', { opacity: 1, duration: 0.2 }, fly);
  const thumbs = qa('.thumb');
  thumbs.forEach((th, i) => {
    const side = i % 2 ? 1 : -1;
    const z0 = -700 - i * 520, travel = 5200;
    set(th, { x: side * (170 + (i % 3) * 40), y: (i % 3 - 1) * 110, z: z0, rotationY: -side * 16, rotationX: 4, opacity: 0 });
    to(th, { opacity: 1, duration: 0.15 }, fly + 0.02 + i * 0.02);
    to(th, { z: z0 + travel, duration: flyDur, ease: 'power1.in' }, fly);
    /* nestaje pre nego što prođe kroz kameru */
    const p = Math.min(0.98, Math.max(0.05, (300 - z0) / travel));
    to(th, { opacity: 0, duration: 0.12 }, fly + flyDur * Math.pow(p, 1 / 2) - 0.06);
  });
  to('#fly', { opacity: 0, duration: 0.2 }, T.outro.ai - 0.05);

  /* ---------- „Napravljeno sa AI" ---------- */
  set('#ai', { opacity: 0, scale: 0.6, y: 30 });
  to('#ai', { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(2)' }, T.outro.ai);
  to('#ai', { opacity: 0, scale: 0.8, y: -30, duration: 0.25, ease: 'power2.in' }, T.outro.lockup - 0.15);

  /* ---------- lockup: kugla padne u glavu trkača, logo se otvori iz te tačke ---------- */
  const lk = T.outro.lockup;
  set('#lock', { opacity: 1 });
  set('#lockLogo', { clipPath: 'circle(0px at 52.7% 27.9%)' });
  set('#word', { opacity: 0, y: 40 }); set('#url', { opacity: 0, y: 40 });
  const LH = { x: 360 + 0.527 * 360, y: 700 + 0.279 * 360, d: 0.102 * 360 };
  const b2 = q1('#ball2');
  set(b2, C(b2, LH.x, -200, { scale: 0.7 }));
  set('#ball2W', { opacity: 0 });
  to(b2, { y: LH.y - 100, duration: 0.42, ease: 'power2.in' }, lk);
  to(b2, { scale: LH.d / 160, duration: 0.3, ease: 'power3.inOut' }, lk + 0.36);
  to('#ball2W', { opacity: 1, duration: 0.2 }, lk + 0.42);
  to('#lockLogo', { clipPath: 'circle(140% at 52.7% 27.9%)', duration: 0.6, ease: 'power3.in' }, lk + 0.62);
  set(b2, { opacity: 0 }, lk + 1.0);
  to('#word', { opacity: 1, y: 0, duration: 0.5 }, lk + 0.95);
  to('#url', { opacity: 1, y: 0, duration: 0.5 }, lk + 1.1);
  titleIn('t12', lk + 1.25, lk + 1.4);
  /* poslednja scena sme da ima izlaz: kuglice se raziđu */
  DECO.forEach((d, i) => to(d.el, { x: d.tx < 540 ? -120 : 1200, opacity: 0, duration: 1.0, ease: 'power2.in' }, TOTAL - 1.1 + i * 0.02));
  set('#deco', { scale: 1, opacity: 1 }, lk);

  window.__SUB20_TL = tl;
})();
