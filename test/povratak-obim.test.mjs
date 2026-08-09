/* POVRATAK NA PUN OBIM — posle povrede i posle prekida bez bola.

   ZAŠTO OVAJ FAJL POSTOJI

   `povreda.test.mjs` proverava ODLUKU u jednom danu: da li bol u šaci menja
   plan, koji run/walk odnos ide uz koji bol, da li se predlog uopšte pojavi.
   Sve je to tačno — i sve je promašilo dve stvari koje se vide tek kad se
   priprema odigra NEDELJU PO NEDELJU:

   1. Lestvica povratka (50/70/85%) završavala se po KALENDARU. Dvadeset prvog
      dana `returnToRunPhase` vrati null, sa njom nestane i ACWR granica koju
      je `injuryProposal` držao, i plan traži ono za šta je projektovan — a
      hronično opterećenje je za to vreme palo. Izmereno: najveći skok obima u
      celoj pripremi, i to kod čoveka koji se upravo oporavio (ACWR do 1.9, na
      sve četiri distance).

   2. Prekid BEZ unosa bola — bolest, put, obaveza — nije pokretao ništa. Dve
      prazne nedelje, pa plan vrati pun obim i puno dugo trčanje istog dana:
      ACWR 2.3–2.5. Cela mašinerija povratka visila je o dnevniku kolena, a
      prekid najčešće nije povreda.

   Ni jedan test nije mogao da vidi ni jedno ni drugo, jer nijedan nije
   ODIGRAO više od jednog dana.

   ŠTA SE OVDE MERI: ishod kroz vreme — nedeljni obim, odnos akutnog i
   hroničnog opterećenja, i to da povratak ide NAGORE. I jedna negativna
   provera koja je najvažnija od svih: trkač koji nije propustio nijedan
   trening ne sme da vidi nijedan predlog, ni jednog dana. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const POCETAK = '2026-01-05';                    /* ponedeljak */
const dodaj = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

const DIST = { '5K': 5000, '10K': 10000, 'HM': 21097.5, 'Maraton': 42195 };

/* Aplikacija sa generisanim planom za datu distancu. */
function saPlanom(raceDistM, over = {}) {
  const a = loadApp({ now: POCETAK + 'T09:00:00Z' });
  const plan = a.call('generatePlan', {
    startDate: POCETAK, raceDate: dodaj(POCETAK, 24 * 7), raceDistM,
    pb: { distM: 5000, sec: 1237 }, weeklyKm: 55, runDays: 5, quality: 2,
    intensity: 'std', trainedRecently: true, ...over
  });
  assert.ok(plan && !plan.error, 'plan se nije napravio: ' + JSON.stringify(plan && plan.error));
  a.evalIn(`S.genPlan=adaptGeneratedPlan(${JSON.stringify(plan)}); setActivePlan(); rebuildDateIndex();`);
  assert.ok(a.evalIn('CUR_PLAN.length'), 'plan nije instaliran');
  return a;
}

const daniPlana = a => a.evalIn("DATED.map(function(d){return {id:d.id,km:d.km||0,rest:!!d.rest,date:d.date};})");

/* Dnevnik punog izvršenja do datuma `do_` (isključivo). */
function odradiDo(a, do_) {
  const log = {};
  for (const d of daniPlana(a)) if (!d.rest && d.km && d.date < do_) log[d.id] = { status: 'done', km: d.km, runDate: d.date };
  a.evalIn(`S.log=${JSON.stringify(log)}; rebuildDateIndex();`);
}

/* Odigra `nedelja` nedelja od `od`: svakog dana prihvati predlog ako ga ima i
   upiše u dnevnik ono što plan tog dana kaže. Vraća red po nedeljama. */
function odigraj(a, od, nedelja) {
  const red = [];
  for (let b = 0; b < nedelja; b++) {
    let km = 0, dugo = 0, nivo = null;
    for (let i = 0; i < 7; i++) {
      const dan = dodaj(od, b * 7 + i);
      a.evalIn(`TODAY='${dan}';`);
      const p = a.call('injuryProposal', dan);
      if (p) { if (!nivo) nivo = p.level; a.call('applyInjuryProposal', p); }
      const d = a.evalIn(`(function(){var d=BY_DATE['${dan}'];return d?{id:d.id,km:d.km||0,rest:!!d.rest}:null;})()`);
      if (d && !d.rest && d.km) {
        a.evalIn(`S.log[${JSON.stringify(d.id)}]={status:'done',km:${d.km},runDate:'${dan}'};`);
        km += d.km; dugo = Math.max(dugo, d.km);
      }
    }
    const kraj = dodaj(od, b * 7 + 6);
    a.evalIn(`TODAY='${kraj}';`);
    const ac = a.call('acwrSada', kraj);
    red.push({ km: Math.round(km * 10) / 10, dugo: Math.round(dugo * 10) / 10, nivo, acwr: ac.odnos, hron: ac.hron });
  }
  return red;
}

/* ============================================================
   1. LESTVICA POVRATKA SE NE ZAVRŠAVA PO KALENDARU
   ============================================================ */
describe('Posle povrede: lestvica se završava kad opterećenje sustigne plan, ne 21. dana', () => {
  /* Ozbiljna epizoda pa oporavak; `sinceClear` je dana OD KRAJA akutne faze,
     pa se pojasevi mere od poslednjeg bola + 7. */
  function saPovredom(raceDistM) {
    const a = saPlanom(raceDistM);
    const BOL = dodaj(POCETAK, 8 * 7 + 2);
    const knee = [];
    for (let i = 0; i < 21; i++) knee.push({ id: 'k' + i, date: dodaj(BOL, i), pain: i < 20 ? 7 : 5, part: 'ahilova-D' });
    odradiDo(a, BOL);
    a.evalIn(`S.knee=${JSON.stringify(knee)}; rebuildDateIndex();`);
    return { a, zadnjiBol: knee[knee.length - 1].date };
  }

  test('22. dan više ne vraća `null` — lestvica dobija četvrtu, otvorenu fazu', () => {
    const { a, zadnjiBol } = saPovredom(42195);
    /* dan 28 = sinceClear 21, prvi dan posle treće nedelje lestvice */
    const dan = dodaj(zadnjiBol, 28);
    a.evalIn(`TODAY='${dan}';`);
    const ph = a.call('returnToRunPhase', dan);
    assert.ok(ph, 'lestvica je nestala 22. dana — plan skače na pun obim');
    assert.equal(ph.week, 4);
    assert.equal(ph.pct, 1, 'četvrta faza ne sme da nosi svoj procenat — ostaje samo ACWR granica');
  });

  for (const [ime, m] of Object.entries(DIST)) {
    test(`${ime}: nedelja posle lestvice nije najveći skok u pripremi`, () => {
      const { a, zadnjiBol } = saPovredom(m);
      /* Od prvog dana bez bola, osam nedelja — lestvica pokriva 5, pa još tri. */
      const red = odigraj(a, dodaj(zadnjiBol, 1), 8);
      const stvarne = red.filter(r => r.km > 0);
      assert.ok(stvarne.length >= 6, 'premalo odigranih nedelja: ' + JSON.stringify(red));

      /* GLAVNA MERA — rast iz nedelje u nedelju. Nalaz je bio da nedelja posle
         lestvice donosi najveći skok u celoj pripremi (+119 do +153% obima).
         Merenjem posle popravke rast nigde ne prelazi ~30%. */
      /* Prag je 50%, ne 35%. Prvobitnih 35% je izmereno dok je `hronicniObim`
         od utorka uračunavao tekuću, nezavršenu nedelju i time obarao imenilac —
         povratak je bio sporiji nego što treba (35–46% predpauznog obima umesto
         60–70%). Kad je imenilac ispravljen, rampa je legitimno brža. Nalaz koji
         se ovde čuva je bio +119 do +153%, pa 50% i dalje ostavlja širok pojas
         između ispravnog i pogrešnog. */
      for (let i = 1; i < red.length; i++) {
        if (!(red[i - 1].km > 0)) continue;
        const rast = red[i].km / red[i - 1].km - 1;
        assert.ok(rast <= 0.50,
          `nedelja ${i + 1} povratka je za ${Math.round(rast * 100)}% veća od prethodne (${JSON.stringify(red.map(r => r.km))})`);
      }

      /* ACWR uz to — ali tek kad hronična osnova nešto znači. Prve dve nedelje
         posle tronedeljne pauze imaju hronično od 2–3 km, pa je odnos tada
         aritmetika a ne mera opterećenja (10 km / 2.5 km = 4.0). */
      for (const r of red) {
        if (r.acwr == null || !(r.hron >= 15)) continue;
        assert.ok(r.acwr < 1.5,
          `ACWR ${r.acwr} pri hroničnom ${r.hron} km — preko granice koju aplikacija sama zove opasnom (${JSON.stringify(red)})`);
      }
    });
  }

  /* ZAŠTO OVAJ TEST POSTOJI POSED GORNJIH ČETIRI.
     Gornja četiri mere ISHOD (rast obima i ACWR) i prolaze i kad se četvrta
     faza ukloni — jer tada teret preuzme grana za prekid bez bola. To je dobro
     za korisnika (dve nezavisne odbrane), ali znači da ishod sam po sebi ne
     dokazuje da lestvica radi. Zato se ovde imenuje MEHANIZAM.

     Razlika između to dvoje nije akademska: grana za prekid traži ostvarenost
     ispod 0.70, a lestvica koja se odrađuje kako treba (50/70/85%) daje
     ostvarenost baš oko te vrednosti. Bez četvrte faze bi se granica u tom
     pojasu palila i gasila iz nedelje u nedelju. */
  for (const dana of [28, 35]) {
    test(`${dana}. dan posle bola predlog i dalje drži lestvica, ne grana za prekid`, () => {
      const { a, zadnjiBol } = saPovredom(42195);
      const kraj = dodaj(zadnjiBol, dana);
      /* Odigraj lestvicu kako aplikacija predlaže, dan po dan. */
      odigraj(a, dodaj(zadnjiBol, 1), Math.ceil(dana / 7));
      a.evalIn(`TODAY='${kraj}';`);
      const p = a.call('injuryProposal', kraj);
      assert.ok(p, `${dana}. dan: nema nikakvog ograničenja — plan skače na pun obim`);
      assert.equal(p.level, 'return', `${dana}. dan: lestvica je nestala, ostala je samo grana za prekid`);
      assert.equal(p.week, 4);
      assert.ok(!/lestvica povratka kaže/.test(p.message),
        'poruka četvrte faze se poziva na procenat lestvice koji u njoj ne postoji');
      assert.ok(!/od 3/.test(p.title), `naslov četvrte faze i dalje broji do tri: „${p.title}"`);
    });
  }

  test('lestvica se ipak ZAVRŠI — kad prosek odrađenog sustigne plan, predloga nema', () => {
    /* Bez ovoga bi „ne završavaj po kalendaru" značilo „ne završavaj nikad":
       čovek bi zauvek trčao smanjen plan. */
    const a = saPlanom(10000);
    const BOL = dodaj(POCETAK, 8 * 7 + 2);
    /* Kratka epizoda: pun dnevnik do bola, jedan ozbiljan dan, pa oporavak.
       Hronično opterećenje je i dalje visoko, pa ACWR granica ne grize. */
    odradiDo(a, BOL);
    a.evalIn(`S.knee=[{id:'k1',date:'${BOL}',pain:7,part:'ahilova-D'}]; rebuildDateIndex();`);
    /* Nastavi da trčiš pun plan kroz akutnu fazu i lestvicu. */
    for (const d of daniPlana(a)) {
      if (!d.rest && d.km && d.date >= BOL && d.date <= dodaj(BOL, 40))
        a.evalIn(`S.log[${JSON.stringify(d.id)}]={status:'done',km:${d.km},runDate:'${d.date}'};`);
    }
    const dan = dodaj(BOL, 40);
    a.evalIn(`TODAY='${dan}'; rebuildDateIndex();`);
    assert.equal(a.call('injuryProposal', dan), null,
      'predlog i dalje smanjuje plan iako je hronično opterećenje odavno sustiglo — povratak se nikad ne završava');
  });
});

/* ============================================================
   2. PREKID BEZ UNOSA BOLA
   ============================================================ */
describe('Prekid bez bola pokreće isti postepen povratak', () => {
  function saPauzom(raceDistM, danaPauze) {
    const a = saPlanom(raceDistM);
    const PAUZA_OD = dodaj(POCETAK, 8 * 7);
    odradiDo(a, PAUZA_OD);
    a.evalIn(`S.knee=[]; rebuildDateIndex();`);
    /* Prosečan obim tri pune nedelje pred pauzu — mera prema kojoj se sudi
       da li je povratak doziran, umesto ACWR-a čiji imenilac pamti pauzu. */
    const dani = daniPlana(a);
    let preKm = 0;
    for (let b = 1; b <= 3; b++) {
      const s = dodaj(PAUZA_OD, -7 * b);
      preKm += dani.filter(d => !d.rest && d.date >= s && d.date < dodaj(s, 7))
                   .reduce((x, d) => x + d.km, 0);
    }
    return { a, povratak: dodaj(PAUZA_OD, danaPauze), preKm: preKm / 3 };
  }

  for (const [ime, m] of Object.entries(DIST)) {
    test(`${ime}: dve nedelje pauze — povratak je u trenerskom pojasu`, () => {
      const { a, povratak, preKm } = saPauzom(m, 14);
      a.evalIn(`TODAY='${povratak}';`);
      const p = a.call('injuryProposal', povratak);
      assert.ok(p, 'dve nedelje bez trčanja ne pokreću ništa — plan vraća pun obim istog dana');
      assert.equal(p.level, 'pauza');
      assert.equal(a.call('returnToRunPhase', povratak), null, 'ovo nije povreda — lestvica bola se ne sme uključiti');

      /* MERA JE UDEO PREDPAUZNOG OBIMA, NE ACWR.
         Ranije je ovde stajalo „ACWR prve nedelje < 1.5". Taj broj je posle
         pauze strukturno naduvan: imenilac je prosek poslednje četiri završene
         nedelje, a dve od njih su nule — pa bi ga i savršeno doziran povratak
         probio. Terati ga ispod 1.3 značilo bi spustiti trkača na ~16 km, što
         je pre-kočenje, ne oprez.

         Trenerska smernica posle dve nedelje pauze je povratak na oko 60–70%
         predpauznog obima, pa rast. Taj broj se meri i on je ono što je bitno.
         Ovaj oblik tvrdnje hvata OBE greške koje su se ovde stvarno desile:
           — pun obim istog dana (100%, prvobitni nalaz), i
           — pre-kočenje na 35–46%, koje je pravio pokvaren imenilac
             `hronicniObim` (uračunavao tekuću, nezavršenu nedelju). */
      const red = odigraj(a, povratak, 3);
      const udeo = red[0].km / preKm;
      assert.ok(udeo <= 0.85,
        `prva nedelja povratka je ${Math.round(udeo * 100)}% predpauznog obima (${red[0].km} od ${Math.round(preKm)} km) — nije smanjena`);
      assert.ok(udeo >= 0.50,
        `prva nedelja povratka je samo ${Math.round(udeo * 100)}% predpauznog obima (${red[0].km} od ${Math.round(preKm)} km) — pre-kočenje`);
    });
  }

  test('predlog smanjuje i DUGO trčanje, ne samo zbir', () => {
    /* Skok dugog trčanja je bio +125 do +149% u jednoj nedelji — najkraći put
       nazad u povredu. Zbir može da ostane pristojan a dugo trčanje puno. */
    const { a, povratak } = saPauzom(42195, 14);
    a.evalIn(`TODAY='${povratak}';`);
    const p = a.call('injuryProposal', povratak);
    const punoDugo = Math.max(...daniPlana(a).filter(d => d.date >= povratak && d.date < dodaj(povratak, 7)).map(d => d.km));
    const predlozenoDugo = Math.max(...p.changes.map(c => c.km));
    assert.ok(predlozenoDugo < punoDugo * 0.8,
      `dugo trčanje ostaje na ${predlozenoDugo} km od punih ${punoDugo} km`);
  });

  test('povratak ne ide NANIŽE — nikad ispod već odrađene nedelje', () => {
    /* Bez poda se dobija spirala: predlog se računa od proseka poslednje četiri
       nedelje, a svaki rez taj prosek dodatno spušta. Izmereno pre poda:
       22.6 → 12.9 → 12.6 km, dakle čovek koji se vratio biva spušten niže
       nego prve nedelje povratka. */
    const { a, povratak } = saPauzom(42195, 14);
    const red = odigraj(a, povratak, 5);
    /* Tolerancija od 15% je tu jer predlog gleda „narednih sedam dana", a to se
       ne poklapa sa kalendarskom nedeljom — u deload nedelji plan i sam padne.
       Urušavanje koje se meri je drugog reda: bez poda je izmereno
       21.3 → 12.9 (−39%). */
    for (let i = 1; i < red.length; i++) {
      assert.ok(red[i].km >= red[i - 1].km * 0.85,
        `obim se urušava u povratku: ${JSON.stringify(red.map(r => r.km))}`);
    }
    assert.ok(red[red.length - 1].km > red[0].km,
      `povratak ne raste: ${JSON.stringify(red.map(r => r.km))}`);
  });

  test('kratak prekid od nekoliko dana ne pokreće ništa', () => {
    const { a, povratak } = saPauzom(10000, 4);
    a.evalIn(`TODAY='${povratak}';`);
    assert.equal(a.call('injuryProposal', povratak), null,
      'četiri propuštena dana se tretiraju kao prekid pripreme');
  });
});

/* ============================================================
   3. KARTICA OPTEREĆENJA GLEDA I UNAPRED
   ============================================================ */
describe('Upozorenje o opterećenju stiže pre nedelje, ne posle nje', () => {
  test('u ponedeljak povratka kartica već zna šta plan traži', () => {
    /* Pre popravke: `akutniObim` gleda unazad, pa u ponedeljak ujutru pokazuje
       nulu, a broj od 2.4 se pojavi tek u nedelju uveče — kad je nedelja već
       istrčana i kad nema šta da se promeni. */
    const a = saPlanom(42195);
    const PAUZA_OD = dodaj(POCETAK, 8 * 7), POVRATAK = dodaj(PAUZA_OD, 14);
    odradiDo(a, PAUZA_OD);
    a.evalIn(`S.knee=[]; TODAY='${POVRATAK}'; rebuildDateIndex();`);

    assert.equal(a.call('akutniObim', POVRATAK), 0, 'pogled unazad u ponedeljak ne vidi ništa — to je i poenta');
    const p = a.call('acwrPlan', POVRATAK);
    assert.ok(p.odnos > 1.5, `pogled unapred ne vidi opasnost: ${JSON.stringify(p)}`);

    const html = a.call('karticaOpterecenja');
    assert.match(html, /Plan narednih 7 dana/, 'kartica ćuti o nedelji koja tek dolazi');
    assert.match(html, /preko 1,5 pre nego što je nedelja počela/);
  });

  test('poslušnom trkaču u ravnomernoj nedelji nema šta da se doda', () => {
    const a = saPlanom(10000);
    const dani = daniPlana(a);
    const log = {};
    for (const d of dani) if (!d.rest && d.km) log[d.id] = { status: 'done', km: d.km, runDate: d.date };
    a.evalIn(`S.log=${JSON.stringify(log)}; S.knee=[];`);
    /* Sredina pripreme, pun dnevnik: plan ne sme da bude „iznad pojasa". */
    const dan = dani[Math.floor(dani.length / 2)].date;
    a.evalIn(`TODAY='${dan}'; rebuildDateIndex();`);
    assert.ok(!/Plan narednih 7 dana/.test(a.call('karticaOpterecenja')),
      'upozorenje se pali i kad plan ide normalno — postalo bi šum');
  });

  test('trka se ne broji u pogled unapred', () => {
    /* 42 km trke nije trenažno opterećenje koje se poredi sa nedeljnim
       prosekom — inače bi trkačka nedelja uvek gorela crveno. */
    const a = saPlanom(42195);
    const trkaDan = a.evalIn("(function(){for(var i=DATED.length-1;i>=0;i--) if(DATED[i].tag==='trka') return DATED[i].date; return null;})()");
    assert.ok(trkaDan, 'plan nema dan trke');
    const pon = dodaj(trkaDan, -6);
    odradiDo(a, pon);
    a.evalIn(`S.knee=[]; TODAY='${pon}'; rebuildDateIndex();`);
    const saTrkom = a.evalIn(`(function(){var k=0;CUR_PLAN.forEach(function(w){w.days.forEach(function(d){if(!d.rest&&d.date>='${pon}'&&d.date<='${trkaDan}')k+=d.km||0;});});return Math.round(k*10)/10;})()`);
    assert.ok(a.call('planiraniObim7', pon) < saTrkom, 'trka je ušla u pogled unapred');
  });
});

/* ============================================================
   4. NAJVAŽNIJA PROVERA — POSLUŠAN TRKAČ NE VIDI NIŠTA

   Prva verzija popravke okidala je čim sledećih sedam dana pređu 1.3 ×
   hronično. Merenjem nad 72 kombinacije: to okida i kod trkača koji nije
   propustio NIJEDAN trening, jer rani porast početničkih planova ide do
   1.49 × hronično sasvim legitimno. Čoveku koji radi tačno ono što plan traži
   ne sme da se ponudi da uspori — to je isti promašaj zbog kog je i pisana
   ova revizija.
   ============================================================ */
describe('Trkač koji ne propušta ništa ne dobija nijedan predlog', () => {
  for (const [ime, m] of Object.entries(DIST)) {
    for (const [profil, over] of Object.entries({
      'početnik 20 km · 3 dana': { weeklyKm: 20, runDays: 3, trainedRecently: false },
      'iskusan 70 km · 6 dana': { weeklyKm: 70, runDays: 6, trainedRecently: true }
    })) {
      test(`${ime} · ${profil}`, () => {
        const a = saPlanom(m, over);
        const dani = daniPlana(a);
        const log = {};
        for (const d of dani) if (!d.rest && d.km) log[d.id] = { status: 'done', km: d.km, runDate: d.date };
        a.evalIn(`S.log=${JSON.stringify(log)}; S.knee=[]; rebuildDateIndex();`);
        for (const d of dani) {
          a.evalIn(`TODAY='${d.date}';`);
          const p = a.call('injuryProposal', d.date);
          assert.equal(p, null,
            `${d.date}: poslušan trkač dobija predlog „${p && p.title}" — ${p && p.message}`);
        }
      });
    }
  }
});
