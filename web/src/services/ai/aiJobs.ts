/* TOK AI ANALIZE: analiza je ODVOJENA OD ČEKANJA.

   Ranije je jedan zahtev radio sve (klik → čekaj → tekst) i živeo najduže koliko serverska funkcija (60 s): svaki sporiji odgovor modela
   završavao je kao HTTP 504, a rezultat je nestajao jer nije imao gde da se upiše. Isto kad telefon uspava stranicu — veza pukne, rezultat
   propadne, a kvota je potrošena. Sada posao ima svoj red u bazi (supabase/ai-posao.sql): klijent ga POKRENE, ne čeka ga, i pokupi
   rezultat kad god se vrati — pri sledećem pitanju ili pri sledećem otvaranju aplikacije.

   Tri faze: `start` (otvara red i troši kvotu), `radi` (računa; šalje se BEZ čekanja i sme da traje koliko mu treba), `citaj`. Ne baca. */

import { z } from 'zod';
import { AI_GIVE_UP_MS, AI_TEXT_MAX, aiJobAge, aiJobOf, aiRemaining } from '../../domain/ai';
import type { LogEntry } from '../../domain/state';
import type { AppApi } from '../api/appApi';

const Started = z
  .object({ posaoId: z.union([z.string(), z.number()]).transform(String) })
  .passthrough();
const Read = z
  .object({
    stanje: z.string().optional(),
    tekst: z.unknown().optional(),
    greska: z.unknown().optional()
  })
  .passthrough();
const Any = z.unknown();

export interface AiLogPort {
  get(dayId: string): LogEntry | undefined;
  /** Upisuje ceo zapis dana (jedan upis po akciji). */
  set(dayId: string, entry: LogEntry): void;
  ids(): string[];
}

export interface AiJobsDeps {
  api: AppApi;
  log: AiLogPort;
  now: () => number;
  online: () => boolean;
  isAuthed: () => boolean;
  isOwner: () => boolean;
  sleep: (ms: number) => Promise<void>;
}

/** Ishod jednog pitanja: gotovo i greška su konačni; `radi` znači „pitaj ponovo"; `null` = nema posla. */
export type CheckResult = 'gotovo' | 'greska' | 'radi' | null;
export type RunResult = { phase: CheckResult; error: string | null };

export const POLL_EVERY_MS = 3000;
export const POLL_TIMES = 30;
/** Tekst iz odgovora: string ili broj; sve ostalo je prazno (objekat bi dao „[object Object]"). */
const text = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
const FAILED_FALLBACK = 'Analiza nije uspela.';

export function createAiJobs(deps: AiJobsDeps) {
  const { api, log } = deps;

  const update = (dayId: string, mutate: (l: LogEntry) => void): LogEntry => {
    const next: LogEntry = { ...(log.get(dayId) ?? {}) };
    mutate(next);
    log.set(dayId, next);
    return next;
  };

  /** Jedan pogled u bazu. */
  async function check(dayId: string): Promise<CheckResult> {
    const l0 = log.get(dayId);
    const job = aiJobOf(l0);
    if (!l0 || !job) return null;
    const r = await api.post('/api/analyze', { posao: 'citaj', posaoId: job.id }, Read);
    if (!r.ok) {
      /* 404 znači da je red istekao ili obrisan — nema šta da se čeka. */
      if (r.status === 404) {
        update(dayId, (l) => void delete l['aiPosao']);
        return 'greska';
      }
      return 'radi';
    }
    const st = r.data.stanje;
    if (st === 'gotovo') {
      update(dayId, (l) => {
        l['aiText'] = text(r.data.tekst).slice(0, AI_TEXT_MAX);
        l['aiAt'] = deps.now();
        l['aiCount'] = (Number(l['aiCount']) || 0) + 1;
        delete l['aiPosao'];
        delete l['aiGreska'];
      });
      return 'gotovo';
    }
    if (st === 'greska') {
      update(dayId, (l) => {
        l['aiGreska'] = text(r.data.greska) || FAILED_FALLBACK;
        delete l['aiPosao'];
      });
      return 'greska';
    }
    /* POSAO KOJI SE NIKAD NE ZAVRŠI: baza ne razlikuje „radi se" od „umrlo je usred posla". Posle pola sata ta razlika više nije ni važna —
       čovek mora da dobije natrag dugme. Odustaje se SAMO lokalno; ako rezultat kasnije ipak stigne, red se briše pri sledećem pokretanju. */
    const aged = aiJobAge(log.get(dayId), deps.now());
    if (aged.stamp) {
      update(dayId, (l) => {
        l['aiPosao'] = { ...(l['aiPosao'] as object), at: deps.now() };
      });
    } else if (aged.age >= AI_GIVE_UP_MS) {
      update(dayId, (l) => {
        l['aiGreska'] = 'Analiza nije završena na vreme. Pokušaj ponovo.';
        delete l['aiPosao'];
      });
      return 'greska';
    }
    return 'radi';
  }

  /** Pita na svake tri sekunde, najviše minut i po. Ako ne dočeka, posao ostaje zapisan — ništa nije izgubljeno. */
  async function wait(dayId: string): Promise<CheckResult> {
    for (let i = 0; i < POLL_TIMES; i++) {
      await deps.sleep(POLL_EVERY_MS);
      const st = await check(dayId);
      if (st === 'gotovo' || st === 'greska') return st;
      if (st === null) return 'gotovo'; // neko drugi ga je već pokupio
    }
    return 'radi';
  }

  /**
   * Klik na „Analiziraj": pokreni, pošalji račun BEZ čekanja, pa pitaj za rezultat. `payload` je zahtev za model (gradi ga domen).
   * `onStarted` se zove čim je red otvoren (kartica prelazi u „radi se").
   */
  async function run(
    dayId: string,
    payload: Record<string, unknown>,
    onStarted?: () => void
  ): Promise<RunResult> {
    if (!aiRemaining(log.get(dayId), deps.isOwner())) return { phase: null, error: null };
    const started = await api.post('/api/analyze', { posao: 'start' }, Started);
    if (!started.ok) return { phase: 'greska', error: started.error };
    update(dayId, (l) => {
      l['aiPosao'] = { id: started.data.posaoId, at: deps.now() };
      delete l['aiGreska']; // razlog prethodnog neuspeha više ne važi
    });
    onStarted?.();
    /* `danId` ide SAMO da bi obaveštenje „analiza je gotova" znalo na koji trening da odvede. */
    void api
      .post(
        '/api/analyze',
        { posao: 'radi', posaoId: started.data.posaoId, danId: dayId, ...payload },
        Any
      )
      .catch(() => undefined);
    const phase = await wait(dayId);
    return {
      phase,
      error:
        phase === 'greska'
          ? (log.get(dayId)?.['aiGreska'] as string | undefined) || FAILED_FALLBACK
          : null
    };
  }

  /**
   * Ponovo pošalji fazu „radi" za posao koji već postoji. NE troši kvotu: dnevni limit se broji u fazi „start", a server posao preuzme samo
   * ako je red još u stanju „radi" — ponovljen poziv nad poslom koji uveliko računa ne može da ga pokvari ni udvostruči.
   */
  async function retry(dayId: string, payload: Record<string, unknown>): Promise<RunResult> {
    const job = aiJobOf(log.get(dayId));
    if (!job) return { phase: null, error: null };
    update(dayId, (l) => {
      l['aiPosao'] = { ...(l['aiPosao'] as object), at: deps.now() }; // prozor čekanja kreće ispočetka
    });
    await api.post(
      '/api/analyze',
      { posao: 'radi', posaoId: job.id, danId: dayId, ...payload },
      Any
    );
    const phase = await wait(dayId);
    return {
      phase,
      error:
        phase === 'greska'
          ? (log.get(dayId)?.['aiGreska'] as string | undefined) || FAILED_FALLBACK
          : null
    };
  }

  let collecting = false;
  /** Pri otvaranju i povratku u aplikaciju: pokupi sve što je u međuvremenu završeno (najviše 5 dana). Vraća da li se nešto promenilo. */
  async function collectAll(): Promise<boolean> {
    if (collecting || !deps.online() || !deps.isAuthed()) return false;
    const days = log.ids().filter((id) => aiJobOf(log.get(id)));
    if (!days.length) return false;
    collecting = true;
    let changed = false;
    /* try/finally: da je `check` ikad bacio, zastavica bi ostala podignuta i pokupljanje bi TIHO prestalo do sledećeg učitavanja. */
    try {
      for (const id of days.slice(0, 5)) {
        const st = await check(id);
        if (st === 'gotovo' || st === 'greska') changed = true;
      }
    } finally {
      collecting = false;
    }
    return changed;
  }

  return { check, wait, run, retry, collectAll };
}

export type AiJobs = ReturnType<typeof createAiJobs>;
