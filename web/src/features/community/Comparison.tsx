import { profileName, toNum, type Profile } from '../../domain/community';
import { fmtClock, fmtKm, fmtNum, r1 } from '../../domain/format';
import { sign } from './format';

export function Comparison({
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
