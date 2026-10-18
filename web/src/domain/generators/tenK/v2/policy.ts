/* 10K v2 — politika: svaki trenerski broj ima JEDNO mesto (ovde) i red u DECISIONS sa obrazloženjem.
   Kod ostalih fajlova čita samo ovaj objekat (i `dayRule`, pristup tabeli D17); nijedan od njih ne nosi
   sopstveni trenerski broj. */

/** Deonica lestvice: broj × metraža. */
interface Rep {
  readonly reps: number;
  readonly repM: number;
}

export interface Decision {
  readonly id: string;
  readonly rule: string;
  readonly place: string;
  readonly rationale: string;
}

const DECISIONS: readonly Decision[] = [
  {
    id: 'D1',
    rule: '3–6 dana trčanja i obim po broju dana (D17); 8–18 celih nedelja do trke (8–9 nedelja: D21); rezultat 3/5/10 km ili polumaraton ≤ 84 dana; VDOT 30–80; cilj opcion.',
    place: 'input.ts',
    rationale:
      'Opseg segmenta 02. Van opsega strukturisano odbijanje: 1, 2 i 7 dana trajno (D17), obim van reda tabele D17 trajno (poruka navodi brojeve dana koji ga podržavaju), bez pouzdanog rezultata privremeno (plan po osećaju, segment 03), < 8 ned trajno.'
  },
  {
    id: 'D2',
    rule: 'VDOT iz rezultata (Daniels–Gilbert); zone E/T/I/R kao udeo VDOT-a; RP = tempo prognoze 10K iz trenutnog VDOT-a; tempo fiksan kroz plan.',
    place: 'paces.ts (udeli: paces)',
    rationale:
      'Jednačine su objavljeni model (Daniels i Gilbert 1979). Udeli su 10K odluka u skladu sa Danielsovim opisom zona (sekundarni izvor: E ≈ 59–74 %, T ≈ 83–88 %, I ≈ 95–100 % VO2max); R = 1,05 je heuristika (R nije definisan udelom VO2max). RP iz cilja bi trening vezao za neproveren broj; menja ga samo adaptacija (04).'
  },
  {
    id: 'D3',
    rule: 'Δ = VDOT cilja − trenutni VDOT; Δ ≤ 0,1·N realističan, ≤ 0,2·N ambiciozan, više nerealan (upozorenje).',
    place: 'paces.ts assessGoal (pragovi: goal)',
    rationale:
      'Heuristika napretka po nedelji. Nerealan cilj je upozorenje, ne odbijanje, i ne menja tempo; sporiji od prognoze je realističan.'
  },
  {
    id: 'D4',
    rule: 'Poslednja nedelja trka, pretposlednja taper; B = N − 2: specifično 3 (B ≤ 11) ili 4; baza = ceil((B − spec)/2); razvoj = ostatak. B ≤ 7: D21.',
    place: 'periodize.ts (phases)',
    rationale:
      'Ukupno smanjenje ≈ 13 dana (taper + 6 dana trkačke nedelje), u opsegu 8–14 dana iz meta-analize Bosquet i sar. 2007 (više sportova, nije 10K-specifično: 8–14 dana, obim −41–60 %, intenzitet i učestalost zadržani).'
  },
  {
    id: 'D5',
    rule: 'Najviše 3 uzastopne nedelje izgradnje (izuzetno 4 kad bi rasterećenje palo na prvu nedelju faze); nikad na prvoj nedelji faze, u ned 1–2, pred taperom, u taperu/trkačkoj. Cilj 0,8 × poslednji ne-rasteretni; 1 kvalitet T ≈ 60 % (nivo naniže, min 2,0 km; 3 dana: D18); dugi 0,8 × poslednji ne-rasteretni; ostali dani lagani.',
    place: 'periodize.ts (gde), week.ts + quality.ts + lengths.ts (sadržaj), volume.ts (cilj)',
    rationale:
      'Heuristika 3:1. Raspored se bira determinističkom pretragom: najmanje rasterećenja, pa izgradnja što ranije (rasterećenje što kasnije). Odstupanje (opreznije, D11 ispred D5): kad ni najmanja T doza (2,0 km) ne staje u plafon D11 cilja rasterećenja, rasterećenje je bez kvaliteta (dugi + lagani, napomena, upozorenje DELOAD_NO_QUALITY); npr. 3 dana, 12 ned, 20 km, VDOT 45, uto/čet/ned: ned 4 cilj 18,0 km, plafon T 1,8 km.'
  },
  {
    id: 'D6',
    rule: 'Ned 1 = trenutni obim; izgradnja +6 % poslednjeg ne-rasteretnog cilja (min 1,0, max 3,0 km, korak 0,1); vrh = min(start × 1,4; start + 15; max nedelje D17; kapacitet). Kapacitet = stvarna konstrukcija nedelje; neizvodljiv cilj → samo ta nedelja na najbliži izvodljiv cilj (napomena). Spuštena nedelja izgradnje → CAPACITY_LIMITED (poruka D22).',
    place: 'volume.ts (jedini vlasnik cilja i poruke); generate.ts + validate.ts prijavljuju',
    rationale:
      'Heuristika umerenog rasta. Kapacitet nije formula: cilj nedelje se proverava stvarnom konstrukcijom (week.ts); granica izgradnje se ne spušta zbog jedne nedelje, a sledeći rast meri se od cilja koji je nedelja stvarno dobila.'
  },
  {
    id: 'D7',
    rule: 'Taper: cilj 0,75 × vrh; RP i T, svaki ≈ 60 % poslednje doze zone (naniže; min 2 × 1000 m RP, 2,0 km T; 3 dana samo RP, D18); dugi ≤ 0,75 × najduži; svi dani trčanja zadržani.',
    place: 'week.ts + quality.ts + lengths.ts; cilj volume.ts',
    rationale:
      'Smanjen obim uz zadržan intenzitet i učestalost (Bosquet i sar. 2007, isti ograničeni dokaz kao D4): učestalost = broj dana iz ulaza (4 dana → 4, kao u 10k-v2.1.0). Odstupanja (opreznije, samo kad nijedan cilj ≤ 0,75 × vrh nije izvodljiv po pravilu): (a) 4–6 dana — taper samo sa RP, ostali dani lagani (TAPER_RP_ONLY); npr. 6 dana, 8 ned, 35 km, VDOT 70: cilj 33,2 km, dva kvaliteta ≈ 22 km (WU/CD 35 min), lagani bi bili < 3 km; (b) kad ni RP 2 × 1000 m ne staje u plafon D11 — taper bez kvaliteta (D11 ispred D7, TAPER_NO_QUALITY); npr. 3 dana, 8 ned, 20 km: cilj 19,0 km, plafon RP 1,9 km.'
  },
  {
    id: 'D8',
    rule: 'Trkačka nedelja: broj dana po D20; trka zamenjuje dugi; oštrenje WU + 3 × 1000 m RP (90 s) + CD ako je RP doza tapera ≥ 3,0 km, inače 2 × 1000 m (oštrenje ≤ RP doza tapera), na najkasnijem danu ≥ 3 dana pre trke; WU/CD oštrenja po D14; dan pred trku 20 min E + 4 × 20 s (≤ 30 min); ostali 35 min E, ali ne duže od laganog dana tapera (D23); trka 10 km + WU 15 + CD 10 van obima; cilj = planirano.',
    place: 'week.ts (raceWeek) + workouts.ts',
    rationale:
      'Fiksna trenerska heuristika. D8 je potpuna specifikacija trkačke nedelje, pa se plafon D11 na nju ne primenjuje (oštrenje 3 km RP je > 10 % cilja od 13–20 km). Oštrenje ne sme biti veće od RP doze tapera (zamenjuje prag „vrh < 35 km" iz 10k-v2.0.0). WU/CD trke ostaju 15/10 min (D8, van obima). Oštrenje mora biti nesusedno poslednjem zahtevnom danu tapera (D9). Odstupanja (opreznije): kad nijedan dan trčanja nije ≥ 3 dana pre trke i nesusedan tom danu (samo 3 dana, npr. pet/sub/ned ili pon/pet/ned uz trku u nedelju) ili kad taper nema RP (D7 b), oštrenja nema — ostali dani po D8.'
  },
  {
    id: 'D9',
    rule: 'Šablon po broju dana (D17): 4–6 dana Q1 + Q2 + dugi + lagani (D19), 3 dana jedan kvalitet + dugi + lagan (D18); teški dani (kvaliteti i dugi) međusobno nesusedni (ciklično); ostali dani lagani; dugi: dan iz ulaza, inače nedelja, inače poslednji dan trčanja; nema rešenja → SCHEDULE_NO_RECOVERY sa predlogom.',
    place: 'schedule.ts',
    rationale:
      'Dan oporavka između zahtevnih dana. Kad postoji više rešenja: najveći razmak dugi → Q1, pa Q1 → Q2, pa raniji Q1 (tehnički, deterministički izbor).'
  },
  {
    id: 'D10',
    rule: 'Baza: Q1 R, Q2 T kontinuirano; razvoj: Q1 I, Q2 T cruise; specifično: Q1 RP, Q2 T cruise (3 dana: D18); lestvice u ladders; ista doza druge strukture pravilom: T kontinuirano ↔ 2–5 jednakih deonica ≥ 1000 m deljivih sa 100 m, a kad takve podele nema, sa 50 m (D22); I do 6 jednakih deonica 800–1200 m ili piramida 1200 + 1000 + 800 m (3,0 km); RP 2–5 jednakih deonica po istom pravilu kao T (D22b); R deonice 200 / 300 / 400 m (D22).',
    place: 'workouts.ts (lestvice, strukture), quality.ts (izbor)',
    rationale:
      'Heuristika redosleda razvoja (brzina/ekonomija → prag/VO2max → specifičnost). Pravilo prihvata samo tačne podele (bez promene doze). Kad druga struktura ne postoji, slot ponavlja trening (nedelja se razlikuje po drugom slotu). Piramida: samo primer iz odluke (800/1000/1200 m po jednom, ukupno 3,0 km), bez drugih kombinacija.'
  },
  {
    id: 'D11',
    rule: 'Jedan plafon po zoni, po treningu, % ciljnog obima nedelje: R 5 %, I 8 %, T 10 %, RP 10 %.',
    place: 'policy.ts caps; proverava quality.ts (izbor) i validate.ts',
    rationale:
      'R/I/T prema Danielsu (sekundarni izvor, ne dokaz); RP heuristika. Nema drugih limita za iste zone. Ne važi za trkačku nedelju (D8).'
  },
  {
    id: 'D12',
    rule: 'Po slotu: sledeći nivo ako staje u plafon (≤ 1 nivo/ned), inače ista doza druge strukture; doza ne pada van rasterećenja/tapera/trke; T cruise ≥ poslednje T kontinuirano; RP ≥ poslednje I (3 dana: RP ≥ poslednje T, D18); glavna doza (T + I + RP) ne opada; nema identičnih uzastopnih ne-rasteretnih nedelja; baza bez platoa (tvrdo, D22). D11 ispred D12: kad nijedan cilj nedelje nije izvodljiv uz „doza ne pada", doza van plafona ide na najviši nivo lestvice u plafonu (napomena, DOSE_DROPPED).',
    place: 'quality.ts',
    rationale:
      'Postepena progresija bez skokova; „sledeći nivo" = najmanji nivo lestvice veći od trenutne doze; početni nivo određuje D16. Plafon zone ispred progresije: usvojena odluka posle segmenta 01 (u 10k-v2.0.0 vođeno kao odstupanje). Odstupanje „baza bez platoa" iz 10k-v2.1.0 je ukinuto (D22): T 2,5 / 3,5 km sada imaju drugu strukturu. Odstupanje (opreznije, samo 3 dana, jedan slot): kad druga struktura iste doze ne postoji (D10, D22b: RP 2,5 / 3,5 km imaju samo 2 × 1250 / 2 × 1750 m), slot ponavlja trening uz napomenu i nedelja je ista kao prethodna; npr. 3 dana, 17 ned, 20 km, VDOT 45: ned 14–15 RP 2,5 km. Kod 3 dana prelaz T kontinuirano → T cruise koji bi ponovio isti trening ide po pravilu iste lestvice (sledeći nivo ili druga struktura).'
  },
  {
    id: 'D13',
    rule: 'Dugi ≤ udeo cilja po broju dana (D17) i ≤ 105 min sporim E; korak 0,1 km; dugi ≥ svaki lagan (tvrdo); lagan ≥ 3 km; lagani dani jednaki (D19).',
    place: 'lengths.ts (jedini vlasnik dužina)',
    rationale:
      'Udeo raste kad je dana manje jer dugi mora biti ≥ lagan i ostaviti mesta za kvalitet; pri 4 dana i 30 km dugi ≈ 10 km ≥ distanca trke. Dugi uzima najveću dozvoljenu dužinu (do lagan ≥ 3 km), lagani ostatak.'
  },
  {
    id: 'D14',
    rule: 'WU/CD E po pojasu trenutnog obima iz ulaza (0,1 km), konstantno kroz plan, isti za sve brojeve dana: < 35 km → 15/10 min; 35–44,9 km → 20/15 min; ≥ 45 km → 25/15 min (fiksni deo treninga, nikad pufer); km po srednjem E; oporavci: R isti metraž džogom, I 1:1 vreme zaokruženo naniže na 15 s (max 4:00), T cruise 60 s, RP 60 s (≤ 1200 m) / 90 s (1500–2000 m) / 120 s (3000 m).',
    place: 'workouts.ts (warmupCooldown, recoveryOf)',
    rationale:
      'Trkač većeg obima ima duže zagrevanje; kvalitetni dan nosi srazmeran deo nedelje. RP deonice van navedenih opsega (1300–1400 m, 2100–2900 m) dobijaju sledeći duži oporavak (opreznije). Ubrzanja (D8) su R zona: oporavak isti metraž džogom.'
  },
  {
    id: 'D15',
    rule: 'Uslov 8: nedelja ≥ minimum po broju dana (D17; trkačka bez trke); lagan ≥ 3 km; prazan trening, dugi < lagan, nedelja ispod minimuma = greška; takav ulaz se odbija.',
    place: 'policy.ts days + validate.ts',
    rationale:
      'Upotrebljivost, ne samo aritmetika: degenerisan plan se ne predaje. Odstupanje: trkačka nedelja je potpuno zadata (D8/D20, fiksna trajanja), pa je ispod minimuma upozorenje RACE_WEEK_SHORT, ne greška (nedelja se ne puni); npr. 3 dana, 8 ned, 20 km, VDOT 30: 2 × 35 min E = 8,7 km < 9 km.'
  },
  {
    id: 'D16',
    rule: 'Početni nivo slota (prva nedelja baze; prva nedelja nove zone na prelazu faze: I u razvoju, RP u specifičnoj) = najviši nivo lestvice ≤ 60 % plafona zone (D11) za cilj te nedelje; najmanje prvi nivo; na prelazu i dalje važi D12 (RP ≥ poslednje I, kod 3 dana poslednje T).',
    place: 'quality.ts (startLevel)',
    rationale:
      'Heuristika: kvalitetni dan nosi srazmeran deo nedelje, pa trkač većeg obima ne kreće sa najnižeg nivoa; 60 % plafona ostavlja prostor za progresiju D12. T cruise posle T kontinuiranog nije nova zona (samo D12).'
  },
  {
    id: 'D17',
    rule: 'Tabela po broju dana (days, JEDINA): 3 dana 1 kvalitet + 1 lagan + dugi, obim 20–40 km, max nedelje 45 km, dugi ≤ 45 % (10k-v2.2.1; bilo 40 %), min nedelje 9 km; 4 dana 2 + 1 + dugi, 25–55, 60, 33 %, 12; 5 dana 2 + 2 + dugi, 30–65, 75, 30 %, 15; 6 dana 2 + 3 + dugi, 35–80, 90, 27 %, 18. Vrh = min(start × 1,4; start + 15; max nedelje; kapacitet); dugi ≤ 105 min sporim E za sve; 1, 2 i 7 dana → RUN_DAYS_COUNT (7: najmanje jedan dan odmora); WU/CD pojas (D14) isti za sve.',
    place:
      'policy.ts days (dayRule); čitaju input.ts, schedule.ts, quality.ts, lengths.ts, volume.ts, week.ts, validate.ts',
    rationale:
      'Heuristika zadata za segment 02 (zamenjuje pojedinačne brojeve 4 dana bez promene). Izmena 10k-v2.2.1 (3 dana 0,40 → 0,45): sa 1 kvalitetom kvalitetni dan je < 20 % nedelje, pa dugi i lagan nose > 80 %; uz 40 % lagan bi bio > dugi i nedelja 1 je padala ispod trenutnog obima i kad dugi nije na 105 min. Simulacija organizatora na 49ad476, ponovljena (samo D17): ned 1 ispod obima zbog udela 396 → 0, ukupno 528 → 330 (svi sa dugim na 105 min), nijedan vrh cilja niži (12 planova: planirano niže ≤ 0,06 km, zaokruženje), 4–6 dana bez promene.'
  },
  {
    id: 'D18',
    rule: '3 dana — jedan kvalitet: baza T kontinuirano, razvoj T cruise, specifično RP; prelazi T cruise ≥ poslednje T kontinuirano, RP ≥ poslednje T doze; bez I i R; D11 i D16 važe. Rasterećenje: kvalitet T ≈ 60 % poslednje doze slota (min 2,0 km). Taper: jedan kvalitet RP ≈ 60 % poslednje RP doze (min 2 × 1000 m). Raspored: kvalitet i dugi nesusedni (ciklično); lagan bilo gde.',
    place: 'quality.ts (ladderFor, pickSlot, pickDeload, pickTaper); schedule.ts (patternOf)',
    rationale:
      'Sa 3 dana i plafonima D11 dva kvaliteta + dugi ne staju (dugi bi bio > 45 % nedelje); T i RP su najspecifičniji za 10K; FIRST (3 ključna treninga) odbačen jer krši D11.'
  },
  {
    id: 'D19',
    rule: '5 i 6 dana: kvalitet isti kao 4 dana (Q1 R/I/RP, Q2 T); lagani dani jednaki (zaokruženje 0,1, razlika ≤ 0,1 km; raniji dan dobija višak), svaki ≥ 3 km i ≤ dugi; Q1, Q2 i dugi međusobno nesusedni; ostali dani lagani. Rasterećenje: 1 kvalitet (D5) + dugi + ostali lagani.',
    place: 'lengths.ts (splitEasy), schedule.ts, week.ts',
    rationale:
      'Dodatni dani nose obim kao lagani dani; jednaka raspodela je najjednostavnije pravilo bez novog broja (ista kao raspodela rasterećenja 4 dana u 10k-v2.1.0).'
  },
  {
    id: 'D20',
    rule: 'Trkačka nedelja po broju dana: dana trčanja uključujući trku = min(broj dana, 5); otpada prvo dan dugog, pa najraniji lagan dan (šablona); oštrenje ≤ RP doza tapera (i za 3 dana); ostalo po D8.',
    place: 'week.ts (raceWeekRuns) + validate.ts',
    rationale:
      'Fiksna heuristika: najviše 4 treninga uz trku; trka zamenjuje dugi. Za 4 dana isto kao 10k-v2.1.0 (min(4, 5) = 4).'
  },
  {
    id: 'D21',
    rule: 'Kratka priprema (dopuna D4): kad je B = N − 2 ≤ 7: specifično 2, razvoj = ceil((B − 2)/2), baza = ostatak (8 ned → 2/2/2/1/1, 9 ned → 2/3/2/1/1); tačno jedno rasterećenje (druga nedelja razvoja) po pravilima D5. < 8 nedelja trajno odbijeno.',
    place: 'periodize.ts (phaseCounts); rasterećenje iz iste pretrage D5',
    rationale:
      'Heuristika: kraća priprema skraćuje specifičnu fazu na 2 nedelje i zadržava redosled faza; pravila D5 same daju jedino legalno mesto rasterećenja (ned 4).'
  },
  {
    id: 'D22',
    rule: 'Ispravke iz 01b: T druga struktura sa deonicama ≥ 1000 m deljivim sa 50 m kad podela na 100 m ne postoji (2,5 = 2 × 1250; 3,5 = 2 × 1750; 4,5 = 3 × 1500); R deonice 200 / 300 / 400 m; „baza bez platoa" ponovo tvrdo (BASE_PLATEAU = greška); CAPACITY_LIMITED imenuje stvarno ograničenje (dugi 105 min i/ili udeo dugog) i preporučuje više dana samo kad veći broj dana postoji (6 dana bez preporuke).',
    place:
      'workouts.ts (structuresForDose); validate.ts (BASE_PLATEAU); volume.ts (capacityMessage)',
    rationale:
      'Ukida ponavljanje slota u bazi i odstupanje iz 01b. Tumačenje primera: 50 m samo kad podele na 100 m nema — 4,5 km zadržava 3 × 1500 m (2 × 2250 m bi se pojavilo da 50 m važi uvek, a primer ga ne navodi).'
  },
  {
    id: 'D22b',
    rule: 'RP druga struktura kao T (D22): 2–5 jednakih deonica ≥ 1000 m deljivih sa 100 m, a kad takve podele nema, sa 50 m (2,5 = 2 × 1250; 3,5 = 2 × 1750); nijedna RP deonica < 1000 m.',
    place: 'workouts.ts (structuresForDose, isti splitsOf za T i RP); validate.ts (REP_MIN)',
    rationale:
      'Heuristika: isto pravilo kao T, bez novog broja; RP deonice < 1000 m (5 × 500, 5 × 700, 3 × 800, 4 × 600, 5 × 900 m) otpadaju. Odstupanje od očekivanja (opreznije, bez novog broja i bez nove strukture): očekivano je ponavljanje kod 3 dana ≈ 0, ali RP 2,4 / 2,5 / 3,5 / 4,5 km sada imaju samo jednu strukturu (2 × 1200, 2 × 1250, 2 × 1750, 3 × 1500 m), pa slot ponavlja trening (D10/D12): ponovljenih nedelja 3 dana 216 → 1224, 4 dana 48 → 192, 5 i 6 dana 0 → 144; npr. 3 dana, 9 ned, 20 km, VDOT 30, uto/čet/ned: ned 7 RP 2 × 1200 m ponovljen (bilo 3 × 800 m). RP kontinuirano (kao T) bi uklonilo ponavljanje, ali je nova trenerska odluka — nije uvedeno. Posledica: manje oporavaka → kraći kvalitetni dan → u 258 planova ograničenih kapacitetom niži vrh cilja (do 1,1 km; npr. 4 dana, 16 ned, 35 km, VDOT 35, uto/čet/sub/ned: 48,0 → 46,9 km, ned 14 RP 3 × 1500 umesto 5 × 900 m); izuzeci sa razlogom u segment02b.regression-exceptions.json.'
  },
  {
    id: 'D23',
    rule: 'Trkačka nedelja ≤ taper: lagan dan trkačke nedelje = min(35 min E, km najkraćeg laganog dana tapera); kad je lagan tapera kraći, dan se zadaje u km. Invarijanta: planirano trkačke nedelje (bez trke) ≤ planirano tapera.',
    place:
      'week.ts (raceWeek, raceEasyWorkout); generate.ts (lagan tapera); validate.ts (RACE_WEEK_EASY, RACE_WEEK_OVER_TAPER)',
    rationale:
      'Smanjenje obima se ne sme poništiti u trkačkoj nedelji (D4/D7). Na 49ad476 trkačka > taper u 8 / 57 / 9 planova 4 / 5 / 6 dana: brz trkač malog obima, 35 min E (npr. 8,8 km pri VDOT 70) > lagan tapera. Najkraći lagan tapera (lagani se razlikuju ≤ 0,1 km, D19) je opreznija strana. Oštrenje i dan pred trku ostaju po D8. Posledica: lagan u km u 636 / 1428 / 2004 / 2538 planova 3–6 dana; trkačka ispod minimuma nedelje (RACE_WEEK_SHORT, upozorenje D15) 6 dana 0 → 90 (35 km, VDOT 30–50).'
  },
  {
    id: 'D25',
    rule: 'UPOZORENJE LONG_SHORTER_THAN_QUALITY (ne greška, plan se ne menja): u ne-rasteretnoj nedelji izgradnje najduži kvalitetni dan je po trajanju duži od dugog. Poruka preporučuje manje dana trčanja kad red tabele D17 sa manje dana podržava trenutni obim.',
    place: 'validate.ts (LONG_SHORTER_THAN_QUALITY); volume.ts (fewerDaysAdvice)',
    rationale:
      'Na 49ad476 i 10k-v2.2.1: 0 / 132 / 132 / 330 planova 3–6 dana — brz trkač na najnižim obimima reda (4 dana 25 km VDOT 60–70; 5 dana 30–35 km VDOT 70; 6 dana 35–45 km VDOT 55–70): WU/CD po pojasu D14 + rad > dugi. Kraći WU/CD po vremenu nedelje bi ovo rešio, ali simulacija organizatora na 49ad476 (nije ponovljena u 02b) pokazuje regresiju kapaciteta 4 dana (ispod obima zbog udela 0 → 66, CAPACITY_LIMITED 1320 → 1830, 234 niža vrha) — zato samo upozorenje; manje dana daje dugi veći udeo (D17).'
  }
];

export const TEN_K_V2_POLICY = {
  id: '10k-v2',
  version: '10k-v2.2.1',

  /** D1 (dani i obim: D17). */
  input: {
    /** < 8 nedelja: trajno odbijanje (D21 pokriva 8–9). */
    weeksMin: 8,
    weeksMax: 18,
    resultMaxAgeDays: 84,
    resultDistancesM: [3000, 5000, 10000, 21097.5] as readonly number[],
    vdotMin: 30,
    vdotMax: 80
  },

  /** D17: JEDINA tabela po broju dana trčanja. quality/easy = broj kvalitetnih i laganih dana izgradnje. */
  days: {
    3: {
      quality: 1,
      easy: 1,
      kmMin: 20,
      kmMax: 40,
      peakMaxKm: 45,
      longMaxShare: 0.45,
      weekMinKm: 9
    },
    4: {
      quality: 2,
      easy: 1,
      kmMin: 25,
      kmMax: 55,
      peakMaxKm: 60,
      longMaxShare: 0.33,
      weekMinKm: 12
    },
    5: {
      quality: 2,
      easy: 2,
      kmMin: 30,
      kmMax: 65,
      peakMaxKm: 75,
      longMaxShare: 0.3,
      weekMinKm: 15
    },
    6: {
      quality: 2,
      easy: 3,
      kmMin: 35,
      kmMax: 80,
      peakMaxKm: 90,
      longMaxShare: 0.27,
      weekMinKm: 18
    }
  },

  /** D2: udeli VDOT-a po zonama (10K odluka). */
  paces: {
    eFractionFast: 0.7,
    eFractionSlow: 0.62,
    tFraction: 0.88,
    iFraction: 0.975,
    rFraction: 1.05,
    raceDistanceM: 10000
  },

  /** D3: dozvoljen rast VDOT-a po nedelji plana. */
  goal: { realisticPerWeek: 0.1, ambitiousPerWeek: 0.2 },

  /** D4 + D21. */
  phases: {
    specificShort: 3,
    specificLong: 4,
    specificShortMaxBuild: 11,
    /** D21: B ≤ shortPrepMaxBuild → specifično shortPrepSpecific, razvoj ceil((B − spec)/2). */
    shortPrepMaxBuild: 7,
    shortPrepSpecific: 2,
    taperWeeks: 1,
    raceWeeks: 1
  },

  /** D5. */
  deload: {
    maxBuildRun: 3,
    exceptionRun: 4,
    firstAllowedWeek: 3,
    factor: 0.8,
    tShare: 0.6,
    tMinKm: 2.0,
    longFactor: 0.8
  },

  /** D6 (max nedelje: D17). */
  volume: {
    growth: 0.06,
    growthMinKm: 1.0,
    growthMaxKm: 3.0,
    peakFactor: 1.4,
    peakAddKm: 15
  },

  /** D7. */
  taper: {
    factor: 0.75,
    doseShare: 0.6,
    rpMin: { reps: 2, repM: 1000 } as Rep,
    tMinKm: 2.0,
    longFactor: 0.75
  },

  /** D8 + D20. */
  raceWeek: {
    /** D20: dana trčanja uključujući trku = min(broj dana, maxRunDays). */
    maxRunDays: 5,
    /** Puno oštrenje kad je RP doza tapera ≥ reps × repM (3,0 km), inače sharpenerSmallReps. */
    sharpener: { reps: 3, repM: 1000, recoverySec: 90 },
    sharpenerSmallReps: 2,
    sharpenerMinGapDays: 3,
    eveEasySec: 1200,
    eveStrides: { reps: 4, sec: 20 },
    eveMaxSec: 1800,
    otherEasySec: 2100,
    raceKm: 10,
    raceWarmupSec: 900,
    raceCooldownSec: 600
  },

  /** D9. */
  schedule: { defaultLongDay: 'sun' as const },

  /** D10: lestvice (km u zoni). T kontinuirano u km; ostale deonice. */
  ladders: {
    R: [
      { reps: 6, repM: 200 },
      { reps: 8, repM: 200 },
      { reps: 6, repM: 300 },
      { reps: 10, repM: 200 },
      { reps: 8, repM: 300 }
    ] as readonly Rep[],
    T_continuous: [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0] as readonly number[],
    T_cruise: [
      { reps: 2, repM: 1000 },
      { reps: 2, repM: 1200 },
      { reps: 3, repM: 1000 },
      { reps: 3, repM: 1200 },
      { reps: 4, repM: 1000 },
      { reps: 3, repM: 1600 },
      { reps: 5, repM: 1000 },
      { reps: 4, repM: 1500 },
      { reps: 4, repM: 1600 },
      { reps: 5, repM: 1600 }
    ] as readonly Rep[],
    I: [
      { reps: 2, repM: 1000 },
      { reps: 3, repM: 800 },
      { reps: 3, repM: 1000 },
      { reps: 3, repM: 1200 },
      { reps: 4, repM: 1000 },
      { reps: 4, repM: 1200 },
      { reps: 5, repM: 1000 },
      { reps: 5, repM: 1200 }
    ] as readonly Rep[],
    RP: [
      { reps: 2, repM: 1200 },
      { reps: 3, repM: 1000 },
      { reps: 4, repM: 1000 },
      { reps: 3, repM: 1500 },
      { reps: 5, repM: 1000 },
      { reps: 3, repM: 2000 }
    ] as readonly Rep[]
  },

  /** D10 + D22 + D22b: „ista doza druge strukture". */
  alternatives: {
    repsMin: 2,
    repsMax: 5,
    roundM: 100,
    /** D22/D22b: T i RP deonice deljive sa 50 m kad podele na roundM ne postoje. */
    roundFallbackM: 50,
    /** D10/D22b: T i RP deonice ≥ 1000 m. */
    repMinM: 1000,
    iRepsMax: 6,
    iRepMinM: 800,
    iRepMaxM: 1200,
    iPyramidM: [1200, 1000, 800] as readonly number[],
    rRepM: [200, 300, 400] as readonly number[]
  },

  /** D11: jedan plafon po zoni, po treningu, udeo ciljnog obima nedelje. */
  caps: { R: 0.05, I: 0.08, T: 0.1, RP: 0.1 },

  /** D13 (udeo dugog: D17). */
  lengths: { longMaxSec: 6300, easyMinKm: 3.0 },

  /** D16: početni nivo slota ≤ udeo plafona zone (D11). */
  startLevel: { capShare: 0.6 },

  /** D14. */
  workout: {
    /** WU/CD po pojasu trenutnog obima: poslednji pojas sa fromKm ≤ obim (0,1 km). */
    warmupCooldown: [
      { fromKm: 0, warmupSec: 900, cooldownSec: 600 },
      { fromKm: 35, warmupSec: 1200, cooldownSec: 900 },
      { fromKm: 45, warmupSec: 1500, cooldownSec: 900 }
    ] as readonly { fromKm: number; warmupSec: number; cooldownSec: number }[],
    iRecoveryMaxSec: 240,
    iRecoveryStepSec: 15,
    tCruiseRecoverySec: 60,
    /** RP oporavak po dužini deonice (gornja granica uključena). */
    rpRecovery: [
      { maxRepM: 1200, sec: 60 },
      { maxRepM: 2000, sec: 90 },
      { maxRepM: 3000, sec: 120 }
    ] as readonly { maxRepM: number; sec: number }[]
  },

  /** Tehnička tolerancija: planirano vs cilj (zaokruženje dana na 0,1 km). */
  tolerance: { plannedKm: 0.1 },

  DECISIONS
} as const;

export type TenKV2Policy = typeof TEN_K_V2_POLICY;

/** Podržani brojevi dana trčanja (D17). */
export type RunDaysCount = keyof TenKV2Policy['days'];
export interface DayRule {
  readonly quality: 1 | 2;
  readonly easy: number;
  readonly kmMin: number;
  readonly kmMax: number;
  readonly peakMaxKm: number;
  readonly longMaxShare: number;
  readonly weekMinKm: number;
}

export const RUN_DAYS_COUNTS = Object.keys(TEN_K_V2_POLICY.days)
  .map(Number)
  .sort((a, b) => a - b) as readonly RunDaysCount[];

/** D17: red tabele za broj dana trčanja; null za broj koji tabela nema (1, 2, 7). */
export function dayRule(count: number): DayRule | null {
  return (RUN_DAYS_COUNTS as readonly number[]).includes(count)
    ? TEN_K_V2_POLICY.days[count as RunDaysCount]
    : null;
}
