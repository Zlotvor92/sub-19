/* /api/analyze.js — LLM analiza treninga (Gemini 3.5 Flash, besplatan nivo).
   NAJMANJA MOGUĆA VERZIJA: prima podatke koje aplikacija VEĆ ima (prosečan
   tempo radnog dela, puls, RPE, belešku) — ne dira Strava kod, ne dodaje
   novo povlačenje podataka.

   OBAVEZNO pre deploy-a, u Vercel Project Settings -> Environment Variables:
   - GEMINI_API_KEY       (https://aistudio.google.com/apikey — besplatan nivo)
   - SUPABASE_URL         (https://<ref>.supabase.co)
   - SUPABASE_ANON_KEY    (sb_publishable_... — javan po dizajnu)

   APP_SHARED_SECRET VIŠE NIJE POTREBAN i može se obrisati. Zamenila ga je
   prava prijava: zahtev mora nositi Supabase sesiju korisnika, koju server
   proverava kod Supabase-a. Time se zna KO zove (kvota po korisniku), a ne
   oslanja se na tajnu koja je ionako bila vidljiva u frontend kodu.

   NAPOMENA O BESPLATNOM NIVOU: Google na besplatnom nivou koristi tekst
   zahteva/odgovora za poboljšanje svojih proizvoda (za razliku od plaćenog
   nivoa). Ako to ne želiš, treba prebaciti na plaćen nivo (i dalje jeftino:
   $0.30/$2.50 po milion tokena za standardni 3.5 Flash poziv). */

/* --- Provera Supabase sesije (UGRAĐENA, ne uvezena) ---
   Ranije je ovo bio zajednički `_auth.js` sa `import`-om. Vercel funkcije
   deployovane preko GitHub web editora nemaju build korak ni package.json
   podešavanje, pa je uvoz pomoćnog fajla obarao funkciju — a Vercel tada
   vrati HTML stranicu "A server error has occurred". Klijent na to radi
   `response.json()` i dobije nerazumljivo "...is not valid JSON" (Chrome)
   odnosno "The string did not match the expected pattern" (Safari).
   Zato je provera ugrađena u svaki fajl: par linija duplikata je jeftinije
   od cele klase problema sa razrešavanjem modula. */

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

/* ANALIZA ODVOJENA OD ČEKANJA.

   Jedan zahtev je i dalje ograničen na `maxDuration` (60 s) — to se ne može
   zaobići. Ali rezultat više ne živi u tom zahtevu nego u tabeli `ai_posao`
   (v. supabase/ai-posao.sql), pa se ne gubi ako veza pukne, ako telefon uspava
   stranicu, ili ako čovek zatvori aplikaciju usred računanja. Klijent pokrene
   posao, ODMAH dobije odgovor, i rezultat pokupi kad god se vrati.

   Tri faze, sve na istoj adresi:
     posao:'start' -> upiše red, vrati posaoId (broji se u dnevni limit)
     posao:'radi'  -> preuzme red, pozove model, upiše tekst (NE broji se)
     posao:'citaj' -> vrati stanje i tekst (ne broji se, ne dira model) */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABELA = '/rest/v1/ai_posao';

/* Svi pozivi ka tabeli idu KORISNIKOVIM tokenom, ne service_role ključem —
   pa RLS, a ne naš kod, jemči da se tuđi rezultat ne može pročitati. */
function sbGlava(auth, extra) {
  return Object.assign({
    apikey: process.env.SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + auth.token,
    'Content-Type': 'application/json'
  }, extra || {});
}
function sbURL(put) { return process.env.SUPABASE_URL.replace(/\/+$/, '') + put; }

async function posaoNapravi(auth) {
  try {
    /* Stari poslovi se brišu usput — red je potreban samo dok se rezultat ne
       pokupi, a tekst ionako živi na uređaju i u backupu. */
    const pre = new Date(Date.now() - 24 * 3600e3).toISOString();
    fetch(sbURL(TABELA + '?user_id=eq.' + auth.userId + '&napravljen=lt.' + encodeURIComponent(pre)),
      { method: 'DELETE', headers: sbGlava(auth) }).catch(() => {});

    const r = await fetch(sbURL(TABELA), {
      method: 'POST',
      headers: sbGlava(auth, { Prefer: 'return=representation' }),
      body: JSON.stringify({ user_id: auth.userId, stanje: 'radi' })
    });
    if (!r.ok) {
      const t = await r.text();
      /* Mreža ispod dnevnog limita (okidač `ai_posao_nov`, v. ai-posao.sql).
         Ne bi smela da se javi pre limita iz koda — ali ako se javi, čovek
         mora da dobije razumljivu rečenicu, ne sirovu grešku baze. */
      if (jeLimit(t)) return { ok: false, status: 429, error: 'Previše analiza danas. Pokušaj ponovo sutra.' };
      return { ok: false, status: 502, error: 'Nije moguće otvoriti posao analize. ' + t.slice(0, 160) };
    }
    const red = (await r.json())[0];
    if (!red || !red.id) return { ok: false, status: 502, error: 'Posao analize nije upisan.' };
    return { ok: true, id: red.id };
  } catch (e) {
    return { ok: false, status: 503, error: 'Baza nije dostupna.' };
  }
}

/* Preuzimanje posla: 'radi' -> 'u_toku', ali SAMO ako je još u stanju 'radi'.
   Time dva paralelna pokušaja ne mogu da pozovu model dvaput za isti posao. */
async function posaoPreuzmi(auth, id) {
  try {
    const r = await fetch(sbURL(TABELA + '?id=eq.' + id + '&stanje=eq.radi'), {
      method: 'PATCH',
      headers: sbGlava(auth, { Prefer: 'return=representation' }),
      body: JSON.stringify({ stanje: 'u_toku' })
    });
    if (!r.ok) return { ok: false, status: 502, error: 'Posao nije preuzet.' };
    const niz = await r.json();
    return { ok: Array.isArray(niz) && niz.length > 0 };
  } catch (e) { return { ok: false, status: 503, error: 'Baza nije dostupna.' }; }
}

async function posaoZavrsi(auth, id, polja) {
  try {
    await fetch(sbURL(TABELA + '?id=eq.' + id), {
      method: 'PATCH', headers: sbGlava(auth), body: JSON.stringify(polja)
    });
  } catch (e) { /* rezultat je izgubljen, ali odgovor klijentu ionako ne čeka */ }
}

/* OBAVEŠTENJE „ANALIZA JE GOTOVA".

   Otkad analiza više ne živi u zahtevu nego u tabeli, korisnik sme da zatvori
   aplikaciju čim je pokrene — i tada nema načina da sazna da je tekst stigao
   dok je sam ne otvori. Ovo je taj način.

   Ide kroz /api/push, jedini fajl koji ume da potpiše i šifruje push poruku
   (v. komentar na vrhu tog fajla — kriptografija ne sme da postoji u dve
   kopije). Poziv je unutrašnji, prema samom sebi, i overava se CRON_SECRET-om.
   Ako ključa nema ili poziv padne — ćuti: rezultat je već upisan u bazu i
   klijent će ga pokupiti pri sledećem otvaranju, kao i do sada.

   ADRESA SE NE ČITA IZ ZAGLAVLJA ZAHTEVA.
   Ranije je odredište građeno iz `x-forwarded-host` (pa `host`) — dakle iz
   vrednosti koju šalje onaj ko zove. Uz to zaglavlje ide `Authorization:
   Bearer CRON_SECRET`, pa bi jedan zahtev sa podmetnutim `X-Forwarded-Host`
   odneo TU TAJNU na tuđi server. A ta tajna otključava: spisak mejl adresa
   SVIH korisnika i masovni mejl (/api/broadcast), push bilo kom korisniku
   (/api/push, akcija „posalji") i dnevni izveštaj.
   Poreklo je konfiguracija, ne ulaz — isto kao `BAZA` u /api/broadcast.js.
   Sve tri vrednosti postavlja platforma ili vlasnik; nijednu klijent ne može
   dodirnuti. `SAMA_ADRESA` postoji da se, kad se jednom veže sopstveni domen,
   ne mora dirati kod.
   `VERCEL_PROJECT_PRODUCTION_URL` (stabilan produkcijski domen) ide pre
   `VERCEL_URL` (adresa pojedinačnog deploya): deploy adrese ume da štiti
   Vercel Deployment Protection, pa bi unutrašnji poziv na nju dobio stranicu
   za prijavu umesto naše funkcije.
   Ako nijedno nije poznato — ćuti, kao i za svaki drugi otkaz obaveštenja. */
function sopstvenoPoreklo() {
  const rucno = String(process.env.SAMA_ADRESA || '').trim().replace(/\/+$/, '');
  if (/^https:\/\/[^\/\s]+$/.test(rucno)) return rucno;
  for (const v of [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]) {
    const d = String(v || '').trim();
    if (/^[A-Za-z0-9._-]+$/.test(d)) return 'https://' + d;
  }
  return null;
}

async function javiDaJeGotovo(req, userId, uspeh, danId) {
  if (!process.env.CRON_SECRET || !userId) return;
  /* Klik na obaveštenje mora da odvede DO ANALIZE, ne na početni ekran.
     Prijavljeno: „stigne notifikacija, ali kad kliknem ne vodi me do same
     analize" — vodila je na ./?tab=danas, a analiza živi u listu SVOG dana,
     koji često nije današnji (analizira se juče istrčan trening).
     `danId` je isti identifikator dana koji aplikacija koristi u S.log; oblik
     se proverava ovde jer ulazi u adresu. */
  const dan = /^[A-Za-z0-9_-]{1,64}$/.test(String(danId || '')) ? String(danId) : null;
  const poreklo = sopstvenoPoreklo();
  if (!poreklo) return;
  try {
    await fetch(poreklo + '/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.CRON_SECRET },
      body: JSON.stringify({
        akcija: 'posalji',
        userId,
        naslov: uspeh ? 'Analiza je gotova' : 'Analiza nije uspela',
        telo: uspeh ? 'Dodirni da je pročitaš.' : 'Otvori karticu treninga i probaj ponovo.',
        oznaka: 'ai',
        url: dan ? './?dan=' + encodeURIComponent(dan) : './?tab=danas',
        /* Ako je aplikacija otvorena i vidljiva, tekst se pojavi sam — nema
           razloga da preko njega iskoči i obaveštenje (v. `tiho` u sw.js). */
        tiho: true
      })
    });
  } catch (e) { /* obaveštenje je dodatak, ne uslov */ }
}

async function posaoCitaj(auth, id) {
  try {
    const r = await fetch(sbURL(TABELA + '?id=eq.' + id + '&select=stanje,tekst,greska'),
      { headers: sbGlava(auth) });
    if (!r.ok) return { ok: false, status: 502, error: 'Rezultat nije pročitan.' };
    const niz = await r.json();
    if (!Array.isArray(niz) || !niz.length) return { ok: false, status: 404, error: 'Posao ne postoji (možda je istekao).' };
    return { ok: true, red: niz[0] };
  } catch (e) { return { ok: false, status: 503, error: 'Baza nije dostupna.' }; }
}

const MODEL = 'gemini-3.5-flash'; /* stabilan (ne "preview"), besplatan nivo dostupan avgust 2026 */
const FALLBACK_MODEL = 'gemini-3.5-flash-lite'; /* ISTA (3.x) generacija kao primarni — gemini-2.5-flash je testom potvrđen NEDOSTUPAN novim nalozima (404 "no longer available to new users", nije bilo vidljivo iz cenovnika), pa rezerva mora biti iz generacije koja je stvarno otvorena za nov nalog. Odvojen (lakši) model = odvojen kapacitet od punog 3.5 Flash. */
const urlFor = m => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
const sleep = ms => new Promise(res => setTimeout(res, ms));

/* Jedan pokušaj poziva ka datom modelu. Vraća {ok:true,text} ili
   {ok:false,status,error,detail,sameRetry,tryFallback}.
   - sameRetry=true SAMO za 503 (Google eksplicitno: "usually temporary" —
     kratak zastoj na ISTOM modelu ima smisla).
   - tryFallback=true za 503 ILI 429 (kvota/limit je PO MODELU — drugi model
     ima svoju odvojenu kvotu, pa ima smisla probati ga; ali NEMA smisla
     čekati pa ponavljati na modelu koji je već potvrđeno na kvoti — 429
     ide direktno na fallback, bez zastoja).
   thinkingLevel:'medium' — potvrđeno kao PODRAZUMEVANA vrednost baš za
   gemini-3.5-flash. NAPOMENA: medium troši više tokena po pozivu nego low,
   pa brže puni besplatnu kvotu — "besplatno" ne znači "neograničeno". */
/* KOLIKO SME DA TRAJE.
   Vercel funkciju seče na `maxDuration` (60 s) i tada klijent dobija HTTP 504
   sa HTML stranicom umesto našeg JSON-a — dakle poruku koju ne kontrolišemo.
   Prijava sa terena: „Server nije vratio ispravan odgovor (HTTP 504)", i to
   tek pošto su u zahtev ušli i podaci po kilometru, koji produže i unos i
   razmišljanje modela.

   Zato se ovde ne čeka do Vercelovog noža nego do NAŠEG: jedan pokušaj ima
   svoj prekid, a ceo lanac pokušaja svoj rok. Šta god da se desi, vraća se
   naš JSON sa razumljivim razlogom.

   PRVA VERZIJA OVOG REZA BILA JE PREOŠTRA: 24 s po pokušaju, a model realno
   traži i preko trideset. Umesto 504 od Vercela dobijao se naš 504 — dakle
   ista nedostupna analiza, samo brže. Zato pokušaj više NEMA fiksni plafon:
   dobija sve što je ostalo do roka, a rezerva se odvaja samo ako od nje ostane
   prozor u kom lakši model zaista može da završi. */
const ROK_MS     = 52000;   /* ceo lanac — 8 s ispod maxDuration, za naš odgovor */
const REZERVA_MS = 16000;   /* koliko se čuva za lakši model, ako ga uopšte ima smisla zvati */
const NAJMANJI_MS = 20000;  /* ispod ovoga poziv nema šanse — ne troši se rok na njega */

async function tryModel(model, systemText, userText, doKada) {
  const ostalo = doKada - Date.now();
  if (ostalo <= 1500) {
    return { ok: false, status: 504, error: 'Analiza je predugo trajala. Pokušaj ponovo.',
             sameRetry: false, tryFallback: false };
  }
  let r;
  try {
    r = await fetch(urlFor(model), {
      method: 'POST',
      /* Ceo preostali rok — kraćenje ovde ne donosi ništa osim ranijeg otkaza. */
      signal: AbortSignal.timeout(ostalo),
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents: [{ parts: [{ text: userText }] }],
        generationConfig: {
          /* 8000 je bilo daleko iznad potrebe (analiza je desetak rečenica), a
             svaki dozvoljen token je i vreme. Ostaje dovoljno mesta i za
             razmišljanje i za tekst, ali ne i za esej. */
          maxOutputTokens: 3000,
          /* NAZAD NA 'medium'. Sa 'low' su stigle analize koje su imale pravilo
             pred sobom pa ga nisu primenile: dekuplovanje od 5,6 % nazvano
             „odlično" (uputstvo izričito kaže 5–8 % = osrednje), i u istom
             pasusu „drifta praktično nije ni bilo" — dve tvrdnje koje se
             poništavaju. Vreme se sad štedi na pravom mestu (izlazni budžet i
             posao odvojen od čekanja), ne na razmišljanju. */
          thinkingConfig: { thinkingLevel: 'medium' }
        }
      })
    });
  } catch (e) {
    /* AbortSignal.timeout baca TimeoutError; mrežni otkaz baca TypeError. */
    const isteklo = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return {
      ok: false, status: isteklo ? 504 : 503,
      error: isteklo ? 'Model nije odgovorio na vreme. Pokušaj ponovo.'
                     : 'Nema veze sa servisom za analizu.',
      /* Na istek NE ide ponovni pokušaj na ISTOM modelu — samo bi pojeo rok.
         Ali lakši model ima smisla: on je i brži, pa u ostatku roka ume da
         stigne tamo gde puni nije. */
      sameRetry: false, tryFallback: true
    };
  }

  if (!r.ok) {
    const errText = await r.text();
    return {
      ok: false, status: 502, error: 'LLM poziv nije uspeo.', detail: errText.slice(0, 300),
      sameRetry: r.status === 503,
      tryFallback: r.status === 503 || r.status === 429
    };
  }

  const data = await r.json();
  const cand = (data.candidates || [])[0];
  const text = ((cand && cand.content && cand.content.parts) || [])
    .filter(p => p.text && !p.thought)
    .map(p => p.text)
    .join('\n')
    .trim();

  if (!text) {
    const fr = (cand && cand.finishReason) || 'nepoznato';
    return { ok: false, status: 502, error: 'LLM je vratio prazan odgovor (finishReason: ' + fr + '). Ako je MAX_TOKENS — treba veći budžet.', sameRetry: false, tryFallback: false };
  }
  return { ok: true, text };
}

/* Jedan kratak ponovni pokušaj na ISTOM modelu (samo za 503), pa
   PREBACIVANJE na stabilniji model (503 ili 429 — kvota je po modelu).
   Ukupno najviše 3 pokušaja, kratak zastoj — ostaje bezbedno unutar
   Vercel serverless vremenskog limita. */
async function callGemini(systemText, userText) {
  const kraj = Date.now() + ROK_MS;
  /* Prvom pokušaju ide sve OSIM rezerve — ali samo ako i posle odvajanja
     ostane prozor u kom puni model može da završi. Ako ne ostane, uzima ceo
     rok i rezerve nema: bolje jedan pokušaj koji stigne nego dva koja ne. */
  const prvi = (ROK_MS - REZERVA_MS >= NAJMANJI_MS) ? kraj - REZERVA_MS : kraj;

  let out = await tryModel(MODEL, systemText, userText, prvi);
  if (out.ok) return out;

  if (out.sameRetry && kraj - Date.now() >= NAJMANJI_MS) {
    await sleep(900);
    out = await tryModel(MODEL, systemText, userText, kraj);
    if (out.ok) return out;
  }

  /* Rezerva se proba samo ako je ostalo vremena da SE I ZAVRŠI — polovična pa
     presečena analiza je isto što i nikakva, samo sporija. */
  if (out.tryFallback && kraj - Date.now() >= 8000) {
    const fb = await tryModel(FALLBACK_MODEL, systemText, userText, kraj);
    if (fb.ok) return fb;
    /* Ako ni rezerva ne stigne, čoveku se vraća PRVI razlog — on opisuje šta
       se stvarno desilo sa modelom koji je trebalo da odgovori. */
    return out.status === 504 ? out : fb;
  }

  return out;
}

/* PREPOZNAVANJE „PREKORAČEN LIMIT" IDE PO ŠIFRI GREŠKE, NE PO TEKSTU.
   Ranije se svuda gledalo `telo.includes('DAILY_LIMIT_EXCEEDED')`. Dok god
   PostgREST prosleđuje poruku izuzetka to radi — ali čim je skrati, promeni
   omot ili je prevede, provera tiho postaje „propusti", i to na svih pet
   putanja odjednom. `errcode` je deo ugovora funkcije (v. rate-limit.sql),
   tekst nije. Tekst ostaje kao rezerva za starije verzije PostgREST-a. */
function jeLimit(telo) {
  let j = null;
  try { j = JSON.parse(telo); } catch (e) {}
  if (j && (j.code === 'P0001' || String(j.message || '').includes('DAILY_LIMIT_EXCEEDED'))) return true;
  return String(telo || '').includes('DAILY_LIMIT_EXCEEDED');
}

/* Dnevni limit po korisniku i endpointu — ista atomska funkcija kao za
   /api/wellness i /api/workouts (v. supabase/rate-limit.sql).

   PROPUŠTA kad baza ne odgovara — namerno, jer SQL možda još nije pušten a ni
   mrežni prekid ne sme da obori analizu. ALI SE VIDI: `console.error`, ne
   `console.warn`. Vercel `warn` meša sa običnim logovima, a `error` ide u
   kanal na koji se može zakačiti obaveštenje. Limit koji tiho otkaže izgleda
   isto kao limit koji radi — mesecima. */
async function limitPrekoracen(token, endpoint, limit) {
  try {
    const r = await fetch(process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/check_and_bump_endpoint', {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_endpoint: endpoint, p_limit: limit })
    });
    if (r.ok) return false;
    const telo = await r.text();
    if (jeLimit(telo)) return true;
    console.error('[limit][ALARM] brojac nije radio (%s) — propusteno bez brojanja. HTTP %s: %s',
      endpoint, r.status, telo.slice(0, 200));
    return false;
  } catch (e) {
    console.error('[limit][ALARM] brojac nedostupan (%s) — propusteno bez brojanja: %s', endpoint, e.message);
    return false;
  }
}

/* Vlasnik naloga — ista provera kao /api/broadcast.js (ugrađena, ne uvezena:
   Vercel funkcije bez build koraka ne razrešavaju lokalne import-e). */
async function jeVlasnik(req) {
  const admin = String(process.env.ADMIN_EMAIL || process.env.REPORT_TO || '').trim().toLowerCase();
  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
  if (!admin || !url || !anon) return false;
  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  if (!m) return false;
  try {
    const r = await fetch(url.replace(/\/+$/, '') + '/auth/v1/user', {
      headers: { apikey: anon, Authorization: 'Bearer ' + m[1] }
    });
    if (!r.ok) return false;
    const u = await r.json();
    const potvrdjen = !!(u && (u.email_confirmed_at || u.confirmed_at));
    return !!(u && u.email && potvrdjen && String(u.email).trim().toLowerCase() === admin);
  } catch (e) { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Samo POST.' });
    return;
  }

  /* Ranije: deljena tajna iz frontenda (`x-app-secret`) — vidljiva svakome ko
     otvori dev tools, dakle nikakva zastita. Sada: Supabase sesija korisnika,
     pa se zna KO zove i kvota se moze meriti po korisniku. */
  const auth = await requireUser(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  /* TELO SE ČITA PRE BROJAČA: od njega zavisi da li se poziv uopšte broji.
     Jedna analiza je sada TRI zahteva (pokreni / radi / pročitaj) — kad bi se
     brojao svaki, dnevni limit bi se trošio tri puta brže za isti posao. */
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: 'Neispravan JSON.' });
    return;
  }
  const posao = (body && typeof body.posao === 'string') ? body.posao : null;
  const posaoId = (body && typeof body.posaoId === 'string') ? body.posaoId.trim() : '';
  const trendTrazen = !!(body && body.trend);

  /* TREND NEMA FAZE POSLA.
     Faza `radi` je nastavak posla koji je već izbrojan pri pokretanju, pa
     preskače dnevni brojač. Trend analiza NIJE nastavak ničega — ona se računa
     odmah i vraća u istom odgovoru. Dok su te dve stvari mogle da stoje u
     istom telu zahteva, `{posao:'radi', trend:{…}}` je bio potpun obilazak
     limita: model se pozove, brojač se ne pomeri, i to bez ijednog reda u
     bazi koji bi to ograničio. Dokazano izvršnim pozivom, ne čitanjem.
     Zato se kombinacija odbija PRE svega ostalog — jeftinije je i jasnije od
     grananja niže. */
  if (trendTrazen && posao) {
    res.status(400).json({ error: 'Trend analiza nema faze posla.' });
    return;
  }

  /* ČITANJE REZULTATA ne troši ni Gemini ključ ni dnevnu kvotu analiza — samo
     pogled u bazu. Ali NIJE besplatno: klijent pita na svake tri sekunde do
     minut i po, pa jedna analiza znači tridesetak poziva. Zato ima sopstven,
     velikodušan brojač — dovoljno visok da normalnu upotrebu nikad ne dotakne,
     dovoljno nizak da petlja ne može da gađa bazu bez kraja. */
  if (posao === 'citaj') {
    if (!UUID.test(posaoId)) { res.status(400).json({ error: 'Neispravan ID posla.' }); return; }
    if (await limitPrekoracen(auth.token, 'analyze_citaj', 1500)) {
      res.status(429).json({ error: 'Previše provera rezultata danas. Pokušaj ponovo sutra.' });
      return;
    }
    const r = await posaoCitaj(auth, posaoId);
    if (!r.ok) { res.status(r.status || 502).json({ error: r.error }); return; }
    res.status(200).json(r.red);
    return;
  }

  /* Dnevni limit poziva po korisniku — Google prijava je otvorena svima,
     bez ovoga bi skripta mogla da isprazni Gemini kvotu. Atomsko (Postgres
     funkcija, ne "procitaj pa upisi") da paralelni zahtevi ne zaobidju limit.
     30/dan je dovoljno velikodusno za stvarnu upotrebu, premalo za automatsko
     iscrpljivanje. */
  const DAILY_LIMIT = 30;
  /* VLASNIK NEMA DNEVNI LIMIT. Limit postoji zato što je Google prijava
     otvorena svima, pa bi tuđa skripta mogla da isprazni Gemini kvotu — a to je
     kvota koju vlasnik plaća. Njemu samom ograničavati sopstvenu potrošnju nema
     smisla.
     Provera je ISTA kao u /api/broadcast.js: adresa mora da se poklopi sa
     ADMIN_EMAIL I da bude POTVRĐENA. Bez provere potvrde bi se, na Supabase
     podešavanju bez obavezne potvrde mejla, svako mogao registrovati
     vlasnikovom adresom i time skinuti limit sebi. */
  const vlasnik = await jeVlasnik(req);
  /* KO PRESKAČE BROJAČ — jedan izraz, ne razbacana provera.
     Preskače SAMO nastavak posla koji je pri pokretanju već izbrojan: faza
     'radi' NAD JEDNIM KONKRETNIM, ISPRAVNIM ID-em posla. Sve ostalo se broji.

     Ranije je uslov glasio `posao !== 'radi'` — dakle oslanjao se na to da
     klijent kaže istinu o tome šta radi. `{posao:'radi', trend:{…}}` je time
     dobijao najskuplji poziv u sistemu (do 150 treninga i 90 dana oporavka u
     promptu) potpuno besplatno, u petlji, sa običnim Google nalogom. Trend je
     sada odbijen gore, a ovde stoji druga brava: bez ispravnog ID-a posla
     nema preskakanja, pa ni buduća faza ne može da se provuče istim putem. */
  const nastavakIzbrojanogPosla = (posao === 'radi' && UUID.test(posaoId));
  if (!vlasnik && !nastavakIzbrojanogPosla) try {
    const rl = await fetch(process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/check_and_bump_api_usage', {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + auth.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_limit: DAILY_LIMIT })
    });
    if (!rl.ok) {
      const errBody = await rl.text();
      if (jeLimit(errBody)) {
        res.status(429).json({ error: 'Dnevni limit AI analiza (' + DAILY_LIMIT + ') je iskorišćen. Pokušaj ponovo sutra.' });
        return;
      }
      /* Funkcija/tabela mozda jos nije podesena u Supabase-u — ne blokiramo
         korisnika zbog toga, samo nastavljamo bez brojanja za ovaj poziv.
         ALI SE TO MORA VIDETI: limit koji tiho prestane da radi izgleda isto
         kao limit koji radi, pa bi kvota mogla da se prazni mesecima a da se
         ne primeti. `error`, ne `warn` — Vercel `warn` meša sa običnim
         logovima, a na `error` kanal se može zakačiti obaveštenje. */
      console.error('[limit][ALARM] brojac nije radio (%s) — propusteno bez brojanja. HTTP %s: %s',
        'api_usage', rl.status, errBody.slice(0, 200));
    }
  } catch (e) {
    /* mrezni problem ovde ne sme da obori celu analizu — ali ostavlja trag */
    console.error('[limit][ALARM] brojac nedostupan (%s) — propusteno bez brojanja: %s', 'api_usage', e.message);
  }

  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({ error: 'GEMINI_API_KEY nije podešen na serveru.' });
    return;
  }

  /* POKRETANJE: samo otvori red i vrati ID. Ništa se ne računa ovde — zato je
     odgovor trenutan i klijent nema šta da čeka. */
  if (posao === 'start') {
    const p = await posaoNapravi(auth);
    if (!p.ok) { res.status(p.status).json({ error: p.error }); return; }
    res.status(200).json({ posaoId: p.id });
    return;
  }
  if (posao === 'radi' && !UUID.test(posaoId)) {
    res.status(400).json({ error: 'Neispravan ID posla.' });
    return;
  }

  const { session, entered, trend, goalCtx, hrZones, hrZonesIzvor } = body || {};
  /* ZONE PULSA — I ČIJE SU.

     Bez zona model o pulsu moze samo da nagadja („visok"), jer ne zna
     maksimalni puls trkaca. Sa njima moze da kaze u kojoj je zoni trening
     zaista bio — sto je jedina posteno merljiva tvrdnja o pulsu.

     ALI: postoje DVA sistema zona. Strava podrazumevano ima pet, izvedenih iz
     maksimalnog pulsa; intervals.icu sedam, izvedenih iz praga. Granice se ne
     poklapaju. Vreme po zonama (`icu.zonePuls`) uvek dolazi sa icu-a, a granice
     su do sada uvek bile Stravine — pa je model raspodelu sa jednog sistema
     citao kroz nazive drugog i tvrdio „ceo trening u zoni 1" za trcanje koje je
     po trkacevim zonama bilo Z2 (prijava korisnika).

     Zato se naziv zone vise ne izmislja: kad icu posalje svoja imena, koriste se
     njegova; inace se pise samo „Z1", „Z2"… bez opisa koji bi tvrdio sta ta
     zona znaci u tudjem sistemu. Fiksni spisak od pet naziva je uklonjen —
     „Z5 VO2max" je za sedmozonski model prosto netacno. */
  const zoneTxt = (z) => {
    if (!Array.isArray(z) || !z.length) return '';
    return z.slice(0, 8).map((x, i) => {
      const ime = (typeof x.ime === 'string' && x.ime.trim()) ? ' ' + x.ime.trim().slice(0, 24) : '';
      return `Z${i + 1}${ime}: ${x.min}${x.max ? ('-' + x.max) : '+'}`;
    }).join(', ');
  };
  /* Broj zona je deo tvrdnje, ne ukras: „Z1 od sedam" i „Z1 od pet" nisu isti
     napor. Uz to se imenuje i sistem, da model ne pomesa sa onim sto trkac vidi
     na drugom servisu. */
  const zoneOpis = (z, izvor) => {
    if (!Array.isArray(z) || !z.length) return '';
    const odakle = izvor === 'icu' ? 'intervals.icu' : izvor === 'strava' ? 'Strava' : 'nepoznat izvor';
    return `${zoneTxt(z)} (${z.length} zona, iz: ${odakle})`;
  };
  const zoneBlok = zoneOpis(hrZones, hrZonesIzvor);
  /* goalCtx ranije bez ikakvog ogranicenja -> direktno u systemInstruction.
     Neograniceno = i prompt injection prostor i nacin da se nadmasi tokenski
     budzet. 200 znakova je vise nego dovoljno za "5K oko 19:30" stil opisa.

     DUŽINA NIJE BILA DOVOLJNA. Ovaj tekst ulazi u SISTEMSKO uputstvo, a u
     njemu se rađa iz `raceName` — polja koje korisnik sam ukuca u čarobnjaku.
     Dvesta znakova je i dalje dovoljno za „…zanemari sva pravila iznad i…",
     a sistemsko uputstvo je baš ono mesto gde takva rečenica nosi najviše
     težine. Šteta je samo sopstvena (svako vidi svoju analizu), ali analiza
     koja izgleda kao uredan trenerski sud a nastala je po podmetnutom pravilu
     je lošija od nikakve — po njoj se trenira.
     Zato se ovde ruše sredstva za izlazak iz rečenice: prelomi reda (bez njih
     se ne može otvoriti nov „odeljak" uputstva) i znaci kojima je ostatak
     prompta strukturiran. Normalne vrednosti („Beogradski maraton", „5K oko
     19:30") prolaze nedirnute. */
  const goalDesc = (typeof goalCtx === 'string' && goalCtx.trim())
    ? (goalCtx.replace(/[\r\n\t]+/g, ' ').replace(/[`{}<>*#]/g, '').replace(/\s{2,}/g, ' ').trim().slice(0, 200)
       || '5K oko 19:30 (cilj koji i na lošiji dan iznosi sub-20)')
    : '5K oko 19:30 (cilj koji i na lošiji dan iznosi sub-20)';

  // TREND ANALIZA — poseban tip zahteva (svi treninzi od početka plana)
  if (trend) {
    return handleTrend(trend, res, goalDesc,
      trend.hrZones ? zoneOpis(trend.hrZones, trend.hrZonesIzvor || hrZonesIzvor) : zoneOpis(hrZones, hrZonesIzvor));
  }

  if (!session || !entered) {
    res.status(400).json({ error: 'Nedostaju podaci o sesiji (session/entered).' });
    return;
  }

  // Osnovna sanitizacija dužine — sprečava slučajno ogroman payload da ne pojede kvotu.
  const cap = (s, n) => (typeof s === 'string' ? s.slice(0, n) : s);

  const isEasy = session.tag === 'lako' || session.tag === 'lr';
  const sys = `Ti si trkački trener koji analizira JEDAN konkretan trening za trkača koji se sprema za ${goalDesc} (Jack Daniels VDOT metodologija). Dobijaš plan sesije i šta je ostvareno.

Piši na srpskom jeziku, JEDNOSTAVNIM i tačnim rečenicama. Proveri gramatiku — piši kratke, jasne rečenice umesto dugačkih. Ne koristi reči za koje nisi siguran. 4-7 rečenica, direktno.

${isEasy ? `OVO JE PO PLANU LAGANO/DUGO TRČANJE (E-zona po Danielsu). Cilj lakog trčanja je nizak, stabilan puls i oporavak — NE brzina.
PAŽNJA: proveri prvo plan sesije i opis sa Strave. Ako je trkač tog dana radio PROGRESIVNO trčanje, trčanje sa završetkom na tempu trke ili bilo kakav strukturiran napor, pravila za lagano trčanje NE VAŽE — tada rast tempa i pulsa kroz trening jeste namera, pa oceni pogađanje ciljnih tempova po blokovima. U tom slučaju preskoči pravila ispod.
Ako je zaista bilo lagano, analiziraj ovako:
- DA LI JE LAKO STVARNO BILO LAKO: na lakom trčanju puls treba da bude nizak i stabilan. Ako puls kroz kilometre RASTE značajno (kardiovaskularni drift na laganom tempu) ili je generalno visok, trkač je trčao PREBRZO — lako trčanje nije bilo lako. To je česta greška. Reci to jasno ako vidiš.
- KADENCA: na laganom tempu kadenca često padne (šljapkanje). Ako je kadenca ispod 85, predloži da je podigne ka 85-90 čak i pri sporom trčanju — kraći, brži koraci štede zglobove. Ako je 85+, pohvali.
- DRIFT PO KILOMETRIMA: reci konkretno kako se puls kretao (npr. "prvi km 140, poslednji 155, porast od 15" ). Mali drift (par otkucaja) je normalan. Veliki drift na laganom tempu = trčao prebrzo ili loš oporavak/hidratacija. AKO PODACI PO KILOMETRU NISU DATI (samo prosek cele sesije): ne izmišljaj brojeve za pojedinačne kilometre — komentariši samo prosečan puls naspram cilja niskog pulsa, i reci da bi drift-po-km bio koristan da postoji.` : `OVO JE KVALITETNO TRČANJE (intervali/tempo).
- Uporedi ostvaren tempo radnog dela sa planiranim — reci da li je brže/sporije/tačno, i za koliko sekundi po km.
- AKO SU DATI PODACI PO KRUGU (puls, kadenca, snaga po radnom intervalu): analiziraj da li puls RASTE kroz intervale pri istom tempu — kardiovaskularni drift, znači izdržljivost na tom tempu treba graditi (ne brzina). Reci konkretno koliko je porastao. Kadenca 88-95 je zdravo, ispod 85 predugačak korak. Snaga (watts) koja opada uz isti tempo = zamor. Stabilan puls = dobra izdržljivost, pohvali.
- AKO UMESTO PO KRUGU DOBIJEŠ PODATKE PO KILOMETRU (sat je merio drugačije od strukture treninga): koristi ih isto — gledaj da li puls raste kroz kilometre radnog dela (drift) i kakva je kadenca. Napomeni da su podaci po kilometru, ne po intervalu, pa je granica između rada i odmora manje oštra.
- AKO NEMAŠ NI PODATKE PO KRUGU NI PO KILOMETRU (dat je samo prosek cele sesije): NIKAD ne izmišljaj konkretne brojeve za pojedinačne intervale/krugove (npr. "u prvom intervalu puls je bio X, u drugom Y") — tih podataka nemaš, pa bi to bila izmišljena, netačna informacija. Komentariši SAMO ono što prosek stvarno pokazuje (ukupan tempo naspram plana, prosečan puls, RPE, beleška). Ako bi drift/napredak kroz intervale bio koristan podatak, reci da nedostaje umesto da ga pretpostaviš.`}

PRE SLANJA PROVERI SVOJ TEKST — ovo su greške koje su se stvarno desile:
- Nijedna ocena ("odlično", "osrednje", "slabo") ne sme da protivreči skali koja ti je data ispod. Skala je jača od utiska.
- Ne piši dve tvrdnje koje se međusobno poništavaju.
- Kad opisuješ PORAST, prvi broj mora biti MANJI od drugog. "Porastao sa 142 na 141" nije porast nego pad. Ako nisi siguran u smer, ne navodi brojeve.
- Izraz "radni deo" postoji SAMO na kvalitetnim sesijama. Na laganom i dugom trčanju nema radnog dela — ne koristi taj izraz.
- Kad se pozivaš na jutarnji oporavak, uzmi SVE što ti je dato (HRV, puls u miru, san, svežina), ne samo ono što se uklapa u zaključak. Ako je san kratak ili svežina negativna, to se pominje čak i kad je trening dobro prošao.

KAKO SE ČITA PULS — pročitaj ovo PRE nego što doneseš bilo kakav zaključak o driftu:
1. DRIFT SE MERI SAMO NA ISTOM TEMPU. Poređenje prvog i poslednjeg kilometra ima smisla JEDINO ako su trčani približno istim tempom (razlika manja od ~10 s/km). Ako je poslednji kilometar BRŽI, veći puls je očekivan i to NIJE drift — to je posledica bržeg trčanja. Nikad ne nazivaj to driftom.
2. PRVI 1–2 KILOMETRA NISU MERILO. Puls kasni za naporom nekoliko minuta (kardijalna inercija) i na početku je uvek nizak, pa poređenje "prvi km naspram poslednjeg" preuveličava svaki porast. Ako imaš više kilometara na sličnom tempu, poredi njih međusobno.
3. AKO JE TRČANJE PROGRESIVNO (tempo namerno pada kroz trening — vidi plan sesije i opis sa Strave): rast pulsa je CILJ treninga, a ne greška. Tada oceni da li je trkač POGODIO ciljne tempove po blokovima i da li je poslednji blok uspeo da odradi, a ne da li je puls porastao.
4. USPON DIŽE PULS PRI ISTOM TEMPU. Gde je uz kilometar naveden uspon, uračunaj ga pre nego što porast pripišeš zamoru.
5. O PULSU GOVORI KROZ ZONE ako su date. Ako zone nisu date, NE proglašavaj puls "visokim" ili "niskim" u apsolutnom smislu — ne znaš maksimalni puls ovog trkača; govori samo o PROMENI kroz trening.
6. DEKUPLOVANJE (Pa:HR) je mera aerobne izdržljivosti: ispod 5% je dobro, 5-8% osrednje, preko 8% znači da druga polovina košta znatno više otkucaja pri istom tempu. Ako je dato, to je pouzdaniji sud o izdržljivosti nego sirov porast pulsa — koristi ga. Ako piše da nije računato jer tempo nije bio ravnomeran, NE izvodi zaključak o izdržljivosti iz porasta pulsa.
   6a. OCENU DEKUPLOVANJA UZIMAŠ IZ OVE SKALE, ne iz sopstvenog utiska. Broj od 5,6% je OSREDNJE — ne "odlično", ne "izvrsno". Ako ti se čini da je trening bio dobar, to nije razlog da broj prekrstiš; reci da je trening bio dobar i da je dekuplovanje osrednje.
   6b. AKO SI NAVEO DEKUPLOVANJE, NE SMEŠ u istom tekstu napisati da "drifta nije bilo" — dekuplovanje JESTE mera tog drifta. Dve tvrdnje koje se poništavaju su gora greška od nijedne.
7. TOPLOTA diže puls 5-10 otkucaja pri istom tempu. Ako je data temperatura preko 22°C, uračunaj to pre nego što porast pripišeš lošoj formi. Uz temperaturu UVEK piše odakle je — meteorološka prognoza za mesto i sat trčanja, ili senzor na ručnom satu. Zglobno očitavanje je 2-5 °C više od vazduha; kad je izvor sat, govori o toploti opisno („bilo je toplo") i NE citiraj cifru kao tačnu temperaturu vazduha. Reč „ekstremno" čuvaj za preko 32 °C IZ PROGNOZE — nikad je ne izvodi iz očitavanja sa sata.
8. OPORAVAK TOG JUTRA (HRV, puls u miru, san) menja tumačenje SVEGA ostalog. Isti tempo uz isti puls nije isti trening posle 5 sati sna. Pravila:
   - HRV se čita kao ODSTUPANJE od sopstvene sedmodnevne osnove, nikad kao gola brojka; pad preko 10% je značajan, pad preko 20% je jasan znak nedovoljnog oporavka.
   - Puls u miru viši 5+ otkucaja od sopstvene osnove ukazuje na umor, početak bolesti ili loš san.
   - San ispod 6 sati objašnjava viši puls i teži osećaj na istom tempu.
   - Ako je oporavak bio loš a trening ipak odrađen po planu, to je uspeh — reci to, ne zamerku.
   - Ako oporavak nije dat, NE nagađaj o njemu.
9. ZONE PULSA SU TRKAČEVE, NE OPŠTE. Ako su zone date, uz njih piše KOLIKO ih ima i IZ KOG servisa su. Petozonski i sedmozonski model nisu isto: „Z2" od pet zona i „Z2" od sedam su različiti napori, pa nikad ne prevodi jedno u drugo i ne dodaj opise („Z1 je oporavak") koje sam izmisliš — koristi samo nazive koji su dati. Ako zone NISU date, ne imenuj nijednu zonu; o pulsu tada govori kao o broju u odnosu na trkačeve druge treninge. Kad piše da je vreme po zonama računato po drugom sistemu nego što su granice, o zonama NE zaključuj ništa — reci samo da raspodela nije uporediva sa navedenim granicama.
10. AKO JE DATA RASPODELA PO ZONAMA, OBAVEZNO JE NAPIŠI, u jednoj rečenici i redom od Z1 naviše: koliko je procenata provedeno u kojoj zoni. Prepiši procente DOSLOVNO onako kako su dati — već su izračunati i trkač ih vidi na ekranu, pa svaki tvoj drugačiji broj izgleda kao greška. Zone sa 0% preskoči. Tek posle toga reci šta ta raspodela znači za OVAJ tip treninga: na laganom i dugom trčanju najveći deo treba da bude u dve najniže zone i svaki veći upad u srednje zone znači da je trčano prebrzo; na intervalima se očekuje da su najviše zone stvarno dosegnute, pa je mali udeo u njima znak da radni deo nije bio dovoljno oštar. Ne izmišljaj ciljne procente kao pravilo („treba 80%") — sudi u odnosu na to šta je plan tog dana tražio.

ŠTA MORAŠ DA UZMEŠ U OBZIR PRE ZAKLJUČKA:
- Šta je sesija TREBALO da bude (plan) i šta je trkač SAM napisao na Stravi da radi tog dana. Ako se to dvoje razlikuje, sudi po onome što je trkač NAMERAVAO, a razliku od plana pomeni jednom rečenicom.
- Zaustavljanja (semafor, česma): tempo je već računat iz vremena u pokretu, pa ih NE tumači kao usporavanje.
- RPE i belešku trkača — ako kaže da je bio bolestan, umoran ili da je bila vrućina, to menja tumačenje svih brojeva.
- Kadencu, i da li se držala kroz ceo trening ili je pala pri kraju (pad = gubitak forme koraka od zamora).
- Ukupan uspon i maksimalan puls sesije ako su dati.
- Snagu (watts) po kilometru ako je data: pad snage uz isti tempo znači zamor, rast uz isti tempo znači da je teren teži (uspon/vetar).

Zajedničko pravilo:
- NIKAD ne izmišljaj konkretne buduće tempove, VDOT brojeve ili preporuke za sledeći trening — to računa aplikacija. Tumačiš OVAJ trening.
- Ako neki podatak izgleda beznačajan (par stotina metara viška od zaokruživanja), ne troši rečenice na njega.
- AKO JE TRENING ODRAĐEN KAKO TREBA, RECI TO. Ne traži manu po svaku cenu — lažna zamerka je gora od kratke pohvale.
- Bez generičkih motivacionih fraza. Svaka rečenica mora da prati iz brojeva.`;

  const fmtPace = s => Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  let lapsBlock = '';
  const MAX_ITEMS = 50; /* i najduzi maraton ima ~42 km-splita; 50 je siguran plafon */
  if (Array.isArray(entered.laps) && entered.laps.length) {
    /* Redni broj je bio `L.i` — polje koje nijedan izvor ne postavlja, pa je u
       promptu stajalo „Interval undefined (800m)". Broji se iz niza. */
    const izIcu = entered.lapsIzvor === 'icu';
    lapsBlock = '\n\nPODACI PO RADNOM KRUGU (najvažnije za analizu)' +
      (izIcu ? ' — deonice je prepoznao intervals.icu nad izvornim fajlom sa sata, ne procena.' : '.') + '\n' +
      entered.laps.slice(0, MAX_ITEMS).map((L, i) =>
        `Rep ${i+1}${L.distM?` (${L.distM} m)`:''}: tempo ${fmtPace(L.paceSec)}/km` +
        (L.gapSec!=null?`, GAP ${fmtPace(L.gapSec)}/km`:'') +
        (L.avgHr!=null?`, puls ${L.avgHr}`:'') +
        (L.maxHr!=null?`, maks ${L.maxHr}`:'') +
        (L.cadence!=null?`, kadenca ${L.cadence}`:'') +
        (L.watts!=null?`, snaga ${L.watts}W`:'') +
        (L.restSec!=null?`, oporavak posle ${Math.floor(L.restSec/60)}:${String(L.restSec%60).padStart(2,'0')}`:'')
      ).join('\n') +
      (izIcu ? '\nGAP je tempo korigovan za nagib. Kad se GAP i tempo poklapaju, teren nije bio faktor.' : '');
    /* Serija kao celina — model iz nje vidi trend kroz ponavljanja bez da ga
       sam sabira, a iz pojedinačnih repova i dalje vidi gde je pukao. */
    if (Array.isArray(entered.grupe) && entered.grupe.length) {
      lapsBlock += '\n\nSERIJE (grupisana ponavljanja):\n' +
        entered.grupe.slice(0, 10).map(G =>
          `${G.oznaka || 'serija'}${G.n?` — ${G.n}×`:''}${G.distM?` ${G.distM} m`:''}` +
          (G.paceSec!=null?`: prosek ${fmtPace(G.paceSec)}/km`:'') +
          (G.gapSec!=null?`, GAP ${fmtPace(G.gapSec)}/km`:'') +
          (G.hr!=null?`, puls ${G.hr}`:'') +
          (G.razdvajanje!=null?`, razdvajanje ${G.razdvajanje}%`:'')
        ).join('\n');
    }
  }
  if (Array.isArray(entered.perKm) && entered.perKm.length) {
    /* Tempo je iz VREMENA U POKRETU. `stopSec` je vreme stajanja na tom
       kilometru (semafor, cesma, prelaz) — mora biti izricito receno modelu,
       inace ga tumaci kao usporavanje i gradi celu analizu na tome. */
    const imaStop = entered.perKm.some(K => K.stopSec);
    lapsBlock += '\n\nPODACI PO KILOMETRU (za drift i kadencu kroz celo trčanje).\n' +
      'Tempo je računat iz vremena U POKRETU, pauze nisu uračunate' +
      (imaStop ? '; gde piše "stajanje" trkač je stajao toliko sekundi (semafor, česma) — to NIJE usporavanje i ne tumači ga kao pad tempa.\n' : '.\n') +
      entered.perKm.slice(0, MAX_ITEMS).map(K =>
        `km ${K.km}: tempo ${K.paceSec!=null?fmtPace(K.paceSec):'—'}/km` +
        (K.hr!=null?`, puls ${K.hr}`:'') +
        (K.cadence!=null?`, kadenca ${K.cadence}`:'') +
        (K.watts!=null?`, snaga ${K.watts}W`:'') +
        (K.elevM?`, ${K.elevM>0?'uspon':'spust'} ${Math.abs(K.elevM)} m`:'') +
        /* TEMPERATURA PO KILOMETRU JE NAMERNO IZOSTAVLJENA. Dolazi iz Strava
           `temp` toka, dakle sa senzora na zglobu, i ume da „poraste" za 3 °C
           kroz trčanje samo zato što se sat zagrejao. Sesija sada ima jednu
           merodavnu temperaturu iz prognoze (v. `dodatno` niže); nizanje
           zglobnih očitavanja pored nje davalo bi modelu dva izvora koji se ne
           slažu, i to onaj netačniji u većem broju redova. */
        (K.stopSec?`, stajanje ${K.stopSec} s`:'')
      ).join('\n');
  }

  const svojOpis = [session.stravaName, session.stravaDesc].filter(x => typeof x === 'string' && x.trim()).join(' — ');
  const dodatno = [
    entered.maxHr!=null ? `Maksimalan puls sesije: ${entered.maxHr}` : null,
    entered.elevGain!=null ? `Ukupan uspon: ${entered.elevGain} m` : null,
    /* TEMPERATURA SA IZVOROM — v. `tempTrcanja` u app.js.
       Stiže kao objekat {temp, osecaj, sat, izvor}, ne kao broj. Stariji
       klijenti (offline kopija koja još nije osvežena) šalju go broj, pa se i
       taj oblik i dalje prima — bez toga bi im temperatura tiho nestala iz
       analize dok ne osveže aplikaciju.
       Poreklo se modelu kaže IZRIČITO. Bez toga je zglobno očitavanje čitao kao
       temperaturu vazduha i nazivao ga ekstremnim (prijavljeno: 33 °C sa sata
       naspram 30 °C u prognozi za taj sat). */
    (() => {
      const t = entered.temp;
      if (t == null) return null;
      if (typeof t === 'number') return `Temperatura: ${t}°C (nepoznat izvor — ne pripisuj joj veliku tačnost)`;
      if (typeof t !== 'object' || !Number.isFinite(+t.temp)) return null;
      const os = Number.isFinite(+t.osecaj) && Math.abs(+t.osecaj - +t.temp) >= 1 ? `, oseća se kao ${t.osecaj}°C` : '';
      const sat = Number.isFinite(+t.sat) ? ` u ${t.sat}:00` : '';
      return t.izvor === 'sat'
        ? `Temperatura: ${t.temp}°C${os} — IZMERIO SENZOR NA RUČNOM SATU, ne meteorološka stanica. ` +
          'Sat stoji uz kožu i hvata telesnu toplotu i sunce, pa sistematski čita 2-5 °C više od vazduha. ' +
          'Koristi je samo kao grubu naznaku da je bilo toplo; NE navodi je kao tačnu temperaturu i ne nazivaj je ekstremnom.'
        : `Temperatura vazduha${sat} (meteorološka prognoza za mesto i sat trčanja): ${t.temp}°C${os}. ` +
          'Ovo je temperatura vazduha, ne očitavanje sa sata — možeš je koristiti kao pouzdan podatak.';
    })(),
    entered.relEffort!=null ? `Strava relative effort: ${entered.relEffort}` : null,
    entered.oporavak ? (() => {
      const o = entered.oporavak, d = [];
      if (o.hrv != null) d.push(`HRV ${o.hrv}` + (o.hrvOdstupanje != null ? ` (${o.hrvOdstupanje>=0?'+':''}${o.hrvOdstupanje}% od sedmodnevne osnove ${o.hrvBaza7})` : ''));
      if (o.pulsUMiru != null) d.push(`puls u miru ${o.pulsUMiru}` + (o.pulsOdstupanje != null ? ` (${o.pulsOdstupanje>=0?'+':''}${o.pulsOdstupanje} od osnove ${o.pulsBaza7})` : ''));
      if (o.sanH != null) d.push(`san ${o.sanH} h` + (o.sanOcena != null ? ` (ocena ${o.sanOcena})` : ''));
      if (o.svezina != null) d.push(`svežina ${o.svezina} (forma ${o.ctl}, umor ${o.atl})`);
      return d.length ? `Oporavak tog jutra: ${d.join(', ')}` : null;
    })() : null,
    entered.decoupling ? (entered.decoupling.n!=null
        ? `Dekuplovanje (Pa:HR, druga polovina naspram prve): ${entered.decoupling.n}%` +
          (entered.decoupling.izvor === 'icu' ? ' (izmerio intervals.icu nad celim fajlom)' : '')
        : `Dekuplovanje nije računato — ${entered.decoupling.razlog}. Ne izvodi zaključak o izdržljivosti iz porasta pulsa.`) : null,
    /* Ono što intervals.icu izračuna sam. Ne dupliraju se polja koja već stoje
       gore (maks. puls) niti ona koja su zamenjena boljim izvorom (temperatura i
       osećaj — sada iz prognoze, v. `dodatno` gore) — samo ono što Strava
       putanja nema. */
    (() => {
      const I = entered.icu; if (!I || typeof I !== 'object') return null;
      const d = [];
      if (I.gapSec != null) d.push(`GAP cele sesije ${fmtPace(I.gapSec)}/km`);
      /* `osecaSe` sa intervals.icu se NE šalje: izvedeno je iz `average_temp`,
         dakle iz istog zglobnog očitavanja, pa bi protivrečilo temperaturi iz
         prognoze. Osećaj sada dolazi uz nju (`apparent_temperature`). */
      if (I.efikasnost != null) d.push(`faktor efikasnosti ${I.efikasnost}`);
      if (I.opterecenje != null) d.push(`trenažno opterećenje ${I.opterecenje}`);
      if (I.intenzitet != null) d.push(`intenzitet ${I.intenzitet}`);
      if (I.korak != null) d.push(`dužina koraka ${I.korak} cm`);
      /* VREME PO ZONAMA — SAMO KAD SE POKLAPA SA GRANICAMA KOJE SU GORE.

         Ovaj niz uvek dolazi sa intervals.icu. Ako su granice zona Stravine,
         njegov prvi broj NIJE Stravina Z1 — to su dva sistema sa različitim
         brojem zona i različitim granicama. Ranije se svejedno slao kao
         „(Z1→)", pa je model raspodelu imenovao tuđim zonama; odatle „ceo
         trening u zoni 1" za trčanje koje je po Stravinim zonama bilo Z2.

         Dva uslova, oba nužna:
           1. granice moraju biti IZ ISTOG izvora (icu),
           2. broj zona mora biti ISTI — icu ume da vrati raspodelu po starom
              broju zona ako ih je trkač u međuvremenu promenio, a tada se
              indeksi tiho pomere za jedno mesto.
         Kad nešto od toga ne stoji, raspodela se ne šalje i modelu se kaže
         zašto — ćutanje je ovde bolje od tvrdnje koja izgleda merljivo. */
      /* Sirove sekunde su REZERVA za stariju offline kopiju koja još ne šalje
         `zoneUdeo`. Kad gotovi procenti postoje, ovaj red se preskače — inače bi
         model dobio dva opisa iste stvari, jedan od kojih traži da sam deli. */
      if (!entered.zoneUdeo && Array.isArray(I.zonePuls) && I.zonePuls.some(x => x > 0)) {
        const brZona = Array.isArray(hrZones) ? hrZones.length : 0;
        if (hrZonesIzvor === 'icu' && brZona === I.zonePuls.length)
          d.push('vreme po zonama pulsa (Z1→, iste zone kao gore) u sekundama: ' + I.zonePuls.join('/'));
        else
          d.push('vreme po zonama pulsa postoji, ali je računato po DRUGOM sistemu zona nego što su granice navedene gore — ne imenuj zone i ne izvodi zaključak o tome u kojoj je zoni trening bio');
      }
      return d.length ? 'Sa intervals.icu: ' + d.join(' · ') : null;
    })(),
    /* RASPODELA PO ZONAMA — SVOJ RED, ne pod „Sa intervals.icu".

       Prvo je stajala unutar tog bloka i time zavisila od `entered.icu`, sa
       kojim nema veze: procente računa aplikacija (v. `zoneRaspodela`), pa bi
       trening bez ijednog drugog icu polja tiho ostao bez raspodele. Uhvaćeno
       zamkom, ne čitanjem.

       Procenti stižu GOTOVI i identični su onima na kartici „Po zonama" koju
       trkač vidi tik iznad analize. Zato se modelu izričito zabranjuje da ih
       preračunava: svaki njegov drugačiji broj čita se kao greška, i bio bi. */
    /* „PO ZONAMA NAVEDENIM NA VRHU" SE SME RECI SAMO KAD JE TO ISTINA.

       Ista dva uslova koja `I.zonePuls` grana iznad vec drzi — granice moraju
       biti date i broj zona se mora poklapati — samo su ovoj grani nedostajala.
       Posledica je bila tacno onaj bug zbog kog je i pisana provera iznad:
       procenti izracunati po sedam icu zona, a iznad njih spisak od pet
       Stravinih, uz recenicu koja ta dva izricito povezuje. Aplikacija sada
       salje granice po kojima je stvarno racunala (v. `zoneZaTrening`), pa ovo
       stoji zbog starijih offline kopija — one i dalje salju `zoneUdeo` uz zone
       naloga i ne znaju za razliku.
       Kad se ne poklapa, raspodela se i dalje salje (brojevi su tacni i trkac
       ih vidi na ekranu), ali se modelu kaze da imena zona nisu ta. */
    (() => {
      const U = entered.zoneUdeo;
      if (!U || !Array.isArray(U.redovi)) return null;
      const vidljivi = U.redovi.filter(x => x && x.sec > 0 && Number.isFinite(+x.pct));
      if (!vidljivi.length) return null;
      const opis = vidljivi
        .map(x => `Z${x.n}${typeof x.ime === 'string' && x.ime.trim() ? ' ' + x.ime.trim().slice(0, 24) : ''} ${x.pct}% (${Math.round(x.sec / 60)} min)`)
        .join(', ');
      const poklapaSe = Array.isArray(hrZones) && hrZones.length === U.redovi.length;
      const glava = poklapaSe
        ? 'RASPODELA VREMENA PO ZONAMA PULSA (po zonama navedenim na vrhu)'
        : 'RASPODELA VREMENA PO ZONAMA PULSA (računata po zonama iz samog tog treninga, koje NISU one navedene na vrhu — navedi procente, ali NE imenuj zone i ne zaključuj u kojoj je zoni trening bio)';
      return `${glava}: ${opis}` +
             (U.ukupno ? ` — ukupno ${Math.round(U.ukupno / 60)} min` : '') +
             '. Procenti su VEĆ IZRAČUNATI i trkač ih vidi na ekranu — prepiši ih doslovno i NE preračunavaj ih sam.';
    })()
  ].filter(Boolean).join('\n');
  const userMsg = `${zoneBlok ? `ZONE PULSA OVOG TRKAČA: ${zoneBlok}\n\n` : ''}PLAN SESIJE: ${cap(session.desc, 500)}
Tip sesije po planu: ${cap(session.kind, 40) || '—'}
Planiran tempo radnog dela: ${cap(session.planPace, 20)}
Ciljna distanca radnog dela: ${session.q ?? '—'} km
${svojOpis ? `ŠTA JE TRKAČ SAM UPISAO NA STRAVI ZA OVAJ TRENING (njegova stvarna namera tog dana): ${cap(svojOpis, 500)}` : 'Trkač nije upisao svoj opis na Stravi.'}

OSTVARENO:
Tempo radnog dela (prosek): ${cap(entered.workPace, 20) || 'nije unet'}
Ukupna distanca: ${entered.km ?? '—'} km, vreme: ${cap(entered.time, 20) ?? '—'}
Prosečan puls (cela sesija): ${entered.hr ?? 'nije unet'}
RPE (1-10): ${entered.rpe ?? 'nije unet'}
Beleška trkača: ${cap(entered.note, 400) || '(bez beleške)'}
${dodatno}${lapsBlock}`;

  /* IZVRŠAVANJE. U fazi 'radi' rezultat ide u BAZU — odgovor ovog zahteva
     niko ne čeka, pa je svejedno da li klijent dočeka njegov kraj. Bez faze
     (stari, sinhroni put) tekst se vraća kao i do sada. */
  if (posao === 'radi') {
    const uzeo = await posaoPreuzmi(auth, posaoId);
    if (!uzeo.ok && uzeo.status) { res.status(uzeo.status).json({ error: uzeo.error }); return; }
    if (!uzeo.ok) { res.status(200).json({ vec: true }); return; }   /* neko drugi ga je već preuzeo */
    try {
      const out = await callGemini(sys, userMsg);
      await posaoZavrsi(auth, posaoId, out.ok
        ? { stanje: 'gotovo', tekst: String(out.text || '').slice(0, 6000) }
        : { stanje: 'greska', greska: String(out.error || 'Nepoznata greška.').slice(0, 300) });
      /* TEK POSLE upisa. Obrnutim redom bi obaveštenje umelo da stigne pre
         nego što rezultat postoji u bazi — čovek otvori aplikaciju i vidi da
         se i dalje računa, što je gore nego da obaveštenja nema. */
      await javiDaJeGotovo(req, auth.userId, out.ok, body && body.danId);
      res.status(200).json({ gotovo: out.ok });
    } catch (e) {
      await posaoZavrsi(auth, posaoId, { stanje: 'greska', greska: 'Greška na serveru.' });
      await javiDaJeGotovo(req, auth.userId, false, body && body.danId);
      res.status(200).json({ gotovo: false });
    }
    return;
  }

  try {
    const out = await callGemini(sys, userMsg);
    if (!out.ok) { res.status(out.status).json({ error: out.error, detail: out.detail }); return; }
    res.status(200).json({ text: out.text });
  } catch (e) {
    res.status(500).json({ error: 'Greška na serveru.', detail: String(e).slice(0, 200) });
  }
}

/* ===== TREND ANALIZA — svi treninzi kroz vreme ===== */
async function handleTrend(trend, res, goalDesc, zoneBlok) {
  const fmtPace = s => Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  const MAX_HIST = 150; /* velikodusno za punu istoriju više ciklusa plana */
  const treninzi = (Array.isArray(trend.treninzi) ? trend.treninzi : []).slice(0, MAX_HIST);
  const vdot = (Array.isArray(trend.vdot) ? trend.vdot : []).slice(0, MAX_HIST);

  const sys = `Ti si trkački trener koji analizira TREND FORME kroz ceo trenažni period za trkača koji cilja ${goalDesc} (Jack Daniels VDOT). Dobijaš sažetak svih treninga i istoriju VDOT-a.

Piši na srpskom, jednostavnim tačnim rečenicama. 6-9 rečenica. Fokus je na TRENDU, ne na pojedinačnom treningu.
Podeli odgovor na DVA pasusa razdvojena praznim redom: prvi o tome gde je trkač sada (iz brojeva), drugi o tome šta sledi. Čita se na telefonu — jedan blok teksta se ne čita.

KAKO SE ČITAJU PODACI:
- DRIFT je ovde već računat POŠTENO: druga polovina trčanja naspram prve, i SAMO kad je tempo bio ravnomeran. Gde piše "progresivno", tempo je namerno menjan i drift NIJE računat — takav trening ne koristi za sud o izdržljivosti, nego gledaj da li je pogodio ciljne tempove.
- DEKUPLOVANJE (Pa:HR) je najbolja mera aerobne izdržljivosti koju imaš: ispod 5% dobro, preko 8% slabo. Ako pada kroz nedelje pri istom tempu — izdržljivost raste. To je jači signal od samog VDOT-a.
- NEDELJNI OBIM je dat posebno. Pre nego što kažeš "forma stagnira", proveri da li je obim pao — pad forme uz pad obima nije misterija, to je posledica. Isto tako: skok obima preko 25% u nedelju dana je rizik od povrede i vredi ga pomenuti.
- O PULSU govori kroz zone ako su date; bez njih ne sudi o apsolutnim brojkama jer ne znaš maksimalan puls trkača.
- RPE i Strava relative effort pokazuju koliko je trening KOŠTAO. Isti tempo uz niži RPE kroz nedelje je napredak i kad VDOT stoji.
- GAP je tempo korigovan za nagib. Kad se GAP i tempo poklapaju, teren nije bio faktor i tempi su uporedivi. Kad se razilaze, poredi GAP, ne tempo — inače brdovit trening izgleda kao pad forme.
- OPORAVAK između repova („oporavak 120s→150s") pokazuje da li je serija držala. Produžavanje oporavka kroz seriju je raniji znak da je trening bio pretežak od samog pada tempa.
- EFIKASNOST (efficiency factor) kroz vreme je najčistiji pokazatelj aerobnog napretka: isti tempo uz niži puls. Gledaj je kao trend kroz nedelje, nikad kao pojedinačan broj.
- OPORAVAK (HRV, puls u miru, san) je dat po danima kad postoji. HRV gledaj kao trend i kao odstupanje od sopstvene osnove, nikad kao golu brojku. Ako HRV pada nedeljama ili puls u miru raste dok obim raste, to je preopterećenje — reci to jasno, to je najvažnija stvar koju možeš da uočiš. Ako je san dosledno ispod 7 sati, to ograničava napredak više od bilo kog detalja u treningu.
- SVEŽINA (forma minus umor, iz intervals.icu) pokazuje da li trkač ulazi u trku odmoran. Pred trku treba da raste. NEGATIVNA SVEŽINA USRED BLOKA IZGRADNJE JE NORMALNA i sama po sebi nije problem — tako izgleda nedelja u kojoj se radi. Zabrinjava tek ako ostaje duboko negativna nedeljama uz rast pulsa u miru ili pad HRV-a, ili ako je takva pred samu trku.

Analiziraj:
- DA LI IZDRŽLJIVOST RASTE: kroz drift na uporedivom tempu i kroz dekuplovanje. Konkretno, sa brojevima i datumima.
- DA LI VDOT RASTE ka cilju — I DA LI DOVOLJNO BRZO. Račun ti je već dat gotov (blok TEMPO NAPRETKA): ostvaren rast po nedelji, potreban rast po nedelji i projekcija na dan trke. NE RAČUNAJ SAM, koristi te brojeve.
  Ako je potreban tempo napretka bitno veći od ostvarenog (npr. dvostruko), cilj NIJE dostižan u tom roku i to moraš reći jasno, sa oba broja, i navesti projekciju kao realan ishod. Nemoj ublažavati sa "dostižno je uz zalaganje". Reci koji je realan ishod na trenutnom tempu i šta bi konkretno moralo da se promeni (obim, doslednost, san) da bi se približio cilju.
  Rast VDOT-a od oko 1 poena na 4-6 nedelja je već dobar napredak kod uvežbanog trkača; ako brojevi traže mnogo više od toga, to je znak da je cilj postavljen preambiciozno za taj rok — a ne da trkač podbacuje.
- KONTROLNA TRKA (time trial) na kraćoj distanci NE potvrđuje ciljno vreme na dužoj. Ako procenjuješ, prevedi je pošteno u ekvivalent ciljne distance i reci raspon, ne jedan broj.
- OBIM: raste li, stagnira, ima li rupa (bolest/pauza) i kako se to poklapa sa formom.
- KADENCA kroz vreme: popravlja se ili pada.
- DA LI SU LAKA TRČANJA ostajala lagana ili je trkač konstantno preforsirao.
- Konkretna, iskrena procena: ide li ka cilju (${goalDesc}) ili ne, i šta je najveći ograničavajući faktor SADA (izdržljivost, obim, brzina, doslednost, oporavak).

ŠTA DOLAZI (ako je dat plan narednih nedelja):
Poslednje 2-3 rečenice posveti onome što SLEDI, povezano sa onim što si upravo pročitao iz brojeva. Ovo je najkorisniji deo — reci trkaču na šta da pazi u narednim nedeljama.
- Poveži stanje sa planom: ako oporavak posustaje a sledi najteža nedelja, reci to. Ako obim skače više od 10% ka nedelji koja nosi i tešku sesiju, upozori.
- Deload nedelja NIJE greška u planu i ne komentariši je kao pad forme — to je namerno rasterećenje.
- Ako je kontrolna trka (TIME TRIAL) blizu, reci šta iz dosadašnjih brojeva govori o realnom očekivanju.

GRANICA KOJU NE PRELAZIŠ:
Plan je već napravljen po proverenoj metodologiji (Daniels/Pfitzinger) i računa periodizaciju, taper i rast obima. NE PREPISUJEŠ PLAN. Ne izmišljaj nove treninge, ne menjaj broj ponavljanja, deonice ni ciljne tempove, i ne predlaži zamenu jedne sesije drugom.
Tvoj posao je IZVOĐENJE: kako pristupiti onome što već stoji u planu. Dozvoljeno ti je da kažeš: da lagane dane treba trčati stvarno lagano, da se sesija pomeri za dan kad je oporavak loš, da se prekine trening ako tempo padne, da se obrati pažnja na hidrataciju po vrućini, ili da se javi treneru/lekaru kod uporne boli.
Ako iskreno misliš da je nešto u planu prezahtevno za trenutno stanje trkača, reci TO kao zapažanje ("sledeća nedelja je 12% skok, uz HRV koji pada — vredi razmisliti o ponavljanju ove nedelje"), a ne kao novi plan.

NIKAD ne izmišljaj tačne buduće tempove ni VDOT projekcije sa lažnom preciznošću. Ako trend nije jasan ili ima premalo podataka, reci to pošteno. Ako trkač napreduje, reci to jasno — ne traži manu po svaku cenu. Bez praznih motivacionih fraza; svaka rečenica prati iz brojeva.`;

  let msg = `${zoneBlok ? `ZONE PULSA OVOG TRKAČA: ${zoneBlok}\n\n` : ''}CILJ: VDOT ${trend.cilj} (${goalDesc}). POČETNI VDOT: ${trend.baseline}.\n\nISTORIJA VDOT-a (hronološki):\n`;
  msg += vdot.length ? vdot.map(v => `${v.date}: ${v.vdot}`).join('\n') : '(nema zabeleženih VDOT vrednosti)';
  msg += `\n\nSVI ODRAĐENI TRENINZI (hronološki):\n`;
  msg += treninzi.map(t => {
    let s = `${t.date} [${t.tag}]`;
    if (t.km != null) s += `, ${t.km} km`;
    if (t.tempo != null) s += `, tempo ${fmtPace(t.tempo)}/km`;
    /* GAP i oporavci dolaze samo sa intervals.icu (v. icuSyncTreninzi). Kad
       GAP i tempo idu zajedno, teren nije faktor; kad se razilaze, poređenje
       dva treninga po golom tempu je besmisleno. */
    if (t.gap != null) s += `, GAP ${fmtPace(t.gap)}/km`;
    if (t.repova != null) s += `, ${t.repova} repova`;
    if (t.pauzaPrva != null && t.pauzaZadnja != null)
      s += `, oporavak ${t.pauzaPrva}s→${t.pauzaZadnja}s`;
    if (t.efikasnost != null) s += `, efikasnost ${t.efikasnost}`;
    if (t.opterecenje != null) s += `, opterećenje ${t.opterecenje}`;
    if (t.osecaSe != null) s += `, oseća se ${t.osecaSe}°C`;
    if (t.drift != null) s += `, drift ${t.driftStart}→${t.driftEnd} (${t.drift>=0?'+':''}${t.drift}) na ravnomernom tempu`;
    else if (t.progresivno) s += `, progresivno (tempo namerno menjan — drift se ne računa)`;
    if (t.dekuplovanje != null) s += `, dekuplovanje ${t.dekuplovanje}%`;
    if (t.cadence != null) s += `, kadenca ${t.cadence}`;
    if (t.avgHr != null) s += `, pros. puls ${t.avgHr}`;
    if (t.rpe != null) s += `, RPE ${t.rpe}`;
    if (t.relEffort != null) s += `, effort ${t.relEffort}`;
    return s;
  }).join('\n');
  if (Array.isArray(trend.oporavak) && trend.oporavak.length) {
    msg += `\n\nOPORAVAK PO DANIMA (HRV, puls u miru, san, opterećenje):\n` +
      trend.oporavak.slice(-90).map(o => {
        const d = [];
        if (o.hrv != null) d.push(`HRV ${o.hrv}`);
        if (o.pulsUMiru != null) d.push(`puls u miru ${o.pulsUMiru}`);
        if (o.sanH != null) d.push(`san ${o.sanH}h`);
        if (o.svezina != null) d.push(`svežina ${o.svezina}`);
        return d.length ? `${o.datum}: ${d.join(', ')}` : null;
      }).filter(Boolean).join('\n');
  }
  if (Array.isArray(trend.obim) && trend.obim.length) {
    msg += `\n\nNEDELJNI OBIM (početak nedelje → km):\n` +
      trend.obim.slice(-30).map(o => `${o.od}: ${o.km} km`).join('\n');
  }

  /* Aritmetika je za jezički model najnepouzdaniji deo posla — dobija nalaz,
     ne ulaz za račun. Vidi tempoKaCilju() u aplikaciji. */
  const tn = trend.tempoNapretka;
  if (tn && tn.ostvarenoPoNedelji != null) {
    msg += `\n\nTEMPO NAPRETKA (izračunato, ne procenjuj sam):\n` +
      `- ostvareno: VDOT ${tn.odVdot} → ${tn.doVdot} za ${tn.nedeljaMereno} nedelja = ${tn.ostvarenoPoNedelji} po nedelji\n` +
      `- potrebno do cilja ${tn.cilj}: još ${tn.faliDoCilja} za ${tn.nedeljaDoTrke} nedelja = ${tn.potrebnoPoNedelji} po nedelji\n` +
      `- projekcija na dan trke pri sadašnjem tempu: VDOT ${tn.projekcijaNaTrci}`;
  }

  /* ŠTA DOLAZI. Bez ovoga je analiza sudila samo o prošlosti: mogla je da
     kaže "obim raste prebrzo" ne znajući da sledeće nedelje ide deload, ili
     da propusti da najteža nedelja pada baš kad oporavak posustaje. */
  if (Array.isArray(trend.naredno) && trend.naredno.length) {
    msg += `\n\nPLAN NAREDNIH NEDELJA (već napravljen — komentarišeš izvođenje, ne menjaš ga):\n` +
      trend.naredno.slice(0, 6).map(n => {
        const red = [`N${n.nedelja} (od ${n.od}): ${n.km} km${n.deload ? ' · DELOAD (namerno rasterećenje)' : ''}`];
        if (n.dugo) red.push(`  dugo trčanje: ${n.dugo}`);
        (Array.isArray(n.kvalitetni) ? n.kvalitetni : []).forEach(k => red.push('  ' + String(k).slice(0, 160)));
        return red.join('\n');
      }).join('\n');
    if (trend.doTrke != null && isFinite(trend.doTrke)) {
      msg += `\n\nDO TRKE: ${trend.doTrke} dana.`;
    }
  }

  try {
    const out = await callGemini(sys, msg);
    if (!out.ok) { res.status(out.status).json({ error: out.error, detail: out.detail }); return; }
    res.status(200).json({ text: out.text });
  } catch (e) {
    res.status(500).json({ error: 'Greška na serveru.', detail: String(e).slice(0, 200) });
  }
}
