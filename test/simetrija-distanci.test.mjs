/* SIMETRIJA ČETIRI DISTANCE — zamka za ispravku koja sleti u tri od četiri.

   ZAŠTO OVAJ FAJL POSTOJI
   Generator svesno drži odvojenu logiku po distanci: 61 funkcija i 25 konstanti
   nose sufiks 5K/10K/21K/42K, a sedamnaest familija je napisano dva do četiri
   puta (`korakRasta`, `peakVol`, `lrCap`, `reps`, `faza`, `buildQuality`, svi
   `mk*` gradioci). Ta odluka je namerna — izmena za maraton ne sme tiho da
   pokvari 5K — i ovaj fajl je NE dovodi u pitanje.

   Ali odvojenost ima cenu koju ništa nije merilo: metodološka ispravka mora
   ručno u četiri mesta, a kad sleti u tri, NIŠTA ne pukne. Plan se i dalje
   napravi, testovi i dalje prolaze, samo je za jednu distancu pogrešan.

   Ovde se zato ne testira da su četiri familije ISTE — nego da su one stvari
   koje MORAJU ostati zajedničke i dalje zajedničke, i da nijedna distanca nije
   ispala iz jezgra.

   ŠTA SE NAMERNO NE TESTIRA OVDE
   - Danielsov budžet praga (10%): već stoji u `nauka.test.mjs`, mereno nad
     celom mrežom planova. Podni faktor se razlikuje po distanci (0.12 za 5K i
     10K, 0.10 za 21K, 0.09 za 42K) i to je svesna odluka po distanci, a ne
     nedovršena ispravka — ishod je ograničen tamo, na isporučenom planu.
   - Rast obima, deload, taper, dugo trčanje: `generator.test.mjs`.
   - Bilo koja fiksna brojka plana. Ovo su invarijante, ne snimci. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readRepoFile } from './harness.mjs';

const app = loadApp({ now: '2026-01-05T09:00:00Z' });

const DIST = [
  { suf: '5K',  m: 5000 },
  { suf: '10K', m: 10000 },
  { suf: '21K', m: 21097.5 },
  { suf: '42K', m: 42195 }
];

/* 21K i 42K primaju dodatni `deo` (delilac za dvodelne sesije). Poziv se zato
   sklapa po distanci — inače bi `undefined` prošao kao 1 i test bi merio drugu
   stvar nego što misli. */
const tempoZa = (suf, vol, pT) =>
  (suf === '21K' || suf === '42K')
    ? app.call('mkTempo' + suf, 1, vol, pT, null, 1)
    : app.call('mkTempo' + suf, 1, vol, pT, null);

const profil = m => JSON.parse(JSON.stringify(app.evalIn(`DIST_PROFILES[${m}]`)));

describe('Matrica familija po distanci je zaključana', () => {
  /* PRVA VERZIJA OVOG TESTA BILA JE PRESLABA. Držala je ručno napisan spisak
     „jezgra" i proveravala da ta imena postoje za sve četiri distance. To hvata
     brisanje, ali NE hvata drift koji se stvarno dešava: neko doda novu
     familiju (`mkNesto5K`, `mkNesto10K`, `mkNesto21K`) i zaboravi četvrtu —
     spisak je fiksan, novo ime u njemu ne postoji, test ćuti.

     Zato se matrica sada ČITA IZ KODA i poredi sa zaključanom. Sve što se
     promeni — nova familija, nova distanca, familija koja je dobila ili
     izgubila jednu distancu — mora proći kroz svesnu izmenu ovog spiska.

     Nejednake vrste u spisku su NAMERNE i ostaju: `mkPiramida` postoji samo za
     5K i 10K, `mkMaratonskiTempo` samo za 42K, `mkRitam` samo za 21K. Piramide
     nemaju smisla na maratonu, kao ni maratonski tempo na 5K. Test ne traži da
     sve bude svuda — traži da razlika bude odluka, a ne previd. */
  const MATRICA = {
    buildQuality:      ['5K', '10K', '21K', '42K'],
    faza:              ['5K', '10K', '21K', '42K'],
    korakRasta:        ['5K', '10K', '21K', '42K'],
    lrCap:             ['5K', '10K', '21K', '42K'],
    lrCiklus:          ['42K'],
    lrDodatak:         ['21K', '42K'],
    mkCruise:          ['5K', '10K', '21K', '42K'],
    mkFartlek:         ['5K', '10K', '21K'],
    mkIntervali:       ['5K', '10K', '21K', '42K'],
    mkKontrolnaTrka:   ['21K'],
    mkMaratonskiTempo: ['42K'],
    mkPiramida:        ['5K', '10K'],
    mkProgresivni:     ['10K', '21K', '42K'],
    mkRepeticije:      ['5K', '10K', '21K', '42K'],
    mkRitam:           ['21K'],
    mkTempo:           ['5K', '10K', '21K', '42K'],
    mkTrkackiRitam:    ['5K', '10K'],
    pauza:             ['10K', '21K'],
    peakVol:           ['5K', '10K', '21K', '42K'],
    q1Familija:        ['21K', '42K'],
    reps:              ['5K', '10K', '21K', '42K'],
    ritamStrategija:   ['21K']
  };
  const RED = ['5K', '10K', '21K', '42K'];

  const izKoda = () => {
    const src = readRepoFile('app.js');
    const m = {};
    for (const x of src.matchAll(/^function ([a-zA-Z0-9]+?)(5K|10K|21K|42K)\(/gm)) {
      (m[x[1]] = m[x[1]] || new Set()).add(x[2]);
    }
    const out = {};
    for (const k of Object.keys(m).sort()) out[k] = RED.filter(r => m[k].has(r));
    return out;
  };

  test('nijedna familija nije dobila ni izgubila distancu', () => {
    const sada = izKoda();
    const poruke = [];
    for (const ime of new Set([...Object.keys(MATRICA), ...Object.keys(sada)])) {
      const ocek = MATRICA[ime], ima = sada[ime];
      if (!ocek) { poruke.push(`NOVA familija ${ime}* za: ${ima.join(', ')} — da li joj fale ostale distance?`); continue; }
      if (!ima)  { poruke.push(`NESTALA familija ${ime}* (bila za: ${ocek.join(', ')})`); continue; }
      const fali = ocek.filter(r => !ima.includes(r));
      const viska = ima.filter(r => !ocek.includes(r));
      if (fali.length)  poruke.push(`${ime}* više nema: ${fali.join(', ')}`);
      if (viska.length) poruke.push(`${ime}* je dobila: ${viska.join(', ')} — proveri da li treba i ostalima`);
    }
    assert.deepEqual(poruke, [],
      'Matrica familija po distanci se promenila:\n  ' + poruke.join('\n  ') +
      '\n\nAko je izmena namerna, osveži MATRICA u ovom testu — i tom prilikom ' +
      'proveri da li ista izmena treba i ostalim distancama.');
  });

  test('sve familije iz matrice su stvarno pozivne', () => {
    /* Matrica se čita iz teksta; ovo potvrđuje da su ta imena i živa u
       izvršavanju (npr. da nisu ostala unutar mrtve grane). */
    for (const [ime, dist] of Object.entries(MATRICA)) {
      for (const suf of dist) {
        assert.equal(app.evalIn(`typeof ${ime}${suf}`), 'function',
          `${ime}${suf} postoji u izvoru ali nije pozivna`);
      }
    }
  });

  test('svaka distanca ima svoj profil sa imenom i najmanjim brojem nedelja', () => {
    for (const d of DIST) {
      const p = profil(d.m);
      assert.ok(p, `nema profila za ${d.suf}`);
      assert.equal(typeof p.name, 'string');
      assert.ok(p.minWeeks > 0, `${d.suf}: minWeeks nije postavljen`);
    }
  });
});

describe('Ograničenje tempa dolazi iz JEDNOG izvora po distanci', () => {
  /* OVO JE ZAMKA ZBOG KOJE JE FAJL I NASTAO.
     `mkTempo10K/21K/42K` čitaju imenovanu konstantu (TEMPO_MAX_SEC_*), koja je
     ista ona vrednost koju profil izlaže kao `tempoMaxSec`. Kod 5K ista brojka
     stoji NAPISANA DVAPUT: kao `20*60` u `mkTempo5K` i kao `tempoMaxSec:20*60`
     u profilu. Danas se poklapaju. Promeni jednu kopiju i one se tiho raziđu —
     plan se i dalje pravi, samo tempo sesija za 5K prestaje da prati profil.

     Test to hvata ponašanjem, ne čitanjem koda: pusti se obim toliko velik da
     ograničenje MORA da veže, pa se izmereno poredi sa profilom. */
  const pT = 240;   /* 4:00/km — okrugao prag, da poređenje bude čitljivo */

  for (const d of DIST) {
    test(`${d.suf}: najduži prag odgovara tempoMaxSec iz profila`, () => {
      const p = profil(d.m);
      const ocekivano = p.tempoMaxSec / pT;
      const ses = tempoZa(d.suf, 999, pT).session;
      /* tolerancija je zaokruživanje na 0,1 km (r1), ne sloboda */
      assert.ok(Math.abs(ses.qKm - ocekivano) <= 0.06,
        `${d.suf}: prag ${ses.qKm} km, a profil traži ${ocekivano.toFixed(2)} km ` +
        `(tempoMaxSec ${p.tempoMaxSec} s / ${pT} s/km) — dve kopije istog broja su se razišle`);
    });
  }

  test('tempoMaxSec je razuman i raste sa distancom', () => {
    const v = DIST.map(d => profil(d.m).tempoMaxSec);
    for (const [i, x] of v.entries()) {
      assert.ok(x >= 10 * 60 && x <= 60 * 60, `${DIST[i].suf}: tempoMaxSec ${x} s je van svake trkačke logike`);
      if (i) assert.ok(x >= v[i - 1], `${DIST[i].suf} ima kraći prag od ${DIST[i - 1].suf}`);
    }
  });
});

describe('Zajedničko ostaje zajedničko', () => {
  test('zagrevanje i smirivanje dolaze iz jedne funkcije za sve distance', () => {
    /* `wuCdZaObim` je jedini izvor. Da neka distanca dobije svoju kopiju, ovo
       bi puklo — i to je poenta: zagrevanje ne zavisi od distance trke nego od
       nedeljnog obima. */
    for (const vol of [15, 25, 30, 50, 80]) {
      const vidjeno = DIST.map(d => {
        const s = tempoZa(d.suf, vol, 300).session;
        return `${s.wuKm}/${s.cdKm}`;
      });
      assert.equal(new Set(vidjeno).size, 1,
        `na ${vol} km/ned zagrevanje se razlikuje po distanci: ` +
        DIST.map((d, i) => `${d.suf}=${vidjeno[i]}`).join(' '));
    }
  });

  test('svaka tempo sesija je kontinuirana i nosi ciljni tempo', () => {
    for (const d of DIST) {
      const s = tempoZa(d.suf, 40, 300).session;
      assert.equal(s.type, 'tempo', `${d.suf}: tip sesije nije tempo`);
      assert.equal(s.paceSec, 300, `${d.suf}: ciljni tempo se izgubio`);
      assert.ok(s.qKm > 0 && s.wuKm > 0, `${d.suf}: sesija bez rada ili bez zagrevanja`);
    }
  });
});

describe('Skaliranje se ponaša isto na sve četiri distance', () => {
  /* Vrednosti smeju da se razlikuju — SMER ne sme. Ako `peakVol` za jednu
     distancu prestane da raste sa unetim obimom, to je greška ma koliko se
     kalibracija razlikovala. */

  test('peakVol raste (ne opada) sa unetim nedeljnim obimom', () => {
    for (const d of DIST) {
      const v = [10, 20, 30, 40, 60, 80].map(x => app.call('peakVol' + d.suf, x, 8, 'std'));
      for (let i = 1; i < v.length; i++) {
        assert.ok(v[i] >= v[i - 1] - 1e-9,
          `${d.suf}: vrhunac pada sa rastom obima (${v[i - 1]} -> ${v[i]})`);
      }
    }
  });

  test('lrCap raste sa obimom i nikad ne pojede celu nedelju', () => {
    for (const d of DIST) {
      const obimi = [20, 40, 60, 80];
      const v = obimi.map(x => app.call('lrCap' + d.suf, x, 330));
      for (let i = 0; i < v.length; i++) {
        assert.ok(v[i] > 0, `${d.suf}: dugo trčanje bez dužine na ${obimi[i]} km`);
        assert.ok(v[i] <= obimi[i],
          `${d.suf}: dugo trčanje ${v[i]} km je duže od cele nedelje (${obimi[i]} km)`);
        if (i) assert.ok(v[i] >= v[i - 1] - 1e-9,
          `${d.suf}: dugo trčanje se skraćuje kad obim raste (${v[i - 1]} -> ${v[i]})`);
      }
    }
  });

  test('agresivniji izbor nikad ne daje manji korak rasta', () => {
    for (const d of DIST) {
      const [k, s, a] = ['kons', 'std', 'agr'].map(i => app.call('korakRasta' + d.suf, 40, i));
      assert.ok(k <= s && s <= a,
        `${d.suf}: korak rasta nije rastuć po intenzitetu (kons ${k}, std ${s}, agr ${a})`);
      assert.ok(k > 0, `${d.suf}: konzervativan izbor ne raste uopšte`);
    }
  });
});

describe('Oblik profila je zaključan — polje dodato u tri od četiri se vidi', () => {
  /* Kratke i duge distance NAMERNO nose različit skup polja: `lrCiklus`,
     `gorivoOdMin`, `taperWeeks` i slično nemaju smisla na 5K. Zato se ne
     zahteva da svi profili budu isti — nego da su TAČNO ovakvi kakvi jesu.
     Kad se sutra doda polje, ovaj test pukne i traži svesnu odluku: da li ide
     u sve četiri distance ili samo u neke. Bez toga bi „dodao sam ga gde mi je
     trebalo" prošlo nemo, a upravo tako nastaje razilaženje. */
  const OCEKIVANO = {
    '5K': ['baseWeeksBeginner', 'bazaMin', 'deloadF', 'lrMaxUdeo', 'minWeeks', 'name',
           'qual2MinKm', 'raceWkF', 'taperF', 'taperLrF', 'tempoMaxSec', 'undulacija',
           'uvodnaPct', 'wuCdMaxAdd'],
    '10K': ['baseWeeksBeginner', 'bazaMin', 'deloadF', 'lrMaxUdeo', 'minWeeks', 'name',
            'qual2MinKm', 'raceWkF', 'taperF', 'taperLrF', 'tempoMaxSec', 'undulacija',
            'uvodnaPct', 'wuCdMaxAdd'],
    '21K': ['baseWeeksBeginner', 'bazaLrF', 'bazaMin', 'deloadF', 'gorivoOdMin', 'lrMaxUdeo',
            'minDanaPrep', 'minWeeks', 'mlr', 'name', 'qual2MinKm', 'raceWkF', 'taperF',
            'taperF2', 'taperLrF', 'taperWeeks', 'tempoMaxSec', 'undulacija', 'uvodnaPct',
            'wuCdMaxAdd'],
    '42K': ['baseWeeksBeginner', 'bazaLrF', 'bazaMin', 'deloadF', 'gorivoJakoOdMin',
            'gorivoOdMin', 'lrMaxUdeo', 'minDanaPrep', 'minWeeks', 'mlr', 'name',
            'qual2MinKm', 'raceWkF', 'taperF', 'taperF2', 'taperLrF', 'taperWeeks',
            'tempoMaxSec', 'undulacija', 'uvodnaPct', 'wuCdMaxAdd']
  };

  for (const d of DIST) {
    test(`${d.suf} nosi tačno očekivana polja`, () => {
      const sada = Object.keys(profil(d.m)).sort();
      const ocek = OCEKIVANO[d.suf];
      const novo = sada.filter(k => !ocek.includes(k));
      const nestalo = ocek.filter(k => !sada.includes(k));
      assert.deepEqual({ novo, nestalo }, { novo: [], nestalo: [] },
        `${d.suf}: profil se promenio. Ako je namerno, dodaj/skloni polje i u ostalim ` +
        `distancama gde ima smisla, pa osveži OCEKIVANO u ovom testu.`);
    });
  }
});
