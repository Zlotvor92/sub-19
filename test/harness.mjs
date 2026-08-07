/* Test harness — učitava app.js i izvršava ga u izolovanom vm kontekstu sa
   minimalnim lažnim DOM-om.

   ZAŠTO OVAKO, A NE MODULI: aplikacija je namerno bez build koraka
   (v. komentare u api/*.js — deploy ide preko GitHub web editora, bilo kakav
   bundler bi to pokvario). app.js je OBIČNA skripta, ne ES modul: sve što je
   u njoj deklarisano je globalno, tačno kao dok je stajala inline u
   index.html. Umesto da se kod prekraja zbog testova, testovi se prilagođavaju
   kodu: skripta se pokrene nad stubovima, pa su sve funkcije dostupne tačno
   onakve kakve su u produkciji.

   ŠTA JE STUBOVANO: document/localStorage/fetch/crypto/location/navigator/
   alert/confirm. Ništa od toga ne dodiruje mrežu ni disk.

   NEMA package.json U ROOTU namerno — Vercel bi ga protumačio kao Node
   projekat i promenio način build-a. Zato .mjs ekstenzije (uvek ESM) i
   package.json samo unutar test/. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { webcrypto as nodeCrypto } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..');

export function readRepoFile(name) {
  return readFileSync(join(ROOT, name), 'utf8');
}

/* Jedan lažni element koji odgovara na sve što aplikacija traži od DOM-a.
   Namerno permisivan: cilj nije verno simulirati pregledač, nego pustiti
   skriptu da se izvrši do kraja da bi čiste funkcije bile dostupne. */
function makeEl(tag = 'div') {
  /* Elementi se PAMTE po selektoru. Bez toga svaki querySelector vraca nov
     objekat, pa `render*()` upise HTML u jedan a test cita iz drugog — dobije
     prazan string i tvrdnja prodje IAKO NISTA NIJE PROVERENO. Tako je nekoliko
     bezbednosnih testova bilo prazan hod. */
  const kes = new Map();
  const nadji = sel => { const k=String(sel); if(!kes.has(k)) kes.set(k, makeEl()); return kes.get(k); };
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
    /* Uklanjanje se PAMTI. Dok je bilo prazno telo, test nije imao nikakav
       način da razlikuje „element je sklonjen sa ekrana" od „ništa se nije
       desilo" — a tačno to je jedina vidljiva posledica npr. uvodnog ekrana
       na toplom startu. */
    remove() { this._removed = true; },
    _removed: false,
    querySelector(sel) { return nadji(sel); },
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

/* Od v150 kod aplikacije više NIJE u index.html — izdvojen je u app.js da bi
   CSP mogao da ispusti `script-src 'unsafe-inline'`. index.html je od tada
   samo markup + <script src="./app.js">. */
export function readAppSource() {
  return readRepoFile('app.js');
}

/* Sve što se isporučuje pregledaču, kao jedan tekst. Provere nad izvorom
   (nema tajni u klijentu, nema mejl adrese, redosled poziva pri pokretanju…)
   ne smeju da zavise od toga u kom se od ta dva fajla nešto zateklo. */
export function readClientSource() {
  return readRepoFile('index.html') + '\n' + readAppSource();
}

/* Pokreće aplikaciju i vraća { ctx, get(name), call(name, ...args), ls, calls }.
   `get` je potreban jer top-level const/let u vm Script-u NE postaju svojstva
   globalnog objekta (leksičko okruženje), dok function deklaracije postaju. */
export function loadApp(opts = {}) {
  const code = readAppSource();

  const ls = makeLocalStorage();
  if (opts.seedLocalStorage) {
    for (const [k, v] of Object.entries(opts.seedLocalStorage)) ls.setItem(k, v);
  }

  /* sessionStorage je ODVOJENO skladište, ne alias localStorage-a: aplikacija
     preko njega razlikuje hladan start (prazno) od osvežavanja strane (već
     upisano). Da nije stubovan, poziv bi bacio ReferenceError — koji jeste
     uhvaćen u kodu, ali bi test onda merio grešku umesto ponašanja. */
  const ss = makeLocalStorage();
  if (opts.seedSessionStorage) {
    for (const [k, v] of Object.entries(opts.seedSessionStorage)) ss.setItem(k, v);
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

  /* Isto pamcenje i na nivou dokumenta — `$('#pg-danas')` mora da vrati ISTI
     element pri svakom pozivu, inace se ne moze procitati ono sto je render
     upisao. `getElementById` deli isti kes, jer aplikacija koristi oba puta
     za iste elemente (npr. #sb-gate, #update-banner). */
  const docSlusaoci = {};
  const kesDoc = new Map();
  const nadjiDoc = sel => { const k=String(sel); if(!kesDoc.has(k)) kesDoc.set(k, makeEl()); return kesDoc.get(k); };
  const doc = {
    documentElement: makeEl('html'),
    body: makeEl('body'),
    head: makeEl('head'),
    visibilityState: 'visible',
    querySelector: sel => nadjiDoc(sel),
    querySelectorAll: () => [],
    /* getElementById dobija '#' prefiks da deli kes sa querySelector-om */
    getElementById: id => nadjiDoc('#' + id),
    createElement: t => makeEl(t),
    /* Slusaoci se PAMTE, ne bacaju. Bez ovoga se nije moglo testirati nista
       sto se desava pri povratku u aplikaciju — a instalirana PWA vecinu
       svog zivota provede upravo u tom prelazu iz pozadine. Prvi put je
       zatrebalo za proveru da obrisan nalog biva izbacen ODMAH: funkcija
       koja to radi bila je pokrivena testovima, ali se njeno POZIVANJE nije
       moglo proveriti, pa je uklanjanje poziva prolazilo neprimeceno. */
    addEventListener: (tip, fn) => { (docSlusaoci[tip] || (docSlusaoci[tip] = [])).push(fn); },
    removeEventListener: (tip, fn) => {
      const n = docSlusaoci[tip]; if (!n) return;
      const i = n.indexOf(fn); if (i >= 0) n.splice(i, 1);
    },
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
    sessionStorage: ss,
    /* `opts.search` postavlja upitni deo adrese (npr. '?tab=plan'), da bi se
       ulaz sa strane — precice sa ikonice, OAuth povratak — mogao testirati. */
    location: { origin: 'https://example.test', href: 'https://example.test/' + (opts.search || ''),
                pathname: '/', search: opts.search || '', hash: '', protocol: 'https:', hostname: 'example.test' },
    history: { replaceState: () => {} },
    /* `onLine` je podrazumevano false — vecina testova ne zeli mrezu, a i
       stub `fetch` je odbija. `opts.online: true` je za testove pokretanja
       koji moraju da prodju kroz provere uslovljene vezom. Podrazumevana
       vrednost se NE menja: postoje testovi koji se oslanjaju na offline. */
    navigator: { onLine: !!opts.online, userAgent: 'test', clipboard: { writeText: async () => {} } },
    /* Pravi nasumicne bajtove, ne deterministicki niz — inace bi dva
       uzastopna `secureRandomToken()` dala ISTU vrednost, pa bi testovi koji
       proveravaju nasumicnost OAuth state-a bili besmisleni. */
    crypto: { getRandomValues: a => nodeCrypto.getRandomValues(a) },
    alert: m => { calls.alerts.push(String(m)); },
    confirm: m => { calls.confirms.push(String(m)); return opts.confirmReturns !== undefined ? opts.confirmReturns : false; },
    /* `opts.fetch` zamenjuje mrezni sloj JOS PRE nego sto se kod aplikacije
       izvrsi. `setFetch` to ne moze — on radi tek posle `loadApp`, dakle posle
       celog pokretanja. Zatrebalo je da bi se testirao HLADAN START sa vec
       postojecom sesijom: aplikacija tada pita server da li nalog jos postoji,
       i taj odgovor je morao da postoji pre prve linije. */
    fetch: opts.fetch
      ? async (...a) => { calls.fetches.push(a); return opts.fetch(...a); }
      : async (...a) => { calls.fetches.push(a); throw new Error('offline (test)'); },
    Blob: class { constructor(p) { this.parts = p; } },
    FileReader: class { readAsText() {} },
    requestAnimationFrame: cb => setTimeout(cb, 0),
    scrollTo: () => {},
    /* `opts.reducedMotion` uključuje sistemsko „smanji kretanje". Odgovor se
       vezuje za sam upit, a ne vraća se pravo `true` na sve — inače bi svaki
       budući `matchMedia` u kodu dobio potvrdan odgovor. */
    matchMedia: q => ({
      matches: !!opts.reducedMotion && /reduced-motion/.test(String(q)),
      addEventListener: () => {}, removeEventListener: () => {}
    }),
    module: undefined
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  const ctx = vm.createContext(sandbox);
  vm.runInContext(code, ctx, { filename: 'app.js' });

  return {
    ctx,
    ls,
    ss,
    calls,
    clock,
    /* Zamena mrežnog sloja. Podrazumevani stub svaki poziv odbija sa
       „offline (test)", što je tačno za većinu testova — ali sinhronizacija sa
       Supabase-om se bez odgovora ne može testirati uopšte, pa je ta putanja
       do sada bila neproverena. Vraćena vrednost mora ličiti na `Response`
       onoliko koliko je pozivaocu potrebno ({ok, status, json, text}). */
    setFetch: fn => { ctx.fetch = async (...a) => { calls.fetches.push(a); return fn(...a); }; },
    /* Odglumi dogadjaj na dokumentu — pre svega `visibilitychange`, kojim se
       simulira povratak u aplikaciju iz pozadine. Vraca broj pozvanih
       slusalaca, pa test moze da tvrdi da je aplikacija uopste zakacena. */
    okini: (tip, ev) => {
      const n = docSlusaoci[tip] || [];
      for (const fn of n) fn(ev || { type: tip });
      return n.length;
    },
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
