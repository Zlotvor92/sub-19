# Nalog R24-MOTOR — poslednji krug motora V4 (Opus, jedan tab)

Vlasnik (14. 11. 2026): „da se privodi kraju". Ovo je POSLEDNJI krug motora pre ulaska u aplikaciju. Nalog je uzak;
dopune NEĆE stizati usred rada. Polazno stanje: `claude/v4` @ `3efe27dd` ili novije (podatak R24 je već unet:
`f8a2a5dc` 5K, `fb12606` 10K, `3efe27dd` MAR). Provera organizatora na `3efe27dd`: `npx vitest run src/domain/v4
src/integrations/v4` → 78 fajlova, 1250 prolazi + 12 očekivano pada; `tsc` čist.

## Pročitaj (samo ovo)
`AGENTS.md` § V4; `docs/generators-v4/coach/R24-ISPRAVKA.md` — uvod (redovi 1–12), ceo odeljak MOTOR (M1–M6), P1,
i završni deo (a), (b), (c). Izveštaje ocena i LOG.md ne čitaj.

## Stavke, OVIM redom, svaka u svom commitu
0. **Higijena (bez promene ijednog ispisa):** `npm run lint` greška u `engine/plan.ts:608`
   (no-unnecessary-type-assertion); `format:check` — formatiraj fajlove u `domain/v4/**` koji ne prolaze; ponovo
   ispiši zastarele ispise u repou (parovi p1a/p2a, target-compare — zaostali posle R22) i potvrdi da je razlika samo
   ono zaostalo. Posle ovog commita `npm run check` mora biti čist.
1. **M6 + P1** (`build.ts` + sva četiri `safety.ts`) — sa ODLUKOM VLASNIKA (14. 11., ≈ 20:55): plan SME da dobije dan
   manje od traženog (nikad < 3), uz upozorenje u zaglavlju (šta je urađeno i zašto); ako trkač IZRIČITO potvrdi
   traženi broj dana, plan se pravi sa svim danima i ostaje upozorenje o kratkim laganim danima. Uvedi za to jedan
   opcioni ulaz (npr. `confirmedRunDays: true`; ime po tvom izboru, dokumentuj ga u SPEC § 2) — podrazumevano
   nepotvrđeno. Svojstvo: sa potvrdom broj dana == traženi, uvek.
2. **M4** (`build.ts`). 3. **M1** → 4. **M2** → 5. **M5** (`replan.ts`). 6. **M3** (`render.ts`, poslednji).
7. **Nalazi sloja aplikacije (adapter/javni ulaz; ne smeju da promene nijedan ispis plana):**
   (a) adapter od odrađenog dana bez km i vremena pravi `Run` 0 m / 0 s koji `validate` odbija
   (`legacy-mar-pace`, `log:g2d4`) — odrađen dan bez mere mora ostati ODRAĐEN bez neispravnog `Run`-a (izaberi
   oblik, npr. urađeno bez mere; `buildState` nad tim planom ne sme da vrati `inputErrors`);
   (b) adapter prevodi `log[id].lock` u `PlanDay.locked` (`adapters/shared.ts` ≈ 660) — suprotno odluci vlasnika
   (F8-PREDLOG § 9.5: „ručno ispravljen unos" NIJE zaključan dan): ne prevoditi u `locked`; otisak pre = posle mora
   i dalje da važi na svim uzorcima;
   (c) izvezi `painOf` iz adaptera i pomoćnike za datume (`addDays` …) iz javnog ulaza `engine`.
   Posle (a)–(c) testovi u `web/src/integrations/v4/**` moraju proći; ako neki tvrdi staro ponašanje (npr. dozvoljava
   tačno slučaj 0 m), uskladi SAMO tu tvrdnju i navedi je u izveštaju. Ostalo u `integrations/v4` ne diraj (tamo
   uporedo radi drugi tab — pre svakog push-a `git pull --rebase origin claude/v4`).

## Pravila (naučeno u R20/R22 — krug motora ume da popravi 5 i pokvari 4)
- Svaka stavka M ima SVOJSTVO nad mrežom ulaza SVE ČETIRI distance (ne samo tvrdnju nad jednim scenarijem), napisano
  pre izmene i crveno bez nje. Provere iz tačke 5 svake stavke su minimum.
- Motor ne zna za distance: nema grananja po distanci; brojevi idu u `safety.ts` distance.
- Posle SVAKE stavke: ceo V4 skup + otisci. Ispis sme da se promeni SAMO onima koje § (c) dokumenta navodi za tu
  stavku; sve ostalo bajt-isto. Ako se promeni neko van § (c): stani na toj stavci, vrati ili suzi pravilo; ako ne
  ide — ostavi stavku neurađenu i napiši zašto. Ne prilagođavaj otisak ćutke.
- Ostaju ispunjene provere R22 (uvod dokumenta) — imaju svoje testove, ne smeju da padnu ni da se oslabe.
- Ne diraj `templates.ts`/`library.ts`/`texts.ts` distanci osim brojeva u `safety.ts` koje stavka traži. Ne diraj v2,
  HM v1, ekrane, bazu. Ništa u `main`, bez PR-a, bez deploya.
- Ako stavka ne može da se uradi bez rizika po profile koji prolaze — NE radi je, napiši zašto. Bolje 5 čistih
  stavki nego 7 sa regresijom.
- Ne širi nalog: 5K p12, „može da ostane" iz § (b) i sve što nije gore navedeno se NE radi.

## Kraj
Push na `claude/v4` posle svake stavke (rebase pre push-a). Izveštaj `docs/generators-v4/reports/R24-MOTOR.md`
(≤ 80 redova): po stavci — urađeno/neurađeno, SHA, svojstvo, čiji se ispis promenio (poimence, naspram § (c));
završni brojevi testova, `npm run check`, kapije po distanci. Završnu poruku (≤ 25 redova) pošalji `send_message` na
`session_01GnHHiXvCMLj5eDdp2ae77u` — NE na @parent. Zatim stani.
