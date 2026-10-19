import { useUIStore } from '../../stores/uiStore';

/* LIST „INSTALIRAJ": koraci kad pregledač nema sistemski dijalog (dugme gore desno ga otvara, v. `components/ui/InstallButton`). Na iPhone-u
   obaveštenja rade samo u aplikaciji dodatoj na početni ekran, pa je to tamo glavni razlog; na Androidu rade i u pregledaču. */
export function InstallSheet({ kind }: { kind: 'ios' | 'android' }) {
  const closeSheet = useUIStore((s) => s.closeSheet);
  return (
    <>
      <div className="sh-t">Instaliraj sub20</div>
      <div className="sh-s">Radi preko celog ekrana i bez interneta, kao prava aplikacija.</div>
      {kind === 'ios' ? (
        <>
          <ol className="sh-steps">
            <li>
              U Safariju dodirni <b>Podeli</b> (kvadrat sa strelicom nagore).
            </li>
            <li>
              Izaberi <b>Dodaj na početni ekran</b>.
            </li>
            <li>Otvaraj sub20 sa početnog ekrana, ne iz pregledača.</li>
          </ol>
          <p>Na iPhone-u podsetnici za trening stižu samo u instaliranoj aplikaciji.</p>
        </>
      ) : (
        <ol className="sh-steps">
          <li>
            Otvori meni pregledača (<b>⋮</b> gore desno).
          </li>
          <li>
            Izaberi <b>Instaliraj aplikaciju</b> ili <b>Dodaj na početni ekran</b>.
          </li>
        </ol>
      )}
      <div className="btnrow">
        <button type="button" className="btn ghost block" onClick={closeSheet}>
          U redu
        </button>
      </div>
    </>
  );
}
