/* JEDINI IZVOR VREMENA za video: scene, naracija, reči, zvučni efekti, muzika.
   Ako postoje audio/vo/lineNN.mp3 → trajanje reda je stvarno (ffprobe); ako postoji audio/vo/words.json → vremena reči su stvarna.
   Inače: procena 2,4 reči/s i reči raspoređene po broju slova. Sve ostalo (index.html, sfx, muzika) se izvodi odavde. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* min = najkraće trajanje scene (s) da vizuelna radnja stane; lead = početak govora od početka scene; tail = posle govora */
export const SCENES = [
  { id: 's1', min: 3.6, lead: 0.55, tail: 0.35, vo: 'Sat ti kaže vreme. Ali ne kaže zašto.' },
  { id: 's2', min: 3.0, lead: 0.15, tail: 0.35, vo: 'Do sab dvadeset fali ti dvadeset šest sekundi.' },
  { id: 's3', min: 3.4, lead: 0.30, tail: 0.45, vo: 'Četvrti kilometar popusti — dvanaest sekundi.' },
  { id: 's4', min: 3.4, lead: 0.30, tail: 0.40, vo: 'Plan koji nije pravljen za tebe — još osam.' },
  { id: 's5', min: 3.2, lead: 0.30, tail: 0.40, vo: 'Umor koji ne vidiš — još šest.' },
  { id: 's6', min: 3.8, lead: 0.35, tail: 0.30, vo: 'A ti u ponoć držiš otvorene Stravu, tabelu, kalkulator tempa i ejč-ar-vi.' },
  { id: 's7', min: 2.6, lead: 0.30, tail: 0.55, vo: 'Zato postoji Sab dvadeset.' },
  { id: 's8', min: 3.2, lead: 0.30, tail: 0.30, vo: 'Svaki dan znaš šta trčiš, i kojim tempom.' },
  { id: 's9', min: 3.6, lead: 0.30, tail: 0.30, vo: 'Plan se pravi iz tvog ve-dot-a, iz tvog vremena.' },
  { id: 's10', min: 3.6, lead: 0.30, tail: 0.30, vo: 'Posle trke vidiš svaki kilometar, i gde je vreme otišlo.' },
  { id: 's11', min: 3.8, lead: 0.45, tail: 0.30, vo: 'A oporavak ti kaže kad da stisneš, a kad da staneš.' },
  { id: 's12', min: 3.6, lead: 0.30, tail: 0.30, vo: 'Sab dvadeset ti pokazuje gde su tvoje sekunde.' }
];
/* posle govora scene 12: povratak kugle se dovrši, pa 3D prolet, kartica „Napravljeno sa AI" i lockup */
/* tekst za ElevenLabs eleven_v4 (glas Filip): isti kao vo + uputstva u zagradama, koja se ne izgovaraju */
export const TTS = [
  '[warmly] [calmly] Sat ti kaže vreme... Ali ne kaže zašto.',
  '[warmly] Do sab dvadeset fali ti dvadeset šest sekundi.',
  '[mischievously] Četvrti kilometar popusti — dvanaest sekundi.',
  '[mischievously] Plan koji nije pravljen za tebe — još osam.',
  '[softly] [slowly] Umor koji ne vidiš — još šest.',
  '[playfully] A ti u ponoć držiš otvorene Stravu, tabelu, kalkulator tempa i ejč-ar-vi.',
  '[warmly] Zato postoji Sab dvadeset.',
  '[warmly] Svaki dan znaš šta trčiš, i kojim tempom.',
  '[confidently] Plan se pravi iz tvog ve-dot-a, iz tvog vremena.',
  '[warmly] Posle trke vidiš svaki kilometar, i gde je vreme otišlo.',
  '[excited] A oporavak ti kaže kad da stisneš, [calmly] a kad da staneš.',
  '[warmly] Sab dvadeset ti pokazuje gde su tvoje sekunde.'
];
export const OUTRO = { settle: 0.6, fly: 2.2, ai: 0.9, lockup: 2.4 };

const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w));
const audioDur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

export function timing() {
  const wordsFile = join(ROOT, 'audio/vo/words.json');
  const real = existsSync(wordsFile) ? JSON.parse(readFileSync(wordsFile, 'utf8')) : {};
  let t = 0;
  const scenes = SCENES.map((s, i) => {
    const n = String(i + 1).padStart(2, '0');
    const file = join(ROOT, `audio/vo/line${n}.mp3`);
    const w = words(s.vo);
    const est = w.length / 2.4;
    const voDur = existsSync(file) ? audioDur(file) : est;
    let wt;
    if (real[s.id]?.length === w.length) wt = real[s.id].map((x) => x.start);
    else {
      /* procena: reč počinje srazmerno broju slova pre nje (+ pauza na interpunkciji) */
      const weight = w.map((x) => x.length + (/[.,—:]$/.test(x) ? 3 : 1));
      const tot = weight.reduce((a, b) => a + b, 0);
      let acc = 0;
      wt = weight.map((x) => { const v = (acc / tot) * voDur * 0.94; acc += x; return +v.toFixed(3); });
    }
    const dur = Math.max(s.min, s.lead + voDur + s.tail) + (i === SCENES.length - 1 ? OUTRO.settle + OUTRO.fly + OUTRO.ai + OUTRO.lockup : 0);
    const out = { id: s.id, n, start: +t.toFixed(3), dur: +dur.toFixed(3), voStart: +(t + s.lead).toFixed(3), voDur: +voDur.toFixed(3), words: w, wt: wt.map((x) => +(t + s.lead + x).toFixed(3)), audio: existsSync(file) ? `audio/vo/line${n}.mp3` : null };
    t += dur;
    return out;
  });
  const total = +(t + 0.0).toFixed(3);
  const last = scenes[scenes.length - 1];
  const outro = { settle: +(last.voStart + last.voDur + 0.2).toFixed(3) };
  outro.fly = +(outro.settle + OUTRO.settle).toFixed(3);
  outro.ai = +(outro.fly + OUTRO.fly).toFixed(3);
  outro.lockup = +(outro.ai + OUTRO.ai).toFixed(3);
  const T = { total, scenes, outro };
  T.ev = events(T);
  return T;
}

/* ključni trenuci radnje — koristi ih i animacija (film.js) i zvučni efekti, da ne mogu da se raziđu */
export function events(T) {
  const st = (n) => T.scenes[n - 1].start;
  const W = (n, k) => wordAt(T, n, k);
  const r = (x) => +x.toFixed(3);
  const ev = {};
  ev.land = r(st(1) + 0.5);
  ev.land2 = r(ev.land + 0.54);
  ev.gap = r(W(2, 'dvadeset#1') - 0.05);
  ev.run = r(st(3) + 0.15);
  ev.gasp = r(st(3) + 1.25);
  ev.melt = r(Math.max(ev.gasp + 0.6, W(3, 'popusti')));
  ev.chunkA = r(W(3, 'dvanaest') - 0.05);
  ev.hop1 = r(st(4) + 0.05 + 0.42);
  ev.hop2 = r(st(4) + 0.6 + 0.42);
  ev.bite = r(W(4, 'još') - 0.35);
  ev.vortex = r(st(5) + 0.7);
  ev.snap = r(Math.max(st(5) + 1.5, W(5, 'šest') - 0.1));
  ev.clock = r(st(6) + 0.26);
  ev.cards = ['stravu', 'tabelu', 'kalkulator', 'ejč'].map((w) => r(W(6, w) - 0.1));
  ev.shrink = r(st(7) + 0.45);
  ev.reveal = r(Math.max(ev.shrink + 0.62, W(7, 'sab') - 0.15));
  ev.pan = r(st(8) - 0.32);
  ev.circle8 = r(W(8, 'tempom') - 0.2);
  ev.push9 = r(st(9) + 0.05);
  ev.fly9 = r(Math.max(st(9) + 0.9, W(9, 5) - 0.55));
  ev.check9 = r(Math.max(ev.fly9 + 1.2, W(9, 'vremena') - 0.1));
  ev.rows10 = r(st(10) + 0.55);
  ev.circle10 = r(W(10, 'gde') - 0.25);
  ev.peek10 = r(Math.max(W(10, 'gde') + 0.4, st(10) + 1.6));
  ev.zoom11 = r(st(11));
  ev.stop11 = r(W(11, 'staneš'));
  ev.stamp11 = r(ev.stop11 + 0.3);
  ev.ret12 = r(st(12) + 0.8);
  ev.grow12 = r(ev.ret12 + 3 * 0.32 + 0.35);
  ev.stamp12 = r(Math.max(ev.grow12 + 0.9, W(12, 'sekunde') - 0.1));
  ev.fly = T.outro.fly;
  ev.lockup = T.outro.lockup;
  return ev;
}

/* vreme reči: scena (1..12), reč po indeksu ili po prefiksu teksta; „reč#1" = drugo pojavljivanje (isto kao W u film.js) */
export function wordAt(T, sceneNo, which) {
  const s = T.scenes[sceneNo - 1];
  if (typeof which === 'number') return s.wt[which];
  const [pre, nth] = which.split('#');
  let skip = nth ? Number(nth) : 0, hit = -1;
  s.words.forEach((w, j) => { if (hit < 0 && w.toLowerCase().replace(/[^\p{L}\d-]/gu, '').startsWith(pre)) { if (skip-- === 0) hit = j; } });
  return s.wt[Math.max(0, hit)];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const T = timing();
  for (const s of T.scenes) console.log(s.id.padEnd(4), s.start.toFixed(2).padStart(6), (s.start + s.dur).toFixed(2).padStart(6), `vo ${s.voDur.toFixed(2)}s`, s.audio ? 'audio' : 'procena');
  console.log('ukupno', T.total, 's · outro', JSON.stringify(T.outro));
}
