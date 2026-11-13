# F8 — kako V4 izgleda korisniku i šta aplikacija mora da čuva (PREDLOG)

Status: predlog za vlasnika, 12. 11. 2026. Ništa u aplikaciji, bazi ni kodu nije menjano. Ekrani se menjaju tek kad
vlasnik odobri (PLAN § F8). Pouzdanost: [visoka] pročitano u kodu/izmereno · [srednja] iz izveštaja taba ·
[niska] procena. Tekstovi ekrana su kreativni predlog — konačne reči piše `engine/format.ts` iz istih podataka.

## 1. Šta korisnik vidi drugačije

**Pre generisanja.** Čarobnjak ostaje (`web/src/features/onboarding/Wizard.tsx`), ali posle poslednjeg koraka ne
pravi plan odmah: prvo „Pregled pripreme" — vrh nedelje, najduži dugi, očekivano vreme i upozorenja, svako sa
dugmetom. Ništa se ne odbija; „Napravi plan" je uvek dostupno.

**Zaglavlje plana.** Tri kartice umesto današnje jedne linije ocene cilja (`features/plan/GoalAssessment.tsx`):
Forma (danas, na dan trke, raspon), Tempa (današnja forma naspram cilja), Upozorenja (sklopljena, broj u naslovu).

**Dan treninga.** Isti ekran Detalja (`features/day/DayScreen.tsx`); tempo uz deonicu dolazi iz zaglavlja plana
(„prag 2 × 7 min · 4:40/km"). Novo: oznaka porekla dana („promenjeno 14. 12. — bolest", „tvoja izmena") i dugme
„Zaključaj dan".

**Posle događaja.** Na Danas jedna traka „Plan je promenjen — zašto" → spisak promena pre → posle, do kada, sa
„Vrati". Prijava bolesti/puta/bola/umora: jedno dugme „Nešto se desilo?" na Danas.

```
┌──────────────────────────────────┐
│ POLUMARATON · 24. 1. 2027.       │
│ ─ FORMA ───────────────────────  │
│ Danas        1:41:37  (srednja)  │
│ Na dan trke  1:39:40             │
│              1:38:30 – 1:41:10   │
│ Zašto se promenilo ›             │
│ ─ TEMPA ───────────────────────  │
│ Tempo trke danas   4:49/km       │
│ Tvoj cilj 1:39:00  4:42/km       │
│ Cilj je na ivici raspona.        │
│ ─ UPOZORENJA (2) ─────────── ▸   │
└──────────────────────────────────┘
```

## 2. Upozorenja pre generisanja (AGENTS t. 6: ništa se ne odbija)

Pravila prikaza: (1) svako upozorenje ima tačno tri rečenice — problem, šta znači za trku, konkretan predlog;
(2) „Primeni predlog" menja unos u čarobnjaku i ponovo računa pregled (suv poziv `plan`, SPEC § 1.5) — korisnik
odmah vidi novi vrh, dugi i da li je upozorenje nestalo; (3) „Nastavi ovako" ga samo potvrđuje, upozorenje ostaje
u zaglavlju plana; (4) predlog nikad ne nudi broj manji od onoga što plan već ima (R11); (5) kad ni najbolji
predlog na isti datum ne daje adekvatnu pripremu, prvo dugme je kraća distanca (`adequate.shorter`). Brojevi u
`{}` dolaze iz `Warning.suggest` / `data.adequate` (HM danas: 10 ned., vrh 40 km, 4 dana, dugi 16 km —
`distances/hm/safety.ts` [visoka]).

| slučaj (`code`) | tekst (problem · značenje · predlog) | dugmad |
|---|---|---|
| kratka priprema (`kratka-priprema`) | Do trke je {N} nedelja, a za {distanca} treba bar {min}. Plan stiže do dugog od {L} km i vrha od {P} km, pa će druga polovina trke biti teža od svega u pripremi. Za adekvatnu pripremu izaberi trku posle {datum+}, ili trči {kraća} na isti datum. | „Primeni: {kraća} {datum}" · „Pomeri trku na {datum+}" · „Nastavi ovako" |
| mali obim (`mali-obim`) | Najveća nedelja u planu ima {P} km, a adekvatna priprema traži bar {min} km. Izdržljivost u drugoj polovini trke biće slabija, pa tempo pada ranije. Uz isti datum trči početak sporije; za {min} km treba {W} nedelja pripreme. | „Primeni: {W} nedelja" · „Nastavi ovako" |
| malo dana (`malo-dana`) | Trčiš {d} dana nedeljno, a za {distanca} preporuka je {min}. Sa {d} dana dugi nosi preveliki deo nedelje i obim ne može bezbedno da raste. Dodaj {min}. dan od 30–40 min laganog trčanja — vrh tada ide na {P+} km, dugi na {L+} km. | „Primeni predlog: {min}. dan" · „Nastavi ovako" |
| kratak dugi (`kratak-dugi`) | Najduži trening u planu je {L} km, a za ovu distancu treba bar {min} km. Poslednjih {r} km trke biće duže od svega što si trčao, pa tu očekuj najveći pad. Uz isti datum počni trku sporije; {uzrok: dani/obim/vreme} — {predlog koji uklanja uzrok}. | „Primeni predlog" · „Nastavi ovako" |
| cilj van raspona (`cilj-van-raspona`) | Tvoj cilj {G} je brži od najbržeg realnog vremena za taj dan ({low}–{high}). Ako trku počneš tempom cilja ({p}/km), verovatno ćeš usporiti posle {x} km. Treniraj po današnjoj formi; cilj {G} je realan uz {šta ga pomera: trka/test brži od X, ili N nedelja više}. | „Postavi cilj {expected}" · „Zadrži moj cilj" |
| plan posle trke (`povratak`) | Plan počinje dan posle trke ({dist} za {vreme}). Prvih {n} dana su kratka lagana trčanja da se telo oporavi; prvi brži trening je {datum}. Ako se tog dana i dalje osećaš umorno, zameni ga laganim trčanjem od 30 min. | „U redu" |
| nema podataka (`nema-podataka`) | Nemam tvoj rezultat ni trčanja, pa plan polazi od opreza (tempa po osećaju). Plan može biti prelak ili pretežak dok ne vidi kako trčiš. Poveži Stravu ili upiši jedan rezultat (npr. 5 km) — tempa se tada odmah podese. | „Poveži Stravu" · „Upiši rezultat" · „Nastavi bez toga" |
| obim nizak za nivo (`obim-za-nivo`) | Tvoja forma ({vreme}) traži više rada u tempu trke nego što {P} km nedeljno može da nosi. Plan je bezbedan, ali neće iskoristiti tvoj nivo i očekivano vreme je sporije od mogućeg. Za tvoj nivo treba bar {P*} km nedeljno i {d*} dana — dodaj dan ili produži pripremu za {W} nedelja. | „Primeni: {d*} dana" · „Nastavi ovako" |

Kraća distanca: nudi se kao prvo dugme kad važi bar jedno: N < 0,6 × min. nedelja, ili predlog „produži" traži
datum posle trke koju je korisnik izabrao, a korisnik je trku označio kao fiksnu. Primer (maraton za 8 nedelja):
„Do maratona je 8 nedelja, a treba bar 16. Plan stiže do dugog od 24 km; poslednjih 15 km biće znatno teže od
treninga. Za adekvatnu pripremu: polumaraton na isti datum (pun plan), ili maraton posle 15. 3. 2027."

```
┌──────────────────────────────────┐
│ PREGLED PRIPREME                 │
│ Vrh 37,6 km · dugi 14 km         │
│ Očekivano 1:39:40 (1:38–1:41)    │
│ ⚠ Malo dana                      │
│ Trčiš 3 dana nedeljno, a za      │
│ polumaraton preporuka je 4. …    │
│ [Primeni predlog: 4. dan]        │
│ [Nastavi ovako]                  │
│ ──────────────────────────────── │
│        [ Napravi plan ]          │
└──────────────────────────────────┘
```

## 3. Forma i prognoza

**Gde.** Kartica Forma u zaglavlju plana (§ 1) i ceo prikaz na ekranu Napredak (`features/progress/`): kriva
procene kroz nedelje, tačke trka/testova, raspon na dan trke kao traka. Polazna forma se vidi samo na Napretku.

**Šta piše.** Danas: vreme na distanci cilja + pouzdanost rečju; na dan trke: očekivano + raspon. Pouzdanost bez
žargona: visoka „imaš trku ili test u poslednjih 6 nedelja"; srednja „rezultat je stariji, ali treninzi ga
potvrđuju"; niska „procena iz laganih trčanja — jedan test je menja". Izvor brojeva: živa procena
`estimateForm` (SPEC § 7.1), ne snimak u zaglavlju.

**„Zašto se promenilo"** — spisak `FormChange` (SPEC § 7.1), najnovije gore, jedna rečenica po promeni:
- „15. 11. — Trka 10 km za 44:40 je brža od procene: tempa su ubrzana 4–5 s/km, očekivano 1:38:50."
- „Nedelja 3 je odrađena po planu, pa očekivano vreme ostaje 1:39:40, a raspon se sužava."
- „Nedelja 5 je odrađena oko 60 %: očekivano vreme je oko 25 s sporije."
- „Prag 3 × 8 min držan u zadatom tempu: procena malo naviše (+0,1)." (jedan trening nikad ne pomera više)
- „Poslednjih 6 nedelja trčiš oko 30 % manje nego ranije: procena malo niže."
- „Puls na laganim trčanjima pada 4 nedelje zaredom pri istom tempu: procena malo naviše." (samo trend, AGENTS 9a)
- „1:42:01 se računa kao 1:40:42, jer je druga polovina trke bila 4,7 % brža od prve."
Procena se ne menja na jedan dobar trening i nikad ne menja urađeno (SPEC § 7.3, § 7.1).

**Tempa prate formu.** U Tempima uvek dva reda: „Tempo trke danas" (= `header.paces`, tj. današnja forma) i „Tvoj
cilj" sa ocenom dostižan / na ivici / van raspona (R6). Kad tempa promene (posle trke odmah, inače najviše jednom u
14 dana, SPEC § 7.6), traka: „Tempa su ubrzana 3 s/km jer… — važi od danas; odrađeni treninzi ostaju kako su
bili." Urađene nedelje prikazuju tempo koji je tada važio (R10) — zahtev za F9 (§ 6, tačka 6).

## 4. Promena plana

**Šta korisnik vidi.** Svaka promena je grupisana po događaju (`Change`, SPEC § 10): naslov = šta se desilo,
pa rečenica „šta je promenjeno → do kada", pa spisak dana pre → posle.

```
┌──────────────────────────────────┐
│ PLAN JE PROMENJEN · 21. 12.      │
│ Bolest 7 dana (14–20. 12.)       │
│ Prvih 14 dana lagano i kraće,    │
│ bez brzih deonica; od 4. 1. plan │
│ se nastavlja, provera forme je   │
│ pomerena na 9. 1.                │
│ ─────────────────────────────    │
│ čet 24. 12. prag 3×8 min         │
│          → lagano 5 km           │
│ ned 27. 12. dugi 15 km, 4 km RP  │
│          → dugi 11 km lagano     │
│ … još 6 promena ›                │
│ [U redu]         [Vrati kako je] │
└──────────────────────────────────┘
```

**Kako se prijavljuje (najmanje dodira).** Na Danas dugme „Nešto se desilo?" → četiri izbora:
- Bolestan sam / Na putu sam → „od danas" (izmenljivo) + „koliko: 2 dana · nedelju · ne znam" → pregled → potvrda.
  „Ne znam" = pauza otvorena dok korisnik ne dodirne „Opet trčim" (ili prvo trčanje sa Strave je zatvori).
- Boli me → postojeći unos bola (`features/recovery/KneeSheet.tsx`: deo tela, bol 0–10) — isti zapis (`knee`),
  motor ga čita kao `pain` (SPEC § 2.1); ništa novo za kucanje. Tekst promene uvek ima uslov za nastavak, prag za
  prekid i „ako traje duže od 7 dana — lekar ili fizioterapeut" (R7).
- Umoran sam → jedan dodir → pregled (4 dana bez kvaliteta, × 0,8) → potvrda.
Propušten trening se ne prijavljuje: prošao dan bez trčanja (ili „Preskočen", `DayScreen.tsx`) je dovoljan. Rezultat
trke/testa: trčanje na dan trke/testa iz plana, ili oznaka „Ovo je bila trka" na unosu trčanja.

**Potvrda ili odbijanje.**
- Događaj koji je prijavio korisnik (bolest, put, bol, umor, promena cilja/dana): prvo pregled, pa „Primeni" /
  „Ne menjaj plan". Odbijen događaj se pamti i ne nudi ponovo (pitanje 1).
- Događaj koji je motor sam izveo (rezultat, propušten trening, pauza iz rupe u trčanju, umor iz opterećenja):
  primenjuje se sam i ostaje traka „Plan je promenjen — zašto" sa „Vrati kako je bilo" dok prvi promenjeni dan ne
  prođe. Razlog: korisnik koji ne otvara aplikaciju danima i dalje dobija bezbedan plan.
- Ako korisnik ništa ne uradi: pregled prijavljenog događaja ne menja plan (ostaje traka „Imaš nepotvrđenu
  promenu"); izvedeni je već primenjen. Bez događaja plan se ne menja (stabilnost, SPEC § 6.3).

**Ručna izmena i zaključavanje.** Ostaju postojeći alati: izmena dana (`features/plan/AltSheet.tsx`) i zamena
dana u nedelji (`features/plan/SwapSheet.tsx`). Svaki ručno dirnut dan dobija oznaku „tvoja izmena" i motor ga ne
menja (`origin: 'manual'`, SPEC § 1.2); „Vrati izmenu" vraća sadržaj iz `base`. Novo: „Zaključaj dan" na
Detaljima — dan bez tvoje izmene koji motor ne sme da dira (npr. trening sa klubom). Čuvar na ručno izmenjen dan
samo kaže, ne menja: „Ovaj dan ima 2 × 20 min praga dan posle dugog — u redu ako se osećaš sveže."

## 5. Postojeći korisnici kad V4 uđe

Pravilo: preuzimanje ne menja plan — isti datumi, treninzi, urađeno, ručne izmene (AGENTS t. 8a). F5 je to
proverio na 32 uzorka, 3467 dana, otisak pre = posle 32/32 [srednja — izveštaj F5].

| ko (danas u bazi, LOG F0) | šta vidi prvog dana | prilagođavanje |
|---|---|---|
| plan starog formata (19) | Danas: traka „LegacyPlanNotice" (`features/plan/LegacyPlanNotice.tsx`) kaže da se plan ne prilagođava. Posle: „Tvoj plan sada prati novi motor. Ništa u njemu nije promenjeno." + kartica Forma | uključeno: menja samo dane posle događaja (8b); dugme „Prepravi ostatak plana" (pregled pre → posle, pa potvrda) |
| v2 plan (3) | ista poruka; nestaju ekrani `HmV2Adjustment`/`TenKV2Adjustment`… (`features/plan/AdjustPlan.tsx`) | isto kao gore |
| vlasnik, lični plan (zamrznut HM v1) | „Tvoj plan je zaštićen: novi motor ga ne menja. Na događaj dobijaš predlog, a odluku donosiš ti." | isključeno; predlozi kao tekst (SPEC § 9.4); zaštitu skida samo vlasnik |

„Prilagođavaj moj plan" se ne nudi kao prekidač za stare/v2 planove jer ga pravilo 8b već daje (samo na događaj);
nudi se „Prepravi ostatak plana" — izričit zahtev, uvek sa pregledom. „Generiši nov plan" ostaje.

## 6. Šta aplikacija mora da čuva i prosledi (spisak za F9)

**Danas [visoka, kod]:**
- Sve je jedan JSON po korisniku (`user_state.data`, `domain/state/types.ts`, schema v12); sinhronizacija je
  „poslednji upis pobeđuje" uz pitanje kad je tuđi upis noviji (`domain/sync/decide.ts`); svaka izmena čuva
  prethodnu verziju, najviše 40 (`supabase/istorija.sql`, mereno 37 KB sirovo na punom stanju).
- Pun zapis trčanja (km, trajanje, puls, po km, krugovi) samo u `log` za dan plana (`services/strava/
  stravaSync.ts` 280–403); streamovi se vuku samo za dane plana.
- Van plana: `vanPlana` = datum → km, samo 35 dana pre početka plana (`recordOutOfPlan`, npr.
  `domain/generators/halfMarathon/v2/app/state/load.ts`); `vanPlanaV2` (datum, km, trajanje, izvor) samo uz v2
  plan (`domain/activities/offPlan.ts`). Spisak sa Strave se vuče od 28 dana pre početka plana, najviše 400
  aktivnosti (`stravaSync.ts` 196–216). Istorija pre toga se ne čuva.

**1. Zapis aktivnosti (`Run`, SPEC § 2.2) — svako trčanje, vezano za plan ili ne.**

| polje | primer | obavezno |
|---|---|---|
| `id` izvor:ID | `strava:1234567890` / `rucno:…` | da |
| `date`, `distanceM`, `durationSec` (kretanje) | `2026-11-10`, 10230, 3120 | da |
| `dayId` | `w3d1` | ako je dan plana |
| `effort` | `race` / `test` | ako jeste |
| `avgHr`, `tempC`, `elevM` | 148, 12, 45 | ako postoji |
| `splits` po km `[tempo, puls]` | `[[305,147],…]` | poslednjih 8 ned., trčanja ≥ 25 min |
| `laps` rad/oporavak `[uloga, m, s, puls]` | samo dani kvaliteta i trke | poslednjih 12 ned. |
| `rpe`, `walked` | 7, false | opciono |

Veličina [niska, procena]: sažetak ≈ 90 B; sa podelom po km +≈ 9 B/km; krugovi ≈ 150 B. Koliko unazad: sažetak
26 nedelja (pouzdanost forme gleda trke do 180 dana, SPEC § 7.5), detalji 8–12 nedelja (trend pulsa 8, pad baze
6 + 6 nedelja, F4 krug 2); trke i testovi zauvek (malo ih je). Za 5 trčanja nedeljno: ≈ 12 KB sažetak + ≈ 5 KB po
km + ≈ 2 KB krugovi ≈ **19 KB po korisniku**.

**2. `PlanDoc` — izmereno na motoru (`claude/v4` @ c7ac09b) [visoka]: vlasnik-v1 (10 ned.) 24 KB, vlasnik-v2
(18 ned.) 41 KB.** Uz aktivnosti to je + 45–60 KB na sadašnjih 37 KB → `user_state` 2,5–3 × veći, a istorija
čuva 40 kopija (≈ 4 MB po korisniku umesto ≈ 0,5). Zato predlog (pitanje 2):
- tabela `aktivnost` (jedan red po trčanju, ključ korisnik + `id`; upis „ubaci ili zameni" — dva uređaja koja
  povuku isto trčanje daju isti red, sukoba nema);
- tabela `plan_v4` (korisnik, `doc` jsonb, `rev` broj): upis samo ako je `rev` na serveru onaj koji je uređaj
  video, inače uređaj ponovo učita i ponovo primeni svoju radnju;
- `plan_v4_dogadjaj` (samo dopisivanje): izričiti događaji (bolest, put, bol, umor, cilj, dani, odbijeno,
  ručna izmena) sa vremenom i uređajem.
- `user_state` ostaje kakav je (v2/stari plan, `log`, `knee`, `wellness`…) — adapter ga i dalje samo čita.

**3. Više uređaja.** Motor je determinističan: isti `PlanDoc` + isto stanje + isti događaji = isti plan (AGENTS
t. 2). Dva uređaja koja primene isti izvedeni događaj dobiju bajt-isti dokument, pa „sukob" sa istim sadržajem
nije sukob (porediti otisak, ne vreme). Pravi sukob postoji samo za dve različite ručne radnje u isto vreme →
`rev` ga hvata, druga radnja se ponovo primeni nad novim dokumentom; ako dira isti dan, pita se kao danas.

**4. Šta se prosleđuje motoru** (jedan sastavljač, na jednom mestu): `today` po Beogradu; `availability` i
`profile` iz čarobnjaka; `runs` = sve iz `aktivnost` (+ `log` i `vanPlana` kroz adapter za stare planove);
`pauses` iz prijava; `pain` iz `knee` (bol 0–10, deo tela, datum); izričiti događaji; `Run.planned` popunjava
motor po `dayId` (F4 izveštaj). `effort: race` iz dana plana „trka/test" ili oznake korisnika; Stravino polje
vrste aktivnosti (trka) danas se ne čita (`StravaActivity` u `domain/activities/stravaImport.ts` ga nema) — da se
doda [srednja da ga Strava šalje u spisku; proveriti u F9].

**5. Strava povlačenje.** Pri uključenju V4: jednokratno 26 nedelja unazad samo spisak (jedan zahtev na 100
trčanja); po km samo za poslednjih 8 nedelja i trčanja ≥ 25 min; posle toga dopuna od poslednje sinhronizacije.
Ograničenja broja zahteva Strave proveriti pre F9 (ne navodim broj bez provere).

**6. Ostala polja.** (a) Istorija tempa u planu: `header.paces` + datum od kad važi, da urađene nedelje
prikazuju tempo koji je tada važio (R10). (b) Odbijeni događaji (u `plan_v4_dogadjaj`, tip „odbijeno") — motor ih
ne primenjuje ponovo. (c) `carried` iz adaptera ide u `PlanHeader.legacy` (F5, zahtev 2). (d) `log.lock` u
aplikaciji znači „ručno ispravljen unos, Strava ga ne prepisuje" (F5 tačka 5) — NE prevoditi u zaključan dan
(pitanje 5).

**7. Bez Strave.** Ručni unos danas postoji za dan plana (`features/today/DayEntry.tsx`, `EntryForm.tsx`). Predlog: isti unos i za trčanje van plana — datum, km, trajanje (obavezno — bez njega
trčanje ulazi samo u obim kao procena, ne u formu, SPEC § 2.2), opciono napor 1–10 i „ovo je bila trka". Oba idu u `aktivnost` kao `rucno:…`. Forma tada radi iz trka/testova i odrađenog kvaliteta; bez pulsa i bez
podele po km procena je samo sporija da se pomeri (AGENTS 9a: mora da radi i bez pulsa). Upozorenje
`nema-podataka` kad nema ni rezultata ni trčanja.

## 7. Redosled uvođenja

0. **Senka bez izmene aplikacije (odmah, F9-0).** Organizator nedeljno čita bazu (samo SELECT, odluka vlasnika 2),
   preuzima svaki plan adapterom i pokreće V4 nad stvarnim stanjem; ništa se ne upisuje. Meri se (tabela ispod).
1. **Tabele i zapis aktivnosti, iza zastavice** (potvrda vlasnika za bazu): aplikacija počinje da puni
   `aktivnost`; ekrani nepromenjeni. Tako V4 dobija istoriju pre nego što ga iko vidi.
2. **Zastavica „V4" samo za vlasnika** (zastavica po korisniku na serveru; vlasnik sam može da je ugasi):
   kartice Forma/Tempa, traka promena, „Nešto se desilo?"; lični plan zaštićen.
3. **Novi HM planovi** kroz V4 (kad HM prođe kapiju oba sudije). v2 i stari planovi i dalje kao danas.
4. **Preuzimanje postojećih planova** (stari format, v2) — korisnik po korisnik, uz poruku iz § 5.
5. **Ostale distance** kako prolaze kapiju (F7).

**Vraćanje nazad.** V4 nikad ne piše u `genPlan`, `log`, `alts`, `moves` (adapter samo čita, F5) — gašenje
zastavice vraća tačno sadašnji prikaz. Ono što je korisnik pod V4 uneo kao ručnu izmenu ostaje u `plan_v4` i
vraća se kad se zastavica ponovo upali; za trčanja nema gubitka (Strava + `log` rade kao danas).

**Šta se meri u senci:**

| mera | prag za sledeći korak |
|---|---|
| otisak pre = posle na svim stvarnim planovima | 100 % |
| izvedeni događaji po korisniku nedeljno | ≤ 1 u proseku; plan bez događaja ne šeta (0 promena) |
| nalazi čuvara na planovima V4 | 0 (osim `rucno`) |
| prognoza naspram stvarne trke (vlasnik 13. 12. Bokeška i svaka trka u bazi) | stvarno vreme u rasponu |
| skok očekivanog vremena bez događaja | 0 skokova > 20 s bez rečenice |
| V4 naspram v2 po nedeljama (km, dugi, broj treninga) | razlike objašnjive; pregled vlasnika 2–3 plana |
| vreme računa, veličina dokumenta | < 200 ms na telefonu [niska — meriti]; < 50 KB |

## 8. Otvorena pitanja za vlasnika (odgovor „da" prihvata predlog)

1. **Ko odobrava promenu?** Predlog: izvedeni događaji (rezultat, propušten trening, rupa u trčanju) primenjuju se
   sami uz „Vrati kako je bilo"; prijavljeni (bolest, put, bol, umor) uvek prvo pregled pa „Primeni" / „Ne menjaj".
2. **Gde se čuva V4?** Predlog: nove tabele `aktivnost`, `plan_v4`, `plan_v4_dogadjaj`; `user_state` se ne menja.
   Razlog: plan V4 je 24–41 KB, aktivnosti ≈ 19 KB, a istorija verzija čuva 40 kopija celog stanja.
3. **Koliko Strava istorije?** Predlog: pri uključenju V4 jednom 26 nedelja unazad (sažetak), po km samo
   poslednjih 8 nedelja; posle toga samo nova trčanja.
4. **Tvoj lični plan.** Predlog: ostaje zaštićen do Bokeške 13. 12. (samo predlozi kao tekst); tvoj sledeći plan
   (cilj 17. 4. 2027) pravi V4 normalno, uz tvoj pregled pre uključenja.
5. **Zaključavanje dana.** Predlog: novo dugme „Zaključaj dan" na Detaljima treninga; postojeća oznaka „ručno
   ispravljen unos" (Strava ga ne prepisuje) se NE tumači kao zaključan dan.
6. **Redosled.** Predlog: senka bez izmene aplikacije odmah → zapis aktivnosti iza zastavice → V4 samo za tebe →
   novi HM planovi → preuzimanje postojećih → ostale distance; svaki korak tek uz tvoje izričito „da" za bazu i
   deploy.

## 9. ODLUKE VLASNIKA (13. 11. 2026, ≈ 19:20)

1. **Odobravanje (dopuna 19:35):** promene koje dolaze iz FORME (tempa naviše/naniže iz Strava trčanja, rezultat
   testa/trke) i mala usklađivanja posle propuštenog treninga aplikacija primenjuje SAMA, bez pitanja; razlog je
   dostupan u „Zašto se promenilo" (AGENTS 9a: objašnjivo). Promene po događaju koji korisnik PRIJAVI (bolest,
   put, bol, umor) traže zeleno svetlo: pregled pa „Primeni" / „Ne menjaj".
2. **Baza:** vlasnik daje puno odobrenje za sve izmene baze potrebne V4 (nove tabele po izboru organizatora,
   imena slobodna). Izvršava se u F9, ne pre; `user_state` i v2 podaci se ne diraju dok se v2 ne ugasi.
3. **Strava:** uvoz što veće istorije koju Strava dozvoljava (najmanje 26 nedelja kao sažetak), detalji po km za
   poslednjih 8 nedelja; obim i tempo uvoza po ograničenjima Strava API-ja (proveriti važeće limite pre F9).
4. **Lični plan:** prihvaćen predlog (zaštićen do Bokeške 13. 12.; sledeći plan pravi V4 uz pregled vlasnika).
5. **Zaključavanje i premeštanje (dopuna 19:35):** bez posebnog dugmeta. Urađen dan je uvek zaštićen. Kad korisnik
   ručno izmeni ili PREMESTI trening (postojeća zamena dana u aplikaciji), generator to vidi kao činjenicu: taj dan
   ostaje kako ga je korisnik postavio, a ostali nezaključani dani te nedelje se sami preslože radi razmaka (npr.
   dugi u subotu → petak lagan, kvalitet ne dan pre dugog), bez pitanja. Ako korisnik isti trening premesti dve
   nedelje zaredom, aplikacija jednom ponudi „Ubuduće dugi subotom?". Oznaka „ručno ispravljen unos" ostaje kakva je.
6. **Redosled:** sve odjednom (potvrđeno 19:35: aplikacija ima malo aktivnih korisnika, kvarovi se popravljaju posle). V4 se završava u celini (sve četiri distance, forma, preuzimanje planova, ekrani),
   pa ulazi u aplikaciju u jednom koraku; posle uspešnog ulaska v2 se briše. Bez faznog uvođenja.
