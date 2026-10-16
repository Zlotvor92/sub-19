# 5K ponovna izgradnja — stanje

Živi dokument za predaju između segmenata. Ovaj ciklus menja **isključivo 5K**.

## Segment 1/10 — osnova (završen, 2026-10-15)

| Polje | Stanje |
|---|---|
| Radna grana | `claude/generator-isolation-5k-10k-hm-marathon` (obavezna po `AGENTS.md`) |
| Polazni SHA | `148c1c1` (= `origin/…-hm-marathon`); `origin/main` = `05088e0`, grana 13 ispred / 0 iza |
| Izmene produkcionog koda | **nema** (`git status`: samo `docs/5k-rebuild/` nov, nepraćen) |
| Commit / push / PR / deploy | **nije rađeno** (po instrukciji) |
| `docs/generator-isolation/STATUS.md` | pročitan; tvrdi da je razdvajanje četiri generatora završeno (segment 5/5) |

### Da li je 5K stvarno nezavisan

**Generisanje i adaptacija plana: da.** Proveravano u kodu (uvozi iz `fiveK/` samo tipovi kroz `exchange.ts`; store-ovi zovu
generator aktivnog plana) i testovima izolacije (13 fajlova / 108 testova zeleno).

**Prikaz tempa i prijem merenja forme: ne.** Zajednički lanac forme i njegove trenerske konstante (`VDOT_ALPHA`,
`AUTO_VDOT_TOLERANCE`, pravila `classifyMeasurement`) određuju laki tempo na ekranu i tempo za vreme (F13). Faza nedelje u
prikazu je zajednička računica, ne faza 5K plana (F12). Po instrukciji: **zavisnost je dokumentovana, izdvajanje nije rađeno u
ovom segmentu** i mora prethoditi svakoj izmeni tempa ili faza.

### Isporučeno

- `FLOW.md` — stvarni tok (ulaz → … → adaptacija) i sva mesta koja menjaju istu odluku.
- `FINDINGS.md` — 25 nalaza sa dokazom, uzrokom, statusom, posledicom i segmentom.
- `ACCEPTANCE.md` — kriterijumi (tehnički, doslednost, individualizacija, smisao/progresija, opterećenje/oporavak, prikaz/podaci).
- `REPRODUCE.md` — identitet osnovne linije i komande.
- `harness/` — `profiles.ts` (17 razvojnih, 29 graničnih, 3 druge distance), `run.ts`, `build.mjs`.
- `reference/` — kompletni ulazi, planovi, analize i hash-evi (52 zapisa), `metrics.md`.

### Nije urađeno / nije poznato

- `SUB19_IZVESTAJ_40_PLANOVA(1).txt` i `SUB19_DETALJAN_PREGLED_SVIH_TRENINGA(1).txt` **nisu dostupni** (ni u jednoj grani). Njihov
  sadržaj ne znam; nalazi iz njih nisu uključeni. Ako postoje, treba ih dodati u repozitorijum i uporediti sa `reference/`.
- `npm run check`, UI testovi i E2E nisu pokretani (produkcioni kod nije menjan); pokrenuti su samo testovi generatora.
- Proba adaptacije je jedna tačka (start + 5 nedelja) i pet zapisa dnevnika; promena cilja, rekalibracija, bol, uvoz aktivnosti
  i vraćanje verzije nisu probani harnesom (pokriveni su samo postojećim testovima ekvivalencije — ponašanje, ne kvalitet).
- Harnes je van `web/` i ne prolazi `tsc`/`eslint` projekta.
- Nijedan primarni trenerski izvor nije pročitan u ovom segmentu; trenerske odluke ostaju otvorene (ispod).

## Plan segmenata i raspodela nalaza

| Seg. | Tema | Nalazi | Uslov ulaska |
|---|---|---|---|
| 2 | Završetak izolacije prikaza: forma/tempo za prikaz i prijem merenja iz 5K generatora; faza nedelje iz generatora; harnes kao automatska regresija (paritet sa `reference/`) | F13, F12 (izvor), F21 | — |
| 3 | Ulaz i opseg modela: spori rezultati (VDOT < 20), profil bez rezultata, granice čarobnjaka | F05, F22 | 2 |
| 4 | Raspored dana i nedeljna struktura: 2 dana (kolaps, nezadovoljiva pravila), podrazumevani raspored bez susednih teških dana | F01, F02, F03 | 2 |
| 5 | Obim i progresija: tačna upozorenja, delimična prva nedelja, rast, plato, lak dan posle LR | F04, F09, F10, F16, F17, F23 | 4 |
| 6 | Dugo trčanje: udeo po broju dana, plafoni, progresija | F11, F02 (deo), F23 | 4, 5 |
| 7 | Kvalitet: izbor po fazama (R/I/T/RP), doza, zagrevanje/hlađenje, jedna definicija plafona, tempo trke u sesijama | F07, F08, F14, F15 | 5 |
| 8 | Deload, taper, trkačka nedelja | F06, F24, F25, F15 (dan trke) | 7 |
| 9 | Adaptacija: signal umora bez lakih dana, gubitak kvaliteta posle smanjenja, prozor < 4 nedelje | F18, F19, F20 | 5–8 |
| 10 | Prikaz i poruke o spremnosti, završna regresija, trenerska revizija svih [R] stavki | F12 (prikaz), D5, ostatak | 2–9 |

## Odluke (prazno — popunjava se uz obrazloženje)

Potrebne pre zatvaranja odgovarajućih [O]/[R] kriterijuma: prag rasta obima (F09), udeo LR po broju dana (F11/F02), donja doza
kvaliteta i udeo zagrevanja/hlađenja (F08), da li deload nosi kvalitet (F06), prisustvo R po fazama (F07), tempo trke prema cilju
(F15), politika za rezultate van VDOT tablice (F05), šta je „pun pristup" za 5K (D5).

## Predaja segmentu 2

- **Spremnost: da**, uz uslov iz F13 — segment 2 je izdvajanje prikaza forme/tempa i izvora faze; nijedna trenerska izmena 5K
  pre toga.
- Početak: `git fetch origin claude/generator-isolation-5k-10k-hm-marathon`, proveriti da je glava i dalje `148c1c1` (ili zapisati
  razliku i ponovo snimiti `reference/`), `npm ci --prefix web`, `TZ=UTC node docs/5k-rebuild/harness/build.mjs /tmp/ref` i
  uporediti hash-eve sa `reference/index.json` (REPRODUCE §3).
- Radno stablo: `docs/5k-rebuild/` nije commitovan; commit tek na izričit zahtev, na istu granu.
