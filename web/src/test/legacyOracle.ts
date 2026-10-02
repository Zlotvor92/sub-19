/* ZAMRZNUT ODGOVOR STAROG FRONTENDA (APP_VERSION 282, commit b7afc41).

   Dok je stari `app.js` postojao, oracle testovi su ga pozivali (node:vm) i poredili sa novim kodom. Svaki poziv je tada snimljen u
   `legacy-recordings/<testfajl>.json.gz`: [metoda, SHA argumenata, rezultat], po testu, redom. Sada stari kod ne postoji (Phase 12) i isti pozivi
   dobijaju zapisane rezultate. Test se ne razlikuje od pravog poređenja sa starim kodom — osim što ulaz mora biti ISTI kao pri snimanju: SHA argumenata
   se proverava pri svakom pozivu, pa test koji bi slao drugačije ulaze (ili drugačijim redosledom) pada sa jasnom porukom umesto da tiho poredi sa
   pogrešnim odgovorom.

   Posledica: snimci se NE mogu ponovo uzeti iz ovog repozitorijuma. Novi oracle test = ponovo uzmi snimak nad commit-om b7afc41
   (`git worktree add ../legacy b7afc41`), v. docs/REWRITE_STATUS.md „Zamrznuti oracle testovi". */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { expect } from 'vitest';

export interface LegacyApp {
  call(fn: string, ...args: unknown[]): unknown;
  get(name: string): unknown;
  evalIn(expr: string): unknown;
}

/** `async` = stari kod je vratio Promise; rezultat je ono na šta se razrešio (vraća se razrešen Promise). */
type Entry = [method: string, argsSha: string, result: unknown, async?: 1];

/* ---- JSON koji čuva ono što običan JSON gubi (undefined, NaN, ±Infinity, -0, Date) ---- */
export function encode(v: unknown): unknown {
  if (v === undefined) return { $: 'u' };
  if (typeof v === 'number') {
    if (Number.isNaN(v)) return { $: 'nan' };
    if (v === Infinity) return { $: 'inf' };
    if (v === -Infinity) return { $: '-inf' };
    if (Object.is(v, -0)) return { $: '-0' };
    return v;
  }
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'function') throw new Error('legacy recorder: funkcija se ne može snimiti');
  const tag = Object.prototype.toString.call(v);
  if (tag === '[object Date]') return { $: 'date', v: (v as Date).toISOString() };
  if (tag === '[object Array]') return (v as unknown[]).map(encode);
  if (tag === '[object Map]') return { $: 'map', v: [...(v as Map<unknown, unknown>)].map(encode) };
  if (tag === '[object Set]') return { $: 'set', v: [...(v as Set<unknown>)].map(encode) };
  const o: Record<string, unknown> = {};
  for (const k of Object.keys(v))
    o[k === '$' ? '$$' : k] = encode((v as Record<string, unknown>)[k]);
  return o;
}
export function decode(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(decode);
  const o = v as Record<string, unknown>;
  const t = o['$'];
  if (typeof t === 'string') {
    switch (t) {
      case 'u':
        return undefined;
      case 'nan':
        return Number.NaN;
      case 'inf':
        return Infinity;
      case '-inf':
        return -Infinity;
      case '-0':
        return -0;
      case 'date':
        return new Date(o['v'] as string);
      case 'map':
        return new Map(decode(o['v']) as Array<[unknown, unknown]>);
      case 'set':
        return new Set(decode(o['v']) as unknown[]);
    }
  }
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o)) out[k === '$$' ? '$' : k] = decode(o[k]);
  return out;
}
const sha = (x: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(encode(x)))
    .digest('hex')
    .slice(0, 12);

/* ---- stanje po testnom fajlu ---- */
const DIR = resolve(process.cwd(), 'src/test/legacy-recordings');

interface FileState {
  recorded: Record<string, Entry[]>;
  cursor: Map<string, number>;
}
const files = new Map<string, FileState>();

function state(): FileState {
  const file = expect.getState().testPath ?? '';
  const rel = file.slice(process.cwd().length + 1).replace(/[\\/]/g, '__');
  const p = resolve(DIR, rel.replace(/\.ts$/, '') + '.json.gz');
  let st = files.get(p);
  if (!st) {
    if (!existsSync(p)) throw new Error(`legacy (zamrznut): nema snimka ${p}`);
    st = {
      recorded: JSON.parse(gunzipSync(readFileSync(p)).toString('utf8')) as Record<string, Entry[]>,
      cursor: new Map()
    };
    files.set(p, st);
  }
  return st;
}
const testKey = (): string => expect.getState().currentTestName ?? '__file__';

function next(method: string, args: unknown[]): unknown {
  const st = state();
  const key = testKey();
  const argsSha = sha(args);
  const i = st.cursor.get(key) ?? 0;
  st.cursor.set(key, i + 1);
  const e = st.recorded[key]?.[i];
  if (!e)
    throw new Error(
      `legacy (zamrznut): test „${key}" traži poziv #${i} (${method}) kojeg nema u snimku — snimak ne odgovara testu`
    );
  if (e[0] !== method || e[1] !== argsSha)
    throw new Error(
      `legacy (zamrznut): test „${key}", poziv #${i}: snimljeno ${e[0]}(${e[1]}), traženo ${method}(${argsSha}) — ulaz testa se razlikuje od snimljenog`
    );
  return e[3] ? Promise.resolve(decode(e[2])) : decode(e[2]);
}

/** Zamrznuta „stara aplikacija" (rezultati poziva iz snimka). */
export function loadLegacyApp(_now = '2026-01-05T09:00:00Z'): Promise<LegacyApp> {
  void _now;
  return Promise.resolve({
    call: (fn, ...args) => next('call', [fn, ...args]),
    get: (name) => next('get', [name]),
    evalIn: (expr) => next('evalIn', [expr]),
    /* `ctx` je globalni objekat vm konteksta: test u njega upisuje ulaze za stari kod (i ponekad ih čita nazad) — običan objekat je dovoljan. */
    ctx: {}
  } as LegacyApp);
}
