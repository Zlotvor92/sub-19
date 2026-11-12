# F1 — izveštaj: specifikacija jezgra V4 (12. 11. 2026)

Isporučeno: `docs/generators-v4/SPEC.md` (13 odeljaka + pojmovi), `web/src/domain/v4/engine/types.ts` (samo tipovi i
dve konstante verzije, nula uvoza). Provera: `tsc -b --noEmit` (ceo `web/`), ESLint i Prettier nad `types.ts` — čisto.
Ništa drugo nije menjano. Brojevi u primerima (§ 12) su izračunati skriptom po formulama iz § 5–7, ne procenjeni.

## Šta je odlučeno

1. **Plan je podatak bez „urađeno".** `PlanDoc` nosi nameru nedelje, dane i treninge kao korake; urađeno je `Run` sa
   `dayId` u stanju. Dan motor sme da menja samo ako je budući, nije ručni, nije zaključan, nije urađen i plan nije
   zaštićen — jedna funkcija (`isMutable`).
2. **Tempa žive u zaglavlju, dani nose zone.** Tekst treninga nema brojeve tempa. Promena forme menja jedno polje
   (`paceVdot`), nijedan dan → nema „šetanja". Histereza: 0,5 VDOT i 14 dana; trka/test odmah od 0,3.
3. **Jedna mera opterećenja**: minuti × težina iz brzine u odnosu na prag (E 1,0 · M 1,5 · T 2,0 · I/R 3,0); tempo
   trke dobija težinu iz iste formule preko `distanceM` (maraton 1,55 … 5 km 2,70) — bez grananja po distanci.
4. **Baza i umor** = eksponencijalne sredine 42 / 7 dana. Vrh plana: `P = B / startPct` (jedan broj šablona).
   Ciljevi nedelja, dugi, doze, budžet brzog rada i lagani dani imaju po jednog vlasnika i po jedan prolaz unapred.
5. **Povratak iz stanja, jedna rampa za sve**: posle napora `R = ceil(min / 7)` dana, posle pauze
   `R = ceil(1,5 × dani)`; `f = 0,4 → 1`; kvalitet od `f ≥ 0,8`. Isto pravilo daje 4 dana posle 5 km, 15 posle
   polumaratona, 33 posle maratona; isti modifikator koriste `plan` i `replan` (plan dan posle trke nema brze deonice).
6. **Stabilnost po konstrukciji**: `decisions` se čitaju, ne preračunavaju; dan se uvek gradi iz namere pa se
   primene modifikatori; događaji imaju determinističan `id`; neutralni događaji se ne upisuju → bez događaja je
   izlaz bajt-isti ulaz.
7. **Najmanja dovoljna promena** po događaju (tabela § 6.4): običan propušten trening = ništa; ključan = samo
   sledeće isto mesto; pauza 3–13 dana = rampa + pravilo rasta; ≥ 14 dana, promena datuma ili dana = ostatak plana.
8. **Forma iz trčanja**: trke i testovi su sidro (`k` 0,7 / 0,5), odrađen kvalitet najviše 0,1 VDOT po treningu i
   0,3 nedeljno, puls samo kao trend ≥ 4 nedelje na ravnomernim laganim (najviše ± 0,5 u 14 dana), radi bez pulsa.
   Plafon napretka zavisi od staža, rasta obima i ranijeg napretka; raspon na dan trke se pomera sa procenom.
9. **Šablon i biblioteka su čisti podaci**: rep + telo po fazama + rasterećenje; unos biblioteke ima oblik glavnog
   dela (`MainSet`, 9 vrsta) koji doza skalira; izbor = filter po zahtevima + smena po rednom broju pojavljivanja.
10. **Preuzimanje**: adapter daje `PlanDoc` + činjenice; otisak kao kanonski tekst mora biti jednak pre i posle;
    preostale nedelje dobijaju izvedenu nameru i ne menjaju se bez događaja; lični plan vlasnika je `protected`.
11. **Odbija se samo neispravan unos** (6 šifara). Sve ostalo dobija plan i upozorenje u tri rečenice sa predlogom
    u brojevima iz `adequate` (nedelje, vrh km, dani, dugi, kraća distanca).

## Najveći rizici

1. **Trenerski brojevi su izbor, ne merenje**: težine zona, rampa povratka, pragovi histereze i ceo model plafona
   napretka su [srednja] ili [niska]. Ako ih trener ili istorija vlasnika opovrgnu, menjaju se konstante, ne oblik —
   ali ocena HM (F3) zavisi od njih. Posebno: plafon napretka nema podatke za kalibraciju osim vlasnika (F0).
2. **Merenje u bodovima pomera kilometre**: nedelja sa više kvaliteta ima manje km za isto opterećenje (primer (a):
   nedelja 1 je 28,4 km uz izjavljenih 30). Šabloni moraju to da nadoknade kroz `startPct` i `loadPct`; ako F3 ne
   pogodi, planovi će izgledati „tanji" od v3 i trener će spustiti ocenu.
3. **Mali obim, 4 dana**: dva kvaliteta + dugi + WU/CD pojedu ceo budžet i lagani dani otpadaju. Rešenje je u
   podacima (šablon sa jednim kvalitetom ispod određene baze), ali motor to ne sprečava sam — samo čuvar prijavi.
4. **Aplikacija nema ulaz za formu**: trčanja van plana se čuvaju bez trajanja (F0). Dok to ne zatvori F9, „forma iz
   trčanja" vidi samo dane plana.
5. **Izvedena namera preuzetog plana** (stare oznake dana → podražaji) može biti pogrešna; šteta je ograničena jer se
   koristi tek na događaj i samo u prozoru izmene.

## Šta tab motora (F2) mora prvo da uradi

1. `engine/constants.ts` sa svim brojevima iz § 5–7 (svaki sa upućivanjem na odeljak), pa `load.ts` (težina, dnevno
   opterećenje, sredine) i `form.ts` (VDOT, tempa, vreme trke) — proveriti na brojevima iz § 5.4 i § 12 (a).
2. `isMutable` i kanonska serijalizacija, pa odmah testovi svojstava: determinizam, `replan(doc, s, []) === doc`
   bajt po bajt, prošlo/urađeno/ručno/zaključano netaknuto.
3. Sintetička distanca od 3 unosa (lagano, dugi, jedan kvalitet) i jedan šablon — `plan` od početka do kraja po
   § 6.2 redom koraka 1–10, svaki korak jedna funkcija sa imenom iz SPEC-a.
4. `applyReadiness` kao zaseban čist modifikator, proveren na primerima (b) i (d) dan po dan.
5. Tek onda `deriveEvents` i `replan` po tabeli § 6.4; na kraju čuvar i upozorenja.
6. Test da u `engine/` nema imena distance ni poređenja `distanceM` sa konstantom.

## Šta je bilo nejasno (i kako sam presekao)

- Brief traži „povratak iz stanja (umor, dani od trke)": model umora sam daje preblag povratak, pa sam uzeo dane od
  trke i trajanje napora kao činjenice stanja, a umor kao signal (§ 5.3, § 13 t. 5).
- „Zaglavlje nosi trenutnu formu" naspram „bez događaja bajt-isti plan": zaglavlje je snimak pri poslednjoj izmeni,
  živu procenu daje `fitness/` (§ 1.5).
- „Zaključano i ručne izmene" su navedeni pod `RunnerState`; stavio sam ih u plan (`PlanDay`), stanje ih ne duplira.
- `V3-HM-REPORT.md` je na `docs/generators-v2/perfection/reports/`, ne pod `P9v3/reports/` kako brief navodi.
- Primer (c) „propušten trening, bez događaja": preuzimanje postavlja `eventsFrom = today`, pa istorija pre
  preuzimanja ne proizvodi događaje.
