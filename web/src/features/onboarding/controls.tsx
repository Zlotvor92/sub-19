import type { ChangeEvent, ReactElement } from 'react';
import { clampDigits } from '../../domain/onboarding';

/* Kontrole čarobnjaka: izbor jednog čipa, izbor dana u nedelji i polja za vreme (h : min : sek). Bez ikakve logike odlučivanja — sve što zna je kako da se nacrta. */

export const DOW = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'] as const;
export const RACE_DISTS = [
  [5000, '5K'],
  [10000, '10K'],
  [21097.5, 'Polumaraton'],
  [42195, 'Maraton']
] as const;
export const PB_DISTS = [
  [5000, '5 km'],
  [10000, '10 km'],
  [21097.5, 'Polumaraton'],
  [42195, 'Maraton']
] as const;

export function Chips<T extends string | number>({
  items,
  value,
  onPick,
  className,
  disabled,
  label
}: {
  items: ReadonlyArray<readonly [T, string]>;
  value: T | null;
  onPick: (v: T) => void;
  className?: string;
  disabled?: (v: T) => boolean;
  label: string;
}) {
  return (
    <div
      className={`ob-chiprow${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={label}
    >
      {items.map(([v, text]) => {
        const off = disabled?.(v) ?? false;
        return (
          <button
            key={String(v)}
            type="button"
            className={`ob-chip${v === value ? ' on' : ''}`}
            aria-pressed={v === value}
            disabled={off}
            style={off ? { opacity: 0.3 } : undefined}
            onClick={() => onPick(v)}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

export function DaysChips({
  selected,
  onToggle,
  disabled,
  label
}: {
  selected: readonly number[];
  onToggle: (d: number) => void;
  disabled?: (d: number) => boolean;
  label: string;
}) {
  return (
    <div className="ob-chiprow week" role="group" aria-label={label}>
      {DOW.map((n, i) => {
        const d = i + 1;
        const off = disabled?.(d) ?? false;
        const on = selected.includes(d);
        return (
          <button
            key={d}
            type="button"
            className={`ob-chip${on ? ' on' : ''}`}
            aria-pressed={on}
            disabled={off}
            style={off ? { opacity: 0.3 } : undefined}
            onClick={() => onToggle(d)}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

export function TimeFields({
  prefix,
  hours,
  values,
  onChange
}: {
  prefix: string;
  hours: boolean;
  values: { h: string; min: string; sec: string };
  onChange: (field: 'h' | 'min' | 'sec', v: string) => void;
}) {
  const field = (f: 'h' | 'min' | 'sec', unit: string, max: number): ReactElement => (
    <div>
      <span className="ob-unit">{unit}</span>
      <input
        type="number"
        id={`in-${prefix}${f === 'h' ? 'H' : f === 'min' ? 'Min' : 'Sec'}`}
        aria-label={unit === 'h' ? 'sati' : unit === 'min' ? 'minuti' : 'sekunde'}
        placeholder={unit}
        inputMode="numeric"
        value={values[f]}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onChange(f, clampDigits(e.target.value, max))
        }
      />
    </div>
  );
  return (
    <div className="ob-row3">
      {hours ? (
        <>
          {field('h', 'h', 1)}
          <div className="ob-colon">:</div>
        </>
      ) : null}
      {field('min', 'min', 2)}
      <div className="ob-colon">:</div>
      {field('sec', 'sek', 2)}
    </div>
  );
}
