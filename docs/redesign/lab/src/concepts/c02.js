/* 02 · PREMIUM RUNNING JOURNAL — magazinski, topla hartija, serif, emocionalni naslovi. */
(function () {
  const tab = (act) => `<nav class="foot nav">${['Danas', 'Plan', 'Oporavak', 'Trka', 'Zajednica'].map((t, i) => `<button class="${i === act ? 'on' : ''}">${t}</button>`).join('')}</nav>`;
  const mast = (r) => `<header class="mast"><b>SUB-20</b><i>${r}</i></header>`;
  const prov = (k) => `<span class="pv ${k}">${{ m: 'izmereno', e: 'procena', p: 'projekcija' }[k]}</span>`;
  const romans = ['I', 'II', 'III', 'IV', 'V'];

  const today = () => `
<div class="body">${mast('4. novembar 2026.')}
<figure class="cover rise" style="--i:0">${topo(390, 280, { bg: '#16241E', line: '#7FA391', accent: '#E8B44D', seed: 3 })}<figcaption><em>Sreda · nedelja 6 od 12 · Razvoj</em><h1>Sedam brzih minuta.</h1></figcaption></figure>
<div class="by rise" style="--i:1"><span>8,6 km</span><span>≈ 42 min</span><span>napor 8–9</span></div>
<p class="deck rise" style="--i:2">Tri kilometra zagrevanja, pa sedam puta po minut brzo — u tempu od <b>4:00</b> po kilometru, ${prov('e')}. Između svakog minut laganog trčanja, na kraju 2,5 km hlađenja.</p>
<blockquote class="pq rise" style="--i:3">Vodi se po naporu, ne po štoperici.<cite>Kako se trči fartlek</cite></blockquote>
<div class="chap rise" style="--i:4"><b>Poglavlje II · Razvoj</b><span>${[5, 6, 7, 8].map((w) => `<i class="${w < 6 ? 'd' : w === 6 ? 'n' : ''}">${w}</i>`).join('')}</span></div>
<div class="act rise" style="--i:5"><button class="go">Završi trening</button><button class="sk">Preskoči</button></div>
<p class="fn rise" style="--i:6">Sledeće: petak, 6. novembar — <i>Tempo</i>, 9,2 km.</p>
</div>${tab(0)}`;

  const workout = () => {
    const steps = [
      ['1', 'Zagrevanje', '3 km lagano, oko 5:09/km. Na kraju par kratkih ubrzanja da se noge probude.'],
      ['2', 'Sedam brzih', 'Sedam puta po 60 sekundi na 4:00/km. Prvi i poslednji isti — ne kreći brže.'],
      ['3', 'Oporavak', 'Između zaleta 60 sekundi laganog trčanja. Potpuno opuštanje.'],
      ['4', 'Hlađenje', '2,5 km lagano. Ako možeš da pričaš u celim rečenicama, dobro je.']
    ];
    return `<div class="body">${mast('Trening · nedelja 6')}
<section class="art rise" style="--i:0"><em class="kick">Fartlek + Tempo · sreda</em><h1>Fartlek</h1><p class="dk">Kratki zaleti i jasna glava.</p></section>
<section class="sb4 rise" style="--i:1"><div><b>8,6</b><i>kilometara</i></div><div><b>42</b><i>minuta</i></div><div><b>4:00</b><i>tempo ${''}<span class="pv e">procena</span></i></div><div><b>8–9</b><i>napor</i></div></section>
<figure class="fig rise" style="--i:2">${profile({ w: 342, h: 96, easy: '#BFCBC2', work: '#1F6F5B', r: 1, gap: 1.5, ymin: 225, ymax: 330 }).svg}<figcaption>Sl. 1 — profil sesije: visina je brzina.</figcaption></figure>
<section class="how rise" style="--i:3"><h2>Kako izgleda trening</h2>${steps.map(([n, t, d]) => `<div class="st"><span>${n}</span><div><b>${t}</b><p>${d}</p></div></div>`).join('')}</section>
<aside class="why rise" style="--i:4"><h3>Zašto ovaj trening</h3><p>Faza <b>Razvoj</b> gradi brzinu i prag. Fartlek uči telo da ubrzava i da se brzo oporavlja, bez pritiska štoperice.</p><p class="hr">Puls: Z4–Z5 · 164–182 otk/min <i>(kad su zone povezane)</i></p></aside>
</div><div class="foot act2"><button class="go">Završi trening</button></div>`;
  };

  const plan = () => {
    const chap = [
      ['BAZA', '1–4', 105.2, 110.9, 'Završeno', 0],
      ['RAZVOJ', '5–8', 51.2 - 8.6, 139.2, 'U toku', 1],
      ['VRHUNAC', '9–10', 0, 78.7, '', 2],
      ['TAPER', '11', 0, 24.3, '', 3],
      ['TRKA', '12', 0, 14.5, '20. decembar · 5K · cilj 19:59', 4]
    ];
    const wk = D.W.filter((k) => k.w >= 5 && k.w <= 8);
    return `<div class="body">${mast('Plan')}
<section class="art rise" style="--i:0"><em class="kick">12 nedelja do 20. decembra</em><h1>Sadržaj</h1></section>
<section class="toc">${chap
      .map(
        ([n, r, a, b, s, i]) => `<div class="ch ${i === 1 ? 'cur' : ''} ${i === 0 ? 'done' : ''} rise" style="--i:${i + 1}"><div class="hd"><span class="rn">${romans[i]}</span><b>${n}</b><i class="ld"></i><span class="km">${a ? kmf(a) + ' / ' : ''}${kmf(b)} km</span></div><div class="sub"><span>nedelje ${r}</span>${s ? `<em>${s}</em>` : ''}</div>
      ${
        i === 1
          ? `<ul class="wl">${wk
              .map(
                (k) => `<li class="${k.w === 6 ? 'now' : ''} ${k.deload ? 'dl' : ''}"><span class="n">${k.w}</span><span class="t">${k.deload ? '<i>rasterećenje</i>' : { 5: 'Intervali + Tempo isprekidan', 6: 'Fartlek + Tempo', 7: 'Intervali + Tempo isprekidan' }[k.w]}${k.w === 6 ? '<small>Ovde si · sreda</small>' : ''}</span><span class="v">${k.real > 0 ? kmf(k.real) + ' / ' : ''}${kmf(k.plan)}</span>${k.w === 6 ? `<div class="dots">${D.week6.map((d) => `<i class="${d.st}">${d.dow[0]}</i>`).join('')}</div>` : ''}</li>`
              )
              .join('')}</ul>`
          : ''
      }</div>`
      )
      .join('')}</section>
<p class="fn rise" style="--i:7">Do sada <b>148,0 km</b> od planiranih 153,5 — <i>96 %</i>.</p>
</div>${tab(1)}`;
  };

  const progress = () => `<div class="body">${mast('Izveštaj')}
<section class="art rise" style="--i:0"><em class="kick">Da li napredujem? · pet nedelja</em><h1 class="s">Forma je porasla za 1,1 VDOT. Do cilja fali još 0,7.</h1></section>
<figure class="chart rise" style="--i:1">${vdotChart({ w: 342, h: 200, font: 'Inter', ticks: [48, 49, 50, 51], col: { est: '#12201A', meas: '#1F6F5B', proj: '#1F6F5B', goal: '#1F6F5B', grid: '#D0D9D2', txt: '#78887F', now: '#A9B9AF', area: '' }, estW: 2, labels: { goal: 'cilj 49,9', proj: '③ projekcija 50,6', est: '② 49,2', test: '① test 3 km' }, ls: 10, projDash: '1 5' })}
<figcaption><p><b>①</b> ${prov('m')} — test 3 km, 25. okt, 11:45 (VDOT 49,0)</p><p><b>②</b> ${prov('e')} — VDOT iz tempa radnih delova svake nedelje</p><p><b>③</b> ${prov('p')} — gde plan vodi do 20. decembra: VDOT 50,6, oko 19:45</p></figcaption></figure>
<section class="ptab rise" style="--i:2"><h2>Šta bi danas istrčao</h2>${[['5 km', '20:13'], ['10 km', '41:54'], ['Polumaraton', '1:32:48']].map(([a, b]) => `<div><span>${a}</span><i class="ld"></i><b>${b}</b>${prov('e')}</div>`).join('')}<p class="gl">Cilj: <b>19:59</b>. Razlika: 14 sekundi.</p></section>
<section class="notes rise" style="--i:3"><h2>Beleške sa puta</h2><p>Lagano trčanje je sada <b>11 sekundi po kilometru brže</b> uz puls niži za 5 otk/min. ${prov('m')}</p><p>Najjača nedelja do sada: <b>35,6 km</b> (treća). Najduže trčanje: 12,3 km stiže u nedelji 6.</p></section>
</div>${tab(3)}`;

  const css = `
&{background:#ECEFEA;color:#12201A;font-family:'Inter',system-ui,sans-serif;--sb:#12201A}
.body{padding-bottom:26px}
.mast{display:flex;justify-content:space-between;align-items:baseline;padding:8px 22px 8px;border-bottom:3px double #12201A;margin:0 0 0}
.mast b{font:700 12px 'Inter';letter-spacing:.28em}.mast i{font:italic 400 14px 'Fraunces',serif;color:#46574E}
.cover{position:relative;height:218px;margin:0;background:#16241E}
.cover figcaption{position:absolute;left:0;right:0;bottom:0;padding:70px 22px 20px;background:linear-gradient(0deg,rgba(14,26,20,.9),rgba(14,26,20,0));color:#fff}
.cover em{font:600 10.5px 'Inter';letter-spacing:.16em;text-transform:uppercase;opacity:.85;font-style:normal}
.cover h1{font:400 42px/1 'Fraunces',serif;letter-spacing:-.02em;margin-top:8px;font-variation-settings:'opsz' 144;font-weight:380}
.by{display:flex;gap:0;margin:0 22px;padding:12px 0;border-bottom:1px solid #C9D2CA;font:600 11px 'Inter';letter-spacing:.12em;text-transform:uppercase;color:#46574E}
.by span{flex:1;text-align:center;border-right:1px solid #C9D2CA}.by span:last-child{border:0}.by span:first-child{text-align:left}.by span:last-child{text-align:right}
.deck{margin:14px 22px 2px;font:400 17px/1.45 'Fraunces',serif;font-variation-settings:'opsz' 24}
.deck b{font-weight:700}
.pv{font:italic 500 12px 'Fraunces',serif;color:#46574E;letter-spacing:0}.pv.m{font-style:normal;font-weight:700;color:#12201A;font-variant:small-caps;letter-spacing:.04em}.pv.p{color:#1F6F5B;border-bottom:1px dotted #1F6F5B}
.pq{margin:12px 22px;padding:4px 0 4px 16px;border-left:3px solid #1F6F5B;font:italic 400 21px/1.3 'Fraunces',serif}
.pq cite{display:block;margin-top:8px;font:600 10.5px 'Inter';font-style:normal;letter-spacing:.14em;text-transform:uppercase;color:#78887F}
.chap{display:flex;justify-content:space-between;align-items:center;margin:12px 22px 0;padding:9px 0;border-top:1px solid #C9D2CA;border-bottom:1px solid #C9D2CA}
.chap b{font:700 11px 'Inter';letter-spacing:.16em;text-transform:uppercase}.chap span{display:flex;gap:6px}
.chap i{width:26px;height:26px;border:1px solid #A9B9AF;border-radius:50%;font:500 12px 'Fraunces';font-style:normal;display:flex;align-items:center;justify-content:center;color:#78887F}
.chap i.d{background:#12201A;color:#ECEFEA;border-color:#12201A}.chap i.n{border-color:#1F6F5B;color:#1F6F5B;font-weight:700;box-shadow:0 0 0 3px rgba(31,111,91,.15)}
.act{padding:14px 22px 0;display:flex;flex-direction:column;gap:12px;align-items:center}
.go{width:100%;height:54px;background:#12201A;color:#ECEFEA;font:600 14px 'Inter';letter-spacing:.14em;text-transform:uppercase;border-radius:2px}.go:active{background:#1F6F5B}
.sk{font:500 13px 'Fraunces',serif;font-style:italic;color:#46574E;text-decoration:underline;text-underline-offset:3px;padding:6px}
.fn{margin:12px 22px 0;font:400 14px/1.5 'Fraunces',serif;color:#46574E}.fn i{color:#12201A}
.nav{display:flex;justify-content:space-between;padding:12px 18px 26px;border-top:1px solid #C9D2CA;background:#ECEFEA}
.nav button{font:600 10.5px 'Inter';letter-spacing:.1em;text-transform:uppercase;color:#78887F;padding:4px 0;position:relative}
.nav button.on{color:#12201A}.nav button.on::after{content:"";position:absolute;left:50%;bottom:-8px;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:#1F6F5B}
/* workout */
.art{padding:22px 22px 8px}.kick{display:block;font:600 10.5px 'Inter';letter-spacing:.16em;text-transform:uppercase;color:#1F6F5B;font-style:normal}
.art h1{font:380 54px/1 'Fraunces',serif;letter-spacing:-.025em;margin-top:8px;font-variation-settings:'opsz' 144}.art h1.s{font-size:31px;line-height:1.1;font-weight:400;letter-spacing:-.015em}
.dk{font:italic 400 19px 'Fraunces',serif;color:#46574E;margin-top:8px}
.sb4{display:grid;grid-template-columns:repeat(4,1fr);margin:14px 22px 0;border-top:1px solid #12201A;border-bottom:1px solid #C9D2CA}
.sb4 div{padding:12px 6px 12px 0;border-right:1px solid #C9D2CA;padding-left:10px}.sb4 div:first-child{padding-left:0}.sb4 div:last-child{border:0}
.sb4 b{display:block;font:400 28px/1 'Fraunces',serif;letter-spacing:-.02em;font-variation-settings:'opsz' 72}.sb4 i{display:block;font:600 9px 'Inter';letter-spacing:.1em;text-transform:uppercase;color:#78887F;margin-top:6px;font-style:normal;line-height:1.5}.sb4 .pv{font-size:10px;text-transform:none;letter-spacing:0}
.fig{margin:18px 22px 0}.fig svg{display:block}.fig figcaption{font:italic 12.5px 'Fraunces',serif;color:#78887F;margin-top:8px;border-top:1px solid #C9D2CA;padding-top:6px}
.how{margin:22px 22px 0}.how h2,.ptab h2,.notes h2{font:700 11px 'Inter';letter-spacing:.16em;text-transform:uppercase;border-bottom:1px solid #12201A;padding-bottom:8px;margin-bottom:6px}
.st{display:grid;grid-template-columns:44px 1fr;gap:6px;padding:12px 0;border-bottom:1px solid #C9D2CA}
.st>span{font:300 44px/1 'Fraunces',serif;color:#1F6F5B;font-variation-settings:'opsz' 144}.st b{font:700 12px 'Inter';letter-spacing:.1em;text-transform:uppercase}.st p{font:400 15.5px/1.45 'Fraunces',serif;margin-top:4px;color:#2B3A32}
.why{margin:20px 22px 0;padding:14px 16px;background:#DFE6DF;border-left:3px solid #12201A}
.why h3{font:700 11px 'Inter';letter-spacing:.16em;text-transform:uppercase}.why p{font:400 15.5px/1.5 'Fraunces',serif;margin-top:6px}.why .hr{font:500 13px 'Inter';color:#46574E;border-top:1px solid #BFCBC2;padding-top:8px;margin-top:10px}.why .hr i{color:#78887F}
.act2{padding:12px 22px 30px;background:linear-gradient(0deg,#ECEFEA 70%,rgba(242,237,227,0))}
/* plan */
.toc{padding:4px 22px 0}
.ch{padding:14px 0;border-bottom:1px solid #C9D2CA}.ch .hd{display:flex;align-items:baseline;gap:10px}
.rn{font:300 26px 'Fraunces',serif;width:36px;color:#1F6F5B;font-variation-settings:'opsz' 144}.ch b{font:700 13px 'Inter';letter-spacing:.16em}
.ld{flex:1;border-bottom:1px dotted #93A399;transform:translateY(-4px)}.km{font:500 13px 'Fraunces',serif;font-variant-numeric:tabular-nums}
.sub{display:flex;justify-content:space-between;padding-left:46px;font:italic 13.5px 'Fraunces',serif;color:#78887F;margin-top:2px}.sub em{color:#1F6F5B;font-style:normal;font:700 10.5px 'Inter';letter-spacing:.12em;text-transform:uppercase}
.ch.done{opacity:.55}.ch.cur{background:linear-gradient(#E0E8E1,#E0E8E1) 0 0/100% 100% no-repeat;margin:0 -22px;padding:14px 22px}
.wl{list-style:none;margin:10px 0 0 46px}.wl li{display:grid;grid-template-columns:22px 1fr auto;gap:6px;padding:9px 0;border-top:1px solid #C3CEC5;align-items:baseline}
.wl .n{font:600 13px 'Fraunces';color:#78887F}.wl .t{font:400 15px 'Fraunces',serif}.wl .t small{display:block;font:700 10px 'Inter';letter-spacing:.12em;text-transform:uppercase;color:#1F6F5B;margin-top:3px}.wl .v{font:500 13px 'Fraunces';font-variant-numeric:tabular-nums;color:#46574E}
.wl li.now{padding:12px 0}.wl li.now .t{font-weight:600}.wl li.now .n{color:#1F6F5B}.wl li.dl .t i{color:#78887F}
.dots{grid-column:1/-1;display:flex;gap:6px;margin-top:8px}.dots i{width:26px;height:26px;border-radius:50%;border:1px solid #A9B9AF;font:600 10px 'Inter';font-style:normal;display:flex;align-items:center;justify-content:center;color:#78887F}
.dots i.done{background:#12201A;color:#ECEFEA;border-color:#12201A}.dots i.today{border-color:#1F6F5B;color:#1F6F5B;box-shadow:0 0 0 3px rgba(31,111,91,.16)}.dots i.rest{opacity:.4}
/* progress */
.chart{margin:12px 14px 0}.chart svg{display:block}.chart figcaption{margin:10px 8px 0;border-top:1px solid #C9D2CA;padding-top:10px}.chart p{font:400 13.5px/1.4 'Fraunces',serif;margin:5px 0}.chart p b{font-family:'Inter';color:#1F6F5B;margin-right:4px}
.ptab,.notes{margin:22px 22px 0}.ptab div{display:flex;align-items:baseline;gap:8px;padding:10px 0;border-bottom:1px solid #C9D2CA}.ptab span{font:400 16px 'Fraunces'}.ptab b{font:400 22px 'Fraunces';font-variant-numeric:tabular-nums}
.gl{font:italic 15px 'Fraunces',serif;margin-top:12px;color:#2B3A32}.gl b{font-style:normal;color:#1F6F5B}
.notes p{font:400 15.5px/1.5 'Fraunces',serif;margin:10px 0;color:#1C2A23}
`;
  (window.CONCEPTS = window.CONCEPTS || []).push({
    id: '02', name: 'PREMIUM JOURNAL', tag: 'Magazinski dnevnik trčanja. Serif, hladna zelenkasta hartija, naslovi koji pričaju o treningu.',
    css, screens: { today, workout, plan, progress },
    spec: {
      philosophy: 'Trening je priča, ne red u tabeli. Svaki dan ima naslov („Sedam brzih minuta.“) i dah. Podaci su tu, ali ih čitaš kao članak: prvo smisao, onda brojevi.',
      type: 'Fraunces (display serif, optički veliki naslovi) + Inter za sitne oznake. Brojevi su u serifu sa tabularnim ciframa; kapitalne oznake samo za rubrike.',
      layout: 'Jedna kolona kao u časopisu: naslovna slika → potpis → pasus → citat. Pravila (hairline) umesto kartica; dvostruka crta ispod nazivne trake. Hladna hartija i šumsko zelenilo (namerno ne krem + terakota).',
      nav: 'Donja traka samo tekst (bez ikonica), mala kapitalna slova; aktivan tab = zelena tačka. Gornja „nazivna traka“ nosi datum.',
      today: 'Naslovna „fotografija“ + naslov u pola ekrana. Bajlajn (km · min · napor), pasus u rečenicama, citat „kako se trči“, pozicija u poglavlju (II · Razvoj, nedelje 5–8). Jedno dugme.',
      plan: 'Plan = sadržaj knjige: rimska poglavlja (BAZA, RAZVOJ…), tačkasti vodič do kilometara; završena poglavlja bleđa, tekuće otvoreno sa nedeljama i kružićima dana.',
      workout: 'Članak: kicker, naslov 54px, rečenica, traka sa 4 broja, slika profila sa potpisom „Sl. 1“, korak-po-korak sa velikim numeralima i kutija „Zašto ovaj trening“.',
      data: 'Anotiran grafikon sa brojčanim oznakama ①②③ i fusnotama ispod. Poreklo je tipografsko: izmereno (verzalno), procena (kurziv), projekcija (zeleno, tačkasto podvučeno).',
      motion: 'Spora i tiha: sadržaj se „slaže“ po redu čitanja (rise, 46 ms razmak). Bez count-up-a; linija grafikona se crta jednom.',
      mobile: 'Čita se palcem: skrol, jedno dugme na dnu. Tekstualna navigacija — mete dodira 44px visoke zahvaljujući padding-u.',
      desktop: 'Dve kolone: članak levo (max 640px), „marginalije“ desno (sledeće, poglavlje, fusnote). Naslovna slika postaje široki baner.',
      key: 'Today: naslovna slika + „Sedam brzih minuta.“',
      cost: 'Fraunces je varijabilni font (~110 KB za latin+latin-ext, samostalno hostovan; opsz osa se može izbaciti → ~45 KB). Naslovi traže tabelu tekstova po tipu treninga (≈9 šablona) i opcionalno izvor fotografije. Sa fotografijama: lazy-load, WebP ≤ 40 KB.'
    }
  });
})();
