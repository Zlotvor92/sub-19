# Generator: ponovna izgradnja po fazama — kontekst za sledeću sesiju

Datum: 2026-10-12. Ovo je predaja konteksta iz sesije u kojoj su stari i novi generator upoređeni. Sve što je ovde navedeno kao „činjenica” je viđeno u izlazu generatora ili u repou. Ono što je „mišljenje” ili „pretpostavka” je tako označeno. Ništa ovde nije trenerski ili medicinski validirano.

## 1. Cilj i način rada (odluka korisnika)

- Generator se pravi ispočetka, **po fazama, po distanci**: prvo **5 km**, tek kad je 5 km „kako treba” prelazi se na **10 km**, pa HM, pa maraton.
- Uzima se **dobro iz novog** (PR #32–#35, grana `fix/generator-phase3`) i **dobro iz starog** (`main`, `aea8dc6`).
- Merilo je **objektivnost za više trkača**, ne za jednog. Korisnik (cilj sub-20 na 5 km, trenutno HM 1:41:16, 5 km 20:25) je samo jedan od profila.
- Korisnička pravila: kratki direktni odgovori, bez filera, činjenice odvojene od mišljenja, „Ne znam” kad nema dokaza. O kolenu se ne govori.

## 2. Šta postoji u repou

- `main` = `aea8dc6` = **stari** generator. Putanje: `web/src/domain/training/generator/generatePlan.ts` (1095 linija), `distances/profile5k.ts` (165), `profile10k.ts`, `profile21k.ts`, `profile42k.ts`, `sessions/*` (intervali, tempo, cruise, repetitions, fartlek), `constants/heuristics.ts`, `constants/distances.ts`.
- Lanac PR-ova (svi **draft, nespojeni, ne deployovani**): #32 (faza 1) → #33 (faza 2) → #34 (faza 3, `f7bcbe9`) → #35 (QA, `2dfc2eb`, rezultati trenera još nisu gotovi). Autor je isti GitHub nalog; tekst PR-ova ne kaže koji je alat pisao #32–#35. „ChatGPT” je korisnikova tvrdnja, ne nešto što sam proverio.
- Novo u fazi 3 (činjenica iz diff-a): `distances/qualityDose.ts`, `generator/longRunProgression.ts`, `generator/athleteAssessment.ts`, `training/execution.ts` (preračun na osnovu izvedenih treninga), `adaptation/proposal.ts`, `sessions/constraints.ts`, `sessions/deload.ts`. Dodato je 1404 testa, golden mastere je trebalo osvežiti (`web/src/test/fixtures/*.json`).
- Dokumentacija novog: `docs/GENERATOR_PHASE{1,2,3}_{CHECKPOINT,CRITERIA,REVIEW}.md`, `docs/qa/generator-ab/` (10 sintetičkih profila, `raw/` ima oba plana za svaki), `docs/qa/generator-phase*/`.
- Stari kontekst: `docs/TRAINING_ENGINE_AUDIT.md`, `docs/ENGINE_CHANGES.md`, `REWRITE_REPORT.md`.
- Oprez: stari generator je bio dokazan **diferencijalnim testovima prema nasleđenom `app.js`** (golden master 2304 scenarija + 1500 nasumičnih). Promena ponašanja namerno lomi te testove; moraju se svesno osvežiti, ne zaobići.

## 3. Kako reprodukovati poređenje

- Node 22.22 radi (probe pišu za Node 24). Potreban je `registerHooks` iz `node:module` da bi `.ts` uvozi bez ekstenzije radili.
- Dva worktree-a: stari = `main`, novi = `origin/qa/generator-ab-10-users-4-coaches` (domenski kod je isti kao `fix/generator-phase3`).
- Poziv: `generatePlan(input)` iz `web/src/domain/training/generator/generatePlan.ts`. Ulaz iz probe (`docs/probes/generator-ab-qa.mjs`, `docs/qa/generator-ab/inputs.json`):
  `{startDate, raceDate, raceDistM, pb:{distM,sec,date}, weeklyKm, recentLongRunKm, consistentWeeks, breakWeeks, qualityExperience:'none'|'some'|…, runDays, quality, intensity, volIntensity, trainedRecently, goalSec, lrDow}`.
- Rezultat: `{weeks:[{w,vol,deload,focus,days:[{dow,tag,km,desc,session:{type,kind,zone,reps,repM|repSec,paceSec,…},strides,…}]}], pred, qs, meta:{vdot0,vdotGoal,predictedSec,racePace,dayWarnings,…}}` ili `{error}`.
- Skripta za dva ulaza u korisnikovom primeru je bila u scratchpadu sesije (`run.mjs`) i neće preživeti; napisati ponovo po opisu iznad.

## 4. Nalazi poređenja (činjenice iz izlaza)

Uzorak: 5 km profili U02 (PB 23:45, 30 km/ned, 4 dana, cilj 19:59) i U03 (PB 20:35, 50 km/ned, 5 dana, cilj 18:59), 16 nedelja; plus HM primer korisnika (9 nedelja).

**Novi je bolji u:**
- Početku: kvalitet uvodi fartlekom u T zoni umesto R ponavljanja; dugi trk prati skorašnje trčanje (U02: 10 km umesto 8,6 koje je bilo ispod već pređenog).
- Tempo treninga vezan za potvrđenu formu, ne za cilj.
- Kočnicama: bol, ponovljen težak lagani trk, neodrađene nedelje blokiraju brži rad; preračun ne dira već odrađene dane.
- Umerenijem rastu obima među nedeljama bez rasterećenja (6% i 5% prema 9% i 8%).
- HM dugom trku: do 17,1 km umesto stope od 14 km (ovo je za HM glavni uzrok razlike).
- Upozorenju da je isporučeni vrh obima ispod okvirne baze.

**Novi je slabiji u:**
- **Količini kvaliteta.** U03: ukupna T kilometraža 33,6 → 22,2 km, R 11,1 → 2,7 km, I 20,1 → 19,8 km. Nedelja 7: tempo 3,2 km umesto 4,8 km. HM primer, nedelje 3 i 5: 2×800 I + 2×1000 T umesto 3×800 I + 2×1600 T; RP rad u nedeljama 7–8: ~3,6 km umesto ~4 km plus 3,5 km u dugom trku.
- **Rasterećenju bez ikakvog kvaliteta** (interval se menja u lagani trk; stari je držao R 4×200, strides u oba).
- **Numeričkoj prognozi.** Novi stavlja `predictedSec` = PB (nema procene napretka). Stari je za U02 davao 22:09, za U03 19:23, za HM primer 1:37:30. Novo upozorenje ne kaže da li je cilj izvodljiv.
- **Udelu dugog trka u 5 km planu.** U03 do 32% nedelje (stari 29%). Ocena „visoko za 5 km” je mišljenje.
- **Zajedničko za oba:** obim raste bojažljivo za iskusnog (U03 vrh 1,10×–1,13× baze); rasterećenje svake 4. nedelje i u kratkom ciklusu (HM 9 nedelja: nedelja 4 pada ispod baze od 30 km).

**Ograničenje proizvoda (činjenica):** oba generatora odbijaju HM plan kraći od 10 nedelja („Manje od 10 nedelja do trke (minimum za polumaraton)”). Korisnik ima 12.10 → 13.12 = 9 nedelja. Zaobiđeno startom 05.10 (nedelja 1 nepostojeća).

**Korisnikov HM primer (za kasniju fazu HM):** 5 km 20:25 ≈ VDOT 48,6, što (Danielsove tablice, iz sećanja) sugeriše HM oko 1:34–1:35; stvarni HM 1:41:16 ≈ VDOT 44,5. Razlika od oko 7 minuta ukazuje na izdržljivost kao ograničavajući faktor. Generator uzima samo jedan PB (po distanci); to je pravi nedostatak ulaza.

## 5. Prvi princip koji korisnik traži (i koji se slaže sa nalazima)

Oba generatora daju **premalu dozu kvaliteta**. Za 5 km to znači premalo I i T rada; za duže distance (kasnije) premalo T/RP kontinuiranog tempa. Doza ne sme biti fiksni procenat; mora zavisiti od obima, iskustva, broja dana, faze i kontinuiteta. Ovo je **mišljenje trenera**, ne dokazano; zato mora ući u kriterijume (odeljak 7) i proći proveru, ne samo postojati.

## 6. Plan faza

1. **Faza 0 — okvir (jednom):** kriterijumi, profili, alat za poređenje, pravila šta je tvrd test a šta ocena trenera.
2. **Faza 5K:** vrteti petlju generiši → izmeri → oceni → popravi dok svi kriterijumi iz odeljka 7 ne prođu. Tek tada 10K.
3. **Faza 10K, HM, maraton:** isti postupak, kriterijumi se prošire. Ne prelaziti dalje dok prethodna nije zatvorena.
4. **Na kraju:** spajanje, osvežavanje golden mastera, E2E, deploy — samo na izričit zahtev korisnika.

Arhitektura za rad: domen `web/src/domain/training/` ostaje; menjati `distances/profile5k.ts`, `qualityDose.ts` (ili njegov ekvivalent) i po potrebi `allocation.ts`, `volume.ts`, `deload.ts`. Stare i nove delove porediti sesiju po sesiju, ne celokupno.

## 7. Predlog kriterijuma za 5 km (PREDLOG — korisnik odobrava)

**Profili (uzorak, ne jedan trkač):** najmanje 8–12 sintetičkih 5 km profila preko: početnik (run/walk), rekreativac 15–25 km/ned, sub-20/sub-22 rekreativac 30–40 km/ned, iskusan 50–70 km/ned, povratnik posle pauze, različiti broj dana (3, 4, 5, 6), različit broj kvaliteta (1, 2), kratki (8–10 nedelja) i dugi (16+) ciklusi. Svaki izvodi plan **i** događaje (propuštena nedelja, bol, povratak).

**Tvrde provere (programski):**
- Suma dana = nedeljni obim; sesija = km u danu (`sessKm`, `sessQKm` iz `sessions/calc.ts`).
- Najduža sesija i LR unutar granica distance; nedeljni skok među nedeljama bez rasterećenja unutar granice (parametar tek određuje korisnik).
- Zahtevni dani nisu susedni, osim izričito opravdano.
- Ne postoji NaN, prazan opis, nemoguća sesija.
- Rasterećenje i taper su prisutni i dokumentovani.

**Ocene trenera (moraju se obrazložiti brojevima, označiti kao stručna procena):**
- Doza kvaliteta (I/T/R kilometri i minuti) po profilu, posebno za ≥40 km/ned.
- Faze: ekonomija/R rano, VO2max/I kao srce, T kao potpora, oštrenje pred trku (5 km je pretežno I; tempo trke je praktično I tempo).
- Rasterećenje zadržava kratak kvalitetan dodir.
- Dugi trk kao aerobna potpora, ne specifičnost (granica u udelu).
- Prognoza: dozvoljeno „nedovoljno dokaza” umesto izmišljenog broja, ali mora reći da li je cilj izvodljiv u tom roku.
- Realnost cilja i poruka korisniku.

**Pravila nalaza:** svaki problem ima profil, nedelju/dan, očekivano i dobijeno, ponovljiv ulaz i zašto je bitno. Trenerski prigovor bez dokaza ostaje hipoteza.

## 8. Otvorene odluke za korisnika (ne pretpostavljati)

1. Granice skoka nedeljnog obima i vrha prema bazi (npr. koliki je dozvoljen porast za iskusne).
2. Da li prognoza mora da vrati broj, ili „nedovoljno dokaza” + izvodljivost.
3. Minimalan broj nedelja po distanci (sada 10 za HM; korisnik ima 9).
4. Jedan ili više PB-ova kao ulaz (npr. 5 km i HM zajedno).
5. Rasterećenje: svake 4. nedelje, adaptivno, ili preskakanje u kratkim ciklusima.
6. Šta se radi sa PR #32–#35 (ostaju kao referenca, ne spajaju se, ili se grana od njih).
7. Da li se golden master/legacy oracle testovi smeju zameniti novim kriterijumima.

## 9. Šta nije urađeno / nije poznato

- Kod `qualityDose.ts` i `generatePlan.ts` (faza 3) **nije pročitan**; zaključak „fiksni procenat” je izveden iz izlaza.
- Ocene četiri AI trenera u PR #35 nisu zaključene; nezavisne validacije nema.
- Korisnikov lični plan iz Excela (PR #31, nedelje 4–12, 16 tempo dana na 4:30/km, bez snage) nije poređen sa generatorima.
- Pretpostavke u HM primeru nisu potvrđene: najduže skorašnje trčanje 12 km, datum HM 20.9, 12 nedelja kontinuiteta, standardan tempo napretka. Potvrđeno je samo: 4 trkačka dana, 2 kvalitetna treninga.
- Ništa nije commit-ovano, ni pushovano, ni deployovano.
