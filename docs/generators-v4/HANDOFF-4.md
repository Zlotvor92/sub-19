# Primopredaja organizatora 4 / PRESEK (14. 11. 2026, 18:40 po Beogradu)

Organizator do sada: Fable `session_01GnHHiXbHoY1xUw1QNCS3LN` (kontekst ≈ 650 000 — sledeći organizator treba da bude
NOV tab). Vlasnik je tražio PRESEK I PLAN pre bilo kog novog kruga: **ništa se ne pokreće dok vlasnik ne odobri plan.**

## Pročitaj
`AGENTS.md` § V4; ovaj fajl; `LOG.md` od unosa „13. 11. 2026, 22:45"; `coach/RUBRIC-V4.md` § A3 (novo merilo);
`coach/R21-RAZVRSTAVANJE.md`; `briefs/R22.md`; `reports/R22-*.md`.

## Stanje koda (provereno kod organizatora, `e1136a16`)
74 fajla, 1121 prolazi + 12 očekivano pada; typecheck čist; kapije HM/10K/5K/MAR 0. R22 NIJE ocenjen.
Izmena ispisa profila od R21 (`21d4b070`): HM 6,0 % redova (8 fajlova), 10K 4,3 % (8), MAR 9,5 % (18), 5K 4,2 % (15).

## Merilo (odluka vlasnika 14. 11.)
Profil kome ulaz dozvoljava: trener Plan ≥ 80. Profil sa plafonom ulaza (11 po treneru: HM p03, p10; MAR p03, p06,
p08, p10, p13, p18, p19; 5K p13, p14): „Plan za ulaz" ≥ 80, stara ocena ne pada. B ≥ 80, C ≥ 80. Drugi sudija: nijedan
plan < 65. Prosek distance je pomoćni broj. Ocena sudija ISKLJUČIVO nad novim stanjem, posle izmena.

## Poslednja ocena — R21 (stanje `21d4b070`)
Trener prolaz: dozvoljava 24/48 (HM 7/10, 10K 5/12, MAR 8/12, 5K 4/14); plafon 1/11 (MAR p03). Plan HM 79,4, 10K
78,5, MAR 78,7, 5K 76,9; B 82,1–83,2; C 82,7–84,2. Na 79–79,5: HM p12; 10K p11; MAR p11, p04, p16, p08(plafon); 5K
p04. Drugi sudija < 65: 10K p06 62; 5K p12 63,5; MAR p19 60, p13 61, p06 64,5, p10 64,5. (v2 generator: Plan 59–63.)

## Šta je R22 uradio (neocenjeno)
- Motor A (`e1136a16`): posle trke dani 1–3 odmor/≤ 30 min, ned 1 ≤ 60 % (vlasnik-v2 21,5 → 16,5 km); jedan propušten
  trening nije pauza; bez mikro-doza; prvi dan posle pauze nije dugi; brojevi u PROMENAMA = zaglavlje.
- Motor B (`5b3b8030`): jedan polazni broj forme; tempo trke u treninzima = tempo za trku (`engine/racePace.ts`);
  upozorenja bez ponavljanja/protivrečnosti; N−2 po dužini plana (5K ≤ 6 ned 92 %); početnik po činjenicama.
- Podatak: 10K `e7a795c` (p12, p03, p08, p11 rast); 5K `9142b15a` (p04 talas, p09, p14, bez dva ista 400 m); MAR
  `344f74b6` (p15, p16, p11 deo, p13/p18 četvrtak); HM `2049ca8f` (p12, p08 talas, p03/p10 bez 25 % brzog, p06 vrh).

## Otvoreno (nije urađeno ni u R22)
- 5K p06 (65,5 — pet krugova): dva kvaliteta u ned 2–4 i tempo trke u nedelji −1; traži da višak obima ide u dugi/
  lagane pre kvaliteta (`layoutWeek`). Isto HM p06 (lagani 31 min, ned 1 116 %), 10K p02/p06 (lagani 24–25 min).
- 4 dana sa laganim < 30 min → 3 duža trčanja (5K p02, p09, p15, p13). Brz trening od 4. dana posle provere.
- Raspored: 5 dana bez 4 dana zaredom; test ne u nedelji najvećeg obima; ispis zagrevanja/rastrčavanja.
- MAR: plafon laganog dana u minutima po nivou (p04); korak dugog srazmeran ≤ 12 % (p13, p10); budžet brzog (p06).
- HM s06/s07 (rasterećenje posle povratka; prva puna nedelja nov maksimum); 5K s16; prognoza posle pauze (5K s27).
- Doze uspona/fartleka po obimu (traži manji unos u biblioteci); M22 (jedno merilo vršne nedelje).
- F9 (ulazak u aplikaciju) nije započet.

## Tabovi
Arhivirani svi tabovi motora, HM i ocene. Postojeći tabovi podatka (idle, sa kontekstom): 10K
`session_01GnHHiXivSsUTpEuBAFcJZi`, MAR `session_01GnHHiWbwULZGywbJmwtnzH` (koristi lokalnu granu `v4-work`), 5K
`session_01GnHHiYgBWy4zCKtBd6YPxy` (javlja 68 fajlova / 1070 testova — njegovo okruženje, na grani ne fali ništa).

## Trošak (USD po obračunu sesija, od 13. 11. 22:35; nepotpuno)
Organizator ≈ 47+; motori R18 27, R20-B 44, R20-A ≥ 8, R22-A 36, R22-B ≥ 13; ocene R19 ≈ 60 (procena), R19B 7, R21
48; HM podatak 2 × ≈ 7,5. Ukupno poznato ≥ 300. Vlasnik: 40 % nedeljnog limita za ≈ 14 h.

## Naučeno (ne ponavljaj)
- Krug motora popravi ~5 stvari i pokvari ~4 (R20: posle trke, `breakRamp` preširok, dva polazna broja, tempa). Svaka
  izmena motora mora imati SVOJSTVO nad svim distancama pre push-a, a ocena posle nje samo za dirnute profile.
- Tabovi motora javljaju „kraj" pre nego što obrade dopune poslate usred rada; dopune slati u NOVOM nalogu, ne usred.
- Završne poruke umeju da zaglave; tabovi i organizator staju na 5-satnom limitu bez obaveštenja — zakazati proveru.
- Novi drugi sudija svake runde je 4–5 poena strožiji/blaži: proseci nisu uporedivi, uporediv je samo prag 65.
- Trener razvrstava plafon ulaza strože od organizatora (11, ne 24) — većina slabih profila je slaba zbog generatora.
- Najveća poluga po treneru: PODATAK distance (rast umesto platoa, lagan ≥ 30 min), ne motor.
- Organizator na 600 000+ tokena je skup po poruci; javljati vlasniku zbirno, ne po svakoj poruci taba.
