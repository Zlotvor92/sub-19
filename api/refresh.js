/* SUB-19 · Strava OAuth — osvežavanje isteklog access tokena. */
export default async function handler(req, res) {
  let rt = '';
  try { rt = (req.body && (typeof req.body === 'string' ? JSON.parse(req.body) : req.body).refresh_token) || ''; } catch (e) {}
  if (!rt && req.query) rt = req.query.refresh_token || '';
  if (!rt) return res.status(400).json({ message: 'Nedostaje refresh_token' });
  const id = process.env.STRAVA_CLIENT_ID;
  const sec = process.env.STRAVA_CLIENT_SECRET;
  if (!id || !sec) return res.status(500).json({ message: 'STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET nisu podešeni u Vercel → Settings → Environment Variables' });
  try {
    const r = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: id, client_secret: sec, refresh_token: rt, grant_type: 'refresh_token' })
    });
    const j = await r.json();
    return res.status(r.ok ? 200 : r.status).json(j);
  } catch (e) {
    return res.status(502).json({ message: 'Strava nedostupna: ' + e.message });
  }
}
