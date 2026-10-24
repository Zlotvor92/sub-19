import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkoutWhy } from './WorkoutParts';
import type { SessionView } from './sessionModel';

describe('WorkoutWhy', () => {
  it('fokus nedelje koji već završava tačkom ne dobija drugu tačku', () => {
    render(<WorkoutWhy view={{} as SessionView} phase="RAZVOJ" weekFocus="Prag i dugi." />);
    const line = screen.getByText(/Fokus nedelje/);
    expect(line.textContent).toContain('Fokus nedelje: Prag i dugi.');
    expect(line.textContent).not.toContain('..');
  });
});
