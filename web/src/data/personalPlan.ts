/* LIČNI (UGRAĐENI) PLAN VLASNIKA — nedelje 1–3 (21.09–11.10) su iz ranijeg plana, nedelje 4–12 (od 12.10) iz Plan_Bokeski_1h35.xlsx (cilj 1:35:00, tempo 4:30/km).

   Nije podrazumevani plan aplikacije nego NEČIJI STVARNI plan: pokazuje se SAMO vlasniku (ili nalogu koji je već upisivao treninge na njega), v. `domain/personal`.
   Excel nedelja k (12.10–13.12) je ovde N(k+3). Sredom/petkom i dužinom upravlja Excel: dan odmora posle svakog trčanja, bez snage i pliometrije; „hlađenje" = Excelovo „rastrčavanje" (tako ga parsiraju WU/CD obrasci).
   Sutrašnji dan 11.10 (n3d7) je ručno 6 km lagano. Datum trke je 13.12 (nedelja). ID-jevi dana su u „n" prostoru (generisani planovi su u „g"). */

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
    focus: 'Plan 1:35 · ned. 4 — HM tempo',
    days: [
      {
        id: 'n7d1',
        dow: 0,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n7d2',
        dow: 1,
        tag: 'tempo',
        km: 11,
        desc: 'Tempo — 2 km zagrevanje + 6 km @ 4:30/km + 3 km hlađenje · kontrolisano 6–7/10; pauze su uračunate u ukupan km. 6 km kontinuirano na tempu; ostatak treninga lagano.'
      },
      {
        id: 'n7d3',
        dow: 2,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n7d4',
        dow: 3,
        tag: 'tempo',
        km: 11.29,
        desc: 'Tempo — 2 km zagrevanje + 3×3000 m @ 4:30/km (200 m vrlo lagano između) + 3,09 km hlađenje · kontrolisano 6–7/10; pauze su uračunate u ukupan km. 6 km na tempu kroz 2 × 3 km. Između 200 m vrlo lagano; ne ubrzavaj drugi blok.'
      },
      {
        id: 'n7d5',
        dow: 4,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n7d6',
        dow: 5,
        tag: 'lr',
        km: 15.5,
        desc: 'Dugo trčanje 15,5 km · po osećaju (razgovorni)'
      },
      {
        id: 'n7d7',
        dow: 6,
        rest: true,
        desc: 'Odmor'
      }
    ]
  },
  {
    w: 8,
    start: '2026-11-09',
    focus: 'Plan 1:35 · ned. 5 — Produženje tempa',
    days: [
      {
        id: 'n8d1',
        dow: 0,
        tag: 'tempo',
        km: 10,
        desc: 'Tempo — 2 km zagrevanje + 7 km @ 4:30/km + 1 km hlađenje · kontrolisano 6–7/10; pauze su uračunate u ukupan km. 7 km kontinuirano na tempu. Ako napor odlazi prema maksimumu, skrati deonicu.'
      },
      {
        id: 'n8d2',
        dow: 1,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n8d3',
        dow: 2,
        tag: 'tempo',
        km: 10,
        desc: 'Tempo — 2 km zagrevanje + 3×3000 m @ 4:30/km (200 m vrlo lagano između) + 1,8 km hlađenje · kontrolisano 6–7/10; pauze su uračunate u ukupan km. 6 km na tempu kroz 2 × 3 km; cilj je ujednačenost i normalan oporavak.'
      },
      {
        id: 'n8d4',
        dow: 3,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n8d5',
        dow: 4,
        tag: 'lako',
        km: 5.31,
        desc: 'Lako trčanje 5,31 km · po osećaju (razgovorni)'
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
        km: 15.5,
        desc: 'Dugo trčanje 15,5 km · po osećaju (razgovorni)'
      }
    ]
  },
  {
    w: 9,
    start: '2026-11-16',
    focus: 'Plan 1:35 · ned. 6 — Kontrola cilja',
    days: [
      {
        id: 'n9d1',
        dow: 0,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n9d2',
        dow: 1,
        tag: 'tempo',
        km: 13.5,
        desc: 'Tempo — 2 km zagrevanje + 8 km @ 4:30/km + 3,5 km hlađenje · kontrolisano 6–7/10; pauze su uračunate u ukupan km. Kontrola cilja: 8 km kontinuirano na 4:30/km. Prati održivost tempa i oporavak; nije garancija rezultata.'
      },
      {
        id: 'n9d3',
        dow: 2,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n9d4',
        dow: 3,
        tag: 'tempo',
        km: 13.53,
        desc: 'Tempo — 2 km zagrevanje + 3×3000 m @ 4:30/km (200 m vrlo lagano između) + 5,33 km hlađenje · kontrolisano 6–7/10; pauze su uračunate u ukupan km. Drugi tempo: 2 × 3 km, ukupno 6 km na tempu. Ostatak kilometraže tog dana je lagan.'
      },
      {
        id: 'n9d5',
        dow: 4,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n9d6',
        dow: 5,
        tag: 'lr',
        km: 17.05,
        desc: 'Dugo trčanje 17,05 km · po osećaju (razgovorni)'
      },
      {
        id: 'n9d7',
        dow: 6,
        rest: true,
        desc: 'Odmor'
      }
    ]
  },
  {
    w: 10,
    start: '2026-11-23',
    focus: 'Plan 1:35 · ned. 7 — Vrh obima',
    days: [
      {
        id: 'n10d1',
        dow: 0,
        tag: 'tempo',
        km: 11.5,
        desc: 'Tempo — 2 km zagrevanje + 8 km @ 4:30/km + 1,5 km hlađenje · kontrolisano 6–7/10; pauze su uračunate u ukupan km. Poslednji veći kontinuirani tempo: 8 km na 4:30/km. Bez ubrzavanja završnice.'
      },
      {
        id: 'n10d2',
        dow: 1,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n10d3',
        dow: 2,
        tag: 'tempo',
        km: 11.5,
        desc: 'Tempo — 2 km zagrevanje + 4×4000 m @ 4:30/km (200 m vrlo lagano između) + 1,3 km hlađenje · kontrolisano 6–7/10; pauze su uračunate u ukupan km. Poslednji veći blokovi: 2 × 4 km na 4:30/km, između 200 m vrlo lagano.'
      },
      {
        id: 'n10d4',
        dow: 3,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n10d5',
        dow: 4,
        tag: 'lako',
        km: 6.21,
        desc: 'Lako trčanje 6,21 km · po osećaju (razgovorni)'
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
        km: 18.4,
        desc: 'Dugo trčanje 18,4 km · po osećaju (razgovorni)'
      }
    ]
  },
  {
    w: 11,
    start: '2026-11-30',
    focus: 'Plan 1:35 · ned. 8 — Taper 1 · 2 tempa',
    days: [
      {
        id: 'n11d1',
        dow: 0,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n11d2',
        dow: 1,
        tag: 'tempo',
        km: 10,
        desc: 'Tempo — 2 km zagrevanje + 6 km @ 4:30/km + 2 km hlađenje · kontrolisano 6–7/10; pauze su uračunate u ukupan km. Taper 1: 6 km kontinuirano na tempu. Kraće od vršne nedelje, bez dodatnih deonica.'
      },
      {
        id: 'n11d3',
        dow: 2,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n11d4',
        dow: 3,
        tag: 'tempo',
        km: 9.99,
        desc: 'Tempo — 2 km zagrevanje + 4 km @ 4:30/km + 3,99 km hlađenje · kontrolisano 6–7/10; pauze su uračunate u ukupan km. Taper 1: drugi tempo, 4 km kontinuirano. Završiti svež.'
      },
      {
        id: 'n11d5',
        dow: 4,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n11d6',
        dow: 5,
        tag: 'lr',
        km: 13.33,
        desc: 'Dugo trčanje 13,33 km · po osećaju (razgovorni)'
      },
      {
        id: 'n11d7',
        dow: 6,
        rest: true,
        desc: 'Odmor'
      }
    ]
  },
  {
    w: 12,
    start: '2026-12-07',
    focus: 'Plan 1:35 · ned. 9 — Taper 2 · trka',
    days: [
      {
        id: 'n12d1',
        dow: 0,
        tag: 'tempo',
        km: 6,
        desc: 'Tempo — 2 km zagrevanje + 3 km @ 4:30/km + 1 km hlađenje · kontrolisano 6–7/10; pauze su uračunate u ukupan km. Nedelja trke: 3 km kontinuirano na tempu. Podsetnik na ritam; ne test forme.'
      },
      {
        id: 'n12d2',
        dow: 1,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n12d3',
        dow: 2,
        tag: 'tempo',
        km: 6,
        desc: 'Tempo — 2 km zagrevanje + 2 km @ 4:30/km + 2 km hlađenje · kontrolisano 6–7/10; pauze su uračunate u ukupan km. Nedelja trke: 2 km kontinuirano na tempu. Kratka aktivacija četiri dana pre starta.'
      },
      {
        id: 'n12d4',
        dow: 3,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n12d5',
        dow: 4,
        tag: 'lako',
        km: 3,
        desc: 'Lako trčanje 3 km · po osećaju (razgovorni)'
      },
      {
        id: 'n12d6',
        dow: 5,
        rest: true,
        desc: 'Odmor'
      },
      {
        id: 'n12d7',
        dow: 6,
        tag: 'trka',
        km: 21.1,
        desc: '🏁 BOKEŠKI POLUMARATON — cilj 1:35:00 · ritam 4:30/km · Start 09:00; prva 2 km oko 4:35, zatim oko 4:29–4:30; ubrzanje posle 17 km ako imaš rezervu'
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
    p5k: 5700,
    nemeri: true
  },
  {
    id: 'p11',
    w: 5,
    l: 'N5 · Tempo trke',
    q: 5,
    pt: 270,
    p5k: 5700,
    nemeri: true
  },
  {
    id: 'p12',
    w: 6,
    l: 'N6 · Tempo trke',
    q: 5,
    pt: 270,
    p5k: 5700,
    nemeri: true
  },
  {
    id: 'p13',
    w: 6,
    l: 'N6 · Tempo trke',
    q: 5,
    pt: 270,
    p5k: 5700,
    nemeri: true
  },
  {
    id: 'p14',
    w: 7,
    l: 'N7 · Tempo trke',
    q: 6,
    pt: 270,
    p5k: 5700,
    nemeri: true
  },
  {
    id: 'p15',
    w: 7,
    l: 'N7 · Tempo trke',
    q: 6,
    pt: 270,
    p5k: 5700,
    nemeri: true
  },
  {
    id: 'p16',
    w: 8,
    l: 'N8 · Tempo trke',
    q: 7,
    pt: 270,
    p5k: 5700,
    nemeri: true
  },
  {
    id: 'p17',
    w: 8,
    l: 'N8 · Tempo trke',
    q: 6,
    pt: 270,
    p5k: 5700,
    nemeri: true
  },
  {
    id: 'p18',
    w: 9,
    l: 'N9 · Tempo trke',
    q: 8,
    pt: 270,
    p5k: 5700,
    nemeri: true
  },
  {
    id: 'p19',
    w: 9,
    l: 'N9 · Tempo trke',
    q: 6,
    pt: 270,
    p5k: 5700,
    nemeri: true
  },
  {
    id: 'p20',
    w: 10,
    l: 'N10 · Tempo trke',
    q: 8,
    pt: 270,
    p5k: 5700,
    nemeri: true
  },
  {
    id: 'p21',
    w: 10,
    l: 'N10 · Tempo trke',
    q: 8,
    pt: 270,
    p5k: 5700,
    nemeri: true
  },
  {
    id: 'p22',
    w: 11,
    l: 'N11 · Tempo trke',
    q: 6,
    pt: 270,
    p5k: 5700,
    nemeri: true
  },
  {
    id: 'p23',
    w: 11,
    l: 'N11 · Tempo trke',
    q: 4,
    pt: 270,
    p5k: 5700,
    nemeri: true
  },
  {
    id: 'p24',
    w: 12,
    l: 'N12 · Tempo trke',
    q: 3,
    pt: 270,
    p5k: 5700,
    nemeri: true
  },
  {
    id: 'p25',
    w: 12,
    l: 'N12 · Tempo trke',
    q: 2,
    pt: 270,
    p5k: 5700,
    nemeri: true
  }
] as unknown as GenPlanState['pred'];

/** Rep-distance (m) po kvalitetnim danima, za detekciju radnih krugova sa Strave. */
export const PERSONAL_QS: Record<string, number[]> = {
  n5d2: [4000],
  n5d4: [5000],
  n6d1: [5000],
  n6d3: [5000],
  n7d2: [6000],
  n7d4: [3000],
  n8d1: [7000],
  n8d3: [3000],
  n9d2: [8000],
  n9d4: [3000],
  n10d1: [8000],
  n10d3: [4000],
  n11d2: [6000],
  n11d4: [4000],
  n12d1: [3000],
  n12d3: [2000]
};
