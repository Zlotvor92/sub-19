import { useState } from 'react';
import { StatusBadge, type Tone as BadgeTone } from '../../components/ui/Badge';
import type { IsoDate } from '../../domain/date';
import { brojTreninga, fmtDayMonth, fmtKm, fmtNum, glagolZaBroj } from '../../domain/format';
import { tagName } from '../../domain/plan';
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
  type InjuryProposal,
  type Tone
} from '../../domain/recovery';
import type { WellnessRecord } from '../../domain/state';
import { SeriesChart } from './charts';
import { loadMeaning, wellnessSignals, type Signal } from './readiness';

/** Ton domena (boje) → ton oznake (stanja). */
export const toBadge = (t: Tone): BadgeTone =>
  t === 'red' ? 'bad' : t === 'amber' ? 'warn' : t === 'green' ? 'ok' : 'none';

export const CardHead = ({ title, extra }: { title: string; extra?: string }) => (
  <div className="dhead">
    <h3>{title}</h3>
    {extra ? <span className="dhead-x">{extra}</span> : null}
  </div>
);

export function ProposalCard({
  proposal,
  onApply
}: {
  proposal: InjuryProposal;
  onApply: () => void;
}) {
  const urgent = !!proposal.urgent;
  const n = proposal.changes.length;
  return (
    <section className="card" aria-labelledby="pp-h">
      <div className="dhead">
        <h3 id="pp-h">Plan se može prilagoditi</h3>
        <StatusBadge tone={urgent ? 'bad' : 'warn'}>{urgent ? 'Hitno' : 'Predlog'}</StatusBadge>
      </div>
      <p className="prop-m">{proposal.message}</p>
      {n ? (
        <>
          <p className="note-src">
            {glagolZaBroj(n, 'Menja se', 'Menjaju se')} {brojTreninga(n)}:{' '}
            {proposal.changes
              .slice(0, 4)
              .map((x) => `${fmtDayMonth(x.date)} → ${x.rw ? 'Run/walk' : tagName(x.to)}`)
              .join(' · ')}
            {n > 4 ? ' …' : ''}
          </p>
          <div className="btnrow">
            <button type="button" className="btn" onClick={onApply}>
              Prilagodi plan
            </button>
          </div>
          <p className="note-src">Svaki dan možeš ručno da vratiš u tabu Plan.</p>
        </>
      ) : (
        /* Predlog bez ijedne izmene postoji samo kad je trka u horizontu: trka se ne menja automatski. */
        <p className="note-src">Plan se ovim ne menja — odluku o trci donosiš sam.</p>
      )}
    </section>
  );
}

function Metric({ s, label }: { s: Signal; label?: string }) {
  return (
    <div className="stat">
      <span className="eyebrow">{label ?? s.label}</span>
      <b className="stat-v num sm">{s.value ?? '—'}</b>
      <span className="stat-s">
        <StatusBadge tone={toBadge(s.tone)}>{s.state}</StatusBadge>
      </span>
      {s.note ? <span className="stat-s">{s.note}</span> : null}
    </div>
  );
}

/** „Jutros": HRV, san, svežina (intervals.icu / Garmin). HRV se čita u odnosu na SOPSTVENU sedmodnevnu osnovu. */
export function WellnessCard({
  wellness,
  connected,
  today
}: {
  wellness: Readonly<Record<string, WellnessRecord>>;
  connected: boolean;
  today: IsoDate;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const series = wellnessSeries(wellness, 90);
  const lastRec = series[series.length - 1];
  if (!lastRec)
    return (
      <section className="card" aria-labelledby="wl-h">
        <CardHead title="Jutros" />
        <p className="note-src">
          {connected
            ? 'Povezano sa intervals.icu, ali još nema zapisa. Dodirni „Povuci sve" u Podešavanjima.'
            : 'Nije povezano. Podešavanja → intervals.icu — HRV, puls u miru i san sa Garmina, i krugovi intervala sa trčanja.'}
        </p>
      </section>
    );
  const o = wellnessFor(wellness, lastRec.datum) ?? lastRec;
  const signals = wellnessSignals(wellness, today, true).signals.filter((s) =>
    ['hrv', 'san', 'svezina'].includes(s.key)
  );
  const model = seriesModel(series, 'hrv', 'percent');
  return (
    <section className="card chart-card" aria-labelledby="wl-h">
      <div className="dhead">
        <h3 id="wl-h">Jutros</h3>
        <span className="dhead-x">{fmtDayMonth(o.datum)}</span>
      </div>
      <div className="stats3">
        {signals.map((s) => (
          <Metric key={s.key} s={s} />
        ))}
      </div>
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
        HRV se čita u odnosu na <b>tvoju</b> sedmodnevnu osnovu, ne kao gola brojka. Pad preko 10%
        znači da oporavak zaostaje; pad uz porast pulsa u miru i kratak san je jasan znak da treba
        lakši dan.
      </p>
    </section>
  );
}

/** Puls u miru: čita se kao HRV (prema sopstvenoj osnovi), ali mu je SMER OBRNUT — rast je lošiji. */
export function RestingHrCard({
  wellness,
  today
}: {
  wellness: Readonly<Record<string, WellnessRecord>>;
  today: IsoDate;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const series = wellnessSeries(wellness, 90).filter((x) => x.pulsUMiru != null);
  const lastRec = series[series.length - 1];
  if (!lastRec) return null;
  const o = (wellnessFor(wellness, lastRec.datum) ?? lastRec) as WellnessRecord & {
    pulsBaza7?: number;
  };
  const sig = wellnessSignals(wellness, today, true).signals.find((s) => s.key === 'puls');
  const model = seriesModel(series, 'pulsUMiru', 'beats');
  return (
    <section className="card chart-card" aria-labelledby="rh-h">
      <div className="dhead">
        <h3 id="rh-h">Puls u miru</h3>
        <span className="dhead-x">{fmtDayMonth(o.datum)}</span>
      </div>
      <div className="stats3">
        {sig ? <Metric s={sig} label="Jutros" /> : null}
        <div className="stat">
          <span className="eyebrow">Osnova · 7 dana</span>
          <b className="stat-v num sm">{o.pulsBaza7 != null ? fmtNum(o.pulsBaza7, 1) : '—'}</b>
          <span className="stat-s">
            {o.pulsBaza7 != null ? 'prosek prethodnih dana' : 'traži bar 3 dana'}
          </span>
        </div>
      </div>
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
      <p className="note-src">
        Kod pulsa u miru je <b>niže bolje</b> — obrnuto od HRV-a. Jedno jutro iznad osnove nije
        ništa; nekoliko dana zaredom, pogotovo uz pad HRV-a i kratak san, znači da oporavak ne
        stiže. Porast od 5 i više otkucaja uz osećaj umora je razlog da se dan olakša.
      </p>
    </section>
  );
}

/** Zone skale odnosa opterećenja; širina je udeo skale 0–2,0 (granica 1,5 mora biti UNUTAR slike, da crvena zona ima gde da se vidi). */
const ZONES: ReadonlyArray<{ cls: string; from: number; to: number; label: string }> = [
  { cls: 'low', from: 0, to: ACWR_RETURN, label: 'nizak' },
  { cls: 'ok', from: ACWR_RETURN, to: ACWR_MAX, label: 'bezbedno' },
  { cls: 'high', from: ACWR_MAX, to: ACWR_HIGH, label: '' },
  { cls: 'danger', from: ACWR_HIGH, to: ACWR_SCALE, label: 'opasno' }
];

/** „Opterećenje": akutno/hronično (ACWR) kao ograda za doziranje povratka, ne kao predviđanje povrede. */
export function LoadCard({
  now,
  planned
}: {
  now: Acwr;
  planned: { planned: number; ratio: number | null };
}) {
  if (now.ratio == null)
    return (
      <section className="card" aria-labelledby="ld-h">
        <div className="dhead">
          <h3 id="ld-h">Opterećenje</h3>
          <span className="dhead-x">poslednjih 7 dana</span>
        </div>
        <div className="drows">
          <div className="drow">
            <span className="l">akutno · 7 dana</span>
            <span className="v num">{fmtKm(now.acute)} km</span>
          </div>
        </div>
        <p className="note-src">
          Odnos se prikazuje kad prođe bar jedna nedelja plana sa unetim trčanjem — hronična osnova
          je prosek poslednje četiri završene nedelje.
        </p>
      </section>
    );
  const band = acwrBand(now.ratio);
  const ahead = planned.ratio != null && planned.ratio > ACWR_MAX ? planned : null;
  const dangerAhead = ahead != null && (ahead.ratio ?? 0) > ACWR_HIGH;
  return (
    <section className="card" aria-labelledby="ld-h">
      <div className="dhead">
        <h3 id="ld-h">Opterećenje</h3>
        <span className="dhead-x">poslednjih 7 dana</span>
      </div>
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
    </section>
  );
}
