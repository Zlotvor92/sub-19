# P9a — ispis planova kakav korisnik vidi (12 profila × 4 distance)

Komanda (iz `web/`):
`node ../docs/generators-v2/perfection/P9/render.ts <web koren> <izlazni folder> [5K|10K|HM|MAR]`
Primer: `node ../docs/generators-v2/perfection/P9/render.ts $PWD ../docs/generators-v2/perfection/P9/plans`
Izlaz: `P9/plans/<D>/pNN.txt`, prvi red `PLAN — <distanca> · <policyVersion>`. Ulazi: `P9/inputs.json` (iz `P7/make-inputs.ts`; isti profili i datumi; HM i 10K identični sa P8 ulazima).

Rezultat: 48 fajlova (12 po distanci), 0 odbijenih ulaza. Kod aplikacije nije menjan, testovi nisu pokretani.
policyVersion: 5K 5k-v2.15.3, 10K 10k-v2.13.0, HM hm-v2.12.0, MAR marathon-v2.12.0.

## Funkcije teksta po distanci (kako ih poziva app/plan.ts)
- 5K: `generate.generateFiveKV2`; napomene nedelje i plana sirove (generator već primenjuje `userResult`, app ih ne obrađuje); upozorenja `text.userWarnings`. Nema `userWeekNotes` ekvivalenta; ocena cilja sirova.
- 10K: `generate.generateTenKV2`; `userNotes.userWeekNotes` + `userNotes.userPlanMessages` (napomene i upozorenja zbirno, u ispisu kao „Napomena plana", odeljak upozorenja prazan) + `app/format.userText`.
- HM: `generate.generateHmV2`; `volume.userWeekNotes`, `userText.userText` (napomene, upozorenja, cilj, naslovi).
- MAR: `generate.generateMarathonV2`; nema `userWeekNotes`: filter iz app/plan.ts (`volume.technicalNote`, `volume.belowTargetShown`, `week.EASY_UNDER_NOTE`) + `app/format.userText`.

## Interne oznake (grep `\b[HMDGSNZF]\d{1,2}\b|pouk` u svim redovima)
5K 0, 10K 0, HM 0, MAR 0 pogodaka.

## Napomene
- `prettier --check` nije pokrenut: u okruženju nema `web/node_modules`.
- Lokalna grana se razišla sa originom (320/50 komita); rad i push urađeni iz zasebnog worktree-a na `origin/<grana>`, lokalna grana netaknuta.
