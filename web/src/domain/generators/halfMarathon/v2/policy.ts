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
    rule: 'Opseg (segment 03): 3, 4, 5 ili 6 dana trčanja (početnik 4–5, H17); 10–20 celih nedelja do trke (početnik 12–20); trenutni obim po redu H15 (3 d 25–45, 4 d 30–60, 5 d 35–75, 6 d 40–90 km; početnik H17); rezultat 5 km, 10 km, polumaraton ili maraton ne stariji od 84 dana i VDOT 30–80 → tempo iz rezultata; bez pouzdanog rezultata (nema ga, stariji od 84 dana, VDOT < 30) plan po osećaju (H16). < 10 nedelja trajno odbijanje (preporuka 10K); > 20 nedelja „počni kasnije" (datum); obim van reda: preporuka brojeva dana čiji red podržava obim, a ispod najmanjeg reda (25 km) 10K ili izgradnja osnove; 1, 2 i 7 dana trajno; trčanje/hodanje trajno (H17); VDOT > 80 trajno.',
    place: 'input.ts (brojevi: input, days, beginner)',
    rationale:
      'Zadato u MASTER § 4 H1, H15 (02), H16 i H17 (03). Max nedelje reda (H15) ostaje granica vrha (H6). Odbijanje je strukturisano (kod + poruka sa preporukom), nikad degenerisan plan (pouka 6). Privremena odbijanja RESULT_REQUIRED i BEGINNER_NOT_SUPPORTED iz hm-v2.0/2.1 su ukinuta.'
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
    id: 'H16',
    rule: 'Plan po osećaju kad nema pouzdanog rezultata (nema ga, stariji od 84 dana, VDOT iz rezultata < 30): lagan tempo easyPaceSecPerKm obavezan (270–510 s/km; bez njega EASY_PACE_REQUIRED, van opsega EASY_PACE_OUT_OF_RANGE). E = lagan tempo ± 15 s (srednji E = lagan tempo; 150 min dugog po sporom kraju E). Procena VDOT-a = VDOT čiji je brži kraj E (eFractionFast 0,70) jednak laganom tempu, ograničena na 25–60, SAMO za orijentir T/I/R/RP i trajanje deonica i testa. Plan nosi paceBasis feel (plan sa rezultatom polja nema); svaki kvalitet (i oštrenje) nosi RPE: T 6–7, RP 6–7, I 8, R 8; bez prognoze polumaratona i ocene cilja do testa (predictedHmSec null, goal null, napomena) — RP po RPE. Test 5 km (plan po osećaju koji nije početnik): poslednja nedelja baze, na danu Q1 (3 dana: umesto jedinog kvaliteta); kad je ta nedelja rasterećenje — umesto kvaliteta rasterećenja (na njegovom danu, H5); WU/CD po H14 + 5 km kontrolisano maksimalno; računa se u obim nedelje, NE u dozu (bez plafona H11): progresija slota (H12) se posle testa nastavlja od stanja pre testa, a „glavna doza ne opada" preskače nedelju testa. Plan po osećaju ima tačno jedan test, plan sa rezultatom i početnik nijedan.',
    place:
      'input.ts (put); paces.ts feelPaces; policy.ts feel, test; periodize.ts testWeekOf; week.ts (test); workouts.ts (testWorkout, rpeOf); quality.ts advance; generate.ts; validate.ts (PACE_BASIS, PACES, RPE, TEST)',
    rationale:
      'Zadato u MASTER H16 (kao 10K v2 D26/D27, RP 6–7 umesto 7–8 — polumaratonski ritam je bliži pragu). Bez rezultata je lagan tempo jedini podatak o trkaču; izjednačavanje sa bržim krajem E daje niži VDOT nego srednji E — opreznija procena brzih zona. U opsegu 270–510 s/km procena je 58,6–26,1, pa granice 25/60 u mreži ne deluju (zaštita ulaza). Test na kraju baze zamenjuje najmanje specifičan kvalitet (R; kod 3 dana T kontinuirano) pre razvoja. Odstupanje (opreznije, H16 ispred H5, bez novog broja; HI11): u rasterećenju sa testom dugi ≤ 0,8 × poslednji — najduži koji ostavlja lagane ≥ 4 km (TEST_DELOAD_LONG); cilj rasterećenja se ne podiže (pouka 23).'
  },
  {
    id: 'H17',
    rule: 'Početnik (experience beginner; podrazumevano regular), JEDNA tabela beginner + planRule: 4–5 dana (3/6 → BEGINNER_DAYS, preporuka 4–5); 12–20 nedelja (10–11 → BEGINNER_SHORT); obim 4 d 20–40, 5 d 25–45 km (ispod → preporuka 10K plana; iznad → plan bez oznake početnika); udeo dugog, minimum i max nedelje iz reda H15; nedelje 1–2 uvod bez kvaliteta (dan kvaliteta lagan); zatim jedan kvalitet nedeljno (lestvica T kont. → T cruise → RP kao 3 dana, HI6), bez I i R (4 d: 1 Q + 2 lagana + dugi; 5 d: 1 Q + 3 lagana + dugi, lagani jednaki); lestvica T kontinuirano početnika [1,5; 2,0; …] i T kontinuirano kad prvi nivo lestvice faze ne staje u plafon (HI10); rast +5 % (min 1,0, max 2,0 km); vrh = min(start × 1,4; start + 15; max nedelje H15; kapacitet); dugi ≤ 135 min sporim E (i ≤ udeo, ≤ 24 km, kotrljajuća granica HI7); WU/CD uvek 15/10 min (prvi pojas H14); bez testa (i po osećaju); upozorenje LONG_RUN_SHORT kad je najduži dugi < 14 km. Rezultat ≤ 84 dana i VDOT ≥ 30 → tempo iz VDOT-a, inače po osećaju (H16) bez testa. Trčanje/hodanje (runWalk true) → RUN_WALK_NOT_SUPPORTED (preporuka 5K plan trčanja/hodanja), za sve.',
    place:
      'policy.ts beginner + planRule (jedina tabela); input.ts; schedule.ts (1 kvalitet); quality.ts (startLevel, buildLadder, pickBuild); week.ts (uvod); lengths.ts, volume.ts, workouts.ts (pravilo plana); validate.ts',
    rationale:
      'Zadato u MASTER H17 (kao 10K v2 D28/D29/D31/D32). Cilj početnika je završiti zdravo: smanjen intenzitet (jedan kvalitet, bez I/R, uvod bez kvaliteta) i rast (5 %, max 2 km; vrh 1,4× / +15 km; dugi 135 min). Test 5 km bi kod malog obima bio ≈ trećina nedelje (pouka 13); rezultat trke kasnije koristi adaptacija (04). Najduži dugi < 14 km je kratak i za početnika (upozorenje, preporuka više dana ili obima).'
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
  },
  {
    id: 'HI10',
    rule: 'Tumačenje H17 (kao 10K v2 D28/D31, bez novog broja osim 1,5 km iz H17): početni nivo početnika = prvi nivo lestvice (H12 „≤ 60 % plafona" ne važi; T kontinuirano 1,5 km). Kad prvi nivo lestvice faze (T kont. / T cruise / RP) ne staje u plafon H11 cilja nedelje, kvalitet je T kontinuirano: najviši nivo lestvice početnika po H12 (≤ 1 nivo nedeljno, ista doza druge strukture, inače ponavljanje uz napomenu); prelaz na lestvicu faze čim njen prvi nivo stane (T cruise ≥ poslednje T, RP ≥ max(prvi nivo, poslednje T)); T kontinuirano posle T cruise ≥ poslednje T (doza ne pada). Bez kvaliteta samo kad ni 1,5 km ne staje (BUILD_NO_QUALITY). Rasterećenje početnika: T ≈ 60 % poslednje T doze (nivo naniže), min 1,5 km (H5 min 2,0 km važi za redovan plan). Taper početnika: RP ≈ 60 % poslednje RP doze (min 2 × 2000 m, H7); RP ne staje → T kontinuirano ≈ 60 % poslednje T doze (min 1,5 km); bez kvaliteta samo kad ni to ne staje (druga pretraga). Baza bez platoa (H12): doza bez druge strukture (T 1,5 km — deonice ≥ 1000 m) sme da se ponovi kad sledeći nivo ne staje (napomena).',
    place:
      'policy.ts beginner.tFirstKm; workouts.ts ladderLevels; quality.ts (startLevel, buildLadder, pickSlot, carries, deloadDose, beginnerTaperT); week.ts (napomene); validate.ts (PHASE_QUALITY, BUILD_NO_QUALITY, BASE_PLATEAU, DELOAD_CONTENT, TAPER_QUALITY, START_LEVEL)',
    rationale:
      'Opreznija opcija gde H17 ne kaže (start, rasterećenje, taper početnika); isto rešenje kao 10K v2 03b (D31), gde je bez T 1,5 km 3720 nedelja izgradnje početnika ostalo bez kvaliteta. ≈ 10 min praga (1,5 km) je uobičajen početni tempo trening. Brojke mreže početnika: docs/hm-v2/reports/SEGMENT-03-IMPLEMENTATION.md.'
  },
  {
    id: 'HI14',
    rule: 'Pouka 33 (MASTER § 2) — odluka organizatora posle zaustavljanja HM-03 (P1, A: važi za sve planove; isto kao MAR-03 S2, 10K A9/D27): rasterećenje (H5) koje nije izvodljivo zbog minimuma laganog (lagani < 4 km uz dugi 0,8 × poslednjeg) → dugi se skraćuje na najduži koji ostavlja lagane ≥ 4 km uz dugi ≥ lagan; cilj nedelje ostaje (samo naniže, bez cilja naviše — pouka 23); kvalitet ostaje, a otpada samo kad ni sa skraćenim dugim lagani ne ostaju ≥ 4 km; napomena „Dugi skraćen na x km da lagani ostanu ≥ 4 km (rasterećenje, najmanji obim)" + upozorenje DELOAD_LONG_SHORTENED (bez kvaliteta: DELOAD_NO_QUALITY). Kad je standardna konstrukcija izvodljiva, ništa se ne menja. Jedno mesto: lengths.ts deloadLengths (dužine) i deloadEasyShort (uslov za ispuštanje kvaliteta) u konstrukciji nedelje rasterećenja (week.ts); validator čita iste funkcije.',
    place:
      'lengths.ts deloadLengths, deloadEasyShort; week.ts buildWeek (rasterećenje); validate.ts (DELOAD_LONG, DELOAD_CONTENT)',
    rationale:
      'Sudar H5 × H13 × H17 (SEGMENT-03-STOP.md): početnik 4 d 20 km / 5 d 25 km (i 4 d 25 km brzi) — 426 / 1890 planova odbijeno u prvom rasterećenju. Kraći dugi u nedelji rasterećenja je opreznija opcija od podizanja cilja (P4, krši HI2) ili novog minimuma obima (P2). Mere posle odluke: docs/hm-v2/reports/SEGMENT-03-IMPLEMENTATION.md (raspodela dugi / poslednji ne-rasteretni dugi, rasterećenja bez kvaliteta). Skraćivanje se primenjuje samo pri minimumu laganog: kad rasterećenje ne staje jer bi lagani bio duži od dugog (3 d spor trkač), ostaje pretraga cilja naniže (H6). Planovi sa rezultatom: 169 644 ulaza, 6 promenjenih (3 d, 40–45 km, VDOT 70, skorašnji najduži 5 km — samo prva rasteretna nedelja: cilj po pravilu umesto spuštenog, kvalitet umesto bez kvaliteta, dugi skraćen; spisak segment03.regression-exceptions.json).'
  },
  {
    id: 'HI11',
    rule: 'Tumačenja H16 (bez novog broja): (a) u rasterećenju test stoji na danu kvaliteta rasterećenja (T slot Q2; 3 dana Q1); (b) dugi rasterećenja sa testom ≤ 0,8 × poslednji ne-rasteretni — kad lagani ne bi bili ≥ 4 km, najduži koji ih ostavlja ≥ 4 km i ≤ dugi (ista funkcija kao HI14; upozorenje TEST_DELOAD_LONG); (f) odluka organizatora HM-03: dan testa se računa kao kvalitetni dan za upozorenje LONG_SHORTER_THAN_QUALITY (pouka 14, HI3), plan se ne menja; cilj rasterećenja sa testom se ne podiže (pouka 23: naviše bi smelo samo ako nedelja zaista ima test — ovde ga ima, ali podizanje nije potrebno: mreža 03 0 odbijanja); (c) prognoza polumaratona iz procene VDOT-a služi samo za trajanje segmenta trke (procena); (d) test nema RPE broj („kontrolisano maksimalno"); (e) trajanje testa = procena vremena 5 km iz procene VDOT-a.',
    place:
      'week.ts (deload sa testom); lengths.ts deloadLengths; workouts.ts testWorkout; validate.ts (TEST, DELOAD_LONG)',
    rationale:
      'Isto kao 10K v2 D27 tumačenja; test ne sme da „pojede" nedelju (pouka 13): lagani ≥ 4 km, dugi ≥ lagan i u nedelji testa.'
  },
  {
    id: 'HI12',
    rule: 'Odluke organizatora o otvorenim pitanjima HM-02 i HM-03 (bez promene koda): HM-03 — početnik 5 d najduži dugi < 14 km samo upozorenje (H17); HI10 potvrđen. HM-02 — (a) 594 plana koje kotrljajuće pravilo pouke 28 menja bez ulaza recentLongRunKm — prihvaćeno; (b) 3 dana / 25 km: taper i rasterećenje bez kvaliteta (HI2 odstupanje) — prihvaćeno (mali obim); (c) 6 dana mali obim + brz trkač: kvalitetni dan duži od dugog (132 plana) — upozorenje LONG_SHORTER_THAN_QUALITY (pouka 14) je dovoljno.',
    place:
      'lengths.ts rollingLongCap10 (a); week.ts relax (b); validate.ts LONG_SHORTER_THAN_QUALITY (c)',
    rationale: 'Prompt HM-03, tačka 3.'
  },
  {
    id: 'HI15',
    rule: 'Pouka 32 (MASTER § 2; HM-04 korak A, hm-v2.2.1) — dugi ostaje najduži trening nedelje: plafon zone (R, I, T kont., T cruise, RP) je jedna funkcija sa dva člana — H11 udeo i najveća doza za koju dan kvaliteta (WU + rad + oporavci + CD; sporim krajem tempa zone gde postoji opseg: džog oporavka zadat metrima sporim E) traje ≤ dugi iste nedelje (dugi nedelje sa tim danom). Važi u izgradnji, rasterećenju i taperu. H11 odlučuje izvodljivost kao pre (na dozi po pravilu); drugi član spušta dozu po lestvici na najviši nivo koji staje u oba člana — izuzetak od „doza ne opada" (pouke 3 i 12: pad doze kao kapacitet; izgradnja: korak drop, napomena „pouka 32, plafon zone", upozorenje DOSE_DROPPED; rasterećenje i taper: napomena). Najniži nivo zone (izgradnja: prvi nivo lestvice; rasterećenje i taper: najmanja doza H5/H7, početnik 1,5 km) uvek sme — njegov dan je izuzet od drugog člana (ne odbijanje, ne promena zone), upozorenje LONG_SHORTER_THAN_QUALITY po pouci 14 u izgradnji i rasterećenju (taper bez upozorenja: dugi ≤ 0,6 × najduži i RP ≥ 2 × 2000 m su oba H7, preporuka manje dana ne menja taj odnos). Dva dana kvaliteta: Q1 se bira uz Q2 najniže doze lestvice faze (struktura sa najviše km), Q2 uz izabran Q1 — oba ≤ dugi; taper: RP uz T na najmanjoj dozi, pa T uz izabran RP. Druga struktura iste doze koja bi bila duža od dugog se ne bira (bez druge → ponavljanje uz napomenu). Kad nedelja sa danom nema izvodljive dužine, član ne poredi (izvodljivost odlučuje pretraga cilja). Dan testa (doza fiksna, H16) je kvalitetni dan: u rasterećenju sa testom dugi ide naviše do trajanja dana testa u granicama udela, vremena, 24 km i pouke 28 i laganih ≥ 4 km (deloadLengths, napomena „podignut"); gde nije izvodljivo — upozorenje po pouci 14. Izuzetak nedelja 1 × pouka 9: drugi član menja samo dozu, nikad cilj nedelje, pa sudara nema.',
    place:
      'quality.ts pickSlot, fitsDay, reducedStructure, deloadDose, taperDoses, beginnerTaperT (dva člana); week.ts buildDayLimit, deloadDayLimit, taperDayLimit (drugi član, isti predikat čita validator); workouts.ts qualityDaySec; lengths.ts deloadLengths (minLong10), longFor10; validate.ts QUALITY_OVER_LONG, DOSE_DROP, DOSE_STALL, SLOT_REPEAT, BASE_PLATEAU, DELOAD_*, TAPER_*, LONG_SHORTER_THAN_QUALITY',
    rationale:
      'Prompt HM-04, korak A (pouka 32, MAR-03, M13a). Merenje 5e09a02 → hm-v2.2.1 (docs/hm-v2/reports/SEGMENT-03b-IMPLEMENTATION.md): menjaju se tačno planovi koji su imali dan kvaliteta ili testa duži od dugog (mreža 02 1932 / 16 896, r 2518 / 10 944, gusta ned 1 21 102 / 141 804, po osećaju 291 / 6336, početnik 177 / 1890), nijedan drugi; 0 novih odbijanja; posle su duži od dugog samo najniži nivo zone i test. Q1 ispred Q2: jedan redosled bez petlje; konzervativna pretpostavka za Q2 garantuje da nijedan Q2 najniže doze ne obara Q1. Dugi rasterećenja sa testom naviše: u mreži 03 nijedan slučaj nije izvodljiv (dugi već skraćen HI14 ili na udelu), upozorenje ostaje.'
  },
  {
    id: 'HI13',
    rule: 'Pouka 31 (struktura uvoda): nedelja uvoda početnika (1–2) nema kvaliteta ni kad je rasteretna (prinudno rasterećenje u adaptaciji, segment 04): obim rasterećenja (H5), sadržaj uvoda — dan T slota je lagan, dugi 0,8 × poslednji. Jedno mesto: week.ts (intro ispred rasterećenja); validator: nedelja uvoda bez kvaliteta.',
    place: 'week.ts buildWeek; validate.ts (INTRO)',
    rationale:
      'Pouka 31 (10K 06d). U generatoru rasterećenje ne pada u nedelje 1–2 (H5), pa se pravilo u planu bez adaptacije ne javlja; struktura je pripremljena za segment 04 i proverena testom nedelje.'
  },
  /* ---------- Segment 04 (hm-v2.3.0): adaptacija (H18 = 10K v2 A1–A17 uz pouke 18, 22–25, 28–33). Heuristike
     zadate za segment, bez trenerske provere. ---------- */
  {
    id: 'A1',
    rule: 'Rezultat (test plana, test 5 km ili trka 5/10 km, polumaraton, maraton) ≤ 84 dana i noviji od rezultata u upotrebi → VDOT od sledeće nedelje (prva puna nedelja posle asOf); plan po osećaju ostaje po osećaju do nedelje rezultata, od nje paceBasis result (RPE samo u nedeljama po osećaju) (pouke 16, 17); struktura dana uzima tempo i osnovu NEDELJE; pravilo cilja obima (H6) se ne menja zbog tempa; doza se nastavlja; ocena cilja (H3, nedelje od rezultata do trke) i prognoza iz novog VDOT-a. VDOT van 30–80 → RESULT_IGNORED; nema sledeće nedelje → ne primenjuje se.',
    place:
      'assess.ts (odluka); steps.ts pacesAt/basisAt; generate.ts construct; validate.ts (PACES, PACE_BASIS, RPE po nedelji)',
    rationale:
      'Kao 10K v2 A1 (H18). Tumačenje: kapacitet je i dalje stvarna konstrukcija nedelje sa tempom te nedelje (H6).'
  },
  {
    id: 'A2',
    rule: 'Manjak izvršenja: potpuno pokriven 7-dnevni prozor do asOf (A10), izvršeno < 60 % planiranog → cilj sledeće nedelje (izgradnja) = min(prethodni cilj izgradnje, max(izvršeno, 0,8 × cilj te nedelje)), ne ispod minimuma nedelje (A9); reduced = true (pouka 22); dalje povratni rast (A8).',
    place: 'assess.ts (adapt.underShare, underFloorShare, windowDays)',
    rationale: 'Kao 10K v2 A2 (H18); heuristika zadata segmentom, bez trenerske provere.'
  },
  {
    id: 'A3',
    rule: 'Pauza (uzastopni poznati dani bez trčanja do asOf u potpunoj pokrivenosti, ili eksplicitna pauza): 7–13 dana → 80 % obima 7 dana pre pauze, prva nedelja 1 kvalitet; 14–27 → 70 %, prva nedelja bez kvaliteta, druga 1 kvalitet; ≥ 28 → min(obim 14 dana pre pauze / 2, 50 % obima 7 dana pre), nov start (rePeriodize preostale izgradnje po H4/H5; vrh od novog starta; progresija doze iznova); H18: nov start i < 10 nedelja do trke → cilj „orijentir". Cilj ≤ cilj sledeće nedelje u planu; ostatak tekuće nedelje dobija ograničenja i (izgradnja) cilj pauze; reduced = true (pouka 22).',
    place:
      'assess.ts (adapt.pause, restartFullPrepWeeks); periodize.ts rePeriodize; steps.ts framesFor; volume.ts adaptNominal10',
    rationale:
      'Kao 10K v2 A3 (H18; orijentir < 10 nedelja). Odstupanje kao 10K: kad za preostalu izgradnju nema rasporeda po H5, faze ostaju (nov start samo obima i doze).'
  },
  {
    id: 'A4',
    rule: 'Bol ≥ 4 u poslednja 3 dana → 7 dana bez kvaliteta i ubrzanja, dugi ≤ 60 min (sporim E), lagani × 0,7 (≥ 4 km, H13; ≤ dugi); bol ≥ 7 → najpre 3 dana odmora, pa isto; poruka o stručnom pregledu; nedelja sa danom bola/odmora ima najviše 1 kvalitet doze rasterećenja. Pouka 18: sidro povratka r = nedelja koja sadrži asOf + 1 (isti bol daje isti plan bez obzira na dan u nedelji); cilj nedelje r ostaje (planirano ≤ cilj, upozorenje PLANNED_BELOW_TARGET_LIMITS, pouka 25); osnova povratka = min(round(0,7 × nivo pre bola), cilj nedelje r) — jedna funkcija (volume.returnBase10) za konstruktor, validator i poruku; od r + 1 povratni rast A8, progresija doze kreće ispočetka od r + 1. Povratak samo kad je r izgradnja.',
    place:
      'assess.ts; steps.ts limitsOf; lengths.ts painLong10/limitedEasy10; week.ts limitDays; volume.ts returnAnchor/returnBase10/leaveWeek; adapt.ts (poruka)',
    rationale: 'Kao 10K v2 A4 + A16 (H18: lagani ≥ 4 km).'
  },
  {
    id: 'A5',
    rule: 'Umor: ≥ 2 laganih treninga (lagan, dugi ili zapis van plana) sa RPE ≥ 7 u 7 dana → prinudno rasterećenje u nedelji pouke 36 (assess.fatigueWeek: prva nedelja koja počinje posle poslednjeg zapisa umora; asOf u njoj → njen ostatak) (samo izgradnja; ne ako je već rasteretna, taper ili trka); redovno rasterećenje odmah posle prinudnog se ukida; prinudno se nikad ne ukida. Pouka 31: prinudno rasterećenje u uvodu početnika — obim rasterećenja (0,8 ×), sadržaj uvoda (bez kvaliteta); uvod ima prednost.',
    place:
      'assess.ts fatigueWeek, korak.deloadWeek (samo kad ≠ fromWeek); steps.ts deloadWeekOf (framesFor, newLimits); week.ts (uvod ispred rasterećenja, HI13); validate.ts (H5 izuzetak prinudnog, deloadWeekOf)',
    rationale: 'Kao 10K v2 A5 (dopuna 06d, pouka 31).'
  },
  {
    id: 'A6',
    rule: 'Višak: > 115 % planiranog u dva uzastopna potpuno pokrivena 7-dnevna prozora → sledeća nedelja bez rasta (cilj = min(cilj, prethodni cilj izgradnje)); reduced = false; ne kad sledeća nije izgradnja ili je rasteretna.',
    place: 'assess.ts (adapt.overShare)',
    rationale: 'Kao 10K v2 A6 (H18); heuristika zadata segmentom, bez trenerske provere.'
  },
  {
    id: 'A7',
    rule: 'Prioritet: bol uvek (po datumima); za obim samo najviše aktivno od pauza > umor > izvršenje; tempo (A1) uvek; svi aktivni uslovi u reasons (applied true/false).',
    place: 'assess.ts',
    rationale: 'Kao 10K v2 A7 (pouka 7).'
  },
  {
    id: 'A8',
    rule: 'Povratni rast: posle smanjenja (pauza, bol, manjak) cilj raste +10 %/ned (min 1,0 km; nikad sporije od H6) do nivoa pre smanjenja (pouka 7) u svim fazama osim tapera i trkačke nedelje (i iznad granice novog starta); iznad nivoa H6. Nivo = cilj poslednje ne-rasteretne nedelje izgradnje završene pre prvog dana događaja (bez nje — start); više koraka → najveći. Rasterećenje u povratku 0,8 × poslednja ne-rasteretna (posle sidra bola 0,8 × osnova). U povratku izvodljiv cilj samo naniže. H18: taper posle smanjenja = 0,7 × najveći cilj izgradnje posle poslednjeg smanjenja (nikad skok naviše); korak čija je sledeća nedelja taper: min(0,7 × vrh, cilj koraka).',
    place:
      'volume.ts (adaptNominal10, nextBuild10, returnBase10, enterWeek, leaveWeek) — konstruktor i validator',
    rationale: 'Kao 10K v2 A8 (H18: faktor tapera 0,7 = H7).'
  },
  {
    id: 'A9',
    rule: 'Donja granica adaptiranog cilja = minimum nedelje broja dana (H15 weekMinKm; početnik H17 isto). Kvalitet koji ne staje → 1 kvalitet doze rasterećenja → bez kvaliteta (ista pretraga cilja; cilj adaptacije se zadržava — najpre svi prolazi na njemu, pa niži izvodljiv cilj); test 5 km koji u nedelji posle smanjenja ne staje (dugi < 5 km) otpada; oštrenje otpada kad trkačka nedelja sa njim ne bi bila ≤ taper. Pouka 23: rasterećenje sa testom cilj iznad pravila samo ako sastavljena nedelja ima test. Pouka 25: planirano ispod cilja zbog dana bola/odmora je upozorenje.',
    place:
      'volume.ts adaptNominal10; generate.ts construct (prolazi); week.ts; validate.ts (ONE_QUALITY, TARGET_FLOOR)',
    rationale: 'Kao 10K v2 A9 + 06d K1 (pouka 23).'
  },
  {
    id: 'A10',
    rule: 'Pokrivenost: dan bez zapisa je poznat (bez trčanja) SAMO u facts.coverage sa complete = true; A2, A3 (iz zapisa) i A6 samo na pokrivenom delu; bol, umor, rezultat i eksplicitna pauza uvek (nepotpun zapis ≠ pauza). Eksplicitna pauza važi ako je završena u poslednjih 7 dana i posle prethodne adaptacije. Trčanje = completed i (km > 0 ili durationSec > 0).',
    place: 'assess.ts (coveredDays, knownKm)',
    rationale: 'Kao 10K v2 A10 (pouka 7).'
  },
  {
    id: 'A11',
    rule: 'Zaštita: dani ≤ asOf, urađeni (po dayId ili datumu) i zaključani ostaju bajt-isti; završna zaštita samo proverava (ADAPT_PROTECTION); mešovite nedelje → adaptation.mixedWeeks; asOf ≥ dan trke ili pre prethodne adaptacije → ADAPT_AS_OF_INVALID. Pouka 29: prošlost = upisani dani (written.ts, jedino spajanje) — konstruktor iz njih vodi najduži dugi (H7, pouka 28), poslednji dugi (H5), stanje doze, poslednju izgradnju i taper za trkačku nedelju; validacija u construct vidi isti upisani plan.',
    place: 'adapt.ts; written.ts; generate.ts construct (prior)',
    rationale: 'Kao 10K v2 A11 + 06d (pouka 29).'
  },
  {
    id: 'A12',
    rule: 'Datum trke, taper i trkačka nedelja se ne pomeraju; rePeriodize menja samo preostalu izgradnju istim pravilima H4/H5.',
    place: 'periodize.ts rePeriodize',
    rationale: 'Kao 10K v2 A12; heuristika zadata segmentom, bez trenerske provere.'
  },
  {
    id: 'A13',
    rule: 'Test 5 km (plan po osećaju): nedelja testa posle asOf koja je blokirana (ograničenje kvaliteta, prinudno rasterećenje, van izgradnje) → test na prvu sledeću ne-rasteretnu nedelju izgradnje bez ograničenja dok je plan po osećaju; nema je → bez testa. Posle primljenog rezultata testa nema. Početnik nema test (H17).',
    place: 'steps.ts framesFor',
    rationale: 'Kao 10K v2 A13; heuristika zadata segmentom, bez trenerske provere.'
  },
  {
    id: 'A14',
    rule: 'Lančana adaptacija: koraci se čuvaju u plan.adaptation.steps i ponavljaju redom; isti ulaz + isti koraci → isti plan (asOf je ulaz). Pouka 16: bez koraka adaptacije plan je bajt-isti kao generator.',
    place: 'adapt.ts, generate.ts construct',
    rationale: 'Kao 10K v2 A14; heuristika zadata segmentom, bez trenerske provere.'
  },
  {
    id: 'A15',
    rule: 'Plan starije verzije hm-v2: buduće nedelje po tekućim pravilima; prošlost zaštićena (mixedWeeks); plan druge politike ili neispravan → ADAPT_PLAN_INVALID. Pouka 19 (promena cilja): svi budući treninzi zaključani → treninzi bajt-isti, menja se samo ocena.',
    place: 'adapt.ts checkPlan',
    rationale: 'Kao 10K v2 A15; heuristika zadata segmentom, bez trenerske provere.'
  },
  {
    id: 'A17',
    rule: 'Pouka 22: redovno rasterećenje odmah posle nedelje smanjenja otpada — nedelja smanjenja = (a) fromWeek koraka čiji je cilj smanjenje (reduced: true; višak false), (b) sidro bola r; (c) nov start ne ulazi. Prinudno rasterećenje (umor) se nikad ne ukida; od ukinute nedelje najviše 5 uzastopnih nedelja izgradnje (H5 izuzetak 4 + 1), inače ostaje. Jedno mesto (steps.framesFor, izlaz dropped), validator čita isti podatak.',
    place:
      'steps.ts targetReducedWeek, reducedWeeks, framesFor; validate.ts (H5); adapt.ts (poruka)',
    rationale: 'Kao 10K v2 A17 (pouka 22).'
  },
  {
    id: 'A18',
    rule: 'Pouka 30: trkačka nedelja (bez trke) ≤ planirano tapera i kad taper ima dane odmora/bola — višak laganih dana trkačke nedelje postaje odmor (prvo dani bola, pa najraniji lagani); dan pred trku i trka ostaju (week.raceWeekRest, validator čita isti podatak); tako skraćena trkačka nedelja sme ispod minimuma (upozorenje RACE_WEEK_SHORT). Pouka 20: traka „Plan treba prilagoditi" samo za NOVO ograničenje — domen daje steps.newLimits (ograničenja poslednjeg koraka kojih nije bilo pre njega). Pouke 28 i 32 važe i u adaptiranom planu (kotrljajuće pravilo dugog iz upisanih dana; dan kvaliteta ≤ dugi i u nedeljama bola/povratka); pouka 33 (deloadLengths) isto. Rasterećenje u nedelji posle smanjenja obima: dugi ≥ 4 km (kao 10K deloadLengths adapted) — posle povratka sa dugim 4 km 0,8 × bi bio ispod minimuma laganog i nedelja bi bila neizvodljiva; generator bez koraka nepromenjen. Pouka 34: umor sa asOf pre starta — nedelja 1 prinudno rasterećenje 0,8 × planirana nedelja 1 (početnik: sadržaj uvoda, pouka 31), referenca (poslednja izgradnja, poslednji dugi, doza) = nedelja 1 generatora bez činjenica zapisana u koraku (preStart), nedelja 2 = cilj planirane nedelje 1 bez rasta.',
    place:
      'week.ts raceWeekRest, raceWeek; steps.ts newLimits, initialState; generate.ts (longs iz upisanih dana); lengths.ts deloadLong10 (adapted); assess.ts preStart; volume.ts adaptNominal10',
    rationale: 'Kao 10K v2 06d D23 (pouka 30) i MASTER pouke 20, 28, 32, 33.'
  },
  {
    id: 'F4a-N5',
    rule: 'Pouka 35 (hm-v2.4.0): u nedelji izgradnje (baza, razvoj, specifična faza) sa dva dana kvaliteta (Q1 ili test + Q2), kad bi neki dan kvaliteta (i najniži nivo, izuzet od drugog člana pouke 32) trajao duže od dugog iste nedelje, drugi dan kvaliteta postaje lagan (napomena „drugi dan kvaliteta je lagan (pouka 35)"), prvi ostaje sa dozom izabranom kao u nedelji sa dva dana; oslobođen obim raspoređuje vlasnik dužina (dugi raste, buildLengths); stanje Q2 se ne menja. Kad nedelja sa jednim kvalitetom nije izvodljiva (dugi na granici pouke 28 — lagani bi bili duži od dugog, pouka 2) ostaju dva kvaliteta uz upozorenje LONG_SHORTER_THAN_QUALITY (pouka 14); cilj nedelje se ne menja. Taper i trkačka nedelja su izuzeti (H7: dugi ≤ 0,6 × najduži namerno kratak, intenzitet se zadržava — HI15, N12); rasterećenje ima jedan kvalitet (H5). Generator i adaptacija (isti konstruktor, prolazi rule/relax).',
    place:
      'week.ts secondQualityEasy (jedino mesto: broj dana kvaliteta nedelje izgradnje i izvodljivost), buildWeek; validate.ts SECOND_QUALITY (ista funkcija; kandidat Q2 iz quality.pickSlot), ROLES; gridInvariants.ts POUKA35',
    rationale:
      'Odluka organizatora Faza 4a N5 (ODLUKE-4a.md): dugi od 4–6 km uz dva dana kvaliteta od 45–60 min nema svrhu za polumaraton (trener bi skratio broj kvalitetnih dana). Izmereno (docs/hm-v2/artifacts/segment-07/regress.ts, compare.ts, prema f4b257d): generator 165/25 122 planova menja se (svi sa takvom nedeljom), 0 odbijanja, pouka 9 0; nedelja izgradnje sa 2 kvaliteta i danom dužim od dugog posle izmene 0 van izuzetka izvodljivosti. Izuzetak izvodljivosti (odluka organizatora, opcija i): mreža pouke 28 597/10 944 planova (d4 r5–8 126, r9–12 15; d5 177/27; d6 219/33; r > 12: 0); (ii) niži cilj odbijeno — menja ciljeve, pouku 9 i vrh; (iii) dugi preko granice — krši pouku 28. Izuzetak tapera (odluka organizatora, B): 1371/25 122 planova generatora ima taper sa RP danom (najniži nivo 2 × 2000 m) dužim od dugog — medijana 6 min, max 29 min; T bi otpao u svih 1371, a RP bi ostao duži u 669.'
  },
  {
    id: 'F4a-N6',
    rule: 'RP nikad ispod najnižeg nivoa lestvice (2 × 2000 m, H10) — kao maraton MP (MAR-03): prelaz sa niže T doze koji ne staje u najniži nivo nije izvodljiv pri tom cilju (adaptacija: A9 — jedan kvalitet doze rasterećenja ili bez kvaliteta), umesto „RP 2,0 km kontinuirano".',
    place: 'quality.ts floorM, pickSlot; validate.ts RP_FLOOR (ista funkcija)',
    rationale:
      'Faza 4a N6: 31 dan RP 2,0/2,4 km posle novog starta (pauza 35, 3 dana). Izmereno prema f4b257d: generator mreže pouke 28 13/10 944 planova sa RP < 4000 m (3 dana, mali r) → 0, bez odbijanja; ciljana 4a pretraga i rana adaptacija → 0 RP < 4000 m, 0 odbijanja.'
  },
  {
    id: 'F4a-N7',
    rule: 'Dopuna pouke 34 (oblik maratona): posle umora pre starta progresija doze kreće iznova u nedelji 2 (steps.restartWeeks) — doza nedelje 2 = doza planirane nedelje 1 (ponavljanje, bez rasta); stanje reference (nedelja 1 generatora) čita samo prinudno rasterećenje nedelje 1. Dugi reference ulazi u L pouke 28 kao nedelja 0 (steps.jumpRecentKm: max(skorašnji najduži, dugi reference)); napomena i pouka 9 nedelje 1 čitaju samo ulaz.',
    place:
      'steps.ts restartWeeks, preStartOf, jumpRecentKm, initialState; generate.ts; validate.ts (lanac doze, LONG_ROLLING); adaptInvariants.ts (L sa dugim reference)',
    rationale:
      'Faza 4a N7 i N10.3: HM je uzimao dozu planirane nedelje 2 (advance(ref)) i nije računao dugi reference, pa je dugi nedelje 2 bio ograničen skraćenim dugim rasterećenja nedelje 1. Menjaju se samo tokovi umora pre starta (regresija po klasi u izveštaju HM-07).'
  },
  {
    id: 'F4a-N9',
    rule: 'Pouka 24 — jedna definicija po veličini: najduži dugi (lengths.longestLong10: taper u konstruktoru i validatoru, LONG_RUN_SHORT), dugi po nedeljama za L pouke 28 (lengths.longsOf10), referenca umora pre starta (steps.preStartOf: initialState, volume.adaptVolume), stanje doze (quality.advance i u validatoru). Refaktor bajt-isti osim LONG_RUN_SHORT: najduži dugi preko SVIH nedelja plana (i mešovitih — upisani dani su plan), ne samo proverenih.',
    place: 'lengths.ts, steps.ts, volume.ts, quality.ts; generate.ts, validate.ts',
    rationale:
      'Faza 4a N9: LONG_RUN_SHORT lažno 5/2928 tokova (npr. d4-11w-35km-v50-B-sat, bol 5 sreda ned 4: najduži 16,6 ≥ 16) → 0. Izmereno: generator bez ikakve promene van klase pouke 35.'
  },
  {
    id: 'F4a-N10',
    rule: 'N10.1 (pouka 32, kao maraton): ponavljanje doze iste strukture u uzastopnim nedeljama izgradnje (korak repeat + napomena) daje upozorenje IDENTICAL_WEEKS kad za svaki slot ni druga struktura iste doze ni sledeći nivo ne staju u plafon zone (oba člana, ista funkcija kao konstruktor); inače kao pre. N10.2: RECENT_LONG_TOO_SHORT ostaje samo u generatoru (pravilo maratona: samo kad je uzrok ulaz) — u adaptaciji se ne javlja (construct ga vraća samo bez koraka; 4a rana adaptacija 114 012 tokova i ciljana 16 275: 0 odbijanja). N10.6: piramida (pouka 27) — svesna razlika prema maratonu: HM druga struktura I/T/RP su jednake deonice ili kontinuirano (H10), piramida isti broj deonica (stepPyramid); maraton I 2000 m nema piramidu ≥ 3 deonice. N10.7: trajna rana mreža pre starta — planovi rane mreže × start − 1/− 3/− 6 × svih 17 scenarija mreže 04 (+ lanac), pun nivo.',
    place:
      'validate.ts IDENTICAL_WEEKS; generate.ts recentTooShort (samo generator); workouts.ts stepPyramid; preStartGrid.node.test.ts',
    rationale:
      'Faza 4a N10 (ODLUKE-4a.md): usklađivanje HM ↔ maraton ili svesna razlika sa obrazloženjem. IDENTICAL_WEEKS upozorenje: generator 0 planova, adaptacija (npr. početnik 4 d 20 km, manjak 50 % kraj ned 1: T ponovljen).'
  },
  {
    id: 'F4a-N11',
    rule: 'Upozorenja jednom po planu (jedan vlasnik — domen; aplikacija samo prikazuje): WEEK_FITTED zbir („Izvodljiv cilj umesto cilja po pravilu: N ned. spušteno za najviše X km …, nedelje …"), CAPACITY_LIMITED jedno upozorenje sa vrhom (napomena plana o kapacitetu uklonjena — bila je drugi red istog sadržaja), DELOAD_LONG_SHORTENED jedno upozorenje sa nedeljama. Napomena nedelje „Cilj po pravilu … nije izvodljiv u konstrukciji nedelje" je tehnička (oznaka za VOLUME_RULE): ostaje u planu, korisniku je ne daje volume.userWeekNotes.',
    place:
      'validate.ts (WEEK_FITTED, CAPACITY_LIMITED, DELOAD_LONG_SHORTENED); volume.ts fittedNote, userWeekNotes; app/plan.ts (focus)',
    rationale:
      'Faza 4a N11: WEEK_FITTED 6,4–6,9 poruka po planu (do 21 reda „Na šta da paziš"); merenje pre/posle u izveštaju HM-07.'
  },
  {
    id: 'F4a-N12',
    rule: 'Pouka 36 (precizno od hm-v2.4.1, HM-07b): umor je vezan za ZAPISE — prinudno rasterećenje je nedelja POSLE nedelje poslednjeg zapisa umora (prva nedelja koja počinje posle zapisa; assess.fatigueWeek, jedino mesto); kad asOf već pada u nju, rasterećenje važi za njen ostatak (prošli dani upisani, pouka 29); kad je ta nedelja već rasterećenje (i od istog umora — isti zapisi ponovo), novo se ne pravi. Korak nosi deloadWeek kad ≠ fromWeek; okviri, traka (newLimits) i validator čitaju steps.deloadWeekOf. Pouka 20: traka (adaptBanner) je JEDNO pravilo u domenu (oblik maratona posle MAR-06), aplikacija je samo zove.',
    place:
      'assess.ts (A5 umor); adapt.ts adaptBanner; app/adapt.ts (poziv); fatigueRepeat.node.test.ts',
    rationale:
      'Organizator, MASTER pouka 36 (fatigue-repeat.ts HM end): drugo rasterećenje 708/777 tokova → 0 (sredom 0 → 0). Traka bajt-ista prema app/adapt.ts HM-06 (adaptFlow testovi nepromenjeni). HM-07b (organizator, merenje na afa1c46: zapisi pet/ned, asOf ponedeljak nedelje k → HM k + 1, maraton k): hm-v2.4.0 je za asOf u nedelji posle zapisa uzimao prvu punu nedelju posle asOf — krši „isti zapisi = isti plan" i odlaže oporavak (kad je k + 1 redovno rasterećenje, umor se gubio). Merenje (docs/hm-v2/artifacts/segment-07b/probe.ts, svaki 97. ulaz × k ∈ {2, 4, N − 6}): rasterećenje van nedelje k 5698 / 20 202 → 0, plan poslednjeg dana k − 1 ≠ prvog dana k 2590 / 2590 → 0 (osim kad rasterećenje menja upisan prvi dan), 0 odbijanja; rana 4a 114 012 i ciljana 16 275 bez promene sadržaja.'
  },
  {
    id: 'HM07b-GUARD',
    rule: 'Pouka 4 / stalni uslov 4: provere po danu (H10/H14: WU/CD, tip po fazi, lestvica, doza, RPE, deonice, oporavak, test; H11 plafon zone po treningu) preskaču zaštićene dane — zaključane (A11, lockedDayIds) i upisane (datum ≤ poslednji asOf: urađen, propušten, ručno izmenjen; pouka 29) — kao LIMITS. Zaštićen dan je činjenica: npr. zaključan dan kvaliteta posle novog rezultata nosi stari tempo (A1: novi tempo od sledeće nedelje), a validator sudi samo ono što konstruktor odlučuje.',
    place: 'validate.ts guarded (jedno mesto: zaključan ∪ upisan), petlja H10/H14 i H11 ZONE_CAP',
    rationale:
      'Nalaz MAR-07 (organizator), izmereno u HM (probe.ts): rezultat faster/slower/test5k krajem nedelje k + zaključani Q1/Q2 (ili samo Q1) nedelje k + 1, pa urađen Q1 — odbijeno 2978 / 3336 tokova (WARMUP/COOLDOWN, …) → 0 / 4617 (sa lancem urađenog Q1). Rana 4a i ciljana mreža bez promene.'
  },
  {
    id: 'P37-MIXED',
    rule: 'Pouka 37: mešovita nedelja (deo dana zaštićen: ≤ asOf, urađen, zaključan) — cilj važi za celu nedelju. Zaštićeni dani se broje po ČINJENICAMA (dopuna 5K-08i; week.keptSum100: dan u prijavljenoj pauzi 0, dan sa upisanim treningom upisani km — completed = false → 0, ostali planirani km; adaptation.factKm). Preostali dani se sastavljaju na ostatak = cilj − zaštićeni, SAMO NANIŽE: menja se samo nedelja u kojoj zaštićeni dani prelaze sastavljene za te datume, a zaštićeni + preostali > cilj + tolerancija (0,1 km); nijedan dan više od sastavljenog, manjak se ne nadoknađuje. Redosled (HM-08 opcija A): lagani se skraćuju do 4 km (i ≤ preostali dugi — dugi ≥ lagan važi među preostalim danima, zaštićeni su činjenice), pa kvalitet otpada u lagan (Q2, pa Q1) SAMO ako time nedelja staje (dopuna MAR-08); dugi i test se ne skraćuju radi ostatka. Ne staje → kvalitet ostaje, lagani 4 km, planirano > cilj uz upozorenje MIXED_WEEK_OVER (pouka 14), ne odbijanje. Trkačka nedelja izuzeta (pouke 5, 30). Urađeni dani posle asOf → adaptation.doneDayIds. Pauza: cilj nedelje pauze određuje volume (pauseRemainder), pouka 37 samo raspoređuje dane. HM-08b (ispravka organizatora, 5K-08i-b): dan poznat iz potpune pokrivenosti bez zapisa = 0 (činjenica).',
    place:
      'week.ts remainderWeek (jedino mesto odluke), keptSum100, freeKind, mixedMin100; lengths.ts mixedFloor100, remainderEasy10; adapt.ts factKmOf, doneDayIds; written.ts (factKm → mešovita); generate.ts construct; validate.ts MIXED_WEEK_OVER / MIXED_OVER_TARGET (iste funkcije); adaptInvariants.ts',
    rationale:
      'Nalaz organizatora (mixed-deload.ts, tekuće rasterećenje posle umora, asOf prvi dan nedelje k ∈ {2, 4}, svaki 97. plan): planirano > cilj 291/449 (+3,66, max +9,98 km) → 19/449, svih 19 sa MIXED_WEEK_OVER; d3-10w-25km-v30-A-sat ned 3: 24,32 → 21,2. B (dugi se skraćuje) odbačena: skraćen dugi postaje poslednji dugi (H5, pouka 29) → cilj u 1458 tokova rane mreže, vrh do −22,1 km; C (stanje ne čita skraćen dugi) — dve definicije. Regresija (heš bez verzije): generator 25 122 bez promene; rana 4a 114 012 i ciljana 16 275 — 0 odbijanja; promene po scenariju u SEGMENT-08-IMPLEMENTATION (pauza 20 / under50 / bol 8 posle zbira po činjenicama više nisu stisnuti — samo adaptation.mixedWeeks/factKm; over120 upisani višak skraćuje preostale dane, 25 tokova menja cilj preko progresije doze; cilj chain/2 258 — A2 manjak pre, ne posle, jer mešovita nedelja prvog koraka ima manje planiranih km). Van pouke 37 (audit): rasterećenje nije niže od prethodne 184 → 118, u svih 118 je CILJ ≥ planirano prethodne (volume.ts).'
  },
  {
    id: 'K1-TEST',
    rule: 'Pouka 38 / K1 (kao maraton A13b, MAR-08b): test čiji je dan u planu pre koraka ZAŠTIĆEN (≤ asOf, zaključan, urađen) se ne premešta i nijedan okvir ne nosi drugi test; zaštićen dan ostaje upisan (A11).',
    place:
      'steps.ts protectedTestDate (jedna funkcija), framesFor (konstruktor generate.ts, validator validate.ts, adapt.ts — skup zaključanih i urađenih datuma)',
    rationale:
      'Rani prolaz završne provere (organizator, K1): locked-test.ts HM 97 — zaključan dan testa + pauza 10/20, umor, bol 5/8, asOf test − 14 … − 1: 3193 / 4550 odbijeno (TEST, dva testa) na 836a5cd → 0; locked-pause.ts HM 193 97 29: 258 / 35 408 → 0; two-step locked → nov rezultat (cum): validator je sudio mesto zaštićenog testa (osnova tempa posle rezultata) → broj testova ≤ 1 uvek, mesto samo nezaštićenom (kao HM07b-GUARD); 12 → 0. Regresija rane/ciljane mreže 0 (ti tokovi su ranije bili odbijeni).'
  },
  {
    id: 'K2-RACE-REST',
    rule: 'K2: trkačka nedelja sa danima odmora koraka (bol, A4) sme biti trkačka + trka < minimum uz upozorenje RACE_WEEK_SHORT (pouka 25, kao obična nedelja sa danima odmora). Strana koja je odstupala: invarijanta (test kod), ne konstruktor ni validator.',
    place: 'adaptInvariants.ts (D30b izuzetak)',
    rationale:
      'last-weeks.ts HM 193 97 29: 6 / 74 836 tokova (bol 8 u trkačkoj nedelji, npr. d6-10w-40km-v35-B-sun asOf 2027-01-05: trkačka 2,81 km + trka < 24 km uz RACE_WEEK_SHORT) → 0; konstruktor i validator nepromenjeni (kao 10K K2).'
  },
  {
    id: 'K3-CHAIN',
    rule: 'K3: (a) nedelja čiji su svi dani trčanja dani odmora koraka (bol, A4) bez treninga = upozorenje WEEK_ALL_REST, ne EMPTY_WEEK (kao 10K-06g, N1). (b) prinudno rasterećenje (umor) čija nedelja nema pre sebe upisan dugi ne-rasteretne izgradnje (npr. nedelja 1 cela u odmoru bola) → dugi reference = dugi poslednje ne-rasteretne izgradnje generatora pre te nedelje (korak.deloadRefLongKm; kao pouka 34: bez izgradnje referenca je generator); 0,8 × po H5.',
    place:
      'validate.ts (WEEK_ALL_REST); assess.ts (A5: deloadRefLongKm), adapt.ts (genLongBefore), steps.ts deloadRefLong10 (jedna funkcija: konstruktor generate.ts i validator)',
    rationale:
      'prestart-chain.ts (HM, svaki 97. ulaz, bol 8 / bol 5 / umor / pauza 20 na start − 1 → 17 scenarija u ned 1): 61 EMPTY_WEEK + 116 WEEK_INFEASIBLE / 35 224 → 0; handoff-adapt.ts MAR>HM 193 97 29 (plan cilja predaje): 136 / 44 676 (80 EMPTY_WEEK, 56 WEEK_INFEASIBLE) → 0. Opcija pouke 33 nije primenljiva — bez reference nema 0,8 × poslednji; referenca generatora je ista kao pouka 34 (nema upisane izgradnje). Trajna mreža segment08b.'
  },
  /* ---------- Segment 3i (hm-v2.6.2): broj nedelje u porukama na planu cilja predaje. ---------- */
  {
    id: '3i-WEEK-LABEL',
    rule: 'Ulaz weekOffset (ceo broj ≥ 0, podrazumevano 0; normalizovan ulaz ga nosi samo kad je > 0) = broj nedelja ispred plana (prefiks izvora predaje „kraća distanca"). Uslov poznat unapred (uslov 4): postavlja ga cilj predaje pri stvaranju plana, čuva se u plan.input, adaptacija ga čita iz plana. Svaki broj nedelje u porukama jezgra (napomene nedelja i plana, razlozi adaptacije i traka, upozorenja i odbijanja validatora) ide kroz weekLabel = weekOffset + indeks v2; indeksi, polja week i poređenja ostaju v2. Izuzeci (nisu broj nedelje kalendara): redni broj uvoda „nedelja k od N" (H17), „u nedeljama 1–2" segmenta (H5, položaj u segmentu), STRUCTURE, greške programa (throw). Bez offseta → isti plan.',
    place:
      'weekLabel.ts; input.ts checkInput; types.ts HmV2Input.weekOffset; assess.ts, adapt.ts, generate.ts, validate.ts (poruke); app/handoffTarget.ts targetInput; app/form.ts (Forma, isti offset); app/plan.ts KNOWN_VERSIONS',
    rationale:
      'REVIEW-3 #2 dopuna (review3d.measure.ts, obrazac 10K): na planu cilja razlozi i traka nosili su v2 indeks, a kalendar i pregled offset + indeks. Prepisivanje teksta u app sloju je krhko (odluka organizatora); offset je činjenica plana, ne politika izvora.'
  },
  /* ---------- Segment HM-09 (hm-v2.7.0): ispravke posle dubinske provere (audit/fixes/HM.md). ---------- */
  {
    id: 'HM-09',
    rule: 'B1/B2: dugi reference rasterećenja nedelje w = JEDNA funkcija steps.longRef10 (poslednji upisani dugi ne-rasteretne izgradnje iz upisanih dana NOVOG plana; bez njega u rasterećenju referenca koraka za tu nedelju), po nedelji, ne pamti se; assess daje deloadRefLongKm uz svaki umor od nedelje 2 (odluku „ima li upisanog dugog" donosi samo longRef10). B3: dugi tapera ≥ 4 km (lengths.taperLongCap10, kao A18 rasterećenja) uz upozorenje TAPER_LONG_MIN. Pouka 28 × 37: L skoka iz stvarno trčanog — prošla nedelja cela poznata (pokrivenost/pauza) daje najduži trčan (step.ranLongKm i ranPart, važi od fromWeek koraka — steps.ranLongFor; od nedelje 5; L = 0 → kao pre; ne ispod najmanjeg dugog nedelje minimuma ranCapFloor10), nikad iznad upisanog (lengths.longsOf10). Pouka 35 u taperu: dva dana kvaliteta, a neki duži od dugog → drugi lagan, nedelja kao „samo RP" (week.taperSecondEasy). Napomena tapera „ne sme biti duži" samo kad dan nije duži; inače „najmanja doza; i dalje duži". Z1: kvalitet ostaje u mešovitoj nedelji kad je jedini uzrok viška upisani višak i planirano ≤ 1,10 × cilj (week.mixedQualityStays, MIXED_WEEK_OVER). Z2: tekst za korisnika kroz userText (bez internih oznaka, decimalni zarez, km ≤ 1 decimala, bez „.."); plan i validator nose oznake. Z3: Forma čita assess.resultUse. Z4: vraćanje verzije = spoj (prošle nedelje koje se razlikuju su mešovite) → validatePlan i sledeće prilagođavanje jezgra; prolazi → vraća se, inače odbijanje sa razlogom (neposredno poništavanje prolazi). Z5b: početnik izvora iznad opsega početnika cilja → plan bez oznake početnika.',
    place:
      'steps.ts longRef10; assess.ts (A5, resultUse); generate.ts; validate.ts (DELOAD_*, TAPER_LONG_MIN, SECOND_QUALITY taper, MIXED_WEEK_OVER); lengths.ts taperLongCap10, longsOf10; assess.ts ranLongOf, steps.ts ranLongFor; week.ts taperSecondEasy, mixedQualityStays, uvod; userText.ts; app/form.ts, app/adapt.ts restoreMerge, app/handoffTarget.ts; adaptInvariants/gridInvariants (K1, F6)',
    rationale:
      'Dubinska provera v2 (owner B1 3 758/13 860, B2 19 490/19 490, B3 8 tokova, T1 495/528; coach-hm-mar 1b #1/#2/#5; consistency Z1; app A1/A2; fuzz F6) — brojevi pre → posle u docs/hm-v2/reports/SEGMENT-09-IMPLEMENTATION.md.'
  },
  /* ---------- HM-09 dopuna lanaca (hm-v2.7.1): audit/fixes/01-chains-addendum.md. ---------- */
  {
    id: 'HM-09-CHAINS',
    rule: 'Z6: zaštićen dan (≤ poslednji asOf, zaključan, urađen — validate guarded) je činjenica i u proveri LIMITS (i oštrenje). Z7: manjak izvršenja vezan za zapise — korak čiji se prozor zapisa preklapa sa ranijim primenjenim manjkom (step.underFrom) ne pravi nov. Z8: bol vezan za zapise — kad je raniji korak bola video najnoviji zapis bola, nov korak bola se ne pravi (bez kaskade sidra). C3 (pouka 38): zaštićen dan testa upisanog plana je činjenica koraka (step.testKept) — ostaje i kad se zaključavanje ne ponavlja (steps.protectedTestDate). C7: taper posle smanjenja bez ne-rasteretne izgradnje → osnova = lastBuild10 (osnova rasterećenja), ne 0. C9: invarijanta pouke 28 ne sudi zaključanom/urađenom dugom. C10 (i=1888): rešen Z6.',
    place:
      'validate.ts (guarded u LIMITS); assess.ts (underFrom, painSeen, testKept); steps.ts protectedTestDate; volume.ts adaptNominal10; adaptInvariants.ts',
    rationale:
      'chains.ts HM 20261023 0 2000: odbijeni lanci 95 → 0; idemp.ts: isti 643 → 25, sutra 218 → 21 (manjak 361/113 → 0); C7 i=4878 taper 24 km (svi dani 4 km) → 46,5 km.'
  },
  /* ---------- Segment HM-10 (hm-v2.8.0): krug T — trenerska pravila (audit/fixes/03-coach-rules.md, T-assign.md). ---------- */
  {
    id: 'HM-10',
    rule: 'T1: u nedelji izgradnje (ne rasterećenje, taper, trkačka) svaki lagan ≤ 0,8 × dugi iste nedelje (km) i ≥ max(4 km, 20 min srednjim E); dugi se određuje kao i do sada (najduži dozvoljen) i zbog ovoga se ne produžava — ostatak koji ne staje → nedelja nije izvodljiva sa tim ciljem i pretraga cilja je spušta (planirano < cilj po pravilu, CAPACITY_LIMITED „i lagane ≤ 0,8 × dugi" uz preporuku više dana); kad najkraći lagan ne staje ispod 0,8 × dugi (mali obim) → manje laganih dana (najkasniji lagani su odmor, napomena „Manje laganih dana"); pouka 35: dva dana kvaliteta koja staju samo uz dan odmora → drugi dan lagan kad nedelja sa jednim staje. Izuzetak (pitanje organizatoru): nedelja NA minimumu obima u kojoj T1 nije izvodljiv ni sa manje dana → dužine kao pre (lagan ≤ dugi), upozorenje EASY_BUILD_MIN_WEEK. Dan trčanja šablona koji je odmor ostaje dan plana za dayId zapisa. T3: posle novog starta (A3) taper zadržava jedan kvalitet kad RP ne staje u plafon: T ≈ 60 % poslednje T doze posle povratka (min 2,0 km, plafon T važi) kad je posle povratka bar jedna nedelja izgradnje sa kvalitetom; trkačka nedelja kratko oštrenje kao bez pauze, osim u periodu bola. C4: urađen dan posle asOf u zbiru zaštićenih = planirani km (MASTER pouka 37). C12: RP najnižeg nivoa (2 × 2000 m) se u mešovitoj nedelji ne odbacuje (kao MAR MP). T7: skorašnji najduži > trenutni nedeljni obim → RECENT_LONG_OVER_WEEKLY („proveri unos").',
    place:
      'lengths.ts buildLengthsT1, buildLengths, buildEasyMin10, buildEasyCap10, t1MinWeek; week.ts buildDayLimit, secondQualityEasy, easyDays, T1_REST_NOTE, freeKind (C12), sharpenerAllowed (T3); quality.ts restartTaperT; steps.ts newStartAt; generate.ts (newStart); volume.ts capacityLimits/capacityMessage (easy); validate.ts EASY_BUILD, EASY_BUILD_MIN_WEEK, ROLES (t1Rest), WEEK1_BELOW_START, TAPER_QUALITY, PHASE_QUALITY, RACE_SHARPENER; adapt.ts factKmOf (C4), dayId dana šablona; input.ts RECENT_LONG_OVER_WEEKLY; gridInvariants (EASY_BUILD, K2, DAYS_COUNT), adaptInvariants (minimum u koraku 0,1 km, pouka 25)',
    rationale:
      'coach-hm-mar 1b #4 i measure.ts HM 400 200 100: lagan ≥ 0,9 × dugi 3 906 → 0 / 24 852 planova; coach-HM pauza 35 (taper bez kvaliteta, trkačka bez oštrenja); consistency C4/C12; plauzibilnost L1. Brojevi pre → posle u docs/hm-v2/reports/SEGMENT-10-IMPLEMENTATION.md.'
  }
];

export const HM_V2_POLICY = {
  id: 'hm-v2',
  version: 'hm-v2.8.0',

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

  /** H16: plan po osećaju (bez pouzdanog rezultata). */
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
      RP: { min: 6, max: 7, cue: 'ritam polumaratona' },
      I: { min: 8, max: 8, cue: 'teško, izdrživo 3–5 min' },
      R: { min: 8, max: 8, cue: 'brzo, opušteno' }
    }
  },

  /** H16: test (samo plan po osećaju koji nije početnik). */
  test: { km: 5 },

  /** H17: JEDINA tabela početnika (udeo dugog, minimum i max nedelje: red H15 za isti broj dana). */
  beginner: {
    days: {
      4: { kmMin: 20, kmMax: 40 },
      5: { kmMin: 25, kmMax: 45 }
    },
    weeksMin: 12,
    /** Nedelje 1..introWeeks bez kvaliteta. */
    introWeeks: 2,
    growth: 0.05,
    growthMinKm: 1.0,
    growthMaxKm: 2.0,
    peakFactor: 1.4,
    peakAddKm: 15,
    /** Dugi ≤ 135 min sporim E. */
    longMaxSec: 8100,
    /** Upozorenje LONG_RUN_SHORT kad je najduži dugi < longWarnKm. */
    longWarnKm: 14,
    /** HI10: prvi nivo lestvice T kontinuirano početnika = najmanja T doza rasterećenja i tapera [km]. */
    tFirstKm: 1.5
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
  lengths: {
    longMaxSec: 9000,
    longMaxKm: 24,
    easyMinKm: 4.0,
    longWarnKm: 16,
    /** T1 (krug T, organizator 23. 10.): u nedelji izgradnje lagan ≤ ovaj udeo dugog iste nedelje (km) i
        ≥ max(easyMinKm, easyMinSec laganim tempom). */
    easyLongMaxShare: 0.8,
    easyMinSec: 1200
  },

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

  /** Segment 04 (H18 = 10K v2 A1–A17): adaptacija. Rezultat: starost i VDOT kao ulaz; donja granica cilja:
      weekMinKm (H15, A9); lagan ≥ lengths.easyMinKm (4 km). */
  adapt: {
    windowDays: 7,
    underShare: 0.6,
    underFloorShare: 0.8,
    pause: {
      shortDays: 7,
      midDays: 14,
      longDays: 28,
      shortShare: 0.8,
      midShare: 0.7,
      longShare: 0.5
    },
    /** H18: nov start i < ovoliko nedelja do trke → cilj „orijentir". */
    restartFullPrepWeeks: 10,
    painMin: 4,
    painRestMin: 7,
    painLookbackDays: 3,
    painDays: 7,
    restDays: 3,
    /** H18: dugi ≤ 60 min u periodu bola. */
    painLongMaxSec: 3600,
    /** H18: lagani × 0,7 (≥ 4 km). */
    painEasyFactor: 0.7,
    fatigueRpe: 7,
    fatigueCount: 2,
    overShare: 1.15,
    returnGrowth: 0.1,
    returnGrowthMinKm: 1.0,
    orientationMessage:
      'Cilj je orijentir: posle duge pauze do trke ostaje manje od 10 nedelja, priprema nije potpuna (A3).',
    painMessage:
      'Bol: 7 dana bez kvaliteta i ubrzanja, dugi ≤ 60 min, lagani kraći. Ako bol traje ili se pojačava, potraži stručni pregled (A4).'
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
  /** Z1 (HM-09, pouka 37 dopuna): kvalitet ostaje u mešovitoj nedelji kad je jedini uzrok viška upisani višak i
      planirano sa kvalitetom ≤ 1,10 × cilj. */
  mixed: { keepQualityShare: 1.1 },

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

/** H17: brojevi dana trčanja početnika. */
export const BEGINNER_DAYS_COUNTS = Object.keys(HM_V2_POLICY.beginner.days)
  .map(Number)
  .sort((a, b) => a - b) as readonly (keyof HmV2Policy['beginner']['days'])[];

/** Pravilo plana: red H15 (redovan) ili red H15 izmenjen tabelom početnika (H17). Jedino mesto gde se
    brojevi rasta, vrha, dugog, uvoda i testa biraju po iskustvu. */
export interface PlanRule extends DayRule {
  readonly beginner: boolean;
  /** H13/H17: plafon dugog sporim E [s]. */
  readonly longMaxSec: number;
  /** H13/H17: upozorenje kad je najduži dugi plana < longWarnKm. */
  readonly longWarnKm: number;
  /** H6/H17: rast nedelje izgradnje i granica vrha. */
  readonly growth: number;
  readonly growthMinKm: number;
  readonly growthMaxKm: number;
  readonly peakFactor: number;
  readonly peakAddKm: number;
  /** H17: nedelje 1..introWeeks bez kvaliteta (0 = nema uvoda). */
  readonly introWeeks: number;
  /** H1/H17: najmanje nedelja. */
  readonly weeksMin: number;
  /** H16/H17: plan po osećaju ima test 5 km (početnik nema). */
  readonly feelTest: boolean;
  /** Brojevi dana dostupni ovom iskustvu (preporuke u porukama). */
  readonly dayCounts: readonly number[];
}

export function planRule(count: number, experience: 'beginner' | 'regular'): PlanRule | null {
  const d = dayRule(count);
  if (!d) return null;
  const P = HM_V2_POLICY;
  if (experience === 'regular')
    return {
      ...d,
      beginner: false,
      longMaxSec: P.lengths.longMaxSec,
      longWarnKm: P.lengths.longWarnKm,
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
    longWarnKm: b.longWarnKm,
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
