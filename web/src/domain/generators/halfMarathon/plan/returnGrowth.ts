import { r1 } from '../format';
import type { Week } from '../training/types';

/** Conservative return heuristic: a quality minimum must not defeat the volume ceiling. */
export function guardReturnGrowth(
  weeks: readonly Week[],
  actualBaseKm: number,
  skipPartialFirst = false
): Week[] {
  let establishedVolume = actualBaseKm;
  return weeks.map((w, i) => {
    if (skipPartialFirst && i === 0) return w;
    const limit = establishedVolume * 1.08;
    let days = w.days;
    if (w.vol > limit + 0.1) {
      const factor = limit / w.vol;
      days = w.days.map((d) => {
        if (d.km == null || d.rest || d.tag === 'trka') return d;
        const km = Math.floor(d.km * factor * 10) / 10;
        // Converting the entire excessive session keeps distance, dose and text coherent.
        if (d.session)
          return {
            dow: d.dow,
            tag: 'lako' as const,
            km,
            desc: `${km} km lako · Povratak: kvalitet je odložen dok obim ne podrži celu sesiju.`
          };
        const { finish: _finish, strides: _strides, ...easy } = d;
        return {
          ...easy,
          km,
          desc: `${km} km ${d.tag === 'lr' ? 'dužina' : 'lako'} · Postepen povratak posle pauze.`
        };
      });
    }
    const vol = r1(days.reduce((n, d) => n + (d.km ?? 0), 0));
    if (!w.deload && !w.taper) establishedVolume = vol;
    return { ...w, days, vol };
  });
}
