import { useUIStore } from '../../stores/uiStore';

/* LIST „INSTALIRAJ": koraci kad pregledač nema sistemski dijalog (dugme gore desno ga otvara, v. `components/ui/InstallButton`). Na iPhone-u
   obaveštenja rade samo u aplikaciji dodatoj na početni ekran, pa je to tamo glavni razlog; na Androidu rade i u pregledaču. */
export function InstallSheet({ kind }: { kind: 'ios' | 'android' }) {
  const closeSheet = useUIStore((s) => s.closeSheet);
  return (
    <>
      <div className="sh-t">Instaliraj sub20</div>
      <div className="sh-s">Radi preko celog ekrana i bez interneta, kao prava aplikacija.</div>
      <InstallSteps kind={kind} />
      <div className="btnrow">
        <button type="button" className="btn ghost block" onClick={closeSheet}>
          U redu
        </button>
      </div>
    </>
  );
}

/** Sami koraci — u listu, a na ekranu za prijavu ispod dugmeta (list stoji ispod tog ekrana). */
export function InstallSteps({ kind }: { kind: 'ios' | 'android' }) {
  return kind === 'ios' ? (
    <>
      {/* Koraci i isečci su sa Safarija na iOS-u 26, gde je „Share" u meniju ⋯; na starijem iOS-u je dugme direktno u traci. */}
      <ol className="sh-steps">
        <li>
          U Safariju dodirni <b>⋯</b> dole desno.
          <img src="./instaliraj/ios-1-meni.webp" alt="" width={600} height={123} loading="lazy" />
        </li>
        <li>
          Izaberi <b>Share</b>. Na starijem iOS-u to dugme (kvadrat sa strelicom) je odmah u traci
          dole.
          <img
            src="./instaliraj/ios-2-podeli.webp"
            alt=""
            width={600}
            height={319}
            loading="lazy"
          />
        </li>
        <li>
          Dodirni <b>View More</b>.
          <img src="./instaliraj/ios-3-vise.webp" alt="" width={600} height={197} loading="lazy" />
        </li>
        <li>
          Izaberi <b>Add to Home Screen</b>, pa <b>Add</b>.
          <img src="./instaliraj/ios-4-dodaj.webp" alt="" width={600} height={417} loading="lazy" />
        </li>
        <li>Otvaraj sub20 sa početnog ekrana, ne iz pregledača.</li>
      </ol>
      <p>Na telefonu na srpskom isti koraci imaju prevedene nazive.</p>
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
  );
}
