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
