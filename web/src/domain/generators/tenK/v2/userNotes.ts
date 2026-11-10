/* G3 (P8, nalaz slepe ocene) — tekst za trkača: napomene nedelje i poruke plana kakve vidi trkač. JEDINO mesto
   prevoda. Plan (i validator koji čita napomene) zadržava tehničke napomene doslovno; ovde se tehničke oznake i reči
   sastavljanja („ne može da se sastavi", „najviše 10 % nedelje u tom tempu", „0,8 × dugog") prevode u jezik treninga
   ili izostavljaju, a isto upozorenje plana ide najviše jednom (zbirno). Napomena tvrdi samo ono što brojevi tog plana
   pokazuju (test `userNotes.node.test.ts`). */

import type { TenKV2Plan } from './types.ts';
import { weekLabel } from './weekLabel.ts';

type Rewrite = readonly [RegExp, string | null];

/** Napomene nedelje: obrazac → tekst za trkača (null = ne ide trkaču; sadržaj daje zbirna poruka plana). */
const WEEK: readonly Rewrite[] = [
  // Spuštena/podignuta nedelja izgradnje: zbirno u poruci plana o kapacitetu.
  [/^Nedelja ne može da se sastavi na .*$/u, null],
  [
    /^Rasterećenje: dugi 0,8 × poslednji ne ostavlja lagane ≥ 3 km — dugi skraćen \(kao posle smanjenja obima\)\.$/u,
    null
  ],
  [
    /^Rasterećenje: cilj ([\d,]+) km, jedan kvalitet \((T)\), dugi ([\d,]+) km — skraćen sa 0,8 × dugog poslednje nedelje pre rasterećenja da lagani ostanu ≥ 3,0 km\.$/u,
    'Rasterećenje: lakša nedelja ($1 km), jedan kvalitetni trening ($2), dugi $3 km — kraći nego obično, da lagani treninzi ostanu bar 3 km.'
  ],
  [
    /^Rasterećenje: cilj ([\d,]+) km, test 5 km umesto kvaliteta rasterećenja, dugi ([\d,]+) km — skraćen sa 0,8 × dugog poslednje nedelje pre rasterećenja \(([\d,]+) km\) da lagani ostanu ≥ 3,0 km\.$/u,
    'Rasterećenje: lakša nedelja ($1 km) sa testom 5 km umesto kvalitetnog treninga; dugi $2 km — kraći nego obično, da lagani treninzi ostanu bar 3 km.'
  ],
  [
    /^Rasterećenje: cilj ([\d,]+) km, jedan kvalitet \((T)\), dugi 0,8 × dugog poslednje nedelje pre rasterećenja\.$/u,
    'Rasterećenje: lakša nedelja ($1 km), jedan kvalitetni trening ($2), dugi oko 20 % kraći.'
  ],
  [
    /^Rasterećenje: cilj ([\d,]+) km, test 5 km umesto kvaliteta rasterećenja, dugi 0,8 × dugog poslednje nedelje pre rasterećenja\.$/u,
    'Rasterećenje: lakša nedelja ($1 km) sa testom 5 km umesto kvalitetnog treninga; dugi oko 20 % kraći.'
  ],
  [
    /^Specifična faza, nedelja B: drugi kvalitet je I održavanja ([\d,]+) km \(najveća I doza razvoja(?:, skraćena na najviše \d+ % nedelje)?, ne raste\); T u deonicama se nastavlja u sledećoj nedelji A\.$/u,
    'Specifična faza: drugi kvalitetni trening je interval (I) $1 km da se održi brzina iz razvoja; T u deonicama se vraća sledeće nedelje.'
  ],
  [
    /^Nedelja B ne staje: .*— nedelja je A \(T u deonicama\); sledeća je B\.$/u,
    'Drugi kvalitetni trening je T u deonicama; interval (I) za održavanje brzine dolazi sledeće nedelje.'
  ],
  [
    /^Taper: RP i T ≈ 60 % poslednje doze, dugi ≤ 0,75 × najduži\.$/u,
    'Taper: manje km i kraći kvalitetni treninzi (RP i T oko 60 % poslednjih), dugi kraći — da na trku dođeš odmoran.'
  ],
  [
    /^Taper: RP ≈ 60 % poslednje doze, dugi ≤ 0,75 × najduži\.$/u,
    'Taper: manje km i kraći trening u tempu trke (RP oko 60 % poslednjeg), dugi kraći — da na trku dođeš odmoran.'
  ],
  [
    /^Taper: samo RP ≈ 60 % poslednje doze\. Drugi dan kvaliteta \(.*\) je lagan, sa dva dana kvaliteta dan kvaliteta bio bi duži od dugog; dugi ≤ 0,75 × najduži\.$/u,
    'Taper: jedan kvalitetni trening u tempu trke (RP oko 60 % poslednjeg); drugi dan je lagan, da kvalitetni dan ne bude duži od dugog. Dugi kraći — da na trku dođeš odmoran.'
  ],
  [
    /^Taper: samo RP ≈ 60 % poslednje doze — .*; dugi ≤ 0,75 × najduži\.$/u,
    'Taper: jedan kvalitetni trening u tempu trke (RP oko 60 % poslednjeg), dugi kraći — da na trku dođeš odmoran.'
  ],
  [/^Taper: (.*)$/u, 'Taper: $1'],
  [
    /^Trkačka nedelja: oštrenje (.+?) RP \(≤ RP doza tapera [\d,]+ km(?:, ≤ \d+ min rada)?\), trka 10 km se ne računa u obim\.$/u,
    'Trkačka nedelja: kratko oštrenje $1 u tempu trke; km trke nisu u zbiru nedelje.'
  ],
  [
    /^Trkačka nedelja: lagan ([\d,]+) km = najkraći lagan tapera .*$/u,
    'Trkačka nedelja: lagani treninzi su kratki ($1 km), da nedelja bude lakša od tapera.'
  ],
  [
    /^Kontrolni test 5 km umesto prvog kvaliteta: kontrolisano maksimalno, pred specifičnu fazu proverava formu\. Unesi rezultat — tempo treninga se prilagođava od sledeće nedelje\. Računa se u obim nedelje, ne u dozu kvaliteta\.$/u,
    'Kontrolni test 5 km umesto prvog kvalitetnog treninga: trči kontrolisano maksimalno — pred specifičnu fazu proverava formu. Posle testa unesi rezultat: tempo treninga se prilagođava od sledeće nedelje.'
  ],
  [
    /^Test 5 km: kontrolisano maksimalno; računa se u obim nedelje, ne u dozu kvaliteta; rezultat se koristi za prilagođavanje plana, do tada tempo ostaje procena\.$/u,
    'Test 5 km: trči kontrolisano maksimalno. Do testa je tempo procena. Posle testa unesi rezultat: tempo treninga i ocena cilja se prilagođavaju od sledeće nedelje.'
  ],
  [
    /^(Jedan lagan dan je|\d+ lagana dana su) odmor — ostatak obima ne staje u lagane od bar (\d+) min\.$/u,
    '$1 odmor: posle kvaliteta i dugog ostaje premalo km za lagan trening od bar $2 min.'
  ],
  [
    /^Svi lagani dani su odmor — ostatak obima ne staje u lagane od bar (\d+) min; planirano je manje od cilja nedelje\.$/u,
    'Lagani dani su odmor: posle kvaliteta i dugog ostaje premalo km za lagan trening od bar $1 min, pa je nedelja malo kraća od cilja.'
  ],
  [
    /^(Prvi|Drugi) kvalitet: (T|I|RP|R) spušten sa ([\d,]+) na ([\d,]+) km — .*$/u,
    '$1 kvalitetni trening: $2 $4 km (prošli put $3 km), da rad u tempu ostane srazmeran obimu ove nedelje.'
  ],
  [
    /^(Prvi|Drugi) kvalitet: (T|I|RP|R) ([\d,]+) km ponovljen — .*$/u,
    '$1 kvalitetni trening: $2 $3 km kao prošli put — veći rad u tempu još nije srazmeran obimu nedelje.'
  ],
  [
    /^T kontinuirano umesto T u deonicama: .*$/u,
    'T kontinuirano umesto u deonicama — kraći rad u tempu odgovara obimu nedelje.'
  ],
  [
    /^Drugi dan kvaliteta \(.*\) je lagan — sa dva dana kvaliteta dan kvaliteta bio bi duži od dugog; prvi dan kvaliteta i dalje traje duže od dugog \(preporuka: manje dana treninga\)\.$/u,
    'Drugi kvalitetni trening ove nedelje je lagan. Kvalitetni dan i dalje traje duže od dugog — sa manje dana treninga dugi bi bio duži.'
  ],
  [
    /^Drugi dan kvaliteta \(.*\) je lagan — sa dva dana kvaliteta dan kvaliteta bio bi duži od dugog\.$/u,
    'Drugi kvalitetni trening ove nedelje je lagan, da kvalitetni dan ne bude duži od dugog.'
  ],
  [
    /^Uvod: (\d+)\. od (\d+) nedelje uvoda bez kvaliteta — dan kvaliteta je lagan\.$/u,
    'Uvod ($1. od $2 nedelje): samo lagano trčanje, telo se navikava na plan.'
  ]
];

/** Napomene nedelje za trkača (redosled plana; bez ponavljanja). Nepoznata napomena prolazi doslovno. */
export function userWeekNotes(notes: readonly string[]): string[] {
  const out: string[] = [];
  for (const n of notes) {
    let t: string | null = n;
    for (const [re, to] of WEEK)
      if (re.test(n)) {
        t = to === null ? null : n.replace(re, to);
        break;
      }
    if (t !== null && !out.includes(t)) out.push(t);
  }
  return out;
}

/** Brojevi nedelja u tekstu: „4, 8 i 12". */
const weekList = (ws: readonly number[]): string =>
  ws.length === 1 ? `${ws[0]}` : `${ws.slice(0, -1).join(', ')} i ${ws[ws.length - 1]}`;

/** Upozorenja validatora: obrazac → tekst za trkača (isti brojevi). */
const WARN: readonly Rewrite[] = [
  [
    /^Planirano < cilj u (\d+) nedelja izgradnje \(nedelja (\d+): ([\d,.]+) < ([\d,.]+) km\) — ostatak obima ne staje u lagan od bar (\d+) min, lagani dani su odmor(?:; preporuka ([\d–]+) dana \(plan sa manje dana podržava obim ([\d,.]+) km, dugi dobija veći udeo\))?\.$/u,
    'Nedelja izgradnje kraća od cilja ($1 ned., npr. nedelja $2: $3 km od $4 km): posle kvaliteta i dugog ostaje premalo km za lagan trening od bar $5 min, pa su lagani dani odmor.'
  ],
  [
    /^Dan kvaliteta ili testa duži od dugog po trajanju u (\d+) od (\d+) nedelja izgradnje \(nedelja (\d+): (\d+) > (\d+) min\)(?:; preporuka ([\d–]+) dana \(plan sa manje dana podržava obim ([\d,.]+) km, dugi dobija veći udeo\))?\.$/u,
    'Kvalitetni dan traje duže od dugog u $1 od $2 nedelja izgradnje (npr. nedelja $3: $4 prema $5 min).'
  ],
  [
    /^Lagani treninzi kratki ili odmor u (\d+) nedelja izgradnje \(nedelja (\d+): lagan kraći od (\d+) min ili odmor\).*$/u,
    'Lagani treninzi su kratki (kraći od $3 min) ili odmor u $1 nedelja izgradnje (prva: nedelja $2) — obim nedelje je mali za zadat broj dana.'
  ]
];
/** Preporuka manje dana (D25) iz poruke validatora → rečenica za trkača. */
const fewerDays = (s: string): string => {
  const m =
    /preporuka ([\d–]+) dana \(plan sa manje dana podržava obim ([\d,.]+) km, dugi dobija veći udeo\)/u.exec(
      s
    );
  return m
    ? ` Sa ${m[1]} dana treninga nedeljno obim od ${m[2]} km bi se bolje rasporedio (duži dugi, duži lagani).`
    : '';
};
const warnText = (s: string): string => {
  for (const [re, to] of WARN) if (re.test(s)) return s.replace(re, to!) + fewerDays(s);
  return s;
};

/** Poruke plana koje sadržaj nose već u napomenama nedelje — trkaču ne idu drugi put. */
const IN_WEEK_NOTES = new Set(['DOSE_DROPPED', 'B_WEEK_NOT_FIT', 'TAPER_RP_ONLY']);

/** Kapacitet (D22): „N dana ne nose ovaj obim uz …; preporuka …. Vrh X km umesto do Y km." → jezik trkača. */
function capacityText(s: string): string {
  const m =
    /^(\d) dana ne nose ovaj obim uz (.+?)(; preporuka ([\d–]+) dana)?\.(?: Vrh ([\d,]+) km umesto do ([\d,]+) km\.)?$/u.exec(
      s
    );
  if (!m) return s;
  const [, days, limits, , more, peak, cap] = m;
  const head = peak
    ? `Vrh obima je ${peak} km (redovan rast bi išao do ${cap} km)`
    : 'Obim pojedinih nedelja je malo niži od redovnog rasta';
  const tail = more ? ` Za veći obim: ${more} dana treninga nedeljno.` : '';
  const lim = limits!
    .replace(/^dugi /u, '')
    .replace(/ ≤ /gu, ' najviše ')
    .replace(/^≤ /u, 'najviše ')
    .replace(/, lagan /u, ', a lagan trening ');
  return `${head}: sa ${days} dana treninga dugi trening je ${lim}.${tail}`;
}

/**
 * Napomene i upozorenja plana za trkača („Na šta da paziš"): napomene plana, pa upozorenja — svako pravilo najviše
 * jednom (zbirno), bez ponavljanja sadržaja napomena nedelje i bez ponavljanja poruke o kapacitetu.
 */
export function userPlanMessages(plan: TenKV2Plan): string[] {
  const out: string[] = [];
  const push = (t: string): void => {
    if (t && !out.includes(t)) out.push(t);
  };
  // 10K (c), P8 dopuna: upozorenje kratkih laganih dana (preporuka manje dana) je PRVO u planu.
  const short = plan.warnings.find((v) => v.rule === 'SHORT_EASY');
  if (short) push(warnText(short.message));
  const capacityNote = plan.notes.some((n) => /^\d dana ne nose ovaj obim/u.test(n));
  for (const n of plan.notes) push(/^\d dana ne nose ovaj obim/u.test(n) ? capacityText(n) : n);
  // Isto pravilo (i dva imena istog sadržaja: dugi rasterećenja) → jedna poruka.
  const key = (rule: string): string => (rule === 'TEST_DELOAD_LONG' ? 'ADAPT_DELOAD_LONG' : rule);
  const byRule = new Map<string, { message: string; week?: number }[]>();
  for (const v of plan.warnings) {
    const l = byRule.get(key(v.rule)) ?? [];
    l.push(v);
    byRule.set(key(v.rule), l);
  }
  for (const [rule, vs] of byRule) {
    if (IN_WEEK_NOTES.has(rule) || rule === 'SHORT_EASY') continue;
    const weeks = [
      ...new Set(
        vs
          .map((v) => v.week)
          .filter((w): w is number => w !== undefined)
          .map((w) => weekLabel(plan.input, w))
      )
    ].sort((a, b) => a - b);
    if (rule === 'CAPACITY_LIMITED') {
      if (!capacityNote) push(capacityText(vs[0]!.message));
      continue;
    }
    if (rule === 'WEEK_FITTED') {
      if (!capacityNote)
        push(
          `Obim ${weeks.length === 1 ? 'nedelje' : 'nedelja'} ${weekList(weeks)} je malo drugačiji od redovnog rasta, da treninzi ostanu u razumnim dužinama za zadate dane.`
        );
      continue;
    }
    if (rule === 'ADAPT_DELOAD_LONG') {
      push(
        `Rasterećenje (${weeks.length === 1 ? 'nedelja' : 'nedelje'} ${weekList(weeks)}): dugi je kraći nego obično, da lagani treninzi ostanu bar 3 km.`
      );
      continue;
    }
    push(warnText(vs[0]!.message));
  }
  return out;
}
