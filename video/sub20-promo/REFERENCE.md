# REFERENCE — razlaganje referentnog klipa

## Status: referenca NIJE pročitana

`video/reference.mp4` ne postoji ni u repou ni bilo gde u kontejneru (pretraga `find / -name "*.mp4"` je našla samo
`docs/reel/out/sub20-reel*.mp4`, a to je stari reel aplikacije, ne referenca). Zato:

- nijedan kadar nije izvučen (`npx hyperframes snapshot` / ffmpeg na 0,5 s nisu pokrenuti — nema ulaza);
- ništa od opisa ispod nije **potvrđeno** ni **ispravljeno** iz klipa;
- tempo rezova, tipovi prelaza, tipografija i paleta su **tvoj opis**, preuzet doslovno kao radna pretpostavka.

Kad klip stavim u `video/reference.mp4`, ovaj fajl se prepisuje iz kadrova (`ffmpeg -vf fps=2` + `npx hyperframes snapshot`),
a storyboard se usklađuje gde se razlikuje. Do tada je sve ispod oznake **„nepotvrđeno"**.

## Konstante (iz tvog opisa — nepotvrđeno)

| Osa | Pretpostavka | Izvor |
|---|---|---|
| Priča | problem → rešenje kroz lik; kradljivci jedu kuglu jedan po jedan; proizvod tek posle | tvoj opis |
| Fizika | squash & stretch pri doskoku, tečno topljenje (kapanje), ugriz kao isečak kruga, likovi trepću i poskakuju; ništa statično | tvoj opis |
| Tipografija | čist grotesk, tesan razmak; akcenat-reči u kurzivnom serifu, u akcent boji; povremeno ogromna udarna reč | tvoj opis |
| Paleta | prljavo-bela pozadina + meke pastelne mrlje (breskva, roze, lavanda), narandžasti akcenat, sitne plutajuće sjajne kuglice; noćne scene tamne (sat u ponoć, zvezde, tamnoplavo nebo, mesec) | tvoj opis |
| Prelazi | pretvaranje oblika i match-cut (kugla → sat → kugla → logo), brzi pan sa motion blurom, ulazak kroz objekat; malo tvrdih rezova | tvoj opis |
| Proizvod | pravi UI u kadru, ručno nacrtan krug oko ključnog broja, pečat, nacrtana kvačica; telefon sa notifikacijom | tvoj opis |
| Finale | 3D prolet kroz sve kadrove, pa CTA | tvoj opis |
| Tempo | jedna ideja na 2–4 s, ukupno ~50 s; tekst na ekranu nosi ključne reči naracije (nema klasičnih titlova) | tvoj opis |

## Šta kopiramo, a šta ne

- **Kopiramo stil:** fiziku likova, sistem tipografije (grotesk + kurzivni serif za akcenat), pastelnu podlogu, vrstu prelaza, anotacije preko pravog UI-ja, ritam 2–4 s.
- **Ne kopiramo sadržaj:** novac/iznose, plavo čudovište, reklame, povraćaje, dostavu, njihove reči („LYING.", „14 TABS open."), njihov logo i UI.

## Odstupanja koja već sad znam (zbog brenda Sub-20, ne zbog reference)

- Akcent boja po tvom pravilu „boja brenda ako postoji" je **zelena #335e35** (`web/src/styles/tokens.css`, `web/public/manifest.json`), ne narandžasta. Narandžasta ostaje samo boja **kugle-lika** (sekunde), jer tako glasi tvoja metafora. Detalji i predlog: `STORYBOARD.md` → „Paleta".
- Logo (`docs/brand/logo-sub20.png`) je bela „20" na zelenom, gde je „2" trkač sa **okruglom glavom**. To je prirodna meta za match-cut: kugla se smanji u glavu trkača.
