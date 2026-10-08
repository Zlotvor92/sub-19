import { ScreenFrame } from '../../components/ui/Shell';
import type { IsoDate } from '../../domain/date';
import { useIcuConnected } from '../../stores';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useUIStore } from '../../stores/uiStore';
import { HrvSection, LoadSection, RestingHrSection } from './cards';
import { ReadinessCard } from './ReadinessCard';
import { useRecoveryModel } from './useRecoveryModel';

/* OPORAVAK: „Da li smem da treniram po planu?“ Redosled je po hitnosti, ne po temi: stanje danas (najlošiji postojeći signal odlučuje), pa opterećenje
   (upozorava PRE nego što nešto zaboli), pa kretanje HRV-a i pulsa u miru. Bol i telesna masa imaju svoje ekrane; predlog za prilagođavanje plana
   zbog bola je u Plan → Prilagodi plan (i jedan red na Danas kad postoji). */
export function OporavakScreen() {
  const m = useRecoveryModel();
  const wellness = useRecoveryStore((s) => s.wellness);
  const icu = useIcuConnected();
  const todayStr = useUIStore((s) => s.today);
  return (
    <ScreenFrame>
      <header className="screen-head">
        <h1>Oporavak</h1>
        <p>Da li smem da treniram po planu?</p>
      </header>
      {m ? (
        <>
          <ReadinessCard model={m.ready} />
          <LoadSection now={m.now} planned={m.ahead} />
          <HrvSection wellness={wellness} connected={icu} today={todayStr as IsoDate} />
          <RestingHrSection wellness={wellness} />
        </>
      ) : null}
    </ScreenFrame>
  );
}
