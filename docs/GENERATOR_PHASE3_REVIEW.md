# SUB-20 — nezavisni pregled faze 3

Pregled od 11.10.2026. Ovo je nezavisan agentski pregled generatora i očuvanja podataka prema unapred zapisanim kriterijumima `GENERATOR_PHASE3_CRITERIA.md` i primarnim Runna/Hal Higdon izvorima. Nije potvrda ljudskog trenera niti validacija individualne prognoze ili povratka posle povrede.

## Šta je stvarno provereno

Reprodukcija: `node docs/probes/generator-phase3.mjs` u Node 24 iz korena repozitorijuma. Sintetički datum je sreda 25.11.2026, sedma nedelja pripreme. Skripta ne piše stanje korisnika. U `docs/qa/generator-phase3/profiles.json` čuva tačne ulaze, kompletne planove glavnih profila, izvršenje, prihvaćene/isključene dokaze, odluke i pregled svih nedelja. `digest.json` čuva SHA256 izlaza, probe skripte i pregledanih izvora; ponoviti probe nakon završnih izmena koda.

Dvanaest profila pokriva čiste domenske funkcije. Uz njih su proverena **48 kompletna rasporeda povratka**: četiri distance × pauze 7/14/28 dana × 3/4/5 dana trčanja, plus niska osnova 10 km sa pet dana trčanja za svaku distancu/pauzu. Pregledano je svih **960 kalendarskih nedelja** ove dodatne matrice, uz poseban pregled budućih nedelja. Provere prolaze: zbir sesije i km, opis, radni km/tempo PRED reda, QS deonice, jedinstveni ID-jevi, dostupni dani, datum trke, najviše dva zahtevna dana, odsustvo projektovanog VDOT napretka i povratnički rast do 8% + 0,11 km tolerancije za zaokruživanje. Rast posle deload-a poredi se s prethodnom uspostavljenom punom nedeljom; delimična prva nedelja i sama trka nisu pogrešno tretirane kao puna nedeljna osnova.

## Glavni profili

| Profil                      | Zabeležen ishod                                                                                                                            | Domet dokaza                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P01 uredno izvršenje        | 100% pokrivenost; medijana punih nedelja 47,6 km; nema predloga promene                                                                    | Domenski uslov prolazi                                                                                                                                                                   |
| P02 jedan izostanak         | Jedan potvrđeni izostanak; savet bez nadoknade i bez regeneracije                                                                          | Domenski uslov prolazi                                                                                                                                                                   |
| P03 prazna istorija         | 0 ostvarenih km, 0 potvrđenih izostanaka; nepoznata baza i trajanje eventualne pauze                                                       | Domenski uslov prolazi                                                                                                                                                                   |
| P04 slabije izvršenje       | Dve pune slabije nedelje; stvarna baza 29,8 km i ponovljiva dužina 10,1 km; predlog smanjenja                                              | Domenski uslov prolazi                                                                                                                                                                   |
| P05 pauza 7 dana            | Sam nalaz razmaka traži potvrdu; potvrđen povratak sa 85% prijavljene baze, dve početne kalendarske nedelje bez kvaliteta                  | Domenski uslov prolazi                                                                                                                                                                   |
| P06 pauza 14 dana           | Potvrđen povratak sa 70% baze; tri početne nedelje bez kvaliteta; cela buduća kriva prati novu osnovu                                      | Domenski uslov prolazi                                                                                                                                                                   |
| P07 pauza 28 dana           | Skoriji ostvareni obim je nula, ne vraća se ranija velika baza; uz eksplicitno prijavljenu bazu 55% i četiri početne nedelje bez kvaliteta | Domenski uslov prolazi; stari PB ostaje referenca ograničene pouzdanosti                                                                                                                 |
| P08 malo vremena            | Rebuild odbijen kada je do trke manje od četiri nedelje; datum i taper nisu sabijeni                                                       | Domenski uslov prolazi                                                                                                                                                                   |
| P09 nepouzdana forma        | Tri stara zapisa isključena, budući datum isključen, `done` bez km isključen; jedan izolovan brzi trening ostaje samo jedan dan dokaza     | Domenski uslov prolazi                                                                                                                                                                   |
| P10 visok napor             | Četiri prihvaćena sveža dana merenja, ali dva laka treninga sa RPE 8; analiza traži pregled/smanjenje                                      | Detekcija, pozitivni evidence gate i store ograničenje zbog bola/RPE/razmaka prolaze u zasebnim unit testovima                                                                           |
| P11 istorija i ručne izmene | Prošli dani tekuće nedelje, budući `done`, dužina pomerena na prošli efektivni datum, ručna sesija i buduće zaključano merenje sačuvani    | Graft, javna promena cilja i javna rekalibracija prolaze; ulazi nepromenjeni                                                                                                             |
| P12 verzije i povratak      | Jedan upis verzije, JSON round-trip, najviše pet verzija; snapshot sadrži samo plan; budući graft ne menja nov dnevnik                     | Domenska provera i store unit tok prolaze: čisti preview, jednokratna primena, odbijanje replay-a/starih i falsifikovanih predloga, čuvanje kasnijeg dnevnika, migracija/JSON round-trip |

P10 i P12 imaju dodatnu proveru, nezavisno pokrenutu 11.10.2026: `npx vitest run src/stores/executionActions.test.ts src/domain/training/adaptation/evidence.test.ts` — **36 testova, dva fajla, svi prolaze**. Proverena su odbijanja promene dnevnika, merenja, zaključavanja, pomeranja, ručnih izmena, VDOT/3K rezultata, dana i oporavka između preview-a i primene. Test potvrđuje jednu verziju, odbijanje ponovljene primene, zaštitu od izmenjenog/falsifikovanog preview-a i povratak koji čuva kasniji `done`. Migracija v11→v12 i JSON round-trip čuvaju novu zonu i verzije. To nije zamena za browser persist/reload proveru; konačni UI/E2E/CI rezultat vodi se u checkpoint-u faze 3.

## Doza potvrđenog povratka

Isti polazni profil prijavljuje 40 km nedeljno i ponovljivu dužinu 12 km. Prva kalendarska nedelja je delimična i sadrži zaštićene stare dane; zato se porede prve **pune buduće** nedelje. Vrhovi su budući rad pre same trke.

| Pauza   | Polazna osnova nakon smanjenja | Prve četiri pune buduće nedelje (km) | Budući vrh km | Najduži budući LR | Najviše zahtevnih dana |
| ------- | -----------------------------: | ------------------------------------ | ------------: | ----------------: | ---------------------: |
| 7 dana  |                             34 | 35,4 → 36,8 → 26,8 → 38,3            |          48,4 |              16,6 |                      2 |
| 14 dana |                             28 | 29,2 → 30,4 → 22,2 → 31,6            |          40,0 |              13,6 |                      2 |
| 28 dana |                             22 | 23,3 → 24,4 → 17,9 → 25,7            |          32,9 |              10,6 |                      2 |

Pad četvrte/slične kalendarske nedelje je deload, a povratak se računa prema prethodnoj uspostavljenoj nedelji. Prve 2/3/4 kalendarske nedelje potvrđenog povratka nemaju nove kvalitetne sesije, ubrzanja ni brzi završetak dužine. Sačuvana stara sesija nije ponovo propisana: zaštićeni prošli dan ostaje deo istorijskog plana.

Procenti 85/70/55, period bez kvaliteta i granica rasta jesu transparentna konzervativna pravila proizvoda. Nisu univerzalne fiziološke konstante. Ako nema pouzdane baze, korisnik mora prijaviti trenutnu/ponovljivu osnovu; nedostatak unosa nije dokaz odsustva trčanja. Stari PB se ne pretvara u novu dokazanu formu.

## Nalaz pronađen tokom nezavisnog pregleda

Dodatna matrica je otkrila da nakon 28 dana pauze kvalitetni minimum/budžet može napraviti rast **17,0 → 19,2 km (+12,9%)** za 10K/HM sa tri dana, odnosno **21,3 → 23,9 (+12,2%)** za HM sa četiri dana. Nije vraćena stara kriva 40 km, ali oprezan povratnički plafon nije poštovan. Nalaz je prosleđen implementacionom agentu i uveden je `guardReturnGrowth`: ceo preveliki trening se odlaže/zamenjuje lakim, kilometri i opis ostaju usklađeni, PRED/QS se ponovo izvode. Ponovljena matrica od 48 rasporeda nema ovu povredu plafona, uključujući osnovu 10 km/pet dana.

## Poređenje s javnim trenerskim principima

Runna i Higdon podržavaju razlikovanje pojedinačnog izostanka od duže pauze, izbegavanje sabijanja propuštenog rada i prilagođavanje budućnosti trenutnoj osnovi. SUB-20 to sada ostvaruje regeneracijom celog preostalog bloka, očuvanjem već odrađenih dana i pregledom pre primene. Ne kopira njihove pojedinačne brojčane savete kao univerzalne pragove.

Posebna razlika: Runna Realignment javno opisuje detekciju više netaknutih treninga. Naš zahtev da prazan dnevnik ostane nepoznat jeste **pravilo pouzdanosti SUB-20**, ne tvrdnja o potpuno istom Runna mehanizmu. Runna javno navodi da Realignment nema undo; ograničene plan-only verzije SUB-20 jesu dodatna funkcija proizvoda.

Preostale granice su jasno odvojene: simulacija nije dokaz da će korisnik istrčati cilj; predviđanje iz treninga nije trkački rezultat; povratak posle povrede nije odobren čistom generacijom plana. Izvori i konkretni ulazi omogućavaju pregled stvarnom treneru bez prihvatanja tih tvrdnji.
