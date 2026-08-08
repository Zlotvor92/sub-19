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
   tvrdi da jeste.

   ADRESA MORA BITI POTVRĐENA. Sama jednakost `email === admin` nije dovoljna:
   Supabase izda JWT sa proizvoljnim, NEPOTVRĐENIM mejlom ako je Email provider
   ukljucen a potvrda iskljucena — pa bi napadac koji se registruje vlasnikovom
   adresom (bez pristupa njoj) dobio token sa `email: vlasnik`, `email_confirmed_at: null`
   i prosao ovu kapiju: izlistao sve adrese korisnika i poslao mejl svima.
   Google OAuth uvek daje potvrdjenu adresu, pa tim putem napad ionako ne radi;
   ova provera cini da odbrana NE ZAVISI od Supabase podesavanja. Prihvata se
   `email_confirmed_at` ILI `confirmed_at` — GoTrue je kroz verzije koristio
   oba naziva za istu potvrdu. */
/* Vraca korisnika iz tokena AKO je vlasnik, inace null. Ceo objekat, ne samo
   `true`, jer administratorskim radnjama treba i njegov id — da se vlasnik ne
   bi obrisao ili zabranio sam sebi. */
async function vlasnikIz(req) {
  const admin = String(process.env.ADMIN_EMAIL || process.env.REPORT_TO || '').trim().toLowerCase();
  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
  if (!admin || !url || !anon) return null;
  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  if (!m) return null;
  try {
    const r = await fetch(url.replace(/\/+$/, '') + '/auth/v1/user', {
      headers: { apikey: anon, Authorization: 'Bearer ' + m[1] }
    });
    if (!r.ok) return null;
    const u = await r.json();
    const potvrdjen = !!(u && (u.email_confirmed_at || u.confirmed_at));
    if (!u || !u.email || !potvrdjen) return null;
    return String(u.email).trim().toLowerCase() === admin ? u : null;
  } catch (e) { return null; }
}
async function proveriVlasnika(req) { return !!(await vlasnikIz(req)); }

/* ============================================================
   SPISAK KORISNIKA, BRISANJE I ZABRANA — sve pod `{admin: ...}`.

   ZASTO OVDE, a ne u zasebnom fajlu. Bilo je zasebno (api/admin-users.js) i
   tako je citljivije, ali Vercel Hobby plan dozvoljava najvise 12 serverless
   funkcija po deployu — trinaesta obara CEO build, pa se ne objavi ni jedna
   izmena. Ovo je najprirodnije mesto za spajanje: broadcast je vec vlasnicka
   putanja sa istom kapijom i vec ume da izlista korisnike.

   ZASTO NE U /api/delete-account. Ta putanja NIKAD ne cita ciji nalog brise
   iz zahteva — to je njeno jedino bezbednosno obecanje i drzi ga test.
   Administratorsko brisanje bi ga ponistilo.

   KAPIJA JE UZA NEGO ZA SLANJE MEJLA: samo vlasnik, nikad CRON_SECRET.
   Zakazani posao sme da posalje obavestenje; ne sme da brise ljude.
   ============================================================ */
const TABELE = [
  'user_state',
  'push_pretplata',
  'ai_posao',
  'api_usage',
  'bug_report_usage',
  'endpoint_usage',
  'zajednica_profil',
  'user_state_istorija'
];

async function adminRuta(res, body, vlasnik, baza, srvHead) {
  /* ---------- ZABRANA / SKIDANJE ---------- */
  if (body.admin === 'ban') {
    if (body.banId === vlasnik.id) return res.status(400).json({ error: 'Sebe ne možeš da zabraniš.' });
    /* GoTrue prima `ban_duration` kao trajanje ('876000h' = sto godina) ili
       'none' za skidanje. Zasebna „unban" putanja ne postoji. */
    try {
      const r = await fetch(baza + '/auth/v1/admin/users/' + encodeURIComponent(String(body.banId)), {
        method: 'PUT',
        headers: { ...srvHead, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ban_duration: body.ukini ? 'none' : '876000h' })
      });
      if (!r.ok) {
        console.error('[admin][ALARM] zabrana nije primenjena za %s — HTTP %s', body.banId, r.status);
        return res.status(502).json({ error: 'Nije uspelo (' + r.status + ').' });
      }
      const u = await r.json();
      console.log('[admin] %s je %s nalog %s', vlasnik.email, body.ukini ? 'odbranio' : 'zabranio', body.banId);
      return res.status(200).json({ ok: true, zabranjen: !body.ukini, email: (u && u.email) || null });
    } catch (e) { return res.status(503).json({ error: 'Server nije dostupan.' }); }
  }

  /* ---------- BRISANJE ---------- */
  if (body.admin === 'obrisi') {
    const cilj = String(body.obrisiId || '');
    /* Vlasnik ne sme sebe odavde — izgubio bi pristup spisku. Za sopstveni
       nalog postoji Podesavanja → Nalog → Brisanje naloga, sa potvrdom. */
    if (cilj === vlasnik.id) {
      return res.status(400).json({ error: 'Svoj nalog ne brišeš odavde — Podešavanja → Nalog → Brisanje naloga.' });
    }
    /* Postojanje se proverava PRE brisanja redova: bez toga bi pogresan id
       obrisao nula redova i vratio „ok", pa bi izgledalo da je neko obrisan. */
    let meta = null;
    try {
      const r = await fetch(baza + '/auth/v1/admin/users/' + encodeURIComponent(cilj), { headers: srvHead });
      if (r.ok) meta = await r.json();
    } catch (e) {}
    if (!meta || !meta.id) return res.status(404).json({ error: 'Taj nalog ne postoji.' });

    const obrisano = [];
    for (const t of TABELE) {
      try {
        const r = await fetch(baza + '/rest/v1/' + t + '?user_id=eq.' + encodeURIComponent(cilj), {
          method: 'DELETE', headers: { ...srvHead, Prefer: 'return=minimal' }
        });
        if (!r.ok && r.status !== 404) {
          console.error('[admin][ALARM] tabela %s nije obrisana za %s — HTTP %s', t, cilj, r.status);
          return res.status(502).json({ error: 'Brisanje podataka nije uspelo (' + t + '). Nalog NIJE obrisan.' });
        }
        if (r.ok) obrisano.push(t);
      } catch (e) {
        return res.status(503).json({ error: 'Server nije dostupan. Nalog NIJE obrisan.' });
      }
    }
    /* Nalog TEK NA KRAJU — obrnut redosled ostavlja coveka bez pristupa a sa
       podacima na serveru. */
    try {
      const r = await fetch(baza + '/auth/v1/admin/users/' + encodeURIComponent(cilj), {
        method: 'DELETE', headers: srvHead
      });
      if (!r.ok) return res.status(502).json({ error: 'Podaci su obrisani, ali sam nalog nije.' });
    } catch (e) { return res.status(503).json({ error: 'Podaci su obrisani, ali sam nalog nije.' }); }

    console.log('[admin] %s obrisao nalog %s (%s)', vlasnik.email, meta.email || '—', cilj);
    return res.status(200).json({ ok: true, email: meta.email || null, obrisano });
  }

  /* ---------- IZAZOV NEDELJE ----------
     Jedan jedini red koji vide SVI korisnici. Kroz RLS ga ne menja niko —
     tabela zajednica_izazov nema nijednu politiku za upis (v.
     supabase/zajednica.sql). Menja se isključivo ovuda, service_role ključem,
     iza iste kapije kao brisanje i zabrana: samo vlasnik, nikad CRON_SECRET.

     Zašto ne kroz RLS „samo vlasnik": to bi značilo da vlasnikov identifikator
     stoji u SQL fajlu u javnom repozitorijumu, i da se menja rukom u bazi kad
     god se promeni. Kapija koja već postoji u kodu je i tačnija i jedna. */
  if (body.admin === 'izazov') {
    const tekst = String(body.tekst == null ? '' : body.tekst).trim();
    /* Iste granice kao `check` u bazi. Provera je i ovde da bi čovek dobio
       rečenicu koja mu kaže šta ne valja, umesto sirove greške iz Postgresa. */
    if (tekst.length < 3 || tekst.length > 160) {
      return res.status(400).json({ error: 'Izazov mora imati između 3 i 160 znakova.' });
    }
    try {
      const r = await fetch(baza + '/rest/v1/zajednica_izazov', {
        method: 'POST',
        headers: { ...srvHead, 'Content-Type': 'application/json',
                   Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({ id: 1, tekst, azurirano: new Date().toISOString() })
      });
      if (!r.ok) {
        console.error('[admin][ALARM] izazov nije upisan — HTTP %s', r.status);
        return res.status(502).json({ error: 'Nije upisano (' + r.status + ').' });
      }
      console.log('[admin] %s je promenio izazov nedelje', vlasnik.email);
      return res.status(200).json({ ok: true, tekst });
    } catch (e) { return res.status(503).json({ error: 'Server nije dostupan.' }); }
  }

  /* ---------- SPISAK ---------- */
  let lista;
  try { lista = await sviKorisniciPuni(baza, srvHead.apikey); }
  catch (e) { return res.status(502).json({ error: e.message }); }

  /* Ko uopste ima zapisa — da se prazan probni nalog razlikuje od nekog ko
     aplikaciju stvarno koristi. Jedan upit za sve, ne po korisniku. */
  const brojac = {};
  try {
    const r = await fetch(baza + '/rest/v1/user_state?select=user_id,updated_at', { headers: srvHead });
    if (r.ok) for (const x of await r.json()) brojac[x.user_id] = x.updated_at || true;
  } catch (e) { /* bez ovoga spisak i dalje radi */ }

  /* `banned_until` posle skidanja zabrane ume da ostane kao datum u PROSLOSTI,
     zavisno od verzije GoTrue-a — zato poredjenje sa sadasnjim trenutkom, a ne
     samo provera postojanja polja. */
  const sada = Date.now();
  const korisnici = lista.map(u => {
    const do_ = u.banned_until || u.bannedUntil || null;
    return {
      id: u.id,
      email: u.email || '—',
      napravljen: u.created_at || null,
      poslednjaPrijava: u.last_sign_in_at || null,
      imaPodatke: !!brojac[u.id],
      zabranjen: !!(do_ && Date.parse(do_) > sada),
      jaSam: u.id === vlasnik.id
    };
  }).sort((a, b) => String(b.poslednjaPrijava || '').localeCompare(String(a.poslednjaPrijava || '')));

  return res.status(200).json({ ok: true, korisnici });
}

/* Kao `sviKorisnici`, ali vraca CELE objekte umesto samo adresa — spisku
   trebaju id, datum prijave i stanje zabrane. */
async function sviKorisniciPuni(url, key) {
  const PER = 200, out = [];
  for (let page = 1; page <= 25; page++) {
    const r = await fetch(url.replace(/\/+$/, '') + '/auth/v1/admin/users?per_page=' + PER + '&page=' + page, {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    if (!r.ok) throw new Error('spisak korisnika nije uspeo (' + r.status + ')');
    const j = await r.json();
    const users = Array.isArray(j) ? j : (Array.isArray(j.users) ? j.users : []);
    out.push(...users);
    if (users.length < PER) break;
  }
  return out;
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

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch {}

  /* ADMIN GRANA — pre svega ostalog, jer ne trazi Resend podesavanja i ima
     UZU kapiju: samo vlasnik, nikad CRON_SECRET. Zakazani posao sme da
     posalje obavestenje; ne sme da brise ljude.
     Neovlascen zahtev dobija 404, ne 403 — „zabranjeno" je potvrda da nesto
     postoji. */
  if (body.admin) {
    const vlasnik = await vlasnikIz(req);
    if (!vlasnik) { res.status(404).json({ error: 'Ne postoji.' }); return; }
    const u = process.env.SUPABASE_URL, s = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!u || !s) { res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nisu podešeni.' }); return; }
    const baza = u.replace(/\/+$/, '');
    return adminRuta(res, body, vlasnik, baza, { apikey: s, Authorization: 'Bearer ' + s });
  }

  if (!proveriTajnu(req) && !(await proveriVlasnika(req))) {
    res.status(401).json({ error: 'Neovlašćeno.' }); return;
  }

  const url  = process.env.SUPABASE_URL;
  const srv  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rk   = process.env.RESEND_API_KEY;
  const from = process.env.REPORT_FROM;
  if (!url || !srv) { res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nisu podešeni.' }); return; }
  if (!rk || !from) { res.status(500).json({ error: 'RESEND_API_KEY / REPORT_FROM nisu podešeni.' }); return; }
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
     Sada se radi do roka, pa se vrati `posle`; pozivalac nastavlja odatle.
     Redosled je stabilan (sortirana lista), tako da se niko ne preskoci ni ne
     dobije dva puta.

     NASTAVAK IDE PO ADRESI, NE PO POZICIJI.
     Ranije se vracao `sledeciOd` — indeks u sortiranoj listi — pa je pozivalac
     govorio „nastavi od 90.". Ali lista se izmedju dva poziva CITA IZNOVA, a
     slanje na 5000 adresa traje pedesetak minuta. Dovoljno je da se u tom
     prozoru registruje jedan korisnik ciji mejl pada pre tekuceg mesta (npr.
     `ana@…`) pa da se svi indeksi pomere za jedan — i tacno jedna osoba bude
     TIHO preskocena. Nikad se ne bi primetilo: brojevi na kraju izgledaju
     uredno, samo jedan covek ne dobije mejl.
     Kursor po vrednosti to nema: „posalji svima cija je adresa POSLE ove"
     ostaje tacno i kad lista naraste ili se skrati.
     `od` se i dalje prihvata da stariji pozivalac ne pukne na pola posla. */
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
  const posle = typeof body.posle === 'string' ? body.posle.trim().toLowerCase() : '';
  const primaoci = posle
    ? svi.filter(e => e > posle)
    /* stari oblik: pozicija u listi. Zadržan samo da poziv u toku ne pukne. */
    : svi.slice(Math.max(0, Math.min(Number(body.od) || 0, svi.length)));

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
  /* Kursor je POSLEDNJA OBRAĐENA adresa — i to obrađena, ne uspešno poslata:
     adresa koju je Resend odbio se neće popraviti ponavljanjem, a da ostane u
     kursoru, sledeći poziv bi zauvek počinjao od nje. */
  const zadnja = i > 0 ? primaoci[i - 1] : (posle || null);
  const ostalo = i < primaoci.length;
  const sledeciPosle = ostalo ? zadnja : null;
  /* Stari oblik odgovora — dok se pozivalac ne prebaci na `posle`. */
  const sledeciOd = ostalo ? (svi.length - (primaoci.length - i)) : null;

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
    /* nastavak: null = gotovo je; adresa = pozovi ponovo sa
       {"posalji":true,"posle":"<ta adresa>"} */
    ukupno: svi.length,
    sledeciPosle,
    sledeciOd
  });
}
