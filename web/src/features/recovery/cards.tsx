import { useState } from 'react';
import { fmtDayMonth, fmtNum, glagolZaBroj, brojTreninga } from '../../domain/format';
import { tagName } from '../../domain/plan';
import {
  ACWR_MAX,
  ACWR_RETURN,
  ACWR_HIGH,
  ACWR_SCALE,
  acwrBand,
  acwrPosition,
  acwrText,
  deviationTone,
  freshnessTone,
  seriesModel,
  sleepTone,
  wellnessFor,
  wellnessSeries,
  type Acwr,
  type InjuryProposal,
  type PainStatus,
  type Tone
} from '../../domain/recovery';
import type { WellnessRecord } from '../../domain/state';
import { SeriesChart } from './charts';
import { fmtKm } from '../../domain/format';

const TONE: Record<Tone, string> = {
  red: 'var(--red)',
  amber: 'var(--amber)',
  green: 'var(--green)',
  neutral: 'var(--txt)'
};

export const CardHead = ({ title, extra }: { title: string; extra?: string }) => (
  <div className="dhead">
    <span className="card-t">{title}</span>
    {extra ? <span className="dhead-x">{extra}</span> : null}
  </div>
);

export function StatusBanner({ status }: { status: PainStatus }) {
  return (
    <div className={`kb ${status.cls}`}>
      <div>
        <div>{status.t}</div>
        <small>{status.s}</small>
      </div>
    </div>
  );
}

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
    <div
      className="card"
      style={{ borderColor: urgent ? 'rgba(255,69,58,.35)' : 'rgba(255,176,32,.3)' }}
    >
      <div className="card-t" style={{ color: urgent ? 'var(--red)' : 'var(--amber)' }}>
        Plan se može prilagoditi
      </div>
      <div style={{ fontSize: '.85rem', lineHeight: 1.55, color: 'var(--txt2)' }}>
        {proposal.message}
      </div>
      {n ? (
        <>
          <div className="note-src" style={{ marginTop: 10 }}>
            {glagolZaBroj(n, 'Menja se', 'Menjaju se')} {brojTreninga(n)}:{' '}
            {proposal.changes
              .slice(0, 4)
              .map((x) => `${fmtDayMonth(x.date)} → ${x.rw ? 'Run/walk' : tagName(x.to)}`)
              .join(' · ')}
            {n > 4 ? ' …' : ''}
          </div>
          <div className="btnrow" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={onApply}>
              Prilagodi plan
            </button>
          </div>
          <div className="note-src" style={{ marginTop: 8 }}>
            Svaki dan možeš ručno da vratiš u tabu Plan.
          </div>
        </>
      ) : (
        /* Predlog bez ijedne izmene postoji samo kad je trka u horizontu: trka se ne menja automatski. */
        <div className="note-src" style={{ marginTop: 10 }}>
          Plan se ovim ne menja — odluku o trci donosiš sam.
        </div>
      )}
    </div>
  );
}

const num = (v: unknown): string =>
  v == null || !Number.isFinite(+(v as number)) ? '—' : fmtNum(+(v as number), 1);

function Metric({
  label,
  value,
  sub,
  tone
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone | undefined;
}) {
  return (
    <div className="ob-vp" style={{ flex: 1 }}>
      <i>{label}</i>
      <b style={{ color: TONE[tone ?? 'neutral'] }}>{value}</b>
      {sub ? (
        <small style={{ display: 'block', fontSize: '.62rem', color: 'var(--txt3)', marginTop: 2 }}>
          {sub}
        </small>
      ) : null}
    </div>
  );
}

/** „Jutros": HRV, san, svežina (intervals.icu / Garmin). HRV se čita u odnosu na SOPSTVENU sedmodnevnu osnovu. */
export function WellnessCard({
  wellness,
  connected
}: {
  wellness: Readonly<Record<string, WellnessRecord>>;
  connected: boolean;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const series = wellnessSeries(wellness, 90);
  const lastRec = series[series.length - 1];
  if (!lastRec)
    return (
      <div className="card">
        <div className="card-t">Jutros</div>
        <div className="note-src" style={{ margin: 0 }}>
          {connected
            ? 'Povezano sa intervals.icu, ali još nema zapisa. Dodirni „Povuci sve" u Podešavanjima.'
            : 'Nije povezano. Podešavanja → intervals.icu — HRV, puls u miru i san sa Garmina, i krugovi intervala sa trčanja.'}
        </div>
      </div>
    );
  const o = wellnessFor(wellness, lastRec.datum) ?? lastRec;
  const dev = (o as { hrvOdstupanje?: number }).hrvOdstupanje;
  const base = (o as { hrvBaza7?: number }).hrvBaza7;
  const hrvSub =
    dev != null ? `${dev >= 0 ? '+' : ''}${num(dev)}% od osnove ${num(base)}` : 'nema osnove još';
  const model = seriesModel(series, 'hrv', 'percent');
  return (
    <div className="card">
      <CardHead title="Jutros" extra={fmtDayMonth(o.datum)} />
      <div className="ob-vpaces" style={{ display: 'flex', gap: 8 }}>
        <Metric
          label="HRV"
          value={o.hrv != null ? num(o.hrv) : '—'}
          sub={hrvSub}
          tone={deviationTone(dev)}
        />
        <Metric
          label="San"
          value={o.sanH != null ? `${num(o.sanH)} h` : '—'}
          sub={o.sanOcena != null ? `ocena ${num(o.sanOcena)}` : ''}
          tone={o.sanH != null ? sleepTone(o.sanH) : undefined}
        />
        {o.svezina != null ? (
          <Metric
            label="Svežina"
            value={num(o.svezina)}
            sub={`forma ${num(o.ctl)} · umor ${num(o.atl)}`}
            tone={freshnessTone(o.svezina)}
          />
        ) : null}
      </div>
      {model ? (
        <SeriesChart
          model={model}
          field="hrv"
          color="var(--cyan)"
          caption="HRV · isprekidano = tvoja sedmodnevna osnova"
          selected={sel}
          onSelect={setSel}
          describe={(r, b) =>
            `${fmtDayMonth(r.datum)} · HRV ${num(r.hrv)} · osnova ${num(b)}${r.pulsUMiru != null ? ` · puls u miru ${fmtNum(r.pulsUMiru, 0)}` : ''}${r.sanH != null ? ` · san ${num(r.sanH)} h` : ''}`
          }
        />
      ) : (
        <div className="note-src" style={{ marginTop: 10 }}>
          Grafikon HRV-a se crta kad bude bar 4 dana zapisa.
        </div>
      )}
      <div className="note-src">
        HRV se čita u odnosu na <b>tvoju</b> sedmodnevnu osnovu, ne kao gola brojka. Pad preko 10%
        znači da oporavak zaostaje; pad uz porast pulsa u miru i kratak san je jasan znak da treba
        lakši dan.
      </div>
    </div>
  );
}

/** Puls u miru: čita se kao HRV (prema sopstvenoj osnovi), ali mu je SMER OBRNUT — rast je lošiji. */
export function RestingHrCard({
  wellness
}: {
  wellness: Readonly<Record<string, WellnessRecord>>;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const series = wellnessSeries(wellness, 90).filter((x) => x.pulsUMiru != null);
  const lastRec = series[series.length - 1];
  if (!lastRec) return null;
  const o = (wellnessFor(wellness, lastRec.datum) ?? lastRec) as WellnessRecord & {
    pulsOdstupanje?: number;
    pulsBaza7?: number;
  };
  /* Odstupanje je u OTKUCAJIMA, a `deviationTone` je pisan za procente, pa se množi sa 2 (+2,5 otkucaja je žuta, +5 crvena). */
  const tone: Tone =
    o.pulsOdstupanje != null ? deviationTone(o.pulsOdstupanje * 2, true) : 'neutral';
  const model = seriesModel(series, 'pulsUMiru', 'beats');
  return (
    <div className="card">
      <CardHead title="Puls u miru" extra={fmtDayMonth(o.datum)} />
      <div className="ob-vpaces" style={{ display: 'flex', gap: 8 }}>
        <Metric
          label="Jutros"
          value={num(o.pulsUMiru)}
          sub={
            o.pulsOdstupanje != null
              ? `${o.pulsOdstupanje >= 0 ? '+' : ''}${num(o.pulsOdstupanje)} od osnove`
              : 'nema osnove još'
          }
          tone={tone}
        />
        <Metric
          label="Osnova · 7 dana"
          value={o.pulsBaza7 != null ? num(o.pulsBaza7) : '—'}
          sub={o.pulsBaza7 != null ? 'prosek prethodnih dana' : 'traži bar 3 dana'}
        />
      </div>
      {model ? (
        <SeriesChart
          model={model}
          field="pulsUMiru"
          color="var(--pink)"
          caption="Puls u miru · isprekidano = tvoja sedmodnevna osnova"
          selected={sel}
          onSelect={setSel}
          describe={(r, b) =>
            `${fmtDayMonth(r.datum)} · puls u miru ${fmtNum(r.pulsUMiru, 0)} · osnova ${num(b)}${r.hrv != null ? ` · HRV ${num(r.hrv)}` : ''}${r.sanH != null ? ` · san ${num(r.sanH)} h` : ''}`
          }
        />
      ) : (
        <div className="note-src" style={{ marginTop: 10 }}>
          Grafikon se crta kad bude bar 4 dana zapisa.
        </div>
      )}
      <div className="note-src">
        Kod pulsa u miru je <b>niže bolje</b> — obrnuto od HRV-a. Jedno jutro iznad osnove nije
        ništa; nekoliko dana zaredom, pogotovo uz pad HRV-a i kratak san, znači da oporavak ne
        stiže. Porast od 5 i više otkucaja uz osećaj umora je razlog da se dan olakša.
      </div>
    </div>
  );
}

const BAND_COLOR = {
  low: 'var(--amber)',
  ok: 'var(--green)',
  high: 'var(--amber)',
  danger: 'var(--red)'
} as const;

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
      <div className="card">
        <CardHead title="Opterećenje" extra="poslednjih 7 dana" />
        <div className="drows">
          <div className="drow">
            <span className="l">akutno · 7 dana</span>
            <span className="v">{fmtKm(now.acute)} km</span>
          </div>
        </div>
        <div className="note-src">
          Odnos se prikazuje kad prođe bar jedna nedelja plana sa unetim trčanjem — hronična osnova
          je prosek poslednje četiri završene nedelje.
        </div>
      </div>
    );
  const band = acwrBand(now.ratio);
  const lo = acwrText(ACWR_RETURN);
  const hi = acwrText(ACWR_MAX);
  const rec = {
    low: `Ispod bezbednog pojasa (${lo}–${hi}). Ako ovo nije deload nedelja, obim je pao ispod onoga na šta si navikao.`,
    ok: `U bezbednom pojasu (${lo}–${hi}) — obim raste onoliko koliko telo stiže da podnese.`,
    high: `Iznad gornje ivice pojasa (${hi}). Još nije opasno, ali sledeća nedelja ne bi smela da bude veća od ove.`,
    danger: 'Preko 1,5 — u tom pojasu rizik od povrede naglo raste. Skrati sledeću nedelju.'
  }[band];
  const ahead = planned.ratio != null && planned.ratio > ACWR_MAX ? planned : null;
  const dangerAhead = ahead != null && (ahead.ratio ?? 0) > ACWR_HIGH;
  return (
    <div className="card">
      <CardHead title="Opterećenje" extra="poslednjih 7 dana" />
      <div className="ac-v" style={{ color: BAND_COLOR[band] }}>
        {acwrText(now.ratio)}
        <span>
          akutno {fmtKm(now.acute)} km / hronično {fmtKm(now.chronic)} km
        </span>
      </div>
      <div className="acwr">
        <i style={{ left: `${acwrPosition(now.ratio).toFixed(1)}%` }} />
      </div>
      <div className="acwr-l">
        <span style={{ left: '0%' }}>0</span>
        <span style={{ left: `${acwrPosition(ACWR_RETURN)}%` }}>{fmtNum(ACWR_RETURN, 1)}</span>
        <span style={{ left: `${acwrPosition(ACWR_MAX)}%` }}>{fmtNum(ACWR_MAX, 1)}</span>
        <span style={{ left: `${acwrPosition(ACWR_HIGH)}%` }}>1,5</span>
        <span style={{ left: '100%' }}>{fmtNum(ACWR_SCALE, 1)}</span>
      </div>
      {ahead ? (
        <div
          className="note-src"
          style={{ marginTop: 10, color: dangerAhead ? 'var(--red)' : 'var(--amber)' }}
        >
          Plan narednih 7 dana: {fmtKm(ahead.planned)} km — odnos bi bio {acwrText(ahead.ratio)}.{' '}
          {dangerAhead
            ? 'To je preko 1,5 pre nego što je nedelja počela. Skrati je, ili prihvati predlog za prilagođavanje plana ako ga aplikacija nudi.'
            : 'Iznad gornje ivice pojasa; ako je ovo povratak posle pauze ili povrede, skrati.'}
        </div>
      ) : null}
      <div className="note-src">
        {rec} Odnos poredi kilometražu poslednjih sedam dana sa prosekom poslednje četiri završene
        nedelje.
      </div>
    </div>
  );
}
