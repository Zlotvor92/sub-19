/* Tipovi aktivnosti i streamova. Oblik streamova je Stravin (`{ data: number[] }` po ključu) — to je
   spoljni ugovor, pa su svi nizovi „možda sa rupama" (`null` u uzorku znači da senzor nije izmerio). */

export interface StreamSeries<T = number | null> {
  data: ReadonlyArray<T>;
}

export interface ActivityStreams {
  distance?: StreamSeries<number>;
  time?: StreamSeries<number>;
  heartrate?: StreamSeries;
  cadence?: StreamSeries;
  watts?: StreamSeries;
  altitude?: StreamSeries;
  temp?: StreamSeries;
  /** Da li se trkač kretao u tom uzorku (Strava: bool, neki izvori: 0/1). */
  moving?: StreamSeries<boolean | number | null>;
}

/** Radni segment prepoznat iz streamova. */
export interface WorkSegment {
  /** 1-indeksirani redni broj. */
  i: number;
  distM: number;
  paceSec: number;
  avgHr: number | null;
  cadence: number | null;
  watts: number | null;
}

/** Jedan kilometar iz streamova. */
export interface PerKmRow {
  km: number;
  /** Verzija računanja (`PERKM_VERSION`); kad se promeni, već sinhronizovani treninzi se osvežavaju. */
  v: number;
  paceSec: number | null;
  hr: number | null;
  cadence: number | null;
  stopSec?: number;
  elevM?: number;
  watts?: number;
  temp?: number;
}

/** Krug (lap) — Stravin oblik. */
export interface Lap {
  distance: number;
  moving_time?: number | null;
  elapsed_time?: number | null;
}
