import { useState } from 'react';
import { brojTreninga, fmtDayMonthYear, glagolZaBroj, pl3 } from '../../domain/format';
import { icuCanReadActivities } from '../../domain/icu';
import { getApp } from '../../app/appContext';
import { confirmAction } from '../../app/confirm';
import { useSettingsStore } from '../../stores';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useUIStore } from '../../stores/uiStore';
import { Help } from './SettingCard';
import type { SectionInfo } from './sections';

const dateOf = (ms: unknown): string =>
  typeof ms === 'number' && ms ? new Date(ms).toLocaleDateString('sr-RS') : '';
const dateTimeOf = (ms: unknown): string =>
  typeof ms === 'number' && ms ? new Date(ms).toLocaleString('sr-RS') : '';
const connected = (icu: Record<string, unknown> | null): boolean => !!icu?.['athleteId'];

/* ------------------------------------------------------------- intervals.icu */

export function useIcuInfo(): SectionInfo {
  const icu = useSettingsStore((s) => s.icu);
  const records = useRecoveryStore((s) => Object.keys(s.wellness).length);
  const on = connected(icu);
  return {
    visible: true,
    summary: on ? `${records} zapisa · ${dateOf(icu?.['lastSync']) || 'nikad'}` : 'nije povezan',
    dot: on,
    open: !on
  };
}

export function IcuBody() {
  const icu = useSettingsStore((s) => s.icu);
  const strava = useSettingsStore((s) => s.strava);
  const closeSheet = useUIStore((s) => s.closeSheet);
  const [label, setLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [athleteId, setAthleteId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [copied, setCopied] = useState(false);
  const address = `${window.location.origin}/`;

  if (!icu || !connected(icu))
    return (
      <>
        <div className="btnrow">
          <button
            type="button"
            className="btn"
            id="icu-oauth"
            onClick={() => {
              void getApp()
                .icu.connect()
                .then((r) => {
                  if (!r.ok) window.alert(r.error);
                });
            }}
          >
            Poveži intervals.icu
          </button>
        </div>
        <Help summary="Šta se povezivanjem dobija">
          <p>
            HRV, puls u miru i san koje Garmin već šalje na intervals.icu, i slanje planiranih
            treninga na sat. Odobravaš na njihovoj strani — nikakav ključ ne prepisuješ.
          </p>
        </Help>
        <Help summary="Ako piše „Invalid redirect_uri“">
          <p>
            Znači da adresa koju šaljemo <b>nije doslovno ista</b> kao ona prijavljena kod njih.
            Otvori intervals.icu → Settings → <b>Developer Settings</b> i u polje{' '}
            <b>Redirect URI</b> upiši tačno ovo, sa kosom crtom na kraju:
          </p>
          <div className="f-field full" style={{ marginTop: 6 }}>
            <span className="f-lbl">Adresa za prijavu</span>
            <input id="icu-uri" readOnly value={address} aria-label="Adresa za prijavu" />
          </div>
          <div className="btnrow" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn ghost sm"
              id="icu-uri-copy"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(address)
                  .catch(() => undefined)
                  .finally(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  });
              }}
            >
              {copied ? 'Kopirano ✓' : 'Kopiraj adresu'}
            </button>
          </div>
          <p>
            Najčešća dva uzroka: <b>fali kosa crta</b> na kraju prijavljene adrese, ili si
            aplikaciju otvorio preko privremene Vercel adrese (one sa nasumičnim delom u imenu)
            umesto preko stalne — tada se domen ne poklapa ni sa čim što je prijavljeno.
          </p>
        </Help>
        <Help summary="Ručno povezivanje (ako gornje ne radi)">
          <div className="f-field full" style={{ marginTop: 6 }}>
            <label htmlFor="icu-id">ID sportiste</label>
            <input
              id="icu-id"
              inputMode="numeric"
              placeholder="npr. i123456"
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
            />
          </div>
          <div className="f-field full">
            <label htmlFor="icu-key">API ključ</label>
            <input
              id="icu-key"
              type="password"
              placeholder="iz intervals.icu → Settings → Developer"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="btnrow" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn ghost sm"
              id="icu-on"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setLabel('Proveravam…');
                void getApp()
                  .icu.connectWithKey(athleteId, apiKey)
                  .then((r) => {
                    if (r.ok) {
                      closeSheet();
                      window.alert(`Povezano. Povučeno zapisa: ${r.n}.`);
                    } else {
                      window.alert(r.error);
                    }
                  })
                  .finally(() => {
                    setBusy(false);
                    setLabel(null);
                  });
              }}
            >
              {label ?? 'Poveži ključem'}
            </button>
          </div>
          <p>
            intervals.icu → Settings → na dnu <b>Developer Settings</b>. Ovo zaobilazi OAuth u
            celosti, pa radi i dok je gornja greška nerešena — samo bez slanja treninga na sat.
          </p>
        </Help>
      </>
    );

  const canActivities = icuCanReadActivities(icu);
  const trSync = dateTimeOf(icu['trSync']);
  return (
    <>
      <div className="set-st">
        ID <b>{String(icu['athleteId'])}</b>
        {icu['token'] ? ' · odobreno na intervals.icu' : ' · ručni ključ'}
        <br />
        poslednje povlačenje: {dateTimeOf(icu['lastSync']) || 'nikad'}
      </div>
      <div className="btnrow">
        <button
          type="button"
          className="btn"
          id="icu-sync"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setLabel('Povlačim…');
            void getApp()
              .icu.syncAll(true)
              .then((r) => {
                if (r.ok) {
                  /* Sažetak imenuje SVE što je stiglo — inače se ne vidi da je jedno dugme odradilo i merenja i trčanja. */
                  const parts = [`merenja ${r.wellness}`];
                  if (r.runs != null) parts.push(`trčanja ${r.runs}`, `krugovi ${r.details ?? 0}`);
                  setLabel(`${parts.join(' · ')} ✓`);
                  if (r.activitiesNote) {
                    const note = r.activitiesNote;
                    setTimeout(
                      () => window.alert(`Jutarnja merenja su povučena.\n\nTreninzi nisu: ${note}`),
                      150
                    );
                  }
                } else {
                  setLabel('Nije uspelo');
                  if (r.error) setTimeout(() => window.alert(r.error), 100);
                }
              })
              .finally(() => {
                setTimeout(() => {
                  setBusy(false);
                  setLabel(null);
                }, 1500);
              });
          }}
        >
          {label ?? 'Povuci sve'}
        </button>
        <button
          type="button"
          className="btn ghost sm"
          id="icu-off"
          onClick={() => {
            void confirmAction('Otkačiti intervals.icu? Već povučeni podaci ostaju.').then((ok) => {
              if (!ok) return;
              getApp().icu.disconnect();
              closeSheet();
            });
          }}
        >
          Otkači
        </button>
      </div>
      {canActivities ? (
        <div className="set-st">
          Jednim dodirom stižu i <b>jutarnja merenja</b> i <b>trčanja</b>
          {strava ? ' (Strava ostaje kao rezerva)' : ''}.
          {trSync ? (
            <>
              <br />
              trčanja poslednji put: {trSync}
            </>
          ) : null}
        </div>
      ) : (
        <div className="set-st" style={{ color: 'var(--amber)' }}>
          Ova veza je napravljena pre nego što je aplikacija umela da čita treninge, pa povlači samo
          jutarnja merenja. <b>Otkači pa ponovo poveži</b> — dobićeš i krugove intervala, koje
          Strava ne daje ovako tačno.
        </div>
      )}
      <Help summary="Šta se povlači">
        <p>
          HRV, puls u miru, san i trenažno opterećenje. Garmin ih šalje na intervals.icu, odakle ih
          čitamo — Garminov sopstveni API traži partnerski program.
        </p>
        <p>
          <b>I sami treninzi.</b> intervals.icu je radne deonice već prepoznao nad izvornim fajlom
          sa sata, pa analiza dobija svaki interval posebno — tempo, GAP (tempo korigovan za nagib),
          puls i oporavak između repova — umesto proseka cele sesije. Ako intervals.icu nije
          povezan, sve to i dalje radi preko Strave, samo grublje.
        </p>
      </Help>
    </>
  );
}

/* ------------------------------------------------------------- Slanje na sat */

export function useWatchInfo(): SectionInfo {
  const icu = useSettingsStore((s) => s.icu);
  const on = connected(icu);
  const last = icu?.['lastPush'];
  return {
    visible: on,
    summary: last ? `poslednje ${dateOf(last)}` : 'još nije slato',
    dot: last ? true : 'warn',
    open: false
  };
}

const STRUCTURE_LINE = /^- /;

export function WatchBody() {
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState<null | 'push' | 'again'>(null);
  const [label, setLabel] = useState<string | null>(null);
  const threshold = getApp().icu.watch.threshold();

  const send = (replace: boolean): void => {
    setBusy(replace ? 'again' : 'push');
    setLabel('Šaljem…');
    void pushToWatch(replace).then((r) => {
      setLabel(r.status);
      setTimeout(() => {
        setBusy(null);
        setLabel(null);
      }, 2200);
    });
  };

  const batch = preview ? getApp().icu.watch.preview(14) : null;
  const structured = batch
    ? batch.events.filter(
        (e) =>
          typeof e['description'] === 'string' &&
          e['description'].split('\n').filter((l) => STRUCTURE_LINE.test(l)).length > 1
      )
    : [];

  return (
    <>
      <div className="btnrow">
        <button
          type="button"
          className="btn ghost"
          id="icu-push"
          disabled={busy !== null}
          onClick={() => send(false)}
        >
          {busy === 'push' ? label : '📤 Pošalji na sat (14 dana)'}
        </button>
      </div>
      <div className="btnrow">
        <button
          type="button"
          className="btn ghost sm"
          id="icu-vidi"
          onClick={() => setPreview((v) => !v)}
        >
          👁 Vidi šta se šalje
        </button>
        <button
          type="button"
          className="btn ghost sm"
          id="icu-push2"
          disabled={busy !== null}
          onClick={() => send(true)}
        >
          {busy === 'again' ? label : '♻️ Iz početka'}
        </button>
      </div>
      {batch ? (
        <div id="icu-pregled">
          {!batch.events.length ? (
            <div className="note-src">Nema treninga u narednih 14 dana.</div>
          ) : (
            <>
              <div className="note-src" style={{ margin: '10px 0 6px' }}>
                {glagolZaBroj(batch.events.length, 'Šalje se ', 'Šalju se ')}
                {brojTreninga(batch.events.length)},{' '}
                {structured.length
                  ? `sa strukturom: ${structured.length} (${structured
                      .map((e) => fmtDayMonthYear(String(e['date'])))
                      .join(', ')})`
                  : 'nijedan sa strukturom — svi su lagani/dugi dani'}
                .
                <br />
                intervals.icu prosleđuje Garminu otprilike nedelju dana unapred, pa dalji dani stižu
                kasnije sami.
                {batch.skipped ? (
                  <>
                    <br />
                    <b>Preskočeno dana trčanja: {batch.skipped}</b> — za njih nije poznat lagan
                    tempo u sekundama, pa bi na satu izašli bez ciljnog tempa.
                  </>
                ) : null}
              </div>
              {batch.events.map((e) => (
                <pre
                  key={String(e['externalId'])}
                  style={{
                    whiteSpace: 'pre-wrap',
                    fontSize: 12,
                    lineHeight: 1.45,
                    margin: '0 0 10px',
                    padding: 8,
                    borderRadius: 8,
                    background: 'rgba(127,127,127,.12)',
                    overflowX: 'auto'
                  }}
                >
                  {`${fmtDayMonthYear(String(e['date']))} · ${String(e['name'])}\n${String(e['description'])}`}
                </pre>
              ))}
            </>
          )}
        </div>
      ) : null}
      <Help summary="Da treninzi stignu do sata">
        <p>
          U intervals.icu → Settings uključi <b>„Upload planned workouts“</b> i autorizuj Garmin
          Connect. Prosleđuje se otprilike nedelju dana unapred, pa dalji dani stižu sami kako se
          približavaju.
        </p>
      </Help>
      <Help summary="Ako na satu piše „No Target“">
        <p>
          U intervals.icu → Settings → Sport Settings unesi <b>prag tempa (threshold pace)</b>
          {threshold ? (
            <>
              {' '}
              — po tvojoj formi to je <b>{threshold}/km</b>
            </>
          ) : null}
          . Bez njega intervals.icu izbacuje ciljeve tempa iz Garmin izvoza.
        </p>
        <p>
          Garmin izvoz se pravi kad događaj <b>nastane</b>, pa posle unosa praga obično slanje ne
          pomaže — tada ide <b>„Iz početka“</b>, koje briše ranije poslato i pravi ga iznova.
        </p>
      </Help>
    </>
  );
}

/** Slanje na sat sa istim potvrdama i porukama kao stari ekran. `status` je natpis na dugmetu posle ishoda. */
export async function pushToWatch(replace: boolean): Promise<{ ok: boolean; status: string }> {
  const watch = getApp().icu.watch;
  const n = watch.preview(14).events.length;
  if (!n) {
    window.alert('Nema treninga u narednih 14 dana.');
    return { ok: false, status: 'Nije uspelo' };
  }
  const question = replace
    ? `Obrisati ${n} ${pl3(n, 'ranije poslat trening', 'ranije poslata treninga', 'ranije poslatih treninga')} i napraviti ih iz početka?\n\nBriše se samo ono što je poslala ova aplikacija — ostalo u kalendaru se ne dira.\n\nOvo je potrebno posle unosa praga tempa: Garmin izvoz se pravi kad događaj nastane, pa obično ažuriranje ne pomaže.`
    : `Poslati ${brojTreninga(n)} u intervals.icu kalendar?\n\nPostojeći koje je poslala ova aplikacija biće ažurirani, ostali se ne diraju.`;
  if (!(await confirmAction(question)))
    return { ok: false, status: replace ? '♻️ Iz početka' : '📤 Pošalji na sat (14 dana)' };
  const r = await watch.push(14, replace);
  if (!r.ok) {
    window.alert(r.error || 'Nije uspelo.');
    return { ok: false, status: 'Nije uspelo' };
  }
  return { ok: true, status: `Poslato ${r.n} ✓` };
}
