/* ZAJEDNICA — ŠTA IZLAZI IZ NALOGA

   Do Zajednice ništa u ovoj aplikaciji nije bilo vidljivo drugim ljudima.
   Zato ovde ne testiramo „da li lista lepo izgleda" nego jednu jedinu stvar:

     IZLAZI LI IŠTA OSIM ONOGA ŠTO SMO OBEĆALI, I IZLAZI LI IKOME KO TO NIJE
     SAM UKLJUČIO.

   Zamka koja to čuva je test „ne izlazi ništa osim dozvoljenog": u stanje se
   UBACE svi osetljivi podaci koje aplikacija zna — HRV, puls u miru, san,
   težina, bolovi, beleške sa treninga, e-adresa — pa se tvrdi da se izlazni
   objekat NIJE PROMENIO. Zato pada i onda kad neko doda polje ne razmišljajući
   o tome šta ono povlači.

   Provereno da može da padne: kad se `zajednicaPayload` napiše preko
   `Object.assign({}, S)` — što je najverovatniji način da se ovo pokvari —
   test pada na prvom polju. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readRepoFile } from './repo.mjs';

const DANAS = '2026-11-04T09:00:00Z';

/* Prijavljen korisnik sa Google slikom i imenom. Bez ovoga `zajednicaPayload`
   nema ni `user_id`, pa bi svaka tvrdnja merila prazan objekat. */
function prijavljen(a) {
  a.evalIn(`SB.userId='u-1'; SB.access='tok'; SB.refresh='ref'; SB.email='ja@primer.com';
            /* Token MORA da važi. Sa expiresAt=0 sbEnsure() odbija svaki poziv
               pre nego što se išta testira — a onda „server je odbio" i „nema
               tokena" izgledaju isto, pa zamka ne može da padne. */
            SB.expiresAt=Date.now()+3600000;
            SB.slika='https://lh3.googleusercontent.com/a/slika';
            SB.ime='Marko Marković';`);
}

/* Stanje sa svim osetljivim podacima koje aplikacija ume da zabeleži. */
function osetljivo(a) {
  a.evalIn(`
    S.wellness={'2026-11-04':{hrv:78,rhr:44,sleep:7.5,load:210}};
    S.kg=[{date:'2026-11-03', kg:71.4}];
    S.knee=[{date:'2026-11-03', v:6, part:'ahilova'}];
    const _prvi=DATED.find(d=>!d.rest);
    if(_prvi){ S.log[_prvi.id]={status:'done', km:10, sec:3000,
      note:'kolena me ubijaju, ne valja mi san', hr:162, feel:2}; }
    S.ai={'2026-11-03':{tekst:'AI analiza: opterećenje previsoko'}};
  `);
}


describe('Politika privatnosti prati kod', () => {

  test('svako polje koje izlazi je pomenuto u privacy.html', () => {
    /* Politika je jedino mesto gde čovek može da pročita šta deli. Kad kod
       doda polje a politika ne, obećanje postaje netačno — a to niko ne vidi. */
    const p = readRepoFile('privacy.html');
    const parovi = [
      ['nadimak', /nadimak/i], ['avatar_url', /slik/i], ['cilj', /ciljn/i],
      ['trka_datum', /datum trke/i], ['nedelja_br', /nedelja plana/i],
      ['vdot', /VDOT/], ['test3k_sec', /3 km/], ['km_nedelja', /kilometraž/i],
      ['plan_pct', /doslednost/i], ['niz_dana', /niz dana/i],
      ['izazov_ura', /izazov/i], ['znacke', /znač/i], ['trcanja', /trčanja/i]
    ];
    for (const [polje, re] of parovi) {
      assert.match(p, re, `politika ne pominje ono što se šalje kao ${polje}`);
    }
  });

  test('politika izričito nabraja šta NIKAD ne izlazi', () => {
    const p = readRepoFile('privacy.html');
    for (const re of [/HRV/, /puls u miru/i, /san\b/i, /težin/i, /mapa bolova/i,
                      /beleške sa treninga/i, /AI analiz/i, /e-adres/i]) {
      assert.match(p, re, `politika ne kaže da ${re} ostaje u nalogu`);
    }
  });
});

/* ============================================================
   EKRAN

   Podaci na ovom ekranu dolaze OD DRUGIH LJUDI. To je jedino mesto u
   aplikaciji gde je tako, pa se ovde testira i ono što se inače ne bi:
   da tuđ nadimak ne može da postane HTML.
   ============================================================ */

/* Spisak kakav stiže sa servera. Namerno neuredan: neko bez testa, neko bez
   početnog VDOT-a — takvi redovi postoje čim neko uključi profil prvog dana. */
function spisak(a, dodatno = []) {
  const ljudi = [
    { user_id:'u-1', nadimak:'Ana',  cilj:'10K', vdot:47.1, vdot_pocetni:44.0, test3k_sec:724,
      km_nedelja:31.0, plan_pct:89, niz_dana:5, izazov_od:5, izazov_ura:4,
      nedelja_br:4, nedelja_od:12, trka_datum:'2026-10-12', znacke:['Test na 3 km'],
      trcanja:[{d:'2026-08-06',t:'Tempo',o:'12 km',p:'4:41 /km'}] },
    { user_id:'u-2', nadimak:'Boban', cilj:'5K', vdot:51.3, vdot_pocetni:48.1, test3k_sec:678,
      km_nedelja:42.1, plan_pct:98, niz_dana:12, izazov_od:5, izazov_ura:5,
      nedelja_br:8, nedelja_od:14, trka_datum:'2026-09-24', znacke:[], trcanja:[] },
    { user_id:'u-3', nadimak:'Cana', cilj:'5K', vdot:41.2, vdot_pocetni:36.8, test3k_sec:null,
      km_nedelja:22.5, plan_pct:76, niz_dana:3, izazov_od:4, izazov_ura:3,
      nedelja_br:2, nedelja_od:10, trka_datum:'2026-11-02', znacke:[], trcanja:[] }
  ].concat(dodatno);
  a.evalIn(`S.zajed.vidljiv=true; ZAJ.ljudi=${JSON.stringify(ljudi)}; ZAJ.kad=Date.now();
            ZAJ.izazov='Odradi sve treninge po planu ove nedelje.';`);
  return ljudi;
}
const ekran = a => a.evalIn(`$('#pg-zajed').innerHTML`) || '';
