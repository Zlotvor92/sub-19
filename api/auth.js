/* SUB-19 · Strava OAuth — razmena koda za tokene.
   Čita STRAVA_CLIENT_ID i STRAVA_CLIENT_SECRET iz Vercel Environment Variables.

   IZMENE (bezbednost):

   1) Prihvata se samo GET (klijent zove `fetch('/api/auth?code=…')`).

   2) Osnovna provera oblika koda — Strava vraća heksadecimalni niz. Time se
      odbacuje očigledno smeće pre nego što potroši poziv ka Stravi.

   NAPOMENA O CSRF-u: zaštita od podmetnutog koda (napadač navede žrtvu na
   `…/?code=NJEGOV_KOD`, pa se žrtvina aplikacija poveže na NAPADAČEV Strava
   nalog) rešava se `state` parametrom — a to je posao KLIJENTA, ne ove
   putanje: klijent pravi nasumičan `state`, čuva ga lokalno i proverava po
   povratku. Server ga ne može proveriti bez čuvanja stanja. Ta izmena je
   urađena u index.html (stravaConnect / handleOAuthReturn). */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Samo GET.' });
  }

  const code = (req.query && req.query.code) || '';
  if (!code) return res.status(400).json({ message: 'Nedostaje code parametar' });
  if (typeof code !== 'string' || code.length > 128 || !/^[a-f0-9]+$/i.test(code)) {
    return res.status(400).json({ message: 'Neispravan oblik koda.' });
  }

  const id = process.env.STRAVA_CLIENT_ID;
  const sec = process.env.STRAVA_CLIENT_SECRET;
  if (!id || !sec) {
    return res.status(500).json({ message: 'STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET nisu podešeni u Vercel → Settings → Environment Variables' });
  }

  try {
    const r = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: id, client_secret: sec, code, grant_type: 'authorization_code' })
    });
    const j = await r.json();
    return res.status(r.ok ? 200 : r.status).json(j);
  } catch (e) {
    return res.status(502).json({ message: 'Strava nedostupna: ' + e.message });
  }
}
