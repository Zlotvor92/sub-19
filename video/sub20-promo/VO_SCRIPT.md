# VO_SCRIPT — Sub-20 promo (v2)

**Status: ODOBRENO (2026-10-18).** Generisanje preko ElevenLabs konektora.

**Voice:** ElevenLabs, model `eleven_v4` (ID modela proveravam sa `GET /v1/models` pre prvog poziva; ako ne postoji pod tim imenom, stajem i javljam). `voice_id`: `ELEVENLABS_VOICE_ID` ako je postavljen. Trenutno **nije**, kao ni `ELEVENLABS_API_KEY`. Bez njega predlažem 3 glasa iz `GET /v1/voices` i čekam izbor.
**Voice settings:** podrazumevana.
**Voice direction:** topao, siguran, malo razigran; kratke pauze posle tačke; brojevi jasno, bez žurbe.
**Jezik:** srpski, latinica; `language_code: "sr"` ako ga model prima.

Tempo: 95 reči / ~43 s govora ≈ 2,2 reči u sekundi. Jedan MP3 fajl (44,1 kHz) po redu = 12 poziva, bez ponavljanja „za svaki slučaj".

## Test izgovora (pre punog generisanja)

Tri reči su rizične. Predlog: **jedan** kratak probni poziv sa sve tri u jednoj rečenici, pa biramo zapis pre 12 punih poziva.
Probna rečenica: „Sab dvadeset, ve-dot, ha-er-ve."

| Reč | Zapis u skripti | Alternativa | Zašto |
|---|---|---|---|
| Sub-20 | **Sab dvadeset** | Sub dvadeset | trkači govore „sab" (engl. *sub*); TTS bi pročitao „sub" sa *u* |
| VDOT | **vi-dot** (korisnik, 2026-10-18) | ve-dot — čeka izbor po probi | engleski izgovor oznake, kako je korisnik tražio |
| HRV | **ejč-ar-vi** (korisnik, 2026-10-18) | — | engleski izgovor slova, kako je korisnik tražio |

---

## Line 1 — Hook (Frame 1)

**Time:** 0,0 – 4,0 s
**Delivery:** mirno, sa malim zastojem pre „Ali".

    Sat ti kaže vreme. Ali ne kaže zašto.

## Line 2 — Cilj (Frame 2)

**Time:** 4,0 – 7,0 s
**Delivery:** konkretno, naglasak na broju.

    Do sab dvadeset fali ti dvadeset šest sekundi.

## Line 3 — Kradljivac 1 (Frame 3)

**Time:** 7,0 – 11,0 s
**Delivery:** blago podrugljivo; „Uzme dvanaest." kratko i suvo.

    Četvrti kilometar popusti. Uzme dvanaest.

## Line 4 — Kradljivac 2 (Frame 4)

**Time:** 11,0 – 15,0 s
**Delivery:** isti ritam kao red 3; pauza pre „osam".

    Plan koji nije pravljen za tebe — osam.

## Line 5 — Kradljivac 3 (Frame 5)

**Time:** 15,0 – 19,0 s
**Delivery:** tiše, sporije, „pospano".

    Umor koji ne vidiš — još šest.

## Line 6 — Haos (Frame 6)

**Time:** 19,0 – 23,0 s
**Delivery:** malo brže, nabrajanje sa osmehom.

    A ti u ponoć držiš otvorene Stravu, tabelu, kalkulator tempa i ejč-ar-vi.

## Line 7 — Reveal (Frame 7)

**Time:** 23,0 – 26,0 s
**Delivery:** toplo, razrešenje; ime izgovoreno sigurno.

    Zato postoji Sab dvadeset.

## Line 8 — Danas (Frame 8)

**Time:** 26,0 – 30,0 s
**Delivery:** lagano, jasno.

    Svaki dan znaš šta trčiš, i kojim tempom.

## Line 9 — Plan (Frame 9)

**Time:** 30,0 – 34,0 s
**Delivery:** naglasak na „tvog".

    Plan se pravi iz tvog vi-dot-a, iz tvog vremena.

## Line 10 — Prolazi (Frame 10)

**Time:** 34,0 – 38,0 s
**Delivery:** otkriće; naglasak na „gde".

    Posle trke vidiš svaki kilometar, i gde je vreme otišlo.

## Line 11 — Oporavak (Frame 11)

**Time:** 38,0 – 43,0 s
**Delivery:** „stisneš" sa energijom, „staneš" smireno.

    A oporavak ti kaže kad da stisneš, a kad da staneš.

## Line 12 — Rešenje + CTA (Frame 12)

**Time:** 43,0 – 48,0 s (+1,5 s rep bez govora)
**Delivery:** zaključak, toplo, bez prodajnog tona.

    Sab dvadeset ti pokazuje gde su tvoje sekunde.

---

## Šta je izbačeno ili promenjeno u odnosu na tvoj nacrt i zašto

| Tvoj red | Sada | Razlog |
|---|---|---|
| 2: „…fali ti četrdeset osam sekundi" | „…dvadeset šest sekundi" | tvoje vreme je 20:25 (Strava), ne 20:47 |
| 3: „Prebrz prvi kilometar uzme četrnaest" | „Četvrti kilometar popusti. Uzme dvanaest." | tvoj 1. km je bio 4:02 (na tempu); 4. km 4:12 = stvarnih 12 s |
| 4–5: „dvadeset", „četrnaest" | „osam", „šest" | zbir mora biti 26 (12 + 8 + 6) |
| 6: „…Stravu, tabelu i kalkulator tempa" | dodat „ha-er-ve" | kartica HRV je u kadru; naslov „Četiri taba" |
| 10: „Svaki krug dobija svoj tempo" | „Posle trke vidiš svaki kilometar…" | prikaz tempa po krugu za trening ne postoji u kodu; postoji tabela prolaza po kilometru u Analizi trke |
| 12: „…pokazuje gde" | „…pokazuje gde su tvoje sekunde" | zatvara metaforu, bez obećanja rezultata |
