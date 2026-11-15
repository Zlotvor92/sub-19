# P1 — odluke organizatora posle STOP (89f31c8)

STOP je opravdan: S1 kako je zadat (nedelja B bez RP treninga) vraća ukupni RP na nivo hm-v2.8.0 i poništava S2. Greška
je u nacrtu pravila, ne u izvođenju. S1 se menja; ostalo iz `P1-hm-specificnost.md` važi osim gde ovde piše drugačije.

## S1 (novo) — nedelja B zadržava RP trening, blok u dugom zamenjuje T

- Važi samo za redovan plan sa 4, 5 ili 6 dana. 3 dana i početnik: nema nedelje B (samo S2). To je svesno: jedan
  kvalitetni dan nedeljno, a „B ne staje" je tu 39–63 %.
- Tip A (kao danas): Q1 = RP trening, Q2 = T cruise, dugi lagan.
- Tip B: Q1 = RP trening po svojoj lestvici, BEZ prekida (napreduje svake ne-rasteretne specifične nedelje, kao u
  hm-v2.8.0 + S2); Q2 postaje lagan dan — isti mehanizam kao pouka 35 (stanje T slota se ne menja, oslobođen obim
  raspoređuje vlasnik dužina); dugi ima završni blok u RP, lestvica 4 → 6 → 8 km, granice kao ranije (≤ 40 % dugog,
  vremenska granica dugog, pouka 32 za dan Q1 prema dugom sa blokom).
- Raspored tipova: poslednja ne-rasteretna nedelja izgradnje (pred taper) je B; unazad se smenjuju (… A, B, A, B).
  Tako priprema sa 3 ne-rasteretne specifične nedelje ima B, A, B. Blokovi rastu redom nedelja B.
- B ne staje → nedelja je A (P-a), uz napomenu; sledeće nedelje po rasporedu. Prijavi % po grupi; ako je > 10 % u nekoj
  grupi 4–6 dana, navedi uzrok u izveštaju (ne stoj).
- T slot: nastavlja u sledećoj nedelji A od poslednje T doze (ne opada).

## H12 „glavna doza ne opada" — O1

Glavna doza nedelje = T + I + RP trening + blok. Poređenje unutar tipa: A sa poslednjom ne-rasteretnom A (ili sa
poslednjom nedeljom pre specifične faze), B sa poslednjom B. Uz to RP slot (trening) ne opada iz nedelje u nedelju bez
obzira na tip — to je postojeće pravilo slota. Jedna funkcija za konstruktor i validator.

## S2 (dopuna) — plafon RP po pojasu cilja nedelje

Jedan plafon, tabela po cilju nedelje: cilj < 40 km → 15 % (kao do sada); cilj ≥ 40 km → 20 %. Razlog: 84 nedelje
> 25 % km bržih od E, sve na dnu obima 25–30 km. Lestvica: potvrđujem — `2 × 5000 m` već postoji, dodaje se samo
`3 × 5000 m`. Posle izmene ponovo izbroj nedelje > 25 %; preostale navedi sa uzrokom.

## Šta očekujem u izveštaju (pored zadatog)

Tabela pre / samo S2 / S1 + S2 za iste metrike kao u STOP-u, plus: % km bržih od E u nedelji A i nedelji B odvojeno;
broj zahtevnih dana po nedelji (mora ostati ≤ 2 kvaliteta + dugi sa blokom umesto jednog od njih — nedelja B ima RP
trening i dugi sa blokom, bez T); profil (a) pun ispis. Orijentiri ostaju orijentiri, ne pragovi.

## Nastavak

S3 (adaptacija), S4 (prikaz), sabotaže, testovi po odeljku „Testovi", jedan push koda na kraju — kao u zadatku. Novi
sudar → ponovo STOP sa brojevima.
