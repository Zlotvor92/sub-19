# PROMPT: potpuna revizija koda i QA aplikacije SUB-20

> Ovaj fajl je **zadatak za drugu sesiju**. Nalepi ga u celosti kao prvu poruku,
> ili reci sesiji: „pročitaj `test/QA-PROMPT.md` i uradi tačno to".
>
> Stoji u `test/`, koji je u `.vercelignore` — dakle ne objavljuje se na sajtu.

---

## Ko si i šta se od tebe traži

Ti si **stariji QA inženjer i revizor koda**. Dobio si aplikaciju koja je u
produkciji i koju koristi stvaran čovek za pripremu za trku. Tvoj zadatak je da
je pregledaš tako da **ništa ne promakne**, i da o tome napišeš izveštaj.

**Deliverable je IZVEŠTAJ, ne ispravke.** Ne menjaj kod aplikacije. Smeš da
pišeš privremene skripte i probne testove da bi *dokazao* nalaz, ali ih ne
ostavljaš u repozitorijumu i ne komituješ. O ispravkama odlučuje vlasnik, posle
izveštaja.

Piši na srpskom. Kod i komentari u repozitorijumu su na srpskom, izveštaj mora
da se čita u istom jeziku.

---

## Šta je aplikacija

**SUB-20** — PWA za trkačke pripreme (5K / 10K / polumaraton / maraton), po
Danielsovoj VDOT metodologiji. Radi offline, podaci žive na uređaju, server je
rezervna kopija.

| Fajl | Redova | Šta je |
|---|---|---|
| `app.js` | ~14 500 | cela aplikacija, jedan fajl, obična skripta (ne modul) |
| `index.html` | ~1 200 | markup i CSS; **kod se ne sme vratiti inline** (v. CSP) |
| `sw.js` | ~350 | service worker, offline keš, verzionisanje |
| `api/*.js` | ~4 400 | 9 serverless funkcija na Vercelu |
| `supabase/*.sql` | — | šema i RLS; **pušta se RUČNO** u Supabase SQL Editoru |
| `test/*.test.mjs` | 37 fajlova | postojeći paket, ~1 250 provera |

Spolja: Supabase (auth + baza), Strava, intervals.icu, Google Gemini, Open-Meteo,
Resend, Web Push.

---

## ŠTA JE VAN OPSEGA — ne diraj, ne testiraj, ne prijavljuj

Vlasnik izričito kaže da je ovaj deo gotov i da je zadovoljan njime. Nalazi o
njemu nisu traženi i samo razblažuju izveštaj.

### 1. Generator planova trčanja

Sve što odlučuje **kako izgleda trening**: obim, faze, taper, deload, izbor
sesija, dužine ponavljanja, budžeti zona, rast kilometraže.

Konkretno van opsega:
- `generatePlan`, `assess`, `allocEasyLR`, `podPoDanu`, `adaptGeneratedPlan`
- `DIST_PROFILES` i sve u njemu
- svaka funkcija sa sufiksom **`5K` / `10K` / `21K` / `42K`** — ima ih 61:
  `korakRasta*`, `peakVol*`, `lrCap*`, `faza*`, `buildQuality*`, `reps*`,
  `mk*` (mkIntervali, mkTempo, mkCruise, mkRepeticije, mkFartlek, mkPiramida,
  mkProgresivni, mkTrkackiRitam, mkRitam, mkKontrolnaTrka, mkMaratonskiTempo),
  `pauza*`, `q1Familija*`, `lrDodatak*`, `lrCiklus*`, `ritamStrategija*`
- konstante `KORAK_*`, `CILJ_OBIM_*`, `I_PCT_*`, `T_PCT_*`, `R_PCT_*`,
  `DELOAD_F`, `TAPER_F`, `RACEWK_F`, `TEMPO_MAX_SEC_*`, `RAMP`

### 2. Vlasnikov lični plan (hardkodovan)

`START`, `RACE`, `CILJ`, `CILJ_TEMPO`, `PLAN`, `CUR_PRED` i njihov sadržaj.

### 3. Testovi koji te dve stvari čuvaju

`generator.test.mjs`, `generator-otisak.test.mjs`, `otisak-generatora.mjs`,
`simetrija-distanci.test.mjs`, `licni-plan.test.mjs`, `vdot-plan.test.mjs`,
`povratak-obim.test.mjs`, `plan-prstenovi.test.mjs`, `nauka.test.mjs`

**Ako neki od tih testova padne** dok ti radiš — to je znak da si nešto pokvario
u radnom stablu. Vrati stanje i nastavi. Ne prijavljuj to kao nalaz.

**Granica nije apsolutna u jednom smeru:** ako nađeš da neko od ovoga *ruši
aplikaciju* (baca izuzetak, pravi `NaN` koji curi u prikaz, obara render), to
JESTE nalaz — ali ga prijavi kao „stabilnost", ne kao trenersku primedbu.
Trenerske odluke (koliko kilometara, koja sesija, kakav taper) su van opsega
bezuslovno.

---

## ŠTA JE U OPSEGU — sve ostalo

Ovo je spisak područja, ne redosled. Svako mora biti pokriveno.

### A. Sinhronizacije i povezivanja (naglašen prioritet)
- **Strava**: OAuth tok, osvežavanje tokena, uvoz trčanja, `l.lock` (ručna
  korekcija ima trajnu prednost), dva trčanja istog dana, streamovi, po-km
  presek, prepoznavanje deonica
- **intervals.icu**: OAuth i API ključ (dva načina), opsezi (`scope`) i šta se
  dešava kad ih nema, wellness, aktivnosti, krugovi, tokovi, zone pulsa,
  slanje planiranih treninga u kalendar, brisanje ranije poslatog
- **Supabase**: prijava, osvežavanje sesije, sinhronizacija stanja, sukob
  verzija između uređaja, rad bez mreže pa naknadni upis
- **Push**: pretplata, šifrovanje, odjava, iOS ograničenja
- **Redosled izvora** (icu ispred Strave) i šta se dešava kad jedan otkaže
- **Idempotentnost**: dvaput pokrenuta sinhronizacija ne sme da udvostruči,
  pomeri ili obriše ništa

### B. Stanje, migracija, backup
- Migracija šeme (`SCHEMA`, `o.v`), svaki korak i preskočene verzije
- Uvoz backupa: pokvaren JSON, tuđ backup, backup iz starije šeme, ogroman fajl
- Da backup **ne nosi tokene** i da ih uvoz ne upisuje
- Brisanje naloga i šta stvarno ostaje

### C. Bezbednost
- XSS na svakoj tački gde tuđ ili spoljni sadržaj ulazi u DOM (Zajednica,
  Strava nazivi/opisi, AI tekst, uvezen backup, wellness)
- CSP u `vercel.json` naspram stvarnog koda
- RLS u `supabase/*.sql`: može li se videti tuđ red
- Autorizacija na svakoj `api/` putanji; da li se `requireUser` može zaobići
- Rate limit: da li se broji pre ili posle skupe radnje, i može li paralelnim
  pozivima da se prevari
- Curenje tajni u greške, logove, odgovore

### D. Vreme, temperatura, zone *(sveže izmenjeno — pogledaj pažljivo)*
Verzije 252–258 su menjale ovaj deo. Zaslužuje najviše sumnje.
- `tempTrcanja`, `satTrcanja`, keš prognoze, `past_days`
- `zoneIzvor`, `zoneRaspodela`, `zoneIzGranica`, `zoneRazlog`, `karticaZona`
- Šta ide u AI zahtev i da li odgovara onome što piše na ekranu

### E. AI analiza
- Kvote (po treningu i dnevno) i može li se zaobići
- Faze posla (`start` / `radi` / `citaj`), preuzimanje tuđeg posla
- Injekcija kroz polja koja korisnik sam kuca (`raceName`, beleške, Strava opis)
- Da li se modelu šalje nešto što politika privatnosti ne pominje

### F. Zajednica
- Opt-in iz baze, ne iz koda
- Šta se može upisati u tuđ prikaz
- Rangiranje i tri merila

### G. PWA i verzionisanje
- `sw.js`: keš, network-first, ažuriranje, poruka `VERSION`
- Poklapanje `APP_VERSION` u `app.js` i `sw.js`
- `manifest.json`, `assetlinks.json`, APK naspram sajta

### H. Doslednost dokumenata
- `privacy.html` naspram onoga što kod stvarno radi (oba jezika)
- `uputstvo.html` naspram stvarnog ponašanja
- `supabase/*.sql` naspram naziva koje kod koristi

### I. Ivice i otpornost
- Ponoć, promena vremenske zone, letnje/zimsko računanje vremena
- Prazno stanje (nov korisnik), ogromno stanje, pokvarene vrednosti iz backupa
- Bez mreže, spora mreža, prekinut odgovor
- `null` / `NaN` / string umesto broja na svakom ulazu

---

## METOD — obavezan redosled

### Faza 0 — ČITAJ PRE NEGO ŠTO IŠTA TESTIRAŠ

**Ovo nije formalnost i ne sme se preskočiti.**

Ovaj repozitorijum nosi svoje smernice u samom kodu. Komentari nisu opis onoga
što se vidi iz koda — oni objašnjavaju **zašto** je nešto tako, koji je bug bio
pre, šta je već probano i odbačeno. Nalaz koji protivreči zapisanoj namernoj
odluci **nije nalaz**, nego dokaz da nisi pročitao.

Pročitaj, ovim redom:

1. `test/README.md` — doktrina testiranja ove kuće
2. Zaglavlja fajlova: `app.js` (prvih ~1 100 redova), `sw.js`, `api/icu.js`,
   `api/analyze.js`, `api/push.js`, `api/broadcast.js`
3. `supabase/podesavanja.md` i zaglavlja `supabase/*.sql`
4. `.well-known/README.md`
5. `uputstvo.html` i `privacy.html` — ovo je obećanje dato korisniku
6. Veliki blok-komentari kroz `app.js` (traži `====` linije) — tu su zapisane
   sve ranije greške i razlozi

**Izlaz iz faze 0:** spisak od najmanje 20 **namernih odluka** koje si našao u
komentarima, sa kratkim „zašto". Taj spisak ide u izveštaj kao prilog. Bez njega
ne prelaziš na fazu 1.

### Faza 1 — osnovno stanje

```bash
node --test "test/**/*.test.mjs"
```

Traži Node 20+. **Nema zavisnosti**, nema `npm install`, nema build koraka.

Zapiši: koliko prolazi, koliko pada, koliko traje. To je tvoja polazna tačka —
sve što posle pada, pao je zbog tebe.

Uz to:
```bash
for f in api/*.js sw.js app.js; do node --check "$f"; done
```

### Faza 2 — samostalno traženje

Tek sada tražiš sam. Pravila:

**Dokazuj izvršavanjem, ne čitanjem.** `assert.match(izvorniKod, /regex/)`
prolazi i kad kod izgleda ispravno a radi pogrešno. Ovo se u ovom repozitorijumu
već desilo dvaput: jednom je provera dnevnog limita mesecima tvrdila da limit
radi dok se zaobilazio jednim poljem u JSON-u; drugi put je provera nad izvorom
propustila prepravku ternara koja modelu šalje pogrešnu granu, jer su sve
tražene niske i dalje stajale u fajlu.

**Za svaki nalaz obavezno:**
1. konkretan ulaz ili stanje koje ga izaziva
2. šta se stvarno desi (izlaz, izuzetak, pogrešan broj)
3. šta je trebalo da se desi, i **na osnovu čega** to tvrdiš (komentar u kodu,
   postojeći test, uputstvo, politika privatnosti)
4. dokaz da si ga izvršio — komanda i njen izlaz

**Ako ne možeš da ga izvršiš, obeleži ga kao „sumnja", ne kao nalaz.**

Alati koje već imaš:

```js
import { loadApp, readRepoFile } from './test/harness.mjs';
const a = loadApp({ now: '2026-08-09T09:00:00Z' });
a.call('imeFunkcije', arg1, arg2);   // poziv funkcije iz app.js
a.get('KONSTANTA');                   // čitanje const/let sa vrha
a.evalIn('S.log["n1d2"]');            // proizvoljan izraz u kontekstu
a.clock.set('2026-08-10T00:30:00Z');  // pomeranje lažnog sata
a.ctx.fetch = async () => ({...});    // podmetanje mreže
```

Serverske funkcije se testiraju uvozom pravog handlera uz lažni globalni
`fetch` — v. `test/api.test.mjs` i `test/zone-pulsa.test.mjs` za obrazac.
Ništa ne sme da ide na pravu mrežu ni na disk.

### Faza 3 — provera sopstvenih nalaza

Za svaki nalaz koji tvrdi da nešto **ne radi**: pokvari kod namerno na način
koji bi taj nalaz izazvao, potvrdi da se ponaša isto, pa vrati kod. Ako se ne
ponaša isto — nisi našao ono što misliš da si našao.

Na kraju ponovo pusti ceo paket i potvrdi da je radno stablo čisto:
```bash
node --test "test/**/*.test.mjs"
git status --short          # mora biti prazno osim izveštaja
```

---

## Šta JESTE nalaz, a šta nije

**Jeste:**
- pogrešan rezultat na ispravnom ulazu
- pad, izuzetak, `NaN`/`undefined` u prikazu
- podatak koji ide nekud gde ne bi trebalo, ili se ne šalje a treba
- tvrdnja u `privacy.html` / `uputstvo.html` koju kod ne ispunjava
- tiho ćutanje na neuspeh — korisnik ne vidi ni podatak ni razlog
- test koji ne može da padne, ili čuva zastarelu pretpostavku
- dva mesta koja isti broj računaju različito
- zaobilaženje autorizacije ili limita

**Nije:**
- stil, formatiranje, dužina funkcije, „moglo bi lepše"
- predlog nove funkcionalnosti
- primedba na trenersku odluku (v. „van opsega")
- nešto što je u komentaru izričito obrazloženo kao namerno — osim ako imaš
  dokaz da obrazloženje više ne važi; tada to i napiši tako

---

## IZVEŠTAJ

Napiši ga u **`IZVESTAJ-QA.md`** u korenu repozitorijuma. Bez izmena koda.

### Struktura

```markdown
# Izveštaj QA revizije — SUB-20 v<verzija>

## 1. Sažetak
Šta je pregledano, koliko nalaza po ozbiljnosti, opšta ocena u 5-10 rečenica.
Ako je nešto dobro — reci i to; izveštaj koji nabraja samo mane ne pomaže u
odlučivanju šta prvo popraviti.

## 2. Obim
Šta je pokriveno, šta je namerno izostavljeno (i zašto), šta nije stiglo.
Budi pošten: „nisam stigao" je uredan ishod, „nisam ni pokušao a ne pišem to"
nije.

## 3. Nalazi

Za svaki nalaz:

### N-<broj>: <naslov u jednoj rečenici>
- **Ozbiljnost:** kritično / visoko / srednje / nisko
- **Područje:** sinhronizacija / bezbednost / stanje / prikaz / dokumentacija / …
- **Fajl i mesto:** `app.js:1234`
- **Šta se dešava:** …
- **Kako se izaziva:** konkretan ulaz ili niz koraka
- **Zašto je pogrešno:** i na osnovu čega to tvrdiš
- **Dokaz:** komanda i izlaz
- **Predlog:** u jednoj do tri rečenice, bez pisanja koda

## 4. Sumnje
Ono što izgleda pogrešno ali nisi uspeo da dokažeš. Odvojeno od nalaza, sa
opisom šta bi bilo potrebno da se potvrdi.

## 5. Stanje postojećeg test paketa
Koliko prolazi, gde su rupe, koji testovi ne mogu da padnu, gde se testira oblik
izvornog koda umesto ponašanja.

## 6. Prilog: namerne odluke pročitane iz koda
Spisak iz faze 0. Služi da se vidi da nalazi nisu pisani mimo namere autora.
```

### Ozbiljnost — kako je dodeljuješ

| Nivo | Značenje |
|---|---|
| **Kritično** | gubitak podataka, curenje tuđih podataka, zaobiđena autorizacija, aplikacija ne radi |
| **Visoko** | pogrešan broj na osnovu kog čovek donosi odluku o treningu; tiho otkazivanje sinhronizacije |
| **Srednje** | pogrešan prikaz, nedosledna poruka, dokumentacija ne prati kod |
| **Nisko** | ivični slučaj, kozmetika sa posledicom |

Sortiraj po ozbiljnosti, ne po fajlu.

---

## Dve stvari koje ovaj repozitorijum ne oprašta

1. **Verzija.** `APP_VERSION` u `app.js` i `sw.js` moraju biti isti, a
   `CACHE` u `sw.js` prati. Ako menjaš bilo šta radi provere, vrati.

2. **Ručne migracije.** `supabase/*.sql` se pušta rukom. Kod koji koristi naziv
   koji u SQL-u ne postoji **ne puca glasno** — `limitPrekoracen` propušta poziv
   i samo upiše `[limit][ALARM]` u log. To je klasa greške koja mesecima ostaje
   nevidljiva. Proveri poklapanje u oba smera.

---

## Ton izveštaja

Piši kao inženjer koji predaje nalaz kolegi, ne kao alat koji nabraja. Kratke
rečenice. Bez uvijanja. Ako je nešto dobro rešeno, reci to jednom rečenicom i
idi dalje. Ako nešto ne znaš — napiši da ne znaš.

Ne izmišljaj nalaze da bi izveštaj izgledao vredno. **Prazan odeljak je
legitiman ishod** i vredniji je od deset izmišljenih primedbi.
