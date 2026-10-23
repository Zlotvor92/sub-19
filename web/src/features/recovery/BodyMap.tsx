import { memo } from 'react';
import { painClass, partLevel, partName } from '../../domain/recovery';
import type { IsoDate } from '../../domain/date';
import type { PainRecord } from '../../domain/state';
import { BODY_ZONES, type BodyFigure, type BodyView } from './bodyZones';
import mFront from './body/m-front.webp';
import mBack from './body/m-back.webp';
import fFront from './body/f-front.webp';
import fBack from './body/f-back.webp';

export type { BodyFigure, BodyView };

const IMAGES: Readonly<Record<`${BodyFigure}-${BodyView}`, string>> = {
  'm-front': mFront,
  'm-back': mBack,
  'f-front': fFront,
  'f-back': fBack
};

/* MAPA TELA: slika muškarca ili žene (spreda / otpozadi) i preko nje nevidljive zone za dodir. Spreda je leva strana slike DESNA strana tela
   (gledaš osobu spreda), otpozadi leva strana slike LEVA strana tela. Bol se crta kao meka obojena mrlja u obliku zone, utopljena u kožu; bez
   unosa zona se ne vidi. */
export const BodyMap = memo(function BodyMap({
  view,
  figure = 'm',
  pain,
  today,
  onPart
}: {
  view: BodyView;
  figure?: BodyFigure;
  pain: readonly PainRecord[];
  today: IsoDate;
  onPart: (part: string) => void;
}) {
  const key = `${figure}-${view}` as const;
  const set = BODY_ZONES[key];
  return (
    <div className="bodymap" style={{ aspectRatio: `${set.w} / ${set.h}` }}>
      <img className="bodymap-img" src={IMAGES[key]} alt="" draggable={false} />
      <svg viewBox={`0 0 ${set.w} ${set.h}`} className="bodymap-svg">
        <defs>
          <filter id="bp-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        {set.zones.map(({ id, d }) => {
          const lv = partLevel(pain, id, today);
          const cls = painClass(lv);
          return cls ? (
            <path key={`s-${id}`} className={`bp-spot ${cls}`} d={d} filter="url(#bp-soft)" />
          ) : null;
        })}
        {set.zones.map(({ id, d }) => {
          const lv = partLevel(pain, id, today);
          return (
            <path
              key={id}
              className={`bp ${painClass(lv)}`.trim()}
              data-bp={id}
              d={d}
              role="button"
              tabIndex={0}
              aria-label={`${partName(id)}${lv != null ? ` — bol ${lv}` : ''}`}
              onClick={() => onPart(id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPart(id);
                }
              }}
            >
              <title>
                {partName(id)}
                {lv != null ? ` — bol ${lv}` : ''}
              </title>
            </path>
          );
        })}
      </svg>
    </div>
  );
});
