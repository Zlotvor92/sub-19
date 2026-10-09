import { fmtClock, fmtNum } from '../../domain/format';
import { usesHours, type WizardState, type formPreview } from '../../domain/onboarding';
import { Notice } from '../../components/ui/primitives';
import { Chips, PB_DISTS, TimeFields } from './controls';

/* KORAK 2: poslednji rezultat. VDOT i tempa se računaju u domenu (`formPreview`); „Dalje“ je zaključano dok unos nije moguć, a razlog stoji na ekranu. */

export function Step2Result({
  w,
  set,
  form,
  pbMsg
}: {
  w: WizardState;
  set: (p: Partial<WizardState>) => void;
  form: ReturnType<typeof formPreview>;
  pbMsg: string | null;
}) {
  return (
    <div className="ob-step active">
      <div className="ob-eyebrow">Korak 2 od 4</div>
      <h1 className="ob-h1">Šta si poslednje istrčao?</h1>
      <div className="ob-sub">
        Bilo koja skorija trka na poznatoj distanci. Iz ovog jednog rezultata računa se svaki ciljni
        tempo u planu.
      </div>
      <div className="ob-card">
        <div className="ob-ct">Distanca</div>
        <Chips
          items={PB_DISTS}
          value={w.pbDist}
          label="Distanca rezultata"
          onPick={(v) => {
            const long = usesHours(v);
            /* sa duge na kratku distancu sati se slivaju u minute */
            if (!long && w.pbH !== '') {
              const folded = (+w.pbH || 0) * 60 + (+w.pbMin || 0);
              set({
                pbDist: v,
                pbH: '',
                ...(folded > 0 && folded <= 99 ? { pbMin: String(folded) } : {})
              });
            } else set({ pbDist: v });
          }}
        />
      </div>
      <div className="ob-card">
        <div className="ob-ct">Vreme</div>
        <TimeFields
          prefix="pb"
          hours={usesHours(w.pbDist)}
          values={{ h: w.pbH, min: w.pbMin, sec: w.pbSec }}
          onChange={(f, v) =>
            set(f === 'h' ? { pbH: v } : f === 'min' ? { pbMin: v } : { pbSec: v })
          }
        />
      </div>
      {form ? (
        <div className="ob-card accent" id="vdotWrap">
          <div className="ob-ct">Tvoja forma</div>
          <div className="ob-vrow">
            <svg className="ob-vring" viewBox="0 0 64 64" aria-hidden="true">
              <circle className="ob-vtrack" cx="32" cy="32" r="27" />
              <circle
                className="ob-vval"
                cx="32"
                cy="32"
                r="27"
                strokeDasharray="169.6"
                strokeDashoffset={169.6 * (1 - form.fraction)}
              />
            </svg>
            <div>
              <div className="ob-vnum">{fmtNum(form.vdot, 1)}</div>
              <div className="ob-vlbl">
                VDOT — jedan broj iz kog se računa <b>svaki</b> tempo u planu.
              </div>
            </div>
          </div>
          <div className="ob-vpaces">
            {form.paces.map((p) => (
              <div className="ob-vp" key={p.label}>
                <i>{p.label}</i>
                <b>{fmtClock(p.sec)}</b>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {pbMsg ? (
        /* RECI ZAŠTO: „Dalje" je zaključano, a razlog se ranije nigde nije video (mrtvo dugme bez ijedne reči). */
        <Notice tone="warn" role="alert" title="Proveri uneto vreme">
          {pbMsg}
        </Notice>
      ) : null}
    </div>
  );
}
