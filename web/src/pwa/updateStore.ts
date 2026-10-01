import { create } from 'zustand';
import type { WorkerLike } from './updates';

/* Nov service worker koji čeka „Osveži". Sam worker nije serijalizabilan; drži se samo dok traka postoji. */
interface UpdateState {
  worker: WorkerLike | null;
  applying: boolean;
  offer: (w: WorkerLike) => void;
  apply: () => void;
}

export const useUpdateStore = create<UpdateState>()((set, get) => ({
  worker: null,
  applying: false,
  offer(w) {
    if (!get().worker) set({ worker: w });
  },
  apply() {
    const w = get().worker;
    if (!w) return;
    set({ applying: true });
    w.postMessage({ type: 'SKIP_WAITING' });
  }
}));
