import {
  GOAL_FILTERS,
  MEASURES,
  measureFor,
  challengeList,
  challengeShare,
  filterProfiles,
  profileName,
  profileSubtitle,
  rankProfiles,
  toNum,
  type Profile
} from '../../domain/community';
import { fmtDayMonth, fmtKm } from '../../domain/format';
import { useCommunityStore } from '../../stores/communityStore';
import { Avatar } from './Avatar';

export function ListView({
  all,
  userId,
  hasMe
}: {
  all: Profile[];
  userId: string | null;
  hasMe: boolean;
}) {
  const filter = useCommunityStore((s) => s.filter);
  const measure = useCommunityStore((s) => s.measure);
  const challenge = useCommunityStore((s) => s.challenge);
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
