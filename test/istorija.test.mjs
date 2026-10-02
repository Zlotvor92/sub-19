/* RANIJE VERZIJE — VRAĆANJE UNAZAD SA SERVERA

   Pitanje na koje ovaj skup odgovara: da li backup fajl još štiti od nečega od
   čega server ne štiti?

   Server je do sada bio ogledalo — `user_state` je jedan red koji se prepisuje
   u mestu, pa je verno prenosio i grešku. Sa istorijom verzija to prestaje da
   važi, ali samo ako vraćanje radi TAČNO isto što i „Uzmi sa servera": zadrži
   veze sa Stravom i intervals.icu-om (na serveru stoje bez tokena), propusti
   kroz migraciju, i tek onda zameni stanje. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readRepoFile } from './repo.mjs';

const DANAS = '2026-11-07T09:00:00Z';

function prijavljen(a) {
  a.evalIn(`SB.userId='u-1'; SB.access='tok'; SB.refresh='r';
            SB.expiresAt=Date.now()+3600000; SB.deviceId='d1'; navigator.onLine=true;`);
}

/* Stanje kakvo stoji NA SERVERU: prošlo je kroz sbPayload, dakle bez tokena. */
const SERVERSKO = {
  /* NAMERNO nije `n1d1`: ti identifikatori su potpis vlasnikovog seeda
     (STARI_SEED_POTPIS), pa ih `uskladiVlasnickePodatke` čisti iz tuđeg
     naloga. Prva verzija ovog skupa je koristila baš njih i test je padao —
     ali zato što je zaštita RADILA. Za posebnu zamku v. dole. */
  /* Tekuća šema (11): verzija iz v10 prolazi kroz migraciju koja briše
     unose STAROG ličnog plana, pa bi `n5d3` ovde nestao iz drugog razloga. */
  v: 11, log: { 'n5d3': { status: 'done', km: 8, sec: 2400 } },
  knee: [], kg: [], pred: {}, predLock: {}, vdotLog: [], t3k: [], moves: {}, alts: {},
  genPlan: null, wellness: {}, vreme: null, zajed: { vidljiv: false, nadimak: '' },
  strava: { lastSync: 1, athlete: 'A V', scope: 'read' }, icu: { lastSync: 1 }, ui: {}
};

describe('Šema istorije prati kod', () => {

  test('tabela je u spisku za brisanje naloga na sva tri mesta', () => {
    for (const f of ['api/delete-account.js', 'api/broadcast.js', 'supabase/brisi-nalog.sql']) {
      assert.match(readRepoFile(f), /user_state_istorija/, `${f} ne briše istoriju`);
    }
  });

  test('okidač NIKAD ne sme da obori sinhronizaciju', () => {
    /* Istorija je mreža ispod, ne uslov. Da okidač pukne, prestala bi
       sinhronizacija — a to je gore od nemanja istorije. */
    const sql = readRepoFile('supabase/istorija.sql');
    const fn = /create or replace function public\.user_state_zapamti\(\)[\s\S]*?\$\$;/.exec(sql);
    assert.ok(fn, 'funkcija okidača nije nađena');
    assert.match(fn[0], /exception when others then/,
      'okidač nema hvatanje izuzetka — greška u istoriji obara upis stanja');
  });

  test('kroz RLS niko ne piše u istoriju', () => {
    /* Istorija koju korisnik može da obriše iz aplikacije ne štiti od greške
       napravljene U APLIKACIJI. */
    const sql = readRepoFile('supabase/istorija.sql');
    const politike = [...sql.matchAll(/create policy \w+ on public\.user_state_istorija for (\w+)/g)]
      .map(m => m[1]);
    assert.deepEqual(politike, ['select'], `postoji politika za upis: ${politike}`);
    assert.match(sql, /grant select on public\.user_state_istorija to authenticated;/);
    assert.match(sql, /revoke all on public\.user_state_istorija from anon;/);
  });

  test('politika privatnosti pominje ranije verzije i njihovo brisanje', () => {
    const p = readRepoFile('privacy.html');
    assert.match(p, /Ranije verzije/);
    assert.match(p, /Earlier versions/);
    assert.match(p, /Brisanje naloga briše i njih/);
  });

  test('provera.sql pazi da istorija ostane samo-za-čitanje', () => {
    /* Test iznad gleda SQL fajl — dakle nameru. Ovo gleda alat koji proverava
       ŽIVU bazu. Bez njega bi politika dodata rukom u Supabase konzoli stajala
       neprimećena, a upravo je to način na koji se šema i razilazi.
       Rupu sam ostavio i uočio je tek na tvom ispisu provere. */
    const p = readRepoFile('supabase/provera.sql');
    assert.match(p, /tablename = 'user_state_istorija'\s*\n\s*and cmd <> 'SELECT'/,
      'provera ne gleda politike za upis nad istorijom');
    assert.match(p, /has_table_privilege\('anon', 'public\.user_state_istorija'/,
      'provera ne gleda da li anon vidi istoriju');
  });

  test('politika kaže i za odloženo brisanje, i da samobrisanje NIJE odloženo', () => {
    const p = readRepoFile('privacy.html');
    assert.match(p, /7 dana/, 'ne pominje se rok odloženog brisanja');
    assert.match(p, /trenutno i\s*\n?nepovratno/, 'ne kaže se da je samobrisanje trenutno');
    assert.match(p, /7 days/, 'engleska verzija ne pominje rok');
  });
});
