import { useEffect } from 'react';
import { useSyncStore } from '../stores/syncStore';
import { useUIStore } from '../stores/uiStore';

/* TRAKE KOJE PROIZLAZE IZ STANJA SINHRONIZACIJE. Uslov i tekst su na jednom mestu; akcije vezuje `App`
   (`handleBannerAction`). Traka sukoba NAMERNO nema podrazumevanu akciju: svaka od dve strane je nečije stvarno trčanje. */

export const BANNER = {
  conflict: 'sync-sukob',
  loadFailure: 'stanje-osteceno',
  writeFailed: 'upis-pao'
} as const;

export function useSystemBanners(): void {
  const conflict = useSyncStore((s) => s.conflict);
  const loadFailure = useSyncStore((s) => s.loadFailure);
  const writeFailed = useSyncStore((s) => s.writeFailed);
  const { pushBanner, removeBanner } = useUIStore.getState();

  useEffect(() => {
    if (conflict) {
      const when = new Date(conflict.remoteAt).toLocaleString('sr-RS');
      pushBanner({
        id: BANNER.conflict,
        kind: 'upozorenje',
        title: 'Podaci se razlikuju',
        body: `Na drugom uređaju postoje noviji podaci (${when}). Dok ne izabereš, ništa se ne menja. „Uzmi sa servera" prepisuje izmene na ovom uređaju. „Zadrži sa telefona" prepisuje one na serveru.`,
        actions: [
          { id: 'pull', label: 'Uzmi sa servera' },
          { id: 'push', label: 'Zadrži sa telefona', ghost: true }
        ]
      });
    } else removeBanner(BANNER.conflict);
  }, [conflict, pushBanner, removeBanner]);

  useEffect(() => {
    if (loadFailure) {
      const kb = Math.max(1, Math.round(loadFailure.bytes / 1024));
      pushBanner({
        id: BANNER.loadFailure,
        kind: 'greska',
        title: 'Sačuvani podaci se ne mogu pročitati',
        body: `Zapis na ovom uređaju je oštećen (${kb} KB). Ništa nije obrisano — sirov sadržaj je sačuvan i možeš ga skinuti. Slanje na server je zaustavljeno dok ne odlučiš, da prazno stanje ne bi prepisalo ono što je gore. Ako koristiš nalog, „Uzmi sa servera" je najbrži put nazad. Spašeni fajl zadrži za svaki slučaj.`,
        actions: [
          { id: 'download', label: 'Skini spašeno' },
          { id: 'server', label: 'Uzmi sa servera', ghost: true }
        ]
      });
    } else removeBanner(BANNER.loadFailure);
  }, [loadFailure, pushBanner, removeBanner]);

  useEffect(() => {
    if (writeFailed) {
      pushBanner({
        id: BANNER.writeFailed,
        kind: 'upozorenje',
        title: 'Čuvanje na uređaju ne radi',
        body: `Pregledač je odbio upis (${writeFailed}) — najčešće je skladište puno. Rad u ovoj sesiji se nastavlja i šalje se na server ako si prijavljen, ali zatvaranje aplikacije briše nesačuvano. Napravi backup i oslobodi prostor.`,
        actions: [{ id: 'ok', label: 'U redu', ghost: true }]
      });
    } else removeBanner(BANNER.writeFailed);
  }, [writeFailed, pushBanner, removeBanner]);
}
