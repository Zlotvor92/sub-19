# Radne odluke organizatora (dubinska provera)

## 1a coach-5k-10k (9ea1a91) — PROVERENO: ponovo pokrenuto note-mixed.ts i measure.ts 5K → bajt-isto; flows=ok (0 throw, 0 odbijanja); kod week.ts:146-155 + written.ts:56-60 potvrđuje uzrok M2.
- 5K napomena „planirano X km < cilj" ≠ planirano (1 114/5 170 tokova): ISPRAVITI (pogrešan broj korisniku) → 5K.
- 5K „Rasterećenje:" u nedelji koja nije rasterećenje (2 221/5 170): ISPRAVITI (K, kontradikcija) → 5K.
- 5K formatiranje (decimalna tačka, 2 decimale, „240 s"): ISPRAVITI (K) → 5K; proveriti druge distance (ugao 5).
- lagan = dugi (10K 28 %, 5K 17 %), lagan < 20 min: ČEKA ugao 5 / 1b (isto pravilo u HM/MAR?) pa odluka.
- 10K oštrenje WU/CD 40 min u trkačkoj: kandidat ISPRAVITI (T) → 10K; čeka ugao 5 (HM/MAR oštrenje).
- pauza 35 (10K, 5K): poznata klasa N5 — odluka zajedno sa N5.
- profil korisnika (tanak VO2/RP, rasterećenje u ned 4/8, taper 2 ned): mišljenje — razmotriti uz ugao 5 (doza I, taper 5K).
- RW L12 plato; početnik test u ned 4: T mišljenje, nisko.

## 6 app (7b3d2dd) — PROVERENO čitanjem koda
- A1 MAR v2 početnik 45 km → predaja HM/10K v2: cilj nasleđuje beginner (hm handoffTarget.ts ~:94 `experience: trainedRecently===false ? 'beginner'`), HM input.ts:205-209 WEEKLY_KM_TOO_HIGH sa porukom „uz ovaj obim plan bez oznake početnika" → nijedna opcija. REALAN tok → B. ISPRAVITI: cilj predaje (HM, 10K; proveriti 5K) — početnik iznad maksimuma tabele početnika → plan bez oznake početnika (kako poruka kaže). Test: MAR početnik 45 km → HM/10K ponuda postoji.
- A2 HM week.ts:730 „nedelja ${frame.index}" bez weekOffset (uvod H17) — K; po odluci 3i relativni položaji ostaju v2, ALI na ekranu meša „nedelja 1 od 2" i „Dugi nedelje 3" → ispraviti tekst da ne liči na broj nedelje kalendara (npr. „uvod: 1. od 2 nedelje") — K, uz HM/10K paket.
- A3 MAR→5K nije u aplikaciji: po dizajnu (DESIGN P1: maraton → HM, 10K, kao v1). Ispraviti FINAL-2026-10-23.md formulaciju (domen, ne tok aplikacije) — dok.
- A4 MAR po osećaju, rođen < 26 km: bez ponude — po dizajnu (shorter.ts), zabeleženo.
- A5 „traži 2.4 VDOT" tačka — K, uz paket formatiranja (sve distance).
- A6 HM ekran dana: „..", interne oznake (H17, pouka 28) u tekstu korisniku — K, ISPRAVITI (interne oznake ne idu korisniku) → proveriti sve distance (ugao 5).

## 5 consistency (1984eca) — PROVERENO: organizer/verify-c1-c7.ts (C1 72/648 isto; C7 5K+HM rez. RESULT_DISTANCE_UNSUPPORTED, 10K+MAR rez. ok=false, 10K+HM ok); kod: 5K periodize.ts:54-65, input.ts:150-156 (vdot.min 30), assess.ts:403-410, handoffTarget.ts:91.
- C7 cilj predaje 5K/10K odbija rezultat HM/MAR izvora: REALAN tok (trkač HM sa HM rezultatom) → B. ISPRAVITI: cilj sam filtrira — rezultat nepodržane distance → bez rezultata (po osećaju / lak tempo izvora), uslov 5. → 5K, 10K. Meriti mrežom predaje sa HM/MAR rezultatom.
- C1 5K početnik rasterećenje u ned 2 (72/648): ISPRAVITI (pouka 4 važi i za 5K) → 5K periodize.
- C8 5K rezultat VDOT < 30 → odbijanje (sa porukom); ostale → po osećaju: ISPRAVITI (spor realan trkač, 5K = najčešći cilj početnika) → 5K: VDOT < min → po osećaju.
- C2 5K umor: zapis bez dayId uparen po datumu (komentar kaže „van plana = lagan"): u aplikaciji bez dayId su samo nevezana trčanja (odmor, van datuma, zagrevanje uz trku) → uticaj mali; ISPRAVITI radi jedne definicije (jeftino) → 5K.
- C3 (test otpada u mešovitoj 5K/10K), C5 (redosled pouke 30 u 5K), C6 (progresija doze posle bola 10K/MAR), C11, C12, C14: čitanje koda, nemereno → za odluku posle ugla 3 (lanci); skupljam u paket „usklađivanje pravila", T.
- C4 urađen dan posle asOf: upisani (10K, HM) vs planirani (5K, MAR, MASTER): T; odluka: MASTER pouka 37 (planirani) — uskladiti 10K/HM? čeka ugao 3 (da li utiče na tokove).
- C9 MIXED_OVER_TARGET suprotno značenje: K, uskladiti kodove (pažnja: merne skripte zavise od kodova).
- C10 HM assess.ts:451 sirov broj nedelje → wl(f): K, ISPRAVITI uz A2.
- C13 5K početnik po osećaju dobija kontrolno 3 km test: T — odluka: početnik nema test (pouka 13) → ukloniti ili zapisati; predlog ukloniti.
- C15/C16 poruke F1–F21: paket „poruke" (zarez, interne oznake, množina) — K; F7/F15/F16 T pogledati.
- POSLE-MERGE a) drugo rasterećenje istog cilja posle umora u rasterećenju: PRIHVATITI, zapisati u MASTER (pouka 36 dopuna), ukloniti iz „nalaza".
- POSLE-MERGE b) prag viška: kvalitet otpada samo zbog SAMOG upisanog viška (over120). ODLUKA: kvalitet ne otpada radi upisanog viška kad planirano sa zadržanim kvalitetom ≤ 1,10 × cilj (uz MIXED upozorenje) — u sve 4 (pouka 37 dopuna). Mišljenje/trenerska odluka organizatora.
- POSLE-MERGE c) plafon dostignut tačno (=), nikad prekoračen: dodati test granice r-d3-6w-25km-v45-0 Δ8 + sabotaža `<` → 5K paket.
- POSLE-MERGE d) plauzibilnost: L1 (najduži > nedeljni obim) i L2 (najduži < obim/dani) su logika → HM/MAR ulaz: L1 odbiti sa porukom; L2: NE odbijati automatski (najduži < prosek je moguć kod trkača sa jednakim treninzima?) — L2 je zapravo moguće (npr. 5 × 8 km = 40 km, najduži 8 = prosek; < prosek nemoguće matematički samo ako je „najduži" ≥ svaki trening) → L2 je logički nemoguć (najduži ≥ prosek uvek) → odbiti oba sa porukom. Čarobnjak: ista provera u Step3Volume.

## 1b coach-hm-mar (4c6f585) — PROVERENO: jump-example.ts ponovo → bajt-isto.
- #5 skok dugog posle netrčanih nedelja (HM 1 060/9 058, MAR 3 584/25 718; HM 6 d 75 km: 19 dana bez trčanja + bol → ned 11 dugi 8,5 → ned 12 dugi 21,4): ODLUKA B. Pravilo pokrivenosti (pouka 37: dan poznat bez zapisa = 0) važi i za L plafona skoka; nedelje 1–4 (pretpostavljeni skorašnji trk) ostaju. → HM lengths.ts rollingLongCap10, MAR lengths.ts jumpBase10; izmeriti i 10K/5K (isti obrazac?) i ispraviti gde postoji.
- #1 HM taper: dan kvaliteta duži od dugog (1 446/24 852 gen), #3 MAR taper MP duži od dugog (70,6 %): T. ODLUKA: pouka 35 i u taperu (dva kvaliteta duža od dugog → drugi lagan) za HM; MAR MP u taperu: dozvoljeno da MP bude ≤ 1,1 × dugi (inače skratiti MP) — predlog za MAR sesiju sa merenjem; ne blokira.
- #2 napomena „dan kvaliteta ne sme biti duži od dugog" a jeste: K → ispraviti tekst (HM week.ts:620, MAR) uz paket poruka.
- #4 lagan ≥ 0,9 × dugi (HM 16 %, MAR 33 %; isto 5K/10K iz 1a): jedna odluka za sve 4 (vidi kraj).
- #6 interne oznake u korisničkim napomenama 79/79 (HM/MAR) + A6 + C15: paket „poruke" u sve 4 — ISPRAVITI (korisnik ne vidi M7/H8/pouka N).

## 4 owner (6fb9a50) — PROVERENO ponovo (verify-4): fiveK-n1-repro (isto), hm-deloadref1 40 → 347/347 WEEK_INFEASIBLE@2, mar-emptyweek-example → EMPTY_WEEK ned 18; tenK-restore u toku.
- HM bol 8 + umor u istom koraku → WEEK_INFEASIBLE ned 2 (19 490/19 490; isti tok u 2 koraka prolazi): B, REALAN → HM: jedna funkcija „poslednji dugi pre nedelje w" iz upisanih dana (assess noLong vs generate).
- HM recentLongRunKm + bol → umor → umor: DELOAD_LONG ned 3 (3 758/13 860): B → HM: jedna referenca dugog rasterećenja (generate vs validate:1280). (ponoviti merenje u ispravci)
- HM početnik WEEK_INFEASIBLE taper (6+8): B nepotvrđen uzrok → HM sesija prvo potvrdi.
- MAR bol 8 kraj N−2 (3 d) → EMPTY_WEEK trkačke (224/10 976): B, REALAN → MAR: jedna definicija „trkačka samo sa trkom" (raceWeekRest vs raceOnlyWeek); trka ostaje, nedelja = trka + odmor (dozvoljeno), uz upozorenje.
- 10K vraćanje revizije → sledeća adaptacija odbijena 172/2 880, vraćen plan krši validator 1 207/2 880: B (čeka moju potvrdu) → 10K; restoreMerge postoji i u 5K/HM/MAR — IZMERITI i tamo (isti obrazac: drugo spajanje bez construct/validatePlan). Predlog: vraćanje kroz jezgro (writtenWeeks + validatePlan) ili ponuditi vraćanje samo kad posle snimka nema adaptacija.
- 5K N1 „poslednja izgradnja" dve definicije (assess:230 vs volume:337): posledica = posle bola pa viška ned 4 ostaje 15,4 (povratak 14 + 10 %) uz poruku „plan se ne povećava". Plan nije opasan (trkač je trčao više) → T (pouka 24), ISPRAVITI u 5K paketu (jedna funkcija).
- Forma „čeka prilagođavanje" za rezultat koji jezgro ignoriše (sve 4): T/tekst pogrešan → ISPRAVITI (Forma čita odluku jezgra) u sve 4.
- MAR MARATHON_LONG_SHORT pogrešan razlog (1 409/17 300): T → MAR (pacesAt).
- 10K CAPACITY_LIMITED preporučuje odbijene dane (930/6 708): T → 10K (ista funkcija kao ulaz).
- K: MAR poruka kapaciteta, 10K fewerDaysAdvice zaokruživanje, 5K floor1 validator, 5K peakKm polje, HM adaptInvariants min(40)→20, test izolacije 5K type-only, test ivica 5K/10K @/ alias → ISPRAVITI (jeftino) u paketima po distanci.

## 2 fuzz (089e909) — PROVERENO: sharpen5k.ts i qinf5k.ts ponovo → isti brojevi (3 d: 12/245 WEEK_INFEASIBLE oštrenje; km12: 273/1023 odbijeno, min VDOT 30).
- F1 5K 3 dana (npr. pon/čet/sub + trka sub, uto/pet/ned + trka ned) → WEEK_INFEASIBLE bez preporuke: B, REALAN → 5K: oštrenje i na lagan dan ≥ 3 dana pre trke (ili sub/oštrenje 2 dana pre), uz test iscrpne mreže 245 kombinacija.
- F2 5K 3 d / 12 km odbijeno za svaki VDOT (273/1 023): B, REALAN (nizak obim) → 5K: kad RP/kvalitet ne staje, manja doza ili 1 kvalitet uz upozorenje, ne odbijanje. Zamenjuje POSLE-MERGE stavku „QUALITY_INFEASIBLE 2 na VDOT 60".
- Uz to (sharpen5k 4 d): 98/245 kombinacija 4 dana odbijeno RUN_DAYS_SPACING (dokumentovano porukom) — T: razmotriti pad na 1 kvalitet umesto odbijanja (korisnik bira 4 uzastopna dana) → 5K, mera pre odluke.
- F3 10K test duži od dugog (D25 ne uključuje test; HM pouka 32 uključuje): T → 10K uskladiti sa HM.
- F4 5K kvalitet duži od dugog bez pravila/upozorenja (~3 800 realnih): T → uz odluku „lagan/kvalitet prema dugom" (jedna odluka za 4).
- F5 WEEK_INFEASIBLE 10K/HM/MAR samo na nerealnim ulazima: N → POSLE-MERGE.
- F6 HM gridInvariants DELOAD_LONG ne zna izuzetak pouke 32: K (test) → HM.
