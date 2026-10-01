/* ODLUKE SINHRONIZACIJE — čiste funkcije. Mrežu, tajmere i zastavice drži `services/sync`.

   Model: stanje je JEDAN blob, poslednji upis pobeđuje, ali SE NIKAD NE GAZI TUĐA IZMENA KOJU OVAJ UREĐAJ NIJE
   VIDEO: server drži `updated_at` i `device_id` poslednjeg upisa, a klijent pamti `seenAt` — koji je
   `updated_at` poslednji put video. Tuđi noviji zapis diže traku sa pitanjem umesto da bude pregažen. */

export type ServerRow = { at: string; device: string | null };

/** Šta pri pokretanju: server prazan → pošalji; isti → ok; tuđe novije → pitaj. */
export type StartupDecision = 'push' | 'ok' | 'ask';

/**
 * Odluka pri pokretanju.
 *
 * NOVIJI ZAPIS SA ISTOG UREĐAJA NIJE SUKOB — to je naš sopstveni push koji nismo stigli da zabeležimo. Push
 * se poziva i kad aplikacija odlazi u pozadinu; na telefonu zahtev ume da STIGNE do servera a odgovor nikad do
 * nas (sistem je aplikaciju već zamrznuo), pa `seenAt` ostane star i traka je pitala „na drugom uređaju
 * postoje noviji podaci" iako drugog uređaja nema. Zaštita od TUĐEG novijeg zapisa ostaje netaknuta.
 */
export function decideStartup(
  seenAt: string | null | undefined,
  remote: ServerRow | null,
  myDevice: string | null | undefined
): StartupDecision {
  if (!remote || !remote.at) return 'push';
  if (!seenAt) return 'ask';
  if (remote.at === seenAt) return 'ok';
  if (remote.at > seenAt) {
    if (remote.device && myDevice && remote.device === myDevice) return 'ok';
    return 'ask';
  }
  return 'push';
}

/**
 * Provera PRE svakog upisa (ne samo pri pokretanju): da li je na serveru tuđi zapis noviji od onoga što je
 * ovaj uređaj video. Stanje je jedan blob, pa bi prepis obrisao celu tuđu sesiju (kilaža i bol sa drugog
 * uređaja nestaju bez poruke — unose se RUČNO i ne postoje nigde drugde). Poređenje je po vremenu (`Date`),
 * ne po niski. Sopstveni noviji zapis nije sukob.
 */
export function isForeignNewer(
  remote: ServerRow | null | undefined,
  seenAt: string | null | undefined,
  myDevice: string | null | undefined
): boolean {
  return !!(
    remote &&
    remote.at &&
    seenAt &&
    new Date(remote.at) > new Date(seenAt) &&
    remote.device &&
    remote.device !== myDevice
  );
}

/** Zastavice koje zabranjuju upis (drži ih servis; ovde je pravilo na jednom mestu). */
export interface PushGuards {
  authenticated: boolean;
  /** Lokalni zapis se nije mogao pročitati: `S` je prazan seed, a serverska kopija je jedino mesto gde podaci još postoje. */
  loadFailed: boolean;
  /** Dok traje pitanje o sukobu lokalno stanje NIJE merodavno. */
  conflictOpen: boolean;
}

export type PushVerdict = 'go' | 'skip';

/**
 * NE GURAJ PRAZNO STANJE PREKO SERVERSKE KOPIJE i ne piši dok se sukob ne razreši. Sveže instaliran uređaj
 * ima prazan lokalni zapis; dovoljno je da se aplikacija dodirne dok traka sukoba stoji (ili da automatsko
 * povlačenje sa Strave upiše prvi trening) pa da prazno stanje pregazi sve na serveru. Zašto se gubitak ne
 * primeti odmah: treninzi se sami vrate sa Strave, a kilaža i povrede ne.
 */
export function canPush(g: PushGuards): PushVerdict {
  if (!g.authenticated) return 'skip';
  if (g.loadFailed) return 'skip';
  if (g.conflictOpen) return 'skip';
  return 'go';
}

/** Rok odloženog upisa posle izmene: `save()` se zove i na svaki pritisak tastera. */
export const PUSH_DEBOUNCE_MS = 4000;

/**
 * Ima li na ovom uređaju IŠTA što bi vredelo poslati. Gleda samo ono što se unosi rukom ili povlači — ne i
 * podešavanja, koja postoje i u praznom seedu. Služi da „Zadrži sa telefona" na svežem uređaju traži još jednu
 * potvrdu: prazno preko punog je najskuplja greška ovog ekrana (treninzi se vrate sa Strave, kilaža i povrede ne).
 */
export function isLocalEmpty(
  s:
    | {
        log?: object | null;
        knee?: readonly unknown[] | null;
        kg?: readonly unknown[] | null;
        t3k?: readonly unknown[] | null;
        wellness?: object | null;
        pred?: object | null;
      }
    | null
    | undefined
): boolean {
  if (!s) return true;
  const n = (x: readonly unknown[] | null | undefined): number => (Array.isArray(x) ? x.length : 0);
  const k = (o: object | null | undefined): number => Object.keys(o ?? {}).length;
  return (
    k(s.log) === 0 &&
    n(s.knee) === 0 &&
    n(s.kg) === 0 &&
    n(s.t3k) === 0 &&
    k(s.wellness) === 0 &&
    k(s.pred) === 0
  );
}
