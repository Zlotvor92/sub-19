import { useState } from 'react';
import { displayName, reasonMessage } from '../../domain/community';
import { getApp } from '../../app/appContext';
import { useAuthStore } from '../../stores/authStore';
import { useCommunityStore } from '../../stores/communityStore';
import { Avatar } from '../community/Avatar';
import { Help } from './SettingCard';
import type { SectionInfo } from './sections';

export function useCommunityInfo(): SectionInfo {
  const signedIn = useAuthStore((s) => s.hasSession);
  const visible = useCommunityStore((s) => s.zajed.vidljiv);
  /* Kartica se NE otvara sama kad je isključena: isključeno je ispravno stanje, ne nedostatak, a ovo je jedina odluka u aplikaciji koja podatke
     iznosi iz naloga — otvorena kartica bi bila blag pritisak da se uključi. */
  return {
    visible: signedIn,
    summary: visible ? 'profil je vidljiv drugima' : 'isključena',
    dot: visible ? true : null,
    open: false
  };
}

export function CommunityBody() {
  const visible = useCommunityStore((s) => s.zajed.vidljiv);
  const nickname = useCommunityStore((s) => s.zajed.nadimak);
  const userId = useAuthStore((s) => s.userId);
  const googleName = useAuthStore((s) => s.name);
  const picture = useAuthStore((s) => s.picture);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState('');
  const shownName = displayName(nickname, googleName);

  const toggle = (): void => {
    setBusy(true);
    setOut('');
    void getApp()
      .community.setVisible(!visible)
      .then((r) => {
        /* Neuspeh se KAŽE: stanje je već vraćeno, pa je jedina preostala greška ćutanje — prekidač koji izgleda kao da je uspeo. */
        if (!r.ok) setOut(reasonMessage(navigator.onLine ? r.reason : 'mreza'));
      })
      .finally(() => setBusy(false));
  };

  return (
    <>
      <div className="set-st">
        Rang-lista trkača u aplikaciji. Dok je isključena, ne postojiš na spisku i ne vidiš tuđe
        profile — vidljivost je uzajamna.
      </div>
      <div className="f-grid">
        <div className="f-field full">
          <label htmlFor="zaj-nadimak">
            Nadimak <small style={{ color: 'var(--txt2)' }}>(prazno = ime sa Google naloga)</small>
          </label>
          <input
            id="zaj-nadimak"
            type="text"
            maxLength={24}
            placeholder={shownName ?? 'kako te zovu'}
            value={draft ?? nickname}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft == null) return;
              getApp().community.setNickname(draft);
              setDraft(null);
            }}
          />
        </div>
      </div>
      <div
        className="oprow"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px 0',
          borderTop: '1px solid var(--line)'
        }}
      >
        <Avatar profile={{ user_id: userId, nadimak: shownName, avatar_url: picture }} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block', fontSize: '.88rem' }}>{shownName ?? 'Trkač'}</b>
          <small
            style={{
              display: 'block',
              fontSize: '.7rem',
              color: 'var(--txt3)',
              fontWeight: 600,
              marginTop: 3
            }}
          >
            {picture
              ? 'ovako te vide ostali'
              : 'slika sa Google naloga još nije stigla — vidi se početno slovo'}
          </small>
        </div>
      </div>
      <div className="btnrow">
        <button
          type="button"
          className={`btn${visible ? ' ghost' : ''}`}
          id="zaj-tgl"
          disabled={busy}
          onClick={toggle}
        >
          {busy
            ? visible
              ? 'Isključujem…'
              : 'Uključujem…'
            : visible
              ? 'Isključi Zajednicu'
              : 'Uključi Zajednicu'}
        </button>
      </div>
      <div className="note-src" id="zaj-out" style={{ margin: '6px 0 0' }}>
        {out}
      </div>
      <Help summary="Šta drugi vide">
        <p>
          Nadimak i sliku sa Google naloga, ciljnu distancu i datum trke, koja si nedelja plana,
          VDOT sada i na početku, test na 3 km, kilometražu ove nedelje, doslednost, niz dana,
          značke i <b>do osam poslednjih trčanja</b> (datum, tip, dužina, tempo).
        </p>
      </Help>
      <Help summary="Šta drugi NIKAD ne vide">
        <p>
          HRV, puls u miru, san, težinu, mapu bolova, beleške sa treninga, puls na treningu, AI
          analizu i <b>e-adresu</b>. Ta polja ne postoje u tabeli Zajednice, pa ne mogu da izađu ni
          greškom u aplikaciji.
        </p>
        <p>GPS trase aplikacija ne čuva ni za sebe — gde si trčao se ne može podeliti ni ovde.</p>
      </Help>
      <Help summary="Isključivanje">
        <p>
          Briše tvoj red iz baze, ne samo što te sklanja sa spiska. Ponovno uključivanje ga pravi
          iznova iz tvojih tekućih podataka.
        </p>
      </Help>
    </>
  );
}
