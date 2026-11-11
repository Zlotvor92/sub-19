# Uputstvo za agente

## Radna grana — OBAVEZNO

Sve izmene, od sada pa nadalje, rade se na grani **`claude/generator-isolation-5k-10k-hm-marathon`**.

- **Ne pravi novu granu.** Ni za novi zadatak, ni za novi segment, ni za ispravku.
- Pre rada: `git fetch origin claude/generator-isolation-5k-10k-hm-marathon` i
  `git checkout claude/generator-isolation-5k-10k-hm-marathon` (pa `git pull origin claude/generator-isolation-5k-10k-hm-marathon`).
- Commit i push idu na tu istu granu: `git push -u origin claude/generator-isolation-5k-10k-hm-marathon`.
- Ako sesija/okruženje dodeli drugu granu, ipak radi na ovoj; ako to nije moguće, stani i javi umesto da praviš novu.
- Grana sadrži sva četiri izdvojena generatora (5K, 10K, polumaraton, maraton). Stanje izdvajanja:
  `docs/generator-isolation/STATUS.md`.

## Vreme — OBAVEZNO

Sva vremena koja se javljaju korisniku (iz baze, logova, CI-ja, bilo odakle) navode se
isključivo po beogradskom vremenu (`Europe/Belgrade`, CET/CEST), ne u UTC. U SQL-u:
`... at time zone 'Europe/Belgrade'`.

## Stalni uslovi za v2 generatore (sve distance)

Svaki v2 segment bilo koje distance mora ih ispuniti i izvestiti o njima.

1. Jedan vlasnik odluke: obim, doza kvaliteta, dužina dugog, WU/CD imaju
   po jedno mesto odlučivanja. Bez petlji uzastopnog skraćivanja/dopune.
   Validator samo prijavljuje.
2. Jedan plafon po zoni, nema dva limita za istu stvar.
3. WU/CD su trenerski deo treninga, ne pufer za km. Manjak obima ide u
   lagane dane ili se prijavljuje kao planirano < cilj.
4. Adaptacija (kad bude): uslovi poznati unapred ulaze u konstruktor;
   završna zaštita samo štiti urađeno, stvarne km/min, datume, ručne
   izmene i zaključane treninge.
5. Handoff (kad bude): kao cilj prima samo činjenice i sam određuje
   povratnu politiku; kao izvor ne šalje svoju politiku.
6. Plan nosi policyId/policyVersion i fazu svake nedelje iz odluke
   generatora.
7. Nula uvoza van foldera distance (osim type-only neutralnih tipova),
   proverava test, bez novih izuzetaka.
8. Upotrebljivost, ne samo aritmetika: test obara degenerisan plan
   (nedelja ispod minimalnog smislenog obima, prazan trening, dugi < lagan).

## V4 generator — pravila (odluka vlasnika, 11. 11. 2026: organizator određuje kako generator najbolje radi)

Vlasnik je ukinuo stara pravila za NOVI generator i prepustio organizatoru da ih odredi. Sve iznad („Stalni uslovi za
v2", radna grana) i ispod („Testovi i sabotaže") važi samo za stari v2 kod, koji je zamrznut i ne dorađuje se. Za V4
važi isključivo ovaj odeljak.

**Arhitektura**
1. Plan je podatak (`PlanDoc`, verzionisan): plan → nedelje → dani → trening. Generisani i ručno uneti plan imaju isti
   oblik; posle nastanka se ne zna ko je autor.
2. Planiranje iz stanja: generator je čista funkcija (stanje trkača danas, cilj i datum trke, šablon) → ostatak plana.
   Adaptacija nije poseban sistem nego ponovno planiranje od stvarnog stanja; urađeno, zaključano i ručno izmenjeno
   se ne dira. Isto stanje daje isti plan (determinizam); bez događaja plan se ne menja (stabilnost).
3. Zajednički motor + distanca kao podatak: motor ne zna za distance (nema grananja po distanci); šabloni, biblioteka
   treninga i brojevi bezbednosti su podaci u folderu distance; distance se međusobno ne uvoze.
4. Šablon nosi nameru (faza, opterećenje kao % vrha, uloga dugog, vrsta podražaja); konkretan trening se bira iz
   biblioteke treninga po oznakama. Nov sadržaj = nov unos u biblioteku, ne nov kod.
5. Jedna mera opterećenja (minuti rada ponderisani intenzitetom) i jedan model forme/umora; kilometri se izvode.
6. Čuvar bezbednosti je mali i samo prijavljuje; odbija se samo neispravan unos. Loš unos (premalo dana, obima,
   vremena) dobija najbolji mogući plan i jasnu preporuku šta da promeni.
7. Ništa se ne prenosi iz v2 (ni kod, ni tipovi, ni testovi). Jedini izuzetak je tačka 8: čitanje starih PLANOVA
   kao podataka.
8. Preuzimanje postojećih planova (zahtev vlasnika): V4 mora da radi nad planovima koji već postoje u aplikaciji
   (v2 planovi u bazi, planovi starog formata) i nad ličnim planom vlasnika. Za svaki stari format postoji adapter
   → `PlanDoc` (jedino mesto koje zna stari format; samo čita, ništa ne piše u stari plan). Pravila preuzimanja:
   (a) preuzimanje samo po sebi NE menja plan — isti datumi, treninzi, urađeno, zaključano i ručne izmene (test:
   otisak pre = otisak posle); (b) preostale nedelje starog plana postaju šablon (namera autora se čuva), V4 ih menja
   tek na događaj (rezultat, umor, pauza, bol, propušten trening) ili na izričit zahtev korisnika; (c) lični plan
   vlasnika ima prednost nad svakim pravilom šablona — čuvar ga samo upozorava, nikad ne prepravlja sam.

9a. Napredak se čita iz trčanja (zahtev vlasnika): forma trkača nije jedan uneti rezultat nego procena koja se
   obnavlja iz sinhronizovanih treninga (Strava): tempo i puls na laganim trčanjima, odrađeni kvalitet (da li je
   zadati tempo držan i uz koji napor), testovi i trke. Plan prikazuje polaznu formu, trenutnu procenu i očekivani
   raspon na dan trke; tempa u planu prate procenu naviše i naniže. Procena je oprezna (ne skače na jedan dobar
   trening), objašnjiva („zašto se promenilo") i nikad ne menja urađeno.
   Puls dolazi sa zglobnog sata (vlasnik i korisnici ne nose grudnu traku): koristi se samo kao trend kroz više
   nedelja na ravnomernim laganim trčanjima; na intervalima, kratkim deonicama i pojedinačnom treningu se ne koristi.
   Glavni signali su tempo, odrađeni kvalitet i trke; procena mora da radi i potpuno bez pulsa.

**Kvalitet**
9. Merilo je ocena trenera istom rubrikom + drugi, nezavisan sudija koji ne vidi ciljne planove + pregled vlasnika.
   Izmena koja spusti ocenu ili bezbednost se ne prihvata.
10. Testovi su brzi (ceo skup V4 u minutima): svojstva nad mrežom ulaza, čuvar bez nalaza, otisci planova po distanci
   (izmena motora ne sme nenamerno da promeni plan druge distance). Bez višesatnih matrica.

**Rad**
11. V4 se razvija na grani `claude/v4` dok ne zameni v2 u aplikaciji. Organizator vodi; tabovi rade na Opus 5.5,
    a za baš složene stvari (jezgro motora, model stanja i opterećenja, trenerski sud) organizator sme da odredi
    Fable 5.2.
12. Ostaje bez izuzetka: ništa u `main`, bez deploya, bez izmene baze i bez PR-a bez izričite potvrde vlasnika;
    vremena po beogradskom vremenu; lični plan vlasnika (zamrznut HM v1) i v2 rade dok ih V4 ne zameni.

## Testovi i sabotaže

- Segment: `npm run check` (brz nivo, iz `web/`) + NAMENSKI testovi onoga što je menjano: `npx vitest run --changed
  <polazni SHA>` (vitest sam bira testove koji uvoze promenjene fajlove; sa `TEST_FULL=1` i pun nivo tih testova) +
  E2E dirane distance. Pun nivo celog foldera samo kad je menjan generator te distance:
  `TEST_FULL=1 npx vitest run --project node <folder>`.
- v1 generatori (V1b, 10. 11. 2026): 5K, 10K i maraton v1 su obrisani; nov plan pravi samo v2. Ostaje SAMO zamrznut
  HM v1 (`halfMarathon/` van `v2/`, kod se ne menja) za ugrađeni lični plan vlasnika (`meta.licni`), do V1c posle
  13. 12. 2026; dokaz `personalPlan.node.test.ts` trči u redovnom `node` projektu (projekat `v1` je ukinut). Planovi
  starog generatora u bazi nemaju generator (`select.isLegacyPlan`): prikazuju se, unos radi, poruka + „Generiši nov
  plan". Testovi prikaza nad planom starog formata koriste zamrznute fiksture `src/test/legacyPlans.ts` i
  `src/test/legacyAdapt.ts` (snimljene jednom pre brisanja, ne prave se ponovo).
  `npm run check:full` (45–75 min, skoro sve su mreže generatora) se lokalno pokreće SAMO kad je menjan domenski kod
  (`web/src/domain/**` — generatori v2, zamrznut HM v1, zajednički domen, reference) ili test infrastruktura, i tada jednom, pre
  mergea u main; nikad po segmentu. Izmene koje ne diraju `src/domain/**` ni test infrastrukturu (ekrani, stil, tekst,
  `features/`, `components/`, dokumentacija): `npm run check` + E2E dirnutih ekrana + `npm run build` — bez lokalnog
  `check:full`, ni pre mergea. CI na svaki push koda bira po DOMETU IZMENE od poslednjeg zelenog run-a grane
  (`web/scripts/ciScope.mjs`, TEST-SPEED.md § 13): „sve" (pun nivo `npm test` u 10 delova, E2E u 3,
  statičke provere) na `main`-u, ručno, bez zelenog run-a i kad push dira bilo šta zajedničko ili nepoznato (`web/src/test/`,
  `web/scripts/`, zavisnosti, konfiguracija, workflow, domen van `generators/<D>/v2/`); inače pun nivo
  samo test fajlova čiji graf uvoza ili fajlovi koje čitaju sadrže promenjen fajl (izmena jedne distance v2 → njeni
  testovi + oni koji je uvoze; ekran → njegovi UI testovi), E2E samo kad se menja aplikacija, statičke provere kad se
  menja `web/`; push koji ne dira kod koji testovi vide (npr. `.claude/`) ne pokreće web poslove; push samo `docs/**`
  ne pokreće CI; dok run radi, čeka samo najnoviji push iste grane. U main tek kad je CI zelen. Nivoi, uzorci i
  merenja: `docs/testing/TEST-SPEED.md`.
- Sabotaže samo kroz `web/scripts/sabotage.mjs`, na fajlovima koji treba da ih uhvate, sa `--bail=1`; nikad ceo
  skup. Uputstvo: `docs/testing/SABOTAGE.md`.
