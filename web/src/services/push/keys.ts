/* Ključevi Web Push-a (base64url ↔ bajtovi). Treba `atob`, pa živi u servisnom sloju, ne u domenu. */

/** Web Push traži base64url ključ kao bajtove. */
export function keyBytes(b64: string): Uint8Array {
  const t = String(b64).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Da li postojeća pretplata pripada ključu koji server SADA koristi. Ako ne, mora da se poništi pa napravi nova — inače push servis odbija svaku
 * poruku, a ništa u aplikaciji to ne pokazuje. Safari ne izlaže `options` — tada se veruje.
 */
export function sameKey(
  applicationServerKey: ArrayBuffer | null | undefined,
  key: string
): boolean {
  try {
    if (!applicationServerKey) return true;
    const a = new Uint8Array(applicationServerKey);
    const b = keyBytes(key);
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  } catch {
    return true;
  }
}
