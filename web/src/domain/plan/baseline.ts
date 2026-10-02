/* POLAZNA FORMA PLANA: od nje kreće lanac forme (`vdotLog`) i ona se prikazuje kao „početni VDOT".

   Obično je to `meta.vdot0`. Posle rekalibracije (`planRecalibrated`) `meta.vdot0` postaje VIRTUELNA polazna tačka putanje (ona koja
   daje formu na tekućoj nedelji), pa bi lanac menjao celu prošlost; zato rekalibracija upisuje stvarnu polaznu formu u `meta.vdotBase`
   i SVE što čita polaznu formu ide kroz ovu funkciju. Planovi bez `vdotBase` (svi napravljeni pre rekalibracije) vraćaju `vdot0`. */

const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

export function planBaselineVdot(
  meta: Readonly<Record<string, unknown>> | null | undefined
): number | null {
  if (!meta) return null;
  if (fin(meta['vdotBase'])) return meta['vdotBase'];
  return fin(meta['vdot0']) ? meta['vdot0'] : null;
}
