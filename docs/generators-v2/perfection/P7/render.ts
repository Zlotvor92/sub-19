/* P7a — čitljiv ispis planova (isti format za obe verzije) + anonimne oznake A/B.
   Seme NIJE u ovom fajlu: P7_SEED (okruženje). Ključ se piše u fajl iz P7_KEY_OUT (van repoa).
   Pokretanje: P7_SEED=… P7_KEY_OUT=… node render.ts <inputs.json> <sirovi-pre> <sirovi-posle> <izlaz: plans> [distanca ...] */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const [inputsPath, rawPre, rawPost, outRoot, ...only] = process.argv.slice(2);
const seed = Number(process.env["P7_SEED"]);
if (!Number.isFinite(seed)) throw new Error("P7_SEED nije zadat");
const keyOut = process.env["P7_KEY_OUT"];
const inputs = JSON.parse(readFileSync(inputsPath!, "utf8")) as Record<string, { title: string; input: Record<string, any> }[]>;

/* Ponovljivo nasumično: zavisi samo od semena, distance i broja profila. */
function coin(D: string, n: number): boolean {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const c of `${D}#${n}`) h = Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  return (h & 1) === 1;
}

/* ---------- čišćenje: bez internih oznaka pravila ---------- */
const clean = (s: string): string =>
  s
    .replace(/\bP\d+-[SF]\d+\b/g, "[pravilo]")
    .replace(/\b[Pp]ouk[aeu] \d+\b/g, "[pravilo]")
    .replace(/\bsegment \d+\b/gi, "[pravilo]")
    .replace(/\b[A-Z]{1,2}\d{1,2}[a-z]?\b/g, "[pravilo]")
    .replace(/(\d)\.(\d)/g, "$1,$2");

const f1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1).replace(".", ",");
const mmss = (s: number) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;
const hmmss = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const dur = (sec: number) => (sec >= 3600 ? `${Math.floor(sec / 3600)} h ${String(Math.round((sec % 3600) / 60)).padStart(2, "0")} min` : `${Math.round(sec / 60)} min`);
const WD: Record<string, string> = { mon: "Ponedeljak", tue: "Utorak", wed: "Sreda", thu: "Četvrtak", fri: "Petak", sat: "Subota", sun: "Nedelja" };
const WDS: Record<string, string> = { mon: "pon", tue: "uto", wed: "sre", thu: "čet", fri: "pet", sat: "sub", sun: "ned" };
const PHASE: Record<string, string> = { base: "osnova", development: "razvoj", specific: "specifična", taper: "taper", race: "trka" };
const ddmm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
const DNAME: Record<string, string> = { "5K": "5 km", "10K": "10 km", HM: "polumaraton", MAR: "maraton" };
const RM = (m: number) => (m === 5000 ? "5 km" : m === 10000 ? "10 km" : m === 21097.5 ? "polumaraton" : m === 3000 ? "3 km" : m === 42195 ? "maraton" : `${m} m`);

type Seg = { kind: string; km: number; sec: number };
function describeInput(D: string, title: string, inp: Record<string, any>): string[] {
  const weeks = (Date.parse(inp["raceDate"] + "T00:00:00Z") - Date.parse(inp["startDate"] + "T00:00:00Z") + 86_400_000) / (7 * 86_400_000);
  const L = [`PLAN — ${DNAME[D]}`, `Profil: ${title}`, ""];
  L.push(`Početak: ${inp["startDate"]} (${weeks} nedelja), trka: ${inp["raceDate"]}.`);
  L.push(`Dani trčanja: ${(inp["runDays"] as string[]).map((d) => WDS[d]).join(", ")}${inp["longRunDay"] ? `; dugi trk: ${WDS[inp["longRunDay"]]}` : ""}.`);
  L.push(`Trenutni obim: ${inp["currentWeeklyKm"]} km nedeljno.`);
  const easy = inp["easyPaceSecPerKm"] ?? inp["typicalEasyPaceSecPerKm"];
  if (inp["recentResult"]) L.push(`Skorašnji rezultat: ${RM(inp["recentResult"].distanceM)} za ${inp["recentResult"].distanceM >= 20000 ? hmmss(inp["recentResult"].timeSec) : mmss(inp["recentResult"].timeSec)}.`);
  else L.push(`Bez rezultata trke; lagan tempo ${mmss(easy)}/km.`);
  if (inp["recentLongRunKm"]) L.push(`Skorašnje najduže trčanje: ${inp["recentLongRunKm"]} km.`);
  if (inp["experience"] === "beginner") L.push("Iskustvo: početnik.");
  L.push(`Ciljno vreme: ${inp["goalTimeSec"] ? (inp["goalTimeSec"] >= 5400 ? hmmss(inp["goalTimeSec"]) : mmss(inp["goalTimeSec"])) : "nije zadato"}.`);
  return L;
}

function renderPlan(D: string, title: string, inp: Record<string, any>, res: any): string {
  const L = describeInput(D, title, inp);
  L.push("", "=".repeat(60), "");
  if (!res.ok) {
    L.push("Plan nije napravljen.", ...(res.reasons as { message: string }[]).map((r) => `Razlog: ${clean(r.message)}`));
    return L.join("\n") + "\n";
  }
  const p = res.plan;
  const pc = p.paces ?? {};
  const zone = (k: string, n: string) => (pc[k] ? `${n} ${mmss(pc[k])}` : null);
  L.push("TEMPO ZONE (min/km)");
  L.push(`  ${[pc.E ? `lagano ${mmss(pc.E.fast)}–${mmss(pc.E.slow)}` : null, zone("T", "T (prag)"), zone("I", "I (interval)"), zone("R", "R (repeticije)"), zone("RP", "tempo trke"), zone("MP", "tempo maratona")].filter(Boolean).join(" · ")}`);
  if (p.vdot != null) L.push(`  VDOT ${p.vdot}`);
  const pk = Object.keys(p).find((k) => /^predicted.*Sec$/.test(k));
  const pred = pk ? p[pk] : null;
  L.push("", "OCENA CILJA");
  if (p.goal) L.push(`  ${clean(p.goal.message)}`);
  else L.push("  Cilj nije zadat ili nije ocenjen.");
  if (pred) L.push(`  Prognoza na osnovu rezultata: ${pred >= 5400 ? hmmss(pred) : mmss(pred)}.`);
  else L.push("  Prognoza: nema pouzdanog rezultata.");
  if (p.notes?.length) for (const n of p.notes) L.push(`  Napomena plana: ${clean(String(n))}`);
  for (const w of p.weeks) {
    L.push("", "-".repeat(60));
    L.push(`NEDELJA ${w.index} — faza: ${PHASE[w.phase] ?? w.phase}${w.deload ? " — RASTEREĆENJE" : ""}${w.test ? " — kontrolno trčanje" : ""}`);
    L.push(`  ${ddmm(w.startDate)}–${ddmm(w.endDate)} · cilj ${f1(w.targetKm)} km · planirano ${f1(w.plannedKm)} km`);
    for (const d of w.days) {
      const wo = d.workout;
      const segs = (wo.segments ?? []) as Seg[];
      const workSec = segs.filter((g) => g.kind === "rep" || g.kind === "continuous" || g.kind === "test").reduce((a, g) => a + g.sec, 0);
      L.push(`  ${WD[d.weekday].padEnd(10)} ${ddmm(d.date)}  ${clean(wo.title)}`);
      L.push(`      ${f1(wo.km)} km · ${dur(wo.sec)}${workSec > 0 ? ` · radnih ${Math.round(workSec / 60)} min` : ""}${d.countsToWeek ? "" : " · ne ulazi u obim nedelje"}`);
    }
    for (const n of w.notes ?? []) L.push(`  Napomena: ${clean(String(n))}`);
  }
  const ws = p.warnings ?? [];
  L.push("", "=".repeat(60), "UPOZORENJA PLANA");
  if (!ws.length) L.push("  (nema)");
  for (const x of ws) L.push(`  - ${x.week ? `nedelja ${x.week}: ` : ""}${clean(x.message)}`);
  return L.join("\n") + "\n";
}

const key: Record<string, Record<string, string>> = {};
const counts: Record<string, number> = {};
const rejects: Record<string, { pre: number; post: number }> = {};
for (const D of Object.keys(inputs)) {
  if (only.length && !only.includes(D)) continue;
  mkdirSync(`${outRoot}/${D}`, { recursive: true });
  key[D] = {};
  rejects[D] = { pre: 0, post: 0 };
  inputs[D]!.forEach((p, i) => {
    const n = i + 1;
    const nn = String(n).padStart(2, "0");
    const pre = JSON.parse(readFileSync(`${rawPre}/${D}-${nn}.json`, "utf8"));
    const post = JSON.parse(readFileSync(`${rawPost}/${D}-${nn}.json`, "utf8"));
    if (!pre.ok) rejects[D]!.pre++;
    if (!post.ok) rejects[D]!.post++;
    const aIsPre = coin(D, n);
    const [a, b] = aIsPre ? [pre, post] : [post, pre];
    writeFileSync(`${outRoot}/${D}/p${nn}-A.txt`, renderPlan(D, p.title, p.input, a));
    writeFileSync(`${outRoot}/${D}/p${nn}-B.txt`, renderPlan(D, p.title, p.input, b));
    key[D]![nn] = aIsPre ? "A=pre,B=posle" : "A=posle,B=pre";
    counts[D] = (counts[D] ?? 0) + 2;
  });
}
if (keyOut) {
  const prev = existsSync(keyOut) ? JSON.parse(readFileSync(keyOut, "utf8")) : { seed, key: {} };
  writeFileSync(keyOut, JSON.stringify({ seed, key: { ...prev.key, ...key } }, null, 1));
}
console.log(JSON.stringify({ counts, rejects }));
