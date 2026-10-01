import { useUIStore } from '../stores/uiStore';

/* REGISTAR LISTOVA: `kind` → sadržaj. Svaka funkcionalnost koja se otvara u listu (podešavanja, izmena treninga, bol,
   test na 3 km, istorija verzija…) registruje svoj sadržaj ovde. */
export function SheetHost() {
  const sheet = useUIStore((s) => s.sheet);
  if (!sheet) return null;
  return (
    <>
      <div className="sh-t">Detalji</div>
      <p>{sheet.kind}</p>
    </>
  );
}
