/* 08 · COMMAND CENTER — plan kao komandni centar: šta je danas, šta dolazi, gde si u ciklusu, šta je urađeno. */
(function () {
  const PH = { BAZA: '#5E8BD6', RAZVOJ: '#2BC4A8', VRHUNAC: '#E8A838', TAPER: '#A78BDB', TRKA: '#EF6B5B' };
  const TC = { lako: '#6C7A89', snaga: '#A78BDB', fartlek: '#EF6B5B', int: '#EF6B5B', tempo: '#E8A838', lr: '#5E8BD6', odmor: '#232B33', trka: '#EF6B5B' };
  const nav = (act) => `<nav class="foot nav">${NAV.map(([i, t], k) => `<button class="${k === act ? 'on' : ''}">${ICON[i](1.7)}<span>${t}</span></button>`).join('')}</nav>`;
  const railHtml = () => {
    const ph = D.phases;
    return `<div class="cy"><div class="cyt"><b>N6 / 12 · <span style="color:${PH.RAZVOJ}">RAZVOJ</span></b><span>T−46 d · 5K 20.12.</span></div>
<div class="rl">${D.W.map((k) => `<i class="${k.w < 6 ? 'p' : k.w === 6 ? 'n' : ''}" style="--c:${PH[k.ph]}"></i>`).join('')}<u class="fl">${ICON.flag(2.4)}</u></div>
<div class="pl">${ph.map((p) => `<span style="flex:${p.to - p.from + 1}"><em style="color:${PH[p.k]}">${p.to > p.from ? p.k : p.k.slice(0, 3)}</em></span>`).join('')}</div></div>`;
  };
  const cta = (solo) => `<div class="act ${solo ? 'solo' : ''}"><button class="go">Završi trening</button><button class="sk">Preskoči</button></div>`;
  const led = (c, t) => `<span class="led" style="--c:${c}"><i></i>${t}</span>`;

  const today = () => `
<div class="body">${railHtml()}
<section class="now rise" style="--i:0"><div class="nh"><b>DANAS · SRE 04.11.</b>${led('#E8A838', 'PREDSTOJI')}</div>
 <h1>Fartlek</h1><p class="sub">7 × 60 s brzo, 60 s lagano između</p>
 <div class="tg"><div class="pc"><i>CILJNI TEMPO</i><b>4:00<small>/km</small></b></div><div class="st"><div><i>DIST</i><b>8,6 km</b></div><div><i>TRAJANJE</i><b>≈42 min</b></div><div><i>NAPOR</i><b>RPE 8–9</b></div></div></div>
 <div class="mini">${profile({ w: 322, h: 52, easy: '#2d3640', work: '#EF6B5B', gap: 1, r: 1 }).svg}</div>
 ${cta()}</section>
<section class="two rise" style="--i:1"><div class="col"><h3>ZAVRŠENO · N6</h3>${D.week6.filter((d) => d.st === 'done').map((d) => `<div class="it"><i style="background:${TC[d.t]}"></i><span>${d.dow} · ${d.name}</span><b>${d.km ? kmf(d.km) : '✓'}</b></div>`).join('')}<div class="sum">7,8 od 37,9 km</div></div>
 <div class="col"><h3>SLEDEĆE</h3>${D.week6.filter((d) => d.st === 'next').map((d) => `<div class="it"><i style="background:${TC[d.t]}"></i><span>${d.dow} · ${d.name}</span><b>${kmf(d.km)}</b></div>`).join('')}<div class="sum">N7 počinje pon 09.11.</div></div></section>
<section class="cc rise" style="--i:2"><h3>CIKLUS</h3>${D.phases.map((p) => `<div class="pr ${p.k === 'RAZVOJ' ? 'on' : p.to < 5 ? 'dn' : ''}"><i style="background:${PH[p.k]}"></i><span>${p.k}</span><em>N${p.from}${p.to > p.from ? '–' + p.to : ''}</em><b>${{ BAZA: '✓ 105/111', RAZVOJ: '▶ 43/139', VRHUNAC: '79', TAPER: '24', TRKA: '15' }[p.k]}</b></div>`).join('')}</section>
</div>${nav(0)}`;

  const workout = () => `
<div class="body">${railHtml()}
<section class="nh2 rise" style="--i:0"><div class="nh"><b>TRENING · SRE 04.11.</b>${led(PH.RAZVOJ, 'RAZVOJ')}</div><h1>Fartlek</h1></section>
<section class="lanes rise" style="--i:1"><div class="ln pre" style="flex:37"><i>PRE</i><b>3 km</b><span>zagrevanje<br>5:09 /km</span></div><div class="ln rad" style="flex:33"><i>RAD</i><b>7 × 60 s</b><span>4:00 /km<br>60 s lagano</span><div class="mb">${'<u></u>'.repeat(7)}</div></div><div class="ln pos" style="flex:30"><i>POSLE</i><b>2,5 km</b><span>hlađenje<br>5:09 /km</span></div></section>
<section class="par rise" style="--i:2"><h3>PARAMETRI</h3>${[['Trajanje', '≈ 42:20', 'procena'], ['Distanca', '8,6 km', ''], ['Tempo rada', '4:00 /km', 'procena'], ['Napor', 'RPE 8–9', ''], ['Puls', 'Z4–Z5 · 164–182', 'ako su zone povezane']].map(([a, b, c]) => `<div><span>${a}</span><b>${b}</b><em>${c}</em></div>`).join('')}</section>
<section class="ctx rise" style="--i:3"><h3>KONTEKST</h3><p><b style="color:${PH.RAZVOJ}">RAZVOJ</b> · nedelja 6 od 12. ${D.phaseOf(6).line}</p></section>
<section class="ctx rise" style="--i:4"><h3>ZAŠTO</h3><p>${D.session.guide}</p></section>
</div>${cta(true).replace('class="act solo"', 'class="foot act solo"')}`;

  const pattern = ['lako', 'snaga', 'int', 'odmor', 'tempo', 'odmor', 'lr'];
  const plan = () => {
    const rows = (p) =>
      D.W.filter((k) => k.w >= p.from && k.w <= p.to)
        .map((k) => {
          const pat = k.w === 12 ? ['lako', 'snaga', 'int', 'odmor', 'lako', 'odmor', 'trka'] : pattern;
          const state = (i) => (k.w < 6 ? 'done' : k.w > 6 ? 'fut' : D.week6[i].st);
          const cells = pat.map((t, i) => {
            if (k.w === 1 && i < 4) return `<s></s>`;
            return `<i class="${t === 'odmor' ? 'r' : state(i)}" style="--c:${TC[t]}"></i>`;
          });
          return `<div class="wr ${k.w === 6 ? 'cur' : ''}"><b>N${k.w}</b><div class="cells">${cells.join('')}</div><span class="k">${kmf(k.plan)}${k.deload ? '<small>deload</small>' : ''}</span></div>`;
        })
        .join('');
    return `<div class="body">${railHtml()}
<section class="ttl rise" style="--i:0"><h1>Mapa ciklusa</h1><div class="lgd">${[['lako', 'Lagano'], ['int', 'Brzina'], ['tempo', 'Tempo'], ['lr', 'Dugo'], ['snaga', 'Snaga']].map(([k, t]) => `<span><i style="background:${TC[k]}"></i>${t}</span>`).join('')}</div></section>
<section class="map rise" style="--i:1"><div class="dh"><span></span><div class="cells"><em>P</em><em>U</em><em>S</em><em>Č</em><em>P</em><em>S</em><em>N</em></div><span class="k">KM</span></div>
${D.phases.map((p) => `<div class="pb" style="--c:${PH[p.k]}"><div class="ph"><b>${p.k}</b><span>${p.from < 5 ? 'završeno' : p.k === 'RAZVOJ' ? 'u toku' : ''}</span></div>${rows(p)}</div>`).join('')}</section>
<p class="fnt">Popunjeno = urađeno · prsten = danas · kontura = predstoji · tačka = odmor</p>
</div>${nav(1)}`;
  };

  const tile = (l, v, s, c, extra) => `<div class="tl"><div class="th"><i>${l}</i>${led(c, s)}</div><b>${v}</b>${extra}</div>`;
  const progress = () => `
<div class="body">${railHtml()}
<section class="ttl rise" style="--i:0"><h1>Status</h1></section>
<section class="grd rise" style="--i:1">
 ${tile('DOSLEDNOST', '96<small>%</small>', 'OK', '#2BC4A8', '<div class="bar"><span style="width:96%"></span></div><em>plan do sada · mereno</em>')}
 ${tile('OBIM', '148<small> km</small>', 'U PLANU', '#2BC4A8', '<div class="bar"><span style="width:96%"></span></div><em>od 153,5 planiranih · mereno</em>')}
 ${tile('FORMA', '49,2', 'RASTE', '#2BC4A8', spark(D.vdot.series.map((s) => s[1]), { w: 130, h: 26, color: '#5E8BD6', sw: 2 }) + '<em>VDOT +1,1 · procena</em>')}
 ${tile('CILJ 19:59', '+14<small> s</small>', 'U TOKU', '#E8A838', '<div class="bar"><span style="width:63%;background:#E8A838"></span></div><em>63 % puta · procena 20:13</em>')}</section>
<section class="chc rise" style="--i:2"><h3>FORMA → CILJ <span><i style="color:#fff">◆</i> mereno <i style="color:#5E8BD6">●</i> procena <i style="color:#8A97A5">┄</i> projekcija</span></h3>${vdotChart({ w: 342, h: 190, font: 'Archivo', col: { est: '#5E8BD6', meas: '#fff', proj: '#8A97A5', goal: '#E8A838', grid: '#1b232a', txt: '#6f7c8a', now: '#2d3640', area: '' }, labels: { goal: 'CILJ 49,9', proj: 'projekcija 50,6', est: '49,2', test: '3K 11:45' }, estW: 2.2 })}</section>
<section class="ms rise" style="--i:3"><h3>MILESTONES</h3><div class="mm ok">${ICON.check(2.6)}<span>Baza završena · 105,2 km</span></div><div class="mm ok">${ICON.check(2.6)}<span>VDOT 49,0 prvi put (30.10.)</span></div><div class="mm now"><i></i><span>Najduže trčanje 12,3 km · nedelja, 08.11.</span></div><div class="mm"><i></i><span>Sledeći test 3 km · nedelja 9</span></div></section>
</div>${nav(3)}`;

  const css = `
&{background:#0F1317;color:#E6EBF0;font-family:'Archivo',system-ui,sans-serif;--sb:#E6EBF0}
.body{padding-bottom:16px}
.cy{padding:6px 16px 12px;background:#0B0F13;border-bottom:1px solid #232B33}.cyt{display:flex;justify-content:space-between;align-items:baseline;font-stretch:80%;margin-bottom:8px}.cyt b{font-weight:700;font-size:15px;letter-spacing:.04em}.cyt span{font-size:12px;color:#8A97A5;font-weight:500}
.rl{display:flex;gap:3px;align-items:center}.rl i{flex:1;height:10px;border-radius:2px;background:var(--c);opacity:.22}.rl i.p{opacity:1}.rl i.n{opacity:1;height:16px;border-radius:3px;box-shadow:0 0 0 2px #0B0F13,0 0 0 3.5px var(--c)}
.fl{color:#EF6B5B;display:flex;margin-left:3px}.fl svg{width:16px;height:16px}
.pl{display:flex;gap:3px;margin-top:5px;margin-right:22px}.pl span{display:block}.pl em{font:700 9px 'Archivo';font-style:normal;letter-spacing:.08em;font-stretch:80%}
.led{display:inline-flex;align-items:center;gap:6px;font:700 10px 'Archivo';letter-spacing:.1em;color:var(--c);font-stretch:85%}.led i{width:7px;height:7px;border-radius:50%;background:var(--c);box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 22%,transparent)}
.now{margin:14px 12px 0;background:#151B21;border:1px solid #232B33;border-left:4px solid #2BC4A8;border-radius:6px;padding:14px 14px 14px}
.nh{display:flex;justify-content:space-between;align-items:center;font-size:11px;letter-spacing:.1em;color:#8A97A5;font-weight:700;font-stretch:85%}
.now h1,.nh2 h1,.ttl h1{font-size:34px;font-weight:800;letter-spacing:-.02em;margin-top:6px;line-height:1}.sub{color:#A9B6C3;font-size:14px;margin-top:4px}
.tg{display:grid;grid-template-columns:auto 1fr;gap:14px;margin-top:14px;align-items:end}.pc i,.st i{display:block;font:700 9.5px 'Archivo';font-style:normal;letter-spacing:.1em;color:#8A97A5;font-stretch:85%}.pc b{font-size:58px;font-weight:800;letter-spacing:-.04em;line-height:.95}.pc small{font-size:16px;color:#8A97A5;font-weight:600;margin-left:3px;letter-spacing:0}
.st{display:flex;flex-direction:column;gap:7px}.st b{font-size:16px;font-weight:700}
.mini{margin-top:12px;background:#10161B;border-radius:4px;padding:6px}
.act{display:flex;gap:8px;margin-top:14px}.act.solo{padding:10px 12px 30px;background:linear-gradient(0deg,#0F1317 78%,rgba(15,19,23,0))}
.go{flex:1;height:50px;border-radius:5px;background:#2BC4A8;color:#04211b;font:800 15px 'Archivo';letter-spacing:.02em}.go:active{filter:brightness(1.1)}.sk{width:90px;border:1px solid #2d3640;border-radius:5px;color:#A9B6C3;font:700 13px 'Archivo'}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 12px 0}.col{background:#151B21;border:1px solid #232B33;border-radius:6px;padding:12px}
h3{font:700 10.5px 'Archivo';letter-spacing:.12em;color:#8A97A5;font-stretch:85%;margin-bottom:8px;display:flex;justify-content:space-between;align-items:baseline}
.it{display:grid;grid-template-columns:8px 1fr auto;gap:8px;align-items:center;padding:7px 0;font-size:13px;border-top:1px solid #1d252c}.it:first-of-type{border:0}.it i{width:8px;height:8px;border-radius:2px}.it b{font-weight:700}.sum{margin-top:8px;font-size:11.5px;color:#8A97A5;border-top:1px solid #232B33;padding-top:8px}
.cc{margin:10px 12px 0;background:#151B21;border:1px solid #232B33;border-radius:6px;padding:12px 14px}
.pr{display:grid;grid-template-columns:8px 1fr auto auto;gap:10px;align-items:center;padding:8px 0;border-top:1px solid #1d252c;font-size:13px}.pr:first-of-type{border:0}.pr i{width:8px;height:20px;border-radius:2px}.pr span{font-weight:700;letter-spacing:.06em;font-stretch:90%}.pr em{font-style:normal;color:#8A97A5;font-size:12px}.pr b{font-weight:700;min-width:62px;text-align:right}.pr.dn{opacity:.55}.pr.on{background:rgba(43,196,168,.08);margin:0 -14px;padding:8px 14px}
.nav{display:grid;grid-template-columns:repeat(5,1fr);padding:6px 4px 24px;background:#0B0F13;border-top:1px solid #232B33}.nav button{display:flex;flex-direction:column;align-items:center;gap:3px;color:#6f7c8a;font:700 10px 'Archivo';font-stretch:90%;padding:5px 0}.nav svg{width:22px;height:22px}.nav .on{color:#2BC4A8}
.nh2{padding:14px 16px 0}.lanes{display:flex;gap:3px;padding:14px 12px 0}.ln{background:#151B21;border:1px solid #232B33;border-radius:6px;padding:10px 10px 12px;min-width:0}.ln i{display:block;font:700 9.5px 'Archivo';font-style:normal;letter-spacing:.12em;color:#8A97A5}.ln b{display:block;font-size:19px;font-weight:800;margin:3px 0 4px;letter-spacing:-.02em}.ln span{font-size:11.5px;color:#A9B6C3;line-height:1.3;display:block}
.ln.rad{background:#1d1a1c;border-color:#EF6B5B66}.ln.rad b{color:#EF6B5B}.mb{display:flex;gap:2px;margin-top:8px;align-items:flex-end;height:22px}.mb u{flex:1;background:#EF6B5B;height:100%;border-radius:1px;transform-origin:bottom;animation:lab-grow .5s both}
.par,.ctx{margin:10px 12px 0;background:#151B21;border:1px solid #232B33;border-radius:6px;padding:12px 14px}.par div{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:9px 0;border-top:1px solid #1d252c;font-size:14px}.par div:first-of-type{border:0}.par span{color:#A9B6C3}.par b{font-weight:700}.par em{grid-column:1/-1;font-style:normal;font-size:11px;color:#6f7c8a;margin-top:-4px}.par em:empty{display:none}
.ctx p{font-size:14px;line-height:1.5;color:#C5CFD9}
.ttl{padding:14px 16px 0}.lgd{display:flex;gap:12px;margin-top:10px;flex-wrap:wrap;font-size:11px;color:#A9B6C3}.lgd span{display:flex;align-items:center;gap:5px}.lgd i{width:9px;height:9px;border-radius:2px;display:inline-block}
.map{margin:12px 12px 0;background:#151B21;border:1px solid #232B33;border-radius:6px;padding:8px 12px 6px}
.dh,.wr{display:grid;grid-template-columns:36px 1fr 62px;gap:8px;align-items:center}.dh{font:700 10px 'Archivo';color:#6f7c8a;padding:4px 0}.dh .k{text-align:right}
.cells{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.cells em{font-style:normal;text-align:center}.cells i,.cells s{height:20px;border-radius:4px;display:block}
.cells i.done{background:var(--c)}.cells i.today{background:var(--c);box-shadow:0 0 0 2px #151B21,0 0 0 3.5px #fff}.cells i.next,.cells i.fut{border:1.5px solid color-mix(in srgb,var(--c) 70%,transparent)}.cells i.r{height:6px;background:#2d3640;margin:7px 0;border-radius:3px}.cells i.done.r,.cells i.rest{background:#2d3640;height:6px;margin:7px 0;border:0}.cells i.fut{opacity:.7}
.pb{margin-top:8px;border-top:2px solid var(--c);padding-top:2px}.ph{display:flex;justify-content:space-between;align-items:baseline;padding:5px 0 3px}.ph b{font:800 11px 'Archivo';letter-spacing:.12em;color:var(--c);font-stretch:85%}.ph span{font-size:10.5px;color:#8A97A5}
.wr{padding:3px 0}.wr b{font-size:12px;font-weight:700;color:#A9B6C3}.wr .k{text-align:right;font-size:13px;font-weight:700}.wr .k small{display:block;font-size:9px;color:#E8A838;font-weight:700;letter-spacing:.06em}.wr.cur{background:rgba(43,196,168,.09);margin:2px -12px;padding:5px 12px;border-left:3px solid #2BC4A8}
.fnt{font-size:11px;color:#6f7c8a;padding:10px 16px 0}
.grd{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 12px 0}.tl{background:#151B21;border:1px solid #232B33;border-radius:6px;padding:12px}.th{display:flex;justify-content:space-between;align-items:center}.th i{font:700 10px 'Archivo';font-style:normal;letter-spacing:.1em;color:#8A97A5;font-stretch:85%}.th .led{font-size:9px}
.tl b{display:block;font-size:34px;font-weight:800;letter-spacing:-.03em;margin:8px 0 6px;line-height:1}.tl small{font-size:14px;color:#8A97A5;font-weight:600;letter-spacing:0}.tl em{display:block;font-style:normal;font-size:11px;color:#8A97A5;margin-top:6px}.bar{height:5px;background:#232B33;border-radius:3px;overflow:hidden}.bar span{display:block;height:100%;background:#2BC4A8;border-radius:3px}
.chc{margin:10px 12px 0;background:#151B21;border:1px solid #232B33;border-radius:6px;padding:12px}.chc h3 span{font-weight:500;letter-spacing:0;font-size:10.5px;color:#A9B6C3}.chc h3 i{font-style:normal}
.ms{margin:10px 12px 0;background:#151B21;border:1px solid #232B33;border-radius:6px;padding:12px 14px}.mm{display:flex;gap:10px;align-items:center;padding:8px 0;border-top:1px solid #1d252c;font-size:13.5px;color:#A9B6C3}.mm:first-of-type{border:0}.mm svg{width:18px;height:18px;color:#2BC4A8}.mm i{width:14px;height:14px;border:1.5px solid #3a4651;border-radius:50%;flex:none;margin:0 2px}.mm.now i{border-color:#E8A838}.mm.ok{color:#E6EBF0}
`;
  (window.CONCEPTS = window.CONCEPTS || []).push({
    id: '08', name: 'COMMAND CENTER', tag: 'Plan kao komandni centar: danas, dolazi, ciklus, urađeno — odmah.',
    css, screens: { today, workout, plan, progress },
    spec: {
      philosophy: 'Odgovara na 5 pitanja bez klika: šta je danas, šta dolazi, gde sam u ciklusu, šta je urađeno, šta je sledeće. Kontekst (traka ciklusa) je trajno na vrhu svakog ekrana, pa korisnik nikad ne gubi poziciju.',
      type: 'Archivo (ima osu širine): uska verzija za oznake i LED statuse, normalna za brojeve i tekst. Brojevi 800, tabularni.',
      layout: 'Moduli (paneli) na tamnoj podlozi, ivica 1px, radijus 6px — „radna stanica“, ne kartice. Panel „Danas“ je jedini sa naglaskom (leva traka u boji).',
      nav: 'Donja traka sa 5 ikonica. TRAJNA traka ciklusa na vrhu: 12 segmenata obojenih po fazi, prsten oko tekuće nedelje, zastavica trke.',
      today: 'Traka ciklusa → panel DANAS (tempo 58px, 3 broja, mini profil, dugmad) → dve kolone ZAVRŠENO / SLEDEĆE → CIKLUS po fazama sa kilometrima.',
      plan: 'Mapa ciklusa: 12 redova × 7 ćelija dana, grupisano po fazama (boja faze). Popunjeno = urađeno, prsten = danas, kontura = predstoji. Plan se čita kao kalendar treninga, ne kao tabela.',
      workout: 'Tri trake PRE / RAD / POSLE proporcionalne trajanju (37/33/30 %), RAD je naglašen sa 7 stubića; zatim parametri, kontekst ciklusa i zašto.',
      data: 'Pločice statusa (doslednost, obim, forma, cilj) sa LED-om i mini grafikonom: odgovor „napredujem li?“ u 2 sekunde. Ispod VDOT → cilj sa oznakama mereno/procena/projekcija.',
      motion: 'Statusna: LED se pali kad panel uđe, segmenti ciklusa se pune sleva, ćelije mape ulaze po redovima. Nema stalnog treperenja.',
      mobile: 'Jedan skrol, jedan fokus (panel Danas iznad linije pregiba). Trajna traka ciklusa je 50px — sitna ali neinteraktivna, ne troši dodir.',
      desktop: 'Pravi komandni centar: tri kolone — levo mapa ciklusa, sredina Danas, desno Sledeće + status; traka ciklusa postaje horizontalni „timeline“ preko cele širine.',
      key: 'Today: traka ciklusa + panel DANAS + završeno/sledeće.',
      cost: 'Archivo varijabilni sa osom širine ~80 KB (ili 2 statička reza ~40 KB). Rizik: gustina — na malom ekranu mora ostati disciplina „jedan panel je glavni“.'
    }
  });
})();
