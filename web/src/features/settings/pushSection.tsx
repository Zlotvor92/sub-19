import { useEffect, useState } from 'react';
import { getApp } from '../../app/appContext';
import { useSettingsStore } from '../../stores';
import { Help } from './SettingCard';
import type { SectionInfo } from './sections';
import type { PushStatus } from '../../services/push/push';

/* „Obaveštenja": stanje se čita ASINHRONO (dozvola je sinhrona, ali pretplata i javni ključ nisu), pa dugmad postoje tek kad se zna šta smeju da
   urade — bolje nego dugme koje na dodir kaže „ne mogu". iOS daje PushManager SAMO instaliranoj aplikaciji: poruka kaže šta da se uradi, a ne „nije
   podržano". */

export function usePushInfo(status: PushStatus | null): SectionInfo {
  const stored = useSettingsStore((s) => s.ui['push'] === true);
  const unsupported = status?.kind === 'unsupported';
  const on = status ? status.kind === 'on' : stored;
  return {
    visible: true,
    summary: unsupported ? 'nisu dostupna ovde' : on ? 'uključena na ovom uređaju' : 'isključena',
    dot: unsupported ? 'warn' : on ? true : 'warn',
    open: !unsupported && !on
  };
}

/** Stanje obaveštenja (pretplata i ključ se pitaju asinhrono). Osvežava se i posle svake radnje. */
export function usePushStatus(): [PushStatus | null, () => void] {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    void getApp()
      .push.status()
      .then((s) => {
        if (alive) setStatus(s);
      });
    return () => {
      alive = false;
    };
  }, [tick]);
  return [status, () => setTick((n) => n + 1)];
}

export function PushBody({ status, reload }: { status: PushStatus | null; reload: () => void }) {
  const [busy, setBusy] = useState<null | 'on' | 'off' | 'test'>(null);
  const [testLabel, setTestLabel] = useState<string | null>(null);

  if (status?.kind === 'unsupported')
    return status.ios ? (
      <div className="set-st">
        Na iPhoneu obaveštenja radi samo <b>instalirana</b> aplikacija. U Safariju dodirni{' '}
        <b>Podeli → Dodaj na početni ekran</b>, otvori SUB-20 sa ikonice i vrati se ovde.
      </div>
    ) : (
      <div className="set-st">
        Ovaj pregledač ne podržava obaveštenja. Aplikacija radi normalno i bez njih.
      </div>
    );

  const on = status?.kind === 'on';
  const text =
    status == null
      ? 'Proveravam…'
      : status.kind === 'denied'
        ? null
        : status.kind === 'unconfigured'
          ? 'Obaveštenja još nisu podešena na serveru.'
          : on
            ? 'Uključena na ovom uređaju. Podsetnik stiže ujutru, osim na dane odmora.'
            : 'Isključena. Uključivanje traži dozvolu pregledača — jedan dodir.';

  return (
    <>
      <div className="set-st">
        Ujutru stigne kratak podsetnik šta je danas na planu — i poruka kad AI analiza završi dok je
        aplikacija zatvorena. Dani odmora se preskaču.
      </div>
      <div className="btnrow" id="ob-red">
        {status?.kind === 'off' ? (
          <button
            type="button"
            className="btn"
            id="ob-on"
            disabled={busy !== null}
            onClick={() => {
              setBusy('on');
              void getApp()
                .push.enable()
                .then((r) => {
                  if (!r.ok) window.alert(r.error || 'Nije uspelo.');
                })
                .finally(() => {
                  setBusy(null);
                  reload();
                });
            }}
          >
            {busy === 'on' ? 'Uključujem…' : 'Uključi obaveštenja'}
          </button>
        ) : null}
        {on ? (
          <>
            <button
              type="button"
              className="btn ghost sm"
              id="ob-proba"
              disabled={busy !== null}
              onClick={() => {
                setBusy('test');
                setTestLabel('Šaljem…');
                void getApp()
                  .push.test()
                  .then((r) => {
                    setTestLabel(r.ok ? 'Poslato ✓' : 'Nije uspelo');
                    if (!r.ok) setTimeout(() => window.alert(r.error || 'Nije uspelo.'), 100);
                  })
                  .finally(() =>
                    setTimeout(() => {
                      setBusy(null);
                      setTestLabel(null);
                    }, 2000)
                  );
              }}
            >
              {testLabel ?? 'Probno obaveštenje'}
            </button>
            <button
              type="button"
              className="btn ghost sm"
              id="ob-off"
              disabled={busy !== null}
              onClick={() => {
                setBusy('off');
                void getApp()
                  .push.disable()
                  .finally(() => {
                    setBusy(null);
                    reload();
                  });
              }}
            >
              {busy === 'off' ? 'Isključujem…' : 'Isključi'}
            </button>
          </>
        ) : null}
      </div>
      <div className="note-src" id="ob-stanje" style={{ margin: '6px 0 0' }}>
        {status?.kind === 'denied' ? (
          <>
            Obaveštenja su <b>odbijena</b> za ovu stranicu. Uključi ih u podešavanjima pregledača
            (ikonica pored adrese → Obaveštenja), pa se vrati ovde.
          </>
        ) : (
          text
        )}
      </div>
      <Help summary="Šta se šalje i odakle">
        <p>
          Server zna samo <b>datum i jedan red teksta</b> („8×400 m · 12 km") koji mu aplikacija
          sama upiše za narednih nedelju dana. Plan, tempo, puls i istorija ostaju na uređaju.
        </p>
        <p>
          Sadržaj obaveštenja se šifruje ključem koji postoji samo na tvom telefonu — ni Google ni
          Apple ne vide šta piše, iako poruka prolazi kroz njih.
        </p>
        <p>Isključivanje briše pretplatu i sa uređaja i sa servera.</p>
      </Help>
    </>
  );
}
