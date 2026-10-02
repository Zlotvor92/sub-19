import { useEffect, useRef } from 'react';
import { useUIStore } from '../../stores/uiStore';

/* DIJALOG POTVRDE. Pitanje se prikazuje uvek (ne može da ga „proguta" pregledač kao sistemski `confirm()`); fokus ide na
   „Ne" jer je razorna radnja na „Da" — Enter slučajno ne potvrđuje. Escape = „Ne". Tab ostaje unutar dijaloga. */

export function ConfirmHost() {
  const confirm = useUIStore((s) => s.confirm);
  const noRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!confirm) return;
    returnTo.current = (document.activeElement as HTMLElement | null) ?? null;
    noRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        confirm.resolve(false);
      } else if (e.key === 'Tab') {
        const root = document.getElementById('confirm-dialog');
        const f = root ? Array.from(root.querySelectorAll<HTMLElement>('button')) : [];
        if (!f.length) return;
        const first = f[0] as HTMLElement;
        const last = f[f.length - 1] as HTMLElement;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      returnTo.current?.focus?.();
    };
  }, [confirm]);

  if (!confirm) return null;
  return (
    <>
      <button
        type="button"
        className="backdrop on"
        aria-label="Zatvori"
        tabIndex={-1}
        style={{ zIndex: 300 }}
        onClick={() => confirm.resolve(false)}
      />
      <div
        id="confirm-dialog"
        className="sheet on"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-text"
        style={{ zIndex: 310, maxHeight: 'none' }}
      >
        <div className="grab" />
        <p
          id="confirm-text"
          style={{ whiteSpace: 'pre-line', lineHeight: 1.5, margin: '4px 0 6px' }}
        >
          {confirm.text}
        </p>
        <div className="btnrow">
          <button
            ref={noRef}
            type="button"
            className="btn ghost"
            onClick={() => confirm.resolve(false)}
          >
            Ne
          </button>
          <button type="button" className="btn" onClick={() => confirm.resolve(true)}>
            Da
          </button>
        </div>
      </div>
    </>
  );
}
