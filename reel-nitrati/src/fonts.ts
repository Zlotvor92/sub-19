import {continueRender, delayRender, staticFile} from 'remotion';

const LATIN =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

const faces: Array<{family: string; file: string; weights: number[]}> = [
  {family: 'Inter', file: 'inter', weights: [400, 500, 600, 700, 800]},
  {family: 'Barlow Condensed', file: 'barlow-condensed', weights: [500, 600, 700, 800]},
];

let loaded = false;

export const ensureFonts = () => {
  if (loaded || typeof document === 'undefined') {
    return;
  }
  loaded = true;
  const css = faces
    .flatMap(({family, file, weights}) =>
      weights.flatMap((w) => [
        `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:block;src:url(${staticFile(
          `fonts/${file}-latin-${w}-normal.woff2`,
        )}) format("woff2");unicode-range:${LATIN};}`,
        `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:block;src:url(${staticFile(
          `fonts/${file}-latin-ext-${w}-normal.woff2`,
        )}) format("woff2");unicode-range:${LATIN_EXT};}`,
      ]),
    )
    .join('\n');
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const handle = delayRender('Učitavanje fontova');
  const probes = faces.flatMap(({family, weights}) =>
    weights.flatMap((w) => [
      document.fonts.load(`${w} 40px "${family}"`, 'AaČćŠšŽžĐđ'),
      document.fonts.load(`${w} 40px "${family}"`, 'Aa'),
    ]),
  );
  Promise.all(probes)
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
};
