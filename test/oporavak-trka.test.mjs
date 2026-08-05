/* SPAJANJE PROGRESA I POVREDA U OPORAVAK, I NOVI HEROJ TABA TRKA

   Dve stvari se ovde lako pokvare tiho:

   1. RASPORED. Sadržaj je preseljen sa taba na tab (nedeljna kilometraža u
      Plan, prosečan tempo na dno Trke), a preseljenje se ne vidi kao greška —
      ekran i dalje radi, samo je kartica nestala. Zato se proverava da svaka
      preseljena kartica JESTE tamo gde je dogovoreno, i da NIJE ostala tamo
      odakle je otišla.

   2. OPTEREĆENJE (ACWR). Kartica je nova i jedini je broj u aplikaciji koji
      upozorava PRE nego što nešto zaboli. Imenilac i brojilac se lako zamene,
      a poređenje datuma kao niski laže ako `ts` nije niska. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const DANAS = '2026-08-05T09:00:00Z';

function app(danas = DANAS) { return loadApp({ now: danas }); }

/* Upiše odrađena trčanja po datumima: {'2026-08-01': 12, …} */
function trcanja(a, mapa, polje = 'ts') {
  a.ctx.__m = mapa; a.ctx.__p = polje;
  a.evalIn(`
    CUR_PLAN.forEach(w => w.days.forEach(d => {
      if (d.date && __m[d.date] != null) {
        const l = { status:'done', km: __m[d.date], sec: Math.round(__m[d.date]*300) };
        l[__p] = d.date;
        S.log[d.id] = l;
      }
    }));
    rebuildDateIndex();`);
}
const html = (a, sel) => String(a.evalIn(`$("${sel}").innerHTML`) || '');
const naslovi = h => [...h.matchAll(/<span class="card-t">([^<]*)<\/span>|<div class="card-t"[^>]*>([^<]*)</g)]
  .map(m => (m[1] ?? m[2]).trim());

describe('Oporavak je jedan tab, ne dva', () => {

  test('sve što je bilo na Povredama i u Progresu ima svoje mesto', () => {
    const a = app();
    a.call('renderOporavak');
    const n = naslovi(html(a, '#pg-opor'));
    for (const t of ['Jutros', 'Opterećenje', 'Bol', 'Telesna masa', 'Istorija bola'])
      assert.ok(n.includes(t), `nema kartice „${t}" — ima: ${n.join(', ')}`);
  });

  test('redosled je po hitnosti: opterećenje pre tela, istorija poslednja', () => {
    const a = app();
    a.call('renderOporavak');
    const n = naslovi(html(a, '#pg-opor'));
    assert.ok(n.indexOf('Opterećenje') < n.indexOf('Bol'), 'signal upozorenja je ispod tela');
    assert.equal(n[n.length - 1], 'Istorija bola', 'istorija nije poslednja');
  });

  test('kartice koje su govorile isto što i prstenovi Plana su uklonjene', () => {
    /* „Tekuća nedelja" i „Ispunjenost plana" su posle prstenova bile treći i
       četvrti prikaz istog broja. Ako se vrate, vraća se i to ponavljanje. */
    const a = app();
    a.call('renderOporavak');
    const h = html(a, '#pg-opor');
    assert.doesNotMatch(h, /Tekuća nedelja/);
    assert.doesNotMatch(h, /Ispunjenost plana/);
  });

  test('grafikoni koji su se odselili nisu ostali i ovde', () => {
    const a = app();
    trcanja(a, { '2026-07-01': 9, '2026-07-08': 10 });
    a.call('renderOporavak');
    const h = html(a, '#pg-opor');
    assert.doesNotMatch(h, /Nedeljna kilometraža/, 'nedeljna kilometraža je i dalje na Oporavku');
    assert.doesNotMatch(h, /Prosečan tempo/, 'prosečan tempo je i dalje na Oporavku');
  });

  test('mapa tela i dalje prima dodir na svaki deo', () => {
    const a = app();
    a.call('renderOporavak');
    const h = html(a, '#pg-opor');
    const delova = (h.match(/data-bp="/g) || []).length;
    assert.ok(delova > 20, `mapa tela nudi samo ${delova} delova`);
  });
});

describe('Opterećenje (ACWR)', () => {

  test('akutno broji SAMO poslednjih sedam dana', () => {
    const a = app();
    trcanja(a, { '2026-08-04': 10, '2026-07-30': 8, '2026-07-20': 30 });
    /* 30 km od 20.07. je van prozora; 8 km od 30.07. je unutra (danas −6). */
    assert.equal(a.call('akutniObim', '2026-08-05'), 18);
  });

  test('brojač gleda STVARAN dan trčanja, ne planski', () => {
    /* Trening pomeren sa 30.07. na 04.08. pripada danu kad je odrađen. */
    const a = app();
    a.evalIn(`
      const d = CUR_PLAN.flatMap(w=>w.days).find(x=>x.date==='2026-07-20');
      S.log[d.id] = { status:'done', km: 11, sec: 3300, runDate: '2026-08-04' };
      rebuildDateIndex();`);
    assert.equal(a.call('akutniObim', '2026-08-05'), 11);
  });

  test('brojčani `ts` ne ulazi u poređenje datuma', () => {
    /* '1785834000000' >= '2026-07-30' je poređenje niski koje uvek laže —
       trening bi upao u prozor bez obzira na to kad je bio. Zato se broj
       odbacuje i pada se na planski datum. */
    const a = app();
    a.evalIn(`
      const d = CUR_PLAN.flatMap(w=>w.days).find(x=>x.date==='2026-07-20');
      S.log[d.id] = { status:'done', km: 11, sec: 3300, ts: 1785834000000 };
      rebuildDateIndex();`);
    assert.equal(a.call('akutniObim', '2026-08-05'), 0,
      'trening od 20.07. je ušao u prozor poslednjih 7 dana');
  });

  test('odnos je akutno / hronično, ne obrnuto', () => {
    const a = app();
    trcanja(a, { '2026-08-01': 20, '2026-08-03': 20 });   /* akutno 40 */
    const z = a.call('acwrSada', '2026-08-05');
    const hron = a.call('hronicniObim', '2026-08-05');
    assert.equal(z.ak, 40);
    assert.equal(z.hron, hron);
    assert.equal(z.odnos, Math.round(40 / hron * 100) / 100);
    assert.ok(z.odnos > 1, 'akutno veće od hroničnog mora dati odnos preko 1');
  });

  test('bez hronične osnove odnos se ne izmišlja', () => {
    const a = app('2026-06-23T09:00:00Z');   /* drugi dan prve nedelje */
    assert.equal(a.call('acwrSada', '2026-06-23').odnos, null);
    const h = a.call('karticaOpterecenja');
    assert.doesNotMatch(String(h), /class="acwr"/, 'traka se crta bez imenioca');
  });

  test('kazaljka ostaje unutar trake i kad odnos prođe skalu', () => {
    const a = app();
    for (const [v, oc] of [[0, 0], [1, 50], [2, 100], [4.7, 100], [-1, 0]])
      assert.equal(a.call('acwrPolozaj', v), oc, `položaj za ${v}`);
  });

  test('granice pojasa stoje tamo gde ih kod definiše', () => {
    const a = app();
    const dole = a.evalIn('ACWR_POVRATAK'), gore = a.evalIn('ACWR_MAX');
    assert.equal(a.call('acwrPolozaj', dole), 40);
    assert.equal(a.call('acwrPolozaj', gore), 65);
  });

  test('odnos se piše na dve decimale, sa zarezom', () => {
    const a = app();
    assert.equal(a.call('acwrBroj', 0.8), '0,80');
    assert.equal(a.call('acwrBroj', 1), '1,00');
    assert.equal(a.call('acwrBroj', 1.256), '1,26');
    assert.equal(a.call('acwrBroj', null), '—');
  });

  test('kartica imenuje i brojilac i imenilac', () => {
    /* Gola brojka „1,06" ne znači ništa bez oba broja iz kojih je nastala. */
    const a = app();
    trcanja(a, { '2026-08-01': 12, '2026-08-03': 9 });
    const h = String(a.call('karticaOpterecenja'));
    assert.match(h, /akutno .* km \/ hronično .* km/);
    assert.doesNotMatch(h, /NaN|undefined/);
  });
});

describe('Trka: dva mala prstena', () => {

  /* Predikcija se upisuje kao tempo kvalitetne sesije; predCalc je pretvara u
     vreme na 5 km. Brže od polazne forme -> prsten se puni. */
  function saPredikcijom(a, tempi) {
    a.ctx.__t = tempi;
    a.evalIn(`Object.assign(S.pred, __t); S.vdotLog = Object.keys(__t).map((id,i)=>
      ({ id, ts:'2026-07-0'+(i+1), vdot: 48.1 + i*0.3, delta: 0.3, measured: 49 }));`);
  }

  test('redosled kartica je tačno onaj koji je tražen', () => {
    const a = app();
    saPredikcijom(a, { p1: 258, p3: 250 });
    a.call('renderPred');
    const n = naslovi(html(a, '#pg-pred'));
    const i = t => n.findIndex(x => x.startsWith(t));
    assert.ok(i('VDOT kroz vreme') >= 0 && i('Predikcija') >= 0 && i('Prosečan tempo') >= 0,
      `nedostaje kartica — ima: ${n.join(', ')}`);
    assert.ok(i('VDOT kroz vreme') < i('Predikcija'), 'VDOT nije iznad predikcije kroz plan');
    assert.ok(i('Predikcija') < i('Prosečan tempo'), 'predikcija nije iznad tempa');
    assert.equal(n[n.length - 1], 'Prosečan tempo', 'prosečan tempo nije na dnu');
  });

  test('heroj su dva prstena, iznad svega ostalog', () => {
    const a = app();
    saPredikcijom(a, { p1: 258 });
    a.call('renderPred');
    const h = html(a, '#pg-pred');
    assert.equal((h.match(/class="tr-ring"/g) || []).length, 2);
    assert.ok(h.indexOf('tr-rings') < h.indexOf('card-t'), 'prstenovi nisu prvi na ekranu');
    assert.doesNotMatch(h, /class="pstat"/, 'stare kockice su i dalje tu');
  });

  test('udeo meri put od polazne forme do cilja', () => {
    const a = app();
    const cilj = a.call('goalSecActive');
    const base = a.evalIn('raceTimeForVdot(baselineVdot(), raceDistActive())');
    assert.ok(Math.abs(a.call('trkaUdeo', base) - 0) < 0.02, 'polazna nije nula');
    assert.ok(Math.abs(a.call('trkaUdeo', cilj) - 1) < 0.02, 'cilj nije jedan');
    assert.ok(a.call('trkaUdeo', (base + cilj) / 2) > 0.45, 'sredina nije oko pola');
  });

  test('predikcija sporija od polazne daje NEGATIVAN udeo, ne nulu', () => {
    /* Nula bi značila „na startu"; negativno znači „iza starta". Razlika je
       cela poenta prikaza — prsten se u oba slučaja crta prazan, ali natpis
       ispod njega mora da kaže istinu. */
    const a = app();
    const base = a.evalIn('raceTimeForVdot(baselineVdot(), raceDistActive())');
    assert.ok(a.call('trkaUdeo', base + 20) < 0);
    const p = String(a.call('trkaPrsten', { pred: base + 20 }, 'zadnja'));
    assert.match(p, /iza polazne/);
  });

  test('bez ijedne predikcije prsten ne izmišlja vreme', () => {
    const a = app();
    const p = String(a.call('trkaPrsten', null, 'zadnja'));
    assert.match(p, /još nema unosa/);
    assert.doesNotMatch(p, /NaN/);
  });

  test('prsten nikad ne dobija negativan pomak niti NaN', () => {
    const a = app();
    const base = a.evalIn('raceTimeForVdot(baselineVdot(), raceDistActive())');
    for (const sec of [base + 60, base, 1, 100000]) {
      const p = String(a.call('trkaPrsten', { pred: sec }, 'x'));
      assert.doesNotMatch(p, /NaN/, `NaN na ${sec}`);
      const off = Number(/stroke-dashoffset="(-?[\d.]+)"/.exec(p)[1]);
      assert.ok(off >= 0, `negativan pomak (${off}) na ${sec}`);
    }
  });

  test('vreme u prstenu je čitljivo — ne prelije se preko kruga', () => {
    /* Pet znakova („20:41") na podrazumevanih 24 izlazi iz unutrašnjeg kruga
       prečnika 76. Zato prsten heroja traži manja slova. */
    const a = app();
    const p = String(a.call('trkaPrsten', { pred: 1241 }, 'zadnja'));
    const fs = Number(/font-size="(\d+)"/.exec(p)[1]);
    assert.ok(fs * 0.62 * 5 < 76, `slova ${fs} px: „20:41" ne staje u prsten`);
  });
});

describe('Preseljene kartice su stigle na odredište', () => {

  test('nedeljna kilometraža je u Planu, odmah ispod prstenova', () => {
    const a = app();
    a.call('renderPlan');
    const h = html(a, '#pg-plan');
    assert.match(h, /Nedeljna kilometraža/);
    assert.ok(h.indexOf('Nedeljna kilometraža') < h.indexOf('pl-faza'),
      'grafikon je ispod faza umesto odmah ispod zbira');
    assert.ok((h.match(/data-wk="/g) || []).length > 0, 'stubići nisu dodirljivi');
  });

  test('prosečan tempo je na Trci, i nigde više', () => {
    const a = app();
    trcanja(a, { '2026-07-01': 9, '2026-07-08': 10 });
    a.call('renderPred'); a.call('renderOporavak'); a.call('renderPlan');
    assert.match(html(a, '#pg-pred'), /Prosečan tempo/);
    assert.doesNotMatch(html(a, '#pg-opor'), /Prosečan tempo/);
    assert.doesNotMatch(html(a, '#pg-plan'), /Prosečan tempo/);
  });
});

describe('Brojevi na novim ekranima pišu se srpski', () => {

  test('nigde decimalna tačka u vidljivom tekstu', () => {
    /* „VDOT 51.3" i „-1.1% od osnove 61.7" su bili baš to. Traži se cifra
       TAČKA cifra van atributa (u atributima su koordinate SVG-a). */
    const a = app();
    a.evalIn(`
      S.vdotLog = [{ id:'p1', ts:'2026-07-01', vdot:48.4, delta:0.3, measured:49.2 },
                   { id:'p3', ts:'2026-07-10', vdot:49.3, delta:0.9, measured:50.1 }];
      S.wellness = {}; for (let i=1;i<=8;i++){ const d='2026-08-0'+i;
        S.wellness[d]={datum:d,hrv:61.4,pulsUMiru:47,sanH:6.7,sanOcena:79,ctl:27.728786,atl:41.52341,svezina:-13.804}; }`);
    for (const [fn, sel] of [['renderPred', '#pg-pred'], ['renderOporavak', '#pg-opor']]) {
      a.call(fn);
      /* Datumi se pišu „05.08." i imaju TAČKU po pravopisu — sklanjaju se pre
         traženja, inače bi svaki datum ispao nalaz. */
      const bezAtributa = html(a, sel).replace(/<[^>]*>/g, ' ')
        .replace(/\b\d{2}\.\d{2}\.(\d{4})?/g, ' ');
      const nadjeno = bezAtributa.match(/\d+\.\d/g) || [];
      assert.deepEqual(nadjeno, [], `${fn} piše decimalnu tačku: ${nadjeno.join(', ')}`);
    }
  });
});
