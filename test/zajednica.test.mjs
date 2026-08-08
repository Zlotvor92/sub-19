/* ZAJEDNICA — ŠTA IZLAZI IZ NALOGA

   Do Zajednice ništa u ovoj aplikaciji nije bilo vidljivo drugim ljudima.
   Zato ovde ne testiramo „da li lista lepo izgleda" nego jednu jedinu stvar:

     IZLAZI LI IŠTA OSIM ONOGA ŠTO SMO OBEĆALI, I IZLAZI LI IKOME KO TO NIJE
     SAM UKLJUČIO.

   Zamka koja to čuva je test „ne izlazi ništa osim dozvoljenog": u stanje se
   UBACE svi osetljivi podaci koje aplikacija zna — HRV, puls u miru, san,
   težina, bolovi, beleške sa treninga, e-adresa — pa se tvrdi da se izlazni
   objekat NIJE PROMENIO. Zato pada i onda kad neko doda polje ne razmišljajući
   o tome šta ono povlači.

   Provereno da može da padne: kad se `zajednicaPayload` napiše preko
   `Object.assign({}, S)` — što je najverovatniji način da se ovo pokvari —
   test pada na prvom polju. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readRepoFile } from './harness.mjs';

const DANAS = '2026-08-05T09:00:00Z';

/* Prijavljen korisnik sa Google slikom i imenom. Bez ovoga `zajednicaPayload`
   nema ni `user_id`, pa bi svaka tvrdnja merila prazan objekat. */
function prijavljen(a) {
  a.evalIn(`SB.userId='u-1'; SB.access='tok'; SB.refresh='ref'; SB.email='ja@primer.com';
            /* Token MORA da važi. Sa expiresAt=0 sbEnsure() odbija svaki poziv
               pre nego što se išta testira — a onda „server je odbio" i „nema
               tokena" izgledaju isto, pa zamka ne može da padne. */
            SB.expiresAt=Date.now()+3600000;
            SB.slika='https://lh3.googleusercontent.com/a/slika';
            SB.ime='Marko Marković';`);
}

/* Stanje sa svim osetljivim podacima koje aplikacija ume da zabeleži. */
function osetljivo(a) {
  a.evalIn(`
    S.wellness={'2026-08-05':{hrv:78,rhr:44,sleep:7.5,load:210}};
    S.kg=[{date:'2026-08-04', kg:71.4}];
    S.knee=[{date:'2026-08-04', v:6, part:'ahilova'}];
    const _prvi=DATED.find(d=>!d.rest);
    if(_prvi){ S.log[_prvi.id]={status:'done', km:10, sec:3000,
      note:'kolena me ubijaju, ne valja mi san', hr:162, feel:2}; }
    S.ai={'2026-08-04':{tekst:'AI analiza: opterećenje previsoko'}};
  `);
}

const app = () => loadApp({ now: DANAS });

describe('Šta izlazi iz naloga', () => {

  const DOZVOLJENA = [
    'user_id', 'vidljiv', 'nadimak', 'avatar_url', 'cilj', 'trka_datum',
    'nedelja_br', 'nedelja_od', 'vdot', 'vdot_pocetni', 'test3k_sec',
    'km_nedelja', 'plan_pct', 'niz_dana', 'izazov_od', 'izazov_ura',
    'znacke', 'trcanja'
  ];

  test('izlazi TAČNO nabrojani skup polja, ni jedno više', () => {
    const a = app();
    prijavljen(a);
    const p = a.call('zajednicaPayload');
    assert.deepEqual(Object.keys(p).sort(), DOZVOLJENA.slice().sort());
  });

  test('osetljivi podaci ne menjaju ono što izlazi', () => {
    /* Srž cele stvari. Ista funkcija, dva stanja: jedno prazno, drugo puno
       zdravstvenih podataka i beleški. Rezultat mora biti IDENTIČAN svuda osim
       tamo gde je razlika legitimna (jedno odrađeno trčanje se vidi kao
       trčanje — bez beleške, bez pulsa, bez osećaja). */
    const bez = app();
    prijavljen(bez);
    const pBez = bez.call('zajednicaPayload');

    const sa = app();
    prijavljen(sa);
    osetljivo(sa);
    const pSa = sa.call('zajednicaPayload');

    const tekst = JSON.stringify(pSa);
    for (const tajna of ['kolena me ubijaju', 'ja@primer.com', 'AI analiza',
                         '78', '44', '71.4', '162']) {
      assert.ok(!tekst.includes(tajna),
        `iz naloga je izašlo „${tajna}" — payload: ${tekst}`);
    }
    /* Polja koja osetljivi podaci NE SMEJU da dodaju. */
    assert.deepEqual(Object.keys(pSa).sort(), Object.keys(pBez).sort());
  });

  test('trčanje nosi datum, tip, dužinu i tempo — i ništa drugo', () => {
    const a = app();
    prijavljen(a);
    osetljivo(a);
    const t = a.call('zajednicaPayload').trcanja;
    assert.ok(t.length >= 1, 'odrađeno trčanje se ne vidi uopšte');
    assert.deepEqual(Object.keys(t[0]).sort(), ['d', 'o', 'p', 't']);
    assert.equal(t[0].p, '5:00 /km', 'tempo se ne računa iz km i vremena');
  });

  test('najviše osam trčanja — baza odbija deveto', () => {
    const a = app();
    prijavljen(a);
    a.evalIn(`for(const d of DATED){ if(!d.rest&&d.date<=TODAY) S.log[d.id]={status:'done',km:8,sec:2400}; }`);
    const t = a.call('zajednicaPayload').trcanja;
    assert.ok(t.length <= 8, `poslato ${t.length} trčanja, baza prima najviše 8`);
    assert.equal(t.length, 8, 'osam odrađenih trčanja postoji, a ne izlaze sva');
  });
});

describe('Vidljivost je odluka, ne podrazumevano stanje', () => {

  test('nov korisnik nije vidljiv', () => {
    const a = app();
    assert.equal(a.evalIn('S.zajed.vidljiv'), false);
  });

  test('nadogradnja sa starije šeme ne uključuje nikoga', () => {
    /* Najgori mogući ishod ove funkcije: čovek ažurira aplikaciju i zatekne se
       na javnom spisku. Migracija zato NE SME da nasledi ništa osim `false`. */
    const a = app();
    const bez = a.evalIn(`JSON.stringify(migrate({v:9, log:{}}))`);
    assert.equal(JSON.parse(bez).zajed.vidljiv, false,
      'stanje bez Zajednice je posle migracije vidljivo');
    /* Šema v9 Zajednicu nije imala, pa `zajed` u takvom zapisu ne može biti
       čovekova odluka — može biti samo podmetnut ili pokvaren backup. Spušta
       se na false bez pitanja. */
    const podmetnuto = a.evalIn(`JSON.stringify(migrate({v:9, log:{}, zajed:{vidljiv:true}}))`);
    assert.equal(JSON.parse(podmetnuto).zajed.vidljiv, false,
      'zapis iz šeme koja Zajednicu nije imala je uključio Zajednicu');
    /* Iz šeme koja je JESTE imala, sopstvena odluka se poštuje. */
    const svoje = a.evalIn(`JSON.stringify(migrate({v:10, log:{}, zajed:{vidljiv:true}}))`);
    assert.equal(JSON.parse(svoje).zajed.vidljiv, true,
      'sopstveni izbor iz backupa je izgubljen');
  });

  test('samo doslovno `true` uključuje — ne „da", ne 1', () => {
    /* Uvezen backup je proizvoljan JSON. `if(o.zajed.vidljiv)` bi na "ne"
       bilo tačno, jer je neprazan string istinit. */
    const a = app();
    for (const lazno of ['"da"', '"ne"', '1', '{}', '[]']) {
      const o = JSON.parse(a.evalIn(`JSON.stringify(migrate({v:10, log:{}, zajed:{vidljiv:${lazno}}}))`));
      assert.equal(o.zajed.vidljiv, false, `vrednost ${lazno} je uključila Zajednicu`);
    }
  });

  test('dok je isključena, ništa se ne šalje', () => {
    const a = app();
    prijavljen(a);
    a.setFetch(async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' }));
    return a.call('zajUpisi').then(ok => {
      assert.equal(ok, false, 'upis je prošao iako Zajednica nije uključena');
      assert.equal(a.calls.fetches.length, 0, 'poslat je zahtev iako Zajednica nije uključena');
    });
  });

  test('isključivanje BRIŠE red, ne postavlja vidljiv=false', () => {
    /* Red sa vidljiv=false i dalje nosi nadimak, sliku, brojeve i trčanja u
       tuđoj bazi. Politika privatnosti obećava brisanje. */
    const a = app();
    prijavljen(a);
    a.evalIn('S.zajed.vidljiv=true');
    a.setFetch(async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' }));
    return a.call('zajPostavi', false).then(ok => {
      assert.equal(ok, true);
      const [url, opt] = a.calls.fetches[0];
      assert.equal(opt.method, 'DELETE', `metod je ${opt.method}, a mora biti DELETE`);
      assert.ok(String(url).includes('user_id=eq.u-1'), 'briše se nešto što nije moj red');
    });
  });

  test('kad server odbije, prekidač se VRAĆA na staro', () => {
    /* Inače aplikacija tvrdi da si vidljiv a u bazi te nema — ili obrnuto,
       što je gore: misliš da si se sklonio, a red stoji. */
    const a = app();
    prijavljen(a);
    a.setFetch(async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => '' }));
    return a.call('zajPostavi', true).then(ok => {
      assert.equal(ok, false);
      assert.equal(a.evalIn('S.zajed.vidljiv'), false,
        'aplikacija tvrdi da si vidljiv iako upis nije prošao');
    });
  });
});

describe('Brojevi koje baza prima', () => {

  test('vrednost van opsega postaje null, umesto da obori ceo upis', () => {
    /* `check` ograničenje u bazi odbija CEO red, ne jedno polje. Bez ovoga bi
       jedan besmislen VDOT značio da se profil uopšte ne pojavljuje — a
       prekidač bi izgledao kao da radi. */
    const a = app();
    prijavljen(a);
    a.evalIn(`S.vdotLog=[{id:'x', ts:'2026-07-01', vdot:999}]`);
    assert.equal(a.call('zajednicaPayload').vdot, null);
  });

  test('opsezi su isti kao `check` ograničenja u supabase/zajednica.sql', () => {
    /* Dva mesta, jedno pravilo. Kad se raziđu, aplikacija šalje vrednost koju
       baza odbija — i to se vidi tek kao „profil se ne pojavljuje". */
    const a = app();
    const uKodu = a.get('ZAJ_OPSEG');
    const sql = readRepoFile('supabase/zajednica.sql');
    const re = /check \((\w+) is null or \1 between (\d+(?:\.\d+)?) and (\d+(?:\.\d+)?)\)/g;
    const uSemi = {};
    let m;
    while ((m = re.exec(sql))) uSemi[m[1]] = [Number(m[2]), Number(m[3])];
    assert.ok(Object.keys(uSemi).length >= 6,
      `nisam našao ograničenja u zajednica.sql — regex je zastareo (${Object.keys(uSemi)})`);
    for (const [k, v] of Object.entries(uSemi)) {
      assert.ok(uKodu[k], `SQL ograničava ${k}, a ZAJ_OPSEG ga nema`);
      /* Nizovi iz vm konteksta nose drugi prototip, pa ih strict deepEqual
         odbija i kad su vrednosti iste. Poredi se sadržaj. */
      assert.deepEqual([uKodu[k][0], uKodu[k][1]], v, `opseg za ${k} se razišao`);
    }
  });

  test('odrađenih u izazovu nikad nije više od planiranih', () => {
    /* Baza to odbija (`izazov_ura <= izazov_od`), pa bi „7 od 5" oborilo upis. */
    const a = app();
    prijavljen(a);
    a.evalIn(`for(const d of DATED) S.log[d.id]={status:'done',km:8,sec:2400};`);
    const p = a.call('zajednicaPayload');
    if (p.izazov_od != null && p.izazov_ura != null) {
      assert.ok(p.izazov_ura <= p.izazov_od, `${p.izazov_ura} od ${p.izazov_od}`);
    }
  });

  test('slika mora biti https — sve ostalo se odbacuje', () => {
    /* Vrednost ide pravo u `img src`. CSP je sužen na jedan host, ali token ne
       mora doći od Googlea. */
    const a = app();
    prijavljen(a);
    for (const zlo of ['javascript:alert(1)', 'data:image/png;base64,AA', 'http://x.rs/a.png']) {
      a.evalIn(`SB.slika=${JSON.stringify(zlo)}`);
      assert.equal(a.call('zajednicaPayload').avatar_url, null, `prošlo je: ${zlo}`);
    }
  });

  test('prikazuje se samo PRVO ime sa Google naloga', () => {
    /* Puno ime i prezime na javnom spisku je više nego što je čovek tražio. */
    const a = app();
    prijavljen(a);
    assert.equal(a.call('zajednicaPayload').nadimak, 'Marko');
    a.evalIn(`S.zajed.nadimak='Trkač 021'`);
    assert.equal(a.call('zajednicaPayload').nadimak, 'Trkač 021', 'nadimak nema prednost');
  });
});

describe('Politika privatnosti prati kod', () => {

  test('svako polje koje izlazi je pomenuto u privacy.html', () => {
    /* Politika je jedino mesto gde čovek može da pročita šta deli. Kad kod
       doda polje a politika ne, obećanje postaje netačno — a to niko ne vidi. */
    const p = readRepoFile('privacy.html');
    const parovi = [
      ['nadimak', /nadimak/i], ['avatar_url', /slik/i], ['cilj', /ciljn/i],
      ['trka_datum', /datum trke/i], ['nedelja_br', /nedelja plana/i],
      ['vdot', /VDOT/], ['test3k_sec', /3 km/], ['km_nedelja', /kilometraž/i],
      ['plan_pct', /doslednost/i], ['niz_dana', /niz dana/i],
      ['izazov_ura', /izazov/i], ['znacke', /znač/i], ['trcanja', /trčanja/i]
    ];
    for (const [polje, re] of parovi) {
      assert.match(p, re, `politika ne pominje ono što se šalje kao ${polje}`);
    }
  });

  test('politika izričito nabraja šta NIKAD ne izlazi', () => {
    const p = readRepoFile('privacy.html');
    for (const re of [/HRV/, /puls u miru/i, /san\b/i, /težin/i, /mapa bolova/i,
                      /beleške sa treninga/i, /AI analiz/i, /e-adres/i]) {
      assert.match(p, re, `politika ne kaže da ${re} ostaje u nalogu`);
    }
  });
});

/* ============================================================
   EKRAN

   Podaci na ovom ekranu dolaze OD DRUGIH LJUDI. To je jedino mesto u
   aplikaciji gde je tako, pa se ovde testira i ono što se inače ne bi:
   da tuđ nadimak ne može da postane HTML.
   ============================================================ */

/* Spisak kakav stiže sa servera. Namerno neuredan: neko bez testa, neko bez
   početnog VDOT-a — takvi redovi postoje čim neko uključi profil prvog dana. */
function spisak(a, dodatno = []) {
  const ljudi = [
    { user_id:'u-1', nadimak:'Ana',  cilj:'10K', vdot:47.1, vdot_pocetni:44.0, test3k_sec:724,
      km_nedelja:31.0, plan_pct:89, niz_dana:5, izazov_od:5, izazov_ura:4,
      nedelja_br:4, nedelja_od:12, trka_datum:'2026-10-12', znacke:['Test na 3 km'],
      trcanja:[{d:'2026-08-06',t:'Tempo',o:'12 km',p:'4:41 /km'}] },
    { user_id:'u-2', nadimak:'Boban', cilj:'5K', vdot:51.3, vdot_pocetni:48.1, test3k_sec:678,
      km_nedelja:42.1, plan_pct:98, niz_dana:12, izazov_od:5, izazov_ura:5,
      nedelja_br:8, nedelja_od:14, trka_datum:'2026-09-24', znacke:[], trcanja:[] },
    { user_id:'u-3', nadimak:'Cana', cilj:'5K', vdot:41.2, vdot_pocetni:36.8, test3k_sec:null,
      km_nedelja:22.5, plan_pct:76, niz_dana:3, izazov_od:4, izazov_ura:3,
      nedelja_br:2, nedelja_od:10, trka_datum:'2026-11-02', znacke:[], trcanja:[] }
  ].concat(dodatno);
  a.evalIn(`S.zajed.vidljiv=true; ZAJ.ljudi=${JSON.stringify(ljudi)}; ZAJ.kad=Date.now();
            ZAJ.izazov='Odradi sve treninge po planu ove nedelje.';`);
  return ljudi;
}
const ekran = a => a.evalIn(`$('#pg-zajed').innerHTML`) || '';

describe('Ekran Zajednice', () => {

  test('svako dugme u navigaciji ima svoju stranu, i obrnuto', () => {
    /* Dugme koje pokazuje na nepostojeću stranu obara `PAGES[p]()` — beo
       ekran, bez poruke. Strana bez dugmeta je nedostupna. */
    const a = app();
    const html = readRepoFile('index.html');
    const nav = [...html.matchAll(/<button data-pg="([a-z]+)"/g)].map(m => m[1]);
    const strane = Object.keys(a.get('PAGES'));
    assert.deepEqual(nav.slice().sort(), strane.slice().sort());
    for (const s of strane) {
      assert.ok(html.includes(`id="pg-${s}"`), `nema <section id="pg-${s}">`);
    }
  });

  test('dok je isključena, ne povlači se ništa i ne vidi se niko', () => {
    const a = app();
    prijavljen(a);
    a.setFetch(async () => ({ ok: true, status: 200, json: async () => ([]), text: async () => '' }));
    a.call('renderZajednica');
    assert.equal(a.calls.fetches.length, 0, 'povučen je spisak iako je Zajednica isključena');
    assert.match(ekran(a), /isključena/);
  });

  test('tuđ nadimak ne može da postane HTML', () => {
    /* Jedino mesto u aplikaciji gde tekst dolazi od drugog čoveka. CSP bi
       izvršavanje i onako odbio, ali nadimak ne sme ni da razbije raspored. */
    const a = app();
    prijavljen(a);
    spisak(a, [{ user_id:'u-x', nadimak:'<img src=x onerror=alert(1)>', cilj:'5K',
      vdot:40, vdot_pocetni:40, test3k_sec:900, km_nedelja:10, plan_pct:50, niz_dana:1,
      izazov_od:3, izazov_ura:1, nedelja_br:1, nedelja_od:8, trka_datum:'2026-12-01',
      znacke:['<b>zla</b>'], trcanja:[{d:'2026-08-06',t:'<script>',o:'x',p:'y'}] }]);
    a.call('renderZajednica');
    const h = ekran(a);
    assert.ok(!h.includes('<img src=x'), 'nadimak je ušao u HTML kao oznaka');
    assert.ok(h.includes('&lt;img src=x'), 'nadimak nije prošao kroz esc()');
    a.evalIn(`ZAJ.otvoren='u-x'`);
    a.call('renderZajednica');
    const p = ekran(a);
    assert.ok(!p.includes('<b>zla</b>'), 'značka je ušla u HTML kao oznaka');
    assert.ok(!/<script>/.test(p.replace(/&lt;script&gt;/g, '')), 'tip treninga je ušao kao oznaka');
  });

  test('rangiranje po testu: najbrži prvi, a onaj bez testa poslednji', () => {
    const a = app();
    prijavljen(a);
    spisak(a);
    a.call('renderZajednica');
    const red = [...ekran(a).matchAll(/class="zime">([^<]*)/g)].map(m => m[1].trim());
    assert.equal(red[0], 'Boban', `prvi je ${red[0]}, a najbrži je Boban (11:18)`);
    /* Cana nema test — ne sme da ispadne sa spiska, ali ni da bude ispred. */
    assert.ok(red.indexOf('Cana') > red.indexOf('Ana'), 'onaj bez testa je iznad onoga sa testom');
  });

  test('rangiranje po napretku okreće poredak — početnik vodi', () => {
    /* Poenta merila. Cana je najsporija (nema ni test), ali je od početka
       plana napredovala najviše: 41,2 − 36,8 = +4,4. */
    const a = app();
    prijavljen(a);
    spisak(a);
    a.evalIn(`ZAJ.merilo='nap'`);
    a.call('renderZajednica');
    const red = [...ekran(a).matchAll(/class="zime">([^<]*)/g)].map(m => m[1].trim());
    assert.equal(red[0], 'Cana', `po napretku je prvi ${red[0]}, a mora Cana (+4,4)`);
  });

  test('napredak se prikazuje sa PLUSOM', () => {
    /* U maketi je ovo bilo pokvareno: razlika se poredila kao već formatiran
       string („4,4" > 0 je uvek false), pa se plus nikad nije pojavio. */
    const a = app();
    prijavljen(a);
    spisak(a);
    a.evalIn(`ZAJ.merilo='nap'`);
    a.call('renderZajednica');
    assert.match(ekran(a), /\+4,4 VDOT/, 'plus ispred napretka se ne prikazuje');
  });

  test('rangiranje po doslednosti ne gleda brzinu', () => {
    const a = app();
    prijavljen(a);
    spisak(a);
    a.evalIn(`ZAJ.merilo='dosl'`);
    a.call('renderZajednica');
    const red = [...ekran(a).matchAll(/class="zime">([^<]*)/g)].map(m => m[1].trim());
    assert.equal(red[0], 'Boban');
    assert.equal(red[red.indexOf('Boban') + 1], 'Ana');
  });

  test('filter po cilju sklanja ostale', () => {
    const a = app();
    prijavljen(a);
    spisak(a);
    a.evalIn(`ZAJ.filter='10K'`);
    a.call('renderZajednica');
    const h = ekran(a);
    assert.ok(h.includes('Ana'), 'jedini 10K trkač je nestao');
    assert.ok(!h.includes('Boban'), '5K trkač se vidi pod filterom 10K');
  });

  test('izazov se rangira po UDELU, ne po broju odrađenih', () => {
    /* Cana je odradila 3 od 4 (75 %), Ana 4 od 5 (80 %). Da se rangira po
       broju, Ana bi bila ispred iako je Cana bliža svom cilju — a nije: Ana
       jeste ispred po udelu. Obrnut primer: 3/3 mora biti ispred 4/6. */
    const a = app();
    prijavljen(a);
    spisak(a, [{ user_id:'u-9', nadimak:'Djordje', cilj:'5K', vdot:45, vdot_pocetni:45,
      test3k_sec:800, km_nedelja:20, plan_pct:60, niz_dana:1,
      izazov_od:3, izazov_ura:3, nedelja_br:1, nedelja_od:8, trka_datum:'2026-12-01',
      znacke:[], trcanja:[] }]);
    a.call('renderZajednica');
    const h = ekran(a);
    const izazov = h.slice(h.indexOf('Izazov nedelje'), h.indexOf('zfilteri'));
    const red = [...izazov.matchAll(/class="zime" style="font-size:.86rem">([^<]*)/g)].map(m => m[1].trim());
    assert.equal(red[0], 'Boban', 'na vrhu izazova nije neko ko je završio');
    assert.ok(red.indexOf('Djordje') < red.indexOf('Ana'),
      `3/3 (100 %) je iza 4/5 (80 %) — rangira se po broju umesto po udelu: ${red}`);
  });

  test('profil pokazuje trčanja, a duel samo za tuđi profil', () => {
    const a = app();
    prijavljen(a);
    a.evalIn(`SB.userId='u-2'`);
    spisak(a);
    a.evalIn(`ZAJ.otvoren='u-1'`);
    a.call('renderZajednica');
    const tudj = ekran(a);
    assert.match(tudj, /4:41 \/km/, 'tuđe trčanje se ne prikazuje');
    assert.match(tudj, /Duel/, 'nema duela na tuđem profilu');
    a.evalIn(`ZAJ.otvoren='u-2'`);
    a.call('renderZajednica');
    assert.ok(!ekran(a).includes('Duel'), 'duel sa samim sobom');
  });

  test('avatar pada na inicijale kad slike nema, i odbija ne-https', () => {
    /* `onerror` ne postoji — CSP zabranjuje inline rukovaoce. Zato inicijali
       stoje ISPOD slike, pa se vide i kad slika ne stigne. */
    const a = app();
    prijavljen(a);
    spisak(a, [{ user_id:'u-8', nadimak:'Zoran Zoric', cilj:'5K', avatar_url:'javascript:alert(1)',
      vdot:45, vdot_pocetni:44, test3k_sec:800, km_nedelja:20, plan_pct:60, niz_dana:1,
      izazov_od:3, izazov_ura:1, nedelja_br:1, nedelja_od:8, trka_datum:'2026-12-01',
      znacke:[], trcanja:[] }]);
    a.call('renderZajednica');
    const h = ekran(a);
    assert.ok(!h.includes('javascript:'), 'ne-https adresa je dospela u img src');
    assert.match(h, /<b>ZZ<\/b>/, 'nema inicijala kao rezerve');
  });

  test('prazan spisak kaže šta dalje, ne ostavlja prazno', () => {
    const a = app();
    prijavljen(a);
    a.evalIn(`S.zajed.vidljiv=true; ZAJ.ljudi=[]; ZAJ.kad=Date.now();`);
    a.call('renderZajednica');
    assert.match(ekran(a), /Budi prvi/);
  });

  test('kad povlačenje padne, ostatak aplikacije se ne dovodi u pitanje', () => {
    const a = app();
    prijavljen(a);
    a.evalIn(`S.zajed.vidljiv=true; ZAJ.greska='mreza';`);
    a.call('renderZajednica');
    assert.match(ekran(a), /Nema veze sa internetom/);
    assert.match(ekran(a), /Sve ostalo u aplikaciji radi normalno/);
  });

  test('kad tabele nema u bazi, poruka to KAŽE — ne „pokušaj ponovo"', () => {
    /* Dok se supabase/zajednica.sql ne pusti rukom, PostgREST na tu tabelu
       vraća 404. Ponavljanje tada ne pomaže nikad, pa poruka mora da imenuje
       jedini korak koji pomaže. Prijavljeno sa snimka ekrana: prekidač je
       pisao „Pokušaj ponovo" i slao čoveka u krug. */
    const a = app();
    assert.equal(a.call('zajRazlogIz', 404), 'nema-tabele');
    assert.equal(a.call('zajRazlogIz', 401), 'nema-prava');
    assert.equal(a.call('zajRazlogIz', 500), 'server');
    for (const r of ['nema-tabele', 'nema-prava']) {
      assert.match(a.call('zajPoruka', r), /zajednica\.sql/,
        `poruka za „${r}" ne kaže šta da se uradi`);
    }
    assert.doesNotMatch(a.call('zajPoruka', 'nema-tabele'), /Pokušaj ponovo/);
  });

  test('404 sa servera stiže do prekidača kao razlog, ne kao ćutanje', async () => {
    const a = app();
    prijavljen(a);
    a.setFetch(async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' }));
    const ok = await a.call('zajPostavi', true);
    assert.equal(ok, false);
    assert.equal(a.evalIn('ZAJ.razlog'), 'nema-tabele');
    assert.equal(a.evalIn('S.zajed.vidljiv'), false, 'prekidač je ostao uključen bez reda u bazi');
  });

  test('avatar bez nadimka pokazuje slovo imena koje se prikazuje, ne „?"', () => {
    /* Prijavljeno sa ekrana: preko avatara je stajao znak pitanja. Red je
       pisao „Trkač", a krug je računao inicijale iz PRAZNOG nadimka — dva
       izraza za istu stvar, pa su se razišla. */
    const a = app();
    prijavljen(a);
    spisak(a, [{ user_id:'u-bez', nadimak:null, cilj:'5K', vdot:45, vdot_pocetni:44,
      test3k_sec:800, km_nedelja:20, plan_pct:60, niz_dana:1, izazov_od:3, izazov_ura:1,
      nedelja_br:1, nedelja_od:8, trka_datum:'2026-12-01', znacke:[], trcanja:[] }]);
    a.call('renderZajednica');
    const h = ekran(a);
    assert.ok(!h.includes('<b>?</b>'), 'preko avatara i dalje stoji znak pitanja');
    assert.match(h, /<b>T<\/b>/, 'inicijal se ne računa iz prikazanog imena');
  });
});

/* ============================================================
   IDENTITET IZ TOKENA

   Ime i slika stižu u samom Supabase tokenu (`user_metadata`). Do sada su se
   čitali SAMO pri prijavi — pa je svako ko je bio prijavljen pre te verzije
   ostajao bez slike doveka, bez ijedne greške koja bi na to ukazala. Tačno to
   je i prijavljeno sa ekrana: znak pitanja preko avatara.
   ============================================================ */
describe('Ime i slika iz tokena', () => {

  /* Token kakav Supabase izdaje: tri dela, srednji je base64url JSON. Potpis
     se ne proverava na klijentu (ni u kodu ni ovde) — proverava ga server. */
  const token = (podaci) => {
    const telo = Buffer.from(JSON.stringify(podaci), 'utf8').toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return 'zaglavlje.' + telo + '.potpis';
  };
  const GOOGLE = token({ sub: 'u-1', email: 'ja@primer.com',
    user_metadata: { full_name: 'Marko Marković',
                     avatar_url: 'https://lh3.googleusercontent.com/a/slika' } });

  test('zatečena sesija dobija ime i sliku BEZ ponovne prijave', () => {
    /* Srž prijavljene greške. Sesija u localStorage-u je pročitana pre nego
       što je aplikacija umela da izvuče ta polja; osvežavanje tokena bi to
       sredilo tek kad token istekne. */
    const a = app();
    a.evalIn(`SB.userId='u-1'; SB.access=${JSON.stringify(GOOGLE)}; SB.slika=null; SB.ime=null;`);
    assert.equal(a.call('sbPreuzmiIdentitet'), true, 'ništa nije preuzeto');
    assert.equal(a.evalIn('SB.slika'), 'https://lh3.googleusercontent.com/a/slika');
    assert.equal(a.evalIn('SB.ime'), 'Marko Marković');
  });

  test('preuzimanje se poziva pri pokretanju — ne samo pri prijavi', () => {
    /* Da poziv nestane, zatečene sesije bi opet ostale bez slike, a svi
       testovi iznad bi i dalje prolazili. */
    const izvor = readRepoFile('app.js');
    assert.match(izvor, /if\(sbPreuzmiIdentitet\(\)\) sbSave\(\);/,
      'pri pokretanju se identitet više ne preuzima');
    assert.match(izvor, /SB\.expiresAt=Date\.now\(\)[\s\S]{0,400}?sbPreuzmiIdentitet\(\);/,
      'osvežavanje tokena više ne preuzima ime i sliku');
  });

  test('token bez Google podataka ne briše ono što već imamo', () => {
    /* Nije svaka prijava Google prijava. Prazno polje ne sme da pregazi
       vrednost koja radi. */
    const a = app();
    a.evalIn(`SB.userId='u-1'; SB.slika='https://lh3.googleusercontent.com/a/staro'; SB.ime='Marko';
              SB.access=${JSON.stringify(token({ sub: 'u-1', email: 'x@y.rs' }))};`);
    assert.equal(a.call('sbPreuzmiIdentitet'), false);
    assert.equal(a.evalIn('SB.slika'), 'https://lh3.googleusercontent.com/a/staro');
    assert.equal(a.evalIn('SB.ime'), 'Marko');
  });

  test('pokvaren token ne obara pokretanje', () => {
    const a = app();
    for (const zlo of ['', 'nije-token', 'a.b', 'a.!!!.c']) {
      a.evalIn(`SB.access=${JSON.stringify(zlo)}`);
      assert.doesNotThrow(() => a.call('sbPreuzmiIdentitet'), `pao na: ${zlo}`);
    }
  });

  test('slika koja nije https se odbija i u tokenu', () => {
    const a = app();
    a.evalIn(`SB.slika=null; SB.access=${JSON.stringify(token({ sub:'u-1',
      user_metadata:{ avatar_url:'http://x.rs/a.png' } }))};`);
    a.call('sbPreuzmiIdentitet');
    assert.equal(a.evalIn('SB.slika'), null);
  });

  test('avatar je POZADINA, ne <img> — inače iPhone crta upitnik preko', () => {
    /* Prijavljeno sa ekrana. Inicijali su bili ispod <img>-a, a Safari pri
       neuspeloj slici nacrta svoju ikonicu tačno preko njih. Pozadina koja se
       ne učita ne crta ništa. */
    const a = app();
    prijavljen(a);
    spisak(a, [{ user_id:'u-sl', nadimak:'Sanja', cilj:'5K',
      avatar_url:'https://lh6.googleusercontent.com/a/AC-slika=s96-c',
      vdot:45, vdot_pocetni:44, test3k_sec:800, km_nedelja:20, plan_pct:60, niz_dana:1,
      izazov_od:3, izazov_ura:1, nedelja_br:1, nedelja_od:8, trka_datum:'2026-12-01',
      znacke:[], trcanja:[] }]);
    a.call('renderZajednica');
    const h = ekran(a);
    assert.ok(!/<img/.test(h), 'avatar i dalje koristi <img>');
    assert.match(h, /background-image:url\(&quot;https:\/\/lh6\.googleusercontent\.com/,
      'slika se ne postavlja kao pozadina');
  });

  test('adresa slike ne može da izađe iz url(…)', () => {
    /* Vrednost završava u `style` atributu. Pregledač atribut PRVO dekodira
       kao HTML pa tek onda parsira kao CSS — zato esc() nije dovoljan:
       `&#39;` bi postao apostrof. Ti znakovi se odbijaju u celosti. */
    const a = app();
    for (const zlo of [
      'https://lh3.googleusercontent.com/a");background:url("http://zlo.rs/x',
      "https://lh3.googleusercontent.com/a');x:url('http://zlo.rs/x",
      'https://lh3.googleusercontent.com/a\\x',
      'https://lh3.googleusercontent.com/a x',
      'http://lh3.googleusercontent.com/a',
      'javascript:alert(1)', 'data:image/png;base64,AA', '//zlo.rs/x'
    ]) {
      assert.equal(a.call('zajSlikaUrl', zlo), null, `prošlo je: ${zlo}`);
    }
    assert.equal(a.call('zajSlikaUrl', 'https://lh3.googleusercontent.com/a/AC_x=s96-c'),
      'https://lh3.googleusercontent.com/a/AC_x=s96-c', 'ispravna adresa je odbijena');
  });

  test('inicijali stoje UVEK — slika je sloj preko njih', () => {
    /* Adresa slike može da postoji a slika da ne stigne (nema signala, Google
       je uklonio, CSP). Da su inicijali unapred sakriveni, ostao bi prazan
       obojen krug — što se i videlo na snimku. Providan sloj ne pokrije
       ništa, pa inicijali izađu sami. */
    const a = app();
    const sa = a.call('zajAvatar', { user_id:'x', nadimak:'Sanja Sanjić',
      avatar_url:'https://lh3.googleusercontent.com/a/x' }, 40);
    const bez = a.call('zajAvatar', { user_id:'x', nadimak:'Sanja Sanjić' }, 40);
    for (const h of [sa, bez]) assert.match(h, /<b>SS<\/b>/, 'inicijali nedostaju');
    assert.ok(!/opacity:0/.test(sa), 'inicijali se i dalje sakrivaju unapred');
    assert.match(sa, /<i style="background-image:url\(&quot;https:/, 'nema sloja sa slikom');
    assert.ok(!/<i /.test(bez), 'prazan sloj se crta i kad slike nema');
  });

  test('„PRVI" ne stoji kad merilo nema vrednost', () => {
    /* Sa ekrana: dvoje ljudi bez testa na 3 km, oba pišu „—", a prvom je ipak
       dodeljeno PRVI. Prvi po ničemu nije prvi. */
    const a = app();
    prijavljen(a);
    a.evalIn(`S.zajed.vidljiv=true; ZAJ.kad=Date.now(); ZAJ.ljudi=[
      {user_id:'u-1',nadimak:'Ana',cilj:'5K',test3k_sec:null,vdot:45,vdot_pocetni:44,
       km_nedelja:10,plan_pct:50,niz_dana:1,izazov_od:4,izazov_ura:2,nedelja_br:7,nedelja_od:14,
       trka_datum:'2026-09-24',znacke:[],trcanja:[]},
      {user_id:'u-2',nadimak:'Maša',cilj:'5K',test3k_sec:null,vdot:44,vdot_pocetni:44,
       km_nedelja:8,plan_pct:0,niz_dana:0,izazov_od:4,izazov_ura:0,nedelja_br:1,nedelja_od:19,
       trka_datum:'2026-12-13',znacke:[],trcanja:[]}];`);
    a.call('renderZajednica');
    assert.ok(!ekran(a).includes('PRVI'), 'PRVI stoji uz vrednost koje nema');
  });

  test('slika stiže i kad je token NEMA — iz /auth/v1/user', () => {
    /* Prijavljeno dvaput sa telefona. Token ne mora da nosi `user_metadata`;
       zavisi od verzije GoTrue-a i od toga šta je Google vratio, a to se sa
       strane aplikacije ne vidi. Poziv na /auth/v1/user je već postojao —
       samo se odgovor bacao. */
    const a = app();
    a.evalIn(`SB.userId='u-1'; SB.access='tok'; SB.refresh='r';
              SB.expiresAt=Date.now()+3600000; SB.slika=null; SB.ime=null;
              navigator.onLine=true;`);
    a.setFetch(async (url) => {
      if (String(url).includes('/auth/v1/user')) {
        return { ok: true, status: 200, text: async () => '',
          json: async () => ({ id: 'u-1', email: 'ja@primer.com',
            user_metadata: { full_name: 'Aleksandar Vuletić',
                             avatar_url: 'https://lh3.googleusercontent.com/a/prava=s96-c' } }) };
      }
      return { ok: true, status: 200, json: async () => ([]), text: async () => '' };
    });
    return a.call('sbProveriSesiju').then(() => {
      assert.equal(a.evalIn('SB.slika'), 'https://lh3.googleusercontent.com/a/prava=s96-c',
        'slika se i dalje čita samo iz tokena');
      assert.equal(a.evalIn('SB.ime'), 'Aleksandar Vuletić');
    });
  });

  test('čim se sazna slika, javni profil se osvežava', () => {
    /* Red u bazi je upisan pre nego što je slika bila poznata, pa nosi prazan
       avatar_url. Bez ovoga bi slika stigla tek uz sledeću izmenu plana. */
    const a = app();
    a.evalIn(`SB.userId='u-1'; SB.access='tok'; SB.refresh='r';
              SB.expiresAt=Date.now()+3600000; SB.slika=null; SB.ime=null;
              S.zajed.vidljiv=true; navigator.onLine=true;`);
    a.setFetch(async (url) => {
      if (String(url).includes('/auth/v1/user')) {
        return { ok: true, status: 200, text: async () => '',
          json: async () => ({ id: 'u-1',
            user_metadata: { avatar_url: 'https://lh3.googleusercontent.com/a/prava' } }) };
      }
      return { ok: true, status: 200, json: async () => ([]), text: async () => '' };
    });
    return a.call('sbProveriSesiju')
      .then(() => new Promise(r => setTimeout(r, 10)))
      .then(() => {
        const upis = a.calls.fetches.find(([u, o]) =>
          String(u).includes('zajednica_profil') && o && o.method === 'POST');
        assert.ok(upis, 'profil nije osvežen pošto je slika saznata');
        assert.equal(JSON.parse(upis[1].body).avatar_url,
          'https://lh3.googleusercontent.com/a/prava');
      });
  });

  test('odgovor bez metapodataka ne briše sliku koju već imamo', () => {
    const a = app();
    a.evalIn(`SB.userId='u-1'; SB.access='tok'; SB.slika='https://lh3.googleusercontent.com/a/staro';`);
    assert.equal(a.call('sbIzKorisnika', { id: 'u-1' }), false);
    assert.equal(a.evalIn('SB.slika'), 'https://lh3.googleusercontent.com/a/staro');
  });

  test('javni profil se osvežava pri SVAKOM pokretanju', () => {
    /* Upis je visio na „identitet se promenio". Ko je Zajednicu uključio pre
       nego što je aplikacija znala njegovu sliku, imao je prazan avatar_url
       doveka — promena se više nikad ne desi. Prijavljeno sa telefona dvaput. */
    const izvor = readRepoFile('app.js');
    assert.match(izvor, /if\(S\.zajed&&S\.zajed\.vidljiv\) zajUpisi\(\)\.catch\(\(\)=>\{\}\);\s*\n\s*sbHideGate\(\);/,
      'pri pokretanju se javni profil više ne osvežava bezuslovno');
  });

  test('Podešavanja pokazuju kako te vide — sa slikom i bez nje', () => {
    /* Bez ovoga se „da li aplikacija uopšte zna moju sliku" ne može videti
       nigde, pa se prazan krug u Zajednici ne razlikuje od blokirane slike. */
    const a = app();
    prijavljen(a);
    a.evalIn(`SB.slika=null; S.zajed.nadimak='Zlotvor92';`);
    a.call('openSettings');
    const bez = a.evalIn(`$('#sheet').innerHTML`) || '';
    assert.match(bez, /još nije stigla/, 'ne kaže se da slike nema');

    const b = app();
    prijavljen(b);
    b.evalIn(`SB.slika='https://lh3.googleusercontent.com/a/x'; S.zajed.nadimak='Zlotvor92';`);
    b.call('openSettings');
    const sa = b.evalIn(`$('#sheet').innerHTML`) || '';
    assert.match(sa, /ovako te vide ostali/);
    assert.match(sa, /background-image:url\(&quot;https:\/\/lh3/, 'pregled ne prikazuje sliku');
  });
});

/* ============================================================
   POSLEDICE IZMENE SERVICE WORKERA (v220)

   SW više ne presreće tuđe adrese. Time je nestao sloj koji je van mreže
   vraćao prazan 504 — sada `fetch` BACA. Svako mesto koje je računalo na
   odgovor sa `ok:false` mora da preživi i odbijeno obećanje.
   ============================================================ */
describe('Van mreže: pozivi ka Supabase-u ne smeju da bace', () => {

  /* Token koji VAŽI — inače sbEnsure odustane pre nego što se stigne do
     poziva, pa se ništa ne testira. */
  const bezMreze = () => {
    const a = loadApp({ now: DANAS });
    a.evalIn(`SB.userId='u-1'; SB.access='tok'; SB.refresh='r';
              SB.expiresAt=Date.now()+3600000; navigator.onLine=false;`);
    a.setFetch(async () => { throw new TypeError('Failed to fetch'); });
    return a;
  };

  test('sbRemoteAt vraća „nema signala", ne odbija', async () => {
    const a = bezMreze();
    assert.equal(await a.call('sbRemoteAt'), undefined);
  });

  test('sbPull vraća false, ne odbija', async () => {
    /* Stoji iza dugmeta „Uzmi sa servera", u rukovaocu bez sopstvenog catch-a
       — odbijeno obećanje bi ostalo neuhvaćeno. */
    const a = bezMreze();
    assert.equal(await a.call('sbPull'), false);
  });

  test('sbPush vraća false, ne odbija', async () => {
    const a = bezMreze();
    assert.equal(await a.call('sbPush'), false);
  });

  test('zajUcitaj prijavi grešku umesto da baci', async () => {
    const a = bezMreze();
    a.evalIn('S.zajed.vidljiv=true');
    await a.call('zajUcitaj');
    assert.equal(a.evalIn('ZAJ.greska'), 'mreza');
  });

  test('zajUpisi i zajObrisi vraćaju false, ne odbijaju', async () => {
    const a = bezMreze();
    a.evalIn('S.zajed.vidljiv=true');
    assert.equal(await a.call('zajUpisi'), false);
    assert.equal(await a.call('zajObrisi'), false);
  });
});
