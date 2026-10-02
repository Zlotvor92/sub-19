/* IKONA APLIKACIJE „2○" — jedan izvor za sve veličine.
   Znak: cifra 2 i nula kao prsten štoperice sa neslomljenim početkom na 12 časova i prazninom pred ciljem („skoro ispod 20").
   Geometrija je u koordinatama 512 × 512 (ivice su izmerene: sastav je centriran na 255,5 / 256, a najudaljenija tačka je 199,5 px od centra,
   unutar bezbednog kruga maskable ikone od 204,8 px; za maskable se sastav ipak smanjuje na 92 %).
   Pokretanje (iz korena repozitorijuma):  node docs/brand/build-icons.mjs
   Piše: docs/brand/icon*.svg i web/public/{icon-32,icon-128,icon-192,icon-512,icon-maskable-512,icon-monochrome-512,apple-touch-icon,badge-96}.png */
import { chromium } from '../../web/node_modules/@playwright/test/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, '../../web/public');

export const C = { bg: '#0E1217', white: '#E8EDF2', track: '#2A3641', cyan: '#2CC0D6' };
const CX = 334, CY = 256, R = 78, SW = 46, SWEEP = 292;
const pt = (a) => [CX + R * Math.cos(((a - 90) * Math.PI) / 180), CY + R * Math.sin(((a - 90) * Math.PI) / 180)];
const [EX, EY] = pt(SWEEP);
const ARC = `M${pt(0)[0].toFixed(2)} ${pt(0)[1].toFixed(2)}A${R} ${R} 0 1 1 ${EX.toFixed(2)} ${EY.toFixed(2)}`;
const TWO = 'M107 216C107 192 126 178 150 178C174 178 192 194 192 218C192 258 142 290 107 334L198 334';

/** Sastav (cifra + prsten). `mono`: jedna boja, bez staze (za maskirane ikone sistema). */
const mark = ({ mono } = {}) => `
  <path d="${TWO}" transform="translate(-8 0)" fill="none" stroke="${mono ?? C.white}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"/>
  ${mono ? '' : `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${C.track}" stroke-width="${SW}"/>`}
  <path d="${ARC}" fill="none" stroke="${mono ?? C.cyan}" stroke-width="${SW}" stroke-linecap="butt"/>
  <circle cx="${EX.toFixed(2)}" cy="${EY.toFixed(2)}" r="${SW / 2}" fill="${mono ?? C.cyan}"/>`;

const svg = (inner) => `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const scaled = (s, inner) => `<g transform="translate(256 256) scale(${s}) translate(-256 -256)">${inner}</g>`;

export const SVGS = {
  /** Puna podloga (iOS i Android sami zaobljuju). */
  full: svg(`<rect width="512" height="512" fill="${C.bg}"/>${mark()}`),
  /** „any": zaobljena podloga, providni uglovi. */
  rounded: svg(`<rect width="512" height="512" rx="112" fill="${C.bg}"/>${mark()}`),
  maskable: svg(`<rect width="512" height="512" fill="${C.bg}"/>${scaled(0.92, mark())}`),
  mono: svg(mark({ mono: '#fff' })),
  badge: svg(scaled(0.86, mark({ mono: '#fff' })))
};

const OUT = [
  ['rounded', 512, 'icon-512.png', true],
  ['rounded', 192, 'icon-192.png', true],
  ['rounded', 128, 'icon-128.png', true],
  ['rounded', 32, 'icon-32.png', true],
  ['full', 180, 'apple-touch-icon.png', false],
  ['maskable', 512, 'icon-maskable-512.png', false],
  ['mono', 512, 'icon-monochrome-512.png', true],
  ['badge', 96, 'badge-96.png', true]
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(HERE, { recursive: true });
  for (const [k, v] of Object.entries(SVGS)) writeFileSync(join(HERE, `icon-${k}.svg`), v + '\n');
  const browser = await chromium.launch({ executablePath: process.env.SUB20_CHROMIUM ?? '/opt/pw-browsers/chromium' });
  try {
    for (const [kind, size, file, transparent] of OUT) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.setContent(
        `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${SVGS[kind]}`
      );
      await page.screenshot({ path: join(PUBLIC, file), omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
      await page.close();
      console.log('✓', file, `${size}×${size}`);
    }
  } finally {
    await browser.close();
  }
}
