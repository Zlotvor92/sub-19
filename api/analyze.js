/* /api/analyze.js — LLM analiza jednog treninga (Claude Haiku 4.5).
   NAJMANJA MOGUĆA VERZIJA: prima podatke koje aplikacija VEĆ ima (prosečan
   tempo radnog dela, puls, RPE, belešku) — ne dira Strava kod, ne dodaje
   novo povlačenje podataka. Ako se pokaže korisno, sledeći korak je da sync
   počne da čuva i podatke PO KRUGU (puls/kadenca po intervalu), da analiza
   dostigne dubinu kakva je moguća direktnim čitanjem Strava lapova.

   OBAVEZNO pre deploy-a, u Vercel Project Settings -> Environment Variables:
   - ANTHROPIC_API_KEY   (tvoj Anthropic API ključ, https://console.anthropic.com)
   - APP_SHARED_SECRET   (bilo koji string koji ti izmisliš, npr. dugačak random)
   Isti APP_SHARED_SECRET mora biti i u index.html (ANALYZE_SECRET konstanta).
   Ovo NIJE prava bezbednost (tajna je vidljiva u frontend kodu ako neko
   otvori dev tools) — to je prag protiv slučajnog/automatskog pogađanja
   URL-a koji bi ti trošio Anthropic kvotu. Prava zaštita bi tražila pravi
   login sistem, što je van okvira "najmanje moguće verzije". */

const MODEL = 'claude-sonnet-5'; /* Sonnet 5 — noviji model. Uvodna cena $2/$10 do 31.08.2026, potom $3/$15. */

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

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY nije podešen na serveru.' });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: 'Neispravan JSON.' });
    return;
  }

  const { session, entered, trend } = body || {};

  // TREND ANALIZA — poseban tip zahteva (svi treninzi od početka plana)
  if (trend) {
    return handleTrend(trend, res);
  }

  if (!session || !entered) {
    res.status(400).json({ error: 'Nedostaju podaci o sesiji (session/entered).' });
    return;
  }

  // Osnovna sanitizacija dužine — sprečava slučajno ogroman payload da ne pojede kvotu.
  const cap = (s, n) => (typeof s === 'string' ? s.slice(0, n) : s);

  const isEasy = session.tag === 'lako' || session.tag === 'lr';
  const sys = `Ti si trkački trener koji analizira JEDAN konkretan trening za trkača koji se sprema za 5K ispod 19:00 (Jack Daniels VDOT metodologija). Dobijaš plan sesije i šta je ostvareno.

Piši na srpskom jeziku, JEDNOSTAVNIM i tačnim rečenicama. Proveri gramatiku — piši kratke, jasne rečenice umesto dugačkih. Ne koristi reči za koje nisi siguran. 4-7 rečenica, direktno.

${isEasy ? `OVO JE LAGANO/DUGO TRČANJE (E-zona po Danielsu). Cilj lakog trčanja je nizak, stabilan puls i oporavak — NE brzina. Analiziraj ovako:
- DA LI JE LAKO STVARNO BILO LAKO: na lakom trčanju puls treba da bude nizak i stabilan. Ako puls kroz kilometre RASTE značajno (kardiovaskularni drift na laganom tempu) ili je generalno visok, trkač je trčao PREBRZO — lako trčanje nije bilo lako. To je česta greška. Reci to jasno ako vidiš.
- KADENCA: na laganom tempu kadenca često padne (šljapkanje). Ako je kadenca ispod 85, predloži da je podigne ka 85-90 čak i pri sporom trčanju — kraći, brži koraci štede zglobove. Ako je 85+, pohvali.
- DRIFT PO KILOMETRIMA: reci konkretno kako se puls kretao (npr. "prvi km 140, poslednji 155, porast od 15" ). Mali drift (par otkucaja) je normalan. Veliki drift na laganom tempu = trčao prebrzo ili loš oporavak/hidratacija.` : `OVO JE KVALITETNO TRČANJE (intervali/tempo).
- Uporedi ostvaren tempo radnog dela sa planiranim — reci da li je brže/sporije/tačno, i za koliko sekundi po km.
- AKO SU DATI PODACI PO KRUGU (puls, kadenca, snaga po radnom intervalu): analiziraj da li puls RASTE kroz intervale pri istom tempu — kardiovaskularni drift, znači izdržljivost na tom tempu treba graditi (ne brzina). Reci konkretno koliko je porastao. Kadenca 88-95 je zdravo, ispod 85 predugačak korak. Snaga (watts) koja opada uz isti tempo = zamor. Stabilan puls = dobra izdržljivost, pohvali.
- AKO UMESTO PO KRUGU DOBIJEŠ PODATKE PO KILOMETRU (sat je merio drugačije od strukture treninga): koristi ih isto — gledaj da li puls raste kroz kilometre radnog dela (drift) i kakva je kadenca. Napomeni da su podaci po kilometru, ne po intervalu, pa je granica između rada i odmora manje oštra.`}

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
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000, /* Sonnet 5: adaptive thinking uvek uključen i troši iz budžeta; 600 je bilo premalo (thinking pojede sve, ostane 0 za tekst -> prazan odgovor). Plaća se stvarno korišćeno, ne max. */
        system: sys,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    if (!r.ok) {
      const errText = await r.text();
      res.status(502).json({ error: 'LLM poziv nije uspeo.', detail: errText.slice(0, 300) });
      return;
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    if (!text) {
      const sr = data.stop_reason || 'nepoznato';
      res.status(502).json({ error: 'LLM je vratio prazan odgovor (stop_reason: '+sr+'). Ako je max_tokens — treba veći budžet.' });
      return;
    }

    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: 'Greška na serveru.', detail: String(e).slice(0, 200) });
  }
}

/* ===== TREND ANALIZA — svi treninzi kroz vreme ===== */
async function handleTrend(trend, res) {
  const fmtPace = s => Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  const treninzi = Array.isArray(trend.treninzi) ? trend.treninzi : [];
  const vdot = Array.isArray(trend.vdot) ? trend.vdot : [];

  const sys = `Ti si trkački trener koji analizira TREND FORME kroz ceo trenažni period za trkača koji cilja 5K ispod 19:00 (Jack Daniels VDOT). Dobijaš sažetak svih treninga i istoriju VDOT-a.

Piši na srpskom, jednostavnim tačnim rečenicama. 6-9 rečenica. Fokus je na TRENDU, ne na pojedinačnom treningu.

Analiziraj:
- DA LI SE DRIFT PULSA SMANJUJE kroz vreme (za kvalitetne treninge sa driftom): ako je pre 3 nedelje drift bio +15 a sad +8 pri istom tempu, to je JAK znak da izdržljivost raste — kaži to konkretno sa brojevima. Ako drift raste ili stoji, to je znak da napredak stagnira.
- DA LI VDOT RASTE ka cilju: uporedi prve i poslednje vrednosti, reci koliko je porastao i da li tempo napretka vodi ka cilju.
- KADENCA kroz vreme: da li se popravlja ili pada.
- DA LI SU LAKA TRČANJA ostajala lagana (nizak drift) ili je trkač konstantno preforsirao.
- Konkretna, iskrena procena: ide li ka sub-19 ili ne, i šta je najveći ograničavajući faktor sada.

NIKAD ne izmišljaj tačne buduće tempove ni VDOT projekcije sa lažnom preciznošću. Ako trend nije jasan ili ima premalo podataka, reci to pošteno. Bez praznih motivacionih fraza — svaka rečenica prati iz brojeva.`;

  let msg = `CILJ: VDOT ${trend.cilj} (5K ispod 19:00). POČETNI VDOT: ${trend.baseline}.\n\nISTORIJA VDOT-a (hronološki):\n`;
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
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        system: sys,
        messages: [{ role: 'user', content: msg }]
      })
    });
    if (!r.ok) {
      const errText = await r.text();
      res.status(502).json({ error: 'LLM poziv nije uspeo.', detail: errText.slice(0, 300) });
      return;
    }
    const data = await r.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (!text) {
      const sr = data.stop_reason || 'nepoznato';
      res.status(502).json({ error: 'LLM je vratio prazan odgovor (stop_reason: '+sr+').' });
      return;
    }
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: 'Greška na serveru.', detail: String(e).slice(0, 200) });
  }
}
