import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';

/* MALI SKUP ZAJEDNIČKIH KOMPONENTI. Svaki ekran se slaže od ovoga: odeljak sa naslovom, red sa ikonom/naslovom/podatkom, obaveštenje.
   Komponenta zna samo ulogu (ne boju) — izgled je u `styles/ui.css`. */

export function Section({
  title,
  extra,
  id,
  children
}: {
  title?: string;
  extra?: ReactNode;
  id?: string;
  children: ReactNode;
}) {
  const hid = id ? `${id}-h` : undefined;
  return (
    <section className="section" aria-labelledby={title ? hid : undefined} id={id}>
      {title ? (
        <div className="section-h">
          <h2 id={hid}>{title}</h2>
          {extra ? <span>{extra}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

interface RowProps {
  title: ReactNode;
  sub?: ReactNode;
  icon?: IconName;
  /** Vrednost ili stanje desno, pre strelice. */
  end?: ReactNode;
  /** Bez `onClick` i `href` red je samo prikaz. */
  onClick?: () => void;
  href?: string;
  /** Strelica desno (podrazumevano kad je red dodirljiv). */
  chevron?: boolean;
  /** Tekući dan / izabrani red. */
  current?: boolean;
  muted?: boolean;
  id?: string;
  'aria-label'?: string;
}

/** Red spiska. Dodirljiv red je dugme (ili veza), visok bar 60 px. */
export function Row({
  title,
  sub,
  icon,
  end,
  onClick,
  href,
  chevron,
  current,
  muted,
  id,
  'aria-label': ariaLabel
}: RowProps) {
  const body = (
    <>
      {icon ? (
        <span className="row-ic">
          <Icon name={icon} size={24} />
        </span>
      ) : null}
      <span className="row-main">
        <span className="row-t">{title}</span>
        {sub ? <span className="row-s">{sub}</span> : null}
      </span>
      {end != null || chevron || onClick || href ? (
        <span className="row-end">
          {end}
          {(chevron ?? !!(onClick || href)) ? <Icon name="chevron" size={18} /> : null}
        </span>
      ) : null}
    </>
  );
  const cls = `row${current ? ' is-today' : ''}${muted ? ' muted' : ''}`;
  if (href)
    return (
      <a className={cls} href={href} id={id} aria-label={ariaLabel}>
        {body}
      </a>
    );
  if (onClick)
    return (
      <button
        type="button"
        className={cls}
        onClick={onClick}
        id={id}
        aria-label={ariaLabel}
        aria-current={current ? 'date' : undefined}
      >
        {body}
      </button>
    );
  return (
    <div className={cls} id={id}>
      {body}
    </div>
  );
}

/** Obaveštenje u toku sadržaja (ne sistemska traka): jedna rečenica i do dve radnje. Ton: info (podrazumevano), warn, bad. */
export function Notice({
  tone = 'info',
  icon,
  title,
  children,
  actions,
  id,
  role
}: {
  tone?: 'info' | 'warn' | 'bad';
  icon?: IconName;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReadonlyArray<{ label: string; onClick: () => void; quiet?: boolean }>;
  id?: string;
  /** Poruka koja se pojavi kao posledica unosa (provera polja) mora da se najavi čitaču ekrana: `alert`. Greška (`bad`) to radi sama. */
  role?: 'alert' | 'status';
}) {
  return (
    <div
      className={`notice${tone === 'info' ? '' : ` ${tone}`}`}
      id={id}
      role={role ?? (tone === 'bad' ? 'alert' : undefined)}
    >
      <Icon name={icon ?? (tone === 'info' ? 'info' : 'alert')} size={22} />
      <div className="notice-b">
        <b>{title}</b>
        {children ? <span>{children}</span> : null}
        {actions?.length ? (
          <div className="notice-acts">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                className={`notice-act${a.quiet ? ' quiet' : ''}`}
                onClick={a.onClick}
              >
                {a.label}
                {a.quiet ? null : <Icon name="chevron" size={16} />}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Lista „oznaka — vrednost“ (definicije), bez kartice. */
export function Facts({ items }: { items: ReadonlyArray<{ label: ReactNode; value: ReactNode }> }) {
  return (
    <dl className="facts">
      {items.map((it, i) => (
        <div key={i}>
          <dt>{it.label}</dt>
          <dd>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Traka napretka: popunjeno / ukupno (0–1). Dodatna „duhova“ traka je ono što je do sada trebalo da bude urađeno. */
export function Bar({ value, ghost, label }: { value: number; ghost?: number; label: string }) {
  const pct = (n: number): string => `${Math.max(0, Math.min(1, n)) * 100}%`;
  return (
    <div className="bar" role="img" aria-label={label}>
      {ghost != null ? <i className="ghost" style={{ width: pct(ghost) }} /> : null}
      <i style={{ width: pct(value) }} />
    </div>
  );
}
