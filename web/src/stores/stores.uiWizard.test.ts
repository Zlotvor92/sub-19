import { beforeEach, describe, expect, it } from 'vitest';
import { useUIStore } from './uiStore';

describe('čarobnjak i ekrani', () => {
  beforeEach(() => useUIStore.setState({ tab: 'plan', screens: [], sheet: null, wizard: false }));

  it('otvaranje čarobnjaka zatvara ekrane i list ispod (nema „starog“ ekrana posle plana)', () => {
    useUIStore.getState().openScreen({ kind: 'plan-prilagodi' });
    expect(useUIStore.getState().screens).toHaveLength(1);
    useUIStore.getState().setWizard(true);
    expect(useUIStore.getState()).toMatchObject({ wizard: true, screens: [], sheet: null });
  });

  it('zatvaranje čarobnjaka ne dira ostalo stanje', () => {
    useUIStore.getState().setWizard(true);
    useUIStore.getState().setWizard(false);
    expect(useUIStore.getState()).toMatchObject({ wizard: false, tab: 'plan' });
  });
});
