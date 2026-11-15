# Nalog F9-PRIPREMA — priprema ulaska V4 u aplikaciju (Opus, jedan tab, etapa 1)

Nalog vlasnika (14. 11. 2026, ≈ 20:35 po Beogradu): „Kreni preko opusa polako da spremaš integraciju u samu
aplikaciju." Ovo je PRIPREMA, ne ulazak: ništa se ne uključuje korisnicima.

## Granice (bez izuzetka)
- Grana `claude/v4` (svež klon: `git fetch --unshallow origin claude/v4`; ništa ne briši). Ništa u `main`, bez PR-a,
  bez deploya, bez IKAKVOG upisa u bazu (ni migracije, ni Supabase grane); baza samo SELECT ako baš treba.
- Ne diraj `web/src/domain/v4/**` (generator se još ocenjuje; drugi tabovi rade na njemu) ni v2 / zamrznut HM v1.
- Etapa 1 ne menja nijedan postojeći fajl aplikacije. Izlaz su dokument i nacrti u `docs/generators-v4/f9/`.
- Vremena po Beogradu. Ne izmišljaj brojeve; tvrdnje označi [visoka]/[srednja]/[niska]; ono što nisi proverio u
  kodu napiši kao neprovereno.
- Štedljivo: ne čitaj LOG.md ni runde ocena; ne pokreći `check:full`; bez podagenata osim ako pretraga to traži.

## Pročitaj (samo ovo)
`AGENTS.md` § V4 (tačke 1, 2, 7, 8, 9a, 12); `docs/generators-v4/F8-PREDLOG.md` § 5–9 (§ 9 su ODLUKE VLASNIKA i
imaju prednost nad predlozima iznad); `docs/generators-v4/SPEC.md` samo delove na koje se pozoveš (§ 2 tipovi);
javni ulaz motora i adaptera u `web/src/domain/v4/` (potpisi, ne unutrašnjost).

## Etapa 1 — izlaz: `docs/generators-v4/f9/INTEGRACIJA.md` (≤ 250 redova) + nacrti
1. **Šavovi u aplikaciji (popis iz koda, sa putanjama i redovima):** gde se danas plan pravi, čuva, čita i
   prikazuje (`genPlan`, `log`, `alts`, `moves`, `user_state`, sinhronizacija, Strava uvoz, ekrani plana/dana/
   podešavanja, „Generiši nov plan", `select.isLegacyPlan`). Za svaki šav: šta V4 tu treba i da li je izmena
   ekrana, stanja ili servisa.
2. **Sloj između aplikacije i V4** (predlog foldera i potpisa, bez koda): (a) stanje aplikacije + aktivnosti →
   ulaz motora; (b) `PlanDoc` → ono što ekrani danas očekuju (ili novi prikaz); (c) događaji (izvedeni iz forme /
   prijavljeni) po odluci § 9.1; (d) premeštanje/ručna izmena kao činjenica po § 9.5; (e) preuzimanje starih
   planova adapterom (AGENTS tačka 8: otisak pre = posle).
3. **Baza (samo nacrt, NE izvršavati):** `docs/generators-v4/f9/nacrt-tabele.sql` — tabele za aktivnosti, plan V4 i
   događaje po § 9.2 (`user_state` se ne dira), sa RLS-om po uzoru na postojeće SQL fajlove u repou; uz svaku
   tabelu: ko piše, ko čita, veličina po korisniku, kako se vraća nazad.
4. **Strava:** šta današnji uvoz vuče naspram onoga što § 9.3 traži; važeća ograničenja Strava API-ja PROVERI
   pretragom zvanične dokumentacije i navedi izvor i datum provere (ako ne možeš da proveriš — napiši „nije
   provereno", bez broja).
5. **Zastavica i vraćanje nazad:** kako se V4 pali samo vlasniku (po korisniku, na serveru) iako je odluka § 9.6
   „sve odjednom"; šta tačno gašenje vraća; šta se dešava sa ličnim planom vlasnika (zaštićen do 13. 12. 2026).
6. **Redosled rada u koracima koji se mogu pojedinačno proveriti** (svaki: šta se menja, koji testovi/E2E ga
   brane, šta traži potvrdu vlasnika — baza, deploy, `main`), sa grubom veličinom (mali/srednji/veliki, bez sati).
7. **Otvorena pitanja za vlasnika** — najviše 6, svako sa predlogom tako da „da" prihvata predlog; samo ona čiji
   odgovor menja oblik rada.
8. **Rizici:** šta u današnjoj aplikaciji može da pukne pri ulasku (sinhronizacija „poslednji upis pobeđuje",
   istorija 40 verzija, veličina dokumenta, stari planovi bez generatora) i čime se to brani.

## Kraj
Commit + `git push -u origin claude/v4` (samo `docs/generators-v4/f9/**`). Završnu poruku (≤ 40 redova: šta je
nađeno, 3 najveća rizika, pitanja za vlasnika, predlog etape 2) pošalji `send_message` na session_id
`session_01GnHHiXvCMLj5eDdp2ae77u` (organizator) — NE na @parent. Zatim STANI i čekaj; etapu 2 (kod) ne počinji sam.
