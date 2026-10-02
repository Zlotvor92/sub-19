import { useState } from 'react';
import { trainingHour } from '../../domain/weather';
import { getApp } from '../../app/appContext';
import { useSettingsStore } from '../../stores';
import { Help } from './SettingCard';
import type { SectionInfo } from './sectionInfo';

const timeOf = (ms: unknown): string =>
  typeof ms === 'number' && ms
    ? new Date(ms).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })
    : '';

export function useWeatherInfo(): SectionInfo {
  const geo = useSettingsStore((s) => s.ui.geo);
  const hourSetting = useSettingsStore((s) => s.ui.satTreninga);
  const forecast = useSettingsStore((s) => s.vreme);
  const at = timeOf(forecast?.['at']);
  return {
    visible: true,
    summary: geo
      ? `trening u ${trainingHour(hourSetting)}:00${at ? ` · prognoza od ${at}` : ''}`
      : 'lokacija nije uključena',
    dot: !!geo,
    open: !geo
  };
}

export function WeatherBody() {
  const geo = useSettingsStore((s) => s.ui.geo);
  const hourSetting = useSettingsStore((s) => s.ui.satTreninga);
  const patchUi = useSettingsStore((s) => s.patchUi);
  const [label, setLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hour = trainingHour(hourSetting);

  if (!geo)
    return (
      <>
        <div className="set-st">
          Na kartici dana koji predstoji piše temperatura, osećaj, vlažnost i verovatnoća kiše — i
          koliko je realno sporiji ciljni tempo na toj vrućini. To je jedini podatak u aplikaciji
          koji menja odluku <b>pre</b> nego što izađeš.
        </div>
        <div className="btnrow">
          <button
            type="button"
            className="btn"
            id="vr-on"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setLabel('Tražim lokaciju…');
              void getApp()
                .weather.enable(setLabel)
                .then((r) => {
                  if (!r.ok) window.alert(r.error);
                  else if (r.pullError) window.alert(r.pullError);
                })
                .finally(() => {
                  setBusy(false);
                  setLabel(null);
                });
            }}
          >
            {label ?? 'Uključi lokaciju'}
          </button>
        </div>
        <Help summary="Šta se tačno šalje">
          <p>
            Koordinate zaokružene na dve decimale (~1 km) idu <b>direktno</b> servisu Open-Meteo,
            koji ne traži nalog ni ključ. Naš server ih nikad ne vidi — zato i ne ide preko njega.
          </p>
          <p>
            Ništa se ne šalje dok sam ne uključiš, a isključivanjem se koordinate brišu sa uređaja.
          </p>
        </Help>
      </>
    );

  return (
    <>
      <div className="set-st">
        Prognoza za tvoju okolinu, na kartici dana koji predstoji. Koordinate se zaokružuju na ~1 km
        i idu samo vremenskoj službi — nikad na naš server.
      </div>
      <div className="f-grid">
        <div className="f-field full">
          <label htmlFor="vr-sat">U koliko sati obično trčiš</label>
          <select
            id="vr-sat"
            value={hour}
            onChange={(e) => patchUi({ satTreninga: +e.target.value })}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="btnrow">
        <button
          type="button"
          className="btn ghost sm"
          id="vr-osvezi"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setLabel('Povlačim…');
            void getApp()
              .weather.pull(true)
              .then((r) => {
                setLabel(r.ok ? 'Osveženo ✓' : 'Nije uspelo');
                if (!r.ok) setTimeout(() => window.alert(r.error), 100);
              })
              .finally(() => {
                setTimeout(() => {
                  setBusy(false);
                  setLabel(null);
                }, 900);
              });
          }}
        >
          {label ?? 'Osveži prognozu'}
        </button>
        <button
          type="button"
          className="btn ghost sm"
          id="vr-off"
          onClick={() => getApp().weather.disable()}
        >
          Isključi
        </button>
      </div>
    </>
  );
}
