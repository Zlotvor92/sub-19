# P8 — ispravke po slepoj trenerskoj oceni (po distanci)

Jedan zadatak, izvodi se zasebno za svaku distancu (tab dobija `<D>` i radi SAMO u `generators/<D>/v2/**` + dokumentacija).
Sve izmene distance idu u jedan segment; pun nivo te distance trči jednom, na kraju.

Pročitaj prvo: `AGENTS.md`; `docs/generators-v2/perfection/PROGRAM.md` (pravila za tab, „Testovi", „Granica korišćenja",
kraj dnevnika); `P7/KEY-AND-RESULTS.md`; `P7/reviews/<D>.md` i `<D>.json` (zamerke po profilu — to je tvoja lista
simptoma); planove `P7/plans/<D>/` za profile gde je „posle" slab; izveštaje P1–P5 svoje distance; `v2/policy.ts`.

Merilo uspeha nisu brojevi organizatora nego slepa ocena: posle P8 isti profili idu ponovo trenerima. Zato za svaku
zamerku iz ocene svoje distance u izveštaju mora da stoji: uzrok (pravilo, fajl), šta je promenjeno, ili zašto nije.

## Zajednička pravila (sve distance; heuristike, odluka organizatora P8)

**G1 — obim raste do kraja faze razvoja, ne do nedelje 5–7.** Vrh obima (postojeće pravilo vrha) se ne menja. Korak
rasta ne-rasteretne nedelje izgradnje = min(korak po postojećem pravilu; (vrh − poslednji ne-rasteretni cilj) / broj
preostalih ne-rasteretnih nedelja izgradnje do kraja faze razvoja, uključujući tekuću), na 0,1 km, najmanje 0,1 km dok
vrh nije dostignut. U specifičnoj fazi (5K: posle faze u kojoj se danas dostiže vrh) cilj stoji na vrhu. Pravilo samo
usporava rast, nikad ga ne ubrzava; kapacitet, rasterećenja i povratni rast adaptacije ostaju. Dugi prati cilj po
postojećim pravilima (udeo, vreme, skok), pa i on raste do kraja razvoja. Ako je start ≥ vrh, ništa se ne menja.

**G2 — najniži nivo lestvice uvek staje.** Plafon udela zone se računa kao max(udeo × cilj nedelje; doza prvog nivoa
lestvice te zone). Važi u izgradnji, taperu i trkačkoj nedelji (oštrenje), za redovan plan i početnika (početnik: prvi
nivo njegove lestvice). Posledica koja se traži: nema tapera ni trkačke nedelje „bez kvaliteta zbog plafona", početnik
i plan sa 3 dana dobijaju trkački tempo u specifičnoj fazi. Ograničenja zbog bola/povratka ostaju. „Dan kvaliteta ≤
dugi" ostaje kako jeste (njegov izuzetak za najniži nivo već postoji).

**G3 — tekst za trkača.** U napomenama nedelje i upozorenjima plana: bez internih oznaka i reči sastavljanja („nije
izvodljiv", „odstupanje", „cilj po pravilu", „[pravilo] ispred [pravilo]", ID-jevi pravila); napomena sme da tvrdi
samo ono što brojevi tog plana pokazuju (test: za svaku napomenu oblika „X skraćen/spušten da …" proveri da tvrdnja
važi); isto upozorenje najviše jednom po planu (zbirno). Tehničke oznake koje validator čita ostaju u planu ali ne idu
korisniku (postojeći obrazac `userWeekNotes`/`userText`). Napomena testa završava šta trkač radi sa rezultatom.

## Po distanci

**5K:** (a) budžet I/RP: cilj ≥ 40 km 12 % → 10 % (jedan broj 10 % za sve; P4 za mali obim ostaje). (b) Rasterećenje
i taper: utvrdi zašto nedelja rasterećenja može da nosi najveću I dozu plana (P7 p04 „posle" ned 12: I 6 × 800 m) i
taper punu RP dozu (p04 ned 15, p05 ned 9, p07 ned 5); pravilo: kvalitet rasterećenja ≤ 60 % poslednje ne-rasteretne
doze te zone, taper ≤ 70 %; dugi rasterećenja 0,8 × poslednji. (c) Prvi I trening posle R faze ≤ 70 % budžeta I
(skok R 8 min → I 26 min). (d) Trkački dan: WU/CD po pojasu obima kao i treninzi, a kod cilja ≤ 20 km/ned WU ≤ 1,5 km,
CD ≤ 1 km; trkački dan ne sme biti najduži dan plana po km kad je to moguće izbeći. (e) Početnik sa trenutnim obimom
iznad tabele početnika: plan bez oznake početnika (kao HM), ne spuštanje na vrh tabele.

**10K:** (a) G2 posebno za početnika i 3 dana (P7 p03, p10, p11: T 1,5 km 10 nedelja, bez RP 18 nedelja). (b) Dugi
početnika: izmeri zašto je najduži 8,7 km pred trku od 10 km i koja granica ga drži; ako je to udeo/vreme, predloži u
izveštaju najmanju izmenu (ne ugrađuj bez merenja sudara; ako je čista — ugradi: najduži dugi početnika ≥ 10 km kad
vremenska granica to dopušta). (c) p06 (VDOT 58, 25 km, 5 dana): lagani 3–4 km — upozorenje sa preporukom manje dana
već postoji? ako ne, dodaj upozorenje (ne menjaj dužine).

**HM:** (a) Dan kvaliteta duži od dugog na najvišem nivou RP (P7 p04 „posle" ned 18: 3 × 5000 m 20,5 km > dugi 20 km;
p05): nađi uzrok (izuzetak pouke 32 važi samo za NAJNIŽI nivo) i ispravi. (b) Nedelja sa blokom: nivo bloka se bira
tako da RP trening + blok ≤ 25 % cilja nedelje (jedan vlasnik: izbor bloka; ne staje ni prvi nivo → nedelja A).
(c) Kontrolni test: ako poslednja ne-rasteretna nedelja razvoja ima najveći cilj obima u planu, test ide nedelju ranije
(prethodna ne-rasteretna nedelja razvoja); izmeri koliko planova to menja.

**Maraton:** (a) Napomena „MP skraćen da dan ne bude duži od dugog" kad je dan i dalje duži (7 planova u P7): ispravi
logiku ili tekst da tvrdnja važi. (b) Početnik: MP rad u jednom treningu ≤ 60 min (P7 p12: 2 × 7000 m ≈ 90 min).
(c) Nedelja sa blokom već nema MP trening; proveri da nijedna nedelja nema MP trening + T + dugi sa blokom.

## Redosled rada

1. Sve prvo na patch-u; mreža P0 (`P0/measure.ts <D>`), svoje mreže i 12 profila P7 (skripte u `P7/`: generiši „posle
   P8" u `P8-<D>/plans/` — NE diraj `P7/plans`): odbijanja, invarijante, i za svaku zamerku iz ocene pre/posle.
2. Ugradi; `policy.ts` redovi (pravilo, mesto, obrazloženje „heuristika, odluka organizatora P8, nalaz slepe ocene"),
   naredna minor `policyVersion`, `KNOWN_VERSIONS` zadržava sve ranije verzije.
3. Sabotaže za G1, G2 i izmene distance; testovi po odeljku „Testovi" (namenski u toku rada; na kraju jednom
   `npm run check`, `--changed`, pun nivo svog foldera, E2E svoje distance). Lokalni commit posle svakog koraka; jedan
   push koda na kraju (`git pull --rebase` pre push-a). Kratki izlazi komandi.

## Stani i javi (`reports/P8-<D>-STOP.md`, opcije sa brojevima) — i nastavi sa onim što od odluke ne zavisi

Nova odbijanja ulaza koji su davali plan; G1 daje identične uzastopne nedelje koje validator odbija ili spušta dozu u
> 5 % planova; G2 pravi nedelje > 30 % brzih km u > 5 % planova neke grupe; sudar sa „dan kvaliteta ≤ dugi" ili
„doza ne opada" koji postojeća tumačenja ne rešavaju.

## Izveštaj i kraj

`docs/generators-v2/perfection/reports/P8-<D>-REPORT.md` (≤ 200 redova): tabela „zamerka iz ocene → uzrok → izmena →
pre/posle na profilima P7", metrike P0 pre/posle (plato dugog i obima u nedeljama, % brzih km, taper bez trkačkog tempa,
nedelje > 25 %), odbijanja, promenjeni planovi po klasi, trajanje testova, šta nije urađeno i zašto. Commit + push, pa
`send_message` organizatoru (`session_01GnHHiXE3NeQzLDcD3vaM5E`); ako alat traži dozvolu koju niko ne može da da, ne čekaj.
