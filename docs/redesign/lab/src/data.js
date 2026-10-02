/* ZAJEDNIČKI PODACI ZA SVIH 10 KONCEPATA.
   Poreklo (da se ne pomeša izmereno sa izmišljenim):
   - plan (nedelje, km, sesije, tempa 4:00 / 4:17 / 5:09, faze, deload N4/N8, cilj 19:59, VDOT baza 48,1 / cilj 49,9 / projekcija plana 50,6 / 19:45):
     IZ STVARNOG GENERATORA (web/src/domain), 5K, trka 20.12.2026, PB 20:37, 35 km/ned.
   - predikcije po VDOT-u (20:13, 41:54, 1:32:48, 11:43) i VDOT iz testa 3 km (11:45 → 49,0): IZ STVARNIH FUNKCIJA raceTimeForVdot / t3kVdot.
   - ostvareni km, lanac VDOT-a po nedeljama, prosečan lagan tempo i puls, HR zone, izmereno-vreme lakog trčanja: ILUSTRATIVNO (simulirano da ekran ne bude prazan).
*/
const D = (() => {
  const phases = [
    { k: 'BAZA', en: 'BASE', from: 1, to: 4, line: 'Gradi aerobnu osnovu i toleranciju na obim.' },
    { k: 'RAZVOJ', en: 'BUILD', from: 5, to: 8, line: 'Gradi VO₂max i prag — kvalitetni treninzi postaju teži.' },
    { k: 'VRHUNAC', en: 'PEAK', from: 9, to: 10, line: 'Najveći obim i najspecifičniji treninzi za tempo trke.' },
    { k: 'TAPER', en: 'TAPER', from: 11, to: 11, line: 'Obim dole, oštrina ostaje — sveže noge za trku.' },
    { k: 'TRKA', en: 'RACE', from: 12, to: 12, line: 'Dan trke.' }
  ];
  const phaseOf = (w) => phases.find((p) => w >= p.from && w <= p.to);
  const W = [
    [1, 18.3, 18.3, 0, [2, 2]],
    [2, 33.1, 31.4, 0, [3, 4]],
    [3, 35.6, 35.6, 0, [4, 4]],
    [4, 23.9, 20.1, 1, [3, 4]],
    [5, 34.8, 34.8, 0, [4, 4]],
    [6, 37.9, 7.8, 0, [1, 4]],
    [7, 39.4, 0, 0, [0, 4]],
    [8, 27.1, 0, 1, [0, 4]],
    [9, 37.7, 0, 0, [0, 4]],
    [10, 41.0, 0, 0, [0, 4]],
    [11, 24.3, 0, 0, [0, 4]],
    [12, 14.5, 0, 0, [0, 3]]
  ].map(([w, plan, real, deload, runs]) => ({ w, plan, real, deload: !!deload, runs, ph: phaseOf(w).k }));

  /* Nedelja 6 (stvarne sesije iz generatora). t: tip za boju/ikonu. */
  const week6 = [
    { dow: 'Pon', dd: '02', t: 'lako', name: 'Lagano', km: 7.8, core: '7,8 km @ 5:09', st: 'done', real: '7,8 km · 5:09/km' },
    { dow: 'Uto', dd: '03', t: 'snaga', name: 'Snaga', km: null, core: 'Mobilnost + snaga', st: 'done', real: 'odrađeno' },
    { dow: 'Sre', dd: '04', t: 'fartlek', name: 'Fartlek', km: 8.6, core: '7 × 60 s @ 4:00', st: 'today' },
    { dow: 'Čet', dd: '05', t: 'odmor', name: 'Odmor', km: null, core: '—', st: 'rest' },
    { dow: 'Pet', dd: '06', t: 'tempo', name: 'Tempo', km: 9.2, core: '3,7 km @ 4:17', st: 'next' },
    { dow: 'Sub', dd: '07', t: 'odmor', name: 'Odmor', km: null, core: '—', st: 'rest' },
    { dow: 'Ned', dd: '08', t: 'lr', name: 'Dugo trčanje', km: 12.3, core: '12,3 km @ 5:16', st: 'next' }
  ];
  const week7 = [
    { dow: 'Pon', dd: '09', t: 'lako', name: 'Lagano', km: 8.6, core: '8,6 km @ 5:08', st: 'next' },
    { dow: 'Uto', dd: '10', t: 'snaga', name: 'Snaga', km: null, core: 'Mobilnost + snaga', st: 'next' },
    { dow: 'Sre', dd: '11', t: 'int', name: 'Intervali', km: 8.8, core: '3 × 1000 m @ 4:00', st: 'next' },
    { dow: 'Čet', dd: '12', t: 'odmor', name: 'Odmor', km: null, core: '—', st: 'rest' },
    { dow: 'Pet', dd: '13', t: 'tempo', name: 'Tempo isprekidan', km: 9.0, core: '2 × 1600 m @ 4:16', st: 'next' },
    { dow: 'Sub', dd: '14', t: 'odmor', name: 'Odmor', km: null, core: '—', st: 'rest' },
    { dow: 'Ned', dd: '15', t: 'lr', name: 'Dugo trčanje', km: 13.0, core: '13 km @ 5:15', st: 'next' }
  ];

  /* Današnja sesija: sessions.fartlek iz generatora — wuKm 3, cdKm 2.5, reps 7, repSec 60, restSec 60, paceSec 240, easyPaceSec 309. */
  const session = {
    kind: 'Fartlek',
    km: 8.6,
    minutes: 42,
    rpe: '8–9',
    workPace: 240,
    easyPace: 309,
    reps: 7,
    repSec: 60,
    restSec: 60,
    wuKm: 3,
    cdKm: 2.5,
    wuSec: 927,
    cdSec: 773,
    hr: 'Z4–Z5 · 164–182 bpm',
    guide:
      'Vodi se po naporu, ne po štoperici — ubrzanja su snažan zalet, ne sprint. U lakim delovima se potpuno opusti.',
    focus: 'Fartlek + Tempo'
  };

  const vdot = {
    start: 48.1,
    now: 49.2,
    goal: 49.9,
    projected: 50.6,
    series: [
      ['02.10.', 48.1],
      ['09.10.', 48.2],
      ['16.10.', 48.5],
      ['23.10.', 48.7],
      ['30.10.', 49.0],
      ['03.11.', 49.2]
    ],
    test: { date: '25.10.', time: '11:45', vdot: 49.0, idx: 3.4 }
  };
  const trend = {
    easyPace: [332, 329, 327, 330, 324, 321],
    easyHr: [153, 152, 151, 152, 149, 148]
  };
  const pred = [
    { d: '3 km', t: '11:43', src: 'est' },
    { d: '5 km', t: '20:13', src: 'est', hero: true },
    { d: '10 km', t: '41:54', src: 'est' },
    { d: 'Pol.', t: '1:32:48', src: 'est' }
  ];
  const sum = {
    realKm: 148.0,
    planToDate: 153.5,
    totalKm: 367.6,
    keepPct: 96,
    wholePct: 40,
    runsDone: 18,
    runsTotal: 46,
    strongest: { w: 3, km: 35.6 },
    longest: 12.3
  };
  const race = { name: '5K', date: '20. dec', long: 'Nedelja, 20. decembra', daysTo: 46, goal: '19:59', goalSec: 1199, goalPace: '4:00', plan: '19:45' };
  return { phases, phaseOf, W, week6, week7, session, vdot, trend, pred, sum, race, today: { long: 'Sreda, 4. novembra', dow: 'SRE', dd: '4. nov', week: 6, weeks: 12 } };
})();
