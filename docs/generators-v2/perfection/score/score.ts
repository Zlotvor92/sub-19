/* SCORE — automatsko merilo kvaliteta generisanog plana (bez trenera). Ne menja aplikaciju, ne pokreće testove.
   Iz web/: node ../docs/generators-v2/perfection/score/score.ts <web koren> [5K|10K|HM|MAR] [--v3 <putanja do generate funkcije>]
   Ulaz: P9/inputs.json (12 profila × 4 distance); plan se uzima kao OBJEKAT iz generatora (isti pozivi kao P9/render.ts).
   --v3 <modul>: modul koji izvozi generate* funkciju (ili default) sa istim oblikom plana; izlaz ide u out/<D>-v3.tsv.
   Izlaz: score/out/<D>.tsv + score/out/SUMMARY.md (prosek, Spearman prema treneru ROUND-04.json, najveća neslaganja).

   TEŽINE (zbir 100) — jedina tabela koja se podešava. Svaki pokazatelj → s ∈ [0,1], ocena = Σ w·s. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const W_V1: Record<string, number> = { // prva formula (prolaz 1) — čuva se samo radi poređenja pre/posle
  plato: 6, dugiStart: 4, vrhPolozaj: 9, predTaper: 6, taper: 6, trkNedelja: 5, monotonija: 8, istePar: 8, trkTempo: 8, sadrzajDugi: 8,
  rast: 9, lagDugi: 6, kratakLagan: 5, test: 6, doza: 6,
};
// Prolaz 2 (jedini drugi): + fit (m–q), „iste nedelje" (f2) van formule — ostaje u tabeli (ind.istePar), rast po pravilu organizatora (q).
const W: Record<string, number> = {
  plato: 4, //      a) plato dugog
  dugiStart: 2, //  b) dugi u nedelji 1 / najduži
  vrhPolozaj: 7, // c) položaj najteže nedelje
  predTaper: 6, //  d) nedelja pred taper / najteža
  taper: 6, //      e1) taper nedelje / najteža
  trkNedelja: 5, // e2) minuti rada u trkačkoj nedelji
  monotonija: 6, // f1) ista doza iste zone zaredom
  trkTempo: 6, //   g1) km u trkačkom tempu (udeo)
  sadrzajDugi: 6, //g2) nedelje sa sadržajem u dugom
  rastQ: 10, //     h/q) vrh/start (> 1,4 redovni), skok, sati po nivou
  lagDugi: 6, //    i) lagan / dugi
  kratakLagan: 3, //j) lagan dan < 30 min
  test: 6, //       k) kontrolni test / trka
  doza: 6, //       l) doza po treningu
  dugiFit: 7, //    m) najduži dugi (min / km) prema zahtevu distance i nivoa
  dugiUdeo: 6, //   n) dugi kao udeo obima u nedelji vrha
  vrhObim: 4, //    o) vrh obima prema zahtevu distance
  daniObim: 4, //   p) kratki laganci > 2 nedelje + dani kvaliteta pri 3 dana
};

const D_ALL = ["5K", "10K", "HM", "MAR"] as const;
const MOD: Record<string, [string, string]> = { "5K": ["fiveK", "generateFiveKV2"], "10K": ["tenK", "generateTenKV2"], HM: ["halfMarathon", "generateHmV2"], MAR: ["marathon", "generateMarathonV2"] };
const RPZ: Record<string, string> = { "5K": "RP", "10K": "RP", HM: "RP", MAR: "MP" }; // zona trkačkog tempa
// Gornja granica minuta rada u jednom treningu po zoni (ROUND-01 § 3); RP: 5K 21, 10K 32, HM 45, MAR 90 (blok u dugom).
const CAP: Record<string, Record<string, number>> = {
  "5K": { R: 12, I: 24, T: 30, RP: 21 }, "10K": { R: 12, I: 24, T: 30, RP: 32 }, HM: { R: 12, I: 24, T: 30, RP: 45 }, MAR: { R: 12, I: 24, T: 30, MP: 90 },
};
// Pretpostavka (nije u standardu trenera): najmanji udeo km u trkačkom tempu od ukupnih km plana.
const RP_SHARE: Record<string, number> = { "5K": 0.04, "10K": 0.04, HM: 0.04, MAR: 0.03 };
// Nedeljni satni plafon po nivou: [početnik, VDOT<40, VDOT 40–52] (ROUND-01 § 3); brži: bez plafona.
const HRS: Record<string, [number, number, number]> = { "5K": [5, 6, 7], "10K": [5, 6, 7], HM: [6.5, 7.5, 9], MAR: [7.5, 9, 10.5] };

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ramp = (x: number, good: number, bad: number) => clamp((x - bad) / (good - bad)); // good→1, bad→0 (radi u oba smera)
const median = (a: number[]) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
const r2 = (x: number) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : NaN);

const WORK = new Set(["rep", "continuous"]); // „rad": segmenti kvaliteta. Test (kind "test") se ne računa kao rad, vidi k).
const isEasyZ = (z: string) => z === "E" || z === "jog";
type Wk = { w: any; i: number; work: number; zone: Record<string, number>; hours: number; long: number; main: boolean };

function weekInfo(plan: any): Wk[] {
  return plan.weeks.map((w: any, i: number) => {
    const zone: Record<string, number> = {}; let work = 0; let long = 0; let sec = 0;
    for (const d of w.days) {
      if (d.countsToWeek) sec += d.workout.sec ?? 0;
      if (d.workout.kind === "long") long = d.workout.km;
      if (d.role === "race") continue;
      for (const s of d.workout.segments ?? []) if (WORK.has(s.kind)) { zone[s.zone] = (zone[s.zone] ?? 0) + s.sec; work += s.sec; }
    }
    return { w, i, work, zone, hours: sec / 3600, long, main: !w.deload && w.phase !== "taper" && w.phase !== "race" };
  });
}

type Res = { ind: Record<string, number>; s: Record<string, number>; score: number; v1: number };
function scorePlan(D: string, plan: any, input: any): Res {
  const wi = weekInfo(plan); const N = wi.length; const RP = RPZ[D]!;
  const nd = wi.filter((x) => !x.w.deload && x.w.phase !== "race"); // ne-rasteretne
  const main = wi.filter((x) => x.main); // ne-rasteretne izgradnje (bez tapera i trke)
  const ind: Record<string, number> = {}; const s: Record<string, number> = {};

  // a) plato dugog: broj ne-rasteretnih nedelja u kojima je dugi isti (±0,3 km) kao u prethodnoj ne-rasteretnoj. Udeo = plato / (nedelja sa dugim − 1).
  const L = nd.filter((x) => x.long > 0);
  ind.plato = L.slice(1).filter((x, k) => Math.abs(x.long - L[k]!.long) <= 0.3).length;
  s.plato = ramp(ind.plato / Math.max(1, L.length - 1), 0.25, 0.6);
  // b) dugi u nedelji 1 / najduži dugi (≤ 0,70 → 1; ≥ 0,95 → 0).
  const maxLong = Math.max(0, ...wi.map((x) => x.long));
  ind.dugiStart = maxLong > 0 ? wi[0]!.long / maxLong : NaN;
  s.dugiStart = Number.isFinite(ind.dugiStart) ? ramp(ind.dugiStart, 0.7, 0.95) : 0;
  // c) položaj najteže nedelje: koliko nedelja pre trke je nedelja sa najviše minuta rada kvaliteta (kraj dela bez trkačke nedelje; pri izjednačenju
  //    kasnija). Cilj 3 (plan ≤ 8 ned: 2); s = 1 − |razlika|/3.
  const pre = wi.filter((x) => x.w.phase !== "race"); const peak = Math.max(0, ...pre.map((x) => x.work));
  const peakW = [...pre].reverse().find((x) => x.work === peak);
  ind.vrhPolozaj = peakW ? N - peakW.w.index : NaN;
  s.vrhPolozaj = peakW ? 1 - Math.min(1, Math.abs(ind.vrhPolozaj - (N <= 8 ? 2 : 3)) / 3) : 0;
  // d) minuti rada u poslednjoj ne-rasteretnoj nedelji pre tapera / najteža nedelja (cilj ≤ 0,85; ≥ 1,0 → 0).
  const lastMain = main[main.length - 1];
  ind.predTaper = peak > 0 && lastMain ? lastMain.work / peak : NaN;
  s.predTaper = Number.isFinite(ind.predTaper) ? ramp(ind.predTaper, 0.85, 1.0) : 0;
  // e) taper: najveći minuti rada u taper nedeljama / najteža (cilj ≤ 0,60; ≥ 0,90 → 0); bez taper nedelja = 0.
  const tp = wi.filter((x) => x.w.phase === "taper");
  ind.taper = peak > 0 && tp.length ? Math.max(...tp.map((x) => x.work)) / peak : NaN;
  s.taper = Number.isFinite(ind.taper) ? ramp(ind.taper, 0.6, 0.9) : 0;
  //    trkačka nedelja: minuti rada (bez trke), cilj 6–12; 0 kad je plan bez trkačke nedelje.
  const rw = wi.find((x) => x.w.phase === "race");
  ind.trkNedelja = rw ? rw.work / 60 : NaN;
  s.trkNedelja = Number.isFinite(ind.trkNedelja) ? 1 - Math.min(1, Math.max(0, 6 - ind.trkNedelja, ind.trkNedelja - 12) / 6) : 0;
  // f) monotonija: najduži niz ne-rasteretnih nedelja izgradnje sa istom dozom (minuti rada u zoni, ±3 %) iste zone; cilj ≤ 2 (4 → 0).
  let mono = 1;
  for (const z of new Set(main.flatMap((x) => Object.keys(x.zone)))) {
    let run = 0, prev = -1;
    for (const x of main) {
      const v = x.zone[z] ?? 0;
      run = v > 0 && prev > 0 && Math.abs(v - prev) <= 0.03 * prev ? run + 1 : v > 0 ? 1 : 0;
      prev = v; mono = Math.max(mono, run);
    }
  }
  ind.monotonija = mono; s.monotonija = ramp(mono, 2, 4);
  //    parovi uzastopnih (među ne-rasteretnim izgradnje) nedelja istih po svim treninzima (dan, vrsta, naslov, km); s: 0 parova → 1, ≥ 50 % → 0.
  const sig = (x: Wk) => x.w.days.map((d: any) => `${d.weekday}|${d.workout.kind}|${d.workout.title}|${Math.round(d.workout.km * 10)}`).join(";");
  ind.istePar = main.slice(1).filter((x, k) => sig(x) === sig(main[k]!)).length;
  s.istePar = ramp(ind.istePar / Math.max(1, main.length - 1), 0, 0.5);
  // g) specifičnost: km u trkačkom tempu (rep/continuous u zoni RP/MP) ukupno; unutar dugog; nedelje sa sadržajem u dugom (segment dugog osim lagano/zagrevanje).
  let rpKm = 0, rpLong = 0, totKm = 0; const contentW = new Set<number>();
  for (const x of wi) for (const d of x.w.days) {
    if (d.role === "race") continue; totKm += d.workout.km;
    for (const g of d.workout.segments ?? []) {
      if (g.zone === RP && WORK.has(g.kind)) { rpKm += g.km; if (d.workout.kind === "long") rpLong += g.km; }
      if (d.workout.kind === "long" && (WORK.has(g.kind) || !(isEasyZ(g.zone) || g.zone == null))) contentW.add(x.i);
    }
  }
  ind.rpKm = r2(rpKm); ind.rpDugiKm = r2(rpLong); ind.sadrzajDugi = contentW.size;
  s.trkTempo = clamp(rpKm / Math.max(1, totKm) / RP_SHARE[D]!);
  s.sadrzajDugi = clamp(contentW.size / Math.max(1, main.length) / 0.25); // cilj: ≥ 25 % nedelja izgradnje
  // h) rast: vrh/start (plannedKm; cilj ≤ 1,30 za ≤ 12 ned, 1,40 za ≥ 16, linearno između), najveći skok između susednih ne-rasteretnih nedelja izgradnje
  //    (cilj ≤ +10 %; izuzetak prethodna < 25 km i skok ≤ 2 km), najveći nedeljni obim u satima (plafon po nivou, ROUND-01 § 3).
  const km = wi.map((x) => x.w.plannedKm as number);
  ind.vrhStart = Math.max(...km) / Math.max(1, km[0]!);
  const cap = N <= 12 ? 1.3 : N >= 16 ? 1.4 : 1.3 + 0.1 * (N - 12) / 4;
  let jump = 0;
  main.slice(1).forEach((x, k) => { const p = km[main[k]!.i]!, c = km[x.i]!; const j = c - p <= 2 && p < 25 ? 0 : (c - p) / p; jump = Math.max(jump, j); });
  ind.skokPct = r2(jump * 100);
  ind.satiMax = r2(Math.max(...wi.map((x) => x.hours)));
  const lvl = plan.experience === "beginner" || input.experience === "beginner" ? 0 : (plan.vdot ?? 99) < 40 ? 1 : (plan.vdot ?? 99) <= 52 ? 2 : 3;
  const hcap = lvl === 3 ? Infinity : HRS[D]![lvl]!;
  s.rast = (clamp(1 - (ind.vrhStart - cap) / 0.4) + ramp(jump, 0.1, 0.25) + clamp(1 - (ind.satiMax - hcap) / 1.5)) / 3;
  //    q) (prolaz 2) vrh/start > 1,4 kažnjava redovnog (početnik: plafon 2,1 po GAP § 2); skok i sati kao gore (sati po tabeli HRS: početnik / VDOT < 40 / 40–52).
  const capQ = lvl === 0 ? 2.1 : 1.4;
  s.rastQ = (clamp(1 - (ind.vrhStart - capQ) / 0.4) + ramp(jump, 0.1, 0.25) + clamp(1 - (ind.satiMax - hcap) / 1.5)) / 3;
  // i) lagan / dugi iste nedelje (najveći lagan dan po km ÷ dugi): medijana i maksimum po nedeljama izgradnje; medijana ≤ 0,65 → 1, ≥ 0,85 → 0;
  //    maksimum ≤ 0,75 → 1, ≥ 1,00 → 0 (lagan ≥ dugi je degenerisan).
  const rat = main.filter((x) => x.long > 0).map((x) => Math.max(0, ...x.w.days.filter((d: any) => d.workout.kind === "easy").map((d: any) => d.workout.km)) / x.long);
  ind.lagDugiMed = r2(median(rat)); ind.lagDugiMax = r2(Math.max(0, ...rat));
  s.lagDugi = rat.length ? (ramp(ind.lagDugiMed, 0.65, 0.85) + ramp(ind.lagDugiMax, 0.75, 1.0)) / 2 : 0;
  // j) kratak lagan dan: nedelje izgradnje sa laganim danom kraćim od 30 min; 0 → 1, ≥ 25 % nedelja → 0.
  ind.kratakLagan = main.filter((x) => x.w.days.some((d: any) => d.workout.kind === "easy" && d.workout.sec < 1800)).length;
  s.kratakLagan = ramp(ind.kratakLagan / Math.max(1, main.length), 0, 0.25);
  // k) kontrolni test ili trka pre cilja: postoji (0/1), nedelja, jedini kvalitet te nedelje (0/1). s = 0,5 postoji + 0,25 jedini kvalitet
  //    + 0,25 u prozoru 4–6 nedelja pre trke (maraton 5–8).
  const tw = wi.find((x) => x.w.test || x.w.days.some((d: any) => d.role === "test" || d.workout.kind === "test" || (d.workout.segments ?? []).some((g: any) => g.kind === "test")));
  ind.testPostoji = tw ? 1 : 0; ind.testNedelja = tw ? tw.w.index : NaN;
  ind.testJedini = tw ? (tw.w.days.filter((d: any) => d.workout.kind === "quality").length === 0 ? 1 : 0) : NaN;
  const before = tw ? N - tw.w.index : NaN, [lo, hi] = D === "MAR" ? [5, 8] : [4, 6];
  s.test = tw ? 0.5 + 0.25 * ind.testJedini! + (before >= lo && before <= hi ? 0.25 : 0) : 0;
  // l) doza po treningu: najveći minuti rada u jednom treningu po zoni (R, I, T, RP/MP); s = prosek po zonama koje plan koristi,
  //    1 do gornje granice zone (CAP), pada na 0 pri prekoračenju od 50 % granice.
  const mx: Record<string, number> = {};
  for (const x of wi) for (const d of x.w.days) {
    const zz: Record<string, number> = {};
    for (const g of d.workout.segments ?? []) if (WORK.has(g.kind)) zz[g.zone] = (zz[g.zone] ?? 0) + g.sec;
    for (const [z, v] of Object.entries(zz)) mx[z] = Math.max(mx[z] ?? 0, v / 60);
  }
  const cz = CAP[D]!; const parts: number[] = [];
  for (const z of Object.keys(cz)) { ind[`doza${z}`] = r2(mx[z] ?? 0); if ((mx[z] ?? 0) > 0) parts.push(clamp(1 - ((mx[z] ?? 0) - cz[z]!) / (0.5 * cz[z]!))); }
  s.doza = parts.length ? parts.reduce((a, b) => a + b) / parts.length : 0;

  // m) najduži dugi: minuti i km; zahtev (dovoljno jedno od km ili min): 5K ≥ 60 min; 10K početnik ≥ 85 min (ostali ≥ 75 min — MOJA pretpostavka);
  //    HM ≥ 16 km ili 125 min; MAR ≥ 26 km ili 165 min (početnik 24 km ili 180 min). s = 1 pri ≥ 100 % zahteva, 0 pri ≤ 70 %.
  const longW = wi.flatMap((x) => x.w.days.filter((d: any) => d.workout.kind === "long").map((d: any) => d.workout));
  const lMin = Math.max(0, ...longW.map((q: any) => q.sec / 60)), lKm = Math.max(0, ...longW.map((q: any) => q.km));
  const RACE_KM: Record<string, number> = { "5K": 5, "10K": 10, HM: 21.0975, MAR: 42.195 };
  const beg = lvl === 0;
  const need: [number | null, number | null] = D === "5K" ? [null, 60] : D === "10K" ? [null, beg ? 85 : 75] : D === "HM" ? [16, 125] : beg ? [24, 180] : [26, 165];
  const fitR = Math.max(need[0] ? lKm / need[0] : 0, need[1] ? lMin / need[1] : 0);
  ind.dugiMin = r2(lMin); ind.dugiKm = r2(lKm); ind.dugiUdeoTrke = r2(lKm / RACE_KM[D]!);
  s.dugiFit = ramp(fitR, 1, 0.7);
  // n) dugi kao udeo plannedKm u nedelji vrha obima (najveći plannedKm, bez trkačke): ≤ 45 % → 1; 50 % → 0,5; ≥ 60 % → 0 (kazna > 45 %, jaka > 50 %).
  const pkw = [...pre].sort((a, b) => b.w.plannedKm - a.w.plannedKm)[0];
  ind.dugiUdeo = pkw && pkw.long > 0 ? r2(pkw.long / pkw.w.plannedKm) : NaN;
  s.dugiUdeo = !Number.isFinite(ind.dugiUdeo) ? 0 : ind.dugiUdeo <= 0.45 ? 1 : ind.dugiUdeo <= 0.5 ? 1 - (ind.dugiUdeo - 0.45) * 10 : ramp(ind.dugiUdeo, 0.6, 0.5) * 0.5;
  // o) vrh obima prema zahtevu distance: MAR ≥ 50, HM ≥ 35, 10K ≥ 25 km (5K bez zahteva → 1); s = min(1, vrh / zahtev), srazmerno.
  const REQ: Record<string, number> = { "5K": 0, "10K": 25, HM: 35, MAR: 50 };
  ind.vrhKm = r2(Math.max(...km));
  s.vrhObim = REQ[D] ? Math.min(1, ind.vrhKm / REQ[D]!) : 1;
  // p) dani × obim: (1) lagan dan < 30 min u > 2 nedelje izgradnje (≤ 2 → 1; ≥ 6 → 0); (2) pri 3 dana trčanja udeo nedelja izgradnje sa ≥ 2 dana
  //    kvaliteta (0 % → 1; ≥ 50 % → 0); pri više dana računa se samo (1).
  const rd = (input.runDays ?? []).length;
  ind.nedeljeDvaKvaliteta = main.filter((x) => x.w.days.filter((d: any) => d.workout.kind === "quality").length >= 2).length;
  const p1 = ramp(Math.max(0, ind.kratakLagan! - 2), 0, 4);
  s.daniObim = rd === 3 ? (p1 + ramp(ind.nedeljeDvaKvaliteta / Math.max(1, main.length), 0, 0.5)) / 2 : p1;
  ind.vrhPolozaj = r2(ind.vrhPolozaj!); ind.dugiStart = r2(ind.dugiStart!); ind.predTaper = r2(ind.predTaper!); ind.taper = r2(ind.taper!); ind.trkNedelja = r2(ind.trkNedelja!); ind.vrhStart = r2(ind.vrhStart!);
  const score = Object.keys(W).reduce((a, k) => a + W[k]! * (s[k] ?? 0), 0);
  const scoreV1 = Object.keys(W_V1).reduce((a, k) => a + W_V1[k]! * (s[k] ?? 0), 0);
  return { ind, s, score: r2(score), v1: r2(scoreV1) };
}

// ---- statistika
function ranks(a: number[]): number[] {
  const idx = a.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0]); const r = new Array<number>(a.length);
  for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++; for (let k = i; k <= j; k++) r[idx[k]![1]] = (i + j) / 2 + 1; i = j + 1; }
  return r;
}
function spearman(a: number[], b: number[]): number {
  const x = ranks(a), y = ranks(b), n = a.length, mx = x.reduce((p, q) => p + q) / n, my = y.reduce((p, q) => p + q) / n;
  let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i]! - mx) * (y[i]! - my); sxx += (x[i]! - mx) ** 2; syy += (y[i]! - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
}

// ---- glavni tok
const args = process.argv.slice(2); const vi = args.indexOf("--v3");
const v3 = vi >= 0 ? args.splice(vi, 2)[1] : undefined;
const [root, only] = args as [string, string | undefined];
if (!root) { console.error("upotreba: node score.ts <web koren> [5K|10K|HM|MAR] [--v3 <modul>]"); process.exit(1); }
const dir = new URL(".", import.meta.url).pathname;
const inputs = JSON.parse(readFileSync(`${dir}../P9/inputs.json`, "utf8")) as Record<string, { title: string; input: any }[]>;
const coach = JSON.parse(readFileSync(`${dir}../coach/ROUND-04.json`, "utf8")) as { plans: { distance: string; profile: string; total: number; scores: Record<string, number> }[] };
const sfx = v3 ? "-v3" : "";
mkdirSync(`${dir}out`, { recursive: true });

type Row = { D: string; p: string; title: string; ok: boolean; res?: Res; coach?: { total: number; scores: Record<string, number> } };
const rows: Row[] = [];
for (const D of D_ALL) {
  if (only && only !== D) continue;
  let gen: (i: any) => any;
  if (v3) { const m = (await import(pathToFileURL(v3).href)) as any; gen = m.default ?? Object.values(m).find((f: any) => typeof f === "function" && /^generate/.test(f.name)); }
  else { const m = (await import(`${root}/src/domain/generators/${MOD[D]![0]}/v2/generate.ts`)) as any; gen = m[MOD[D]![1]]; }
  inputs[D]!.forEach((pr, i) => {
    const p = `p${String(i + 1).padStart(2, "0")}`; const r = gen(pr.input);
    const c = coach.plans.find((q) => q.distance === D && q.profile === p);
    rows.push({ D, p, title: pr.title, ok: !!r.ok, res: r.ok ? scorePlan(D, r.plan, pr.input) : undefined, coach: c && !v3 ? { total: c.total, scores: c.scores } : undefined });
  });
}

const IK = ["plato", "dugiStart", "vrhPolozaj", "predTaper", "taper", "trkNedelja", "monotonija", "istePar", "rpKm", "rpDugiKm", "sadrzajDugi", "vrhStart", "skokPct", "satiMax", "lagDugiMed", "lagDugiMax", "kratakLagan", "dugiMin", "dugiKm", "dugiUdeoTrke", "dugiUdeo", "vrhKm", "nedeljeDvaKvaliteta", "istePar", "testPostoji", "testNedelja", "testJedini", "dozaR", "dozaI", "dozaT", "dozaRP", "dozaMP"];
const SK = [...new Set([...Object.keys(W), ...Object.keys(W_V1)])];
for (const D of D_ALL) {
  const rs = rows.filter((r) => r.D === D); if (!rs.length) continue;
  const head = ["profil", "ocena", "ocena_V1", "trener", ...IK, ...SK.map((k) => "s_" + k)].join("\t");
  const body = rs.map((r) => [r.p, r.res?.score ?? "", r.res?.v1 ?? "", r.coach?.total ?? "", ...IK.map((k) => r.res?.ind[k] ?? ""), ...SK.map((k) => (r.res ? r2(r.res.s[k]!) : ""))].join("\t"));
  writeFileSync(`${dir}out/${D}${sfx}.tsv`, [head, ...body].join("\n") + "\n");
}

const ok = rows.filter((r) => r.res); const avg = (a: number[]) => (a.length ? r2(a.reduce((x, y) => x + y, 0) / a.length) : NaN);
const L: string[] = [`# SCORE — zbir${v3 ? " (v3: " + v3 + ")" : ""}`, "", `Planova ocenjeno: ${ok.length}/${rows.length}. Ocena 0–100 (težine u score.ts).`, "", "## Prosek po distanci", "", "| distanca | naš prosek | trener (ROUND-04) | n |", "|---|---|---|---|"];
for (const D of D_ALL) { const rs = ok.filter((r) => r.D === D); if (rs.length) L.push(`| ${D} | ${avg(rs.map((r) => r.res!.score))} | ${avg(rs.filter((r) => r.coach).map((r) => r.coach!.total))} | ${rs.length} |`); }
L.push(`| sve | ${avg(ok.map((r) => r.res!.score))} | ${avg(ok.filter((r) => r.coach).map((r) => r.coach!.total))} | ${ok.length} |`);
const pair = ok.filter((r) => r.coach);
if (pair.length > 4) {
  const rho = (f: (r: Row) => number, g: (r: Row) => number, q = pair) => r2(spearman(q.map(f), q.map(g)));
  L.push("", "## Spearman pre / posle (V1 = prvi prolaz, V2 = sa fit pokazateljima, bez \"iste nedelje\")", "", "| skup | V1 | V2 | n |", "|---|---|---|---|");
  L.push(`| ukupno | ${rho((r) => r.res!.v1, (r) => r.coach!.total)} | ${rho((r) => r.res!.score, (r) => r.coach!.total)} | ${pair.length} |`);
  for (const D of D_ALL) { const q = pair.filter((r) => r.D === D); if (q.length > 4) L.push(`| ${D} | ${rho((r) => r.res!.v1, (r) => r.coach!.total, q)} | ${rho((r) => r.res!.score, (r) => r.coach!.total, q)} | ${q.length} |`); }
  L.push("", "### ρ prema trenerovim kategorijama (ukupno, 48 planova)", "", "| kategorija | V1 | V2 |", "|---|---|---|");
  for (const c of Object.keys(pair[0]!.coach!.scores)) L.push(`| ${c} | ${rho((r) => r.res!.v1, (r) => r.coach!.scores[c]!)} | ${rho((r) => r.res!.score, (r) => r.coach!.scores[c]!)} |`);
  L.push("", "### Prosek V1 → V2 po distanci", "", "| distanca | V1 | V2 |", "|---|---|---|");
  for (const D of D_ALL) { const q = ok.filter((r) => r.D === D); if (q.length) L.push(`| ${D} | ${avg(q.map((r) => r.res!.v1))} | ${avg(q.map((r) => r.res!.score))} |`); }
  L.push("", "## Spearman (naša ocena ↔ ocena trenera, ROUND-04)", "", "| skup | ρ | n |", "|---|---|---|");
  L.push(`| ukupno | ${r2(spearman(pair.map((r) => r.res!.score), pair.map((r) => r.coach!.total)))} | ${pair.length} |`);
  for (const D of D_ALL) { const q = pair.filter((r) => r.D === D); if (q.length > 4) L.push(`| ${D} | ${r2(spearman(q.map((r) => r.res!.score), q.map((r) => r.coach!.total)))} | ${q.length} |`); }
  const ro = ranks(pair.map((r) => r.res!.score)), rc = ranks(pair.map((r) => r.coach!.total));
  const dif = pair.map((r, i) => ({ r, o: ro[i]!, c: rc[i]!, d: ro[i]! - rc[i]! })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 5);
  L.push("", "## Pet najvećih neslaganja (rang među svim planovima; 1 = najlošiji)", "", "| plan | naša (rang) | trener (rang) | naši najslabiji pokazatelji (gubitak poena) | trenerove najniže kategorije |", "|---|---|---|---|---|");
  for (const x of dif) {
    const loss = SK.map((k) => [k, (W[k] ?? 0) * (1 - x.r.res!.s[k]!)] as const).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} −${r2(v)}`).join(", ");
    const low = Object.entries(x.r.coach!.scores).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([k, v]) => `${k} ${v}`).join(", ");
    L.push(`| ${x.r.D} ${x.r.p} | ${x.r.res!.score} (${x.o}) | ${x.r.coach!.total} (${x.c}) | ${loss} | ${low} |`);
  }
}
writeFileSync(`${dir}out/SUMMARY${only ? "-" + only : ""}${sfx}.md`, L.join("\n") + "\n");
console.log(L.join("\n"));
