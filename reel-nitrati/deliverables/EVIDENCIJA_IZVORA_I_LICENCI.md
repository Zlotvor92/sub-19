# Evidencija izvora i licenci — „Nitrati i trčanje“ (Instagram Reel)

Datum izrade: 24. 10. 2026.

## 1. Vizuali

| Element | Poreklo | Licenca / prava |
|---|---|---|
| Sve ilustracije (čaša soka, cvekla, list, trkač, molekuli, bakterije, usna duplja, krvni sud, mišić, bočica, sat, ikone, staza) | Originalni vektorski crteži napravljeni kodom za ovaj projekat (`src/components/*.tsx`, SVG u React/Remotion) | Originalan rad nastao za ovaj projekat; nema fotografija, stock snimaka ni slika trećih strana |
| Animacija trčanja | Originalni ciklus izveden iz tipičnih krivih uglova kuka, kolena i skočnog zgloba pri trčanju (`src/components/Runner.tsx`) | Originalan rad |
| Tipografija | Inter (Rasmus Andersson / The Inter Project Authors), Barlow Condensed (Jeremy Tribby), preko `@fontsource` | SIL Open Font License 1.1 (dozvoljeno ugrađivanje u video) |

Nema logotipa, naziva profila ni brend materijala (u repozitorijumu nema brend materijala za uklapanje).

## 2. Naracija

| Stavka | Vrednost |
|---|---|
| Servis | ElevenLabs, model **Eleven v4** (`eleven_v4`) |
| Glas | „Ivan – Pro Srpski / Hrvatski glas (Reklame)“, `voice_id j96cp162VcYdsYfSp1nc` (profesionalni glas iz ElevenLabs Voice Library) |
| Izabrana taka | generacija `7PwP2qSf3j84sqyKZL5S` (take A; druga taka: `YiNUepzqOZVVdtjG1zBV`) |
| ElevenLabs flow | `RIIwELBZPJE7oGkkdiEy` |
| Format izvornika | MP3, 128 kb/s, 44,1 kHz, mono (izvorni izlaz servisa) |
| Prava | Prema uslovima korišćenja ElevenLabs naloga i Voice Library glasa. **Komercijalna upotreba zavisi od plana naloga** — proveriti plan pre komercijalne objave. |

## 3. Muzika

| Stavka | Vrednost |
|---|---|
| Delo | Originalna instrumentalna kompozicija, 100 BPM, d-mol, 81 s |
| Nastanak | Sintetizovana kodom za ovaj projekat (`scripts/make_music.py`): aditivna/FM sinteza i filtrirani šum |
| Semplovi / tuđ materijal | Nema |
| Prava | Originalan rad nastao za ovaj projekat; bez licenci trećih strana |

## 4. Zvučni efekti

| Efekat | Poreklo | ID generacije |
|---|---|---|
| Mekan udar (početak) | ElevenLabs Sound Effects v2 (`eleven_text_to_sound_v2`), flow `RIIwELBZPJE7oGkkdiEy` | `eSaebO0Tc8dZBo80nBn6` |
| Kap soka u čašu | ElevenLabs Sound Effects v2 | `mn73muCbpA0gN68P5LBQ` |
| Whoosh (prelazi) | ElevenLabs Sound Effects v2 | `4yrH27FCM3RxVRnADrlK` |
| Ispiranje vodicom | ElevenLabs Sound Effects v2 | `fXLFmlukJnBNvklTrTlh` |
| Tonalni zvuk promene molekula, ritmički naglasci | Sintetizovani kodom (`scripts/mix_audio.py`) | — |

ElevenLabs efekti: prava prema uslovima korišćenja naloga (komercijalna upotreba zavisi od plana).

## 5. Softver

| Alat | Licenca |
|---|---|
| Remotion 4.0.538 | Remotion License: besplatno za pojedince i kompanije do 3 zaposlena; veće kompanije trebaju kompanijsku licencu |
| React 18, TypeScript | MIT / Apache-2.0 |
| FFmpeg | LGPL/GPL (alat za obradu; ne ugrađuje se u video) |
| NumPy, SciPy | BSD |

## 6. Stručni izvori (provereni za tvrdnje u videu)

1. **Australian Institute of Sport (AIS).** Sports Supplement Framework — *Dietary Nitrate/Beetroot Juice*, Group A, Practitioner Fact Sheet (poslednje ažuriranje: novembar 2025). https://www.ausport.gov.au/ais/nutrition/supplements/group_a
   - Putanja nitrat → nitrit (bakterije u ustima) → NO; NO učestvuje u regulisanju protoka krvi i radu mišića.
   - Antibakterijska vodica za usta može izrazito ograničiti porast nitrita u plazmi i oslabiti efekte.
   - Tipična doza u studijama: ~6–10 mmol (~350–650 mg), ~2–3 h pre napora; 6–8 mmol dnevno nekoliko dana pre takmičenja kao druga strategija.
   - Moguća blaga gastrointestinalna nelagodnost; preporuka da se prvo isproba na treningu.
   - Visoko utrenirani izdržljivci (VO₂max > 65 ml/kg/min) nisu značajno profitirali.
2. **Lansley KE, Winyard PG, Fulford J, Vanhatalo A, Bailey SJ, Blackwell JR, DiMenna FJ, Gilchrist M, Benjamin N, Jones AM.** Dietary nitrate supplementation reduces the O₂ cost of walking and running: a placebo-controlled study. *J Appl Physiol.* 2011;110(3):591–600. doi:10.1152/japplphysiol.01070.2010
   - 9 aktivnih muškaraca, 6 dana soka od cvekle (~6,2 mmol/dan) prema placebu bez nitrata: manja potrošnja O₂ pri hodanju i trčanju umerenog intenziteta; duže vreme do iscrpljenja u laboratorijskom testu.
3. **Poon ET-C, Iu JC-K, Sum WM-K, Wong P-S, Lo KK-H, Ali A, Burns SF, Trexler ET.** Dietary Nitrate Supplementation and Exercise Performance: An Umbrella Review of 20 Published Systematic Reviews with Meta-analyses. *Sports Med.* 2025;55:1213–1231. doi:10.1007/s40279-025-02194-6
   - Mešoviti efekti: poboljšanje u testovima do iscrpljenja (TTE), ali bez značajnog poboljšanja u testovima na zadatu distancu/rad (time trial); efekti izraženiji kod rekreativaca nego kod vrhunskih sportista; metodološki kvalitet većine pregleda nizak do kritično nizak.

Lokalne kopije izvora korišćenih pri proveri: `assets/sources/`.
