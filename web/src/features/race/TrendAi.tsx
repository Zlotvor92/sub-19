import { useState } from 'react';
import { Icon } from '../../components/ui/icons';
import { getApp } from '../../app/appContext';
import { AnalysisText } from '../today/AiCard';
import { aiTrendRequest } from '../../stores/aiActions';
import { useUIStore } from '../../stores/uiStore';

type Out = { kind: 'none' } | { kind: 'text'; text: string } | { kind: 'error'; text: string };

/* „Objasni trend (AI)": jedan zahtev, bez reda u bazi. Model dobija gotov sažetak (tempo napretka računa aplikacija) i samo ga tumači. */
export function TrendAi() {
  const today = useUIStore((s) => s.today);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<Out>({ kind: 'none' });
  const go = (): void => {
    const req = aiTrendRequest(today);
    if (!req) return;
    setBusy(true);
    setOut({ kind: 'none' });
    void getApp()
      .ai.trend(req.summary, req.goalCtx)
      .then((r) => setOut(r.ok ? { kind: 'text', text: r.text } : { kind: 'error', text: r.error }))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <button type="button" id="trend-go" className="btn-ai" disabled={busy} onClick={go}>
        {busy ? (
          'Analiziram trend…'
        ) : (
          <>
            <Icon name="sparkle" size={18} /> Objasni trend (AI)
          </>
        )}
      </button>
      <div id="trend-out" className={`ai-out${out.kind === 'error' ? ' err' : ''}`}>
        {out.kind === 'text' ? (
          <AnalysisText text={out.text} />
        ) : out.kind === 'error' ? (
          out.text
        ) : null}
      </div>
    </>
  );
}
