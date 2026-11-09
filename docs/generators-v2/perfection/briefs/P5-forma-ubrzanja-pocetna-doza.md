# P5 — po distanci: tačka merenja forme, kvalitet u adaptaciji, ubrzanja, početna doza

Jedan zadatak, izvodi se zasebno za svaku distancu (tab dobija svoju distancu `<D>` i radi SAMO u `generators/<D>/v2/**`).
Sve izmene distance idu u jedan segment da pun nivo te distance trči jednom.

Pročitaj prvo: `AGENTS.md`, `docs/generators-v2/perfection/PROGRAM.md` (pravila za tab, „Testovi", dnevnik odluka),
`reports/P0-REPORT.md` (M1, M2, M5, M6, M9 za tvoju distancu), izveštaj P1–P4 tvoje distance (`reports/P<n>-REPORT.md`),
`v2/policy.ts` i STATUS tvoje distance.

Polazno (P0): plan sa rezultatom nema nijednu tačku merenja forme i tempo se ne menja; RPE i izvršenje kvalitetnog
treninga nemaju efekat u adaptaciji (sve 4); 10K/HM/maraton nemaju ubrzanja na laganim danima; prvi T trening ≈ 9–12 min
rada (12–16 % trajanja dana).

## Pravila (odluka organizatora; heuristike — tako ih označi u `policy.ts`)

**F1 — kontrolni test u planu sa rezultatom.** Plan sa rezultatom (ne početnik) i ukupno ≥ 12 nedelja (5K: ≥ 10) dobija
tačno jedan test: isti test koji distanca već ima za plan po osećaju (ista dužina, WU/CD, pravila obima i doze,
tumačenja rasterećenja), u poslednjoj ne-rasteretnoj nedelji faze razvoja (5K: faze pre oštrenja), na danu Q1 umesto
tog kvaliteta. Progresija slota se posle testa nastavlja od stanja pre testa (kao u planu po osećaju). Kraći planovi i
početnik: bez testa. Rezultat testa ulazi postojećim putem adaptacije (nov rezultat → tempo od sledeće nedelje); ništa
novo u adaptaciji za to. Napomena nedelje korisniku: čemu test služi i da rezultat unese.

**F2 — kvalitet u adaptaciji (nov korak, ID po obrascu distance).** Činjenice: zapisi dana čija je uloga u planu
kvalitet (Q1, Q2, dugi sa blokom gde postoji; ne test). Okidač: dva uzastopna takva dana (po datumu, oba u poslednjih 14
dana do asOf, potpuno pokrivena) od kojih je svaki ili neodrađen (`completed` false / bez zapisa uz pokrivenost) ili sa
RPE ≥ 9. Efekat: sledeća nedelja izgradnje ne podiže dozu nijednog slota (ponavlja poslednju dozu, druga struktura
dozvoljena); cilj obima se ne menja; razlog u `reasons` + poruka korisniku („poslednja dva zahtevna treninga su bila
preteška ili preskočena — doza ove nedelje ne raste; ako tempo deluje pretežak, unesi nov rezultat ili uradi test").
Prioritet: ispod bola, pauze, umora i manjka izvršenja (ako je neki od njih aktivan za obim/kvalitet, F2 se beleži kao
`applied: false`). Ne ponavlja se za iste zapise. Taper i trkačka nedelja: bez efekta. „Doza ne opada" ostaje.

**F3 — ubrzanja na laganom danu (10K, HM, maraton; 5K ih već ima — preskoči F3).** U svakoj nedelji izgradnje i tapera
(ne trkačka nedelja — tamo postoji dan pred trku; ne uvod početnika; ne dani sa ograničenjem „bez kvaliteta i
ubrzanja") tačno jedan lagan dan dobija ubrzanja na kraju: baza 4 × 20 s, od razvoja nadalje 6 × 20 s; početnik
4 × 20 s od prve nedelje posle uvoda. Koji dan: lagan dan sa najvećim razmakom (u danima) od prethodnog zahtevnog dana
(kvalitet, dugi, test); pri jednakom razmaku raniji. Dužina dana ostaje ona koju daje vlasnik dužina (ubrzanja su deo
laganog trčanja, ne dodatni km i ne „rad" zone; ista struktura kao postojeći dan pred trku). Nedelja bez laganog dana:
bez ubrzanja.

**F4 — početna doza T i I (10K, HM, maraton; 5K ima drugu arhitekturu — preskoči F4).** Početni nivo T (kontinuirano i
cruise) i I: najviši nivo lestvice ≤ 80 % plafona zone (do sada 60 %), najmanje prvi nivo. R i RP/MP ostaju 60 %.
Početnik: bez promene (prvi nivo). Sva ostala pravila progresije ostaju.

## Redosled rada

1. Sve četiri izmene prvo na patch-u; izmeri mrežom P0 (`P0/measure.ts <D>`) i svojim mrežama: odbijanja, invarijante,
   metrike. Tek ako nema sudara — ugradi.
2. Očekivane metrike pre/posle: testova po planu (po dužini pripreme), nedelja od testa do trke; T i I radni minuti prve
   nedelje i udeo rada prvog kvalitetnog dana; laganih dana sa ubrzanjima po planu; % km bržih od E po fazi; nedelje
   > 25 % brzih km; kapacitet/vrh obima (da li F4 menja ciljeve); za F2 mreža tokova adaptacije (okidač u nedelji baze,
   razvoja, specifične; sa i bez drugog aktivnog uslova).

## Stani i javi (`reports/P5-<D>-STOP.md`, opcije sa brojevima)

Nova odbijanja ulaza koji su davali plan; sudar F1 sa pravilima testa/rasterećenja/dužina koji postojeća tumačenja ne
rešavaju; F4 spušta izvodljivost (nedelja 1 ispod obima, WEEK_FITTED raste > 5 % planova); F2 daje odbijanje u tokovima
adaptacije; bilo koji sudar sa „dan kvaliteta ≤ dugi".

## Obavezno

- Stalni uslovi 1–8. Novi redovi u `policy.ts` (pravilo, mesto, obrazloženje „heuristika, odluka organizatora P5"),
  naredna minor `policyVersion`. Samo `generators/<D>/v2/**` + dokumentacija. v1, druge distance, CI fajlove,
  `web/scripts`, `select.ts` ne diraj (uporedo radi V1b na zajedničkom kodu i testovima — ako ti rebase da sukob u test
  fajlu v2/app zbog uvoza v1, zadrži njegovu verziju uvoza i svoju izmenu sadržaja).
- Prikaz: `v2/app/` mora ispravno da prikaže test u planu sa rezultatom, dan sa ubrzanjima i poruku F2; bez internih
  oznaka u tekstu korisnika.
- Spisak promenjenih planova po klasi (F1/F3/F4 menjaju skoro sve planove — nova bazna linija po postojećem obrascu, uz
  dokaz po klasi na uzorku: nedelja bez F1/F3/F4 uticaja ostaje bajt-ista).
- Sabotaže za F1–F4 kroz `web/scripts/sabotage.mjs`, `--bail=1`.
- Testovi po odeljku „Testovi": namenski u toku rada; na kraju jednom `npm run check`, `--changed`, pun nivo samo svog
  foldera, E2E svoje distance. Jedan push koda na kraju (`git pull --rebase` pre push-a). Fikstura van foldera koja
  sadrži tokove tvoje distance (`byteSame`): snimi ponovo, dokaži da su promenjeni samo ključevi tvoje distance.
- STATUS distance, izveštaj `docs/generators-v2/perfection/reports/P5-<D>-REPORT.md` (≤ 200 redova) sa ispisom profila (a)
  pre/posle i trajanjem svake komande testa.

## Kraj

Commit + push, pa `send_message` organizatoru: SHA, izveštaj, tabela pre/posle, otvorena pitanja. Ako alat traži dozvolu
koju niko ne može da da, ne čekaj — izveštaj u repou je dovoljan.
