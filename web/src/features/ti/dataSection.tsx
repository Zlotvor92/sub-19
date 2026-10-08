import { useRef, useState } from 'react';
import { pl3, fmtDayMonthYear } from '../../domain/format';
import { getApp } from '../../app/appContext';
import { confirmAction } from '../../app/confirm';
import { downloadText } from '../../lib/download';
import { useSettingsStore } from '../../stores';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { Help } from '../../components/ui/Disclosure';
import { type SectionInfo } from './sectionInfo';

export function useDataInfo(): SectionInfo {
  const signedIn = useAuthStore((s) => s.hasSession);
  const lastBackup = useSettingsStore((s) => s.ui.lastBackup);
  return {
    visible: true,
    summary: signedIn
      ? 'na serveru · ranije verzije dostupne'
      : `samo na ovom uređaju · backup ${lastBackup ? fmtDayMonthYear(lastBackup) : 'nikad'}`,
    dot: signedIn ? true : lastBackup ? true : 'warn',
    open: false
  };
}

export function DataBody() {
  const signedIn = useAuthStore((s) => s.hasSession);
  const today = useUIStore((s) => s.today);
  const openSheet = useUIStore((s) => s.openSheet);
  const file = useRef<HTMLInputElement>(null);
  const [imported, setImported] = useState(false);

  const doExport = (): void => {
    downloadText(`sub19-backup-${today}.json`, getApp().exportBackup());
  };

  const doImport = async (f: File | undefined): Promise<void> => {
    if (!f) return;
    let raw: unknown;
    try {
      raw = JSON.parse(await f.text());
    } catch (e) {
      window.alert(`Greška pri čitanju fajla: ${e instanceof Error ? e.message : 'nepoznata'}`);
      return;
    }
    const prep = getApp().prepareImport(raw);
    if (!prep.ok) {
      window.alert(
        prep.reason === 'unrecognized'
          ? 'Fajl nije prepoznat kao backup ove aplikacije ili je napravljen u novijoj verziji — ažuriraj aplikaciju pa pokušaj ponovo.'
          : prep.reason === 'broken-plan'
            ? 'Backup sadrži oštećen generisan plan, pa nije uvezen — ništa nije promenjeno.\n\nTvoji trenutni podaci su netaknuti.'
            : `Backup sadrži neispravan identifikator (${prep.detail}), pa nije uvezen — ništa nije promenjeno.\n\nOvo se dešava kod ručno izmenjenog fajla. Tvoji trenutni podaci su netaknuti.`
      );
      return;
    }
    const { workouts, pain, weight } = prep.counts;
    const ok = await confirmAction(
      `Uvoz će PREPISATI postojeće podatke.\n\nU fajlu: ${workouts} ${pl3(workouts, 'trening', 'treninga', 'treninga')}, ${pain} ${pl3(pain, 'zapis', 'zapisa', 'zapisa')} o bolu, ${weight} ${pl3(weight, 'merenje', 'merenja', 'merenja')} mase.\n\nNastaviti?`
    );
    if (!ok) return;
    const r = getApp().commitImport(prep.state);
    if (!r.ok) window.alert(`Uvoz nije uspeo: ${r.error}\n\nVraćeno je prethodno stanje.`);
    else setImported(true);
  };

  return (
    <>
      {signedIn ? (
        <>
          <div className="note-src">
            Podaci se čuvaju na serveru, a server pamti i <b>ranije verzije</b> — greška se može
            vratiti unazad. Backup fajl više nije neophodan; ostaje za slučaj da ti kopija treba van
            aplikacije.
          </div>
          <div className="btnrow">
            <button
              type="button"
              className="btn"
              id="s-ist"
              onClick={() => openSheet({ kind: 'history' })}
            >
              Ranije verzije
            </button>
          </div>
        </>
      ) : (
        <div className="note-src warn">
          Nisi prijavljen, pa podaci žive <b>samo na ovom uređaju</b>. Backup je tada jedina kopija
          — ili se prijavi, pa ih server preuzme.
        </div>
      )}
      <div className="btnrow">
        <button type="button" className="btn ghost sm" id="s-exp" onClick={doExport}>
          Izvezi backup
        </button>
        <button
          type="button"
          className="btn ghost sm"
          id="s-imp"
          onClick={() => file.current?.click()}
        >
          Uvezi backup
        </button>
      </div>
      {imported ? (
        <p className="note-src" role="status">
          Backup je uvezen.
        </p>
      ) : null}
      <input
        ref={file}
        type="file"
        id="s-file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // isti fajl se sme izabrati ponovo
          void doImport(f);
        }}
      />
      {signedIn ? (
        <div className="btnrow">
          <button
            type="button"
            className="btn ghost sm"
            id="s-bug"
            onClick={() => openSheet({ kind: 'bug' })}
          >
            Prijavi problem
          </button>
        </div>
      ) : null}
      <Help summary="Šta server pamti, a šta ne">
        <p>
          Pre svake izmene sačuva se prethodno stanje — najviše 40 verzija i najviše jedna na sat,
          što u praksi pokriva nedeljama unazad.
        </p>
        <p>
          <b>Brisanje naloga briše i istoriju.</b> Obrisano je obrisano; tu backup fajl ostaje
          jedina kopija, i zato ga dijalog za brisanje i traži.
        </p>
      </Help>
    </>
  );
}
