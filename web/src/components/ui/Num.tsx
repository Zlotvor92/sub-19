import { useEffect, useRef, useState } from 'react';

/* BROJ KOJI SE PRIBLIŽAVA VREDNOSTI (320 ms): samo pri prvom prikazu i pri promeni vrednosti, nikad pri svakom iscrtavanju.
   Prekidljiv (nova vrednost preuzima od prikazane), a pod „smanjeno kretanje" odmah pokazuje tačnu vrednost.
   Čitač ekrana dobija samo konačnu vrednost (skriveni tekst), ne međukorake. */

const reduced = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export function Num({
  value,
  format,
  from = 0,
  ms = 320
}: {
  value: number;
  format: (n: number) => string;
  from?: number;
  ms?: number;
}) {
  const [shown, setShown] = useState(() => (reduced() ? value : from));
  const cur = useRef(shown);
  /* Ref se osvežava posle iscrtavanja (ne u njemu); efekat ispod ga čita tek kad se `value` promeni, pa vidi prikazanu vrednost. */
  useEffect(() => {
    cur.current = shown;
  });
  useEffect(() => {
    if (reduced() || cur.current === value) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = cur.current;
    let raf = 0;
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      setShown(a + (value - a) * e);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return (
    <span className="num">
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
