# Izveštaj o izmenama — SUB-20

**Grana:** `claude/app-review-report-roi7oy`
**Verzija aplikacije:** 139 → **140** (`index.html` i `sw.js`)
**Šema stanja:** v6 → **v7**
**Testovi:** 0 → **110**, svi prolaze
**Izmenjeno:** 11 fajlova aplikacije, 458 dodatih / 131 uklonjenih linija
**Novo:** `test/` (7 fajlova), `.github/workflows/test.yml`, `.vercelignore`

---

## Šta NIJE dirano

Pre svega ostalog, jer je to bilo izričito pitanje:

**Tvoj lični plan je netaknut.** Provereno mašinski, poređenjem vrednosti pre i
posle svih izmena:

| Vrednost | Pre | Posle |
|---|---|---|
| `START` / `RACE` | 2026-06-22 / 2026-09-24 | isto |
| Ukupna kilometraža plana | 533,7 km | isto |
| Broj treninga | 72 | isto |
| Početni VDOT | 48,1 | isto |
| Ciljni VDOT / vreme | 51,3 / 1170 s | isto |
| `PRED` redova / `QS` unosa | 25 / 24 | isto |

Nedirnuti su i: `PLAN`, `PRED`, `WT_TARGET`, `QS`, `seedState()` (tvoja istorija
iz Excela), `CILJ`, `CILJ_TEMPO`, `goalCtxText()`, `moraSvojPlan()`,
`jeVlasnik()`, razdvojeni `n`/`g` ID prostori.

Novi fajl `test/licni-plan.test.mjs` sada **zaključava** sve te vrednosti — ako
ih bilo koja buduća izmena promeni, test pukne.

**Nosivi identifikatori takođe nedirnuti** (promena bi značila gubitak podataka
ili duplikate na tuđim satovima):

| Šta | Zašto se ne dira |
|---|---|
| `LS_KEY='sub19-v1'` | localStorage ključ — promena briše podatke svih korisnika |
| `SB_KEY='sub19_sb'` | Supabase sesija — promena odjavljuje sve |
| `externalId:'sub19-'` + regexi u `api/workouts.js` | identitet događaja koji **već stoje** u tuđim intervals.icu/Garmin kalendarima; promena → „Pošalji iz početka" ne nalazi ranije poslato → trajni duplikati na satu |
| `BAZA='https://sub-19.vercel.app'` | prava adresa deploya |
| OAuth `state` ključevi | nema koristi, samo rizik |
| `app:'SUB-19'` u backup fajlu | kompatibilnost sa postojećim backup fajlovima |

**Vercel, Supabase i Resend: nula dodira.** Nijedna env varijabla, nijedna
tabela (`user_state`, `api_usage`), nijedan RPC (`check_and_bump_*`), ni pogled
`app_stats` nisu menjani niti se očekuje ijedna izmena sa tvoje strane.

Jedini dodatak u `vercel.json` je `functions.maxDuration` — to je podešavanje
platforme, ne varijabla koju treba negde uneti.

---

## P0 — Ispravljeno

### 1. Aplikacija je posle ponoći prikazivala jučerašnji dan

**Šta je bilo:** `const TODAY=todayStr()` — izračunato **jednom**, pri
učitavanju, a čita se na 37 mesta. Instalirana PWA ne restartuje se danima. Ko
otvori app u 23:50 i pogleda je u 00:30 video je jučerašnji trening kao „Danas",
a klik na „Završi trening" upisivao je jučerašnji datum. Pogađalo je i streak,
mapu tela („poslednjih 14 dana"), predlog prilagođavanja povredi i naziv backup
fajla.

**Zašto je ovo bilo sigurno bug, a ne dilema:** sam kod je scenario već
priznavao — `icuAutoSync` jedini uzima svež datum, uz komentar *„app ume da
stoji otvorena preko ponoći"*. Ostalih 37 mesta nije.

**Šta je urađeno:** `TODAY` je sada `let`, uz funkciju `osveziDan()` koja se
poziva pri povratku u aplikaciju (`visibilitychange`) i pri svakoj promeni taba.
Kad se datum promeni, ekran se ponovo iscrta.

**Test:** `test/danas.test.mjs` — lažni sat pomeren sa 23:50 na 00:30, provereno
da `TODAY` prati i da izvedene funkcije ne drže staru vrednost u zatvaranju.

---

### 2. „Pošalji svima" se prekidao na pola i pravio duplikate

**Šta je bilo:** `api/broadcast.js` je slao mejlove sekvencijalno, sa pauzom od
600 ms (Resend prima ~2 zahteva/s). Vercel funkcija ima vremenski limit, a
`vercel.json` ga nije ni podešavao. Na 600 ms po mejlu to je ~90 mejlova po
pozivu; petlja je išla kroz celu listu (do 5000 adresa = 50 minuta) i bila
prekidana. Klijent je video „Nije uspelo", a deo ljudi je mejl **već primio** —
pa je ponovni pokušaj slao duplikate. Nije bilo nikakve idempotencije.

**Šta je urađeno:**
- Lista primalaca se sortira (stabilan redosled je uslov za nastavak).
- Server radi do roka (45 s), pa vrati `sledeciOd`.
- Klijent nastavlja odatle u petlji, prikazujući napredak.
- `vercel.json`: `maxDuration: 60` za `broadcast`, `workouts`, `daily-report`, `analyze`.
- Tempo i rok su podesivi kroz `BROADCAST_PAUZA_MS` / `BROADCAST_ROK_MS` (podrazumevano produkcijske vrednosti) — ako Resend promeni limite, ne treba menjati kod.

**Test:** `test/api.test.mjs` — 250 korisnika, provereno da jedan poziv ne pošalje
sve, da nastavak pokrije tačno svih 250, i da **niko ne dobije mejl dva puta**.

---

### 3. „Pošalji iz početka" je mogao da ostavi kalendar polupraznim

**Šta je bilo:** `api/workouts.js` u režimu `zameni` radio je do 60
sekvencijalnih `DELETE` poziva ka intervals.icu, bez roka i bez provere odgovora
— 12–25 s samo za brisanje, pre GET-a i završnog POST-a. Ako funkciju prekine
limit usred petlje, korisnik ostane sa **delimično obrisanim kalendarom i bez
novih treninga** — gore nego pre poziva.

**Šta je urađeno:** brisanje ide paralelno, u grupama po 5, sa `.catch()` po
zahtevu (pojedinačni neuspeh ne obara ceo posao). Filter `sub19-` je netaknut —
tuđi događaji se i dalje ne diraju.

**Test:** provereno da se svih 40 događaja obriše, da se radi paralelno
(najviše 5 istovremeno), i da se događaji sa tuđim `external_id` **ne diraju**.

---

## P1 — Ispravljeno

### 4. intervals.icu token je curio u backup fajl

**Šta je bilo:** `exportBackup()` je radio samo `delete copy.strava` uz komentar
*„tokeni ne idu u backup fajl"*. Strava jeste bila skinuta, **`S.icu` nije** — a
on nosi intervals.icu OAuth token (po njihovoj dokumentaciji **ne ističe**)
odnosno ručno unet API ključ.

Backup fajl završi u Downloads folderu i u mejlu. To je bio trajan pristup tuđim
zdravstvenim podacima (HRV, puls u miru, san) i pravo pisanja u kalendar.

Politika je pritom **već bila ispravno napisana** na drugom mestu — `sbPayload()`
za serversku sinhronizaciju skida i Stravu i ICU. Izvoz se samo razišao sa njom.

**Šta je urađeno:** nova funkcija `backupPayload()` — jedno mesto, jedna
politika, skida oba. `importBackup` sada čuva postojeću ICU vezu isto kao što je
već čuvao Stravu (veze su po uređaju i ne putuju kroz fajl).

**Test:** provereno da ni izvoz ni sinhronizacija ne sadrže nijedan token, a da
stvarni podaci (dnevnik, koleno, težina, VDOT) ostaju.

---

### 5. Pokvaren backup je mogao trajno da razbije aplikaciju

**Šta je bilo:** `migrate()` je proveravao samo postojanje polja `log`. Zatim
`S=st; setActivePlan(); rebuildDateIndex();` — ako `genPlan.weeks` nije niz
(pokvaren ili ručno izmenjen fajl), `rebuildDateIndex` pukne **posle** zamene
`S`. Stanje ostaje razbijeno u memoriji, i prvi sledeći `save()` (kucanje u
formu, promena statusa) upisao bi ga trajno.

**Šta je urađeno:** nova funkcija `validanGenPlan()` proverava oblik **pre**
zamene; aktivacija je u `try/catch` koji vraća prethodno stanje ako i pored svega
pukne. Poruke su konkretne umesto „Fajl nije prepoznat".

**Test:** 8 oblika pokvarenog plana koji su ranije obarali aplikaciju sada se
odbijaju, a ispravan plan i `null` prolaze.

---

### 6. Dva sloja stanja nisu bila u šemi

**Šta je bilo:** `S.wellness` (oporavak sa intervals.icu) i `S.icu` (veza)
postojali su u kodu ali **nikad nisu upisani u `seedState()` ni `migrate()`**.
Radilo je samo zato što je svako čitanje ručno čuvalo (`S.wellness||{}`).

To je tačno obrazac koji je u ovom fajlu već jednom napravio bag — komentar u
`migrate()` izričito kaže: *„predLock je ranije nedostajao u ovom spisku… i
obarao unos tempa (TypeError). Svi ostali ključevi su ovde bezuslovno — i ovaj
mora biti."* Pravilo je zapisano, pa prekršeno na naredna dva polja.

**Šta je urađeno:** oba su dodata u `seedState()` i `migrate()`, `SCHEMA` → 7.
Prazna mapa / `null` znači ponašanje **identično** kao pre — nema migracije
podataka, ništa se ne gubi.

**Dodatno:** `migrate()` sada **odbija** stanje iz novije šeme umesto da ga tiho
spusti (backup iz buduće verzije bio bi protumačen po starim pravilima i tiho
pogrešno prikazan).

---

### 7. Deload nedelja je umela da bude VEĆA od nedelje pre sebe

**Šta je bilo:** nađeno testom, polumaraton / 3 dana / početnik:

```
N7          isporučeno 28,6 km
N8 DELOAD   isporučeno 30,1 km   ← deload veći od nedelje pre sebe
```

Ciljni obimi su bili ispravni (N7: 41 → N8: 31,2 = ×0,76). Problem je bio u
**isporuci**: kad je ciljni obim iznad onoga što izabrani broj dana može da
ponese (često na 2–3 dana), radne nedelje limiter potkresuje, a deload nedelje su
iz njega bile **izuzete** — pa prođu nepotkresane i završe iznad potkresane
prethodne.

**Šta je urađeno:** deload se sada meri prema **stvarno isporučenoj** prethodnoj
nedelji, i skalira se **proporcionalno** (svi dani istim faktorom), ne pohlepnim
sečenjem odozgo. Prvi pokušaj (sečenje) jeste vratio invarijantu, ali je davao
nakaradnu nedelju — `lako:3 / lako:5.4 / lr:13.3`, tačno silueta na koju
upozorava postojeći komentar u kodu. Deload je smanjena kopija nedelje:

```
N7          8,3 / 7,7 / 12,6  = 28,6 km
N8 DELOAD   6,4 / 5,8 /  9,6  = 21,8 km   ← isti oblik, manji
```

**Radne nedelje se ponašaju bajt-identično kao pre** — grana je odvojena.

**Test:** invarijanta „deload < prethodna nedelja" provereva se na svih 96
scenarija (4 distance × 4 broja dana × 3 obima × 2 profila).

---

### 8. Dnevni limit AI poziva je mogao tiho da prestane da radi

**Šta je bilo:** `api/analyze.js` i `api/report-bug.js` propuštaju zahtev ako RPC
za brojanje ne uspe — namera je legitimna (ne obarati korisnika zbog
infrastrukture), ali **nije ostavljala nikakav trag**. Limit koji tiho otkaže
izgleda isto kao limit koji radi; kvota bi se mogla prazniti mesecima
neprimećeno.

**Šta je urađeno:** `console.warn` u obe grane (HTTP greška i mrežni prekid) —
završava u Vercel logovima. Ponašanje prema korisniku nepromenjeno.

---

### 9. Čarobnjak je brojao nedelje na dva različita načina

**Šta je bilo:** napomena ispod datuma trke koristila je
`floor(diffD(danas, trka)/7)`, a plan se pravi po
`floor((trka − ponedeljak_tekuće_nedelje)/7)+1` — razlika do **dve nedelje**.

U sredu, sa trkom za 40 dana: napomena je govorila *„5 nedelja, 5K traži najmanje
6, plan će biti skraćen"*, a generator je pravio pun ciklus od 7 nedelja.

**Šta je urađeno:** napomena koristi `wizWeeks()` — istu funkciju kao generator.
Uz to, poruka je ispravljena: pisalo je *„plan će biti skraćen"*, a generator u
tom slučaju plan **uopšte ne pravi** nego vraća grešku. Sada kaže šta se stvarno
dešava, pa čovek ne prođe sva četiri koraka da bi na kraju saznao da nije moglo.

---

### 10. Nije bilo nijednog testa

Najveća stavka u celom pregledu, veća od svakog pojedinačnog baga.

**Šta je bilo:** nema `package.json`, nema CI-ja, nijednog test fajla. A kod
sadrži **6 poziva `module.exports`** koji izvoze `generatePlan`, `assess`,
`vdotFromPace`, `recalibrate`, `buildDaySlots`, `DIST_PROFILES` — to postoji
isključivo radi testiranja. Uz to, desetine komentara se pozivaju na testove sa
konkretnim brojevima: *„validirano na 250+ scenarija", „audit: 2269 scenarija",
„55 testova", „nađeno auditom"*. Testovi su postojali, ali nisu u repozitorijumu.

Posledica: ~2700 linija netrivijalne numerike (Daniels–Gilbert jednačine, Njutnova
iteracija, binarna pretraga, k-means detekcija radnih segmenata, periodizacija za
4 distance) bez ijedne automatske provere. Svaka izmena u generatoru bila je slepa.

**Šta je urađeno:** 110 testova u 7 fajlova, **bez ijedne zavisnosti** (sve iz
standardne biblioteke Node-a) i **bez ijedne izmene aplikacije zbog testova**.

`test/harness.mjs` izvlači inline `<script>` iz `index.html` i pokreće ga u
`node:vm` kontekstu sa minimalnim lažnim DOM-om. Aplikacija ostaje jedan fajl,
nepromenjena — testovi se prilagođavaju kodu, ne obrnuto.

| Fajl | Šta pokriva |
|---|---|
| `pure.test.mjs` | VDOT matematika, inverzi zona, `parseTimeStr`, Riegel, XSS u `esc`/`mdToHtml` |
| `generator.test.mjs` | `generatePlan` — 96 scenarija, trenerske invarijante |
| `state.test.mjs` | migracija šeme, VDOT lanac, backup bez tokena |
| `danas.test.mjs` | prelazak preko ponoći, datumska aritmetika |
| `api.test.mjs` | serverske funkcije sa lažnim `fetch` |
| `doslednost.test.mjs` | poklapanje verzija, nosivi identifikatori, CSP, pristupačnost |
| `licni-plan.test.mjs` | **tvoj plan — zaključan** |

**Načelo:** tvrdi se invarijanta, ne izmerena vrednost. `deload < prethodna`
preživljava rekalibraciju; `N8 === 21.7` puca na svaku izmenu i uči čoveka da
briše testove. Izuzetak je `licni-plan.test.mjs`, gde su tačne vrednosti i poenta.

`package.json` je **namerno u `test/`, ne u korenu** — u korenu bi Vercel
projekat protumačio kao Node aplikaciju i promenio način build-a, a aplikacija se
deployuje bez build koraka (na to upozoravaju komentari u `api/*.js`).

Dodat je i `.github/workflows/test.yml` (bez `npm install`, nema šta da se
instalira) i `.vercelignore` da `test/` i `.github/` ne idu u deploy.

---

### 11. `vdotFromPace` je promašivao u polovini slučajeva

**Šta je bilo:** binarna pretraga vraćala je `(lo+hi)/2` — tačno **na skoku**
stepenaste funkcije `paceForZone` (zaokružuje na celu sekundu). Zaokruživanje je
padalo čas na jednu čas na drugu stranu.

**Izmereno:** tempo → VDOT → tempo vraćao je pogrešan tempo u **595 od 1206**
kombinacija zona i forme (49%).

**Šta je urađeno:** vraća se `hi` — po konstrukciji najmanji VDOT čiji tempo već
jeste traženi. Round-trip sada pogađa **1206/1206**. Numerička razlika između dve
varijante je 3·10⁻¹¹ VDOT, dakle bez ikakvog uticaja na zabeležene vrednosti
(zaokružuju se na jednu decimalu).

---

## P2 — Ispravljeno

### 12. Čarobnjak je generisao ceo plan na svaki pritisak tastera

`renderWizWarnings()` pravi pun probni plan, a `generatePlan` rekurzivno zove sam
sebe do 6 puta za predlog broja dana. Pozivalo se iz `input` događaja, a
`goObStep()` ga je zvao **još jednom** — do **14 punih generisanja plana po
pritisku tastera**, sinhrono, na glavnoj niti. Na maratonskom planu od 40+ nedelja
to je vidljivo zaglavljivanje unosa na telefonu.

Dodato odlaganje od 250 ms; poslednji poziv pobeđuje. Rezultat isti, posla red
veličine manje.

### 13. Blokirajući `confirm()` pri pokretanju, sa rizikom gubitka podataka

Sukob lokalnih i serverskih podataka rešavao se sistemskim `confirm`-om **pri
pokretanju**, pre nego što korisnik bilo šta vidi. Dva problema: instalirane PWA
i deo pregledača prigušuju `confirm` — tada vraća `false`, što je ovde značilo
„zadrži lokalne i pošalji", pa bi **tiho pregazio novije podatke sa drugog
uređaja**. Tačno ono što komentar iznad („Nikad tiho ne gazi") pokušava da spreči.

Zamenjeno trakom u aplikaciji sa dva jasna dugmeta. Dok korisnik ne izabere,
ništa se ne šalje ni ne povlači — jedini ishod bez gubitka.

### 14. Pristupačnost

- **`user-scalable=no` uklonjen** — blokirao je pinch-zoom (WCAG 2.1 SC 1.4.4).
  Slučajan zoom pri dvostrukom dodiru i dalje sprečava `touch-action:manipulation`.
- **18 labela povezano sa svojim poljima** (`for` / `id`). Ranije nijedna nije
  bila — čitač ekrana ih nije spajao, dodir na labelu nije fokusirao polje.
- Tri „labele" koje ne označavaju polje (izračunata vrednost, grupa dugmadi,
  naslov grupe radnih segmenata) pretvorene su u `role="group"` + `aria-label`,
  jer je `<label>` bez `for` pogrešan element.

### 15. Sudar datuma je mogao da sakrije ceo dan

`BY_DATE[d.date]=d` — poslednji upis pobeđuje. `S.moves` se validirao samo kao
**format** datuma, ne i jedinstvenost, a `importBackup` prihvata proizvoljan
`S.moves`. Dva dana na istom datumu značila su da jedan **tiho nestane**: ne
pojavi se na „Danas", ne dobije Strava sinhronizaciju, ne uđe u trend analizu.

Sada pomereni dan ustupa mesto i vraća se na izvornu poziciju — gore je izgubiti
pomeranje nego ceo dan. Test proverava da `DATED` nema duplikata.

### 16. Ostalo

| Šta | Ispravka |
|---|---|
| `daily-report` čitao SVE `user_state` redove bez limita | paginacija preko `Range` zaglavlja; PostgREST `max-rows` više ne može tiho da odseče korisnike |
| `vdotFromRace` definisan **dvaput** | jedna definicija (formule su bile identične, pa posledice nije bilo — ali prva izmena jedne kopije napravila bi tih bag; ista zamka je u ovom fajlu već dvaput uhvaćena) |
| `sw.js` poklapao putanju sa `endsWith` | tačno poklapanje |
| `chartWeight` crtao tačke izvan okvira | X koordinata ograničena na opseg plana (Y je već bio) |
| CSP bez `base-uri`/`form-action`/`object-src` | dodate |
| `manifest.json` nosio tvoj datum trke svim korisnicima | generički opis; datum ostaje u `RACE` i u tvom planu |
| Zastareo komentar *„Polumaraton i maraton su uklonjeni"* | usklađen sa kodom (sva četiri profila postoje) |
| Ime proizvoda nedosledno | vidljivi tekst ujednačen na **SUB-20** |
| `APP_VERSION` u dva fajla, ručno održavan | 139 → 140, i **test proverava poklapanje** |

---

## Nađeno u toku rada, ispravljeno odmah

Dve greške koje sam sâm napravio i uhvatio testovima:

1. **`Number('0') || 600` daje 600.** Nula je falsy, pa se podesiva pauza u
   `broadcast.js` nikad nije mogla spustiti na nulu. Zamenjeno proverom
   `Number.isFinite`.
2. **Pohlepno sečenje deloada** je vratilo invarijantu ali je davalo nedelju
   oblika `3 / 5,4 / 13,3` — jedan dan smrskan na pod pored netaknutog dugog
   trčanja. Prepravljeno na proporcionalno skaliranje (v. tačku 7).

---

## Ostalo neurađeno — i zašto

| Stavka | Zašto nije urađena |
|---|---|
| ~~**`ADMIN_EMAIL` u javnom kodu**~~ | **Urađeno.** Poslao si `userId`; prepoznavanje vlasnika ide preko `ADMIN_UID`, adrese više nema u klijentskom kodu. |
| ~~**Deljenje `index.html` (469 KB) na module**~~ | **Urađeno u v150, ali kao razdvajanje u DVA fajla, ne kao moduli.** Kod je izdvojen u `app.js` (obična skripta, ne ES modul), pa build koraka i dalje nema — deploy preko GitHub web editora radi isto. Razlog nije bila veličina nego CSP: tek kad ništa izvršno nije inline, `script-src` sme da bude `'self'`. |
| **`sw.js` network-first za 460 KB `app.js`** | I dalje stoji, samo se sada tiče `app.js` umesto `index.html`. Podela na dva fajla je ovde donela pola koraka: `index.html` je pao sa 469 KB na 37 KB, pa je omotač sada jeftin, ali logika (460 KB) se i dalje povlači sa mreže pri svakom pokretanju kad ima veze. Pravo rešenje je heširano ime fajla + dugotrajan keš, što traži build korak. |
| **Rate-limit na `/api/wellness` i `/api/workouts`** | Traži novu Supabase RPC funkciju i tabelu — dakle izmenu na tvojoj strani, a rekao si da to ne diram. Rizik je nizak (potrebna je prijava). |
| ~~**`ICU_REDIRECT_URI`**~~ | **Postavio si ga.** Ostaje samo kozmetička primedba: dodat je i za Preview, gde adresa nije produkcijska. Bez posledica ako ne testiraš OAuth na preview deploy-ovima. |

---

## Kako proveriti

```bash
node --test "test/**/*.test.mjs"     # 195 testova
npm test --prefix test               # isto
```

Sve prolazi na Node 20+. Nema zavisnosti, nema build koraka, nema mreže.

---

## Sažetak

- **11 fajlova aplikacije** izmenjeno, 458 dodatih / 131 uklonjenih linija
- **16 problema** ispravljeno (3 × P0, 8 × P1, 5 × P2)
- **110 testova** napisano — od nule
- **Tvoj lični plan i svi nosivi identifikatori: nedirnuti**, i sada mašinski zaključani
- **Vercel / Supabase / Resend: ništa ne treba menjati**

---

## Dodatak — šta se desilo posle ovog izveštaja (v141 → v150)

Izveštaj iznad opisuje stanje na v140. Ukratko, po redu:

| Verzija | Šta |
|---|---|
| 141 | Bezbednosna analiza — 15 izvedenih napada, 8 prošlih, svi zatvoreni (v. `IZVESTAJ-BEZBEDNOST.md`) |
| 142–145 | Prepoznavanje vlasnika po Supabase ID-u; `ICU_REDIRECT_URI`; ujednačeno imenovanje na SUB-20 tamo gde ne dira nijedan spoljni servis |
| 146–147 | Lični plan i istorija izbačeni iz isporučenog koda; `uskladiVlasnickePodatke()` ih uklanja iz tuđeg `localStorage`-a |
| 148 | Popravljen harness koji je **lažno prolazio** testove (`querySelector` je vraćao nov element pri svakom pozivu, pa su bezbednosne provere čitale prazan string). Odmah je otkrio stvarni XSS kroz VDOT zapise. |
| 149 | `sbPull()` je vraćao tuđi seed sa servera; tuđe beleške o kolenu su ostajale čim postoji generisan plan |
| **150** | **Kod izdvojen u `app.js`, CSP `script-src` sada `'self'` — bez `'unsafe-inline'`** |

**Testovi: 110 → 195.**

**Lični plan posle svega: nepromenjen** — 14 nedelja, 533,7 km, 72 treninga, VDOT 48,1 → 51,3, PRED 25, QS 24, cilj 19:20–19:30. Za v150 je to provereno i bajt po bajt:

```bash
git show 0dfed1b~1:index.html | sed -n '590,8640p' | diff - app.js
# jedina razlika: APP_VERSION 149 -> 150
```

**Vercel / Supabase / Resend: i dalje ništa ne treba menjati.** `app.js` je običan statički fajl pored `index.html`; nema build koraka, nema nove env varijable, nema izmene u Supabase podešavanjima.
