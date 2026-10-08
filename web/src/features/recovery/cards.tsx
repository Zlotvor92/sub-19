import { useState } from 'react';
import type { Tone as BadgeTone } from '../../components/ui/Badge';
import { Row, Section } from '../../components/ui/primitives';
import type { IsoDate } from '../../domain/date';
import { fmtDayMonth, fmtKm, fmtNum } from '../../domain/format';
import {
  ACWR_HIGH,
  ACWR_MAX,
  ACWR_RETURN,
  ACWR_SCALE,
  acwrBand,
  acwrPosition,
  acwrText,
  seriesModel,
  wellnessFor,
  wellnessSeries,
  type Acwr,
  type Tone
} from '../../domain/recovery';
import type { WellnessRecord } from '../../domain/state';
import { useUIStore } from '../../stores/uiStore';
import { SeriesChart } from './charts';
import { loadMeaning, wellnessSignals } from './readiness';

/** Ton domena (boje) → ton oznake (stanja). */
export const toBadge = (t: Tone): BadgeTone =>
  t === 'red' ? 'bad' : t === 'amber' ? 'warn' : t === 'green' ? 'ok' : 'none';

/* Sve su ovo ODELJCI jednog ekrana (Oporavak), ne kartice: signal sa brojem i stanjem je jednom, u „Stanju danas“; ovde je ono što mu pripada — kako se
   kreće kroz vreme i šta znači. Metrike koje su ranije bile ponovljene u karticama (HRV, san, svežina, puls u miru) više se ne prikazuju dvaput. */

/** HRV kroz vreme sa sedmodnevnom osnovom. Bez zapisa: kako se dobijaju (jedan red do povezivanja). */
export function HrvSection({
  wellness,
  connected,
  today
}: {
  wellness: Readonly<Record<string, WellnessRecord>>;
  connected: boolean;
  today: IsoDate;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const openScreen = useUIStore((s) => s.openScreen);
  const series = wellnessSeries(wellness, 90);
  const lastRec = series[series.length - 1];
  if (!lastRec)
    return (
      <Section title="HRV, san i svežina">
        <p className="note-src">
          {connected
            ? 'Povezano sa intervals.icu, ali još nema zapisa. Povuci sve u Ti → Povezani servisi → intervals.icu.'
            : 'HRV, puls u miru i san sa Garmina stižu preko intervals.icu.'}
        </p>
        {connected ? null : (
          <div className="rows">
            <Row
              icon="link"
              title="Poveži intervals.icu"
              onClick={() => openScreen({ kind: 'icu' })}
            />
          </div>
        )}
      </Section>
    );
  const model = seriesModel(series, 'hrv', 'percent');
  const sig = wellnessSignals(wellness, today, true).signals.find((s) => s.key === 'hrv');
  return (
    <Section title="HRV" extra={fmtDayMonth(lastRec.datum)}>
      {model ? (
        <SeriesChart
          model={model}
          field="hrv"
          caption="HRV · isprekidano = tvoja sedmodnevna osnova"
          selected={sel}
          onSelect={setSel}
          describe={(r, b) =>
            `${fmtDayMonth(r.datum)} · HRV ${fmtNum(r.hrv, 1)} · osnova ${fmtNum(b, 1)}${r.pulsUMiru != null ? ` · puls u miru ${fmtNum(r.pulsUMiru, 0)}` : ''}${r.sanH != null ? ` · san ${fmtNum(r.sanH, 1)} h` : ''}`
          }
        />
      ) : (
        <p className="note-src">Grafikon HRV-a se crta kad bude bar 4 dana zapisa.</p>
      )}
      <p className="note-src">
        {sig?.note ? `${sig.note}. ` : ''}HRV se čita u odnosu na <b>tvoju</b> sedmodnevnu osnovu,
        ne kao gola brojka. Pad preko 10% znači da oporavak zaostaje; pad uz porast pulsa u miru i
        kratak san je jasan znak da treba lakši dan.
      </p>
    </Section>
  );
}

/** Puls u miru: čita se kao HRV (prema sopstvenoj osnovi), ali mu je SMER OBRNUT — rast je lošiji. */
export function RestingHrSection({
  wellness
}: {
  wellness: Readonly<Record<string, WellnessRecord>>;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const series = wellnessSeries(wellness, 90).filter((x) => x.pulsUMiru != null);
  const lastRec = series[series.length - 1];
  if (!lastRec) return null;
  const o = (wellnessFor(wellness, lastRec.datum) ?? lastRec) as WellnessRecord & {
    pulsBaza7?: number;
  };
  const model = seriesModel(series, 'pulsUMiru', 'beats');
  return (
    <Section title="Puls u miru" extra={fmtDayMonth(o.datum)}>
      {model ? (
        <SeriesChart
          model={model}
          field="pulsUMiru"
          caption="Puls u miru · isprekidano = tvoja sedmodnevna osnova"
          selected={sel}
          onSelect={setSel}
          describe={(r, b) =>
            `${fmtDayMonth(r.datum)} · puls u miru ${fmtNum(r.pulsUMiru, 0)} · osnova ${fmtNum(b, 1)}${r.hrv != null ? ` · HRV ${fmtNum(r.hrv, 1)}` : ''}${r.sanH != null ? ` · san ${fmtNum(r.sanH, 1)} h` : ''}`
          }
        />
      ) : (
        <p className="note-src">Grafikon se crta kad bude bar 4 dana zapisa.</p>
      )}
      <dl className="facts">
        <div>
          <dt>Osnova · 7 dana</dt>
          <dd className="num">
            {o.pulsBaza7 != null ? fmtNum(o.pulsBaza7, 1) : '—'}
            <small>{o.pulsBaza7 != null ? 'prosek prethodnih dana' : 'traži bar 3 dana'}</small>
          </dd>
        </div>
      </dl>
      <p className="note-src">
        Kod pulsa u miru je <b>niže bolje</b> — obrnuto od HRV-a. Jedno jutro iznad osnove nije
        ništa; nekoliko dana zaredom, pogotovo uz pad HRV-a i kratak san, znači da oporavak ne
        stiže. Porast od 5 i više otkucaja uz osećaj umora je razlog da se dan olakša.
      </p>
    </Section>
  );
}

/** Zone skale odnosa opterećenja; širina je udeo skale 0–2,0 (granica 1,5 mora biti UNUTAR slike, da crvena zona ima gde da se vidi). */
const ZONES: ReadonlyArray<{ cls: string; from: number; to: number; label: string }> = [
  { cls: 'low', from: 0, to: ACWR_RETURN, label: 'nizak' },
  { cls: 'ok', from: ACWR_RETURN, to: ACWR_MAX, label: 'bezbedno' },
  { cls: 'high', from: ACWR_MAX, to: ACWR_HIGH, label: '' },
  { cls: 'danger', from: ACWR_HIGH, to: ACWR_SCALE, label: 'opasno' }
];

/** „Opterećenje“: akutno/hronično (ACWR) kao ograda za doziranje povratka, ne kao predviđanje povrede. */
export function LoadSection({
  now,
  planned
}: {
  now: Acwr;
  planned: { planned: number; ratio: number | null };
}) {
  if (now.ratio == null)
    return (
      <Section title="Opterećenje" extra="poslednjih 7 dana">
        <dl className="facts">
          <div>
            <dt>akutno · 7 dana</dt>
            <dd className="num">{fmtKm(now.acute)} km</dd>
          </div>
        </dl>
        <p className="note-src">
          Odnos se prikazuje kad prođe bar jedna nedelja plana sa unetim trčanjem — hronična osnova
          je prosek poslednje četiri završene nedelje.
        </p>
      </Section>
    );
  const band = acwrBand(now.ratio);
  const ahead = planned.ratio != null && planned.ratio > ACWR_MAX ? planned : null;
  const dangerAhead = ahead != null && (ahead.ratio ?? 0) > ACWR_HIGH;
  return (
    <Section title="Opterećenje" extra="poslednjih 7 dana">
      <div className={`ac-v ${band}`}>
        {acwrText(now.ratio)}
        <span>
          akutno {fmtKm(now.acute)} km / hronično {fmtKm(now.chronic)} km
        </span>
      </div>
      <div
        className="acwr"
        role="img"
        aria-label={`Odnos ${acwrText(now.ratio)} na skali od 0 do ${fmtNum(ACWR_SCALE, 1)}; bezbedan pojas ${acwrText(ACWR_RETURN)}–${acwrText(ACWR_MAX)}`}
      >
        {ZONES.map((z) => (
          <span
            key={z.cls}
            className={`z ${z.cls}`}
            style={{ width: `${((z.to - z.from) / ACWR_SCALE) * 100}%` }}
          />
        ))}
        <i style={{ left: `${acwrPosition(now.ratio).toFixed(1)}%` }} />
      </div>
      <div className="acwr-l" aria-hidden="true">
        <span style={{ left: '0%' }}>0</span>
        <span style={{ left: `${acwrPosition(ACWR_RETURN)}%` }}>{fmtNum(ACWR_RETURN, 1)}</span>
        <span style={{ left: `${acwrPosition(ACWR_MAX)}%` }}>{fmtNum(ACWR_MAX, 1)}</span>
        <span style={{ left: `${acwrPosition(ACWR_HIGH)}%` }}>1,5</span>
        <span style={{ left: '100%' }}>{fmtNum(ACWR_SCALE, 1)}</span>
      </div>
      <div className="acwr-z" aria-hidden="true">
        {ZONES.filter((z) => z.label).map((z) => (
          <span key={z.cls} style={{ left: `${acwrPosition((z.from + z.to) / 2)}%` }}>
            {z.label}
          </span>
        ))}
      </div>
      {ahead ? (
        <p className={`note-src ahead ${dangerAhead ? 'bad' : 'warn'}`}>
          <b>Plan narednih 7 dana: {fmtKm(ahead.planned)} km</b> — odnos bi bio{' '}
          {acwrText(ahead.ratio)}.{' '}
          {dangerAhead
            ? 'To je preko 1,5 pre nego što je nedelja počela. Skrati je, ili prihvati predlog za prilagođavanje plana ako ga aplikacija nudi.'
            : 'Iznad gornje ivice pojasa; ako je ovo povratak posle pauze ili povrede, skrati.'}
        </p>
      ) : null}
      <p className="note-src">
        {loadMeaning(band)} Odnos poredi kilometražu poslednjih sedam dana sa prosekom poslednje
        četiri završene nedelje.
      </p>
    </Section>
  );
}
