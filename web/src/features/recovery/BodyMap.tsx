import { memo } from 'react';
import { painClass, partLevel, partName } from '../../domain/recovery';
import type { IsoDate } from '../../domain/date';
import type { PainRecord } from '../../domain/state';
import * as P from './bodyPaths';

export type BodyView = 'front' | 'back';

/* Prednji pogled: leva strana ekrana = DESNA strana tela (gledaš osobu spreda). Zadnji pogled: leva strana ekrana = LEVA strana
   tela. Delovi se definišu za levu stranu ekrana i ogledaju. */
const arm = (s: 'L' | 'D'): Array<[string, string]> => [
  [`rame-${s}`, P.BODY_DELT],
  [`nadlaktica-${s}`, P.BODY_UPARM],
  [`podlaktica-${s}`, P.BODY_FOARM],
  [`saka-${s}`, P.BODY_HAND]
];
const frontLeg = (s: 'L' | 'D'): Array<[string, string]> => [
  [`kuk-${s}`, P.BODY_HIP],
  [`kvadriceps-${s}`, P.BODY_QUAD],
  [`koleno-${s}`, P.BODY_KNEE],
  [`potkolenica-${s}`, P.BODY_SHIN],
  [`stopalo-${s}`, P.BODY_FOOT]
];
const backLeg = (s: 'L' | 'D'): Array<[string, string]> => [
  [`gluteus-${s}`, P.BODY_GLUTE],
  [`zadnja-loza-${s}`, P.BODY_HAM],
  [`koleno-${s}`, P.BODY_KNEE],
  [`list-${s}`, P.BODY_CALF],
  [`ahilova-${s}`, P.BODY_ACHIL],
  [`peta-${s}`, P.BODY_HEEL]
];

/** Sastav silueta: [deo, putanja] bez ogledanja i sa ogledanjem (druga strana tela). */
export function bodyLayout(view: BodyView): {
  plain: Array<[string, string]>;
  mirrored: Array<[string, string]>;
} {
  const head: Array<[string, string]> = [
    ['glava', P.BODY_HEAD],
    ['vrat', P.BODY_NECK]
  ];
  if (view === 'front')
    return {
      plain: [
        ...head,
        ['grudi', P.BODY_F_CHEST],
        ['trbuh', P.BODY_F_ABS],
        ['prepone', P.BODY_F_GROIN],
        ...arm('D'),
        ...frontLeg('D')
      ],
      mirrored: [...arm('L'), ...frontLeg('L')]
    };
  return {
    plain: [
      ...head,
      ['gornja-ledja', P.BODY_B_UP],
      ['donja-ledja', P.BODY_B_LO],
      ...arm('L'),
      ...backLeg('L')
    ],
    mirrored: [...arm('D'), ...backLeg('D')]
  };
}

export const BodyMap = memo(function BodyMap({
  view,
  pain,
  today,
  onPart
}: {
  view: BodyView;
  pain: readonly PainRecord[];
  today: IsoDate;
  onPart: (part: string) => void;
}) {
  const { plain, mirrored } = bodyLayout(view);
  const part = ([id, d]: [string, string]) => {
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
  };
  return (
    <svg viewBox="0 0 200 470" className="bodymap">
      {plain.map(part)}
      <g transform={P.MIRROR}>{mirrored.map(part)}</g>
    </svg>
  );
});
