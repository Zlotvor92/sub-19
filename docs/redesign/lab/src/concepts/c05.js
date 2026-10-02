/* 05 · POSTER — hrabra tipografija, krupni brojevi, dramatična hijerarhija (inspirisano energijom, ne brendom). */
(function () {
  const A = '#FF5A36';
  const nav = (act) => `<nav class="foot nav">${['DANAS', 'PLAN', 'OPORAVAK', 'TRKA', 'ZAJEDNICA'].map((t, i) => `<button class="${i === act ? 'on' : ''}">${t}</button>`).join('')}</nav>`;
  const top = (r) => `<header class="top"><b>SUB-20</b><span>${r}</span></header>`;
  const cta = (solo) => `<div class="foot dock ${solo ? 'solo' : ''}"><button class="go">ZAVRŠI<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg></button></div>`;
  const tg = (t, c = 'b') => `<i class="tg ${c}">${t}</i>`;

  const today = () => `
<div class="body">${top('T−46')}
<section class="blk rise" style="--i:0"><p class="k">SRE 04.11 · NEDELJA 6/12 · RAZVOJ</p><div class="huge">7<em>×</em>60</div><p class="u">SEKUNDI NA <b>4:00</b>/KM</p><p class="t">FARTLEK</p></section>
<section class="st rise" style="--i:1"><div><b>8,6</b><span>KM</span></div><div><b>42</b><span>MIN</span></div><div><b>8–9</b><span>NAPOR</span></div></section>
<section class="nx rise" style="--i:2"><span>SLEDEĆE</span><b>PET · TEMPO 9,2 KM</b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg></section>
</div>${cta()}${nav(0)}`;

  const workout = () => `
<div class="body">${top('N6 · D3')}
<section class="h rise" style="--i:0"><p class="k">SRE 04.11 · RAZVOJ</p><h1>FARTLEK</h1></section>
<section class="b1 rise" style="--i:1"><div><b>3</b><em>KM</em></div><p>ZAGREVANJE<br><span>5:09 /KM</span></p></section>
<section class="b2 rise" style="--i:2"><div class="r"><b>7<em>×</em>60<em>S</em></b></div><p class="p">4:00<span>/KM</span> ${tg('PROCENA', 'k')}</p><div class="bars">${'<i></i>'.repeat(7)}</div><p class="o">60 S LAGANO IZMEĐU</p></section>
<section class="b1 rise" style="--i:3"><div><b>2,5</b><em>KM</em></div><p>HLAĐENJE<br><span>5:09 /KM</span></p></section>
<section class="gl rise" style="--i:4"><div><b>≈42</b><span>MIN</span></div><div><b>8,6</b><span>KM</span></div><div><b>RPE 8–9</b><span>NAPOR</span></div><div><b>Z4–Z5</b><span>164–182 BPM</span></div></section>
<section class="why rise" style="--i:5"><p class="k">ZAŠTO</p><p class="x">${D.session.guide}</p></section>
</div>${cta(true)}`;

  const plan = () => `
<div class="body">${top('TRKA 20.12.')}
<section class="h rise" style="--i:0"><p class="k">12 NEDELJA · 148 / 367,6 KM</p><h1>PLAN</h1></section>
<section class="ph done rise" style="--i:1"><b>BAZA</b><em>1–4</em><span>105,2 KM ✓</span></section>
<section class="ph on rise" style="--i:2"><b>RAZVOJ</b><em>5–8</em><span>NEDELJA 6</span></section>
<div class="wk rise" style="--i:3"><span class="n">05</span><div><b>INTERVALI + TEMPO</b></div><span class="km">34,8<small>✓</small></div>
<div class="wk cur rise" style="--i:4"><span class="n">06</span><div><b>FARTLEK + TEMPO</b><div class="dy">${D.week6.map((d) => `<i class="${d.st}" style="height:${d.km ? 8 + d.km * 3 : 6}px"><u>${d.dow[0]}</u></i>`).join('')}</div></div><span class="km">37,9<small>1/4</small></span></div>
<div class="wk rise" style="--i:5"><span class="n">07</span><div><b>INTERVALI + TEMPO</b></div><span class="km">39,4</span></div>
<div class="wk dl rise" style="--i:6"><span class="n">08</span><div><b>RASTEREĆENJE</b></div><span class="km">27,1</span></div>
<section class="ph rise" style="--i:7"><b>VRHUNAC</b><em>9–10</em><span>78,7 KM</span></section>
<section class="ph rise" style="--i:8"><b>TAPER</b><em>11</em><span>24,3 KM</span></section>
<section class="ph race rise" style="--i:9"><b>TRKA</b><em>12</em><span>5K · 19:59</span></section>
</div>${nav(1)}`;

  const progress = () => `
<div class="body">${top('NAPREDAK')}
<section class="blk gap rise" style="--i:0"><p class="k">DO CILJA 19:59</p><div class="huge">14<em>S</em></div><p class="u">PROCENA DANAS <b>20:13</b> ${tg('PROCENA', 'k')}</p></section>
<section class="ch rise" style="--i:1"><p class="k">VDOT · 48,1 → 49,2</p>${vdotChart({ w: 342, h: 180, font: 'Barlow Condensed', estW: 4.5, projW: 3, ls: 12, ticks: [48, 49, 50, 51], col: { est: A, meas: '#F4F1EA', proj: '#F4F1EA', goal: '#F4F1EA', grid: '#222', txt: '#777', now: '#333', area: '' }, labels: { goal: 'CILJ 49,9', proj: 'PROJEKCIJA 50,6', est: '49,2', test: 'TEST' }, projDash: '3 6' })}
<div class="lg"><span><i class="d"></i>IZMERENO</span><span><i class="l"></i>PROCENA</span><span><i class="x"></i>PROJEKCIJA</span></div></section>
<section class="pr rise" style="--i:2"><div><span>5K DANAS</span><b>20:13</b>${tg('PROCENA', 'k')}</div><div><span>PLAN VODI DO</span><b>19:45</b>${tg('PROJEKCIJA', 'o')}</div><div><span>TEST 3 KM</span><b>11:45</b>${tg('IZMERENO', 'b')}</div><div><span>10K DANAS</span><b>41:54</b>${tg('PROCENA', 'k')}</div></section>
<section class="gl3 rise" style="--i:3"><div><b>+1,1</b><span>VDOT</span></div><div><b>35,6</b><span>KM NAJJAČA</span></div><div><b>96%</b><span>PLAN</span></div></section>
</div>${nav(3)}`;

  const css = `
&{background:#0A0A0A;color:#F4F1EA;font-family:'Barlow Condensed',sans-serif;font-style:italic;font-weight:800;text-transform:uppercase;--sb:#F4F1EA}
.body{padding-bottom:14px}
.top{display:flex;justify-content:space-between;align-items:baseline;padding:4px 20px 10px}.top b{font-size:24px;letter-spacing:.02em}.top span{font-size:16px;color:#9a9a96;font-weight:700}
.k{font-size:15px;font-weight:700;letter-spacing:.08em}
.blk{background:${A};color:#0A0A0A;padding:18px 20px 22px}
.huge{font-size:196px;line-height:.78;letter-spacing:-.025em;margin:18px 0 12px -4px;white-space:nowrap}.huge em{font-size:.62em;vertical-align:.18em;padding:0 .04em}
.u{font-size:28px;line-height:1}.u b{font-weight:800}.blk .t{font-size:20px;margin-top:12px;letter-spacing:.14em;font-weight:700}
.tg{font-style:normal;font-size:11px;font-weight:800;letter-spacing:.1em;padding:2px 6px;display:inline-block;vertical-align:middle;margin-left:6px;line-height:1.2}
.tg.k{background:#0A0A0A;color:#F4F1EA}.tg.b{background:#F4F1EA;color:#0A0A0A}.tg.o{border:1.5px dashed #F4F1EA;color:#F4F1EA}.blk .tg.k{background:#0A0A0A;color:${A}}
.st{display:grid;grid-template-columns:repeat(3,auto);justify-content:space-between;padding:20px 20px 14px;border-bottom:2px solid #1c1c1c}
.st b{font-size:70px;line-height:.85;letter-spacing:-.01em;display:block}.st span{font-size:18px;color:#9a9a96;letter-spacing:.1em;font-weight:700}
.nx{display:flex;align-items:center;gap:12px;padding:16px 20px;font-size:20px}.nx span{color:#9a9a96;letter-spacing:.1em;font-size:15px}.nx b{flex:1;font-weight:800}.nx svg{width:24px;height:24px;color:${A}}
.dock{padding:8px 16px 8px;background:linear-gradient(0deg,#0A0A0A 70%,rgba(10,10,10,0))}.dock.solo{padding-bottom:30px}
.go{width:100%;height:68px;background:#F4F1EA;color:#0A0A0A;font:800 38px 'Barlow Condensed';font-style:italic;letter-spacing:.02em;display:flex;align-items:center;justify-content:space-between;padding:0 22px}.go svg{width:34px;height:34px}.go:active{background:${A}}
.nav{display:flex;justify-content:space-between;padding:10px 18px 26px;background:#0A0A0A;border-top:2px solid #1c1c1c}.nav button{font:800 15px 'Barlow Condensed';font-style:italic;letter-spacing:.06em;color:#6c6c68;padding:4px 0;text-transform:uppercase}.nav .on{color:#F4F1EA;border-bottom:3px solid ${A}}
.h{padding:6px 20px 14px}.h h1{font-size:96px;line-height:.85;margin-top:8px;letter-spacing:-.01em}
.b1{display:flex;align-items:center;gap:18px;background:#1B1B1B;padding:18px 20px;margin-top:3px}.b1 div{display:flex;align-items:baseline;gap:4px;min-width:104px}.b1 b{font-size:78px;line-height:.8}.b1 em{font-size:24px}.b1 p{font-size:24px;line-height:1.05}.b1 p span{color:#9a9a96;font-size:20px;font-weight:700}
.b2{background:${A};color:#0A0A0A;padding:20px 20px 18px;margin-top:3px}.b2 .r b{font-size:112px;line-height:.8;white-space:nowrap}.b2 .r em{font-size:.6em;padding:0 .04em}.b2 .p{font-size:52px;line-height:1;margin-top:12px}.b2 .p span{font-size:28px}.b2 .p .tg{font-size:12px;vertical-align:top;margin-top:6px}
.bars{display:flex;gap:6px;margin:14px 0 8px;align-items:flex-end;height:34px}.bars i{flex:1;background:#0A0A0A;height:100%;transform-origin:bottom;animation:lab-grow .5s both}.bars i:nth-child(2){animation-delay:.05s}.bars i:nth-child(3){animation-delay:.1s}.bars i:nth-child(4){animation-delay:.15s}.bars i:nth-child(5){animation-delay:.2s}.bars i:nth-child(6){animation-delay:.25s}.bars i:nth-child(7){animation-delay:.3s}
.o{font-size:20px;font-weight:700;letter-spacing:.06em}
.gl{display:grid;grid-template-columns:1fr 1fr;gap:16px 10px;padding:22px 20px;border-bottom:2px solid #1c1c1c}.gl b{font-size:44px;line-height:.9;display:block}.gl span{font-size:16px;color:#9a9a96;letter-spacing:.08em;font-weight:700}
.why{padding:18px 20px 20px;background:#F4F1EA;color:#0A0A0A}.why .x{font:600 17px/1.35 'Inter',sans-serif;text-transform:none;font-style:normal;margin-top:8px}
.ph{display:flex;align-items:baseline;gap:12px;padding:15px 20px;background:#F4F1EA;color:#0A0A0A;margin-top:3px}.ph b{font-size:30px;letter-spacing:.02em}.ph em{font-size:20px;font-weight:700;opacity:.6}.ph span{margin-left:auto;font-size:20px}
.ph.done{background:#1B1B1B;color:#9a9a96}.ph.done b{text-decoration:line-through;text-decoration-thickness:2px}.ph.on{background:${A}}.ph.race{background:#0A0A0A;color:${A};border-top:2px solid ${A}}
.wk{display:grid;grid-template-columns:78px 1fr auto;gap:10px;align-items:center;padding:12px 20px;border-bottom:2px solid #1c1c1c}.wk .n{font-size:76px;line-height:.8;color:transparent;-webkit-text-stroke:1.8px #F4F1EA}.wk>div b{font-size:22px;color:#c9c6bf}.wk .km{font-size:44px;line-height:.85;text-align:right}.wk .km small{display:block;font-size:15px;color:#9a9a96;letter-spacing:.08em}
.wk.cur{background:#F4F1EA;color:#0A0A0A;padding:16px 20px}.wk.cur .n{color:#0A0A0A;-webkit-text-stroke:0}.wk.cur>div b{color:#0A0A0A;font-size:26px}.wk.cur .km small{color:#555}
.dy{display:flex;gap:5px;align-items:flex-end;height:50px;margin-top:8px}.dy i{flex:1;background:#0A0A0A;position:relative;min-height:6px}.dy i.rest{background:#cfcbc0}.dy i.next{background:#fff;border:2px solid #0A0A0A;box-sizing:border-box}.dy i.today{background:${A}}.dy u{position:absolute;bottom:-17px;left:0;right:0;text-align:center;font-size:12px;text-decoration:none;color:#555}
.wk.cur .dy{margin-bottom:18px}.wk.dl .n{-webkit-text-stroke-color:#666}.wk.dl>div b{color:#777}
.gap .huge{font-size:210px}.ch{padding:20px 14px 6px}.ch .k{padding:0 6px 6px}
.lg{display:flex;gap:16px;font-size:14px;letter-spacing:.08em;padding:6px 6px;color:#c9c6bf}.lg span{display:flex;align-items:center;gap:6px}.lg i{display:inline-block}.lg .d{width:9px;height:9px;background:#F4F1EA;transform:rotate(45deg)}.lg .l{width:20px;height:4px;background:${A}}.lg .x{width:20px;height:0;border-top:3px dotted #F4F1EA}
.pr{display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:6px 14px}.pr div{background:#1B1B1B;padding:12px 14px 14px;display:flex;flex-direction:column;align-items:flex-start;gap:4px}.pr span{font-size:15px;color:#9a9a96;letter-spacing:.08em}.pr b{font-size:56px;line-height:.85}.pr .tg{margin:2px 0 0}
.gl3{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;padding:3px 14px 6px}.gl3 div{background:${A};color:#0A0A0A;padding:12px 10px}.gl3 b{font-size:46px;line-height:.85;display:block}.gl3 span{font-size:14px;letter-spacing:.08em;font-weight:800}
`;
  (window.CONCEPTS = window.CONCEPTS || []).push({
    id: '05', name: 'POSTER', tag: 'Energična, hrabra tipografija. Ogromni brojevi, blokovi boje, dramatična hijerarhija.',
    css, screens: { today, workout, plan, progress },
    spec: {
      philosophy: 'Plakat, ne panel. Jedan pogled = jedna poruka. Ekran se čita na 3 metra: ogroman broj kaže šta je danas, ostalo je sitnije. Energija dolazi iz razmere, ne iz ukrasa.',
      type: 'Barlow Condensed 800 italic, verzal, razmera 8:1 između heroja (196px) i oznake (15px). Tekst za čitanje (savet) prelazi na Inter da ostane čitljiv.',
      layout: 'Blokovi pune širine: crno, bela kost, jedna toplo-crvena. Bez kartica i radijusa — oštri uglovi. Razmak 3px između blokova kao „šav“.',
      nav: 'Donja traka samo tekst, kondenzovan verzal; aktivan = podvučen bojom akcije. Nema ikonica — manje šuma, veći ciljevi.',
      today: 'Blok boje sa „7×60“ u 196px: sekunde na 4:00/km. Ispod 3 broja (km, min, napor), jedan red „sledeće“ i ogromno dugme „ZAVRŠI →“.',
      plan: 'Faze su široke trake (prošla je precrtana, tekuća u boji akcije). Nedelje imaju konturne ogromne brojeve; tekuća je inverzna (bela kost) sa visinama dana.',
      workout: 'Segmenti su blokovi čija visina odgovara težini: zagrevanje (tamno), rad (boja akcije, 190px), hlađenje (tamno). Ispod 2×2 brojke i „zašto“.',
      data: '„14 S“ do cilja kao heroj, debela linija VDOT-a (4.5px), oznake porekla kao krupni žigovi: IZMERENO (puno), PROCENA (crno na boji), PROJEKCIJA (isprekidano).',
      motion: 'Brza i odsečna (200–300 ms): blokovi ulaze redom, traka ponavljanja se diže stub po stub, dugme pri pritisku menja boju. Nema mekih easing-a.',
      mobile: 'Ogromne mete dodira (dugme 68px), jedna ruka. Najbolje na suncu — kontrast crno/bela kost > 15:1.',
      desktop: 'Ploča 3 kolone, brojevi i dalje ogromni: „Danas“ zauzima levu 60 %, desno nedelja i sledeće. Na širokom ekranu hero broj se skalira clamp()-om.',
      key: 'Today: „7×60“ u 196px.',
      cost: 'Barlow Condensed 800 italic ~20 KB (latin+latin-ext). Rizik: lako postaje „previše glasno“ za dane odmora i oporavka — traži tihu varijantu bloka (već u fazi 2 za Oporavak).'
    }
  });
})();
