import { useEffect, useState } from 'react';
import { aiCardView, parseAnalysis, remainingText } from '../../domain/ai';
import type { ResolvedDay } from '../../domain/plan';
import { getApp } from '../../app/appContext';
import {
  aiPayloadFor,
  aiRacePayloadFor,
  raceAiLogPort,
  saveRaceContext
} from '../../stores/aiActions';
import {
  defaultRaceContext,
  normalizeRaceContext,
  type RaceContext
} from '../../domain/race/analysis';
import { ADMIN_UID } from '../../services/config';
import { useTrainingStore } from '../../stores';
import { useAuthStore } from '../../stores/authStore';
import { Icon } from '../../components/ui/icons';
import { DayHeader } from './DayCard';

/** Tekst analize: samo `**bold**` i pasusi — ništa iz teksta ne postaje oznaka (analiza iz uvezenog backupa ne može da unese HTML). */
export function AnalysisText({ text }: { text: string }) {
  return (
    <>
      {parseAnalysis(text).map((para, i) => (
        <p key={i}>
          {para.map((line, k) => (
            <span key={k}>
              {k ? <br /> : null}
              {line.map((seg, m) => (seg.strong ? <strong key={m}>{seg.text}</strong> : seg.text))}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

type Local =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'waiting' }
  | { kind: 'still' }
  | { kind: 'resending' }
  | { kind: 'error'; text: string };

/* Kartica analize je JEDAN element u više stanja: dok nema analize je jedan red (sama radnja, a napomena o izvoru podataka je njen
   podnaslov — pitanje „vredi li uopšte" stoji tamo gde se odlučuje); kad analiza postoji je puna kartica sa naslovom. Posao koji traje ima
   prednost UVEK, jer bi se inače posle povratka u aplikaciju činilo da se ništa nije pokrenulo. */
export function AiCard({ day, raceContext }: { day: ResolvedDay; raceContext?: RaceContext }) {
  const entry = useTrainingStore((s) => s.log[day.id]);
  const race = raceContext != null || day.tag === 'trka';
  const storedRace = entry?.['raceAi'];
  const context =
    raceContext ??
    normalizeRaceContext(
      storedRace && typeof storedRace === 'object'
        ? (storedRace as Record<string, unknown>)['context']
        : null,
      defaultRaceContext(entry ?? {}, day.date)
    );
  const log = race ? raceAiLogPort.get(day.id) : entry;
  const service = () => (race ? getApp().raceAi : getApp().ai);
  const [local, setLocal] = useState<Local>({ kind: 'idle' });
  const isOwner = useAuthStore((a) => a.hasSession && a.userId === ADMIN_UID);
  /* Starost posla se prati satom koji kuca dok posao traje: zaglavljen posao mora da dobije dugme i bez dodira. */
  const [now, setNow] = useState(() => Date.now());
  const running = !!log?.['aiPosao'];
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [running]);
  const view = aiCardView(race ? { ...day, tag: 'lako' } : day, log, { isOwner, now });
  if (view.kind === 'hidden') return null;

  const finish = (r: { phase: string | null; error: string | null }): void => {
    if (r.phase === 'greska') setLocal({ kind: 'error', text: r.error ?? 'Analiza nije uspela.' });
    else if (r.phase === 'radi') setLocal({ kind: 'still' });
    else setLocal({ kind: 'idle' });
  };
  const start = (): void => {
    const payload = race ? aiRacePayloadFor(day, context) : aiPayloadFor(day);
    if (!payload) return;
    if (race) saveRaceContext(day.id, context);
    setLocal({ kind: 'starting' });
    void service()
      .run(day.id, payload, () => setLocal({ kind: 'waiting' }))
      .then(finish);
  };
  const retry = (): void => {
    const payload = race ? aiRacePayloadFor(day, context) : aiPayloadFor(day);
    if (!payload) return;
    setLocal({ kind: 'resending' });
    void service().retry(day.id, payload).then(finish);
  };

  const hasText = view.kind === 'done' || (view.kind === 'running' && !!view.previous);
  const className = `card ai-card${hasText ? '' : ' prazna'}`;
  const id = `ai-card-${day.id}`;

  if (
    local.kind === 'starting' ||
    local.kind === 'waiting' ||
    local.kind === 'still' ||
    local.kind === 'error'
  ) {
    const source = view.kind === 'exhausted' ? '' : view.source;
    const text =
      local.kind === 'starting'
        ? 'Analiziram…'
        : local.kind === 'waiting'
          ? 'Analiziram… ovo traje do minut. Možeš da zatvoriš aplikaciju, rezultat te čeka.'
          : local.kind === 'still'
            ? 'Analiza još traje. Rezultat će se pojaviti sam — možeš da zatvoriš aplikaciju.'
            : local.text;
    return (
      <div className="card ai-card prazna" id={id}>
        <DayHeader title={race ? 'Analiza trke' : 'Analiza'} extra={source} />
        <div className={`ai-out${local.kind === 'error' ? ' err' : ''}`}>{text}</div>
      </div>
    );
  }

  if (view.kind === 'running')
    return (
      <div className={className} id={id}>
        <DayHeader title={race ? 'Analiza trke' : 'Analiza'} extra={view.source} />
        {view.stuck ? (
          <>
            <div className="ai-radi">
              Analiza traje duže nego što bi trebalo. Rezultat i dalje može da stigne sam.
            </div>
            <button
              type="button"
              className="ai-again"
              disabled={local.kind === 'resending'}
              onClick={retry}
            >
              {local.kind === 'resending' ? 'Šaljem ponovo…' : 'Pokušaj ponovo · ne troši analizu'}
            </button>
          </>
        ) : (
          <div className="ai-radi">
            Nova analiza je u toku. Rezultat se upisuje sam — možeš da zatvoriš aplikaciju.
          </div>
        )}
        {view.previous ? (
          <>
            <div className="ai-staro">prethodna analiza</div>
            <div className="ai-out">
              <AnalysisText text={view.previous} />
            </div>
          </>
        ) : null}
      </div>
    );

  if (view.kind === 'done')
    return (
      <div className={className} id={id}>
        <DayHeader title={race ? 'Analiza trke' : 'Analiza'} extra={view.source} />
        {view.error ? <div className="ai-radi err">{view.error}</div> : null}
        <div className="ai-out">
          <AnalysisText text={view.text} />
        </div>
        {view.remaining ? (
          <button type="button" className="ai-again" onClick={start}>
            Analiziraj ponovo · {remainingText(view.remaining)}
          </button>
        ) : null}
      </div>
    );

  if (view.kind === 'exhausted')
    return (
      <div className="card ai-card prazna" id={id}>
        <div className="ai-row off">
          <span className="ai-ic">
            <Icon name="sparkle" />
          </span>
          <span className="ai-tt">
            <b>Analiza</b>
            <span>iskorišćene obe za ovaj trening</span>
          </span>
        </div>
      </div>
    );

  return (
    <div className="card ai-card prazna" id={id}>
      <button type="button" className="ai-row" onClick={start}>
        <span className="ai-ic">
          <Icon name="sparkle" />
        </span>
        <span className="ai-tt">
          <b>{race ? 'Analiziraj trku' : 'Analiziraj trening'}</b>
          <span>
            {view.source} · {remainingText(view.remaining)}
          </span>
        </span>
        <span className="ai-ch">
          <Icon name="chevron" size={16} />
        </span>
      </button>
    </div>
  );
}
