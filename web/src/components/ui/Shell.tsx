import { useEffect, useRef, type ReactNode } from 'react';
import { navBack } from '../../app/navHistory';
import { TABS, type Tab, useUIStore } from '../../stores/uiStore';
import { Icon, TabIcon, TAB_LABELS } from './icons';

/* LJUSKA: gornji red taba, ekran iznad taba („Nazad“), traka tabova, kapija za prijavu, stranica jednog taba. */

/** Gornji red korena taba: znak „sub20“ levo, podatak koji pripada ekranu desno (datum, faza…). Deo je stranice, pa se prevlači zajedno sa njom. */
export function AppBar({ right, tag }: { right?: ReactNode; tag?: boolean }) {
  return (
    <div className="appbar">
      <span className="wordmark" aria-hidden="true">
        sub20
      </span>
      {right ? <div className={`appbar-r${tag ? ' tag' : ''}`}>{right}</div> : null}
    </div>
  );
}

/** Ekran iznad taba: dugme „Nazad“ i, po želji, radnja desno. Naslov (h1) nosi sadržaj ekrana, ne ova traka. */
export function ScreenFrame({ right, children }: { right?: ReactNode; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  /* Otvaranje ekrana pomera fokus na njegov naslov: tastatura i čitač ekrana nastavljaju odatle, a ne sa dugmeta koje je ostalo ispod (sakriveno).
     Pri zatvaranju fokus se vraća na red koji je ekran otvorio (v. `App`). */
  useEffect(() => {
    const h1 = root.current?.querySelector('h1');
    if (!h1) return;
    h1.tabIndex = -1;
    h1.focus({ preventScroll: true });
  }, []);
  return (
    <div className="screen" ref={root}>
      <div className="screenbar">
        <button type="button" className="backbtn" onClick={navBack}>
          <Icon name="chevron-left" size={22} />
          Nazad
        </button>
        {right ? <div className="screenbar-r">{right}</div> : null}
      </div>
      {children}
    </div>
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
          <TabIcon tab={t} active={t === active} />
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
      className="gate"
      style={{ display: 'flex' }}
      role="dialog"
      aria-modal="true"
      aria-label="Prijava"
    >
      <div className="gate-in">
        <img className="gate-logo" src="./icon-192.png" alt="" width="72" height="72" />
        <div className="gate-brand">sub20</div>
        <h1 className="gate-h1">Prijavi se da nastaviš</h1>
        <div className="gate-sub">
          Nalog čuva tvoj plan i istoriju treninga na serveru — ako izgubiš telefon ili obrišeš
          podatke pretraživača, sve je i dalje tu.
        </div>
        <button type="button" className="btn block" id="gate-go" onClick={onLogin}>
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
  peek = false,
  label,
  children
}: {
  id: Tab;
  active: boolean;
  /** Susedni ekran koji prst upravo vuče u kadar: sadržaj mora postojati pre nego što uđe. */
  peek?: boolean;
  /** Naziv regiona za čitač ekrana (isti kao naslov ekrana). */
  label?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`page${active ? ' active' : ''}`}
      id={`pg-${id}`}
      aria-hidden={!active}
      aria-label={label ?? TAB_LABELS[id]}
    >
      {active || peek ? children : null}
    </section>
  );
}
