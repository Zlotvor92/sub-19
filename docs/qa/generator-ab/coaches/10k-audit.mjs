import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Jedini ulazi: odobreni blind/U01..U10.json. Bez izvora generatora i drugih ocena.
const base = path.resolve('docs/qa/generator-ab');
const weights = {fit:20, quality:20, progression:15, recovery:15, specificity:10, deloadTaper:10, coherence:10};
const names = Object.keys(weights);
const C = (week, day, issue, expected, actual) => ({week, day, issue, expected, actual});
const rows = [
['U01','A',[8,7,8,9,6,8,8],'usable_with_concerns',[],[
C(7,3,'Naziv T ne znači razvijen prag','Jasno označiti 6×30 s kao upoznavanje sa bržim korakom, ne dokaz pragovske izdržljivosti','3 min rada, 90 s laganog oporavka; opis upoznavanja jeste primeren'),
C(10,7,'Ograničena priprema za želju 30:00','Zadržati uslovnu preporuku i proveru forme; ne ubrzavati prema želji','LR 4.6 km, vrh 12.4 km/ned; 35:00 je referenca, upozorenje spremnosti postoji')]],
['U01','B',[7,7,7,8,7,7,5],'revise',[],[
C(9,7,'Kasno ubrzanje dužine početnika','Posle rasterećenja uporediti i sa prethodnim vrhom; uvoditi trajanje prema toleranciji','LR 6.1 km naspram prethodnog vrha 4.9 u N7; N10 6.5 km'),
C(12,7,'Cilj i preporuka nisu razdvojeni','30:00 prikazati kao želju; 7:00/km daje 35:00 i nije obećanje završetka','TRKA: cilj 30:00 / ritam 7:00/km; prezentacija predviđa 33:24 i tvrdi plan za ISTRČIŠ')]],
['U02','A',[7,7,8,8,7,8,5],'revise',[],[
C(1,3,'Tri početne sedmice uskog R obrasca','Za some iskustvo dozvoljen je R, ali obrazložiti svrhu i kasniji razvoj aerobne brzine','N1–N3 isti 4×300 m, 3:16 hoda; T tek N6'),
C(16,7,'SUB20 nije predikcija plana','Sačuvati želju 19:59 i odvojiti PB-referencu 23:45','cilj 19:59 / ritam 4:45; presentation referenceTimeSec=1329, bez novog rezultata')]],
['U02','B',[8,7,8,9,6,8,9],'usable_with_concerns',[],[
C(13,3,'RP ima mali kontinuitet','Za uvežbavanje 5K ritma razmotriti duži zbir ili kraći oporavak prema toleranciji','2×1000 m @4:45, 3:34 hoda; samo 9.5 min rada'),
C(9,1,'Kilometri više rastu od specifičnog rada','Ne menjati automatski tempo; proveriti da li dodatni laki obim i 14.5 km LR služe profilu','11.6 km lako u N9 uz 2.3 km I i 2.8 km T; vrh LR ostaje 14.5')]],
['U03','A',[8,7,7,9,6,8,9],'usable_with_concerns',[],[
C(11,2,'Iskusni 5K profil dobija slabiju progresiju I','Razvijati ukupno vreme ili gustinu podnošljivih I deonica, bez obaveznog broja','N5/N7/N11 isti 2×1200 m @3:57, 3:33 hoda; 9.48 min rada'),
C(13,2,'RP olakšan dugim odmorom','Usaglasiti rad/odmor sa namerom specifične izdržljivosti','3×1000 m @4:07, 3:05 hoda; 12.35 min rada')]],
['U03','B',[8,8,7,8,8,8,5],'revise',[],[
C(1,2,'Uska početna brzinska sekvenca','R je legitiman izbor, ali raznovrsnost i odnos prema I/T treba da imaju svrhu','N1/N2 8×300 m; N3 9×300 m; T 3×1600 u sve tri sedmice'),
C(16,7,'Automatski napredak forme nije rezultat','Referencu ne predstavljati kao realan ishod ciklusa','referenceTimeSec=1163 (19:23), VDOT 48.2→51.7; tekst cilja 18:59 uz 4:07/km')]],
['U04','A',[6,7,7,7,8,8,4],'revise',[],[
C(1,3,'Nepostepen uvod bez iskustva kvaliteta','Prve brže deonice kontrolisano i kraće, uz objašnjenje namere','4×300 m R @4:34, 3:26 hoda u N1; N2 dodatno T 2.8 km'),
C(1,7,'Početna dužina prelazi prijavljenu bazu','Početi oko ponovljivih 8 km ili obrazložiti procenu tolerancije','9.7 km (+21% prema 8 km); N2 10.4, N3 11'),
C(16,7,'Neosnovana prognoza i neusaglašen cilj','50:00 kao želja; 51:53 kao ekvivalent skorašnjeg 5K; bez sigurnog napretka','referenceTimeSec=2890 (48:10), VDOT 38.3→41.8 bez novog testa; cilj 50:00 / ritam 5:11/km (51:50)')]],
['U04','B',[9,7,8,9,6,9,9],'usable_with_concerns',[],[
C(3,5,'Dve sitne T sesije umesto jedne jasnije','Za prvo specifično iskustvo može jedan pragovski stimulus i laka druga sesija','N3 D3 1.1 km T (5.79 min), D5 0.7 km T (3.69 min), svaka oko 5.8 km wu+cd'),
C(13,3,'RP sa oporavkom nalik I','U kasnoj specifičnoj fazi obrazložiti ovaj vrlo lak RP ili razmotriti kraći odmor/više kontinuiteta','2×1000 m @5:11, 3:53 hoda; N14 2×1200, 4 min hoda'),
C(14,7,'Dužina raste dok RP ostaje mali','16.2 km LR nije obavezno predugo, ali raspodelu prema 10K cilju treba opravdati','D1 12.2 km lako, LR 16.2; RP samo 2.4 km u istoj nedelji')]],
['U05','A',[8,7,8,9,6,9,9],'usable_with_concerns',[],[
C(11,2,'Skromno I izlaganje za iskusan profil','Procenu doze vezati za 24 sedmice kontinuiteta i 45 km baze; razviti rad ili gustinu ako oporavak dozvoljava','N5/N7/N11 2×1200 m @4:09, 3:44 hoda; 9.96 min rada i vrh 68.2 km'),
C(13,2,'RP nedovoljno gust za brzinsku izdržljivost','3×1200 može biti korisno; objasniti zašto 4 min hoda pri potvrđenom 10K ritmu','3×1200 @4:30, 4 min hoda; N14 2×1600 sa istim odmorom'),
C(1,5,'Onboarding doza bez jasne potrebe','Prvih 5.5 min T označiti kao konzervativni uvod i navesti kada se menja prema odgovoru','1.2 km T u petak; prethodno D2 2×700 T za experienced profil')]],
['U05','B',[8,8,8,8,9,8,5],'revise',[],[
C(7,5,'Kombinacija dva kvaliteta i LR zahteva nadzor','Za 24 sedmice iskustva prihvatljivo uz mogućnost smanjenja na umor','4×1200 I (19.92 min) D2, 3×2000 T (27.6 min) D5 i LR18.4 D7'),
C(16,7,'Rezultatsko obećanje bez merenja','42:00 sačuvati kao želju; 45:00 kao poznati rezultat','VDOT45.3→48.8, referenceTimeSec2533 (42:13) bez novog testa; cilj42:00 / ritam4:30')]],
['U06','A',[5,6,6,8,6,8,3],'revise',[
C(1,7,'Povratnik počinje iznad potvrđene dužine','Posle 8 sedmica pauze početnu ukupnu i trčanu dužinu približiti 4 km i prilagoditi odgovoru','5.9 km run/walk (+47.5% ukupne distance); N2 6.5, N3 7.1; odnos run/walk se istovremeno menja')],[
C(10,3,'Stari PB tretiran kao potvrđena forma','Usloviti ubrzavanje kontrolisanom proverom/RPE nakon povratka','R3×300 @4:55 sa3:41 hoda; paces izvedeni iz 5K PB pre godinu dana'),
C(16,7,'Završetak i cilj nisu potvrđeni','Pošteno navesti da 27-min stari5K ne potvrđuje današnju10K izdržljivost','referenceTimeSec3103 (51:43), VDOT35→38.5; upozorenje kaže da plan služi da se ISTRČIŠ, trka cilj60:00')]],
['U06','B',[8,7,6,9,4,8,9],'usable_as_return_to_running_only',[],[
C(14,7,'Povratna baza, ograničena priprema za10K','Zadržati upozorenje; ciljnu trku usloviti dokazom tolerancije dužine ili produženjem pripreme','LR6.7 km i vrh18.2 km/ned;3 dosledne povratne nedelje, samo1 nedelja kontinuiteta na ulazu'),
C(14,3,'RP podleže velikom odmoru','Opisati kao kontrolisano upoznavanje sa ritmom, ne dokaz mogućnosti60min10K','2×1000 @6:00 sa4min hoda; N15 2×600 sa2:42 hoda'),
C(1,1,'Tempo posle pauze još nije potvrđen','Lako trčanje i strides voditi prema govornom testu/RPE dok nova forma nije proverena','6:47/km i6×20s strides od N1; presentation ispravno upozorava da stari PB nije trenutna forma')]],
['U07','A',[8,7,8,8,8,8,9],'usable_with_concerns',[],[
C(10,3,'HMP razbijen dugim odmorom','Objasniti oporavak ili povećati kontinuitet prema toleranciji','2×1700 @5:11 sa5:26 hoda; isti N11/N14'),
C(13,7,'Najveća dužina uz kontrolni rad iste nedelje','Proveriti oporavak od36min HMP pre novog LR vrha','D3 kontrola7km@HMP; D7 LR19.5 km prvi put'),
C(14,5,'Taper vraća drugi kvalitet','Smanjiti ukupno opterećenje, čuvati kratku oštrinu bez novog zamora','N13 jedan kvalitet; N14 i N15 ponovo dva, uz smanjen obim')]],
['U07','B',[7,7,7,8,6,7,4],'revise',[],[
C(11,7,'Skromna ponovljena dužinska priprema prvog HM','Ne zaključivati spremnost na1:45 iz brzinskog PB; dužinu individualno razvijati','LR vrh15.3 km, N5–N9 plafon14 km; presentation nema readiness procenu'),
C(16,7,'Prognoza napretka bez potvrde','Razdvojiti želju1:45 od referentnog ekvivalenta1:49:15','referenceTimeSec6107 (1:41:47), VDOT40.7→44.2; nema upozorenja o cilju, race pace5:11')]],
['U08','A',[8,8,8,8,8,7,5],'revise',[],[
C(12,5,'Više kvalitetnog rada u prvoj taper sedmici','Taper rasterećuje i rad, ne samo lake kilometre; proceniti sve ključne dane','N11 samo27min HMP; N12 isti27min HMP plus21.92min T, LR17.2 km'),
C(14,7,'Prognoza iz automatskog VDOT','1:35 na osnovu sadašnjeg rezultata može biti razuman cilj ali nije validirana prognoza','referenceTimeSec5383 (1:29:43), VDOT48.2→51.2; bez novog rezultata')]],
['U08','B',[8,7,8,9,8,8,9],'usable_with_concerns',[],[
C(9,2,'HMP duga pauza','Za performance HM objasniti5-min oporavak ili razmotriti kontinuitet; nije automatski nebezbedno','2×2500 @4:30 sa4:44 hoda; isti N11/N12'),
C(12,5,'Taper ponovo dodaje T','Opravdati povećan broj stimulusa kada se obim spušta','N11 22.5min HMP; N12 isti22.5min HMP plus19.29min T'),
C(1,5,'Veoma mala početna T doza','Experienced profil sa55km i24nedelja treba jasnu nameru konzervativnog uvoda','2×700 T (6.14min), wu+cd6.5km; nema zabrane ovakve sesije')]],
['U09','A',[5,6,6,8,2,8,9],'not_race_ready',[
C(20,7,'Maratonska distanca nije pripremljena','Usloviti izlazak na42.2 km produženjem pripreme ili dokumentovanom znatno većom dužinskom tolerancijom','VrhLR17.7 km uN17, nikad20km; zatim TRKA42.195 km; readiness upozorenje postoji')],[
C(14,3,'Mala maratonska specifična doza','Uz ovako nisku LR bazu prioritet trajanje i laka izdržljivost, ne dva kratka kvaliteta','2×1200 MP (13.64min); N17 2.5km MP i3.7km T'),
C(20,7,'Preporučeni ritam uprkos ograničenoj izdržljivosti','Reference iz HM predstaviti uslovno i izbegavati utisak operativnog maratonskog tempa','5:41/km oko4h iz HM PB; tekst dodaje da spremnost nije potvrđena')]],
['U09','B',[3,5,4,7,2,7,2],'not_race_ready',[
C(20,7,'Maraton od42.2km na vrhuLR16km','Ne predstaviti ovaj ciklus kao plan koji potvrđuje završetak; produžiti dužinsku pripremu','LR16 km samoN14/N17, većinaN5–N11 12.8km; race42.195 km, upozorenje kaže plan za ISTRČIŠ')],[
C(14,7,'Kasni skok dužine i gust kvalitativni obim','Duže izlaganje razvijati ranije i rasteretiti okolne sesije prema odgovoru','13.6→16 km (+17.6%) uz D3 6km MP iD5 3.2km T; D1 samo3km'),
C(20,7,'Predviđen rezultat bez dokaza maratonske izdržljivosti','Ne predviđati3:20 na osnovu automatske promene VDOT','referenceTimeSec12021 (3:20:21), VDOT42.6→47.1; cilj4h i5:41/km; nema konkretne LR readiness opomene'),
C(1,7,'Broj dana tretiran kao problem umesto isporuke','4dana mogu biti validna za maraton; proceniti stvarne LR i obim','N1 D7 LR10.9km; globalno upozorenje traži najmanje5dana; Higdon Novice1 iBAA Level1 imaju4 dana')]],
['U10','A',[7,8,6,8,7,7,4],'revise',[],[
C(1,7,'Gubitak dužinske kontinuitetne baze','Ako nema pauze/zamora, objasniti spuštanjeLR24km pa dugo ponovno građenje','N1 LR15.2, N2 16, N3 16.9; tekN14 prelazi24km'),
C(14,7,'Kasni veći skok LR','Proveriti3stimulusa i skok dužine; smanjiti okolni kvalitet ako treba','N13 22.8→N14 28.2 km (+23.7%); D2 8km MP iD5 7.5km T'),
C(20,7,'Automatska prognoza pretvara želju u ishod','3:30 kao želja;3:45 kao poznati rezultat, novo merenje za ubrzanje','referenceTimeSec12381 (3:26:21), VDOT41→45.5; nema upozorenja o cilju;5:20/km daje3:45')]],
['U10','B',[9,7,9,8,6,8,9],'usable_with_concerns',[],[
C(17,2,'Mala maratonska specifična doza za iskusnog','Sa ponovljenimLR29.3km razmotriti kontrolisane duže MP blokove, uz očuvanje oporavka','N11/N13/N17 MP3.3km (17.6min); N14 2×1600 sa90s; dužine su sve lake'),
C(14,1,'Nedelja ima više trajanja nego broj hard oznaka','Nadzirati zamor nakonLR, uz fleksibilno lak ponedeljak','LR29.3 uN13 D7, N14 D1 12.2 lako,D2 MP,D3 srednja17.6,D5 T,D7 LR29.3'),
C(18,5,'Prva taper sedmica drži pun T rad','Intenzitet može ostati; proceniti da li doza4.4km T treba redukciju','N14 D5 2×2200 T, istiN18 D5; obim80.1→64.1, LR29.3→21.8')]]
];

const inputs = new Map();
for (let i=1;i<=10;i++) {
 const id=`U${String(i).padStart(2,'0')}`;
 const file=path.join(base,'blind',`${id}.json`);
 const raw=fs.readFileSync(file);
 inputs.set(id,{data:JSON.parse(raw),sha256:crypto.createHash('sha256').update(raw).digest('hex')});
}
const scores=rows.map(([id,side,v,verdict,criticalIssues,mainConcerns])=>{
 const criteria=Object.fromEntries(names.map((n,i)=>[n,v[i]]));
 const p=inputs.get(id).data;
 return {id,side,distance:p.profile.input.raceDistM,criteria,total:Number(names.reduce((a,n)=>a+criteria[n]*weights[n]/10,0).toFixed(2)),verdict,criticalIssues,mainConcerns,confidence:id==='U04'||id==='U05'?'high':id==='U06'?'moderate-high':'moderate',reviewedWeekCount:p.plans[side].plan.weeks.length};
});
const esc=s=>String(s).replaceAll('|','/').replaceAll('\n',' ');
let md=`# Nezavisna trenerska ocena — 10K specijalista\n\nDatum pristupa primarnim izvorima: 2026-10-11. Pregledano svih 20 planova i svaka nedelja. Identitet A/B nije otkriven; obrasci i prezentacioni tekst mogu odati tragove, pa ne tvrdim savršeno zaslepljivanje. Nisam čitao raw/manifest/izvor generatora/probe/users, druge trenerske izveštaje ni prethodne faze. Događaji/adaptacije nisu predmet ove zamrznute ocene.\n\nOcene 0–10: fit20%, quality20%, progression15%, recovery15%, specificity10%, deloadTaper10%, coherence10%. Ukupno=sum(ocena×ponder/10). 10 znači odlično usaglašeno sa poznatim profilom; 5 zahteva važne izmene; 0 nije upotrebljivo. Verdict je stručna preporuka, ne dijagnoza ili numerički prag. Confidence označava sigurnost procene iz dostupnih sintetičkih podataka, ne sigurnost uspeha trkača.\n\nProcena razmatra početnu ponovljivu dužinu, kontinuitet, kvalitet i cilj zajedno. Nijedan javni program nije univerzalni minimum. Ne zahtevam 300m, piramidu, istu dozu rada za sve, univerzalno 80/20, fiksnih10% rasta ni obaveznih5dana maratona. T = kontrolisani prag, I = aerobna brzina/VO2 stimulus, R = ekonomija i opuštena brzina uz potpuniji odmor, RP = održavanje ritma ciljne distance. Dugi hod pri R može biti nameran; isti odmor pri RP može umanjiti kontinuitet i treba drugačije obrazloženje. Kratke30–60s deonice nisu same po sebi greška I/T, ali je njihov kumulativni stimulus različit od dugog pragovskog ili VO2 rada.\n\nPredikcija iz automatskog VDOT rasta nije potvrđen rezultat. Ekivalent iz5K/HM može dati brzinsku referencu, ali ne potvrđuje dužinsku pripremu. PB je datumom posebno problematičan kodU06. Ukupan race-week obim sadrži trku; taper procenjujem i bez trke. Rutinska snaga je opciona, i nemerena dodatna opterećenja ostaju nepoznata.\n\n## Primarni izvori i granice primene\n\n- B.A.A. originalni10K program: https://www.baa.org/races/boston-10k/info-for-athletes/b-a-a-10k-training/ (pristupljeno2026-10-11). Pokazuje razlikovanje iskustva, rad na10K/5K/HM ritmu i razvoj vremena u deonicama; ne propisuje obaveznu piramidu niti300m.\n- Hal Higdon, Intermediate10K: https://www.halhigdon.com/training-programs/10k-training/intermediate-10k/ (2026-10-11). Program je za već formiranu bazu, menja tempo i400m na5K ritmu, ima lake dužine i rasterećenu završnicu. To je primer legitimne drugačije strukture, ne norma za sve profile.\n- Runna, originalni10K vodič: https://support.runna.com/en/articles/6186788-the-ultimate-10k-training-guide (2026-10-11). Razdvaja intervale sa odmorom i duže kontrolisane tempo napore. Hod je dozvoljen; procena odmora ovde je funkcionalna, ne zabrana hodanja.\n- Muñoz i saradnici, randomizovano10nedelja kod30 rekreativnih trkača: https://pubmed.ncbi.nlm.nih.gov/23752040/ (2026-10-11; DOI10.1123/ijspp.2012-0350). Obe raspodele intenziteta poboljšale su10K; razlika glavnih grupa nije bila statistički značajna. Nalaz podržava veliki laki deo i individualnu procenu, ne jedini dozvoljeni model.\n- Munoz i saradnici, originalna studija specifičnog intenziteta,13 dobro treniranih trkača: https://pubmed.ncbi.nlm.nih.gov/26448854/ (2026-10-11; DOI10.5812/asjsm.24900). HIT iRP dali su sličan10K napredak. Iz toga ne sledi obavezna forma intervala ili ista doza za početnika i iskusnog.\n- Shepley i saradnici, originalna ukrštena studija tri7-dnevna tapera kod9 srednjeprugaša: https://pubmed.ncbi.nlm.nih.gov/1559951/ (2026-10-11; DOI10.1152/jappl.1992.72.2.706). Smanjen obim uz zadržan intenzitet dao je bolji rezultat vremena do zamora nego potpuni odmor. Generalizacija na rekreativni maraton ili identične procente je ograničena.\n- B.A.A. originalni5K: https://www.baa.org/races/boston-5k/info-for-athletes/boston-5k-training/ (2026-10-11); originalniHM: https://www.baa.org/races/boston-half/info-for-athletes/boston-half-training/ (2026-10-11). Različiti nivoi imaju različita trajanja kvalitetnog rada i simulacije; koriste se za proveru smisla, ne kopiranje.\n- Hal Higdon Novice1 maraton: https://www.halhigdon.com/training-programs/marathon-training/novice-1-marathon/ (2026-10-11), iBAA: https://www.baa.org/races/boston-marathon/info-for-athletes/boston-marathon-training/ (2026-10-11). Oba pokazuju da4dana mogu biti valjan izbor. Razvoj ponovljenih dužih izlaganja je glavna razlika premaU09;20milja izHigdona nije univerzalni obavezni prag.\n\nPrimarni izvor potvrđuje princip ili alternativu; svaka konkretna zamerka i očekivanje u nastavku jeste moja stručna inferencija prema profilu, ne direktna preskripcija izvora.\n\n## Rezultati svih20planova\n\n|ID|Strana|Distanca(m)|Fit|Quality|Progression|Recovery|Specificity|Deload/taper|Coherence|Ukupno|Verdict|\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|\n`;
for(const s of scores) md+=`|${s.id}|${s.side}|${s.distance}|${names.map(n=>s.criteria[n]).join('|')}|${s.total}|${s.verdict}|\n`;
md+='\n## Detaljna10K procena\n\nU04 A: RP fazaN13–N14 sa3×1000/1200 i60s odmora daje smisleniju specifičnu gustinu od ranog R bloka, a N15/N16 obim se smanjuje. Glavni problem je rani start kvaliteta kod qualityExperience=none iLR9.7 prema8km, uz neosnovani očekivani napredak. U04 B ima bolji uvod, čuva početnuLR8km i iskreno razdvaja želju od reference. Ipak, N3 dve mini-T sesije i kasniji RP sa skoro4min hoda troše mnogo vremena na zagrevanje/hlađenje i daju mali specifični kontinuitet. LR16.2 nije sam po sebi greška za10K; problem je odnos prema samo2.4kmRP.\n\nU05 A: fit i obim su uglavnom dobri, LR počinje14km, taper stvarno smanjuje obim i prikaz pošteno čuva45:00 kao referencu. Kombinacija blago doziranog I iT može raditi, ali ukupna doza I ostaje oko10min i kada obim dođe65–68km. RP3×1200/2×1600 sa4min hoda teško prati svrhu10K brzinske izdržljivosti. U05 B ima ubedljivije razvojne I/T/RP sesije za24nedelje iskustva, posebno5×1200 sa60s uN13. R blok nije diskvalifikacija niti obaveza. Raspored daje48–72h između ključnih dana, ali napredak42:13 izVDOT nije potvrđen i završni tekst cilja/tempa ostaje neusaglašen.\n\nU06 A: run/walk smanjuje deo trčanog opterećenja, zato +47.5% ukupne distance nije automatski ista promena trkačkog rada; ipak dužina5.9km, rast odnosa trčanja/hoda i prijavljena pauza zahtevaju bolji početni oslonac. Prvi kvalitet uN9 jeste odložen, ali stari PB nema jasnu verifikaciju. U06 B pravilno ostaje povratni plan sa početnomLR4km,3lake povratne sedmice i jasnim upozorenjem o starom PB. Cena je vrlo ograničena10K priprema: LR6.7 i2×1km sa4min odmora ne dokazuju60min kontinuiranog trčanja. Ne bih bez novog dokaza ovaj ciklus odobrio kao siguran60min10K plan; upotrebljiv je kao povratak trčanju.\n\n## Pojedinačni nalazi i pregled svake nedelje\n\nDani:1ponedeljak…7nedelja. Tabela prikazuje sve treninge sa kilometražom; off/snaga bez kilometraže ostaju u JSON-u. RW ukupna kilometraža uključuje hod. Rad/odmor/zona dolaze iz plan.session; pregled ne oslanja odluku na praznu summary.failures listu. Sve nedelje i sva session/strides/runWalk polja su pregledana. Provera zbira dnevnih km iweek.vol tolerancija0.15km nije našla neslaganja.\n';
for(const s of scores){
 const {data,sha256}=inputs.get(s.id); const v=data.plans[s.side];
 md+=`\n### ${s.id} ${s.side} — ${data.profile.label}\n\n${s.total}/100; ${s.verdict}; pouzdanost ${s.confidence}. Pregledano${s.reviewedWeekCount}nedelja. Ulaz${data.profile.input.weeklyKm}km/ned, LR${data.profile.input.recentLongRunKm}km; vrh${v.summary.peakWeeklyKm}km/ned iLR${v.summary.peakLongRunKm}km. SHA256blind ulaza: ${sha256}.\n\n`;
 for(const [severity,list] of [['Kritično',s.criticalIssues],['Zamerka',s.mainConcerns]]) for(const c of list) md+=`- **${severity}, N${c.week}/D${c.day}: ${c.issue}.** Očekivano: ${c.expected}. Stvarno: ${c.actual}.\n`;
 md+='\n|N|Km|D/L/T|Raspodela dana(km)|LR/RWmax|Kvalitet: svrha, rad i odmor|\n|---:|---:|---|---|---:|---|\n';
 for(const w of v.plan.weeks){
  const days=w.days.filter(d=>d.km).map(d=>`D${d.dow} ${d.tag} ${d.km}`).join('; ');
  const longest=Math.max(0,...w.days.filter(d=>d.tag==='lr'||d.tag==='rw').map(d=>d.km));
  const ss=w.days.filter(d=>d.session).map(d=>{const z=d.session;return `D${d.dow}: ${d.desc}; zona${z.zone??'—'}, izvor${z.paceSource??'—'}`}).join(' / ');
  const rw=w.days.find(d=>d.runWalk);const fallback=rw?`RW ${rw.runWalk.label}`:'Lako/odmor/trka; bez strukturisanog kvaliteta';
  md+=`|${w.w}|${w.vol}|${w.deload?'deload ':''}${w.taper?'taper ':''}${w.focus??''}|${esc(days)}|${longest}|${esc(ss||fallback)}|\n`;
 }
 md+=`\nPrezentacija: referenceTimeSec=${v.presentation.referenceTimeSec}; initialVdot=${v.presentation.initialVdot}; lastVdot=${v.presentation.lastVdot}; preparation=${esc(JSON.stringify(v.presentation.preparation??null))}.\n\nZavršna trka: ${v.plan.weeks.at(-1).days.find(d=>d.tag==='trka')?.desc??'—'}.\n`;
}
// Završna validacija obuhvata svih 324 nedelje iz dozvoljenih ulaza.
for (const s of scores) {
 const p=inputs.get(s.id).data.plans[s.side].plan;
 if (Object.values(s.criteria).some(v=>v<0||v>10)||!s.mainConcerns.length) throw new Error('Invalid score');
 for (const w of p.weeks) {
  const sum=w.days.reduce((n,d)=>n+(d.km??0),0);
  if(Math.abs(sum-w.vol)>0.15) throw new Error(`${s.id}/${s.side}/N${w.w}: km mismatch`);
 }
}
const polish = text => text
 .replace(/(\d)(?=(?:km|dana|nedelja|nedelji|sedmica|sedmice|min|planova|nedelja|nedeljn|nedelja))/gu,'$1 ')
 .replace(/(\p{L})(?=(?:U\d{2}|N\d{1,2}|D\d|VDOT|PB|LR|RP))/gu,'$1 ')
 .replace(/(?<=\d)(?=(?:iz|uN|na|pre|kod|sa|u|bez))/gu,' ')
 .replace(/(pristupljeno|DOI|Datum)(?=\d)/gu,'$1 ');
const cleanScores=scores.map(s=>({...s,criticalIssues:s.criticalIssues.map(c=>Object.fromEntries(Object.entries(c).map(([k,v])=>[k,typeof v==='string'?polish(v):v]))),mainConcerns:s.mainConcerns.map(c=>Object.fromEntries(Object.entries(c).map(([k,v])=>[k,typeof v==='string'?polish(v):v])))}));
fs.writeFileSync(path.join(base,'coaches','10k-scores.json'),JSON.stringify(cleanScores,null,2)+'\n');
fs.writeFileSync(path.join(base,'coaches','10k-review.md'),polish(md));
console.log(JSON.stringify({entries:scores.length,reviewedWeeks:scores.reduce((a,s)=>a+s.reviewedWeekCount,0),scores:scores.map(s=>({id:s.id,side:s.side,total:s.total})),weights},null,2));
