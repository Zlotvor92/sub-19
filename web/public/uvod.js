'use strict';

/* KOPIJA bloka `uvodniEkran` iz starog app.js (test `uvod.oracle.test.ts` drži da se telo funkcije ne razilazi). „Ovaj fajl" u komentaru ispod je paket
   aplikacije: uvod mora da počne čim se HTML isparsira, a React paket stiže tek kasnije — zato je odluka u ovom sićušnom spoljnom skriptu (CSP ne dozvoljava
   inline), kao što je registracija service workera u `sw-reg.js`. */
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
