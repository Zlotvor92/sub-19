# SUB-20: 10 korisnika i 4 nezavisna agentska trenera

Odobrenje: korisnik je prihvatio plan i rekao „Kreni”, zatim „Nastavi” nakon prekida limita. Datum: 11.10.2026. Svi profili su sintetički, a treneri su AI agenti, ne ljudski stručnjaci.

## Zaključana metodologija

- Staro: `aea8dc66e5e6a9940ce48d63a94daace76be1297`, neposredno pre faze 1 ovog ciklusa popravki. Novo: `f7bcbe99d135cd4c1e7b837d0369e8066c1b3baa`, završena faza 3. To nije poređenje sa svakom istorijskom verzijom aplikacije.
- Deset ulaza u `inputs.json`: 3 × 5K, 3 × 10K, 2 × HM, 2 × maraton. Isti ulazi u obe verzije; dodatnu istoriju stari generator ne koristi. Upoređuje se učinak proizvoda nad istim opisom trkača, ne samo pojedinačna algoritamska promena.
- Dvadeset kompletnih osnovnih planova u `raw/`. `blind/` uklanja oznake verzije i izvorne razvojne metapodatke; čuva sadržaj sesija, nedelje, numeričku referencu i upozorenja. A/B identitet se ne otkriva trenerima pre predaje svih osnovnih ocena. Razlike u obliku i sadržaju mogu omogućiti zaključivanje identiteta; savršeno slepo ispitivanje nije garantovano.
- Svaki od deset korisničkih agenata ima svoj profil, pregled svih nedelja, ponovljivu domensku simulaciju događaja i zaseban izveštaj. Korisnički događaji ne predstavljaju stvarno ostvarene sportske rezultate.
- Deset stvarnih UI tokova izvodi Playwright u izolovanim browser kontekstima, preko pravog čarobnjaka i kontrola. Prijava i backend su testni; planovi i dnevnik se ne ubacuju direktno. Ovaj deo ne proverava produkcioni backend, stvarne naloge, satove ili višenedeljni učinak na ljudima.
- Četiri trenera (5K, 10K, HM, maraton) zasebno ocenjuju svih 20 osnovnih planova i koriste primarne javne izvore. Ne čitaju korisničke ni tuđe trenerske izveštaje pre zaključavanja ocena. Zatim zasebno pregledaju deset događaja/promena, bez naknadnog prepisivanja osnovnih ocena.
- Programski zbir i brojanje sesija jesu tehnički dokazi. Ocene adekvatnosti doze, specifičnosti i prikladnosti profilu jesu stručna agentska procena sa obrazloženjem; nisu klinički potvrđene granice.

## Ocene pre pregleda

Svaki kriterijum se ocenjuje od 0 do 10; ponderisani zbir je 0–100:

| Kriterijum | Ponder |
| --- | ---: |
| Prilagođenost stvarnoj bazi, iskustvu i vremenu do trke | 20 |
| Smisao i doza kvalitetnog rada | 20 |
| Progresija obima i dužina | 15 |
| Raspored zahtevnih dana i oporavak | 15 |
| Specifičnost za distancu | 10 |
| Rasterećenje i taper | 10 |
| Numerička i opisna usklađenost | 10 |

Za svaki plan konačnu glavnu ocenu daje trener njegove distance. Prikazuju se i ocene ostala tri trenera, njihov raspon i neslaganja. Ukupna ocena je jednak prosek deset glavnih ocena; nije procenat uspešnih trkača niti univerzalna statistička procena tržišta.

Kritični nalaz je zasebna oznaka, ne nešto što se poništava visokim prosekom. Primeri su gubitak potvrđenog dnevnika, kontradiktorna sesija ili dokazano neusklađen rast koji krši sopstveno obećanje proizvoda. Kratka sesija ili razlika od referentnog programa nije automatski kritična greška.

## Pravila nalaza i nastavka

Svaki potvrđen problem mora imati verziju/profil, konkretnu nedelju/dan, očekivano i dobijeno ponašanje, ponovljiv ulaz i objašnjenje značaja. Trenerski prigovor bez dovoljno dokaza ostaje označen kao hipoteza ili predmet stručnog neslaganja.

Tokom ovog QA kruga ne menja se funkcionalni kod generatora. Dozvoljeni su probe, dokumenti, browser testovi i čuvanje CI dokaza. Završni rezultat je poređenje, četiri nezavisna izveštaja, registar nalaza i konkretan prioritetan predlog popravki. Primena tih popravki je naredni korak.

Prvi pokušaji korisničkih agenata prekinuti su limitom korišćenja i ne računaju se kao završeni pregledi. Nastavak se računa tek po sačuvanom izveštaju i uspešno ponovljenoj probi.
