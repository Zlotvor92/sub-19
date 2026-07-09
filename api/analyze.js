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

const MODEL = 'claude-haiku-4-5-20251001';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Samo POST.' });
    return;
  }

  const secret = req.headers['x-app-secret'];
  if (!process.env.APP_SHARED_SECRET || secret !== process.env.APP_SHARED_SECRET) {
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

Piši na srpskom, 4-6 rečenica, direktno, bez fraza tipa "odličan posao" bez pokrića u brojevima.

Strogo se drži ovoga:
- Uporedi ostvaren tempo radnog dela sa planiranim — reci da li je brže/sporije/tačno, i za koliko sekundi po km.
- Ako imaš prosečan puls i RPE, koristi ih kao kontekst napora (npr. "puls/RPE deluju visoko za taj tempo" ili obrnuto) — ali NAGLASI da je to prosek cele sesije, ne po krugu, pa ne možeš proceniti da li je napor rastao ili opadao tokom treninga.
- NIKAD ne izmišljaj konkretne buduće tempove, VDOT brojeve ili preporuke za sledeći trening — to računa aplikacija na osnovu formule, ne ti. Tvoj posao je da protumačiš OVAJ trening, ne da planiraš sledeći.
- Ako podataka nema dovoljno za neku ocenu, reci to eksplicitno umesto da nagađaš ili uopštavaš.
- Bez generičkih motivacionih fraza koje ne prate iz brojeva.`;

  const userMsg = `PLAN SESIJE: ${cap(session.desc, 500)}
Planiran tempo radnog dela: ${cap(session.planPace, 20)}
Ciljna distanca radnog dela: ${session.q ?? '—'} km

OSTVARENO:
Tempo radnog dela: ${cap(entered.workPace, 20) || 'nije unet'}
Ukupna distanca: ${entered.km ?? '—'} km, vreme: ${cap(entered.time, 20) ?? '—'}
Prosečan puls (cela sesija): ${entered.hr ?? 'nije unet'}
RPE (1-10): ${entered.rpe ?? 'nije unet'}
Beleška trkača: ${cap(entered.note, 400) || '(bez beleške)'}`;

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
        max_tokens: 400,
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
