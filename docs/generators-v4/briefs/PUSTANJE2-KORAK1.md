# Nalog DRUGO PUŠTANJE, korak 1 — trajno preuzimanje u V4 i uklanjanje starih planova (Opus, jedan tab)

Odluka vlasnika (15. 11. 2026): „Puštaj drugo puštanje." Osnov: `docs/generators-v4/f9/BRISANJE-PLAN.md`
(`cdb3213d`) — § 2a, 2b, 2d, 3, § 4 korak 1 i § 6 „Odluke vlasnika". Ovaj tab radi SAMO korak 1 iz § 4. Brisanje
v2/v1 koda (koraci 2–7) NE počinješ. V4 je od 11:44 u produkciji (`main` = `638c9e04`); radiš na `claude/v4`.

## Odluke vlasnika (konačne, ne preispituješ)
1. U V4 trajno (red u `plan_v4`) prelaze samo v2 planovi čija trka NIJE prošla i lični plan vlasnika. Plan se
   preuzima onako kako ga adapter da; ako otisak nije isti — preuzima se uz upozorenje u zaglavlju.
2. Sve ostalo (plan starog formata, v2 sa prošlom trkom, nepoznat oblik) se uklanja sa svim podacima vezanim za plan;
   korisnik vidi samo čarobnjak. Spisak polja: § 2d.
3. Lični plan vlasnika više nije zaštićen do 13. 12.: prelazi u V4; preuzimanje ga ne menja (AGENTS § V4 t. 8).

## Stanje baze (organizator, samo zbir, 15. 11. ≈ 12:10 po Beogradu)
22 naloga imaju `genPlan`: 3 v2 (trke 6. 1. – 26. 2. 2027, sva tri aktivna) i 19 starog formata. Vlasnikov nalog
(`ADMIN_UID`) NEMA `genPlan` (lični plan mu dolazi iz koda) — § 2b tvrdnja „na vlasnikovom nalogu prednost ima
genPlan v2" u praksi se ne dešava, ali pravilo prednosti ličnog plana svejedno napiši i testiraj.

## Uradi (svaka celina svoj commit)
1. `kindOfStoredPlan` (jedno mesto, npr. `integrations/v4/detect.ts`): `licni` | `v2` | `v2-prosla-trka` | `stari` |
   `nepoznat` | `nema`. Test `detect.test.ts` nad svim uzorcima + granični slučajevi iz § 2b/2d (v2 ključ bez
   `policyId` → `v2`; „danas" po Beogradu; trka danas = nije prošla).
2. Trajno preuzimanje: pri otvaranju, posle učitavanja, kad `plan_v4` nema reda a vrsta je `v2` ili `licni` →
   adapter → `commitAction` (upis u `plan_v4`); idempotentno (drugi uređaj / drugo otvaranje ne pravi drugi upis ni
   sukob); različit otisak → upis + upozorenje u zaglavlju; greška adaptera → NIŠTA se ne upisuje i NIŠTA se ne
   briše (plan ostaje kako jeste), događaj se beleži. Ukloni `personalProtected` / `PERSONAL_PROTECTED_UNTIL`; lični
   plan ima prednost nad `genPlan` na istom nalogu. `user_state` v2 korisnika i vlasnika se NE menja.
3. `discardLegacyPlan` (= današnji `discardPlan` + `vanPlana`/`vanPlanaV2` + `ui.seenWeek`/`ui.snooze`, tačno po
   § 2d) i čuvar: za vrste `stari`, `v2-prosla-trka`, `nepoznat` pri otvaranju → uklanjanje → čarobnjak. NIKAD za
   `v2`, `licni`, `nema`. Uklanja se `LegacyPlanNotice` put. Test svojstva: posle radnje ostaju tačno polja iz
   § 2d „ostaje"; v2 i lični plan netaknuti.
4. E2E (lažna mreža): v2 korisnik (trka u budućnosti) → posle otvaranja red u `plan_v4`, isti prikaz kao pre; drugi
   uređaj → bez duplog upisa; korisnik sa starim planom → samo čarobnjak i prazna polja; vlasnik → lični plan u
   `plan_v4`, prikaz isti kao pre. Postojeće E2E ne slabi; one koje su tvrdile „stari prikaz" za stari format prevedi
   na novo ponašanje i navedi poimence.
5. `npm run check`, ceo E2E, `npm run build`; pošto se dira `web/src/domain/**` samo ako baš mora — ako ga diraš,
   i `npm run check:full` (u pozadini, čekaj kraj). Push na `claude/v4`; prati CI do zelenog (GitHub MCP alati kroz
   ToolSearch); istek vremena na CI-ju → duži rok iz merenja, bez skip-a.

## Granice
- NE diraš bazu (ni `select`), `main`, deploy, PR. SQL iz § 2d NE izvršavaš.
- NE brišeš v2/v1 kod, adaptere ni fiksture (koraci 2–7 dolaze kasnije).
- Ne menjaš motor ni podatke distanci. Ne slabiš i ne brišeš testove.
- Ako nešto u kodu protivreči dokumentu ili odluci — STANI i javi tačno šta.
- Štedljivo: čitaj samo ono što celina traži. Na ≈ 60 % konteksta stani na čistom commitu.

## Kraj
Izveštaj `docs/generators-v4/reports/PUSTANJE2-KORAK1.md` (≤ 50 redova): po celini SHA, testovi/E2E brojevima, koje
postojeće testove si menjao i kako, stanje CI, rizici pri puštanju. Završna poruka ≤ 20 redova `send_message` na
`session_01GnHHiXvCMLj5eDdp2ae77u` — NE na @parent. Zatim stani.
