/* /api/analyze.js — LLM analiza treninga (Gemini 3.5 Flash, besplatan nivo).
   NAJMANJA MOGUĆA VERZIJA: prima podatke koje aplikacija VEĆ ima (prosečan
   tempo radnog dela, puls, RPE, belešku) — ne dira Strava kod, ne dodaje
   novo povlačenje podataka.

   OBAVEZNO pre deploy-a, u Vercel Project Settings -> Environment Variables:
   - GEMINI_API_KEY      (https://aistudio.google.com/apikey — besplatan nivo)
   - APP_SHARED_SECRET   (bilo koji string koji ti izmisliš, npr. dugačak random)
   Isti APP_SHARED_SECRET mora biti i u index.html (ANALYZE_SECRET konstanta).
   Ovo NIJE prava bezbednost (tajna je vidljiva u frontend kodu ako neko
   otvori dev tools) — to je prag protiv slučajnog/automatskog pogađanja
   URL-a koji bi ti trošio Gemini kvotu. Prava zaštita bi tražila pravi
   login sistem, što je van okvira "najmanje moguće verzije".

   NAPOMENA O BESPLATNOM NIVOU: Google na besplatnom nivou koristi tekst
   zahteva/odgovora za poboljšanje svojih proizvoda (za razliku od plaćenog
   nivoa). Ako to ne želiš, treba prebaciti na plaćen nivo (i dalje jeftino:
   $0.30/$2.50 po milion tokena za standardni 3.5 Flash poziv). */

const MODEL = 'gemini-3.5-flash'; /* stabilan (ne "preview"), besplatan nivo dostupan avgust 2026 */
const FALLBACK_MODEL = 'gemini-3.5-flash-lite'; /* ISTA (3.x) generacija kao primarni — gemini-2.5-flash je testom potvrđen NEDOSTUPAN novim nalozima (404 "no longer available to new users", nije bilo vidljivo iz cenovnika), pa rezerva mora biti iz generacije koja je stvarno otvorena za nov nalog. Odvojen (lakši) model = odvojen kapacitet od punog 3.5 Flash. */
const urlFor = m => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
const sleep = ms => new Promise(res => setTimeout(res, ms));

/* Jedan pokušaj poziva ka datom modelu. Vraća {ok:true,text} ili
   {ok:false,status,error,detail,retryable} — retryable=true samo za 503
   (Google eksplicitno: "Spikes in demand are usually temporary").
   thinkingLevel:'medium' — potvrđeno kao PODRAZUMEVANA vrednost baš za
   gemini-3.5-flash (Google-ova "What's new in Gemini 3.5 Flash" stranica:
   "Available values: minimal, low, medium (default), and high"). Besplatan
   nivo = nema razloga za štednju na tome, a medium daje realnije rezonovanje
   od low bez skoka na najsporiji/najskuplji (za nas nebitan trošak) high. */
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
    return { ok: false, status: r.status===503?502:502, error: 'LLM poziv nije uspeo.', detail: errText.slice(0, 300), retryable: r.status===503 };
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
    return { ok: false, status: 502, error: 'LLM je vratio prazan odgovor (finishReason: ' + fr + '). Ako je MAX_TOKENS — treba veći budžet.', retryable: false };
  }
  return { ok: true, text };
}

/* Jedan kratak ponovni pokušaj na ISTOM modelu (Google: "usually temporary"),
   pa PREBACIVANJE na stabilniji model ako i to ne uspe. Ukupno najviše 3
   pokušaja, kratak zastoj — ostaje bezbedno unutar Vercel serverless
   vremenskog limita. */
async function callGemini(systemText, userText) {
  let out = await tryModel(MODEL, systemText, userText);
  if (out.ok) return out;

  if (out.retryable) {
    await sleep(900);
    out = await tryModel(MODEL, systemText, userText);
    if (out.ok) return out;
  }

  if (out.retryable) {
    const fb = await tryModel(FALLBACK_MODEL, systemText, userText);
    return fb; // ok ili ne — fallback-ov rezultat je poslednja reč (najnoviji podatak)
  }

  return out; // nije bilo retryable (npr. prazan odgovor) — fallback ne bi pomogao
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Samo POST.' });
    return;
  }

  const secretRaw = req.headers['x-app-secret'];
  const expected = process.env.APP_SHARED_SECRET;
  if (!expected || secretRaw !== expected) {
    res.status(401).json({ error: 'Neautorizovano.' });
    return;
  }

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
  const goalDesc = (typeof goalCtx === 'string' && goalCtx.trim()) ? goalCtx.trim() : '5K oko 19:30 (cilj koji i na lošiji dan iznosi sub-20)';

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

${isEasy ? `OVO JE LAGANO/DUGO TRČANJE (E-zona po Danielsu). Cilj lakog trčanja je nizak, stabilan puls i oporavak — NE brzina. Analiziraj ovako:
- DA LI JE LAKO STVARNO BILO LAKO: na lakom trčanju puls treba da bude nizak i stabilan. Ako puls kroz kilometre RASTE značajno (kardiovaskularni drift na laganom tempu) ili je generalno visok, trkač je trčao PREBRZO — lako trčanje nije bilo lako. To je česta greška. Reci to jasno ako vidiš.
- KADENCA: na laganom tempu kadenca često padne (šljapkanje). Ako je kadenca ispod 85, predloži da je podigne ka 85-90 čak i pri sporom trčanju — kraći, brži koraci štede zglobove. Ako je 85+, pohvali.
- DRIFT PO KILOMETRIMA: reci konkretno kako se puls kretao (npr. "prvi km 140, poslednji 155, porast od 15" ). Mali drift (par otkucaja) je normalan. Veliki drift na laganom tempu = trčao prebrzo ili loš oporavak/hidratacija. AKO PODACI PO KILOMETRU NISU DATI (samo prosek cele sesije): ne izmišljaj brojeve za pojedinačne kilometre — komentariši samo prosečan puls naspram cilja niskog pulsa, i reci da bi drift-po-km bio koristan da postoji.` : `OVO JE KVALITETNO TRČANJE (intervali/tempo).
- Uporedi ostvaren tempo radnog dela sa planiranim — reci da li je brže/sporije/tačno, i za koliko sekundi po km.
- AKO SU DATI PODACI PO KRUGU (puls, kadenca, snaga po radnom intervalu): analiziraj da li puls RASTE kroz intervale pri istom tempu — kardiovaskularni drift, znači izdržljivost na tom tempu treba graditi (ne brzina). Reci konkretno koliko je porastao. Kadenca 88-95 je zdravo, ispod 85 predugačak korak. Snaga (watts) koja opada uz isti tempo = zamor. Stabilan puls = dobra izdržljivost, pohvali.
- AKO UMESTO PO KRUGU DOBIJEŠ PODATKE PO KILOMETRU (sat je merio drugačije od strukture treninga): koristi ih isto — gledaj da li puls raste kroz kilometre radnog dela (drift) i kakva je kadenca. Napomeni da su podaci po kilometru, ne po intervalu, pa je granica između rada i odmora manje oštra.
- AKO NEMAŠ NI PODATKE PO KRUGU NI PO KILOMETRU (dat je samo prosek cele sesije): NIKAD ne izmišljaj konkretne brojeve za pojedinačne intervale/krugove (npr. "u prvom intervalu puls je bio X, u drugom Y") — tih podataka nemaš, pa bi to bila izmišljena, netačna informacija. Komentariši SAMO ono što prosek stvarno pokazuje (ukupan tempo naspram plana, prosečan puls, RPE, beleška). Ako bi drift/napredak kroz intervale bio koristan podatak, reci da nedostaje umesto da ga pretpostaviš.`}

Zajedničko pravilo:
- NIKAD ne izmišljaj konkretne buduće tempove, VDOT brojeve ili preporuke za sledeći trening — to računa aplikacija. Tumačiš OVAJ trening.
- Ako neki podatak izgleda beznačajan (par stotina metara viška od zaokruživanja), ne troši rečenice na njega.
- Bez generičkih motivacionih fraza. Svaka rečenica mora da prati iz brojeva.`;

  const fmtPace = s => Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  let lapsBlock = '';
  if (Array.isArray(entered.laps) && entered.laps.length) {
    lapsBlock = '\n\nPODACI PO RADNOM KRUGU (najvažnije za analizu):\n' +
      entered.laps.map(L =>
        `Interval ${L.i}${L.distM?` (${L.distM}m)`:''}: tempo ${fmtPace(L.paceSec)}/km` +
        (L.avgHr!=null?`, puls ${L.avgHr}`:'') +
        (L.cadence!=null?`, kadenca ${L.cadence}`:'') +
        (L.watts!=null?`, snaga ${L.watts}W`:'')
      ).join('\n');
  }
  if (Array.isArray(entered.perKm) && entered.perKm.length) {
    lapsBlock += '\n\nPODACI PO KILOMETRU (za drift i kadencu kroz celo trčanje):\n' +
      entered.perKm.map(K =>
        `km ${K.km}: tempo ${K.paceSec!=null?fmtPace(K.paceSec):'—'}/km` +
        (K.hr!=null?`, puls ${K.hr}`:'') +
        (K.cadence!=null?`, kadenca ${K.cadence}`:'')
      ).join('\n');
  }

  const userMsg = `PLAN SESIJE: ${cap(session.desc, 500)}
Planiran tempo radnog dela: ${cap(session.planPace, 20)}
Ciljna distanca radnog dela: ${session.q ?? '—'} km

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
  const treninzi = Array.isArray(trend.treninzi) ? trend.treninzi : [];
  const vdot = Array.isArray(trend.vdot) ? trend.vdot : [];

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
