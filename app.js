'use strict';

/* ============ UVODNI EKRAN ============
   Sama animacija je u index.html (CSS), i to namerno — kreće čim se HTML
   isparsira, dakle pre nego što se ovaj fajl preuzme i izvrši. Ovde je samo
   odluka i uklanjanje.

   PRIKAZUJE SE SAMO PRI HLADNOM STARTU. `sessionStorage` traje koliko i kartica
   (odnosno koliko instalirana aplikacija stoji otvorena), pa osvežavanje strane,
   povratak iz pozadine i prelazak preko `location.reload()` posle „Osveži"
   NE pale uvod ponovo. Pri stvarnom pokretanju je prazan i uvod se vidi.

   Stoji na VRHU fajla da bi se odluka donela u prvom trenutku izvršavanja —
   na toplom startu se ekran skloni pre nego što iko stigne da ga primeti. */
(function uvodniEkran(){
  const el=typeof document!=='undefined'&&document.getElementById&&document.getElementById('uvod');
  if(!el) return;
  const skloni=()=>{ el.remove(); if(document.body) document.body.classList.remove('uvod-radi'); };

  let vecVidjen=false;
  try{
    vecVidjen=sessionStorage.getItem('sub20-uvod')==='1';
    sessionStorage.setItem('sub20-uvod','1');
  }catch(e){ /* privatni režim ume da zabrani sessionStorage — tad se uvod vidi svaki put, što je bezopasno */ }

  const mirno=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(vecVidjen||mirno){ skloni(); return; }

  if(document.body) document.body.classList.add('uvod-radi');
  /* Uklanjanje ide POSLE kraja CSS animacije (1,15 s odlaganje + 0,3 s gašenje),
     ne pre — inače bi se ekran isekao usred prelaza. */
  const tajmer=setTimeout(skloni,1550);
  el.addEventListener('pointerdown',()=>{
    clearTimeout(tajmer);
    el.classList.add('gasi');
    setTimeout(skloni,240);
  },{once:true});
})();

/* ============ KONSTANTE PLANA — izvor: Plan_SUB-19_5K_v5.xlsx (doslovno) ============ */
const START='2026-06-22', RACE='2026-09-24', SCHEMA=10, LS_KEY='sub19-v1';
const APP_VERSION='241'; /* mora se poklapati sa APP_VERSION u sw.js — v. test/sw-azuriranje.test.mjs */
/* ANALYZE_SECRET je UKLONJEN. Bio je deljena tajna vidljiva svakome ko otvori
   dev tools — dakle nikakva zastita, samo prag. Zamenjuje ga Supabase JWT
   korisnika: /api/analyze sada proverava token kod Supabase-a i zna KO zove,
   pa se kvota moze meriti po korisniku. */
const STRAVA_CLIENT_ID='259960';
const CILJ='19:20–19:30', CILJ_TEMPO='3:52–3:54 /km';
/* Opis cilja AKTIVNOG plana — koristi se i u AI promptu i u Progres UI-ju.
   BEZ ovoga su oba mesta imala TVOJ cilj (5K ~19:30) tvrdo ukucan, čak i dok
   je generisan plan (npr. maraton za druga) aktivan — AI bi sudio tuđ
   maratonski tempo kroz prizmu tvog 5K cilja. Za tvoj plan vraća IDENTIČAN
   tekst kao pre (nulta izmena za tebe), za generisan plan gradi iz meta. */
function goalCtxText(){
  if(!S.genPlan) return '5K oko 19:30 (cilj koji i na lošiji dan iznosi sub-20)';
  const m=(S.genPlan.meta)||{};
  const name=m.raceName||'trka';
  /* Cilj i procena NISU ista stvar i ne smeju se opisati istom recenicom —
     AI koji dobije "procenjeno vreme ~42:00" kad je 42:00 zapravo korisnikov
     AMBICIOZAN cilj (a procena je 43:21) sudi treninge prema pogresnom merilu. */
  if(m.goalSec!=null&&isFinite(m.goalSec)){
    const dodatak = (m.realno===false&&m.predictedSec!=null)
      ? ` (ambiciozan — procena iz forme je ~${fmtClock(m.predictedSec)})` : '';
    return `${name} — ciljno vreme ${fmtClock(m.goalSec)}${dodatak}`;
  }
  return m.predictedSec!=null ? `${name} — procenjeno vreme ~${fmtClock(m.predictedSec)} (na osnovu unetog PB-a)` : name;
}

const PLAN=[
{w:1,start:'2026-06-22',focus:'TEMPO nedelja',days:[
 {id:'n1d1',dow:0,tag:'lako',km:7,desc:`7 km lako (Z2)  +  SNAGA — Plavi blok (Re-entry):
• Single Leg Deadlift: 3×8 (1 KB 8 kg)
• Glute Bridge: 3×12
• Side Plank Hip Abduction: 3×8 po strani
• Standing Heel Raise: 3×12 (bez deficita)
• Clamshell: 3×15 po strani`},
 {id:'n1d2',dow:1,rest:true},
 {id:'n1d3',dow:2,tag:'tempo',km:8,desc:`Tempo — 2 km WU + 4 km @ 4:22/km + 2 km CD`},
 {id:'n1d4',dow:3,tag:'snaga',km:null,desc:`Mobilnost  +  SNAGA — Crveni blok (Re-entry, izometrija):
• Wall Sit: 3×40 s
• Spanish Squat: 3×30 s
• Single Leg Glute Bridge: 3×10 po nozi
• Controlled Step Up: 3×8 po nozi
• TIB Raises: 3×20 s`},
 {id:'n1d5',dow:4,tag:'lako',km:7,desc:`7 km lako + 4×20 s strides`},
 {id:'n1d6',dow:5,rest:true},
 {id:'n1d7',dow:6,tag:'lr',km:8,desc:`8 km LR (Z2)  ·  23% nedelje`}
]},
{w:2,start:'2026-06-29',focus:'Int + Tempo',days:[
 {id:'n2d1',dow:0,tag:'lako',km:8,desc:`8 km lako  +  SNAGA — Plavi blok (iste vežbe kao N1)`},
 {id:'n2d2',dow:1,rest:true},
 {id:'n2d3',dow:2,tag:'int',km:9,desc:`Intervali — 1.5 km WU + 6×800 m @ 3:58/km (2 min hod) + 2.7 km CD`},
 {id:'n2d4',dow:3,tag:'snaga',km:null,desc:`Mobilnost  +  SNAGA — Crveni blok (iste vežbe kao N1)`},
 {id:'n2d5',dow:4,tag:'tempo',km:7,desc:`Tempo (broken) — 2 km WU + 2×2 km @ ~4:20/km (90 s float) + 1 km CD  ·  plafon HR 170 (vrh Z4), tempo ustupa HR  ← lagano ako koleno reaguje (čet snaga je dan ranije)`},
 {id:'n2d6',dow:5,rest:true},
 {id:'n2d7',dow:6,tag:'lr',km:9,desc:`9 km LR  ·  24% nedelje`}
]},
{w:3,start:'2026-07-06',focus:'Int + Tempo',days:[
 {id:'n3d1',dow:0,tag:'lako',km:8,desc:`8 km lako  +  SNAGA — Plavi blok (uvod lagane pliometrije AKO je koleno tiho: dodaj Pogo Jumps 3×20 s; SL Deadlift → 3×10 sa 16 kg)`},
 {id:'n3d2',dow:1,rest:true},
 {id:'n3d3',dow:2,tag:'int',km:10,desc:`Intervali — 2.5 km WU + 5×1000 m @ 3:56/km (2 min hod) + 2.5 km CD`},
 {id:'n3d4',dow:3,tag:'snaga',km:null,desc:`Mobilnost  +  SNAGA — Crveni blok (dodaj Box Jump 3×5 na nisku kutiju, SIĐI korakom; Explosive Step Up 3×6 TT. BEZ Lateral Step Down i Drop Jump)`},
 {id:'n3d5',dow:4,tag:'tempo',km:9,desc:`Tempo (broken) — 2 km WU + 2×2.5 km @ ~4:18/km (90 s float) + 2 km CD  ·  plafon HR 170  ← lagano ako koleno reaguje`},
 {id:'n3d6',dow:5,rest:true},
 {id:'n3d7',dow:6,tag:'lr',km:9,desc:`9 km LR  ·  25% nedelje`}
]},
{w:4,start:'2026-07-13',focus:'Int + Tempo',days:[
 {id:'n4d1',dow:0,tag:'lako',km:9,desc:`9 km lako  +  SNAGA — Plavi blok (kao N3)`},
 {id:'n4d2',dow:1,rest:true},
 {id:'n4d3',dow:2,tag:'int',km:10,desc:`Intervali — 1.5 km WU + 5×1000 m @ 4:00/km (2 min hod) + 3.5 km CD`},
 {id:'n4d4',dow:3,tag:'snaga',km:null,desc:`Mobilnost  +  SNAGA — Crveni blok (kao N3)`},
 {id:'n4d5',dow:4,tag:'tempo',km:10,desc:`Tempo (broken) — 2 km WU + 3×2 km @ ~4:28/km (75 s float) + 2 km CD  ·  plafon HR 170  ← lagano ako koleno reaguje`},
 {id:'n4d6',dow:5,rest:true},
 {id:'n4d7',dow:6,tag:'lr',km:10,desc:`10 km LR  ·  23% nedelje`}
]},
{w:5,start:'2026-07-20',focus:'Int + Tempo',days:[
 {id:'n5d1',dow:0,tag:'lako',km:10,desc:`10 km lako  +  SNAGA — Plavi blok (AKO potpuno bez bola, uvedi Lateral Step Down 3×8 TT)`},
 {id:'n5d2',dow:1,rest:true},
 {id:'n5d3',dow:2,tag:'int',km:10,desc:`Intervali — 2.5 km WU + 5×1000 m @ 3:58/km (2 min hod) + 2.5 km CD`},
 {id:'n5d4',dow:3,tag:'snaga',km:null,desc:`Mobilnost  +  SNAGA — Crveni blok (RFE Split Squat 3×8 TT; Side Plank Hip Abduction 3×10)`},
 {id:'n5d5',dow:4,tag:'tempo',km:11,desc:`Tempo (broken, duže reps) — 2.5 km WU + 2×3 km @ ~4:25/km (90 s float) + 2.5 km CD  ·  plafon HR 170  ← lagano ako koleno reaguje`},
 {id:'n5d6',dow:5,rest:true},
 {id:'n5d7',dow:6,tag:'lr',km:11,desc:`11 km LR  ·  24% nedelje`}
]},
{w:6,start:'2026-07-27',focus:'Int + Tempo',days:[
 {id:'n6d1',dow:0,tag:'lako',km:11,desc:`11 km lako  +  SNAGA — Plavi blok (kao N5)`},
 {id:'n6d2',dow:1,rest:true},
 {id:'n6d3',dow:2,tag:'int',km:11,desc:`Intervali — 1.5 km WU + 5×1000 m @ 3:55/km (2.5 min hod) + 4.5 km CD`},
 {id:'n6d4',dow:3,tag:'snaga',km:null,desc:`Mobilnost  +  SNAGA — Crveni blok (kao N5)`},
 {id:'n6d5',dow:4,tag:'tempo',km:10,desc:`Tempo (broken, duži blok) — 2 km WU + 4 km + 2 km @ ~4:25/km (75 s float) + 2 km CD  ·  plafon HR 170  ← lagano ako koleno reaguje`},
 {id:'n6d6',dow:5,rest:true},
 {id:'n6d7',dow:6,tag:'lr',km:12,desc:`12 km LR  ·  25% nedelje`},
 {id:'n6t',test:true,tag:'test',km:null,desc:`Test na 3 km, istrčan kao trka — rekalibriše tempo Faze 3 (kraj N6, opciono)`}
]},
{w:7,start:'2026-08-03',focus:'DELOAD (intenzitetski) — bez kvaliteta i pliometrije, cilj je oporavak',days:[
 {id:'n7d1',dow:0,tag:'lako',km:8,desc:`8 km lako  +  lagana snaga (2 serije, bez pliometrije)`},
 {id:'n7d2',dow:1,rest:true},
 {id:'n7d3',dow:2,tag:'lako',km:7,desc:`7 km lako + 6×15 s strides`},
 {id:'n7d4',dow:3,rest:true,desc:`Odmor (dodatni pun dan)`},
 {id:'n7d5',dow:4,tag:'lako',km:8,desc:`8 km lako + 5×100 m opušteno brzo (ubrzanja, ne intervali)`},
 {id:'n7d6',dow:5,rest:true},
 {id:'n7d7',dow:6,tag:'lr',km:9,desc:`9 km LR (Z2)  ·  25%`}
]},
{w:8,start:'2026-08-10',focus:'Int + Tempo',days:[
 {id:'n8d1',dow:0,tag:'lako',km:10,desc:`10 km lako  +  SNAGA — Plavi blok (Faza 3, pun intenzitet):
• Diagonal Pogo Jumps: 3×45 s
• Box Jump: 3×6
• Lateral Step Down: 3×10 (1 KB 8 kg)
• Single Leg Deadlift: 3×10 (16 kg)
• Single Leg Deficit Heel Raise: 3×10 (8 kg)`},
 {id:'n8d2',dow:1,rest:true},
 {id:'n8d3',dow:2,tag:'int',km:10,desc:`Intervali — 1.5 km WU + 6×1000 m @ 3:55/km (2 min hod) + 2.5 km CD`},
 {id:'n8d4',dow:3,tag:'snaga',km:null,desc:`Mobilnost  +  SNAGA — Crveni blok (Faza 3):
• Drop Jump: 3×6 (uvodi se TEK sada, samo ako je koleno čisto)
• Explosive Step Up: 3×6
• RFE Split Squat (Goblet): 3×8 (8 kg)
• Side Plank Hip Abduction: 3×12 po strani
• Seated Deficit Heel Raise: 3×12 (16 kg)`},
 {id:'n8d5',dow:4,tag:'tempo',km:10,desc:`Tempo — 2 km WU + 6 km NEPREKIDNO @ ~4:25/km + 2 km CD  ·  prvi vezani 6 km  ← 4 km lako ako je sreda bila teška`},
 {id:'n8d6',dow:5,rest:true},
 {id:'n8d7',dow:6,tag:'lr',km:12,desc:`12 km LR  ·  24% nedelje`}
]},
{w:9,start:'2026-08-17',focus:'Int + Tempo',days:[
 {id:'n9d1',dow:0,tag:'lako',km:11,desc:`11 km lako  +  SNAGA — Plavi blok (Faza 3, kao N8)`},
 {id:'n9d2',dow:1,rest:true},
 {id:'n9d3',dow:2,tag:'int',km:10,desc:`Intervali — 1.5 km WU + 6×1000 m @ 3:52/km (2 min hod) + 2.5 km CD`},
 {id:'n9d4',dow:3,tag:'snaga',km:null,desc:`Mobilnost  +  SNAGA — Crveni blok (Faza 3, kao N8)`},
 {id:'n9d5',dow:4,tag:'tempo',km:11,desc:`Tempo — 2 km WU + 6 km @ 4:22/km + 3 km CD`},
 {id:'n9d6',dow:5,rest:true},
 {id:'n9d7',dow:6,tag:'lr',km:14,desc:`14 km LR  ·  24% nedelje`}
]},
{w:10,start:'2026-08-24',focus:'Jak blok 1 · Int + Tempo',days:[
 {id:'n10d1',dow:0,tag:'lako',km:11,desc:`11 km lako  +  SNAGA — Plavi blok (kao N8)`},
 {id:'n10d2',dow:1,tag:'lako',km:4,desc:`4 km lako (Z2) — dodatni aerobni obim (progresija N10: 46 → 50 km)`},
 {id:'n10d3',dow:2,tag:'int',km:10,desc:`Intervali — 1.5 km WU + 6×1000 m @ 3:50/km (2.5 min hod) + 2.5 km CD  ·  kapija: kad ovo držiš, prelazimo na duže repove`},
 {id:'n10d4',dow:3,tag:'snaga',km:null,desc:`Mobilnost  +  SNAGA — Crveni blok (kao N8)`},
 {id:'n10d5',dow:4,tag:'tempo',km:10,desc:`🔥 TIME TRIAL — 3 km WU + 3 km TT (kontrolisan maks. napor, cilj ~3:53–3:55/km) + 4 km CD  ·  kontrola forme i finalna kalibracija`},
 {id:'n10d6',dow:5,rest:true},
 {id:'n10d7',dow:6,tag:'lr',km:15,desc:`15 km LR  ·  24% nedelje`}
]},
{w:11,start:'2026-08-31',focus:'Jak blok 2 · Int + Tempo',days:[
 {id:'n11d1',dow:0,tag:'lako',km:11,desc:`11 km lako  +  SNAGA — Plavi blok (držimo opterećenje visokim)`},
 {id:'n11d2',dow:1,tag:'lako',km:8,desc:`8 km lako (Z2) — dodatni aerobni obim (progresija N11: 46 → 54 km, vrhunac pred taper)`},
 {id:'n11d3',dow:2,tag:'int',km:11,desc:`Intervali — 1.5 km WU + 4×1500 m @ 3:50/km (2.5 min hod) + 3.5 km CD`},
 {id:'n11d4',dow:3,tag:'snaga',km:null,desc:`Mobilnost  +  SNAGA — Crveni blok (držimo opterećenje visokim)`},
 {id:'n11d5',dow:4,tag:'tempo',km:10,desc:`Tempo — 2 km WU + 6 km @ 4:18/km + 2 km CD`},
 {id:'n11d6',dow:5,rest:true},
 {id:'n11d7',dow:6,tag:'lr',km:14,desc:`14 km LR  ·  24% nedelje`},
 {id:'n11t',test:true,tag:'test',km:null,desc:`Test na 3 km — poslednja provera forme pred taper (kraj N11, opciono)`}
]},
{w:12,start:'2026-09-07',focus:'Specifični ritam',days:[
 {id:'n12d1',dow:0,tag:'lako',km:10,desc:`10 km lako  +  SNAGA — Plavi blok (poslednji težak trening snage)`},
 {id:'n12d2',dow:1,rest:true},
 {id:'n12d3',dow:2,tag:'int',km:10,desc:`Intervali — 1.5 km WU + 3×2000 m @ 3:50/km (2.5 min hod) + 2.5 km CD`},
 {id:'n12d4',dow:3,tag:'snaga',km:null,desc:`Mobilnost  +  SNAGA — Crveni blok (poslednja teška pliometrija)`},
 {id:'n12d5',dow:4,tag:'tempo',km:9,desc:`Trkački ritam — 2 km WU + 4 km neprekidno @ 3:54–3:58/km (ciljni) + 3 km CD  ·  proba ciljnog ritma 19:30`},
 {id:'n12d6',dow:5,rest:true},
 {id:'n12d7',dow:6,tag:'lr',km:13,desc:`13 km LR  ·  24% nedelje`}
]},
{w:13,start:'2026-09-14',focus:'Taper — serije na 2, eksplozivno i daleko od otkaza',days:[
 {id:'n13d1',dow:0,tag:'lako',km:10,desc:`10 km lako  +  SNAGA TAPER (Plavi): Diagonal Pogo 2×30 s, Box Jump 2×4, SL Deadlift 2×6 (8 kg) — bez doskoka pod opterećenjem`},
 {id:'n13d2',dow:1,rest:true},
 {id:'n13d3',dow:2,tag:'int',km:5,desc:`1.5 km WU + 5×400 m @ 3:50/km (90 s hod) + 1.5 km CD`},
 {id:'n13d4',dow:3,tag:'snaga',km:null,desc:`Odmor  +  SNAGA TAPER (Crveni): Drop Jump 2×4, Explosive Step Up 2×4, RFE Split Squat 2×6 TT`},
 {id:'n13d5',dow:4,tag:'tempo',km:8,desc:`2 km WU + 3 km tempo @ 4:15/km + 3 km CD`},
 {id:'n13d6',dow:5,rest:true},
 {id:'n13d7',dow:6,tag:'lr',km:7,desc:`7 km LR lagano  ·  23% nedelje`}
]},
{w:14,start:'2026-09-21',focus:'TRKAČKA NEDELJA — bez opterećenja za noge u teretani',days:[
 {id:'n14d1',dow:0,tag:'lako',km:3,desc:`3 km shakeout (skroz lagano) + samo lagani core (bez nogu)`},
 {id:'n14d2',dow:1,tag:'int',km:3.7,desc:`1.5 km WU + 6×200 m @ 3:48/km (200 m hod) + 1 km CD (aktivacija)`},
 {id:'n14d3',dow:2,tag:'lako',km:2,desc:`2 km shakeout + lagana mobilnost celog tela`},
 {id:'n14d4',dow:3,tag:'trka',km:5,desc:`🏁 TRKA 5 km — Cilj: 19:20–19:30 / Ritam: 3:52–3:54/km`}
]}
];

/* Race Predictor — redovi doslovno iz sheeta (plan5k u sekundama, kako su sačuvani) */
const PRED=[
 {id:'p1', w:1, l:'N1 · Tempo',     q:4,   pt:262, p5k:1232},
 {id:'p2', w:2, l:'N2 · Intervali', q:4.8, pt:238, p5k:1242},
 {id:'p2b',w:2, l:'N2 · Tempo',     q:4,   pt:260, p5k:1222},
 {id:'p3', w:3, l:'N3 · Tempo',     q:5,   pt:258, p5k:1212},
 {id:'p3b',w:3, l:'N3 · Intervali', q:5,   pt:236, p5k:1231},
 {id:'p4', w:4, l:'N4 · Intervali', q:5,   pt:240, p5k:1253},
 {id:'p4b',w:4, l:'N4 · Tempo',     q:6,   pt:268, p5k:1262},
 {id:'p5', w:5, l:'N5 · Tempo',     q:6,   pt:265, p5k:1247},
 {id:'p5b',w:5, l:'N5 · Intervali', q:5,   pt:238, p5k:1242},
 {id:'p6', w:6, l:'N6 · Intervali', q:5,   pt:235, p5k:1226},
 {id:'p7', w:6, l:'N6 · Tempo',     q:6,   pt:265, p5k:1247},
 {id:'p8', w:8, l:'N8 · Intervali', q:6,   pt:235, p5k:1226},
 {id:'p9', w:8, l:'N8 · Tempo',     q:6,   pt:265, p5k:1247},
 {id:'p10',w:9, l:'N9 · Intervali', q:6,   pt:232, p5k:1209},
 {id:'p11',w:9, l:'N9 · Tempo',     q:6,   pt:262, p5k:1232},
 {id:'p12',w:10,l:'N10 · Intervali',q:6,   pt:230, p5k:1198},
 {id:'p13',w:10,l:'N10 · Test',    q:3,   pt:233, p5k:1201.26},
 {id:'p14',w:11,l:'N11 · Intervali',q:6,   pt:230, p5k:1198},
 {id:'p15',w:11,l:'N11 · Tempo',    q:6,   pt:258, p5k:1212},
 {id:'p16',w:11,l:'N11 · Test',    q:5,   pt:234, p5k:1170},
 {id:'p17',w:12,l:'N12 · Intervali',q:6,   pt:230, p5k:1198},
 {id:'p18',w:12,l:'N12 · Ritam',    q:4,   pt:236, p5k:1195.905},
 {id:'p19',w:13,l:'N13 · Intervali',q:2,   pt:230, p5k:1198},
 {id:'p20',w:13,l:'N13 · Tempo',    q:3,   pt:255, p5k:1198},
 {id:'p21',w:14,l:'N14 · Intervali',q:1.2, pt:228, p5k:1187}
];

/* Weight Tracker — ciljna linija iz sheeta */
const WT_TARGET=[
 {w:1,date:'2026-06-22',kg:82},{w:2,date:'2026-06-29',kg:81.5},{w:3,date:'2026-07-06',kg:81},
 {w:4,date:'2026-07-13',kg:80.5},{w:5,date:'2026-07-20',kg:80},{w:6,date:'2026-07-27',kg:79.5},
 {w:7,date:'2026-08-03',kg:79},{w:8,date:'2026-08-10',kg:78.5},{w:9,date:'2026-08-17',kg:78},
 {w:10,date:'2026-08-24',kg:77.5},{w:11,date:'2026-08-31',kg:77},{w:12,date:'2026-09-07',kg:76.5},
 {w:13,date:'2026-09-14',kg:76},{w:14,date:'2026-09-21',kg:75.5}
];

/* ============ POČETNO STANJE ============
   PRAZNO ZA SVAKOGA. Ranije je ova funkcija svakom novom korisniku upisivala
   VLASNIKOVU istoriju: odradjene treninge, zapise o kolenu sa licnim beleskama
   i merenja telesne mase. Tudji covek je to video na mapi tela i na
   grafikonu tezine (tada tab Povrede, danas Oporavak), a pozadinska sinhronizacija je sve to upisivala i u
   NJEGOV Supabase red.

   Drugi, tisi efekat istog uzroka: `imaUnosaNaLicnom()` je zbog tih unosa
   UVEK vracao true, pa `moraSvojPlan()` nikad nije mogao da bude true —
   carobnjak se nije nametao nikome, i svaki nov korisnik je sletao na
   vlasnikov plan sa tudjim datumom trke i tudjim tempima.

   Sada je pocetno stanje prazno, pa nov korisnik ide PRAVO u carobnjaka.
   Vlasnikovi podaci se ne ubacuju iz koda uopste — stizu sa servera pri
   prijavi ili iz backup fajla (v. STARI_SEED_POTPIS ispod, koji nosi samo
   identifikatore da bi se zatecen seed prepoznao i obrisao). */
function seedState(){return {
 v:SCHEMA,
 log:{},
 knee:[],
 kg:[],
 pred:{},
 predLock:{},
 vdotLog:[],
 /* Testovi na 3 km — v. blok „TEST NA 3 KM". Zive odvojeno od S.pred jer nisu
    vezani ni za jedan dan plana: test se moze istrcati kad god. */
 t3k:[],
 /* Kesirana prognoza (v. karticaVremena). Nije korisnikov podatak nego kopija
    tudjeg servisa — ali stoji u stanju da bi radila i offline, i da bi jedan
    poziv posluzio svim danima nedelje. */
 vreme:null,
 moves:{},
 alts:{},
 genPlan:null,
 strava:null,
 /* Oporavak (intervals.icu) i sama veza. Bili su dodati bez upisa u semu, pa
    su postojali samo ako ih je icuSync/icuFinish usput napravio — a svako
    citanje je moralo da ih rucno cuva (`S.wellness||{}`). To je isti obrazac
    koji je vec jednom oborio unos tempa preko predLock-a; zato su sad ovde. */
 wellness:{},
 icu:null,
 /* Zajednica. `vidljiv:false` je JEDINO ispravno pocetno stanje — plan i
    istorija su do sada bili iskljucivo licni, pa niko ne sme da se nadje na
    javnom spisku zato sto je azurirao aplikaciju. */
 zajed:{vidljiv:false,nadimak:''},
 ui:{firstRun:null,lastBackup:null,snooze:null,seenWeek:null,geo:null,satTreninga:null,novo:null}
};}

/* POTPIS ZATECENOG SEEDA — SAMO IDENTIFIKATORI, bez ijednog licnog podatka.
   Sluzi jednoj stvari: da se na tudjem uredjaju prepozna NEDIRNUT seed iz
   starih verzija i obrise, pa taj covek ode u carobnjaka umesto da gleda
   vlasnikov plan.
   Sami podaci — beleske o kolenu i merenja telesne mase — UKLONJENI su iz
   koda. Ranije su stajali ovde u citljivom obliku, pa ih je mogao procitati
   svako ko otvori izvor stranice. Vlasnikovi stvarni podaci zive u Supabase-u
   i u backup fajlovima; na nov uredjaj stizu prijavom, ne iz koda. */
const STARI_SEED_POTPIS = {
  log:  ['n1d1','n1d3','n1d4','n1d5','n1d7','n2d1','n2d3'],
  knee: ['k1','k2','k3','k4','k5','k6','k7','k8','k9','k10'],
  kg:   ['2026-06-22','2026-06-29'],
  pred: ['p1','p2']
};

/* ============ POMOĆNE (čiste funkcije) ============ */
const pad2=n=>String(n).padStart(2,'0');
/* s2d očekuje 'YYYY-MM-DD'. Sve drugo je do sada bacalo TypeError na
   `s.split` — a to nije bila sitnica: poziv je duboko u iscrtavanju grafikona,
   pa je JEDNO loše polje gasilo CEO tab. Nađeno dodirom na tačku grafikona
   tempa kad `S.log[id].ts` nije string nego broj; aplikacija ga uvek upisuje
   kao string, ali uvezen ili ručno menjan backup ga može doneti drugačijeg
   (zato `cistVdotLog` već ima istu proveru za svoj `ts`).
   Sada se vraća nevažeći Datum, a formati ispod ga prikazuju kao „—" —
   isti dogovor koji `fmtClock` već primenjuje na nevažeće vreme. */
function s2d(s){
  if(typeof s!=='string')return new Date(NaN);
  const[a,b,c]=s.split('-').map(Number);
  if(!isFinite(a)||!isFinite(b)||!isFinite(c))return new Date(NaN);
  return new Date(a,b-1,c);
}
function validDatum(d){return d instanceof Date&&!isNaN(d.getTime());}
function d2s(d){return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());}
function addD(s,n){const d=s2d(s);d.setDate(d.getDate()+n);return d2s(d);}
function diffD(a,b){return Math.round((s2d(b)-s2d(a))/86400000);}
function todayStr(){return d2s(new Date());}
const DOW=['Pon','Uto','Sre','Čet','Pet','Sub','Ned'];
function dowOf(s){const d=s2d(s);if(!validDatum(d))return'—';return DOW[(d.getDay()+6)%7];} /* naziv dana IZ DATUMA — ispravno i posle zamene dana (d.dow ostaje izvorna pozicija, ne prati swap) */
const DOWL=['ponedeljak','utorak','sreda','četvrtak','petak','subota','nedelja'];
const MES=['januara','februara','marta','aprila','maja','juna','jula','avgusta','septembra','oktobra','novembra','decembra'];
function fmtD(s){const d=s2d(s);if(!validDatum(d))return'—';return pad2(d.getDate())+'.'+pad2(d.getMonth()+1)+'.';}
function fmtDL(s){const d=s2d(s);if(!validDatum(d))return'—';const wd=(d.getDay()+6)%7;return DOWL[wd].charAt(0).toUpperCase()+DOWL[wd].slice(1)+', '+d.getDate()+'. '+MES[d.getMonth()];}
/* Skidanje zavrsnih nula sme SAMO iza decimalne tacke.
   Ranije se `/\.?0+$/` primenjivalo na ceo string, pa je sa dec=0 jelo ZNACAJNE
   cifre: fmtNum(0,0)→"", fmtNum(10,0)→"1", fmtNum(100,0)→"1". Vidljivo je
   postalo na kartici vremena („vetar 1 km/h" umesto 10, „padavine  %" umesto
   0 %), ali je isto vazilo i za puls u miru na HRV grafikonu (50→"5"). */
function fmtNum(n,dec=1){const v=(Math.round(n*10**dec)/10**dec).toFixed(dec);return (v.includes('.')?v.replace(/\.?0+$/,''):v).replace('.',',');}
function fmtKm(n){return fmtNum(n,1);}
/* Negativna i nebrojevna vrednost daju „—", ne „-1:-1:-5" i „NaN:NaN".
   fmtTempo je to vec hvatao, ali fmtClock se poziva i direktno na ~18 mesta
   (ciljna vremena, ose grafikona, polje za unos vremena), pa je zastita
   morala ovde — u jednoj tacki, umesto 18 provera na pozivaocima. */
function fmtClock(sec){
  if(sec==null||!isFinite(sec)||sec<0)return'—';
  sec=Math.round(sec);
  const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;
  return h?h+':'+pad2(m)+':'+pad2(s):m+':'+pad2(s);
}
function fmtTempo(sec){if(sec==null||!isFinite(sec))return'—';return fmtClock(sec);}
function parseTimeStr(str){
  if(!str)return null;
  const s=String(str).trim().replace(/[,.]/g,':');
  if(/^\d{3,6}$/.test(s)){ /* samo cifre: 433=4:33, 4233=42:33, 10203=1:02:03 */
    const se=+s.slice(-2);if(se>59)return null;
    const rest=s.slice(0,-2);
    if(rest.length<=2)return(+rest)*60+se;
    const mi=+rest.slice(-2);if(mi>59)return null;
    return(+rest.slice(0,-2))*3600+mi*60+se;
  }
  const m=s.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if(!m)return null;
  let h=0,mi,se;
  if(m[3]!=null){h=+m[1];mi=+m[2];se=+m[3];}else{mi=+m[1];se=+m[2];}
  if(se>59||mi>(m[3]!=null?59:99))return null;
  return h*3600+mi*60+se;
}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
/* Usko markdown->HTML SAMO za ono što AI analiza stvarno vraća: **bold** i
   pasusi (prazan red = novi pasus). esc() se primenjuje PRE parsiranja
   markdown sintakse, tako da bilo šta u tekstu (uključujući < > &) ostaje
   bezbedno kao tekst, ne kao HTML — **bold** markeri se ubacuju POSLE
   escape-a, pa jedino oni postaju stvarni <strong> tag. */
function mdToHtml(text){
  if(!text)return '';
  const escaped=esc(text);
  const bolded=escaped.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  return bolded.split(/\n\n+/).map(p=>`<p>${p.replace(/\n/g,'<br>')}</p>`).join('');
}
/* Riegel: T2 = T1 × (5 / Q)^1.06 */
function riegel(tempoSec,q){return tempoSec*q*Math.pow(5/q,1.06);}

/* ===== Daniels-Gilbert VDOT (za rekalibraciju forme) =====
   VDOT se računa iz Riegel-ekvivalent-5K-vremena kvalitetne sesije,
   konzistentno sa predikcijom. Plan NE prati čist VDOT→zona mapiranje
   (plan gradi od trenutne forme ~20:40 ka cilju 19:30 ≈ VDOT 51.1; ne ka trenutnom
   PB ≈ VDOT 48), zato zonske tempove ne izvodimo iz VDOT-a. */
function vo2(tMin){ return 0.8+0.1894393*Math.exp(-0.012778*tMin)+0.2989558*Math.exp(-0.1932605*tMin); }
/* vdotFromRace JE OVDE NAMERNO IZOSTAVLJEN.
   Postojale su DVE identicne definicije — jedna ovde, druga u engine bloku
   (uz vo2AtV/pctVo2max). Kasnija je tiho gazila raniju; posledice nije bilo
   samo zato sto su formule slucajno bile iste. To je ista zamka koja je u
   ovom fajlu vec dvaput uhvacena i preimenovanjem resena: riegel -> riegelDist
   i workLapsTempo -> genWorkLapsTempo, oba uz komentar da bi tiho gazenje
   „DEGRADIRALO tacnost bez ijedne greske koja bi to signalizirala". Treci
   slucaj je ostao; prva izmena jedne od dve kopije napravila bi bag koji se
   nigde ne prijavljuje. Sada postoji tacno jedna definicija (v. engine blok),
   a `vdotFrom5k` ispod je poziva. */
function vdotFrom5k(sec){ return vdotFromRace(5000,sec); }
/* VDOT iz kvalitetne sesije: ostvaren tempo + dužina Q-segmenta -> Riegel 5K -> VDOT */
function vdotFromQuality(paceSec,qKm){ return vdotFrom5k(riegel(paceSec,qKm)); }

/* ============ AKTIVNI PLAN (hardkodovan ILI generisan) ============
   CUR_PLAN/CUR_PRED su ono što SAV ostali kod čita — nikad direktno PLAN/PRED.
   Default (S.genPlan===null) = CUR_PLAN=PLAN, CUR_PRED=PRED: ponašanje IDENTIČNO
   kao pre ove izmene, ni jedan bajt drugačije za postojeće korisnike. */
let CUR_PLAN=null, CUR_PRED=null;
/* generatePlan() izlaz nema d.id ni week.start — dodeljujemo ih JEDNOM ovde,
   istom konvencijom kao hardkodovan PLAN (n{nedelja}d{dan}, dow 0-6→d1-d7),
   da SVI ID-vezani sistemi (S.alts, S.moves, S.log, S.vdotLog, predRowsFor)
   rade identično nad generisanim planom. */
function adaptGeneratedPlan(gen){
  if(!gen||gen.error||!Array.isArray(gen.weeks))return null;
  const startMon=gen.meta&&gen.meta.start;
  if(!startMon)return null;
  const weeks=gen.weeks.map((w,wi)=>({
    w:w.w!=null?w.w:wi+1,
    start:addD(startMon,wi*7),
    focus:w.deload?'DELOAD':'',
    days:w.days.map((d,di)=>{
      const dow0=d.dow-1; /* NORMALIZACIJA: engine.js dow je 1-7 (Pon=1), V2 očekuje 0-6 (Pon=0) */
      return {...d,dow:dow0,id:'g'+(w.w!=null?w.w:wi+1)+'d'+(dow0+1)};
    })
  }));
  const pred=gen.pred.map((r,i)=>({...r,id:'g'+r.w+'_'+i}));
  /* qs (Strava lap-detekcija po distanci) je do sada OVDE NESTAJAO: generator
     ga uredno racuna, ali se nije prenosio, pa `S.genPlan.qs` nije ni postojao.
     Uz to su mu kljucevi u 'n' prostoru ('n3d5'), a generisani dani imaju 'g'
     ID-jeve ('g3d5') — pa bi i da je prenet, svaka pretraga promasila.
     Numericki deo je isti u oba prostora (adapt cuva d.dow), pa je preslikavanje
     cista zamena prefiksa. */
  const qs={};
  Object.entries(gen.qs||{}).forEach(([k,v])=>{ qs[k.replace(/^n/,'g')]=v; });
  return {weeks,pred,qs,meta:gen.meta};
}
/* Datumi AKTIVNOG plana. START/RACE konstante su tvrdo kodovane za hardkodovan
   plan (22.06/24.09.2026) — za generisan plan su potpuno pogrešne (merenjem:
   pokazivalo "50 dana do trke" kad je prava trka za 305 dana). Sve što je
   ranije čitalo START/RACE direktno sad čita ove. */
let CUR_START=START, CUR_RACE=RACE;
function setActivePlan(){
  if(S.genPlan){
    /* klon, NE direktna referenca — rebuildDateIndex mutira d.week (kružno!) i
       _orig/origX polja na objektima; S.genPlan mora ostati čist za save(). */
    const clone=JSON.parse(JSON.stringify({weeks:S.genPlan.weeks,pred:S.genPlan.pred}));
    CUR_PLAN=clone.weeks;
    CUR_PRED=clone.pred;
    const m=S.genPlan.meta||{};
    CUR_START=CUR_PLAN.length?CUR_PLAN[0].start:START;
    CUR_RACE=m.raceDate||(CUR_PLAN.length?addD(CUR_PLAN[CUR_PLAN.length-1].start,6):RACE);
  } else {
    CUR_PLAN=PLAN;
    CUR_PRED=PRED;
    CUR_START=START;
    CUR_RACE=RACE;
  }
}
/* ============ IZVEDENE STRUKTURE PLANA ============ */
const BY_ID={},BY_DATE={},DATED=[];
/* Gradi/prepravlja BY_DATE i DATED prema TRENUTNOM S.moves (zamena dana).
   d.origDate = nepromenljiva izvorna pozicija iz plana (postavlja se JEDNOM).
   d.date = efektivni datum (original, osim ako je dan pomeren preko S.moves).
   POZIV: (a) jednom odmah posle učitavanja S (S mora postojati — vidi ispod),
   (b) posle svakog swapDays(), (c) posle undoWeekMoves(). Zbog toga što ovo
   MUTIRA d.date na istom objektu, sav ostali kod (sync, kartice, kalendar)
   automatski vidi efektivni raspored bez ijedne dodatne izmene. */
function rebuildDateIndex(){
  for(const k in BY_DATE) delete BY_DATE[k];
  DATED.length=0;
  CUR_PLAN.forEach(w=>{w.days.forEach(d=>{
    d.week=w;
    BY_ID[d.id]=d;
    /* originali iz plana — snimaju se JEDNOM i nikad se ne menjaju.
       Sentinel _orig, jer d.tag za dan odmora legitimno JESTE undefined. */
    if(!d._orig){d._orig=1;d.origTag=d.tag;d.origKm=d.km;d.origDesc=d.desc;d.origRest=!!d.rest;d.origRunWalk=d.runWalk;}
    /* izmena tipa treninga (S.alts). 'odmor' je poseban: plan ga nosi kao
       rest:true bez oznake, pa ga tako i vraćamo. */
    const ov=S.alts&&S.alts[d.id];
    if(ov){
      d.rest=ov.tag==='odmor';
      d.tag=d.rest?undefined:ov.tag;
      d.km=d.rest?null:(ov.km!=null?ov.km:null);
      d.desc=ov.desc;
      /* run/walk iz izmene gazi onaj iz plana; bez izmene se plan poštuje */
      if(ov.rw) d.runWalk=ov.rw; else if(d.origRunWalk!==undefined) d.runWalk=d.origRunWalk;
    } else {
      d.tag=d.origTag;d.rest=d.origRest;d.km=d.origKm;d.desc=d.origDesc;d.runWalk=d.origRunWalk;
    }
    if(!d.test){
      if(!d.origDate) d.origDate=addD(w.start,d.dow);
      /* Datum iz S.moves se VALIDIRA pre primene — swapDays uvek piše ispravan
         format, ali importBackup prihvata proizvoljan JSON (pokvaren/ručno
         izmenjen backup), pa bi neispravan string inače propao pravo u d.date
         i pokvario sortiranje/prikaz svuda nizvodno. */
      const mv=S.moves&&S.moves[d.id];
      d.date=(typeof mv==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(mv))?mv:d.origDate;
      /* SUDAR DATUMA. Format se validira gore, ali ne i JEDINSTVENOST — a
         swapDays uvek pise ispravne parove dok importBackup prihvata proizvoljan
         S.moves. Dva dana na istom datumu su ranije znacila da jedan tiho NESTANE
         iz BY_DATE (poslednji upis pobedjuje): ne pojavi se na Danas, ne dobije
         Strava sinhronizaciju i ne udje u trend analizu, bez ijedne poruke.
         Sada pomereni dan ustupa mesto i vraca se na svoju izvornu poziciju —
         gore je izgubiti pomeranje nego ceo dan. */
      if(BY_DATE[d.date] && BY_DATE[d.date]!==d){
        if(d.origDate && !BY_DATE[d.origDate]){ d.date=d.origDate; }
        else { d.date=d.origDate||d.date; }
      }
      if(!BY_DATE[d.date]) DATED.push(d);
      BY_DATE[d.date]=d;
    }
  });});
  DATED.sort((a,b)=>a.date<b.date?-1:1);
  /* MORA posle primene S.alts — dan pretvoren u odmor menja ukupan broj treninga */
  TOTAL_TR=CUR_PLAN.reduce((n,w)=>n+w.days.filter(d=>!d.rest).length,0);
}
/* Zamena dva dana unutar ISTE nedelje. Odbija: nepostojeći/test dan, različite
   nedelje, ili ako je BILO KOJI od dva dana već odrađen (istorija se ne diraj).
   Ako se dan vrati na svoju izvornu poziciju, brišemo ga iz S.moves (drži mapu
   čistom — dvostruki swap A↔B pa opet A↔B ostavlja S.moves prazan). */
function swapDays(idA,idB){
  const a=BY_ID[idA], b=BY_ID[idB];
  if(!a||!b||a.test||b.test) return {ok:false,err:'nepostojeći dan'};
  if(idA===idB) return {ok:false,err:'isti dan'}; /* UI ovo već sprečava (drugi dodir istog dana = poništi izbor), ali broj pozivalaca raste (autoRealign) — jeftino osiguranje protiv besmislenog S.moves unosa */
  if(a.week!==b.week) return {ok:false,err:'van iste nedelje'};
  const done=id=>S.log[id]&&S.log[id].status==='done';
  if(done(idA)||done(idB)) return {ok:false,err:'odrađen dan se ne pomera'};
  const dA=a.date, dB=b.date;
  S.moves=S.moves||{};
  if(dB===a.origDate) delete S.moves[idA]; else S.moves[idA]=dB;
  if(dA===b.origDate) delete S.moves[idB]; else S.moves[idB]=dA;
  rebuildDateIndex(); save();
  return {ok:true};
}
/* Izmena tipa treninga za jedan dan (S.alts). Isti obrazac kao S.moves:
   ako je izmena identična planu, unos se briše — mapa ostaje čista, a "vrati
   na plan" je prirodan. Odrađeni dani se ne menjaju (istorija se ne prepisuje). */
function altDescTemplate(tag,km){
  const k=km!=null&&km!==''?fmtKm(km)+' km ':'';
  return {lako:k+'lako (Z2)', lr:k+'LR (Z2)', int:'Intervali — unesi strukturu',
          tempo:'Tempo — unesi strukturu', snaga:'Snaga / mobilnost', odmor:'Odmor'}[tag]||'';
}
function setAlt(id,alt){
  const d=BY_ID[id];
  if(!d||d.test)return {ok:false,err:'nepostojeći dan'};
  if(S.log[id]&&S.log[id].status==='done')return {ok:false,err:'odrađen trening se ne menja'};
  if(!alt||!alt.tag)return {ok:false,err:'tip nije izabran'};
  S.alts=S.alts||{};
  const planTag=d.origRest?'odmor':d.origTag;
  if(alt.tag!=='odmor'&&alt.km!=null&&alt.km!==''&&!isNaN(alt.km)&&+alt.km<0)return {ok:false,err:'kilometraža ne može biti negativna'};
  const km=alt.tag==='odmor'?null:(alt.km!=null&&alt.km!==''&&!isNaN(alt.km)?+alt.km:null);
  const desc=alt.tag==='odmor'?'Odmor':(alt.desc||'');
  const pace=(alt.tag==='int'||alt.tag==='tempo')&&alt.pace!=null&&!isNaN(alt.pace)&&alt.pace>0?Math.round(alt.pace):null;
  /* run/walk struktura (predlog posle povrede). Nosi se KAO PODATAK, ne samo
     kao tekst u opisu — inace bi se ritam video samo u recenici, a red „Ritam"
     na kartici treninga i korak koji ide na sat ostali bi prazni.

     NENAVEDENO POLJE SE CUVA, NE BRISE. Ekran „Zameni" salje samo tag/km/opis/
     tempo i ne zna za run/walk — bez ovoga bi rucna izmena kilometraze tiho
     obrisala ritam, a opis bi i dalje pisao „Run/walk 3 min trcanje / 1 min
     hod". Kartica bi tvrdila jedno, podatak drugo. (Izmereno.)
     Na dan odmora ritam nema smisla i brise se. */
  const stariAlt=(S.alts&&S.alts[id])||null;
  const rw = alt.tag==='odmor' ? null
           : (alt.rw===undefined ? ((stariAlt&&stariAlt.rw)||null) : cistRunWalk(alt.rw));
  /* identično planu I bez ručnog cilja tempa → briši unos umesto da ga čuvaš.
     Ako je pace eksplicitno postavljen, unos ostaje čak i kad se tag/km/desc
     slažu sa planom — to je i dalje namerna izmena (samo cilja tempo, ne strukturu). */
  if(alt.tag===planTag && km===(d.origKm!=null?d.origKm:null) && desc===(d.origDesc||(d.origRest?'Odmor':'')) && pace==null && rw==null){
    delete S.alts[id];
  } else {
    S.alts[id]={tag:alt.tag,km:km,desc:desc,pace:pace,rw:rw,paceAuto:pace!=null&&!!alt.paceAuto};
  }
  rebuildDateIndex();save();
  return {ok:true};
}
function clearAlt(id){
  if(!S.alts||S.alts[id]==null)return false;
  delete S.alts[id];rebuildDateIndex();save();return true;
}
/* Vraća SVE dane jedne nedelje na izvorni raspored iz plana (briše njihove
   S.moves unose). Pojedinačni undo jednog dana bi ostavio nekonzistentan par,
   zato je undo uvek na nivou cele nedelje. */
function undoWeekMoves(w){
  if(!S.moves)return false;
  let changed=false;
  w.days.forEach(d=>{ if(!d.test && S.moves[d.id]!=null){ delete S.moves[d.id]; changed=true; } });
  if(changed){ rebuildDateIndex(); save(); }
  return changed;
}
let TOTAL_TR=PLAN.reduce((n,w)=>n+w.days.filter(d=>!d.rest).length,0); /* dinamički; 72 posle dodatih laganih dana u N10/N11 */
function weekPlanKm(w){return w.days.reduce((s,d)=>s+(d.km||0),0);}
function weekOf(dateStr){for(const w of CUR_PLAN){const end=addD(w.start,6);if(dateStr>=w.start&&dateStr<=end)return w;}return null;}
/* Poznati tipovi treninga. Sve van ovog skupa je NEPOVERLJIVO — moze doci iz
   uvezenog backup fajla (S.alts[id].tag, genPlan session.kind). */
const TAGS={lako:'Lako',rw:'Trčanje/hod',tempo:'Tempo',int:'Intervali',lr:'Dugo (LR)',snaga:'Snaga',odmor:'Odmor',trka:'TRKA',test:'Test'};
/* Ranije: `[t]||t` — vracalo je SIROV ulaz za nepoznat tag, pa je zlonameran
   backup mogao da ubaci HTML kroz ime tipa treninga. Sad neutralan tekst. */
function tagName(t){return TAGS[t]||'Trening';}
/* Ime CSS klase sme biti samo iz poznatog skupa — inace bi se atribut
   class="tag ${t}" mogao razbiti navodnikom iz uvezenog fajla. */
function safeTag(t){return TAGS[t]?t:'';}
/* Specifičan tip sesije kad postoji (Fartlek/Repeticije/Maratonski tempo/...
   — samo generisani planovi imaju d.session.kind), inače generička oznaka
   po tagu (tvoj hardkodovan plan nema .session, pa ovde ništa ne menja). */
/* Kratak opis SAMOG RADNOG dela — za listu u Plan tabu (jedan red, bez WU/CD
   šuma). Preko session objekta kad postoji (generisani planovi), inače parsira
   d.desc (tvoj hardkodovan plan). */
function sessCore(d){
  if(!d||d.rest)return (d&&d.desc)||'Odmor';
  const s=d.session;
  if(s){
    if(s.type==='int'&&s.reps&&s.repM)     return `${s.reps}×${s.repM} m @ ${fmtTempo(s.paceSec)}/km`;
    if(s.type==='pyramid'&&Array.isArray(s.reps)) return `${s.reps.join('-')} m @ ${fmtTempo(s.paceSec)}/km`;
    if(s.type==='tempo'&&s.qKm)            return `${fmtKm(s.qKm)} km @ ${fmtTempo(s.paceSec)}/km`;
    if(s.type==='fartlek'&&s.reps)         return `${s.reps}× ${s.repSec} s @ ${fmtTempo(s.paceSec)}/km`;
  }
  const desc=d.desc||'';
  const afterWU=desc.split(/km\s*(?:WU|zagrevanje)\s*\+\s*/i)[1];
  if(afterWU){
    /* „smirivanje" je zadržano uz „hlađenje" NAMERNO. Reč je preimenovana, ali
       opisi koji su već sačuvani — generisani planovi u localStorage-u i na
       serveru — i dalje nose staru. Da je ovde samo novi oblik, radni deo tih
       planova ne bi bio prepoznat, pa bi kartica treninga ostala bez strukture
       i bez ciljnog tempa. Lični plan koristi „CD" i njega ovo ne dira.
       Ispisuje se isključivo „hlađenje"; ovde se samo ČITA. */
    const core=afterWU.split(/\s*\(|\s*\+\s*[\d.,]+\s*km\s*(?:CD|hlađenje|smirivanje)/i)[0].trim();
    if(core)return core;
  }
  /* nije kvalitetna sesija (lako/LR/snaga) — očisti zagrade, ostavi suštinu */
  return desc.replace(/\s*\([^)]*\)/g,'').replace(/\s+/g,' ').trim()||desc;
}
/* Strukturirani redovi sesije za Danas karticu: [[labela, vrednost, istaknuto?]].
   Vraća null ako se ne može pouzdano razložiti — pozivalac tada prikaže sirov opis. */
/* ============ RUN/WALK (trčanje sa planiranim pauzama za hod) ============
   Izvor: Galloway run-walk-run metoda (razvijana od sredine 1970-ih, podaci
   sa preko 200.000 trkača kroz njegove programe) + novija istraživanja o
   run-walk kod početnika.

   Zašto radi: pauza za hod se ubacuje OD PRVOG MINUTA, pre nego što umor
   nastupi — ne kad "više ne možeš". Time se kumulativno udarno opterećenje
   na kolena, kukove i skočne zglobove prekida PRE nego što se nagomila.
   Istraživanja kod starijih početnika dosledno pokazuju niže stope povreda
   i veću istrajnost u programu nego kod neprekidnog trčanja.

   VAŽNO NAČELO iz istraživanja, ugrađeno u prikaz: na sledeći odnos prelaziš
   tek kad trenutni deluje LAKO — ne po fiksnom kalendaru. Zato je ovo
   preporuka po nedelji, uz jasnu poruku da smeš da ostaneš na istom. */
/* Tekst za prikaz: "1 min trčanje / 1 min hod" */
function runWalkText(rw){
  if(!rw) return '';
  const f = s => s>=60 ? (s/60===Math.floor(s/60) ? (s/60)+' min' : (s/60).toFixed(1)+' min') : s+' s';
  return f(rw.runSec) + ' trčanje / ' + f(rw.walkSec) + ' hod';
}

/* CILJNI NAPOR (RPE) PO TIPU TRENINGA.
   Tempo je precizan cilj, ali na +30°C, uzbrdo ili umoran — 4:25/km može biti
   nemoguć taj dan. RPE kaže šta zapravo treba da OSETIŠ, i tad je pouzdaniji
   vodič od brojke na satu. Rasponi su standardna trenerska skala 1–10.
   Aplikacija RPE već skuplja POSLE treninga; ovo je druga strana — cilj PRE. */
const RPE_TARGET = {
  lako:  { min:3, max:4,  txt:'Razgovorno — možeš da pričaš u punim rečenicama' },
  rw:    { min:3, max:4,  txt:'Razgovorno — deo za trčanje mora ostati lagan' },
  lr:    { min:4, max:5,  txt:'Razgovorno do postojano' },
  tempo: { min:7, max:8,  txt:'Prijatno teško — kratke rečenice' },
  int:   { min:8, max:9,  txt:'Teško — ubrzano disanje, bez pričanja' },
  test:  { min:9, max:10, txt:'Skoro maksimalno' },
  trka:  { min:9, max:10, txt:'Maksimalno' }
};
/* Vraća {min,max,txt} ili null. Gleda ORIGINALNI tip kad je dan izmenjen —
   inače bi izmenjen dan pokazivao napor za tip koji više nije aktuelan. */
function rpeTarget(d){
  if(!d || d.rest) return null;
  const t = d.tag;
  if(t === 'snaga') return null;   /* snaga nije trčanje, druga skala */
  return RPE_TARGET[t] || null;
}

/* FAZA NEDELJE — orijentacija "gde sam u planu".
   Izvodi se iz pozicije, ne čuva se nigde: nema migracije šeme i tačno je i
   za generisane i za ručno pisane planove. Deload zadržava svoju oznaku jer
   je konkretnija informacija od faze. */
function weekPhase(w, totalWeeks){
  if(!w) return '';
  if(w.deload || w.focus === 'DELOAD') return 'DELOAD';
  const n = w.w, T = totalWeeks || 1;
  if(n >= T) return 'TRKA';
  if(n >= T - 1) return 'TAPER';
  const frac = n / T;
  if(frac <= 0.30) return 'BAZA';
  if(frac <= 0.65) return 'RAZVOJ';
  return 'VRHUNAC';
}

function sessBreakdown(d){
  if(!d||d.rest)return null;
  const rows=[];
  const s=d.session;
  if(s){
    if(s.wuKm)rows.push(['Zagrevanje',fmtKm(s.wuKm)+' km']);
    let work=null;
    if(s.type==='int'&&s.reps&&s.repM)work=`${s.reps} × ${s.repM} m @ ${fmtTempo(s.paceSec)}/km`;
    else if(s.type==='pyramid'&&Array.isArray(s.reps))work=`${s.reps.join('-')} m @ ${fmtTempo(s.paceSec)}/km`;
    else if(s.type==='tempo'&&s.qKm)work=`${fmtKm(s.qKm)} km @ ${fmtTempo(s.paceSec)}/km`;
    else if(s.type==='fartlek'&&s.reps)work=`${s.reps} × ${s.repSec} s @ ${fmtTempo(s.paceSec)}/km`;
    if(work)rows.push(['Radni deo',work,true]);
    if(s.restSec)rows.push(['Odmor',s.restSec>=60?Math.round(s.restSec/60)+' min':s.restSec+' s']);
    if(s.cdKm)rows.push(['Hlađenje',fmtKm(s.cdKm)+' km']);
    if(d.runWalk)rows.push(['Ritam',runWalkText(d.runWalk),true]);
    const rp=rpeTarget(d);
    if(rp)rows.push(['Napor','RPE '+rp.min+'–'+rp.max]);
    return rows.length>=2?rows:null;
  }
  const desc=d.desc||'';
  const mWU=desc.match(/([\d.,]+)\s*km\s*(?:WU|zagrevanje)/i);
  const mCD=desc.match(/([\d.,]+)\s*km\s*(?:CD|hlađenje|smirivanje)/i);
  const afterWU=desc.split(/km\s*(?:WU|zagrevanje)\s*\+\s*/i)[1];
  let work=null;
  if(afterWU)work=afterWU.split(/\s*\(|\s*\+\s*[\d.,]+\s*km\s*(?:CD|hlađenje|smirivanje)/i)[0].trim();
  const mRest=desc.match(/\((\s*\d+\s*(?:min|s)\b[^)]*)\)/i);
  if(mWU)rows.push(['Zagrevanje',mWU[1].replace(',','.')+' km']);
  if(work)rows.push(['Radni deo',work,true]);
  if(mRest)rows.push(['Odmor',mRest[1].trim()]);
  if(mCD)rows.push(['Hlađenje',mCD[1].replace(',','.')+' km']);
  if(d.runWalk)rows.push(['Ritam',runWalkText(d.runWalk),true]);
  const rp2=rpeTarget(d);
  if(rp2)rows.push(['Napor','RPE '+rp2.min+'–'+rp2.max]);
  /* Prag od 2 reda postoji da se za obican lagan dan ne crta tabela sa jednim
     poljem. Ali run/walk dan je CELA poenta izmene posle povrede — njegov
     ritam mora da se vidi i kad je jedini red, inace covek dobije samo
     recenicu u opisu i nigde strukturu po kojoj trci. */
  return (rows.length>=2 || d.runWalk) ? rows : null;
}
/* Dodatne napomene iz opisa koje NISU deo strukture (npr. "plafon HR 170",
   "kontrolisan maks. napor") — da se ne izgube kad prikazujemo strukturirano. */
function sessNote(d){
  const desc=(d&&d.desc)||'';
  /* gledaj SAMO deo posle crte (opis rada) — inače se kvalifikator iz naziva
     sesije ("Tempo (broken, duže reps) — ...") lažno pokupi kao napomena */
  const body=desc.includes('—')?desc.slice(desc.indexOf('—')+1):desc;
  const parts=[];
  const paren=body.match(/\(([^)]+)\)/);
  if(paren&&!/^\s*\d+(?:[.,]\d+)?\s*(?:min|s)\b/i.test(paren[1]))parts.push(paren[1].trim());
  const tail=body.match(/km\s*(?:CD|hlađenje|smirivanje)\s*[·•]\s*(.+)$/i);
  if(tail)parts.push(tail[1].trim());
  return parts.join(' · ');
}
function sessKind(d){
  if(d.rest)return tagName('odmor');
  /* Ako je dan RUČNO izmenjen (Izmeni trening), d.session i dalje nosi
     ORIGINALNU (pre-izmene) strukturu — potreban je za deriveQS/PRED
     usklađivanje (linije 2200+, namerno tako, prati "originalno planiran"
     slot). Ali za PRIKAZ (ova funkcija: oznaka na kartici + SESS_GUIDE savet)
     to je zastarelo — nađeno testom: Piramida dan promenjen u obično lako
     trčanje i dalje je prikazivao "Piramida" i savet o piramidalnom tempu. */
  if(S.alts&&S.alts[d.id])return tagName(d.tag);
  return (d.session&&d.session.kind)?d.session.kind:tagName(d.tag);
}

/* ============ STANJE + STORAGE ============ */
let LS_OK=true;try{localStorage.setItem('__t','1');localStorage.removeItem('__t');}catch(e){LS_OK=false;}
let MEM=null;
/* ZAPISI O OPORAVKU SU BROJEVI — i to se ovde NAMECE, ne pretpostavlja.
   Server (/api/icu) ih vec pretvara u brojeve (`broj()` u izvuci()), pa
   je ziv put bezbedan. Ali UVOZ BACKUPA i sbPull() upisuju u S.wellness sta
   god stoji u JSON-u, a te vrednosti idu pravo u HTML (kartica Oporavak, HRV
   grafikon, red „Tog jutra" na kartici treninga) — dokazano napadom: zapis sa
   hrv = "\"><img src=x onerror=...>" izlazi iz atributa i izvrsava kod.
   Posto su to merenja, pretvaranje u broj je i tacno i dovoljno: sve sto nije
   broj postaje null i nestaje iz prikaza. */
function cistWellness(w){
  if(!w||typeof w!=='object'||Array.isArray(w)) return {};
  const broj=v=>(v==null||v===''||isNaN(+v))?null:+v;
  const out={};
  for(const k of Object.keys(w)){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;      /* kljuc je datum, nista drugo */
    const z=w[k]; if(!z||typeof z!=='object') continue;
    const c={datum:k};
    for(const polje of ['hrv','pulsUMiru','sanH','sanOcena','tezina','ctl','atl','svezina'])
      c[polje]=broj(z[polje]);
    out[k]=c;
  }
  return out;
}
/* VDOT ZAPISI SU BROJEVI — nametnuto, ne pretpostavljeno.
   Iste klase kao cistWellness: vrednosti nastaju racunanjem, ali uvoz backupa
   i sbPull upisuju sta god stoji u JSON-u, a odatle idu pravo u HTML (kartica
   „Trenutna forma", VDOT grafikon, oznaka pored unosa tempa). Dokazano
   fuzzerom: zapis sa vdot = "\"><img src=x onerror=...>" izlazi iz atributa
   na Trka ekranu. `id` se validira odvojeno (v. losIdUStanju). */
function cistVdotLog(v){
  if(!Array.isArray(v)) return [];
  const broj=x=>(x==null||x===''||isNaN(+x))?null:+x;
  return v.filter(e=>e&&typeof e==='object').map(e=>{
    const c={id:e.id, ts:typeof e.ts==='string'?e.ts:null};
    for(const polje of ['vdot','prev','delta','measured']) c[polje]=broj(e[polje]);
    if(e.vdotMigrated) c.vdotMigrated=true;
    return c;
  }).filter(e=>e.id!=null&&e.ts);
}
/* DATUMI SU DATUMI — nametnuto, kao i brojevi u cistWellness/cistVdotLog.
   Ista rupa, treci ugao: uvoz backupa je proveravao ID-jeve (validanId,
   losIdUStanju) i vrednosti oporavka, ali NE i polje `date` u knee/kg. Zapis
   sa `date:"abc"` prolazi kroz migrate netaknut, pa `s2d()` vraca Invalid
   Date, a grafikoni ispisu `points="NaN,98.0"` — kriva bola i kriva mase se
   tiho slome. Nije bezbednosni propust (vrednosti se escapuju), ali jeste
   podatak koji aplikacija tvrdi da razume a ne razume.
   Zapis bez upotrebljivog datuma se ODBACUJE, ne popravlja: pogodjen datum
   bio bi izmisljen podatak o necijem bolu ili masi. */
/* ID_OBLIK/validanId MORAJU stajati IZNAD migrate(), a ne kraj provera uvoza
   gde su i nastali. `const` u modulu je u vremenskoj mrtvoj zoni sve dok se do
   njega ne dodje, a migrate() se poziva iz loadState() — dakle na PRVOM redu
   izvrsavanja, hiljadama redova ranije.
   Posledica je bila potpuna i tiha: ko je imao makar jedan zapisan test na
   3 km, njegov migrate() bi na sledecem otvaranju pukao sa „Cannot access
   'ID_OBLIK' before initialization", loadState() bi otisao u catch, a
   aplikacija bi se otvorila PRAZNA. (Podaci se ne gube — sirov tekst ide u
   `sub19-v1-osteceno`, a server ima kopiju — ali covek vidi prazan plan.)
   Testovi to nisu videli jer nijedan seed nije imao t3k zapis: bez njega
   `.filter` nikad ne pozove validanId, pa greska ne nastane. */
const ID_OBLIK=/^[A-Za-z0-9_-]{1,64}$/;
function validanId(x){ return typeof x==='string' && ID_OBLIK.test(x); }
const DATUM_OBLIK=/^\d{4}-\d{2}-\d{2}$/;
function validanDatum(s){
  if(typeof s!=='string'||!DATUM_OBLIK.test(s)) return false;
  const [g,m,d]=s.split('-').map(Number);
  if(m<1||m>12||d<1||d>31) return false;
  const t=new Date(g,m-1,d);            /* 2026-02-31 se prelije u mart — odbij */
  return t.getFullYear()===g&&t.getMonth()===m-1&&t.getDate()===d;
}
function cistDatirane(niz){
  if(!Array.isArray(niz)) return [];
  return niz.filter(x=>x&&typeof x==='object'&&validanDatum(x.date));
}
/* BROJ KOJI SE CRTA I PO KOME SE ODLUČUJE, iz zapisa koji je mogao doći iz
   uvezenog backupa — dakle iz proizvoljnog JSON-a.

   Zašto ovo nije deo `cistDatirane`: ona služi trima nizovima (`knee`, `kg`,
   `t3k`) koji nose različita polja, pa bi zajednička provera morala da zna
   koje polje gde — a to je tačno ono što se posle raziđe.

   Šta se dešavalo bez ovoga (zatečeno, ne uneseno ovim izmenama):
     - grafikon bola je crtao `cy="NaN"`, što pregledač odbija i tačka nestane;
     - `partLevel` je vraćao `undefined`, pa je `bol >= 6` bilo netačno —
       unos o povredi POSTOJI, a plan se ponaša kao da ga nema. To je tiši i
       skuplji ishod od nenacrtane tačke. */
function cistBrojPolje(niz, polje, min, max){
  if(!Array.isArray(niz)) return [];
  return niz.filter(x=>{
    const v=x?x[polje]:null;
    return typeof v==='number' && isFinite(v) && v>=min && v<=max;
  });
}
/* run/walk struktura iz S.alts — ista granica poverenja kao cistWellness:
   vrednosti nastaju računanjem, ali uvoz backupa i sbPull upisuju šta god
   stoji u JSON-u, a odatle idu u opis treninga i u korak koji ide na sat. */
function cistRunWalk(rw){
  if(!rw||typeof rw!=='object') return null;
  const b=v=>(v==null||v===''||isNaN(+v))?null:Math.round(+v);
  const r=b(rw.runSec), w=b(rw.walkSec);
  if(!(r>0&&r<=3600)||!(w>0&&w<=3600)) return null;
  return { runSec:r, walkSec:w, label:runWalkText({runSec:r,walkSec:w}) };
}
/* `r1` stoji OVDE, a ne uz ostatak računice: `t3kMoguc` ga zove, a `t3kMoguc`
   zove `migrate()` sa prvog reda izvršavanja. Dok je stajao dole, učitavanje
   stanja sa zapisanim testom na 3 km pucalo je sa „Cannot access 'r1' before
   initialization" i aplikacija se otvarala prazna — treći put ista mrtva zona
   (v. ID_OBLIK), ovog puta uhvaćena testom pre nego što je izašla. */
const r1=x=>Math.round(x*10)/10;
const T3K_DIST_M=3000;
const T3K_PREFIX='t3k-';
function jeT3k(id){ return String(id||'').startsWith(T3K_PREFIX); }

/* ============================================================
   GRANICE MERENJA — ŠTA UOPŠTE MOŽE DA BUDE MERENJE

   Prijava iz upotrebe: „trend ne uračunava 3k test kako treba, analiza je
   loša". Grafikon forme je sa 48,6 skočio na 73,5 i tu ostao, a AI analiza
   je taj skok čitala kao činjenicu i pisala da „statistika zabeleženog
   VDOT-a raste".

   Uzrok: unos vremena na 3 km je propuštao sve preko 5:00. Svetski rekord na
   3000 m je 7:20, pa je 5:00 dozvoljavalo unos koji nijedan čovek ne može da
   istrči. Otkucano ~6:50 daje izmeren VDOT 89, a lanac forme sa alfom 0,60 za
   test skače na tačno 73,5. Ni jedna provera na tom putu nije rekla ni reč.

   NE ISPRAVLJA SE POGAĐANJEM. Vreme se ne „popravlja" na najbliže moguće —
   to bi bio izmišljen podatak o nečijem trčanju. Nemoguće merenje se ODBIJA,
   sa rečenicom koja kaže i zašto.

   Granice su granice SAME TABLICE: 85 je njen vrh (svetski vrh), 20 dno.
   `vdotFromPace` je binarna pretraga baš u tom opsegu, pa izvan njega i ne ume
   da izrazi ništa — v. `vdotPaceUOpsegu`. Zato je pošteno da isti par brojeva
   bude i merilo mogućeg: pretvarati se da postoji VDOT 12 ili 130 znači davati
   broj koji model ne zna da izračuna. */
const VDOT_TABELA_MIN=20, VDOT_TABELA_MAX=85;
function vdotMoguc(v){ return v!=null&&isFinite(v)&&v>=VDOT_TABELA_MIN&&v<=VDOT_TABELA_MAX; }
/* 7:20 = svetski rekord na 3000 m (Daniel Komen, 1996). Brže od toga nije
   trčanje nego omaška u kucanju.

   GORNJA GRANICA SE NE KUCA KAO DRUGI BROJ. Prvo je bila 60:00 — pa je unos
   od 30:00 prolazio kroz proveru, a `t3kVdot` mu posle nije umeo da izračuna
   VDOT (ispod dna tablice), tako da bi test stajao na kartici kao priznat a ne
   bi radio ništa. To je tačno ono stanje zbog kog je i pisana provera. Zato je
   pravilo jedno: vreme je moguće ako je iz njega moguć VDOT.
   `vdotFromRace` je `function`, dakle hoistovana — smе da se zove i odavde,
   iznad svoje linije (v. komentar uz ID_OBLIK). */
const T3K_SEC_MIN=440;
function t3kMoguc(sec){
  return sec>=T3K_SEC_MIN && vdotMoguc(r1(vdotFromRace(T3K_DIST_M,sec)));
}
/* Najsporije vreme koje je još moguće — samo za poruku čoveku. Traži se, a ne
   pamti kao broj, da se ne bi razišlo sa `t3kMoguc` kad se tablica promeni.
   Gornja granica petlje (90 min) je osigurač, ne pravilo. */
function t3kNajsporije(){
  let s=T3K_SEC_MIN;
  while(s<5400&&t3kMoguc(s+1)) s++;
  return s;
}
/* MORAJU STAJATI IZNAD migrate() — v. komentar uz ID_OBLIK.
   `const` je u mrtvoj zoni sve do svoje linije, a migrate() se poziva sa
   prvog reda izvršavanja. Da su ove granice ostale dole uz ostatak koda o
   testu na 3 km, prvo učitavanje stanja sa zapisanim testom puklo bi sa
   „Cannot access 'T3K_SEC_MIN' before initialization" i aplikacija bi se
   otvorila prazna. */

function migrate(o){
  if(!o||typeof o!=='object')return null;
  if(!o.log||typeof o.log!=='object'||Array.isArray(o.log))return null;
  /* OZNAKA VERZIJE MORA DA BUDE BROJ, ne „nešto što liči na broj".
     Ranije je stajalo `o.v=o.v||1`, pa je string ostajao string — a provera
     ispod je gledala TIP. Backup sa `"v": "11"` (navodnici oko broja) time nije
     bio odbijen: nijedna migraciona grana se ne okine (`'11' < 2` je netačno,
     kao i sve ostale), pa se na kraju bezuslovno postavi `o.v = SCHEMA` i fajl
     iz NOVIJE šeme prođe kao tekući, uz poruku da je uvoz uspeo. Tačno ono
     protiv čega provera ispod brani.
     Ovo je bila i jedina provera u `migrate` koja radi po pravilu „ako nije
     broj, propusti"; sve ostale (`cistBrojPolje`, `cistWellness`, `zajBr`) rade
     po pravilu „ono što nije broj postaje null".

     Nečitljiva oznaka se tumači kao NAJSTARIJA, isto kao da je nema. To je jedini
     bezbedan smer pogađanja: migracione grane samo dopunjuju polja koja
     nedostaju, pa preterano nizak broj ne može ništa da pokvari — a preterano
     visok bi preskočio migraciju koja je stvarno trebalo da se izvrši. */
  o.v = (o.v==null || o.v==='' || !isFinite(+o.v)) ? 1 : +o.v;
  /* Stanje iz NOVIJE seme se odbija. Ranije je `o.v=SCHEMA` na kraju bezuslovno
     spustao verziju, pa bi backup napravljen u novijoj verziji aplikacije bio
     protumacen po starim pravilima i tiho pogresno prikazan — a korisnik bi
     video uredan uvoz. Bolje jasno odbiti i traziti azuriranje aplikacije. */
  if(o.v>SCHEMA) return null;
  if(o.v<2){o.strava=o.strava||null;o.predLock=o.predLock||{};o.v=2;} /* v1→v2: Strava sync polja — postojeći unosi se NIKAD ne brišu */
  if(o.v<3){o.vdotLog=o.vdotLog||[];o.v=3;} /* v2→v3: VDOT istorija forme — postojeći unosi netaknuti */
  if(o.v<4){o.moves=o.moves||{};o.v=4;} /* v3→v4: zamena dana (swap) — postojeći raspored netaknut (prazna mapa = sve na originalnim mestima) */
  if(o.v<5){o.alts=o.alts||{};o.v=5;} /* v4→v5: izmena tipa treninga — prazna mapa = svi dani po planu */
  if(o.v<6){o.genPlan=o.genPlan||null;o.v=6;} /* v5→v6: generisan plan — null = koristi hardkodovan PLAN (BEZ IZMENE za postojeće korisnike) */
  /* predLock je ranije nedostajao u ovom spisku (postavljao se SAMO u v<2 grani),
     pa je stanje sa v>=2 bez tog polja obaralo unos tempa i Strava sync
     (S.predLock[pid] na undefined -> TypeError). Svi ostali ključevi su ovde
     bezuslovno — i ovaj mora biti. */
  /* v6→v7: `wellness` (oporavak sa intervals.icu) i `icu` (veza) su postojali
     u kodu ali nikad nisu bili upisani u semu — svako citanje ih je moralo
     rucno cuvati. Prazna mapa / null = ponasanje IDENTICNO kao pre. */
  if(o.v<7){o.wellness=o.wellness||{};o.icu=o.icu!==undefined?o.icu:null;o.v=7;}
  /* v7→v8: testovi na 3 km. Prazan niz = ponasanje IDENTICNO kao pre — ko ga
     nema, jednostavno nema nijedan test u lancu forme. */
  if(o.v<8){o.t3k=o.t3k||[];o.v=8;}
  /* v8→v9: kesirana prognoza. null = ponasanje IDENTICNO kao pre. */
  if(o.v<9){o.vreme=o.vreme||null;o.v=9;}
  /* v9->v10: Zajednica. `vidljiv:false` = ponasanje IDENTICNO kao pre —
     postojeci korisnik ne postaje vidljiv nadogradnjom aplikacije. */
  if(o.v<10){o.zajed={vidljiv:false,nadimak:''};o.v=10;}
  /* ID MORA da nosi prefiks: po njemu `tipSesijeZaVdot` prepoznaje test i daje
     mu najveću težinu u lancu forme. Uvezen zapis bez prefiksa bi tiho pao na
     podrazumevanu težinu — dakle ne bi bio test, samo bi tako izgledao. */
  /* Granica je 7:20–60:00, ne 0–7200: brže od svetskog rekorda na 3000 m nije
     trčanje. Zapis izvan toga se BRIŠE, i to ne samo pri uvozu tuđeg fajla —
     ovde se leči i stanje koje već stoji na uređaju. Bez toga bi jedna omaška
     u kucanju zauvek držala grafikon forme na nemogućem broju, a AI analiza bi
     ga svaki put čitala kao činjenicu. */
  o.t3k=cistDatirane(o.t3k)
    .map(t=>({id:String(t.id||''), date:t.date, sec:Math.round(+t.sec)}))
    .filter(t=>jeT3k(t.id)&&validanId(t.id)&&t3kMoguc(t.sec));
  o.wellness=cistWellness(o.wellness);
  /* Isto za lanac forme: merenje van ljudskog opsega ne ostaje u istoriji.
     Zapis se odbacuje ceo — „popravka" na najbliži mogući broj bila bi
     izmišljen podatak o nečijem trčanju. */
  o.vdotLog=cistVdotLog(o.vdotLog)
    .filter(e=>!(e.measured!=null&&!vdotMoguc(e.measured)))
    .filter(e=>!(e.measured==null&&e.vdot!=null&&!vdotMoguc(e.vdot)));
  /* Bol van 0–10 nije bol nego đubre; težina van 20–300 kg isto. Zapis bez
     upotrebljivog broja se odbacuje, a ne provlači kao „nula". */
  o.knee=cistBrojPolje(cistDatirane(o.knee), 'pain', 0, 10);
  o.kg=cistBrojPolje(cistDatirane(o.kg), 'kg', 20, 300);
  o.vreme=(o.vreme&&typeof o.vreme==='object'&&o.vreme.sati&&typeof o.vreme.sati==='object')?o.vreme:null;
  o.t3k=o.t3k||[];o.knee=o.knee||[];o.kg=o.kg||[];o.pred=o.pred||{};o.predLock=o.predLock||{};o.vdotLog=o.vdotLog||[];o.moves=o.moves||{};o.alts=o.alts||{};o.genPlan=o.genPlan!==undefined?o.genPlan:null;o.wellness=o.wellness||{};o.icu=o.icu!==undefined?o.icu:null;o.zajed=Object.assign({vidljiv:false,nadimak:''},(o.zajed&&typeof o.zajed==='object')?o.zajed:{});o.zajed.vidljiv=o.zajed.vidljiv===true;o.zajed.nadimak=typeof o.zajed.nadimak==='string'?o.zajed.nadimak.slice(0,24):'';o.ui=Object.assign({firstRun:null,lastBackup:null,snooze:null,seenWeek:null,geo:null,satTreninga:null,novo:null},o.ui||{});
  o.v=SCHEMA;
  return o;
}
/* OSTECENO STANJE SE NE BRISE — ni lokalno, ni na serveru.
   Ranije: `catch(e){}` pa `return seedState()`. Posledica je bila potpun,
   TIH gubitak svega. Lanac:
     1. jedan neispravan bajt u localStorage-u (prekinut upis, puna kvota,
        greska u buducoj migraciji seme) -> JSON.parse baca
     2. greska se guta, vrati se prazan seed
     3. `let S=loadState(); save();` odmah upise taj prazan seed PREKO
        ostecenog originala — sirovi bajtovi vise ne postoje
     4. sbInit() zatim posalje prazno stanje na server (sbDecide vrati 'ok'
        jer server nije noviji od SB.seenAt) — nestaje i serverska kopija
   Covek pritom nije video nijedno upozorenje: aplikacija se otvori kao da je
   prvi put pokrenuta.
   Sada: sirovi tekst se sklanja u zaseban kljuc (nista se ne prepisuje),
   dize se zastavica koja ZABRANJUJE slanje na server dok covek ne odluci, i
   prikazuje se traka sa ponudjenim preuzimanjem spasenog fajla. */
const LS_SPAS_KEY=LS_KEY+'-osteceno';
let UCITAVANJE_PALO=null;   /* {razlog, bajtova} kad je stanje bilo neispravno */

function loadState(){
  let raw=null;
  if(LS_OK)raw=localStorage.getItem(LS_KEY);else raw=MEM;
  if(raw){
    try{ const o=migrate(JSON.parse(raw)); if(o) return o;
         throw new Error('migrate() nije vratio stanje'); }
    catch(e){
      UCITAVANJE_PALO={razlog:String(e&&e.message||e), bajtova:raw.length};
      /* Sirovi tekst pre svega ostalog — sledeci save() ide preko LS_KEY. */
      try{ if(LS_OK) localStorage.setItem(LS_SPAS_KEY, raw); }catch(e2){}
    }
  }
  const s=seedState();s.ui.firstRun=todayStr();
  return s;
}

/* Upis u localStorage UME da baci: kvota je puna, ili je pregledac u rezimu
   koji dozvoljava probni 1-bajtni upis (LS_OK gore) a odbija pravi teret.
   Bez hvatanja, save() prekida pozivaoca na pola posla — a poziva se iz
   svakog upisa u aplikaciji (zavrsen trening, bol u kolenu, merenje mase).
   Korisnik bi kliknuo, nista se ne bi desilo, i nigde ne bi pisalo zasto. */
let UPIS_PAO=false;
/* SAVE_TMR MORA STAJATI IZNAD save(), ne uz saveOdlozeno() gde je i nastao.
   `let` u mrtvoj zoni baca na SVAKI dodir dok se do deklaracije ne dođe — a
   `save()` se poziva na prvom redu izvršavanja (`let S=loadState();save();`).
   Danas je taj red hiljadama linija NIŽE, pa bi radilo; ali isti raspored je
   ovaj projekat već oborio (v. ID_OBLIK iznad migrate()), i to tiho: aplikacija
   se otvarala prazna. Deklaracija je jeftina, klasa greške nije. */
let SAVE_TMR=null;
function save(){
  clearTimeout(SAVE_TMR); SAVE_TMR=null;   /* pun upis poništava zakazan */
  const j=JSON.stringify(S);
  if(LS_OK){
    try{ localStorage.setItem(LS_KEY,j); UPIS_PAO=false; }
    catch(e){
      if(!UPIS_PAO){ UPIS_PAO=true; prikaziUpisPao(String(e&&e.name||e)); }
      MEM=j;   /* bar u memoriji, da rad u toku sesije ne propadne */
    }
  } else MEM=j;
  if(typeof sbSchedulePush==='function')sbSchedulePush();
} /* lokalno ostaje izvor istine; sinhronizacija je odlozen dodatak */

/* ODLOŽEN UPIS — SAMO ZA POLJA U KOJA SE KUCA.
   `save()` serijalizuje CELO stanje pa ga sinhrono upiše u localStorage. Kod
   aktivnog korisnika to stanje nije malo: izmereno na 70 treninga sa `perKm` i
   `laps` nizovima i 180 dana oporavka — 453 KB. `JSON.stringify` nad tim je
   ~2 ms na stonom računaru, dakle 7-13 ms na telefonu, a sinhroni upis na disk
   je i skuplji od toga. Do sada se sve to dešavalo NA SVAKO SLOVO u belešci o
   treningu i u belešci o bolu: kucanje je radilo desetak milisekundi
   sinhronog posla po pritisku, na glavnoj niti, uz `syncSide()` koji uz to
   pregrađuje dva niza.

   Brojevi, statusi i izbori i dalje idu kroz pun `save()` — oni su jedan
   dodir, ne niz dodira, i ništa se ne dobija odlaganjem.

   NIŠTA SE NE GUBI: `blur` i odlazak aplikacije u pozadinu
   (`visibilitychange`) forsiraju upis, a i sam sledeći `save()` poništava
   zakazani i upisuje sve odjednom. (`SAVE_TMR` stoji gore, iznad save() —
   v. objašnjenje tamo.) */
const SAVE_ODLAGANJE=400;
function saveOdlozeno(){
  if(SAVE_TMR) return;                    /* već zakazano — ne pomeraj rok unedogled */
  SAVE_TMR=setTimeout(()=>{ SAVE_TMR=null; save(); }, SAVE_ODLAGANJE);
}
/* Poziva se pre svega što ne sme da zatekne nezapisano stanje. */
function saveOdmah(){ if(SAVE_TMR) save(); }

/* ============ STATISTIKE ============ */
function stFor(id){const l=S.log[id];return l&&l.status?l.status:'pending';}
function realKmDay(d){const l=S.log[d.id];if(!l||l.status!=='done')return 0;return l.km!=null?l.km:(d.km||0);}
function weekRealKm(w){return w.days.reduce((s,d)=>s+realKmDay(d),0);}
/* TRCANJA odvojeno od snage. Korisnik koji je izabrao "4 dana trcanja" je s
   pravom prijavio da mu plan pise "5 tren." — peti je dan snage, koji je u
   generisanom planu izricito OPCION ("po sopstvenom programu, bez trcanja").
   Brojac je i dalje isti (snaga se sme oznaciti kao odradjena), ali se
   prikazuje odvojeno da broj trcanja odgovara onome sto je covek uneo. */
function weekRunCount(w){return w.days.filter(d=>!d.rest && d.tag!=='snaga').length;}
function weekRunDone(w){return w.days.filter(d=>!d.rest && d.tag!=='snaga' && stFor(d.id)==='done').length;}
function streak(today){
  let cur=today,n=0;
  const t=BY_DATE[today];
  if(t&&!t.rest&&stFor(t.id)!=='done')cur=addD(today,-1);
  while(cur>=CUR_START){
    const d=BY_DATE[cur];
    if(!d){if(cur>CUR_RACE){cur=addD(cur,-1);continue;}break;}
    if(d.rest){n++;}
    else if(stFor(d.id)==='done'){n++;}
    else break;
    cur=addD(cur,-1);
  }
  return n;
}
/* DELOVI TELA KOJI NOSE TRČANJE.
   Bol se beleži za celo telo (spisak ima 35 stavki, od glave do pete) i to je
   ispravno — ali plan TRČANJA ne sme da se menja zbog svega. Do sada nije
   pravio razliku: bol 10 u ŠACI ili GLAVI pretvarao je naredne treninge u
   odmor isto kao bol 10 u Ahilovoj. Provereno na svih 8 proba — svaka je
   davala „STANI".
   Ovde su delovi koji stvarno primaju udarno opterećenje pri trčanju ili nose
   njegovu mehaniku. Ostali se i dalje beleže i vide u kartici Koleno, ali ne
   prepisuju plan. */
const NOSIVI_DELOVI = new Set([
  'donja-ledja','prepone',
  'kuk-L','kuk-D','gluteus-L','gluteus-D',
  'kvadriceps-L','kvadriceps-D','zadnja-loza-L','zadnja-loza-D',
  'koleno-L','koleno-D','potkolenica-L','potkolenica-D',
  'list-L','list-D','ahilova-L','ahilova-D',
  'stopalo-L','stopalo-D','peta-L','peta-D'
]);
/* Zapisi bez `part` su iz vremena pre spiska delova tela (dnevnik je počeo kao
   dnevnik KOLENA) — oni se broje kao nosivi, jer to i jesu bili. */
function nosivDeo(p){ return !p || NOSIVI_DELOVI.has(p); }
function bolniZapisi(od,doDatuma){
  return (S.knee||[]).filter(k=>k&&k.date>=od&&k.date<=doDatuma&&nosivDeo(k.part));
}
/* Bol koji NE nosi trčanje — za poruku, da se ne pravimo da ga nema. */
function nenosiviBol(od,doDatuma){
  const w=(S.knee||[]).filter(k=>k&&k.date>=od&&k.date<=doDatuma&&!nosivDeo(k.part)&&k.pain>=3);
  if(!w.length) return null;
  return { max:w.reduce((m,k)=>Math.max(m,k.pain),0), delovi:[...new Set(w.map(k=>partName(k.part)))] };
}

function kneeStatus(today){
  const from=addD(today,-6);
  /* (S.knee||[]) — ostecen ili rucno izmenjen backup moze da postavi ovo na
     null; bez zastite cela funkcija puca i obara Danas ekran. */
  const win=bolniZapisi(from,today);
  const mx=win.reduce((m,k)=>Math.max(m,k.pain),0);
  const ge3=win.filter(k=>k.pain>=3).length;
  if(ge3>=3)return{cls:'stop',t:'FIZIJATAR',s:'3+ dana sa bolom ≥3 u poslednjih 7 dana — zakaži pregled.'};
  if(mx>=6)return{cls:'stop',t:'STANI',s:'Bol 6+ u poslednjih 7 dana. Pravilo iz plana: stani.'};
  if(mx>=3)return{cls:'warn',t:'PAZI',s:'Bol 3–5 u poslednjih 7 dana. Prati i smanji ako raste.'};
  return{cls:'ok',t:'Bez povreda',s:'0 = bez bola · 3–5 = pazi · 6+ = stani · 3+ dana ≥3 u 7 dana = fizijatar'};
}
/* ============ PRILAGOĐAVANJE PLANA POVREDI ============
   Koristi ISTE pragove kao kneeStatus() — namerno, da app ne govori dve
   različite priče o istom bolu. Pragovi su vlasnikovi, ne izmišljeni ovde:
     bol 3–5              -> PAZI    -> kvalitet postaje lako, obim smanjen
     bol 6+               -> STANI   -> odmor od trčanja + stručna pomoć
     3+ dana s bolom ≥3   -> FIZIJATAR -> isto, ali naglašeno

   ZAŠTO PREDLOG, A NE TIHA IZMENA: kod jakog bola ispravan odgovor nije
   "tiho smanji obim da nastavi da trči" — to poručuje "sređeno je, samo
   napred". Predlog koji korisnik vidi i svesno prihvati čuva i njegovu
   kontrolu i tačnu poruku o ozbiljnosti. */

/* FAZA POVRATKA POSLE POVREDE.
   Nagli povratak na pun obim posle pauze je klasičan način da se povreda vrati
   — zato postepeno: 50% → 70% → 85% → pun obim, po nedelju dana svaki korak.

   Ne čuva nikakvo NOVO stanje — sve se izvodi iz S.knee istorije. Time nema
   migracije šeme, nema rizika da marker ostane zaglavljen, i samo se ispravi
   ako korisnik obriše ili izmeni unos bola. */
function returnToRunPhase(today){
  today = today || TODAY;
  const knee = (S.knee||[]).filter(k => k && typeof k.date === 'string' && typeof k.pain === 'number');
  if(!knee.length) return null;

  /* Faza povratka ima smisla SAMO ako je bilo ozbiljne epizode — ne posle
     jednog dana blage nelagode. Isti pragovi kao kneeStatus. */
  const lookback = addD(today, -42);
  const inWindow = knee.filter(k => k.date >= lookback && k.date <= today);
  const hadSerious = inWindow.some(k => k.pain >= 6) || inWindow.filter(k => k.pain >= 3).length >= 3;
  if(!hadSerious) return null;

  /* Ako bol JOŠ traje, ovo nije povratak nego aktivna povreda — tim se bavi
     injuryProposal, ne ova funkcija. */
  if(kneeStatus(today).cls !== 'ok') return null;

  const painful = inWindow.filter(k => k.pain >= 3).sort((a,b) => a.date < b.date ? 1 : -1);
  if(!painful.length) return null;
  const daysSince = diffD(painful[0].date, today);

  /* VAZNO: pojasevi se mere od KRAJA akutne faze, ne od poslednjeg bola.
     kneeStatus gleda poslednjih 7 dana — dok taj prozor ne prodje, ovo se i
     ne poziva (gore je provera cls!=='ok'). Da su pojasevi racunati od datuma
     bola, prva nedelja (50%) bi trajala tacno JEDAN dan — 7. dan — pa bi
     odmah skocila na 70%. Ovako svaka faza dobija punu nedelju. */
  const sinceClear = daysSince - 7;
  if(sinceClear < 0) return null;

  if(sinceClear <= 6)  return { week:1, pct:0.50, daysSince, since:painful[0].date };
  if(sinceClear <= 13) return { week:2, pct:0.70, daysSince, since:painful[0].date };
  if(sinceClear <= 20) return { week:3, pct:0.85, daysSince, since:painful[0].date };

  /* ČETVRTA FAZA — lestvica se NE završava po kalendaru.
     Ranije je ovde stajalo `return null` („3 nedelje pa pun obim"). Merenjem:
     dok lestvica traje, `injuryProposal` uredno drži ACWR granicu i odnos
     ostaje oko 1.1–1.4; dvadeset prvog dana lestvica vrati null, sa njom
     nestane i ta granica, i plan traži ono za šta je projektovan — a hronično
     opterećenje je za to vreme palo. Rezultat je bio najveći skok obima u
     celoj pripremi, i to kod čoveka koji se upravo oporavio: na sve četiri
     distance +40 do +70% nedeljnog obima i ACWR do 1.9, tačno u pojasu za koji
     aplikacija sama piše „preko 1,5 rizik naglo raste".

     Sada se procenat ne ograničava (pct:1), pa ostaje da važi samo ACWR
     granica iz `injuryProposal`. Time se lestvica završava kad hronično
     opterećenje sustigne plan: čim `acwrP` dosegne 1, nijedan dan se više ne
     smanjuje, `changes` ostane prazan i `injuryProposal` vrati null sam od
     sebe. Bez novog stanja i bez novog praga. */
  return { week:4, pct:1, daysSince, since:painful[0].date };
}

/* ============================================================
   PREKID BEZ BOLA — bolest, put, poslovna obaveza

   Cela mašinerija povratka je do sada visila isključivo o dnevniku bola: bez
   unosa nema `returnToRunPhase`, bez nje nema predloga. Ali prekid najčešće
   NIJE povreda. Dve prazne nedelje u sredini pripreme merene su ovako: plan
   vrati pun obim i puno dugo trčanje istog dana, ACWR 2.3–2.5 na sve četiri
   distance, a aplikacija ne kaže ništa — kartica „Opterećenje" pokaže 2.4 tek
   u nedelju uveče, kad je nedelja već istrčana, jer gleda unazad.

   Podaci su sve vreme postojali: `S.log` zna da nema nijednog `done`, a
   `hronicniObim()` je već pao. Nedostajalo je samo da ih neko pogleda.

   ZAŠTO NIJE DOVOLJNO SAMO ACWR. Prvo je isprobano „predloži kad god sledećih
   sedam dana pređe 1.3 × hronično". Merenjem nad 72 kombinacije (četiri
   distance × obim × broj dana × početnik/trenirao) to okida i kod trkača koji
   nije propustio NIJEDAN trening: rani porast kod početničkih planova ide do
   1.49 × hronično sasvim legitimno. Čoveku koji radi tačno ono što plan traži
   ne sme da se ponudi smanjenje.

   Zato dva uslova zajedno: mora postojati stvaran manjak u odrađenom
   (`ostvarenost` ispod praga) I sledećih sedam dana moraju prelaziti ACWR
   granicu. Poslušan trkač ima ostvarenost 1.0 i ne vidi ništa, ma koliko plan
   rastao. ============================================================ */
const PREKID_PROZOR = 28;        /* isti horizont kao hronično opterećenje */
const PREKID_PRAG   = 0.70;      /* ispod ovoga trailing prozor nije rast plana nego prekid */
const PREKID_BEZ_KVALITETA = 10; /* dana bez trčanja posle kojih prva nedelja ide bez kvaliteta */

/* Koliko je od PLANIRANOG obima u prozoru zaista odrađeno.
   Meri se od ORIGINALNE kilometraže (origKm): da se gleda trenutna, ranije
   prihvaćen predlog bi sam sebi podigao ostvarenost na 100% i sakrio prekid
   koji je do njega i doveo. */
function ostvarenost(today, prozor){
  today = today || TODAY;
  const od = addD(today, -(prozor || PREKID_PROZOR)), doD = addD(today, -1);
  let plan = 0, real = 0;
  CUR_PLAN.forEach(w => w.days.forEach(d => {
    if(d.rest || d.tag === 'trka' || d.tag === 'snaga') return;
    if(d.date >= od && d.date <= doD) plan += (d.origKm != null ? d.origKm : d.km) || 0;
    const l = S.log[d.id];
    if(!l || l.status !== 'done') return;
    const dat = danTreninga(l, d);
    if(dat && dat >= od && dat <= doD) real += (l.km != null ? l.km : (d.km || 0));
  }));
  if(!(plan > 0)) return null;
  return Math.round(real / plan * 100) / 100;
}

/* NAJVEĆI ZAISTA ODRAĐEN NEDELJNI OBIM u poslednjih `danaUnazad` dana —
   najveći zbir bilo kojih sedam uzastopnih dana koji se završavaju danas ili
   ranije unutar prozora.

   Zašto ne prosto `akutniObim` (poslednjih 7 dana): on se KOTRLJA, pa opada
   svakog dana kroz nedelju kako stariji trening ispada iz prozora. Kao pod za
   povratak to daje sve manji broj što se kasnije u nedelji pogleda — isti
   predlog bi u ponedeljak nudio 22 km, a u sredu 16 km, bez ijednog novog
   podatka. Najveći blok u prozoru je stabilan: menja se tek kad ono što je
   odrađeno zaista ispadne iz prozora. */
function najveciNedeljniObim(today, danaUnazad){
  today = today || TODAY;
  const n = danaUnazad || 14;
  const po = {};
  CUR_PLAN.forEach(w => w.days.forEach(d => {
    const l = S.log[d.id];
    if(!l || l.status !== 'done') return;
    const dat = danTreninga(l, d);
    if(dat) po[dat] = (po[dat] || 0) + (l.km != null ? l.km : (d.km || 0));
  }));
  let naj = 0;
  for(let k = 0; k <= n - 7; k++){
    const kraj = addD(today, -k);
    let s = 0;
    for(let i = 0; i < 7; i++) s += po[addD(kraj, -i)] || 0;
    if(s > naj) naj = s;
  }
  return Math.round(naj * 10) / 10;
}

/* Dana od poslednjeg odrađenog trčanja. null = u dnevniku nema nijednog. */
function danaBezTrcanja(today){
  today = today || TODAY;
  let zadnji = null;
  CUR_PLAN.forEach(w => w.days.forEach(d => {
    const l = S.log[d.id];
    if(!l || l.status !== 'done') return;
    const dat = danTreninga(l, d);
    if(dat && dat <= today && (zadnji == null || dat > zadnji)) zadnji = dat;
  }));
  return zadnji == null ? null : diffD(zadnji, today);
}

/* Prekid postoji kad je u odrađenom stvaran manjak. Da li je taj manjak i
   OPASAN odlučuje ACWR granica u `injuryProposal` — ako sledećih sedam dana
   staju u 1.3 × hronično, nijedan dan se ne menja i predloga nema. */
function pauzaPovratka(today){
  today = today || TODAY;
  const o = ostvarenost(today);
  if(o == null || o > PREKID_PRAG) return null;
  return { ostvarenost: o, bezTrcanja: danaBezTrcanja(today) };
}

/* Koji dani se predlažu za izmenu i kako. Čista funkcija — ništa ne menja,
   samo vraća predlog. Time je testabilna nezavisno od DOM-a i od save(). */
/* ============================================================
   DOZIRANJE POSLE POVREDE — po odnosu akutnog i hroničnog opterećenja

   Ranije: fiksnih 60% za kvalitet i 75% za lagano. Broj je bio „konzervativan
   i namerno grub", ali je isti za svakoga — čovek koji trči 20 km nedeljno i
   čovek koji trči 60 dobijali su isti procenat, i to od PLANIRANOG obima, ne
   od onoga što stvarno rade.

   Sada: polazi se od hroničnog opterećenja — proseka STVARNO odrađenog obima
   kroz poslednje 4 nedelje. To je mera koju literatura o odnosu akutnog i
   hroničnog opterećenja (ACWR) koristi kao imenilac; rizik od povrede naglo
   raste kad nedeljni obim pređe ~1.5× taj prosek, a „bezbedan pojas" je
   0.8–1.3. Posle bola se ide na donju ivicu, ISPOD proseka.

   Zašto od ostvarenog, a ne od planiranog: posle povrede se plan i realnost
   razilaze. Ako je čovek tri nedelje trčao 0 km, njegovo hronično opterećenje
   JESTE nisko — i baš zato povratak mora da bude nizak. Planirani obim o tome
   ne zna ništa.

   Kad istorije nema (nov korisnik), pada se na ranije procente — bolje grubo
   nego ništa. */
const ACWR_POVRATAK = 0.8;   /* nedeljni obim posle bola: ispod hroničnog proseka */
const ACWR_MAX      = 1.3;   /* gornja ivica bezbednog pojasa; preko 1.5 rizik naglo raste */

function hronicniObim(today){
  /* SAMO ZAVRŠENE NEDELJE. Ranije je stajalo `w.start < today`, pa je od UTORKA
     u prosek ulazila i TEKUĆA nedelja — ona koja ima jedan odrađen dan. Imenilac
     bi preko noći pao za 17–18%, a odnos skočio, kod čoveka koji nije propustio
     nijedan trening i kome se između ponedeljka i utorka nije završila nijedna
     nedelja. Izmereno na sve četiri distance (N11, pun dnevnik):

       5K       52.7 → 43.3 km/ned,  ACWR 1.10 → 1.35
       10K      62.3 → 51.5,         ACWR 1.10 → 1.27
       PM       65.1 → 53.3,         ACWR 1.11 → 1.31
       Maraton  58.4 → 48.4,         ACWR 1.15 → 1.40

     Nije bilo samo kozmetičko: isti broj ide u `injuryProposal` kao osnov
     povratka, pa je predlog posle povrede zavisio od toga kog dana otvoriš
     aplikaciju — utorkom oko 15% niži nego nedeljom.

     Brojilac je od iste zamke bio izričito zaštićen (v. komentar uz
     `akutniObim`: „Namerno NE tekuća nedelja"); imenilac je ostao na
     kalendarskim nedeljama. I kartica ispod broja piše „prosekom poslednje
     četiri ZAVRŠENE nedelje" — sada to i jeste.

     Razmatran je i kotrljajući prozor od 28 dana (bliži Gabbettovoj definiciji,
     isti oblik kao brojilac). Odbačen za sada jer menja ponašanje cele
     mašinerije povratka iz v237, a ova ispravka uklanja baš i samo lažni skok
     usred nedelje. */
  const prosle = CUR_PLAN.filter(w => addD(w.start, 6) < today);
  const zadnje = prosle.slice(-4);
  if(!zadnje.length) return null;
  const km = zadnje.map(weekRealKm);
  /* Nule se BROJE (tri nedelje pauze zaista spuštaju hronično opterećenje),
     ali ako je sve nula nemamo od čega da računamo. */
  if(!km.some(v => v > 0)) return null;
  return Math.round(km.reduce((a,b)=>a+b,0) / km.length * 10) / 10;
}

/* Kog je DANA trening stvarno odrađen: pravi datum iz Strave, pa ručno uneti,
   pa planski — isti redosled koji već koriste kartica treninga i AI kontekst.
   Prihvata se samo niska oblika GGGG-MM-DD, jer se datumi porede kao niske; u
   starijim zapisima `ts` ume da bude broj (epoch), a `'1785834000' >= '2026-…'`
   je poređenje koje uvek laže. */
function danTreninga(l, d){
  const k = [l && l.runDate, l && l.ts, d && d.date]
    .find(x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x));
  return k ? k.slice(0,10) : null;
}
/* AKUTNO OPTEREĆENJE — kilometraža poslednjih sedam dana, kotrljajuće (danas i
   šest dana unazad). Namerno NE „tekuća nedelja": u utorak bi ona sadržala
   jedan trening, pa bi odnos ispao bezopasan baš onda kad je najkorisniji. */
function akutniObim(today){
  const od = addD(today, -6);
  let km = 0;
  CUR_PLAN.forEach(w => w.days.forEach(d => {
    const l = S.log[d.id];
    if(!l || l.status !== 'done') return;
    const dat = danTreninga(l, d);
    if(dat && dat >= od && dat <= today) km += (l.km != null ? l.km : (d.km || 0));
  }));
  return Math.round(km * 10) / 10;
}
/* Odnos akutnog i hroničnog opterećenja. Vraća `odnos:null` kad hronične osnove
   nema — bolje ne prikazati broj nego izmisliti imenilac. */
function acwrSada(today){
  const ak = akutniObim(today), hron = hronicniObim(today);
  return { ak, hron, odnos: (hron != null && hron > 0) ? Math.round(ak/hron * 100)/100 : null };
}

/* ŠTA PLAN TRAŽI NAREDNIH SEDAM DANA — i koji bi odnos iz toga ispao.

   `akutniObim` gleda UNAZAD, i to je za meru ispravno. Ali kao upozorenje
   stiže prekasno: u ponedeljak ujutru, kad bi vredelo, pokazuje nulu, a broj
   od 2.4 se pojavi tek u nedelju uveče — kad je nedelja već istrčana. Merenjem
   posle dve nedelje pauze: kartica ćuti celu nedelju povratka i progovori kad
   više nema šta da se promeni.

   Zato i pogled unapred. Isti imenilac (hronično), brojilac je ono što plan
   traži danas i narednih šest dana. Trka se ne broji: 42 km trke nije trenažno
   opterećenje koje se poredi sa nedeljnim prosekom. */
function planiraniObim7(today){
  today = today || TODAY;
  const doD = addD(today, 6);
  let km = 0;
  CUR_PLAN.forEach(w => w.days.forEach(d => {
    if(d.rest || d.tag === 'trka') return;
    if(d.date >= today && d.date <= doD) km += d.km || 0;
  }));
  return Math.round(km * 10) / 10;
}
function acwrPlan(today){
  const pl = planiraniObim7(today), hron = hronicniObim(today);
  return { pl, hron, odnos: (hron != null && hron > 0) ? Math.round(pl/hron * 100)/100 : null };
}

/* RUN/WALK DOK BOL NE PADNE ISPOD 4 — na CELOM pojasu od 4 naviše.
   Ranije je 6+ značilo brisanje svakog trčanja iz plana. To je i bio problem:
   plan bi se ispraznio, a čovek ostao bez ikakve strukture. Sada se umesto
   brisanja nudi run/walk — hod prekida udarno opterećenje, pa tkivo dobija
   ciklus opterećenje–rasterećenje umesto neprekidnog rada.

   Što je bol jači, kraći je deo trčanja i duži hod, i manji je obim. Na 9–10
   je odnos obrnut (1 min trčanja na 2 min hoda) — to je već pretežno hodanje.

   VAŽNO, i zato ostaje u poruci: ovo je prilagođavanje TRENINGA, ne lečenje.
   Bol 6+ i dalje nosi status „STANI" i poziv da se javiš stručnjaku; predlog
   se sme i odbiti. Aplikacija ne može da proceni da li uopšte smeš da staneš
   na nogu, i ne pretvara se da može. */
const RW_BOL_MIN = 4;        /* ispod ovoga se vraća neprekidno trčanje */
const RW_PO_BOLU = [
  { od:9, runSec:60,  walkSec:120, obim:0.25 },
  { od:7, runSec:60,  walkSec:60,  obim:0.35 },
  { od:6, runSec:120, walkSec:60,  obim:0.45 },
  { od:5, runSec:180, walkSec:60,  obim:0.55 },
  { od:4, runSec:300, walkSec:60,  obim:0.65 }
];
function rwZaBol(bol){
  if(!(bol >= RW_BOL_MIN)) return null;
  const s = RW_PO_BOLU.find(x => bol >= x.od);
  if(!s) return null;
  return { rw:{ runSec:s.runSec, walkSec:s.walkSec, label:runWalkText(s) }, obim:s.obim };
}

function injuryProposal(today){
  today = today || TODAY;
  const st = kneeStatus(today);

  /* Bol je prošao — ali ako je bila ozbiljna epizoda, predlaže se POSTEPEN
     povratak umesto skoka na pun obim. */
  if(st.cls === 'ok'){
    const ph = returnToRunPhase(today);
    /* Bola nema i lestvice nema — ali prekid postoji i bez ijednog unosa bola.
       Tada nema procenta lestvice, ostaje samo ACWR granica (pct:1 niže). */
    const pz = ph ? null : pauzaPovratka(today);
    if(!ph && !pz) return null;
    const pctTxt = Math.round((ph ? ph.pct : 1)*100) + '%';
    /* ISTA ACWR GRANICA KAO U AKTIVNOJ FAZI. Lestvica 50/70/85% računa se od
       PLANIRANOG obima, a plan ne zna da je čovek tri nedelje stajao. Ko je
       pauzirao ima nisko hronično opterećenje i 50% plana može biti daleko
       preko onoga što telo trenutno podnosi. Uzima se strože od dva. */
    const hronP = hronicniObim(today);
    const daniP = [];
    for(let i=0; i<7; i++){
      const date = addD(today, i);
      const d = BY_DATE[date];
      if(!d || d.rest) continue;
      if(d.tag === 'trka' || d.tag === 'test' || d.tag === 'snaga') continue;
      const baseKm = (d.origKm != null ? d.origKm : d.km) || 0;
      if(!baseKm) continue;
      daniP.push({ d, date, baseKm });
    }
    const planiranoP = daniP.reduce((s,x)=>s+x.baseKm, 0);
    /* Povratak sme na gornju ivicu bezbednog pojasa — cilj je rast ka planu,
       ne trajno smanjenje kao dok bol traje.

       PROBANO PA ODBAČENO: umanjivati budžet za ono što je već istrčano u
       poslednjih šest dana (`hronP*ACWR_MAX − akutniObim(juče)`), da se predlog
       ne bi svakog jutra iznova izdavao za pun prozor. Zvuči tačno, a u stanju
       ravnoteže je pogrešno: tamo je akutno ≈ hronično, pa budžet padne na
       0.3 × hronično i predlog bi doveka sekao oporavljenog trkača na 30% plana.
       Uhvatila ga je zamka „lestvica se ipak ZAVRŠI". Granica ostaje po prozoru,
       ne po ostatku prozora. */
    const acwrP = (hronP != null && planiranoP > 0)
      ? Math.min(1, hronP*ACWR_MAX/planiranoP) : 1;
    /* Faktor je strože od dva: procenat lestvice i ACWR granica. U četvrtoj
       fazi i kod prekida bez bola procenta nema (pct:1), pa ostaje čist ACWR —
       i time se povratak sam završava kad hronično opterećenje sustigne plan. */
    const pct = ph ? ph.pct : 1;
    /* POD: povratak posle prekida ne sme da IDE NANIŽE.
       Bez ovoga se dobija spirala, i to merljiva: predlog se računa od proseka
       poslednje 4 nedelje, a svaki rez taj prosek dodatno spušta, pa sledeći
       predlog bude još manji. Posle dve nedelje pauze na planu od 55 km/ned
       izmereno je 22.6 → 12.9 → 12.6 km, pa tek onda oporavak — čovek koji se
       vratio biva spušten niže nego prve nedelje povratka.

       Zato pod: nikad manje od najveće nedelje koja je već odrađena otkako je
       prekid prošao. Prva nedelja povratka je i dalje slobodna (tada je taj
       broj nula, jer se u prozoru nije trčalo), a posle nje povratak može samo
       da stoji ili raste.

       SAMO ZA PREKID, ne i posle bola: tamo je spuštanje ISPOD trenutnog obima
       cela poenta lestvice (50% od punog plana), pa bi isti pod poništio
       zaštitu čoveku koji je posle unosa bola nastavio da trči. */
    const podP = ph ? 0 : (planiranoP > 0 ? Math.min(1, najveciNedeljniObim(today, 14)/planiranoP) : 0);
    /* Bez kvaliteta: posle bola prve dve nedelje lestvice; posle prekida bez
       bola kad se nije trčalo dovoljno dugo da je detrening merljiv. */
    const bezKvaliteta = ph
      ? (ph.week <= 2)
      : (pz.bezTrcanja != null && pz.bezTrcanja >= PREKID_BEZ_KVALITETA);
    const razlog = ph ? ' km — povratak posle povrede' : ' km — povratak posle prekida';
    const changes = [];
    for(const x of daniP){
      const d = x.d, date = x.date;
      /* KLJUČNO: računa se od ORIGINALNE kilometraže (origKm), ne od trenutne.
         Inače bi drugi put dalo 70% od već smanjenih 50% = 35%. */
      const baseKm = x.baseKm;
      const newKm = Math.max(2, Math.round(baseKm * Math.max(podP, Math.min(pct, acwrP)) * 10)/10);
      if(newKm >= baseKm) continue;
      const origTag = d.origTag || d.tag;
      const toTag = (bezKvaliteta && (origTag === 'int' || origTag === 'tempo')) ? 'lako' : origTag;
      changes.push({ id:d.id, date, from:d.tag, to:toTag, km:newKm,
        desc: (toTag === 'lako' ? 'Lagano ' : '') + fmtKm(newKm) + razlog });
    }
    if(!changes.length) return null;
    /* Ono što je stvarno primenjeno — može biti podignuto podom, pa se ne sme
       pisati sirov `acwrP` (poruka bi obećala manje nego što predlog radi). */
    const stvarni = Math.max(podP, Math.min(pct, acwrP));
    if(!ph) return {
      level: 'pauza', week: null, pct: stvarni, maxPain: null, parts: [], changes,
      title: 'Povratak posle prekida',
      message: (pz.bezTrcanja != null && pz.bezTrcanja >= 3
                  ? 'Bez trčanja ' + pz.bezTrcanja + ' ' + (pz.bezTrcanja === 1 ? 'dan' : 'dana') + '. '
                  : 'U poslednje ' + PREKID_PROZOR + ' dana odrađeno je ' + Math.round(pz.ostvarenost*100) + '% planiranog obima. ') +
        'Plan od sledeće nedelje traži više nego što telo trenutno nosi: prosek stvarno odrađenog u poslednje 4 nedelje je ' +
        fmtKm(hronP) + ' km/ned, a sledećih 7 dana traži ' + fmtKm(planiranoP) + ' km. ' +
        'Predlog: ' + Math.round(stvarni*100) + '% planiranog obima narednih ' + changes.length + ' treninga' +
        (bezKvaliteta ? ', bez kvalitetnih treninga' : '') +
        '. Predlog se svake nedelje sam podiže i nestaje čim prosek odrađenog sustigne plan; koliko će to trajati zavisi od toga koliko je prekid trajao i koliko plan traži — posle duže pauze u sredini priprema to ume da bude i mesec i po. ' +
        'Ne ide naniže: nikad se ne predlaže manje nego što si već odradio u nedelji pred ovu. ' +
        'Posle dve nedelje bez trčanja pada i forma, ne samo obim; dugo trčanje se zato vraća postepeno kao i sve ostalo.'
    };
    return {
      level: 'return', week: ph.week, pct: ph.pct, maxPain: null, parts: [],
      changes,
      title: ph.week <= 3 ? 'Povratak — nedelja ' + ph.week + ' od 3' : 'Povratak — obim prati oporavak',
      /* PREDUSLOVI: fizioterapeutski protokoli povratka trče se po ODGOVORU
         TKIVA, ne po kalendaru — "nema fiksnog vremenskog okvira, zavisi od
         toga kako tkivo odgovara na opterećenje". Aplikacija ne može da
         izmeri simetriju snage ni test poskoka, pa ih NAVODI kao uslov koji
         korisnik sam proveri, umesto da ćuti i deluje sigurnije nego što jeste. */
      /* „Bez bola" je bilo netačno: prag povratne faze je bol ISPOD 3, pa je
         aplikacija pisala „bez bola 21 dan" i onome ko je danas uneo bol 2. */
      message: 'Bez bola 3+ već ' + ph.daysSince + ' ' + (ph.daysSince === 1 ? 'dan' : 'dana') +
        '. Predlog: ' + (ph.week > 3
            /* Četvrta faza nema svoj procenat — lestvica je prošla, a puni obim
               čeka da ga prosek odrađenog sustigne. Zato se ne pominje nikakav
               „procenat lestvice": jedini razlog za smanjenje je ACWR. */
            ? Math.round(acwrP*100) + '% planiranog obima — tri nedelje lestvice su prošle, ali je prosek stvarno odrađenog u poslednje 4 nedelje ' +
              fmtKm(hronP) + ' km/ned, a sledećih 7 dana traži ' + fmtKm(planiranoP) + ' km. Pun obim se vraća sam čim ga prosek sustigne'
            : acwrP < ph.pct
            ? Math.round(acwrP*100) + '% planiranog obima (lestvica povratka kaže ' + pctTxt +
              ', ali prosek stvarno odrađenog u poslednje 4 nedelje — ' + fmtKm(hronP) + ' km/ned — dozvoljava manje)'
            : pctTxt + ' planiranog obima') +
        ' narednih ' + changes.length + ' treninga' +
        (bezKvaliteta ? ', bez kvalitetnih treninga' : '') +
        '. Pre nego što prihvatiš — proveri da možeš: 30 min brzog hoda bez bola, 20 poskoka na povređenoj nozi bez bola, i da nema bola u mirovanju. Ako bilo šta od toga ne prolazi, rano je za trčanje bez obzira na broj dana. Ostavi bar jedan dan odmora između trčanja.'
    };
  }

  const from = addD(today, -6);
  const recent = bolniZapisi(from, today).filter(k => k.pain>=3);
  if(!recent.length) return null;

  const maxPain = recent.reduce((m,k)=>Math.max(m,k.pain), 0);
  /* koji delovi tela — za poruku, da korisnik vidi na osnovu čega je predlog */
  const parts = [...new Set(recent.map(k=>partName(k.part)))];

  /* Bol 4+ ide na run/walk, bez obzira koliko je jak — plan se ne prazni.
     `hitno` (bol 6+ / status STANI) menja SAMO ton poruke i boju kartice,
     ne i to da li se trči: to je odluka koju čovek donosi sam, uz lekara. */
  const hitno = (st.cls === 'stop');
  const rwS = rwZaBol(maxPain);
  const rw = rwS ? rwS.rw : null;
  /* Horizont je UVEK 7 dana. Ranije 7 za jak bol i 5 za slabiji — a pošto se
     obim računa po danu, jači bol je pokrivao više dana i davao VEĆI ukupan
     obim: bol 6 je davao 19,4 km, bol 5 samo 11 km. Uz to je 7 dana ista mera
     kao nedeljni ACWR budžet, pa se više ne poredi deo nedelje sa celom. */
  const horizon = 7;

  /* NEDELJNI BUDŽET umesto procenta po danu. Sve što se dira deli jedan
     budžet: 0.8 × hronično opterećenje. Bez istorije se pada na ranije
     procente (60% kvalitet / 75% lagano). */
  const hron = hronicniObim(today);
  const budzet = hron != null ? Math.round(hron * ACWR_POVRATAK * 10)/10 : null;

  /* Prvo skupi dane koje diramo, pa tek onda podeli budžet — inače se ne zna
     na koliko treninga se deli. */
  const dani = [];
  for(let i=0; i<horizon; i++){
    const date = addD(today, i);
    const d = BY_DATE[date];
    if(!d || d.rest) continue;
    /* Dan trke se NIKAD ne menja automatski — to je odluka koju čovek
       donosi sam, ne algoritam nedelju dana ranije. */
    if(d.tag === 'trka' || d.tag === 'test') continue;
    /* Snaga ostaje — nije udarno opterećenje na isti način kao trčanje. */
    if(d.tag === 'snaga') continue;
    dani.push({ d, date });
  }

  /* Udeo se računa od ORIGINALNE kilometraže — inače bi drugi poziv smanjivao
     već smanjeno (ista zamka koju povratna faza već izbegava kroz origKm). */
  const baza = x => (x.d.origKm != null ? x.d.origKm : x.d.km) || 0;
  const planirano = dani.reduce((s,x)=>s+baza(x), 0);

  /* DVA OGRANIČENJA, UZIMA SE STROŽE.
     1. Smanjenje po jačini bola — koliko se skida od planiranog. To je
        klinički deo: bol određuje koliko se opterećenje spušta.
     2. ACWR granica — koliko se SME ukupno, bez obzira na plan. Sprečava da
        ambiciozan plan prođe samo zato što je procenat od njega „mali".
     Ranije je postojalo samo (1), i to sa istim brojem za svakoga. Sam ACWR
     kao jedini kriterijum takođe ne valja: kad je plan već ispod hroničnog
     proseka, faktor ispadne 1 i bol ne bi promenio ništa.

     Budžet se svodi na dužinu horizonta (5 ili 7 dana), da se nedeljna mera
     ne poredi sa delom nedelje. */
  const budzetHor = budzet != null ? budzet * horizon/7 : null;
  const acwrFaktor = (budzetHor != null && planirano > 0) ? Math.min(1, budzetHor/planirano) : 1;

  const changes = [];
  for(const x of dani){
    const d = x.d, oldKm = baza(x);
    const isQuality = (d.tag==='int' || d.tag==='tempo' || d.tag==='lr');
    /* Udeo planiranog obima raste kako bol pada: 25% na 9–10, 65% na 4.
       Protokoli povratka na trčanje polaze od ~50% uobičajenog obima; ovde je
       niže na jakom bolu, jer je i sam trening pretežno hod. */
    const bolFaktor = rwS ? rwS.obim : (isQuality ? 0.6 : 0.75);
    const faktor = Math.min(bolFaktor, acwrFaktor);
    let newKm = oldKm ? Math.max(2, Math.round(oldKm*faktor*10)/10) : null;
    if(newKm != null && newKm > oldKm) newKm = oldKm;    /* nikad naviše */
    /* Bez run/walk-a, lagan dan koji se ne menja nema šta da prijavi. Sa
       run/walk-om ima — menja se NAČIN trčanja, ne samo obim. */
    if(!rw && !isQuality && newKm === oldKm) continue;
    const kmTxt = newKm != null ? fmtKm(newKm)+' km' : '';
    changes.push({ id:d.id, date:x.date, from:d.tag, to:'lako', km:newKm, rw:rw||null,
      desc: rw
        ? 'Run/walk ' + kmTxt + ' — ' + runWalkText(rw) + ', zbog bola ' + maxPain + '/10'
        : 'Lagano ' + kmTxt + ' — smanjeno zbog bola ' + maxPain + '/10' });
  }

  /* TRKA U HORIZONTU — kad se ništa ne menja, mora bar da se KAŽE.
     Dan trke se namerno nikad ne menja automatski (v. `continue` gore): skratiti
     ili obrisati trku nije odluka algoritma. Ali iz „ne menjaj" je ispalo
     „ne pominji": pošto se trkački dan preskoči, na sam dan trke `changes`
     ostane prazan, funkcija vrati `null`, i kartica se uopšte ne iscrta.

     Izmereno na sve četiri distance, bol 7/10 tri dana pred trku: tab Oporavak
     tog jutra piše „STANI", tab Danas piše trku na ciljnom tempu, i ništa ne
     povezuje to dvoje — baš na dan kad je odluka najskuplja.

     Zato: ako je status „stani" i u horizontu postoji dan trke, vraća se predlog
     i sa praznim `changes`, sa porukom koja imenuje trku i njenu distancu i
     izričito kaže da je odluka korisnikova. Ne menja se ništa — samo se ne ćuti. */
  let trka = null;
  if(hitno){
    for(let i=0; i<horizon; i++){
      const d = BY_DATE[addD(today, i)];
      if(d && d.tag === 'trka'){ trka = { date:addD(today,i), km:d.km, dana:i }; break; }
    }
  }
  if(!changes.length && !trka) return null;

  const trkaTxt = trka
    ? ' TRKA: ' + fmtKm(trka.km) + ' km ' + (trka.dana === 0 ? 'DANAS' : 'za ' + trka.dana + ' ' + (trka.dana === 1 ? 'dan' : 'dana')) +
      '. Plan trke se ne menja sam — to je tvoja odluka, i aplikacija je ne donosi umesto tebe. Ali bol ' + maxPain +
      '/10 nosi status STANI, a startovati sa aktivnim bolom koji ovih dana nije dozvoljavao ni neprekidno trčanje nije isto što i startovati umoran. Ako ideš, znaj da ideš na to; ako sumnjaš, pitaj fizijatra pre starta.'
    : '';
  if(!changes.length) return {
    level: 'trka', hitno, maxPain, parts, changes: [], rw, hron, budzet, trka,
    title: st.t,
    message: 'Bol ' + maxPain + '/10 (' + parts.join(', ') + ').' + trkaTxt
  };

  const ukupno = changes.reduce((s,c)=>s+(c.km||0), 0);
  const obimTxt = ' Obim narednih ' + changes.length + ' treninga: ' + fmtKm(ukupno) + ' km umesto ' + fmtKm(planirano) + ' km'
      + (hron != null ? ' (prosek stvarno odrađenog u poslednje 4 nedelje: ' + fmtKm(hron) + ' km/ned).' : '.');
  /* Bol koji ne nosi trčanje se NE prećutkuje — samo ne prepisuje plan. */
  const ostalo = nenosiviBol(from, today);
  const ostaloTxt = ostalo
    ? ' Prijavljen je i bol ' + ostalo.max + '/10 (' + ostalo.delovi.join(', ') + ') — to ne menja plan trčanja, ali ga ne zanemaruj.'
    : '';

  return {
    level: rw ? 'runwalk' : 'warn', hitno,
    maxPain, parts, changes, rw, hron, budzet,
    title: st.t,
    /* Poruka je namerno različita po ozbiljnosti — plan se prilagođava, ali
       app NE glumi da je jak bol rešen kraćim trčanjem. */
    message: (rw
      ? 'Bol ' + maxPain + '/10 (' + parts.join(', ') + '). Neprekidno trčanje je prerano: narednih ' + changes.length + ' treninga ide po run/walk metodi — ' + runWalkText(rw) + '. Hod prekida udarno opterećenje, pa tkivo dobija ciklus opterećenje–rasterećenje umesto neprekidnog rada.' + obimTxt + ' Neprekidno trčanje se vraća kad bol padne ispod ' + RW_BOL_MIN + '.'
        + (hitno ? ' Bol ' + maxPain + '/10 je ozbiljan — ovo je prilagođavanje TRENINGA, ne lečenje. Ako te boli u mirovanju, ako šepaš ili ako bol ne popušta, ne trči ni ovoliko i javi se fizijatru ili lekaru.' : ' Ako bol poraste, prekini i javi se stručnjaku.')
      : 'Bol ' + maxPain + '/10 (' + parts.join(', ') + '). Predlog: kvalitetni treninzi postaju lagani, obim smanjen narednih ' + changes.length + ' treninga.' + obimTxt + ' Ako bol poraste na ' + RW_BOL_MIN + '+, prelazi se na run/walk.'
    ) + ostaloTxt + trkaTxt
  };
}

/* Primeni predlog. Odvojeno od injuryProposal() namerno — predlog se može
   prikazati i odbiti bez ikakve izmene stanja. */
function applyInjuryProposal(prop){
  if(!prop || !prop.changes || !prop.changes.length) return 0;
  let n = 0;
  prop.changes.forEach(ch => {
    const d = BY_ID[ch.id];
    if(!d) return;
    const r = setAlt(ch.id, { tag: ch.to, km: ch.km, desc: ch.desc, rw: ch.rw||null });
    if(r && r.ok) n++;
  });
  if(n){ rebuildDateIndex(); save(); }
  return n;
}

/* Zona direktno iz PRED reda oznake (r.l = 'NX · Tip') — POUZDANIJE od
   dan->sessKind puta: tvoj hardkodovan plan ima generičan d.tag (samo
   'tempo'/'int'), pa bi npr. "Ritam" (ciljna-tempo proba, mora ostati na
   Riegel/race-ekvivalentnoj logici) i "Tempo" (submaksimalan, mora na zonu T)
   preko istog dana kolabirali u isti sessKind — oznaka PRED reda tu razliku
   već nosi tačno (nađeno testom: p18 "Ritam" bio pogrešno zona-mapiran kroz
   dan-lookup jer taj dan ima generičan tag:'tempo'). Radi identično za oba
   tipa plana — generisan plan takođe piše tip u l preko predRow(). */
function zoneForPredRow(r){
  if(!r||!r.l)return null;
  const tip=r.l.split(' · ')[1];
  return tip!=null?ZONE_FOR_KIND[tip]:null;
}

/* ============================================================
   TEST NA 3 KM — najpouzdaniji ulaz u lanac forme

   ŠTA KAŽE NAUKA. Daniels–Gilbertova VDOT formula je izvedena za MAKSIMALNE
   trkačke napore i najtačnija je na trkama koje traju otprilike 10–30 minuta.
   Kraće od toga presudno zavisi od anaerobnog doprinosa, koji VDOT ne meri;
   duže od toga sve više zavisi od UDELA VO2max-a koji se može održati i od
   ekonomije trčanja, a sve manje od samog VO2max-a. Trka na 3 km za trkača
   ovog nivoa traje ~11–13 min — dakle tačno u sredini tog prozora. Zato je
   test na 3 km najbolji jednokratni pokazatelj forme koji čovek može sam da
   izvede, i zato mu se ovde veruje više nego bilo kojoj trenažnoj sesiji.

   ZAŠTO DIREKTNO IZ 3000 m. VDOT se računa `vdotFromRace(3000, vreme)`, bez
   međukoraka preko Riegelovog 5K ekvivalenta: svaki prevod dodaje grešku, a
   ovde ga nema potrebe praviti — formula prima distancu i vreme kakvi jesu.
   Predikcija ciljne distance se posle izvodi iz tog VDOT-a (`raceTimeForVdot`),
   isto kao za svaku drugu sesiju, pa se dva broja na istom ekranu ne mogu
   razići.

   ZAŠTO ODVOJENO OD S.pred. Kvalitetne sesije su vezane za dan plana; test se
   može istrčati kad god, više puta, i na generisanom planu koji nema test-dan.
   Zato test živi u S.t3k i u lanac ulazi preko sopstvenog ID-ja.
   ============================================================ */
function t3kNiz(){
  return (S.t3k||[]).filter(t=>t&&t3kMoguc(t.sec)&&validanDatum(t.date))
                    .slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
}
function t3kVdot(sec){
  if(!(sec>0)) return null;
  const v=r1(vdotFromRace(T3K_DIST_M,sec));
  return vdotMoguc(v)?v:null;
}
/* Upis testa u lanac forme. NE ide kroz recordVdot: ta funkcija računa VDOT iz
   TEMPA i zone kvalitetne sesije, a ovde je reč o trci na 3000 m — VDOT se iz
   nje dobija direktno, bez prevoda na tempo i nazad. Rep je isti: čuva se samo
   izmereno, a lanac se prera­čunava iz njega. */
function zabeleziT3k(id, sec, datum){
  const measured=t3kVdot(sec);
  if(measured==null) return null;
  S.vdotLog=S.vdotLog||[];
  const ix=S.vdotLog.findIndex(e=>e&&e.id===id);
  const entry={id, ts:datum, measured, vdotMigrated:true};
  if(ix>=0) S.vdotLog[ix]=entry; else S.vdotLog.push(entry);
  preracunajVdotLog();
  return (S.vdotLog.find(e=>e&&e.id===id)||entry);
}
function dodajT3k(datum, sec){
  const s=Math.round(sec);
  /* Nemoguć test se NE upisuje ni u listu. Da se upisao a samo ne bi ušao u
     lanac, stajao bi na kartici kao da je priznat i čovek bi se pitao zašto
     ništa ne radi. */
  if(!t3kMoguc(s)) return null;
  S.t3k=S.t3k||[];
  const id=T3K_PREFIX+datum+'-'+Math.random().toString(36).slice(2,7);
  S.t3k.push({id, date:datum, sec:s});
  zabeleziT3k(id, s, datum);
  save();
  return id;
}
function obrisiT3k(id){
  S.t3k=(S.t3k||[]).filter(t=>t&&t.id!==id);
  S.vdotLog=(S.vdotLog||[]).filter(e=>e&&e.id!==id);
  preracunajVdotLog();   /* uklonjen test ne sme da ostane u lancu */
  save();
}
/* Test kao red predikcije. Nedelja se traži po datumu da bi tačka pala na
   pravo mesto na grafikonu „predikcija kroz plan"; test van plana pada na
   najbližu ivicu, jer bi bez nedelje ispao iz grafikona sasvim. */
function t3kNedelja(datum){
  const w=weekOf(datum);
  if(w) return w.w;
  return datum<CUR_START ? 1 : CUR_PLAN.length;
}
function t3kRedovi(){
  return t3kNiz().map(t=>({
    id:t.id, w:t3kNedelja(t.date), l:'Test 3 km · '+fmtD(t.date),
    q:T3K_DIST_M/1000, pt:Math.round(t.sec/(T3K_DIST_M/1000)),
    test3k:true, sec:t.sec, date:t.date
  }));
}

function predCalc(){
  /* ISTI princip kao recordVdot popravka: direktan riegel(tempo,q) tretira
     UNET tempo kao da JE trka (max napor). Za Tempo sesije (namerno
     submaksimalne, ~88% VO2max) ovo sistematski PREOCENJUJE vreme (predviđa
     GORE nego što stvarno jeste), dok Intervali (blizu 100%) ostaju tačni —
     naizmenično Tempo/Intervali na IDENTIČNOJ formi je pravilo cik-cak
     22:20/20:10/22:20... (potvrđeno testom), ne stvarnu nedeljnu oscilaciju.
     Ispravka: prvo ispravan VDOT (zona-svesno), TEK ONDA vreme iz tog VDOT-a. */
  const raceDistM=raceDistActive();   /* ista vrednost je ranije bila prepisana rukom i ovde i u raceDistActive() */
  const rows=CUR_PRED.map(r=>{
    const a=S.pred[r.id];
    let pred=null;
    /* `nemeri` redovi (aktivacija pred trku) nose tempo, ali ne i predikciju:
       bez ovoga bi ih sirov račun — rezerva za redove bez zapisa u lancu —
       ipak ucrtao, i to kao najgoru tačku u celom planu, tri dana pred trku. */
    if(a && !r.nemeri){
      const zone=zoneForPredRow(r);
      /* PREDIKCIJA IDE IZ IZGLACANOG VDOT-a, ne iz jedne sesije.
         Kartica "Trenutna forma" prikazuje izglacan lanac, a predikcija je
         racunala VDOT iz SAMO te sesije — pa su dva broja na istom ekranu
         govorila razlicito. Mereno: posle jednog tempa na vrucini (4:45
         umesto 4:22) kartica se pomeri 48.4 -> 46.4, a predikcija skoci
         20:32 -> 22:26. Jedan vruc dan ne oduzima dva minuta na 5K.
         Sirov racun ostaje kao rezerva za redove koji nemaju zapis u lancu
         (rucno upisan tempo bez zabelezene sesije). */
      const e=(S.vdotLog||[]).find(x=>x&&x.id===r.id);
      const v=(e&&e.vdot!=null&&isFinite(e.vdot)) ? e.vdot
            : (zone!=null ? vdotFromPace(a,zone) : null);
      pred = v!=null ? raceTimeForVdot(v,raceDistM)
                     : Math.round(riegelDist(a*r.q,r.q*1000,raceDistM));
    }
    return {r,a,pred};
  });
  /* TESTOVI NA 3 km ULAZE U ISTU PREDIKCIJU. Bez ovoga bi najtačnije merenje
     forme koje čovek ima bilo jedino koje se ne vidi ni u „zadnjoj" ni u
     „najbržoj" predikciji. Stoje u ZASEBNOM nizu, ne u `rows`, zato što
     chartPred crta `rows` po INDEKSU naspram CUR_PRED — ubacivanje bi pomerilo
     svaku tačku grafikona za jedno mesto. */
  const testovi=t3kRedovi().map(r=>{
    const e=(S.vdotLog||[]).find(x=>x&&x.id===r.id);
    const v=(e&&e.vdot!=null&&isFinite(e.vdot)) ? e.vdot : t3kVdot(r.sec);
    return {r, a:r.pt, pred: v!=null?Math.round(raceTimeForVdot(v,raceDistM)):null};
  });
  const uneti=rows.filter(x=>x.pred!=null);
  const entered=uneti.concat(testovi.filter(x=>x.pred!=null));
  /* "ZADNJA predikcija" mora biti HRONOLOŠKI najnovija (po stvarnom datumu
     unosa), ne poslednja PO REDOSLEDU NEDELJA plana — entered[entered.length-1]
     je bio čisto pozicijski (bio bi pogrešan da bilo koji kasnije-nedeljni red
     ima unos van redosleda, npr. test/TT dan unet pre redovnog rasporeda). */
  const tsFor=id=>{ const e=(S.vdotLog||[]).find(x=>x.id===id); return e?e.ts:null; };
  const najnoviji=niz=>niz.length
    ? niz.reduce((m,x)=>{ const tm=tsFor(m.r.id), tx=tsFor(x.r.id); return (tx&&(!tm||tx>tm))?x:m; }, niz[0])
    : null;
  const last=najnoviji(entered);
  const best=entered.length?entered.reduce((m,x)=>x.pred<m.pred?x:m):null;
  /* `lastRed` je isto to, ali SAMO među redovima plana: crvena linija na
     grafikonu staje na njemu, a test nema svoje mesto na toj osi. */
  return{rows,testovi,entered,last,best,lastRed:najnoviji(uneti)};
}
/* ===== VDOT rekalibracija forme ===== */
function currentVdot(){
  const vl=S.vdotLog||[];
  return vl.length?vl[vl.length-1].vdot:null;
}
/* ============================================================
   REFERENTNE VREDNOSTI AKTIVNOG PLANA (početni VDOT / ciljni VDOT / ciljno
   vreme / ciljna distanca). Ranije su sve četiri bile TVRDO KODOVANE na
   vlasnikov 5K (PB 20:37 = 1237 s, cilj 19:30 = 1170 s) i primenjivale se i
   na generisan plan za drugu osobu i drugu distancu. Posledice izmerene
   testom na maratonskom planu (PB 3:45):
     - prvi zabeležen VDOT se glačao od TUĐEG baseline-a 48.1 umesto 41.0
       (recordVdot: prev = baselineVdot()) → greška +4.2 poena, koja se
       potom vuče kroz celu istoriju;
     - AI trend analiza je dobijala pogrešan `cilj`;
     - Predikcija grafikon je crtao maratonska vremena (220-231 min) na osi
       17.8-22.8 min → sve tačke klemovane u ravnu liniju uz gornju ivicu.
   Sve potrebno već postoji u S.genPlan.meta (assess() ga puni) — samo se
   nije koristilo. Za hardkodovan plan vraćaju IDENTIČNE stare vrednosti.
   ============================================================ */
function baselineVdot(){ /* početni VDOT: iz PB-a aktivnog plana */
  const m=S.genPlan&&S.genPlan.meta;
  if(m&&m.vdot0!=null&&isFinite(m.vdot0))return m.vdot0;
  return Math.round(vdotFrom5k(1237)*10)/10;   /* tvoj PB 20:37 */
}
function goalVdotActive(){ /* ciljni VDOT: eksplicitan cilj ima prednost nad projekcijom */
  const m=S.genPlan&&S.genPlan.meta;
  if(m){
    if(m.goalVdot!=null&&isFinite(m.goalVdot))return m.goalVdot;
    if(m.vdotGoal!=null&&isFinite(m.vdotGoal))return m.vdotGoal;
  }
  return Math.round(vdotFrom5k(1170)*10)/10;   /* tvoj cilj 19:30 */
}
function goalSecActive(){ /* ciljno VREME na ciljnoj distanci (sec) */
  const m=S.genPlan&&S.genPlan.meta;
  if(m){
    if(m.goalSec!=null&&isFinite(m.goalSec))return m.goalSec;
    if(m.predictedSec!=null&&isFinite(m.predictedSec))return m.predictedSec;
    return null;
  }
  return 1170;
}
function raceDistActive(){
  return (S.genPlan&&S.genPlan.meta&&S.genPlan.meta.raceDistM)||5000;
}
/* Zabeleži VDOT iz kvalitetne sesije. Vraća {vdot, prev, delta, dir} ili null.
   Prigušenje: jedna sesija je šum — pomeramo VDOT samo delimično ka izmerenom. */
/* Koliko sme da odstupi AUTOMATSKI izmeren tempo od trenutne forme, u VDOT
   poenima, da bi mu se verovalo. Jedna sesija ne moze posteno da pokaze pad
   od 4+ poena — to je greska u prepoznavanju radnih deonica, ne pad forme.
   Vazi SAMO za automatiku; rucno unet tempo je korisnikova izricita tvrdnja
   i uvek se prihvata. */
const AUTO_VDOT_TOL=4;
function recordVdot(predId, paceSec, dateOverride, kind, auto, dan){
  const r=CUR_PRED.find(x=>x.id===predId);
  if(!r||!paceSec)return null;
  /* Provera `nemeri` je NIŽE, posle provera verodostojnosti tempa — vidi tamo. */
  /* Zona: PRVENSTVENO iz PRED reda oznake (pouzdanije, v. zoneForPredRow),
     kind-parametar je fallback za pozivaoce koji (još) ne prosleđuju r.
     IZUZETAK — RUCNO PROMENJEN TIP DANA. Predikcijski red nosi naziv iz plana
     ("N5 · Intervali"), a korisnik je taj dan prebacio u Tempo jer je sesija
     to i bila. Zona mora da prati ono sto je sesija STVARNO bila, ne kako se
     red zove. Mereno: OverUnder 3x2 km (500 m @4:00 + 500 m @4:20) odradjen
     prosecno 4:09 — kao interval to je VDOT 45.2 (pad), kao tempo 51.4 (rast).
     Tempo od 4:09 na pragu je brzo; isti tempo kao VO2max interval je sporo.
     Ovde je korisnikova oznaka jedini pouzdan podatak o tome sta je radio. */
  let zone=zoneForPredRow(r);
  if(dan && dan.origTag && dan.origTag!==dan.tag && kind!=null && ZONE_FOR_KIND[kind])
    zone=ZONE_FOR_KIND[kind];
  if(zone==null && kind!=null) zone=ZONE_FOR_KIND[kind];
  const measured=zone!=null
    ? Math.round(vdotFromPace(paceSec,zone)*10)/10
    : Math.round(vdotFromQuality(paceSec,r.q)*10)/10;
  /* Tempo van opsega tablice nije merenje forme nego omaška u kucanju ili loše
     prepoznata deonica. Gleda se ZASIĆENJE, ne sama vrednost: pretraga bi
     2:00/km vratila kao tačno 85 i provera po vrednosti bi to propustila kao
     „svetski vrh". Odbija se i kad je tempo unet ručno — ručni unos jeste
     korisnikova izričita tvrdnja, ali tvrdnja da je trčao brže nego što tablica
     uopšte poznaje nije tvrdnja o formi. */
  if(zone!=null && !vdotPaceUOpsegu(paceSec,zone)) return null;
  if(!vdotMoguc(measured)) return null;
  /* SESIJA KOJA NE MERI FORMU (aktivacija pred trku, sesije iz KIND_IZ_CILJA):
     propis joj je izveden iz cilja, ne iz rampe, pa se iz njega ne sme čitati
     forma. Ali NIJE ista stvar „merenje nije verodostojno" i „ova sesija se po
     projektu ne meri", a do sada su obe vraćale `null` — pa je `upisiAutoTempo`
     odustajao pre upisa i lepio poruku „ne odgovara tvojoj formi, verovatno su
     u prosek ušla kaskanja". Za tempo koji je IDENTIČAN propisu ta rečenica je
     bila neistinita u oba dela.

     Merenjem, sesija odrađena tačno po propisu i uneta sa sata: automatski put
     je gubio SVE takve tempe (5K 3/3, 10K 4/4, PM 7/7, maraton 11/11), dok ih je
     ručni unos svih uredno upisivao. Na maratonu je to trećina kvalitetnih
     sesija — i to baš maratonski tempo, jedina sesija koja odgovara na pitanje
     „mogu li da držim ciljni ritam".

     Zato se sada vraća RAZLOG umesto `null`. Provere verodostojnosti tempa
     (zasićenje tablice, moguć VDOT) su NAMERNO iznad ovoga i i dalje važe —
     besmislen tempo se ne upisuje ni ovde. Preskače se samo poređenje sa formom
     (`AUTO_VDOT_TOL`), koje za propis izveden iz cilja i nema smisla: upravo ono
     je pravilo onu protivrečnost da isti broj sa sata bude odbijen, a otkucan
     rukom prihvaćen. */
  if(r.nemeri) return { nemeri:true, measured };
  /* AUTOMATSKI IZMEREN TEMPO KOJI NE DRZI VODU SE ODBACUJE.
     Izmereno na stvarnom slucaju: dan rucno prebacen u Tempo, trening
     OverUnder 3x2km (500m @4:00 + 500m @4:20) sa 2 min kaskanja izmedju.
     Prepoznavanje radnih deonica je u prosek uvuklo i kaskanja i dalo oko
     4:48/km, sto u T zoni znaci VDOT ~42.9 — pa je VDOT pao sa 48.6 na 46.3
     zbog treninga koji je zapravo bio dobar. Korisnik pritom nije uneo
     nikakav tempo i nije imao kako da vidi odakle pad. */
  if(auto){
    const forma=currentVdot()!=null?currentVdot():baselineVdot();
    if(forma!=null && Math.abs(measured-forma)>AUTO_VDOT_TOL) return null;
  }
  /* Cuva se SAMO izmereno; lanac se posle racuna iz njega (v. preracunajVdotLog). */
  S.vdotLog=S.vdotLog||[];
  const ix=S.vdotLog.findIndex(e=>e.id===predId);
  const entry={id:predId, ts:dateOverride||TODAY, measured};
  if(ix>=0) S.vdotLog[ix]=entry; else S.vdotLog.push(entry);
  preracunajVdotLog();
  const e=S.vdotLog.find(x=>x.id===predId) || entry;
  return {vdot:e.vdot, prev:e.prev, delta:e.delta,
          dir: e.delta>0.05?'up':e.delta<-0.05?'down':'flat', measured};
}
/* Upis AUTOMATSKI izmerenog tempa. Ako ga recordVdot odbije kao nepouzdan,
   ne upisuje se ni u Predikciju — polovicno stanje (tempo bez VDOT-a) bi bilo
   gore od praznog. Dan se obelezi, pa kartica treninga moze da kaze zasto je
   prazan i pozove na rucni unos. */
function upisiAutoTempo(pid, paceSec, datum, d){
  const r=recordVdot(pid, paceSec, datum, sessKind(d), true, d);
  /* „Ne meri formu" NIJE „nije verodostojno". Tempo se upisuje i prikazuje kao
     i sa ručnog unosa; jedino ne ulazi u lanac forme. Nosilac te razlike je
     `recordVdot`, koji za takvu sesiju vraća RAZLOG umesto `null` — dok je
     vraćao `null`, automatski put je gubio ceo trag o sesijama na tempu trke i
     uz to lepio poruku koja optužuje merenje da je pogrešno.

     Grana ispod danas radi tačno ono što bi i propadanje kroz `if(!r)` uradilo,
     i to je namerno napisano ovako: bez nje se na ovom mestu ne vidi da postoji
     ishod „nije greška, a nije ni merenje". Ako se ispod nje ikad doda nešto što
     važi samo za prava merenja (zaključavanje, upis u lanac), razlika prestaje
     da bude kozmetička. Zamku nosi `recordVdot`, ne ova grana. */
  if(r && r.nemeri){
    S.pred[pid]=paceSec;
    if(S.log[d.id]) delete S.log[d.id].autoOdbijen;
    return true;
  }
  if(!r){ if(S.log[d.id]) S.log[d.id].autoOdbijen=paceSec; return false; }
  S.pred[pid]=paceSec;
  if(S.log[d.id]) delete S.log[d.id].autoOdbijen;
  return true;
}
/* PRERACUN CELOG LANCA VDOT-a IZ IZMERENIH VREDNOSTI.

   Ranije se prigusenje racunalo u trenutku unosa, nad `currentVdot()` — a to je
   POSLEDNJI element niza, ne prethodna sesija po datumu. Dve posledice, obe je
   korisnik osetio:

   1) PONOVNI UNOS ISTIH PODATAKA JE DIZAO VDOT. Ponovni upis je racunao
      prigusenje od rezultata SOPSTVENOG prethodnog upisa, pa je svaki put
      preslo jos 40% preostalog puta ka izmerenom: 48.1 -> 50.1 -> 51.3 -> 52.0.
      Isti podaci, a VDOT skoci skoro 2 poena.
   2) REDOSLED SE KVARIO. Ispravka starije sesije bi je gurnula na kraj niza i
      time je proglasila najnovijom.

   Sada je VDOT ciste funkcija izmerenih vrednosti i njihovih datuma: sortira se
   po datumu i lanac se racuna od pocetnog VDOT-a. Ponovni unos istih podataka
   daje IDENTICAN rezultat, a ispravka starije sesije prepravlja i sve posle nje.
   Zapisi bez `measured` (stari backup) se ne diraju — nose svoj vdot dalje. */
function preracunajVdotLog(){
  const niz=(S.vdotLog||[]).slice().sort((a,b)=>{
    const A=String(a&&a.ts||''), B=String(b&&b.ts||'');
    if(A!==B) return A<B?-1:1;
    return String(a&&a.id||'')<String(b&&b.id||'')?-1:1;   /* stabilno pri istom datumu */
  });
  let tekuci=baselineVdot();
  niz.forEach(e=>{
    if(!e) return;
    /* NEMOGUĆE MERENJE SE PRESKAČE, ne prigušuje.
       Prigušenje deli razliku sa prethodnim, pa i besmislica ostavi trag:
       izmereno 89 sa alfom 0,60 pomeri formu sa 48,6 na 73,5 i tu je ostavi
       zauvek, jer se lanac odatle nastavlja. Zapis koji je već u stanju (star
       backup, sinhronizacija sa servera) mora da bude neškodljiv i pre nego
       što ga migracija očisti — v. VDOT_MOGUC_MIN. */
    if(e.measured!=null&&isFinite(e.measured)&&!vdotMoguc(e.measured)){
      e.vdot=tekuci; e.prev=tekuci; e.delta=0; e.nemoguce=true;
      return;
    }
    /* Zapis bez `measured` (star oblik) nosi samo gotov `vdot` — uzima se
       kakav jeste, ali i on mora da bude moguć. */
    if(e.measured==null||!isFinite(e.measured)){ if(vdotMoguc(e.vdot))tekuci=e.vdot; return; }
    const prev=tekuci;
    const p=prigusiVdot(prev, e.measured, tipSesijeZaVdot(e.id));
    e.prev=prev; e.vdot=p.vdot; e.alpha=p.alpha; e.delta=Math.round((p.vdot-prev)*10)/10;
    tekuci=p.vdot;
  });
  S.vdotLog=niz;
  return niz;
}
/* Uskladi datume VDOT istorije sa PRAVIM datumima trčanja (runDate iz Strave).
   VDOT unosi nastali pre v20 nose datum sinhronizacije umesto datuma trčanja,
   a sync ih ne prepravlja (preskače već povučene treninge radi štednje kvote).
   Ovo ih ispravi direktno: id sesije -> dan u planu -> runDate. Idempotentno. */
function fixVdotDates(){
  if(!Array.isArray(S.vdotLog)||!S.vdotLog.length)return false;
  const p2d={};
  DATED.forEach(d=>{ predRowsFor(d).forEach(pid=>{ if(!(pid in p2d))p2d[pid]=d.id; }); });
  let changed=false;
  S.vdotLog.forEach(e=>{
    const did=p2d[e.id]; if(!did)return;
    const l=S.log[did]; if(!l)return;
    const real=l.runDate||null;
    if(real&&e.ts!==real){ e.ts=real; changed=true; }
  });
  /* datumi su se pomerili -> promenio se i redosled, pa i ceo lanac */
  if(changed) preracunajVdotLog();
  return changed;
}
/* Prekalkuliše POSTOJEĆU VDOT istoriju sa ispravnom, zona-svesnom formulom
   (vdotFromPace umesto Riegel-a — v. ZONE_FOR_KIND komentar). BEZ ovoga bi
   ispravka važila samo za NAREDNE sesije, a već zabeležena "haotična" istorija
   (npr. tempo na RPE 6-7 pogrešno tretiran kao svoj-maksimalan trka rezultat)
   bi ostala pogrešno prikazana. Idempotentno (e.vdotMigrated flag) — bezbedno
   pozvati na SVAKOM startu, isti obrazac kao fixVdotDates. Original ostvaren
   tempo je već trajno sačuvan u S.pred[predId], pa se ništa ne gubi. */
function recomputeVdotZones(){
  if(!Array.isArray(S.vdotLog)||!S.vdotLog.length)return false;
  const sorted=S.vdotLog.slice().sort((a,b)=>(a.ts||'')<(b.ts||'')?-1:(a.ts||'')>(b.ts||'')?1:0);
  let changed=false, prevVal=baselineVdot();
  sorted.forEach(e=>{
    if(!e.vdotMigrated){
      const paceSec=S.pred[e.id];
      const rr=CUR_PRED.find(x=>x.id===e.id);
      const zone=rr?zoneForPredRow(rr):null;
      if(paceSec!=null && rr){
        const measured=zone!=null ? r1(vdotFromPace(paceSec,zone)) : r1(vdotFromQuality(paceSec,rr.q));
        const smoothed=r1(prevVal+(measured-prevVal)*0.4);
        const delta=r1(smoothed-prevVal);
        if(e.measured!==measured||e.vdot!==smoothed){ e.measured=measured; e.prev=prevVal; e.vdot=smoothed; e.delta=delta; changed=true; }
      }
      e.vdotMigrated=true; changed=true; /* obeleži obrađeno čak i kad nema paceSec/PRED reda (siroče) — ne pokušavaj ponovo svaki put */
    }
    prevVal=e.vdot;
  });
  return changed;
}
/* PODSEĆANJE NA BACKUP — SAMO ZA NEPRIJAVLJENE.

   Sedmodnevni ritam je bio iz vremena kad je telefon bio jedina kopija. Otkad
   server čuva podatke I ranije verzije (v. supabase/istorija.sql), za
   prijavljenog korisnika backup fajl nije zaštita nego navika — a podsetnik
   koji traži nešto što ne štiti ni od čega uči čoveka da ne čita podsetnike.

   Za neprijavljenog se NIŠTA ne menja: njemu je backup i dalje jedina kopija,
   i ritam ostaje isti. */
function backupDue(today){
  if(sbAuthed()) return false;
  const base=S.ui.lastBackup||S.ui.firstRun;
  if(!base)return false;
  if(S.ui.snooze&&today<S.ui.snooze)return false;
  return today>=addD(base,7);
}
/* ---- Strava: rep-distance (m) po kvalitetnim danima, za detekciju radnih lapova ---- */
const QS={
 n1d3:[4000],n2d3:[800],n2d5:[2000],n3d3:[1000],n3d5:[2500],n4d3:[1000],n4d5:[2000],
 n5d3:[1000],n5d5:[3000],n6d3:[1000],n6d5:[4000,2000],n8d3:[1000],n8d5:[6000],n9d3:[1000],
 n9d5:[6000],n10d3:[1000],n10d5:[3000],n11d3:[1500],n11d5:[6000],n12d3:[2000],
 n12d5:[4000],n13d3:[400],n13d5:[3000],n14d2:[200]
};
/* Spec radnih lapova za dan — iz AKTIVNOG plana.
   Globalni QS je tabela tvog hardkodovanog plana ('n' ID-jevi). Generisan plan
   nosi svoj u S.genPlan.qs ('g' ID-jevi). Bez ovoga je poslednji fallback za
   citanje tempa sa Strave (preko lapova) radio SAMO za tvoj plan, a za svaki
   generisan tiho otpadao. */
function qsFor(dayId){
  if(S.genPlan && S.genPlan.qs && S.genPlan.qs[dayId]) return S.genPlan.qs[dayId];
  return QS[dayId];
}
/* Pokušaj čitanja cilja tempa direktno iz teksta opisa — "@ 4:10/km",
   "~4:25/km", ili opseg "3:52–3:54/km" (uzima sredinu opsega). Vraća sekunde
   ili null ako ništa nije prepoznato. Best-effort — za sesije sa VIŠE tempova
   u tekstu (npr. over/under) hvata PRVI pomen, korisnik po potrebi doradi ručno. */
function extractPaceFromDesc(desc){
  if(!desc)return null;
  const m=String(desc).match(/(\d{1,2}):(\d{2})(?:\s*[–\-]\s*(\d{1,2}):(\d{2}))?\s*\/\s*km/);
  if(!m)return null;
  const s1=(+m[1])*60+(+m[2]);
  if(m[3]!=null){ const s2=(+m[3])*60+(+m[4]); return Math.round((s1+s2)/2); }
  return s1;
}
/* ============================================================
   PRILAGOĐAVANJE PLANA FORMI (VDOT)

   Problem: plan nosi tempe izvedene iz PRETPOSTAVLJENE putanje forme (početni
   VDOT + rampa do cilja). Stvarna forma retko prati tu putanju tačno. Do sada
   je aplikacija merila VDOT iz svake kvalitetne sesije, crtala ga i slala AI-u
   — ali PLAN se od toga nije pomerao. Čovek koji je napredovao brže od
   predviđenog trčao je i dalje sporije tempe nego što može, i obrnuto.

   ZAŠTO KROZ S.alts[id].pace, A NE KROZ PONOVNO GENERISANJE
   To je već postojeći, testiran put za ciljni tempo po danu — `effectivePace()`
   ga čita, kartica treninga ga prikazuje kao „plan X /km (tvoj cilj)", AI ga
   dobija, a merenje VDOT-a se poredi s njim. Radi ISTO za oba tipa plana:
   lični plan je tvrdo kodovan i ne sme se dirati, generisan bi se mogao
   regenerisati, ali bi to bila druga mašinerija za isti posao.

   Za generisan plan se dodatno osvežava i `session.paceSec`, da opis treninga
   („7×300 m @ 3:47/km") ne protivreči novom cilju. Dani koje je čovek RUČNO
   zaključao (session.overrides.paceSec) se preskaču — automatika ne gazi
   svesnu odluku.

   ŠTA SE NE MENJA: obim. VDOT određuje TEMPO, ne koliko se trči — obim nosi
   plan opterećenja i menja ga povreda, ne forma.
   ============================================================ */
/* 1.5 poena je ~7-8 s/km na pragu — razlika koja se OSETI na stazi. Niže od
   toga (0.8 poena ≈ 4 s/km) upada u šum jedne sesije: prigušenje pomera VDOT
   za 40% razlike po merenju, pa bi predlog iskakao skoro posle svakog treninga
   i čovek bi ga prestao čitati. */
const VDOT_PRAG = 1.5;
const VDOT_MIN_MERENJA = 3;     /* jedna sesija je šum — v. prigušenje u preracunajVdotLog */
const VDOT_PRAG_SEK = 3;        /* i ispod 3 s/km razlike nema smisla dirati dan */

/* Zona za dan preko njegovog PRED reda; bez zone se tempo ne sme prevoditi u
   VDOT ni obrnuto (ista zamka koju zoneForPredRow već rešava za merenje). */
function zonaZaDan(d){
  /* predRowFor() vraća ID reda, ne sam red (v. predRaspored: mapa[d.id]=[t.id]) —
     red se traži u CUR_PRED, isto kao na kartici treninga i u stravaSync. */
  const pid = predRowFor(d);
  const r = pid ? CUR_PRED.find(x=>x.id===pid) : null;
  if(!r) return null;
  const z = zoneForPredRow(r);
  return z ? { r, zone:z } : null;
}

/* ============================================================
   FORMA KOJU PLAN OČEKUJE U OVOJ NEDELJI

   RANIJE JE OVDE STAJAO PROSEK SVIH PREOSTALIH DANA DO TRKE, i to je bila
   greška koja je pojela celu pripremu doslednom trkaču.

   Plan po konstrukciji ima rampu: `vdot0` na početku, `vdotGoal` na kraju.
   Prosek te rampe je otprilike SREDINA između polazne i ciljne forme — dakle
   broj koji plan traži tek za dva i po meseca. Poređen sa današnjom formom,
   taj prosek proglašava „iza plana" svakoga ko je tek na početku, ma koliko
   uredno trčao.

   Izmereno, dosledan trkač koji svaki trening odradi TAČNO na propisanom
   tempu, na sve četiri distance: razlika oko −2 poena kroz prvih osam nedelja,
   dakle preko praga od 1.5, i kartica „Forma je iza plana" koja nudi da se
   svih ~25 preostalih kvalitetnih treninga uspori za ~16 s/km. Ko to prihvati,
   dobija plan koji više ne traži ništa teže — pa više ni ne meri ništa brže:
   forma se zamrzne na vrednosti iz druge nedelje do kraja priprema. Na
   maratonu je razlika u ishodu bila blizu 14 minuta.

   Petlja se zatvarala sama: `staro` se čita preko `effectivePace`, dakle već
   prilagođenog tempa, pa je posle primene razlika ~0 i aplikacija javlja da se
   „plan i forma slažu".

   SADA: poredi se sa formom koju plan očekuje U OVOJ NEDELJI. Periodizovan
   plan namerno traži više nego što trkač danas može — to je stimulus, ne
   merilo današnje forme (Daniels: rast VDOT-a od ~1 poena na 4–6 nedelja je
   CILJ plana). Prilagođavati ima smisla samo kad trkač odstupi od SVOJE
   putanje, ne kad je plan ispred njega po projektu.

   Odakle broj:
   — generisan plan: `planVdotZaNedelju(meta, w)` — ista rampa iz koje se crta
     siva referentna kriva na grafikonu predikcije, dakle isti broj koji
     korisnik već vidi;
   — tvrdo kodovan lični plan: `p5k` redova TE nedelje, isti niz koji je i
     tamo referentna kriva.
   Ni u jednom slučaju to nije nova pretpostavka o rampi — to je podatak koji
   plan već nosi.
   ============================================================ */
function planVdotSada(today){
  today = today || TODAY;
  const w = weekOf(today) || CUR_PLAN[CUR_PLAN.length-1];
  if(!w) return null;
  if(S.genPlan && S.genPlan.meta){
    const v = planVdotZaNedelju(S.genPlan.meta, w.w);
    if(v!=null && isFinite(v)) return Math.round(v*10)/10;
  }
  /* Lični plan: p5k redova te nedelje. Nedelja bez kvalitetnih redova (npr.
     deload) uzima poslednju raniju koja ih ima — referenca ne sme da nestane
     samo zato što te nedelje nema šta da se meri. */
  for(let nw = w.w; nw >= 1; nw--){
    const v = CUR_PRED.filter(r => r && r.w === nw && r.p5k > 0)
                      .map(r => vdotFrom5k(r.p5k)).filter(x => isFinite(x));
    if(v.length) return Math.round(v.reduce((a,b)=>a+b,0)/v.length*10)/10;
  }
  return null;
}

/* Koliko je stvarna forma iznad/ispod onoga što plan traži OVE nedelje. */
function formaVsPlan(today){
  today = today || TODAY;
  const forma = currentVdot();
  const merenja = (S.vdotLog||[]).filter(e=>e&&e.measured!=null).length;
  if(forma==null || !isFinite(forma)) return null;
  const planVdot = planVdotSada(today);
  if(planVdot==null || !isFinite(planVdot)) return null;
  /* Koliko preostalih dana uopšte nosi ciljni tempo — ne ulazi u račun, ali
     kartica ga prikazuje i predlog bez ijednog takvog dana nema smisla. */
  let danaSaTempom = 0;
  for(const w of CUR_PLAN) for(const d of w.days){
    if(!d.date || d.date < today || d.rest) continue;
    if(stFor(d.id)==='done') continue;
    const z = zonaZaDan(d);
    if(!z || !(effectivePace(d, z.r)>0)) continue;
    danaSaTempom++;
  }
  if(!danaSaTempom) return null;
  return { forma, planVdot, delta: Math.round((forma-planVdot)*10)/10, merenja, danaSaTempom };
}

/* Predlog: novi ciljni tempo za svaki preostali kvalitetni dan. */
function vdotPredlog(today){
  today = today || TODAY;
  const f = formaVsPlan(today);
  if(!f) return null;
  if(f.merenja < VDOT_MIN_MERENJA) return null;      /* premalo merenja da se veruje */
  if(Math.abs(f.delta) < VDOT_PRAG) return null;     /* plan i forma se slažu */

  const changes = [];
  for(const w of CUR_PLAN) for(const d of w.days){
    if(!d.date || d.date < today || d.rest) continue;
    if(stFor(d.id)==='done') continue;
    if(d.tag==='trka' || d.tag==='test') continue;   /* dan trke ostaje kakav jeste */
    const z = zonaZaDan(d);
    if(!z || !(z.r.pt>0)) continue;
    /* AKTIVACIJA PRED TRKU SE NE DIRA, ni u jednom smeru. Njen tempo je tempo
       TRKE, a ne tempo izveden iz forme — pa ga „prilagoditi formi" znači
       pokvariti ga. Merenjem: dva dana pred trku aplikacija je nudila da se
       poslednja sesija ubrza za 50 s/km (maraton), a posle popravke imenioca
       istim putem da se uspori za 16 s/km (10K). Oba su pogrešna iz istog
       razloga. Taper skida obim a zadržava intenzitet; poslednja sesija pred
       trku nije mesto za bilo kakvo prilagođavanje. */
    if(z.r.nemeri) continue;
    /* Ručno zaključan tempo se ne dira — ni u alts, ni u sesiji. */
    if(S.alts && S.alts[d.id] && S.alts[d.id].pace!=null && !S.alts[d.id].paceAuto) continue;
    if(d.session && d.session.overrides && d.session.overrides.paceSec) continue;
    const novo = paceForZone(f.forma, z.zone);
    const staro = effectivePace(d, z.r);   /* trenutno važeći cilj, ne sirov PRED red */
    if(!(staro>0)) continue;
    if(!(novo>0) || Math.abs(novo-staro) < VDOT_PRAG_SEK) continue;
    changes.push({ id:d.id, date:d.date, kind:sessKind(d), zone:z.zone, staro, novo, w:w.w });
  }
  if(!changes.length) return null;

  const brzi = f.delta > 0;
  /* SMER SE BROJI PO IZMENAMA, NE POGAĐA IZ JEDNOG ZNAKA.
     Ranije: `brzi` je bio jedan globalni znak (`f.delta > 0`), a broj sekundi
     prosek APSOLUTNIH razlika — pa je kartica umela da napiše „7 treninga
     dobija tempo brži za oko 11 s/km" iznad spiska u kom su tri stavke
     sporije. Pojedinačne izmene se računaju po zoni svakog dana, pa se za
     različite zone razlikuju i po znaku; prosek apsolutnih vrednosti taj
     razlaz sakrije, a spisak ispod ga odmah pokaže.

     Sada se broji: koliko ubrzava, koliko usporava, i koliki je prosek u
     svakoj grupi. Izmene se NE izbacuju — svaka je za svoj dan ispravna
     (novi cilj je `paceForZone(forma, zona)` tog dana); netačan je bio samo
     sažetak. Kartica i spisak sada govore isto. */
  const brzih   = changes.filter(c => c.novo < c.staro);
  const sporijih= changes.filter(c => c.novo > c.staro);
  const prosek  = n => Math.round(n.reduce((s,c)=>s+Math.abs(c.novo-c.staro),0)/n.length);
  const sek = Math.round(changes.reduce((s,c)=>s+Math.abs(c.novo-c.staro),0)/changes.length);
  const opisIzmena = (brzih.length && sporijih.length)
    ? changes.length + ' preostalih kvalitetnih treninga menja ciljni tempo: ' +
      brzih.length + ' ' + (brzih.length===1?'brži':'brže') + ' za oko ' + prosek(brzih) + ' s/km, ' +
      sporijih.length + ' ' + (sporijih.length===1?'sporiji':'sporije') + ' za oko ' + prosek(sporijih) +
      ' s/km (tempo se računa po zoni svakog dana, pa se smer po danima ume razlikovati)'
    : changes.length + ' preostalih kvalitetnih treninga dobija ciljni tempo ' +
      (brzih.length ? 'brži' : 'sporiji') + ' za oko ' + sek + ' s/km';
  return {
    ...f, changes, brzi, brzih:brzih.length, sporijih:sporijih.length,
    title: brzi ? 'Forma je ispred plana' : 'Forma je iza plana',
    message: 'Tvoj VDOT je ' + f.forma.toFixed(1) + ', a plan za ovu nedelju računa tempo po VDOT-u ' +
      f.planVdot.toFixed(1) + ' — razlika ' + (f.delta>0?'+':'') + f.delta.toFixed(1) +
      ' poena, iz ' + f.merenja + ' izmerenih sesija. Predlog: ' + opisIzmena + '. ' +
      'Obim se NE menja — VDOT određuje tempo, ne koliko se trči. ' +
      (brzi
        ? 'Ako ti nov tempo deluje preteško na terenu, vrati ga — jedna dobra sesija ume da preceni formu.'
        : 'Sporiji tempo nije nazadovanje: bolje je pogoditi zonu nego juriti broj koji telo trenutno ne nosi.')
  };
}

function primeniVdotPredlog(prop){
  if(!prop || !prop.changes || !prop.changes.length) return 0;
  let n = 0;
  prop.changes.forEach(ch => {
    const d = BY_ID[ch.id];
    if(!d) return;
    const post = (S.alts && S.alts[ch.id]) || null;
    /* Zadržava se sve što je na danu već izmenjeno (tip, km, opis) — menja se
       SAMO ciljni tempo. `paceAuto` označava da je vrednost automatska, pa se
       kasnije sme i pregaziti i poništiti bez diranja ručnih izmena. */
    const r = setAlt(ch.id, {
      tag: post ? post.tag : (d.rest?'odmor':d.tag),
      km:  post ? post.km  : (d.km!=null?d.km:null),
      desc:post ? post.desc: (d.desc||''),
      rw:  post ? post.rw  : null,
      pace: ch.novo, paceAuto: true
    });
    if(!(r && r.ok)) return;
    n++;
    /* Generisan plan: osveži i tempo u samoj sesiji, da opis ne protivreči
       novom cilju. Lični plan nema `session` — njemu je alts.pace dovoljan. */
    if(S.genPlan) osveziTempoUGenPlanu(ch.id, ch.novo);
  });
  if(n){ setActivePlan(); rebuildDateIndex(); save(); }
  return n;
}

/* Prepiše paceSec u S.genPlan (izvoru istine za generisan plan) i preračuna
   opis/km iz sesije — isti posao koji radi applyEdit, ali BEZ postavljanja
   overrides: ovo je prilagođavanje formi, ne ručno zaključavanje polja. */
function osveziTempoUGenPlanu(id, paceSec){
  if(!S.genPlan || !Array.isArray(S.genPlan.weeks)) return false;
  for(const w of S.genPlan.weeks) for(const d of w.days){
    if(d.id!==id || !d.session) continue;
    if(d.session.overrides && d.session.overrides.paceSec) return false;
    /* Izvorni tempo se pamti JEDNOM, pri prvoj izmeni — da poništavanje ima
       čemu da se vrati. Bez toga bi opis ostao na prilagođenom tempu i posle
       vraćanja cilja, pa bi kartica i opis govorili dve različite stvari. */
    if(d.session.paceSec0 == null) d.session.paceSec0 = d.session.paceSec;
    d.session.paceSec = paceSec;
    d.km = sessKm(d.session);
    d.desc = sessDesc(d.session);
    return true;
  }
  return false;
}

/* Vrati sesiju generisanog plana na tempo iz generatora. */
function vratiTempoUGenPlanu(id){
  if(!S.genPlan || !Array.isArray(S.genPlan.weeks)) return false;
  for(const w of S.genPlan.weeks) for(const d of w.days){
    if(d.id!==id || !d.session || d.session.paceSec0==null) continue;
    d.session.paceSec = d.session.paceSec0;
    delete d.session.paceSec0;
    d.km = sessKm(d.session);
    d.desc = sessDesc(d.session);
    return true;
  }
  return false;
}

/* Poništi SAMO automatska prilagođavanja tempa; ručne izmene ostaju. */
function ponistiVdotPrilagodjavanje(){
  let n = 0;
  Object.keys(S.alts||{}).forEach(id => {
    const a = S.alts[id];
    if(!a || !a.paceAuto) return;
    a.pace = null; a.paceAuto = false;
    if(S.genPlan) vratiTempoUGenPlanu(id);
    /* Ako je tempo bio JEDINA izmena tog dana, ceo unos nestaje. */
    const d = BY_ID[id];
    if(d && a.tag===(d.origRest?'odmor':d.origTag) && a.km===(d.origKm!=null?d.origKm:null)
        && a.desc===(d.origDesc||(d.origRest?'Odmor':'')) && !a.rw) delete S.alts[id];
    n++;
  });
  if(n){ setActivePlan(); rebuildDateIndex(); save(); }
  return n;
}

/* Efektivni ciljni tempo za dan/PRED-red: ručna izmena (S.alts[d.id].pace) ima
   prednost nad kodno-fiksiranom PRED tabelom. "Izmeni trening" ne dodiruje PRED
   (deljen je između više dana/nedelja), pa je ovo jedina tačka gde se cilj koji
   VIDI korisnik (opis) i cilj koji koriste AI/kartica (pt) mogu razdvojiti. */
function effectivePace(d,r){
  const a=S.alts&&S.alts[d.id];
  return (a&&a.pace!=null)?a.pace:(r?r.pt:null);
}
/* SPAJANJE DANA SA PREDIKCIJSKIM REDOM.
   Red se pravi kao 'N<w> · <naziv sesije>', pa je NAJPOUZDANIJE spajanje po
   tacnom nazivu. Ranije se pogadjalo po podnizovima ('intervali', 'tempo'...),
   podeljeno po `tag`-u — i to je tiho lomilo svaku sesiju na TEMPU TRKE:
   "Trkački ritam" (5K, 10K), "Tempo trke" (21K) i "Maratonski tempo" (42K)
   grade se kao intervali (tag 'int'), a nijedan od tih naziva nije bio u
   int-spisku. Posledica nije kozmeticka: bez reda `syncStrava` preskace CEO
   dan — ne povlaci streamove, ne racuna tempo i ne upisuje VDOT. Rad na tempu
   trke, dakle najspecificniji trening u planu, nije ulazio u pracenje forme.
   Podniz-pogadjanje ostaje SAMO kao rezerva za rucno izmenjene dane, gde
   d.session nosi staru strukturu ili ga uopste nema. */
function predKindMatch(d, r){
  const k = d.session && d.session.kind;
  if(!k) return null;                       /* nema naziva — na rezervu */
  return r.l === 'N'+d.week.w+' · '+k;
}
function predFallbackMatchTag(tag, r){
  const l=r.l.toLowerCase();
  return tag==='int'
    ? (l.includes('intervali')||l.includes('repeticije')||l.includes('fartlek')||l.includes('piramida')||l.includes('ritam')||l.includes('maratonski tempo')||l.includes('tempo trke'))
    : (l.includes('tempo')||l.includes('ritam')||l.includes('progresivno')||l.includes('kontrolna'));
}
/* RASPODELA PREDIKCIJSKIH REDOVA NA KVALITETNE DANE — za CELU nedelju odjednom.

   Ranije se racunalo po danu, pa su dva mesta davala razlicit odgovor:
   sinhronizacija sa Stravom je koristila predRowFor (bez provere sudara) i
   UPISIVALA tempo, a kartica dana predRowsFor (sa proverom) i nije prikazivala
   polje. Merenjem na stvarnom slucaju: dan N5 rucno prebacen iz Intervala u
   Tempo. Nedelja tada ima DVA tempo dana, red "N5 · Tempo" pripadne onom koji
   je i po planu tempo, a izmenjeni dan ostane bez ijednog reda — pa nema gde
   da se upise ostvaren tempo, a Strava mu je vec upisala VDOT na tudji red.
   Red "N5 · Intervali", koji je tom danu i pripadao, postane nedostupan jer
   se rezervno poklapanje radi po NOVOM tipu.

   Sada se radi raspodela, u tri kruga, tako da dva dana nikad ne dele red i da
   izmenjen dan zadrzi red svog IZVORNOG tipa:
     1) tacan naziv sesije;
     2) rezervno poklapanje po tekucem tipu, s tim da prednost ima dan koji je
        i po planu tog tipa;
     3) izmenjenom danu pripada red njegovog izvornog tipa. */
function predRaspored(week){
  if(!week||!Array.isArray(week.days))return {};
  const dani=week.days.filter(x=>x&&!x.test&&(x.tag==='int'||x.tag==='tempo'))
                      .slice().sort((a,b)=>(a.date||'')<(b.date||'')?-1:1);
  const redovi=CUR_PRED.filter(r=>r.w===week.w);
  const mapa={}, uzeti=new Set();
  const uzmi=(d,pronadji)=>{ if(mapa[d.id])return;
    const t=redovi.find(r=>!uzeti.has(r.id)&&pronadji(r));
    if(t){ mapa[d.id]=[t.id]; uzeti.add(t.id); } };
  dani.forEach(d=>uzmi(d,r=>predKindMatch(d,r)===true));
  dani.forEach(d=>{ if(d.origTag===d.tag) uzmi(d,r=>predFallbackMatchTag(d.tag,r)); });
  dani.forEach(d=>uzmi(d,r=>predFallbackMatchTag(d.tag,r)));
  dani.forEach(d=>{ if(d.origTag&&d.origTag!==d.tag) uzmi(d,r=>predFallbackMatchTag(d.origTag,r)); });
  return mapa;
}
/* sve predikcijske sesije za dan (dan tag određuje tip: int->Intervali, tempo->Tempo/Ritam) */
function predRowsFor(d){
  if(!d||!d.week)return [];
  if(d.tag!=='int'&&d.tag!=='tempo')return [];
  return predRaspored(d.week)[d.id]||[];
}
function predRowFor(d){
  /* ISTI izvor istine kao kartica dana — inace sinhronizacija upisuje tempo
     na red koji korisnik nigde ne vidi ni moze da ispravi. */
  if(!d||!d.week)return null;
  const rows=predRowsFor(d);
  return rows.length?rows[0]:null;
}
/* VDOT delta prikaz za jedan radni segment (gore/dole u odnosu na prethodni VDOT) */
function vdotDeltaHTML(predId,paceSec){
  if(!paceSec)return `<span style="color:var(--txt3);font-size:.78rem">unesi tempo →</span>`;
  const e=(S.vdotLog||[]).find(x=>x.id===predId);
  if(!e)return `<span style="color:var(--txt3);font-size:.78rem">—</span>`;
  const arrow=e.delta>0.05?'↑':e.delta<-0.05?'↓':'→';
  const col=e.delta>0.05?'var(--green)':e.delta<-0.05?'var(--pink)':'var(--txt2)';
  const sign=e.delta>0?'+':'';
  return `<span style="color:${col};font-weight:800;font-size:.82rem">VDOT ${esc(fmtNum(e.vdot,1))} ${arrow} <span style="font-size:.72rem">(${sign}${esc(fmtNum(e.delta,1))})</span></span>`;
}
function pickClosest(list,planKm){
  return list.reduce((b,x)=>Math.abs(x.distance/1000-planKm)<Math.abs(b.distance/1000-planKm)?x:b);
}
/* Strava trčanje BEZ direktnog poklapanja datuma (npr. trčao utorak umesto
   planiranog ponedeljka) — nađe najbliži PENDING trkački dan iste nedelje sa
   sličnom kilometražom, i pomeri plan preko POSTOJEĆEG swapDays (55 testova,
   uvek reverzibilno preko "Vrati raspored nedelje"). Konzervativni pragovi
   (±2 dana, km razlika ≤30%) — bolje da propusti nesiguran slučaj nego da
   pogrešno zameni dane. Ne dira dane koji već imaju direktan par (rest se
   preskače jer nema šta da izgubi zamenom, ali VEĆ ODRAĐEN trkački dan na
   tom datumu ostaje netaknut). */
function autoRealign(byDate){
  const DAY_WINDOW=2, KM_TOL=0.30;
  const used=new Set();
  let moved=0;
  /* Neriješen izbor se lomi po KILOMETRAŽI, ne po redosledu u nizu — v. niže. */
  Object.keys(byDate).forEach(date=>{
    const occupant=BY_DATE[date];
    if(occupant && !occupant.rest && occupant.km!=null)return; /* već ima pravi trkački dan — glavna petlja to rešava */
    if(occupant && occupant.test)return;                        /* test dan se ne pomera */
    const orphanWeek=weekOf(date);
    if(!orphanWeek)return;                                      /* van opsega plana — nema gde da se pomeri */
    const runKm=Math.max(...byDate[date].map(a=>a.distance/1000));
    let best=null,bestDiff=Infinity,bestKm=Infinity;
    DATED.forEach(d=>{
      if(d.rest||d.km==null)return;
      if(d.week!==orphanWeek)return;                            /* swapDays zahteva istu nedelju */
      if(used.has(d.id))return;
      if(stFor(d.id)==='done')return;                           /* odrađeno se ne dira */
      /* NI DAN KOJI U OVOJ ISTOJ SINHRONIZACIJI IMA SVOJE TRČANJE. `stFor` gleda
         šta je VEĆ upisano, a `autoRealign` se zove PRE glavne petlje — pa u tom
         trenutku nijedno trčanje iz ovog paketa još nije vezano i `stFor` ih sve
         vidi kao neodrađene. Bez ove provere se dan sa sopstvenim trčanjem odnese
         kao kandidat, a njegovo trčanje posle nema za šta da se veže i tiho
         nestane: izmereno na sve četiri distance, nedelja u kojoj je trkač
         odradio svih pet treninga na svoj dan i dodao jedno lagano trčanje
         evidentirana je 15–18% niže nego što je istrčana, a nestala je baš
         kvalitetna sesija (g2d5, tempo). Komentar iznad funkcije to i obećava —
         „ne dira dane koji već imaju direktan par" — samo je provera postojala
         za `occupant`, ne i za kandidata. */
      if(byDate[d.date])return;
      const dd=Math.abs(diffD(d.date,date));
      if(dd===0||dd>DAY_WINDOW)return;
      const kmDiff=Math.abs(d.km-runKm);
      if(kmDiff/d.km>KM_TOL)return;
      /* NA ISTOJ UDALJENOSTI ODLUČUJE KILOMETRAŽA. Ranije je stajalo samo
         `dd<bestDiff`, pa je kod izjednačenja pobeđivao onaj koji je ranije u
         `DATED` — dakle redosled niza, ne sličnost. Izmereno na maratonu:
         dugo trčanje od 14.7 km odrađeno dan ranije vezalo bi se za tempo dan
         od 11.6 km (razlika 3.1 km, ali isti dan udaljenosti) umesto za dugo
         trčanje od tačno 14.7 km, koje je bilo isto toliko daleko. Plan bi se
         time prepisao naopako: dugo trčanje ostane neodrađeno, a tempo dan
         „odrađen" kao dugo trčanje. */
      if(dd<bestDiff || (dd===bestDiff && kmDiff<bestKm)){bestDiff=dd;bestKm=kmDiff;best=d;}
    });
    if(best && occupant){
      const res=swapDays(best.id,occupant.id);
      if(res.ok){used.add(best.id);moved++;}
    }
  });
  return moved;
}
/* Zajednička selekcija radnih lapova (varijanta C sa zaštitom) — koriste je i
   workLapsTempo (za VDOT) i workLapsDetail (za po-krug analizu). Radni intervali
   su NAJBRŽI lapovi ciljane distance i međusobno konzistentni; WU/CD/hod su iste
   distance ali dramatično sporiji. Sidro = najbrži lap, zadrži unutar 25%. */
function workLapsSelect(laps,specs){
  if(!laps||!laps.length)return [];
  const paceOf=L=>((L.moving_time||L.elapsed_time)/(L.distance/1000));
  const cand=laps.filter(L=>L.distance>0&&(L.moving_time||L.elapsed_time)>0
    && specs.some(m=>Math.abs(L.distance-m)/m<=0.15));
  if(!cand.length)return [];
  const fastest=Math.min(...cand.map(paceOf));
  return cand.filter(L=>paceOf(L)<=fastest*1.25);
}
function workLapsTempo(laps,specs){
  const work=workLapsSelect(laps,specs);
  if(!work.length)return null;
  const dist=work.reduce((s,L)=>s+L.distance,0);
  const t=work.reduce((s,L)=>s+(L.moving_time||L.elapsed_time||0),0);
  if(!dist||!t)return null;
  return Math.round(t/(dist/1000));
}
/* Prepoznavanje RADNIH SEGMENATA direktno iz streamova po brzini — nezavisno
   od Stravinih lapova (koji nepouzdano vraćaju čas strukturne čas auto-1km).
   Validirano na stvarnim trening strukturama: 5x1km intervali (±4s po repu),
   2x2.5km tempo (±4s), nula lažnih segmenata na lakom trčanju i stridovima. */
function kmeansV(mv, K){
  const mn=Math.min(...mv), mx=Math.max(...mv);
  let c=[]; for(let k=0;k<K;k++)c.push(mn+(mx-mn)*k/(K-1));
  for(let it=0;it<60;it++){
    const s=new Array(K).fill(0), cnt=new Array(K).fill(0);
    for(const x of mv){
      let bi=0,bd=Infinity;
      for(let k=0;k<K;k++){const d=Math.abs(x-c[k]);if(d<bd){bd=d;bi=k;}}
      s[bi]+=x;cnt[bi]++;
    }
    let moved=false;
    for(let k=0;k<K;k++){ if(cnt[k]){const nc=s[k]/cnt[k];if(Math.abs(nc-c[k])>=0.005)moved=true;c[k]=nc;} }
    if(!moved)break;
  }
  return c.sort((a,b)=>a-b);
}
/* Izvlači naizmenične hi/lo konture, pametno spajajući kratke suprotne upade
   (mergeSec) SAMO ako je nivo brzine pre/posle sličan (gapSimilarTol) — prava
   buka unutar iste namere, ne pravi prelaz između dva različita tempa. */
function extractRunsV(vSlice, distSlice, timeSlice, thr, minDist, minDur, mergeSec, gapSimilarTol){
  const n=vSlice.length;
  const isHi=vSlice.map(x=>x>=thr);
  const runs=[];
  let i=0;
  while(i<n){
    const state=isHi[i];
    let j=i; while(j<n && isHi[j]===state) j++;
    runs.push({state, start:i, end:j});
    i=j;
  }
  for(let k=1;k<runs.length-1;k++){
    const prev=runs[k-1], cur=runs[k], next=runs[k+1];
    const dur=timeSlice[cur.end-1]-timeSlice[cur.start];
    if(cur.state!==prev.state && dur<=mergeSec){
      if(gapSimilarTol==null){ prev.end=next.end; runs.splice(k,2); k--; continue; }
      const avgV=(a,b)=>{let s=0,c=0;for(let x=a;x<b;x++){s+=vSlice[x];c++;}return c?s/c:0;};
      const before=avgV(Math.max(0,prev.start),prev.end), after=avgV(next.start,Math.min(n,next.end));
      if(before>0 && Math.abs(after-before)/before<=gapSimilarTol){ prev.end=next.end; runs.splice(k,2); k--; }
    }
  }
  return runs.filter(r=>{
    const dd=distSlice[r.end-1]-distSlice[r.start], dt=timeSlice[r.end-1]-timeSlice[r.start];
    return dd>=minDist && dt>=minDur;
  });
}
function segFromRunV(r, dist, time, hr, cad, wat, offset){
  offset=offset||0;
  const avg=(arr,a,b)=>{ if(!arr)return null; let s=0,c=0; for(let k=a;k<b&&k<arr.length;k++){ const x=arr[k]; if(x!=null&&x>0){s+=x;c++;} } return c?s/c:null; };
  const a=r.start+offset, b=r.end+offset;
  const dd=dist[b-1]-dist[a], dt=time[b-1]-time[a];
  return {
    distM:Math.round(dd), paceSec:Math.round(dt/(dd/1000)),
    avgHr:avg(hr,a,b)!=null?Math.round(avg(hr,a,b)):null,
    cadence:avg(cad,a,b)!=null?Math.round(avg(cad,a,b)):null,
    watts:avg(wat,a,b)!=null?Math.round(avg(wat,a,b)):null
  };
}
/* Pokušaj da razreši NAIZMENIČNU strukturu UNUTAR jednog spoljašnjeg "radnog"
   bloka (npr. OverUnder blok gde spoljašnji prolaz vidi ceo "over+under" kao
   jedan kontinuiran rad, jer su oba brža od global-praga). Prihvata SAMO ako:
   (a) blok dovoljno veliki da uverljivo sadrži VIŠE repova (inače je već
   otprilike veličine jednog repa — dalje deljenje bi hvatalo šum), (b) lokalni
   k=2 odnos jasno iznad izmerenog šum-plafona (~1.02, koristimo 1.06 sa
   marginom), (c) rezultat pokriva VEĆINU bloka (ne ivični artefakt
   izglađivanja), (d) 2+ kvalifikovana "hi" ciklusa (razlikuje STVARNU
   naizmeničnost od jednosmernog "brz-pa-uspori" drifta unutar repa). Inače
   vraća null — pozivalac zadržava ceo blok kao JEDAN segment (bezbedan
   fallback, nikad ne gubi blok). */
function tryInnerResolveV(vSlice, distSlice, timeSlice, blockDist, blockDur){
  if(vSlice.length<20) return null;
  if(!(blockDur>=240 || blockDist>=900)) return null;
  const c2=kmeansV(vSlice,2);
  if(!(c2[0]>0 && c2[1]/c2[0]>=1.06)) return null;
  const localThr=(c2[0]+c2[1])/2;
  const runs=extractRunsV(vSlice,distSlice,timeSlice,localThr,150,20,20,0.25);
  const hiCount=runs.filter(r=>r.state).length;
  if(hiCount<2) return null;
  const covered=runs.reduce((s,r)=>s+(distSlice[r.end-1]-distSlice[r.start]),0);
  if(blockDist>0 && covered/blockDist<0.75) return null;
  return runs;
}
function detectWorkSegments(streams){
  const dist = streams.distance && streams.distance.data;
  const time = streams.time && streams.time.data;
  const hr   = streams.heartrate && streams.heartrate.data;
  const cad  = streams.cadence && streams.cadence.data;
  const wat  = streams.watts && streams.watts.data;
  if(!Array.isArray(dist)||!Array.isArray(time)||dist.length<120||dist.length!==time.length) return null;
  const n=dist.length;

  /* 1) brzina po tački, klizni prozor ±7 tačaka (~15 s) protiv GPS šuma.
     NAPOMENA: 7 je inženjerski izbor kalibrisan na stvarnim podacima, ne merena konstanta. */
  const W=7;
  const v=new Array(n);
  for(let i=0;i<n;i++){
    const a=Math.max(0,i-W), b=Math.min(n-1,i+W);
    const dd=dist[b]-dist[a], dt=time[b]-time[a];
    v[i]=dt>0?dd/dt:0;
  }

  /* 2) k-means na brzinama (samo kretanje >0.7 m/s). Postepeno popustljiviji
     pokušaji, STANI na prvom koji uspe:
     - k=3 (1.25×): tri moda brzine (hod/džog/rad) — klasični intervali sa
       hod-odmorom, ili Piramida.
     - k=2 (1.4×): dva jasno razdvojena nivoa — Tempo/Broken tempo/Maratonski
       tempo (WU/CD naspram jednog kontinuiranog rada).
     - k=2 (1.13×, "permisivan"): Fartlek — odmor je DŽOGIRANJE (slično
       WU/CD tempu), ne hod, pa nema prirodnog trećeg moda, i kontrast
       surge/džog je manji. Bezbednosna ograda ispod (hi-udeo mora biti jasna
       MANJINA, 5-70%) — prava struktura ima oštru rad/odmor podelu, prirodna
       varijacija u kontinuiranom trčanju obično nema tako oštru podelu.
     Pragovi su inženjerski izbori validirani na stvarnim i sintetičkim
     trening strukturama (250+ scenarija), ne merene konstante. */
  const mv=v.filter(x=>x>0.7);
  if(mv.length<120) return null;
  let thr=null, usedPermissive=false;
  const c3=kmeansV(mv,3);
  if(c3[2]/c3[1]>=1.25){ thr=(c3[1]+c3[2])/2; }
  else {
    const c2k=kmeansV(mv,2);
    if(c2k[1]/c2k[0]>=1.4){ thr=(c2k[0]+c2k[1])/2; }
    else if(c2k[0]>0 && c2k[1]/c2k[0]>=1.13){ thr=(c2k[0]+c2k[1])/2; usedPermissive=true; }
  }
  if(thr==null) return []; /* kontinuirano trčanje — nema jasnog radnog moda */

  /* 4) maska radnih tačaka + PAMETNO spajanje rupa <=8s: spoji SAMO ako je
     nivo brzine pre/posle rupe sličan (prava buka unutar jednog repa) —
     inače je to PRELAZ između dva različita tempa (npr. over->under u
     OverUnder treningu), i spajanje bi netačno stopilo dva repa u jedan
     prosečan blob (nađeno testom na stvarnoj OverUnder Strava aktivnosti). */
  const work=v.map(x=>x>=thr);
  let i=0;
  while(i<n){
    if(!work[i]){
      let j=i; while(j<n&&!work[j])j++;
      if(i>0&&j<n){
        const gap=time[j]-time[i-1];
        if(gap<=8){
          const avgV=(a,b,dir)=>{let s=0,c=0;for(let k=1;k<=5;k++){const p=dir<0?a-k:b+k-1;if(p>=0&&p<n){s+=v[p];c++;}}return c?s/c:0;};
          const before=avgV(i,i,-1), after=avgV(j,j,1);
          if(before>0 && Math.abs(after-before)/before<=0.15){ for(let k=i;k<j;k++)work[k]=true; }
        }
      }
      i=Math.max(j,i+1);
    } else i++;
  }

  /* Bezbednosna ograda ZA PERMISIVNI prag samo: hi-udeo mora biti jasna
     manjina (5-70%) ukupnog trčanja. */
  if(usedPermissive){
    const hiTotal=work.filter(Boolean).length;
    const frac=hiTotal/mv.length;
    if(frac<0.05 || frac>0.70) return [];
  }

  /* 5) segmenti: odbaci kraće od 200m/45s (150m/30s ako je permisivan prag —
     Fartlek-ciklusi su prirodno kraći). Za svaki blok pokušaj UNUTRAŠNJU
     rezoluciju naizmenične strukture pre nego što ga prihvatiš kao celinu. */
  const segs=[];
  i=0;
  while(i<n){
    if(work[i]){
      let j=i; while(j<n&&work[j])j++;
      const dd=dist[j-1]-dist[i], dt=time[j-1]-time[i];
      const minD=usedPermissive?150:200, minT=usedPermissive?30:45;
      if(dd>=minD&&dt>=minT){
        const inner=tryInnerResolveV(v.slice(i,j), dist.slice(i,j), time.slice(i,j), dd, dt);
        if(inner){
          inner.forEach(r=>segs.push(segFromRunV(r,dist,time,hr,cad,wat,i)));
        } else {
          const avg=(arr)=>{ if(!arr)return null; let s=0,c=0; for(let k=i;k<j&&k<arr.length;k++){ const x=arr[k]; if(x!=null&&x>0){s+=x;c++;} } return c?s/c:null; };
          segs.push({
            distM:Math.round(dd), paceSec:Math.round(dt/(dd/1000)),
            avgHr:avg(hr)!=null?Math.round(avg(hr)):null,
            cadence:avg(cad)!=null?Math.round(avg(cad)):null,
            watts:avg(wat)!=null?Math.round(avg(wat)):null
          });
        }
      }
      i=j;
    } else i++;
  }
  segs.forEach((s,idx)=>s.i=idx+1);
  return segs;
}


/* Po-kilometarski presek za KONTINUIRANA trčanja (lako/LR) — nema radnih
   intervala, pa merimo puls/kadencu/tempo svakog kilometra kroz celo trčanje.
   Iz distance streama nalazimo gde svaki km počinje/završava, pa prosečimo HR i
   kadencu unutar tog opsega. Vraća niz {km, paceSec, hr, cadence}. */
/* TEMPO PO KILOMETRU — iz VREMENA U POKRETU, ne iz proteklog.
   Ranije je bilo `time[i] - time[startI]`, dakle PROTEKLO vreme: svako
   zaustavljanje (semafor, cesma, prelaz) ulazilo je u tempo tog kilometra.
   Izmereno na stvarnom trcanju (progresivni long, 15 km): cetiri kilometra su
   imala stajanja od 121, 54, 42 i 37 sekundi, pa je AI dobio 6:53 umesto 4:52,
   5:35 umesto 4:41, 5:24 umesto 4:42 — i iz toga zakljucio da su se "brzi i
   spori kilometri neplanirano smenjivali" i da postoji "ogroman kardiovaskularni
   drift", jer je poslednji kilometar izgledao kao da je trcan istim tempom kao
   prvi. U stvarnosti je bio 42 s/km BRZI, i puls je bio tacno ono sto se
   ocekuje. Analiza je bila pogresna u samoj osnovi, a ne u nijansi.
   `stopSec` se prosledjuje dalje da AI zna DA je bilo stajanja i ne tumaci ga
   kao usporavanje. */
/* Verzija po-km podataka. Podize se kad se promeni NACIN racunanja, da se vec
   sinhronizovani treninzi jednom osvezze — inace popravka nikad ne stigne do
   trcanja koja su vec u bazi (prijava korisnika: ista pogresna analiza i posle
   ispravke, jer je perKm bio kesiran iz starog sync-a). */
const PERKM_VER = 2;
function perKmDetail(streams){
  if(!streams)return [];
  const dist=streams.distance&&streams.distance.data, hr=streams.heartrate&&streams.heartrate.data,
        cad=streams.cadence&&streams.cadence.data, time=streams.time&&streams.time.data,
        mov=streams.moving&&streams.moving.data, alt=streams.altitude&&streams.altitude.data,
        tmp=streams.temp&&streams.temp.data, wat=streams.watts&&streams.watts.data;
  if(!Array.isArray(dist)||!dist.length)return [];
  const imaMoving = Array.isArray(mov) && Array.isArray(time) && mov.length===time.length;
  const out=[]; let kmIdx=1, startI=0;
  for(let i=0;i<dist.length;i++){
    if(dist[i]>=kmIdx*1000){
      const seg=(arr)=>{ if(!arr)return null; let s=0,n=0; for(let k=startI;k<=i&&k<arr.length;k++){if(arr[k]!=null){s+=arr[k];n++;}} return n?s/n:null; };
      const proteklo=(time&&time[i]!=null&&time[startI]!=null)?(time[i]-time[startI]):null;
      let dt=proteklo, stop=0;
      if(imaMoving && proteklo!=null){
        let s=0;
        for(let k=startI;k<i;k++){ if(mov[k+1]) s += (time[k+1]-time[k]); }
        dt=s; stop=Math.max(0, proteklo-s);
      }
      const r={km:kmIdx, v:PERKM_VER, paceSec: dt!=null?Math.round(dt):null, hr: seg(hr)!=null?Math.round(seg(hr)):null, cadence: seg(cad)!=null?Math.round(seg(cad)):null};
      if(stop>=5) r.stopSec=Math.round(stop);
      const alt0=(alt&&alt[startI]!=null)?alt[startI]:null, alt1=(alt&&alt[i]!=null)?alt[i]:null;
      if(alt0!=null&&alt1!=null){ const dEl=Math.round(alt1-alt0); if(Math.abs(dEl)>=4) r.elevM=dEl; }
      const wSeg=seg(wat); if(wSeg!=null) r.watts=Math.round(wSeg);
      const tSeg=seg(tmp); if(tSeg!=null) r.temp=Math.round(tSeg);
      out.push(r);
      startI=i; kmIdx++;
    }
  }
  return out;
}
/* DEKUPLOVANJE (Pa:HR) — koliko se odnos tempa i pulsa pokvario u drugoj
   polovini trcanja. To je standardna mera AEROBNE IZDRZLJIVOSTI: ispod 5% je
   dobro, preko 8% znaci da tempo u drugoj polovini kosta znatno vise otkucaja.
   Merodavno je SAMO ako je tempo bio priblizno ravnomeran — na progresivnom
   trcanju je razlika po definiciji ogromna i nista ne govori o izdrzljivosti.
   Zato se vraca `null` i razlog, umesto broja koji bi model pogresno protumacio. */
/* ============================================================
   PODACI SA SATA KOJI SU DO SADA IŠLI SAMO AI-U

   Sync povlači kadencu, maksimalan puls, uspon, temperaturu, Strava „relative
   effort" i računa drift pulsa — sve to ide u AI analizu, a korisniku se nije
   prikazivalo nigde. Model je mogao da kaže „puls ti je driftovao 8%", a čovek
   nije imao gde da vidi sam broj ni da ga proveri.

   Zone pulsa se isto povlače (S.strava.hrZones) i isto su išle samo AI-u.
   ============================================================ */

/* U kojoj je zoni dati puls, prema zonama iz korisnikovog Strava naloga.
   Poslednja zona nema gornju granicu (Strava je šalje kao -1 → null). */
function zonaZaPuls(hr){
  const z=(S.strava&&S.strava.hrZones)||null;
  if(!Array.isArray(z)||!z.length||!(hr>0)) return null;
  for(let i=0;i<z.length;i++){
    /* Number.isFinite, NE `lo>=0`: u JS-u je `null >= 0` tačno, pa bi zapis
       bez granice iz pokvarenog backupa prošao kao zona koja počinje od nule. */
    const lo=z[i]&&z[i].min, hi=z[i]&&z[i].max;
    if(!Number.isFinite(lo)||lo<0) continue;
    if(hr>=lo && (!Number.isFinite(hi)||hi<=0||hr<=hi)) return {n:i+1, od:lo, do:Number.isFinite(hi)&&hi>0?hi:null};
  }
  return null;
}

/* Zone pulsa iz Strava naloga, kao spisak. Povlačile su se od ranije i slale
   AI-u, ali ih korisnik nigde nije video — pa ni oznaka „Z4" uz maks. puls ne
   bi imala u šta da se uporedi. */
function zoneHTML(){
  const z=(S.strava&&S.strava.hrZones)||null;
  if(!Array.isArray(z)||!z.length) return '';
  const boje=['var(--txt3)','var(--green)','var(--cyan)','var(--amber)','var(--red)'];
  let n=0;
  const redovi=z.map(x=>{
    const lo=x&&x.min, hi=x&&x.max;
    if(!Number.isFinite(lo)||lo<0) return '';
    const raspon = (Number.isFinite(hi)&&hi>0) ? `${esc(lo)}–${esc(hi)}` : `${esc(lo)}+`;
    n++;
    return `<div style="display:flex;align-items:center;gap:8px;font-size:.78rem;padding:2px 0">
      <span style="width:18px;height:8px;border-radius:4px;background:${boje[Math.min(n-1,boje.length-1)]};flex:none"></span>
      <b style="width:22px">Z${n}</b><span style="color:var(--txt2)">${raspon} bpm</span></div>`;
  }).join('');
  if(!n) return '';
  return `<details class="help" style="margin-top:8px"><summary>Tvoje zone pulsa</summary>
    <div style="margin-top:6px">${redovi}</div>
    <p style="margin-top:8px">Iz tvojih Strava podešavanja. Koriste se za oznaku zone uz maksimalan puls na kartici treninga i u AI analizi.</p></details>`;
}

/* DRIFT (aerobno raspregnuće) ima ISTU skalu boja gde god se pojavi: ispod 5 %
   je zdrava aerobna baza, 5–8 % je granično, preko 8 % znači da tempo košta
   znatno više otkucaja u drugoj polovini. Jedna funkcija zato što se broj sada
   vidi na dva mesta — „Sa sata" i poređenje laganih trčanja — pa bi dve kopije
   praga pre ili kasnije obojile isti broj različito. */
function bojaDrifta(n){ return n<5?'var(--green)':n<8?'var(--amber)':'var(--red)'; }
/* Jedan red sa onim što je sat izmerio. Vraća '' kad nema nijednog podatka —
   prazan red bi bio samo šum na kartici. */
/* Vraća REDOVE [naziv, vrednostHTML], ne rečenicu.
   Ranije je bilo „⌚ Sa sata: kadenca 86 spm · maks. puls 154 · uspon 71 m · …"
   — šest merenja nanizanih u tekst, ništa poravnato. To se ne vidi u prolazu,
   to se čita. Kao redovi, nazivi stoje levo a cifre desno jedna ispod druge. */
function metrikaSata(l){
  if(!l) return [];
  /* BROJ, ne „nije null". Vrednosti dolaze i iz uvezenog backupa, gde `l.cadence`
     ume da bude string ili null — Math.round('x') je NaN, pa bi na kartici
     pisalo „kadenca NaN spm". Ista granica poverenja kao cistWellness. */
  const br=v=>(v==null||v===''||typeof v==='boolean'||!Number.isFinite(+v))?null:+v;
  const d=[];
  const kad=br(l.cadence);   if(kad!=null&&kad>0) d.push(['kadenca',`<b>${esc(Math.round(kad))}</b> spm`]);
  const mhr=br(l.maxHr);
  if(mhr!=null&&mhr>0){
    const z=zonaZaPuls(mhr);
    d.push(['maks. puls',`<b>${esc(Math.round(mhr))}</b>${z?` <small>Z${z.n}</small>`:''}`]);
  }
  const usp=br(l.elevGain); if(usp!=null&&usp>0) d.push(['uspon',`<b>${esc(Math.round(usp))}</b> m`]);
  const tmp=br(l.temp);     if(tmp!=null) d.push(['temperatura',`<b>${esc(Math.round(tmp))}</b> °C`]);
  const nap=br(l.relEffort);if(nap!=null&&nap>0) d.push(['Strava napor',`<b>${esc(Math.round(nap))}</b>`]);
  /* DRIFT PULSA (aerobno raspregnuće): koliko je odnos tempo/puls pao u drugoj
     polovini u odnosu na prvu. Ispod 5% je znak dobre aerobne baze; preko toga
     znači da je tempo bio prebrz za trenutnu izdržljivost ili da je baza tanka.
     Računa se samo kad je tempo bio ravnomeran (±3%) — inače poređenje ne važi,
     i tada se prikazuje razlog umesto broja. */
  if(l.decoupling && typeof l.decoupling==='object'){
    const n=br(l.decoupling.n);
    if(n!=null){
      const boja=bojaDrifta(n);
      d.push(['drift pulsa',`<b style="color:${boja}">${n>0?'+':''}${esc(fmtNum(n,1))} %</b>`]);
    } else if(typeof l.decoupling.razlog==='string' && l.decoupling.razlog){
      d.push(['drift pulsa',`<small>${esc(l.decoupling.razlog)}</small>`]);
    }
  }
  return d;
}

/* Isto za jutarnja merenja — HRV, puls u miru, san, svežina. */
function oporavakRedovi(datum){
  const o=oporavakZa(datum);
  if(!o) return [];
  const r=[];
  /* Sve kroz fmtNum: intervals.icu vraća svežinu i odstupanja u punoj
     preciznosti, a i jedna decimala mora imati srpski zarez, ne tačku. */
  const br=v=>(v==null||!isFinite(+v))?'—':esc(fmtNum(+v,1));
  if(o.hrv!=null) r.push(['HRV',
    `<b style="color:${esc(bojaOdstupanja(o.hrvOdstupanje))}">${br(o.hrv)}</b>`+
    (o.hrvOdstupanje!=null?` <small>${o.hrvOdstupanje>=0?'+':''}${br(o.hrvOdstupanje)} %</small>`:'')]);
  if(o.pulsUMiru!=null) r.push(['puls u miru',
    `<b>${br(o.pulsUMiru)}</b>`+(o.pulsOdstupanje!=null?` <small>${o.pulsOdstupanje>=0?'+':''}${br(o.pulsOdstupanje)}</small>`:'')]);
  if(o.sanH!=null) r.push(['san',
    `<b style="color:${o.sanH<6?'var(--red)':o.sanH<7?'var(--amber)':'var(--green)'}">${br(o.sanH)} h</b>`]);
  if(o.svezina!=null) r.push(['svežina',`<b>${br(o.svezina)}</b>`]);
  return r;
}

/* ---------- KARTOTEKA: gradivni delovi kartice dana ----------
   Ekran Danas je do sada bio JEDNA kartica u koju je stalo sve: opis sesije,
   planski brojevi, polja za unos, harmonika, podaci sa sata, jutarnja merenja,
   AI napomena i dugme. Ništa nije govorilo šta je glavno, a merenja su se
   čitala kao rečenica. Sada je svaki izvor podataka svoja kartica sa imenom. */
function dRedovi(rows){
  if(!rows||!rows.length) return '';
  return `<div class="drows">`+rows.map(r=>
    `<div class="drow"><span class="l">${esc(r[0])}</span><span class="v">${r[1]}</span></div>`).join('')+`</div>`;
}
function dGlava(naslov,dodatak){
  return `<div class="dhead"><span class="card-t">${esc(naslov)}</span>`+
         (dodatak?`<span class="dhead-x">${dodatak}</span>`:'')+`</div>`;
}
function dKarta(naslov,dodatak,telo,klasa){
  if(!telo) return '';
  return `<div class="card${klasa?' '+klasa:''}">${dGlava(naslov,dodatak)}${telo}</div>`;
}

/* ---------- AI ANALIZA ----------
   ŠTA JE BILO: zaseban red „📊 AI dobija po KILOMETRU (8 km) — nema podelu po
   intervalu.", ispod njega dugme, ispod njega prazan prostor za izlaz. Tri
   bloka za nešto što se koristi jednom po treningu, i napomena koja je šum sve
   dok te ne zanima.

   ŠTA JE SADA: jedan element u dva stanja. Dok nema analize, kartica je JEDAN
   RED — sama radnja. Napomena o izvoru podataka postala je njen podnaslov, pa
   pitanje „vredi li uopšte" stoji tačno tamo gde se odlučuje, a ne kao red
   iznad. Kad analiza postoji, isti element je puna kartica sa naslovom, kao
   Plan / Uneto / Sa sata / Jutros. Kontejner je isti, pa se posle uspeha samo
   zameni sadržaj — bez ponovnog iscrtavanja i bez skoka na vrh.

   TEKST SE OD SADA ČUVA. Ranije se nije: potrošio bi kvotu, dobio analizu, i
   izgubio je čim se ekran ponovo iscrta — dok ti poruka o limitu govori da
   „nema potrebe za ponavljanjem". Sada preživi zatvaranje aplikacije.
   Bezbedno je jer `mdToHtml` PRVO escapuje, pa ni tekst iz uvezenog backupa
   ne može da unese oznake. */
const AI_LIMIT=2;
/* Koliko analiza SME jos da se pokrene za ovaj trening.
   VLASNIK NEMA LIMIT. Limit od dve postoji zato sto se „analiza ne menja za
   iste podatke", pa treca kosta kvotu bez ikakve nove informacije — a kvotu
   placa vlasnik. Njemu samom to ograniciti nema smisla; on je jedini kome
   ponovno pokretanje sluzi za razvoj (proba drugog prompta, poredjenje
   odgovora). Server odbija limit istom logikom (v. api/analyze.js). */
function aiPreostalo(l){
  if(jeVlasnik()) return Infinity;
  return Math.max(0, AI_LIMIT-((l&&l.aiCount)||0));
}
function plKrug(n){ const h=n%100; if(h>=11&&h<=14)return 'krugova'; const m=n%10;
  return m===1?'krug':(m>=2&&m<=4?'kruga':'krugova'); }
function aiIzvor(l){
  const k=Array.isArray(l.laps)?l.laps.length:0;
  const km=Array.isArray(l.perKm)?l.perKm.length:0;
  /* Izvor krugova se IMENUJE: sa intervals.icu su prepoznati nad izvornim
     fajlom sa sata i nose GAP i puls po repu, sa Strave ih je prepoznala sama
     aplikacija iz streamova. To nije isti kvalitet podatka i čovek to treba da
     vidi na kartici, ne da nagađa zašto je analiza negde oštrija. */
  if(k) return `po krugu · ${k} ${plKrug(k)}` + (l.lapsIzvor==='icu'?' · intervals.icu':'');
  if(km) return `po kilometru · ${km} km`;
  return 'samo prosek cele sesije';
}
function aiMoze(d,l){
  return (d.tag==='int'||d.tag==='tempo'||d.tag==='lako'||d.tag==='lr')&&!!l.km&&!!l.sec;
}
function aiTelo(d,l){
  const izvor=aiIzvor(l);
  const preostalo=aiPreostalo(l);
  const ostatak=n=>n===Infinity?'bez ograničenja':`${n} ${pl3(n,'preostala','preostale','preostalih')}`;
  /* Trazi se STRING, ne samo „ima nesto": iz uvezenog backupa `aiText` moze
     doci kao objekat ili broj, a onda bi u kartici pisalo „[object Object]". */
  const tekst=typeof l.aiText==='string'&&l.aiText.trim()?l.aiText:null;
  /* POSAO KOJI JOŠ TRAJE ima svoje stanje — inače bi kartica posle povratka u
     aplikaciju izgledala kao da se ništa nije desilo, pa bi čovek kliknuo
     ponovo i potrošio još jednu analizu.
     PRIJAVA: „ako zatvorim aplikaciju vrati na staru analizu". Prva verzija je
     ovo stanje pokazivala SAMO kad starog teksta nema — a „Analiziraj ponovo"
     je po definiciji slučaj u kom ga ima. Zato je posle povratka izgledalo kao
     da se ništa nije ni pokrenulo. Sada stanje ima prednost UVEK; stari tekst
     ostaje ispod, jasno označen, jer je i dalje valjan podatak. */
  if(l.aiPosao&&l.aiPosao.id){
    return dGlava('Analiza',esc(izvor))+
      `<div class="ai-radi">Nova analiza je u toku. Rezultat se upisuje sam — možeš da zatvoriš aplikaciju.</div>`+
      (tekst ? `<div class="ai-staro">prethodna analiza</div><div class="ai-out">${mdToHtml(tekst)}</div>` : '');
  }
  if(tekst){
    return dGlava('Analiza',esc(izvor))+
      (l.aiGreska?`<div class="ai-radi err">${esc(l.aiGreska)}</div>`:'')+
      `<div class="ai-out">${mdToHtml(tekst)}</div>`+
      (preostalo
        ? `<button type="button" class="ai-again" data-ai="${esc(d.id)}">Analiziraj ponovo · ${ostatak(preostalo)}</button>`
        : '');
  }
  if(!preostalo){
    return `<div class="ai-row off"><span class="ai-ic">✨</span>
      <span class="ai-tt"><b>Analiza</b><span>iskorišćene obe za ovaj trening</span></span></div>`;
  }
  return `<button type="button" class="ai-row" data-ai="${esc(d.id)}">
      <span class="ai-ic">✨</span>
      <span class="ai-tt"><b>Analiziraj trening</b><span>${esc(izvor)} · ${ostatak(preostalo)}</span></span>
      <span class="ai-ch">›</span></button>`;
}
function aiKarta(d,l){
  if(!aiMoze(d,l)) return '';
  const ima=typeof l.aiText==='string'&&l.aiText.trim();
  return `<div class="card ai-card${ima?'':' prazna'}" id="ai-card-${esc(d.id)}">${aiTelo(d,l)}</div>`;
}

function decouplingPerKm(perKm){
  if(!Array.isArray(perKm)) return null;
  const v=perKm.filter(k=>k&&k.paceSec>0&&k.hr>0);
  if(v.length<6) return null;
  const pola=Math.floor(v.length/2);
  const A=v.slice(0,pola), B=v.slice(v.length-pola);
  const sr=(arr,f)=>arr.reduce((s,x)=>s+f(x),0)/arr.length;
  const pA=sr(A,x=>x.paceSec), pB=sr(B,x=>x.paceSec);
  /* tempo mora biti uporediv: +-3% izmedju polovina */
  if(!(pA>0)||Math.abs(pB-pA)/pA>0.03) return { n:null, razlog:'tempo nije bio ravnomeran' };
  const rA=(1000/pA)/sr(A,x=>x.hr), rB=(1000/pB)/sr(B,x=>x.hr);
  if(!(rA>0)) return null;
  return { n:Math.round((rA-rB)/rA*1000)/10 };
}
/*==DOM==*/

/* ============ DOM SLOJ ============ */
let S=loadState();save();
setActivePlan(); /* CUR_PLAN/CUR_PRED — pre rebuildDateIndex, koji ih čita */
rebuildDateIndex(); /* prvo punjenje BY_ID/BY_DATE/DATED — sad kad S.moves postoji */
/* DANASNJI DAN JE ZIV, NE ZAMRZNUT.
   Ranije `const TODAY=todayStr()` — izracunato JEDNOM, pri ucitavanju, a cita
   se na 37 mesta (Danas kartica, streak, kneeStatus, injuryProposal, mapa
   tela, slanje na sat, trend, naziv backup fajla, podrazumevan datum u formi).
   Instalirana PWA ne restartuje se danima: ko otvori app u 23:50 i pogleda je
   u 00:30 video je JUCERASNJI trening kao „Danas", a „Zavrsi trening" bi
   upisao jucerasnji datum. Da je scenario stvaran vec je bilo poznato — v.
   icuAutoSync, koji jedini uzima svez datum uz komentar „app ume da stoji
   otvorena preko ponoci".
   Sada je `let`, a `osveziDan()` se poziva pri svakom povratku u aplikaciju i
   pri svakoj promeni stranice; kad se datum promeni, ekran se ponovo iscrta. */
let TODAY=todayStr();
function osveziDan(){
  const t=todayStr();
  if(t===TODAY)return false;
  TODAY=t;
  return true;
}
const $=s=>document.querySelector(s);
/* Pet tabova. Progres i Povrede su spojeni u Oporavak — v. renderOporavak. */
const PAGES={danas:renderDanas,plan:renderPlan,opor:renderOporavak,pred:renderPred,zajed:renderZajednica};
/* PREČICE NA IKONICI (dug pritisak na instaliranoj aplikaciji).
   Manifest ih nudi kao adrese `./?tab=plan`, pa aplikacija mora da ume da ih
   pročita — inače bi svaka prečica otvarala Danas i bila laž. Nepoznata ili
   nepostojeća vrednost tiho pada na Danas; ovo je ulaz sa strane i ne sme da
   obori otvaranje. */
/* OTVOREN EKRAN PREŽIVLJAVA PONOVNO UČITAVANJE.
   Ažuriranje aplikacije završava `location.reload()` (v. `controllerchange`), a
   do sada se posle toga uvek otvarao Danas — čovek bi bio na Oporavku, kliknuo
   „Osveži", i našao se negde drugde. Podaci i sesija prežive uredno; gubilo se
   samo mesto na kom je bio.

   `sessionStorage`, ne `localStorage`, i to je ceo izbor: pamćenje mora da traje
   tačno koliko i ova kartica. Preko `localStorage` bi aplikacija sutra ujutru
   otvarala ekran na kom si slučajno stao juče uveče — a Danas je mesto sa kog se
   počinje. Isti mehanizam i isti razlog kao kod uvodnog ekrana (v. vrh fajla).

   `?tab=` IMA PREDNOST. Prečica sa ikonice je izričita namera „hoću baš tu";
   pamćenje je samo nastavak prekinutog. Kad se sudare, pobeđuje izričito. */
const TAB_KLJUC='sub19-tab';
function pocetnaStrana(){
  try{
    const t=new URLSearchParams(location.search).get('tab');
    if(t&&Object.prototype.hasOwnProperty.call(PAGES,t)) return t;
  }catch(e){}
  try{
    const z=sessionStorage.getItem(TAB_KLJUC);
    if(z&&Object.prototype.hasOwnProperty.call(PAGES,z)) return z;
  }catch(e){}   /* privatni režim ume da zabrani sessionStorage — tada Danas */
  return 'danas';
}
let ACTIVE='danas';
const openW=new Set();
{const w=weekOf(TODAY);openW.add(w?w.w:1);}

function plDan(n){const m=n%10,h=n%100;return(m===1&&h!==11)?'dan':'dana';}
/* SRPSKI BROJI U TRI OBLIKA, po POSLEDNJOJ cifri — osim 11–14, koji uvek idu
   u treći („11 adresa", ne „11 adresa"→„adresa" preko jedinice).
   `plDan` pokriva samo reči kod kojih su drugi i treći oblik isti
   (dan/dana/dana, trening/treninga/treninga), pa je za njih dovoljan.
   Kod „adresa" se sva tri razlikuju: 1 adresu · 2 adrese · 5 adresa. */
function pl3(n,jedan,dva,pet){const m=n%10,h=n%100;
  if(m===1&&h!==11)return jedan;
  if(m>=2&&m<=4&&(h<12||h>14))return dva;
  return pet;}
function fmtDY(s){const d=s2d(s);if(!validDatum(d))return'—';return pad2(d.getDate())+'.'+pad2(d.getMonth()+1)+'.'+d.getFullYear()+'.';}

function renderHeader(){
  let t;
  const nW=CUR_PLAN.length;
  if(TODAY<CUR_START)t='Start: '+fmtDY(CUR_START)+' · Trka: '+fmtDY(CUR_RACE);
  else if(TODAY>CUR_RACE)t='Plan završen · Trka: '+fmtDY(CUR_RACE);
  else{
    const w=weekOf(TODAY),dd=diffD(TODAY,CUR_RACE);
    t=(w?'Nedelja '+w.w+' / '+nW+' · ':'')+(dd===0?'DANAS JE TRKA 🏁':dd+' '+plDan(dd)+' do trke');
  }
  $('#h-sub').textContent=t;
}

/* AMBIJENTALNO SVETLO PO TABU.
   Menja se samo `opacity` sloja koji već postoji u HTML-u — gradijenti se ne
   mogu animirati, pa bi svako drugo rešenje dalo trzaj umesto pretapanja. */
function ambijent(tab){
  const sl=document.querySelectorAll('#ambijent i');
  if(!sl||!sl.length) return;
  sl.forEach(x=>x.classList.toggle('on', x.dataset.t===tab));
}
/* Poslednji tab pre nego što su se otvorila podešavanja — da se svetlo vrati
   na svoje kad se list zatvori. */
let AMB_PRE=null;

let USKOK_TMR=null;
function setPage(p){
  /* Dan se mogao promeniti dok je aplikacija stajala otvorena. Kad jeste,
     ZAGLAVLJE MORA DA IDE SA NJIM — ono nosi „Nedelja N / M · X dana do trke", a
     to su brojevi izvedeni iz datuma.

     Prijava iz upotrebe: posle ponoći je telo prešlo na novi dan (97 dana, N2), a
     zaglavlje ostalo na starom (98 dana, Nedelja 1) — dva različita broja dana do
     trke na istom ekranu. I nije se popravljalo samo: povratna vrednost se ovde
     nije gledala, pa je prelazak preko ponoći bio POTROŠEN ovde, a grana u
     `visibilitychange` koja jedina zove `renderHeader()` posle toga dobija
     `false` i preskoči se. Ostajalo je pogrešno do ponovnog učitavanja stranice. */
  if(osveziDan()) renderHeader();
  /* Zapamti gde smo, da ponovno učitavanje (npr. posle „Osveži") vrati ovde. */
  try{ sessionStorage.setItem(TAB_KLJUC, p); }catch(e){}
  const drugi = ACTIVE!==p;
  ACTIVE=p;
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.pg===p));
  document.querySelectorAll('.page').forEach(x=>{x.classList.remove('active');x.classList.remove('uskoci');});
  const el=$('#pg-'+p);
  el.classList.add('active');
  ambijent(p);
  /* Kartice se slažu jedna za drugom SAMO kad se stvarno menja tab. Ekran se
     iznova iscrtava i pri svakoj sitnici (obeležen trening, unet kilometar) —
     da animacija visi na .active, ceo ekran bi se ponovo slagao posle svakog
     dodira. Klasa se skida čim animacija istekne.

     ROK MORA DA PREŽIVI NAJDUŽU ANIMACIJU KOJA NA NJEMU VISI. Na `uskoci` sada
     visi i punjenje prstenova (.7 s) i crtanje linija na grafikonima (.08 +
     .75 s), a ne samo slaganje kartica (.22 + .34 s). Da je rok ostao na 620
     ms, klasa bi nestala usred crtanja i linija bi vidno „pukla" u pun potez.
     Zato 900 — taman iznad najduže (830 ms), bez suvišnog visenja. */
  if(drugi){
    el.classList.add('uskoci');
    clearTimeout(USKOK_TMR);
    USKOK_TMR=setTimeout(()=>el.classList.remove('uskoci'),900);
  }
  PAGES[p]();
  if(p==='zajed') zajMozdaOsvezi();
  window.scrollTo(0,0);
}

/* ---------- TRAKA O NOVOM ----------

   Nov ekran koji niko ne otvori isto je što i nema ga. Mejl i push stižu samo
   onome ko ih je uključio, pa ovo hvata ostale — u aplikaciji, jednom.

   KLJUČ JE IME OBJAVE, NE BROJ VERZIJE. Da se pamtila verzija, traka bi se
   vratila pri sledećem ažuriranju iako je već pročitana.

   NE POKAZUJE SE:
     — novom korisniku (`firstRun` posle objave): njemu Zajednica nije novost
       nego zatečeno stanje, a traka „novo" o nečemu što oduvek postoji samo
       zbunjuje;
     — neprijavljenom: Zajednica traži nalog, pa bi dugme vodilo na ekran koji
       za njega ne postoji.

   Kad prođe, `NOVOST` se postavi na `null` i traka nestaje svima. */
const NOVOST = {
  kljuc: 'zajednica',
  od: '2026-08-08',
  naslov: 'Novo: Zajednica',
  tekst: 'Nedeljni izazov i tabela sa ostalima koji trče po planu. Uključuje se ručno — podrazumevano je isključena.',
  dugme: 'Pogledaj'
};
function novostZaPrikaz(){
  if(!NOVOST) return null;
  if(!sbAuthed()) return null;
  if(S.ui&&S.ui.novo===NOVOST.kljuc) return null;
  const prvi=S.ui&&S.ui.firstRun;
  if(prvi&&String(prvi)>=NOVOST.od) return null;
  return NOVOST;
}
function novostVidjena(){
  if(!NOVOST) return;
  if(S.ui) S.ui.novo=NOVOST.kljuc;
  save();
}

/* ---------- DANAS ---------- */
function renderDanas(){
  const el=$('#pg-danas');
  const dd=diffD(TODAY,CUR_RACE),st=streak(TODAY);
  let h='';
  /* Predlog, ne prinuda: plan koji gleda nije njegov, ali ima unose na njemu. */
  if(tudjPlanSaUnosima())h+=`<div class="kb warn"><div style="flex:1"><div>Ovo nije tvoj plan</div><small>Gledaš ugrađeni plan sa tuđim datumom trke i tuđim tempom. Napravi svoj — postojeći unosi ostaju sačuvani u backup-u.</small></div><button id="tp-gen" style="color:var(--amber);font-weight:800;font-size:.8rem;padding:6px 10px;white-space:nowrap">Napravi svoj</button></div>`;
  if(backupDue(TODAY))h+=`<div class="bban"><span style="flex:1">Uradi backup podataka.</span><button id="bb-do">Izvezi</button><button id="bb-later" style="color:var(--txt3)">Kasnije</button></div>`;
  const nov=novostZaPrikaz();
  /* Tekst objave stoji u kodu, ne u podacima — `esc` je svejedno tu, da se
     pravilo „ništa ne ide u HTML neescapovano" ne lomi na izuzetku koji sutra
     neko preslika na polje koje jeste iz podataka. */
  if(nov)h+=`<div class="nban"><div class="nb-t"><b>${esc(nov.naslov)}</b><small>${esc(nov.tekst)}</small></div>
    <div class="nb-d"><button id="nb-go">${esc(nov.dugme)}</button><button id="nb-x" aria-label="Zatvori">Sakrij</button></div></div>`;
  h+=`<div class="hero">
    <div class="card accent"><div class="big">${dd>0?dd:(dd===0?'🏁':'✓')}</div><div class="big-sub">${dd>0?plDan(dd)+' do trke':(dd===0?'danas je trka':'trka je prošla')}</div><div class="big-sub" style="color:var(--txt3)">${fmtDL(CUR_RACE)}</div></div>
    <div class="card"><div class="big" style="color:var(--green)">${st}</div><div class="big-sub">${plDan(st)} po planu</div><div class="big-sub" style="color:var(--txt3)">🔥 streak</div></div>
  </div>`;
  h+=`<div style="font-size:.8rem;color:var(--txt2);font-weight:700;margin:2px 2px 10px">${fmtDL(TODAY)}</div>`;
  const d=BY_DATE[TODAY];
  if(!d){
    if(TODAY<CUR_START)h+=`<div class="card empty">Plan počinje ${fmtDL(CUR_START)}.</div>`;
    else h+=`<div class="card empty">Plan je završen. Rezultat trke je u tabu Plan → N${CUR_PLAN.length}.</div>`;
  }else if(d.rest){
    h+=`<div class="card"><span class="tag odmor">Odmor</span><div class="desc">${esc(d.desc||'Dan odmora po planu.')}</div>${nextLine(TODAY)}</div>`;
  }else{
    h+=dayCard(d);
  }
  el.innerHTML=h;
  if(d&&!d.rest)bindDayCard(el,d);
  const tp=$('#tp-gen');
  /* Backup se NUDI pre nego sto se ode u carobnjaka: unosi na hardkodovanom
     planu posle toga vise nemaju gde da se prikazu, pa neka ih bar ima u
     fajlu. Odbijanje ne blokira — plan je njegov izbor. */
  if(tp)tp.onclick=()=>{
    if(confirm('Prvo izvezi backup postojećih unosa?\n\nOK = izvezi pa nastavi\nOtkaži = idi odmah na pravljenje plana')) exportBackup();
    openWizard();
  };
  const b1=$('#bb-do'),b2=$('#bb-later');
  if(b1)b1.onclick=exportBackup;
  if(b2)b2.onclick=()=>{S.ui.snooze=addD(TODAY,7);save();renderDanas();};
  /* Oba dugmeta zatvaraju traku zauvek: i „video sam" i „ne zanima me" su
     odgovor. Traka koja se vraća posle odgovora je greška, ne podsetnik. */
  if(nov){
    const g=$('#nb-go'),x=$('#nb-x');
    if(g)g.onclick=()=>{novostVidjena();setPage('zajed');};
    if(x)x.onclick=()=>{novostVidjena();renderDanas();};
  }
}
function nextLine(from){
  const nx=DATED.find(x=>x.date>from&&!x.rest);
  return nx?`<div class="note-src">Sledeći trening: ${dowOf(nx.date)} ${fmtD(nx.date)} — ${esc(sessKind(nx))}${nx.km?' · '+fmtKm(nx.km)+' km':''}</div>`:'';
}
/* ============================================================
   LOKACIJA — ZAŠTO NIJE STIGLA

   PRIJAVA: „Lokacija nije dostupna, a upalio sam je kad sam pravio aplikaciju."

   Bila je jedna rečenica za tri različite stvari: ugašena lokacija na telefonu,
   odbijena dozvola, i istekla potraga. Sve troje je izgledalo isto, pa se iz
   poruke nije moglo saznati šta da se uradi.

   Uz to je uputstvo pominjalo „podešavanja pregledača" — što je tačno na vebu,
   a pogrešno u instaliranoj Android aplikaciji (TWA): tamo dozvola pripada
   SAMOJ APLIKACIJI, u sistemskim podešavanjima telefona. Uključivanje
   „location delegation" pri pakovanju samo znači da aplikacija SME da traži
   lokaciju — Android i dalje mora da je odobri, jednom, na sopstveni upit.
   ============================================================ */
function uAplikaciji(){
  try{
    return (window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)
        || navigator.standalone===true;
  }catch(e){ return false; }
}
function geoTrazi(opcije){
  return new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,opcije));
}
/* Unapred poznato odbijanje. `permissions` ne postoji svuda (stariji Safari),
   pa se tiho preskače — tada se prosto pita i čeka odgovor. */
async function geoOdbijena(){
  try{
    if(!navigator.permissions||!navigator.permissions.query) return false;
    const st=await navigator.permissions.query({name:'geolocation'});
    return !!st&&st.state==='denied';
  }catch(e){ return false; }
}
function geoPoruka(err){
  const kod=err&&err.code;
  const uApp=uAplikaciji();
  if(kod===1){
    return uApp
      ? 'Pristup lokaciji je odbijen.\n\nPodešavanja telefona → Aplikacije → SUB-20 → Dozvole → Lokacija → „Dozvoli dok se aplikacija koristi". Pa se vrati ovde i probaj ponovo.'
      : 'Pristup lokaciji je odbijen.\n\nUključi ga u podešavanjima pregledača za ovu stranicu (ikonica pored adrese → Lokacija), pa probaj ponovo.';
  }
  if(kod===3){
    return 'Traženje lokacije je isteklo.\n\nProbaj ponovo — pomaže da izađeš napolje ili blizu prozora. Uključen Wi-Fi ubrzava grubo određivanje i kad nisi povezan ni na jednu mrežu.';
  }
  /* kod 2 (POSITION_UNAVAILABLE) i sve ostalo. U aplikaciji je ovo najčešće
     ugašena sistemska lokacija ili dozvola koja nikad nije data. */
  return uApp
    ? 'Lokacija trenutno nije dostupna.\n\nProveri dve stvari:\n1. Lokacija je uključena u brzim podešavanjima telefona (ikonica sa iglom).\n2. Podešavanja telefona → Aplikacije → SUB-20 → Dozvole → Lokacija je dozvoljena.'
    : 'Lokacija trenutno nije dostupna.\n\nProveri da li je Lokacija uključena na samom telefonu, pa probaj ponovo.';
}

/* ============================================================
   VREME NA DAN TRENINGA

   Sve ostalo u aplikaciji opisuje PROŠLOST. Ovo je jedini podatak koji menja
   ODLUKU pre nego što izađeš: na 34 °C intervali na planskom tempu nisu isti
   trening nego drugi, teži, i sa manjim prinosom.

   ZAŠTO DIREKTNO SA api.open-meteo.com, A NE PREKO NAŠEG SERVERA:
   svi ostali spoljni pozivi idu preko servera zato što nose ključ ili zato što
   servis ne šalje CORS zaglavlja. Ovde ne važi ni jedno ni drugo — Open-Meteo
   je bez ključa i sa CORS-om. A da ide preko nas, KOORDINATE korisnika bi
   morale da prođu kroz naš server; ovako ih vidi samo servis koji ih i mora
   videti. Zato je i u CSP dodat samo taj jedan domen.

   Koordinate se zaokružuju na dve decimale (~1 km): dovoljno za vremensku
   prognozu, a manje precizno od kućne adrese. Čuvaju se lokalno i idu u backup
   kao i svaki drugi podatak. */
const VREME_URL='https://api.open-meteo.com/v1/forecast';
/* KOLIKO VRUĆINA USPORAVA — približno, i tako je i označeno na ekranu.
   Literatura se slaže oko smera i reda veličine, ne oko tačne krive; brojevi
   ispod prate uobičajenu trenersku smernicu (~1-2% po 3 °C iznad ~15 °C) i
   namerno su konzervativni. Gleda se OSEĆAJ (apparent temperature), ne
   temperatura vazduha: vlažnost je ta koja ubija hlađenje znojenjem. */
const VRUCINA=[
  { od:35, pct:8, rec:'Preko 35 °C osećaja — kvalitetnu sesiju pomeri ili zameni laganim trčanjem. Tempo tu više ne meri formu.' },
  { od:30, pct:6, rec:'Na ovoj vrućini radni deo drži po osećaju, ne po satu. Skrati ako puls ode iznad uobičajenog za taj tempo.' },
  /* %PCT% se zamenjuje procentom pri iscrtavanju (v. karticaVremena).
     Ranije je ovde stajalo „ciljni tempo je realno OVOLIKO sporiji" — pokazna
     rec koja trazi broj pored sebe. Broj, medjutim, daje red „tempo uz
     vrucinu", a on po dizajnu postoji samo na kvalitetnim sesijama, pa je na
     laganom danu recenica pokazivala u prazno: savet koji tvrdi da je nesto
     „ovoliko" sporije, bez ijedne cifre. Sada tekst nosi broj i stoji sam. */
  { od:25, pct:4, rec:'Toplo — ciljni tempo je realno oko %PCT% sporiji. To nije pad forme.' },
  { od:20, pct:2, rec:'Blago toplo; računaj na oko %PCT% sporiji tempo pri istom naporu.' },
  { od:15, pct:1, rec:'' },
  { od:-99, pct:0, rec:'' }
];
function vrucinaZa(osecaj){
  if(osecaj==null||!isFinite(osecaj)) return null;
  return VRUCINA.find(x=>osecaj>=x.od)||null;
}
function vremeCist(j){
  const h=j&&j.hourly;
  if(!h||!Array.isArray(h.time)||!h.time.length) return null;
  const uzmi=(niz,i)=>(Array.isArray(niz)&&niz[i]!=null&&isFinite(niz[i]))?Math.round(niz[i]*10)/10:null;
  const sati={};
  h.time.forEach((t,i)=>{
    if(typeof t!=='string') return;
    sati[t.slice(0,13)]={
      temp:uzmi(h.temperature_2m,i), osecaj:uzmi(h.apparent_temperature,i),
      vlaga:uzmi(h.relative_humidity_2m,i), vetar:uzmi(h.wind_speed_10m,i),
      kisa:uzmi(h.precipitation_probability,i)
    };
  });
  return Object.keys(sati).length?sati:null;
}
async function vremePovuci(sila){
  const g=S.ui&&S.ui.geo;
  if(!g||g.lat==null||g.lon==null) return {ok:false, error:'Lokacija nije podešena.'};
  const v=S.vreme;
  /* Prognoza se ne menja iz minuta u minut — jedan poziv na tri sata je dovoljan,
     a i lepo prema besplatnom servisu.
     ALI: „mlad" keš i „upotrebljiv" keš nisu isto. Zapis dolazi i iz backupa i
     sa drugog uređaja preko servera, pa `at` može biti svež a da u njemu nema
     sata koji nam upravo treba. Tada je red „sada" tiho izostajao — kartica bi
     se iscrtala bez njega i izgledala kao pre v181. Zato se traži i POKRIVENOST
     trenutnog sata, ne samo starost. */
  const kljucSada=todayStr()+'T'+String(new Date().getHours()).padStart(2,'0');
  const pokriva=!!(v&&v.sati&&v.sati[kljucSada]);
  if(!sila&&v&&v.at&&Date.now()-v.at<3*3600000&&v.lat===g.lat&&v.lon===g.lon&&pokriva) return {ok:true, kes:true};
  try{
    const u=VREME_URL+'?latitude='+encodeURIComponent(g.lat)+'&longitude='+encodeURIComponent(g.lon)+
      '&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation_probability'+
      '&forecast_days=3&timezone=auto';
    const r=await fetch(u);
    if(!r.ok) return {ok:false, error:'Vremenska prognoza trenutno nije dostupna.'};
    const sati=vremeCist(await r.json());
    if(!sati) return {ok:false, error:'Prognoza je stigla u neočekivanom obliku.'};
    S.vreme={at:Date.now(), lat:g.lat, lon:g.lon, sati}; save();
    return {ok:true, n:Object.keys(sati).length};
  }catch(e){ return {ok:false, error:'Nema veze sa vremenskom službom.'}; }
}
function vremeZaSat(datum, sat){
  const v=S.vreme; if(!v||!v.sati||!datum) return null;
  return v.sati[datum+'T'+String(sat).padStart(2,'0')]||null;
}
/* Trenutni sat — samo za DANAS, i samo ako prognoza pokriva taj sat.
   Kartica je do sada pokazivala isključivo sat treninga; ko je otvori u 14 h
   video je brojeve za 20 h bez ijednog podatka o tome kako je NAPOLJU sada, pa
   je rečenicu o hladnijem satu čitao kao trenutnu temperaturu. */
function vremeSada(datum){
  if(datum!==TODAY) return null;
  const h=new Date().getHours();
  const z=vremeZaSat(datum,h);
  return z?{sat:h, z}:null;
}
/* Najhladniji sat u razumnom prozoru za trčanje. Nudi se samo kad je razlika
   dovoljna da promeni odluku — pomeranje treninga zbog pola stepena nije savet
   nego smetnja. */
function najboljiSat(datum, odabrani){
  const v=S.vreme; if(!v||!v.sati) return null;
  /* Za DANAS se gledaju samo sati koji tek dolaze: „idi u 5:00" u dva po podne
     nije savet nego zbunjivanje — a upravo tako je i pročitano. */
  const prvi=(datum===TODAY)?Math.max(5,new Date().getHours()+1):5;
  let naj=null;
  for(let h=prvi;h<=21;h++){
    const z=vremeZaSat(datum,h);
    if(!z||z.osecaj==null) continue;
    if(!naj||z.osecaj<naj.osecaj-0.01) naj={sat:h, osecaj:z.osecaj};
  }
  if(!naj) return null;
  const sad=vremeZaSat(datum,odabrani);
  if(!sad||sad.osecaj==null) return naj;
  return (sad.osecaj-naj.osecaj>=3 && naj.sat!==odabrani) ? naj : null;
}
function satTreninga(){
  const h=S.ui&&S.ui.satTreninga;
  return (h!=null&&isFinite(h)&&h>=0&&h<=23)?+h:18;
}
function karticaVremena(d){
  if(!d||d.rest||!d.date) return '';
  if(d.date<TODAY) return '';                    /* prognoza za prošlost nema smisla */
  const g=S.ui&&S.ui.geo;
  if(!g) return '';
  const sat=satTreninga();
  const z=vremeZaSat(d.date,sat);
  if(!z) return '';
  const vr=vrucinaZa(z.osecaj);
  const redovi=[];
  const stepeni=x=>`<b>${esc(fmtNum(x.temp,0))} °C</b>`+
    (x.osecaj!=null&&x.temp!=null&&Math.abs(x.osecaj-x.temp)>=1?` <small>oseća se ${esc(fmtNum(x.osecaj,0))} °C</small>`:'');
  const sada=vremeSada(d.date);
  if(sada&&sada.sat!==sat) redovi.push([`sada · ${sada.sat}:00`, stepeni(sada.z)]);
  redovi.push([sada&&sada.sat!==sat?`u ${sat}:00`:'temperatura', stepeni(z)]);
  if(z.vlaga!=null) redovi.push(['vlažnost', `<b>${esc(fmtNum(z.vlaga,0))} %</b>`]);
  if(z.vetar!=null) redovi.push(['vetar', `<b>${esc(fmtNum(z.vetar,0))} km/h</b>`]);
  if(z.kisa!=null) redovi.push(['padavine', `<b>${esc(fmtNum(z.kisa,0))} %</b>`]);
  /* PRILAGOĐEN TEMPO SE RAČUNA SVUDA GDE POSTOJI OSNOVA.
     Ranije je red izlazio samo za kvalitetne sesije (int/tempo), uz obrazloženje
     da se na laganom ide po osećaju pa bi broj bio lažna preciznost. Namera je
     bila dobra, ishod nije: savet je i dalje TVRDIO da je tempo sporiji, samo je
     prepuštao čoveku da sam množi svoj tempo sa 1,04. Ako aplikacija zna i tempo
     i procenat, račun je njen posao.

     Uslov više nije tip dana nego POSTOJANJE OSNOVE — v. cilJTempoDana(). Gde
     osnove nema (dan snage, ili nemerena forma), reda nema i rečenica sa
     procentom ostaje jedino što se nudi. */
  let dodatak='';
  if(vr&&vr.pct>0){
    const cilj=cilJTempoDana(d);
    if(cilj) dodatak+=`<div class="drow"><span class="l">tempo uz vrućinu</span><span class="v">`+
      `<b>${esc(fmtTempo(Math.round(cilj*(1+vr.pct/100))))}</b> <small>umesto ${esc(fmtTempo(cilj))} · +${esc(vr.pct)} %</small></span></div>`;
  }
  const bolji=najboljiSat(d.date,sat);
  const nap=[];
  /* Procenat ulazi u SAM tekst — red „tempo uz vrucinu" sa konkretnim tempom
     postoji samo na kvalitetnim sesijama, pa se recenica ne sme oslanjati na
     njega. Na laganom danu je ovo jedini broj koji covek dobije, i to je
     dovoljno: apsolutan tempo se tamo namerno ne nudi. */
  if(vr&&vr.rec) nap.push(vr.rec.replace('%PCT%', vr.pct+' %'));
  /* „U 5:00 je osećaj 25 °C" je čitano kao TRENUTNA temperatura. Rečenica sada
     počinje glagolom i imenuje dan, pa ne može da se pomeša sa „sada". */
  if(bolji) nap.push(`Hladnije je u ${bolji.sat}:00 (${d.date===TODAY?'danas':dowOf(d.date)+' '+fmtD(d.date)}): osećaj ${fmtNum(bolji.osecaj,0)} °C, ${Math.round((z.osecaj-bolji.osecaj))} °C manje nego u ${sat}:00.`);
  nap.push('Procena usporavanja je približna, ne formula — služi da tempo na vrućini ne pročitaš kao pad forme.');
  return dKarta('Vreme', esc(fmtD(d.date)+' u '+sat+':00'),
    `<div class="drows">${dRedovi(redovi).replace(/^<div class="drows">|<\/div>$/g,'')}${dodatak}</div>`+
    `<div class="note-src">${esc(nap.join(' '))}</div>`);
}
/* Ciljni tempo radnog dela za dan — iz sesije kad postoji, inače iz PRED reda
   plana. Bez njega se prilagođen tempo ne prikazuje (ne izmišlja se osnova). */
/* Lagana trčanja NEMAJU tempo nigde u planu — ni u opisu dana, ni u PRED
   tabeli (provereno: `extractPaceFromDesc` na „8 km lako + 5×100 m" vraća
   null, `predRowFor` vraća null). Jedini izvor je forma, kroz iste Danielsove
   zone kojima plan računa sve ostalo. Da to nije nategnuto vidi se na
   kvalitetnim danima, gde postoje OBA broja: plan traži 3:55 i 4:25, a zone iz
   istog VDOT-a daju 3:57 i 4:23 — razlika od dve sekunde po kilometru. */
const ZONA_ZA_TAG={ lako:'E', lr:'LR' };
function cilJTempoDana(d){
  if(d&&d.session&&d.session.paceSec>0) return d.session.paceSec;
  const r=predRowFor(d);
  const red=r?CUR_PRED.find(x=>x.id===r):null;
  if(red&&red.pt>0) return red.pt;
  /* Rezerva iz forme — samo za trčanja sa poznatom zonom. Dan snage nema tempo
     i ne sme ga dobiti; „rw" (trčanje/hod) takođe ne, tamo tempo ne meri isto. */
  const zona=d&&ZONA_ZA_TAG[d.tag];
  if(!zona) return null;
  /* Bez izmerene forme nema računa. `currentVdot()` je null na svežem uređaju,
     a `paceForZone(null, …)` vraća besmislicu (mereno: 40:11 /km) — bez ove
     provere bi nov korisnik na prvom laganom danu dobio baš taj broj. */
  const v=currentVdot();
  if(v==null||!isFinite(v)||v<20||v>85) return null;
  return paceForZone(v, zona);
}

/* ============================================================
   ISTA SESIJA RANIJE

   VDOT kriva i predikcija sažimaju SVE u jedan broj, pa se iz njih ne vidi ono
   što trkača zapravo zanima: „isti trening kao pre tri nedelje — je li lakši?"
   Poređenje jabuka sa jabukama je direktniji dokaz napretka od bilo kakve
   izvedene mere, jer između dva ista treninga nema nijedne pretpostavke.

   ŠTA JE „ISTA SESIJA": isti tip (Intervali/Tempo/…) I ista struktura radnog
   dela. 6×800 i 5×1000 su oba „Intervali", ali nisu isti trening i njihovo
   poređenje po tempu ne znači ništa. Struktura se čita iz `session` objekta kad
   postoji (generisan plan), inače iz QS tabele (hardkodovan plan) — ista dva
   izvora koje već koristi Strava lap-detekcija.

   LAGANA TRČANJA SE NE POREDE PO TEMPU.
   Na laganom se ide po osećaju, pa je razlika u tempu između dva takva trčanja
   šum — a ne dokaz ni napretka ni pada. Ono što se sa aerobnom bazom stvarno
   menja jeste PULS na tom tempu i DRIFT (koliko odnos tempo/puls padne u
   drugoj polovini trčanja). Oba broja aplikacija već ima — puls iz unosa ili sa
   sata, drift iz `l.decoupling` — ali su se do sada videli samo za taj jedan
   dan, bez ičega sa čim bi se uporedili.

   Potpis laganog trčanja je POJAS DISTANCE, ne struktura: „8 km lako" i
   „9 km lako" su isti stimulus i porede se, 8 km i 20 km nisu. */
const LAKO_POJAS=2;            /* km — širina pojasa u kom se lagana trčanja porede */
const TEMPO_UPOREDIV=10;       /* s/km — preko ove razlike puls više ne meri istu stvar */
function jeLagano(d){ return !!d && (d.tag==='lako'||d.tag==='lr'); }
function sesijaPotpis(d){
  if(!d||d.rest) return null;
  if(jeLagano(d)){
    const km=+d.km;
    if(!(km>0)) return null;
    return sessKind(d)+'|~'+(Math.round(km/LAKO_POJAS)*LAKO_POJAS);
  }
  if(d.tag!=='int'&&d.tag!=='tempo') return null;
  const ses=d.session;
  let struktura=null;
  if(ses){
    if(ses.type==='int'&&ses.reps&&ses.repM) struktura=ses.reps+'x'+ses.repM;
    else if(ses.type==='pyramid'&&Array.isArray(ses.reps)) struktura=ses.reps.join('-');
    else if(ses.type==='tempo'&&ses.qKm) struktura='t'+r1(ses.qKm);
    else if(ses.type==='fartlek'&&ses.reps) struktura='f'+ses.reps+'x'+ses.repSec;
  }
  if(!struktura){
    const spec=qsFor(d.id);
    if(Array.isArray(spec)&&spec.length) struktura=spec.join('-');
  }
  if(!struktura) return null;
  return sessKind(d)+'|'+struktura;
}
/* Merenja jednog odrađenog dana, u obliku u kom se porede — jedno mesto za
   OBE vrste dana, da današnji broj i onaj od pre tri nedelje nikad ne dođu iz
   dva različita računa.
   Kvalitetna sesija: tempo RADNOG dela (isti broj koji ide u VDOT), ne prosek
   celog trčanja — inače bi duže zagrevanje izgledalo kao sporiji trening.
   Lagano trčanje: prosečan tempo CELOG trčanja (radnog dela nema), puls i drift. */
function merenjaDana(x, l){
  if(!x||!l) return null;
  const lako=jeLagano(x);
  const br=v=>(v==null||v===''||typeof v==='boolean'||!Number.isFinite(+v))?null:+v;
  let tempo=null;
  if(lako){
    const km=br(l.km), sec=br(l.sec);
    if(km>0&&sec>0) tempo=Math.round(sec/km);
  } else {
    const pid=predRowFor(x);
    tempo=(pid&&S.pred[pid]!=null) ? S.pred[pid]
        : (Array.isArray(l.laps)&&l.laps.length ? icuRadniTempo(l.laps) : null);
  }
  const laps=Array.isArray(l.laps)?l.laps:[];
  const gaps=laps.filter(y=>y&&y.gapSec>0&&y.distM>0);
  const gap=(!lako&&gaps.length&&gaps.length===laps.length)
    ? Math.round(gaps.reduce((a,y)=>a+y.gapSec*y.distM/1000,0)/(gaps.reduce((a,y)=>a+y.distM,0)/1000))
    : null;
  /* Na laganom trčanju krugova nema (ili su proizvoljni auto-lap kilometri),
     pa je merodavan prosek celog trčanja — isti broj koji stoji u „Uneto". */
  const hrs=laps.map(y=>y&&y.avgHr).filter(y=>br(y)!=null).map(Number);
  const hr=(!lako&&hrs.length) ? Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length) : (br(l.hr)>0?Math.round(br(l.hr)):null);
  const dr=(l.decoupling&&typeof l.decoupling==='object')?br(l.decoupling.n):null;
  return { tempo, gap, hr, drift:dr!=null?Math.round(dr*10)/10:null, temp:br(l.temp) };
}
/* Ranije odrađene sesije istog potpisa, najnovija prva. */
function isteSesije(d, maxN){
  const potpis=sesijaPotpis(d);
  if(!potpis) return [];
  const lako=jeLagano(d);
  const out=[];
  DATED.forEach(x=>{
    if(x.id===d.id) return;
    if(d.date&&x.date&&x.date>=d.date) return;      /* samo RANIJE */
    if(sesijaPotpis(x)!==potpis) return;
    const l=S.log[x.id];
    if(!l||l.status!=='done') return;
    const m=merenjaDana(x,l);
    if(!m) return;
    /* Kvalitetnoj sesiji je tempo ceo smisao poređenja; laganom trčanju NIJE —
       ono se poredi po pulsu i driftu, pa red bez tempa i dalje nosi podatak. */
    if(lako ? (m.hr==null&&m.drift==null) : !m.tempo) return;
    out.push(Object.assign({ dan:x, datum:l.runDate||l.ts||x.date }, m));
  });
  out.sort((a,b)=>a.datum<b.datum?1:-1);
  return out.slice(0, maxN||3);
}
/* Razlika sa znakom i bojom. `manjeJeBolje` jer niži puls i manji drift znače
   napredak, dok kod tempa isto važi (brže = manji broj) — ali se koristi i
   neutralna boja kad poređenje ne važi (v. `uporedivo` na laganom). */
function razlikaHTML(sad, pre, jed, dec, uporedivo){
  if(sad==null||pre==null) return '';
  const raz=Math.round((sad-pre)*10**(dec||0))/10**(dec||0);
  const boja=(uporedivo===false)?'var(--txt3)':raz<0?'var(--green)':raz>0?'var(--pink)':'var(--txt3)';
  const znak=raz<0?'−':raz>0?'+':'±';
  return ` <small style="color:${boja}">${znak}${esc(fmtNum(Math.abs(raz),dec||0))}${jed?' '+jed:''}</small>`;
}
/* Lagana trčanja: puls i drift su brojevi, tempo i temperatura su kontekst.
   Razlika u pulsu se BOJI samo kad je tempo uporediv — niži puls na 30 s/km
   sporijem trčanju nije napredak nego sporije trčanje. Vrućina isto diže puls,
   pa temperatura stoji uz tempo, a ne kao fusnota. */
function karticaLaganaRanije(d, ranije, sada){
  /* Bez ijednog pulsa i bez ijednog drifta ostaje samo poređenje tempa laganih
     trčanja — a to je tačno ono što ništa ne znači. Tada se kartica ne crta. */
  if(![sada].concat(ranije).some(x=>x&&(x.hr!=null||x.drift!=null))) return '';
  const red=x=>{
    const uporedivo=(sada.tempo!=null&&x.tempo!=null)?Math.abs(sada.tempo-x.tempo)<=TEMPO_UPOREDIV:false;
    const levo=[x.tempo!=null?fmtTempo(x.tempo)+'/km':null, x.temp!=null?fmtNum(x.temp,0)+' °C':null].filter(Boolean).join(' · ');
    const puls=x.hr!=null
      ? `<b>${esc(x.hr)}</b> <small>bpm</small>${razlikaHTML(sada.hr, x.hr, '', 0, uporedivo)}`
      : `<small>bez pulsa</small>`;
    /* Drift je DRUGI po važnosti broj u redu, ne ravnopravan pulsu — otud
       `.sec`. Boja je ista skala kao na kartici „Sa sata" (v. bojaDrifta).
       Razlika u driftu se boji UVEK: drift je već odnos tempo/puls, pa ne
       zavisi od toga koliko se brzo trčalo — za razliku od samog pulsa. */
    const drift=x.drift!=null
      ? ` <span class="sec">· drift <b style="color:${bojaDrifta(x.drift)}">${x.drift>0?'+':''}${esc(fmtNum(x.drift,1))} %</b></span>${razlikaHTML(sada.drift, x.drift, '', 1, true)}`
      : '';
    return `<div class="drow"><span class="l">${esc(fmtD(x.datum))}${levo?` <small>${esc(levo)}</small>`:''}</span>`+
      `<span class="v">${puls}${drift}</span></div>`;
  };
  const pojas=Math.round((+d.km||0)/LAKO_POJAS)*LAKO_POJAS;
  const nap=['Na laganom se ne poredi tempo — po njemu se ide po osećaju. Poredi se PULS na tom tempu i drift (koliko odnos tempo/puls padne u drugoj polovini). Niži puls i manji drift pri sličnom tempu znače jaču aerobnu bazu.'];
  nap.push(`Razlika u pulsu se boji samo kad je tempo u granici od ${TEMPO_UPOREDIV} s/km — inače meri brzinu, ne formu. Vrućina diže puls, zato temperatura stoji uz tempo.`);
  if(sada.hr==null&&sada.drift==null) nap.push('Kad uneseš prosečan puls za danas, prikazaće se i razlika.');
  return dKarta('Slično lagano ranije', esc(`${sessKind(d)} · ~${pojas} km`),
    `<div class="drows">${ranije.map(red).join('')}</div>`+
    `<div class="note-src">${esc(nap.join(' '))}</div>`);
}
function karticaIstaSesija(d){
  const ranije=isteSesije(d,3);
  if(!ranije.length) return '';
  const l=S.log[d.id]||{};
  const sadaM=merenjaDana(d,l)||{tempo:null,hr:null,drift:null,gap:null,temp:null};
  if(jeLagano(d)) return karticaLaganaRanije(d, ranije, sadaM);
  const sada=sadaM.tempo;
  const red=x=>{
    /* Razlika se prikazuje SAMO kad postoje oba broja — „−4 s/km" naspram
       ničega je izmišljen napredak. */
    const raz=(sada&&x.tempo)?sada-x.tempo:null;
    const boja=raz==null?'var(--txt3)':raz<-1?'var(--green)':raz>1?'var(--pink)':'var(--txt3)';
    const znak=raz==null?'':(raz<0?'−':raz>0?'+':'±')+Math.abs(raz)+' s/km';
    return `<div class="drow"><span class="l">${esc(fmtD(x.datum))}</span><span class="v">`+
      `<b>${esc(fmtTempo(x.tempo))}</b>`+
      (x.gap!=null&&Math.abs(x.gap-x.tempo)>2?` <small>GAP ${esc(fmtTempo(x.gap))}</small>`:'')+
      (x.hr!=null?` <small>${esc(x.hr)} bpm</small>`:'')+
      (x.temp!=null?` <small>${esc(x.temp)}°C</small>`:'')+
      (znak?` <small style="color:${boja}">${esc(znak)}</small>`:'')+
      `</span></div>`;
  };
  const struktura=sessCore(d);
  return dKarta('Ista sesija ranije', esc(struktura),
    `<div class="drows">${ranije.map(red).join('')}</div>`+
    `<div class="note-src">Poredi se ostvaren tempo RADNOG dela, ne prosek celog trčanja. ${
      sada?'Razlika je u odnosu na današnji.':'Kad uneseš današnji tempo, prikazaće se i razlika.'}</div>`);
}
function dayCard(d){
  const s=stFor(d.id);
  const l=S.log[d.id]||{};
  const isQuality=d.tag==='int'||d.tag==='tempo';

  /* ── PLAN: šta je za danas ── */
  let plan=dGlava('Plan',`N${d.week.w}${d.date?' · '+dowOf(d.date)+' '+fmtD(d.date):' · opciono, kraj nedelje'}`)+
    `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px">
      <span class="tag ${safeTag(d.tag)}">${esc(sessKind(d))}</span>
      <span class="st ${s}">${s==='done'?'Odrađen':s==='skip'?'Preskočen':'Predstoji'}</span></div>`;
  const rows=sessBreakdown(d);
  if(rows){
    plan+=`<div class="sess-struct">`;
    rows.forEach(r=>{ plan+=`<div class="sess-row"><span class="k">${esc(r[0])}</span><span class="v${r[2]?' hl':''}">${esc(r[1])}</span></div>`; });
    plan+=`</div>`;
    const note=sessNote(d);
    if(note)plan+=`<div class="sess-note">${esc(note)}</div>`;
  } else {
    plan+=`<div class="desc">${esc(d.desc)}</div>`;
  }
  plan+=`<div class="meta">${d.km!=null?`<div><b>${fmtKm(d.km)} km</b>plan</div>`:''}<div><b>${fmtKm(weekPlanKm(d.week))} km</b>nedelja N${d.week.w}</div><div><b>${weekRunDone(d.week)}/${weekRunCount(d.week)}</b>trčanja</div></div>`;
  if(s==='pending')plan+=`<div class="btnrow"><button class="btn" data-a="done">Završi trening</button><button class="btn ghost" data-a="skip">Preskoči</button></div>`;
  else if(s==='skip')plan+=`<div class="btnrow"><button class="btn ghost" data-a="done">Ipak sam odradio</button><button class="btn ghost sm" data-a="pending">Vrati</button></div>`;

  let c=`<div class="card${isQuality?' accent':''}" id="tcard">${plan}</div>`;
  /* Vreme ide ODMAH ispod plana i vidi se DOK trening još predstoji — posle je
     kasno, to je jedini podatak u aplikaciji koji menja odluku unapred. */
  c+=karticaVremena(d);
  if(s==='pending'||s==='skip') return c;   /* dok nije odrađen nema šta da se prikaže */

  /* ── UNETO: ono što si ti upisao ── */
  c+=dKarta('Uneto',
    l.src==='strava'?`sa Strave${l.lock?' · ručno korigovano':''}`:'',
    formHTML(d));
  /* ── SA SATA i JUTROS: ono što je stiglo samo ── */
  c+=dKarta('Sa sata','',dRedovi(metrikaSata(l)));
  c+=dKarta('Jutros','',dRedovi(oporavakRedovi(l.runDate||l.ts||d.date)));
  /* Poređenje stoji ISPOD merenja, iznad AI analize: prvo šta je bilo danas,
     pa šta je bilo prošli put, pa tek onda tumačenje. */
  c+=karticaIstaSesija(d);
  c+=aiKarta(d,l);
  return c;
}
function bindDayCard(root,d){
  root.querySelectorAll('#tcard [data-a]').forEach(b=>{
    b.onclick=()=>{
      const a=b.dataset.a;
      if(a==='skip'&&!confirm('Označi trening kao preskočen?'))return;
      const l=S.log[d.id]||(S.log[d.id]={});
      l.status=a;
      if(a==='done'&&!l.ts)l.ts=d.date||TODAY;
      save();
      if(a==='done')donePop();
      renderDanas();
    };
  });
  bindForm(root,d);
}

/* ---------- FORMA (autosave) ---------- */
function formHTML(d){
  const l=S.log[d.id]||{};
  const opt=(sel,from,to)=>{let o=`<option value="">—</option>`;for(let i=from;i<=to;i++)o+=`<option value="${i}"${sel===i?' selected':''}>${i}</option>`;return o;};
  const tempo=(l.km&&l.sec)?fmtTempo(l.sec/l.km)+' /km':'—';
  /* radni deo — samo za kvalitetne (int/tempo) sesije */
  const predIds=(d.tag==='int'||d.tag==='tempo')?predRowsFor(d):[];
  let workBlock='';
  if(predIds.length){
    /* Naslov GRUPE, ne labela jednog polja — ispod moze stajati vise radnih
       segmenata, svaki sa svojim unosom (koji ima sopstveni aria-label). */
    workBlock=`<div class="f-field full wseg-wrap" role="group" aria-label="Radni deo — ostvaren tempo">
      <span class="wseg-title">Radni deo — ostvaren tempo</span>`;
    predIds.forEach(pid=>{
      const r=CUR_PRED.find(x=>x.id===pid);
      const cur=S.pred[pid];
      const ep=effectivePace(d,r);
      workBlock+=`<div class="wseg" data-wseg="${esc(pid)}" data-q="${esc(r.q)}">
        <div class="wseg-l">${esc(r.l.split('·')[1]||r.l)} · plan ${fmtTempo(ep)} /km${S.alts&&S.alts[d.id]&&S.alts[d.id].pace!=null?' <small style="color:var(--pink)">(tvoj cilj)</small>':''} · Q ${fmtKm(r.q)} km</div>
        <input id="wseg-${esc(pid)}" class="wseg-in" inputmode="numeric" placeholder="356 = 3:56" value="${cur?fmtTempo(cur):''}" data-wpin="${esc(pid)}" aria-label="Ostvaren tempo radnog dela">
        <div class="wseg-out" data-wout="${esc(pid)}">${vdotDeltaHTML(pid,cur)}</div>
      </div>`;
      /* Tiho preskakanje je isto zamka kao tiho upisivanje pogresnog broja. */
      if(cur==null && l && l.autoOdbijen)
        workBlock+=`<div class="note-src" style="color:var(--amber);margin-top:6px">Automatski izmeren tempo (${fmtTempo(l.autoOdbijen)} /km) ne odgovara tvojoj formi — verovatno su u prosek ušla i kaskanja između deonica. Nije upisan; unesi tempo radnog dela ručno.</div>`;
    });
    workBlock+=`</div>`;
  }
  /* Podaci sa sata, jutarnja merenja i AI analiza VISE NISU ovde — svaki je
     dobio svoju karticu (v. dayCard). Ovde ostaje samo unos, tacno ono sto
     ime funkcije kaze. */
  /* PRISTUPACNOST: svaka labela dobija `for`, svako polje `id`. Ranije nijedna
     labela nije bila povezana sa svojim poljem — citac ekrana ih nije spajao,
     a dodir na labelu nije fokusirao polje. `id` nosi ID DANA jer ista forma
     postoji i na Danas kartici i u listu dana, pa bi fiksni id bio duplikat. */
  const fid=f=>`f-${f}-${esc(d.id)}`;
  return `<div class="f-grid" data-day="${esc(d.id)}">
    <div class="f-field"><label for="${fid('km')}">Distanca (km) <span class="f-req">*</span></label><input id="${fid('km')}" type="text" inputmode="decimal" data-f="km" value="${l.km!=null?String(l.km).replace('.',','):''}" placeholder="npr. 8"></div>
    <div class="f-field"><label for="${fid('sec')}">Vreme <span class="f-req">*</span></label><input id="${fid('sec')}" type="text" inputmode="numeric" data-f="sec" value="${l.sec?fmtClock(l.sec):''}" placeholder="4233 = 42:33"></div>
    <div class="f-field"><span class="f-lbl" id="lbl-tempo-${esc(d.id)}">Pros. tempo</span><div class="calc" data-tempo role="status" aria-labelledby="lbl-tempo-${esc(d.id)}">${tempo}</div></div>
    <div class="f-field"><label for="${fid('hr')}">Pros. puls</label><input id="${fid('hr')}" type="text" inputmode="numeric" data-f="hr" value="${l.hr!=null?esc(l.hr):''}" placeholder="bpm"></div>
    ${workBlock}
    <details class="f-field full more-details"><summary>Više detalja (RPE, koleno, masa, datum, beleška)</summary>
    <div class="more-grid">
    <div class="f-field"><label for="${fid('rpe')}">RPE (1–10)</label><select id="${fid('rpe')}" data-f="rpe">${opt(l.rpe,1,10)}</select></div>
    <div class="f-field"><label for="${fid('knee')}">Bol u kolenu (0–10)</label><select id="${fid('knee')}" data-f="knee">${opt(l.knee,0,10)}</select></div>
    <div class="f-field"><label for="${fid('kg')}">Telesna masa (kg)</label><input id="${fid('kg')}" type="text" inputmode="decimal" data-f="kg" value="${l.kg!=null?esc(String(l.kg).replace('.',',')):''}" placeholder="npr. 80,5"></div>
    <div class="f-field"><label for="${fid('ts')}">Datum</label><input id="${fid('ts')}" type="date" data-f="ts" value="${esc(l.ts||d.date||TODAY)}"></div>
    <div class="f-field full"><label for="${fid('note')}">Beleška</label><textarea id="${fid('note')}" data-f="note" placeholder="Kako je bilo…">${esc(l.note||'')}</textarea></div>
    </div></details>
  </div>`;
}
function bindForm(root,d){
  /* Selektor mora da koristi ISTU vrednost kao atribut (koji je escapovan).
     Uz validaciju pri uvozu esc() je ovde no-op; ako bi ipak prosao los ID,
     selektor jednostavno ne nadje element — forma se ne veze, ali se nista
     ne ubacuje. Otkaz u bezbednom smeru. */
  const g=root.querySelector(`.f-grid[data-day="${esc(d.id)}"]`);
  if(!g)return;
  g.querySelectorAll('[data-f]').forEach(inp=>{
    const f=inp.dataset.f;
    const h=()=>{
      const l=S.log[d.id]||(S.log[d.id]={status:stFor(d.id)});
      const v=inp.value.trim();
      if(f==='km'||f==='kg'){const n=parseFloat(v.replace(',','.'));l[f]=(v!==''&&isFinite(n))?n:null;}
      else if(f==='sec'){l.sec=parseTimeStr(v);}
      else if(f==='hr'){const n=parseInt(v,10);l.hr=isFinite(n)?n:null;}
      else if(f==='rpe'||f==='knee'){l[f]=inp.value===''?null:+inp.value;}
      else if(f==='ts'){if(inp.value)l.ts=inp.value;}
      else{l[f]=inp.value;}
      if(l.src==='strava'&&(f==='km'||f==='sec'||f==='hr'))l.lock=true; /* ručna korekcija ima trajnu prednost */
      const t=g.querySelector('[data-tempo]');
      if(t)t.textContent=(l.km&&l.sec)?fmtTempo(l.sec/l.km)+' /km':'—';
      syncSide(d);
      /* Beleška je jedino polje u koje se KUCA — v. saveOdlozeno(). Ostala su
         brojevi i izbori, dakle jedan dodir, pa idu odmah. */
      if(f==='note') saveOdlozeno(); else save();
    };
    inp.addEventListener('input',h);
    inp.addEventListener('change',h);
    inp.addEventListener('blur',saveOdmah);
  });
  /* radni deo — ostvaren tempo kvalitetnog segmenta (puni predikciju + VDOT) */
  g.querySelectorAll('[data-wpin]').forEach(inp=>{
    const wh=()=>{
      const pid=inp.dataset.wpin;
      const v=parseTimeStr(inp.value);
      if(inp.value.trim()===''){ delete S.pred[pid]; delete S.predLock[pid];
        const ix=(S.vdotLog||[]).findIndex(e=>e.id===pid); if(ix>=0)S.vdotLog.splice(ix,1);
        preracunajVdotLog();   /* uklonjena sesija ne sme da ostane u lancu */
        if(S.log[d.id]) delete S.log[d.id].autoOdbijen;
      } else if(v){ S.pred[pid]=v; S.predLock[pid]=true; const dl=S.log[d.id]; recordVdot(pid,v,(dl&&(dl.runDate||dl.ts))||d.date,sessKind(d),false,d); }
      else return;
      save();
      const out=g.querySelector(`[data-wout="${esc(pid)}"]`);
      if(out)out.innerHTML=vdotDeltaHTML(pid,S.pred[pid]);
    };
    inp.addEventListener('input',wh);
    inp.addEventListener('change',wh);
  });
  /* AI analiza — šalje SAMO podatke koje app već ima (nema novog Strava poziva) */
  vezAnalize(root,d);
}

/* Dugme za analizu ne zivi vise u formi nego u svojoj kartici, pa se i vezuje
   odvojeno — i iz Danas ekrana i iz lista dana u Planu. */
function vezAnalize(root,d){
  const karta=root.querySelector(`#ai-card-${esc(d.id)}`);
  if(!karta) return;
  const dug=karta.querySelector('[data-ai]');
  if(!dug) return;
  dug.addEventListener('click',async()=>{
      const l=S.log[d.id]||(S.log[d.id]={});
      if(!aiPreostalo(l)) return;   /* dugme u tom stanju i ne postoji */
      /* Kartica se pretvara u „radi se" — isti element, bez skoka na vrh. */
      karta.classList.remove('prazna');
      karta.innerHTML=dGlava('Analiza',esc(aiIzvor(l)))+`<div class="ai-out" id="ai-out-${esc(d.id)}">Analiziram…</div>`;
      const out=karta.querySelector(`#ai-out-${esc(d.id)}`);
      const gotovo=()=>{ karta.classList.toggle('prazna',!(typeof l.aiText==='string'&&l.aiText.trim())); };
      const predIds=predRowsFor(d);
      const mainPid=predIds[0];
      const r=mainPid?CUR_PRED.find(x=>x.id===mainPid):null;
      const payload={
        session:{ desc:d.desc||'', planPace: r?fmtTempo(effectivePace(d,r)):'—', q: r?r.q:null, tag:d.tag,
                  kind: sessKind(d),
                  /* ono sto je trkac SAM upisao na Stravi za taj dan */
                  stravaName: l.stravaName||null, stravaDesc: l.stravaDesc||null },
        goalCtx: goalCtxText(),
        hrZones: (S.strava&&S.strava.hrZones)||null,
        entered:{
          workPace: mainPid&&S.pred[mainPid]?fmtTempo(S.pred[mainPid]):null,
          km:l.km??null, time:l.sec?fmtClock(l.sec):null,
          hr:l.hr??null, rpe:l.rpe??null, note:l.note||'',
          maxHr:l.maxHr??null, elevGain:l.elevGain??null, relEffort:l.relEffort??null,
          temp:l.temp??null, decoupling:l.decoupling||null,
          /* Oporavak na DAN treninga: isti tempo posle lose noci nije isti
             trening, a bez ovoga model to ne moze da zna. */
          oporavak: oporavakZa(l.runDate||l.ts||d.date),
          laps: Array.isArray(l.laps)&&l.laps.length?l.laps:null,
          lapsIzvor: l.lapsIzvor||null,
          /* „6×800" kao jedna stavka — model iz toga vidi seriju kao celinu,
             pored pojedinačnih repova. Samo sa intervals.icu. */
          grupe: Array.isArray(l.icuGrupe)&&l.icuGrupe.length?l.icuGrupe:null,
          /* Već izračunato na intervals.icu: GAP, razdvajanje, efikasnost,
             opterećenje, vreme po zonama, „oseća se kao". Model to ne mora da
             procenjuje iz sirovih brojeva. */
          icu: l.icu||null,
          perKm: Array.isArray(l.perKm)&&l.perKm.length?l.perKm:null
        }
      };
      try{
        /* 1. POKRENI. Odgovor je trenutan — server samo otvori red u bazi. */
        const zapoc=await aiPozovi({posao:'start'});
        if(!zapoc.ok){ out.className='ai-out err'; out.textContent=zapoc.error; gotovo(); return; }
        l.aiPosao={id:zapoc.data.posaoId, at:Date.now()};
        delete l.aiGreska;          /* razlog prethodnog neuspeha vise ne vazi */
        save();
        out.textContent='Analiziram… ovo traje do minut. Možeš da zatvoriš aplikaciju, rezultat te čeka.';

        /* 2. POKRENI RAČUN, ali NE ČEKAJ ga. Ovaj zahtev sme da traje koliko
           mu treba; rezultat ide u bazu, ne u njegov odgovor. */
        /* `danId` ide SAMO da bi obaveštenje „analiza je gotova" znalo na koji
           trening da odvede. Server ga ne koristi ni za šta drugo i ne upisuje
           ga — v. javiDaJeGotovo u api/analyze.js. */
        aiPozovi(Object.assign({posao:'radi', posaoId:l.aiPosao.id, danId:d.id}, payload)).catch(()=>{});

        /* 3. PITAJ ZA REZULTAT. Ako se ne dočeka (mreža, uspavan telefon),
           pokupiće ga `aiPokupiSve` pri sledećem otvaranju aplikacije. */
        const konac=await aiSacekaj(d, l);
        if(konac==='gotovo'){ karta.innerHTML=aiTelo(d,l); vezAnalize(root,d); return; }
        if(konac==='greska'){ out.className='ai-out err'; out.textContent=l.aiGreska||'Analiza nije uspela.'; }
        else out.textContent='Analiza još traje. Rezultat će se pojaviti sam — možeš da zatvoriš aplikaciju.';
      }catch(e){
        out.className='ai-out err'; out.textContent='Pravi mrežni prekid (offline / nema signala).';
      }finally{ gotovo(); }
  });
}

/* ============================================================
   ANALIZA ODVOJENA OD ČEKANJA

   Ranije je jedan zahtev radio sve: klik → čekaj → tekst. Taj zahtev živi
   najduže koliko i serverska funkcija (60 s), pa je svaki sporiji odgovor
   modela završavao kao HTTP 504 — analiza je možda i bila napravljena, ali je
   nestajala jer nije imala gde da se upiše. Isto se dešavalo kad telefon
   uspava stranicu: veza pukne, rezultat propadne, a kvota je potrošena.

   Sada posao ima svoj red u bazi (v. supabase/ai-posao.sql). Klijent ga
   pokrene, ne čeka ga, i pokupi rezultat kad god se vrati — pri sledećem
   pitanju ili pri sledećem otvaranju aplikacije. ============================ */
async function aiPozovi(telo){
  try{
    const r=await fetch('/api/analyze',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+(await sbToken())},
      body:JSON.stringify(telo)
    });
    let j; try{ j=await r.json(); }
    catch{ return {ok:false, error:'Server nije vratio ispravan odgovor (HTTP '+r.status+').'}; }
    if(!r.ok) return {ok:false, status:r.status, error:(j.error||'Greška '+r.status)+(j.detail?' — '+j.detail:'')};
    return {ok:true, data:j};
  }catch(e){ return {ok:false, error:'Nema veze sa serverom.'}; }
}
/* Jedan pogled u bazu. Vraća 'gotovo' | 'greska' | 'radi' | null (nema posla). */
async function aiProveri(d, l){
  const p=l&&l.aiPosao;
  if(!p||!p.id) return null;
  const r=await aiPozovi({posao:'citaj', posaoId:p.id});
  if(!r.ok){
    /* 404 znaci da je red istekao ili obrisan — nema sta da se ceka. */
    if(r.status===404){ delete l.aiPosao; save(); return 'greska'; }
    return 'radi';
  }
  const st=r.data&&r.data.stanje;
  if(st==='gotovo'){
    l.aiText=String(r.data.tekst||'').slice(0,4000);
    l.aiAt=Date.now();
    l.aiCount=(l.aiCount||0)+1;
    delete l.aiPosao; delete l.aiGreska;
    save();
    return 'gotovo';
  }
  if(st==='greska'){
    l.aiGreska=String(r.data.greska||'Analiza nije uspela.');
    delete l.aiPosao; save();
    return 'greska';
  }
  return 'radi';
}
/* Pita na svake tri sekunde, najviše minut i po. Ako ne dočeka, posao ostaje
   zapisan — nista nije izgubljeno. */
async function aiSacekaj(d, l){
  for(let i=0;i<30;i++){
    await new Promise(r=>setTimeout(r, 3000));
    const st=await aiProveri(d, l);
    if(st==='gotovo'||st==='greska') return st;
    if(st===null) return 'gotovo';       /* neko drugi ga je vec pokupio */
  }
  return 'radi';
}
/* Pri otvaranju aplikacije i pri povratku u nju: pokupi sve sto je u medjuvremenu
   zavrseno. Zato analiza prezivi i zatvaranje aplikacije usred racunanja. */
let AI_KUPIM=false;
async function aiPokupiSve(){
  if(AI_KUPIM||!navigator.onLine||!sbAuthed()) return;
  const dani=Object.keys(S.log||{}).filter(id=>S.log[id]&&S.log[id].aiPosao&&S.log[id].aiPosao.id);
  if(!dani.length) return;
  AI_KUPIM=true;
  let promena=false;
  /* try/finally, ne gola dodela na kraju: da je `aiProveri` ikad bacio (npr.
     `save()` na punoj kvoti), zastavica bi ostala podignuta i pokupljanje
     rezultata bi TIHO prestalo do sledećeg učitavanja stranice — a analiza
     bi zauvek stajala na „u toku". */
  try{
    for(const id of dani.slice(0,5)){
      const st=await aiProveri({id}, S.log[id]);
      if(st==='gotovo'||st==='greska') promena=true;
    }
  } finally { AI_KUPIM=false; }
  if(!promena) return;
  if(PAGES[ACTIVE]) PAGES[ACTIVE]();
  /* OTVOREN LIST DANA SE NE PRECRTAVA sam. `PAGES[ACTIVE]()` osvežava ekran
     ISPOD lista, pa je posle povratka u aplikaciju u listu i dalje pisalo
     „nova analiza je u toku" iako je tekst već stigao. Isto važi i kad push
     „analiza je gotova" stigne dok je aplikacija otvorena. */
  for(const id of dani) osveziAnalizuULisu(id);
}

/* Precrta SAMO karticu analize u otvorenom listu dana. Ceo list se namerno ne
   crta iznova: u njemu je forma za unos, pa bi ponovno iscrtavanje pojelo ono
   što je čovek u tom trenutku kucao. */
function osveziAnalizuULisu(id){
  const list=$('#sheet');
  if(!list||!list.classList||!list.classList.contains('on')) return;
  const karta=document.getElementById('ai-card-'+id);
  if(!karta) return;
  const d=BY_ID[id]; if(!d) return;
  const l=S.log[id]||{};
  karta.className='card ai-card'+((typeof l.aiText==='string'&&l.aiText.trim())?'':' prazna');
  karta.innerHTML=aiTelo(d,l);
  vezAnalize(list,d);
}

/* ULAZ IZ OBAVEŠTENJA: ./?dan=<id>

   PRIJAVA: „stigne notifikacija, ali kad kliknem ne vodi me do same analize."
   Vodila je na ./?tab=danas — a analiza ne živi na početnom ekranu nego u
   listu SVOG dana, koji najčešće nije današnji, jer se analizira trening
   istrčan juče. Sada obaveštenje nosi id tog dana (v. javiDaJeGotovo u
   api/analyze.js) i ovde se taj list otvara. */
async function otvoriIzAdrese(){
  let id=null;
  try{ id=new URLSearchParams(location.search||'').get('dan'); }catch(e){}
  if(!validanId(id)) return false;
  /* Adresa se čisti ODMAH, pre svega ostalog: bez toga bi svako osvežavanje
     stranice ponovo otvaralo list, a i „nazad" bi vraćalo u njega. */
  try{ history.replaceState(null,'',location.pathname); }catch(e){}
  const d=BY_ID[id];
  /* Plan je u međuvremenu mogao biti izmenjen ili napravljen iznova — tada
     tog dana više nema. Bolje ostati na početnom ekranu nego pući. */
  if(!d) return false;
  if(d.week&&d.week.w) openW.add(d.week.w);   /* da se pod listom vidi ta nedelja */
  setPage(d.date===TODAY?'danas':'plan');
  openDaySheet(id);
  const l=S.log[id];
  /* Obaveštenje stiže čim server upiše rezultat, a uređaj ga tek treba
     pokupiti. Bez ovoga bi u listu pisalo „analiza je u toku" — tačno ono
     zbog čega je čovek i dodirnuo obaveštenje. */
  if(l&&l.aiPosao&&l.aiPosao.id&&navigator.onLine){
    try{ await aiProveri(d,l); }catch(e){}
    osveziAnalizuULisu(id);
  }
  /* Analiza je na dnu lista; bez ovoga se vidi vrh i izgleda kao da
     obaveštenje vodi u prazno. */
  const karta=document.getElementById('ai-card-'+id);
  if(karta&&karta.scrollIntoView) try{ karta.scrollIntoView({block:'center',behavior:'smooth'}); }catch(e){}
  return true;
}
function syncSide(d){
  const l=S.log[d.id];if(!l)return;
  const kid='kt-'+d.id;
  S.knee=S.knee.filter(k=>k.id!==kid);
  if(l.knee!=null)S.knee.push({id:kid,src:d.id,date:l.ts||d.date||TODAY,act:d.km!=null?'Trčanje':'Snaga',pain:l.knee,note:l.note||''});
  S.kg=S.kg.filter(x=>x.src!==d.id);
  if(l.kg!=null)S.kg.push({date:l.ts||d.date||TODAY,kg:l.kg,src:d.id});
  S.knee.sort((a,b)=>a.date<b.date?-1:1);
  S.kg.sort((a,b)=>a.date<b.date?-1:1);
}
function donePop(){
  const w=document.createElement('div');
  w.className='done-pop';
  w.innerHTML=`<svg viewBox="0 0 100 100" class="fade-out"><circle cx="50" cy="50" r="46"/><path d="M30 52 L45 66 L72 37"/></svg>`;
  document.body.appendChild(w);
  setTimeout(()=>w.remove(),1500);
}

/* ---------- PLAN ---------- */
/* ---------- PLAN: PRSTENOVI ----------
   Ekran je bio spisak od 14 kartica, po ~150 px svaka — sedam nedelja na ekran,
   i to samo kad nijedna nema dug opis (N7 sa „DELOAD (intenzitetski) — bez
   kvaliteta…" bio je duplo viši, pa je lista gubila ritam). Ceo plan se nije
   mogao obuhvatiti pogledom, a to je jedina stvar zbog koje se ovaj tab otvara.

   Sada: gore dva velika prstena koja odgovaraju na dva različita pitanja, ispod
   nedelje kao mali prstenovi po fazama. Dodir na prsten otvara dane te nedelje
   ispod njegovog reda. */

/* Koliko je plan TRAŽIO zaključno sa danas — završene nedelje u celosti, tekuća
   samo do današnjeg dana. Bez toga se ne može reći „držiš plan", nego samo
   „prešao si toliko od celog puta", što je drugo pitanje. */
function planDoSada(){
  let km=0;
  CUR_PLAN.forEach(w=>{
    const kraj=addD(w.start,6);
    if(kraj<TODAY) km+=weekPlanKm(w);
    else if(w.start<=TODAY) km+=w.days.reduce((sum,d)=>sum+((d.date&&d.date<=TODAY)?(d.km||0):0),0);
  });
  return km;
}
function planSazetak(){
  const ukupno=CUR_PLAN.reduce((s2,w)=>s2+weekPlanKm(w),0);
  const istrcano=CUR_PLAN.reduce((s2,w)=>s2+weekRealKm(w),0);
  const doSada=planDoSada();
  /* Prosek ide preko ZAVRSENIH nedelja, i to svih — preskocena nedelja je nula,
     ne izuzetak. Ranije su se brojale samo one sa kilometrima, pa je prosek bio
     lazno visok kod nekoga ko je nedelju preskocio. */
  const zavrsene=CUR_PLAN.filter(w=>addD(w.start,6)<TODAY);
  const zavrseneKm=zavrsene.reduce((a,w)=>a+weekRealKm(w),0);
  const najjaca=CUR_PLAN.reduce((a,w)=>weekRealKm(w)>weekRealKm(a)?w:a, CUR_PLAN[0]);
  const preostaloNed=CUR_PLAN.filter(w=>addD(w.start,6)>=TODAY).length;
  return {
    ukupno, istrcano, doSada,
    drziPlan: doSada>0?Math.round(istrcano/doSada*100):0,
    ceoPlan: ukupno>0?Math.round(istrcano/ukupno*100):0,
    prosek: zavrsene.length?zavrseneKm/zavrsene.length:null,
    najjaca, najjacaKm: weekRealKm(najjaca),
    preostalo: Math.max(0,ukupno-istrcano), preostaloNed,
    trcanjaGotovo: CUR_PLAN.reduce((s2,w)=>s2+weekRunDone(w),0),
    trcanjaUkupno: CUR_PLAN.reduce((s2,w)=>s2+weekRunCount(w),0)
  };
}
/* Prsten. `udeo` preko 1 se ne seče — prekoračenje plana je informacija, pa
   se pun krug prikazuje i piše koliko je preko.
   `fs` je izuzetak od podrazumevane veličine slova: „20:41" je pet znakova i
   na podrazumevanih 24 izlazi iz unutrašnjeg kruga, dok „93%" staje. */
function prstenSVG(udeo, tekst, velicina, boja, fs){
  const r=42, C=2*Math.PI*r;
  const p=Math.max(0,Math.min(1,udeo));
  const off=(C*(1-p)).toFixed(1);
  const slova=fs||(velicina>70?24:22);
  return `<svg viewBox="0 0 100 100" width="${velicina}" height="${velicina}" aria-hidden="true">
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="rgba(238,240,255,.14)" stroke-width="8"/>
    <circle class="pr-val" cx="50" cy="50" r="${r}" fill="none" stroke="${boja}" stroke-width="8" stroke-linecap="round"
            stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off}" transform="rotate(-90 50 50)"/>
    ${tekst?`<text x="50" y="${velicina>70?56:55}" text-anchor="middle" font-size="${slova}" font-weight="800"
            fill="#EEF0FF" font-family="-apple-system,sans-serif" letter-spacing="-1">${esc(tekst)}</text>`:''}
  </svg>`;
}
/* Faze: DELOAD ne pravi svoju grupu nego ostaje u onoj kojoj pripada po
   redosledu — inače bi se RAZVOJ raspao na tri odvojena naslova. */
function planFaze(){
  const grupe=[]; let tek=null;
  CUR_PLAN.forEach(w=>{
    let f=weekPhase(w,CUR_PLAN.length);
    if(f==='DELOAD') f=tek?tek.ime:'BAZA';
    if(f==='TAPER'||f==='TRKA') f='TAPER I TRKA';
    if(!tek||tek.ime!==f){ tek={ime:f,nedelje:[]}; grupe.push(tek); }
    tek.nedelje.push(w);
  });
  return grupe;
}
function renderPlan(){
  const el=$('#pg-plan');
  let h='';
  const gw=(S.genPlan&&S.genPlan.meta&&S.genPlan.meta.dayWarnings)||[];
  if(gw.length) h+=`<div class="pl-warn">${planWarningsHTML(gw,'Na šta da paziš u ovom planu')}</div>`;

  const z=planSazetak();
  h+=`<div class="card pl-sum">
    <div class="pl-rings">
      <div class="pl-ring">${prstenSVG(z.doSada?z.istrcano/z.doSada:0, z.drziPlan+'%', 104, z.drziPlan>=95?'var(--green)':z.drziPlan>=80?'var(--amber)':'var(--red)')}
        <b>${fmtKm(z.istrcano)} <span>/ ${fmtKm(z.doSada)} km</span></b>
        <span class="pl-lbl">od plana do sada</span></div>
      <div class="pl-ring">${prstenSVG(z.ukupno?z.istrcano/z.ukupno:0, z.ceoPlan+'%', 104, 'var(--cyan)')}
        <b>${fmtKm(z.istrcano)} <span>/ ${fmtKm(z.ukupno)} km</span></b>
        <span class="pl-lbl">ceo plan</span></div>
    </div>
    <div class="pl-facts">
      <div><b>${z.prosek!=null?fmtKm(z.prosek):'—'}</b><span>km nedeljno</span></div>
      <div><b>${z.najjacaKm>0?fmtKm(z.najjacaKm):'—'}</b><span>${z.najjacaKm>0?'najjača · N'+z.najjaca.w:'najjača nedelja'}</span></div>
      <div><b>${fmtKm(z.preostalo)}</b><span>ostalo · ${z.preostaloNed} ${pl3(z.preostaloNed,'nedelja','nedelje','nedelja')}</span></div>
      <div><b>${z.trcanjaGotovo}<span>/${z.trcanjaUkupno}</span></b><span>trčanja</span></div>
    </div>
  </div>`;

  /* Nedeljna kilometraža je došla iz Progresa. Tamo je bila jedini grafikon o
     planu, na ekranu koji o planu ne govori ništa drugo; ovde stoji odmah ispod
     istog broja koji prstenovi sabiraju, pa se vidi i ODAKLE je taj zbir. */
  h+=`<div class="card">${dGlava('Nedeljna kilometraža','plan vs. realizovano')}${chartWeeks()}</div>`;

  planFaze().forEach(g=>{
    const km=g.nedelje.reduce((s2,w)=>s2+weekRealKm(w),0);
    const pk=g.nedelje.reduce((s2,w)=>s2+weekPlanKm(w),0);
    h+=`<div class="pl-faza"><b>${esc(g.ime)}</b><i></i><span class="pl-fkm">N${g.nedelje[0].w}–N${g.nedelje[g.nedelje.length-1].w} · ${fmtKm(km)}/${fmtKm(pk)} km</span></div>`;
    for(let i=0;i<g.nedelje.length;i+=4){
      const red=g.nedelje.slice(i,i+4);
      h+=`<div class="pl-grid">`;
      red.forEach(w=>{
        const pkw=weekPlanKm(w), rkw=weekRealKm(w);
        const cur=weekOf(TODAY)===w, proslo=addD(w.start,6)<TODAY;
        const udeo=pkw?rkw/pkw:0;
        const boja=cur?'#EEF0FF':(rkw===0?'rgba(238,240,255,.22)':udeo>=.95?'var(--green)':udeo>=.7?'var(--amber)':'var(--red)');
        h+=`<button class="pl-w${cur?' now':''}${proslo&&rkw===0?' prazna':''}${openW.has(w.w)?' on':''}" data-w="${w.w}">
          ${prstenSVG(udeo, String(w.w), 58, boja)}
          <b>${rkw>0?fmtKm(rkw):'—'}<span>/${fmtKm(pkw)}</span></b>
          <span class="pl-t">${weekRunDone(w)}/${weekRunCount(w)} trč.</span>
        </button>`;
      });
      h+=`</div>`;
      /* Dani otvorene nedelje idu ODMAH ispod njenog reda, ne na dno ekrana —
         inače se izgubi veza između prstena koji si dodirnuo i onoga što se
         otvorilo. */
      red.filter(w=>openW.has(w.w)).forEach(w=>{ h+=nedeljaTelo(w); });
    }
  });

  el.innerHTML=h;
  el.querySelectorAll('.pl-w').forEach(b=>b.onclick=()=>{
    const w=+b.dataset.w;
    openW.has(w)?openW.delete(w):openW.add(w);
    renderPlan();
  });
  el.querySelectorAll('.day[data-d]').forEach(b=>b.onclick=()=>openDaySheet(b.dataset.d));
  el.querySelectorAll('.day[data-sw]').forEach(b=>b.onclick=()=>openWeekSwap(+b.dataset.sw));
  el.querySelectorAll('[data-wk]').forEach(b=>b.onclick=()=>{
    const nw=+b.dataset.wk;
    CHART_SEL.week=CHART_SEL.week===nw?null:nw;   /* isti dodir opet = poništi izbor */
    renderPlan();
  });
}
/* Dani jedne nedelje — isti redovi kao ranije, samo izdvojeni da mogu da stoje
   ispod reda prstenova. */
function nedeljaTelo(w){
  const dows=w.days.filter(d=>!d.test).map(d=>d.dow||0);
  const endOff=(w.w===CUR_PLAN.length&&dows.length)?Math.max(...dows):6;
  let h=`<div class="pl-body">
    <div class="pl-bh">N${w.w} · ${fmtD(w.start)} – ${fmtD(addD(w.start,endOff))}${weekOf(TODAY)===w?' · tekuća nedelja':''}
      <span>${esc(weekPhase(w,CUR_PLAN.length)==='DELOAD'?w.focus:(w.focus?weekPhase(w,CUR_PLAN.length)+' · '+w.focus:weekPhase(w,CUR_PLAN.length)))}</span></div>
    <button class="day" data-sw="${w.w}" style="justify-content:center;color:var(--txt);font-weight:800;font-size:.82rem;min-height:44px">⇄ Pomeri treninge</button>`;
  w.days.slice().sort((a,b)=>{
    const da=a.date||'9999-99-99', db=b.date||'9999-99-99';
    return da<db?-1:da>db?1:0;
  }).forEach(d=>{
    const s=d.rest?'rest':stFor(d.id);
    h+=`<button class="day t-${d.rest?'rest':safeTag(d.tag)}" data-d="${esc(d.id)}">
      <div class="day-d"><span class="dw">${d.test?'TT':dowOf(d.date)}</span>${d.date?`<span class="dn">${pad2(s2d(d.date).getDate())}</span>`:''}</div>
      <div class="day-mid">
        <div class="day-type">${d.rest?'Odmor':esc(sessKind(d))}</div>
        <div class="day-desc">${esc(d.rest?(d.desc||'—'):sessCore(d))}</div>
      </div>
      <div class="day-km">${d.km!=null?fmtKm(d.km)+' km':''}</div>
      <span class="day-st ${s}">${s==='done'?'✓':s==='skip'?'⏭':''}</span>
    </button>`;
  });
  return h+`</div>`;
}

/* ---------- SHEET ---------- */
/* Da li je u listu trenutno BAŠ ekran podešavanja. Stoji uz openSheet, a ne
   uz osveziPodesavanja — `let` deklarisan niže bio bi u mrtvoj zoni za svaki
   poziv koji se desi pre nego što se skripta izvrši do kraja. */
let SET_LIST=false;
function openSheet(html){
  SET_LIST=false;   /* svaki drugi list gasi zastavicu; openSettings je posle pali */
  $('#sheet').innerHTML=`<div class="grab"></div>`+html;
  $('#sheet').classList.add('on');$('#backdrop').classList.add('on');
  document.body.style.overflow='hidden';
  $('#sheet').scrollTop=0;
}
function closeSheet(){
  /* List nosi polja u koja se kuca (beleška treninga, beleška o bolu), a
     zatvaranje ih uklanja iz DOM-a pre nego što `blur` stigne — pa zakazan
     upis mora ovde. */
  saveOdmah();
  SET_LIST=false;
  $('#sheet').classList.remove('on');$('#backdrop').classList.remove('on');
  document.body.style.overflow='';
  if(AMB_PRE){ ambijent(AMB_PRE); AMB_PRE=null; }   /* svetlo nazad na tab ispod lista */
  PAGES[ACTIVE]();renderHeader();
}
/* ---------- IZMENA TRENINGA (tip / km / opis) ---------- */
let ALT_DRAFT=null, ALT_ERR='';
let CHART_SEL={week:null, wt:null, tempo:null, hrv:null, rhr:null, knee:null, vdot:null, pred:null};
/* izabrana nedelja (bar) i izabrana tačka po grafikonu.
   Sve linije su dodirljive po istom obrascu koji je Telesna masa već imala:
   natpis sa detaljima na vrhu, uvećana izabrana tačka, i NEVIDLJIV širi krug
   preko nje kao dodirni cilj — 3 px prečnika se na telefonu ne pogađa. */

/* Natpis iznad grafikona: detalji izabrane tačke, ili poziv da se dodirne.
   Namerno red na vrhu, ne tooltip: tooltip na dodir ostaje „zalepljen" dok se
   ne dodirne nešto drugo, a na malom ekranu prekriva baš ono što objašnjava. */
function chartTop(x, tekst){
  return tekst
    ? `<text class="chart-info" x="${x}" y="14" text-anchor="start">${esc(tekst)}</text>`
    : `<text class="chart-hint" x="${x}" y="14" text-anchor="start">Dodirni tačku za detalje</text>`;
}
/* Dodirni cilj preko tačke. r=11 je ~44 px na ekranu telefona — preporučeni
   minimum za dodir. */
function chartHit(x, y, kljuc, i){
  return `<circle cx="${(+x).toFixed(1)}" cy="${(+y).toFixed(1)}" r="11" fill="transparent" data-cpt="${kljuc}" data-cidx="${i}"/>`;
}
/* Vezivanje dodira — isti posao za sve grafikone, umesto kopije po ekranu. */
function vezisTacke(el, ponovo){
  el.querySelectorAll('[data-cpt]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.cpt, i=+b.dataset.cidx;
    CHART_SEL[k]=CHART_SEL[k]===i?null:i;   /* isti dodir opet = poništi izbor */
    ponovo();
  });
}
const ALT_TYPES=[['lako','Lako'],['int','Intervali'],['tempo','Tempo'],['lr','Dugo'],['snaga','Snaga'],['odmor','Odmor']];
function altSheetHTML(d){
  /* `cur` se gradi iz DANA, a rucni cilj tempa i run/walk zive u S.alts —
     bez njih bi se polje „Ciljni tempo" otvaralo prazno i cuvanje bi obrisalo
     vec postavljen cilj (svoj ili onaj iz prilagodjavanja formi). */
  const _a=(S.alts&&S.alts[d.id])||null;
  const cur=ALT_DRAFT||{tag:d.rest?'odmor':d.tag, km:d.km, desc:d.desc||'',
                        pace:_a?_a.pace:null, rw:_a?_a.rw:null};
  const edited=!!(S.alts&&S.alts[d.id]);
  const segBtns=arr=>`<div class="seg" style="margin-top:6px">${arr.map(([t,n])=>`<button type="button" data-t="${t}" class="${cur.tag===t?'on':''}">${n}</button>`).join('')}</div>`;
  let h=`<div class="sh-t">Izmeni trening</div>
    <div class="sh-s">N${d.week.w} · ${dowOf(d.date)} ${fmtDY(d.date)}${edited?' · izmenjen':''}</div>`;
  if(ALT_ERR)h+=`<div style="font-size:.75rem;color:var(--red);margin-bottom:10px">${esc(ALT_ERR)}</div>`;
  h+=`<div class="f-field full" role="group" aria-label="Tip treninga"><span class="f-lbl">Tip treninga</span>${segBtns(ALT_TYPES.slice(0,3))}${segBtns(ALT_TYPES.slice(3))}</div>`;
  if(cur.tag!=='odmor'){
    h+=`<div class="f-field full" style="margin-top:10px"><label for="alt-km">Kilometraža</label>
      <input type="number" inputmode="decimal" step="0.1" min="0" id="alt-km" value="${cur.km!=null?esc(cur.km):''}" placeholder="prazno = bez km (npr. snaga)"></div>`;
    h+=`<div class="f-field full" style="margin-top:10px"><label for="alt-desc">Opis</label>
      <textarea id="alt-desc" placeholder="Šta se radi…">${esc(cur.desc)}</textarea></div>`;
  }
  if(cur.tag==='int'||cur.tag==='tempo'){
    h+=`<div class="f-field full" style="margin-top:10px"><label for="alt-pace">Ciljni tempo radnog dela (m:ss/km)</label>
      <div style="font-size:.72rem;color:var(--txt3);margin-bottom:6px">Ovo vidi AI analiza i kartica treninga kao "plan" — nezavisno od podrazumevanog cilja te nedelje.</div>
      <div style="display:flex;gap:8px">
        <input type="text" inputmode="numeric" id="alt-pace" placeholder="410 = 4:10" value="${cur.pace!=null?fmtTempo(cur.pace):''}" style="flex:1">
        <button type="button" id="alt-pace-auto" class="btn ghost sm" style="flex:none">🔍 Iz opisa</button>
      </div></div>`;
  }
  h+=`<div class="btnrow" style="margin-top:14px"><button class="btn" id="alt-save">Sačuvaj</button></div>`;
  if(edited)h+=`<div class="btnrow" style="margin-top:8px"><button class="btn ghost" id="alt-reset">Vrati na plan</button></div>`;
  h+=`<div class="note-src">Plan se ne menja — ovo je izmena samo za ovaj dan i uvek se vraća. Odrađeni treninzi se ne menjaju.</div>`;
  return h;
}
function readAltFields(sh){
  const k=sh.querySelector('#alt-km'), t=sh.querySelector('#alt-desc'), p=sh.querySelector('#alt-pace');
  if(k&&k.value!==undefined)ALT_DRAFT.km=k.value===''?null:parseFloat(String(k.value).replace(',','.'));
  if(t&&t.value!==undefined)ALT_DRAFT.desc=t.value;
  if(p&&p.value!==undefined)ALT_DRAFT.pace=p.value===''?null:parseTimeStr(p.value);
}
function openAltSheet(id){
  const d=BY_ID[id];if(!d)return;
  const existing=S.alts&&S.alts[id];
  let pace=existing&&existing.pace!=null?existing.pace:extractPaceFromDesc(d.desc);
  if(pace==null){ const pid=predRowFor(d); const r=pid?CUR_PRED.find(x=>x.id===pid):null; if(r)pace=r.pt; }
  ALT_DRAFT={tag:d.rest?'odmor':d.tag,km:d.km,desc:d.desc||'',pace:pace};ALT_ERR='';
  renderAltSheet(d);
}
function renderAltSheet(d){
  openSheet(altSheetHTML(d));
  ALT_ERR='';
  const sh=$('#sheet');
  sh.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{
    readAltFields(sh); /* sačuvaj otkucano pre ponovnog crtanja */
    const t=b.dataset.t;
    /* opis se menja u šablon SAMO ako ga korisnik nije već dirao (još je plan) */
    if(!ALT_DRAFT.desc||ALT_DRAFT.desc===(d.origDesc||''))ALT_DRAFT.desc=altDescTemplate(t,ALT_DRAFT.km);
    ALT_DRAFT.tag=t;
    renderAltSheet(d);
  });
  const sv=sh.querySelector('#alt-save');
  if(sv)sv.onclick=()=>{
    readAltFields(sh);
    const res=setAlt(d.id,ALT_DRAFT);
    if(res.ok){ALT_DRAFT=null;closeSheet();}
    else{ALT_ERR='Izmena nije moguća: '+(res.err||'nepoznata greška');renderAltSheet(d);}
  };
  const pa=sh.querySelector('#alt-pace-auto');
  if(pa)pa.onclick=()=>{
    readAltFields(sh); /* uzmi trenutno otkucan opis, ne stari */
    const found=extractPaceFromDesc(ALT_DRAFT.desc);
    if(found!=null){ ALT_DRAFT.pace=found; }
    else { ALT_ERR='Nije prepoznat tempo u opisu (format „@ m:ss/km") — unesi ručno.'; }
    renderAltSheet(d);
  };
  const rs=sh.querySelector('#alt-reset');
  if(rs)rs.onclick=()=>{
    if(!confirm('Vratiti ovaj dan na originalni trening iz plana?'))return;
    clearAlt(d.id);ALT_DRAFT=null;closeSheet();
  };
}
/* ============ ENGINE.JS (V3 generator, portovan doslovno) ============
   Ranije su ovde stajale 4 `module.exports` linije iz vremena kad se generator
   testirao kao zaseban Node modul. U pregledacu nema globalnog `module`, pa su
   bile mrtve; testovi danas ucitavaju ceo app.js u vm kontekst (test/harness.mjs)
   i vide sve funkcije direktno, bez ijednog export-a. */
'use strict';
/* ============================================================
   SUB-20 GENERATOR v3 — deterministički engine plana (5K, 10K, HM, maraton)
   Tempi: Daniels–Gilbert jednačine (objavljene):
     VO2(v)      = -4.60 + 0.182258·v + 0.000104·v²        [v u m/min]
     %VO2max(t)  = 0.8 + 0.1894393·e^(-0.012778·t) + 0.2989558·e^(-0.1932605·t)   [t u min]
   VDOT = VO2(v_trke) / %VO2max(t_trke)
   Intenzitetske tačke (Daniels zone, sredine opsega): I=100% vVO2max,
   T=88%, E=70%, LR=68%, M=80% — konstante zona su izbor unutar
   objavljenih opsega, kalibrisane na etalon plan (v. testove).
   Rast VDOT-a po nedelji (heuristika, kalibrisana na etalon):
     konzervativno 0.15 · standard 0.25 · agresivno 0.36
   ============================================================ */

const Z = { I: 1.00, T: 0.88, M: 0.80, E: 0.70, LR: 0.68, R: 1.05 };
/* Mapiranje sessKind() -> Danielsova zona, za ISPRAVNO računanje VDOT-a iz
   ostvarenog tempa kvalitetne sesije. KRITIČNO: tempo/interval sesije se
   NAMERNO trče submaksimalno (T-tempo ~88% VO2max, ne trka ~95-98%) — stari
   pristup (Riegel, pretpostavlja MAKSIMALAN napor kao kod trke) je sistematski
   PODCENJIVAO VDOT na baš tim sesijama. vdotFromPace(tempo, zona) ispravno
   računa "koji VDOT bi ovaj tempo bio TAČNO ta zona", ne "kao da je ovo bio
   svop-maksimalan trka rezultat". "ciljni ritam" sesije (10K/HM race-pace)
   su NAMERNO izostavljene — one JESU simulacija trke, Riegel ostaje ispravan
   pristup baš za njih. */
const ZONE_FOR_KIND = {
  'Intervali':'I', 'Fartlek':'I', 'Piramida':'I',
  'Repeticije':'R',
  'Tempo':'T', 'Tempo (broken)':'T', 'Progresivno':'T',
  /* CRUISE INTERVALI. Tabela je imala samo stari naziv 'Tempo (broken)' iz
     hardkodovanog plana; generator ih od prepisa zove 'Tempo isprekidan' i taj
     naziv OVDE NIJE POSTOJAO. Bez zone recordVdot pada na `vdotFromQuality`,
     koji izmereni tempo tretira kao da je TRKA na toj distanci — a cruise
     intervali se trce na PRAGU, dakle znatno sporije od trke. Rezultat je bio
     sistematski PRECENJEN VDOT, i to bas na sesiji koja je glavni pragovski
     alat na 10K, polumaratonu i maratonu. */
  'Tempo isprekidan':'T',
  /* Tempo trke na 5K i 10K. Za 5K je tempo trke prakticno I zona (tacno); za
     10K je nesto sporiji, pa oznaka 'I' daje blago POTCENJEN VDOT — sto je
     bezbedan smer greske (plan ne ubrzava sam sebe). */
  'Trkački ritam':'I',
  /* Tempo trke / kontrolna trka na polumaratonu: tempo trke lezi IZMEDJU M i T
     zone i nema svoju Danielsovu zonu. Svrstava se u T jer je za trkace kojima
     se te sesije uopste i prave (ispod 1:50, v. ritamStrategija21K) razlika od
     praga svega nekoliko sekundi po kilometru — a greska u tom smeru POTCENJUJE
     VDOT, sto je bezbednije nego da ga precenjuje i ubrza ceo plan. */
  'Tempo trke':'T',
  /* KONTROLNA TRKA NAMERNO NEMA ZONU. Korisnik je moze istrcati kao pravu trku
     (punom snagom) ili kontrolisano na tempu polumaratona — plan ne zna sta je
     izabrao. Bez zone se koristi putanja "trka na toj distanci": ako JE trcao
     trku, procena je tacna; ako je trcao kontrolisano, procena je nesto niza od
     stvarne forme. Da je oznacena kao prag, prava trka bi je PRECENILA — a to
     je gori smer greske. */
  /* Progresivno koje se zavrsava na tempu trke je M rad, ne T. */
  'Progresivno (tempo trke)':'M',
  'Maratonski tempo':'M'
};
/* Stope rasta VDOT/nedeljno:
   kons 0.15 i std 0.25 — unutar Danielsove trenerske smernice (~1 poen / 4–6 ned.,
   'Daniels' Running Formula'; ekspertska heuristika, NE kontrolisana studija).
   agr 0.43 — kalibrisano na dokumentovanu putanju autora plana (20:37→cilj 18:55 za 14 ned.,
   uz paralelno mršavljenje i nizak trenažni staž) — plafon, uz obaveznu ogradu u UI. */
const RAMP = { kons: 0.15, std: 0.25, agr: 0.43 };
const GROW_MAX = 1.08;          /* maks. +8% nedeljnog volumena */
const DELOAD_EVERY = 4;         /* svaka 4. nedelja */
const DELOAD_F = 0.73;          /* deload = 73% prethodne (etalon: 32/44) */
const TAPER_F = 0.65;           /* pretposlednja = 65% vrhunca (etalon: 30/46) */
const RACEWK_F = 0.30;          /* trkačka nedelja ≈ 30% vrhunca */
const RAMP_CAP_WEEKS = 20;      /* inženjerski izbor (NE izmerena fiziološka granica): linearna
  ekstrapolacija forme preko ovog broja nedelja bi projektovala apsurdan skok (npr. +20 VDOT
  poena na 50 nedelja). Rast se ograničava na max 20 ned. neprekidnog linearnog napredovanja,
  dalje se forma DRŽI (plato) — ovo NE ograničava dužinu samog plana, samo trajanje "rampe". */

/* ============================================================
   buildDaySlots — PROMENLJIVI BROJ DANA TRČANJA (2–7) + BROJ
   KVALITETNIH SESIJA (1–2). Ovo je INŽENJERSKA ODLUKA, ne naučna
   formula — nema objavljene konstante za "koliko kvalitetnih
   sesija za koliki broj dana". Pravilo koje primenjujem (šire
   rasprostranjena trenerska konvencija, ne izmerena vrednost):
   broj TEŠKIH dana ne raste linearno sa ukupnim brojem dana —
   razlika ide u broj LAKIH dana. Zato je kvalitet ograničen na
   najviše 2, i na najviše 1 kada je runDays ≤ 3 (nema prostora
   za oporavak između dva teška dana uz samo 2–3 dana ukupno).
   Nedelja: LR je UVEK dow=7 (Ned) — fiksan izbor, ne konfigurabilno.
   Kvalitet se postavlja na proporcionalne pozicije unutar preostalih
   dana (radi ravnomernog razmaka), NE na fiksne "poslednje" pozicije
   — kod runDays=4,quality=2 ovo se DOKAZANO poklapa sa etalonom
   (Pon lako / Sre intervali / Pet tempo / Ned LR), što je jedina
   konfiguracija sa realnom validacijom. Sve ostale kombinacije su
   inženjerska ekstrapolacija bez etalon-provere. */
/* `wantMLR` (samo polumaraton) trazi JOS JEDAN duzi dan sredinom nedelje —
   srednje-dugo trcanje. Ono NIJE kvalitet: ne troši budžet zone i ne racuna se
   kao tvrd dan u istom smislu, ali jeste ozbiljno opterecenje, pa se bira dan
   sto dalje od dugog trcanja. 5K i 10K ga ne traze, pa im je izlaz identican
   kao pre (parametar izostaje -> nema 'mlr' slota nigde). */
function buildDaySlots(runDays, qualityCount, prefs, wantMLR){
  runDays = Math.max(2, Math.min(7, Math.round(runDays)));
  const effQ = runDays<=3 ? Math.min(qualityCount,1) : Math.min(qualityCount,2);
  /* KORISNIČKI IZBOR DANA (opciono): prefs = { lrDow: 1–7, qDows: [1–7,...] }.
     Bez prefs — ponašanje IDENTIČNO ranijem (LR nedelja, proporcionalni raspored). */
  const lrDow = (prefs && prefs.lrDow>=1 && prefs.lrDow<=7) ? Math.round(prefs.lrDow) : 7;
  const slots = {1:'rest',2:'rest',3:'rest',4:'rest',5:'rest',6:'rest',7:'rest'};
  slots[lrDow]='lr';
  let qSel = (prefs && Array.isArray(prefs.qDows) ? prefs.qDows : [])
    .map(Math.round).filter(d=>d>=1&&d<=7&&d!==lrDow);
  qSel = [...new Set(qSel)].slice(0, effQ).sort((a,b)=>a-b);

  /* IZBOR KONKRETNIH DANA TRČANJA (prefs.runDows).
     Ranije se biralo samo KOLIKO dana; lagana trčanja je raspoređivao
     generator po fiksnom redosledu. Korisnik koji trči utorkom i četvrtkom
     dobijao bi ih ponedeljkom i sredom — s pravom bi rekao da mu plan nije
     ispoštovan. Sada, ako su dani izabrani, koriste se TAČNO ti. */
  let runSel = (prefs && Array.isArray(prefs.runDows) ? prefs.runDows : [])
    .map(Math.round).filter(d=>d>=1&&d<=7);
  runSel = [...new Set(runSel)].sort((a,b)=>a-b);

  let chosen;
  if(runSel.length>=2){
    /* LR i kvalitet moraju biti među izabranim danima — UI to i sprečava,
       ali ako podatak dođe iz backup-a ili starije verzije, ne rušimo se. */
    if(!runSel.includes(lrDow)) runSel.push(lrDow);
    runSel=[...new Set(runSel)].sort((a,b)=>a-b);
    qSel=qSel.filter(d=>runSel.includes(d));
    chosen = runSel.filter(d=>d!==lrDow).sort((a,b)=>a-b);
  }else{
    const ORDER=[1,3,5,2,6,4,7].filter(d=>d!==lrDow && !qSel.includes(d));
    const need = runDays-1-qSel.length;
    chosen = qSel.concat(ORDER.slice(0, Math.max(need,0))).sort((a,b)=>a-b);
  }
  const len=chosen.length;
  if(qSel.length){
    /* eksplicitan izbor: raniji dan = q1 (VO2 familija), kasniji = q2 (prag) */
    chosen.forEach(dow=>{
      if(dow===qSel[0]) slots[dow]='q1';
      else if(qSel[1]!=null && dow===qSel[1]) slots[dow]='q2';
      else slots[dow]='easy';
    });
    /* ako je izabran samo 1 a effQ=2 — drugi kvalitet ide proporcionalno na preostale */
    if(qSel.length===1 && effQ===2){
      const rest=chosen.filter(d=>slots[d]==='easy');
      if(rest.length){ slots[rest[Math.min(rest.length-1, Math.round(rest.length*2/3))]]='q2'; }
    }
  }else{
    function idx(fracNum,fracDen){ return Math.min(len-1, Math.max(0, Math.round(len*fracNum/fracDen))); }
    let qIdx=[];
    if(effQ===2) qIdx=[idx(1,3), idx(2,3)];
    else if(effQ===1) qIdx=[idx(1,2)];
    qIdx = [...new Set(qIdx)];
    chosen.forEach((dow,i)=>{
      if(qIdx[0]===i) slots[dow]='q1';
      else if(qIdx[1]===i) slots[dow]='q2';
      else slots[dow]='easy';
    });
  }
  /* Srednje-dugo trcanje uzima LAGAN dan koji je najdalje od dugog trcanja
     (ciklicno, jer je nedelja prsten: LR u nedelju -> sreda je najdalje).
     Ako laganih dana nema (sve je vec LR/kvalitet), MLR se ne ubacuje — bolje
     nista nego da pojede jedini lagan dan u nedelji. */
  if(wantMLR){
    const laki=[1,2,3,4,5,6,7].filter(d=>slots[d]==='easy');
    if(laki.length>=2){
      const susedi=d=>[d===1?7:d-1, d===7?1:d+1];
      const razmak=d=>{ const x=Math.abs(d-lrDow); return Math.min(x, 7-x); };
      /* Sta se izbegava: DVA DUGA TRCANJA jedno uz drugo. To je jedina stvarno
         losa kombinacija — 90 min pa sutra 2h ne ostavlja nista za oporavak.
         Srednje-dugo UZ KVALITETNI dan se NE izbegava: to je Pfitzingerov
         obrazac i sama poenta akumulirane zamorenosti — srednje dugacko
         trcanje na nogama koje jos nisu odmorne od kvalitetnog dana. Prvi
         pokusaj je izbegavao i to, i time gurao MLR na lose mesto. */
      const uzLR=d=>susedi(d).some(x=>slots[x]==='lr')?1:0;
      const ocena=d=>({ d, dodir:uzLR(d), daleko:razmak(d) });
      const naj=laki.map(ocena).sort((a,b)=> a.dodir-b.dodir || b.daleko-a.daleko )[0];
      slots[naj.d]='mlr';
    }
  }
  return slots;
}
/* Upozorenja za korisnički izbor dana — NE blokira (sve je izmenjivo, filozofija
   vlasnika), samo kaže. Hard/easy princip: dva teška dana zaredom (kvalitet ili LR)
   su trenerska konvencija koju treba izbeći; uključuje prelaz Ned→Pon. */
function dayPrefWarnings(slots){
  const N=['Pon','Uto','Sre','Čet','Pet','Sub','Ned'];
  const hard=d=>slots[d]==='q1'||slots[d]==='q2'||slots[d]==='lr';
  const out=[];
  for(let d=1; d<=7; d++){
    const nxt = d===7 ? 1 : d+1;
    if(hard(d) && hard(nxt)) out.push(`Teški dani zaredom: ${N[d-1]} → ${N[nxt-1]} — hard/easy princip preporučuje lak dan ili odmor između.`);
  }
  /* SREDNJE-DUGO TRCANJE se NE broji kao tezak dan uz kvalitet.
     Prva verzija ga je brojala — i time je aplikacija upozoravala na
     "Uto intervali -> Sre srednje-dugo", sto je TACNO ono sto Pfitzingerov
     obrazac trazi: srednje dugacko trcanje na nogama koje jos nisu odmorne je
     sama poenta akumulirane izdrzljivosti. Upozorenje je zbog toga puklo na
     98% polumaratonskih planova — a upozorenje koje se javi skoro uvek nije
     upozorenje nego sum, i uci korisnika da ih ignorise.
     Ono sto jeste greska su DVA DUGA TRCANJA zaredom — to se i dalje javlja. */
  for(let d=1; d<=7; d++){
    const nxt = d===7 ? 1 : d+1;
    if((slots[d]==='mlr'&&slots[nxt]==='lr')||(slots[d]==='lr'&&slots[nxt]==='mlr'))
      out.push(`Dva duga trčanja zaredom: ${N[d-1]} → ${N[nxt-1]} — dugo i srednje-dugo trčanje traže lak dan između.`);
  }
  return out;
}
/* Bira dan za snagu: prvi 'rest' dan u nedelji (jednostavno, generičko pravilo — snaga je opciona/samostalna, ne zahteva optimalan raspored). null ako nema slobodnog dana. */
function pickStrengthDay(slots){
  for(let d=1; d<=6; d++) if(slots[d]==='rest') return d;
  return null;
}

function vo2AtV(v){ return -4.60 + 0.182258*v + 0.000104*v*v; }
function vAtVo2(vo2){ /* inverz kvadratne */ 
  const a=0.000104,b=0.182258,c=-4.60-vo2;
  return (-b+Math.sqrt(b*b-4*a*c))/(2*a);
}
function pctVo2max(tMin){ return 0.8 + 0.1894393*Math.exp(-0.012778*tMin) + 0.2989558*Math.exp(-0.1932605*tMin); }
function vdotFromRace(distM, sec){
  const tMin=sec/60, v=distM/tMin;
  return vo2AtV(v)/pctVo2max(tMin);
}
/* tempo (sec/km) za zonu pri datom VDOT-u */
function paceForZone(vdot, zone){
  /* M NIJE PROCENAT VO2max NEGO DEFINICIJA: kod Danielsa je M tempo = tempo
     MARATONSKE TRKE za taj VDOT. Konstanta Z.M=0.80 je to samo aproksimirala i
     grešila 3-6 s/km NANIŽE (VDOT 50: 4:36 umesto 4:31), sve više što je trkač
     brži. U planovima se to nije videlo — maraton uzima `racePace` iz cilja —
     ali se videlo u PROCENI FORME: `vdotFromPace(tempo,'M')` je maratonsku
     sesiju istrčanu tačno na maratonskom tempu čitao kao BRŽU od M zone, pa je
     precenjivao VDOT. To je smer greške koji plan sam sebi ubrzava. Sada se
     izvodi iz iste jednačine iz koje se računa i predviđanje trke, pa je tačan
     po konstrukciji (a `vdotFromPace` i dalje radi: funkcija ostaje monotono
     opadajuća po VDOT-u, što je jedini uslov za binarnu pretragu). */
  if(zone==='M') return Math.round(raceTimeForVdot(vdot, 42195)/42.195);
  const v = vAtVo2(vdot * Z[zone]);   /* m/min */
  return Math.round(60000 / v);        /* sec/km */
}
/* vreme trke (sec) koje odgovara VDOT-u na distM — rešava se iterativno */
function raceTimeForVdot(vdot, distM){
  let t = distM/ (vAtVo2(vdot)); /* početna procena: tempo na 100% */
  for(let i=0;i<40;i++){
    const v = distM/t;                        /* m/min */
    const f = vo2AtV(v)/pctVo2max(t) - vdot;  /* koren */
    const dt = 0.01;
    const v2 = distM/(t+dt);
    const f2 = vo2AtV(v2)/pctVo2max(t+dt) - vdot;
    const d = (f2-f)/dt;
    if(Math.abs(d)<1e-9) break;
    t = t - f/d;
    if(Math.abs(f)<1e-6) break;
  }
  return Math.round(t*60);
}
/* INVERZ od paceForZone: opservirani tempo (sec/km) na datoj zoni -> implicirani VDOT.
   paceForZone je monotono opadajuća funkcija VDOT-a (viša forma = brži tempo) -> binarna pretraga. */
/* ZASIĆENJE NIJE MERENJE.
   Pretraga je ograničena na opseg tablice, pa 2:00/km u T zoni vrati tačno 85
   — isto što i stvarni svetski vrh. Broj sam po sebi ne kaže da li je merenje
   ili ivica, zato ko o tome odlučuje mora da pita odvojeno. Brži tempo = manji
   broj sekundi, otud smer poređenja. */
function vdotPaceUOpsegu(paceSecKm, zone){
  return paceSecKm>=paceForZone(VDOT_TABELA_MAX,zone) && paceSecKm<=paceForZone(VDOT_TABELA_MIN,zone);
}
function vdotFromPace(paceSecKm, zone){
  let lo=VDOT_TABELA_MIN, hi=VDOT_TABELA_MAX;
  for(let i=0;i<40;i++){
    const mid=(lo+hi)/2;
    if(paceForZone(mid,zone) > paceSecKm) lo=mid; else hi=mid;
  }
  /* Vraca `hi`, ne sredinu. paceForZone zaokruzuje na celu sekundu, pa je
     stepenasta: pretraga zavrsi tacno NA skoku, gde paceForZone(lo) daje
     jednu sekundu vise nego paceForZone(hi). Sredina (lo+hi)/2 lezi na samoj
     ivici, pa je zaokruzivanje padalo cas na jednu cas na drugu stranu —
     mereno: tempo -> VDOT -> tempo je vracao POGRESAN tempo u 595 od 1206
     kombinacija zona i forme (49%). `hi` je po konstrukciji najmanji VDOT
     ciji tempo vec JESTE trazeni, pa round-trip pogadja uvek (0/1206).
     Numericka razlika izmedju dve varijante je 3e-11 VDOT — bez ikakvog
     uticaja na zabelezene vrednosti (zaokruzuju se na jednu decimalu). */
  return hi;
}
function fmtP(sec){return fmtClock(sec);} /* delegira: identicno za <1h (tempi), ali HM/maraton cilj daje 3:30:00 umesto 210:00 */
function riegelDist(sec, fromM, toM){ return sec*Math.pow(toM/fromM,1.06); } /* PREIMENOVANO iz riegel() — V2 već ima riegel(tempoSec,q) sa DRUGAČIJIM potpisom/značenjem; bez preimenovanja bi kasnija (engine.js) definicija tiho pregazila raniju (V2), praveći NaN u postojećem PRED sistemu */

/* ---------- realnost cilja ---------- */
/* ============================================================
   GENERATOR: SVAKA DISTANCA IMA SVOJU LOGIKU.

   Do v98 je jedna generička mašina pokušavala da opsluži 5K, 10K, HM i
   maraton kroz `qMix`/`useM` grananja i zajedničke formule za obim i dugo
   trčanje. Svaki ozbiljan bug nađen auditom potiče odatle: maratonsko dugo
   trčanje od 29.7 km osam nedelja zaredom, repeticije na 105% VO2max za
   maratonca u N1, obrnut rast obima (početnik +176%, iskusan +6%), i na
   kraju maratonski plan koji posle 20 nedelja ima najduže trčanje od 16 km.
   Nijedno od toga nije bila greška u formuli — bila je posledica toga što
   5K i maraton nemaju istu logiku ni u obimu, ni u fazama, ni u tipovima
   sesija, pa je svaki kompromis lomio bar jednu stranu.

   Odluka vlasnika: svaka distanca dobija SVOJU logiku, ništa se ne preplice.
   Polumaraton i maraton su tada UKLONJENI iz generatora i kasnije napisani
   zasebno — danas postoje sva četiri profila (5K, 10K, polumaraton, maraton),
   svaki sa sopstvenim rastom obima, fazama, sesijama i taperom. Ovaj pasus je
   dugo tvrdio suprotno (da su HM i maraton uklonjeni), pa je obmanjivao svakog
   ko posle čita kod — v. DIST_PROFILES ispod za stvarno stanje.

   KAKO JE SADA ORGANIZOVANO
   `generatePlan` je MAŠINA: kalendar, deload/taper raspored, raspodela po
   danima, izravnavanje rasta, upozorenja. Ona NE zna nijedan broj specifičan
   za distancu. Svaku takvu ODLUKU čita iz profila (`DIST_PROFILES[distanca]`):
   korak rasta obima, odredište obima, plafon dugog trčanja, budžete zona,
   dužine ponavljanja, granice faza, izbor sesija, dubinu tapera.
   Dodavanje distance = novi profil + njegove mk* funkcije. Nijedna postojeća
   distanca se pri tom ne dira — to je cela poenta razdvajanja.
   Profili se definišu NA KRAJU (v. DIST_PROFILES ispod), kad su sve funkcije
   koje referišu već napisane.
   ============================================================ */

/* ============================================================
   5K — TRENERSKI MODEL

   Šta 5K zapravo traži (i po čemu se razlikuje od dužih trka):
   - VO2max je GLAVNI motor. Tempo 5K trke je praktično I tempo, pa su
     intervali 800-1200 m @ I srce plana, ne dodatak.
   - Prag (T) je POTPORA: diže plafon koliko I rada možeš da apsorbuješ,
     ali nije cilj sam po sebi (to je razlika u odnosu na HM).
   - Repeticije (R) grade ekonomiju i brzinu. Idu RANO (pre nego što I
     postane prioritet) i ponovo pred trku, radi oštrine.
   - Obim je najmanje važan od sve četiri distance. Rekreativac trči dobar
     5K na 40-55 km/ned; preko toga prinos brzo pada. Zato plan NE gura
     kilometražu — gura kvalitet.
   - Dugo trčanje je aerobna potpora, ne specifičnost. Za 5K nema smisla
     trošiti oporavak na 2h+ trčanja.
   ============================================================ */

/* ============================================================
   KORAK RASTA OBIMA — apsolutni na malom obimu, procentualni na velikom.

   PROCENAT SAM JE POGRESNA MERA NA NISKOM OBIMU. +5% od 10 km/ned je +0.5 km
   nedeljno — to nije napredak, to je sum. Prijava korisnika: pocetnik sa 10
   km/ned je posle DESET nedelja imao vrhunac od 13.5 km. Isto vazi i za
   "10% pravilo" i za nas GROW_MAX (+8%): oba su formulisana za trkace koji
   vec trce ozbiljan obim, i na 10 km/ned ne znace nista.

   Rizik povrede prati APSOLUTNO opterecenje tkiva, a ne procenat: na 10 km/ned
   telo ima ogroman prostor, pa trener tu dodaje 1.5-2 km nedeljno (produzi
   jedno trcanje, dodaj kratko) — sto je +18%, i potpuno bezbedno. Na 60 km/ned
   isti taj apsolutni skok je +3%, pa procenat preuzima.

   Zato korak = clamp(obim * procenat, MIN_KM, MAX_KM):
     MIN_KM  drzi napredak smislenim na malom obimu,
     procenat vlada u sredini,
     MAX_KM  sprecava da veliki obim raste u apsolutnim skokovima.
   ============================================================ */
const KORAK_5K = {
  kons: { pct:0.040, min:1.2, max:2.5 },
  std:  { pct:0.055, min:1.8, max:3.5 },
  agr:  { pct:0.070, min:2.4, max:4.5 }
};
function korakRasta5K(vol, intensity){
  const K = KORAK_5K[intensity] || KORAK_5K.std;
  return Math.max(K.min, Math.min(K.max, vol*K.pct));
}
/* Obim na kom dobra rekreativna 5K priprema dostiže vrhunac. Nije plafon
   za one koji već trče više — samo odredište za one koji trče manje. */
const CILJ_OBIM_5K = 55;

/* Vrhunac nedeljnog obima. Tri ograničenja, redom:
   (1) koliko stopa rasta dozvoli u raspoloživim rampnim nedeljama,
   (2) ODREDIŠTE — koliko ova distanca traži, ali skalirano polaznom tačkom,
   (3) 120 km kao zaštita od degenerisanog unosa, ne trenerska odluka.
   Vrhunac NIKAD nije ispod unetog obima.

   ODREDIŠTE NIJE ISTO ZA SVE. Ranije je bilo tvrdih 55 km za svakoga, pa je
   trkač koji unese 10 km/ned na dugom planu ciljao 55 — to je +450%, obim koji
   telo ne stigne da podnese ma koliko nedelja plan imao. Sada odredište prati
   polaznu tačku: najviše ~75% više nego što već trči, uz APSOLUTNI pod od
   +20 km (procenat sam je na malom obimu besmislen — isti razlog zbog kog je
   i korak rasta apsolutan). Granica od 55 km se primenjuje tek onima koji su
   joj blizu. Za 10 km/ned to znači vrhunac do 30 km, za 40 km/ned punih 55.
   Stopa rasta i dalje odlučuje hoće li se odredište uopšte dostići — ovo je
   samo plafon, ne obaveza. */
function peakVol5K(cur, rampSteps, intensity){
  let v = cur;
  for(let i=0;i<rampSteps;i++) v += korakRasta5K(v, intensity);
  const odrediste = Math.min(CILJ_OBIM_5K, Math.max(cur*1.75, cur+20));
  const gornja = Math.max(cur*1.10, odrediste);
  return Math.max(cur, Math.min(v, gornja, 120));
}

/* DUGO TRČANJE ZA 5K.
   Udeo nedelje 27% na normalnom obimu — 5K ne traži maratonske long-runove.
   Na NISKOM obimu udeo se diže (do 40%), jer trkač mora da bude sposoban da
   pretrči samu trku i još malo: 27% od 15 km/ned je 4 km, što je manje od
   trke. Vremenski plafon 90 min (za 5K nema razloga ići preko), apsolutni
   plafon 20 km. */
function lrCap5K(vol, pLRsecPerKm){
  const timeCap = pLRsecPerKm>0 ? (90*60)/pLRsecPerKm : Infinity;
  const udeo = Math.max(vol*0.27, Math.min(8, vol*0.40));
  return Math.min(udeo, timeCap, 20);
}

function assess(pb, weeks, intensity, goalSec, raceDistM){
  raceDistM = raceDistM||5000;
  const vdot0 = vdotFromRace(pb.distM, pb.sec);
  const rampW = Math.min(Math.max(weeks-2, 1), RAMP_CAP_WEEKS);
  const vdotGoal = vdot0 + RAMP[intensity]*rampW;
  const predictedSec = raceTimeForVdot(vdotGoal, raceDistM);
  const out = { vdot0:r1(vdot0), vdotGoal:r1(vdotGoal), predictedSec, realno:null, goalVdot:null };
  if(goalSec){
    const gv = vdotFromRace(raceDistM, goalSec);
    out.goalVdot = r1(gv);
    out.realno = gv <= vdotGoal + 0.3;             /* tolerancija zaokruživanja */
  }
  return out;
}

/* ---------- raspodela obima po danima ---------- */
/* LR je uvek najduže trčanje nedelje; lagan dan ne sme da mu se približi
   (inače to više nije lagan dan nego drugo dugo trčanje). */
/* POD PO DANU TRCANJA.
   Bio je tvrdih 3 km. Za trkaca na 40 km/ned to je tacno, ali za pocetnika koji
   je uneo 10 km na 5 dana (2 km/dan) znaci da plan NE MOZE da isporuci manje od
   5x3 = 15 km — pa je svaka nedelja ista, deload ne spusta nista jer je vec na
   podu, a kad kvalitetne sesije pocnu da rastu obim curi navise. Izmereno na
   prijavi korisnika: N2=15.2, N3=15.3, N4(deload)=15.2 — tri identicne nedelje.
   Trcanje od 2 km je za pocetnika sasvim legitiman trening; pod zato prati
   obim po danu, uz apsolutni minimum od 1.5 km (ispod toga nije trening). */
function podPoDanu(vol, runDays){
  return Math.max(1.5, Math.min(3, r1(vol/Math.max(runDays,1)*0.75)));
}
/* `lrCapFn` dolazi IZ PROFILA distance — raspodela po danima je zajednička
   mašina, ali koliko sme da bude dugo trčanje je odluka distance (5K: 27-40%
   nedelje, 90 min; 10K: 30-42%, 105 min). Bez ovog parametra funkcija bi
   ponovo zvala 5K plafon za sve — tačno ono preplitanje koje se uklanja. */
/* `mlrF` (samo polumaraton) je udeo DUGOG trcanja koji dobija srednje-dugo.
   Kad je zadat, funkcija vraca i `mlr`, a lagani dani dele ono sto ostane
   posle njega. Bez njega je ponasanje identicno ranijem. */
function allocEasyLR(vol, qKms, easyCount, runDays, pLRsecPerKm, lrCapFn, mlrF){
  const POD = podPoDanu(vol, runDays);
  const qSum=qKms.reduce((a,b)=>a+b,0);
  const maxQ=qKms.length?Math.max(...qKms):0;
  const rem=Math.max(vol-qSum, 3);
  const danCap=(lrCapFn||lrCap5K)(vol, pLRsecPerKm||0);
  if(easyCount===0) return { lr:r1(Math.min(Math.max(rem, maxQ*1.1), Math.max(danCap,maxQ*1.05))), easies:[] };
  /* Na malo dana svako trčanje je veći udeo nedelje — zato strukturni cap po
     broju dana, uz Danielsov cap iznad. */
  const capF = runDays>=5?0.32: runDays===4?0.36: runDays===3?0.50:0.68;
  const cap = Math.min(vol*capF, danCap);
  /* Invarijanta: LR je najduže trčanje nedelje. Apsolutni pod od 4 km važi tek
     od ~13 km/ned naviše — na nedelji od 10 km "pod" od 4 km je 40% nedelje i
     gura raspodelu u besmislice. */
  const floor = Math.max(maxQ*1.05, Math.min(4, vol*0.30));
  let lr = Math.max(rem*0.45, maxQ*1.12, (rem/(easyCount+1))*1.3);
  lr = Math.min(lr, cap, rem-POD*easyCount);
  lr = Math.max(lr, Math.min(floor, rem-POD*0.85*easyCount));
  const wgt=[1.15,1,0.9,0.85,0.8,0.75].slice(0,easyCount);
  const wsum=wgt.reduce((a,b)=>a+b,0);
  let easies=wgt.map(x=>Math.max(POD, r1((rem-lr)*x/wsum)));
  /* Lagan dan: do 70% LR-a dok je LR kratak (9 km posle 14 km LR je i dalje
     lagan dan), strogih 50% kad LR poraste, i nikad preko 14 km apsolutno. */
  const mx=Math.max(...easies);
  const easyCeil=Math.min(14, Math.max(lr*0.50, Math.min(12, lr*0.70)));
  if(mx>=easyCeil && mx>0){
    const sc=easyCeil/mx;
    easies=easies.map(e=>Math.max(POD,r1(e*sc)));
  }
  /* Invarijanta do kraja: LR MORA ostati najduže trčanje nedelje. Lagani dani
     imaju pod od 3 km, a LR ga nema — na deload nedeljama niskog obima to je
     davalo LR od 2.4 km pored laganog dana od 3 km (nađeno auditom). */
  const mxE = easies.length ? Math.max(...easies) : 0;
  if(mxE > lr) lr = mxE*1.05;
  lr=r1(Math.max(lr, floor));
  if(!mlrF) return { lr, easies };
  /* SREDNJE-DUGO TRCANJE. Uzima udeo dugog trcanja, ali nikad toliko da lagani
     dani padnu ispod poda — ako nema odakle, izostaje (vraca se 0, pa ga dan
     tretira kao obican lagan dan). Ostatak se skida sa laganih dana
     proporcionalno, jer MLR i jeste "lagan dan koji je porastao". */
  let mlr=r1(Math.min(lr*mlrF, lr*0.85));
  const slobodno=easies.reduce((s,e)=>s+Math.max(0,e-POD),0);
  const dodatak=easies.length?easies[0]:0;
  const treba=Math.max(0, mlr-dodatak);
  if(easies.length<1 || treba>slobodno+0.01) return { lr, easies, mlr:0 };
  if(treba>0){
    let ostalo=treba;
    /* skida se od NAJDUZIH laganih dana nanize — isto pravilo kao izravnavanje */
    const red=easies.map((e,i)=>({e,i})).sort((a,b)=>b.e-a.e);
    red.forEach(x=>{
      if(ostalo<=0.01) return;
      const moze=Math.max(0, easies[x.i]-POD);
      const skini=Math.min(moze, ostalo);
      easies[x.i]=r1(easies[x.i]-skini); ostalo-=skini;
    });
  }
  easies.shift();                       /* prvi lagan dan JESTE srednje-dugo */
  return { lr, easies, mlr };
}

/* ============================================================
   5K KVALITETNE SESIJE

   Budžeti po zoni su Danielsovi, primenjeni na 5K bez kompromisa sa dužim
   distancama (raniji kod je koristio 10% za I i 12% za T "kao kompromis" —
   to je bilo iz maratonske strane, 5K to ne traži):
     I (VO2max)   <= 8% nedelje, i <= 8 km
     T (prag)     <= 10% nedelje
     R (ponavlj.) <= 5% nedelje, i <= 5 km
   ============================================================ */
const I_PCT_5K = 0.08, I_MAX_5K = 8;
const T_PCT_5K = 0.10;
const R_PCT_5K = 0.05, R_MAX_5K = 5;

/* Dužina intervala za 5K: 800-1200 m je srce (3-5 min po ponavljanju).
   Kraći (600) samo u fazi oštrenja, kad se traži brzina uz svežinu. */
function reps5K(workKm, faza, wkIdx){
  const meni = faza==='ostrenje' ? [600,800]
             : faza==='vrhunac'  ? [1000,1200]
             : [800,1000];
  const zelja = meni[wkIdx % meni.length];
  const budzetM = workKm*1000;
  /* Minimum od 3 ponavljanja je trenerski (ispod toga to nije serija), ali na
     malom budzetu probija zonu vise nego dvostruko: 3x1200 m = 3.6 km kad je
     budzet 1.6 km — izmereno 14-15% nedelje na I zoni umesto Danielsovih 8%.
     Zato se DUZINA ponavljanja skracuje dok tri ponavljanja ne stanu u budzet;
     broj ponavljanja ostaje >= 3. */
  const lestvica = [1200,1000,800,600,400].filter(x => x<=zelja);
  const rep = lestvica.find(x => 3*x <= budzetM*1.15) || 400;
  /* Math.round PROBIJA BUDZET: budzet od 3.5 km sa ponavljanjem od 1000 m daje
     3.5, sto se zaokruzi na 4 — 4 km rada umesto 3.5, tj. preko Danielsovih 8%
     nedelje (audit: 41 scenario). Budzet zone je PLAFON, pa se zaokruzuje
     NANIZE, uz malu toleranciju (8%) da se ne gubi celo ponavljanje zbog
     decimale. Minimum od 3 ponavljanja ostaje trenerski. */
  const n = Math.max(3, Math.floor(budzetM/rep + 0.08));
  return { rep, n };
}

/* ZAGREVANJE/SMIRIVANJE SKALIRANO OBIMOM. Ovo NIJE odluka po distanci nego po
   obimu — 2 km zagrevanja je isto pogresno za 11 km/ned bez obzira sprema li se
   covek za 5K ili 10K. Zato ostaje zajednicko.
   Fiksnih 2 km + 2 km je za trkaca na 50 km/ned normalno, a za pocetnika na
   11 km/ned je katastrofa: tempo sesija je ispadala 7 km — 64% njegove nedelje
   — pa je obim skakao 9.8 -> 15.1 km cim udje prvi kvalitet (nadjeno testom
   pocetnickog plana). Izravnavanje rasta to ne moze da spasi, jer ono sece
   samo lagane dane, a oni su na podu. Zato zagrevanje raste sa obimom. */
function wuCdZaObim(vol){
  return [ Math.max(1, Math.min(2, r1(vol*0.055))),
           Math.max(0.8, Math.min(1.5, r1(vol*0.04))) ];
}
function mkIntervali5K(dow,vol,pI,faza,wkIdx){
  /* Pod od 1.6 km rada (npr. 4x400 ili 2x800) umesto 2.4 — na 17 km/ned je
     2.4 km rada previse za prvi ozbiljan interval trening. */
  const q=Math.min(Math.max(vol*I_PCT_5K, 1.6), I_MAX_5K);
  const {rep,n}=reps5K(q,faza,wkIdx);
  const [wu,cd]=wuCdZaObim(vol);
  return sessInt(dow,wu,n,rep,pI,120,cd,'Intervali');
}
/* Trkački ritam: intervali TAČNO na ciljnom tempu 5K, duža ponavljanja i
   kraća pauza — proba ritma trke, ne VO2max stimulus. Faza oštrenja. */
function mkTrkackiRitam5K(dow,vol,racePace){
  const q=Math.min(Math.max(vol*I_PCT_5K, 1.6), 6);
  const rep = q>=3 ? 1000 : 800;
  const n=Math.max(3, Math.floor(q*1000/rep + 0.08));
  const [wu,cd]=wuCdZaObim(vol);
  return sessInt(dow,wu,n,rep,racePace,90,cd,'Trkački ritam');
}
function mkPiramida5K(dow,vol,pI){
  const [wu,cd]=wuCdZaObim(vol);
  /* Oblik se bira prema BUDZETU I zone, ne prema sirovom obimu — inace na
     niskom obimu piramida sama probije nedeljni I budzet. */
  const q=Math.min(Math.max(vol*I_PCT_5K, 1.6), I_MAX_5K);
  const noge = q>=3.4 ? [400,800,1200,800,400]
             : q>=2.6 ? [400,600,800,600,400]
             : [200,400,600,400,200];
  return sessPyramid(dow,wu,noge,pI,90,cd,'Piramida');
}
function mkFartlek5K(dow,vol,pI,pE){
  const n=Math.max(6, Math.min(12, Math.round(vol*0.20)));
  const [wu,cd]=wuCdZaObim(vol);
  return sessFartlek(dow,wu,n,60,60,pI,cd,pE);
}
/* Repeticije: 200-400 m na R tempu, PUN oporavak. Gradi ekonomiju i brzinu.
   Ide rano u ciklusu i ponovo pred trku. */
function mkRepeticije5K(dow,vol,pR,faza){
  const total=Math.max(1.2, Math.min(vol*R_PCT_5K, R_MAX_5K));
  const repM=faza==='ostrenje'?200:300;
  const n=Math.max(4, Math.floor(total*1000/repM + 0.08));
  const restSec=Math.round((repM/1000)*pR*2.5);   /* rad:odmor ~1:2.5 */
  const [wu,cd]=wuCdZaObim(vol);
  return sessInt(dow,wu,n,repM,pR,restSec,cd,'Repeticije');
}
/* Kontinuiran tempo — Daniels: najviše ~20 min na T, bez obzira na obim. */
function mkTempo5K(dow,vol,pT,fixKm){
  /* Pod od 3 km vazi tek od ~25 km/ned navise; ispod toga tempo deo prati obim.
     Ranije je pod bio vol*0.15, sto na nedelji od 20 km znaci 3 km praga = 15%
     nedelje, iznad Danielsovih 10% (audit: 75 scenarija). Pod postoji da tempo
     ne bude prekratak, ne da probije budzet zone — zato 12%. */
  const pod=Math.min(3, r1(vol*0.12));
  const q=fixKm!=null?fixKm:r1(Math.max(pod, Math.min(vol*T_PCT_5K, (20*60)/pT)));
  const [wu,cd]=wuCdZaObim(vol);
  return sessTempo(dow,wu,q,pT,Math.max(cd,1),'Tempo');
}
/* Cruise intervali: isti ukupan T obim, ali izlomljen — dozvoljava više
   minuta na pragu nego kontinuiran tempo. Rana i srednja faza. */
function mkCruise5K(dow,vol,pT){
  const total=Math.max(Math.min(3, vol*0.12), vol*T_PCT_5K);
  const repKm=total>=6?2.0:total>=3?1.6:1.0;
  const n=Math.max(2, Math.floor(total/repKm + 0.08));
  const [wu,cd]=wuCdZaObim(vol);
  return sessInt(dow,wu,n,Math.round(repKm*1000),pT,90,Math.max(cd,1),'Tempo isprekidan');
}

/* ============================================================
   FAZE 5K CIKLUSA (posle bazne faze, ako je ima)

     baza      — samo lagano + ubrzanja (početnici / netrenirani)
     ekonomija — prvih 25%: R repeticije + cruise. Gradi brzinu i prag PRE
                 nego što VO2max rad postane glavni. (Daniels Faza II)
     vrhunac   — 25-75%: I intervali dominiraju, T kao potpora.
     ostrenje  — poslednjih 25%: trkački ritam + kratke repeticije, manji
                 obim, veća svežina.

   q1 je uvek "brza" familija (I/R), q2 je uvek prag/potpora — tako da dva
   kvalitetna dana u nedelji nikad ne udare isti sistem dvaput.
   ============================================================ */
function faza5K(qualW, qualWeeks){
  const f = qualW/Math.max(qualWeeks,1);
  if(f < 0.25) return 'ekonomija';
  if(f < 0.75) return 'vrhunac';
  return 'ostrenje';
}

function buildQuality5K(qualW, qualWeeks, slotRole, effQ, vol, pI, pT, pE, pR, isTaper1, dow, racePace){
  const faza = faza5K(qualW, qualWeeks);
  /* TAPER. Ranije je jedan `return` stajao PRE grananja po ulozi, pa su q1 i q2
     dobijali ISTU sesiju — taper nedelja je imala dva identična 5×400 treninga
     (nađeno prvim testom 5K generatora). Sada svaki slot dobija svoje:
     q1 kratka oštrina na ciljnom ritmu, q2 kratak tempo da prag ostane budan
     bez umora. Oba su namerno mala — taper skida obim, ne intenzitet. */
  if(isTaper1){
    /* Zagrevanje/smirivanje se skaliraju (x0.75 / x0.8), pa MORAJU kroz r1() —
       inace 1.5*0.8 procuri u opis kao „1.2000000000000002 km hladjenje".
       Binarni zapis decimala; sve ostale kilometraze vec prolaze kroz r1().
       Taper sesije su ranije bile TVRDO KODOVANE (5x400 uz 1.5 km zagrevanja,
       i tempo fiksiran na 3 km). Na niskom obimu su zato ispadale VECE od
       redovnih sesija, pa je taper nedelja imala vise kilometara od vrhunca
       (prijava korisnika: vrhunac 15.5-15.8 km, taper 18.5 km). Sada i one
       prate obim — taper skida kolicinu, zadrzava ostrinu. */
    const [twu,tcd]=wuCdZaObim(vol);
    if(effQ===1 || slotRole==='q1'){
      const n=Math.max(4, Math.min(6, Math.round(vol*0.03)));
      return sessInt(dow,r1(Math.max(twu*0.75,1)),n,400,Math.max(pI,racePace),90,r1(Math.max(tcd*0.75,0.8)),'Intervali');
    }
    return mkTempo5K(dow,vol,pT,r1(Math.min(3, Math.max(1.5, vol*0.08))));
  }

  if(effQ===1){
    /* Jedini kvalitet mora sam da pokrije sve — rotira po nedeljama.
       Ipak: u fazi ekonomije R/cruise, u vrhuncu I, u oštrenju trkački ritam. */
    if(faza==='ekonomija') return (qualW%2===1) ? mkRepeticije5K(dow,vol,pR,faza) : mkCruise5K(dow,vol,pT);
    if(faza==='ostrenje')  return (qualW%2===1) ? mkTrkackiRitam5K(dow,vol,racePace) : mkTempo5K(dow,vol,pT);
    const m = qualW%3;
    if(m===0) return mkFartlek5K(dow,vol,pI,pE);
    if(m===2) return mkTempo5K(dow,vol,pT);
    return mkIntervali5K(dow,vol,pI,faza,qualW);
  }

  if(slotRole==='q1'){
    /* BRZA familija */
    if(faza==='ekonomija') return mkRepeticije5K(dow,vol,pR,faza);
    if(faza==='ostrenje')  return (qualW%2===1) ? mkTrkackiRitam5K(dow,vol,racePace)
                                                : mkIntervali5K(dow,vol,pI,faza,qualW);
    /* vrhunac: intervali su norma; piramida i fartlek povremeno, protiv
       monotonije i radi varijacije stimulusa (isti I napor, druga forma) */
    if(qualW%6===3) return mkPiramida5K(dow,vol,pI);
    if(qualW%4===2) return mkFartlek5K(dow,vol,pI,pE);
    return mkIntervali5K(dow,vol,pI,faza,qualW);
  }

  /* q2 — PRAG / potpora. Nikad VO2max, da se dva teška dana ne poklope po sistemu. */
  if(faza==='ekonomija') return mkCruise5K(dow,vol,pT);
  if(faza==='ostrenje')  return mkTempo5K(dow,vol,pT,3);
  return (qualW%2===1) ? mkCruise5K(dow,vol,pT) : mkTempo5K(dow,vol,pT);
}

/* ============================================================
   10K — TRENERSKI MODEL

   10K NIJE "duži 5K". Razlika je u tome KOJI sistem nosi trku:

   - PRAG (T) je GLAVNI motor. Tempo 10K trke leži tik iznad praga — kod
     rekreativca praktično na granici laktata. Ko digne prag, trči brži 10K,
     i to bez dodatnog VO2max rada. Zato T ovde nije potpora nego okosnica:
     prag-blok ide PRVI i vraća se kroz ceo ciklus.
   - VO2max (I) je POTPORA, ne cilj. Diže plafon iznad kog prag može da se
     pomeri, ali ponavljanja su DUŽA nego za 5K — 1000-1600 m (4-6 min), ne
     800-1200. Kratki brzi intervali za 10K nose više umora nego koristi.
   - SPECIFIČNOST je stvarna: 10K tempo se mora uvežbati, jer se drži 40-55
     minuta. Zato poslednja trećina ciklusa ima duga ponavljanja NA TEMPU TRKE
     (1200-1600 m, kratka pauza) i produženi tempo rad — ne kratku oštrinu
     kao 5K.
   - REPETICIJE (R) su manje važne nego za 5K. Ostaju radi ekonomije koraka,
     ali sa manjim budžetom (4% umesto 5%) i samo u prvoj fazi.
   - OBIM je ZNAČAJNO važniji nego za 5K. 10K se trči na aerobnoj bazi; dobar
     rekreativni 10K traži 55-70 km/ned, ne 40-55. Zato je odredište više,
     korak rasta malo veći, a dugo trčanje duže (do 105 min, 30-42% nedelje).
   - TAPER je PLIĆI nego za 5K. Duža trka traži da se aerobna baza zadrži —
     preveliki pad obima pred 10K oduzima izdržljivost koju trka traži.
   ============================================================ */

/* Korak rasta obima — ista logika kao za 5K (apsolutno na malom obimu,
   procentualno na velikom), ali VEĆI, jer 10K traži veći obim i ima duži
   put do odredišta. Vrednosti su odluka distance, ne zajednička formula. */
const KORAK_10K = {
  kons: { pct:0.040, min:1.4, max:3.0 },
  std:  { pct:0.055, min:2.0, max:4.0 },
  agr:  { pct:0.070, min:2.6, max:5.0 }
};
function korakRasta10K(vol, intensity){
  const K = KORAK_10K[intensity] || KORAK_10K.std;
  return Math.max(K.min, Math.min(K.max, vol*K.pct));
}
/* Obim na kom dobra rekreativna 10K priprema dostiže vrhunac. Više nego 5K
   (55) jer 10K stoji na aerobnoj bazi, a ne na brzini. */
const CILJ_OBIM_10K = 70;
/* Vrhunac nedeljnog obima za 10K. Odrediste (70 km) je cilj za onoga ko vec
   trci blizu njega — NIJE cilj za svakoga. Trkac koji unese 25 km/ned nema
   sta da trazi na 70: to je +180%, i to je kilometraza koju telo ne stigne da
   podnese ma koliko nedelja plan imao. Zato je odrediste ograniceno i
   RELATIVNO na polaznu tacku (najvise ~75% vise nego sto vec trci), pa se
   granica 70 primenjuje tek na one koji su joj blizu.
   Za 25 km/ned to znaci vrhunac ~44 km — ozbiljan napredak, a ne skok u
   nepoznato. Za 45 km/ned puni plafon od 70. */
function peakVol10K(cur, rampSteps, intensity){
  let v = cur;
  for(let i=0;i<rampSteps;i++) v += korakRasta10K(v, intensity);
  /* Cisto procentualno odrediste (cur*1.75) na malom obimu opet postaje sum —
     ista greska kao kod koraka rasta: 15 km/ned bi zavrsilo na 26 km i onda
     stajalo u mestu 13 nedelja (izmereno auditom). Zato i ovde APSOLUTAN pod:
     svako sme da dodje bar 20 km iznad polazne tacke, ako plan ima dovoljno
     nedelja za to. Stopa rasta (korakRasta10K x rampSteps) i dalje odlucuje
     hoce li se odrediste uopste dostici — ovo je samo plafon, ne obaveza. */
  const odrediste = Math.min(CILJ_OBIM_10K, Math.max(cur*1.75, cur+20));
  const gornja = Math.max(cur*1.10, odrediste);
  return Math.max(cur, Math.min(v, gornja, 140));
}

/* DUGO TRČANJE ZA 10K.
   Udeo 30% nedelje (5K: 27%), vremenski plafon 105 min (5K: 90), apsolutni
   24 km (5K: 20). Na niskom obimu udeo se diže do 42%, jer trkač mora da bude
   sposoban da pretrči 10 km i još malo — 30% od 20 km/ned je 6 km, manje od
   same trke. Preko 105 min za 10K nema svrhe: to je već maratonski oporavak
   plaćen za aerobni dobitak koji T rad daje jeftinije. */
function lrCap10K(vol, pLRsecPerKm){
  const timeCap = pLRsecPerKm>0 ? (105*60)/pLRsecPerKm : Infinity;
  const udeo = Math.max(vol*0.30, Math.min(11, vol*0.42));
  return Math.min(udeo, timeCap, 24);
}

/* BUDŽETI ZONA ZA 10K (Daniels, primenjeni na 10K):
     I (VO2max)   <= 8% nedelje, i <= 10 km  (Danielsov pun plafon — 5K ga
                    namerno drži na 8 km jer tamo I nosi ceo plan i češće je)
     T (prag)     <= 10% nedelje — ali se OVDE troši do kraja, jer je prag
                    glavni sistem; 5K ga koristi kao potporu
     R (ponavlj.) <= 4% nedelje, i <= 4 km   (5K: 5% / 5 km — 10K traži manje) */
const I_PCT_10K = 0.08, I_MAX_10K = 10;
const T_PCT_10K = 0.10;
const R_PCT_10K = 0.04, R_MAX_10K = 4;
/* Kontinuiran tempo: Daniels drži 20 min za čist T. Za 10K se ide do 25 min —
   trka traje 40-55 min, pa je duži neprekidan prag deo specifičnosti. Veći
   T obim od toga IDE KROZ CRUISE intervale, ne kroz duži neprekidan tempo. */
const TEMPO_MAX_SEC_10K = 25*60;

/* Dužina intervala za 10K: 1000-1600 m je srce (4-6 min po ponavljanju).
   Kraća ponavljanja od 1000 m ulaze samo kad budžet ne dozvoljava tri duža —
   isti mehanizam kao kod 5K, druga lestvica. */
function reps10K(workKm, faza, wkIdx){
  const meni = faza==='prag'      ? [1000,1200]
             : faza==='specifika' ? [1200,1600]
             : [1000,1200,1600];
  const zelja = meni[wkIdx % meni.length];
  const budzetM = workKm*1000;
  const lestvica = [1600,1200,1000,800,600,400].filter(x => x<=zelja);
  const rep = lestvica.find(x => 3*x <= budzetM*1.15) || 400;
  /* Math.round OVDE PROBIJA BUDZET: budzet od 5.6 km sa ponavljanjem od 1600 m
     daje 3.5, sto se zaokruzi na 4 — 6.4 km umesto 5.6, tj. 9.3% nedelje
     umesto Danielsovih 8% (izmereno auditom na 65-70 km/ned). Budzet zone je
     PLAFON, pa se zaokruzuje NANIZE, uz malu toleranciju (8%) da se ne gubi
     celo ponavljanje zbog decimale. Minimum od 3 ostaje trenerski. */
  const n = Math.max(3, Math.floor(budzetM/rep + 0.08));
  return { rep, n };
}
/* Pauza za duga ponavljanja: ~80% trajanja ponavljanja (Daniels: oporavak
   jednak ili kraći od rada), 90-180 s. Fiksnih 120 s kao kod 5K je za
   ponavljanje od 1600 m prekratko, a za 400 m predugo. */
function pauza10K(repM, paceSec){
  return Math.min(180, Math.max(90, Math.round((repM/1000)*paceSec*0.8)));
}
function mkIntervali10K(dow,vol,pI,faza,wkIdx){
  const q=Math.min(Math.max(vol*I_PCT_10K, 2.0), I_MAX_10K);
  const {rep,n}=reps10K(q,faza,wkIdx);
  const [wu,cd]=wuCdZaObim(vol);
  return sessInt(dow,wu,n,rep,pI,pauza10K(rep,pI),cd,'Intervali');
}
/* TRKAČKI RITAM 10K — srž specifične faze. Duga ponavljanja TAČNO na ciljnom
   tempu 10K, kratka pauza (60-75 s), tako da se skupi 5-8 km na ritmu trke.
   Ovo je najbliže samoj trci što trening može da bude, a da se ne trči trka. */
function mkTrkackiRitam10K(dow,vol,racePace,wkIdx){
  const q=Math.min(Math.max(vol*0.10, 2.5), 8);
  /* Specificni blok traje 3-5 nedelja i q1 je u njemu skoro uvek trkacki
     ritam — bez varijacije to su bile DOSLOVNO iste sesije nedelju za
     nedeljom (audit: N13 i N14 oba 4x1600). Naizmenicno duza/kraca
     ponavljanja: isti ukupan obim na tempu trke, drugaciji zahtev
     (duza = kontrola ritma, kraca = vise ponavljanja i vise ukupnog rada). */
  const duza = (wkIdx||0)%2===0;
  const rep = q>=6 ? (duza?1600:1200) : q>=3.5 ? (duza?1200:1000) : 1000;
  const n=Math.max(3, Math.floor(q*1000/rep + 0.08));
  const [wu,cd]=wuCdZaObim(vol);
  return sessInt(dow,wu,n,rep,racePace,rep>=1600?75:60,cd,'Trkački ritam');
}
function mkPiramida10K(dow,vol,pI){
  const [wu,cd]=wuCdZaObim(vol);
  const q=Math.min(Math.max(vol*I_PCT_10K, 2.0), I_MAX_10K);
  const noge = q>=5.0 ? [600,1000,1600,1000,600]
             : q>=3.5 ? [400,800,1200,800,400]
             : [400,600,800,600,400];
  return sessPyramid(dow,wu,noge,pI,105,cd,'Piramida');
}
/* Fartlek za 10K: duži surge-ovi (90 s) nego za 5K (60 s) — bliže trajanju
   napora koji 10K traži, i lakše se drži na I tempu bez sloma forme. */
function mkFartlek10K(dow,vol,pI,pE){
  const n=Math.max(6, Math.min(12, Math.round(vol*0.18)));
  const [wu,cd]=wuCdZaObim(vol);
  return sessFartlek(dow,wu,n,90,90,pI,cd,pE);
}
/* Repeticije za 10K: manji budžet nego 5K, i samo u prvoj (prag) fazi —
   ekonomija koraka, ne brzina kao cilj. */
function mkRepeticije10K(dow,vol,pR){
  const total=Math.max(1.2, Math.min(vol*R_PCT_10K, R_MAX_10K));
  const repM=300;
  const n=Math.max(4, Math.floor(total*1000/repM + 0.08));
  const restSec=Math.round((repM/1000)*pR*2.5);   /* rad:odmor ~1:2.5 */
  const [wu,cd]=wuCdZaObim(vol);
  return sessInt(dow,wu,n,repM,pR,restSec,cd,'Repeticije');
}
/* Kontinuiran tempo — do 25 min na T (v. TEMPO_MAX_SEC_10K). */
function mkTempo10K(dow,vol,pT,fixKm){
  /* Apsolutni pod od 4 km vazi tek od ~33 km/ned navise; ispod toga prati obim
     (audit: 4 km tempa na nedelji od 28.5 km je 14% na pragu, iznad Danielsovih
     10% — a pod postoji da tempo ne bude prekratak, ne da probije budzet). */
  const pod=Math.min(4, r1(vol*0.12));
  const q=fixKm!=null?fixKm:r1(Math.max(pod, Math.min(vol*T_PCT_10K, TEMPO_MAX_SEC_10K/pT)));
  const [wu,cd]=wuCdZaObim(vol);
  return sessTempo(dow,wu,q,pT,Math.max(cd,1),'Tempo');
}
/* Cruise intervali — glavni alat za T obim na 10K. Duža ponavljanja nego kod
   5K (do 3 km umesto do 2 km), jer je prag ovde okosnica pa mora da primi
   više minuta nego što jedan neprekidan tempo sme da nosi. */
function mkCruise10K(dow,vol,pT){
  const total=Math.max(Math.min(3, vol*0.12), vol*T_PCT_10K);
  const repKm=total>=8?3.0:total>=5?2.0:total>=3?1.6:1.0;
  /* NANIZE, iz istog razloga kao u reps10K: 7 km budzeta / 2 km po ponavljanju
     je 3.5, sto je zaokruzivanjem davalo 4x2000 = 8 km praga (11.6% nedelje). */
  const n=Math.max(2, Math.floor(total/repKm + 0.08));
  const [wu,cd]=wuCdZaObim(vol);
  return sessInt(dow,wu,n,Math.round(repKm*1000),pT,90,Math.max(cd,1),'Tempo isprekidan');
}
/* PROGRESIVNO TRČANJE — 10K-specifično, nema ga u 5K planu. Dve trećine lako,
   poslednja trećina na pragu: uči da se prag drži na UMORNIM nogama, što je
   tačno ono što se dešava na 7. kilometru trke. Ide u specifičnoj fazi. */
function mkProgresivni10K(dow,vol,pT,pE){
  const total=r1(Math.max(5, Math.min(vol*0.20, 14)));
  return sessProg(dow,total,pT,pE);
}

/* ============================================================
   FAZE 10K CIKLUSA (posle bazne faze, ako je ima)

     baza      — samo lagano + ubrzanja (početnici / netrenirani)
     prag      — prvih 30%: cruise + tempo grade prag, R repeticije ekonomiju.
                 Za razliku od 5K (gde prva faza gradi brzinu), ovde prva faza
                 gradi upravo sistem koji trku nosi.
     vrhunac   — 30-70%: I intervali (duga ponavljanja) dižu plafon, prag se
                 održava.
     specifika — poslednjih 30%: trkački ritam na tempu 10K + produžen prag
                 (progresivno / duži tempo). Nije "oštrenje" kao kod 5K —
                 10K se ne oštri, 10K se uvežbava.

   Granice su 30/70 (5K: 25/75) — 10K traži duži prag-blok na početku i duži
   specifični blok na kraju, po cenu kraćeg VO2max bloka u sredini.

   q1 je uvek "brza/specifična" familija, q2 uvek prag — dva kvalitetna dana
   nikad ne udaraju isti sistem dvaput.
   ============================================================ */
function faza10K(qualW, qualWeeks){
  const f = qualW/Math.max(qualWeeks,1);
  if(f < 0.30) return 'prag';
  if(f < 0.70) return 'vrhunac';
  return 'specifika';
}

function buildQuality10K(qualW, qualWeeks, slotRole, effQ, vol, pI, pT, pE, pR, isTaper1, dow, racePace){
  const faza = faza10K(qualW, qualWeeks);
  if(isTaper1){
    /* Taper za 10K: kratka ponavljanja NA TEMPU TRKE (ne brže) — podseća noge
       na ritam bez trošenja. Za 10K je racePace sporiji od I tempa, pa
       Math.max bira upravo tempo trke. Obim prati nedelju, kao i kod 5K. */
    const [twu,tcd]=wuCdZaObim(vol);
    if(effQ===1 || slotRole==='q1'){
      const n=Math.max(3, Math.min(5, Math.round(vol*0.02)));
      return sessInt(dow,r1(Math.max(twu*0.8,1)),n,600,Math.max(pI,racePace),75,r1(Math.max(tcd*0.8,0.8)),'Trkački ritam');
    }
    return mkTempo10K(dow,vol,pT,r1(Math.min(4, Math.max(2, vol*0.08))));
  }

  if(effQ===1){
    /* Jedini kvalitet mora sam da pokrije sve. Za 10K to znači da je PRAG
       podrazumevani izbor — on daje najviše po jedinici umora — a I i tempo
       trke ulaze tek kad ih faza traži. */
    if(faza==='prag')      return (qualW%3===2) ? mkRepeticije10K(dow,vol,pR) : mkCruise10K(dow,vol,pT);
    if(faza==='specifika') return (qualW%2===1) ? mkTrkackiRitam10K(dow,vol,racePace,qualW) : mkProgresivni10K(dow,vol,pT,pE);
    /* Vrhunac sa JEDNIM kvalitetom nedeljno: i tu prag ostaje glavni sistem.
       Ranije je rotacija bila 2/3 VO2max (intervali + fartlek) i 1/3 prag —
       audit je to i pokazao ("manje praga nego VO2max rada" na 1q planovima),
       a za 10K je to obrnut prioritet. Sada je pola nedelja prag. */
    const m = qualW%4;
    if(m===0) return mkFartlek10K(dow,vol,pI,pE);
    if(m===2) return mkIntervali10K(dow,vol,pI,faza,qualW);
    return mkCruise10K(dow,vol,pT);
  }

  if(slotRole==='q1'){
    /* BRZA / SPECIFIČNA familija */
    if(faza==='prag')      return mkRepeticije10K(dow,vol,pR);
    if(faza==='specifika') return (qualW%3===0) ? mkIntervali10K(dow,vol,pI,faza,qualW)
                                                : mkTrkackiRitam10K(dow,vol,racePace,qualW);
    if(qualW%6===3) return mkPiramida10K(dow,vol,pI);
    if(qualW%4===2) return mkFartlek10K(dow,vol,pI,pE);
    return mkIntervali10K(dow,vol,pI,faza,qualW);
  }

  /* q2 — PRAG. Za 10K je ovo najvredniji trening u nedelji, ne potpora. */
  if(faza==='prag')      return (qualW%2===1) ? mkCruise10K(dow,vol,pT) : mkTempo10K(dow,vol,pT);
  if(faza==='specifika') return (qualW%2===1) ? mkProgresivni10K(dow,vol,pT,pE) : mkTempo10K(dow,vol,pT);
  return (qualW%2===1) ? mkCruise10K(dow,vol,pT) : mkTempo10K(dow,vol,pT);
}

/* ============================================================
   POČETNIK — OBAVEZNE 4 NEDELJE TRČANJE/HOD

   Ko označi da tek počinje da trči ne sme odmah na neprekidno trčanje.
   Lestvica je mesec dana, po nedelju po stepenu:
      N1  1 min trčanja / 1 min hoda
      N2  2 min / 1 min
      N3  3 min / 1 min
      N4  5 min / 1 min
   Posle toga prelazi na neprekidno trčanje, pa još dve nedelje konsolidacije
   (3-4 km pa 5 km neprekidno) PRE nego što uđe prvi kvalitetni trening.
   Kvalitet zatim ulazi postepeno — prve dve nedelje samo jedan.
   ============================================================ */
const RW_LESTVICA = [
  { runSec:60,  walkSec:60, label:'1 min trčanja / 1 min hoda' },
  { runSec:120, walkSec:60, label:'2 min trčanja / 1 min hoda' },
  { runSec:180, walkSec:60, label:'3 min trčanja / 1 min hoda' },
  { runSec:300, walkSec:60, label:'5 min trčanja / 1 min hoda' }
];
const RW_WEEKS = 4;                 /* obavezan mesec dana */
/* Iznad ovog obima odgovor „tek počinjem" nije verodostojan — lestvica
   trčanje/hod je uvod za prvih ~10–25 km/ned (v. upozorenje u generatePlan). */
const POCETNIK_MAX_KM = 30;

function runWalkZaNedelju(weekIdx){
  if(weekIdx < 1 || weekIdx > RW_WEEKS) return null;
  return Object.assign({}, RW_LESTVICA[weekIdx-1]);
}

/* GORIVO NA DUGOM TRCANJU — odluka po distanci (`prof.gorivoOdMin`).
   Polumaraton je prva distanca u aplikaciji gde ovo uopste postoji: preko 90
   minuta telo trosi zalihe glikogena brze nego sto ih nadoknadjuje, a CREVO
   mora da se navikne da prima ugljene hidrate u trku — to je adaptacija koja
   trazi 4-6 nedelja vezbanja i jedino dugo trcanje pruza priliku za nju.
   5K i 10K ovo nemaju (`gorivoOdMin` izostaje), pa im se opis ne menja. */
function gorivoTekst(km, pLRsecPerKm, odMin, jakoOdMin){
  if(!odMin || !(pLRsecPerKm>0)) return '';
  const min = km*pLRsecPerKm/60;
  if(min < odMin) return '';
  /* Jaca preporuka (60-90 g/h) je MARATONSKA odluka i vezana je za profil, ne za
     samo trajanje trcanja — inace bi tiho promenila vec potvrdjene polumaratonske
     planove. Na maratonu je opravdana: zalihe glikogena traju ~90 min na tempu
     trke, a crevo se na 90 g/h navikava nedeljama. */
  const jako = jakoOdMin && min >= jakoOdMin;
  return jako
    ? ` · ${Math.round(min)} min — uvežbaj gorivo: 60–90 g ugljenih hidrata na sat, prvi unos oko 40. minuta pa na svakih 20–25 min. Crevo se na to navikava nedeljama; ne improvizuj na dan trke.`
    : ` · ${Math.round(min)} min — uvežbaj gorivo: 30–60 g ugljenih hidrata na sat, prvi unos oko 40. minuta`;
}
/* Piramida — primitiv prikaza (isti sloj kao sessInt/sessTempo), ovde jer je
   ranije stajao među mk* graditeljima koje je 5K prepis zamenio. */
function sessPyramid(dow,wuKm,reps,paceSec,restSec,cdKm,kind){
  const session={type:'pyramid',kind:kind||'Piramida',wuKm,reps,paceSec,restSec,cdKm,overrides:{}};
  return {dow,tag:'int',km:sessKm(session),desc:sessDesc(session),session};
}

/* ---------- glavni generator ---------- */
/* inp: {startDate, raceDate, pb:{distM,sec}, weeklyKm, intensity, goalSec?} */
/* ============================================================
   IZMENJIVA SESIJA — v1 (tempo + dužina ponavljanja + pauza + broj
   ponavljanja, sva 4 polja). Plan je skelet iz VDOT-a; korisnik sme
   ručno da prepravi bilo koje od ova 4 polja po sesiji. desc/km se
   NE peku unapred — računaju se IZ session objekta, uvek iznova.
   Obim: samo redovne 'int'/'tempo' dane (ne deload — nema kvalitetnih
   dana; ne trkačku nedelju — aktivacioni 200m dan ima drugačiji
   model pauze, distancni a ne vremenski, nije pokriven ovom v1).
   ============================================================ */
/* Pauza: ispod 90 s u sekundama, iznad u minutima. Ranije je davalo
   "164 s hod" / "179 s hod" — tacno, ali se ne cita kao vreme koje covek
   meri na stazi. Sada "2:45 min". */
function fmtRest(sec){
  if(sec % 60 === 0 && sec >= 60) return Math.round(sec/60)+' min';  /* tacan minut uvek kao minut */
  if(sec < 90) return sec+' s';
  const m=Math.floor(sec/60), s=sec%60;
  return m+':'+String(s).padStart(2,'0')+' min';
}
function sessKm(s){
  if(s.type==='int')    return r1(s.wuKm + s.reps*s.repM/1000 + s.cdKm + Math.max(s.reps-1,0)*0.15);
  if(s.type==='pyramid')return r1(s.wuKm + s.reps.reduce((a,b)=>a+b,0)/1000 + s.cdKm + (s.reps.length-1)*0.15);
  if(s.type==='fartlek')return r1(s.wuKm + s.cdKm + s.reps*(s.repSec/s.paceSec + s.restSec/s.easyPaceSec));
  if(s.type==='prog')   return r1(s.qKm);
  return r1(s.wuKm + s.qKm + s.cdKm); /* tempo kontinuirani */
}
/* Kod pragovskih i race-pace formata pauza je LAGANO TRCANJE, ne hod —
   poenta je da napor ostane neprekidan. Kod I/R formata je hod (pun oporavak).
   Spisak je izricit, ne obrazac: sirok regex je zahvatao i "Trkacki ritam"
   (10K), pa je tiho menjao vec potvrdjene 10K planove.
   Van funkcije je zato sto istu podelu koristi i slanje na sat — da opis
   treninga i korak na satu ne mogu da se raziđu. */
const RECOVERY_JOG = ['Tempo isprekidan','Tempo trke','Kontrolna trka'];
function sessDesc(s){
  if(s.type==='int'){
    const restWord = RECOVERY_JOG.includes(s.kind) ? 'laganog trčanja' : 'hoda';
    return `${s.kind} — ${s.wuKm} km zagrevanje + ${s.reps}×${s.repM} m @ ${fmtP(s.paceSec)}/km (${fmtRest(s.restSec)} ${restWord}) + ${s.cdKm} km hlađenje`;
  }
  if(s.type==='pyramid')
    return `${s.kind} — ${s.wuKm} km zagrevanje + ${s.reps.join('-')} m @ ${fmtP(s.paceSec)}/km (${fmtRest(s.restSec)} hoda između ponavljanja) + ${s.cdKm} km hlađenje`;
  if(s.type==='fartlek')
    return `Fartlek — ${s.wuKm} km zagrevanje + ${s.reps}×${s.repSec} s brzo @ ~${fmtP(s.paceSec)}/km (${s.restSec} s laganog trčanja) + ${s.cdKm} km hlađenje`;
  if(s.type==='prog')
    return `Progresivno — ${s.qKm} km: prve dve trećine @ ~${fmtP(s.easyPaceSec)}/km → poslednja trećina @ ${fmtP(s.paceSec)}/km`;
  return `${s.kind||'Tempo'} — ${s.wuKm} km zagrevanje + ${s.qKm} km @ ${fmtP(s.paceSec)}/km + ${s.cdKm} km hlađenje`;
}
function sessInt(dow,wuKm,reps,repM,paceSec,restSec,cdKm,kind){
  const session={type:'int',kind:kind||'Intervali',wuKm,reps,repM,paceSec,restSec,cdKm,overrides:{}};
  return {dow,tag:kind==='Tempo isprekidan'?'tempo':'int',km:sessKm(session),desc:sessDesc(session),session};
}
function sessTempo(dow,wuKm,qKm,paceSec,cdKm,kind){
  const session={type:'tempo',kind:kind||'Tempo',wuKm,qKm,paceSec,cdKm,overrides:{}};
  return {dow,tag:'tempo',km:sessKm(session),desc:sessDesc(session),session};
}
/* Fartlek — struktura po McMillan smernici: 10–12 × 1 min surge (malo brže od 5K
   tempa ≈ naš I-tempo) / 1 min lagani džog. Vremenski surge-ovi → NEMA pouzdane
   Strava lap-detekcije po distanci (deriveQS ga preskače); Race Predictor red
   se emituje (surge-km @ surge tempo), popunjava se ručno. */
function sessFartlek(dow,wuKm,n,surgeSec,easySec,paceSec,cdKm,easyPaceSec){
  const session={type:'fartlek',kind:'Fartlek',wuKm,cdKm,reps:n,repSec:surgeSec,restSec:easySec,paceSec,easyPaceSec,overrides:{}};
  return {dow,tag:'int',km:sessKm(session),desc:sessDesc(session),session};
}
/* Progresivni run: prve 2/3 lako, poslednja trećina na T tempu. */
/* `kind` razdvaja progresivno trcanje koje se ZAVRSAVA NA PRAGU od onog koje se
   zavrsava na TEMPU TRKE. Razlika nije kozmeticka: iz naziva se izvodi zona za
   procenu VDOT-a, a kod brzih trkaca prag i tempo trke lezu toliko blizu da se
   iz samog tempa ne moze pouzdano zakljuciti sta je bila namera. */
function sessProg(dow,totalKm,endPaceSec,easyPaceSec,kind){
  const session={type:'prog',kind:kind||'Progresivno',qKm:totalKm,paceSec:endPaceSec,easyPaceSec,wuKm:0,cdKm:0,overrides:{}};
  return {dow,tag:'tempo',km:sessKm(session),desc:sessDesc(session),session};
}
/* Primenjuje ručnu izmenu JEDNOG polja; mutira i vraća isti day objekat.
   field za 'int': paceSec | repM | reps | restSec | wuKm | cdKm
   field za 'tempo': paceSec | qKm | wuKm | cdKm */
function applyEdit(day, field, value){
  if(!day.session) throw new Error('Ovaj dan nema sesiju koja se može menjati (deload, trkačka nedelja, lako, LR, snaga, odmor).');
  day.session[field]=value;
  day.session.overrides[field]=true;
  day.km=sessKm(day.session);
  day.desc=sessDesc(day.session);
  return day;
}
/* PLANSKA PUTANJA FORME ZA JEDNU NEDELJU.
   Ista računica koju `generatePlan` koristi da odredi tempe (v. `vdotW`), samo
   izvedena iz `meta` da joj mogu i drugi. `null` kad plan ne nosi putanju —
   tada `predRow` pada na staru računicu (v. tamo). */
function planVdotZaNedelju(meta, w){
  if(!meta) return null;
  const v0=+meta.vdot0, vg=+meta.vdotGoal, uk=+meta.weeks;
  if(!isFinite(v0)||!isFinite(vg)||!isFinite(uk)) return null;
  const ramp=Math.min(uk-2, RAMP_CAP_WEEKS);
  if(!(ramp>0)) return v0;
  return v0 + (vg-v0)*Math.min(w,ramp)/ramp;
}

/* `refVdot` je forma koju PLAN očekuje u toj nedelji. Kad je ima, siva
   referentna kriva se crta iz nje.

   ZAŠTO NE IZ PROPISANOG TEMPA, kako je bilo.
   Prijavljeno iz upotrebe: na planu za 21:09 trkačka nedelja je bila najgora
   tačka u celom planu (22:43, gore i od prve), a intervalne sesije su pet
   nedelja zaredom stajale na 22:10 dok su tempo sesije iz istih nedelja
   ispravno išle 21:37 → 21:12. Kriva je zato išla gore-dole po ceo minut i
   osam puta unazad.

   Uzrok je bio čitanje UNAZAD: `vdotFromPace(pt, zone)` je propisan tempo
   tumačio kao izmerenu formu. Ali propisan tempo nije merenje:
     — `pIzaNedelju` u poslednjih 6 nedelja NAMERNO klampuje intervalni tempo na
       tempo trke (`Math.max(pI, racePace)`), da se intervali ne trče brže od
       trke. Pročitan unazad, taj klamp izgleda kao da forma stoji;
     — aktivacija pred trku je 6×200 m i vodi se kao Repeticije, pa u R zoni daje
       VDOT ispod početnog. Komentar uz nju kaže da se „iz šest dvestotinjaka tri
       dana pred trku ne može izvesti nikakva ozbiljna predikcija" i oslanja se na
       to da sesija dobija najmanju težinu (`ALPHA.rep`) — a to važi za lanac
       forme (`recordVdot`), NE i za ovu krivu, koja nije ponderisana nikako.
   Oba propisa su ispravna kao propis; greška je bila čitati ih kao merenje.

   Posledica izmene: svi redovi iste nedelje dobijaju istu referentnu vrednost —
   što je i tačno, jer plan ne očekuje različitu formu u utorak i u četvrtak.
   Unet tempo se ovim NE dira: „ostvareno" se računa iz `S.pred[r.id]` u
   `predCalc`, a `p5k` se koristi isključivo za sivu liniju (v. `chartPred`). */
/* SESIJE ČIJI JE PROPIS IZVEDEN IZ CILJA, NE IZ FORME TE NEDELJE.

   Ovima tempo NIJE `paceForZone(vdotW, zona)` — dakle ono što plan očekuje ove
   nedelje — nego `racePace`, a `racePace` se računa iz predikcije za DAN TRKE.
   Propisati ih tako je ispravno i to je smisao specifičnog bloka (Daniels:
   „M pace = goal marathon pace"). Greška je čitati ih UNAZAD kao merenje: kad
   je `paceForZone(v,'M')` po definiciji tempo maratona za VDOT v, njegov inverz
   nad ciljnim tempom vraća tačno `vdotGoal` — svaki put, identično.

   Izmereno na maratoncu koji svaku sesiju odradi TAČNO kako piše: prva
   `Progresivno (tempo trke)` u N2 upiše 45.7 (= meta.vdotGoal) i podigne formu
   za +1.3; na agresivnijim ulazima +2.2 i +2.4, uz prag koji aplikacija sama
   koristi od 1.5. Lanac posle toga cika-cak: gore posle svake M sesije, dole
   posle svake T. Predikcija se u drugoj nedelji priprema „popravi" za četiri
   do dvanaest minuta, a trkač nije uradio ništa osim što je poslušao plan.

   Nad svih 2304 scenarija otiska, odstupanje propisa od rampe te nedelje:

     Tempo / Tempo isprekidan / Progresivno   [T]   najviše 0.3   — veran propis
     Intervali / Fartlek / Piramida           [I]   najviše 2.6
     Tempo trke                               [T]   medijana −1.1
     Maratonski tempo                         [M]   do +4.2
     Trkački ritam                            [I]   medijana −4.4
     Progresivno (tempo trke)                 [M]   medijana +2.5, do +7.6

   Zato se ne odlučuje po veličini odstupanja (isti tip sesije bi ispadao i
   ulazio iz nedelje u nedelju) nego po POREKLU propisa. Isto obrazloženje koje
   komentar iznad `predRow` već daje za intervalni klamp i za aktivaciju —
   samo primenjeno i na treći potrošač istog podatka, lanac forme.

   ŠTA SE NE GUBI: tempo se i dalje čuva, prikazuje i poredi sa propisom.
   Merenja forme ostaju sve T, I i R sesije, čiji propis JESTE izveden iz rampe
   te nedelje, i test na 3 km, koji je i inače najpouzdaniji ulaz u lanac.

   `Kontrolna trka` NIJE ovde namerno: ona nema zonu (v. ZONE_FOR_KIND) i već
   ide putanjom „trka na toj distanci", koja je za nju ispravna. */
const KIND_IZ_CILJA = {
  'Trkački ritam':1, 'Tempo trke':1, 'Progresivno (tempo trke)':1, 'Maratonski tempo':1
};
function predRow(w,tip,q,pt,raceDistM,refVdot){
  raceDistM=raceDistM||5000;
  const zone=ZONE_FOR_KIND[tip];
  const p5k = (refVdot!=null&&isFinite(refVdot))
    ? Math.round(raceTimeForVdot(refVdot,raceDistM))
    : (zone!=null ? Math.round(raceTimeForVdot(vdotFromPace(pt,zone),raceDistM)) : Math.round(riegelDist(pt*q, q*1000, raceDistM)));
  const red = { w, l:'N'+w+' · '+tip, q, pt, p5k };
  if(KIND_IZ_CILJA[tip]) red.nemeri = true;
  return red;
}
/* Predikcija i QS (Strava lap-detekcija) IZVEDENI iz trenutnog stanja sesija —
   pozivati posle bilo koje applyEdit, tako da oba ostanu dosledna izmeni
   (npr. promenjena dužina ponavljanja mora da promeni i šta sync traži u lapovima). */
function sessQKm(ses){
  if(ses.type==='int')    return r1(ses.reps*ses.repM/1000);
  if(ses.type==='pyramid')return r1(ses.reps.reduce((a,b)=>a+b,0)/1000);
  if(ses.type==='fartlek')return r1(ses.reps*ses.repSec/ses.paceSec);
  if(ses.type==='prog')   return r1(ses.qKm/3); /* T deo = poslednja trećina */
  return ses.qKm;
}
function deriveQS(weeks){
  const qs={};
  weeks.forEach(w=>w.days.forEach(d=>{
    if(!d.session) return;
    if(d.session.type==='int') qs['n'+w.w+'d'+d.dow]=[d.session.repM];               /* i broken tempo — lapovi po repM */
    else if(d.session.type==='pyramid') qs['n'+w.w+'d'+d.dow]=d.session.reps.slice();   /* piramida — lapovi su VEĆ niz različitih dužina */
    else if(d.session.type==='tempo') qs['n'+w.w+'d'+d.dow]=[Math.round(d.session.qKm*1000)];
    /* fartlek/prog: bez lap-spec — vremenski/kontinuirani, nema pouzdane detekcije */
  }));
  return qs;
}
function derivePred(weeks,raceDistM,meta){
  const pred=[];
  weeks.forEach(w=>w.days.forEach(d=>{
    if(!d.session) return;
    pred.push(predRow(w.w, d.session.kind, sessQKm(d.session), d.session.paceSec, raceDistM,
                      planVdotZaNedelju(meta, w.w)));
  }));
  return pred;
}
/* Prenosi ZAKLJUČANA (ručno izmenjena) polja iz starih nedelja na sveže
   regenerisane — koristi ga recalibratedPlan da rekalibracija ne pregazi
   ručne izmene. Vraća fresh (mutiran) niz nedelja. */
function mergeOverrides(freshWeeks, oldWeeks){
  const oldByKey={};
  (oldWeeks||[]).forEach(w=>w.days.forEach(d=>{ if(d.session) oldByKey[w.w+'-'+d.dow]=d.session; }));
  freshWeeks.forEach(w=>w.days.forEach(d=>{
    if(!d.session) return;
    const old=oldByKey[w.w+'-'+d.dow];
    if(!old) return;
    if(old.type!==d.session.type) return; /* rotacija promenila tip sesije na tom slotu — polja nisu prenosiva */
    let touched=false;
    Object.keys(old.overrides||{}).forEach(f=>{
      if(old.overrides[f]){ d.session[f]=old[f]; d.session.overrides[f]=true; touched=true; }
    });
    if(touched){ d.km=sessKm(d.session); d.desc=sessDesc(d.session); }
  }));
  return freshWeeks;
}

function nextMonday(ds){
  /* KRITIČNO: mora biti dosledno UTC. new Date(ds+'T00:00:00') tumači se kao
     LOKALNO vreme, a new Date(ds) (bez vremena) kao UTC po ES spec-u — mešanje
     te dve konvencije je ranije davalo pogrešan datum (unazad 1 dan) u SVAKOJ
     vremenskoj zoni ispred UTC (Beograd, ceo istočni deo sveta), pošto browser
     radi u korisnikovoj lokalnoj zoni, ne u serverskom/test okruženju. */
  const d=new Date(ds);
  const wd=(d.getUTCDay()+6)%7;            /* 0=Pon */
  if(wd!==0)d.setUTCDate(d.getUTCDate()+(7-wd));
  return d.toISOString().slice(0,10);
}
/* Ogledalo nextMonday — nedelja KOJOJ dan pripada, ne sledeća. Isti UTC
   obrazac (ista klasa buga bi se ponovila da se ovde pomeša lokalno/UTC). */
function mondayOfWeek(ds){
  const d=new Date(ds);
  const wd=(d.getUTCDay()+6)%7;            /* 0=Pon */
  d.setUTCDate(d.getUTCDate()-wd);
  return d.toISOString().slice(0,10);
}
/* ============================================================
   POLUMARATON — TRENERSKI MODEL

   Polumaraton NIJE "duzi 10K". Tri stvari ga cine drugom trkom:

   1. TEMPO TRKE NIJE FIKSNA ZONA. Kod 5K je tempo trke prakticno I zona za
      svakoga, kod 10K uvek malo iznad praga. Ovde zavisi od toga KOLIKO DUGO
      covek trci: ispod 1:15 trka se vodi tacno na pragu, na 1:30-1:45 je
      10-15 s/km sporije od praga, a preko 2h znatno sporije — blize
      maratonskom tempu. Brz i spor trkac zato NE SMEJU dobiti isti trening na
      "tempu trke" (v. ritamStrategija21K).
   2. CIKLUS SE ZAVRSAVA PRAGOM, NE OSTRINOM. Danielsova Faza IV za PM ima samo
      dva treninga: prag i dugo trcanje, sve ostalo lagano. 5K zavrsava
      ostrinom, 10K tempom trke — polumaraton se smiruje u prag, jer je to
      sistem koji trku nosi 90-140 minuta.
   3. NEDELJA IMA DVA DUZA TRCANJA. Srednje-dugo trcanje sredinom nedelje
      (Pfitzinger) je element kog nema ni 5K ni 10K: dovoljno dugo da izazove
      adaptacije kojih u kracim trcanjima nema, a nedovoljno dugo da produzi
      oporavak. Akumulirana izdrzljivost je ono sto PM trazi.

   Uz to: VO2max je ovde SAMO potpora (6% nedelje, i samo u srednjoj fazi),
   repeticije su svedene na ekonomiju koraka (3%), a dugo trcanje prvi put u
   aplikaciji prelazi 90 minuta — pa nosi i uputstvo za gorivo.
   ============================================================ */

const KORAK_21K = {
  kons: { pct:0.040, min:1.6, max:3.4 },
  std:  { pct:0.055, min:2.2, max:4.5 },
  agr:  { pct:0.070, min:2.8, max:5.5 }
};
function korakRasta21K(vol, intensity){
  const K = KORAK_21K[intensity] || KORAK_21K.std;
  return Math.max(K.min, Math.min(K.max, vol*K.pct));
}
/* Odrediste: 80 km/ned. Pfitzingerovi PM planovi krecu od ~50 km i idu navise;
   Daniels predlaze 48 km kao pocetak i rast dok si ispod 80. Rekreativac trci
   dobar polumaraton na 55-80 km/ned. */
const CILJ_OBIM_21K = 80;
function peakVol21K(cur, rampSteps, intensity){
  let v = cur;
  for(let i=0;i<rampSteps;i++) v += korakRasta21K(v, intensity);
  const odrediste = Math.min(CILJ_OBIM_21K, Math.max(cur*1.75, cur+20));
  const gornja = Math.max(cur*1.10, odrediste);
  return Math.max(cur, Math.min(v, gornja, 160));
}

/* DUGO TRCANJE ZA POLUMARATON.
   Merilo je VREME, ne kilometraza: vrhunac mora preci 90 minuta (ispod toga
   nema adaptacija koje PM trazi), a plafon je 2h15 — preko toga oporavak kosta
   vise nego sto trening donosi, a dobitak preko 22-26 km je marginalan.
   Udeo 30% nedelje; preko 30% naglo raste rizik povrede (JOSPT). Na niskom
   obimu udeo se dize do 45% (ali najvise 14 km), jer trkac mora da bude u
   stanju da pretrci 21 km — 30% od 30 km/ned je 9 km, a to nije priprema za
   polumaraton nego za 10K. */
function lrCap21K(vol, pLRsecPerKm){
  const timeCap = pLRsecPerKm>0 ? (135*60)/pLRsecPerKm : Infinity;
  const udeo = Math.max(vol*0.30, Math.min(14, vol*0.45));
  return Math.min(udeo, timeCap, 22);
}

/* BUDZETI ZONA ZA POLUMARATON:
     T (prag)      <= 10% nedelje — GLAVNI sistem, trosi se do kraja
     I (VO2max)    <= 6% i <= 8 km — samo POTPORA, i samo u fazi vrhunca
                     (10K ima 8%/10 km jer mu VO2max nosi vise)
     R (repeticije)<= 3% i <= 3 km — samo ekonomija koraka, samo prva faza
     tempo trke    <= 10% u jednoj sesiji (Danielsovo pravilo za M rad) */
const I_PCT_21K = 0.06, I_MAX_21K = 8;
const T_PCT_21K = 0.10;
const R_PCT_21K = 0.03, R_MAX_21K = 3;
const RITAM_PCT_21K = 0.10, RITAM_MAX_21K = 12;
/* Neprekidan prag do 30 min (Daniels: T je "udobno tesko", drzivo 20-30 min).
   5K stoji na 20, 10K na 25 — sto duza trka, to duzi neprekidan prag ima smisla. */
const TEMPO_MAX_SEC_21K = 30*60;

/* KAKO SE RADI TEMPO TRKE — zavisi od toga koliko ce trka trajati.
   Ovo je jedina odluka u celoj aplikaciji koja se grana po PREDVIDJENOM
   TRAJANJU, a ne po distanci — i bas zato sto polumaraton nije ista trka za
   trkaca od 1:20 i za trkaca od 2:20:
     'prag'    (< 80 min)  — tempo trke JESTE prag. Zaseban trening na tempu
                             trke bi bio duplikat prag treninga, pa se ne pravi;
                             specifika ide kroz prag rad.
     'blokovi' (80-110)    — tempo trke je izmedju praga i maratonskog. Trazi
                             svoj trening: 2-3 x 3 km, pa 2-3 x 5 km.
     'dugo'    (> 110 min) — tempo trke je blizu maratonskog, dakle to je
                             izdrzljivost a ne prag. Ne pravi se zaseban tvrd
                             dan; lepi se na KRAJ dugog trcanja. */
function ritamStrategija21K(racePaceSec){
  const min = racePaceSec*21.0975/60;
  if(min < 80) return 'prag';
  if(min <= 110) return 'blokovi';
  return 'dugo';
}

function reps21K(workKm, faza, wkIdx){
  const meni = faza==='prag' ? [1200,1600] : [1200,1600,2000];
  const zelja = meni[wkIdx % meni.length];
  const budzetM = workKm*1000;
  const lestvica = [2000,1600,1200,1000,800,600].filter(x => x<=zelja);
  const rep = lestvica.find(x => 3*x <= budzetM*1.15) || 600;
  const n = Math.max(3, Math.floor(budzetM/rep + 0.08));
  return { rep, n };
}
function pauza21K(repM, paceSec){
  return Math.min(180, Math.max(90, Math.round((repM/1000)*paceSec*0.8)));
}
function mkIntervali21K(dow,vol,pI,faza,wkIdx){
  const q=Math.min(Math.max(vol*I_PCT_21K, 2.4), I_MAX_21K);
  const {rep,n}=reps21K(q,faza,wkIdx);
  const [wu,cd]=wuCdZaObim(vol);
  return sessInt(dow,wu,n,rep,pI,pauza21K(rep,pI),cd,'Intervali');
}
/* CRUISE INTERVALI — glavni alat za prag na polumaratonu. Duza ponavljanja
   nego 10K (do 3 km), jer PM trazi da se prag drzi dugo, a ne da se cesto
   dodiruje. Pauza je kratka (60-75 s laganog trcanja) — to je i poenta cruise
   formata: vise minuta na pragu nego sto jedan neprekidan tempo sme da nosi. */
function mkCruise21K(dow,vol,pT,deo){
  const total=Math.max(Math.min(3, vol*0.12), vol*T_PCT_21K)*(deo||1);
  const repKm = total>=10?3.0 : total>=6?2.5 : total>=3.5?1.6 : 1.0;
  const n=Math.max(2, Math.floor(total/repKm + 0.08));
  const [wu,cd]=wuCdZaObim(vol);
  return sessInt(dow,wu,n,Math.round(repKm*1000),pT,repKm>=2.5?75:60,Math.max(cd,1),'Tempo isprekidan');
}
function mkTempo21K(dow,vol,pT,fixKm,deo){
  /* Pod postoji da tempo ne bude prekratak, NE da probije budzet zone —
     na 12% je na nedelji od 35 km davao 4.2 km praga, iznad Danielsovih 10%. */
  const pod=Math.min(5, r1(vol*0.10))*(deo||1);
  const q=fixKm!=null?fixKm:r1(Math.max(pod, Math.min(vol*T_PCT_21K*(deo||1), TEMPO_MAX_SEC_21K/pT)));
  const [wu,cd]=wuCdZaObim(vol);
  return sessTempo(dow,wu,q,pT,Math.max(cd,1),'Tempo');
}
/* TEMPO TRKE — race simulation. Napreduje kroz ciklus: 2-3 x 3 km sa 1 km
   oporavka, pa 2-3 x 5 km. Pauza je LAGANO TRCANJE od ~1 km, ne hod. */
function mkRitam21K(dow,vol,racePace,pE,qualW){
  /* Apsolutni pod od 4 km vazi tek od ~40 km/ned navise; ispod toga prati obim
     (na 30 km/ned su 4 km na tempu trke 13% nedelje — previse za jednu sesiju). */
  const q=Math.min(Math.max(vol*RITAM_PCT_21K, Math.min(4, vol*0.10)), RITAM_MAX_21K);
  const rani=(qualW||0)%2===0;
  const repKm = q>=12 ? (rani?4.0:5.0) : q>=7.5 ? (rani?3.0:4.0) : q>=5 ? 3.0 : 2.0;
  const n=Math.max(2, Math.floor(q/repKm + 0.08));
  const [wu,cd]=wuCdZaObim(vol);
  return sessInt(dow,wu,n,Math.round(repKm*1000),racePace,Math.round(pE*0.9),Math.max(cd,1),'Tempo trke');
}
/* Fartlek za polumaraton: duzi surge-ovi (2 min) nego 5K (1 min) i 10K (1.5),
   jer je i napor koji PM trazi duzi. Sluzi varijaciji unutar VO2max faze —
   isti stimulus, druga forma, bez monotonije od pet istih intervala. */
function mkFartlek21K(dow,vol,pI,pE){
  const n=Math.max(5, Math.min(10, Math.round(vol*0.12)));
  const [wu,cd]=wuCdZaObim(vol);
  return sessFartlek(dow,wu,n,120,90,pI,cd,pE);
}
function mkRepeticije21K(dow,vol,pR){
  const total=Math.max(1.2, Math.min(vol*R_PCT_21K, R_MAX_21K));
  const repM=300;
  const n=Math.max(4, Math.floor(total*1000/repM + 0.08));
  const restSec=Math.round((repM/1000)*pR*2.5);
  const [wu,cd]=wuCdZaObim(vol);
  return sessInt(dow,wu,n,repM,pR,restSec,cd,'Repeticije');
}
/* `zavrsniPace` je tempo poslednje trecine. Za brze trkace je to PRAG; za one
   kojima polumaraton traje preko 110 min tempo trke lezi znatno ispod praga, pa
   je za njih zavrsetak na TEMPU TRKE — i fizioloski tacnije (aerobni, ne
   pragovski stimulus) i resava dupli prag: kod te grupe su oba kvalitetna dana
   padala na prag, pa je nedeljni T rad isao na 17% umesto Danielsovih 10%. */
function mkProgresivni21K(dow,vol,zavrsniPace,pE,deo,naTempuTrke){
  const total=r1(Math.max(6, Math.min(vol*0.20*(deo||1), 16)));
  return sessProg(dow,total,zavrsniPace,pE, naTempuTrke?'Progresivno (tempo trke)':'Progresivno');
}
/* KONTROLNA TRKA — 3-4 nedelje pred polumaraton. Standard u PM pripremi:
   proba opreme, goriva, ritma i predstartne nervoze pod pravim uslovima, uz
   posten presek forme. Korisnik bira hoce li stvarno na trku ili ce sam
   istrcati kontrolisanih 10 km — obim je isti, pa plan racuna oba isto. */
function mkKontrolnaTrka21K(dow,vol,racePace,pE){
  const [wu,cd]=wuCdZaObim(vol);
  /* Duzina prati OBIM. Fiksnih 10 km je na nedelji od 35 km bilo 27% cele
     nedelje u jednom danu (nadjeno auditom) — a kontrolna trka treba da da
     presek forme, ne da bude najteza nedelja u planu. Na manjem obimu 5K trka
     radi isti posao: proba opreme, goriva, ritma i predstartne nervoze. */
  const trkaKm = Math.max(5, Math.min(10, Math.round(vol*0.15)));
  const km=r1(wu+trkaKm+cd);
  const opis = trkaKm>=8 ? '10K trka' : 'kraća trka (5K ili 10K)';
  return { dow, tag:'tempo', km,
    desc:`Kontrolna trka — ${wu} km zagrevanje + ${trkaKm} km + ${cd} km hlađenje. `+
         `Ako nađeš pravu trku (${opis}) — trči je PUNOM SNAGOM, brže od tempa polumaratona; to je najpošteniji presek forme. `+
         `Ako je nema, istrči ${trkaKm} km sam, kontrolisano na ${fmtP(racePace)}/km (tempo polumaratona). `+
         `Isprobaj opremu, doručak i gorivo tačno kako planiraš na dan trke. `+
         `Sledeća 2–3 dana drži skroz lagano, bez obzira kako se osećaš.`,
    session:{type:'tempo',kind:'Kontrolna trka',wuKm:wu,qKm:trkaKm,paceSec:racePace,cdKm:cd,overrides:{}} };
}

/* ============================================================
   FAZE POLUMARATONSKOG CIKLUSA

     baza      — samo lagano + ubrzanja (pocetnici / netrenirani)
     prag      — prvih 30%: cruise + tempo grade prag, repeticije ekonomiju
     vrhunac   — 30-60%: VO2max intervali dizu plafon; KRACA faza nego kod 10K,
                 jer PM od VO2max rada dobija manje nego od praga
     specifika — poslednjih 40%: Danielsova Faza IV — prag i dugo trcanje nose
                 sve, uz rad na tempu trke tamo gde ima smisla (v.
                 ritamStrategija21K) i kontrolnu trku 4 nedelje pred cilj.

   Granice 30/60 (5K: 25/75, 10K: 30/70) — polumaraton ima NAJDUZU specificnu
   fazu od sve tri distance, jer je specificnost ovde izdrzljivost, a ona trazi
   vremena.
   ============================================================ */
function faza21K(qualW, qualWeeks){
  const f = qualW/Math.max(qualWeeks,1);
  if(f < 0.30) return 'prag';
  if(f < 0.60) return 'vrhunac';
  return 'specifika';
}

/* KOJI SISTEM GADJA q1 TE NEDELJE. Jedan izvor istine — koristi se i za IZBOR
   sesije i za DELJENJE nedeljnog budzeta praga.
   Bez ovoga se desavalo da oba kvalitetna dana padnu na prag, svaki sa PUNIM
   budzetom od 10% — pa je nedeljni T rad isao na 17-21% umesto 10% (nadjeno
   auditom). Danielsov budzet je NEDELJNI, ne po sesiji. */
function q1Familija21K(faza, strat, qualW){
  if(faza==='prag')    return (qualW%3===0) ? 'I' : 'R';
  /* Faza vrhunca je VO2max faza — q1 ostaje VO2max. Ranije je svaka cetvrta
     nedelja tu davala progresivno trcanje (pragovsko), pa su OBA kvalitetna
     dana te nedelje padala na prag i nedeljni T rad je isao na 15%. Progresivno
     trcanje pripada specificnoj fazi, gde i ima svrhu. */
  if(faza==='vrhunac') return 'I';
  if(strat==='blokovi') return 'RP';
  if(strat==='prag')    return (qualW%3===0) ? 'I' : 'T';
  return (qualW%2===1) ? 'RP' : 'T';        /* 'dugo' */
}
function buildQuality21K(qualW, qualWeeks, slotRole, effQ, vol, pI, pT, pE, pR, isTaper1, dow, racePace, ctx){
  const faza = faza21K(qualW, qualWeeks);
  const strat = ritamStrategija21K(racePace);
  /* Kad OBA kvalitetna dana gadjaju prag, svaki dobija ~60% nedeljnog budzeta —
     zbir ostaje u granicama, a nedelja i dalje ima dva pragovska stimulusa. */
  const deo = (effQ===2 && q1Familija21K(faza,strat,qualW)==='T') ? 0.6 : 1;
  if(isTaper1){
    /* Poslednja nedelja pre trke: kratak dodir praga i tempa trke, nista vise.
       Taper skida kolicinu, zadrzava ostrinu. */
    const [twu,tcd]=wuCdZaObim(vol);
    if(effQ===1 || slotRole==='q1'){
      const km=r1(Math.min(5, Math.max(2, vol*0.09)));
      return sessTempo(dow,r1(Math.max(twu*0.8,1)),km,racePace,r1(Math.max(tcd*0.8,0.8)),'Tempo trke');
    }
    return mkTempo21K(dow,vol,pT,r1(Math.min(4, Math.max(2, vol*0.07))));
  }
  /* KONTROLNA TRKA — 3-4 nedelje pre trke, umesto q1 te nedelje.
     Cilja se 4 nedelje pre. Ako je BAS ta nedelja deload, kvalitetnih sesija u
     njoj uopste nema, pa bi kontrolna trka nestala bez traga (nadjeno auditom:
     792 scenarija, npr. 12-nedeljni plan gde je N8 deload). Tada se pomera na
     3 nedelje pre — i dalje u preporucenom prozoru. */
  if(ctx && ctx.weeks && ctx.w && faza==='specifika'
     && (effQ===1 || slotRole==='q1') && vol>=30){
    const doTrke = ctx.weeks - ctx.w;
    const w4 = ctx.weeks - 4;
    const zadnjaR = ctx.weeks - 1 - (ctx.taperW||1);
    const cetvrtaJeDeload = w4>0 && w4%DELOAD_EVERY===0 && w4<zadnjaR;
    if(doTrke===4 ? !cetvrtaJeDeload : (doTrke===3 && cetvrtaJeDeload))
      return mkKontrolnaTrka21K(dow,vol,racePace,pE);
  }

  if(effQ===1){
    /* Jedini kvalitet nedeljno: prag je podrazumevani izbor na svim distancama
       preko 10K — daje najvise po jedinici umora. */
    if(faza==='prag')    return (qualW%3===2) ? mkRepeticije21K(dow,vol,pR) : mkCruise21K(dow,vol,pT);
    if(faza==='vrhunac'){ const m=qualW%3; return m===1 ? mkIntervali21K(dow,vol,pI,faza,qualW) : mkCruise21K(dow,vol,pT); }
    /* specifika */
    if(strat==='blokovi') return (qualW%2===1) ? mkRitam21K(dow,vol,racePace,pE,qualW) : mkTempo21K(dow,vol,pT);
    return (qualW%2===1) ? mkCruise21K(dow,vol,pT) : mkProgresivni21K(dow,vol,strat==='dugo'?racePace:pT,pE,null,strat==='dugo');
  }

  if(slotRole==='q1'){
    /* BRZA / SPECIFICNA familija */
    /* Prag faza traje ~30% ciklusa, sto je na PM planu 4-5 nedelja. Same
       repeticije bi bile pet istih treninga zaredom, a i premalo stimulusa —
       zato se svaka treca nedelja radi kratak dodir VO2max rada. */
    const fam = q1Familija21K(faza, strat, qualW);
    if(fam==='R')  return mkRepeticije21K(dow,vol,pR);
    if(fam==='I')  return (qualW%4===2) ? mkFartlek21K(dow,vol,pI,pE)
                                         : mkIntervali21K(dow,vol,pI,faza,qualW);
    if(fam==='RP') return (faza==='specifika' && strat==='dugo')
                          ? mkProgresivni21K(dow,vol,racePace,pE,null,true)
                          : mkRitam21K(dow,vol,racePace,pE,qualW);
    /* 'T' — pragovski q1. Deli budzet sa q2 (v. `deo`). */
    return (faza==='vrhunac') ? mkProgresivni21K(dow,vol,pT,pE,deo)
                              : mkCruise21K(dow,vol,pT,deo);
  }

  /* q2 — PRAG. Nosi ceo plan, od prve do poslednje nedelje. */
  if(faza==='specifika') return (qualW%2===1) ? mkTempo21K(dow,vol,pT,null,deo) : mkCruise21K(dow,vol,pT,deo);
  return (qualW%2===1) ? mkCruise21K(dow,vol,pT,deo) : mkTempo21K(dow,vol,pT,null,deo);
}

/* DODATAK NA DUGO TRCANJE — "brz zavrsetak".
   Uci telo da drzi tempo trke na UMORNIM nogama, sto je tacno ono sto se
   desava na 15. kilometru polumaratona. Kod sporih trkaca (strategija 'dugo')
   ovo je GLAVNI nosilac rada na tempu trke, pa ide cesce. */
function lrDodatak21K(faza, qualW, lrKm, racePace, strategija){
  if(faza!=='specifika' || !(lrKm>=10)) return '';
  const cesto = strategija==='dugo';
  if(!cesto && qualW%2===0) return '';
  const zavrsni = r1(Math.max(3, Math.min(6, lrKm*0.25)));
  return ` · brz završetak: poslednjih ${zavrsni} km @ ${fmtP(racePace)}/km (tempo trke, na umornim nogama)`;
}

/* ============================================================
   MARATON — TRENERSKI MODEL

   Maraton nije "duzi polumaraton". Cetiri stvari ga razdvajaju:

   1. DUGO TRCANJE IMA VREMENSKI PLAFON OD 3 SATA, NE KILOMETARSKI.
      Fizioloska adaptacija se maksimizuje izmedju 2.5 i 3 sata; preko toga
      NEMA dodatnog aerobnog dobitka, a osteceenje misica, praznjenje glikogena
      i neuromisicni umor naglo rastu — i pojedu kvalitetne treninge koji vise
      znace. Zato brz trkac stigne 32 km unutar 3 sata, a spor trkac na istom
      plafonu stane na 26-28 km. Isti plafon, razlicita kilometraza — i to je
      tacno, ne kompromis (Pfitzinger, Daniels, Lydiard se ovde slazu).
   2. DUGO TRCANJE IMA SOPSTVENI TALAS. Vecina nedelja je 19-25 km; prava
      duga trcanja (plafon) idu DVA puta, razmaknuta ~3 nedelje, a najduze
      pada 3 nedelje pre trke. Trcanje od 3 sata svake nedelje nije plan.
   3. TEMPO TRKE SE UVEZBAVA UNUTAR DUGOG TRCANJA. Maratonski tempo je
      submaksimalan, pa ne trazi zaseban tvrd dan kao 10K ritam — trazi da se
      drzi na UMORNIM nogama. Otud "32 km, poslednjih 10 na maratonskom tempu".
   4. GORIVO JE DEO TRENINGA, NE DETALJ. Zalihe glikogena traju ~90 minuta na
      maratonskom tempu; posle toga dolazi "zid". Crevo se mora TRENIRATI da
      primi 60-90 g ugljenih hidrata na sat, a neuvezbano gorivo je najcesci
      uzrok stomacnih problema na trci.

   Uz to: VO2max je najmanje vazan od sve cetiri distance (5% nedelje),
   repeticije prakticno nestaju, prag ostaje glavni alat za formu, a taper je
   najduzi — tri nedelje, sa smanjenjem obima od ~60% ukupno.
   ============================================================ */

const KORAK_42K = {
  kons: { pct:0.040, min:1.8, max:3.8 },
  std:  { pct:0.055, min:2.4, max:5.0 },
  agr:  { pct:0.070, min:3.0, max:6.0 }
};
function korakRasta42K(vol, intensity){
  const K = KORAK_42K[intensity] || KORAK_42K.std;
  return Math.max(K.min, Math.min(K.max, vol*K.pct));
}
/* Odrediste: 95 km/ned. Pfitzingerov ULAZNI maratonski plan ima vrhunac na
   ~88 km i trazi bazu od 64 km; visi nivoi idu na 112 i 136. Za rekreativca je
   95 posten gornji cilj — preko toga se ulazi u teritoriju gde obim trazi dva
   treninga dnevno. */
const CILJ_OBIM_42K = 95;
function peakVol42K(cur, rampSteps, intensity){
  let v = cur;
  for(let i=0;i<rampSteps;i++) v += korakRasta42K(v, intensity);
  const odrediste = Math.min(CILJ_OBIM_42K, Math.max(cur*1.75, cur+20));
  const gornja = Math.max(cur*1.10, odrediste);
  return Math.max(cur, Math.min(v, gornja, 180));
}

/* DUGO TRCANJE ZA MARATON — VREME je merilo.
   Plafon 180 min (3 sata) je granica preko koje adaptacije prestaju da rastu a
   cena oporavka eksplodira. Apsolutni plafon 32 km postoji samo da brzom
   trkacu (koji bi u 3 sata presao 36+) ne damo vise nego sto maraton trazi.
   Udeo 30% nedelje; na niskom obimu se dize do 45% (najvise 18 km) — inace
   trkac koji trci 40 km/ned nikad ne bi dosao ni blizu maratonske distance. */
function lrCap42K(vol, pLRsecPerKm){
  const timeCap = pLRsecPerKm>0 ? (180*60)/pLRsecPerKm : Infinity;
  const udeo = Math.max(vol*0.30, Math.min(16, vol*0.42));
  return Math.min(udeo, timeCap, 32);
}

/* TALAS DUGOG TRCANJA. Vraca udeo plafona za datu nedelju.
   Dva prava vrhunca, razmaknuta tri nedelje, poslednji u POSLEDNJOJ radnoj
   nedelji (dakle tri nedelje pre trke). Izmedju njih i oko njih nedelje su
   srednje dugacke, a nedelja odmah posle vrhunca je namerno kratka. */
function lrCiklus42K(w, c){
  const zadnjaRadna = c.weeks - 1 - c.taperW;
  /* Taper nedelje se NE diraju ovde. Njih vec skracuje zajednicki mehanizam
     (`prof.taperLrF`, mereno prema VRHUNSKOM dugom trcanju), pa bi dodatno
     smanjenje bilo duplo: mereno je davalo taper nedelju na 48% vrhunca umesto
     istrazivanjem preporucenih ~65%. */
  if(w > zadnjaRadna) return 1;
  const doKraja = zadnjaRadna - w;      /* 0 = poslednja radna nedelja */
  let f;
  if(doKraja===0)      f = 1.00;        /* vrhunac 2 — tri nedelje pre trke */
  else if(doKraja===1) f = 0.85;
  else if(doKraja===2) f = 0.75;        /* oporavak posle vrhunca 1 */
  else if(doKraja===3) f = 1.00;        /* vrhunac 1 */
  else if(doKraja===4) f = 0.85;
  else if(doKraja===5) f = 0.92;
  else                 f = 0.80;
  /* Deload nedelja nikad ne nosi vrhunac dugog trcanja. */
  return c.isDeload ? Math.min(f, 0.70) : f;
}

/* BUDZETI ZONA ZA MARATON:
     M (tempo trke) <= 10% nedelje u jednoj sesiji, <= 20% nedeljno (Daniels)
     T (prag)       <= 10% — glavni alat za formu, ali ne i za specificnost
     I (VO2max)     <= 5% i <= 8 km — najmanje od sve cetiri distance
     R (repeticije) <= 2% — prakticno samo odrzavanje ekonomije koraka */
const M_PCT_42K = 0.10, M_MAX_42K = 16;
const T_PCT_42K = 0.10;
const I_PCT_42K = 0.05, I_MAX_42K = 8;
const R_PCT_42K = 0.02, R_MAX_42K = 2.5;
/* Neprekidan prag do 35 min. Daniels drzi 20; Pfitzinger za maraton izricito
   ide duze (LT trcanja rastu do 11 km). Ovde se prati Pfitzinger, jer je model
   maratonski. */
const TEMPO_MAX_SEC_42K = 35*60;

function reps42K(workKm, wkIdx){
  const meni = [1200,1600,2000];
  const zelja = meni[wkIdx % meni.length];
  const budzetM = workKm*1000;
  const lestvica = [2000,1600,1200,1000,800].filter(x => x<=zelja);
  const rep = lestvica.find(x => 3*x <= budzetM*1.15) || 800;
  const n = Math.max(3, Math.floor(budzetM/rep + 0.08));
  return { rep, n };
}
function mkIntervali42K(dow,vol,pI,wkIdx){
  const q=Math.min(Math.max(vol*I_PCT_42K, 2.4), I_MAX_42K);
  const {rep,n}=reps42K(q,wkIdx);
  const [wu,cd]=wuCdZaObim(vol);
  return sessInt(dow,wu,n,rep,pI,Math.min(180,Math.max(90,Math.round((rep/1000)*pI*0.8))),cd,'Intervali');
}
function mkCruise42K(dow,vol,pT,deo){
  const total=Math.max(Math.min(3, vol*0.10), vol*T_PCT_42K)*(deo||1);
  const repKm = total>=10?3.0 : total>=6?2.5 : total>=3.5?1.6 : 1.0;
  const n=Math.max(2, Math.floor(total/repKm + 0.08));
  const [wu,cd]=wuCdZaObim(vol);
  return sessInt(dow,wu,n,Math.round(repKm*1000),pT,repKm>=2.5?75:60,Math.max(cd,1),'Tempo isprekidan');
}
function mkTempo42K(dow,vol,pT,fixKm,deo){
  const pod=Math.min(6, r1(vol*0.09))*(deo||1);
  const q=fixKm!=null?fixKm:r1(Math.max(pod, Math.min(vol*T_PCT_42K*(deo||1), TEMPO_MAX_SEC_42K/pT)));
  const [wu,cd]=wuCdZaObim(vol);
  return sessTempo(dow,wu,q,pT,Math.max(cd,1),'Tempo');
}
/* MARATONSKI TEMPO kao zaseban trening — koristi se kad dugo trcanje te nedelje
   nije vrhunac, pa ima mesta za specifican rad bez preklapanja umora. */
function mkMaratonskiTempo42K(dow,vol,pM,qualW){
  /* Apsolutni pod od 6 km vazi tek od ~60 km/ned; ispod toga prati obim (na
     40 km/ned je 6 km na tempu trke 15% nedelje — iznad Danielsovog M budzeta). */
  const q=Math.min(Math.max(vol*M_PCT_42K, Math.min(6, vol*0.10)), M_MAX_42K);
  const [wu,cd]=wuCdZaObim(vol);
  /* Naizmenicno neprekidno i izlomljeno: isti obim na tempu trke, druga glava. */
  if((qualW||0)%2===0){
    const repKm = q>=12 ? 5.0 : q>=8 ? 4.0 : 3.0;
    const n=Math.max(2, Math.floor(q/repKm + 0.08));
    return sessInt(dow,wu,n,Math.round(repKm*1000),pM,90,Math.max(cd,1),'Maratonski tempo');
  }
  return sessTempo(dow,wu,r1(q),pM,Math.max(cd,1),'Maratonski tempo');
}
function mkProgresivni42K(dow,vol,zavrsniPace,pE,deo,naTempuTrke){
  const total=r1(Math.max(8, Math.min(vol*0.20*(deo||1), 18)));
  return sessProg(dow,total,zavrsniPace,pE, naTempuTrke?'Progresivno (tempo trke)':'Progresivno');
}
function mkRepeticije42K(dow,vol,pR){
  const total=Math.max(1.0, Math.min(vol*R_PCT_42K, R_MAX_42K));
  const repM=200;
  const n=Math.max(4, Math.floor(total*1000/repM + 0.08));
  const [wu,cd]=wuCdZaObim(vol);
  return sessInt(dow,wu,n,repM,pR,Math.round((repM/1000)*pR*2.5),cd,'Repeticije');
}

/* ============================================================
   FAZE MARATONSKOG CIKLUSA (po Pfitzingerovoj podeli 18-nedeljnog bloka)

     baza          — pocetnici / netrenirani, samo lagano + ubrzanja
     izdrzljivost  — prvih 33%: obim, dugo i srednje-dugo trcanje nose sve.
                     Kvaliteta je NAMERNO malo — gradi se temelj.
     prag          — 33-73%: prag raste (Pfitzinger: LT trcanja od 6 do 11 km),
                     obim i dalje raste. Ovo je najduza faza.
     specifika     — poslednjih 27%: maratonski tempo ulazi u dugo trcanje i
                     kao zaseban trening, uz mali dodatak VO2max rada.

   Granice 33/73 su Pfitzingerove (nedelje 1-5, 6-11, 12-15 od 18).
   ============================================================ */
function faza42K(qualW, qualWeeks){
  const f = qualW/Math.max(qualWeeks,1);
  if(f < 0.33) return 'izdrzljivost';
  if(f < 0.73) return 'prag';
  return 'specifika';
}
/* q1 NIKAD nije prag. Kod Pfitzingera maratonska nedelja ima JEDAN pragovski
   trening — plus dugo i srednje-dugo trcanje. Prva verzija je q1 u fazi praga
   takodje slala na prag, pa je nedeljni T rad isao na 15-20% umesto Danielsovih
   10% (audit: 3901 scenarija). Sada prag zivi iskljucivo na q2, a q1 nosi ono
   sto maraton zaista trazi: ekonomiju rano, VO2max povremeno, a najvise
   MARATONSKI TEMPO — jedini sistem koji je za ovu trku specifican. */
function q1Familija42K(faza, qualW){
  if(faza==='izdrzljivost') return (qualW%2===1) ? 'R' : 'M';
  if(faza==='prag')         return (qualW%3===0) ? 'I' : 'M';
  return (qualW%4===3) ? 'I' : 'M';
}

function buildQuality42K(qualW, qualWeeks, slotRole, effQ, vol, pI, pT, pE, pR, isTaper1, dow, racePace, ctx){
  const faza = faza42K(qualW, qualWeeks);
  const pM = racePace;
  /* q1 vise nikad nije pragovski (v. q1Familija42K), pa nema deljenja budzeta —
     nedeljni prag u celosti pripada q2 sesiji. */
  const deo = 1;
  if(isTaper1){
    /* Poslednja nedelja: kratak dodir maratonskog tempa da noge zapamte ritam,
       i nista vise. Taper skida kolicinu, cuva intenzitet. */
    const [twu,tcd]=wuCdZaObim(vol);
    if(effQ===1 || slotRole==='q1'){
      const km=r1(Math.min(6, Math.max(3, vol*0.10)));
      return sessTempo(dow,r1(Math.max(twu*0.8,1)),km,pM,r1(Math.max(tcd*0.8,0.8)),'Maratonski tempo');
    }
    return mkTempo42K(dow,vol,pT,r1(Math.min(5, Math.max(2.5, vol*0.07))));
  }

  if(effQ===1){
    if(faza==='izdrzljivost') return (qualW%3===2) ? mkRepeticije42K(dow,vol,pR) : mkCruise42K(dow,vol,pT);
    if(faza==='prag')         return (qualW%4===0) ? mkIntervali42K(dow,vol,pI,qualW) : mkCruise42K(dow,vol,pT);
    return (qualW%2===1) ? mkMaratonskiTempo42K(dow,vol,pM,qualW) : mkTempo42K(dow,vol,pT);
  }

  if(slotRole==='q1'){
    const fam = q1Familija42K(faza, qualW);
    if(fam==='R') return mkRepeticije42K(dow,vol,pR);
    if(fam==='I') return mkIntervali42K(dow,vol,pI,qualW);
    /* U fazi izdrzljivosti maratonski tempo ide kao PROGRESIVNO trcanje —
       blaze je i gradi naviku da se tempo drzi na kraju, a ne kao blok. */
    if(fam==='M') return (faza==='izdrzljivost') ? mkProgresivni42K(dow,vol,pM,pE,null,true)
                                                 : mkMaratonskiTempo42K(dow,vol,pM,qualW);
    return mkCruise42K(dow,vol,pT,deo);
  }

  /* q2 — PRAG kroz ceo ciklus. */
  if(faza==='izdrzljivost') return mkCruise42K(dow,vol,pT,deo);
  return (qualW%2===1) ? mkTempo42K(dow,vol,pT,null,deo) : mkCruise42K(dow,vol,pT,deo);
}

/* DODATAK NA DUGO TRCANJE — maratonski tempo na UMORNIM nogama.
   Ovo je najspecificniji trening koji maraton ima: poslednja trecina dugog
   trcanja na tempu trke, tacno u stanju u kom ce trkac biti na 32. kilometru.
   Duzina raste kroz specificnu fazu. Na VRHUNSKIM dugim trcanjima se NE radi —
   tada je zadatak sam obim i uvezbavanje goriva, ne jos i tempo. */
function lrDodatak42K(faza, qualW, lrKm, racePace, _strat, lrF){
  if(faza!=='specifika' || !(lrKm>=16)) return '';
  if(lrF!=null && lrF>=0.99) return '';
  const zavrsni = r1(Math.max(5, Math.min(12, lrKm*0.35)));
  return ` · poslednjih ${zavrsni} km @ ${fmtP(racePace)}/km (maratonski tempo, na umornim nogama)`;
}

/* ============================================================
   PROFILI DISTANCI — jedino mesto gde stoje odluke po distanci.

   `generatePlan` ispod NE SME da sadrži nijedan broj specifičan za distancu:
   sve što se razlikuje između 5K i 10K čita se odavde. Kad se doda polumaraton
   ili maraton, dodaje se NOVI unos + njegove mk / faza / buildQuality funkcije —
   nijedan postojeći plan se pri tom ne dira. To je cela poenta razdvajanja
   (raniji generator je četiri distance provlačio kroz ista grananja, i svaki
   ozbiljan bug je poticao odatle).

   Polja:
     name, minWeeks       — prikaz i minimalna dužina ciklusa
     baseWeeksBeginner    — koliko bazne faze dobija onaj ko TEK POČINJE
     qual2MinKm           — ispod kog obima dva kvaliteta nedeljno nemaju smisla
     korakRasta/peakVol   — rast obima i odredište
     lrCap                — plafon dugog trčanja
     faza/buildQuality    — periodizacija i izbor sesija
     tempoMaxSec          — najduži NEPREKIDAN prag rad
     uvodnaPct            — udeo nedelje za prvu (uvodnu) kvalitetnu sesiju
     wuCdMaxAdd           — koliko WU/CD sme da se produži kad nedelja podbaci
     deloadF/taperF/raceWkF — dubina deloada, tapera i trkačke nedelje
     pIzaNedelju          — da li se I tempo veže za tempo trke pred kraj
   ============================================================ */
const DIST_PROFILES = {
  5000: {
    name:'5K', minWeeks:6,
    baseWeeksBeginner:6,
    qual2MinKm:18,
    korakRasta:korakRasta5K,
    peakVol:peakVol5K,
    lrCap:lrCap5K,
    faza:faza5K,
    buildQuality:buildQuality5K,
    tempoMaxSec:20*60,
    /* UVODNA sesija posle bazne faze mora biti NAJBLAŽI kvalitet ciklusa.
       Na 0.12 je ispadala VEĆA od redovnog tempa (redovni je 10% nedelje) —
       dakle prvi kvalitetni trening posle baze bio je najteži tempo u ciklusu,
       tačno obrnuto od namere. Sada 8%. */
    uvodnaPct:0.08,
    /* Ispod ~30 km/ned vrhunca 5K priprema je "istrci", ne "trci na vreme". */
    bazaMin:30,
    /* Deklarisani plafon udela dugog trcanja u ISPORUCENOJ nedelji — ogledalo
       niskoobimne grane u lrCap5K (vol*0.40). v. klamp u generatePlan. */
    lrMaxUdeo:0.40,
    wuCdMaxAdd:1,
    deloadF:DELOAD_F, taperF:TAPER_F, raceWkF:RACEWK_F,
    taperLrF:0.60,
    /* Talasanje unutar 4-nedeljnog bloka kad je odredište dostignuto:
       lakše -> normalno -> malo teže -> deload. Bez ovoga je trkač koji već
       trči blizu odredišta dobijao po 18 radnih nedelja sa istim obimom —
       nije greška u obimu (ko je na odredištu ne treba da raste, napreduje
       kroz kvalitet), ali se ne trenira tako i ne čita se kao plan. */
    undulacija:[0.94, 0.99, 1.03],
    /* 5K: tempo trke je praktično I tempo. Pred kraj se intervali vezuju za
       ciljni ritam da se ne trče BRŽE od trke — to je 5K-specifično. */
    pIzaNedelju:(pI, racePace, weeksToRace) => weeksToRace<=6 ? Math.max(pI, racePace) : pI
  },
  10000: {
    name:'10K', minWeeks:8,
    /* Početnik koji cilja 10K dobija DUŽU bazu nego za 5K: 4 nedelje
       trčanja/hoda + 4 nedelje konsolidacije, jer i sama trka traži dvostruko
       duže neprekidno trčanje. */
    baseWeeksBeginner:8,
    /* 10K sesije su veće (duža ponavljanja, više praga), pa dva kvaliteta
       traže veći obim nego za 5K (18). */
    qual2MinKm:24,
    korakRasta:korakRasta10K,
    peakVol:peakVol10K,
    lrCap:lrCap10K,
    faza:faza10K,
    buildQuality:buildQuality10K,
    tempoMaxSec:TEMPO_MAX_SEC_10K,
    /* UVODNA sesija mora biti NAJBLAŽI kvalitet ciklusa. Na 0.14 je ispadala
       VEĆA od redovnog tempa (redovni je 10% nedelje) — 4.2 km praga na nedelji
       od 30 km, tj. 14%, iznad Danielsovog budžeta, i to kao PRVI kvalitetni
       trening posle bazne faze. Sada 8% — ispod redovnog tempa, što je i bila
       namera. */
    uvodnaPct:0.08,
    /* 10K stoji na aerobnoj bazi vise nego 5K, pa je i donja granica zdravog
       razuma visa: ispod ~40 km/ned vrhunca plan sluzi da se 10K ISTRCI. */
    bazaMin:40,
    lrMaxUdeo:0.42,   /* ogledalo niskoobimne grane u lrCap10K */
    wuCdMaxAdd:1.5,
    /* Plići taper i blaži deload nego 5K — duža trka traži da aerobna baza
       ostane, a ne da se ispere pred start. */
    deloadF:0.75, taperF:0.72, raceWkF:0.34,
    taperLrF:0.65,
    /* Talasanje unutar 4-nedeljnog bloka kad je odrediste dostignuto:
       lakse -> normalno -> malo teze -> deload. */
    undulacija:[0.94, 0.99, 1.03],
    /* 10K: tempo trke je SPORIJI od I tempa. Vezivanje I intervala za tempo
       trke (kao kod 5K) bi ih pred kraj pretvorilo u obično trčanje na ritmu
       trke — a za to već postoji zasebna sesija (mkTrkackiRitam10K). */
    pIzaNedelju:(pI) => pI
  },
  21097.5: {
    name:'Polumaraton', minWeeks:10,
    /* Pocetnik koji cilja polumaraton: 4 nedelje trcanja/hoda + 6 nedelja
       konsolidacije. Sama trka traje 2h+ za tu populaciju — baza mora biti
       duza nego za 10K (8), a kamoli 5K (6). */
    baseWeeksBeginner:10,
    /* PM sesije su najvece od sve tri distance (cruise do 3 km po ponavljanju,
       tempo do 30 min), pa dva kvaliteta traze i najveci obim. */
    qual2MinKm:30,
    korakRasta:korakRasta21K,
    peakVol:peakVol21K,
    lrCap:lrCap21K,
    faza:faza21K,
    buildQuality:buildQuality21K,
    tempoMaxSec:TEMPO_MAX_SEC_21K,
    uvodnaPct:0.08,
    /* Ispod ~45 km/ned vrhunca polumaraton je "istrci ga", ne "trci na vreme". */
    bazaMin:45,
    lrMaxUdeo:0.45,   /* ogledalo niskoobimne grane u lrCap21K */
    wuCdMaxAdd:1.5,
    /* TAPER OD DVE NEDELJE — standard za polumaraton. Prva nedelja je prelaz
       (82% vrhunca, intenzitet ostaje), druga je pravo skidanje. Duza trka
       trazi vise oporavka nego 5K/10K, ali i vise zadrzane aerobne baze —
       zato je zavrsni taper (0.75) plici nego kod 5K (0.65). */
    taperWeeks:2, taperF2:0.82,
    deloadF:0.76, taperF:0.75, raceWkF:0.36,
    /* Dugo trcanje se u taperu skida na 65% vrhunca — isto kao 10K. Ispod toga
       se gubi aerobni stimulus koji PM trazi da zadrzi do starta. */
    taperLrF:0.65,
    undulacija:[0.94, 0.99, 1.03],
    /* SREDNJE-DUGO TRCANJE — drugo duze trcanje sredinom nedelje. Trazi bar 5
       dana trcanja i ~45 km/ned; ispod toga bi pojelo jedini lagan dan. */
    mlr:{ minDana:5, minKm:45, udeo:0.62 },
    /* Dugo trcanje u baznoj fazi krece od 55% plafona i raste do punog. */
    bazaLrF:0.55,
    minDanaPrep:4,
    /* Preko 90 min dugo trcanje nosi i uputstvo za gorivo — prva distanca u
       aplikaciji gde to uopste ima smisla. */
    gorivoOdMin:90,
    lrDodatak:lrDodatak21K,
    ritamStrat:ritamStrategija21K,
    /* PM: tempo trke je sporiji od I tempa (kao i 10K), pa se intervali ne
       vezuju za njega — rad na tempu trke ima svoje sesije. */
    pIzaNedelju:(pI) => pI
  },
  42195: {
    name:'Maraton', minWeeks:12,
    /* Pocetnik koji cilja maraton: 4 nedelje trcanja/hoda + 8 nedelja
       konsolidacije. Trka traje 4h+ za tu populaciju. */
    baseWeeksBeginner:12,
    /* Maratonske sesije su najvece u aplikaciji (do 16 km na tempu trke), pa
       dva kvaliteta traze i najveci obim. */
    qual2MinKm:38,
    korakRasta:korakRasta42K,
    peakVol:peakVol42K,
    lrCap:lrCap42K,
    lrCiklus:lrCiklus42K,
    faza:faza42K,
    buildQuality:buildQuality42K,
    tempoMaxSec:TEMPO_MAX_SEC_42K,
    uvodnaPct:0.07,
    /* Ispod ~55 km/ned vrhunca maraton je "istrci ga", ne "trci na vreme". */
    bazaMin:55,
    lrMaxUdeo:0.42,   /* ogledalo niskoobimne grane u lrCap42K */
    wuCdMaxAdd:1.5,
    /* TAPER: tri nedelje ukupno sa trkackom. Istrazivanje (analiza 158.000+
       rekreativnih maratonaca) daje ~80% vrhunca tri nedelje pre, ~65% dve
       nedelje pre i ~40% u trkackoj nedelji — sto je ukupno smanjenje od
       ~50%, unutar preporucenih 41-60%. Obim pada, intenzitet ostaje. */
    taperWeeks:2, taperF2:0.80,
    deloadF:0.78, taperF:0.65, raceWkF:0.40,
    /* Dugo trcanje u poslednjoj nedelji pada na 70% vrhunca. Nize od toga se
       ceo taper urusi: lagani dani i srednje-dugo trcanje se racunaju IZ dugog
       trcanja, pa se smanjenje kaskadno mnozi i nedelja padne na ~48% vrhunca
       umesto istrazivanjem preporucenih ~65%. Taper skida obim, ne bazu. */
    taperLrF:0.70,
    undulacija:[0.94, 0.99, 1.03],
    /* Srednje-dugo trcanje je kod Pfitzingera za maraton jos vaznije nego za
       polumaraton — visi planovi imaju 21-24 km sredinom nedelje. */
    mlr:{ minDana:5, minKm:50, udeo:0.60 },
    /* Gorivo se uvezbava od 75 min navise: zalihe glikogena traju ~90 minuta na
       maratonskom tempu, a crevu treba nedeljama da nauci da prima 60-90 g/h. */
    gorivoOdMin:75, gorivoJakoOdMin:120,
    lrDodatak:lrDodatak42K,
    bazaLrF:0.50,
    /* Maraton na manje od 5 dana trcanja je vrlo tesko rasporediti. */
    minDanaPrep:5,
    pIzaNedelju:(pI) => pI
  }
};

function generatePlan(inp){
  const raceDistM = inp.raceDistM||5000;
  const prof = DIST_PROFILES[raceDistM];
  if(!prof) return { error: 'Nepodržana distanca. Generator pravi planove za 5K, 10K, polumaraton i maraton.' };
  /* Odbrana od degenerisanog ulaza — wizard ovo već blokira (pbTotalSec vraća
     null za 0, obStepValid(2) pada), ali bez ove provere NaN bi tiho procurio
     kroz sve tempo formule u OPISE treninga ("@ ~NaN:NaN/km") umesto da se
     odbije čistom greškom. */
  if(!inp.pb || !(inp.pb.sec>0) || !(inp.pb.distM>0))
    return { error: 'Neispravan skorašnji rezultat (distanca i vreme moraju biti veći od nule).' };
  if(!(inp.weeklyKm>0))
    return { error: 'Nedeljna kilometraža mora biti veća od nule.' };
  /* Plan kreće OD DANA generisanja, ne od sledećeg ponedeljka (korisnikov
     zahtev — ranije se gubilo do 6 dana čekanja). Nedelja 1 zadržava PRAVU
     pon-ned strukturu (LR/kvalitet dani i dalje znače stvarni dan u nedelji)
     — dani PRE datuma generisanja se filtriraju na kraju funkcije, ne
     preraspodeljuju. Nedelja 2+ ostaju normalne pune pon-ned nedelje. */
  const start = mondayOfWeek(inp.startDate);
  const daysN = Math.round((new Date(inp.raceDate) - new Date(start)) / 86400000);
  const weeks = Math.floor(daysN/7) + 1;
  const maxWeeks = 104; /* bezbednosni plafon (2 god.) protiv degenerisanog unosa (npr. pogrešan datum), NE ograničenje planiranja — korisnik sme da se sprema koliko god unapred želi */
  if(weeks < prof.minWeeks) return { error: `Manje od ${prof.minWeeks} nedelja do trke (minimum za ${prof.name}) — puna periodizacija nije moguća.` };
  if(weeks > maxWeeks) return { error: `Više od ${maxWeeks} nedelja (2 godine) — proveri datum trke, verovatno je pogrešno unet.` };
  const runDays = Math.max(2, Math.min(7, Math.round(inp.runDays||4)));
  let qWant = Math.max(1, Math.min(2, Math.round(inp.quality||2)));
  const QUAL2_MIN_KM = prof.qual2MinKm;
  /* KOLIKO TAPER NEDELJA. 5K i 10K imaju jednu; polumaraton dve, jer duza trka
     trazi vise oporavka a manje odrzavanja. `taperW` se dalje koristi svuda gde
     je ranije stajala tvrda dvojka (weeks-2), da deload, rampa i undulacija ne
     upadnu u taper. */
  const taperW = Math.max(1, Math.min(3, prof.taperWeeks||1));
  /* Poslednja RADNA nedelja: iza nje su taper nedelje (taperW) i trkacka.
     Za taperW=1 to je weeks-2 — tacno ono sto je i ranije pisalo tvrdo. */
  const zadnjaRadna = weeks - 1 - taperW;
  /* Raspored dana se pravi JEDNOM za ceo plan, pa i odluka o srednje-dugom
     trcanju mora da vazi za ceo plan — a meri se VRHUNCEM, ne unetim obimom.
     Prva verzija je gledala inp.weeklyKm i time uskracivala srednje-dugo
     trcanje svakome ko krene nize a naraste: trkac koji unese 40 km i dodje do
     68 nikad ga ne bi dobio. Ako u ranim (jos malim) nedeljama nema odakle da
     mu se odvoji, raspodela vrati 0 i taj dan se ponasa kao obican lagan —
     struktura se sama prilagodjava kroz plan. */
  const _cur0 = Math.max(8, Math.min(inp.weeklyKm, 120));
  const _deload0 = Math.floor(zadnjaRadna/DELOAD_EVERY);
  const _ramp0 = Math.max(zadnjaRadna - _deload0, 1);
  const peakProcena = prof.peakVol(_cur0, _ramp0, inp.intensity);
  const hoceMLR = !!(prof.mlr && runDays>=prof.mlr.minDana && peakProcena>=prof.mlr.minKm);
  /* KOLIKO KVALITETA NEDELJNI OBIM UOPSTE PODNOSI.
     Broj dana nije jedina granica — vazan je i obim. Dva kvalitetna treninga u
     nedelji od 12 km su besmislena bez obzira koliko ih sitno iseckas: sa
     zagrevanjem i smirivanjem oni sami postanu vecina nedelje, pa nedeljni zbir
     ne moze da padne (prijava korisnika: pocetnik na 10 km/ned, 5 dana — tri
     identicne nedelje i taper visi od vrhunca).

     MERI SE VRHUNCEM PLANA, NE POLAZNIM OBIMOM. Raspored dana se pravi JEDNOM
     za ceo plan, pa i ova odluka vazi za svih N nedelja — a plan raste. Prva
     verzija je gledala `inp.weeklyKm` i time trajno uskracivala drugi kvalitet
     svakome ko krene nize a naraste: polumaratonac koji unese 28 km/ned i dodje
     do vrhunca od 51 km/ned dobijao je JEDAN kvalitet svih 20 nedelja, iako je
     vec od cetvrte nedelje debelo iznad praga od 30 km. To je tacno ista greska
     koju srednje-dugo trcanje (`hoceMLR`, red iznad) vec izbegava time sto
     gleda `peakProcena` — samo nije bila primenjena i ovde. */
  const qCut = qWant>1 && peakProcena < QUAL2_MIN_KM;
  if(qCut) qWant = 1;
  const slots = buildDaySlots(runDays, qWant, { lrDow: inp.lrDow, qDows: inp.qDows, runDows: inp.runDows }, hoceMLR);
  const dayWarnings = dayPrefWarnings(slots);
  const effQ = Object.values(slots).filter(r=>r==='q1'||r==='q2').length;
  const a = assess(inp.pb, weeks, inp.intensity, inp.goalSec||null, raceDistM);
  a.start = start;
  /* NEREALAN CILJ SE MORA IZGOVORITI. assess() od pocetka racuna `realno`, ali
     se posle generisanja nigde nije prikazivalo — a posledica nije kozmeticka:
     racePace se racuna IZ CILJA, ne iz predvidjanja, pa svi tempi u planu budu
     brzi nego sto forma nosi. Vlasnikova filozofija je da plan kaze istinu i
     pusti coveka da odluci — ali onda to mora i da kaze. */
  if(inp.goalSec && a.realno===false){
    const REDOM=[['kons','Konzervativno'],['std','Standardno'],['agr','Agresivno']];
    const stize=REDOM.find(([k])=>assess(inp.pb, weeks, k, inp.goalSec, raceDistM).realno);
    const imeIzabranog=(REDOM.find(([k])=>k===inp.intensity)||[null,'izabranom'])[1];
    dayWarnings.push('Ciljno vreme ' + fmtClock(inp.goalSec) + ' je iznad onoga što ovaj plan realno donosi — ' +
      'na tempu napretka „' + imeIzabranog + '" predviđanje za dan trke je ' + fmtClock(a.predictedSec) + '. ' +
      (stize
        ? 'Tempo napretka „' + stize[1] + '" bi ga dostigao.'
        : 'Nijedan tempo napretka ga ne dostiže za ' + weeks + ' nedelja — treba ti više vremena do trke ili blaži cilj.') +
      ' Plan i dalje računa tempo trke IZ TVOG CILJA, ne iz predviđanja, pa će kvalitetni treninzi biti brži ' +
      'nego što forma trenutno nosi. To je namerno — ali znaj da je tako.');
  }

  /* ============================================================
     BAZNA FAZA — dve različite situacije, ne jedna. Koliko traje je odluka
     distance (`prof.baseWeeksBeginner`); ono ŠTA se u njoj radi je isto za sve.

     (1) POČETNIK (`trainedRecently === false`) — tek počinje da trči.
         Obavezan MESEC DANA trčanja/hoda, po nedelju po stepenu lestvice
         (1:1 -> 2:1 -> 3:1 -> 5:1), pa još dve nedelje neprekidnog laganog
         trčanja radi konsolidacije. Tek posle toga ulazi prvi kvalitetni
         trening, i to postepeno (prve dve kvalitetne nedelje samo jedan).
         Ranije je lestvica bila 8 nedelja i vezivala se za kilometražu
         (`needsRunWalk(km)`), pa je trkač koji te nedelje trči malo bio
         tretiran kao početnik. Sada odlučuje ISKLJUČIVO korisnikov odgovor
         "tek počinjem" — kilometraža ne govori ništa o trenažnom stažu.

     (2) NETRENIRAN, ali trčao ranije — kraća baza (3 nedelje) da se telo
         podseti, bez trčanja/hoda.

     Ko trenira redovno nema baznu fazu; plan kreće odmah u kvalitetni ciklus.
     ============================================================ */
  const trainedRecently = inp.trainedRecently !== false; /* default true */
  const isBeginner = !trainedRecently;
  const zeljenaBaza = isBeginner ? prof.baseWeeksBeginner : 0;
  /* Baza se skraćuje ako plan nije dovoljno dug — ali nikad toliko da ne
     ostane bar minWeeks za periodizovan ciklus. */
  const baseWeeks = zeljenaBaza ? Math.max(0, Math.min(zeljenaBaza, weeks - prof.minWeeks)) : 0;
  /* Trčanje/hod ide samo kroz prve RW_WEEKS nedelja BAZE — ne dalje. */
  const rwWeeks = isBeginner ? Math.min(RW_WEEKS, baseWeeks) : 0;

  /* DONJA granica. Svaki dan trcanja ima pod od ~3 km
     (ispod toga trening nema smisla), pa runDays*3 je minimum koji plan moze
     da isporuci. Trazenih 5 km na 6 dana = 0.8 km po treningu; plan tada daje
     18 km i deload ne moze da smanji ispod poda. */
  if(qCut){
    dayWarnings.push('Plan daje JEDAN kvalitetan trening nedeljno umesto dva. Dva kvaliteta traže bar ~' +
      QUAL2_MIN_KM + ' km/ned, a ovaj plan i na vrhuncu dostiže oko ' + Math.round(peakProcena) +
      ' km/ned — ispod toga bi oni sami bili većina nedelje, a za lagano trčanje (koje gradi bazu) ne bi ' +
      'ostalo mesta. Za dva kvaliteta treba ti viša polazna baza ili više nedelja do trke.');
  }
  const volFloor = r1(runDays * 1.5);   /* apsolutni pod: ispod 1.5 km po treningu nema smisla */
  if(inp.weeklyKm > 0 && inp.weeklyKm < volFloor){
    dayWarnings.push('Na ' + runDays + ' dana trčanja minimum je oko ' + volFloor +
      ' km/ned (ispod ~1,5 km po treningu nema smisla). Tražio si ' + inp.weeklyKm +
      ' km — plan će biti veći od toga. Za tako nizak obim uzmi manje dana trčanja.');
  }

  /* PREPORUCEN MINIMUM DANA TRCANJA — odluka po distanci (`prof.minDanaPrep`).
     Za 5K su tri dana sasvim legitimna; za polumaraton nisu: sa dva-tri trcanja
     nedeljno dugo trcanje postaje 50-70% cele nedelje, pa se obim ne moze
     rasporediti bez da svaki dan bude dugacak. Plan se i dalje pravi — samo se
     kaze sta to znaci. */
  if(prof.minDanaPrep && runDays < prof.minDanaPrep){
    dayWarnings.push('Za ' + prof.name + ' se preporučuje bar ' + prof.minDanaPrep +
      ' dana trčanja nedeljno; izabrao si ' + runDays + '. Na tako malo dana dugo trčanje postaje ' +
      'polovina cele nedelje, pa se obim ne može rasporediti a da svaki trening ne bude dugačak. ' +
      'Plan je napravljen, ali računaj na duže oporavke i manje prostora za kvalitet.');
  }
  if(isBeginner && rwWeeks < RW_WEEKS){
    dayWarnings.push('Plan je prekratak za pun početnički uvod: trčanje/hod traje mesec dana (4 nedelje), ' +
      'a ovde staje ' + rwWeeks + '. Kvalitetni treninzi počinju dok si još na pauzama za hod — ' +
      'uzmi ih blaže, ili pomeri trku za koju nedelju.');
  }
  /* „TEK POČINJEM" + VISOK OBIM JE PROTIVREČAN ULAZ, i plan to mora da kaže.
     Lestvica trčanje/hod (1:1 → 5:1) je napravljena za nekoga ko gradi prvih
     10-25 km nedeljno; na 50 km/ned ona nema nikakvog smisla. Mereno: početnik
     koji unese 50 km/ned dobija baznu fazu na 32-41 km/ned trčanja SA PAUZAMA
     ZA HOD, pa skok na 55 km/ned čim uđe kvalitet — ACWR 1.57, iznad
     Gabbettovog praga od 1.5, i to kod populacije koja skok najlošije podnosi.
     Nijedan od ta dva broja nije ono što je čovek hteo: ili nije početnik, ili
     ne trči toliko. Ne blokira se (sve je izmenjivo — vlasnikova filozofija),
     ali se imenuje, jer tiho prihvatanje ovde pravi plan koji vodi u povredu. */
  if(isBeginner && inp.weeklyKm > POCETNIK_MAX_KM){
    dayWarnings.push('Označio si da TEK POČINJEŠ da trčiš, a uneo ' + inp.weeklyKm + ' km/ned. ' +
      'To se ne slaže: mesec dana trčanja/hoda (1:1 → 5:1) je uvod za nekoga ko gradi prvih ~10–25 km/ned. ' +
      'Plan je napravljen, ali će bazna faza biti nesrazmerno velika, a skok kad uđu kvalitetni treninzi ' +
      'nagliji nego što je bezbedno. Ako već redovno trčiš toliko, vrati se i reci da si trenirao — ' +
      'dobićeš plan bez početničkog uvoda. Ako zaista počinješ, unesi obim koji sada stvarno trčiš.');
  }
  const qualWeeks = weeks - baseWeeks;  /* nedelje u kojima se odvija kvalitetni ciklus */

  /* ============================================================
     OBIM.
     Vrhunac se racuna iz STOPE rasta (`prof.peakVol`), ne iz ukupnog procenta —
     zato duzi blok prirodno nosi veci rast, a ne isti kao kratak. Odrediste je
     ono sto DISTANCA trazi (5K ~55 km/ned, 10K ~70), pa se kilometraza ne gura
     preko toga onima koji trce manje, niti se koci onima koji trce vise.
     Nedeljni korak se IZVODI iz vrhunca i broja rampnih nedelja, da se vrhunac
     dostigne TACNO pred taper — bez platoa u sredini plana. GROW_MAX (+8%)
     ostaje apsolutna bezbednosna granica jednog koraka.
     ============================================================ */
  const vols=[]; let cur=_cur0;
  const rampSteps = _ramp0;
  const peakTarget = peakProcena;
  /* Nedeljni korak je APSOLUTAN (v. `prof.korakRasta`), ne mnozenje sa growMax —
     multiplikativni plafon je na niskom obimu kocio jednako kao i sam rast. */
  const sledeci = v => Math.min(v + prof.korakRasta(v, inp.intensity), peakTarget);
  for(let w=1; w<=weeks; w++){
    if(w===weeks){ vols.push(r1(peak(vols)*prof.raceWkF)); }
    else if(w===weeks-1){ vols.push(r1(peak(vols.length?vols:[cur])*prof.taperF)); }
    /* PRVA taper nedelja (samo kad ih ima dve): jos nije pravo skidanje, nego
       prelaz — oko 82% vrhunca. Obim pada, intenzitet ostaje. */
    else if(taperW>=2 && w>zadnjaRadna){ vols.push(r1(peak(vols.length?vols:[cur])*(prof.taperF2||0.82))); }
    else if(w<=baseWeeks){
      /* Bazne nedelje: postepen blag rast od starta (deo iste rampe, ne nezavisan
         niz). Bez ovoga kvalitetni ciklus posle baze skače kao da baze nema. */
      /* BUG (nadjen auditom): deload se ranije primenjivao SAMO ako je bazna
         nedelja ujedno i POSLEDNJA (w===baseWeeks). Ali nedelja se oznacava kao
         deload cim je w%4===0 — pa je npr. N4 od 8 baznih nedelja nosila oznaku
         DELOAD a dobijala normalan rast (izmereno: N3=11.3km, N4=11.7km). Sada
         se deload primenjuje na SVAKU cetvrtu baznu nedelju, kao i drugde. */
      if(w%DELOAD_EVERY===0 && vols.length){ vols.push(r1(vols[vols.length-1]*prof.deloadF)); }
      else {
        /* BUG: posle deload nedelje rast je kretao OD SNIZENE vrednosti, pa je
           bazna faza padala ispod unetog obima (mereno: uneto 10 km/ned, N5=8.5,
           N6=7.6). Deload je namerno smanjenje, ne nova polazna tacka — sledeca
           nedelja se racuna od nedelje PRE deloada. Kvalitetna faza je to vec
           radila ovako; bazna je ostala nepopravljena. */
        const prevB = vols.length ? vols[vols.length-1] : cur;
        const baseB = (w>1 && (w-1)%DELOAD_EVERY===0 && vols.length>=2) ? vols[vols.length-2] : prevB;
        cur = vols.length ? sledeci(baseB) : cur;
        vols.push(r1(cur));
      }
    }
    else if(w%DELOAD_EVERY===0 && w<zadnjaRadna){ vols.push(r1(vols[vols.length-1]*prof.deloadF)); }
    else{
      const prev = vols.length?vols[vols.length-1]:cur;
      const base = (w>1 && (w-1)%DELOAD_EVERY===0) ? vols[vols.length-2] : prev;
      cur = sledeci(base);
      vols.push(r1(cur));
    }
  }
  /* UNDULACIJA NA ODREDISTU (odluka po distanci — `prof.undulacija`).
     Kad trkac VEC trci blizu obima koji distanca trazi, rampa vrlo brzo dodje
     do vrhunca i onda stoji: audit je na 60-70 km/ned merio i po 18 radnih
     nedelja sa prakticno istim obimom. Sam po sebi to nije greska (ko je na
     odredistu ne treba da raste — napreduje kroz KVALITET, a faze se menjaju),
     ali 18 identicnih nedelja se ne cita kao plan i ne trenira se tako:
     trener i na ravnom obimu talasa unutar bloka (lakse -> normalno -> malo
     tezе, pa deload).
     Primenjuje se ISKLJUCIVO na nedelje koje su vec dosegle vrhunac — dok
     rampa jos raste ne dira se nista. 5K profil ovo nema (undulacija:null),
     pa mu je izlaz nepromenjen. */
  if(prof.undulacija){
    for(let w=baseWeeks+1; w<=zadnjaRadna; w++){
      if(w%DELOAD_EVERY===0) continue;                 /* deload ima svoju ulogu */
      if(vols[w-1] < peakTarget*0.995) continue;       /* jos raste — ne diraj */
      vols[w-1] = r1(peakTarget * prof.undulacija[(w-1)%DELOAD_EVERY]);
    }
  }
  function peak(arr){ return Math.max(...arr, cur); }

  const rampWeeks = Math.min(weeks-2, RAMP_CAP_WEEKS);
  const racePace = Math.round((inp.goalSec||a.predictedSec)/(raceDistM/1000));
  const raceDow = daysN - (weeks-1)*7 + 1; /* 1..7 unutar poslednje nedelje */
  /* goalSec MORA u meta. Ulazio je u generator (racePace se racuna iz njega) ali
     se nije cuvao, a TRI mesta ga citaju: goalCtxText() (AI prompt + Progres),
     goalSecActive() (ciljna linija na grafiku predikcije) i red "cilj X ≈ VDOT Y".
     Sva tri su zbog toga padala na `predictedSec`, pa je plan sam sebi
     protivrecio: dan trke je pisao "cilj 42:00 / ritam 4:12/km", a Progres
     "cilj 43:21 ≈ VDOT 49.1" — gde VDOT 49.1 jeste 42:00, ne 43:21. AI je
     dobijao predvidjanje umesto korisnikovog cilja. */
  const plan={ weeks:[], pred:[], qs:{}, meta:{...a, weeks, intensity:inp.intensity, racePace, runDays, quality:effQ, dayWarnings, raceDistM, raceName:prof.name, baseWeeks, raceDate:inp.raceDate, goalSec:inp.goalSec||null} };
  const strengthDow = (runDays<=5) ? pickStrengthDay(slots) : null;

  function D(dow,tag,km,desc){ return {dow,tag,km,desc}; }
  function REST(dow,desc){ return {dow,rest:true,desc:desc||null}; }
  /* PLAFON UDELA DUGOG TRCANJA — MERI SE NEDELJOM KOJA SE STVARNO SASTAVLJA.
     `lrCap*` deklarise udeo nedelje (5K 27-40%, 10K 30-42%, PM 30-45%, maraton
     30-42%), ali ga racuna iz CILJNOG obima — a nedelja isporuci ono sto stane
     u izabrani broj dana. Stvarni udeo je zato ispadao visi od deklarisanog:
     mereno do 47% nedelje na maratonu, iznad njegovog sopstvenog plafona od 42%.
     JOSPT: preko ~30% nedelje u jednom trcanju raste rizik povrede. Nizak obim
     JESTE namerni izuzetak (do 40-45%, v. lrCap* — trkac mora da bude sposoban
     da pretrci distancu), ali plafon mora da vazi na SASTAVLJENOJ nedelji,
     inace nije plafon nego zelja.
     Racuna se tacno: trazi se lr za koji je lr/(ostatak+lr) = c, dakle
     lr = ostatak*c/(1-c). Pod je najduza kvalitetna sesija (x1.05), da plafon
     ne slomi invarijantu „dugo trcanje je najduze trcanje nedelje".
     Zove se PRE nego sto se dan napravi, da bi opis (gorivo u minutima, brz
     zavrsetak na tempu trke) bio izracunat iz KONACNE kilometraze — naknadno
     secenje `km` ostavilo bi opis koji tvrdi nesto drugo.
     Sta OVO NE RESAVA, namerno: izravnavanje rasta posle ovoga jos potkresuje
     lagane dane, pa isporuceni udeo ume da zavrsi iznad plafona. Probano je i
     to (klamp posle izravnavanja) — i mereno je da POKVARI jacu granicu:
     secenje dugog trcanja smanjuje nedelju, a kvalitetne sesije ostaju iste, pa
     Danielsov budzet praga skoci nazad preko 10%. Zona je bolje potkrepljena
     granica od tvrdog plafona na udeo dugog trcanja (Pfitzingerovi objavljeni
     maratonski planovi redovno idu na 35-40%, 18/55 i preko), pa se ovde staje. */
  function klampLR(alloc, qKms){
    if(!prof.lrMaxUdeo || !(alloc.lr>0)) return alloc;
    const c=prof.lrMaxUdeo;
    const ostatak=qKms.reduce((s,x)=>s+x,0) + (alloc.mlr||0) + alloc.easies.reduce((s,x)=>s+x,0);
    const maxQ=qKms.length?Math.max(...qKms):0;
    const plafon=Math.max(r1(ostatak*c/(1-c)), r1(maxQ*1.05));
    if(alloc.lr>plafon) alloc.lr=plafon;
    return alloc;
  }
  function pushPredQs(dayObj,w,nemeri){
    const ses=dayObj.session;
    const red=predRow(w, ses.kind, sessQKm(ses), ses.paceSec, raceDistM,
                      a.vdot0 + (a.vdotGoal-a.vdot0)*Math.min(w,rampWeeks)/rampWeeks);
    if(nemeri) red.nemeri=true;
    plan.pred.push(red);
    if(ses.type==='int') plan.qs['n'+w+'d'+dayObj.dow]=[ses.repM];
    else if(ses.type==='pyramid') plan.qs['n'+w+'d'+dayObj.dow]=ses.reps.slice();
    else if(ses.type==='tempo') plan.qs['n'+w+'d'+dayObj.dow]=[Math.round(ses.qKm*1000)];
  }

  for(let w=1; w<=weeks; w++){
    const vdotW = a.vdot0 + (a.vdotGoal-a.vdot0)*Math.min(w,rampWeeks)/rampWeeks;
    /* Specifičnost tek u POSLEDNJIH 6 nedelja pred taper — APSOLUTAN broj,
       ne razlomak (w/weeks). Razlomak (weekPhase) se loše skalira na duge
       planove (maraton 40+ ned.): pošto VDOT plato nastupa na FIKSNIH 20
       nedelja (RAMP_CAP_WEEKS) bez obzira na dužinu plana, razlomak-prag bi
       na dugom planu presekao već ravan plato veštačkim usporavanjem na
       pola puta — dokazano testom (N25 3:28/km vs N45 4:04/km na istom
       platou, trebalo bi identično). Apsolutan broj (poslednjih 6 nedelja)
       ispravno prati "etalon N8-N13" nameru nezavisno od ukupne dužine. */
    const pI = prof.pIzaNedelju(paceForZone(vdotW,'I'), racePace, weeks - w);
    const pT=paceForZone(vdotW,'T'), pE=paceForZone(vdotW,'E'), pLR=paceForZone(vdotW,'LR');
        const pR=paceForZone(vdotW,'R');   /* repeticije: faza ekonomije i ostrenje */
    const vol=vols[w-1];
    const isDeload = w%DELOAD_EVERY===0 && w<zadnjaRadna;
    const isTaper1 = w===weeks-1, isRace = w===weeks;
    /* Prva taper nedelja (kad ih ima dve) NIJE `isTaper1`: kvalitet je normalan,
       samo je obim manji. Pravo skidanje je tek poslednja nedelja pre trke. */
    const isTaper2 = taperW>=2 && w>zadnjaRadna && w<weeks-1;
    const days=[];

    if(isRace){
      /* trkačka nedelja pozicionirana po STVARNOM danu trke, ne fiksno četvrtak */
      const rp=racePace;
      const distKm=(raceDistM/1000).toFixed(1).replace(/\.0$/,'').replace('.',',');
      /* Dani trkacke nedelje su bili TVRDO KODOVANI (3 / 3.7 / 2 km). Za trkaca
         na 50 km/ned to je tacno, ali za pocetnika ciji je vrhunac 14 km/ned
         trkacka nedelja je time ispadala 13.7 km — prakticno normalna nedelja,
         umesto najlaksa u planu. Sada prate obim, uz apsolutni minimum da
         shakeout ostane shakeout. */
      const shakeA=r1(Math.max(1.5, Math.min(3, vol*0.22)));
      const shakeB=r1(Math.max(1, Math.min(2, vol*0.15)));
      const aktWu=r1(Math.max(1, Math.min(1.5, vol*0.11)));
      const aktCd=r1(Math.max(0.8, Math.min(1, vol*0.08)));
      const aktN=6;
      /* AKTIVACIJA JE PRAVA SESIJA, ne samo opis dana. Ranije se pravila običnim
         D()-om, bez `session` objekta, a PRED red i qs ključ su joj se dopisivali
         ručno — pa je plan tvrdio da u trkačkoj nedelji postoji sesija „Intervali"
         koju nijedan dan ne nosi (uhvaćeno testom „PRED redovi pokazuju na dan koji
         stvarno postoji"). Sada ide kroz isti put kao svaka druga kvalitetna sesija.
         Vodi se kao REPETICIJE, jer to i jeste: 200 m sa punim odmorom. Time
         automatski dobija i najmanju težinu u lancu forme (ALPHA.rep) — sasvim
         ispravno, jer se iz šest dvestotinjaka tri dana pred trku ne može izvesti
         nikakva ozbiljna predikcija. */
      const aktPace=Math.max(rp-4,pI-6);
      /* PROTOKOL PRED TRKU SE VODI PO POMERAJU OD DANA TRKE, NE PO DANU U NEDELJI.
         Ranije je stajala mapa po danu u nedelji, a petlja je punila samo dane
         1..raceDow — pa je za trku koja pada rano u nedelji protokol prosto
         NESTAJAO, bez traga i bez upozorenja:
           trka u Pon  -> Ned 12 km dugo trcanje, pa TRKA sutradan
           trka u Uto  -> Ned dugo trcanje, Pon 2 km, trka
           trka u Sre  -> Ned dugo trcanje, Pon intervali, Uto 2 km, trka
         Dugo trcanje je zakucano na nedelju (`lrDow` podrazumevano 7) za ceo
         plan, pa se sudaralo sa trkom. Sada dani -3/-2/-1 idu tamo gde po
         KALENDARU i padaju — u prethodnu (taper) nedelju kad treba. */
      const proto={
        '-3': dw=>D(dw,'lako',shakeA,`${shakeA} km shakeout (skroz lagano) + lagani core`),
        '-2': dw=>{ const s=sessInt(dw,aktWu,aktN,200,aktPace,120,aktCd,'Repeticije');
                    s.desc+=' — aktivacija'; return s; },
        '-1': dw=>D(dw,'lako',shakeB,`${shakeB} km shakeout + lagana mobilnost`),
        '0':  dw=>D(dw,'trka',raceDistM/1000,`🏁 TRKA ${distKm} km (${prof.name}) — cilj ${fmtP(inp.goalSec||a.predictedSec)} / ritam ${fmtP(rp)}/km`)
      };
      for(let dw=1; dw<=raceDow; dw++){
        const mk=proto[String(dw-raceDow)];
        days.push(mk ? mk(dw) : REST(dw));
      }
      const aktU=days.find(d=>d.dow===raceDow-2 && d.session);
      /* AKTIVACIJA SE NE MERI. Red joj i dalje treba (dan postoji, tempo se
         prikazuje i sme da se unese), ali iz nje se ne sme izvoditi forma —
         v. `nemeri` uz recordVdot. Gornji komentar se oslanjao na to da kao
         Repeticije dobija najmanju težinu u lancu (ALPHA.rep); prigušenje
         nije isključenje, i merenjem se videlo koliko: trkač koji aktivaciju
         odradi TAČNO kako piše dobije pad forme (maraton 45.4 → 45.0) i
         predikciju goru nego pre poslednjeg treninga (3:26:44 → 3:28:16).
         Uzrok je što joj je tempo `max(rp-4, pI-6)` — tempo TRKE, a vodi se
         kao Repeticije, pa pročitana kroz R zonu daje VDOT ispod polaznog
         (na maratonu 35.8 naspram vdot0 41.0). */
      if(aktU) pushPredQs(aktU, w, true);
      /* Dani protokola koji ne staju u trkacku nedelju upisuju se u PRETHODNU.
         Dan koji se time gubi mora da povuce i svoj PRED red i qs kljuc —
         inace ostaje predikcijski red za trening koji vise ne postoji (ista
         klasa greske koju vec resava filtriranje nedelje 1 na kraju). */
      let pregazenLR=false;
      for(let off=-3; off<=-1; off++){
        const dw=raceDow+off;
        if(dw>=1 || !plan.weeks.length) continue;
        const pw=plan.weeks[plan.weeks.length-1];
        const cilj=dw+7;
        const i=pw.days.findIndex(x=>x.dow===cilj);
        if(i<0) continue;
        const stari=pw.days[i];
        if(stari.tag==='lr' && !stari.mlr) pregazenLR=true;
        delete plan.qs['n'+pw.w+'d'+cilj];
        if(stari.session){
          const j=plan.pred.findIndex(pr=>pr.w===pw.w && pr.l==='N'+pw.w+' · '+stari.session.kind);
          if(j>=0) plan.pred.splice(j,1);
        }
        pw.days[i]=proto[String(off)](cilj);
        /* `nemeri` i OVDE. Kad trka padne rano u nedelji, aktivacija ne staje u
           trkačku nedelju nego se upisuje u prethodnu — drugim putem, pa je
           prva verzija ove popravke nije ni dotakla. Merenjem (trka u
           ponedeljak, sve četiri distance): forma je i dalje padala posle
           ispravno odrađene aktivacije, a predikcija na maratonu
           3:26:21 → 3:27:53. Jedina sesija koja ide kroz `proto[-2]` je
           aktivacija, pa uslov glasi baš na nju. */
        if(pw.days[i].session) pushPredQs(pw.days[i], pw.w, off === -2);
        pw.vol=r1(pw.days.reduce((s,x)=>s+(x.km||0),0));
      }
      /* Ako je protokol pregazio samo dugo trcanje, srednje-dugo ostaje kao
         jedini „dugi" dan te nedelje — a to vise nije drugo duze trcanje nego
         obican lagan dan: tri dana pred trku se izdrzljivost ne gradi. */
      if(pregazenLR && plan.weeks.length){
        const pw=plan.weeks[plan.weeks.length-1];
        if(!pw.days.some(d=>(d.tag==='lr'&&!d.mlr)||d.tag==='rw')){
          pw.days.forEach(d=>{ if(d.mlr){ d.tag='lako'; delete d.mlr;
            d.desc=`${d.km} km lako (Z2)`; } });
        }
      }
    } else if(w <= baseWeeks){
      /* FAZA 1 (bazna) — samo lako trčanje + obavezne strides, bez kvaliteta.
         Gradi aerobnu bazu i obim pre nego što kvalitetni ciklus počne. */
      const mlrUdeo = hoceMLR && prof.mlr ? prof.mlr.udeo : 0;
      /* DUGO TRCANJE U BAZNOJ FAZI RASTE POSTEPENO (odluka po distanci,
         `prof.bazaLrF`). Bez toga bazna faza odmah daje pun plafon dugog
         trcanja — na polumaratonu je to znacilo 22 km vec u N3 kod nekoga ko je
         oznacio da TEK POCINJE (nadjeno auditom). Baza gradi obim, ne testira
         maksimum; plafon se otvara linearno kroz bazu. */
      const bazaF = prof.bazaLrF && baseWeeks>0
        ? prof.bazaLrF + (1-prof.bazaLrF)*(w/Math.max(baseWeeks,1))
        : 1;
      const lrCapBaza = bazaF<1 ? ((v,pl)=>prof.lrCap(v,pl)*bazaF) : prof.lrCap;
      const alloc=klampLR(allocEasyLR(vol, [], runDays-1, runDays, pLR, lrCapBaza, mlrUdeo), []);
      let ei=0;
      for(let dow=1; dow<=7; dow++){
        const role=slots[dow];
        if(role==='rest'){
          if(dow===strengthDow) days.push(D(dow,'snaga',null,`Mobilnost + snaga po sopstvenom programu — opciono (bez trčanja)`));
          else days.push(REST(dow));
          continue;
        }
        if(role==='lr'){
          const rwLR = runWalkZaNedelju(w<=rwWeeks ? w : 0);
          if(rwLR){
            const dLR = D(dow,'rw',alloc.lr,`${alloc.lr} km — ${runWalkText(rwLR)}, najduže trčanje te nedelje`);
            dLR.runWalk = { runSec:rwLR.runSec, walkSec:rwLR.walkSec, label:rwLR.label };
            days.push(dLR);
          } else {
            days.push(D(dow,'lr',alloc.lr,`${alloc.lr} km lako-dugo (Z2) @ ~${fmtP(pLR)}/km — bazna faza, bez kvaliteta${gorivoTekst(alloc.lr,pLR,prof.gorivoOdMin,prof.gorivoJakoOdMin)}`));
          }
          continue;
        }
        if(role==='mlr' && alloc.mlr>0 && !runWalkZaNedelju(w<=rwWeeks ? w : 0)){
          const dMb=D(dow,'lr',alloc.mlr,`${alloc.mlr} km srednje-dugo (Z2) @ ~${fmtP(pLR)}/km — drugo duže trčanje u nedelji`);
          dMb.mlr=true;
          days.push(dMb);
          continue;
        }
        /* strides na svakom drugom lakom danu tokom baze (Daniels: strides kroz sve faze) */
        let km=alloc.easies[ei]!=null?alloc.easies[ei]:4;
        /* Isto među-nedeljno susedstvo kao u kvalitetnom ciklusu ispod — bazna
           faza ima LR dane isto tako, ista opasnost postoji. */
        if(dow===1 && slots[7]==='lr' && plan.weeks.length>0){
          const prevW=plan.weeks[plan.weeks.length-1];
          const prevLR=Math.max(...prevW.days.filter(d=>d.tag==='lr').map(d=>d.km||0),0);
          /* BUG (nadjen prijavom korisnika: 4 dana/2 kvaliteta ostavlja TACNO
             jedan lak dan, uvek u ponedeljak — ovaj cap ga je pogadjao SVAKE
             nedelje, ne kao redak bezbednosni izuzetak. Flat 50% prethodnog LR-a
             je grublji i STROZI od allocEasyLR-ovog sopstvenog easyCeil-a (koji
             vec dozvoljava do 70% OVONEDELJNOG LR-a do 12km) — ta dva pravila su
             se sudarala, i grublje je uvek pobedjivalo, gaseci allocEasyLR-ovu
             already-bezbednu procenu. Narocito posle deload nedelje (mali
             prevLR) ovo je gusilo sledeci ponedeljak bez ikakvog stvarnog rizika
             (deload LR je mali — nema "drugog LR-a" da se cuvamo). Ista tiered
             formula kao easyCeil, primenjena na prevLR — cuva izvornu nameru
             (spreci lak dan da bude skoro isti kao LR) bez nepotrebnog gusenja. */
          if(prevLR>0){
            const capKm=Math.min(14, Math.max(r1(prevLR*0.50), Math.min(12, r1(prevLR*0.70))));
            km=Math.min(km, capKm);
          }
        }
        const rw = runWalkZaNedelju(w<=rwWeeks ? w : 0);
        if(rw){
          /* Pocetnik: lagani dan je run/walk. Strides se NE dodaju — ubrzanja
             pretpostavljaju osnovu koju ovaj korisnik jos gradi. */
          const dd = D(dow,'rw',km,`${km} km — ${runWalkText(rw)}`);
          dd.runWalk = { runSec:rw.runSec, walkSec:rw.walkSec, label:rw.label };
          days.push(dd);
        } else {
          const strides = (ei%2===0) ? ' + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)' : '';
          days.push(D(dow,'lako',km,`${km} km lako (Z2) @ ~${fmtP(pE)}/km${strides}`));
        }
        ei++;
      }
    } else {
      /* kvalitetne sesije po slotovima (deload: nema kvaliteta; prva kval. nedelja: samo q1, kao uvodna) */
      const qualW = w - baseWeeks;         /* redni broj unutar kvalitetnog ciklusa (1-indeksiran) */
      /* KOLIKI OBIM SME DA DIKTIRA VELICINU KVALITETNIH SESIJA.
         Ciljni obim nedelje ume da bude veci od onoga sto izabrani broj dana
         moze da ponese — najizrazenije na maratonu, gde plan cilja 59 km a
         cetiri dana isporuce 43. Sesije su se do sada racunale iz CILJA, pa je
         jedan tempo od 6 km ispadao 14% isporucene nedelje umesto Danielsovih
         10% (audit: 2269 scenarija).
         Ovde se prvo napravi PROBNA raspodela u kojoj su svi dani lagani —
         njen zbir je posten donji procenitelj onoga sto nedelja moze da nosi.
         Kvalitetne sesije se racunaju iz TOGA; lagani dani i dalje ciljaju pun
         obim, pa nedelja ne gubi kilometre bez potrebe.

         VAZI ZA SVE CETIRI DISTANCE. Ovo je nekad stajalo iza profilskog flaga
         `sesijeIzIsporucivog`, koji je bio ukljucen SAMO na maratonu — jer je
         tamo prvi put i primecen. Ali uzrok nije maratonski nego masinski:
         `vol` je CILJ, a nedelja isporuci ono sto stane u izabrani broj dana,
         na svakoj distanci. Mereno na 22.080 planova, nedelje preko Danielsovog
         budzeta praga (10%): 5K 11.6%, 10K 14.7%, HM 15.9% — a maraton, jedini
         sa ukljucenim flagom, 3.8%. Sa ovom raspodelom: 0.7% / 0.4% / 0.0%.
         Flag je uklonjen namerno: da nova distanca ne bi tiho vratila bug time
         sto ga zaboravi da ukljuci. */
      let volQ = vol;
      {
        const probaCap = prof.lrCiklus
          ? ((v,pl)=>prof.lrCap(v,pl)*prof.lrCiklus(w,{weeks,baseWeeks,taperW,isDeload}))
          : prof.lrCap;
        const proba = allocEasyLR(vol, [], Math.max(runDays-1,1), runDays, pLR, probaCap,
                                  hoceMLR && prof.mlr ? prof.mlr.udeo : 0);
        const moguce = proba.lr + (proba.mlr||0) + proba.easies.reduce((a,b)=>a+b,0);
        if(moguce>0) volQ = Math.min(vol, r1(moguce*1.05));
      }
      /* "Uvodna" prva kvalitetna nedelja (samo 1 kvalitet, tempo umesto
         intervala) ima smisla za nekoga ko ULAZI u kvalitetni trening — posle
         bazne faze, ili ako nije trenirao redovno. Za trkaca koji VEC radi 2
         kvaliteta nedeljno bila je besmislena: trazi 2, prva nedelja da 1.
         Sada se primenjuje samo tamo gde je stvarno uvod u kvalitet. */
      const isFirstQualWeek = qualW===1 && (baseWeeks>0 || !trainedRecently);
      const sessions={};
      for(let dow=1; dow<=7; dow++){
        const role=slots[dow];
        if(role!=='q1' && role!=='q2') continue;
        if(isDeload) continue;
        if(isFirstQualWeek && role==='q2') continue;
        if(isFirstQualWeek && role==='q1'){
          /* UVODNA sesija: lagan kontinuiran tempo, ne intervali — prvi kvalitet
             posle baze mora da bude najblazi trening u ciklusu. Skalira se
             obimom (ranije tvrdo 2 km WU + do 5 km T + 2 km CD, sto je za
             pocetnika na 11 km/ned bila sesija od 6 km — 55% nedelje, i obim
             je zbog nje skakao +54% cim kvalitet udje). */
          const [uwu,ucd]=wuCdZaObim(vol);
          const qT=r1(Math.min(Math.max(volQ*prof.uvodnaPct, 1.5), 5, prof.tempoMaxSec/pT));
          sessions[dow]=sessTempo(dow,uwu,qT,pT,Math.max(ucd,1),'Tempo');
          continue;
        }
        /* ctx nosi polozaj nedelje u planu — potreban je distancama koje imaju
           dogadjaje vezane za DATUM, a ne za fazu (polumaraton: kontrolna trka
           4 nedelje pred cilj). 5K i 10K ga ignorisu. */
        sessions[dow]=prof.buildQuality(qualW,qualWeeks,role,effQ,volQ,pI,pT,pE,pR,isTaper1,dow,racePace,{weeks,w,taperW});
      }
      /* MLR se broji medju "lagane" dane jer se hrani iz istog ostatka —
         allocEasyLR mu prvo odvoji njegov deo, pa ostatak podeli. */
      const easyDowsCount=[1,2,3,4,5,6,7].filter(d=>{
        const role=slots[d];
        return role==='easy' || role==='mlr' || ((role==='q1'||role==='q2') && !sessions[d]);
      }).length;
      /* PRODUZENO ZAGREVANJE/SMIRIVANJE kad nedelja podbacuje ciljni obim.
         Sa 4 dana i 2 kvaliteta ostaje samo JEDAN lagan dan, pa nedeljni zbir
         padne ispod trazenog. Umesto da se sve svali na taj jedan dan,
         produzuje se WU i CD kvalitetnih sesija — to su lagani kilometri koji
         ionako pripadaju tim treninzima, a ne menjaju radni deo ni intenzitet.

         ISPRAVKA (prijava korisnika: 10K, trazeno 65 km/ned na 4 dana, plan
         isporucivao 52.6 km). Mehanizam je bio preslab bas tamo gde najvise
         treba, iz dva razloga:
         1) radio je na PROCENI (zbirQ + 3km po lakom danu + vol*0.30 za LR).
            Sve tri stavke su promasivale: LR je na >=64 km/ned capovan na
            Danielsovih 25% (16.2 km, ne 19.5), a lagan dan ide do ~70% LR-a,
            ne do poda od 3 km. Procena je zato videla mnogo manji manjak nego
            sto stvarno postoji.
         2) rast je bio ravnih +1 km po strani bez obzira na obim — i kad je
            manjak prepoznat, pokrivao je jedva ~4 km od 12.5.

         Sada NEMA procene: raspodela se stvarno izvrsi (allocEasyLR), izmeri
         se pravi manjak, WU/CD se prosire i raspodela se ponovi. Dva prolaza
         su dovoljna jer prosirenje smanjuje ostatak iz kog se racunaju LR i
         lagani dani, pa se drugi prolaz samo doteruje.
         Granica se meri kao DODATAK iznad osnovnog WU/CD sesije, ne kao
         apsolutna vrednost: osnova je vec 2 km, pa bi apsolutni plafon od 2 km
         potpuno ugasio rast na niskom obimu (mereno: 20 km/ned na 3 dana palo
         bi sa tacnih 20 na 15.9). Dodatak skalira sa obimom, 1-2.5 km po
         strani — na 20 km/ned to je +1 (isto kao ranije), na 65 km/ned +2.5,
         pa zagrevanje ide do ~4.5 km, sto je normalno za taj obim.
         Bezbednosne granice za LR i lagane dane se NE DIRAJU — visak ide
         iskljucivo u lagane kilometre koji vec pripadaju kvalitetnom danu. */
      const mlrUdeoQ = hoceMLR && prof.mlr ? prof.mlr.udeo : 0;
      /* CIKLUS DUGOG TRCANJA (odluka po distanci, `prof.lrCiklus`).
         5K, 10K i polumaraton puste dugo trcanje da raste zajedno sa obimom i
         to je tacno — njihovo najduze trcanje nikad nije toliko skupo da bi
         traiilo sopstveni ritam. Maraton je drugi slucaj: trcanje od 3 sata se
         ne moze ponavljati svake nedelje, pa dugo trcanje dobija SVOJ talas
         (vecina nedelja srednje dugacko, dva prava vrhunca). Bez ove kuke
         profil bi mogao samo da podigne plafon — a plafon svake nedelje nije
         plan nego put u povredu. */
      const lrF = prof.lrCiklus ? prof.lrCiklus(w, {weeks, baseWeeks, taperW, isDeload}) : 1;
      const lrCapW = (lrF!==1) ? ((v,pl)=>prof.lrCap(v,pl)*lrF) : prof.lrCap;
      const allocFor=()=>allocEasyLR(vol, Object.values(sessions).map(d=>d.km||0),
                                     easyDowsCount, runDays, pLR, lrCapW, mlrUdeoQ);
      let alloc=allocFor();
      (function(){
        /* U TAPER NEDELJI SE OVO NE RADI. Mehanizam postoji da nedelja stigne
           do ciljnog obima — a taper je NAMERNO smanjen obim, pa ga popunjavanje
           zagrevanja direktno poništava. Izmereno (10 km/ned, 2 dana, 6 nedelja):
           taper sesija naduvana sa 3.9 na 5.9 km, a pošto dugo trčanje ima pod
           vezan za najveću kvalitetnu sesiju (maxQ*1.05), povuklo se i ono na
           6.2 — taper nedelja je ispala 12.1 km, TAČNO KOLIKO I VRHUNAC.
           Taper skida količinu; ako nedelja zbog toga ne stigne do broja, to je
           namera, ne manjak. */
        if(isTaper1) return;
        const strana=Object.values(sessions).filter(d=>d.session && d.session.type!=='prog'
                          && d.session.wuKm!=null && d.session.cdKm!=null);
        if(!strana.length) return;
        const ukupno=()=>Object.values(sessions).reduce((s,d)=>s+(d.km||0),0)
                        + alloc.lr + alloc.easies.reduce((s,x)=>s+x,0);
        /* Zagrevanje/smirivanje su PRIPREMA za rad, ne skladiste za obim.
           Raniji plafon (do +2.5 km po strani, skaliran obimom) dolazio je iz
           maratonske strane generatora i na 5K je davao besmislice — "4 km
           zagrevanje + 3 km tempa + 4 km smirivanja" za trkaca od 25 minuta.
           Sada najvise +1 km po strani: zagrevanje ostaje 2-3 km, smirivanje
           1.5-2.5 km, sto je tacno ono sto 5K trening trazi. Ako obim posle
           toga ne stane u izabrani broj dana, plan to KAZE (v. strukturno
           upozorenje na kraju) umesto da naduva kvalitetne dane. */
        const maxAdd=prof.wuCdMaxAdd;
        const baza=strana.map(d=>({d, wu:d.session.wuKm, cd:d.session.cdKm}));
        for(let pass=0; pass<2; pass++){
          const manjak=vol-ukupno();
          if(manjak<=1) break;
          const korak=manjak/(strana.length*2);
          let pomereno=false;
          baza.forEach(b=>{
            const s=b.d.session;
            /* nikad ne SMANJUJE postojeci WU/CD — samo raste, do osnova+maxAdd */
            const nw=Math.max(s.wuKm, r1(Math.min(b.wu+maxAdd, s.wuKm+korak)));
            const nc=Math.max(s.cdKm, r1(Math.min(b.cd+maxAdd, s.cdKm+korak)));
            if(nw>s.wuKm||nc>s.cdKm){ s.wuKm=nw; s.cdKm=nc; b.d.km=sessKm(s); b.d.desc=sessDesc(s); pomereno=true; }
          });
          if(!pomereno) break;      /* vec na plafonu — dalje prolaziti nema smisla */
          alloc=allocFor();
        }
      })();
      /* TAPER SKRAĆUJE I DUGO TRČANJE, ne samo kvalitet.
         Raspodela po danima deli ono što ostane posle kvalitetnih sesija — a u
         taper nedelji su one namerno male, pa je ceo ostatak padao na dugo
         trčanje. Izmereno (15 km/ned, 2 dana): vrhunac LR 11.0 km, taper LR
         10.6 km — dakle taper prakticno nije ni bio taper, samo je zamenio
         kvalitet dugim trčanjem (73% cele nedelje).
         Pravilo je trenersko i ide po distanci: 5K skida dugo trčanje na ~60%
         vrhunca, 10K na ~65% (duža trka traži da aerobni stimulus ostane malo
         duže). Ono što se time "izgubi" iz nedelje se NE nadoknađuje drugde —
         to i jeste smisao tapera. */
      if((isTaper1||isTaper2) && plan.weeks.length && prof.taperLrF){
        const pikLR = Math.max(...plan.weeks.map(pw =>
          Math.max(...pw.days.filter(d=>d.tag==='lr'||d.tag==='rw').map(d=>d.km||0), 0)), 0);
        /* Prva taper nedelja skida blaze (85%), poslednja do kraja (prof.taperLrF). */
        const f = isTaper1 ? prof.taperLrF : 0.85;
        if(pikLR>0) alloc.lr = r1(Math.min(alloc.lr, pikLR*f));
        /* Invarijanta se NE sme slomiti skraćivanjem: dugo trčanje ostaje
           najduže trčanje nedelje. Na malo dana taper sesija ume da bude veća
           od tako smanjenog LR-a. */
        const maxQt = Math.max(...Object.values(sessions).map(d=>d.km||0), 0);
        if(maxQt > 0) alloc.lr = r1(Math.max(alloc.lr, maxQt*1.05));
        /* Lagani dani su izracunati PRE skracivanja LR-a i capovani su prema
           njemu (do ~70% LR-a) — posle skracivanja bi neki od njih bio duzi od
           dugog trcanja. Prate ga nanize; u taperu ionako treba da se skrate. */
        alloc.easies = alloc.easies.map(e => Math.min(e, r1(alloc.lr*0.80)));
        /* I SREDNJE-DUGO TRCANJE se skracuje. Bez ovoga je taper nedelja imala
           dugo trcanje od 14.3 km i srednje-dugo od 11.2 — dakle 25 km dugog
           trcanja u nedelji koja treba da odmori. U taperu ono gubi svrhu
           (akumulirana izdrzljivost se vise ne gradi), pa pada na ~55% LR-a. */
        if(alloc.mlr>0) alloc.mlr = r1(Math.min(alloc.mlr, alloc.lr*0.55));
      }
      klampLR(alloc, Object.values(sessions).map(d=>d.km||0));
      let ei=0;
      for(let dow=1; dow<=7; dow++){
        const role=slots[dow];
        if(role==='rest'){
          if(dow===strengthDow) days.push(D(dow,'snaga',null,`Mobilnost + snaga po sopstvenom programu — opciono (bez trčanja)`));
          else days.push(REST(dow));
          continue;
        }
        if(role==='lr'){
          const rwL = runWalkZaNedelju(w<=rwWeeks ? w : 0);
          if(rwL){
            /* Dugo trcanje MORA ostati run/walk dok je covek na lestvici —
               inace bi posle 3 km trcanje/hod dobio 7.7 km neprekidno. */
            const dL = D(dow,'rw',alloc.lr,`${alloc.lr} km — ${runWalkText(rwL)}, najduže trčanje te nedelje`);
            dL.runWalk = { runSec:rwL.runSec, walkSec:rwL.walkSec, label:rwL.label };
            days.push(dL);
          } else {
            /* Dodatak na dugo trcanje je odluka DISTANCE (`prof.lrDodatak`):
               polumaraton u specificnoj fazi trazi brz zavrsetak na tempu trke,
               5K i 10K ne. Bez profila se opis ne menja. */
            const dodatakLR = (!isTaper1 && !isDeload && prof.lrDodatak)
              ? prof.lrDodatak(prof.faza(Math.max(w-baseWeeks,1), weeks-baseWeeks), Math.max(w-baseWeeks,1),
                               alloc.lr, racePace, prof.ritamStrat ? prof.ritamStrat(racePace) : null,
                               prof.lrCiklus ? prof.lrCiklus(w, {weeks, baseWeeks, taperW, isDeload}) : null)
              : '';
            days.push(D(dow,'lr',alloc.lr,`${alloc.lr} km LR (Z2) @ ~${fmtP(pLR)}/km — najduže trčanje te nedelje${gorivoTekst(alloc.lr,pLR,prof.gorivoOdMin,prof.gorivoJakoOdMin)}${dodatakLR}`));
          }
          continue;
        }
        /* SREDNJE-DUGO TRCANJE — drugo duze trcanje sredinom nedelje.
           Nije kvalitet: ide na laganom (Z2) tempu, bez radnog dela. Smisao je
           akumulirana izdrzljivost — 60-90 min na nogama koje jos nisu odmorne
           od dugog trcanja. Ako raspodela nije uspela da mu odvoji deo
           (alloc.mlr===0, nema odakle), dan se ponasa kao obican lagan. */
        if(role==='mlr' && alloc.mlr>0){
          const dM=D(dow,'lr',alloc.mlr,`${alloc.mlr} km srednje-dugo (Z2) @ ~${fmtP(pLR)}/km — drugo duže trčanje u nedelji, gradi izdržljivost bez umora dugog trčanja`);
          dM.mlr=true;
          days.push(dM);
          continue;
        }
        if(sessions[dow]){ days.push(sessions[dow]); pushPredQs(sessions[dow],w); continue; }
        let km=alloc.easies[ei]!=null?alloc.easies[ei]:4;
        /* MEĐU-NEDELJNO susedstvo (korisnikova slika: LR nedeljom, "lako" ODMAH
           ponedeljkom SLEDEĆE nedelje — 24h razmak). Deljenje na allocEasyLR po
           nedelji ovo ne vidi: nedelja W+1 ima SVOJ (možda veći) LR, pa capovanje
           unutar allocEasyLR poredi ponedeljak sa POGREŠNIM (svojim) LR-om, ne sa
           STVARNIM susedom iz nedelje W. Ovde imam oboje — pravi lrDow (izveden iz
           slots) i već izgrađenu prethodnu nedelju — pa capujem prema STVARNOM susedu. */
        if(dow===1 && slots[7]==='lr' && plan.weeks.length>0){
          const prevW=plan.weeks[plan.weeks.length-1];
          const prevLR=Math.max(...prevW.days.filter(d=>d.tag==='lr').map(d=>d.km||0),0);
          /* BUG (nadjen prijavom korisnika: 4 dana/2 kvaliteta ostavlja TACNO
             jedan lak dan, uvek u ponedeljak — ovaj cap ga je pogadjao SVAKE
             nedelje, ne kao redak bezbednosni izuzetak. Flat 50% prethodnog LR-a
             je grublji i STROZI od allocEasyLR-ovog sopstvenog easyCeil-a (koji
             vec dozvoljava do 70% OVONEDELJNOG LR-a do 12km) — ta dva pravila su
             se sudarala, i grublje je uvek pobedjivalo, gaseci allocEasyLR-ovu
             already-bezbednu procenu. Narocito posle deload nedelje (mali
             prevLR) ovo je gusilo sledeci ponedeljak bez ikakvog stvarnog rizika
             (deload LR je mali — nema "drugog LR-a" da se cuvamo). Ista tiered
             formula kao easyCeil, primenjena na prevLR — cuva izvornu nameru
             (spreci lak dan da bude skoro isti kao LR) bez nepotrebnog gusenja. */
          if(prevLR>0){
            const capKm=Math.min(14, Math.max(r1(prevLR*0.50), Math.min(12, r1(prevLR*0.70))));
            km=Math.min(km, capKm);
          }
        }
        /* Strides na prvom lakom danu SVAKE kval. nedelje (Daniels: kroz sve faze,
           redovno — ne povremeno). Izostaju samo u taper1 (izbeći dodatni neuro-
           stres neposredno pred trku). Deload: kraći set. */
        const rwQ = runWalkZaNedelju(w<=rwWeeks ? w : 0);
        if(rwQ){
          /* Pocetnik i u kvalitetnoj fazi: LAGANI dani ostaju run/walk dok
             lestvica ne dodje do neprekidnog. Kvalitetni dani (int/tempo) NISU
             run/walk — oni imaju sopstvenu strukturu sa pauzama. */
          const ddQ = D(dow,'rw',km,`${km} km — ${runWalkText(rwQ)}`);
          ddQ.runWalk = { runSec:rwQ.runSec, walkSec:rwQ.walkSec, label:rwQ.label };
          days.push(ddQ);
        } else {
          const strides = isTaper1 ? ''
            : (ei===0 ? (isDeload ? ' + 4×15 s ubrzanja (lagani ubrzani koraci)' : ' + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)') : '');
          days.push(D(dow,'lako',km,`${km} km lako (Z2) @ ~${fmtP(pE)}/km${strides}`));
        }
        ei++;
      }
    }
    /* IZRAVNAVANJE RASTA (nadjeno auditom).
       Ciljni niz obima uredno postuje +8% (10% maraton), ali STVARNI zbir
       dana odstupa jer su kvalitetne sesije diskretne (ne mogu 3.7 intervala).
       Izmereno pre popravke: medijana 6.4% ali 35% nedelja preko 8%, najgore
       18.6%. Ovde se visak SECE, i to iskljucivo sa LAGANIH dana — kvalitet i
       dugo trcanje se ne diraju (imaju svoju strukturu i namenu), a pod od
       3 km po danu se postuje. Taper i trka se preskacu.

       DELOAD IMA SVOJU PUTANJU (nadjeno testom: polumaraton, 3 dana, pocetnik
       — N8 nosi oznaku DELOAD a isporucuje 30.1 km naspram 28.6 km u N7,
       dakle deload je bio VECI od nedelje pre sebe).
       Uzrok: CILJNI niz obima (vols) uredno primenjuje deloadF — N7 cilj 41,
       N8 cilj 31.2 — ali ISPORUKA ne prati cilj kad je cilj iznad onoga sto
       izabrani broj dana moze da ponese (cesto na 2-3 dana): radne nedelje
       ovaj limiter POTKRESUJE, a deload nedelje su iz njega bile izuzete, pa
       prodju nepotkresane i zavrse iznad potkresane prethodne nedelje.
       Zato se deload meri prema STVARNO ISPORUCENOJ prethodnoj nedelji.

       ZASTO PROPORCIONALNO, A NE ISTO SECENJE KAO NA RADNOJ NEDELJI: pohlepno
       secenje odozgo je invarijantu vratilo, ali je davalo nakaradnu nedelju —
       jedan lagan dan smrskan na pod od 3 km pored netaknutog dugog trcanja od
       13.3 km. To je tacno silueta na koju upozorava komentar ispod. Deload je
       SMANJENA KOPIJA nedelje, ne nedelja kojoj je jedan dan pojeden: svi dani
       trcanja se skaliraju istim faktorom, pa odnos lakih dana i dugog trcanja
       ostaje isti. */
    if(!isTaper1 && !isTaper2 && !isRace && plan.weeks.length){
      /* BUG koji sam sam napravio: posle DELOAD nedelje obim NAMERNO skace
         nazad — to je smisao deloada. Poredjenje sa deload nedeljom je videlo
         +41% i seklo lagane dane do poda od 3 km (izmereno: 3 km lako pored
         17 km dugog trcanja). Isti obrazac koji vols[] vec koristi: kad je
         prethodna nedelja bila deload, poredi se sa nedeljom PRE nje. */
      const prevW = plan.weeks[plan.weeks.length-1];
      const baseW = (prevW.deload && plan.weeks.length>=2) ? plan.weeks[plan.weeks.length-2] : prevW;
      const prevVol = baseW.days.reduce((s,d)=>s+(d.km||0),0);
      const sada = days.reduce((s,d)=>s+(d.km||0),0);
      const POD = podPoDanu(vol, runDays);
      const preimenuj = d => { d.desc=(d.desc||'').replace(/^[\d.,]+ km/, d.km+' km'); };

      if(prevVol > 0 && isDeload){
        /* DELOAD: proporcionalno skaliranje svih dana trcanja na deloadF
           prethodne ISPORUCENE nedelje. Kvaliteta na deload nedelji nema
           (sessions petlja ga preskace), pa se skalira ono sto postoji. */
        const limit = prevVol * (prof.deloadF || DELOAD_F);
        if(sada > limit){
          const f = limit / sada;
          days.forEach(d=>{
            if(d.rest || d.km==null) return;
            d.km = Math.max(POD, r1(d.km * f));
            preimenuj(d);
          });
        }
      } else if(prevVol > 0){
        /* Granica isporucenog rasta prati isti apsolutni korak (uz margin za
           diskretnost sesija) — multiplikativnih +8% je na 10 km/ned bilo 0.8 km
           i seklo je i sasvim normalan napredak. */
        const limit = prevVol + prof.korakRasta(prevVol, inp.intensity)*1.6;
        if(sada > limit){
          /* I SREDNJE-DUGO TRCANJE ucestvuje. Ono je Z2 dan bez radnog dela —
             allocEasyLR ga i opisuje kao „lagan dan koji je porastao" — i hrani
             se iz istog ostatka kao lagani dani. Dok je bilo izuzeto, limiter je
             na 5 dana sa 2 kvaliteta imao SAMO JEDAN lagan dan kao polugu, pa
             granicu rasta prosto nije mogao da dostigne: mereno na
             polumaratonu (12 ned, 5 dana, pocetnik) N3 41 km -> N5 55 km, dakle
             +34% uz dozvoljenih +11%, i ACWR 1.57. Redosled je po duzini
             opadajuce, pa srednje-dugo (koje je duze) daje prvo — a plafon od
             30% sopstvene vrednosti i dalje vazi za svaki dan, ukljucujuci i
             njega. Dugo trcanje se i dalje NE dira: ono nosi specificnost. */
          const laki = days.filter(d=>(d.tag==='lako'||d.tag==='rw'||d.mlr) && d.km > POD);
          let visak = sada - limit;
          /* skracuje od NAJDUZEG laganog dana nanize — ravnomernije nego redom */
          laki.sort((a,b)=>b.km-a.km);
          for(const d of laki){
            if(visak <= 0.05) break;
            /* Plafon od 30% SOPSTVENE vrednosti dana (nadjeno prijavom korisnika:
               jedini lak dan u nedelji — 4 dana/2 kvaliteta — gubio je i do 70%
               sopstvene vrednosti u jednom prolazu, npr. 11.9km -> 3.6km, kad bi
               kvalitet ili LR te nedelje bili malo veci od proseka. Sa samo jednim
               lakim danom NEMA drugog dana da podeli teret, pa ceo visak
               (koji ionako postoji SAMO zbog diskretnosti kvalitetnih sesija i
               normalnog rasta LR-a, ne zbog greske) pada na njega. Ostatak viska
               iznad 30% se NE dira — nedelja ostane malo iznad ciljanog rasta,
               sto je bezbednije od unistenog dana za oporavak. */
            const moze = Math.min(d.km - POD, d.km * 0.30);
            const skini = Math.min(moze, visak);
            if(skini > 0){
              /* Pod od 3 km: r1() moze da spusti ispod. Napomena: allocEasyLR
                 na VRLO niskom obimu svesno dozvoljava 2.5 km po laganom danu
                 (linija sa rem-2.5*easyCount) — to je njegova odluka i ne dira
                 se ovde; ovo samo sprecava da IZRAVNAVANJE dodatno spusti. */
              const novi = Math.max(POD, r1(d.km - skini));
              visak -= (d.km - novi);
              d.km = novi;
              preimenuj(d);
            }
          }
        }
      }
    }
    /* TAPER SE MERI PREMA STVARNO ISPORUCENOM VRHUNCU, ne prema ciljnom.
       Isti razlog kao kod deloada iznad: ciljni niz obima (`vols`) uredno
       primenjuje taperF, ali RADNE nedelje potkresuje izravnavanje rasta, dok
       su taper nedelje iz njega izuzete — pa taper prodje nepotkresan i ispadne
       plici nego sto je projektovan. Mereno na maratonu: prva taper nedelja
       83-92% isporucenog vrhunca umesto projektovanih 80%, druga 66-75% umesto
       65%, najgore na 4 dana trcanja (88%/71%). Bosquet (meta-analiza, 27
       studija) nalazi optimum na 41-60% smanjenja obima — 25-34% je ispod toga.
       Klamp SAMO SECE, nikad ne dodaje: 5K/10K/HM vec isporucuju 57-68%
       vrhunca, dakle ispod svojih faktora, i ostaju netaknuti. */
    if((isTaper1||isTaper2) && plan.weeks.length){
      const pik = Math.max(...plan.weeks.map(pw=>pw.days.reduce((s,d)=>s+(d.km||0),0)), 0);
      const limit = pik * (isTaper1 ? prof.taperF : (prof.taperF2||0.82));
      const sada = days.reduce((s,d)=>s+(d.km||0),0);
      if(pik>0 && sada>limit){
        /* Skida se SAMO sa dana bez kvalitetne sesije (lagano, dugo,
           srednje-dugo). Kvalitetne sesije u taperu su vec namerno male i nose
           ostrinu koja mora da ostane — taper skida kolicinu, ne intenzitet.
           Uz to im se `km` ne sme menjati mimo `session` objekta, jer bi se
           opis i kilometraza razisli. */
        const POD = podPoDanu(vol, runDays);
        const maxQ = Math.max(...days.filter(d=>d.session).map(d=>d.km||0), 0);
        /* Dugo trcanje ima VISI pod — invarijanta „LR je najduze trcanje
           nedelje" ne sme da padne zato sto je taper secen. */
        const lrDan = days.filter(d=>d.tag==='lr'||d.tag==='rw')
                          .sort((a,b)=>(b.km||0)-(a.km||0))[0];
        const podZa = d => d===lrDan ? Math.max(POD, r1(maxQ*1.05)) : POD;
        const meki = days.filter(d=>!d.rest && !d.session && d.km>0);
        const slobodno = meki.reduce((s,d)=>s+Math.max(0, d.km-podZa(d)), 0);
        const treba = Math.min(sada-limit, slobodno);
        if(slobodno>0 && treba>0.05){
          const f = treba/slobodno;
          /* Srazmerno IZNAD sopstvenog poda — monotono po km, pa se redosled
             dana (a s njim i invarijanta dugog trcanja) cuva po konstrukciji. */
          meki.forEach(d=>{
            const pd=podZa(d);
            d.km = r1(Math.max(pd, d.km - Math.max(0, d.km-pd)*f));
            d.desc = (d.desc||'').replace(/^[\d.,]+ km/, d.km+' km');
          });
        }
      }
    }
    plan.weeks.push({ w, vol: r1(days.reduce((s,d)=>s+(d.km||0),0)), days, deload:isDeload });
  }
  /* PROVERA STVARNO ISPORUCENOG OBIMA (nadjeno prijavom korisnika:
     "izaberem 45 km, prva nedelja ide na 37 km, a ja vec trcim 45").
     Ranije upozorenje je gadjalo VRHUNAC plana, sto je pogresna stvar —
     korisnika zanima da li PRVA nedelja odgovara onome sto vec trci.
     Ovo se racuna posle sklapanja, iz stvarnih dana, ne iz procene. */
  (function(){
    /* Gleda PRVU punu nedelju — to je ono sto korisnik prvo vidi i sto mora
       da odgovara njegovom trenutnom obimu. Ranije je gledalo maksimum prve
       tri, sto je maskiralo bas onu nedelju na koju se korisnik zali. */
    const prve = plan.weeks.filter(w => !w.deload && w.w <= 3);
    if(!prve.length || !inp.weeklyKm) return;
    const stvarno = prve[0].days.reduce((s,d)=>s+(d.km||0),0);
    const manjak = 1 - stvarno/inp.weeklyKm;
    /* Prag 15%: manje od toga je normalno postepeno uvodjenje u plan
       (prva nedelja obicno ima jedan kvalitetni trening manje). Preko toga
       je strukturna nemogucnost — obim ne staje u izabrani broj dana. */
    if(manjak > 0.15){
      const easyCount = Math.max(runDays - 1 - effQ, 0);
      const predlog = easyCount <= 1
        ? ' Na ' + runDays + ' dana sa ' + effQ + ' kvalitetna treninga ostaje samo ' +
          (easyCount===1?'jedan lagan dan':'nijedan lagan dan') +
          ', pa se toliki obim ne može bezbedno rasporediti — lagan dan bi morao da bude dug koliko i dugo trčanje. Dodaj jedan dan trčanja.'
        : ' Dodaj jedan dan trčanja ili smanji broj kvalitetnih treninga.';
      dayWarnings.push('Tražio si ' + inp.weeklyKm + ' km/ned, a plan prve nedelje daje oko ' +
        stvarno.toFixed(0) + ' km.' + predlog);
    }
  })();

  /* STRUKTURNI PLAFON — mereno iz sastavljenog plana (v. komentar gore, gde je
     nekada stajala rucna tabela). Pik radnih nedelja je ono sto plan STVARNO
     moze da isporuci na izabranom broju dana. Ako ni on ne stize do trazenog
     obima, korisnik to mora da cuje — i da dobije TACAN broj dana koji bi mu
     trebao, izracunat ponovnim generisanjem (ne pogodjen iz tabele).
     inp._noSuggest sprecava rekurziju: probni pozivi ga nose. */
  if(!inp._noSuggest && inp.weeklyKm > 0){
    const radne = plan.weeks.filter((w,i) => !w.deload && i < plan.weeks.length-2);
    const pik = radne.length ? Math.max(...radne.map(w => w.days.reduce((s,d)=>s+(d.km||0),0))) : 0;
    if(pik > 0 && pik < inp.weeklyKm*0.93){
      let trebaDana = null;
      for(let d = runDays+1; d <= 7; d++){
        const probni = generatePlan({ ...inp, runDays:d, _noSuggest:true });
        if(probni.error || !probni.weeks) continue;
        const r2 = probni.weeks.filter((w,i) => !w.deload && i < probni.weeks.length-2);
        const p2 = r2.length ? Math.max(...r2.map(w => w.days.reduce((s,x)=>s+(x.km||0),0))) : 0;
        if(p2 >= inp.weeklyKm*0.93){ trebaDana = d; break; }
      }
      dayWarnings.push('Na ' + runDays + ' dana trčanja plan realno dostiže oko ' + pik.toFixed(0) +
        ' km/ned — manje od traženih ' + inp.weeklyKm + ' km. Razlog: dugo trčanje i lagani dani imaju ' +
        'bezbednosne granice, pa se veći obim ne može rasporediti na tako malo dana.' +
        (trebaDana ? ' Za ' + inp.weeklyKm + ' km trebalo bi ti ' + trebaDana + ' dana trčanja.'
                   : ' Ni na 7 dana ne staje — za toliki obim verovatno trebaju dupli treninzi.'));
    }

    /* BAZA ZA CILJNU DISTANCU. Rast obima je sada proporcionalan (v. peakTarget),
       sto je bezbedno — ali znaci i da ko krene sa vrlo niskom bazom nece stici
       do obima koji ta distanca stvarno trazi. To NE blokiramo (vlasnikova
       filozofija: sve je izmenjivo, plan kaze istinu i pusta coveka da odluci),
       ali se mora reci naglas — inace covek vidi uredan maratonski plan koji
       vrhunac ima na 38 km/ned i misli da je spreman.
       Brojevi su donja granica zdravog razuma za pripremu te distance, ne
       Danielsove konstante — zato "orijentaciono". */
    const BAZA_MIN = prof.bazaMin;   /* odluka po distanci — v. DIST_PROFILES */
    if(BAZA_MIN && pik > 0 && pik < BAZA_MIN*0.85){
      dayWarnings.push('Plan vrhunac ima na oko ' + pik.toFixed(0) + ' km/ned, a za ' + prof.name +
        ' se orijentaciono računa sa ~' + BAZA_MIN + ' km/ned. Rast je namerno postupan (od tvojih ' +
        inp.weeklyKm + ' km/ned) jer je nagli skok obima najčešći uzrok povrede — ' +
        'ali to znači da je ovo plan da distancu ISTRČIŠ, ne da je trčiš na vreme. ' +
        'Za pun pristup trebalo bi ti više nedelja ili viša polazna baza.');
    }
  }

  /* Filtriraj dane PRE datuma generisanja iz nedelje 1 (v. komentar kod
     `start` gore) — samo nedelja 1 može imati dane pre inp.startDate, jer je
     start=mondayOfWeek (može biti u prošlosti), a sve ostale nedelje počinju
     tačno 7*n dana kasnije, uvek na ili posle inp.startDate. */
  if(plan.weeks.length){
    const w1=plan.weeks[0];
    const keep=d=>addD(start,d.dow-1)>=inp.startDate;
    const removed=w1.days.filter(d=>!keep(d));
    w1.days=w1.days.filter(keep);
    w1.vol=r1(w1.days.reduce((s,d)=>s+(d.km||0),0));
    /* Uklonjeni dani moraju povući i SVOJ PRED red i qs ključ — inače ostaje
       predikcijski red za trening koji više ne postoji (korisnik ga vidi u
       Predikciji, ali nijedan dan ga ne može popuniti) i mrtav qs ključ za
       Strava lap-detekciju. */
    removed.forEach(d=>{
      delete plan.qs['n'+w1.w+'d'+d.dow];
      if(!d.session) return;
      const i=plan.pred.findIndex(p=>p.w===w1.w && p.l==='N'+w1.w+' · '+d.session.kind);
      if(i>=0) plan.pred.splice(i,1);
    });
  }
  return plan;
}


/* ============================================================
   ADAPTIVNO REKALIBRISANJE — v3.2
   Koliko se veruje JEDNOM merenju. Inženjerski izbor (NE izmerena
   konstanta), ali redosled nije proizvoljan — prati koliko svaki
   oblik napora zaista govori o VO2max-u:

   test  0,60  Maksimalna trka na 3 km, ~11–13 min. Tačno u prozoru
               (10–30 min) u kom je Daniels–Gilbertova formula i
               izvedena i najtačnija. Najjači pojedinačan signal
               forme koji čovek može sam da napravi.
   tempo 0,28  Kontinuiran rad na pragu — bez pauza koje kvare
               prosek, ali submaksimalan, pa nosi pretpostavku o
               odnosu praga i VO2max-a.
   int   0,12  Blizu VO2max-a, ali prepoznavanje radnih deonica ume
               da uvuče i kaskanje između ponavljanja.
   rep   0,04  200–400 m sa punim odmorom. Jeste kvalitetna sesija i
               tako se i vodi, ali energetski je pretežno anaerobna,
               a ekstrapolacija ide preko 12–25× duže distance —
               precizna predikcija se iz nje ne može izvesti. Zato
               formu pomera jedva primetno, umesto nikako.
   ============================================================ */
const ALPHA = { test: 0.6, tempo: 0.28, int: 0.12, rep: 0.04, rain_default: 0.15 };

/* Prigušenje: koliko se veruje JEDNOM merenju. Do sada je ceo lanac VDOT-a
   koristio ravnih 0.4 za sve sesije, iako je ovaj model — sa različitom težinom
   po tipu — bio napisan i stajao neupotrebljen. Sada ga koristi `preracunajVdotLog`,
   dakle stvarna forma koju vidiš. */
function prigusiVdot(prev, izmereno, tipSesije){
  const a = ALPHA[tipSesije] || ALPHA.rain_default;
  return { vdot: r1(prev + a*(izmereno - prev)), alpha:a };
}
/* Tip sesije za prigušenje. Test na 3 km se prepoznaje po ID-ju (nema PRED red
   u planu), sve ostalo po zoni PRED reda. Repeticije su ODVOJENE od intervala:
   dele istu zonsku porodicu, ali 200 m sa punim odmorom i 1000 m sa 90 s
   kaskanja nisu ni izbliza jednako pouzdan pokazatelj forme. */
function tipSesijeZaVdot(predId){
  if(jeT3k(predId)) return 'test';
  const r = CUR_PRED.find(x=>x.id===predId);
  const z = r ? zoneForPredRow(r) : null;
  if(z==='R') return 'rep';
  if(z==='I') return 'int';
  if(z==='T'||z==='M') return 'tempo';
  return 'rain_default';
}

/* Ponovo generiše SAMO preostale nedelje (>=currentWeekIdx) sa ispravljenom
   putanjom, tako što izračuna "virtuelni PB" koji bi originalnom formulom,
   primenjenom od nedelje 1, dao tačno vdotNowSmoothed na trenutnoj nedelji.
   Odrađene nedelje (< currentWeekIdx) se ne diraju — istorija je nepromenljiva.
   oldWeeksForMerge (opciono): ako je prosleđeno, ručno zaključana polja
   (session.overrides) iz njih se prenose na sveže regenerisane nedelje —
   rekalibracija ne sme da pregazi korisnikovu ručnu izmenu tempa/dužine/
   pauze/broja ponavljanja. Bez ovog parametra, ponašanje je IDENTIČNO
   ranijoj verziji (ništa se ne menja za postojeće pozive/testove). */
function recalibratedPlan(originalInput, currentWeekIdx, vdotNowSmoothed, oldWeeksForMerge){
  const weeksTotal = Math.round((new Date(originalInput.raceDate) - new Date(nextMonday(originalInput.startDate))) / 604800000) + 1;
  const rampWeeks = Math.min(weeksTotal - 2, RAMP_CAP_WEEKS);
  const backdated = vdotNowSmoothed - RAMP[originalInput.intensity] * Math.min(currentWeekIdx-1, rampWeeks);
  const virtualPbSec = raceTimeForVdot(Math.max(backdated, 20), 5000);
  /* KRITIČNO: racePace mora ostati stabilan. Ako korisnik NIJE zadao goalSec,
     bez ove linije bi generatePlan iznutra računao FRESH predictedSec iz
     VEŠTAČKE (backdated) putanje — koja može ispasti sporija od stvarne
     trenutne forme (vdotNowSmoothed), jer predstavlja projekciju do KRAJA
     plana, ne trenutno stanje. Taj (pogrešno spor) racePace onda kroz
     Math.max(paceForZone(vdotW,'I'), racePace) veštački uspori intervale —
     korisnik uneseta TAČNO taj (već usporen) tempo i VDOT mu ispravno
     "opadne" na taj usporen broj, iako je trening odradio bez odstupanja.
     Rešenje: ako nema eksplicitnog cilja, koristi predikciju iz STVARNE
     trenutne forme kao stabilan oslonac, ne iz veštačke putanje. */
  const raceDistM = originalInput.raceDistM||5000;
  const stableGoalSec = originalInput.goalSec || raceTimeForVdot(vdotNowSmoothed, raceDistM);
  const replanned = generatePlan({ ...originalInput, pb:{ distM:5000, sec:virtualPbSec }, goalSec: stableGoalSec });
  if(replanned.error) return replanned;
  const weeksSlice = replanned.weeks.slice(currentWeekIdx-1);
  if(oldWeeksForMerge){
    mergeOverrides(weeksSlice, oldWeeksForMerge);
    return {
      weeks: weeksSlice,
      /* raceDistM je ranije izostajao — derivePred bi pao na podrazumevanih
         5000 m i za maratonski/HM plan računao predikcije na pogrešnoj
         distanci. Funkcija se (još) ne poziva iz UI-ja, ali greška ne sme
         da čeka trenutak kad se poveže. */
      pred: derivePred(weeksSlice, replanned.meta&&replanned.meta.raceDistM, replanned.meta),
      qs: deriveQS(weeksSlice),
      meta: { ...replanned.meta, vdotAtRecal: r1(vdotNowSmoothed), recalWeek: currentWeekIdx }
    };
  }
  return {
    weeks: weeksSlice,
    pred: replanned.pred.filter(p=>p.w>=currentWeekIdx),
    qs: Object.fromEntries(Object.entries(replanned.qs).filter(([k])=>+k.match(/\d+/)[0] >= currentWeekIdx)),
    meta: { ...replanned.meta, vdotAtRecal: r1(vdotNowSmoothed), recalWeek: currentWeekIdx }
  };
}

/* ============================================================
   POVREDA-SVESTAN RE-ENTRY — v3.1
   Bez izmišljene "X dana pauze = Y dana rampe" formule. Umesto toga:
   plan po povratku kreće od STVARNO poslednje ostvarene nedeljne
   zapremine (ne od originalno planirane za tu nedelju), a već
   testiran GROW_MAX (+8%/ned.) iz generatora vraća volumen na krivu.
   Tempo/VDOT se NE pogađa unapred — koriguje ga recalibrate() na
   osnovu prve stvarne sesije posle povratka.
   ============================================================ */
function reentryPlan(originalInput, resumeWeekIdx, lastRealizedVolKm, vdotAtPause){
  const weeksTotal = Math.round((new Date(originalInput.raceDate) - new Date(nextMonday(originalInput.startDate))) / 604800000) + 1;
  const weeksLeft = weeksTotal - resumeWeekIdx + 1;
  if(weeksLeft < 4) return { error:'Manje od 4 nedelje do trke posle pauze — pun re-entry nije moguć. Cilj treba ručno preispitati.' };
  const backdated = vdotAtPause - RAMP[originalInput.intensity] * Math.min(resumeWeekIdx-1, Math.min(weeksTotal-2, RAMP_CAP_WEEKS));
  const virtualPbSec = raceTimeForVdot(Math.max(backdated,20), 5000);
  const raceDistM = originalInput.raceDistM||5000; /* ista ispravka kao recalibratedPlan — stabilan racePace, ne iz veštačke putanje */
  const stableGoalSec = originalInput.goalSec || raceTimeForVdot(vdotAtPause, raceDistM);
  const replanned = generatePlan({ ...originalInput, pb:{ distM:5000, sec:virtualPbSec }, goalSec: stableGoalSec });
  if(replanned.error) return replanned;
  /* prva nedelja po povratku: cap na lastRealizedVolKm umesto plana; GROW_MAX dalje sam vraća krivu */
  const w0 = replanned.weeks[resumeWeekIdx-1];
  const scale = w0.vol>0 ? Math.min(lastRealizedVolKm*GROW_MAX, w0.vol)/w0.vol : 1;
  const first = { ...w0, vol:r1(w0.vol*scale), days:w0.days.map(d=>d.km!=null?{...d,km:r1(d.km*scale)}:d), reentry:true };
  return { weeks:[first, ...replanned.weeks.slice(resumeWeekIdx)], pred:replanned.pred.filter(p=>p.w>=resumeWeekIdx), meta:replanned.meta };
}


/* ============================================================
   RACE PREDICTOR — OPSEG (nadogradnja POSTOJEĆEG Riegel mehanizma
   u v2 aplikaciji, riegel(tempoSec,q) — NE deo VDOT generatora.
   workLapsTempo ovde je VERNA KOPIJA funkcije već aktivne u v2
   index.html (Strava sync) — duplirana radi samostalne testabilnosti
   pre porta; logika mora ostati identična na oba mesta.
   ============================================================ */
function genWorkLapsTempo(laps, specs, tol=0.12){ /* PREIMENOVANO iz workLapsTempo() — V2 već ima svoju, pažljivo doteranu verziju (workLapsSelect-baziranu, iz Strava lap-reading debugginga); bez preimenovanja bi ova prostija verzija tiho pregazila V2-ovu i DEGRADIRALA sync tačnost bez ijedne greške koja bi to signalizirala */
  const work=laps.filter(L=>specs.some(m=>Math.abs(L.distance-m)/m<=tol));
  if(!work.length)return null;
  const dist=work.reduce((s,L)=>s+L.distance,0), t=work.reduce((s,L)=>s+(L.moving_time||L.elapsed_time||0),0);
  if(!dist||!t)return null;
  return Math.round(t/(dist/1000));
}
/* Donja granica: prvi radni lap -> poslednji radni lap, UKLJUČUJUĆI sve između (oporavke).
   WU pre prvog i CD posle poslednjeg ostaju isključeni — isto ograničenje kao gornja granica. */
function blockTempo(laps, specs, tol=0.12){
  const idx = laps.map((L,i)=>({i,hit:specs.some(m=>Math.abs(L.distance-m)/m<=tol)})).filter(x=>x.hit).map(x=>x.i);
  if(!idx.length) return null;
  const block = laps.slice(idx[0], idx[idx.length-1]+1);
  const dist=block.reduce((s,L)=>s+L.distance,0), t=block.reduce((s,L)=>s+(L.moving_time||L.elapsed_time||0),0);
  if(!dist||!t) return null;
  return Math.round(t/(dist/1000));
}
const riegelV2 = (tempoSecPerKm,qKm) => tempoSecPerKm*qKm*Math.pow(5/qKm,1.06);
/* Vraća {hi,lo,hiPace,loPace} za intervalne sesije sa lap podacima, ili null
   (pozivalac tada koristi postojeći jedan-broj tok — kontinuirane sesije / ručni unos). */
function predictRange(laps, specs, qKm){
  if(!laps || !laps.length) return null;
  const hiPace=genWorkLapsTempo(laps,specs), loPace=blockTempo(laps,specs);
  if(hiPace==null||loPace==null) return null;
  return { hi:Math.round(riegelV2(hiPace,qKm)), lo:Math.round(riegelV2(loPace,qKm)), hiPace, loPace };
}


/* ---------- GENERATOR PLANA (wizard, portovano iz V3 sub19-gen) ----------
   UI/validacija prenete skoro doslovno iz V3. finishOnboarding je PREPISAN
   za V2: umesto V3-ovog S.meta/S.plan, ide kroz adaptGeneratedPlan() → 
   S.genPlan → setActivePlan()/rebuildDateIndex() — isti V2-domaći mehanizam
   koji već koristi tvoj hardkodovan plan. */
const $$=s=>Array.from(document.querySelectorAll(s));
function clampDigits(v,n){ v=String(v).replace(/\D/g,''); return v.slice(0,n); }
const PB_SANITY={ 5000:[720,5999], 10000:[1500,5999], 21097.5:[3300,14400], 42195:[6900,25200] };
const HOURS_FROM=21097;
const VDOT_CIRC=169.6;
const TOTAL_STEPS=4;
let obStep=1;
let wiz={ raceDist:5000, raceDate:'', pbDist:5000, pbH:'', pbMin:'', pbSec:'', weeklyKm:'', trainedRecently:true, runDays:4, quality:2, runDows:[], lrDow:7, lrDowManual:false, qDays:[], intensity:'std', goalH:'', goalMin:'', goalSec:'' };
function pbUsesHours(){ return wiz.pbDist>=HOURS_FROM; }
/* Ciljno vreme: HM i maraton se mere u SATIMA, pa polje dobija i h. Isti prag
   (HOURS_FROM) kao za skorasnji rezultat, ali gleda CILJNU distancu. */
function goalUsesHours(){ return wiz.raceDist>=HOURS_FROM; }
function goalTotalSec(){
  const h=goalUsesHours()?(+wiz.goalH||0):0, m=+wiz.goalMin, s=+wiz.goalSec;
  if(wiz.goalMin===''||wiz.goalSec===''||isNaN(m)||isNaN(s)||s>59) return null;
  if(goalUsesHours()&&m>59) return null;
  const t=h*3600+m*60+s;
  return t>0?t:null;
}
/* Broj nedelja — ISTA formula kao u generatePlan, da predvidjanje odgovara planu
   koji ce se stvarno napraviti, a ne priblizno. */
function wizWeeks(){
  if(!wiz.raceDate) return null;
  const start=mondayOfWeek(todayStr());
  const daysN=Math.round((new Date(wiz.raceDate)-new Date(start))/86400000);
  const w=Math.floor(daysN/7)+1;
  return w>0?w:null;
}
function pbTotalSec(){
  const h=pbUsesHours()?(+wiz.pbH||0):0, m=+wiz.pbMin, s=+wiz.pbSec;
  if(wiz.pbMin===''||wiz.pbSec===''||isNaN(m)||isNaN(s)||s>59) return null;
  if(pbUsesHours()&&m>59) return null;
  const t=h*3600+m*60+s;
  return t>0?t:null;
}
function pbSanityOk(){
  const t=pbTotalSec(); if(t==null) return false;
  const [lo,hi]=PB_SANITY[wiz.pbDist]||[60,99999];
  return t>=lo&&t<=hi;
}
function pbSanityMsg(){
  const t=pbTotalSec();
  if(t==null) return '';
  const [lo,hi]=PB_SANITY[wiz.pbDist]||[0,0];
  if(t<lo) return 'Vreme je brže od realnog opsega za izabranu distancu — proveri unos.';
  if(t>hi) return 'Vreme je sporije od opsega koji plan podržava za tu distancu — proveri unos.';
  return '';
}
function openWizard(){
  wiz={ raceDist:5000, raceDate:'', pbDist:5000, pbH:'', pbMin:'', pbSec:'', weeklyKm:'', trainedRecently:true, runDays:4, quality:2, runDows:[], lrDow:7, lrDowManual:false, qDays:[], intensity:'std', goalH:'', goalMin:'', goalSec:'' };
  obStep=1;
  closeSheet();
  document.querySelector('header').style.display='none';
  document.querySelector('main').style.display='none';
  $('#tabbar').style.display='none';
  $('#wizard').style.display='';
  renderOnboard();
}
function closeWizard(){
  /* Poslednja brana: bez sopstvenog plana zatvaranje bi otkrilo vlasnikov. */
  if(moraSvojPlan()) return;
  $('#wizard').style.display='none';
  document.querySelector('header').style.display='';
  document.querySelector('main').style.display='';
  $('#tabbar').style.display='';
  renderHeader();
  PAGES[ACTIVE]();
}
function renderOnboard(){
  const el=$('#wizard');
  el.innerHTML=`<div class="ob-wrap">
    <div class="ob-top">
      <div class="ob-toprow">
        <div class="ob-brand">SUB<span>-20</span></div>
        ${moraSvojPlan()?'':'<button type="button" class="ob-x" id="obCancel">✕</button>'}
      </div>
      <div class="ob-progress" id="ob-progress"></div>
    </div>
    <div class="ob-body">
    <div class="ob-step active" data-step="1">
      <div class="ob-eyebrow">Korak 1 od 4</div>
      <div class="ob-h1">Za koju trku se spremaš?</div>
      <div class="ob-sub">Distanca određuje strukturu plana — koliko raste dugo trčanje i koliko tempo rada ima u nedelji.</div>
      <div class="ob-card">
        <div class="ob-ct">Ciljna distanca</div>
        <div class="ob-chiprow" id="raceDistChips">
          <button type="button" class="ob-chip on" data-v="5000">5K</button>
          <button type="button" class="ob-chip" data-v="10000">10K</button>
          <button type="button" class="ob-chip" data-v="21097.5">Polumaraton</button>
          <button type="button" class="ob-chip" data-v="42195">Maraton</button>
        </div>
        <div class="ob-hint">Svaka distanca ima <b>svoju</b> logiku — 5K gradi VO2max i brzinu, 10K prag i specifičnu izdržljivost, polumaraton akumuliranu izdržljivost (dva duža trčanja nedeljno, taper od dve nedelje, uvežbavanje goriva). Ne prave se iz istog kalupa. Maraton ide još dalje: dugo trčanje mu je ograničeno <b>vremenom</b> (3 sata), ima sopstveni talas i uvežbavanje goriva. Minimum: <b>6 nedelja</b> za 5K, <b>8</b> za 10K, <b>10</b> za polumaraton, <b>12</b> za maraton.</div>
      </div>
      <div class="ob-card">
        <div class="ob-ct">Datum trke</div>
        <div class="ob-datewrap">
          <input type="date" id="in-raceDate" min="${todayStr()}">
          <span class="ob-cal"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5"/></svg></span>
        </div>
        <div class="ob-hint" id="ob-weeks-hint"></div>
        <div class="ob-err" id="ob-err-1"></div>
      </div>
    </div>
    <div class="ob-step" data-step="2">
      <div class="ob-eyebrow">Korak 2 od 4</div>
      <div class="ob-h1">Šta si poslednje istrčao?</div>
      <div class="ob-sub">Bilo koja skorija trka na poznatoj distanci. Iz ovog jednog rezultata računa se svaki ciljni tempo u planu.</div>
      <div class="ob-card">
        <div class="ob-ct">Distanca</div>
        <div class="ob-chiprow" id="pbDistChips">
          <button type="button" class="ob-chip on" data-v="5000">5 km</button>
          <button type="button" class="ob-chip" data-v="10000">10 km</button>
          <button type="button" class="ob-chip" data-v="21097.5">Polumaraton</button>
          <button type="button" class="ob-chip" data-v="42195">Maraton</button>
        </div>
      </div>
      <div class="ob-card">
        <div class="ob-ct">Vreme</div>
        <div class="ob-row3">
          <div id="pbHwrap" style="display:none"><span class="ob-unit">h</span><input type="number" id="in-pbH" placeholder="h" inputmode="numeric"></div>
          <div class="ob-colon" id="pbHcolon" style="display:none">:</div>
          <div><span class="ob-unit">min</span><input type="number" id="in-pbMin" placeholder="min" inputmode="numeric"></div>
          <div class="ob-colon">:</div>
          <div><span class="ob-unit">sek</span><input type="number" id="in-pbSec" placeholder="sek" inputmode="numeric"></div>
        </div>
        <div class="ob-err" id="ob-err-2"></div>
      </div>
      <div class="ob-card accent ob-vdot" id="vdotWrap">
        <div class="ob-ct">Tvoja forma</div>
        <div class="ob-vrow">
          <svg class="ob-vring" viewBox="0 0 64 64">
            <circle class="ob-vtrack" cx="32" cy="32" r="27"/>
            <circle class="ob-vval" id="vdotArc" cx="32" cy="32" r="27" stroke-dasharray="169.6" stroke-dashoffset="169.6"/>
          </svg>
          <div>
            <div class="ob-vnum" id="vdotNum">—</div>
            <div class="ob-vlbl">VDOT — jedan broj iz kog se računa <b>svaki</b> tempo u planu.</div>
          </div>
        </div>
        <div class="ob-vpaces" id="vdotPaces"></div>
      </div>
      <div class="kb warn" id="pbUpozorenje" style="display:none"><div><div>Proveri uneto vreme</div><small id="pbUpozorenjeTxt"></small></div></div>
    </div>
    <div class="ob-step" data-step="3">
      <div class="ob-eyebrow">Korak 3 od 4</div>
      <div class="ob-h1">Koliko trčiš nedeljno?</div>
      <div class="ob-sub">Prosek poslednjih 2–3 nedelje. Plan raste odavde — ne od nule i ne od željene kilometraže.</div>
      <div class="ob-card">
        <div class="ob-ct">Nedeljna kilometraža</div>
        <input type="number" id="in-weeklyKm" placeholder="npr. 22" min="5" max="120" inputmode="numeric">
        <div class="ob-err" id="ob-err-3"></div>
      </div>
      <div class="ob-card">
        <div class="ob-ct">Trčao redovno poslednjih mesec dana?</div>
        <div class="ob-chiprow" id="trainedChips">
          <button type="button" class="ob-chip on" data-v="yes">Da, redovno</button>
          <button type="button" class="ob-chip" data-v="no">Ne / tek počinjem</button>
        </div>
        <div class="ob-hint">Ako nisi trčao redovno i obim je nizak, plan počinje sa <b>4 nedelje bazne faze</b> — samo lagano trčanje, pa tek onda ubrzanja i intervali.</div>
      </div>
      <div class="ob-card">
        <div class="ob-ct">Koji dani ti odgovaraju za trčanje? <span class="ob-opt">— opciono</span></div>
        <div class="ob-chiprow week" id="runDowChips">
          <button type="button" class="ob-chip" data-v="1">Pon</button><button type="button" class="ob-chip" data-v="2">Uto</button>
          <button type="button" class="ob-chip" data-v="3">Sre</button><button type="button" class="ob-chip" data-v="4">Čet</button>
          <button type="button" class="ob-chip" data-v="5">Pet</button><button type="button" class="ob-chip" data-v="6">Sub</button>
          <button type="button" class="ob-chip" data-v="7">Ned</button>
        </div>
        <div class="ob-hint" id="runDowHint">Ostavi prazno pa plan sam raspoređuje dane. Izaberi konkretne ako imaš fiksne obaveze — tada se koriste <b>tačno ti dani</b>.</div>
      </div>
      <div class="ob-card" id="runDaysCard">
        <div class="ob-ct">Dana trčanja nedeljno</div>
        <div class="ob-chiprow d6" id="runDaysChips">
          <button type="button" class="ob-chip" data-v="2">2</button><button type="button" class="ob-chip" data-v="3">3</button>
          <button type="button" class="ob-chip on" data-v="4">4</button><button type="button" class="ob-chip" data-v="5">5</button>
          <button type="button" class="ob-chip" data-v="6">6</button><button type="button" class="ob-chip" data-v="7">7</button>
        </div>
      </div>
      <div class="ob-card">
        <div class="ob-ct">Dan za dugo trčanje</div>
        <div class="ob-chiprow week" id="lrDowChips">
          <button type="button" class="ob-chip" data-v="1">Pon</button><button type="button" class="ob-chip" data-v="2">Uto</button>
          <button type="button" class="ob-chip" data-v="3">Sre</button><button type="button" class="ob-chip" data-v="4">Čet</button>
          <button type="button" class="ob-chip" data-v="5">Pet</button><button type="button" class="ob-chip" data-v="6">Sub</button>
          <button type="button" class="ob-chip on" data-v="7">Ned</button>
        </div>
      </div>
    </div>
    <div class="ob-step" data-step="4">
      <div class="ob-eyebrow">Korak 4 od 4</div>
      <div class="ob-h1">Koliko brzo da raste forma?</div>
      <div class="ob-sub">Ovo određuje koliko se tempo pooštrava kroz nedelje — ne koliko ćeš trčati.</div>
      <div class="ob-card">
        <div class="ob-ct">Kvalitetnih treninga nedeljno</div>
        <div class="ob-chiprow" id="qualityChips">
          <button type="button" class="ob-chip" data-v="1">1</button>
          <button type="button" class="ob-chip on" data-v="2">2</button>
        </div>
        <div class="ob-hint">Na <b>3 dana trčanja ili manje</b> plan forsira 1 kvalitet — dva bi bila previše na tako mali obim.</div>
      </div>
      <div class="ob-card">
        <div class="ob-ct">Tempo napretka</div>
        <button type="button" class="ob-icard" data-v="kons">
          <div class="ob-ih"><b>Konzervativno</b><span class="ob-radio"></span></div>
          <p>Postepen, oprezan rast forme.</p><span class="ob-tag">Danielsova smernica</span>
        </button>
        <button type="button" class="ob-icard on" data-v="std">
          <div class="ob-ih"><b>Standardno</b><span class="ob-radio"></span></div>
          <p>Uobičajen tempo napretka za trenirane trkače.</p><span class="ob-tag">Danielsova smernica</span>
        </button>
        <button type="button" class="ob-icard" data-v="agr">
          <div class="ob-ih"><b>Agresivno</b><span class="ob-radio"></span></div>
          <p>Brz rast — realno uglavnom uz nizak trenažni staž ili paralelan gubitak telesne mase.</p><span class="ob-tag">Kalibrisano na jedan dokumentovan slučaj</span>
        </button>
      </div>
      <div class="ob-card">
        <div class="ob-ct">Dani za kvalitet <span class="ob-opt">— prazno = automatski</span></div>
        <div class="ob-chiprow week" id="qDayChips">
          <button type="button" class="ob-chip" data-v="1">Pon</button><button type="button" class="ob-chip" data-v="2">Uto</button>
          <button type="button" class="ob-chip" data-v="3">Sre</button><button type="button" class="ob-chip" data-v="4">Čet</button>
          <button type="button" class="ob-chip" data-v="5">Pet</button><button type="button" class="ob-chip" data-v="6">Sub</button>
          <button type="button" class="ob-chip" data-v="7">Ned</button>
        </div>
      </div>
      <div class="ob-card accent" id="ob-outlook"></div>
      <div class="ob-card" id="ob-warn"></div>
      <div class="ob-card">
        <div class="ob-ct">Ciljno vreme <span class="ob-opt">— opciono</span></div>
        <div class="ob-row3">
          <div id="goalHwrap" style="display:none"><span class="ob-unit">h</span><input type="number" id="in-goalH" placeholder="h" min="0" max="9" inputmode="numeric"></div>
          <div class="ob-colon" id="goalHcolon" style="display:none">:</div>
          <div><span class="ob-unit">min</span><input type="number" id="in-goalMin" placeholder="min" min="0" max="99" inputmode="numeric"></div>
          <div class="ob-colon">:</div>
          <div><span class="ob-unit">sek</span><input type="number" id="in-goalSec" placeholder="sek" min="0" max="59" inputmode="numeric"></div>
        </div>
        <div class="ob-hint">Ostavi prazno i plan koristi predviđanje iz tvoje forme. Upiši vreme ako imaš konkretan cilj — reći ću koliko je realan.</div>
      </div>
    </div>
    </div>
    <div class="ob-btnrow">
      <button type="button" class="btn ghost" id="obBack" style="display:none">Nazad</button>
      <button type="button" class="btn" id="obNext">Dalje</button>
    </div>
  </div>`;
  bindOnboardEvents();
  goObStep(1);
}
const OB_STEP_NAMES=['Trka','Rezultat','Obim','Intenzitet'];
function renderObProgress(){
  const el=$('#ob-progress'); el.innerHTML='';
  for(let i=1;i<=TOTAL_STEPS;i++){
    const d=document.createElement('div');
    d.className='ob-seg'+(i<obStep?' done':i===obStep?' on':'');
    d.innerHTML='<i></i><b>'+esc(OB_STEP_NAMES[i-1]||('Korak '+i))+'</b>';
    el.appendChild(d);
  }
}
function obStepValid(n){
  if(n===1) return !!wiz.raceDate;
  if(n===2) return pbSanityOk();
  if(n===3) return wiz.weeklyKm!==''&&+wiz.weeklyKm>0;
  return true;
}
function goObStep(n){
  obStep=n;
  $$('.ob-step').forEach(s=>s.classList.toggle('active', +s.dataset.step===n));
  $('#obBack').style.display=n>1?'':'none';
  $('#obNext').textContent=n===TOTAL_STEPS?'Napravi plan':'Dalje';
  updateWeeksHint();
  syncRunDowUI();
  syncGoalHoursUI();
  renderOutlook(); renderWizWarningsSoon();
  renderObProgress();
  $('#obNext').disabled=!obStepValid(n);
}
/* Prikaz/skrivanje h polja za CILJ + sklapanje vrednosti kad se distanca promeni
   sa duge na kratku (isti obrazac kao syncHoursUI za skorasnji rezultat). */
function syncGoalHoursUI(){
  const on=goalUsesHours();
  const w=$('#goalHwrap'), col=$('#goalHcolon');
  if(!w||!col) return;
  w.style.display=on?'':'none';
  col.style.display=on?'':'none';
  if(!on&&wiz.goalH!==''){
    const folded=(+wiz.goalH||0)*60+(+wiz.goalMin||0);
    wiz.goalH='';$('#in-goalH').value='';
    if(folded>0&&folded<=99){ wiz.goalMin=String(folded); $('#in-goalMin').value=wiz.goalMin; }
  }
}
function syncHoursUI(){
  const on=pbUsesHours();
  $('#pbHwrap').style.display=on?'':'none';
  $('#pbHcolon').style.display=on?'':'none';
  if(!on&&wiz.pbH!==''){
    const folded=(+wiz.pbH||0)*60+(+wiz.pbMin||0);
    wiz.pbH='';$('#in-pbH').value='';
    if(folded>0&&folded<=99){ wiz.pbMin=String(folded); $('#in-pbMin').value=wiz.pbMin; }
  }
}
/* Napomena pod datumom trke: koliko nedelja ima do trke i da li je to dovoljno
   za izabranu distancu (minWeeks iz DIST_PROFILES). Racuna umesto korisnika. */
/* ============ PREDVIĐANJE NA DAN TRKE ============
   Do sada je assess() računao predictedSec i realno (da li je cilj dostižan),
   ali se to NIGDE nije prikazivalo — polje "ciljno vreme" je tražilo broj i
   ćutalo o njemu. Ovo prikazuje predviđanje za SVA TRI intenziteta i, ako je
   cilj unet, kaže koji intenzitet ga stvarno dostiže.
   Koristi iste funkcije kao generator (assess/RAMP), ne parelelnu matematiku. */
const OB_INTENS=[['kons','Konzervativno'],['std','Standardno'],['agr','Agresivno']];
function outlookData(){
  const pbSec=pbTotalSec(), weeks=wizWeeks();
  if(pbSec==null||!pbSanityOk()||weeks==null) return null;
  const prof=DIST_PROFILES[wiz.raceDist]; if(!prof) return null;
  if(weeks<prof.minWeeks) return { short:true, weeks, minWeeks:prof.minWeeks, name:prof.name };
  const pb={distM:wiz.pbDist, sec:pbSec};
  const rows=OB_INTENS.map(([k,lbl])=>{
    const a=assess(pb, weeks, k, null, wiz.raceDist);
    return { k, lbl, sec:a.predictedSec, vdot:a.vdotGoal };
  });
  return { rows, weeks, name:prof.name, goal:goalTotalSec() };
}
/* ============ UPOZORENJA GENERATORA ============
   generatePlan() od pocetka racuna `meta.dayWarnings` (obim ne staje u izabrani
   broj dana, dva kvaliteta na premali obim, teski dani zaredom, vrhunac ispod
   onoga sto distanca trazi...), ali ih NIJEDAN ekran nije prikazivao — racunala
   su se i tiho zavrsavala u meta objektu. Zato je korisnik dobijao plan koji
   ne isporucuje trazenu kilometrazu, bez ijedne reci o tome zasto.

   Prikazuju se na DVA mesta, namerno:
   - u carobnjaku (korak 4), UZIVO — tu jos moze da doda dan trcanja ili smanji
     broj kvaliteta i odmah vidi da je upozorenje nestalo;
   - na ekranu plana, trajno — jer plan koji ne staje u izabrane dane ostaje
     takav i posle generisanja, pa razlog mora da bude vidljiv i kasnije. */
function planWarningsHTML(list, naslov){
  if(!list || !list.length) return '';
  return `<div class="gw-h">${esc(naslov)}</div>` +
    list.map(t=>`<div class="gw"><p>${esc(t)}</p></div>`).join('');
}
/* Upozorenja za TRENUTNI unos u carobnjaku — pravi probni plan i cita meta.
   `_noSuggest` se NE salje: predlog "trebalo bi ti N dana" je najkorisniji deo. */
function wizardWarnings(){
  const pbSec=pbTotalSec();
  if(pbSec==null || !pbSanityOk() || !wiz.raceDate || !(+wiz.weeklyKm>0)) return null;
  let p;
  try{
    p = generatePlan({
      startDate: todayStr(), raceDate: wiz.raceDate, raceDistM: wiz.raceDist,
      pb:{ distM:wiz.pbDist, sec:pbSec }, weeklyKm:+wiz.weeklyKm,
      runDays:wiz.runDays, quality:wiz.quality, lrDow:wiz.lrDow,
      qDows:(wiz.qDays||[]).slice(), runDows:(wiz.runDows||[]).slice(),
      intensity:wiz.intensity, goalSec:goalTotalSec(), trainedRecently:wiz.trainedRecently
    });
  }catch(e){ return null; }
  if(!p || p.error || !p.meta) return null;
  return p.meta.dayWarnings || [];
}
/* ODLOZENO RACUNANJE UPOZORENJA.
   `wizardWarnings()` pravi PUN probni plan, a `generatePlan` uz to rekurzivno
   zove sam sebe do 6 puta da bi predlozio potreban broj dana trcanja. Pozivalo
   se direktno iz `input` dogadjaja, a `goObStep()` ga je zvao jos jednom —
   dakle do 14 punih generisanja plana po PRITISKU TASTERA, sinhrono, na
   glavnoj niti. Na maratonskom planu od 40+ nedelja to je vidljivo zaglavljivanje
   unosa na telefonu. Racunanje sada ceka 250 ms tisine; poslednji poziv
   pobedjuje, pa je rezultat isti a posla je red velicine manje. */
let WIZ_WARN_T=null;
function renderWizWarningsSoon(){
  clearTimeout(WIZ_WARN_T);
  WIZ_WARN_T=setTimeout(renderWizWarnings, 250);
}
function renderWizWarnings(){
  clearTimeout(WIZ_WARN_T);
  const el=$('#ob-warn'); if(!el) return;
  const list=wizardWarnings();
  if(list===null){ el.style.display='none'; el.innerHTML=''; return; }
  el.style.display='';
  el.innerHTML = list.length
    ? planWarningsHTML(list, 'Na šta da paziš')
    : `<div class="gw-h">Na šta da paziš</div><div class="gw-ok">Nema zamerki — traženi obim staje u izabrane dane, a raspored poštuje hard/easy princip.</div>`;
}
function renderOutlook(){
  const el=$('#ob-outlook'); if(!el) return;
  const d=outlookData();
  if(!d){ el.innerHTML='<div class="ob-ct">Predviđanje na dan trke</div><div class="ob-hint">Unesi skorašnji rezultat i datum trke da bi se predviđanje izračunalo.</div>'; return; }
  if(d.short){ el.innerHTML=`<div class="ob-ct">Predviđanje na dan trke</div><div class="ob-hint">${d.weeks} nedelja je manje od minimuma za ${esc(d.name)} (<b>${d.minWeeks}</b>) — plan se ne može napraviti, pa ni predvideti.</div>`; return; }
  let h=`<div class="ob-ct">Predviđanje na dan trke <span class="ob-opt">— ${d.weeks} nedelja, ${esc(d.name)}</span></div>`;
  h+=`<div class="ob-preds">`;
  d.rows.forEach(r=>{
    const sel=r.k===wiz.intensity;
    const hits=d.goal!=null&&r.sec<=d.goal;
    h+=`<div class="ob-pred${sel?' on':''}">
      <i>${esc(r.lbl)}</i>
      <b>${fmtClock(r.sec)}</b>
      <s>${d.goal!=null?(hits?'stiže cilj':'ne stiže'):'VDOT '+r.vdot.toFixed(1)}</s>
    </div>`;
  });
  h+=`</div>`;
  if(d.goal!=null){
    const reach=d.rows.find(r=>r.sec<=d.goal);          /* najblaži koji stiže */
    const sel=d.rows.find(r=>r.k===wiz.intensity);
    const agr=d.rows[d.rows.length-1];
    let v;
    if(!reach){
      const diff=agr.sec-d.goal;
      v=`<b>Cilj ${fmtClock(d.goal)} nije realan za ovaj plan.</b> Brži je ${fmtClock(diff)} i od najagresivnijeg scenarija (${fmtClock(agr.sec)}). Realno bi tražio više nedelja ili veći nedeljni obim.`;
    } else if(reach.k===d.rows[0].k){
      v=`<b>Cilj ${fmtClock(d.goal)} je dostižan i najopreznijim pristupom</b> (${fmtClock(reach.sec)}). Slobodno ciljaj brže.`;
    } else if(reach.k==='agr'){
      v=`<b>Cilj ${fmtClock(d.goal)} je na granici</b> — dostiže ga samo Agresivno (${fmtClock(reach.sec)}), a to je realno uglavnom uz nizak trenažni staž ili paralelan gubitak telesne mase.`;
    } else {
      v=`<b>Cilj ${fmtClock(d.goal)} je realan</b> — dostiže ga ${esc(reach.lbl)} (${fmtClock(reach.sec)}).`;
    }
    if(reach&&sel&&sel.sec>d.goal){
      /* samo kad cilj JESTE dostizan — inace je suvisno, vec smo rekli da nije realan */
      v+=` Trenutno je izabrano ${esc(sel.lbl)} (${fmtClock(sel.sec)}) — prebaci na ${esc(reach.lbl)}.`;
    }
    h+=`<div class="ob-verdict${!reach?' bad':(reach.k==='agr'?' warn':' good')}">${v}</div>`;
  } else {
    h+=`<div class="ob-hint">Upiši ciljno vreme ispod pa ću ti reći koliko je realno.</div>`;
  }
  el.innerHTML=h;
}
/* Uskladjuje UI posle izbora dana trcanja:
   - broj dana prati izbor (i sam izbor se zakljucava da se ne protivrece)
   - dani za LR i kvalitet koji NISU izabrani postaju nedostupni
   - ako je LR/kvalitet bio na danu koji je upravo iskljucen, premesta se */
function syncRunDowUI(){
  const sel=(wiz.runDows||[]).slice().sort((a,b)=>a-b);   /* polje moze izostati */
  const on=sel.length>=2;
  const card=$('#runDaysCard'), hint=$('#runDowHint');

  if(on){
    wiz.runDays=sel.length;
    $$('#runDaysChips .ob-chip').forEach(x=>x.classList.toggle('on', +x.dataset.v===sel.length));
    if(card) card.style.display='none';       /* broj sledi iz izbora — ne pitaj dvaput */
    if(hint) hint.innerHTML='Izabrano <b>'+sel.length+'</b> '+(sel.length===1?'dan':(sel.length<5?'dana':'dana'))+' — plan koristi <b>tačno</b> te dane.';
  }else{
    if(card) card.style.display='';
    if(hint) hint.innerHTML='Ostavi prazno pa plan sam raspoređuje dane. Izaberi konkretne ako imaš fiksne obaveze — tada se koriste <b>tačno ti dani</b>.';
  }

  /* LR i kvalitet: samo izabrani dani su dostupni */
  const dostupan=d=>!on||sel.includes(d);
  $$('#lrDowChips .ob-chip').forEach(x=>{
    const v=+x.dataset.v, ok=dostupan(v);
    x.disabled=!ok; x.style.opacity=ok?'':'.3';
    if(!ok&&wiz.lrDow===v){ x.classList.remove('on'); wiz.lrDow=null; }
  });
  /* Dok korisnik SAM ne izabere dan za dugo trcanje, drzimo ga na POSLEDNJEM
     izabranom danu i preracunavamo na svaku izmenu. Inace bi ostao tamo gde je
     slucajno pao kad su bila izabrana samo dva dana. */
  if(on && (!wiz.lrDowManual || !sel.includes(wiz.lrDow))){
    wiz.lrDow=sel[sel.length-1];
    $$('#lrDowChips .ob-chip').forEach(x=>x.classList.toggle('on', +x.dataset.v===wiz.lrDow));
  }
  $$('#qDayChips .ob-chip').forEach(x=>{
    const v=+x.dataset.v, ok=dostupan(v)&&v!==wiz.lrDow;
    x.disabled=!ok; x.style.opacity=ok?'':'.3';
    if(!ok){
      const i=wiz.qDays.indexOf(v);
      if(i>=0){ wiz.qDays.splice(i,1); x.classList.remove('on'); }
    }
  });
}
function updateWeeksHint(){
  const el=$('#ob-weeks-hint'); if(!el)return;
  if(!wiz.raceDate){ el.textContent=''; return; }
  /* ISTA formula kao wizWeeks()/generatePlan(), ne sopstvena.
     Ranije je ovde stajalo `floor(diffD(danas, trka)/7)`, dok plan racuna
     `floor((trka - ponedeljakTekuceNedelje)/7)+1` — razlika do DVE nedelje.
     Posledica nije kozmeticka: u sredu, sa trkom za 40 dana, napomena je
     govorila „5 nedelja, 5K trazi najmanje 6, plan ce biti skracen", a
     generator je pravio pun ciklus od 7 nedelja. U drugom smeru je napomena
     govorila „dovoljno", pa bi generisanje palo greskom. */
  const wks=wizWeeks();
  if(wks==null){ el.textContent=''; return; }
  const prof=DIST_PROFILES[wiz.raceDist]||DIST_PROFILES[5000];
  if(wks<1){ el.innerHTML='Trka je <b>ove nedelje</b> — previše blizu za plan.'; return; }
  const plNed=n=>{const m=n%10,h=n%100;return(m===1&&h!==11)?'nedelja':(m>=2&&m<=4&&(h<12||h>14))?'nedelje':'nedelja';};
  let t=`Do trke: <b>${wks} ${plNed(wks)}</b> — `;
  /* Ranije je pisalo „plan ce biti skracen" — a generator u tom slucaju plan
     UOPSTE NE PRAVI, nego vraca gresku. Napomena mora da kaze isto sto ce se
     stvarno desiti, inace covek prodje sva cetiri koraka pa tek na kraju
     sazna da nije moglo. */
  t += wks<prof.minWeeks
    ? `${prof.name} traži najmanje <b>${prof.minWeeks}</b>, pa plan za ovaj datum ne može da se napravi. Pomeri trku ili izaberi kraću distancu.`
    : `dovoljno za pun ${prof.name} ciklus sa deload nedeljom i taperom.`;
  el.innerHTML=t;
}
function updateVdotPreview(){
  const wrap=$('#vdotWrap');
  const sec=pbTotalSec();
  /* RECI ZASTO. pbSanityOk() zakljucava „Dalje" na koraku 2 i sklanja prikaz
     forme, a razlog se nigde nije video — covek koji u polje za 5 km upise
     svoje maratonsko vreme dobije mrtvo dugme bez ijedne reci. Tekst je sve
     vreme postojao u pbSanityMsg(), samo nije bio nigde prikazan. */
  const up=$('#pbUpozorenje'), upT=$('#pbUpozorenjeTxt');
  const poruka=sec==null?'':pbSanityMsg();
  if(up){ up.style.display=poruka?'':'none'; if(upT) upT.textContent=poruka; }
  if(sec==null||!pbSanityOk()){ wrap.classList.remove('show'); return; }
  const vd=vdotFromRace(wiz.pbDist, sec);
  $('#vdotNum').textContent=vd.toFixed(1);
  const frac=Math.max(0,Math.min(1,(vd-25)/(65-25)));
  $('#vdotArc').style.strokeDashoffset=VDOT_CIRC*(1-frac);
  /* tempovi koji IZLAZE iz ovog broja — pokazuje zasto se rezultat uopste unosi */
  const pw=$('#vdotPaces');
  if(pw){
    pw.innerHTML=[['Lako','E'],['Tempo','T'],['Interval','I'],['Rep','R']]
      .map(([lbl,z])=>`<div class="ob-vp"><i>${lbl}</i><b>${fmtTempo(paceForZone(vd,z))}</b></div>`).join('');
  }
  wrap.classList.add('show');
}
function bindOnboardEvents(){
  /* dugmeta nema kad korisnik jos nema svoj plan — nema iza cega da se zatvori */
  if($('#obCancel')) $('#obCancel').addEventListener('click',()=>{
    if(!confirm('Otkazati generisanje plana?'))return;
    closeWizard();
  });
  $('#in-raceDate').addEventListener('input',e=>{ wiz.raceDate=e.target.value; goObStep(obStep); renderOutlook(); renderWizWarningsSoon(); });
  $$('#raceDistChips .ob-chip').forEach(c=>c.addEventListener('click',()=>{
    $$('#raceDistChips .ob-chip').forEach(x=>x.classList.remove('on')); c.classList.add('on');
    wiz.raceDist=+c.dataset.v;
    updateWeeksHint();     /* minWeeks zavisi od distance */
    syncGoalHoursUI();     /* HM/maraton -> ciljno vreme dobija h polje */
    renderOutlook(); renderWizWarnings();       /* predvidjanje se racuna za NOVU distancu */
  }));
  $$('#pbDistChips .ob-chip').forEach(c=>c.addEventListener('click',()=>{
    $$('#pbDistChips .ob-chip').forEach(x=>x.classList.remove('on')); c.classList.add('on');
    wiz.pbDist=+c.dataset.v; syncHoursUI(); goObStep(obStep); updateVdotPreview(); renderOutlook(); renderWizWarnings();
  }));
  $('#in-pbH').addEventListener('input',e=>{ e.target.value=clampDigits(e.target.value,1); wiz.pbH=e.target.value; goObStep(obStep); updateVdotPreview(); });
  $('#in-pbMin').addEventListener('input',e=>{ e.target.value=clampDigits(e.target.value,2); wiz.pbMin=e.target.value; goObStep(obStep); updateVdotPreview(); });
  $('#in-pbSec').addEventListener('input',e=>{ e.target.value=clampDigits(e.target.value,2); wiz.pbSec=e.target.value; goObStep(obStep); updateVdotPreview(); });
  $('#in-weeklyKm').addEventListener('input',e=>{ wiz.weeklyKm=e.target.value; goObStep(obStep); renderWizWarningsSoon(); });
  $$('#trainedChips .ob-chip').forEach(c=>c.addEventListener('click',()=>{
    $$('#trainedChips .ob-chip').forEach(x=>x.classList.remove('on')); c.classList.add('on');
    wiz.trainedRecently = c.dataset.v==='yes';
    renderWizWarnings();
  }));
  $$('#runDaysChips .ob-chip').forEach(c=>c.addEventListener('click',()=>{
    $$('#runDaysChips .ob-chip').forEach(x=>x.classList.remove('on')); c.classList.add('on'); wiz.runDays=+c.dataset.v;
    renderWizWarnings();
  }));
  /* Izbor konkretnih dana trcanja. Kad su izabrani, oni ODREDJUJU i broj dana,
     a izbor dana za dugo trcanje / kvalitet se ogranicava na njih — da korisnik
     ne moze da izabere kvalitet u dan kada uopste ne trci. */
  $$('#runDowChips .ob-chip').forEach(c=>c.addEventListener('click',()=>{
    const v=+c.dataset.v;
    const i=wiz.runDows.indexOf(v);
    if(i>=0){ wiz.runDows.splice(i,1); c.classList.remove('on'); }
    else { wiz.runDows.push(v); c.classList.add('on'); }
    wiz.runDows.sort((a,b)=>a-b);
    syncRunDowUI(); renderWizWarnings();
  }));
  $$('#lrDowChips .ob-chip').forEach(c=>c.addEventListener('click',()=>{
    $$('#lrDowChips .ob-chip').forEach(x=>x.classList.remove('on')); c.classList.add('on');
    wiz.lrDow=+c.dataset.v; wiz.lrDowManual=true;   /* korisnik je sam izabrao — ne diramo vise */
    const i=wiz.qDays.indexOf(wiz.lrDow);
    if(i>=0){ wiz.qDays.splice(i,1); const b=document.querySelector(`#qDayChips .ob-chip[data-v="${wiz.lrDow}"]`); if(b)b.classList.remove('on'); }
    syncRunDowUI(); renderWizWarnings();
  }));
  $$('#qualityChips .ob-chip').forEach(c=>c.addEventListener('click',()=>{
    $$('#qualityChips .ob-chip').forEach(x=>x.classList.remove('on')); c.classList.add('on'); wiz.quality=+c.dataset.v;
    while(wiz.qDays.length>wiz.quality){ const rm=wiz.qDays.shift(); const b=document.querySelector(`#qDayChips .ob-chip[data-v="${rm}"]`); if(b)b.classList.remove('on'); }
    renderWizWarnings();
  }));
  $$('#qDayChips .ob-chip').forEach(c=>c.addEventListener('click',()=>{
    const v=+c.dataset.v; if(v===wiz.lrDow) return;
    const i=wiz.qDays.indexOf(v);
    if(i>=0){ wiz.qDays.splice(i,1); c.classList.remove('on'); return; }
    wiz.qDays.push(v); c.classList.add('on');
    while(wiz.qDays.length>wiz.quality){ const rm=wiz.qDays.shift(); const b=document.querySelector(`#qDayChips .ob-chip[data-v="${rm}"]`); if(b)b.classList.remove('on'); }
    renderWizWarnings();
  }));
  $$('.ob-icard').forEach(c=>c.addEventListener('click',()=>{
    $$('.ob-icard').forEach(x=>x.classList.remove('on')); c.classList.add('on'); wiz.intensity=c.dataset.v;
    renderOutlook(); renderWizWarnings(); /* izabran intenzitet je istaknut u predvidjanju i pominje se u proceni cilja */
  }));
  $('#in-goalH').addEventListener('input',e=>{ e.target.value=clampDigits(e.target.value,1); wiz.goalH=e.target.value; renderOutlook(); renderWizWarningsSoon(); });
  $('#in-goalMin').addEventListener('input',e=>{ e.target.value=clampDigits(e.target.value,2); wiz.goalMin=e.target.value; renderOutlook(); renderWizWarningsSoon(); });
  $('#in-goalSec').addEventListener('input',e=>{ e.target.value=clampDigits(e.target.value,2); wiz.goalSec=e.target.value; renderOutlook(); renderWizWarningsSoon(); });
  $('#obBack').addEventListener('click',()=>goObStep(obStep-1));
  $('#obNext').addEventListener('click',()=>{
    if(!obStepValid(obStep))return;
    if(obStep<TOTAL_STEPS){ goObStep(obStep+1); return; }
    finishOnboarding();
  });
}
/* ============================================================
   ODVOJENI ID PROSTORI — hardkodovan plan koristi 'n' prefiks (n1d1, p1),
   generisan koristi 'g' (adaptGeneratedPlan: g1d1, g1_0). Ta dva se NIKAD
   ne sudaraju, pa podaci oba plana mirno žive u istom S.log/S.pred/S.vdotLog.
   Zato brisanje jednog NE SME da dira drugi — ranije je finishOnboarding
   bezuslovno praznio SVE (S.log={} …), pa je klik na "Generiši novi plan
   (za drugara)" trajno brisao ceo dnevnik treninga, predikcije i VDOT
   istoriju vlasnika — iako Podešavanja izričito obećavaju "tvoj plan ostaje
   netaknut", i bez ijednog pitanja pre brisanja.
   ============================================================ */
const isGenId=k=>typeof k==='string'&&k.charAt(0)==='g';
function hasGenPlanData(){
  if(Object.keys(S.log||{}).some(isGenId))return true;
  if(Object.keys(S.pred||{}).some(isGenId))return true;
  if(Object.keys(S.alts||{}).some(isGenId))return true;
  if(Object.keys(S.moves||{}).some(isGenId))return true;
  if((S.vdotLog||[]).some(e=>e&&isGenId(e.id)))return true;
  return false;
}
/* Briše SAMO podatke generisanog plana. Novi generisan plan dobija iste 'g'
   ID-jeve kao prethodni, pa stari moraju da odu — inače bi se stari unosi
   zalepili za nepovezane dane novog plana. */
function purgeGenPlanData(){
  const dropKeys=o=>{ Object.keys(o||{}).forEach(k=>{ if(isGenId(k))delete o[k]; }); };
  dropKeys(S.log); dropKeys(S.pred); dropKeys(S.predLock); dropKeys(S.alts); dropKeys(S.moves);
  S.vdotLog=(S.vdotLog||[]).filter(e=>!(e&&isGenId(e.id)));
  preracunajVdotLog();   /* uklonjene sesije vise ne smeju da ucestvuju u lancu */
  /* koleno/težina: odlaze samo redovi IZVEDENI iz treninga generisanog plana
     (src = id dana, v. syncSide). Ručni unosi (src null) su korisnikovi
     sopstveni zapisi o telu, ne o planu — oni ostaju. */
  S.knee=(S.knee||[]).filter(k=>!(k&&isGenId(k.src)));
  S.kg=(S.kg||[]).filter(x=>!(x&&isGenId(x.src)));
}
/* V2-DOMAĆA verzija (V3 je ovde imala S.meta/S.plan/indexPlan — različit sistem).
   Ide kroz isti put kao tvoj hardkodovan plan: adaptGeneratedPlan() dodeljuje
   id/datume, S.genPlan čuva REZULTAT (čist, bez runtime mutacija — vidi Fazu 1),
   setActivePlan()+rebuildDateIndex() aktiviraju ga. */
function finishOnboarding(){
  const pbSec=pbTotalSec();
  const goalSec=goalTotalSec();
  const meta={
    startDate: todayStr(), raceDate: wiz.raceDate, raceDistM: wiz.raceDist,
    pb:{ distM:wiz.pbDist, sec:pbSec }, weeklyKm:+wiz.weeklyKm,
    runDays:wiz.runDays, quality:wiz.quality, lrDow:wiz.lrDow,
    qDows:(wiz.qDays||[]).slice(), runDows:(wiz.runDows||[]).slice(),   /* polja mogu izostati (stariji backup) — ne rusimo se */
    intensity:wiz.intensity, goalSec, trainedRecently:wiz.trainedRecently
  };
  const plan=generatePlan(meta);
  if(plan.error){ $('#ob-err-1').textContent=plan.error; goObStep(1); return; }
  const adapted=adaptGeneratedPlan(plan);
  if(!adapted){ $('#ob-err-1').textContent='Neočekivana greška pri generisanju plana.'; goObStep(1); return; }
  /* Pita SAMO ako stvarno ima šta da se izgubi (podaci prethodnog GENERISANOG
     plana). Podaci tvog plana se ne diraju, pa nema razloga da te ovo pita
     kad prvi put praviš plan za nekog drugog. */
  if(hasGenPlanData() && !confirm('Već postoji generisan plan. Njegovi unosi (treninzi, predikcije, VDOT) biće obrisani.\n\nTvoj lični plan i njegova istorija ostaju netaknuti.\n\nNastaviti?')) return;
  purgeGenPlanData();
  S.genPlan=adapted;
  setActivePlan();rebuildDateIndex();save();
  closeWizard();
}

/* ---------- POMERANJE TRENINGA (centralni ekran, cela nedelja odjednom) ----------
   Dodir prvog dana ga izabere, dodir drugog im zameni mesta. Odrađeni dani su
   zaključani (istorija se ne pomera). NE koristi <select> — CSS mu skida native
   strelicu (appearance:none), pa nema vidljivog znaka da je dodirljiv. */
let SWAP_SEL=null, SWAP_ERR='';
function weekSwapHTML(w){
  const doneId=id=>S.log[id]&&S.log[id].status==='done';
  const days=w.days.filter(x=>!x.test).slice().sort((a,b)=>{
    const da=a.date||'9999-99-99', db=b.date||'9999-99-99';
    return da<db?-1:da>db?1:0;
  });
  const moved=w.days.some(x=>!x.test&&S.moves&&S.moves[x.id]!=null);
  const selD=SWAP_SEL?BY_ID[SWAP_SEL]:null;
  let h=`<div class="sh-t">Pomeranje treninga · N${w.w}</div>
    <div class="sh-s">${selD?`Izabrano: ${dowOf(selD.date)} ${fmtD(selD.date)} — dodirni dan sa kojim će zameniti mesto`:'Dodirni dan koji hoćeš da pomeriš'}</div>`;
  if(SWAP_ERR)h+=`<div style="font-size:.75rem;color:var(--red);margin-bottom:10px">${esc(SWAP_ERR)}</div>`;
  h+=`<div class="swap-list">`;
  days.forEach(d=>{
    const locked=doneId(d.id), sel=SWAP_SEL===d.id, tag=locked?'div':'button';
    const title=d.rest?(d.desc||'Odmor'):d.desc.split('\n')[0];
    h+=`<${tag} class="day${sel?' swap-sel':''}${locked?' swap-lock':''}"${locked?'':` data-swd="${esc(d.id)}"`}>
      <div class="day-d">${dowOf(d.date)}<small>${fmtD(d.date)}</small></div>
      <div class="day-t" style="${d.rest?'color:var(--txt3)':''}">${esc(title)}${S.moves&&S.moves[d.id]!=null?`<small>pomeren sa ${fmtD(d.origDate)}</small>`:''}</div>
      <div class="day-km">${d.km!=null?fmtKm(d.km):''}</div>
      <span class="st ${locked?'done':sel?'skip':'pending'}">${locked?'✓':sel?'⇄':'○'}</span>
    </${tag}>`;
  });
  h+=`</div>`;
  if(moved)h+=`<div class="btnrow" style="margin-top:14px"><button class="btn ghost" id="swap-undo">Vrati raspored nedelje na plan</button></div>`;
  h+=`<div class="note-src">Odrađeni dani (✓) se ne pomeraju — istorija ostaje netaknuta. Zamena je moguća unutar iste nedelje.</div>`;
  return h;
}
function openWeekSwap(wNum){
  const w=CUR_PLAN.find(x=>x.w===wNum);
  if(!w)return;
  SWAP_SEL=null;SWAP_ERR='';
  renderWeekSwap(w);
}
function renderWeekSwap(w){
  openSheet(weekSwapHTML(w));
  SWAP_ERR=''; /* greška se prikaže jednom, pa se čisti pri sledećem crtanju */
  const sh=$('#sheet');
  sh.querySelectorAll('[data-swd]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.swd;
    if(!SWAP_SEL){SWAP_SEL=id;renderWeekSwap(w);return;}      /* prvi dodir: izbor */
    if(SWAP_SEL===id){SWAP_SEL=null;renderWeekSwap(w);return;} /* isti dan: poništi izbor */
    const res=swapDays(SWAP_SEL,id);                           /* drugi dodir: zamena */
    SWAP_SEL=null;
    if(!res.ok)SWAP_ERR='Zamena nije uspela: '+(res.err||'nepoznata greška');
    renderWeekSwap(w);
  });
  const undo=sh.querySelector('#swap-undo');
  if(undo)undo.onclick=()=>{
    if(!confirm('Vratiti sve pomerene dane ove nedelje na originalni raspored iz plana?'))return;
    undoWeekMoves(w);SWAP_SEL=null;renderWeekSwap(w);
  };
}
/* Kratko uputstvo za izvođenje po tipu sesije — ključ je sessKind(d) izlaz,
   radi identično za hardkodovan i generisan plan (bez dodatne logike).
   Fokus na kvalitetne tipove gde tehnika/pristup stvarno menja efekat. */
const SESS_GUIDE={
  'Intervali':'Isti tempo na svakom ponavljanju — nemoj da kreneš brže na prvom. Ostani opušten i kontrolisan i kad postane teško.',
  'Repeticije':'Odmaraj se do kraja između ponavljanja — ovo je trening brzine i ekonomije trčanja, ne izdržljivosti na pragu. Trči opušteno, ne na silu.',
  'Tempo':'„Udobno teško" — kratku rečenicu možeš da izgovoriš, ali razgovor ne. Drži isti napor od početka do kraja i nemoj da kreneš prebrzo.',
  'Tempo isprekidan':'Isti tempo i napor kao kod neprekidnog tempa — kratka pauza je samo predah, ne novi početak. Cilj je da ceo trening deluje kao jedan neprekidan napor.',
  'Fartlek':'Vodi se po naporu, ne po štoperici — ubrzanja su snažan zalet, ne sprint. U lakim delovima se potpuno opusti.',
  'Progresivno (tempo trke)':'Kreni namerno lagano, a poslednju trećinu drži TAČNO na tempu trke — ne brže. Poenta je da naučiš taj tempo na umornim nogama, a ne da testiraš koliko možeš.',
  'Progresivno':'Kreni namerno lagano — svaki sledeći deo treba da bude brži od prethodnog. Najčešća greška je prebrz početak.',
  'Trkački ritam':'Tačno tvoj ciljani tempo trke — ni sekundu brže. Ovde se vežba osećaj za ritam i disciplina, ne koliko možeš.',
  'Piramida':'Drži isti NAPOR na svakoj deonici, ne isti tempo — kraće deonice prirodno idu brže. Nemoj da kreneš prejako na najkraćoj, da ne „pukneš" na vrhu piramide.',
  'Maratonski tempo':'Tačno tvoj ciljani tempo trke — ovo je proba, a ne prilika da guraš jače. Ako je trčanje dovoljno dugo, iskoristi ga i za vežbanje ishrane i hidratacije.',
  '10K tempo (ciljni ritam)':'Tačno tvoj ciljani tempo trke — ovde se vežba disciplina tempa, ne guranje preko njega.',
  'HM tempo (ciljni ritam)':'Tačno tvoj ciljani tempo trke — ovde se vežba disciplina tempa, ne guranje preko njega.',
  'Tempo trke':'Tačno tvoj ciljani tempo polumaratona — ni sekundu brže. Ovde se vežba disciplina tempa i osećaj za njega; pauza je lagano trčanje, ne stajanje.',
  'Kontrolna trka':'Generalna proba: isprobaj opremu, doručak i gorivo tačno kako planiraš na dan trke. Ako trčiš pravu 10K trku, trči je punom snagom; ako je istrčavaš sam, drži tempo polumaratona.',
  'Dugo (LR)':'Ravnomeran, lagan tempo — trebalo bi da možeš da razgovaraš bez zadihanosti. Ako ti poslednji kilometar bude teži od prvog, sledeći put kreni sporije.',
  'Lako':'Zaista lako — ovo je dan za oporavak, ne za „malo brže jer se osećam dobro". Ako ne možeš da pričaš u punim rečenicama, usporavaj.',
  'Trčanje/hod':'Pauzu za hod uzmi PRE nego što se umoriš, ne kad moraš — u tome je cela poenta. Deo za trčanje drži lagan, hod neka bude živ.',
  'TRKA':'Prvi kilometar drži ciljani tempo i kad ti deluje prelako — najčešća greška je prebrz start. Poslednju trećinu odlučuje ono što si sačuvao na početku.',
  'Test':'Trči kao pravu trku, ali bez pritiska — cilj je tačna procena forme, ne rekord. Isti uslovi (staza, doba dana) daju uporediv rezultat.',
};
function openDaySheet(id){
  const d=BY_ID[id],s=stFor(id);
  const isRest=!!d.rest; /* odmor se ne loguje — prikaz bez forme, samo izmena */
  openSheet(`
    <div class="sh-t">N${d.week.w} · ${d.test?'TEST (opciono)':dowOf(d.date)+' '+fmtDY(d.date)}</div>
    <div class="sh-s">${esc(sessKind(d))}${d.km!=null?' · plan '+fmtKm(d.km)+' km':''}${S.alts&&S.alts[id]?' · izmenjen':''}</div>
    ${isRest?'':`<div class="desc" style="font-size:.85rem">${esc(d.desc)}</div>`}
    ${!isRest&&SESS_GUIDE[sessKind(d)]?`<div class="note-src" style="margin-top:6px">💡 ${esc(SESS_GUIDE[sessKind(d)])}</div>`:''}
    ${isRest?'':`<div class="seg" id="seg">
      <button data-s="pending" class="${s==='pending'?'on':''}">Predstoji</button>
      <button data-s="done" class="c-done ${s==='done'?'on':''}">Odrađen</button>
      <button data-s="skip" class="c-skip ${s==='skip'?'on':''}">Preskočen</button>
    </div>`}
    ${isRest?'':formHTML(d)}
    ${isRest?'':(()=>{ const l=S.log[id]||{};
        return dKarta('Sa sata','',dRedovi(metrikaSata(l)))
             + dKarta('Jutros','',dRedovi(oporavakRedovi(l.runDate||l.ts||d.date)))
             + karticaIstaSesija(d)
             + aiKarta(d,l); })()}
    ${d.test
      ? `<div class="note-src">Rezultat unesi u tabu <b>Trka → Test 3 km</b>. Test se ne mora istrčati baš na ovaj dan — tamo mu upisuješ i datum.</div>`
      : `<div class="btnrow" style="margin-top:12px"><button class="btn ghost" id="alt-open">✏️ Izmeni trening</button></div>`}
    ${!isRest&&S.log[id]?`<div class="btnrow"><button class="btn danger" id="del-log">Obriši unos</button></div>`:''}
    <div class="note-src">Sve izmene se čuvaju automatski.</div>
  `);
  const sh=$('#sheet');
  const altOpen=sh.querySelector('#alt-open');
  if(altOpen)altOpen.onclick=()=>openAltSheet(id);
  if(isRest)return; /* dan odmora nema formu ni status */
  bindForm(sh,d);
  sh.querySelectorAll('#seg button').forEach(b=>b.onclick=()=>{
    const l=S.log[id]||(S.log[id]={});
    l.status=b.dataset.s;
    if(b.dataset.s==='done'&&!l.ts)l.ts=d.date||TODAY;
    save();
    sh.querySelectorAll('#seg button').forEach(x=>x.classList.toggle('on',x===b));
    if(b.dataset.s==='done')donePop();
  });
  const del=sh.querySelector('#del-log');
  if(del)del.onclick=()=>{
    if(!confirm('Obriši sve unete podatke za ovaj trening?'))return;
    delete S.log[id];
    S.knee=S.knee.filter(k=>k.src!==id);
    S.kg=S.kg.filter(k=>k.src!==id);
    save();closeSheet();
  };
}

/* ---------- GRAFIKONI ---------- */
function svgW(w,h,inner){return `<svg class="chart" viewBox="0 0 ${w} ${h}">${inner}</svg>`;}

/* ============================================================
   OPORAVAK — prikaz HRV-a, pulsa u miru i sna.

   Podaci su se do sada povlacili i slali AI-ju, ali se NIGDE nisu videli —
   propust: korisnik ne moze da proveri ni da li su tacni, ni da sam donese
   zakljucak. HRV se prikazuje ISKLJUCIVO u odnosu na sopstvenu sedmodnevnu
   osnovu, jer gola brojka ne znaci nista (moja 60 i tudja 60 su razlicite
   stvari).
   ============================================================ */
function oporavakNiz(dana){
  const w=S.wellness||{};
  return Object.keys(w).sort().slice(-(dana||60)).map(k=>w[k]).filter(Boolean);
}
function bojaOdstupanja(p, obrnuto){
  if(p==null) return 'var(--txt2)';
  const v=obrnuto?-p:p;                    /* kod pulsa u miru je RAST losiji */
  if(v<=-10) return 'var(--red)';
  if(v<=-5)  return 'var(--amber)';
  return 'var(--green)';
}
function karticaOporavka(){
  const niz=oporavakNiz(90);
  if(!niz.length){
    /* Naslov je „Jutros", ne „Oporavak" — tako se ista kartica zove i na
       ekranu Danas, a od spajanja tabova „Oporavak" je ime CELOG ekrana, pa bi
       kartica sa istim imenom izgledala kao da je ekran u sebi. */
    return `<div class="card"><div class="card-t">Jutros</div>
      <div class="note-src" style="margin:0">${S.icu&&S.icu.athleteId
        ? 'Povezano sa intervals.icu, ali još nema zapisa. Dodirni „Povuci sve" u Podešavanjima.'
        : 'Nije povezano. Podešavanja → intervals.icu — HRV, puls u miru i san sa Garmina, i krugovi intervala sa trčanja.'}</div></div>`;
  }
  const zadnji=niz[niz.length-1];
  const o=oporavakZa(zadnji.datum)||zadnji;
  /* esc() na svaku vrednost: cistWellness() gore vec svodi zapise na brojeve,
     ali kartica ne sme da zavisi od toga da li je neko setio da ih ocisti. */
  const red=(lbl,val,sub,boja)=>val==null?'':`<div class="ob-vp" style="flex:1">
      <i>${esc(lbl)}</i><b style="color:${esc(boja||'var(--txt)')}">${esc(val)}</b>
      ${sub?`<small style="display:block;font-size:.62rem;color:var(--txt3);margin-top:2px">${esc(sub)}</small>`:''}</div>`;
  /* intervals.icu vraća formu i umor sa punom preciznošću (27.728786), pa je
     na ekranu pisalo „forma 27.728786 · umor 41.52341". Jedna decimala je i
     više nego što ta mera nosi. */
  /* Isto važi i za odstupanje i za sedmodnevnu osnovu: pisalo je „-1.1% od
     osnove 61.7" — decimalna TAČKA usred srpskog teksta. */
  const brZa=v=>(v==null||!isFinite(+v))?'—':esc(fmtNum(+v,1));
  const hrvSub=o.hrvOdstupanje!=null?`${o.hrvOdstupanje>=0?'+':''}${brZa(o.hrvOdstupanje)}% od osnove ${brZa(o.hrvBaza7)}`:'nema osnove još';
  return `<div class="card">
    ${dGlava('Jutros', esc(fmtD(o.datum)))}
    <div class="ob-vpaces" style="display:flex;gap:8px">
      ${red('HRV', o.hrv!=null?brZa(o.hrv):'—', hrvSub, bojaOdstupanja(o.hrvOdstupanje))}
      ${red('San', o.sanH!=null?brZa(o.sanH)+' h':'—', o.sanOcena!=null?('ocena '+brZa(o.sanOcena)):'', o.sanH!=null?(o.sanH<6?'var(--red)':o.sanH<7?'var(--amber)':'var(--green)'):null)}
      ${o.svezina!=null?red('Svežina', brZa(o.svezina), 'forma '+brZa(o.ctl)+' · umor '+brZa(o.atl), o.svezina<-10?'var(--red)':o.svezina<0?'var(--amber)':'var(--green)'):''}
    </div>
    ${chartHrv(niz)}
    <div class="note-src">HRV se čita u odnosu na <b>tvoju</b> sedmodnevnu osnovu, ne kao gola brojka. Pad preko 10% znači da oporavak zaostaje; pad uz porast pulsa u miru i kratak san je jasan znak da treba lakši dan.</div>
  </div>`;
}
/* HRV kroz vreme, sa trakom sopstvene sedmodnevne osnove. */
function chartHrv(niz){
  const v=niz.filter(x=>x&&x.hrv!=null);
  if(v.length<4) return '<div class="note-src" style="margin-top:10px">Grafikon HRV-a se crta kad bude bar 4 dana zapisa.</div>';
  const W=340,H=156,L=30,R=8,B=132,T=28;   /* +16 px za natpis izabrane tačke */
  const vals=v.map(x=>x.hrv);
  const lo=Math.min(...vals)*0.94, hi=Math.max(...vals)*1.06;
  const X=i=>L+(v.length===1?0:i/(v.length-1)*(W-L-R));
  const Y=y=>B-((y-lo)/Math.max(hi-lo,1))*(B-T);
  /* klizna sedmodnevna osnova */
  const baza=v.map((_,i)=>{ const od=Math.max(0,i-6); const seg=v.slice(od,i+1).map(x=>x.hrv);
                            return seg.reduce((a,b)=>a+b,0)/seg.length; });
  let g='';
  const selH=CHART_SEL.hrv!=null?v[CHART_SEL.hrv]:null;
  g+=chartTop(L, selH ? `${fmtD(selH.datum)} · HRV ${fmtNum(selH.hrv,1)} · osnova ${fmtNum(baza[CHART_SEL.hrv],1)}${selH.pulsUMiru!=null?' · puls u miru '+fmtNum(selH.pulsUMiru,0):''}${selH.sanH!=null?' · san '+fmtNum(selH.sanH,1)+' h':''}` : null);
  g+=`<polyline points="${baza.map((b,i)=>X(i).toFixed(1)+','+Y(b).toFixed(1)).join(' ')}" fill="none" stroke="var(--txt3)" stroke-width="1.4" stroke-dasharray="4 4" opacity=".65"/>`;
  g+=`<polyline class="ln" points="${v.map((x,i)=>X(i).toFixed(1)+','+Y(x.hrv).toFixed(1)).join(' ')}" fill="none" stroke="var(--cyan)" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"/>`;
  v.forEach((x,i)=>{
    const last=i===v.length-1, sel=CHART_SEL.hrv===i;
    /* Ranije se crtala SAMO poslednja tačka; ostale su bile nevidljive, pa se
       ni nije imalo šta dodirnuti. Sada sve postoje, a nedodirnute su sitne
       da linija ostane čitljiva. */
    if(last||sel) g+=`<circle cx="${X(i).toFixed(1)}" cy="${Y(x.hrv).toFixed(1)}" r="${sel?5:4.2}" fill="${sel?'var(--cyan)':'var(--bg)'}" stroke="${sel?'#fff':'var(--cyan)'}" stroke-width="${sel?1:2}"/>`;
    else g+=`<circle cx="${X(i).toFixed(1)}" cy="${Y(x.hrv).toFixed(1)}" r="2.6" fill="var(--cyan)" opacity=".75"/>`;
    g+=chartHit(X(i),Y(x.hrv),'hrv',i);
  });
  g+=`<text x="${L}" y="${B+16}" font-size="9" fill="var(--txt3)">${fmtD(v[0].datum)}</text>`;
  g+=`<text x="${W-R}" y="${B+16}" text-anchor="end" font-size="9" fill="var(--txt3)">${fmtD(v[v.length-1].datum)}</text>`;
  g+=`<text x="${W-R}" y="${(Y(v[v.length-1].hrv)-9).toFixed(1)}" text-anchor="end" font-size="11" font-weight="800" fill="var(--cyan)">${esc(fmtNum(v[v.length-1].hrv,1))}</text>`;
  g+=`<text x="${L}" y="${T+2}" font-size="9" fill="var(--txt3)">HRV · isprekidano = tvoja sedmodnevna osnova</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;margin-top:10px">${g}</svg>`;
}

/* ============================================================
   PULS U MIRU — zasebna kartica.

   Bio je jedan od cetiri broja u kartici „Jutros", stisnut izmedju HRV-a,
   sna i svezine. Dva razloga zasto je izdvojen:

   1) Cita se ISTO kao HRV — u odnosu na sopstvenu sedmodnevnu osnovu, jer
      gola brojka ne znaci nista — ali mu je SMER OBRNUT: kod HRV-a je pad
      lose, kod pulsa u miru je RAST lose. U nizu od cetiri broja se ta
      razlika gubila, a boje su izgledale kao da znace isto.

   2) HRV je imao grafikon kroz vreme, puls u miru nije — pa se trend, koji
      je kod njega jednako informativan, uopste nije video.

   ZASTO NE OBRNUTA Y-OSA. Razmatrano pa odbaceno: nizi puls u miru je bolji,
   pa bi „bolje = gore" znacilo obrnuti osu. Ali onda linija koja ide nadole
   znaci poboljsanje, sto je suprotno od HRV grafikona odmah iznad i od svakog
   drugog grafikona u aplikaciji. Smer se umesto toga objasnjava recima ispod
   grafikona, a boja poslednje vrednosti nosi ocenu. */
function karticaPulsUMiru(){
  const niz=oporavakNiz(90).filter(x=>x&&x.pulsUMiru!=null);
  if(!niz.length) return '';                 /* nema zapisa — nema ni kartice */
  const zadnji=niz[niz.length-1];
  const o=oporavakZa(zadnji.datum)||zadnji;
  const brZa=v=>(v==null||!isFinite(+v))?'—':esc(fmtNum(+v,1));
  /* Ista kalibracija koju je red imao u kartici „Jutros": odstupanje je u
     OTKUCAJIMA (ne procentima), a `bojaOdstupanja` je pisana za procente, pa
     se mnozi sa 2 — +2,5 otkucaja daje zutu, +5 crvenu. `obrnuto` obrce smer,
     jer je kod pulsa u miru rast losiji. */
  const boja=o.pulsOdstupanje!=null?bojaOdstupanja(o.pulsOdstupanje*2, true):'var(--txt)';
  const cel=(lbl,val,sub,bj)=>`<div class="ob-vp" style="flex:1">
      <i>${esc(lbl)}</i><b style="color:${esc(bj||'var(--txt)')}">${val}</b>
      ${sub?`<small style="display:block;font-size:.62rem;color:var(--txt3);margin-top:2px">${sub}</small>`:''}</div>`;
  const znak=o.pulsOdstupanje!=null?(o.pulsOdstupanje>=0?'+':''):'';
  return `<div class="card">
    ${dGlava('Puls u miru', esc(fmtD(o.datum)))}
    <div class="ob-vpaces" style="display:flex;gap:8px">
      ${cel('Jutros', brZa(o.pulsUMiru), o.pulsOdstupanje!=null?`${znak}${brZa(o.pulsOdstupanje)} od osnove`:'nema osnove još', boja)}
      ${cel('Osnova · 7 dana', o.pulsBaza7!=null?brZa(o.pulsBaza7):'—', o.pulsBaza7!=null?'prosek prethodnih dana':'traži bar 3 dana', null)}
    </div>
    ${chartRhr(niz)}
    <div class="note-src">Kod pulsa u miru je <b>niže bolje</b> — obrnuto od HRV-a. Jedno jutro iznad osnove nije ništa; nekoliko dana zaredom, pogotovo uz pad HRV-a i kratak san, znači da oporavak ne stiže. Porast od 5 i više otkucaja uz osećaj umora je razlog da se dan olakša.</div>
  </div>`;
}

/* Puls u miru kroz vreme — isti oblik kao chartHrv, druga boja i drugo znacenje. */
function chartRhr(niz){
  const v=niz.filter(x=>x&&x.pulsUMiru!=null);
  if(v.length<4) return '<div class="note-src" style="margin-top:10px">Grafikon se crta kad bude bar 4 dana zapisa.</div>';
  const W=340,H=156,L=30,R=8,B=132,T=28;
  const vals=v.map(x=>x.pulsUMiru);
  /* Raspon je namerno siri nego kod HRV-a: puls u miru se krece u uskom
     pojasu (44-48), pa bi tesno skaliranje od dva otkucaja razlike napravilo
     dramaticnu planinu. */
  const lo=Math.min(...vals)-2, hi=Math.max(...vals)+2;
  const X=i=>L+(v.length===1?0:i/(v.length-1)*(W-L-R));
  const Y=y=>B-((y-lo)/Math.max(hi-lo,1))*(B-T);
  const baza=v.map((_,i)=>{ const od=Math.max(0,i-6); const seg=v.slice(od,i+1).map(x=>x.pulsUMiru);
                            return seg.reduce((a,b)=>a+b,0)/seg.length; });
  let g='';
  const sel=CHART_SEL.rhr!=null?v[CHART_SEL.rhr]:null;
  g+=chartTop(L, sel ? `${fmtD(sel.datum)} · puls u miru ${fmtNum(sel.pulsUMiru,0)} · osnova ${fmtNum(baza[CHART_SEL.rhr],1)}${sel.hrv!=null?' · HRV '+fmtNum(sel.hrv,1):''}${sel.sanH!=null?' · san '+fmtNum(sel.sanH,1)+' h':''}` : null);
  g+=`<polyline points="${baza.map((b,i)=>X(i).toFixed(1)+','+Y(b).toFixed(1)).join(' ')}" fill="none" stroke="var(--txt3)" stroke-width="1.4" stroke-dasharray="4 4" opacity=".65"/>`;
  g+=`<polyline class="ln" points="${v.map((x,i)=>X(i).toFixed(1)+','+Y(x.pulsUMiru).toFixed(1)).join(' ')}" fill="none" stroke="var(--pink)" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"/>`;
  v.forEach((x,i)=>{
    const last=i===v.length-1, iz=CHART_SEL.rhr===i;
    if(last||iz) g+=`<circle cx="${X(i).toFixed(1)}" cy="${Y(x.pulsUMiru).toFixed(1)}" r="${iz?5:4.2}" fill="${iz?'var(--pink)':'var(--bg)'}" stroke="${iz?'#fff':'var(--pink)'}" stroke-width="${iz?1:2}"/>`;
    else g+=`<circle cx="${X(i).toFixed(1)}" cy="${Y(x.pulsUMiru).toFixed(1)}" r="2.6" fill="var(--pink)" opacity=".75"/>`;
    g+=chartHit(X(i),Y(x.pulsUMiru),'rhr',i);
  });
  g+=`<text x="${L}" y="${B+16}" font-size="9" fill="var(--txt3)">${fmtD(v[0].datum)}</text>`;
  g+=`<text x="${W-R}" y="${B+16}" text-anchor="end" font-size="9" fill="var(--txt3)">${fmtD(v[v.length-1].datum)}</text>`;
  g+=`<text x="${W-R}" y="${(Y(v[v.length-1].pulsUMiru)-9).toFixed(1)}" text-anchor="end" font-size="11" font-weight="800" fill="var(--pink)">${esc(fmtNum(v[v.length-1].pulsUMiru,0))}</text>`;
  g+=`<text x="${L}" y="${T+2}" font-size="9" fill="var(--txt3)">Puls u miru · isprekidano = tvoja sedmodnevna osnova</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;margin-top:10px">${g}</svg>`;
}
function chartWeeks(){
  const W=340,H=168,L=26,B=146,T=24; /* T/B pomereni za 16px da napravi mesta info-liniji na vrhu */
  /* Širina trake i Y-skala su DINAMIČKE — bile su tvrdo kodovane na 14 nedelja
     i 48 km (mere tvog hardkodovanog plana). Generisan plan ide do 45+ nedelja
     i 90+ km/ned, pa su trake izlazile ~3x van okvira (x do 994 u okviru 320),
     a visine ~2x preko vrha grafikona — ceo Progres grafikon nečitljiv. */
  const nW=Math.max(CUR_PLAN.length,1);
  const gw=(W-L-6)/nW;
  const peakKm=Math.max(...CUR_PLAN.map(w=>Math.max(weekPlanKm(w),weekRealKm(w))),1);
  const max=Math.ceil(peakKm/12)*12; /* zaokruži naviše na višekratnik 12 — mreža ostaje na okruglim brojevima */
  const ticks=[0,max*0.25,max*0.5,max*0.75,max].map(v=>Math.round(v));
  let g='';
  const selW=CHART_SEL.week!=null?CUR_PLAN.find(x=>x.w===CHART_SEL.week):null;
  /* selW može biti null i kad CHART_SEL.week NIJE null — npr. izabrana N30 na
     44-nedeljnom generisanom planu, pa "Vrati na moj plan" (14 nedelja):
     stara selekcija preživi (CHART_SEL je van S), find vrati undefined i
     .w je bacao TypeError → pad celog Progres taba. */
  if(selW){
    g+=`<text class="chart-info" x="${L}" y="14" text-anchor="start">N${selW.w} · plan ${fmtKm(weekPlanKm(selW))} km · urađeno ${fmtKm(weekRealKm(selW))} km</text>`;
  } else {
    if(CHART_SEL.week!=null)CHART_SEL.week=null; /* očisti mrtvu selekciju */
    g+=`<text class="chart-hint" x="${L}" y="14" text-anchor="start">Dodirni nedelju za detalje</text>`;
  }
  ticks.forEach(v=>{const y=B-(v/max)*(B-T);g+=`<line class="gl" x1="${L}" y1="${y}" x2="${W-2}" y2="${y}"/><text class="ax" x="${L-4}" y="${y+3}" text-anchor="end">${v}</text>`;});
  CUR_PLAN.forEach((w,i)=>{
    const x=L+i*gw+2.5,sel=CHART_SEL.week===w.w;
    const ph=(weekPlanKm(w)/max)*(B-T),rh=(weekRealKm(w)/max)*(B-T);
    g+=`<rect x="${x}" y="${B-ph}" width="${gw/2-1.5}" height="${Math.max(ph,1)}" rx="2" fill="${sel?'rgba(255,255,255,.34)':'rgba(255,255,255,.16)'}"/>`;
    if(rh>0)g+=`<rect x="${x+gw/2-0.5}" y="${B-rh}" width="${gw/2-1.5}" height="${Math.max(rh,1)}" rx="2" fill="var(--pink)"${sel?' stroke="#fff" stroke-width=".8"':''}/>`;
    g+=`<text class="ax" x="${x+gw/2-1.5}" y="${B+12}" text-anchor="middle"${sel?' fill="var(--pink)"':''}>${w.w}</text>`;
    /* nevidljiva puna kolona PREKO vidljivih barova — širi, udobniji dodir cilj od uskog 9px bara */
    g+=`<rect x="${x-2.5}" y="${T}" width="${gw-1}" height="${B-T}" fill="transparent" data-wk="${w.w}"/>`;
  });
  return svgW(W,H,g);
}
function chartWeight(){
  const W=340,H=168,L=30,R=8,B=146,T=26; /* T/B pomereni za 16px da napravi mesta info-liniji na vrhu */
  /* Skala i X-osa su DINAMIČKE — bile su tvrdo kodovane na 14 nedelja
     ((i-1)/13) i raspon 74-83 kg (mere tvog plana). Na generisanom planu od
     20+ nedelja tačke su izlazile van okvira (izmereno: N20 -> x=471 u okviru
     širine 340, N44 -> x=1029). Ista klasa greške koja je već ispravljena u
     chartWeeks(), samo je ovaj grafikon tada promašen.
     WT_TARGET je VLASNIKOVA ciljna linija iz Excel plana (82->75,5 kg) — za
     generisan plan ne postoji unet cilj težine, pa se ta linija tamo i ne crta
     umesto da se tuđi cilj prikazuje kao da je korisnikov. */
  const nW=Math.max(CUR_PLAN.length,1);
  const act=S.kg.slice().sort((a,b)=>a.date<b.date?-1:1);
  const tgt=S.genPlan?[]:WT_TARGET;
  const vals=act.map(a=>a.kg).concat(tgt.map(t=>t.kg)).filter(v=>v!=null&&isFinite(v));
  let min,max;
  if(vals.length){
    min=Math.min(...vals); max=Math.max(...vals);
    const pad=Math.max((max-min)*0.15, 1);
    min=Math.floor(min-pad); max=Math.ceil(max+pad);
  } else { min=74; max=83; }
  if(max-min<2)max=min+2;
  /* i se OGRANICAVA na opseg plana. Y je odavno klemovan (Math.max/min u Y
     ispod), ali X nije — pa je unos tezine sa datumom pre pocetka ili posle
     kraja plana (lako se desi: merenje uneto rucno, ili backup iz starijeg
     ciklusa) crtao tacku IZVAN okvira grafikona. Ista klasa greske koja je vec
     ispravljena u chartWeeks() i chartPred(), samo je ovaj grafikon promasen. */
  const X=i=>{ const k=Math.max(1,Math.min(nW,i)); return L+(nW<=1?0:(k-1)/(nW-1))*(W-L-R); };
  const Y=v=>B-(Math.max(min,Math.min(max,v))-min)/(max-min)*(B-T);
  let g='';
  let natpis=null;
  if(CHART_SEL.wt!=null && act[CHART_SEL.wt]){
    const a=act[CHART_SEL.wt], wIdx=Math.round(1+diffD(CUR_START,a.date)/7);
    const t=tgt.find(x=>x.w===wIdx);
    natpis=`${fmtD(a.date)} · N${wIdx}${t?' · plan '+fmtNum(t.kg,1)+' kg':''} · uneto ${fmtNum(a.kg,1)} kg`;
  }
  g+=chartTop(L,natpis);
  /* 5 ravnomerno raspoređenih linija/oznaka umesto fiksnih [75..83] i [N1..N14] */
  for(let k=0;k<5;k++){
    const v=min+(max-min)*k/4;
    g+=`<line class="gl" x1="${L}" y1="${Y(v).toFixed(1)}" x2="${W-R}" y2="${Y(v).toFixed(1)}"/><text class="ax" x="${L-4}" y="${(Y(v)+3).toFixed(1)}" text-anchor="end">${fmtNum(v,1)}</text>`;
  }
  const wkTicks=[...new Set([1,Math.round(nW*0.25),Math.round(nW*0.5),Math.round(nW*0.75),nW].map(i=>Math.max(1,Math.min(nW,i))))];
  wkTicks.forEach(i=>{g+=`<text class="ax" x="${X(i).toFixed(1)}" y="${B+12}" text-anchor="middle">N${i}</text>`;});
  if(tgt.length)g+=`<polyline fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.5" stroke-dasharray="4 4" points="${tgt.map(t=>X(t.w).toFixed(1)+','+Y(t.kg).toFixed(1)).join(' ')}"/>`;
  if(act.length){
    const pts=act.map(a=>({x:X(1+diffD(CUR_START,a.date)/7),y:Y(a.kg)}));
    if(pts.length>1){
      g+=`<defs><linearGradient id="wtGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--pink)" stop-opacity=".32"/>
            <stop offset="100%" stop-color="var(--pink)" stop-opacity="0"/>
          </linearGradient></defs>`;
      const line=pts.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
      const area=`${pts[0].x.toFixed(1)},${B} ${line} ${pts[pts.length-1].x.toFixed(1)},${B}`;
      g+=`<polygon points="${area}" fill="url(#wtGrad)"/>`;
      g+=`<polyline class="ln" fill="none" stroke="var(--pink)" stroke-width="2.25" stroke-linejoin="round" points="${line}"/>`;
    }
    pts.forEach((p,i)=>{
      const sel=CHART_SEL.wt===i;
      g+=`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${sel?4.8:3.4}" fill="var(--pink)"${sel?' stroke="#fff" stroke-width="1"':''}/>`;
      g+=chartHit(p.x,p.y,'wt',i);
    });
  }
  if(tgt.length)g+=`<text class="ax" x="${W-R}" y="${T-4}" text-anchor="end">isprekidano = cilj ${fmtNum(tgt[0].kg,1)}→${fmtNum(tgt[tgt.length-1].kg,1)}</text>`;
  return svgW(W,H,g);
}
function chartTempo(){
  const runs=[];
  CUR_PLAN.forEach(w=>w.days.forEach(d=>{
    const l=S.log[d.id];
    if(l&&l.status==='done'&&l.km>0&&l.sec>0)runs.push({date:l.ts||d.date||'',t:l.sec/l.km,km:l.km,sec:l.sec,kind:sessKind(d)});
  }));
  runs.sort((a,b)=>a.date<b.date?-1:1);
  if(!runs.length)return `<div class="empty">Unesi distancu i vreme na treninzima — trend se crta automatski.</div>`;
  /* H/B/T pomereni za 16 px u odnosu na raniju verziju — mesto za natpis sa
     detaljima izabrane tačke, isto kao na Telesnoj masi. */
  const W=340,H=168,L=38,R=10,B=144,T=28;
  let lo=Math.min(...runs.map(r=>r.t))-15,hi=Math.max(...runs.map(r=>r.t))+15;
  if(hi-lo<50){const m=(hi+lo)/2;lo=m-25;hi=m+25;}
  const X=i=>runs.length>1?L+i/(runs.length-1)*(W-L-R):L+(W-L-R)/2;
  const Y=v=>T+(v-lo)/(hi-lo)*(B-T);
  let g='';
  const selT=CHART_SEL.tempo!=null?runs[CHART_SEL.tempo]:null;
  g+=chartTop(L, selT ? `${selT.date?fmtD(selT.date):''} · ${selT.kind?selT.kind+' · ':''}${fmtTempo(selT.t)}/km · ${fmtKm(selT.km)} km · ${fmtClock(selT.sec)}` : null);
  [lo+(hi-lo)*.12,(lo+hi)/2,hi-(hi-lo)*.12].forEach(v=>{g+=`<line class="gl" x1="${L}" y1="${Y(v).toFixed(1)}" x2="${W-R}" y2="${Y(v).toFixed(1)}"/><text class="ax" x="${L-4}" y="${(Y(v)+3).toFixed(1)}" text-anchor="end">${fmtTempo(v)}</text>`;});
  if(runs.length>1){
    g+=`<defs><linearGradient id="tempoGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--cyan)" stop-opacity=".3"/>
          <stop offset="100%" stop-color="var(--cyan)" stop-opacity="0"/>
        </linearGradient></defs>`;
    const line=runs.map((r,i)=>X(i).toFixed(1)+','+Y(r.t).toFixed(1)).join(' ');
    const area=`${X(0).toFixed(1)},${B} ${line} ${X(runs.length-1).toFixed(1)},${B}`;
    g+=`<polygon points="${area}" fill="url(#tempoGrad)"/>`;
    g+=`<polyline class="ln" fill="none" stroke="var(--cyan)" stroke-width="2.25" stroke-linejoin="round" points="${line}"/>`;
  }
  runs.forEach((r,i)=>{
    const last=i===runs.length-1, sel=CHART_SEL.tempo===i;
    g+=`<circle cx="${X(i).toFixed(1)}" cy="${Y(r.t).toFixed(1)}" r="${sel?5:(last?4.2:3.2)}" fill="${last&&!sel?'var(--bg)':'var(--cyan)'}" stroke="${sel?'#fff':(last?'var(--cyan)':'none')}" stroke-width="${sel?1:2}"/>`;
    g+=chartHit(X(i),Y(r.t),'tempo',i);
  });
  g+=`<text class="ax" x="${W-R}" y="${B+12}" text-anchor="end">gore = brže</text>`;
  return svgW(W,H,g);
}

/* ---------- KOLENO ---------- */
/* ============ MAPA TELA (Povrede) ============ */
const BODY_PARTS={
  'glava':'Glava','vrat':'Vrat','grudi':'Grudi','trbuh':'Trbuh','prepone':'Prepone',
  'gornja-ledja':'Gornja leđa','donja-ledja':'Donja leđa',
  'rame-L':'Levo rame','rame-D':'Desno rame',
  'nadlaktica-L':'Leva nadlaktica','nadlaktica-D':'Desna nadlaktica',
  'podlaktica-L':'Leva podlaktica','podlaktica-D':'Desna podlaktica',
  'saka-L':'Leva šaka','saka-D':'Desna šaka',
  'kuk-L':'Levi kuk','kuk-D':'Desni kuk',
  'gluteus-L':'Levi gluteus','gluteus-D':'Desni gluteus',
  'kvadriceps-L':'Levi kvadriceps','kvadriceps-D':'Desni kvadriceps',
  'zadnja-loza-L':'Leva zadnja loža','zadnja-loza-D':'Desna zadnja loža',
  'koleno-L':'Levo koleno','koleno-D':'Desno koleno',
  'potkolenica-L':'Leva potkolenica','potkolenica-D':'Desna potkolenica',
  'list-L':'Levi list','list-D':'Desni list',
  'ahilova-L':'Leva Ahilova','ahilova-D':'Desna Ahilova',
  'stopalo-L':'Levo stopalo','stopalo-D':'Desno stopalo',
  'peta-L':'Leva peta','peta-D':'Desna peta'
};
function partName(p){ return p&&BODY_PARTS[p]?BODY_PARTS[p]:(p?p:'Opšte'); }
/* Najnoviji nivo bola za deo tela u poslednjih `days` dana (null ako nema unosa). */
function partLevel(part,days){
  days=days||14;
  const from=addD(TODAY,-days);
  const es=(S.knee||[]).filter(k=>k.part===part&&k.date>=from&&k.date<=TODAY)
                       .sort((a,b)=>a.date<b.date?1:-1);
  return es.length?es[0].pain:null;
}
function painClass(v){ return v==null?'':v>=6?'l3':v>=3?'l2':v>=1?'l1':'l0'; }
/* SVG silueta — delovi definisani za LEVU stranu ekrana (x<100), desna se ogleda.
   Prednji pogled: leva strana ekrana = DESNA strana tela (kao u ogledalu naopako —
   gledaš osobu spreda). Zadnji pogled: leva strana ekrana = LEVA strana tela. */
/* ===== SILUETA (v64) — anatomske proporcije, Bezier krive =====
   Orijentiri (y): 6 teme · 66 vilica · 87 linija ramena · 104 pazuh · 158 dno
   grudi · 188 struk (najuže) · 200 karlica · 250 međunožje · 337 vrh kolena
   · 367 dno kolena · 433 skočni zglob · 459 stopalo.
   Provereno merenjem: 7,50 glava visine (ljudski raspon 7,5–8), ramena 2,11
   širine glave (atletski ~2), ramena su NAJŠIRA tačka figure, ruke se sužavaju
   ka telu nadole, struk uži od grudi (51 vs 68 jedinica), stopala se ne
   preklapaju u sredini (zazor 8,4). Delovi se definišu za LEVU stranu ekrana
   (x<100) i ogledaju — zato jedan opis pokriva oba ekstremiteta. */
const BODY_HEAD=`M100,6 C113,6 124.5,17 125,33 C125.5,45 121.5,56 114,62
  C110,65 105,66.5 100,66.5 C95,66.5 90,65 86,62 C78.5,56 74.5,45 75,33
  C75.5,17 87,6 100,6 Z`;
const BODY_NECK=`M90,59 C90,69 89,75 85.5,81 C83.5,84 82,86 81,87.5
  L119,87.5 C118,86 116.5,84 114.5,81 C111,75 110,69 110,59
  C107,64 103.5,66 100,66 C96.5,66 93,64 90,59 Z`;
const BODY_F_CHEST=`M81,87.5 C74,89.5 69,95.5 67,104.5 C65,118 65,140 68,158
  C80,163 120,163 132,158 C135,140 135,118 133,104.5
  C131,95.5 126,89.5 119,87.5 C112,91.5 88,91.5 81,87.5 Z`;
const BODY_F_ABS=`M68,158 C69.5,168 73,178 74,186 C74.2,192 73,197 72,200
  L128,200 C127,197 125.8,192 126,186 C127,178 130.5,168 132,158
  C120,163 80,163 68,158 Z`;
const BODY_B_UP=`M81,87.5 C74,89.5 69,95.5 67,104.5 C65,120 65,144 68,162
  C80,167 120,167 132,162 C135,144 135,120 133,104.5
  C131,95.5 126,89.5 119,87.5 C112,91.5 88,91.5 81,87.5 Z`;
const BODY_B_LO=`M68,162 C69.5,171 73,180 74,188 C74.2,193 73,198 72,200
  L128,200 C127,198 125.8,193 126,188 C127,180 130.5,171 132,162
  C120,167 80,167 68,162 Z`;
const BODY_F_GROIN=`M87,200 L113,200 L113,250 C109,253 105,255 100,255.5
  C95,255 91,253 87,250 Z`;
const BODY_DELT=`M81,87.5 C71,88.5 60.5,93 53.5,102 C48.5,109 46.5,118 47.5,127
  C48,133 49,138 50.5,142 L66,136 C64.5,124 64.5,112 67,104.5 C69,95.5 74,89.5 81,87.5 Z`;
const BODY_UPARM=`M50.5,142 C49,157 49,174 50.5,189 C51,194 51.8,197 52.5,199
  C56.5,201.5 61.5,201.5 64.5,199 C64.5,192 64,180 65,166 C65.5,154 65.8,144 66,136 Z`;
const BODY_FOARM=`M52.5,199 C51,213 51,228 52.5,241 C53,246 53.8,249 54.5,251
  C57.5,253 61,253 63,251 C63.5,246 64,238 64.2,228 C64.4,214 64.4,205 64.5,199
  C61.5,201.5 56.5,201.5 52.5,199 Z`;
const BODY_HAND=`M54.5,251 C53,259 52.5,268 53,276 C53.5,282 56,285.5 60,286
  C63.5,286 65.5,283 66,277 C66.5,270 66,262 65,255 C64.6,253 64,252 63,251
  C61,253 57.5,253 54.5,251 Z`;
const BODY_HIP=`M72,200 C71,210 71.5,222 74,232 C76.5,241 80,247 84.5,250 L87,250 L87,200 Z`;
/* U ZADNJEM pogledu prepone nisu vidljive — gluteusi pokrivaju celu karlicu,
   pa se šire do sredine (2 jedinice zazora u sredini = prirodan žleb). */
const BODY_GLUTE=`M72,200 C69.5,212 69,226 72,238 C76,248 84,254.5 92,255.5
  C95,255.8 97,255.5 99,254.5 L99,200 Z`;
const BODY_QUAD=`M74,252 C70,265 68.5,282 70,302 C71,318 73,329 75.5,337
  L97,337 C98.5,320 99,298 98,276 C97.5,264 97,254 97,249 C91,253 80,253 74,252 Z`;
const BODY_HAM=`M74,250 C70,264 68.5,284 70,304 C71,319 73,330 75.5,337
  L97,337 C98.5,321 99,299 98,277 C97.5,265 97,255 97,251 C91,255 80,255 74,250 Z`;
const BODY_KNEE=`M75.5,337 C74.5,346 74.5,357 76,367 L96.5,367 C97.5,357 97.5,346 97,337 Z`;
const BODY_SHIN=`M76,367 C74,382 73,400 74.5,418 C75.5,427 77,433 78.5,437
  L95,437 C96,428 96.5,414 96.5,396 C96.5,382 96.5,373 96.5,367 Z`;
const BODY_CALF=`M76,367 C72,381 70.5,396 72,409 C73,417 75,422 77.5,425
  L94.5,425 C96,419 96.5,408 96.5,394 C96.5,381 96.5,373 96.5,367 Z`;
const BODY_ACHIL=`M77.5,421 L94.5,421 C94.5,428 94.5,434 94,438 L79.5,438
  C78.5,432 78,426 77.5,421 Z`;
const BODY_FOOT=`M77,433 L95.5,433 C96.2,441 95.8,450 94,455
  C90.5,459.5 81.5,460.5 75,458.5 C70.8,457 69,453.5 69.6,448.5 C70.6,441.5 73.2,436 77,433 Z`;
const BODY_HEEL=`M78,430 L94,430 C94.2,438 93.6,447 92,452 C89,457 82,457.8 77,455
  C74,453 73,449 74,444 C75,437 76.6,432.4 78,430 Z`;
function bodyMapSVG(view){
  const MIR='transform="translate(200,0) scale(-1,1)"';
  const P=(id,d)=>{
    const lv=partLevel(id), c=painClass(lv);
    return `<path class="bp ${c}" data-bp="${id}" d="${d}"><title>${esc(partName(id))}${lv!=null?' — bol '+lv:''}</title></path>`;
  };
  let g=P('glava',BODY_HEAD)+P('vrat',BODY_NECK);
  const arm=s=>P('rame-'+s,BODY_DELT)+P('nadlaktica-'+s,BODY_UPARM)
    +P('podlaktica-'+s,BODY_FOARM)+P('saka-'+s,BODY_HAND);
  if(view==='front'){
    g+=P('grudi',BODY_F_CHEST)+P('trbuh',BODY_F_ABS)+P('prepone',BODY_F_GROIN);
    const leg=s=>P('kuk-'+s,BODY_HIP)+P('kvadriceps-'+s,BODY_QUAD)
      +P('koleno-'+s,BODY_KNEE)+P('potkolenica-'+s,BODY_SHIN)+P('stopalo-'+s,BODY_FOOT);
    /* prednji pogled: leva strana ekrana = DESNA strana tela */
    g+=arm('D')+leg('D')+`<g ${MIR}>`+arm('L')+leg('L')+`</g>`;
  }else{
    g+=P('gornja-ledja',BODY_B_UP)+P('donja-ledja',BODY_B_LO);
    const leg=s=>P('gluteus-'+s,BODY_GLUTE)+P('zadnja-loza-'+s,BODY_HAM)
      +P('koleno-'+s,BODY_KNEE)+P('list-'+s,BODY_CALF)
      +P('ahilova-'+s,BODY_ACHIL)+P('peta-'+s,BODY_HEEL);
    /* zadnji pogled: leva strana ekrana = LEVA strana tela */
    g+=arm('L')+leg('L')+`<g ${MIR}>`+arm('D')+leg('D')+`</g>`;
  }
  return `<svg viewBox="0 0 200 470" class="bodymap">${g}</svg>`;
}
/* ============================================================
   TAB OPORAVAK — spojeni Progres i Povrede.

   Zašto spajanje: kad je Plan dobio prstenove sa zbirom celog plana, u
   Progresu su ostale dve kartice koje govore isto što i oni („Tekuća nedelja",
   „Ispunjenost plana") i tri grafikona od kojih dva pripadaju drugim ekranima
   — nedeljna kilometraža uz plan, prosečan tempo uz predikciju. Ono što je
   ostalo (HRV, puls u miru, san, telesna masa) meri istu stvar koju su merile
   i Povrede: da li telo stiže da isprati plan.

   Redosled je po hitnosti, ne po temi: stanje danas, pa signal koji upozorava
   PRE nego što nešto zaboli (opterećenje), pa telo, pa istorija.
   ============================================================ */
/* Skala trake opterećenja ide do 2,0 — granica 1,5, na kojoj rizik naglo
   raste, mora da bude UNUTAR slike, inače se crvena zona nema gde videti. */
const ACWR_SKALA=2;
function acwrPolozaj(v){ return Math.max(0, Math.min(100, v/ACWR_SKALA*100)); }
/* Odnos se piše na TAČNO dve decimale, i kad su nule: „0,80" i „1,30" su
   granice pojasa, pa bi „0,8" pored „1,25" izgledalo kao dve različite mere.
   fmtNum krati repne nule, zato ovde ne može. */
function acwrBroj(v){ return (v==null||!isFinite(v))?'—':v.toFixed(2).replace('.',','); }
function karticaOpterecenja(){
  const a=acwrSada(TODAY);
  if(a.odnos==null){
    return dKarta('Opterećenje','poslednjih 7 dana',
      dRedovi([['akutno · 7 dana', fmtKm(a.ak)+' km']])+
      `<div class="note-src">Odnos se prikazuje kad prođe bar jedna nedelja plana sa unetim trčanjem — hronična osnova je prosek poslednje četiri završene nedelje.</div>`);
  }
  const boja = a.odnos<ACWR_POVRATAK ? 'var(--amber)'
             : a.odnos<=ACWR_MAX     ? 'var(--green)'
             : a.odnos<=1.5          ? 'var(--amber)' : 'var(--red)';
  const rec = a.odnos<ACWR_POVRATAK
    ? `Ispod bezbednog pojasa (${acwrBroj(ACWR_POVRATAK)}–${acwrBroj(ACWR_MAX)}). Ako ovo nije deload nedelja, obim je pao ispod onoga na šta si navikao.`
    : a.odnos<=ACWR_MAX
    ? `U bezbednom pojasu (${acwrBroj(ACWR_POVRATAK)}–${acwrBroj(ACWR_MAX)}) — obim raste onoliko koliko telo stiže da podnese.`
    : a.odnos<=1.5
    ? `Iznad gornje ivice pojasa (${acwrBroj(ACWR_MAX)}). Još nije opasno, ali sledeća nedelja ne bi smela da bude veća od ove.`
    : 'Preko 1,5 — u tom pojasu rizik od povrede naglo raste. Skrati sledeću nedelju.';
  return dKarta('Opterećenje','poslednjih 7 dana',
    `<div class="ac-v" style="color:${boja}">${acwrBroj(a.odnos)}<span>akutno ${fmtKm(a.ak)} km / hronično ${fmtKm(a.hron)} km</span></div>
     <div class="acwr"><i style="left:${acwrPolozaj(a.odnos).toFixed(1)}%"></i></div>
     <div class="acwr-l"><span style="left:0%">0</span><span style="left:${acwrPolozaj(ACWR_POVRATAK)}%">${esc(fmtNum(ACWR_POVRATAK,1))}</span><span style="left:${acwrPolozaj(ACWR_MAX)}%">${esc(fmtNum(ACWR_MAX,1))}</span><span style="left:${acwrPolozaj(1.5)}%">1,5</span><span style="left:100%">${esc(fmtNum(ACWR_SKALA,1))}</span></div>
     ${(function(){
       /* POGLED UNAPRED — vidi komentar uz acwrPlan(). Prikazuje se samo kad
          plan traži OSETNO više nego što se nosi: inače bi svaka nedelja imala
          drugi broj koji ništa ne traži od korisnika. */
       const p = acwrPlan(TODAY);
       if(p.odnos == null || p.odnos <= ACWR_MAX) return '';
       const opasno = p.odnos > 1.5;
       return `<div class="note-src" style="margin-top:10px;color:${opasno?'var(--red)':'var(--amber)'}">
         Plan narednih 7 dana: ${esc(fmtKm(p.pl))} km — odnos bi bio ${esc(acwrBroj(p.odnos))}.
         ${opasno ? 'To je preko 1,5 pre nego što je nedelja počela. Skrati je, ili u tabu Oporavak prihvati predlog ako ga aplikacija nudi.'
                  : 'Iznad gornje ivice pojasa; ako je ovo povratak posle pauze ili povrede, skrati.'}</div>`;
     })()}
     <div class="note-src">${esc(rec)} Odnos poredi kilometražu poslednjih sedam dana sa prosekom poslednje četiri završene nedelje.</div>`);
}
function renderOporavak(){
  const el=$('#pg-opor');
  const ks=kneeStatus(TODAY);
  const list=S.knee.slice().sort((a,b)=>a.date<b.date?1:-1);
  const view=(S.ui&&S.ui.bodyView)==='back'?'back':'front';
  const active=Object.keys(BODY_PARTS).map(p=>({p,lv:partLevel(p)})).filter(x=>x.lv!=null&&x.lv>=1).sort((a,b)=>b.lv-a.lv);
  let h=`<div class="kb ${ks.cls}"><div><div>${ks.t}</div><small>${ks.s}</small></div></div>`;
  /* Predlog izmene plana — samo kad stvarno ima sta da promeni. Namerno
     predlog, ne tiha izmena: kod jakog bola app ne sme da glumi da je problem
     resen smanjenjem kilometraze. */
  const prop=injuryProposal(TODAY);
  if(prop){
    h+=`<div class="card" style="border-color:${prop.hitno?'rgba(255,69,58,.35)':'rgba(255,176,32,.3)'}">
      <div class="card-t" style="color:${prop.hitno?'var(--red)':'var(--amber)'}">Plan se može prilagoditi</div>
      <div style="font-size:.85rem;line-height:1.55;color:var(--txt2)">${esc(prop.message)}</div>
      ${prop.changes.length ? `<div class="note-src" style="margin-top:10px">Menja se ${prop.changes.length} ${prop.changes.length===1?'trening':'treninga'}: ${esc(prop.changes.slice(0,4).map(x=>fmtD(x.date)+' → '+(x.rw?'Run/walk':tagName(x.to))).join(' · '))}${prop.changes.length>4?' …':''}</div>
      <div class="btnrow" style="margin-top:12px"><button class="btn" id="inj-apply">Prilagodi plan</button></div>
      <div class="note-src" style="margin-top:8px">Svaki dan možeš ručno da vratiš u tabu Plan.</div>`
      /* Predlog bez ijedne izmene postoji samo kad je trka u horizontu (v.
         `level:'trka'` u injuryProposal): tu se ništa ne nudi na dugme, jer se
         trka ne menja automatski. Bez ovog uslova bi kartica pisala „Menja se 0
         treninga" i nudila dugme koje ne radi ništa. */
      : `<div class="note-src" style="margin-top:10px">Plan se ovim ne menja — odluku o trci donosiš sam.</div>`}
    </div>`;
  }
  h+=karticaOporavka();
  h+=karticaPulsUMiru();
  h+=karticaOpterecenja();
  /* Mapa, aktivni delovi i grafikon bola su ranije bile TRI kartice o istoj
     stvari. Sada su jedna: dodirneš deo tela, ispod nje piše šta je aktivno, a
     na dnu se vidi kako ide kroz vreme. */
  h+=`<div class="card">${dGlava('Bol','dodirni deo koji te boli')}
    <div class="bodytoggle"><button data-bv="front" class="${view==='front'?'on':''}">Prednja</button><button data-bv="back" class="${view==='back'?'on':''}">Zadnja</button></div>
    <div class="bodywrap">${bodyMapSVG(view)}</div>
    <div class="bodylegend"><span><i class="l0"></i>0</span><span><i class="l1"></i>1–2</span><span><i class="l2"></i>3–5</span><span><i class="l3"></i>6+</span><span style="color:var(--txt3)">· poslednjih 14 dana</span></div>
    ${active.length?`<div class="op-sub">Aktivno · poslednjih 14 dana</div>`+
      active.map(x=>`<button class="krow" data-bp2="${x.p}"><div class="kp ${x.lv>=6?'p2':'p1'}">${x.lv}</div><div class="ki"><div class="kd">${esc(partName(x.p))}</div></div></button>`).join(''):''}
    <div class="op-sub">Kroz vreme · 0–10</div>${chartKnee()}
  </div>`;
  h+=`<div class="btnrow" style="margin:0 0 14px"><button class="btn ghost" id="k-add">+ Dodaj unos bola</button></div>`;
  h+=`<div class="card">${dGlava('Telesna masa','cilj vs. stvarno')}${chartWeight()}</div>`;
  h+=`<div class="card">${dGlava('Istorija bola', list.length?list.length+' '+pl3(list.length,'unos','unosa','unosa'):'')}`+
    (list.length?list.map(k=>`
    <button class="krow" data-k="${esc(k.id)}">
      <div class="kp ${k.pain>=6?'p2':k.pain>=1?'p1':'p0'}">${esc(k.pain)}</div>
      <div class="ki"><div class="kd">${esc(partName(k.part))} <span class="ka">· ${DOW[(s2d(k.date).getDay()+6)%7]} ${fmtD(k.date)} · ${esc(k.act)}${k.src?' · iz treninga':''}</span></div>${k.note?`<div class="kn">${esc(k.note)}</div>`:''}</div>
    </button>`).join(''):`<div class="empty">Nema unosa.</div>`)+`</div>`;
  el.innerHTML=h;
  el.querySelectorAll('[data-bv]').forEach(b=>b.onclick=()=>{S.ui.bodyView=b.dataset.bv;save();renderOporavak();});
  el.querySelectorAll('[data-bp]').forEach(b=>b.onclick=()=>openKneeSheet(null,b.dataset.bp));
  el.querySelectorAll('[data-bp2]').forEach(b=>b.onclick=()=>openKneeSheet(null,b.dataset.bp2));
  vezisTacke(el, renderOporavak);
  const ia=$('#inj-apply');
  if(ia) ia.onclick=()=>{
    const pr=injuryProposal(TODAY);
    if(!pr) return;
    if(!confirm('Prilagoditi plan? Menja se '+pr.changes.length+' treninga. Možeš ih ručno vratiti u tabu Plan.')) return;
    const n=applyInjuryProposal(pr);
    alert(n+' '+(n===1?'trening prilagođen':'treninga prilagođeno')+'.');
    renderOporavak(); renderDanas(); renderPlan();
  };
  $('#k-add').onclick=()=>openKneeSheet(null);
  el.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>openKneeSheet(b.dataset.k));
}
function chartKnee(){
  const es=S.knee.slice().sort((a,b)=>a.date<b.date?-1:1);
  if(!es.length)return `<div class="empty">Nema unosa.</div>`;
  const W=340,H=160,L=22,R=8,B=136,T=26;   /* +16 px za natpis izabrane tačke */
  const d0=es[0].date,d1=es[es.length-1].date>TODAY?es[es.length-1].date:TODAY;
  const span=Math.max(diffD(d0,d1),1);
  const X=d=>L+diffD(d0,d)/span*(W-L-R);
  const Y=v=>B-(v/10)*(B-T);
  let g='';
  const selK=CHART_SEL.knee!=null?es[CHART_SEL.knee]:null;
  g+=chartTop(L, selK ? `${fmtD(selK.date)} · bol ${selK.pain}/10 · ${partName(selK.part)}${selK.act?' · '+selK.act:''}${selK.note?' — '+String(selK.note).slice(0,32):''}` : null);
  [0,5,10].forEach(v=>{g+=`<line class="gl" x1="${L}" y1="${Y(v)}" x2="${W-R}" y2="${Y(v)}"/><text class="ax" x="${L-4}" y="${Y(v)+3}" text-anchor="end">${v}</text>`;});
  g+=`<line x1="${L}" y1="${Y(3)}" x2="${W-R}" y2="${Y(3)}" stroke="rgba(255,176,32,.4)" stroke-dasharray="3 4"/>`;
  g+=`<line x1="${L}" y1="${Y(6)}" x2="${W-R}" y2="${Y(6)}" stroke="rgba(255,69,58,.4)" stroke-dasharray="3 4"/>`;
  if(es.length>1)g+=`<polyline class="ln" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.5" points="${es.map(e=>X(e.date).toFixed(1)+','+Y(e.pain).toFixed(1)).join(' ')}"/>`;
  es.forEach((e,i)=>{
    const sel=CHART_SEL.knee===i;
    g+=`<circle cx="${X(e.date).toFixed(1)}" cy="${Y(e.pain).toFixed(1)}" r="${sel?5.2:3.6}" fill="${e.pain>=6?'var(--red)':e.pain>=1?'var(--amber)':'var(--green)'}"${sel?' stroke="#fff" stroke-width="1"':''}/>`;
    g+=chartHit(X(e.date),Y(e.pain),'knee',i);
  });
  g+=`<text class="ax" x="${L}" y="${B+12}">${fmtD(d0)}</text><text class="ax" x="${W-R}" y="${B+12}" text-anchor="end">${fmtD(d1)}</text>`;
  return svgW(W,H,g);
}
function openKneeSheet(id,presetPart){
  const k=id?S.knee.find(x=>x.id===id):{date:TODAY,act:'Trčanje',pain:0,note:'',part:presetPart||null};
  if(id&&!k)return;
  const acts=['Trčanje','Snaga','Odmor','Drugo'];
  const partOpts=`<option value=""${!k.part?' selected':''}>Opšte (bez dela tela)</option>`+
    Object.keys(BODY_PARTS).map(p=>`<option value="${p}"${k.part===p?' selected':''}>${BODY_PARTS[p]}</option>`).join('');
  openSheet(`
    <div class="sh-t">${id?'Unos — '+esc(partName(k.part)):'Novi unos'+(k.part?' — '+esc(partName(k.part)):'')}</div>
    <div class="sh-s">${k.src?'Vezan za trening — izmena treninga ažurira ovaj unos':'Ručni unos'}</div>
    <div class="f-grid">
      <div class="f-field full"><label for="kf-part">Deo tela</label><select id="kf-part">${partOpts}</select></div>
      <div class="f-field"><label for="kf-date">Datum</label><input type="date" id="kf-date" value="${esc(k.date)}"></div>
      <div class="f-field"><label for="kf-act">Aktivnost</label><select id="kf-act">${acts.map(a=>`<option${a===k.act?' selected':''}>${a}</option>`).join('')}</select></div>
      <div class="f-field full"><label for="kf-pain">Bol (0–10) <span class="range-v" id="kf-pv">${esc(k.pain)}</span></label><input type="range" id="kf-pain" min="0" max="10" step="1" value="${esc(k.pain)}"></div>
      <div class="f-field full"><label for="kf-note">Beleška</label><textarea id="kf-note" placeholder="Gde, kada, kako…">${esc(k.note)}</textarea></div>
    </div>
    <div class="btnrow">${id?`<button class="btn danger" id="kf-del">Obriši unos</button>`:`<button class="btn" id="kf-save">Dodaj</button>`}</div>
    ${id?`<div class="note-src">Izmene se čuvaju automatski.</div>`:''}
  `);
  const sh=$('#sheet');
  sh.querySelector('#kf-pain').oninput=e=>{
    sh.querySelector('#kf-pv').textContent=e.target.value;
    if(id){k.pain=+e.target.value;save();}else{k.pain=+e.target.value;}
  };
  if(id){
    sh.querySelector('#kf-part').onchange=e=>{k.part=e.target.value||null;save();renderOporavak();};
    sh.querySelector('#kf-date').onchange=e=>{if(e.target.value){k.date=e.target.value;S.knee.sort((a,b)=>a.date<b.date?-1:1);save();}};
    sh.querySelector('#kf-act').onchange=e=>{k.act=e.target.value;save();};
    /* isto kao beleška o treningu: kuca se, pa se upis odlaže (v. saveOdlozeno) */
    sh.querySelector('#kf-note').oninput=e=>{k.note=e.target.value;saveOdlozeno();};
    sh.querySelector('#kf-note').onblur=saveOdmah;
    sh.querySelector('#kf-del').onclick=()=>{
      if(!confirm('Obriši ovaj unos?'))return;
      S.knee=S.knee.filter(x=>x.id!==id);save();closeSheet();
    };
  }else{
    sh.querySelector('#kf-save').onclick=()=>{
      S.knee.push({id:'k'+Date.now(),src:null,date:sh.querySelector('#kf-date').value||TODAY,act:sh.querySelector('#kf-act').value,pain:k.pain,note:sh.querySelector('#kf-note').value.trim(),part:sh.querySelector('#kf-part').value||null});
      S.knee.sort((a,b)=>a.date<b.date?-1:1);
      save();closeSheet();renderOporavak();
    };
  }
}

/* ---------- TRKA ---------- */
/* Koliko je od puta „polazna forma → cilj" pređeno. Polazna tačka je vreme
   koje odgovara POČETNOM VDOT-u, ista referenca koju crta i VDOT grafikon —
   inače bi se dva prikaza na istom ekranu merila od različitih nula.
   Vraća i vrednosti van [0,1]: ispod nule znači da je predikcija sporija od
   polazne, i to se na ekranu i kaže umesto da se ćutke svede na nulu. */
function trkaUdeo(sec){
  const goal=goalSecActive();
  if(sec==null||goal==null) return null;
  const base=raceTimeForVdot(baselineVdot(), raceDistActive());
  if(!isFinite(base)||base<=goal) return null;
  return (base-sec)/(base-goal);
}
/* Jedan prsten heroja. Prazan prsten je ovde INFORMACIJA, ne greška: ako je
   zadnja predikcija sporija od polazne, ništa se nije pomerilo i prsten to
   pokazuje bez ijedne reči. */
function trkaPrsten(x, ime){
  const sec=x&&x.pred!=null?x.pred:null;
  const u=trkaUdeo(sec), goal=goalSecActive();
  const stigao=sec!=null&&goal!=null&&sec<=goal;
  const boja = sec==null ? 'rgba(238,240,255,.22)'
             : (stigao||(u!=null&&u>0)) ? 'var(--green)' : 'var(--pink)';
  const pod = sec==null ? 'još nema unosa'
            : stigao    ? 'cilj dostignut'
            : u==null   ? ''
            : u<=0      ? 'iza polazne'
            : Math.round(u*100)+'% do cilja';
  return `<div class="tr-ring">${prstenSVG(u||0, sec!=null?fmtClock(sec):'—', 84, boja, 19)}
    <b>${esc(ime)}</b><span>${esc(pod)}</span></div>`;
}
/* KARTICA TESTA NA 3 KM. Stoji odmah ispod prstenova, iznad VDOT-a: to je
   ULAZ iz kog VDOT najviše i skače, pa je red čitanja „šta sam istrčao →
   koliko sam u formi → šta to znači za trku". */
function t3kKarta(){
  const niz=t3kNiz().slice().reverse();   /* najnoviji gore */
  const zadnji=niz[0]||null;
  const dist=raceDistActive();
  const imeTrke=S.genPlan?((S.genPlan.meta&&S.genPlan.meta.raceName)||'trke'):'5K';
  let telo='';
  if(zadnji){
    const v=t3kVdot(zadnji.sec);
    const tempo=Math.round(zadnji.sec/(T3K_DIST_M/1000));
    telo+=`<button class="t3-now" data-t3k="${esc(zadnji.id)}"><b>${esc(fmtClock(zadnji.sec))}</b><i>${esc(fmtDL(zadnji.date))} · izmeni</i></button>`;
    /* Sve tri vrednosti dolaze IZ OVOG testa, ne iz izglačanog lanca — kartica
       odgovara na „šta ovaj test sam po sebi kaže". Izglačanu formu pokazuju
       prstenovi iznad i VDOT grafikon ispod. */
    telo+=dRedovi([
      ['tempo', esc(fmtTempo(tempo))+' /km'],
      ['VDOT iz testa', esc(fmtNum(v,1))],
      ['predikcija '+esc(imeTrke), esc(fmtClock(Math.round(raceTimeForVdot(v,dist))))]
    ]);
    if(niz.length>1){
      telo+=`<div class="op-sub">Raniji testovi</div>`;
      telo+=niz.slice(1).map(t=>{
        const tv=t3kVdot(t.sec);
        return `<button class="krow" data-t3k="${esc(t.id)}">
          <div class="kp p0">${esc(fmtNum(tv,1))}</div>
          <div class="ki"><div class="kd">${esc(fmtClock(t.sec))} <span class="ka">· ${esc(fmtDL(t.date))} · ${esc(fmtTempo(Math.round(t.sec/(T3K_DIST_M/1000))))}/km</span></div></div>
        </button>`;
      }).join('');
    }
    telo+=`<div class="note-src">Najjači pojedinačan pokazatelj forme koji možeš sam da napraviš: napor od 10–30 minuta je prozor u kom je VDOT formula i izvedena i najtačnija. Zato test pomera formu znatno više nego bilo koji trening.</div>`;
  } else {
    telo+=`<div class="note-src" style="margin:0">Istrči 3 km kao pravu trku — ravna staza, isti uslovi svaki put. Napor od 10–30 minuta je prozor u kom je VDOT formula najtačnija, pa test forme pomera znatno više nego bilo koji trening. Iz njega se računaju i forma i predikcija ${esc(imeTrke)}.</div>`;
  }
  telo+=`<div class="btnrow" style="margin-top:12px"><button class="btn ${zadnji?'ghost':''}" id="t3k-add">${zadnji?'+ Novi test':'Unesi test na 3 km'}</button></div>`;
  return `<div class="card">${dGlava('Test 3 km','najjači signal forme')}${telo}</div>`;
}
function openT3kSheet(id){
  const t=id?(S.t3k||[]).find(x=>x&&x.id===id):null;
  if(id&&!t) return;
  openSheet(`
    <div class="sh-t">${id?'Test 3 km — '+esc(fmtDL(t.date)):'Novi test na 3 km'}</div>
    <div class="sh-s">Vreme na 3000 m, istrčano kao trka</div>
    <div class="f-grid">
      <div class="f-field"><label for="t3-date">Datum</label><input type="date" id="t3-date" value="${esc(id?t.date:TODAY)}"></div>
      <div class="f-field"><label for="t3-time">Vreme</label><input type="text" inputmode="numeric" id="t3-time" placeholder="11:42" value="${id?esc(fmtClock(t.sec)):''}"></div>
    </div>
    <div class="note-src" id="t3-out">Unesi vreme pa se ispod prikaže šta znači.</div>
    <div class="btnrow">${id
      ? `<button class="btn" id="t3-save">Sačuvaj izmenu</button><button class="btn danger" id="t3-del">Obriši test</button>`
      : `<button class="btn" id="t3-save">Sačuvaj</button>`}</div>
    <div class="note-src">Trči kao pravu trku, ali bez pritiska — cilj je tačna procena forme, ne rekord. Isti uslovi (staza, doba dana) daju uporediv rezultat.</div>
  `);
  const sh=$('#sheet');
  const polje=sh.querySelector('#t3-time'), izlaz=sh.querySelector('#t3-out');
  /* Živa provera: čovek mora da vidi šta je uneo PRE nego što sačuva, jer se
     iz ovog jednog broja forma pomera više nego iz bilo čega drugog. */
  /* Ista rečenica na oba mesta — živa provera i dugme ne smeju da kažu
     različito o istom unosu. */
  /* Granice se ČITAJU iz istog pravila po kome se i odlučuje, ne kucaju se
     ponovo u tekst: rečenica koja se raziđe sa proverom je gora od nikakve. */
  const T3K_GRESKA='Vreme za 3 km mora biti između '+fmtClock(T3K_SEC_MIN)+' i '
    +fmtClock(t3kNajsporije())+'. Brže od '+fmtClock(T3K_SEC_MIN)
    +' je preko svetskog rekorda — proveri da nije omaška u kucanju.';
  const osvezi=()=>{
    const sec=parseTimeStr(polje.value);
    if(sec==null||!t3kMoguc(sec)){
      izlaz.textContent=polje.value.trim()
        ? T3K_GRESKA
        : 'Unesi vreme pa se ispod prikaže šta znači.';
      return;
    }
    const v=t3kVdot(sec);
    izlaz.textContent=`Tempo ${fmtTempo(Math.round(sec/3))}/km · VDOT ${fmtNum(v,1)} · predikcija `
      +fmtClock(Math.round(raceTimeForVdot(v,raceDistActive())));
  };
  polje.oninput=osvezi;
  osvezi();
  sh.querySelector('#t3-save').onclick=()=>{
    const sec=parseTimeStr(polje.value);
    const datum=sh.querySelector('#t3-date').value||TODAY;
    if(sec==null||!t3kMoguc(sec)){ alert(T3K_GRESKA); return; }
    if(id){
      t.date=datum; t.sec=Math.round(sec);
      zabeleziT3k(id, t.sec, datum);
      save();
    } else dodajT3k(datum, sec);
    closeSheet(); renderPred();
  };
  const del=sh.querySelector('#t3-del');
  if(del) del.onclick=()=>{
    if(!confirm('Obrisati ovaj test? Forma se preračunava bez njega.')) return;
    obrisiT3k(id); closeSheet(); renderPred();
  };
}
function renderPred(){
  const el=$('#pg-pred');
  const pc=predCalc();
  const goalSecA=goalSecActive(), goalV=goalVdotActive();
  const cv=currentVdot(), bv=baselineVdot();
  const vdotDelta=cv!=null?Math.round((cv-bv)*10)/10:null;
  const vArrow=vdotDelta>0.05?'↑':vdotDelta<-0.05?'↓':'→';
  const vCol=vdotDelta>0.05?'var(--green)':vdotDelta<-0.05?'var(--pink)':'var(--txt)';
  const ciljTekst=S.genPlan?(goalSecA!=null?fmtClock(goalSecA):'—'):CILJ;
  /* HEROJ — dva prstena umesto dve kockice. Kockice su davale dva vremena bez
     merila; prsten svakom od njih daje isto merilo (put od polazne forme do
     cilja), pa se odmah vidi i KOLIKO je od tog puta pređeno. */
  let h=`<div class="card accent tr-hero">
    <div class="tr-rings">${trkaPrsten(pc.last,'zadnja')}${trkaPrsten(pc.best,'najbrža')}</div>
    <div class="tr-cilj"><span>cilj</span><b>${esc(ciljTekst)} · VDOT ${esc(fmtNum(goalV,1))}</b></div>
  </div>`;
  h+=t3kKarta();
  h+=`<div class="card">${dGlava('VDOT kroz vreme', esc(fmtNum(bv,1))+' → '+esc(fmtNum(goalV,1)))}
    <div class="vd-now"><b>${esc(fmtNum(cv!=null?cv:bv,1))}</b><i style="color:${vCol}">${vArrow}${vdotDelta!=null?(vdotDelta>0?' +':' ')+esc(fmtNum(vdotDelta,1)):''}</i></div>
    <div id="vdottrend">${chartVdotTrend()}</div>
    <div class="legend"><span><i style="background:var(--cyan)"></i>cilj ${esc(fmtNum(goalV,1))}</span><span><i style="background:var(--pink)"></i>tvoja forma</span></div>
    <div class="note-src">Početni VDOT${S.genPlan?'':' (PB 20:37)'}: ${esc(fmtNum(bv,1))} · cilj ${esc(ciljTekst)} ≈ VDOT ${esc(fmtNum(goalV,1))}. Forma se računa iz radnog dela kvalitetnih sesija (unosi se u Danas → trening).</div>
    <button type="button" id="trend-go" class="btn-ai" style="margin-top:10px">📈 Objasni trend (AI)</button>
    <div id="trend-out" class="ai-out"></div></div>`;
  /* PRILAGOĐAVANJE PLANA FORMI — stoji odmah ispod VDOT-a, jer je to mesto gde
     čovek i vidi da se broj razišao sa planom. Predlog, ne tiha izmena:
     kartica pokazuje tačno koliko se menja i šta ostaje isto. */
  const vp=vdotPredlog(TODAY);
  if(vp){
    const fm=x=>fmtTempo(x)+'/km';
    h+=`<div class="card" style="border-color:${vp.brzi?'rgba(48,209,88,.35)':'rgba(255,176,32,.3)'}">
      <div class="card-t" style="color:${vp.brzi?'var(--green)':'var(--amber)'}">${esc(vp.title)}</div>
      <div style="font-size:.85rem;line-height:1.55;color:var(--txt2)">${esc(vp.message)}</div>
      <div class="note-src" style="margin-top:10px">${vp.changes.slice(0,3).map(c=>esc(fmtD(c.date)+' '+c.kind+': '+fm(c.staro)+' → '+fm(c.novo))).join(' · ')}${vp.changes.length>3?' …':''}</div>
      <div class="btnrow" style="margin-top:12px"><button class="btn" id="vd-apply">Prilagodi tempo</button></div>
      <div class="note-src" style="margin-top:8px">Ručno izmenjeni i odrađeni treninzi se ne diraju. Sve se vraća jednim dugmetom u Podešavanjima.</div>
    </div>`;
  } else if(Object.values(S.alts||{}).some(a=>a&&a.paceAuto)){
    h+=`<div class="card"><div class="card-t">Tempi su prilagođeni tvojoj formi</div>
      <div style="font-size:.85rem;color:var(--txt2);line-height:1.5">Ciljni tempo preostalih kvalitetnih treninga prati izmereni VDOT, a ne polaznu pretpostavku plana.</div>
      <div class="btnrow" style="margin-top:12px"><button class="btn ghost" id="vd-undo">Vrati planski tempo</button></div>
    </div>`;
  }
  const predRaceName=esc(S.genPlan?((S.genPlan.meta&&S.genPlan.meta.raceName)||'trke'):'5K');
  h+=`<div class="card">${dGlava('Predikcija '+predRaceName+' kroz plan','cilj '+esc(ciljTekst))}<div id="pchart">${chartPred(pc)}</div>
    <div class="legend"><span><i style="background:var(--pink)"></i>ostvareno</span><span><i style="background:rgba(255,255,255,.28)"></i>plan (referenca)</span><span><i style="background:var(--cyan)"></i>cilj</span>${
      pc.testovi&&pc.testovi.length?`<span><i class="romb" style="background:var(--cyan)"></i>test 3 km</span>`:''}</div></div>`;
  /* PROSEČAN TEMPO — došao iz Progresa, i namerno na DNO. Isti lanac se ovde
     čita od sažetog ka sirovom: prstenovi → VDOT → predikcija kroz plan →
     tempo svakog pojedinačnog trčanja. U Progresu je stajao odvojen od svega
     što ga objašnjava, pa se nije imao sa čim uporediti. */
  h+=`<div class="card">${dGlava('Prosečan tempo','odrađena trčanja')}${chartTempo()}</div>`;
  /* Kartica „🎯 Cilj … Predikcija i VDOT se pune iz radnog dela…" je UKLONJENA.
     Ponavljala je cilj koji već stoji kao isprekidana linija na oba grafikona
     iznad nje, a druga rečenica je bila uputstvo — na ekranu koji se otvara
     svaki dan, a uputstvo se pročita jednom. Zauzimala je poslednji ekran
     prostora ne govoreći ništa novo. */
  el.innerHTML=h;
  vezisTacke(el, renderPred);
  const t3a=el.querySelector('#t3k-add');
  if(t3a) t3a.onclick=()=>openT3kSheet(null);
  el.querySelectorAll('[data-t3k]').forEach(b=>b.onclick=()=>openT3kSheet(b.dataset.t3k));
  const vdA=el.querySelector('#vd-apply');
  if(vdA) vdA.onclick=()=>{
    const pr=vdotPredlog(TODAY);
    if(!pr) return;
    if(!confirm('Prilagoditi ciljni tempo tvojoj formi? Menja se '+pr.changes.length+' treninga. Obim ostaje isti, a sve se vraća dugmetom „Vrati planski tempo".')) return;
    const n=primeniVdotPredlog(pr);
    alert(n+' '+(n===1?'trening prilagođen':'treninga prilagođeno')+'.');
    renderPred(); if(ACTIVE==='danas')renderDanas();
  };
  const vdU=el.querySelector('#vd-undo');
  if(vdU) vdU.onclick=()=>{
    const n=ponistiVdotPrilagodjavanje();
    alert(n?('Vraćeno na planski tempo ('+n+').'):'Nema šta da se vrati.');
    renderPred(); if(ACTIVE==='danas')renderDanas();
  };
  const tBtn=el.querySelector('#trend-go');
  if(tBtn){
    tBtn.addEventListener('click',async()=>{
      const out=el.querySelector('#trend-out');
      const sum=trendSummary();
      if(sum.treninzi.length<3){
        out.className='ai-out err';
        out.textContent='Za trend analizu treba bar 3 odrađena treninga. Trenutno: '+sum.treninzi.length+'. Nakupljaj kroz nedelje.';
        return;
      }
      tBtn.disabled=true; tBtn.textContent='Analiziram trend…';
      out.className='ai-out'; out.textContent='';
      try{
        const resp=await fetch('/api/analyze',{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+(await sbToken())},
          body:JSON.stringify({trend:sum, goalCtx: goalCtxText()})
        });
        let data;
        try{ data=await resp.json(); }catch{ out.className='ai-out err'; out.textContent='Server nije vratio ispravan odgovor (HTTP '+resp.status+').'; return; }
        if(!resp.ok){ out.className='ai-out err'; out.textContent='Greška ('+resp.status+'): '+(data.error||'nepoznata')+(data.detail?' — '+data.detail:''); }
        else { out.innerHTML=mdToHtml(data.text); }
      }catch(e){ out.className='ai-out err'; out.textContent='Nema veze sa serverom.'; }
      finally{ tBtn.disabled=false; tBtn.textContent='📈 Objasni trend (AI)'; }
    });
  }
}
/* VDOT trend kroz vreme — crta vdotLog kao liniju. Vidi se raste li forma. */
function chartVdotTrend(){
  const vl=(S.vdotLog||[]).slice().sort((a,b)=>a.ts<b.ts?-1:1);
  if(vl.length<2) return '<div style="color:var(--txt3);font-size:.8rem;padding:12px 0">Trend se prikazuje kad bude bar 2 zabeležene VDOT vrednosti. Nakupljaj kroz treninge.</div>';
  const W=340,H=166,L=32,R=8,B=142,T=26;   /* +16 px za natpis izabrane tačke */
  const vals=vl.map(e=>e.vdot);
  const bv=baselineVdot(), goal=goalVdotActive();
  const lo=Math.min(bv,goal,...vals)-1, hi=Math.max(bv,goal,...vals)+1;
  const X=i=>L+(vl.length===1?0:i/(vl.length-1)*(W-L-R));
  const Y=v=>B-((v-lo)/(hi-lo))*(B-T);
  let g='';
  const selV=CHART_SEL.vdot!=null?vl[CHART_SEL.vdot]:null;
  g+=chartTop(L, selV ? `${selV.ts?fmtD(String(selV.ts).slice(0,10)):''} · VDOT ${fmtNum(selV.vdot,1)}${selV.delta!=null?' ('+(selV.delta>0?'+':'')+fmtNum(selV.delta,1)+')':''}${selV.measured!=null?' · izmereno '+fmtNum(selV.measured,1):''}` : null);
  // horizontalne linije: baseline i cilj
  g+=`<line x1="${L}" y1="${Y(goal).toFixed(1)}" x2="${W-R}" y2="${Y(goal).toFixed(1)}" stroke="var(--cyan)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  g+=`<text x="${W-R}" y="${(Y(goal)-4).toFixed(1)}" text-anchor="end" font-size="9" font-weight="700" fill="var(--cyan)">cilj ${esc(fmtNum(goal,1))}</text>`;
  g+=`<line x1="${L}" y1="${Y(bv).toFixed(1)}" x2="${W-R}" y2="${Y(bv).toFixed(1)}" stroke="var(--txt3)" stroke-width="1" stroke-dasharray="2 3" opacity="0.5"/>`;
  // linija VDOT sa gradijent-ispunom (dosledno sa Predikcija grafikonom)
  const pts=vl.map((e,i)=>[X(i),Y(e.vdot)]);
  const lineStr=pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  g+=`<defs><linearGradient id="vdotGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--pink)" stop-opacity=".38"/>
        <stop offset="55%" stop-color="var(--pink)" stop-opacity=".08"/>
        <stop offset="100%" stop-color="var(--pink)" stop-opacity="0"/>
      </linearGradient></defs>`;
  const area=`${pts[0][0].toFixed(1)},${B} ${lineStr} ${pts[pts.length-1][0].toFixed(1)},${B}`;
  g+=`<polygon points="${area}" fill="url(#vdotGrad)"/>`;
  g+=`<polyline class="ln" points="${lineStr}" fill="none" stroke="var(--pink)" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>`;
  pts.forEach((p,i)=>{
    const last=i===pts.length-1, sel=CHART_SEL.vdot===i;
    g+=`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${sel?5:(last?4.4:3.2)}" fill="${last&&!sel?'var(--bg)':'var(--pink)'}" stroke="${sel?'#fff':(last?'var(--pink)':'none')}" stroke-width="${sel?1:2}"/>`;
    g+=chartHit(p[0],p[1],'vdot',i);
  });
  // labele prve i zadnje vrednosti
  g+=`<text x="${X(0).toFixed(1)}" y="${(Y(vl[0].vdot)-9).toFixed(1)}" font-size="10" font-weight="700" fill="var(--txt2)">${esc(fmtNum(vl[0].vdot,1))}</text>`;
  g+=`<text x="${X(vl.length-1).toFixed(1)}" y="${(Y(vl[vl.length-1].vdot)-9).toFixed(1)}" text-anchor="end" font-size="11" font-weight="800" fill="var(--pink)">${esc(fmtNum(vl[vl.length-1].vdot,1))}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">${g}</svg>`;
}
/* ============================================================
   OPORAVAK — HRV, puls u miru, san (intervals.icu)

   Garminov zvanicni Health API trazi partnerski program i poslovnu proveru,
   pa se ne moze koristiti u licnoj aplikaciji. intervals.icu vec prima Garmin
   sinhronizaciju i izlaze te podatke kroz otvoren API sa obicnim kljucem —
   isti podaci, bez cekanja na odobrenje.

   Ide preko naseg servera (/api/icu) jer intervals.icu ne salje CORS
   zaglavlja, pa bi poziv iz pregledaca bio blokiran.

   Cuva se u S.wellness kao mapa datum -> zapis, da spajanje sa treningom bude
   obicno trazenje po datumu. ============================================================ */
/* Sta se salje serveru kao dokaz veze — OAuth token ako postoji, inace stari
   rucno unet API kljuc. Nikad oba. */
function icuVeza(){ return S.icu&&S.icu.token ? {token:S.icu.token} : {apiKey:(S.icu&&S.icu.apiKey)||''}; }
function icuPovezan(){ return !!(S.icu&&S.icu.athleteId&&(S.icu.token||S.icu.apiKey)); }
async function icuSync(danaUnazad){
  if(!icuPovezan()) return {ok:false, error:'intervals.icu nije povezan.'};
  const do_=new Date(), od=new Date(do_.getTime()-(danaUnazad||60)*864e5);
  const ds=d=>d.toISOString().slice(0,10);
  try{
    const r=await fetch('/api/icu',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+(await sbToken())},
      body:JSON.stringify({sta:'wellness', athleteId:S.icu.athleteId, ...icuVeza(), oldest:ds(od), newest:ds(do_)})});
    let j; try{ j=await r.json(); }catch{ return {ok:false, error:'Server nije vratio ispravan odgovor.'}; }
    if(!r.ok) return {ok:false, error:j.error||('Greška '+r.status)};
    S.wellness=S.wellness||{};
    (j.dani||[]).forEach(z=>{ if(z&&z.datum) S.wellness[z.datum]=z; });
    S.icu.lastSync=Date.now(); save();
    return {ok:true, n:(j.dani||[]).length};
  }catch(e){ return {ok:false, error:'Nema veze sa serverom.'}; }
}

/* ============================================================
   TRENINZI SA intervals.icu — PRIMARAN IZVOR KAD JE POVEZAN

   Strava daje sirove streamove, pa aplikacija sama traži radne deonice
   (`detectWorkSegments`). To radi, ali je sopstvena heuristika. intervals.icu
   je te deonice VEĆ prepoznao, i to nad izvornim fajlom sa sata — po repu daje
   distancu, vreme, puls (prosečan/maks/min), kadencu, GAP i razdvajanje, a
   posebno i oporavke između repova. To je tačno ono što je analizi nedostajalo
   kad je pisala „samo prosek cele sesije".

   REDOSLED IZVORA: intervals.icu ako je povezan, inače Strava. Strava NIJE
   ukinuta ni pogoršana — puno je razumnih ljudi koji intervals.icu nemaju i
   neće da ga prave, i njima sve radi kao pre.
   ============================================================ */
/* Da li ova veza SME da čita treninge. Stari OAuth token je izdat kad je
   aplikacija tražila samo wellness, pa nema opseg za treninge; API ključ ima
   pun pristup, a kod njega `scope` uopšte i ne postoji — zato se odsutan
   `scope` tumači kao „sme", a prisutan bez ACTIVITY kao „ne sme". */
function icuImaTreninge(){
  if(!icuPovezan()) return false;
  const s=S.icu.scope;
  if(typeof s!=='string'||!s) return true;
  return /ACTIVITY/i.test(s);
}
async function icuApi(telo){
  try{
    const r=await fetch('/api/icu',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+(await sbToken())},
      body:JSON.stringify({sta:'activities', athleteId:S.icu.athleteId, ...icuVeza(), ...telo})});
    let j; try{ j=await r.json(); }catch{ return {ok:false, error:'Server nije vratio ispravan odgovor.'}; }
    if(!r.ok) return {ok:false, error:j.error||('Greška '+r.status), status:r.status};
    return {ok:true, ...j};
  }catch(e){ return {ok:false, error:'Nema veze sa serverom.'}; }
}
/* Krugovi sa icu-a u oblik koji aplikacija već koristi (`l.laps` iz
   detectWorkSegments): {distM, paceSec, avgHr, cadence, watts}. Dodaje se ono
   što Strava putanja NEMA — GAP, maks/min puls, razdvajanje po repu i trajanje
   oporavka KOJI SLEDI. Oporavci se ne vode kao krugovi (inače bi „6×800"
   ispalo 11 krugova i prosečan tempo bi bio besmislen), nego se lepe na rep
   ispred sebe, gde i pripadaju po značenju. */
function icuKrugoviULaps(krugovi){
  if(!Array.isArray(krugovi)) return [];
  const out=[];
  krugovi.forEach(k=>{
    if(!k) return;
    if(k.tip==='oporavak'){
      const zadnji=out[out.length-1];
      if(zadnji && k.sec>0){ zadnji.restSec=k.sec; if(k.paceSec) zadnji.restPaceSec=k.paceSec; }
      return;
    }
    if(!(k.distM>0)||!(k.paceSec>0)) return;
    const o={distM:k.distM, paceSec:k.paceSec, avgHr:k.hr??null, cadence:k.kadenca??null, watts:k.watts??null};
    if(k.gapSec!=null) o.gapSec=k.gapSec;
    if(k.maxHr!=null) o.maxHr=k.maxHr;
    if(k.minHr!=null) o.minHr=k.minHr;
    if(k.razdvajanje!=null) o.razdvajanje=k.razdvajanje;
    if(k.oznaka) o.oznaka=String(k.oznaka).slice(0,40);
    out.push(o);
  });
  return out;
}
/* Prosečan tempo RADNOG dela iz krugova — isti račun kao kod Strave
   (ukupno vreme / ukupna distanca, ne prosek prosekâ). */
function icuRadniTempo(laps){
  if(!Array.isArray(laps)||!laps.length) return null;
  const d=laps.reduce((s,x)=>s+(x.distM||0),0);
  const t=laps.reduce((s,x)=>s+(x.paceSec*(x.distM||0)/1000),0);
  return (d>0&&t>0)?Math.round(t/(d/1000)):null;
}
/* JEDNO POVLAČENJE ZA SVE ŠTO intervals.icu NOSI.
   Dva odvojena dugmeta („Povuci oporavak" i „Povuci treninge") bila su podela
   po tome kako je kod pisan, ne po tome šta čovek hoće — a hoće da pritisne
   jednom i da mu sve stigne. Jutarnja merenja i trčanja dolaze sa iste veze,
   pa i idu zajedno.

   Trčanja se preskaču bez greške kad veza nema dozvolu za njih (stariji OAuth
   token): jutarnja merenja i dalje moraju da prođu, a razlog se vraća pozivaocu
   da bi mogao da ga prikaže uz uspeh, a ne umesto njega. */
async function icuSyncSve(danaUnazad, manual){
  const w=await icuSync(danaUnazad||120);
  if(!w.ok) return {ok:false, error:w.error};
  const out={ok:true, zapisa:w.n, trcanja:null, krugova:null, trBez:null};
  if(!icuImaTreninge()){
    out.trBez='Veza nema dozvolu za treninge — otkači pa ponovo poveži.';
    return out;
  }
  const t=await icuSyncTreninzi(Math.min(danaUnazad||60,90), manual);
  if(t.ok){ out.trcanja=t.n; out.krugova=t.detalja; }
  else out.trBez=t.error;
  return out;
}
async function icuSyncTreninzi(danaUnazad, manual){
  if(!icuPovezan()) return {ok:false, error:'intervals.icu nije povezan.'};
  if(!icuImaTreninge()) return {ok:false, error:'Veza sa intervals.icu nema dozvolu za treninge. Otkači pa ponovo poveži — dobićeš i treninge, ne samo jutarnja merenja.'};
  const do_=new Date(), od=new Date(do_.getTime()-(danaUnazad||45)*864e5);
  const ds=d=>d.toISOString().slice(0,10);
  /* Nikad pre početka plana — pre toga ni nema dana na koje bi se zakačilo. */
  const oldest=ds(od)<CUR_START?CUR_START:ds(od);

  const lista=await icuApi({oldest, newest:ds(do_)});
  if(!lista.ok) return lista;
  const treninzi=Array.isArray(lista.treninzi)?lista.treninzi:[];
  if(!treninzi.length){ S.icu.trSync=Date.now(); save(); return {ok:true, n:0, detalja:0}; }

  /* Isti oblik kao Strava (`distance` u metrima), da autoRealign i pickClosest
     rade nepromenjeni — jedan pomeraj plana, jedno pravilo, oba izvora. */
  const byDate={};
  treninzi.forEach(a=>{ if(a&&a.datum&&a.km>0)(byDate[a.datum]=byDate[a.datum]||[]).push({...a, distance:a.km*1000}); });
  autoRealign(byDate);

  let n=0; const trazi=[], tokovi=[];
  for(const date of Object.keys(byDate)){
    const d=BY_DATE[date];
    if(!d||d.rest||d.km==null) continue;
    const a=pickClosest(byDate[date], d.km);
    const l=S.log[d.id]||(S.log[d.id]={});
    l.runDate=date;
    if(!l.lock){                                   /* ručna korekcija ima trajnu prednost */
      l.status='done';
      l.km=a.km; if(a.sec) l.sec=a.sec;
      if(a.hr!=null) l.hr=a.hr;
      l.ts=date; l.src='icu'; l.icuId=a.id;
      if(a.naziv) l.stravaName=String(a.naziv).slice(0,120);
      if(a.opis)  l.stravaDesc=String(a.opis).slice(0,400);
      if(a.maxHr!=null) l.maxHr=a.maxHr;
      if(a.uspon!=null) l.elevGain=a.uspon;
      if(a.kadenca!=null) l.cadence=a.kadenca;
      if(a.temp!=null) l.temp=a.temp;
      /* Ono što Strava putanja uopšte nema, a icu izračuna sam. */
      const ic={};
      ['gapSec','razdvajanje','efikasnost','opterecenje','intenzitet','trimp','korak','osecaSe','zonePuls','zoneTempo']
        .forEach(k=>{ if(a[k]!=null) ic[k]=a[k]; });
      if(Object.keys(ic).length) l.icu=ic; else delete l.icu;
      /* icu-ovo razdvajanje je merenje nad celim fajlom — bolje od naše
         procene po kilometru, pa je preuzima. */
      /* Isti oblik koji već čitaju `metrikaSata` i `trendSummary`: {n} je
         procenat pada efikasnosti. icu koristi istu konvenciju (pozitivno =
         puls je odleteo pri istom tempu), pa se broj preuzima kakav jeste. */
      if(a.razdvajanje!=null) l.decoupling={n:a.razdvajanje, izvor:'icu'};
      syncSide(d);
      n++;
    }
    /* Detalji se traže za KVALITETNE dane — tamo je razlika između „6×800:
       3:52/3:54/…" i „prosek 3:55" i cela poenta. Traži se i kad tempo već
       postoji: prikupljanje detalja nema veze sa izvođenjem tempa. */
    /* Ne traži se ponovo ni kad je icu već rekao da strukture NEMA — inače bi
       svako kontinuirano trčanje trošilo poziv pri svakoj sinhronizaciji. */
    if((d.tag==='int'||d.tag==='tempo') && a.id && !String(l.lapsIzvor||'').startsWith('icu'))
      trazi.push({id:a.id, dayId:d.id, d});
    /* KONTINUIRANA TRCANJA (lako/dugo): icu tu NEMA strukturu — `icu_intervals`
       je prazan i to je tacan odgovor. Ali bez po-km preseka nema ni tempa po
       kilometru, ni pulsa po kilometru, ni drifta; AI analiza tada posteno pise
       „samo prosek cele sesije". Dok je Strava bila primarna, taj presek se
       racunao iz njenih streamova (v. grana `d.tag==='lako'||d.tag==='lr'` u
       stravaSync). Kad je icu postao primaran, lagana trcanja su to tiho
       izgubila. Zato se i za njih traze SIROVI tokovi, pa se obradjuju istom
       funkcijom (`perKmDetail`) kao i Stravini. */
    if((d.tag==='lako'||d.tag==='lr') && a.id && !l.lock
       && !(Array.isArray(l.perKm) && l.perKm.length && (l.perKm[0]||{}).v===PERKM_VER))
      tokovi.push({id:a.id, dayId:d.id, d});
  }

  let detalja=0;
  for(let i=0;i<trazi.length && i<24;i+=12){
    const grupa=trazi.slice(i,i+12);
    const r=await icuApi({detalji:grupa.map(x=>x.id)});
    if(!r.ok){ if(manual) return r; break; }
    grupa.forEach(x=>{
      const det=(r.detalji||{})[x.id];
      if(!det||det.greska) return;
      const laps=icuKrugoviULaps(det.krugovi);
      const l=S.log[x.dayId]; if(!l) return;
      if(laps.length){
        l.laps=laps; l.lapsIzvor='icu'; detalja++;
        if(Array.isArray(det.grupe)&&det.grupe.length) l.icuGrupe=det.grupe; else delete l.icuGrupe;
        const rowId=predRowFor(x.d);
        const t=icuRadniTempo(laps);
        if(rowId&&!S.predLock[rowId]&&S.pred[rowId]==null&&t) upisiAutoTempo(rowId,t,l.runDate||x.d.date,x.d);
      } else {
        /* icu nije našao strukturu — kontinuirano trčanje. To je odgovor, ne
           greška; upisuje se da se ne bi tražilo iznova pri svakoj sinhronizaciji. */
        l.lapsIzvor='icu-bez-strukture';
      }
    });
  }

  /* PO-KM PRESEK ZA KONTINUIRANA TRCANJA.
     Tokovi su veliki (jedan sat trcanja je ~3600 tacaka po nizu), pa se trazi
     najvise tri po sinhronizaciji — a i ne trazi se ponovo, jer `perKm` sa
     tekucom verzijom ovu granu iskljucuje. */
  let presek=0;
  for(let i=0;i<tokovi.length && i<3;i+=3){
    const grupa=tokovi.slice(i,i+3);
    const r=await icuApi({tokovi:grupa.map(x=>x.id)});
    if(!r.ok){ if(manual) return r; break; }
    grupa.forEach(x=>{
      const t=(r.tokovi||{})[x.id];
      if(!t||t.greska) return;
      const l=S.log[x.dayId]; if(!l) return;
      const perKm=perKmDetail(t);
      if(!perKm.length) return;
      l.perKm=perKm; presek++;
      /* icu-ovo `razdvajanje` iz spiska ima prednost — ono je merenje nad celim
         fajlom. Kad ga nema (a za lagana trcanja ga cesto nema), racuna se iz
         po-km preseka, isto kao na Stravinoj putanji. */
      if(!(l.icu&&l.icu.razdvajanje!=null)){
        const dek=decouplingPerKm(perKm);
        if(dek) l.decoupling=dek; else delete l.decoupling;
      }
      /* Analiza nastala nad golim prosekom vise ne vazi kad stignu podaci po
         kilometru — brojac se oslobadja, kao i na Stravinoj putanji. */
      delete l.aiCount;
    });
  }

  S.icu.trSync=Date.now(); save();
  fixVdotDates();
  return {ok:true, n, detalja, presek};
}

/* ============================================================
   POVEZIVANJE SA intervals.icu PREKO OAuth-a

   Stari nacin (ID sportiste + API kljuc, rucno prepisan iz njihovih
   podesavanja) OSTAJE i radi — ko ga vec koristi ne mora nista da menja.
   OAuth je dodatak: jedan klik, bez prepisivanja ikakvih kljuceva.

   `client_secret` nikad ne ulazi u pregledac; razmenu koda radi server
   (/api/icu-oauth). I sama adresa za autorizaciju se gradi na serveru, pa
   `client_id` i spisak opsega stoje samo u Vercel promenljivama.

   Token se cuva ISKLJUCIVO na uredjaju, isto kao Strava tokeni i stari API
   kljuc — v. sbPayload(). ============================================ */
const ICU_STATE_KEY='sub19-icu-state';
function icuMakeState(){
  const st=secureRandomToken();
  try{ localStorage.setItem(ICU_STATE_KEY, JSON.stringify({st,exp:Date.now()+600000})); }catch(e){}
  return st;
}
function icuCheckState(got){
  let saved=null;
  try{ saved=JSON.parse(localStorage.getItem(ICU_STATE_KEY)||'null'); }catch(e){}
  try{ localStorage.removeItem(ICU_STATE_KEY); }catch(e){}
  if(!saved||!saved.st) return false;
  if(Date.now()>saved.exp) return false;
  return got===saved.st;
}
async function icuConnect(){
  const tok=await sbToken();
  if(!tok){ alert('Moraš biti prijavljen da bi povezao intervals.icu.'); return; }
  try{
    const r=await fetch('/api/icu-oauth?akcija=url&state='+encodeURIComponent(icuMakeState()),
                        {headers:{'Authorization':'Bearer '+tok}});
    const j=await r.json();
    if(!r.ok||!j.url){ alert(j.error||'Povezivanje trenutno nije moguće.'); return; }
    location.href=j.url;
  }catch(e){ alert('Nema veze sa serverom.'); }
}
/* Povratak sa intervals.icu — poziva se iz handleOAuthReturn. */
async function icuFinish(code){
  const tok=await sbToken();
  if(!tok){ alert('Moraš biti prijavljen da bi povezao intervals.icu.'); return; }
  try{
    const r=await fetch('/api/icu-oauth',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
      body:JSON.stringify({code})});
    const j=await r.json();
    if(!r.ok){ alert(j.error||'Povezivanje nije uspelo.'); return; }
    S.icu={athleteId:j.athleteId, token:j.token, scope:j.scope||'', lastSync:null};
    save();
    const s2=await icuSync(120);   /* odmah povuci istoriju, da kartice ne budu prazne */
    alert(s2.ok?('intervals.icu povezan. Povučeno zapisa: '+s2.n+'.'):'intervals.icu povezan.');
    renderHeader(); if(ACTIVE==='opor') PAGES.opor();
  }catch(e){ alert('Nema veze sa serverom.'); }
}
/* AUTOMATSKO POVLACENJE — jednom dnevno, pri prvom otvaranju.
   Garmin salje jutarnja merenja na intervals.icu tokom noci, pa su podaci za
   danas spremni pre nego sto se aplikacija uopste otvori; nema razloga da
   korisnik pritiska "Povuci sve" da bi video sopstveni HRV.
   Ide 14 dana unazad, ne samo danas: sat zna da dopuni ili ispravi merenje
   unazad (san se zatvori tek posle sinhronizacije sata), a telefon je mogao
   biti bez signala nekoliko dana. Preklapanje ne smeta — zapisi se upisuju
   po datumu, pa se isti dan samo prepise istom vrednoscu. */
let icuAutoUToku=false;
async function icuAutoSync(){
  if(icuAutoUToku) return;                                   /* vec radi */
  if(!icuPovezan()) return;                                  /* nije povezan */
  if(!sbAuthed()||!navigator.onLine) return;
  const dan=todayStr();                                      /* svez datum — app ume da stoji otvorena preko ponoci */
  if(S.icu.autoDan===dan) return;                            /* danas je vec povuceno */
  icuAutoUToku=true;
  let r=null;
  try{ r=await icuSync(14); }catch(e){}
  icuAutoUToku=false;
  /* Dan se pamti SAMO na uspeh. Da se upise unapred, jedan neuspeo poziv
     (avionski rezim ujutru) bi ostavio korisnika bez podataka ceo dan. */
  if(r&&r.ok){ S.icu.autoDan=dan; save(); if(ACTIVE==='opor') PAGES.opor(); }
}
/* Zapis oporavka za dati dan, sa 7-dnevnim prosekom HRV-a i pulsa u miru —
   pojedinacna vrednost HRV-a ne znaci nista bez svoje osnove. */
function oporavakZa(datum){
  if(!S.wellness||!datum) return null;
  const z=S.wellness[datum]; if(!z) return null;
  const kljucevi=Object.keys(S.wellness).filter(k=>k<datum).sort().slice(-7);
  const sr=(polje)=>{ const v=kljucevi.map(k=>S.wellness[k]&&S.wellness[k][polje]).filter(x=>x!=null);
                      return v.length>=3 ? Math.round(v.reduce((a,b)=>a+b,0)/v.length*10)/10 : null; };
  const out={...z};
  const hBaza=sr('hrv'), pBaza=sr('pulsUMiru');
  if(hBaza!=null && z.hrv!=null){ out.hrvBaza7=hBaza; out.hrvOdstupanje=Math.round((z.hrv-hBaza)/hBaza*1000)/10; }
  if(pBaza!=null && z.pulsUMiru!=null){ out.pulsBaza7=pBaza; out.pulsOdstupanje=Math.round((z.pulsUMiru-pBaza)*10)/10; }
  return out;
}
/* ============================================================
   SLANJE TRENINGA NA SAT (intervals.icu -> Garmin Connect -> sat)

   intervals.icu ima sopstvenu tekstualnu sintaksu za strukturu treninga.
   Vazne zamke koje su ovde vec ugradjene:
     - `m` znaci MINUTE, ne metre. Metri se pisu kao `500mtr`.
     - Apsolutan tempo se pise kao `4:11/km Pace`.
     - Blok ponavljanja se uvodi zaglavljem `Glavni deo 5x`, uz prazan red
       pre i posle bloka.
   Da bi trening stigao DO SATA, korisnik u intervals.icu Settings mora da
   ukljuci "Upload planned workouts" i autorizuje Garmin Connect. Bez toga
   trening ostaje u intervals.icu kalendaru.
   ============================================================ */
function icuTempo(sec, sec2){
  if(!(sec>0)) return null;
  const f=x=>Math.floor(x/60)+':'+String(Math.round(x%60)).padStart(2,'0');
  /* intervals.icu podrzava opseg. Plan ponegde zadaje opseg umesto jedne
     vrednosti — bolje ga preneti nego zaokruziti na jedan broj i time
     promeniti nameru treninga.
     REDOSLED: SPORIJI PA BRZI ("7:15-7:00/km Pace"), tako stoji u njihovom
     vodicu; jedinica se pise samo jednom, na kraju. */
  return (sec2>0 && sec2!==sec) ? f(Math.max(sec,sec2))+'-'+f(Math.min(sec,sec2))+'/km Pace'
                                : f(sec)+'/km Pace';
}
function icuTrajanje(sec){
  if(!(sec>0)) return '1m';
  if(sec%60===0) return (sec/60)+'m';
  return sec<90 ? sec+'s' : Math.round(sec/60)+'m';
}
function icuRazdaljina(km){
  if(!(km>0)) return null;
  return km<1 ? Math.round(km*1000)+'mtr' : (Math.round(km*100)/100)+'km';
}
/* OPORAVAK IZMEDJU DEONICA — na sat NE SME da ide lagan (E) tempo.
   Pauza je ili hod ili lagano kaskanje, a ni jedno se ne trci na E tempu
   (npr. 5:20/km): sat bi kroz celu pauzu pikao "ubrzaj", a poenta pauze je
   suprotna.

   ZASTO PAUZA IPAK NOSI BROJ: u njihovoj sintaksi svaki korak mora imati
   cilj — korak sa samim vremenom se ne prepozna i ume da obori strukturu
   CELOG treninga. Zato hod ne dobija "nikakav" tempo nego POSTEN tempo hoda
   (9:00–13:00/km): sat kroz pauzu cuti jer hod upada u taj opseg, a nigde ne
   stoji broj kojim bi te terao da trcis.

   Ko dobija sta, odlucuje ISTI spisak (RECOVERY_JOG) koji pise i opis
   treninga, pa tekst plana i korak na satu ne mogu da se raziđu. */
/* Sirina lagane (Z2) zone: od E tempa pa 40 s/km sporije. Pri VDOT 48 to je
   5:17–5:57/km, sto se poklapa sa rasponom u kom se lagano i trci u praksi. */
const ICU_LAGAN_RASPON=40;
const ICU_KASKANJE_OD=390, ICU_KASKANJE_DO=450;   /* 6:30–7:30/km — lagano kaskanje */
const ICU_HOD_OD=540,      ICU_HOD_DO=780;        /* 9:00–13:00/km — hod */
function icuOporavak(kind, restSec, kaskanje){
  const jog = kaskanje || RECOVERY_JOG.includes(kind);
  return jog ? '- Oporavak kaskanje '+icuTrajanje(restSec)+' '+icuTempo(ICU_KASKANJE_OD,ICU_KASKANJE_DO)
             : '- Pauza hod '     +icuTrajanje(restSec)+' '+icuTempo(ICU_HOD_OD,ICU_HOD_DO);
}
/* Pretvara JEDAN dan plana u intervals.icu tekst. Vraca null za dane koje nema
   smisla slati (odmor, snaga, sam dan trke). */
/* STRUKTURA IZ OPISA — za planove koji nemaju `session` objekat.
   Tvoj licni (hardkodovan) plan cuva trening kao TEKST, ne kao objekat, pa je
   prva verzija sve takve dane slala kao obicno trcanje na Z2: intervali su
   gubili strukturu, a lagani dani su dobijali tempo pokupljen sa tempo dana
   iste nedelje (dugo trcanje od 12 km na 4:25/km — brze nego sto treba).
   Ovde se opis rasclanjuje u istu strukturu koju generator inace daje, pa
   dalje sve ide istim putem. */
function icuIzOpisa(desc, tag){
  const t=String(desc||'').split('\n')[0];
  if(!t) return null;
  const br=x=>+String(x).replace(',','.');
  const sek=(m,s)=>+m*60 + +s;
  const wu=t.match(/([\d.,]+)\s*km\s*WU/i);
  const cd=t.match(/([\d.,]+)\s*km\s*CD/i);
  const pauza=t.match(/\(\s*([\d.,]+)\s*(min|s)\b/i);
  const restSec=pauza ? Math.round(br(pauza[1]) * (/min/i.test(pauza[2])?60:1)) : 90;
  /* ODSECI ZAGREVANJE I SMIRIVANJE PRE TRAZENJA RADNOG DELA.
     Bez toga je "2 km WU + 4 km @ 4:22/km + 2 km CD" davalo 2 km tempa umesto
     4 — regex je hvatao prvi broj ispred @, a to je bilo zagrevanje. */
  let rad=t.replace(/^.*?[\d.,]+\s*km\s*WU\s*\+?/i,'')
           .replace(/\+\s*[\d.,]+\s*km\s*CD.*$/i,'')
           .replace(/·.*$/,'');
  const opseg=rad.match(/(\d+):(\d\d)\s*[–—-]\s*(\d+):(\d\d)\s*\/km/);
  const jedan=rad.match(/@\s*~?(\d+):(\d\d)/);
  if(!opseg && !jedan) return null;
  const paceSec = opseg ? sek(opseg[1],opseg[2]) : sek(jedan[1],jedan[2]);
  const paceSec2 = opseg ? sek(opseg[3],opseg[4]) : null;
  const zaglavlje = (tag==='tempo') ? (/broken|isprekid/i.test(t)?'Tempo isprekidan':'Tempo') : 'Intervali';
  /* ponavljanja: "6×800 m", "2×2.5 km" */
  const rep=rad.match(/(\d+)\s*[×x]\s*([\d.,]+)\s*(km|m)\b/i);
  if(rep){
    const jedM = /^m$/i.test(rep[3]) ? br(rep[2]) : br(rep[2])*1000;
    return { type:'int', kind:zaglavlje, wuKm:wu?br(wu[1]):0, cdKm:cd?br(cd[1]):0,
             reps:+rep[1], repM:Math.round(jedM), paceSec, paceSec2, restSec };
  }
  /* vise razlicitih deonica na istom tempu: "4 km + 2 km @ ~4:25/km" */
  const deonice=[...rad.matchAll(/([\d.,]+)\s*km/gi)].map(m=>br(m[1])).filter(x=>x>0);
  if(deonice.length>1){
    return { type:'pyramid', kind:zaglavlje, wuKm:wu?br(wu[1]):0, cdKm:cd?br(cd[1]):0,
             reps:deonice.map(x=>Math.round(x*1000)), paceSec, paceSec2, restSec };
  }
  if(deonice.length===1){
    return { type:'tempo', kind:zaglavlje, wuKm:wu?br(wu[1]):0, cdKm:cd?br(cd[1]):0,
             qKm:deonice[0], paceSec, paceSec2 };
  }
  return null;   /* obicno trcanje — ide kao jedan korak na laganom tempu */
}
function icuTekstDana(d, pE){
  if(!d || d.rest || d.tag==='snaga' || d.tag==='trka') return null;
  /* TIME TRIAL i slicni dani sa opsegom tempa nemaju jedan ciljni tempo —
     ne salju se kao struktura, da sat ne dobije pogresan broj. */
  if(/TIME TRIAL|TT\b/i.test(d.desc||'')) return null;
  const ses=d.session || icuIzOpisa(d.desc, d.tag);
  /* BEZ APSOLUTNOG LAGANOG TEMPA SE DAN NE SALJE.
     Ranije je ovde stajalo `|| 'Z2 Pace'`. Zonski cilj radi samo ako korisnik
     u intervals.icu ima podesene zone trcanja; ko ih nema, dobije korak sa
     distancom ali BEZ tempa ("vidim 8k, ali nema pace") — i to tiho, jer i
     dalje izgleda kao ispravan trening. Bolje je dan preskociti i reci to,
     nego poslati trening koji na satu ne moze da odradi svoj posao. */
  /* LAGAN DEO JE RASPON, NE JEDAN BROJ. E tempo po Danielsu je gornja (brza)
     ivica zone, a ne meta koju treba pogadjati u sekundu — lagano se trci od
     njega pa navise, zavisno od dana i umora. Jedan broj je na satu znacio
     stalno pikanje na zagrevanju i smirivanju, gde je to najmanje potrebno.
     Racuna se iz forme, ne upisuje rukom, da vazi i kad se forma promeni i za
     plan napravljen nekom drugom. */
  const lagan=icuTempo(pE, pE>0 ? pE+ICU_LAGAN_RASPON : 0);
  if(!lagan) return null;
  const red=(lbl,mera,tempo)=>'- '+(lbl?lbl+' ':'')+mera+(tempo?' '+tempo:'');
  /* Sekcije se spajaju PRAZNIM REDOM — intervals.icu to trazi oko svakog bloka
     ponavljanja. Radjeno je rucnim lepljenjem "\n", pa je tempo sesiji falio
     prazan red pre smirivanja; kroz niz sekcija ta greska nije moguca. */
  const sek=[];
  if(!ses){
    if(d.km==null) return null;
    const mera=icuRazdaljina(d.km); if(!mera) return null;
    const naziv=d.mlr?'Srednje-dugo':(d.tag==='lr'?'Dugo trčanje':'Lagano');
    return naziv+'\n'+red('', mera, lagan);
  }
  const tempo=icuTempo(ses.paceSec, ses.paceSec2);
  if(ses.wuKm>0) sek.push('Zagrevanje\n'+red('', icuRazdaljina(ses.wuKm), lagan));
  if(ses.type==='tempo'){
    const mera=icuRazdaljina(ses.qKm); if(!mera) return null;
    sek.push((ses.kind||'Tempo')+'\n'+red('', mera, tempo));
  } else if(ses.type==='int'){
    sek.push((ses.kind||'Radni deo')+' '+ses.reps+'x\n'+
             red('', icuRazdaljina(ses.repM/1000), tempo)+'\n'+
             icuOporavak(ses.kind, ses.restSec));
  } else if(ses.type==='pyramid'){
    /* posle POSLEDNJE deonice nema pauze — odmah ide smirivanje */
    sek.push('Piramida\n'+ses.reps.map((m,i)=>
      red('', icuRazdaljina(m/1000), tempo)+
      (i<ses.reps.length-1 ? '\n'+icuOporavak(ses.kind, ses.restSec) : '')).join('\n'));
  } else if(ses.type==='fartlek'){
    /* fartlek pauza je uvek kaskanje — brzo se smenjuje sa naporom */
    sek.push('Fartlek '+ses.reps+'x\n'+
             red('', icuTrajanje(ses.repSec), tempo)+'\n'+
             icuOporavak(ses.kind, ses.restSec, true));
  } else if(ses.type==='prog'){
    const uk=ses.qKm, lak=Math.round(uk*2/3*100)/100, brz=Math.round((uk-lak)*100)/100;
    sek.push('Progresivno\n'+
             red('Lagani deo', icuRazdaljina(lak), icuTempo(ses.easyPaceSec)||lagan)+'\n'+
             red('Završetak', icuRazdaljina(brz), tempo));
  } else return null;
  if(ses.cdKm>0) sek.push('Hlađenje\n'+red('', icuRazdaljina(ses.cdKm), lagan));
  return sek.join('\n\n');
}
/* Prag tempa (T po Danielsu) koji korisnik treba da unese u intervals.icu.
   Bez njega intervals.icu izbacuje ciljeve tempa iz Garmin izvoza i svaki
   korak na satu stize kao "No Target" — sintaksa tu nije kriva. */
function icuPragTekst(){
  try{
    const v=currentVdot()||baselineVdot(); if(!v) return '';
    const s=paceForZone(v,'T'); if(!(s>0)) return '';
    return ' — po tvojoj formi to je <b>'+Math.floor(s/60)+':'+String(Math.round(s%60)).padStart(2,'0')+'/km</b>';
  }catch(e){ return ''; }
}
/* ============================================================
   SLANJE UPUTSTVA KORISNICIMA (samo vlasnik aplikacije)

   Adresa nije tajna — stoji i u politici privatnosti — i sluzi SAMO da se
   dugme ne prikazuje tudjim nalozima. Pravu proveru radi server, i to nad
   adresom koju procita iz Supabase tokena, ne nad onim sto pregledac tvrdi.
   Zato ovde nema nikakvog kljuca: /api/broadcast prima ili CRON_SECRET
   (terminal) ili prijavu vlasnika (ovo dugme).
   ============================================================ */
/* Vlasnik se prepoznaje po Supabase ID-u naloga, ne po mejl adresi.
   Ranije je ovde stajala adresa u cistom tekstu — bezbednosno bezopasno (pravu
   proveru radi server, nad adresom koju procita IZ TOKENA, ne iz onoga sto
   pregledac tvrdi), ali je adresa time bila izlozena skreperima za spam u
   javnom izvornom kodu.
   UUID nije tajna i ne daje nikakav pristup: RLS u Supabase-u koristi
   `auth.uid()` iz POTPISANOG tokena, ne vrednost koju klijent posalje.
   Ova provera i dalje odlucuje SAMO da li se dugme prikazuje. */
const ADMIN_UID='0403f8fb-a643-4d4e-843d-f71199a0d6f9';
function jeVlasnik(){ return sbAuthed() && SB.userId===ADMIN_UID; }
/* HARDKODOVAN PLAN JE VLASNIKOV LICNI PLAN, ne podrazumevan plan aplikacije.
   Do sada je svaki nov nalog padao na njega: tudji ljudi su gledali njegove
   deonice, njegov datum trke (24.09.2026) i njegov cilj sub-20, sve dok sami
   ne odu u Podesavanja i ne pokrenu carobnjaka — a nista ih tamo nije zvalo.
   Zato: ko nije vlasnik i jos nema svoj plan, ide PRAVO u carobnjaka. */
/* IZUZETAK: ko je vec upisivao treninge na ovaj (tudji) plan, ne sme da bude
   nasilno prebacen — carobnjak bi mu sklonio plan ispod ruku, a njegovi
   dosadasnji unosi nose ID-jeve hardkodovanog plana ('n12d5') i ostali bi bez
   mesta na kom se prikazuju. Njemu se umesto toga PREDLAZE svoj plan
   (traka na Danas), pa sam bira kada. */
function imaUnosaNaLicnom(){
  const l=S.log||{};
  for(const id in l){ const v=l[id];
    if(id.charAt(0)==='n' && v && (v.status==='done'||v.status==='skip')) return true; }
  return false;
}
function moraSvojPlan(){ return !S.genPlan && !jeVlasnik() && !imaUnosaNaLicnom(); }
/* ============================================================
   CIJI SU PODACI NA OVOM UREDJAJU.

   Vlasnikov licni plan i njegova istorija ne smeju da dodju ni do koga osim
   do njega. Do sada su dolazili do svih: `seedState()` je upisivao njegove
   treninge, beleske o kolenu i merenja mase svakom novom korisniku, a to se
   pozadinskom sinhronizacijom prenosilo i u TUDJ Supabase red.

   Poziva se posle `sbLoad()` (dakle kad se zna ciji je nalog) i jos jednom u
   `sbInit()` posto se sesija potvrdi — jer pri prvom pokretanju na novom
   uredjaju covek jos nije prijavljen.
   ============================================================ */
/* UKLANJANJE ZATECENOG SEEDA — hirurski, ne "sve ili nista".
   Prva verzija je odustajala cim postoji generisan plan (`if(S.genPlan) return
   false`) i cim ijedan unos izlazi iz potpisa. Posledica, videna na stvarnom
   uredjaju: covek napravi svoj plan carobnjakom, a tudje beleske o kolenu mu
   ostanu u istoriji bola zauvek — jer od tog trenutka ciscenje vise ne radi.
   Ni `purgeGenPlanData()` ih ne hvata: brise samo unose sa 'g' izvorom, a
   seed zapisi o kolenu nemaju `src`.

   Sada se uklanja TACNO ono sto je prepoznato kao seed, bez obzira na ostalo:
   - koleno: ID-jevi k1..k10 su nedvosmisleni — rucni unos dobija 'k'+Date.now()
     (trinaest cifara), a unos iz treninga 'kt-<idDana>'. Nijedan ne moze da
     bude 'k1'.
   - masa: dva datuma iz potpisa I bez `src` — sopstveni unosi uvek nose src.
   - dnevnik i tempi: samo ako CEO 'n' prostor staje u potpis, dakle ako covek
     nije nista svoje upisao na ugradjeni plan. Inace se ne diraju, jer bi mu
     se brisao sopstveni rad. */
function ukloniTudjiSeed(){
  const P=STARI_SEED_POTPIS;
  let promena=false;

  const kneePre=(S.knee||[]).length;
  S.knee=(S.knee||[]).filter(k=>!(k&&P.knee.includes(k.id)));
  if((S.knee||[]).length!==kneePre) promena=true;

  const kgPre=(S.kg||[]).length;
  S.kg=(S.kg||[]).filter(x=>!(x&&x.src==null&&P.kg.includes(x.date)));
  if((S.kg||[]).length!==kgPre) promena=true;

  /* Dnevnik/tempi: konzervativno. 'g' unosi (sopstveni plan) se ne racunaju —
     gleda se samo da li je covek nesto svoje upisao na UGRADJENI plan. */
  const nLog=Object.keys(S.log||{}).filter(k=>k.charAt(0)==='n');
  if(nLog.length && nLog.every(k=>P.log.includes(k))){
    nLog.forEach(k=>{ delete S.log[k]; }); promena=true;
  }
  const nPred=Object.keys(S.pred||{}).filter(k=>k.charAt(0)==='p');
  if(nPred.length && nPred.every(k=>P.pred.includes(k))){
    nPred.forEach(k=>{ delete S.pred[k]; if(S.predLock) delete S.predLock[k]; });
    S.vdotLog=(S.vdotLog||[]).filter(e=>!(e&&P.pred.includes(e.id)));
    promena=true;
  }
  return promena;
}
function uskladiVlasnickePodatke(){
  /* Vlasniku se nista ne UBACUJE iz koda — njegovi podaci dolaze sa servera
     (sbPull) ili iz backup fajla. Ovde se samo cisti tudji uredjaj. */
  if(jeVlasnik()) return false;
  if(!ukloniTudjiSeed()) return false;
  preracunajVdotLog(); rebuildDateIndex(); save();
  return true;
}
/* blaza varijanta — tudji plan, ali sa vec upisanim treninzima */
function tudjPlanSaUnosima(){ return !S.genPlan && !jeVlasnik() && imaUnosaNaLicnom(); }
async function posaljiUputstvo(opcije){
  try{
    const r=await fetch('/api/broadcast',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+(await sbToken())},
      body:JSON.stringify(opcije||{})});
    let j; try{ j=await r.json(); }catch{ return {ok:false, error:'Server nije vratio ispravan odgovor.'}; }
    if(!r.ok) return {ok:false, error:j.error||('Greška '+r.status)};
    return {ok:true, j};
  }catch(e){ return {ok:false, error:'Nema veze sa serverom.'}; }
}
/* Skuplja dane iz aktivnog plana za naredni broj dana i salje ih. */
function icuDaniZaSlanje(danaUnapred){
  const doDatuma=addD(TODAY, danaUnapred||14);
  const out=[]; let preskoceno=0;
  /* LAGAN TEMPO PO NEDELJI. Kvalitetni dan u svom opisu nema lagan tempo (ima
     radni), a zagrevanje/smirivanje/oporavak se trce lagano. Zato se za svaku
     nedelju procita iz nekog LAGANOG dana te iste nedelje, gde generator uvek
     upise "@ ~M:SS/km". Bez toga su ti koraci isli kao "Z2 Pace", sto na satu
     radi samo ako korisnik ima podesene zone trcanja. */
  const lakTempo={};
  CUR_PLAN.forEach(w=>{
    for(const d of w.days){
      /* SAMO iz laganog/dugog dana. Ranije se citalo iz bilo kog dana bez
         `session` objekta — a u licnom planu nijedan dan ga nema, pa je tempo
         znao da dodje sa TEMPO treninga i zavrsi kao cilj laganog trcanja. */
      if(d.rest||d.tag==='snaga') continue;
      if(d.tag!=='lako'&&d.tag!=='lr') continue;
      const m=(d.desc||'').match(/~(\d+):(\d\d)\/km/);
      if(m){ lakTempo[w.w]=+m[1]*60+ +m[2]; break; }
    }
  });
  /* Ako plan lagan tempo uopste ne zapisuje (licni plan ga ne zapisuje), racuna
     se iz trenutne forme — E zona po Danielsu. Uvek daje apsolutan broj, pa
     sat nikad ne dobije samo "Z2". */
  let pEfallback=null;
  try{ const v=currentVdot()||baselineVdot(); if(v) pEfallback=paceForZone(v,'E'); }catch(e){}
  CUR_PLAN.forEach(w=>w.days.forEach(d=>{
    if(!d.date || d.date<TODAY || d.date>doDatuma) return;
    if(d.test) return;
    let pE=lakTempo[w.w]||pEfallback||null;
    if(d.tag==='lako'||d.tag==='lr'){
      const m=(d.desc||'').match(/~(\d+):(\d\d)\/km/); if(m) pE=+m[1]*60+ +m[2];
    }
    const txt=icuTekstDana(d, pE);
    /* trcecih dana koji su ispali — pregled ih prijavljuje, da ispadanje ne
       prodje tiho (odmor/snaga/trka i TT ispadaju namerno i ne broje se) */
    if(!txt){ if(!d.rest && d.tag!=='snaga' && d.tag!=='trka' && !/TIME TRIAL|TT\b/i.test(d.desc||'')) preskoceno++; return; }
    const izv=d.session||icuIzOpisa(d.desc,d.tag);
    /* Naziv nosi i kilometrazu — u Garmin kalendaru i na satu se vidi samo
       naziv, pa je golo "Lagano" bez ijednog broja beskorisno kad biras
       trening na startu. */
    const osnov=(izv&&izv.kind)||(d.mlr?'Srednje-dugo':d.tag==='lr'?'Dugo trčanje':'Lagano');
    out.push({ date:d.date, externalId:'sub19-'+d.id,
               name: d.km>0 ? osnov+' '+(Math.round(d.km*10)/10)+' km' : osnov,
               description:txt });
  }));
  out.preskoceno=preskoceno;
  return out;
}
async function icuPosalji(danaUnapred, zameni){
  if(!icuPovezan()) return {ok:false, error:'intervals.icu nije povezan.'};
  const events=icuDaniZaSlanje(danaUnapred);
  if(!events.length) return {ok:false, error:'Nema treninga u tom periodu.'};
  try{
    const r=await fetch('/api/icu',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+(await sbToken())},
      body:JSON.stringify({sta:'workouts', athleteId:S.icu.athleteId, ...icuVeza(), events,
                           rezim: zameni?'zameni':'azuriraj'})});
    let j; try{ j=await r.json(); }catch{ return {ok:false, error:'Server nije vratio ispravan odgovor.'}; }
    if(!r.ok) return {ok:false, error:(j.error||('Greška '+r.status))+(j.detail?' — '+j.detail:'')};
    S.icu.lastPush=Date.now(); save();
    return {ok:true, n:j.poslato||events.length};
  }catch(e){ return {ok:false, error:'Nema veze sa serverom.'}; }
}
/* Sažetak svih treninga za LLM trend analizu. NE šalje pun po-krug niz (previše),
   nego sažme svaki trening: datum, tip, tempo, drift (prvi->poslednji puls), kadenca. */
function trendSummary(){
  const out=[];
  DATED.forEach(d=>{
    const l=S.log[d.id]; if(!l||l.status!=='done')return;
    const row={date:l.runDate||l.ts||d.date, tag:d.tag};
    /* Zaključan ručan unos (S.predLock) je EKSPLICITNA korisnikova potvrda/
       ispravka ostvarenog tempa — mora imati prednost nad l.laps, koji mogu
       biti STARIJI (npr. auto-sinhronizovani PRE nego što je korisnik uočio
       da je stvarno trčao drugačiju strukturu i ručno ispravio tempo).
       Nađeno testom: korisnik ručno ispravio tempo na 4:10, AI trend i dalje
       kritikovao stare Strava lapove @ 3:55. Drift/kadenca i dalje dolaze iz
       lapova kad postoje — ispravka tempa ne poništava taj (odvojen) signal. */
    const lockedPid=predRowsFor(d).find(pid=>S.predLock&&S.predLock[pid]&&S.pred&&S.pred[pid]!=null);
    if(lockedPid) row.tempo=S.pred[lockedPid];
    if(Array.isArray(l.laps)&&l.laps.length){
      const hrs=l.laps.map(x=>x.avgHr).filter(x=>x!=null);
      const cads=l.laps.map(x=>x.cadence).filter(x=>x!=null);
      /* PROSEK PONDERISAN DISTANCOM, ne prosek prosekâ. Na nejednakim repovima
         (1600 m + 400 m) prosek prosekâ ume da promaši za 18 s/km — v. isti
         račun u `icuRadniTempo`, koji se ovde i koristi da bi postojao samo
         jedan. Stari račun je bio tačan samo kad su svi repovi iste dužine. */
      if(row.tempo==null){ const t=icuRadniTempo(l.laps); if(t) row.tempo=t; }
      if(hrs.length>=2){row.driftStart=hrs[0];row.driftEnd=hrs[hrs.length-1];row.drift=hrs[hrs.length-1]-hrs[0];}
      if(cads.length)row.cadence=Math.round(cads.reduce((s,x)=>s+x,0)/cads.length);
      /* ŠTO SAMO intervals.icu DAJE — v. icuSyncTreninzi. Trend bez ovoga vidi
         isti tempo na ravnom i uzbrdo, i ne vidi da su se oporavci razvlačili,
         što je najraniji znak da serija puca. */
      const gaps=l.laps.filter(x=>x.gapSec>0&&x.distM>0);
      if(gaps.length===l.laps.length){
        const d=gaps.reduce((a,x)=>a+x.distM,0);
        const v=gaps.reduce((a,x)=>a+x.gapSec*x.distM/1000,0);
        if(d>0) row.gap=Math.round(v/(d/1000));
      }
      const pauze=l.laps.map(x=>x.restSec).filter(x=>x>0);
      if(pauze.length>=2){ row.pauzaPrva=pauze[0]; row.pauzaZadnja=pauze[pauze.length-1]; }
      if(l.laps.length>1) row.repova=l.laps.length;
    } else if(Array.isArray(l.perKm)&&l.perKm.length){
      const cads=l.perKm.map(x=>x.cadence).filter(x=>x!=null);
      if(cads.length)row.cadence=Math.round(cads.reduce((s,x)=>s+x,0)/cads.length);
      /* DRIFT SE MERI SAMO NA UPOREDIVOM TEMPU. Ranije je bio prosto
         "puls poslednjeg minus puls prvog kilometra" — sto je na progresivnom
         trcanju besmisleno (poslednji km je namerno brzi), a na svakom trcanju
         preuvelicano (puls na prvom km jos kasni za naporom). Sada se poredi
         DRUGA polovina sa PRVOM, i to samo ako su tempom uporedive. */
      const v=l.perKm.filter(x=>x&&x.paceSec>0&&x.hr>0);
      if(v.length>=6){
        const pola=Math.floor(v.length/2), A=v.slice(0,pola), B=v.slice(v.length-pola);
        const sr=(arr,f)=>arr.reduce((s,x)=>s+f(x),0)/arr.length;
        const pA=sr(A,x=>x.paceSec), pB=sr(B,x=>x.paceSec);
        if(pA>0 && Math.abs(pB-pA)/pA<=0.03){
          row.driftStart=Math.round(sr(A,x=>x.hr));
          row.driftEnd=Math.round(sr(B,x=>x.hr));
          row.drift=row.driftEnd-row.driftStart;
        } else {
          row.progresivno=true;   /* tempo namerno menjan — drift se ne racuna */
        }
      }
    } else {
      if(row.tempo==null && l.km&&l.sec)row.tempo=Math.round(l.sec/l.km);
      if(l.hr)row.avgHr=l.hr;
    }
    if(l.km!=null) row.km=l.km;
    if(l.decoupling&&l.decoupling.n!=null) row.dekuplovanje=l.decoupling.n;
    /* Mere koje intervals.icu sam izračuna nad celim fajlom. Efikasnost kroz
       vreme je najčistiji pokazatelj aerobnog napretka koji postoji — isti
       tempo uz niži puls — a trend ga do sada nije ni video. */
    if(l.icu){
      if(l.icu.efikasnost!=null) row.efikasnost=l.icu.efikasnost;
      if(l.icu.opterecenje!=null) row.opterecenje=l.icu.opterecenje;
      if(l.icu.osecaSe!=null) row.osecaSe=l.icu.osecaSe;
    }
    if(l.relEffort!=null) row.relEffort=l.relEffort;
    if(l.rpe!=null) row.rpe=l.rpe;
    out.push(row);
  });
  /* Nedeljni obim — bez njega model ne moze da razlikuje "forma stagnira" od
     "obim je pao zbog bolesti/putovanja", a to je najcesce pravo objasnjenje. */
  const ned={};
  out.forEach(r=>{ if(r.km==null||!r.date)return; const d=new Date(r.date); const wd=(d.getUTCDay()+6)%7;
    d.setUTCDate(d.getUTCDate()-wd); const k=d.toISOString().slice(0,10);
    ned[k]=(ned[k]||0)+r.km; });
  const obim=Object.keys(ned).sort().map(k=>({od:k, km:Math.round(ned[k]*10)/10}));
  // VDOT istorija
  const vl=(S.vdotLog||[]).slice().sort((a,b)=>a.ts<b.ts?-1:1).map(e=>({date:e.ts,vdot:e.vdot}));
  /* Oporavak kroz vreme — samo dani koji imaju bar nesto, i najvise 120
     poslednjih, da poruka ostane u razumnoj velicini. */
  const opor=Object.keys(S.wellness||{}).sort().slice(-120)
    .map(k=>S.wellness[k]).filter(z=>z&&(z.hrv!=null||z.pulsUMiru!=null||z.sanH!=null||z.ctl!=null));
  return {treninzi:out, vdot:vl, baseline:baselineVdot(), cilj:goalVdotActive(),
          obim, hrZones:(S.strava&&S.strava.hrZones)||null, oporavak:opor,
          naredno:planUnapred(4), doTrke:diffD(TODAY,CUR_RACE),
          tempoNapretka:tempoKaCilju(vl)};
}
/* TEMPO NAPRETKA — racuna se OVDE, ne prepusta se modelu.
   Merenjem na stvarnoj analizi: model je uredno ispisao i rast (48.1 -> 48.5)
   i cilj (51.3) i rok (52 dana), a onda ta tri broja nije uporedio i zakljucio
   da je cilj "dostizan" — iako trazeni tempo napretka bio oko sedam puta veci
   od ostvarenog. Aritmetika je za jezicki model najnepouzdaniji deo posla, pa
   mu se salje gotov nalaz umesto ulaza za racun. */
function tempoKaCilju(vl){
  const cilj=goalVdotActive();
  if(!Array.isArray(vl)||vl.length<2||cilj==null) return null;
  const prvi=vl[0], zadnji=vl[vl.length-1];
  if(!prvi||!zadnji||prvi.vdot==null||zadnji.vdot==null) return null;
  const dana=diffD(prvi.ts||prvi.date, zadnji.ts||zadnji.date);
  if(!(dana>=14)) return null;                    /* prekratko za tvrdnju o tempu */
  const nedelja=dana/7, doTrkeNed=Math.max(diffD(TODAY,CUR_RACE)/7, 0.1);
  const ostvareno=(zadnji.vdot-prvi.vdot)/nedelja;
  const fali=cilj-zadnji.vdot;
  const potrebno=fali/doTrkeNed;
  const r2=x=>Math.round(x*100)/100;
  return { odVdot:prvi.vdot, doVdot:zadnji.vdot, nedeljaMereno:r2(nedelja),
           ostvarenoPoNedelji:r2(ostvareno), cilj, faliDoCilja:r2(fali),
           nedeljaDoTrke:r2(doTrkeNed), potrebnoPoNedelji:r2(potrebno),
           /* projekcija na TRENUTNOM tempu — jedini pošten odgovor na "hoću li stići" */
           projekcijaNaTrci:r2(zadnji.vdot+ostvareno*doTrkeNed) };
}
/* SAZETAK NAREDNIH NEDELJA — da trend analiza sudi o onome sto DOLAZI, a ne
   samo o onome sto je proslo. Bez ovoga je mogla da kaze "obim raste prebrzo"
   ne znajuci da sledece nedelje ide deload, ili da propusti da najteza nedelja
   pada bas kad oporavak posustaje.

   SAZETO NAMERNO: salju se kvalitetni dani i dugo trcanje, ne svaki lagan dan.
   Lagani dani nose obim, koji je vec dat brojem — njihovi opisi bi samo
   napunili poruku bez ijedne nove informacije. */
function planUnapred(nedelja){
  const out=[];
  for(const w of CUR_PLAN){
    const kraj=addD(w.start,6);
    if(kraj<TODAY) continue;                 /* nedelja je prosla */
    if(out.length>=(nedelja||4)) break;
    const kvalitetni=[], dugo=[];
    w.days.forEach(d=>{
      if(d.rest||d.tag==='snaga') return;
      const opis=String(d.desc||'').split('\n')[0].replace(/\s*·.*$/,'');
      if(d.tag==='lr') dugo.push((d.km||0)+' km');
      else if(d.tag!=='lako'&&d.tag!=='rw') kvalitetni.push(opis);
    });
    out.push({ nedelja:w.w, od:w.start, km:Math.round(weekPlanKm(w)*10)/10,
               deload:/DELOAD/i.test(w.focus||''), kvalitetni, dugo:dugo.join(' + ')||null });
  }
  return out;
}
function chartPred(pc){
  const W=340,H=168,L=36,R=8,B=144,T=26;   /* +16 px za natpis izabrane tačke */
  /* Osa je DINAMIČKA. Ranije tvrdo kodovana na 17.8-22.8 MINUTA i mrežu
     18:00-22:00 (mere tvog 5K plana): na generisanom HM/maratonskom planu sve
     vrednosti (izmereno 220-231 min) padaju iznad gornje granice, pa ih je
     Math.min klemovao na hi — cela "predikcija" je bila ravna linija uz
     gornju ivicu. Ista klasa greške koja je već ispravljena u chartWeeks(). */
  const goalMin=goalSecActive()!=null?goalSecActive()/60:null;
  const vals=[];
  CUR_PRED.forEach(r=>{ if(r.p5k!=null&&isFinite(r.p5k))vals.push(r.p5k/60); });
  pc.rows.forEach(x=>{ if(x.pred!=null&&isFinite(x.pred))vals.push(x.pred/60); });
  if(goalMin!=null)vals.push(goalMin);
  if(!vals.length)return svgW(W,H,'');
  let lo=Math.min(...vals), hi=Math.max(...vals);
  const pad=Math.max((hi-lo)*0.12, 0.35);   /* vazduh gore/dole da tačke ne sedu na ivici */
  lo-=pad; hi+=pad;
  if(hi-lo<0.1)hi=lo+0.1;                   /* sve vrednosti identične — izbegni deljenje nulom */
  const nP=CUR_PRED.length;
  const X=i=>L+(nP<=1?0:i/(nP-1))*(W-L-R); /* nP===1 je ranije davalo deljenje nulom (NaN u SVG putanji) */
  const Y=m=>B-(Math.max(lo,Math.min(hi,m))-lo)/(hi-lo)*(B-T);
  let g='';
  const selP=CHART_SEL.pred!=null?pc.rows[CHART_SEL.pred]:null;
  const selR=selP?CUR_PRED[CHART_SEL.pred]:null;
  g+=chartTop(L, selP&&selP.pred!=null
    ? `${selR?esc(selR.l):''} · predikcija ${fmtClock(selP.pred)}${selR&&selR.p5k!=null?' · plan '+fmtClock(selR.p5k):''}`
    : null);
  [0,0.25,0.5,0.75,1].forEach(f=>{const v=lo+(hi-lo)*f;g+=`<line class="gl" x1="${L}" y1="${Y(v).toFixed(1)}" x2="${W-R}" y2="${Y(v).toFixed(1)}"/><text class="ax" x="${L-4}" y="${(Y(v)+3).toFixed(1)}" text-anchor="end">${fmtClock(v*60)}</text>`;});
  if(goalMin!=null)g+=`<line x1="${L}" y1="${Y(goalMin).toFixed(1)}" x2="${W-R}" y2="${Y(goalMin).toFixed(1)}" stroke="var(--cyan)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  g+=`<polyline fill="none" stroke="rgba(255,255,255,.25)" stroke-width="1.5" points="${CUR_PRED.map((r,i)=>X(i).toFixed(1)+','+Y(r.p5k/60).toFixed(1)).join(' ')}"/>`;
  /* Crveni niz staje TAČNO na pc.last (hronološki poslednji unos, isto merilo
     kao "ZADNJA predikcija" broj) — NE na svaki red koji ima S.pred vrednost.
     Bez ovoga: ako bilo koji red DALJE u nedeljnom redosledu ima vrednost
     (npr. unet van redosleda, ili bez odgovarajućeg vdotLog unosa — VDOT
     grafikon ga onda ispravno ne vidi, ali stari kod ovde JESTE crtao),
     crvena linija je "skakala" napred na taj red umesto da stane gde je
     korisnikov stvaran napredak, praveći vizuelno neslaganje sa brojem gore. */
  const lastIdx=pc.lastRed?pc.rows.indexOf(pc.lastRed):-1;
  const ent=pc.rows.map((x,i)=>({p:x.pred,i})).filter(x=>x.p!=null && (lastIdx<0 || x.i<=lastIdx));
  if(ent.length>1){
    g+=`<defs><linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--pink)" stop-opacity=".38"/>
          <stop offset="55%" stop-color="var(--pink)" stop-opacity=".08"/>
          <stop offset="100%" stop-color="var(--pink)" stop-opacity="0"/>
        </linearGradient></defs>`;
    const line=ent.map(x=>X(x.i).toFixed(1)+','+Y(x.p/60).toFixed(1)).join(' ');
    const area=`${X(ent[0].i).toFixed(1)},${B} ${line} ${X(ent[ent.length-1].i).toFixed(1)},${B}`;
    g+=`<polygon points="${area}" fill="url(#predGrad)"/>`;
    g+=`<polyline fill="none" stroke="var(--pink)" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round" points="${line}"/>`;
  }
  ent.forEach((x,idx)=>{
    const last=idx===ent.length-1, sel=CHART_SEL.pred===x.i;
    g+=`<circle cx="${X(x.i).toFixed(1)}" cy="${Y(x.p/60).toFixed(1)}" r="${sel?5:(last?4.4:3.2)}" fill="${last&&!sel?'var(--bg)':'var(--pink)'}" stroke="${sel?'#fff':(last?'var(--pink)':'none')}" stroke-width="${sel?1:2}"/>`;
    /* indeks je POZICIJA U PLANU (x.i), ne redni broj unetog — natpis mora da
       pogodi isti PRED red koji je i nacrtan */
    g+=chartHit(X(x.i),Y(x.p/60),'pred',x.i);
  });
  /* TESTOVI NA 3 km — zaseban znak, ne tačka na crvenoj liniji. Drugi su
     dokaz (maksimalan napor, ne trenažna sesija) i ne pripadaju istoj krivoj;
     romb ih razlikuje i kad padnu tačno na nju. Poredjaju se po nedelji u
     kojoj su istrčani, pa stoje uz sesije iz istog perioda. */
  (pc.testovi||[]).forEach(t=>{
    if(t.pred==null) return;
    let i=CUR_PRED.findIndex(r=>r.w>=t.r.w);
    if(i<0) i=nP-1;
    const x=X(i), y=Y(t.pred/60), r=4.6;
    g+=`<path d="M${x.toFixed(1)},${(y-r).toFixed(1)} L${(x+r).toFixed(1)},${y.toFixed(1)} L${x.toFixed(1)},${(y+r).toFixed(1)} L${(x-r).toFixed(1)},${y.toFixed(1)} Z" fill="var(--cyan)" stroke="var(--bg)" stroke-width="1"/>`;
  });
  if(goalMin!=null)g+=`<text class="ax" x="${W-R}" y="${(Y(goalMin)-5).toFixed(1)}" text-anchor="end" fill="var(--cyan)">cilj ${fmtClock(goalMin*60)}</text>`;
  return svgW(W,H,g);
}

/* ---------- PODEŠAVANJA / BACKUP ---------- */

/* PONOVO ISCRTAJ PODEŠAVANJA POSLE RADNJE KOJA MENJA STANJE.
   Bez ovoga je „Pošalji na sat" radilo, upisivalo `lastPush` i čuvalo — a ekran
   je i dalje pisao „još nije slato" i vrh je i dalje tvrdio da jedna stvar
   čeka. Sa kontrolnom tablom je to postalo očigledno: radnja se okine sa vrha,
   povratna informacija stigne na dugme dole u sklopljenoj sekciji koju čovek
   i ne gleda, a vrh se ne pomeri. Izgleda kao da slanje nije prošlo.
   Čuva se koje su sekcije bile otvorene i dokle je skrolovano — inače bi svako
   osvežavanje vratilo ekran na vrh i sklopilo sve. */
function osveziPodesavanja(){
  /* Zastavica, a ne pretraga DOM-a. Rukovalac se može okinuti i kad je u
     međuvremenu otvoren drugi list (npr. kartica treninga) — tada bi ga
     osvežavanje zamenilo podešavanjima. Prepoznavanje „po izgledu" je krhko:
     dovoljno je da neki drugi list sutra dobije isti element i provera laže. */
  if(!SET_LIST) return;
  const list=$('#sheet');
  if(!list||!list.classList.contains('on')) return;
  const bile=new Set([...list.querySelectorAll('details.set-card[open]')].map(d=>d.dataset.k));
  const skrol=list.scrollTop;
  openSettings();
  const nov=$('#sheet');
  nov.querySelectorAll('details.set-card').forEach(d=>{ d.open=bile.has(d.dataset.k); });
  nov.scrollTop=skrol;
}


/* ŠTA ČEKA.
   Podešavanja su do sada bila spisak od sedam sekcija istog ranga — da bi se
   videlo da nešto nije povezano, morala se svaka otvoriti. Ovde se to pitanje
   rešava na vrhu ekrana: ide se redom po prioritetu i vraća PRVA stvar koja
   traži radnju, sa dugmetom koje je odmah obavlja.
   Redosled nije proizvoljan — svaka sledeća stavka ima smisla tek kad prethodna
   radi (bez naloga nema servera, bez intervals.icu nema slanja na sat). */
function podesavanjaStanje(){
  const stIcu=!!(S.icu&&S.icu.athleteId);
  const stavke=[
    { k:'nalog', naziv:'Nalog', vazi:sbOn(), ok:sbAuthed(),
      radnja:'Prijavi se', dugme:'hero-nalog',
      tekst:'Nalog čuva plan i istoriju na serveru, pa ih ne gubiš sa telefonom.' },
    { k:'strava', naziv:'Strava', vazi:true, ok:!!S.strava,
      radnja:'Poveži Stravu', dugme:'hero-strava',
      tekst:'Bez Strave se svako trčanje unosi ručno — distanca, vreme i puls stižu sami.' },
    { k:'icu', naziv:'intervals.icu', vazi:true, ok:stIcu,
      radnja:'Poveži intervals.icu', dugme:'hero-icu',
      tekst:'HRV, puls u miru i san koje Garmin već šalje na intervals.icu stoje nepovučeni.' },
    { k:'sat', naziv:'Slanje na sat', vazi:stIcu, ok:!!(S.icu&&S.icu.lastPush),
      radnja:'Pošalji na sat', dugme:'hero-sat',
      tekst:'Treninzi još nisu poslati na sat — plan za narednih 14 dana čeka.' },
    /* Prijavljenom ovde ništa ne čeka: server nosi i podatke i ranije verzije.
       Neprijavljenom je backup jedina kopija, pa mu se i dalje traži. */
    { k:'backup', naziv:'Podaci', vazi:true, ok:sbAuthed()||(!!S.ui.lastBackup&&!backupDue(TODAY)),
      radnja:'Izvezi backup', dugme:'hero-backup',
      tekst:S.ui.lastBackup?'Od poslednjeg backupa je prošlo dosta — napravi novi.':'Backup još nije napravljen.' }
  ].filter(x=>x.vazi);
  const cekaju=stavke.filter(x=>!x.ok);
  return { stavke, cekaju, prvo:cekaju[0]||null };
}

/* ============================================================
   IKONICE SEKCIJA U PODEŠAVANJIMA

   Isti crtački jezik kao ikonice tabova u navigaciji, i to nije ukras nego
   uslov: 24×24, `fill="none"`, `stroke="currentColor"`, debljina 1,8–1,9,
   zaobljeni krajevi, naglasak kao popunjen krug. Emodži se ne koriste —
   oni na svakom uređaju izgledaju drugačije i ne prate boju teksta.

   PLAN I ZAJEDNICA SU DOSLOVNO IKONICE TABOVA. Kad ista stvar ima dva
   crteža, čovek je uči kao dve stvari.

   Ostale crtaju ŠTA SEKCIJA RADI, ne čiji je znak: Strava je strelica koja
   ulazi u posudu (uvoz), jer se tuđi znak ne crta. intervals.icu je talas u
   okviru, a ne srce — srce je već uzeo Oporavak.

   Ključ je NAZIV SEKCIJE, isti onaj koji `kartica()` upisuje u `data-k` da bi
   se posle iscrtavanja vratilo šta je bilo otvoreno. Jedan ključ, dva
   korisnika; kad se naziv promeni, mora na oba mesta — a to hvata test. */
const SET_IKONE = {
  'Nalog':`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.2" r="3.6"/><path d="M5.2 20c.6-3.5 3.4-5.8 6.8-5.8s6.2 2.3 6.8 5.8"/></svg>`,
  'Plan':`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M8.5 6h11M8.5 12h11M8.5 18h11"/><circle cx="4.4" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.4" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.4" cy="18" r="1.4" fill="currentColor" stroke="none"/></svg>`,
  'Strava':`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.6v9.2"/><path d="M8.4 9.4 12 13l3.6-3.6"/><path d="M4.5 15.2v3.1a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3.1"/></svg>`,
  'intervals.icu':`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.2" y="5" width="17.6" height="14" rx="3"/><path d="M6.4 12.4h2.4l1.6-3.4 2.2 6.6 1.6-3.2h3.4"/></svg>`,
  'Slanje na sat':`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6.4" y="6.4" width="11.2" height="11.2" rx="3.2"/><path d="M9.2 6.4 9.6 3h4.8l.4 3.4M9.2 17.6 9.6 21h4.8l.4-3.4"/><path d="M12 14.2v-4.4M10.3 11.5 12 9.8l1.7 1.7"/></svg>`,
  'Vreme':`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.6 10.2a4 4 0 1 1 7.7-1.6"/><path d="M17.4 5.4l.9-.9M20.4 9h1.2M16.2 3.2V2"/><path d="M8 19.6h8.6a3.4 3.4 0 0 0 0-6.8 4.4 4.4 0 0 0-8.6 1.2A2.8 2.8 0 0 0 8 19.6Z"/></svg>`,
  'Obaveštenja':`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 9.6a6 6 0 1 0-12 0c0 4.2-1.6 5.6-1.6 5.6h15.2S18 13.8 18 9.6Z"/><path d="M13.7 19.2a2 2 0 0 1-3.4 0"/></svg>`,
  'Podaci':`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6.2" rx="7.2" ry="2.8"/><path d="M4.8 6.2v11.6c0 1.55 3.22 2.8 7.2 2.8s7.2-1.25 7.2-2.8V6.2"/><path d="M19.2 12c0 1.55-3.22 2.8-7.2 2.8s-7.2-1.25-7.2-2.8"/></svg>`,
  'Zajednica':`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.3"/><path d="M3.2 19.2c.5-3.1 3-5.2 5.8-5.2s5.3 2.1 5.8 5.2"/><path d="M16.4 5.2a3.3 3.3 0 0 1 0 6.1M17.6 14.4c2.1.6 3.7 2.4 4.1 4.8"/></svg>`,
  'Obaveštenje korisnicima':`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.4" width="18" height="13.2" rx="2.6"/><path d="m3.8 7 7.1 5.2a2 2 0 0 0 2.2 0L20.2 7"/></svg>`,
  'Korisnici':`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8.4" r="3"/><path d="M3 19c.4-2.9 2.5-4.8 5-4.8s4.6 1.9 5 4.8"/><path d="M15.2 8h5.6M15.2 12h5.6M15.2 16h5.6"/></svg>`
};

/* GRUPE — po tome ČEMU stvar služi, ne kojim je redom nastala.
   „Admin" postoji samo vlasniku: ne kao zaključan segment, nego ga uopšte
   nema (v. podesavanjaGrupe). */
const SET_GRUPE = [
  ['nalog',   'Nalog',   'Nalog i podaci',    ['Nalog', 'Podaci']],
  ['trening', 'Trening', 'Trening',           ['Plan', 'Vreme']],
  ['veze',    'Veze',    'Veze sa servisima', ['Strava', 'intervals.icu', 'Slanje na sat']],
  ['app',     'App',     'U aplikaciji',      ['Obaveštenja', 'Zajednica']],
  ['admin',   'Admin',   'Admin · vidiš samo ti', ['Obaveštenje korisnicima', 'Korisnici']]
];
function podesavanjaGrupe(){ return jeVlasnik()?SET_GRUPE:SET_GRUPE.filter(g=>g[0]!=='admin'); }
function grupaZaSekciju(naziv){
  const g=SET_GRUPE.find(x=>x[3].includes(naziv));
  return g?g[0]:'app';
}

/* IZABRANA GRUPA SE NE PAMTI IZMEĐU OTVARANJA.
   Pamćenje bi značilo da ekran svaki put počinje na različitom mestu, pa se
   ništa ne nauči napamet. Umesto toga se pri otvaranju skoči na grupu u kojoj
   NEŠTO ČEKA — izbor radi umesto čoveka tačno onda kad je bitno, a inače je
   uvek isto mesto. */
let SET_GRUPA = 'nalog';

/* Prikaz jedne grupe i vezivanje segmenata. Poziva se posle svakog
   iscrtavanja lista, jer `osveziPodesavanja` pravi ceo HTML iznova. */
function podesiGrupe(){
  const grupe=podesavanjaGrupe();
  if(!grupe.some(g=>g[0]===SET_GRUPA)) SET_GRUPA=grupe[0][0];
  const prikazi=()=>{
    document.querySelectorAll('.set-grp').forEach(x=>{
      x.classList.toggle('on', x.dataset.g===SET_GRUPA);
    });
    document.querySelectorAll('[data-sg]').forEach(b=>{
      const on=b.dataset.sg===SET_GRUPA;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on?'true':'false');
    });
    const n=$('#set-naslov'), g=grupe.find(x=>x[0]===SET_GRUPA);
    if(n&&g) n.textContent=g[2];
  };
  document.querySelectorAll('[data-sg]').forEach(b=>b.onclick=()=>{
    SET_GRUPA=b.dataset.sg; prikazi();
    /* Skrol na vrh liste: posle prelaska na kraću grupu ekran bi inače ostao
       na visini koja u novoj grupi ne postoji, pa bi izgledao prazno. */
    const sh=$('#sheet'); if(sh) sh.scrollTop=0;
  });
  prikazi();
}

/* Grupa u kojoj nešto čeka — na nju se skače pri otvaranju. Ako ništa ne
   čeka, ostaje prva. */
function grupaKojaCeka(){
  const st=podesavanjaStanje();
  const prvi=st.cekaju[0];
  if(!prvi) return podesavanjaGrupe()[0][0];
  return grupaZaSekciju(prvi.naziv);
}

function openSettings(){
  AMB_PRE=ACTIVE; ambijent('set');   /* podešavanja imaju svoje, mirnije svetlo */
  /* Izbor grupe se NE pamti između otvaranja — v. SET_GRUPA. Skače se na onu u
     kojoj nešto čeka; kad ništa ne čeka, na prvu. */
  SET_GRUPA=grupaKojaCeka();
  const counts=`${Object.keys(S.log).length} trening-unosa · ${S.knee.length} koleno · ${S.kg.length} težina · ${Object.keys(S.pred).length} predikcija`;
  const vremeSb=SB.seenAt?new Date(SB.seenAt).toLocaleString('sr-RS'):null;
  const stStrava=!!S.strava, stIcu=!!(S.icu&&S.icu.athleteId), stNalog=sbAuthed();

  /* Red sekcije: ikonica levo, naziv i stanje u sredini, tačka stanja desno.
     Ikonica je linijski crtež u jeziku navigacije (v. SET_IKONE), ne emodži —
     emodži su šara koja se na svakom uređaju crta drugačije. Tačka je pomerena
     desno da bi levi rub bio jedna kolona: oko klizi niz ikonice i nalazi
     sekciju bez čitanja. Sve što treba pročitati „u prolazu" stoji u redu,
     sadržaj se otvara dodirom. */
  const glava=(naslov,stanje,ok)=>
    `<summary><span class="set-ik">${SET_IKONE[naslov]||''}</span>
      <span class="set-tt"><b>${esc(naslov)}</b><span>${stanje}</span></span>
      <span class="dot${ok===true?' on':ok==='warn'?' warn':''}"></span></summary>`;
  /* Sekcija koja traži radnju otvara se sama; ono što radi stoji sklopljeno. */
  /* `data-k` je naziv sekcije, izvučen iz zaglavlja — po njemu se posle
     ponovnog iscrtavanja vraća koje su sekcije bile otvorene. Po REDOSLEDU se
     ne bi smelo: broj kartica se menja (npr. „Slanje na sat" postoji samo dok
     je intervals.icu povezan), pa bi se otvorenost preselila na pogrešnu. */
  /* Svaka kartica je u omotaču sa svojom grupom. Skrivanje ide kroz CSS, a NE
     kroz izostavljanje iz HTML-a — svi rukovaoci (`$('#st-sync')` i ostali) se
     kače jednom, nad celim listom, i rade bez obzira koja je grupa prikazana.
     Da se ne-izabrane grupe uopšte ne iscrtavaju, svaki prelazak segmenta bi
     tražio ponovno kačenje dvadesetak rukovalaca — i prvi zaboravljen bi bio
     dugme koje tiho ne radi. */
  const kartica=(otvorena,glavaHTML,telo)=>{
    const kljuc=(/<b>([^<]*)<\/b>/.exec(glavaHTML)||['',''])[1];
    return `<div class="set-grp" data-g="${grupaZaSekciju(kljuc)}"><details class="set-card" data-k="${esc(kljuc)}"${otvorena?' open':''}>${glavaHTML}<div class="set-body">${telo}</div></details></div>`;
  };

  /* VRH EKRANA ODGOVARA NA JEDNO PITANJE: je li sve u redu?
     Ako jeste — piše da jeste i tu je kraj. Ako nije — imenuje PRVU stvar koja
     čeka i daje dugme koje je odmah obavlja, umesto da se sedam sekcija otvara
     jedna po jedna da bi se to otkrilo. Trakice ispod su po jedna za svaku
     sekciju, pa se ceo raspored vidi i bez čitanja. */
  const st=podesavanjaStanje();
  const BROJ=['nijedna','Jedna','Dve','Tri','Četiri','Pet','Šest'];
  const trake=`<div class="set-bars">${st.stavke.map(x=>`<i class="${x.ok?'':'a'}"></i>`).join('')}</div>`;
  const heroHTML = st.prvo
    ? `<div class="set-hero">
         <div class="set-hs"><span class="dot warn"></span><b>${BROJ[st.cekaju.length]||st.cekaju.length} ${st.cekaju.length===1?'stvar čeka':(st.cekaju.length<5?'stvari čekaju':'stvari čeka')}</b></div>
         <p>${esc(st.prvo.tekst)}</p>
         ${trake}
         <div class="btnrow" style="margin-top:13px"><button class="btn" id="${st.prvo.dugme}">${esc(st.prvo.radnja)}</button></div>
       </div>`
    : `<div class="set-hero">
         <div class="set-hs"><span class="dot on"></span><b>Sve je povezano</b></div>
         <p>${esc(st.stavke.map(x=>x.naziv).join(', '))} — ništa ne čeka.</p>
         ${trake}
       </div>`;

  openSheet(`
    <div class="sh-t">Podešavanja i podaci</div>
    <div class="sh-s">${counts}</div>
    ${LS_OK?'':`<div class="kb warn"><div><div>Skladište nedostupno</div><small>Podaci žive samo dok je stranica otvorena (pregled). Na Vercelu/Safariju čuvanje radi normalno.</small></div></div>`}

    ${heroHTML}
    <div class="zseg set-seg" role="tablist" aria-label="Grupe podešavanja">
      ${podesavanjaGrupe().map(g=>`<button role="tab" aria-selected="${SET_GRUPA===g[0]}"
        class="${SET_GRUPA===g[0]?'on':''}" data-sg="${g[0]}">${g[1]}</button>`).join('')}
    </div>
    <div class="set-sub" id="set-naslov">${esc((podesavanjaGrupe().find(g=>g[0]===SET_GRUPA)||podesavanjaGrupe()[0])[2])}</div>

    ${sbOn()?kartica(!stNalog,
      glava('Nalog', stNalog?esc(SB.email||'—'):'nije prijavljen', stNalog),
      stNalog
        ? `<div class="set-st">${vremeSb?('sinhronizovano '+esc(vremeSb)):'još nije sinhronizovano'}</div>
           <div class="btnrow"><button class="btn ghost" id="sb-sync">Sinhronizuj</button><button class="btn ghost sm" id="sb-out">Odjavi se</button></div>
           <details class="help"><summary>Čemu služi prijava</summary><p>Podaci i dalje žive na ovom uređaju — server je samo rezervna kopija, pa aplikacija radi i bez signala. Prijava služi da plan bude isti na svim tvojim uređajima.</p></details>
           <details class="help"><summary>Brisanje naloga</summary><p>Briše nalog i <b>sve</b> podatke sa servera — plan, istoriju treninga, merenja oporavka i prijave za obaveštenja. Ne može da se poništi. Pre brisanja napravi „Backup" ako želiš da zadržiš kopiju.</p><div class="btnrow"><button class="btn ghost sm" id="sb-del">Obriši nalog</button></div></details>`
        : `<div class="btnrow"><button class="btn" id="sb-in">Prijavi se Google nalogom</button></div>
           <details class="help"><summary>Šta dobijam prijavom</summary><p>Bez prijave sve radi kao i do sad, samo bez rezervne kopije na serveru i bez istog plana na više uređaja.</p></details>`):''}

    ${kartica(false,
      glava('Plan', (S.genPlan?(jeVlasnik()?'generisan plan':'tvoj plan'):'tvoj lični plan')+' · '+CUR_PLAN.length+' nedelja', true),
      S.genPlan
        ? `<div class="btnrow">${jeVlasnik()
             ?`<button class="btn ghost" id="pl-revert">Vrati na moj plan</button>`
             :`<button class="btn ghost" id="pl-new">🧙 Napravi novi plan</button>`}</div>`
        : `<div class="btnrow"><button class="btn ghost" id="pl-gen">🧙 Generiši novi plan</button></div>
           <details class="help"><summary>Za koga je novi plan</summary><p>Pravi poseban plan za nekog drugog — tvoj plan ostaje netaknut i uvek mu se vraćaš ovim istim dugmetom.</p></details>`)}

    ${kartica(!stStrava,
      glava('Strava',
        stStrava?(S.strava.athlete?esc(S.strava.athlete)+' · ':'')+'uvoz '+(S.strava.lastSync?esc(new Date(S.strava.lastSync).toLocaleDateString('sr-RS')):'nikad'):'nije povezano',
        stStrava),
      stStrava
        ? `<div class="set-st">poslednji uvoz: ${S.strava.lastSync?esc(new Date(S.strava.lastSync).toLocaleString('sr-RS')):'nikad'}</div>
           <div class="btnrow"><button class="btn" id="st-sync">Uvezi trčanja</button><button class="btn ghost sm" id="st-off">Otkači</button></div>
           ${zoneHTML()}
           <details class="help"><summary>Pravila uvoza</summary><p>Strava ima prednost nad ručnim unosom. Ručna korekcija polja (km / vreme / puls) <b>trajno</b> štiti taj trening od prepisivanja. Ako su dva trčanja istog dana, uzima se ono bliže planiranoj kilometraži. Tempo intervala i tempa se čita iz lapova i upisuje u Predikciju.</p></details>`
        : `<div class="btnrow"><button class="btn" id="st-on" style="background:#FC4C02">Poveži Stravu</button></div>
           <details class="help"><summary>Šta se uvozi</summary><p>Distanca, vreme i puls svakog trčanja, plus tempo kvalitetnih sesija iz lapova.</p></details>`)}

    ${kartica(!stIcu,
      glava('intervals.icu',
        stIcu?((S.wellness?Object.keys(S.wellness).length:0)+' zapisa · '+(S.icu.lastSync?esc(new Date(S.icu.lastSync).toLocaleDateString('sr-RS')):'nikad')):'nije povezan',
        stIcu),
      stIcu
        ? `<div class="set-st">ID <b>${esc(S.icu.athleteId)}</b>${S.icu.token?' · odobreno na intervals.icu':' · ručni ključ'}<br>poslednje povlačenje: ${S.icu.lastSync?esc(new Date(S.icu.lastSync).toLocaleString('sr-RS')):'nikad'}</div>
           <div class="btnrow"><button class="btn" id="icu-sync">Povuci sve</button><button class="btn ghost sm" id="icu-off">Otkači</button></div>
           ${icuImaTreninge()
             ? `<div class="set-st">Jednim dodirom stižu i <b>jutarnja merenja</b> i <b>trčanja</b>${S.strava?' (Strava ostaje kao rezerva)':''}.${S.icu.trSync?'<br>trčanja poslednji put: '+esc(new Date(S.icu.trSync).toLocaleString('sr-RS')):''}</div>`
             : `<div class="set-st" style="color:var(--amber)">Ova veza je napravljena pre nego što je aplikacija umela da čita treninge, pa povlači samo jutarnja merenja. <b>Otkači pa ponovo poveži</b> — dobićeš i krugove intervala, koje Strava ne daje ovako tačno.</div>`}
           <details class="help"><summary>Šta se povlači</summary><p>HRV, puls u miru, san i trenažno opterećenje. Garmin ih šalje na intervals.icu, odakle ih čitamo — Garminov sopstveni API traži partnerski program.</p><p><b>I sami treninzi.</b> intervals.icu je radne deonice već prepoznao nad izvornim fajlom sa sata, pa analiza dobija svaki interval posebno — tempo, GAP (tempo korigovan za nagib), puls i oporavak između repova — umesto proseka cele sesije. Ako intervals.icu nije povezan, sve to i dalje radi preko Strave, samo grublje.</p></details>`
        : `<div class="btnrow"><button class="btn" id="icu-oauth">Poveži intervals.icu</button></div>
           <details class="help"><summary>Šta se povezivanjem dobija</summary><p>HRV, puls u miru i san koje Garmin već šalje na intervals.icu, i slanje planiranih treninga na sat. Odobravaš na njihovoj strani — nikakav ključ ne prepisuješ.</p></details>
           <details class="help"><summary>Ako piše „Invalid redirect_uri"</summary>
             <p>Znači da adresa koju šaljemo <b>nije doslovno ista</b> kao ona prijavljena kod njih. Otvori
             intervals.icu → Settings → <b>Developer Settings</b> i u polje <b>Redirect URI</b> upiši tačno ovo,
             sa kosom crtom na kraju:</p>
             <div class="f-field full" style="margin-top:6px"><span class="f-lbl">Adresa za prijavu</span>
               <input id="icu-uri" readonly value="${esc(location.origin+'/')}"></div>
             <div class="btnrow" style="margin-top:8px"><button class="btn ghost sm" id="icu-uri-copy">Kopiraj adresu</button></div>
             <p>Najčešća dva uzroka: <b>fali kosa crta</b> na kraju prijavljene adrese, ili si aplikaciju otvorio
             preko privremene Vercel adrese (one sa nasumičnim delom u imenu) umesto preko stalne — tada se
             domen ne poklapa ni sa čim što je prijavljeno.</p>
           </details>
           <details class="help"><summary>Ručno povezivanje (ako gornje ne radi)</summary>
             <div class="f-field full" style="margin-top:6px"><label for="icu-id">ID sportiste</label><input id="icu-id" inputmode="numeric" placeholder="npr. i123456"></div>
             <div class="f-field full"><label for="icu-key">API ključ</label><input id="icu-key" type="password" placeholder="iz intervals.icu → Settings → Developer"></div>
             <div class="btnrow" style="margin-top:8px"><button class="btn ghost sm" id="icu-on">Poveži ključem</button></div>
             <p>intervals.icu → Settings → na dnu <b>Developer Settings</b>. Ovo zaobilazi OAuth u celosti, pa
             radi i dok je gornja greška nerešena — samo bez slanja treninga na sat.</p>
           </details>`)}

    ${stIcu?kartica(false,
      glava('Slanje na sat', S.icu.lastPush?('poslednje '+esc(new Date(S.icu.lastPush).toLocaleDateString('sr-RS'))):'još nije slato', S.icu.lastPush?true:'warn'),
      `<div class="btnrow"><button class="btn ghost" id="icu-push">📤 Pošalji na sat (14 dana)</button></div>
       <div class="btnrow"><button class="btn ghost sm" id="icu-vidi">👁 Vidi šta se šalje</button><button class="btn ghost sm" id="icu-push2">♻️ Iz početka</button></div>
       <div id="icu-pregled"></div>
       <details class="help"><summary>Da treninzi stignu do sata</summary><p>U intervals.icu → Settings uključi <b>„Upload planned workouts"</b> i autorizuj Garmin Connect. Prosleđuje se otprilike nedelju dana unapred, pa dalji dani stižu sami kako se približavaju.</p></details>
       <details class="help"><summary>Ako na satu piše „No Target"</summary><p>U intervals.icu → Settings → Sport Settings unesi <b>prag tempa (threshold pace)</b>${icuPragTekst()}. Bez njega intervals.icu izbacuje ciljeve tempa iz Garmin izvoza.</p><p>Garmin izvoz se pravi kad događaj <b>nastane</b>, pa posle unosa praga obično slanje ne pomaže — tada ide <b>„Iz početka"</b>, koje briše ranije poslato i pravi ga iznova.</p></details>`):''}

    ${(()=>{ const g=S.ui&&S.ui.geo; const sat=satTreninga();
      return kartica(!g,
        glava('Vreme', g?('trening u '+sat+':00'+(S.vreme&&S.vreme.at?' · prognoza od '+esc(new Date(S.vreme.at).toLocaleTimeString('sr-RS',{hour:'2-digit',minute:'2-digit'})):'')):'lokacija nije uključena', !!g),
        g
          ? `<div class="set-st">Prognoza za tvoju okolinu, na kartici dana koji predstoji. Koordinate se zaokružuju na ~1 km i idu samo vremenskoj službi — nikad na naš server.</div>
             <div class="f-grid"><div class="f-field full"><label for="vr-sat">U koliko sati obično trčiš</label>
               <select id="vr-sat">${Array.from({length:24},(_,h)=>`<option value="${h}"${h===sat?' selected':''}>${String(h).padStart(2,'0')}:00</option>`).join('')}</select></div></div>
             <div class="btnrow"><button class="btn ghost sm" id="vr-osvezi">Osveži prognozu</button><button class="btn ghost sm" id="vr-off">Isključi</button></div>`
          : `<div class="set-st">Na kartici dana koji predstoji piše temperatura, osećaj, vlažnost i verovatnoća kiše — i koliko je realno sporiji ciljni tempo na toj vrućini. To je jedini podatak u aplikaciji koji menja odluku <b>pre</b> nego što izađeš.</div>
             <div class="btnrow"><button class="btn" id="vr-on">Uključi lokaciju</button></div>
             <details class="help"><summary>Šta se tačno šalje</summary><p>Koordinate zaokružene na dve decimale (~1 km) idu <b>direktno</b> servisu Open-Meteo, koji ne traži nalog ni ključ. Naš server ih nikad ne vidi — zato i ne ide preko njega.</p><p>Ništa se ne šalje dok sam ne uključiš, a isključivanjem se koordinate brišu sa uređaja.</p></details>`);
    })()}

    ${(()=>{
      /* iOS daje PushManager SAMO instaliranoj aplikaciji. U Safariju sa
         sajta ga nema — i to nije kvar nego Appleovo pravilo, pa poruka mora
         da kaže šta da se uradi, a ne „nije podržano". */
      if(!pushPodrzan()){
        const ios=/iPad|iPhone|iPod/.test(navigator.userAgent||'');
        return kartica(false, glava('Obaveštenja','nisu dostupna ovde','warn'),
          ios
            ? `<div class="set-st">Na iPhoneu obaveštenja radi samo <b>instalirana</b> aplikacija. U Safariju dodirni <b>Podeli → Dodaj na početni ekran</b>, otvori SUB-20 sa ikonice i vrati se ovde.</div>`
            : `<div class="set-st">Ovaj pregledač ne podržava obaveštenja. Aplikacija radi normalno i bez njih.</div>`);
      }
      const doz=pushDozvola();
      const ukljucena=!!(S.ui&&S.ui.push)&&doz==='granted';
      return kartica(!ukljucena,
        glava('Obaveštenja', ukljucena?'uključena na ovom uređaju':'isključena', ukljucena?true:'warn'),
        `<div class="set-st">Ujutru stigne kratak podsetnik šta je danas na planu — i poruka kad AI analiza završi dok je aplikacija zatvorena. Dani odmora se preskaču.</div>
         <div class="btnrow" id="ob-red"></div>
         <div class="note-src" id="ob-stanje" style="margin:6px 0 0">Proveravam…</div>
         <details class="help"><summary>Šta se šalje i odakle</summary><p>Server zna samo <b>datum i jedan red teksta</b> („8×400 m · 12 km") koji mu aplikacija sama upiše za narednih nedelju dana. Plan, tempo, puls i istorija ostaju na uređaju.</p><p>Sadržaj obaveštenja se šifruje ključem koji postoji samo na tvom telefonu — ni Google ni Apple ne vide šta piše, iako poruka prolazi kroz njih.</p><p>Isključivanje briše pretplatu i sa uređaja i sa servera.</p></details>`);
    })()}

    ${kartica(false,
      glava('Podaci', sbAuthed()?'na serveru · ranije verzije dostupne'
                                :'samo na ovom uređaju · backup '+(S.ui.lastBackup?esc(fmtDY(S.ui.lastBackup)):'nikad'),
            sbAuthed()?true:(S.ui.lastBackup?true:'warn')),
      `${sbAuthed()
         ? `<div class="set-st">Podaci se čuvaju na serveru, a server pamti i <b>ranije verzije</b> — greška se može vratiti unazad. Backup fajl više nije neophodan; ostaje za slučaj da ti kopija treba van aplikacije.</div>
            <div class="btnrow"><button class="btn" id="s-ist">🕓 Ranije verzije</button></div>`
         : `<div class="set-st" style="color:var(--amber)">Nisi prijavljen, pa podaci žive <b>samo na ovom uređaju</b>. Backup je tada jedina kopija — ili se prijavi, pa ih server preuzme.</div>`}
       <div class="btnrow"><button class="btn ghost sm" id="s-exp">Izvezi backup</button><button class="btn ghost sm" id="s-imp">Uvezi backup</button></div>
       <input type="file" id="s-file" accept=".json,application/json" style="display:none">
       ${sbOn()&&sbAuthed()?`<div class="btnrow"><button class="btn ghost sm" id="s-bug">Prijavi problem</button></div>`:''}
       <details class="help"><summary>Šta server pamti, a šta ne</summary>
         <p>Pre svake izmene sačuva se prethodno stanje — najviše 40 verzija i najviše jedna na sat, što u praksi pokriva nedeljama unazad.</p>
         <p><b>Brisanje naloga briše i istoriju.</b> Obrisano je obrisano; tu backup fajl ostaje jedina kopija, i zato ga dijalog za brisanje i traži.</p></details>`)}

    ${sbAuthed()?(()=>{
      const uk=!!(S.zajed&&S.zajed.vidljiv);
      /* Kartica se NE otvara sama kad je isključena. Sve ostale sekcije se
         otvaraju kad nešto „čeka" — ali ovde ništa ne čeka: isključeno je
         ispravno stanje, ne nedostatak. Sama otvorena kartica bi bila blag
         pritisak da se uključi, a ovo je jedina odluka u aplikaciji koja
         podatke iznosi iz naloga. */
      return kartica(false,
        glava('Zajednica', uk?'profil je vidljiv drugima':'isključena', uk?true:null),
        `<div class="set-st">Rang-lista trkača u aplikaciji. Dok je isključena, ne postojiš na spisku i ne vidiš tuđe profile — vidljivost je uzajamna.</div>
         <div class="f-grid"><div class="f-field full"><label for="zaj-nadimak">Nadimak <small style="color:var(--txt2)">(prazno = ime sa Google naloga)</small></label>
           <input id="zaj-nadimak" type="text" maxlength="24" placeholder="${esc(zajIme()||'kako te zovu')}" value="${esc((S.zajed&&S.zajed.nadimak)||'')}"></div></div>
         <div class="oprow" style="display:flex;align-items:center;gap:14px;padding:12px 0;border-top:1px solid var(--line)">
           ${zajAvatar({user_id:SB.userId,nadimak:zajIme(),avatar_url:SB.slika},44)}
           <div style="flex:1;min-width:0">
             <b style="display:block;font-size:.88rem">${esc(zajIme()||'Trkač')}</b>
             <small style="display:block;font-size:.7rem;color:var(--txt3);font-weight:600;margin-top:3px">
               ${SB.slika?'ovako te vide ostali':'slika sa Google naloga još nije stigla — vidi se početno slovo'}</small>
           </div>
         </div>
         <div class="btnrow"><button class="btn${uk?' ghost':''}" id="zaj-tgl">${uk?'Isključi Zajednicu':'Uključi Zajednicu'}</button></div>
         <div class="note-src" id="zaj-out" style="margin:6px 0 0"></div>
         <details class="help"><summary>Šta drugi vide</summary>
           <p>Nadimak i sliku sa Google naloga, ciljnu distancu i datum trke, koja si nedelja plana, VDOT sada i na početku, test na 3 km, kilometražu ove nedelje, doslednost, niz dana, značke i <b>do osam poslednjih trčanja</b> (datum, tip, dužina, tempo).</p></details>
         <details class="help"><summary>Šta drugi NIKAD ne vide</summary>
           <p>HRV, puls u miru, san, težinu, mapu bolova, beleške sa treninga, puls na treningu, AI analizu i <b>e-adresu</b>. Ta polja ne postoje u tabeli Zajednice, pa ne mogu da izađu ni greškom u aplikaciji.</p>
           <p>GPS trase aplikacija ne čuva ni za sebe — gde si trčao se ne može podeliti ni ovde.</p></details>
         <details class="help"><summary>Isključivanje</summary>
           <p>Briše tvoj red iz baze, ne samo što te sklanja sa spiska. Ponovno uključivanje ga pravi iznova iz tvojih tekućih podataka.</p></details>
         ${jeVlasnik()?`<details class="help"><summary>Izazov nedelje · samo ti</summary>
           <p>Isti tekst stoji svima dok ga ne promeniš. Menja se retko — poenta je da ljudi znaju šta se od njih očekuje, ne da svake nedelje pogađaju.</p>
           <div class="f-field full"><label for="zaj-izazov">Tekst izazova</label>
             <input id="zaj-izazov" type="text" maxlength="160" value="${esc(ZAJ.izazov||'')}" placeholder="Odradi sve treninge po planu ove nedelje."></div>
           <div class="btnrow" style="margin-top:8px"><button class="btn ghost sm" id="zaj-izazov-cuvaj">Sačuvaj izazov</button></div>
           <div class="note-src" id="zaj-izazov-out"></div></details>`:''}`);
    })():''}

    ${jeVlasnik()?kartica(false,
      glava('Obaveštenje korisnicima','mejl svima koji imaju nalog · samo ti',true),
      `<div class="set-st">Šalje mejl sa linkom na <b>uputstvo</b> svima koji imaju nalog.</div>
       <div class="btnrow"><button class="btn ghost sm" id="bc-lista">📋 Spisak adresa</button><button class="btn ghost sm" id="bc-proba">Proba na mene</button></div>
       <div class="btnrow"><button class="btn ghost sm" id="bc-svi">Pošalji svima…</button></div>
       <div id="bc-out"></div>
       <details class="help"><summary>Šta se tačno šalje</summary><p>Kratak mejl sa dugmetom koje vodi na <b>/uputstvo.html</b>. Ceo tekst se namerno ne šalje mejlom — poslat mejl se ne može ispraviti, a stranica može.</p><p>Svaki mejl ide <b>posebno</b>, da niko ne vidi tuđe adrese. „Pošalji svima" prvo prebroji primaoce i pita za potvrdu.</p></details>`):''}

    ${jeVlasnik()?kartica(false,
      glava('Korisnici','ko ima nalog · samo ti',true),
      `<div class="set-st">Spisak svih naloga, sa poslednjom prijavom. Odavde se briše tuđ nalog zajedno sa svim njegovim podacima.</div>
       <div class="btnrow"><button class="btn ghost sm" id="ku-otvori">👥 Otvori spisak</button></div>`):''}

    <div class="btnrow" style="margin-top:16px"><button class="btn ghost sm" id="sw-osvezi">Osveži aplikaciju</button></div>
    <div class="note-src" id="sw-stanje" style="margin:6px 0 0">Proveravam verziju offline kopije…</div>
    <div class="note-src" style="margin-top:6px">Verzija ${APP_VERSION} · šema v${S.v} · ${TOTAL_TR} treninga / ${fmtKm(CUR_PLAN.reduce((s,w)=>s+weekPlanKm(w),0))} km · ${S.genPlan?'generisan plan':'Plan_SUB-19_5K_v5.xlsx · trka 24.09.2026.'} · <a href="./uputstvo.html" target="_blank" rel="noopener" style="color:inherit">Uputstvo</a> · <a href="./privacy.html" target="_blank" rel="noopener" style="color:inherit">Politika privatnosti</a></div>
  `);
  SET_LIST=true;
  podesiGrupe();
  zajSlike();   /* avatar u sekciji Zajednica — v. zajSlike */
  $('#s-exp').onclick=()=>{ exportBackup(); setTimeout(osveziPodesavanja,300); };
  if($('#s-ist')) $('#s-ist').onclick=openIstorijaSheet;
  if($('#s-bug')) $('#s-bug').onclick=openBugSheet;
  if($('#sb-in'))   $('#sb-in').onclick=sbLogin;
  if($('#sb-out'))  $('#sb-out').onclick=()=>{ if(confirm('Odjaviti se? Podaci na ovom uređaju ostaju.')){ sbLogout(); closeSheet(); } };
  if($('#sb-del'))  $('#sb-del').onclick=openObrisiNalogSheet;
  if($('#ku-otvori')) $('#ku-otvori').onclick=openKorisniciSheet;
  if($('#zaj-nadimak')) $('#zaj-nadimak').onchange=e=>{
    S.zajed=S.zajed||{vidljiv:false,nadimak:''};
    S.zajed.nadimak=String(e.target.value||'').trim().slice(0,24);
    save();
    /* Nov nadimak se šalje SAMO ako je profil već vidljiv. Inače bi promena
       teksta u polju napravila red u bazi za nekoga ko Zajednicu nije uključio. */
    if(S.zajed.vidljiv) zajUpisi();
  };
  if($('#zaj-izazov-cuvaj')) $('#zaj-izazov-cuvaj').onclick=async e=>{
    const b=e.target, out=$('#zaj-izazov-out'), polje=$('#zaj-izazov');
    const tekst=String((polje&&polje.value)||'').trim();
    if(tekst.length<3||tekst.length>160){ if(out) out.textContent='Izazov mora imati između 3 i 160 znakova.'; return; }
    b.disabled=true; b.textContent='Čuvam…';
    try{
      const tok=await sbToken();
      if(!tok) throw new Error('Nisi prijavljen.');
      const r=await fetch('/api/broadcast',{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
        body:JSON.stringify({admin:'izazov',tekst})});
      const res=await apiJson(r);
      if(!res.data||!res.data.ok) throw new Error((res.data&&res.data.error)||res.error||'Nije uspelo.');
      ZAJ.izazov=res.data.tekst;
      if(out) out.textContent='Sačuvano. Svi ga vide pri sledećem otvaranju Zajednice.';
    }catch(err){ if(out) out.textContent=err.message||'Nije uspelo.'; }
    b.disabled=false; b.textContent='Sačuvaj izazov';
  };
  if($('#zaj-tgl')) $('#zaj-tgl').onclick=async e=>{
    const b=e.target, uk=!!(S.zajed&&S.zajed.vidljiv), out=$('#zaj-out');
    b.disabled=true; b.textContent=uk?'Isključujem…':'Uključujem…';
    const ok=await zajPostavi(!uk);
    if(ok){ osveziPodesavanja(); return; }
    /* Neuspeh se KAŽE. `zajPostavi` je već vratio staro stanje, pa je jedina
       preostala greška ćutanje — prekidač koji izgleda kao da je uspeo. */
    b.disabled=false; b.textContent=uk?'Isključi Zajednicu':'Uključi Zajednicu';
    if(out) out.textContent=zajPoruka(navigator.onLine?ZAJ.razlog:'mreza');
  };
  if($('#sb-sync')) $('#sb-sync').onclick=async e=>{
    const b=e.target; b.disabled=true; b.textContent='Sinhronizujem…';
    const ok=await sbPush();
    b.textContent=ok?'Sinhronizovano ✓':'Nije uspelo';
    if(ok) setTimeout(osveziPodesavanja,900);
    else setTimeout(()=>{ b.disabled=false; b.textContent='Sinhronizuj sada'; },1800);
  };
  $('#s-imp').onclick=()=>$('#s-file').click();
  $('#s-file').onchange=e=>importBackup(e.target.files[0]);
  if($('#icu-oauth')) $('#icu-oauth').onclick=icuConnect;
  if($('#icu-uri-copy')) $('#icu-uri-copy').onclick=async e=>{
    const b=e.target, adresa=location.origin+'/';
    try{ await navigator.clipboard.writeText(adresa); }
    catch(err){ const p=$('#icu-uri'); if(p){ p.select&&p.select(); } }   /* bez dozvole za ostavu — bar označi tekst */
    b.textContent='Kopirano ✓';
    setTimeout(()=>{ b.textContent='Kopiraj adresu'; },1600);
  };
  if($('#icu-on')) $('#icu-on').onclick=async()=>{
    const id=($('#icu-id').value||'').trim(), key=($('#icu-key').value||'').trim();
    if(!/^i?\d+$/.test(id)){ alert('ID sportiste izgleda kao broj, npr. i123456.'); return; }
    if(key.length<8){ alert('API ključ deluje prekratak.'); return; }
    const b=$('#icu-on'); b.disabled=true; b.textContent='Proveravam…';
    S.icu={athleteId:id, apiKey:key, lastSync:null};
    const r=await icuSync(14);
    if(r.ok){ save(); closeSheet(); alert('Povezano. Povučeno zapisa: '+r.n+'.'); }
    else { S.icu=null; b.disabled=false; b.textContent='Poveži'; alert(r.error||'Nije uspelo.'); }
  };
  /* PREGLED — Garmin Connect namerno ne prikazuje korake ni ciljeve treninga
     koje je napravila treca aplikacija ("View details and edit on ..."), pa se
     iz njega ne moze zakljuciti da li je struktura uopste poslata. Ovde stoji
     doslovno ono sto odlazi, da ne treba cekati prvi kvalitetan dan da bi se
     videlo. */
  if($('#icu-vidi')) $('#icu-vidi').onclick=()=>{
    const box=$('#icu-pregled'); if(!box) return;
    if(box.innerHTML){ box.innerHTML=''; return; }
    const ev=icuDaniZaSlanje(14);
    if(!ev.length){ box.innerHTML='<div class="note-src">Nema treninga u narednih 14 dana.</div>'; return; }
    /* koji od njih uopste nose strukturu — to je ono sto korisnik proverava */
    const strukt=ev.filter(e=>/^- /m.test(e.description) && e.description.split('\n').filter(l=>/^- /.test(l)).length>1);
    box.innerHTML='<div class="note-src" style="margin:10px 0 6px">Šalje se '+ev.length+' treninga, '+
      (strukt.length?'sa strukturom: '+strukt.length+' ('+strukt.map(e=>fmtDY(e.date)).join(', ')+')'
                    :'nijedan sa strukturom — svi su lagani/dugi dani')+
      '.<br>intervals.icu prosleđuje Garminu otprilike nedelju dana unapred, pa dalji dani stižu kasnije sami.'+
      (ev.preskoceno?'<br><b>Preskočeno dana trčanja: '+ev.preskoceno+'</b> — za njih nije poznat lagan tempo u sekundama, pa bi na satu izašli bez ciljnog tempa.':'')+
      '</div>'+
      ev.map(e=>'<pre style="white-space:pre-wrap;font-size:12px;line-height:1.45;margin:0 0 10px;padding:8px;'+
        'border-radius:8px;background:rgba(127,127,127,.12);overflow-x:auto">'+
        esc(fmtDY(e.date)+' · '+e.name)+'\n'+esc(e.description)+'</pre>').join('');
  };
  /* SPISAK ADRESA — za slanje iz sopstvenog sanduceta preko BCC.
     Postoji zato sto Resend bez potvrdjenog domena salje samo na adresu
     vlasnika naloga, pa dugme "Posalji svima" za sada ne moze da odradi
     posao. Suvi poziv (bez `posalji`) NE salje nista, samo vrati listu. */
  if($('#bc-lista')) $('#bc-lista').onclick=async e=>{
    const box=$('#bc-out'); if(!box) return;
    if(box.innerHTML){ box.innerHTML=''; return; }
    const b=e.target; b.disabled=true; b.textContent='Čitam…';
    const r=await posaljiUputstvo({});
    b.disabled=false; b.textContent='📋 Spisak adresa';
    if(!r.ok){ alert(r.error||'Nije uspelo.'); return; }
    const adrese=(r.j.primaoci||[]);
    if(!adrese.length){ box.innerHTML='<div class="note-src">Nema nijednog naloga.</div>'; return; }
    /* zarezom razdvojeno — tako se lepi pravo u BCC polje */
    box.innerHTML='<div class="note-src" style="margin:10px 0 6px">'+adrese.length+' '+pl3(adrese.length,'adresa','adrese','adresa')+' · nalepi ih u <b>BCC</b>, ne u „Za", da niko ne vidi tuđe.</div>'+
      '<textarea id="bc-txt" readonly rows="4" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:10px;color:var(--txt);font-size:.78rem;line-height:1.5;resize:vertical">'+esc(adrese.join(', '))+'</textarea>'+
      '<div class="btnrow" style="margin-top:8px"><button class="btn ghost sm" id="bc-kopiraj">Kopiraj adrese</button></div>';
    if($('#bc-kopiraj')) $('#bc-kopiraj').onclick=async ev=>{
      const t=$('#bc-txt'); const kb=ev.target;
      try{ await navigator.clipboard.writeText(t.value); }
      catch(x){ t.select(); try{ document.execCommand('copy'); }catch(y){} }
      kb.textContent='Kopirano ✓'; setTimeout(()=>{ kb.textContent='Kopiraj adrese'; },1800);
    };
  };
  if($('#bc-proba')) $('#bc-proba').onclick=async e=>{
    const b=e.target; b.disabled=true; b.textContent='Šaljem…';
    /* Adresa se uzima iz PRIJAVLJENE sesije, ne iz konstante u kodu. Server
       `samoNa` ionako filtrira kroz stvarnu listu korisnika, pa se ni ovako ne
       moze poslati na proizvoljnu adresu. */
    const moja=String(SB.email||'').trim().toLowerCase();
    if(!moja){ b.disabled=false; b.textContent='Proba na mene'; alert('Nisi prijavljen.'); return; }
    const r=await posaljiUputstvo({posalji:true, samoNa:[moja]});
    b.textContent=r.ok?'Poslato ✓':'Nije uspelo';
    alert(r.ok?('Poslato na '+moja+'. Proveri sanduče — i spam.'):(r.error||'Nije uspelo.'));
    setTimeout(()=>{ b.disabled=false; b.textContent='Proba na mene'; },2200);
  };
  if($('#bc-svi')) $('#bc-svi').onclick=async e=>{
    const b=e.target; b.disabled=true; b.textContent='Brojim…';
    /* prvo SUVO — koliko ih je; slanje svima se ne poništava, pa se ne kreće naslepo */
    const p=await posaljiUputstvo({});
    b.disabled=false; b.textContent='Pošalji svima…';
    if(!p.ok){ alert(p.error||'Nije uspelo.'); return; }
    const n=p.j.primalaca||0;
    if(!n){ alert('Nema nijednog primaoca.'); return; }
    if(!confirm('Poslati uputstvo na '+n+' '+pl3(n,'adresu','adrese','adresa')+'?\n\nMejl se ne može povući. Traje oko '+Math.ceil(n*0.6)+' s — ne zatvaraj aplikaciju.')) return;
    /* SLANJE IDE U VISE POZIVA. Jedan poziv stane u vremenski limit Vercel
       funkcije (~90 mejlova); server vrati `sledeciOd` i ovde se nastavlja
       odatle. Bez ovoga je slanje na vise od ~90 adresa zavrsavalo prekidom
       na pola, uz poruku „Nije uspelo" iako je deo mejlova vec otisao. */
    b.disabled=true;
    let od=0, poslato=0, palo=0, krugova=0, greska=null;
    while(od!=null && krugova<60){
      krugova++;
      b.textContent='Šaljem '+poslato+'/'+n+'…';
      const r=await posaljiUputstvo({posalji:true, od});
      if(!r.ok){ greska=r.error||'Nije uspelo.'; break; }
      poslato+=r.j.poslato||0; palo+=r.j.palo||0;
      od=(r.j.sledeciOd==null)?null:r.j.sledeciOd;
    }
    b.textContent=greska?'Nije uspelo':('Poslato '+poslato+' ✓');
    alert(greska
      ? (greska+(poslato?'\n\nDo prekida je poslato: '+poslato+'. Ponovni poziv nastavlja odatle, bez duplikata.':''))
      : ('Poslato: '+poslato+(palo?' · nije stiglo: '+palo:'')));
    setTimeout(()=>{ b.disabled=false; b.textContent='Pošalji svima…'; },2600);
  };
  if($('#icu-push2')) $('#icu-push2').onclick=async e=>{
    const n=icuDaniZaSlanje(14).length;
    if(!n){ alert('Nema treninga u narednih 14 dana.'); return; }
    if(!confirm('Obrisati '+n+' '+pl3(n,'ranije poslat trening','ranije poslata treninga','ranije poslatih treninga')+' i napraviti ih iz početka?\n\nBriše se samo ono što je poslala ova aplikacija — ostalo u kalendaru se ne dira.\n\nOvo je potrebno posle unosa praga tempa: Garmin izvoz se pravi kad događaj nastane, pa obično ažuriranje ne pomaže.')) return;
    const b=e.target; b.disabled=true; b.textContent='Šaljem…';
    const r=await icuPosalji(14, true);
    b.textContent=r.ok?('Poslato '+r.n+' ✓'):'Nije uspelo';
    if(!r.ok) alert(r.error||'Nije uspelo.');
    if(r.ok) setTimeout(osveziPodesavanja,900);
    else setTimeout(()=>{ b.disabled=false; b.textContent='♻️ Obriši i pošalji iz početka'; },2200);
  };
  if($('#icu-push')) $('#icu-push').onclick=async e=>{
    const n=icuDaniZaSlanje(14).length;
    if(!n){ alert('Nema treninga u narednih 14 dana.'); return; }
    if(!confirm('Poslati '+n+' treninga u intervals.icu kalendar?\n\nPostojeći koje je poslala ova aplikacija biće ažurirani, ostali se ne diraju.')) return;
    const b=e.target; b.disabled=true; b.textContent='Šaljem…';
    const r=await icuPosalji(14);
    b.textContent=r.ok?('Poslato '+r.n+' ✓'):'Nije uspelo';
    if(!r.ok&&r.error) setTimeout(()=>alert(r.error),100);
    /* Kratko odlaganje da se „Poslato ✓" vidi, pa tek onda ponovo iscrtaj —
       posle toga i vrh ekrana i red sekcije govore isto. */
    if(r.ok) setTimeout(osveziPodesavanja,900);
    else setTimeout(()=>{ b.disabled=false; b.textContent='📤 Pošalji treninge na sat (14 dana)'; },2200);
  };
  if($('#icu-off')) $('#icu-off').onclick=()=>{ if(confirm('Otkačiti intervals.icu? Već povučeni podaci ostaju.')){ S.icu=null; save(); closeSheet(); } };
  if($('#icu-sync')) $('#icu-sync').onclick=async e=>{
    const b=e.target; b.disabled=true; b.textContent='Povlačim…';
    const r=await icuSyncSve(120, true);
    if(r.ok){
      /* Sažetak imenuje SVE tri stvari koje su stigle — inače se ne vidi da je
         jedno dugme stvarno odradilo i merenja i trčanja. */
      const d=['merenja '+r.zapisa];
      if(r.trcanja!=null) d.push('trčanja '+r.trcanja, 'krugovi '+r.krugova);
      b.textContent=d.join(' · ')+' ✓';
      if(r.trBez) setTimeout(()=>alert('Jutarnja merenja su povučena.\n\nTreninzi nisu: '+r.trBez),150);
      renderHeader(); PAGES[ACTIVE]();
      setTimeout(osveziPodesavanja,900);
    } else {
      b.textContent='Nije uspelo';
      if(r.error) setTimeout(()=>alert(r.error),100);
      setTimeout(()=>{ b.disabled=false; b.textContent='Povuci sve'; },1500);
    }
  };
  if($('#ob-red')) osveziObavestenja();
  /* Stanje offline kopije se čita ASINHRONO — ne sme da drži otvaranje
     Podešavanja. Do odgovora stoji „Proveravam…". */
  if($('#sw-osvezi')) $('#sw-osvezi').onclick=e=>osveziAplikaciju(e.target);
  if($('#sw-stanje')) swStanje().then(st=>{
    const el=$('#sw-stanje'); if(!el) return;
    if(!st.podrzan){ el.textContent='Ovaj pregledač ne čuva offline kopiju.'; return; }
    if(st.ceka){
      el.innerHTML='<b style="color:var(--amber)">Nova verzija je preuzeta i čeka.</b> Dodirni „Osveži aplikaciju" — ništa se ne gubi, podaci ostaju.';
      return;
    }
    if(st.aktivna && st.aktivna!==APP_VERSION){
      el.innerHTML='Offline kopija je na verziji <b>'+esc(st.aktivna)+'</b>, a učitan kod na <b>'+esc(APP_VERSION)+'</b>. Dok si na mreži radiš na novom kodu; „Osveži aplikaciju" izjednačava i offline kopiju.';
      return;
    }
    if(st.aktivna){ el.textContent='Offline kopija je na verziji '+st.aktivna+' — usklađena.'; return; }
    /* Bez odgovora: ili SW još nije preuzeo kontrolu (prvo otvaranje), ili je
       stariji od ove izmene pa ne zna za poruku VERSION. */
    el.textContent=st.kesevi.length
      ? 'Offline kopija: '+st.kesevi.join(', ')+'. Verziju javlja tek sledeći service worker.'
      : 'Offline kopija se još pravi — otvori aplikaciju ponovo za koji trenutak.';
  });
  if($('#vr-on')) $('#vr-on').onclick=async e=>{
    const b=e.target;
    if(!navigator.geolocation){ alert('Ovaj pregledač ne ume da odredi lokaciju.'); return; }
    b.disabled=true; b.textContent='Tražim lokaciju…';
    const vrati=()=>{ b.disabled=false; b.textContent='Uključi lokaciju'; };

    /* Ako je dozvola već odbijena, nema šta da se čeka — pitanje se neće ni
       pojaviti, samo bi 12 s stajalo „Tražim lokaciju…" pa javilo grešku. */
    if(await geoOdbijena()){ vrati(); alert(geoPoruka({code:1})); return; }

    let poz=null, greska=null;
    try{ poz=await geoTrazi({ enableHighAccuracy:false, timeout:12000, maximumAge:600000 }); }
    catch(err){
      /* ISTEK NIJE ODGOVOR. U zatvorenom prostoru je 12 s bez GPS-a često
         premalo za prvi fiks, a jedini trag koji je čovek do sada dobijao bio
         je „nije dostupna" — isto što piše i kad je lokacija ugašena. Zato
         jedan duži pokušaj, sada i preko GPS-a, pre nego što se odustane. */
      if(err&&err.code===3){
        b.textContent='Još tražim…';
        try{ poz=await geoTrazi({ enableHighAccuracy:true, timeout:30000, maximumAge:600000 }); }
        catch(err2){ greska=err2; }
      } else greska=err;
    }
    if(!poz){ vrati(); alert(geoPoruka(greska)); return; }

    /* Dve decimale su ~1 km — dovoljno za prognozu, a ne pokazuje gde stanuješ. */
    S.ui.geo={ lat:Math.round(poz.coords.latitude*100)/100, lon:Math.round(poz.coords.longitude*100)/100 };
    save();
    const r=await vremePovuci(true);
    if(!r.ok) alert(r.error);
    osveziPodesavanja();
    if(ACTIVE==='danas') renderDanas();
  };
  if($('#vr-off')) $('#vr-off').onclick=()=>{
    S.ui.geo=null; S.vreme=null; save(); osveziPodesavanja();
    if(ACTIVE==='danas') renderDanas();
  };
  if($('#vr-sat')) $('#vr-sat').onchange=e=>{
    S.ui.satTreninga=+e.target.value; save();
    if(ACTIVE==='danas') renderDanas();
    setTimeout(osveziPodesavanja,200);
  };
  if($('#vr-osvezi')) $('#vr-osvezi').onclick=async e=>{
    const b=e.target; b.disabled=true; b.textContent='Povlačim…';
    const r=await vremePovuci(true);
    b.textContent=r.ok?'Osveženo ✓':'Nije uspelo';
    if(!r.ok&&r.error) setTimeout(()=>alert(r.error),100);
    if(ACTIVE==='danas') renderDanas();
    setTimeout(osveziPodesavanja,900);
  };
  const so=$('#st-on'),ss=$('#st-sync'),sf=$('#st-off');
  if(so)so.onclick=stravaConnect;
  if(ss)ss.onclick=()=>{ss.disabled=true;ss.textContent='Sinhronizujem…';sinhronizujTreninge(true).finally(()=>closeSheet());};
  if(sf)sf.onclick=stravaDisconnect;
  const pg=$('#pl-gen'),pr=$('#pl-revert'),pn=$('#pl-new');
  if(pg)pg.onclick=openWizard;
  /* Novi plan PREKO postojeceg. Stari unosi se moraju obrisati pre toga:
     generisani dani nose ID-jeve po istom obrascu ('g3d5'), pa bi se unosi
     starog plana zalepili za dane novog. Isti razlog kao kod "Vrati na moj
     plan", samo bez plana na koji se vraca. */
  if(pn)pn.onclick=()=>{
    if(!confirm('Napraviti nov plan?\n\nPostojeći plan i svi unosi uz njega se TRAJNO brišu — nema arhive.\n\nAko ti trebaju, prvo izvezi backup.'))return;
    purgeGenPlanData();
    S.genPlan=null;setActivePlan();rebuildDateIndex();save();closeSheet();openWizard();
  };
  if(pr)pr.onclick=()=>{
    if(!confirm('Vratiti se na tvoj originalni plan? Generisan plan se TRAJNO briše (napredak/unosi uz njega takođe) — nema arhive.\n\nTvoj plan i njegova istorija se vraćaju netaknuti.'))return;
    /* Ranije se brisao samo S.genPlan, a njegovi 'g' unosi su ostajali kao
       siročići u S.log/S.pred/S.vdotLog — nevidljivi, ali su se lepili za
       sledeći generisan plan (isti 'g' ID-jevi). Sad odlaze zajedno sa planom,
       tačno kako gornja poruka i obećava. */
    purgeGenPlanData();
    S.genPlan=null;setActivePlan();rebuildDateIndex();save();closeSheet();
  };

  /* DUGME NA VRHU RADI ISTO ŠTO I DUGME U SEKCIJI — bukvalno ga pritisne.
     Namerno se ne duplira logika: da hero ima svoju kopiju poziva, dve bi
     radnje vremenom otišle svaka na svoju stranu (jedna traži potvrdu, druga
     ne; jedna menja natpis dok radi, druga ne). Ovako postoji jedno mesto po
     radnji, a vrh je samo prečica do njega.
     Veže se POSLE svih ostalih slušalaca — u trenutku kad ciljno dugme već
     ima svoj `onclick`. */
  const precica=(hero,cilj)=>{
    const b=$('#'+hero); if(!b) return;
    b.onclick=()=>{
      const c=$('#'+cilj); if(!c) return;
      /* Sekcija se prvo OTVORI. Bez toga se radnja izvrši u sklopljenoj kartici,
         pa dugme koje menja natpis („Šaljem…", „Poslato ✓") radi nevidljivo i
         vrh ekrana deluje kao da se ništa nije desilo. */
      const d=c.closest&&c.closest('details'); if(d) d.open=true;
      c.click();
    };
  };
  precica('hero-nalog','sb-in');
  precica('hero-strava','st-on');
  precica('hero-icu','icu-oauth');
  precica('hero-sat','icu-push');
  precica('hero-backup','s-exp');
}
function openBugSheet(){
  openSheet(`
    <div class="sh-t">Prijavi problem</div>
    <div class="sh-s">Opiši šta se desilo — stiže direktno na mejl.</div>
    <textarea id="bug-desc" rows="5" placeholder="Npr. kad dodirnem „Završi trening" na tabu Danas, ništa se ne desi…" style="width:100%;margin-top:10px;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:12px;color:var(--txt);font-size:.9rem;resize:vertical"></textarea>
    <div class="note-src" id="bug-err" style="color:var(--red)"></div>
    <div class="btnrow" style="margin-top:10px"><button class="btn" id="bug-send">Pošalji</button></div>
  `);
  const btn=$('#bug-send'), err=$('#bug-err'), ta=$('#bug-desc');
  btn.onclick=async()=>{
    const description=(ta.value||'').trim();
    if(!description){ err.textContent='Napiši šta se desilo.'; return; }
    btn.disabled=true; btn.textContent='Šalje se…'; err.textContent='';
    try{
      const tok=await sbToken();
      if(!tok){ err.textContent='Moraš biti prijavljen.'; btn.disabled=false; btn.textContent='Pošalji'; return; }
      const r=await fetch('/api/report-bug',{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
        body:JSON.stringify({description,context:{version:APP_VERSION,tab:ACTIVE,userAgent:navigator.userAgent}})});
      const res=await apiJson(r);
      if(!res.data||!res.data.ok){ throw new Error((res.data&&res.data.error)||res.error||'Nepoznata greška'); }
      btn.textContent='Poslato ✓';
      setTimeout(closeSheet,900);
    }catch(e){
      err.textContent=e.message;
      btn.disabled=false; btn.textContent='Pošalji';
    }
  };
}

/* BRISANJE NALOGA — nepovratna radnja, pa ide kroz kucanje potvrde.
   Ne `confirm()`: instalirane PWA i deo pregledaca ga prigusuju i tada vraca
   `false` (ista zamka je vec opisana u prikaziSukobSync). Ovde bi prigusen
   dijalog znacio da dugme ne radi, sto je bezbedan ali nerazumljiv ishod —
   a Play trazi da put do brisanja POSTOJI iz aplikacije. Kucanje potvrde
   radi svuda i istovremeno je jedina prava zastita od slucajnog dodira.

   Isti tekst prima i server (v. POTVRDA u api/delete-account.js); ako se ta
   dva razidju, brisanje tiho prestane da radi — drzi ih test „potvrda iz
   aplikacije je ista kao na serveru". */
const DEL_POTVRDA='OBRISI NALOG';
function openObrisiNalogSheet(){
  openSheet(`
    <div class="sh-t">Obriši nalog</div>
    <div class="sh-s">Nepovratno. Sa servera nestaju plan, istorija treninga, merenja oporavka i prijave za obaveštenja.</div>
    <div class="kb warn" style="margin-top:10px"><div><div>Napravi backup pre ovoga</div><small>Podešavanja → „Backup" preuzima kopiju na uređaj. Posle brisanja je više nema odakle vratiti.</small></div></div>
    <div class="set-st" style="margin-top:12px">Za potvrdu ukucaj <b>${DEL_POTVRDA}</b>:</div>
    <input id="del-pot" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${DEL_POTVRDA}" style="width:100%;margin-top:6px;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:12px;color:var(--txt);font-size:.95rem;font-weight:700;letter-spacing:.04em">
    <div class="note-src" id="del-err" style="color:var(--red)"></div>
    <div class="btnrow" style="margin-top:10px"><button class="btn danger" id="del-go" disabled>Obriši nalog</button></div>
  `);
  const btn=$('#del-go'), err=$('#del-err'), inp=$('#del-pot');
  const uredi=v=>String(v||'').toUpperCase().replace(/Š/g,'S').replace(/\s+/g,' ').trim();
  inp.oninput=()=>{ btn.disabled=uredi(inp.value)!==DEL_POTVRDA; err.textContent=''; };
  btn.onclick=async()=>{
    if(uredi(inp.value)!==DEL_POTVRDA) return;
    btn.disabled=true; btn.textContent='Brišem…'; err.textContent='';
    try{
      const tok=await sbToken();
      if(!tok) throw new Error('Moraš biti prijavljen.');
      const r=await fetch('/api/delete-account',{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
        body:JSON.stringify({potvrda:DEL_POTVRDA})});
      const res=await apiJson(r);
      if(!res.data||!res.data.ok){ throw new Error((res.data&&res.data.error)||res.error||'Nepoznata greška'); }
      btn.textContent='Obrisano ✓';
      await lokalnoZaboraviSve();
      closeSheet();
      /* Nazad na kapiju, sa objasnjenjem — bez ovoga bi ekran izgledao kao
         obicna odjava i covek ne bi znao da li je brisanje proslo. */
      sbShowGate('Nalog i svi podaci su obrisani.');
    }catch(e){
      err.textContent=e.message;
      btn.disabled=false; btn.textContent='Obriši nalog';
    }
  };
}

/* Uklanja SVE tragove naloga sa ovog uredjaja. Zove se tek posle potvrdjenog
   brisanja na serveru — ne sme ranije, jer bi neuspelo brisanje ostavilo
   coveka bez lokalnih podataka a sa nalogom koji i dalje postoji. */
async function lokalnoZaboraviSve(){
  /* Pretplata na obavestenja se gasi BEZ poziva servera: red u bazi je vec
     obrisan, a token vise ne vazi (naloga nema), pa bi `pushIskljuci` samo
     dobio 401. Ovde je dovoljno da pregledac zaboravi svoju pretplatu. */
  try{ const sub=await pushPretplataSada(); if(sub) await sub.unsubscribe(); }catch(e){}
  try{ await periodicnaOdjava(); }catch(e){}
  try{ await pozadinskiZaboravi(); }catch(e){}
  for(const k of [LS_KEY,LS_SPAS_KEY,SB_KEY,SB_STATE_KEY,ICU_STATE_KEY,STRAVA_STATE_KEY]){
    try{ localStorage.removeItem(k); }catch(e){}
  }
  SB={access:null,refresh:null,expiresAt:0,email:null,userId:null,slika:null,ime:null,seenAt:null,deviceId:SB.deviceId};
}

/* SPISAK KORISNIKA — samo vlasnik.

   `jeVlasnik()` ovde sluzi SAMO da se dugme ne iscrtava drugima. Prava kapija
   je na serveru (v. api/admin-users.js): token se proverava kod Supabase-a i
   procitana adresa poredi sa ADMIN_EMAIL. Ko god pozove putanju bez toga
   dobija 404 — namerno 404 a ne 403, da se ne potvrdi ni da putanja postoji.

   BRISANJE IDE NA DVA DODIRA, ne kroz `confirm()`. Instalirane PWA umeju da
   prigusе sistemski dijalog i tada vraca `false` (ista zamka je opisana u
   prikaziSukobSync) — a ovde bi to znacilo da dugme naizgled ne radi. Dva
   dodira rade svuda i jednako dobro sprecavaju slucajan dodir. Kucanje
   potvrde kao kod brisanja SOPSTVENOG naloga bilo bi previse: tamo se brise
   jednom u zivotu, ovde se cisti vise probnih naloga zaredom. */
/* LOZINKA ZA RAZORNE RADNJE — u memoriji, nikad na disku.
   Stoji samo dok je list otvoren. Da se čuva u localStorage-u, bila bi na istom
   uređaju kao i sesija — a ceo smisao je da napadač sa ukradenom sesijom NEMA
   drugi faktor. */
let ADMIN_LOZ = '';

function openKorisniciSheet(){
  openSheet(`
    <div class="sh-t">Korisnici</div>
    <div class="sh-s">Svi nalozi, poređani po poslednjoj prijavi.</div>
    <div class="f-field full" style="margin-bottom:12px">
      <label for="ku-loz">Lozinka za brisanje i zabranu</label>
      <input id="ku-loz" type="password" placeholder="ADMIN_2FA iz Vercel-a" autocomplete="off">
    </div>
    <div class="note-src" style="margin:-6px 0 12px">Traži se samo za razorne radnje. Ne pamti se — kucaš je svaki put kad otvoriš ovaj spisak.</div>
    <div id="ku-zakazano"></div>
    <div id="ku-lista"><div class="note-src">Učitavam…</div></div>
  `);
  const l=$('#ku-loz');
  if(l) l.oninput=e=>{ ADMIN_LOZ=String(e.target.value||''); };
  ADMIN_LOZ='';
  ucitajZakazana();
  ucitajKorisnike();
}

/* Nalozi označeni za brisanje kojima rok još nije istekao. Stoje na vrhu jer
   su jedina stavka na ovom ekranu koja ima ROK — sve ostalo čeka koliko treba. */
async function ucitajZakazana(){
  const box=$('#ku-zakazano'); if(!box) return;
  try{
    const tok=await sbToken();
    if(!tok) return;
    const r=await fetch('/api/broadcast',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
      body:JSON.stringify({admin:'zakazano'})});
    const res=await apiJson(r);
    if(!res.data||!res.data.ok) return;
    const z=res.data.zakazano||[];
    if(!z.length){ box.innerHTML=''; return; }
    box.innerHTML=`<div class="card" style="border-color:var(--amber)">
      <div class="dhead"><span class="card-t">Označeno za brisanje</span><span class="dhead-x">${z.length}</span></div>
      <div class="set-st">Pristup im je već zabranjen. Podaci se brišu kad rok istekne — do tada se sve vraća jednim dodirom.</div>
      ${z.map(x=>`<div class="ztrow">
        <div class="ztt">${esc(x.email||x.user_id)}<small>briše se ${esc(fmtDY(String(x.izvrsi_posle).slice(0,10)))}</small></div>
        <button class="btn ghost sm" data-ku-vrati="${esc(x.user_id)}">Poništi</button>
      </div>`).join('')}
    </div>`;
    box.querySelectorAll('[data-ku-vrati]').forEach(b=>b.onclick=async()=>{
      b.disabled=true; b.textContent='Vraćam…';
      try{
        const tok2=await sbToken();
        const r2=await fetch('/api/broadcast',{method:'POST',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok2},
          body:JSON.stringify({admin:'ponisti', obrisiId:b.dataset.kuVrati})});
        const res2=await apiJson(r2);
        if(!res2.data||!res2.data.ok) throw new Error((res2.data&&res2.data.error)||res2.error||'Nije uspelo.');
        ucitajZakazana(); ucitajKorisnike();
      }catch(e){ b.disabled=false; b.textContent='Poništi'; alert(e.message); }
    });
  }catch(e){ /* spisak označenih je dodatak — njegov neuspeh ne ruši ekran */ }
}
async function ucitajKorisnike(){
  const box=$('#ku-lista'); if(!box) return;
  try{
    const tok=await sbToken();
    if(!tok) throw new Error('Nisi prijavljen.');
    const r=await fetch('/api/broadcast',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
      body:JSON.stringify({admin:'lista'})});
    const res=await apiJson(r);
    if(!res.data||!res.data.ok) throw new Error((res.data&&res.data.error)||res.error||'Nije uspelo.');
    const k=res.data.korisnici||[];
    if(!k.length){ box.innerHTML='<div class="note-src">Nema nijednog naloga.</div>'; return; }
    const kada=s=>{ if(!s) return 'nikad'; const d=new Date(s); return isNaN(d)?'—':fmtD(d.toISOString().slice(0,10)); };
    box.innerHTML=`<div class="note-src" style="margin:10px 0 8px">${k.length} ${pl3(k.length,'nalog','naloga','naloga')}</div>`+
      k.map(u=>`<div class="prow-ku" data-id="${esc(u.id)}" style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--line)">
        <div style="flex:1;min-width:0">
          <div style="font-size:.84rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.email)}${u.jaSam?' <span style="color:var(--cyan);font-weight:800">· ti</span>':''}</div>
          <div style="font-size:.68rem;color:var(--txt3);font-weight:600;margin-top:2px">prijava ${esc(kada(u.poslednjaPrijava))} · ${u.imaPodatke?'ima podatke':'prazan'}${u.zabranjen?' · <b style="color:var(--red)">zabranjen</b>':''}</div>
        </div>
        ${u.jaSam?'':`<button class="btn ghost sm" data-ku-ban="${esc(u.id)}" data-ku-ukini="${u.zabranjen?'1':''}">${u.zabranjen?'Odbrani':'Zabrani'}</button>
        <button class="btn danger sm" data-ku-del="${esc(u.id)}" data-ku-mail="${esc(u.email)}">Obriši</button>`}
      </div>`).join('')+
      `<div class="note-src" style="margin-top:10px">Brisanje uklanja nalog i <b>sve</b> njegove podatke sa servera. Nepovratno je. Svoj nalog ne brišeš odavde — za to je Nalog → Brisanje naloga.</div>`;
    /* Zabrana ide na JEDAN dodir, brisanje na dva — zabrana se skida istim
       dugmetom, pa pogresan dodir kosta jedan dodir nazad. Brisanje ne. */
    box.querySelectorAll('[data-ku-ban]').forEach(b=>{
      b.onclick=async()=>{
        const ukini=b.dataset.kuUkini==='1';
        b.disabled=true; b.textContent=ukini?'Skidam…':'Zabranjujem…';
        try{
          const tok=await sbToken();
          const r=await fetch('/api/broadcast',{method:'POST',
            headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
            body:JSON.stringify({admin:'ban', banId:b.dataset.kuBan, ukini, lozinka:ADMIN_LOZ})});
          const res=await apiJson(r);
          if(!res.data||!res.data.ok) throw new Error((res.data&&res.data.error)||res.error||'Nije uspelo.');
          ucitajKorisnike();
        }catch(e){
          b.disabled=false; b.textContent=ukini?'Odbrani':'Zabrani';
          alert(e.message);
        }
      };
    });
    box.querySelectorAll('[data-ku-del]').forEach(b=>{
      b.onclick=async()=>{
        if(b.dataset.pitano!=='1'){
          b.dataset.pitano='1'; b.textContent='Sigurno?';
          /* Vraca se samo od sebe — dugme koje zauvek stoji u stanju „Sigurno?"
             je mina za sledeci dodir. */
          setTimeout(()=>{ if(b.dataset.pitano==='1'){ b.dataset.pitano=''; b.textContent='Obriši'; } },4000);
          return;
        }
        b.disabled=true; b.textContent='Brišem…';
        try{
          const tok=await sbToken();
          const r=await fetch('/api/broadcast',{method:'POST',
            headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
            body:JSON.stringify({admin:'obrisi', obrisiId:b.dataset.kuDel, lozinka:ADMIN_LOZ})});
          const res=await apiJson(r);
          if(!res.data||!res.data.ok) throw new Error((res.data&&res.data.error)||res.error||'Nije uspelo.');
          ucitajZakazana();
          ucitajKorisnike();          /* spisak se povlaci ponovo, ne krpi lokalno */
        }catch(e){
          b.disabled=false; b.dataset.pitano=''; b.textContent='Obriši';
          alert(e.message);
        }
      };
    });
  }catch(e){
    box.innerHTML=`<div class="note-src" style="color:var(--red)">${esc(e.message)}</div>`;
  }
}

/* STA SME U BACKUP FAJL — jedno mesto, jedna politika.
   Ranije je stajalo samo `delete copy.strava` uz komentar „tokeni ne idu u
   backup fajl". Strava jeste bila skinuta, ali `S.icu` NIJE — a on nosi
   intervals.icu OAuth token (po njihovoj dokumentaciji NE ISTICE) odnosno
   rucno unet API kljuc. Backup fajl zavrsi u Downloads folderu i u mejlu, pa
   je to bio trajan pristup tudjim zdravstvenim podacima (HRV, puls u miru,
   san) i pravo pisanja u kalendar. Ista politika je vec bila ispravno
   primenjena na sinhronizaciju (sbPayload) — samo se izvoz razisao sa njom.
   Sada obe putanje skidaju pristupne podatke, a testovi to proveravaju.

   SAMI PODACI o oporavku (S.wellness) OSTAJU — to su merenja, ne kljucevi. */
function backupPayload(){
  const copy=JSON.parse(JSON.stringify(S));
  delete copy.strava;   /* access/refresh token */
  delete copy.icu;      /* OAuth token i API kljuc */
  return copy;
}
/* ============================================================
   ID-JEVI IZ UVEZENOG FAJLA — GRANICA POVERENJA.

   Svaki ID u stanju je MASINSKI generisan i uvek istog oblika:
     dani            n1d1, n6t, g12d3
     PRED redovi     p1, p2b, g3_1
     koleno          k1, k1751376000000, kt-n1d1
   Nista od toga ne sadrzi navodnik, razmak ni znak <.

   Zasto je ovo BEZBEDNOSNA, a ne kozmeticka provera: ID dana zavrsava u HTML
   ATRIBUTIMA (id="ai-go-...", data-swd="...", data-wseg="..."). Uvoz backupa
   prihvata proizvoljan JSON, pa je ID iz fajla bio direktan put za ubacivanje
   HTML-a. Dokazano napadom: dan sa
       id = "\"><img src=x onerror=...>"
   izlazi iz atributa i izvrsava proizvoljan kod, koji odatle cita
   localStorage — dakle Supabase sesiju, Strava i intervals.icu tokene.
   CSP tu ne pomaze jer skripta mora da dozvoli 'unsafe-inline' (aplikacija
   JESTE jedna velika inline skripta).

   Odbrana je na DVA nivoa, namerno:
   (1) ovde — sumnjiv fajl se odbija u celosti, pre nego sto dodirne S;
   (2) na svakom mestu iscrtavanja — esc() oko svake interpolacije.
   Jedan nivo je dovoljan da napad ne prodje; dva su tu jer se sutra doda nova
   kartica koja zaboravi esc(). ============================================ */
/* ID_OBLIK i validanId ZIVE GORE, iznad migrate() — v. komentar tamo. */
/* Da li je `genPlan` iz uvezenog fajla upotrebljiv. setActivePlan() radi
   `S.genPlan.weeks` a rebuildDateIndex() zatim `CUR_PLAN.forEach(w=>w.days…)`
   — pokvaren ili rucno izmenjen backup je tu obarao aplikaciju POSLE zamene
   S, pa je stanje ostajalo razbijeno u memoriji i prvi sledeci save() bi ga
   trajno upisao. Zato se oblik proverava PRE zamene. */
function validanGenPlan(g){
  if(g==null) return true;                       /* nema generisanog plana — licni je aktivan */
  if(typeof g!=='object'||Array.isArray(g)) return false;
  if(!Array.isArray(g.weeks)||!g.weeks.length) return false;
  const daniOk = g.weeks.every(w=>
    w && typeof w==='object' &&
    typeof w.start==='string' && /^\d{4}-\d{2}-\d{2}$/.test(w.start) &&
    Array.isArray(w.days) && w.days.length>0 &&
    w.days.every(d=> d && typeof d==='object' &&
      typeof d.dow==='number' && d.dow>=0 && d.dow<=7 &&
      (d.km==null || (typeof d.km==='number' && isFinite(d.km))) &&
      (d.id==null || validanId(d.id)))
  );
  if(!daniOk) return false;
  /* PRED redovi zavrsavaju u data-wseg/data-wpin/data-q atributima. */
  if(g.pred!=null){
    if(!Array.isArray(g.pred)) return false;
    const predOk = g.pred.every(r=> r && typeof r==='object' &&
      validanId(r.id) &&
      (r.q==null || (typeof r.q==='number' && isFinite(r.q))) &&
      (r.pt==null || (typeof r.pt==='number' && isFinite(r.pt))) &&
      (r.l==null || typeof r.l==='string'));
    if(!predOk) return false;
  }
  if(g.qs!=null && (typeof g.qs!=='object'||Array.isArray(g.qs))) return false;
  if(g.qs && Object.keys(g.qs).some(k=>!validanId(k))) return false;
  return true;
}
/* Svi ostali ID-jevi u stanju: kljucevi mapa vezanih za dane/PRED redove i
   ID-jevi unosa o povredama. Vraca naziv prvog problematicnog mesta ili null. */
function losIdUStanju(st){
  if(!st || typeof st!=='object') return 'stanje';
  const mape={log:st.log, pred:st.pred, predLock:st.predLock, alts:st.alts, moves:st.moves};
  for(const [ime,m] of Object.entries(mape)){
    if(m==null) continue;
    if(typeof m!=='object'||Array.isArray(m)) return ime;
    for(const k of Object.keys(m)) if(!validanId(k)) return ime+' → '+String(k).slice(0,40);
  }
  if(Array.isArray(st.vdotLog))
    for(const e of st.vdotLog) if(e&&e.id!=null&&!validanId(e.id)) return 'vdotLog';
  if(Array.isArray(st.t3k))
    for(const t of st.t3k) if(t&&t.id!=null&&!validanId(t.id)) return 't3k.id';
  if(Array.isArray(st.knee))
    for(const k of st.knee){
      if(k&&k.id!=null&&!validanId(k.id)) return 'knee.id';
      if(k&&k.src!=null&&!validanId(k.src)) return 'knee.src';
    }
  if(Array.isArray(st.kg))
    for(const x of st.kg) if(x&&x.src!=null&&!validanId(x.src)) return 'kg.src';
  return null;
}
/* Preuzimanje teksta kao fajla. Izdvojeno iz exportBackup() da bi i traka za
   osteceno stanje mogla da ponudi spaseni sadrzaj — inace bi ista petlja sa
   createObjectURL/revokeObjectURL stajala na dva mesta. */
function preuzmiTekst(ime, tekst){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([tekst],{type:'application/json'}));
  a.download=ime;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
function exportBackup(){
  const copy=backupPayload();
  const data={app:'SUB-19',exportedAt:new Date().toISOString(),state:copy};
  preuzmiTekst('sub19-backup-'+TODAY+'.json', JSON.stringify(data,null,1));
  S.ui.lastBackup=TODAY;S.ui.snooze=null;save();
  if(ACTIVE==='danas')renderDanas();
}
function importBackup(file){
  if(!file)return;
  const fr=new FileReader();
  fr.onload=()=>{
    try{
      const raw=JSON.parse(fr.result);
      const st=migrate(raw.state||raw);
      if(!st){alert('Fajl nije prepoznat kao backup ove aplikacije ili je napravljen u novijoj verziji — ažuriraj aplikaciju pa pokušaj ponovo.');return;}
      if(!validanGenPlan(st.genPlan)){
        alert('Backup sadrži oštećen generisan plan, pa nije uvezen — ništa nije promenjeno.\n\nTvoji trenutni podaci su netaknuti.');
        return;
      }
      /* ID-jevi iz fajla zavrsavaju u HTML atributima (v. ID_OBLIK gore) —
         sumnjiv fajl se odbija PRE nego sto dodirne S. */
      const los=losIdUStanju(st);
      if(los){
        alert('Backup sadrži neispravan identifikator ('+los+'), pa nije uvezen — ništa nije promenjeno.\n\n'+
              'Ovo se dešava kod ručno izmenjenog fajla. Tvoji trenutni podaci su netaknuti.');
        return;
      }
      if(!confirm(`Uvoz će PREPISATI postojeće podatke.\n\nU fajlu: ${Object.keys(st.log).length} trening-unosa, ${st.knee.length} koleno, ${st.kg.length} težina.\n\nNastaviti?`))return;
      /* Veze su po UREDJAJU i ne putuju kroz fajl (v. backupPayload) — zato se
         zadrzavaju postojece, isto za Stravu i za intervals.icu. */
      st.strava=st.strava||S.strava;
      st.icu=st.icu||S.icu;
      /* Aktivacija se radi tek posle provere; ako i pored svega pukne, vraca se
         prethodno stanje da aplikacija ne ostane razbijena do restarta. */
      const prethodno=S;
      try{
        S=st;setActivePlan();rebuildDateIndex();save();closeSheet();
      }catch(e2){
        S=prethodno;setActivePlan();rebuildDateIndex();
        alert('Uvoz nije uspeo: '+e2.message+'\n\nVraćeno je prethodno stanje.');
      }
    }catch(e){alert('Greška pri čitanju fajla: '+e.message);}
  };
  fr.readAsText(file);
}

/* ---------- STRAVA ---------- */
/* CSRF zastita OAuth toka. Bez `state` parametra napadac moze da posalje
   link `…/?code=NJEGOV_KOD` — tvoja aplikacija bi se povezala na NJEGOV
   Strava nalog i pocela da uvlaci njegove treninge kao tvoje. `state` je
   nasumican niz koji pravimo pre odlaska i proveravamo po povratku.
   localStorage (ne sessionStorage) jer PWA na iOS-u ume da izgubi sesijsko
   skladiste pri povratku sa spoljne stranice. Rok 10 minuta. */
const STRAVA_STATE_KEY='sub19_st_state';
/* Kriptografski nasumican niz — Math.random() NIJE bezbedan za bezbednosne
   tokene (predvidljiv PRNG). crypto.getRandomValues jeste, podrzano svuda
   gde postoji fetch(). */
function secureRandomToken(){
  const a=new Uint8Array(20); crypto.getRandomValues(a);
  return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');
}
function stravaMakeState(){
  const st=secureRandomToken();
  try{ localStorage.setItem(STRAVA_STATE_KEY, JSON.stringify({st,exp:Date.now()+600000})); }catch(e){}
  return st;
}
function stravaCheckState(got){
  let saved=null;
  try{ saved=JSON.parse(localStorage.getItem(STRAVA_STATE_KEY)||'null'); }catch(e){}
  try{ localStorage.removeItem(STRAVA_STATE_KEY); }catch(e){}   /* jednokratno */
  if(!saved||!saved.st) return false;
  if(Date.now()>saved.exp) return false;
  return got===saved.st;
}
function stravaConnect(){
  location.href='https://www.strava.com/oauth/authorize?client_id='+STRAVA_CLIENT_ID
    +'&response_type=code&redirect_uri='+encodeURIComponent(location.origin+'/')
    +'&approval_prompt=auto&scope=activity:read_all'
    +'&state='+encodeURIComponent(stravaMakeState());
}
function stravaDisconnect(){
  if(!confirm('Otkači Stravu? Uvezeni podaci ostaju, samo prestaje sinhronizacija.'))return;
  S.strava=null;save();closeSheet();
}
/* Naše /api putanje mogu vratiti i NE-JSON: kad se serverless funkcija sruši,
   Vercel pošalje HTML "A server error has occurred". Direktan `r.json()` tada
   baca poruku parsera ("...is not valid JSON" / "The string did not match the
   expected pattern") koja korisniku ne znači ništa i skriva pravi uzrok.
   Ovo uvek vraća upotrebljivu poruku. */
async function apiJson(resp){
  const txt=await resp.text();
  let data=null;
  try{ data=JSON.parse(txt); }catch(e){}
  if(data) return { ok:resp.ok, data };
  /* nije JSON — server je pao ili vratio stranicu */
  const kratko=(txt||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,120);
  return { ok:false, data:null,
    error: resp.status===401 ? 'Nisi prijavljen — prijavi se ponovo.'
         : resp.status===404 ? 'Serverska putanja ne postoji (proveri da su fajlovi u api/ folderu).'
         : 'Server je vratio grešku ('+resp.status+')'+(kratko?': '+kratko:'') };
}
async function ensureToken(){
  if(!S.strava)throw new Error('Strava nije povezana');
  if(S.strava.expiresAt*1000>Date.now()+300000)return;
  const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+(await sbToken())},body:JSON.stringify({refresh_token:S.strava.refresh})});
  const res=await apiJson(r);
  if(!res.data) throw new Error('Osvežavanje Strava tokena nije uspelo — '+res.error);
  const j=res.data;
  if(!r.ok||!j.access_token)throw new Error('Osvežavanje tokena nije uspelo'+(j.message?': '+j.message:''));
  S.strava.access=j.access_token;S.strava.refresh=j.refresh_token||S.strava.refresh;S.strava.expiresAt=j.expires_at;save();
}
async function stApi(path,_retried){
  await ensureToken();
  const r=await fetch('https://www.strava.com/api/v3'+path,{headers:{Authorization:'Bearer '+S.strava.access}});
  if(r.ok)return r.json();
  let body=null;try{body=await r.json();}catch(e){}
  const msg=(body&&body.message)?body.message:'';
  if(r.status===401&&!_retried){
    /* istekao/opozvan access token — jedan forsirani refresh pa ponovi */
    try{S.strava.expiresAt=0;await ensureToken();return stApi(path,true);}catch(e){}
  }
  if(r.status===429)throw new Error('Strava rate limit (429) — sačekaj do isteka 15-min prozora pa pokušaj ponovo'+(msg?' · '+msg:''));
  throw new Error('Strava '+r.status+(msg?' — '+msg:'')+(body&&body.errors?' · '+JSON.stringify(body.errors):''));
}
async function stravaSync(manual){
  if(!S.strava){if(manual)alert('Strava nije povezana.');return;}
  try{
    const after=Math.floor(s2d(CUR_START).getTime()/1000);
    /* ZONE PULSA. Bez njih model nema pojma sta znaci "puls 171" — moze samo da
       kaze "visok", sto je neosnovano jer ne zna maksimalni puls trkaca. Sa
       zonama moze da kaze "zona 5". Povlaci se najvise jednom nedeljno. */
    try{
      const staro=(S.strava&&S.strava.zonesTs)||0;
      if(Date.now()-staro > 7*864e5){
        const z=await stApi('/athlete/zones');
        const hz=z&&z.heart_rate&&Array.isArray(z.heart_rate.zones)?z.heart_rate.zones:null;
        if(hz&&hz.length){ S.strava.hrZones=hz.map(x=>({min:x.min,max:x.max>0?x.max:null})); S.strava.zonesTs=Date.now(); }
      }
    }catch(e){}
    const acts=[];let page=1;
    while(page<=4){
      const b=await stApi('/athlete/activities?after='+after+'&per_page=100&page='+page);
      acts.push(...b);
      if(b.length<100)break;page++;
    }
    const runs=acts.filter(a=>a.type==='Run'||a.sport_type==='Run');
    const byDate={};
    runs.forEach(a=>{const dt=String(a.start_date_local||'').slice(0,10);if(dt)(byDate[dt]=byDate[dt]||[]).push(a);});
    const moved=autoRealign(byDate); /* pomeri plan PRE glavne petlje da odmah nađe par */
    let imp=0,props=0;
    for(const date of Object.keys(byDate)){
      const d=BY_DATE[date];
      if(!d||d.rest||d.km==null)continue;           /* samo trkački dani plana */
      const a=pickClosest(byDate[date],d.km);        /* 2 trčanja isti dan → bliže planu */
      const l=S.log[d.id]||(S.log[d.id]={});
      l.runDate=date; /* pravi datum trčanja iz Strave — NE dira se ručnim izmenama, koristi ga trend */
      if(!l.lock){                                   /* ručna korekcija ima trajnu prednost */
        l.status='done';
        l.km=Math.round(a.distance/10)/100;
        l.sec=a.moving_time;
        if(a.average_heartrate)l.hr=Math.round(a.average_heartrate);
        l.ts=date;l.src='strava';l.stravaId=a.id;
        /* Ime i opis aktivnosti sa Strave: tu trkac sam kaze STA je hteo tog
           dana ("4km @5:25 / 4km @5:00 ..."). Bez toga AI sudi progresivno
           trcanje po pravilima za lagano, jer u planu dana pise samo "LR". */
        const stIme=(a.name||'').trim(), stOp=(a.description||'').trim();
        if(stIme) l.stravaName=stIme.slice(0,120);
        if(stOp)  l.stravaDesc=stOp.slice(0,400);
        /* Sve sto Strava vec vraca uz aktivnost, a analizi menja zakljucak:
           maksimalan puls (puls na kraju ima smisla samo u odnosu na njega),
           ukupan uspon (dize puls pri istom tempu), Strava "relative effort"
           i prosecna kadenca. */
        if(a.max_heartrate) l.maxHr=Math.round(a.max_heartrate);
        if(a.total_elevation_gain!=null) l.elevGain=Math.round(a.total_elevation_gain);
        if(a.suffer_score!=null) l.relEffort=Math.round(a.suffer_score);
        if(a.average_cadence!=null) l.cadence=Math.round(a.average_cadence*2)/2;
        if(a.average_temp!=null) l.temp=Math.round(a.average_temp);
        syncSide(d);imp++;
      }
      if(d.tag==='int'||d.tag==='tempo'){ /* bez QS uslova — dan izmenjen u kvalitet nema QS unos, a detectWorkSegments ga i ne traži */
        const rowId=predRowFor(d);
        /* ŠTEDNJA KVOTE JE BILA VEZANA ZA POGREŠNU STVAR.
           Uslov je ranije glasio `S.pred[rowId]==null`, pa se cela grana —
           uključujući PRIKUPLJANJE DETALJA (krugovi / po-km presek) — preskakala
           čim tempo postoji. Ko je tempo uneo RUČNO pre sinhronizacije nikad
           nije dobio krugove, i AI analiza mu je zauvek pisala „samo prosek cele
           sesije" (prijavljeno sa snimkom: 6×800 na 3:55, bez ijednog kruga).
           Izvođenje tempa i prikupljanje detalja su dve različite stvari:
           tempo se piše samo ako ga još nema (dole), a detalji se povlače dok
           god ih nema. I dalje JEDNOM po treningu — `l.laps`/`l.perKm` čuvaju
           rezultat, pa ponovna sinhronizacija ne troši ništa. */
        const imaDetalje = !!(S.log[d.id] && ((Array.isArray(S.log[d.id].laps)&&S.log[d.id].laps.length)
                                            || (Array.isArray(S.log[d.id].perKm)&&S.log[d.id].perKm.length)));
        const smeTempo = rowId && !S.predLock[rowId] && S.pred[rowId]==null;
        if(rowId && !imaDetalje){
          try{
            /* PRIMARNO: streamovi + prepoznavanje radnih segmenata po brzini.
               Nezavisno od Stravinih lapova (koji nepouzdano vraćaju čas
               strukturne čas auto-1km podelu). Jedan API poziv. */
            const st=await stApi('/activities/'+a.id+'/streams?keys=distance,time,heartrate,cadence,watts,moving,altitude,temp&key_by_type=true');
            const segs=detectWorkSegments(st);
            if(segs&&segs.length){
              const totT=segs.reduce((s,x)=>s+x.paceSec*x.distM/1000,0);
              const totD=segs.reduce((s,x)=>s+x.distM,0);
              const t=Math.round(totT/(totD/1000));
              if(t && smeTempo){ if(upisiAutoTempo(rowId,t,date,d))props++; }
              if(S.log[d.id]){ S.log[d.id].laps=segs; S.log[d.id].lapsIzvor='strava'; }
            } else {
              /* FALLBACK 1: po-km presek iz istih streamova (kontinuiran kvalitetni
                 napor koji segmentacija ne razdvaja) */
              if(S.log[d.id]){
                const perKm=perKmDetail(st);
                if(perKm.length) S.log[d.id].perKm=perKm;
              }
              /* FALLBACK 2 za VDOT tempo: stari put preko lapova — traži QS spec,
                 koji izmenjeni dan nema, pa se preskače */
              const spec=qsFor(d.id);
              if(spec && smeTempo)try{
                const laps=await stApi('/activities/'+a.id+'/laps');
                const t=workLapsTempo(laps,spec);
                if(t){ if(upisiAutoTempo(rowId,t,date,d))props++; }
              }catch(e){}
            }
          }catch(e){}
        }
      } else if((d.tag==='lako'||d.tag==='lr') && S.log[d.id] && (!S.log[d.id].perKm || (S.log[d.id].perKm[0]||{}).v!==PERKM_VER) && !l.lock){
        /* Kontinuirana trčanja (lako/LR): povuci streamove i sačuvaj po-km presek
           (puls/kadenca/tempo svakog km) za analizu drifta i kadence. Samo jednom. */
        try{
          const st=await stApi('/activities/'+a.id+'/streams?keys=distance,heartrate,cadence,time,moving,altitude,temp,watts&key_by_type=true');
          const perKm=perKmDetail(st);
          if(perKm.length && S.log[d.id]){
            const bioStari = Array.isArray(S.log[d.id].perKm) && S.log[d.id].perKm.length;
            S.log[d.id].perKm=perKm;
            const dek=decouplingPerKm(perKm);
            if(dek) S.log[d.id].decoupling=dek; else delete S.log[d.id].decoupling;
            /* Limit od 2 AI analize postoji zato sto "analiza se ne menja za iste
               podatke". Kad se podaci OSVEZE novim nacinom racunanja, taj razlog
               vise ne vazi — inace bi korisnik ostao zakljucan na analizi koja je
               nastala iz pogresnih brojeva. Brojac se resetuje samo kad je zaista
               postojao STAR zapis koji je zamenjen. */
            if(bioStari) delete S.log[d.id].aiCount;
          }
        }catch(e){}
      }
    }
    fixVdotDates(); /* uskladi VDOT datume sa pravim datumima trčanja */
    S.strava.lastSync=Date.now();save();
    renderHeader();PAGES[ACTIVE]();
    if(manual)alert('Sinhronizacija gotova.\nAžurirano trčanja: '+imp+'\nUpisano tempa u Predikciju: '+props+(moved?'\nAutomatski pomereno (odrađeno drugog dana nego što plan kaže): '+moved:''));
  }catch(e){
    if(manual)alert('Sync nije uspeo: '+e.message);
  }
}
/* ============================================================
   REDOSLED IZVORA TRENINGA

   intervals.icu ako je povezan i sme da čita treninge; inače Strava. Ne oba —
   isti trening iz dva izvora bi se prepisivao naizmenično, a `l.src` bi zavisio
   od toga ko je poslednji stigao.

   Kad icu otkaže (istekla dozvola, njihov server, mreža), pada se na Stravu
   ako postoji: bolje sinhronizovan trening iz slabijeg izvora nego nijedan.
   Poruka o grešci se u tom slučaju ne guta — vraća se pozivaocu. */
/* POVLACENJE TRENINGA PRI POVRATKU U APLIKACIJU.

   PRIJAVA: „zavrsio trcanje, nije uradio automatski update". Tacno tako je i
   bilo — `sinhronizujTreninge` se pozivalo sa TACNO dva mesta: iz dugmeta u
   Podesavanjima i JEDNOM, pri ucitavanju stranice. Instalirana PWA se ne
   ucitava iznova: ona se budi iz pozadine. Ko zavrsi trcanje pa otvori
   aplikaciju, dobije istu onu stranicu koja stoji otvorena od jutros — i dan
   koji i dalje pise „Predstoji".

   `icuAutoSync` na povratku postoji od ranije, ali on povlaci SAMO jutarnja
   merenja, i to jednom dnevno. Treninge nije dirao.

   Prag je ovde kraci nego pri ucitavanju (15 min naspram 60): povratak u
   aplikaciju posle trcanja je bas onaj trenutak kad podatak treba, a cetiri
   poziva na sat su i dalje pristojni prema oba servisa. Zastavica sprecava da
   se dva povlacenja preklope kad se app brzo otvori-zatvori-otvori. */
let TR_POVLACIM=false;
function trPoslednjiSync(){
  return icuImaTreninge() ? ((S.icu&&S.icu.trSync)||0) : ((S.strava&&S.strava.lastSync)||0);
}
function trPovuciAko(prag){
  if(TR_POVLACIM) return false;
  if(!navigator.onLine) return false;
  if(!icuImaTreninge() && !S.strava) return false;
  if(Date.now()-trPoslednjiSync() < prag) return false;
  TR_POVLACIM=true;
  sinhronizujTreninge(false).catch(()=>{}).finally(()=>{ TR_POVLACIM=false; });
  return true;
}
async function sinhronizujTreninge(manual){
  if(icuImaTreninge()){
    const r=await icuSyncTreninzi(45, manual);
    if(r.ok){
      renderHeader(); PAGES[ACTIVE]();
      if(manual) alert('Sinhronizacija sa intervals.icu gotova.\nAžurirano trčanja: '+r.n+
        '\nTreninga sa krugovima: '+r.detalja+
        '\nSa presekom po kilometru: '+(r.presek||0));
      return r;
    }
    if(!S.strava){ if(manual) alert('intervals.icu: '+r.error); return r; }
    if(manual) alert('intervals.icu nije odgovorio ('+r.error+').\nPokušavam preko Strave…');
  }
  return stravaSync(manual);
}
async function handleOAuthReturn(){
  const q=new URLSearchParams(location.search);
  const code=q.get('code');
  if(!code)return;
  const scope=q.get('scope')||'';
  const gotState=q.get('state')||'';
  history.replaceState(null,'',location.pathname);
  /* Strava i intervals.icu se vracaju na ISTU adresu sa `?code=`. Razlikuju se
     po tome ciji `state` je sacuvan pri pokretanju — svaki cuva svoj kljuc i
     brise ga pri proveri, pa jedan povratak ne moze da potrosi tudji state. */
  let icuState=null;
  try{ icuState=JSON.parse(localStorage.getItem(ICU_STATE_KEY)||'null'); }catch(e){}
  if(icuState&&icuState.st&&gotState===icuState.st){
    if(!icuCheckState(gotState)){ alert('Povezivanje odbijeno — bezbednosna provera nije prošla.'); return; }
    await icuFinish(code);
    return;
  }
  if(!stravaCheckState(gotState)){
    alert('Povezivanje odbijeno — bezbednosna provera nije prošla.\n\nOvo se dešava ako si otvorio link za povezivanje sa strane, ili je prošlo previše vremena. Pokreni povezivanje ponovo iz Podešavanja.');
    return;
  }
  const tok=await sbToken();
  if(!tok){ alert('Moraš biti prijavljen da bi povezao Stravu.'); return; }
  fetch('/api/auth?code='+encodeURIComponent(code),{headers:{'Authorization':'Bearer '+tok}}).then(async r=>{
    const res=await apiJson(r);
    if(!res.data) throw new Error(res.error);   /* HTML stranica greske umesto JSON-a */
    return res.data;
  }).then(j=>{
    if(j.access_token){
      S.strava={access:j.access_token,refresh:j.refresh_token,expiresAt:j.expires_at,
        athlete:j.athlete?((j.athlete.firstname||'')+' '+(j.athlete.lastname||'')).trim():'',
        scope:scope,lastSync:0};
      save();
      alert('Strava povezana'+(S.strava.athlete?' — '+S.strava.athlete:'')+'.');
      stravaSync(true);
    }else{
      alert('Povezivanje nije uspelo: '+(j.message||JSON.stringify(j.errors||j)));
    }
  }).catch(e=>alert('Povezivanje nije uspelo: '+e.message));
}

/* ---------- INIT ---------- */
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>setPage(b.dataset.pg));
$('#btn-gear').onclick=openSettings;
$('#backdrop').onclick=closeSheet;
if(fixVdotDates())save(); /* jednokratna popravka VDOT datuma iz postojećih runDate */
if(recomputeVdotZones())save(); /* jednokratna popravka VDOT formule (zona umesto Riegel) na postojećoj istoriji */
/* POPRAVKA VEC NADUVANE ISTORIJE. Dok se prigusenje racunalo pri unosu, svaki
   ponovni upis iste sesije je pomerao VDOT jos 40% ka izmerenom, pa je istorija
   postojecih korisnika naduvana. Izmerene vrednosti su sacuvane po sesiji, tako
   da se tacan lanac moze rekonstruisati — jednom, na startu. */
(function popraviVdotLanac(){
  if(!Array.isArray(S.vdotLog)||!S.vdotLog.length)return;
  const pre=S.vdotLog.map(e=>e&&e.vdot);
  preracunajVdotLog();
  if(S.vdotLog.some((e,i)=>e&&e.vdot!==pre[i])) save();
})();
/* ==========================================================================
   SUPABASE — rezerva i sinhronizacija (PUT A: localStorage je izvor istine)

   Načelo: aplikacija radi POTPUNO ISTO ako ovo nije podešeno ili korisnik
   nije prijavljen. Sve ispod je dodatak, nikad uslov. Nema spoljne
   biblioteke (sirov fetch) — PWA mora da radi offline, a CDN skripta bi to
   pokvarila prvim gubitkom signala.

   PODESI: SB_URL i SB_ANON iz Supabase → Project Settings → API.
   ANON kljuc je javan po dizajnu — bezbednost nosi RLS, ne tajnost kljuca.
   ========================================================================== */
let SB_URL='https://clnsxvtulvoeqakchydz.supabase.co';
let SB_ANON='sb_publishable_aMLazdC_D_brROmOml1T7g_BM8j_ntj';
/* Publishable kljuc je JAVAN po dizajnu — Supabase izricito kaze da je bezbedan
   u izvornom kodu i veb stranicama. Zastitu nosi RLS (svaki korisnik vidi samo
   svoj red), ne tajnost kljuca. Nikad ovde ne sme doci `sb_secret_...` — taj
   zaobilazi sva RLS pravila. */
const SB_KEY='sub19_sb';   /* ODVOJENO od LS_KEY — uvoz backup-a menja S, sesija mora preziveti */
const SB_STATE_KEY='sub19_sb_state';
/* CSRF/sesijska otmica preko Google prijave — ISTA klasa napada kao kod Strave,
   ista odbrana. Bez ovoga: napadac posalje link
   `…/#access_token=NJEGOV_JWT&refresh_token=…`, zrtva ga otvori, sbInit()
   bezuslovno usvoji NJEGOVU sesiju. Odatle: sbPush() gura zrtvine podatke
   u napadacev red, ili sbPull() povuce napadacev JSON u zrtvinu app. */
/* PROZOR ZA PRIJAVU. Bio je 10 minuta — a to je i duzina prozora u kom
   podmetnut `#access_token=` moze da bude usvojen (v. sbInit). Odlazak na
   Google i nazad traje sekunde; tri minuta su i dalje velikodusna rezerva za
   spor telefon i unos lozinke, a prozor je preko tri puta uzi. */
const SB_PROZOR_MS=3*60*1000;
function sbMakeState(){
  const st=secureRandomToken();
  try{ localStorage.setItem(SB_STATE_KEY, JSON.stringify({st,exp:Date.now()+SB_PROZOR_MS})); }catch(e){}
  return st;
}
/* Zapamceno saznanje: da li nonce PREZIVLJAVA put kroz Supabase na ovom
   deployu. Zavisi od toga da li je u Supabase → Authentication → Redirect URLs
   dozvoljen obrazac sa upitom (`https://.../**`). Ne pretpostavlja se — meri se
   pri prvoj uspesnoj prijavi i od tada se zahteva. */
const SB_NONCE_RADI_KEY='sub19_sb_nonce_ok';
function sbNonceRadi(){ try{ return localStorage.getItem(SB_NONCE_RADI_KEY)==='1'; }catch(e){ return false; } }
/* PROVERA POVRATKA SA PRIJAVE.
   Marker sam po sebi kaze samo „ovaj pretrazivac je nedavno krenuo u prijavu",
   ne i CIJI je token stigao nazad — pa je ostajao uzak prozor u kom bi
   podmetnut `#access_token=` bio usvojen. Zato se uz `redirect_to` salje i
   nasumican `sbn`, koji se ovde poredi.

   ZASTO NE `state=`: Supabase GoTrue koristi bas taj naziv INTERNO za svoju
   CSRF zastitu prema Google-u; nasa vrednost bi se sudarila sa njegovom i
   prijava bi zavrsila sa „bad_oauth_state" (v. komentar u sbLogin).

   TRI ISHODA, i cetvrti koji je razlog zasto je ovo ovako napisano:
     - `sbn` stigao i poklapa se        -> prihvati; zapamti da nonce radi
     - `sbn` stigao a ne poklapa se     -> ODBIJ
     - `sbn` nije stigao, a app zna da inace radi -> ODBIJ (neko ga je skinuo)
     - `sbn` nije stigao, a app to jos nije videla -> prihvati po starom
   Poslednji slucaj je jedini razlog za ovu slozenost: da uvodjenje ne moze da
   zakljuca naloge ako Supabase na ovom projektu odbacuje upit u redirect_to.
   Cim jedna prijava prodje sa nonce-om, downgrade (izostavljanje parametra)
   vise nije moguc. */
function sbCheckState(gotNonce){
  let saved=null;
  try{ saved=JSON.parse(localStorage.getItem(SB_STATE_KEY)||'null'); }catch(e){}
  try{ localStorage.removeItem(SB_STATE_KEY); }catch(e){}   /* jednokratno */
  if(!saved||!saved.st) return false;
  if(Date.now()>saved.exp) return false;
  if(gotNonce){
    if(gotNonce!==saved.st) return false;
    try{ localStorage.setItem(SB_NONCE_RADI_KEY,'1'); }catch(e){}
    return true;
  }
  return !sbNonceRadi();
}

let SB={access:null,refresh:null,expiresAt:0,email:null,userId:null,slika:null,ime:null,seenAt:null,deviceId:null};
let SB_TIMER=null, SB_BUSY=false;
/* „Stiglo je novije dok je push trajao" — v. sbPush(). */
let SB_PONOVO=false;
/* DOK TRAJE PITANJE O SUKOBU, NIŠTA SE NE ŠALJE.

   PRIJAVA: „backend ne čuva kilažu i povrede — sad ne vidim ništa od toga."

   Traka sukoba je pisala „Dok ne izabereš, ništa se ne menja", a to nije bilo
   sprovedeno. Traka nije modalna (namerno — ne sme da zaključa aplikaciju), pa
   je sve ostalo radilo: svaki `save()` je kroz `sbSchedulePush()` zakazivao
   upis četiri sekunde kasnije, koji je prepisivao SERVERSKU kopiju lokalnom.

   Na sveže instaliranom uređaju je lokalna kopija prazna. Dovoljno je bilo da
   se aplikacija dodirne dok traka stoji — ili da automatsko povlačenje sa
   Strave/intervals.icu upiše prvi trening — pa da prazno stanje pregazi sve
   na serveru.

   Zašto se gubitak ne primeti odmah: treninzi se sami vrate sa Strave i
   intervals.icu, pa dnevnik izgleda netaknuto. Kilaža i povrede se unose
   RUČNO i ne postoje nigde drugde — one nestanu tiho. Tačno to je i
   prijavljeno. */
let SB_SUKOB=false;

/* Deklaracije funkcija (ne const strelice) — podizu se, pa save() sme da ih
   zove i pre nego sto izvrsavanje stigne do ovog bloka. Sa `const` je to bio
   ReferenceError pri pokretanju (temporal dead zone). */
function sbOn(){ return !!(SB_URL&&SB_ANON); }
function sbAuthed(){ return sbOn()&&!!SB&&!!SB.access&&!!SB.userId; }
/* KLJUCNA RAZLIKA od sbAuthed(): gleda da li NALOG postoji, ne da li je
   pristupni token trenutno vazeci. Token istice na sat vremena — da kapija
   gleda njega, aplikacija bi se zakljucala svaki put kad si bez signala.
   Refresh token traje mnogo duze i obnavlja se kad mreza postoji. */
function sbHasSession(){ return sbOn()&&!!SB&&!!SB.userId&&!!SB.refresh; }
/* Vazeci pristupni token za pozive ka nasim /api putanjama. Prazan niz ako
   ga nema — server tada vrati 401, a UI to prikaze kao gresku. */
async function sbToken(){
  try{ if(!await sbEnsure()) return ''; }catch(e){ return ''; }
  return SB.access||'';
}

function sbLoad(){
  try{ const r=localStorage.getItem(SB_KEY); if(r) SB=Object.assign(SB,JSON.parse(r)); }catch(e){}
  if(!SB.deviceId){ SB.deviceId='d'+Math.random().toString(36).slice(2,10); sbSave(); }
}
function sbSave(){
  try{ localStorage.setItem(SB_KEY,JSON.stringify(SB)); }catch(e){}
  /* Kopija za service worker. Piše se BAŠ ovde jer se sbSave() zove pri
     prijavi i pri svakom osvežavanju tokena — tačno u trenucima kad se ono
     što pozadina zna promeni. Bez await: ako IndexedDB padne, sinhronizacija
     u prvom planu ne sme da stane zbog toga. */
  try{ if(typeof pozadinskiNalog==='function') pozadinskiNalog(); }catch(e){}
}

/* --- ciste funkcije (testabilne bez mreze) --- */

/* Sta se salje na server. Strava tokeni se NAMERNO izostavljaju: nisu potrebni
   drugom uredjaju (tamo se Strava poveze ponovo, jedan klik), a cuvanje OAuth
   tokena u bazi bez pravog proksija je rizik bez koristi. */
function sbPayload(state){
  const c=JSON.parse(JSON.stringify(state));
  /* Tokeni (access/refresh) NIKAD ne idu na server. Ime i vreme sinhronizacije
     su bezopasni — već se prikazuju u samoj app Podešavanjima bez ikakve
     zaštite, pa nema razloga da ih izveštaj ne vidi. */
  c.strava = state.strava ? {
    lastSync: state.strava.lastSync || null,
    athlete: state.strava.athlete || null,
    scope: state.strava.scope || null
  } : null;
  /* intervals.icu API kljuc je isto sto i Strava token — pristupni podatak,
     nikad ne ide na server. Sami PODACI o oporavku (S.wellness) idu, jer su to
     merenja kao i svako drugo, pa se vide i na drugom uredjaju. */
  /* i OAuth token je pristupni podatak, isto kao API kljuc — ostaje na uredjaju */
  c.icu = state.icu ? { lastSync: state.icu.lastSync || null } : null;
  return c;
}
/* Odluka pri pokretanju: 'push' (server prazan) - 'ok' (isti) - 'ask' (server
   ima izmene koje nismo videli — PITAJ, ne gazi tiho). */
/* NOVIJI ZAPIS SA ISTOG UREĐAJA NIJE SUKOB — to je naš sopstveni push koji
   nismo stigli da zabeležimo.

   `sbPush()` se poziva i na `visibilitychange` kad app odlazi u pozadinu. Na
   telefonu se dešava da zahtev stigne DO SERVERA, a odgovor nikad ne dođe do
   nas (sistem je aplikaciju već zamrznuo ili ubio) — pa `SB.seenAt` ostane na
   starom. Pri sledećem otvaranju server JESTE noviji od onoga što smo poslednji
   put videli, i traka je pitala „na drugom uređaju postoje noviji podaci" iako
   drugog uređaja nema. Prijavljeno sa snimka, na jedinom uređaju.

   Red na serveru nosi `device_id` onoga ko ga je poslednji upisao, pa se ta dva
   slučaja razlikuju pouzdano. Zaštita od TUĐEG novijeg zapisa ostaje netaknuta:
   pita se i dalje, samo ne za sopstveni. */
function sbDecide(seenAt, remoteAt, remoteUredjaj, mojUredjaj){
  if(!remoteAt) return 'push';
  if(!seenAt) return 'ask';
  if(remoteAt===seenAt) return 'ok';
  if(remoteAt>seenAt){
    if(remoteUredjaj && mojUredjaj && remoteUredjaj===mojUredjaj) return 'ok';
    return 'ask';
  }
  return 'push';
}
/* Google vraca tokene u hash-u URL-a (#access_token=...). Strava koristi
   ?code= — razliciti mehanizmi, ne sudaraju se. */
function sbParseHash(hash){
  if(!hash||hash.indexOf('access_token')<0) return null;
  const q=new URLSearchParams(hash.replace(/^#/,''));
  const a=q.get('access_token'); if(!a) return null;
  return { access:a, refresh:q.get('refresh_token')||null,
           expiresAt: Date.now()+ (parseInt(q.get('expires_in')||'3600',10)*1000) };
}
/* Email i id iz JWT-a — bez dodatnog kruga ka serveru.
   `escape()` je bio uklonjen iz standarda (Annex B) i postoji samo dok ga
   pregledači trpe; uz to je i pogrešan alat — radi nad UTF-16 jedinicama, pa
   je mejl sa ćirilicom ili umlautom umeo da izađe izobličen. `TextDecoder`
   radi tačno ono što treba: bajtovi -> UTF-8 tekst. */
/* Prepiše ime i sliku iz TEKUĆEG pristupnog tokena u SB.
   Bezbedno je zvati kad god: `sbClaims` na neispravan token vraća sama
   `null`-polja, a null se ne upisuje preko postojeće vrednosti. */
function sbPreuzmiIdentitet(){
  if(!SB||!SB.access) return false;
  const c=sbClaims(SB.access);
  return sbUpisiIdentitet(c.slika, c.ime);
}

/* Upisuje ime i sliku u SB, ali SAMO neprazne vrednosti — prijava koja ih ne
   nosi ne sme da obriše ono što već radi. Vraća da li se nešto promenilo. */
function sbUpisiIdentitet(slika, ime){
  let promena=false;
  if(slika && slika!==SB.slika){ SB.slika=slika; promena=true; }
  if(ime   && ime  !==SB.ime  ){ SB.ime  =ime;   promena=true; }
  return promena;
}

/* Ime i slika iz odgovora /auth/v1/user. `user_metadata` je jedini pouzdan
   izvor: JWT ga NOSI ILI NE NOSI, u zavisnosti od verzije GoTrue-a i od toga
   šta je Google vratio pri prijavi — a to se sa strane aplikacije ne vidi i ne
   može da se podesi. Zato se ne oslanjamo samo na token. */
function sbIzKorisnika(u){
  const um=(u&&typeof u.user_metadata==='object'&&u.user_metadata)?u.user_metadata:{};
  const sl=um.avatar_url||um.picture||null;
  return sbUpisiIdentitet(
    (typeof sl==='string'&&/^https:\/\//.test(sl))?sl:null,
    (typeof um.full_name==='string'&&um.full_name)||(typeof um.name==='string'&&um.name)||null
  );
}

function sbClaims(jwt){
  try{
    const p=jwt.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    const sirovo=atob(p+'==='.slice((p.length+3)%4));
    const bajtovi=Uint8Array.from(sirovo, c=>c.charCodeAt(0));
    const j=JSON.parse(new TextDecoder('utf-8').decode(bajtovi));
    /* Google ime i slika STOJE U SAMOM TOKENU (`user_metadata`), pa Zajednica
       ne traži ni jedan dodatan poziv, ni otpremanje slika, ni skladište za
       njih. Ako polja nema (prijava koja nije Google), ostaje null i profil
       pada na inicijale — nigde se ne pretpostavlja da slika postoji.
       `picture` je Googleov naziv, `avatar_url` Supabaseov; stižu oba, u
       zavisnosti od verzije GoTrue-a. */
    const um=(j&&typeof j.user_metadata==='object'&&j.user_metadata)?j.user_metadata:{};
    const slika=um.avatar_url||um.picture||null;
    return {
      email:j.email||null,
      userId:j.sub||null,
      /* SAMO https. Vrednost ide pravo u `img src`; CSP je već sužen na
         lh3.googleusercontent.com, ali provera stoji i ovde jer token ne mora
         doći od Googlea. */
      slika:(typeof slika==='string'&&/^https:\/\//.test(slika))?slika:null,
      ime:(typeof um.full_name==='string'&&um.full_name)||(typeof um.name==='string'&&um.name)||null
    };
  }catch(e){ return {email:null,userId:null,slika:null,ime:null}; }
}

/* --- mreza --- */
function sbHead(){ return {'apikey':SB_ANON,'Authorization':'Bearer '+SB.access,'Content-Type':'application/json'}; }

/* MRTVA SESIJA NIJE ISTO STO I NEMA SIGNALA.

   Do sada je `sbEnsure` na oba slucaja vracao isto — `false` — a pozivaoci na
   `false` cute i preskacu sinhronizaciju. Za nemreznu situaciju je to tacno
   ponasanje: aplikacija je offline-first i mora da radi bez signala.

   Ali kad nalog VISE NE POSTOJI (obrisan iz Podesavanja ili sa spiska
   korisnika) ili je sesija opozvana, ishod je bio isti: aplikacija i dalje
   izgleda prijavljeno, jer i sesija i svi podaci zive u localStorage-u.
   Covek nastavi da trenira misleci da mu se sve upisuje na server, a nista se
   ne upisuje i nikad mu to niko ne kaze. To je najgori moguci tihi kvar u
   ovoj aplikaciji.

   Razlika se cita iz ODGOVORA SERVERA, ne iz cinjenice da je poziv pao:
     400/401/403  -> Supabase je izricito odbio refresh token. Nalog je
                     obrisan ili je sesija opozvana. Sesija se odbacuje.
     mreza / 5xx  -> ne zna se nista. Sesija OSTAJE, app radi kao offline.
   Zamena ta dva smera bi znacila da te jedan tunel bez signala odjavi. */
/* JEDAN REFRESH U ISTOM TRENUTKU, MA KOLIKO IH TRAŽILO.

   Pri pokretanju se `sbEnsure` pozove iz pet-šest mesta gotovo istovremeno
   (provera sesije, povlačenje sa servera, istorija, Zajednica, upis profila).
   Supabase ROTIRA refresh token: prvi poziv ga potroši i izda nov, a svaki
   sledeći sa istim, već potrošenim tokenom dobija 400 — što ovaj kod čita kao
   „nalog ne postoji" i spušta kapiju. Postoji prozor tolerancije na strani
   servera, ali je kratak i nije nešto na šta se sme računati.
   Zato svi čekaju isto obećanje: refresh se dešava jednom. */
let SB_REFRESH=null;
function sbOsvezi(){
  if(SB_REFRESH) return SB_REFRESH;
  SB_REFRESH=(async()=>{
    try{
      const r=await fetch(SB_URL+'/auth/v1/token?grant_type=refresh_token',
        {method:'POST',headers:{'apikey':SB_ANON,'Content-Type':'application/json'},
         body:JSON.stringify({refresh_token:SB.refresh})});
      if(!r.ok){
        if(r.status===400||r.status===401||r.status===403) sbSesijaMrtva();
        return false;
      }
      const j=await r.json();
      SB.access=j.access_token; SB.refresh=j.refresh_token||SB.refresh;
      SB.expiresAt=Date.now()+((j.expires_in||3600)*1000);
      /* Ime i slika se čitaju iz SVAKOG novog tokena, ne samo pri prijavi.
         Bez ovoga bi ih dobio jedino onaj ko se prijavio POSLE verzije koja je
         to počela da čita — svi zatečeni bi doveka imali prazan avatar, i to
         bez ijedne greške koja bi na to ukazala. Uz to se promena slike na
         Google nalogu ovako preuzme sama. */
      sbPreuzmiIdentitet();
      sbSave(); return true;
    }catch(e){ return false; }   /* mreza — sesija se NE dira */
  })().finally(()=>{ SB_REFRESH=null; });
  return SB_REFRESH;
}
async function sbEnsure(){
  if(!sbAuthed()) return false;
  if(Date.now() < SB.expiresAt-60000) return true;
  if(!SB.refresh) return false;
  return sbOsvezi();
}

/* Sesija vise ne vazi na serveru. Cisti se prijava, ali NE i podaci.
   Lokalni zapis je mozda jedino sto je coveku ostalo — narocito ako mu je
   nalog obrisan bez najave. Ostaje na uredjaju i moze se izvesti kroz Backup
   cim se ponovo prijavi. */
function sbSesijaMrtva(poruka){
  if(!SB||!SB.access) return;                 /* vec ocisceno */
  try{ pozadinskiZaboravi(); }catch(e){}      /* da SW ne gura u tudje ime */
  SB={access:null,refresh:null,expiresAt:0,email:null,userId:null,slika:null,ime:null,seenAt:null,deviceId:SB.deviceId};
  sbSave();
  sbShowGate(poruka||'Nalog više ne postoji ili je sesija istekla. Podaci na ovom uređaju su netaknuti — prijavi se da nastaviš.');
}

/* PROVERA SESIJE KOD SERVERA — pri pokretanju i pri svakom povratku u app.

   ZASTO NIJE DOVOLJNO cekati istek tokena. Pristupni token je JWT: potpisan
   je i vazi do isteka bez obzira na to sto se u medjuvremenu desilo na
   serveru. Brisanje ili zabrana naloga NE moze da ga povuce. Do v205 se
   sesija proveravala tek kad token istekne — do sat vremena — pa je obrisan
   korisnik sve to vreme normalno koristio aplikaciju.

   Zato se sada PITA server. Jedan poziv na /auth/v1/user pri pokretanju i pri
   povratku iz pozadine; ako nalog vise ne postoji ili je zabranjen, kapija se
   spusta odmah.

   RAZLIKA MREZA/ODBIJANJE se cuva kao i u sbEnsure: samo izricit 401/403
   obara sesiju. Greska u mrezi ne sme nikoga da odjavi — aplikacija radi
   offline i to je jedna od njenih glavnih osobina.

   401 NIJE ISTO STO I „NALOG NE POSTOJI" — ovde je bio kvar.
   Pristupni token vazi sat vremena. Instalirana PWA stoji u pozadini danima,
   a posle azuriranja se stranica ucita iznova — u oba slucaja je token po
   pravilu istekao. Ova provera ga je slala takav kakav je, dobijala 401 i
   spustala kapiju coveku cija je sesija savrseno ispravna. Zato je
   „odjavljuje me posle svakog update-a" bilo tacno to: ne rotacija tokena,
   ne obrisan nalog, nego istekao pristupni token protumacen kao brisanje.

   Sada se prvo osvezi token, a i posle toga se 401 ne uzima zdravo za gotovo:
   jednom se osvezavanje ponovi silom (sat na uredjaju ume da odluta, pa
   `expiresAt` slaze da je token jos ziv) i poziv se ponovi. Tek ako REFRESH
   TOKEN bude izricito odbijen — a to `sbOsvezi` sam prepoznaje i ruši sesiju —
   nalog stvarno vise ne postoji. Zabrana je izuzetak: nju server imenuje u
   telu odgovora, pa se prepoznaje odmah i ne pokusava se ponovo. */
async function sbProveriSesiju(){
  if(!sbAuthed()||!navigator.onLine) return true;
  /* Ako je token istekao, osvezi ga PRE pitanja. Kad osvezavanje padne zbog
     mreze, sesija ostaje i ne zna se nista — isto kao da poziv nije ni krenuo.
     Kad padne zato sto je server odbio refresh token, `sbOsvezi` je vec
     spustio kapiju, pa je `sbAuthed()` ovde netacno i to je odgovor. */
  if(!await sbEnsure()) return sbAuthed();
  try{
    let r=await fetch(SB_URL+'/auth/v1/user',
      {headers:{'apikey':SB_ANON,'Authorization':'Bearer '+SB.access}});
    if(r.status===401||r.status===403){
      /* GoTrue za zabranjen nalog vraca poruku sa „banned"; za obrisan nema
         takve oznake. Tekst je jedina razlika koja postoji, pa se korisniku
         kaze tacno sta se desilo umesto neodredjenog „sesija je istekla". */
      const jeZabrana=async o=>{ try{ return /banned|zabran/i.test(JSON.stringify(await o.json())); }catch(e){ return false; } };
      let zabranjen=await jeZabrana(r);
      if(!zabranjen){
        /* Drugi pokusaj: mozda je token bio star uprkos `expiresAt`. */
        if(!await sbOsvezi()) return sbAuthed();
        r=await fetch(SB_URL+'/auth/v1/user',
          {headers:{'apikey':SB_ANON,'Authorization':'Bearer '+SB.access}});
        if(r.status===401||r.status===403) zabranjen=await jeZabrana(r);
      }
      if(r.status===401||r.status===403){
        sbSesijaMrtva(zabranjen
          ? 'Pristup ovom nalogu je zabranjen. Podaci na ovom uređaju su netaknuti. Ako misliš da je greška, javi se vlasniku aplikacije.'
          : 'Nalog više ne postoji ili je sesija istekla. Podaci na ovom uređaju su netaknuti — prijavi se da nastaviš.');
        return false;
      }
    }
    /* ODAVDE STIŽE SLIKA ZA ZAJEDNICU.
       Ovaj poziv je već postojao — samo se odgovor bacao. `user_metadata` u
       njemu sadrži Google ime i sliku i onda kad ih token ne nosi, što je i
       bio slučaj: profil je u bazi imao prazan `avatar_url`, pa se u krugu
       video inicijal umesto slike. Nijedan dodatan zahtev. */
    if(r.ok){
      try{
        if(sbIzKorisnika(await r.json())){
          sbSave();
          /* Javni profil nosi staru (praznu) sliku dok se ne prepiše. Čim
             saznamo pravu, red se osvežava — inače bi slika stigla tek uz
             sledeću izmenu plana. */
          if(S.zajed&&S.zajed.vidljiv) zajUpisi().catch(()=>{});
        }
      }catch(e){}
    }
    return true;
  }catch(e){ return true; }   /* mreza — ne dira se nista */
}

function sbLogin(){
  if(!sbOn()){ alert('Supabase nije podešen (SB_URL / SB_ANON u kodu).'); return; }
  const n=sbMakeState();
  /* NAMERNO se ne prosledjuje &state= Supabase-u. Supabase GoTrue koristi taj
     isti naziv parametra INTERNO za sopstvenu CSRF zastitu prema Google-u —
     nasa vrednost bi se sudarila sa njegovom (potvrdjeno: identican slucaj
     prijavljen na supabase/auth GitHub-u, zavrsava sa "bad_oauth_state").
     Zato nas nonce putuje kao `sbn` U SAMOJ POVRATNOJ ADRESI — Supabase je
     vraca doslovno, pa se po povratku moze uporediti (v. sbCheckState).
     TRAZI da u Supabase → Authentication → Redirect URLs stoji obrazac koji
     dozvoljava upit (`https://sub-19.vercel.app/**`). Ako ne stoji, Supabase
     odbaci upit; app to prepozna i radi kao ranije, bez zakljucavanja naloga. */
  location.href=SB_URL+'/auth/v1/authorize?provider=google&redirect_to='
    +encodeURIComponent(location.origin+'/?sbn='+n);
}
function sbLogout(){
  /* Odjava mora da očisti i POZADINU. Bez ovoga bi service worker zadržao
     kopiju tokena i neposlato stanje pa ih gurnuo posle odjave — na tuđem
     telefonu bi to bio tuđ nalog. Obaveštenja se gase iz istog razloga. */
  const token=SB&&SB.access;
  try{ pushIskljuci(token).then(pozadinskiZaboravi).catch(()=>pozadinskiZaboravi()); }
  catch(e){ try{ pozadinskiZaboravi(); }catch(x){} }
  SB={access:null,refresh:null,expiresAt:0,email:null,userId:null,slika:null,ime:null,seenAt:null,deviceId:SB.deviceId};
  sbSave();
  sbShowGate('');   /* nalog je obavezan — nazad na kapiju */
}

/* Vreme poslednje izmene na serveru I UREĐAJ koji ju je napravio — jeftin upit,
   dve kolone. Uređaj je potreban da bi se sopstveni push razlikovao od tuđeg
   (v. sbDecide). */
async function sbRemoteAt(){
  if(!await sbEnsure()) return undefined;
  /* `undefined` = NEMA SIGNALA, `null` = reda nema. Razlika je nosiva: na
     `undefined` pozivalac odustaje i radi lokalno, na `null` zna da server
     nema ništa.
     Bez ovog `try` bi `fetch` van mreže bacio i obećanje bi odbilo. Ranije to
     nije moglo: service worker je za tuđe adrese vraćao prazan 504, pa je ovde
     stizao odgovor sa `ok:false`. Otkad SW ne presreće tuđe adrese (v220),
     greška stiže dovde i mora da se uhvati. */
  try{
    const r=await fetch(SB_URL+'/rest/v1/user_state?select=updated_at,device_id&user_id=eq.'+SB.userId,{headers:sbHead()});
    if(!r.ok) return undefined;
    const j=await r.json();
    if(!j||!j[0]) return null;                   /* null = red ne postoji */
    return { at:j[0].updated_at, uredjaj:j[0].device_id||null };
  }catch(e){ return undefined; }
}

async function sbPush(){
  if(!sbAuthed()) return false;
  /* ZAUZET NIJE ISTO ŠTO I ODRAĐEN.
     Ranije je ovde stajalo `|| SB_BUSY` i push se prosto odbacivao. Prozor u
     kom to boli je uzak ali stvaran: odloženi upis (4 s) je u letu, čovek u
     tom trenutku prebaci aplikaciju u pozadinu, `visibilitychange` pozove
     sbPush() — i dobije `false`. Aplikacija je već zamrznuta, pa NAJSVEŽIJU
     izmenu nema ko da pošalje; ona na serveru čeka do sledećeg otvaranja, a
     ako se telefon dotle izgubi, čeka zauvek.
     Sada se pamti da ima novijeg i push se ponavlja čim tekući završi. */
  if(SB_BUSY){ SB_PONOVO=true; return false; }
  /* NE GURAJ PRAZNO STANJE PREKO SERVERSKE KOPIJE. Kad se lokalni zapis nije
     mogao procitati, S je prazan seed — a serverska kopija je tada jedino
     mesto gde podaci jos postoje. Bez ove provere bi sbInit() (sbDecide vrati
     'ok', jer server nije noviji od SB.seenAt) prepisao i nju.
     Zastavica se skida tek kad covek u traci svesno izabere ishod. */
  if(UCITAVANJE_PALO) return false;
  /* Isto pravilo, drugi uzrok: dok se sukob ne razreši, lokalno stanje NIJE
     merodavno. Provera stoji i ovde, a ne samo u sbSchedulePush — push se
     pokreće i sa `visibilitychange`, i to bez odlaganja. */
  if(SB_SUKOB) return false;
  if(!await sbEnsure()) return false;
  SB_BUSY=true;
  try{
    const r=await fetch(SB_URL+'/rest/v1/user_state',{
      method:'POST',
      headers:Object.assign(sbHead(),{'Prefer':'resolution=merge-duplicates,return=representation'}),
      body:JSON.stringify({user_id:SB.userId,data:sbPayload(S),
        device_id:SB.deviceId,app_version:APP_VERSION})});
    /* 5xx je privremen (Supabase se restartuje, mreža puca na pola) — takav
       upis ide u pozadinski red. 4xx se ponavljanjem ne popravlja. */
    if(!r.ok){ if(r.status>=500) pozadinskiZakazi(); return false; }
    const j=await r.json();
    if(j&&j[0]&&j[0].updated_at){ SB.seenAt=j[0].updated_at; sbSave(); }
    pozadinskiOtkazi();          /* uspelo je — red više nije potreban */
    /* Javni profil se osvežava ISTIM povodom kao i sve ostalo, umesto po
       sopstvenom rasporedu. Bez `await` i bez uticaja na ishod: Zajednica je
       dodatak, a njen neuspeh ne sme da prijavi da sinhronizacija nije prošla.
       `zajUpisi` sam ćuti ako profil nije uključen. */
    zajUpisi().catch(()=>{});
    return true;
  }catch(e){
    /* Nema signala. Pregledač će sam pokrenuti upis kad se veza vrati, i ako
       je aplikacija do tada zatvorena (v. `sync` u sw.js). */
    pozadinskiZakazi();
    return false;
  }
  finally{
    SB_BUSY=false;
    /* Nešto je stiglo dok je ovaj upis trajao — pošalji i to. `S` je već
       izmenjen u memoriji, pa se šalje najnovije stanje, ne ono zatečeno. */
    if(SB_PONOVO){ SB_PONOVO=false; setTimeout(()=>{ sbPush(); },0); }
  }
}

async function sbPull(){
  if(!sbAuthed()) return false;
  if(!await sbEnsure()) return false;
  /* Isti razlog kao u sbRemoteAt: od v220 SW ne presreće tuđe adrese, pa van
     mreže `fetch` baca umesto da vrati 504. Oba mesta koja zovu sbPull su
     rukovaoci dugmeta bez sopstvenog `catch`, pa bi odbijeno obećanje ostalo
     neuhvaćeno. */
  let r;
  try{ r=await fetch(SB_URL+'/rest/v1/user_state?select=data,updated_at&user_id=eq.'+SB.userId,{headers:sbHead()}); }
  catch(e){ return false; }
  if(!r.ok) return false;
  const j=await r.json();
  if(!j||!j[0]||!j[0].data) return false;
  /* migrate() vraca null za neprepoznat oblik. Bez ove provere je `S` postajao
     null, pa je sledeca linija bacala TypeError i ostavljala aplikaciju u
     razbijenom stanju (poziv nije u try/catch). Bolje odustati od povlacenja
     i nastaviti sa lokalnim podacima. */
  const mig=migrate(j[0].data);
  if(!mig) return false;
  SB.seenAt=j[0].updated_at; sbSave();
  primiStanjeSaServera(mig);
  return true;
}

/* USVAJANJE STANJA KOJE JE STIGLO SA SERVERA — jedno mesto za dva puta.
   Koriste ga `sbPull` („Uzmi sa servera") i vraćanje ranije verzije. Bilo je
   samo u sbPull-u; kad je stiglo vraćanje verzija, ovih desetak redova je
   trebalo prepisati — a prepisan korak koji se posle razidje je tačno ono na
   šta se ova aplikacija već opekla kod `requireUser`.

   Redosled nije proizvoljan:
     1. VEZE SE ZADRŽAVAJU. Na serveru `strava` i `icu` stoje BEZ tokena
        (v. sbPayload) — token je pristupni podatak i nikad ne napušta uređaj.
        Da se preuzmu odande, vraćanje verzije bi te otkačilo sa Strave i
        intervals.icu-a, a to ni sa čim nema veze.
     2. `setActivePlan` pre `rebuildDateIndex` — indeksi se grade nad planom
        koji je tek usvojen, inače ekrani mešaju dva rasporeda.
     3. `uskladiVlasnickePodatke` jer stanje sa servera može da nosi tuđi seed
        (v. objašnjenje u toj funkciji). */
function primiStanjeSaServera(mig){
  const keepStrava=S.strava;                 /* veza sa Stravom je po uredjaju */
  const keepIcu=S.icu;                       /* isto i intervals.icu kljuc */
  S=mig;
  S.strava=keepStrava||null;
  S.icu=keepIcu||null;
  setActivePlan();
  uskladiVlasnickePodatke();
  rebuildDateIndex(); save();
  renderHeader(); setPage(ACTIVE);
}

/* save() ovo okida — odlozeno, jer se save() zove i na svaki pritisak tastera. */
function sbSchedulePush(){
  /* save() se zove i pri pokretanju, PRE nego sto izvrsavanje stigne do
     `let SB` na dnu fajla. Tada je SB u "temporal dead zone" i svaki dodir —
     ukljucujuci `typeof SB` — baca ReferenceError (typeof je bezbedan samo
     za NEdeklarisane promenljive, ne za let/const koje jos nisu dosle na red).
     Zato try/catch, ne provera. */
  try{ if(!sbAuthed()) return; }catch(e){ return; }
  try{ if(SB_SUKOB) return; }catch(e){}
  clearTimeout(SB_TIMER);
  SB_TIMER=setTimeout(()=>{ sbPush(); }, 4000);
}

/* ---- KAPIJA ZA PRIJAVU ----
   Nalog je OBAVEZAN, mreza nije. Kapija propusta cim postoji sesija
   (sbHasSession), pa aplikacija radi i bez signala — na stazi, u teretani,
   u avionu. Zakljucava se tek na odjavu ili ako sesija nestane. */
function sbShowGate(msg){
  let g=document.getElementById('sb-gate');
  if(!g){
    g=document.createElement('div');
    g.id='sb-gate';
    document.body.appendChild(g);
  }
  g.innerHTML=`
    <div class="gate-in">
      <div class="gate-brand">SUB<span>-20</span></div>
      <div class="gate-h1">Prijavi se da nastaviš</div>
      <div class="gate-sub">Nalog čuva tvoj plan i istoriju treninga na serveru — ako izgubiš telefon ili obrišeš podatke pretraživača, sve je i dalje tu.</div>
      <button type="button" class="gate-btn" id="gate-go">Prijavi se Google nalogom</button>
      ${msg?`<div class="gate-err">${esc(msg)}</div>`:''}
      <div class="gate-note">Posle prijave aplikacija radi i bez interneta.</div>
    </div>`;
  g.style.display='flex';
  const b=document.getElementById('gate-go');
  if(b) b.onclick=()=>{ b.disabled=true; b.textContent='Otvaram Google…'; sbLogin(); };
}
function sbHideGate(){
  const g=document.getElementById('sb-gate');
  if(g) g.style.display='none';
}

/* Pri pokretanju: ako server ima izmene koje ovaj uredjaj nije video — PITAJ.
   Nikad tiho ne gazi, jer je stanje jedan blob: pregaziti znaci izgubiti
   celu drugu sesiju, ne samo sukobljeno polje. */
async function sbInit(){
  if(!sbOn()) return;          /* nije podeseno — aplikacija radi bez naloga */
  sbLoad();
  let h=sbParseHash(location.hash);
  /* `sbn` se cita PRE bilo kakvog replaceState — handleOAuthReturn iznad dira
     istoriju samo kad u upitu postoji `code`, ali red ne sme da zavisi od toga. */
  let sbn=null;
  try{ sbn=new URLSearchParams(location.search||'').get('sbn'); }catch(e){}
  /* SRZ POPRAVKE: hash SA tokenima se prihvata SAMO ako je OVAJ pretrazivac
     nedavno pokrenuo sbLogin() (marker postavljen i nedeljno pre isteka) I ako
     se vraceni `sbn` poklapa sa onim koji je tada poslat. Bez toga, bilo ko ko
     otvori link sa tudjim #access_token= tiho preuzima napadacevu sesiju —
     proveri sbCheckState() PRE Object.assign, ne posle. */
  if(h&&!sbCheckState(sbn)){
    h=null;
    history.replaceState(null,'',location.pathname);
  }
  if(h){
    /* NE SME DA ZAMENI VEC PRIJAVLJEN NALOG DRUGIM.
       Marker iznad kaze samo „ovaj pretrazivac je nedavno krenuo u prijavu" —
       ne i CIJI je token stigao nazad. Zato ostaje uzak prozor u kom bi
       podmetnut `#access_token=` bio usvojen. Najstetniji ishod je zamena
       POSTOJECE sesije tudjom: od tog trenutka sbPush() gura licne podatke u
       napadacev red. Ovde se to zatvara — token za DRUGOG korisnika se odbija
       dok se prethodni ne odjavi svesno. */
    const noviClaims=sbClaims(h.access);
    if(SB.userId && noviClaims.userId && noviClaims.userId!==SB.userId){
      h=null;
      history.replaceState(null,'',location.pathname);
      alert('Prijava je odbijena: prijavio si se nalogom koji nije onaj sa kojim je aplikacija već povezana.\n\n'+
            'Ako želiš da promeniš nalog, prvo se odjavi u Podešavanjima, pa se prijavi ponovo.');
    } else {
      Object.assign(SB,h,noviClaims);
      SB.seenAt=null;
      sbSave();
      history.replaceState(null,'',location.pathname);
      /* Token se PROVERAVA kod Supabase-a pre nego sto mu se poveruje. Ako je
         neispravan/opozvan, sesija se odbacuje umesto da app radi sa njom. */
      sbEnsure().then(ok=>{ if(!ok){ SB.access=null; SB.refresh=null; SB.userId=null; sbSave(); } })
                .catch(()=>{});
    }
  }
  /* greska sa Google strane (odbio, zatvorio prozor…) */
  const err=(location.hash||'').indexOf('error')>=0
    ? decodeURIComponent(((/error_description=([^&]*)/.exec(location.hash)||[])[1]||'').replace(/\+/g,' '))
    : '';
  if(err) history.replaceState(null,'',location.pathname);

  if(!sbHasSession()){ sbShowGate(err||''); return; }
  /* Nalog je mozda obrisan ili zabranjen dok je aplikacija bila zatvorena.
     Pita se PRE nego sto se kapija skloni — inace bi na trenutak bljesnuo
     ceo ekran sa tudjim podacima. */
  if(!await sbProveriSesiju()) return;
  /* NADOKNADA ZA ZATEČENE SESIJE. Token u localStorage-u je star i pročitan
     je pre nego što je aplikacija uopšte umela da izvuče ime i sliku iz njega.
     Osvežavanje tokena to sredi samo od sebe, ali tek kad istekne — do tada bi
     avatar bio prazan bez ijednog znaka da nešto ne valja. Ovde se pročita
     odmah, iz tokena koji već postoji. */
  if(sbPreuzmiIdentitet()) sbSave();
  /* Javni profil se osvežava pri svakom pokretanju, bezuslovno.
     Ranije je upis visio na „identitet se promenio" — pa je red u bazi
     ostajao onakav kakav je bio kad je Zajednica uključena. Ko ju je uključio
     pre nego što je aplikacija znala njegovu sliku, imao je prazan
     `avatar_url` doveka, jer se promena više nikad nije desila. Jedan upis po
     pokretanju je zanemarljiv, a jemči da ono što se vidi odgovara stanju. */
  if(S.zajed&&S.zajed.vidljiv) zajUpisi().catch(()=>{});
  sbHideGate();
  /* Sveza prijava menja jeVlasnik(), a time i sta Danas ekran prikazuje
     (traka „Ovo nije tvoj plan"). Ako je sesija upravo usvojena iz hash-a,
     ekran je crtan pre nje — iscrtaj ponovo. */
  uskladiVlasnickePodatke();   /* tek sada se pouzdano zna ciji je nalog */
  if(h){ renderHeader(); PAGES[ACTIVE](); }
  /* tek sada se pouzdano zna CIJI je ovo nalog, pa i da li ima svoj plan */
  if(moraSvojPlan()) openWizard();
  let daljinski;
  try{ daljinski=await sbRemoteAt(); }catch(e){ return; }
  if(daljinski===undefined) return;                   /* nema signala — radi lokalno */
  const remoteAt=daljinski?daljinski.at:null;
  const d=sbDecide(SB.seenAt, remoteAt, daljinski?daljinski.uredjaj:null, SB.deviceId);
  /* 'ok' NE znaci "nema sta da se radi" — znaci samo da server nije NOVIJI
     od onoga sto smo poslednji put videli. Ali lokalno je moglo doci do
     izmene POSLE poslednjeg uspesnog push-a koja nikad nije stigla na server
     (app zatvorena pre isteka 4s odlaganja, ili pre nego sto je
     visibilitychange stigao da zavrsi zahtev). Zato i 'ok' i 'push' rade
     isto — guraju TRENUTNO lokalno stanje. Jedini slucaj kad NE guramo je
     'ask', jer bi to moglo tiho da prepise NOVIJE podatke sa drugog uredjaja. */
  if(d==='push'||d==='ok'){ sbPush(); return; }
  /* SUKOB VERZIJA — pitanje ide U APLIKACIJI, ne kroz confirm().
     Ranije je ovde stajao blokirajuci sistemski `confirm` PRI POKRETANJU, pre
     nego sto korisnik bilo sta vidi, sa izborom koji trajno gubi podatke. Dva
     problema: (1) instalirane PWA i deo pregledaca prigusuju confirm — tada
     vraca `false`, sto je ovde znacilo „zadrzi lokalne i posalji", pa bi
     TIHO pregazio novije podatke sa drugog uredjaja; (2) i kad radi, to je
     sistemski dijalog nasred pokretanja.
     Sada: dok korisnik ne izabere, NISTA se ne salje i nista ne povlaci —
     jedini ishod bez gubitka. */
  prikaziSukobSync(remoteAt);
}
/* Traka izbora pri sukobu lokalnih i serverskih podataka. Namerno bez
   podrazumevane akcije: svaka od dve strane je necije stvarno trcanje. */
/* Ima li na ovom uređaju IŠTA što bi vredelo poslati. Gleda samo ono što se
   unosi rukom ili povlači — ne i podešavanja, koja postoje i u praznom seedu. */
function sbPraznoStanje(s){
  if(!s) return true;
  const n=x=>Array.isArray(x)?x.length:0;
  return Object.keys(s.log||{}).length===0 && n(s.knee)===0 && n(s.kg)===0 &&
         n(s.t3k)===0 && Object.keys(s.wellness||{}).length===0 &&
         Object.keys(s.pred||{}).length===0;
}
function prikaziSukobSync(remoteAt){
  if(document.getElementById('sync-sukob')) return;
  /* Od ovog trenutka do izbora ne ide nijedan upis na server (v. SB_SUKOB). */
  SB_SUKOB=true;
  const kada=new Date(remoteAt).toLocaleString('sr-RS');
  const b=document.createElement('div');
  b.id='sync-sukob';
  b.className='traka upozorenje';
  b.innerHTML=`<b>Podaci se razlikuju</b>
    <p>Na drugom uređaju postoje noviji podaci (${esc(kada)}). Dok ne izabereš, ništa se ne menja.</p>
    <div class="btnrow">
      <button id="sy-pull" class="btn">Uzmi sa servera</button>
      <button id="sy-push" class="btn ghost">Zadrži sa telefona</button>
    </div>
    <div class="traka-n">„Uzmi sa servera" prepisuje izmene na ovom uređaju. „Zadrži sa telefona" prepisuje one na serveru.</div>`;
  document.body.appendChild(b);
  const zatvori=()=>{ SB_SUKOB=false; b.remove(); };
  b.querySelector('#sy-pull').onclick=async()=>{ zatvori(); await sbPull(); };
  b.querySelector('#sy-push').onclick=async()=>{
    /* PRAZNO PREKO PUNOG je najskuplja greška koju ovaj ekran može da napravi:
       treninzi se vrate sa Strave i intervals.icu, ali kilaža i povrede se
       unose rukom i ne postoje nigde drugde. Baš taj slučaj — svež uređaj,
       ništa lokalno — pita se još jednom, imenom stvari koje odlaze. */
    if(sbPraznoStanje(S) &&
       !confirm('Na ovom uređaju još nema nijednog unosa, a na serveru ih ima.\n\n„Zadrži sa telefona" će OBRISATI sve sa servera — uključujući kilažu i povrede, koje se ne mogu vratiti ni sa Strave ni sa intervals.icu.\n\nSigurno?')) return;
    zatvori(); await sbPush();
  };
}

/* Zajednicki okvir za trake upozorenja — isti izgled kao traka sukoba sync-a. */
function trakaUpozorenja(id, vrsta, html){
  try{
    if(document.getElementById(id)) return null;
    const b=document.createElement('div');
    b.id=id;
    /* Izgled je u CSS-u (klasa `.traka`), ne u inline stilu — v. komentar uz
       nju u index.html: dok je podloga stajala ovde kao `var(--card2)`, jedna
       izmena tokena ju je učinila providnom i niko to nije video dok se traka
       nije pojavila korisniku. */
    b.className='traka '+(vrsta||'upozorenje');
    b.style.zIndex='211';
    b.innerHTML=html;
    document.body.appendChild(b);
    return b;
  }catch(e){ return null; }
}

/* OSTECENO STANJE — traka se prikazuje pri pokretanju i NE nudi „u redu, dalje".
   Jedini bezopasan izlaz je da covek prvo skine spaseni fajl; tek posle toga
   sme da se nastavi, jer nastavak znaci da ce prazno stanje otici na server. */
function prikaziUcitavanjePalo(){
  if(!UCITAVANJE_PALO) return;
  const kb=Math.max(1,Math.round(UCITAVANJE_PALO.bajtova/1024));
  const b=trakaUpozorenja('stanje-osteceno','greska',
    `<b>Sačuvani podaci se ne mogu pročitati</b>
     <p>Zapis na ovom uređaju je oštećen (${kb} KB). <b style="display:inline;font-size:inherit;margin:0">Ništa nije obrisano</b> — sirov sadržaj je sačuvan
       i možeš ga skinuti. Slanje na server je zaustavljeno dok ne odlučiš, da prazno stanje ne bi
       prepisalo ono što je gore.</p>
     <div class="btnrow">
       <button id="os-skini" class="btn">Skini spašeno</button>
       <button id="os-server" class="btn ghost">Uzmi sa servera</button>
     </div>
     <div class="traka-n">Ako koristiš nalog, „Uzmi sa servera" je najbrži put nazad. Spašeni fajl zadrži za svaki slučaj.</div>`);
  if(!b) return;
  b.querySelector('#os-skini').onclick=()=>{
    let sirovo=''; try{ sirovo=localStorage.getItem(LS_SPAS_KEY)||''; }catch(e){}
    preuzmiTekst('sub20-osteceno-'+TODAY+'.json', sirovo);
  };
  b.querySelector('#os-server').onclick=async()=>{
    UCITAVANJE_PALO=null;      /* covek je svesno izabrao da server pobedi */
    b.remove();
    await sbPull();
  };
}

/* Neuspeo upis u localStorage — jednom po sesiji, ne po svakom cuvanju. */
function prikaziUpisPao(ime){
  const b=trakaUpozorenja('upis-pao','upozorenje',
    `<b>Čuvanje na uređaju ne radi</b>
     <p>Pregledač je odbio upis (${esc(ime)}) — najčešće je skladište puno. Rad u ovoj sesiji se
       nastavlja i šalje se na server ako si prijavljen, ali <b style="display:inline;font-size:inherit;margin:0">zatvaranje aplikacije briše
       nesačuvano</b>. Napravi backup i oslobodi prostor.</p>
     <div class="btnrow">
       <button id="up-ok" class="btn ghost">U redu</button>
     </div>`);
  if(b) b.querySelector('#up-ok').onclick=()=>b.remove();
}

/* Poslednja prilika da se posalje pre nego sto se stranica zatvori. */
document.addEventListener('visibilitychange',()=>{
  /* Zakazan upis (beleška u koju se upravo kucalo) mora u localStorage PRE
     nego što aplikacija ode u pozadinu — odatle se možda više neće vratiti. */
  if(document.visibilityState==='hidden') saveOdmah();
  if(document.visibilityState==='hidden'&&sbAuthed()){ clearTimeout(SB_TIMER); sbPush(); }
  /* Povratak u aplikaciju je isto sto i otvaranje: instalirana PWA ume da
     stoji u pozadini danima, pa se bez ovoga prvo povlacenje desi tek posle
     rucnog restarta. */
  if(document.visibilityState==='visible'){
    /* PRVO pitanje pri povratku: da li nalog uopste jos postoji. Instalirana
       PWA stoji u pozadini danima, pa bi bez ovoga obrisan ili zabranjen
       korisnik nastavio da radi dok mu token ne istekne. Ostalo ispod nema
       smisla ako je odgovor ne. */
    sbProveriSesiju();
    /* Ako je u medjuvremenu presla ponoc, ceo ekran gleda pogresan dan —
       iscrtaj ponovo pre nego sto korisnik bilo sta klikne. */
    if(osveziDan()){ renderHeader(); PAGES[ACTIVE](); }
    icuAutoSync();
    /* Treninzi, ne samo jutarnja merenja — v. trPovuciAko. */
    trPovuciAko(15*60000);
    aiPokupiSve();          /* analiza koja je zavrsena dok je app bila zatvorena */
    /* Instalirana PWA ume da stoji u pozadini danima. Bez ovoga bi najave za
       jutarnji podsetnik ostale od pre nedelju dana, pa bi obaveštenje pisalo
       tuđi trening. `pushOsvezi` sam preskače poziv ako su već današnje. */
    pushOsvezi();
    /* Kartica vremena od v181 pokazuje i „sada". Instalirana PWA stoji otvorena
       satima, pa bez ovoga red „sada" nosi prognozu od jutros. vremePovuci sam
       preskace poziv ako je mladji od tri sata. */
    if(navigator.onLine&&S.ui&&S.ui.geo) vremePovuci(false).then(r=>{ if(r.ok&&!r.kes&&ACTIVE==='danas') renderDanas(); });
  }
});

/* ============================================================
   RANIJE VERZIJE — VRAĆANJE UNAZAD SA SERVERA

   Server je do sada bio OGLEDALO: `user_state` je jedan red koji se prepisuje
   u mestu, pa je verno prenosio i grešku. Obrisan unos ili pokvareno stanje
   stizali su gore za nekoliko sekundi i stara vrednost više nije postojala
   nigde. Zbog toga je backup fajl ostajao neophodan.

   Sada baza pre svake izmene sačuva prethodnu verziju (v. supabase/istorija.sql),
   a ovde se te verzije čitaju i vraćaju. Backup fajl time prestaje da bude
   jedini put nazad.

   ŠTA VRAĆANJE NIJE: nije „poništi poslednju izmenu". Vraća se CELO stanje na
   trenutak u prošlosti — sve što je posle toga uneseno nestaje sa ekrana.
   Zato se pre vraćanja pravi verzija i od zatečenog stanja (to radi sam okidač
   u bazi), pa se i taj korak može poništiti.
   ============================================================ */

let IST = { spisak:null, ucitava:false, greska:null };

/* Spisak je namerno bez `data`: pun JSON puta 40 verzija je nekoliko stotina
   kilobajta, a za izbor treba samo kad i sa čega. Sadržaj se povlači tek za
   verziju koja se stvarno vraća. */
async function istorijaUcitaj(){
  if(!sbAuthed()) return;
  IST.ucitava=true; IST.greska=null;
  if(!await sbEnsure()){ IST.ucitava=false; IST.greska='mreza'; return; }
  try{
    const r=await fetch(SB_URL+'/rest/v1/user_state_istorija'+
      '?select=id,napravljeno,app_version,device_id&user_id=eq.'+encodeURIComponent(SB.userId)+
      '&order=napravljeno.desc&limit=40',{headers:sbHead()});
    if(!r.ok){ IST.greska=zajRazlogIz(r.status); }
    else IST.spisak=await r.json();
  }catch(e){ IST.greska='mreza'; }
  IST.ucitava=false;
}

/* Vraćanje. Redosled je nosiv:
     1. povuci sadržaj te verzije
     2. propusti kroz `migrate` — verzija je mogla nastati u starijoj šemi
     3. TEK ONDA zameni `S` i upiši
   Da se `S` menja pre migracije, neuspela migracija bi ostavila aplikaciju u
   polovičnom stanju. */
async function istorijaVrati(id){
  if(!sbAuthed()) return {ok:false, greska:'Nisi prijavljen.'};
  if(!await sbEnsure()) return {ok:false, greska:'Nema veze sa internetom.'};
  let sirovo;
  try{
    const r=await fetch(SB_URL+'/rest/v1/user_state_istorija?select=data&id=eq.'+encodeURIComponent(id)+
      '&user_id=eq.'+encodeURIComponent(SB.userId),{headers:sbHead()});
    if(!r.ok) return {ok:false, greska:'Server nije dao tu verziju ('+r.status+').'};
    const j=await r.json();
    if(!Array.isArray(j)||!j[0]||!j[0].data) return {ok:false, greska:'Ta verzija više ne postoji.'};
    sirovo=j[0].data;
  }catch(e){ return {ok:false, greska:'Nema veze sa internetom.'}; }

  const mig=migrate(JSON.parse(JSON.stringify(sirovo)));
  if(!mig) return {ok:false, greska:'Ta verzija je iz novije šeme nego što je ova aplikacija. Ažuriraj aplikaciju pa probaj ponovo.'};

  /* ISTI put kao „Uzmi sa servera" — v. primiStanjeSaServera. Naročito je
     bitno da se veze sa Stravom i intervals.icu-om zadrže: na serveru stoje
     bez tokena, pa bi ih preuzimanje odande otkačilo. */
  const prethodno=S;
  try{ primiStanjeSaServera(mig); }
  catch(e){
    S=prethodno; setActivePlan(); rebuildDateIndex();
    return {ok:false, greska:'Vraćanje nije uspelo ('+e.message+'). Zatečeno stanje je netaknuto.'};
  }
  /* Odmah gore, ne za četiri sekunde: čovek je upravo svesno vratio stanje i
     ne sme da zatvori aplikaciju pre nego što to stigne na server. Sam upis
     pravi verziju od ZATEČENOG stanja, pa se i ovo može poništiti. */
  sbPush();
  return {ok:true};
}

function istorijaOpis(x){
  const d=new Date(x&&x.napravljeno);
  if(isNaN(d)) return '—';
  return d.toLocaleString('sr-RS',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

function openIstorijaSheet(){
  const crtaj=()=>{
    let telo;
    if(IST.ucitava) telo='<div class="zprazno">Povlačim spisak…</div>';
    else if(IST.greska) telo=`<div class="zprazno">${esc(zajPoruka(IST.greska))}</div>
      <div class="btnrow"><button class="btn ghost" id="ist-opet">Pokušaj ponovo</button></div>`;
    else if(!IST.spisak||!IST.spisak.length) telo=`<div class="zprazno">Još nema ranijih verzija.<br>Prva nastaje pri sledećoj izmeni.</div>`;
    else telo=IST.spisak.map(x=>`
      <div class="ztrow">
        <div class="ztt">${esc(istorijaOpis(x))}
          <small>verzija aplikacije ${esc(x.app_version||'—')}${x.device_id&&x.device_id!==SB.deviceId?' · drugi uređaj':''}</small></div>
        <button class="btn ghost sm" data-vrati="${esc(String(x.id))}">Vrati</button>
      </div>`).join('');

    openSheet(`
      <div class="sh-t">Ranije verzije</div>
      <div class="sh-s">Snimci tvojih podataka sa servera. Najviše 40, najviše jedan na sat.</div>
      <div class="card">${telo}</div>
      <div class="note-src">Vraćanje menja <b>celo</b> stanje na taj trenutak — sve uneseno posle njega nestaje sa ekrana. I zatečeno stanje se pre toga sačuva kao verzija, pa se i vraćanje može poništiti.</div>
    `);
    const o=$('#ist-opet');
    if(o) o.onclick=async()=>{ IST.greska=null; IST.ucitava=true; crtaj(); await istorijaUcitaj(); crtaj(); };
    document.querySelectorAll('[data-vrati]').forEach(b=>b.onclick=async()=>{
      const kada=b.closest('.ztrow');
      const kad=kada?kada.querySelector('.ztt').textContent.trim().split('\n')[0]:'';
      if(!confirm('Vratiti podatke na '+kad+'?\n\nSve uneseno posle tog trenutka nestaje sa ekrana. Zatečeno stanje se čuva kao verzija, pa se ovo može poništiti.')) return;
      b.disabled=true; b.textContent='Vraćam…';
      const r=await istorijaVrati(b.dataset.vrati);
      if(!r.ok){ b.disabled=false; b.textContent='Vrati'; alert(r.greska); return; }
      closeSheet();                    /* iscrtavanje je već uradio primiStanjeSaServera */
      alert('Vraćeno na '+kad+'.');
    });
  };
  IST.spisak=null; IST.ucitava=true; crtaj();
  istorijaUcitaj().then(crtaj);
}

/* ============================================================
   ZAJEDNICA — DOBROVOLJAN JAVNI PROFIL

   Do ovog bloka je sve u aplikaciji bilo isključivo lično. Zato ovde važi
   jedno pravilo iznad svih ostalih:

     NIŠTA NE IZLAZI IZ NALOGA DOK ČOVEK SAM NE UKLJUČI, I IZLAZI SAMO ONO
     ŠTO `zajednicaPayload` IZRIČITO NABROJI.

   `zajednicaPayload` je JEDINA tačka kroz koju podaci odlaze u tabelu
   zajednica_profil. Gradi se nabrajanjem polja, nikad kopiranjem stanja
   (`Object.assign(…, S)`), jer bi svako buduće polje u S tada izašlo napolje
   samo zato što je dodato. Test „ne izlazi ništa osim dozvoljenog" visi baš
   na tome i pada čim se to prekrši.

   ŠTA NIKAD NE ULAZI: HRV, puls u miru, san, težina, mapa bolova, beleške sa
   treninga, puls na treningu, AI analiza, e-adresa. Tih kolona nema ni u
   bazi — v. supabase/zajednica.sql.

   BROJEVI SE PROVERAVAJU PRE SLANJA. Baza ima `check` opsege na svakoj
   koloni; vrednost van opsega ne bi pokvarila samo to polje nego bi oborila
   CEO upis, pa bi prekidač u Podešavanjima „radio" a profil se ne bi
   pojavio. `uOpsegu` zato pretvara sve sumnjivo u `null` — polje koje
   nedostaje je uvek bolje od upisa koji ne prolazi.
   ============================================================ */

const ZAJ_TRCANJA_MAX = 8;
/* Isti opsezi kao `check` ograničenja u supabase/zajednica.sql. Kad se tamo
   promene, moraju i ovde — test „opsezi su isti kao u SQL-u" to čuva. */
const ZAJ_OPSEG = {
  vdot:[20,85], vdot_pocetni:[20,85], test3k_sec:[480,2400], km_nedelja:[0,300],
  plan_pct:[0,100], niz_dana:[0,3650], nedelja_br:[1,104], nedelja_od:[1,104],
  izazov_od:[0,21], izazov_ura:[0,21]
};
function uOpsegu(v, kljuc){
  const o=ZAJ_OPSEG[kljuc];
  if(!o||typeof v!=='number'||!isFinite(v)) return null;
  const z=r1(v);
  return (z>=o[0]&&z<=o[1])?z:null;
}

/* Ciljna distanca -> oznaka za filter. Pragovi su na pola puta između
   standardnih distanci, pa i 42.195 m i „42 km ravno" padaju u istu grupu. */
function zajCilj(){
  const m=raceDistActive();
  if(!(m>0)) return null;
  if(m>=30000) return '42K';
  if(m>=15000) return '21K';
  if(m>=8000)  return '10K';
  return '5K';
}

/* Ime na spisku. Nadimak ima prednost; bez njega SAMO PRVO IME sa Google
   naloga. Prezime se namerno odseca — puno ime i prezime na javnom spisku je
   znatno više nego što je čovek tražio kad je uključio prekidač. */
function zajIme(){
  const n=(S.zajed&&S.zajed.nadimak||'').trim();
  if(n) return n.slice(0,24);
  const g=(SB.ime||'').trim();
  return g?g.split(/\s+/)[0].slice(0,24):null;
}

/* Doslednost od početka plana: odrađeni trkački treninzi / oni kojima je rok
   prošao. Snaga i odmor se ne broje — snaga je opciona, a odmor bi razvodnio
   procenat na svakoga ko ima više dana odmora u nedelji. */
function zajDoslednost(){
  let rok=0, ura=0;
  for(const d of DATED){
    if(d.date>TODAY) break;
    if(d.rest||d.tag==='snaga'||d.tag==='trka') continue;
    rok++;
    if(stFor(d.id)==='done') ura++;
  }
  return rok?Math.round(ura*100/rok):null;
}

/* Poslednja trčanja — datum, tip, dužina, tempo. NIŠTA VIŠE.
   Beleške (`l.note`), puls (`l.hr`) i osećaj ostaju u nalogu; ovde se ne
   pominju ni slučajno, jer se objekat gradi nabrajanjem polja. */
function zajTrcanja(){
  const out=[];
  for(let i=DATED.length-1; i>=0 && out.length<ZAJ_TRCANJA_MAX; i--){
    const d=DATED[i];
    if(d.date>TODAY||d.rest||d.tag==='snaga') continue;
    if(stFor(d.id)!=='done') continue;
    const l=S.log[d.id]||{};
    const km=(l.km!=null)?l.km:(d.km!=null?d.km:null);
    out.push({
      d:d.date,
      t:(TAGS[d.tag]||'Trčanje').slice(0,24),
      o:(km!=null)?fmtKm(km)+' km':'—',
      p:(km>0&&l.sec>0)?fmtTempo(l.sec/km)+' /km':'—'
    });
  }
  return out;
}

/* Značke. Sve se računaju iz onoga što aplikacija već zna — nijedna ne traži
   novu tabelu, novo brojanje ni novo polje u stanju. */
function zajZnacke(){
  const z=[], niz=streak(TODAY);
  if(niz>=7) z.push('Niz 7 dana');
  if(niz>=30) z.push('Niz 30 dana');
  if(t3kNiz().length) z.push('Test na 3 km');
  /* Nedelja u kojoj je odrađeno sve što je planirano — i to ZAVRŠENA nedelja,
     ne tekuća: u tekućoj je „sve odrađeno" tačno i u ponedeljak ujutru. */
  for(const w of CUR_PLAN){
    if(addD(w.start,6)>=TODAY) continue;
    const n=weekRunCount(w);
    if(n>0&&weekRunDone(w)===n){ z.push('Nedelja 100%'); break; }
  }
  const trka=DATED.find(d=>d.tag==='trka');
  if(trka&&stFor(trka.id)==='done') z.push('Trka odrađena');
  return z;
}

/* JEDINA tačka kroz koju podaci izlaze iz naloga. V. zaglavlje bloka. */
function zajednicaPayload(){
  const w=weekOf(TODAY);
  const vl=(S.vdotLog||[]).filter(e=>e&&typeof e.vdot==='number');
  const t3=t3kNiz();
  const najbrzi=t3.length?Math.min.apply(null, t3.map(t=>t.sec)):null;
  const ime=zajIme();
  return {
    user_id:      SB.userId,
    vidljiv:      true,
    /* Nadimak kraći od dva znaka baza odbija; radije se šalje `null` (pa se
       prikazuju inicijali) nego da ceo upis padne. */
    nadimak:      (ime&&ime.length>=2)?ime:null,
    avatar_url:   (typeof SB.slika==='string'&&/^https:\/\//.test(SB.slika))?SB.slika:null,
    cilj:         zajCilj(),
    trka_datum:   validDatum(s2d(CUR_RACE))?CUR_RACE:null,
    nedelja_br:   w?uOpsegu(w.w,'nedelja_br'):null,
    nedelja_od:   uOpsegu(CUR_PLAN.length,'nedelja_od'),
    vdot:         uOpsegu(currentVdot(),'vdot'),
    vdot_pocetni: vl.length?uOpsegu(vl[0].vdot,'vdot_pocetni'):null,
    test3k_sec:   (najbrzi!=null)?uOpsegu(Math.round(najbrzi),'test3k_sec'):null,
    km_nedelja:   w?uOpsegu(weekRealKm(w),'km_nedelja'):null,
    plan_pct:     uOpsegu(zajDoslednost(),'plan_pct'),
    niz_dana:     uOpsegu(streak(TODAY),'niz_dana'),
    izazov_od:    w?uOpsegu(weekRunCount(w),'izazov_od'):null,
    izazov_ura:   w?uOpsegu(weekRunDone(w),'izazov_ura'):null,
    znacke:       zajZnacke(),
    trcanja:      zajTrcanja()
  };
}

/* ---------- ZAJEDNICA: EKRAN ----------

   Tri stanja koja se ne smeju pomešati:
     1. Zajednica isključena — ne prikazuje se NIŠTA tuđe, jer se ništa tuđe
        ni ne povlači. Kapija je u bazi (RLS), ovde je samo objašnjenje.
     2. Povlači se — kratko, i mora da se vidi da nešto radi.
     3. Spisak / profil.

   Poređenje sa drugima se računa OVDE, na uređaju. Ništa od toga ne odlazi
   nazad na server — niko ne vidi koga s kim porediš. */

let ZAJ = { ljudi:null, izazov:null, greska:null, razlog:null, ucitava:false, kad:0, filter:'sve', merilo:'t3k', otvoren:null };

const ZAJ_CILJEVI = [['sve','Sve'],['5K','5K'],['10K','10K'],['21K','21K'],['42K','42K']];

/* Tri merila, i to je namerno tri.
   „Test 3 km" je brzina i uvek će je voditi isti ljudi. Da je ostalo samo to,
   Zajednica bi za početnika bila spisak razloga da odustane. „Napredak" meri
   pomak od SOPSTVENOG početka, pa tu početnik redovno pobeđuje iskusnog
   trkača; „Doslednost" meri disciplinu, koja ne zavisi od talenta uopšte. */
const ZAJ_MERILA = [
  ['t3k', 'Test 3 km', 'najbrži gore',
   p => (p.test3k_sec!=null?p.test3k_sec:1e9),
   p => (p.test3k_sec!=null?fmtClock(p.test3k_sec):'—')],
  ['nap', 'Napredak', 'od početka plana',
   p => -zajNapredak(p),
   p => { const n=zajNapredak(p); return (n>0?'+':'')+fmtNum(n,1)+' VDOT'; }],
  ['dosl', 'Doslednost', 'plan odrađen',
   p => -(p.plan_pct!=null?p.plan_pct:-1),
   p => (p.plan_pct!=null?p.plan_pct+' %':'—')]
];

function zajNapredak(p){
  return (typeof p.vdot==='number'&&typeof p.vdot_pocetni==='number') ? r1(p.vdot-p.vdot_pocetni) : 0;
}
function zajJa(p){ return !!(p&&SB.userId&&p.user_id===SB.userId); }

/* Boja kruga iz identifikatora — ista osoba uvek ima istu boju, bez ijedne
   kolone u bazi. */
const ZAJ_BOJE = ['#5AFFBE','#5AE0FF','#FF6BA6','#FFC062','#A98BFF','#8CE99A','#FF9E7A'];
function zajBoja(id){
  let h=0; const s=String(id||'');
  for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
  return ZAJ_BOJE[h%ZAJ_BOJE.length];
}
function zajInicijali(ime){
  const d=String(ime||'?').trim().split(/\s+/).filter(Boolean);
  return ((d[0]||'?')[0]+((d[1]||'')[0]||'')).toUpperCase();
}
/* Ime pod kojim se neko prikazuje. Na jednom mestu, jer se koristi i za
   naslov reda i za inicijale u krugu — dok su bila dva izraza, red je pisao
   „Trkač" a krug je pokazivao „?". */
function zajPrikazIme(p){ return (p&&p.nadimak)||'Trkač'; }

/* Adresa slike, propuštena kroz usko sito.

   OVDE JE BIO PROPUST. Komentar je tvrdio da se „znakovi kojima bi to bilo
   moguće odbijaju u celosti", ali dozvoljeni skup je sadržao `&`, `#`, cifre i
   `;` — dakle sve što je potrebno za NUMERIČKE HTML ENTITETE. Vrednost je išla u
   `style="background-image:url(&quot;URL&quot;)"`, a pregledač vrednost atributa
   PRVO dekodira kao HTML: `&#34;` postane `"`, `&#41;` postane `)`, `&#59;`
   postane `;`. Tuđ `avatar_url` je time ubacivao proizvoljne CSS deklaracije u
   dokument svakog drugog korisnika. Provereno u pregledaču:
   `position:fixed;inset:0;z-index:99999` daje sloj preko CELOG ekrana koji beži
   iz `.zav{overflow:hidden}` i prima dodire umesto dugmadi ispod.
   Skripta se time ne izvršava (entiteti ne prekidaju atribut, pa se iz `style`
   ne izlazi u nov tag) i slika sa tuđeg hosta se ne učitava (CSP `img-src`), ali
   Zajednica postaje neupotrebljiva.

   Dva sloja, jer je jedan već jednom bio „dovoljan":
     1. ovde — `&` i `#` se odbijaju, pa entitet ne može ni da se sastavi;
     2. u `zajAvatar` — vrednost više NE ide u HTML atribut nego se posle
        iscrtavanja postavlja kroz `style.backgroundImage`, gde koraka
        „dekodiraj kao HTML" uopšte nema.
   Google avatari (`https://lh3.googleusercontent.com/a/ACg8oc…=s96-c`) nemaju ni
   `&` ni `#`, pa ih ovo ne dira. */
function zajSlikaUrl(u){
  if(typeof u!=='string') return null;
  return /^https:\/\/[a-zA-Z0-9.-]+\/[A-Za-z0-9\-._~:\/\[\]@!$*+,=%]*$/.test(u) ? u : null;
}

/* ZAŠTO POZADINA, A NE <img>.
   Prvo je stajao `<img>` preko kruga sa inicijalima, računajući da se pri
   neuspehu vide inicijali ispod. Na iPhoneu se to ne dešava: Safari nacrta
   SVOJU ikonicu slomljene slike (kvadratić sa upitnikom) tačno preko njih.
   Prijavljeno sa ekrana — upitnik preko avatara, iako nadimci postoje.
   Pozadina koja se ne učita ne crta ništa. Nema šta da pukne, i ne treba
   nijedan `onerror` (koji CSP ionako zabranjuje). */
function zajAvatar(p, d){
  const ime=zajPrikazIme(p);
  const slika=zajSlikaUrl(p&&p.avatar_url);
  /* Slika je zaseban SLOJ preko inicijala, a ne pozadina samog kruga.
     Razlika je vidljiva tačno u slučaju koji se i dogodio: adresa slike
     postoji, ali slika ne stigne. Da je pozadina kruga, inicijali bi bili
     unapred sakriveni i ostao bi prazan obojen krug; ovako providan sloj
     jednostavno ne pokrije ništa i inicijali se vide. */
  /* Adresa ide u `data-` atribut, a u `style` je stavlja `zajSlike()` posle
     iscrtavanja — v. zajSlikaUrl. Time nestaje korak u kom pregledač vrednost
     atributa dekodira kao HTML pre nego što je pročita kao CSS. */
  const sloj=slika ? `<i data-zsl="${esc(slika)}"></i>` : '';
  return `<span class="zav" style="width:${d}px;height:${d}px;background-color:${zajBoja(p.user_id)};font-size:${Math.round(d*0.4)}px">`
       + `<b>${esc(zajInicijali(ime))}</b>${sloj}</span>`;
}

/* Postavlja slike posle iscrtavanja. Poziva se sa svakog mesta koje iscrta
   avatar; višestruki poziv je bezbedan i bez posla (`delete` skida oznaku).
   CSSOM sam odbacuje vrednost koja nije ispravan `url(...)`, pa ovde nema šta
   da se escapuje — a i nema iz čega, jer je izvor već prošao `zajSlikaUrl`. */
function zajSlike(){
  document.querySelectorAll('[data-zsl]').forEach(el=>{
    const u=el.dataset.zsl; if(!u) return;
    el.style.backgroundImage='url("'+u+'")';
    delete el.dataset.zsl;
    el.removeAttribute('data-zsl');
  });
}

/* TUĐ PROFIL SE ČISTI NA ULAZU, KAO I SVE OSTALO SA SERVERA.

   Isti obrazac kao `cistWellness` i `cistVdotLog`: vrednosti nastaju računanjem,
   ali u aplikaciju stižu kao proizvoljan JSON i odatle idu pravo u HTML. Ovde je
   izvor još širi — red je upisao DRUG korisnik.

   Kolone u bazi jesu `integer`/`numeric` sa `check` opsezima, pa string kroz njih
   ne prolazi. Ali pravilo ove aplikacije je da ISCRTAVANJE escapuje i kad
   validacija otkaže (v. „Drugi sloj" u test/bezbednost.test.mjs), a tri broja —
   `plan_pct`, `niz_dana`, `izazov_ura` — išla su u HTML bez `esc()`, jer su
   „ionako brojevi". Zamka to nije videla dok Zajednica nije ušla u fuzz petlju.
   Umesto dvadesetak `esc()` poziva po fajlu, broj postaje broj OVDE: ono što nije
   konačan broj postaje `null` i nestaje iz prikaza, tačno kao u `cistWellness`.

   Tekstualna polja se i dalje escapuju pri iscrtavanju — ovo ih ne dira. */
/* Broj iz tuđeg profila, spreman za HTML. `esc()` bi radio isto, ali bi
   sugerisao da je vrednost tekst — a ovde je jedina ispravna vrednost broj, pa
   se sve što to nije pretvara u `null` i nestaje iz prikaza (isto pravilo kao
   `cistWellness`). Drugi sloj uz `zajCistProfil`: zamka u
   test/bezbednost.test.mjs namerno zaobilazi ulaznu proveru i piše pravo u
   `ZAJ.ljudi`, jer iscrtavanje mora da drži i kad validacija otkaže. */
function zajBr(v){
  /* NIZ NIJE BROJ, iako se ponaša kao broj: `+[]` je 0, `+[42]` je 42. Bez ovoga
     bi prazan niz iz tuđeg reda ušao kao nula i tiho se prikazao kao stvarna
     vrednost — uhvaćeno testom nad ulaznim slojem. Isto važi za `true`/`false`,
     koje `+` pretvara u 1 i 0. Prolazi samo ono što JESTE broj ili niz znakova
     koji ceo predstavlja broj. */
  if(v==null||v===''||typeof v==='boolean'||typeof v==='object') return null;
  const n=+v;
  return isFinite(n)?n:null;
}

const ZAJ_BROJEVI = ['vdot','vdot_pocetni','test3k_sec','km_nedelja','plan_pct',
  'niz_dana','izazov_od','izazov_ura','nedelja_br','nedelja_od'];
function zajCistProfil(p){
  if(!p||typeof p!=='object') return null;
  if(typeof p.user_id!=='string'||!p.user_id) return null;
  const c=Object.assign({},p);
  /* ISTO PRAVILO kao pri iscrtavanju — `zajBr`, jedno mesto. Dok su bila dva
     izraza, razišla su se: ovaj je propuštao `[]` kao nulu. */
  for(const k of ZAJ_BROJEVI) c[k]=zajBr(c[k]);
  /* Znamenja i trčanja su nizovi; sve ostalo u njima escapuje iscrtavanje. */
  c.znacke=Array.isArray(c.znacke)?c.znacke:[];
  c.trcanja=Array.isArray(c.trcanja)?c.trcanja:[];
  return c;
}
function zajCistiLjude(niz){
  return (Array.isArray(niz)?niz:[]).map(zajCistProfil).filter(Boolean);
}

/* --- povlačenje --- */
async function zajUcitaj(){
  if(!sbAuthed()||!(S.zajed&&S.zajed.vidljiv)) return;
  ZAJ.ucitava=true; ZAJ.greska=null;
  if(!await sbEnsure()){ ZAJ.ucitava=false; ZAJ.greska='mreza'; if(ACTIVE==='zajed') renderZajednica(); return; }
  try{
    const [rp,ri]=await Promise.all([
      fetch(SB_URL+'/rest/v1/zajednica_profil?select=*&vidljiv=is.true',{headers:sbHead()}),
      fetch(SB_URL+'/rest/v1/zajednica_izazov?select=tekst&id=eq.1',{headers:sbHead()})
    ]);
    if(!rp.ok){ ZAJ.greska=zajRazlogIz(rp.status); }
    else{
      const j=await rp.json();
      ZAJ.ljudi=zajCistiLjude(j);
    }
    if(ri.ok){ const t=await ri.json(); ZAJ.izazov=(Array.isArray(t)&&t[0]&&t[0].tekst)||null; }
  }catch(e){ ZAJ.greska='mreza'; }
  ZAJ.ucitava=false;
  if(!ZAJ.greska) ZAJ.kad=Date.now();
  if(ACTIVE==='zajed') renderZajednica();
}

/* --- ekran --- */
function renderZajednica(){
  const el=$('#pg-zajed');
  if(!sbAuthed()){
    el.innerHTML=`<div class="card"><div class="card-t">Zajednica</div>
      <div class="zprazno">Zajednica traži nalog, jer se spisak čuva na serveru.<br>Prijavi se u Podešavanjima.</div></div>`;
    return;
  }
  if(!(S.zajed&&S.zajed.vidljiv)){
    /* Zatvorena vrata se ne prikazuju kao greška nego kao izbor — sa tačnim
       spiskom šta se deli i dugmetom koje vodi tamo gde se to uključuje. */
    el.innerHTML=`<div class="card">
      <div class="dhead"><span class="card-t">Zajednica</span><span class="dhead-x">isključena</span></div>
      <div class="set-st">Rang-lista trkača koji koriste ovu aplikaciju. Dok je isključena, ne postojiš na spisku i <b>ne vidiš tuđe profile</b> — vidljivost je uzajamna.</div>
      <div class="zsta">
        <div><i>Deli se</i><p>nadimak i slika, cilj i datum trke, nedelja plana, VDOT, test na 3 km, kilometraža, doslednost, niz, značke i poslednja trčanja</p></div>
        <div><i>Ne deli se nikad</i><p>HRV, puls u miru, san, težina, mapa bolova, beleške sa treninga, puls na treningu, AI analiza, e-adresa</p></div>
      </div>
      <div class="btnrow" style="margin-top:14px"><button class="btn" id="zaj-ka-set">Uključi u Podešavanjima</button></div>
      <div class="note-src"><a href="./privacy.html" target="_blank" rel="noopener" style="color:inherit">Politika privatnosti</a></div>
    </div>`;
    const b=$('#zaj-ka-set'); if(b) b.onclick=openSettings;
    return;
  }
  if(ZAJ.ljudi==null&&!ZAJ.greska){
    el.innerHTML=`<div class="card"><div class="card-t">Zajednica</div>
      <div class="zprazno">${ZAJ.ucitava?'Povlačim spisak…':'Spisak još nije povučen.'}</div></div>`;
    if(!ZAJ.ucitava) zajUcitaj();
    return;
  }
  if(ZAJ.greska&&ZAJ.ljudi==null){
    el.innerHTML=`<div class="card"><div class="dhead"><span class="card-t">Zajednica</span><span class="dhead-x">nije povučeno</span></div>
      <div class="zprazno">${esc(zajPoruka(ZAJ.greska))}<br>Sve ostalo u aplikaciji radi normalno.</div>
      <div class="btnrow"><button class="btn ghost" id="zaj-opet">Pokušaj ponovo</button></div></div>`;
    const b=$('#zaj-opet'); if(b) b.onclick=()=>{ ZAJ.greska=null; renderZajednica(); zajUcitaj(); };
    return;
  }
  const otv=ZAJ.otvoren?(ZAJ.ljudi||[]).find(p=>p.user_id===ZAJ.otvoren):null;
  el.innerHTML=otv?zajProfil(otv):zajSpisak();
  zajVezi(el);
}

/* Spisak se osvežava PRI ULASKU u tab, ali ne češće od pet minuta i nikad
   praznjenjem ekrana: stari spisak ostaje na ekranu dok novi ne stigne. Da se
   povlači pri svakom dodiru, prelazak između tabova bi značio poziv serveru; da
   se povlači samo jednom, tuđi brojevi bi ostajali jučerašnji dok se aplikacija
   ne zatvori — a instalirana PWA stoji otvorena danima. */
function zajMozdaOsvezi(){
  if(!sbAuthed()||!(S.zajed&&S.zajed.vidljiv)||ZAJ.ucitava) return;
  if(ZAJ.ljudi!=null&&Date.now()-ZAJ.kad<300000) return;
  zajUcitaj();
}

function zajFiltrirani(){
  const f=ZAJ.filter;
  return (ZAJ.ljudi||[]).filter(p=>f==='sve'||p.cilj===f);
}

function zajSpisak(){
  const M=ZAJ_MERILA.find(m=>m[0]===ZAJ.merilo)||ZAJ_MERILA[0];
  const svi=zajFiltrirani();
  const lista=svi.slice().sort((a,b)=>M[3](a)-M[3](b));
  const ja=(ZAJ.ljudi||[]).find(zajJa);

  const red=(p,i,vred,pod)=>`
    <button class="zrow" data-p="${esc(p.user_id)}">
      <span class="zmesto"${i===0?' style="color:var(--amber)"':''}>${i+1}</span>
      ${zajAvatar(p,40)}
      <span class="zi">
        <span class="zime">${esc(zajPrikazIme(p))}${zajJa(p)?' <span style="color:var(--cyan)">· ti</span>':''}</span>
        <span class="zs">${esc(pod)}</span>
      </span>
      <span class="zv"><b${ZAJ.merilo==='nap'?' style="color:var(--green)"':''}>${esc(vred)}</b>
        <span>${(i===0&&vred!=='—')?'PRVI':''}</span></span>
    </button>`;

  const podnaslov=p=>[p.cilj||'—',
    (p.nedelja_br&&p.nedelja_od)?('nedelja '+p.nedelja_br+' / '+p.nedelja_od):null,
    p.trka_datum?('trka '+fmtD(p.trka_datum)):null].filter(Boolean).join(' · ');

  /* IZAZOV. Rangira se po UDELU odrađenog, ne po broju — inače bi onaj kome
     plan te nedelje daje šest treninga uvek bio ispred onoga sa četiri, iako
     je drugi odradio sve svoje. */
  const udeo=p=>(p.izazov_od>0?(p.izazov_ura||0)/p.izazov_od:0);
  const izazovLista=svi.slice().filter(p=>p.izazov_od>0).sort((a,b)=>udeo(b)-udeo(a));
  const gotovih=izazovLista.filter(p=>p.izazov_ura>=p.izazov_od).length;

  return `
  <div class="card">
    <div class="dhead"><span class="card-t">Izazov nedelje</span><span class="dhead-x">${gotovih} od ${izazovLista.length} završilo</span></div>
    <div class="set-st"><b>${esc(ZAJ.izazov||'Odradi sve treninge po planu ove nedelje.')}</b></div>
    ${izazovLista.length?`<div style="margin-top:12px">${izazovLista.map(p=>{
      const gotov=p.izazov_ura>=p.izazov_od;
      return `<button class="zrow" data-p="${esc(p.user_id)}" style="align-items:center">
        ${zajAvatar(p,34)}
        <span class="zi">
          <span class="zime" style="font-size:.86rem">${esc(zajPrikazIme(p))}${zajJa(p)?' <span style="color:var(--cyan)">· ti</span>':''}${gotov?' <span style="color:var(--green);font-size:.7rem;font-weight:800">✓ gotovo</span>':''}</span>
          <span class="zprog${gotov?' pun':''}"><i style="width:${Math.max(0,Math.min(100,Math.round(udeo(p)*100)))}%"></i></span>
        </span>
        <span class="zv"><b style="font-size:.92rem">${zajBr(p.izazov_ura)||0}/${zajBr(p.izazov_od)||0}</b></span>
      </button>`;}).join('')}</div>`:''}
    <div class="note-src">Izazov ne meri brzinu — samo da se ne preskače.</div>
  </div>

  <div class="zfilteri" role="tablist" aria-label="Filter po ciljnoj distanci">
    ${ZAJ_CILJEVI.map(([k,t])=>`<button class="zchip${ZAJ.filter===k?' on':''}" role="tab"
      aria-selected="${ZAJ.filter===k}" data-f="${k}">${t}</button>`).join('')}
  </div>

  <div class="card">
    <div class="zseg" role="tablist" aria-label="Po čemu se rangira">
      ${ZAJ_MERILA.map(m=>`<button role="tab" aria-selected="${ZAJ.merilo===m[0]}"
        class="${ZAJ.merilo===m[0]?'on':''}" data-m="${m[0]}">${m[1]}</button>`).join('')}
    </div>
    <div class="dhead" style="margin-top:8px"><span class="card-t">${M[1]}</span><span class="dhead-x">${M[2]}</span></div>
    ${lista.length
      ? lista.map((p,i)=>red(p,i,M[4](p),podnaslov(p))).join('')
      : `<div class="zprazno">${ZAJ.filter==='sve'
          ? 'Za sada niko ne deli profil.<br>Budi prvi.'
          : 'Niko sa ciljem '+esc(ZAJ.filter)+' još ne deli profil.<br>Budi prvi.'}</div>`}
    <div class="note-src">${
      ZAJ.merilo==='nap' ? 'Napredak meri koliko si <b>ti</b> napredovao od početka svog plana — ne koliko si brz. Ovde početnik pobeđuje iskusnog trkača.'
      : ZAJ.merilo==='dosl' ? 'Koliko je od planiranih treninga stvarno odrađeno. Ne meri talenat nego disciplinu.'
      : 'Vidiš samo one koji su i sami uključili profil.'}</div>
  </div>

  <div class="card">
    <div class="dhead"><span class="card-t">Ove nedelje</span><span class="dhead-x">kilometraža</span></div>
    ${svi.slice().sort((a,b)=>(b.km_nedelja||0)-(a.km_nedelja||0)).map(p=>`
      <button class="zrow" data-p="${esc(p.user_id)}">
        ${zajAvatar(p,34)}
        <span class="zi"><span class="zime" style="font-size:.86rem">${esc(zajPrikazIme(p))}</span></span>
        <span class="zv"><b style="font-size:.95rem">${p.km_nedelja!=null?fmtKm(p.km_nedelja)+' km':'—'}</b>
          <span style="letter-spacing:0;text-transform:none;font-weight:600">${zajJa(p)?'ti · ':''}${zajBr(p.plan_pct)!=null?zajBr(p.plan_pct)+' % plana':''}</span></span>
      </button>`).join('')}
  </div>
  ${ja?'':`<div class="note-src" style="margin-top:-4px">Tvoj profil se pojavljuje posle prve sinhronizacije.</div>`}`;
}

function zajProfil(p){
  const ja=(ZAJ.ljudi||[]).find(zajJa);
  const jaSam=zajJa(p);
  const t=Array.isArray(p.trcanja)?p.trcanja:[];
  const zn=Array.isArray(p.znacke)?p.znacke:[];
  /* RAZLIKA SE RAČUNA NA BROJU, pa se tek onda formatira. Prva verzija (u
     maketi) je poredila već formatiran string — a `"4,2" > 0` je u JS-u uvek
     false, pa se plus nikad nije pojavio ni zeleno upalilo. */
  const znak=n=>(n>0?'+':'')+fmtNum(n,1);
  const napP=zajNapredak(p), napJ=ja?zajNapredak(ja):0;

  const poredjenje=(!jaSam&&ja)?`
  <div class="card">
    <div class="dhead"><span class="card-t">Duel</span><span class="dhead-x">doslednost i napredak</span></div>
    <div class="zduel">
      <div class="zds"><b style="color:var(--cyan)">${zajBr(ja.plan_pct)!=null?zajBr(ja.plan_pct)+' %':'—'}</b><span>TI</span></div>
      <div class="zvs">VS</div>
      <div class="zds"><b>${zajBr(p.plan_pct)!=null?zajBr(p.plan_pct)+' %':'—'}</b><span>${esc(zajPrikazIme(p).split(' ')[0].toUpperCase())}</span></div>
    </div>
    <div class="drows" style="margin-top:10px">
      <div class="drow"><span class="l">plan odrađen</span><span class="v">
        <b style="color:${(ja.plan_pct||0)>=(p.plan_pct||0)?'var(--green)':'var(--txt3)'}">${(ja.plan_pct||0)>=(p.plan_pct||0)?'vodiš':'zaostaješ'}</b></span></div>
      <div class="drow"><span class="l">niz dana</span><span class="v"><b>${zajBr(ja.niz_dana)||0} : ${zajBr(p.niz_dana)||0}</b></span></div>
      <div class="drow"><span class="l">napredak VDOT-a</span><span class="v"><b>${znak(napJ)} : ${znak(napP)}</b></span></div>
    </div>
    <div class="note-src">Duel meri doslednost i napredak, ne brzinu — zato ima smisla i kad niste isti nivo.</div>
  </div>

  <div class="card">
    <div class="dhead"><span class="card-t">U odnosu na tebe</span><span class="dhead-x">${p.cilj===ja.cilj?'isti cilj':esc((p.cilj||'—')+' vs '+(ja.cilj||'—'))}</span></div>
    <div class="drows">
      ${(p.vdot!=null&&ja.vdot!=null)?`<div class="drow"><span class="l">VDOT</span><span class="v"><b>${fmtNum(p.vdot,1)}</b>
        <small style="color:${p.vdot>ja.vdot?'var(--green)':'var(--txt3)'}">${znak(r1(p.vdot-ja.vdot))} od tebe</small></span></div>`:''}
      ${(p.test3k_sec!=null&&ja.test3k_sec!=null)?(()=>{const r=p.test3k_sec-ja.test3k_sec;
        return `<div class="drow"><span class="l">test na 3 km</span><span class="v"><b>${fmtClock(p.test3k_sec)}</b>
        <small style="color:${r<0?'var(--green)':'var(--txt3)'}">${Math.abs(r)} s ${r<0?'brže':'sporije'}</small></span></div>`;})():''}
      ${(p.km_nedelja!=null&&ja.km_nedelja!=null)?`<div class="drow"><span class="l">ove nedelje</span><span class="v"><b>${fmtKm(p.km_nedelja)} km</b>
        <small>${znak(r1(p.km_nedelja-ja.km_nedelja))} km</small></span></div>`:''}
    </div>
    <div class="note-src">Poređenje se računa na tvom uređaju. Niko ne vidi koga s kim porediš.</div>
  </div>`:'';

  return `
  <button class="znazad" data-nazad="1">← Zajednica</button>
  <div class="card">
    <div class="zhero">
      ${zajAvatar(p,74)}
      <div><div class="zpn">${esc(zajPrikazIme(p))}</div>
        <div class="zpm">${esc([p.cilj||'—',
          (p.nedelja_br&&p.nedelja_od)?('nedelja '+p.nedelja_br+' / '+p.nedelja_od):null,
          p.trka_datum?('trka '+fmtD(p.trka_datum)):null].filter(Boolean).join(' · '))}</div></div>
    </div>
    <div class="ob-vpaces">
      <div class="ob-vp"><i>VDOT</i><b>${p.vdot!=null?fmtNum(p.vdot,1):'—'}</b></div>
      <div class="ob-vp"><i>Test 3 km</i><b>${p.test3k_sec!=null?fmtClock(p.test3k_sec):'—'}</b></div>
      <div class="ob-vp"><i>Niz</i><b>${zajBr(p.niz_dana)||0}</b></div>
    </div>
  </div>

  <div class="card">
    <div class="dhead"><span class="card-t">Poslednja trčanja</span><span class="dhead-x">${t.length}</span></div>
    ${t.length?t.map(x=>`<div class="ztrow">
      <div class="ztd">${esc(fmtD(x&&x.d))}</div>
      <div class="ztt">${esc((x&&x.t)||'Trčanje')}<small>${esc((x&&x.o)||'—')}</small></div>
      <div class="ztp">${esc((x&&x.p)||'—')}</div></div>`).join('')
      :`<div class="zprazno">Još nema zabeleženih trčanja.</div>`}
    <div class="note-src">Beleške, puls, oporavak i AI analiza <b>ne izlaze</b> iz ${jaSam?'tvog':'njegovog'} naloga.</div>
  </div>

  ${zn.length?`<div class="card">
    <div class="dhead"><span class="card-t">Značke</span><span class="dhead-x">${zn.length}</span></div>
    <div class="zznacke">${zn.map((z,i)=>`<span class="zznak${i===0?' zlat':''}">${esc(z)}</span>`).join('')}</div>
  </div>`:''}
  ${poredjenje}`;
}

function zajVezi(el){
  zajSlike();   /* pozadine se postavljaju iz JS-a, ne iz HTML atributa */
  el.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{ ZAJ.filter=b.dataset.f; renderZajednica(); });
  el.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ ZAJ.merilo=b.dataset.m; renderZajednica(); });
  el.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{ ZAJ.otvoren=b.dataset.p; renderZajednica(); window.scrollTo(0,0); });
  el.querySelectorAll('[data-nazad]').forEach(b=>b.onclick=()=>{ ZAJ.otvoren=null; renderZajednica(); window.scrollTo(0,0); });
}

/* --- mreža --- */

/* Upis (i osvežavanje) sopstvenog reda. `merge-duplicates` znači da prvi put
   pravi red, a svaki sledeći put ga menja — bez posebnog puta za jedno i za
   drugo, i bez pitanja „da li već postojim". */
/* ZAŠTO SE PAMTI RAZLOG, A NE SAMO „nije uspelo".
   Prva verzija je na svaki neuspeh pisala „Pokušaj ponovo". Kad tabele nema u
   bazi — a nema je dok se supabase/zajednica.sql ne pusti rukom — ponavljanje
   ne pomaže nikad, pa je poruka slala čoveka u krug. Razlog se čuva ovde i
   pretvara u rečenicu koja kaže ŠTA da se uradi. */
function zajRazlogIz(status){
  /* PostgREST na nepostojeću tabelu vraća 404 (PGRST205, „Could not find the
     table in the schema cache"). To je jedini ishod koji se ne rešava
     ponavljanjem nego puštanjem SQL fajla. */
  if(status===404) return 'nema-tabele';
  /* 401/403 znači da tabela postoji ali `grant`/politike nisu prošle — tj.
     fajl je pušten do pola. Isti lek, ista poruka. */
  if(status===401||status===403) return 'nema-prava';
  if(status>=500) return 'server';
  return 'nepoznato';
}

async function zajUpisi(){
  ZAJ.razlog=null;
  if(!sbAuthed()||!(S.zajed&&S.zajed.vidljiv)) return false;
  if(!await sbEnsure()){ ZAJ.razlog='mreza'; return false; }
  try{
    const r=await fetch(SB_URL+'/rest/v1/zajednica_profil',{
      method:'POST',
      headers:Object.assign(sbHead(),{'Prefer':'resolution=merge-duplicates,return=minimal'}),
      body:JSON.stringify(zajednicaPayload())
    });
    if(!r.ok) ZAJ.razlog=zajRazlogIz(r.status);
    return r.ok;
  }catch(e){ ZAJ.razlog='mreza'; return false; }
}

/* Isključivanje BRIŠE red, ne postavlja `vidljiv=false`.
   Razlika je stvarna: red sa `vidljiv=false` i dalje sadrži nadimak, sliku,
   brojeve i poslednja trčanja, i dalje stoji u tuđoj bazi, i vraća se čim
   neko negde promeni jedan boolean. Politika privatnosti obećava brisanje —
   pa se briše. */
async function zajObrisi(){
  ZAJ.razlog=null;
  if(!sbAuthed()) return false;
  if(!await sbEnsure()){ ZAJ.razlog='mreza'; return false; }
  try{
    const r=await fetch(SB_URL+'/rest/v1/zajednica_profil?user_id=eq.'+encodeURIComponent(SB.userId),
      {method:'DELETE',headers:sbHead()});
    if(!r.ok) ZAJ.razlog=zajRazlogIz(r.status);
    return r.ok;
  }catch(e){ ZAJ.razlog='mreza'; return false; }
}

/* Jedna rečenica po razlogu — svaka kaže sledeći korak, ne samo šta ne valja. */
function zajPoruka(razlog){
  if(razlog==='nema-tabele'||razlog==='nema-prava')
    return 'Tabele Zajednice još nema u bazi. Supabase → SQL Editor → nalepi ceo supabase/zajednica.sql → Run, pa probaj opet.';
  if(razlog==='mreza')
    return 'Nema veze sa internetom. Ovo mora da stigne do servera, pa ništa nije promenjeno.';
  if(razlog==='server')
    return 'Server trenutno ne odgovara. Ništa nije promenjeno — probaj za koji minut.';
  return 'Nije uspelo. Ništa nije promenjeno.';
}

/* Uključivanje/isključivanje iz Podešavanja. Vraća `true` ako je stanje
   stvarno promenjeno NA SERVERU — prekidač koji klikne a ništa ne upiše je
   gore od prekidača koji kaže da nije uspeo. */
async function zajPostavi(vidljiv){
  S.zajed=S.zajed||{vidljiv:false,nadimak:''};
  const pre=S.zajed.vidljiv;
  S.zajed.vidljiv=!!vidljiv;
  save();
  const ok=vidljiv?await zajUpisi():await zajObrisi();
  if(!ok){ S.zajed.vidljiv=pre; save(); }
  return ok;
}

/* ============================================================================
   OBAVEŠTENJA, POZADINSKA I POVREMENA SINHRONIZACIJA

   Tri odvojene stvari koje dele isti most ka service workeru (IndexedDB) i
   zato stoje zajedno:

   1. OBAVEŠTENJA (Web Push) — jutarnji podsetnik šta je danas na planu, i
      poruka kad AI analiza završi dok je aplikacija zatvorena. Radi i kad je
      aplikacija ugašena, jer poruku isporučuje pregledač, ne mi.

   2. POZADINSKI UPIS (Background Sync) — unos napravljen bez signala stigne
      na server čim se veza vrati, i ako je aplikacija u međuvremenu zatvorena.

   3. POVREMENO OSVEŽAVANJE (Periodic Sync) — Chrome/Android, samo za
      instaliranu aplikaciju: offline kopija i provera nove verzije se
      osvežavaju bez otvaranja aplikacije.

   ŠTA SE NE MENJA: sve troje je DODATAK. Ako pregledač nešto od ovoga ne
   podržava (iOS nema periodic sync i nema background sync; push traži da
   aplikacija bude dodata na početni ekran), aplikacija radi potpuno isto kao
   do sada — samo bez tog dodatka. Nijedna postojeća putanja ne zavisi od
   ovoga.
   ========================================================================= */

/* --- MOST KA SERVICE WORKERU ---
   Service worker NEMA pristup localStorage-u. Sve što mu treba dok je
   aplikacija zatvorena (koji nalog, koji token, šta je ostalo neposlato)
   mora da prođe kroz IndexedDB. Ovde se upisuje, u sw.js se čita. */
const IDB_BAZA='sub19', IDB_SKLAD='red';
function idbOtvori(){
  return new Promise((res,rej)=>{
    if(!('indexedDB' in window)){ rej(new Error('nema IndexedDB')); return; }
    const z=indexedDB.open(IDB_BAZA,1);
    z.onupgradeneeded=()=>{ const db=z.result; if(!db.objectStoreNames.contains(IDB_SKLAD)) db.createObjectStore(IDB_SKLAD); };
    z.onsuccess=()=>res(z.result);
    z.onerror=()=>rej(z.error);
  });
}
function idbRadi(nacin,posao){
  return idbOtvori().then(db=>new Promise((res,rej)=>{
    const t=db.transaction(IDB_SKLAD,nacin), s=t.objectStore(IDB_SKLAD);
    const z=posao(s);
    z.onsuccess=()=>res(z.result);
    z.onerror=()=>rej(z.error);
  }));
}
function idbCitaj(k){ return idbRadi('readonly',s=>s.get(k)).catch(()=>null); }
function idbUpisi(k,v){ return idbRadi('readwrite',s=>s.put(v,k)).catch(()=>null); }
function idbObrisi(k){ return idbRadi('readwrite',s=>s.delete(k)).catch(()=>null); }

/* `navigator.serviceWorker.ready` NIKAD ne odbija — ako registracije nema,
   samo visi zauvek. Bez roka bi svako mesto koje ga čeka (Podešavanja,
   uključivanje obaveštenja) tiho stalo. */
function swSpremna(rok){
  if(!('serviceWorker' in navigator)) return Promise.resolve(null);
  return Promise.race([
    navigator.serviceWorker.ready.catch(()=>null),
    new Promise(r=>setTimeout(()=>r(null), rok||4000))
  ]);
}

/* --- ZAPIS O NALOGU ZA POZADINU ---
   Piše se pri prijavi i pri svakom osvežavanju tokena. Sadrži i pristupni i
   `istice`, da service worker može SAM da proceni da li token još važi — a
   ne da ga potroši i sazna to iz odgovora servera. */
function pozadinskiNalog(vapid){
  try{
    if(!SB||!SB.userId||!SB.refresh) return Promise.resolve(null);
    return idbCitaj('nalog').then(staro=>idbUpisi('nalog',{
      url:SB_URL, anon:SB_ANON, userId:SB.userId, uredjaj:SB.deviceId||null,
      /* PRISTUPNI token ide, REFRESH ne. Refresh se pri upotrebi rotira; da ga
         pozadina potroši, kopija u localStorage bi postala neupotrebljiva i
         korisnik bi bio odjavljen bez razloga (v. `guraniStanje` u sw.js). */
      access:SB.access||null,
      /* MILISEKUNDE, i to piše u imenu. `SB.expiresAt` je apsolutan trenutak u
         ms (Date.now()+expires_in*1000), a `S.strava.expiresAt` u istoj
         aplikaciji je u SEKUNDAMA — dva polja istog imena, dve jedinice.
         Prva verzija ovog zapisa je to promašila i množila sa 1000, pa je
         pozadini svaki token izgledao večno važeći. */
      isticeMs:SB.expiresAt||0,
      vapid:vapid||(staro&&staro.vapid)||null
    })).catch(()=>null);
  }catch(e){ return Promise.resolve(null); }
}
function pozadinskiZaboravi(){
  return Promise.all([idbObrisi('nalog'),idbObrisi('stanje'),idbObrisi('pretplata-neposlata')]).catch(()=>null);
}

/* --- ODLOŽEN UPIS STANJA ---
   Zove se kad sbPush() ne uspe zbog mreže. Red je KOPIJA onoga što je ionako
   u localStorage — ako se u pozadini bilo šta ne poklopi, sme da se baci bez
   gubitka (v. `guraniStanje` u sw.js). */
async function pozadinskiZakazi(){
  try{
    if(!sbAuthed()||UCITAVANJE_PALO) return false;
    const reg=await swSpremna(2000);
    if(!reg||!('sync' in reg)) return false;    /* iOS nema Background Sync */
    await pozadinskiNalog();
    await idbUpisi('stanje',{seenAt:SB.seenAt||null, podaci:sbPayload(S), at:Date.now()});
    await reg.sync.register('sub19-stanje');
    return true;
  }catch(e){ return false; }
}
function pozadinskiOtkazi(){ try{ return idbObrisi('stanje'); }catch(e){ return Promise.resolve(null); } }

/* --- POVREMENO OSVEŽAVANJE ---
   Traži se samo kad su obaveštenja već uključena: dozvola `periodic-background-sync`
   se u Chrome-u ne dobija dijalogom nego procenom koliko se aplikacija koristi,
   pa nema šta da se pita — ili je ima, ili je nema. */
async function periodicnaPrijava(){
  try{
    const reg=await swSpremna(2000);
    if(!reg||!reg.periodicSync) return false;
    if(navigator.permissions&&navigator.permissions.query){
      const st=await navigator.permissions.query({name:'periodic-background-sync'}).catch(()=>null);
      if(st&&st.state!=='granted') return false;
    }
    await reg.periodicSync.register('sub19-osvezi',{minInterval:12*3600*1000});
    return true;
  }catch(e){ return false; }
}
async function periodicnaOdjava(){
  try{
    const reg=await swSpremna(2000);
    if(reg&&reg.periodicSync) await reg.periodicSync.unregister('sub19-osvezi');
  }catch(e){}
}

/* --- OBAVEŠTENJA --- */
let PUSH_VAPID=null;   /* javni ključ; čita se sa servera, ne stoji u kodu */

/* Ključ NE stoji u app.js namerno. Da stoji, promena ključeva na serveru bi
   ćutke razvalila sve pretplate: pregledač bi i dalje slao stari ključ, push
   servis bi vraćao 403, a u Podešavanjima bi i dalje pisalo „uključeno". */
async function pushVapid(){
  if(PUSH_VAPID) return PUSH_VAPID;
  try{
    const r=await fetch('/api/push');
    if(!r.ok) return null;
    const j=await r.json();
    if(!j||!j.podeseno||!j.kljuc) return null;
    PUSH_VAPID=j.kljuc;
    return PUSH_VAPID;
  }catch(e){ return null; }
}
function pushPodrzan(){
  return !!(('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window));
}
function pushDozvola(){
  try{ return ('Notification' in window)?Notification.permission:'unsupported'; }catch(e){ return 'unsupported'; }
}
function pushBajtovi(b64){
  const t=String(b64).replace(/-/g,'+').replace(/_/g,'/');
  const b=atob(t+'='.repeat((4-t.length%4)%4));
  const u=new Uint8Array(b.length);
  for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);
  return u;
}
/* Da li postojeća pretplata pripada ključu koji server SADA koristi. Ako ne,
   mora da se poništi pa napravi nova — inače push servis odbija svaku poruku,
   a ništa u aplikaciji to ne pokazuje. */
function pushIstiKljuc(sub,kljuc){
  try{
    const a=sub&&sub.options&&sub.options.applicationServerKey;
    if(!a) return true;                         /* Safari ne izlaže options — veruj */
    const x=new Uint8Array(a), y=pushBajtovi(kljuc);
    if(x.length!==y.length) return false;
    for(let i=0;i<x.length;i++) if(x[i]!==y[i]) return false;
    return true;
  }catch(e){ return true; }
}
/* `token` se prosleđuje SAMO pri odjavi: tada se SB briše u istom potezu, pa
   `sbToken()` više ne bi imao odakle da ga uzme. */
async function pushPosalji(akcija,dodatno,token){
  const t=token||await sbToken();
  if(!t) return {ok:false,error:'Prijava je istekla — prijavi se ponovo.'};
  try{
    const r=await fetch('/api/push',{method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},
      body:JSON.stringify(Object.assign({akcija},dodatno||{}))});
    let j={}; try{ j=await r.json(); }catch(e){}
    if(!r.ok) return {ok:false,error:j.error||('Greška '+r.status)};
    return Object.assign({ok:true},j);
  }catch(e){ return {ok:false,error:'Nema veze sa serverom.'}; }
}

/* Šta će pisati u jutarnjem obaveštenju za narednih nedelju dana. Računa se
   OVDE, ne na serveru: plan, tempo i tipovi sesija žive u ovom fajlu i tu i
   ostaju — serverska kopija te logike bi se razišla prvom izmenom plana.
   Prazan tekst = dan odmora; server ga vidi i tada ne šalje ništa. */
function najaveZaNedelju(){
  const out={};
  for(let i=0;i<8;i++){
    const dan=addD(TODAY,i);
    const d=BY_DATE[dan];
    if(!d||d.rest){ out[dan]=''; continue; }
    const kind=String(sessKind(d)||'Trening');
    out[dan]=(d.km?kind+' · '+fmtKm(d.km)+' km':kind).slice(0,120);
  }
  return out;
}

async function pushPretplataSada(){
  const reg=await swSpremna(2000);
  if(!reg||!reg.pushManager) return null;
  try{ return await reg.pushManager.getSubscription(); }catch(e){ return null; }
}

async function pushUkljuci(){
  if(!pushPodrzan()) return {ok:false,error:'Ovaj pregledač ne podržava obaveštenja.'};
  if(!sbAuthed()) return {ok:false,error:'Za obaveštenja je potrebna prijava — podsetnik šalje server, ne telefon.'};
  const kljuc=await pushVapid();
  if(!kljuc) return {ok:false,error:'Obaveštenja još nisu podešena na serveru.'};
  let dozvola=pushDozvola();
  /* MORA iz klika. Chrome i Safari odbijaju `requestPermission()` koji nije
     pokrenut korisnikovim dodirom — zato se ova funkcija zove SAMO iz
     onclick, nikad iz pokretanja aplikacije. */
  if(dozvola==='default'){ try{ dozvola=await Notification.requestPermission(); }catch(e){ dozvola='denied'; } }
  if(dozvola!=='granted') return {ok:false,error:'Obaveštenja su odbijena. Uključi ih u podešavanjima pregledača za ovu stranicu, pa probaj ponovo.'};
  const reg=await swSpremna(4000);
  if(!reg||!reg.pushManager) return {ok:false,error:'Offline kopija se još pravi — probaj za koji trenutak.'};
  let sub=null;
  try{ sub=await reg.pushManager.getSubscription(); }catch(e){}
  if(sub&&!pushIstiKljuc(sub,kljuc)){ try{ await sub.unsubscribe(); }catch(e){} sub=null; }
  if(!sub){
    try{ sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:pushBajtovi(kljuc)}); }
    catch(e){ return {ok:false,error:'Pretplata nije uspela: '+((e&&e.message)||'nepoznata greška')}; }
  }
  const r=await pushPosalji('prijava',{pretplata:sub.toJSON(),uredjaj:SB.deviceId,najave:najaveZaNedelju()});
  if(!r.ok){
    /* Server nije primio pretplatu — ne ostavljaj je ni u pregledaču, inače
       Podešavanja pokazuju „uključeno" za nešto što ne može da stigne. */
    try{ await sub.unsubscribe(); }catch(e){}
    return r;
  }
  await idbObrisi('pretplata-neposlata');
  await pozadinskiNalog(kljuc);
  const povremeno=await periodicnaPrijava();
  S.ui.push=true; S.ui.najaveDan=TODAY; save();
  return {ok:true,povremeno};
}

/* Redosled je bitan: PRVO se pretplata poništi u pregledaču, pa se tek onda
   javlja serveru. Poništena pretplata push servis odbija sa 410, a server
   tada sam briše red — pa čak i ako javljanje ne prođe (odjava bez signala),
   obaveštenja prestaju da stižu. Obrnutim redosledom bi neuspelo poništavanje
   ostavilo uređaj koji i dalje prima poruke. */
async function pushIskljuci(token){
  const sub=await pushPretplataSada();
  let endpoint=null;
  if(sub){ endpoint=sub.endpoint; try{ await sub.unsubscribe(); }catch(e){} }
  if(endpoint) await pushPosalji('odjava',{endpoint},token);
  await idbObrisi('pretplata-neposlata');
  await periodicnaOdjava();
  /* Bez `save()` ako je odjava sa naloga u toku — tada je S već na putu da se
     zameni, a upis bi ga vratio. Zastavicu tada nosi sam odlazak sa naloga. */
  if(!token&&S&&S.ui){ S.ui.push=false; save(); }
  return {ok:true};
}

/* Stanje kartice „Obaveštenja". Čita se ASINHRONO (dozvola je sinhronna, ali
   pretplata i javni ključ nisu), pa dugmad postoje tek kad se zna šta smeju
   da urade — bolje nego dugme koje na dodir kaže „ne mogu". */
async function osveziObavestenja(){
  const red=$('#ob-red'), st=$('#ob-stanje');
  if(!red||!st) return;
  const doz=pushDozvola();
  if(doz==='denied'){
    red.innerHTML='';
    st.innerHTML='Obaveštenja su <b>odbijena</b> za ovu stranicu. Uključi ih u podešavanjima pregledača (ikonica pored adrese → Obaveštenja), pa se vrati ovde.';
    if(S.ui&&S.ui.push){ S.ui.push=false; save(); }
    return;
  }
  const kljuc=await pushVapid();
  if(!kljuc){
    red.innerHTML='';
    st.textContent='Obaveštenja još nisu podešena na serveru.';
    return;
  }
  const sub=await pushPretplataSada();
  const ukljucena=!!sub&&doz==='granted';
  /* Zapamćeno stanje se USKLAĐUJE sa stvarnim. Pretplata ume da nestane bez
     našeg znanja (brisanje podataka pregledača, reinstalacija) — bez ovoga bi
     u zaglavlju kartice zauvek pisalo „uključena". */
  if(!!(S.ui&&S.ui.push)!==ukljucena&&S.ui){ S.ui.push=ukljucena; save(); }

  red.innerHTML=ukljucena
    ? '<button class="btn ghost sm" id="ob-proba">Probno obaveštenje</button><button class="btn ghost sm" id="ob-off">Isključi</button>'
    : '<button class="btn" id="ob-on">Uključi obaveštenja</button>';
  st.textContent=ukljucena
    ? 'Uključena na ovom uređaju. Podsetnik stiže ujutru, osim na dane odmora.'
    : 'Isključena. Uključivanje traži dozvolu pregledača — jedan dodir.';

  const on=$('#ob-on');
  if(on) on.onclick=async e=>{
    const b=e.target; b.disabled=true; b.textContent='Uključujem…';
    const r=await pushUkljuci();
    if(r.ok){ osveziPodesavanja(); }
    else { b.disabled=false; b.textContent='Uključi obaveštenja'; alert(r.error||'Nije uspelo.'); }
  };
  const off=$('#ob-off');
  if(off) off.onclick=async e=>{
    const b=e.target; b.disabled=true; b.textContent='Isključujem…';
    await pushIskljuci();
    osveziPodesavanja();
  };
  const proba=$('#ob-proba');
  if(proba) proba.onclick=async e=>{
    const b=e.target; b.disabled=true; b.textContent='Šaljem…';
    const r=await pushPosalji('proba');
    b.textContent=r.ok?'Poslato ✓':'Nije uspelo';
    if(!r.ok) setTimeout(()=>alert(r.error||'Nije uspelo.'),100);
    setTimeout(()=>{ b.disabled=false; b.textContent='Probno obaveštenje'; },2000);
  };
}

/* Pri otvaranju aplikacije: pošalji ono što je service worker ostavio
   neposlato (v. `pushsubscriptionchange` u sw.js) i osveži najave za
   narednu nedelju. Oboje tiho — nijedno nije razlog za poruku na ekranu. */
async function pushOsvezi(){
  if(!pushPodrzan()||!sbAuthed()||!navigator.onLine) return;
  try{
    const cek=await idbCitaj('pretplata-neposlata');
    if(cek&&cek.pretplata){
      const r=await pushPosalji('prijava',{pretplata:cek.pretplata,uredjaj:cek.uredjaj||(SB&&SB.deviceId),najave:najaveZaNedelju()});
      if(r.ok){ await idbObrisi('pretplata-neposlata'); await pozadinskiNalog(); }
      return;
    }
  }catch(e){}
  if(pushDozvola()!=='granted') return;
  const sub=await pushPretplataSada();
  if(!sub) return;
  await pozadinskiNalog();
  /* Najave se šalju najviše jednom dnevno — sadrže istih osam dana bez obzira
     na to koliko puta se aplikacija otvori. */
  try{
    if(S.ui&&S.ui.najaveDan===TODAY) return;
    const r=await pushPosalji('najave',{najave:najaveZaNedelju()});
    if(r.ok){ S.ui.najaveDan=TODAY; save(); }
  }catch(e){}
}

/* SERVICE WORKER SE REGISTRUJE PRVI, PRE SVEGA OSTALOG.

   Ranije je ovaj blok stajao na DNU pokretanja — posle sbLoad, renderHeader,
   setPage, handleOAuthReturn, sbInit, tri sinhronizacije i prognoze. Dva
   problema, oba stvarna:

   1. KRHKOST. Da bilo koji od tih poziva jednom baci grešku, registracija se
      nikad ne bi izvršila — aplikacija bi tiho ostala bez offline režima i bez
      trake „Osveži", a greška bi izgledala kao nešto sasvim deseto. Ovde
      registracija ne zavisi ni od čega osim od samog pregledača.

   2. KASNI. Svaki od tih poziva pomera registraciju za koji milisekund.
      Alati koji sa strane proveravaju da li sajt ima service worker (PWABuilder,
      Lighthouse) gledaju kroz kratak prozor; kad registracija stigne posle
      njega, izveštaj kaže da service workera NEMA iako ga ima.

   `pratiAzuriranje` i `showUpdateBanner` su `function` deklaracije (dizane), a
   pozivaju se tek kad registracija odgovori — do tada je DOM odavno tu. */
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
  let refreshing=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(refreshing)return; refreshing=true; location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then(reg=>{
    pratiAzuriranje(reg);
    reg.update();
    /* Provera nove verzije na sat vremena.
       NE VRTI SE DOK JE APLIKACIJA U POZADINI. Instalirana PWA ume da stoji
       danima; budjenje na sat vremena tada samo troši bateriju, a `update()`
       nad uspavanom karticom ionako ne stiže dalje od reda čekanja. Umesto
       toga: kad se aplikacija vrati u prvi plan, proveri odmah — što je i
       trenutak u kom traka „Osveži" ima kome da se pokaže.
       Interval je jedan i pamti se, pa se ponovnim ulaskom ne umnožava. */
    let tajmer=null;
    const stani=()=>{ if(tajmer){ clearInterval(tajmer); tajmer=null; } };
    const kreni=()=>{ stani(); tajmer=setInterval(()=>{ reg.update(); pratiAzuriranje(reg); }, 60*60*1000); };
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible'){ reg.update(); pratiAzuriranje(reg); kreni(); }
      else stani();
    });
    if(document.visibilityState!=='hidden') kreni();
  }).catch(()=>{});
  /* Push koji je stigao dok je aplikacija OTVORENA ne izlazi kao obaveštenje
     nego kao poruka (v. `tiho` u sw.js). Za sada je to samo „analiza je
     gotova" — pokupi je odmah, bez čekanja da čovek promeni tab. */
  navigator.serviceWorker.addEventListener('message',ev=>{
    if(!ev.data||ev.data.type!=='PUSH') return;
    const p=ev.data.poruka||{};
    if(p.oznaka==='ai'&&typeof aiPokupiSve==='function') aiPokupiSve();
  });
}

/* SESIJA SE UCITAVA PRE PRVOG ISCRTAVANJA.
   Ranije je `sbLoad()` stajao ISPOD `setPage('danas')`, pa je Danas ekran prvi
   put crtan dok je SB jos bio prazan objekat: sbAuthed() -> false, dakle i
   jeVlasnik() -> false, pa se vlasniku prikazivala traka „Ovo nije tvoj plan".
   Posle toga se Danas vise nije iscrtavao, pa je traka ostajala do prve
   promene taba — svaki put pri otvaranju aplikacije.
   Isti problem je postojao i dok se vlasnik prepoznavao po mejlu (SB.email je
   bio jednako prazan), samo nije bio primecen. */
if(typeof sbLoad==='function')sbLoad();
uskladiVlasnickePodatke();   /* ciji su podaci — pre prvog iscrtavanja */
renderHeader();
setPage(pocetnaStrana());
prikaziUcitavanjePalo();     /* ako zapis nije procitan — pre nego sto covek pomisli da je sve nestalo */
handleOAuthReturn();
sbInit();
/* Automatsko povlačenje treninga. Uslov gleda izvor koji će STVARNO biti
   korišćen — ranije je stajalo samo `S.strava`, pa onaj ko ima intervals.icu
   a nema Stravu nikad ne bi dobio automatsku sinhronizaciju. */
if(navigator.onLine) trPovuciAko(3600000);
icuAutoSync();
aiPokupiSve();               /* v. „ANALIZA ODVOJENA OD CEKANJA" */
/* POSLE setPage: obaveštenje „analiza je gotova" nosi ./?dan=<id> i otvara
   list baš tog treninga. Bez ovoga klik vodi samo na početni ekran. */
otvoriIzAdrese();
pushOsvezi();                /* najave za narednu nedelju + pretplata koju SW nije stigao da javi */
/* Prognoza se osvežava na startu, ali samo ako je starija od tri sata (v.
   vremePovuci) — poziv je besplatan, ali nema razloga da se ponavlja pri
   svakom otvaranju. */
if(navigator.onLine&&S.ui&&S.ui.geo) vremePovuci(false).then(r=>{ if(r.ok&&!r.kes&&ACTIVE==='danas') renderDanas(); });

/* PRAĆENJE NOVOG SERVICE WORKER-a.
   Ranije je stajao samo `reg.addEventListener('updatefound', …)`, a taj događaj
   se javlja SAMO za nov SW pronađen POSLE vezivanja slušaoca. Pregledač sam
   proverava sw.js pri svakom otvaranju stranice — kad ga tada nađe i instalira
   pre nego što registracija odgovori, događaj je propušten i nov SW zauvek
   ostane u `reg.waiting`: traka „Osveži" se ne pojavi, stari keš se ne obriše,
   a offline i dalje radi stara verzija. (Online se to ne primeti, jer app.js
   ide network-first — pa broj verzije skoči, a traka izostane. Tačno taj
   spoj je i prijavljen.)
   Zato se sada gledaju SVA TRI stanja: već čeka, upravo se instalira, ili tek
   bude pronađen. */
function pratiAzuriranje(reg){
  if(!reg) return;
  const nudi=w=>{ if(w && navigator.serviceWorker.controller) showUpdateBanner(w); };
  const prati=w=>{
    if(!w) return;
    if(w.state==='installed'){ nudi(w); return; }
    w.addEventListener('statechange',()=>{ if(w.state==='installed') nudi(w); });
  };
  prati(reg.waiting);      /* nov SW je već instaliran i čeka — najčešći propušten slučaj */
  prati(reg.installing);   /* instalacija je u toku dok smo se registrovali */
  if(!reg.__pratimo){      /* slušalac se veže jednom, ne pri svakom update() */
    reg.__pratimo=1;
    reg.addEventListener('updatefound',()=>prati(reg.installing));
  }
}
/* ============================================================
   STANJE SERVICE WORKER-a — VIDLJIVO I RUČNO OSVEŽIVO

   Prijava: „app je na 175, a traka Osveži nije izašla."

   Broj u podnožju dolazi iz app.js, koji ide network-first — dakle skoči čim
   deploy prođe, i kad SW i keš još stoje na staroj verziji. Ta dva stanja su
   izgledala potpuno isto, pa se nije moglo znati da li je traka izostala ili
   nije ni bila potrebna. Sad se pita SAM SW koju verziju nosi, i nudi se dugme
   koje ne zavisi od toga da li se traka pojavila.

   Zašto uopšte može da izostane: traka se nudi samo kad nov SW ČEKA (`waiting`)
   — a on čeka samo ako ga stari drži zauzetim. Kad nov SW nema koga da prekine,
   aktivira se odmah i traka nema šta da ponudi; tada je sve već ažurno. Uz to
   Safari u instaliranoj PWA ne proverava sw.js pri svakom otvaranju kao
   Chrome, pa provera ume da kasni po nekoliko sati. */
async function swStanje(){
  const out={podrzan:false, aktivna:null, kes:null, ceka:false, kesevi:[]};
  if(!('serviceWorker' in navigator)) return out;
  out.podrzan=true;
  try{ out.kesevi=(await caches.keys()).filter(k=>/^sub19-cache-/.test(k)); }catch(e){}
  let reg=null;
  try{ reg=await navigator.serviceWorker.getRegistration(); }catch(e){}
  if(!reg) return out;
  out.ceka=!!reg.waiting;
  const sw=navigator.serviceWorker.controller;
  if(!sw) return out;
  /* Odgovor se čeka najviše 1,2 s — stariji SW ne zna za poruku VERSION i
     nikad neće odgovoriti, a Podešavanja ne smeju da vise zbog toga. */
  out.aktivna=await new Promise(res=>{
    let gotovo=false;
    const slusaj=ev=>{
      if(gotovo||!ev.data||ev.data.type!=='VERSION') return;
      gotovo=true; navigator.serviceWorker.removeEventListener('message',slusaj);
      out.kes=ev.data.cache||null; res(String(ev.data.version||''));
    };
    navigator.serviceWorker.addEventListener('message',slusaj);
    try{ sw.postMessage({type:'VERSION'}); }catch(e){}
    setTimeout(()=>{ if(!gotovo){ gotovo=true; navigator.serviceWorker.removeEventListener('message',slusaj); res(null); } },1200);
  });
  return out;
}
/* Ručno osvežavanje: radi i kad trake nema. Ako nov SW čeka — pusti ga; ako ne
   čeka — natera proveru pa proba ponovo; ako ni tad nema ništa, znači da si
   već na najnovijoj i to se kaže, umesto da dugme tiho ne uradi ništa. */
async function osveziAplikaciju(dugme){
  if(!('serviceWorker' in navigator)){ alert('Ovaj pregledač ne podržava offline režim.'); return; }
  const post=w=>{ try{ w.postMessage({type:'SKIP_WAITING'}); }catch(e){} };
  let reg=null;
  try{ reg=await navigator.serviceWorker.getRegistration(); }catch(e){}
  if(!reg){ location.reload(); return; }
  if(reg.waiting){ if(dugme) dugme.textContent='Osvežavam…'; post(reg.waiting); return; }
  if(dugme){ dugme.disabled=true; dugme.textContent='Proveravam…'; }
  try{ await reg.update(); }catch(e){}
  await new Promise(r=>setTimeout(r,1500));
  if(reg.waiting){ if(dugme) dugme.textContent='Osvežavam…'; post(reg.waiting); return; }
  if(reg.installing){
    if(dugme) dugme.textContent='Preuzimam…';
    reg.installing.addEventListener('statechange',function(){ if(this.state==='installed') post(this); });
    return;
  }
  const st=await swStanje();
  if(dugme){ dugme.disabled=false; dugme.textContent='Osveži aplikaciju'; }
  alert(st.aktivna && st.aktivna!==APP_VERSION
    ? 'Nova verzija još nije stigla do ovog uređaja. Pokušaj ponovo za koji minut.'
    : 'Već si na najnovijoj verziji ('+APP_VERSION+').');
}
function showUpdateBanner(worker){
  if($('#update-banner'))return;
  const b=document.createElement('div');
  b.id='update-banner';
  b.style.cssText='position:fixed;left:16px;right:16px;bottom:calc(env(safe-area-inset-bottom) + 84px);z-index:200;background:rgba(255,255,255,.15);-webkit-backdrop-filter:blur(20px) saturate(150%);backdrop-filter:blur(20px) saturate(150%);border:1px solid rgba(255,255,255,.3);color:var(--txt,#EEF0FF);border-radius:18px;padding:14px 16px;display:flex;align-items:center;gap:12px;font-weight:700;font-size:.9rem;box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 12px 30px rgba(0,0,0,.45)';
  b.innerHTML=`<span style="flex:1">Dostupna je nova verzija</span><button id="update-go" style="background:rgba(255,255,255,.94);color:var(--ink,#0B0A1F);border:0;border-radius:99px;padding:9px 18px;font-weight:800;font-size:.85rem">Osveži</button>`;
  document.body.appendChild(b);
  $('#update-go').onclick=()=>{
    b.querySelector('span').textContent='Osvežavam…';
    worker.postMessage({type:'SKIP_WAITING'});
  };
}
