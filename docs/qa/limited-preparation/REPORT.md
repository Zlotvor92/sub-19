# Odluka proizvoda kada baza ili vreme ne omogućavaju punu pripremu

Baza: `fix/hm-quality-progression` (`c2d1589`), koji sadrži faze 1–3, zaključan QA `f8cb2081ed4ba223fe7efe14a621144beb9bce0d`, finalizaciju isporučenog plana, svrhu pre doze, dozu po iskustvu i HM progresiju. Originalni generator-ab ulazi, raw/blind planovi, događaji, trenerske ocene i izlazi prethodnih segmenata nisu menjani. Novi izlazi su samo u ovom direktorijumu; proba proverava SHA256 izvornih događaja pre i posle čitanja.

## Zaključak

Ograničena priprema za polumaraton/maraton više nije samo upozorenje uz plan koji izgleda kao puna priprema. Rezultat ima eksplicitan mod i konkretne opcije, a pun ciklus koji je odbijen dobija naredni korak:

- **U09/U10**: povratak do postojećeg datuma je označen kao *povratni plan — nije puna priprema za maraton* (sažetak, upozorenja, „Cela priprema“, pregled promene). Odluka navodi pravila pune pripreme, isporučene vrednosti, uslove nastavka i opcije.
- **U08**: odbijen HM ciklus od osam nedelja i dalje se odbija istom porukom, ali sada nudi tri primenljive opcije: pomeranje trke na 21.02.2027, 10K istog datuma ili povratni/bazni režim bez vremenskog cilja. Svaka uklanja T rad i 22 km LR iz povratnog perioda.
- Datum, distanca i cilj menjaju se samo kroz prikazan pregled (`Pre → Posle`) i dugme za primenu. Preview/apply/restore i očuvanje dnevnika prolaze u domenskim, store, UI i browser testovima.

Generator (`generatePlan`) nije menjan; otisak od 2.304 scenarija i oracle snimci su nepromenjeni.

## Uzroci (pre)

| Nalaz | Mesto | Uzrok |
|---|---|---|
| U09 povratak: LR 8,8 km i 29 km/ned pred maraton, prikazan kao isti maratonski plan sa limited upozorenjem | `executionAdjustment.ts` | Odluka o vrsti proizvoda nije postojala; `assessPreparation` je davao samo `limited` razloge u `dayWarnings`. |
| U10 povratak: LR 17,3 km, isto | isto | isto |
| U08: odbijen novi HM ciklus; stari plan zadržava T 27.11. i LR 22 km 29.11. odmah posle pauze | `buildExecutionAdjustment` → `{ error }` | Greška je bila jedini izlaz; UI nije imao nastavak, a nepromenjen budući raspored izgleda kao preporuka. |
| Nijedan ekran ne razlikuje povratni plan od pune pripreme | `preparation.ts`, `PlanOverview.tsx` | `preparationSummary` je znao samo `limited/developing/supported` oznaku. |

## Promena ponašanja

1. **`domain/plan/regenerate.ts`** — izdvojen deljeni put regeneracije budućeg plana (generator → guard rasta → lake povratne nedelje → graft sa zaštitom). `buildExecutionAdjustment` daje bajt-identičan plan kao pre za isti ulaz (provereno dvostrukim checkout-om `c2d1589` nad zamrznutim U02, U03, U04, U06, U07, U08 raniji, U09, U09 zaštićeni i U10: `weeks`, `pred`, `qs`, `ulaz` i meta bez novih polja identični; U08 glavna greška identična; razlika je samo dodata izjava i sažetak kod ograničenih dugih distanci — U07, U08 raniji, U09, U10); povratni prozor računa se isto (`start = dan posle unosa`, `end = ponedeljak početka + N nedelja`). U meta podatke se sada upisuje i `reportedLongRunKm`, da kasnija odluka zna prijavljenu dužinu pre pauze.
2. **`domain/plan/preparationDecision.ts`** — odluka:
   - `preparationCoverage`: `full` (isporučeno nije `limited`), `distance` (najduže ≥ zahtevane dužine, vrhunac ne podržava vremenski cilj), `insufficient`.
   - **Pomeranje trke**: nedeljna pretraga do 52 nedelje kasnije (prvo kraj horizonta, pa najraniji datum) kroz isti pipeline kao primena; nudi se samo datum čiji *isporučen* plan je `full`. Ako ga nema, opcija se ne izmišlja nego se navodi najveća dostignuta dužina/obim.
   - **Kraća distanca** istog datuma (M→HM→10K, HM→10K→5K): prva sa pokrivenom dužinom; vremenski cilj se ne prenosi (`goalSec: null`) i to je vidljivo u pregledu.
   - **Povratni/bazni režim**: samo lako trčanje na postojećim danima, rast najviše 8%/ned (postojeći return guard) do prijavljene baze i dužine pre pauze; trka ostaje u kalendaru bez vremenskog cilja; dani trkačke nedelje ne prelaze originalne. Nikad se ne prikazuje kao puna priprema (pokrivenost najviše `distance`).
   - **Uslovi nastavka**: povratni blok sa datumom, potvrda rasta baze/dužine upisanim treninzima, najkasniji početak punog ciklusa za postojeći datum (trka − `minWeeks`).
   - Svi izbori prolaze kroz `graftFuturePlan`: završeni dani, stvarni km/min, efektivni datumi pomeranja, ručne izmene i merom zaključani PRED ostaju bajt-identični; ručni budući konflikt je naveden.
3. **`executionAdjustment.ts`** — limited dugi povratak: sažetak „… — povratni plan do postojećeg datuma, nije puna priprema za maraton“, `meta.cycleDecision = { kind: 'limited' }`, izjava i uslovi na vrhu napomena. Odbijen ciklus vraća `{ error, decision }`; poruka greške je ista.
4. **`preparation.ts` / `PlanOverview.tsx`** — `fullPreparation` i `mode` („Povratni plan do postojećeg datuma — nije puna priprema za maraton“, „Ograničena priprema — …“, „Povratni/bazni režim bez vremenskog cilja — …“) uz uputstvo gde su opcije.
5. **Store `executionActions.ts`** — `previewPreparationChoice` (sa istim potvrđenim podacima izvršenja ili sa sačuvanim činjenicama plana), `storedPreparationDecision` za već sačuvan ograničen plan i plan u baznom režimu (tada bez ponovne bazne opcije). Primena koristi postojeći `commitPlanChange` (zaštita od zastarelog/falsifikovanog pregleda, jedna revizija). Razlog revizije: `goal` za datum/distancu, `execution` za bazni režim.
6. **UI `ExecutionAdjustment.tsx`** — sekcija „Odluka o pripremi“: izjava, uslovi, objašnjene nedostupne opcije, kartice opcija sa datumom, LR, vrhuncem i pokrivenošću; dugme „Pregledaj opciju“; pregled promene prikazuje `Pre`/`Posle` (datum · distanca · cilj).

## Pre / posle (zaključani događaji)

Kompletni zapisi: `U08.json`, `U09.json`, `U10.json`; sažetak `summary.json`. Proba: `node --experimental-strip-types docs/probes/limited-preparation.mjs`.

### U08 — HM iskusan, pauza 14 dana, 25.11.2026, trka 17.01.2027

**Pre (f8cb2081):** „Preostalo vreme ne podržava novi pun ciklus … Datum trke nije automatski pomeren.“ Bez nastavka. Stari raspored u povratnom periodu (do 14.12.): 5 zahtevnih dana, 27.11. Tempo isprekidan 11,1 km, 29.11. LR 22 km, 13.12. LR 22 km.

**Posle:** ista greška + odluka „Pun ciklus za polumaraton nije moguć … Postojeći budući raspored nije preporuka za povratak — izaberi naredni korak.“

| Opcija | Datum | Distanca | Cilj | Pokrivenost | LR / vrhunac | Zahtevnih dana u povratnom periodu | Najduže u povratnom periodu |
|---|---|---|---|---|---|---:|---:|
| Pomeri trku | 21.02.2027 | HM | 1:35:00 | puna | 16,3 / 51,5 | 0 | 12,5 km |
| Kraća distanca | 17.01.2027 | 10K | bez | puna | 13,9 / 44,7 | 0 | 12,5 km |
| Povratni/bazni režim | 17.01.2027 | HM | bez | dužina | 16 / 54,8 | 0 | 13,1 km |

### U09 — prvi maraton, pauza 14 dana

**Pre:** „Povratak posle 14 dana pauze, baza 21 km“; LR 8,8 km, 29 km/ned; samo `limited` razlozi u upozorenjima.

**Posle:** „Povratak posle 14 dana pauze, baza 21 km — povratni plan do postojećeg datuma, nije puna priprema za maraton“. Izjava: najduže 8,8 km / vrhunac 29 km/ned naspram pravila ≥ 26 km, 2 × ≥ 22,1 km, ≥ 55 km/ned. Pomeranje: *nedostupno* — do 52 nedelje kasnije najviše 17,7 km i 42,2 km/ned (pravilo rasta jednog ciklusa ograničava vrhunac na max(1,75 × baza, baza + 20 km)). Opcije: 10K istog datuma (dužina pokrivena, 11,3 km / 32,7 km/ned) i povratni/bazni režim (10 km / 29,8 km/ned, nije puna priprema). Najkasniji početak punog ciklusa za ovaj datum: 06.12.2026.

### U10 — iskusan maraton, pauza 28 dana

**Pre:** „Povratak posle 28 dana pauze, baza 33 km“; LR 17,3 km.

**Posle:** povratni plan, nije puna priprema za maraton. Pomeranje nedostupno (najviše 24,9 km / 62,2 km/ned do 52 nedelje). Opcije: polumaraton istog datuma (puna priprema po pravilima, 19,3 / 47,2) i povratni/bazni režim (24 / 60, nije puna priprema).

Dodatni nalaz: raniji dozvoljeni U08 povratak (28.10.) isporučuje LR 15,4 km < 16 km, pa je po istim pravilima takođe označen kao ograničen i dobija bliži datum 24.01.2027.

## Testovi

| Sloj | Datoteka | Šta dokazuje |
|---|---|---|
| Domen | `web/src/domain/plan/preparationDecision.node.test.ts` (12) | U09/U10 oznaka i opcije; U08 odbijanje + tri opcije; uklonjen T/LR iz povratnog prozora; produžetak menja samo datum; bazni režim lak, ≤ 8% rasta, ≤ prijavljene baze/LR, trka bez cilja, delimična prva nedelja, trkačka nedelja; kraća distanca; odbijanje izbora van ponude; U09 zaštićeni scenario (ručni, pomereni, mereni, završeni dani) kroz svaku opciju, JSON perzistenciju i restore; sačuvan plan ponovo koristi činjenice povratka; kratka distanca bez odluke; zamrznute datoteke bajt-identične. |
| Store | `web/src/stores/preparationDecision.node.test.ts` (3) | Pravi store sa zaključanim U08 stanjem: odbijanje → bazni pregled → primena → upis stvarnog treninga (km/min/datum) → restore; dnevnik nepromenjen kroz sve; zastareo pregled odbijen; nastavak iz baznog režima nudi pomeranje/10K. |
| UI | `web/src/features/plan/ExecutionAdjustment.test.tsx` (+2) | Opcije posle odbijanja, `Pre/Posle` u pregledu, primena tek na dugme; sačuvan ograničen plan prikazuje odluku. |
| Browser | `web/e2e/generator-ab-users.spec.ts` | U08: tri opcije, bazni pregled, primena, reload, nastavak iz baznog režima, restore na isti km/tip svih dana. U09/U10: pregled i odluka nose „nije puna priprema za maraton“. |

Promena postojećih testova: mock u `ExecutionAdjustment.test.tsx` dobija dve nove store funkcije (nova zavisnost komponente); nijedno postojeće očekivanje nije promenjeno.

## Ograničenja

- Pravila pune pripreme (26/16 km, 2 izlaganja ≥ 85%, `minPeakKm`, `minWeeks`) i 8% rasta su postojeće proizvodne heuristike, ne fiziološki zakon. Ova promena ih samo eksplicitno koristi u odluci.
- Pretraga datuma ide do 52 nedelje i ne garantuje monotonost; nudi najraniji pronađen datum sa punom pripremom.
- U09/U10 nemaju opciju pomeranja jer generator iz potvrđene povratne baze u jednom ciklusu ne dostiže pravila punog maratona (U10 LR staje na 24,9 km). Da li je to ispravna trenerska granica za iskusnog maratonca nije potvrđeno; to je pitanje generatora, ne ove odluke.
- Bazni režim U08 vraća obim na 54,8 km/ned za pet nedelja (8%/ned) i nema taper pred trku jer trka nema vremenski cilj. To treba kalibrisati sa trenerom.
- Odluka za sačuvan plan bez potvrđenog povratka koristi originalni ulaz plana (kao promena cilja); ne pretpostavlja napredak koji nije upisan.
- Novi plan U08/U09/U10 nije ponovo ocenjen od četiri trenerska agenta; ovo nije trenerska validacija.
