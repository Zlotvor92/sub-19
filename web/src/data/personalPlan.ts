/* LIČNI (UGRAĐENI) PLAN VLASNIKA — Bokeški polumaraton 13.12.2026, plan od 1.11.2026: 6 nedelja (2.11–13.12), cilj 1:40:00 (4:44/km).
   Povratak posle 4 nedelje skoro bez trčanja (virus posle Niša), izgradnja, test cilja 29.11, taper. Tempo zone su iz HM 1:40:00
   (lagano/prag/tempo trke) i iz 5K 20:25 (intervali). Snaga A/B (ponedeljak/petak) je vlasnikova, preneta iz njegovih ručnih izmena.

   Nije podrazumevani plan aplikacije nego NEČIJI STVARNI plan: pokazuje se SAMO vlasniku (ili nalogu koji je već upisivao treninge na njega), v. `domain/personal`.
   ID-jevi dana su u „n" prostoru (generisani planovi su u „g") i nose nastavak „b" (n1d1b…): raniji plan (21.09–1.11, ID-jevi n1d1…n12d7) ima
   vlasnikove unose i ručne izmene (`alts`) vezane za ID dana — sa istim ID-jevima pregazile bi nove treninge. Polazna trka (Niš, 3.10) je pre
   početka ovog plana; njen planirani km i datum su u `PERSONAL` (`domain/personal`). */

import type { GenPlanState } from '../domain/state';

export const PERSONAL_START = '2026-11-02';
export const PERSONAL_RACE = '2026-12-13';

export const PERSONAL_WEEKS = [
  {
    w: 1,
    start: '2026-11-02',
    focus: 'Plan 1:40 · ned. 1 — Povratak · 28 km, samo lagano',
    days: [
      {
        id: 'n1d1b',
        dow: 0,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu, bez pliometrije · ~40 min\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 3×10 · 1× zvono 8 kg\n• Bugarski čučanj: 2×8/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 2×8/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 3×10/noga · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 2×12 · Zvono 8 kg\n• Mrtva buba: 2×8/strana'
      },
      {
        id: 'n1d2b',
        dow: 1,
        tag: 'lako',
        km: 6,
        desc: 'Lako trčanje 6 km · puls ≤150, razgovorno · na kraju 4×100 m ubrzanja (hod ili lagani džog nazad)'
      },
      {
        id: 'n1d3b',
        dow: 2,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — cevanice, stopalo, kuk · ~25 min, lagano, bez umora za sutrašnje trčanje\n• Podizanje prstiju uz zid (tibialis): 2×15\n• Dorsifleksija sa trakom: 2×12/noga · Traka\n• Inverzija i everzija sa trakom: 2×12 svaka · Traka\n• Podizanje na prste, pravo koleno: 3×15 obe noge · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 3×12/noga · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×20 m\n• Odvođenje kuka stojeći: 2×12/noga · Traka\n• Pallof pritisak: 2×8/strana · Traka\n• Bočna plank: 2×20 s'
      },
      {
        id: 'n1d4b',
        dow: 3,
        tag: 'lako',
        km: 7,
        desc: 'Lako trčanje 7 km · puls ≤150, razgovorno · na kraju 6×100 m ubrzanja (hod ili lagani džog nazad)'
      },
      {
        id: 'n1d5b',
        dow: 4,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n1d6b',
        dow: 5,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · puls ≤150, razgovorno'
      },
      {
        id: 'n1d7b',
        dow: 6,
        tag: 'lr',
        km: 10,
        desc: 'Dugo trčanje 10 km · puls ≤150, razgovorno'
      }
    ]
  },
  {
    w: 2,
    start: '2026-11-09',
    focus: 'Plan 1:40 · ned. 2 — Izgradnja · 37 km, prvi prag',
    days: [
      {
        id: 'n2d1b',
        dow: 0,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu, bez pliometrije · ~40 min\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 3×10 · 1× zvono 8 kg\n• Bugarski čučanj: 2×8/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 2×8/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 3×10/noga · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 2×12 · Zvono 8 kg\n• Mrtva buba: 2×8/strana'
      },
      {
        id: 'n2d2b',
        dow: 1,
        tag: 'tempo',
        km: 9.1,
        desc: 'Tempo — 2 km zagrevanje + 3×1600 m @ 4:40/km (400 m lagano između) + 1,5 km hlađenje · prag, 6–7/10; ne brže od 4:33'
      },
      {
        id: 'n2d3b',
        dow: 2,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · puls ≤150, razgovorno'
      },
      {
        id: 'n2d4b',
        dow: 3,
        tag: 'lako',
        km: 6,
        desc: 'Lako trčanje 6 km · puls ≤150, razgovorno · na kraju 6×100 m ubrzanja (hod ili lagani džog nazad)'
      },
      {
        id: 'n2d5b',
        dow: 4,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — cevanice, stopalo, kuk · ~25 min, lagano, bez umora pred vikend\n• Podizanje prstiju uz zid (tibialis): 2×15\n• Dorsifleksija sa trakom: 2×12/noga · Traka\n• Inverzija i everzija sa trakom: 2×12 svaka · Traka\n• Podizanje na prste, pravo koleno: 3×15 obe noge · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 3×12/noga · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×20 m\n• Odvođenje kuka stojeći: 2×12/noga · Traka\n• Pallof pritisak: 2×8/strana · Traka\n• Bočna plank: 2×20 s'
      },
      {
        id: 'n2d6b',
        dow: 5,
        tag: 'lako',
        km: 4,
        desc: 'Lako trčanje 4 km · puls ≤150, razgovorno'
      },
      {
        id: 'n2d7b',
        dow: 6,
        tag: 'lr',
        km: 13,
        desc: 'Dugo trčanje 13 km · puls ≤150, razgovorno'
      }
    ]
  },
  {
    w: 3,
    start: '2026-11-16',
    focus: 'Plan 1:40 · ned. 3 — Izgradnja · 43 km, intervali + prag',
    days: [
      {
        id: 'n3d1b',
        dow: 0,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu, bez pliometrije · ~40 min\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 3×10 · 1× zvono 8 kg\n• Bugarski čučanj: 2×8/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 2×8/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 3×10/noga · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 2×12 · Zvono 8 kg\n• Mrtva buba: 2×8/strana'
      },
      {
        id: 'n3d2b',
        dow: 1,
        tag: 'int',
        km: 10.6,
        desc: 'Intervali — 2 km zagrevanje + 5×1000 m @ 4:08/km (400 m lagano između) + 2 km hlađenje · 8–9/10; ujednačeno, poslednji ne brži od prvog'
      },
      {
        id: 'n3d3b',
        dow: 2,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · puls ≤150, razgovorno'
      },
      {
        id: 'n3d4b',
        dow: 3,
        tag: 'tempo',
        km: 9,
        desc: 'Tempo — 2 km zagrevanje + 2×2500 m @ 4:38/km (500 m lagano između) + 1,5 km hlađenje · prag, 6–7/10'
      },
      {
        id: 'n3d5b',
        dow: 4,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — cevanice, stopalo, kuk · ~25 min, lagano, bez umora pred vikend\n• Podizanje prstiju uz zid (tibialis): 2×15\n• Dorsifleksija sa trakom: 2×12/noga · Traka\n• Inverzija i everzija sa trakom: 2×12 svaka · Traka\n• Podizanje na prste, pravo koleno: 3×15 obe noge · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 3×12/noga · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×20 m\n• Odvođenje kuka stojeći: 2×12/noga · Traka\n• Pallof pritisak: 2×8/strana · Traka\n• Bočna plank: 2×20 s'
      },
      {
        id: 'n3d6b',
        dow: 5,
        tag: 'lako',
        km: 4,
        desc: 'Lako trčanje 4 km · puls ≤150, razgovorno'
      },
      {
        id: 'n3d7b',
        dow: 6,
        tag: 'lr',
        km: 14,
        desc: 'Dugo trčanje 14 km · puls ≤150, razgovorno'
      }
    ]
  },
  {
    w: 4,
    start: '2026-11-23',
    focus: 'Plan 1:40 · ned. 4 — Vrh obima · 44 km, test cilja',
    days: [
      {
        id: 'n4d1b',
        dow: 0,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu, bez pliometrije · ~40 min\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 3×10 · 1× zvono 8 kg\n• Bugarski čučanj: 2×8/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 2×8/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 3×10/noga · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 2×12 · Zvono 8 kg\n• Mrtva buba: 2×8/strana'
      },
      {
        id: 'n4d2b',
        dow: 1,
        tag: 'tempo',
        km: 12,
        desc: 'Tempo — 2 km zagrevanje + 3×2500 m @ 4:36/km (500 m lagano između) + 1,5 km hlađenje · prag, 6–7/10'
      },
      {
        id: 'n4d3b',
        dow: 2,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · puls ≤150, razgovorno'
      },
      {
        id: 'n4d4b',
        dow: 3,
        tag: 'lako',
        km: 6,
        desc: 'Lako trčanje 6 km · puls ≤150, razgovorno · na kraju 6×100 m ubrzanja (hod ili lagani džog nazad)'
      },
      {
        id: 'n4d5b',
        dow: 4,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — cevanice, stopalo, kuk · ~25 min, lagano, bez umora pred vikend\n• Podizanje prstiju uz zid (tibialis): 2×15\n• Dorsifleksija sa trakom: 2×12/noga · Traka\n• Inverzija i everzija sa trakom: 2×12 svaka · Traka\n• Podizanje na prste, pravo koleno: 3×15 obe noge · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 3×12/noga · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×20 m\n• Odvođenje kuka stojeći: 2×12/noga · Traka\n• Pallof pritisak: 2×8/strana · Traka\n• Bočna plank: 2×20 s'
      },
      {
        id: 'n4d6b',
        dow: 5,
        tag: 'lako',
        km: 4,
        desc: 'Lako trčanje 4 km · puls ≤150, razgovorno'
      },
      {
        id: 'n4d7b',
        dow: 6,
        tag: 'lr',
        km: 17,
        desc: 'Dugo sa tempom trke — 4 km zagrevanje + 2×4000 m @ 4:44/km (1 km lagano između) + 4 km hlađenje · TEST CILJA; proba gela pre prvog bloka. Prosečan puls drugog bloka: ≤~165 i lako → cilj 1:39–1:40; 166–172 → 1:40, start 4:46; ne drži 4:44 ili >172 → cilj 1:41:30 (4:49) u nedeljama 5–6'
      }
    ]
  },
  {
    w: 5,
    start: '2026-11-30',
    focus: 'Plan 1:40 · ned. 5 — Taper 1 · 35 km',
    days: [
      {
        id: 'n5d1b',
        dow: 0,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu, bez pliometrije · ~40 min\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 2×10 · 1× zvono 8 kg\n• Bugarski čučanj: 2×8/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 2×8/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 2×10/noga · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 2×12 · Zvono 8 kg\n• Mrtva buba: 2×8/strana\nNapomena: Taper — lagano, bez rada do otkaza.'
      },
      {
        id: 'n5d2b',
        dow: 1,
        tag: 'int',
        km: 10.8,
        desc: 'Intervali — 2 km zagrevanje + 6×800 m @ 4:05/km (400 m lagano između) + 2 km hlađenje · 8–9/10; taper: obim dole, intenzitet ostaje'
      },
      {
        id: 'n5d3b',
        dow: 2,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · puls ≤150, razgovorno'
      },
      {
        id: 'n5d4b',
        dow: 3,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · puls ≤150, razgovorno · na kraju 6×100 m ubrzanja (hod ili lagani džog nazad)'
      },
      {
        id: 'n5d5b',
        dow: 4,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n5d6b',
        dow: 5,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n5d7b',
        dow: 6,
        tag: 'lr',
        km: 14,
        desc: 'Dugo sa tempom trke — 9 km zagrevanje + 4 km @ 4:44/km (ili 4:49 ako je test 29.11. tako odredio) + 1 km hlađenje · ponovi gel kao na trci'
      }
    ]
  },
  {
    w: 6,
    start: '2026-12-07',
    focus: 'Plan 1:40 · ned. 6 — Taper 2 · trka',
    days: [
      {
        id: 'n6d1b',
        dow: 0,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n6d2b',
        dow: 1,
        tag: 'tempo',
        km: 8.6,
        desc: 'Tempo trke — 2 km zagrevanje + 3×1600 m @ 4:44/km (400 m lagano između) + 1 km hlađenje · podsetnik na ritam, ne test; tempo po odluci od 29.11.'
      },
      {
        id: 'n6d3b',
        dow: 2,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n6d4b',
        dow: 3,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · puls ≤150, razgovorno · na kraju 4×100 m ubrzanja (hod ili lagani džog nazad)'
      },
      {
        id: 'n6d5b',
        dow: 4,
        rest: true,
        desc: 'Odmor · putovanje'
      },
      {
        id: 'n6d6b',
        dow: 5,
        tag: 'lako',
        km: 3,
        desc: 'Lako trčanje 3 km · puls ≤150, razgovorno · na kraju 3×100 m ubrzanja; po mogućstvu na delu staze'
      },
      {
        id: 'n6d7b',
        dow: 6,
        tag: 'trka',
        km: 21.1,
        desc: '🏁 BOKEŠKI POLUMARATON — cilj 1:40:00 · ritam 4:44/km · Start 09:00; km 1–5 na 4:46–4:48, km 6–16 na 4:43–4:45, od 17. km po osećaju; na usponu drži napor, ne tempo · gel oko 40.–50. minuta'
      }
    ]
  }
] as unknown as GenPlanState['weeks'];

/** Redovi predikcije (referentna kriva i tempo radnog dela po nedelji). `p5k` je 5K-ekvivalent cilja (1:40:00 → 6000 s na 21,1 km). */
export const PERSONAL_PRED = [
  {
    id: 'p26',
    w: 2,
    l: 'N2 · Tempo',
    q: 4.8,
    pt: 280,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p27',
    w: 3,
    l: 'N3 · Intervali',
    q: 5,
    pt: 248,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p28',
    w: 3,
    l: 'N3 · Tempo',
    q: 5,
    pt: 278,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p29',
    w: 4,
    l: 'N4 · Tempo',
    q: 7.5,
    pt: 276,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p30',
    w: 5,
    l: 'N5 · Intervali',
    q: 4.8,
    pt: 245,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p31',
    w: 6,
    l: 'N6 · Tempo trke',
    q: 4.8,
    pt: 284,
    p5k: 6000,
    nemeri: true
  }
] as unknown as GenPlanState['pred'];

/** Rep-distance (m) po kvalitetnim danima, za detekciju radnih krugova sa Strave. */
export const PERSONAL_QS: Record<string, number[]> = {
  n2d2b: [1600],
  n3d2b: [1000],
  n3d4b: [2500],
  n4d2b: [2500],
  n5d2b: [800],
  n6d2b: [1600]
};
