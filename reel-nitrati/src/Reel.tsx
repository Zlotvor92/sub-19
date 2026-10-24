import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import timeline from './timeline.json';
import {Subtitles} from './components/Subtitles';
import {S1Hook} from './scenes/S1Hook';
import {S2Source} from './scenes/S2Source';
import {S3Pathway} from './scenes/S3Pathway';
import {S4Economy} from './scenes/S4Economy';
import {S5Limits} from './scenes/S5Limits';
import {S6Dose} from './scenes/S6Dose';
import {S7Practical} from './scenes/S7Practical';
import {S8Outro} from './scenes/S8Outro';
import {C} from './theme';

const SCENES: Record<number, React.FC> = {1: S1Hook, 2: S2Source, 3: S3Pathway, 4: S4Economy, 5: S5Limits, 6: S6Dose, 7: S7Practical, 8: S8Outro};

export const Reel: React.FC<{subtitles?: boolean}> = ({subtitles = true}) => (
  <AbsoluteFill style={{background: C.graphite}}>
    {timeline.scenes.map((s) => {
      const Comp = SCENES[s.id];
      return Comp ? (
        <Sequence key={s.id} from={s.from} durationInFrames={s.durationInFrames} name={`Scena ${s.id}`}>
          <Comp />
        </Sequence>
      ) : null;
    })}
    {subtitles ? <Subtitles /> : null}
  </AbsoluteFill>
);
