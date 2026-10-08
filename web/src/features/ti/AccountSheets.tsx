import { useEffect, useState } from 'react';
import {
  DELETE_CONFIRMATION,
  DELETE_CONFIRMATION_DISPLAY,
  normalizeConfirmation
} from '../../services/api/accountApi';
import { APP_VERSION } from '../../services/config';
import type { HistoryEntry } from '../../services/api/schemas';
import { getApp } from '../../app/appContext';
import { confirmAction } from '../../app/confirm';
import { Notice } from '../../components/ui/primitives';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';

/* BRISANJE NALOGA — nepovratna radnja, pa ide kroz kucanje potvrde. Ne `confirm()`: instalirane PWA i deo pregledača ga prigušuju i
   tada vraća `false` — dugme bi izgledalo da ne radi, a Play traži da put do brisanja POSTOJI iz aplikacije. Kucanje potvrde radi
   svuda i jedina je prava zaštita od slučajnog dodira. Isti tekst prima i server. */
export function DeleteAccountSheet() {
  const closeSheet = useUIStore((s) => s.closeSheet);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const match = normalizeConfirmation(text) === DELETE_CONFIRMATION;
  const go = async (): Promise<void> => {
    if (!match) return;
    setState('busy');
    setErr('');
    const r = await getApp().account.deleteAccount(DELETE_CONFIRMATION);
    if (!r.ok) {
      setErr(r.error);
      setState('idle');
      return;
    }
    setState('done');
    /* Tek posle potvrđenog brisanja na serveru: neuspelo brisanje ne sme da ostavi čoveka bez lokalnih podataka a sa nalogom. */
    getApp().forgetEverything();
    closeSheet();
    useAuthStore.getState().set({ gate: 'Nalog i svi podaci su obrisani.' });
  };
  return (
    <>
      <div className="sh-t">Obriši nalog</div>
      <div className="sh-s">
        Nepovratno. Sa servera nestaju plan, istorija treninga, merenja oporavka i prijave za
        obaveštenja.
      </div>
      <Notice tone="warn" title="Napravi backup pre ovoga">
        Ti → Privatnost i podaci → „Izvezi backup“ preuzima kopiju na uređaj. Posle brisanja je više
        nema odakle vratiti.
      </Notice>
      <div className="note-src">
        Za potvrdu ukucaj <b>{DELETE_CONFIRMATION_DISPLAY}</b>:
      </div>
      <input
        id="del-pot"
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder={DELETE_CONFIRMATION_DISPLAY}
        aria-label="Potvrda brisanja"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setErr('');
        }}
        className="confirm-input"
      />
      <div className="note-src err" id="del-err" role="alert">
        {err}
      </div>
      <div className="btnrow">
        <button
          type="button"
          className="btn danger"
          id="del-go"
          disabled={!match || state !== 'idle'}
          onClick={() => void go()}
        >
          {state === 'busy' ? 'Brišem…' : state === 'done' ? 'Obrisano ✓' : 'Obriši nalog'}
        </button>
      </div>
    </>
  );
}

/* PRIJAVA PROBLEMA — stiže direktno na mejl vlasnika (10 dnevno po nalogu, server). */
export function BugSheet() {
  const closeSheet = useUIStore((s) => s.closeSheet);
  const tab = useUIStore((s) => s.tab);
  const [desc, setDesc] = useState('');
  const [err, setErr] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const send = async (): Promise<void> => {
    const description = desc.trim();
    if (!description) {
      setErr('Napiši šta se desilo.');
      return;
    }
    setState('busy');
    setErr('');
    const r = await getApp().account.reportBug(description, {
      version: APP_VERSION,
      tab,
      userAgent: navigator.userAgent
    });
    if (!r.ok) {
      setErr(r.error);
      setState('idle');
      return;
    }
    setState('done');
    setTimeout(closeSheet, 900);
  };
  return (
    <>
      <div className="sh-t">Prijavi problem</div>
      <div className="sh-s">Opiši šta se desilo — stiže direktno na mejl.</div>
      <textarea
        id="bug-desc"
        rows={5}
        aria-label="Opis problema"
        placeholder={'Npr. kad dodirnem „Završi trening" na ekranu Danas, ništa se ne desi…'}
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        className="plain-area"
      />
      <div className="note-src err" id="bug-err" role="alert">
        {err}
      </div>
      <div className="btnrow">
        <button
          type="button"
          className="btn"
          id="bug-send"
          disabled={state !== 'idle'}
          onClick={() => void send()}
        >
          {state === 'busy' ? 'Šalje se…' : state === 'done' ? 'Poslato ✓' : 'Pošalji'}
        </button>
      </div>
    </>
  );
}

const when = (x: HistoryEntry): string => {
  const d = new Date(x.napravljeno);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('sr-RS', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
};

/* RANIJE VERZIJE — vraćanje unazad sa servera. Vraća se CELO stanje na trenutak u prošlosti; zatečeno se pre toga sačuva kao verzija
   (to radi okidač u bazi), pa se i vraćanje može poništiti. */
export function HistorySheet() {
  const closeSheet = useUIStore((s) => s.closeSheet);
  const [list, setList] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const device = getApp().session.state.deviceId;

  useEffect(() => {
    let live = true;
    void getApp()
      .api.historyList()
      .then((r) => {
        if (!live) return;
        if (r.ok) {
          setList(r.list);
          setError(null);
        } else
          setError(
            r.reason === 'forbidden'
              ? 'Nemaš pristup ranijim verzijama.'
              : r.reason === 'network'
                ? 'Nema veze sa serverom.'
                : 'Server trenutno ne odgovara.'
          );
      });
    return () => {
      live = false;
    };
  }, [nonce]);

  const restore = (x: HistoryEntry): void => {
    const label = when(x);
    void confirmAction(
      `Vratiti podatke na ${label}?\n\nSve uneseno posle tog trenutka nestaje sa ekrana. Zatečeno stanje se čuva kao verzija, pa se ovo može poništiti.`
    ).then(async (ok) => {
      if (!ok) return;
      setBusy(String(x.id));
      const r = await getApp().restoreVersion(x.id);
      setBusy(null);
      if (!r.ok) {
        window.alert(r.error);
        return;
      }
      closeSheet();
      window.alert(`Vraćeno na ${label}.`);
    });
  };

  return (
    <>
      <div className="sh-t">Ranije verzije</div>
      <div className="sh-s">
        Snimci tvojih podataka sa servera. Najviše 40, najviše jedan na sat.
      </div>
      <div className="hist-list">
        {error ? (
          <>
            <div className="empty">{error}</div>
            <div className="btnrow">
              <button
                type="button"
                className="btn ghost"
                id="ist-opet"
                onClick={() => {
                  setError(null);
                  setList(null);
                  setNonce((n) => n + 1);
                }}
              >
                Pokušaj ponovo
              </button>
            </div>
          </>
        ) : list === null ? (
          <div className="empty">Povlačim spisak…</div>
        ) : list.length === 0 ? (
          <div className="empty">
            Još nema ranijih verzija.
            <br />
            Prva nastaje pri sledećoj izmeni.
          </div>
        ) : (
          list.map((x) => (
            <div className="ztrow" key={String(x.id)}>
              <div className="ztt">
                {when(x)}
                <small>
                  verzija aplikacije {x.app_version || '—'}
                  {x.device_id && x.device_id !== device ? ' · drugi uređaj' : ''}
                </small>
              </div>
              <button
                type="button"
                className="btn ghost sm"
                disabled={busy !== null}
                onClick={() => restore(x)}
              >
                {busy === String(x.id) ? 'Vraćam…' : 'Vrati'}
              </button>
            </div>
          ))
        )}
      </div>
      <div className="note-src">
        Vraćanje menja <b>celo</b> stanje na taj trenutak — sve uneseno posle njega nestaje sa
        ekrana. I zatečeno stanje se pre toga sačuva kao verzija, pa se i vraćanje može poništiti.
      </div>
    </>
  );
}
