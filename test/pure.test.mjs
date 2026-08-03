/* Čiste funkcije: VDOT matematika, tempi po zonama, parsiranje i formatiranje.
   Ovo je sloj iz kog izlazi SVAKI tempo u planu — greška ovde se tiho množi
   kroz ceo plan, pa je pokriven prvi. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const app = loadApp();
const F = n => (...a) => app.call(n, ...a);

const vdotFromRace = F('vdotFromRace');
const vdotFrom5k = F('vdotFrom5k');
const raceTimeForVdot = F('raceTimeForVdot');
const paceForZone = F('paceForZone');
const vdotFromPace = F('vdotFromPace');
const parseTimeStr = F('parseTimeStr');
const fmtClock = F('fmtClock');
const riegel = F('riegel');
const esc = F('esc');
const mdToHtml = F('mdToHtml');

describe('Daniels–Gilbert VDOT', () => {
  test('poznate referentne vrednosti (tabela Daniels Running Formula, ±0.6)', () => {
    /* VDOT 50 ≈ 19:57 na 5K; VDOT 40 ≈ 24:08 na 5K. */
    assert.ok(Math.abs(vdotFrom5k(19 * 60 + 57) - 50) < 0.6, `dobijeno ${vdotFrom5k(1197)}`);
    assert.ok(Math.abs(vdotFrom5k(24 * 60 + 8) - 40) < 0.6, `dobijeno ${vdotFrom5k(1448)}`);
  });

  test('monotono: brže vreme => veći VDOT', () => {
    let prev = -Infinity;
    for (let sec = 1400; sec >= 900; sec -= 25) {
      const v = vdotFrom5k(sec);
      assert.ok(v > prev, `VDOT nije monoton na ${sec}s`);
      prev = v;
    }
  });

  test('raceTimeForVdot je inverz od vdotFromRace (round-trip < 1 s)', () => {
    for (const dist of [5000, 10000, 21097.5, 42195]) {
      for (const v of [35, 42, 48, 55, 62]) {
        const t = raceTimeForVdot(v, dist);
        const back = vdotFromRace(dist, t);
        assert.ok(Math.abs(back - v) < 0.05,
          `dist ${dist}, VDOT ${v} -> ${t}s -> ${back}`);
      }
    }
  });

  test('duža distanca pri istom VDOT-u daje sporiji tempo', () => {
    const v = 50;
    const tempi = [5000, 10000, 21097.5, 42195]
      .map(d => raceTimeForVdot(v, d) / (d / 1000));
    for (let i = 1; i < tempi.length; i++) {
      assert.ok(tempi[i] > tempi[i - 1], `tempo nije rastao na indeksu ${i}`);
    }
  });
});

describe('Zone i tempi', () => {
  test('poredak zona: R < I < T < M < E < LR (brže -> sporije)', () => {
    const v = 50;
    const p = z => paceForZone(v, z);
    assert.ok(p('R') < p('I'), 'R mora biti brže od I');
    assert.ok(p('I') < p('T'), 'I mora biti brže od T');
    assert.ok(p('T') < p('M'), 'T mora biti brže od M');
    assert.ok(p('M') < p('E'), 'M mora biti brže od E');
    assert.ok(p('E') < p('LR'), 'E mora biti brže od LR');
  });

  test('vdotFromPace je inverz od paceForZone (round-trip vraća ISTI tempo)', () => {
    /* paceForZone zaokružuje na celu sekundu po km, pa poređenje u VDOT
       prostoru traži proizvoljnu toleranciju (i na visokom VDOT-u 1 s/km
       vredi preko 0.3 poena). Zato se invarijanta proverava u prostoru u
       kom je funkcija i definisana: tempo -> VDOT -> tempo mora dati
       IDENTIČAN broj sekundi. To je najjača tvrdnja koja uopšte može da
       važi uz zaokruživanje, i ne traži nijednu magičnu konstantu. */
    for (const z of ['I', 'T', 'M', 'E', 'LR', 'R']) {
      for (const v of [30, 35, 42, 48, 55, 62, 70]) {
        const pace = paceForZone(v, z);
        const back = vdotFromPace(pace, z);
        assert.equal(paceForZone(back, z), pace,
          `zona ${z}, VDOT ${v}: ${pace}s/km -> ${back} -> ${paceForZone(back, z)}s/km`);
        assert.ok(Math.abs(back - v) < 0.5, `zona ${z}, VDOT ${v} -> ${back} (predaleko)`);
      }
    }
  });

  test('viša forma => brži tempo u svakoj zoni', () => {
    for (const z of ['I', 'T', 'E', 'LR', 'R', 'M']) {
      assert.ok(paceForZone(55, z) < paceForZone(45, z), `zona ${z}`);
    }
  });

  test('ZONE_FOR_KIND pokriva svaki naziv sesije koji generator proizvodi', () => {
    /* Nedostajuća zona znači tiho pogrešan VDOT (v. komentar uz
       'Tempo isprekidan' — taj slučaj je već jednom promakao). */
    const map = app.get('ZONE_FOR_KIND');
    const zone = app.get('Z');
    for (const [kind, z] of Object.entries(map)) {
      assert.ok(z in zone, `zona "${z}" za "${kind}" ne postoji u Z`);
    }
  });
});

describe('parseTimeStr', () => {
  test('samo cifre', () => {
    assert.equal(parseTimeStr('433'), 4 * 60 + 33);
    assert.equal(parseTimeStr('4233'), 42 * 60 + 33);
    assert.equal(parseTimeStr('10203'), 1 * 3600 + 2 * 60 + 3);
  });
  test('sa dvotačkom', () => {
    assert.equal(parseTimeStr('4:33'), 273);
    assert.equal(parseTimeStr('42:33'), 2553);
    assert.equal(parseTimeStr('1:02:03'), 3723);
  });
  test('zarez i tačka se tretiraju kao dvotačka', () => {
    assert.equal(parseTimeStr('4.33'), 273);
    assert.equal(parseTimeStr('4,33'), 273);
  });
  test('odbija besmislice', () => {
    assert.equal(parseTimeStr('4:99'), null);
    assert.equal(parseTimeStr('499'), null);
    assert.equal(parseTimeStr('abc'), null);
    assert.equal(parseTimeStr(''), null);
    assert.equal(parseTimeStr(null), null);
  });
  test('round-trip sa fmtClock', () => {
    for (const s of [59, 273, 2553, 3723, 12600]) {
      assert.equal(parseTimeStr(fmtClock(s)), s, `pao na ${s}`);
    }
  });
});

describe('Riegel', () => {
  /* PAŽNJA NA POTPIS: riegel(tempoSec, q) NE vraća vreme na q km — vraća
     EKVIVALENTNO 5K VREME za nekoga ko drži tempo `tempoSec` kroz q km.
     (T2 = T1 × (5/Q)^1.06, gde je T1 = tempoSec × q.)
     Zato: držati tempo DUŽE => bolji (kraći) 5K ekvivalent. */
  test('duže držan isti tempo daje BRŽI 5K ekvivalent', () => {
    const tempo = 240;
    assert.ok(riegel(tempo, 10) < tempo * 5, '10 km na istom tempu mora dati brži 5K');
    assert.ok(riegel(tempo, 3) > tempo * 5, '3 km na istom tempu mora dati sporiji 5K');
  });
  test('na tačno 5 km vraća isto vreme', () => {
    assert.ok(Math.abs(riegel(240, 5) - 240 * 5) < 0.001);
  });
  test('riegelDist (klasičan Riegel po distanci) — duže je sporije po km', () => {
    const riegelDist = F('riegelDist');
    const t5 = 1200;
    const t10 = riegelDist(t5, 5000, 10000);
    assert.ok(t10 > t5 * 2, '10K mora biti sporiji od dvostrukog 5K');
    assert.ok(Math.abs(riegelDist(t5, 5000, 5000) - t5) < 0.001, 'identitet');
  });
});

describe('Bezbednost prikaza', () => {
  test('esc neutrališe HTML', () => {
    assert.equal(esc('<img src=x onerror=alert(1)>'),
      '&lt;img src=x onerror=alert(1)&gt;');
    assert.equal(esc(`"'&`), '&quot;&#39;&amp;');
    assert.equal(esc(null), '');
  });

  test('mdToHtml escapuje PRE parsiranja markdowna (nema injekcije)', () => {
    const out = mdToHtml('<script>alert(1)</script> i **podebljano**');
    assert.ok(!out.includes('<script>'), 'sirov <script> je prošao');
    assert.ok(out.includes('&lt;script&gt;'), 'nije escapovano');
    assert.ok(out.includes('<strong>podebljano</strong>'), 'bold nije obrađen');
  });

  test('tagName i safeTag odbijaju nepoznat tip iz uvezenog backupa', () => {
    assert.equal(app.call('tagName', '"><img onerror=alert(1)>'), 'Trening');
    assert.equal(app.call('safeTag', '"><img onerror=alert(1)>'), '');
    assert.equal(app.call('safeTag', 'int'), 'int');
  });
});
