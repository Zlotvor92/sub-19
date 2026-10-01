/* PRILAGOĐAVANJE PLANA POVREDI I PREKIDU — predlog, ne tiha izmena.

   Predlog (ne tiha izmena) zato što kod jakog bola ispravan odgovor nije „tiho smanji obim da nastavi da
   trči": to poručuje „sređeno je, samo napred". Predlog koji korisnik vidi i svesno prihvati čuva i
   njegovu kontrolu i tačnu poruku o ozbiljnosti.

   Aplikacija NE LEČI: bol 6+ nosi status „STANI" i poziv na stručnu pomoć; run/walk je prilagođavanje
   TRENINGA, i predlog se sme odbiti. Dan trke se NIKAD ne menja automatski. */

import { addDays, type IsoDate } from '../date';
import { fmtKm } from '../format';
import { setAlt } from '../plan/edit';
import type { ResolvedDay, ResolvedPlan } from '../plan/types';
import type { AltRecord, DayTag, LogEntry, PainRecord } from '../state';
import { runWalkText } from '../training/generator/runWalk';
import { pl3 } from '../format';
import type { RunWalk } from '../training/types';
import { partName } from './bodyParts';
import {
  ACWR_MAX,
  ACWR_RETURN,
  BREAK_NO_QUALITY_DAYS,
  BREAK_WINDOW_DAYS,
  PAIN_VOLUME_FALLBACK,
  PAIN_WATCH,
  PROPOSAL_HORIZON_DAYS,
  RW_BY_PAIN,
  RW_PAIN_MIN
} from './constants';
import { breakInfo, chronicKm, largestWeeklyKm, type LoadContext } from './load';
import { loadBearingEntries, nonLoadBearingPain, painStatus, returnToRunPhase } from './pain';

export interface RecoveryContext extends LoadContext {
  pain: readonly PainRecord[];
}

/** Run/walk po jačini bola; `null` ispod praga (vraća se neprekidno trčanje). */
export function runWalkForPain(pain: number): { rw: RunWalk; volume: number } | null {
  if (!(pain >= RW_PAIN_MIN)) return null;
  const s = RW_BY_PAIN.find((x) => pain >= x.from);
  if (!s) return null;
  return {
    rw: { runSec: s.runSec, walkSec: s.walkSec, label: runWalkText(s) },
    volume: s.volume
  };
}

export interface InjuryChange {
  id: string;
  date: IsoDate;
  from: DayTag | undefined;
  to: DayTag;
  km: number | null;
  rw?: RunWalk | null;
  desc: string;
}

export type InjuryLevel = 'pauza' | 'return' | 'trka' | 'runwalk' | 'warn';

export interface InjuryProposal {
  level: InjuryLevel;
  /** Samo za `return`: 1–4 (lestvica povratka). */
  week: number | null;
  pct?: number;
  urgent?: boolean;
  maxPain: number | null;
  parts: string[];
  changes: InjuryChange[];
  rw?: RunWalk | null;
  chronicKm?: number | null;
  budgetKm?: number | null;
  /** Dan trke u horizontu (samo uz status „stani"). */
  race?: { date: IsoDate; km: number | null; days: number } | null;
  title: string;
  message: string;
}

const nextTrainings = (n: number): string =>
  n === 1 ? 'narednog treninga' : `narednih ${n} treninga`;

interface Candidate {
  d: ResolvedDay;
  date: IsoDate;
  baseKm: number;
}

/** Dani u horizontu koje predlog sme da dira (bez odmora, trke, testa i — po izboru — snage). */
function horizonDays(ctx: RecoveryContext, today: IsoDate): Candidate[] {
  const out: Candidate[] = [];
  for (let i = 0; i < PROPOSAL_HORIZON_DAYS; i++) {
    const date = addDays(today, i);
    const d = ctx.plan.byDate.get(date);
    if (!d || d.rest) continue;
    /* Dan trke i test se NIKAD ne menjaju automatski — to je odluka koju čovek donosi sam. */
    if (d.tag === 'trka' || d.tag === 'test') continue;
    /* Snaga ostaje — nije udarno opterećenje na isti način kao trčanje. */
    if (d.tag === 'snaga') continue;
    /* Udeo se računa od ORIGINALNE kilometraže: inače bi drugi poziv smanjivao već smanjeno. */
    out.push({ d, date, baseKm: (d.origin.km != null ? d.origin.km : d.km) || 0 });
  }
  return out;
}

export function injuryProposal(ctx: RecoveryContext, today: IsoDate): InjuryProposal | null {
  const st = painStatus(ctx.pain, today);
  if (st.cls === 'ok') return recoveryProposal(ctx, today);
  return activePainProposal(ctx, today, st);
}

/** Bol je prošao, ali je bila ozbiljna epizoda ili prekid: POSTEPEN povratak umesto skoka na pun obim. */
function recoveryProposal(ctx: RecoveryContext, today: IsoDate): InjuryProposal | null {
  const ph = returnToRunPhase(ctx.pain, today);
  /* Bola nema i lestvice nema — ali prekid postoji i bez ijednog unosa bola (bolest, put, posao). */
  const pz = ph ? null : breakInfo(ctx, today);
  if (!ph && !pz) return null;

  /* ISTA ACWR GRANICA KAO U AKTIVNOJ FAZI: lestvica 50/70/85 % je od PLANIRANOG obima, a plan ne zna da
     je čovek stajao. Uzima se strože od dva. */
  const hron = chronicKm(ctx, today);
  const days = horizonDays(ctx, today).filter((x) => x.baseKm > 0);
  const planned = days.reduce((s, x) => s + x.baseKm, 0);
  /* Povratak sme na gornju ivicu bezbednog pojasa — cilj je rast ka planu, ne trajno smanjenje.
     (Probano pa odbačeno: umanjivati budžet za već istrčano — u ravnoteži seče oporavljenog trkača
     na 30 % plana doveka.) */
  const acwrP = hron != null && planned > 0 ? Math.min(1, (hron * ACWR_MAX) / planned) : 1;
  const pct = ph ? ph.pct : 1;
  /* POD: povratak posle prekida ne sme da IDE NANIŽE (inače spirala 22,6 → 12,9 → 12,6 km). Samo za
     prekid: posle bola je spuštanje ispod trenutnog obima cela poenta lestvice. */
  const floor = ph ? 0 : planned > 0 ? Math.min(1, largestWeeklyKm(ctx, today, 14) / planned) : 0;
  const noQuality = ph
    ? ph.week <= 2
    : pz?.daysWithoutRunning != null && pz.daysWithoutRunning >= BREAK_NO_QUALITY_DAYS;
  const reason = ph ? ' km — povratak posle povrede' : ' km — povratak posle prekida';
  const actual = Math.max(floor, Math.min(pct, acwrP));

  const changes: InjuryChange[] = [];
  for (const x of days) {
    /* KLJUČNO: od ORIGINALNE kilometraže, inače bi drugi put dalo 70 % od već smanjenih 50 %. */
    const newKm = Math.max(2, Math.round(x.baseKm * actual * 10) / 10);
    if (newKm >= x.baseKm) continue;
    const origTag = x.d.origin.tag || x.d.tag;
    const to: DayTag =
      noQuality && (origTag === 'int' || origTag === 'tempo') ? 'lako' : (origTag as DayTag);
    changes.push({
      id: x.d.id,
      date: x.date,
      from: x.d.tag,
      to,
      km: newKm,
      desc: (to === 'lako' ? 'Lagano ' : '') + fmtKm(newKm) + reason
    });
  }
  if (!changes.length) return null;

  if (!ph && pz) {
    const without = pz.daysWithoutRunning;
    return {
      level: 'pauza',
      week: null,
      pct: actual,
      maxPain: null,
      parts: [],
      changes,
      title: 'Povratak posle prekida',
      message:
        (without != null && without >= 3
          ? `Bez trčanja ${without} ${without === 1 ? 'dan' : 'dana'}. `
          : `U poslednjih ${BREAK_WINDOW_DAYS} dana odrađeno je ${Math.round(pz.completion * 100)}% planiranog obima. `) +
        `Plan od sledeće nedelje traži više nego što telo trenutno nosi: prosek stvarno odrađenog u poslednje 4 nedelje je ${fmtKm(hron)} km/ned, a sledećih 7 dana traži ${fmtKm(planned)} km. ` +
        `Predlog: ${Math.round(actual * 100)}% planiranog obima ${nextTrainings(changes.length)}${noQuality ? ', bez kvalitetnih treninga' : ''}. ` +
        'Predlog se svake nedelje sam podiže i nestaje čim prosek odrađenog sustigne plan; koliko će to trajati zavisi od toga koliko je prekid trajao i koliko plan traži — posle duže pauze u sredini priprema to ume da bude i mesec i po. ' +
        'Ne ide naniže: nikad se ne predlaže manje nego što si već odradio u nedelji pred ovu. ' +
        'Posle dve nedelje bez trčanja pada i forma, ne samo obim; dugo trčanje se zato vraća postepeno kao i sve ostalo.'
    };
  }
  if (!ph) return null;

  const pctTxt = `${Math.round(ph.pct * 100)}%`;
  /* PREDUSLOVI: protokoli povratka se trče po ODGOVORU TKIVA, ne po kalendaru. Aplikacija ne može da
     izmeri simetriju snage ni test poskoka, pa ih NAVODI kao uslov koji korisnik sam proveri. Prag
     povratne faze je bol ISPOD 3, pa se ne piše „bez bola" (netačno za nekoga ko je uneo bol 2). */
  const head =
    ph.week > 3
      ? `${Math.round(acwrP * 100)}% planiranog obima — tri nedelje lestvice su prošle, ali je prosek stvarno odrađenog u poslednje 4 nedelje ${fmtKm(hron)} km/ned, a sledećih 7 dana traži ${fmtKm(planned)} km. Pun obim se vraća sam čim ga prosek sustigne`
      : acwrP < ph.pct
        ? `${Math.round(acwrP * 100)}% planiranog obima (lestvica povratka kaže ${pctTxt}, ali prosek stvarno odrađenog u poslednje 4 nedelje — ${fmtKm(hron)} km/ned — dozvoljava manje)`
        : `${pctTxt} planiranog obima`;
  return {
    level: 'return',
    week: ph.week,
    pct: ph.pct,
    maxPain: null,
    parts: [],
    changes,
    title: ph.week <= 3 ? `Povratak — nedelja ${ph.week} od 3` : 'Povratak — obim prati oporavak',
    message:
      `Bez bola 3+ već ${ph.daysSince} ${ph.daysSince === 1 ? 'dan' : 'dana'}. Predlog: ${head} ${nextTrainings(changes.length)}${noQuality ? ', bez kvalitetnih treninga' : ''}. ` +
      'Pre nego što prihvatiš — proveri da možeš: 30 min brzog hoda bez bola, 20 poskoka na povređenoj nozi bez bola, i da nema bola u mirovanju. Ako bilo šta od toga ne prolazi, rano je za trčanje bez obzira na broj dana. Ostavi bar jedan dan odmora između trčanja.'
  };
}

/** Bol traje (status „pazi" / „stani" / „fizijatar"). */
function activePainProposal(
  ctx: RecoveryContext,
  today: IsoDate,
  st: ReturnType<typeof painStatus>
): InjuryProposal | null {
  const from = addDays(today, -6);
  const recent = loadBearingEntries(ctx.pain, from, today).filter((k) => k.pain >= PAIN_WATCH);
  if (!recent.length) return null;

  const maxPain = recent.reduce((m, k) => Math.max(m, k.pain), 0);
  const parts = [...new Set(recent.map((k) => partName(k.part)))];
  /* Bol 4+ ide na run/walk, bez obzira koliko je jak — plan se ne prazni. `urgent` (bol 6+) menja SAMO
     ton poruke i boju kartice, ne i to da li se trči: to je odluka koju čovek donosi sam, uz lekara. */
  const urgent = st.cls === 'stop';
  const rwS = runWalkForPain(maxPain);
  const rw = rwS ? rwS.rw : null;
  const horizon = PROPOSAL_HORIZON_DAYS;

  /* NEDELJNI BUDŽET: sve što se dira deli jedan budžet = 0,8 × hronično. Bez istorije se pada na udele. */
  const hron = chronicKm(ctx, today);
  const budget = hron != null ? Math.round(hron * ACWR_RETURN * 10) / 10 : null;

  const days = horizonDays(ctx, today);
  const planned = days.reduce((s, x) => s + x.baseKm, 0);
  /* DVA OGRANIČENJA, UZIMA SE STROŽE: (1) smanjenje po jačini bola; (2) ACWR granica. Samo (1) isto
     za svakoga ne valja; samo (2) ne menja ništa kad je plan već ispod hroničnog proseka. */
  const budgetH = budget != null ? (budget * horizon) / 7 : null;
  const acwrFactor = budgetH != null && planned > 0 ? Math.min(1, budgetH / planned) : 1;

  const changes: InjuryChange[] = [];
  for (const x of days) {
    const d = x.d;
    const oldKm = x.baseKm;
    const isQuality = d.tag === 'int' || d.tag === 'tempo' || d.tag === 'lr';
    const painFactor = rwS
      ? rwS.volume
      : isQuality
        ? PAIN_VOLUME_FALLBACK.quality
        : PAIN_VOLUME_FALLBACK.easy;
    const factor = Math.min(painFactor, acwrFactor);
    let newKm: number | null = oldKm ? Math.max(2, Math.round(oldKm * factor * 10) / 10) : null;
    if (newKm != null && newKm > oldKm) newKm = oldKm; /* nikad naviše */
    /* Bez run/walk-a, lagan dan koji se ne menja nema šta da prijavi. */
    if (!rw && !isQuality && newKm === oldKm) continue;
    const kmTxt = newKm != null ? `${fmtKm(newKm)} km` : '';
    changes.push({
      id: d.id,
      date: x.date,
      from: d.tag,
      to: 'lako',
      km: newKm,
      rw: rw || null,
      desc: rw
        ? `Run/walk ${kmTxt} — ${runWalkText(rw)}, zbog bola ${maxPain}/10`
        : `Lagano ${kmTxt} — smanjeno zbog bola ${maxPain}/10`
    });
  }

  /* TRKA U HORIZONTU — kad se ništa ne menja, mora bar da se KAŽE. Dan trke se nikad ne menja sam, ali iz
     „ne menjaj" je ispalo „ne pominji": na sam dan trke `changes` ostane prazan i kartica nestane — baš
     kad je odluka najskuplja. */
  let race: InjuryProposal['race'] = null;
  if (urgent) {
    for (let i = 0; i < horizon; i++) {
      const d = ctx.plan.byDate.get(addDays(today, i));
      if (d && d.tag === 'trka') {
        race = { date: addDays(today, i), km: d.km, days: i };
        break;
      }
    }
  }
  if (!changes.length && !race) return null;

  const raceTxt = race
    ? ` TRKA: ${fmtKm(race.km)} km ${race.days === 0 ? 'DANAS' : `za ${race.days} ${race.days === 1 ? 'dan' : 'dana'}`}. Plan trke se ne menja sam — to je tvoja odluka, i aplikacija je ne donosi umesto tebe. Ali bol ${maxPain}/10 nosi status STANI, a startovati sa aktivnim bolom koji ovih dana nije dozvoljavao ni neprekidno trčanje nije isto što i startovati umoran. Ako ideš, znaj da ideš na to; ako sumnjaš, pitaj fizijatra pre starta.`
    : '';
  if (!changes.length)
    return {
      level: 'trka',
      week: null,
      urgent,
      maxPain,
      parts,
      changes: [],
      rw,
      chronicKm: hron,
      budgetKm: budget,
      race,
      title: st.t,
      message: `Bol ${maxPain}/10 (${parts.join(', ')}).${raceTxt}`
    };

  const total = changes.reduce((s, c) => s + (c.km || 0), 0);
  const volumeTxt =
    ` Obim ${nextTrainings(changes.length)}: ${fmtKm(total)} km umesto ${fmtKm(planned)} km` +
    (hron != null
      ? ` (prosek stvarno odrađenog u poslednje 4 nedelje: ${fmtKm(hron)} km/ned).`
      : '.');
  /* Bol koji ne nosi trčanje se NE prećutkuje — samo ne prepisuje plan. */
  const other = nonLoadBearingPain(ctx.pain, from, today);
  const otherTxt = other
    ? ` Prijavljen je i bol ${other.max}/10 (${other.parts.join(', ')}) — to ne menja plan trčanja, ali ga ne zanemaruj.`
    : '';
  const n = changes.length;
  return {
    level: rw ? 'runwalk' : 'warn',
    week: null,
    urgent,
    maxPain,
    parts,
    changes,
    rw,
    chronicKm: hron,
    budgetKm: budget,
    title: st.t,
    /* Poruka je namerno različita po ozbiljnosti — plan se prilagođava, ali app NE glumi da je jak bol
       rešen kraćim trčanjem. */
    message:
      (rw
        ? `Bol ${maxPain}/10 (${parts.join(', ')}). Neprekidno trčanje je prerano: ${pl3(n, 'naredni trening ide', `naredna ${n} treninga idu`, `narednih ${n} treninga ide`)} po run/walk metodi — ${runWalkText(rw)}. Hod prekida udarno opterećenje, pa tkivo dobija ciklus opterećenje–rasterećenje umesto neprekidnog rada.${volumeTxt} Neprekidno trčanje se vraća kad bol padne ispod ${RW_PAIN_MIN}.` +
          (urgent
            ? ` Bol ${maxPain}/10 je ozbiljan — ovo je prilagođavanje TRENINGA, ne lečenje. Ako te boli u mirovanju, ako šepaš ili ako bol ne popušta, ne trči ni ovoliko i javi se fizijatru ili lekaru.`
            : ' Ako bol poraste, prekini i javi se stručnjaku.')
        : `Bol ${maxPain}/10 (${parts.join(', ')}). Predlog: kvalitetni treninzi postaju lagani, obim smanjen za ${pl3(n, 'naredni trening', `naredna ${n} treninga`, `narednih ${n} treninga`)}.${volumeTxt} Ako bol poraste na ${RW_PAIN_MIN}+, prelazi se na run/walk.`) +
      otherTxt +
      raceTxt
  };
}

/**
 * Primena predloga — odvojeno od `injuryProposal` namerno: predlog se može prikazati i odbiti bez ikakve
 * izmene stanja. Vraća nove `alts` i broj primenjenih; ulaz se ne menja.
 */
export function applyInjuryProposal(
  proposal: Pick<InjuryProposal, 'changes'> | null,
  plan: ResolvedPlan,
  log: Readonly<Record<string, LogEntry>>,
  alts: Readonly<Record<string, AltRecord>>
): { applied: number; alts: Record<string, AltRecord> } {
  let next: Record<string, AltRecord> = { ...alts };
  let applied = 0;
  for (const ch of proposal?.changes ?? []) {
    if (!plan.byId.get(ch.id)) continue;
    const r = setAlt(plan, log, next, ch.id, {
      tag: ch.to,
      km: ch.km,
      desc: ch.desc,
      rw: ch.rw || null
    });
    if (!r.ok) continue;
    next = r.alts;
    applied++;
  }
  return { applied, alts: next };
}
