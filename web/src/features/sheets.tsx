import type { ReactNode } from 'react';
import { useUIStore } from '../stores/uiStore';
import { AltSheet } from './plan/AltSheet';
import { DaySheet } from './plan/DaySheet';
import { SwapSheet } from './plan/SwapSheet';
import { KneeSheet } from './recovery/KneeSheet';

/* REGISTAR LISTOVA: `kind` → sadržaj. Svaka funkcionalnost koja se otvara u listu (podešavanja, izmena treninga, bol,
   test na 3 km, istorija verzija…) registruje svoj sadržaj ovde. Svojstva (`props`) dolaze iz `openSheet` i proveravaju se
   OVDE, na granici — komponenta dobija samo ono što je tipizirano. */
const SHEETS: Record<string, (props: Record<string, unknown>) => ReactNode> = {
  day: (p) => (typeof p['id'] === 'string' ? <DaySheet id={p['id']} /> : null),
  alt: (p) => (typeof p['id'] === 'string' ? <AltSheet id={p['id']} /> : null),
  swap: (p) => (typeof p['w'] === 'number' ? <SwapSheet w={p['w']} /> : null),
  knee: (p) => (
    <KneeSheet
      id={typeof p['id'] === 'string' ? p['id'] : null}
      part={typeof p['part'] === 'string' ? p['part'] : null}
      today={useUIStore.getState().today}
      newId={() => `k${Date.now()}`}
    />
  )
};

export function SheetHost() {
  const sheet = useUIStore((s) => s.sheet);
  if (!sheet) return null;
  const render = Object.prototype.hasOwnProperty.call(SHEETS, sheet.kind)
    ? SHEETS[sheet.kind]
    : undefined;
  if (render) return render(sheet.props ?? {});
  return (
    <>
      <div className="sh-t">Detalji</div>
      <p>{sheet.kind}</p>
    </>
  );
}
