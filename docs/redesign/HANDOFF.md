# Quiet Athlete — stanje rada i šta ostaje (privremena beleška)

Grana: `claude/quiet-athlete` (pushovana). Nema PR-a (nije traženo).

## Gotovo i proveravano
- Novi UI: 4 taba (Danas, Plan, Napredak, Ti), ekrani iznad taba sa istorijom (Back), svetla/tamna/sistemska tema, logo + PWA ikone.
- `npm run typecheck`, `eslint src`, `vitest run` (118 fajlova / 1228 testova) prolaze; produkcioni build prolazi.
- E2E prebačen na novu strukturu; poslednji pun prolaz 56/57, pa popravljeni selektori + dodat test fokusa (nije ponovo pokrenut posle poslednjeg builda).

## Šta još nije urađeno
1. Workflow `quiet-athlete-audit` (id wf_3f823617-b35): audit parnosti stari/novi UI + vizuelni QA na 320/390/430/820/1440 px. Rezultati nisu pročitani/primenjeni. Ako sesija umre: relaunch sa `resumeFromRunId`.
2. Workflow `quiet-athlete-docs` (id wf_d6cceb7e-c8d): `web/public/uputstvo.html` i `docs/redesign/QUIET_ATHLETE.md` su delimično upisani; recenzija nije završena. Sekcija `<!-- PROVERA -->` u QUIET_ATHLETE.md je prazna.
3. Ponovni build + pun e2e (`npx playwright test`), pa `npx vitest run src/pwa/static.node.test.ts` (uputstvo mora da prolazi).
4. Manifest screenshotovi (`web/public/screenshot-*.webp`, 720x1558) su stari; generator je `web/e2e/_manifest.spec.ts` (lokalni, nije u repou) + PIL konverzija u WebP, pa ažurirati `labels` u `manifest.json`.
5. Android APK/TWA nije prebuildan.
6. Nije bilo testiranja sa pravim korisnicima — samo sopstvena provera (`web/e2e/navigation.spec.ts`).
