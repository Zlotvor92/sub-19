# SUB-20 — podešavanja koja NISU SQL

## Zašto ovaj fajl postoji

Cela pouka prethodnog čišćenja staje u jednu rečenicu: **ono što nije u
repozitorijumu postaje nevidljivo.** `public.user_state` je bila napravljena
rukom u jednom zaboravljenom tabu SQL Editora, pa mesecima nije postojalo ništa
sa čim bi se njene politike uporedile — i `provera.sql` ju je zato mogao
prijaviti samo kao „RLS uključen · OK", i za ispravnu i za politiku koja pušta
svakoga.

Šema je sada u `supabase/*.sql`, a `inventar.sql` hvata svako razilaženje. Ali
aplikacija zavisi i od podešavanja koja **nisu SQL** i ne vide se ni iz jednog
upita — ona žive u Supabase i Vercel kontrolnim tablama. Ona su sada tačno ono
što je `user_state` bila ranije: stvarna, bitna i nezapisana.

Ovde su zapisana. Kad promeniš neko od njih, promeni i ovaj fajl.

---

## Supabase → Authentication → Sessions

### Access token (JWT) expiry — **900** sekundi

Koliko važi pristupni token. Podrazumevano je 3600 (sat vremena).

**Zašto je skraćeno.** Zabrana naloga ide kroz Supabase Auth. Od tog trenutka
čovek ne može ni da se prijavi ni da osveži token, pa su mu sve `/api/*` putanje
zatvorene odmah — svaka od njih pita Auth „ko si ti" i dobija 401.

Ali aplikacija najveći deo posla radi **direktno sa bazom** (sinhronizacija
stanja, Zajednica, AI poslovi, pretplate). Ti pozivi idu na PostgREST, a on token
proverava kriptografski: gleda potpis i vreme isteka, i ništa više. Ne postoji
spisak opozvanih tokena i ne pita Auth da li je nalog u međuvremenu zabranjen.

Zato pristupni token koji je čovek već imao u ruci nastavlja da radi **do svog
isteka**. Ne dobija ništa tuđe — RLS i dalje važi — ali svoje redove čita i piše
do isteka. Taj prozor se ne može svesti na nulu dok su tokeni bez stanja; može
samo da se skrati, i to je jedini razlog za ovo podešavanje.

**Cena:** četiri puta više osvežavanja tokena. Ne oseti se, i aplikacija je za to
spremna: `sbEnsure` osvežava minut pre isteka, a od v227 se osvežavanje dešava
jednom ma koliko ga mesta tražilo odjednom (Supabase rotira refresh token, pa bi
dva istovremena poziva sa istim tokenom drugi put dobila 400).

**Bez signala se ništa ne zaključava.** Ako token istekne dok si offline,
osvežavanje padne na mreži, sesija OSTAJE i aplikacija radi normalno iz lokalne
kopije — sesiju obara samo izričito odbijanje sa servera.

> Ako ovu vrednost promeniš, promeni je i u `privacy.html` (oba jezika) —
> tamo piše koliko taj prozor traje. Test `test/api.test.mjs` drži da se ta dva
> broja slažu sa ovim fajlom.

---

## Supabase → Authentication → Providers

### Google — uključen

Jedini način prijave koji aplikacija nudi.

### Email — ako je uključen, potvrda mora biti obavezna

Supabase izda token sa **nepotvrđenom** adresom ako je Email provider uključen a
potvrda isključena. Time bi neko ko se registruje vlasnikovom adresom — bez
ikakvog pristupa njoj — dobio token u kom piše da je vlasnik.

Kod se od toga brani sam: `vlasnikIz` u `api/broadcast.js` i `api/push.js` traži
`email_confirmed_at` (ili `confirmed_at`) i bez toga ne pušta nikoga. Odbrana
dakle NE zavisi od ovog podešavanja — ali podešavanje je prvi sloj i nema razloga
da bude labavo.

---

## Supabase → Authentication → URL Configuration

### Redirect URLs — mora da dozvoli povratnu adresu sa upitom

Prijava vraća naš nonce (`sbn`) **u samoj povratnoj adresi**, ne kroz `state`:
Supabase koristi `state` interno za sopstvenu zaštitu prema Google-u, pa bi se
naša vrednost sudarila sa njegovom (v. komentar uz `sbLogin` u `app.js`).

Ako obrazac ne dozvoljava upit, Supabase odbaci `sbn` i prijava radi „po starom",
sa širim prozorom u kom se može podmetnuti tuđ `#access_token=`. Radi — ali sa
slabijom zaštitom, i to se ne vidi kao greška.

---

## Vercel → Settings → Environment Variables

Samo IMENA. Vrednosti ne idu ni u ovaj fajl ni bilo gde u repozitorijum.

| ime | bez čega ne radi |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | sve serverske putanje |
| `CRON_SECRET` | jutarnji podsetnik i dnevni izveštaj |
| `ADMIN_EMAIL` (ili `REPORT_TO`) | vlasnička kapija — bez njega admin putanje ne propuštaju NIKOGA |
| `ADMIN_2FA` | brisanje i zabrana naloga; bez njega se odbijaju, namerno |
| `RESEND_API_KEY`, `REPORT_FROM` | mejlovi (izveštaj, objava, alarm o pogrešnoj lozinci) |
| `GEMINI_API_KEY` | AI analiza |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | Strava |
| `ICU_CLIENT_ID`, `ICU_CLIENT_SECRET`, `ICU_REDIRECT_URI` | intervals.icu OAuth |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | obaveštenja |
| `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL` | prepoznavanje sopstvenog porekla u `api/analyze.js` |
| `SAMA_ADRESA` | nije obavezna; postavlja se tek kad se veže sopstveni domen, da `api/analyze.js` prepozna sebe pod tim imenom |

Sve što nedostaje aplikacija prijavljuje rečenicom koja imenuje promenljivu —
nijedno od ovoga ne otkazuje ćutke.
