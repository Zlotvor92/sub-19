import { AppBar } from '../../components/ui/Shell';
import { Row } from '../../components/ui/primitives';
import { fmtClock } from '../../domain/format';
import { THEME_LABEL } from '../../lib/theme';
import { useTheme } from '../../lib/useTheme';
import { APP_VERSION } from '../../services/config';
import { useAuthStore } from '../../stores/authStore';
import { useIsOwner } from '../../stores/owner';
import { useUIStore } from '../../stores/uiStore';
import { useFormModel } from '../race/useFormModel';
import { useTrainingStore } from '../../stores';
import { profileRows } from './profileModel';
import { useIcuInfo } from './icuSections';
import { useStravaInfo } from './stravaSection';

/* EKRAN TI: ko si i šta je cilj (gore), pa spisak sa jednim redom po temi. Svaki red vodi na svoj ekran; ništa se ne podešava ovde, na početnoj. Raniji
   modalni list „Podešavanja“ pod zupčanikom je zamenjen ovim tabom — iste mogućnosti, jedan nivo manje. */
export default function TiPage() {
  const signedIn = useAuthStore((s) => s.hasSession);
  const email = useAuthStore((s) => s.email);
  const owner = useIsOwner();
  const openScreen = useUIStore((s) => s.openScreen);
  const genPlan = useTrainingStore((s) => s.genPlan);
  const m = useFormModel();
  const strava = useStravaInfo();
  const icu = useIcuInfo();
  const [theme] = useTheme();
  const initial = (email ?? '').trim().charAt(0).toUpperCase();
  const start = profileRows(genPlan?.ulaz).find((r) => r.label === 'Polazni rezultat');
  const servicesOn = [strava.dot ? 'Strava' : null, icu.dot ? 'intervals.icu' : null].filter(
    (x): x is string => !!x
  );

  return (
    <>
      <AppBar />
      <header className="screen-head">
        <h1>Ti</h1>
      </header>
      <div className="me">
        <span className="avatar" aria-hidden="true">
          {initial || '·'}
        </span>
        <div className="me-t">
          <b>{signedIn ? (email ?? 'Prijavljen') : 'Nisi prijavljen'}</b>
          <span>{signedIn ? 'Podaci se čuvaju na serveru' : 'Podaci su samo na ovom uređaju'}</span>
        </div>
      </div>

      {m ? (
        <button
          type="button"
          className="goal-block"
          onClick={() => openScreen({ kind: 'cilj' })}
          aria-label={`Trenutni cilj ${m.goalText}, ${m.refs.raceName}. Otvori cilj.`}
        >
          <span className="eyebrow">Trenutni cilj</span>
          <span className="hero-v goal num">{m.goalText}</span>
          <span className="goal-s">{m.refs.raceName} · ciljno vreme</span>
          {start ? <span className="goal-s dim">Polazni rezultat {start.value}</span> : null}
          {!start && m.cv != null && m.estSec != null ? (
            <span className="goal-s dim">Procena danas {fmtClock(m.estSec)}</span>
          ) : null}
        </button>
      ) : null}

      <div className="rows me-rows">
        <Row
          icon="user"
          title="Moj profil"
          sub="Nalog i trkačko iskustvo"
          onClick={() => openScreen({ kind: 'profil' })}
        />
        <Row
          icon="gauge"
          title="Zone i postavke treninga"
          sub="Zone pulsa, vreme i lokacija"
          onClick={() => openScreen({ kind: 'postavke-treninga' })}
        />
        <Row
          icon="link"
          title="Povezani servisi"
          sub={
            servicesOn.length ? servicesOn.join(' · ') : 'Strava · intervals.icu · nije povezano'
          }
          onClick={() => openScreen({ kind: 'servisi' })}
        />
        <Row
          icon="bell"
          title="Obaveštenja"
          sub="Podsetnici za trening"
          onClick={() => openScreen({ kind: 'obavestenja' })}
        />
        <Row
          icon={theme === 'dark' ? 'moon' : 'sun'}
          title="Izgled aplikacije"
          sub={THEME_LABEL[theme]}
          onClick={() => openScreen({ kind: 'izgled' })}
        />
        <Row
          icon="shield"
          title="Privatnost i podaci"
          sub="Backup, ranije verzije, brisanje naloga"
          onClick={() => openScreen({ kind: 'privatnost' })}
        />
        <Row
          icon="info"
          title="O aplikaciji"
          sub={`Verzija ${APP_VERSION} · uputstvo`}
          onClick={() => openScreen({ kind: 'o-aplikaciji' })}
        />
        {owner ? (
          <Row
            icon="lock"
            title="Vlasnik"
            sub="Obaveštenje korisnicima, korisnici"
            onClick={() => openScreen({ kind: 'vlasnik' })}
          />
        ) : null}
      </div>
    </>
  );
}
