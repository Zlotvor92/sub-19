/* OTISAK GENERATORA — mreža ispod svake izmene u planu.

   ČEMU SLUŽI
   Generator je najosetljiviji deo aplikacije: greška u njemu ne pada, ne javlja
   se i ne vidi se u testovima invarijanti — plan se i dalje napravi, samo je
   pogrešan. Ovaj fajl uzima OTISAK: pušta generator kroz široku matricu
   scenarija i pamti sažetak (SHA-256) svakog ishoda.

   Posle bilo kakve izmene otisak se uzima ponovo. Ako je izmena bila
   preuređenje koda — otisak MORA biti identičan. Ako se promenio, promenilo se
   i ponašanje, i to se vidi po SCENARIJU, ne po celom fajlu.

   ZAŠTO SAŽETAK, A NE CEO PLAN
   Puna matrica je nekoliko megabajta. Sažetak po scenariju kaže DA se nešto
   promenilo i GDE; kad zatreba, `--pun <scenario>` ispiše ceo plan tog jednog.

   DETERMINIZAM
   Sat je fiksiran (`now`), datumi su apsolutni. Bez toga bi otisak zavisio od
   dana kad je uzet i bio bi bezvredan.

   UPOTREBA
     node test/otisak-generatora.mjs            uzmi otisak i upiši fixture
     node test/otisak-generatora.mjs --proveri  uporedi sa upisanim (izlaz != 0 ako se razlikuje)
     node test/otisak-generatora.mjs --pun "5K · 4d · 40km · std · trenirao · 16n"
*/

import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApp } from './harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURE = join(HERE, 'fixtures', 'otisak-generatora.json');

/* Fiksan sat i fiksan početak — otisak ne sme da zavisi od dana kad se uzima. */
const SAT = '2026-01-05T09:00:00Z';
const POCETAK = '2026-01-05';

const DIST = { '5K': 5000, '10K': 10000, 'HM': 21097.5, 'Maraton': 42195 };
/* najmanji broj nedelja po distanci — ispod toga generator legitimno odbija */
const MIN_NED = { 5000: 6, 10000: 8, 21097.5: 10, 42195: 12 };

function datumPosle(nedelja) {
  const d = new Date(POCETAK + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + nedelja * 7);
  return d.toISOString().slice(0, 10);
}

/* PB koji odgovara distanci — inače bi Riegel na maratonu davao besmislice
   i pola matrice bi bila „ista greška", pa otisak ne bi merio ništa. */
const PB = {
  5000:    { distM: 5000,  sec: 1237 },
  10000:   { distM: 10000, sec: 2580 },
  21097.5: { distM: 21097.5, sec: 5700 },
  42195:   { distM: 42195, sec: 12000 }
};

export function scenariji() {
  const out = [];
  for (const [ime, distM] of Object.entries(DIST)) {
    for (const nedelja of [MIN_NED[distM], MIN_NED[distM] + 6, MIN_NED[distM] + 14]) {
      for (const runDays of [3, 4, 5, 6]) {
        /* IZBOR OBIMA NIJE PROIZVOLJAN — prva verzija je imala [12, 30, 55, 80]
           i propuštala je izmene kalibracije. Provereno mutacijom: promena
           `CILJ_OBIM_5K` sa 55 na 56 nije pomerila nijedan od 1152 scenarija,
           jer ta granica veže tek na obimu 32–50 km/ned, a između 30 i 55 nije
           bilo nijedne tačke. Otisak koji ne pokriva mesto gde konstanta radi
           ne čuva ništa.
           Sada mreža ide i kroz taj pojas (36, 45) i kroz niske obime gde vežu
           apsolutni podovi. */
        for (const weeklyKm of [12, 22, 30, 36, 45, 55, 70, 85]) {
          for (const intensity of ['kons', 'std', 'agr']) {
            for (const trainedRecently of [true, false]) {
              out.push({
                ime: `${ime} · ${runDays}d · ${weeklyKm}km · ${intensity} · ${trainedRecently ? 'trenirao' : 'pocetnik'} · ${nedelja}n`,
                inp: {
                  startDate: POCETAK,
                  raceDate: datumPosle(nedelja),
                  raceDistM: distM,
                  pb: PB[distM],
                  weeklyKm, runDays, quality: 2,
                  intensity, trainedRecently
                }
              });
            }
          }
        }
      }
    }
  }
  return out;
}

/* Kanonski zapis: ključevi sortirani, brojevi zaokruženi na 3 decimale.
   Bez sortiranja bi otisak zavisio od redosleda upisa polja, koji nije deo
   ponašanja; bez zaokruživanja bi ga menjala poslednja binarna cifra. */
function kanonski(x) {
  if (x === null || x === undefined) return null;
  if (typeof x === 'number') return Number.isFinite(x) ? Math.round(x * 1000) / 1000 : String(x);
  if (Array.isArray(x)) return x.map(kanonski);
  if (typeof x === 'object') {
    const o = {};
    for (const k of Object.keys(x).sort()) o[k] = kanonski(x[k]);
    return o;
  }
  return x;
}

export function planZa(app, inp) {
  let p;
  try { p = app.call('generatePlan', inp); }
  catch (e) { return { greska: 'IZUZETAK: ' + (e && e.message) }; }
  if (!p || p.error) return { greska: String((p && p.error) || 'bez plana') };
  /* JSON.parse(JSON.stringify) prelama vm-realm objekte u obične host objekte. */
  return kanonski(JSON.parse(JSON.stringify({ weeks: p.weeks, pred: p.pred, qs: p.qs, meta: p.meta })));
}

export function uzmiOtisak() {
  const app = loadApp({ now: SAT });
  const redovi = {};
  for (const s of scenariji()) {
    const plan = planZa(app, s.inp);
    const tekst = JSON.stringify(plan);
    redovi[s.ime] = {
      sha: createHash('sha256').update(tekst).digest('hex').slice(0, 16),
      /* Nekoliko ljudski čitljivih brojeva — da se iz razlike odmah vidi ŠTA se
         pomerilo, bez otvaranja punog plana.
         `km` je NIZ SPOJEN U STRING, ne pravi niz. Sa `JSON.stringify(…, null, 2)`
         svaki kilometar dobija svoj red, pa je fixture bio 64.000 linija i
         582 KB — više redova nego cela aplikacija, i diff u kom se ne vidi
         ništa. Ovako je jedan scenario jedan red: promena je vidljiva na prvi
         pogled, a fajl ostane u desetinama hiljada bajta. */
      pregled: plan.greska ? plan.greska : {
        nedelja: plan.weeks.length,
        km: plan.weeks.map(w => Math.round(w.days.reduce((a, d) => a + (d.km || 0), 0) * 10) / 10).join(','),
        kvalitetnih: plan.weeks.reduce((n, w) => n + w.days.filter(d => d.tag === 'int' || d.tag === 'tempo').length, 0),
        vdot0: plan.meta.vdot0, vdotGoal: plan.meta.vdotGoal
      }
    };
  }
  const ukupno = createHash('sha256')
    .update(Object.keys(redovi).sort().map(k => k + ':' + redovi[k].sha).join('\n'))
    .digest('hex');
  return { sat: SAT, pocetak: POCETAK, scenarija: Object.keys(redovi).length, ukupno, redovi };
}

export function ucitajOtisak() {
  if (!existsSync(FIXTURE)) return null;
  return JSON.parse(readFileSync(FIXTURE, 'utf8'));
}

/* --- pokretanje iz komandne linije ---

   `NODE_TEST_CONTEXT` MORA da bude prazan, i to nije sitnica nego zamka koja je
   ovaj fajl pretvorila u svoju suprotnost.

   `node --test` iz korena repozitorijuma tretira SVAKI fajl unutar `test/` kao
   test fajl — dakle i ovaj, koji nije test nego alat. Kad ga pokrene, on postaje
   `process.argv[1]`, uslov ispod je tačan, argumenta nema — i grana na dnu
   UPIŠE NOV OTISAK usred prolaza testova.

   Posledica: zamka je sama sebe blagosiljala. Prvi prolaz posle izmene
   generatora padne, drugi prođe — jer je prvi u međuvremenu prepisao fixture
   sa novim planovima. Svaka nenamerna izmena generatora bila bi tako tiho
   odobrena, a to je tačno ono pred čim upozorava komentar u
   `generator-otisak.test.mjs`: „ponovno uzimanje otiska naslepo, što ubija
   smisao".

   Otkriveno merenjem: `node --test` iz korena daje 1065 testova i pada, isti
   `node --test` iz `test/` daje 1063 i prolazi — razlika su baš ovaj fajl i
   `harness.mjs`, koje runner pokreće kao testove. */
if (process.argv[1] && process.argv[1].endsWith('otisak-generatora.mjs')
    && !process.env.NODE_TEST_CONTEXT) {
  const arg = process.argv[2];

  if (arg === '--pun') {
    const trazen = process.argv[3];
    const s = scenariji().find(x => x.ime === trazen);
    if (!s) { console.error('nema scenarija: ' + trazen); process.exit(2); }
    console.log(JSON.stringify(planZa(loadApp({ now: SAT }), s.inp), null, 2));
    process.exit(0);
  }

  const sad = uzmiOtisak();

  if (arg === '--proveri') {
    const stari = ucitajOtisak();
    if (!stari) { console.error('nema otiska — pusti `node test/otisak-generatora.mjs` prvo'); process.exit(2); }
    const razlike = [];
    for (const ime of Object.keys(sad.redovi)) {
      const a = stari.redovi[ime], b = sad.redovi[ime];
      if (!a) { razlike.push(['NOV', ime, null, b.sha]); continue; }
      if (a.sha !== b.sha) razlike.push(['IZMENJEN', ime, a.sha, b.sha]);
    }
    for (const ime of Object.keys(stari.redovi)) if (!sad.redovi[ime]) razlike.push(['NESTAO', ime, stari.redovi[ime].sha, null]);

    if (!razlike.length) {
      console.log(`OTISAK IDENTIČAN — ${sad.scenarija} scenarija, ukupno ${sad.ukupno.slice(0, 16)}`);
      process.exit(0);
    }
    console.log(`OTISAK SE RAZLIKUJE — ${razlike.length} od ${sad.scenarija} scenarija:\n`);
    for (const [vrsta, ime, a, b] of razlike.slice(0, 40)) {
      console.log(`  ${vrsta}  ${ime}`);
      console.log(`      pre: ${a}   posle: ${b}`);
      const pa = stari.redovi[ime] && stari.redovi[ime].pregled;
      const pb = sad.redovi[ime] && sad.redovi[ime].pregled;
      if (pa && pb && typeof pa === 'object' && typeof pb === 'object') {
        for (const k of Object.keys(pb)) {
          const x = JSON.stringify(pa[k]), y = JSON.stringify(pb[k]);
          if (x !== y) console.log(`      ${k}:\n         pre  ${x}\n         posle ${y}`);
        }
      } else if (pa !== pb) {
        console.log(`      pregled: pre ${JSON.stringify(pa)} posle ${JSON.stringify(pb)}`);
      }
    }
    if (razlike.length > 40) console.log(`  … i još ${razlike.length - 40}`);
    process.exit(1);
  }

  /* Zapis je ručno sklopljen da bi JEDAN SCENARIO bio JEDAN RED. Uvučen
     `JSON.stringify` bi ga razbio na desetak redova po scenariju — 64.000
     redova ukupno, u kojima se izmena ne vidi. Ovako `git diff` pokaže tačno
     onoliko izmenjenih redova koliko se scenarija pomerilo. */
  const redovi = Object.keys(sad.redovi).sort()
    .map(k => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(sad.redovi[k]))
    .join(',\n');
  const tekst = '{\n' +
    `  "sat": ${JSON.stringify(sad.sat)},\n` +
    `  "pocetak": ${JSON.stringify(sad.pocetak)},\n` +
    `  "scenarija": ${sad.scenarija},\n` +
    `  "ukupno": ${JSON.stringify(sad.ukupno)},\n` +
    '  "redovi": {\n' + redovi + '\n  }\n}\n';
  mkdirSync(dirname(FIXTURE), { recursive: true });
  writeFileSync(FIXTURE, tekst);
  console.log(`otisak upisan: ${sad.scenarija} scenarija, ukupno ${sad.ukupno.slice(0, 16)}`);
  console.log(`  -> ${FIXTURE}`);
}
