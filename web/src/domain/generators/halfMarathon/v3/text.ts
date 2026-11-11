/* Ispis PlanDoc-a u čitljiv tekst (format nalik P9 ispisu koji trener ocenjuje). */
import { fmtShort, parseIso } from './dates.ts';
import { fmtDuration, fmtPace, fmtTime } from './paces.ts';
import type { PlanDoc, Weekday } from './types.ts';

const DAY_NAME: Record<Weekday, string> = {
  mon: 'Ponedeljak',
  tue: 'Utorak',
  wed: 'Sreda',
  thu: 'Četvrtak',
  fri: 'Petak',
  sat: 'Subota',
  sun: 'Nedelja'
};
const SHORT: Record<Weekday, string> = {
  mon: 'pon',
  tue: 'uto',
  wed: 'sre',
  thu: 'čet',
  fri: 'pet',
  sat: 'sub',
  sun: 'ned'
};
const km = (x: number): string => (Math.round(x * 10) / 10).toFixed(1).replace('.', ',');
const LINE = '-'.repeat(60);

export function renderText(doc: PlanDoc, title?: string): string {
  const i = doc.input;
  const p = doc.paces;
  const o: string[] = [];
  o.push(`PLAN — polumaraton · ${doc.policyId}-${doc.policyVersion}`);
  if (title) o.push(`Profil: ${title}`);
  o.push('');
  o.push(`Početak: ${i.startDate} (${doc.weeks.length} nedelja), trka: ${i.raceDate}.`);
  o.push(
    `Dani trčanja: ${i.runDays.map((d) => SHORT[d]).join(', ')}; dugi trk: ${SHORT[i.longRunDay]}.`
  );
  o.push(`Trenutni obim: ${i.weeklyKm} km nedeljno.${i.beginner ? ' Početnik.' : ''}`);
  if (i.recentResult)
    o.push(
      `Skorašnji rezultat: ${km(i.recentResult.distanceM / 1000)} km za ${fmtTime(i.recentResult.timeSec)}.`
    );
  else o.push(`Bez skorašnjeg rezultata; lagan tempo ${fmtPace(i.easyPaceSecPerKm!)}/km.`);
  if (i.recentLongRunKm) o.push(`Skorašnje najduže trčanje: ${i.recentLongRunKm} km.`);
  if (i.goalTimeSec) o.push(`Ciljno vreme: ${fmtTime(i.goalTimeSec)}.`);
  o.push('', '='.repeat(60), '', 'TEMPO ZONE (min/km)');
  const zones = `lagano ${fmtPace(p.easyFast)}–${fmtPace(p.easySlow)} · T (prag) ${fmtPace(p.T)} · I (interval) ${fmtPace(p.I)} · R ${fmtPace(p.R)} · tempo trke ${fmtPace(p.RP)}`;
  o.push(
    p.estimated
      ? `  procena iz laganog tempa (VDOT ≈ ${p.vdot.toFixed(1)}): ${zones}`
      : `  ${zones}`
  );
  if (!p.estimated)
    o.push(
      `  VDOT ${p.vdot.toFixed(1)} · prognoza ${fmtTime(p.predictionSec)}${p.racePace < p.RP - 0.5 ? ` · tempo trke na dan trke ${fmtPace(p.racePace)} (cilj)` : ''}`
    );
  o.push(`  vrh obima ${km(doc.peakKm)} km · najduži dugi ${km(doc.longMaxKm)} km`);
  if (doc.recommendations.length || doc.notes.length) {
    o.push('', 'PREPORUKE I NAPOMENE PLANA');
    for (const r of [...doc.recommendations, ...doc.notes]) o.push(`  • ${r}`);
  }
  for (const w of doc.weeks) {
    o.push('', LINE, `NEDELJA ${w.index} — faza: ${w.label}`);
    const s = parseIso(w.startDate)!;
    const race = w.days.some((d) => d.session.kind === 'race');
    o.push(
      `  ${fmtShort(s)}–${fmtShort(s + 6)} · cilj ${km(w.targetKm)} km · planirano ${km(w.plannedKm)} km${race ? ' + trka' : ''} · ukupno ${fmtDuration(w.totalMin)} · rad ${w.workMin} min`
    );
    for (const d of w.days) {
      const x = d.session;
      o.push(`  ${DAY_NAME[d.weekday].padEnd(10)} ${fmtShort(parseIso(d.date)!)}  ${x.text}`);
      if (x.kind !== 'race')
        o.push(
          `      ${km(x.km)} km · ${fmtDuration(x.min)}${x.workMin >= 1 ? ` · radnih ${Math.round(x.workMin)} min` : ''}${x.note ? ` · ${x.note}` : ''}`
        );
    }
    for (const n of w.notes) o.push(`  Napomena: ${n}`);
  }
  // nalazi čuvara su interni (PlanDoc.guard); korisniku se prikazuju samo ako postoje
  if (doc.guard.length) {
    o.push('', '='.repeat(60), 'PROVERE PLANA');
    for (const f of doc.guard) o.push(`  ${f.week ? `ned ${f.week}: ` : ''}${f.message}`);
  }
  return o.join('\n') + '\n';
}
