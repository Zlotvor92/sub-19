#!/usr/bin/env node
/* SABOTAŽE: dokaz da testovi hvataju namerno unetu grešku u produkcionom kodu (uputstvo: docs/testing/SABOTAGE.md).
   Za svaku sabotažu iz JSON fajla: primeni find/replace (find TAČNO jednom), pokreni zadate test fajlove (brz nivo,
   `--bail=1`), UVEK vrati original i proveri da je stanje `src` (necommitovane izmene + neverzionisani fajlovi)
   bajt-isto kao pre. Sabotaža koju nijedan test ne obori = neuspeh (exit ≠ 0). Čist Node ≥ 22, bez zavisnosti. */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const WEB = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CACHE = join(WEB, 'node_modules', '.cache', 'sabotage');
const LOCK = join(CACHE, 'lock.json');

const HELP = `Upotreba (iz web/): node scripts/sabotage.mjs <sabotaže.json> [opcije] [-- <dodatni argumenti za vitest>]

Za svaku sabotažu: primeni izmenu, pokreni njene testove (BRZ nivo, --bail=1), vrati original, proveri heš stanja src.

Opcije:
  --only <ime|indeks>  samo jedna sabotaža (indeks od 1, tačno ime ili jedinstven početak imena; može više puta)
  --full               PUN nivo (TEST_FULL=1); podrazumevano BRZ (TEST_FULL se uklanja iz okruženja)
  --all-failures       bez --bail: pun spisak palih testova (sporije; samo kad se izričito traži)
  --parallel <N>       N sabotaža istovremeno, svaka u privremenom git worktree-ju (glavni direktorijum se ne dira);
                       podrazumevano 1 (redom, u ovom direktorijumu)
  --json <fajl>        upiši rezultat kao JSON
  --quiet, -q          ne prikazuj izlaz vitest-a (samo rezultat); uz --parallel uvek
  --dry-run            samo proveri ulaz (find tačno jednom, fajlovi postoje), bez testova i bez izmena
  --restore            posle pada procesa (SIGKILL, nestanak struje): vrati fajlove iz rezervne kopije
                       (node_modules/.cache/sabotage/) i obriši zaostale worktree-je
  --help, -h           ova poruka

Ulaz: JSON niz; jedna sabotaža je
  { "name": "...", "file": "src/...", "find": "...", "replace": "...", "tests": ["src/....node.test.ts"] }
ili sa više izmena
  { "name": "...", "edits": [{ "file": "...", "find": "...", "replace": "..." }], "tests": [...] }
Putanje su relativne na web/. Primer: ../docs/testing/sabotage-06c.json.

Izlaz: 0 = svaka sabotaža oborila bar jedan test i stanje je vraćeno; 1 = bar jedna NIJE PALA ili greška
(ulaz, vitest); 2 = pogrešna upotreba / drugo pokretanje u toku / zaostala rezervna kopija; 3 = stanje src posle
vraćanja NIJE isto kao pre (najteže — proveri git status).`;

/* ---------- pomoćno ---------- */

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const short = (hash) => hash.slice(0, 16);
const seconds = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
const plural = (n, one, few, many) =>
  `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many}`;

class UsageError extends Error {}

/** Sinhroni `git` u `cwd`; baca grešku sa stderr-om. Vraća Buffer. */
function git(cwd, args, input) {
  const r = spawnSync('git', ['-c', 'core.quotepath=off', ...args], {
    cwd,
    input,
    maxBuffer: 1 << 30
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} (u ${cwd}): ${r.stderr.toString().trim() || `kod ${r.status}`}`
    );
  }
  return r.stdout;
}

/** Bajtovi datoteke ili, za simbolički link, njegov cilj (link se ne prati). */
function fileBytes(path) {
  return lstatSync(path).isSymbolicLink()
    ? Buffer.from(`link:${readlinkSync(path)}`)
    : readFileSync(path);
}

const DIFF = ['diff', '--no-color', '--no-ext-diff', '--no-textconv', '--binary'];

/**
 * Stanje putanja `paths` (relativne na `webDir`): `git diff HEAD` (necommitovano: staged + radni direktorijum) +
 * spisak i sadržaj neverzionisanih fajlova. `files` (putanja → sha256) služi samo da se pri razlici kaže ŠTA je drugačije.
 */
function snapshot(webDir, paths) {
  const diff = git(webDir, [...DIFF, 'HEAD', '--', ...paths]);
  const changed = git(webDir, [
    'diff',
    '--name-only',
    '--no-renames',
    '-z',
    'HEAD',
    '--',
    ...paths
  ]);
  const others = git(webDir, ['ls-files', '--others', '--exclude-standard', '-z', '--', ...paths]);
  const split = (buf) => buf.toString('utf8').split('\0').filter(Boolean);
  const top = git(webDir, ['rev-parse', '--show-toplevel']).toString().trim();
  const untracked = split(others).sort();
  const h = createHash('sha256').update('diff\0').update(diff);
  const files = new Map();
  for (const f of untracked) {
    const bytes = fileBytes(join(webDir, f));
    h.update(`\0untracked\0${f}\0${bytes.length}\0`).update(bytes);
    files.set(f, sha256(bytes));
  }
  for (const f of split(changed)) {
    const abs = join(top, f);
    files.set(relative(webDir, abs), existsSync(abs) ? sha256(fileBytes(abs)) : '(obrisan)');
  }
  return { hash: h.digest('hex'), diffBytes: diff.length, untracked, files };
}

/** Putanje čiji se sadržaj razlikuje između dva snimka (za glasnu poruku). */
function snapshotDelta(a, b) {
  const keys = new Set([...a.files.keys(), ...b.files.keys()]);
  return [...keys].filter((k) => a.files.get(k) !== b.files.get(k)).sort();
}

/* ---------- ulaz ---------- */

function inside(webDir, rel) {
  if (typeof rel !== 'string' || rel === '' || isAbsolute(rel)) return false;
  const r = relative(webDir, resolve(webDir, rel));
  return r !== '' && !r.startsWith('..') && !isAbsolute(r);
}

/** Čita i proverava oblik ulaza. Greške oblika su greške upotrebe (ništa se ne pokreće). */
function loadSabotages(path) {
  let list;
  try {
    list = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new UsageError(`ne mogu da pročitam ${path}: ${e.message}`);
  }
  if (!Array.isArray(list) || list.length === 0) {
    throw new UsageError(`${path}: očekujem neprazan JSON niz sabotaža`);
  }
  const names = new Set();
  return list.map((s, i) => {
    const where = `${path} [${i + 1}]`;
    if (s === null || typeof s !== 'object')
      throw new UsageError(`${where}: sabotaža mora biti objekat`);
    if (typeof s.name !== 'string' || s.name.trim() === '')
      throw new UsageError(`${where}: nema "name"`);
    if (names.has(s.name)) throw new UsageError(`${where}: ime "${s.name}" se ponavlja`);
    names.add(s.name);
    const single = 'file' in s || 'find' in s || 'replace' in s;
    if (single && 'edits' in s)
      throw new UsageError(`${where}: ili file/find/replace ili edits, ne oba`);
    const edits = single ? [{ file: s.file, find: s.find, replace: s.replace }] : s.edits;
    if (!Array.isArray(edits) || edits.length === 0) {
      throw new UsageError(`${where}: nema izmena (file/find/replace ili neprazan "edits")`);
    }
    edits.forEach((e, j) => {
      const w = `${where} izmena ${j + 1}`;
      if (e === null || typeof e !== 'object') throw new UsageError(`${w}: mora biti objekat`);
      if (!inside(WEB, e.file))
        throw new UsageError(`${w}: "file" mora biti putanja relativna na web/`);
      if (typeof e.find !== 'string' || e.find === '')
        throw new UsageError(`${w}: "find" mora biti neprazan string`);
      if (typeof e.replace !== 'string') throw new UsageError(`${w}: "replace" mora biti string`);
    });
    if (!Array.isArray(s.tests) || s.tests.length === 0) {
      throw new UsageError(`${where}: "tests" mora biti neprazan niz test fajlova`);
    }
    for (const t of s.tests) {
      if (!inside(WEB, t))
        throw new UsageError(`${where}: test "${t}" mora biti putanja relativna na web/`);
    }
    const norm = (rel) => relative(WEB, resolve(WEB, rel)).split(sep).join('/');
    return {
      index: i + 1,
      name: s.name,
      edits: edits.map((e) => ({ file: norm(e.file), find: e.find, replace: e.replace })),
      tests: [...new Set(s.tests.map(norm))]
    };
  });
}

function select(all, only) {
  if (only.length === 0) return all;
  const picked = only.map((o) => {
    if (/^\d+$/.test(o)) {
      const s = all[Number(o) - 1];
      if (!s) throw new UsageError(`--only ${o}: nema sabotaže sa tim indeksom (1…${all.length})`);
      return s;
    }
    const exact = all.find((s) => s.name === o);
    if (exact) return exact;
    const prefix = all.filter((s) => s.name.startsWith(o));
    if (prefix.length === 1) return prefix[0];
    throw new UsageError(
      prefix.length === 0
        ? `--only ${o}: nema sabotaže sa tim imenom`
        : `--only ${o}: više sabotaža počinje tako (${prefix.map((s) => s.index).join(', ')})`
    );
  });
  return [...new Set(picked)].sort((a, b) => a.index - b.index);
}

/** Brojevi redova (od 1) svih pojavljivanja `find` u `text`, uključujući preklopljena. */
function occurrences(text, find) {
  const lines = [];
  for (let i = text.indexOf(find); i !== -1; i = text.indexOf(find, i + 1)) {
    lines.push(text.slice(0, i).split('\n').length);
  }
  return lines;
}

/**
 * Izračuna sabotirani sadržaj svakog fajla u `webDir` (ništa ne piše). Izmene se primenjuju redom; `find` se broji u
 * trenutnom sadržaju fajla (posle prethodnih izmena istog fajla). Baca Error ako izmena nije primenljiva.
 */
function prepare(webDir, sab, full) {
  const files = new Map();
  for (const [j, e] of sab.edits.entries()) {
    const abs = join(webDir, e.file);
    if (!files.has(abs)) {
      if (!existsSync(abs) || !lstatSync(abs).isFile())
        throw new Error(`izmena ${j + 1}: ${e.file} ne postoji`);
      const orig = readFileSync(abs);
      const text = orig.toString('utf8');
      if (!Buffer.from(text, 'utf8').equals(orig)) throw new Error(`${e.file} nije ispravan UTF-8`);
      files.set(abs, { rel: e.file, orig, text });
    }
    const f = files.get(abs);
    const at = occurrences(f.text, e.find);
    if (at.length !== 1) {
      throw new Error(
        `izmena ${j + 1}: "find" se u ${e.file} pojavljuje ${at.length}× (mora tačno 1×)` +
          (at.length > 1
            ? `, redovi ${at.slice(0, 12).join(', ')}${at.length > 12 ? ', …' : ''}`
            : '')
      );
    }
    const i = f.text.indexOf(e.find);
    f.text = f.text.slice(0, i) + e.replace + f.text.slice(i + e.find.length);
  }
  for (const f of files.values()) {
    f.sabotaged = Buffer.from(f.text, 'utf8');
    if (f.sabotaged.equals(f.orig)) throw new Error(`izmene ne menjaju ${f.rel} (find = replace)`);
  }
  for (const t of sab.tests) {
    const abs = join(webDir, t);
    if (!existsSync(abs) || !lstatSync(abs).isFile())
      throw new Error(`test ${t} ne postoji (ili nije fajl)`);
    if (!full && /\.full\.node\.test\.ts$/.test(t)) {
      throw new Error(`test ${t} postoji samo u punom nivou (pokreni sa --full)`);
    }
  }
  return [...files.entries()].map(([abs, f]) => ({
    abs,
    rel: f.rel,
    orig: f.orig,
    sabotaged: f.sabotaged
  }));
}

/* ---------- vraćanje (i pri padu) ---------- */

const active = new Set(); // { restore(): void } — primenjene sabotaže koje još nisu vraćene
const children = new Set();
const worktrees = new Set(); // { root, web, tmp }
const tempDirs = new Set(); // izlazni direktorijumi JSON izveštaja vitest-a
let lockHeld = false;
let lockState = null;

function writeLock() {
  writeFileSync(LOCK, JSON.stringify(lockState, null, 1));
}

/** Zaključava `web/` (jedno pokretanje u isto vreme) i otkriva zaostalu rezervnu kopiju posle pada. */
function acquireLock(stateHash, input) {
  mkdirSync(CACHE, { recursive: true });
  if (existsSync(LOCK)) {
    const old = readLockFile();
    if (old && pidAlive(old.pid)) {
      throw new UsageError(
        `drugo pokretanje (pid ${old.pid}, ${old.startedAt}) je u toku u ovom direktorijumu`
      );
    }
    throw new UsageError(
      `zaostala rezervna kopija prethodnog pokretanja (pid ${old?.pid ?? '?'}) koje nije završeno — ` +
        'pokreni `node scripts/sabotage.mjs --restore`'
    );
  }
  lockState = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    input,
    stateHash,
    pending: [],
    worktrees: []
  };
  try {
    writeFileSync(LOCK, JSON.stringify(lockState, null, 1), { flag: 'wx' });
  } catch (e) {
    if (e.code === 'EEXIST')
      throw new UsageError('drugo pokretanje je upravo počelo u ovom direktorijumu');
    throw e;
  }
  lockHeld = true;
}

function readLockFile() {
  try {
    return JSON.parse(readFileSync(LOCK, 'utf8'));
  } catch {
    return null;
  }
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

function releaseLock() {
  if (!lockHeld) return;
  rmSync(CACHE, { recursive: true, force: true });
  lockHeld = false;
}

/**
 * Primeni sabotažu. U glavnom direktorijumu (`backup`) original ide i u rezervnu kopiju na disku PRE izmene, da
 * `--restore` može da ga vrati ako proces padne. Vraća `{ restore() }` koji vraća original.
 */
function apply(files, backup) {
  if (backup) {
    files.forEach((f, i) => {
      const copy = join(CACHE, `orig-${i}`);
      writeFileSync(copy, f.orig);
      lockState.pending.push({
        file: f.abs,
        backup: copy,
        sabotaged: sha256(f.sabotaged),
        orig: sha256(f.orig)
      });
    });
    writeLock();
  }
  const entry = {
    restore() {
      for (const f of files) writeFileSync(f.abs, f.orig);
      active.delete(entry);
      if (backup) {
        lockState.pending = [];
        writeLock();
      }
    }
  };
  active.add(entry);
  try {
    for (const f of files) writeFileSync(f.abs, f.sabotaged);
  } catch (e) {
    entry.restore();
    throw e;
  }
  return entry;
}

function removeWorktree(wt, mainWeb) {
  /* Prvo node_modules (simlinkovi): rmSync ne prati linkove, ali ga brišemo sami da ni git ne ulazi u njih. */
  rmSync(join(wt.web, 'node_modules'), { recursive: true, force: true, maxRetries: 5 });
  const r = spawnSync('git', ['worktree', 'remove', '--force', wt.root], { cwd: mainWeb });
  rmSync(wt.tmp, { recursive: true, force: true, maxRetries: 5 });
  if (r.status !== 0) spawnSync('git', ['worktree', 'prune'], { cwd: mainWeb });
  worktrees.delete(wt);
}

/** Sinhrono vraćanje svega (finally, signal, izlaz). Idempotentno. */
function cleanupAll() {
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {
      /* već završen */
    }
  }
  let ok = true;
  for (const a of [...active]) {
    try {
      a.restore();
    } catch (e) {
      ok = false;
      console.error(`GREŠKA pri vraćanju: ${e.message}`);
    }
  }
  for (const wt of [...worktrees]) {
    try {
      removeWorktree(wt, WEB);
    } catch (e) {
      console.error(`GREŠKA pri brisanju worktree-ja ${wt.root}: ${e.message}`);
    }
  }
  for (const d of [...tempDirs]) {
    rmSync(d, { recursive: true, force: true });
    tempDirs.delete(d);
  }
  if (ok) releaseLock();
  return ok;
}

let stopping = false;
let baseline = null;
let pathspec = ['src'];
function onSignal(signal) {
  if (stopping) return;
  stopping = true;
  console.error(`\n${signal}: prekid — vraćam originale i brišem privremene worktree-je…`);
  const ok = cleanupAll();
  let code = signal === 'SIGINT' ? 130 : 143;
  if (ok && baseline) {
    const now = snapshot(WEB, pathspec);
    if (now.hash === baseline.hash) console.error(`stanje src vraćeno (heš ${short(now.hash)})`);
    else {
      console.error(`!!! STANJE SRC NIJE ISTO KAO PRE: ${snapshotDelta(baseline, now).join(', ')}`);
      code = 3;
    }
  }
  process.exit(code);
}

/** `--restore`: vrati fajlove iz rezervne kopije zaostale posle pada i obriši zaostale worktree-je. */
function restoreFromLock() {
  const lock = readLockFile();
  if (!lock) {
    console.log(
      existsSync(LOCK) ? `nečitljiv ${LOCK} — obriši ga ručno` : 'nema zaostale rezervne kopije'
    );
    return existsSync(LOCK) ? 1 : 0;
  }
  if (pidAlive(lock.pid) && lock.pid !== process.pid) {
    console.error(`pokretanje pid ${lock.pid} je još živo — ne diram ništa`);
    return 2;
  }
  let ok = true;
  for (const p of lock.pending ?? []) {
    const rel = relative(WEB, p.file);
    const cur = existsSync(p.file) ? sha256(readFileSync(p.file)) : null;
    if (cur === p.orig) console.log(`  ${rel}: već original`);
    else if (cur === p.sabotaged) {
      writeFileSync(p.file, readFileSync(p.backup));
      console.log(`  ${rel}: vraćen iz rezervne kopije`);
    } else {
      ok = false;
      console.error(`  ${rel}: menjan posle sabotaže — vrati ručno; original je u ${p.backup}`);
    }
  }
  for (const root of lock.worktrees ?? []) {
    removeWorktree({ root, web: join(root, relativeWebPrefix()), tmp: dirname(root) }, WEB);
    console.log(`  worktree ${root}: obrisan`);
  }
  if (!ok) return 1;
  const now = snapshot(WEB, lock.pathspec ?? ['src']);
  if (lock.stateHash && now.hash !== lock.stateHash) {
    console.error(
      `!!! heš stanja ${short(now.hash)} ≠ heš pre pokretanja ${short(lock.stateHash)} — proveri git status`
    );
    rmSync(CACHE, { recursive: true, force: true });
    return 3;
  }
  console.log(`stanje vraćeno (heš ${short(now.hash)})`);
  rmSync(CACHE, { recursive: true, force: true });
  return 0;
}

function relativeWebPrefix() {
  return git(WEB, ['rev-parse', '--show-prefix']).toString().trim();
}

/* ---------- vitest ---------- */

/** Pokreće vitest nad `tests` u `webDir`. Uz `capture` izlaz se ne prikazuje (čuva se kraj, za grešku). */
async function runVitest(webDir, tests, opts) {
  const outDir = mkdtempSync(join(tmpdir(), 'sabotage-out-'));
  tempDirs.add(outDir);
  const outFile = join(outDir, 'vitest.json');
  const args = [
    'run',
    ...tests,
    '--reporter=dot',
    '--reporter=json',
    `--outputFile.json=${outFile}`
  ];
  if (!opts.allFailures) args.push('--bail=1');
  args.push(...opts.extra);
  const env = { ...process.env };
  delete env.TEST_FULL;
  if (opts.full) env.TEST_FULL = '1';
  if (opts.capture) env.NO_COLOR = '1';
  const bin = join(webDir, 'node_modules', '.bin', 'vitest');
  const [cmd, cmdArgs] = existsSync(bin) ? [bin, args] : ['npx', ['vitest', ...args]];
  const t0 = performance.now();
  const child = spawn(cmd, cmdArgs, {
    cwd: webDir,
    env,
    stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  });
  children.add(child);
  let tail = '';
  const keep = (chunk) => {
    tail = (tail + chunk.toString()).slice(-6000);
  };
  child.stdout?.on('data', keep);
  child.stderr?.on('data', keep);
  const [code, signal] = await new Promise((done) => {
    child.on('error', (e) => {
      keep(String(e));
      done([null, null]);
    });
    child.on('close', (c, s) => done([c, s]));
  });
  children.delete(child);
  const ms = performance.now() - t0;
  let report = null;
  try {
    report = JSON.parse(readFileSync(outFile, 'utf8'));
  } catch {
    /* nema izveštaja: greška pri pokretanju */
  }
  rmSync(outDir, { recursive: true, force: true });
  tempDirs.delete(outDir);
  return { code, signal, report, tail, ms };
}

const firstLine = (s) =>
  String(s ?? '')
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean) ?? '';

/**
 * Pali testovi iz JSON izveštaja, poređani po približnom trenutku pada (početak fajla + trajanja testova pre njega;
 * izveštaj nema početak svakog testa). Fajl koji padne van pojedinačnog testa (uvoz, beforeAll) je jedan red.
 */
function failures(report, webDir) {
  const out = [];
  for (const file of report?.testResults ?? []) {
    const rel = relative(webDir, file.name);
    let at = file.startTime ?? 0;
    let any = false;
    for (const a of file.assertionResults ?? []) {
      at += a.duration ?? 0;
      if (a.status !== 'failed') continue;
      any = true;
      out.push({
        file: rel,
        test: [...(a.ancestorTitles ?? []), a.title].join(' > '),
        message: firstLine(a.failureMessages?.[0]),
        at
      });
    }
    if (file.status === 'failed' && !any) {
      out.push({
        file: rel,
        test: '(fajl pao van pojedinačnog testa — uvoz ili hook)',
        message: firstLine(file.message),
        at: file.startTime ?? 0,
        outsideTest: true
      });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Pokreni testove jedne (već primenjene) sabotaže i odredi ishod. */
async function judge(webDir, sab, opts) {
  const run = await runVitest(webDir, sab.tests, opts);
  const failed = failures(run.report, webDir);
  const ran = new Set((run.report?.testResults ?? []).map((f) => relative(webDir, f.name)));
  const notRun = sab.tests.filter((t) => !ran.has(t));
  const result = {
    status: 'greska',
    failedCount: failed.length,
    firstFailed: failed[0]
      ? { file: failed[0].file, test: failed[0].test, message: failed[0].message }
      : null,
    allFailed: opts.allFailures ? failed.map(({ file, test }) => ({ file, test })) : undefined,
    durationMs: run.ms,
    vitestExit: run.code,
    error: null,
    tail: run.tail
  };
  if (stopping) result.error = 'prekinuto';
  else if (!run.report)
    result.error = `vitest nije napisao izveštaj (kod ${run.code}, signal ${run.signal})`;
  else if (failed.length > 0) result.status = 'pao';
  else if (notRun.length > 0) result.error = `test fajl nije pokrenut: ${notRun.join(', ')}`;
  else if (run.code !== 0)
    result.error = `vitest izašao sa kodom ${run.code} bez palog testa (greška van testova?)`;
  else if (!(run.report.numTotalTests > 0)) result.error = 'nijedan test nije pokrenut';
  else result.status = 'nije-pao';
  return result;
}

/* ---------- jedna sabotaža u jednom direktorijumu ---------- */

async function runOne(webDir, sab, opts, base) {
  const res = {
    index: sab.index,
    name: sab.name,
    files: [...new Set(sab.edits.map((e) => e.file))],
    tests: sab.tests,
    status: 'greska',
    pao: false,
    firstFailed: null,
    failedCount: 0,
    durationMs: 0,
    hashBefore: base.hash,
    hashSabotaged: null,
    hashAfter: null,
    restored: true,
    error: null
  };
  let files;
  try {
    files = prepare(webDir, sab, opts.full);
  } catch (e) {
    res.error = e.message;
    return res;
  }
  const entry = apply(files, opts.backup);
  try {
    res.hashSabotaged = snapshot(webDir, pathspec).hash;
    Object.assign(res, await judge(webDir, sab, opts));
  } finally {
    entry.restore();
  }
  const after = snapshot(webDir, pathspec);
  res.hashAfter = after.hash;
  if (after.hash !== base.hash) {
    res.restored = false;
    res.changed = snapshotDelta(base, after);
  }
  res.pao = res.status === 'pao';
  return res;
}

/* ---------- worktree za --parallel ---------- */

/** Privremeni worktree od HEAD + necommitovane izmene + neverzionisani fajlovi + node_modules kao simlinkovi stavki. */
function makeWorktree(base) {
  const top = git(WEB, ['rev-parse', '--show-toplevel']).toString().trim();
  const prefix = relativeWebPrefix();
  const tmp = mkdtempSync(join(tmpdir(), 'sabotage-wt-'));
  const wt = { root: join(tmp, 'repo'), web: join(tmp, 'repo', prefix), tmp };
  lockState.worktrees.push(wt.root);
  writeLock();
  worktrees.add(wt);
  git(WEB, ['worktree', 'add', '--detach', '--quiet', wt.root, 'HEAD']);
  /* `--index`: nov fajl koji je u glavnom direktorijumu samo staged ostaje u `git diff HEAD`, ne postaje neverzionisan. */
  const patch = git(top, [...DIFF, '--no-renames', '--src-prefix=a/', '--dst-prefix=b/', 'HEAD']);
  if (patch.length > 0)
    git(wt.root, ['apply', '--index', '--binary', '--whitespace=nowarn', '-'], patch);
  const others = git(top, ['ls-files', '--others', '--exclude-standard', '-z'])
    .toString()
    .split('\0');
  for (const f of others.filter(Boolean)) {
    const from = join(top, f);
    const to = join(wt.root, f);
    const st = lstatSync(from);
    if (st.isDirectory()) {
      console.log(`  (preskačem ugnežđen repozitorijum ${f})`);
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    if (st.isSymbolicLink()) symlinkSync(readlinkSync(from), to);
    else {
      copyFileSync(from, to);
      chmodSync(to, st.mode & 0o7777);
    }
  }
  const nm = join(WEB, 'node_modules');
  mkdirSync(join(wt.web, 'node_modules'), { recursive: true });
  for (const e of readdirSync(nm)) {
    if (e.startsWith('.') && e !== '.bin') continue; // .vite, .tmp, .cache ostaju lokalni
    symlinkSync(join(nm, e), join(wt.web, 'node_modules', e));
  }
  const state = snapshot(wt.web, pathspec);
  if (state.hash !== base.hash) {
    throw new Error(
      `worktree ${wt.root} nema isto stanje kao glavni direktorijum (${snapshotDelta(base, state).join(', ')})`
    );
  }
  return wt;
}

/* ---------- ispis ---------- */

const LABEL = { pao: 'PAO', 'nije-pao': 'NIJE PAO', greska: 'GREŠKA' };

function printResult(r, opts) {
  const lines = [];
  if (opts.worktree) lines.push(`\n[${r.index}] ${r.name}`);
  lines.push(
    `  → ${LABEL[r.status]}  (${seconds(r.durationMs)})` +
      (r.status === 'pao' ? `  palih: ${r.failedCount}` : '')
  );
  if (r.firstFailed) {
    lines.push(`    prvi pali: ${r.firstFailed.file} > ${r.firstFailed.test}`);
    if (r.firstFailed.message) lines.push(`      ${r.firstFailed.message.slice(0, 300)}`);
  }
  if (r.status === 'nije-pao')
    lines.push('    !!! nijedan test nije oborio ovu sabotažu — testovi je ne hvataju');
  if (r.error) lines.push(`    greška: ${r.error}`);
  if (r.status === 'greska' && r.tail && opts.capture) {
    lines.push(
      '    kraj izlaza vitest-a:',
      ...r.tail
        .trimEnd()
        .split('\n')
        .slice(-25)
        .map((l) => `      ${l}`)
    );
  }
  if (opts.allFailures && r.allFailed?.length > 1) {
    lines.push('    svi pali:', ...r.allFailed.map((f) => `      ${f.file} > ${f.test}`));
  }
  if (!r.restored)
    lines.push(`    !!! STANJE SRC POSLE VRAĆANJA NIJE ISTO: ${r.changed.join(', ')}`);
  else if (r.hashAfter)
    lines.push(`    vraćeno; heš stanja src isti kao pre (${short(r.hashAfter)})`);
  console.log(lines.join('\n'));
}

function printSummary(results, ms) {
  console.log('\nZbirno:');
  console.log('   #  rezultat   palih   trajanje  sabotaža');
  for (const r of results) {
    console.log(
      `${String(r.index).padStart(4)}  ${LABEL[r.status].padEnd(9)}${String(r.status === 'pao' ? r.failedCount : '–').padStart(6)}` +
        `${seconds(r.durationMs).padStart(11)}  ${r.name}`
    );
    if (r.firstFailed)
      console.log(
        `${' '.repeat(33)}└ ${r.firstFailed.file.split('/').pop()} > ${r.firstFailed.test}`
      );
    else if (r.error) console.log(`${' '.repeat(33)}└ ${r.error}`);
  }
  const caught = results.filter((r) => r.status === 'pao').length;
  console.log(`\nukupno: ${caught}/${results.length} palo, ${seconds(ms)}`);
}

/* ---------- glavno ---------- */

/** Putanja za ispis: relativna na tekući direktorijum ako je kratka, inače apsolutna. */
const shown = (abs) => {
  const rel = relative(process.cwd(), abs);
  return rel === '' || rel.startsWith(`..${sep}..`) ? abs : rel;
};

async function main(argv) {
  const dd = argv.indexOf('--');
  const own = dd === -1 ? argv : argv.slice(0, dd);
  const extra = dd === -1 ? [] : argv.slice(dd + 1);
  let parsed;
  try {
    parsed = parseArgs({
      args: own,
      allowPositionals: true,
      options: {
        help: { type: 'boolean', short: 'h' },
        only: { type: 'string', multiple: true },
        full: { type: 'boolean' },
        'all-failures': { type: 'boolean' },
        parallel: { type: 'string' },
        json: { type: 'string' },
        quiet: { type: 'boolean', short: 'q' },
        'dry-run': { type: 'boolean' },
        restore: { type: 'boolean' }
      }
    });
  } catch (e) {
    throw new UsageError(e.message);
  }
  const { values: v, positionals } = parsed;
  if (v.help) {
    console.log(HELP);
    return 0;
  }
  if (v.restore) return restoreFromLock();
  if (positionals.length !== 1)
    throw new UsageError('treba tačno jedan ulazni JSON fajl (v. --help)');
  const parallel = v.parallel === undefined ? 1 : Number(v.parallel);
  if (!Number.isInteger(parallel) || parallel < 1)
    throw new UsageError('--parallel mora biti ceo broj ≥ 1');
  const input = resolve(positionals[0]);
  const all = loadSabotages(input);
  const chosen = select(all, v.only ?? []);
  const opts = {
    full: !!v.full,
    allFailures: !!v['all-failures'],
    worktree: parallel > 1, // traženo --parallel > 1 → glavni direktorijum se ne dira, ni za jednu sabotažu
    slots: Math.min(parallel, chosen.length),
    capture: !!v.quiet || parallel > 1,
    extra
  };
  opts.backup = !opts.worktree;
  /* Heš pokriva src i svaki sabotirani fajl van src (ako ga ima). */
  const outside = all
    .flatMap((s) => s.edits.map((e) => e.file))
    .filter((f) => !f.startsWith('src/'));
  pathspec = ['src', ...new Set(outside)];

  if (v['dry-run']) {
    let bad = 0;
    for (const s of chosen) {
      try {
        prepare(WEB, s, opts.full);
        console.log(`  OK      #${s.index} ${s.name}`);
      } catch (e) {
        bad++;
        console.log(`  GREŠKA  #${s.index} ${s.name}: ${e.message}`);
      }
    }
    return bad === 0 ? 0 : 1;
  }

  const t0 = performance.now();
  const head = git(WEB, ['rev-parse', '--short', 'HEAD']).toString().trim();
  baseline = snapshot(WEB, pathspec);
  acquireLock(baseline.hash, input);
  lockState.pathspec = pathspec;
  writeLock();
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => onSignal(sig));

  const cpu = availableParallelism();
  console.log(
    `sabotaže: ${shown(input)} — ${chosen.length} od ${all.length}; ` +
      `nivo ${opts.full ? 'PUN (TEST_FULL=1)' : 'BRZ'}, ${opts.allFailures ? 'bez bail (svi pali)' : '--bail=1'}` +
      (opts.worktree
        ? `, paralelno ${opts.slots} (worktree-ji; ${plural(cpu, 'jezgro', 'jezgra', 'jezgara')})`
        : '') +
      (extra.length ? `, vitest: ${extra.join(' ')}` : '')
  );
  console.log(
    `HEAD ${head}; necommitovano u ${pathspec.join(' ')}: diff ${baseline.diffBytes} B, ` +
      `${plural(baseline.untracked.length, 'neverzionisan fajl', 'neverzionisana fajla', 'neverzionisanih fajlova')}; ` +
      `heš stanja ${short(baseline.hash)}`
  );

  const results = new Array(chosen.length);
  let fatal = false;
  if (!opts.worktree) {
    for (const [k, sab] of chosen.entries()) {
      if (stopping) break;
      console.log(`\n[${sab.index}] ${sab.name}  (${k + 1}/${chosen.length})`);
      console.log(
        `    izmene: ${sab.edits.map((e) => e.file).join(', ')}; testovi: ${sab.tests.length}`
      );
      const r = await runOne(WEB, sab, opts, baseline);
      results[k] = r;
      printResult(r, opts);
      if (!r.restored) {
        fatal = true;
        break;
      }
    }
  } else {
    let next = 0;
    const slot = async () => {
      let wt = null;
      try {
        const tw = performance.now();
        wt = makeWorktree(baseline);
        console.log(`  worktree ${wt.root} spreman (${seconds(performance.now() - tw)})`);
        while (!stopping && !fatal && next < chosen.length) {
          const k = next++;
          const r = await runOne(wt.web, chosen[k], opts, baseline);
          results[k] = r;
          printResult(r, opts);
          if (!r.restored) fatal = true;
        }
      } finally {
        if (wt) removeWorktree(wt, WEB);
        if (wt) {
          lockState.worktrees = lockState.worktrees.filter((p) => p !== wt.root);
          writeLock();
        }
      }
    };
    const runs = await Promise.allSettled(Array.from({ length: opts.slots }, slot));
    for (const r of runs) {
      if (r.status === 'rejected') {
        fatal = true;
        console.error(`GREŠKA (worktree): ${r.reason?.message ?? r.reason}`);
      }
    }
  }

  const ms = performance.now() - t0;
  /* Sabotaža koja nije stigla na red (prekid posle greške vraćanja, pad worktree-ja) je neuspeh, ne izostavlja se. */
  const done = chosen.map(
    (sab, k) =>
      results[k] ?? {
        index: sab.index,
        name: sab.name,
        files: [...new Set(sab.edits.map((e) => e.file))],
        tests: sab.tests,
        status: 'greska',
        pao: false,
        firstFailed: null,
        failedCount: 0,
        durationMs: 0,
        restored: true,
        error: 'nije pokrenuta'
      }
  );
  const after = snapshot(WEB, pathspec);
  const sameState = after.hash === baseline.hash;
  const broken = !sameState || done.some((r) => !r.restored);
  printSummary(done, ms);
  if (!sameState) {
    console.error(
      `\n!!! STANJE SRC NIJE ISTO KAO PRE POKRETANJA: ${snapshotDelta(baseline, after).join(', ')}`
    );
    console.error(git(WEB, ['status', '--short', '--', ...pathspec]).toString());
  } else console.log(`stanje src isto kao pre pokretanja (heš ${short(after.hash)})`);

  if (v.json) {
    const out = {
      input,
      head,
      level: opts.full ? 'pun' : 'brz',
      bail: !opts.allFailures,
      parallel: opts.worktree ? opts.slots : 1,
      vitestArgs: extra,
      durationS: +(ms / 1000).toFixed(1),
      hashBefore: baseline.hash,
      hashAfter: after.hash,
      ok: !broken && !fatal && done.every((r) => r.status === 'pao'),
      results: done.map((r) => {
        const { tail, durationMs, ...rest } = r; // kraj izlaza vitest-a ne ide u JSON
        return {
          ...rest,
          durationS: +(durationMs / 1000).toFixed(1),
          vitestTail: rest.error ? tail : undefined
        };
      })
    };
    writeFileSync(resolve(v.json), `${JSON.stringify(out, null, 1)}\n`);
    console.log(`JSON: ${resolve(v.json)}`);
  }

  const cleaned = cleanupAll();
  if (broken || !cleaned) return 3;
  return !fatal && done.every((r) => r.status === 'pao') ? 0 : 1;
}

process.on('exit', () => {
  if (active.size > 0 || worktrees.size > 0) cleanupAll();
});

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e) => {
    if (e instanceof UsageError) {
      console.error(`sabotage.mjs: ${e.message}`);
      cleanupAll();
      process.exit(2);
    }
    console.error(e?.stack ?? e);
    cleanupAll();
    process.exit(1);
  }
);
