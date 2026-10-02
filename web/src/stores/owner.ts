import { ADMIN_UID } from '../services/config';
import { isOwnerUid } from '../domain/personal';
import { useAuthStore } from './authStore';

/* VLASNIK. Odlučuje o tome šta se PRIKAZUJE (dugmad za administraciju, ugrađeni plan); pravu proveru radi server nad adresom iz Supabase tokena. */

export const useIsOwner = (): boolean =>
  useAuthStore((s) => s.hasSession && isOwnerUid(s.userId, ADMIN_UID));

export const isOwnerNow = (): boolean => {
  const s = useAuthStore.getState();
  return s.hasSession && isOwnerUid(s.userId, ADMIN_UID);
};
