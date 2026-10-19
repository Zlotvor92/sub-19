/* Maraton v2 — politika: svaki trenerski broj ima JEDNO mesto (ovde) i red u DECISIONS sa obrazloženjem i
   izvorom ili oznakom heuristike (docs/generators-v2/MASTER-HM-MARATHON.md § 5, M1–M15). Ostali fajlovi čitaju
   samo ovaj objekat (i `dayRule`, pristup tabeli M15); nijedan od njih ne nosi sopstveni trenerski broj. */

import type { Experience, Structure } from './types.ts';

export interface Decision {
  readonly id: string;
  readonly rule: string;
  readonly place: string;
  readonly rationale: string;
}

const DECISIONS: readonly Decision[] = [
  {
    id: 'M1',
    rule: '3, 4, 5 ili 6 dana trčanja (M15: obim po redu; početnik M17); 12–24 cele nedelje do trke; rezultat 10 km, polumaraton ili maraton (5 km dozvoljen uz upozorenje RESULT_5K) ne stariji od 84 dana, VDOT 30–80 — bez takvog rezultata plan po osećaju (M16); cilj opcion; skorašnji najduži trk opcion (M13a).',
    place: 'input.ts',
    rationale:
      'Opseg MASTER § 5 M1. Trajno odbijanje: < 12 ned (preporuka polumaraton), obim van reda M15 (preporuka broj dana čiji red podržava obim; ispod 30 km polumaraton ili izgradnja osnove), 1/2/7 dana, VDOT > 80, trčanje/hodanje (M17). „Počni kasnije": > 24 ned. Bez rezultata, rezultat stariji od 84 dana ili VDOT < 30: plan po osećaju (M16, marathon-v2.2.0; do tada privremeno odbijanje). 5 km rezultat: Daniels–Gilbert sa 5 km precenjuje maratonsku izdržljivost više od dužih distanci (heuristika; v. M2), zato upozorenje.'
  },
  {
    id: 'M2',
    rule: 'VDOT iz rezultata (Daniels–Gilbert); zone E 0,62–0,70, T 0,88, I 0,975, R 1,05 udela trenutnog VDOT-a; MP = tempo prognoze maratona iz VDOT-a umanjenog za korekciju obima (< 40 km −2,0; 40–59,9 km −1,0; ≥ 60 km 0); tempo fiksan kroz plan.',
    place: 'paces.ts (udeli i korekcija: paces)',
    rationale:
      'Jednačine su objavljeni model (Daniels i Gilbert 1979); udeli zona kao HM (H2, sekundarni izvor: Danielsov opis zona; R = 1,05 heuristika). Korekcija obima je heuristika (Vickers i Vertosick 2016: Riegel je kod rekreativaca preoptimističan za maraton, obim popravlja prognozu). Pojas korekcije po trenutnom obimu iz ulaza, zaokruženom na 0,1 km. Fiksno do adaptacije (segment 04).'
  },
  {
    id: 'M3',
    rule: 'Δ = VDOT cilja − maratonski VDOT (M2); Δ ≤ 0,08·N realističan, ≤ 0,16·N ambiciozan, više nerealan (upozorenje).',
    place: 'paces.ts assessGoal (pragovi: goal)',
    rationale:
      'Heuristika napretka po nedelji (MASTER M3). Tumačenje (opreznije, prihvatio organizator): poredi se sa VDOT-om umanjenim za korekciju obima (M2), istim iz kog je MP i prognoza maratona — jaz je veći ili isti. Nerealan cilj je upozorenje, ne menja tempo.'
  },
  {
    id: 'M4',
    rule: 'Poslednja nedelja trka, dve pre nje taper; B = N − 3: specifično 4 (B ≤ 12), 5 (B 13–16), 6 (B ≥ 17); baza = ceil((B − spec)/2); razvoj = ostatak.',
    place: 'periodize.ts (phases)',
    rationale:
      'Duži taper je opreznija opcija za maraton (praksa; Bosquet i sar. 2007: 8–14 dana smanjenja opšte optimalno, više sportova, specifični dokaz za maraton ograničen). 12 ned → 3/2/4/2/1, 24 ned → 8/7/6/2/1.'
  },
  {
    id: 'M5',
    rule: 'Najviše 3 uzastopne nedelje izgradnje (izuzetno 4 kad bi rasterećenje palo na prvu nedelju faze); nikad na prvoj nedelji faze, u ned 1–2, na poslednjoj pred taperom, u taperu/trkačkoj. Cilj 0,8 × poslednji ne-rasteretni; 1 kvalitet T ≈ 60 % poslednje T doze (nivo naniže, min 2,0 km) na danu Q2 (3 dana: na danu jedinog kvaliteta); dugi 0,8 × poslednji ne-rasteretni; ostali dani lagani.',
    place: 'periodize.ts (gde), week.ts + quality.ts + lengths.ts (sadržaj), volume.ts (cilj)',
    rationale:
      'Heuristika 3:1 (MASTER H5/M5, pouka 4). Raspored se bira determinističkom pretragom: najmanje rasterećenja, pa izgradnja što ranije. T 2,0 km u razvoju/specifičnoj (lestvica T cruise nema 2,0 km): ista doza druge strukture (2,0 km kontinuirano, M10). Tumačenje (marathon-v2.1.0, 3 dana): „poslednja T doza" je poslednja doza u zoni T iz ne-rasteretne nedelje izgradnje — u specifičnoj fazi 3 dana jedini slot je MP, pa se T rasterećenja meri od poslednjeg T iz razvoja (opreznije od 60 % MP doze); kod 4–6 dana to je uvek doza slota Q2 (isto kao marathon-v2.0.0).'
  },
  {
    id: 'M6',
    rule: 'Ned 1 = trenutni obim; izgradnja +6 % poslednjeg ne-rasteretnog cilja (min 1,0, max 5,0 km, korak 0,1); vrh = min(start × 1,5; start + 30; max nedelje 80 km; kapacitet). Kapacitet = stvarna konstrukcija nedelje; neizvodljiv cilj → samo ta nedelja na najbliži izvodljiv cilj (napomena). Spuštena nedelja izgradnje → CAPACITY_LIMITED.',
    place: 'volume.ts (jedini vlasnik cilja i poruke); generate.ts + validate.ts prijavljuju',
    rationale:
      'Heuristika umerenog rasta (MASTER M6; pouke 1 i 9). Kapacitet nije formula: cilj nedelje proverava stvarna konstrukcija (week.ts); granica izgradnje se ne spušta zbog jedne nedelje, sledeći rast meri se od cilja koji je nedelja stvarno dobila. Ned 1 ispod trenutnog obima samo kad je dugi ned 1 na plafonu 150 min (pouka 9).'
  },
  {
    id: 'M7',
    rule: 'Taper 2 nedelje: N−2 cilj 0,8 × vrh, MP i T ≈ 60 % poslednje doze zone (naniže; min MP 2 × 3000 m, T 2,0 km; 3 dana samo MP — jedan kvalitet, M15), dugi ≤ 0,65 × najduži; N−1 cilj 0,6 × vrh, MP ≈ 50 % poslednje MP doze izgradnje (min 2 × 3000 m), bez T (dan Q2 lagan), dugi ≤ 0,45 × najduži; svi dani trčanja zadržani; cilj samo naniže (najbliži izvodljiv cilj, M6).',
    place:
      'week.ts + quality.ts (taperDoses, pickTaper) + lengths.ts (taperLengths); cilj volume.ts',
    rationale:
      'Smanjen obim uz zadržan intenzitet i učestalost (Bosquet i sar. 2007, isti ograničeni dokaz kao M4). Tumačenja (prihvatio organizator): MP N−1 ≈ 50 % poslednje MP doze izgradnje (kao N−2 „poslednje doze"); minimum T tapera 2,0 km kao M5. Dublji taper (prihvatio organizator; Bosquet: smanjenje 41–60 %): dugi ≤ 0,65/0,45 × najduži + lagan ≤ dugi (pouka 2) + 1 lagan dan čine 0,8 × / 0,6 × vrh neizvodljivim u 2388 / 1548 od 4368 planova mreže 01 → ta nedelja ide na najbliži izvodljiv cilj naniže; npr. 16 ned, 45 km, VDOT 45, uto/čet/sub/ned: vrh 67,5, N−2 49,7 km (0,74 ×) umesto 54,0. Odstupanje (opreznije): kad T po pravilu ne staje u plafon M11, T otpada uz napomenu (TAPER_ZONE_DROPPED); u mreži 01 nijednom.'
  },
  {
    id: 'M7a',
    rule: 'M7 ispred M11 samo u taperu: MP doza tapera je doza iz M7 (≈ 60 % / 50 % poslednje doze, minimum 2 × 3000 m) i plafon MP 20 % (M11) se na nju ne primenjuje; jedini izuzetak od M11 u izgradnji/taperu. Napomena nedelje + upozorenje TAPER_MP_OVER_CAP. Ne važi za početnika u N−1 (M17: bez MP).',
    place:
      'quality.ts (taperDoses — jedina funkcija doze tapera, čitaju je pickTaper i validate.ts; pouka 24); validate.ts (ZONE_CAP bez MP u taperu, TAPER_QUALITY)',
    rationale:
      'Sudar brojeva § 5 (STANI, odluka organizatora: opcija b): minimum MP tapera 2 × 3000 m > 20 % cilja kad je N−1 = 0,6 × vrh < 30 km. Mreža 01: 48 / 4368 planova (svi 12 ned / 35 km: vrh 49,7 → N−1 29,8 km, plafon 5960 m), najviše 20,1 % nedelje; ostalih 4320 planova bajt-isto (heš celog plana). Privremeno rešenje pre odluke (MP otpada) gasilo je i oštrenje trkačke nedelje (≤ MP doza N−1 = 0). MAR-03: TAPER_MP_OVER_CAP u 3 dana (48 % planova) ostaje — MP je jedini kvalitet tapera (odluka organizatora).'
  },
  {
    id: 'M8',
    rule: 'Trkačka nedelja: dana sa trkom = min(dani, 5), trka zamenjuje dugi; oštrenje WU + 2 × 2000 m MP (2:00) + CD na najkasnijem danu ≥ 3 dana pre trke, nesusedno poslednjem zahtevnom danu tapera, ≤ MP doza N−1 (taper bez MP → bez oštrenja); dan pred trku 20 min E + 4 × 20 s (≤ 30 min); ostali min(30 min E, najkraći lagan N−1); trka 42,2 km + WU 5 min van obima; cilj = planirano; Uslov 8 = planirano + 42,2 km.',
    place: 'week.ts (raceWeek, raceWeekRuns, raceEasyWorkout) + workouts.ts',
    rationale:
      'Fiksna trenerska heuristika (MASTER M8; pouka 5). M8 je potpuna specifikacija trkačke nedelje: plafon M11 i „lagan ≥ 5 km" (M13) se na nju ne primenjuju (tumačenje prihvatio organizator, kao 10K D8) — 30 min E je < 5 km kod sporijih (1638 / 4368 planova mreže 01). WU/CD oštrenja po pojasu M14. Ubrzanja R tempom, oporavak isti metraž (M14 R). Kad nijedan dan nije ≥ 3 dana pre trke i nesusedan taperu, oštrenja nema (odstupanje, napomena).'
  },
  {
    id: 'M9',
    rule: 'Q1, Q2 i dugi međusobno nesusedni (ciklično: nedelja i ponedeljak su susedni; 3 dana: jedini kvalitet Q1 nesusedan dugom); dugi: dan iz ulaza, inače nedelja, inače poslednji dan trčanja; ostali dani lagani (bilo gde); nema rešenja → SCHEDULE_NO_RECOVERY sa predlogom.',
    place: 'schedule.ts',
    rationale:
      'Dan oporavka između zahtevnih dana (kao H9). Više rešenja: najveći razmak dugi → Q1, pa Q1 → Q2, pa raniji Q1 (tehnički, deterministički izbor, isti kao 10K v2 D9).'
  },
  {
    id: 'M10',
    rule: 'Baza: Q1 R, Q2 T kontinuirano; razvoj: Q1 I, Q2 T cruise; specifično: Q1 MP, Q2 T cruise (3 dana: jedan kvalitet — baza T kontinuirano, razvoj T cruise, specifično MP; bez I i R, M15). Lestvice u ladders. Ista doza druge strukture: T kontinuirano ↔ 2–5 jednakih deonica ≥ 1000 m (deljivo sa 100 m, a kad podele nema sa 50 m); MP 2–5 jednakih deonica ≥ 3000 m (100 m, pa 50 m) ili kontinuirano do 16 km; I do 6 jednakih deonica 800–1200 m ili piramida 1200 + 1000 + 800 m (i M10a); R deonice 200 / 300 / 400 m.',
    place: 'workouts.ts (lestvice, strukture), quality.ts (izbor)',
    rationale:
      'Heuristika redosleda razvoja (brzina/ekonomija → prag/VO2max → specifičnost maratona), MASTER M10, pouka 11. Prihvataju se samo tačne podele (doza se ne menja). Kad druga struktura ne postoji (npr. I 2,0 km), slot ponavlja trening uz napomenu; nedelja se razlikuje po drugom slotu.'
  },
  {
    id: 'M10a',
    rule: 'Pouka 27: kad zona sa opsegom deonice (I 800–1200 m) za dozu nema drugu strukturu (samo jedna podela na jednake deonice), druga struktura je piramida u opsegu zone, korak 200 m, isti zbir: uspon od najkraće do najduže deonice, pa ostatak silazno od najduže koja ostavlja ostatak u opsegu (I 5000 = 800-1000-1200-1200-800); naizmenično sa jednakim deonicama u uzastopnim nedeljama (M12 „druga struktura"). T i MP uvek imaju drugu strukturu (kontinuirano ↔ deonice), R deonice 200/300/400 m.',
    place: 'workouts.ts (pyramidOf, structuresForDose); validate.ts (SLOT_REPEAT, REP_MIN)',
    rationale:
      'Odluka organizatora posle MAR-01 (I 5,0 km bez druge strukture: 456 ponovljenih nedelja mreže 01). Isti zbir = ista doza (M12); opseg i korak 200 m iz pouke 27. Postojeća piramida I 3,0 km (1200 + 1000 + 800, M10) ostaje jer 3,0 km već ima drugu strukturu (3 × 1000).'
  },
  {
    id: 'M11',
    rule: 'Jedan plafon po zoni, po treningu, % ciljnog obima nedelje: R 5 %, I 8 %, T 10 %, MP 20 %. Plafon MP u izgradnji je JEDNA funkcija sa dva člana (odluka organizatora MAR-03, pouka 14): min(20 % cilja; najveća MP doza čiji kvalitetni dan — WU + MP + oporavci + CD, WU/CD srednjim E — ne traje duže od najdužeg dozvoljenog dugog iste nedelje: udeo M15, 150 min M13, skok M13a). MP doza = najviši nivo (ili druga struktura iste doze) u tom plafonu; pad doze zbog drugog člana dozvoljen kao kod kapaciteta (pouka 12, napomena „plafon MP, pouka 14", DOSE_DROPPED); nedelja čiji je dugi kraći od najdužeg dozvoljenog (lagani ≥ 5 km) pa bi MP dan bio duži nije izvodljiva (najbliži izvodljiv cilj, M6). Najniži nivo MP (2 × 3000 m) je izuzet od drugog člana (kao minimum M7a; prvi član važi): kad je dugi na plafonu skoka M13a, MP dan sme biti duži uz upozorenje LONG_SHORTER_THAN_QUALITY. Ostale zone nemaju drugi član, samo upozorenje (pouka 14): za njih bi sudario pouku 9 u ned 1 (VOLUME_START, 58 planova guste ned 1). U taperu M7a.',
    place:
      'policy.ts caps; quality.ts capM, mpFitsLong (drugi član; čitaju pickSlot/pickBuild i validate.ts, pouka 24); week.ts (provera dana); validate.ts',
    rationale:
      'R/I/T prema Danielsu (sekundarni izvor, ne dokaz); MP 20 % (Daniels: M ≤ 20 % nedelje, sekundarni izvor). Nema drugih limita za iste zone. Ne važi za trkačku nedelju (M8). Drugi član MP (heuristika, trenerski: dugi ostaje najduži trening nedelje): spori trkač (VDOT 30) sa dugim na 150 min ima MP 16 km kontinuirano + WU/CD duže od dugog (MAR-02: 126 planova 5 d, 786 planova 6 d).'
  },
  {
    id: 'M12',
    rule: 'Po slotu: sledeći nivo ako staje u plafon (≤ 1 nivo/ned), inače ista doza druge strukture; doza ne pada van rasterećenja/tapera/trke; početni nivo = najviši nivo ≤ 60 % plafona zone (najmanje prvi nivo); T cruise ≥ poslednje T kontinuirano; MP ≥ max(početni nivo, poslednje I; 3 dana: poslednje T); 3 dana: prelaz T kont. → T cruise koji bi dao isti trening ide pravilom iste lestvice (sledeći nivo / druga struktura); glavna doza (T + I + MP) ne opada; nema identičnih uzastopnih ne-rasteretnih nedelja; baza bez platoa. M11 ispred M12: kad nijedan cilj nedelje nije izvodljiv uz „doza ne pada", doza van plafona ide na najviši nivo u plafonu (napomena, DOSE_DROPPED).',
    place: 'quality.ts',
    rationale:
      'Postepena progresija (MASTER H12/M12; pouke 3 i 12). 60 % plafona je heuristika (10K v2 D16). Spuštanje doze samo u nedelji ograničenoj kapacitetom (pouka 12).'
  },
  {
    id: 'M13',
    rule: 'Dugi ≤ udeo cilja po broju dana (M15: 50 / 40 / 35 / 32 %) i ≤ 150 min sporim E; korak 0,1 km; dugi ≥ svaki lagan (tvrdo); lagan ≥ 5 km. Upozorenje MARATHON_LONG_SHORT kad je najduži dugi plana < 26 km (preporuka: više dana ili obima).',
    place: 'lengths.ts (jedini vlasnik dužina); validate.ts (upozorenje)',
    rationale:
      '150 min (Daniels, sekundarni izvor). Dugi uzima najveću dozvoljenu dužinu (do lagan ≥ 5 km), lagani ostatak (pouka 2). 26 km je heuristika praga za maratonski dugi (MASTER M13). Upozorenje navodi najduži dugi i šta ga ograničava (150 min → namerna granica; 40 % → veći obim ili više dana); mreža 01: 2832 / 4368 planova (prihvatio organizator). 5/6 dana (marathon-v2.1.0) nose veći obim pa i duži dugi.'
  },
  {
    id: 'M13a',
    rule: 'Pouka 28 (izmena organizatora posle STANI MAR-02): dugi SVAKE nedelje ≤ max(1,1 × L; L + 1,0 km) (korak 0,1, naniže), L = najduži dugi u prethodne 4 nedelje plana; opcioni ulaz recentLongRunKm (skorašnji najduži trk, 5–42 km) je dugi „nedelje 0" i ulazi u L za nedelje 1–4. Uz to M13 (udeo, 150 min). Nedelja ograničena ovim sme ispod cilja po pravilu (ned 1 ispod trenutnog obima — dopuna pouke 9; najbliži izvodljiv cilj naniže, M6); to nije ograničenje kapaciteta broja dana (bez CAPACITY_LIMITED), napomena nedelje. Konstrukcija sa datim recentLongRunKm neizvodljiva → RECENT_LONG_TOO_SHORT (pouka 6). Bez ulaza: ned 1 bez plafona skoka + napomena „Dugi X km: ako ti je skorašnji najduži trk kraći od X/1,1 km, unesi ga — plan počinje od njega." (prag naviše na 0,1 km).',
    place:
      'lengths.ts (jumpBase10, longJumpCap10, recentLongNote — jedine funkcije, pouka 24); generate.ts (istorija dugih, RECENT_LONG_TOO_SHORT); week.ts; volume.ts (capacityWeeks); validate.ts (LONG_JUMP, RECENT_LONG, VOLUME_START)',
    rationale:
      'Heuristika: skok dugog ≤ 10 % nedeljno; posmatračka kohorta (Frandsen i sar., BJSM 2025, 5205 trkača, DOI 10.1136/bjsports-2024-109380): pojedinačno trčanje duže od 110 % najdužeg u prethodnih ~30 dana povezano je sa većim rizikom povrede (asocijacija, ne kauzalna granica; izvor naveden u docs/qa/generator-ab/coaches/hm-review.md S7). Pravilo samo za ned 1 (prvobitna pouka 28) pomeralo je skok na ned 2 (mreža 35 910 ulaza: medijana ×1,41, najviše ×2,39) i davalo 1611 odbijanja WEEK_INFEASIBLE (r ≤ 10 km) — odluka organizatora: kotrljajuće pravilo + odbijanje sa preporukom. 4 nedelje ≈ 30 dana. Prag napomene X/1,1 je tačan za X ≥ 11 km (za X < 11 km prag je X − 1).'
  },
  {
    id: 'M14',
    rule: 'WU/CD E po pojasu trenutnog obima iz ulaza (0,1 km), konstantno kroz plan: < 50 km 15/10 min; 50–69,9 km 20/15 min; ≥ 70 km 25/15 min (fiksni deo treninga, nikad pufer); km po srednjem E; oporavci: R isti metraž džogom, I 1:1 vreme zaokruženo naniže na 15 s (max 4:00), T cruise 60 s (deonica ≤ 1600 m) / 90 s, MP 90 s (≤ 4000 m) / 120 s.',
    place: 'workouts.ts (warmupCooldown, recoveryOf)',
    rationale:
      'Trkač većeg obima ima duže zagrevanje (MASTER M14/H14). Pojas ≥ 70 km važi za 5/6 dana (ulaz do 85 / 110 km, marathon-v2.1.0); kod 3/4 dana je nedostižan (ulaz ≤ 50 / 65 km). Oštrenje (M8) ima 2:00 oporavak iz M8.'
  },
  {
    id: 'M15',
    rule: 'Tabela po broju dana (days, JEDINA): 3 dana = 1 kvalitet + 1 lagan + dugi, obim 30–50 km, max nedelje 60, dugi ≤ 50 %, min 15 | 4 dana = 2 kvaliteta + 1 lagan + dugi, 35–65, max 80, 40 %, min 20 | 5 dana = 2 kvaliteta + 2 lagana, 40–85, max 100, 35 %, min 25 | 6 dana = 2 kvaliteta + 3 lagana, 50–110, max 120, 32 %, min 30. 5/6 dana: lagani jednaki (razlika ≤ 0,1 km, raniji dan dobija višak). 1/2/7 dana trajno odbijeno.',
    place:
      'policy.ts days (dayRule); čitaju input.ts, schedule.ts, lengths.ts, volume.ts, week.ts, validate.ts',
    rationale:
      'Heuristika (MASTER M15). Uslov 8: nedelja ispod minimuma = greška; trkačka nedelja: planirano + 42,2 km (M8). 3 dana: jedan kvalitet jer dva kvaliteta + dugi + plafoni M11 ne ostavljaju lagan dan (kao HM H15 / 10K D18). Redovi 3/5/6 dana od marathon-v2.1.0 (segment 02). Udeo dugog 5/6 dana izmeren u MAR-03 (kod MAR-02, menjan samo udeo; mreža 02 i gusta ned 1) i zadržan (odluka organizatora): 5 d 0,35 / 0,38 / 0,40 → kvalitetni dan duži od dugog 126 / 126 / 126 planova, K1 0 / 0 / 66 WEEK_INFEASIBLE; 6 d 0,32 / 0,35 / 0,38 → 786 / 786 / 786, K1 0 / 66 / 198 — udeo ne seče dugi u tim nedeljama (VDOT 30, dugi na 150 min), a veći udeo čini rasterećenje neizvodljivim (0,8 × duži dugi + lagani ≥ 5 km). Kvalitetni dan duži od dugog rešava drugi član plafona MP (M11, pouka 14).'
  },
  {
    id: 'M16',
    rule: 'Plan po osećaju kad nema rezultata, rezultat je stariji od 84 dana ili je VDOT iz rezultata < 30: lagan tempo easyPaceSecPerKm obavezan (270–510 s/km; bez njega EASY_PACE_REQUIRED, van opsega EASY_PACE_OUT_OF_RANGE); uz pouzdan rezultat lagan tempo se ne koristi. E = lagan tempo ± 15 s (150 min dugog po sporom kraju E). Procena VDOT-a = VDOT čiji je brži kraj E (0,70) jednak laganom tempu, ograničena na 25–60 (iznad 60 → 60 + upozorenje VDOT_ESTIMATE_CAPPED), SAMO orijentir za T/I/R i trajanje deonica; MP orijentir = prognoza maratona iz procene umanjene za korekciju obima (M2). Plan nosi paceBasis feel; svaki kvalitet nosi RPE: T 6–7, I 8, R 8, MP 5–6 „ritam maratona"; bez prognoze maratona i ocene cilja (null, „posle testa"). Test 5 km (WU/CD M14 + 5 km kontrolisano maksimalno) u poslednjoj nedelji baze: na danu Q1 (3 dana: umesto jedinog kvaliteta), u rasterećenju umesto kvaliteta rasterećenja (dan T slota); računa se u obim, nije doza (bez plafona M11, progresija posle testa od stanja pre testa, glavna doza ga preskače). MP pre testa ne postoji (MP je tek u specifičnoj fazi, posle baze); posle testa MP po korekciji M2 iz rezultata testa — adaptacija (segment 04); u ovom segmentu samo struktura plana. Početnik nema test (M17).',
    place:
      'input.ts (put); paces.ts feelPaces; policy.ts feel/test; periodize.ts testWeekOf; week.ts (test); workouts.ts testWorkout, rpeOf; quality.ts advance; generate.ts; validate.ts (PACE_BASIS, PACES, RPE, TEST)',
    rationale:
      'Kao HM H16 i 10K D26/D27 (MASTER M16). Heuristika: bez rezultata lagan tempo je jedini podatak o trkaču; izjednačavanje sa bržim krajem E daje niži VDOT nego srednji E (opreznija procena brzih zona). U opsegu 270–510 s/km procena je 58,6–26,1, pa granice 25/60 u mreži ne deluju (zaštita ulaza). MP RPE 5–6 („ritam maratona") je ispod T (6–7): maratonski tempo je sporiji od praga. Test u poslednjoj nedelji baze: pre prve MP i I nedelje, da adaptacija (04) postavi tempo razvoja i specifične faze. Pouka 23 (10K N7): cilj rasterećenja se zbog testa ne pomera. Odstupanje (odluka organizatora MAR-03 S2, presedan 10K D27 ispred D5): kad u rasterećenju sa testom lagani ne bi bili ≥ 5 km, dugi se skraćuje na najduži koji ih ostavlja ≥ 5 km (dugi ≥ lagan), cilj i test ostaju; napomena + DELOAD_LONG_SHORTENED (mreža 03: 126 / 8190 — najmanji obim reda, 14–16 ned, brz lagan tempo); jedna funkcija lengths.deloadLengths za konstruktor i validator.'
  },
  {
    id: 'M17',
    rule: 'Početnik (experience beginner; podrazumevano regular), JEDNA tabela beginner: 4–5 dana (3 i 6 → BEGINNER_DAYS, preporuka 4–5 dana); 16–24 nedelje (12–15 → BEGINNER_SHORT); obim 4 dana 25–45 km, 5 dana 30–50 km (ispod → preporuka kraće distance, iznad → plan bez oznake početnika); nedelje 1–2 uvod bez kvaliteta (dan kvaliteta = lagan); zatim jedan kvalitet nedeljno (lestvica kao 3 dana M15: T kont. → T cruise → MP), bez I i R; lestvica T kont. početnika [1,5; 2,0; 3,0; …]; prvi nivo lestvice faze ne staje u plafon M11 → T kontinuirano (po M12, najviši nivo početnika koji staje); M12 početni nivo = prvi nivo (60 % plafona ne važi); rast +5 % (min 1,0, max 2,5 km); vrh = min(start × 1,5; start + 25; max nedelje M15; kapacitet); dugi ≤ 150 min sporim E i ≤ udeo M15; WU/CD uvek 15/10 min; bez testa ni po osećaju (M16); upozorenje MARATHON_LONG_SHORT kad je najduži dugi < 24 km („cilj: završiti"). Rasterećenje T ≈ 60 % poslednje T doze (min 1,5 km); dugi rasterećenja skraćen kad lagani ne bi bili ≥ 5 km (kao M16, odstupanje); taper N−2 po M7/M7a (samo MP), N−1 bez MP: jedan kvalitet T kontinuirano ≈ 60 % poslednje T doze (min 1,5 km), trkačka nedelja bez oštrenja (M8: oštrenje ≤ MP doza N−1), dan pred trku po M8. runWalk → RUN_WALK_NOT_SUPPORTED (preporuka kraće distance; trajno, za sve).',
    place:
      'policy.ts beginner + planRule (jedina tabela); input.ts; schedule.ts (1 kvalitet); quality.ts (ladderLevels početnika, buildLadder, startLevel, pickDeload); week.ts (uvod); volume.ts, lengths.ts, workouts.ts (pravilo plana); validate.ts',
    rationale:
      'MASTER M17 (heuristika; obrazac 10K D28/D31/D32 i HM H17). Uvod bez kvaliteta i jedan kvalitet: postepen ulazak u strukturisan rad. T kont. od 1,5 km: pri obimu 25 km plafon T (10 %) je 2,5 km, a MP 2 × 3000 m (6 km) traži cilj ≥ 30 km (20 %) — specifična faza malog obima ide T kontinuirano umesto praznog dana. Rast 5 % i vrh +25 km opreziji od redovnog (6 %, +30). Prag 24 km i poruka „cilj: završiti": početnik sa manjim obimom ima kraći dugi; cilj je završiti trku. Bez testa: tempo brzih zona je orijentir, kvalitet po RPE; rezultat trke kasnije koristi adaptacija (segment 04). Odluke organizatora (MAR-03, mreža 03 početnika 1890): S2 — rasterećenje ned 4 pri 4 d 25 km i 5 d 30/35 km neizvodljivo (3–4 lagana ≥ 5 km + T 1,5 + 0,8 × dugi > cilj) → dugi se skraćuje (presedan 10K D27 ispred D5); S3 — N−1 pri 4 d 25 km i 5 d 30 km neizvodljiv sa MP 2 × 3000 m (M7a) + dugi ≤ 0,45 × najduži + 2 lagana ≥ 5 km (378 planova) → početnik u N−1 bez MP, T kont. kao 10K D31.'
  },
  /* ---------- Segment 04 (marathon-v2.3.0): adaptacija (M18). Obrazac 10K v2 A1–A17 (10k-v2.5.1), brojevi iz M18;
     heuristike zadate za segment, bez trenerske provere. ---------- */
  {
    id: 'M18',
    rule: 'Adaptacija kao 10K v2 A1–A17 uz pouke 7, 16–25, 28–33: tok assess (činjenice → korak) → isti konstruktor (construct) → spajanje upisanih dana (written.ts) → validate; „orijentir" kad je nov start i < 12 nedelja do trke; bol: dugi ≤ 60 min, lagani × 0,7 (≥ 5 km); taper posle smanjenja: N−2 0,8 ×, N−1 0,6 × najvećeg cilja izgradnje posle poslednjeg smanjenja (MP/T po M7, minimum MP 2 × 3000 m, M7a); donja granica = minimum nedelje broja dana (M15); rezultati 5000/10000/21097,5/42195 m; MP posle rezultata po korekciji obima M2 (paces.pacesFromVdot, jedna funkcija); plafon MP sa trajanjem (M11) i izuzetak najnižeg nivoa, M13a i pouka 33 važe i u adaptiranom planu (iste funkcije).',
    place:
      'assess.ts, steps.ts, written.ts, adapt.ts, generate.ts construct, volume.ts, week.ts, lengths.ts, validate.ts; adaptInvariants.ts (test)',
    rationale:
      'MASTER § 5 M18 i § 2 pouke. Odluke A1–A17 ispod su kopija 10K v2 sa brojevima maratona (sopstvena kopija, Uslov 7).'
  },
  {
    id: 'A1',
    rule: 'Rezultat (test plana 5 km ili trka 5 km / 10 km / polumaraton / maraton) ≤ 84 dana i noviji od rezultata u upotrebi → VDOT od sledeće nedelje (prva puna nedelja posle asOf); MP po korekciji obima M2 iz trenutnog obima ulaza (pacesFromVdot); plan po osećaju prelazi na paceBasis result od te nedelje (RPE samo u nedeljama po osećaju, pouke 16–17); cilj obima se ne menja zbog tempa; doza se nastavlja; ocena cilja (M3, maratonski VDOT, nedelje od sledeće do trke) i prognoza iz novog VDOT-a. VDOT van 30–80 → RESULT_IGNORED; nema sledeće nedelje → ne primenjuje se.',
    place:
      'assess.ts (odluka); steps.ts pacesAt/basisAt; generate.ts construct; validate.ts (PACES, PACE_BASIS, RPE po nedelji)',
    rationale:
      'Kao 10K A1 (heuristika: isti prag starosti kao M1). Kapacitet je i dalje stvarna konstrukcija sa tempom nedelje.'
  },
  {
    id: 'A2',
    rule: 'Manjak izvršenja: potpuno pokriven 7-dnevni prozor do asOf (A10), izvršeno < 60 % planiranog → cilj sledeće nedelje izgradnje = min(prethodni cilj izgradnje, max(izvršeno, 0,8 × cilj te nedelje)), ne ispod donje granice (A9); reduced = true; dalje povratni rast (A8).',
    place: 'assess.ts (adapt.underShare, underFloorShare, windowDays)',
    rationale:
      'Kao 10K A2 (heuristika). Samo kad je sledeća nedelja izgradnje (taper i trkačka se ne menjaju, A12).'
  },
  {
    id: 'A3',
    rule: 'Pauza (uzastopni poznati dani bez trčanja u potpunoj pokrivenosti ili eksplicitna pauza): 7–13 dana → 80 % obima 7 dana pre pauze, prva nedelja 1 kvalitet; 14–27 → 70 %, prva nedelja bez kvaliteta, druga 1 kvalitet; ≥ 28 → min(obim 14 dana pre / 2, 50 % obima 7 dana pre), nov start (rePeriodize preostale izgradnje po M4/M5, vrh od novog starta, progresija doze iznova); nov start i < 12 nedelja do trke → cilj „orijentir" (M18). Cilj ≤ cilj sledeće nedelje u planu; ostatak tekuće nedelje dobija ograničenja i (izgradnja) cilj pauze; reduced = true.',
    place:
      'assess.ts (adapt.pause); periodize.ts rePeriodize; steps.ts framesFor; volume.ts adaptNominal10',
    rationale:
      'Kao 10K A3 (heuristika gubitka forme). Odstupanje (opreznije, bez novog broja): kad za preostalu izgradnju nema rasporeda rasterećenja po M5, faze ostaju (nov start samo obima i doze). Nov start sa ≤ 4 nedelje izgradnje: sve specifično (M4: specifično 4).'
  },
  {
    id: 'A4',
    rule: 'Bol ≥ 4 u poslednja 3 dana → 7 dana bez kvaliteta i ubrzanja, dugi ≤ 60 min sporim E, lagani × 0,7 (≥ 5 km, nikad duži od planiranog, ≤ dugi); bol ≥ 7 → najpre 3 dana odmora; poruka o stručnom pregledu; nedelja sa danom bola/odmora ima najviše 1 kvalitet doze rasterećenja (taper: samo MP). Sidro r = nedelja koja sadrži asOf + 1 (pouka 18: isti bol daje isti plan bez obzira na dan); cilj nedelje r ostaje (planirano ≤ cilj, upozorenje PLANNED_BELOW_TARGET_LIMITS, pouka 25); posle r rast od osnove min(round(0,7 × nivo pre bola), cilj nedelje r) — volume.returnBase10, jedna funkcija za konstruktor, validator i poruku (assess.painReturnNote); povratak samo kad je r izgradnja.',
    place:
      'assess.ts (adapt.pain*, painReturnNote); steps.ts limitsOf; lengths.ts painLong10/limitedEasy10; week.ts limitDays; volume.ts returnAnchor/returnBase10/leaveWeek',
    rationale:
      'Kao 10K A4 + A16 (heuristika opreza; dijagnoza nije deo plana). Tumačenje (M18 „≥ 5 km"): lagan dan bola u trkačkoj nedelji kraći od 5 km (M8) se ne produžava.'
  },
  {
    id: 'A5',
    rule: 'Umor: ≥ 2 laganih treninga (lagan, dugi ili zapis van plana) sa RPE ≥ 7 u 7 dana → sledeća nedelja rasterećenje (samo izgradnja; ne ako je već rasteretna); redovno rasterećenje odmah posle prinudnog se ukida; prinudno se nikad ne ukida. Prinudno rasterećenje u uvodu početnika (M17, ned 1–2, pouka 31): obim rasterećenja (0,8 ×), sadržaj uvoda (bez kvaliteta).',
    place:
      'assess.ts (adapt.fatigue*); steps.ts framesFor; week.ts (uvod); validate.ts (M5 izuzetak prinudnog)',
    rationale:
      'Kao 10K A5 (heuristika). Prinudno rasterećenje sme na prvu nedelju faze ili pred taper.'
  },
  {
    id: 'A6',
    rule: 'Višak: > 115 % planiranog u dva uzastopna potpuno pokrivena 7-dnevna prozora → sledeća nedelja bez rasta (cilj = min(cilj, prethodni cilj izgradnje)); reduced = false; ne kad sledeća nedelja nije izgradnja ili je rasteretna.',
    place: 'assess.ts (adapt.overShare)',
    rationale:
      'Kao 10K A6 (heuristika): više od plana povećava rizik; plan se ne povećava za višak.'
  },
  {
    id: 'A7',
    rule: 'Prioritet (pouka 7): bol uvek (po datumima); za obim samo najviše aktivno od pauza > umor > izvršenje; tempo (A1) uvek; svi uslovi u reasons (applied true/false).',
    place: 'assess.ts',
    rationale:
      'Kao 10K A7: jedno pravilo obima po koraku — bez sabiranja smanjenja (pouka 7: bol > pauza > umor > izvršenje).'
  },
  {
    id: 'A8',
    rule: 'Povratni rast: posle smanjenja cilj raste +10 %/ned (min 1,0 km; nikad sporije od M6) do nivoa pre smanjenja (osim tapera i trkačke); iznad nivoa M6. Nivo = cilj poslednje ne-rasteretne nedelje izgradnje završene pre prvog dana događaja (bez nje start); više koraka → najveći. Rasterećenje u povratku 0,8 × poslednja ne-rasteretna (posle sidra bola 0,8 × osnova). U povratku cilj samo naniže. Taper posle smanjenja (M18): N−2 0,8 ×, N−1 0,6 × najvećeg cilja izgradnje posle poslednjeg smanjenja; korak čija je sledeća nedelja taper: ≤ cilj koraka (i N−1).',
    place:
      'volume.ts (adaptNominal10, nextBuild10, returnBase10, enterWeek, leaveWeek) — konstruktor i validator',
    rationale:
      'Kao 10K A8 (pouka 7): bez povratnog rasta cilj posle pauze ostaje ravan do trke ili skače.'
  },
  {
    id: 'A9',
    rule: 'Donja granica adaptiranog cilja = minimum nedelje broja dana (M15 weekMinKm). Kvalitet koji ne staje → 1 kvalitet doze rasterećenja (taper: samo MP) → bez kvaliteta (ista pretraga cilja: prolazi pravilo, popuštanje, 1 kvalitet, bez kvaliteta; cilj adaptacije se zadržava pa niži izvodljiv cilj); test koji ne staje otpada sa kvalitetom; oštrenje otpada kad trkačka sa njim ne bi bila ≤ poslednja nedelja tapera. Od prve nedelje posle smanjenja rasterećenje sa skraćenim dugim (pouka 33, lengths.deloadLengths, ista funkcija).',
    place:
      'volume.ts adaptNominal10; generate.ts construct (prolazi); week.ts; lengths.ts deloadLengths; validate.ts',
    rationale:
      'Uslov 8: adaptirana nedelja ne pada ispod najmanjeg smislenog obima i ne postaje degenerisana.'
  },
  {
    id: 'A10',
    rule: 'Pokrivenost: dan bez zapisa je poznat (bez trčanja) SAMO u coverage sa complete = true; A2, A3 (iz zapisa) i A6 samo na pokrivenom delu; bol, umor, rezultat i eksplicitna pauza uvek (nepotpun zapis ≠ pauza, pouka 7).',
    place: 'assess.ts (coveredDays, knownKm)',
    rationale:
      'Kao 10K A10: nepotpun unos (sat nije sinhronizovan) ne sme izgledati kao pauza ili manjak.'
  },
  {
    id: 'A11',
    rule: 'Zaštita: dani ≤ asOf, urađeni i zaključani ostaju bajt-isti; završna zaštita samo proverava (ADAPT_PROTECTION). Prošlost = upisani dani (pouka 29): konstruktor vodi stanje zavisno od prošlosti (najduži dugi M7, dugi prethodnih nedelja M13a, poslednji dugi M5, stanje doze uključujući MP i poslednje T, MP i lagan N−1 za trkačku M8) iz upisanih dana (written.ts, jedno spajanje), validator u konstrukciji i posle spajanja vidi isti plan; promena cilja (pouka 19): svi budući treninzi zaključani → treninzi bajt-isti, menja se samo ocena.',
    place: 'adapt.ts; written.ts; generate.ts construct (prior)',
    rationale:
      'Uslov 4 i 10K A11 (06d): završna zaštita štiti urađeno, datume i zaključane treninge, ne odlučuje.'
  },
  {
    id: 'A12',
    rule: 'Datum trke, taper i trkačka nedelja se ne pomeraju; rePeriodize menja samo preostalu izgradnju istim pravilima M4/M5.',
    place: 'periodize.ts rePeriodize',
    rationale:
      'Kao 10K A12: datum trke je fiksan; nov start je kraća priprema istim pravilima M4/M5.'
  },
  {
    id: 'A13',
    rule: 'Test 5 km (plan po osećaju): nedelja testa posle asOf blokirana (ograničenje kvaliteta, prinudno rasterećenje, van izgradnje) → prva sledeća ne-rasteretna nedelja izgradnje bez ograničenja dok je plan po osećaju; nema je → bez testa. Posle rezultata testa nema. Početnik nema test.',
    place: 'steps.ts framesFor',
    rationale:
      'Kao 10K A13: test zamenjuje kvalitet i ne sme u nedelju zabrane; test koji ne staje otpada (A9), bez petlje premeštanja.'
  },
  {
    id: 'A14',
    rule: 'Lančana adaptacija: koraci u plan.adaptation.steps, ponavljaju se redom; isti ulaz + koraci → isti plan (asOf je ulaz).',
    place: 'adapt.ts, generate.ts construct',
    rationale: 'Kao 10K A14: determinizam i ponovljivost — isti ulaz i isti koraci daju isti JSON.'
  },
  {
    id: 'A15',
    rule: 'Plan politike marathon-v2 (bilo koje verzije): budućnost po tekućim pravilima, prošlost zaštićena (mixedWeeks); druga politika ili neispravan → ADAPT_PLAN_INVALID.',
    place: 'adapt.ts checkPlan',
    rationale: 'Kao 10K A15: prošlost se ne prepravlja, budućnost prati tekuću politiku.'
  },
  {
    id: 'A17',
    rule: 'Pouka 22: redovno rasterećenje odmah posle nedelje smanjenja otpada — nedelja smanjenja = (a) fromWeek koraka sa reduced = true (pauza, manjak; višak false), (b) sidro bola r; nov start ne ulazi. Prinudno rasterećenje (umor) se nikad ne ukida; od ukinute nedelje najviše 5 uzastopnih nedelja izgradnje (izuzetak M5 4 + 1) do sledećeg redovnog rasterećenja, inače ostaje. Jedno mesto (steps.framesFor, izlaz dropped), validator čita isti podatak; poruka „Redovno rasterećenje u nedelji n + 1 otpada: nedelja n je smanjena (A17)."',
    place:
      'assess.ts (reduced); steps.ts framesFor, A17_MAX_RUN; validate.ts (M5); adapt.ts (poruka)',
    rationale: 'Kao 10K A17 (odluka organizatora 10K N1): smanjena nedelja je već oporavak.'
  }
];

/** Nivo lestvice: deonice (broj × metraža) ili kontinuirano (km). */
type Level = Structure;
const reps = (n: number, repM: number): Level => ({ form: 'reps', reps: n, repM });
const cont = (km: number): Level => ({ form: 'continuous', km });

export const MARATHON_V2_POLICY = {
  id: 'marathon-v2',
  version: 'marathon-v2.3.0',

  /** M1 (dani i obim: M15). */
  input: {
    weeksMin: 12,
    weeksMax: 24,
    resultMaxAgeDays: 84,
    resultDistancesM: [5000, 10000, 21097.5, 42195] as readonly number[],
    /** M1: rezultat 5 km dozvoljen uz upozorenje RESULT_5K. */
    shortResultM: 5000,
    vdotMin: 30,
    vdotMax: 80,
    /** M13a: opseg skorašnjeg najdužeg trka [km]. */
    recentLongMinKm: 5,
    recentLongMaxKm: 42
  },

  /** M16: plan po osećaju (bez pouzdanog rezultata). */
  feel: {
    /** Opseg ulaza easyPaceSecPerKm [s/km]. */
    easyPaceMinSec: 270,
    easyPaceMaxSec: 510,
    /** E = lagan tempo ± eRangeSec. */
    eRangeSec: 15,
    /** Procena VDOT-a (orijentir brzih zona) ograničena na vdotMin–vdotMax. */
    vdotMin: 25,
    vdotMax: 60,
    /** RPE po zoni rada (1–10). */
    rpe: {
      T: { min: 6, max: 7, cue: 'udobno teško, kratke rečenice' },
      I: { min: 8, max: 8, cue: 'teško, izdrživo 3–5 min' },
      R: { min: 8, max: 8, cue: 'brzo, opušteno' },
      MP: { min: 5, max: 6, cue: 'ritam maratona' }
    }
  },

  /** M16: test (samo plan po osećaju koji nije početnik). */
  test: { km: 5 },

  /** M17: JEDINA tabela početnika (udeo dugog, min i max nedelje: red M15 za isti broj dana). */
  beginner: {
    days: {
      4: { kmMin: 25, kmMax: 45 },
      5: { kmMin: 30, kmMax: 50 }
    },
    weeksMin: 16,
    /** Nedelje 1..introWeeks bez kvaliteta. */
    introWeeks: 2,
    growth: 0.05,
    growthMinKm: 1.0,
    growthMaxKm: 2.5,
    peakFactor: 1.5,
    peakAddKm: 25,
    /** Prvi nivo lestvice T kontinuirano početnika = najmanja T doza rasterećenja početnika [km]. */
    tFirstKm: 1.5,
    /** Upozorenje MARATHON_LONG_SHORT („cilj: završiti") kad je najduži dugi < longShortKm. */
    longShortKm: 24,
    /** WU/CD uvek prvi pojas M14. */
    warmupSec: 900,
    cooldownSec: 600
  },

  /** M15: JEDINA tabela po broju dana trčanja. */
  days: {
    3: {
      quality: 1,
      easy: 1,
      kmMin: 30,
      kmMax: 50,
      peakMaxKm: 60,
      longMaxShare: 0.5,
      weekMinKm: 15
    },
    4: {
      quality: 2,
      easy: 1,
      kmMin: 35,
      kmMax: 65,
      peakMaxKm: 80,
      longMaxShare: 0.4,
      weekMinKm: 20
    },
    5: {
      quality: 2,
      easy: 2,
      kmMin: 40,
      kmMax: 85,
      peakMaxKm: 100,
      longMaxShare: 0.35,
      weekMinKm: 25
    },
    6: {
      quality: 2,
      easy: 3,
      kmMin: 50,
      kmMax: 110,
      peakMaxKm: 120,
      longMaxShare: 0.32,
      weekMinKm: 30
    }
  },

  /** M2: udeli VDOT-a po zonama; korekcija VDOT-a za MP po pojasu trenutnog obima. */
  paces: {
    eFractionFast: 0.7,
    eFractionSlow: 0.62,
    tFraction: 0.88,
    iFraction: 0.975,
    rFraction: 1.05,
    raceDistanceM: 42195,
    mpCorrection: [
      { fromKm: 0, vdot: -2.0 },
      { fromKm: 40, vdot: -1.0 },
      { fromKm: 60, vdot: 0 }
    ] as readonly { fromKm: number; vdot: number }[]
  },

  /** M3: dozvoljen rast VDOT-a po nedelji plana. */
  goal: { realisticPerWeek: 0.08, ambitiousPerWeek: 0.16 },

  /** M4: specifično po broju nedelja izgradnje B (poslednji red sa fromBuild ≤ B). */
  phases: {
    specific: [
      { fromBuild: 0, weeks: 4 },
      { fromBuild: 13, weeks: 5 },
      { fromBuild: 17, weeks: 6 }
    ] as readonly { fromBuild: number; weeks: number }[],
    taperWeeks: 2,
    raceWeeks: 1
  },

  /** M5. */
  deload: {
    maxBuildRun: 3,
    exceptionRun: 4,
    firstAllowedWeek: 3,
    factor: 0.8,
    tShare: 0.6,
    tMinKm: 2.0,
    longFactor: 0.8
  },

  /** M6 (max nedelje: M15). */
  volume: {
    growth: 0.06,
    growthMinKm: 1.0,
    growthMaxKm: 5.0,
    peakFactor: 1.5,
    peakAddKm: 30
  },

  /** M7: nedelje tapera redom (N−2, N−1). tShare null = bez T. */
  taper: {
    weeks: [
      { factor: 0.8, mpShare: 0.6, tShare: 0.6, longFactor: 0.65 },
      { factor: 0.6, mpShare: 0.5, tShare: null, longFactor: 0.45 }
    ] as readonly {
      factor: number;
      mpShare: number;
      tShare: number | null;
      longFactor: number;
    }[],
    mpMin: reps(2, 3000),
    tMinKm: 2.0
  },

  /** M8. */
  raceWeek: {
    maxRunDays: 5,
    sharpener: { reps: 2, repM: 2000, recoverySec: 120 },
    sharpenerMinGapDays: 3,
    eveEasySec: 1200,
    eveStrides: { reps: 4, sec: 20 },
    eveMaxSec: 1800,
    otherEasySec: 1800,
    raceKm: 42.2,
    raceDistanceM: 42195,
    raceWarmupSec: 300
  },

  /** M9. */
  schedule: { defaultLongDay: 'sun' as const },

  /** M10: lestvice rastućom dozom. */
  ladders: {
    R: [
      reps(6, 200),
      reps(8, 200),
      reps(6, 300),
      reps(10, 200),
      reps(8, 300),
      reps(8, 400)
    ] as readonly Level[],
    T_continuous: [
      cont(2.0),
      cont(3.0),
      cont(4.0),
      cont(5.0),
      cont(6.0),
      cont(8.0)
    ] as readonly Level[],
    T_cruise: [
      reps(2, 1200),
      reps(3, 1000),
      reps(3, 1600),
      reps(4, 1600),
      reps(5, 1600),
      reps(3, 3200)
    ] as readonly Level[],
    I: [
      reps(2, 1000),
      reps(3, 1000),
      reps(4, 1000),
      reps(5, 1000),
      reps(5, 1200)
    ] as readonly Level[],
    MP: [
      reps(2, 3000),
      reps(2, 4000),
      reps(2, 5000),
      cont(12),
      reps(2, 7000),
      cont(16)
    ] as readonly Level[]
  },

  /** M10: „ista doza druge strukture" (pouka 11). */
  alternatives: {
    repsMin: 2,
    repsMax: 5,
    roundM: 100,
    roundFallbackM: 50,
    tRepMinM: 1000,
    mpRepMinM: 3000,
    mpContinuousMaxKm: 16,
    iRepsMax: 6,
    iRepMinM: 800,
    iRepMaxM: 1200,
    iPyramidM: [1200, 1000, 800] as readonly number[],
    /** M10a (pouka 27): korak piramide [m]. */
    pyramidStepM: 200,
    rRepM: [200, 300, 400] as readonly number[]
  },

  /** M11: jedan plafon po zoni, po treningu, udeo ciljnog obima nedelje. */
  caps: { R: 0.05, I: 0.08, T: 0.1, MP: 0.2 },

  /** M13 (udeo dugog: M15). */
  lengths: { longMaxSec: 9000, easyMinKm: 5.0, longShortKm: 26 },

  /** M13a (pouka 28, izmena organizatora MAR-02): dugi ≤ max(factor × L; L + addKm), L = najduži dugi
      prethodnih `windowWeeks` nedelja (skorašnji najduži iz ulaza = „nedelja 0"). */
  longJump: { factor: 1.1, addKm: 1.0, windowWeeks: 4 },

  /** M12: početni nivo slota ≤ udeo plafona zone (M11). */
  startLevel: { capShare: 0.6 },

  /** M14. */
  workout: {
    /** WU/CD po pojasu trenutnog obima: poslednji pojas sa fromKm ≤ obim (0,1 km). */
    warmupCooldown: [
      { fromKm: 0, warmupSec: 900, cooldownSec: 600 },
      { fromKm: 50, warmupSec: 1200, cooldownSec: 900 },
      { fromKm: 70, warmupSec: 1500, cooldownSec: 900 }
    ] as readonly { fromKm: number; warmupSec: number; cooldownSec: number }[],
    iRecoveryMaxSec: 240,
    iRecoveryStepSec: 15,
    /** Oporavak po dužini deonice: ≤ shortMaxM → shortSec, inače longSec. */
    tCruiseRecovery: { shortMaxM: 1600, shortSec: 60, longSec: 90 },
    mpRecovery: { shortMaxM: 4000, shortSec: 90, longSec: 120 }
  },

  /** Tehnička tolerancija: planirano vs cilj (zaokruženje dana na 0,1 km). */
  tolerance: { plannedKm: 0.1 },

  /** M18 (segment 04): adaptacija (A1–A17). Rezultat: starost i VDOT kao ulaz; donja granica cilja: weekMinKm
      (M15, A9); lagan ≥ lengths.easyMinKm. */
  adapt: {
    /** A2/A5/A6: prozor [dana]. */
    windowDays: 7,
    /** A2: izvršeno < underShare planiranog → cilj max(izvršeno, underFloorShare × cilj nedelje). */
    underShare: 0.6,
    underFloorShare: 0.8,
    /** A3: pauza [dana bez trčanja] → udeo obima 7 dana pre pauze. */
    pause: {
      shortDays: 7,
      midDays: 14,
      longDays: 28,
      shortShare: 0.8,
      midShare: 0.7,
      longShare: 0.5
    },
    /** A3 (M18): nov start i < ovoliko nedelja do trke → cilj „orijentir". */
    restartFullPrepWeeks: 12,
    /** A4 (M18): bol ≥ painMin u poslednjih painLookbackDays dana → painDays dana bez kvaliteta i ubrzanja, dugi
        ≤ painLongMaxSec, lagani × painEasyFactor (≥ 5 km); bol ≥ painRestMin → najpre restDays dana odmora. */
    painMin: 4,
    painRestMin: 7,
    painLookbackDays: 3,
    painDays: 7,
    restDays: 3,
    painLongMaxSec: 3600,
    painEasyFactor: 0.7,
    /** A5: ≥ fatigueCount laganih treninga u windowDays sa RPE ≥ fatigueRpe. */
    fatigueRpe: 7,
    fatigueCount: 2,
    /** A6: izvršeno > overShare planiranog u 2 uzastopna prozora. */
    overShare: 1.15,
    /** A8: povratni rast +returnGrowth (min returnGrowthMinKm) do nivoa pre smanjenja. */
    returnGrowth: 0.1,
    returnGrowthMinKm: 1.0,
    orientationMessage:
      'Cilj je orijentir: posle duge pauze do maratona ostaje manje od 12 nedelja, priprema nije potpuna (A3, M18).',
    painMessage:
      'Bol: 7 dana bez kvaliteta i ubrzanja, dugi ≤ 60 min, lagani kraći. Ako bol traje ili se pojačava, potraži stručni pregled (A4).'
  },

  DECISIONS
} as const;

export type MarathonV2Policy = typeof MARATHON_V2_POLICY;

/** Podržani brojevi dana trčanja (M15). */
export type RunDaysCount = keyof MarathonV2Policy['days'];
export interface DayRule {
  readonly quality: 1 | 2;
  readonly easy: number;
  readonly kmMin: number;
  readonly kmMax: number;
  readonly peakMaxKm: number;
  readonly longMaxShare: number;
  readonly weekMinKm: number;
}

export const RUN_DAYS_COUNTS = Object.keys(MARATHON_V2_POLICY.days)
  .map(Number)
  .sort((a, b) => a - b) as readonly RunDaysCount[];

/** M15: red tabele za broj dana trčanja; null za broj koji tabela nema. */
export function dayRule(count: number): DayRule | null {
  return (RUN_DAYS_COUNTS as readonly number[]).includes(count)
    ? MARATHON_V2_POLICY.days[count as RunDaysCount]
    : null;
}

/** M17: brojevi dana trčanja početnika. */
export const BEGINNER_DAYS_COUNTS = Object.keys(MARATHON_V2_POLICY.beginner.days)
  .map(Number)
  .sort((a, b) => a - b) as readonly (keyof MarathonV2Policy['beginner']['days'])[];

/** Pravilo plana: red M15 (redovan) ili red M15 izmenjen tabelom početnika (M17). Jedino mesto gde se brojevi
    rasta, vrha, uvoda, WU/CD, praga dugog i test plana po osećaju biraju po iskustvu. */
export interface PlanRule extends DayRule {
  readonly beginner: boolean;
  /** M6/M17: rast nedelje izgradnje i granica vrha. */
  readonly growth: number;
  readonly growthMinKm: number;
  readonly growthMaxKm: number;
  readonly peakFactor: number;
  readonly peakAddKm: number;
  /** M17: nedelje 1..introWeeks bez kvaliteta (0 = nema uvoda). */
  readonly introWeeks: number;
  /** M1/M17: najmanje nedelja. */
  readonly weeksMin: number;
  /** M16/M17: plan po osećaju ima test 5 km (početnik nema). */
  readonly feelTest: boolean;
  /** M13/M17: prag upozorenja MARATHON_LONG_SHORT [km]. */
  readonly longShortKm: number;
  /** M14/M17: WU/CD fiksno (početnik); null = po pojasu trenutnog obima. */
  readonly fixedWarmupCooldown: { readonly warmupSec: number; readonly cooldownSec: number } | null;
}

export function planRule(count: number, experience: Experience = 'regular'): PlanRule | null {
  const d = dayRule(count);
  if (!d) return null;
  const P = MARATHON_V2_POLICY;
  if (experience === 'regular')
    return {
      ...d,
      beginner: false,
      growth: P.volume.growth,
      growthMinKm: P.volume.growthMinKm,
      growthMaxKm: P.volume.growthMaxKm,
      peakFactor: P.volume.peakFactor,
      peakAddKm: P.volume.peakAddKm,
      introWeeks: 0,
      weeksMin: P.input.weeksMin,
      feelTest: true,
      longShortKm: P.lengths.longShortKm,
      fixedWarmupCooldown: null
    };
  const b = P.beginner;
  if (!(BEGINNER_DAYS_COUNTS as readonly number[]).includes(count)) return null;
  const row = b.days[count as keyof typeof b.days];
  return {
    ...d,
    quality: 1,
    easy: count - 2,
    kmMin: row.kmMin,
    kmMax: row.kmMax,
    beginner: true,
    growth: b.growth,
    growthMinKm: b.growthMinKm,
    growthMaxKm: b.growthMaxKm,
    peakFactor: b.peakFactor,
    peakAddKm: b.peakAddKm,
    introWeeks: b.introWeeks,
    weeksMin: b.weeksMin,
    feelTest: false,
    longShortKm: b.longShortKm,
    fixedWarmupCooldown: { warmupSec: b.warmupSec, cooldownSec: b.cooldownSec }
  };
}
