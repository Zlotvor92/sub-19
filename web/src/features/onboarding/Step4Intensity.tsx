import type { Dispatch, SetStateAction } from 'react';
import { brojNedelja, distUReceni, fmtClock, fmtNum, pl3 } from '../../domain/format';
import {
  trimQualityDays,
  usesHours,
  type WizardState,
  type availableDays,
  type goalVerdict,
  type outlook
} from '../../domain/onboarding';
import type { Intensity } from '../../domain/training/types';
import { Chips, DaysChips, TimeFields } from './controls';

/* KORAK 4: kvalitet, tempo napretka, predviđanje na dan trke i upozorenja generatora (sve računa domen). */

export function Step4Intensity({
  w,
  set,
  setW,
  avail,
  out,
  verdict,
  warnings
}: {
  w: WizardState;
  set: (p: Partial<WizardState>) => void;
  setW: Dispatch<SetStateAction<WizardState>>;
  avail: ReturnType<typeof availableDays>;
  out: ReturnType<typeof outlook>;
  verdict: ReturnType<typeof goalVerdict> | null;
  warnings: string[] | null;
}) {
  return (
    <div className="ob-step active">
      <div className="ob-eyebrow">Korak 4 od 4</div>
      <h1 className="ob-h1">Koliko brzo da raste forma?</h1>
      <div className="ob-sub">
        Ovo određuje koliko se tempo pooštrava kroz nedelje — ne koliko ćeš trčati.
      </div>
      <div className="ob-card">
        <div className="ob-ct">Kvalitetnih treninga nedeljno</div>
        <Chips
          items={[
            [1, '1'],
            [2, '2']
          ]}
          value={w.quality}
          label="Kvalitetnih treninga nedeljno"
          onPick={(v) => set({ quality: v, qDays: trimQualityDays(w.qDays, v) })}
        />
        <div className="ob-hint">
          Na <b>3 dana trčanja ili manje</b> plan forsira 1 kvalitet — dva bi bila previše na tako
          mali obim.
        </div>
      </div>
      <div className="ob-card">
        <div className="ob-ct">Tempo napretka</div>
        {(
          [
            ['kons', 'Konzervativno', 'Postepen, oprezan rast forme.', 'Danielsova smernica'],
            [
              'std',
              'Standardno',
              'Uobičajen tempo napretka za trenirane trkače.',
              'Danielsova smernica'
            ],
            [
              'agr',
              'Agresivno',
              'Brz rast — realno uglavnom uz nizak trenažni staž ili paralelan gubitak telesne mase.',
              'Kalibrisano na jedan dokumentovan slučaj'
            ]
          ] as ReadonlyArray<readonly [Intensity, string, string, string]>
        ).map(([k, title, text, tag]) => (
          <button
            key={k}
            type="button"
            className={`ob-icard${w.intensity === k ? ' on' : ''}`}
            aria-pressed={w.intensity === k}
            onClick={() => set({ intensity: k })}
          >
            <div className="ob-ih">
              <b>{title}</b>
              <span className="ob-radio" />
            </div>
            <p>{text}</p>
            <span className="ob-tag">{tag}</span>
          </button>
        ))}
      </div>
      <div className="ob-card">
        <div className="ob-ct">
          Dani za kvalitet <span className="ob-opt">— prazno = automatski</span>
        </div>
        <DaysChips
          selected={w.qDays}
          label="Dani za kvalitet"
          disabled={(d) => !avail.quality(d)}
          onToggle={(d) =>
            setW((cur) => {
              if (d === cur.lrDow) return cur;
              const has = cur.qDays.includes(d);
              return {
                ...cur,
                qDays: has
                  ? cur.qDays.filter((x) => x !== d)
                  : trimQualityDays([...cur.qDays, d], cur.quality)
              };
            })
          }
        />
      </div>
      <div className="ob-card accent" id="ob-outlook">
        {!out ? (
          <>
            <div className="ob-ct">Predviđanje na dan trke</div>
            <div className="ob-hint">
              Unesi skorašnji rezultat i datum trke da bi se predviđanje izračunalo.
            </div>
          </>
        ) : out.short ? (
          <>
            <div className="ob-ct">Predviđanje na dan trke</div>
            <div className="ob-hint">
              {brojNedelja(out.weeks)} {pl3(out.weeks, 'je', 'su', 'je')} manje od minimuma za{' '}
              {distUReceni(out.name)} (<b>{out.minWeeks}</b>) — plan se ne može napraviti, pa ni
              predvideti.
            </div>
          </>
        ) : (
          <>
            <div className="ob-ct">
              Predviđanje na dan trke{' '}
              <span className="ob-opt">
                — {brojNedelja(out.weeks)}, {out.name}
              </span>
            </div>
            <div className="ob-preds">
              {out.rows.map((r) => (
                <div key={r.k} className={`ob-pred${r.k === w.intensity ? ' on' : ''}`}>
                  <i>{r.label}</i>
                  <b>{fmtClock(r.sec)}</b>
                  <s>
                    {out.goal != null
                      ? r.sec <= out.goal
                        ? 'stiže cilj'
                        : 'ne stiže'
                      : `VDOT ${fmtNum(r.vdot, 1)}`}
                  </s>
                </div>
              ))}
            </div>
            {verdict ? (
              <div className={`ob-verdict ${verdict.tone}`}>
                <b>{verdict.lead}</b>
                {verdict.rest}
              </div>
            ) : (
              <div className="ob-hint">
                Upiši ciljno vreme ispod pa ću ti reći koliko je realno.
              </div>
            )}
          </>
        )}
      </div>
      {warnings !== null ? (
        <div className="ob-card" id="ob-warn" aria-live="polite">
          <div className="gw-h">Na šta da paziš</div>
          {warnings.length ? (
            warnings.map((t) => (
              <div className="gw" key={t}>
                <p>{t}</p>
              </div>
            ))
          ) : (
            <div className="gw-ok">
              Nema zamerki — traženi obim staje u izabrane dane, a raspored poštuje hard/easy
              princip.
            </div>
          )}
        </div>
      ) : null}
      <div className="ob-card">
        <div className="ob-ct">
          Ciljno vreme <span className="ob-opt">— opciono</span>
        </div>
        <TimeFields
          prefix="goal"
          hours={usesHours(w.raceDist)}
          values={{ h: w.goalH, min: w.goalMin, sec: w.goalSec }}
          onChange={(f, v) =>
            set(f === 'h' ? { goalH: v } : f === 'min' ? { goalMin: v } : { goalSec: v })
          }
        />
        <div className="ob-hint">
          Ostavi prazno i plan koristi predviđanje iz tvoje forme. Upiši vreme ako imaš konkretan
          cilj — reći ću koliko je realan.
        </div>
      </div>
    </div>
  );
}
