import {
  profileName,
  profileSubtitle,
  progressOf,
  toNum,
  type Profile
} from '../../domain/community';
import { fmtClock, fmtDayMonth, fmtNum } from '../../domain/format';
import { useCommunityStore } from '../../stores/communityStore';
import { Avatar } from './Avatar';
import { Comparison } from './Comparison';

interface Run {
  d?: unknown;
  t?: unknown;
  o?: unknown;
  p?: unknown;
}

export function ProfileView({
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
