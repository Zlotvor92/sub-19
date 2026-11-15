# Nalog BRISANJE-1 — popis i plan: svi planovi na V4, brisanje v2, v1 i duplog koda (Opus, jedan tab, SAMO DOKUMENT)

Odluka vlasnika (15. 11. 2026, ≈ 10:45 po Beogradu): „Sve planove koji su aktivni prebaci na V4, a zatim se V2
kompletno briše. Briši i V1 i moj plan prebaci na V4. Prvobitna ideja: svi planovi idu na V4, svi [stari] generatori
se brišu i uklanja se sav dupli kod." Ovim se menjaju ranije odluke: lični plan vlasnika više NIJE zaštićen do
13. 12. (prelazi na V4 kao i ostali), i više nema „starog prikaza" kao rezerve.

Ovaj nalog je ETAPA 1: popis i plan. NE menjaš nijedan fajl koda ni testa, ne diraš bazu, `main`, deploy. Uporedo
traje puštanje V4 (drugi tab radi CI na `claude/v4`) — zato samo čitaš.

## Stanje koje treba da znaš
- V4: `web/src/domain/v4/**` (motor, distance, adapteri starih formata → `PlanDoc`), `web/src/integrations/v4/**`,
  `web/src/services/v4/**`, `web/src/stores/v4Store.ts`. Prikaz pod V4 danas ide: `PlanDoc` → `toResolved` →
  postojeći `resolvePlan` aplikacije (znači deo starog domena je i dalje u upotrebi kao prikaz).
- Staro: `web/src/domain/generators/{fiveK,tenK,halfMarathon,marathon}/v2/**`, zamrznut HM v1
  (`domain/generators/halfMarathon/` van `v2/`), `domain/personal/**` + `data/personalPlan.ts` (lični plan vlasnika,
  HM v1), `select.ts` (`isLegacyPlan`), `handoff.ts`, `contract.ts`, zajednički domen, reference/fiksture, CI domet
  (`web/scripts/ciScope.mjs`), `vercel.json` (`VITE_V2_DEFAULT_ON=1`), zastavice.
- Baza (produkcija, organizator izbrojao, samo zbir): 31 nalog; 22 imaju plan u `user_state.data.genPlan` (oko 3 su
  v2 — ključevi `tenKV2`/`hmV2` — ostalo stari format); 4 naloga aktivna u poslednjih 14 dana, 3 sa planom.
  `plan_v4` je prazan. Preuzimanje danas radi u memoriji pri otvaranju (uz isti otisak), ne upisuje se.

## Izlaz: `docs/generators-v4/f9/BRISANJE-PLAN.md` (≤ 220 redova)
1. **Popis po folderima** (putanja, broj fajlova i redova, ko ga uvozi): šta je (a) čist v2/v1 generator — briše se;
   (b) stari kod koji V4 put i dalje koristi (prikaz `resolvePlan`, tipovi `StoredWeek`, Strava uparivanje po
   `d.tag`, log/alts/moves …) — navedi tačno koje funkcije i ko ih zove; (c) dupli kod (ista stvar na dva mesta:
   npr. pravila ponovljena u sloju i u motoru, v2 i V4 verzije iste funkcije) — sa predlogom koja ostaje;
   (d) testovi i fiksture koji postoje samo zbog (a); (e) infrastruktura vezana za staro (ciScope, sabotaže,
   `check:full` mreže, zastavice, `VITE_V2_DEFAULT_ON`, `AGENTS.md` odeljci).
2. **Prebacivanje planova na V4 (trajno):** kako svaki aktivan plan postaje red u `plan_v4`: pri prvom otvaranju
   aplikacije na uređaju (adapter → `commitAction`) — šta sa `log`/`alts`/`moves`/`vanPlana` (ostaju kao izvor
   istine za urađeno ili se prenose), šta je „aktivan plan" (ima `genPlan` i trka nije prošla? navedi pravilo iz
   koda), šta sa planom čija je trka prošla, šta sa nalogom koji se mesecima ne otvori (adapteri ostaju zauvek kao
   deo V4 — potvrdi da adapteri NE uvoze ništa iz (a)). Lični plan vlasnika: kako iz `data/personalPlan.ts` nastaje
   red u `plan_v4` (AGENTS § V4 t. 8: preuzimanje ne menja plan; menja se tek na događaj) i šta se posle briše.
3. **Plan bez istog otiska kad „starog prikaza" više nema:** predloži pravilo (npr. preuzima se kako adapter da,
   nalaz se beleži) i kako to unapred proveriti nad stvarnim planovima bez iznošenja podataka (skripta koju vlasnik
   ili organizator pusti sa `select`-om, vraća samo brojeve „isti/različit" po formatu).
4. **Redosled brisanja u koracima koji se pojedinačno proveravaju** (svaki: šta se briše, šta mora da ostane
   zeleno, veličina mali/srednji/veliki): npr. 1 trajno preuzimanje + lični plan → 2 prikaz bez v2 puta →
   3 brisanje v2 generatora po distanci → 4 HM v1 + `domain/personal` → 5 zajednički ostaci, zastavice,
   `VITE_V2_DEFAULT_ON` → 6 testovi/fiksture/CI domet/dokumentacija → 7 dupli kod unutar V4 sloja.
5. **Rizici i šta se gubi:** vraćanje nazad posle brisanja (samo Vercel prethodni deployment), E2E koji danas
   brane v2 put (koliko ih je, šta sa njima — prevod na V4 put, ne brisanje pokrivenosti), byteSame/oracle testovi.
6. **Pitanja za vlasnika** — najviše 4, svako sa predlogom („da" prihvata).

## Granice
Samo taj jedan dokument; commit samo njega; `git pull --rebase origin claude/v4` pa push. Brojeve dobij iz koda
(`find`/`wc`/`grep`), ne procenjuj; što nisi proverio napiši kao neprovereno. Vremena po Beogradu.
Završna poruka ≤ 25 redova (veličine po grupama a–e, redosled, 3 najveća rizika, pitanja) `send_message` na
`session_01GnHHiXvCMLj5eDdp2ae77u` — NE na @parent. Zatim stani; brisanje ne počinji.
