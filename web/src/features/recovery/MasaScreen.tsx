import { ScreenFrame } from '../../components/ui/Shell';
import { confirmAction } from '../../app/confirm';
import { parseIsoDate } from '../../domain/date';
import { fmtDayMonth, fmtNum, pl3 } from '../../domain/format';
import { useResolvedPlan } from '../../stores';
import { addWeightEntry, removeWeightAt, removeWeightsBefore } from '../../stores/recoveryActions';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useUIStore } from '../../stores/uiStore';
import { WeightCard } from './WeightCard';

/* TELESNA MASA: grafikon, ručni unos (zamenjuje prethodni ručni za isti datum), brisanje merenja i merenja pre početka plana. Isto merenje može da se upiše
   i uz trening (Detalji treninga → Unos), pa se ovde vide oba. */
export function MasaScreen() {
  const plan = useResolvedPlan();
  const kg = useRecoveryStore((s) => s.kg);
  const todayStr = useUIStore((s) => s.today);
  const today = parseIsoDate(todayStr);
  if (!plan || !today) return null;
  const planStart = plan.weeks[0]?.start ?? todayStr;
  const last = kg
    .filter((x) => x && parseIsoDate(x.date))
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return (
    <ScreenFrame>
      <header className="screen-head">
        <h1>Telesna masa</h1>
        <p>
          {last ? `poslednje ${fmtNum(last.kg, 1)} kg · ${fmtDayMonth(last.date)}` : 'bez unosa'}
        </p>
      </header>
      <WeightCard
        kg={kg}
        today={today}
        planStart={planStart}
        onAdd={(date, input) => addWeightEntry(date, input, todayStr)}
        onDelete={(i) => {
          const x = kg[i];
          if (!x) return;
          void confirmAction(`Obrisati merenje ${x.kg} kg od ${fmtDayMonth(x.date)}?`).then(
            (ok) => {
              if (ok) removeWeightAt(i);
            }
          );
        }}
        onDeleteBefore={() => {
          const n = kg.filter((x) => x && x.date < planStart).length;
          void confirmAction(
            `Obrisati ${n} ${pl3(n, 'merenje', 'merenja', 'merenja')} mase pre ${fmtDayMonth(planStart)}? Ovo se ne može poništiti.`
          ).then((ok) => {
            if (ok) removeWeightsBefore(planStart);
          });
        }}
      />
    </ScreenFrame>
  );
}
