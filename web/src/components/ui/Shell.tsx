import type { ReactNode } from 'react';
import { VISIBLE_TABS, type Tab, useUIStore } from '../../stores/uiStore';
import { BrandMark, GearIcon, TabIcon, TAB_LABELS } from './icons';

/* LJUSKA: zaglavlje (znak, kratak natpis, podešavanja, traka ciklusa), traka tabova, kapija za prijavu, ekran jednog taba. */

export function Header({
  caption,
  rail,
  onSettings
}: {
  /** Kratak natpis ciklusa („N6/12 · RAZVOJ · 46 d"). */
  caption: ReactNode;
  /** Traka ciklusa (dodirna: otvara plan). */
  rail: ReactNode;
  onSettings: () => void;
}) {
  return (
    <header className="app-head">
      <div className="app-head-in">
        <div className="app-head-row">
          <div className="brand">
            <BrandMark />
            <div>
              SUB<span>-20</span>
            </div>
          </div>
          <div className="cycle-cap" id="h-sub">
            {caption}
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
        </div>
        {rail}
      </div>
    </header>
  );
}

export function Tabbar({ onSelect }: { onSelect?: (tab: Tab) => void }) {
  const active = useUIStore((s) => s.tab);
  const setTab = useUIStore((s) => s.setTab);
  return (
    <nav id="tabbar" aria-label="Glavna navigacija">
      {VISIBLE_TABS.map((t) => (
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

export function Page({
  id,
  active,
  entering = false,
  peek = false,
  label,
  children
}: {
  id: Tab;
  active: boolean;
  /** Kartice se slažu (tab se promenio dodirom). */
  entering?: boolean;
  /** Susedni ekran koji prst upravo vuče u kadar: sadržaj mora postojati pre nego što uđe. */
  peek?: boolean;
  /** Naziv regiona za čitač ekrana (isti kao naslov ekrana). */
  label?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`page${active ? ' active' : ''}${entering ? ' uskoci' : ''}`}
      id={`pg-${id}`}
      aria-hidden={!active}
      aria-label={label ?? TAB_LABELS[id]}
    >
      {active || peek ? children : null}
    </section>
  );
}
