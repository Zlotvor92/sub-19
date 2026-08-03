/* /api/broadcast.js — jednokratno obaveštenje svim prijavljenim korisnicima.

   ZAŠTO POSTOJI: uputstvo je stranica (/uputstvo.html), a ovo je samo kratak
   mejl koji na nju vodi. Namerno se NE šalje ceo tekst uputstva mejlom —
   poslat mejl se više ne može ispraviti, a stranica se popravlja u minutu.

   ZAŠTITA: isti CRON_SECRET kao /api/daily-report. Bez njega bi ovo bio
   otvoren način da bilo ko pošalje mejl svim korisnicima sa našeg domena.

   PRIVATNOST: svaki mejl se šalje POSEBNO. Da su svi u jednom `to` polju,
   svaki korisnik bi video adrese svih ostalih.

   SUV TEST: bez `posalji: true` samo prebroji primaoce i vrati primer mejla,
   ne šalje ništa. Uvek prvo tako.

   Vercel Environment Variables (sve već postoje zbog daily-report):
   CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
   REPORT_FROM */

function proveriTajnu(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const h = req.headers.authorization || req.headers.Authorization || '';
  const want = 'Bearer ' + secret;
  /* poređenje konstantnog trajanja — isto kao u daily-report */
  if (h.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

/* DRUGI PUT UNUTRA — prijavljen vlasnik aplikacije, da slanje može i sa
   telefona, bez terminala i bez ikakvog tajnog ključa u pregledaču.
   Propušta SAMO nalog čija se adresa poklapa sa ADMIN_EMAIL (ili REPORT_TO).
   Adresa se čita sa Supabase servera iz tokena — ne iz onoga što pregledač
   tvrdi da jeste. */
async function proveriVlasnika(req) {
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
    return !!(u && u.email && String(u.email).trim().toLowerCase() === admin);
  } catch (e) { return false; }
}

async function sviKorisnici(url, key) {
  const PER = 200, out = [];
  for (let page = 1; page <= 25; page++) {
    const r = await fetch(url.replace(/\/+$/, '') + '/auth/v1/admin/users?per_page=' + PER + '&page=' + page, {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    if (!r.ok) throw new Error('lista korisnika nije uspela (' + r.status + ')');
    const j = await r.json();
    const users = Array.isArray(j) ? j : (Array.isArray(j.users) ? j.users : []);
    out.push(...users);
    if (users.length < PER) break;
  }
  /* bez adrese nema kome da se pošalje; duplikati se izbacuju */
  const vidjeni = new Set();
  const lista = out
    .map(u => String(u.email || '').trim().toLowerCase())
    .filter(e => e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !vidjeni.has(e) && vidjeni.add(e));
  /* STABILAN REDOSLED je uslov za nastavak u vise poziva (v. `od` ispod):
     bez njega bi drugi poziv mogao da preskoci ili ponovi nekoga, jer Admin
     API ne garantuje isti raspored izmedju poziva. */
  return lista.sort();
}

const BAZA = 'https://sub-19.vercel.app';

function telo() {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0A0A0F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0F">
<tr><td align="center" style="padding:28px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#16161D;border-radius:16px;padding:26px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
  <tr><td>
    <div style="font-size:20px;font-weight:800;color:#F5F5F7;letter-spacing:-.3px">SUB-20 — uputstvo za aplikaciju</div>
    <p style="color:#9C9CA8;font-size:15px;line-height:1.6;margin:16px 0 0">
      Napisao sam detaljno uputstvo: kako se pravi plan, šta znači koja kartica u Progresu,
      kako rade Strava i intervals.icu, i kako se treninzi šalju direktno na sat.
    </p>
    <p style="color:#9C9CA8;font-size:15px;line-height:1.6;margin:14px 0 0">
      Tu su i rešenja za stvari koje najviše zbunjuju — na primer zašto na satu ume da piše
      „No Target" i šta se tačno radi u tom slučaju.
    </p>
    <div style="margin:26px 0 8px">
      <a href="${BAZA}/uputstvo.html"
         style="display:inline-block;background:#FF2D55;color:#fff;text-decoration:none;
                font-weight:800;font-size:15px;padding:14px 26px;border-radius:12px">Otvori uputstvo</a>
    </div>
    <p style="color:#7A7A86;font-size:12px;line-height:1.6;margin:22px 0 0">
      Dobijaš ovo jer imaš nalog u SUB-20. Ovo je jednokratno obaveštenje, ne bilten —
      nema redovnog slanja. Ako imaš pitanje ili nešto ne radi, samo odgovori na ovaj mejl.
    </p>
    <p style="color:#7A7A86;font-size:12px;margin:14px 0 0">
      <a href="${BAZA}/" style="color:#7A7A86">aplikacija</a> ·
      <a href="${BAZA}/privacy.html" style="color:#7A7A86">politika privatnosti</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

const NASLOV = 'SUB-20 — uputstvo: kako se koriste sve funkcije';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Samo POST.' }); return; }
  if (!proveriTajnu(req) && !(await proveriVlasnika(req))) {
    res.status(401).json({ error: 'Neovlašćeno.' }); return;
  }

  const url  = process.env.SUPABASE_URL;
  const srv  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rk   = process.env.RESEND_API_KEY;
  const from = process.env.REPORT_FROM;
  if (!url || !srv) { res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nisu podešeni.' }); return; }
  if (!rk || !from) { res.status(500).json({ error: 'RESEND_API_KEY / REPORT_FROM nisu podešeni.' }); return; }

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch {}
  const posalji = body.posalji === true;
  /* probno slanje samo na navedene adrese — da vidiš kako mejl izgleda u sandučetu */
  const samoNa = Array.isArray(body.samoNa) ? body.samoNa.map(x => String(x).toLowerCase()) : null;

  let svi;
  try { svi = await sviKorisnici(url, srv); }
  catch (e) { res.status(502).json({ error: e.message }); return; }
  if (samoNa) svi = svi.filter(e => samoNa.includes(e));

  if (!posalji) {
    res.status(200).json({
      probno: true, primalaca: svi.length, primaoci: svi,
      naslov: NASLOV,
      napomena: 'Ništa nije poslato. Ponovi poziv sa {"posalji":true} da stvarno pošalješ.'
    });
    return;
  }

  /* SLANJE U VISE POZIVA — funkcija se ne sme osloniti na to da stigne do kraja.
     Resend prima ~2 zahteva u sekundi, pa jedan mejl kosta ~600 ms. Vercel
     funkcija ima vremenski limit (ovde 60 s, v. vercel.json), sto je oko 90
     mejlova po pozivu; ranije je petlja isla kroz CELU listu (do 5000 adresa =
     50 minuta) i bila prekidana na pola. Klijent je tada video „Nije uspelo",
     a deo ljudi je mejl VEC primio — pa je ponovni pokusaj slao duplikate.
     Sada se radi do roka, pa se vrati `sledeciOd`; pozivalac nastavlja odatle.
     Redosled je stabilan (sortirana lista), tako da se niko ne preskoci ni ne
     dobije dva puta. */
  /* Tempo i rok su podesivi kroz Environment Variables. Podrazumevane
     vrednosti su produkcijske; postoje kao promenljive iz dva razloga:
     (1) ako Resend promeni ogranicenje, ne treba menjati kod;
     (2) testovi ih spuste, pa ne moraju stvarno da cekaju minute. */
  /* `|| podrazumevano` OVDE NE VALJA: Number('0') je 0, sto je falsy, pa bi
     eksplicitno podesena nula tiho postala 600. Zato provera vrednosti. */
  const broj = (v, pod) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : pod; };
  const PAUZA_MS = broj(process.env.BROADCAST_PAUZA_MS, 600);    /* Resend ~2 zahteva/s */
  const ROK_MS   = broj(process.env.BROADCAST_ROK_MS, 45000);    /* rezerva do limita funkcije */
  const pocetak = Date.now();
  const od = Math.max(0, Math.min(Number(body.od) || 0, svi.length));
  const primaoci = svi.slice(od);

  const html = telo();
  const uspelo = [], palo = [];
  let i = 0;
  for (; i < primaoci.length; i++) {
    if (Date.now() - pocetak > ROK_MS) break;   /* stani pre nego sto te platforma prekine */
    const to = primaoci[i];
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + rk, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject: NASLOV, html })
      });
      if (r.ok) uspelo.push(to);
      else { let d=''; try{ d=(await r.text()).slice(0,120); }catch{} palo.push({ to, greska: 'HTTP ' + r.status + ' ' + d }); }
    } catch (e) {
      palo.push({ to, greska: e.message });
    }
    /* Resend ograničava na ~2 zahteva u sekundi; bez pauze deo mejlova otpadne */
    if (PAUZA_MS > 0) await new Promise(r => setTimeout(r, PAUZA_MS));
  }
  const obradjeno = od + i;
  const sledeciOd = obradjeno < svi.length ? obradjeno : null;

  /* Greške se GRUPIŠU po poruci: kad padne svih osam, razlog je po pravilu
     jedan te isti (npr. Resend bez potvrđenog domena šalje samo na adresu
     vlasnika naloga), pa je jedna jasna rečenica korisnija od osam istih. */
  const poRazlogu = {};
  for (const p of palo) { const k = p.greska || 'nepoznato'; (poRazlogu[k] = poRazlogu[k] || []).push(p.to); }
  const razlozi = Object.keys(poRazlogu).map(k => ({ razlog: k, koliko: poRazlogu[k].length, primeri: poRazlogu[k].slice(0, 3) }));
  res.status(200).json({
    poslato: uspelo.length, palo: palo.length,
    razlozi,
    /* najčešći razlog izdvojen, da pozivalac ima šta da prikaže bez kopanja */
    glavniRazlog: razlozi.length ? razlozi.sort((a, b) => b.koliko - a.koliko)[0].razlog : null,
    /* nastavak: null = gotovo je; broj = pozovi ponovo sa {"posalji":true,"od":N} */
    ukupno: svi.length,
    sledeciOd
  });
}
