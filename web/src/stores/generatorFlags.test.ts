import { afterEach, describe, expect, it, vi } from 'vitest';

/** Sveži moduli posle promene okruženja: prekidači i skladište iz istog grafa modula. */
const load = async () => {
  vi.resetModules();
  const { useSettingsStore } = await import('./settingsStore');
  return { ...(await import('./generatorFlags')), useSettingsStore };
};

describe('generatorFlags: uključenje za sve korisnike (VITE_V2_DEFAULT_ON)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('bez promenljive: nesačuvano podešavanje = isključeno (staro podrazumevano)', async () => {
    vi.stubEnv('VITE_V2_DEFAULT_ON', '');
    const { currentGeneratorFlags } = await load();
    expect(currentGeneratorFlags()).toEqual({
      fiveKV2: false,
      tenKV2: false,
      hmV2: false,
      marathonV2: false
    });
  });

  it('VITE_V2_DEFAULT_ON=1: nesačuvano podešavanje = uključeno za sve 4 distance', async () => {
    vi.stubEnv('VITE_V2_DEFAULT_ON', '1');
    const { currentGeneratorFlags } = await load();
    expect(currentGeneratorFlags()).toEqual({
      fiveKV2: true,
      tenKV2: true,
      hmV2: true,
      marathonV2: true
    });
  });

  it('VITE_V2_DEFAULT_ON=1: sačuvano false (administrator) i dalje isključuje', async () => {
    vi.stubEnv('VITE_V2_DEFAULT_ON', '1');
    const { currentGeneratorFlags, useSettingsStore } = await load();
    useSettingsStore.getState().patchUi({ generatorV2Marathon: false });
    expect(currentGeneratorFlags()).toEqual({
      fiveKV2: true,
      tenKV2: true,
      hmV2: true,
      marathonV2: false
    });
  });
});
