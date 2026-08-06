/* OTISAK GENERATORA KAO STALNA ZAMKA

   Ostali testovi generatora tvrde INVARIJANTE: da obim raste, da taper spušta,
   da prag ne prelazi budžet zone. To je pravi način da se tvrdi šta plan sme, a
   šta ne — ali invarijanta po definiciji propušta sve što je i dalje unutar
   njenih granica. Kalibracija se može tiho pomeriti za pet posto na jednoj
   distanci, a svi ti testovi ostaju zeleni.

   Ovaj fajl hvata tu klasu: pušta generator kroz 1152 scenarija (4 distance ×
   3 dužine priprema × 4 broja dana × 4 nivoa obima × 3 intenziteta × trenirao/
   početnik) i poredi sažetak svakog ishoda sa upisanim otiskom.

   KAKO SE ČITA PAD OVOG TESTA
   Pad NE znači „pokvario si generator". Znači „generator sada pravi drugačiji
   plan nego pre — je li to bila namera?". Dva ishoda:

     - Preuređivao si kod (izdvajanje funkcije, preimenovanje, sažimanje
       duplikata) i NISI hteo da promeniš ponašanje -> otisak MORA da ostane
       isti. Ako je pao, refaktor je promenio plan. To je nalaz, ne smetnja.

     - Menjao si kalibraciju namerno -> pogledaj koje su se distance pomerile i
       da li baš te. Kad se uveriš da je tačno, osveži otisak:

           node test/otisak-generatora.mjs

       pa u commit uđe i izmena i pomeren otisak, vidljivo u diffu.

   Za pun plan jednog scenarija:
       node test/otisak-generatora.mjs --pun "5K · 4d · 30km · std · trenirao · 16n"

   TRAJANJE: oko 4 s. To je cena koju plaća svaka izmena u planu, i jedina koja
   razlikuje „preuredio sam kod" od „promenio sam nečiji trening". */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { uzmiOtisak, ucitajOtisak } from './otisak-generatora.mjs';

describe('Otisak generatora', () => {
  const upisan = ucitajOtisak();

  test('fixture postoji', () => {
    assert.ok(upisan, 'nema test/fixtures/otisak-generatora.json — pusti `node test/otisak-generatora.mjs`');
    assert.ok(upisan.scenarija > 1000, `otisak pokriva samo ${upisan && upisan.scenarija} scenarija`);
  });

  test('generator pravi ISTE planove kao pri poslednjem otisku', () => {
    if (!upisan) return;                       /* već prijavljeno gore */
    const sada = uzmiOtisak();

    assert.equal(sada.scenarija, upisan.scenarija,
      'matrica scenarija se promenila — ako je namerno, osveži otisak');

    const razlike = [];
    for (const ime of Object.keys(sada.redovi)) {
      const a = upisan.redovi[ime], b = sada.redovi[ime];
      if (!a) { razlike.push(`NOV scenario: ${ime}`); continue; }
      if (a.sha === b.sha) continue;
      /* Poruka mora da kaže ŠTA se pomerilo, ne samo da se pomerilo — inače je
         jedini put napred ponovno uzimanje otiska naslepo, što ubija smisao. */
      const detalj = [];
      if (typeof a.pregled === 'object' && typeof b.pregled === 'object') {
        for (const k of Object.keys(b.pregled)) {
          const x = JSON.stringify(a.pregled[k]), y = JSON.stringify(b.pregled[k]);
          if (x !== y) detalj.push(`      ${k}: pre ${x}  posle ${y}`);
        }
      } else {
        detalj.push(`      pre ${JSON.stringify(a.pregled)}  posle ${JSON.stringify(b.pregled)}`);
      }
      razlike.push(`${ime}\n${detalj.join('\n') || '      (razlika van pregleda — v. --pun)'}`);
    }
    for (const ime of Object.keys(upisan.redovi)) {
      if (!sada.redovi[ime]) razlike.push(`NESTAO scenario: ${ime}`);
    }

    assert.equal(razlike.length, 0,
      `Generator pravi drugačije planove nego pri poslednjem otisku ` +
      `(${razlike.length} od ${sada.scenarija} scenarija):\n\n  ` +
      razlike.slice(0, 12).join('\n  ') +
      (razlike.length > 12 ? `\n  … i još ${razlike.length - 12}` : '') +
      `\n\nAko je izmena NAMERNA: node test/otisak-generatora.mjs\n` +
      `Ako nije: refaktor je promenio ponašanje — to je nalaz.`);
  });
});
