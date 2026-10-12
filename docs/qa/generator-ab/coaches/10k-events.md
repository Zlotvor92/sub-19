# Nezavisni pregled događaja — 10K specijalista

Pregled: 2026-10-12. Pokriveno svih deset dozvoljenih U01-event.json…U10-event.json. Početne ocene i početni izveštaj ostaju zamrznuti. Nisam čitao users nalaze van event payload-a, izvor/probe, druge trenerske izveštaje/status niti ponovo pokretao funkcionalne API-je.

Ugrađeni checks/audit zaključci nisu zamena za moju procenu. Iz eksplicitnih input/current/result objekata ponovo sam izračunao promene dana, efektivne prošle datume, već odrađene dane, manual override i zaključane pred-row razlike. Invokacionu čistoću bez oba snapshot-a ne tvrdim kao sopstveno izvršeno testiranje.

Actual outcome označava izlaz domena u sintetičkom scenariju, ne ljudski rezultat, primenu u store-u, UI, undo, backend ili sat. Potvrđen defect je direktno neusaglašen podatak/tekst ili gubitak zaštićenog snapshot-a. Coaching concern je stručna inferencija o oporavku, dozi ili spremnosti. Promena faze/rasterećenja sama po sebi nije potvrđen kvar. Stari kvalitet na preskočenom/odrađenom danu pre cutoff-a u mešanoj nedelji nije novi povratni rad.

U08 PRIMARY 2026-11-25 je odbijen i nema result. SUPPLEMENT 2026-10-28 ostaje odvojena ranija simulacija; njegovi nalazi nisu rezultat primarnog događaja.

## Sažetak

|ID|Verdict|Potvrđeni defects|Trenerske zamerke|
|---|---|---:|---:|
|U01|appropriate_no_regeneration|0|0|
|U02|appropriate_reduction_with_text_fixes|2|1|
|U03|recovery_review_needed|0|2|
|U04|appropriate_return_with_text_fixes|2|1|
|U05|new_preservation_pass_old_protected_defects|5|0|
|U06|return_only_not_10k_ready|3|1|
|U07|appropriate_reduction_not_hm_ready|2|2|
|U08|primary_rejected_supplement_return_with_text_fixes|2|2|
|U09|return_only_not_marathon_ready|2|1|
|U10|return_only_not_marathon_ready|3|1|

## Primarni izvori i granice primene

Prethodno provereni primarni izvori iz mog početnog izveštaja, pristupljeno 2026-10-11:

- B.A.A. 10K: https://www.baa.org/races/boston-10k/info-for-athletes/b-a-a-10k-training/ — individualna prilagodljivost i različite doze po iskustvu.
- Higdon 10K: https://www.halhigdon.com/training-programs/10k-training/intermediate-10k/ — laki obim, kvalitet i oporavak prema razvijenoj bazi.
- Runna 10K: https://support.runna.com/en/articles/6186788-the-ultimate-10k-training-guide — prag i intervali imaju različite namere; hod nije automatski greška.
- Muñoz, originalni RCT: https://pubmed.ncbi.nlm.nih.gov/23752040/ — raspodela intenziteta i10K razvoj; ne daje jednu univerzalnu dozu.
- Shepley, originalni taper trial: https://pubmed.ncbi.nlm.nih.gov/1559951/ — smanjen volumen uz očuvanu oštrinu; mala srednjeprugaška studija ne propisuje universalni HM/maraton taper.
- B.A.A. HM: https://www.baa.org/races/boston-half/info-for-athletes/boston-half-training/ i Higdon Novice1: https://www.halhigdon.com/training-programs/marathon-training/novice-1-marathon/ — ponovljena dužinska priprema i oporavak. Ne zahtevam univerzalni broj dana ili20milja za svakoga.

Smanjenja85/70/55% i2/3/4lake nedelje su posmatrana politika aplikacije, ne univerzalna fiziologija. Spremnost se ne dokazuje PB-om ili propisanom kilometražom. Zaštićeni budući ručni/mereni dani mogu zadržati veći rad: očuvanje korisničke odluke nije automatska potvrda primerene doze. Konkretne coaching concerns su moje inferencije, ne direktne preskripcije iz izvora.

## U01 — appropriate_no_regeneration

Event: {"kind": "single-miss"}

Actual outcome: {"old": {"recommendation": {"kind": "single-miss", "reason": "Jedan propušten trening ne zahteva novi plan. Nastavi raspored bez nadoknade kilometara.", "actionable": false, "requiresConfirmation": false, "weeklyKm": 9.7, "recentLongRunKm": 4.1, "reasons": []}, "error": "Jedan propušten trening ne zahteva novi plan. Nastavi raspored bez nadoknade kilometara.", "goalChange": null}, "new": {"recommendation": {"kind": "single-miss", "reason": "Jedan propušten trening ne zahteva novi plan. Nastavi raspored bez nadoknade kilometara.", "actionable": false, "requiresConfirmation": false, "weeklyKm": 8.8, "recentLongRunKm": 3.5, "reasons": []}, "error": "Jedan propušten trening ne zahteva novi plan. Nastavi raspored bez nadoknade kilometara.", "goalChange": null}}

Preservation — nezavisno poređenje: {"old": {"comparisonAvailable": false, "reason": "Nema oba eksplicitna snapshot-a ili nemaresult."}, "new": {"comparisonAvailable": false, "reason": "Nema oba eksplicitna snapshot-a ili nemaresult."}}

**trainingStructure:** Jedan preskok ne pravi novi ciklus. Oba izlaza savetuju nastavak bez nadoknade.

**dose:** Preskočen kvalitet ostaje preskočen; nije dodat u sledeće dane.

**recovery:** Bez pretvaranja jednog preskoka u potvrđenu pauzu. Sparse kontrola ne pretvara neupisano u nulu.

**coherence:** single-miss i error tekst su usaglašeni.

**Potvrđeni defects:**

Nijedan u ovom pregledu.


**Trenerske zamerke:**

Nijedan u ovom pregledu.


**Datirani primeri:**

- 2026-11-25 g7d3 (observed_outcome): očekivano Preskok bez nadoknade; stvarno old Tempo 3.5 km; new Fartlek 3.9 km; status skip, nijedan adjustment.result.


## U02 — appropriate_reduction_with_text_fixes

Event: {"lowFrom": "2026-11-09", "lowTo": "2026-11-22", "fraction": 0.55, "priorRuns": "All eligible runs from start through today explicitly done with distance and date; earlier weeks at prescription.", "kind": "underexecution"}

Actual outcome: {"recommendation": {"kind": "reduce", "reason": "Ponovljeni propušteni, preteški laki treninzi ili manji odrađeni obim opravdavaju pregled opterećenja.", "actionable": true, "requiresConfirmation": true, "weeklyKm": 23, "recentLongRunKm": 10.8, "reasons": ["Najmanje dve pokrivene pune nedelje imaju manje od 80% planiranih kilometara."]}, "resultPresent": true, "summary": "Plan prema odrađenoj bazi 23 km", "executionAdjustment": {"date": "2026-11-25", "breakDays": 0, "reportedBaseKm": 23, "startingKm": 23}, "preparation": {"endurance": "developing", "goalStatus": "needs-speed-improvement", "peakLongRunKm": 12, "peakWeeklyKm": 30.5, "demandingDaysMax": 2, "reasons": ["Nema potvrđenog kontinuiteta od najmanje osam nedelja; izdržljivost se ne zaključuje samo iz PB-a."], "forecastBasis": "result-and-delivered-preparation"}}

Preservation — nezavisno poređenje: {"primary": {"comparisonAvailable": true, "changedDays": 38, "pastEffectiveDayChanges": [], "completedDayChanges": [], "manualOverrideOrAltChanges": [], "lockedPredictionRowChanges": [], "calendarIdsStable": true, "raceDateStable": true, "runDaysStable": true, "trainingVdotBefore": 40.7, "trainingVdotAfter": 40.7, "goalBefore": 1199, "goalAfter": 1199}, "seededProtection": {"comparisonAvailable": true, "changedDays": 33, "pastEffectiveDayChanges": [], "completedDayChanges": [], "manualOverrideOrAltChanges": [], "lockedPredictionRowChanges": [], "calendarIdsStable": true, "raceDateStable": true, "runDaysStable": true, "trainingVdotBefore": 40.7, "trainingVdotAfter": 40.7, "goalBefore": 1199, "goalAfter": 1199}}

**trainingStructure:** Dve pune nedelje na 55% izvršenja opravdavaju novu procenu baze. Sledeći T se uklanja, buduće faze se ponovo raspoređuju.

**dose:** Baza 23 km, kasniji vrh 30.5 km/LR 12 km. Vrlo kratak I/T služi blagom uvodu, ne dokazuje specifičnu izdržljivost.

**recovery:** Prva puna buduća nedelja 24.6 km; deload sa N 8/N 12 prelazi na N 10. To je trenerska zamerka rasporedu, ne dokaz kršenja obećanog invarianta.

**coherence:** Želja SUB 20 nije pretvorena u bržu formu. Tekst pogrešno pominje pauzu, a Fartlek naslov preživi uklanjanje sesije.

**Potvrđeni defects:**

- 2026-11-30 g8d1 (confirmed_text_defect): očekivano Opis smanjenog izvršenja bez pauze; stvarno Postepen povratak posle pauze, iako lastRun 2026-11-25, nema skip-a.
- 2026-11-30 N8 (confirmed_text_defect): očekivano Naslov prema stvarnim sesijama; stvarno focus Fartlek, nijedan session u četiri laka/LR trčanja.

**Trenerske zamerke:**

- 2026-12-09 g9d3 (coaching_concern): očekivano Objasniti svrhu kratkog I stimulusa; stvarno 100-200-300-200-100 m @4:32/km,61s hoda;0.9 km/4.08 min rada.

**Datirani primeri:**

- 2026-11-27 g7d5 (observed_outcome): očekivano Ukloniti najbliži zahtevni rad; stvarno T 2×1400 m→5.1 km lako.

### Svaka buduća nedelja — primary

Ukupan km uključuje sačuvane ranije dane u mešanoj nedelji; futureKm je samo posle cutoff-a. Trka ulazi u km, ali nije taper trening. Workmin je samo session rad, bez strides; progresivna poslednja trećina računa se kao kvalitet.

|N|Početak|Km ukupno/future|LR future|Deload/taper|Workmin future|Focus|
|---:|---|---|---:|---|---:|---|
|7|2026-11-23|32.5/14.3|9.2|False/False|0||
|8|2026-11-30|24.6/24.6|9.4|False/False|0|Fartlek|
|9|2026-12-07|25.5/25.5|10.2|False/False|9.1|Piramida + Tempo isprekidan|
|10|2026-12-14|18.6/18.6|7.3|True/False|0|DELOAD — obim dole, ostaje kratka oštrina|
|11|2026-12-21|26.7/26.7|10.7|False/False|10.55|Intervali + Tempo isprekidan|
|12|2026-12-28|28.6/28.6|11.3|False/False|14.54|Fartlek + Tempo|
|13|2027-01-04|30.5/30.5|11.8|False/False|14.28|Intervali + Tempo isprekidan|
|14|2027-01-11|30.2/30.2|12|False/False|16.48|Intervali + Tempo|
|15|2027-01-18|19.6/19.6|7.2|False/True|11.72|Taper · Trkački ritam + Tempo|
|16|2027-01-25|12.8/12.8|0|False/False|2.81|TRKA|

Datirane sesije/strides i desc neusaglašenosti iz rezultata:

- 2026-12-07 g9d1: 7.8 km lako (Z2) @ ~6:02/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-09 g9d3: Piramida — 1.4 km zagrevanje + 100-200-300-200-100 m @ 4:32/km (61 s hoda između ponavljanja) + 1 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-11 g9d5: Tempo isprekidan — 1.4 km zagrevanje + 2×500 m @ 5:01/km (1:30 min laganog trčanja) + 1 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-14 g10d1: 4.2 km lako (Z2) @ ~6:02/km + 4×15 s ubrzanja (lagani ubrzani koraci) [session=ne, strides=da].
- 2026-12-21 g11d1: 8.6 km lako (Z2) @ ~6:02/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-23 g11d3: Intervali — 1.4 km zagrevanje + 2×500 m @ 4:32/km (1:42 min hoda) + 1 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-25 g11d5: Tempo isprekidan — 1.4 km zagrevanje + 2×600 m @ 5:01/km (1:30 min laganog trčanja) + 1 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-28 g12d1: 8.6 km lako (Z2) @ ~6:02/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-30 g12d3: Fartlek — 1.5 km zagrevanje + 4×60 s brzo @ ~4:32/km (60 s laganog trčanja) + 1 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-01 g12d5: Tempo — 1.5 km zagrevanje + 2.1 km @ 5:01/km + 1.1 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-04 g13d1: 8.9 km lako (Z2) @ ~6:02/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-01-06 g13d3: Intervali — 1.8 km zagrevanje + 2×800 m @ 4:32/km (2:43 min hoda) + 1.4 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-08 g13d5: Tempo isprekidan — 1.8 km zagrevanje + 2×700 m @ 5:01/km (1:30 min laganog trčanja) + 1.4 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-11 g14d1: 9.4 km lako (Z2) @ ~6:02/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-01-13 g14d3: Intervali — 1.5 km zagrevanje + 2×600 m @ 4:32/km (2:02 min hoda) + 1.1 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-15 g14d5: Tempo — 1.5 km zagrevanje + 2.2 km @ 5:01/km + 1.1 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-20 g15d3: Trkački ritam — 1 km zagrevanje + 3×400 m @ 4:45/km (86 s hoda) + 0.8 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-22 g15d5: Tempo — 1.1 km zagrevanje + 1.2 km @ 5:01/km + 1 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-29 g16d5: Repeticije — 1 km zagrevanje + 3×200 m @ 4:41/km (2:21 min hoda) + 1.9 km hlađenje [session=da, strides=ne].
- 2027-01-31 g16d7: 🏁 TRKA 5 km (5K) — željeni cilj 19:59 · preporučeni ritam 4:45/km (oko 23:45, prema unetom rezultatu) · Spremnost nije potvrđena: ovaj ritam je referenca iz rezultata, ne potvrda završetka distance ili ostvarenja cilja. [session=ne, strides=ne].


## U03 — recovery_review_needed

Event: {"kind": "high-rpe", "highEasy": [{"id": "g7d1", "date": "2026-11-23", "km": 13.3, "rpe": 8}, {"id": "g7d3", "date": "2026-11-25", "km": 11.5, "rpe": 8}], "history": "All eligible planned runs from plan start through today explicitly completed at actual distance and actual date; only the last two easy runs have RPE 8."}

Actual outcome: {"recommendation": {"kind": "reduce", "reason": "Ponovljeni propušteni, preteški laki treninzi ili manji odrađeni obim opravdavaju pregled opterećenja.", "actionable": true, "requiresConfirmation": true, "weeklyKm": 53.1, "recentLongRunKm": 16.6, "reasons": ["Najmanje dva laka treninga imaju upisan napor 7–10; proveri umor pre težeg rada."]}, "resultPresent": true, "summary": "Plan prema odrađenoj bazi 45.1 km", "executionAdjustment": {"date": "2026-11-25", "breakDays": 0, "reportedBaseKm": 53.1, "startingKm": 45.1}, "preparation": {"endurance": "developing", "goalStatus": "needs-speed-improvement", "peakLongRunKm": 16.6, "peakWeeklyKm": 56.5, "demandingDaysMax": 2, "reasons": ["Nema potvrđenog kontinuiteta od najmanje osam nedelja; izdržljivost se ne zaključuje samo iz PB-a."], "forecastBasis": "result-and-delivered-preparation"}}

Preservation — nezavisno poređenje: {"primary": {"comparisonAvailable": true, "changedDays": 37, "pastEffectiveDayChanges": [], "completedDayChanges": [], "manualOverrideOrAltChanges": [], "lockedPredictionRowChanges": [], "calendarIdsStable": true, "raceDateStable": true, "runDaysStable": true, "trainingVdotBefore": 48.2, "trainingVdotAfter": 48.2, "goalBefore": 1139, "goalAfter": 1139}}

**trainingStructure:** Poslednja dva laka trčanja na RPE 8 znače potrebu za pregledom zamora. Reduce bez ubrzavanja je primeren; regeneracija menja blisko rasterećenje.

**dose:** Baza 53.1→45.1 km, neposredni LR 16.6→14.1 km. N 8 ipak 48.8 km uz strides i 2.25 min T; VDOT 48.2 ostaje.

**recovery:** N 8 ranije deload 40.2 km bez kvaliteta, sada 48.8 km sa Fartlek. N 12 ranije 40.2, sada 54.3 km. Pre bržeg rada treba novi dokaz oporavka; nije potvrđen API invariant da deload ostane isti.

**coherence:** Primarna evidence.form=null i nema predloga bržeg tempa. Poseban measured challenge daje 51.2 VDOT/11 faster changes, ali blockedProposal=null. To je payload domena, nije moje novo izvršenje store testa.

**Potvrđeni defects:**

Nijedan u ovom pregledu.


**Trenerske zamerke:**

- 2026-11-30 g8d1 (coaching_concern): očekivano Sačuvati blisko rasterećenje ili opravdati zamenu prema RPE; stvarno N 8deload 40.2→normal 48.8 km;10.9 km lako+6×20s strides.
- 2026-12-01 g8d2 (coaching_concern): očekivano Kvalitet ponovo uvesti kada je zamor smiren; stvarno 3×45s @4:23/km,90s lagano; nema novih podataka o oporavku.

**Datirani primeri:**

- 2026-11-23 g7d1 (observed_outcome): očekivano Registrovati visok napor lakog trčanja; stvarno 13.3 km lako,RPE 8;2026-11-25 g 7d 3 11.5 km,RPE 8.
- 2026-11-27 g7d5 (observed_outcome): očekivano Ukloniti najbliži T; stvarno T 2×1600 m→8.2 km lako.

### Svaka buduća nedelja — primary

Ukupan km uključuje sačuvane ranije dane u mešanoj nedelji; futureKm je samo posle cutoff-a. Trka ulazi u km, ali nije taper trening. Workmin je samo session rad, bez strides; progresivna poslednja trećina računa se kao kvalitet.

|N|Početak|Km ukupno/future|LR future|Deload/taper|Workmin future|Focus|
|---:|---|---|---:|---|---:|---|
|7|2026-11-23|54.2/22.3|14.1|False/False|0||
|8|2026-11-30|48.8/48.8|14.9|False/False|2.25|Fartlek|
|9|2026-12-07|50.3/50.3|15.7|False/False|16.75|Piramida + Tempo isprekidan|
|10|2026-12-14|36.6/36.6|11.6|True/False|0|DELOAD — obim dole, ostaje kratka oštrina|
|11|2026-12-21|52.8/52.8|16.6|False/False|20.96|Intervali + Tempo isprekidan|
|12|2026-12-28|54.3/54.3|16.6|False/False|19.59|Fartlek + Tempo|
|13|2027-01-04|56.5/56.5|16.6|False/False|23.51|Intervali + Tempo isprekidan|
|14|2027-01-11|54.2/54.2|16.6|False/False|21.49|Intervali + Tempo|
|15|2027-01-18|34.1/34.1|9.9|False/True|14.15|Taper · Trkački ritam + Tempo|
|16|2027-01-25|15.5/15.5|0|False/False|2.43|TRKA|

Datirane sesije/strides i desc neusaglašenosti iz rezultata:

- 2026-11-30 g8d1: 10.9 km lako (Z2) @ ~5:16/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-01 g8d2: Fartlek — 2 km zagrevanje + 3×45 s brzo @ ~4:23/km (90 s laganog trčanja) + 1.5 km hlađenje · Uvod u kvalitet: kontrolisane deonice, bez sprinta, uz lagan oporavak. · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-07 g9d1: 11.9 km lako (Z2) @ ~5:16/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-08 g9d2: Piramida — 2 km zagrevanje + 200-400-600-400-200 m @ 3:57/km (1:47 min hoda između ponavljanja) + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-11 g9d5: Tempo isprekidan — 2 km zagrevanje + 2×1100 m @ 4:23/km (1:30 min laganog trčanja) + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-14 g10d1: 7.4 km lako (Z2) @ ~5:16/km + 4×15 s ubrzanja (lagani ubrzani koraci) [session=ne, strides=da].
- 2026-12-21 g11d1: 12.7 km lako (Z2) @ ~5:16/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-22 g11d2: Intervali — 2 km zagrevanje + 2×1100 m @ 3:57/km (3:16 min hoda) + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-25 g11d5: Tempo isprekidan — 2 km zagrevanje + 2×1400 m @ 4:23/km (1:30 min laganog trčanja) + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-28 g12d1: 13.3 km lako (Z2) @ ~5:16/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-29 g12d2: Fartlek — 2 km zagrevanje + 6×60 s brzo @ ~3:57/km (60 s laganog trčanja) + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-01 g12d5: Tempo — 2 km zagrevanje + 3.1 km @ 4:23/km + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-04 g13d1: 13.3 km lako (Z2) @ ~5:16/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-01-05 g13d2: Intervali — 2.5 km zagrevanje + 2×1200 m @ 3:57/km (3:33 min hoda) + 2 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-08 g13d5: Tempo isprekidan — 2.5 km zagrevanje + 2×1600 m @ 4:23/km (1:30 min laganog trčanja) + 2 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-11 g14d1: 13.3 km lako (Z2) @ ~5:16/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-01-12 g14d2: Intervali — 2 km zagrevanje + 5×600 m @ 3:57/km (1:47 min hoda) + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-15 g14d5: Tempo — 2 km zagrevanje + 2.2 km @ 4:23/km + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-19 g15d2: Trkački ritam — 1.5 km zagrevanje + 3×400 m @ 4:07/km (74 s hoda) + 1 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-22 g15d5: Tempo — 2 km zagrevanje + 2.1 km @ 4:23/km + 1.4 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-29 g16d5: Repeticije — 1.5 km zagrevanje + 3×200 m @ 4:03/km (2:02 min hoda) + 2.1 km hlađenje [session=da, strides=ne].
- 2027-01-31 g16d7: 🏁 TRKA 5 km (5K) — željeni cilj 18:59 · preporučeni ritam 4:07/km (oko 20:35, prema unetom rezultatu) · Spremnost nije potvrđena: ovaj ritam je referenca iz rezultata, ne potvrda završetka distance ili ostvarenja cilja. [session=ne, strides=ne].


## U04 — appropriate_return_with_text_fixes

Event: {"confirmedBreakFrom": "2026-11-19", "confirmedBreakThrough": "2026-11-25", "cutoffInclusive": "2026-11-25", "lastRun": "2026-11-18", "history": "All eligible scheduled runs from start through cutoff explicitly recorded; before break actual km vary by -0.1/+0.1 km on Monday/Friday; last seven days explicitly skipped.", "reportedPreBreakBaseKm": 30, "reportedRepeatableLongRunKm": 9.2, "kind": "return"}

Actual outcome: {"recommendation": {"kind": "return", "reason": "Dnevnik nema novije trčanje. Potvrdi da li si pravio pauzu ili trenirao bez upisa.", "actionable": false, "requiresConfirmation": true, "breakDays": 7, "weeklyKm": 25.9, "recentLongRunKm": 9.2, "reasons": []}, "resultPresent": true, "summary": "Povratak posle 7 dana pauze, baza 25.5 km", "executionAdjustment": {"date": "2026-11-25", "breakDays": 7, "reportedBaseKm": 30, "startingKm": 25.5}, "preparation": {"endurance": "limited", "goalStatus": "needs-speed-improvement", "peakLongRunKm": 10.7, "peakWeeklyKm": 32.2, "demandingDaysMax": 2, "reasons": ["Isporučeni vrhunac 32.2 km/ned je ispod okvirne baze za pun vremenski pristup (40 km/ned).", "Nema potvrđenog kontinuiteta od najmanje osam nedelja; izdržljivost se ne zaključuje samo iz PB-a.", "Referentni rezultat nije potvrđena skorašnja forma u trenutnoj pripremi; tempo proveri novim rezultatom ili kontrolisanim treningom."], "forecastBasis": "result-and-delivered-preparation"}}

Preservation — nezavisno poređenje: {"primary": {"comparisonAvailable": true, "changedDays": 38, "pastEffectiveDayChanges": [], "completedDayChanges": [], "manualOverrideOrAltChanges": [], "lockedPredictionRowChanges": [], "calendarIdsStable": true, "raceDateStable": true, "runDaysStable": true, "trainingVdotBefore": 38.3, "trainingVdotAfter": 38.3, "goalBefore": 3000, "goalAfter": 3000}, "seededProtection": {"comparisonAvailable": true, "changedDays": 35, "pastEffectiveDayChanges": [], "completedDayChanges": [], "manualOverrideOrAltChanges": [], "lockedPredictionRowChanges": [], "calendarIdsStable": true, "raceDateStable": true, "runDaysStable": true, "trainingVdotBefore": 38.3, "trainingVdotAfter": 38.3, "goalBefore": 3000, "goalAfter": 3000}}

**trainingStructure:** Potvrđeno 7 dana pauze; prijavljena baza 30 km/LR 9.2 daje 25.5 km/LR 7.8. Prve dve povratne kalendarske nedelje strukturno lake.

**dose:** Prvi novi kvalitet 2026-12-09:3×45sT. Kasniji RP 2×1000 m sa 3:53 hoda je blag, ali slabo gust za 10K izdržljivost.

**recovery:** Nema nadoknade. Deload 2026-12-14, taper 2027-01-18. Istorijski kvalitet u mešanoj N 7 je sačuvan namerno i nije novi povratni rad.

**coherence:** Uklonjeni strides/session nisu svuda uklonjeni iz desc/naslova.

**Potvrđeni defects:**

- 2026-11-27 g7d5 (confirmed_text_defect): očekivano Opis samo lakog povratnog trčanja; stvarno desc 4.8 km+6×20s strides;strides nema.
- 2026-11-30 N8 (confirmed_text_defect): očekivano Naslov i opis prema lakoj nedelji; stvarno focusFartlek bez session;D 1descstrides iako nema polja.

**Trenerske zamerke:**

- 2027-01-13 g14d3 (coaching_concern): očekivano Objasniti/razvijati 10K specifični kontinuitet prema toleranciji; stvarno 2×1000 m @5:11/km,3:53 hoda.

**Datirani primeri:**

- 2026-11-29 g7d7 (observed_outcome): očekivano Smanjena povratna dužina; stvarno LR 7.8 km prema prijavljenih 9.2 km.

### Svaka buduća nedelja — primary

Ukupan km uključuje sačuvane ranije dane u mešanoj nedelji; futureKm je samo posle cutoff-a. Trka ulazi u km, ali nije taper trening. Workmin je samo session rad, bez strides; progresivna poslednja trećina računa se kao kvalitet.

|N|Početak|Km ukupno/future|LR future|Deload/taper|Workmin future|Focus|
|---:|---|---|---:|---|---:|---|
|7|2026-11-23|28.9/12.6|7.8|False/False|0|Baza — aerobni obim, bez kvaliteta|
|8|2026-11-30|26.4/26.4|8.2|False/False|0|Fartlek|
|9|2026-12-07|27.6/27.6|8.6|False/False|2.25|Fartlek|
|10|2026-12-14|20.0/20.0|6.4|True/False|0|DELOAD — obim dole, ostaje kratka oštrina|
|11|2026-12-21|29.7/29.7|9.1|False/False|13.7|Intervali + Tempo|
|12|2026-12-28|30.7/30.7|9.6|False/False|12.97|Intervali + Tempo isprekidan|
|13|2027-01-04|32.2/32.2|10.1|False/False|17.59|Fartlek + Tempo|
|14|2027-01-11|31.6/31.6|10.7|False/False|18.62|Trkački ritam + Progresivno|
|15|2027-01-18|20.5/20.5|6.9|False/True|6.22|Taper · Trkački ritam|
|16|2027-01-25|17.5/17.5|0|False/False|0|TRKA|

Datirane sesije/strides i desc neusaglašenosti iz rezultata:

- 2026-11-27 g7d5: 4.8 km lako (Z2) @ ~6:20/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=ne].
- 2026-11-30 g8d1: 6.2 km lako (Z2) @ ~6:20/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=ne].
- 2026-12-07 g9d1: 6.6 km lako (Z2) @ ~6:20/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-09 g9d3: Fartlek — 2.9 km zagrevanje + 3×45 s brzo @ ~5:16/km (90 s laganog trčanja) + 2.5 km hlađenje · Uvod u kvalitet: kontrolisane deonice, bez sprinta, uz lagan oporavak. · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-14 g10d1: 5.1 km lako (Z2) @ ~6:20/km + 4×15 s ubrzanja (lagani ubrzani koraci) [session=ne, strides=da].
- 2026-12-21 g11d1: 7.3 km lako (Z2) @ ~6:20/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-23 g11d3: Intervali — 2.8 km zagrevanje + 2×500 m @ 4:45/km (1:47 min hoda) + 2.4 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-25 g11d5: Tempo — 2.8 km zagrevanje + 1.7 km @ 5:16/km + 2.4 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-28 g12d1: 7.3 km lako (Z2) @ ~6:20/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-30 g12d3: Intervali — 2.9 km zagrevanje + 2×700 m @ 4:45/km (2:30 min hoda) + 2.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-01 g12d5: Tempo isprekidan — 2.9 km zagrevanje + 2×600 m @ 5:16/km (1:30 min laganog trčanja) + 2.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-04 g13d1: 7.7 km lako (Z2) @ ~6:20/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-01-06 g13d3: Fartlek — 2.7 km zagrevanje + 4×90 s brzo @ ~4:45/km (90 s laganog trčanja) + 2.3 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-08 g13d5: Tempo — 2.7 km zagrevanje + 2.2 km @ 5:16/km + 2.3 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-11 g14d1: 8.1 km lako (Z2) @ ~6:20/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-01-13 g14d3: Trkački ritam — 3.2 km zagrevanje + 2×1000 m @ 5:11/km (3:53 min hoda) + 2.7 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-15 g14d5: Progresivno — 4.7 km: prve dve trećine @ ~6:20/km → poslednja trećina @ 5:16/km · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-20 g15d3: Trkački ritam — 1 km zagrevanje + 2×600 m @ 5:11/km (2:20 min hoda) + 0.8 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-31 g16d7: 🏁 TRKA 10 km (10K) — željeni cilj 50:00 · preporučeni ritam 5:11/km (oko 51:50, prema unetom rezultatu) · Spremnost nije potvrđena: ovaj ritam je referenca iz rezultata, ne potvrda završetka distance ili ostvarenja cilja. [session=ne, strides=ne].


## U05 — new_preservation_pass_old_protected_defects

Event: {"kind": "goal-change", "from": 2520, "to": 2400, "today": "2026-11-25"}

Actual outcome: {"old": {"recommendation": null, "error": null, "goalChange": {"week": 7, "from": 2520, "to": 2400, "changedWeeks": 10}}, "new": {"recommendation": null, "error": null, "goalChange": {"week": 7, "from": 2520, "to": 2400, "changedWeeks": 1}}}

Preservation — nezavisno poređenje: {"old": {"comparisonAvailable": true, "changedDays": 1, "pastEffectiveDayChanges": [], "completedDayChanges": [], "manualOverrideOrAltChanges": [], "lockedPredictionRowChanges": [], "calendarIdsStable": true, "raceDateStable": true, "runDaysStable": true, "trainingVdotBefore": 45.3, "trainingVdotAfter": 45.3, "goalBefore": 2520, "goalAfter": 2400}, "oldSeededProtection": {"comparisonAvailable": true, "changedDays": 6, "pastEffectiveDayChanges": ["g7d7"], "completedDayChanges": ["g7d2", "g7d5"], "manualOverrideOrAltChanges": ["g9d2"], "lockedPredictionRowChanges": ["g10_16"], "calendarIdsStable": true, "raceDateStable": true, "runDaysStable": true, "trainingVdotBefore": 45.3, "trainingVdotAfter": 45.3, "goalBefore": 2520, "goalAfter": 2400}, "new": {"comparisonAvailable": true, "changedDays": 1, "pastEffectiveDayChanges": [], "completedDayChanges": [], "manualOverrideOrAltChanges": [], "lockedPredictionRowChanges": [], "calendarIdsStable": true, "raceDateStable": true, "runDaysStable": true, "trainingVdotBefore": 45.3, "trainingVdotAfter": 45.3, "goalBefore": 2520, "goalAfter": 2400}, "newSeededProtection": {"comparisonAvailable": true, "changedDays": 1, "pastEffectiveDayChanges": [], "completedDayChanges": [], "manualOverrideOrAltChanges": [], "lockedPredictionRowChanges": [], "calendarIdsStable": true, "raceDateStable": true, "runDaysStable": true, "trainingVdotBefore": 45.3, "trainingVdotAfter": 45.3, "goalBefore": 2520, "goalAfter": 2400}}

**trainingStructure:** Želja 42:00→40:00 bez novog rezultata ne ubrzava trening. U primarnom slučaju oba izlaza menjaju samo tekst trke.

**dose:** Sesije, kilometri i tempo ostaju. Prethodne trenerske zamerke I/RP dozi current plana ostaju početna ocena, ne nova greška događaja.

**recovery:** Primarni deload/taper i raspored ostaju netaknuti.

**coherence:** new jasno razdvaja želju 40:00 i referencu 45:00. old primarni changedWeeks 10 naspram jedne promenjene dnevne stavke nije precizan opis. Seeded old vraća protected dane ka generatoru;new čuva.

**Potvrđeni defects:**

- 2026-11-24 g7d7 (confirmed_old_preservation_defect): očekivano Sačuvati pomereni prošli dan i prethodnu adaptaciju; stvarno Seeded old 18.8→18.4 km;new 18.9 ostaje 18.9.
- 2026-11-29 g7d2 (confirmed_old_preservation_defect): očekivano Sačuvati već odrađen dan pomeren u budućnost; stvarno Seeded old 251→249 s/km;new 251 ostaje 251.
- 2026-12-08 g9d2 (confirmed_old_preservation_defect): očekivano Sačuvati ručni override; stvarno Seeded old Oštrina 5.1 km→Piramida 10.7 km;new Oštrina 5.1 ostaje.
- 2026-12-15 g10d2 (confirmed_old_preservation_defect): očekivano Sačuvati measured-lock session i red; stvarno Seeded old 253→249 s/km i zaključani red promenjen;new 253/red ostaju.
- 2027-01-31 g16d7 (confirmed_old_text_defect): očekivano Odvojiti želju i referentno vreme; stvarno old cilj 40:00/ritam 4:30 daje 45:00;new eksplicitno želja 40:00 i oko 45:00.

**Trenerske zamerke:**

Nijedan u ovom pregledu.


**Datirani primeri:**

- 2027-01-31 g16d7 (observed_outcome): očekivano Ne izmišljati formu iz želje; stvarno new VDOT 45.3,predictedSec 2700,racePace 270;goalSec 2400.

### Svaka buduća nedelja — old

Ukupan km uključuje sačuvane ranije dane u mešanoj nedelji; futureKm je samo posle cutoff-a. Trka ulazi u km, ali nije taper trening. Workmin je samo session rad, bez strides; progresivna poslednja trećina računa se kao kvalitet.

|N|Početak|Km ukupno/future|LR future|Deload/taper|Workmin future|Focus|
|---:|---|---|---:|---|---:|---|
|7|2026-11-23|60.9/29.6|18.4|False/False|27.6|Intervali + Tempo isprekidan|
|8|2026-11-30|45.7/45.7|13.7|True/False|4.8|DELOAD — obim dole, ostaje kratka oštrina|
|9|2026-12-07|62.3/62.3|18.5|False/False|42.54|Piramida + Tempo isprekidan|
|10|2026-12-14|66.3/66.3|18.5|False/False|41.34|Fartlek + Tempo|
|11|2026-12-21|65.6/65.6|18.5|False/False|42.54|Intervali + Tempo isprekidan|
|12|2026-12-28|49.3/49.3|14.9|True/False|4.8|DELOAD — obim dole, ostaje kratka oštrina|
|13|2027-01-04|64.0/64.0|18.5|False/False|46.01|Trkački ritam + Progresivno|
|14|2027-01-11|64.4/64.4|18.5|False/False|46.44|Trkački ritam + Tempo|
|15|2027-01-18|43.2/43.2|12|False/True|26.5|Taper · Trkački ritam + Tempo|
|16|2027-01-25|20.5/20.5|0|False/False|4.43|TRKA|

Datirane sesije/strides i desc neusaglašenosti iz rezultata:

- 2026-11-27 g7d5: Tempo isprekidan — 2.6 km zagrevanje + 3×2000 m @ 4:36/km (1:30 min laganog trčanja) + 2.1 km hlađenje [session=da, strides=ne].
- 2026-11-30 g8d1: 9.6 km lako (Z2) @ ~5:32/km + 4×15 s ubrzanja (lagani ubrzani koraci) [session=ne, strides=da].
- 2026-12-01 g8d2: Oštrina — 2.5 km zagrevanje + 6×200 m @ 4:00/km (2 min hoda) + 2.1 km hlađenje [session=da, strides=ne].
- 2026-12-07 g9d1: 9.6 km lako (Z2) @ ~5:32/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-08 g9d2: Piramida — 3.5 km zagrevanje + 400-800-1200-800-400 m @ 4:09/km (3:44 min hoda između ponavljanja) + 3 km hlađenje [session=da, strides=ne].
- 2026-12-11 g9d5: Tempo isprekidan — 3.5 km zagrevanje + 3×2000 m @ 4:36/km (1:30 min laganog trčanja) + 3 km hlađenje [session=da, strides=ne].
- 2026-12-14 g10d1: 12 km lako (Z2) @ ~5:32/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-15 g10d2: Fartlek — 3.5 km zagrevanje + 11×90 s brzo @ ~4:09/km (90 s laganog trčanja) + 3 km hlađenje [session=da, strides=ne].
- 2026-12-18 g10d5: Tempo — 3.5 km zagrevanje + 5.4 km @ 4:36/km + 3 km hlađenje [session=da, strides=ne].
- 2026-12-21 g11d1: 12 km lako (Z2) @ ~5:32/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-22 g11d2: Intervali — 3.5 km zagrevanje + 3×1200 m @ 4:09/km (3:44 min hoda) + 4.2 km hlađenje [session=da, strides=ne].
- 2026-12-25 g11d5: Tempo isprekidan — 3.5 km zagrevanje + 3×2000 m @ 4:36/km (1:30 min laganog trčanja) + 3 km hlađenje [session=da, strides=ne].
- 2026-12-28 g12d1: 10.3 km lako (Z2) @ ~5:32/km + 4×15 s ubrzanja (lagani ubrzani koraci) [session=ne, strides=da].
- 2026-12-29 g12d2: Oštrina — 2.7 km zagrevanje + 6×200 m @ 4:00/km (2 min hoda) + 2.4 km hlađenje [session=da, strides=ne].
- 2027-01-04 g13d1: 10.4 km lako (Z2) @ ~5:32/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-01-05 g13d2: Trkački ritam — 3.1 km zagrevanje + 5×1200 m @ 4:30/km (1 min hoda) + 2.6 km hlađenje [session=da, strides=ne].
- 2027-01-08 g13d5: Progresivno — 12.4 km: prve dve trećine @ ~5:32/km → poslednja trećina @ 4:36/km [session=da, strides=ne].
- 2027-01-11 g14d1: 12 km lako (Z2) @ ~5:32/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-01-12 g14d2: Trkački ritam — 3.5 km zagrevanje + 3×1600 m @ 4:30/km (75 s hoda) + 3 km hlađenje [session=da, strides=ne].
- 2027-01-15 g14d5: Tempo — 3.5 km zagrevanje + 5.4 km @ 4:36/km + 3 km hlađenje [session=da, strides=ne].
- 2027-01-19 g15d2: Trkački ritam — 1.6 km zagrevanje + 3×600 m @ 4:30/km (75 s hoda) + 1.2 km hlađenje [session=da, strides=ne].
- 2027-01-22 g15d5: Tempo — 2 km zagrevanje + 4 km @ 4:36/km + 1.5 km hlađenje [session=da, strides=ne].
- 2027-01-29 g16d5: Repeticije — 1.5 km zagrevanje + 5×200 m @ 4:26/km (2:13 min hoda) + 1.4 km hlađenje [session=da, strides=ne].
- 2027-01-31 g16d7: 🏁 TRKA 10 km (10K) — cilj 40:00 / ritam 4:30/km [session=ne, strides=ne].

### Svaka buduća nedelja — new

Ukupan km uključuje sačuvane ranije dane u mešanoj nedelji; futureKm je samo posle cutoff-a. Trka ulazi u km, ali nije taper trening. Workmin je samo session rad, bez strides; progresivna poslednja trećina računa se kao kvalitet.

|N|Početak|Km ukupno/future|LR future|Deload/taper|Workmin future|Focus|
|---:|---|---|---:|---|---:|---|
|7|2026-11-23|62.1/27.8|18.5|False/False|16.56|Intervali + Tempo isprekidan|
|8|2026-11-30|46.6/46.6|13.8|True/False|0|DELOAD — obim dole, ostaje kratka oštrina|
|9|2026-12-07|65.1/65.1|18.5|False/False|29.01|Piramida + Tempo isprekidan|
|10|2026-12-14|68.2/68.2|18.5|False/False|35.58|Fartlek + Tempo|
|11|2026-12-21|65.2/65.2|18.5|False/False|28.36|Intervali + Tempo isprekidan|
|12|2026-12-28|48.9/48.9|13.2|True/False|0|DELOAD — obim dole, ostaje kratka oštrina|
|13|2027-01-04|65.6/65.6|18.5|False/False|34.29|Trkački ritam + Progresivno|
|14|2027-01-11|65.9/65.9|18.5|False/False|36.48|Trkački ritam + Tempo|
|15|2027-01-18|40.9/40.9|12|False/True|20.58|Taper · Trkački ritam + Tempo|
|16|2027-01-25|20.5/20.5|0|False/False|4.43|TRKA|

Datirane sesije/strides i desc neusaglašenosti iz rezultata:

- 2026-11-27 g7d5: Tempo isprekidan — 3 km zagrevanje + 2×1800 m @ 4:36/km (1:30 min laganog trčanja) + 2.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-11-30 g8d1: 9.7 km lako (Z2) @ ~5:32/km + 4×15 s ubrzanja (lagani ubrzani koraci) [session=ne, strides=da].
- 2026-12-07 g9d1: 14 km lako (Z2) @ ~5:32/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-08 g9d2: Piramida — 3.5 km zagrevanje + 300-700-1000-700-300 m @ 4:09/km (3:07 min hoda između ponavljanja) + 3 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-11 g9d5: Tempo isprekidan — 3.5 km zagrevanje + 2×1800 m @ 4:36/km (1:30 min laganog trčanja) + 3 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-14 g10d1: 14 km lako (Z2) @ ~5:32/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-15 g10d2: Fartlek — 3.5 km zagrevanje + 9×90 s brzo @ ~4:09/km (90 s laganog trčanja) + 3 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-18 g10d5: Tempo — 3.5 km zagrevanje + 4.8 km @ 4:36/km + 3 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-21 g11d1: 14 km lako (Z2) @ ~5:32/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-22 g11d2: Intervali — 3.5 km zagrevanje + 2×1200 m @ 4:09/km (3:44 min hoda) + 3.8 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-25 g11d5: Tempo isprekidan — 3.5 km zagrevanje + 2×2000 m @ 4:36/km (1:30 min laganog trčanja) + 3 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-28 g12d1: 10.5 km lako (Z2) @ ~5:32/km + 4×15 s ubrzanja (lagani ubrzani koraci) [session=ne, strides=da].
- 2027-01-04 g13d1: 14 km lako (Z2) @ ~5:32/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-01-05 g13d2: Trkački ritam — 2.9 km zagrevanje + 3×1200 m @ 4:30/km (4 min hoda) + 2.4 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-08 g13d5: Progresivno — 11.8 km: prve dve trećine @ ~5:32/km → poslednja trećina @ 4:36/km · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-11 g14d1: 14 km lako (Z2) @ ~5:32/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-01-12 g14d2: Trkački ritam — 3.5 km zagrevanje + 2×1600 m @ 4:30/km (4 min hoda) + 3 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-15 g14d5: Tempo — 3.5 km zagrevanje + 4.8 km @ 4:36/km + 3 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-19 g15d2: Trkački ritam — 1.6 km zagrevanje + 2×600 m @ 4:30/km (2:02 min hoda) + 1.2 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-22 g15d5: Tempo — 2 km zagrevanje + 3.3 km @ 4:36/km + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-29 g16d5: Repeticije — 1.5 km zagrevanje + 5×200 m @ 4:26/km (2:13 min hoda) + 1.4 km hlađenje [session=da, strides=ne].
- 2027-01-31 g16d7: 🏁 TRKA 10 km (10K) — željeni cilj 40:00 · preporučeni ritam 4:30/km (oko 45:00, prema unetom rezultatu) [session=ne, strides=ne].


## U06 — return_only_not_10k_ready

Event: {"confirmedBreakFrom": "2026-10-29", "confirmedBreakThrough": "2026-11-25", "lastActualRun": "2026-10-28", "reportedPreBreakBaseKm": 15, "reportedRepeatableLongRunKm": 4, "history": "Every eligible running slot is explicitly recorded: prescribed distance actually completed through October 28, explicitly skipped October 29 through November 25. Synthetic observations, not assumed actual user history.", "kind": "return"}

Actual outcome: {"recommendation": {"kind": "return", "reason": "Dnevnik nema novije trčanje. Potvrdi da li si pravio pauzu ili trenirao bez upisa.", "actionable": false, "requiresConfirmation": true, "breakDays": 28, "reasons": ["Poslednja pokrivena nedelja bez trčanja prekida oslonac na raniji veći obim.", "Najmanje dve pokrivene pune nedelje imaju manje od 80% planiranih kilometara."]}, "resultPresent": true, "summary": "Povratak posle 28 dana pauze, baza 8.3 km", "executionAdjustment": {"date": "2026-11-25", "breakDays": 28, "reportedBaseKm": 15, "startingKm": 8.3}, "preparation": {"endurance": "limited", "goalStatus": "endurance-limited", "peakLongRunKm": 4, "peakWeeklyKm": 10.1, "demandingDaysMax": 0, "reasons": ["Isporučeni vrhunac 10.1 km/ned je ispod okvirne baze za pun vremenski pristup (40 km/ned).", "Nema potvrđenog kontinuiteta od najmanje osam nedelja; izdržljivost se ne zaključuje samo iz PB-a.", "Referentni rezultat nije potvrđena skorašnja forma u trenutnoj pripremi; tempo proveri novim rezultatom ili kontrolisanim treningom."], "forecastBasis": "result-and-delivered-preparation"}}

Preservation — nezavisno poređenje: {"primary": {"comparisonAvailable": true, "changedDays": 26, "pastEffectiveDayChanges": [], "completedDayChanges": [], "manualOverrideOrAltChanges": [], "lockedPredictionRowChanges": [], "calendarIdsStable": true, "raceDateStable": true, "runDaysStable": true, "trainingVdotBefore": 35, "trainingVdotAfter": 35, "goalBefore": 3600, "goalAfter": 3600}}

**trainingStructure:** Nova potvrđena pauza 28 dana posle ranije velike pauze. Baza 15→8.3 km,LR 4→2.2. Prve četiri povratne kalendarske nedelje strukturno lake.

**dose:** Budući vrh 10.1 km/LR 4 km. TaperRP 2×600 m nije dokaz 60 minuta kontinuiranog 10K trčanja.

**recovery:** Konzervativan povratak ima smisla. Paces iz PB starog 410 dana treba proveriti prema toleranciji; nema novog potvrđenog rezultata.

**coherence:** Desc ubrzanja ostaje posle uklanjanja polja; kasniji Fartlek/Tempo/Progresivno naslovi nemaju odgovarajuće session objekte.

**Potvrđeni defects:**

- 2026-11-30 g8d1 (confirmed_text_defect): očekivano Opis bez uklonjenih strides; stvarno desc 6×20s strides;polje nema.
- 2026-12-14 g10d1 (confirmed_text_defect): očekivano Opis bez strides u lakom povratku; stvarno desc 4×15s strides;polje nema.
- 2027-01-04 N13 (confirmed_text_defect): očekivano Naslov prema stvarnom radu; stvarno focusTempo; sva trčanja lako/LR bez session.

**Trenerske zamerke:**

- 2027-01-17 g14d7 (coaching_concern): očekivano Trku usloviti dokazom dužinske tolerancije ili produženjem pripreme; stvarno Vrh LR 4 km;2027-01-31 trka 10 km uz upozorenje.

**Datirani primeri:**

- 2026-11-29 g7d7 (observed_outcome): očekivano Smanjiti prvo novo dugo trčanje; stvarno 2.5 km lako-dugo;sledeća puna nedelja 7.5 km.

### Svaka buduća nedelja — primary

Ukupan km uključuje sačuvane ranije dane u mešanoj nedelji; futureKm je samo posle cutoff-a. Trka ulazi u km, ali nije taper trening. Workmin je samo session rad, bez strides; progresivna poslednja trećina računa se kao kvalitet.

|N|Početak|Km ukupno/future|LR future|Deload/taper|Workmin future|Focus|
|---:|---|---|---:|---|---:|---|
|7|2026-11-23|11.0/2.5|2.5|False/False|0|Baza — aerobni obim, bez kvaliteta|
|8|2026-11-30|7.5/7.5|2.9|False/False|0|Baza — aerobni obim, bez kvaliteta|
|9|2026-12-07|8.0/8.0|3|False/False|0|Fartlek|
|10|2026-12-14|6.8/6.8|2.6|True/False|0|DELOAD — obim dole, ostaje kratka oštrina|
|11|2026-12-21|8.4/8.4|3.1|False/False|0|Fartlek|
|12|2026-12-28|8.9/8.9|3.3|False/False|0|Fartlek|
|13|2027-01-04|9.5/9.5|3.5|False/False|0|Tempo|
|14|2027-01-11|10.1/10.1|4|False/False|0|Progresivno|
|15|2027-01-18|9.3/9.3|3.4|False/True|7.2|Taper · Trkački ritam|
|16|2027-01-25|12.4/12.4|0|False/False|0|TRKA|

Datirane sesije/strides i desc neusaglašenosti iz rezultata:

- 2026-11-30 g8d1: 2.2 km lako (Z2) @ ~6:47/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=ne].
- 2026-12-14 g10d1: 2.1 km lako (Z2) @ ~6:47/km + 4×15 s ubrzanja (lagani ubrzani koraci) [session=ne, strides=ne].
- 2027-01-20 g15d3: Trkački ritam — 1 km zagrevanje + 2×600 m @ 6:00/km (2:42 min hoda) + 0.8 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-31 g16d7: 🏁 TRKA 10 km (10K) — željeni cilj 1:00:00 · preporučeni ritam 6:00/km (oko 1:00:00, prema unetom rezultatu i izabranom cilju) · Spremnost nije potvrđena: ovaj ritam je referenca iz rezultata, ne potvrda završetka distance ili ostvarenja cilja. [session=ne, strides=ne].


## U07 — appropriate_reduction_not_hm_ready

Event: {"kind": "underexecution", "fraction": 0.6, "fullRecentWeeks": ["2026-11-09/2026-11-15", "2026-11-16/2026-11-22"], "history": "Every eligible run from start through today explicitly completed with actual km/runDate/ts/RPE. W1-W4 at 100% prescription; W5/W6 and W7 through today at 60%. No missing logs, inferred skip, or confirmed break."}

Actual outcome: {"recommendation": {"kind": "reduce", "reason": "Ponovljeni propušteni, preteški laki treninzi ili manji odrađeni obim opravdavaju pregled opterećenja.", "actionable": true, "requiresConfirmation": true, "weeklyKm": 25.7, "recentLongRunKm": 8.7, "reasons": ["Najmanje dve pokrivene pune nedelje imaju manje od 80% planiranih kilometara."]}, "resultPresent": true, "summary": "Plan prema odrađenoj bazi 25.7 km", "executionAdjustment": {"date": "2026-11-25", "breakDays": 0, "reportedBaseKm": 25.7, "startingKm": 25.7}, "preparation": {"endurance": "limited", "goalStatus": "needs-speed-improvement", "peakLongRunKm": 11.4, "peakWeeklyKm": 36, "demandingDaysMax": 2, "reasons": ["Najduže planirano trčanje je 11.4 km; ovaj plan ima ograničenu dužinsku pripremu za polumaraton. Promeni raspoložive dane, polaznu bazu ili datum trke pre vremenskog cilja.", "Isporučeni vrhunac 36 km/ned je ispod okvirne baze za pun vremenski pristup (45 km/ned).", "Nema potvrđenog kontinuiteta od najmanje osam nedelja; izdržljivost se ne zaključuje samo iz PB-a.", "Nema dovoljno ponovljenih dužih izlaganja da jedna najveća dužina potvrdi pripremu."], "forecastBasis": "result-and-delivered-preparation"}}

Preservation — nezavisno poređenje: {"primary": {"comparisonAvailable": true, "changedDays": 38, "pastEffectiveDayChanges": [], "completedDayChanges": [], "manualOverrideOrAltChanges": [], "lockedPredictionRowChanges": [], "calendarIdsStable": true, "raceDateStable": true, "runDaysStable": true, "trainingVdotBefore": 40.7, "trainingVdotAfter": 40.7, "goalBefore": 6300, "goalAfter": 6300}, "seededProtection": {"comparisonAvailable": true, "changedDays": 34, "pastEffectiveDayChanges": [], "completedDayChanges": [], "manualOverrideOrAltChanges": [], "lockedPredictionRowChanges": [], "calendarIdsStable": true, "raceDateStable": true, "runDaysStable": true, "trainingVdotBefore": 40.7, "trainingVdotAfter": 40.7, "goalBefore": 6300, "goalAfter": 6300}}

**trainingStructure:** Sve sesije upisane;dve pune nedelje i deo tekuće na 60%. Nema potvrđene pauze. Baza 25.7 km/LR 8.7,bez ubrzavanja.

**dose:** Budući vrh 36 km/LR 11.4 km. Kontrola 5 km naHMP je uvežbavanje, nije test HM izdržljivosti.

**recovery:** NajbližiT uklonjen,prva puna nedelja 27.6 km,deload 22.5 km. Proveriti razlog 60% izvršenja i toleranciju.

**coherence:** Ograničena priprema je pošteno navedena. Povratak posle pauze i naslovi uklonjenog kvaliteta ne odgovaraju događaju.

**Potvrđeni defects:**

- 2026-11-30 g8d1 (confirmed_text_defect): očekivano Opis smanjenog izvršenja bez pauze; stvarno Postepen povratak posle pauze;lastRun 2026-11-25,nema skip-a.
- 2026-12-07 N9 (confirmed_text_defect): očekivano Naslov prema isporučenim sesijama; stvarno focusTempo isprekidan;sessionnijedan.

**Trenerske zamerke:**

- 2027-01-10 g13d7 (coaching_concern): očekivano Ne potvrditi 1:45 HM bez dužinske tolerancije; stvarno LRvrh 11.4 km;2027-01-31 ostaje 21.0975 km sa upozorenjem.
- 2027-01-06 g13d3 (coaching_concern): očekivano Objasniti HMP gustinu i razviti prema toleranciji; stvarno 2×1400 m @5:11/km sa 5:26 lagano;14.51 min rada.

**Datirani primeri:**

- 2026-11-27 g7d5 (observed_outcome): očekivano Ukloniti najbliži kvalitet; stvarno T 2×1400 m→6.1 km lako.

### Svaka buduća nedelja — primary

Ukupan km uključuje sačuvane ranije dane u mešanoj nedelji; futureKm je samo posle cutoff-a. Trka ulazi u km, ali nije taper trening. Workmin je samo session rad, bez strides; progresivna poslednja trećina računa se kao kvalitet.

|N|Početak|Km ukupno/future|LR future|Deload/taper|Workmin future|Focus|
|---:|---|---|---:|---|---:|---|
|7|2026-11-23|33.7/14.8|8.7|False/False|0||
|8|2026-11-30|27.6/27.6|8.9|False/False|0|Fartlek|
|9|2026-12-07|29.7/29.7|9.6|False/False|0|Tempo isprekidan|
|10|2026-12-14|22.5/22.5|7.2|True/False|0|DELOAD — obim dole, ostaje kratka oštrina|
|11|2026-12-21|32.1/32.1|10.2|False/False|6.02|Tempo isprekidan|
|12|2026-12-28|33.7/33.7|10.8|False/False|25.92|Kontrolna trka|
|13|2027-01-04|36.0/36.0|11.4|False/False|26.55|Tempo trke + Tempo|
|14|2027-01-11|28.9/28.9|9.6|False/True|10.54|Taper · Tempo|
|15|2027-01-18|21.8/21.8|7.4|False/True|8.29|Taper · Tempo trke|
|16|2027-01-25|31.098/31.098|0|False/False|6.14|TRKA|

Datirane sesije/strides i desc neusaglašenosti iz rezultata:

- 2026-12-14 g10d1: 5.8 km lako (Z2) @ ~6:02/km + 4×15 s ubrzanja (lagani ubrzani koraci) [session=ne, strides=da].
- 2026-12-21 g11d1: 8.1 km lako (Z2) @ ~6:02/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-23 g11d3: Tempo isprekidan — 2.9 km zagrevanje + 2×600 m @ 5:01/km (1 min laganog trčanja) + 2.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-28 g12d1: 8 km lako (Z2) @ ~6:02/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-30 g12d3: Kontrolna trka — 1.7 km zagrevanje + 5 km @ 5:11/km + 1.2 km hlađenje · Kontrolisano na ritmu polumaratona; isprobaj opremu i gorivo. Ovo nije maksimalan test forme. Pravu trku unesi zasebno kao test. Naredna 2–3 dana lagano. [session=da, strides=ne].
- 2027-01-04 g13d1: 8.6 km lako (Z2) @ ~6:02/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-01-06 g13d3: Tempo trke — 2.7 km zagrevanje + 2×1400 m @ 5:11/km (5:26 min laganog trčanja) + 2.3 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-08 g13d5: Tempo — 2.7 km zagrevanje + 2.4 km @ 5:01/km + 2.3 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-11 g14d1: 7.7 km lako (Z2) @ ~6:02/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-01-13 g14d3: Tempo — 1.6 km zagrevanje + 2.1 km @ 5:01/km + 1.2 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-20 g15d3: Tempo trke — 1 km zagrevanje + 1.6 km @ 5:11/km + 0.8 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-29 g16d5: Repeticije — 1.4 km zagrevanje + 6×200 m @ 5:07/km (2:34 min hoda) + 1 km hlađenje [session=da, strides=ne].
- 2027-01-31 g16d7: 🏁 TRKA 21,1 km (Polumaraton) — željeni cilj 1:45:00 · preporučeni ritam 5:11/km (oko 1:49:21, prema unetom rezultatu) · Spremnost nije potvrđena: ovaj ritam je referenca iz rezultata, ne potvrda završetka distance ili ostvarenja cilja. [session=ne, strides=ne].


## U08 — primary_rejected_supplement_return_with_text_fixes

Event: {"label": "PRIMARY frozen event date: confirmed 14-day return, production gate respected", "today": "2026-11-25", "breakFrom": "2026-11-12", "breakThrough": "2026-11-25", "cutoffInclusive": true, "confirmedBreakDays": 14, "reportedBaseBasis": "Frozen synthetic profile reports 55 km/week, 16 km repeatable long run and 24 consistent weeks before the interruption. Actual completed prescribed sessions have explicit km with -0.2 km Monday/+0.1 km Friday variation; no running during interruption, eligible slots explicitly skipped.", "remainingDays": 53, "newCycleCalendarWeeks": 8, "kind": "return"}

Actual outcome: {"primary": {"date": "2026-11-25", "recommendation": {"kind": "return", "reason": "Dnevnik nema novije trčanje. Potvrdi da li si pravio pauzu ili trenirao bez upisa.", "actionable": false, "requiresConfirmation": true, "breakDays": 14, "recentLongRunKm": 13.6, "reasons": ["Poslednja pokrivena nedelja bez trčanja prekida oslonac na raniji veći obim.", "Najmanje dve pokrivene pune nedelje imaju manje od 80% planiranih kilometara."]}, "error": "Preostalo vreme ne podržava novi pun ciklus: Manje od 10 nedelja do trke (minimum za polumaraton) — puna periodizacija nije moguća. Datum trke nije automatski pomeren.", "resultPresent": false, "remainingDays": 53, "newCycleCalendarWeeks": 8, "inputHashesEqual": true}, "supplementalEarlier": {"date": "2026-10-28", "recommendation": {"kind": "return", "reason": "Dnevnik nema novije trčanje. Potvrdi da li si pravio pauzu ili trenirao bez upisa.", "actionable": false, "requiresConfirmation": true, "breakDays": 14, "recentLongRunKm": 9.9, "reasons": ["Poslednja pokrivena nedelja bez trčanja prekida oslonac na raniji veći obim.", "Najmanje dve pokrivene pune nedelje imaju manje od 80% planiranih kilometara."]}, "error": null, "resultPresent": true, "remainingDays": 81, "newCycleCalendarWeeks": 12, "inputHashesEqual": true}}

Preservation — nezavisno poređenje: {"primary": {"comparisonAvailable": false, "reason": "Nema oba eksplicitna snapshot-a ili nemaresult."}, "supplementalEarlier": {"comparisonAvailable": true, "changedDays": 54, "pastEffectiveDayChanges": [], "completedDayChanges": [], "manualOverrideOrAltChanges": [], "lockedPredictionRowChanges": [], "calendarIdsStable": true, "raceDateStable": true, "runDaysStable": true, "trainingVdotBefore": 48.2, "trainingVdotAfter": 48.2, "goalBefore": 5700, "goalAfter": 5700}}

**trainingStructure:** PRIMARY 2026-11-25 odbijen:53 dana/8 kalendarskih nedelja doHM;API traži 10 za puni novi ciklus. SUPPLEMENT 2026-10-28 je zaseban dozvoljen slučaj:12 nedelja,baza 38.5 km/LR 11.2.

**dose:** Primary nema prilagođenu dozu jer result ne postoji. Supplement vrh 49 km/LR 15.3 km je ograničena HM priprema.

**recovery:** 10 nedelja je politika aplikacije, nije univerzalna fiziološka granica. Supplement prve 3 kalendarske nedelje strukturno lake. Posle primary odbijanja potreban novi dogovor o kratkoročnom povratku i trci.

**coherence:** Primary i supplement se ne sabiraju. Supplement stale strides iFartlek naslovi nisu plan generisan na 25.novembar.

**Potvrđeni defects:**

- 2026-10-30 g3d5 (confirmed_supplemental_text_defect): očekivano SUPPLEMENT:opis čisto lakog povratka; stvarno desc 6×20s strides;polje nema.
- 2026-11-02 N4 (confirmed_supplemental_text_defect): očekivano SUPPLEMENT:naslov prema strukturi; stvarno focusFartlek bez session;D 1descstrides bez polja.

**Trenerske zamerke:**

- 2026-11-25 primary (coaching_concern): očekivano Razmotriti prilagođen kratkoročni povratak/trku posle odbijanja; stvarno API nemaresult;ovo nije novi odobren HM plan.
- 2027-01-17 g14d7 (coaching_concern): očekivano SUPPLEMENT:ne poistovetiti brzinsku referencu sa spremnošću; stvarno LRvrh 15.3 km i limitedpreparation;trka 21.0975 km.

**Datirani primeri:**

- 2026-11-25 primary (observed_outcome): očekivano Odbiti pun ciklus bez automatskog pomeranja trke; stvarno errorManje od 10 nedelja;inputHashBefore=inputHashAfter;raceDate 2027-01-17.
- 2026-10-28 supplement (observed_outcome): očekivano Zasebno označiti raniji uspešan povratak; stvarno resultpostoji;startingKm 38.5;prvi novi dan 2026-10-30.

### Svaka buduća nedelja — supplementalEarlier

Ukupan km uključuje sačuvane ranije dane u mešanoj nedelji; futureKm je samo posle cutoff-a. Trka ulazi u km, ali nije taper trening. Workmin je samo session rad, bez strides; progresivna poslednja trećina računa se kao kvalitet.

|N|Početak|Km ukupno/future|LR future|Deload/taper|Workmin future|Focus|
|---:|---|---|---:|---|---:|---|
|3|2026-10-26|49.9/17.1|11.2|False/False|0|Baza — aerobni obim, bez kvaliteta|
|4|2026-11-02|39.3/39.3|11.8|False/False|0|Fartlek|
|5|2026-11-09|40.9/40.9|12.5|False/False|0|Fartlek|
|6|2026-11-16|30.9/30.9|9.3|True/False|0|DELOAD — obim dole, ostaje kratka oštrina|
|7|2026-11-23|43.0/43.0|13.2|False/False|13.95|Intervali + Tempo|
|8|2026-11-30|44.1/44.1|13.9|False/False|14.3|Intervali + Tempo isprekidan|
|9|2026-12-07|46.1/46.1|14.7|False/False|17.84|Fartlek + Tempo|
|10|2026-12-14|34.9/34.9|11|True/False|7.01|DELOAD — obim dole, ostaje kratka oštrina|
|11|2026-12-21|49.0/49.0|15.3|False/False|31.5|Kontrolna trka|
|12|2026-12-28|40.0/40.0|13|False/True|25.31|Taper · Tempo trke + Tempo|
|13|2027-01-04|32.8/32.8|9.9|False/True|19.13|Taper · Tempo trke + Tempo|
|14|2027-01-11|30.098/30.098|0|False/False|0|TRKA|

Datirane sesije/strides i desc neusaglašenosti iz rezultata:

- 2026-10-30 g3d5: 5.9 km lako (Z2) @ ~5:16/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=ne].
- 2026-11-02 g4d1: 7.1 km lako (Z2) @ ~5:16/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=ne].
- 2026-11-09 g5d1: 7.5 km lako (Z2) @ ~5:16/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=ne].
- 2026-11-16 g6d1: 5.7 km lako (Z2) @ ~5:16/km + 4×15 s ubrzanja (lagani ubrzani koraci) [session=ne, strides=da].
- 2026-11-23 g7d1: 7.5 km lako (Z2) @ ~5:16/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-11-24 g7d2: Intervali — 2.9 km zagrevanje + 2×600 m @ 3:57/km (1:47 min hoda) + 2.4 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-11-27 g7d5: Tempo — 2.9 km zagrevanje + 2.1 km @ 4:23/km + 2.4 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-11-30 g8d1: 8.4 km lako (Z2) @ ~5:16/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-01 g8d2: Intervali — 2.6 km zagrevanje + 2×700 m @ 3:57/km (2:04 min hoda) + 2.1 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-04 g8d5: Tempo isprekidan — 2.6 km zagrevanje + 2×1000 m @ 4:23/km (1 min laganog trčanja) + 2.1 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-07 g9d1: 8.6 km lako (Z2) @ ~5:16/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-08 g9d2: Fartlek — 2.4 km zagrevanje + 3×120 s brzo @ ~3:57/km (90 s laganog trčanja) + 1.9 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-11 g9d5: Tempo — 2.4 km zagrevanje + 2.7 km @ 4:23/km + 1.9 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-14 g10d1: 6.6 km lako (Z2) @ ~5:16/km + 4×15 s ubrzanja (lagani ubrzani koraci) [session=ne, strides=da].
- 2026-12-15 g10d2: Tempo — 1.7 km zagrevanje + 1.6 km @ 4:23/km + 1.3 km hlađenje · Rasterećenje: smanjena doza poslednjeg kvalitetnog treninga, bez ubrzavanja. [session=da, strides=ne].
- 2026-12-21 g11d1: 7.3 km lako (Z2) @ ~5:16/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-22 g11d2: Kontrolna trka — 2 km zagrevanje + 7 km @ 4:30/km + 1.5 km hlađenje · Kontrolisano na ritmu polumaratona; isprobaj opremu i gorivo. Ovo nije maksimalan test forme. Pravu trku unesi zasebno kao test. Naredna 2–3 dana lagano. [session=da, strides=ne].
- 2026-12-28 g12d1: 6.3 km lako (Z2) @ ~5:16/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-29 g12d2: Tempo trke — 2 km zagrevanje + 2×1400 m @ 4:30/km (4:44 min laganog trčanja) + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-01 g12d5: Tempo — 2 km zagrevanje + 2.9 km @ 4:23/km + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-05 g13d2: Tempo trke — 1.6 km zagrevanje + 2.4 km @ 4:30/km + 1.2 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-08 g13d5: Tempo — 2 km zagrevanje + 1.9 km @ 4:23/km + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-17 g14d7: 🏁 TRKA 21,1 km (Polumaraton) — željeni cilj 1:35:00 · preporučeni ritam 4:30/km (oko 1:34:56, prema unetom rezultatu i izabranom cilju) · Spremnost nije potvrđena: ovaj ritam je referenca iz rezultata, ne potvrda završetka distance ili ostvarenja cilja. [session=ne, strides=ne].


## U09 — return_only_not_marathon_ready

Event: {"kind": "return", "breakDays": 14}

Actual outcome: {"recommendation": {"kind": "return", "reason": "Dnevnik nema novije trčanje. Potvrdi da li si pravio pauzu ili trenirao bez upisa.", "actionable": false, "requiresConfirmation": true, "breakDays": 14, "recentLongRunKm": 8.8, "reasons": ["Poslednja pokrivena nedelja bez trčanja prekida oslonac na raniji veći obim.", "Najmanje dve pokrivene pune nedelje imaju manje od 80% planiranih kilometara."]}, "resultPresent": true, "summary": "Povratak posle 14 dana pauze, baza 21 km", "executionAdjustment": {"date": "2026-11-25", "breakDays": 14, "reportedBaseKm": 30, "startingKm": 21}, "preparation": {"endurance": "limited", "goalStatus": "endurance-limited", "peakLongRunKm": 8.8, "peakWeeklyKm": 29, "demandingDaysMax": 1, "reasons": ["Najduže planirano trčanje je 8.8 km; ovaj plan ima ograničenu dužinsku pripremu za maraton. Promeni raspoložive dane, polaznu bazu ili datum trke pre vremenskog cilja.", "Isporučeni vrhunac 29 km/ned je ispod okvirne baze za pun vremenski pristup (55 km/ned).", "Nema potvrđenog kontinuiteta od najmanje osam nedelja; izdržljivost se ne zaključuje samo iz PB-a.", "Referentni rezultat nije potvrđena skorašnja forma u trenutnoj pripremi; tempo proveri novim rezultatom ili kontrolisanim treningom.", "Nema dovoljno ponovljenih dužih izlaganja da jedna najveća dužina potvrdi pripremu."], "forecastBasis": "result-and-delivered-preparation"}}

Preservation — nezavisno poređenje: {"primary": {"comparisonAvailable": true, "changedDays": 53, "pastEffectiveDayChanges": [], "completedDayChanges": [], "manualOverrideOrAltChanges": [], "lockedPredictionRowChanges": [], "calendarIdsStable": true, "raceDateStable": true, "runDaysStable": true, "trainingVdotBefore": 42.6, "trainingVdotAfter": 42.6, "goalBefore": 14400, "goalAfter": 14400}, "seededProtection": {"comparisonAvailable": true, "changedDays": 48, "pastEffectiveDayChanges": [], "completedDayChanges": [], "manualOverrideOrAltChanges": [], "lockedPredictionRowChanges": [], "calendarIdsStable": true, "raceDateStable": true, "runDaysStable": true, "trainingVdotBefore": 42.6, "trainingVdotAfter": 42.6, "goalBefore": 14400, "goalAfter": 14400}}

**trainingStructure:** 14 dana potvrđene pauze;početak 21 km/LR 7 km,3 lake povratne kalendarske nedelje. Ne tretirati ovo kao maratonsku pripremu.

**dose:** Budući vrh 29 km/LR 8.8 km. MP tek 1.8 km u taperu;nema specifične dužinske pripreme za 42.195 km.

**recovery:** Bez nadoknade,deload N 10/N 14. Seeded protected budući rad ostaje po pravilima očuvanja i zahteva ručni pregled.

**coherence:** Stale strides u čistom lakom povratku;kasniji kvalitetni naslovi prežive uklanjanje sesija. Limited readiness se eksplicitno navodi.

**Potvrđeni defects:**

- 2026-11-27 g7d5 (confirmed_text_defect): očekivano Opis bez ubrzanja u povratnom prozoru; stvarno 4.1 km+6×20s strides udesc;polje nema.
- 2026-12-07 N9 (confirmed_text_defect): očekivano Naslov prema stvarnom radu; stvarno focusFartlek bez session;D 1descstrides bez polja.

**Trenerske zamerke:**

- 2027-02-28 g20d7 (coaching_concern): očekivano Promeniti ciljnu trku/datum ili potvrditi mnogo veću toleranciju; stvarno TRKA 42.195 km posle budućegLRvrha 8.8 km 2027-02-07;upozorenje postoji.

**Datirani primeri:**

- 2026-11-29 g7d7 (observed_outcome): očekivano PovratniLR prema ranije 10 km; stvarno LR 7 km;prva puna nedelja 21.8 km.

### Svaka buduća nedelja — primary

Ukupan km uključuje sačuvane ranije dane u mešanoj nedelji; futureKm je samo posle cutoff-a. Trka ulazi u km, ali nije taper trening. Workmin je samo session rad, bez strides; progresivna poslednja trećina računa se kao kvalitet.

|N|Početak|Km ukupno/future|LR future|Deload/taper|Workmin future|Focus|
|---:|---|---|---:|---|---:|---|
|7|2026-11-23|27.8/11.1|7|False/False|0|Baza — aerobni obim, bez kvaliteta|
|8|2026-11-30|21.8/21.8|7.4|False/False|0|Fartlek|
|9|2026-12-07|22.7/22.7|6.6|False/False|0|Fartlek|
|10|2026-12-14|17.1/17.1|5.5|True/False|0|DELOAD — obim dole, ostaje kratka oštrina|
|11|2026-12-21|24.3/24.3|7.4|False/False|0|Tempo isprekidan|
|12|2026-12-28|24.2/24.2|7|False/False|5.8|Tempo isprekidan|
|13|2027-01-04|26.2/26.2|8.2|False/False|5.8|Tempo isprekidan|
|14|2027-01-11|19.1/19.1|6.1|True/False|0|DELOAD — obim dole, ostaje kratka oštrina|
|15|2027-01-18|25.1/25.1|7.3|False/False|6.99|Intervali|
|16|2027-01-25|27.0/27.0|8.5|False/False|0|Tempo isprekidan|
|17|2027-02-01|29.0/29.0|8.8|False/False|0|Tempo|
|18|2027-02-08|23.9/23.9|7.7|False/True|10.23|Taper · Maratonski tempo|
|19|2027-02-15|19.3/19.3|6.3|False/True|10.23|Taper · Maratonski tempo|
|20|2027-02-22|47.595/47.595|0|False/False|0|TRKA|

Datirane sesije/strides i desc neusaglašenosti iz rezultata:

- 2026-11-27 g7d5: 4.1 km lako (Z2) @ ~5:49/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=ne].
- 2026-11-30 g8d1: 5.6 km lako (Z2) @ ~5:49/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=ne].
- 2026-12-07 g9d1: 5.3 km lako (Z2) @ ~5:49/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=ne].
- 2026-12-14 g10d1: 4.4 km lako (Z2) @ ~5:49/km + 4×15 s ubrzanja (lagani ubrzani koraci) [session=ne, strides=da].
- 2026-12-28 g12d1: 5.6 km lako (Z2) @ ~5:49/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-01-01 g12d5: Tempo isprekidan — 2.8 km zagrevanje + 2×600 m @ 4:50/km (1 min laganog trčanja) + 2.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-04 g13d1: 5.6 km lako (Z2) @ ~5:49/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-01-08 g13d5: Tempo isprekidan — 2.8 km zagrevanje + 2×600 m @ 4:50/km (1 min laganog trčanja) + 2.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-11 g14d1: 4.9 km lako (Z2) @ ~5:49/km + 4×15 s ubrzanja (lagani ubrzani koraci) [session=ne, strides=da].
- 2027-01-18 g15d1: 5.8 km lako (Z2) @ ~5:49/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-01-22 g15d5: Intervali — 2.7 km zagrevanje + 2×800 m @ 4:22/km (2:37 min hoda) + 2.4 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-02-08 g18d1: 4.8 km lako (Z2) @ ~5:49/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-02-12 g18d5: Maratonski tempo — 2.9 km zagrevanje + 1.8 km @ 5:41/km + 2.4 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-02-19 g19d5: Maratonski tempo — 1 km zagrevanje + 1.8 km @ 5:41/km + 0.8 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-02-28 g20d7: 🏁 TRKA 42,2 km (Maraton) — željeni cilj 4:00:00 · preporučeni ritam 5:41/km (oko 3:59:48, prema unetom rezultatu i izabranom cilju) · Spremnost nije potvrđena: ovaj ritam je referenca iz rezultata, ne potvrda završetka distance ili ostvarenja cilja. [session=ne, strides=ne].


## U10 — return_only_not_marathon_ready

Event: {"kind": "return", "breakDays": 28, "today": "2026-11-25", "description": "Every eligible slot through Oct28 explicitly done with synthetic actual km/sec/date/RPE; every eligible Oct29-Nov25 slot explicitly skipped. Prebreak repeatable 60 km/24 km LR is explicit scenario input, not inferred from prescription.", "confirmedBreakFrom": "2026-10-29", "confirmedBreakThrough": "2026-11-25", "lastActualRun": "2026-10-28", "log": {"g1d1": {"status": "done", "km": 12.3, "sec": 4428, "rpe": 4, "runDate": "2026-10-12", "ts": "2026-10-12"}, "g1d2": {"status": "done", "km": 6, "sec": 2160, "rpe": 4, "runDate": "2026-10-13", "ts": "2026-10-13"}, "g1d3": {"status": "done", "km": 14.4, "sec": 5184, "rpe": 4, "runDate": "2026-10-14", "ts": "2026-10-14"}, "g1d5": {"status": "done", "km": 6.3, "sec": 2268, "rpe": 4, "runDate": "2026-10-16", "ts": "2026-10-16"}, "g1d7": {"status": "done", "km": 24, "sec": 8640, "rpe": 4, "runDate": "2026-10-18", "ts": "2026-10-18"}, "g2d1": {"status": "done", "km": 12.2, "sec": 4392, "rpe": 4, "runDate": "2026-10-19", "ts": "2026-10-19"}, "g2d2": {"status": "done", "km": 6.7, "sec": 2412, "rpe": 4, "runDate": "2026-10-20", "ts": "2026-10-20"}, "g2d3": {"status": "done", "km": 15.3, "sec": 5508, "rpe": 4, "runDate": "2026-10-21", "ts": "2026-10-21"}, "g2d5": {"status": "done", "km": 6.7, "sec": 2412, "rpe": 4, "runDate": "2026-10-23", "ts": "2026-10-23"}, "g2d7": {"status": "done", "km": 25.5, "sec": 9180, "rpe": 4, "runDate": "2026-10-25", "ts": "2026-10-25"}, "g3d1": {"status": "done", "km": 12.2, "sec": 4392, "rpe": 4, "runDate": "2026-10-26", "ts": "2026-10-26"}, "g3d2": {"status": "done", "km": 7.4, "sec": 2664, "rpe": 4, "runDate": "2026-10-27", "ts": "2026-10-27"}, "g3d3": {"status": "done", "km": 13.7, "sec": 4932, "rpe": 4, "runDate": "2026-10-28", "ts": "2026-10-28"}, "g3d5": {"status": "skip", "ts": "2026-10-30"}, "g3d7": {"status": "skip", "ts": "2026-11-01"}, "g4d1": {"status": "skip", "ts": "2026-11-02"}, "g4d2": {"status": "skip", "ts": "2026-11-03"}, "g4d3": {"status": "skip", "ts": "2026-11-04"}, "g4d5": {"status": "skip", "ts": "2026-11-06"}, "g4d7": {"status": "skip", "ts": "2026-11-08"}, "g5d1": {"status": "skip", "ts": "2026-11-09"}, "g5d2": {"status": "skip", "ts": "2026-11-10"}, "g5d3": {"status": "skip", "ts": "2026-11-11"}, "g5d5": {"status": "skip", "ts": "2026-11-13"}, "g5d7": {"status": "skip", "ts": "2026-11-15"}, "g6d1": {"status": "skip", "ts": "2026-11-16"}, "g6d2": {"status": "skip", "ts": "2026-11-17"}, "g6d3": {"status": "skip", "ts": "2026-11-18"}, "g6d5": {"status": "skip", "ts": "2026-11-20"}, "g6d7": {"status": "skip", "ts": "2026-11-22"}, "g7d1": {"status": "skip", "ts": "2026-11-23"}, "g7d2": {"status": "skip", "ts": "2026-11-24"}, "g7d3": {"status": "skip", "ts": "2026-11-25"}}}

Actual outcome: {"recommendation": {"kind": "return", "reason": "Dnevnik nema novije trčanje. Potvrdi da li si pravio pauzu ili trenirao bez upisa.", "actionable": false, "requiresConfirmation": true, "breakDays": 28, "reasons": ["Poslednja pokrivena nedelja bez trčanja prekida oslonac na raniji veći obim.", "Najmanje dve pokrivene pune nedelje imaju manje od 80% planiranih kilometara."]}, "resultPresent": true, "summary": "Povratak posle 28 dana pauze, baza 33 km", "executionAdjustment": {"date": "2026-11-25", "breakDays": 28, "reportedBaseKm": 60, "startingKm": 33}, "preparation": {"endurance": "limited", "goalStatus": "needs-speed-improvement", "peakLongRunKm": 17.3, "peakWeeklyKm": 47.4, "demandingDaysMax": 2, "reasons": ["Najduže planirano trčanje je 17.3 km; ovaj plan ima ograničenu dužinsku pripremu za maraton. Promeni raspoložive dane, polaznu bazu ili datum trke pre vremenskog cilja.", "Isporučeni vrhunac 47.4 km/ned je ispod okvirne baze za pun vremenski pristup (55 km/ned).", "Nema potvrđenog kontinuiteta od najmanje osam nedelja; izdržljivost se ne zaključuje samo iz PB-a.", "Referentni rezultat nije potvrđena skorašnja forma u trenutnoj pripremi; tempo proveri novim rezultatom ili kontrolisanim treningom.", "Nema dovoljno ponovljenih dužih izlaganja da jedna najveća dužina potvrdi pripremu."], "forecastBasis": "result-and-delivered-preparation"}}

Preservation — nezavisno poređenje: {"primary": {"comparisonAvailable": true, "changedDays": 64, "pastEffectiveDayChanges": [], "completedDayChanges": [], "manualOverrideOrAltChanges": [], "lockedPredictionRowChanges": [], "calendarIdsStable": true, "raceDateStable": true, "runDaysStable": true, "trainingVdotBefore": 41, "trainingVdotAfter": 41, "goalBefore": 12600, "goalAfter": 12600}, "seededProtection": {"comparisonAvailable": true, "changedDays": 62, "pastEffectiveDayChanges": [], "completedDayChanges": [], "manualOverrideOrAltChanges": [], "lockedPredictionRowChanges": [], "calendarIdsStable": true, "raceDateStable": true, "runDaysStable": true, "trainingVdotBefore": 41, "trainingVdotAfter": 41, "goalBefore": 12600, "goalAfter": 12600}}

**trainingStructure:** 28 dana potvrđene pauze;ranija iskustvena baza 60/24→33/13.2 km. Prve 4 povratne kalendarske nedelje strukturno lake,kasnije jedan pa dva kvaliteta.

**dose:** Budući vrh 47.4 km/LR 17.3 km,MP 1.9 km/T 2.6 km. Upotrebljivo za obnavljanje kontinuiteta,ne dovoljna dužinska priprema za 3:30 maraton.

**recovery:** Postepen povratak,uklonjene dodatne srednje-duge sesije. Iskustvo samo ne opravdava nagli povratak na 60/24.

**coherence:** Četiri stale descstrides ifocusFartlek bez session. Goal 3:30 ostaježelja,reference 3:45 i limitedreadiness se navode.

**Potvrđeni defects:**

- 2026-11-30 g8d1 (confirmed_text_defect): očekivano Opis bez uklonjenih strides; stvarno desc 6×20s strides;polje nema.
- 2026-12-02 g8d3 (confirmed_text_defect): očekivano Uklonjena struktura mora nestati iizdesc; stvarno 4.8 km lako+6×20s strides;polje nema.
- 2026-12-07 N9 (confirmed_text_defect): očekivano Naslov prema stvarnom radu; stvarno focusFartlek bez session.

**Trenerske zamerke:**

- 2027-02-07 g17d7 (coaching_concern): očekivano Promeniti ciljnu trku/datum ili potvrditi veću dužinsku toleranciju; stvarno LR 17.3 km vrh;2027-02-28 trka 42.195 km uz limitedupozorenje.

**Datirani primeri:**

- 2026-11-29 g7d7 (observed_outcome): očekivano PovratniLR prema redukovanoj bazi; stvarno 13.2 km;sledeća puna nedelja 34.9 km.

### Svaka buduća nedelja — primary

Ukupan km uključuje sačuvane ranije dane u mešanoj nedelji; futureKm je samo posle cutoff-a. Trka ulazi u km, ali nije taper trening. Workmin je samo session rad, bez strides; progresivna poslednja trećina računa se kao kvalitet.

|N|Početak|Km ukupno/future|LR future|Deload/taper|Workmin future|Focus|
|---:|---|---|---:|---|---:|---|
|7|2026-11-23|55.4/17.5|13.2|False/False|0|Baza — aerobni obim, bez kvaliteta|
|8|2026-11-30|34.9/34.9|13.9|False/False|0|Baza — aerobni obim, bez kvaliteta|
|9|2026-12-07|36.6/36.6|12.5|False/False|0|Fartlek|
|10|2026-12-14|28.4/28.4|10.4|True/False|0|DELOAD — obim dole, ostaje kratka oštrina|
|11|2026-12-21|38.4/38.4|14.7|False/False|3.0|Fartlek|
|12|2026-12-28|40.1/40.1|13.2|False/False|5.4|Intervali|
|13|2027-01-04|42.1/42.1|15.5|False/False|10.0|Tempo isprekidan|
|14|2027-01-11|32.8/32.8|11.6|True/False|0|DELOAD — obim dole, ostaje kratka oštrina|
|15|2027-01-18|43.8/43.8|13.9|False/False|23.13|Maratonski tempo + Tempo|
|16|2027-01-25|45.6/45.6|16.4|False/False|21.6|Maratonski tempo + Tempo isprekidan|
|17|2027-02-01|47.4/47.4|17.3|False/False|23.13|Maratonski tempo + Tempo|
|18|2027-02-08|37.8/37.8|14.7|False/True|13.0|Taper · Tempo|
|19|2027-02-15|30.7/30.7|12.1|False/True|10.13|Taper · Maratonski tempo|
|20|2027-02-22|51.195/51.195|0|False/False|0|TRKA|

Datirane sesije/strides i desc neusaglašenosti iz rezultata:

- 2026-11-30 g8d1: 6.2 km lako (Z2) @ ~6:00/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=ne].
- 2026-12-02 g8d3: 4.8 km lako (Z2) @ ~6:00/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=ne].
- 2026-12-07 g9d1: 7.3 km lako (Z2) @ ~6:00/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=ne].
- 2026-12-14 g10d1: 5.3 km lako (Z2) @ ~6:00/km + 4×15 s ubrzanja (lagani ubrzani koraci) [session=ne, strides=ne].
- 2026-12-21 g11d1: 7.2 km lako (Z2) @ ~6:00/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-22 g11d2: Fartlek — 1.9 km zagrevanje + 3×60 s brzo @ ~5:00/km (90 s laganog trčanja) + 1.4 km hlađenje · Uvod u kvalitet: kontrolisane deonice, bez sprinta, uz lagan oporavak. · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2026-12-28 g12d1: 8.3 km lako (Z2) @ ~6:00/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2026-12-29 g12d2: Intervali — 2 km zagrevanje + 2×600 m @ 4:30/km (2:02 min hoda) + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-04 g13d1: 7.9 km lako (Z2) @ ~6:00/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-01-05 g13d2: Tempo isprekidan — 2 km zagrevanje + 2×1000 m @ 5:00/km (1 min laganog trčanja) + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-11 g14d1: 6.3 km lako (Z2) @ ~6:00/km + 4×15 s ubrzanja (lagani ubrzani koraci) [session=ne, strides=da].
- 2027-01-18 g15d1: 9.8 km lako (Z2) @ ~6:00/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-01-19 g15d2: Maratonski tempo — 2 km zagrevanje + 1.9 km @ 5:20/km + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-22 g15d5: Tempo — 2 km zagrevanje + 2.6 km @ 5:00/km + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-25 g16d1: 9.5 km lako (Z2) @ ~6:00/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-01-26 g16d2: Maratonski tempo — 2 km zagrevanje + 2×900 m @ 5:20/km (1:30 min hoda) + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-01-29 g16d5: Tempo isprekidan — 2 km zagrevanje + 2×1200 m @ 5:00/km (1 min laganog trčanja) + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-02-01 g17d1: 9.9 km lako (Z2) @ ~6:00/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-02-02 g17d2: Maratonski tempo — 2 km zagrevanje + 1.9 km @ 5:20/km + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-02-05 g17d5: Tempo — 2 km zagrevanje + 2.6 km @ 5:00/km + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-02-08 g18d1: 6.4 km lako (Z2) @ ~6:00/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak) [session=ne, strides=da].
- 2027-02-09 g18d2: Tempo — 2 km zagrevanje + 2.6 km @ 5:00/km + 1.5 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-02-16 g19d2: Maratonski tempo — 1.4 km zagrevanje + 1.9 km @ 5:20/km + 1 km hlađenje · Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju. [session=da, strides=ne].
- 2027-02-28 g20d7: 🏁 TRKA 42,2 km (Maraton) — željeni cilj 3:30:00 · preporučeni ritam 5:20/km (oko 3:45:02, prema unetom rezultatu) · Spremnost nije potvrđena: ovaj ritam je referenca iz rezultata, ne potvrda završetka distance ili ostvarenja cilja. [session=ne, strides=ne].


## Nepromenjen početni rad

- 10k-scores.json: SHA256 d46269f19ce89d61265d2a3f229cc45edd29e8b6d626933863f69a7c20c9fcfe.
- 10k-review.md: SHA256 dd7b1bf558d8f217103943c8af8d5c07261ddfb051c45bc5cb1be010130dd4cb.
