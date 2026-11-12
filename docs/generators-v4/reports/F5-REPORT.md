# F5 — adapteri: postojeći planovi → `PlanDoc` (izveštaj)

Kod: `web/src/domain/v4/adapters/` (`read.ts` uski tipovi „ono što čitam", `shared.ts` razrešavanje i sastavljanje,
`legacy.ts`, `v2.ts`, `personal.ts`, `detect.ts` → `adopt`, `fingerprintLegacy.ts`, `stimuli.ts` tabela, `index.ts`).
Kod adaptera uvozi samo `adapters/` i `engine/` (test `isolation.test.ts`); motor, `fitness/`, `distances/`, aplikaciju
i bazu nisam dirao. Uzorci: `adapters/fixtures/` (opis snimanja `capture.md`).

## Rezultat [visoka — izmereno testom]

- **32 uzorka, 3467 dana: otisak pre = posle u 32/32 (100 %, nijedan red razlike).** 12 planova starog formata
  (5 bez `athlete` / 7 sa njim; sve 4 distance; `runWalk`, `strides`, `mlr`, `km: null`, sesije int/tempo/fartlek/
  piramida/prog), 8 v2 (po 2 po distanci), lični plan; svaki sa praznim stanjem + 11 izmišljenih stanja (4 stari
  format, 4 v2, 3 lični plan) sa 158 trčanja, 14 ručnih dana, primerom SPEC § 12 (c).
- Nezavisna provera: `domain/plan/resolve.ts` (samo u testu) dan po dan — datum, odmor, km do metra, opis — isto za
  svih 3467 dana. Sabotaža (ignorisano pomeranje; ignorisan km izmene) obara 4, odnosno 3 testa.
- Posle preuzimanja `deriveEvents → []`, `replan → changes: []` i isti objekat; sutradan, kad trkač odradi
  planirano, opet `[]`. Lični plan: `protected`, `replan` na bol/pauzu/umor/promenu cilja vraća isti objekat; čuvar
  nad svim preuzetim planovima daje samo `rucno`. Ulaz duboko zamrznut — adapter ga ne menja; 13 neispravnih ulaza →
  `{ error }` bez izuzetka. Ceo `src/domain/v4`: 13 fajlova, 386 testova, ~5 s.

## Šta se ne prenosi verno i kako je sačuvano

1. **Koraci su tumačenje, tekst je doslovan.** `structure` (v2) i `session` (stari) → koraci dužinom; zbir dužina =
   stari km do metra (razlika ide u hlađenje). Stara sesija ne kaže dužinu oporavka (samo `restSec`): oporavak dobija
   ostatak km dana, `restSec` ostaje u `legacy.session`. Fartlek (`repSec`) → dužina iz tempa deonice; piramida (niz
   `reps`) → niz deonica. Dana bez koraka iz strukture: 0 (polje `fallbackDays` ih broji).
2. **Dan snage** (`tag: snaga`, bez km): `kind: 'other'`, `steps: []`, `extras: ['snaga']` — otisak „trening 0,0".
   Dan trčanja bez km: `steps: []`, `legacy.km = null`. Oba čuvar vidi kao `prazan` → `rucno`.
3. **`mlr`** (srednje dugo radnim danom) → `kind: 'easy'` + `extras` (jedan dugi po nedelji za motor).
4. **Polja nivoa plana i nedelje** (`meta`, `pred`, `qs`, izlazi v2, `focus`, `deload`, `planRevisions`,
   `goalChange`…) nemaju mesto u `PlanDoc` → `adopt(...).carried` doslovno. Polja dana → `PlanDay.legacy`
   (`session`, `structure`, `strides`, `runWalk`, `finish`, `alt`, `move`, nepoznato); `finish`/`planRevisions`/
   `goalChange` nema u zamrznutim fiksturama — provereno na izmenjenom uzorku.
5. **`log.lock`** u aplikaciji znači „ručno ispravljen unos, Strava ga ne prepisuje", ne „zaključan trening". Prenet
   kao `PlanDay.locked` po SPEC § 9.1 (bezopasno: takav dan je skoro uvek urađen) — F9 da odluči.
6. **Trajanje**: urađeno bez `sec` i trčanja van plana (`vanPlana` čuva samo km) dobijaju trajanje iz laganog tempa
   forme plana, `source: 'procena'` (6 od 158). `laps` aplikacije su samo radni krugovi → dodat krug `other` sa
   ostatkom, da opterećenje bude celo. `vanPlana` i `vanPlanaV2` mogu nositi isto trčanje dvaput (ne spajam).
7. **Forma u zaglavlju**: VDOT iz `meta.trainingVdot` → `vdot` → `vdot0`, pouzdanost srednja, raspon = tačka; živu
   procenu daje `fitness/`. Nepotpune nedelje (5 u uzorcima) ostaju nepotpune — dodat dan bi promenio otisak.
8. **`intent`** (§ 9.3): `kind` iz trke/`taper`/`deload`, inače `build` (v2 `VRHUNAC` nije `peak`); `phase` iz
   `weeks[].phase` ili `nepoznata`; `loadPct`, `long.lenPct` kao udeo najvećeg; `decisions` iz plana (WU/CD iz prve
   strukture, inače 15/10 min — izbor [srednja]).

## Tabela preslikavanja (`stimuli.ts`, podatak)

| stari dan                                                                                                     | namera                            | `hm` (provereno nad `distances/hm`) |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------- |
| `tempo`/`int`, zona rada T (ili `tempo` bez zone)                                                             | prag                              | `prag`                              |
| zona I (ili `int` bez zone) / R                                                                               | intervali / brzina                | `intervali` / `brzina`              |
| zona RP, M, MP / `purpose: activation`                                                                        | tempo-trke / oštrenje             | `tempo-trke` / `ostrenje`           |
| `lr` bez rada / sa radom RP·M·MP / sesija `prog`                                                              | dugi / dugi-rp / dugi-progresivno | isto ime                            |
| `lako` sa ubrzanjima                                                                                          | ubrzanja                          | `ubrzanja`                          |
| `test`                                                                                                        | kontrola                          | `kontrola`                          |
| `trka`, `snaga`, `rw`, `lako`                                                                                 | — (nije podražaj)                 | —                                   |
| `fivek`/`tenk`/`marathon` su privremeno iste oznake (id-jevi po imenima foldera iz PLAN.md, [niska] dok F7 ne |
| isporuči podatke); kad stignu, test tabele se proširi i neslaganje se ispravlja u tabeli, ne u kodu.          |

## Šta aplikacija mora da prosledi (F9)

`adopt(stanje, today)`: `today` po Beogradu; `stanje` = `{ genPlan, log, alts, moves, vanPlana, vanPlanaV2?, knee? }`
iz `user_state.data` (adapter sam prepozna format). Vlasnik bez `genPlan`: `genPlan = personalPlan(
personalBaselineVdot(log))`. `carried` čuvati uz dokument dok motor nema polje za njega. Za formu: trajanje (i po km)
za trčanja van plana — danas ga aplikacija ne čuva (F0 O2).

## Zahtevi prema motoru (ne menjam `engine/`)

1. **Dan bez trčanja** (`kind: 'other'`, `steps: []`) `deriveEvents` broji kao planiran trening: svaki dan snage bez
   upisa posle preuzimanja postaje `missed` i ulazi u izvedenu pauzu (≥ 2 „planirana" u 3 dana). Predlog:
   `isPlanned` = trening sa bar jednim korakom.
2. `PlanHeader.legacy?: Record<string, JsonValue>` (opciono, bez promene verzije) — da `carried` putuje u dokumentu.
3. Izveden `fatigue` odmah posle preuzimanja ličnog plana (stanje sa rupom u istoriji okt.: `acute/chronic ≥ 1,5`).
   Na zaštićenom planu bez posledica; uslov iz § 14.6 (7 dana ≥ 1,2 × B) treba da ga ukloni — proveriti posle drugog
   kruga. Na ostalim uzorcima nema izvedenih događaja.
4. Potvrditi `DistanceData.id` za 5K, 10K i maraton (`fivek`, `tenk`, `marathon`?).
