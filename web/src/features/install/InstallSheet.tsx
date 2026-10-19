import { useState } from 'react';
import { useInstallStore, type InstallKind } from '../../pwa/install';
import { useUIStore } from '../../stores/uiStore';

/* LIST „INSTALIRAJ". Tekst za svaki od tri puta (v. `pwa/install`). Na iPhone-u obaveštenja rade samo u aplikaciji dodatoj na početni ekran,
   pa je to tamo glavni razlog; na Androidu rade i u pregledaču. */
export function InstallSheet({ kind }: { kind: InstallKind }) {
  const closeSheet = useUIStore((s) => s.closeSheet);
  const prompt = useInstallStore((s) => s.prompt);
  const [busy, setBusy] = useState(false);

  const install = async (): Promise<void> => {
    if (!prompt) {
      closeSheet();
      return;
    }
    setBusy(true);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      /* odbijeno ili već iskorišćeno — list se svakako zatvara */
    }
    /* Događaj se može upotrebiti samo jednom. */
    useInstallStore.getState().set(null);
    closeSheet();
  };

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
      ) : null}
      {kind === 'android' ? (
        <ol className="sh-steps">
          <li>
            Otvori meni pregledača (<b>⋮</b> gore desno).
          </li>
          <li>
            Izaberi <b>Instaliraj aplikaciju</b> ili <b>Dodaj na početni ekran</b>.
          </li>
        </ol>
      ) : null}
      <div className="btnrow">
        {kind === 'prompt' ? (
          <button
            type="button"
            className="btn block"
            disabled={busy}
            onClick={() => void install()}
          >
            Instaliraj
          </button>
        ) : null}
        <button type="button" className="btn ghost block" onClick={closeSheet}>
          {kind === 'prompt' ? 'Ne sada' : 'U redu'}
        </button>
      </div>
    </>
  );
}
