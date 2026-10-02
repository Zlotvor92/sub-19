import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ringView } from '../domain/day';
import { COMPARABLE_PACE_SEC, EASY_BAND_KM } from '../domain/day/compare';
import { DECOUPLING_MIN_KM } from '../domain/activities/perkm';
import { COOLER_HOUR_DELTA } from '../domain/weather';
import { DRIFT_GOOD_BELOW, DRIFT_WARN_BELOW } from '../domain/zones';
import { ENTERING_MS } from '../stores/uiStore';

/* parity: test/doslednost.test.mjs — stvari koje se održavaju ručno i tiho zastare: uputstvo naspram koda, sidra, obrasci, politika privatnosti, trajanje animacija
   naspram tajmera. Čita izvorne fajlove novog frontenda. */

const WEB = process.cwd();
const read = (p: string): string => readFileSync(join(WEB, p), 'utf8');
const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '');
const css = read('src/styles/legacy.css');
const uputstvo = read('public/uputstvo.html');
const privacy = read('public/privacy.html');
const manifest = JSON.parse(read('public/manifest.json')) as {
  id: string;
  screenshots: Array<{ src: string; sizes: string; form_factor: string; label: string }>;
};

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return tsxFiles(p);
    return p.endsWith('.tsx') && !p.includes('.test.') ? [p] : [];
  });
}

describe('Uputstvo ne sme da laže o brojevima iz koda', () => {
  it('pojas u kom se lagana trčanja porede', () => {
    expect(uputstvo).toMatch(new RegExp(`pojasa distance</b> \\(${EASY_BAND_KM} km\\)`));
  });
  it('granica do koje je puls uporediv', () => {
    expect(uputstvo).toMatch(new RegExp(`${COMPARABLE_PACE_SEC} s/km`));
  });
  it('koliko stepeni mora biti hladnije da se sat uopšte predloži', () => {
    expect(uputstvo).toMatch(new RegExp(`bar ${COOLER_HOUR_DELTA} °C hladniji`));
  });
  it('najmanji broj kilometara iz kog se drift uopšte računa', () => {
    expect(uputstvo).toMatch(new RegExp(`bar <b>${DECOUPLING_MIN_KM} km</b>`));
  });
  it('pragovi boje drifta su isti u kodu i u uputstvu', () => {
    expect(uputstvo).toMatch(
      new RegExp(
        `Ispod <b>${DRIFT_GOOD_BELOW} %</b> je zdrava baza, ${DRIFT_GOOD_BELOW}–${DRIFT_WARN_BELOW} % granično, preko <b>${DRIFT_WARN_BELOW} %</b>`
      )
    );
  });
  it('svako sidro u uputstvu ima svoj cilj', () => {
    const ids = new Set([...uputstvo.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
    const dead = [...uputstvo.matchAll(/href="#([^"]+)"/g)]
      .map((m) => m[1] ?? '')
      .filter((h) => !ids.has(h));
    expect(dead).toEqual([]);
  });
});

describe('Politika privatnosti pominje sve treće strane kojima podaci odlaze', () => {
  for (const party of ['Supabase', 'Strava', 'intervals', 'Resend', 'Gemini', 'Vercel'])
    it(`pominje ${party}`, () => {
      expect(privacy).toMatch(new RegExp(party, 'i'));
    });
  it('i dalje tvrdi da koordinate ne idu u bazu (a kod to stvarno ne radi — v. payload.test)', () => {
    expect(privacy).toMatch(/koordinat/i);
  });
});

describe('Izgled obrazaca', () => {
  it('polja u obrascima nisu bela kutija iz pregledača: pravilo pokriva svaki tip koji se koristi, uključujući polje bez `type`', () => {
    const rule = /\.f-field input([^{]*)\{/.exec(css);
    expect(rule).not.toBeNull();
    const excluded = [...(rule?.[0] ?? '').matchAll(/:not\(\[type=([a-z]+)\]\)/g)].map((m) => m[1]);
    const listed = [...(rule?.[0] ?? '').matchAll(/input\[type=([a-z]+)\]/g)].map((m) => m[1]);
    for (const t of ['text', 'password', 'date', 'number']) {
      const covered = excluded.length ? !excluded.includes(t) : listed.includes(t);
      expect(covered, `tip ${t} nije pokriven`).toBe(true);
    }
    // polje BEZ atributa `type` mora da bude pokriveno (nabrajanje po tipu ga ne hvata)
    expect(excluded.length > 0 || /\.f-field input[,{]/.test(rule?.[0] ?? '')).toBe(true);
  });

  it('nema <label> bez `htmlFor` (čitač prijavljuje praznu labelu, a dodir ne fokusira polje)', () => {
    const bad: string[] = [];
    for (const f of tsxFiles(join(WEB, 'src'))) {
      const src = stripComments(readFileSync(f, 'utf8'));
      for (const m of src.matchAll(/<label\b(?![^>]*\bhtmlFor=)[^>]*>/g)) bad.push(`${f}: ${m[0]}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('Manifest je spreman za pakovanje u Android aplikaciju', () => {
  it('`id` je koren — svaka druga vrednost razdvaja postojeće instalacije', () => {
    expect(manifest.id).toBe('/');
  });
  it('snimci ekrana: bar tri, svi „narrow", sa opisom, dimenzije odgovaraju WebP fajlu, isti odnos strana', () => {
    expect(manifest.screenshots.length).toBeGreaterThanOrEqual(3);
    for (const s of manifest.screenshots) {
      expect(s.form_factor).toBe('narrow');
      expect(s.sizes).toMatch(/^\d+x\d+$/);
      expect(s.label.length).toBeGreaterThan(5);
      const b = readFileSync(join(WEB, 'public', s.src.replace(/^\.\//, '')));
      // VP8 (lossy) WebP: širina/visina na bajtovima 26–29; VP8X: 24–29; VP8L: 21–24
      const fourcc = b.toString('ascii', 12, 16);
      let w = 0;
      let h = 0;
      if (fourcc === 'VP8 ') {
        w = b.readUInt16LE(26) & 0x3fff;
        h = b.readUInt16LE(28) & 0x3fff;
      } else if (fourcc === 'VP8X') {
        w = 1 + b.readUIntLE(24, 3);
        h = 1 + b.readUIntLE(27, 3);
      } else if (fourcc === 'VP8L') {
        const bits = b.readUInt32LE(21);
        w = 1 + (bits & 0x3fff);
        h = 1 + ((bits >> 14) & 0x3fff);
      }
      expect(`${w}x${h}`, `${s.src} nije ${s.sizes}`).toBe(s.sizes);
    }
    expect(new Set(manifest.screenshots.map((s) => s.sizes)).size).toBe(1);
  });
  it('assetlinks.json: otisak ključa je STVARAN otisak (SHA-256, 32 bajta), ne rezervisano mesto', () => {
    const j = JSON.parse(
      readFileSync(join(WEB, '..', '.well-known/assetlinks.json'), 'utf8')
    ) as Array<{
      relation: string[];
      target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] };
    }>;
    expect(j[0]?.relation[0]).toBe('delegate_permission/common.handle_all_urls');
    expect(j[0]?.target.namespace).toBe('android_app');
    expect(j[0]?.target.package_name).toBeTruthy();
    const prints = j[0]?.target.sha256_cert_fingerprints ?? [];
    expect(prints.length).toBeGreaterThan(0);
    for (const p of prints) expect(p).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    expect(new Set(prints).size).toBe(prints.length);
  });
});

describe('Animacije napretka — prstenovi i linije', () => {
  const plain = stripComments(css);
  /* „.75s .08s" → 830 ms; „.7s" → 700 ms. */
  const duration = (selector: string): number | null => {
    const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = new RegExp(`${esc}\\{[^}]*animation:[a-z-]+ ([\\d.]+)s(?: ([\\d.]+)s)?`).exec(plain);
    return m ? Math.round((parseFloat(m[1] ?? '0') + (m[2] ? parseFloat(m[2]) : 0)) * 1000) : null;
  };

  it('tajmer klase `uskoci` traje duže od najduže animacije na njoj (inače klasa pada usred crtanja i linija „pukne")', () => {
    const longest = ['.page.uskoci .pr-val', '.page.uskoci .ln'].map((s) => ({
      s,
      ms: duration(s)
    }));
    for (const a of longest) expect(a.ms, `nema animacije za ${a.s}`).not.toBeNull();
    expect(ENTERING_MS).toBeGreaterThan(Math.max(...longest.map((a) => a.ms ?? 0)));
  });

  it('prsten kreće od PRAZNOG, i to od tačnog obima (2πr, r = 42)', () => {
    const from = Number(
      /@keyframes prsten-puni\{from\{stroke-dashoffset:([\d.]+)\}/.exec(plain)?.[1]
    );
    expect(Math.abs(from - 2 * Math.PI * 42)).toBeLessThan(0.1);
    const empty = ringView(0);
    expect(empty.radius).toBe(42);
    expect(empty.offset).toBeCloseTo(empty.circumference, 6); // prazan prsten: ceo obim je „neispunjen"
    expect(Math.abs(from - empty.circumference)).toBeLessThan(0.1);
    expect(read('src/components/ui/Ring.tsx')).toMatch(/pr-val/);
    // uvodni VDOT prsten ima SVOJU tranziciju i ne sme da upadne u animaciju plana
    expect(plain).not.toMatch(/\.ob-vval[^{]*\{[^}]*animation:prsten-puni/);
  });

  it('isključeno kretanje gasi obe animacije', () => {
    const blocks = [
      ...plain.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/g)
    ]
      .map((m) => m[1])
      .join('\n');
    expect(blocks).toMatch(
      /\.page\.uskoci \.pr-val,\.page\.uskoci \.ln\{animation:none!important\}/
    );
  });

  it('linije se crtaju samo na PODACIMA, ne na pomoćnim (isprekidanim) linijama cilja i osnove', () => {
    const polylines: string[] = [];
    for (const f of ['src/features/race/charts.tsx', 'src/features/recovery/charts.tsx'])
      polylines.push(...(read(f).match(/<polyline[\s\S]*?\/>/g) ?? []));
    const drawn = polylines.filter((p) => /className="ln"/.test(p));
    expect(drawn.length).toBeGreaterThanOrEqual(5);
    for (const p of drawn) expect(p).not.toMatch(/strokeDasharray=/);
  });
});

describe('Prevlačenje između tabova — CSS i kod su uskladjeni', () => {
  const plain = stripComments(css);
  const hook = read('src/app/useSwipeNav.ts');

  it('svaka klasa koju kod postavlja ima svoje pravilo', () => {
    for (const k of ['dolazi', 'klizi']) {
      expect(plain).toMatch(new RegExp('\\.page\\.' + k + '[,{]'));
      expect(hook).toContain(`'${k}'`);
    }
    expect(plain).toMatch(/#ambijent\.vuce i\{transition:none\}/);
  });

  it('ekran koji dolazi ne pomera ništa u toku i ne prima dodire', () => {
    const rule = /\.page\.dolazi\{([^}]*)\}/.exec(plain)?.[1] ?? '';
    expect(rule).toMatch(/position:absolute/);
    expect(rule).toMatch(/pointer-events:none/);
  });

  it('bočni razmak dolazećeg ekrana je ISTI kao razmak sadržaja (inače sadržaj poskoči kad prelazak legne)', () => {
    expect(plain).toMatch(/main\{padding:var\(--pad\) var\(--pad\)/);
    expect(/\.page\.dolazi\{([^}]*)\}/.exec(plain)?.[1]).toMatch(
      /left:var\(--pad\);right:var\(--pad\)/
    );
  });

  it('trajanje dovršetka dolazi iz koda (`--pv-ms`), a kriva iz CSS-a', () => {
    expect(plain).toMatch(/\.page\.klizi\{transition:transform var\(--pv-ms,[^)]*\) cubic-bezier/);
    expect(hook).toMatch(/setProperty\('--pv-ms'/);
  });

  it('rok koji čisti prelazak ističe POSLE dovršetka (`ms + 20`), ne u njemu', () => {
    expect(hook).toMatch(/setTimeout\(flushPending, ms \+ 20\)/);
  });

  it('nijedna stranica ne nosi filter dok se pomera (backdrop-filter na zaglavlju i traci bi obarao jeftin put)', () => {
    for (const sel of ['.page.dolazi', '.page.klizi'])
      expect(/\.page\.(dolazi|klizi)\{([^}]*)\}/.exec(plain)?.[2] ?? '', sel).not.toMatch(/filter/);
    expect(stripComments(hook)).not.toMatch(/\.style\.filter|filter:|feGaussianBlur/);
  });
});
