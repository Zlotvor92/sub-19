/* AI POSAO KOJI JE ZAGLAVIO

   NALAZ: `l.aiPosao.at` se upisivao i NIKAD čitao. Vremenska oznaka je uzeta
   baš za ovu svrhu, a nijedna linija je nije koristila — pa posao koji jednom
   zaglavi nije imao izlaz. Kartica je zauvek pokazivala „Nova analiza je u
   toku", a ta grana namerno nema dugme, dakle čovek nije imao ni šta da
   dodirne. Provereno nad poslom starim 40 dana: isti tekst, nula dugmadi.

   Zaglavljivanje je stvarno na dva načina:
     1. `posao:'radi'` se šalje TAČNO JEDNOM, bez `await` i bez ponavljanja —
        ako taj zahtev ne stigne, red ostaje u stanju 'radi' i niko ga ne
        preuzme;
     2. ako serverska funkcija umre usred poziva modela, red ostaje u 'u_toku',
        a okidač `ai_posao_prelaz` s pravom zabranjuje povratak na 'radi'.
   U oba slučaja je kvota potrošena, a rezultata nema.

   Zamke ispod tvrde INVARIJANTU, ne brojeve: „dok posao pošteno traje nema
   dugmeta", „posle praga za ponavljanje dugme postoji i ne troši kvotu",
   „posle praga za odustajanje posao se otpušta". Pragovi se čitaju iz koda, pa
   preživljavaju rekalibraciju. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

/* Trening sa unosom, da `aiMoze` propusti karticu i da `aiPayload` ima šta da
   gradi. Vraća { a, d, id }. */
function saPoslom(starMs, dodatno = {}) {
  const a = loadApp({ now: '2026-08-15T10:00:00Z' });
  const id = a.evalIn(`DATED.find(d=>!d.rest && d.tag==='int' || !d.rest && d.tag==='tempo').id`);
  a.evalIn(`
    S.log[${JSON.stringify(id)}] = Object.assign({
      status:'done', km:10, sec:2400, hr:150, rpe:5,
      aiPosao:{ id:'11111111-1111-1111-1111-111111111111', at: Date.now() - ${Number(starMs)} }
    }, ${JSON.stringify(dodatno)});
  `);
  return { a, id, l: () => a.evalIn(`S.log[${JSON.stringify(id)}]`) };
}
const karticaZa = ({ a, id }) =>
  a.call('aiTelo', a.evalIn(`BY_ID[${JSON.stringify(id)}]`), a.evalIn(`S.log[${JSON.stringify(id)}]`));

describe('Kartica analize nudi izlaz iz zaglavljenog posla', () => {

  test('dok posao pošteno traje — nema nijednog dugmeta', () => {
    /* Ovo je namerna odluka od ranije i ostaje: dugme u tom trenutku bi značilo
       drugi posao i drugu potrošenu kvotu. */
    const s = saPoslom(10 * 1000);
    const h = karticaZa(s);
    assert.match(h, /u toku/, 'kartica ne kaže da posao traje');
    assert.doesNotMatch(h, /<button/, 'dugme se nudi dok analiza uredno traje');
  });

  test('posle praga za ponavljanje — dugme postoji', () => {
    /* PRE POPRAVKE: ovaj isti poziv je vraćao doslovno isti HTML kao gore, i to
       zauvek. Izmereno i na poslu starom 40 dana. */
    const s = saPoslom(6 * 60 * 1000);
    const h = karticaZa(s);
    assert.match(h, /<button/, 'zaglavljen posao i dalje nema nijedno dugme');
    assert.match(h, /data-ai-ponovi=/, 'dugme ne vodi na ponavljanje istog posla');
    assert.match(h, /ne troši/i, 'čoveku se ne kaže da ponavljanje ne košta kvotu');
  });

  test('ponavljanje NIJE pokretanje nove analize', () => {
    /* `data-ai` je okidač po kom `vezAnalize` veže POKRETANJE. Da ga zaglavljena
       kartica nosi, jedan dodir bi otvorio nov red u bazi i potrošio kvotu —
       tačno ono što stanje „u toku" i postoji da spreči. */
    const h = karticaZa(saPoslom(6 * 60 * 1000));
    assert.doesNotMatch(h, /data-ai="/, 'zaglavljena kartica pokreće NOV posao umesto da ponovi stari');
  });

  test('stara analiza ostaje vidljiva i dok nova zaglavi', () => {
    const h = karticaZa(saPoslom(6 * 60 * 1000, { aiText: 'stari tekst analize', aiCount: 1 }));
    assert.match(h, /prethodna analiza/, 'stari tekst je nestao');
    assert.match(h, /stari tekst analize/, 'stari tekst se ne prikazuje');
  });

  test('pragovi su iznad svakog poštenog trajanja modela', () => {
    /* Model odgovara za desetak sekundi do minut (v. ROK_MS u api/analyze.js).
       Prag koji bi bio ispod toga sekao bi poslove koji uredno rade. */
    const a = loadApp();
    const ponovi = a.get('AI_PONOVI_MS'), odustani = a.get('AI_ODUSTANI_MS');
    assert.ok(ponovi >= 2 * 60e3, `prag za ponavljanje je ${ponovi} ms — ispod poštenog trajanja`);
    assert.ok(odustani > ponovi, 'odustajanje ne sme da nastupi pre ponavljanja');
  });
});

describe('Posao koji se nikad ne završi otpušta se sam', () => {

  /* Baza koja uvek kaže „još radim" — tačno stanje reda koji je zaglavio. */
  const uvekRadi = a => a.setFetch(async () => ({
    ok: true, status: 200, json: async () => ({ stanje: 'radi' })
  }));

  test('pre praga se čeka dalje', async () => {
    const s = saPoslom(60 * 1000);
    uvekRadi(s.a);
    const ishod = await s.a.call('aiProveri', { id: s.id }, s.l());
    assert.equal(ishod, 'radi', 'posao je otpušten prerano');
    assert.ok(s.l().aiPosao, 'zapis o poslu je obrisan dok je posao još mogao da stigne');
  });

  test('posle praga se otpušta, sa razlogom koji čovek vidi', async () => {
    /* Bez ovoga bi zapis o poslu stajao u `S.log` zauvek, a kartica bi ga
       zauvek prikazivala kao „u toku" — i posle ponavljanja koje nije pomoglo. */
    const s = saPoslom(31 * 60 * 1000);
    uvekRadi(s.a);
    const ishod = await s.a.call('aiProveri', { id: s.id }, s.l());
    assert.equal(ishod, 'greska', 'posao stariji od praga se i dalje vodi kao „u toku"');
    assert.ok(!s.l().aiPosao, 'zapis o poslu nije otpušten');
    assert.match(String(s.l().aiGreska || ''), /\S/, 'nema razloga koji bi se prikazao');
  });

  test('otpušten posao vraća dugme za novu analizu', async () => {
    const s = saPoslom(31 * 60 * 1000);
    uvekRadi(s.a);
    await s.a.call('aiProveri', { id: s.id }, s.l());
    const h = karticaZa(s);
    assert.match(h, /data-ai="/, 'posle odustajanja i dalje nema kako da se pokrene nova analiza');
  });

  test('kvota po treningu NIJE potrošena neuspehom', () => {
    /* `aiCount` raste samo kad tekst stvarno stigne (v. `aiProveri`). Zaglavljen
       posao je već pojeo jednu dnevnu kvotu na serveru; da pojede i jednu od
       dve po treningu, čovek bi ostao i bez analize i bez prava na nju. */
    const s = saPoslom(31 * 60 * 1000);
    uvekRadi(s.a);
    const pre = s.a.call('aiPreostalo', s.l());
    return s.a.call('aiProveri', { id: s.id }, s.l()).then(() => {
      assert.equal(s.a.call('aiPreostalo', s.l()), pre, 'neuspeh je potrošio analizu');
    });
  });
});

describe('Ponavljanje šalje fazu „radi" za POSTOJEĆI posao', () => {

  test('šalje isti posaoId i ne otvara nov red', async () => {
    /* Faza 'start' otvara red i broji se u dnevni limit; faza 'radi' se ne
       broji (v. api/analyze.js). Ponavljanje sme da ide samo kroz drugu. */
    const s = saPoslom(6 * 60 * 1000);
    const poslato = [];
    s.a.setFetch(async (u, o) => {
      poslato.push(JSON.parse(o.body));
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    });
    const ok = await s.a.call('aiPonovoPokreni', s.a.evalIn(`BY_ID[${JSON.stringify(s.id)}]`), s.l());
    assert.equal(ok, true, 'ponavljanje je javilo neuspeh');
    assert.equal(poslato.length, 1, `poslato je ${poslato.length} zahteva umesto jednog`);
    assert.equal(poslato[0].posao, 'radi', 'ponavljanje otvara NOV posao i troši dnevnu kvotu');
    assert.equal(poslato[0].posaoId, '11111111-1111-1111-1111-111111111111',
      'ponavljanje ne cilja postojeći posao');
    assert.ok(poslato[0].session, 'zahtev ne nosi podatke o treningu — model nema šta da analizira');
  });

  test('prozor čekanja kreće ispočetka', async () => {
    /* Inače bi kartica ostala u stanju „predugo traje" i odmah posle uspešnog
       ponavljanja, pa bi dugme izgledalo kao da ništa nije uradilo. */
    const s = saPoslom(6 * 60 * 1000);
    s.a.setFetch(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    await s.a.call('aiPonovoPokreni', s.a.evalIn(`BY_ID[${JSON.stringify(s.id)}]`), s.l());
    assert.doesNotMatch(karticaZa(s), /<button/, 'starost posla nije poništena posle ponavljanja');
  });
});

describe('Posao bez vremenske oznake', () => {

  test('zapis iz starije verzije ne proglašava se zaglavljenim odmah', () => {
    /* Ažuriranje aplikacije usred računanja ne sme da obori analizu koja uredno
       radi. Oznaka se postavlja SADA; gubi se najviše jedan prozor čekanja. */
    const a = loadApp({ now: '2026-08-15T10:00:00Z' });
    const id = a.evalIn(`DATED.find(d=>!d.rest && d.tag==='int').id`);
    a.evalIn(`S.log[${JSON.stringify(id)}]={status:'done', km:10, sec:2400, aiPosao:{id:'x-1'}}`);
    const l = () => a.evalIn(`S.log[${JSON.stringify(id)}]`);
    assert.equal(a.call('aiStarost', l()), 0, 'posao bez oznake je odmah star');
    assert.equal(typeof l().aiPosao.at, 'number', 'oznaka nije upisana, pa se sledeći put opet računa od nule');
  });
});
