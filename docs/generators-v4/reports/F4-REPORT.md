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

## Krug 2 (R12–R14, 12. 11. 2026) — `2d5c95c`
Testovi: 36 u `fitness/` (+9 u `round2.test.ts`); `fitness + engine + adapters + distances` 458/458 zeleno, ≈ 9 s.
- **R12 odrađen plan je dokaz.** Svakog dana u 16 nedelja pred trku `G/7` (bez `f_p`) × pridržavanje se pripisuje
  tekućoj proceni sa udelom 0,65; isti iznos se oduzima od preostalog plafona (`G = min(r·f_v·f_p·W, G_max − pripisano)`,
  `W` neprekidno). Pridržavanje = opterećenje poslednjih 7 dana / planirano; ≥ 0,85 pun iznos, < 0,6 ništa. Posle
  trke/testa pripisivanje kreće iznova. Jedna rečenica nedeljno („odrađena po planu…" ili „odrađena oko X %…
  očekivano vreme oko N s sporije"), pa svaka promena očekivanog vremena ima objašnjenje. [srednja oblik, niska brojevi]
  Scenariji (lokalno, ispisi nisu menjani): S21 1:39:42 → **1:39:49** (+7 s; ranije 1:40:35), S22 +1 s, S23 +1 s,
  S24 −30 s; raspon uži. **S09 i dalje +43 s** (1:39:42 → 1:40:25): bez nedeljnih ciljeva plana „planirano" je
  7 × najveća baza u 6 nedelja, pa se sužavanje broji kao manjak → treba `planned.weeks` (ispod).
- **R13 pad baze.** Baza ≤ 70 % baze od pre 42 dana → −1 % +5 % po jedinici odnosa ispod 0,7, najviše −3 %; nedeljom i
  danas; samo uz ≥ 42 dana istorije i bez pauze u prozoru; ne sabira se, vraća se na nulu kad baza poraste ili stigne
  rezultat. [niska — smanjen obim uz zadržan intenzitet dugo čuva formu, pa je pad namerno blag]
- **R14.** Prvi rezultat U APLIKACIJI i trka sa hodanjem (neki km > 1,25 × medijane km) → pouzdanost najviše srednja.
  Trka sa hodanjem se ne koriguje (split). Rezultat bez ranijeg osnova (samo lagani tempo/trčanja) usvaja se ceo (k 1).
  Svaka korekcija ima rečenicu: split („1:42:01 se računa kao 1:40:42"), delimično usvajanje („Usvaja se 70 %
  razlike, jer…"), toplota. S19 sada: 2:09:34 sa rečenicom o 70 %, pouzdanost srednja; hodanje se u S19 NE vidi —
  trčanje nema km (v. ispod).

**Vlasnik (krug 2):** posle trke 44,76 (1:40:42), **srednja** (prvi rezultat u aplikaciji). Danas **44,29 (1:41:37)**:
R13 — poslednjih 6 nedelja ≈ 68 % ranije baze → −1,1 %. Nedelje posle trke su odrađene 0–48 % → nema pripisivanja.
HM 13. 12: **1:39:59 – 1:41:11 – 1:42:37**; HM 17. 4. 2027: 1:37:41 – 1:39:39 – 1:42:39 (obim +30 %: 1:37:06 –
1:39:15). Nedovoljno podataka: „ranija baza" je samo nedelja 27. 9 – 3. 10. sa trkom; 3 trčanja van plana nemaju
trajanje (ako ih adapter preda sa `source: 'procena'`, ulaze u bazu, pad bi bio manji).

**Šta treba od motora (ne menjam `engine/`):**
1. `planned` iz postojećeg plana: `baseLoad`/`peakLoad` iz `doc.header.decisions` (ne preračunato iz današnje baze —
   inače `f_v` pada kako baza raste i očekivano se pomera bez događaja) i `weeks: [{ start, targetLoad }]` iz
   `doc.weeks` (tip `FitnessPlanned` u `fitness/types.ts`; bez toga sužavanje izgleda kao manjak, S09).
2. `FormChange.signal`: dodati `'plan'` (odrađen plan) i `'baza'` (pad baze); sada nose `'kvalitet'` i `'pauza'`.
3. Hodanje u trci: `Run.splits` za trku ili polje `Run.walked?: boolean` (scenario S19 nema ni jedno).
4. Dnevna opterećenja: `fitness/load.ts` je prepisana formula `engine/load.ts` (`runLoad`, `rollDay`); bolje da motor
   preda dnevna opterećenja u `facts` ili da `runLoad` pređe u fajl koji `fitness/` sme da uvozi.
