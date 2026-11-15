# Nalog R25-POPRAVKA — upozorenja u zaglavlju (Opus, jedan tab, uzak)

Završna ocena trenera (R25, stanje `b8ad0bb6`, `coach/ROUND-V4-*-15/-08/-06/-06.md` § D) našla je regresije koje je
uveo R24 M3 („najviše 3 upozorenja") i jedan stariji nalaz. Sve krši AGENTS § V4 t. 6: upozorenje MORA da sadrži
šta je problem, šta to znači za trku i KONKRETAN predlog (koliko nedelja, koliki obim, koliko dana ili koja kraća
distanca). Dopune neće stizati usred rada.

## Pročitaj (samo ovo)
`AGENTS.md` § V4 t. 6; `reports/R24-MOTOR.md` odeljak M3; § D u `coach/ROUND-V4-MAR-06.md`, `-HM-15.md`, `-10K-08.md`,
`-5K-06.md`; `engine/render.ts` i mesto gde nastaju upozorenja.

## Uradi (svaka stavka svoj commit, svojstvo nad sve četiri distance, crveno bez izmene)
1. Granica „najviše 3 upozorenja + jedna »Pomoglo bi i«" ne sme da izbaci: (a) predlog kraće distance, (b) stavku o
   stažu/iskustvu, (c) stavku da je cilj van očekivanog raspona. Prvenstvo: bezbednost i predlog kraće distance pre
   svega ostalog. Pogođeni: parovi P2 B (HM, 10 km, MAR — maraton početnika sa 5 nedelja staža mora da dobije „trči
   polumaraton"), MAR P1 B (cilj 3:27:30 van raspona).
2. „Pomoglo bi i" ne sme da sadrži rečenicu bez prethodnika („te nedelje trči kako piše …" kad je stavka na koju se
   odnosi izbačena).
3. Nijedno upozorenje nema prazan `proposal`: `malo-dana` i `kratak-dugi` (primer: maraton, početnik, 8 nedelja, 10
   km/ned) dobijaju konkretan predlog. Svojstvo: nad mrežom ulaza svako upozorenje ima neprazan problem, posledicu i
   predlog.
4. 5K p02: oznaka „vršna nedelja" je na 2. od 8 nedelja — mora biti na nedelji najvećeg obima (svojstvo nad svim
   distancama: oznaka „vršna" = nedelja najvećeg opterećenja pre sužavanja).

## Granice
- Menja se SAMO tekst zaglavlja/upozorenja i oznaka vršne nedelje; nijedan trening, km ni minut plana se ne menja
  (test: dani svih planova bajt-isti; razlika samo u zaglavlju/oznaci).
- Motor ne grana po distanci. Ne diraj šablone/biblioteke distanci, `integrations/`, `services/`, ekrane, bazu. Ništa
  u `main`, bez PR-a, deploya. Na grani uporedo radi tab aplikacije — `git pull --rebase origin claude/v4` pre push-a.
- Ne širi nalog (M5, dugi posle pripremne trke, 5 km profili se NE rade ovde).
- Posle svake stavke: `npx vitest run src/domain/v4 src/integrations/v4` + ponovo ispisani planovi; na kraju
  `npm run check`.

## Kraj
Izveštaj `docs/generators-v4/reports/R25-POPRAVKA.md` (≤ 40 redova: po stavci SHA, svojstvo, čiji se ispis zaglavlja
promenio poimence; potvrda da su dani bajt-isti). Završna poruka ≤ 15 redova `send_message` na
`session_01GnHHiXvCMLj5eDdp2ae77u` — NE na @parent. Zatim stani.
