import React from 'react';
import {Composition, Still} from 'remotion';
import {ensureFonts} from './fonts';
import {Reel} from './Reel';
import {Cover} from './Cover';
import timeline from './timeline.json';

ensureFonts();

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="NitratiReel" component={Reel} durationInFrames={timeline.durationInFrames} fps={30} width={1080} height={1920} defaultProps={{subtitles: true}} />
    <Still id="Cover" component={Cover} width={1080} height={1920} />
  </>
);
