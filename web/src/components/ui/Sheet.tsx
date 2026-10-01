import { useEffect, useRef, type ReactNode } from 'react';

/* LIST (modalni dijalog odozdo). ČETIRI STVARI, i sve četiri su obavezne da bi modal bio modal (WCAG, v. uputstvo):
   1. NAZIV — čitač inače kaže samo „dijalog"; uzima se iz prvog naslova SA TEKSTOM u sadržaju (list nosi različit sadržaj
      pri svakom otvaranju, pa statičan naziv ne bi značio ništa);
   2. FOKUS ULAZI u list pri otvaranju (na sam list, ne na prvo dugme — čitač pročita naziv pa sadržaj od vrha) i VRAĆA SE
      na dugme koje ga je otvorilo pri zatvaranju;
   3. POZADINA postaje `inert` — bez toga „Tab" izlazi iz lista; gde `inert` ne postoji pada se na `aria-hidden`, koji se
      postavlja TEK POSLE pomeranja fokusa (nad granom u kojoj fokus još stoji nije dozvoljen);
   4. ESCAPE zatvara. Zamka za fokus drži „Tab" unutar lista. */

const BACKGROUND = ['header', 'main', '#tabbar'];
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function setBackgroundInert(on: boolean): void {
  let inertSupported = false;
  try {
    inertSupported = 'inert' in document.createElement('div');
  } catch {
    inertSupported = false;
  }
  for (const sel of BACKGROUND) {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) continue;
    try {
      if (inertSupported) el.inert = on;
      else if (on) el.setAttribute('aria-hidden', 'true');
      else el.removeAttribute('aria-hidden');
    } catch {
      /* pozadina ostaje kakva jeste */
    }
  }
}

/** Naziv dijaloga: prvi naslov SA TEKSTOM (prazan `.card-t` ne gasi ceo lanac). */
export function sheetTitle(root: HTMLElement): string {
  for (const sel of ['.card-t', 'h2', 'h3', '.sh-t']) {
    const t = root.querySelector(sel)?.textContent?.trim();
    if (t) return t;
  }
  return 'Detalji';
}

export function Sheet({
  open,
  onClose,
  children
}: {
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    returnTo.current = (document.activeElement as HTMLElement | null) ?? null;
    document.body.style.overflow = 'hidden';
    el.scrollTop = 0;
    el.setAttribute('aria-label', sheetTitle(el));
    el.focus();
    setBackgroundInert(true); // tek posle pomeranja fokusa
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const fields = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!fields.length) {
        e.preventDefault();
        el.focus();
        return;
      }
      const first = fields[0] as HTMLElement;
      const last = fields[fields.length - 1] as HTMLElement;
      const now = document.activeElement;
      if (e.shiftKey && (now === first || now === el)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && now === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      /* Pozadina prestaje da bude inertna PRE vraćanja fokusa — u inertnu granu se fokus ne može pomeriti. */
      setBackgroundInert(false);
      document.body.style.overflow = '';
      returnTo.current?.focus?.();
      returnTo.current = null;
    };
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        className={`backdrop${open ? ' on' : ''}`}
        id="backdrop"
        aria-label="Zatvori"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={ref}
        className={`sheet${open ? ' on' : ''}`}
        id="sheet"
        role="dialog"
        aria-modal="true"
        aria-hidden={open ? 'false' : 'true'}
        tabIndex={-1}
      >
        {open ? (
          <>
            <div className="grab" />
            {children}
          </>
        ) : null}
      </div>
    </>
  );
}
