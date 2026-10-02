/* 03 · QUIET CLARITY — apple-like minimalizam: crno, sistemski font, grupisane liste, jedna boja akcije. */
(function () {
  const A = '#FF6A3D';
  const tab = (act) => `<nav class="foot tabs">${NAV.map(([i, t], k) => `<button class="${k === act ? 'on' : ''}">${ICON[i](1.7)}<span>${t}</span></button>`).join('')}</nav>`;
  const week = () => `<div class="wk">${D.week6.map((d) => `<div class="${d.st}"><span>${d.dow[0]}</span><b>${+d.dd}</b><i class="${d.t === 'odmor' ? 'r' : d.st === 'done' ? 'on' : ''}"></i></div>`).join('')}</div>`;
  const cta = (solo) => `<div class="foot dock ${solo ? 'solo' : ''}"><button class="go">Završi trening</button><button class="sk">Preskoči</button></div>`;
  const row = (l, r, extra = '') => `<div class="r"><span>${l}</span><b>${r}</b>${extra}</div>`;
  const tagp = (t) => `<em class="pill">${t}</em>`;

  const today = () => `
<div class="body"><header class="lt"><div><h1>Danas</h1><p>Sreda, 4. novembar</p></div><button class="av">${ICON.gear(1.6)}</button></header>
<section class="rise" style="--i:0">${week()}</section>
<section class="hero rise" style="--i:1"><p class="ey">Nedelja 6 · Razvoj</p><h2>Fartlek</h2><p class="sub">7 × 60 s brzo, 60 s lagano između</p>
<div class="nums"><div><b>8,6</b><span>km</span></div><div><b>42</b><span>min</span></div><div><b>8–9</b><span>napor</span></div></div></section>
<section class="lst rise" style="--i:2"><h3>Struktura</h3><div class="grp">${row('Zagrevanje', '3 km')}${row('Brzo', '7 × 60 s · 4:00/km')}${row('Oporavak', '60 s lagano')}${row('Hlađenje', '2,5 km')}</div></section>
<section class="lst rise" style="--i:3"><div class="grp"><div class="r link"><span>Zašto ovaj trening</span>${ICON.chev(2)}</div></div></section>
</div>${cta()}${tab(0)}`;

  const workout = () => `
<div class="body"><header class="nb"><button class="bk">${ICON.chev(2.4)}<span>Danas</span></button></header>
<section class="ttl rise" style="--i:0"><p class="ey">Sreda · nedelja 6</p><h1>Fartlek</h1></section>
<section class="pace rise" style="--i:1"><b>4:00</b><span>/km<br>ciljni tempo</span>${tagp('Procena')}</section>
<section class="lst rise" style="--i:2"><h3>Struktura</h3><div class="grp">
 <div class="r st"><i style="background:#3A3A3C"></i><span>Zagrevanje</span><b>3 km</b></div>
 <div class="r st"><i style="background:${A}"></i><span>Brzo</span><b>7 × 60 s</b></div>
 <div class="r st"><i style="background:#6E6E73"></i><span>Oporavak</span><b>60 s</b></div>
 <div class="r st"><i style="background:#3A3A3C"></i><span>Hlađenje</span><b>2,5 km</b></div></div></section>
<section class="lst rise" style="--i:3"><h3>Ciljevi</h3><div class="grp">${row('Trajanje', '≈ 42 min')}${row('Distanca', '8,6 km')}${row('Napor', 'RPE 8–9')}${row('Puls', 'Z4–Z5 · 164–182')}</div><p class="ft">Puls se prikazuje kad su zone povezane.</p></section>
<section class="lst rise" style="--i:4"><h3>Zašto</h3><div class="grp para"><p>${D.session.guide}</p></div></section>
</div>${cta(true)}`;

  const plan = () => `
<div class="body"><header class="lt"><div><h1>Plan</h1><p>12 nedelja · trka 20. decembra</p></div></header>
<section class="rise" style="--i:0"><div class="seg">${D.phases.map((p) => `<button class="${p.k === 'RAZVOJ' ? 'on' : ''}">${{ BAZA: 'Baza', RAZVOJ: 'Razvoj', VRHUNAC: 'Vrh', TAPER: 'Taper', TRKA: 'Trka' }[p.k]}</button>`).join('')}</div></section>
<section class="lst rise" style="--i:1"><h3>Razvoj · nedelje 5–8</h3><div class="grp">
 <div class="r wkr"><span>Nedelja 5</span><b>34,8 km</b>${ICON.check(2.6)}</div>
 <div class="wcur"><div class="r wkr"><span>Nedelja 6</span><b>7,8 / 37,9 km</b></div><div class="pb"><i style="width:21%"></i></div><p>1 od 4 treninga · danas Fartlek</p>
  ${D.week6.filter((d) => d.t !== 'odmor').map((d) => `<div class="r sub ${d.st}"><span>${d.dow} ${+d.dd}.</span><em>${d.name}</em><b>${d.km ? kmf(d.km) + ' km' : ''}</b>${d.st === 'done' ? ICON.check(2.6) : ''}</div>`).join('')}</div>
 <div class="r wkr"><span>Nedelja 7</span><b>39,4 km</b>${ICON.chev(2)}</div>
 <div class="r wkr"><span>Nedelja 8 <small>rasterećenje</small></span><b>27,1 km</b>${ICON.chev(2)}</div></div></section>
<section class="lst rise" style="--i:2"><div class="grp"><div class="r"><span>Trka · 5K</span><b>20. decembar · cilj 19:59</b></div></div><p class="ft">Do sada 148,0 od 153,5 km (96 %).</p></section>
</div>${tab(1)}`;

  const progress = () => `
<div class="body"><header class="lt"><div><h1>Napredak</h1><p>Poslednjih 5 nedelja</p></div></header>
<section class="big rise" style="--i:0"><p class="ey">Forma · VDOT ${tagp('Procena')}</p><div class="v"><b>49,2</b><span>+1,1 od starta</span></div>
${vdotChart({ w: 342, h: 170, font: 'Inter', grid: false, ticks: [], estW: 2.6, col: { est: '#fff', meas: A, proj: '#8E8E93', goal: '#8E8E93', grid: '#2C2C2E', txt: '#8E8E93', now: '#2C2C2E', area: '' }, labels: { goal: false, proj: false, est: false, test: false }, showNow: false, estDots: false, projDash: '2 5' })}
<div class="lgd"><span><i class="s" style="background:${A}"></i>Izmereno</span><span><i class="l"></i>Procena</span><span><i class="d"></i>Projekcija</span></div></section>
<section class="lst rise" style="--i:1"><h3>Trka · 5 km</h3><div class="grp">
 <div class="r"><span>Danas bi istrčao</span><b>20:13</b>${tagp('Procena')}</div>
 <div class="r"><span>Cilj</span><b>19:59</b></div>
 <div class="r"><span>Plan vodi do</span><b>19:45</b>${tagp('Projekcija')}</div>
 <div class="r"><span>Test 3 km · 25. okt</span><b>11:45</b>${tagp('Izmereno')}</div></div></section>
<section class="lst rise" style="--i:2"><h3>Doslednost</h3><div class="grp">${row('Istrčano', '148,0 km')}${row('Plan do sada', '96 %')}${row('Trčanja', '18 od 46')}</div></section>
</div>${tab(3)}`;

  const css = `
&{background:#000;color:#fff;font-family:'Inter',-apple-system,system-ui,sans-serif;--sb:#fff;letter-spacing:-.01em}
.body{padding-bottom:12px}
.lt{display:flex;justify-content:space-between;align-items:flex-end;padding:8px 20px 6px}.lt h1{font-size:34px;font-weight:800;letter-spacing:-.03em;line-height:1.1}.lt p{font-size:15px;color:#8E8E93;margin-top:2px}
.av{width:38px;height:38px;border-radius:50%;background:#1C1C1E;display:flex;align-items:center;justify-content:center;color:#EBEBF5}.av svg{width:20px;height:20px}
section{padding:0 16px}
.wk{display:grid;grid-template-columns:repeat(7,1fr);padding:14px 0 6px}
.wk div{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;color:#8E8E93;font-weight:600;padding:6px 0;border-radius:18px}.wk b{font-size:17px;font-weight:600;color:#fff;letter-spacing:-.02em}
.wk i{width:6px;height:6px;border-radius:50%;background:transparent;border:1.5px solid #3A3A3C}.wk i.on{background:#fff;border-color:#fff}.wk i.r{border:0;background:transparent}
.wk .today{background:#fff;color:#000}.wk .today b{color:#000}.wk .today i{border-color:${A};background:${A}}
.hero{background:#1C1C1E;border-radius:24px;margin:10px 16px 0;padding:22px 20px 20px}
.ey{font-size:13px;color:#8E8E93;font-weight:600;display:flex;gap:8px;align-items:center}
.hero h2{font-size:36px;font-weight:800;letter-spacing:-.035em;margin-top:6px}.hero .sub{font-size:16px;color:#AEAEB2;margin-top:2px}
.nums{display:flex;gap:30px;margin-top:22px}.nums b{font-size:42px;font-weight:700;letter-spacing:-.04em;line-height:1}.nums span{display:block;font-size:13px;color:#8E8E93;margin-top:4px;font-weight:500}
.lst{margin-top:20px}.lst h3{font-size:13px;color:#8E8E93;font-weight:600;padding:0 6px 7px;text-transform:none}
.grp{background:#1C1C1E;border-radius:16px;overflow:hidden}
.r{display:flex;align-items:center;gap:10px;min-height:52px;padding:0 16px;font-size:17px;border-top:.5px solid #38383A}.r:first-child{border-top:0}
.r span{flex:1}.r b{font-weight:500;color:#AEAEB2;font-size:16px}.r svg{width:15px;height:15px;color:#6E6E73}
.r.link{color:#fff}.r.link svg{width:17px}
.pill{font-style:normal;font-size:11px;font-weight:600;color:#AEAEB2;background:#2C2C2E;border-radius:6px;padding:3px 7px;letter-spacing:0}
.ft{font-size:13px;color:#8E8E93;padding:7px 8px 0}
.dock{padding:10px 16px 8px;background:linear-gradient(0deg,#000 76%,rgba(0,0,0,0));display:flex;flex-direction:column;align-items:center;gap:0}
.dock.solo{padding-bottom:30px}
.go{width:100%;height:56px;border-radius:28px;background:${A};color:#fff;font:700 17px 'Inter';letter-spacing:-.01em}.go:active{opacity:.85;transform:scale(.985)}
.sk{height:40px;font:500 15px 'Inter';color:#AEAEB2}
.tabs{display:grid;grid-template-columns:repeat(5,1fr);padding:6px 4px 24px;background:rgba(28,28,30,.94);border-top:.5px solid #38383A}
.tabs button{display:flex;flex-direction:column;align-items:center;gap:3px;color:#8E8E93;font-size:10px;font-weight:600;padding:5px 0}.tabs svg{width:26px;height:26px}.tabs .on{color:${A}}
.nb{padding:6px 10px}.bk{display:flex;align-items:center;color:${A};font-size:17px;gap:0}.bk svg{width:20px;height:20px;transform:rotate(180deg)}
.ttl{padding-top:6px}.ttl h1{font-size:44px;font-weight:800;letter-spacing:-.04em;line-height:1.05;margin-top:2px}
.pace{display:flex;align-items:flex-end;gap:12px;margin-top:10px}.pace b{font-size:92px;font-weight:700;letter-spacing:-.06em;line-height:.9}.pace span{font-size:15px;color:#8E8E93;line-height:1.3;padding-bottom:10px}.pace .pill{margin-bottom:12px}
.st i{width:10px;height:10px;border-radius:50%;flex:none}
.para{padding:14px 16px}.para p{font-size:16px;line-height:1.45;color:#D1D1D6}
.seg{display:grid;grid-template-columns:repeat(5,1fr);background:#1C1C1E;border-radius:10px;padding:2px;margin-top:8px}.seg button{height:34px;border-radius:8px;font-size:13px;font-weight:600;color:#AEAEB2}.seg .on{background:#3A3A3C;color:#fff}
.wkr b{font-size:16px}.wkr small{color:#8E8E93;font-size:13px;margin-left:6px}.wkr svg:last-child{color:#34C759;width:18px}
.wcur{background:#232325;border-top:.5px solid #38383A;border-bottom:.5px solid #38383A}.wcur>.r{border:0}.wcur>.r span{font-weight:700}
.pb{height:5px;background:#3A3A3C;border-radius:3px;margin:0 16px;overflow:hidden}.pb i{display:block;height:100%;background:${A};border-radius:3px;animation:lab-grow2c .9s .2s both;transform-origin:left}
@keyframes lab-grow2c{from{transform:scaleX(0)}}
.wcur p{font-size:13px;color:#8E8E93;padding:8px 16px 6px}
.r.sub{min-height:44px;font-size:15px;padding-left:28px;border-color:#2E2E30}.r.sub em{font-style:normal;flex:1;color:#EBEBF5}.r.sub span{flex:none;width:58px;color:#8E8E93;font-size:14px}.r.sub b{font-size:14px}.r.sub.today em{color:${A};font-weight:700}.r.sub svg{color:#34C759;width:16px}
.big{padding-top:10px}.big .v{display:flex;align-items:baseline;gap:12px;margin:6px 0 4px}.big b{font-size:84px;font-weight:700;letter-spacing:-.06em;line-height:.95}.big .v span{font-size:15px;color:${A};font-weight:600}
.lgd{display:flex;gap:16px;font-size:12px;color:#AEAEB2;margin-top:6px}.lgd span{display:flex;align-items:center;gap:6px}.lgd i{display:inline-block}.lgd .s{width:8px;height:8px;transform:rotate(45deg)}.lgd .l{width:16px;height:2.5px;background:#fff;border-radius:2px}.lgd .d{width:16px;height:0;border-top:2.5px dotted #8E8E93}
`;
  (window.CONCEPTS = window.CONCEPTS || []).push({
    id: '03', name: 'QUIET CLARITY', tag: 'Apple-like minimalizam. Crno, sistemski font, grupisane liste, jedna boja akcije.',
    css, screens: { today, workout, plan, progress },
    spec: {
      philosophy: 'Sve što nije odgovor na „šta trčim danas?“ je sklonjeno u dublji nivo. Jasnoća dolazi iz razmaka i veličine, ne iz ukrasa. Boja postoji samo za jednu stvar: akciju.',
      type: 'Sistemski font (SF Pro na iOS, Roboto na Androidu) — nula bajtova fonta. Veliki naslov 34px, heroj-broj 42–92px, tabularne cifre, negativan tracking.',
      layout: 'Veliki naslov ekrana, grupisane liste (inset grouped), jedan „hero“ blok po ekranu. Gustina niska, redovi 52px.',
      nav: 'Standardna donja traka sa ikonicom i oznakom, prozirna sa blur-om (samo ova traka). Detalji se otvaraju kao push ekran sa „‹ Danas“.',
      today: 'Naslov „Danas“, nedeljna traka (7 dana), jedan hero blok: „Fartlek“ + tri broja. Struktura u listi, „Zašto ovaj trening“ je zatvoren red (progressive disclosure). Dugme prikovano.',
      plan: 'Segmentirani izbor faze (Baza/Razvoj/Vrh/Taper/Trka), grupisana lista nedelja; tekuća nedelja se širi u listu dana sa trakom napretka.',
      workout: 'Ogromno „4:00“ kao hero, pa grupe: Struktura, Ciljevi, Zašto. Svaka grupa je lista od 3–4 reda; nema zida teksta.',
      data: 'Jedan velik broj (49,2) i jedna linija, bez mreže i osa. Poreklo (Izmereno/Procena/Projekcija) je mala oznaka uz red u listi, linija: puna = procena, tačkasta = projekcija, romb = mereno.',
      motion: 'Gotovo nevidljiva: push ekrani klize 280 ms, traka napretka se puni jednom, dugme ima pritisak 98.5 %. Ništa ne lebdi.',
      mobile: 'Najveći touch targeti (56px dugme, 52px redovi), primarna akcija u zoni palca, sistemski gestovi (povlačenje nazad).',
      desktop: 'Centriran stub 560px sa postranim „master/detail“: lista levo, detalj desno (kao iPad split-view). Prazan prostor je namerno prazan.',
      key: 'Today: „Fartlek“ + tri broja + jedno dugme.',
      cost: 'Najjeftiniji koncept: nula fonta, CSS ~4 KB. Rizik: najmanje diferencijacije — bez pažljivog sadržaja lako liči na bilo koju iOS aplikaciju.'
    }
  });
})();
