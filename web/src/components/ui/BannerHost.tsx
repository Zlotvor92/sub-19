import { useUIStore, type Banner } from '../../stores/uiStore';

/* TRAKE (sukob sinhronizacije, oštećen zapis, upis ne radi, novo ažuriranje). Imaju SVOJU neprozirnu podlogu (v. `.traka` u
   CSS-u: staklo bez zamućenja bi bilo prozor kroz koji se vidi kartica ispod) — traka traži odluku i mora da se pročita iz
   prvog pokušaja. `role="alert"` za greške, `status` za ostalo. Akcije se vezuju po `id` preko `onAction`. */

export function BannerHost({ onAction }: { onAction: (banner: Banner, actionId: string) => void }) {
  const banners = useUIStore((s) => s.banners);
  return (
    <>
      {banners.map((b, i) => (
        <div
          key={b.id}
          id={b.id}
          className={`traka ${b.kind === 'info' ? '' : b.kind}`}
          role={b.kind === 'greska' ? 'alert' : 'status'}
          style={{ zIndex: 211, ...(i ? { bottom: `calc(var(--sab) + ${84 + i * 8}px)` } : {}) }}
        >
          <b>{b.title}</b>
          {b.body ? <p>{b.body}</p> : null}
          {b.actions?.length ? (
            <div className="btnrow">
              {b.actions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`btn${a.ghost ? ' ghost' : ''}`}
                  onClick={() => onAction(b, a.id)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </>
  );
}
