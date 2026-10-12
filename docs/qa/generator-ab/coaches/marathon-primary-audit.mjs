import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Nezavisan pregled: jedini lokalni ulazi su blind/U01.json ... blind/U10.json.
// Ne učitava generator, manifest, druge recenzije ili njihove ocene.
const dir = path.dirname(new URL(import.meta.url).pathname);
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const cases = Array.from({length:10}, (_,i) => {
  const filename = `U${String(i+1).padStart(2,'0')}.json`;
  const raw = fs.readFileSync(path.join(dir,'../blind',filename));
  return {filename, sha256:sha(raw), data:JSON.parse(raw)};
});
const weights = {fit:20, quality:20, progression:15, recovery:15, specificity:10, deloadTaper:10, coherence:10};
const sourceAccessDate = '2026-10-11';
const sources = [
  {id:'S1',title:'B.A.A. Boston Marathon Training, Level One',url:'https://www.baa.org/races/boston-marathon/info-for-athletes/boston-marathon-training/',accessDate:sourceAccessDate,type:'Zvanični originalni trenerski plan',finding:'Četiri dana nedeljno, okvirno 25–40 milja nedeljno i dužine 16–18 milja; postoje i duže simulacije sa MP radom. Primer da pet dana i 32 km nisu univerzalni minimumi.'},
  {id:'S2',title:'Hal Higdon, Novice 1 Marathon',url:'https://www.halhigdon.com/training-programs/marathon-training/novice-1-marathon/',accessDate:sourceAccessDate,type:'Zvanični originalni trenerski plan',finding:'18 nedelja, četiri trčanja, postupne dužine, svaka treća nedelja lakša i tri nedelje tapera. Završna dužina 20 milja; srednje-dugi rad takođe raste. Primer strukture, ne obavezna univerzalna preskripcija.'},
  {id:'S3',title:'Runna, Understanding the Long Runs in Your Runna Plan',url:'https://support.runna.com/en/articles/9357249-understanding-the-long-runs-in-your-runna-plan',accessDate:sourceAccessDate,type:'Zvanični originalni tekst Runna, prikazan datum 2026-08-31',finding:'Dužina zavisi od sposobnosti, trajanja ciklusa i distance; vreme na nogama, ponavljanje dužina i deload su važni. MP blokovi mogu vežbati ritam, a duga trčanja služe i probi ishrane.'},
  {id:'S4',title:'Fokkema i sar. (2020), Training for a (half-)marathon: Training volume and longest endurance run related to performance and running injuries',url:'https://onlinelibrary.wiley.com/doi/10.1111/sms.13725',accessDate:sourceAccessDate,type:'Originalna opservaciona studija, 556 HM i 441 M učesnika',finding:'U maratonu su <40 km nedeljno i najduža dužina <25 km povezani sa sporijim rezultatom; >65 km sa bržim. Nije utvrđena veza tih karakteristika sa novim povredama. Kategorije nisu individualni pragovi bezbednosti niti dokaz uzroka.'},
  {id:'S5',title:'Smyth i Lawlor (2021), Longer Disciplined Tapers Improve Marathon Performance for Recreational Runners',url:'https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2021.735220/full',accessDate:sourceAccessDate,type:'Originalna opservaciona analiza aktivnosti >158.000 rekreativnih maratonaca',finding:'Postepeni disciplinovani taper do tri nedelje bio je povezan sa boljim rezultatom. Ne dokazuje da svaki trkač mora imati isti procenat smanjenja ili isti broj dana.'}
];
const c = (week,day,expected,actual,rationale,severity='concern') => ({week,day,expected,actual,rationale,severity});
const rows = [
 ['U01','A',[8,6.5,8,9,6.5,8,8.5],'Dobra konzervativna početnička osnova; vremenski cilj nije potvrđen.',[],[
  c(4,7,'Odnos trčanja i hoda povećavati prema toleranciji; deload treba da smanji ukupni stres.','N3: 3/1; N4: 5/1, uz pad dužine 3.1 → 2.3 km.','Manja kilometraža pomaže, ali prelaz povećava udeo trčanja; pravilo nastavka hodanja po potrebi nije izričito navedeno.'),
  c(9,3,'Za cilj 30 min razvijati održivu specifičnu izdržljivost, uz mogućnost provere forme.','3×60 s @6:34/km; N10 2×400 m @6:34/km; najveća dužina 4.6 km.','Razuman mali stimulus za početnika; nije snažan ciklus za vremensko poboljšanje. Upozorenje to iskreno priznaje.'),
  c(12,7,'Jasno odvojiti željeni cilj od trenutnog ritma i izbeći univerzalnu potrebnu bazu.','Trka navodi želju 30:00 i referencu 35:00; upozorenje koristi ~30 km/ned kao okvir.','Komunikacija je uglavnom dobra, ali ~30 km nije uslov za završetak početničkih 5 km.')],0.85],
 ['U01','B',[7,6.5,6,8,7,8,4.5],'Upotrebljiva početnička osnova, sa prebrzim pojedinim koracima i previše sigurnim prognozama.',[],[
  c(9,7,'Posle deload-a vratiti prethodno tolerisanu dužinu pre većeg novog izlaganja.','N7 4.9 km; N8 3.4 km; N9 6.1 km; nedelja 9.1 → 13.3 km.','N9 je 24.5% iznad ranijeg maksimuma dužine; procenat nije pravilo povrede, već signal za proveru tolerancije.'),
  c(7,3,'Prvi kvalitet uvoditi kratkim kontrolisanim deonicama.','1.1 km kontinuiranog T rada @7:15/km posle šest baznih nedelja.','Moguće izvedivo, ali manje fleksibilno od kraćeg fartleka za osobu bez kontinuiteta.'),
  c(12,7,'Razdvojiti želju i referencu; budući napredak prikazati kao neizvesnost.','Cilj 30:00 / ritam 7:00/km (=35:00); prezentacija predviđa 33:24 i tvrdi da nijedan tempo napretka ne stiže cilj.','Previše precizna procena budućnosti i dvosmislen natpis trke, bez individualne validacije.')],0.85],
 ['U02','A',[8,7.5,7.5,8,7.5,8,5],'Solidan 5K ciklus za trenutnu formu; prognozu i ciljnu komunikaciju treba popraviti.',[],[
  c(1,3,'R rad povezati sa razvojem 5K izdržljivosti, uz postepenu raznovrsnost.','N1–3 svaki put 4×300 m @4:21/km, hod 3:16.','Razumna tehnika/brzina, ali tri vrlo slične nedelje daju malo ukupnog brzog rada; kasnije I/T rad popravlja specifičnost.'),
  c(13,3,'Kasno u ciklusu obezbediti dovoljno rada u održivom 5K ritmu.','3×1000 m @4:45/km; N14 5×600 m @4:32/km.','Primereno trenutnoj formi, ali bez kontrolnog rezultata nije dokaz sub-20 spremnosti.'),
  c(16,7,'Odvojiti cilj 19:59 od referentnih 23:45, bez determinističnog budućeg rezultata.','Cilj 19:59 / ritam 4:45/km; prognoza 22:09 i tvrdnja nijedan tempo ne dostiže cilj.','Neusklađen i nevalidiran nivo sigurnosti u rezultatu.')],0.85],
 ['U02','B',[8,7,8,8.5,6.5,8,9],'Dobro raspoređen i iskren ciklus; doza 5K kvaliteta je vrlo skromna.',[],[
  c(1,3,'Trkaču sa 12 nedelja kontinuiteta i nekim iskustvom dati razuman početni kvalitet.','N1 5×30 s i N2 3×45 s u T ritmu.','Oprezan uvod je održiv, ali nizak stimulus u odnosu na prijavljenu bazu i zahtev dva kvaliteta.'),
  c(13,3,'U završnoj specifičnoj fazi razviti ponovljivo 5K opterećenje.','2×1000 m @4:45/km uz hod 3:34; N14 4×600 m @4:32/km.','Dugački oporavci i svega 2 km RP rada ograničavaju kontinuitet specifičnog stimulusa.'),
  c(7,7,'Dužina treba da podrži 5K, bez suvišnog produžavanja u odnosu na kvalitet.','14.5 km ostaje maksimum u N7,9–11,13–14; N13 RP samo 2 km.','Baza se ponavlja dobro; raspodela budžeta naginje dužini više nego specifičnom radu.')],0.85],
 ['U03','A',[8,6.5,7,8.5,6.5,8,9],'Održiva baza za iskusnog 5K trkača; kvalitet i specifičnost slabiji od ambicije.',[],[
  c(5,2,'Za iskusnog trkača sa 50 km baze razviti dovoljno I rada bez jurenja željenog cilja.','2×1200 m @3:57/km, hod 3:33; isto u N7 i N11.','Samo 2.4 km rada sa dugim odmorom je skromno za profil; bez jasnog razloga nizak plafon se ponavlja.'),
  c(13,2,'Kasni 5K RP trening treba da približi održavanje tempa trke.','3×1000 m @4:07/km, hod 3:05.','Održiva doza, ali više oporavka nego što je potrebno za vežbu kontinuiranog 5K opterećenja.'),
  c(11,7,'Varirati trajanje baze i kvalitet kroz novi stimulus ili proveru forme.','N7 i N11: 56.5 km, ista dužina 16.6 km i iste ključne sesije.','Stabilnost nije mana sama po sebi; ovde niz ponavljanja nema ugrađenu proveru napretka.')],0.85],
 ['U03','B',[8.5,8,7.5,8,8,8,5.5],'Dobar rezultatno usmeren 5K sadržaj, sa slabom pouzdanošću prognoze.',[],[
  c(1,2,'R rad kombinovati sa postepenim I razvojem.','N1–2 8×300 m, N3 9×300 m, hod 2:51; petkom 3×1600 m T.','Za iskustvo izvedivo, ali tri uvodne R nedelje su ponavljajuće; I dolazi tek N5.'),
  c(11,2,'Pre novog ponavljanja specifičnog bloka proveriti toleranciju ili formu.','N7 i N11 potpuno isti 3×1200 m I i 3×1600 m T, 55.2 km.','Koristan ponovljiv stimulus, ali bez merne tačke ne potvrđuje novu formu.'),
  c(16,7,'Željeni 18:59 odvojiti od trenutnih 20:35; ne nuditi režim napretka kao garanciju.','Cilj 18:59 / ritam 4:07/km; predviđanje 19:23, uz tvrdnju agresivno bi dostigao cilj.','Neopravdano precizno tvrđenje i zavodljiva opcija intenzivnijeg napretka.')],0.85],
 ['U04','A',[6.5,6,7,7.5,7,8,5],'10K sadržaj postoji, ali uvod nije dobro prilagođen prvom ciklusu kvaliteta.',[],[
  c(1,3,'Za qualityExperience=none započeti kontrolisanim, kratkim radom.','4×300 m R @4:34/km, hod 3:26; već N2 petkom 2.8 km T.','Dva kvaliteta već u N2 i brz R uvod nisu najbolji izbor za neiskusnog u kvalitetu.'),
  c(1,7,'Dužinu početi blizu nedavno tolerisanih 8 km.','Prva dužina 9.7 km, N2 10.4 km.','Odmah 21% iznad prijavljenog LR; nije automatski opasno, ali uz novi kvalitet smanjuje prostor prilagođavanja.'),
  c(16,7,'Ne potvrđivati rezultat 50 min na osnovu hipotetičkog napretka.','Nema upozorenja; referenceTimeSec=2890, lastVdot 41.8; trka cilj 50:00 / ritam 5:11/km.','Ritam daje ~51:50, a prezentacija je optimističnija od potvrđene forme bez prikazane nove provere.')],0.85],
 ['U04','B',[8,6.5,8,8,6.5,8,9],'Dobar postepen prvi 10K ciklus, ali kvalitet se previše usitnjava.',[],[
  c(3,5,'Prvi drugi kvalitet dati kao smislen mali stimulus ili zadržati lako trčanje.','N3 T rad sredom 1.1 km, petkom 0.7 km; ukupno 1.8 km T.','Dve formalno kvalitetne sesije dodaju raspored i zagrevanja, a malo korisne doze.'),
  c(13,3,'Kasni RP rad treba da razvije održavanje 10K ritma.','2×1000 m @5:11/km, hod 3:53; N14 2×1200 m, odmor 4 min.','Predugi odmori i mala doza ograničavaju 10K specifičnost, iako su aerobna baza i iskrena poruka dobri.'),
  c(14,7,'Raspodeliti budžet tako da LR i specifičnost budu u ravnoteži.','Dužina 16.2 km (~105 min), dok RP ima samo 2.4 km rada.','Dužina nije sama po sebi prevelika; relativni izbor može biti manje koristan od umerenog RP povećanja.')],0.85],
 ['U05','A',[7.5,6.5,7.5,8.5,6.5,8,9],'Snažna aerobna baza i iskrena komunikacija, ali nedovoljno 10K kvalitetnog rada.',[],[
  c(1,5,'Za iskusnog trkača 45 km dati smislen prag ili jedan kvalitet uz bazu.','N1 2×700 m T utorkom i 1.2 km T petkom.','Dupliranje vrlo malih doza ima slab trenerski smisao za ovaj profil.'),
  c(13,2,'Kasni specifični RP trening treba da razvija kontinuitet rada.','3×1200 m @4:30/km, hod 4 min; N14 2×1600 m uz 4 min odmora.','Niska ukupna doza i dugi odmori slabi su za rezultatno usmerenog 10K trkača.'),
  c(10,1,'Obim povećavati s razlogom i ostaviti prostor za kvalitet i oporavak.','68.2 km vrhunac sa 14 km ponedeljkom, 12.2 km sredom i LR18.5; baza 45 km.','Rast je postepen, ali završni obim troši vreme dok specifični kvalitet ostaje ograničen.')],0.85],
 ['U05','B',[8,8,7.5,7.5,8,7.5,5.5],'Dobro razvijen 10K kvalitet; obim i prognoza zahtevaju više individualne kontrole.',[],[
  c(7,5,'Vezati rast kvaliteta za toleranciju i ne gomilati tri zahtevna izlaganja.','4×1200 m I utorkom, 3×2000 m T petkom, LR18.4 km nedeljom.','Za iskusan profil može biti primereno; I+T+~104 min LR ipak traže oporavak, ne samo broj session dana.'),
  c(15,5,'U taperu smanjiti ukupni kvalitet dovoljno da se umor povuče.','4 km T u petak, uz RP1.8 km u utorak i LR12 km.','Doza jeste manja, ali taper održava dosta praga; ostaviti prostor da se trening skrati prema umoru.'),
  c(16,7,'Prognozu 42:13 i agresivni režim prikazati kao scenario sa neizvesnošću.','Predviđanje 42:13; agresivno bi stigao cilj; trka cilj42:00 / ritam4:30/km.','Trkački ritam daje45:00 i budući napredak nije potvrđen novim rezultatom.')],0.85],
 ['U06','A',[5.5,6,5.5,7.5,6.5,8,4.5],'Postoji 10K izdržljivost, ali početak i korišćenje starog PB-a slabo odgovaraju povratniku.',[
  'N1 d7: 5.9 km nakon pauze od osam nedelja i prijavljene nedavne dužine 4 km; nema jasne individualne provere povratka.'
 ],[
  c(1,7,'Posle osam nedelja pauze polaznu dužinu vezati za 4 km i toleranciju, uz lak povratak.','5.9 km run/walk u N1, zatim6.5 i7.1 km; N1 d1=4.4 km, d3=3.8 km.','Run/walk smanjuje intenzitet, ali ne uklanja skok distance i vremena na nogama. Baza nije potvrđena.'),
  c(5,1,'Pre prelaska na neprekidno trčanje i ubrzanja proveriti aktuelnu formu.','Posle četiri run/walk nedelje6×20 s @4:55/km, laka trčanja @6:47/km.','Stari5K PB je iz2025; temposki oslonac bez nove potvrde je nesiguran.'),
  c(16,7,'Ne podrazumevati spremnost posle pauze ili precizan napredak.','Upozorenje tvrdi plan da distancu istrčiš; prognoza reference3103 s, bez upozorenja o starom PB-u.','Izdržljivost do11 km pomaže, ali tvrdnja i prognoza ne vode računa o nepoznatoj toleranciji povratka.')],0.82],
 ['U06','B',[7,6,7.5,8.5,4.5,8,8.5],'Dobar oprezan povratak, ali vrlo ograničena priprema za 10K trku.',[],[
  c(1,1,'Povratak treba da ima jasnu kontrolu intenziteta pre brzih ubrzanja.','Tri lake povratne nedelje; ipak svake6×20 s sa paceSec295 iz starog PB-a.','Naziv laganih koraka ublažava problem, ali precizna brzina može zavesti povratnika bez potvrđene forme.'),
  c(14,7,'Za10K razviti dovoljno kontinuiranog lakog rada i ponovljivog izlaganja približnog trci.','Najveća dužina6.7 km (~46.6 min), vrhunac18.2 km; trka10 km (~60 min).','Konzervativni koraci su dobri, ali završna distanca ostaje49% duža od najvećeg treninga. Upozorenje priznaje ograničenje, ne rešava ga.'),
  c(14,3,'RP rad za10K treba da ima dovoljno kontinuiteta.','2×1000 m @6:00/km uz4 min odmora.','Mali stimulus uz skromnu bazu; ovo je više povratak trčanju nego pun10K ciklus.')],0.82],
 ['U07','A',[8,6.5,8,8,7,7.5,9],'Dobra izdržljivost za prvi HM; kvalitet je skroman, a upozorenja su realistična.',[],[
  c(10,3,'HM RP rad postepeno približiti produženom održavanju ritma.','2×1700 m @5:11/km uz5:26 hodanja u N10–11; N13 7 km RP kontinuirano.','Završni kontinuirani trening je dobar, ali prethodni odmori su vrlo dugi za HM specifičnost.'),
  c(11,7,'Prvi HM treba da dobije ponovljiv duži stimulus bez gomilanja novog kvaliteta.','18.1 km LR uz RP3.4 km i T3.5 km; N13 LR19.5 km i RP7 km.','Moguće podneti, ali nedelje sa novom najvećom dužinom nisu lake samo zato što je LRZ2.'),
  c(14,5,'Rani taper treba da smanjuje ukupni stres.','N14 RP3.4 km +T2.8 km +LR15.6 km; N15 RP3.1 km +T2.5 km +LR12.6 km.','Obim pada, ali dva kvaliteta ostaju; dozu treba prilagoditi umoru od završnih dužina.')],0.85],
 ['U07','B',[7,7,6.5,7.5,6,7.5,5],'HM plan ima kvalitet, ali dužine i poruka o cilju su slabiji.',[],[
  c(1,5,'Sa ograničenom HM bazom kvalitet uvoditi bez istovremenog skoka dužine.','Od prve nedelje4×300 m R +3×1000 m T; LR11.6 km umesto nedavnih10 km.','Za some iskustvo možda izvedivo, ali kombinuje nov duži stimulus i dva kvaliteta.'),
  c(11,7,'Razviti ponovljive dužine koje obezbeđuju HM vreme na nogama.','N5–9 uglavnom14 km; vrhunac15.3 km uN11 (~94 min); N13=14.8 km.','Baza nije bezvredna, ali malo ponavljanja blizu ili preko90 min ograničava izdržljivost za željeni105-minHM.'),
  c(16,7,'Odvojiti1:45 želju od potvrđene1:49 reference i ne obećavati modelirani napredak.','Nema upozorenja; reference6107 s i lastVdot44.2; trka cilj1:45 /ritam5:11/km.','Ritam daje~1:49; nevalidirana optimistična prognoza prikriva ograničenja pripreme.')],0.85],
 ['U08','A',[8,8,7.5,7.5,8,7,6],'Snažan HM ciklus za iskustvo i bazu; taper i prognoza traže poboljšanje.',[],[
  c(6,5,'Vezati dva kvaliteta i dve dužine za oporavak iskusnog trkača.','16 min I rada uutorak, T6.7 km (~29 min) petak, MLR12.8 km iLR20.7 km.','Dobar stimulus, ali sreda posleI i naredni ponedeljak posleLR nisu potpuni oporavak; opciona snaga je neodređena.'),
  c(12,5,'U početku HM tapera sačuvati intenzitet uz pad ukupne doze.','RP6 km +T5 km uN12; N9–11 imali samo jedan kvalitet.','U taperu se vraća drugi kvalitet i ukupni brzi rad raste naspram prethodnih nedelja, uprkos padu obima.'),
  c(14,7,'Prognoza treba da ostane scenario sa neizvesnošću.','reference5383 s (~1:29:43), lastVdot51.2, bez upozorenja; cilj1:35 /ritam4:30/km.','Trkački ritam je razuman za unetiPB; precizna nova forma nema potvrdu u datim podacima.')],0.85],
 ['U08','B',[8,7,8,8,7.5,7.5,9],'Dobra ponovljena HM baza i realistična referenca; početni kvalitet je previše usitnjen.',[],[
  c(1,5,'Iskusnom55-km trkaču dati smislenu prag dozu ili jedan kvalitet.','Utorkom2×1000 m T, petkom2×700 m T, dok zagrevanje+hlađenje svake sesije6.5 km.','Dupliranje male doze troši dosta budžeta; niska doza je bez jasnog individualnog razloga.'),
  c(12,5,'Taper ne treba da vraća dodatni stres posle specifičnog bloka.','N9–11 jedan kvalitet; N12 RP5 km iT4.4 km, LR18.3 km.','Ukupni obim pada, ali broj i doza kvaliteta rastu naspramN11; umor treba proveriti.'),
  c(9,7,'U oporavak računati i specifičan završetak dužine, čak kada nema session oznaku.','N9 iN11:LR22 km sa poslednjih5.5 km @4:30/km, uzRP5 km uutorak.','Koristan HM specifičan stimulus; broj session dana sam ne prikazuje sav intenzitet. Kontrolni treningN10 jasno kaže da nije maksimalni test i nalaže naredna2–3 dana lagano.')],0.85],
 ['U09','A',[5.5,6,6.5,8,2.5,7.5,8.5],'Oprezan i iskren razvoj baze; nije puna maratonska priprema.',[
  'N1–19 d7: najveća dužina17.7 km (~105 min), nijedna preko2 sata, bez srednje-dugih ili drugih ponovljenih dugih izlaganja; trka42.195 km ostaje ozbiljno nepodržana.'
 ],[
  c(17,7,'Za maraton proceniti višenedeljnu izdržljivost, dužine i vreme na nogama, ne samo vrhunac kilometraže.','Najduža17.7 km; samoN13,14,17 d7 dosežu90 min; svih19 predtrkačkih dužina ispod2h.','Plan razvija bazu za duže trčanje, ali ne pruža dovoljno ponovljenog maratonskog stresora. Ovo nije presuda zasnovana na32-kmminimumu.'),
  c(14,3,'Specifičan M rad treba da bude dovoljna, postepeno razvijena doza uz adekvatnu bazu.','N6 2.2 km M; N14 2.4 km; N17 2.5 km; N18 2.4 km; N19 2.5 km, sve @5:41/km.','Samo~12–14 min po sesiji; malo vežbe ritma i zamora za4h trku, bez M blokova u dužini.'),
  c(20,7,'Ako spremnost nije podržana, race-day uputstvo treba da primarno odloži maratonski pokušaj ili ponudi konkretno prilagođavanje.','Isporučena42.195 km trka sa preporučenim5:41/km i dodatkom spremnost nije potvrđena.','Upozorenje je iskreno i vredno, ali sam raspored i preporučeni ritam i dalje ostaju izvršiva4h maratonska preporuka.')],0.90],
 ['U09','B',[4,6,4.5,7.5,2,7.5,3],'Nedovoljna maratonska priprema, uz obmanjujuću sigurnost da će distanca biti istrčana.',[
  'N1–19 d7: dužine ne prelaze16 km (~95 min), samo dve≥90 min, bez srednje-dugih izlaganja.',
  'Prezentacija eksplicitno naziva ovo planom da distancu ISTRČIŠ iako isporučene nedelje ne podržavaju tu sigurnost.'
 ],[
  c(11,7,'Razvijati višenedeljnu maratonsku izdržljivost sa dovoljno vremena na nogama.','N5–7 iN9–11 LR12.8 km; maksimum16 km uN14,17; nijedna dužina2h.','Duga stagnacijaLR i samo dva~95-minizlaganja nisu puna priprema za42.2 km.'),
  c(14,3,'Novi specifični kvalitet ne treba da potisne laganu bazu i oporavak.','N13 39.3 km →N14 43.3 km; d1 samo3 km, d3=12.7 km sa6 kmM, d5=11.6 kmT, LR16 km.','Obim se redistribuira na tri glavna stresora; malo stvarnog lakog prostora i naglo produženjeLR13.6→16 km.'),
  c(20,7,'Ograničenu izdržljivost navesti bez obećanja završetka i bez preciznog budućeg napretka.','Trka cilj4h/5:41; reference12021 s (~3:20), lastVdot47.1; upozorenje kaže plan da istrčiš.','Nema individualne validacije buduće forme; polumaratonskiPB ne potvrđuje maratonsku izdržljivost.')],0.90],
 ['U10','A',[7,7.5,5.5,6.5,6.5,7,4.5],'Značajan maratonski rad, ali slabo ponavljanje dugih izlaganja i neujednačena progresija.',[],[
  c(1,7,'Početi od dokazive ponovljive24-kmdužine i60-kmbaze ili objasniti privremeno smanjenje.','PrvaLR15.2 km; tekN14 prelazi24 km, srednje-dugoN1 samo9.1 km.','Bez pauze u početnom profilu ovako dugo spuštanjeLR gubi priliku za ponavljanje postojećeg maratonskog kapaciteta.'),
  c(14,7,'VrhLR razviti postepeno i ne vezivati ga za najtežu kvalitetnu nedelju.','N11 23.5 km; N12 15.6; N13 22.8; N14 28.2 km; isteN14 M8 km +T7.5 km.','Novi maksimum~20% iznad ranijeg vrha uz veliki kvalitet; sadašnji oporavak nije dovoljno individualno kontrolisan.'),
  c(17,7,'Za rezultat maratona trebaju ponovljena duga izlaganja, ne dva izdvojena vrha.','SamoN14 28.2 km iN17 26.8 km su≥25 km; svi ostaliLR≤23.5 km.','Nije potreban32-kmminimum, ali vrlo malo najdužih izlaganja u20 nedelja slabi specifičnu izdržljivost.'),
  c(20,7,'Odvojiti želju3:30 od potvrđenih3:45 i izbegavati preciznu nepotvrđenu prognozu.','Bez upozorenja; reference12381 s (~3:26), lastVdot45.5; cilj3:30 /ritam5:20/km (=3:45).','Nema dokaza da je nova forma ostvarena; trkački natpis i predviđanje su međusobno različiti.')],0.90],
 ['U10','B',[8.5,7,8,7.5,7,7.5,8.5],'Najpotpunija maratonska izdržljivost među ovim maratonskim planovima; M doza i oporavak još mogu bolje.',[],[
  c(13,2,'Za iskusan rezultatno usmeren maraton razvijati i trajanjeM rada, uz održivu bazu.','N7,11,13,17 M3.3 km (~17.6 min); N10,14,18 2×1600 m M.','Dosledna malaM doza, ali slabija proba održivog ritma podzamorenim nogama; jedini M završetak u LR je N15: poslednjih 9.2 km @5:20/km. To je vredna proba pod zamorom, ali koncentrisana u jednoj nedelji.'),
  c(13,7,'Ponovljene ~3h dužine treba pratiti individualni lakši oporavak i dosledna proba goriva.','N11,13,14,17 LR29.3 km @6:08 (~180 min); MLR17.6 km (~108 min); ponedeljak oko12 km, sledeći danM.','Postoje uputstva za gorivo i postepeno navikavanje creva. Obim je smislen za iskustvo, ali izostaje jasna individualna prilagodba narednog dana prema umoru.'),
  c(19,7,'Taper treba da dovoljno smanji ukupni zamor, uključujući trajanjeLR.','N18 64.1 km/LR21.8; N19 52 km/LR18.2 (~112 min); N20 predtrkački10.5 km.','Taper je postepen i postoji; pretposlednja dužina i dalje~1h52 uzM/T treninge, pa je individualno skraćenje razumno.'),
  c(20,7,'Uklopiti podržanu izdržljivost i vremenski cilj bez obećanja rezultata.','Supported endurance uz upozorenje3:30 brže od reference3:45; tempo5:20/km (~3:45).','Pošteno razdvojene brzina i izdržljivost; supported znači bolju pripremu, ne garantovan završetak niti3:30.')],0.90]
];

function paceFrom(day) {
  const m = (day.desc??'').match(/@ ~?(\d+):(\d+)\/km/);
  return m ? Number(m[1])*60+Number(m[2]) : null;
}
function longRunMinutes(day) {
  let seconds=(day.km??0)*(paceFrom(day)??0);
  const m=(day.desc??'').match(/poslednjih (\d+(?:\.\d+)?) km @ (\d+):(\d+)\/km/);
  if(m) seconds-=Number(m[1])*((paceFrom(day)??0)-(Number(m[2])*60+Number(m[3])));
  return seconds/60;
}
function dose(s) {
  if (!s) return 0;
  if (s.type==='prog') return Math.round((s.qKm/3)*10)/10;
  if (s.type==='fartlek') return s.reps*s.repSec/s.paceSec;
  if (Array.isArray(s.reps)) return s.reps.reduce((a,b)=>a+b,0)/1000;
  if (s.repM && Number.isFinite(s.reps)) return s.reps*s.repM/1000;
  return s.qKm??0;
}
const find = (id,side) => cases.find(c=>c.data.id===id).data.plans[side];
function metrics(id,side) {
 const ws=find(id,side).plan.weeks;
 const runs=ws.flatMap(w=>w.days.filter(d=>d.km>0&&d.tag!=='trka').map(d=>({...d,week:w.w})));
 const lr=runs.filter(d=>d.dow===7&&!d.mlr);
 const peak=Math.max(...ws.slice(0,-1).map(w=>w.vol));
 const sumMismatch=ws.filter(w=>Math.abs(w.days.reduce((s,d)=>s+(d.km??0),0)-w.vol)>0.15).map(w=>w.w);
 return {peakWeeklyKm:peak,peakLongRunKm:Math.max(...lr.map(d=>d.km)),longRunsAtLeast25Km:lr.filter(d=>d.km>=25).length,longRunsAtLeast90Min:lr.filter(d=>longRunMinutes(d)>=90).length,longRunsAtLeast120Min:lr.filter(d=>longRunMinutes(d)>=120).length,peakLongRunMinutes:Math.max(...lr.map(d=>longRunMinutes(d))),mlrPeakKm:Math.max(0,...runs.filter(d=>d.mlr).map(d=>d.km)),weeklySumMismatches:sumMismatch};
}
function readable(text) {
 const protectedTokens=[];
 text=text.replace(/https?:\/\/[^\s)]+|\b(?:U\d{2}[AB]?|N\d+|S\d+|[dD]\d+|5K|10K)\b/g,m=>{protectedTokens.push(m);return `⟦${protectedTokens.length-1}⟧`;});
 text=text.replace(/([A-Za-zČĆŠŽĐčćšžđ])(?=\d)/g,'$1 ').replace(/(\d)(?=[A-Za-zČĆŠŽĐčćšžđ])/g,'$1 ');
 text=text.replace(/kmtreninga/g,'km treninga').replace(/minizlaganja/g,'min izlaganja').replace(/podzamorenim/g,'pod zamorenim');
 return text.replace(/⟦(\d+)⟧/g,(_,i)=>protectedTokens[Number(i)]);
}
for(const r of rows){r[3]=readable(r[3]);r[4]=r[4].map(readable);for(const c of r[5])for(const k of ['expected','actual','rationale'])c[k]=readable(c[k]);}
const scores=rows.map(([id,side,values,verdict,criticalIssues,mainConcerns,confidence])=>{
 const criteria=Object.fromEntries(Object.keys(weights).map((k,i)=>[k,values[i]]));
 const total=Math.round(Object.entries(criteria).reduce((s,[k,v])=>s+v*weights[k]/10,0)*100)/100;
 return {id,side,distance:cases.find(c=>c.data.id===id).data.profile.input.raceDistM,criteria,total,verdict,criticalIssues,mainConcerns,confidence,reviewedWeekCount:find(id,side).plan.weeks.length,reviewedWeeks:find(id,side).plan.weeks.map(w=>w.w),metrics:metrics(id,side)};
});
if(scores.length!==20 || new Set(scores.map(s=>s.id+s.side)).size!==20) throw new Error('Incomplete scores');
const payload={reviewer:'PRIMARY AI marathon-specialist, independent blinded initial-plan review',frozenAt:'2026-10-11',status:'FROZEN_INITIAL_20_SCORES',scale:'Svaki kriterijum0–10; zbir Σ(ocena×težina/10), opseg0–100.',weights,scope:'Samo blind/U01..U10.json i javni primarni izvori. Pregled svih dana svake nedelje20 početnih planova. Event review nije urađen.',blindingLimit:'Identiteti generatora i tuđe ocene nisu viđeni. Oblik plana može omogućiti zaključivanje; ne tvrdi se savršeno blinding.',inputChecksums:cases.map(({filename,sha256})=>({filename,sha256})),sources,scores};
fs.writeFileSync(path.join(dir,'marathon-primary-scores.json'),JSON.stringify(payload,null,2)+'\n');

let md=`# Nezavisan primarni AI pregled: maratonski specijalista\n\nDatum zamrzavanja:2026-10-11. Pregledano je svih20 početnih planova, svaka nedelja i svaki dan, iz samo deset dozvoljenih blind datoteka. Ocene su zamrznute pre otkrivanja identiteta generatora i pre uvida u tuđe ocene. Event podaci profila nisu korišćeni kao događaji koji su već promenili početni plan. Zaseban event review nije deo ovog izveštaja.\n\nOvo je stručna AI procena strukture sintetičkih QA scenarija, ne pregled stvarnih sportista ili klinička validacija. Način generisanja može se naslutiti iz oblika rasporeda; savršeno slepilo se ne tvrdi.\n\n## Kriterijumi i metod\n\nOcene0–10: fit20%, kvalitet20%, progresija15%, oporavak15%, specifičnost10%, deload/taper10%, koherentnost10%. Ukupno=Σ(ocena×težina/10). Fit znači uklapanje u početnu bazu, iskustvo, broj dana i realnu distancu; kvalitet ocenjuje dozu i svrhu, ne samo broj oznaka. Koherentnost uključuje iskrenost upozorenja, usklađenost ritma/cilja i oprez sa prognozom. Niska doza nije automatski dobra; visoka doza nije automatski loša.\n\nZa maraton glavni kriterijum nije jedna najduža dužina: provereni su nedavno ponovljivi LR, ponavljanje dugih izlaganja, vreme na nogama, srednje-dugi rad, raspodela lakog obima, M rad i oporavak. Brojevi≥25 km,≥90 min i≥120 min u tabeli su opisni audit pragovi, ne univerzalni standardi prolaza. Ne postoji zahtev da svaki plan mora dosegnuti32 km. Upozorenje limited može biti pošteno, ali samo po sebi ne pretvara bazni raspored u potpun maratonski plan. Nedelje posle deload-a poređene su i sa prethodnim vrhom, ne samo sa smanjenom nedeljom. Ne primenjuje se mehaničko10% pravilo, niti se iz procenta predviđa povreda.\n\nVreme LR izračunato je iz prikazanog tempa i kilometraže, pa je procena trajanja, ne potvrđeno fiziološko opterećenje. Run/walk nema poznat tempo hodanja. Pregledani su stvarni dani, zagrevanja, odmori i rad; summary nije prihvaćen kao nezavisan dokaz. Zbirovi kilometara se slažu sa vol u granici zaokruživanja0.15 km. Duga trčanja računata su kao potencijalno zahtevna čak kada nemaju session oznaku; kratki M blok nije nužno jednako težak kao duga T sesija.\n\n## Izvori i njihova primena\n\n`;
for(const s of sources) md+=`- **${s.id}** [${s.title}](${s.url}), pristup${s.accessDate}. ${s.type}. ${s.finding}\n`;
md+=`\nS1–S3 su poređenja sa originalnim trenerskim strukturama, ne dokazi da su ti planovi jedina ispravna rešenja. S4 i S5 su originalna istraživanja, ali opservaciona: veze nisu individualne granice spremnosti ili dokaz da promena jedne stavke uzrokuje bolji rezultat. S4 ne podržava tvrdnju da je nagli rast najčešći uzrok povrede. Moji sudovi o pojedinačnim dozama, redosledu i nedeljama su trenerske inferencije iz dostavljenih podataka.\n\n## Zamrznute ocene svih20 planova\n\n| ID | Strana | Distanca | Fit | Kvalitet | Progresija | Oporavak | Specifičnost | Deload/taper | Koherentnost | /100 | Nedelje | Pouzdanost |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
for(const s of scores) md+=`|${s.id}|${s.side}|${s.distance===42195?'M':s.distance===21097.5?'HM':s.distance/1000+'K'}|${Object.values(s.criteria).join('|')}|${s.total}|${s.reviewedWeekCount}|${s.confidence}|\n`;
md+=`\n## Glavni maratonski nalazi\n\nU09A i U09B nemaju dovoljno ponovljenog vremena na nogama za punu maratonsku pripremu. A bolje raspoređuje bazu i jasno priznaje ograničenje, ali najduža17.7 km i svega tri izlaganja≥90 min ostaju fundamentalna slabost. B ima samo dve dužine≥90 min, nijednu preko16 km, a naziva plan načinom da se distanca istrči. To je lošija, nepodržana tvrdnja. Ni izbor četiri dana ni odsustvo32-kmtreninga nisu razlog ove presude: S1 i S2 pokazuju da četiri dana mogu funkcionisati uz potpuno drugačiju ponovljenu pripremu.\n\nU10B bolje koristi već potvrđenu24-kmdužinu, nudi devet dužina≥25 km, četiri ponavljanja29.3 km i srednje-dugo do17.6 km. U10A počinje na15.2 km, doN14 ne prelazi prijavljenih24 km i ima samo dva izlaganja≥25 km. Oba dosežuoko80 km/ned, ali isti vrhunac ne znači istu pripremu. B zato ima znatno bolju specifičnu bazu; A više kvalitetnog rada uvrh-nedeljama ne nadoknađuje slabo ponavljanje dugih izlaganja.\n\n| Plan | Vrh km/ned bez trke | Vrh LR km | Vrh LR min | LR≥25 km | LR≥90 min | LR≥120 min | Vrh MLR km | Presuda |\n|---|---:|---:|---:|---:|---:|---:|---:|---|\n`;
for(const s of scores.filter(s=>s.distance===42195)){const m=s.metrics;md+=`|${s.id}${s.side}|${m.peakWeeklyKm}|${m.peakLongRunKm}|${m.peakLongRunMinutes.toFixed(1)}|${m.longRunsAtLeast25Km}|${m.longRunsAtLeast90Min}|${m.longRunsAtLeast120Min}|${m.mlrPeakKm}|${s.verdict}|\n`;}
md+=`\nSva četiri maratonska plana izričito daju smernice za probu goriva u dužinama: 30–60 g/h u kraćim, a U10 i 60–90 g/h u dužim od dva sata, sa postepenim navikavanjem creva. To je pozitivan sadržaj. U09 dužine ipak ne omogućavaju probu kasnog zamora višesatnog maratona. U10A N15 ima poslednjih 7.7 km @5:20/km, a U10B N15 poslednjih 9.2 km @5:20/km: vredni M završeci u jednoj nedelji, bez drugog kvaliteta petkom.\n\nM rad:U09A najčešće2.4–2.5 km, U09B kasno3.4–6 km; oba su kratka u odnosu na trajanje trke i nijedan U09 nema M blokove u LR. U10A doseže8 km M uz7.5 km T uN14, što je korisna specifičnost, ali baš tada prvi put skače na28.2-kmLR. U10B ponavlja samo~3.3-kmM dozu u više ključnih nedelja: manje specifične vežbe ritma, ali održiviji kvalitet uz ponovljene dužine. Oba U10 imaju i po jedan M završetak u LR u N15, pa specifičnost nije ograničena samo na zasebne sesije. Veći M blokovi nisu obavezni za završetak, a povećavati ih uz postojeći obim treba selektivno, uz smanjenje drugog kvaliteta.\n\nTaper: sva četiri maratonska plana završavaju sa dve označene taper nedelje i trećom race nedeljom. Trku treba izuzeti iz provere smanjenja treninga: predtrkačkaN20 kilometraža je10.5 km, a52.7 km uključuje samu trku. U10A ima80.2-kmvrh, N17=71.2, N18=64.2 iN19=52.1; U10B80.1,79.8,64.1 i52. Oba imaju prepoznatljiv pad, aliN19 dužine17.1/18.2 km uzM/T ostaju dosta rada. To nije tvrdnja da je svaki takav taper pogrešan; S5 favorizuje disciplinovano smanjenje, a stvarni umor nije poznat.\n\n## Pojedinačne presude i precizne zamerke\n\n`;
for(const s of scores){
 md+=`### ${s.id} ${s.side} — ${s.total}/100\n\n${s.verdict} Pregledano${s.reviewedWeekCount} nedelja; pouzdanost${s.confidence}.\n\n`;
 if(s.criticalIssues.length)md+=`**Kritično:** ${s.criticalIssues.join(' ')}\n\n`;
 md+=`| Nedelja/dan | Očekivano | Isporučeno | Trenerska procena |\n|---|---|---|---|\n`;
 for(const c of s.mainConcerns)md+=`|N${c.week}/d${c.day}|${c.expected}|${c.actual}|${c.rationale}|\n`;
 md+='\n';
}
md+=`## Audit svake pregledane nedelje\n\nD1=ponedeljak, D7=nedelja. Sve kolone su izvedene iz stvarnih days, ne iz summary. Dane bez kilometara prikazujem po oznaci; snaga je opciona i nema definisanu dozu. Kvalitet navodi kilometre/minute rada, tempo u sekundama/km, odmor u sekundama i zagrevanje/hlađenje. Kod progresivnog trčanja kvalitet je poslednja trećina; cela qKm nije sav brzi rad. U okviru svake tabele svi dani svih nedelja su provereni; 0 označava odmor/bez kilometara.\n\n`;
for(const s of scores){
 md+=`### ${s.id} ${s.side}: nedelje1–${s.reviewedWeekCount}\n\n|N|Ukupno km|D1|D2|D3|D4|D5|D6|D7|Deload/taper|Kvalitet i svrha|\n|---|---:|---|---|---|---|---|---|---|---|---|\n`;
 for(const w of find(s.id,s.side).plan.weeks){
  const ds=Array.from({length:7},(_,i)=>w.days.find(d=>d.dow===i+1));
  const label=d=>!d?'nedostaje':`${d.tag??'odmor'} ${d.km??0}${d.mlr?' MLR':''}${d.strides?` +${d.strides.reps}×${d.strides.runSec}s`:''}${d.runWalk?` (${d.runWalk.runSec}/${d.runWalk.walkSec}s)`:''}`;
  const qs=w.days.filter(d=>d.session).map(d=>{
   const q=d.session,km=dose(q);
   const work=q.type==='fartlek'?`${q.reps}×${q.repSec}s`:`${km.toFixed(1)} km`;
   return `d${d.dow} ${q.kind}/${q.zone??'?'} ${work} @${q.paceSec}s/km, odmor${q.restSec??0}s, WU/CD${q.wuKm??0}/${q.cdKm??0}km`;
  });
  if(w.days.some(d=>d.tag==='trka'))qs.push('Trka: njen obim nije taper trening');
  const extra=w.days.flatMap(d=>{
    const chunks=(d.desc??'').split(' · ').slice(1).filter(t=>/gorivo|poslednjih|maksimalan|Naredna/.test(t));
    return chunks.map(t=>`d${d.dow}: ${t}`);
  });
  qs.push(...extra);
  md+=`|${w.w}|${w.vol}|${ds.map(label).join('|')}|${w.deload?'deload':w.taper?'taper':'—'}|${qs.join('; ')||'Aerobna baza / oporavak'}|\n`;
 }
 md+='\n';
}
md+=`## Ograničenja i integritet\n\nNisu dostupni povrede, RPE, spavanje, radni stres, teren, vremenski uslovi, realna brzina hodanja, pol, uzrast, prethodni višemesečni obim niti završenost treninga. Zato ocena nije individualni medicinski savet i ne računa verovatnoću povrede ili završetka. Procenti obima, pragovi LR i poređenja sa javnim planovima služe pregledu strukture. Kao maratonski specijalista detaljnije sam ocenio42.2 km; za5K/10K/HM pouzdanost je niža i ocene prvenstveno proveravaju dozu, raspored, bazu, specifičnost i istinitost poruke.\n\nNisam čitao raw, manifest, kod generatora, probe, korisničke ili druge trenerske izveštaje. Identiteti A/B ostali su neotkriveni. Nijedna implementacija nije promenjena. Ovaj audit skript čita samo dozvoljenih deset JSON ulaza i piše samo sopstvene dve primarne datoteke. Ukupno je pregledano${scores.reduce((n,s)=>n+s.reviewedWeekCount,0)} plan-nedelja. Ocene izJSON su autoritativna zamrznuta verzija; naredni event review mora biti odvojen.\n`;
md=readable(md);
fs.writeFileSync(path.join(dir,'marathon-primary-review.md'),md);
for(const name of ['marathon-primary-scores.json','marathon-primary-review.md','marathon-primary-audit.mjs'])console.log(name,sha(fs.readFileSync(path.join(dir,name))));
console.log(scores.map(s=>`${s.id}${s.side}=${s.total}`).join(' '));
