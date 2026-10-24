# Trenerska pravila — krug T (korisnik: „popravi sve trenerske stvari"), organizator 23. 10.

Odluke organizatora (trenersko MIŠLJENJE; granice zona po Danielsu — I ≤ 8 %, T ≤ 10 %, R ≤ 5 % nedeljnog obima —
kao opšte poznate smernice, bez citata). Važe `00-common.md` (samo svoj folder, test pre/posle, sabotaža, bez
check:full, push) i AGENTS.md uslovi 1–8 (jedan vlasnik; manjak obima → lagani dani ili planirano < cilj, nikad duži
dugi ili WU/CD kao pufer). Svako pravilo: jedna funkcija koju zovu konstruktor i validator. Promena plana je NAMERNA —
otisci se snimaju ponovo uz spisak promenjenih klasa i razlog.

T1 (sve 4) Lagan prema dugom, u nedeljama izgradnje (ne rasterećenje, taper, trkačka; ne trčanje/hodanje):
  - svaki lagan trening ≤ 0,8 × dugi iste nedelje (km);
  - najkraći lagan trening = max(postojeći minimum km distance, 20 min laganim tempom);
  - kad ostatak cilja ne staje u lagane dane u tim granicama: manje laganih dana (odmor) i/ili planirano < cilj uz
    postojeće upozorenje + preporuku (više dana / manji obim). Dugi se ZBOG OVOGA ne produžava.
  Merenje: audit/coach-5k-10k/measure.ts (M1 lagan ≥ 0,95 × dugi, M5 dan pre dugog, M6 < 20 min) i
  audit/coach-hm-mar/measure.ts (lagan ≥ 0,9 × dugi) → 0; zapiši i pad planiranog obima (koliko planova < cilj).
T2 Kvalitet prema dugom:
  - MAR: u taperu dan kvaliteta (MP) ne traje duže od dugog iste nedelje — MP blok se skraćuje do trajanja dugog
    (doza tapera nikad ne raste); 1b nalaz 3 (70,6 %) → 0.
  - 5K: pravilo „dan kvaliteta (sa WU/CD) ne duži od dugog" u izgradnji, kao 10K D25 / HM pouka 32: prvo WU/CD na
    minimum, pa upozorenje LONG_SHORTER_THAN_QUALITY; fuzz F4 (~3 800) → izmeri.
T3 Posle novog starta (pauza ≥ 35 dana / restart) — 10K, HM, MAR (5K deo u T4):
  - taper zadržava 1 kvalitet (doza = 60 % poslednje doze posle povratka, najmanje najniži nivo) kad je posle
    povratka bar 1 nedelja sa kvalitetom; trkačka nedelja zadržava kratko oštrenje kao bez pauze (osim u periodu bola).
T4 (5K) vrh i taper, ne-početnik (početnik i trčanje/hodanje bez promene osim T5):
  - taper 1 nedelja + trkačka (umesto 2);
  - plan ≤ 8 nedelja: bez redovnog rasterećenja (taper je dovoljan); duži plan: rasterećenje ne pre ned 4;
  - glavna doza vrha (I ili RP) dostiže ≥ 80 % plafona zone (I 8 % nedeljnog obima) u nedeljama vrha, u granicama
    postojećih koraka progresije (ne naglo); posle novog starta sa ≤ 6 nedelja do trke taper 1 nedelja.
  Merenje: coach.ts profil korisnika (20:25, 30 km, 4 d, trka 13. 12. 2026) — pre/posle tabela nedelja u izveštaju.
T5 (5K) trčanje/hodanje i početnik:
  - lestvica trčanja/hodanja se produžava (L13 35 min, L14 40 min neprekidno) kad ima nedelja, da najduže
    trčanje pred trku bude ≥ procenjeno trajanje trke − 10 min;
  - početnik: prvi test/kontrolno najranije posle 2 obična dana kvaliteta.
T6 Jedno pravilo za sve 4 (consistency REPORT):
  - C3: test (zaštićen ili planiran) se u mešovitoj nedelji ne odbacuje radi ostatka (kao HM/MAR) → 5K, 10K;
  - C4: urađen dan posle asOf u zbiru zaštićenih = planirani km (MASTER pouka 37) → 10K, HM;
  - C5: pouka 30 — prvo otpada oštrenje, pa lagani u odmor (kao 10K/HM/MAR) → 5K;
  - C6: posle bola progresija doze kreće ispočetka od r + 1 (sidro bola u restartWeeks) → 10K, MAR;
  - C11: pouka 35 važi u svim nedeljama osim trkačke (kao HM) → 5K, 10K, MAR;
  - C12: najniži nivo MP/RP se u mešovitoj nedelji ne odbacuje (kao MAR) → HM.
T7 Plauzibilnost (samo gde polje postoji, HM i MAR): skorašnji najduži > trenutni nedeljni obim → odbijanje sa
  porukom (preporuka: proveri unos). Ostala plauzibilnost bez pravila.
MAR dodatno (ostalo iz MAR-10): C3-lanci (zaštićen test + nov rezultat → odbijanje TEST, 26/2 000 → 0), Z8 (bol vezan
za zapise, kao HM/5K/10K), C8 (upozorenje MIXED i kad je vlasnik pauza).

Na kraju: run-all te distance (`'.*-<D>'`, bez „$"), chains/idemp 2 000 (bez regresije prema 1a838c9/724b676),
izveštaj `docs/<d>-v2/reports/SEGMENT-<oznaka>-IMPLEMENTATION.md`, send_message organizatoru (pre → posle po
pravilu, broj planova sa planirano < cilj pre/posle). Ništa preko spiska.
