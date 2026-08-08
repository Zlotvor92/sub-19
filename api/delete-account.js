/* SUB-20 · Brisanje naloga i svih podataka — na zahtev korisnika.

   POSTOJI ZBOG GOOGLE PLAY-a, ali nije samo papirologija: Play traži da
   aplikacija koja pravi nalog ponudi i brisanje, i to dvojako — put iz same
   aplikacije (Podešavanja → Nalog → „Obriši nalog") i javnu adresu dostupnu
   BEZ instaliranja (privacy.html#brisanje). Ova putanja opslužuje oba.

   Isti obrazac kao ostali api/ fajlovi: JWT provera UGRAĐENA (ne import iz
   _auth.js — Vercel funkcije preko GitHub web editora nemaju build korak,
   import bi oborio funkciju bez jasne poruke, već viđeno u ovom projektu).

   POTREBNE Vercel Environment Variables:
   - SUPABASE_URL, SUPABASE_ANON_KEY          (provera prijave)
   - SUPABASE_SERVICE_ROLE_KEY                (brisanje redova i naloga)

   ZAŠTO service_role. Brojači (`api_usage`, `bug_report_usage`,
   `endpoint_usage`) se po dizajnu pišu ISKLJUČIVO kroz `check_and_bump_*`
   funkcije i nemaju delete politiku za korisnika — njegov token ih ne može
   obrisati ni kad su njegovi. Brisanje naloga u `auth.users` je ionako
   admin operacija. Zato ovde, i samo ovde, ide service_role ključ.

   ČIJI SE NALOG BRIŠE. Isključivo onaj iz PROVERENOG tokena. Nijedan
   identifikator iz tela zahteva se ne čita — sa service_role ključem u ruci
   to bi bilo brisanje tuđeg naloga jednim poljem u JSON-u. Test to drži
   zatvorenim („ne briše nalog čiji id stigne u telu"). */

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

/* Tekst koji klijent mora poslati da bi se brisanje uopšte razmatralo.
   Nije bezbednosna mera — POST + Authorization zaglavlje već drže tuđi sajt
   napolju. Ovo je mera protiv POGREŠNOG POZIVA: da nijedan budući `fetch`
   ove putanje bez razmišljanja ne obriše nečiju istoriju trčanja. */
const POTVRDA = 'OBRISI NALOG';

/* SVE tabele koje nose podatke jednog korisnika, i kolona po kojoj se nalazi.
   Redosled nije bitan (nema međuzavisnosti), ali spisak jeste: tabela koja
   se ovde ne pojavi preživi brisanje naloga i ostane siroče sa user_id-jem
   koji više ne postoji. Kad dodaješ tabelu u supabase/, dodaj je i ovde —
   test „spisak tabela pokriva sve iz supabase/*.sql" pada ako zaboraviš. */
const TABELE = [
  'user_state',
  'push_pretplata',
  'ai_posao',
  'api_usage',
  'bug_report_usage',
  'endpoint_usage',
  'zajednica_profil',
  'user_state_istorija'
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Samo POST.' });
  }

  /* Blokira zloupotrebu sa TUĐEG sajta preko običnog <form> POST-a — takav
     zahtev ne može da postavi ovo zaglavlje bez preflight provere, a
     preflight ne odobravamo (nema CORS zaglavlja). Isti razlog kao u
     refresh.js. */
  const ct = String(req.headers['content-type'] || '');
  if (!ct.includes('application/json')) {
    return res.status(415).json({ error: 'Zahteva se Content-Type: application/json.' });
  }

  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const url = process.env.SUPABASE_URL;
  const srv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !srv) {
    return res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nisu podešeni.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Neispravan JSON.' });
  }

  /* Poređenje bez dijakritike i bez razlike u veličini slova — korisnik kuca
     ovaj tekst rukom, a „OBRIŠI" sa kvačicom i bez nje su ista namera. */
  const dato = String((body && body.potvrda) || '')
    .toUpperCase().replace(/Š/g, 'S').replace(/\s+/g, ' ').trim();
  if (dato !== POTVRDA) {
    return res.status(400).json({ error: 'Brisanje nije potvrđeno.' });
  }

  const baza = url.replace(/\/+$/, '');
  const srvHead = { apikey: srv, Authorization: 'Bearer ' + srv };

  /* KORAK 1 — redovi sa podacima.
     Namerno se NE oslanjamo na `on delete cascade`. Većina tabela ga ima
     (v. supabase/*.sql), ali `user_state` je pravljena rukom pre nego što je
     šema ušla u repozitorijum i njena definicija ovde ne postoji, pa se ne
     zna. Eksplicitno brisanje radi u oba slučaja i ponavljanje mu ne škodi. */
  const obrisano = [];
  for (const t of TABELE) {
    try {
      const r = await fetch(baza + '/rest/v1/' + t + '?user_id=eq.' + encodeURIComponent(auth.userId), {
        method: 'DELETE',
        headers: { ...srvHead, Prefer: 'return=minimal' }
      });
      /* 404 = tabela ne postoji u ovoj instalaciji (npr. rate-limit.sql još
         nije pušten). To nije razlog da brisanje stane — nema šta da se
         obriše. Sve ostalo jeste. */
      if (!r.ok && r.status !== 404) {
        const telo = await r.text();
        console.error('[brisanje][ALARM] tabela %s nije obrisana za %s — HTTP %s: %s',
          t, auth.userId, r.status, telo.slice(0, 200));
        /* NALOG SE NE BRIŠE AKO PODACI NISU OTIŠLI. Obrnut redosled je
           najgori mogući ishod: korisnik izgubi pristup, podaci ostanu, i
           više se ne može ni prijaviti da pokuša ponovo. */
        return res.status(502).json({
          error: 'Brisanje podataka nije uspelo (' + t + '). Nalog NIJE obrisan — pokušaj ponovo ili piši na adresu iz politike privatnosti.'
        });
      }
      if (r.ok) obrisano.push(t);
    } catch (e) {
      console.error('[brisanje][ALARM] tabela %s nedostupna za %s: %s', t, auth.userId, e.message);
      return res.status(503).json({
        error: 'Server trenutno nije dostupan. Nalog NIJE obrisan — pokušaj ponovo.'
      });
    }
  }

  /* KORAK 2 — sam nalog. Tek kad su podaci sigurno otišli. */
  try {
    const r = await fetch(baza + '/auth/v1/admin/users/' + encodeURIComponent(auth.userId), {
      method: 'DELETE',
      headers: srvHead
    });
    if (!r.ok) {
      const telo = await r.text();
      console.error('[brisanje][ALARM] nalog %s nije obrisan — HTTP %s: %s',
        auth.userId, r.status, telo.slice(0, 200));
      /* Podaci jesu obrisani, nalog nije — prazan nalog je bezopasan, ali
         korisniku se ne sme reći da je gotovo kad nije. */
      return res.status(502).json({
        error: 'Podaci su obrisani, ali sam nalog nije. Piši na adresu iz politike privatnosti da se dovrši.'
      });
    }
  } catch (e) {
    console.error('[brisanje][ALARM] nalog %s — mreža: %s', auth.userId, e.message);
    return res.status(503).json({
      error: 'Podaci su obrisani, ali sam nalog nije. Piši na adresu iz politike privatnosti da se dovrši.'
    });
  }

  /* Token se od ovog trenutka ne može više proveriti (naloga nema), pa se
     izbacuje i iz keša — inače bi narednih 30 s izgledao kao važeći. */
  AUTH_KES.delete(auth.token);

  console.log('[brisanje] nalog %s obrisan; tabele: %s', auth.userId, obrisano.join(', ') || '—');
  return res.status(200).json({ ok: true, obrisano });
}
