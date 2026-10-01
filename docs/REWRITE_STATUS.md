# REWRITE STATUS

Živi dokument. Ažurira se uz svaki commit koji pomera stanje. Plan i kapije: `REWRITE_PLAN.md`.

## Faze

| # | Faza | Stanje | Dokaz |
|---|---|---|---|
| 1 | Audit | **gotovo** | `ARCHITECTURE.md`, `docs/*` |
| 2 | Scaffold | **gotovo** | `web/`: `npm run typecheck && lint && format:check && test && build && e2e` zeleno; legacy `node --test` 1 553/1 553 |
| 3 | Domain (Korak A) | **u toku** — `domain/date` gotov | v. dole |
| 4 | Parity / Korak B | nije počelo | |
| 5–12 | | nije počelo | |

## Domen — moduli (Korak A: port bez promene ponašanja)

| Modul | Stanje | Provera |
|---|---|---|
| `domain/date` | **gotovo** | 27 unit + oracle naspram `addD/diffD/dowOf/mondayOfWeek/nextMonday` na svakom danu 1990–2060, TZ: lokalna, Auckland, São Paulo, Los Angeles, Beograd, Kolkata |
| `domain/training/vdot` | — | |
| `domain/training/constants/{evidence,heuristics,product}` | — | |
| `domain/training/sessions` | — | |
| `domain/training/distances` (5K, 10K, HM, 42K) | — | |
| `domain/training/generator` | — | gate: otisak 2 304/2 304 |
| `domain/training/adaptation` | — | |
| `domain/recovery` | — | |
| `domain/state` (Zod, migrate) | — | |

## Alati i kapije koje već važe

- `tsconfig.domain.json`: `lib: ES2023`, `types: []` — `window`, `document`, `localStorage`, `fetch`, `setTimeout`, `console` ne postoje kao imena u domenu.
- ESLint: zabrana DOM globala, React/Zustand/servisa/`node:*` uvoza, `Date.now()`, `new Date()`, `Math.random()`, `Date.parse` u `src/domain/**`; `dangerouslySetInnerHTML` zabranjen svuda. Dokaz da pravila padaju: `src/domain/isolation.test.ts`.
- Vitest projekti: `domain` (node), `ui` (jsdom), `oracle` (node; poredi sa starim kodom kroz `../test/harness.mjs`).
- Playwright koristi preinstalirani Chromium (`/opt/pw-browsers/chromium`, bez `playwright install`).

## Odstupanja od plana (i zašto)

| Datum | Odstupanje | Razlog |
|---|---|---|
| 2026-10-01 | TypeScript `~6.0.3`, ESLint `^9.39.5` (plan je navodio TS 7.x / ESLint 10.x) | `typescript-eslint@8.71` traži `typescript <6.1`; `eslint-plugin-jsx-a11y@6.10.2` podržava ESLint do 9. Podizanje čeka nove verzije tih paketa. |

## Merenja

| Šta | Vrednost |
|---|---|
| Initial JS, prazna React ljuska | 219 KB / **68 KB gzip** (stara aplikacija: 914 KB / 327 KB gzip) — budžet za celu aplikaciju se postavlja tek kad postoje feature-i |
