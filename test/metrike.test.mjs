/* Podaci sa sata koji su do sada išli SAMO AI-u.

   Sync je povlačio kadencu, maks. puls, uspon, temperaturu, Strava „relative
   effort" i računao drift pulsa — sve u AI analizu, a korisniku nigde. Model
   je mogao da kaže „puls ti je driftovao 8%", a čovek nije imao gde da vidi
   sam broj. Isto sa zonama pulsa. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const ZONE = [{min:0,max:120},{min:120,max:140},{min:140,max:155},{min:155,max:168},{min:168,max:-1}];

function sa(polja, zone) {
  const a = loadApp({ now: '2026-08-04T09:00:00Z' });
  a.evalIn(`S.strava={athlete:'x',hrZones:${JSON.stringify(zone===undefined?ZONE:zone)}};
    const d=CUR_PLAN[0].days.find(x=>!x.rest); __id=d.id;
    S.log[d.id]=Object.assign({status:'done',km:10,sec:2600,hr:152,src:'strava'},${JSON.stringify(polja)});
    rebuildDateIndex();`);
  a.ctx.__d = a.evalIn('BY_ID[__id]');
  return a;
}
/* Podaci sa sata su od kartoteke SVOJA kartica, ne red u formi. Meri se ono
   što stvarno stigne na ekran — cela kartica „Sa sata" iz dayCard, ne string
   iz formHTML (koji je sada samo unos). */
const kartica = a => {
  const h = a.evalIn('dayCard(__d)') || '';
  const m = /<div class="card"><div class="dhead"><span class="card-t">Sa sata<\/span>[\s\S]*?<\/div><\/div>/.exec(h);
  return m ? m[0] : '';
};
const red = a => kartica(a).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

describe('Metrike sa sata se vide na kartici treninga', () => {
  test('svih šest podataka stigne do ekrana', () => {
    const a = sa({ cadence: 172.4, maxHr: 178, elevGain: 145, temp: 24, relEffort: 88, decoupling: { n: 4.2 } });
    const r = red(a);
    for (const [sta, deo] of [['kadenca','172'],['maks. puls','178'],['uspon','145'],
                              ['temperatura','24'],['Strava napor','88'],['drift pulsa','4,2']])
      assert.ok(r.includes(deo), `${sta} se ne vidi u: ${r}`);
  });

  test('maksimalan puls dobija oznaku zone', () => {
    /* U redu „maks. puls  178 Z5" zagrade više ne trebaju — sitniji font ih
       zamenjuje. Traži se sama oznaka. */
    assert.match(red(sa({ maxHr: 178 })), /\bZ5\b/);
    assert.match(red(sa({ maxHr: 145 })), /\bZ3\b/);
  });

  test('bez zona u nalogu nema oznake, ali broj ostaje', () => {
    const r = red(sa({ maxHr: 178 }, null));
    assert.match(r, /178/);
    assert.ok(!/\bZ\d\b/.test(r), `oznaka zone se pojavila bez zona: ${r}`);
  });

  test('kad nema nijednog podatka, nema ni reda', () => {
    assert.equal(red(sa({})), '', 'prazan red se ipak crta');
  });

  test('drift pulsa bez ravnomernog tempa kaže razlog umesto broja', () => {
    const r = red(sa({ decoupling: { n: null, razlog: 'tempo nije bio ravnomeran' } }));
    assert.match(r, /tempo nije bio ravnomeran/);
    assert.ok(!/%/.test(r), `prikazan je procenat bez pokrića: ${r}`);
  });

  test('vrednosti iz pokvarenog backupa ne prave smeće', () => {
    for (const zlo of [{ cadence: 'x' }, { maxHr: null }, { elevGain: NaN },
                       { temp: undefined }, { decoupling: 'niz' }, { decoupling: { n: 'x' } }]) {
      const r = red(sa(zlo));
      assert.ok(!/NaN|undefined|null/.test(r), `${JSON.stringify(zlo)} -> ${r}`);
    }
  });
});

describe('Zone pulsa su vidljive', () => {
  test('spisak zona se crta u podešavanjima', () => {
    const a = sa({});
    const h = (a.call('zoneHTML') || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    for (const z of ['Z1 0–120', 'Z2 120–140', 'Z3 140–155', 'Z4 155–168', 'Z5 168+'])
      assert.ok(h.includes(z), `nema ${z} u: ${h}`);
  });

  test('bez zona se ne crta prazan blok', () => {
    assert.equal(sa({}, null).call('zoneHTML'), '');
    assert.equal(sa({}, []).call('zoneHTML'), '');
  });

  test('null >= 0 zamka — pokvaren zapis se ne broji kao zona od nule', () => {
    /* U JS-u je `null >= 0` tačno; sa `lo>=0` bi zapis bez granice prošao. */
    const a = sa({}, [{ min: 'x' }, null, { min: 120, max: 140 }]);
    const h = (a.call('zoneHTML') || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    assert.ok(h.includes('Z1 120–140'), `numeracija ne prati ispravne zapise: ${h}`);
    assert.ok(!/Z2/.test(h), `pokvaren zapis je nacrtan: ${h}`);
    assert.equal(a.call('zonaZaPuls', 50), null, 'puls 50 je upao u pokvarenu zonu');
  });

  test('puls iznad poslednje zone ostaje u poslednjoj', () => {
    const a = sa({});
    assert.equal(a.call('zonaZaPuls', 250).n, 5, 'puls iznad poslednje zone ispada iz svih');
    assert.equal(a.call('zonaZaPuls', 121).n, 2);
    /* 0 i negativno nisu očitanja pulsa — bolje ništa nego lažna zona */
    assert.equal(a.call('zonaZaPuls', 0), null);
    assert.equal(a.call('zonaZaPuls', -1), null);
  });
});

/* intervals.icu vraća formu i umor sa punom preciznošću, pa je na ekranu
   pisalo „forma 27.728786 · umor 41.52341". Jedna decimala je i više nego što
   ta mera nosi. */
describe('Oporavak — brojevi se zaokružuju', () => {
  const kartica = (w) => {
    const a = loadApp({ now: '2026-08-04T09:00:00Z' });
    a.evalIn(`S.wellness={'2026-08-04':${JSON.stringify(w)}};`);
    return String(a.call('karticaOporavka') || '').replace(/<[^>]*>/g, ' ');
  };

  test('forma, umor i svežina imaju najviše jednu decimalu', () => {
    const h = kartica({ hrv: 111, pulsUMiru: 47, sanH: 6.7, svezina: -13.813,
                        ctl: 27.728786, atl: 41.52341 });
    assert.doesNotMatch(h, /\d+[.,]\d{2,}/, `nezaokružen broj: ${/\S*\d+[.,]\d{2,}\S*/.exec(h)}`);
    assert.match(h, /27,7/);
    assert.match(h, /41,5/);
    assert.match(h, /-13,8/);
  });

  test('pokvarena vrednost daje „—", ne NaN', () => {
    const h = kartica({ hrv: 111, svezina: -5, ctl: 'x', atl: null });
    assert.doesNotMatch(h, /NaN/);
    assert.match(h, /—/);
  });
});

/* ============================================================
   PULS U MIRU — smer ocene je OBRNUT od HRV-a.

   Kod HRV-a je pad los, kod pulsa u miru je RAST los. Dok su oba stajala kao
   dva broja u istom redu kartice „Jutros", ta razlika je bila jedan minus u
   pozivu `bojaOdstupanja(-o.pulsOdstupanje*2)` — lako se gubi u refaktoru, a
   greska se ne vidi kao greska: kartica se i dalje iscrta, samo zelenom boji
   jutro u kom je puls u miru skocio pet otkucaja.
   ============================================================ */
describe('Puls u miru — ocena ide u suprotnom smeru od HRV-a', () => {
  /* 13 dana osnove na istoj vrednosti, pa 14. dan koji se testira. */
  const sa = (polje, osnovaV, danas) => {
    const a = loadApp({ now: '2026-08-07T04:00:00Z' });
    const niz = new Array(13).fill(osnovaV).concat(danas);
    a.ctx.__niz = niz; a.ctx.__polje = polje;
    a.evalIn(`(()=>{ const w={};
      for(let i=0;i<__niz.length;i++){ const d=addD(TODAY,-(__niz.length-1)+i);
        w[d]={datum:d, hrv:70, pulsUMiru:45};
        w[d][__polje]=__niz[i]; }
      S.wellness=w; save(); })()`);
    return a;
  };
  const boja = (html, oznaka) => {
    const m = new RegExp(`<i>${oznaka}</i><b style="color:([^"]+)"`).exec(String(html));
    return m ? m[1].replace('var(--', '').replace(')', '') : null;
  };

  test('porast pulsa u miru je UPOZORENJE, ne pohvala', () => {
    const gore = sa('pulsUMiru', 45, 50);      /* +5 otkucaja */
    assert.equal(boja(gore.call('karticaPulsUMiru'), 'Jutros'), 'red',
      'skok od pet otkucaja nije obojen kao problem');
    const malo = sa('pulsUMiru', 45, 47.5);    /* +2,5 */
    assert.equal(boja(malo.call('karticaPulsUMiru'), 'Jutros'), 'amber');
  });

  test('pad pulsa u miru je DOBAR', () => {
    const dole = sa('pulsUMiru', 45, 40);
    assert.equal(boja(dole.call('karticaPulsUMiru'), 'Jutros'), 'green',
      'pad pulsa u miru je obojen kao problem');
  });

  test('HRV zadrzava suprotan smer — kontrola da minus nije obrnut svuda', () => {
    /* Ako neko „uskladi" boje pa obrne i HRV, ovaj test pada. */
    const pao = sa('hrv', 70, 61.6);           /* -12 % */
    assert.equal(boja(pao.call('karticaOporavka'), 'HRV'), 'red');
    const rastao = sa('hrv', 70, 78.4);        /* +12 % */
    assert.equal(boja(rastao.call('karticaOporavka'), 'HRV'), 'green');
  });

  test('puls u miru je izasao iz kartice „Jutros" i ima svoju', () => {
    const a = sa('pulsUMiru', 45, 46);
    assert.doesNotMatch(String(a.call('karticaOporavka')), /Puls u miru/,
      'puls u miru je i dalje u kartici Jutros');
    const svoja = String(a.call('karticaPulsUMiru'));
    assert.match(svoja, /Puls u miru/, 'nema zasebne kartice');
    assert.match(svoja, /<svg/, 'zasebna kartica nema grafikon');
    assert.match(svoja, /Osnova · 7 dana/, 'ne pokazuje sedmodnevnu osnovu');
  });

  test('bez ijednog zapisa o pulsu kartice nema', () => {
    /* Prazna kartica sa crticama je gore nego nikakva — ko nema sat koji meri
       puls u miru ne treba da gleda prazan kvadrat svaki dan. */
    const a = loadApp({ now: '2026-08-07T04:00:00Z' });
    a.evalIn(`(()=>{ const w={};
      for(let i=0;i<10;i++){ const d=addD(TODAY,-9+i); w[d]={datum:d, hrv:70}; }
      S.wellness=w; save(); })()`);
    assert.equal(String(a.call('karticaPulsUMiru')), '');
  });
});
