/* OKIDAČI NAD `ai_posao` — da li server radi ono što baza dozvoljava

   ZAŠTO OVAJ FAJL POSTOJI
   `supabase/ai-posao.sql` je dobio okidače koji ograničavaju šta se sme desiti
   sa redom posla: nov red se uvek rađa u stanju 'radi' i uvek pripada onome ko
   ga pravi, a jedini dozvoljeni prelazi su `radi -> u_toku` i
   `u_toku -> gotovo|greska`. Povratak u 'radi' je zabranjen — to je bio put
   kojim se dnevni limit zaobilazio (v. komentar u tom fajlu).

   Ali pravilo u bazi i kod koji ga poštuje su dve odvojene stvari, i žive na
   dva mesta koja se puštaju odvojeno: SQL ide rukom kroz Supabase editor, kod
   ide deployem. Ako se raziđu, posledica NIJE greška u testu — nego produkcija
   u kojoj analiza prestane da radi, i to tek kad neko klikne.

   Zato se ovde ne testira SQL (nema baze u testu) nego ono što se može
   testirati: da /api/analyze kroz ceo životni ciklus posla NIKAD ne pokuša
   prelaz koji okidač odbija. Lažni PostgREST ispod sprovodi tačno ta pravila i
   odbija sve ostalo — kao što bi ih odbila i prava baza.

   Ako ovaj test padne, prvo pitanje nije „šta je u testu" nego „da li je kod
   otišao ispred SQL-a ili obrnuto". */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const origFetch = globalThis.fetch;
const ENV = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  GEMINI_API_KEY: 'gk',
  VERCEL_URL: 'sub-19.vercel.app'
};
/* beforeEach, ne dodela u telu `describe`: telo se izvrši JEDNOM pri
   prikupljanju testova, a `afterEach` briše okruženje posle SVAKOG — pa bi od
   drugog testa nadalje `SUPABASE_URL` nedostajao i svaki poziv bi vraćao 500.
   Prva verzija ovog fajla je baš tako pala, i to je izgledalo kao greška u
   okidačima umesto u testu. */
const staro = {};
beforeEach(() => {
  for (const k of Object.keys(ENV)) { staro[k] = process.env[k]; process.env[k] = ENV[k]; }
});
afterEach(() => {
  globalThis.fetch = origFetch;
  for (const k of Object.keys(ENV)) { if (staro[k] === undefined) delete process.env[k]; else process.env[k] = staro[k]; }
});

/* --- lažni PostgREST nad `ai_posao`, sa okidačima iz ai-posao.sql --- */
function napraviBazu(korisnik) {
  const redovi = new Map();
  let brojac = 0;
  const odbijeno = [];          /* svaki pokušaj koji bi baza odbila */

  /* BEFORE INSERT: ai_posao_nov */
  const upisi = telo => {
    const id = `1111111a-1111-4111-8111-${String(++brojac).padStart(12, '0')}`;
    const red = {
      id,
      user_id: korisnik,                        /* nametnuto, šta god pošiljalac tvrdi */
      stanje: 'radi',                           /* nametnuto */
      tekst: null, greska: null
    };
    redovi.set(id, red);
    return [{ ...red }];
  };

  /* BEFORE UPDATE: ai_posao_prelaz */
  const izmeni = (red, polja) => {
    if (polja.user_id !== undefined && polja.user_id !== red.user_id) {
      odbijeno.push('AI_POSAO_TUDJI'); return { ok: false, kod: 'AI_POSAO_TUDJI' };
    }
    if (polja.stanje !== undefined && polja.stanje !== red.stanje) {
      if (polja.stanje === 'radi') {
        odbijeno.push(`AI_POSAO_PONOVO (${red.stanje} -> radi)`);
        return { ok: false, kod: 'AI_POSAO_PONOVO' };
      }
      const legalno =
        (red.stanje === 'radi'   && polja.stanje === 'u_toku') ||
        (red.stanje === 'u_toku' && ['gotovo', 'greska'].includes(polja.stanje));
      if (!legalno) {
        odbijeno.push(`AI_POSAO_PRELAZ (${red.stanje} -> ${polja.stanje})`);
        return { ok: false, kod: 'AI_POSAO_PRELAZ' };
      }
    }
    Object.assign(red, polja);
    return { ok: true };
  };

  return { redovi, upisi, izmeni, odbijeno };
}

const J = (b, ok = true, status = 200) => ({
  ok, status, json: async () => b, text: async () => JSON.stringify(b)
});

function stub(baza, stanje) {
  globalThis.fetch = async (url, opt) => {
    const u = String(url), metod = (opt && opt.method) || 'GET';

    if (u.includes('/auth/v1/user')) return J({ id: 'u1', email: 'k@t.rs' });
    if (u.includes('check_and_bump_api_usage')) { stanje.brojano++; return J({}); }
    if (u.includes('check_and_bump_endpoint')) return J({});
    if (u.includes('generativelanguage')) {
      stanje.model++;
      return J({ candidates: [{ content: { parts: [{ text: 'Analiza treninga.' }] } }] });
    }
    if (u.includes('/api/push')) return J({ ok: true });

    if (u.includes('/rest/v1/ai_posao')) {
      const idm = /id=eq\.([0-9a-f-]+)/.exec(u);
      const red = idm ? baza.redovi.get(idm[1]) : null;

      if (metod === 'POST')   return J(baza.upisi(JSON.parse(opt.body)));
      if (metod === 'DELETE') return J([]);          /* čišćenje starih — uvek prolazi */

      if (metod === 'PATCH') {
        /* PostgREST filtrira PA menja: red koji ne odgovara filteru se ne dira. */
        if (!red) return J([]);
        if (/stanje=eq\.radi/.test(u) && red.stanje !== 'radi') return J([]);
        const r = baza.izmeni(red, JSON.parse(opt.body));
        if (!r.ok) return J({ code: 'P0001', message: r.kod }, false, 400);
        return J([{ ...red }]);
      }

      /* GET */
      if (!red) return J([]);
      return J([{ stanje: red.stanje, tekst: red.tekst, greska: red.greska }]);
    }
    throw new Error('neočekivan poziv: ' + u);
  };
}

const zovi = async (telo) => {
  const { default: h } = await import('../api/analyze.js?t=' + Math.random());
  const res = { code: null, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
  await h({ method: 'POST', headers: { authorization: 'Bearer jwt' }, body: telo }, res);
  return res;
};

const SESIJA = { desc: 'Tempo 5 km', kind: 'Tempo', planPace: '4:00', q: 5 };
const UNETO = { km: 10, time: '40:00', hr: 150, rpe: 6, note: '' };

describe('Životni ciklus posla poštuje okidače u bazi', () => {

  test('pun tok (pokreni -> radi -> pročitaj) prolazi bez ijednog odbijenog prelaza', async () => {
    const baza = napraviBazu('u1');
    const stanje = { brojano: 0, model: 0 };
    stub(baza, stanje);

    const start = await zovi({ posao: 'start' });
    assert.equal(start.code, 200, 'pokretanje posla nije prošlo: ' + JSON.stringify(start.body));
    const id = start.body.posaoId;
    assert.ok(id, 'nema ID-a posla');
    assert.equal(baza.redovi.get(id).stanje, 'radi');

    const radi = await zovi({ posao: 'radi', posaoId: id, session: SESIJA, entered: UNETO });
    assert.equal(radi.code, 200, 'faza računa nije prošla');
    assert.equal(radi.body.gotovo, true, 'analiza nije završena uspešno');
    assert.equal(stanje.model, 1, 'model nije pozvan');

    const citaj = await zovi({ posao: 'citaj', posaoId: id });
    assert.equal(citaj.code, 200);
    assert.equal(citaj.body.stanje, 'gotovo', 'rezultat nije upisan kao gotov');
    assert.match(citaj.body.tekst, /Analiza/, 'tekst analize se izgubio');

    assert.deepEqual(baza.odbijeno, [],
      'server je pokušao prelaz koji baza odbija — analiza bi u produkciji pukla: ' +
      baza.odbijeno.join(', '));
  });

  test('neuspeh modela završava kao „greska", takođe dozvoljenim prelazom', async () => {
    const baza = napraviBazu('u1');
    const stanje = { brojano: 0, model: 0 };
    stub(baza, stanje);
    /* model odbija svaki poziv */
    const prethodni = globalThis.fetch;
    globalThis.fetch = async (u, o) => String(u).includes('generativelanguage')
      ? J({ error: 'nope' }, false, 500) : prethodni(u, o);

    const start = await zovi({ posao: 'start' });
    const id = start.body.posaoId;
    const radi = await zovi({ posao: 'radi', posaoId: id, session: SESIJA, entered: UNETO });
    assert.equal(radi.code, 200);
    assert.equal(radi.body.gotovo, false);
    assert.equal(baza.redovi.get(id).stanje, 'greska', 'neuspeh nije upisan');
    assert.deepEqual(baza.odbijeno, [], 'neuspešan put je pokušao zabranjen prelaz');
  });

  test('drugi pokušaj iste faze ne dira model i ne pravi zabranjen prelaz', async () => {
    /* Dva paralelna zahteva za isti posao: drugi mora da nađe red već preuzet
       (filter `stanje=eq.radi` ga ne pogađa) i da tiho odustane. */
    const baza = napraviBazu('u1');
    const stanje = { brojano: 0, model: 0 };
    stub(baza, stanje);

    const id = (await zovi({ posao: 'start' })).body.posaoId;
    await zovi({ posao: 'radi', posaoId: id, session: SESIJA, entered: UNETO });
    const drugi = await zovi({ posao: 'radi', posaoId: id, session: SESIJA, entered: UNETO });

    assert.equal(drugi.code, 200);
    assert.equal(drugi.body.vec, true, 'drugi pokušaj nije prepoznao da je posao već preuzet');
    assert.equal(stanje.model, 1, 'model je pozvan dvaput za isti posao');
    assert.deepEqual(baza.odbijeno, [], 'drugi pokušaj je pokušao zabranjen prelaz');
  });
});

describe('Napad koji su okidači i uveli da zatvore', () => {

  test('vraćanje završenog posla u „radi" baza odbija', async () => {
    /* Ovo je bio ceo napad: korisnik ima anon ključ (javan po dizajnu) i svoj
       JWT, pa je jednim PATCH-om vraćao gotov posao u red za obradu. Faza
       'radi' ne troši dnevni limit — pa je jedna izbrojana analiza otključavala
       neograničeno mnogo neizbrojanih. */
    const baza = napraviBazu('u1');
    const stanje = { brojano: 0, model: 0 };
    stub(baza, stanje);

    const id = (await zovi({ posao: 'start' })).body.posaoId;
    await zovi({ posao: 'radi', posaoId: id, session: SESIJA, entered: UNETO });
    assert.equal(baza.redovi.get(id).stanje, 'gotovo');

    /* napadač direktno ka PostgREST-u, mimo /api/analyze */
    const r = baza.izmeni(baza.redovi.get(id), { stanje: 'radi' });
    assert.equal(r.ok, false, 'gotov posao je vraćen u red — limit je i dalje zaobilazan');
    assert.equal(r.kod, 'AI_POSAO_PONOVO');
    assert.equal(baza.redovi.get(id).stanje, 'gotovo', 'stanje je ipak promenjeno');
  });

  test('preskakanje stanja (radi -> gotovo) baza odbija', async () => {
    const baza = napraviBazu('u1');
    baza.upisi({});
    const red = [...baza.redovi.values()][0];
    const r = baza.izmeni(red, { stanje: 'gotovo', tekst: 'podmetnuto' });
    assert.equal(r.ok, false, 'posao je preskočio obradu');
    assert.equal(r.kod, 'AI_POSAO_PRELAZ');
  });

  test('nov red se ne može upisati u tuđe ime ni u tuđem stanju', async () => {
    const baza = napraviBazu('u1');
    const [red] = baza.upisi({ user_id: 'napadac', stanje: 'gotovo', tekst: 'podmetnuto' });
    assert.equal(red.user_id, 'u1', 'red je upisan u tuđe ime');
    assert.equal(red.stanje, 'radi', 'klijent je diktirao početno stanje');
    assert.equal(red.tekst, null, 'klijent je podmetnuo tekst analize');
  });
});
