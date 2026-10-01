import { useEffect, type ReactNode } from 'react';
import { TABS, type Tab, useUIStore } from '../../stores/uiStore';
import { BrandMark, GearIcon, TabIcon, TAB_LABELS } from './icons';

/* ZAGLAVLJE, TRAKA TABOVA, AMBIJENTALNO SVETLO, UVODNI EKRAN, KAPIJA ZA PRIJAVU. Markup i klase su iz starog index.html
   (vizuelna vernost: ista CSS datoteka). */

export function Header({ subtitle, onSettings }: { subtitle: string; onSettings: () => void }) {
  return (
    <header>
      <div className="h-brand">
        <BrandMark />
        <div>
          <div className="h-title">
            SUB<span>-20</span>
          </div>
          <div className="h-sub" id="h-sub">
            {subtitle}
          </div>
        </div>
      </div>
      <button
        type="button"
        className="h-gear"
        id="btn-gear"
        aria-label="Podešavanja"
        onClick={onSettings}
      >
        <GearIcon />
      </button>
    </header>
  );
}

export function Tabbar({ onSelect }: { onSelect?: (tab: Tab) => void }) {
  const active = useUIStore((s) => s.tab);
  const setTab = useUIStore((s) => s.setTab);
  return (
    <nav id="tabbar" aria-label="Glavna navigacija">
      {TABS.map((t) => (
        <button
          key={t}
          type="button"
          data-pg={t}
          className={t === active ? 'on' : ''}
          aria-current={t === active ? 'page' : undefined}
          onClick={() => {
            setTab(t);
            onSelect?.(t);
          }}
        >
          <TabIcon tab={t} />
          <span>{TAB_LABELS[t]}</span>
        </button>
      ))}
    </nav>
  );
}

/** Ambijentalno svetlo: menja se samo `opacity` sloja koji već postoji (gradijenti se ne mogu animirati). */
export function Ambient({ tab, settingsOpen }: { tab: Tab; settingsOpen: boolean }) {
  const key = settingsOpen ? 'set' : tab === 'zajed' ? 'zaj' : tab;
  return (
    <div id="ambijent" aria-hidden="true">
      {['danas', 'plan', 'opor', 'pred', 'zaj', 'set'].map((t) => (
        <i key={t} data-t={t} className={t === key ? 'on' : ''} />
      ))}
    </div>
  );
}

/** Uvodni ekran: ako se ne ukloni, sam se gasi CSS animacijom i ne zaključava aplikaciju. */
export function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1550);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div id="uvod" aria-hidden="true" onPointerDown={onDone}>
      <div className="zn">
        <svg viewBox="0 0 120 120" width="100%" height="100%">
          <defs>
            <linearGradient id="uvodG" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#5AFFBE" />
              <stop offset="55%" stopColor="#00BEDC" />
              <stop offset="100%" stopColor="#785AFF" />
            </linearGradient>
          </defs>
          <circle
            className="traka"
            cx="60"
            cy="60"
            r="44"
            fill="none"
            stroke="rgba(238,240,255,.14)"
            strokeWidth="11"
          />
          <circle
            className="luk"
            cx="60"
            cy="60"
            r="44"
            fill="none"
            stroke="url(#uvodG)"
            strokeWidth="11"
            strokeLinecap="round"
            strokeDashoffset="47.63"
            transform="rotate(-59 60 60)"
          />
        </svg>
      </div>
      <div className="ime">
        SUB<span>·</span>20
      </div>
    </div>
  );
}

export function AuthGate({ message, onLogin }: { message: string; onLogin: () => void }) {
  return (
    <div
      id="sb-gate"
      style={{ display: 'flex' }}
      role="dialog"
      aria-modal="true"
      aria-label="Prijava"
    >
      <div className="gate-in">
        <div className="gate-brand">
          SUB<span>-20</span>
        </div>
        <h1 className="gate-h1">Prijavi se da nastaviš</h1>
        <div className="gate-sub">
          Nalog čuva tvoj plan i istoriju treninga na serveru — ako izgubiš telefon ili obrišeš
          podatke pretraživača, sve je i dalje tu.
        </div>
        <button type="button" className="gate-btn" id="gate-go" onClick={onLogin}>
          Prijavi se Google nalogom
        </button>
        {message ? (
          <div className="gate-err" role="alert">
            {message}
          </div>
        ) : null}
        <div className="gate-note">Posle prijave aplikacija radi i bez interneta.</div>
      </div>
    </div>
  );
}

export function Page({ id, active, children }: { id: Tab; active: boolean; children: ReactNode }) {
  return (
    <section
      className={`page${active ? ' active' : ''}`}
      id={`pg-${id === 'zajed' ? 'zajed' : id}`}
      aria-hidden={!active}
    >
      {active ? children : null}
    </section>
  );
}
