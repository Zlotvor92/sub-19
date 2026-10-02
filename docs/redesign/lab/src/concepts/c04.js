/* 04 · ACTIVITY STORY — društveno + performanse: trening kao priča/post, dostignuća, trake napora. */
(function () {
  const T = '#0E9F8E';
  const TYC = { e: '#98A2B3', l: '#3B82F6', t: '#F59E0B', i: '#EF4444', s: '#8B5CF6', r: '#E5E7EB' };
  const tab = (act) => `<nav class="foot tabs">${NAV.map(([i, t], k) => `<button class="${k === act ? 'on' : ''}">${ICON[i](1.8)}<span>${t}</span></button>`).join('')}</nav>`;
  const hdr = (t) => `<header class="hd"><div class="lg"><svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="9" fill="none" stroke="#D5D9E0" stroke-width="3"/><circle cx="12" cy="12" r="9" fill="none" stroke="${T}" stroke-width="3" stroke-dasharray="56.5" stroke-dashoffset="14" transform="rotate(-60 12 12)" stroke-linecap="round"/></svg><b>SUB-20</b></div><span>${t}</span></header>`;
  const stories = () => `<div class="stories">${D.week6.map((d) => `<div class="s ${d.st}"><span class="ring" style="--c:${TYC[KIND[d.t]]}"><i>${d.t === 'odmor' ? '–' : d.t === 'snaga' ? 'S' : d.t === 'lako' ? 'L' : d.t === 'fartlek' ? 'F' : d.t === 'tempo' ? 'T' : 'D'}</i>${d.st === 'done' ? `<u>${ICON.check(3)}</u>` : ''}</span><em>${d.dow}</em></div>`).join('')}</div>`;
  const STAR = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="vertical-align:-2px;margin-right:4px"><path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.6l1.2-6.5L2.5 9.5l6.6-.9z"/></svg>';
  const chip = (t, c = '') => `<span class="chip ${c}">${t}</span>`;
  const cta = (solo) => `<div class="foot dock ${solo ? 'solo' : ''}"><button class="go">Završi trening</button><button class="gh">Preskoči</button></div>`;

  const today = () => `
<div class="body">${hdr('Danas')}${stories()}
<article class="post rise" style="--i:0"><div class="ph"><span class="ava"></span><div><b>Planirano za danas</b><em>Sreda, 4. nov · Nedelja 6 · Razvoj</em></div>${chip('Fartlek', 'i')}</div>
<h2>7 brzih minuta u tempu 4:00</h2>
<div class="st3"><div><i>Distanca</i><b>8,6<small> km</small></b></div><div><i>Vreme</i><b>42<small> min</small></b></div><div><i>Brzi tempo</i><b>4:00<small> /km</small></b></div></div>
<div class="eff">${profile({ w: 330, h: 76, easy: '#D5D9E0', work: '#EF4444', r: 1.5, gap: 1 }).svg}</div>
<div class="legend"><span><i style="background:#D5D9E0"></i>Lagano 5:09</span><span><i style="background:#EF4444"></i>Brzo 4:00</span><span>Napor 8–9</span></div></article>
<article class="post feed rise" style="--i:1"><div class="ph"><span class="ava g"></span><div><b>Ponedeljak · Lagano 7,8 km</b><em>5:09/km · brže od proseka lakih (5:21)</em></div></div>${chip(STAR + 'Najbrže lagano ove nedelje', 'gold')}</article>
<article class="post feed rise" style="--i:2"><div class="ph"><span class="ava g"></span><div><b>Nedelja 5 završena</b><em>34,8 / 34,8 km · 4 od 4 treninga</em></div></div>${chip(STAR + 'Kompletna nedelja', 'gold')}</article>
</div>${cta()}${tab(0)}`;

  const workout = () => {
    const seg = [
      ['Zagrevanje', '3,0 km', '5:09', 100, '#D5D9E0'],
      ['Brzo × 7', '7 × 60 s', '4:00', 100, '#EF4444'],
      ['Oporavak × 6', '6 × 60 s', 'lagano', 60, '#98A2B3'],
      ['Hlađenje', '2,5 km', '5:09', 90, '#D5D9E0']
    ];
    return `<div class="body">${hdr('Trening')}
<article class="post rise" style="--i:0"><div class="ph"><span class="ava"></span><div><b>Planirano · Sre, 4. nov</b><em>Razvoj · Fartlek + Tempo</em></div></div><h2 class="x">Fartlek · 7 brzih minuta</h2>
<div class="st4"><div><i>Distanca</i><b>8,6 km</b></div><div><i>Vreme</i><b>≈ 42 min</b></div><div><i>Brzi tempo</i><b>4:00 /km</b><em>procena</em></div><div><i>Napor</i><b>RPE 8–9</b></div></div></article>
<article class="post rise" style="--i:1"><h3>Segmenti</h3>${seg.map(([n, d, p, w, c]) => `<div class="sp"><div class="l"><b>${n}</b><span>${d}</span></div><div class="tr"><span style="width:${w}%;background:${c}"></span></div><b class="p">${p}</b></div>`).join('')}</article>
<article class="post rise" style="--i:2"><h3>Cilj sesije</h3><div class="ck"><i>${ICON.check(3)}</i> Drži 4:00 na svih 7 zaleta</div><div class="ck"><i>${ICON.check(3)}</i> Prvi i poslednji zalet isti</div><div class="ck o"><i></i> Puls u zoni Z4–Z5 <small>(kad su zone povezane)</small></div></article>
<article class="post rise" style="--i:3"><h3>Zašto ovaj trening</h3><p>${D.session.guide}</p></article>
</div>${cta(true)}`;
  };

  const plan = () => `
<div class="body">${hdr('Plan')}
<div class="phs rise" style="--i:0">${D.phases.map((p) => `<span class="${p.k === 'RAZVOJ' ? 'on' : p.from < 5 ? 'dn' : ''}">${p.from < 5 ? '✓ ' : ''}${{ BAZA: 'Baza', RAZVOJ: 'Razvoj', VRHUNAC: 'Vrhunac', TAPER: 'Taper', TRKA: 'Trka' }[p.k]}</span>`).join('')}</div>
<div class="tl">${[5, 6, 7, 8]
    .map((w, i) => {
      const k = D.W[w - 1];
      const days = w === 6 ? D.week6 : w === 7 ? D.week7 : null;
      const done = w === 5;
      return `<article class="wc ${w === 6 ? 'cur' : ''} ${w > 6 ? 'fut' : ''} rise" style="--i:${i + 1}"><span class="nd"></span><div class="wh"><div><b>Nedelja ${w}</b><em>${k.deload ? 'Rasterećenje' : w === 6 ? 'Fartlek + Tempo' : 'Intervali + Tempo'}</em></div><div class="km"><b>${w === 6 ? '7,8' : done ? '34,8' : '–'}</b><span>/ ${kmf(k.plan)} km</span></div></div>
 ${days ? `<div class="dd">${days.map((d) => `<div class="${d.st}"><i style="background:${d.st === 'rest' ? 'transparent' : d.st === 'done' || d.st === 'today' ? TYC[KIND[d.t]] : '#fff'};border-color:${d.t === 'odmor' ? '#E5E7EB' : TYC[KIND[d.t]]}"></i><em>${d.dow[0]}</em></div>`).join('')}</div>` : done ? `<div class="dd">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<div class="done"><i style="background:${['#98A2B3', '#8B5CF6', '#EF4444', '#E5E7EB', '#F59E0B', '#E5E7EB', '#3B82F6'][n - 1]};border-color:transparent"></i><em>${'PUSČPSN'[n - 1]}</em></div>`).join('')}</div>${chip(STAR + 'Kompletna nedelja', 'gold')}` : ''}
 </article>`;
    })
    .join('')}</div>
</div>${tab(1)}`;

  const progress = () => `
<div class="body">${hdr('Napredak')}
<div class="hl rise" style="--i:0"><article class="mini"><i>Forma · VDOT ${chip('procena', 'est')}</i><b>49,2 <small>▲ +1,1</small></b>${spark(D.vdot.series.map((s) => s[1]), { w: 130, h: 34, color: T, sw: 2 })}</article>
<article class="mini"><i>Istrčano ${chip('mereno', 'mea')}</i><b>148 <small>km</small></b><div class="mb"><span style="width:96%"></span></div><em>96 % plana do sada</em></article></div>
<article class="post rise" style="--i:1"><h3>Predikcija 5 km</h3>
<div class="pr"><b>20:13</b><span>${chip('procena', 'est')}<em>ako bi trčao danas</em></span></div>
<div class="track"><span class="f" style="width:63%"></span><span class="m" style="left:63%"></span><div class="tl2"><i>20:37<br>start</i><i style="left:63%">20:13<br>sada</i><i class="r">19:59<br>cilj</i></div></div>
<p class="ex">Pređeno <b>63 %</b> puta od starta do cilja. Do cilja: 14 sekundi.</p></article>
<article class="post rise" style="--i:2"><h3>Test 3 km ${chip('izmereno', 'mea')}</h3><div class="pr"><b>11:45</b><span><em>25. oktobar · VDOT 49,0</em></span></div></article>
<article class="post rise" style="--i:3"><h3>Projekcija plana ${chip('projekcija', 'prj')}</h3><div class="pr"><b>19:45</b><span><em>VDOT 50,6 na dan trke, 20. dec</em></span></div></article>
<article class="post rise" style="--i:4"><h3>Dostignuća</h3><div class="bd">${[['5', 'Nedelja 5\nkompletna'], ['+1,1', 'VDOT od\nstarta'], ['35,6', 'Najjača\nnedelja km'], ['5:09', 'Najbrže\nlagano']].map(([e, t]) => `<div><span>${e}</span><em>${t.replace('\n', '<br>')}</em></div>`).join('')}</div></article>
</div>${tab(3)}`;

  const css = `
&{background:#F4F5F7;color:#14171A;font-family:'DM Sans',system-ui,sans-serif;--sb:#14171A}
.body{padding-bottom:20px}
.hd{display:flex;align-items:center;justify-content:space-between;padding:6px 16px 10px}.lg{display:flex;align-items:center;gap:8px}.lg b{font-weight:800;letter-spacing:.06em;font-size:15px}.hd>span{font-weight:700;font-size:15px;color:#667085}
.stories{display:flex;justify-content:space-between;padding:4px 16px 14px}
.s{display:flex;flex-direction:column;align-items:center;gap:6px}.s em{font:600 11px 'DM Sans';font-style:normal;color:#667085}
.ring{position:relative;width:42px;height:42px;border-radius:50%;border:2.5px dashed #D0D5DD;display:flex;align-items:center;justify-content:center;background:#fff}
.ring i{font:800 14px 'DM Sans';font-style:normal;color:#98A2B3}.s.done .ring{border:2.5px solid var(--c);border-style:solid}.s.done .ring i{color:var(--c)}
.ring u{position:absolute;right:-4px;bottom:-4px;width:17px;height:17px;border-radius:50%;background:${T};color:#fff;display:flex;align-items:center;justify-content:center;border:2px solid #F4F5F7}.ring u svg{width:10px;height:10px}
.s.today .ring{border:3px solid ${T};border-style:solid;box-shadow:0 0 0 4px rgba(14,159,142,.16)}.s.today .ring i{color:${T}}.s.today em{color:#14171A}.s.rest{opacity:.55}
.post{background:#fff;border:1px solid #E6E8EC;border-radius:16px;margin:0 12px 10px;padding:14px 14px 14px}
.ph{display:flex;align-items:center;gap:10px}.ph>div{flex:1;min-width:0}.ph b{display:block;font-size:14px;font-weight:700}.ph em{display:block;font-style:normal;font-size:12px;color:#667085;margin-top:1px}
.ava{width:34px;height:34px;border-radius:50%;background:conic-gradient(${T} 0 80%,#D5D9E0 0);display:block;position:relative}.ava::after{content:"";position:absolute;inset:7px;border-radius:50%;background:#fff}.ava.g{background:#E6E8EC}
.chip{display:inline-block;font:700 11px 'DM Sans';padding:4px 9px;border-radius:99px;background:#EEF0F3;color:#475467;white-space:nowrap}
.chip.i{background:#FEE4E2;color:#B42318}.chip.gold{background:#FEF0C7;color:#93370D;margin-top:10px}.chip.est{background:#E0F2FE;color:#0B5CAD;font-size:10px}.chip.mea{background:#D1FADF;color:#05603A;font-size:10px}.chip.prj{background:#EEF0F3;color:#475467;font-size:10px;border:1px dashed #98A2B3}
.post h2{font-size:24px;line-height:1.15;font-weight:800;letter-spacing:-.02em;margin:12px 0 4px}.post h2.x{font-size:26px}
.st3{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:10px}.st3 div{padding-right:8px}.st3 i,.st4 i{display:block;font-style:normal;font-size:11px;color:#667085;font-weight:600}.st3 b{font-size:28px;font-weight:800;letter-spacing:-.03em}.st3 small{font-size:12px;color:#667085;font-weight:600}
.eff{margin-top:12px;background:#F8F9FB;border-radius:10px;padding:8px 8px 0}.legend{display:flex;gap:14px;margin-top:10px;font-size:11.5px;color:#667085;font-weight:600}.legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px}
.dock{padding:10px 12px 8px;background:linear-gradient(0deg,#F4F5F7 78%,rgba(244,245,247,0));display:flex;gap:8px}.dock.solo{padding-bottom:30px}
.go{flex:1;height:52px;border-radius:12px;background:${T};color:#fff;font:800 16px 'DM Sans'}.go:active{transform:scale(.98)}.gh{width:100px;height:52px;border-radius:12px;background:#fff;border:1px solid #D0D5DD;font:700 14px 'DM Sans';color:#344054}
.tabs{display:grid;grid-template-columns:repeat(5,1fr);padding:7px 4px 24px;background:#fff;border-top:1px solid #E6E8EC}.tabs button{display:flex;flex-direction:column;align-items:center;gap:3px;color:#98A2B3;font:700 10px 'DM Sans'}.tabs svg{width:24px;height:24px}.tabs .on{color:${T}}
.st4{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;margin-top:14px}.st4 b{font-size:22px;font-weight:800;letter-spacing:-.02em;display:block}.st4 em{font:600 10px 'DM Sans';font-style:normal;color:#0B5CAD;background:#E0F2FE;border-radius:99px;padding:1px 6px;margin-left:0}
.post h3{font-size:14px;font-weight:800;margin-bottom:8px;display:flex;gap:8px;align-items:center}
.sp{display:grid;grid-template-columns:104px 1fr 44px;gap:10px;align-items:center;padding:7px 0;border-top:1px solid #F0F1F4}.sp:first-of-type{border:0}.sp .l b{font-size:13px;display:block}.sp .l span{font-size:12px;color:#667085}.tr{height:14px;background:#F0F1F4;border-radius:7px;overflow:hidden}.tr span{display:block;height:100%;border-radius:7px;animation:lab-grow2d .8s .2s both;transform-origin:left}.sp .p{font-size:14px;text-align:right;font-variant-numeric:tabular-nums}
@keyframes lab-grow2d{from{transform:scaleX(0)}}
.ck{display:flex;gap:10px;align-items:center;padding:7px 0;font-size:14px;font-weight:600}.ck i{width:22px;height:22px;border-radius:50%;background:${T};color:#fff;display:flex;align-items:center;justify-content:center;flex:none}.ck i svg{width:12px;height:12px}.ck.o i{background:transparent;border:2px dashed #D0D5DD}.ck small{color:#98A2B3;font-weight:500}
.post p{font-size:14.5px;line-height:1.5;color:#344054}
.phs{display:flex;gap:6px;padding:0 12px 12px;overflow:hidden}.phs span{flex:none;padding:7px 12px;border-radius:99px;background:#fff;border:1px solid #E6E8EC;font:700 12px 'DM Sans';color:#667085}.phs .on{background:#14171A;color:#fff;border-color:#14171A}.phs .dn{color:${T};border-color:#B7E4DE}
.tl{position:relative;padding:0 12px 0 26px}.tl::before{content:"";position:absolute;left:19px;top:6px;bottom:20px;width:2px;background:#DDE1E7}
.wc{position:relative;background:#fff;border:1px solid #E6E8EC;border-radius:16px;padding:14px;margin-bottom:10px}.wc .nd{position:absolute;left:-13px;top:20px;width:12px;height:12px;border-radius:50%;background:${T};border:3px solid #F4F5F7;box-sizing:content-box;margin-left:-3px}
.wc.cur{border:2px solid ${T}}.wc.fut{opacity:.72}.wc.fut .nd{background:#fff;border:2px solid #C5CBD3;width:10px;height:10px}
.wh{display:flex;justify-content:space-between;align-items:flex-start}.wh b{font-size:16px;font-weight:800}.wh em{display:block;font-style:normal;font-size:12.5px;color:#667085;margin-top:2px}.km{text-align:right}.km b{font-size:26px;letter-spacing:-.03em}.km span{font-size:12px;color:#667085;font-weight:600;margin-left:3px}
.dd{display:flex;gap:6px;margin-top:12px}.dd div{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1}.dd i{width:100%;height:26px;border-radius:7px;border:2px solid;display:block;box-sizing:border-box}.dd em{font:700 10px 'DM Sans';font-style:normal;color:#98A2B3}.dd .today i{box-shadow:0 0 0 3px rgba(14,159,142,.25)}.dd .rest i{border-style:dashed}
.hl{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 12px 10px}.mini{background:#fff;border:1px solid #E6E8EC;border-radius:16px;padding:12px}.mini i{font-style:normal;font-size:11.5px;color:#667085;font-weight:700;display:flex;gap:6px;align-items:center;flex-wrap:wrap}.mini b{display:block;font-size:30px;font-weight:800;letter-spacing:-.03em;margin:4px 0}.mini small{font-size:13px;color:${T};font-weight:800}.mini em{font-style:normal;font-size:11.5px;color:#667085}
.mb{height:7px;background:#EEF0F3;border-radius:4px;overflow:hidden;margin:2px 0 6px}.mb span{display:block;height:100%;background:${T}}
.pr{display:flex;align-items:center;gap:12px}.pr b{font-size:40px;font-weight:800;letter-spacing:-.04em;line-height:1}.pr span{display:flex;flex-direction:column;gap:4px;align-items:flex-start}.pr em{font-style:normal;font-size:12.5px;color:#667085}
.track{position:relative;height:12px;background:#EEF0F3;border-radius:6px;margin:18px 4px 54px}.track .f{position:absolute;left:0;top:0;bottom:0;background:${T};border-radius:6px;animation:lab-grow2d 1s .3s both;transform-origin:left}.track .m{position:absolute;top:-4px;width:20px;height:20px;border-radius:50%;background:#fff;border:4px solid ${T};margin-left:-10px;box-sizing:border-box}
.tl2{position:absolute;top:20px;left:0;right:0}.tl2 i{position:absolute;font:700 11px/1.3 'DM Sans';font-style:normal;color:#667085;transform:translateX(-50%);text-align:center}.tl2 i:first-child{transform:none;left:0;text-align:left}.tl2 .r{right:0;left:auto;transform:none;text-align:right;color:#14171A}
.ex{margin-top:6px;font-size:13.5px}.ex b{color:${T}}
.bd{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.bd div{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}.bd span{width:54px;height:54px;border-radius:50%;background:#FEF0C7;border:2px solid #F2C94C;display:flex;align-items:center;justify-content:center;font:800 15px 'DM Sans';color:#93370D;letter-spacing:-.02em}.bd em{font:700 10.5px/1.25 'DM Sans';font-style:normal;color:#475467}
`;
  (window.CONCEPTS = window.CONCEPTS || []).push({
    id: '04', name: 'ACTIVITY STORY', tag: 'Strava-2.0 osećaj bez kopiranja: trening kao priča, dostignuća, trake napora.',
    css, screens: { today, workout, plan, progress },
    spec: {
      philosophy: 'Trening je događaj koji se pamti. Planirani trening izgleda kao post aktivnosti; završeni dani postaju priče sa dostignućima. Motivacija dolazi iz sopstvene istorije, ne iz poređenja.',
      type: 'DM Sans (geometrijski humanist): težine 700–800 za brojeve i naslove, 500 za tekst. Mali „chip“ za tipove treninga i oznake porekla.',
      layout: 'Feed kartica na hladno-sivoj podlozi; traka sa „pričama“ (7 dana) na vrhu; kartice 16px radijus, 1px ivica, bez senki.',
      nav: 'Donja traka sa 5 ikonica, aktivna u boji akcije. Gornja traka nosi logo i naslov ekrana.',
      today: 'Traka dana (prsten po tipu treninga, kvačica kad je urađen), kartica „Planirano za danas“ kao post: naslov, 3 broja, traka napora, dugme. Ispod: završeni dani sa dostignućima.',
      plan: 'Vertikalna vremenska linija nedelja; svaka nedelja je kartica sa km i 7 kockica dana (boja = tip). Završene nedelje dobijaju značku „Kompletna nedelja“. Faze su pilule na vrhu.',
      workout: 'Kao detalj aktivnosti: 4 broja, „Segmenti“ kao split-trake sa tempom, „Cilj sesije“ kao lista sa kvačicama, „Zašto“ u kartici.',
      data: 'Kartice-ističi: VDOT sa sparkline-om, istrčano km, predikcija sa trakom „pređeno 63 % puta od starta do cilja“ (20:37 → 20:13 → 19:59). Poreklo je boja chipa: izmereno zeleno, procena plavo, projekcija isprekidano.',
      motion: 'Kartice se ubacuju redom (46 ms), trake se pune sleva (800 ms), kvačica „pop“ pri završetku. Završetak nedelje može da otključa značku.',
      mobile: 'Feed je prirodan palcu: skrol, dugme prikovano. Prsteni dana su 42px + labela = cilj dodira ≥ 44px.',
      desktop: 'Tri kolone kao feed aplikacija: levo profil/ciklus, sredina feed, desno „ističi“ i dostignuća.',
      key: 'Today: kartica „Planirano za danas“ kao post.',
      cost: 'DM Sans ~28 KB (latin+latin-ext). Dostignuća traže definisan skup pravila (npr. „najbrže lagano“) — to je nova logika, ne postoji u domenu; u implementaciji bi se izvodila samo iz postojećih podataka i ne bi smela da menja domen.'
    }
  });
})();
