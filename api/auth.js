/* Zajednicka provera Supabase sesije za nase /api putanje.

   Zasto ovako, a ne lokalna provera potpisa: pitamo Supabase direktno
   (`/auth/v1/user`). Tako nam NE treba JWT tajna u Vercel promenljivama —
   jedna tajna manje za cuvanje — i radi bez izmena ako Supabase predje na
   asimetricne potpise. Cena je jedan HTTP krug, sto je zanemarljivo pored
   poziva ka Gemini-ju ili Stravi.

   Vraca { ok:true, userId, email } ili { ok:false, status, error }. */
export async function requireUser(req) {
  const url  = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { ok: false, status: 500,
      error: 'SUPABASE_URL / SUPABASE_ANON_KEY nisu podešeni u Vercel → Settings → Environment Variables.' };
  }

  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  if (!m) return { ok: false, status: 401, error: 'Nedostaje prijava.' };
  const token = m[1];

  try {
    const r = await fetch(url.replace(/\/+$/, '') + '/auth/v1/user', {
      headers: { apikey: anon, Authorization: 'Bearer ' + token }
    });
    if (!r.ok) return { ok: false, status: 401, error: 'Prijava je istekla — prijavi se ponovo.' };
    const u = await r.json();
    if (!u || !u.id) return { ok: false, status: 401, error: 'Neispravna prijava.' };
    return { ok: true, userId: u.id, email: u.email || null };
  } catch (e) {
    /* Supabase nedostupan — NE propustamo zahtev. */
    return { ok: false, status: 503, error: 'Provera prijave trenutno nije moguća.' };
  }
}
