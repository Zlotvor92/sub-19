/* PREPOZNAVANJE RADNIH SEGMENATA direktno iz streamova po brzini — nezavisno od Stravinih krugova (koji
   nepouzdano vraćaju čas strukturne čas auto-1km). Validirano na stvarnim strukturama: 5×1 km
   intervali (±4 s po repu), 2×2,5 km tempo (±4 s), nula lažnih segmenata na lakom trčanju i
   stridovima. Svi pragovi ovde su INŽENJERSKI IZBORI kalibrisani na stvarnim i sintetičkim podacima
   (250+ scenarija), NE merene konstante — v. docs/TRAINING_ENGINE_AUDIT.md (klasa H). */

import type { ActivityStreams, StreamSeries, WorkSegment } from './types';

const MOVING_MIN_MS = 0.7; // m/s: ispod ovoga se ne računa kao kretanje
const SMOOTH_HALF_WINDOW = 7; // ±7 tačaka (~15 s) protiv GPS šuma
const MIN_POINTS = 120;

/** K-means u jednoj dimenziji (brzine). Vraća sortirane centre. */
export function kmeans1d(values: readonly number[], k: number): number[] {
  let mn = Infinity;
  let mx = -Infinity;
  for (const x of values) {
    if (x < mn) mn = x;
    if (x > mx) mx = x;
  }
  const c: number[] = [];
  for (let i = 0; i < k; i++) c.push(mn + ((mx - mn) * i) / (k - 1));
  for (let it = 0; it < 60; it++) {
    const s = new Array<number>(k).fill(0);
    const cnt = new Array<number>(k).fill(0);
    for (const x of values) {
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < k; i++) {
        const d = Math.abs(x - (c[i] as number));
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      s[bi] = (s[bi] as number) + x;
      cnt[bi] = (cnt[bi] as number) + 1;
    }
    let moved = false;
    for (let i = 0; i < k; i++) {
      if (cnt[i]) {
        const nc = (s[i] as number) / (cnt[i] as number);
        if (Math.abs(nc - (c[i] as number)) >= 0.005) moved = true;
        c[i] = nc;
      }
    }
    if (!moved) break;
  }
  return c.sort((a, b) => a - b);
}

interface Run {
  state: boolean;
  start: number;
  end: number;
}

/**
 * Izvlači naizmenične „brzo/sporo" konture, spajajući kratke suprotne upade (`mergeSec`) SAMO ako je nivo
 * brzine pre i posle sličan (`gapSimilarTol`) — prava buka unutar iste namere, ne prelaz između dva tempa.
 */
export function extractRuns(
  v: readonly number[],
  dist: readonly number[],
  time: readonly number[],
  thr: number,
  minDist: number,
  minDur: number,
  mergeSec: number,
  gapSimilarTol: number | null
): Run[] {
  const n = v.length;
  const hi = v.map((x) => x >= thr);
  const runs: Run[] = [];
  let i = 0;
  while (i < n) {
    const state = hi[i] as boolean;
    let j = i;
    while (j < n && hi[j] === state) j++;
    runs.push({ state, start: i, end: j });
    i = j;
  }
  for (let k = 1; k < runs.length - 1; k++) {
    const prev = runs[k - 1] as Run;
    const cur = runs[k] as Run;
    const next = runs[k + 1] as Run;
    const dur = (time[cur.end - 1] as number) - (time[cur.start] as number);
    if (cur.state !== prev.state && dur <= mergeSec) {
      if (gapSimilarTol == null) {
        prev.end = next.end;
        runs.splice(k, 2);
        k--;
        continue;
      }
      const avgV = (a: number, b: number): number => {
        let s = 0;
        let c = 0;
        for (let x = a; x < b; x++) {
          s += v[x] as number;
          c++;
        }
        return c ? s / c : 0;
      };
      const before = avgV(Math.max(0, prev.start), prev.end);
      const after = avgV(next.start, Math.min(n, next.end));
      if (before > 0 && Math.abs(after - before) / before <= gapSimilarTol) {
        prev.end = next.end;
        runs.splice(k, 2);
        k--;
      }
    }
  }
  return runs.filter((r) => {
    const dd = (dist[r.end - 1] as number) - (dist[r.start] as number);
    const dt = (time[r.end - 1] as number) - (time[r.start] as number);
    return dd >= minDist && dt >= minDur;
  });
}

/** Prosek pozitivnih uzoraka u [a, b); `null` kad ih nema ili niz ne postoji. */
function avgPositive(arr: StreamSeries | undefined, a: number, b: number): number | null {
  if (!arr) return null;
  let s = 0;
  let c = 0;
  for (let k = a; k < b && k < arr.data.length; k++) {
    const x = arr.data[k];
    if (x != null && x > 0) {
      s += x;
      c++;
    }
  }
  return c ? s / c : null;
}
const roundOrNull = (x: number | null): number | null => (x != null ? Math.round(x) : null);

function segmentFromRun(
  r: Run,
  dist: readonly number[],
  time: readonly number[],
  hr: StreamSeries | undefined,
  cad: StreamSeries | undefined,
  wat: StreamSeries | undefined,
  offset: number
): Omit<WorkSegment, 'i'> {
  const a = r.start + offset;
  const b = r.end + offset;
  const dd = (dist[b - 1] as number) - (dist[a] as number);
  const dt = (time[b - 1] as number) - (time[a] as number);
  return {
    distM: Math.round(dd),
    paceSec: Math.round(dt / (dd / 1000)),
    avgHr: roundOrNull(avgPositive(hr, a, b)),
    cadence: roundOrNull(avgPositive(cad, a, b)),
    watts: roundOrNull(avgPositive(wat, a, b))
  };
}

/**
 * Pokušaj da razreši NAIZMENIČNU strukturu UNUTAR jednog spoljašnjeg „radnog" bloka (npr. over/under blok,
 * koji spoljašnji prolaz vidi kao jedan kontinuiran rad). Prihvata SAMO ako: (a) je blok dovoljno velik da
 * uverljivo sadrži VIŠE repova, (b) je lokalni k=2 odnos jasno iznad šum-plafona (~1,02; ovde 1,06),
 * (c) rezultat pokriva VEĆINU bloka, (d) postoje 2+ „brza" ciklusa. Inače `null` — pozivalac zadržava ceo
 * blok kao JEDAN segment (bezbedan rezervni put, nikad ne gubi blok).
 */
function tryInnerResolve(
  v: readonly number[],
  dist: readonly number[],
  time: readonly number[],
  blockDist: number,
  blockDur: number
): Run[] | null {
  if (v.length < 20) return null;
  if (!(blockDur >= 240 || blockDist >= 900)) return null;
  const c2 = kmeans1d(v, 2);
  const lo = c2[0] as number;
  const hi = c2[1] as number;
  if (!(lo > 0 && hi / lo >= 1.06)) return null;
  const localThr = (lo + hi) / 2;
  const runs = extractRuns(v, dist, time, localThr, 150, 20, 20, 0.25);
  if (runs.filter((r) => r.state).length < 2) return null;
  const covered = runs.reduce(
    (s, r) => s + ((dist[r.end - 1] as number) - (dist[r.start] as number)),
    0
  );
  if (blockDist > 0 && covered / blockDist < 0.75) return null;
  return runs;
}

/**
 * Radni segmenti iz streamova. `null` = streamovi nisu upotrebljivi (nema ih dovoljno ili im se dužine
 * razlikuju); `[]` = kontinuirano trčanje, nema jasnog radnog moda.
 *
 * Postepeno popustljiviji pokušaji, STANI na prvom koji uspe: k=3 (1,25×: hod/džog/rad — klasični intervali
 * ili piramida) → k=2 (1,4×: tempo, WU/CD naspram kontinuiranog rada) → k=2 permisivno (1,13×: fartlek,
 * odmor je džogiranje) uz ogradu da „brzi" udeo bude jasna MANJINA (5–70 %).
 */
export function detectWorkSegments(
  streams: ActivityStreams | null | undefined
): WorkSegment[] | null {
  const dist = streams?.distance?.data;
  const time = streams?.time?.data;
  const hr = streams?.heartrate;
  const cad = streams?.cadence;
  const wat = streams?.watts;
  if (
    !Array.isArray(dist) ||
    !Array.isArray(time) ||
    dist.length < MIN_POINTS ||
    dist.length !== time.length
  )
    return null;
  const d = dist as readonly number[];
  const t = time as readonly number[];
  const n = d.length;

  const v = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - SMOOTH_HALF_WINDOW);
    const b = Math.min(n - 1, i + SMOOTH_HALF_WINDOW);
    const dd = (d[b] as number) - (d[a] as number);
    const dt = (t[b] as number) - (t[a] as number);
    v[i] = dt > 0 ? dd / dt : 0;
  }

  const mv = v.filter((x) => x > MOVING_MIN_MS);
  if (mv.length < MIN_POINTS) return null;
  let thr: number | null = null;
  let permissive = false;
  const c3 = kmeans1d(mv, 3);
  if ((c3[2] as number) / (c3[1] as number) >= 1.25) {
    thr = ((c3[1] as number) + (c3[2] as number)) / 2;
  } else {
    const c2 = kmeans1d(mv, 2);
    const lo = c2[0] as number;
    const hi = c2[1] as number;
    if (hi / lo >= 1.4) thr = (lo + hi) / 2;
    else if (lo > 0 && hi / lo >= 1.13) {
      thr = (lo + hi) / 2;
      permissive = true;
    }
  }
  if (thr == null) return []; // kontinuirano trčanje — nema jasnog radnog moda

  /* Maska radnih tačaka + PAMETNO spajanje rupa ≤ 8 s: spoji SAMO ako je nivo brzine pre/posle rupe sličan
     (buka unutar jednog repa) — inače je to PRELAZ između dva tempa i spajanje bi stopilo dva repa u jedan. */
  const work = v.map((x) => x >= thr);
  let i = 0;
  while (i < n) {
    if (!work[i]) {
      let j = i;
      while (j < n && !work[j]) j++;
      if (i > 0 && j < n) {
        const gap = (t[j] as number) - (t[i - 1] as number);
        if (gap <= 8) {
          const avgV = (a: number, b: number, dir: number): number => {
            let s = 0;
            let c = 0;
            for (let k = 1; k <= 5; k++) {
              const p = dir < 0 ? a - k : b + k - 1;
              if (p >= 0 && p < n) {
                s += v[p] as number;
                c++;
              }
            }
            return c ? s / c : 0;
          };
          const before = avgV(i, i, -1);
          const after = avgV(j, j, 1);
          if (before > 0 && Math.abs(after - before) / before <= 0.15) {
            for (let k = i; k < j; k++) work[k] = true;
          }
        }
      }
      i = Math.max(j, i + 1);
    } else i++;
  }

  /* Ograda ZA PERMISIVNI prag: „brzi" udeo mora biti jasna manjina ukupnog trčanja. */
  if (permissive) {
    const hiTotal = work.filter(Boolean).length;
    const frac = hiTotal / mv.length;
    if (frac < 0.05 || frac > 0.7) return [];
  }

  /* Segmenti: odbaci kraće od 200 m / 45 s (150 m / 30 s za permisivan prag — fartlek-ciklusi su kraći). Za
     svaki blok pokušaj UNUTRAŠNJU rezoluciju naizmenične strukture. */
  const segs: Array<Omit<WorkSegment, 'i'>> = [];
  i = 0;
  while (i < n) {
    if (work[i]) {
      let j = i;
      while (j < n && work[j]) j++;
      const dd = (d[j - 1] as number) - (d[i] as number);
      const dt = (t[j - 1] as number) - (t[i] as number);
      const minD = permissive ? 150 : 200;
      const minT = permissive ? 30 : 45;
      if (dd >= minD && dt >= minT) {
        const inner = tryInnerResolve(v.slice(i, j), d.slice(i, j), t.slice(i, j), dd, dt);
        if (inner) {
          for (const r of inner) segs.push(segmentFromRun(r, d, t, hr, cad, wat, i));
        } else {
          segs.push({
            distM: Math.round(dd),
            paceSec: Math.round(dt / (dd / 1000)),
            avgHr: roundOrNull(avgPositive(hr, i, j)),
            cadence: roundOrNull(avgPositive(cad, i, j)),
            watts: roundOrNull(avgPositive(wat, i, j))
          });
        }
      }
      i = j;
    } else i++;
  }
  return segs.map((s, idx) => ({ ...s, i: idx + 1 }));
}
