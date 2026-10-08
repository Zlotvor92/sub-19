import { useState } from 'react';
import { getApp } from '../../app/appContext';
import { confirmAction } from '../../app/confirm';
import { useAuthStore } from '../../stores/authStore';
import { useSyncStore } from '../../stores/syncStore';
import { useUIStore } from '../../stores/uiStore';
import { Help } from '../../components/ui/Disclosure';
import { dt, type SectionInfo } from './sectionInfo';

/* ------------------------------------------------------------- Nalog */

export function useAccountInfo(): SectionInfo {
  const configured = useAuthStore((s) => s.configured);
  const signedIn = useAuthStore((s) => s.hasSession);
  const email = useAuthStore((s) => s.email);
  return {
    visible: configured,
    summary: signedIn ? (email ?? '—') : 'nije prijavljen',
    dot: signedIn,
    open: !signedIn
  };
}

export function AccountBody() {
  const signedIn = useAuthStore((s) => s.hasSession);
  const busy = useSyncStore((s) => s.busy);
  const openSheet = useUIStore((s) => s.openSheet);
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle');
  if (!signedIn)
    return (
      <>
        <div className="btnrow">
          <button type="button" className="btn" id="sb-in" onClick={() => getApp().login()}>
            Prijavi se Google nalogom
          </button>
        </div>
        <Help summary="Šta dobijam prijavom">
          <p>
            Bez prijave sve radi kao i do sad, samo bez rezervne kopije na serveru i bez istog plana
            na više uređaja.
          </p>
        </Help>
      </>
    );
  const seenAt = getApp().session.state.seenAt;
  return (
    <>
      <div className="note-src">
        {seenAt ? `sinhronizovano ${dt(seenAt)}` : 'još nije sinhronizovano'}
      </div>
      <div className="btnrow">
        <button
          type="button"
          className="btn ghost"
          id="sb-sync"
          disabled={state === 'busy' || busy}
          onClick={() => {
            setState('busy');
            void getApp()
              .sync.syncNow()
              .then((ok) => {
                setState(ok ? 'ok' : 'fail');
                setTimeout(() => setState('idle'), ok ? 900 : 1800);
              });
          }}
        >
          {state === 'busy'
            ? 'Sinhronizujem…'
            : state === 'ok'
              ? 'Sinhronizovano ✓'
              : state === 'fail'
                ? 'Nije uspelo'
                : 'Sinhronizuj'}
        </button>
        <button
          type="button"
          className="btn ghost sm"
          id="sb-out"
          onClick={() => {
            void confirmAction('Odjaviti se? Podaci na ovom uređaju ostaju.').then((ok) => {
              if (!ok) return;
              getApp().logout();
            });
          }}
        >
          Odjavi se
        </button>
      </div>
      <Help summary="Čemu služi prijava">
        <p>
          Podaci i dalje žive na ovom uređaju — server je samo rezervna kopija, pa aplikacija radi i
          bez signala. Prijava služi da plan bude isti na svim tvojim uređajima.
        </p>
      </Help>
      <Help summary="Brisanje naloga">
        <p>
          Briše nalog i <b>sve</b> podatke sa servera — plan, istoriju treninga, merenja oporavka i
          prijave za obaveštenja. Ne može da se poništi. Pre brisanja napravi „Backup" ako želiš da
          zadržiš kopiju.
        </p>
        <div className="btnrow">
          <button
            type="button"
            className="btn ghost sm"
            id="sb-del"
            onClick={() => openSheet({ kind: 'delete-account' })}
          >
            Obriši nalog
          </button>
        </div>
      </Help>
    </>
  );
}
