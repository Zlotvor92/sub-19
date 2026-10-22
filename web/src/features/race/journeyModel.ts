/* PUT DO CILJA: raspored tačaka na jednoj vremenskoj osi (brže je desno): polazna forma, procena danas, cilj, projekcija plana.
   Samo geometrija — vrednosti dolaze iz domena. Tačke dobijaju prostor 6–94 %, da oznake ne iskoče iz okvira.
   Oznake idu iznad ili ispod ose: „sada" i projekcija po pravilu gore, start i cilj dole; ako bi se dve oznake na istoj strani
   dodirnule (bliža od `MIN_GAP` % ose), kasnija prelazi na drugu stranu. */

export type JourneyKey = 'start' | 'now' | 'goal' | 'projection';
export type JourneySide = 'up' | 'down';
export type JourneyAlign = 'start' | 'center' | 'end';
export interface JourneyPoint {
  key: JourneyKey;
  sec: number;
  /** Položaj na osi u procentima (0 = najsporije, 100 = najbrže). */
  pos: number;
  side: JourneySide;
  /** Poravnanje oznake uz tačku: uz ivicu okvira oznaka raste ka sredini, ne napolje. */
  align: JourneyAlign;
}

/** Najmanji razmak (u % ose) dve oznake na istoj strani; oznaka je široka oko četvrtine ose na telefonu. */
export const MIN_GAP = 26;
const PREFERRED: Readonly<Record<JourneyKey, JourneySide>> = {
  start: 'down',
  now: 'up',
  goal: 'down',
  projection: 'up'
};
const fin = (x: number | null | undefined): x is number =>
  typeof x === 'number' && Number.isFinite(x);

export function journeyModel(input: {
  start: number | null;
  now: number | null;
  goal: number | null;
  projection: number | null;
}): JourneyPoint[] {
  const raw: Array<[JourneyKey, number | null]> = [
    ['start', input.start],
    ['now', input.now],
    ['goal', input.goal],
    ['projection', input.projection]
  ];
  const pts = raw.filter((x): x is [JourneyKey, number] => fin(x[1]));
  if (pts.length < 2) return [];
  const secs = pts.map((p) => p[1]);
  const slow = Math.max(...secs);
  const fast = Math.min(...secs);
  const span = slow - fast;
  const placed = pts
    .map(([key, sec]) => ({ key, sec, pos: span === 0 ? 50 : 6 + ((slow - sec) / span) * 88 }))
    .sort((a, b) => a.pos - b.pos);
  const lastPos: Record<JourneySide, number> = { up: -Infinity, down: -Infinity };
  const out = placed.map((p): JourneyPoint => {
    const pref = PREFERRED[p.key];
    const other: JourneySide = pref === 'up' ? 'down' : 'up';
    const side =
      p.pos - lastPos[pref] >= MIN_GAP || p.pos - lastPos[other] < MIN_GAP ? pref : other;
    lastPos[side] = p.pos;
    const align: JourneyAlign = p.pos < 20 ? 'start' : p.pos > 80 ? 'end' : 'center';
    return { ...p, side, align };
  });
  return out;
}

/** Razlika procene i cilja u sekundama (pozitivno = procena sporija od cilja); `null` kad ne može da se izračuna. */
export function gapToGoal(now: number | null, goal: number | null): number | null {
  return fin(now) && fin(goal) ? Math.round(now - goal) : null;
}
