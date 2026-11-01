/* LIČNI (UGRAĐENI) PLAN VLASNIKA — nedelje 1–3 (21.09–11.10) su iz ranijeg plana, nedelje 4–6 (12.10–1.11) iz Plan_Bokeski_1h35.xlsx (cilj 1:35:00, tempo 4:30/km),
   nedelje 7–12 (2.11–13.12) iz plana od 1.11.2026 (cilj 1:40:00, tempo 4:44/km): povratak posle 4 nedelje skoro bez trčanja (virus posle Niša), izgradnja, test cilja
   29.11, taper. Tempo zone su iz HM 1:40:00 (lagano/prag/tempo trke) i iz 5K 20:25 (intervali).

   Nije podrazumevani plan aplikacije nego NEČIJI STVARNI plan: pokazuje se SAMO vlasniku (ili nalogu koji je već upisivao treninge na njega), v. `domain/personal`.
   Excel nedelja k (12.10–1.11) je ovde N(k+3): dan odmora posle svakog trčanja, bez snage i pliometrije; „hlađenje" = Excelovo „rastrčavanje" (tako ga parsiraju WU/CD obrasci).
   Sutrašnji dan 11.10 (n3d7) je ručno 6 km lagano. Datum trke je 13.12 (nedelja). ID-jevi dana su u „n" prostoru (generisani planovi su u „g").
   Nedelje 7–12 nose ID-jeve sa nastavkom „b" (n7d1b…): vlasnik ima ručne izmene (`alts`) na danima starog plana n7–n12 (snaga na danima odmora, jedan tempo), a izmena
   se veže za ID dana — sa starim ID-jevima pregazila bi nove treninge. Snaga A/B iz tih izmena je preneta u dane odmora novog plana. */

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
        tag: 'lako',
        km: 6,
        desc: 'Lako trčanje 6 km · po osećaju (razgovorni)'
      }
    ]
  },
  {
    w: 4,
    start: '2026-10-12',
    focus: 'Plan 1:35 · ned. 1 — Baza · 30 km',
    days: [
      {
        id: 'n4d1',
        dow: 0,
        tag: 'lako',
        km: 6,
        desc: 'Lako trčanje 6 km · po osećaju (razgovorni)'
      },
      {
        id: 'n4d2',
        dow: 1,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n4d3',
        dow: 2,
        tag: 'lako',
        km: 7,
        desc: 'Lako trčanje 7 km · po osećaju (razgovorni)'
      },
      {
        id: 'n4d4',
        dow: 3,
        rest: true,
        desc: 'Odmor'
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
        km: 12,
        desc: 'Dugo trčanje 12 km · po osećaju (razgovorni)'
      }
    ]
  },
  {
    w: 5,
    start: '2026-10-19',
    focus: 'Plan 1:35 · ned. 2 — 2 tempa',
    days: [
      {
        id: 'n5d1',
        dow: 0,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n5d2',
        dow: 1,
        tag: 'tempo',
        km: 9,
        desc: 'Tempo — 2 km zagrevanje + 4 km @ 4:30/km + 3 km hlađenje · kontrolisano 6–7/10; pauze su uračunate u ukupan km. 4 km kontinuirano na ciljnom tempu. Prvi od dva tempo dana ove nedelje.'
      },
      {
        id: 'n5d3',
        dow: 2,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n5d4',
        dow: 3,
        tag: 'tempo',
        km: 9,
        desc: 'Tempo — 2 km zagrevanje + 5 km @ 4:30/km + 2 km hlađenje · kontrolisano 6–7/10; pauze su uračunate u ukupan km. 5 km kontinuirano na ciljnom tempu. Bez sprinta na kraju.'
      },
      {
        id: 'n5d5',
        dow: 4,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n5d6',
        dow: 5,
        tag: 'lr',
        km: 14.4,
        desc: 'Dugo trčanje 14,4 km · po osećaju (razgovorni)'
      },
      {
        id: 'n5d7',
        dow: 6,
        rest: true,
        desc: 'Odmor'
      }
    ]
  },
  {
    w: 6,
    start: '2026-10-26',
    focus: 'Plan 1:35 · ned. 3 — 2 tempa + lako',
    days: [
      {
        id: 'n6d1',
        dow: 0,
        tag: 'tempo',
        km: 8,
        desc: 'Tempo — 2 km zagrevanje + 5 km @ 4:30/km + 1 km hlađenje · kontrolisano 6–7/10; pauze su uračunate u ukupan km. 5 km kontinuirano na tempu; ponovi ravnomeran napor kroz celu deonicu.'
      },
      {
        id: 'n6d2',
        dow: 1,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n6d3',
        dow: 2,
        tag: 'tempo',
        km: 8,
        desc: 'Tempo — 2 km zagrevanje + 5 km @ 4:30/km + 1 km hlađenje · kontrolisano 6–7/10; pauze su uračunate u ukupan km. Drugi tempo ove nedelje: 5 km kontinuirano, završiti sa rezervom.'
      },
      {
        id: 'n6d4',
        dow: 3,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n6d5',
        dow: 4,
        tag: 'lako',
        km: 4.59,
        desc: 'Lako trčanje 4,59 km · po osećaju (razgovorni)'
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
        km: 14.4,
        desc: 'Dugo trčanje 14,4 km · po osećaju (razgovorni)'
      }
    ]
  },
  {
    w: 7,
    start: '2026-11-02',
    focus: 'Plan 1:40 · ned. 1 — Povratak · 28 km, samo lagano',
    days: [
      {
        id: 'n7d1b',
        dow: 0,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu, bez pliometrije · ~40 min\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 3×10 · 1× zvono 8 kg\n• Bugarski čučanj: 2×8/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 2×8/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 3×10/noga · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 2×12 · Zvono 8 kg\n• Mrtva buba: 2×8/strana'
      },
      {
        id: 'n7d2b',
        dow: 1,
        tag: 'lako',
        km: 6,
        desc: 'Lako trčanje 6 km · puls ≤150, razgovorno · na kraju 4×100 m ubrzanja (hod ili lagani džog nazad)'
      },
      {
        id: 'n7d3b',
        dow: 2,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — cevanice, stopalo, kuk · ~25 min, lagano, bez umora za sutrašnje trčanje\n• Podizanje prstiju uz zid (tibialis): 2×15\n• Dorsifleksija sa trakom: 2×12/noga · Traka\n• Inverzija i everzija sa trakom: 2×12 svaka · Traka\n• Podizanje na prste, pravo koleno: 3×15 obe noge · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 3×12/noga · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×20 m\n• Odvođenje kuka stojeći: 2×12/noga · Traka\n• Pallof pritisak: 2×8/strana · Traka\n• Bočna plank: 2×20 s'
      },
      {
        id: 'n7d4b',
        dow: 3,
        tag: 'lako',
        km: 7,
        desc: 'Lako trčanje 7 km · puls ≤150, razgovorno · na kraju 6×100 m ubrzanja (hod ili lagani džog nazad)'
      },
      {
        id: 'n7d5b',
        dow: 4,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n7d6b',
        dow: 5,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · puls ≤150, razgovorno'
      },
      {
        id: 'n7d7b',
        dow: 6,
        tag: 'lr',
        km: 10,
        desc: 'Dugo trčanje 10 km · puls ≤150, razgovorno'
      }
    ]
  },
  {
    w: 8,
    start: '2026-11-09',
    focus: 'Plan 1:40 · ned. 2 — Izgradnja · 37 km, prvi prag',
    days: [
      {
        id: 'n8d1b',
        dow: 0,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu, bez pliometrije · ~40 min\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 3×10 · 1× zvono 8 kg\n• Bugarski čučanj: 2×8/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 2×8/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 3×10/noga · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 2×12 · Zvono 8 kg\n• Mrtva buba: 2×8/strana'
      },
      {
        id: 'n8d2b',
        dow: 1,
        tag: 'tempo',
        km: 9.1,
        desc: 'Tempo — 2 km zagrevanje + 3×1600 m @ 4:40/km (400 m lagano između) + 1,5 km hlađenje · prag, 6–7/10; ne brže od 4:33'
      },
      {
        id: 'n8d3b',
        dow: 2,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · puls ≤150, razgovorno'
      },
      {
        id: 'n8d4b',
        dow: 3,
        tag: 'lako',
        km: 6,
        desc: 'Lako trčanje 6 km · puls ≤150, razgovorno · na kraju 6×100 m ubrzanja (hod ili lagani džog nazad)'
      },
      {
        id: 'n8d5b',
        dow: 4,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — cevanice, stopalo, kuk · ~25 min, lagano, bez umora pred vikend\n• Podizanje prstiju uz zid (tibialis): 2×15\n• Dorsifleksija sa trakom: 2×12/noga · Traka\n• Inverzija i everzija sa trakom: 2×12 svaka · Traka\n• Podizanje na prste, pravo koleno: 3×15 obe noge · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 3×12/noga · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×20 m\n• Odvođenje kuka stojeći: 2×12/noga · Traka\n• Pallof pritisak: 2×8/strana · Traka\n• Bočna plank: 2×20 s'
      },
      {
        id: 'n8d6b',
        dow: 5,
        tag: 'lako',
        km: 4,
        desc: 'Lako trčanje 4 km · puls ≤150, razgovorno'
      },
      {
        id: 'n8d7b',
        dow: 6,
        tag: 'lr',
        km: 13,
        desc: 'Dugo trčanje 13 km · puls ≤150, razgovorno'
      }
    ]
  },
  {
    w: 9,
    start: '2026-11-16',
    focus: 'Plan 1:40 · ned. 3 — Izgradnja · 43 km, intervali + prag',
    days: [
      {
        id: 'n9d1b',
        dow: 0,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu, bez pliometrije · ~40 min\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 3×10 · 1× zvono 8 kg\n• Bugarski čučanj: 2×8/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 2×8/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 3×10/noga · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 2×12 · Zvono 8 kg\n• Mrtva buba: 2×8/strana'
      },
      {
        id: 'n9d2b',
        dow: 1,
        tag: 'int',
        km: 10.6,
        desc: 'Intervali — 2 km zagrevanje + 5×1000 m @ 4:08/km (400 m lagano između) + 2 km hlađenje · 8–9/10; ujednačeno, poslednji ne brži od prvog'
      },
      {
        id: 'n9d3b',
        dow: 2,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · puls ≤150, razgovorno'
      },
      {
        id: 'n9d4b',
        dow: 3,
        tag: 'tempo',
        km: 9,
        desc: 'Tempo — 2 km zagrevanje + 2×2500 m @ 4:38/km (500 m lagano između) + 1,5 km hlađenje · prag, 6–7/10'
      },
      {
        id: 'n9d5b',
        dow: 4,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — cevanice, stopalo, kuk · ~25 min, lagano, bez umora pred vikend\n• Podizanje prstiju uz zid (tibialis): 2×15\n• Dorsifleksija sa trakom: 2×12/noga · Traka\n• Inverzija i everzija sa trakom: 2×12 svaka · Traka\n• Podizanje na prste, pravo koleno: 3×15 obe noge · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 3×12/noga · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×20 m\n• Odvođenje kuka stojeći: 2×12/noga · Traka\n• Pallof pritisak: 2×8/strana · Traka\n• Bočna plank: 2×20 s'
      },
      {
        id: 'n9d6b',
        dow: 5,
        tag: 'lako',
        km: 4,
        desc: 'Lako trčanje 4 km · puls ≤150, razgovorno'
      },
      {
        id: 'n9d7b',
        dow: 6,
        tag: 'lr',
        km: 14,
        desc: 'Dugo trčanje 14 km · puls ≤150, razgovorno'
      }
    ]
  },
  {
    w: 10,
    start: '2026-11-23',
    focus: 'Plan 1:40 · ned. 4 — Vrh obima · 44 km, test cilja',
    days: [
      {
        id: 'n10d1b',
        dow: 0,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu, bez pliometrije · ~40 min\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 3×10 · 1× zvono 8 kg\n• Bugarski čučanj: 2×8/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 2×8/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 3×10/noga · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 2×12 · Zvono 8 kg\n• Mrtva buba: 2×8/strana'
      },
      {
        id: 'n10d2b',
        dow: 1,
        tag: 'tempo',
        km: 12,
        desc: 'Tempo — 2 km zagrevanje + 3×2500 m @ 4:36/km (500 m lagano između) + 1,5 km hlađenje · prag, 6–7/10'
      },
      {
        id: 'n10d3b',
        dow: 2,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · puls ≤150, razgovorno'
      },
      {
        id: 'n10d4b',
        dow: 3,
        tag: 'lako',
        km: 6,
        desc: 'Lako trčanje 6 km · puls ≤150, razgovorno · na kraju 6×100 m ubrzanja (hod ili lagani džog nazad)'
      },
      {
        id: 'n10d5b',
        dow: 4,
        tag: 'snaga',
        km: null,
        desc: 'Snaga A — cevanice, stopalo, kuk · ~25 min, lagano, bez umora pred vikend\n• Podizanje prstiju uz zid (tibialis): 2×15\n• Dorsifleksija sa trakom: 2×12/noga · Traka\n• Inverzija i everzija sa trakom: 2×12 svaka · Traka\n• Podizanje na prste, pravo koleno: 3×15 obe noge · Zvono 8 kg u ruci (od ned. 3)\n• Podizanje na prste, savijeno koleno (soleus): 3×12/noga · Zvono 8 kg (od ned. 3)\n• Hod na prstima / na petama: 2×20 m\n• Odvođenje kuka stojeći: 2×12/noga · Traka\n• Pallof pritisak: 2×8/strana · Traka\n• Bočna plank: 2×20 s'
      },
      {
        id: 'n10d6b',
        dow: 5,
        tag: 'lako',
        km: 4,
        desc: 'Lako trčanje 4 km · puls ≤150, razgovorno'
      },
      {
        id: 'n10d7b',
        dow: 6,
        tag: 'lr',
        km: 17,
        desc: 'Dugo sa tempom trke — 4 km zagrevanje + 2×4000 m @ 4:44/km (1 km lagano između) + 4 km hlađenje · TEST CILJA; proba gela pre prvog bloka. Prosečan puls drugog bloka: ≤~165 i lako → cilj 1:39–1:40; 166–172 → 1:40, start 4:46; ne drži 4:44 ili >172 → cilj 1:41:30 (4:49) u nedeljama 5–6'
      }
    ]
  },
  {
    w: 11,
    start: '2026-11-30',
    focus: 'Plan 1:40 · ned. 5 — Taper 1 · 35 km',
    days: [
      {
        id: 'n11d1b',
        dow: 0,
        tag: 'snaga',
        km: null,
        desc: 'Snaga B — snaga nogu, bez pliometrije · ~40 min\nSNAGA (odmor između serija 60–90 s):\n• Goblet čučanj: 2×10 · 1× zvono 8 kg\n• Bugarski čučanj: 2×8/noga · 2× zvono 8 kg\n• Rumunsko mrtvo dizanje na jednoj nozi: 2×8/noga · 1–2× zvono 8 kg\n• Most na jednoj nozi: 2×10/noga · Zvono 8 kg na kuku (od ned. 5)\n• Podizanje na prste, jedna noga: 2×12 · Zvono 8 kg\n• Mrtva buba: 2×8/strana\nNapomena: Taper — lagano, bez rada do otkaza.'
      },
      {
        id: 'n11d2b',
        dow: 1,
        tag: 'int',
        km: 10.8,
        desc: 'Intervali — 2 km zagrevanje + 6×800 m @ 4:05/km (400 m lagano između) + 2 km hlađenje · 8–9/10; taper: obim dole, intenzitet ostaje'
      },
      {
        id: 'n11d3b',
        dow: 2,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · puls ≤150, razgovorno'
      },
      {
        id: 'n11d4b',
        dow: 3,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · puls ≤150, razgovorno · na kraju 6×100 m ubrzanja (hod ili lagani džog nazad)'
      },
      {
        id: 'n11d5b',
        dow: 4,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n11d6b',
        dow: 5,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n11d7b',
        dow: 6,
        tag: 'lr',
        km: 14,
        desc: 'Dugo sa tempom trke — 9 km zagrevanje + 4 km @ 4:44/km (ili 4:49 ako je test 29.11. tako odredio) + 1 km hlađenje · ponovi gel kao na trci'
      }
    ]
  },
  {
    w: 12,
    start: '2026-12-07',
    focus: 'Plan 1:40 · ned. 6 — Taper 2 · trka',
    days: [
      {
        id: 'n12d1b',
        dow: 0,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n12d2b',
        dow: 1,
        tag: 'tempo',
        km: 8.6,
        desc: 'Tempo trke — 2 km zagrevanje + 3×1600 m @ 4:44/km (400 m lagano između) + 1 km hlađenje · podsetnik na ritam, ne test; tempo po odluci od 29.11.'
      },
      {
        id: 'n12d3b',
        dow: 2,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n12d4b',
        dow: 3,
        tag: 'lako',
        km: 5,
        desc: 'Lako trčanje 5 km · puls ≤150, razgovorno · na kraju 4×100 m ubrzanja (hod ili lagani džog nazad)'
      },
      {
        id: 'n12d5b',
        dow: 4,
        rest: true,
        desc: 'Odmor · putovanje'
      },
      {
        id: 'n12d6b',
        dow: 5,
        tag: 'lako',
        km: 3,
        desc: 'Lako trčanje 3 km · puls ≤150, razgovorno · na kraju 3×100 m ubrzanja; po mogućstvu na delu staze'
      },
      {
        id: 'n12d7b',
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
    id: 'p10',
    w: 5,
    l: 'N5 · Tempo trke',
    q: 4,
    pt: 270,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p11',
    w: 5,
    l: 'N5 · Tempo trke',
    q: 5,
    pt: 270,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p12',
    w: 6,
    l: 'N6 · Tempo trke',
    q: 5,
    pt: 270,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p13',
    w: 6,
    l: 'N6 · Tempo trke',
    q: 5,
    pt: 270,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p26',
    w: 8,
    l: 'N8 · Tempo',
    q: 4.8,
    pt: 280,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p27',
    w: 9,
    l: 'N9 · Intervali',
    q: 5,
    pt: 248,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p28',
    w: 9,
    l: 'N9 · Tempo',
    q: 5,
    pt: 278,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p29',
    w: 10,
    l: 'N10 · Tempo',
    q: 7.5,
    pt: 276,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p30',
    w: 11,
    l: 'N11 · Intervali',
    q: 4.8,
    pt: 245,
    p5k: 6000,
    nemeri: true
  },
  {
    id: 'p31',
    w: 12,
    l: 'N12 · Tempo trke',
    q: 4.8,
    pt: 284,
    p5k: 6000,
    nemeri: true
  }
] as unknown as GenPlanState['pred'];

/** Rep-distance (m) po kvalitetnim danima, za detekciju radnih krugova sa Strave. */
export const PERSONAL_QS: Record<string, number[]> = {
  n5d2: [4000],
  n5d4: [5000],
  n6d1: [5000],
  n6d3: [5000],
  n8d2b: [1600],
  n9d2b: [1000],
  n9d4b: [2500],
  n10d2b: [2500],
  n11d2b: [800],
  n12d2b: [1600]
};
