/* REGISTRACIJA SERVICE WORKER-a — odvojena od app.js, i namerno sićušna.

   ZAŠTO POSTOJI KAO ZASEBAN FAJL
   Registracija je ranije stajala u app.js. Taj fajl je 611 KB (≈220 KB
   sažeto), pa se service worker nije registrovao dok se ceo ne skine i izvrši.
   Mereno, od početka učitavanja do registracije:

       brza veza    51 ms
       4G         1373 ms
       3G         3377 ms

   Tri i po sekunde bez service workera na svakom otvaranju preko mobilnog
   interneta. Za to vreme ne postoji ni offline režim ni provera nove verzije,
   a alati koji sa strane proveravaju sajt (PWABuilder, Lighthouse) gledaju
   kroz kraći prozor od toga — pa prijave da service workera NEMA iako ga ima.

   Ovaj fajl je par stotina bajta i učitava se iz <head>, pre svega ostalog.

   ŠTA OVDE NIJE
   Praćenje nove verzije i traka „Osveži" ostaju u app.js — za njih treba i
   DOM i ostatak aplikacije. `register()` je idempotentan: drugi poziv sa istom
   adresom vraća ISTU registraciju, ne pravi drugu. Zato oba mesta smeju da ga
   pozovu, a app.js i dalje dobija svoj `reg` da na njega zakači praćenje. */
(function () {
  if (!('serviceWorker' in navigator)) return;
  /* Isti uslov kao u app.js: service worker radi samo na https ili localhost.
     Bez ove provere bi otvaranje fajla sa diska (file://) bacalo grešku u
     konzolu pri svakom učitavanju. */
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  navigator.serviceWorker.register('./sw.js').catch(function () {
    /* Neuspeh nije razlog za bilo kakvu poruku: aplikacija radi i bez service
       workera, samo bez offline režima. app.js ionako pokušava ponovo. */
  });
})();
