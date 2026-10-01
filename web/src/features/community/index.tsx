import { useEffect } from 'react';
import { reasonMessage } from '../../domain/community';
import { getApp } from '../../app/appContext';
import { useCommunityStore } from '../../stores/communityStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { ListView } from './ListView';
import { ProfileView } from './ProfileView';

/* ZAJEDNICA. Tri stanja koja se ne smeju pomešati: (1) isključena — ne prikazuje se NIŠTA tuđe, jer se ništa tuđe ni ne povlači; kapija je u bazi
   (RLS), ovde je samo objašnjenje; (2) povlači se — kratko, i mora da se vidi da nešto radi; (3) spisak / profil.
   Poređenje sa drugima se računa OVDE, na uređaju: niko ne vidi koga s kim porediš. */

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
