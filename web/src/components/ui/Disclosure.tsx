import type { ReactNode } from 'react';

/* PROGRESIVNO OTKRIVANJE: izvorni <details> — radi bez JS-a, tastatura i čitač znaju šta je, a sadržaj nije u žiži dok se ne zatraži.
   Strelica se okreće (CSS), sadržaj se otvara bez skoka. */
export function Disclosure({
  title,
  meta,
  open,
  children
}: {
  title: string;
  /** Kratak podatak desno u zaglavlju (npr. broj segmenata). */
  meta?: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="disc" open={open}>
      <summary>
        <span>{title}</span>
        {meta ? <em>{meta}</em> : null}
      </summary>
      <div className="disc-body">{children}</div>
    </details>
  );
}
