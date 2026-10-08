import { useState } from 'react';
import { getApp } from '../../app/appContext';
import { confirmAction } from '../../app/confirm';
import { useSettingsStore } from '../../stores';
import { zoneSource } from '../../domain/zones';
import { Help } from '../../components/ui/Disclosure';
import { type SectionInfo } from './sectionInfo';

/* ------------------------------------------------------------- zone pulsa */

const ZONE_COLORS = [
  'var(--text-3)',
  'var(--ph-build)',
  'var(--accent)',
  'var(--warn)',
  'var(--bad)'
];

/* „Tvoje zone pulsa“: iz intervals.icu podešavanja ako ih ima, inače sa Strave. Šest i sedam zona (icu) prelazi paletu od pet — poslednja
   boja se ponavlja. Prikazuje se u Ti → Zone i postavke treninga. */
export function ZonesList() {
  const strava = useSettingsStore((s) => s.strava);
  const icu = useSettingsStore((s) => s.icu);
  const { zones, source } = zoneSource(icu, strava);
  const rows: Array<{ n: number; text: string; name: string }> = [];
  let n = 0;
  for (const z of zones ?? []) {
    const lo = z?.min;
    const hi = z?.max;
    if (typeof lo !== 'number' || !Number.isFinite(lo) || lo < 0) continue;
    n++;
    const name = typeof z?.ime === 'string' ? z.ime.trim() : '';
    rows.push({
      n,
      text: typeof hi === 'number' && Number.isFinite(hi) && hi > 0 ? `${lo}–${hi}` : `${lo}+`,
      name
    });
  }
  if (!rows.length)
    return (
      <p className="note-src">
        Zone pulsa se preuzimaju kad povežeš intervals.icu ili Stravu (Ti → Povezani servisi).
      </p>
    );
  return (
    <>
      <ul className="zlist">
        {rows.map((r) => (
          <li key={r.n}>
            <i
              className="zsw"
              style={{ background: ZONE_COLORS[Math.min(r.n - 1, ZONE_COLORS.length - 1)] }}
              aria-hidden="true"
            />
            <b>Z{r.n}</b>
            <span className="num">{r.text} bpm</span>
            {r.name ? <span className="zn">{r.name}</span> : null}
          </li>
        ))}
      </ul>
      <p className="note-src">
        {source === 'icu' ? (
          <>
            Iz tvojih <b>intervals.icu</b> sportskih podešavanja (trčanje). Odatle dolazi i
            raspodela vremena po zonama, pa su granice i raspodela iz istog sistema.
          </>
        ) : (
          <>
            Iz tvojih <b>Strava</b> podešavanja. Ako povežeš intervals.icu, zone se preuzimaju
            odande — jer odatle dolazi i vreme po zonama, pa ta dva moraju biti iz istog sistema.
          </>
        )}{' '}
        Koriste se za oznaku zone uz maksimalan puls na ekranu treninga i u AI analizi.
      </p>
    </>
  );
}

/* ------------------------------------------------------------- Strava */

export function useStravaInfo(): SectionInfo {
  const strava = useSettingsStore((s) => s.strava);
  const last =
    typeof strava?.['lastSync'] === 'number' && strava['lastSync'] ? strava['lastSync'] : 0;
  const athlete = typeof strava?.['athlete'] === 'string' ? strava['athlete'] : '';
  return {
    visible: true,
    summary: strava
      ? `${athlete ? `${athlete} · ` : ''}uvoz ${last ? new Date(last).toLocaleDateString('sr-RS') : 'nikad'}`
      : 'nije povezano',
    dot: !!strava,
    open: !strava
  };
}

export function StravaBody() {
  const strava = useSettingsStore((s) => s.strava);
  const [busy, setBusy] = useState(false);
  if (!strava)
    return (
      <>
        <div className="btnrow">
          <button
            type="button"
            className="btn"
            id="st-on"
            onClick={() => getApp().strava.connect()}
          >
            Poveži Stravu
          </button>
        </div>
        <Help summary="Šta se uvozi">
          <p>Distanca, vreme i puls svakog trčanja, plus tempo kvalitetnih sesija iz lapova.</p>
        </Help>
      </>
    );
  const last =
    typeof strava['lastSync'] === 'number' && strava['lastSync'] ? strava['lastSync'] : 0;
  return (
    <>
      <div className="note-src">
        poslednji uvoz: {last ? new Date(last).toLocaleString('sr-RS') : 'nikad'}
      </div>
      <div className="btnrow">
        <button
          type="button"
          className="btn"
          id="st-sync"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void getApp()
              .activities.sync(true)
              .then((r) => {
                if (!('busy' in r)) window.alert(getApp().activities.message(r));
              })
              .finally(() => {
                setBusy(false);
              });
          }}
        >
          {busy ? 'Sinhronizujem…' : 'Uvezi trčanja'}
        </button>
        <button
          type="button"
          className="btn ghost sm"
          id="st-off"
          onClick={() => {
            void confirmAction(
              'Otkači Stravu? Uvezeni podaci ostaju, samo prestaje sinhronizacija.'
            ).then((ok) => {
              if (!ok) return;
              getApp().strava.disconnect();
            });
          }}
        >
          Otkači
        </button>
      </div>
      <Help summary="Pravila uvoza">
        <p>
          Strava ima prednost nad ručnim unosom. Ručna korekcija polja (km / vreme / puls){' '}
          <b>trajno</b> štiti taj trening od prepisivanja. Ako su dva trčanja istog dana, oba se
          broje u kilometražu. Tempo intervala i tempa se čita iz lapova i upisuje u Predikciju.
        </p>
      </Help>
    </>
  );
}
