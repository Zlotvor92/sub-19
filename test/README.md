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

## Načelo za nove testove

Tvrdi **invarijantu**, ne izmerenu vrednost. `assert(deload < prethodna)`
preživljava rekalibraciju; `assert(N8 === 21.7)` puca na svaku izmenu i uči
čoveka da briše testove.
