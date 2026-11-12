# F4 — forma iz trčanja: izveštaj (12. 11. 2026)

Kod: `web/src/domain/v4/fitness/` (`estimate.ts`, `constants.ts`, `explain.ts`, `types.ts`, `index.ts`). Iz motora
uvozi samo `engine/types.ts`, `vdot.ts`, `constants.ts`; motor nije menjan. Testovi: 27 u 3 fajla, ≈ 0,5 s
(`npx vitest run src/domain/v4/fitness`). `estimateForm` je proveren kao `EstimateFormFn` (tip u `index.ts`).

## Konačni brojevi (`fitness/constants.ts`)
| šta | broj | pouzdanost |
|---|---|---|
| plafon `r` / `G_max`: < 1 god. ili početnik · 1–3 · > 3 · nepoznato | 0,20/4,0 · 0,13/2,5 · 0,07/1,5 · 0,10/2,0 (trener, § 14.6) | niska–srednja |
| bez dokaza kvaliteta u 12 ned. istorije | `r × 1,25`, `G_max + 0,5` | niska |
| očekivano = tekuća + udeo × G | **0,65** (SPEC 0,6; trener 0,6–0,65 → gornja, § 14.3) | niska |
| negativan split (1. polovina sporija ≥ 3 %) | + 0,5 × (VDOT druge polovine na celu dužinu − VDOT rezultata), najviše + 1,0 | niska |
| toplo (≥ 20 °C) | vreme se ne preračunava; rezultat ne spušta procenu koja ima osnov | srednja (smer) / niska (prag) |
| sam izveden prekid = pauza | tek od 14 dana bez ijednog zapisanog trčanja | niska |
| ostalo (k, kvalitet, puls, pauza, σ, f_v, f_p, W) | doslovno § 7.2–7.5 | kao SPEC |

## Izvori i provera
- Toplota: Ely i sar. 2007 (Med Sci Sports Exerc 39:487–493) — vreme maratona raste kako WBGT prelazi ~5–10 °C;
  Vihma 2010 (Int J Biometeorol, doi 10.1007/s00484-009-0280-x) — temperatura je glavni činilac vremena, sporiji
  trkači gube više. [visoka da toplota usporava, posebno sporije] Tačan procenat po stepenu za rekreativca na
  polumaratonu nisam našao u proverljivom obliku → **ne izmišljam koeficijent**; toplota samo menja smer dokaza.
- Plafon napretka: nisam našao studiju sa procentom napretka rekreativaca za 16–18 nedelja koju bih mogao da
  proverim (pregled iz 2024. o ~10 nedelja treninga ne daje brojeve u izvodu). Zato ostaju trenerovi brojevi
  (`coach/SPEC-REVIEW.md` § 2c: 3–5 % za 1–3 god.), a naviše ide samo udeo očekivanog (0,6 → 0,65).
  [niska–srednja] Važnije od broja: raspon se pomera sa svakom trkom/testom (k 0,7 / 0,5).

## Trka vlasnika, 3. 10. 2026 (polumaraton 1:42:01, 26 °C)
- VDOT rezultata 44,09. Prva polovina ≈ 3128 s, druga ≈ 2988 s → negativan split 4,7 % (poslednji km 4:17).
  Druga polovina „na celu dužinu" = VDOT ≈ 45,4. Usvaja se polovina razlike: **+0,67 → 44,76 (≈ 1:40:42)**.
- Tumačenje [niska]: rezultat potcenjuje formu i zbog raspodele (rezerva u prvoj polovini) i zbog toplote; stvarna
  forma za polumaraton na ~10–15 °C je verovatno 1:39–1:41. Uračunat je samo deo koji se meri iz same trke (split);
  toplota nije uračunata u broj jer nema proverenog koeficijenta. Odluka: korigovati oprezno, samo split.
- Zašto ne cela druga polovina: druga polovina trčana na odmornim nogama posle sporog početka nije održiva na
  21 km; pola razlike je oprezno i ograničeno na 1,0 VDOT.

## Šta procena kaže za vlasnika (`owner.test.ts`, profil prazan, staž nepoznat)
| trenutak | procena | raspon na dan trke (najbrže – očekivano – najsporije) |
|---|---|---|
| polazno (27. 9, iz laganih trčanja) | 45,57, niska — besmisleno kao forma, odmah ga zamenjuje trka | — |
| 3. 10. posle trke | **44,76 (1:40:42), visoka** | HM 13. 12: 1:38:32 – 1:39:35 – 1:41:11 (G 0,9) |
| danas 12. 11. | **44,76 (1:40:42), visoka** (do 14. 11, pa srednja) | HM 13. 12: **1:39:39 – 1:40:20 – 1:41:11** (G 0,3) |
| danas → HM 17. 4. 2027, bez plana | isto | **1:37:15 – 1:38:44 – 1:41:11** (G 1,6) |
| danas → HM 17. 4. 2027, obim +30 % | isto | 1:36:41 – 1:38:21 – 1:41:11 (G 1,92) |

**Nedovoljno podataka** za sve posle trke: 5 trčanja posle 3. 10, nijedno nema krugove rada ni zonu dana (signal
kvaliteta nema ulaz), a nema 4 nedelje sa ≥ 2 ravnomerna lagana trčanja ≥ 25 min (trend pulsa nema ulaz). Zato
procena danas = trka. Prekidi 4–13. 10. i 24. 10 – 2. 11. nisu računati kao pauza (< 14 dana, nisu prijavljeni; u
bazi postoje 3 trčanja van plana samo sa km). Ako je vlasnik stvarno pauzirao, procena bi bila ≈ 1,5 % niža po
prekidu. Za 17. 4. ako je cilj maraton: isti model, druga `distanceM`; nije računato jer cilj nije potvrđen.

## Odstupanja od SPEC-a (najmanja odluka, u duhu § 7)
1. Kvalitet: nedovršen trening (rad < 90 %) ne podiže procenu ni kad su deonice brze (dokaz ≤ stara).
2. Trend pulsa: dokaz se meri od procene na kraju prve dve nedelje trenda (isti trend se ne broji dvaput); računa se
   nedeljom i danas, najviše jednom u 14 dana; za pouzdanost vredi kao jedan dokaz kvaliteta (§ 2.4 „bez pulsa niža
   pouzdanost").
3. Pauza: prijavljene + sam izveden prekid ≥ 14 dana (tekući do juče); primenjuje se dan posle kraja.
4. Polazna tačka bez izjave: medijana tempa trčanja ≥ 25 min iz prve 4 nedelje kao 70 % VO2max (ne 66 %).
5. Bez plana (`planned = null`): `f_v = 1`. Nedelje do trke = ceo broj nedelja (`floor`).
6. Toplo: rezultat ne spušta procenu samo kad pouzdanost nije niska (sa niskom k = 1 važi rezultat).
7. `start` = polazna tačka (izjava / trčanja / podrazumevano), ne stanje posle prve trke.

## Šta treba preneti u tipove motora (`engine/types.ts`)
- `Run.planned?: { zone: ZoneId; workSec: Seconds }` — zona i zadat rad dana (bez toga § 7.3 nema ulaz; buildState
  ili adapter ga popunjava iz plana po `dayId`).
- `Run.tempC?: number` — temperatura (Strava/sat; aplikacija je već čuva, LOG F0).
- `RunnerFacts.pauses` treba da nosi i pauze izvedene iz plana (§ 2.3), jer `fitness/` plan ne vidi.

## Ponašanje na izmišljenim nizovima (testovi)
- Napredak 0,1 VDOT/ned., jedan prag nedeljno: procena raste (> 45,4 posle 12 ned. uz stvarnih 46,2), nikad iznad
  stvarne + 0,15; kašnjenje ≈ 1 VDOT je posledica `k = 0,1` (ravnoteža = stopa / k po treningu). [visoka, račun]
- Stagnacija: procena ± 0,15, 0 promena tempa. Šum ± 3 %: ≤ 2 promene tempa po histerezi § 7.6 u 12 ned.
