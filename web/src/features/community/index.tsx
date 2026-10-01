import { useEffect } from 'react';
import {
  GOAL_FILTERS,
  MEASURES,
  measureFor,
  challengeList,
  challengeShare,
  filterProfiles,
  profileName,
  profileSubtitle,
  progressOf,
  rankProfiles,
  reasonMessage,
  toNum,
  type Profile
} from '../../domain/community';
import { fmtClock, fmtDayMonth, fmtKm, fmtNum, r1 } from '../../domain/format';
import { getApp } from '../../app/appContext';
import { useCommunityStore } from '../../stores/communityStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { Avatar } from './Avatar';

/* ZAJEDNICA. Tri stanja koja se ne smeju pomešati: (1) isključena — ne prikazuje se NIŠTA tuđe, jer se ništa tuđe ni ne povlači; kapija je u bazi
   (RLS), ovde je samo objašnjenje; (2) povlači se — kratko, i mora da se vidi da nešto radi; (3) spisak / profil.
   Poređenje sa drugima se računa OVDE, na uređaju: niko ne vidi koga s kim porediš. */

const sign = (n: number): string => `${n > 0 ? '+' : ''}${fmtNum(n, 1)}`;

export default function Page() {
  const authed = useAuthStore((s) => s.hasSession);
  const userId = useAuthStore((s) => s.userId);
  const visible = useCommunityStore((s) => s.zajed.vidljiv);
  const { profiles, loading, error, opened } = useCommunityStore();
  const openSheet = useUIStore((s) => s.openSheet);

  useEffect(() => {
    if (authed && visible) getApp().community.refreshIfDue();
  }, [authed, visible]);

  if (!authed)
    return (
      <div className="card">
        <div className="card-t">Zajednica</div>
        <div className="zprazno">
          Zajednica traži nalog, jer se spisak čuva na serveru.
          <br />
          Prijavi se u Podešavanjima.
        </div>
      </div>
    );

  if (!visible)
    return (
      <div className="card">
        <div className="dhead">
          <span className="card-t">Zajednica</span>
          <span className="dhead-x">isključena</span>
        </div>
        <div className="set-st">
          Rang-lista trkača koji koriste ovu aplikaciju. Dok je isključena, ne postojiš na spisku i{' '}
          <b>ne vidiš tuđe profile</b> — vidljivost je uzajamna.
        </div>
        <div className="zsta">
          <div>
            <i>Deli se</i>
            <p>
              nadimak i slika, cilj i datum trke, nedelja plana, VDOT, test na 3 km, kilometraža,
              doslednost, niz, značke i poslednja trčanja
            </p>
          </div>
          <div>
            <i>Ne deli se nikad</i>
            <p>
              HRV, puls u miru, san, težina, mapa bolova, beleške sa treninga, puls na treningu, AI
              analiza, e-adresa
            </p>
          </div>
        </div>
        <div className="btnrow" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn"
            id="zaj-ka-set"
            onClick={() => openSheet({ kind: 'settings' })}
          >
            Uključi u Podešavanjima
          </button>
        </div>
        <div className="note-src">
          <a href="./privacy.html" target="_blank" rel="noopener" style={{ color: 'inherit' }}>
            Politika privatnosti
          </a>
        </div>
      </div>
    );

  if (profiles == null && !error)
    return (
      <div className="card">
        <div className="card-t">Zajednica</div>
        <div className="zprazno">{loading ? 'Povlačim spisak…' : 'Spisak još nije povučen.'}</div>
      </div>
    );

  if (error && profiles == null)
    return (
      <div className="card">
        <div className="dhead">
          <span className="card-t">Zajednica</span>
          <span className="dhead-x">nije povučeno</span>
        </div>
        <div className="zprazno">
          {reasonMessage(error)}
          <br />
          Sve ostalo u aplikaciji radi normalno.
        </div>
        <div className="btnrow">
          <button
            type="button"
            className="btn ghost"
            id="zaj-opet"
            onClick={() => void getApp().community.load()}
          >
            Pokušaj ponovo
          </button>
        </div>
      </div>
    );

  const all = profiles ?? [];
  const open = opened ? all.find((p) => p.user_id === opened) : null;
  const me = all.find((p) => p.user_id === userId);
  return open ? (
    <ProfileView p={open} me={me} userId={userId} />
  ) : (
    <ListView all={all} userId={userId} hasMe={!!me} />
  );
}

function ListView({
  all,
  userId,
  hasMe
}: {
  all: Profile[];
  userId: string | null;
  hasMe: boolean;
}) {
  const { filter, measure, challenge } = useCommunityStore();
  const setRemote = useCommunityStore((s) => s.setRemote);
  const M = measureFor(measure);
  const shown = filterProfiles(all, filter);
  const ranked = rankProfiles(shown, M);
  const { rows: ch, finished } = challengeList(shown);
  const isMe = (p: Profile): boolean => !!userId && p.user_id === userId;
  const open = (id: string): void => {
    setRemote({ opened: id });
    window.scrollTo(0, 0);
  };
  const youTag = (p: Profile) =>
    isMe(p) ? (
      <>
        {' '}
        <span style={{ color: 'var(--cyan)' }}>· ti</span>
      </>
    ) : null;
  return (
    <>
      <div className="card">
        <div className="dhead">
          <span className="card-t">Izazov nedelje</span>
          <span className="dhead-x">
            {finished} od {ch.length} završilo
          </span>
        </div>
        <div className="set-st">
          <b>{challenge || 'Odradi sve treninge po planu ove nedelje.'}</b>
        </div>
        {ch.length ? (
          <div style={{ marginTop: 12 }}>
            {ch.map((p) => {
              const done = (p.izazov_ura as number) >= (p.izazov_od as number);
              return (
                <button
                  type="button"
                  className="zrow"
                  key={p.user_id}
                  style={{ alignItems: 'center' }}
                  onClick={() => open(p.user_id)}
                >
                  <Avatar profile={p} size={34} />
                  <span className="zi">
                    <span className="zime" style={{ fontSize: '.86rem' }}>
                      {profileName(p)}
                      {youTag(p)}
                      {done ? (
                        <>
                          {' '}
                          <span
                            style={{ color: 'var(--green)', fontSize: '.7rem', fontWeight: 800 }}
                          >
                            ✓ gotovo
                          </span>
                        </>
                      ) : null}
                    </span>
                    <span className={`zprog${done ? ' pun' : ''}`}>
                      <i
                        style={{
                          width: `${Math.max(0, Math.min(100, Math.round(challengeShare(p) * 100)))}%`
                        }}
                      />
                    </span>
                  </span>
                  <span className="zv">
                    <b style={{ fontSize: '.92rem' }}>
                      {p.izazov_ura || 0}/{p.izazov_od || 0}
                    </b>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="note-src">Izazov ne meri brzinu — samo da se ne preskače.</div>
      </div>

      <div className="zfilteri" role="tablist" aria-label="Filter po ciljnoj distanci">
        {GOAL_FILTERS.map(([k, t]) => (
          <button
            type="button"
            key={k}
            className={`zchip${filter === k ? ' on' : ''}`}
            role="tab"
            aria-selected={filter === k}
            onClick={() => setRemote({ filter: k })}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="zseg" role="tablist" aria-label="Po čemu se rangira">
          {MEASURES.map((m) => (
            <button
              type="button"
              key={m.key}
              role="tab"
              aria-selected={measure === m.key}
              className={measure === m.key ? 'on' : ''}
              onClick={() => setRemote({ measure: m.key })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="dhead" style={{ marginTop: 8 }}>
          <span className="card-t">{M.label}</span>
          <span className="dhead-x">{M.hint}</span>
        </div>
        {ranked.length ? (
          ranked.map((p, i) => {
            const value = M.value(p);
            return (
              <button
                type="button"
                className="zrow"
                key={p.user_id}
                onClick={() => open(p.user_id)}
              >
                <span className="zmesto" style={i === 0 ? { color: 'var(--amber)' } : undefined}>
                  {i + 1}
                </span>
                <Avatar profile={p} size={40} />
                <span className="zi">
                  <span className="zime">
                    {profileName(p)}
                    {youTag(p)}
                  </span>
                  <span className="zs">{profileSubtitle(p, fmtDayMonth)}</span>
                </span>
                <span className="zv">
                  <b style={measure === 'nap' ? { color: 'var(--green)' } : undefined}>{value}</b>
                  <span>{i === 0 && value !== '—' ? 'PRVI' : ''}</span>
                </span>
              </button>
            );
          })
        ) : (
          <div className="zprazno">
            {filter === 'sve' ? (
              <>
                Za sada niko ne deli profil.
                <br />
                Budi prvi.
              </>
            ) : (
              <>
                Niko sa ciljem {filter} još ne deli profil.
                <br />
                Budi prvi.
              </>
            )}
          </div>
        )}
        <div className="note-src">
          {measure === 'nap' ? (
            <>
              Napredak meri koliko si <b>ti</b> napredovao od početka svog plana — ne koliko si brz.
              Ovde početnik pobeđuje iskusnog trkača.
            </>
          ) : measure === 'dosl' ? (
            'Koliko je od planiranih treninga stvarno odrađeno. Ne meri talenat nego disciplinu.'
          ) : (
            'Vidiš samo one koji su i sami uključili profil.'
          )}
        </div>
      </div>

      <div className="card">
        <div className="dhead">
          <span className="card-t">Ove nedelje</span>
          <span className="dhead-x">kilometraža</span>
        </div>
        {shown
          .slice()
          .sort((a, b) => (b.km_nedelja || 0) - (a.km_nedelja || 0))
          .map((p) => (
            <button type="button" className="zrow" key={p.user_id} onClick={() => open(p.user_id)}>
              <Avatar profile={p} size={34} />
              <span className="zi">
                <span className="zime" style={{ fontSize: '.86rem' }}>
                  {profileName(p)}
                </span>
              </span>
              <span className="zv">
                <b style={{ fontSize: '.95rem' }}>
                  {p.km_nedelja != null ? `${fmtKm(p.km_nedelja)} km` : '—'}
                </b>
                <span style={{ letterSpacing: 0, textTransform: 'none', fontWeight: 600 }}>
                  {isMe(p) ? 'ti · ' : ''}
                  {toNum(p.plan_pct) != null ? `${toNum(p.plan_pct)} % plana` : ''}
                </span>
              </span>
            </button>
          ))}
      </div>
      {hasMe ? null : (
        <div className="note-src" style={{ marginTop: -4 }}>
          Tvoj profil se pojavljuje posle prve sinhronizacije.
        </div>
      )}
    </>
  );
}

interface Run {
  d?: unknown;
  t?: unknown;
  o?: unknown;
  p?: unknown;
}

function ProfileView({
  p,
  me,
  userId
}: {
  p: Profile;
  me: Profile | undefined;
  userId: string | null;
}) {
  const setRemote = useCommunityStore((s) => s.setRemote);
  const mine = !!userId && p.user_id === userId;
  const runs = Array.isArray(p.trcanja) ? (p.trcanja as Run[]) : [];
  const badges = Array.isArray(p.znacke) ? p.znacke : [];
  const napP = progressOf(p);
  const napJ = me ? progressOf(me) : 0;
  const text = (v: unknown, fallback: string): string =>
    typeof v === 'string' && v ? v : fallback;
  const back = (): void => {
    setRemote({ opened: null });
    window.scrollTo(0, 0);
  };
  return (
    <>
      <button type="button" className="znazad" onClick={back}>
        ← Zajednica
      </button>
      <div className="card">
        <div className="zhero">
          <Avatar profile={p} size={74} />
          <div>
            <div className="zpn">{profileName(p)}</div>
            <div className="zpm">{profileSubtitle(p, fmtDayMonth)}</div>
          </div>
        </div>
        <div className="ob-vpaces">
          <div className="ob-vp">
            <i>VDOT</i>
            <b>{p.vdot != null ? fmtNum(p.vdot, 1) : '—'}</b>
          </div>
          <div className="ob-vp">
            <i>Test 3 km</i>
            <b>{p.test3k_sec != null ? fmtClock(p.test3k_sec) : '—'}</b>
          </div>
          <div className="ob-vp">
            <i>Niz</i>
            <b>{toNum(p.niz_dana) || 0}</b>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="dhead">
          <span className="card-t">Poslednja trčanja</span>
          <span className="dhead-x">{runs.length}</span>
        </div>
        {runs.length ? (
          runs.map((x, i) => (
            <div className="ztrow" key={i}>
              <div className="ztd">{fmtDayMonth(typeof x?.d === 'string' ? x.d : undefined)}</div>
              <div className="ztt">
                {text(x?.t, 'Trčanje')}
                <small>{text(x?.o, '—')}</small>
              </div>
              <div className="ztp">{text(x?.p, '—')}</div>
            </div>
          ))
        ) : (
          <div className="zprazno">Još nema zabeleženih trčanja.</div>
        )}
        <div className="note-src">
          Beleške, puls, oporavak i AI analiza <b>ne izlaze</b> iz {mine ? 'tvog' : 'njegovog'}{' '}
          naloga.
        </div>
      </div>

      {badges.length ? (
        <div className="card">
          <div className="dhead">
            <span className="card-t">Značke</span>
            <span className="dhead-x">{badges.length}</span>
          </div>
          <div className="zznacke">
            {badges.map((z, i) => (
              <span className={`zznak${i === 0 ? ' zlat' : ''}`} key={i}>
                {typeof z === 'string' ? z : ''}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {!mine && me ? <Comparison p={p} me={me} napP={napP} napJ={napJ} /> : null}
    </>
  );
}

function Comparison({
  p,
  me,
  napP,
  napJ
}: {
  p: Profile;
  me: Profile;
  napP: number;
  napJ: number;
}) {
  const lead = (me.plan_pct || 0) >= (p.plan_pct || 0);
  const pct = (v: number | null): string => (toNum(v) != null ? `${toNum(v)} %` : '—');
  const dist = p.test3k_sec != null && me.test3k_sec != null ? p.test3k_sec - me.test3k_sec : null;
  return (
    <>
      <div className="card">
        <div className="dhead">
          <span className="card-t">Duel</span>
          <span className="dhead-x">doslednost i napredak</span>
        </div>
        <div className="zduel">
          <div className="zds">
            <b style={{ color: 'var(--cyan)' }}>{pct(me.plan_pct)}</b>
            <span>TI</span>
          </div>
          <div className="zvs">VS</div>
          <div className="zds">
            <b>{pct(p.plan_pct)}</b>
            <span>{(profileName(p).split(' ')[0] as string).toUpperCase()}</span>
          </div>
        </div>
        <div className="drows" style={{ marginTop: 10 }}>
          <div className="drow">
            <span className="l">plan odrađen</span>
            <span className="v">
              <b style={{ color: lead ? 'var(--green)' : 'var(--txt3)' }}>
                {lead ? 'vodiš' : 'zaostaješ'}
              </b>
            </span>
          </div>
          <div className="drow">
            <span className="l">niz dana</span>
            <span className="v">
              <b>
                {toNum(me.niz_dana) || 0} : {toNum(p.niz_dana) || 0}
              </b>
            </span>
          </div>
          <div className="drow">
            <span className="l">napredak VDOT-a</span>
            <span className="v">
              <b>
                {sign(napJ)} : {sign(napP)}
              </b>
            </span>
          </div>
        </div>
        <div className="note-src">
          Duel meri doslednost i napredak, ne brzinu — zato ima smisla i kad niste isti nivo.
        </div>
      </div>

      <div className="card">
        <div className="dhead">
          <span className="card-t">U odnosu na tebe</span>
          <span className="dhead-x">
            {p.cilj === me.cilj ? 'isti cilj' : `${p.cilj || '—'} vs ${me.cilj || '—'}`}
          </span>
        </div>
        <div className="drows">
          {p.vdot != null && me.vdot != null ? (
            <div className="drow">
              <span className="l">VDOT</span>
              <span className="v">
                <b>{fmtNum(p.vdot, 1)}</b>{' '}
                <small style={{ color: p.vdot > me.vdot ? 'var(--green)' : 'var(--txt3)' }}>
                  {sign(r1(p.vdot - me.vdot))} od tebe
                </small>
              </span>
            </div>
          ) : null}
          {dist != null && p.test3k_sec != null ? (
            <div className="drow">
              <span className="l">test na 3 km</span>
              <span className="v">
                <b>{fmtClock(p.test3k_sec)}</b>{' '}
                <small style={{ color: dist < 0 ? 'var(--green)' : 'var(--txt3)' }}>
                  {Math.abs(dist)} s {dist < 0 ? 'brže' : 'sporije'}
                </small>
              </span>
            </div>
          ) : null}
          {p.km_nedelja != null && me.km_nedelja != null ? (
            <div className="drow">
              <span className="l">ove nedelje</span>
              <span className="v">
                <b>{fmtKm(p.km_nedelja)} km</b>{' '}
                <small>{sign(r1(p.km_nedelja - me.km_nedelja))} km</small>
              </span>
            </div>
          ) : null}
        </div>
        <div className="note-src">
          Poređenje se računa na tvom uređaju. Niko ne vidi koga s kim porediš.
        </div>
      </div>
    </>
  );
}
