import { brojNedelja, fmtDayMonthYear } from '../../domain/format';
import { diffDays, type IsoDate } from '../../domain/date';
import {
  TEN_K_V2_RESULT_DISTS,
  tenKV2NeedsEasyPace,
  tenKV2PlanStart,
  tenKV2ResultDateMessage,
  tenKV2ResultHasHours,
  tenKV2ResultStale,
  type TenKV2Wizard
} from '../../domain/onboarding/tenKV2';
import type { PlanRejectionReason } from '../../domain/generators/contract';
import { Notice } from '../../components/ui/primitives';
import { Chips, DOW, DaysChips, TimeFields } from './controls';

/* ČAROBNJAK 10K v2 (prekidač uključen, ciljna distanca 10K): koraci 2–4 sa poljima koja v2 traži. Pravila proverava v2 pri
   izradi; odbijanje se prikazuje kao poruka sa razlozima v2 doslovno (ne kao greška). Korak 1 (trka) je zajednički. */

type Set = (p: Partial<TenKV2Wizard>) => void;

/** Razlozi odbijanja v2 doslovno (role=status); plan se ne pravi. */
function Rejection({ reasons }: { reasons: readonly PlanRejectionReason[] | null }) {
  if (!reasons?.length) return null;
  return (
    <Notice tone="info" role="status" title="Plan nije napravljen">
      <ul className="ob-reasons">
        {reasons.map((r) => (
          <li key={r.code + r.message}>{r.message}</li>
        ))}
      </ul>
      Izmeni unos i pokušaj ponovo.
    </Notice>
  );
}

/** Napomena pod datumom trke: koliko celih nedelja plan ima i od kog dana kreće. */
export function TenKV2RaceHint({ raceDate, today }: { raceDate: string; today: string }) {
  const start = tenKV2PlanStart(raceDate, today);
  if (!raceDate || !start) return null;
  const weeks = (diffDays(start as IsoDate, raceDate as IsoDate) + 1) / 7;
  return (
    <div className="ob-hint" id="ob-v2-weeks" aria-live="polite">
      Plan 10K v2: <b>{brojNedelja(weeks)}</b>, od {fmtDayMonthYear(start)} do dana trke (cele
      nedelje koje se završavaju trkom). Ako trajanje nije podržano, plan kaže zašto.
    </div>
  );
}

export function TenKV2Result({
  v,
  set,
  raceDate,
  today
}: {
  v: TenKV2Wizard;
  set: Set;
  raceDate: string;
  today: string;
}) {
  const dateMsg = tenKV2ResultDateMessage(v, today);
  const stale = v.hasResult === true && tenKV2ResultStale(v, raceDate, today);
  const needsEasy = tenKV2NeedsEasyPace(v, raceDate, today);
  return (
    <div className="ob-step active">
      <div className="ob-eyebrow">Korak 2 od 4</div>
      <h1 className="ob-h1">Imaš li skoriji rezultat?</h1>
      <div className="ob-sub">
        Rezultat iz poslednjih 12 nedelja daje tempo svakog treninga. Bez njega plan ide po osećaju:
        lagano iz tvog uobičajenog laganog tempa, kvalitet po naporu (RPE), uz test 5 km.
      </div>
      <div className="ob-card">
        <Chips
          items={[
            ['yes', 'Imam rezultat'],
            ['no', 'Nemam skoriji rezultat']
          ]}
          value={v.hasResult === null ? null : v.hasResult ? 'yes' : 'no'}
          label="Skoriji rezultat"
          onPick={(x) => set({ hasResult: x === 'yes' })}
        />
      </div>
      {v.hasResult ? (
        <>
          <div className="ob-card">
            <div className="ob-ct">Distanca</div>
            <Chips
              items={TEN_K_V2_RESULT_DISTS}
              value={v.resultDist}
              label="Distanca rezultata"
              onPick={(d) => set({ resultDist: d })}
            />
          </div>
          <div className="ob-card">
            <div className="ob-ct">Vreme</div>
            <TimeFields
              prefix="v2res"
              hours={tenKV2ResultHasHours(v)}
              values={{ h: v.resH, min: v.resMin, sec: v.resSec }}
              onChange={(f, x) =>
                set(f === 'h' ? { resH: x } : f === 'min' ? { resMin: x } : { resSec: x })
              }
            />
          </div>
          <div className="ob-card">
            <label className="ob-ct" htmlFor="v2-res-date">
              Datum rezultata
            </label>
            <input
              id="v2-res-date"
              type="date"
              max={today}
              value={v.resDate}
              onChange={(e) => set({ resDate: e.target.value })}
            />
            {stale ? (
              <div className="ob-hint">
                Rezultat je stariji od 12 nedelja: plan ide po osećaju, a rezultat se samo
                prikazuje.
              </div>
            ) : null}
          </div>
        </>
      ) : null}
      {needsEasy ? (
        <div className="ob-card">
          <div className="ob-ct">Uobičajen lagan tempo (min/km)</div>
          <div aria-label="Lagan tempo" role="group">
            <TimeFields
              prefix="v2easy"
              hours={false}
              values={{ h: '', min: v.easyMin, sec: v.easySec }}
              onChange={(f, x) =>
                set(f === 'min' ? { easyMin: x } : f === 'sec' ? { easySec: x } : {})
              }
            />
          </div>
          <div className="ob-hint">
            Tempo kojim lagano trčiš i možeš da pričaš u punim rečenicama.
          </div>
        </div>
      ) : null}
      {dateMsg ? (
        <Notice tone="warn" role="alert" title="Proveri datum">
          {dateMsg}
        </Notice>
      ) : null}
    </div>
  );
}

export function TenKV2Experience({
  v,
  set,
  runWalkRejection
}: {
  v: TenKV2Wizard;
  set: Set;
  /** Odbijanje v2 za trčanje/hodanje (D29), doslovno; `null` kad nije izabrano. */
  runWalkRejection: readonly PlanRejectionReason[] | null;
}) {
  return (
    <div className="ob-step active">
      <div className="ob-eyebrow">Korak 3 od 4</div>
      <h1 className="ob-h1">Koliko i kako trčiš?</h1>
      <div className="ob-sub">Plan polazi od onoga što sada stvarno trčiš.</div>
      <div className="ob-card">
        <div className="ob-ct">Možeš li da trčiš 30 minuta bez prekida?</div>
        <Chips
          items={[
            ['yes', 'Da'],
            ['no', 'Ne još']
          ]}
          value={v.canRun30 === null ? null : v.canRun30 ? 'yes' : 'no'}
          label="30 minuta bez prekida"
          onPick={(x) => set({ canRun30: x === 'yes' })}
        />
      </div>
      <Rejection reasons={runWalkRejection} />
      {v.canRun30 !== false ? (
        <>
          <div className="ob-card">
            <div className="ob-ct">Nedeljna kilometraža</div>
            <input
              type="number"
              id="in-v2-weeklyKm"
              aria-label="Nedeljna kilometraža"
              placeholder="npr. 30"
              min={0}
              max={120}
              inputMode="numeric"
              value={v.weeklyKm}
              onChange={(e) => set({ weeklyKm: e.target.value })}
            />
            <div className="ob-hint">Prosek poslednje 4 nedelje.</div>
          </div>
          <div className="ob-card">
            <div className="ob-ct">Iskustvo</div>
            <Chips
              items={[
                ['beginner', 'Početnik'],
                ['regular', 'Trčim redovno']
              ]}
              value={v.experience}
              label="Iskustvo"
              onPick={(x) => set({ experience: x })}
            />
            <div className="ob-hint">Početnik: trčiš redovno kraće od 6 meseci.</div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function TenKV2Days({
  v,
  set,
  rejection
}: {
  v: TenKV2Wizard;
  set: Set;
  rejection: readonly PlanRejectionReason[] | null;
}) {
  const days = [...v.runDows].sort((a, b) => a - b);
  return (
    <div className="ob-step active">
      <div className="ob-eyebrow">Korak 4 od 4</div>
      <h1 className="ob-h1">Kojim danima trčiš?</h1>
      <div className="ob-sub">
        Izaberi 3–6 dana (početnik 3–4). Plan sam bira dane kvaliteta; dan dugog trčanja možeš da
        izabereš.
      </div>
      <div className="ob-card">
        <div className="ob-ct">Dani trčanja</div>
        <DaysChips
          selected={v.runDows}
          label="Dani trčanja"
          onToggle={(d) => {
            const runDows = v.runDows.includes(d)
              ? v.runDows.filter((x) => x !== d)
              : [...v.runDows, d];
            set({
              runDows,
              longDow: v.longDow != null && runDows.includes(v.longDow) ? v.longDow : null
            });
          }}
        />
      </div>
      {days.length ? (
        <div className="ob-card">
          <div className="ob-ct">
            Dan dugog trčanja <span className="ob-opt">— opciono</span>
          </div>
          <Chips
            items={[[0, 'Plan bira'], ...days.map((d) => [d, DOW[d - 1]!] as const)]}
            value={v.longDow ?? 0}
            label="Dan dugog trčanja"
            onPick={(d) => set({ longDow: d === 0 ? null : d })}
          />
        </div>
      ) : null}
      <div className="ob-card">
        <div className="ob-ct">
          Ciljno vreme <span className="ob-opt">— opciono</span>
        </div>
        <TimeFields
          prefix="v2goal"
          hours={false}
          values={{ h: '', min: v.goalMin, sec: v.goalSec }}
          onChange={(f, x) => set(f === 'min' ? { goalMin: x } : f === 'sec' ? { goalSec: x } : {})}
        />
        <div className="ob-hint">
          Cilj se samo procenjuje; tempo treninga ostaje prema rezultatu ili naporu.
        </div>
      </div>
      <Rejection reasons={rejection} />
    </div>
  );
}
