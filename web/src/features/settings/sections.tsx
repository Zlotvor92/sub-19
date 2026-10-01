import { useRef, useState } from 'react';
import {
  parseTimeStr,
  fmtClock,
  glagolZaBroj,
  brojNedelja,
  pl3,
  fmtDayMonthYear
} from '../../domain/format';
import { parseIsoDate } from '../../domain/date';
import { planWithNewGoal } from '../../domain/plan';
import { raceRefs } from '../../domain/race';
import { getApp } from '../../app/appContext';
import { confirmAction } from '../../app/confirm';
import { downloadText } from '../../lib/download';
import { useResolvedPlan, useSettingsStore, useTrainingStore } from '../../stores';
import { discardPlan } from '../../stores/actions';
import { useAuthStore } from '../../stores/authStore';
import { useSyncStore } from '../../stores/syncStore';
import { useUIStore } from '../../stores/uiStore';
import { Help, type DotState } from './SettingCard';

export interface SectionInfo {
  visible: boolean;
  summary: string;
  dot: DotState;
  /** Sekcija se otvara sama (traži radnju). */
  open: boolean;
}

const dt = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('sr-RS');
};

/* ------------------------------------------------------------- Nalog */

export function useAccountInfo(): SectionInfo {
  const configured = useAuthStore((s) => s.configured);
  const signedIn = useAuthStore((s) => s.hasSession);
  const email = useAuthStore((s) => s.email);
  return {
    visible: configured,
    summary: signedIn ? (email ?? '—') : 'nije prijavljen',
    dot: signedIn,
    open: !signedIn
  };
}

export function AccountBody() {
  const signedIn = useAuthStore((s) => s.hasSession);
  const busy = useSyncStore((s) => s.busy);
  const closeSheet = useUIStore((s) => s.closeSheet);
  const openSheet = useUIStore((s) => s.openSheet);
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle');
  if (!signedIn)
    return (
      <>
        <div className="btnrow">
          <button type="button" className="btn" id="sb-in" onClick={() => getApp().login()}>
            Prijavi se Google nalogom
          </button>
        </div>
        <Help summary="Šta dobijam prijavom">
          <p>
            Bez prijave sve radi kao i do sad, samo bez rezervne kopije na serveru i bez istog plana
            na više uređaja.
          </p>
        </Help>
      </>
    );
  const seenAt = getApp().session.state.seenAt;
  return (
    <>
      <div className="set-st">
        {seenAt ? `sinhronizovano ${dt(seenAt)}` : 'još nije sinhronizovano'}
      </div>
      <div className="btnrow">
        <button
          type="button"
          className="btn ghost"
          id="sb-sync"
          disabled={state === 'busy' || busy}
          onClick={() => {
            setState('busy');
            void getApp()
              .sync.syncNow()
              .then((ok) => {
                setState(ok ? 'ok' : 'fail');
                setTimeout(() => setState('idle'), ok ? 900 : 1800);
              });
          }}
        >
          {state === 'busy'
            ? 'Sinhronizujem…'
            : state === 'ok'
              ? 'Sinhronizovano ✓'
              : state === 'fail'
                ? 'Nije uspelo'
                : 'Sinhronizuj'}
        </button>
        <button
          type="button"
          className="btn ghost sm"
          id="sb-out"
          onClick={() => {
            void confirmAction('Odjaviti se? Podaci na ovom uređaju ostaju.').then((ok) => {
              if (!ok) return;
              getApp().logout();
              closeSheet();
            });
          }}
        >
          Odjavi se
        </button>
      </div>
      <Help summary="Čemu služi prijava">
        <p>
          Podaci i dalje žive na ovom uređaju — server je samo rezervna kopija, pa aplikacija radi i
          bez signala. Prijava služi da plan bude isti na svim tvojim uređajima.
        </p>
      </Help>
      <Help summary="Brisanje naloga">
        <p>
          Briše nalog i <b>sve</b> podatke sa servera — plan, istoriju treninga, merenja oporavka i
          prijave za obaveštenja. Ne može da se poništi. Pre brisanja napravi „Backup" ako želiš da
          zadržiš kopiju.
        </p>
        <div className="btnrow">
          <button
            type="button"
            className="btn ghost sm"
            id="sb-del"
            onClick={() => openSheet({ kind: 'delete-account' })}
          >
            Obriši nalog
          </button>
        </div>
      </Help>
    </>
  );
}

/* ------------------------------------------------------------- Plan */

export function usePlanInfo(): SectionInfo {
  const plan = useResolvedPlan();
  return {
    visible: !!plan,
    summary: `tvoj plan · ${brojNedelja(plan?.weeks.length ?? 0)}`,
    dot: true,
    open: false
  };
}

export function PlanBody() {
  const genPlan = useTrainingStore((s) => s.genPlan);
  const setGenPlan = useTrainingStore((s) => s.setGenPlan);
  const today = useUIStore((s) => s.today);
  const setWizard = useUIStore((s) => s.setWizard);
  const closeSheet = useUIStore((s) => s.closeSheet);
  const [goal, setGoal] = useState('');
  if (!genPlan) return null;
  const refs = raceRefs(genPlan.meta);
  const goalText = fmtClock(refs.goalSec ?? 0);

  const changeGoal = async (): Promise<void> => {
    const sec = parseTimeStr(goal.trim());
    if (!sec || !(sec > 0)) {
      window.alert('Unesi ciljno vreme, npr. 3:25:00 ili 21:09.');
      return;
    }
    const day = parseIsoDate(today);
    if (!day) return;
    const r = planWithNewGoal(genPlan, sec, day);
    if ('error' in r) {
      window.alert(r.error);
      return;
    }
    /* Realnost cilja se proverava istim merilom koje čarobnjak već koristi. */
    const warn =
      r.meta.realno === false
        ? '\n\nUPOZORENJE: ovaj cilj je po proceni aplikacije van dohvata za preostalo vreme. Plan će ga ipak ispoštovati.'
        : '';
    const n = r.goalChange.changedWeeks;
    const ok = await confirmAction(
      `Promeniti ciljno vreme na ${fmtClock(sec)}?\n\n${glagolZaBroj(n, 'Menja se ', 'Menjaju se ')}${brojNedelja(n)} ${pl3(n, 'koja tek dolazi', 'koje tek dolaze', 'koje tek dolaze')} (od N${r.goalChange.week}).\nOdrađeni treninzi, uneti tempi i izmerena forma ostaju netaknuti.${warn}`
    );
    if (!ok) return;
    setGenPlan({ weeks: r.weeks, pred: r.pred, qs: r.qs, meta: r.meta, ulaz: r.ulaz });
    closeSheet();
    window.alert(`Cilj promenjen. Izmenjeno nedelja: ${n}.`);
  };

  return (
    <>
      {genPlan.ulaz ? (
        <>
          <div className="set-st">Ciljno vreme · {goalText}</div>
          <div className="btnrow">
            <input
              id="pl-goal"
              className="wseg-in"
              inputMode="numeric"
              style={{ maxWidth: 140 }}
              placeholder={goalText}
              aria-label="Novo ciljno vreme"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
            <button
              type="button"
              className="btn ghost sm"
              id="pl-goal-ok"
              onClick={() => void changeGoal()}
            >
              Promeni cilj
            </button>
          </div>
          <Help summary="Šta se menja kad promeniš cilj">
            <p>
              Menjaju se samo nedelje koje <b>tek dolaze</b> — i to tempi sesija vezanih za tempo
              trke. Odrađeni treninzi, uneti tempi i izmerena forma ostaju netaknuti; cilj govori o
              budućnosti, pa ne dira prošlost. Ručno zaključani tempi zadržavaju svoju vrednost.
            </p>
          </Help>
        </>
      ) : null}
      <div className="btnrow">
        <button
          type="button"
          className="btn ghost"
          id="pl-new"
          onClick={() => {
            void confirmAction(
              'Napraviti nov plan?\n\nPostojeći plan i svi unosi uz njega se TRAJNO brišu — nema arhive.\n\nAko ti trebaju, prvo izvezi backup.'
            ).then((ok) => {
              if (!ok) return;
              discardPlan();
              setWizard(true);
              closeSheet();
            });
          }}
        >
          🧙 Napravi novi plan
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- Podaci */

export function useDataInfo(): SectionInfo {
  const signedIn = useAuthStore((s) => s.hasSession);
  const lastBackup = useSettingsStore((s) => s.ui.lastBackup);
  return {
    visible: true,
    summary: signedIn
      ? 'na serveru · ranije verzije dostupne'
      : `samo na ovom uređaju · backup ${lastBackup ? fmtDayMonthYear(lastBackup) : 'nikad'}`,
    dot: signedIn ? true : lastBackup ? true : 'warn',
    open: false
  };
}

export function DataBody() {
  const signedIn = useAuthStore((s) => s.hasSession);
  const today = useUIStore((s) => s.today);
  const openSheet = useUIStore((s) => s.openSheet);
  const closeSheet = useUIStore((s) => s.closeSheet);
  const file = useRef<HTMLInputElement>(null);

  const doExport = (): void => {
    downloadText(`sub19-backup-${today}.json`, getApp().exportBackup());
  };

  const doImport = async (f: File | undefined): Promise<void> => {
    if (!f) return;
    let raw: unknown;
    try {
      raw = JSON.parse(await f.text());
    } catch (e) {
      window.alert(`Greška pri čitanju fajla: ${e instanceof Error ? e.message : 'nepoznata'}`);
      return;
    }
    const prep = getApp().prepareImport(raw);
    if (!prep.ok) {
      window.alert(
        prep.reason === 'unrecognized'
          ? 'Fajl nije prepoznat kao backup ove aplikacije ili je napravljen u novijoj verziji — ažuriraj aplikaciju pa pokušaj ponovo.'
          : prep.reason === 'broken-plan'
            ? 'Backup sadrži oštećen generisan plan, pa nije uvezen — ništa nije promenjeno.\n\nTvoji trenutni podaci su netaknuti.'
            : `Backup sadrži neispravan identifikator (${prep.detail}), pa nije uvezen — ništa nije promenjeno.\n\nOvo se dešava kod ručno izmenjenog fajla. Tvoji trenutni podaci su netaknuti.`
      );
      return;
    }
    const { workouts, pain, weight } = prep.counts;
    const ok = await confirmAction(
      `Uvoz će PREPISATI postojeće podatke.\n\nU fajlu: ${workouts} ${pl3(workouts, 'trening', 'treninga', 'treninga')}, ${pain} ${pl3(pain, 'zapis', 'zapisa', 'zapisa')} o bolu, ${weight} ${pl3(weight, 'merenje', 'merenja', 'merenja')} mase.\n\nNastaviti?`
    );
    if (!ok) return;
    const r = getApp().commitImport(prep.state);
    if (r.ok) closeSheet();
    else window.alert(`Uvoz nije uspeo: ${r.error}\n\nVraćeno je prethodno stanje.`);
  };

  return (
    <>
      {signedIn ? (
        <>
          <div className="set-st">
            Podaci se čuvaju na serveru, a server pamti i <b>ranije verzije</b> — greška se može
            vratiti unazad. Backup fajl više nije neophodan; ostaje za slučaj da ti kopija treba van
            aplikacije.
          </div>
          <div className="btnrow">
            <button
              type="button"
              className="btn"
              id="s-ist"
              onClick={() => openSheet({ kind: 'history' })}
            >
              🕓 Ranije verzije
            </button>
          </div>
        </>
      ) : (
        <div className="set-st" style={{ color: 'var(--amber)' }}>
          Nisi prijavljen, pa podaci žive <b>samo na ovom uređaju</b>. Backup je tada jedina kopija
          — ili se prijavi, pa ih server preuzme.
        </div>
      )}
      <div className="btnrow">
        <button type="button" className="btn ghost sm" id="s-exp" onClick={doExport}>
          Izvezi backup
        </button>
        <button
          type="button"
          className="btn ghost sm"
          id="s-imp"
          onClick={() => file.current?.click()}
        >
          Uvezi backup
        </button>
      </div>
      <input
        ref={file}
        type="file"
        id="s-file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // isti fajl se sme izabrati ponovo
          void doImport(f);
        }}
      />
      {signedIn ? (
        <div className="btnrow">
          <button
            type="button"
            className="btn ghost sm"
            id="s-bug"
            onClick={() => openSheet({ kind: 'bug' })}
          >
            Prijavi problem
          </button>
        </div>
      ) : null}
      <Help summary="Šta server pamti, a šta ne">
        <p>
          Pre svake izmene sačuva se prethodno stanje — najviše 40 verzija i najviše jedna na sat,
          što u praksi pokriva nedeljama unazad.
        </p>
        <p>
          <b>Brisanje naloga briše i istoriju.</b> Obrisano je obrisano; tu backup fajl ostaje
          jedina kopija, i zato ga dijalog za brisanje i traži.
        </p>
      </Help>
    </>
  );
}
