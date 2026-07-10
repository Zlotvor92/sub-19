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

  const { session, entered } = body || {};
  if (!session || !entered) {
    res.status(400).json({ error: 'Nedostaju podaci o sesiji (session/entered).' });
    return;
  }

  // Osnovna sanitizacija dužine — sprečava slučajno ogroman payload da ne pojede kvotu.
  const cap = (s, n) => (typeof s === 'string' ? s.slice(0, n) : s);

  const sys = `Ti si trkački trener koji analizira JEDAN konkretan trening za trkača koji se sprema za 5K ispod 19:00 (Jack Daniels VDOT metodologija). Dobijaš plan sesije i šta je ostvareno.

Piši na srpskom jeziku, JEDNOSTAVNIM i tačnim rečenicama. Proveri gramatiku — piši kratke, jasne rečenice umesto dugačkih. Ne koristi reči za koje nisi siguran. 4-7 rečenica, direktno.

Strogo se drži ovoga:
- Uporedi ostvaren tempo radnog dela sa planiranim — reci da li je brže/sporije/tačno, i za koliko sekundi po km.
- AKO SU DATI PODACI PO KRUGU (puls, kadenca, snaga po svakom radnom intervalu): ovo je najvažniji deo. Analiziraj da li puls RASTE kroz intervale pri istom tempu — to je kardiovaskularni drift i znači da izdržljivost na tom tempu treba graditi (ne brzina). Reci konkretno koliko je puls porastao (npr. "prvi interval 162, poslednji 174"). Komentariši kadencu: 88-95 je zdravo za taj tempo, ispod 85 bi značilo predugačak korak. Ako je snaga (watts) data i opada kroz intervale uz isti tempo, to je dodatni znak zamora. Ako je puls stabilan kroz intervale — to je znak dobre izdržljivosti, pohvali to konkretno.
- AKO NEMA podataka po krugu, koristi prosečan puls i RPE kao grubu ocenu napora, ali reci da bez podataka po krugu ne možeš proceniti drift.
- NIKAD ne izmišljaj konkretne buduće tempove, VDOT brojeve ili preporuke za sledeći trening — to računa aplikacija. Tvoj posao je da protumačiš OVAJ trening.
- Ako neki podatak izgleda beznačajan (npr. par stotina metara viška od zaokruživanja WU/CD), ne troši rečenice na njega.
- Bez generičkih motivacionih fraza. Svaka rečenica mora da prati iz brojeva.`;

  let lapsBlock = '';
  if (Array.isArray(entered.laps) && entered.laps.length) {
    const fmtPace = s => Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
    lapsBlock = '\n\nPODACI PO RADNOM KRUGU (najvažnije za analizu):\n' +
      entered.laps.map(L =>
        `Interval ${L.i}: tempo ${fmtPace(L.paceSec)}/km` +
        (L.avgHr!=null?`, puls ${L.avgHr}`:'') +
        (L.cadence!=null?`, kadenca ${L.cadence}`:'') +
        (L.watts!=null?`, snaga ${L.watts}W`:'')
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
        max_tokens: 600,
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
      res.status(502).json({ error: 'LLM je vratio prazan odgovor.' });
      return;
    }

    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: 'Greška na serveru.', detail: String(e).slice(0, 200) });
  }
}
