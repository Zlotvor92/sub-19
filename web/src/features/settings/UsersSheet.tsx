import { useEffect, useRef, useState } from 'react';
import { fmtDayMonth, pl3 } from '../../domain/format';
import type { AdminUser, ScheduledDeletion } from '../../services/api/adminApi';
import { getApp } from '../../app/appContext';

/* KORISNICI (samo vlasnik): svi nalozi po poslednjoj prijavi. Zabrana ide na JEDAN dodir (skida se istim dugmetom, pa pogrešan dodir košta jedan dodir
   nazad); brisanje na dva i traži lozinku koja se NE pamti (kuca se svaki put kad se spisak otvori). */

const when = (iso: string | null | undefined): string => {
  if (!iso) return 'nikad';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : fmtDayMonth(d.toISOString().slice(0, 10));
};

export function UsersSheet() {
  const admin = getApp().admin;
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [scheduled, setScheduled] = useState<ScheduledDeletion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const password = useRef('');
  const [asked, setAsked] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    void Promise.all([admin.users(), admin.scheduled()]).then(([u, z]) => {
      if (!live) return;
      /* Spisak označenih je dodatak — njegov neuspeh ne ruši ekran. */
      if (z.ok) setScheduled(z.items);
      if (!u.ok) setError(u.error || 'Nije uspelo.');
      else {
        setError(null);
        setUsers(u.users);
      }
    });
    return () => {
      live = false;
    };
  }, [admin, tick]);

  useEffect(() => {
    if (!asked) return;
    /* Vraća se samo od sebe — dugme koje zauvek stoji u stanju „Sigurno?" je mina za sledeći dodir. */
    const t = setTimeout(() => setAsked(null), 4000);
    return () => clearTimeout(t);
  }, [asked]);

  const run = async (
    id: string,
    job: () => Promise<{ ok: boolean; error?: string }>
  ): Promise<void> => {
    setBusyId(id);
    const r = await job();
    setBusyId(null);
    setAsked(null);
    if (!r.ok) window.alert(r.error || 'Nije uspelo.');
    else setTick((t) => t + 1); // spisak se povlači ponovo, ne krpi lokalno
  };

  return (
    <>
      <div className="sh-t">Korisnici</div>
      <div className="sh-s">Svi nalozi, poređani po poslednjoj prijavi.</div>
      <div className="f-field full" style={{ marginBottom: 12 }}>
        <label htmlFor="ku-loz">Lozinka za brisanje i zabranu</label>
        <input
          id="ku-loz"
          type="password"
          placeholder="ADMIN_2FA iz Vercel-a"
          autoComplete="off"
          onChange={(e) => {
            password.current = e.target.value;
          }}
        />
      </div>
      <div className="note-src" style={{ margin: '-6px 0 12px' }}>
        Traži se samo za razorne radnje. Ne pamti se — kucaš je svaki put kad otvoriš ovaj spisak.
      </div>
      {scheduled.length ? (
        <div className="card" style={{ borderColor: 'var(--amber)' }}>
          <div className="dhead">
            <span className="card-t">Označeno za brisanje</span>
            <span className="dhead-x">{scheduled.length}</span>
          </div>
          <div className="set-st">
            Pristup im je već zabranjen. Podaci se brišu kad rok istekne — do tada se sve vraća
            jednim dodirom.
          </div>
          {scheduled.map((x) => (
            <div className="ztrow" key={x.user_id}>
              <div className="ztt">
                {x.email || x.user_id}
                <small>briše se {fmtDayMonth(String(x.izvrsi_posle).slice(0, 10))}</small>
              </div>
              <button
                type="button"
                className="btn ghost sm"
                disabled={busyId === x.user_id}
                onClick={() => void run(x.user_id, () => admin.restore(x.user_id))}
              >
                {busyId === x.user_id ? 'Vraćam…' : 'Poništi'}
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div id="ku-lista">
        {error ? (
          <div className="note-src" style={{ color: 'var(--red)' }}>
            {error}
          </div>
        ) : users == null ? (
          <div className="note-src">Učitavam…</div>
        ) : !users.length ? (
          <div className="note-src">Nema nijednog naloga.</div>
        ) : (
          <>
            <div className="note-src" style={{ margin: '10px 0 8px' }}>
              {users.length} {pl3(users.length, 'nalog', 'naloga', 'naloga')}
            </div>
            {users.map((u) => (
              <div
                className="prow-ku"
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 0',
                  borderBottom: '1px solid var(--line)'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '.84rem',
                      fontWeight: 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {u.email}
                    {u.jaSam ? (
                      <span style={{ color: 'var(--cyan)', fontWeight: 800 }}> · ti</span>
                    ) : null}
                  </div>
                  <div
                    style={{
                      fontSize: '.68rem',
                      color: 'var(--txt3)',
                      fontWeight: 600,
                      marginTop: 2
                    }}
                  >
                    prijava {when(u.poslednjaPrijava)} · {u.imaPodatke ? 'ima podatke' : 'prazan'}
                    {u.zabranjen ? (
                      <>
                        {' · '}
                        <b style={{ color: 'var(--red)' }}>zabranjen</b>
                      </>
                    ) : null}
                  </div>
                </div>
                {u.jaSam ? null : (
                  <>
                    <button
                      type="button"
                      className="btn ghost sm"
                      disabled={busyId === u.id}
                      onClick={() =>
                        void run(u.id, () => admin.ban(u.id, !!u.zabranjen, password.current))
                      }
                    >
                      {busyId === u.id
                        ? u.zabranjen
                          ? 'Skidam…'
                          : 'Zabranjujem…'
                        : u.zabranjen
                          ? 'Odbrani'
                          : 'Zabrani'}
                    </button>
                    <button
                      type="button"
                      className="btn danger sm"
                      disabled={busyId === u.id}
                      onClick={() => {
                        if (asked !== u.id) {
                          setAsked(u.id);
                          return;
                        }
                        void run(u.id, () => admin.remove(u.id, password.current));
                      }}
                    >
                      {busyId === u.id ? 'Brišem…' : asked === u.id ? 'Sigurno?' : 'Obriši'}
                    </button>
                  </>
                )}
              </div>
            ))}
            <div className="note-src" style={{ marginTop: 10 }}>
              Brisanje uklanja nalog i <b>sve</b> njegove podatke sa servera. Nepovratno je. Svoj
              nalog ne brišeš odavde — za to je Nalog → Brisanje naloga.
            </div>
          </>
        )}
      </div>
    </>
  );
}
