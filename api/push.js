/* /api/push.js — Web Push obaveštenja, bez ijedne spoljne biblioteke.

   ZAŠTO SVE STOJI U JEDNOM FAJLU
   Slanje push poruke traži dve stvari: potpisan VAPID token (RFC 8292) i
   šifrovan sadržaj (RFC 8291 / aes128gcm). To je stotinak linija kriptografije
   koju bi inače koristila i /api/analyze.js („analiza je gotova") i dnevni
   podsetnik. Ostatak koda u api/ namerno DUPLIRA sitne pomoćnike umesto da ih
   deli kroz modul (v. komentar uz requireUser u analyze.js) — ali stotinu
   linija kriptografije nije sitan pomoćnik i ne sme da postoji u dve kopije
   koje mogu da se raziđu.

   Zato je ovde JEDINO mesto koje šalje push. Ko god drugi želi da pošalje,
   pozove ovu putanju sa CRON_SECRET-om (v. akcija:'posalji'). Jedan HTTP skok
   unutar istog deploya je jeftiniji od druge kopije kriptografije.

   PUTANJE
     POST  {akcija:'prijava', pretplata, najave}  korisnikov token   upiši uređaj
     POST  {akcija:'odjava',  endpoint}           korisnikov token   obriši uređaj
     POST  {akcija:'najave',  najave}             korisnikov token   osveži najave
     POST  {akcija:'proba'}                       korisnikov token   pošalji sebi
     POST  {akcija:'posalji', userId, …}          CRON_SECRET        pošalji kome god
     POST  {akcija:'objava',  objava, posalji}    vlasnikov token    jednokratno svima
     GET   (bez zaglavlja)                        —                  vrati javni ključ
     GET   (Authorization: CRON_SECRET)           Vercel Cron        jutarnji podsetnik

   POTREBNE Vercel Environment Variables
     VAPID_PUBLIC_KEY   base64url, 65 bajtova (nekompresovana P-256 tačka)
     VAPID_PRIVATE_KEY  base64url, 32 bajta (privatni skalar)
     VAPID_SUBJECT      npr. mailto:tvoja@adresa — push servisi traže kontakt
     SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET

   Ključeve pravi `node scripts/vapid.mjs`. Privatni je TAJNA — ko ga ima može
   da šalje obaveštenja korisnicima ove aplikacije.

   AKO KLJUČEVI NISU PODEŠENI, sve i dalje radi: prijava vrati jasnu poruku,
   a aplikacija samo ne nudi obaveštenja. Nijedna druga funkcija ne zavisi
   od ovoga. */

import { createECDH, createHmac, createCipheriv, createPrivateKey, randomBytes, sign as ecdsaPotpis } from 'node:crypto';

/* ==========================================================================
   1. KRIPTOGRAFIJA
   ========================================================================== */

export function b64u(b) {
  return Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function odB64u(s) {
  return Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function hmac(kljuc, podaci) { return createHmac('sha256', kljuc).update(podaci).digest(); }

/* HKDF (RFC 5869) skraćen na jedan blok — sve tri izvedene vrednosti su
   ≤ 32 bajta (32, 16, 12), pa druga iteracija nikad ne bi bila potrebna.
   Puna petlja bi ovde bila mrtav kod koji niko ne bi testirao. */
function hkdf(salt, ikm, info, duzina) {
  return hmac(hmac(salt, ikm), Buffer.concat([info, Buffer.from([1])])).slice(0, duzina);
}

const INFO_KLJUC = Buffer.from('WebPush: info\0', 'utf8');
const INFO_CEK   = Buffer.from('Content-Encoding: aes128gcm\0', 'utf8');
const INFO_NONCE = Buffer.from('Content-Encoding: nonce\0', 'utf8');
/* Veličina zapisa iz zaglavlja aes128gcm. Ceo naš sadržaj staje u JEDAN
   zapis, pa mora važiti: tekst + 1 (graničnik) + 16 (GCM oznaka) ≤ RS.
   Push servisi ionako odbijaju telo veće od 4 KB — v. NAJVISE_BAJTA. */
const RS = 4096;
const NAJVISE_BAJTA = RS - 17 - 86;   /* 86 = zaglavlje (21) + javni ključ (65) */

/* RFC 8291: sadržaj se šifruje ključem izvedenim iz ECDH tajne između
   servera (ephemeral par, nov za svaku poruku) i pregledača (p256dh iz
   pretplate), posoljenim `auth` tajnom iste pretplate. Server ne može da
   pročita ono što je poslao — a push servis (Google/Apple/Mozilla) ne može
   da pročita ništa. */
export function sifruj(tekst, p256dh, authTajna) {
  const uaJavni = odB64u(p256dh);
  const auth = odB64u(authTajna);
  if (uaJavni.length !== 65) throw new Error('p256dh nije 65 bajtova');
  if (auth.length !== 16) throw new Error('auth nije 16 bajtova');

  const otvoren = Buffer.from(tekst, 'utf8');
  if (otvoren.length > NAJVISE_BAJTA) throw new Error('poruka je preduga za jedan zapis');

  const ecdh = createECDH('prime256v1');
  const serverJavni = ecdh.generateKeys();
  const deljena = ecdh.computeSecret(uaJavni);

  const ikm = hkdf(auth, deljena, Buffer.concat([INFO_KLJUC, uaJavni, serverJavni]), 32);
  const salt = randomBytes(16);
  const cek = hkdf(salt, ikm, INFO_CEK, 16);
  const nonce = hkdf(salt, ikm, INFO_NONCE, 12);

  /* 0x02 = graničnik POSLEDNJEG zapisa (RFC 8188). Sa 0x01 bi pregledač
     čekao još jedan zapis i tiho odbacio poruku. */
  const c = createCipheriv('aes-128-gcm', cek, nonce);
  const sifrat = Buffer.concat([c.update(Buffer.concat([otvoren, Buffer.from([2])])), c.final(), c.getAuthTag()]);

  const zaglavlje = Buffer.alloc(21);
  salt.copy(zaglavlje, 0);
  zaglavlje.writeUInt32BE(RS, 16);
  zaglavlje.writeUInt8(serverJavni.length, 20);
  return Buffer.concat([zaglavlje, serverJavni, sifrat]);
}

/* Privatni VAPID ključ se čuva kao 32 sirova bajta (tako ga daju svi alati),
   a `sign` traži KeyObject. Umesto biblioteke, sklapa se SEC1 DER omotač —
   za P-256 je fiksne dužine, pa je ceo „parser" jedan Buffer.concat.

   0x30 0x77            SEQUENCE, 119 bajtova sadržaja
   0x02 0x01 0x01       INTEGER 1 (verzija)
   0x04 0x20 …32…       OCTET STRING, privatni skalar
   0xa0 0x0a … OID …    [0] kriva prime256v1 (1.2.840.10045.3.1.7)
   0xa1 0x44 0x03 0x42 0x00 …65…   [1] BIT STRING, javna tačka */
export function vapidKljuc(javni, privatni) {
  const pub = odB64u(javni), priv = odB64u(privatni);
  if (pub.length !== 65 || pub[0] !== 4 || priv.length !== 32) return null;
  const der = Buffer.concat([
    Buffer.from([0x30, 0x77, 0x02, 0x01, 0x01, 0x04, 0x20]), priv,
    Buffer.from([0xa0, 0x0a, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]),
    Buffer.from([0xa1, 0x44, 0x03, 0x42, 0x00]), pub
  ]);
  try { return { pub, kljuc: createPrivateKey({ key: der, format: 'der', type: 'sec1' }) }; }
  catch (e) { return null; }
}

/* VAPID zaglavlje (RFC 8292). `aud` je POREKLO endpointa, ne ceo endpoint —
   sa celim URL-om FCM vraća 401. Potpis mora biti sirov r‖s (64 bajta), a ne
   DER: `dsaEncoding: 'ieee-p1363'`. Bez toga je odgovor takođe 401, i to bez
   ikakvog objašnjenja u telu. */
export function vapidZaglavlje(endpoint, javni, privatni, subjekat, sada) {
  const k = vapidKljuc(javni, privatni);
  if (!k) return null;
  let aud;
  try { aud = new URL(endpoint).origin; } catch (e) { return null; }
  const glava = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  /* 12 sati. Gornja granica po specifikaciji je 24 h; polovina ostavlja
     prostora za razilaženje satova između nas i push servisa. */
  const telo = b64u(JSON.stringify({
    aud, exp: Math.floor((sada || Date.now()) / 1000) + 12 * 3600, sub: subjekat
  }));
  const ulaz = glava + '.' + telo;
  const potpis = b64u(ecdsaPotpis('sha256', Buffer.from(ulaz), { key: k.kljuc, dsaEncoding: 'ieee-p1363' }));
  return 'vapid t=' + ulaz + '.' + potpis + ', k=' + b64u(k.pub);
}

/* Dnevni brojač za `proba`. Namerno PROPUŠTA kad baza ne odgovori — v. poziv. */
async function probaPrekoracena(token) {
  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return false;
  try {
    const r = await fetch(url.replace(/\/+$/, '') + '/rest/v1/rpc/check_and_bump_endpoint', {
      method: 'POST',
      headers: { apikey: anon, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_endpoint: 'push_proba', p_limit: 20 })
    });
    if (r.ok) return false;
    return /DAILY_LIMIT_EXCEEDED/i.test(await r.text());
  } catch (e) { return false; }
}

/* ============================================================
   ODREDIŠTE PUSH ZAHTEVA — SAMO POZNATI PUSH SERVISI

   Do sada je adresa uređaja morala samo da počne sa `https://`. To znači da je
   prijavljen korisnik mogao da upiše „uređaj" čija je adresa bilo koji host, pa
   da jednim pozivom `{akcija:'proba'}` — i posle toga svakog jutra kroz cron —
   natera naš server na odlazne POST zahteve gde on kaže. Nije curenje podataka
   (telo je šifrovano njegovim ključem i odgovor mu se ne vraća), ali jeste slep
   POST iz izlaznog saobraćaja našeg projekta, pojačivač 1:N ka cilju po
   njegovom izboru, i trošenje roka jutarnjeg posla.

   Spisak je NAMERNO širok — po vlasniku domena, ne po tačnom hostu. Push
   servisi menjaju podomene bez najave (`fcm.googleapis.com`,
   `*.notify.windows.com`, `*.push.apple.com`), a spisak koji je previše uzak
   tiho obori obaveštenja na nekom pregledaču i to se otkrije mesecima kasnije.

   Poklapanje ide po HOSTU iz `new URL`, ne po `indexOf` nad celim nizom:
   `https://napadac.example/?x=push.apple.com` sadrži pravi domen, a nije on. */
const PUSH_DOMENI = [
  'googleapis.com',      /* Chrome / Edge / Android — fcm.googleapis.com */
  'google.com',          /* starije FCM adrese */
  'push.apple.com',      /* Safari, iOS */
  'mozilla.com',         /* Firefox — updates.push.services.mozilla.com */
  'notify.windows.com',  /* stariji Edge / Windows */
  'live.com'
];
export function jePushServis(endpoint) {
  let u;
  try { u = new URL(String(endpoint)); } catch (e) { return false; }
  /* ŠEMA SE PROVERAVA OVDE, ne samo pri prijavi. Ovo je jedina provera kroz koju
     prolazi svako slanje, pa mora da bude potpuna: red upisan pre nje (ili
     ubuduće drugim putem) sa `http://fcm.googleapis.com/…` inače prođe, a to je
     nešifrovan zahtev sa VAPID potpisom u zaglavlju. */
  if (u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase();
  return PUSH_DOMENI.some(d => h === d || h.endsWith('.' + d));
}
/* Koliko uređaja jedan nalog sme da prijavi. Dovoljno za telefon, tablet,
   računar i rezervu; dovoljno malo da spisak ne postane oruđe. */
const NAJVISE_UREDJAJA = 8;

/* Jedno slanje. Vraća i HTTP status, jer 404/410 znače „ovaj uređaj više ne
   postoji" i tada se red BRIŠE — inače bi se mrtve pretplate gomilale i svaki
   sledeći podsetnik bio sporiji za njihov broj. */
export async function posaljiJednoj(pret, poruka, env) {
  /* Provera odredišta stoji I OVDE, ne samo pri prijavi. Redovi upisani pre nego
     što je spisak postojao ostaju u bazi; bez ove provere bi jutarnji posao
     nastavio da ih poziva. Ovo je jedino mesto kroz koje prolazi SVAKO slanje
     (proba, podsetnik, objava, unutrašnji `posalji`), pa je jedna provera dovoljna. */
  if (!jePushServis(pret && pret.endpoint)) {
    return { ok: false, status: 0, mrtva: true, greska: 'Adresa nije push servis pregledača.' };
  }
  const zag = vapidZaglavlje(pret.endpoint, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY,
    env.VAPID_SUBJECT || 'mailto:sub20@example.com');
  if (!zag) return { ok: false, status: 0, greska: 'VAPID ključevi nisu podešeni ili nisu ispravni.' };
  let telo;
  try { telo = sifruj(JSON.stringify(poruka), pret.p256dh, pret.auth); }
  catch (e) { return { ok: false, status: 0, greska: 'Šifrovanje nije uspelo: ' + e.message }; }
  try {
    const r = await fetch(pret.endpoint, {
      method: 'POST',
      headers: {
        Authorization: zag,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
        Urgency: 'normal'
      },
      body: telo
    });
    return { ok: r.ok, status: r.status, mrtva: r.status === 404 || r.status === 410 };
  } catch (e) {
    return { ok: false, status: 0, greska: 'Push servis nije dostupan.' };
  }
}

/* ==========================================================================
   2. PRIJAVA I BAZA
   ========================================================================== */

const TABELA = '/rest/v1/push_pretplata';
function sbURL(put) { return String(process.env.SUPABASE_URL || '').replace(/\/+$/, '') + put; }

/* Isti requireUser kao u ostalim funkcijama — namerno prekopiran, v. komentar
   na vrhu analyze.js: uvoz modula na Vercelu ume da padne kao HTML stranica
   koju klijent ne ume da pročita. */
/* KRATKOTRAJAN KEŠ POTVRĐENIH TOKENA — ista provera, jedan mrežni skok manje.
   Do sada je SVAKI poziv ka bilo kojoj putanji plaćao dodatan krug ka
   Supabase-u. Jedna sinhronizacija sa intervals.icu su četiri poziva, dakle
   četiri takva kruga; anketa o AI analizi pita na svake tri sekunde do minut i
   po. To je pola sekunde čiste latencije koja ne radi ništa.

   Prozor je namerno kratak — 30 s. Poređenja radi: preporučeni način (lokalna
   provera potpisa JWT-a, bez ijednog poziva) veruje tokenu do njegovog isteka,
   dakle ceo sat. Ovo je STROŽE od toga, uz istu uštedu. Ključ mape je sam
   token, pa se tuđa sesija ne može ni pogoditi ni podmetnuti.
   Mapa živi u modulu, dakle koliko i topla instanca funkcije; gornja granica
   postoji da dugotrajna instanca ne raste bez kraja. */
const AUTH_KES = new Map();
const AUTH_KES_MS = 30000;
const AUTH_KES_MAX = 500;

async function requireUser(req) {
  const url  = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { ok: false, status: 500,
      error: 'SUPABASE_URL / SUPABASE_ANON_KEY nisu podešeni u Vercel → Settings → Environment Variables.' };
  }
  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  if (!m) return { ok: false, status: 401, error: 'Nedostaje prijava.' };
  const kes = AUTH_KES.get(m[1]);
  if (kes && kes.doKada > Date.now()) return { ok: true, userId: kes.id, email: kes.email, token: m[1] };
  try {
    const r = await fetch(url.replace(/\/+$/, '') + '/auth/v1/user', {
      headers: { apikey: anon, Authorization: 'Bearer ' + m[1] }
    });
    if (!r.ok) return { ok: false, status: 401, error: 'Prijava je istekla — prijavi se ponovo.' };
    const u = await r.json();
    if (!u || !u.id) return { ok: false, status: 401, error: 'Neispravna prijava.' };
    if (AUTH_KES.size >= AUTH_KES_MAX) AUTH_KES.clear();
    AUTH_KES.set(m[1], { id: u.id, email: u.email || null, doKada: Date.now() + AUTH_KES_MS });
    return { ok: true, userId: u.id, email: u.email || null, token: m[1] };
  } catch (e) {
    return { ok: false, status: 503, error: 'Provera prijave trenutno nije moguća.' };
  }
}

/* Poređenje konstantnog trajanja — isto kao u daily-report/broadcast. */
function proveriTajnu(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const h = String(req.headers.authorization || req.headers.Authorization || '');
  const want = 'Bearer ' + secret;
  if (h.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

function korisnikGlava(token) {
  return {
    apikey: process.env.SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json'
  };
}
function servisGlava() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' };
}

/* Pretplate jednog korisnika, servisnim ključem (za slanje iz croninga i iz
   analyze.js — tamo korisnikov token ne postoji). */
async function pretplateKorisnika(userId) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const r = await fetch(sbURL(TABELA + '?select=id,endpoint,p256dh,auth&user_id=eq.' + encodeURIComponent(userId)),
    { headers: servisGlava() });
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}

async function obrisiPretplatu(id) {
  try { await fetch(sbURL(TABELA + '?id=eq.' + encodeURIComponent(id)), { method: 'DELETE', headers: servisGlava() }); }
  catch (e) { /* mrtva pretplata više smeta nego što šteti — probaj sledeći put */ }
}

/* Slanje na SVE uređaje jednog korisnika. Mrtve pretplate se usput brišu. */
async function posaljiKorisniku(userId, poruka) {
  const lista = await pretplateKorisnika(userId);
  if (!lista.length) return { poslato: 0, palo: 0, ukupno: 0 };
  let poslato = 0, palo = 0;
  for (const p of lista) {
    const r = await posaljiJednoj(p, poruka, process.env);
    if (r.ok) poslato++;
    else { palo++; if (r.mrtva) await obrisiPretplatu(p.id); }
  }
  return { poslato, palo, ukupno: lista.length };
}

/* ==========================================================================
   3. JUTARNJI PODSETNIK

   Šta piše u obaveštenju NE računa server. Plan, tempo i tipovi sesija žive u
   aplikaciji (app.js, 10.000 linija) i tamo i ostaju — server bi morao da ih
   ponovi da bi znao šta je danas na redu, i te dve kopije bi se razišle prvom
   izmenom plana.

   Umesto toga aplikacija pri svakom otvaranju upiše NAJAVE za narednih
   nedelju dana: { "2026-08-07": "8×400 m", "2026-08-08": "" }. Cron samo
   izvadi današnji datum. Prazan tekst = dan odmora, tada se NE šalje ništa.
   Ako datuma nema (aplikacija nije otvarana nedelju dana), ide opšta poruka.
   ========================================================================== */

export function danasBeograd(sada) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Belgrade' }).format(sada || new Date());
}

/* Odluka o jednom korisniku — izdvojena da bi bila testabilna bez mreže. */
export function podsetnikZa(najave, danas) {
  const n = najave && typeof najave === 'object' ? najave : null;
  if (n && Object.prototype.hasOwnProperty.call(n, danas)) {
    const t = String(n[danas] || '').trim();
    if (!t) return null;                       /* dan odmora — ćuti */
    return { naslov: 'Danas na planu', telo: t, oznaka: 'plan', url: './?tab=danas' };
  }
  return { naslov: 'SUB-20', telo: 'Otvori da vidiš šta je danas na planu.', oznaka: 'plan', url: './?tab=danas' };
}

const PODSETNIK_ROK_MS = 45000;

async function jutarnjiPodsetnik() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: 'SUPABASE_SERVICE_ROLE_KEY nije podešen.' };
  const danas = danasBeograd();
  const kraj = Date.now() + PODSETNIK_ROK_MS;
  const PO = 200;
  let poslato = 0, preskoceno = 0, palo = 0, ukupno = 0, stalo = false;

  for (let strana = 0; strana < 50; strana++) {
    const od = strana * PO;
    const r = await fetch(sbURL(TABELA + '?select=id,user_id,endpoint,p256dh,auth,najave&order=id.asc'), {
      headers: Object.assign(servisGlava(), { Range: od + '-' + (od + PO - 1), 'Range-Unit': 'items' })
    });
    if (!r.ok && r.status !== 206) return { error: 'Čitanje pretplata nije uspelo (' + r.status + ').' };
    const red = await r.json();
    const lista = Array.isArray(red) ? red : [];
    ukupno += lista.length;

    for (const p of lista) {
      /* Vercel funkcija ima 60 s. Bolje stati i poslati ostatak sutra nego da
         nas sredina posla preseče bez traga — isto pravilo kao u broadcast.js. */
      if (Date.now() > kraj) { stalo = true; break; }
      const poruka = podsetnikZa(p.najave, danas);
      if (!poruka) { preskoceno++; continue; }
      const ishod = await posaljiJednoj(p, poruka, process.env);
      if (ishod.ok) poslato++;
      else { palo++; if (ishod.mrtva) await obrisiPretplatu(p.id); }
    }
    if (stalo || lista.length < PO) break;
  }
  return { ok: true, danas, ukupno, poslato, preskoceno, palo, stalo };
}

/* --------------------------------------------------------------------------
   JEDNOKRATNA OBJAVA SVIMA (akcija:'objava')

   Jutarnji podsetnik ide svima, ali uvek sa istim tekstom i samo o planu.
   Za „dodat je novi tab" nije bilo puta osim ručnog kucanja koda, pa je ovo
   isti obilazak pretplata sa tekstom kao parametrom.

   ZAŠTO NE NOVA FUNKCIJA: Vercel Hobby plan dozvoljava 12 serverless
   funkcija po deployu, a već ih je devet. Push kriptografija je ovde i sme
   da postoji samo na jednom mestu (v. zaglavlje fajla).

   KAPIJA: SAMO VLASNIK, nikad CRON_SECRET — isto pravilo kao za
   administratorske radnje u broadcast.js. Zakazan posao sme da pošalje
   jutarnji podsetnik; ne sme da svima pošalje proizvoljan tekst.

   ŠALJE SE SVAKOM UREĐAJU, ne svakom čoveku: ko je aplikaciju instalirao na
   telefon i tablet, dobija je na oba. Isto radi i jutarnji podsetnik.

   `najave` se NE gleda. To je raspored plana po danima — „danas nema
   treninga" nije razlog da čovek ne sazna da postoji nov ekran. Ko obaveštenja
   uopšte ne želi, nema pretplatu i ovde ga nema.

   NASTAVAK IDE PO id-u: slanje na 5000 uređaja ne stane u jedan poziv, pa se
   vraća `sledeciPosle` — poslednji obrađen id. Nov uređaj koji se u međuvremenu
   prijavi ima veći id, tako da se niko ne preskoči ni ne dobije dva puta.
   Zato baš id, a ne pozicija u listi. */
/* Vlasnik se proverava ISTO kao u broadcast.js, i namerno se ne oslanja na
   `requireUser`: taj kes pamti id i mejl, ali ne i to da li je adresa
   POTVRĐENA. Supabase izda token sa nepotvrđenom adresom ako je Email provider
   uključen a potvrda isključena — pa bi neko ko se registruje vlasnikovom
   adresom, bez pristupa njoj, mogao da pošalje obaveštenje svim korisnicima.
   Kod je prepisan, ne uvezen: api/*.js se namerno ne uvoze međusobno
   (v. zaglavlje analyze.js) — deploy ide preko GitHub web editora, bez build
   koraka. */
async function vlasnikIz(req) {
  const admin = String(process.env.ADMIN_EMAIL || process.env.REPORT_TO || '').trim().toLowerCase();
  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
  if (!admin || !url || !anon) return null;
  const m = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || req.headers.Authorization || '').trim());
  if (!m) return null;
  try {
    const r = await fetch(url.replace(/\/+$/, '') + '/auth/v1/user', {
      headers: { apikey: anon, Authorization: 'Bearer ' + m[1] }
    });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u || !u.email || !(u.email_confirmed_at || u.confirmed_at)) return null;
    return String(u.email).trim().toLowerCase() === admin ? u : null;
  } catch (e) { return null; }
}

const OBJAVE = {
  zajednica: {
    naslov: 'Novo u SUB-20: Zajednica',
    telo: 'Nedeljni izazov i tabela sa ostalima. Uključuje se ručno — otvori da vidiš.',
    url: './?tab=zajed',
    oznaka: 'objava-zajednica'
  }
};

async function objavaSvima(imeObjave, posle) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: 'SUPABASE_SERVICE_ROLE_KEY nije podešen.' };
  const poruka = Object.prototype.hasOwnProperty.call(OBJAVE, imeObjave) ? OBJAVE[imeObjave] : null;
  if (!poruka) return { error: 'Nepoznata objava: ' + imeObjave, poznate: Object.keys(OBJAVE) };

  const kraj = Date.now() + PODSETNIK_ROK_MS;
  const PO = 200;
  let poslato = 0, palo = 0, ukupno = 0, stalo = false, zadnji = posle || null;

  for (let strana = 0; strana < 50; strana++) {
    const filtar = zadnji ? '&id=gt.' + encodeURIComponent(zadnji) : '';
    const r = await fetch(sbURL(TABELA + '?select=id,user_id,endpoint,p256dh,auth&order=id.asc&limit=' + PO + filtar), {
      headers: servisGlava()
    });
    if (!r.ok && r.status !== 206) return { error: 'Čitanje pretplata nije uspelo (' + r.status + ').' };
    const red = await r.json();
    const lista = Array.isArray(red) ? red : [];
    ukupno += lista.length;

    for (const p of lista) {
      if (Date.now() > kraj) { stalo = true; break; }
      const ishod = await posaljiJednoj(p, poruka, process.env);
      if (ishod.ok) poslato++;
      else { palo++; if (ishod.mrtva) await obrisiPretplatu(p.id); }
      /* Kursor je POSLEDNJI OBRAĐEN, ne poslednji uspešan: uređaj koji je push
         servis odbio neće proći ni sledeći put, a da ostane u kursoru, svaki
         naredni poziv bi zauvek počinjao od njega. */
      zadnji = p.id;
    }
    if (stalo || lista.length < PO) break;
  }
  return { ok: true, objava: imeObjave, ukupno, poslato, palo, stalo,
           sledeciPosle: stalo ? zadnji : null };
}

/* ==========================================================================
   4. RUKOVALAC
   ========================================================================== */

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  /* --- GET: ili Vercel Cron (sa tajnom), ili javni ključ (bez nje) --- */
  if (req.method === 'GET') {
    if (proveriTajnu(req)) { res.status(200).json(await jutarnjiPodsetnik()); return; }
    /* Javni VAPID ključ NIJE tajna — po dizajnu ga svaki pregledač šalje push
       servisu. Aplikacija ga čita odavde umesto da ga nosi u kodu: kad se
       ključevi jednom promene, nema šanse da ostanu neusklađeni. */
    const k = process.env.VAPID_PUBLIC_KEY || '';
    res.status(200).json({ kljuc: k, podeseno: !!(k && process.env.VAPID_PRIVATE_KEY) });
    return;
  }

  if (req.method !== 'POST') { res.status(405).json({ error: 'Metod nije podržan.' }); return; }

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch (e) { res.status(400).json({ error: 'Telo zahteva nije ispravan JSON.' }); return; }
  const akcija = String(body.akcija || '');

  /* --- unutrašnje slanje: analyze.js i sve buduće funkcije --- */
  if (akcija === 'posalji') {
    if (!proveriTajnu(req)) { res.status(401).json({ error: 'Nije dozvoljeno.' }); return; }
    const userId = String(body.userId || '');
    if (!userId) { res.status(400).json({ error: 'Nedostaje userId.' }); return; }
    const ishod = await posaljiKorisniku(userId, {
      naslov: String(body.naslov || 'SUB-20').slice(0, 80),
      telo: String(body.telo || '').slice(0, 200),
      url: String(body.url || './').slice(0, 200),
      oznaka: String(body.oznaka || 'sub19').slice(0, 40),
      tiho: !!body.tiho
    });
    res.status(200).json(Object.assign({ ok: true }, ishod));
    return;
  }

  /* --- jednokratna objava svima: samo vlasnik --- */
  if (akcija === 'objava') {
    const vlasnik = await vlasnikIz(req);
    /* 404, ne 403: „zabranjeno" je potvrda da putanja postoji. Isto kao u
       broadcast.js. */
    if (!vlasnik) { res.status(404).json({ error: 'Ne postoji.' }); return; }
    const ime = String(body.objava || '');
    /* Suv test kao u broadcast.js: bez `posalji:true` samo pokaže tekst. */
    if (body.posalji !== true) {
      const p = Object.prototype.hasOwnProperty.call(OBJAVE, ime) ? OBJAVE[ime] : null;
      if (!p) { res.status(400).json({ error: 'Nepoznata objava: ' + ime, poznate: Object.keys(OBJAVE) }); return; }
      res.status(200).json({ probno: true, objava: ime, poruka: p,
        napomena: 'Ništa nije poslato. Ponovi poziv sa {"posalji":true} da stvarno pošalješ.' });
      return;
    }
    const ishod = await objavaSvima(ime, body.posle);
    res.status(ishod.error ? (ishod.poznate ? 400 : 502) : 200).json(ishod);
    return;
  }

  const auth = await requireUser(req);
  if (!auth.ok) { res.status(auth.status).json({ error: auth.error }); return; }

  /* --- prijava uređaja --- */
  if (akcija === 'prijava') {
    const p = body.pretplata || {};
    const kljucevi = p.keys || {};
    const endpoint = String(p.endpoint || '');
    if (!/^https:\/\//.test(endpoint) || !kljucevi.p256dh || !kljucevi.auth) {
      res.status(400).json({ error: 'Pretplata nije potpuna.' }); return;
    }
    /* ODREDIŠTE MORA BITI PUSH SERVIS PREGLEDAČA — v. jePushServis.
       Bez ovoga je adresa bila bilo koji https host, pa je server slao slepe
       POST zahteve gde napadač kaže. */
    if (!jePushServis(endpoint)) {
      res.status(400).json({ error: 'Ta adresa nije push servis pregledača.' }); return;
    }
    if (endpoint.length > 500) {
      res.status(400).json({ error: 'Adresa pretplate je predugačka.' }); return;
    }
    /* GORNJA GRANICA UREĐAJA. `endpoint` je `unique`, pa svaki nov pravi NOV
       red — bez granice je jedan nalog mogao da upiše hiljade „uređaja" i time
       potroši ceo rok jutarnjeg posla, pa pravi ljudi ostanu bez podsetnika.
       Broji se PRE upisa; postojeći endpoint se samo prepisuje i ne troši mesto. */
    try {
      const r = await fetch(sbURL(TABELA + '?select=endpoint'), { headers: korisnikGlava(auth.token) });
      if (r.ok) {
        const moji = await r.json();
        if (Array.isArray(moji) && !moji.some(x => x && x.endpoint === endpoint) && moji.length >= NAJVISE_UREDJAJA) {
          res.status(409).json({ error: 'Dostignut je najveći broj uređaja (' + NAJVISE_UREDJAJA + '). Isključi obaveštenja na uređaju koji više ne koristiš.' });
          return;
        }
      }
    } catch (e) { /* provera broja ne sme da obori prijavu zbog baze */ }
    if (!process.env.VAPID_PRIVATE_KEY) {
      res.status(503).json({ error: 'Obaveštenja još nisu podešena na serveru (VAPID ključevi).' }); return;
    }
    const red = {
      user_id: auth.userId,
      endpoint,
      p256dh: String(kljucevi.p256dh).slice(0, 200),
      auth: String(kljucevi.auth).slice(0, 60),
      uredjaj: String(body.uredjaj || '').slice(0, 40) || null,
      /* Kolona je `not null default '{}'` — `null` bi oborio ceo upis, a
         najave nisu razlog da prijava uređaja ne prođe. */
      najave: ocistiNajave(body.najave) || {}
    };
    try {
      const r = await fetch(sbURL(TABELA + '?on_conflict=endpoint'), {
        method: 'POST',
        headers: Object.assign(korisnikGlava(auth.token), { Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(red)
      });
      if (!r.ok) { res.status(502).json({ error: 'Upis pretplate nije uspeo. ' + (await r.text()).slice(0, 160) }); return; }
    } catch (e) { res.status(503).json({ error: 'Baza nije dostupna.' }); return; }
    res.status(200).json({ ok: true });
    return;
  }

  /* --- odjava uređaja --- */
  if (akcija === 'odjava') {
    const endpoint = String(body.endpoint || '');
    if (!endpoint) { res.status(400).json({ error: 'Nedostaje endpoint.' }); return; }
    try {
      /* RLS pušta brisanje samo sopstvenog reda, pa je filter po endpointu
         dovoljan — tuđi red se ne može obrisati ni greškom ni namerno. */
      await fetch(sbURL(TABELA + '?endpoint=eq.' + encodeURIComponent(endpoint)),
        { method: 'DELETE', headers: korisnikGlava(auth.token) });
    } catch (e) { res.status(503).json({ error: 'Baza nije dostupna.' }); return; }
    res.status(200).json({ ok: true });
    return;
  }

  /* --- osvežavanje najava (aplikacija ih šalje pri otvaranju) --- */
  if (akcija === 'najave') {
    const najave = ocistiNajave(body.najave);
    if (!najave) { res.status(400).json({ error: 'Najave nisu ispravne.' }); return; }
    try {
      const r = await fetch(sbURL(TABELA + '?user_id=eq.' + encodeURIComponent(auth.userId)), {
        method: 'PATCH',
        headers: Object.assign(korisnikGlava(auth.token), { Prefer: 'return=minimal' }),
        body: JSON.stringify({ najave })
      });
      if (!r.ok) { res.status(502).json({ error: 'Upis najava nije uspeo.' }); return; }
    } catch (e) { res.status(503).json({ error: 'Baza nije dostupna.' }); return; }
    res.status(200).json({ ok: true });
    return;
  }

  /* --- probno obaveštenje na sopstvene uređaje --- */
  if (akcija === 'proba') {
    /* Dnevni limit. Proba šalje na SVE prijavljene uređaje, pa je jedan poziv
       do osam odlaznih zahteva. Za razliku od admin radnji, ovde se na otkaz
       brojača PROPUŠTA — proba nije razorna, a baza ne sme da obori jedinu
       proveru kojom čovek vidi da li obaveštenja rade (isti izbor kao u
       api/icu.js). */
    if (await probaPrekoracena(auth.token)) {
      res.status(429).json({ error: 'Previše proba danas. Probaj ponovo sutra.' }); return;
    }
    const ishod = await posaljiKorisniku(auth.userId, {
      naslov: 'SUB-20 · proba',
      telo: 'Obaveštenja rade. Ovako će izgledati jutarnji podsetnik.',
      oznaka: 'proba',
      url: './'
    });
    if (!ishod.ukupno) { res.status(404).json({ error: 'Nijedan uređaj nije prijavljen za obaveštenja.' }); return; }
    res.status(200).json(Object.assign({ ok: ishod.poslato > 0 }, ishod));
    return;
  }

  res.status(400).json({ error: 'Nepoznata akcija.' });
}

/* Najave su mala mapa datum -> tekst. Ograničava se i broj i dužina: red u
   bazi ne sme da postane mesto gde klijent smešta šta god poželi. */
export function ocistiNajave(ulaz) {
  if (!ulaz || typeof ulaz !== 'object' || Array.isArray(ulaz)) return null;
  const out = {};
  let n = 0;
  for (const k of Object.keys(ulaz)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
    out[k] = String(ulaz[k] == null ? '' : ulaz[k]).slice(0, 120);
    if (++n >= 14) break;
  }
  return n ? out : null;
}
