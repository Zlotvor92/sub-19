import type { ReactNode } from 'react';
import { useUIStore } from '../stores/uiStore';
import { AltSheet } from './plan/AltSheet';
import { SwapSheet } from './plan/SwapSheet';
import { T3kSheet } from './race/T3kSheet';
import { BugSheet, DeleteAccountSheet, HistorySheet } from './ti/AccountSheets';
import { UsersSheet } from './ti/UsersSheet';
import { KneeSheet } from './recovery/KneeSheet';

/* REGISTAR LISTOVA: `kind` → sadržaj. Mali listovi odozdo za kratke izmene (izmena treninga, pomeranje, test na 3 km, unos bola, istorija verzija…).
   Veći sadržaj ima svoj ekran (`features/screens`). Svojstva (`props`) dolaze iz `openSheet` i proveravaju se OVDE, na granici — komponenta dobija samo
   ono što je tipizirano. */
const SHEETS: Record<string, (props: Record<string, unknown>) => ReactNode> = {
  'delete-account': () => <DeleteAccountSheet />,
  bug: () => <BugSheet />,
  history: () => <HistorySheet />,
  users: () => <UsersSheet />,
  alt: (p) => (typeof p['id'] === 'string' ? <AltSheet id={p['id']} /> : null),
  swap: (p) =>
    typeof p['w'] === 'number' ? (
      <SwapSheet w={p['w']} {...(typeof p['from'] === 'string' ? { from: p['from'] } : {})} />
    ) : null,
  t3k: (p) => (
    <T3kSheet
      id={typeof p['id'] === 'string' ? p['id'] : null}
      today={useUIStore.getState().today}
    />
  ),
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
