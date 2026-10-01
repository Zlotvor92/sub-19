import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TABS } from '../src/stores/uiStore';

/* parity: test/doslednost.test.mjs (CSP, index.html bez inline skripti, manifest, SW, assetlinks) — ali nad IZGRAĐENIM izlazom novog frontenda,
   ne nad starim fajlovima. Cutover konfiguracija je predlog izmene `vercel.json`; ovde se dokazuje da menja samo korak izgradnje. */

const WEB = process.cwd();
const ROOT = join(WEB, '..');
const readJson = (p: string): Record<string, unknown> =>
  JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
const current = readJson(join(ROOT, 'vercel.json'));
const cutover = readJson(join(WEB, 'deploy', 'vercel.cutover.json'));

let out = '';
let index = '';
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const files = (): string[] => walk(out).map((f) => relative(out, f).split('\\').join('/'));

beforeAll(async () => {
  out = mkdtempSync(join(tmpdir(), 'sub20-dist-'));
  /* Vitest postavlja NODE_ENV=test, pa bi izlaz dobio razvojnu verziju React-a (sa tekstovima grešaka i adresama) — proverava se PRODUKCIJSKI izlaz. */
  const prev = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'production';
  await build({
    mode: 'production',
    root: WEB,
    configFile: join(WEB, 'vite.config.ts'),
    logLevel: 'silent',
    build: { outDir: out, emptyOutDir: true }
  }).finally(() => {
    if (prev === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = prev;
  });
  index = readFileSync(join(out, 'index.html'), 'utf8');
}, 120_000);
afterAll(() => {
  if (out) rmSync(out, { recursive: true, force: true });
});

describe('cutover konfiguracija', () => {
  it('menja SAMO korak izgradnje: zaglavlja (CSP), cron i funkcije su isti kao u trenutnom vercel.json', () => {
    const { installCommand, buildCommand, outputDirectory, ...rest } = cutover;
    expect(rest).toEqual(current);
    expect(installCommand).toBe('npm ci --prefix web');
    expect(buildCommand).toBe('npm run build --prefix web');
    expect(outputDirectory).toBe('web/dist');
    expect(current).not.toHaveProperty('outputDirectory'); // trenutno stanje: nema build koraka
  });
});

describe('izgrađeni izlaz', () => {
  it("index.html: nema inline skripti ni obrađivača događaja (CSP `script-src 'self'`)", () => {
    for (const m of index.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      expect(m[2]?.trim(), `inline skripta: ${m[0]}`).toBe('');
      expect(m[1]).toMatch(/\bsrc=/);
    }
    expect(index).not.toMatch(/\son[a-z]+\s*=/i);
    expect(index).not.toMatch(/javascript:/i);
    for (const page of ['privacy.html', 'uputstvo.html']) {
      const html = readFileSync(join(out, page), 'utf8');
      expect(html, page).not.toMatch(/<script\b(?![^>]*\bsrc=)[^>]*>/i);
      expect(html, page).not.toMatch(/\son[a-z]+\s*=/i);
    }
  });

  it('pinch-zoom nije blokiran (WCAG 1.4.4)', () => {
    const viewport = /<meta name="viewport" content="([^"]+)"/.exec(index)?.[1] ?? '';
    expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/);
    expect(viewport).not.toMatch(/maximum-scale/);
  });

  it('registracija service workera ide PRE paketa aplikacije', () => {
    const reg = index.indexOf('sw-reg.js');
    const bundle = index.indexOf('type="module"');
    expect(reg).toBeGreaterThan(-1);
    expect(bundle).toBeGreaterThan(reg);
  });

  it('svaka lokalna veza iz index.html postoji u izlazu', () => {
    const refs = [...index.matchAll(/(?:src|href)="([^"#?]+)"/g)].map((m) => m[1] ?? '');
    expect(refs.length).toBeGreaterThan(8);
    for (const r of refs) {
      if (/^https?:/.test(r)) continue;
      const rel = r.replace(/^\.?\//, '');
      expect(existsSync(join(out, rel)), r).toBe(true);
    }
  });

  it('manifest je isti kao stari, a prečice vode na postojeće tabove', () => {
    const m = readFileSync(join(out, 'manifest.json'), 'utf8');
    expect(m).toBe(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
    const parsed = JSON.parse(m) as {
      shortcuts?: Array<{ url: string }>;
      icons?: Array<{ src: string }>;
    };
    for (const s of parsed.shortcuts ?? []) {
      const tab = new URL(s.url, 'https://x.rs/').searchParams.get('tab');
      expect(TABS as readonly string[]).toContain(tab);
    }
    for (const i of parsed.icons ?? [])
      expect(existsSync(join(out, i.src.replace(/^\.?\//, '')))).toBe(true);
  });

  it('Android veza i APK stoje na javnoj adresi, bajt-za-bajt kao u korenu', () => {
    for (const f of ['.well-known/assetlinks.json', 'sub20.apk'])
      expect(readFileSync(join(out, f)).equals(readFileSync(join(ROOT, f))), f).toBe(true);
  });

  it('CSP: svaki spoljni izvor u kodu je dozvoljen u `connect-src`/`img-src`, a ostalo je poznato i ne šalje se', () => {
    const csp = (
      (current['headers'] as Array<{ headers: Array<{ key: string; value: string }> }>)[0]
        ?.headers ?? []
    ).find((h) => h.key === 'Content-Security-Policy')?.value;
    expect(csp).toBeTruthy();
    const allowed = new Set<string>();
    for (const dir of (csp ?? '').split(';')) {
      const [name, ...sources] = dir.trim().split(/\s+/);
      if (name === 'connect-src' || name === 'img-src')
        for (const s of sources) if (s.startsWith('https://')) allowed.add(s.slice(8));
    }
    /* Ne šalju se nikuda: XML imenski prostori, tekst poruka greške biblioteke, oznake šeme, spoljne veze koje čovek otvara dodirom (video vežbe). */
    const inert = new Set(['www.w3.org', 'react.dev', 'json-schema.org', 'www.youtube.com']);
    const hosts = new Set<string>();
    for (const f of files().filter((x) => /^assets\/.*\.js$/.test(x)))
      for (const m of readFileSync(join(out, f), 'utf8').matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g))
        hosts.add(m[1] ?? '');
    const matches = (h: string): boolean =>
      [...allowed].some((a) => (a.startsWith('*.') ? h.endsWith(a.slice(1)) : h === a));
    const unknown = [...hosts].filter((h) => !inert.has(h) && !matches(h));
    expect(unknown, 'spoljni izvor koji CSP ne dozvoljava').toEqual([]);
    expect(hosts.size).toBeGreaterThan(3);
  });

  it('service worker: verzija, ime keša i spisak koji pokriva SVE što index.html učitava (offline)', () => {
    const sw = readFileSync(join(out, 'sw.js'), 'utf8');
    const version = /const APP_VERSION = '(\d+)'/.exec(sw)?.[1];
    const cache = /const CACHE = '([^']+)'/.exec(sw)?.[1] ?? '';
    expect(version).toBeTruthy();
    expect(cache).toMatch(new RegExp(`^sub19-cache-v${version ?? ''}-[0-9a-f]{8}$`));
    const listed = new Set(
      [...(/const ASSETS = \[([\s\S]*?)\];/.exec(sw)?.[1] ?? '').matchAll(/'\.\/([^']*)'/g)].map(
        (m) => m[1] ?? ''
      )
    );
    const needed = [
      ...index.matchAll(/(?:src|href)="\/?(assets\/[^"]+|sw-reg\.js|uvod\.js|manifest\.json)"/g)
    ].map((m) => m[1] ?? '');
    expect(needed.length).toBeGreaterThan(3);
    for (const n of needed) expect(listed.has(n), `${n} nije u kešu`).toBe(true);
    expect(listed.has('index.html')).toBe(true);
    for (const l of listed)
      if (l && l !== '') expect(existsSync(join(out, l)) || l === '', `${l} ne postoji`).toBe(true);
    expect([...listed].some((l) => l.endsWith('.map') || l.endsWith('.apk'))).toBe(false);
  });
});
