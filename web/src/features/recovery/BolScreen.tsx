import { useState } from 'react';
import { ScreenFrame } from '../../components/ui/Shell';
import { Icon } from '../../components/ui/icons';
import { Section } from '../../components/ui/primitives';
import { diffDays, parseIsoDate } from '../../domain/date';
import { dowShort, fmtDayMonth, pl3 } from '../../domain/format';
import { partName } from '../../domain/recovery';
import { useSettingsStore } from '../../stores';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useUIStore } from '../../stores/uiStore';
import { BodyMap, type BodyView } from './BodyMap';
import { PainChart } from './charts';
import { useRecoveryModel } from './useRecoveryModel';

/* BOL: mapa tela (dodirni deo), kretanje kroz vreme i jedna istorija unosa. Raniji „Poslednjih 14 dana“ je bio podskup iste istorije, pa se sada samo
   stariji unosi prigušuju. Isti unos bola postoji i u polju „Bol“ uz trening (Detalji treninga → Unos). */
export function BolScreen() {
  const m = useRecoveryModel();
  const knee = useRecoveryStore((s) => s.knee);
  const bodyView = useSettingsStore((s) => s.ui['bodyView']);
  const patchUi = useSettingsStore((s) => s.patchUi);
  const todayStr = useUIStore((s) => s.today);
  const openSheet = useUIStore((s) => s.openSheet);
  const [painSel, setPainSel] = useState<number | null>(null);
  const today = parseIsoDate(todayStr);
  const view: BodyView = bodyView === 'back' ? 'back' : 'front';
  if (!m || !today) return null;

  const history = knee.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const openPart = (part: string | null): void =>
    openSheet({ kind: 'knee', props: { id: null, part } });
  const recent = (date: string): boolean => {
    const d = parseIsoDate(date);
    return !!d && diffDays(d, today) <= 14;
  };

  return (
    <ScreenFrame>
      <header className="screen-head">
        <h1>Bol</h1>
        <p>
          {m.active.length
            ? `${m.active.length} ${pl3(m.active.length, 'deo tela', 'dela tela', 'delova tela')} u poslednjih 14 dana`
            : 'Dodirni deo koji te boli'}
        </p>
      </header>

      <div className="seg" role="group" aria-label="Pogled na telo">
        {(['front', 'back'] as const).map((v) => (
          <button
            type="button"
            key={v}
            data-bv={v}
            className={view === v ? 'on' : ''}
            aria-pressed={view === v}
            onClick={() => patchUi({ bodyView: v })}
          >
            {v === 'front' ? 'Prednja' : 'Zadnja'}
          </button>
        ))}
      </div>
      <div className="bodywrap">
        <BodyMap view={view} pain={knee} today={today} onPart={(p) => openPart(p)} />
      </div>
      <ul className="bodylegend" aria-label="Nivoi bola">
        <li>
          <i className="l0" />0
        </li>
        <li>
          <i className="l1" />
          1–2
        </li>
        <li>
          <i className="l2" />
          3–5
        </li>
        <li>
          <i className="l3" />
          6+
        </li>
      </ul>
      <div className="btnrow start">
        <button type="button" className="btn" onClick={() => openPart(null)}>
          <Icon name="plus" size={18} /> Dodaj unos bola
        </button>
      </div>

      <Section title="Kroz vreme" extra="0–10">
        {m.chart ? (
          <PainChart model={m.chart} selected={painSel} onSelect={setPainSel} />
        ) : (
          <p className="empty">Nema unosa.</p>
        )}
      </Section>

      <Section
        title="Istorija"
        extra={
          history.length
            ? `${history.length} ${pl3(history.length, 'unos', 'unosa', 'unosa')}`
            : undefined
        }
      >
        {history.length ? (
          <div className="rows">
            {history.map((k) => (
              <button
                type="button"
                className={`row krow${recent(k.date) ? '' : ' old'}`}
                key={k.id ?? `${k.date}-${k.pain}`}
                onClick={() => k.id && openSheet({ kind: 'knee', props: { id: k.id, part: null } })}
              >
                <span className={`kp ${k.pain >= 6 ? 'p2' : k.pain >= 1 ? 'p1' : 'p0'}`}>
                  {k.pain}
                </span>
                <span className="row-main">
                  <span className="row-t">{partName(k.part)}</span>
                  <span className="row-s">
                    {dowShort(k.date)} {fmtDayMonth(k.date)} · {k.act ?? ''}
                    {k.src ? ' · iz treninga' : ''}
                  </span>
                  {k.note ? <span className="kn">{k.note}</span> : null}
                </span>
                <span className="row-end">
                  <Icon name="chevron" size={18} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty">Nema unosa.</p>
        )}
      </Section>
    </ScreenFrame>
  );
}
