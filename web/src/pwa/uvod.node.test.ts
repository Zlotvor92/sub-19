import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STATIC_ASSETS } from '../../scripts/sw-build.mjs';

/* parity: test/uvod.test.mjs — markup i CSS uvodnog ekrana, ikonice, znak u zaglavlju. Čita IZVORNE fajlove novog frontenda (index.html, legacy.css, public/). */

const WEB = process.cwd();
const html = readFileSync(join(WEB, 'index.html'), 'utf8');
const css = readFileSync(join(WEB, 'src/styles/legacy.css'), 'utf8');
const manifest = JSON.parse(readFileSync(join(WEB, 'public/manifest.json'), 'utf8')) as {
  background_color: string;
  icons: Array<{ src: string; purpose?: string }>;
};

describe('Uvodni ekran — markup i CSS', () => {
  it('#uvod je prvi element u <body> (iscrtava se pre svega ostalog), a skript koji ga uklanja stoji odmah iza', () => {
    const body = html.slice(html.indexOf('<body>') + 6);
    const firstTag = /<([a-z]+)\b[^>]*>/i.exec(body.replace(/<!--[\s\S]*?-->/g, ''));
    expect(firstTag?.[0]).toContain('id="uvod"');
    expect(body.indexOf('id="uvod"')).toBeLessThan(body.indexOf('id="root"'));
    expect(body.indexOf('src="./uvod.js"')).toBeGreaterThan(body.indexOf('id="uvod"'));
    expect(body.indexOf('src="./uvod.js"')).toBeLessThan(body.indexOf('id="root"'));
  });

  it('animacija je u CSS-u, ne čeka paket aplikacije', () => {
    expect(css).toMatch(/@keyframes uvod-luk/);
    expect(css).toMatch(/#uvod\s*\{[^}]*animation:\s*uvod-kraj/);
  });

  it('kad skripta zakaže, uvod se sam skloni i ne guta dodire (visibility:hidden u poslednjem kadru)', () => {
    const end = /@keyframes uvod-kraj\s*\{([\s\S]*?)\n\}/.exec(css);
    expect(end).not.toBeNull();
    expect(end?.[1]).toMatch(/100%\s*\{[^}]*visibility\s*:\s*hidden/);
  });

  it('visibility se ne prebacuje na polovini gašenja (kadar pred kraj je `visible`)', () => {
    const end = /@keyframes uvod-kraj\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(end).toMatch(/99%\s*\{[^}]*visibility\s*:\s*visible/);
  });

  it('preskakanje dodirom koristi DRUGO ime animacije (inače se ne pokreće iz početka)', () => {
    const skip = /#uvod\.gasi\s*\{([^}]*)\}/.exec(css);
    expect(skip).not.toBeNull();
    expect(skip?.[1]).not.toMatch(/uvod-kraj/);
    expect(css).toMatch(/@keyframes uvod-preskok/);
  });

  it('smanjeno kretanje sakriva uvod već u CSS-u i GASI slaganje kartica (ne samo skraćuje)', () => {
    const blocks = [
      ...css.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/g)
    ]
      .map((m) => m[1])
      .join('\n');
    expect(blocks).toMatch(/#uvod\s*\{\s*display:\s*none/);
    expect(blocks).toMatch(/\.page\.uskoci>\*\s*\{\s*animation:\s*none\s*!important/);
  });

  it('uvod je iznad svega ostalog, uključujući prijavni ekran', () => {
    const mine = Number(/#uvod\s*\{[\s\S]*?z-index:\s*(\d+)/.exec(css)?.[1]);
    const others = [...css.matchAll(/z-index:\s*(\d+)/g)]
      .map((m) => Number(m[1]))
      .filter((z) => z !== mine);
    expect(mine).toBeGreaterThan(Math.max(0, ...others));
  });

  it('podloga uvoda je ista boja kao background_color u manifestu (nema trzaja sa sistemskim splash-om)', () => {
    const rule = /#uvod\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    const colors = (rule.match(/#[0-9A-Fa-f]{6}/g) ?? []).map((c) => c.toUpperCase());
    expect(colors).toContain(manifest.background_color.toUpperCase());
  });
});

describe('Ikonice', () => {
  const fromManifest = manifest.icons.map((i) => i.src.replace(/^\.\//, ''));
  const fromHtml = [
    ...html.matchAll(/<link[^>]+href="\.\/(icon-[\w-]+\.png|apple-touch-icon\.png)"/g)
  ].map((m) => m[1] ?? '');
  const all = [...new Set([...fromManifest, ...fromHtml])];

  it('svaka ikonica iz manifesta i index.html postoji i nije krnja', () => {
    expect(all.length).toBeGreaterThanOrEqual(4);
    for (const f of all) {
      expect(existsSync(join(WEB, 'public', f)), f).toBe(true);
      expect(statSync(join(WEB, 'public', f)).size, f).toBeGreaterThan(500);
    }
  });

  it('svaka ikonica je na spisku koji service worker osvežava sa mreže (inače „promenio sam ikonicu, na telefonu je stara")', () => {
    for (const f of all) expect(STATIC_ASSETS, f).toContain(`./${f}`);
  });

  it('maskable ikonica je zaseban fajl, ne ista kao obična', () => {
    const any = manifest.icons.filter((i) => i.purpose === 'any').map((i) => i.src);
    const mask = manifest.icons.filter((i) => i.purpose === 'maskable').map((i) => i.src);
    expect(mask.length).toBeGreaterThan(0);
    for (const m of mask) expect(any).not.toContain(m);
  });
});

describe('Znak u zaglavlju', () => {
  it('zaglavlje nosi znak aplikacije', () => {
    const icons = readFileSync(join(WEB, 'src/components/ui/icons.tsx'), 'utf8');
    const shell = readFileSync(join(WEB, 'src/components/ui/Shell.tsx'), 'utf8');
    expect(icons + shell).toMatch(/h-mark/);
  });

  it('znak u zaglavlju je ravan (bez <defs> i id-jeva), pa ne može da zasenči gradijent uvoda (dva <defs> sa istim id-jem: drugi se ignoriše)', () => {
    const icons = readFileSync(join(WEB, 'src/components/ui/icons.tsx'), 'utf8');
    const mark = /export function BrandMark[\s\S]*?\n\}\n/.exec(icons)?.[0] ?? '';
    expect(mark).not.toBe('');
    expect(mark).not.toMatch(/<defs|linearGradient|radialGradient|\bid=/);
  });
});
