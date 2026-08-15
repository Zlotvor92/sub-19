# Testovi

```bash
node --test "test/**/*.test.mjs"     # iz korena repozitorijuma
npm test --prefix test               # isto, kraće
```

Traži Node 20+. **Nema zavisnosti** — sve je iz standardne biblioteke
(`node:test`, `node:assert`, `node:vm`).

## Zašto nema `package.json` u korenu

Aplikacija se na Vercel deployuje **bez build koraka** — statički fajlovi plus
serverless funkcije. `package.json` u korenu bi Vercel protumačio kao Node
projekat i promenio način izgradnje, što je tačno ono na šta upozoravaju
komentari u `api/*.js` (uvoz zajedničkog modula je već jednom oborio funkcije).
Zato su testovi u sopstvenom folderu, sa `.mjs` ekstenzijama (uvek ESM) i
`package.json`-om koji Vercel ne gleda.

## Kako rade

`harness.mjs` izvlači inline `<script>` iz `index.html` i pokreće ga u
`node:vm` kontekstu sa minimalnim lažnim DOM-om (`document`, `localStorage`,
`fetch`, `crypto`, `location`, `navigator`, `alert`, `confirm`). Ništa ne
dodiruje mrežu ni disk.

Aplikacija time ostaje **jedan fajl, nepromenjena zbog testova** — testovi se
prilagođavaju kodu, ne obrnuto.

```js
const app = loadApp();
app.call('vdotFrom5k', 1170);        // poziv funkcije
app.get('CUR_PLAN');                 // čitanje const/let sa vrha skripte
app.evalIn('S.vdotLog.length');      // proizvoljan izraz u kontekstu app-a
app.clock.set('2026-07-02T00:30:00Z') // pomeranje lažnog sata
```

`loadApp({ now: '...' })` postavlja početno vreme — potrebno za testove
prelaska preko ponoći.

## Šta je pokriveno

| Fajl | Šta drži zatvorenim |
|---|---|
| `pure.test.mjs` | Daniels–Gilbert VDOT, inverzi zona, `parseTimeStr`, Riegel, `esc`/`mdToHtml` (XSS) |
| `generator.test.mjs` | `generatePlan` na 96 scenarija × 4 distance — trenerske invarijante, ne fiksni brojevi |
| `state.test.mjs` | migracija šeme, VDOT lanac (idempotentnost), backup ne sme da nosi tokene |
| `danas.test.mjs` | prelazak preko ponoći, datumska aritmetika |
| `api.test.mjs` | serverske funkcije sa lažnim `fetch` — batching, paralelizam, paginacija, autorizacija |
| `doslednost.test.mjs` | poklapanje verzija između fajlova, nosivi identifikatori, CSP, pristupačnost |
| `simetrija-distanci.test.mjs` | zamka za ispravku koja sleti u tri od četiri distance |
| `generator-otisak.test.mjs` | otisak 2304 plana — razlikuje „preuredio sam kod" od „promenio sam trening" |
| `android-paket.test.mjs` | `sub20.apk` naspram repozitorijuma — adresa, ime, paket, otisci ključa |
| `mreza-rok.test.mjs` | mreža koja VISI a ne odbija — zastavice „u toku" se spuštaju, rok se bira po odredištu, nijedna serverska funkcija ne izlazi bez roka |
| `ai-zaglavljen.test.mjs` | AI posao koji se nikad ne završi — ponavljanje, odustajanje, kvota koju neuspeh ne sme da pojede |
| `potvrda.test.mjs` | prigušen `confirm()` ne prolazi kao „ne"; dijalog koji se stvarno prikazao ostaje merodavan |
| `list-dijalog.test.mjs` | modalni list kao prav dijalog — naziv, fokus unutra i nazad, inertna pozadina, Escape, zamka za Tab |
| `requireuser-kopije.test.mjs` | sedam namernih kopija `requireUser` provučeno kroz iste scenarije — duplikat sme da postoji, ali ne sme da se razidje |

## Otisak generatora

Generator drži odvojenu logiku po distanci: 61 funkcija i 25 konstanti nose
sufiks `5K`/`10K`/`21K`/`42K`. To je namerno — izmena za maraton ne sme tiho da
pokvari 5K — ali znači da metodološka ispravka ide ručno u četiri mesta, a kad
sleti u tri, **ništa ne pukne**: plan se i dalje napravi, samo je za jednu
distancu pogrešan.

Dve mreže hvataju tu klasu:

**`simetrija-distanci.test.mjs`** drži ono što mora ostati zajedničko — matricu
familija po distanci, poreklo ograničenja tempa, zagrevanje iz jednog izvora,
smer skaliranja. Ne traži da sve bude svuda (`mkPiramida` postoji samo za 5K i
10K, i tako treba); traži da razlika bude **odluka, a ne previd**.

**`generator-otisak.test.mjs`** pušta generator kroz 2304 scenarija i poredi
sažetak svakog plana sa upisanim otiskom. Invarijante propuštaju sve što je
unutar njihovih granica — kalibracija se može pomeriti za pet posto na jednoj
distanci a da svi ostali testovi ostanu zeleni. Otisak to vidi.

```bash
node test/otisak-generatora.mjs            # osveži otisak (posle NAMERNE izmene)
node test/otisak-generatora.mjs --proveri  # uporedi, bez pisanja
node test/otisak-generatora.mjs --pun "5K · 4d · 30km · std · trenirao · 16n"
```

**Kako se čita pad tog testa.** Ne znači „pokvario si generator" nego „generator
sada pravi drugačiji plan nego pre — je li to bila namera?":

- preuređivao si kod i **nisi** hteo promenu ponašanja → otisak mora ostati
  isti; ako je pao, refaktor je promenio nečiji trening, i to je nalaz;
- menjao si kalibraciju namerno → proveri da su se pomerile baš očekivane
  distance, pa osveži otisak. U commit tada ulazi i izmena i pomeren otisak,
  vidljivo u diffu.

Matrica obima nije proizvoljna. Prva verzija je imala `[12, 30, 55, 80]` i
propuštala izmene: promena `CILJ_OBIM_5K` sa 55 na 56 nije pomerila nijedan
scenario, jer ta granica veže tek na 32–50 km/ned. Otisak koji ne pokriva mesto
gde konstanta radi ne čuva ništa — zato mreža sada ide i kroz taj pojas.

## Načelo za nove testove

Tvrdi **invarijantu**, ne izmerenu vrednost. `assert(deload < prethodna)`
preživljava rekalibraciju; `assert(N8 === 21.7)` puca na svaku izmenu i uči
čoveka da briše testove. (Otisak je namerni izuzetak: on i jeste snimak, i zato
stoji u zasebnom fajlu sa uputstvom kako se osvežava.)

Testiraj **ponašanje**, ne oblik izvornog koda. `assert.match(src, /regex/)`
prolazi i kad kod izgleda ispravno a radi pogrešno — tako je jedna provera
dnevnog limita mesecima tvrdila da je limit na mestu dok se zaobilazio jednim
poljem u JSON-u. Ako zamka ne može da padne, ne čuva ništa: kad je napišeš,
pokvari kod namerno i proveri da zaista pukne.
