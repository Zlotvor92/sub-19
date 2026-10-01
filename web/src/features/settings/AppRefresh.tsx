import { useEffect, useState } from 'react';
import { APP_VERSION } from '../../services/config';
import { readSwState, refreshFromUi } from '../../pwa/register';

/* STANJE SERVICE WORKER-a — VIDLJIVO I RUČNO OSVEŽIVO. Broj verzije u podnožju dolazi iz paketa koji ide network-first, pa skoči čim deploy prođe i
   kad SW i keš još stoje na staroj verziji; ta dva stanja su izgledala isto. Sad se pita SAM SW koju verziju nosi, i nudi se dugme koje ne zavisi od
   toga da li se traka pojavila. */
export function AppRefresh() {
  const [info, setInfo] = useState<React.ReactNode>('Proveravam verziju offline kopije…');
  const [label, setLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void readSwState().then((st) => {
      if (!alive) return;
      if (!st.supported) setInfo('Ovaj pregledač ne čuva offline kopiju.');
      else if (st.waiting)
        setInfo(
          <>
            <b style={{ color: 'var(--amber)' }}>Nova verzija je preuzeta i čeka.</b> Dodirni
            „Osveži aplikaciju" — ništa se ne gubi, podaci ostaju.
          </>
        );
      else if (st.active && st.active !== APP_VERSION)
        setInfo(
          <>
            Offline kopija je na verziji <b>{st.active}</b>, a učitan kod na <b>{APP_VERSION}</b>.
            Dok si na mreži radiš na novom kodu; „Osveži aplikaciju" izjednačava i offline kopiju.
          </>
        );
      else if (st.active) setInfo(`Offline kopija je na verziji ${st.active} — usklađena.`);
      else
        setInfo(
          st.caches.length
            ? `Offline kopija: ${st.caches.join(', ')}. Verziju javlja tek sledeći service worker.`
            : 'Offline kopija se još pravi — otvori aplikaciju ponovo za koji trenutak.'
        );
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <div className="btnrow" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="btn ghost sm"
          id="sw-osvezi"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void refreshFromUi(APP_VERSION, setLabel).then((r) => {
              setBusy(false);
              setLabel(null);
              if (r.kind === 'unsupported')
                window.alert('Ovaj pregledač ne podržava offline režim.');
              else if (r.kind === 'not-arrived')
                window.alert(
                  'Nova verzija još nije stigla do ovog uređaja. Pokušaj ponovo za koji minut.'
                );
              else if (r.kind === 'up-to-date')
                window.alert(`Već si na najnovijoj verziji (${r.version}).`);
            });
          }}
        >
          {label ?? 'Osveži aplikaciju'}
        </button>
      </div>
      <div className="note-src" id="sw-stanje" style={{ margin: '6px 0 0' }}>
        {info}
      </div>
    </>
  );
}
