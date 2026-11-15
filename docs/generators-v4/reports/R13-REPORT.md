# R13 — krug 13 (motor), 13. 11. 2026 — DELIMIČNO (stavke 1 i deo 2)

Stanje `bcb6048`. Kapije HM, 10K, 5K, MAR 0. V4: 56 fajlova, 962 + 26 očekivano; lint i typecheck čisti.
Ispisi sve četiri distance osveženi.

## 1. M18/M17 — jedan model forme (urađeno)
- Determinizam: isti ulaz daje bajt-isti plan (5K S17 dva puta, isti md5).
- Unet rezultat iz profila već je išao kroz isti prenos (`2·v − vdotAt` = `v − loss`). Uzrok je bio nedeljni obim
  za krivu prenosa: sa jednim trčanjem u istoriji `weeklyKmAt` je davao 10 km × 7 / 1 dan = 70 km nedeljno.
  Sada deo prozora bez trčanja popunjava izjavljeni obim, a bez izjave prozor je bar 7 dana.
  5K S17: 22:01 → 21:49, isto kao p01.
- (a) Polazna forma svih 59 profila sve četiri distance PRE = POSLE (0 razlika; profili nemaju trčanja).
- (b) Procena vlasnika (owner-strava-2026, ceo ispis `ownerHistory`): bez ijedne razlike, 0 s.
- (c) „Forma se računa nešto bolje" ide samo uz bolji broj. Uz lošiji piše „ali je i tako sporiji od dosadašnje
  procene, pa procena pada".
- (d) Otisci profila nepromenjeni. Menjaju se E5 scenariji (s17–s20) sve četiri distance i broj „oko N km
  nedeljno" u objašnjenjima (HM s01/s02/…, MAR s01/s28/…). Test `fitness/k13` (bez popravke padaju 3 od 4 cilja).

## 2. M17 (deo)
- Provera 5K od 1,5 km nije se čitala (`TEST_MIN_M` 2000), pa su S03 i S11 imali „PROMENA: 0". Sada je
  `TEST_MIN_M` 1500, a pun napor na dan provere iz plana je test i kad je upisan kao trka.
- Smer tempa: posle boljeg rezultata nijedna zona nije sporija, posle lošijeg nijedna brža (`sameDirection`).
  S03 je ranije imao prag sporiji za 11 s/km.
- Rečenica o tempima navodi zone pojedinačno kad se pomere nejednako ili neka ostane ista. Nema više „usporena za 1
  s" uz tempo trke brži za 5 s.
- Očekivano vreme u zaglavlju posle boljeg rezultata nije sporije (ni obrnuto).
- Testovi `fivek/r13` (S03/S11 imaju izmenu; smer tempa u svim scenarijima).
- Imenovano kao poznato: 5K s03 projekcija dana trke u `fitness` posle prvog kratkog testa je 4 s sporija
  (KNOWN u `fivek/scenarios`). p12 „ništa" +3 s je dodat u FORM_DRIFT, isti uzrok.

## Nije stiglo (redom iz poruke)
- 2 ostatak: M7 (prognoza ne brža od forme kad obim ne nosi trku); M17 „dan trke ne vraća sporiji cilj" i
  projekcija dana trke u `fitness` (gornja dva poznata nalaza).
- 3–8: M2 ostatak + M21, M20 + M12, M6/M24, M10, M3 ostatak/M4/M22/M23/M26, ostalo, podatak HM.
