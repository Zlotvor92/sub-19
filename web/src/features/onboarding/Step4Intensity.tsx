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

const VOLUME_RAMPS: ReadonlyArray<readonly [Intensity, string]> = [
  ['kons', 'Konzervativno'],
  ['std', 'Standardno'],
  ['agr', 'Agresivno']
];
const VOLUME_HINT: Readonly<Record<Intensity, string>> = {
  kons: 'Najmanji nedeljni skokovi kilometraže — najmanji rizik od preopterećenja.',
  std: 'Uobičajeni nedeljni skokovi kilometraže.',
  agr: 'Najveći nedeljni skokovi kilometraže — brže do vrhunca, ali veći rizik od preopterećenja.'
};

/* KORAK 4: kvalitet, rast obima, referenca trenutne forme i upozorenja. */

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
      <h1 className="ob-h1">Kako da izgleda priprema?</h1>
      <div className="ob-sub">
        Izaberi kvalitetne dane i rast obima. Tempa treninga polaze od trenutne forme; željeno vreme
        trke ne ubrzava ih automatski.
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
        <div className="ob-ct">Težina kvalitetnog rada</div>
        <Chips
          items={VOLUME_RAMPS}
          value={w.intensity}
          label="Težina kvalitetnog rada"
          onPick={(v) => set({ intensity: v })}
        />
        <div className="ob-hint">
          Menja količinu bržeg rada i zahtevne završetke dužine. Tempa ostaju ista; rast kilometraže
          biraš odvojeno.
        </div>
      </div>
      <div className="ob-card">
        <div className="ob-ct">Tempo rasta obima</div>
        <Chips
          items={VOLUME_RAMPS}
          value={w.volIntensity}
          label="Tempo rasta obima"
          onPick={(v) => set({ volIntensity: v })}
        />
        <div className="ob-hint">
          {VOLUME_HINT[w.volIntensity]} Ovo menja koliko se nedeljno povećava kilometraža do vrhunca
          plana.
        </div>
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
            <div className="ob-ct">Referentno vreme prema trenutnoj formi</div>
            <div className="ob-hint">
              Unesi skorašnji rezultat i datum trke da bi se referenca izračunala.
            </div>
          </>
        ) : out.short ? (
          <>
            <div className="ob-ct">Referentno vreme prema trenutnoj formi</div>
            <div className="ob-hint">
              {brojNedelja(out.weeks)} {pl3(out.weeks, 'je', 'su', 'je')} manje od minimuma za{' '}
              {distUReceni(out.name)} (<b>{out.minWeeks}</b>) — plan se ne može napraviti.
            </div>
          </>
        ) : (
          <>
            <div className="ob-ct">
              Referentno vreme prema trenutnoj formi{' '}
              <span className="ob-opt">
                — {brojNedelja(out.weeks)}, {out.name}
              </span>
            </div>
            <div className="ob-preds">
              {out.rows.slice(0, 1).map((r) => (
                <div key={r.k} className="ob-pred on">
                  <i>Trenutna forma</i>
                  <b>{fmtClock(r.sec)}</b>
                  <s>VDOT {fmtNum(r.vdot, 1)}</s>
                </div>
              ))}
            </div>
            <div className="ob-hint">
              Ovo je ekvivalent skorašnjeg rezultata, a ne prognoza napretka do trke. Za duže
              distance potrebna je i odgovarajuća izdržljivost, koju ova brojka ne potvrđuje.
            </div>
            {verdict ? (
              <div className={`ob-verdict ${verdict.tone}`}>
                <b>{verdict.lead}</b>
                {verdict.rest}
              </div>
            ) : (
              <div className="ob-hint">
                Upiši ciljno vreme ispod da ga uporediš sa trenutnom formom.
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
          Ostavi prazno i plan koristi referencu trenutne forme. Upiši vreme ako imaš konkretan cilj
          — on ostaje želja, a tempa treninga ostaju vezana za potvrđenu formu.
        </div>
      </div>
    </div>
  );
}
