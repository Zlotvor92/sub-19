import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, type IsoDate } from '../date';
import {
  ANNOUNCEMENT,
  announcementToShow,
  backupDue,
  dataCounts,
  groupForSection,
  settingsHero,
  waitingText
} from './index';

/* parity: backupDue, podesavanjaStanje, grupaZaSekciju, brojevi u openSettings (app.js). */

let legacy: LegacyApp;
beforeAll(async () => {
  legacy = await loadLegacyApp('2026-03-01T09:00:00Z');
});

describe('podešavanja naspram starog koda', () => {
  it('backupDue: svi slučajevi (prijavljen, bez datuma, odlaganje, granica od 7 dana)', () => {
    const today = '2026-03-01' as IsoDate;
    const dates = [null, '', '2026-02-20', '2026-02-22', '2026-02-23', '2026-03-01', 'x'];
    const snoozes = [null, '2026-03-05', '2026-03-01', '2026-02-01'];
    for (const last of dates)
      for (const first of dates)
        for (const snooze of snoozes) {
          legacy.evalIn(
            `S.ui.lastBackup=${JSON.stringify(last)}; S.ui.firstRun=${JSON.stringify(first)}; S.ui.snooze=${JSON.stringify(snooze)}; 0`
          );
          // nije prijavljen u oraklu
          const old = legacy.evalIn(`backupDue(${JSON.stringify(today)})`);
          const mine = backupDue(today, { lastBackup: last, firstRun: first, snooze }, false);
          if (last === 'x' || (!last && first === 'x')) continue; // nevažeći datum: stari kod poredi niske, ovde je odbijen (nije backup bez datuma)
          expect(mine, `${String(last)}|${String(first)}|${String(snooze)}`).toBe(old);
        }
    expect(backupDue(today, { lastBackup: '2025-01-01' }, true)).toBe(false);
    expect(addDays(today, 0)).toBe(today);
  });

  it('grupe: sekcija → grupa isto kao grupaZaSekciju', () => {
    for (const n of [
      'Nalog',
      'Podaci',
      'Plan',
      'Vreme',
      'Strava',
      'intervals.icu',
      'Slanje na sat',
      'Obaveštenja',
      'Zajednica',
      'Korisnici',
      'Nepoznata'
    ])
      expect(groupForSection(n), n).toBe(legacy.evalIn(`grupaZaSekciju(${JSON.stringify(n)})`));
  });

  it('hero: redosled i tekstovi stavki; brojanje', () => {
    const h = settingsHero({
      accountConfigured: true,
      signedIn: false,
      stravaConnected: false,
      icuConnected: true,
      watchPushed: false,
      backupOk: false,
      hasBackupDate: false
    });
    expect(h.items.map((i) => i.key)).toEqual(['nalog', 'strava', 'icu', 'sat', 'backup']);
    expect(h.first?.key).toBe('nalog');
    expect(h.waiting).toHaveLength(4);
    const ok = settingsHero({
      accountConfigured: false,
      signedIn: false,
      stravaConnected: true,
      icuConnected: false,
      watchPushed: false,
      backupOk: true,
      hasBackupDate: true
    });
    expect(ok.items.map((i) => i.key)).toEqual(['strava', 'icu', 'backup']);
    expect(ok.first?.key).toBe('icu');
    expect([1, 2, 3, 4, 5].map(waitingText)).toEqual([
      'Jedna stvar čeka',
      'Dve stvari čekaju',
      'Tri stvari čekaju',
      'Četiri stvari čekaju',
      'Pet stvari čeka'
    ]);
    expect(dataCounts({ workouts: 21, pain: 2, weight: 5, paces: 1 })).toBe(
      '21 trening · 2 zapisa o bolu · 5 merenja mase · 1 tempo radnog dela'
    );
  });

  it('objava „novo": ista pravila (neprijavljen, već viđeno, novi korisnik) i isti tekst', () => {
    const nov = legacy.evalIn('NOVOST') as {
      kljuc: string;
      od: string;
      naslov: string;
      tekst: string;
      dugme: string;
    };
    expect(ANNOUNCEMENT).toEqual({
      key: nov.kljuc,
      from: nov.od,
      title: nov.naslov,
      text: nov.tekst,
      button: nov.dugme
    });
    for (const authed of [true, false])
      for (const novo of [null, undefined, 'zajednica', 'nesto drugo'])
        for (const firstRun of [null, '', '2026-01-01', '2026-08-07', '2026-08-08', '2026-09-01']) {
          (legacy as unknown as { ctx: Record<string, unknown> }).ctx['__a'] = authed;
          (legacy as unknown as { ctx: Record<string, unknown> }).ctx['__u'] = {
            novo: novo ?? null,
            firstRun
          };
          legacy.evalIn('sbAuthed=function(){return __a}; S.ui=Object.assign({}, S.ui, __u); 0');
          const old = legacy.evalIn('novostZaPrikaz()');
          const mine = announcementToShow(ANNOUNCEMENT, authed, { novo, firstRun });
          expect(!!mine, `${authed} ${String(novo)} ${firstRun}`).toBe(!!old);
        }
    expect(announcementToShow(null, true, {})).toBeNull();
  });
});
