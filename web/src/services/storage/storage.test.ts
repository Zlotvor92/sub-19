import { describe, expect, it, vi } from 'vitest';
import { seedState } from '../../domain/state';
import { LS_KEY, LS_RESCUE_KEY } from './keys';
import { createKeyValueStore, type StorageLike } from './kv';
import { createStateSaver, loadState } from './stateStorage';

/* parity: test/otpornost.test.mjs („oštećeno stanje", „kvota"), test/state.test.mjs (loadState). */

class FakeStorage implements StorageLike {
  data = new Map<string, string>();
  failWrites = false;
  failProbe = false;
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.failProbe && k === '__t') throw new Error('probe');
    if (this.failWrites && k !== '__t') throw new DOMException('quota', 'QuotaExceededError');
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

describe('skladište sa rezervom', () => {
  it('upis i čitanje; trajno skladište je upotrebljivo', () => {
    const kv = createKeyValueStore(new FakeStorage());
    expect(kv.persistent).toBe(true);
    expect(kv.set('a', '1')).toBe(true);
    expect(kv.get('a')).toBe('1');
    kv.remove('a');
    expect(kv.get('a')).toBeNull();
  });
  it('bez skladišta ili kad probni upis baci: radi iz memorije, `persistent` je false', () => {
    const none = createKeyValueStore(undefined);
    expect(none.persistent).toBe(false);
    none.set('a', '1');
    expect(none.get('a')).toBe('1');
    const bad = new FakeStorage();
    bad.failProbe = true;
    expect(createKeyValueStore(bad).persistent).toBe(false);
  });
  it('kad pravi upis padne (kvota), vrednost ostaje u memoriji i vraća se `false`', () => {
    const st = new FakeStorage();
    const kv = createKeyValueStore(st);
    st.failWrites = true;
    expect(kv.set('a', 'veliko')).toBe(false);
    expect(kv.get('a')).toBe('veliko');
  });
});

describe('učitavanje stanja', () => {
  it('bez zapisa: prazno stanje sa datumom prvog pokretanja', () => {
    const r = loadState(createKeyValueStore(new FakeStorage()), '2026-07-12');
    expect(r.loadFailure).toBeNull();
    expect(r.state.ui.firstRun).toBe('2026-07-12');
  });
  it('ispravan zapis se migrira i učitava', () => {
    const st = new FakeStorage();
    const seed = seedState();
    st.setItem(LS_KEY, JSON.stringify({ ...seed, log: { g1d1: { status: 'done', km: 5 } } }));
    const r = loadState(createKeyValueStore(st), '2026-07-12');
    expect(r.loadFailure).toBeNull();
    expect(r.state.log['g1d1']).toMatchObject({ status: 'done' });
  });
  it('OŠTEĆEN zapis: ništa se ne briše, sirov tekst se spasava, a učitavanje se prijavljuje (sync ne sme da piše prazno)', () => {
    const st = new FakeStorage();
    st.setItem(LS_KEY, '{"v":11,"log":{');
    const r = loadState(createKeyValueStore(st), '2026-07-12');
    expect(r.loadFailure).not.toBeNull();
    expect(r.loadFailure?.bytes).toBe('{"v":11,"log":{'.length);
    expect(st.getItem(LS_RESCUE_KEY)).toBe('{"v":11,"log":{');
    expect(st.getItem(LS_KEY)).toBe('{"v":11,"log":{'); // glavni zapis nije dirnut
  });
  it('stanje iz NOVIJE šeme se tretira kao nečitljivo (ne spušta se tiho)', () => {
    const st = new FakeStorage();
    st.setItem(LS_KEY, JSON.stringify({ v: 99, log: {} }));
    const r = loadState(createKeyValueStore(st), '2026-07-12');
    expect(r.loadFailure?.reason).toContain('migrate');
    expect(st.getItem(LS_RESCUE_KEY)).not.toBeNull();
  });
});

describe('čuvanje stanja', () => {
  const state = seedState();
  const setup = (st = new FakeStorage()) => {
    let id = 0;
    const timers = new Map<number, () => void>();
    const onWriteFailed = vi.fn();
    const onSaved = vi.fn();
    const saver = createStateSaver({
      kv: createKeyValueStore(st),
      onWriteFailed,
      onSaved,
      setTimer: (fn) => {
        timers.set(++id, fn);
        return id;
      },
      clearTimer: (i) => timers.delete(i as number)
    });
    const fire = (): void => {
      for (const [k, fn] of [...timers]) {
        timers.delete(k);
        fn();
      }
    };
    return { st, saver, timers, fire, onWriteFailed, onSaved };
  };

  it('puni upis je odmah i javlja okidač slanja', () => {
    const { st, saver, onSaved } = setup();
    saver.save(state);
    expect(JSON.parse(st.getItem(LS_KEY) as string)).toMatchObject({ v: 11 });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
  it('odloženi upis se spaja: hiljadu slova = jedan upis, i rok se ne pomera unedogled', () => {
    const { saver, timers, fire, onSaved } = setup();
    for (let i = 0; i < 1000; i++) saver.saveSoon(() => state);
    expect(timers.size).toBe(1);
    expect(onSaved).not.toHaveBeenCalled();
    fire();
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(saver.pending).toBe(false);
  });
  it('flush (blur / odlazak u pozadinu) upisuje zakazano odmah; bez zakazanog je bez dejstva', () => {
    const { saver, onSaved } = setup();
    saver.flush(() => state);
    expect(onSaved).not.toHaveBeenCalled();
    saver.saveSoon(() => state);
    saver.flush(() => state);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(saver.pending).toBe(false);
  });
  it('puni upis poništava zakazani (ništa se ne upisuje dvaput)', () => {
    const { saver, timers, onSaved } = setup();
    saver.saveSoon(() => state);
    saver.save(state);
    expect(timers.size).toBe(0);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
  it('kvota puna: prijava SAMO JEDNOM po nizu neuspeha, rad se nastavlja iz memorije; uspeh vraća prijavljivanje', () => {
    const { st, saver, onWriteFailed } = setup();
    st.failWrites = true;
    saver.save(state);
    saver.save(state);
    saver.save(state);
    expect(onWriteFailed).toHaveBeenCalledTimes(1);
    st.failWrites = false;
    saver.save(state);
    st.failWrites = true;
    saver.save(state);
    expect(onWriteFailed).toHaveBeenCalledTimes(2);
  });
  it('bez trajnog skladišta nema lažne poruke o kvoti', () => {
    const onWriteFailed = vi.fn();
    const saver = createStateSaver({ kv: createKeyValueStore(undefined), onWriteFailed });
    saver.save(state);
    expect(onWriteFailed).not.toHaveBeenCalled();
  });
});
