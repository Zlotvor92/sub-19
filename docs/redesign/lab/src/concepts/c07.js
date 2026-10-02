/* 07 · EDITORIAL DATA — premium urednički dizajn + precizni podaci: anotirani grafikoni, mali višestruki prikazi. */
(function () {
  const O = '#D9A441', CR = '#EDE6D6', RD = '#D2553D';
  const nav = (act) => `<nav class="foot nav">${['Danas', 'Plan', 'Oporavak', 'Trka', 'Zajednica'].map((t, i) => `<button class="${i === act ? 'on' : ''}">${t}</button>`).join('')}</nav>`;
  const mast = (r) => `<header class="mast"><b>SUB-20</b><span>${r}</span></header>`;
  const cta = (solo) => `<div class="foot dock ${solo ? 'solo' : ''}"><button class="go">Završi trening</button><button class="sk">Preskoči</button></div>`;
  const miniBars = (weeks, max = 48, h = 78, w = 150) => {
    const n = weeks.length;
    const gap = 6;
    const bw = (w - gap * (n + 1)) / n;
    const Y = (v) => h - 16 - (v / max) * (h - 26);
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" aria-hidden="true">${weeks
      .map((k, i) => {
        const x = gap + i * (bw + gap);
        return `<rect x="${x}" y="${Y(k.plan)}" width="${bw}" height="${h - 16 - Y(k.plan)}" fill="none" stroke="#5f5c53" stroke-width="1"/>${k.real ? `<rect class="rbar" style="--d:${i * 0.07}s" x="${x}" y="${Y(k.real)}" width="${bw}" height="${h - 16 - Y(k.real)}" fill="${k.w === 6 ? O : CR}"/>` : ''}<text x="${x + bw / 2}" y="${h - 4}" text-anchor="middle" font-size="9" fill="${k.w === 6 ? O : '#8d887b'}" style="font-family:Public Sans">${k.deload ? '▽' : ''}${k.w}</text>`;
      })
      .join('')}</svg>`;
  };

  const today = () => `
<div class="body">${mast('Briefing · 4. novembar')}
<section class="hd rise" style="--i:0"><h1>Danas se trči brzo — ukupno sedam minuta.</h1><p>Fartlek, nedelja 6 od 12. U fazi Razvoj obim raste do nedelje 7, a nedelja 8 je rasterećenje.</p></section>
<section class="fig rise" style="--i:1"><p class="cp">Gde si u ciklusu <i>km po nedelji · plan (kontura) i ostvareno</i></p><div class="cw ann">${weekBars({ w: 342, h: 128, plan: 'none', planStroke: '#5f5c53', real: CR, cur: O, txt: '#8d887b', font: 'Public Sans', grid: '#24262a', r: 0, gap: 6 })}<div class="an" style="left:48%"><i></i><span>Ovde si · 7,8 od 37,9 km</span></div></div></section>
<section class="sm3 rise" style="--i:2"><div><i>Forma · VDOT</i><b>49,2</b>${spark(D.vdot.series.map((s) => s[1]), { w: 90, h: 28, color: O, sw: 2 })}<em>procena</em></div><div><i>Doslednost</i><b>96<small>%</small></b><div class="bar"><span style="width:96%"></span></div><em>plan do sada</em></div><div><i>Trčanja</i><b>18<small>/46</small></b><div class="bar"><span style="width:39%"></span></div><em>od početka</em></div></section>
<section class="pg rise" style="--i:3"><p class="cp">Program</p><p class="pt">3 km zagrevanje · <b>7 × 60 s @ 4:00</b> sa 60 s oporavka · 2,5 km hlađenje. Napor 8–9 od 10. Ukupno 8,6 km, oko 42 minuta.</p></section>
</div>${cta()}${nav(0)}`;

  const workout = () => `
<div class="body">${mast('Trening · nedelja 6')}
<section class="hd rise" style="--i:0"><p class="kk">Fartlek + Tempo · Razvoj</p><h1>Sedam zaleta, jedan tempo.</h1></section>
<section class="fig rise" style="--i:1"><p class="cp">Profil sesije <i>visina stuba = brzina</i></p><div class="cw prof">${profile({ w: 342, h: 150, easy: '#3a3c40', work: O, gap: 1.2, r: 0, ymin: 225, ymax: 330 }).svg}
 <div class="an a1" style="left:2%;top:6px"><span>Zagrevanje<br>3 km · 5:09</span></div>
 <div class="an a2" style="left:45%;top:0"><i></i><span>7 × 60 s @ 4:00</span></div>
 <div class="an a3" style="right:2%;top:6px;text-align:right"><span>Hlađenje<br>2,5 km · 5:09</span></div>
 <div class="an a4" style="left:36%;bottom:26px"><span>Prvi zalet = poslednji</span></div></div></section>
<section class="fct rise" style="--i:2"><div><i>Distanca</i><b>8,6 km</b></div><div><i>Trajanje <em>procena</em></i><b>≈ 42 min</b></div><div><i>Tempo rada <em>procena</em></i><b>4:00 /km</b></div><div><i>Napor</i><b>8–9 / 10</b></div><div><i>Puls <small>kad su zone povezane</small></i><b>164–182</b></div></section>
<section class="why rise" style="--i:3"><p class="cp">Zašto ovaj trening</p><p class="dc">${D.session.guide}</p></section>
</div>${cta(true)}`;

  const plan = () => {
    const ph = D.phases.map((p) => ({ ...p, w: D.W.filter((k) => k.w >= p.from && k.w <= p.to) }));
    const note = { BAZA: '105,2 od 110,9 km — 95 %', RAZVOJ: '42,6 od 139,2 km — u toku', VRHUNAC: '78,7 km planirano', 'TAPER+TRKA': '38,8 km planirano' };
    const panels = [
      ['Baza', 'N1–4', ph[0].w, note.BAZA, 0],
      ['Razvoj', 'N5–8', ph[1].w, note.RAZVOJ, 1],
      ['Vrhunac', 'N9–10', ph[2].w, note.VRHUNAC, 0],
      ['Taper i trka', 'N11–12', [...ph[3].w, ...ph[4].w], note['TAPER+TRKA'], 0]
    ];
    return `<div class="body">${mast('Plan')}
<section class="hd rise" style="--i:0"><h1>Dvanaest nedelja, pet faza.</h1><p>Prošla je baza. Sada se obim penje, pa pada u rasterećenju (▽).</p></section>
<section class="grid4">${panels.map(([t, r, ws, n, cur], i) => `<div class="pn ${cur ? 'cur' : ''} rise" style="--i:${i + 1}"><p class="ph"><b>${t}</b><i>${r}</i></p>${miniBars(ws)}<em>${n}</em></div>`).join('')}</section>
<section class="wkl rise" style="--i:5"><p class="cp">Nedelja 6 <i>7,8 / 37,9 km</i></p>${D.week6.filter((d) => d.t !== 'odmor').map((d) => `<div class="${d.st}"><span class="d">${d.dow} ${+d.dd}.</span><span class="n">${d.name}</span><span class="c">${d.core}</span><span class="k">${d.km ? kmf(d.km) : ''}</span><span class="s">${d.st === 'done' ? '✓' : d.st === 'today' ? '●' : ''}</span></div>`).join('')}</section>
</div>${nav(1)}`;
  };

  const progress = () => {
    /* osa 20:40 → 19:40 (60 s = 318 px) */
    const X = (m, s) => 12 + ((20 * 60 + 40 - (m * 60 + s)) / 60) * 318;
    return `<div class="body">${mast('Napredak')}
<section class="hd rise" style="--i:0"><h1>Procena danas: 20:13. Cilj: 19:59. Razlika: 14 sekundi.</h1><p>Pet nedelja rada pomerilo je formu za 1,1 VDOT.</p></section>
<section class="fig rise" style="--i:1"><p class="cp">Pet kilometara <i>od starta do plana</i></p>
<svg viewBox="0 0 342 92" width="100%" aria-hidden="true"><line x1="12" x2="330" y1="38" y2="38" stroke="#3a3c40"/><line class="wipe" x1="${X(20, 37)}" x2="${X(20, 13)}" y1="38" y2="38" stroke="${O}" stroke-width="5"/>
 <circle cx="${X(20, 37)}" cy="38" r="6" fill="#14161A" stroke="${CR}" stroke-width="2"/><circle cx="${X(20, 13)}" cy="38" r="7" fill="${O}"/><circle cx="${X(19, 59)}" cy="38" r="7" fill="#14161A" stroke="${RD}" stroke-width="2.5"/><circle cx="${X(19, 45)}" cy="38" r="6" fill="none" stroke="${CR}" stroke-width="2" stroke-dasharray="3 3"/>
 <g font-family="Public Sans" font-size="10" fill="#a8a292" text-anchor="middle"><text x="${X(20, 37)}" y="62">20:37</text><text x="${X(20, 37)}" y="76" fill="${CR}">start · pb</text>
 <text x="${X(20, 13)}" y="20" fill="${O}" font-weight="700">20:13</text><text x="${X(20, 13)}" y="62" fill="${O}">sada · procena</text>
 <text x="${X(19, 59)}" y="20" fill="${RD}" font-weight="700">19:59</text><text x="${X(19, 59)}" y="62" fill="${RD}">cilj</text>
 <text x="${X(19, 45) + 6}" y="76" text-anchor="middle">19:45</text><text x="336" y="88" text-anchor="end">projekcija plana</text></g></svg></section>
<section class="fig rise" style="--i:2"><p class="cp">Forma kroz vreme <i>VDOT</i></p><div class="cw">${vdotChart({ w: 342, h: 200, font: 'Public Sans', ls: 10, col: { est: O, meas: CR, proj: CR, goal: RD, grid: '#24262a', txt: '#8d887b', now: '#3a3c40', area: '' }, labels: { goal: 'cilj 49,9', proj: 'projekcija plana 50,6', est: '49,2', test: 'test 3 km · 11:45' }, projDash: '3 5', estW: 2.4 })}</div></section>
<section class="key rise" style="--i:3"><p class="cp">Kako čitati</p><div><svg width="30" height="12"><rect x="10" y="1" width="9" height="9" transform="rotate(45 14.5 5.5)" fill="${CR}"/></svg><span><b>Izmereno</b> — uneto direktno (test 3 km)</span></div><div><svg width="30" height="12"><line x1="2" x2="28" y1="6" y2="6" stroke="${O}" stroke-width="3"/></svg><span><b>Procena</b> — izračunato iz tempa radnih delova</span></div><div><svg width="30" height="12"><line x1="2" x2="28" y1="6" y2="6" stroke="${CR}" stroke-width="2" stroke-dasharray="3 4"/></svg><span><b>Projekcija</b> — gde plan vodi do 20. decembra</span></div></section>
</div>${nav(3)}`;
  };

  const css = `
&{background:#14161A;color:#EDE6D6;font-family:'Public Sans',system-ui,sans-serif;--sb:#EDE6D6}
.mast{display:flex;justify-content:space-between;align-items:baseline;padding:8px 22px 10px;border-bottom:1px solid #2A2C30}.mast b{font:800 12px 'Public Sans';letter-spacing:.24em}.mast span{font:italic 400 14px 'Newsreader',serif;color:#a8a292}
.hd{padding:22px 22px 6px}.hd h1{font:500 33px/1.1 'Newsreader',serif;letter-spacing:-.015em;font-variation-settings:'opsz' 60}.hd p{font:italic 400 16.5px/1.45 'Newsreader',serif;color:#a8a292;margin-top:10px}.kk{font:700 10.5px 'Public Sans';letter-spacing:.16em;text-transform:uppercase;color:${O};margin-bottom:8px}
.fig,.sm3,.pg,.why,.fct,.key,.wkl{padding:16px 22px 0}
.cp{font:700 10.5px 'Public Sans';letter-spacing:.14em;text-transform:uppercase;color:#a8a292;display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid #2A2C30;padding-top:10px;margin-bottom:10px}.cp i{font:italic 400 13px 'Newsreader',serif;letter-spacing:0;text-transform:none;color:#8d887b}
.cw{position:relative}.cw.ann{margin-bottom:38px}.cw svg{display:block}
.an{position:absolute;display:flex;flex-direction:column;align-items:flex-start;font:italic 400 12.5px/1.25 'Newsreader',serif;color:${O}}
.cw .an{top:100%;margin-top:2px}.an i{width:1px;height:14px;background:${O};margin-bottom:2px}
.prof .an{margin:0}.prof .an span{color:#a8a292}.prof .a2 span{color:${O};font-weight:600}.prof .a4 span{color:#a8a292;border-bottom:1px dotted #a8a292}.prof .a2 i{display:none}
.sm3{display:grid;grid-template-columns:repeat(3,1fr);gap:0}.sm3>div{padding:10px 0 10px 12px;border-left:1px solid #2A2C30}.sm3>div:first-child{border:0;padding-left:0}
.sm3 i{display:block;font:700 9.5px 'Public Sans';letter-spacing:.1em;text-transform:uppercase;color:#a8a292;font-style:normal}.sm3 b{display:block;font:500 34px/1.1 'Newsreader',serif;margin:4px 0}.sm3 small{font-size:15px;color:#a8a292}.sm3 em{font:italic 12px 'Newsreader',serif;color:#8d887b;display:block;margin-top:4px}
.bar{height:3px;background:#2A2C30;margin:12px 6px 4px 0}.bar span{display:block;height:100%;background:${CR}}
.pt{font:400 17.5px/1.5 'Newsreader',serif}.pt b{font-weight:700;color:${O}}
.dock{padding:10px 22px 8px;background:linear-gradient(0deg,#14161A 78%,rgba(20,22,26,0));display:flex;flex-direction:column;gap:2px;align-items:stretch}.dock.solo{padding-bottom:30px}
.go{height:52px;background:${CR};color:#14161A;font:700 14px 'Public Sans';letter-spacing:.04em;border-radius:2px}.go:active{background:${O}}.sk{height:38px;font:italic 400 15px 'Newsreader',serif;color:#a8a292;text-decoration:underline;text-underline-offset:3px}
.nav{display:flex;justify-content:space-between;padding:10px 20px 26px;border-top:1px solid #2A2C30;background:#14161A}.nav button{font:600 11px 'Public Sans';letter-spacing:.06em;color:#6f6b60;padding:4px 0;position:relative}.nav .on{color:${CR}}.nav .on::before{content:"";position:absolute;top:-11px;left:0;right:0;height:2px;background:${O}}
.fct{display:flex;flex-direction:column}.fct div{display:flex;justify-content:space-between;align-items:baseline;padding:11px 0;border-top:1px solid #2A2C30}.fct i{font:600 11px 'Public Sans';letter-spacing:.06em;text-transform:uppercase;color:#a8a292;font-style:normal}.fct i em{font:italic 400 12px 'Newsreader',serif;text-transform:none;letter-spacing:0;color:${O};margin-left:6px}.fct i small{font:italic 400 12px 'Newsreader';text-transform:none;letter-spacing:0;color:#8d887b;margin-left:6px}.fct b{font:500 22px 'Newsreader',serif;font-variant-numeric:lining-nums tabular-nums}
.dc{font:400 18px/1.5 'Newsreader',serif}.dc::first-letter{font:500 52px/.8 'Newsreader';float:left;margin:6px 8px 0 0;color:${O}}
.grid4{display:grid;grid-template-columns:1fr 1fr;gap:18px 16px;padding:16px 22px 0}
.pn{border-top:1px solid #2A2C30;padding-top:8px}.pn.cur{border-top:2px solid ${O}}.ph{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}.ph b{font:italic 500 18px 'Newsreader',serif}.ph i{font:600 10px 'Public Sans';letter-spacing:.08em;color:#8d887b;font-style:normal}.pn.cur .ph b{color:${O}}
.pn em{display:block;font:italic 400 12.5px/1.3 'Newsreader',serif;color:#a8a292;margin-top:4px}
.wkl>div{display:grid;grid-template-columns:62px 1fr auto 18px;gap:8px;align-items:baseline;padding:11px 0;border-top:1px solid #2A2C30}.wkl .d{font:600 11px 'Public Sans';color:#8d887b;letter-spacing:.04em}.wkl .n{font:500 17px 'Newsreader'}.wkl .c{font:400 12px 'Public Sans';color:#8d887b;grid-column:2;grid-row:2}.wkl .k{font:500 17px 'Newsreader';text-align:right}.wkl .s{color:${O};text-align:right}.wkl .done .n{color:#8d887b}.wkl .today .n{color:${O}}
.key>div{display:flex;gap:12px;align-items:center;padding:8px 0;border-top:1px solid #2A2C30;font:400 14px/1.35 'Newsreader',serif}.key b{font-weight:700}
.body{padding-bottom:20px}
`;
  (window.CONCEPTS = window.CONCEPTS || []).push({
    id: '07', name: 'EDITORIAL DATA', tag: 'Urednički dizajn + precizni podaci. Anotirani grafikoni, naslovi koji tvrde, direktne oznake.',
    css, screens: { today, workout, plan, progress },
    spec: {
      philosophy: 'Grafikon sa porukom je naslov. Svaki ekran počinje rečenicom koja je zaključak („Razlika: 14 sekundi.“), a ispod stoji dokaz — anotiran grafikon. Direktne oznake umesto legendi.',
      type: 'Newsreader (serif, urednički tekst i brojevi) + Public Sans (oznake). Sitne kapitalne oznake rubrika, kurziv za anotacije i dopune.',
      layout: 'Tamna „mastilo“ podloga, krem tekst, ohra jedini naglasak, crveno samo za cilj. Hairline pravila; bez kartica. Mali višestruki prikazi (small multiples) po fazama.',
      nav: 'Tekstualna traka sa ohra crtom iznad aktivnog taba. Gornja „nazivna traka“ nosi rubriku (Briefing, Plan, Napredak).',
      today: '„Briefing“: naslov-zaključak, grafikon „gde si u ciklusu“ sa anotacijom „Ovde si“, tri male metrike (forma, doslednost, trčanja), program u rečenici, dugme.',
      plan: 'Plan = pet malih grafikona (po fazi), svaki sa jednom rečenicom (npr. „105,2 od 110,9 km — 95 %“). Tekuća faza ohra; ispod lista tekuće nedelje.',
      workout: 'Anotiran profil sesije (direktne oznake: „Prvi zalet = poslednji“), tabela činjenica sa oznakom „procena“, „zašto“ sa inicijalom (drop cap).',
      data: 'Dumbbell osa 20:37 → 20:13 → 19:59 → 19:45 (start, sada, cilj, projekcija) i VDOT grafikon sa direktnim oznakama. „Kako čitati“ sa tri uzorka linija (romb / puna / isprekidana).',
      motion: 'Mirna: linije se crtaju, traka dumbbell-a se produžava od starta do „sada“, brojevi se ne animiraju. Anotacije se pojavljuju poslednje (400 ms zakašnjenje).',
      mobile: 'Naslov od ~33px je čitljiv bez zumiranja; grafikoni pune širine; dugme prikovano.',
      desktop: 'Dve kolone kao članak sa grafikom: tekst levo, grafikon desno uz anotacije u marginama; small multiples u mreži 5 × 1.',
      key: 'Progress: „Procena danas: 20:13. Cilj: 19:59.“ + dumbbell.',
      cost: 'Newsreader (varijabilni) ~60 KB uz opsz osu, Public Sans ~25 KB. Naslovi-zaključci se generišu iz postojećih brojeva (aritmetika) — treba tabela rečenica; nikad ne sme tvrditi više nego što podaci dozvoljavaju.'
    }
  });
})();
