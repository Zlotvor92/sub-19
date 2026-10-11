# SUB-20 — Faza 1: popravke generatora i zapis za nastavak

Datum: 11.10.2026.
Polazni commit: `aea8dc66e5e6a9940ce48d63a94daace76be1297`.
Grana: `fix/generator-phase1`.

## Rezultat

Popravljene su potvrđene greške koje su uticale na stvarno isporučene treninge i tačnost prikaza. Novi planovi koriste potvrđenu trenutnu formu; proizvoljna linearna prognoza napretka uklonjena je. Procena napretka prema stvarnom planu ostaje zadatak faze 2.

| Problem | Popravka |
| --- | --- |
| Tempo intervali nestaju pri sukobu minimuma i budžeta | Factory bira ponavljanja koja staju u budžet. Finalna provera skraćuje deonice ili bira kratak kontinuirani prag uz objašnjenje. |
| I/R trening nestaje pri malom budžetu | Kada je smisleno, skraćuje deonice uz očuvanje postojećih limita, trajanja I rada i oporavka. Ako nije moguće, odlaganje je izričito opisano. |
| MLR izostaje iz zbira | Pravi deficit uključuje srednje dugo trčanje; nema lažnog dopunjavanja zagrevanja/hlađenja. |
| LR granica prestaje da važi posle rezanja | Završna puna nedelja ponovo proverava profilnu granicu i postojeći izuzetak da LR ostane duži od kvalitetne sesije. Predugi lagani/MLR dani se usklađuju. |
| Protokol trke menja prethodnu taper nedelju | I ta nedelja ponovo prolazi finalne provere. Filtriranje početne delimične nedelje ne pravi novi veštački LR limit. |
| Zastarelo trajanje/gorivo/brz završetak LR | Opis i završetak izračunavaju se iz konačne kilometraže. |
| Progresivna sesija gubi ukupnu kilometražu pri ograničenju T dela | Smanjuje se samo doza završnog rada; preostala kilometraža postaje izričito lagano zagrevanje/hlađenje. Prikaz segmenata i trajanja prati istu strukturu. |
| HM podela 60/40 zapravo je 60/60 | Drugi T dan koristi 40% kada prvi koristi 60%. |
| Isti trening daje različitu prognozu po „agresivnosti” | Uklonjena neosnovana prognoza. Novi marker razlikuje referencu trenutne forme od starih sačuvanih procena. Neaktivni izbor „tempo napretka” uklonjen iz wizarda; izbor rasta obima ostaje. |
| Cilj i ritam dana trke protivreče jedan drugom | Željeni cilj se prikazuje odvojeno od preporučenog tempa i vremena koje taj tempo daje. |

## Dokazi pre/posle

- Ponovo proverena 33 audit scenarija: 31 uspešan plan i dva očekivano odbijena ulaza.
- Sub-20 profil 30 km/4 dana: 23 → 27 kvalitetnih sesija pre trkačke nedelje. Četiri ranije izgubljena treninga ostaju u planu.
- HM visokog obima, prva nedelja: dopunjavanje WU/CD 3,5/3,0 → 3,3/2,8 km, jer MLR sada ulazi u zbir.
- Niska maratonska varijanta zadržava maksimalnu dužinu 16 km: ovaj trenerski problem nije proglašen rešenim. Reference trenutne forme nisu potvrda maratonske spremnosti.
- Kontrolisana mreža 144 plana: greške konačnog LR plafona 456 → 0; netačni nedeljni zbirovi 0 → 0; radne nedelje bez kvaliteta 88 → 1. Preostali slučaj sa vrlo malom bazom ima izričito obrazloženo odlaganje.
- Sam referentni udeo LR može i dalje biti prekoračen tamo gde postoji dokumentovani izuzetak za najdužu kvalitetnu sesiju. To se ne računa kao kršenje konačne formule.

Podaci: `docs/qa/generator-phase1/comparison.json`, `before-probes.json`, `after-probes.json` i `inputs.json`.

## Provere

- Završni `npm run check` je prošao: TypeScript, ESLint, Prettier i svih 1.262 testa u 123 test fajla. `npm run build` je takođe prošao.
- Novi nezavisni testovi: reprodukcije MLR greške, stvarne finalne LR granice, trajanja/goriva, protokola trke, delimične početne nedelje, HM podele i cilja/ritma trke.
- Sesije: regresije za zadržavanje T/I/R stimulusa, dozu, oporavak, očuvanje obima i idempotentnost.
- UI: trenutna referenca forme, kompatibilnost starih sačuvanih procena i tačni segmenti progresivnog treninga.
- Pregledane namerne promene baseline-a: svih 2.304 hash-a se menja zbog novog marker-a/forme; 1.164 scenarija menja nedeljni obim, 366 broj kvalitetnih sesija. Baseline je osvežen posle nezavisnih provera. Promene nisu dokaz trenerske validnosti svih scenarija.
- Browser E2E u ovom okruženju nije verifikovan: nema Chromium izvršne datoteke; pokušaj preuzimanja Playwright browsera je neuspešan. Unit/UI provere ne zamenjuju ovaj tok. Relevantni postojeći E2E testovi ostaju za CI.

## Komande za nastavak

```sh
cd web
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npx playwright install chromium
CI=1 npx playwright test e2e/plan.spec.ts e2e/recalibrate.spec.ts --workers=2
```

Reprodukcija svih audit ulaza sa Node 24, iz korena repozitorijuma:

```sh
node docs/probes/generator-phase1.mjs
node docs/probes/generator-phase1.mjs /tmp/sub20-phase1-plans.json
```

## Sledeći korak: faza 2

1. Proveriti commit/granu i status CI; završiti browser proveru ako nije izvršena.
2. Definisati očekivani plan za osam reprezentativnih profila, pre dalje izmene pravila.
3. Dodati nedavni obim, ponovljivu dužinu, datum rezultata, kontinuitet, iskustvo i pauzu uz kompatibilnost postojećih podataka.
4. Odvojiti procene brzine, izdržljivosti i iskustva; odvojiti obim i težinu.
5. Razviti zasebnu progresiju dužine i kvalitetne doze po distanci, počev od 5K/10K pa HM/maraton.
6. Doraditi smislenost male maratonske pripreme, HM plato 14 km, osnovu prognoze i preostale krute izbore treninga.
7. Kada q2 nestane zbog brzog LR završetka, proceniti i ponovo složiti dozu preostalog q1; sadašnja 60/40 ispravka ne rešava celu tu odluku.

Faza 3 ostaje odvojena: pouzdana analiza odrađenih treninga, preporuke prilagođavanja, pauza/povratak i verzije plana. Postojeći sačuvani planovi nisu automatski prepisani.
