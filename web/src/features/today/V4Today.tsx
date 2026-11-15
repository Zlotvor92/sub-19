import { useState } from 'react';
import { getApp } from '../../app/appContext';
import { Disclosure } from '../../components/ui/Disclosure';
import { Notice } from '../../components/ui/primitives';
import type { Change, PlanEvent } from '../../domain/v4/engine';
import {
  acceptReport,
  liveState,
  otisakOf,
  previewReport,
  shortDate,
  type Report
} from '../../integrations/v4';
import { useTrainingStore, useV4Doc } from '../../stores';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useV4Store } from '../../stores/v4Store';
import { useV4Live } from '../v4/useV4Live';

/* F9 korak 8 · DANAS POD V4 (F8 § 4, odluke § 9.1):
   - traka „Plan je promenjen — zašto": promene koje je V4 SAM primenio (forma iz trčanja, propušten trening, pauza);
   - „Nešto se desilo?": bolest, put, bol, umor → pregled promena → „Primeni" / „Ne menjaj plan" (odbijeno se pamti u
     `plan_v4_dogadjaj` i ne nudi ponovo). Bez potvrde plan se ne menja. Samo kad se prikazuje plan iz V4. */

const plusDays = (d: string, n: number): string => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

type Step =
  | { s: 'zatvoreno' }
  | { s: 'izbor' }
  | { s: 'koliko'; reason: 'bolest' | 'put' }
  | { s: 'bol' }
  | { s: 'pregled'; event: PlanEvent; changes: Change[]; title: string };

function ChangeList({ changes }: { changes: readonly Change[] }) {
  const shown = changes.slice(0, 8);
  return (
    <>
      {shown.map((c, i) => (
        <p className="note-src" key={`${c.eventId}:${c.dayId ?? c.weekIndex ?? ''}:${i}`}>
          {c.reason}
          {c.before !== c.after && c.before !== '' ? ` (${c.before} → ${c.after})` : ''}
          {c.until ? ` · do ${shortDate(c.until)}` : ''}
        </p>
      ))}
      {changes.length > shown.length ? (
        <p className="note-src">… još {changes.length - shown.length} promena</p>
      ) : null}
    </>
  );
}

export function V4Today() {
  const doc = useV4Doc();
  const live = useV4Live();
  const today = useV4Store((s) => s.today);
  const applied = useV4Store((s) => s.changes);
  const rejected = useV4Store((s) => s.rejected);
  const [step, setStep] = useState<Step>({ s: 'zatvoreno' });
  const [err, setErr] = useState('');
  if (doc === null || live === null || today === null) return null;

  const review = (report: Report, title: string): void => {
    setErr('');
    const p = previewReport(doc, live, report, today);
    if (rejected.includes(p.event.id)) {
      setErr('Ovu promenu si već odbio — plan ostaje kakav je.');
      setStep({ s: 'zatvoreno' });
      return;
    }
    setStep({ s: 'pregled', event: p.event, changes: p.result.changes, title });
  };

  const apply = async (event: PlanEvent): Promise<void> => {
    const v4 = getApp().v4;
    if (v4 === null) return;
    const log = useTrainingStore.getState().log;
    const knee = useRecoveryStore.getState().knee;
    const runs = useV4Store.getState().runs;
    let changes: Change[] = [];
    const ok = await v4.commit(
      (cur) => {
        const base = cur ?? doc;
        const l = liveState({ doc: base, today, runs, log, knee });
        if (l === null) return null;
        const r = acceptReport(base, l, { rejected }, event);
        if (r.changes.length === 0) return null;
        changes = r.changes;
        return { doc: r.doc, otisak: otisakOf(r.doc, today) };
      },
      () => (changes.length > 0 ? [event] : [])
    );
    if (!ok) return setErr('Promena nije sačuvana — nema veze sa serverom. Pokušaj ponovo.');
    if (changes.length > 0) useV4Store.getState().set({ changes });
    setStep({ s: 'zatvoreno' });
  };

  const decline = async (event: PlanEvent): Promise<void> => {
    const v4 = getApp().v4;
    if (v4 === null) return;
    const row = useV4Store.getState().row;
    const r = await v4.events
      .append([{ event, vrsta: 'odbijeno', revPlana: row?.rev ?? null }], v4.deviceId())
      .catch(() => ({ ok: false as const }));
    if (!r.ok) return setErr('Odluka nije sačuvana — nema veze sa serverom. Pokušaj ponovo.');
    useV4Store.getState().set({ rejected: [...rejected, event.id] });
    setStep({ s: 'zatvoreno' });
  };

  return (
    <>
      {applied.length > 0 ? (
        <Notice title="Plan je promenjen — zašto" id="v4-changes">
          <Disclosure title="Promene" meta={String(applied.length)}>
            <ChangeList changes={applied} />
          </Disclosure>
        </Notice>
      ) : null}
      {err ? (
        <div role="alert" className="note-src err">
          {err}
        </div>
      ) : null}
      {step.s === 'zatvoreno' ? (
        <Notice
          title="Nešto se desilo?"
          id="v4-report"
          actions={[{ label: 'Prijavi', onClick: () => setStep({ s: 'izbor' }) }]}
        >
          Bolest, put, bol ili umor — plan se menja tek kad potvrdiš.
        </Notice>
      ) : null}
      {step.s === 'izbor' ? (
        <div className="btnrow" role="group" aria-label="Šta se desilo">
          <button
            type="button"
            className="btn ghost"
            onClick={() => setStep({ s: 'koliko', reason: 'bolest' })}
          >
            Bolestan sam
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setStep({ s: 'koliko', reason: 'put' })}
          >
            Na putu sam
          </button>
          <button type="button" className="btn ghost" onClick={() => setStep({ s: 'bol' })}>
            Boli me
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => review({ kind: 'fatigue' }, 'Umor')}
          >
            Umoran sam
          </button>
        </div>
      ) : null}
      {step.s === 'koliko' ? (
        <div className="btnrow" role="group" aria-label="Koliko">
          {(
            [
              ['2 dana', 2],
              ['nedelju', 7],
              ['ne znam', 7]
            ] as const
          ).map(([label, n]) => (
            <button
              type="button"
              key={label}
              className="btn ghost"
              onClick={() =>
                review(
                  { kind: 'pause', from: today, to: plusDays(today, n - 1), reason: step.reason },
                  step.reason === 'bolest'
                    ? `Bolest od ${shortDate(today)}`
                    : `Put od ${shortDate(today)}`
                )
              }
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {step.s === 'bol' ? (
        <div className="btnrow" role="group" aria-label="Koliko boli">
          {(
            [
              ['blago', 3],
              ['srednje', 5],
              ['jako', 7]
            ] as const
          ).map(([label, level]) => (
            <button
              type="button"
              key={label}
              className="btn ghost"
              onClick={() => review({ kind: 'pain', level }, `Bol (${label})`)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {step.s === 'pregled' ? (
        <Notice tone="warn" title={`${step.title}: pregled promena`} id="v4-preview">
          {step.changes.length > 0 ? (
            <ChangeList changes={step.changes} />
          ) : (
            <p className="note-src">Plan se ne bi promenio.</p>
          )}
          <div className="btnrow">
            <button type="button" className="btn" onClick={() => void apply(step.event)}>
              Primeni
            </button>
            <button type="button" className="btn ghost" onClick={() => void decline(step.event)}>
              Ne menjaj plan
            </button>
          </div>
        </Notice>
      ) : null}
    </>
  );
}
