# Doziranje kvaliteta prema iskustvu, kontinuitetu, fazi i nedeljnom opterećenju

Baza: `fix/session-purpose` na `38ecc08` (sve tri faze generatora, finalizacija isporučenog plana i svrha pre doze). Zaključan QA: `f8cb2081ed4ba223fe7efe14a621144beb9bce0d`. Originalni generator-ab ulazi, raw/blind planovi, trenerske ocene, događaji i izveštaji nisu menjani; ni izlazi prethodnih segmenata (`docs/qa/session-purpose/`, `docs/qa/plan-finalization/`). Novi izlazi su samo u ovom direktorijumu.

## Zaključak

Iskusni trkači (potvrđeno iskustvo sa kvalitetom + ≥ 8 nedelja kontinuiteta) dobijaju zasebnu politiku doze: referenca je nominalni budžet zone samog profila distance (nikad iznad Daniels granica po treningu), prilaz 85–90 % → 100 % kroz prvih šest kvalitetnih nedelja i zaokruživanje na najbliže ponavljanje unutar plafona. Novi nedeljni omotač broji brz završetak dugog trčanja i zahtevnu dužinu. Početnik, povratnik i trkač u razvoju dobijaju **bajt-identične** planove kao pre; taper i trkačke nedelje iskusnih imaju identične sesije.

## Lanac limitera (pre)

Primer U03 W5, I sesija, nedelja 51,7 km:

| Korak | Mesto | Rezultat |
|---|---|---|
| Builder: 8 % nedelje, max 8 km | `profile5k.ts` `mkIntervals` | 4,14 km → `chooseReps` floor → 3×1200 = 3,6 km (−13 %) |
| Readiness × progres × intenzitet | `qualityDose.ts` `0,9 × (0,8 + 0,2·0,67)` | plafon 3,02 km (−16 %) |
| Floor na cela ponavljanja | `qualityDose.ts` | 2×1200 = 2,4 km (−20 %) |
| Konačni guard | `constraints.ts` 8 % isporučene nedelje | bez promene |

Ukupno 4,14 → 2,4 km (−42 %), 9,5 min I rada; isti oblik W5/W7/W11.

U05 W1: nedeljni T budžet 4,75 km deli se 60/40 (`profile10k.ts`), builder floor daje 2×1000; zatim `0,9 × 0,8 = 0,72` i ponovni floor → 2×700 m (6,4 min) + 1,2 km (5,5 min). Ukupno 2,6 km T = 5,5 % nedelje za trkača sa 24 nedelje kontinuiteta.

Uzrok nije jedan broj, nego množenje četiri nezavisno konzervativna koraka, od kojih su dva zaokruživanje naniže.

## Promena ponašanja

1. **Iskusni, sesije sa ponavljanjima u T/I/R** (`qualityDose.ts` `experiencedDose`): referenca = `min(nominalni budžet profila, Daniels limit zone) × udeo deljenog dana`. Doza = referenca × (0,85 pri 8–15 nedelja, 0,9 pri 16+, linearno do 1,0 posle šest kvalitetnih nedelja). Broj ponavljanja je najbliži cilju, ali nikad iznad plafona. Pragovska ponavljanja mogu se produžiti do 1600 m kada dva ponavljanja ne iskorišćavaju udeo (U05 W1 2×1000 → 2×1300). I deonice ostaju 60–300 s.
2. **Iskusni, kontinuirani tempo, progresivni, fartlek, piramida, RP i M**: referenca je količina koju je builder namerno izabrao (npr. 5K oštrenje 3 km praga, RP serija). Uklanja se samo dodatni rez 0,9 i floor; ne rastu iznad buildera. Piramide se samo skraćuju.
3. **Vremenski plafon po sesiji, iskusni**: 15 → 22 min (T × 1,25), umesto 0,9 × 12 → 20 min. `kons` = 0,8 × referenca; `agr` preskače rampu, ali ne prelazi plafon.
4. **Nedeljni omotač** (`generator/weeklyLoad.ts`, samo iskusni): 13 % nedeljnog vremena trčanja u T-ili-brže radu; M minuti računaju se upola; dugo trčanje ≥ 90 min smanjuje omotač za 10 %. Brz završetak LR-a ulazi u zbir. Višak se skida prvo sa opšteg T/I/R rada, pa sa specifičnog; sesija bez smislene doze postaje lak dan. Omotač koristi istu realnu nedelju kao i doziranje sesija.
5. **Taper i trka**: obe taper nedelje i trkačka nedelja koriste prethodnu dozu, bez omotača. Deload pravilo je nepromenjeno (≤ 60 % poslednjeg rada), pa deload prati novu veličinu rada.
6. `zoneBudgetKm` u `constraints.ts` je jedini izvor plafona zone za doziranje i konačni guard.

## Izvori i interne heuristike

Primarni izvori (pristup 12.10.2026):

- V.O2 / Daniels, *How to effectively improve your VO2max* — I sesija „up to 8 % of your weekly mileage”, deonice 1–5 min (idealno 3–5), oporavak jednak ili nešto kraći od rada; primer 30 mi/ned → 5×800 m: https://news.vdoto2.com/2025/07/how-to-effectively-improve-your-vo2max/
- B.A.A. 5K Training — Level 2 W1: 3×(4×1 min @ 5K) + 5×3 min @ 10K; Level 3 W1: 2×(3×3 min @ 5K) + 5×4 min @ 10K: https://www.baa.org/races/boston-5k/info-for-athletes/boston-5k-training/
- B.A.A. 10K Training — Level 3 (40+ mi/ned): W3 5–6×800 @ 10K + 20 min @ HM tempu; W10 4–6×1000 @ 10K: https://www.baa.org/races/boston-10k/info-for-athletes/b-a-a-10k-training/
- B.A.A. Half Training — Level 3 ima odvojene intervale, simulacije sa tempom trke i lake dužine; sajt ne daje formulu nedeljnog opterećenja: https://www.baa.org/races/boston-half/info-for-athletes/boston-half-training/
- Bosquet i sar. 2007 (meta-analiza tapera, citirana u 5K pregledu QA): smanjenje obima uz održan intenzitet — razlog da taper ostane netaknut.

Nisu ponovo provereni u ovom segmentu: T ≤ 10 % i R ≤ 5 % po treningu (postojeće granice koda pripisane Danielsu; vdoto2 stranica Training Definitions vratila je 403).

Interne heuristike, bez objavljenog praga: 0,85/0,9 početni udeo i granica 16 nedelja; 15 → 22 min plafon; 1600 m najduže T ponavljanje pri re-fit-u; omotač 13 %; težina M = 0,5; 90 min kao zahtevna dužina (već korišćen prag goriva za HM u aplikaciji) i 10 % smanjenje. Kalibrisane su na redove veličine iz izvora gore, nisu fiziološki zakon.

## Pre / posle — ključne nedelje

Minuti = vreme rada u T/I/R/RP/M zoni (bez zagrevanja i pauza). Kompletni nizovi: `summary.json`.

### U03 — iskusan 5K, 50 km, 24 nedelje

| Nedelja | Pre | Posle | Pre min | Posle min |
|---|---|---|---:|---:|
| W1 | I 2×1000 + T 2×1500 | I 3×1000 + T 2×1600 | 21,1 | 25,9 |
| W2 | I 3×800 + T 2×1600 | I 5×800 + T 2×1600 | 23,5 | 29,8 |
| W3 | R 7×300 + T 2×1600 | R 9×300 + T 3×1600 | 22,0 | 31,3 |
| W5 | I 2×1200 + T 2×1600 | I 3×1200 + T 3×1600 | 23,5 | 35,3 |
| W7/W11 | I 2×1200 + T 2×1600 | I 3×1200 + T 3×1600 | 23,5 | 35,3 |
| W9 | piramida 300–1000 + T 2×1600 | piramida 400–1200 + T 3×1600 | 25,9 | 35,3 |
| W13 | RP 3×1000 / 90 s + T 2,7 km | RP 4×1000 / 90 s + T 3,0 km | 24,2 | 29,6 |
| W14 | I 6×600 + T 2,7 km | I 7×600 + T 3,0 km | 26,1 | 29,7 |
| W15 taper | RP 3×400 + T 2,6 km | isto | 16,3 | 16,3 |
| W4/W8/W12 deload | bez kvaliteta | isto | 0 | 0 |

Oblik: uvod 26 → 30 → 31 min, održavanje 31–35 min (omotač zaustavlja dalji rast pri ~52–57 km), oštrenje ~30 min sa RP, taper 16 min. Stari ponovljeni blok I od ~8–10 min više ne postoji.

### U05 — iskusan 10K, 45 km, 24 nedelje

| Nedelja | Pre | Posle | Pre min | Posle min |
|---|---|---|---:|---:|
| W1 | T 2×700 + T 1,2 km | T 2×1300 + T 1,6 km | 12,0 | 19,3 |
| W2 | I 2×1000 + T 3,2 km | I 3×1000 + T 4,3 km | 23,0 | 32,2 |
| W3 | T 2×1000 + T 2×700 | T 2×1400 + T 2×1000 | 15,6 | 22,1 |
| W5 | I 2×1200 + T 2×1600 | I 3×1200 + T 2×1900 | 24,7 | 32,4 |
| W7 | I 2×1200 + T 2×1800 | I 3×1200 + T 2×2000 | 26,5 | 33,3 |
| W11 | I 2×1200 + T 2×2000 | I 4×1200 + T 2×2000 | 28,4 | 38,3 |
| W13 | RP 3×1200 / 60 s + progresivno | RP 4×1200 / 60 s + progresivno | 34,1 | 41,8 |
| W14 | RP 2×1600 / 75 s + T 4,8 km | RP 3×1600 / 75 s + T 5,0 km | 36,5 | 44,6 |
| W15 taper | RP 2×600 + T 3,3 km | isto | 20,6 | 20,6 |

W1 dva T treninga od 6,4 i 5,5 min postaju 12,0 i 7,4 min, a zbir i dalje ostaje u jednom nedeljnom T budžetu od 10 % (60/40). RP serija W13/W14 vraća builderovu veličinu (4×1200, 3×1600), uz nepromenjen oporavak 60/75 s.

### U08 i U10 (iskusni HM/maraton) — sporedni efekat iste politike

- U08: W1 14,9 → 22,8 min; W7 28,8 → 36,1. Nedelje sa brzim završetkom 5,5 km @ RP: W9 42,8 → 41,9 (RP 2×2000 → 2×1900, omotač broji završetak), W11 42,8 → 44,6. Taper W12/W13 i trka identični.
- U10: W1 23,7 → 32,9; vrh 40,1 → 49,4 min, od čega M 21,9 min (M blok 3,3 → 4,1 km). W15 sa 9,2 km @ M završetkom: I 2×1100 → 3×1100; težinski zbir 39,4 min ispod omotača 52,9. Taper sesije identične; taper lagani/LR km +2–3 % jer se taper meri od isporučenog vrha (79,8 → 81,7 km).

## Očuvanje

- U01, U02, U04, U06, U07, U09: SHA-256 celog plana jednak prethodnom segmentu (proverava proba i `qualityDose.protection.node.test.ts`).
- U03/U05/U08/U10: sesije taper i trkačke nedelje jednake prethodnom segmentu (hash test).
- Zamenu budućih dana i dalje radi postojeći replan/finalize tok; završeni treninzi, stvarni km/min, efektivni datumi, ručne izmene i merom zaključani treninzi ostaju netaknuti — `finalize.node.test.ts` koristi iskusan HM ulaz i prolazi sa novom dozom (7,23 km / 2501 s, measured lock, ručno zaključan opis, premeštanje u prošlost, JSON restore). Browser tok (apply → reload → unos stvarnih km/min → restore → reload) prolazi za svih deset profila sa novim izlazima.

## Provere

- `node docs/probes/quality-dose.mjs`: deset QA ulaza + mreža 360 iskusnih scenarija (4 distance × 5 obima × 3 broja dana × 8/24 nedelje × kons/std/agr), 6.120 nedelja, 9.248 sesija; 0 prekoračenja plafona zone, 0 I deonica van 60–300 s. Najveći odnos opterećenja i omotača merenog na isporučenoj nedelji: 1,039 (doziranje koristi raspodeljenu nedelju, završni guard je može malo smanjiti).
- Prosek iste mreže, pre → posle (minuti brzog rada po normalnoj nedelji): 5K 23,8 → 27,9; 10K 26,1 → 30,5; HM 26,6 → 30,3; maraton 29,4 → 35,9. Poslednja taper nedelja: 16,6 / 20,0 / 29,9 / 29,2 → 16,6 / 20,0 / 29,9 / 29,3. Najveći nedeljni udeo (sirovi minuti / vreme pri 5:30/km) pada za 5K/10K/HM (0,138/0,150/0,144 → 0,130/0,130/0,124), jer omotač sada broji nagomilane nedelje.
- Lokalno: strict TypeScript, lint, format, build; 1.446 frontend/domain/oracle/node testova u 136 datoteka (+17 novih); 396 backend testova. Browser: ceo E2E 73/76 u prvom prolazu; dva generator-ab pada (U08/U10) nastala su jer je server izgrađen pre poslednje taper izmene, a fixture posle — ponovljeno nad konačnim kodom 10/10. `pwa.spec.ts` pada naizmenično sa `--workers=2` i na baznom `38ecc08` (2/2 pada), a prolazi 2/2 sa `--workers=1` na ovoj grani; nije vezano za generator. `supabase/tests` nije pokrenut lokalno.
- Generator fingerprint (2.304) i seeded differential (1.500) **nisu promenjeni**: njihovi ulazi nemaju `qualityExperience`, pa nijedan scenario nije „experienced”. To je razlog nove mreže, ne dokaz da iskusni planovi nisu menjani.

## Promene očekivanja postojećih testova

- `prescription.test.ts` (RP oporavak): `reps 3 → 4`. RP 6×1200 @ 4:30 kod iskusnog u W10: stari plafon 0,9 × 20 min = 4,0 km → 3 ponavljanja; novi 22 min = 4,9 km → 4. Oporavak (predmet testa) ostaje 60/75/90/180 s.
- `qualityDose.test.ts` (intenzitet): strogo `kons < std < agr` sada se proverava za trkača u razvoju (nepromenjena politika). Za iskusnog `std` je referentna doza, pa je `agr = std` posle rampe; oba ≤ 8 % nedelje.
- `cutover.node.test.ts`: dodat izuzetak automatskog deploy-a za `fix/quality-dose`, kao za `fix/session-purpose`.
- `generator-ab-users.spec.ts`: očekivani plan čita `docs/qa/quality-dose/UXX.json`; ulazi čarobnjaka i provere očuvanja isti.

## Ograničenja

- Nema novih slepih trenerskih ocena; ovo je tehnička before/after provera. Konačne minute, procente i omotač treba potvrditi sa ljudskim trenerom na primerima.
- Omotač je samo za iskusne. Trkači u razvoju zadržavaju postojeće plafone po sesiji (8 → 16 min); brz završetak i zahtevna dužina kod njih ne smanjuju dodatno rad (nemaju brze završetke; po sesiji su već konzervativni).
- U03 plato W5–W11 (35 min) dolazi iz omotača pri ravnom obimu; nema dodatne progresije gustine (npr. kraći oporavak) — namerno, bez izvora za takvo pravilo.
- U10 kontinuirani prag 5,5 km (27,5 min) je unutar postojećeg `tempoMaxSec` 35 min, ali duži od klasičnih 20 min tempa; nije menjan maratonski plafon.
- `consistentWeeks` > 16 je jedini signal dužeg kontinuiteta; godine treninga, PB istorija i tolerancija napora nisu ulazi.
- Interval/fartlek/piramida oblik i izbor familije sesija po fazi nisu menjani.
