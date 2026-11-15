# P4 — 5K: doza intervala i trkačkog tempa, brži trkači

Pročitaj prvo: `AGENTS.md`, `docs/generators-v2/perfection/PROGRAM.md` (pravila za tab, „Testovi", dnevnik odluka —
pouke iz P1–P3: meri pre ugradnje, STOP sa opcijama), `reports/P0-REPORT.md` (5K kolona i „šta nedostaje"),
`docs/generators-v2/audit/coach-final/5K.md`, `web/src/domain/generators/fiveK/v2/policy.ts` (`quality`, `warmup`, `test`,
`days`, `long`), `workouts.ts` (`vdotWeekQuality`, `chooseProgressiveReps`, `qualityBudgets`), `feel.ts`, STATUS u
`docs/5k-v2/`.

Polazno (P0, planovi sa rezultatom, medijana): I najveći 11 min, R 6,4 min; najveći RP trening 2,5 km (50 % trke); budžet
udela zone drži vrh R u 88 % i RP u 96 % planova; VDOT 65 se odbija (max 60); profil korisnika (5K 20:25, 30 km, 4 dana,
8 nedelja): I 9,6 / 10 min, RP 10,3 min.

## Pravila (odluka organizatora; heuristike — tako ih označi u `policy.ts`)

**S1 — budžet I i RP.** Udeo I (iz kog ide i RP), jedan plafon, tabela po cilju nedelje: cilj < 40 km → 10 % (do sada 8 %);
cilj ≥ 40 km → 12 %. R (5 %) i T (10 %) se ne menjaju. Ostala ograničenja doze (`maxReps`, `iRepMaxSec`, trajanje T,
„≤ 1 korak nedeljno") ostaju; ako posle izmene vrh I/RP drži neko od njih u > 50 % planova, prijavi koje i koliko — ne
menjaj ga.

**S2 — brži trkači.** Gornja granica VDOT-a 60 → 70. Proveri da tempo, trajanja deonica (`iRepMaxSec`, R deonice),
WU/CD i dugi daju smislen plan na VDOT 62, 65, 68, 70 (pun ispis po jednog plana za 4 i 5 dana u izveštaj). Ako neko
pravilo daje degenerisan trening pri tim brzinama (deonica kraća od 60 s, oporavak duži od rada × 2, prazna nedelja) —
STOP sa brojevima.

**S3 — po osećaju i početnik.** Bez promene pravila. Samo instrumentiši i izmeri uzrok doze i za te planove
(`feel.ts simpleWeekQuality`) — P0 to nije uradio (40/121 plan); tabela u izveštaj.

## Očekivano (prijavi pre/posle, skriptom P0 `measure.ts 5K` + svojim mrežama)

I i RP radni minuti (prvi / najveći), najveći RP trening km i % trke, ukupno RP, % km bržih od E po fazi, nedelje > 25 %
brzih km (navedi, ne ispravljaj), uzrok vrha po zoni, profil korisnika (b) pun ispis pre/posle. Orijentir (nije prag):
profil (b) I ≥ 12 min rada u vrhu (≈ 3,0 km); najveći RP trening ≥ 3 km medijana.

## Stani i javi (`reports/P4-STOP.md`, opcije sa brojevima)

Nova odbijanja ulaza koji su davali plan; dan kvaliteta duži od dugog koji postojeća pravila ne pokrivaju; sudar sa
pravilima dužina ili „doza ne opada"; degenerisan plan na VDOT > 60.

## Obavezno

- Stalni uslovi 1–8. Izmene u `policy.ts` sa obrazloženjem, `policyVersion` naredna minor verzija. Samo `fiveK/v2/**` +
  dokumentacija; druge distance, v1 kod u `fiveK/` van `v2/`, CI fajlove i `web/scripts` ne diraj.
- Spisak promenjenih planova po klasi; sabotaže S1 (plafon 15 %) i S2 (granica 75) kroz `web/scripts/sabotage.mjs`,
  `--bail=1`.
- Testovi po odeljku „Testovi": namenski u toku rada; na kraju jednom `npm run check`, `--changed`, pun nivo samo
  `fiveK/v2`, E2E 5K. Jedan push koda na kraju (`git pull --rebase` pre push-a; uporedo radi tab u `tenK/v2`). Ako
  fikstura van foldera (npr. `byteSame` u drugoj distanci) sadrži 5K v2 tokove, snimi je ponovo i dokaži da su
  promenjeni samo 5K ključevi.
- STATUS 5K, izveštaj `docs/generators-v2/perfection/reports/P4-REPORT.md` (≤ 200 redova) sa trajanjem svake komande testa.

## Kraj

Commit + push, pa `send_message` organizatoru: SHA, izveštaj, tabela pre/posle u 6 redova, otvorena pitanja.
