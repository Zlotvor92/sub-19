/* 10 · FUTURE SPORTS OS — monohromni, dubina kroz slojeve, progresivno otkrivanje, mikro-interakcije. */
(function () {
  const EST = '#A8B3FF', PRJ = '#FFC38A';
  const dock = (act) => `<nav class="foot dockn">${NAV.map(([i, t], k) => `<button class="${k === act ? 'on' : ''}">${ICON[i](1.7)}<span>${t}</span></button>`).join('')}</nav>`;
  const cta = (solo) => `<div class="foot cta ${solo ? 'solo' : ''}"><button class="go">Završi trening</button></div>`;
  const layer = (t, open, inner) => `<div class="ly ${open ? 'open' : ''}"><button data-acc aria-expanded="${open}"><span>${t}</span>${ICON.chev(2.2)}</button><div class="lb">${inner}</div></div>`;
  const WHY = `<p class="pg">${D.session.guide}</p>`;
  const HR = `<p class="pg">Cilj: <b>Z4–Z5 · 164–182 bpm</b>. Prikazuje se samo kad su zone povezane (intervals.icu / Strava); inače ostaje napor RPE 8–9.</p>`;

  const today = () => `
<div class="body"><header class="tp"><span class="dt">Sre, 4. nov</span><span class="wk">N6 · RAZVOJ</span></header>
<section class="stage rise" style="--i:0"><p class="ey">DANAS</p><h1>Fartlek</h1>
 <div class="pf">${profile({ w: 318, h: 88, easy: '#3a3a40', work: '#F2F2F0', gap: 1, r: 2 }).svg}</div>
 <div class="nm"><div><b>4:00</b><span>/km</span></div><div><b>8,6</b><span>km</span></div><div><b>≈42</b><span>min</span></div><div><b>8–9</b><span>RPE</span></div></div></section>
<section class="lys rise" style="--i:1">
${layer('Struktura', true, `<ol class="tl"><li><i></i><b>Zagrevanje</b><span>3 km · 5:09</span></li><li class="k"><i></i><b>7 × 60 s brzo</b><span>4:00 /km</span></li><li><i></i><b>60 s lagano</b><span>između</span></li><li><i></i><b>Hlađenje</b><span>2,5 km</span></li></ol>`)}
${layer('Zašto ovaj trening', false, WHY)}${layer('Puls i zone', false, HR)}</section>
<section class="peek rise" style="--i:2"><p class="ey">SLEDEĆE</p><b>Pet · Tempo</b><span>3,7 km @ 4:17</span></section>
</div>${cta()}${dock(0)}`;

  const workout = () => {
    const ladder = [['I', '3:53'], ['rad', '4:00'], ['T', '4:17'], ['M', '4:35'], ['E', '5:09']];
    const toS = (s) => { const [m, x] = s.split(':'); return +m * 60 + +x; };
    const X = (s) => 14 + ((320 - toS(s)) / (320 - 225)) * 292;
    return `<div class="body"><header class="tp"><button class="bk">${ICON.chev(2.4)}<span>Danas</span></button><span class="wk">N6 · D3</span></header>
<section class="stage big rise" style="--i:0"><p class="ey">RAZVOJ · FARTLEK + TEMPO</p><h1>Fartlek</h1>
 <div class="pf">${profile({ w: 318, h: 120, easy: '#3a3a40', work: '#F2F2F0', gap: 1, r: 2 }).svg}</div>
 <div class="nm"><div><b>8,6</b><span>km</span></div><div><b>≈42</b><span>min</span></div><div><b>8–9</b><span>RPE</span></div></div></section>
<section class="lad rise" style="--i:1"><p class="ey">TEMPO U ODNOSU NA ZONE <em>procena iz VDOT 49,2</em></p>
 <svg viewBox="0 0 320 62" width="100%" aria-hidden="true"><line x1="8" x2="312" y1="24" y2="24" stroke="#2c2c31" stroke-width="2"/>${ladder.map(([k, t]) => `<g><circle cx="${X(t)}" cy="24" r="${k === 'rad' ? 7 : 3.5}" fill="${k === 'rad' ? '#F2F2F0' : '#55555c'}"/><text x="${X(t)}" y="${k === 'rad' ? 8 : 42}" text-anchor="middle" font-size="${k === 'rad' ? 12 : 10.5}" fill="${k === 'rad' ? '#F2F2F0' : '#8e8e93'}" font-weight="${k === 'rad' ? 700 : 500}" style="font-family:Geist">${k === 'rad' ? t + ' danas' : t}</text>${k === 'rad' ? '' : `<text x="${X(t)}" y="56" text-anchor="middle" font-size="9.5" fill="#6c6c72" style="font-family:Geist">${k}</text>`}</g>`).join('')}</svg></section>
<section class="lys rise" style="--i:2">${layer('Struktura', true, `<ol class="tl"><li><i></i><b>Zagrevanje</b><span>3 km · 5:09 · 15:27</span></li><li class="k"><i></i><b>7 × 60 s brzo</b><span>4:00 /km · 7:00</span></li><li><i></i><b>6 × 60 s lagano</b><span>oporavak · 6:00</span></li><li><i></i><b>Hlađenje</b><span>2,5 km · 12:53</span></li></ol>`)}
${layer('Zašto ovaj trening', true, WHY)}${layer('Puls i zone', false, HR)}</section>
</div>${cta(true)}`;
  };

  const plan = () => `
<div class="body"><header class="tp"><span class="dt">Plan</span><span class="wk">12 NED. · 20.12.</span></header>
<section class="rib rise" style="--i:0"><div class="rb"><span>BAZA ✓</span><i>N1–4 · 105,2 km</i></div><div class="rb"><span>N5 ✓</span><i>34,8 km</i></div></section>
<section class="cur rise" style="--i:1"><p class="ey">TEKUĆA · RAZVOJ</p><div class="ch"><h2>Nedelja 6</h2><b>7,8<small> / 37,9 km</small></b></div><div class="pb"><span style="width:21%"></span></div>
${D.week6.map((d) => `<div class="dy ${d.st}"><span class="dw">${d.dow}</span><span class="n">${d.name}</span><span class="c">${d.core}</span><span class="s">${d.st === 'done' ? ICON.check(2.8) : d.st === 'today' ? '<u></u>' : ''}</span></div>`).join('')}</section>
<section class="stk rise" style="--i:2"><div class="sk1"><span>Nedelja 7</span><i>39,4 km · Intervali</i></div><div class="sk2"><span>Nedelja 8</span><i>27,1 km · rasterećenje</i></div><div class="sk3"><span>N9–N12 · Vrhunac, Taper, Trka</span></div></section>
</div>${dock(1)}`;

  const progress = () => `
<div class="body"><header class="tp"><span class="dt">Napredak</span><span class="wk">5 NEDELJA</span></header>
<section class="hd rise" style="--i:0"><p class="ey">DA LI NAPREDUJEM?</p><h1>49,2 <small>VDOT · +1,1</small></h1></section>
<section class="chs rise" style="--i:1" data-layers><div class="tg"><button data-layer="meas" aria-pressed="true"><i class="m"></i>Izmereno</button><button data-layer="est" aria-pressed="true"><i class="e"></i>Procena</button><button data-layer="proj" aria-pressed="true"><i class="p"></i>Projekcija</button></div>
${vdotChart({ w: 342, h: 210, font: 'Geist', col: { est: EST, meas: '#F2F2F0', proj: PRJ, goal: '#55555c', grid: '#1d1d21', txt: '#6c6c72', now: '#2c2c31', area: '' }, labels: { goal: 'cilj 49,9', proj: 'plan 50,6', est: '49,2', test: '3K 11:45' }, estW: 2.4, projDash: '3 5' })}
<p class="hn">Dodirni sloj da ga uključiš ili isključiš.</p></section>
<section class="lys rise" style="--i:2">${layer('Trka · 5 km', true, `<div class="pr"><div><b>20:13</b><span>danas <em class="e">procena</em></span></div><div><b>19:59</b><span>cilj</span></div><div><b>19:45</b><span>plan <em class="p">projekcija</em></span></div></div>`)}${layer('Test 3 km · 11:45', false, '<p class="pg">25. oktobar · VDOT 49,0 <em class="m">izmereno</em>. Najjači pojedinačan signal forme.</p>')}${layer('Doslednost · 96 %', false, '<p class="pg">148,0 od 153,5 km do sada · 18 od 46 trčanja. Ovo je <em class="m">izmereno</em>.</p>')}</section>
</div>${dock(3)}`;

  const css = `
&{background:#0A0A0B;color:#F2F2F0;font-family:'Geist',system-ui,sans-serif;--sb:#F2F2F0}
.body{padding-bottom:20px}
.tp{display:flex;justify-content:space-between;align-items:center;padding:6px 22px 10px}.dt{font-size:17px;font-weight:600}.wk{font:600 11px 'Geist Mono';letter-spacing:.06em;color:#8e8e93;background:#19191C;padding:5px 9px;border-radius:99px}
.ey{font:600 10.5px 'Geist Mono';letter-spacing:.12em;color:#8e8e93}.ey em{font:400 11px 'Geist';letter-spacing:0;color:#6c6c72;font-style:normal;margin-left:6px}
.stage{margin:4px 14px 0;background:linear-gradient(180deg,#232327 0,#19191C 140px);border:1px solid rgba(255,255,255,.07);border-radius:28px;padding:20px 20px 18px;box-shadow:0 1px 0 rgba(255,255,255,.06) inset}
.stage h1{font-size:46px;font-weight:600;letter-spacing:-.04em;line-height:1;margin-top:8px}.pf{margin:16px -2px 4px}.pf svg{display:block}
.nm{display:grid;grid-template-columns:repeat(4,auto);justify-content:space-between;margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.07)}.stage.big .nm{grid-template-columns:repeat(3,auto)}
.nm b{font-size:26px;font-weight:600;letter-spacing:-.03em;font-variant-numeric:tabular-nums}.nm span{font-size:12px;color:#8e8e93;margin-left:3px}
.lys{padding:12px 14px 0;display:flex;flex-direction:column;gap:8px}
.ly{background:#121214;border:1px solid rgba(255,255,255,.06);border-radius:20px;overflow:hidden}.ly>button{display:flex;justify-content:space-between;align-items:center;width:100%;min-height:54px;padding:0 18px;font:600 16px 'Geist'}.ly>button svg{width:16px;height:16px;color:#6c6c72;transition:transform .3s}.ly.open>button svg{transform:rotate(90deg)}
.lb{display:none;padding:2px 18px 16px}.ly.open .lb{display:block;animation:lab-fade .4s both}.pg em.m{font-style:normal;font-size:10.5px;padding:1px 6px;border-radius:5px;background:rgba(242,242,240,.12);color:#F2F2F0}.pg b{color:#fff}
.tl{list-style:none;position:relative;margin-left:5px}.tl::before{content:"";position:absolute;left:4px;top:8px;bottom:8px;width:2px;background:#2c2c31}.tl li{position:relative;display:grid;grid-template-columns:1fr auto;padding:8px 0 8px 22px;font-size:14.5px}.tl li i{position:absolute;left:0;top:13px;width:10px;height:10px;border-radius:50%;background:#2c2c31;border:2px solid #121214;box-sizing:content-box;margin-left:-1px}.tl li.k i{background:#F2F2F0}.tl li b{font-weight:600}.tl li span{color:#8e8e93;font-variant-numeric:tabular-nums}.tl li.k b{color:#fff}
.peek{margin:12px 28px 0;background:#121214;border:1px solid rgba(255,255,255,.05);border-radius:20px 20px 0 0;padding:14px 18px 40px;display:flex;gap:10px;align-items:baseline;opacity:.8}.peek .ey{margin-right:4px}.peek b{font-weight:600;font-size:15px}.peek span{color:#8e8e93;font-size:14px;margin-left:auto}
.cta{padding:10px 14px 0;background:linear-gradient(0deg,#0A0A0B 66%,rgba(10,10,11,0))}.cta.solo{padding-bottom:28px}
.go{width:100%;height:56px;border-radius:28px;background:#F2F2F0;color:#0A0A0B;font:600 16px 'Geist';letter-spacing:-.01em;display:flex;align-items:center;justify-content:center;gap:10px;transition:transform .15s}.go:active{transform:scale(.97)}
.dockn{display:flex;justify-content:center;padding:8px 14px 24px;background:#0A0A0B}.dockn{gap:2px}.dockn button{display:flex;align-items:center;gap:8px;height:48px;padding:0 15px;border-radius:24px;color:#6c6c72;font:600 13.5px 'Geist'}.dockn button span{display:none}.dockn button svg{width:24px;height:24px}.dockn .on{background:#232327;color:#F2F2F0}.dockn .on span{display:inline}
.bk{display:flex;align-items:center;color:#8e8e93;font-size:15px}.bk svg{width:18px;height:18px;transform:rotate(180deg)}
.lad{margin:12px 14px 0;background:#121214;border:1px solid rgba(255,255,255,.06);border-radius:20px;padding:16px 16px 6px}.lad .ey{margin-bottom:8px}
.pg{font-size:15px;line-height:1.5;color:#d6d6d3}
.rib{padding:2px 14px 0;display:flex;flex-direction:column;gap:6px}.rb{display:flex;justify-content:space-between;align-items:center;padding:0 16px;height:40px;border-radius:14px;background:#0F0F11;border:1px solid rgba(255,255,255,.04);color:#8e8e93;font:600 12px 'Geist Mono';letter-spacing:.04em;transform:scale(.97)}.rb:first-child{transform:scale(.94);opacity:.7}.rb i{font:400 12px 'Geist';font-style:normal;color:#6c6c72;letter-spacing:0}
.cur{margin:8px 14px 0;background:linear-gradient(180deg,#232327 0,#19191C 120px);border:1px solid rgba(255,255,255,.07);border-radius:28px;padding:18px 18px 10px;box-shadow:0 1px 0 rgba(255,255,255,.06) inset}
.ch{display:flex;justify-content:space-between;align-items:baseline;margin-top:6px}.ch h2{font-size:28px;font-weight:600;letter-spacing:-.03em}.ch b{font-size:22px;font-weight:600}.ch small{font-size:13px;color:#8e8e93;font-weight:500}
.pb{height:6px;border-radius:3px;background:#2c2c31;margin:12px 0 8px;overflow:hidden}.pb span{display:block;height:100%;background:#F2F2F0;border-radius:3px;transform-origin:left;animation:lab-grow2f 1s .2s both}@keyframes lab-grow2f{from{transform:scaleX(0)}}
.dy{display:grid;grid-template-columns:42px 1fr auto 24px;gap:8px;align-items:center;min-height:46px;border-top:1px solid rgba(255,255,255,.06);font-size:15px}.dy .dw{font:600 11px 'Geist Mono';color:#8e8e93}.dy .n{font-weight:600}.dy .c{font-size:13px;color:#8e8e93;font-variant-numeric:tabular-nums}.dy .s svg{width:16px;height:16px;color:#F2F2F0}.dy .s u{display:block;width:10px;height:10px;border-radius:50%;background:#F2F2F0;margin:auto;box-shadow:0 0 0 4px rgba(242,242,240,.15)}
.dy.done .n,.dy.done .c{color:#6c6c72}.dy.rest{opacity:.4;min-height:34px}.dy.today{background:rgba(255,255,255,.04);margin:0 -18px;padding:0 18px}
.stk{padding:10px 14px 0;display:flex;flex-direction:column}.stk>div{display:flex;justify-content:space-between;align-items:center;height:52px;padding:0 18px;border:1px solid rgba(255,255,255,.06);border-radius:20px;background:#121214;font-weight:600;font-size:15px}.stk i{font:400 12.5px 'Geist';font-style:normal;color:#8e8e93}
.sk2{transform:scale(.96);margin-top:-8px;opacity:.75;background:#0F0F11!important}.sk3{transform:scale(.92);margin-top:-8px;opacity:.5;background:#0D0D0F!important;font-size:12.5px!important;color:#8e8e93}
.hd{padding:10px 24px 0}.hd h1{font-size:64px;font-weight:600;letter-spacing:-.05em;line-height:1;margin-top:6px}.hd small{font-size:14px;color:#8e8e93;font-weight:500;letter-spacing:0;margin-left:6px}
.chs{padding:14px 14px 0}.tg{display:flex;gap:6px;margin-bottom:6px}.tg button{display:flex;align-items:center;gap:7px;height:38px;padding:0 14px;border-radius:19px;background:#19191C;border:1px solid rgba(255,255,255,.07);font:600 13px 'Geist';color:#F2F2F0;transition:opacity .25s,background .25s}.tg button[aria-pressed=false]{opacity:.4;background:transparent}
.tg i{display:inline-block}.tg .m{width:8px;height:8px;background:#F2F2F0;transform:rotate(45deg)}.tg .e{width:16px;height:3px;background:${EST};border-radius:2px}.tg .p{width:16px;border-top:3px dotted ${PRJ}}
.chs svg .est,.chs svg .proj,.chs svg .meas{transition:opacity .3s}.chs.hide-est .est,.chs.hide-proj .proj,.chs.hide-meas .meas{opacity:0}
.hn{font-size:12.5px;color:#6c6c72;margin-top:2px;text-align:center}
.pr{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.pr b{display:block;font-size:30px;font-weight:600;letter-spacing:-.04em}.pr span{font-size:12px;color:#8e8e93;display:block;margin-top:2px}.pr em{font-style:normal;font-size:10.5px;padding:1px 6px;border-radius:5px}.pr em.e{background:rgba(168,179,255,.14);color:${EST}}.pr em.p{border:1px dashed ${PRJ};color:${PRJ}}
`;
  (window.CONCEPTS = window.CONCEPTS || []).push({
    id: '10', name: 'FUTURE SPORTS OS', tag: 'Moderno ali ozbiljno: monohromni, dubina kroz slojeve, progresivno otkrivanje.',
    css, screens: { today, workout, plan, progress },
    spec: {
      philosophy: 'Operativni sistem za trening. Dubina se gradi SLOJEVIMA (svetlina površine), ne senkama: scena (stage) → slojevi (layers) → kartica „sledeće“ viri iza. Boja je rezervisana za značenje podatka; UI je monohroman.',
      type: 'Geist + Geist Mono (mono samo za oznake). Heroj 46–64px, negativan tracking, tabularne cifre.',
      layout: 'Scena = uzdignuta površina sa jednim svetlosnim prelazom odozgo (jedini gradijent). Ispod su „slojevi“ koji se razvijaju na mestu. Okviri 1px, prozirni; radijus 20–28px.',
      nav: 'Plutajući dock: samo aktivna ikonica pokazuje oznaku (morfira u pilulu). Primarna akcija je zasebna bela pilula iznad doka.',
      today: 'Scena „Fartlek“ sa profilom i 4 broja; ispod slojevi — „Struktura“ razvijena, „Zašto“ i „Puls i zone“ zatvoreni (progressive disclosure); sledeći trening viri iza kao skupljena kartica.',
      plan: 'Dubinski stek: prošle nedelje su sabijene trake (gore, umanjene), tekuća nedelja je uzdignuta scena sa danima, buduće se slažu ispod i udaljavaju (manje, bleđe).',
      workout: 'Scena + „merdevine tempa“: horizontalna skala zona (R, I, rad, T, M, E) sa današnjim 4:00 naglašenim — pokazuje gde je trening u odnosu na zone izvedene iz VDOT-a.',
      data: 'Slojevi na grafikonu SU filter: Izmereno / Procena / Projekcija se uključuju dodirom (radi u ovom prikazu). Boje: bela (mereno), periwinkle (procena), breskva (projekcija).',
      motion: 'Najviše pokreta od svih, ali sve ima funkciju: slojevi se razvijaju na mestu (300 ms), prsten→kvačica pri završetku, dock morfira. Bez lebdenja i paralakse.',
      mobile: 'Dock u zoni palca, akcija iznad njega; progressive disclosure štedi vertikalni prostor — ekran retko traži skrol za glavnu akciju.',
      desktop: 'Scena levo (60 %), slojevi desno kao „inspector“ panel; dock postaje leva ivična traka sa oznakama. Slojevi grafikona ostaju kao segment-kontrola.',
      key: 'Progress: slojevi kao filter + Workout: merdevine tempa.',
      cost: 'Geist ~30 KB. Najviše JS-a po ekranu (razvijanje slojeva, morf doka ~3 KB). Rizik: lako sklizne u „generički moderni dark UI“ ako se izgubi disciplina jedne boje i jedne scene.'
    }
  });
})();
