# QA pregled #2 — SUB-20

**Verzija:** 151 → **152**
**Testovi:** 213 → **232**
**Metod:** mašinska analiza celog koda + izvedeni scenariji (svaki nalaz ispod je **reprodukovan**, ne pretpostavljen)
**Lični plan:** nedirnut — 14 nedelja, 533,7 km, 72 treninga, PRED 25, QS 24, cilj 19:20–19:30

---

## Rezime

Prvi pregled (v139) je gledao ispravnost i bezbednost. Ovaj je gledao **šta se dešava kad nešto pođe naopako** — i tu je nađena najozbiljnija stvar do sada.

| # | Nalaz | Težina | Stanje |
|---|---|---|---|
| 1 | Oštećen lokalni zapis briše **sve** — i lokalno i na serveru, bez reči | **KRITIČNA** | popravljeno |
| 2 | Datumi iz uvezenog backupa se ne proveravaju → slomljeni grafikoni | VISOKA | popravljeno |
| 3 | `save()` puca kad je skladište puno i prekida pozivaoca | SREDNJA | popravljeno |
| 4 | Čarobnjak zaključava korak 2 **bez objašnjenja** (tekst postoji, ne prikazuje se) | SREDNJA | popravljeno |
| 5 | `fmtClock` ispisuje `-1:-1:-5` i `NaN:NaN` | NISKA | popravljeno |
| 6 | 5 dovršenih sposobnosti koje ništa ne doseže | — | prijavljeno, nadzirano |
| 7 | ~90 linija mrtvog koda | NISKA | uklonjeno |
| 8 | `requireUser` prepisan u 7 fajlova | NISKA | nadzirano testom |
| 9 | `generatePlan` — 795 linija, blok dupliran 56% | — | prijavljeno, nije dirano |

---

## 1. Oštećen lokalni zapis briše sve · KRITIČNA

**Najskuplji nalaz oba pregleda.** Nije bezbednosni propust — gori je od većine: gubitak podataka bez ijedne poruke.

### Lanac

```
loadState():  if(raw){try{ ... }catch(e){}}       ← greška se guta
              return seedState()                  ← prazno stanje

linija 1665:  let S=loadState(); save();          ← ODMAH upisuje prazno PREKO originala
                                                     sirovi bajtovi više ne postoje

sbInit():     sbDecide(SB.seenAt, remoteAt) → 'ok'  (server nije noviji)
              sbPush()                            ← prazno stanje ide na server
                                                     nestaje i poslednja kopija
```

Dovoljan je **jedan neispravan bajt**: prekinut upis, popunjena kvota, greška u budućoj migraciji šeme. Aplikacija se posle toga otvara kao da je prvi put pokrenuta.

### Reprodukovano

```
pre  (bajtova): 237
posle(bajtova): 225
Da li su originalni bajtovi još u localStorage-u?  NE — PREPISANI
Broj unosa u logu posle učitavanja: 0
Broj zapisa o kolenu: 0
Da li je korisnik išta video? alert-ova: 0 | confirm-ova: 0
```

### Ispravka — tri nivoa

1. **Sirov tekst se sklanja u zaseban ključ** (`sub19-v1-osteceno`) pre nego što išta drugo dodirne skladište. Ništa se ne prepisuje.
2. **Slanje na server se zaustavlja** dok čovek ne odluči. `sbPush()` odbija da radi dok je zastavica podignuta — serverska kopija je tada jedino mesto gde podaci još postoje.
3. **Traka pri pokretanju** kaže šta se desilo, nudi preuzimanje spašenog fajla i „Uzmi sa servera". Bez „u redu, dalje" dugmeta — jedini bezopasan izlaz je da čovek prvo skine spašeno.

Posle ispravke:

```
1. Sirovi bajtovi spašeni?        DA, svih 237
2. Sadrže li stvarne unose?       DA
3. Zastavica podignuta?           {"razlog":"Expected ',' or '}' …","bajtova":237}
4. Traka prikazana korisniku?     true
5. sbPush gura prazno na server?  NE — zaustavljeno (mrežnih poziva: 0)

kontrola: ispravno stanje se učitava normalno, bez lažne uzbune
```

---

## 2. Datumi iz uvezenog backupa se ne proveravaju · VISOKA

Bezbednosni pregled je zatvorio **ID-jeve** (`validanId`, `losIdUStanju`) i **vrednosti oporavka** (`cistWellness`, `cistVdotLog`). Polje `date` u `knee` i `kg` je ostalo neprovereno — treći ugao iste rupe.

Zapis sa `date:"abc"` prolazi kroz `migrate()` netaknut, pa `s2d()` vrati Invalid Date:

```html
<polyline points="NaN,98.0 NaN,87.0"/>
<circle cx="NaN" cy="98.0" r="3.6"/>
```

Kriva bola i kriva telesne mase se tiho slome. Nije injekcija (vrednosti se escapuju), ali jeste podatak koji aplikacija tvrdi da razume a ne razume.

**Ispravka:** `validanDatum()` + `cistDatirane()` u `migrate()`, po uzoru na postojeće funkcije čišćenja. Odbacuje i `2026-02-30` (datum koji se preliva u mart).

Zapis bez upotrebljivog datuma se **odbacuje, ne popravlja** — pogođen datum bio bi izmišljen podatak o nečijem bolu ili masi.

---

## 3. `save()` puca kad je skladište puno · SREDNJA

`localStorage.setItem` ume da baci (kvota, pregledač koji dozvoljava probni 1-bajtni upis a odbija pravi teret — a upravo tako `LS_OK` i proverava, sa jednim bajtom).

Bez hvatanja, `save()` prekida pozivaoca na pola posla — a poziva se iz **svakog** upisa u aplikaciji: završen trening, bol u kolenu, merenje mase. Čovek klikne, ništa se ne desi, i nigde ne piše zašto.

**Ispravka:** upis u `try`, pad na memoriju da rad u sesiji ne propadne, i traka koja to kaže — **jednom po sesiji**, ne pri svakom čuvanju.

---

## 4. Čarobnjak zaključava korak 2 bez objašnjenja · SREDNJA

`pbSanityOk()` gata korak 2 (`obStepValid`) i sklanja prikaz forme kad uneto vreme nije realno za izabranu distancu. Razlog se **nigde nije video** — čovek koji u polje za 5 km upiše svoje maratonsko vreme dobije mrtvo dugme „Dalje" i nijednu reč.

Tekst objašnjenja je sve vreme postojao, u `pbSanityMsg()`. Funkcija se **nikad nije pozivala**.

Ovo je bilo prijavljeno kao mrtav kod. Nije mrtav kod — mrtvo je dugme.

**Ispravka:** `pbSanityMsg()` je povezan sa upozorenjem ispod prikaza forme.

```
1:40 (prebrzo)  -> ok:false | „Vreme je brže od realnog opsega za izabranu distancu — proveri unos."
20:37 (uredno)  -> ok:true  | (bez upozorenja)
```

---

## 5. `fmtClock` ispisuje smeće · NISKA

```
fmtClock(-5)   -> "-1:-1:-5"
fmtClock(NaN)  -> "NaN:NaN"
```

`fmtTempo` je to hvatao, ali se `fmtClock` poziva i **direktno na ~18 mesta** (ciljna vremena, ose grafikona, polje za unos vremena).

**Ispravka:** zaštita u jednoj tački umesto 18 provera na pozivaocima. Vraća `—`.

---

## 6. Pet dovršenih sposobnosti koje ništa ne doseže

Otkriveno tek pošto su uklonjene mrtve `module.exports` linije — te funkcije su bile „korišćene" **samo time što su nabrojane u exportu** koji se u pregledaču nikad ne izvršava.

| Funkcija | Šta radi | Zašto je nedostupna |
|---|---|---|
| `applyEdit` | izmena pojedinačnog polja sesije (tempo, dužina ponavljanja, pauza, broj ponavljanja) | ekran „Zameni" menja samo tag/km/opis — grublji mehanizam |
| `recalibrate` | pomeranje VDOT-a ka izmerenom posle serije sesija | nema dugmeta |
| `recalibratedPlan` | ponovno računanje preostalih nedelja iz trenutne forme, uz čuvanje ručnih izmena | nema dugmeta |
| `reentryPlan` | povratak u plan posle pauze, od **stvarno ostvarenog** obima | nema dugmeta |
| `predictRange` | predikcija kao raspon (hi/lo) iz po-krug podataka | nigde se ne poziva |

To je ~200 linija dovršene, komentarisane trenerske logike. **Nisam ih obrisao** — nije greška u kodu nego nedostajuće dugme, a brisanje bi tiho uklonilo gotov posao.

Umesto toga stoje na **imenskom spisku u testu** (`NEPOVEZANO`), sa razlogom za svaku. Dva testa ga čuvaju:
- svaka **nova** mrtva funkcija pada odmah;
- spisak sme samo da se **skraćuje** — kad se nešto poveže, stavka mora da ode, inače spisak postane groblje u kom se sakrije prava nova mrtva funkcija.

**Odluka je tvoja:** povezati nešto od ovoga (to je posao za sebe, ne higijena) ili obrisati.

---

## 7. Mrtav kod — uklonjeno

| Šta | Zašto je bilo tu |
|---|---|
| `predKandidati` + `predFallbackMatch` | zamenjeno `predRaspored()`-om, stara verzija ostala |
| `workLapsDetail` | pripremljena za po-krug AI analizu koja nikad nije povezana (`/api/analyze` prima `{session, entered, trend, goalCtx, hrZones}` — po-krug podaci se ne šalju) |
| `LR_SHARE` | konstanta bez ijedne upotrebe |
| 4 × `module.exports` | iz vremena kad se generator testirao kao Node modul; u pregledaču mrtvo slovo, a testovi danas učitavaju ceo `app.js` u vm kontekst |

**Nije obrisano, nego iskorišćeno:**
- `raceDistActive()` — isti izraz je bio prepisan rukom na drugom mestu; sada se poziva funkcija.
- `CILJ` — nije bio mrtav nego obrnuto: postoji da se `19:20–19:30` ne bi ponavljalo, a ponavljalo se na tri mesta. Dva prikaza sada čitaju konstantu. **Treće mesto je unutar samog plana i nije dirano.**
- `preuzmiTekst()` — izdvojeno iz `exportBackup()` da bi i traka za oštećeno stanje mogla da ponudi fajl, umesto druge kopije iste `createObjectURL` petlje.

---

## 8. `requireUser` prepisan u 7 fajlova

Duplikat je **namerno** — Vercel funkcije bez build koraka ne razrešavaju lokalne import-e, a deploy ide preko GitHub web editora. Zajednički modul bi to pokvario. **Nisam menjao.**

Ali cena duplikata je tiho razilaženje: bezbednosna ispravka na jednom mestu ostavlja šest rupa, bez ijedne greške koja bi to prijavila.

Provereno — **provera se nije razišla**. Postoje 4 varijante, ali razlika je isključivo u povratnoj vrednosti (`userId` / `+email` / `+token`), a sama provera je bajt u bajt ista u svih 7.

Sada to čuva test: provera se poredi među svih 7, dok se povratna vrednost sme razlikovati.

---

## 9. `generatePlan` — 795 linija · prijavljeno, nije dirano

| Mera | Vrednost |
|---|---|
| funkcija u `app.js` | 345 |
| prosečna dužina | 18 linija |
| preko 100 linija | 8 |
| **`generatePlan`** | **795** |

Unutra su dve petlje za sklapanje dana **56% identične**. To je glavni strukturni dug aplikacije.

**Nisam ga dirao, i to je namerno.** Refaktor generatora je posao za sebe, sa sopstvenim testovima i sopstvenom odlukom — a ne nešto što se radi usput u higijeni. Rizik (svi generisani planovi za sve korisnike) daleko premašuje dobit od urednijeg koda.

---

## Šta je provereno i **nije** našlo problem

| Provera | Ishod |
|---|---|
| `console.log` / `debugger` / `TODO` / `FIXME` u isporučenom kodu | nema nijednog |
| duplirani `id` u `index.html` | nema |
| `<img>` bez `alt`, `<button>` u formi bez `type` | nema (nema ni `<form>`) |
| curenje slušalaca događaja | jedan jedini na `document`, vezan jednom pri pokretanju |
| `parseTimeStr` — 17 graničnih ulaza | svi ispravno (`99:99`, `12:60`, `1e3`, arapske cifre → `null`) |
| datumske pomoćne funkcije | dosledne; UTC u `nextMonday`/`mondayOfWeek` i lokalno u `s2d`/`addD` daju isti rezultat za datum-stringove |
| prazni `catch` blokovi (25) | svi na mestima gde je pad očekivan (`localStorage` u privatnom režimu, `JSON.parse` sumnjivog ulaza) — osim onog u `loadState`, v. nalaz 1 |
| lični plan posle svih izmena | nepromenjen |

---

## Provera

```bash
node --test "test/**/*.test.mjs"     # 232 testa
```

Novih 19 testova (`test/otpornost.test.mjs` + dopuna `api.test.mjs`) ne proverava „da li radi kad je sve u redu" — proverava **šta se izgubi kad nije**.

---

## Sažetak

- **5 defekata ispravljeno**, jedan od njih kritičan
- **~90 linija mrtvog koda** uklonjeno, 3 duplikata spojena
- **5 nepovezanih sposobnosti** prijavljeno i stavljeno pod nadzor umesto tihog brisanja
- **213 → 232 testa**
- **Lični plan, `LS_KEY`, `SB_KEY`, prefiks `sub19-`, Vercel / Supabase / Resend: ništa nije menjano i ništa ne treba da podešavaš**
