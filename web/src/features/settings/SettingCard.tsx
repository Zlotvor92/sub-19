import { useState, type ReactNode } from 'react';
import { SECTION_ICONS } from './icons';

export type DotState = true | 'warn' | false | null;

/* Red sekcije: ikonica levo, naziv i stanje u sredini, tačka stanja desno. Sekcija koja traži radnju otvara se sama; ono što radi
   stoji sklopljeno. Sve što treba pročitati „u prolazu" stoji u redu, a sadržaj se otvara dodirom. */
export function SettingCard({
  name,
  summary,
  dot,
  defaultOpen,
  children
}: {
  name: string;
  summary: ReactNode;
  dot: DotState;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      className="set-card"
      data-k={name}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        <span className="set-ik">{SECTION_ICONS[name]}</span>
        <span className="set-tt">
          <b>{name}</b>
          <span>{summary}</span>
        </span>
        <span className={`dot${dot === true ? ' on' : dot === 'warn' ? ' warn' : ''}`} />
      </summary>
      <div className="set-body">{children}</div>
    </details>
  );
}

export function Help({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="help">
      <summary>{summary}</summary>
      {children}
    </details>
  );
}
