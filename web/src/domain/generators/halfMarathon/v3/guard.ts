/* ČUVAR BEZBEDNOSTI — 9 provera, samo prijavljuje (ništa ne menja). */
import type { Scale } from './scale.ts';
import type { Finding, PlanDoc } from './types.ts';

const TOL = 0.6; // km/min zaokruživanja

export function guard(doc: PlanDoc, s: Scale): Finding[] {
  const out: Finding[] = [];
  const add = (check: string, week: number | null, message: string): void => {
    out.push({ check, week, message });
  };
  const { weeks, input } = doc;
  const capOf = { T: s.caps.T, I: s.caps.I, RP: s.caps.RP, R: 12, H: 12 } as Record<string, number>;
  let prevBuild: number | null = null;
  const peak = weeks.find((w) => w.kind === 'peak');

  for (const w of weeks) {
    const long = w.days.find((d) => d.session.kind === 'long')?.session;
    for (const d of w.days) {
      const x = d.session;
      // 1. plafon minuta rada po treningu
      if (x.kind === 'quality' && x.zone && x.workMin > (capOf[x.zone] ?? 99) + 1.5)
        add(
          'dose-cap',
          w.index,
          `${d.date}: ${x.zone} ${Math.round(x.workMin)} min > plafon ${Math.round(capOf[x.zone]!)}`
        );
      if (
        x.kind === 'long' &&
        x.zone === 'RP' &&
        x.segments[1] &&
        x.segments[1].km > s.blockMaxKm + 0.01
      )
        add(
          'dose-cap',
          w.index,
          `${d.date}: blok RP u dugom ${x.segments[1].km} km > ${s.blockMaxKm}`
        );
      // 2. prazan ili prekratak trening
      if (x.kind !== 'race' && (!(x.km > 0) || x.min < 15 || !x.text))
        add('empty', w.index, `${d.date}: prazan ili prekratak trening`);
      // 3. lagan ≤ dugi; dan pred dugi ≤ 50 % dugog
      if (long && x.kind === 'easy' && x.km > long.km + 0.05)
        add('easy-long', w.index, `${d.date}: lagan ${x.km} km > dugi ${long.km} km`);
    }
    // 4. satni plafon nedelje (kad trkač već nije iznad njega)
    if (
      s.hourCapMin &&
      w.totalMin > s.hourCapMin + 10 &&
      (input.weeklyKm * doc.paces.easy) / 60 < s.hourCapMin
    )
      add('hours', w.index, `${w.totalMin} min > satni plafon ${s.hourCapMin} min`);
    // 5. nedeljni skok obima (ne-rasteretne nedelje gradnje)
    const recent = weeks
      .filter((y) => y.index < w.index && y.index >= w.index - 3)
      .map((y) => y.plannedKm);
    if (w.index <= 3) recent.push(input.weeklyKm); // stvarno skorašnje opterećenje trkača
    prevBuild = recent.length ? Math.max(...recent) : null;
    if ((w.kind === 'build' || w.kind === 'peak') && prevBuild !== null)
      if (w.plannedKm > prevBuild + Math.max(s.stepCap(prevBuild), 2) + TOL * 2)
        add(
          'jump',
          w.index,
          `skok ${prevBuild} → ${w.plannedKm} km (najviše u poslednje 3 nedelje)`
        );
    // 6. nedelja ne ispod smislenog minimuma (sem trkačke)
    if (w.kind !== 'race' && w.plannedKm < Math.min(0.5 * input.weeklyKm, 0.4 * doc.peakKm) - TOL)
      add('min-week', w.index, `${w.plannedKm} km je ispod smislenog minimuma`);
    if (w.kind !== 'race' && w.days.length < Math.min(3, input.runDays.length))
      add('min-week', w.index, `samo ${w.days.length} treninga`);
    // 10. udeo brzog rada (T, I, R, RP, blok) u vremenu nedelje ≤ 22 %, najteža nedelja ≤ 25 %
    if (w.totalMin > 0 && w.workMin / w.totalMin > (w.kind === 'peak' ? 0.25 : 0.22))
      add(
        'fast-share',
        w.index,
        `${Math.round((100 * w.workMin) / w.totalMin)} % vremena u brzom radu`
      );
    // 7. taper i trkačka nedelja u minutima rada
    if (peak && w.kind === 'taper' && w.workMin > 0.6 * peak.workMin + 1)
      add('taper', w.index, `taper ${w.workMin} min rada > 60 % najteže (${peak.workMin})`);
    if (w.kind === 'race' && (w.workMin < 5.5 || w.workMin > 12.5))
      add('taper', w.index, `trkačka nedelja ${w.workMin} min rada (očekivano 6–12)`);
  }
  // 8. trka poslednja, jedna, na datum trke
  const all = weeks.flatMap((w) => w.days);
  const races = all.filter((d) => d.session.kind === 'race');
  if (
    races.length !== 1 ||
    all[all.length - 1]?.session.kind !== 'race' ||
    races[0]?.date !== input.raceDate
  )
    add('race-last', null, 'trka nije jedina, poslednja ili nije na datum trke');
  // 9. svaka ne-trkačka nedelja ima dugi (osim kad ga zamenjuje pripremna trka)
  for (const w of weeks)
    if (
      w.kind !== 'race' &&
      !w.days.some((d) => d.session.kind === 'long' || d.session.kind === 'check')
    )
      add('long', w.index, 'nedelja bez dugog');
  return out;
}
