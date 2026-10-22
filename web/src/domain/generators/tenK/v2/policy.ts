/* 10K v2 — politika: svaki trenerski broj ima JEDNO mesto (ovde) i red u DECISIONS sa obrazloženjem.
   Kod ostalih fajlova čita samo ovaj objekat (i `dayRule` / `planRule`, pristup tabeli D17 i tabeli
   početnika D28); nijedan od njih ne nosi sopstveni trenerski broj. */

import type { Experience } from './types.ts';

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
    rule: '3–6 dana trčanja i obim po broju dana (D17; početnik D28); 8–18 celih nedelja do trke (8–9 nedelja: D21; početnik 10–18); rezultat 3/5/10 km ili polumaraton ≤ 84 dana i VDOT 30–80 → tempo iz rezultata, inače plan po osećaju (D26); trčanje/hodanje odbijeno (D29); cilj opcion.',
    place: 'input.ts',
    rationale:
      'Opseg segmenta 03. Van opsega strukturisano odbijanje: 1, 2 i 7 dana trajno (D17), obim van reda tabele D17 trajno (poruka navodi brojeve dana koji ga podržavaju), < 8 ned trajno, VDOT > 80 trajno. Bez pouzdanog rezultata (nema ga, stariji od 84 dana, VDOT < 30) plan po osećaju (D26); privremeno odbijanje FEEL_PLAN_SEGMENT_03 iz 10k-v2.2.x je ukinuto.'
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
    rule: 'Najviše 3 uzastopne nedelje izgradnje (izuzetno 4 kad bi rasterećenje palo na prvu nedelju faze); nikad na prvoj nedelji faze, u ned 1–2, pred taperom, u taperu/trkačkoj. Cilj 0,8 × poslednji ne-rasteretni; 1 kvalitet T ≈ 60 % (nivo naniže, min 2,0 km; 3 dana: D18); dugi 0,8 × poslednji ne-rasteretni; ostali dani lagani. Izuzetak A17 (10k-v2.5.0): od redovnog rasterećenja ukinutog posle nedelje smanjenja najviše 5 uzastopnih nedelja izgradnje (uključujući ukinutu) do sledećeg redovnog rasterećenja.',
    place:
      'periodize.ts (gde), week.ts + quality.ts + lengths.ts (sadržaj), volume.ts (cilj); steps.ts framesFor + validate.ts (izuzetak A17)',
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
    rule: 'Taper: cilj 0,75 × vrh; RP i T, svaki ≈ 60 % poslednje doze zone (naniže; min 2 × 1000 m RP, 2,0 km T; 3 dana samo RP, D18); dugi ≤ 0,75 × najduži; svi dani trčanja zadržani. Najduži dugi (10k-v2.5.1) ima jednu definiciju za konstruktor i validator (lengths.longestLong10): najduži dugi nedelja pre tapera kakve se upisuju — posle adaptacije zaštićeni dani prethodnog plana (≤ asOf, urađeni, zaključani) kakvi jesu i sastavljena budućnost (written.ts, A11).',
    place:
      'week.ts + quality.ts + lengths.ts (longestLong10); written.ts (upisani dani, A11); cilj volume.ts',
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
    rule: 'Baza: Q1 R, Q2 T kontinuirano; razvoj: Q1 I, Q2 T cruise; specifično: Q1 RP, Q2 T cruise (3 dana: D18); lestvice u ladders; ista doza druge strukture pravilom: T kontinuirano ↔ 2–5 jednakih deonica ≥ 1000 m deljivih sa 100 m, a kad takve podele nema, sa 50 m (D22); I do 6 jednakih deonica 800–1200 m ili piramida 1200 + 1000 + 800 m (3,0 km); RP 2–5 jednakih deonica ≥ 800 m deljivih sa 100 m, a kad takve podele nema sa 50 m (D30; 10k-v2.2.1: ≥ 1000 m, D22b); R deonice 200 / 300 / 400 m (D22).',
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
    rule: 'Uslov 8: nedelja ≥ minimum po broju dana (D17; trkačka: planirano + trka 10 km, D30); lagan ≥ 3 km; prazan trening, dugi < lagan, nedelja ispod minimuma = greška; takav ulaz se odbija.',
    place: 'policy.ts days + validate.ts',
    rationale:
      'Upotrebljivost, ne samo aritmetika: degenerisan plan se ne predaje. Trkačka nedelja je potpuno zadata (D8/D20, fiksna trajanja), pa ostaje upozorenje RACE_WEEK_SHORT, ne greška (nedelja se ne puni); od 10k-v2.3.0 (D30) trka ulazi u opterećenje nedelje, pa npr. 3 dana, 8 ned, 20 km, VDOT 30 (2 × 35 min E = 8,7 km + 10 km ≥ 9 km) više nije ispod minimuma.'
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
    rule: 'RP druga struktura kao T (D22): 2–5 jednakih deonica ≥ 1000 m deljivih sa 100 m, a kad takve podele nema, sa 50 m (2,5 = 2 × 1250; 3,5 = 2 × 1750); nijedna RP deonica < 1000 m (10k-v2.2.1; od 10k-v2.3.0 RP deonice ≥ 800 m, D30).',
    place: 'workouts.ts (structuresForDose, isti splitsOf za T i RP); validate.ts (REP_MIN)',
    rationale:
      'Heuristika: isto pravilo kao T, bez novog broja; RP deonice < 1000 m (5 × 500, 5 × 700, 3 × 800, 4 × 600, 5 × 900 m) otpadaju. Odstupanje od očekivanja (opreznije, bez novog broja i bez nove strukture): očekivano je ponavljanje kod 3 dana ≈ 0, ali RP 2,4 / 2,5 / 3,5 / 4,5 km sada imaju samo jednu strukturu (2 × 1200, 2 × 1250, 2 × 1750, 3 × 1500 m), pa slot ponavlja trening (D10/D12): ponovljenih nedelja 3 dana 216 → 1224, 4 dana 48 → 192, 5 i 6 dana 0 → 144; npr. 3 dana, 9 ned, 20 km, VDOT 30, uto/čet/ned: ned 7 RP 2 × 1200 m ponovljen (bilo 3 × 800 m). RP kontinuirano (kao T) bi uklonilo ponavljanje, ali je nova trenerska odluka — nije uvedeno. Posledica: manje oporavaka → kraći kvalitetni dan → u 258 planova ograničenih kapacitetom niži vrh cilja (do 1,1 km; npr. 4 dana, 16 ned, 35 km, VDOT 35, uto/čet/sub/ned: 48,0 → 46,9 km, ned 14 RP 3 × 1500 umesto 5 × 900 m); izuzeci sa razlogom u segment02b.regression-exceptions.json.'
  },
  {
    id: 'D23',
    rule: 'Trkačka nedelja ≤ taper: lagan dan trkačke nedelje = min(35 min E, km najkraćeg laganog dana tapera); kad je lagan tapera kraći, dan se zadaje u km. Invarijanta: planirano trkačke nedelje (bez trke) ≤ planirano tapera. Dopuna (10k-v2.5.1): kad ni bez oštrenja (A9) trkačka nije ≤ taper (taper skraćen danima odmora/bola adaptacije), višak laganih dana trkačke nedelje postaje odmor — prvo dani bola, pa najraniji lagani, najmanje koliko treba; dan pred trku i trka ostaju; napomena „Trkačka nedelja skraćena: taper je imao dane odmora/bola (D23)." Jedno mesto week.raceWeekRest; validator D20 čita isti podatak. D23 i ograničenja bola imaju prednost pred D30b: tako skraćena trkačka nedelja sme biti ispod minimuma (upozorenje RACE_WEEK_SHORT); npr. 6 dana, 9 ned, 35 km, bol 8 kraj ned 7: taper 10,6 km, trkačka 7,94 + trka 10 < 18 km.',
    place:
      'week.ts (raceWeek, raceEasyWorkout, raceWeekRest); generate.ts (lagan tapera); validate.ts (RACE_WEEK_EASY, RACE_WEEK_OVER_TAPER; D20 čita raceWeekRest)',
    rationale:
      'Smanjenje obima se ne sme poništiti u trkačkoj nedelji (D4/D7). Na 49ad476 trkačka > taper u 8 / 57 / 9 planova 4 / 5 / 6 dana: brz trkač malog obima, 35 min E (npr. 8,8 km pri VDOT 70) > lagan tapera. Najkraći lagan tapera (lagani se razlikuju ≤ 0,1 km, D19) je opreznija strana. Oštrenje i dan pred trku ostaju po D8. Posledica: lagan u km u 636 / 1428 / 2004 / 2538 planova 3–6 dana; trkačka ispod minimuma nedelje (RACE_WEEK_SHORT, upozorenje D15) 6 dana 0 → 90 (35 km, VDOT 30–50).'
  },
  {
    id: 'D25',
    rule: 'UPOZORENJE LONG_SHORTER_THAN_QUALITY (ne greška, plan se ne menja): u ne-rasteretnoj nedelji izgradnje najduži kvalitetni dan je po trajanju duži od dugog. Poruka preporučuje manje dana trčanja kad red tabele D17 sa manje dana podržava trenutni obim.',
    place: 'validate.ts (LONG_SHORTER_THAN_QUALITY); volume.ts (fewerDaysAdvice)',
    rationale:
      'Na 49ad476 i 10k-v2.2.1: 0 / 132 / 132 / 330 planova 3–6 dana — brz trkač na najnižim obimima reda (4 dana 25 km VDOT 60–70; 5 dana 30–35 km VDOT 70; 6 dana 35–45 km VDOT 55–70): WU/CD po pojasu D14 + rad > dugi. Kraći WU/CD po vremenu nedelje bi ovo rešio, ali simulacija organizatora na 49ad476 (nije ponovljena u 02b) pokazuje regresiju kapaciteta 4 dana (ispod obima zbog udela 0 → 66, CAPACITY_LIMITED 1320 → 1830, 234 niža vrha) — zato samo upozorenje; manje dana daje dugi veći udeo (D17).'
  },
  {
    id: 'D26',
    rule: 'Plan po osećaju kad nema rezultata, rezultat je stariji od 84 dana ili je VDOT iz rezultata < 30: lagan tempo easyPaceSecPerKm obavezan (270–510 s/km; bez njega EASY_PACE_REQUIRED, van opsega EASY_PACE_OUT_OF_RANGE). E = lagan tempo ± 15 s (srednji E = lagan tempo; 105 min dugog po sporom kraju E). Procena VDOT-a = VDOT čiji je brži kraj E (eFractionFast) jednak laganom tempu, ograničena na 25–60 (iznad 60 → 60 + upozorenje VDOT_ESTIMATE_CAPPED „za ovaj tempo unesi rezultat"), SAMO za orijentir T/I/R/RP i trajanje deonica. Plan nosi paceBasis feel (inače result); svaki kvalitet nosi RPE: T 6–7, RP 7–8, I 8, R 8; bez ocene cilja i prognoze 10K (null, napomena „posle testa"); ostalo kao plan sa rezultatom (D4–D25, D16 važi).',
    place:
      'input.ts (put); paces.ts feelPaces; policy.ts feel (brojevi, RPE); workouts.ts (RPE kvaliteta); generate.ts; validate.ts (PACE_BASIS, PACES, RPE)',
    rationale:
      'Heuristika: bez rezultata je lagan tempo jedini podatak o trkaču. Izjednačavanje sa bržim krajem E daje niži VDOT nego srednji E (rekreativci lagano često trče prebrzo) — opreznija procena brzih zona. U opsegu 270–510 s/km procena je 58,6–26,1, pa granice 25/60 u mreži ne deluju (ostaju zaštita ulaza). Tempo brzih zona je orijentir; trening vodi RPE dok test (D27) i adaptacija (segment 04) ne daju rezultat.'
  },
  {
    id: 'D27',
    rule: 'Test 5 km samo u planu po osećaju (početnik bez testa, D32): poslednja nedelja baze, na danu Q1 (3 dana: umesto jedinog kvaliteta); kad je ta nedelja rasterećenje — umesto kvaliteta rasterećenja (na njegovom danu). Struktura WU (pojas D14) + 5 km kontrolisano maksimalno + CD; računa se u obim nedelje, NE u dozu kvaliteta (bez plafona D11): progresija slota (D12) se posle testa nastavlja od stanja pre testa, a provera „glavna doza ne opada" preskače test nedelju. Plan po osećaju ima tačno jedan test, plan sa rezultatom nijedan; rezultat testa koristi adaptacija (04), do tada tempo ostaje procena.',
    place:
      'periodize.ts (testWeek); week.ts (buildWeek); workouts.ts (testWorkout); quality.ts (advance); validate.ts (TEST)',
    rationale:
      'Heuristika: test na kraju baze zamenjuje najmanje specifičan kvalitet (R; kod 3 dana T kontinuirano) pre razvoja, u kom zone I/T nose tempo. Odstupanje (opreznije, D27 ispred D5, bez novog broja): u rasterećenju sa testom dugi je ≤ 0,8 × poslednji ne-rasteretni — najduži koji ostavlja lagane ≥ 3 km (D13), jer test ne staje uz dugi 0,8 × i lagan ≥ 3 km, a cilj rasterećenja se ne podiže (D6); npr. 3 dana, 12 ned, 20 km, lagan 7:30, uto/čet/ned: ned 4 cilj 18,0 km, test 8,3 km, dugi 8,0 → 6,6 km, lagan 3,1 km (napomena, upozorenje TEST_DELOAD_LONG). Dopuna (10k-v2.5.1, odluka organizatora posle nalaza N7): za rasterećenje sa testom cilj iznad pravila (fit10: naviše do ispod poslednje izgradnje) samo ako sastavljena nedelja ima test; inače cilj ≤ pravilu (samo naniže), a test otpada (A9) kad ga sastavljena nedelja nema — jedno mesto, generate.ts (uslov izvodljivosti cilja), bez petlje. Na 10k-v2.5.0 pretraga je puštala cilj naviše jer okvir ima test, a sastavljena nedelja ga je gubila (A9): rasterećenje bez testa podignuto naviše, validator odbija (VOLUME_RULE) — npr. 4 dana, 12 ned, 25 km, lagan 4:30, bol 5 u četvrtak ned 1: ned 4 cilj 20 km umesto 17 km; sada 17 km bez testa.'
  },
  {
    id: 'D28',
    rule: 'Početnik (experience beginner; podrazumevano regular), JEDNA tabela beginner: 3–4 dana (5–6 → BEGINNER_DAYS, preporuka 3–4 dana); 10–18 nedelja (8–9 → BEGINNER_SHORT); obim start 3 dana 15–30 km, 4 dana 18–35 km (ispod → preporuka 5K plana); nedelje 1–2 uvod bez kvaliteta (dan kvaliteta = lagan); zatim jedan kvalitet nedeljno za 3 i 4 dana (lestvica D18: T kont. → T cruise → RP; T kontinuirano od 1,5 km i kad prvi nivo faze ne staje u plafon: D31), bez I i R; 4 dana = 1 kvalitet + 2 lagana + dugi (D19 jednaki); D16 ne važi (start = prvi nivo lestvice); rast +5 % (min 1,0, max 2,0 km); vrh = min(start × 1,3; start + 10; max nedelje D17; kapacitet); dugi ≤ 90 min sporim E (i ≤ udeo D17); WU/CD uvek prvi pojas (15/10 min); rezultat ≤ 84 dana i VDOT ≥ 30 → tempo iz VDOT-a, inače plan po osećaju (D26) bez testa (D32). Rasterećenje, taper (1 kvalitet RP kao D18) i trkačka nedelja po D5/D7/D8/D20/D23 (T rasterećenja i tapera početnika: D31).',
    place:
      'policy.ts beginner + planRule (jedina tabela); input.ts; schedule.ts (1 kvalitet); quality.ts (startLevel, pickBuild); week.ts (uvod); lengths.ts, volume.ts, workouts.ts (pravilo plana); validate.ts',
    rationale:
      'Heuristika: cilj početnika na 10K je završiti zdravo — smanjen intenzitet (jedan kvalitet, bez I/R, start od prvog nivoa, uvod bez kvaliteta) i rast (5 %, max 2 km; vrh 1,3× / +10 km; dugi 90 min). Odstupanje (opreznije, D11 ispred D28): nedelja izgradnje bez kvaliteta (napomena, upozorenje BUILD_NO_QUALITY) — u 10k-v2.3.0 kad ni prvi nivo lestvice faze ne staje u plafon (3 dana 15 km: T 2,0 km traži cilj ≥ 20 km, vrh 19,5 km), od 10k-v2.3.1 samo kad ni T 1,5 km ne staje (D31).'
  },
  {
    id: 'D29',
    rule: 'Trčanje/hodanje (runWalk true) → odbijanje RUN_WALK_NOT_SUPPORTED: „10K plan traži neprekidno trčanje ≥ 30 min; preporuka: 5K plan (trčanje/hodanje)". Nema 10K run/walk plana.',
    place: 'input.ts (broj: input.continuousRunMin)',
    rationale:
      'Odluka segmenta 03: 10K plan pretpostavlja neprekidno trčanje (lagan ≥ 3 km, dugi do 90–105 min); trčanje/hodanje pokriva 5K plan.'
  },
  {
    id: 'D30',
    rule: 'Ispravke iz 02b: (a) RP druga struktura — 2–5 jednakih deonica ≥ 800 m (T ostaje ≥ 1000 m), deljivih sa 100 m, a kad takve podele nema sa 50 m (rpRepMinM 800; validator REP_MIN po zoni); (b) Uslov 8 trkačke nedelje: planirano + trka (10 km) ≥ minimum nedelje (trka je opterećenje nedelje; odvajanje trke od obima je pravilo prikaza).',
    place:
      'policy.ts alternatives.rpRepMinM; workouts.ts (splitsOf); validate.ts (REP_MIN, RACE_WEEK_SHORT)',
    rationale:
      'Ispravke posle 02b; brojke organizatora (simulacija na 21c03f1) ponovljene mrežom 02 (15 840 planova sa rezultatom): (a) ponavljanje slota 1224 / 192 / 144 / 144 → 240 / 48 / 0 / 0 nedelja 3–6 dana (ostaju 3 dana RP 2,5 / 3,5 km sa jedinom strukturom 2 × 1250 / 2 × 1750 m i 4 dana I 2,0 km, 9 ned); vrh cilja niži od 49ad476 258 → 12 (3 dana, 30 km, VDOT 35, 17–18 ned: 35,6 → 35,2), prema 21c03f1 nijedan niži (viši u 120 / 126 planova 3 / 4 dana); (b) RACE_WEEK_SHORT 96 → 0. Promenjeni planovi prema 21c03f1: samo D30a 1134 / 576 / 432 / 126, samo D30b 6 / 0 / 0 / 72, oba 0 / 0 / 0 / 18; odbijanja, trkačka > taper, ned 1 ispod obima i DOSE_DROPPED bez promene.'
  },
  {
    id: 'D31',
    rule: 'Početnik (izmena D28): lestvica T kontinuirano = [1,5; 2,0; 2,5; …] km (nivo 1,5 km samo za početnika; redovan plan i D16 nepromenjeni). Kad prvi nivo lestvice faze (T kont. / T cruise / RP) ne staje u plafon D11 cilja nedelje, kvalitet nedelje je T kontinuirano: najviši nivo lestvice početnika koji staje (po D12: ≤ 1 nivo nedeljno, ista doza druge strukture — 2,0 km ↔ 2 × 1000 m —, inače ponavljanje uz napomenu); bez kvaliteta samo kad ni 1,5 km ne staje (BUILD_NO_QUALITY). Prelaz na lestvicu faze čim njen prvi nivo stane, po D12/D18 (T cruise ≥ poslednje T; RP ≥ poslednje T doze); T kontinuirano posle T cruise ≥ poslednje T (D12, doza ne pada). Rasterećenje: T ≈ 60 % poslednje T doze (nivo naniže), min 1,5 km; ne staje → bez kvaliteta (D5). Taper: RP po D7; RP ne staje → T kontinuirano ≈ 60 % poslednje T doze (min 1,5 km); bez kvaliteta samo kad ni to ne staje.',
    place:
      'policy.ts beginner.tFirstKm; workouts.ts ladderLevels; quality.ts (pickBuild, pickSlot, carries, pickDeload, pickTaper); week.ts (napomene); generate.ts (RP doza tapera); validate.ts (PHASE_QUALITY, BUILD_NO_QUALITY, BASE_PLATEAU, DELOAD_CONTENT, TAPER_QUALITY)',
    rationale:
      'Heuristika: ≈ 10 min praga (1,5 km) je uobičajen početni tempo trening; plan bez ijednog kvaliteta ne ispunjava D28 (jedan kvalitet nedeljno). Na 81bd351 (mreža početnika 3402): 3720 nedelja izgradnje bez kvaliteta, 378 planova (3 dana 15 km) bez ijednog kvaliteta od nedelje 3 do trke (najmanja doza T 2,0 km > plafon 1,5–1,9 km); 4 dana 18 km bez kvaliteta u specifičnoj fazi (RP 2,4 km > plafon). „Poslednja T doza" = poslednja doza u zoni T iz ne-rasteretne nedelje izgradnje. Odstupanje (opreznije, bez novog broja): T 1,5 km nema drugu strukturu (deonice ≥ 1000 m, D10), pa kad 2,0 km ne staje slot ponavlja 1,5 km uz napomenu i u bazi — izuzetak od „baza bez platoa" (D22) samo za tu dozu; npr. početnik 3 dana, 18 ned, 15 km: baza ned 3 / 5 / 6 T 1,5 km (plafon 1,7 / 1,8 / 1,9 km); u mreži 2436 ponovljenih nedelja T 1,5 km (3 dana, 450 planova; u bazi 252). Posledice (mreža početnika prema 81bd351): nedelje izgradnje bez kvaliteta 3720 → 0, planovi bez kvaliteta od nedelje 3 do trke 378 → 0, rasterećenje bez kvaliteta 2316 → 654 nedelja, taper bez kvaliteta 1152 → 378 planova (3 dana 15 km: cilj 14,6 km, plafon 1,46 km < 1,5 km), taper T 1,5 km 810 planova (bez oštrenja, D8); početni nivo početnika je T 1,5 km (D28), pa u 12 planova sa rezultatom ograničenih kapacitetom kraći kvalitetni dan daje niži vrh (4 dana, 30–35 km, VDOT 30, 15–17 ned: do 0,6 km).'
  },
  {
    id: 'D32',
    rule: 'Početnik nema test 5 km (ni u planu po osećaju; izmena D27): tempo brzih zona je orijentir (procena, D26), kvalitet po RPE; rezultat trke ili parkruna kasnije koristi adaptacija (segment 04). Bez testa otpadaju i odstupanja D27 kod početnika (TEST_DELOAD_LONG, cilj rasterećenja naviše).',
    place:
      'policy.ts planRule (feelTest); generate.ts (periodize bez testa, napomena plana); validate.ts (TEST)',
    rationale:
      'Heuristika: kod 3 dana i 15 km test (WU + 5 km + CD ≈ 8 km) je ≈ pola nedelje, a u rasterećenju skraćuje dugi na 3,1 km (81bd351: dugi rasterećenja < 4 km u 162 plana početnika, cilj rasterećenja naviše u 144). Posledica: u 102 plana po osećaju ograničena kapacitetom vrh 81bd351 je bio u nedelji testa (dan testa duži od kvalitetnog dana), pa je vrh niži do 1,7 km (4 dana, 35 km, lagan 8:30, 10 ned: 38,5 → 36,8 km); u 36 od njih (3 dana) taper zato prelazi sa RP 2 × 1000 m na T 1,5 km (D31).'
  },
  /* ---------- Segment 04 (10k-v2.4.0): adaptacija. Heuristike zadate za segment, bez trenerske provere. ---------- */
  {
    id: 'A1',
    rule: 'Rezultat (test ili trka 3/5/10 km, polumaraton) ≤ 84 dana i noviji od rezultata u upotrebi → VDOT od sledeće nedelje (prva puna nedelja posle asOf); plan po osećaju prelazi na paceBasis result od te nedelje (RPE samo u nedeljama po osećaju); pravilo cilja obima (D6) se ne menja zbog tempa; doza se nastavlja (metraža); ocena cilja (D3, nedelje od sledeće do trke) i prognoza iz novog VDOT-a. VDOT van 30–80 → RESULT_IGNORED (razlog); nema sledeće nedelje → ne primenjuje se (razlog).',
    place:
      'assess.ts (odluka); steps.ts pacesAt/basisAt (tempo nedelje); generate.ts construct; adapt.ts (nivo plana); validate.ts (PACES, PACE_BASIS, RPE po nedelji)',
    rationale:
      'Heuristika: tempo prati najnoviji pouzdan rezultat (isti prag starosti kao D1). Tumačenje (bez novog broja): „obim ne raste zbog tempa" = nominalni cilj (D6) ne zavisi od tempa; kapacitet je i dalje stvarna konstrukcija nedelje sa tempom te nedelje (D6), pa nedelja ograničena kapacitetom (dugi 105 min) sme dobiti drugi izvodljiv cilj. VDOT van 30–80 se ne odbija (za razliku od ulaza): plan ostaje na postojećem tempu.'
  },
  {
    id: 'A2',
    rule: 'Manjak izvršenja: potpuno pokriven 7-dnevni prozor do asOf (A10), izvršeno < 60 % planiranog → cilj sledeće nedelje (izgradnja) = min(prethodni cilj izgradnje, max(izvršeno, 0,8 × cilj te nedelje)), ne ispod donje granice (A9); dalje povratni rast (A8).',
    place: 'assess.ts (adapt.underShare, underFloorShare, windowDays)',
    rationale:
      'Heuristika: nedelja ispod 60 % nije osnov za rast; 80 % planiranog čuva kontinuitet. Primenjuje se samo kad je sledeća nedelja izgradnje (taper i trkačka nedelja se ne menjaju, A12).'
  },
  {
    id: 'A3',
    rule: 'Pauza (uzastopni poznati dani bez trčanja do asOf u potpunoj pokrivenosti, ili eksplicitna pauza): 7–13 dana → 80 % obima 7 dana pre pauze, prva nedelja 1 kvalitet; 14–27 → 70 %, prva nedelja bez kvaliteta, druga 1 kvalitet; ≥ 28 → min(obim 14 dana pre pauze / 2, 50 % obima 7 dana pre), nov start (rePeriodize preostale izgradnje, D5; vrh od novog starta; progresija doze iznova, D16); nov start i < 8 nedelja do trke → cilj „orijentir" (poruka). Obim pre pauze iz zapisa samo ako je prozor pokriven i svako trčanje ima km; inače cilj plana te nedelje. Cilj ≤ cilj sledeće nedelje u planu; ostatak tekuće nedelje dobija ograničenja i (izgradnja) cilj pauze.',
    place:
      'assess.ts (adapt.pause); periodize.ts rePeriodize; steps.ts framesFor; volume.ts adaptNominal10',
    rationale:
      'Heuristika gubitka forme po trajanju pauze. Tumačenje: „vrh od novog starta" = granica izgradnje D6 (1,4× / +15 / max) od cilja novog starta važi za redovan rast; povratni rast (A8) ide do nivoa pre pauze i iznad te granice (kao 5K v2 2.6.0), a iznad nivoa cilj drži granicu (ne pada). Uz granicu novog starta i za povratak cilj bi ostao ravan do trke (4 dana, 18 ned, VDOT 45, 35 km, asOf kraj ned 2, pauza 35: 24,6 km od ned 8 do 16) — upravo ono što pouka 7 zabranjuje. Odstupanje (opreznije, bez novog broja): kad za preostalu izgradnju ne postoji raspored rasterećenja po D5 (4 nedelje izgradnje: baza, razvoj, specifično 2 — rasterećenje bi palo na prvu nedelju faze ili pred taper), faze i rasterećenja ostaju iz plana (nov start samo obima i doze); npr. 4 dana, 14 ned, asOf kraj ned 8, pauza 35 dana. Nov start sa ≤ 2 nedelje izgradnje: sve specifično.'
  },
  {
    id: 'A4',
    rule: 'Bol ≥ 4 u poslednja 3 dana → 7 dana bez kvaliteta i ubrzanja, dugi ≤ 60 min (sporim E), lagani × 0,7 (≥ 3 km, ≤ dugi); bol ≥ 7 → najpre 3 dana odmora, pa isto; poruka o stručnom pregledu; nedelja sa danom bola/odmora ima najviše 1 kvalitet doze rasterećenja. Sidro povratka (10k-v2.4.1, A16) = nedelja r koja sadrži asOf + 1 (prvi dan odmora ili bola, kao firstWeek koraka); cilj nedelje r ostaje (dani u periodu bola i odmora su ograničeni, planirano ≤ cilj); posle nedelje r rast kreće od osnove = min(0,7 × nivo pre bola, cilj nedelje r) [0,1 km] (nivo: A8; pauza u istom koraku: najveći nivo koraka; korak bez nivoa: 0,7 × cilj nedelje r); od nedelje r + 1 povratni rast A8 do nivoa, pa D6 — i u nedeljama sa danima bola posle r (dani ostaju ograničeni: bez kvaliteta i ubrzanja, dugi ≤ 60 min, lagani × 0,7); rasterećenje posle sidra = 0,8 × osnova. Povratak samo kad je r nedelja izgradnje (taper i trkačka nedelja nemaju povratak). Poruka: „Posle nedelje r rast kreće od 70 % nivoa pre bola (osnova km)."',
    place:
      'assess.ts (adapt.pain*; sidro r, nivo, poruka painReturnNote); steps.ts limitsOf; lengths.ts painLong10/limitedEasy10; week.ts; volume.ts (returnAnchor, returnBase10, leaveWeek — osnova); adapt.ts (osnova u poruci iz konstruisanog cilja nedelje r)',
    rationale:
      'Heuristika opreza kod bola; dijagnoza nije deo plana (poruka). Tumačenje: „doza ne raste u nedelji sa ograničenjem" — nedelja sa danima bola/odmora dobija najviše jedan kvalitet doze rasterećenja i kad dani kvaliteta nisu u periodu bola. Sidro i osnova (10k-v2.4.1, A16): povratak ne zavisi od dana u nedelji, nivoa bola ni od toga da li je nedelja sidra rasteretna.'
  },
  {
    id: 'A5',
    rule: 'Umor: ≥ 2 laganih treninga (lagan, dugi ili zapis van plana — bez dayId) sa RPE ≥ 7 u 7 dana → sledeća nedelja rasterećenje (samo izgradnja; ne ako je već rasteretna, taper ili trka); prinudno rasterećenje odmah posle redovnog = 0,8 × poslednja ne-rasteretna (ne 0,8 × 0,8); redovno rasterećenje odmah posle prinudnog se ukida. Isto posle nedelje smanjenja pauzom, manjkom ili bolom (A17, 10k-v2.5.0); prinudno rasterećenje se nikad ne ukida. Dopuna (10k-v2.5.1): prinudno rasterećenje u uvodu početnika (D28, nedelje 1–2) — obim rasterećenja (0,8 ×), sadržaj uvoda (bez kvaliteta, dani po šablonu uvoda); uvod ima prednost, nedelja se ne pomera. Dopuna (10k-v2.5.2, pouka 34): umor sa asOf pre starta plana (nedelja 1, nema prethodne izgradnje) → nedelja 1 je prinudno rasterećenje = 0,8 × planirana nedelja 1 (sadržaj rasterećenja D5: 1 kvalitet T ≈ 60 %, dugi 0,8 ×; početnik: sadržaj uvoda); referenca (poslednja izgradnja, poslednji dugi, doza slota rasterećenja) = nedelja 1 generatora bez činjenica (generate.preStartRef), upisana u korak (preStart) — konstruktor i validator je čitaju iz koraka; nedelja 2 = cilj planirane nedelje 1 (bez rasta), dalje po rasporedu (faze i rasterećenja ostaju). Pouka 4 (bez rasterećenja u nedeljama 1–2) važi za redovna rasterećenja. Npr. 10 ned, 25 km, VDOT 30, 4 dana, umor 2026-11-01 (start − 1): ned 1 = 20,0 km (0,8 × 25), ned 2 = 25,0 km; na 10k-v2.5.1 odbijeno (WEEK_INFEASIBLE). Dopuna (10k-v2.6.0, pouka 36, A18): umor je vezan za zapise — rasterećenje već u planu od sidra (prva puna nedelja posle poslednjeg RPE zapisa umora) pokriva iste zapise.',
    place:
      'assess.ts (adapt.fatigue*; preStart iz generate.preStartRef); steps.ts framesFor; volume.ts adaptNominal10 (0,8 × referenca, nedelja 2 = referenca); week.ts buildWeek (ctx.preStart); validate.ts (D5 izuzetak prinudnog i A17; sadržaj rasterećenja iz koraka.preStart)',
    rationale:
      'Heuristika: povišen napor na laganim treninzima je znak umora. Prinudno rasterećenje sme pasti na prvu nedelju faze ili pred taper (izuzetak D5, samo za korak umora).'
  },
  {
    id: 'A6',
    rule: 'Višak: > 115 % planiranog u dva uzastopna potpuno pokrivena 7-dnevna prozora → sledeća nedelja bez rasta (cilj = min(cilj, prethodni cilj izgradnje)); ne primenjuje se kad sledeća nedelja nije izgradnja ili je rasteretna.',
    place: 'assess.ts (adapt.overShare)',
    rationale: 'Heuristika: više od plana povećava rizik; plan se ne povećava za višak.'
  },
  {
    id: 'A7',
    rule: 'Prioritet: bol uvek (po datumima, najstroži); za obim samo najviše aktivno od pauza > umor > izvršenje (manjak/višak); tempo (A1) uvek; svi aktivni uslovi u reasons sa applied true/false i porukom.',
    place: 'assess.ts',
    rationale: 'Jedno pravilo obima po koraku: bez sabiranja smanjenja.'
  },
  {
    id: 'A8',
    rule: 'Povratni rast: posle smanjenja (pauza, bol, manjak) cilj raste +10 %/ned (min 1,0 km; nikad sporije od D6) do nivoa pre smanjenja u svim fazama osim tapera i trkačke nedelje (i iznad granice izgradnje novog starta, A3); iznad nivoa D6 (iznad granice drži). Nivo = cilj poslednje ne-rasteretne nedelje izgradnje završene pre prvog dana događaja (bez nje — start plana); više koraka → najveći nivo. Bol (A4, 10k-v2.4.1): posle nedelje sidra r (sadrži asOf + 1) osnov rasta je min(0,7 × nivo pre bola, cilj nedelje r), ne cilj poslednje nedelje bola. Rasterećenje u povratku 0,8 × poslednja ne-rasteretna (posle sidra bola 0,8 × osnova); cilj koraka je osnov rasta i kad je ta nedelja rasteretna. U povratku se cilj ne podiže iznad pravila (izvodljiv cilj samo naniže). Taper posle smanjenja = 0,75 × najveći cilj izgradnje posle poslednjeg smanjenja (nikad skok naviše); korak čija je sledeća nedelja taper: min(0,75 × vrh, cilj koraka).',
    place:
      'volume.ts (adaptNominal10, nextBuild10, returnBase10, leaveWeek) — konstruktor i validator',
    rationale:
      'Pouka 7 (5K v2): bez povratnog rasta cilj posle pauze ostaje ravan do trke ili skače. Tumačenje: „min 1,0 km" je donja granica koraka povratka (kao D6); gornje granice koraka nema osim nivoa.'
  },
  {
    id: 'A9',
    rule: 'Donja granica adaptiranog cilja = minimum nedelje broja dana (D17 weekMinKm; početnik isto). Kvalitet koji u adaptiranoj nedelji ne staje → 1 kvalitet doze rasterećenja → bez kvaliteta (odluka konstruktora, ista pretraga cilja: prolazi pravilo, popuštanje, 1 kvalitet, bez kvaliteta; cilj adaptacije se zadržava — najpre svi prolazi na njemu, pa niži izvodljiv cilj); test 5 km koji ne staje (dugi bi bio kraći od 5 km) otpada sa kvalitetom; oštrenje otpada kad trkačka nedelja sa njim ne bi bila ≤ taper (D23/D30).',
    place:
      'volume.ts (adaptNominal10); generate.ts construct (prolazi); week.ts (buildWeek test, raceWeek); lengths.ts deloadLengths; validate.ts (ONE_QUALITY, TARGET_FLOOR, MAIN_DOSE_DECREASE)',
    rationale:
      'Uslov 8: adaptirana nedelja ne pada ispod najmanjeg smislenog obima i ne postaje degenerisana. Tumačenja (bez novog broja): D30b (planirano + trka ≥ minimum) oštrenje ne popravlja, pa oštrenje otpada kad bi trkačka nedelja bila veća od tapera (D23) — mali taper posle smanjenja (zaštita konstruktora; u mreži 04 se ne javlja, D8 + D23 već drže trkačku ≤ taper); uz manji cilj adaptirane nedelje od nedelje poređenja glavna doza sme da padne (plafon D11 ispred D12). Bez zadržavanja cilja pretraga D6 je nalazila izvodljiv cilj daleko ispod pravila (početnik 4 dana, 14 ned, VDOT 35, manjak 50 % na kraju ned 8: 26,0 → 14,9 km, nedelja bez kvaliteta jer ni T 1,5 km ne staje). Odstupanja (opreznije, D13 ispred D5/D27; samo od prve nedelje posle smanjenja obima — inače bi adaptacija bez činjenica menjala 30 planova po osećaju čiji generator ima dugi < 5 km u nedelji testa): u adaptiranoj nedelji dugi rasterećenja ≤ 0,8 × poslednji — najduži koji ostavlja lagane ≥ 3 km i ne ispod 3 km (isto pravilo kao test D27); test u adaptiranoj nedelji samo kad dugi ostaje ≥ 5 km. Ulaz: 3 dana, 10 ned, po osećaju 6:00, 25 km, asOf kraj ned 2, pauza 35 — test premešten u ned 5 (15,2 km) davao je dugi 3,0 km, pa rasterećenje ned 6 (0,8 × 3,0 = 2,4 km < 3 km) nije imalo nijedan izvodljiv cilj; 3 dana, 10 ned, VDOT 45, 25 km, asOf kraj ned 2, pauza 21 dan + bol 6: rasterećenje 10,7 km sa dugim 4,8 km ostavljalo je lagane 2,9 km.'
  },
  {
    id: 'A10',
    rule: 'Pokrivenost: dan bez zapisa je poznat (bez trčanja) SAMO u facts.coverage sa complete = true; A2, A3 (iz zapisa) i A6 samo na pokrivenom delu; bol, umor, rezultat i eksplicitna pauza uvek. Bez coverage nijedan dan bez zapisa nije poznat (nepotpun zapis ≠ pauza). Eksplicitna pauza važi ako je završena u poslednjih 7 dana i posle prethodne adaptacije. Trčanje = completed i (km > 0 ili durationSec > 0).',
    place: 'assess.ts (coveredDays, knownKm)',
    rationale: 'Nepotpun unos (sat nije sinhronizovan) ne sme izgledati kao pauza ili manjak.'
  },
  {
    id: 'A11',
    rule: 'Zaštita: dani ≤ asOf, urađeni (completed, po dayId ili datumu) i zaključani (lockedDayIds) ostaju bajt-isti iz prethodnog plana; završna zaštita samo proverava (ADAPT_PROTECTION = odbijanje, plan se ne vraća); nedelje sa zadržanim danima koji se razlikuju od konstrukcije → adaptation.mixedWeeks. asOf ≥ dan trke ili pre prethodne adaptacije → ADAPT_AS_OF_INVALID. Prošlost = upisani dani (10k-v2.5.1): plan kakav se upisuje (spajanje written.ts) je jedini vlasnik prošlosti — konstruktor iz njega vodi svako stanje koje zavisi od prošlosti (najduži dugi D7, poslednji dugi D5, stanje doze D5/D7/D12/D31, taper za trkačku nedelju D8/D23), a validacija u construct vidi isti upisani plan; npr. trkač je u ned 10 istrčao T 3600 m — rasterećenje se računa od 3600, ne od sastavljenih 3000 koje nije trčao.',
    place: 'adapt.ts; written.ts (spajanje, jedino mesto); generate.ts construct (prior)',
    rationale: 'Uslov 4: završna zaštita štiti urađeno, datume i zaključane treninge, ne odlučuje.'
  },
  {
    id: 'A12',
    rule: 'Datum trke, taper i trkačka nedelja se ne pomeraju; rePeriodize menja samo preostalu izgradnju (od sledeće nedelje) istim pravilima D4/D21 i D5 (rasterećenje nikad na prvoj nedelji faze, uključujući fazu od 1 nedelje, ni u prve 2 nedelje novog starta, ni pred taperom).',
    place: 'periodize.ts rePeriodize',
    rationale: 'Datum trke je fiksan; nov start je kraća priprema istim pravilima.'
  },
  {
    id: 'A13',
    rule: 'Test 5 km (plan po osećaju): nedelja testa posle asOf koja je blokirana (ograničenje kvaliteta, prinudno rasterećenje, van izgradnje) → test na prvu sledeću ne-rasteretnu nedelju izgradnje bez ograničenja dok je plan po osećaju; nema je → bez testa. Posle primljenog rezultata (A1) testa nema. Početnik nema test (D32).',
    place: 'steps.ts framesFor',
    rationale:
      'Test zamenjuje kvalitet i ne sme pasti u nedelju zabrane. Tumačenja: redovno rasterećenje sa testom iz D27 nije blokada (inače bi plan bez činjenica bio promenjen); test koji u novoj nedelji ne staje otpada (A9), ne premešta se dalje (bez petlje).'
  },
  {
    id: 'A14',
    rule: 'Lančana adaptacija: koraci se čuvaju u plan.adaptation.steps i ponavljaju redom; isti ulaz + isti koraci → isti plan (bez čitanja sata; asOf je ulaz).',
    place: 'adapt.ts, generate.ts construct',
    rationale: 'Determinizam i ponovljivost.'
  },
  {
    id: 'A15',
    rule: 'Plan starije verzije 10k-v2: buduće nedelje po tekućim pravilima; prošlost zaštićena (mixedWeeks); plan druge politike ili neispravan → ADAPT_PLAN_INVALID.',
    place: 'adapt.ts checkPlan',
    rationale: 'Prošlost se ne prepravlja; budućnost prati tekuću politiku.'
  },
  /* ---------- Segment 06b (10k-v2.4.1): bol — povratak ne zavisi od dana u nedelji. ---------- */
  {
    id: 'A16',
    rule: 'Izmena A4/A8 (10k-v2.4.1): sidro povratka posle bola je nedelja r koja sadrži asOf + 1 (prvi dan odmora ili bola), ne poslednja nedelja perioda bola; osnova povratka = min(round(0,7 × nivo pre bola), cilj nedelje r) [0,1 km] umesto 0,7 × cilj poslednje nedelje bola; od nedelje r + 1 povratni rast A8. Oblik koraka isti (returnFrom { week, share }): week = r; adaptVolume mapira sidro na round(0,7 × nivo koraka), leaveWeek posle nedelje r postavlja osnovu (min sa ciljem nedelje r iz konstrukcije); korak bez nivoa (stariji korak): 0,7 × cilj nedelje r (10k-v2.4.0). Sačuvan plan 10k-v2.4.0 ostaje plan 10K v2 i prilagođava se pravilima 10k-v2.4.1 (A15); druge verzije su nepoznate.',
    place:
      'assess.ts (returnFrom.week = r, painReturnNote); volume.ts (returnAnchor, returnBase10, leaveWeek); adapt.ts (poruka PAIN); app/plan.ts KNOWN_VERSIONS',
    rationale:
      'Heuristika (odluka organizatora posle nalaza na e6540a5, bez novog broja: 0,7 = painEasyFactor, 10 % = returnGrowth). U 10k-v2.4.0 nedelja u koju period bola pređe dobija pun planirani rast, a pad dolazi nedelju kasnije; osnova zavisi i od toga da li je nedelja sidra rasteretna. Ulaz: 4 dana (uto/čet/sub/ned), start 2026-10-26, trka 2027-01-24 (13 ned), 40 km, 10 km 45:00, cilj 43:00; bol na dan iz zapisa bez trčanja. Cilj nedelje 5, e6540a5 → 10k-v2.4.1: (A) asOf 2026-11-15, bol 5 dana 2026-11-14: 27,6 → 32,7 (nivo 42,4, osnova 29,7; sidro ned 4 je rasterećenje 35,9); (B) isto, bol 8: 47,6 (pun cilj) → 32,7; (C) asOf 2026-11-18, bol 5: 47,6 sa kvalitetom → 34,5 (nivo 44,9, osnova 31,4); (D) isto, bol 8: 47,6 (planirano 37,9) → 34,5; (E) asOf 2026-11-13, bol 7: r = 3, ned 4 (rasterećenje) 35,9 → 23,8 (0,8 × 29,7), ned 5 47,6 sa dva kvaliteta → 32,7. Tumačenje: pauza u istom koraku smanjuje cilj nedelje r (A3), pa min sa ciljem nedelje r sprečava skok iznad cilja pauze (umesto 0,7 × cilj pauze iz 10k-v2.4.0). Ograničenje: korak sačuvan u 10k-v2.4.0 se ponavlja kako je sačuvan (A14), pa njegov week ostaje poslednja nedelja bola (npr. B prilagođen u 10k-v2.4.0, pa u 10k-v2.4.1 bez novih činjenica: ned 5 ostaje 47,6); izveštaj 06b.'
  },
  /* ---------- Segment 06c (10k-v2.5.0): rasterećenje odmah posle smanjenja otpada. ---------- */
  {
    id: 'A17',
    rule: 'Rasterećenje posle smanjenja (10k-v2.5.0). Nedelja smanjenja koraka: (a) fromWeek koraka čiji je cilj smanjenje — polje reduced (assess: true za A2 manjak i A3 pauzu, false za A6 višak; korak sačuvan pre 10k-v2.5.0 bez polja: startKm i levelKm ≠ null, A14); (b) nedelja sidra r koraka bola sa povratkom; korak sa novim startom se ne računa (rePeriodize gradi raspored od novog starta). Redovno rasterećenje (raspored D5, izgradnja; nije prinudno A5, taper ni trkačka nedelja) odmah posle nedelje smanjenja se ukida: ta nedelja je izgradnja — cilj po A8 od osnove (bol: returnBase10), kvalitet po fazi uz ograničenja po datumima (A3/A4). Prinudno rasterećenje se nikad ne ukida. Raspored se ne pomera i rasterećenje se ne ubacuje; izuzetak D5: od ukinute nedelje (uključujući nju) najviše 5 uzastopnih nedelja izgradnje do sledećeg redovnog rasterećenja, inače se rasterećenje ne ukida. Poruka koraka: „Redovno rasterećenje u nedelji n + 1 otpada: nedelja n je smanjena (A17)." Poruka PAIN kad je osnova cilj nedelje r (< 0,7 × nivo): „Posle nedelje r rast kreće od osnova km (cilj nedelje r; 70 % nivoa pre bola bilo bi x km)."',
    place:
      'assess.ts (reduced); steps.ts targetReducedWeek, reducedWeeks, framesFor (jedino mesto odluke; izlaz dropped), A17_MAX_RUN; validate.ts (D5 iz istog podatka); adapt.ts (poruke A17 i PAIN); volume.ts bez izmene (cilj A8); app/plan.ts KNOWN_VERSIONS',
    rationale:
      'Heuristika (odluka organizatora posle nalaza N1, bez novog broja: 5 = izuzetak D5 4 + ukinuta nedelja; 0,7 = painEasyFactor). Smanjena nedelja je već oporavak; drugo rasterećenje zaredom gubi nedelju povratka — 10k-v2.4.1: 644/2268 tokova R4 (svaki 12. ulaz mreže 01, asOf kraj ned 2…N − 4) po scenariju pauze 10 dana, bola 5 i manjka. Primer 10w-25km-v30-A-sat, asOf kraj ned 3, cilj ned 5: pauza 10 dana rasterećenje 17,0 → 23,3; bol 5 14,9 → 20,5; manjak 19,0 → 26,2. Izuzetak D5: nedelje posle ukinutog rasterećenja su povratni rast ispod ranijeg obima — 17w-25km-v30-A-sat, bol 5 kraj ned 6, ned 8–12: 23,0 → 25,3 → 27,8 → 29,8 → 31,6 (original 33,5–35,0); nedelja smanjenja je služila kao oporavak; izmereno (mreža R): 0 odbijanja, J1 0, J4 0. Pet nedelja izgradnje od ukinute nedelje javlja se samo uz izuzetak D5 4 odmah posle (12 ned, smanjena ned 3; 17 ned, smanjena ned 7). Primer E iz A16 (asOf 2026-11-13, bol 7, r = 3): ned 4 rasterećenje 23,8 → izgradnja 32,7 (osnova 29,7 + 3,0). Tumačenje: polje reduced je izričita odluka assess — višak nije smanjenje ni u koraku sa bolom (A17 tada samo preko nedelje sidra); rezervni put bez polja važi samo za korake sačuvane pre 10k-v2.5.0. Sačuvan plan 10k-v2.4.0 i 10k-v2.4.1 ostaje plan 10K v2 i prilagođava se pravilima 10k-v2.5.0 (A15).'
  },
  /* ---------- Segment 06f (10k-v2.6.0): umor vezan za zapise, traka u domenu, minimum nedelje za cilj. ---------- */
  {
    id: 'A18',
    rule: 'Pouka 36: umor (A5) je vezan za ZAPISE, ne za dan adaptacije — prinudno rasterećenje = prva nedelja koja počinje posle poslednjeg RPE zapisa koji čini umor (nedelja posle nedelje zapisa; korak.deloadWeek kad ≠ fromWeek, steps.deloadWeekOf — jedina definicija za framesFor, newLimits, validator); kad asOf već pada u nju, rasterećenje važi za njen ostatak (prošli dani zaštićeni; urađen test te nedelje ostaje, rasterećenje bez novog testa). Kad je ta nedelja već rasterećenje u planu (redovno ili prinudno iz prethodnog koraka), umor nije primenjen. Isti zapisi poslati ponovo (asOf + 1 … + 7) ne prave novo rasterećenje. Isto za bol (pouka 18, nalaz 3): korak bola sa asOf ≥ poslednjeg zapisa bola već ga je obradio — isti zapis ne pravi nov period odmora/bola („već u planu"); nov zapis bola pravi. Pouka 20: traka „Plan treba prilagoditi" — JEDNO pravilo, samo u domenu (adapt.adaptBanner; aplikacija ga samo zove): asOf posle poslednje adaptacije, plan se menja u nedelji koja se završava posle asOf; promena (nov rezultat, manjak, višak) kad je primenjena; ograničenje (bol, pauza, umor) kad je primenjeno i korak donosi novo ograničenje (steps.newLimits poslednjeg koraka — datumi bez kvaliteta / jedan kvalitet / odmor / bol kojih nema u prethodnim koracima, novo prinudno rasterećenje, nov start), bol još i samo uz zapis bola noviji od poslednje adaptacije. Pouka 25: minimum nedelje (D17) važi za CILJ (TARGET_FLOOR, A9); nedelja sa danima odmora, ili bola van trkačke, planirano ispod minimuma → upozorenje WEEK_MIN_REST, ne WEEK_MIN_VOLUME. Pouka 35 (generator i adaptacija): u nedelji izgradnje (bez rasterećenja, tapera i trkačke) sa dva dana kvaliteta, kad bi neki dan kvaliteta trajao duže od dugog, drugi dan kvaliteta je lagan (prvi ostaje, cilj nedelje isti, buildLengths raspoređuje oslobođeni obim — dugi raste), napomena „Pouka 35: drugi dan kvaliteta …" (kad je i prvi duži od dugog — dopuna D25, preporuka manje dana); nedelja sa jednim kvalitetom neizvodljiva → dva ostaju uz napomenu, validator: upozorenje TWO_QUALITY_LONGER; jedno mesto odluke week.buildWeek, isti predikat qualityOverLong u validatoru (QUALITY_OVER_LONG greška bez napomene; uloga q2 → lagan; glavna doza sme da padne; ponavljanje jedinog slota kao kod 3 dana; stanje drugog slota posle mešovite nedelje ostaje nepoznato dok ga nedelja izgradnje ne odredi).',
    place:
      'assess.ts (A5: nedelja iz zapisa, deloadWeek; A4: isti zapis bola); steps.ts deloadWeekOf, framesFor; validate.ts protectedDay; adapt.ts / generate.ts / written.ts (doneDayIds); steps.ts newLimits; adapt.ts adaptBanner; app/adapt.ts (samo poziv); week.ts buildWeek (pouka 35, qualityOverLong, P35_DROP/P35_KEEP); validate.ts (pouka 35, WEEK_MIN_REST i uz dane bola); app/plan.ts KNOWN_VERSIONS',
    rationale:
      'Odluke organizatora (MAR-06 pitanje 2, Faza 4a N5/N12/traka, 10K-06f: prva adaptacija ponedeljkom prihvaćena, pouka 35 opcija A, nalaz 3). Merenje (fatigue-repeat.ts 10K, isti zapisi umora sledeći dan): asOf kraj nedelje 903/963 tokova dobija drugo rasterećenje na 10k-v2.5.2, sada 0; asOf sreda 0 → 0. Prva adaptacija umora sa asOf = prvi dan nedelje redovnog rasterećenja (zapisi u prethodnoj nedelji): 620/2712 tokova (uzorak 4a, asOf prvi dan svake nedelje 2 … N − 2) — na 10k-v2.5.2 redovno k + prinudno k + 1, sada samo k (npr. d4-r-18w, prvo rasterećenje, asOf njegov ponedeljak). Precizno pravilo (organizator, MAR-07): zapisi pet/ned nedelje k − 1, asOf ponedeljak k → rasterećenje u nedelji k (fatigue-monday.ts 10K: na 7ba9717 176/296 tekuća + 1 (organizator), na e7ad505 148/296, sada 268 tekuća, 28 bez novog — nedelja k već rasterećenje); ista prijava u nedelju k − 1 daje iste dane od utorka (trajna mreža; izuzetak: ponedeljak k je dan testa — urađen, ostaje). Zaštićeni dani (kao maraton MAR-07b, A11b): provere po danu (tipovi, WU/CD, RPE, oporavci, struktura testa, lagan ≥ min) preskaču dane ≤ asOf, zaključane i urađene (plan.adaptation.doneDayIds za urađen dan posle asOf) — locked-result.ts 10K (nov rezultat + zaključan Q1 sledeće nedelje): 1645/1960 odbijeno (WARMUP/COOLDOWN) → 0. Nalaz 3: b-d4-11w-18km-v35-B-sat, bol 8 kraj ned 9 poslat ponovo sutra → na 10k-v2.5.2 RACE_WEEK_OVER_TAPER (period odmora pomeren za dan: taper 3 km < dan pred trku 3,3 km), sada isti plan. Traka: oblik maraton v2 (MAR-06); newLimits iz koraka plana u adaptBanner (nije novo polje rezultata adaptacije). Pouka 25: u merenim mrežama 0 slučajeva. Pouka 35 na 10k-v2.5.2: generator 2022 nedelje u 858/31 122 planova (sve ned 1 tih planova, 4–6 dana, nizak obim / brz tempo; q1 R/I/RP i q2 T duži od dugog za medijanu 5,6 min, najviše 23,2 min; u 92 % i q1 duži); adaptacija 3602/121 392 toka (pauza 35: 1148). Posle: 0 takvih nedelja, menja se tačno 858 planova (prva promenjena nedelja = nedelja pouke 35), vrh cilja isti, najveća glavna doza niža u 240 planova (q2 progresija kreće kasnije); npr. 10w-25km-v70-A-sat ned 1 dugi 5,6 → 8,2 km (34 min) uz R dan 32 min.'
  },
  /* ---------- Segment 06g (10k-v2.6.1): trkačka nedelja samo sa danom pred trku, nedelja cela odmor. ---------- */
  {
    id: 'A19',
    rule: 'Pouke 23 i 30 (odluka organizatora): kad ni bez svih laganih dana trkačka nedelja nije ≤ planirano tapera (D23), ostaju dan pred trku i trka (week.raceWeekRest pretvara sve ostale dane u odmor; dan pred trku se ne skraćuje) — validator: upozorenje RACE_WEEK_OVER_TAPER_EVE umesto greške (predikat week.raceWeekEveOnly, i u adaptInvariants). D23 dani odmora trkačke nedelje računaju se i kad je taper mešovit (upisan taper, isti koji čita konstruktor). Nedelja čiji su svi dani trčanja dani odmora koraka (bol, A4), i trkačka nedelja samo sa trkom (ostali dani odmor ili D23) — upozorenje WEEK_ALL_REST, ne EMPTY_WEEK (kao HM/maraton N1). Pouka 35 u mešovitoj nedelji važi samo za buduće dane — prošao dan kvaliteta je činjenica.',
    place:
      'week.ts raceWeekRest, raceWeekEveOnly; validate.ts (D23, RACE_WEEK_OVER_TAPER_EVE, WEEK_ALL_REST); adaptInvariants.ts (trkačka > taper); app/plan.ts KNOWN_VERSIONS',
    rationale:
      'Organizator (06f otvoreno a i b). Nalaz: b-d4-11w-18km-v35-B-sat, bol 8 kraj ned 9 i NOV bol 8 sutra → na 10k-v2.6.0 RACE_WEEK_OVER_TAPER (dan pred trku 3,3 km > taper 3 km), sada upozorenje. Trajna mreža (nov bol 7/8 svakog dana ned N − 3 … N − 1, nov zapis asOf + 1 … + 7) na 10k-v2.6.0: odbijeno RACE_WEEK_OVER_TAPER, EMPTY_WEEK (6 dana odmora iz dve prijave — nedelja cela odmor; trkačka samo sa trkom) i RACE_WEEK (mešovit taper: validator nije računao D23) → 0. Pouka 35 u mešovitoj nedelji asOf: 467 tokova prvog koraka uzorka 4a (dan kvaliteta pre asOf duži od dugog) — prihvaćeno, bez izmene.'
  },
  /* ---------- Segment 06h (10k-v2.6.2): umor pre starta sa asOf = prvi dan plana. ---------- */
  {
    id: 'A20',
    rule: 'Pouke 23, 34 i 36: referenca umora pre starta (korak.preStart — cilj, dugi i doza nedelje 1 generatora bez činjenica) važi za nedelju prinudnog rasterećenja koraka (steps.deloadWeekOf), ne za fromWeek — konstruktor (volume.adaptVolume, generate ctxAt) i validator čitaju je istim ključem. asOf = prvi dan plana sa zapisima umora pre starta: nedelja 1 je rasterećenje kao sa asOf = start − 1 (deloadWeek 1 < fromWeek 2, ostatak tekuće nedelje), dan 1 (≤ asOf, zaštićen) ostaje upisan kakav jeste; ostali dani nedelje 1 i nedelje 2…N isti kao start − 1. Planirano nedelje 1 sme biti iznad cilja (upisani dan umesto sastavljenog) — isto pravilo mešovite nedelje kao tekuće rasterećenje nedelje k ≥ 2 (A11, A18); „ostatak do cilja minus upisani dani" je zasebna odluka za sve distance (organizator, pouka 37).',
    place:
      'volume.ts adaptVolume (preStart po deloadWeekOf); generate.ts construct ctxAt; validate.ts (sadržaj rasterećenja iz koraka.preStart); app/plan.ts KNOWN_VERSIONS',
    rationale:
      'Organizator (22. 10., fatigue-startday.ts): umor sa asOf = start → WEEK_INFEASIBLE u 1245/1245 planova (10k-v2.6.1); HM, maraton i 5K daju rasterećenje nedelje 1. Uzrok: 06e je ključ reference vezao za fromWeek, 06f je nedelju rasterećenja premestio u deloadWeek — nedelja 1 rasterećenja bez dugog reference, buildWeek bez rešenja za svaki cilj. Merenje posle: fatigue-startday 1245 → 0, fatigue-testweek 86/6650 → 0, start-day 10K 25 (42 330 tokova) 623 → 0, adaptInvariants 0; regresija 145 673 toka (svaki 40. plan, asOf start − 6 … + 14, 17 scenarija): promenjeno 779, svi start + 0 umor, svi ranije odbijeni; start + 0 = start − 1 osim dana 1 u 1245/1245. Planirano nedelje 1 > cilj u 805/1245 (prosečno + 2,46 km) — osobina svih distanci (organizator: 5K 22/42, 10K 367/582, HM 291/449, MAR 426/613), poseban segment.'
  }
];

export const TEN_K_V2_POLICY = {
  id: '10k-v2',
  version: '10k-v2.6.2',

  /** D1 (dani i obim: D17; početnik: D28). */
  input: {
    /** < 8 nedelja: trajno odbijanje (D21 pokriva 8–9). */
    weeksMin: 8,
    weeksMax: 18,
    resultMaxAgeDays: 84,
    resultDistancesM: [3000, 5000, 10000, 21097.5] as readonly number[],
    /** VDOT iz rezultata < vdotMin → plan po osećaju (D26). */
    vdotMin: 30,
    vdotMax: 80,
    /** D29: 10K plan traži neprekidno trčanje ≥ continuousRunMin [min]. */
    continuousRunMin: 30
  },

  /** D26: plan po osećaju (bez pouzdanog rezultata). */
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
      RP: { min: 7, max: 8, cue: 'ritam trke 10K' },
      I: { min: 8, max: 8, cue: 'teško, izdrživo 3–5 min' },
      R: { min: 8, max: 8, cue: 'brzo, opušteno' }
    }
  },

  /** D27: test (samo plan po osećaju). */
  test: { km: 5 },

  /** D28: JEDINA tabela početnika (udeo dugog, min i max nedelje: red D17 za isti broj dana). */
  beginner: {
    days: {
      3: { kmMin: 15, kmMax: 30 },
      4: { kmMin: 18, kmMax: 35 }
    },
    weeksMin: 10,
    /** Nedelje 1..introWeeks bez kvaliteta. */
    introWeeks: 2,
    growth: 0.05,
    growthMinKm: 1.0,
    growthMaxKm: 2.0,
    peakFactor: 1.3,
    peakAddKm: 10,
    longMaxSec: 5400,
    /** D31: prvi nivo lestvice T kontinuirano početnika (ispred 2,0 km) = najmanja T doza rasterećenja i
        tapera početnika [km]. */
    tFirstKm: 1.5
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
    /** D10/D22: T deonice ≥ 1000 m. */
    repMinM: 1000,
    /** D30: RP deonice ≥ 800 m (10k-v2.2.1: 1000 m, D22b). */
    rpRepMinM: 800,
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

  /** Segment 04: adaptacija (A1–A15). Rezultat: starost i VDOT kao ulaz (input.resultMaxAgeDays, vdotMin,
      vdotMax); donja granica cilja: weekMinKm (D17, A9); lagan ≥ lengths.easyMinKm. */
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
    /** A3: nov start i < ovoliko nedelja do trke → cilj „orijentir". */
    restartFullPrepWeeks: 8,
    /** A4: bol ≥ painMin u poslednjih painLookbackDays dana → painDays dana bez kvaliteta i ubrzanja, dugi ≤
        painLongMaxSec, lagani × painEasyFactor; bol ≥ painRestMin → najpre restDays dana odmora. */
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
      'Cilj je orijentir: posle duge pauze do trke ostaje manje od 8 nedelja, priprema nije potpuna (A3).',
    painMessage:
      'Bol: 7 dana bez kvaliteta i ubrzanja, dugi ≤ 60 min, lagani kraći. Ako bol traje ili se pojačava, potraži stručni pregled (A4).'
  },

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

/** D28: brojevi dana trčanja početnika. */
export const BEGINNER_DAYS_COUNTS = Object.keys(TEN_K_V2_POLICY.beginner.days)
  .map(Number)
  .sort((a, b) => a - b) as readonly (keyof TenKV2Policy['beginner']['days'])[];

/** Pravilo plana: red D17 (redovan) ili red D17 izmenjen tabelom početnika (D28). Jedino mesto gde se
    brojevi rasta, vrha, dugog i uvoda i test plana po osećaju (D32) biraju po iskustvu. */
export interface PlanRule extends DayRule {
  readonly beginner: boolean;
  /** D13/D28: plafon dugog sporim E [s]. */
  readonly longMaxSec: number;
  /** D6/D28: rast nedelje izgradnje i granica vrha. */
  readonly growth: number;
  readonly growthMinKm: number;
  readonly growthMaxKm: number;
  readonly peakFactor: number;
  readonly peakAddKm: number;
  /** D28: nedelje 1..introWeeks bez kvaliteta (0 = nema uvoda). */
  readonly introWeeks: number;
  /** D1/D28: najmanje nedelja. */
  readonly weeksMin: number;
  /** D27/D32: plan po osećaju ima test 5 km (početnik nema). */
  readonly feelTest: boolean;
  /** Brojevi dana dostupni ovom iskustvu (preporuke u porukama). */
  readonly dayCounts: readonly number[];
}

export function planRule(count: number, experience: Experience): PlanRule | null {
  const d = dayRule(count);
  if (!d) return null;
  const P = TEN_K_V2_POLICY;
  if (experience === 'regular')
    return {
      ...d,
      beginner: false,
      longMaxSec: P.lengths.longMaxSec,
      growth: P.volume.growth,
      growthMinKm: P.volume.growthMinKm,
      growthMaxKm: P.volume.growthMaxKm,
      peakFactor: P.volume.peakFactor,
      peakAddKm: P.volume.peakAddKm,
      introWeeks: 0,
      weeksMin: P.input.weeksMin,
      feelTest: true,
      dayCounts: RUN_DAYS_COUNTS
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
    longMaxSec: b.longMaxSec,
    growth: b.growth,
    growthMinKm: b.growthMinKm,
    growthMaxKm: b.growthMaxKm,
    peakFactor: b.peakFactor,
    peakAddKm: b.peakAddKm,
    introWeeks: b.introWeeks,
    weeksMin: b.weeksMin,
    feelTest: false,
    dayCounts: BEGINNER_DAYS_COUNTS
  };
}
