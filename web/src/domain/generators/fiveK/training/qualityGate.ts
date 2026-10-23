import { addDays, diffDays, parseIsoDate } from '../date';
import type { T3kRecord, VdotRecord } from '../exchange';
import type { ExecutionAnalysis } from './execution';

/** Proizvodne postavke, ne medicinski pragovi. Isti brojevi stoje u tekstu uslova plana (`formPolicy.ts`). */
export const QUALITY_GATE = {
  minVolumeShare: 0.75,
  painBlock: 4,
  confirmationDays: 90
} as const;

export interface QualityGateResult {
  open: boolean;
  met: string[];
  unmet: string[];
  /** Podatak koji nedostaje: ne računa se ni kao ispunjen ni kao neuspeh, ali drži kapiju zatvorenom. */
  unknown: string[];
}

/** Merena forma: kontrolni test ili izmeren zapis forme, najviše 90 dana star. */
export function hasRecentMeasuredForm(
  today: string,
  evidence: { t3k?: readonly T3kRecord[]; vdotLog?: readonly VdotRecord[] }
): boolean {
  const now = parseIsoDate(today);
  if (!now) return false;
  const oldest = addDays(now, -QUALITY_GATE.confirmationDays);
  const recent = (iso: string | undefined): boolean => {
    const date = parseIsoDate(String(iso ?? '').slice(0, 10));
    return !!date && date >= oldest && diffDays(date, now) >= 0;
  };
  return (
    (evidence.t3k ?? []).some((r) => recent(r.date)) ||
    (evidence.vdotLog ?? []).some((r) => typeof r.measured === 'number' && recent(r.ts))
  );
}

/**
 * Da li je zahtevniji rad opravdan kad forma nije potvrđena. Samo savet: ne menja plan i ne zamenjuje
 * oporavak (`positiveAdjustmentBlock`) niti pravila prihvatanja merene forme.
 */
export function qualityEntryGate(input: {
  analysis: ExecutionAnalysis;
  recentPainMax?: number | null;
  formConfirmed: boolean;
}): QualityGateResult {
  const { analysis } = input;
  const out: QualityGateResult = { open: false, met: [], unmet: [], unknown: [] };
  const weeks = analysis.completeWeeks.slice(-2);
  const covered = weeks.every((w) => w.volumeCoverage >= 0.75);
  const enough = weeks.every(
    (w) => w.plannedKm > 0 && w.actualKm >= w.plannedKm * QUALITY_GATE.minVolumeShare
  );
  const painBlocked =
    typeof input.recentPainMax === 'number' && input.recentPainMax >= QUALITY_GATE.painBlock;
  const volume = 'Dve poslednje pune nedelje: bar 75% planiranog obima';
  if (!covered) out.unknown.push(`${volume} — kilometri nisu upisani za dovoljno treninga.`);
  else if (!enough) out.unmet.push(`${volume} — odrađeno je manje.`);
  else out.met.push(volume);
  const pain = 'Bez bola 4/10 ili jačeg u skorije vreme';
  if (painBlocked) out.unmet.push(`${pain} — postoji noviji zapis.`);
  else out.met.push(pain);
  const easy = 'Najviše jedan lak trening sa naporom 7+/10 u poslednje dve nedelje';
  if (analysis.easyHighRpeCount >= 2) out.unmet.push(`${easy} — prijavljena su bar dva.`);
  else out.met.push(easy);
  const form = 'Forma potvrđena merenjem u poslednjih 90 dana';
  if (input.formConfirmed) out.met.push(form);
  else out.unmet.push(`${form} — do tada napor vodi, a ritam je samo orijentir.`);
  out.open = out.unmet.length === 0 && out.unknown.length === 0;
  return out;
}
