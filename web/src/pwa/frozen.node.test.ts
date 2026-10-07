import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/* ZAMRZNUTO PONAŠANJE STAROG FRONTENDA (APP_VERSION 282, commit b7afc41). Dok je stari `sw.js`/`sw-reg.js`/`app.js` postojao, ovde su se poredili bajt-za-bajt;
   sada se porede sa SHA-256 koji je tada izmeren. Ako se telo service workera NAMERNO menja, novi hash se upisuje ovde, uz obrazloženje u commit-u. */

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
const read = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8');

describe('service worker D6 i nepromenjeni mali skriptovi iz APP_VERSION 282', () => {
  it('telo sw.js (message, install, activate, fetch, IndexedDB, push, sync, periodicsync, putSafe) — zaglavlje se upisuje pri izgradnji', () => {
    const src = read('sw/sw.js');
    const body = src.slice(src.indexOf("self.addEventListener('message'"));
    expect(body.length).toBe(19387);
    expect(sha(body)).toBe('95006e24eb4bf6581d4854cbad3b6b0708bc822009d29604dbb17a4ede8cfaf6');
  });

  it('sw-reg.js', () => {
    expect(sha(read('public/sw-reg.js'))).toBe(
      '8980abe1d07b6acdaa4ad31dd58d6f7bd672f0af8864c6ceba39358afa5541a4'
    );
  });

  it('uvod.js: telo funkcije `uvodniEkran` je isto (do razmaka) kao blok na vrhu starog app.js', () => {
    const src = read('public/uvod.js');
    const start = src.indexOf('(function uvodniEkran(){');
    const end = src.indexOf('\n})();', start);
    const block = src.slice(start, end + 6).replace(/\s+/g, ' ');
    expect(block.length).toBe(975);
    expect(sha(block)).toBe('13b69f8e288fc001308a8e56d259654fadab2315aafa148f05774bc91734bce2');
  });
});
