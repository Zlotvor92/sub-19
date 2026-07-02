/* SUB-19 · Strava OAuth — razmena koda za tokene.
   Čita STRAVA_CLIENT_ID i STRAVA_CLIENT_SECRET iz Vercel Environment Variables. */
export default async function handler(req, res) {
  const code = (req.query && req.query.code) || '';
  if (!code) return res.status(400).json({ message: 'Nedostaje code parametar' });
  const id = process.env.STRAVA_CLIENT_ID;
  const sec = process.env.STRAVA_CLIENT_SECRET;
  if (!id || !sec) return res.status(500).json({ message: 'STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET nisu podešeni u Vercel → Settings → Environment Variables' });
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
