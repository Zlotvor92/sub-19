/* 09 · MOBILE-FIRST RUNNER — dizajn za palac: bottom sheet, prikovana akcija, pager dana, svetla „dnevna“ tema. */
(function () {
  const G = '#12805C';
  const nav = (act) => `<nav class="foot nav">${NAV.map(([i, t], k) => `<button class="${k === act ? 'on' : ''}">${ICON[i](1.9)}<span>${t}</span></button>`).join('')}</nav>`;
  const cta = (solo) => `<div class="foot act ${solo ? 'solo' : ''}"><button class="go">Završi trening</button></div>`;
  const dayStrip = () => `<div class="ds">${D.week6.map((d) => `<button class="${d.st}"><em>${d.dow[0]}</em><b>${+d.dd}</b><i class="${d.t === 'odmor' ? 'r' : d.st === 'done' ? 'on' : ''}"></i></button>`).join('')}</div>`;

  const today = () => `
<div class="body"><header class="tp"><div><b>Sre, 4. nov</b><span>Nedelja 6 · Razvoj</span></div><div class="wr">${ring(0.21, { size: 44, sw: 10, color: G, track: '#DDE4DF', text: '1/4', tsize: 28, tcolor: '#101614', tfont: 'Figtree', tw: 800 })}</div></header>
${dayStrip()}
<section class="ctx rise" style="--i:0"><div class="cd"><b>46</b><span>dana do trke<br><em>5K · 20. dec · cilj 19:59</em></span></div></section>
<section class="sheet rise" style="--i:1"><i class="gr"></i><p class="ey">DANAS</p><h1>Fartlek</h1><p class="sb2">7 × 60 s brzo, 60 s lagano</p>
 <div class="pace"><b>4:00</b><span>/km<br>tempo rada</span></div>
 <div class="s3"><div><b>8,6</b><span>km</span></div><div><b>42</b><span>min</span></div><div><b>8–9</b><span>napor</span></div></div>
 <button class="more"><span>Detalji treninga</span>${ICON.chev(2.4)}</button></section>
</div>${cta()}${nav(0)}`;

  const workout = () => `
<div class="body w"><section class="sheet full rise" style="--i:0"><i class="gr"></i><div class="sh"><div><p class="ey">NEDELJA 6 · RAZVOJ</p><h1>Fartlek</h1></div><button class="x">${ICON.down(2.4)}</button></div>
 <div class="s3 line"><div><b>8,6</b><span>km</span></div><div><b>≈42</b><span>min</span></div><div><b>4:00</b><span>/km · procena</span></div></div>
 <div class="rows">
  <div class="rw"><i style="background:#C9D4CD"></i><div><b>Zagrevanje</b><span>3 km · 5:09 /km</span></div><em>15:27</em></div>
  <div class="rw open"><i style="background:${G}"></i><div><b>Sedam brzih</b><span>7 × 60 s · 4:00 /km · RPE 8–9</span><p>Svaki zalet isti. Prvi i poslednji ne razlikuješ. Puls Z4–Z5 (164–182) kad su zone povezane.</p></div><em>7:00</em></div>
  <div class="rw"><i style="background:#98A79E"></i><div><b>Oporavak</b><span>6 × 60 s lagano</span></div><em>6:00</em></div>
  <div class="rw"><i style="background:#C9D4CD"></i><div><b>Hlađenje</b><span>2,5 km · 5:09 /km</span></div><em>12:53</em></div>
 </div>
 <div class="wy"><p class="ey">ZAŠTO</p><p>${D.session.guide}</p></div></section>
</div>${cta(true)}`;

  const plan = () => `
<div class="body"><header class="tp"><div><b>Plan</b><span>12 nedelja · trka 20. dec</span></div></header>
<div class="chips">${D.phases.map((p) => `<button class="${p.k === 'RAZVOJ' ? 'on' : p.from < 5 ? 'dn' : ''}">${p.from < 5 ? '✓ ' : ''}${{ BAZA: 'Baza', RAZVOJ: 'Razvoj', VRHUNAC: 'Vrhunac', TAPER: 'Taper', TRKA: 'Trka' }[p.k]}</button>`).join('')}</div>
<div class="car rise" style="--i:0">${[5, 6, 7, 8]
    .map((w) => {
      const k = D.W[w - 1];
      return `<div class="wc ${w === 6 ? 'cur' : ''}"><p class="ey">NEDELJA ${w}${k.deload ? ' · RASTEREĆENJE' : ''}</p><b>${w === 6 ? '7,8' : w === 5 ? '34,8' : '–'}<small> / ${kmf(k.plan)} km</small></b>${w === 6 ? '<div class="pb"><span style="width:21%"></span></div>' : ''}<div class="dt">${(w === 7 ? D.week7 : D.week6).map((d) => `<i class="${w === 6 ? d.st : w === 5 ? 'done' : 'next'}${d.t === 'odmor' ? ' r' : ''}"></i>`).join('')}</div></div>`;
    })
    .join('')}</div>
<div class="dots">${[0, 1, 2, 3].map((i) => `<i class="${i === 1 ? 'on' : ''}"></i>`).join('')}</div>
<section class="days rise" style="--i:1"><p class="ey">NEDELJA 6</p>
${D.week6.filter((d) => d.t !== 'odmor').map((d, i) => `<div class="dr ${d.st} ${i === 3 ? 'sw' : ''}"><div class="in"><span class="dw"><em>${d.dow}</em><b>${+d.dd}</b></span><span class="nm"><b>${d.name}</b><em>${d.core}</em></span><span class="km">${d.km ? kmf(d.km) + ' km' : ''}</span><span class="stt">${d.st === 'done' ? ICON.check(3) : d.st === 'today' ? '<i></i>' : ''}</span></div>${i === 3 ? '<div class="swa"><span>Zameni</span><span class="o">Preskoči</span></div>' : ''}</div>`).join('')}
<p class="hint">← prevuci red za zamenu ili preskakanje</p></section>
</div>${nav(1)}`;

  const progress = () => `
<div class="body"><header class="tp"><div><b>Napredak</b><span>Prevuci kartice →</span></div></header>
<div class="sc rise" style="--i:0"><article class="cd1"><p class="ey">FORMA · VDOT <em class="pv e">procena</em></p><div class="bg"><b>49,2</b><span>+1,1 od starta</span></div>${vdotChart({ w: 300, h: 150, font: 'Figtree', grid: false, ticks: [], col: { est: G, meas: '#101614', proj: '#667068', goal: '#C2410C', grid: '#E4EAE6', txt: '#667068', now: '#C9D4CD', area: '' }, labels: { goal: false, proj: false, est: false, test: false }, estW: 3, showNow: false, estDots: false, projDash: '2 6' })}
<div class="lgd"><span><i class="m"></i>Izmereno</span><span><i class="e"></i>Procena</span><span><i class="p"></i>Projekcija</span></div></article>
<article class="cd1 sm"><p class="ey">OBIM</p><div class="bg"><b>148</b><span>km</span></div></article><article class="cd1 sm"><p class="ey">PLAN</p><div class="bg"><b>96</b><span>%</span></div></article></div>
<div class="dots"><i class="on"></i><i></i><i></i></div>
<section class="lst rise" style="--i:1"><p class="ey">TRKA · 5 KM</p>
 <div class="lr"><div><b>20:13</b><span>danas bi istrčao</span></div><em class="pv e">procena</em></div>
 <div class="lr"><div><b>19:59</b><span>cilj</span></div><em class="pv">gap 14 s</em></div>
 <div class="lr"><div><b>19:45</b><span>plan vodi do 20.12.</span></div><em class="pv p">projekcija</em></div>
 <div class="lr"><div><b>11:45</b><span>test 3 km · 25. okt</span></div><em class="pv m">izmereno</em></div></section>
</div>${nav(3)}`;

  const css = `
&{background:#F6F7F5;color:#101614;font-family:'Figtree',system-ui,sans-serif;--sb:#101614}
.tp{display:flex;justify-content:space-between;align-items:center;padding:6px 20px 8px}.tp b{display:block;font-size:22px;font-weight:800;letter-spacing:-.02em}.tp span{font-size:13.5px;color:#667068;font-weight:600}
.ey{font:800 11px 'Figtree';letter-spacing:.1em;color:#667068;display:flex;gap:8px;align-items:center}
.ds{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;padding:2px 14px 10px}.ds button{display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 0 8px;border-radius:14px}.ds em{font:700 11px 'Figtree';font-style:normal;color:#667068}.ds b{font-size:17px;font-weight:800}.ds i{width:6px;height:6px;border-radius:50%;border:1.5px solid #B8C4BC}.ds i.on{background:${G};border-color:${G}}.ds i.r{border:0}
.ds .today{background:${G};color:#fff}.ds .today em,.ds .today b{color:#fff}.ds .today i{background:#fff;border-color:#fff}
.ctx{padding:6px 20px 14px}.cd{display:flex;align-items:center;gap:14px}.cd b{font-size:72px;font-weight:800;letter-spacing:-.05em;line-height:.9}.cd span{font-size:15px;font-weight:700;line-height:1.3}.cd em{font-style:normal;font-weight:600;color:#667068;font-size:13px}
.sheet{background:#fff;border-radius:28px 28px 0 0;padding:10px 22px 22px;box-shadow:0 -1px 0 #E1E7E3,0 -12px 30px rgba(16,22,20,.05);min-height:420px}
.gr{display:block;width:40px;height:5px;border-radius:3px;background:#D5DDD8;margin:0 auto 16px}
.sheet h1{font-size:44px;font-weight:800;letter-spacing:-.04em;line-height:1;margin-top:4px}.sb2{font-size:16px;color:#4a554d;margin-top:6px;font-weight:500}
.pace{display:flex;align-items:flex-end;gap:10px;margin-top:16px}.pace b{font-size:76px;font-weight:800;letter-spacing:-.05em;line-height:.88;color:${G}}.pace span{font-size:14px;font-weight:700;color:#667068;line-height:1.25;padding-bottom:6px}
.s3{display:flex;gap:26px;margin-top:16px;padding-top:16px;border-top:1px solid #E7ECE8}.s3 b{font-size:30px;font-weight:800;letter-spacing:-.03em;line-height:1}.s3 span{display:block;font-size:12.5px;color:#667068;font-weight:700;margin-top:3px}.s3.line{border-top:0;padding-top:12px}
.more{margin-top:18px;width:100%;height:56px;border-radius:16px;background:#F0F4F1;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font:700 16px 'Figtree'}.more svg{width:20px;height:20px;color:#667068}
.act{padding:10px 14px 8px;background:linear-gradient(0deg,#F6F7F5 80%,rgba(246,247,245,0))}.act.solo{padding-bottom:30px;background:#fff}
.go{width:100%;height:60px;border-radius:18px;background:${G};color:#fff;font:800 18px 'Figtree';letter-spacing:-.01em}.go:active{transform:scale(.98);background:#0e6a4c}
.nav{display:grid;grid-template-columns:repeat(5,1fr);padding:6px 4px 24px;background:#fff;border-top:1px solid #E1E7E3}.nav button{display:flex;flex-direction:column;align-items:center;gap:3px;color:#7a867f;font:700 10.5px 'Figtree';padding:6px 0;min-height:52px}.nav svg{width:26px;height:26px}.nav .on{color:${G}}
.body.w{padding-top:50px;background:rgba(16,22,20,.38)}.sheet.full{margin-top:12px;min-height:740px}
.sh{display:flex;justify-content:space-between;align-items:flex-start}.x{width:44px;height:44px;border-radius:50%;background:#F0F4F1;display:flex;align-items:center;justify-content:center}.x svg{width:20px;height:20px}
.rows{margin-top:6px}.rw{display:grid;grid-template-columns:8px 1fr auto;gap:14px;align-items:start;padding:14px 4px;border-top:1px solid #E7ECE8;min-height:64px}.rw i{width:8px;align-self:stretch;border-radius:4px;min-height:34px}.rw b{display:block;font-size:17px;font-weight:800}.rw span{font-size:14px;color:#4a554d;font-weight:600;display:block;margin-top:2px}.rw em{font:700 15px 'Figtree';font-style:normal;color:#667068;font-variant-numeric:tabular-nums}.rw p{font-size:14px;line-height:1.45;color:#4a554d;margin-top:8px;background:#F0F8F4;border-radius:12px;padding:10px 12px}
.wy{margin-top:14px;padding:14px 16px;background:#F0F4F1;border-radius:16px}.wy p:last-child{font-size:15px;line-height:1.45;margin-top:6px}
.chips{display:flex;gap:8px;padding:2px 20px 12px;overflow:hidden}.chips button{flex:none;height:40px;padding:0 16px;border-radius:20px;background:#fff;border:1.5px solid #DAE2DD;font:700 14px 'Figtree';color:#4a554d}.chips .on{background:#101614;color:#fff;border-color:#101614}.chips .dn{color:${G}}
.car{display:flex;gap:10px;padding:0 20px 0 36px;overflow:hidden}.wc{flex:none;width:264px;background:#fff;border:1.5px solid #E1E7E3;border-radius:22px;padding:16px;opacity:.7}.wc.cur{border-color:${G};opacity:1;box-shadow:0 8px 24px rgba(18,128,92,.12)}.wc b{display:block;font-size:34px;font-weight:800;letter-spacing:-.03em;margin:6px 0 10px}.wc small{font-size:14px;color:#667068;font-weight:700;letter-spacing:0}
.pb{height:8px;background:#E4EAE6;border-radius:4px;overflow:hidden;margin-bottom:12px}.pb span{display:block;height:100%;background:${G};border-radius:4px;transform-origin:left;animation:lab-grow2e 1s .25s both}@keyframes lab-grow2e{from{transform:scaleX(0)}}
.dt{display:flex;gap:6px}.dt i{flex:1;height:14px;border-radius:5px;border:2px solid #CBD6CF}.dt i.done{background:${G};border-color:${G}}.dt i.today{background:#101614;border-color:#101614}.dt i.r{height:6px;margin-top:4px;border-color:#E4EAE6}
.dots{display:flex;justify-content:center;gap:6px;padding:12px 0 4px}.dots i{width:7px;height:7px;border-radius:50%;background:#CBD6CF}.dots i.on{background:#101614;width:20px;border-radius:4px}
.days{padding:10px 14px 0}.days .ey{padding:0 6px 6px}
.dr{position:relative;margin-bottom:6px;overflow:hidden;border-radius:16px;background:#fff;border:1.5px solid #E7ECE8}.dr .in{display:grid;grid-template-columns:44px 1fr auto 22px;gap:10px;align-items:center;min-height:60px;padding:6px 14px;background:#fff;position:relative;z-index:1}
.dw{display:flex;flex-direction:column;align-items:center;line-height:1.15}.dw em{font:700 11px 'Figtree';font-style:normal;color:#667068}.dw b{font-size:18px;font-weight:800}.nm b{display:block;font-size:16px;font-weight:800}.nm em{font:600 13px 'Figtree';font-style:normal;color:#667068}.km{font-weight:800;font-size:15px}.stt svg{width:18px;height:18px;color:${G}}.stt i{display:block;width:12px;height:12px;border-radius:50%;background:${G}}
.dr.today{border-color:${G};background:#F0F8F4}.dr.today .in{background:#F0F8F4}.dr.done .nm b{color:#667068}
.dr.sw .in{margin-right:112px;grid-template-columns:44px 1fr}.dr.sw .km,.dr.sw .stt{display:none}.swa{position:absolute;right:0;top:0;bottom:0;width:112px;display:flex}.swa span{flex:1;background:#E8A630;color:#3b2a00;display:flex;align-items:center;justify-content:center;font:800 12px 'Figtree';white-space:nowrap}.swa .o{background:#D9DFDB;color:#101614}
.hint{font:600 12.5px 'Figtree';color:#7a867f;text-align:center;padding:8px 0 4px}
.sc{display:flex;gap:10px;padding:0 20px 0 20px;overflow:hidden}.cd1{flex:none;width:326px;background:#fff;border:1.5px solid #E1E7E3;border-radius:24px;padding:18px 18px 14px}.cd1.sm{width:150px}.bg{display:flex;align-items:baseline;gap:10px;margin:6px 0 4px}.bg b{font-size:60px;font-weight:800;letter-spacing:-.05em;line-height:1}.bg span{font-size:15px;font-weight:800;color:${G}}.cd1.sm .bg span{color:#667068}
.pv{font:700 11px 'Figtree';font-style:normal;padding:3px 8px;border-radius:7px;background:#EEF2EF;color:#4a554d;letter-spacing:0}.pv.e{background:#E0F0FF;color:#0B5CAD}.pv.m{background:#DDF3E8;color:#0D6B49}.pv.p{background:#fff;border:1.5px dashed #AAB6AE}
.lgd{display:flex;gap:14px;font:700 12px 'Figtree';color:#4a554d;margin-top:2px}.lgd span{display:flex;align-items:center;gap:6px}.lgd i{display:inline-block}.lgd .m{width:8px;height:8px;background:#101614;transform:rotate(45deg)}.lgd .e{width:16px;height:3px;background:${G};border-radius:2px}.lgd .p{width:16px;border-top:3px dotted #667068}
.lst{padding:10px 20px 0}.lr{display:flex;justify-content:space-between;align-items:center;min-height:68px;border-top:1px solid #E1E7E3}.lr:first-of-type{border:0}.lr b{font-size:28px;font-weight:800;letter-spacing:-.03em;display:block;line-height:1.1}.lr span{font-size:13px;color:#667068;font-weight:600}
.body{padding-bottom:12px}
`;
  (window.CONCEPTS = window.CONCEPTS || []).push({
    id: '09', name: 'MOBILE-FIRST RUNNER', tag: 'Za palac, ne za miš. Bottom sheet, prikovana akcija, pager dana, svetla dnevna tema.',
    css, screens: { today, workout, plan, progress },
    spec: {
      philosophy: 'Telefon je primarni uređaj, napolju, na suncu, jednom rukom. Sve važno je u donjoj polovini ekrana; gore je samo kontekst (odbrojavanje). Svetla visokokontrastna tema jer se trči po danu.',
      type: 'Figtree (prijateljski, vrlo čitljiv u malim veličinama), težine 700–800; brojevi veliki; mete dodira ≥ 56px.',
      layout: 'Gornja trećina = kontekst (dani, odbrojavanje), donja dve trećine = „sheet“ sa treningom koji izlazi odozdo. Primarna akcija prikovana iznad navigacije.',
      nav: 'Donja traka 5 ikonica (52px visine). Dani: horizontalni pager (prevlačenje levo/desno menja dan); povlačenje sheet-a gore otvara detalje.',
      today: 'Kontekst: dani i „46 dana do trke“; sheet: Fartlek, 4:00, 3 broja, „Detalji treninga“. Dugme „Završi“ 60px prikovano.',
      plan: 'Fazni čipovi (vodoravno), karusel nedelja sa snapom (tekuća u sredini), ispod redovi dana od 60px sa povlačenjem za „Zameni / Preskoči“ (prečice koje danas zahtevaju otvaranje liste).',
      workout: 'Sheet na 90 %: segmenti kao veliki redovi od 64px; prvi „radni“ je razvijen sa uputstvom; povlačenje nadole zatvara. Dugme prikovano.',
      data: 'Kartice-„priče“ koje se prevlače: Forma (broj + linija), Obim, Plan; pa lista trke sa oznakama porekla (pilule: izmereno / procena / projekcija).',
      motion: 'Fizička: sheet prati prst (interruptible), kartice se hvataju (snap), brojevi bez animacije. Povlačenje reda otkriva akcije; sve prefers-reduced-motion svesno.',
      mobile: 'Ovo JE mobilni model: zona palca, bottom sheet, pager, swipe akcije, ≥56px mete, sistemski povratak.',
      desktop: 'Telefon ostaje u centru ekrana (max 480px) sa „companion“ panelima sa strane: plan i napredak se prikazuju stalno kao pločice, ne kao tabovi.',
      key: 'Today: bottom sheet + prikovana akcija.',
      cost: 'Figtree ~35 KB. Gestovi (swipe/pager/sheet-drag) su nova interakcijska logika: ~5–8 KB JS bez biblioteke, ali traže pažljiv a11y (svaka gesta mora imati dugme-alternativu).'
    }
  });
})();
