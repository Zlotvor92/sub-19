# 5K v2 — Segment 08l (5k-v2.10.4): broj nedelje u porukama jezgra na planu cilja predaje (3i za 5K)

Polazni SHA `43930f3` (posle 08k). Grana `claude/generator-isolation-5k-10k-hm-marathon`. Menjano `fiveK/v2/**`,
`docs/5k-v2/**`; izuzeci kao 08i (redovi „5K v2" u byteSame, oznaka u `fiveKV2Flow.test.tsx`). Bez PR-a, mergea, deploya.
Obrazac 3i (10K/HM) kopiran, ne uvezen. `docs/generators-v2/handoff/SEGMENT-3i-IMPLEMENTATION.md` u trenutku rada NIJE na
grani — ime polja `weekOffset` treba uskladiti kad 3i za 10K/HM stigne (ako se razlikuje).

## 1. Problem i odluka

Plan cilja predaje (`app/handoffTarget.ts`) nosi nedelje izvora ispred (prefiks `offset`), pa je nedelja v2 `i` u
kalendaru nedelja `offset + i`. Poruke jezgra (napomene, upozorenja, razlozi adaptacije, odbijanja) brojale su od 1:
„Trka 5K 23:00: VDOT 42.3 od nedelje 3" na planu čija je to kalendarska nedelja 6.

| mesto | izmena |
|---|---|
| `types.ts`, `input.ts` | ulaz jezgra `weekOffset?` (ceo broj 0–52; izostavljen kad je 0 — ulaz i plan bez pomaka bajt-isti) |
| `input.weekLabel(n, offset)` | JEDINA funkcija za broj nedelje u poruci (`n + offset`) |
| `steps.ts` | `Athlete.weekOffset` iz ulaza (za poruke konstruktora/validatora) |
| poruke kroz `weekLabel` | `week.ts` (2 + trkačka nedelja), `feel.ts` (početnik), `generate.ts` (kontrolno trčanje, početnik), `adapt.ts` (Odluka 9; bol), `assess.ts` (rezultat, umor ×2, manjak, višak, bol), `validate.ts` (TEST_WEEK, QUALITY_REPEAT), `runWalkAssess.ts`, `runWalkAdapt.ts`, `runWalkValidate.ts` (4) |
| `app/handoffTarget.ts` | `targetInput(…, prefix.offset)` → ulaz cilja nosi `weekOffset` = broj nedelja prefiksa (sačuvan u planu) |
| `app/adapt.ts` | adaptacija čita `plan.input.weekOffset`; sačuvan plan cilja iz 2.9.0–2.10.3 (prefiks bez polja) dobija pomak iz prefiksa (`withWeekOffset`) — pregled i promena cilja |
| `app/form.ts` | „tempo od nedelje N" čita isti pomak (`input.weekOffset`, inače prefiks) kroz `weekLabel` — nema duplog sabiranja |

Jedan vlasnik: pomak određuje samo predaja (broj nedelja prefiksa); jezgro ga samo prikazuje. Raspored, km, dani i
odluke ne zavise od pomaka (dokaz §3).

## 2. Merenje (`artifacts/segment-08l/review3d-5K.measure.ts`, obrazac REVIEW-3 eksp. D)

HM v2 (uzorak R 60 / F 30 / B 10) → pauza 35 d → ponuda kraće → 5K v2 cilj sa prefiksom → trka 5 km posle predaje →
pregled (razlozi) + Forma (oznaka).

| | 43930f3 | 08l |
|---|---|---|
| planova cilja / prilagođeno | 56 / 56 | 56 / 56 |
| razlozi pregleda sa brojem nedelje | 112 | 112 |
| **reasonMismatch** (broj van kalendarskih nedelja cilja) | **112** | **0** |
| labelMismatch (Forma „tempo od nedelje N") | 0 (3h) | 0 |

Izlazi: `review3d-5K-43930f3.json`, `review3d-5K-08l.json`.

## 3. Bez pomaka bajt-isto

- Generator, rana mreža 3 816 ulaza, prema 43930f3 (bez oznake verzije): **0 razlika**.
- Heš regresije (scratchpad `hash.ts`, M = 16; `final-check/lib.ts` 5K, svi scenariji + lanac): 148 163 reda (generate + adapt; uzorak lib-a je veći od ranijih 99 069) prema 43930f3: **0 promena** (ciljevi 0, km naviše 0, odbijanja 0).
- `segment08l` (3): ulaz sa `weekOffset: 0` → isti JSON kao bez polja; plan bez pomaka nema polje.

## 4. Test (`segment08l.node.test.ts`; brz 4 plana, pun 11; pun ~39 s)

Nezavisno od konstrukcije: isti ulaz i iste činjenice sa pomakom 7 i bez njega (generate + adaptacija, rana mreža asOf ×
17 scenarija) → svaka poruka sa pomakom = poruka bez pomaka u kojoj je svaki broj posle „nedelja/nedelje/nedelji…"
uvećan za 7 (km, „12 nedelja", „1 kvalitet" isključeni). Na 43930f3 pada (poruke bez pomaka, npr. „Posle nedelje 1 rast
kreće od 70%…" umesto „nedelje 8"). `app/handoffTarget.node.test.ts`: ulaz cilja nosi `weekOffset` = `prefix.offset`, svi
brojevi nedelje u napomenama/upozorenjima u offset + 1 … offset + N.

## 5. Sabotaže (`sabotage-08l.json`)

| # | sabotaža | ishod | prvi pali test |
|---|---|---|---|
| 1 | poruka rezultata (`assess`, „VDOT … od nedelje N") mimo `weekLabel` | PAO | `segment08l` mreža |
| 2 | napomena kontrolnog trčanja (`generate`) mimo `weekLabel` | PAO | `segment08l` mreža |
| 3 | predaja ne prenosi pomak u ulaz jezgra (`handoffTarget`) | PAO | `handoffTarget` 3d tok |

3/3 PALO; stanje `src` isto (`sabotage-08l-result.json`).

## 6. Komande (iz `web/`)

| komanda | rezultat |
|---|---|
| `npx tsc -b --noEmit`, `npx eslint`, `npx prettier --check .` | exit 0 |
| `npm run check` | exit 0 — 316 / 3638, 647 s |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/fiveK/v2` | 38 / 726, 375 s |
| `TEST_FULL=1 npx vitest run --changed 43930f3` (pun, posle svih izmena) | 198 / 1940, 927 s |
| `npx playwright test e2e/fivek-v2.spec.ts` | 3 / 3 |
| `segment08l` na 43930f3 | pada (2 / 3: `weekLabel` ne postoji; poruke bez pomaka) |
| byteSame 10K/HM/maraton | samo redovi „5K v2" (oznaka; sa privremenim 5k-v2.10.3 i starim snimkom prolaze 6 / 6) |

## 7. Stalni uslovi (AGENTS.md 1–8)

1. Jedan vlasnik pomaka — predaja (prefiks); jezgro samo formatira (`weekLabel`), forma čita isti broj. 2–3. Plafoni i
WU/CD nedirnuti. 4. Adaptacija čita pomak iz plana (činjenica, ne politika). 5. Kao cilj prima činjenicu (broj nedelja
prefiksa), ne politiku izvora. 6. `5k-v2.10.4`; KNOWN_VERSIONS ∪ 5k-v2.10.3. 7. Izolacija prolazi (bez novih uvoza van
foldera). 8. Planovi bez pomaka bajt-isti; trajne mreže 08g–08k nedirnute.
