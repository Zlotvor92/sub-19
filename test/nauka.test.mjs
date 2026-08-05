/* NAUČNE INVARIJANTE GENERATORA — granice koje dolaze iz literature, ne iz
   kalibracije.

   Zašto zaseban fajl: generator.test.mjs čuva STRUKTURNE invarijante (dugo
   trčanje je najduže, deload spušta, dan trke pada na datum). Ovde se čuva ono
   što plan mora da poštuje da bi bio trenerski ISPRAVAN — Danielsovi budžeti
   zona, dubina tapera, opterećenje po ACWR-u, definicija M zone. Svaka tvrdnja
   ispod je pucala pre popravke i za svaku u komentaru stoji ŠTA je izmereno.

   Pragovi su namerno postavljeni sa rezervom iznad izmerenog maksimuma: cilj je
   da uhvate REGRESIJU (povratak na 15-16%), ne da pucaju na svaku promenu
   kalibracije od pola procenta. Tolerancija postoji jer su kvalitetne sesije
   diskretne (ne može 3.7 intervala) i jer izravnavanje rasta potkresuje nedelju
   POSLE nego što su sesije izračunate.

   „PODRŽANI OPSEG" = broj dana >= prof.minDanaPrep i obim koji ta distanca
   uopšte traži. Ispod toga generator SAM upozorava da plan nije adekvatan
   (v. testove upozorenja na kraju), pa se na njemu ne mere fiziološke granice —
   isto kao što se ne meri potrošnja auta koji vučeš na užetu. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const app = loadApp();
const gen = inp => app.call('generatePlan', inp);
const sessQKm = s => app.call('sessQKm', s);

/* Ponedeljak — da nijedan dan nedelje 1 ne bude odsečen datumom početka. */
const START = '2026-01-05';
const plusDays = (ds, n) => { const d = new Date(ds); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const raceIn = (weeks, dowOffset = 6) => plusDays(START, weeks * 7 + dowOffset - 6);

/* Čisto T-zona sesije. Rad na TEMPU TRKE (10K ritam, PM tempo trke, maratonski
   tempo) se NAMERNO ne broji ovde: to su specifične sesije sa sopstvenim
   budžetom, a ne pragovski rad. */
const STROGO_T = new Set(['Tempo', 'Tempo isprekidan', 'Progresivno']);
const weekKm = w => w.days.reduce((s, d) => s + (d.km || 0), 0);
const lrKm = w => Math.max(...w.days.filter(d => (d.tag === 'lr' && !d.mlr) || d.tag === 'rw').map(d => d.km || 0), 0);

const PROFILI = [
  { ime: '5K', distM: 5000, pb: 22 * 60, minD: 4, minKm: 25, taperF: 0.65 },
  { ime: '10K', distM: 10000, pb: 48 * 60, minD: 4, minKm: 30, taperF: 0.72 },
  { ime: 'HM', distM: 21097.5, pb: 100 * 60, minD: 4, minKm: 35, taperF: 0.75 },
  { ime: 'Maraton', distM: 42195, pb: 240 * 60, minD: 5, minKm: 40, taperF: 0.65 }
];

/* Mreža PODRŽANOG opsega. Početnici su namerno unutra: baš na prelazu iz bazne
   u kvalitetnu fazu su živele i greška budžeta praga i skok opterećenja, pa bi
   mreža bez njih propustila obe (provereno — bez `trainedRecently:false` oba
   testa prolaze i na neispravljenom kodu). */
function* podrzani(P) {
  for (const weeks of [12, 16, 20, 24])
    for (const weeklyKm of [P.minKm, P.minKm + 15, P.minKm + 30])
      for (const runDays of [P.minD, P.minD + 1, P.minD + 2].filter(d => d <= 7))
        for (const quality of [1, 2])
          for (const intensity of ['kons', 'std', 'agr'])
            for (const trainedRecently of [true, false]) {
              const p = gen({
                startDate: START, raceDate: raceIn(weeks), raceDistM: P.distM,
                pb: { distM: P.distM, sec: P.pb }, weeklyKm, runDays, quality,
                intensity, trainedRecently
              });
              if (p.error) continue;
              yield { p, opis: `${P.ime} ${weeks}ned ${weeklyKm}km ${runDays}d q${quality} ${intensity}${trainedRecently ? '' : ' početnik'}` };
            }
}

/* ŠIROKA mreža — uključuje i opseg koji generator sam označava kao neadekvatan
   (3 dana za maraton, 12 km/ned). Tamo se ne mere fiziološke granice, ali se
   mere GRUBI ispadi: plan sme da bude neadekvatan, ne sme da bude nakaradan. */
function* siroki(P) {
  for (const weeks of [12, 18, 24])
    for (const weeklyKm of [12, 30, 60])
      for (const runDays of [3, 4, 5, 6])
        for (const quality of [1, 2])
          for (const trainedRecently of [true, false]) {
            const p = gen({
              startDate: START, raceDate: plusDays(START, weeks * 7), raceDistM: P.distM,
              pb: { distM: P.distM, sec: P.pb }, weeklyKm, runDays, quality,
              intensity: 'std', trainedRecently
            });
            if (p.error) continue;
            yield { p, opis: `${P.ime} ${weeks}ned ${weeklyKm}km ${runDays}d q${quality}${trainedRecently ? '' : ' početnik'}` };
          }
}

describe('Daniels — fiziološki motor', () => {
  test('predviđanje trke se poklapa sa objavljenom VDOT tabelom (±0,5%)', () => {
    /* Daniels' Running Formula, tabela VDOT->vreme trke. Ovo je jedini test
       koji poredi sa SPOLJNIM izvorom — sve ostalo su interne invarijante. */
    const TABELA = {
      30: { 5000: 1840, 10000: 3826, 21097.5: 8464, 42195: 17357 },
      40: { 5000: 1448, 10000: 3003, 21097.5: 6659, 42195: 13785 },
      50: { 5000: 1197, 10000: 2481, 21097.5: 5495, 42195: 11449 },
      60: { 5000: 1023, 10000: 2122, 21097.5: 4689, 42195: 9805 }
    };
    for (const [vdot, red] of Object.entries(TABELA)) {
      for (const [distM, tabl] of Object.entries(red)) {
        const dobijeno = app.call('raceTimeForVdot', +vdot, +distM);
        const greska = Math.abs(dobijeno - tabl) / tabl;
        assert.ok(greska < 0.005,
          `VDOT ${vdot} na ${distM} m: tabela ${tabl} s, motor ${dobijeno} s (${(greska * 100).toFixed(2)}%)`);
      }
    }
  });

  test('M zona JESTE maratonski tempo trke (Danielsova definicija)', () => {
    /* PUCALO PRE POPRAVKE. Z.M=0.80 je M zonu aproksimirao procentom VO2max i
       grešio 3-6 s/km naniže (VDOT 50: 4:36 umesto 4:31, VDOT 60: 3:58 umesto
       3:52). Kod Danielsa M tempo NIJE procenat nego definicija — to je tempo
       maratonske trke za taj VDOT. Posledica greške bila je u proceni forme:
       maratonska sesija istrčana tačno na maratonskom tempu čitala se kao brža
       od M zone, pa je precenjivala VDOT — smer u kom plan sam sebe ubrzava. */
    for (let vdot = 30; vdot <= 70; vdot += 2) {
      const zona = app.call('paceForZone', vdot, 'M');
      const trka = app.call('raceTimeForVdot', vdot, 42195) / 42.195;
      assert.ok(Math.abs(zona - trka) <= 1,
        `VDOT ${vdot}: M zona ${zona} s/km vs maratonski tempo ${trka.toFixed(1)} s/km`);
    }
  });

  test('vdotFromPace je tačan inverz paceForZone na svim zonama (uklj. M)', () => {
    /* M zona se sada računa drugom putanjom (iz vremena trke), pa se mora
       proveriti da binarna pretraga i dalje pogađa — uslov je monotonost. */
    for (const zona of ['I', 'T', 'M', 'E', 'R']) {
      for (let vdot = 32; vdot <= 68; vdot += 4) {
        const tempo = app.call('paceForZone', vdot, zona);
        const nazad = app.call('paceForZone', app.call('vdotFromPace', tempo, zona), zona);
        assert.equal(nazad, tempo, `zona ${zona}, VDOT ${vdot}: ${tempo} -> ${nazad}`);
      }
    }
  });
});

describe('Danielsovi budžeti zona', () => {
  test('nedeljni prag ne prelazi 10% + tolerancija diskretnosti', () => {
    /* PUCALO PRE POPRAVKE. Kvalitetne sesije su se računale iz CILJNOG obima
       nedelje, a nedelja isporuči ono što stane u izabrani broj dana — pa je
       procenat na ISPORUČENOM obimu izlazio iznad Danielsovog budžeta.
       Mereno na 22.080 planova, udeo nedelja preko 10%:
         pre:   5K 11.6%   10K 14.7%   HM 15.9%   maraton 3.8%
         posle: 5K  0.7%   10K  0.0%   HM  1.3%   maraton 4.8%
       Maraton je jedini imao ispravku (`sesijeIzIsporucivog`) — sada je
       bezuslovna, pa ne može da se izgubi kad se doda nova distanca. */
    for (const P of PROFILI) {
      let preko = 0, ukupno = 0;
      for (const { p, opis } of podrzani(P)) {
        p.weeks.slice(0, -1).forEach(w => {
          const vol = weekKm(w);
          if (vol < 5) return;
          let T = 0;
          w.days.forEach(d => { if (d.session && STROGO_T.has(d.session.kind)) T += sessQKm(d.session); });
          if (T <= 0) return;
          ukupno++;
          if (T / vol > 0.11) preko++;
          /* Pojedinačni plafon: hvata ispad na jednoj nedelji. */
          assert.ok(T / vol <= 0.135,
            `${opis} N${w.w}: prag ${T.toFixed(1)} km od ${vol.toFixed(1)} km = ${(T / vol * 100).toFixed(1)}%`);
        });
      }
      /* UDEO je ono što stvarno razlikuje ispravan generator od pokvarenog:
         pojedinačni maksimum je i pre popravke bio blizu granice, ali je preko
         nje bila SVAKA DESETA nedelja. Mereno na ovoj istoj mreži —
           pre:   5K 10,7%   10K 11,4%   HM 16,8%   maraton 0,0%
           posle: 5K  3,3%   10K  1,1%   HM  1,6%   maraton 1,0%
         (maraton je jedini imao ispravku od ranije, pa se on i nije popravio —
         ostali su se sveli na njegov nivo). */
      assert.ok(preko / ukupno <= 0.05,
        `${P.ime}: ${(preko / ukupno * 100).toFixed(1)}% nedelja preko 11% praga (${preko}/${ukupno})`);
    }
  });

  test('dugo trčanje ne pojede nedelju', () => {
    /* JOSPT: preko ~30% nedelje u jednom trčanju raste rizik povrede. Niskoobimni
       izuzetak do 40-45% je NAMERNA trenerska odluka (v. lrCap* — trkač mora da
       bude sposoban da pretrči distancu), pa prag hvata stvarni ispad, ne dira
       dokumentovani izuzetak.
       Meri se na ŠIROKOJ mreži: plafon udela je i računat i grešio baš na niskom
       obimu i kod početnika, gde je razlika između ciljnog i isporučenog obima
       najveća. Mereno —
         pre:   5K 47%   10K 48%   HM 54%   maraton 58%
         posle: 5K 47%   10K 48%   HM 51%   maraton 49%
       5K i 10K se nisu ni pomerili: njihov maksimum dolazi iz dokumentovanog
       niskoobimnog izuzetka, ne iz greške. */
    for (const P of PROFILI) {
      for (const { p, opis } of siroki(P)) {
        p.weeks.slice(0, -1).forEach(w => {
          const vol = weekKm(w), lr = lrKm(w);
          if (vol < 5 || lr <= 0) return;
          assert.ok(lr / vol <= 0.53,
            `${opis} N${w.w}: dugo trčanje ${lr} km od ${vol.toFixed(1)} km = ${(lr / vol * 100).toFixed(0)}%`);
        });
      }
    }
  });
});

describe('Opterećenje i oporavak', () => {
  test('ACWR nikad ne pređe 1,5 (Gabbett)', () => {
    /* Acute:chronic workload ratio — nedelja naspram proseka prethodne četiri.
       Bolje potkrepljena mera od „pravila 10%", jer gleda hronično opterećenje
       a ne susedne nedelje: planirani vrhunac dugog trčanja SME da napravi skok
       ako je hronična baza podnese.
       PUCALO PRE POPRAVKE na 1,57 (HM) i 1,56 (maraton): izravnavanje rasta je
       kao polugu imalo SAMO lagane dane, pa na 5 dana sa 2 kvaliteta (gde ostaje
       tačno jedan lagan dan) granicu rasta prosto nije moglo da dostigne.
       Otkad i srednje-dugo trčanje učestvuje: 1,48 / 1,45. */
    for (const P of PROFILI) {
      for (const { p, opis } of podrzani(P)) {
        const v = p.weeks.map(weekKm);
        for (let i = 4; i < v.length - 1; i++) {
          const hronicno = (v[i - 1] + v[i - 2] + v[i - 3] + v[i - 4]) / 4;
          if (hronicno <= 0) continue;
          assert.ok(v[i] / hronicno <= 1.5,
            `${opis} N${i + 1}: akutno ${v[i].toFixed(1)} / hronično ${hronicno.toFixed(1)} = ${(v[i] / hronicno).toFixed(2)}`);
        }
      }
    }
  });

  test('taper se meri ISPORUČENIM vrhuncem, ne ciljanim', () => {
    /* PUCALO PRE POPRAVKE. Ciljni niz obima uredno primenjuje taperF, ali RADNE
       nedelje potkresuje izravnavanje rasta dok su taper nedelje iz njega
       izuzete — pa je taper prolazio nepotkresan i ispadao plići nego što je
       projektovan. Mereno na maratonu: poslednja taper nedelja do 81% stvarnog
       vrhunca umesto projektovanih 65%, prva do 92% umesto 80% (najgore na 4
       dana trčanja). Bosquet (meta-analiza, 27 studija): optimum je 41-60%
       smanjenja obima; 19-34% je ispod toga.
       Tolerancija od 1,06 pokriva pod od ~1,5 km po danu trčanja — ispod njega
       se ne seče ni u taperu. */
    for (const P of PROFILI) {
      for (const { p, opis } of podrzani(P)) {
        const v = p.weeks.map(weekKm);
        const pik = Math.max(...v.slice(0, -1));
        const zadnjiTaper = v[v.length - 2];
        assert.ok(zadnjiTaper <= pik * P.taperF * 1.06,
          `${opis}: taper ${zadnjiTaper.toFixed(1)} km je ${(zadnjiTaper / pik * 100).toFixed(0)}% vrhunca (${pik.toFixed(1)} km), faktor ${P.taperF}`);
      }
    }
  });
});

describe('Protokol pred trku', () => {
  test('tri dana pred trku nema ni dugog trčanja ni kvaliteta — za SVAKI dan u nedelji', () => {
    /* PUCALO PRE POPRAVKE, i to najgore od svih nalaza. Protokol (-3 shakeout,
       -2 aktivacija, -1 shakeout) se punio po DANU U NEDELJI, a trkačka nedelja
       ide samo od ponedeljka do dana trke — pa je za trku koja pada rano u
       nedelji protokol prosto nestajao:
         trka u Pon -> nedelja: 12 km dugo trčanje, ponedeljak: TRKA
         trka u Uto -> nedelja: dugo trčanje, ponedeljak 2 km, trka
         trka u Sre -> nedelja: dugo trčanje, ponedeljak intervali, utorak 2 km, trka
       Dugo trčanje je zakucano na nedelju za ceo plan, pa se sudaralo sa trkom.
       Test ide kroz sva sedam dana u nedelji baš zato što je greška bila vidljiva
       samo za neke. */
    for (const P of PROFILI) {
      for (let dow = 1; dow <= 7; dow++) {
        const p = gen({
          startDate: START, raceDate: raceIn(16, dow), raceDistM: P.distM,
          pb: { distM: P.distM, sec: P.pb }, weeklyKm: P.minKm + 15,
          runDays: P.minD + 1, quality: 2, intensity: 'std', trainedRecently: true
        });
        assert.ok(!p.error, `${P.ime} dow ${dow}: ${p.error}`);

        /* dan -> datum, pa se šeta unazad od dana trke po KALENDARU */
        const poDatumu = {};
        p.weeks.forEach(w => w.days.forEach(d => { poDatumu[plusDays(p.meta.start, (w.w - 1) * 7 + d.dow - 1)] = d; }));
        const trkaDan = Object.entries(poDatumu).find(([, d]) => d.tag === 'trka');
        assert.ok(trkaDan, `${P.ime} dow ${dow}: nema dana trke`);
        const datumTrke = trkaDan[0];

        for (let nazad = 1; nazad <= 3; nazad++) {
          const d = poDatumu[plusDays(datumTrke, -nazad)];
          if (!d || d.rest) continue;
          assert.ok(d.tag !== 'lr' && d.tag !== 'rw',
            `${P.ime}, trka ${nazad} dana kasnije: dugo trčanje (${d.km} km) neposredno pred trku`);
          /* aktivacija (-2) je jedina sesija koja tu sme — 6x200 m sa punim odmorom */
          if (nazad !== 2) {
            assert.ok(!d.session,
              `${P.ime}, ${nazad} dana pred trku: kvalitetna sesija „${d.desc}"`);
          }
          assert.ok((d.km || 0) <= 5,
            `${P.ime}, ${nazad} dana pred trku: ${d.km} km je previše za shakeout`);
        }
      }
    }
  });

  test('PRED redovi i qs ključevi ostaju dosledni i kad protokol pregazi taper nedelju', () => {
    /* Dan koji protokol zameni mora da povuče i svoj predikcijski red i svoj
       qs ključ za Strava lap-detekciju — inače ostane red za trening koji više
       ne postoji. Ista klasa greške koju već rešava filtriranje nedelje 1. */
    for (const P of PROFILI) {
      for (let dow = 1; dow <= 3; dow++) {          /* baš dani gde protokol prelazi granicu */
        const p = gen({
          startDate: START, raceDate: raceIn(16, dow), raceDistM: P.distM,
          pb: { distM: P.distM, sec: P.pb }, weeklyKm: P.minKm + 15,
          runDays: P.minD + 1, quality: 2, intensity: 'std', trainedRecently: true
        });
        const postoji = new Set();
        const naziviPoNedelji = {};
        p.weeks.forEach(w => w.days.forEach(d => {
          postoji.add('n' + w.w + 'd' + d.dow);
          if (d.session) (naziviPoNedelji[w.w] = naziviPoNedelji[w.w] || []).push('N' + w.w + ' · ' + d.session.kind);
        }));
        for (const k of Object.keys(p.qs)) assert.ok(postoji.has(k), `${P.ime} dow ${dow}: qs ključ ${k} nema svoj dan`);
        for (const r of p.pred) {
          assert.ok((naziviPoNedelji[r.w] || []).includes(r.l),
            `${P.ime} dow ${dow}: PRED red „${r.l}" nema odgovarajući dan`);
        }
      }
    }
  });
});

describe('Odluke koje moraju da prate CEO plan, ne polaznu tačku', () => {
  test('drugi kvalitetni trening prati VRHUNAC plana, ne uneti obim', () => {
    /* PUCALO PRE POPRAVKE. Odluka „ima li nedelja mesta za dva kvaliteta"
       gledala je inp.weeklyKm, a raspored dana se pravi JEDNOM za ceo plan —
       pa je trkač koji krene ispod praga a naraste daleko iznad njega dobijao
       JEDAN kvalitet svih 20 nedelja. Polumaratonac sa 28 km/ned i vrhuncem od
       51 km/ned: prag je 30, a on je od četvrte nedelje debelo iznad njega.
       To je ista greška koju srednje-dugo trčanje (`hoceMLR`) već izbegava time
       što gleda procenu vrhunca. */
    for (const P of PROFILI) {
      const start = Math.round(P.minKm * 0.8);      /* ispod praga za 2 kvaliteta */
      const p = gen({
        startDate: START, raceDate: raceIn(20), raceDistM: P.distM,
        pb: { distM: P.distM, sec: P.pb }, weeklyKm: start,
        runDays: P.minD + 1, quality: 2, intensity: 'std', trainedRecently: true
      });
      assert.ok(!p.error, p.error);
      const v = p.weeks.map(weekKm);
      const pik = Math.max(...v.slice(0, -3));
      const qMinKm = app.evalIn(`DIST_PROFILES[${P.distM}].qual2MinKm`);
      if (pik < qMinKm) continue;                   /* plan zaista ostaje mali — 1 kvalitet je tačno */
      assert.equal(p.meta.quality, 2,
        `${P.ime}: kreće sa ${start} km/ned, vrhunac ${pik.toFixed(0)} km/ned (prag ${qMinKm}) — a dobija ${p.meta.quality} kvalitet`);
    }
  });

  test('mali plan i dalje dobija jedan kvalitet, i kaže zašto', () => {
    /* Druga strana iste odluke: kad plan STVARNO ostaje ispod praga, sečenje je
       ispravno i mora da bude izgovoreno, ne tiho. */
    const p = gen({
      startDate: START, raceDate: raceIn(12), raceDistM: 42195,
      pb: { distM: 42195, sec: 300 * 60 }, weeklyKm: 12,
      runDays: 4, quality: 2, intensity: 'kons', trainedRecently: true
    });
    assert.ok(!p.error, p.error);
    assert.equal(p.meta.quality, 1);
    assert.ok(p.meta.dayWarnings.some(t => /JEDAN kvalitetan trening/.test(t)),
      'nema upozorenja o smanjenju broja kvalitetnih treninga');
  });

  test('„tek počinjem" uz visok obim je protivrečnost i mora da se kaže', () => {
    /* Mereno: početnik koji unese 50 km/ned dobija baznu fazu na 32-41 km/ned
       trčanja SA PAUZAMA ZA HOD, pa skok na 55 km/ned čim uđe kvalitet —
       ACWR 1,57, i to kod populacije koja skok najlošije podnosi. */
    const p = gen({
      startDate: START, raceDate: raceIn(16), raceDistM: 21097.5,
      pb: { distM: 21097.5, sec: 120 * 60 }, weeklyKm: 50,
      runDays: 5, quality: 2, intensity: 'std', trainedRecently: false
    });
    assert.ok(!p.error, p.error);
    assert.ok(p.meta.dayWarnings.some(t => /TEK POČINJEŠ/.test(t)),
      'početnik sa 50 km/ned ne dobija upozorenje o protivrečnom unosu');
    /* a trkač koji je trenirao ne sme da ga dobije */
    const t = gen({
      startDate: START, raceDate: raceIn(16), raceDistM: 21097.5,
      pb: { distM: 21097.5, sec: 120 * 60 }, weeklyKm: 50,
      runDays: 5, quality: 2, intensity: 'std', trainedRecently: true
    });
    assert.ok(!t.meta.dayWarnings.some(t2 => /TEK POČINJEŠ/.test(t2)),
      'trenirani trkač dobija početničko upozorenje');
  });

  test('ispod preporučenog broja dana plan i dalje upozorava', () => {
    /* Fiziološke granice iznad se mere na PODRŽANOM opsegu. Ono što mora da važi
       ispod njega je da generator kaže da opseg nije podržan.
       Prag se čita IZ PROFILA (`minDanaPrep`), ne iz mreže ovog testa: 5K i 10K
       ga namerno nemaju — tri dana su za njih sasvim legitiman izbor, pa nemaju
       ni šta da upozore. Traži se samo tamo gde profil sam kaže da traži više. */
    const traze = PROFILI.filter(P => app.evalIn(`DIST_PROFILES[${P.distM}].minDanaPrep||0`) > 3);
    assert.ok(traze.length >= 2, 'očekivano je da bar HM i maraton traže više od 3 dana');
    for (const P of traze) {
      const p = gen({
        startDate: START, raceDate: raceIn(16), raceDistM: P.distM,
        pb: { distM: P.distM, sec: P.pb }, weeklyKm: P.minKm,
        runDays: 3, quality: 2, intensity: 'std', trainedRecently: true
      });
      assert.ok(!p.error, p.error);
      assert.ok(p.meta.dayWarnings.some(t => /preporučuje bar/.test(t)),
        `${P.ime} na 3 dana ne upozorava na premalo dana trčanja`);
    }
  });
});
