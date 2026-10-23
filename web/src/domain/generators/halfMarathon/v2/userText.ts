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

/** Tekst jezgra za korisnika (Z2). */
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
