/* HM-09 stavka 10 (Z2) — tekst za korisnika: napomene nedelja (fokus), napomene i upozorenja plana (dayWarnings),
   razlozi adaptacije i odbijanja. Broji poruke sa internom oznakom (H7, A5, pouka N …), decimalnom tačkom, km sa
   > 1 decimalom i „..". „sirovo" = tekst jezgra; „korisnik" = tekst kakav aplikacija prikazuje (app/plan.ts,
   app/adapt.ts, app/generate.ts — userText). Ulazi: svaki k-ti plan mreža 02/03/početnik + adaptBases × scenariji
   mreže 04 (asOf kraj ned 2 i sreda ned 6). Bez slučajnosti.
   Iz web/: node ../docs/hm-v2/artifacts/segment-09/hm-usertext.ts [k=40] */
const V2 = '../../../../web/src/domain/generators/halfMarathon/v2';
const { generateHmV2 } = await import(`${V2}/generate.ts`);
const { adaptHmV2 } = await import(`${V2}/adapt.ts`);
const { addDays } = await import(`${V2}/dates.ts`);
const T = await import(`${V2}/testInputs.ts`);
const A = await import(`${V2}/adaptInputs.ts`);
const { generatedPlan } = await import(`${V2}/app/plan.ts`);
let UT: ((s: string) => string) | null = null;
try { UT = (await import(`${V2}/userText.ts`)).userText; } catch { UT = null; }
const K = Number(process.argv[2] ?? 40);
const LABEL = /\b(?:[Pp]ouk[aeiu]|[Uu]slov)\s+\d+|\b(?:HI|H|A|M|N|K|D|F|Z)\d+(?:\.\d+)?[a-z]?\b|\bHM-\d+/;
const bad = (s: string) => ({ label: LABEL.test(s), dot: /\d\.\d/.test(s), km2: /\d[.,]\d{2,}\s*km\b/.test(s), dd: /(?<!\.)\.\.(?!\.)/.test(s) });
const o = { texts: 0, raw: { label: 0, dot: 0, km2: 0, dd: 0 }, user: { label: 0, dot: 0, km2: 0, dd: 0 }, ex: [] as string[] };
const count = (raw: string, user: string) => {
  o.texts++;
  const r = bad(raw), u = bad(user);
  for (const k of Object.keys(r) as (keyof typeof r)[]) { if (r[k]) o.raw[k]++; if (u[k]) o.user[k]++; }
  if ((u.label || u.dot || u.km2 || u.dd) && o.ex.length < 8) o.ex.push(user);
};
const planTexts = (p: any) => {
  const g: any = generatedPlan(p);
  // fokus nedelje (app) ↔ sirove napomene nedelje
  p.weeks.forEach((w: any, i: number) => {
    const raw = w.notes.filter((n: string) => !n.includes('nije izvodljiv u konstrukciji nedelje')).join(' ');
    count(raw, g.weeks[i].focus);
  });
  const rawW = [...p.notes, ...p.warnings.map((v: any) => v.message)];
  const userW: string[] = (g.meta as any).dayWarnings ?? [];
  rawW.forEach((t: string, i: number) => count(t, userW[i] ?? t));
};
const bases = [...T.grid02Inputs(), ...T.feelInputs(), ...T.beginnerInputs()].filter((_, i) => i % K === 0);
for (const b of bases) { const g: any = generateHmV2(b.input); if (g.ok) planTexts(g.plan); else for (const r of g.reasons) count(r.message, UT ? UT(r.message) : r.message); }
for (const b of A.adaptBases()) {
  const g: any = generateHmV2(b.input); if (!g.ok) continue;
  for (const at of [g.plan.weeks[1].endDate, addDays(g.plan.weeks[5].startDate, 2)])
    for (const s of A.SCENARIOS) {
      const a: any = adaptHmV2(g.plan, A.factsOf(g.plan, s, at), at);
      if (!a.ok) { for (const r of a.reasons) count(r.message, UT ? UT(r.message) : r.message); continue; }
      planTexts(a.plan);
      for (const r of a.reasons) count(r.message, UT ? UT(r.message) : r.message);
    }
}
console.log(JSON.stringify({ k: K, texts: o.texts, raw: o.raw, user: o.user }, null, 1));
for (const e of o.ex) console.log('  ' + e.slice(0, 300));
