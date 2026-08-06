/* OBAVEŠTENJA, POZADINSKI I POVREMENI UPIS.

   Web Push je jedno mesto gde „izgleda da radi" ne znači ništa: pogrešan
   bajt u šifrovanju ili DER-u ne pravi grešku nego TIŠINU — push servis
   vrati 201, a na telefon ne stigne ništa. Zato se ovde kriptografija ne
   proverava po obliku nego po ishodu: test glumi PREGLEDAČ, dešifruje ono
   što je server poslao i poredi sa originalom.

   Drugi deo radi isto sa service workerom: sw.js se pušta u pravom sandbox-u
   sa lažnim IndexedDB-om i lažnim fetch-om, pa se `sync` događaj zaista
   okine. Provera je da li se red obriše ili sačuva — to je jedina razlika
   između „upis stigne kad se veza vrati" i „upis se ponavlja u beskraj". */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import {
  createECDH, createHmac, createDecipheriv, createPublicKey, verify, randomBytes
} from 'node:crypto';
import { readRepoFile } from './harness.mjs';

const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const odB64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/* Par ključeva P-256, napravljen SAMO ZA OVAJ TEST i namerno ovde vidljiv:
   provera potpisa nema smisla bez pravog para. NIKAD ne koristiti u radu —
   privatni ključ stoji u javnom repozitorijumu. Produkcijski par pravi
   `node scripts/vapid.mjs` i živi isključivo u Vercel okruženju. */
const VAPID_PUB = 'BKehPjxi6lJF9-yuESqsl5DQ8rqsfWJcvHnCKYrGqkn83dNsWyvT_ve7_R_HufZ8kqWf9rdUfPw9d9aKfW6Rda8';
const VAPID_PRIV = 'MJ0ol-TwaRrXjQyblH4pmmsZSncM0Ig-pPQQziVb4WM';

const ENV = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'srv',
  CRON_SECRET: 'tajna',
  VAPID_PUBLIC_KEY: VAPID_PUB,
  VAPID_PRIVATE_KEY: VAPID_PRIV,
  VAPID_SUBJECT: 'mailto:a@b.c'
};

const origFetch = globalThis.fetch;
const staroOkruzenje = {};
beforeEach(() => { for (const k of Object.keys(ENV)) { staroOkruzenje[k] = process.env[k]; process.env[k] = ENV[k]; } });
afterEach(() => {
  for (const k of Object.keys(ENV)) { if (staroOkruzenje[k] === undefined) delete process.env[k]; else process.env[k] = staroOkruzenje[k]; }
  globalThis.fetch = origFetch;
});

const uvezi = () => import('../api/push.js?t=' + Math.random());

function res() {
  const r = { code: null, body: null, headers: {} };
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
}

/* ==========================================================================
   PREGLEDAČ NA DRUGOJ STRANI — pravi primalac, ne provera oblika.
   ========================================================================== */
function napraviUredjaj() {
  const ecdh = createECDH('prime256v1');
  const javni = ecdh.generateKeys();
  const auth = randomBytes(16);
  return { ecdh, p256dh: b64u(javni), auth: b64u(auth), authSirov: auth, javni };
}
function hmac(k, d) { return createHmac('sha256', k).update(d).digest(); }
function hkdf(salt, ikm, info, n) { return hmac(hmac(salt, ikm), Buffer.concat([info, Buffer.from([1])])).slice(0, n); }

/* RFC 8291 sa strane pregledača: raspakuj zaglavlje, izvedi isti ključ preko
   ECDH-a, dešifruj, skini graničnik. */
function desifruj(telo, uredjaj) {
  const salt = telo.subarray(0, 16);
  const rs = telo.readUInt32BE(16);
  const idlen = telo.readUInt8(20);
  const serverJavni = telo.subarray(21, 21 + idlen);
  const sifrat = telo.subarray(21 + idlen);
  const deljena = uredjaj.ecdh.computeSecret(serverJavni);
  const ikm = hkdf(uredjaj.authSirov, deljena,
    Buffer.concat([Buffer.from('WebPush: info\0', 'utf8'), uredjaj.javni, serverJavni]), 32);
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12);
  const d = createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(sifrat.subarray(sifrat.length - 16));
  const otvoren = Buffer.concat([d.update(sifrat.subarray(0, sifrat.length - 16)), d.final()]);
  return { rs, granicnik: otvoren[otvoren.length - 1], tekst: otvoren.subarray(0, otvoren.length - 1).toString('utf8') };
}

describe('Šifrovanje sadržaja (RFC 8291)', () => {
  test('ono što server pošalje pregledač zaista dešifruje', async () => {
    const { sifruj } = await uvezi();
    const u = napraviUredjaj();
    const poruka = JSON.stringify({ naslov: 'Danas na planu', telo: '8×400 m · 12 km — čučnji, đubre, š' });
    const paket = sifruj(poruka, u.p256dh, u.auth);
    assert.equal(desifruj(paket, u).tekst, poruka);
  });

  test('svaka poruka ima novu so i nov ključ — dva ista teksta nisu isti bajtovi', async () => {
    /* Ponovljena so sa istim ključem obara AES-GCM u potpunosti. Nema kako da
       se to primeti u radu — samo u ovakvom testu. */
    const { sifruj } = await uvezi();
    const u = napraviUredjaj();
    const a = sifruj('isto', u.p256dh, u.auth), b = sifruj('isto', u.p256dh, u.auth);
    assert.ok(!a.subarray(0, 16).equals(b.subarray(0, 16)), 'so se ponavlja');
    assert.ok(!a.subarray(21, 86).equals(b.subarray(21, 86)), 'ephemeral ključ se ponavlja');
  });

  test('graničnik je 0x02 — inače pregledač čeka još jedan zapis i ćuti', async () => {
    const { sifruj } = await uvezi();
    const u = napraviUredjaj();
    const r = desifruj(sifruj('x', u.p256dh, u.auth), u);
    assert.equal(r.granicnik, 2);
  });

  test('zapis staje u prijavljeni rs', async () => {
    const { sifruj } = await uvezi();
    const u = napraviUredjaj();
    const paket = sifruj('a'.repeat(500), u.p256dh, u.auth);
    const r = desifruj(paket, u);
    assert.ok(paket.length - 86 <= r.rs, 'zapis je veći od rs iz zaglavlja');
  });

  test('preduga poruka baca, ne šalje se u komadu koji primalac odbacuje', async () => {
    const { sifruj } = await uvezi();
    const u = napraviUredjaj();
    assert.throws(() => sifruj('a'.repeat(5000), u.p256dh, u.auth), /preduga/);
  });

  test('pokvaren p256dh baca odmah, ne pravi paket koji nikad ne stigne', async () => {
    const { sifruj } = await uvezi();
    const u = napraviUredjaj();
    assert.throws(() => sifruj('x', 'kratko', u.auth), /p256dh/);
    assert.throws(() => sifruj('x', u.p256dh, 'kratko'), /auth/);
  });
});

describe('VAPID zaglavlje (RFC 8292)', () => {
  test('potpis se proverava javnim ključem iz istog zaglavlja', async () => {
    const { vapidZaglavlje } = await uvezi();
    const zag = vapidZaglavlje('https://fcm.googleapis.com/fcm/send/abc', VAPID_PUB, VAPID_PRIV, 'mailto:a@b.c');
    const m = /^vapid t=([^,]+), k=(.+)$/.exec(zag);
    assert.ok(m, 'zaglavlje nije u obliku „vapid t=…, k=…"');
    const [glava, telo, potpis] = m[1].split('.');
    const sirovi = odB64u(potpis);
    assert.equal(sirovi.length, 64, 'potpis nije sirov r‖s (DER bi bio ~70 i FCM bi vratio 401)');

    const tacka = odB64u(m[2]);
    const kljuc = createPublicKey({
      key: { kty: 'EC', crv: 'P-256', x: b64u(tacka.subarray(1, 33)), y: b64u(tacka.subarray(33, 65)) },
      format: 'jwk'
    });
    assert.ok(verify('sha256', Buffer.from(glava + '.' + telo), { key: kljuc, dsaEncoding: 'ieee-p1363' }, sirovi),
      'potpis se ne proverava objavljenim ključem');
    assert.equal(b64u(tacka), VAPID_PUB, 'k= nije javni par privatnog ključa');
  });

  /* Zaglavlje je „vapid t=<jwt>, k=<kljuc>" — JWT se vadi po tom obliku, ne
     deljenjem cele niske po tački. */
  const jwtDelovi = zag => /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(zag);
  const jwtTelo = zag => JSON.parse(odB64u(jwtDelovi(zag)[2]).toString('utf8'));

  test('aud je POREKLO endpointa, ne ceo URL', async () => {
    /* Sa celim URL-om FCM vraća 401 bez objašnjenja u telu. */
    const { vapidZaglavlje } = await uvezi();
    const zag = vapidZaglavlje('https://web.push.apple.com/put/dugacko/ime?a=1', VAPID_PUB, VAPID_PRIV, 'mailto:a@b.c');
    const telo = jwtTelo(zag);
    assert.equal(telo.aud, 'https://web.push.apple.com');
    assert.equal(telo.sub, 'mailto:a@b.c');
  });

  test('rok trajanja je unutar 24 h koje specifikacija dozvoljava', async () => {
    const { vapidZaglavlje } = await uvezi();
    const sada = 1786000000000;
    const zag = vapidZaglavlje('https://a.b/c', VAPID_PUB, VAPID_PRIV, 'mailto:a@b.c', sada);
    const razlika = jwtTelo(zag).exp - Math.floor(sada / 1000);
    assert.ok(razlika > 0 && razlika <= 24 * 3600, 'exp je ' + razlika + ' s — van dozvoljenog opsega');
    assert.equal(JSON.parse(odB64u(jwtDelovi(zag)[1]).toString('utf8')).alg, 'ES256');
  });

  test('neispravni ključevi daju null, ne izmišljen potpis', async () => {
    const { vapidZaglavlje, vapidKljuc } = await uvezi();
    assert.equal(vapidKljuc('', ''), null);
    assert.equal(vapidKljuc(VAPID_PUB, 'kratko'), null);
    assert.equal(vapidKljuc(b64u(Buffer.alloc(65)), VAPID_PRIV), null, 'tačka bez 0x04 prefiksa je prošla');
    assert.equal(vapidZaglavlje('https://a.b/c', '', '', 'mailto:a@b.c'), null);
    assert.equal(vapidZaglavlje('nije-url', VAPID_PUB, VAPID_PRIV, 'mailto:a@b.c'), null);
  });
});

describe('Jutarnji podsetnik — šta se šalje kome', () => {
  test('dan odmora ne budi telefon', async () => {
    const { podsetnikZa } = await uvezi();
    assert.equal(podsetnikZa({ '2026-08-07': '' }, '2026-08-07'), null);
    assert.equal(podsetnikZa({ '2026-08-07': '   ' }, '2026-08-07'), null);
  });

  test('dan sa treningom nosi tekst koji je aplikacija upisala', async () => {
    const { podsetnikZa } = await uvezi();
    const p = podsetnikZa({ '2026-08-07': '8×400 m · 12 km' }, '2026-08-07');
    assert.equal(p.telo, '8×400 m · 12 km');
    assert.equal(p.oznaka, 'plan');
  });

  test('bez najave za danas ide opšta poruka, ne tuđi trening', async () => {
    /* Najave stare nedelju dana. Kad aplikacija nije otvarana toliko, ključa
       za današnji dan nema — i tada NE sme da se posegne za bilo kojim
       drugim datumom iz mape. */
    const { podsetnikZa } = await uvezi();
    const p = podsetnikZa({ '2026-08-01': 'Tempo 8 km' }, '2026-08-07');
    assert.ok(p && !/Tempo/.test(p.telo), 'poslat je trening sa pogrešnog datuma');
    assert.equal(podsetnikZa(null, '2026-08-07').oznaka, 'plan');
  });

  test('najave se čiste pre upisa u bazu', async () => {
    const { ocistiNajave } = await uvezi();
    assert.equal(ocistiNajave(null), null);
    assert.equal(ocistiNajave([1, 2]), null);
    assert.equal(ocistiNajave({ nijeDatum: 'x' }), null);
    const puno = {};
    for (let i = 1; i <= 30; i++) puno['2026-08-' + String(i).padStart(2, '0')] = 'x'.repeat(200);
    const c = ocistiNajave(puno);
    assert.equal(Object.keys(c).length, 14, 'broj dana nije ograničen');
    assert.equal(Object.values(c)[0].length, 120, 'dužina teksta nije ograničena');
  });
});

describe('Rukovalac — ko sme šta', () => {
  test('GET bez tajne vraća javni ključ i NE šalje nijedno obaveštenje', async () => {
    let pozivi = 0;
    globalThis.fetch = async () => { pozivi++; return { ok: true, json: async () => [] }; };
    const { default: h } = await uvezi();
    const r = res();
    await h({ method: 'GET', headers: {} }, r);
    assert.equal(r.code, 200);
    assert.equal(r.body.kljuc, VAPID_PUB);
    assert.equal(r.body.podeseno, true);
    assert.equal(pozivi, 0, 'neprijavljen GET je pokrenuo slanje');
  });

  test('GET sa pogrešnom tajnom i dalje ne pokreće slanje', async () => {
    let pozivi = 0;
    globalThis.fetch = async () => { pozivi++; return { ok: true, json: async () => [] }; };
    const { default: h } = await uvezi();
    const r = res();
    await h({ method: 'GET', headers: { authorization: 'Bearer pogresno' } }, r);
    assert.equal(pozivi, 0);
    assert.ok(r.body.kljuc);
  });

  test('privatni ključ ne izlazi ni u jednom odgovoru', async () => {
    const { default: h } = await uvezi();
    const r = res();
    await h({ method: 'GET', headers: {} }, r);
    assert.ok(!JSON.stringify(r.body).includes(VAPID_PRIV), 'privatni ključ je u odgovoru');
  });

  test('unutrašnje slanje traži CRON_SECRET', async () => {
    let pozivi = 0;
    globalThis.fetch = async () => { pozivi++; return { ok: true, json: async () => [] }; };
    const { default: h } = await uvezi();
    const r = res();
    await h({ method: 'POST', headers: {}, body: { akcija: 'posalji', userId: 'u1', telo: 'x' } }, r);
    assert.equal(r.code, 401);
    assert.equal(pozivi, 0);
  });

  test('prijava uređaja traži prijavljenog korisnika', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}), text: async () => '' });
    const { default: h } = await uvezi();
    const r = res();
    await h({ method: 'POST', headers: { authorization: 'Bearer lose' },
      body: { akcija: 'prijava', pretplata: { endpoint: 'https://a.b/c', keys: { p256dh: 'x', auth: 'y' } } } }, r);
    assert.equal(r.code, 401);
  });

  test('nepotpuna pretplata se odbija pre nego što dođe do baze', async () => {
    const upisi = [];
    globalThis.fetch = async (u, o) => {
      if (String(u).includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'u1' }) };
      upisi.push(String(u));
      return { ok: true, json: async () => [], text: async () => '' };
    };
    const { default: h } = await uvezi();
    for (const p of [{ endpoint: 'http://a.b/c', keys: { p256dh: 'x', auth: 'y' } },
                     { endpoint: 'https://a.b/c', keys: { p256dh: 'x' } }]) {
      const r = res();
      await h({ method: 'POST', headers: { authorization: 'Bearer ok' }, body: { akcija: 'prijava', pretplata: p } }, r);
      assert.equal(r.code, 400);
    }
    assert.equal(upisi.length, 0, 'pokvarena pretplata je stigla do baze');
  });

  test('mrtva pretplata (410) se briše, ostale i dalje dobijaju poruku', async () => {
    /* Bez brisanja bi se ugašeni telefoni gomilali i svaki sledeći podsetnik
       bio sporiji za njihov broj — sve dok cron ne prestane da stiže do kraja. */
    const u1 = napraviUredjaj(), u2 = napraviUredjaj();
    const brisano = [];
    let poslato = 0;
    globalThis.fetch = async (url, opt) => {
      const s = String(url);
      if (s.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'u1' }) };
      if (s.includes('push_pretplata') && (!opt || opt.method !== 'DELETE')) {
        return { ok: true, status: 200, json: async () => [
          { id: 'a', endpoint: 'https://mrtav.example/1', p256dh: u1.p256dh, auth: u1.auth, najave: {} },
          { id: 'b', endpoint: 'https://ziv.example/2', p256dh: u2.p256dh, auth: u2.auth, najave: {} }
        ] };
      }
      if (s.includes('push_pretplata') && opt.method === 'DELETE') { brisano.push(s); return { ok: true, json: async () => [] }; }
      if (s.startsWith('https://mrtav.example')) return { ok: false, status: 410 };
      poslato++;
      return { ok: true, status: 201 };
    };
    const { default: h } = await uvezi();
    const r = res();
    await h({ method: 'POST', headers: { authorization: 'Bearer ok' }, body: { akcija: 'proba' } }, r);
    assert.equal(poslato, 1, 'živ uređaj nije dobio poruku');
    assert.equal(brisano.length, 1, 'mrtva pretplata nije obrisana');
    assert.ok(brisano[0].includes('id=eq.a'));
  });

  test('cron preskače dane odmora i ne troši poziv na njih', async () => {
    let poslato = 0;
    globalThis.fetch = async (url, opt) => {
      const s = String(url);
      if (s.includes('push_pretplata') && (!opt || opt.method !== 'DELETE')) {
        const strana = (opt.headers.Range || '').startsWith('0-');
        return { ok: true, status: 200, json: async () => strana ? [
          { id: 'a', endpoint: 'https://a.example/1', p256dh: napraviUredjaj().p256dh, auth: b64u(randomBytes(16)), najave: { [danasnji()]: '' } },
          { id: 'b', endpoint: 'https://b.example/2', p256dh: napraviUredjaj().p256dh, auth: b64u(randomBytes(16)), najave: { [danasnji()]: 'Tempo 8 km' } }
        ] : [] };
      }
      poslato++;
      return { ok: true, status: 201 };
    };
    const { default: h, danasBeograd } = await uvezi();
    function danasnji() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Belgrade' }).format(new Date()); }
    const r = res();
    await h({ method: 'GET', headers: { authorization: 'Bearer tajna' } }, r);
    assert.equal(r.body.preskoceno, 1, 'dan odmora nije preskočen');
    assert.equal(poslato, 1, 'poslato je ' + poslato + ' poruka umesto jedne');
    assert.equal(r.body.danas, danasBeograd());
  });
});

/* ==========================================================================
   SERVICE WORKER U SANDBOX-u
   ========================================================================== */
function lazniIDB(pocetno) {
  const mapa = new Map(Object.entries(pocetno || {}));
  const zahtev = v => { const z = {}; queueMicrotask(() => { z.result = v; if (z.onsuccess) z.onsuccess(); }); return z; };
  const skladiste = {
    get: k => zahtev(mapa.get(k)),
    put: (v, k) => { mapa.set(k, v); return zahtev(undefined); },
    delete: k => { mapa.delete(k); return zahtev(undefined); }
  };
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => {},
    transaction: () => ({ objectStore: () => skladiste })
  };
  return { mapa, api: { open: () => zahtev(db) } };
}

function pustiSw(opcije = {}) {
  const idb = lazniIDB(opcije.idb);
  const slusaoci = {};
  const pozivi = [];
  const ctx = {
    console, queueMicrotask, setTimeout, clearTimeout,
    URL, Intl, atob: s => Buffer.from(s, 'base64').toString('binary'),
    indexedDB: idb.api,
    caches: { open: async () => ({ add: async () => {}, put: async () => {} }), keys: async () => [], match: async () => null, delete: async () => true },
    fetch: async (u, o) => { pozivi.push({ url: String(u), opt: o || {} }); return (opcije.fetch || (async () => ({ ok: true, status: 200 })))(String(u), o || {}); },
    location: { href: 'https://sub-19.vercel.app/sw.js', origin: 'https://sub-19.vercel.app' },
    self: {
      addEventListener: (t, f) => { slusaoci[t] = f; },
      /* U pravom service workeru `self` JESTE globalni objekat, pa je
         `self.location` isto što i `location`. Bez ovoga bi `new URL(…,
         self.location.href)` bacao, sandbox bi tiho padao u rezervnu granu i
         test bi merio nešto sasvim deseto. */
      location: { href: 'https://sub-19.vercel.app/sw.js', origin: 'https://sub-19.vercel.app' },
      registration: {
        scope: 'https://sub-19.vercel.app/',
        showNotification: async (n, o) => { pozivi.push({ obavestenje: n, opcije: o }); },
        update: async () => {},
        pushManager: { subscribe: async () => null }
      },
      clients: { matchAll: async () => opcije.klijenti || [], claim: async () => {}, openWindow: async () => {} },
      skipWaiting: () => {}
    }
  };
  ctx.globalThis = ctx;
  runInNewContext(readRepoFile('sw.js'), ctx);
  return { slusaoci, pozivi, idb, ctx };
}

/* Okine događaj i sačeka posao koji je predat preko waitUntil. */
async function okini(sw, tip, dogadjaj) {
  let obecanje = null;
  const e = Object.assign({ waitUntil: p => { obecanje = p; } }, dogadjaj);
  sw.slusaoci[tip](e);
  return obecanje;
}

const NALOG = {
  url: 'https://x.supabase.co', anon: 'anon', userId: 'u1', uredjaj: 'ovaj',
  access: 'jwt', isticeMs: Date.now() + 3600e3, vapid: VAPID_PUB
};
const RED = { seenAt: '2026-08-06T10:00:00Z', podaci: { v: 9 }, at: Date.now() };

describe('Pozadinski upis stanja (Background Sync)', () => {
  test('uspešan upis briše red — inače bi se ponavljao doveka', async () => {
    const sw = pustiSw({
      idb: { nalog: NALOG, stanje: RED },
      fetch: async u => u.includes('select=updated_at')
        ? { ok: true, status: 200, json: async () => [] }
        : { ok: true, status: 201 }
    });
    await okini(sw, 'sync', { tag: 'sub19-stanje' });
    assert.equal(sw.idb.mapa.has('stanje'), false);
    const upis = sw.pozivi.find(p => p.opt.method === 'POST');
    assert.ok(upis, 'upis se nije ni desio');
    assert.equal(JSON.parse(upis.opt.body).device_id, 'ovaj');
  });

  test('tuđa novija izmena se NE gazi — stanje je jedan blob', async () => {
    /* Prepis bi obrisao celu sesiju sa drugog uređaja, ne samo sukobljeno
       polje. Sukob ume da reši samo aplikacija, jer ume da pita. */
    const sw = pustiSw({
      idb: { nalog: NALOG, stanje: RED },
      fetch: async u => u.includes('select=updated_at')
        ? { ok: true, status: 200, json: async () => [{ updated_at: '2026-08-06T12:00:00Z', device_id: 'drugi' }] }
        : { ok: true, status: 201 }
    });
    await okini(sw, 'sync', { tag: 'sub19-stanje' });
    assert.equal(sw.pozivi.some(p => p.opt.method === 'POST'), false, 'tuđa novija izmena je pregažena');
    assert.equal(sw.idb.mapa.has('stanje'), false, 'red je ostao i pokušaće ponovo');
  });

  test('sopstvena ranija izmena sa istog uređaja se sme prepisati', async () => {
    const sw = pustiSw({
      idb: { nalog: NALOG, stanje: RED },
      fetch: async u => u.includes('select=updated_at')
        ? { ok: true, status: 200, json: async () => [{ updated_at: '2026-08-06T12:00:00Z', device_id: 'ovaj' }] }
        : { ok: true, status: 201 }
    });
    await okini(sw, 'sync', { tag: 'sub19-stanje' });
    assert.ok(sw.pozivi.some(p => p.opt.method === 'POST'), 'sopstvena izmena je pogrešno protumačena kao sukob');
  });

  test('istekao token odustaje TIHO — ponavljanje ne bi ništa promenilo', async () => {
    const sw = pustiSw({
      idb: { nalog: Object.assign({}, NALOG, { isticeMs: Date.now() - 10e3 }), stanje: RED }
    });
    await okini(sw, 'sync', { tag: 'sub19-stanje' });   /* ne sme da baci */
    assert.equal(sw.pozivi.length, 0);
    assert.equal(sw.idb.mapa.has('stanje'), false);
  });

  test('token se NE osvežava iz pozadine — rotacija bi odjavila korisnika', async () => {
    /* Supabase pri osvežavanju rotira refresh token. Da ga service worker
       potroši, kopija u localStorage bi postala neupotrebljiva. */
    const sw = pustiSw({ idb: { nalog: NALOG, stanje: RED }, fetch: async () => ({ ok: true, status: 201, json: async () => [] }) });
    await okini(sw, 'sync', { tag: 'sub19-stanje' });
    assert.equal(sw.pozivi.some(p => p.url.includes('grant_type=refresh_token')), false,
      'service worker je potrošio refresh token');
    assert.ok(!/refresh/.test(JSON.stringify([...sw.idb.mapa.values()])), 'refresh token je u IndexedDB-u');
  });

  test('privremena greška (5xx) baca da bi pregledač ponovio', async () => {
    const sw = pustiSw({
      idb: { nalog: NALOG, stanje: RED },
      fetch: async u => u.includes('select=updated_at')
        ? { ok: true, status: 200, json: async () => [] }
        : { ok: false, status: 503 }
    });
    await assert.rejects(() => okini(sw, 'sync', { tag: 'sub19-stanje' }));
    assert.equal(sw.idb.mapa.has('stanje'), true, 'red je obrisan pa ponavljanje nema šta da pošalje');
  });

  test('trajna greška (4xx) ne ponavlja — posao preuzima aplikacija', async () => {
    const sw = pustiSw({
      idb: { nalog: NALOG, stanje: RED },
      fetch: async u => u.includes('select=updated_at')
        ? { ok: true, status: 200, json: async () => [] }
        : { ok: false, status: 401 }
    });
    await okini(sw, 'sync', { tag: 'sub19-stanje' });
    assert.equal(sw.idb.mapa.has('stanje'), false);
  });

  test('tuđa oznaka se ignoriše', async () => {
    const sw = pustiSw({ idb: { nalog: NALOG, stanje: RED } });
    await okini(sw, 'sync', { tag: 'nesto-drugo' });
    assert.equal(sw.pozivi.length, 0);
    assert.equal(sw.idb.mapa.has('stanje'), true);
  });
});

describe('Obaveštenja u service workeru', () => {
  test('svaki push završi kao vidljivo obaveštenje', async () => {
    /* `userVisibleOnly` je obavezan: posle nekoliko push-eva bez obaveštenja
       pregledač ODUZME dozvolu. Zato nijedna grana ne sme da ćuti. */
    const sw = pustiSw();
    await okini(sw, 'push', { data: { json: () => ({ naslov: 'Danas na planu', telo: '8×400 m', url: './?tab=danas' }) } });
    const o = sw.pozivi.find(p => p.obavestenje);
    assert.equal(o.obavestenje, 'Danas na planu');
    assert.equal(o.opcije.body, '8×400 m');
    assert.equal(o.opcije.data.url, './?tab=danas');
  });

  test('push bez tela i dalje daje obaveštenje', async () => {
    const sw = pustiSw();
    await okini(sw, 'push', { data: { json: () => { throw new Error('nije JSON'); }, text: () => 'gola poruka' } });
    assert.ok(sw.pozivi.find(p => p.obavestenje), 'push bez ispravnog JSON-a je prošao bez obaveštenja');
  });

  test('„tiho" ćuti SAMO kad je aplikacija stvarno vidljiva', async () => {
    const poruke = [];
    const vidljiv = { visibilityState: 'visible', url: 'https://sub-19.vercel.app/', postMessage: m => poruke.push(m) };
    const sw = pustiSw({ klijenti: [vidljiv] });
    await okini(sw, 'push', { data: { json: () => ({ naslov: 'Analiza je gotova', oznaka: 'ai', tiho: true }) } });
    assert.equal(sw.pozivi.some(p => p.obavestenje), false, 'obaveštenje je iskočilo preko otvorene aplikacije');
    assert.equal(poruke[0].type, 'PUSH');

    const skriven = { visibilityState: 'hidden', url: 'https://sub-19.vercel.app/', postMessage: () => {} };
    const sw2 = pustiSw({ klijenti: [skriven] });
    await okini(sw2, 'push', { data: { json: () => ({ naslov: 'Analiza je gotova', oznaka: 'ai', tiho: true }) } });
    assert.ok(sw2.pozivi.some(p => p.obavestenje), 'skrivena aplikacija je ostala bez obaveštenja');
  });

  test('klik fokusira otvorenu aplikaciju umesto da otvori drugu', async () => {
    let fokusirano = 0, otvoreno = 0, navigirano = null;
    const k = { url: 'https://sub-19.vercel.app/', focus: () => { fokusirano++; }, navigate: u => { navigirano = u; return Promise.resolve(k); } };
    const sw = pustiSw({ klijenti: [k] });
    sw.ctx.self.clients.openWindow = async () => { otvoreno++; };
    await okini(sw, 'notificationclick', { notification: { close: () => {}, data: { url: './?tab=danas' } } });
    assert.equal(otvoreno, 0, 'napravljena je druga kopija aplikacije');
    assert.equal(navigirano, 'https://sub-19.vercel.app/?tab=danas');
    assert.equal(fokusirano, 1);
  });

  test('bez otvorene aplikacije klik je otvara', async () => {
    let otvoreno = null;
    const sw = pustiSw({ klijenti: [] });
    sw.ctx.self.clients.openWindow = async u => { otvoreno = u; };
    await okini(sw, 'notificationclick', { notification: { close: () => {}, data: { url: './' } } });
    assert.equal(otvoreno, 'https://sub-19.vercel.app/');
  });

  test('nova pretplata se sačuva i kad je ne može odmah javiti serveru', async () => {
    /* Bez ovoga obaveštenja tiho prestanu da stižu, a u Podešavanjima i dalje
       piše da su uključena. */
    const istekao = Object.assign({}, NALOG, { isticeMs: Date.now() - 10e3 });
    const sw = pustiSw({ idb: { nalog: istekao } });
    const nova = { toJSON: () => ({ endpoint: 'https://nov.example/x', keys: { p256dh: 'p', auth: 'a' } }) };
    await okini(sw, 'pushsubscriptionchange', { newSubscription: nova });
    const cek = sw.idb.mapa.get('pretplata-neposlata');
    assert.ok(cek && cek.pretplata.endpoint === 'https://nov.example/x', 'nova pretplata je izgubljena');
    assert.equal(sw.pozivi.length, 0, 'poslata je sa isteklim tokenom');
  });

  test('sa važećim tokenom se javi odmah i red se očisti', async () => {
    const sw = pustiSw({ idb: { nalog: NALOG }, fetch: async () => ({ ok: true, status: 200 }) });
    const nova = { toJSON: () => ({ endpoint: 'https://nov.example/x', keys: { p256dh: 'p', auth: 'a' } }) };
    await okini(sw, 'pushsubscriptionchange', { newSubscription: nova });
    assert.ok(sw.pozivi[0].url.endsWith('/api/push'));
    assert.equal(JSON.parse(sw.pozivi[0].opt.body).akcija, 'prijava');
    assert.equal(sw.idb.mapa.has('pretplata-neposlata'), false);
  });
});

describe('Povremeno osvežavanje (Periodic Sync)', () => {
  test('osvežava offline kopiju i pita za novu verziju', async () => {
    let osvezeno = 0, kesirano = 0;
    const sw = pustiSw();
    sw.ctx.self.registration.update = async () => { osvezeno++; };
    sw.ctx.caches.open = async () => ({ add: async () => { kesirano++; }, put: async () => {} });
    await okini(sw, 'periodicsync', { tag: 'sub19-osvezi' });
    assert.equal(osvezeno, 1);
    assert.ok(kesirano > 5, 'keširano je samo ' + kesirano + ' fajlova');
  });

  test('tuđa oznaka ne radi ništa', async () => {
    let osvezeno = 0;
    const sw = pustiSw();
    sw.ctx.self.registration.update = async () => { osvezeno++; };
    await okini(sw, 'periodicsync', { tag: 'nesto' });
    assert.equal(osvezeno, 0);
  });
});

describe('Doslednost aplikacije i service workera', () => {
  const app = readRepoFile('app.js');
  const sw = readRepoFile('sw.js');

  test('oznake poslova su iste sa obe strane', () => {
    /* Registracija sa jednom oznakom, slušanje sa drugom = posao koji se
       zakaže i nikad ne izvrši, bez ijedne poruke o grešci. */
    for (const oznaka of ['sub19-stanje', 'sub19-osvezi']) {
      assert.ok(app.includes(`'${oznaka}'`), `app.js ne pominje ${oznaka}`);
      assert.ok(sw.includes(`'${oznaka}'`), `sw.js ne pominje ${oznaka}`);
    }
  });

  test('IndexedDB baza i skladište su isti sa obe strane', () => {
    const izvuci = s => /IDB_BAZA\s*=\s*'([^']+)',\s*IDB_SKLAD\s*=\s*'([^']+)'/.exec(s);
    const a = izvuci(app), b = izvuci(sw);
    assert.ok(a && b, 'ime baze se ne nalazi u oba fajla');
    assert.deepEqual([a[1], a[2]], [b[1], b[2]]);
  });

  test('sw.js sluša sve što aplikacija registruje', () => {
    for (const dog of ['push', 'notificationclick', 'pushsubscriptionchange', 'sync', 'periodicsync']) {
      assert.ok(sw.includes(`addEventListener('${dog}'`), `sw.js ne sluša ${dog}`);
    }
  });

  test('pretplata je userVisibleOnly — bez toga je pregledač odbija', () => {
    assert.ok(/userVisibleOnly\s*:\s*true/.test(app));
  });

  test('sve što sw.js čita iz zapisa o nalogu, app.js zaista i upisuje', () => {
    /* UHVAĆENO U PREGLEDAČU: pri jednoj izmeni komentara ispalo je `access` iz
       objekta koji se upisuje. Ništa nije puklo — `guraniStanje` samo tiho
       odustane na prvoj liniji, pa pozadinski upis NIKAD ne radi, a u
       Podešavanjima i dalje sve izgleda ispravno. Ovo poredi dve strane. */
    const literal = /function pozadinskiNalog\([\s\S]*?\n\}/.exec(app)[0];
    const upisano = new Set([...literal.matchAll(/(\w+)\s*:/g)].map(m => m[1]));
    const citano = new Set([...sw.matchAll(/nalog\.(\w+)/g)].map(m => m[1]));
    for (const polje of citano) {
      assert.ok(upisano.has(polje), `sw.js čita nalog.${polje}, a app.js ga ne upisuje`);
    }
    assert.ok(citano.size >= 5, 'provera je prazna — regex više ne hvata polja');
    assert.ok(!upisano.has('refresh'), 'refresh token se upisuje u IndexedDB');
  });

  test('rok tokena je u ISTOJ jedinici sa obe strane', () => {
    /* Uhvaćeno u pregledaču: `SB.expiresAt` je apsolutan trenutak u
       MILISEKUNDAMA, a `S.strava.expiresAt` u istom fajlu je u SEKUNDAMA.
       Prva verzija je u sw.js množila sa 1000, pa je pozadini svaki token
       izgledao večno važeći — a onda bi upis pao na 401 i tiho nestao. */
    assert.ok(/isticeMs\s*:\s*SB\.expiresAt/.test(app), 'app.js ne upisuje isticeMs iz SB.expiresAt');
    assert.ok(!/isticeMs[^\n]*\*\s*1000/.test(sw), 'sw.js i dalje množi milisekunde sa 1000');
    assert.ok(/nalog\.isticeMs/.test(sw), 'sw.js ne čita isticeMs');
  });

  test('javni VAPID ključ NIJE ukucan u app.js', () => {
    /* Da jeste, promena ključeva na serveru bi ćutke razvalila sve pretplate:
       pregledač bi slao stari ključ, push servis vraćao 403, a Podešavanja
       tvrdila da su obaveštenja uključena. */
    assert.ok(!/B[A-Za-z0-9_-]{85}/.test(app), 'ključ je ukucan u klijentu umesto da se čita sa servera');
    assert.ok(/fetch\('\/api\/push'\)/.test(app), 'app.js ne čita ključ sa servera');
  });

  test('odjava sa naloga gasi i obaveštenja i pozadinu', () => {
    /* Inače bi service worker zadržao tokene i neposlato stanje i gurnuo ih
       posle odjave — na zajedničkom telefonu u tuđ nalog. */
    const telo = /function sbLogout\(\)\{[\s\S]*?\n\}/.exec(app)[0];
    assert.ok(/pushIskljuci/.test(telo) && /pozadinskiZaboravi/.test(telo));
  });

  test('cron za podsetnik postoji i ide pre podneva', () => {
    const v = JSON.parse(readRepoFile('vercel.json'));
    const c = v.crons.find(x => x.path === '/api/push');
    assert.ok(c, 'nema cron zapisa za /api/push');
    const sat = Number(c.schedule.split(' ')[1]);
    assert.ok(sat >= 2 && sat <= 6, 'UTC ' + sat + ' h nije jutro po Beogradu');
    assert.equal(v.functions['api/push.js'].maxDuration, 60);
  });

  test('SQL za tabelu pretplata postoji i nosi RLS', () => {
    const sql = readRepoFile('supabase/push.sql');
    assert.ok(/create table if not exists public\.push_pretplata/.test(sql));
    assert.ok(/enable row level security/.test(sql));
    assert.ok(/endpoint\s+text\s+not null unique/.test(sql), 'endpoint nije jedinstven — isti telefon bi dobijao duple poruke');
    for (const p of ['select', 'insert', 'update', 'delete']) {
      assert.ok(new RegExp('for ' + p + '[\\s\\S]{0,60}auth\\.uid\\(\\) = user_id').test(sql), 'nedostaje RLS za ' + p);
    }
  });
});
