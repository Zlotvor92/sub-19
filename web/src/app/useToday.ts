import { useEffect } from 'react';
import { localDate, msUntilMidnight } from '../lib/clock';
import { useUIStore } from '../stores/uiStore';

/* „DANAS" DOK APLIKACIJA STOJI OTVORENA. Tajmer cilja prvu sekundu posle ponoći i prezakazuje se sam; povratak u aplikaciju (`visibilitychange`) je drugi
   okidač — tajmer ne preživljava zamrznutu pozadinu, a `visibilitychange` ume. Bez ovoga „Završi trening" posle ponoći upiše JUČERAŠNJI datum, a
   zaglavlje („Nedelja N · X dana do trke") ostane na starom danu. */

export function useToday(): string {
  const today = useUIStore((s) => s.today);
  const setToday = useUIStore((s) => s.setToday);
  useEffect(() => {
    const refresh = (): void => setToday(localDate());
    refresh();
    let t: ReturnType<typeof setTimeout>;
    const arm = (): void => {
      t = setTimeout(() => {
        refresh();
        arm();
      }, msUntilMidnight());
    };
    arm();
    const onVis = (): void => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [setToday]);
  return today;
}
