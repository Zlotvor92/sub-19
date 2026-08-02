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
  try {
    const r = await fetch(url.replace(/\/+$/, '') + '/auth/v1/user', {
      headers: { apikey: anon, Authorization: 'Bearer ' + m[1] }
    });
    if (!r.ok) return { ok: false, status: 401, error: 'Prijava je istekla — prijavi se ponovo.' };
    const u = await r.json();
    if (!u || !u.id) return { ok: false, status: 401, error: 'Neispravna prijava.' };
    return { ok: true, userId: u.id, email: u.email || null, token: m[1] };
  } catch (e) {
    return { ok: false, status: 503, error: 'Provera prijave trenutno nije moguća.' };
  }
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
async function tryModel(model, systemText, userText) {
  const r = await fetch(urlFor(model), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ parts: [{ text: userText }] }],
      generationConfig: {
        maxOutputTokens: 8000,
        thinkingConfig: { thinkingLevel: 'medium' }
      }
    })
  });

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
  let out = await tryModel(MODEL, systemText, userText);
  if (out.ok) return out;

  if (out.sameRetry) {
    await sleep(900);
    out = await tryModel(MODEL, systemText, userText);
    if (out.ok) return out;
  }

  if (out.tryFallback) {
    const fb = await tryModel(FALLBACK_MODEL, systemText, userText);
    return fb; // ok ili ne — fallback-ov rezultat je poslednja reč (najnoviji podatak)
  }

  return out; // ni 503 ni 429 — fallback ne bi pomogao (npr. prazan odgovor)
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

  /* Dnevni limit poziva po korisniku — Google prijava je otvorena svima,
     bez ovoga bi skripta mogla da isprazni Gemini kvotu. Atomsko (Postgres
     funkcija, ne "procitaj pa upisi") da paralelni zahtevi ne zaobidju limit.
     30/dan je dovoljno velikodusno za stvarnu upotrebu, premalo za automatsko
     iscrpljivanje. */
  const DAILY_LIMIT = 30;
  try {
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
      if (errBody.includes('DAILY_LIMIT_EXCEEDED')) {
        res.status(429).json({ error: 'Dnevni limit AI analiza (' + DAILY_LIMIT + ') je iskorišćen. Pokušaj ponovo sutra.' });
        return;
      }
      // Funkcija/tabela možda još nije podešena u Supabase-u — ne blokiramo
      // korisnika zbog toga, samo nastavljamo bez brojanja za ovaj poziv.
    }
  } catch (e) { /* isto — mrezni problem ovde ne sme da obori celu analizu */ }

  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({ error: 'GEMINI_API_KEY nije podešen na serveru.' });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: 'Neispravan JSON.' });
    return;
  }

  const { session, entered, trend, goalCtx } = body || {};
  /* goalCtx ranije bez ikakvog ogranicenja -> direktno u systemInstruction.
     Neograniceno = i prompt injection prostor i nacin da se nadmasi tokenski
     budzet. 200 znakova je vise nego dovoljno za "5K oko 19:30" stil opisa. */
  const goalDesc = (typeof goalCtx === 'string' && goalCtx.trim()) ? goalCtx.trim().slice(0, 200) : '5K oko 19:30 (cilj koji i na lošiji dan iznosi sub-20)';

  // TREND ANALIZA — poseban tip zahteva (svi treninzi od početka plana)
  if (trend) {
    return handleTrend(trend, res, goalDesc);
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

KAKO SE ČITA PULS — pročitaj ovo PRE nego što doneseš bilo kakav zaključak o driftu:
1. DRIFT SE MERI SAMO NA ISTOM TEMPU. Poređenje prvog i poslednjeg kilometra ima smisla JEDINO ako su trčani približno istim tempom (razlika manja od ~10 s/km). Ako je poslednji kilometar BRŽI, veći puls je očekivan i to NIJE drift — to je posledica bržeg trčanja. Nikad ne nazivaj to driftom.
2. PRVI 1–2 KILOMETRA NISU MERILO. Puls kasni za naporom nekoliko minuta (kardijalna inercija) i na početku je uvek nizak, pa poređenje "prvi km naspram poslednjeg" preuveličava svaki porast. Ako imaš više kilometara na sličnom tempu, poredi njih međusobno.
3. AKO JE TRČANJE PROGRESIVNO (tempo namerno pada kroz trening — vidi plan sesije i opis sa Strave): rast pulsa je CILJ treninga, a ne greška. Tada oceni da li je trkač POGODIO ciljne tempove po blokovima i da li je poslednji blok uspeo da odradi, a ne da li je puls porastao.
4. USPON DIŽE PULS PRI ISTOM TEMPU. Gde je uz kilometar naveden uspon, uračunaj ga pre nego što porast pripišeš zamoru.
5. NE PROGLAŠAVAJ PULS "VISOKIM" ILI "NISKIM" u apsolutnom smislu — ne znaš maksimalni puls ovog trkača. Govori o PROMENI kroz trening i o odnosu prema tempu, ne o samoj brojci.

ŠTA MORAŠ DA UZMEŠ U OBZIR PRE ZAKLJUČKA:
- Šta je sesija TREBALO da bude (plan) i šta je trkač SAM napisao na Stravi da radi tog dana. Ako se to dvoje razlikuje, sudi po onome što je trkač NAMERAVAO, a razliku od plana pomeni jednom rečenicom.
- Zaustavljanja (semafor, česma): tempo je već računat iz vremena u pokretu, pa ih NE tumači kao usporavanje.
- RPE i belešku trkača — ako kaže da je bio bolestan, umoran ili da je bila vrućina, to menja tumačenje svih brojeva.
- Kadencu, i da li se držala kroz ceo trening ili je pala pri kraju (pad = gubitak forme koraka od zamora).

Zajedničko pravilo:
- NIKAD ne izmišljaj konkretne buduće tempove, VDOT brojeve ili preporuke za sledeći trening — to računa aplikacija. Tumačiš OVAJ trening.
- Ako neki podatak izgleda beznačajan (par stotina metara viška od zaokruživanja), ne troši rečenice na njega.
- AKO JE TRENING ODRAĐEN KAKO TREBA, RECI TO. Ne traži manu po svaku cenu — lažna zamerka je gora od kratke pohvale.
- Bez generičkih motivacionih fraza. Svaka rečenica mora da prati iz brojeva.`;

  const fmtPace = s => Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  let lapsBlock = '';
  const MAX_ITEMS = 50; /* i najduzi maraton ima ~42 km-splita; 50 je siguran plafon */
  if (Array.isArray(entered.laps) && entered.laps.length) {
    lapsBlock = '\n\nPODACI PO RADNOM KRUGU (najvažnije za analizu):\n' +
      entered.laps.slice(0, MAX_ITEMS).map(L =>
        `Interval ${L.i}${L.distM?` (${L.distM}m)`:''}: tempo ${fmtPace(L.paceSec)}/km` +
        (L.avgHr!=null?`, puls ${L.avgHr}`:'') +
        (L.cadence!=null?`, kadenca ${L.cadence}`:'') +
        (L.watts!=null?`, snaga ${L.watts}W`:'')
      ).join('\n');
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
        (K.elevM?`, ${K.elevM>0?'uspon':'spust'} ${Math.abs(K.elevM)} m`:'') +
        (K.stopSec?`, stajanje ${K.stopSec} s`:'')
      ).join('\n');
  }

  const svojOpis = [session.stravaName, session.stravaDesc].filter(x => typeof x === 'string' && x.trim()).join(' — ');
  const userMsg = `PLAN SESIJE: ${cap(session.desc, 500)}
Tip sesije po planu: ${cap(session.kind, 40) || '—'}
Planiran tempo radnog dela: ${cap(session.planPace, 20)}
Ciljna distanca radnog dela: ${session.q ?? '—'} km
${svojOpis ? `ŠTA JE TRKAČ SAM UPISAO NA STRAVI ZA OVAJ TRENING (njegova stvarna namera tog dana): ${cap(svojOpis, 500)}` : 'Trkač nije upisao svoj opis na Stravi.'}

OSTVARENO:
Tempo radnog dela (prosek): ${cap(entered.workPace, 20) || 'nije unet'}
Ukupna distanca: ${entered.km ?? '—'} km, vreme: ${cap(entered.time, 20) ?? '—'}
Prosečan puls (cela sesija): ${entered.hr ?? 'nije unet'}
RPE (1-10): ${entered.rpe ?? 'nije unet'}
Beleška trkača: ${cap(entered.note, 400) || '(bez beleške)'}${lapsBlock}`;

  try {
    const out = await callGemini(sys, userMsg);
    if (!out.ok) { res.status(out.status).json({ error: out.error, detail: out.detail }); return; }
    res.status(200).json({ text: out.text });
  } catch (e) {
    res.status(500).json({ error: 'Greška na serveru.', detail: String(e).slice(0, 200) });
  }
}

/* ===== TREND ANALIZA — svi treninzi kroz vreme ===== */
async function handleTrend(trend, res, goalDesc) {
  const fmtPace = s => Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  const MAX_HIST = 150; /* velikodusno za punu istoriju više ciklusa plana */
  const treninzi = (Array.isArray(trend.treninzi) ? trend.treninzi : []).slice(0, MAX_HIST);
  const vdot = (Array.isArray(trend.vdot) ? trend.vdot : []).slice(0, MAX_HIST);

  const sys = `Ti si trkački trener koji analizira TREND FORME kroz ceo trenažni period za trkača koji cilja ${goalDesc} (Jack Daniels VDOT). Dobijaš sažetak svih treninga i istoriju VDOT-a.

Piši na srpskom, jednostavnim tačnim rečenicama. 6-9 rečenica. Fokus je na TRENDU, ne na pojedinačnom treningu.

Analiziraj:
- DA LI SE DRIFT PULSA SMANJUJE kroz vreme (za kvalitetne treninge sa driftom): ako je pre 3 nedelje drift bio +15 a sad +8 pri istom tempu, to je JAK znak da izdržljivost raste — kaži to konkretno sa brojevima. Ako drift raste ili stoji, to je znak da napredak stagnira.
- DA LI VDOT RASTE ka cilju: uporedi prve i poslednje vrednosti, reci koliko je porastao i da li tempo napretka vodi ka cilju.
- KADENCA kroz vreme: da li se popravlja ili pada.
- DA LI SU LAKA TRČANJA ostajala lagana (nizak drift) ili je trkač konstantno preforsirao.
- Konkretna, iskrena procena: ide li ka cilju (${goalDesc}) ili ne, i šta je najveći ograničavajući faktor sada.

NIKAD ne izmišljaj tačne buduće tempove ni VDOT projekcije sa lažnom preciznošću. Ako trend nije jasan ili ima premalo podataka, reci to pošteno. Bez praznih motivacionih fraza — svaka rečenica prati iz brojeva.`;

  let msg = `CILJ: VDOT ${trend.cilj} (${goalDesc}). POČETNI VDOT: ${trend.baseline}.\n\nISTORIJA VDOT-a (hronološki):\n`;
  msg += vdot.length ? vdot.map(v => `${v.date}: ${v.vdot}`).join('\n') : '(nema zabeleženih VDOT vrednosti)';
  msg += `\n\nSVI ODRAĐENI TRENINZI (hronološki):\n`;
  msg += treninzi.map(t => {
    let s = `${t.date} [${t.tag}]`;
    if (t.tempo != null) s += `, tempo ${fmtPace(t.tempo)}/km`;
    if (t.drift != null) s += `, drift ${t.driftStart}→${t.driftEnd} (${t.drift>=0?'+':''}${t.drift})`;
    if (t.cadence != null) s += `, kadenca ${t.cadence}`;
    if (t.avgHr != null) s += `, pros. puls ${t.avgHr}`;
    return s;
  }).join('\n');

  try {
    const out = await callGemini(sys, msg);
    if (!out.ok) { res.status(out.status).json({ error: out.error, detail: out.detail }); return; }
    res.status(200).json({ text: out.text });
  } catch (e) {
    res.status(500).json({ error: 'Greška na serveru.', detail: String(e).slice(0, 200) });
  }
}
