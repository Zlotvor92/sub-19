# SUB-20 — Faza 2: struktura treninga i osnova pripreme

Datum: 11.10.2026. Grana: `fix/generator-phase2`.
Baza: faza 1, commit `4b2f647d4aeb4555f1370c636d761d8115df7848`.
Predlog je nadograđen na zaseban draft faze 1; nije spojen niti pušten u produkciju.

## Šta je promenjeno

- Opciono se unose datum rezultata, skorija ponovljiva dužina, kontinuitet, pauza i iskustvo sa kvalitetom. Podaci preživljavaju čuvanje i ponovno učitavanje; stari planovi bez njih ostaju čitljivi.
- Procena brzine, iskustvo i dužinska priprema su odvojeni. Brz PB ne potvrđuje iskustvo, a stari PB posle pauze ostaje referenca sa ograničenjem.
- Težina kvalitetnog rada i rast obima imaju odvojene preference. Menjaju dozu, a ne izmišljaju bržu formu ili budući rezultat.
- Uvod u kvalitet zavisi od iskustva: kontrolisan fartlek za početak/povratak, raniji T/I rad za potvrđeno iskustvo. R300 ostaje moguć trening za određenu svrhu, ali nije obavezni zajednički blok za sve.
- LR polazi od ponovljive istorije ili označene pretpostavke. Rast se meri od prethodnog stvarno isporučenog vrha, uz rasterećenje, konsolidaciju maratona, taper, udeo i trajanje.
- Brz završetak dužine računa se u zahtevne dane; kada zameni q2, q1 se ponovo sastavlja. Upareni 10K prag deli budžet 60/40.
- Na tri dana ostaje najviše jedan kvalitet. Ograničenje rasta čuva odnos laganog rada i LR; ponedeljak posle rasterećene dužine ne dobija još jedno automatsko smanjenje koje urušava naredne nedelje.
- Rasterećenje može samo smanjiti već uvedeni stimulans. Ne uvodi prvi kvalitet ni novu bržu zonu. Konačni zbir i opisi se računaju iz stvarnih sesija.
- Pregled plana prikazuje dostignutu dužinu i obim, osnovu podataka i ograničenje pripreme. Kartica trke prikazuje referencu iz unetog rezultata, uz lokalno ograničenje kada spremnost nije potvrđena.

## Poređenje istih osam QA profila

Istorija dodata u fazi 2 je sintetička i izričito označena u `inputs.json`. Nije istorija stvarnih korisnika. Pre/posle koristi iste proširene ulaze; kod faze 1 nova polja ignoriše. Broj sesija nije ocena kvaliteta plana; kompletna nedeljna analiza je u nezavisnom pregledu.

| Profil | Vrh obima pre → posle (km/ned) | Najduži LR pre → posle (km) | Status pripreme posle |
| --- | --- | --- | --- |
| `01_base` | 14 → 12.4 | 5.6 → 4.6 | limited |
| `02_base` | 19 → 18.2 | 8.2 → 6.7 | limited |
| `04_base` | 41.2 → 43.3 | 14 → 14.5 | supported |
| `05_base` | 55.2 → 56.5 | 15.3 → 16.6 | supported |
| `07_base` | 46.2 → 50.2 | 15.3 → 19.5 | supported |
| `08_highvol` | 71.9 → 75.3 | 22 → 22 | supported |
| `09_30km` | 43.1 → 49.1 | 16 → 17.7 | limited |
| `09_base` | 76.8 → 77.3 | 26 → 28 | supported |

`limited` znači da isporučena dužinska priprema ostaje ograničena; `supported` znači da podaci i plan podržavaju odabrane heuristike, bez garancije budućeg izvršenja, završetka ili vremena. Maraton manje baze nije silom podignut do 26–32 km. Njegovo ograničenje je vidljiv ishod.

## Trenersko poređenje i pronađene greške

Kriterijumi su definisani iz 14 primarnih izvora Runna, BAA i Hal Higdon pre osvežavanja zamrznutih izlaza. Javne metodologije koriste se kao kontraprimer krutim pravilima i za poređenje svrhe, progresije i oporavka, a ne za kopiranje rasporeda.

Nezavisni agentski pregled svih nedelja pronašao je početničko povećanje T rada u W8 i povratničko uvođenje prvog kvaliteta u W4 rasterećenja. Oba uzroka su ispravljena; novi izlazi imaju manji obim i najviše 60% prethodnog kvalitetnog rada. Odvojena test provera uhvatila je dvostruki T budžet u novom 10K bloku, koji je takođe ispravljen. Ocene i potpune tabele su u `GENERATOR_PHASE2_REVIEW.md`, vezane za SHA256 izlaza. To nije profesionalno odobrenje ljudskog trenera.

## Provere

- `npm run check` uspešan: TypeScript, ESLint, Prettier i 1.315 testova u 126 fajlova. `npm run build` uspešan.
- Očuvane stroge provere konačnih LR granica, zona, oporavka, kilometraže i broja dana. Novi testovi razdvajaju istoriju/iskustvo od PB-a i kvalitetnu dozu od tempa.
- UI test pokriva nove podatke, nezavisne preference i čuvanje/rehidraciju; dodat je browser E2E sa ponovnim učitavanjem i prikazom pripreme.
- Mreža 192 plana / 3.840 nedelja: bez grešaka generisanja, zbirova, broja kvaliteta i ponovnog kolapsa obima. Ulazi i sve metrike su u `grid.json`, uz digest pregledanog koda.
- Problem M70/3d pon/sre/ned: poslednja radna nedelja 10,2 → 41,6 km uz prvu 40,9 km. Traženih 70 km nije obećano; status ostaje ograničen, LR 17,5 km.
- Lokalni Chromium nije dostupan. Browser potvrda se izvršava kroz GitHub Actions po otvaranju draft PR-a; merodavan je status provera i zapis u njegovom opisu.

Pregled baseline diff-a: svih 2.304 hash-a i nedeljnih km nizova menjaju se; 1.722 scenarija menja broj kvalitetnih sesija. VDOT reference ostaju iste u svim scenarijima.

Baseline se menja tek posle nezavisnih kriterijuma, regresija i pregleda. Zamrznuti izlazi proveravaju stabilnost implementacije; njihovo osvežavanje nije dokaz da su svi planovi trenerski dobri.

## Zapis i reprodukcija

- `GENERATOR_PHASE2_CRITERIA.md`: kriterijumi osam profila i izvori.
- `GENERATOR_PHASE2_REVIEW.md`: kompletne nedeljne doze, zahtevni dani, oporavak i ocene.
- `qa/generator-phase2/inputs.json`, `before.json`, `after.json`: ulazi i kompletni izlazi.

Iz korena repozitorijuma, Node 24:

```sh
node docs/probes/generator-phase2.mjs /tmp/sub20-phase2-after.json
node docs/probes/generator-phase2-grid.mjs /tmp/sub20-phase2-grid.json
# Opcioni drugi argument je checkout faze 1 za poređenje pre:
node docs/probes/generator-phase2.mjs /tmp/sub20-phase2-before.json /path/to/phase1-checkout
cd web
npm run check
npm run build
npm run e2e
```

## Šta ostaje za fazu 3

Pouzdana analiza stvarno odrađenih treninga, preporuke prilagođavanja, propušteni treninzi i povratak, te verzije plana. Ova faza 2 koristi prijavljenu istoriju i stvarno generisanu pripremu; nema validiran individualni model budućeg napretka i ne vraća proizvoljnu prognozu. Koeficijenti doze, kontinuiteta, LR rasta i statusa su transparentne heuristike proizvoda koje treba dodatno proveriti sa ljudskim trenerom i stvarnim praćenjem izvršenja.
