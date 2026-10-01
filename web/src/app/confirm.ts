/* POTVRDA: `await confirmAction('…')` → `true`/`false`. Stari `potvrdi()` je zvao sistemski `confirm()`, koji instalirane
   PWA i deo pregledača prigušuju (vraća `false` bez prikazivanja), pa je dvadesetak radnji tiho „ne radilo ništa" — zato je
   postojala zaobilaznica sa dva dodira. Ovde je dijalog sopstveni (`ConfirmHost`), pa ga pregledač ne može progutati. */

import { useUIStore } from '../stores/uiStore';

let seq = 0;

export function confirmAction(text: string, key?: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    /* Novo pitanje dok je staro otvoreno: staro se zatvara kao „ne" (nikad se ne ostavlja viseće obećanje). */
    useUIStore.getState().confirm?.resolve(false);
    useUIStore.getState().setConfirm({
      id: ++seq,
      text,
      ...(key ? { key } : {}),
      resolve: (ok) => {
        useUIStore.getState().setConfirm(null);
        resolve(ok);
      }
    });
  });
}
