/* HM v2 — politika: svaki trenerski broj ima JEDNO mesto (ovde) i red u DECISIONS sa pravilom, mestom i
   obrazloženjem (izvor ili heuristika). Brojevi su iz docs/generators-v2/MASTER-HM-MARATHON.md § 4 (H1–H15);
   tumačenja bez novog broja su posebni redovi (HI*). Ostali fajlovi čitaju samo ovaj objekat (i `dayRule`,
   pristup tabeli dana H15); nijedan od njih ne nosi sopstveni trenerski broj. */

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
    id: 'H1',
    rule: 'Opseg (segment 02): 3, 4, 5 ili 6 dana trčanja; 10–20 celih nedelja do trke; trenutni obim po redu H15 (3 d 25–45, 4 d 30–60, 5 d 35–75, 6 d 40–90 km); rezultat 5 km, 10 km, polumaraton ili maraton ne stariji od 84 dana, VDOT 30–80. < 10 nedelja trajno odbijanje (preporuka 10K); > 20 nedelja „počni kasnije" (datum); obim van reda: preporuka brojeva dana čiji red podržava obim, a ispod najmanjeg reda (25 km) 10K ili izgradnja osnove; 1, 2 i 7 dana trajno; bez pouzdanog rezultata (nema ga, stariji od 84 dana, VDOT < 30) privremeno odbijanje RESULT_REQUIRED (plan po osećaju: segment 03); početnik privremeno (segment 03); trčanje/hodanje trajno (H17); VDOT > 80 trajno.',
    place: 'input.ts (brojevi: input, days)',
    rationale:
      'Zadato u MASTER § 4 H1 i H15 (02). Max nedelje reda (H15) ostaje granica vrha (H6). Odbijanje je strukturisano (kod + poruka sa preporukom), nikad degenerisan plan (pouka 6).'
  },
  {
    id: 'H2',
    rule: 'VDOT iz rezultata (Daniels–Gilbert); zone E 0,62–0,70, T 0,88, I 0,975, R 1,05 kao udeo VDOT-a; RP = tempo prognoze polumaratona iz TRENUTNOG VDOT-a; tempo fiksan kroz plan (menja ga samo adaptacija, segment 04).',
    place: 'paces.ts (udeli: paces)',
    rationale:
      'Jednačine su objavljeni model (Daniels i Gilbert 1979). Udeli zona: sekundarni izvor (Danielsov opis zona: E ≈ 59–74 %, T ≈ 83–88 %, I ≈ 95–100 % VO2max); R = 1,05 je heuristika. RP iz cilja bi trening vezao za neproveren broj.'
  },
  {
    id: 'H3',
    rule: 'Δ = VDOT cilja − trenutni VDOT; Δ ≤ 0,1·N realističan, ≤ 0,2·N ambiciozan, više nerealan (upozorenje GOAL_UNREALISTIC); cilj ne menja tempo.',
    place: 'paces.ts assessGoal (pragovi: goal)',
    rationale:
      'Heuristika napretka po nedelji (kao 10K v2 D3). Nerealan cilj je upozorenje, ne odbijanje; sporiji od prognoze je realističan.'
  },
  {
    id: 'H4',
    rule: 'Poslednja nedelja trka, pretposlednja taper; B = N − 2: specifično 3 (B ≤ 9), 4 (B 10–13), 5 (B ≥ 14); baza = ceil((B − spec)/2); razvoj = ostatak.',
    place: 'periodize.ts (phases)',
    rationale:
      'Ukupno smanjenje ≈ 13 dana (taper + 6 dana trkačke nedelje), u opsegu 8–14 dana iz meta-analize Bosquet i sar. 2007 (više sportova, nije specifično za polumaraton: obim −41–60 %, intenzitet i učestalost zadržani).'
  },
  {
    id: 'H5',
    rule: 'Rasterećenje: najviše 3 uzastopne nedelje izgradnje (izuzetno 4 kad bi rasterećenje palo na prvu nedelju faze); nikad na prvoj nedelji faze, u nedeljama 1–2, ni na poslednjoj nedelji pred taperom (pouka 4); cilj 0,8 × poslednji ne-rasteretni cilj; 1 kvalitet T ≈ 60 % poslednje doze T slota (nivo lestvice naniže, min 2,0 km: baza 2,0 km kontinuirano, razvoj/specifično 2 × 1000 m); dugi 0,8 × poslednji ne-rasteretni dugi; ostali dani lagani.',
    place:
      'periodize.ts (gde: deloadWeeks); week.ts + quality.ts pickDeload + lengths.ts deloadLengths (sadržaj); volume.ts nominal10 (cilj)',
    rationale:
      'Heuristika 3:1 (kao 10K v2 D5). Raspored: deterministička pretraga — najmanje rasterećenja, pa izgradnja što ranije. T 2,0 km u razvoju i specifičnoj fazi kao 2 × 1000 m: T cruise lestvica nema nivo 2,0 km, a 2 × 1000 m je ista doza druge strukture po H10 (T ≥ 1000 m).'
  },
  {
    id: 'H6',
    rule: 'Nedelja 1 = trenutni obim; izgradnja +6 % poslednjeg ne-rasteretnog cilja (min 1,0, max 4,0 km, korak 0,1); vrh = min(start × 1,4; start + 20; max nedelje reda H15; kapacitet). Kapacitet = STVARNA konstrukcija nedelje (week.ts); neizvodljiv cilj → samo ta nedelja na najbliži izvodljiv cilj (napomena, upozorenje WEEK_FITTED); granica izgradnje se nikad ne spušta; sledeći rast od cilja koji je nedelja stvarno dobila. Spuštena nedelja izgradnje → CAPACITY_LIMITED (imenuje ograničenje: dugi 150 min, udeo reda, 24 km, skorašnji najduži; HI8).',
    place: 'volume.ts (jedini vlasnik cilja i poruke); generate.ts + validate.ts prijavljuju',
    rationale:
      'Heuristika umerenog rasta (pouke 1 i 9). Kapacitet nije formula: udeo dugog × (lagan ≤ dugi) × fiksni WU/CD određuju najveći obim nedelje, a proverava ga konstrukcija. Nedelja 1 < trenutni obim sme samo kad je dugi nedelje 1 na apsolutnom plafonu (150 min; od HM-02 i 24 km i skorašnji najduži, HI8).'
  },
  {
    id: 'H7',
    rule: 'Taper: cilj 0,7 × vrh; RP i T, svaki ≈ 60 % poslednje doze zone (nivo naniže; min RP 2 × 2000 m, T 2,0 km = 2 × 1000 m); dugi ≤ 0,6 × najduži dugi plana; svi dani trčanja zadržani.',
    place: 'week.ts + quality.ts pickTaper + lengths.ts taperLengths; cilj volume.ts nominal10',
    rationale:
      'Smanjen obim uz zadržan intenzitet i učestalost (Bosquet i sar. 2007; isti ograničen dokaz kao H4). Taper se ne podiže: neizvodljiv cilj samo naniže (H6).'
  },
  {
    id: 'H8',
    rule: 'Trkačka nedelja: dana sa trkom = min(broj dana, 5); trka zamenjuje dugi (otpada prvo dan dugog, pa najraniji lagan dan); oštrenje WU + 2 × 2000 m RP (oporavak 2:00) + CD na najkasnijem danu ≥ 3 dana pre trke, nesusedno poslednjem zahtevnom danu tapera, i ≤ RP doza tapera (taper bez RP → bez oštrenja); dan pred trku 20 min E + 4 × 20 s (≤ 30 min, pouka 5); ostali dani min(35 min E, najkraći lagan tapera) — kraći se zadaje u km; trka 21,1 km + WU 10 + CD 10 min van obima; cilj = planirano; Uslov 8: planirano + 21,1 km ≥ minimum nedelje.',
    place: 'week.ts (raceWeek, raceWeekRuns, raceEasyWorkout, sharpenerReps) + workouts.ts',
    rationale:
      'Fiksna trenerska heuristika (MASTER H8, pouka 5): trkačka nedelja (bez trke) ≤ taper, oštrenje ≤ RP tapera. Plafon H11 ne važi za trkačku nedelju (potpuno zadata). WU/CD oštrenja po H14.'
  },
  {
    id: 'H9',
    rule: 'Šablon po redu H15: 3 dana Q1 + dugi + 1 lagan (Q1 nesusedan dugom, lagan bilo gde); 4/5/6 dana Q1 + Q2 + dugi + 1/2/3 lagana; kvaliteti i dugi međusobno nesusedni (ciklično: nedelja i ponedeljak su susedni); dugi: dan iz ulaza, inače nedelja, inače poslednji dan trčanja; nema rešenja → SCHEDULE_NO_RECOVERY sa predlogom.',
    place: 'schedule.ts',
    rationale:
      'Dan oporavka između zahtevnih dana. Više rešenja: najveći razmak dugi → Q1, pa Q1 → Q2, pa raniji Q1 (tehnički, deterministički izbor, kao 10K v2 D9 i D18).'
  },
  {
    id: 'H10',
    rule: '4–6 dana: baza Q1 R, Q2 T kontinuirano; razvoj Q1 I, Q2 T cruise; specifično Q1 RP, Q2 T cruise. 3 dana (H15): jedan kvalitet (Q1) — baza T kontinuirano, razvoj T cruise, specifično RP; bez I i R. Lestvice: R 6×200 · 8×200 · 6×300 · 10×200 · 8×300 · 8×400 | T kont. 2,0 · 2,5 · 3,0 · 4,0 · 5,0 · 6,0 · 7,0 km | T cruise 2×1200 · 3×1000 · 2×1600 · 4×1000 · 3×1600 · 4×1500 · 4×1600 · 5×1600 · 3×3000 | I 2×1000 · 3×800 · 3×1000 · 4×1000 · 4×1200 · 5×1000 · 5×1200 | RP 2×2000 · 2×2500 · 2×3000 · 2×4000 · 3×3000 · 2×5000 · 3×4000. Druga struktura iste doze: T kontinuirano ili 2–5 jednakih deonica ≥ 1000 m; RP 2–5 jednakih deonica ≥ 2000 m ili kontinuirano do 10 km; I do 6 jednakih deonica 800–1200 m ili piramida 1200 + 1000 + 800 m; R deonice 200 / 300 / 400 m. Deonice deljive sa 100 m, a kad takve podele nema sa 50 m (pouka 11).',
    place: 'workouts.ts (lestvice, structuresForDose), quality.ts (izbor)',
    rationale:
      'Heuristika redosleda razvoja (brzina/ekonomija → prag/VO2max → specifičnost polumaratona). Tumačenje (HI1): broj deonica druge strukture 2–5 i korak 100/50 m preuzeti iz 10K v2 D10/D22 (MASTER H10 navodi samo najmanju deonicu po zoni); prihvataju se samo tačne podele (doza se ne menja). Nema druge strukture → slot ponavlja trening uz napomenu (druga nedelja se razlikuje po drugom slotu).'
  },
  {
    id: 'H11',
    rule: 'Jedan plafon po zoni, po treningu, % ciljnog obima nedelje: R 5 %, I 8 %, T 10 %, RP 15 %. Ne važi za trkačku nedelju (H8).',
    place: 'policy.ts caps; proverava quality.ts (izbor) i validate.ts (ZONE_CAP)',
    rationale:
      'R/I/T prema Danielsu (sekundarni izvor, ne dokaz); RP 15 % heuristika (polumaratonski tempo je bliži T nego I). Nema drugih limita za iste zone (Uslov 2). Najniži nivo svake lestvice staje u plafon pri najmanjem obimu reda (30 km; pouka 10): R 1200 ≤ 1500, I 2000 ≤ 2400, T 2000 ≤ 3000, T cruise 2400 ≤ 3000, RP 4000 ≤ 4500 m.'
  },
  {
    id: 'H12',
    rule: 'Po slotu: sledeći nivo ako staje u plafon (≤ 1 nivo nedeljno), inače ista doza druge strukture (nema je — ponavljanje uz napomenu); doza ne pada van rasterećenja/tapera/trke; početni nivo = najviši nivo ≤ 60 % plafona zone (najmanje prvi nivo) na prvoj nedelji slota i na prvoj nedelji nove zone (I u razvoju, RP u specifičnoj); prelazi T cruise ≥ poslednje T kontinuirano, RP ≥ max(početni nivo, poslednje I; 3 dana: poslednje T, HI6); glavna doza (T + I + RP) ne opada kroz ne-rasteretne nedelje izgradnje; nema identičnih uzastopnih ne-rasteretnih nedelja; baza bez platoa (T raste ili menja strukturu). H11 ispred H12 samo u nedelji ograničenoj kapacitetom (pouka 12): kad nijedan cilj nedelje nije izvodljiv uz „doza ne pada", doza van plafona ide na najviši nivo lestvice u plafonu (napomena, DOSE_DROPPED).',
    place:
      'quality.ts (pickSlot, startLevel, carries); validate.ts (DOSE_*, START_LEVEL, MAIN_DOSE_DECREASE, IDENTICAL_WEEKS, BASE_PLATEAU)',
    rationale:
      'Postepena progresija bez skokova (pouke 3, 10, 11, 12); „sledeći nivo" = najmanji nivo lestvice veći od trenutne doze. 60 % plafona: heuristika (kao 10K v2 D16) — kvalitetni dan nosi srazmeran deo nedelje, ostaje prostor za progresiju.'
  },
  {
    id: 'H13',
    rule: 'Dugi ≤ udeo cilja po broju dana (H15: 3 d 45 %, 4 d 40 % — odluka organizatora posle zaustavljanja faf8807, 5 d 32 %, 6 d 30 %) i ≤ 150 min sporim E i ≤ 24 km (odluka organizatora HM-01 → 02, za sve brojeve dana); korak 0,1 km; dugi ≥ svaki lagan (tvrdo, pouka 2); lagan ≥ 4 km; dugi uzima najveću dozvoljenu dužinu, lagan ostatak. Upozorenje LONG_RUN_SHORT kad je najduži dugi plana < 16 km (preporuka: više dana ili obima).',
    place: 'lengths.ts (jedini vlasnik dužina); validate.ts (LONG_*, EASY_MIN, LONG_RUN_SHORT)',
    rationale:
      '150 min: heuristika (Daniels, sekundarni izvor). 24 km ≈ 1,15 × trka (heuristika, odluka organizatora): u HM-01 1320 / 3696 planova imalo je dugi > 24 km (do 28 km nedeljama zaredom pri 50–60 km sa 4 dana) — maratonska dužina, ne polumaratonska; merenje pre/posle u docs/hm-v2/reports/SEGMENT-02-IMPLEMENTATION.md (artifacts/segment-02/measure-24.ts). Izmereno (measure-24.ts, mreža 02 pre/posle): dugi > 24 km 660 / 1320 / 1320 / 1980 planova (3/4/5/6 d) → 0; vrh niži 0 planova, nedelja 1 ispod obima i CAPACITY_LIMITED po obimu bez promene (4 d 774 → 774) — kapacitet ne pada, višak obima ide u lagane dane. Nedelja 1 sme ispod trenutnog obima i kad je dugi na 24 km (HI8). Udeo 40 % pri 4 dana (heuristika, odluka organizatora): plan sa 4 dana nosi dugi kao najveći deo nedelje; Danielsovih 25–30 % važi za 5–7 dana; niz udela po broju dana ostaje opadajući (3 d 45 %, 4 d 40 %, 5 d 32 %, 6 d 30 %); dugi i dalje ≤ 150 min i lagan ≤ dugi. Dugi < 16 km je kratak za polumaraton (heuristika) — upozorenje, ne odbijanje.'
  },
  {
    id: 'H14',
    rule: 'WU/CD E po pojasu trenutnog obima iz ulaza (0,1 km), konstantno kroz plan: < 40 km 15/10 min; 40–59,9 km 20/15 min; ≥ 60 km 25/15 min (fiksni deo treninga, nikad pufer); km po srednjem E. Oporavci: R isti metraž džogom; I 1:1 vreme naniže na 15 s (max 4:00); T cruise 60 s (deonica ≤ 1600 m) / 90 s; RP 90 s (≤ 3000 m) / 120 s; oštrenje 120 s (H8); ubrzanja: isti metraž džogom.',
    place: 'workouts.ts (warmupCooldown, recoveryOf)',
    rationale:
      'Trkač većeg obima ima duže zagrevanje (heuristika, MASTER H14). WU/CD nisu pufer za km (Uslov 3): manjak obima ide u lagan dan ili se prijavljuje kao izvodljiv cilj (H6).'
  },
  {
    id: 'H15',
    rule: 'Tabela dana (days, JEDINA): 3 dana = 1 kvalitet + 1 lagan + dugi, obim 25–45 km, max nedelje 55, dugi ≤ 45 %, min 12 km | 4 dana = 2 kvaliteta + 1 lagan + dugi, 30–60, max 70, 40 % (MASTER: 35 %; izmena posle zaustavljanja faf8807), min 16 | 5 dana = 2 kvaliteta + 2 lagana, 35–75, max 85, 32 %, min 20 | 6 dana = 2 kvaliteta + 3 lagana, 40–90, max 100, 30 %, min 24. 5/6 dana: lagani jednaki (razlika ≤ 0,1 km, raniji dan dobija višak). 1/2/7 dana odbijanje. Uslov 8: nedelja ispod minimuma = greška; trkačka: planirano + 21,1 km.',
    place:
      'policy.ts days (dayRule); čitaju input.ts, schedule.ts, lengths.ts, volume.ts, week.ts, validate.ts',
    rationale:
      'Zadato u MASTER H15 (red 4 dana), osim udela dugog. Udeo 35 % se nije mogao ispuniti zajedno sa H6/pouka 9 (nedelja 1 = trenutni obim; ispod samo uz dugi na 150 min), lagan ≤ dugi, WU/CD H14 i početnim nivoima H12: kapacitet nedelje ≈ (Q1 + Q2)/(1 − 2 × udeo), pa spor trkač nije mogao da nosi trenutni obim (zaustavljanje faf8807: mreža 01 396 / 3696 odbijeno, VDOT 30 pri 35/45–60 km, VDOT 35 pri 55 km; gusta provera nedelje 1, 30 401 ulaz, 2870 ispod obima bez 150 min, pad do 15,3 km). Uz 40 %: mreža 01 0 odbijanja, gusto 0, upozorenje „najduži dugi < 16 km" 528 → 6 (docs/hm-v2/reports/SEGMENT-01-STOP.md). Minimum nedelje = broj dana × lagan 4 km (isti obrazac kao 10K v2: dani × 3 km). Redovi 3/5/6 dana: MASTER H15 (02) doslovno.'
  },
  {
    id: 'H17',
    rule: 'Trčanje/hodanje (runWalk true) → RUN_WALK_NOT_SUPPORTED: plan polumaratona traži neprekidno trčanje; preporuka 5K plan trčanja/hodanja.',
    place: 'input.ts',
    rationale: 'Zadato u MASTER H17; nema plana polumaratona trčanja/hodanja.'
  },
  {
    id: 'HI1',
    rule: 'Tumačenje H10 (prihvaćeno, organizator): druga struktura iste doze ima 2–5 jednakih deonica (I do 6), deljivih sa 100 m, a kad takve podele nema sa 50 m (pouka 11); najmanja deonica po zoni iz H10 (T 1000 m, RP 2000 m, I 800 m).',
    place: 'policy.ts alternatives; workouts.ts structuresForDose',
    rationale:
      'Isto kao 10K v2 D10/D22 (pouka 11); MASTER H10 navodi samo najmanju deonicu po zoni.'
  },
  {
    id: 'HI4',
    rule: 'Tumačenje H5/H7 (prihvaćeno, organizator): najmanja T doza rasterećenja i tapera 2,0 km je struktura lestvice faze — baza (T kontinuirano) 2,0 km kontinuirano; razvoj, specifično i taper (T cruise, nema nivo 2,0 km) prva podela na deonice ≥ 1000 m = 2 × 1000 m. Jedno pravilo: tFloorStructure.',
    place: 'workouts.ts tFloorStructure; quality.ts tMinStructure, deloadDose, taperDoses',
    rationale:
      'T cruise je zadat deonicama; 2 × 1000 m je ista doza druge strukture po H10 (T ≥ 1000 m) i ostaje u lestvici faze (validator: lestvica rasterećenja po fazi).'
  },
  {
    id: 'HI5',
    rule: 'Pouka 27 (MASTER § 2, MAR-01): kad jednake deonice I nemaju drugu strukturu iste doze, druga struktura je piramida u opsegu zone (800–1200 m) sa korakom 200 m i istim zbirom, isti broj deonica; naizmenično sa jednakim deonicama (pouka 3). Pravilo: simetrična piramida od 800 m, razlika do zbira po 200 m na deonice najbliže vrhu (pri istoj dužini kasnija): I 2000 → 800-1200, I 5000 → 800-1000-1200-1200-800.',
    place: 'workouts.ts stepPyramid, structuresForDose; quality.ts otherStructure (naizmenično)',
    rationale:
      'Bez toga slot I 2,0 / 5,0 km bez sledećeg nivoa u plafonu ponavlja isti trening (pouka 3). U mreži 01 i gustoj mreži nedelje 1 ponavljanje se ne javlja ni bez pravila (0 nedelja); pravilo važi za ulaze van mreže. Tumačenje rasporeda razlike (najbliže vrhu) je tehničko, bez novog trenerskog broja osim koraka 200 m iz pouke 27.'
  },
  {
    id: 'HI2',
    rule: 'Tumačenje H6/H7/H5 (bez novog broja): izgradnja sme naviše do granice izgradnje (najbliži izvodljiv cilj, pri jednakoj udaljenosti niži); rasterećenje i taper samo naniže (smanjenje ne sme da poraste); donja granica pretrage je minimum nedelje (16 km). Druga pretraga (samo kad nijedan cilj nije izvodljiv po pravilu) dozvoljava H11 ispred H12 (DOSE_DROPPED), rasterećenje bez kvaliteta i taper samo RP — svako uz napomenu i upozorenje; bez nove petlje.',
    place: 'volume.ts fit10; generate.ts (prolazi rule → relax); week.ts buildWeek',
    rationale:
      'Isti postupak kao 10K v2 (D6, D5/D7 odstupanja). Jedan vlasnik cilja; validator samo proverava oznaku i napomenu. Brojke koliko se popuštanje javlja u mreži 01: izveštaj SEGMENT-01 (K1–K6).'
  },
  {
    id: 'HI3',
    rule: 'Tumačenje H13 (pouka 14): UPOZORENJE LONG_SHORTER_THAN_QUALITY kad je u ne-rasteretnoj nedelji izgradnje najduži kvalitetni dan po trajanju duži od dugog (plan se ne menja); preporuka manje dana samo kad red tabele sa manje dana podržava trenutni obim.',
    place: 'validate.ts (LONG_SHORTER_THAN_QUALITY); volume.ts fewerDaysAdvice',
    rationale: 'Pouka 14 (10K v2 D25): upozorenje, ne skraćenje WU/CD (Uslov 3).'
  },
  {
    id: 'HI6',
    rule: 'Tumačenje H5/H7/H12 za 3 dana (jedan kvalitet, bez novog broja): rasterećenje — jedini kvalitet T (lestvica faze) ≈ 60 % poslednje doze jedinog slota (Q1), min 2,0 km, na danu Q1; taper — samo RP ≈ 60 % poslednje RP doze (min 2 × 2000 m), bez T (jedan kvalitetni dan); prelaz u specifično RP ≥ max(početni nivo, poslednje T) — glavna doza ne pada (pouka 3).',
    place:
      'quality.ts (ladderFor, carries, deloadSlot, deloadDose, taperDoses); week.ts; validate.ts',
    rationale:
      'Isto kao 10K v2 D18. H7 „RP i T" pretpostavlja dva kvalitetna dana; sa jednim danom specifičnost (RP) ima prednost. RP ≥ poslednje T: H12 „RP ≥ poslednje I" za 4–6 dana; kod 3 dana prethodna doza slota je T, a početni nivo RP bi spustio glavnu dozu (MAIN_DOSE_DECREASE).'
  },
  {
    id: 'HI7',
    rule: 'Pouka 28 (MASTER § 2, odluka organizatora posle MAR-02): dugi SVAKE nedelje ≤ max(1,1 × L, L + 1,0 km) (0,1 km naniže), L = najduži dugi u prethodne 4 nedelje plana; u nedeljama 1–4 u L ulazi i opcioni recentLongRunKm (skorašnji najduži trk, 5–42 km; van opsega RECENT_LONG_INVALID); uz udeo, 150 min i 24 km (H13). Jedna funkcija rollingLongCap10 za konstruktor, validator (LONG_ROLLING) i poruku. Kad konstrukcija nedelje (1, rasterećenje, taper, izgradnja) sa datim recentLongRunKm nije izvodljiva → odbijanje RECENT_LONG_TOO_SHORT (P1) sa pragom (najmanji r u koraku 0,5 km za koji je plan izvodljiv) i preporukom (duži dugi, duža priprema, manji obim, više dana, 10K). Bez ulaza: napomena nedelje 1 sa pragom (najmanji skorašnji najduži trk za koji je dugi nedelje 1 u granici, najmanje 5 km).',
    place:
      'input.ts (opseg); lengths.ts stepCap10, rollingLongCap10, recentLongNeeded10, week1LongCap10; week.ts (sve vrste nedelje); generate.ts (istorija dugih, odbijanje, napomena); validate.ts (LONG_ROLLING, DELOAD_LONG, WEEK1_BELOW_START)',
    rationale:
      'Heuristika „skok dugog ≤ 10 % (ili 1 km)". Posmatračka kohorta Frandsen i sar., Br J Sports Med 2025;59:1203–1210 (5205 rekreativaca, 18 meseci, Garmin): rizik povrede od preopterećenja raste kad pojedinačni trk premaši 10 % najdužeg trka u prethodnih 30 dana (asocijacija, ne uzročnost; prozor 4 nedelje plana ≈ 30 dana). Prva verzija (samo nedelja 1) pomerala je skok na nedelju 2 (maraton MAR-02: do × 2,4); P1 umesto WEEK_INFEASIBLE: odbijanje sa razlogom, bez novog broja (pouka 6). Merenja: docs/hm-v2/reports/SEGMENT-02-IMPLEMENTATION.md (artifacts/segment-02/measure-rolling.ts).'
  },
  {
    id: 'HI8',
    rule: 'Dopuna pouke 9 (H6): nedelja 1 < trenutni obim sme samo kad je dugi nedelje 1 na svom apsolutnom plafonu — min(150 min sporim E, 24 km, kotrljajuća granica nedelje 1 = granica skorašnjeg najdužeg ako je dat) — jedna funkcija week1LongCap10 za konstruktor, poruku i validator (pouka 24). CAPACITY_LIMITED imenuje ograničenje (150 min, udeo, 24 km, kotrljajuća granica pouke 28) i preporučuje veće brojeve dana iz H15.',
    place:
      'lengths.ts week1LongCap10; volume.ts capacityLimits, capacityMessage; validate.ts WEEK1_BELOW_START',
    rationale:
      'Odluka organizatora (HM-02 tačke 2 i 3): granica 24 km i pouka 28 su vremenski/apsolutni plafoni dugog kao 150 min, pa važi isti izuzetak.'
  },
  {
    id: 'HI9',
    rule: 'Odluke organizatora o otvorenim pitanjima HM-01 (bez promene koda): (a) lagan = dugi u izgradnji kod sporih trkača sa 4 dana je svesno (kao 10K N3) — CAPACITY_LIMITED preporučuje 5–6 dana; (b) R druga struktura 16 × 200 m = 8 × 400 m je u redu; (c) RP brži od T pri VDOT ≈ 80 je u redu (Daniels–Gilbert) — nijedna provera ne pretpostavlja RP sporiji od T; (d) brz trkač 30 km (lagan 4 km, taper dugi 6,1 km) je u redu.',
    place:
      'volume.ts capacityMessage (a); workouts.ts structuresForDose (b); paces.ts (c); lengths.ts (d)',
    rationale:
      'Odluka organizatora posle HM-01 (prompt HM-02, tačka 4); (c) proverava paces.node (RP i T su nezavisni udeli VDOT-a, bez poređenja).'
  }
];

export const HM_V2_POLICY = {
  id: 'hm-v2',
  version: 'hm-v2.1.0',

  /** H1 (dani i obim: H15). */
  input: {
    /** < 10 nedelja: trajno odbijanje (preporuka 10K). */
    weeksMin: 10,
    /** > 20 nedelja: počni kasnije. */
    weeksMax: 20,
    resultMaxAgeDays: 84,
    resultDistancesM: [5000, 10000, 21097.5, 42195] as readonly number[],
    vdotMin: 30,
    vdotMax: 80
  },

  /** H15: JEDINA tabela po broju dana trčanja. quality/easy = broj kvalitetnih i laganih dana izgradnje. */
  days: {
    3: {
      quality: 1,
      easy: 1,
      kmMin: 25,
      kmMax: 45,
      peakMaxKm: 55,
      longMaxShare: 0.45,
      weekMinKm: 12
    },
    4: {
      quality: 2,
      easy: 1,
      kmMin: 30,
      kmMax: 60,
      peakMaxKm: 70,
      longMaxShare: 0.4,
      weekMinKm: 16
    },
    5: {
      quality: 2,
      easy: 2,
      kmMin: 35,
      kmMax: 75,
      peakMaxKm: 85,
      longMaxShare: 0.32,
      weekMinKm: 20
    },
    6: {
      quality: 2,
      easy: 3,
      kmMin: 40,
      kmMax: 90,
      peakMaxKm: 100,
      longMaxShare: 0.3,
      weekMinKm: 24
    }
  },

  /** H2: udeli VDOT-a po zonama. */
  paces: {
    eFractionFast: 0.7,
    eFractionSlow: 0.62,
    tFraction: 0.88,
    iFraction: 0.975,
    rFraction: 1.05,
    raceDistanceM: 21097.5
  },

  /** H3: dozvoljen rast VDOT-a po nedelji plana. */
  goal: { realisticPerWeek: 0.1, ambitiousPerWeek: 0.2 },

  /** H4: specifično po broju nedelja izgradnje B (prvi red čiji maxBuild ≥ B). */
  phases: {
    specific: [
      { maxBuild: 9, weeks: 3 },
      { maxBuild: 13, weeks: 4 },
      { maxBuild: Infinity, weeks: 5 }
    ] as readonly { maxBuild: number; weeks: number }[],
    taperWeeks: 1,
    raceWeeks: 1
  },

  /** H5. */
  deload: {
    maxBuildRun: 3,
    exceptionRun: 4,
    firstAllowedWeek: 3,
    factor: 0.8,
    tShare: 0.6,
    tMinKm: 2.0,
    longFactor: 0.8
  },

  /** H6 (max nedelje: H15). */
  volume: {
    growth: 0.06,
    growthMinKm: 1.0,
    growthMaxKm: 4.0,
    peakFactor: 1.4,
    peakAddKm: 20
  },

  /** H7. */
  taper: {
    factor: 0.7,
    doseShare: 0.6,
    rpMin: { reps: 2, repM: 2000 } as Rep,
    tMinKm: 2.0,
    longFactor: 0.6
  },

  /** H8. */
  raceWeek: {
    /** Dana trčanja uključujući trku = min(broj dana, maxRunDays). */
    maxRunDays: 5,
    sharpener: { reps: 2, repM: 2000, recoverySec: 120 },
    sharpenerMinGapDays: 3,
    eveEasySec: 1200,
    eveStrides: { reps: 4, sec: 20 },
    eveMaxSec: 1800,
    otherEasySec: 2100,
    raceKm: 21.1,
    raceWarmupSec: 600,
    raceCooldownSec: 600
  },

  /** H9. */
  schedule: { defaultLongDay: 'sun' as const },

  /** H10: lestvice. T kontinuirano u km; ostale deonice. */
  ladders: {
    R: [
      { reps: 6, repM: 200 },
      { reps: 8, repM: 200 },
      { reps: 6, repM: 300 },
      { reps: 10, repM: 200 },
      { reps: 8, repM: 300 },
      { reps: 8, repM: 400 }
    ] as readonly Rep[],
    T_continuous: [2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 7.0] as readonly number[],
    T_cruise: [
      { reps: 2, repM: 1200 },
      { reps: 3, repM: 1000 },
      { reps: 2, repM: 1600 },
      { reps: 4, repM: 1000 },
      { reps: 3, repM: 1600 },
      { reps: 4, repM: 1500 },
      { reps: 4, repM: 1600 },
      { reps: 5, repM: 1600 },
      { reps: 3, repM: 3000 }
    ] as readonly Rep[],
    I: [
      { reps: 2, repM: 1000 },
      { reps: 3, repM: 800 },
      { reps: 3, repM: 1000 },
      { reps: 4, repM: 1000 },
      { reps: 4, repM: 1200 },
      { reps: 5, repM: 1000 },
      { reps: 5, repM: 1200 }
    ] as readonly Rep[],
    RP: [
      { reps: 2, repM: 2000 },
      { reps: 2, repM: 2500 },
      { reps: 2, repM: 3000 },
      { reps: 2, repM: 4000 },
      { reps: 3, repM: 3000 },
      { reps: 2, repM: 5000 },
      { reps: 3, repM: 4000 }
    ] as readonly Rep[]
  },

  /** H10: „ista doza druge strukture" (broj deonica i korak: HI1, kao 10K v2). */
  alternatives: {
    repsMin: 2,
    repsMax: 5,
    roundM: 100,
    roundFallbackM: 50,
    /** T deonice ≥ 1000 m. */
    tRepMinM: 1000,
    /** RP deonice ≥ 2000 m; RP kontinuirano do rpContinuousMaxKm. */
    rpRepMinM: 2000,
    rpContinuousMaxKm: 10,
    iRepsMax: 6,
    iRepMinM: 800,
    iRepMaxM: 1200,
    iPyramidM: [1200, 1000, 800] as readonly number[],
    /** Pouka 27 (HI5): korak piramide kad jednake deonice nemaju drugu strukturu. */
    pyramidStepM: 200,
    rRepM: [200, 300, 400] as readonly number[]
  },

  /** H11: jedan plafon po zoni, po treningu, udeo ciljnog obima nedelje. */
  caps: { R: 0.05, I: 0.08, T: 0.1, RP: 0.15 },

  /** H13 (udeo dugog: H15). longMaxKm: odluka organizatora HM-01 → 02 (≈ 1,15 × trka). */
  lengths: { longMaxSec: 9000, longMaxKm: 24, easyMinKm: 4.0, longWarnKm: 16 },

  /** Pouka 28 (HI7): dugi svake nedelje ≤ max(factor × L, L + addKm), L = najduži dugi prethodnih
      windowWeeks nedelja (u nedeljama 1…windowWeeks i skorašnji najduži trk, minKm–maxKm). */
  recentLong: {
    minKm: 5,
    maxKm: 42,
    factor: 1.1,
    addKm: 1.0,
    windowWeeks: 4,
    thresholdStepKm: 0.5
  },

  /** H12: početni nivo slota ≤ udeo plafona zone (H11). */
  startLevel: { capShare: 0.6 },

  /** H14. */
  workout: {
    /** WU/CD po pojasu trenutnog obima: poslednji pojas sa fromKm ≤ obim (0,1 km). */
    warmupCooldown: [
      { fromKm: 0, warmupSec: 900, cooldownSec: 600 },
      { fromKm: 40, warmupSec: 1200, cooldownSec: 900 },
      { fromKm: 60, warmupSec: 1500, cooldownSec: 900 }
    ] as readonly { fromKm: number; warmupSec: number; cooldownSec: number }[],
    iRecoveryMaxSec: 240,
    iRecoveryStepSec: 15,
    /** Oporavak po dužini deonice (gornja granica uključena; poslednji red za sve duže). */
    tCruiseRecovery: [
      { maxRepM: 1600, sec: 60 },
      { maxRepM: Infinity, sec: 90 }
    ] as readonly { maxRepM: number; sec: number }[],
    rpRecovery: [
      { maxRepM: 3000, sec: 90 },
      { maxRepM: Infinity, sec: 120 }
    ] as readonly { maxRepM: number; sec: number }[]
  },

  /** Tehnička tolerancija: planirano vs cilj (zaokruženje dana na 0,1 km). */
  tolerance: { plannedKm: 0.1 },

  DECISIONS
} as const;

export type HmV2Policy = typeof HM_V2_POLICY;

/** Podržani brojevi dana trčanja (H15). */
export type RunDaysCount = keyof HmV2Policy['days'];
export interface DayRule {
  readonly quality: 1 | 2;
  readonly easy: number;
  readonly kmMin: number;
  readonly kmMax: number;
  readonly peakMaxKm: number;
  readonly longMaxShare: number;
  readonly weekMinKm: number;
}

export const RUN_DAYS_COUNTS = Object.keys(HM_V2_POLICY.days)
  .map(Number)
  .sort((a, b) => a - b) as readonly RunDaysCount[];

/** H15: red tabele za broj dana trčanja; null za broj koji tabela nema. */
export function dayRule(count: number): DayRule | null {
  return (RUN_DAYS_COUNTS as readonly number[]).includes(count)
    ? HM_V2_POLICY.days[count as RunDaysCount]
    : null;
}
