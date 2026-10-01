import { announcementToShow, ANNOUNCEMENT, backupDue } from '../../domain/settings';
import { addDays, parseIsoDate } from '../../domain/date';
import { getApp } from '../../app/appContext';
import { downloadText } from '../../lib/download';
import { useSettingsStore } from '../../stores';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';

/* TRAKE NA VRHU „DANAS". Backup: nudi se neprijavljenom (server nosi podatke prijavljenom); „Kasnije" odlaže za nedelju dana. Objava „novo": oba
   dugmeta zatvaraju traku zauvek — i „video sam" i „ne zanima me" su odgovor; traka koja se vraća posle odgovora je greška, ne podsetnik. */
export function Banners({ today }: { today: string }) {
  const ui = useSettingsStore((s) => s.ui);
  const patchUi = useSettingsStore((s) => s.patchUi);
  const signedIn = useAuthStore((s) => s.hasSession);
  const setTab = useUIStore((s) => s.setTab);
  const announcement = announcementToShow(ANNOUNCEMENT, signedIn, ui);
  const seen = (): void => {
    if (ANNOUNCEMENT) patchUi({ novo: ANNOUNCEMENT.key });
  };
  return (
    <>
      {backupDue(today, ui, signedIn) ? (
        <div className="bban">
          <span style={{ flex: 1 }}>Uradi backup podataka.</span>
          <button
            type="button"
            id="bb-do"
            onClick={() => downloadText(`sub19-backup-${today}.json`, getApp().exportBackup())}
          >
            Izvezi
          </button>
          <button
            type="button"
            id="bb-later"
            style={{ color: 'var(--txt3)' }}
            onClick={() => {
              const day = parseIsoDate(today);
              if (day) patchUi({ snooze: addDays(day, 7) });
            }}
          >
            Kasnije
          </button>
        </div>
      ) : null}
      {announcement ? (
        <div className="nban">
          <div className="nb-t">
            <b>{announcement.title}</b>
            <small>{announcement.text}</small>
          </div>
          <div className="nb-d">
            <button
              type="button"
              id="nb-go"
              onClick={() => {
                seen();
                setTab('zajed');
              }}
            >
              {announcement.button}
            </button>
            <button type="button" id="nb-x" aria-label="Zatvori" onClick={seen}>
              Sakrij
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
