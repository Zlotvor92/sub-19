/* 01 · PERFORMANCE LAB — sportski instrument: telemetrija, hairline linije umesto kartica, mono brojevi. */
(function () {
  const PH = { BAZA: '#5C7FA3', RAZVOJ: '#4FA79A', VRHUNAC: '#D9A441', TAPER: '#9C86C9', TRKA: '#E5584A' };
  const TY = { e: '#6B717A', l: '#E9EBEE', t: '#E0B04A', i: '#FF7A1A', s: '#8E6BD9', r: '#2c3036' };
  const tag = (src) => `<span class="tg ${src}">${{ m: 'MERENO', e: 'PROCENA', p: 'PROJEKCIJA' }[src]}</span>`;
  const nav = (act) => `<nav class="foot nav">${NAV.slice(0, 4).map(([i, t]) => `<button class="${i === act ? 'on' : ''}">${ICON[i](1.7)}<span>${t.toUpperCase().slice(0, 7)}</span></button>`).join('')}<button>${ICON.crowd(1.7)}<span>ZAJED.</span></button></nav>`;
  const cta = `<div class="foot cta"><button class="go">ZAVRŠI TRENING</button><button class="sk">PRESKOČI</button></div>`;
  const top = (l, r) => `<header class="top"><div class="mk"><svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="9" fill="none" stroke="#3a3f46" stroke-width="3"/><circle cx="12" cy="12" r="9" fill="none" stroke="#FF7A1A" stroke-width="3" stroke-dasharray="56.5" stroke-dashoffset="14" transform="rotate(-60 12 12)" stroke-linecap="round"/></svg><b>SUB-20</b></div><div class="r"><span>${l}</span><span class="d">${r}</span></div></header>`;
  const rail = () => `<div class="rail">${D.W.map((k) => `<i class="${k.w < 6 ? 'p' : k.w === 6 ? 'n' : ''}" style="--c:${PH[k.ph]}"></i>`).join('')}</div>`;

  const today = () => `
<div class="body">${top('W06 · D03', 'T−46')}
<section class="hero rise" style="--i:0">
  <div class="k"><span>SRE 04.11.</span><span>${D.phaseOf(6).k} · N6/12</span></div>
  <div class="tp"><div class="lbl">TARGET PACE ${tag('e')}</div><div class="big"><b>${pace(D.session.workPace)}</b><u>/km</u></div></div>
  <div class="ttl"><b>FARTLEK</b><span>7 × 60 s brzo · 60 s oporavak</span></div>
</section>
<section class="prof rise" style="--i:1">${profile({ w: 342, h: 104, easy: '#3a3f46', work: '#FF7A1A', labels: true, txt: '#6b717a', font: 'JetBrains Mono', r: 1.5, gap: 1 }).svg}</section>
<section class="ro rise" style="--i:2">
  <div><i>DIST</i><b>8,6<u>km</u></b></div><div><i>TIME</i><b>≈42<u>min</u></b></div><div><i>RPE</i><b>8–9</b></div><div><i>HR</i><b>Z4–5<u>164–182</u></b></div>
</section>
<p class="feel rise" style="--i:3">${D.session.guide}</p>
<section class="ch rise" style="--i:4">
  <div class="row"><i>FAZA</i>${rail()}<b>N6/12</b></div>
  <div class="row"><i>NED. OBIM</i><div class="bar"><span style="width:${(7.8 / 37.9) * 100}%"></span></div><b>7,8 / 37,9</b></div>
  <div class="row"><i>SLEDEĆE</i><em>PET 06.11 · TEMPO 3,7 km @ 4:17</em></div>
</section>
</div>${cta}${nav('today')}`;

  const workout = () => {
    const seg = [
      ['01', 'ZAGREVANJE', '3,0 km', '5:09 /km', '15:27', 'Z2', 927, '#3a3f46'],
      ['02', 'RAD', '7 × 60 s', '4:00 /km', '7:00', 'Z4–5', 420, '#FF7A1A'],
      ['03', 'ODMOR', '6 × 60 s', 'lagano', '6:00', 'Z1–2', 360, '#4a4f57'],
      ['04', 'HLAĐENJE', '2,5 km', '5:09 /km', '12:53', 'Z2', 773, '#3a3f46']
    ];
    const tot = 927 + 420 + 360 + 773;
    return `<div class="body">${top('‹ DANAS', 'N6 · D3')}
<section class="h2 rise" style="--i:0"><div class="eyebrow">Q-SESIJA · ${D.phaseOf(6).k} · ${D.session.focus.toUpperCase()}</div><h1>FARTLEK</h1></section>
<section class="g4 rise" style="--i:1"><div><i>DISTANCA</i><b>8,6<u>km</u></b></div><div><i>TRAJANJE ${''}</i><b>≈42:20</b></div><div><i>CILJNI TEMPO</i><b>4:00<u>/km</u></b>${tag('e')}</div><div><i>INTENZITET</i><b>RPE 8–9</b></div></section>
<section class="prof big rise" style="--i:2">${profile({ w: 342, h: 130, easy: '#3a3f46', work: '#FF7A1A', labels: true, txt: '#6b717a', font: 'JetBrains Mono', r: 1.5, gap: 1, base: '#2c3036' }).svg}</section>
<section class="segs rise" style="--i:3">${seg.map(([n, a, b, c, d, z, t, col]) => `<div class="sg"><span class="n">${n}</span><div class="m"><b>${a}</b><em>${b} · ${c}</em><div class="bar"><span style="width:${(t / tot) * 100}%;background:${col}"></span></div></div><div class="x"><b>${d}</b><i>${z}</i></div></div>`).join('')}</section>
<section class="hrg rise" style="--i:4"><i>HR VODIČ</i><b>${D.session.hr}</b><em>izvor: intervals.icu zone · prikazuje se samo kad su zone povezane</em></section>
<section class="why rise" style="--i:5"><i>ZAŠTO OVAJ TRENING</i><p>${D.session.guide}</p><p class="d">Faza ${D.phaseOf(6).k}: ${D.phaseOf(6).line}</p></section>
</div>${cta.replace('class="foot cta"', 'class="foot cta solo"')}`;
  };

  const plan = () => {
    const wk = D.week6;
    const ph = D.phases;
    return `<div class="body">${top('PLAN', 'TRKA 20.12.')}
<section class="h2 rise" style="--i:0"><div class="eyebrow">PERIODIZACIJA · 12 NEDELJA</div><h1 class="s">Obim po nedelji</h1></section>
<section class="pc rise" style="--i:1">${weekBars({ w: 342, h: 150, phaseColors: PH, cur: '#fff', txt: '#6b717a', font: 'JetBrains Mono', grid: '#1c1f23', r: 1.5, gap: 4 })}
  <div class="band">${ph.map((p) => `<span style="flex:${p.to - p.from + 1};--c:${PH[p.k]}"><b>${p.to > p.from ? p.k : p.k.slice(0, 3)}</b></span>`).join('')}</div></section>
<section class="g3 rise" style="--i:2"><div><i>ISTRČANO</i><b>148,0<u>km</u></b></div><div><i>PLAN DO SADA</i><b>96<u>%</u></b></div><div><i>UKUPNO</i><b>367,6<u>km</u></b></div></section>
<section class="wk rise" style="--i:3"><div class="wh"><b>N6 · RAZVOJ</b><em>02–08.11. · 7,8 / 37,9 km</em></div>
${wk.map((d) => `<div class="dr ${d.st}"><span class="dw">${d.dow.toUpperCase()}<b>${d.dd}</b></span><span class="sq" style="background:${TY[KIND[d.t]]}"></span><span class="nm">${d.name.toUpperCase()}<em>${d.core}</em></span><span class="km">${d.km ? kmf(d.km) : ''}</span><span class="st">${d.st === 'done' ? ICON.check(2.6) : d.st === 'today' ? '●' : ''}</span></div>`).join('')}</section>
<section class="more rise" style="--i:4"><div><b>N7</b><em>INTERVALI + TEMPO ISPR.</em><span>39,4</span></div><div class="dl"><b>N8</b><em>DELOAD</em><span>27,1</span></div></section>
</div>${nav('plan')}`;
  };

  const progress = () => `<div class="body">${top('TELEMETRIJA', 'N6')}
<section class="h2 rise" style="--i:0"><div class="eyebrow">DA LI NAPREDUJEM?</div><h1 class="s">Forma: <span class="est">49,2</span> <small>(+1,1 od starta)</small></h1></section>
<section class="lg rise" style="--i:1"><span class="m">◆ MERENO</span><span class="e">● PROCENA</span><span class="p">┄ PROJEKCIJA</span></section>
<section class="chn rise" style="--i:2"><div class="cl"><b>CH1 · VDOT</b>${tag('e')}</div>${vdotChart({ w: 342, h: 190, font: 'JetBrains Mono', col: { est: '#7FB2FF', meas: '#fff', proj: '#9AA0A8', goal: '#FF7A1A', grid: '#1c1f23', txt: '#6b717a', now: '#3a3f46', area: '' }, labels: { goal: true, proj: true, est: true, test: true }, estW: 2 })}</section>
<section class="chn two rise" style="--i:3">
  <div><div class="cl"><b>CH2 · LAGAN TEMPO</b>${tag('m')}</div><div class="rd"><b>5:21</b><u>/km</u><em>▼ 11 s</em></div>${spark(D.trend.easyPace.map((v) => -v), { w: 150, h: 44, color: '#E9EBEE', sw: 1.6 })}</div>
  <div><div class="cl"><b>CH3 · PULS (LAGANO)</b>${tag('m')}</div><div class="rd"><b>148</b><u>bpm</u><em>▼ 5</em></div>${spark(D.trend.easyHr.map((v) => -v), { w: 150, h: 44, color: '#E9EBEE', sw: 1.6 })}</div>
</section>
<section class="pr rise" style="--i:4"><div class="cl"><b>PREDIKCIJA TRKE</b></div>
  <div class="r hero"><span>5 km danas</span><b>20:13</b>${tag('e')}</div>
  <div class="r"><span>cilj</span><b>19:59</b><em>Δ +0:14</em></div>
  <div class="r"><span>projekcija plana · 20.12.</span><b>19:45</b>${tag('p')}</div>
  <div class="r"><span>10 km danas</span><b>41:54</b>${tag('e')}</div><div class="r"><span>polumaraton danas</span><b>1:32:48</b>${tag('e')}</div></section>
<section class="ms rise" style="--i:5"><div class="cl"><b>MILESTONES</b></div><p class="d">✓ VDOT +1,1 od starta (48,1 → 49,2)</p><p class="d">✓ Najjača nedelja 35,6 km (N3)</p><p class="d">✓ 18 / 46 trčanja · plan do sada 96 %</p><p>○ Test 3 km: poslednji 25.10. · 11:45 ${tag('m')}</p></section>
</div>${nav('race')}`;

  const css = `
&{background:#0B0C0E;color:#E9EBEE;font-family:'Inter Tight',system-ui,sans-serif;--sb:#E9EBEE}
.body{padding-bottom:18px}
.mono,.hero .big,.ro b,.g4 b,.g3 b,.rd,.pr b,.dr .km,.dr .dw,.ch b,.k,.top .r,.sg .x b,.tg,.eyebrow,.lg,.wh em,.more span,.cl{font-family:'JetBrains Mono',ui-monospace,monospace}
.top{display:flex;align-items:center;justify-content:space-between;padding:6px 18px 10px;border-bottom:1px solid #1c1f23}
.mk{display:flex;gap:8px;align-items:center}.mk b{font-size:13px;letter-spacing:.14em;font-weight:800}
.top .r{display:flex;gap:14px;font-size:11px;color:#8A9099;letter-spacing:.04em}.top .d{color:#E9EBEE}
section{padding:14px 18px;border-bottom:1px solid #1c1f23}
.hero .k{display:flex;justify-content:space-between;font-size:11px;color:#8A9099;letter-spacing:.06em}
.hero .lbl{margin-top:20px;font-size:10px;letter-spacing:.14em;color:#8A9099;display:flex;gap:8px;align-items:center}
.hero .big{display:flex;align-items:baseline;gap:6px;line-height:.95}
.hero .big b{font-size:96px;font-weight:500;letter-spacing:-.05em;color:#fff}
.hero .big u{text-decoration:none;font-size:18px;color:#8A9099}
.hero .ttl{margin-top:8px;display:flex;flex-direction:column;gap:2px}
.hero .ttl b{font-size:15px;letter-spacing:.16em;font-weight:800;color:#FF7A1A}
.hero .ttl span{font-size:13px;color:#aab0b8}
.tg{font-size:8.5px;font-weight:600;letter-spacing:.08em;padding:2px 5px;border:1px solid;border-radius:2px;line-height:1.1;vertical-align:middle}
.tg.m{color:#fff;border-color:#fff}.tg.e{color:#7FB2FF;border-color:#7FB2FF}.tg.p{color:#9AA0A8;border-color:#9AA0A8;border-style:dashed}
.prof{padding:8px 18px 12px}.prof svg{display:block}
.ro{display:grid;grid-template-columns:repeat(4,1fr);gap:0;padding:0}
.ro div{padding:12px 12px 12px 18px;border-right:1px solid #1c1f23}.ro div:last-child{border:0}
.ro i{display:block;font-style:normal;font-size:9.5px;letter-spacing:.14em;color:#8A9099}
.ro b{display:block;font-size:19px;font-weight:500;margin-top:4px;letter-spacing:-.02em}
.ro u{text-decoration:none;font-size:10px;color:#8A9099;margin-left:3px;display:block;margin:2px 0 0}
.feel{padding:12px 18px;font-size:13.5px;color:#aab0b8;border-bottom:1px solid #1c1f23;line-height:1.45}
.ch{display:flex;flex-direction:column;gap:12px}
.ch .row{display:grid;grid-template-columns:76px 1fr auto;gap:10px;align-items:center;font-size:12px}
.ch i{font-style:normal;font-size:9.5px;letter-spacing:.14em;color:#8A9099}
.ch b{font-weight:500;font-size:11.5px}
.ch em{grid-column:2/4;font-style:normal;font-size:11.5px;color:#E9EBEE;font-family:'JetBrains Mono',monospace}
.rail{display:flex;gap:2px}.rail i{flex:1;height:10px;background:var(--c);opacity:.28;border-radius:1px}
.rail i.p{opacity:1}.rail i.n{opacity:1;outline:1.5px solid #fff;outline-offset:1.5px}
.bar{height:6px;background:#1c1f23;border-radius:1px;overflow:hidden}.bar span{display:block;height:100%;background:#E9EBEE;transform-origin:left;animation:lab-grow2 .8s .3s both}
@keyframes lab-grow2{from{transform:scaleX(0)}}
.cta{padding:10px 18px 10px;display:flex;gap:8px;background:#0B0C0E;border-top:1px solid #1c1f23}
.cta.solo{padding-bottom:30px}
.go{flex:1;height:52px;border:1.5px solid #FF7A1A;color:#FF7A1A;font:800 13px 'Inter Tight';letter-spacing:.16em;border-radius:3px;background:rgba(255,122,26,.06)}
.go:active{background:#FF7A1A;color:#0B0C0E}
.sk{width:92px;border:1px solid #2c3036;color:#8A9099;font:700 11px 'Inter Tight';letter-spacing:.12em;border-radius:3px}
.nav{display:grid;grid-template-columns:repeat(5,1fr);padding:2px 6px 22px;border-top:0;background:#0B0C0E}
.nav button{display:flex;flex-direction:column;align-items:center;gap:4px;padding:9px 0 6px;color:#6b717a;font:600 9px 'JetBrains Mono';letter-spacing:.08em;position:relative}
.nav button svg{width:20px;height:20px}
.nav button.on{color:#fff}.nav button.on::before{content:"";position:absolute;top:0;left:22%;right:22%;height:2px;background:#FF7A1A}
/* workout */
.h2{padding-top:16px}.eyebrow{font-size:10px;letter-spacing:.14em;color:#8A9099}
.h2 h1{font-size:34px;letter-spacing:.06em;font-weight:800;margin-top:6px;line-height:1}.h2 h1.s{font-size:24px;letter-spacing:-.01em;font-weight:700}
.h2 h1 small{font-size:12px;color:#8A9099;font-weight:500;font-family:'JetBrains Mono'}.h2 h1 .est{color:#7FB2FF;font-family:'JetBrains Mono';font-weight:500}
.g4{display:grid;grid-template-columns:1fr 1fr;padding:0}
.g4 div{padding:14px 18px;border-bottom:1px solid #1c1f23;border-right:1px solid #1c1f23;position:relative}.g4 div:nth-child(2n){border-right:0}.g4 div:nth-child(n+3){border-bottom:0}
.g4 i{display:block;font-style:normal;font-size:9.5px;letter-spacing:.14em;color:#8A9099}.g4 b{display:block;font-size:24px;font-weight:500;margin-top:4px;letter-spacing:-.02em}.g4 u{text-decoration:none;font-size:11px;color:#8A9099;margin-left:3px}
.g4 .tg{position:absolute;right:14px;top:14px}
.prof.big{padding:14px 18px}
.segs{padding:0}.sg{display:grid;grid-template-columns:34px 1fr auto;gap:8px;padding:12px 18px;border-bottom:1px solid #1c1f23;align-items:start}
.sg .n{font:500 11px 'JetBrains Mono';color:#6b717a;padding-top:2px}.sg .m b{font-size:12px;letter-spacing:.14em;font-weight:700}.sg .m em{display:block;font-style:normal;font:500 12px 'JetBrains Mono';color:#aab0b8;margin:3px 0 7px}
.sg .x{text-align:right}.sg .x b{display:block;font-weight:500;font-size:14px}.sg .x i{font:500 10px 'JetBrains Mono';color:#7FB2FF;font-style:normal}
.hrg{display:grid;gap:3px}.hrg i,.why i{font-style:normal;font-size:9.5px;letter-spacing:.14em;color:#8A9099}.hrg b{font:500 16px 'JetBrains Mono'}.hrg em{font-style:normal;font-size:11px;color:#6b717a}
.why p{font-size:14px;line-height:1.5;margin-top:6px;color:#d3d6db}.why p.d{color:#8A9099;font-size:13px}
/* plan */
.pc{padding:12px 14px 14px}.band{display:flex;gap:2px;margin:2px 3% 0 6.6%}.band span{height:18px;background:var(--c);opacity:.9;position:relative;border-radius:1px;overflow:hidden}.band b{position:absolute;left:4px;top:3px;font:700 8px 'JetBrains Mono';letter-spacing:.05em;color:#0B0C0E;white-space:nowrap}
.g3{display:grid;grid-template-columns:repeat(3,1fr);padding:0}.g3 div{padding:12px 18px;border-right:1px solid #1c1f23}.g3 div:last-child{border:0}
.g3 i{display:block;font-style:normal;font-size:9.5px;letter-spacing:.14em;color:#8A9099}.g3 b{font-size:19px;font-weight:500}.g3 u{text-decoration:none;font-size:10px;color:#8A9099;margin-left:3px}
.wk{padding:0}.wh{display:flex;justify-content:space-between;align-items:baseline;padding:12px 18px;background:#101215}.wh b{font-size:12px;letter-spacing:.14em}.wh em{font-style:normal;font-size:10.5px;color:#8A9099}
.dr{display:grid;grid-template-columns:44px 8px 1fr auto 20px;gap:10px;align-items:center;padding:10px 18px;border-top:1px solid #1c1f23;min-height:46px}
.dr .dw{font-size:10px;color:#8A9099;display:flex;flex-direction:column;line-height:1.2}.dr .dw b{font-size:14px;color:#E9EBEE;font-weight:500}
.dr .sq{width:8px;height:8px;border-radius:1px}.dr .nm{font-size:12px;letter-spacing:.1em;font-weight:700}.dr .nm em{display:block;font-style:normal;font:500 11px 'JetBrains Mono';letter-spacing:0;color:#8A9099;margin-top:2px}
.dr .km{font-size:13px}.dr .st{color:#FF7A1A;width:16px;font-size:10px}.dr .st svg{width:15px;height:15px;color:#7fe2a3}
.dr.rest{opacity:.4;min-height:34px;padding:6px 18px}.dr.done .nm{color:#8A9099}
.dr.today{background:rgba(255,122,26,.07);box-shadow:inset 2px 0 #FF7A1A}
.more{padding:0}.more div{display:grid;grid-template-columns:34px 1fr auto;padding:14px 18px;border-top:1px solid #1c1f23;font-size:12px;align-items:center}.more b{letter-spacing:.1em}.more em{font-style:normal;color:#8A9099;font-size:10.5px;letter-spacing:.06em}.more .dl{opacity:.6}
/* progress */
.lg{display:flex;gap:16px;font-size:10px;letter-spacing:.06em;padding:10px 18px}.lg .m{color:#fff}.lg .e{color:#7FB2FF}.lg .p{color:#9AA0A8}
.chn .cl,.pr .cl,.ms .cl{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.cl b{font-size:10px;letter-spacing:.14em;color:#8A9099;font-weight:600}
.chn.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.chn.two .rd{display:flex;align-items:baseline;gap:4px;margin:4px 0 2px}.rd b{font-size:26px;font-weight:500;letter-spacing:-.03em}.rd u{text-decoration:none;font-size:10px;color:#8A9099}.rd em{font-style:normal;color:#7fe2a3;font-size:11px;margin-left:6px}
.pr .r{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:9px 0;border-top:1px solid #1c1f23;font-size:13px}.pr .r span{color:#aab0b8}.pr .r b{font-size:15px;font-weight:500}.pr .r.hero b{font-size:22px;color:#7FB2FF}.pr .r em{font:500 11px 'JetBrains Mono';font-style:normal;color:#FF7A1A;grid-column:3}
.ms p{font-size:13px;margin:6px 0;color:#d3d6db}.ms p.d{color:#aab0b8}
`;

  (window.CONCEPTS = window.CONCEPTS || []).push({
    id: '01', name: 'PERFORMANCE LAB', tag: 'Sportski instrument. Telemetrija, hairline mreža, mono brojevi, bez kartica.',
    css, screens: { today, workout, plan, progress },
    spec: {
      philosophy: 'Ekran je instrument, ne feed. Jedna veličina je heroj (ciljni tempo), sve ostalo su „kanali“ sa jedinicama. Pouzdanost je estetika: svaka vrednost nosi oznaku porekla (MERENO / PROCENA / PROJEKCIJA).',
      type: 'Mono za sve brojeve (tabularne cifre, JetBrains Mono), uska grotesk za oznake (Inter Tight). Kapitalne oznake 9.5px sa razmakom 0.14em samo za LABELE, nikad za rečenice.',
      layout: 'Bez kartica: hairline mreža 1px, sekcije su „kanali“. Jedan dominantan blok po ekranu, ostalo čita se kao tabela instrumenta.',
      nav: 'Donja traka sa ikonicom i skraćenim kapitalnim nazivom; aktivni tab = narandžasta crta na vrhu. Vrh: kod nedelje/dana (W06·D03) i odbrojavanje (T−46).',
      today: 'Heroj = ciljni tempo 4:00 u 96px mono. Ispod njega profil sesije (visina stuba = brzina). Zatim 4 očitavanja (DIST/TIME/RPE/HR), jedna rečenica „kako“, pa 3 reda konteksta (faza, nedeljni obim, sledeće).',
      plan: 'Profil opterećenja 12 nedelja sa bojom faze (BAZA→TRKA) i okvirom na tekućoj nedelji, ispod traka faza. Nedelja u toku je razvijena, ostale su jedan red.',
      workout: 'Segmenti kao tabela sa proporcionalnim trakama trajanja: zagrevanje / rad / odmor / hlađenje, svaki sa tempom, vremenom i zonom. HR vodič i „zašto“ ispod.',
      data: 'Telemetrijski kanali sa zajedničkom x-osom: VDOT (procena, plava linija) sa testom 3 km (mereno, romb) i projekcijom (isprekidano); lagan tempo i puls (mereno). Tabela predikcije sa oznakama porekla.',
      motion: 'Instrumentalno: stubovi profila rastu sleva nadesno, linije se crtaju, brojevi odmah tačni (bez count-up šuma). 150–400 ms, bez bounce-a.',
      mobile: 'Jedan palac: CTA je zakačen iznad trake. Hairline redovi su 46px — cilj dodira ispunjen. Dugačak sadržaj se skroluje, CTA ostaje.',
      desktop: 'Instrumentni panel u 3 kolone: levo sesija (profil + očitavanja), sredina kanali telemetrije, desno plan/nedelja. Gustina raste, hijerarhija ostaje.',
      key: 'Today (tab 1): „4:00“ kao jedini veliki broj.',
      cost: 'Jedan mono font (JetBrains Mono ~35 KB woff2 za latin + latin-ext, samostalno hostovan zbog CSP), CSS ~6 KB. Nula novih biblioteka.'
    }
  });
})();
