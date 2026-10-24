# Uslov 7 — izolacija (ugao owner, kod 670700e)

Skripta: `imports.mjs` (iz `web/`: `node ../docs/generators-v2/audit/owner/imports.mjs`). Nezavisno od regex-a testova
izolacije: TypeScript AST, svi `.ts/.tsx/.js/.mjs` fajlovi u `<distanca>/v2/` (i `app/`), statički, `export … from`,
dinamički `import()`/`require()` i `import("x")` u tipovima.

| distanca | produkcioni fajlovi v2 (sa app/) — uvozi van v2/ | izvršnih | type-only |
|---|---|---|---|
| 5K | 13 uvoza, svi `fiveK/exchange.ts` (app/*, app/state/*) | 0 | 13 |
| 10K | 0 | 0 | 0 |
| HM | 0 | 0 | 0 |
| MAR | 0 | 0 | 0 |

- `fiveK/exchange.ts` sadrži samo `export type` iz `domain/state` i `domain/date` → neutralni tipovi, dozvoljeno uslovom 7.
- Testovi (`*.test.ts`) uvoze van v2 (select, flags, plan, drugi v2 za predaju) — testovi su van obuhvata uslova 7 (test
  izolacije ih namerno isključuje).
- Van v2 nijedan ne-test fajl ne uvozi v2 preko `@/…/v2` aliasa ni dinamički (grep `src/`); jedina ivica je
  `<distanca>/index.ts → v2/app/index.ts`, kao što testovi tvrde.
- Rezultat AST skripte se poklapa sa testovima izolacije (nijedan izvršni uvoz van v2) → kršenja nema.

Rupe u testovima (nema trenutnog kršenja, klasa K):
1. `fiveK/v2/isolation.node.test.ts:33` (`if (!inside && !typeOnly)`) propušta BILO KOJI type-only uvoz van v2 (npr.
   `import type {…} from '../../tenK/v2/types.ts'` ili `../../plan`), a `fiveK/exchange.ts:3` tvrdi „dozvoljen je jedino ovaj
   fajl kao izlaz iz modula". Lista izuzetaka nije zapisana u testu. 10K/HM/MAR su stroži (ni type-only).
   Predlog: u 5K testu dozvoliti type-only samo ka `fiveK/exchange.ts`.
2. Provera ivica „van v2 → v2" u 5K (`isolation.node.test.ts:73`) i 10K (`:74`) gleda samo relativne putanje; uvoz preko
   `@/domain/generators/fiveK/v2/...` (alias postoji u `vite.config.ts:38`, `vitest.config.ts:13`) prošao bi. HM/MAR to
   hvataju (`/generators\/halfMarathon\/v2/` → „alias v2"). Predlog: isti uslov u 5K/10K.
3. Svi testovi skidaju komentare regex-om (`strip`), koji bi skinuo i `//`/`/*` unutar stringa; kod danas nema takav
   slučaj (AST skripta daje isti rezultat). Samo napomena.
