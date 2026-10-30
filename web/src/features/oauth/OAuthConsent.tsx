import { useEffect, useState } from 'react';
import {
  isClaudeRedirect,
  type AuthorizationRequest,
  type OAuthServerApi
} from '../../services/supabase/oauthServer';

/* ODOBRENJE ZA CLAUDE KONEKTOR (`/?authorization_id=…`): ko traži pristup, šta će videti, Dozvoli / Odbij. Izgleda kao kapija
   za prijavu (isti raspored), jer i jeste isti trenutak: aplikacija nekome otvara nalog. Pristup se dozvoljava samo
   Claude-u (povratak na njegovu adresu); svaki drugi zahtev može samo da se odbije. */

type Consent = Extract<AuthorizationRequest, { kind: 'consent' }>;
type View =
  | { s: 'loading' }
  | { s: 'consent'; req: Consent; busy: boolean }
  | { s: 'error'; message: string }
  | { s: 'leaving' };

const host = (uri: string): string => {
  try {
    return new URL(uri).host;
  } catch {
    return uri;
  }
};

export function OAuthConsent({
  id,
  api,
  forget,
  close,
  navigate = (url) => window.location.assign(url)
}: {
  id: string;
  api: OAuthServerApi;
  /** Briše zapamćen zahtev (odluka je poslata; povratak „nazad" ga ne sme ponovo otvoriti). */
  forget: () => void;
  /** Briše zahtev i vraća u aplikaciju. */
  close: () => void;
  navigate?: (url: string) => void;
}) {
  const [view, setView] = useState<View>({ s: 'loading' });

  useEffect(() => {
    let live = true;
    void api.details(id).then((r) => {
      if (!live) return;
      if (!r.ok) {
        setView({
          s: 'error',
          message:
            r.status === 404
              ? 'Zahtev je istekao ili je već iskorišćen. Pokreni povezivanje ponovo iz Claude-a.'
              : r.error
        });
        return;
      }
      if (r.data.kind === 'consent') {
        setView({ s: 'consent', req: r.data, busy: false });
        return;
      }
      /* Već odobreno ranije: Supabase odmah daje povratak — samo ako vodi u Claude. */
      if (!isClaudeRedirect(r.data.url)) {
        setView({
          s: 'error',
          message: 'Zahtev ne vodi u Claude. sub20 daje pristup samo Claude-u.'
        });
        return;
      }
      forget();
      setView({ s: 'leaving' });
      navigate(r.data.url);
    });
    return () => {
      live = false;
    };
    // `forget`/`navigate` su stabilni po smislu; zahtev se čita jednom po ID-u.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, api]);

  /* „Dozvoli" postoji samo u prikazu Claude-ovog zahteva (ispod) — to je jedino mesto koje odlučuje šta sme da se odobri. */
  const decide = async (req: Consent, action: 'approve' | 'deny'): Promise<void> => {
    setView({ s: 'consent', req, busy: true });
    const r = await api.decide(id, action);
    if (!r.ok) {
      setView({ s: 'error', message: r.error });
      return;
    }
    /* Odbijen tuđ zahtev: ne ide se na nepoznatu adresu, samo nazad u aplikaciju. */
    if (!isClaudeRedirect(req.redirectUri) || !isClaudeRedirect(r.data)) {
      close();
      return;
    }
    forget();
    setView({ s: 'leaving' });
    navigate(r.data);
  };

  return (
    <div
      className="gate"
      style={{ display: 'flex' }}
      role="dialog"
      aria-modal="true"
      aria-label="Pristup za Claude"
    >
      <div className="gate-in">
        <img className="gate-logo" src="./icon-192.png" alt="" width="72" height="72" />
        <div className="gate-brand">sub20</div>
        {view.s === 'loading' ? (
          <div className="gate-sub" role="status">
            Učitavam zahtev…
          </div>
        ) : view.s === 'leaving' ? (
          <div className="gate-sub" role="status">
            Vraćam te u Claude…
          </div>
        ) : view.s === 'error' ? (
          <>
            <h1 className="gate-h1">Povezivanje sa Claude-om nije uspelo</h1>
            <div className="gate-err" role="alert">
              {view.message}
            </div>
            <button type="button" className="btn block" onClick={close}>
              Nazad u aplikaciju
            </button>
          </>
        ) : isClaudeRedirect(view.req.redirectUri) ? (
          <>
            <h1 className="gate-h1">Claude traži pristup zdravstvenim podacima</h1>
            <div className="gate-sub">
              „{view.req.clientName}“ ({host(view.req.redirectUri)})
              {view.req.email
                ? ` traži pristup nalogu ${view.req.email}.`
                : ' traži pristup tvom nalogu.'}{' '}
              Videće samo jutarnja merenja iz intervals.icu: HRV, puls u miru, san, težinu i
              CTL/ATL. Ne vidi plan, treninge ni beleške i ne može da menja podatke u aplikaciji.
            </div>
            <button
              type="button"
              className="btn block"
              disabled={view.busy}
              onClick={() => void decide(view.req, 'approve')}
            >
              Dozvoli
            </button>
            <button
              type="button"
              className="btn quiet"
              disabled={view.busy}
              onClick={() => void decide(view.req, 'deny')}
            >
              Odbij
            </button>
          </>
        ) : (
          <>
            <h1 className="gate-h1">Zahtev nije od Claude-a</h1>
            <div className="gate-err" role="alert">
              „{view.req.clientName}“ traži pristup i vraća na {host(view.req.redirectUri)}. sub20
              daje pristup samo Claude-u.
            </div>
            <button
              type="button"
              className="btn block"
              disabled={view.busy}
              onClick={() => void decide(view.req, 'deny')}
            >
              Odbij
            </button>
          </>
        )}
      </div>
    </div>
  );
}
