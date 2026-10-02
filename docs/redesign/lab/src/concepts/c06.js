/* 06 · SPORTS SCIENCE DASHBOARD — laboratorijski izgled; test → VDOT → zone → trening → predikcija kao jedan sistem. */
(function () {
  const B = '#1F4E8C';
  const nav = (act) => `<nav class="foot nav">${NAV.map(([i, t], k) => `<button class="${k === act ? 'on' : ''}">${ICON[i](1.6)}<span>${t}</span></button>`).join('')}</nav>`;
  const hd = (t, s) => `<header class="hd"><div><b>SUB-20</b><i>${s}</i></div><span>${t}</span></header>`;
  const lab = (k) => `<em class="lb ${k}">${{ m: 'IZMERENO', e: 'PROCENA', p: 'PROJEKCIJA', d: 'IZVEDENO', r: 'PROPISANO' }[k]}</em>`;
  const cta = (solo) => `<div class="foot dock ${solo ? 'solo' : ''}"><button class="go">Završi trening</button><button class="sk">Preskoči</button></div>`;
  const zones = () => {
    const z = [['Z1', 94, 'rgba(31,78,140,.12)'], ['Z2', 24, 'rgba(31,78,140,.2)'], ['Z3', 18, 'rgba(31,78,140,.32)'], ['Z4', 14, B], ['Z5', 10, '#0B2D57']];
    return `<div class="zb">${z.map(([n, w, c], i) => `<span style="flex:${w};background:${c};${i >= 3 ? 'color:#fff' : ''}">${n}</span>`).join('')}</div><div class="zl"><span>126</span><span>147</span><span>164</span><span>182</span><span>191 bpm</span></div>`;
  };

  const today = () => `
<div class="body">${hd('Danas', 'trening model')}
<section class="pan rise" style="--i:0"><p class="cap">SL. 1 · Lanac: od merenja do današnjeg treninga</p>
 <div class="pipe">
  <div class="nd"><span class="n">1</span><div><i>Test 3 km · 25.10. ${lab('m')}</i><b>11:45</b></div></div><span class="cn"></span>
  <div class="nd"><span class="n">2</span><div><i>VDOT iz tempa i testa ${lab('e')}</i><b>49,2</b></div></div><span class="cn"></span>
  <div class="nd"><span class="n">3</span><div><i>Zone tempa ${lab('d')}</i><b class="sm">E 5:09 · T 4:17 · rad 4:00</b></div></div><span class="cn"></span>
  <div class="nd hot"><span class="n">4</span><div><i>DANAS ${lab('r')}</i><b>Fartlek 7 × 60 s @ 4:00</b></div></div><span class="cn"></span>
  <div class="nd"><span class="n">5</span><div><i>5K danas / plan / cilj ${lab('p')}</i><b class="sm">20:13 · 19:45 · 19:59</b></div></div>
 </div></section>
<section class="pan rise" style="--i:1"><p class="cap">Protokol sesije</p>
 <table class="tb"><tr><th>Zagrevanje</th><td>3 km @ 5:09</td></tr><tr class="hl"><th>Rad</th><td>7 × 60 s @ 4:00 /km</td></tr><tr><th>Oporavak</th><td>60 s lagano</td></tr><tr><th>Hlađenje</th><td>2,5 km</td></tr><tr><th>Ukupno</th><td>8,6 km · ≈ 42 min · RPE 8–9</td></tr></table></section>
</div>${cta()}${nav(0)}`;

  const workout = () => `
<div class="body">${hd('Trening', 'protokol')}
<section class="pan rise" style="--i:0"><p class="cap">Protokol 06.03 · Fartlek</p><h1>Fartlek <small>Razvoj · N6</small></h1></section>
<section class="pan rise" style="--i:1"><p class="cap">1.0 Cilj</p><p class="tx">${D.session.guide}</p></section>
<section class="pan rise" style="--i:2"><p class="cap">2.0 Struktura <span>SL. 2 · visina = brzina</span></p>${profile({ w: 342, h: 100, easy: '#C9D3DF', work: B, gap: 1.2, r: 1, labels: true, txt: '#4B5666', font: 'IBM Plex Mono', base: '#9AA6B5' }).svg}</section>
<section class="pan rise" style="--i:3"><p class="cap">3.0 Ciljne vrednosti</p><table class="tb"><tr><th>Tempo rada</th><td>4:00 /km ${lab('e')}</td></tr><tr><th>Napor</th><td>RPE 8–9</td></tr><tr><th>Trajanje</th><td>≈ 42:20</td></tr><tr><th>Distanca</th><td>8,6 km</td></tr></table>
 <p class="cap sub">Puls: zone Z4–Z5 (164–182 bpm)</p>${zones()}<p class="fn">Zone iz intervals.icu; bez povezanih zona prikazuje se samo napor.</p></section>
<section class="pan rise" style="--i:4"><p class="cap">4.0 Izvođenje</p><ol class="ol"><li>Isti tempo na svakom zaletu; prvi i poslednji se ne razlikuju.</li><li>Oporavak je potpun — pusti puls da padne.</li><li>Ako tempo 4:00 traži RPE 10, vrati se na RPE 8–9.</li></ol></section>
</div>${cta(true)}`;

  const plan = () => `
<div class="body">${hd('Plan', 'periodizacija')}
<section class="pan rise" style="--i:0"><p class="cap">SL. 2 · Obim po nedelji i faze <span>km</span></p>${weekBars({ w: 342, h: 150, plan: '#C9D3DF', real: B, cur: '#0F1722', txt: '#4B5666', font: 'IBM Plex Mono', grid: '#E3E8EE', r: 1, gap: 4 })}
 <div class="bands">${D.phases.map((p) => `<span style="flex:${p.to - p.from + 1}" class="${p.k === 'RAZVOJ' ? 'on' : ''}"><b>${p.to > p.from ? p.k : p.k.slice(0, 3)}</b></span>`).join('')}</div>
 <div class="mk"><span>▽ N4, N8 rasterećenje</span><span>◼ ostvareno</span><span>▢ plan</span></div></section>
<section class="pan rise" style="--i:1"><p class="cap">Fokus po fazama</p><table class="tb sm">${[['Baza', 'Repeticije · Piramida · Tempo isprekidan'], ['Razvoj', 'Intervali · Fartlek · Tempo'], ['Vrhunac', 'Trkački ritam · Intervali · Tempo'], ['Taper', 'Intervali + Tempo, skraćeno']].map(([a, b], i) => `<tr class="${i === 1 ? 'hl' : ''}"><th>${a}</th><td>${b}</td></tr>`).join('')}</table></section>
<section class="pan rise" style="--i:2"><p class="cap">Nedelja 6 · 7,8 / 37,9 km</p><table class="tb sm cols">${D.week6.map((d) => `<tr class="${d.st}"><th>${d.dow} ${+d.dd}.</th><td>${d.name}</td><td>${d.core}</td><td class="r">${d.km ? kmf(d.km) : ''}</td><td class="ck">${d.st === 'done' ? '✓' : d.st === 'today' ? '●' : ''}</td></tr>`).join('')}</table></section>
</div>${nav(1)}`;

  const progress = () => `
<div class="body">${hd('Trka', 'predikcija')}
<section class="pan rise" style="--i:0"><p class="cap">SL. 3 · VDOT kroz vreme</p>${vdotChart({ w: 342, h: 200, font: 'IBM Plex Mono', ls: 9, col: { est: B, meas: '#0F1722', proj: '#6B7787', goal: '#B3261E', grid: '#E3E8EE', txt: '#4B5666', now: '#9AA6B5', area: '' }, labels: { goal: 'cilj 49,9', proj: 'proj. 50,6', est: '49,2', test: '3K' }, estW: 2 })}</section>
<section class="pan rise" style="--i:1"><p class="cap">Tab. 1 · Poreklo vrednosti</p><table class="tb sm"><tr><th><i class="sy m">◆</i> IZMERENO</th><td>uneto direktno: trčanja, test 3 km, masa</td></tr><tr><th><i class="sy e">●</i> PROCENA</th><td>izračunato iz merenja: VDOT, ekvivalentna vremena (Daniels &amp; Gilbert, 1979)</td></tr><tr><th><i class="sy p">○</i> PROJEKCIJA</th><td>pretpostavka o budućnosti: putanja plana do 20.12.</td></tr></table></section>
<section class="pan rise" style="--i:2"><p class="cap">Tab. 2 · Ekvivalentna vremena pri VDOT 49,2</p><table class="tb sm cols"><tr class="h"><th></th><td>danas ${lab('e')}</td><td class="r">cilj</td></tr><tr class="hl"><th>5 km</th><td>20:13</td><td class="r">19:59 (Δ 14 s)</td></tr><tr><th>10 km</th><td>41:54</td><td class="r">—</td></tr><tr><th>Pol.</th><td>1:32:48</td><td class="r">—</td></tr><tr><th>Plan</th><td>19:45 ${lab('p')}</td><td class="r">20.12.</td></tr></table></section>
</div>${nav(3)}`;

  const css = `
&{background:#EEF1F4;color:#0F1722;font-family:'IBM Plex Sans',system-ui,sans-serif;--sb:#0F1722}
.mono,.tb td,.pipe b,.cap{font-family:'IBM Plex Mono',monospace}
.hd{display:flex;justify-content:space-between;align-items:flex-end;padding:6px 14px 10px}.hd b{font-weight:700;letter-spacing:.1em;font-size:14px;margin-right:8px}.hd i{font:italic 400 12px 'IBM Plex Sans';color:#4B5666}.hd>span{font:600 13px 'IBM Plex Mono';color:#4B5666}
.pan{background:#fff;border:1px solid #CBD2DA;margin:0 12px 10px;padding:12px 14px 14px}
.cap{font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;color:#4B5666;margin-bottom:10px;display:flex;justify-content:space-between;font-weight:500}.cap span{color:#8896A8}.cap.sub{margin:12px 0 6px}
.lb{font:600 9px 'IBM Plex Mono';font-style:normal;letter-spacing:.06em;padding:1px 5px;border:1px solid;border-radius:2px;margin-left:6px;vertical-align:middle}
.lb.m{color:#0F1722;border-color:#0F1722}.lb.e{color:${B};border-color:${B};background:rgba(31,78,140,.06)}.lb.p{color:#6B7787;border-color:#6B7787;border-style:dashed}.lb.d{color:#4B5666;border-color:#9AA6B5}.lb.r{color:#fff;background:${B};border-color:${B}}
.pipe{display:flex;flex-direction:column}
.nd{display:flex;gap:12px;align-items:center;padding:8px 10px;border:1px solid #DDE3EA;background:#FAFBFC}.nd .n{width:22px;height:22px;border-radius:50%;background:#EEF1F4;border:1px solid #9AA6B5;font:600 11px 'IBM Plex Mono';display:flex;align-items:center;justify-content:center;flex:none}
.nd i{font:500 10px 'IBM Plex Sans';font-style:normal;color:#4B5666;letter-spacing:.02em;display:block;margin-bottom:2px}.nd b{font-size:17px;font-weight:600;letter-spacing:-.01em}.nd b.sm{font-size:14px}
.nd.hot{background:#fff;border:2px solid ${B};box-shadow:0 0 0 3px rgba(31,78,140,.1)}.nd.hot .n{background:${B};color:#fff;border-color:${B}}.nd.hot i{color:${B};font-weight:700}
.cn{width:2px;height:10px;background:#9AA6B5;margin-left:20px}
.tb{width:100%;border-collapse:collapse;font-size:13.5px}.tb th{text-align:left;font-weight:600;padding:8px 8px 8px 0;border-top:1px solid #E3E8EE;width:34%;vertical-align:top}.tb td{padding:8px 0;border-top:1px solid #E3E8EE;font-size:13px}.tb tr:first-child th,.tb tr:first-child td{border-top:0}
.tb tr.hl th,.tb tr.hl td{background:rgba(31,78,140,.07);padding-left:6px}.tb.sm th{font-size:12px;width:30%}.tb.sm td{font-size:12px;color:#2c3643}
.tb.cols th{width:auto;white-space:nowrap}.tb.cols td{padding-left:8px}.tb .r{text-align:right}.tb .ck{width:20px;text-align:right;color:${B}}.tb tr.rest{opacity:.4}.tb tr.today th,.tb tr.today td{background:rgba(31,78,140,.09)}.tb tr.h th,.tb tr.h td{font-size:10px;color:#4B5666}
h1{font-size:28px;letter-spacing:-.02em}h1 small{font:500 12px 'IBM Plex Mono';color:#4B5666;margin-left:8px}
.tx{font-size:14.5px;line-height:1.5}.fn{font-size:11px;color:#8896A8;margin-top:6px}
.zb{display:flex;height:22px}.zb span{display:flex;align-items:center;justify-content:center;font:600 10px 'IBM Plex Mono';color:#0F1722}.zl{display:flex;justify-content:space-between;font:400 9px 'IBM Plex Mono';color:#6B7787;margin-top:3px}
.ol{margin-left:18px;font-size:13.5px;line-height:1.5}.ol li{margin:4px 0}
.dock{padding:10px 12px 8px;background:linear-gradient(0deg,#EEF1F4 78%,rgba(238,241,244,0));display:flex;gap:8px}.dock.solo{padding-bottom:30px}
.go{flex:1;height:50px;background:${B};color:#fff;font:600 14px 'IBM Plex Sans';border-radius:3px}.sk{width:96px;border:1px solid #9AA6B5;border-radius:3px;font:500 13px 'IBM Plex Sans';color:#2c3643;background:#fff}
.nav{display:grid;grid-template-columns:repeat(5,1fr);padding:6px 4px 24px;background:#fff;border-top:1px solid #CBD2DA}.nav button{display:flex;flex-direction:column;align-items:center;gap:3px;color:#6B7787;font:500 10px 'IBM Plex Sans';padding:4px 0}.nav svg{width:22px;height:22px}.nav .on{color:${B};font-weight:700}
.bands{display:flex;gap:2px;margin:2px 3% 0 6.6%}.bands span{height:18px;background:#DDE3EA;position:relative;overflow:hidden}.bands .on{background:${B}}.bands b{position:absolute;left:4px;top:3px;font:600 8px 'IBM Plex Mono';color:#2c3643;white-space:nowrap}.bands .on b{color:#fff}
.mk{display:flex;gap:14px;font:400 10px 'IBM Plex Mono';color:#4B5666;margin-top:10px}
.sy{font-style:normal;margin-right:4px}.sy.e{color:${B}}.sy.p{color:#6B7787}
`;
  (window.CONCEPTS = window.CONCEPTS || []).push({
    id: '06', name: 'SPORTS SCIENCE', tag: 'Laboratorijski dashboard. VDOT, tempo, zone i plan kao jedan sistem sa poreklom.',
    css, screens: { today, workout, plan, progress },
    spec: {
      philosophy: 'Proizvod je model: test → VDOT → zone tempa → trening → predikcija. Korisnik vidi LANAC, pa razume zašto je današnji tempo baš 4:00. Svaka veličina nosi oznaku porekla i izvor formule.',
      type: 'IBM Plex Sans za tekst, IBM Plex Mono za vrednosti i oznake slika/tabela. Kapitalne sitne oznake samo za „Sl.“ i „Tab.“.',
      layout: 'Bele ploče sa 1px ivicom na hladno-sivoj podlozi, numerisane slike (Sl. 1…) i tabele (Tab. 1…). Oštri uglovi, gustina srednja.',
      nav: 'Donja traka sa ikonicom i oznakom (plavo = aktivno). Unutar ekrana numerisani odeljci „1.0 Cilj, 2.0 Struktura…“.',
      today: 'Lanac od 5 čvorova, čvor 4 („Danas“) je uokviren i ispunjen. Ispod protokol sesije kao tabela. Dugme prikovano.',
      plan: 'Periodizacija kao slika: stubovi obima + traka faza + oznake rasterećenja; tabela „fokus po fazama“; tabela tekuće nedelje.',
      workout: 'Dokument: 1.0 Cilj, 2.0 Struktura (slika), 3.0 Ciljne vrednosti (tabela + zone pulsa kao pojas Z1–Z5), 4.0 Izvođenje (3 pravila).',
      data: 'VDOT slika sa tri jasna stila: mereno ◆ (crno), procena ● (plava linija), projekcija ○ (siva isprekidana); tabela „Poreklo vrednosti“ objašnjava šta je šta; tabela ekvivalentnih vremena.',
      motion: 'Funkcionalna: linije se crtaju sleva, čvorovi lanca se pale po redu (pokazuje smer zavisnosti), ništa ne „skače“. 150–300 ms.',
      mobile: 'Ploče se slažu u jednu kolonu; tabele ostaju čitljive na 390px (12–13px, mono za brojeve). CTA prikovan.',
      desktop: 'Dve kolone: lanac + protokol levo, slike desno; tabele dobijaju širinu. Najbolji koncept za veliki ekran i analitiku.',
      key: 'Today: lanac „od merenja do treninga“.',
      cost: 'IBM Plex Sans+Mono ~70 KB (4 težine, latin+latin-ext). Najveća vrednost je edukativna — ali „naučni“ ton može da odbije početnike; potreban je jezik bez žargona u prvom sloju.'
    }
  });
})();
