# CUTOVER — prelazak produkcije sa starog frontenda na `web/`

**Stanje: pripremljeno i probano u pregledaču, NE izvršeno.** Ovaj repozitorijum nema pristup Vercel-u, pa produkcija i dalje servira stari frontend (`index.html` + `app.js`).
Sve ispod je ono što vlasnik (ili neko sa pristupom Vercel projektu) radi; svaki korak ima dokaz ili je izričito označen kao **neproveren**.

## Šta se tačno menja

Backend (`api/*.js`, `supabase/`), domen, Supabase projekat, Vercel projekat i `vercel.json` zaglavlja (CSP, cron, `maxDuration`) **ostaju isti**. Menja se samo odakle Vercel uzima statiku:

| Šta | Sada | Posle |
|---|---|---|
| Install | — | `npm ci --prefix web` |
| Build | — | `npm run build --prefix web` (`tsc -b && vite build`, ~20 s) |
| Izlaz | koren repozitorijuma | `web/dist` |
| Funkcije | `api/*.js` | `api/*.js` (isto — Vercel ih nalazi u korenu, pored `outputDirectory`) — **neproveren** na Vercel-u |

Predlog izmene je `web/deploy/vercel.cutover.json`. Test `web/deploy/cutover.node.test.ts` dokazuje da je **identičan** trenutnom `vercel.json` osim tri ključa (`installCommand`, `buildCommand`, `outputDirectory`):
zaglavlja (CSP), `crons` i `functions` se ne razlikuju ni u jednom znaku.

Dva fajla koja stoje u korenu a moraju na javnu adresu (`.well-known/assetlinks.json` — bez njega Android aplikacija gubi pun ekran, i `sub20.apk`) build kopira u `web/dist`
(`vite.config.ts` → `rootStatic`); test proverava da su bajt-za-bajt isti. Pri Phase 12 sele se u `web/public/` i dodatak postaje prazan hod.

## Preduslovi (proveriti pre svega)

1. **Node na Vercel-u ≥ 22.12** (`web/package.json` → `engines`; Vite 8 i testovi traže Node 22). Project Settings → General → Node.js Version = 22.x. **Neproveren.**
2. **Supabase → Authentication → URL Configuration**: *Redirect URLs* mora da sadrži adresu na kojoj se proverava (preview domen), inače prijava vraća na „Site URL" i preview se ne može probati do kraja. Na produkcionom domenu ništa se ne menja.
3. **Strava** (Authorization Callback Domain) i **intervals.icu** (redirect URI) vezani su za produkcioni domen — njih na preview-u nije moguće probati, samo na produkciji (ili uz dodatu adresu).
4. `.vercelignore` danas ima red `web/` (da se `web/` ne servira dok je stari frontend produkcija). Pri cutover-u taj red se **briše**; redovi `docs/`, `ARCHITECTURE.md`, `REWRITE_REPORT.md`, `supabase/`, `scripts/`, `test/` ostaju (ne smeju na javnu adresu).

## Preview pre produkcije (preporučeno)

Vercel za svaku granu pravi preview iz **`vercel.json` te grane**. Zato se probni cutover radi na posebnoj grani, ne na `main`:

```
git switch -c preview/new-frontend claude/sub20-frontend-rewrite-q6dlvr
cp web/deploy/vercel.cutover.json vercel.json
sed -i '/^web\/$/d' .vercelignore       # i komentar iznad njega
git commit -am "preview: novi frontend" && git push -u origin preview/new-frontend
```

Preview URL → lista za proveru (sve su tokovi koji su u E2E dokazani protiv LAŽNOG backenda; ovde se proveravaju protiv pravog):

- [ ] Otvaranje bez naloga: kapija; „Prijavi se Google nalogom" vodi na Google i vraća se prijavljen (traži preduslov 2).
- [ ] **Postojeći nalog sa podacima** (najvažnije): plan, unosi, forma i oporavak su isti kao u staroj aplikaciji; nema čarobnjaka.
- [ ] „Završi trening" → unos se pojavi na drugom uređaju posle sinhronizacije.
- [ ] Podešavanja → Podaci → „Izvezi backup" daje fajl koji **stari** frontend ume da uveze (i obrnuto).
- [ ] Uključi/isključi obaveštenja (stvarna dozvola + test obaveštenje).
- [ ] Analiza treninga (stvarni `/api/analyze`, kvota), Strava uvoz, intervals.icu povlačenje (na produkcionom domenu).
- [ ] Instalirana PWA (v282) → „Dostupna je nova verzija" → „Osveži" (u E2E dokazano; ovde na pravom uređaju).
- [ ] Android (TWA): aplikacija se otvara bez trake sa adresom (`/.well-known/assetlinks.json` vraća JSON).

## Cutover

1. `main` ← grana sa `web/` (PR/merge; nema force-push).
2. Na toj istoj `main` grani: `vercel.json` ← `web/deploy/vercel.cutover.json`, iz `.vercelignore` brisanje reda `web/`.
3. Deploy. Prvi zahtev vraća novi `index.html`; instalirane kopije (stari SW `sub19-cache-v282`) dobijaju novi `sw.js`, ponude „Osveži", i posle klika **prelaze na novi frontend sa istim podacima**
   (u pregledaču dokazano: `e2e/cutover.spec.ts` — stari frontend pravi plan i unos, deploy se simulira preklopom servera, stari SW preuzima novi, novi frontend čita isto, stari keš se briše).
4. Stari `app.js` više ne postoji na adresi; ko je još na starom SW-u dobija novi `index.html` (network-first) — nema „stare aplikacije iz keša" (isti test).

## Povratak (rollback)

Vercel → Deployments → prethodni deploy → *Promote to Production* (trenutno), ili `git revert` cutover commit-a. **Podaci su kompatibilni u oba smera**: `e2e/cutover.spec.ts`
(drugi test) dokazuje da stari frontend čita stanje koje je upisao novi (isti `user_state`, isti ključevi skladišta, isti oblik v11). Nijedna šema se ne menja, pa rollback ne traži migraciju.

## Posle uspešnog cutover-a (Phase 12 — tek tada)

Uklanjanje starog frontenda je **posebna** izmena, tek kad je produkcija proverena. Brišu se: `app.js`, `index.html` (stari), `sw.js`, `sw-reg.js` (kopija je u `web/public/`), stari frontend testovi iz `test/` **čije je pokrivanje preneto** (v. tabelu u `REWRITE_STATUS.md`),
a ostaju: `api/*`, `supabase/`, `test/api.test.mjs` i ostali testovi nad backendom, `.well-known/`, `sub20.apk` (premestiti u `web/public/`). Oracle testovi (`*.oracle.test.ts`) zavise od `app.js` — brišu se **zajedno** sa njim, a njihova
pokrivenost ostaje u običnim testovima i golden-master otisku.
