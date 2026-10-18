/* DEMO STANJE ZA SNIMKE EKRANA — van koda aplikacije. Polazi od docs/reel/demo-state.json (oblik stanja SCHEMA 11),
   menja plan za plan iz PRAVOG generatora (gen-plan.mjs, PB 20:25 → cilj 19:59) i dodaje jednu trku van plana sa
   kilometarskim prolazima iz Strava best efforta (24. 9. 2026: 4:02 · 4:00 · 4:02 · 4:12 · 4:09).
   Bez izmišljenog napretka: vdotLog i pred ostaju prazni (forma = polazna iz rezultata). Bez tokena, emaila, Strava ID-jeva. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const TODAY = '2026-11-04';
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function demoState({ tired = true } = {}) {
  const s = JSON.parse(readFileSync(join(HERE, '../../../../docs/reel/demo-state.json'), 'utf8'));
  s.genPlan = JSON.parse(readFileSync(join(HERE, '../genplan.json'), 'utf8'));
  s.log = {}; s.pred = {}; s.predLock = {}; s.alts = {}; s.moves = {}; s.vdotLog = [];
  const paceFor = { lako: 316, lr: 322, tempo: 263, int: 262, rw: 340 };
  let n = 0;
  for (const w of s.genPlan.weeks) for (const d of w.days) {
    const date = addDays(w.start, d.dow);
    if (d.rest || d.km == null || !d.id || date >= TODAY) continue;
    n++;
    if (n % 11 === 0) { s.log[d.id] = { status: 'skip' }; continue; }
    const p = (paceFor[d.tag] || 320) + ((n * 7) % 9) - 3;
    s.log[d.id] = { status: 'done', km: d.km, sec: Math.round(d.km * p), hr: 148 + (n % 14), runDate: date, ts: date };
  }
  /* trka van plana: prosek iz Strava aktivnosti (5,12 km za 20:53 kretanja), prolazi po kilometru iz krugova */
  const RACE_DATE = '2026-09-24';
  const perKm = [
    { km: 1, paceSec: 242, hr: 161, elevM: 0, stopSec: 0 },
    { km: 2, paceSec: 240, hr: 178, elevM: 0, stopSec: 0 },
    { km: 3, paceSec: 242, hr: 182, elevM: 0, stopSec: 0 },
    { km: 4, paceSec: 252, hr: 181, elevM: 3, stopSec: 0 },
    { km: 5, paceSec: 249, hr: 185, elevM: 1, stopSec: 0 },
    { km: 6, paceSec: 232, hr: 185, elevM: 0, stopSec: 0, partial: true, distanceM: 117 }
  ];
  s.log['race-2026-09-24-demo'] = {
    status: 'done', km: 5.12, sec: 1253, hr: 178, runDate: RACE_DATE, ts: RACE_DATE, stravaName: '5K trka',
    raceAi: { context: { name: '5K trka', date: RACE_DATE, distanceM: 5000, officialSec: null, targetSec: 1199, intent: 'race', nutrition: '', conditions: '' } },
    raceDetails: { version: 2, date: RACE_DATE, source: 'strava', km: 5.12, movingSec: 1253, elapsedSec: 1253, hr: 178, maxHr: 187, perKm, providers: ['strava'] }
  };
  s.kg = [{ date: '2026-10-02', kg: 71.4 }, { date: '2026-10-20', kg: 70.6 }, { date: '2026-11-02', kg: 70.1 }];
  s.ui.firstRun = '2026-09-28';
  /* jutros: HRV ispod osnove, kratak san — da ekran Oporavak ima šta da kaže */
  s.wellness = {};
  for (let i = 10; i >= 0; i--) {
    const d = addDays(TODAY, -i);
    s.wellness[d] = { datum: d, hrv: i === 0 && tired ? 49 : 60 + (i % 3), pulsUMiru: i === 0 && tired ? 52 : 46, sanH: i === 0 && tired ? 5.6 : 7.3, sanOcena: 61, tezina: null, ctl: 42, atl: tired ? 55 : 38, svezina: tired ? (i === 0 ? -13 : -2) : 4 };
  }
  return s;
}
