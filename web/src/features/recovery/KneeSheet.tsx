import { useState } from 'react';
import { BODY_PARTS, partName } from '../../domain/recovery';
import { confirmAction } from '../../app/confirm';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useUIStore } from '../../stores/uiStore';
import { addPain, removePain, updatePain } from '../../stores/recoveryActions';

const ACTS = ['Trčanje', 'Snaga', 'Odmor', 'Drugo'] as const;

/* UNOS BOLA. Novi: forma pa „Dodaj". Postojeći: izmene se čuvaju AUTOMATSKI (beleška odloženo — kuca se). */
export function KneeSheet({
  id,
  part,
  today,
  newId
}: {
  id: string | null;
  part: string | null;
  today: string;
  newId: () => string;
}) {
  const existing = useRecoveryStore((s) => (id ? s.knee.find((k) => k.id === id) : undefined));
  const closeSheet = useUIStore((s) => s.closeSheet);
  const [draft, setDraft] = useState({
    date: today,
    act: 'Trčanje',
    pain: 0,
    note: '',
    part: part ?? ''
  });
  if (id && !existing) return null;
  const k = existing
    ? {
        date: existing.date,
        act: existing.act ?? 'Trčanje',
        pain: existing.pain,
        note: existing.note ?? '',
        part: existing.part ?? ''
      }
    : draft;
  const patch = (p: Partial<typeof draft>, mode: 'now' | 'soon' = 'now'): void => {
    if (id) {
      const { part: pp, ...others } = p;
      updatePain(id, { ...others, ...(pp !== undefined ? { part: pp || null } : {}) }, mode);
    } else setDraft({ ...draft, ...p });
  };
  return (
    <>
      <div className="sh-t">
        {id
          ? `Unos — ${partName(k.part || null)}`
          : `Novi unos${k.part ? ` — ${partName(k.part)}` : ''}`}
      </div>
      <div className="sh-s">
        {existing?.src ? 'Vezan za trening — izmena treninga ažurira ovaj unos' : 'Ručni unos'}
      </div>
      <div className="f-grid">
        <div className="f-field full">
          <label htmlFor="kf-part">Deo tela</label>
          <select id="kf-part" value={k.part} onChange={(e) => patch({ part: e.target.value })}>
            <option value="">Opšte (bez dela tela)</option>
            {Object.keys(BODY_PARTS).map((p) => (
              <option key={p} value={p}>
                {BODY_PARTS[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="f-field">
          <label htmlFor="kf-date">Datum</label>
          <input
            type="date"
            id="kf-date"
            value={k.date}
            onChange={(e) => e.target.value && patch({ date: e.target.value })}
          />
        </div>
        <div className="f-field">
          <label htmlFor="kf-act">Aktivnost</label>
          <select id="kf-act" value={k.act} onChange={(e) => patch({ act: e.target.value })}>
            {ACTS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="f-field full">
          <label htmlFor="kf-pain">
            Bol (0–10) <span className="range-v">{k.pain}</span>
          </label>
          <input
            type="range"
            id="kf-pain"
            min="0"
            max="10"
            step="1"
            value={k.pain}
            onChange={(e) => patch({ pain: Number(e.target.value) })}
          />
        </div>
        <div className="f-field full">
          <label htmlFor="kf-note">Beleška</label>
          <textarea
            id="kf-note"
            placeholder="Gde, kada, kako…"
            value={k.note}
            onChange={(e) => patch({ note: e.target.value }, 'soon')}
          />
        </div>
      </div>
      <div className="btnrow">
        {id ? (
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              void confirmAction('Obriši ovaj unos?').then((ok) => {
                if (!ok) return;
                removePain(id);
                closeSheet();
              });
            }}
          >
            Obriši unos
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={() => {
              addPain(newId(), {
                date: draft.date || today,
                act: draft.act,
                pain: draft.pain,
                note: draft.note.trim(),
                ...(draft.part ? { part: draft.part } : {})
              });
              closeSheet();
            }}
          >
            Dodaj
          </button>
        )}
      </div>
      {id ? <div className="note-src">Izmene se čuvaju automatski.</div> : null}
    </>
  );
}
