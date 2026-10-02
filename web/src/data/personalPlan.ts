/* LIČNI (UGRAĐENI) PLAN VLASNIKA — izvor: Plan_Bokeski_polumaraton.xlsx. GENERISANO iz starog `app.js` (PLAN, PRED, QS) skriptom koja se ne čuva; tačnost drži oracle test
   `src/data/personalPlan.oracle.test.ts` (duboka jednakost sa starim konstantama) dok stari kod postoji, a posle njega snimak.

   Nije podrazumevani plan aplikacije nego NEČIJI STVARNI plan: pokazuje se SAMO vlasniku (ili nalogu koji je već upisivao treninge na njega), v. `domain/personal`.
   Excel nedelje počinju u petak 25.09 (ned. 0 ima 10 dana), a aplikacija radi u nedeljama od ponedeljka — zato je Excel ned. 0 ovde N1+N2, a Excel ned. k je N(k+2).
   Datum trke je 13.12 (nedelja), ne 12.12 kako stoji u Excel-u (vlasnik je proverio kod organizatora). ID-jevi dana su u „n" prostoru (generisani planovi su u „g"). */

import type { GenPlanState } from '../domain/state';

export const PERSONAL_START = '2026-09-21';
export const PERSONAL_RACE = '2026-12-13';

export const PERSONAL_WEEKS = [
  {
    w: 1,
    start: '2026-09-21',
    focus: 'Plan ned. 0 (1/2) — oporavak posle trke 5 km',
    days: [
      {
        id: 'n1d5',
        dow: 4,
        rest: true,
        desc: 'Odmor · Dan posle trke 5 km'
      },
      {
        id: 'n1d6',
        dow: 5,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n1d7',
        dow: 6,
        tag: 'lr',
        km: 11,
        desc: 'Lako trčanje 10–12 km · po osećaju (razgovorni) · Samo ako test cevanica prođe'
      }
    ]
  },
  {
    w: 2,
    start: '2026-09-28',
    focus: 'Plan ned. 0 (2/2) — Niš polumaraton LAGANO, ne trka',
    days: [
      {
        id: 'n2d1',
        dow: 0,
        tag: 'lako',
        km: 6,
        desc: 'Lako trčanje 6 km · po osećaju (razgovorni)'
      },
      {
        id: 'n2d2',
        dow: 1,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — lagano, 2 serije · ~25 min, lagano, bez umora pred sredu\n• Podizanje prstiju uz zid (tibialis): 2×15\n• Dorsifleksija sa trakom: 2×12/noga · Traka\n• Inverzija i everzija sa trakom: 2×12 svaka · Traka\n• Podizanje na prste, pravo koleno: 3×15 obe noge · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 3×12/noga · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×20 m\n• Odvođenje kuka stojeći: 2×12/noga · Traka\n• Pallof pritisak: 2×8/strana · Traka\n• Bočna plank: 2×20 s\nNapomena: Bez pliometrije'
      },
      {
        id: 'n2d3',
        dow: 2,
        tag: 'lako',
        km: 7,
        desc: 'Lako trčanje 7 km · po osećaju (razgovorni)'
      },
      {
        id: 'n2d4',
        dow: 3,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — lagano, 2 serije · ~25 min, lagano, bez umora pred sredu\n• Podizanje prstiju uz zid (tibialis): 2×15\n• Dorsifleksija sa trakom: 2×12/noga · Traka\n• Inverzija i everzija sa trakom: 2×12 svaka · Traka\n• Podizanje na prste, pravo koleno: 3×15 obe noge · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 3×12/noga · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×20 m\n• Odvođenje kuka stojeći: 2×12/noga · Traka\n• Pallof pritisak: 2×8/strana · Traka\n• Bočna plank: 2×20 s\nNapomena: 2 dana pred Niš: bez težine'
      },
      {
        id: 'n2d5',
        dow: 4,
        tag: 'lako',
        km: 3,
        desc: 'Shakeout 3 km · po osećaju (razgovorni) · Bez ubrzanja'
      },
      {
        id: 'n2d6',
        dow: 5,
        tag: 'lr',
        km: 21.1,
        desc: 'Niš polumaraton — LAGANO, ne trka · po osećaju (razgovorni) · Ne juriš vreme. Bol u cevanici raste → staješ/hodaš'
      },
      {
        id: 'n2d7',
        dow: 6,
        rest: true,
        desc: 'Odmor'
      }
    ]
  },
  {
    w: 3,
    start: '2026-10-05',
    focus: 'Plan ned. 1 — povratak posle polumaratona, bez pliometrije',
    days: [
      {
        id: 'n3d1',
        dow: 0,
        rest: true,
        desc: 'Odmor · 2 dana posle polumaratona; šetnja 30 min je u redu'
      },
      {
        id: 'n3d2',
        dow: 1,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — cevanice, stopalo, kuk · ~25 min, lagano, bez umora pred sredu\n• Podizanje prstiju uz zid (tibialis): 2×15\n• Dorsifleksija sa trakom: 2×12/noga · Traka\n• Inverzija i everzija sa trakom: 2×12 svaka · Traka\n• Podizanje na prste, pravo koleno: 3×15 obe noge · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 3×12/noga · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×20 m\n• Odvođenje kuka stojeći: 2×12/noga · Traka\n• Pallof pritisak: 2×8/strana · Traka\n• Bočna plank: 2×20 s'
      },
      {
        id: 'n3d3',
        dow: 2,
        tag: 'lako',
        km: 6,
        desc: 'Lako trčanje 6 km · po osećaju (razgovorni)'
      },
      {
        id: 'n3d4',
        dow: 3,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu + bez pliometrije · ~40 min, pliometrija prva (sveže noge)\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 3×10 · 1× zvono 8 kg\n• Bugarski čučanj: 2×8/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 2×8/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 3×10/noga · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 2×12 · Zvono 8 kg\n• Mrtva buba: 2×8/strana'
      },
      {
        id: 'n3d5',
        dow: 4,
        tag: 'lako',
        km: 6,
        desc: 'Lako trčanje 6 km · po osećaju (razgovorni)'
      },
      {
        id: 'n3d6',
        dow: 5,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n3d7',
        dow: 6,
        tag: 'lr',
        km: 12,
        desc: 'Dugo trčanje 12 km · po osećaju (razgovorni)'
      }
    ]
  },
  {
    w: 4,
    start: '2026-10-12',
    focus: 'Plan ned. 2 — prvi ključni: deonice tempom trke',
    days: [
      {
        id: 'n4d1',
        dow: 0,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · po osećaju (razgovorni)'
      },
      {
        id: 'n4d2',
        dow: 1,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — cevanice, stopalo, kuk · ~25 min, lagano, bez umora pred sredu\n• Podizanje prstiju uz zid (tibialis): 2×15\n• Dorsifleksija sa trakom: 2×12/noga · Traka\n• Inverzija i everzija sa trakom: 2×12 svaka · Traka\n• Podizanje na prste, pravo koleno: 3×15 obe noge · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 3×12/noga · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×20 m\n• Odvođenje kuka stojeći: 2×12/noga · Traka\n• Pallof pritisak: 2×8/strana · Traka\n• Bočna plank: 2×20 s'
      },
      {
        id: 'n4d3',
        dow: 2,
        tag: 'tempo',
        km: 10.5,
        desc: 'Ključni (tempo trke) — 2 km WU + 3×2000 m @ 4:40–4:45/km (90 s lagani džog) + 2 km CD · samo ako test cevanica prođe; ako ne prođe — lako, a nedelja se ponavlja'
      },
      {
        id: 'n4d4',
        dow: 3,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu + bez pliometrije · ~40 min, pliometrija prva (sveže noge)\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 3×10 · 1× zvono 8 kg\n• Bugarski čučanj: 2×8/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 2×8/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 3×10/noga · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 2×12 · Zvono 8 kg\n• Mrtva buba: 2×8/strana'
      },
      {
        id: 'n4d5',
        dow: 4,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · po osećaju (razgovorni)'
      },
      {
        id: 'n4d6',
        dow: 5,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n4d7',
        dow: 6,
        tag: 'lr',
        km: 13,
        desc: 'Dugo trčanje 13 km · po osećaju (razgovorni)'
      }
    ]
  },
  {
    w: 5,
    start: '2026-10-19',
    focus: 'Plan ned. 3 — pliometrija nivo 1 (samo ako test cevanica prođe)',
    days: [
      {
        id: 'n5d1',
        dow: 0,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · po osećaju (razgovorni)'
      },
      {
        id: 'n5d2',
        dow: 1,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — cevanice, stopalo, kuk · ~25 min, lagano, bez umora pred sredu\n• Podizanje prstiju uz zid (tibialis): 3×15\n• Dorsifleksija sa trakom: 3×12/noga · Traka\n• Inverzija i everzija sa trakom: 2×15 svaka · Traka\n• Podizanje na prste, pravo koleno: 3×12 jedna noga · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 3×15/noga · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×20 m\n• Odvođenje kuka stojeći: 3×12/noga · Traka\n• Pallof pritisak: 3×10/strana · Traka\n• Bočna plank: 2×30 s'
      },
      {
        id: 'n5d3',
        dow: 2,
        tag: 'tempo',
        km: 13.5,
        desc: 'Ključni (tempo trke) — 2 km WU + 3×3000 m @ 4:40–4:45/km (2 min džog) + 2 km CD · samo ako test cevanica prođe; ako ne prođe — lako, a nedelja se ponavlja'
      },
      {
        id: 'n5d4',
        dow: 3,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu + pliometrija nivo 1 · ~40 min, pliometrija prva (sveže noge)\nPLIOMETRIJA — samo ako test cevanica prođe:\n• Pogo skokovi snožno: Nivo 1: 3×15\n• A-skip: 2×20 m\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 3×12 · 1× zvono 8 kg\n• Bugarski čučanj: 3×8/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 3×8/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 3×12/noga · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 3×12 · Zvono 8 kg\n• Mrtva buba: 3×10/strana\nNapomena: Pliometrija SAMO ako test cevanica prođe'
      },
      {
        id: 'n5d5',
        dow: 4,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · po osećaju (razgovorni)'
      },
      {
        id: 'n5d6',
        dow: 5,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n5d7',
        dow: 6,
        tag: 'lr',
        km: 15,
        desc: 'Dugo trčanje 15 km · po osećaju (razgovorni)'
      }
    ]
  },
  {
    w: 6,
    start: '2026-10-26',
    deload: true,
    focus: 'Plan ned. 4 — LAKŠA nedelja',
    days: [
      {
        id: 'n6d1',
        dow: 0,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · po osećaju (razgovorni)'
      },
      {
        id: 'n6d2',
        dow: 1,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — LAKŠA nedelja: 1 serija manje · ~25 min, lagano, bez umora pred sredu\n• Podizanje prstiju uz zid (tibialis): 3×15\n• Dorsifleksija sa trakom: 3×12/noga · Traka\n• Inverzija i everzija sa trakom: 2×15 svaka · Traka\n• Podizanje na prste, pravo koleno: 3×12 jedna noga · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 3×15/noga · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×20 m\n• Odvođenje kuka stojeći: 3×12/noga · Traka\n• Pallof pritisak: 3×10/strana · Traka\n• Bočna plank: 2×30 s'
      },
      {
        id: 'n6d3',
        dow: 2,
        tag: 'int',
        km: 10,
        desc: 'Ključni (intervali) — 2 km WU + 5×1000 m @ 4:15/km (90 s džog) + 2 km CD · samo ako test cevanica prođe; ako ne prođe — lako, a nedelja se ponavlja · Lakša nedelja'
      },
      {
        id: 'n6d4',
        dow: 3,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu + pliometrija nivo 1 (lakša nedelja) · ~40 min, pliometrija prva (sveže noge)\nPLIOMETRIJA — samo ako test cevanica prođe:\n• Pogo skokovi snožno: Nivo 1: 3×15\n• A-skip: 2×20 m\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 3×12 · 1× zvono 8 kg\n• Bugarski čučanj: 3×8/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 3×8/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 3×12/noga · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 3×12 · Zvono 8 kg\n• Mrtva buba: 3×10/strana\nNapomena: Pliometrija SAMO ako test cevanica prođe'
      },
      {
        id: 'n6d5',
        dow: 4,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · po osećaju (razgovorni)'
      },
      {
        id: 'n6d6',
        dow: 5,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n6d7',
        dow: 6,
        tag: 'lr',
        km: 12,
        desc: 'Dugo trčanje 12 km · po osećaju (razgovorni) · Lakša nedelja'
      }
    ]
  },
  {
    w: 7,
    start: '2026-11-02',
    focus: 'Plan ned. 5 — 2×5 km tempom trke, pliometrija nivo 2',
    days: [
      {
        id: 'n7d1',
        dow: 0,
        tag: 'lako',
        km: 6,
        desc: 'Lako trčanje 6 km · po osećaju (razgovorni)'
      },
      {
        id: 'n7d2',
        dow: 1,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — cevanice, stopalo, kuk · ~25 min, lagano, bez umora pred sredu\n• Podizanje prstiju uz zid (tibialis): 3×20\n• Dorsifleksija sa trakom: 3×15/noga · Traka\n• Inverzija i everzija sa trakom: 3×15 svaka · Traka\n• Podizanje na prste, pravo koleno: 3×12 jedna noga + 8 kg · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 3×15/noga + 8 kg · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×30 m\n• Odvođenje kuka stojeći: 3×15/noga · Traka\n• Pallof pritisak: 3×10/strana · Traka\n• Bočna plank: 3×30 s'
      },
      {
        id: 'n7d3',
        dow: 2,
        tag: 'tempo',
        km: 14.5,
        desc: 'Ključni (tempo trke) — 2 km WU + 2×5000 m @ 4:40–4:45/km (3 min džog) + 2 km CD · samo ako test cevanica prođe; ako ne prođe — lako, a nedelja se ponavlja'
      },
      {
        id: 'n7d4',
        dow: 3,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu + pliometrija nivo 2 · ~40 min, pliometrija prva (sveže noge)\nPLIOMETRIJA — samo ako test cevanica prođe:\n• Pogo skokovi snožno: Nivo 2: 3×20\n• A-skip: 2×20 m\n• Bočni skokovi preko linije: Nivo 2: 2×15\n• Skok iz čučnja: Nivo 2: 3×5\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 3×12 (spust 4 s) · 1× zvono 8 kg\n• Bugarski čučanj: 3×10/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 3×10/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 3×12/noga + 8 kg · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 3×15 · Zvono 8 kg\n• Mrtva buba: 3×10/strana\nNapomena: Pliometrija SAMO ako test cevanica prođe'
      },
      {
        id: 'n7d5',
        dow: 4,
        tag: 'lako',
        km: 6,
        desc: 'Lako trčanje 6 km · po osećaju (razgovorni)'
      },
      {
        id: 'n7d6',
        dow: 5,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n7d7',
        dow: 6,
        tag: 'lr',
        km: 16,
        desc: 'Dugo trčanje 16 km · po osećaju (razgovorni)'
      }
    ]
  },
  {
    w: 8,
    start: '2026-11-09',
    focus: 'Plan ned. 6 — KONTROLNA TAČKA za sub-1:40 (8 km na 4:40)',
    days: [
      {
        id: 'n8d1',
        dow: 0,
        tag: 'lako',
        km: 6,
        desc: 'Lako trčanje 6 km · po osećaju (razgovorni)'
      },
      {
        id: 'n8d2',
        dow: 1,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — cevanice, stopalo, kuk · ~25 min, lagano, bez umora pred sredu\n• Podizanje prstiju uz zid (tibialis): 3×20\n• Dorsifleksija sa trakom: 3×15/noga · Traka\n• Inverzija i everzija sa trakom: 3×15 svaka · Traka\n• Podizanje na prste, pravo koleno: 3×12 jedna noga + 8 kg · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 3×15/noga + 8 kg · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×30 m\n• Odvođenje kuka stojeći: 3×15/noga · Traka\n• Pallof pritisak: 3×10/strana · Traka\n• Bočna plank: 3×30 s'
      },
      {
        id: 'n8d3',
        dow: 2,
        tag: 'tempo',
        km: 12,
        desc: 'Ključni (tempo trke) — 2 km WU + 8 km bez pauze @ 4:40/km + 2 km CD · samo ako test cevanica prođe; ako ne prođe — lako, a nedelja se ponavlja · KONTROLNA TAČKA za sub-1:40'
      },
      {
        id: 'n8d4',
        dow: 3,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu + pliometrija nivo 2 · ~40 min, pliometrija prva (sveže noge)\nPLIOMETRIJA — samo ako test cevanica prođe:\n• Pogo skokovi snožno: Nivo 2: 3×20\n• A-skip: 2×20 m\n• Bočni skokovi preko linije: Nivo 2: 2×15\n• Skok iz čučnja: Nivo 2: 3×5\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 3×12 (spust 4 s) · 1× zvono 8 kg\n• Bugarski čučanj: 3×10/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 3×10/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 3×12/noga + 8 kg · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 3×15 · Zvono 8 kg\n• Mrtva buba: 3×10/strana\nNapomena: Pliometrija SAMO ako test cevanica prođe'
      },
      {
        id: 'n8d5',
        dow: 4,
        tag: 'lako',
        km: 6,
        desc: 'Lako trčanje 6 km · po osećaju (razgovorni)'
      },
      {
        id: 'n8d6',
        dow: 5,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n8d7',
        dow: 6,
        tag: 'lr',
        km: 18,
        desc: 'Dugo trčanje 18 km · po osećaju (razgovorni)'
      }
    ]
  },
  {
    w: 9,
    start: '2026-11-16',
    focus: 'Plan ned. 7 — najveći obim, pliometrija nivo 3',
    days: [
      {
        id: 'n9d1',
        dow: 0,
        tag: 'lako',
        km: 6,
        desc: 'Lako trčanje 6 km · po osećaju (razgovorni)'
      },
      {
        id: 'n9d2',
        dow: 1,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — cevanice, stopalo, kuk · ~25 min, lagano, bez umora pred sredu\n• Podizanje prstiju uz zid (tibialis): 3×20\n• Dorsifleksija sa trakom: 3×15/noga · Traka\n• Inverzija i everzija sa trakom: 3×15 svaka · Traka\n• Podizanje na prste, pravo koleno: 3×12 jedna noga + 8 kg · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 3×15/noga + 8 kg · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×30 m\n• Odvođenje kuka stojeći: 3×15/noga · Traka\n• Pallof pritisak: 3×10/strana · Traka\n• Bočna plank: 3×30 s'
      },
      {
        id: 'n9d3',
        dow: 2,
        tag: 'int',
        km: 11.5,
        desc: 'Ključni (intervali) — 2 km WU + 4×1600 m @ 4:15/km (2 min džog) + 2 km CD · samo ako test cevanica prođe; ako ne prođe — lako, a nedelja se ponavlja'
      },
      {
        id: 'n9d4',
        dow: 3,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu + pliometrija nivo 3 · ~40 min, pliometrija prva (sveže noge)\nPLIOMETRIJA — samo ako test cevanica prođe:\n• Pogo skokovi snožno: Nivo 2: 3×20\n• A-skip: 2×20 m\n• Bočni skokovi preko linije: Nivo 2: 2×15\n• Skok iz čučnja: Nivo 2: 3×5\n• Pogo na jednoj nozi: Ned. 7: 2×10/noga\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 3×12 (spust 4 s) · 1× zvono 8 kg\n• Bugarski čučanj: 3×10/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 3×10/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 3×12/noga + 8 kg · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 3×15 · Zvono 8 kg\n• Mrtva buba: 3×10/strana\nNapomena: Pliometrija SAMO ako test cevanica prođe'
      },
      {
        id: 'n9d5',
        dow: 4,
        tag: 'lako',
        km: 6,
        desc: 'Lako trčanje 6 km · po osećaju (razgovorni)'
      },
      {
        id: 'n9d6',
        dow: 5,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n9d7',
        dow: 6,
        tag: 'lr',
        km: 19,
        desc: 'Dugo 19 km: 13 km lako + poslednjih 6 km ciljnim tempom · po osećaju (razgovorni) · Poslednjih 6 km 4:45'
      }
    ]
  },
  {
    w: 10,
    start: '2026-11-23',
    deload: true,
    focus: 'Plan ned. 8 — LAKŠA nedelja',
    days: [
      {
        id: 'n10d1',
        dow: 0,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · po osećaju (razgovorni)'
      },
      {
        id: 'n10d2',
        dow: 1,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — LAKŠA nedelja: 1 serija manje · ~25 min, lagano, bez umora pred sredu\n• Podizanje prstiju uz zid (tibialis): 2×20\n• Dorsifleksija sa trakom: 2×15/noga · Traka\n• Inverzija i everzija sa trakom: 2×15 svaka · Traka\n• Podizanje na prste, pravo koleno: 2×12 jedna noga + 8 kg · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 2×15/noga + 8 kg · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×20 m\n• Odvođenje kuka stojeći: 2×12/noga · Traka\n• Pallof pritisak: 2×10/strana · Traka\n• Bočna plank: 2×30 s'
      },
      {
        id: 'n10d3',
        dow: 2,
        tag: 'tempo',
        km: 13.5,
        desc: 'Ključni (tempo trke) — 2 km WU + 3×3000 m @ 4:35/km (2 min džog) + 2 km CD · samo ako test cevanica prođe; ako ne prođe — lako, a nedelja se ponavlja · Lakša nedelja'
      },
      {
        id: 'n10d4',
        dow: 3,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu + pliometrija nivo 1 (lakša nedelja) · ~40 min, pliometrija prva (sveže noge)\nPLIOMETRIJA — samo ako test cevanica prođe:\n• Pogo skokovi snožno: Nivo 1: 2×15 (ned. 8: 3×15)\n• A-skip: 2×20 m\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 2×12 · 1× zvono 8 kg\n• Bugarski čučanj: 2×8/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 2×8/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 2×12/noga · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 2×12 · Zvono 8 kg\n• Mrtva buba: 2×10/strana\nNapomena: Pliometrija SAMO ako test cevanica prođe'
      },
      {
        id: 'n10d5',
        dow: 4,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · po osećaju (razgovorni)'
      },
      {
        id: 'n10d6',
        dow: 5,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n10d7',
        dow: 6,
        tag: 'lr',
        km: 14,
        desc: 'Dugo trčanje 14 km · po osećaju (razgovorni) · Lakša nedelja'
      }
    ]
  },
  {
    w: 11,
    start: '2026-11-30',
    focus: 'Plan ned. 9 — početak smanjenja obima',
    days: [
      {
        id: 'n11d1',
        dow: 0,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · po osećaju (razgovorni)'
      },
      {
        id: 'n11d2',
        dow: 1,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — cevanice, stopalo, kuk · ~25 min, lagano, bez umora pred sredu\n• Podizanje prstiju uz zid (tibialis): 2×20\n• Dorsifleksija sa trakom: 2×15/noga · Traka\n• Inverzija i everzija sa trakom: 2×15 svaka · Traka\n• Podizanje na prste, pravo koleno: 2×12 jedna noga + 8 kg · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 2×15/noga + 8 kg · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×20 m\n• Odvođenje kuka stojeći: 2×12/noga · Traka\n• Pallof pritisak: 2×10/strana · Traka\n• Bočna plank: 2×30 s'
      },
      {
        id: 'n11d3',
        dow: 2,
        tag: 'tempo',
        km: 10,
        desc: 'Ključni (tempo trke) — 2 km WU + 6 km bez pauze @ 4:40/km + 2 km CD · samo ako test cevanica prođe; ako ne prođe — lako, a nedelja se ponavlja · Početak smanjenja obima'
      },
      {
        id: 'n11d4',
        dow: 3,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu + pliometrija nivo 1, 2 serije · ~40 min, pliometrija prva (sveže noge)\nPLIOMETRIJA — samo ako test cevanica prođe:\n• Pogo skokovi snožno: Nivo 1: 2×15 (ned. 8: 3×15)\n• A-skip: 2×20 m\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 2×12 · 1× zvono 8 kg\n• Bugarski čučanj: 2×8/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 2×8/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 2×12/noga · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 2×12 · Zvono 8 kg\n• Mrtva buba: 2×10/strana\nNapomena: Pliometrija SAMO ako test cevanica prođe'
      },
      {
        id: 'n11d5',
        dow: 4,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · po osećaju (razgovorni)'
      },
      {
        id: 'n11d6',
        dow: 5,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n11d7',
        dow: 6,
        tag: 'lr',
        km: 12,
        desc: 'Dugo trčanje 12 km · po osećaju (razgovorni)'
      }
    ]
  },
  {
    w: 12,
    start: '2026-12-07',
    focus: 'Plan ned. 10 — TRKAČKA NEDELJA',
    days: [
      {
        id: 'n12d1',
        dow: 0,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · po osećaju (razgovorni)'
      },
      {
        id: 'n12d2',
        dow: 1,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — lagano, 2 serije, bez težine · ~25 min, lagano, bez umora pred sredu\n• Podizanje prstiju uz zid (tibialis): 2×15\n• Dorsifleksija sa trakom: 1×15/noga · Traka\n• Inverzija i everzija sa trakom: 1×15 svaka · Traka\n• Podizanje na prste, pravo koleno: 2×12 obe noge · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 1×15/noga · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 1×20 m\nNapomena: Trkačka nedelja'
      },
      {
        id: 'n12d3',
        dow: 2,
        tag: 'tempo',
        km: 6.5,
        desc: 'Ključni (tempo trke) — 2 km WU + 3 km @ 4:40/km + 1.5 km CD · samo ako test cevanica prođe; ako ne prođe — lako, a nedelja se ponavlja · Trkačka nedelja'
      },
      {
        id: 'n12d4',
        dow: 3,
        tag: 'snaga',
        km: null,
        desc: 'Samo mobilnost 10–15 min, bez opterećenja\nNapomena: Bez pliometrije i snage'
      },
      {
        id: 'n12d5',
        dow: 4,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n12d6',
        dow: 5,
        tag: 'lako',
        km: 3,
        desc: 'Shakeout 3 km · po osećaju (razgovorni) · Dan pred trku'
      },
      {
        id: 'n12d7',
        dow: 6,
        tag: 'trka',
        km: 21.1,
        desc: '🏁 BOKEŠKI POLUMARATON — cilj ispod 1:40 · ritam 4:40–4:44/km · Proveri satnicu na sajtu organizatora'
      }
    ]
  }
] as unknown as GenPlanState['weeks'];

/** Redovi predikcije (referentna kriva i tempo radnog dela po nedelji). `p5k` je 5K-ekvivalent cilja (1:40:00 → 6000 s na 21,1 km). */
export const PERSONAL_PRED = [
  {
    id: 'p1',
    w: 4,
    l: 'N4 · Tempo trke',
    q: 6,
    pt: 283,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p2',
    w: 5,
    l: 'N5 · Tempo trke',
    q: 9,
    pt: 283,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p3',
    w: 6,
    l: 'N6 · Intervali',
    q: 5,
    pt: 255,
    p5k: 6000
  },
  {
    id: 'p4',
    w: 7,
    l: 'N7 · Tempo trke',
    q: 10,
    pt: 283,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p5',
    w: 8,
    l: 'N8 · Tempo trke',
    q: 8,
    pt: 280,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p6',
    w: 9,
    l: 'N9 · Intervali',
    q: 6.4,
    pt: 255,
    p5k: 6000
  },
  {
    id: 'p7',
    w: 10,
    l: 'N10 · Tempo trke',
    q: 9,
    pt: 275,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p8',
    w: 11,
    l: 'N11 · Tempo trke',
    q: 6,
    pt: 280,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p9',
    w: 12,
    l: 'N12 · Tempo trke',
    q: 3,
    pt: 280,
    p5k: 6000,
    nemeri: true
  }
] as unknown as GenPlanState['pred'];

/** Rep-distance (m) po kvalitetnim danima, za detekciju radnih krugova sa Strave. */
export const PERSONAL_QS: Record<string, number[]> = {
  n4d3: [2000],
  n5d3: [3000],
  n6d3: [1000],
  n7d3: [5000],
  n8d3: [8000],
  n9d3: [1600],
  n10d3: [3000],
  n11d3: [6000],
  n12d3: [3000]
};
