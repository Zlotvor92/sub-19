# W1 — HM: plan za bilo koji broj nedelja, uz upozorenje (hm-v2.14.0 → hm-v2.15.0)

Brief: `briefs/W1-bilo-koja-duzina-plana.md`. Granice HM: MIN 10 (početnik 12), MAX 20, tehnička granica 52. Pre W1
svaki N van [MIN, MAX] je bio odbijanje (PLAN_TOO_SHORT / BEGINNER_SHORT / PLAN_TOO_LONG); posle W1 nijedan do 52.

## Pravila (svako zaseban commit, zelen brz nivo)

- **W1-A kratak plan** (a596a31). Jedno mesto: `periodize.layoutOf` (konstruktor, validator, adaptacija). Faze =
  poslednjih N nedelja rasporeda od MIN; rasterećenje po položaju, osim u nedeljama 1–2 (traži prethodnu izgradnju).
  Uvod početnika: samo nedelje uvoda koje postoje (`withIntro`: 11 ned → 1, ≤ 10 → 0). Obim/doze unapred po
  postojećim pravilima; test samo po G7. Taper bez izgradnje: osnova = trenutni obim, ne ispod minimuma H15 (oba
  slučaja su ranije bila odbijanje). Provere za ono što postoji: WEEK1_BELOW_START samo kad je ned 1 ne-rasteretna
  izgradnja; pretraga H5 ne važi za odsečen raspored (DELOAD_SCHEDULE proverava položaje). Plan nosi `layout`.
- **W1-B dug plan** (4315fb5). K = N − 20 nedelja `prep` (baza, bez kvaliteta kao uvod, ubrzanja na jednom laganom
  danu, cilj = trenutni obim, rasterećenje 4, 8, … × 0,8) + standardni plan od 20 nedelja pomeren za K. Priprema ne
  menja osnov rasta ni vrh: ciljevi nedelja K+1… = plan od 20 nedelja (test). H5 standardnog dela kao segment od K+1;
  nov start (A12) ukida pripremu. N > 52 → PLAN_TOO_LONG „najviše 52 nedelje".
- **W1-C upozorenje** (55430d1). `periodize.lengthWarning` — jedno upozorenje PLAN_LENGTH (plan.warnings) + ista
  rečenica u napomeni plana (aplikacija ih spaja bez ponavljanja); padeži broja nedelja; napomena početnika ostaje.
  Kratak plan bez LONG_RUN_SHORT (upozorenje dužine ga pokriva). Napomene pripreme bez internih oznaka.
- **W1-D adaptacija i prenos** (8f96326). Raspored je činjenica upisanog plana: `HmV2Plan.layout` → `Written.layout`
  → `layoutOf(…, fact)`; validator adaptiranog plana čita isto (test: plan sa činjenicom MIN 12 se adaptira po njoj).
  `adaptInvariants` radi i za plan bez tapera (N = 1).

## Merenja

| mreža | planova | odbijanja pre | odbijanja posle | padovi validatora | prekršaji invarijanti |
| --- | --- | --- | --- | --- | --- |
| generisanje N ∈ {1, 2, 3, 9}, 3–6 dana × obim reda korak 5 × VDOT/lagan × 3 rasporeda + početnik | 3696 | 3696 | 0 | 0 | 0 (uslov 8, `w1Invariants`) |
| generisanje N ∈ {21, 28, 52}, isti profili | 2772 | 2772 | 0 | 0 | 0 |
| kontrola N ∈ {10, 20} | 1848 | 0 | 0 | 0 | 0 |
| W1-D adaptacija: N ∈ {1, 2, 3, 9, 11 poč., 21, 28, 52} × osnovni profili (288) × do 4 asOf × 9 scenarija | 8208 | — | 0 | 0 | 0 (`adaptInvariants`) |

Odbijanja iz DRUGIH razloga u ovim mrežama: 0 (mreže su bez `recentLongRunKm`; RECENT_LONG_* i ostala ulazna
odbijanja se ne diraju). Predaja: `app/handoffTarget` M3 (maraton → HM, kasna < 10 i rana > 20 nedelja) — 0
odbijanja adaptacije; razlog „prekratak" više ne postoji. Kao izvor plan W1 ne šalje politiku (test).
Bajt-isto za N ∈ [MIN, MAX]: bazne linije i heševi mreža (pun nivo) zeleni; P9 (12 profila) — razlika samo u redu
verzije.

## Testovi

`w1.node.test.ts` (mreže W1-A/B u brzom nivou, W1-D uzorak / pun uz TEST_FULL), `input`, `policy`, `app` (verzija,
KNOWN_VERSIONS + hm-v2.14.0, kratak plan nije degenerisan ulaz), E2E `hm-v2.spec.ts` „W1: kratak plan (6 nedelja)"
(plan se pravi, upozorenje u „Na šta da paziš"). Sabotaže `docs/testing/sabotage-W1-HM.json`: 4/4 pale.
Pun nivo halfMarathon/v2, `--changed 2677bbd`, E2E i `npm run check`: § Završne provere.

## Otvoreno (bez novog trenerskog pravila — za trenera)

1. W1-B: rasterećenja pripreme se broje od početka (4, 8, …). Kad K nije deljivo sa 4, poslednje 1–3 nedelje
   pripreme + prve 3 standardnog dela = do 6 uzastopnih ne-rasteretnih nedelja (priprema je ravan obim). Opcija:
   brojati od kraja pripreme (rasterećenje u nedelji K) — novo pravilo, nije uvedeno.
2. W1-A: u kratkom planu niz izgradnje sme biti duži od 3 (npr. N = 6: 4 nedelje bez rasterećenja, jer ono iz
   rasporeda od 10 pada u ned 1). Pretraga H5 se ne primenjuje na odsečen raspored (brief: „na ono što postoji").
3. W1-A: prva nedelja kratkog plana kreće u fazi odsečenog rasporeda (N = 6: razvoj, I 3 km + T 4 km na početnom
   nivou lestvice F4). Blaži ulaz (npr. prva nedelja lakša) bi bio novo pravilo.
4. Početnik, dug plan: uvod (ned 1–2) pada u pripremu; standardni deo počinje kvalitetom u nedelji K+1 (bez
   ponovljenog uvoda). Kratak početnik: uvod otpada po briefu (10 ned i kraće — bez uvoda).
5. Van foldera ništa nije menjano. `app/generate.ts PRODUCT.minWeeks` (10) ostaje opis proizvoda; čarobnjak ne
   blokira kratak rok (E2E).

## Završne provere

(dopuna posle punog nivoa)
