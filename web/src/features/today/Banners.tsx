import { announcementToShow, ANNOUNCEMENT, backupDue } from '../../domain/settings';
import { addDays, parseIsoDate } from '../../domain/date';
import { getApp } from '../../app/appContext';
import { downloadText } from '../../lib/download';
import { foreignPlanWithEntries } from '../../domain/personal';
import { useSettingsStore, useTrainingStore } from '../../stores';
import { useIsOwner } from '../../stores/owner';
import { useAuthStore } from '../../stores/authStore';
import { COMMUNITY_ENABLED } from '../../services/config';
import { useUIStore } from '../../stores/uiStore';

/* TRAKE NA VRHU „DANAS". Backup: nudi se neprijavljenom (server nosi podatke prijavljenom); „Kasnije" odlaže za nedelju dana. Objava „novo": oba
   dugmeta zatvaraju traku zauvek — i „video sam" i „ne zanima me" su odgovor; traka koja se vraća posle odgovora je greška, ne podsetnik. */
export function Banners({ today }: { today: string }) {
  const ui = useSettingsStore((s) => s.ui);
  const patchUi = useSettingsStore((s) => s.patchUi);
  const signedIn = useAuthStore((s) => s.hasSession);
  const setTab = useUIStore((s) => s.setTab);
  /* Jedina objava je o Zajednici: dok je Zajednica ugašena, nema šta da se objavi. */
  const announcement = COMMUNITY_ENABLED ? announcementToShow(ANNOUNCEMENT, signedIn, ui) : null;
  const hasGenPlan = useTrainingStore((s) => !!s.genPlan);
  const log = useTrainingStore((s) => s.log);
  const owner = useIsOwner();
  const setWizard = useUIStore((s) => s.setWizard);
  /* Predlog, ne prinuda: plan koji gleda nije njegov, ali ima unose na njemu. */
  const foreign = foreignPlanWithEntries({ hasGenPlan, isOwner: owner, log });
  const seen = (): void => {
    if (ANNOUNCEMENT) patchUi({ novo: ANNOUNCEMENT.key });
  };
  return (
    <>
      {foreign ? (
        <div className="kb warn">
          <div style={{ flex: 1 }}>
            <div>Ovo nije tvoj plan</div>
            <small>
              Gledaš ugrađeni plan sa tuđim datumom trke i tuđim tempom. Napravi svoj — postojeći
              unosi ostaju sačuvani u backup-u.
            </small>
          </div>
          <button
            type="button"
            id="tp-gen"
            style={{
              color: 'var(--amber)',
              fontWeight: 800,
              fontSize: '.8rem',
              padding: '6px 10px',
              whiteSpace: 'nowrap'
            }}
            onClick={() => {
              /* JEDINI dijalog koji NAMERNO nije kapija: ovo je ponuda (čarobnjak se otvara u oba slučaja), pa prigušen dijalog znači samo „bez backupa". */
              if (
                window.confirm(
                  'Prvo izvezi backup postojećih unosa?\n\nOK = izvezi pa nastavi\nOtkaži = idi odmah na pravljenje plana'
                )
              )
                downloadText(`sub19-backup-${today}.json`, getApp().exportBackup());
              setWizard(true);
            }}
          >
            Napravi svoj
          </button>
        </div>
      ) : null}
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
