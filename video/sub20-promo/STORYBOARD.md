---
format: 1080x1920
fps: 30
duration: 48s
message: "Sat ti kaže vreme, Sub-20 ti pokazuje gde gubiš sekunde."
arc: Hook → Cilj → Tri kradljivca → Haos → Reveal → Danas → Plan → Prolazi → Oporavak → Rešenje + CTA
audience: rekreativni trkači koji jure 5 km ispod 20 minuta
mode: collaborative
music: originalna numera sintetizovana u kodu — lagana, razigrana, ~104 BPM, durska, pluck/marimba + meki bas; ducking ispod naracije
start_time: "20:25"
start_time_source: "Strava best effort 5K, aktivnost od 24. 9. 2026 (krugovi 4:02 · 4:00 · 4:02 · 4:12 · 4:09)"
gap_to_goal: "26 s (20:25 → 19:59)"
---

# STORYBOARD — Sub-20 promo (v2, priča sa likom)

**Status: PREDLOG, čeka odobrenje.** Ništa nije građeno; ElevenLabs nije pozvan.

## Spec

- 1080×1920, 30 fps, cilj 46–48 s (naracija ~44 s + 1,5 s repa); stvarnu dužinu diktira audio posle Faze 4.
- Safe zona (Reels/TikTok): ključni tekst y 220–1600 px, x ≤ 960 px (desnih 120 px slobodno). Dole (y > 1600) samo dekor.
- Tekst na ekranu nosi ključne reči naracije; klasičnih titlova nema.
- `transition_in: cut` na svim kadrovima je namerno: svaki šav je **u kadru** (pretvaranje oblika / match-cut / brzi pan sa blurom), sa `handoff_out` → `handoff_in`. Registry crossfade se ne koristi (zabrana: fade-out pa fade-in).

## Brojevi priče (proverljivi)

| Šta | Vrednost | Izvor |
|---|---|---|
| Početno vreme na kugli | **20:25** | Strava, best effort 5K = 1225 s, aktivnost 24. 9. 2026 (najbrži 5K u aktivnostima od 18. 12. 2025; starije nisam proverio) |
| Cilj | 19:59 | tvoj cilj (sub 20) |
| Razlika | **26 s** | 1225 − 1199 |
| Kradljivac 1 — 4. kilometar | **−12 s** | stvaran: krug 4 = 4:12 naspram 4:00 potrebnih za 19:59 |
| Kradljivac 2 — plan koji nije tvoj | −8 s | ilustracija |
| Kradljivac 3 — umor koji ne vidiš | −6 s | ilustracija |
| Zbir | 12 + 8 + 6 = **26 s** | |

**Odstupanje od tvog nacrta (scena 3):** „Prebrz prvi kilometar" ne odgovara tvojim podacima — prvi kilometar je bio 4:02, na ciljnom tempu. Vreme je otišlo u 4. (4:12) i 5. (4:09) kilometru. Zato je kradljivac 1 „Četvrti kilometar *popusti*". To se isplati u sceni 10, gde aplikacija prikazuje baš taj red. Ako hoćeš original, vraćam „Prebrz prvi kilometar" kao čistu ilustraciju.

## Paleta i tip (odluke)

- **Pozadina:** #F4F2EE + meke radijalne mrlje: breskva #FFD9C2, roze #F8C9D4, lavanda #D9D2F5 (blur 120–180 px, sporo plutaju). Noć: #0B0B12 (haos), tamnoplava #1B1F5E (oporavak), zvezde.
- **Akcenat (akcenat-reči, anotacije, pečat):** zelena brenda **#335e35** (na tamnom: #8cc79a) — `web/src/styles/tokens.css:50`, `:146`. Tvoje pravilo: „boja brenda ako postoji".
- **Kugla-lik (sekunde):** narandžasta #FF5A1F → #FF8A4C (radijalni gradijent, odsjaj gore levo, tamniji obod #C93A0C, meka senka). Narandžasta = sekunde, zelena = Sub-20. **Odluka za tebe:** da li i kugla ide u zelenu (onda je ceo video jednobojan sa brendom)?
- **Fontovi (lokalno, `@font-face`, latin-ext):** naslovi **Figtree** (font brenda, `web/src/styles/fonts/figtree-latin-ext.woff2`, razmak −0,03em) umesto Inter Display/Geist. Akcenat-reči: **Instrument Serif Italic** (Google Fonts ima latin-ext subset, proveren). Ako više voliš Geist, menjam.
- **Logo:** `docs/brand/logo-sub20.png` — bela „20", „2" je trkač sa okruglom glavom. **Match-cut:** kugla se smanji u glavu trkača (scena 7).
- **Napomena „demo podaci":** sitno, sivo, y≈1560, u scenama 8–11 (Danas/Oporavak su demo; plan je iz pravog generatora za 20:25; prolazi su tvoji stvarni).

---

## Frame 1 — Hook: kugla pada

- scene: Sjajna narandžasta kugla „20:25" pada, squash pri doskoku, sitne kuglice se razlete
- voiceover: "Sat ti kaže vreme. Ali ne kaže zašto."
- duration: 4s
- transition_in: cut
- status: outline
- src: compositions/frames/01-hook.html
- type: hook
- persuasion: Pattern interrupt + otvoreno pitanje
- beat: curiosity
- blueprint: kinetic-type-beats
- asset_candidates:
- handoff_out: kugla „20:25", centar x=540 y=980, prečnik 520 px, scale 1, opacity 1, mirno poskakuje (amplituda 8 px)

Kugla ulazi odozgo (ease.in), doskok na y≈980: squash 1,18×0,82 → stretch 0,94×1,06 → 1 (overshoot samo ovde). 5–7 sitnih kuglica se razleti (seeded PRNG) i ostanu da plutaju kao dekor (paralaksa, 3 sloja). Naslov gore (y≈420): „Sat ti kaže vreme." (grotesk), na „ne kaže" se red zameni u „Ne kaže *zašto*." (kurziv, zelena). Kugla nema oči — oči imaju samo kradljivci, da kugla-sekunde ostane „predmet vrednosti", a ne četvrti lik.

narrativeRole: hvata pažnju poznatim bolom — brojka bez objašnjenja.
keyMessage: vreme znaš, uzrok ne.

## Frame 2 — Cilj: kontura 19:59

- scene: Pored kugle prozirna isprekidana kontura „19:59", isprekidana linija između njih, oznaka „26 s"
- voiceover: "Do sab dvadeset fali ti dvadeset šest sekundi."
- duration: 3s
- transition_in: cut
- status: outline
- src: compositions/frames/02-cilj.html
- type: problem
- persuasion: Konkretan jaz (gap framing)
- beat: tension
- blueprint: kinetic-type-beats
- asset_candidates:
- handoff_in: kugla „20:25", x=540 y=980, prečnik 520, scale 1, opacity 1
- handoff_out: kugla „20:25" pomerena na x=360 y=1000, prečnik 420; kontura „19:59" x=780 y=1000, prečnik 300, isprekidana zelena

Kamera se blago udalji (scale 1 → 0,9); kugla klizne levo, kontura se iscrta (stroke-dashoffset) desno. Linija između se crta tačkicama, na sredini „26 s" (brojač 0 → 26, staje tačno). Naslov: „Do sub 20 fali *26 sekundi*."

narrativeRole: pretvara bol u merljiv jaz.
keyMessage: 26 sekundi, ne „nekako brže".

## Frame 3 — Kradljivac 1: četvrti kilometar

- scene: Lik-sprinter sa brojem „4" na grudima jurne, zadiše se i istopi; od kugle otpadne komad, „−12 s"
- voiceover: "Četvrti kilometar popusti. Uzme dvanaest."
- duration: 4s
- transition_in: cut
- status: outline
- src: compositions/frames/03-kradljivac-km4.html
- type: problem
- persuasion: Personifikacija uzroka
- beat: frustration
- asset_candidates:
- handoff_in: kugla x=360 y=1000 prečnik 420; kontura 19:59 x=780 y=1000 prečnik 300
- handoff_out: kugla sa isečenim komadom (−12 s), ista pozicija; kontura ista

Sprinter (zaobljen pravougaonik, dva oka, startni broj „4") uleti zdesna, protrči oko kugle, uspori, oči se zatvore, „zadiše se" (3 kratka squash pulsa) i istopi se kroz gooey filter u kapljice. Kapljice povuku komad kugle (gooey), komad se odvoji kao kapljica sa natpisom „−12 s" i ostane da visi gore desno (y≈700). Naslov: „Četvrti kilometar *popusti*."

narrativeRole: prvi uzrok — stvaran, iz tvoje trke.
keyMessage: tempo pukne posle trećeg kilometra.

## Frame 4 — Kradljivac 2: plan koji nije tvoj

- scene: Zgužvani „generički plan" sa očima odgrize kuglu (ugriz kao isečak kruga), „−8 s"
- voiceover: "Plan koji nije pravljen za tebe — osam."
- duration: 4s
- transition_in: cut
- status: outline
- src: compositions/frames/04-kradljivac-plan.html
- type: problem
- persuasion: Negativan kontrast (generičko vs. lično)
- beat: frustration
- asset_candidates:
- handoff_in: kugla sa isečkom −12 s, x=360 y=1000; komad „−12 s" x=820 y=700
- handoff_out: kugla sa još jednim isečkom (−8 s), ista pozicija; komadi „−12 s", „−8 s" gore

Zgužvan list papira (SVG, nabori) sa natpisom „PLAN ZA SVE" i dva oka uskoči odozdo levo, poskoči dvaput, „zine" i odgrize: isečak kruga nestane iz kugle (clip-path, deterministički), list „sažvaće" (squash ×3). Iz ugriza izleti komad „−8 s". Naslov: „Plan koji *nije* tvoj."

narrativeRole: drugi uzrok — plan napravljen za prosek.
keyMessage: generički plan ne zna tvoje tempo zone.

## Frame 5 — Kradljivac 3: umor koji ne vidiš

- scene: Sivi pospani oblak polako isisava deo kugle kao vrtlog, „−6 s"
- voiceover: "Umor koji ne vidiš — još šest."
- duration: 4s
- transition_in: cut
- status: outline
- src: compositions/frames/05-kradljivac-umor.html
- type: problem
- persuasion: Nevidljiv uzrok učinjen vidljivim
- beat: unease
- asset_candidates:
- handoff_in: kugla sa dva isečka, x=360 y=1000; komadi −12 s, −8 s
- handoff_out: kugla smanjena na prečnik 340, tri komada lebde (−12 s, −8 s, −6 s) u luku iznad

Siv oblak (gooey grupa krugova) sa poluzatvorenim očima „zeva" (treptaj sporo); vrtlog (rotirajući spiralni stroke) izvlači narandžasti mlaz iz kugle u oblak; mlaz se otkine kao komad „−6 s". Tri komada se poređaju u luk iznad kugle. Naslov: „Umor koji *ne vidiš*."

narrativeRole: treći uzrok — oporavak.
keyMessage: umor se ne vidi na satu.

## Frame 6 — Haos: ponoć, četiri taba

- scene: Noć, sat 23:47; kartice „Strava", „plan.xlsx", „kalkulator tempa", „HRV" lebde u 3D
- voiceover: "A ti u ponoć držiš otvorene Stravu, tabelu, kalkulator tempa i ha-er-ve."
- duration: 4s
- transition_in: cut
- status: outline
- src: compositions/frames/06-haos.html
- type: problem
- persuasion: Pain agitation (prepoznavanje sopstvene navike)
- beat: overwhelm
- blueprint: overwhelm-surround
- asset_candidates:
- handoff_in: kugla prečnik 340 x=360 y=1000 → match-cut u brojčanik sata
- handoff_out: sat x=540 y=980 prečnik 300 → vraća se u kuglu prečnika 340

**Match-cut kugla → sat:** kugla se pretvori u brojčanik (kazaljke se izvuku iz centra), pozadina potamni u #0B0B12 sa zvezdama, sat pokazuje 23:47. Četiri kartice (staklasti pravougaonici, perspektiva, rotateY ±18°) uplutaju sa četiri strane, svaka sa pravim natpisom kao naslov taba (bez logotipa): „Strava", „plan.xlsx", „kalkulator tempa", „HRV". Nijedna dva ne ulaze istovremeno (stagger 0,35 s). Naslov: „Četiri taba. *U ponoć.*" (izmenjeno: tvoj nacrt kaže „5 tabova", a nabraja 4 kartice).

narrativeRole: rasipanje alata — jaz koji Sub-20 zatvara.
keyMessage: podaci postoje, ali su razbacani.

## Frame 7 — Reveal: Sub-20

- scene: Sat se vrati u kuglu, kugla se smanji u glavu trkača iz logoa Sub-20; brzi pan sa blurom u telefon
- voiceover: "Zato postoji Sab dvadeset."
- duration: 3s
- transition_in: cut
- status: outline
- src: compositions/frames/07-reveal.html
- type: product_intro
- persuasion: Rešenje kao razrešenje napetosti
- beat: relief
- blueprint: logo-assemble-lockup
- asset_candidates: assets/logo-sub20.png — logo, bela „20" na zelenom, „2" je trkač sa okruglom glavom
- handoff_in: sat x=540 y=980 prečnik 300
- handoff_out: telefon (okvir 900×1950 skaliran na 0,78) ulazi zdesna, motion blur 24 px → 0

Sat → kugla (kazaljke se uvuku) → kugla se smanji i „sedne" na mesto glave trkača u logou (logo se iscrta oko nje: zeleni kvadrat raste iz tačke, bela „20" se otkrije maskom). Pozadina se vrati u svetlu pastelnu. Naslov ispod logoa: „Zato postoji *Sub-20*." Na kraju brzi pan levo (0,35 s, blur), u kadar ulazi telefon.

narrativeRole: ime proizvoda, posle priče.
keyMessage: Sub-20 je odgovor na „zašto".

## Frame 8 — Danas

- scene: Telefon sa pravim ekranom Danas; ručno nacrtan krug oko „3:55 /km"
- voiceover: "Svaki dan znaš šta trčiš, i kojim tempom."
- duration: 4s
- transition_in: cut
- status: outline
- src: compositions/frames/08-danas.html
- type: key_feature
- persuasion: Show-don't-tell proof
- beat: clarity
- blueprint: device-surface-showcase
- asset_candidates: assets/ui-danas.png — tab Danas, Fartlek 6,5 km, 4× 60 s @ 3:55/km; assets/ui-danas-kartica.png — isečak kartice treninga
- handoff_in: telefon ulazi zdesna, blur 24 → 0, scale 0,78
- handoff_out: telefon x=540 y=1000 scale 0,78, ekran klizi nagore (scroll) u Plan

Telefon (zaobljen okvir, meka senka) nosi `ui-danas.png`. Kamera blago gura (scale 0,78 → 0,84). Na reč „tempom" ručno nacrtan zeleni krug (stroke-dashoffset, 0,5 s, blago nepravilan) oko reda „3:55 /km · oko 32 min". Naslov gore: „Svaki dan znaš *šta* trčiš." Sitno: „demo podaci".

Funkcija: tab Danas — `web/src/features/today/TodayHero.tsx`, `web/src/features/today/index.tsx`.

narrativeRole: prvi dokaz — jasnoća svakog dana.
keyMessage: tačan trening i tempo, bez tabele.

## Frame 9 — Plan iz tvog VDOT-a

- scene: Plan po nedeljama; VDOT 48,6 kao kugla-broj koji se uklopi na mesto u „Polazni VDOT"
- voiceover: "Plan se pravi iz tvog ve-dot-a, iz tvog vremena."
- duration: 4s
- transition_in: cut
- status: outline
- src: compositions/frames/09-plan.html
- type: key_feature
- persuasion: Feature-to-benefit translation (lično, ne generičko — odgovor na kradljivca 2)
- beat: trust
- blueprint: device-surface-showcase
- asset_candidates: assets/ui-plan.png — Tvoj plan, Nedelja 6 od 12, 31,1 km, faza RAZVOJ; assets/ui-napredak-vdot.png — Polazni VDOT 48,6 · Procena 5K 20:25; assets/ui-plan-nedelja.png — lista dana u nedelji
- handoff_in: telefon x=540 y=1000 scale 0,78, ekran Danas
- handoff_out: telefon x=540 y=1000 scale 0,78, ekran Plan

Ekran u telefonu prelazi Danas → Plan (vertikalni scroll/push unutar ekrana, ne rez). Mala narandžasta kugla „20:25" (callback) doleti sa strane, pretvori se u zelenu kuglu-broj „48,6" i uklopi se na mesto broja u isečku „Polazni VDOT" (isečak lebdi ispred telefona, tri sloja dubine). Zelena kvačica se iscrta pored reda „Lako · 7,5 km · završeno". Naslov: „Plan iz *tvog* VDOT-a."

Funkcija: generator plana iz rezultata (VDOT) — `web/src/domain/training/generator/generatePlan.ts`, `web/src/domain/training/vdot/`; tab Plan — `web/src/features/plan/index.tsx`.

narrativeRole: ukida kradljivca 2.
keyMessage: tempo zone iz tvog vremena 20:25.

## Frame 10 — Prolazi po kilometru

- scene: Tabela „Prolazi po kilometru"; ručno nacrtan krug oko reda „4 · 4:12"; sprinter iz scene 3 proviri pored reda
- voiceover: "Posle trke vidiš svaki kilometar, i gde je vreme otišlo."
- duration: 4s
- transition_in: cut
- status: outline
- src: compositions/frames/10-prolazi.html
- type: key_feature
- persuasion: Callback (uzrok iz scene 3 uhvaćen u pravom UI-ju)
- beat: clarity + control
- blueprint: device-surface-showcase
- asset_candidates: assets/ui-trka-prolazi.png — Prolazi po kilometru · Strava: 4:02 · 4:00 · 4:02 · 4:12 · 4:09; assets/ui-trka-body.png — ceo ekran Analiza trke za skrol
- handoff_in: telefon x=540 y=1000 scale 0,78, ekran Plan
- handoff_out: isečak tabele uvećan 1,4×, centar y=1000

Telefon se okrene ka kameri i isečak tabele „izađe" ispred ekrana (z-push, 3 sloja). Redovi se pojavljuju jedan po jedan (stagger 0,12 s). Na „gde" ručno nacrtan zeleni krug oko reda „4 · 4:12"; mali sprinter sa brojem „4" proviri iza tabele i sakrije se (posramljen). Naslov: „Vidiš *gde* je otišlo."

Funkcija: Analiza trke, prolazi po kilometru — `web/src/features/race/RaceData.tsx`, `web/src/services/race/raceSync.ts` (izvor: intervals.icu ili Strava tokovi / `splits_metric`).
Podaci u kadru: tvoji stvarni prolazi sa Strave, bez imena trke i ID-ja aktivnosti.

**Zamena za tvoju scenu 10 („Svaki krug, svoj tempo"):** u kodu ne postoji prikaz tempa po krugu za trening. Postoji (a) jedan ukupan „Radni deo — ostvaren tempo" izdvojen iz Strava tokova (`web/src/features/today/WorkSegment.tsx`, `detectWorkSegments` u `web/src/services/strava/stravaSync.ts`) i (b) tabela prolaza po kilometru u Analizi trke. Uzeo sam (b), jer pokazuje „gde".

narrativeRole: ukida kradljivca 1 — vidiš gde je otišlo vreme.
keyMessage: aplikacija pokazuje kilometar koji te košta.

## Frame 11 — Oporavak

- scene: Tamnoplavo nebo sa mesecom; HRV, san i svežina kao male kugle; telefon sa „Olakšaj"
- voiceover: "A oporavak ti kaže kad da stisneš, a kad da staneš."
- duration: 5s
- transition_in: cut
- status: outline
- src: compositions/frames/11-oporavak.html
- type: key_feature
- persuasion: Risk reversal (sprečava loš trening)
- beat: peace of mind
- blueprint: constellation-hub
- asset_candidates: assets/ui-oporavak-stanje.png — Stanje danas: Olakšaj, HRV 49 (−19,7%), puls u miru 52, san 5,6 h, svežina −13, opterećenje 0,95; assets/ui-oporavak.png — ceo ekran Oporavak
- handoff_in: isečak tabele 1,4× y=1000
- handoff_out: tri male kugle se skupe u jednu narandžastu kuglu x=540 y=1000 prečnik 300

Ulazak kroz objekat: kamera prođe kroz red „4:12" i izađe u noć (#1B1F5E, zvezde, mesec gore desno). Tri male sjajne kugle orbitiraju oko telefona: „HRV 49", „San 5,6 h", „Svežina −13". Na „stisneš" kugle se blago ubrzaju; na „staneš" se zaustave, a na ekranu telefona se zaokruži „Olakšaj" i spusti pečat „OLAKŠAJ" (rotiran −8°; reč je ista kao u aplikaciji — „Stani" postoji u aplikaciji kao jači nivo, ali demo jutro daje „Olakšaj"). Naslov: „Kad da stisneš. *Kad da staneš.*" Sitno: „HRV, san i svežina: intervals.icu · demo podaci".

Funkcija: Napredak → Oporavak — `web/src/features/recovery/OporavakScreen.tsx`, `ReadinessCard.tsx`; odnos akutnog i hroničnog opterećenja — `web/src/domain/recovery/`; HRV/san/svežina stižu sa intervals.icu (`web/src/services/icu/`).

narrativeRole: ukida kradljivca 3.
keyMessage: umor postaje vidljiv pre treninga.

## Frame 12 — Rešenje + CTA

- scene: Tri komada (−12, −8, −6 s) se vrate u kuglu; kugla popuni konturu „19:59", pečat „CILJ"; logo + adresa
- voiceover: "Sab dvadeset ti pokazuje gde su tvoje sekunde."
- duration: 5s (+1,5 s rep)
- transition_in: cut
- status: outline
- src: compositions/frames/12-cta.html
- type: cta
- persuasion: Future pacing bez obećanja (pokazuje gde, ne garantuje vreme)
- beat: motivation
- blueprint: logo-assemble-lockup
- asset_candidates: assets/logo-sub20.png — logo za završni kadar
- handoff_in: narandžasta kugla x=540 y=1000 prečnik 300

Pozadina se vrati u svetlu pastelnu. Tri komada doleću nazad (stagger 0,3 s, „pop" na spoju, squash), kugla raste do veličine konture, broj na kugli se smeni 20:25 → 19:59 (brojač staje tačno), pa se na konturu spusti rotiran zeleni pečat **„CILJ"** (ne „POSTIGNUTO": video ne obećava rezultat). Kugla se smanji u glavu trkača iz logoa (isti match-cut kao scena 7), lockup: logo + „sub20" + adresa aplikacije. Naslov: „Sub-20 ti pokazuje *gde*." Poslednjih 1,5 s: lockup miruje uz blago plutanje kuglica (jedina scena sa izlaznom animacijom: kuglice se raziđu na kraju).

**CTA adresa:** [popunjava se iz APP_BRIEF.md → „URL produkcije"].

narrativeRole: zatvara metaforu, daje akciju.
keyMessage: sekunde nisu izgubljene, samo nisu bile viđene.

---

## Opciono (nije u trajanju od 48 s)

- **3D prolet kroz sve kadrove + kartica „Napravljeno sa AI"** (kao u referenci): +2,5 s → ~51 s, izlazi iz opsega 42–50 s. Predlog: izostaviti, ili skratiti scenu 6 za 1 s i scenu 11 za 1 s i ubaciti prolet od 2 s pre lockupa.

## Zvuk (Faza 5)

- Muzika: originalna, sintetizovana u kodu (bez kredita, bez tuđeg materijala), ~104 BPM, ducking ispod naracije (`/hyperframes-audio` carve).
- Zvučni efekti, takođe sintetizovani: „pop" (doskok kugle 1, povratak komada 12), „gulp" (ugriz 4), kapljica (topljenje 3), vrtlog (5), tik-tak (6), whoosh (pan 7, ulazak kroz objekat 11), „ščep" pečata (11, 12).
- Završni miks ≈ −14 LUFS integrisano, vrh ≤ −1 dBTP.
