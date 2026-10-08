import { parseIsoDate, addDays } from '../../domain/date';
import { backupDue } from '../../domain/settings';
import { foreignPlanWithEntries } from '../../domain/personal';
import { getApp } from '../../app/appContext';
import { Notice } from '../../components/ui/primitives';
import { downloadText } from '../../lib/download';
import { useSettingsStore, useTrainingStore } from '../../stores';
import { useAuthStore } from '../../stores/authStore';
import { useIsOwner } from '../../stores/owner';
import { useUIStore } from '../../stores/uiStore';
import { useAdjustments } from '../plan/useAdjustments';
import { useRecoveryModel } from '../recovery/useRecoveryModel';

/* UPOZORENJA NA DANAS — samo ono što je relevantno SADA, svako u jednom redu sa jednom radnjom: tuđ plan, oporavak, predlozi za prilagođavanje plana, backup.
   Kad nema ničega, ništa se ne prikazuje (nema „sve je u redu“ trake). Detalji i radnje žive na svom mestu (Oporavak, Plan → Prilagodi plan); ovde je samo
   upućivanje. Sistemske trake (sukob, oštećeno stanje, nova verzija) su zasebne (`BannerHost`) jer traže odluku. */
export function Advisories({ today }: { today: string }) {
  const ui = useSettingsStore((s) => s.ui);
  const patchUi = useSettingsStore((s) => s.patchUi);
  const signedIn = useAuthStore((s) => s.hasSession);
  const hasGenPlan = useTrainingStore((s) => !!s.genPlan);
  const log = useTrainingStore((s) => s.log);
  const owner = useIsOwner();
  const openScreen = useUIStore((s) => s.openScreen);
  const setWizard = useUIStore((s) => s.setWizard);
  const rec = useRecoveryModel();
  const adj = useAdjustments();

  const foreign = foreignPlanWithEntries({ hasGenPlan, isOwner: owner, log });
  const injury = rec?.proposal ?? null;
  const tone = rec?.ready.tone;
  const worrying = !injury && (tone === 'amber' || tone === 'red');
  const items: React.ReactNode[] = [];

  if (foreign)
    items.push(
      <Notice
        key="foreign"
        tone="warn"
        title="Ovo nije tvoj plan"
        actions={[
          {
            label: 'Napravi svoj',
            onClick: () => {
              /* JEDINI dijalog koji NAMERNO nije kapija: ovo je ponuda (čarobnjak se otvara u oba slučaja), pa prigušen dijalog znači samo „bez backupa“. */
              if (
                window.confirm(
                  'Prvo izvezi backup postojećih unosa?\n\nOK = izvezi pa nastavi\nOtkaži = idi odmah na pravljenje plana'
                )
              )
                downloadText(`sub19-backup-${today}.json`, getApp().exportBackup());
              setWizard(true);
            }
          }
        ]}
      >
        Gledaš ugrađeni plan sa tuđim datumom trke i tuđim tempom. Postojeći unosi ostaju sačuvani u
        backup-u.
      </Notice>
    );

  if (injury)
    items.push(
      <Notice
        key="injury"
        tone={injury.urgent ? 'bad' : 'warn'}
        title="Plan se može prilagoditi"
        actions={[
          { label: 'Prilagodi plan', onClick: () => openScreen({ kind: 'plan-prilagodi' }) }
        ]}
      >
        {injury.message}
      </Notice>
    );
  else if (worrying && rec)
    items.push(
      <Notice
        key="ready"
        tone={tone === 'red' ? 'bad' : 'warn'}
        title={`Oporavak: ${rec.ready.word.toLowerCase()}`}
        actions={[{ label: 'Pogledaj oporavak', onClick: () => openScreen({ kind: 'oporavak' }) }]}
      >
        {rec.ready.action ?? rec.ready.why}
      </Notice>
    );

  if (adj.proposal)
    items.push(
      <Notice
        key="pace"
        title="Tempo se može prilagoditi tvojoj formi"
        actions={[{ label: 'Pogledaj', onClick: () => openScreen({ kind: 'plan-prilagodi' }) }]}
      >
        {adj.proposal.message}
      </Notice>
    );

  if (backupDue(today, ui, signedIn))
    items.push(
      <Notice
        key="backup"
        title="Uradi backup podataka"
        actions={[
          {
            label: 'Izvezi',
            onClick: () => downloadText(`sub19-backup-${today}.json`, getApp().exportBackup())
          },
          {
            label: 'Kasnije',
            quiet: true,
            onClick: () => {
              const day = parseIsoDate(today);
              if (day) patchUi({ snooze: addDays(day, 7) });
            }
          }
        ]}
      >
        Bez prijave su podaci samo na ovom uređaju.
      </Notice>
    );

  return items.length ? <div className="notices">{items}</div> : null;
}
