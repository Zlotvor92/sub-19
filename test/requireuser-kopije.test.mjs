/* SEDAM KOPIJA `requireUser` MORA DA SE PONAŠA ISTO

   Duplikacija je NAMERNA i obrazložena u samom kodu: Vercel funkcije deployovane
   preko GitHub web editora nemaju build korak ni `package.json` podešavanje, pa
   `import` iz zajedničkog fajla obara funkciju — a Vercel tada vrati HTML
   stranicu „A server error has occurred", na koju klijent radi `response.json()`
   i dobija nerazumljivo „...is not valid JSON". Par linija duplikata je jeftinije
   od cele te klase problema.

   ALI: duplikaciju do sada nije čuvalo ništa osim discipline. Sedam bajt-identičnih
   kopija provere prijave stoji u sedam fajlova, i prva izmena jedne od njih pravi
   rupu koja se nigde ne prijavljuje — tačno ona klasa greške koju ovaj
   repozitorijum inače hvata zamkama (v. `vdotFromRace`, `riegel`/`riegelDist`,
   `workLapsTempo`/`genWorkLapsTempo` u app.js, gde su dve kopije iste funkcije
   tri puta bile problem).

   MERI SE PONAŠANJE, NE OBLIK. Svaka kopija se izvlači iz svog fajla, pušta u
   sopstvenom `vm` kontekstu i kroz nju se provlače isti scenariji. Provera koja
   bi poredila samo heševe pala bi i na razmak, a propustila bi kopiju koja je
   prepisana drugačije a i dalje izgleda slično. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { readRepoFile } from './harness.mjs';

const FAJLOVI = ['analyze', 'auth', 'delete-account', 'icu-oauth', 'icu', 'push', 'report-bug']
  .map(x => `api/${x}.js`);

/* Izvlači SAMO proveru prijave, njen keš i mrežni omotač, pa ih pušta odvojeno
   od ostatka fajla — ostatak povlači `node:crypto` i drugu opremu koja ovde ne
   treba. Omotač `fetchRok` mora da uđe: provera prijave izlazi na mrežu kroz
   njega (v. „ROK NA IZLAZNI POZIV"), pa bi bez njega svaki scenario padao na
   `ReferenceError` i završavao kao 503 — dakle zamka bi merila sopstvenu
   nepotpunost umesto koda. */
function ucitajProveru(fajl, { env = {}, fetch: mreza } = {}) {
  const src = readRepoFile(fajl);
  const kes = /const AUTH_KES = new Map\(\);[\s\S]*?const AUTH_KES_MAX = \d+;/.exec(src);
  const fn = /\nasync function requireUser\(req\) \{[\s\S]*?\n\}/.exec(src);
  const rok = /const IZLAZNI_ROK_MS = \d+;\nfunction fetchRok\(ulaz, opcije, ms\) \{[\s\S]*?\n\}/.exec(src);
  assert.ok(kes, `${fajl}: nema AUTH_KES blok`);
  assert.ok(fn, `${fajl}: nema requireUser`);
  assert.ok(rok, `${fajl}: nema fetchRok — izlazni poziv bi išao bez roka`);

  const pozivi = [];
  const ctx = {
    console, Object, Array, String, Number, Boolean, JSON, Math, Date, RegExp, Error, Map, Set, Promise,
    AbortSignal, AbortController,
    process: { env: Object.assign({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' }, env) },
    fetch: async (u, o) => {
      pozivi.push({ url: String(u), opcije: o });
      if (mreza) return mreza(u, o);
      return { ok: true, json: async () => ({ id: 'u1', email: 'k@t.rs' }) };
    }
  };
  ctx.globalThis = ctx;
  const c = createContext(ctx);
  runInContext(rok[0] + '\n' + kes[0] + '\n' + fn[0], c, { filename: fajl });
  return {
    pozivi,
    zovi: req => { ctx.__req = req; return runInContext('requireUser(__req)', c); },
    kesVelicina: () => runInContext('AUTH_KES.size', c),
    ubaciStare: n => { ctx.__n = n; runInContext(
      'for (let i=0;i<__n;i++) AUTH_KES.set("istekao-"+i, {id:"x", email:null, doKada: Date.now()-1000});', c); },
    ubaciSveze: n => { ctx.__n = n; runInContext(
      'for (let i=0;i<__n;i++) AUTH_KES.set("svez-"+i, {id:"x", email:null, doKada: Date.now()+60000});', c); }
  };
}

const saTokenom = t => ({ headers: { authorization: 'Bearer ' + t } });

/* Scenariji se pišu JEDNOM i puštaju kroz svih sedam kopija. Ako se ijedna
   razidje, pada tačno ona i poruka kaže koja. */
const SCENARIJI = [
  ['bez zaglavlja nema prolaza', async p => {
    const r = await p.zovi({ headers: {} });
    assert.equal(r.ok, false); assert.equal(r.status, 401);
  }],
  ['zaglavlje bez „Bearer" nema prolaza', async p => {
    const r = await p.zovi({ headers: { authorization: 'tajna' } });
    assert.equal(r.ok, false); assert.equal(r.status, 401);
  }],
  ['token koji Supabase odbija daje 401, ne 500', async (p, mk) => {
    const q = mk({ fetch: async () => ({ ok: false, json: async () => ({}) }) });
    const r = await q.zovi(saTokenom('los'));
    assert.equal(r.ok, false); assert.equal(r.status, 401);
  }],
  ['odgovor bez `id` se ne prihvata', async (p, mk) => {
    const q = mk({ fetch: async () => ({ ok: true, json: async () => ({ email: 'k@t.rs' }) }) });
    const r = await q.zovi(saTokenom('cudan'));
    assert.equal(r.ok, false); assert.equal(r.status, 401);
  }],
  ['baza koja ne odgovara daje 503, ne 401', async (p, mk) => {
    /* Razlika je važna: 401 klijentu znači „prijavi se ponovo" i izbacio bi
       čoveka iz naloga zbog prolaznog kvara Supabase-a. */
    const q = mk({ fetch: async () => { throw new Error('mreža'); } });
    const r = await q.zovi(saTokenom('dobar'));
    assert.equal(r.ok, false); assert.equal(r.status, 503);
  }],
  ['bez podešenog okruženja daje 500', async (p, mk) => {
    const q = mk({ env: { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' } });
    const r = await q.zovi(saTokenom('dobar'));
    assert.equal(r.ok, false); assert.equal(r.status, 500);
  }],
  ['ispravan token vraća korisnika i njegov id', async p => {
    const r = await p.zovi(saTokenom('dobar'));
    assert.equal(r.ok, true); assert.equal(r.userId, 'u1'); assert.equal(r.email, 'k@t.rs');
  }],
  ['drugi poziv istim tokenom NE ide ponovo na mrežu', async p => {
    await p.zovi(saTokenom('isti'));
    const posle1 = p.pozivi.length;
    const r = await p.zovi(saTokenom('isti'));
    assert.equal(r.ok, true);
    assert.equal(p.pozivi.length, posle1, 'keš ne radi — svaki poziv plaća krug ka Supabase-u');
  }],
  ['tuđ token se ne može pogoditi kroz keš', async p => {
    await p.zovi(saTokenom('moj'));
    const posle1 = p.pozivi.length;
    await p.zovi(saTokenom('tudj'));
    assert.ok(p.pozivi.length > posle1, 'drugi token je uzeo tuđ zapis iz keša');
  }],
  ['pun keš izbacuje ISTEKLE, a ne sve', async p => {
    /* `clear()` je na toploj instanci bacao i sve što je tog trenutka još
       važilo, pa je sledećih nekoliko poziva ponovo plaćalo krug ka Supabase-u
       bez razloga — a keš i postoji da bi ih poštedeo. */
    p.ubaciStare(499);
    p.ubaciSveze(1);
    await p.zovi(saTokenom('nov'));
    const posle = p.kesVelicina();
    assert.ok(posle >= 2, `keš je ispražnjen do ${posle} — i važeći zapisi su bačeni`);
    assert.ok(posle < 100, `istekli zapisi nisu izbačeni, u kešu ih je ${posle}`);
  }],
  ['pun keš SAMIH VAŽEĆIH zapisa se i dalje prazni', async p => {
    /* Gornja granica postoji da topla instanca ne raste bez kraja i ta namera
       ostaje — samo je sad poslednje sredstvo, a ne prvo. */
    p.ubaciSveze(500);
    await p.zovi(saTokenom('nov'));
    assert.ok(p.kesVelicina() <= 2, 'keš raste bez granice na dugotrajnoj instanci');
  }]
];

for (const fajl of FAJLOVI) {
  describe(`${fajl} — provera prijave`, () => {
    for (const [ime, telo] of SCENARIJI) {
      test(ime, async () => {
        const mk = o => ucitajProveru(fajl, o);
        await telo(mk({}), mk);
      });
    }
  });
}

describe('Kopije se nisu razišle', () => {
  test('svih sedam fajlova nosi provozu prijave', () => {
    for (const f of FAJLOVI) {
      assert.match(readRepoFile(f), /\nasync function requireUser\(req\) \{/,
        `${f} više nema ugrađenu proveru prijave — proveri da je nije zamenio import`);
    }
  });

  test('nijedan fajl ne uvozi proveru iz zajedničkog modula', () => {
    /* Ovo je razlog zbog kog duplikat uopšte postoji: `import` lokalnog fajla
       obara funkciju na Vercelu bez jasne poruke (v. zaglavlje api/analyze.js).
       Zamka postoji da se „počistiću ovaj duplikat" ne desi bez čitanja. */
    for (const f of FAJLOVI) {
      assert.doesNotMatch(readRepoFile(f), /^import .*\.\/_?auth/m,
        `${f} uvozi proveru prijave iz lokalnog modula — v. zašto to obara deploy`);
    }
  });
});
