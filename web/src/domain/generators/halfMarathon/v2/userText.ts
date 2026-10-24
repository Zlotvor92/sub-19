/* Z2 (HM-09) — JEDINO mesto teksta jezgra za korisnika: napomene nedelja i plana, upozorenja, razlozi adaptacije i
   odbijanja kakve aplikacija prikazuje. Plan i validator i dalje nose tehničke oznake (H7, A5, pouka 32 …): to su
   markeri pravila (validator čita napomene) i referenca politike. Korisnik vidi tekst bez internih oznaka, sa
   decimalnim zarezom, km na najviše 1 decimalu i bez „..". */

/** Interna oznaka politike: pouka/pouke/pouci N, Uslov N, H/HI/A/M/N/K/D/F/Z + broj, HM-NN, MASTER § N. */
const LABEL =
  /\b(?:[Pp]ouk[aeiu]|[Uu]slov)\s+\d+[a-z]?(?:\s*(?:i|,)\s*\d+[a-z]?)*\b|\b(?:HI|H|A|M|N|K|D|F|Z)\d+(?:\.\d+)?[a-z]?\b|\bHM-\d+[a-z]?\b|MASTER\s*§\s*\d+|\b[Ss]egment(?:a|u)?\s+\d+[a-z]?\b|\bFaz[aei]\s+4a\b/;
const LABEL_G = new RegExp(LABEL.source, 'g');

/** Delovi zagrade na najvišem nivou (separator „, " ili „;" van ugnježdene zagrade; „1,1" nije separator). */
function topParts(inner: string): { part: string; sep: string }[] {
  const out: { part: string; sep: string }[] = [];
  let depth = 0;
  let cur = '';
  let sep = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!;
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    const next = inner[i + 1] ?? '';
    if (depth === 0 && (ch === ';' || (ch === ',' && /\s/.test(next)))) {
      out.push({ part: cur, sep });
      sep = ch;
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push({ part: cur, sep });
  return out;
}

/** Zagrada (do jednog nivoa ugnježdenja): delovi sa internom oznakom otpadaju; prazna zagrada otpada. */
function stripParens(s: string): string {
  return s.replace(/\s*\(((?:[^()]|\([^()]*\))*)\)/g, (all, inner: string) => {
    const parts = topParts(inner);
    const keep = parts.filter((x) => x.part.trim() !== '' && !LABEL.test(x.part));
    if (keep.length === parts.length) return all;
    if (keep.length === 0) return '';
    return ` (${keep.map((x, i) => (i === 0 ? x.part.trim() : `${x.sep} ${x.part.trim()}`)).join('')})`;
  });
}

/** F1 (04-final): tehnički izrazi → šta znače za trkača. Redosled je bitan (duži izraz pre kraćeg). */
const PLAIN: readonly [RegExp, string][] = [
  [
    /dugi ≤ max\(1,1 × najduži, najduži \+ 1 km\) prethodne 4 nedelje/g,
    'dugi raste najviše 10 % ili 1 km iznad najdužeg u prethodne 4 nedelje'
  ],
  [
    /dugi ≤ max\(1,1 × najduži, najduži \+ 1 km\)/g,
    'dugi raste najviše 10 % ili 1 km iznad najdužeg'
  ],
  [/max\(10 %, 1 km\)/g, '10 % ili 1 km'],
  [/0,8 × poslednj(?:i|eg) ne-rasteretn(?:i|og)/g, '80 % poslednjeg dugog pre rasterećenja'],
  [/ne-rasteretn(?:a|e) nedelj(a|e) izgradnje/g, 'nedelj$1 izgradnje koja nije rasterećenje'],
  [/ne-rasteretn\w*/g, 'pre rasterećenja'],
  [/≤ 0,6 × najduži/g, 'najviše 60 % najdužeg'],
  [/lagane ≤ 0,8 × dugi/g, 'lagani najviše 80 % dugog'],
  [/\s*\(plafon zone[^)]*\)/g, ''],
  [
    /uz „doza ne pada" i plafon/g,
    'jer doza ne sme da padne, a viša bi prešla dozvoljen udeo nedeljnog obima'
  ],
  [/ne staje u plafon (\d+) %(?: cilja)?/g, 'bi prešao $1 % nedeljnog obima'],
  [
    /\bni ([^;—]+?) ni ([^;—]+?) ne staju u plafon(?: cilja)?/g,
    'i $1 i $2 bi prešli dozvoljen udeo nedeljnog obima'
  ],
  [/ne staju u plafon (\d+) %(?: cilja)?/g, 'bi prešli $1 % nedeljnog obima'],
  [/ne staju u plafon(?: cilja)?/g, 'bi prešli dozvoljen udeo nedeljnog obima'],
  [/ne staje u plafon(?: cilja)?/g, 'bi prešao dozvoljen udeo nedeljnog obima'],
  [/staje u plafon(?: zone)?/g, 'staje u dozvoljen udeo nedeljnog obima'],
  [/\bni ([^;—]+?) bi preša(o|li) /g, 'čak i $1 bi preša$2 '],
  [/\s*\(odstupanje\)/g, ''],
  [/,\s*odstupanje\)/g, ')'],
  [
    /Cilj po pravilu (\S+) km nije izvodljiv u konstrukciji nedelje; nedelja ide na najbliži izvodljiv cilj (\S+) km/g,
    'Planirani obim $1 km ne može da se rasporedi na dane treninga; nedelja ima $2 km'
  ],
  [/obim po pravilu/g, 'obim po planu'],
  [/T cruise/g, 'T deonice'],
  [/ HM v2 podržava/g, ' Plan polumaratona podržava'],
  [/HM v2 radi/g, 'plan polumaratona radi'],
  [/HM v2 plan/g, 'plan polumaratona'],
  [/≤ RP doza tapera/g, 'ne više od RP u taperu'],
  [/trkačka ≤ taper/g, 'trkačka nedelja nije veća od tapera'],
  [
    /doza spuštena (\d+) → (\d+) m \(plafon, nijedan cilj nije izvodljiv bez toga\)/g,
    'doza smanjena sa §$1§ na §$2§ km (viša bi prešla dozvoljen udeo nedeljnog obima)'
  ],
  [/\bT_cruise\b/g, 'T deonice'],
  [/\bT_continuous\b/g, 'T kontinuirano'],
  [/\b[qQ]1:/g, 'Prvi kvalitetni trening:'],
  [/\b[qQ]2:/g, 'Drugi kvalitetni trening:'],
  [/\b(R|I|T|RP) (\d{4,}) m\b/g, '$1 §$2§ km']
];

/** Tekst jezgra za korisnika (Z2, F1). */
export function userText(s: string): string {
  let t = stripParens(s);
  // Oznaka van zagrade („H11 ispred H7", „— pouka 32") — sa veznikom ispred/kao.
  t = t
    .replace(
      new RegExp(
        `\\s*(?:—\\s*)?(?:kao\\s+)?(?:${LABEL.source})(?:\\s+ispred\\s+(?:${LABEL.source}))*`,
        'g'
      ),
      ''
    )
    .replace(LABEL_G, '');
  for (const [re, to] of PLAIN) t = t.replace(re, to);
  // Doza zone u metrima → km (§N§ iz PLAIN).
  t = t.replace(/§(\d+)§/g, (_, m: string) => (Number(m) / 1000).toFixed(1));
  // km: najviše 1 decimala; decimalni zarez.
  t = t.replace(/(\d+)[.,](\d{2,})(?=\s*km\b)/g, (_, a: string, b: string) =>
    Number(`${a}.${b}`).toFixed(1)
  );
  t = t.replace(/(\d)\.(\d)/g, '$1,$2');
  return t
    .replace(/[,;]\s*\)/g, ')')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([.,:;])(?!\d)/g, '$1')
    .replace(/([:;,])(?=[.,])/g, '')
    .replace(/(?<!\.)\.\.(?!\.)/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Test (Z2): tekst još nosi internu oznaku. */
export const hasInternalLabel = (s: string): boolean => LABEL.test(s);
