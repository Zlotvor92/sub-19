# K4 — 5K: krug 4, stavka B (kratak lagan dan) — izveštaj

11. 11. 2026 (Europe/Belgrade). Polazni SHA `e5589d2` (5k-v2.16.0) → **5k-v2.17.0** (`KNOWN_VERSIONS` ∪ v2.16.0). Brief
        `briefs/K4-krug-4.md` § K4-B, način rada `briefs/K3-krug-3.md`. Merenje (iz `web/`): `node ../docs/generators-v2/perfection/K4-5K/measure.ts <oznaka>`
        (mreža 5K = P0 + final-check, 3 964 plana; `cmp pre K4`; `prof K4`), `python3 K4-5K/sum.py pre K4`. Nova odbijanja: 0.

| pravilo               | stanje                                 | mesto u kodu                                                                                                                                                                                                                                                                                         | mreža (pre → posle)                                                                                                                                                                                                                                                                   | 12 profila                                                                                                                                                |
| --------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K4-B kratak lagan dan | ugrađeno (`540d54b`, odluka `ac47c35`) | `week.shortEasyWeeks` (jedino mesto; `easy.shortEasy` 30 min / > 2 ned), `shortRestNote`, `SHORT_REST_PLAN_NOTE`; dužine `lengths.weekLengths` (`drop`); `generate.construct` (nepokretna tačka; adaptacija prenosi odluku); validator EASY_REST / SHORT_REST, PLANNED_BELOW_TARGET bez K4-B nedelja | planovi sa > 2 ned. lagan < 30 min 983 → 767; pravilo u 278 planova (R 5 d 173, F 5 d 105), 1 455 nedelja; lagan u njima medijana 6,3 km (4,3–8,8); planirano < cilj u svih 278 (zbir 3 835 km), upozorenja po nedelji 0; vrh cilja −10 %: 0; planirani vrh −10 %: 0 (najviše −9,1 %) | p06: ned 2–4 subota „odmor ili 20 min lagano po želji", 4 treninga, dugi isti, planirano 27,0 → 22,8 / 29,1 → 25,6 / 31,4 → 30,3 km; ostalih 11 bajt-isto |

Oblik: postojeći T1 `easyRest` („lagan dan manje" — dan nestaje iz plana, ekran ga prikazuje kao odmor; ništa van foldera
distance). Dan odmora bira postojeći red (`restOrder`: dan uz dugi, pa poslednji lagan). Vraćeno: **početnik** (B 4 d:
planirani vrh −10 % u 38 / 296 = 12,8 % planova > prag 10 % → prethodno ponašanje; B 3 d nema dva lagana dana).
Tumačenja: (T1) „nedelja izgradnje" = ne-rasteretna baza / vrhunac / oštrenje bez ograničenja adaptacije, sa danom
kvaliteta i bar dva lagana dana; dugi ostaje kakav je bio (uz polazni broj laganih). (T2) Odluka se čita iz plana bez
pravila; generator ponavlja sastav dok se skup ne ustali (unija). (T3) Adaptacija ne odlučuje iznova — prenosi nedelje
K4-B prethodnog plana (poznato unapred, uslov 4); prvi pokušaj (nova odluka u adaptaciji) pao je na punom nivou: 08g
„bez promene" ≠ generator (2 plana × 2 toka), pa seed + unija → 08j idempotentnost (8 tokova).

Testovi: nov `k4.node.test.ts` (nezavisna invarijanta nad `earlyGridInputs`: K4-B samo u planu sa > 2 takve nedelje, ne
početnik, dan manje, planirano ≤ cilj bez upozorenja, rečenica plana; plan bez pravila ima ≤ 2 kratke nedelje; p06).
Usklađeno (samo ono što pravilo menja): segment02/03/05/05b (nedelja K4-B bez PLANNED_BELOW_TARGET), `testInputs.markP8`
(verzija), app/adapt, app/app, app/handoffTarget, `features/onboarding/fiveKV2Flow.test.tsx` (verzija). Sabotaže
`K4-5K/sabotage.json` 3/3 palo (`--bail=1`), `src` bajt-isti.

## Otvoreno

1. **Nepokriveno: 3 dana (R 138, F 115, B 76) i 4 dana (R 168, F 131, B 76)** — jedan lagan dan u nedelji; dan manje bi
   bio jedini lagan dan (kao MAR Otvoreno 4).
2. **5 dana i posle pravila (R 44, F 19)**: preostali lagan i dalje < 30 min jer ga granica 0,70 × dugi ne pušta (p06 ned 2
   22 min, ned 3 26 min); manjak ide u planirano < cilj. Opcija: dva dana manje u tim nedeljama (menja šablon) ili viša
   granica laganog za klasu malog obima.
3. **Adaptacija ne dodaje K4-B** novim kratkim nedeljama (npr. posle smanjenja obima) i sačuvan plan 5k-v2.16.0 ga ne
   dobija pri prilagođavanju; nova odluka u adaptaciji traži odluku nezavisnu od upisane istorije.

## Testovi na kraju (iz `web/`, 11. 11. 2026, Europe/Belgrade)

Brz nivo `fiveK/v2` posle svakog commita zelen (35 / 809). `TEST_FULL=1 … fiveK/v2`: prvi prolaz 2 crvena (T3), posle
ispravke 45 / 819 zeleno (5 min 18 s). `--changed e5589d2` 98 / 1 384 (verzija u `fiveKV2Flow.test.tsx` usklađena); E2E
`fivek-v2.spec.ts` 3/3 (26 s); `npm run check` 305 / 3 413 zeleno (8 min 40 s). Ispis `P9/plans/5K/` (12).
