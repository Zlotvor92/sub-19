import { useRef, useState } from 'react';
import {
  ALT_HOLD_MS,
  ALT_TYPES,
  RACE_DISTANCES,
  chooseRaceKm,
  chooseType,
  holdType,
  initialAltDraft,
  paceFromDraftDesc,
  type AltDraft
} from '../../domain/plan';
import { fmtClock, parseTimeStr } from '../../domain/format';
import { confirmAction } from '../../app/confirm';
import { useResolvedPlan, useTrainingStore } from '../../stores';
import { predRowsForDay, storedRows } from '../../stores/dayActions';
import { useUIStore } from '../../stores/uiStore';
import { dowShort, fmtDayMonthYear } from '../../domain/format';
import { STRENGTH_WITH } from '../../domain/state';

function TypeButton({
  tag,
  label,
  on,
  onPick,
  onHold
}: {
  tag: string;
  label: string;
  on: boolean;
  onPick: (tag: string) => void;
  onHold: (tag: string) => boolean;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const release = (): void => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <button
      type="button"
      className={on ? 'on' : ''}
      aria-pressed={on}
      onPointerDown={() => {
        held.current = false;
        release();
        timer.current = setTimeout(() => {
          timer.current = null;
          if (onHold(tag)) held.current = true;
        }, ALT_HOLD_MS);
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (held.current) {
          held.current = false; // dugo držanje je već odradilo svoje
          return;
        }
        onPick(tag);
      }}
    >
      {label}
    </button>
  );
}

/* IZMENA TRENINGA (tip / km / opis / ciljni tempo). Plan se ne menja — ovo je izmena samo za ovaj dan i uvek se vraća. */
export function AltSheet({ id }: { id: string }) {
  const plan = useResolvedPlan();
  const day = plan?.byId.get(id);
  const existing = useTrainingStore((s) => s.alts[id]);
  const setAlt = useTrainingStore((s) => s.setAlt);
  const clearAlt = useTrainingStore((s) => s.clearAlt);
  const closeSheet = useUIStore((s) => s.closeSheet);
  const [draft, setDraft] = useState<AltDraft | null>(null);
  const [paceText, setPaceText] = useState<string | null>(null);
  const [err, setErr] = useState('');

  if (!plan || !day) return null;
  const cur: AltDraft =
    draft ?? initialAltDraft(day, existing, predRowsForDay(plan, day, storedRows())[0]?.pt ?? null);
  const set = (d: AltDraft): void => {
    setDraft(d);
    setPaceText(null);
  };
  const originalDesc = day.origin.desc;
  const isSelected = (t: string): boolean =>
    cur.tag === t || (t === 'snaga' && cur.snaga && STRENGTH_WITH.has(cur.tag));
  const quality = cur.tag === 'int' || cur.tag === 'tempo';
  const typeRow = (items: typeof ALT_TYPES) => (
    <div className="seg" style={{ marginTop: 6 }}>
      {items.map(([t, label]) => (
        <TypeButton
          key={t}
          tag={t}
          label={label}
          on={isSelected(t)}
          onPick={(tag) => {
            setErr('');
            set(chooseType(cur, tag, originalDesc));
          }}
          onHold={(tag) => {
            const next = holdType(cur, tag);
            if (!next) return false;
            set(next);
            try {
              navigator.vibrate?.(15);
            } catch {
              /* nije podržano */
            }
            return true;
          }}
        />
      ))}
    </div>
  );

  const save = (): void => {
    const r = setAlt(id, {
      tag: cur.tag,
      km: cur.km,
      desc: cur.desc,
      pace: paceText != null ? parseTimeStr(paceText) : cur.pace,
      snaga: cur.snaga
    });
    if (r.ok) closeSheet();
    else setErr(`Izmena nije moguća: ${r.err || 'nepoznata greška'}`);
  };

  return (
    <>
      <div className="sh-t">Izmeni trening</div>
      <div className="sh-s">
        N{day.w} · {dowShort(day.date)} {fmtDayMonthYear(day.date)}
        {existing ? ' · izmenjen' : ''}
      </div>
      {err ? (
        <div role="alert" style={{ fontSize: '.75rem', color: 'var(--red)', marginBottom: 10 }}>
          {err}
        </div>
      ) : null}
      <div className="f-field full" role="group" aria-label="Tip treninga">
        <span className="f-lbl">Tip treninga</span>
        {typeRow(ALT_TYPES.slice(0, 3))}
        {typeRow(ALT_TYPES.slice(3))}
        <div className="alt-hint">
          Zadrži dugme da uz trčanje dodaš i snagu (npr. Lako + Snaga).
        </div>
      </div>
      {cur.tag === 'trka' ? (
        <div
          className="f-field full"
          role="group"
          aria-label="Dužina trke"
          style={{ marginTop: 10 }}
        >
          <span className="f-lbl">Dužina trke</span>
          {[RACE_DISTANCES.slice(0, 2), RACE_DISTANCES.slice(2)].map((row) => (
            <div className="seg" style={{ marginTop: 6 }} key={row[0]?.[0]}>
              {row.map(([k, n]) => (
                <button
                  type="button"
                  key={k}
                  className={cur.km != null && Math.abs(cur.km - k) < 0.05 ? 'on' : ''}
                  onClick={() => set(chooseRaceKm(cur, k, originalDesc))}
                >
                  {n}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {cur.tag !== 'odmor' ? (
        <>
          <div className="f-field full" style={{ marginTop: 10 }}>
            <label htmlFor="alt-km">Kilometraža</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              id="alt-km"
              value={cur.km ?? ''}
              placeholder="prazno = bez km (npr. snaga)"
              onChange={(e) =>
                setDraft({ ...cur, km: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          </div>
          <div className="f-field full" style={{ marginTop: 10 }}>
            <label htmlFor="alt-desc">Opis</label>
            <textarea
              id="alt-desc"
              placeholder="Šta se radi…"
              value={cur.desc}
              onChange={(e) => setDraft({ ...cur, desc: e.target.value })}
            />
          </div>
        </>
      ) : null}
      {quality ? (
        <div className="f-field full" style={{ marginTop: 10 }}>
          <label htmlFor="alt-pace">Ciljni tempo radnog dela (m:ss/km)</label>
          <div style={{ fontSize: '.72rem', color: 'var(--txt3)', marginBottom: 6 }}>
            Ovo vidi AI analiza i kartica treninga kao „plan" — nezavisno od podrazumevanog cilja te
            nedelje.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              inputMode="numeric"
              id="alt-pace"
              placeholder="410 = 4:10"
              value={paceText ?? (cur.pace != null ? fmtClock(cur.pace) : '')}
              style={{ flex: 1 }}
              onChange={(e) => setPaceText(e.target.value)}
            />
            <button
              type="button"
              className="btn ghost sm"
              style={{ flex: 'none' }}
              onClick={() => {
                const r = paceFromDraftDesc(cur);
                if (r.ok) {
                  setErr('');
                  set(r.draft);
                } else setErr(r.err);
              }}
            >
              🔍 Iz opisa
            </button>
          </div>
        </div>
      ) : null}
      <div className="btnrow" style={{ marginTop: 14 }}>
        <button type="button" className="btn" onClick={save}>
          Sačuvaj
        </button>
      </div>
      {existing ? (
        <div className="btnrow" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              void confirmAction('Vratiti ovaj dan na originalni trening iz plana?').then((ok) => {
                if (!ok) return;
                clearAlt(id);
                closeSheet();
              });
            }}
          >
            Vrati na plan
          </button>
        </div>
      ) : null}
      <div className="note-src">
        Plan se ne menja — ovo je izmena samo za ovaj dan i uvek se vraća. Odrađeni treninzi se ne
        menjaju.
      </div>
    </>
  );
}
