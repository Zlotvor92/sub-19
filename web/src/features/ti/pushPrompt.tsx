import { useEffect, useState } from 'react';
import { getApp } from '../../app/appContext';
import { isStandalone } from '../../pwa/install';
import { useUIStore } from '../../stores/uiStore';
import type { PushStatus } from '../../services/push/push';

/* PONUDA OBAVEŠTENJA pri pokretanju INSTALIRANE aplikacije: list iskoči jednom po pokretanju dok god obaveštenja nisu uključena na tom uređaju.
   Sistemsko pitanje sme samo iz dodira, pa list nudi dugme; „Ne sada" ne dira dozvolu pregledača, pa se pitanje sme ponoviti sledeći put. Kad je
   dozvola već odbijena, sistemsko pitanje više ne postoji — list tada kaže gde se uključuje. U pregledaču se ne nudi (tamo stoji dugme „Instaliraj"). */

export type PushPromptKind = 'off' | 'denied';

/** Šta ponuditi za dato stanje; `null` = ništa (uključena, nepodržana, server nije podešen). */
export function pushPromptFor(status: PushStatus): PushPromptKind | null {
  return status.kind === 'off' || status.kind === 'denied' ? status.kind : null;
}

let shownThisLaunch = false;

/** Samo za testove: novo „pokretanje". */
export function resetPushPrompt(): void {
  shownThisLaunch = false;
}

/** `active` = prijavljen, plan postoji, čarobnjak zatvoren. List se ne otvara preko drugog lista ili dijaloga potvrde. */
export function usePushPrompt(active: boolean): void {
  useEffect(() => {
    if (!active || shownThisLaunch || !isStandalone(window)) return;
    let alive = true;
    void getApp()
      .push.status()
      .then((s) => {
        if (!alive || shownThisLaunch) return;
        shownThisLaunch = true;
        const kind = pushPromptFor(s);
        const ui = useUIStore.getState();
        if (!kind || ui.sheet || ui.confirm || ui.wizard) return;
        ui.openSheet({ kind: 'push-prompt', props: { kind } });
      })
      .catch(() => {
        /* bez ponude */
      });
    return () => {
      alive = false;
    };
  }, [active]);
}

export function PushPromptSheet({ kind }: { kind: PushPromptKind }) {
  const closeSheet = useUIStore((s) => s.closeSheet);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (kind === 'denied')
    return (
      <>
        <div className="sh-t">Obaveštenja su blokirana</div>
        <div className="sh-s">
          Bez njih ne stiže jutarnji podsetnik za trening ni poruka kad AI analiza završi.
        </div>
        <ol className="sh-steps">
          <li>
            <b>Android:</b> dugo pritisni ikonicu sub20 → <b>Informacije o aplikaciji</b> →{' '}
            <b>Obaveštenja</b> → uključi.
          </li>
          <li>
            <b>iPhone:</b> <b>Podešavanja</b> → <b>Obaveštenja</b> → <b>sub20</b> → uključi.
          </li>
        </ol>
        <div className="btnrow">
          <button type="button" className="btn ghost block" id="pp-ok" onClick={closeSheet}>
            U redu
          </button>
        </div>
      </>
    );

  return (
    <>
      <div className="sh-t">Uključi obaveštenja</div>
      <div className="sh-s">
        Ujutru kratak podsetnik šta je danas na planu, i poruka kad AI analiza završi dok je
        aplikacija zatvorena. Dani odmora se preskaču.
      </div>
      {error ? (
        <div className="note-src" id="pp-greska">
          {error}
        </div>
      ) : null}
      <div className="btnrow">
        <button
          type="button"
          className="btn block"
          id="pp-on"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            void getApp()
              .push.enable()
              .then((r) => {
                if (r.ok) closeSheet();
                else setError(r.error || 'Nije uspelo.');
              })
              .finally(() => setBusy(false));
          }}
        >
          {busy ? 'Uključujem…' : 'Uključi'}
        </button>
        <button
          type="button"
          className="btn ghost block"
          id="pp-ne"
          disabled={busy}
          onClick={closeSheet}
        >
          Ne sada
        </button>
      </div>
    </>
  );
}
