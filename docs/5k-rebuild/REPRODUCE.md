# 5K — ponavljanje provera

## 1. Identitet osnovne linije

| Polje | Vrednost |
|---|---|
| Radna grana | `claude/generator-isolation-5k-10k-hm-marathon` (po `AGENTS.md`) |
| Polazni SHA (generator) | `148c1c1a3abbb3f239efdcaa73faa4eaca08339b` |
| `origin/main` u trenutku snimanja | `05088e0440c50e866bb3bbf6246ff20fe5619f4c` (izolacija NIJE u `main`; grana je 13 commitova ispred, 0 iza) |
| Datum snimanja | 2026-10-15 |
| „Danas" u harnesu | `TODAY = 2026-10-15` (četvrtak), osim E22 (2026-10-18, nedelja) i E23 (2026-10-19, ponedeljak); `today` je argument, sat se ne čita |
| Vremenska zona | `TZ=UTC` (hash identičan i pod `TZ=Pacific/Kiritimati`) |
| Seme | nema — nema slučajnosti; profili su ručno zadati u `harness/profiles.ts` |
| Node | v22.22.0; `npm ci` u `web/` (rolldown iz `web/node_modules`) |

## 2. Generisanje referenci

Iz korena repozitorijuma, posle `npm ci --prefix web`:

```bash
TZ=UTC node docs/5k-rebuild/harness/build.mjs                 # piše docs/5k-rebuild/reference/
TZ=UTC node docs/5k-rebuild/harness/build.mjs /tmp/5k-ref     # ili u drugi direktorijum (za poređenje)
```

`build.mjs` spaja `harness/run.ts` sa produkcionim TypeScript-om (rolldown) u privremeni fajl i pokreće ga. Ništa u `web/` se ne
menja. Harnes ide istim putem kao aplikacija: stanje čarobnjaka → `toGenerationInput` → `generatorForDistance` → `generatePlan` →
`adaptGeneratedPlan` (+ `ulaz`) → `resolvePlan`/`weekPhase`/`dayLabel`/`preparationSummary`; za `dev` i probu adaptacije
`executionModel` → `buildExecutionAdjustment`. QA ulazi (`docs/qa/generator-final/inputs.json`, 5K) idu direktno u generator.

Izlaz (`reference/`):

| Fajl | Sadržaj |
|---|---|
| `index.json` | svi profili: odbijanja čarobnjaka, greška, determinizam, hash generisanog i sačuvanog plana, sažetak metrika |
| `metrics.md` | tabela istih metrika |
| `dev/D01–D17.json` | razvojni skup: ulaz čarobnjaka, ulaz generatora, kompletan generisan i sačuvan plan, analiza po nedeljama, proba adaptacije |
| `edge/E01–E29.json` | granični slučajevi (isto, bez probe adaptacije) |
| `qa/QA-U01–U03.json` | originalni 5K QA ulazi |
| `other/X10K, XHM, XM.json` | reprezentativni planovi drugih distanci (kompletan plan + hash) za proveru izolacije |

## 3. Provera determinizma i vremenske zone

```bash
TZ=UTC node docs/5k-rebuild/harness/build.mjs /tmp/ref-utc
TZ=Pacific/Kiritimati node docs/5k-rebuild/harness/build.mjs /tmp/ref-kir
python3 -c "import json;a=json.load(open('/tmp/ref-utc/index.json'))['profiles'];b=json.load(open('/tmp/ref-kir/index.json'))['profiles'];print(all(x['hash']==y['hash'] for x,y in zip(a,b)))"
```

Očekivano: `True` (proveravano 2026-10-15). Poređenje sa zapisanom referencom: isti izraz nad `docs/5k-rebuild/reference/index.json`.
Posle namerne izmene 5K: razlike po `hash` moraju biti samo u 5K profilima i objašnjene; `other/*` mora ostati isti.

## 4. Postojeće provere izolacije i ekvivalencije

Iz `web/`:

```bash
npx vitest run --project node src/domain/generators/     # 13 fajlova / 108 testova — prošlo 2026-10-15 (402 s)
npx vitest run --project ui fiveKFlow                    # aplikacioni tok 5K (nije pokretano u segmentu 1)
npm run check                                            # typecheck + lint + prettier + svi vitest (nije pokretano u segmentu 1)
```

## 5. Čitanje jednog plana

`reference/dev/D04.json` → `analysis.weeks[]` (po nedelji: obim, faza prikaza, sesije, % zona, LR, oznake dana),
`analysis.growth`, `analysis.deloads`, `analysis.adjacency`, `analysis.warnings`; kompletan plan u `plan.generated` (izlaz
generatora, `dow` 1–7) i `plan.stored` (sačuvani oblik, `dow` 0–6, ID-jevi).
