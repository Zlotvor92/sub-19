/* Ugao 4, 10K v2 — „koji broj dana nosi obim" ima tri definicije:
   (1) input.ts:203/214–231 — red D17/D28 sa SIROVIM obimom (km < kmMin / km > kmMax → odbijanje);
   (2) volume.ts:48 fewerDaysAdvice — red sa obimom ZAOKRUŽENIM na 0,1 km (to10), poruka D25 (validate.ts:637);
   (3) volume.ts:21 capacityMessage — „više dana" bez provere reda (samo postojanje broja dana), poruka D22.
   Merenje: (a) iscrpno 0,01 km × dani × iskustvo: preporuka (2) koju ulaz (1) odbija; (b) mreža grid02 + početnik +
   po osećaju (testInputs.ts) i mreža sa obimom x,0y: poruke LONG_SHORTER_THAN_QUALITY / CAPACITY_LIMITED čija
   preporuka vodi u odbijanje ulaza. Bez slučajnosti (pune mreže). Iz web/:
   node ../docs/generators-v2/audit/owner/tenK-advice.ts */

const V2 = '../../../../web/src/domain/generators/tenK/v2';
const { planRule } = await import(`${V2}/policy.ts`);
const { fewerDaysAdvice } = await import(`${V2}/volume.ts`);
const { checkInput } = await import(`${V2}/input.ts`);
const { generateTenKV2 } = await import(`${V2}/generate.ts`);
const T = await import(`${V2}/testInputs.ts`);

const daysOf = (n: number) => T.SCHEDULES_BY_DAYS[n as 3 | 4 | 5 | 6].A;
const kmRejected = (n: number, km: number, beginner: boolean): boolean => {
  const sc = daysOf(n);
  const inp = { ...T.inputOf({ weeks: 12, km, vdot: 45, days: sc.days, long: sc.long }), ...(beginner ? { experience: 'beginner' } : {}) };
  const c = checkInput(inp);
  return !c.ok && c.reasons.some((r: { code: string }) => r.code.startsWith('WEEKLY_KM'));
};
const parseDays = (msg: string): number[] => {
  const m = /preporuka (\d)(?:–(\d))? dana/.exec(msg);
  if (!m) return [];
  const a = +m[1]!, b = m[2] ? +m[2] : a;
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
};

// (a) iscrpno
let n = 0, bad = 0;
const ex: unknown[] = [];
for (const beginner of [false, true])
  for (const days of beginner ? [3, 4] : [3, 4, 5, 6]) {
    const rule = planRule(days, beginner ? 'beginner' : 'regular');
    for (let k = 1000; k <= 9000; k++) {
      const km = k / 100;
      if (kmRejected(days, km, beginner)) continue; // plan sa ovim brojem dana ne postoji
      const adv = fewerDaysAdvice(days, km, rule);
      if (!adv) continue;
      n++;
      const wrong = parseDays(adv).filter((d) => kmRejected(d, km, beginner));
      if (wrong.length) {
        bad++;
        if (ex.length < 6) ex.push({ beginner, days, km, preporuka: parseDays(adv), odbija: wrong });
      }
    }
  }
console.log(`(a) fewerDaysAdvice: ${n} (dani, obim) sa preporukom; preporuka odbijena ulazom: ${bad}`, JSON.stringify(ex));

// (b) kraj-na-kraj: poruke planova.
const cases: { id: string; input: Record<string, unknown> }[] = [
  ...([3, 4, 5, 6] as const).flatMap((d) => T.grid02Inputs(d)),
  ...([3, 4] as const).flatMap((d) => T.beginnerGridInputs(d)),
  ...([3, 4, 5, 6] as const).flatMap((d) => T.feelGridInputs(d))
];
// Mreža obima x,0y na granicama redova (realan unos iz čarobnjaka: slobodan broj).
for (const days of [4, 5, 6] as const)
  for (const km of [40.01, 40.02, 40.04, 55.01, 55.04, 65.01, 65.04])
    for (const vdot of [35, 45, 55])
      for (const weeks of [8, 12, 16]) {
        const sc = daysOf(days);
        cases.push({ id: `x-d${days}-${weeks}w-${km}km-v${vdot}`, input: T.inputOf({ weeks, km, vdot, days: sc.days, long: sc.long }) });
      }
const stat: Record<string, { plans: number; msgs: number; bad: number; ex: string[] }> = {};
let gen = 0;
for (const c of cases) {
  const r = generateTenKV2(c.input);
  if (!r.ok) continue;
  gen++;
  const beginner = c.input['experience'] === 'beginner';
  const km = c.input['currentWeeklyKm'] as number;
  for (const w of r.plan.warnings as { rule: string; message: string }[]) {
    if (w.rule !== 'LONG_SHORTER_THAN_QUALITY' && w.rule !== 'CAPACITY_LIMITED') continue;
    const s = (stat[w.rule] ??= { plans: 0, msgs: 0, bad: 0, ex: [] });
    s.plans++;
    const rec = parseDays(w.message);
    if (rec.length === 0) continue;
    s.msgs++;
    const wrong = rec.filter((d) => kmRejected(d, km, beginner));
    if (wrong.length) {
      s.bad++;
      if (s.ex.length < 4) s.ex.push(`${c.id}: „…${w.message.slice(w.message.indexOf('preporuka'), w.message.indexOf('preporuka') + 20)}…" odbija ${wrong.join(',')} dana`);
    }
  }
}
console.log(`(b) ulaza ${cases.length}, planova ${gen}`);
for (const [k, s] of Object.entries(stat))
  console.log(`  ${k}: planova sa porukom ${s.plans}, sa preporukom dana ${s.msgs}, preporuka vodi u odbijanje ulaza ${s.bad}`, JSON.stringify(s.ex));
