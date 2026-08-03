/* Test harness — učitava inline <script> iz index.html i izvršava ga u
   izolovanom vm kontekstu sa minimalnim lažnim DOM-om.

   ZAŠTO OVAKO, A NE MODULI: aplikacija je namerno JEDAN fajl bez build
   koraka (v. komentare u api/*.js — deploy ide preko GitHub web editora,
   bilo kakav bundler bi to pokvario). Umesto da se kod prekraja zbog
   testova, testovi se prilagođavaju kodu: skripta se izvuče i pokrene nad
   stubovima, pa su sve funkcije dostupne tačno onakve kakve su u produkciji.

   ŠTA JE STUBOVANO: document/localStorage/fetch/crypto/location/navigator/
   alert/confirm. Ništa od toga ne dodiruje mrežu ni disk.

   NEMA package.json U ROOTU namerno — Vercel bi ga protumačio kao Node
   projekat i promenio način build-a. Zato .mjs ekstenzije (uvek ESM) i
   package.json samo unutar test/. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..');

export function readRepoFile(name) {
  return readFileSync(join(ROOT, name), 'utf8');
}

/* Jedan lažni element koji odgovara na sve što aplikacija traži od DOM-a.
   Namerno permisivan: cilj nije verno simulirati pregledač, nego pustiti
   skriptu da se izvrši do kraja da bi čiste funkcije bile dostupne. */
function makeEl(tag = 'div') {
  const el = {
    tagName: String(tag).toUpperCase(),
    style: {},
    dataset: {},
    children: [],
    _html: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    scrollTop: 0,
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, on) { on === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (on ? this._s.add(c) : this._s.delete(c)); },
      contains(c) { return this._s.has(c); }
    },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { return c; },
    remove() {},
    querySelector() { return makeEl(); },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    getAttribute() { return null; },
    closest() { return makeEl(); },
    select() {},
    focus() {},
    click() {}
  };
  return el;
}

function makeLocalStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: k => { m.delete(String(k)); },
    clear: () => m.clear(),
    _map: m
  };
}

/* Izvlači sadržaj poslednjeg <script> bloka (aplikacija ima tačno jedan). */
export function extractAppScript(html) {
  const start = html.indexOf('<script>');
  const end = html.lastIndexOf('</script>');
  if (start < 0 || end < 0) throw new Error('Nije pronađen <script> blok u index.html');
  return html.slice(start + '<script>'.length, end);
}

/* Pokreće aplikaciju i vraća { ctx, get(name), call(name, ...args), ls, calls }.
   `get` je potreban jer top-level const/let u vm Script-u NE postaju svojstva
   globalnog objekta (leksičko okruženje), dok function deklaracije postaju. */
export function loadApp(opts = {}) {
  const html = readRepoFile('index.html');
  const code = extractAppScript(html);

  const ls = makeLocalStorage();
  if (opts.seedLocalStorage) {
    for (const [k, v] of Object.entries(opts.seedLocalStorage)) ls.setItem(k, v);
  }

  const calls = { alerts: [], confirms: [], fetches: [] };

  /* Lažni sat: `opts.now` postavlja početno vreme, `clock.set(iso)` ga pomera.
     Potrebno je da bi prelazak preko ponoći uopšte mogao da se testira. */
  const clock = { t: opts.now != null ? new Date(opts.now).getTime() : null };
  clock.set = iso => { clock.t = new Date(iso).getTime(); };
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0 && clock.t != null) super(clock.t); else super(...a); }
    static now() { return clock.t != null ? clock.t : RealDate.now(); }
  }

  const doc = {
    documentElement: makeEl('html'),
    body: makeEl('body'),
    head: makeEl('head'),
    visibilityState: 'visible',
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: t => makeEl(t),
    addEventListener: () => {},
    removeEventListener: () => {},
    execCommand: () => true
  };

  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Date: FakeDate, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
    Map, Set, Promise, isNaN, isFinite, parseInt, parseFloat, encodeURIComponent,
    decodeURIComponent, escape, unescape, atob, btoa, URL, URLSearchParams,
    Uint8Array, Buffer, TextEncoder, TextDecoder, structuredClone,

    document: doc,
    localStorage: ls,
    location: { origin: 'https://example.test', href: 'https://example.test/', pathname: '/', search: '', hash: '', protocol: 'https:', hostname: 'example.test' },
    history: { replaceState: () => {} },
    navigator: { onLine: false, userAgent: 'test', clipboard: { writeText: async () => {} } },
    crypto: { getRandomValues: a => { for (let i = 0; i < a.length; i++) a[i] = (i * 37 + 11) % 256; return a; } },
    alert: m => { calls.alerts.push(String(m)); },
    confirm: m => { calls.confirms.push(String(m)); return opts.confirmReturns !== undefined ? opts.confirmReturns : false; },
    fetch: async (...a) => { calls.fetches.push(a); throw new Error('offline (test)'); },
    Blob: class { constructor(p) { this.parts = p; } },
    FileReader: class { readAsText() {} },
    requestAnimationFrame: cb => setTimeout(cb, 0),
    scrollTo: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    module: undefined
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  const ctx = vm.createContext(sandbox);
  vm.runInContext(code, ctx, { filename: 'index.html:script' });

  return {
    ctx,
    ls,
    calls,
    clock,
    /* čita ime iz konteksta — radi i za const/let i za function */
    get: name => vm.runInContext(name, ctx),
    /* izvršava proizvoljan izraz u kontekstu aplikacije */
    evalIn: expr => vm.runInContext(expr, ctx),
    call: (name, ...args) => {
      ctx.__args = args;
      return vm.runInContext(`${name}(...__args)`, ctx);
    }
  };
}

/* Približno poređenje za brojeve sa pomičnim zarezom. */
export function close(a, b, tol = 1e-6) {
  return Math.abs(a - b) <= tol;
}
