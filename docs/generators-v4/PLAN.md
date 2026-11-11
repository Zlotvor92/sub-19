# V4 generator — plan rada organizatora (od 12. 11. 2026. ujutru)

Pravila: `AGENTS.md` § „V4 generator — pravila". Dnevnik odluka do sada: `docs/generators-v2/perfection/PROGRAM.md`.
Dnevnik V4 od sutra: `docs/generators-v4/LOG.md` (svaka odluka sa vremenom po Beogradu).

## 1. Cilj i mere

- Ocena „Plan" ≥ 80 na svakoj distanci (5K, 10K, HM, maraton), ista rubrika, istih 12 profila po distanci.
  Dva broja po distanci: prosek za iste ulaze; broj profila na ≥ 80 (svi kojima ulaz dozvoljava; ostali posle
  prihvaćenog predloga unosa).
- Zbirna ocena (nova rubrika): Plan 50 % + Prilagođavanje 30 % + Personalizacija 20 %; cilj 90 na zbirnoj je dugoročan.
- V4 radi nad postojećim planovima i ličnim planom vlasnika bez ijedne promene pri preuzimanju.
- Polazno stanje: HM v3 (grana `claude/v3-hm`, `halfMarathon/v3/`, ≈ 1,9 hilj. redova) — 77,6; 7/12 na ≥ 80.

## 2. Šta V4 mora da ima, a v3 nema (nalazi od 11. 11.)

1. Planiranje iz stanja (v3 pravi plan od nule: prva nedelja posle trke ima brze deonice).
2. Forma kao procena iz trčanja + očekivani raspon na dan trke (v3: prognoza 1:41 → 1:41 kroz 18 nedelja; plafon
   napretka isti za sve).
3. Biblioteka treninga odvojena od šablona; motor zajednički, distanca podatak.
4. Uvoz postojećih planova i ličnog plana; adaptacija kao ponovno planiranje.
5. Drugi sudija (isti AI trener je pisao ciljne planove i ocenjivao).

## 3. Raspored foldera (odluka organizatora)

```
web/src/domain/v4/
  engine/      motor: tipovi (PlanDoc, RunnerState, Event, Template, Workout), opterećenje, forma/umor,
               planiranje iz stanja, izbor treninga, čuvar, ispis — NE zna za distance
  distances/   hm/ tenk/ fivek/ marathon/ — samo podaci: šabloni, biblioteka, brojevi bezbednosti, tekstovi
  fitness/     procena forme iz treninga (tempo, trend pulsa sa zgloba, trke) + očekivani raspon
  adapters/    v2 plan, plan starog formata, lični plan → PlanDoc (jedino mesto koje zna stare formate)
docs/generators-v4/  SPEC.md, LOG.md, briefs/, reports/, plans/<D>/, coach/
```
Testovi V4: jedan brz projekat (`npx vitest run --project v4` ili putanja), ceo skup u minutima.

## 4. Faze

Oznake: [F] Fable 5.2 · [O] Opus 5.5 · [Org] organizator sam. „Kapija" = uslov da se pređe na sledeću fazu.

**F0 — priprema [Org], jutro, ≈ 1 h**
- Grana `claude/v4` od vrha radne grane; `docs/generators-v4/` (ovaj plan, LOG).
- Čitanje baze (samo SELECT): koliko planova po formatu/verziji (v2 po distanci i policyVersion, stari format, lični),
  koliko aktivnih; koje tabele drže Strava aktivnosti i šta sadrže (tempo, puls, trajanje, tip, krugovi).
- Uzorci za adaptere i procenu forme: 3–5 stvarnih planova po formatu i 12 nedelja aktivnosti 3–4 korisnika,
  anonimizovano (bez imena, mejla, ID-jeva) → `web/src/domain/v4/adapters/fixtures/`.
- Kapija: znam formate i raspoložive podatke; ako nešto fali (npr. nema krugova), SPEC to uzima u obzir.

**F1 — specifikacija jezgra [F], 1 tab, ≈ 2–3 h**
- `docs/generators-v4/SPEC.md` + tipovi u `engine/`: `PlanDoc` (verzionisan), `RunnerState` (odrađeno, obim po
  nedeljama, najduži trkovi, forma, umor, datum, zaključano), `Event` (rezultat, propušteno, pauza, bol, umor, ručna
  izmena), `Template` (namera nedelje), `Workout` (unos biblioteke sa oznakama), mera opterećenja i model forme/umora,
  ugovor `plan(state, goal, template) → PlanDoc`, pravila stabilnosti i determinizma, čuvar, format objašnjenja
  promene („zašto se plan promenio").
- Dokaz na papiru: tri prošetana primera (nov plan; ponovno planiranje posle 7 dana bolesti; preuzet tuđi plan).
- Kapija: organizator čita SPEC; mora da pokrije svih 9a/8 zahteva vlasnika; tek onda F2.

**F2 — motor [F], 1 tab, ≈ pola dana**
- Implementacija `engine/` po SPEC-u; bez ijedne distance u kodu.
- Testovi svojstava: determinizam; stabilnost (bez događaja → isti plan); urađeno/zaključano netaknuto; čuvar bez
  nalaza na mreži; ponovno planiranje menja samo od sutra nadalje.
- Kapija: testovi zeleni, ceo skup < 2 min; sintetička „distanca" od 3 unosa u biblioteci daje smislen plan.

**F3 — HM kao podatak [O], 1 tab, uporedo sa krajem F2**
- Šabloni i biblioteka HM iz v3 (znanje, ne kod) → `distances/hm/`; ispis 12 profila u `docs/generators-v4/plans/HM/`.
- Kapija: trener ≥ 77,6 (ne lošije od v3), bezbednost ista ili bolja; otisci HM planova zaključani testom.

**F4 — forma iz trčanja [O] po SPEC-u, uporedo sa F3**
- `fitness/`: procena iz tempa laganih, odrađenog kvaliteta, trka/testova; puls samo višenedeljni trend na laganim;
  radi i bez pulsa. Plafon napretka zavisi od trkača (obim, staž, raniji napredak). Izlaz: polazna forma, trenutna
  procena, raspon na dan trke, objašnjenje.
- Provera na uzorcima iz F0 i na istoriji vlasnika (procena pre Bokeškog 13. 12. naspram rezultata).
- Kapija: procena ne skače na jedan trening (test); na uzorcima daje smer koji ima smisla (pregled organizatora).

**F5 — adapteri [O], 1 tab, posle F2**
- v2 plan (4 distance), stari format, lični plan → PlanDoc. Test: otisak pre = otisak posle na svim uzorcima.
- Kapija: 100 % uzoraka bez razlike; lični plan vlasnika prolazi i ostaje netaknut.

**F6 — merilo [F], uporedo od F3**
- Nova rubrika u tri dela (trener je dao nacrt u `coach/ROUND-V3-HM-03.md`): scenariji prilagođavanja (4 profila × 6
  događaja, uključujući „ništa se nije desilo"), personalizacija (isti ulazi, različita istorija).
- Drugi sudija: zaseban tab, drugačije uputstvo, ne vidi ciljne planove ni ocene prvog. Ako se dva sudije razlikuju
  > 5 poena na profilu — pregled organizatora, po potrebi vlasnika.
- Kapija: obe ocene za HM V4; razlika objašnjena.

**F7 — ostale distance [O], po jedan tab, uporedo (motor zamrznut)**
- Redosled: 10K, 5K, maraton. Za svaku: trener piše ciljne planove za 4 profila → šabloni + biblioteka u
  `distances/<d>/` → krugovi ocene dok dobit ne padne ispod 0,5.
- Zahtev za izmenu motora ide organizatoru (ne menja ga tab distance); svaka izmena motora mora da ostavi otiske
  drugih distanci istim.
- Kapija po distanci: prosek i broj profila na ≥ 80 po § 1; bezbednost bez nalaza.

**F8 — usmeravanje unosa i prikaz [Org → vlasnik]**
- Specifikacija (bez koda u aplikaciji): predlozi pre generisanja (4. dan, duža priprema, kraća distanca, pitanje
  o povratku posle pauze), prikaz forme i raspona, objašnjenje promene plana.
- Kapija: vlasnik odobri pre bilo kakve izmene ekrana.

**F9 — ulazak u aplikaciju [O], samo uz potvrdu vlasnika**
- Iza zastavice; „rad u senci" (V4 pravi plan uporedo sa v2, korisnik vidi v2, poredimo); preuzimanje postojećih
  planova; E2E. Spajanje u `main`, deploy i baza: tek na izričitu potvrdu.

## 5. Raspored prvog dana (12. 11., po Beogradu)

| vreme | šta | ko |
|---|---|---|
| jutro, odmah | F0: grana, baza (SELECT), uzorci | Org |
| posle F0 | F1 SPEC | F (1 tab) |
| uporedo sa F1 | F6: nova rubrika + uputstvo za drugog sudiju; ciljni planovi 10K | F (trener) |
| posle kapije F1 | F2 motor | F (1 tab) |
| od sredine F2 | F3 HM podaci, F4 forma | O (2 taba) |
| posle F2 | F5 adapteri | O (1 tab) |
| kraj dana | ocena HM V4 (trener + drugi sudija), LOG, plan za dan 2 | Org |

Najviše 3–4 taba uporedo (petočasovni limit); satna provera gura zastale tabove; nedeljni limit → stani i javi.

## 6. Pravila za tabove (svaki brief)

Grana `claude/v4`; svoj folder; ništa iz v2; ne diraj aplikaciju, bazu, stare testove; bez push-a sa crvenim testovima;
izveštaj ≤ 80 redova u `docs/generators-v4/reports/`; poruka organizatoru; sudar ili nejasnoća → najmanja odluka u
okviru SPEC-a + zapis, ne staje. Promena smera → organizator prekida tab i šalje novu poruku (ne u red).

## 7. Rizici i kako ih hvatam

- Nestabilnost ponovnog planiranja (plan „šeta") → test stabilnosti od prvog dana; promena samo uz događaj i objašnjenje.
- Naduvana ocena (jedan sudija) → drugi sudija od F6; pregled vlasnika na 2–3 plana po distanci.
- Procena forme iz šumnih podataka → oprezno pravilo, trke kao sidro, radi bez pulsa.
- Motor „procuri" u distance → test: nema imena distance u `engine/`; otisci po distanci.
- Preuzimanje pokvari tuđi plan → otisak pre = posle na stvarnim uzorcima; lični plan se nikad ne prepravlja sam.

## 8. Odluke koje čekaju vlasnika (ne blokiraju dan 1)

1. Maraton za početnika ispod ≈ 35 km/ned: odbiti uz preporuku ili praviti uz upozorenje.
2. Usmeravanje unosa na ekranu (F8) — da li i kako.
3. Šta sa radnom granom v2 (HM i deo maratona imaju „bilo koja dužina plana", nedovršeno): povući ili ostaviti.
4. Kada i kako V4 ulazi u aplikaciju (F9).
