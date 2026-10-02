import { useState } from 'react';
import { pl3 } from '../../domain/format';
import { broadcastAll } from '../../services/api/adminApi';
import { getApp } from '../../app/appContext';
import { confirmAction } from '../../app/confirm';
import { useAuthStore } from '../../stores/authStore';
import { useCommunityStore } from '../../stores/communityStore';
import { useUIStore } from '../../stores/uiStore';
import { useIsOwner } from '../../stores/owner';
import { Help } from './SettingCard';
import type { SectionInfo } from './sectionInfo';

/* VLASNIČKE SEKCIJE. Dugmad vidi samo vlasnik (`ADMIN_UID` odlučuje SAMO o prikazu); pravu proveru radi server nad adresom iz tokena. */

export function useBroadcastInfo(): SectionInfo {
  const owner = useIsOwner();
  return {
    visible: owner,
    summary: 'mejl svima koji imaju nalog · samo ti',
    dot: true,
    open: false
  };
}
export function useUsersInfo(): SectionInfo {
  const owner = useIsOwner();
  return { visible: owner, summary: 'ko ima nalog · samo ti', dot: true, open: false };
}

const addresses = (n: number): string => `${n} ${pl3(n, 'adresa', 'adrese', 'adresa')}`;

export function BroadcastBody() {
  const email = useAuthStore((s) => s.email);
  const [list, setList] = useState<string[] | null>(null);
  const [empty, setEmpty] = useState(false);
  const [busy, setBusy] = useState<null | 'list' | 'test' | 'all'>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const admin = getApp().admin;

  const showList = async (): Promise<void> => {
    if (list || empty) {
      setList(null);
      setEmpty(false);
      return;
    }
    setBusy('list');
    const r = await admin.broadcast({});
    setBusy(null);
    if (!r.ok) {
      window.alert(r.error || 'Nije uspelo.');
      return;
    }
    const to = r.page.primaoci ?? [];
    if (!to.length) setEmpty(true);
    else setList(to);
  };

  const trial = async (): Promise<void> => {
    /* Adresa se uzima iz PRIJAVLJENE sesije, ne iz konstante u kodu. Server `samoNa` ionako filtrira kroz stvarnu listu korisnika. */
    const mine = (email ?? '').trim().toLowerCase();
    if (!mine) {
      window.alert('Nisi prijavljen.');
      return;
    }
    setBusy('test');
    setLabel('Šaljem…');
    const r = await admin.broadcast({ posalji: true, samoNa: [mine] });
    setLabel(r.ok ? 'Poslato ✓' : 'Nije uspelo');
    window.alert(
      r.ok ? `Poslato na ${mine}. Proveri sanduče — i spam.` : r.error || 'Nije uspelo.'
    );
    setTimeout(() => {
      setBusy(null);
      setLabel(null);
    }, 2200);
  };

  const all = async (): Promise<void> => {
    setBusy('all');
    setLabel('Brojim…');
    /* prvo SUVO — koliko ih je; slanje svima se ne poništava, pa se ne kreće naslepo */
    const dry = await admin.broadcast({});
    if (!dry.ok) {
      setBusy(null);
      setLabel(null);
      window.alert(dry.error || 'Nije uspelo.');
      return;
    }
    const n = dry.page.primalaca || 0;
    if (!n) {
      setBusy(null);
      setLabel(null);
      window.alert('Nema nijednog primaoca.');
      return;
    }
    const ok = await confirmAction(
      `Poslati uputstvo na ${n} ${pl3(n, 'adresu', 'adrese', 'adresa')}?\n\nMejl se ne može povući. Traje oko ${Math.ceil(n * 0.6)} s — ne zatvaraj aplikaciju.`
    );
    if (!ok) {
      setBusy(null);
      setLabel(null);
      return;
    }
    const r = await broadcastAll(admin, (p) => setLabel(`Šaljem ${p.sent}/${n}…`));
    setLabel(r.ok ? `Poslato ${r.sent} ✓` : 'Nije uspelo');
    window.alert(
      r.ok
        ? `Poslato: ${r.sent}${r.failed ? ` · nije stiglo: ${r.failed}` : ''}`
        : `${r.error}${r.sent ? `\n\nDo prekida je poslato: ${r.sent}. Ponovni poziv nastavlja odatle, bez duplikata.` : ''}`
    );
    setTimeout(() => {
      setBusy(null);
      setLabel(null);
    }, 2600);
  };

  return (
    <>
      <div className="set-st">
        Šalje mejl sa linkom na <b>uputstvo</b> svima koji imaju nalog.
      </div>
      <div className="btnrow">
        <button
          type="button"
          className="btn ghost sm"
          id="bc-lista"
          disabled={busy !== null}
          onClick={() => void showList()}
        >
          {busy === 'list' ? 'Čitam…' : '📋 Spisak adresa'}
        </button>
        <button
          type="button"
          className="btn ghost sm"
          id="bc-proba"
          disabled={busy !== null}
          onClick={() => void trial()}
        >
          {busy === 'test' ? label : 'Proba na mene'}
        </button>
      </div>
      <div className="btnrow">
        <button
          type="button"
          className="btn ghost sm"
          id="bc-svi"
          disabled={busy !== null}
          onClick={() => void all()}
        >
          {busy === 'all' ? label : 'Pošalji svima…'}
        </button>
      </div>
      <div id="bc-out">
        {empty ? <div className="note-src">Nema nijednog naloga.</div> : null}
        {list ? (
          <>
            <div className="note-src" style={{ margin: '10px 0 6px' }}>
              {addresses(list.length)} · nalepi ih u <b>BCC</b>, ne u „Za", da niko ne vidi tuđe.
            </div>
            <textarea
              id="bc-txt"
              readOnly
              rows={4}
              value={list.join(', ')}
              aria-label="Adrese"
              style={{
                width: '100%',
                background: 'var(--card2)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: 10,
                color: 'var(--txt)',
                fontSize: '.78rem',
                lineHeight: 1.5,
                resize: 'vertical'
              }}
            />
            <div className="btnrow" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn ghost sm"
                id="bc-kopiraj"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(list.join(', '))
                    .catch(() => undefined)
                    .finally(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    });
                }}
              >
                {copied ? 'Kopirano ✓' : 'Kopiraj adrese'}
              </button>
            </div>
          </>
        ) : null}
      </div>
      <Help summary="Šta se tačno šalje">
        <p>
          Kratak mejl sa dugmetom koje vodi na <b>/uputstvo.html</b>. Ceo tekst se namerno ne šalje
          mejlom — poslat mejl se ne može ispraviti, a stranica može.
        </p>
        <p>
          Svaki mejl ide <b>posebno</b>, da niko ne vidi tuđe adrese. „Pošalji svima" prvo prebroji
          primaoce i pita za potvrdu.
        </p>
      </Help>
    </>
  );
}

export function UsersBody() {
  const openSheet = useUIStore((s) => s.openSheet);
  return (
    <>
      <div className="set-st">
        Spisak svih naloga, sa poslednjom prijavom. Odavde se briše tuđ nalog zajedno sa svim
        njegovim podacima.
      </div>
      <div className="btnrow">
        <button
          type="button"
          className="btn ghost sm"
          id="ku-otvori"
          onClick={() => openSheet({ kind: 'users' })}
        >
          👥 Otvori spisak
        </button>
      </div>
    </>
  );
}

/** Tekst izazova nedelje (samo vlasnik): isti tekst stoji svima dok se ne promeni — menja se retko. */
export function ChallengeEditor() {
  const owner = useIsOwner();
  const challenge = useCommunityStore((s) => s.challenge);
  const setRemote = useCommunityStore((s) => s.setRemote);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState('');
  if (!owner) return null;
  const save = async (): Promise<void> => {
    const text = (draft ?? challenge ?? '').trim();
    if (text.length < 3 || text.length > 160) {
      setOut('Izazov mora imati između 3 i 160 znakova.');
      return;
    }
    setBusy(true);
    const r = await getApp().admin.setChallenge(text);
    setBusy(false);
    if (!r.ok) {
      setOut(r.error || 'Nije uspelo.');
      return;
    }
    setRemote({ challenge: r.text });
    setDraft(null);
    setOut('Sačuvano. Svi ga vide pri sledećem otvaranju Zajednice.');
  };
  return (
    <Help summary="Izazov nedelje · samo ti">
      <p>
        Isti tekst stoji svima dok ga ne promeniš. Menja se retko — poenta je da ljudi znaju šta se
        od njih očekuje, ne da svake nedelje pogađaju.
      </p>
      <div className="f-field full">
        <label htmlFor="zaj-izazov">Tekst izazova</label>
        <input
          id="zaj-izazov"
          type="text"
          maxLength={160}
          placeholder="Odradi sve treninge po planu ove nedelje."
          value={draft ?? challenge ?? ''}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>
      <div className="btnrow" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn ghost sm"
          id="zaj-izazov-cuvaj"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? 'Čuvam…' : 'Sačuvaj izazov'}
        </button>
      </div>
      <div className="note-src" id="zaj-izazov-out">
        {out}
      </div>
    </Help>
  );
}
