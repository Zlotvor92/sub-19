/* P8-HM — čitljiv ispis planova „posle P8" za 12 profila P7 (isti format kao P7/render.ts), ali sa tekstom KAKAV
   KORISNIK VIDI: napomene nedelje kroz domen (`userWeekNotes`), napomene plana, ocena cilja i upozorenja kroz
   `userText`; trkački dan kao trka; ukupno vreme nedelje u zaglavlju nedelje.
   Iz web/: node ../docs/generators-v2/perfection/P8-HM/render.ts <web koren> <izlazni folder> */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const [root, outRoot] = process.argv.slice(2);
const V2 = `${root}/src/domain/generators/halfMarathon/v2`;
const gen = (await import(`${V2}/generate.ts`)).generateHmV2 as (i: unknown) => any;
const { userText } = (await import(`${V2}/userText.ts`)) as { userText: (s: string) => string };
const { userWeekNotes } = (await import(`${V2}/volume.ts`)) as { userWeekNotes: (w: { notes: readonly string[] }) => string[] };
const dir = new URL(".", import.meta.url).pathname;
const inputs = JSON.parse(readFileSync(`${dir}inputs.json`, "utf8")) as Record<string, { title: string; input: Record<string, any> }[]>;

/* ---------- čišćenje: bez internih oznaka pravila ---------- */
const clean = (s: string): string => userText(s);

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
    L.push(`  ${ddmm(w.startDate)}–${ddmm(w.endDate)} · cilj ${f1(w.targetKm)} km · planirano ${f1(w.plannedKm)} km · ukupno ${dur(w.days.filter((d: any) => d.countsToWeek).reduce((a: number, d: any) => a + d.workout.sec, 0))}`);
    for (const d of w.days) {
      const wo = d.workout;
      const segs = (wo.segments ?? []) as Seg[];
      const workSec = segs.filter((g) => g.kind === "rep" || g.kind === "continuous" || g.kind === "test").reduce((a, g) => a + g.sec, 0);
      if (d.role === "race") {
        const race = segs.find((g) => g.kind === "race");
        L.push(`  ${WD[d.weekday].padEnd(10)} ${ddmm(d.date)}  TRKA — polumaraton 21,1 km${race ? `, ${pred ? "prognoza" : "procena"} ${hmmss(race.sec)}` : ""}; zagrevanje 10 min lagano pre starta (ne ulazi u obim nedelje)`);
        continue;
      }
      L.push(`  ${WD[d.weekday].padEnd(10)} ${ddmm(d.date)}  ${clean(wo.title)}`);
      L.push(`      ${f1(wo.km)} km · ${dur(wo.sec)}${workSec > 0 ? ` · radnih ${Math.round(workSec / 60)} min` : ""}${d.countsToWeek ? "" : " · ne ulazi u obim nedelje"}`);
    }
    for (const n of userWeekNotes(w)) L.push(`  Napomena: ${n}`);
  }
  const ws = p.warnings ?? [];
  L.push("", "=".repeat(60), "UPOZORENJA PLANA");
  if (!ws.length) L.push("  (nema)");
  for (const x of ws) L.push(`  - ${x.week ? `nedelja ${x.week}: ` : ""}${clean(x.message)}`);
  return L.join("\n") + "\n";
}

mkdirSync(outRoot!, { recursive: true });
inputs["HM"]!.forEach((p, i) => {
  writeFileSync(`${outRoot}/p${String(i + 1).padStart(2, "0")}.txt`, renderPlan("HM", p.title, p.input, gen(p.input)));
});
console.log("ispisano", inputs["HM"]!.length);
