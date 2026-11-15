/* P9a — čitljiv ispis planova kakav KORISNIK vidi: 12 profila (P7) × 4 distance, isti format za sve.
   Tekst ide kroz iste korake kao aplikacija (app/plan.ts svake distance): napomene nedelje, napomene plana, ocena cilja i
   upozorenja; trkački dan kao trka; ukupno vreme nedelje u zaglavlju. Prvi red fajla: distanca + policyVersion.
   Iz web/: node ../docs/generators-v2/perfection/P9/render.ts <web koren> <izlazni folder> [5K|10K|HM|MAR]
   Izlaz: <izlazni folder>/<D>/pNN.txt */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const [root, outRoot, only] = process.argv.slice(2);
const G = `${root}/src/domain/generators`;
const dir = new URL(".", import.meta.url).pathname;
const inputs = JSON.parse(readFileSync(`${dir}inputs.json`, "utf8")) as Record<string, { title: string; input: Record<string, any> }[]>;

/* Po distanci: generisanje + tekst kakav aplikacija prikazuje (proveriti u app/plan.ts distance).
   weekNotes: napomene nedelje; planNotes: napomene plana + upozorenja (jedna lista kad ih app spaja);
   warnings: odvojena upozorenja (samo gde ih app prikazuje odvojeno od napomena); goal: tekst ocene cilja. */
type Adapter = {
  gen: (i: unknown) => any;
  weekNotes: (w: any) => string[];
  planNotes: (p: any) => string[];
  warnings: (p: any) => string[];
  goal: (s: string) => string;
  title: (s: string) => string;
  fns: string;
};
const idt = (s: string) => s;
async function adapter(D: string): Promise<Adapter> {
  if (D === "5K") {
    const v2 = `${G}/fiveK/v2`;
    const { userWarnings } = (await import(`${v2}/text.ts`)) as any;
    return {
      gen: (await import(`${v2}/generate.ts`)).generateFiveKV2,
      weekNotes: (w) => [...w.notes],
      planNotes: (p) => [...p.notes],
      warnings: (p) => userWarnings(p.warnings, p.input.weekOffset ?? 0),
      goal: idt,
      title: idt,
      fns: "generate.generateFiveKV2; text.userWarnings (napomene nedelje i plana bez userText — generator ih već formatira kroz userResult)",
    };
  }
  if (D === "10K") {
    const v2 = `${G}/tenK/v2`;
    const { userText } = (await import(`${v2}/app/format.ts`)) as any;
    const { userWeekNotes, userPlanMessages } = (await import(`${v2}/userNotes.ts`)) as any;
    return {
      gen: (await import(`${v2}/generate.ts`)).generateTenKV2,
      weekNotes: (w) => userWeekNotes(w.notes).map(userText),
      planNotes: (p) => userPlanMessages(p).map(userText),
      warnings: () => [],
      goal: userText,
      title: userText,
      fns: "generate.generateTenKV2; userNotes.userWeekNotes, userNotes.userPlanMessages (napomene+upozorenja zbirno), app/format.userText",
    };
  }
  if (D === "HM") {
    const v2 = `${G}/halfMarathon/v2`;
    const { userText } = (await import(`${v2}/userText.ts`)) as any;
    const { userWeekNotes } = (await import(`${v2}/volume.ts`)) as any;
    return {
      gen: (await import(`${v2}/generate.ts`)).generateHmV2,
      weekNotes: (w) => userWeekNotes(w).map(userText),
      planNotes: (p) => p.notes.map(userText),
      warnings: (p) => p.warnings.map((x: any) => userText(x.message)),
      goal: userText,
      title: userText,
      fns: "generate.generateHmV2; volume.userWeekNotes, userText.userText",
    };
  }
  const v2 = `${G}/marathon/v2`;
  const { userText } = (await import(`${v2}/app/format.ts`)) as any;
  const { technicalNote, belowTargetShown } = (await import(`${v2}/volume.ts`)) as any;
  const { EASY_UNDER_NOTE } = (await import(`${v2}/week.ts`)) as any;
  return {
    gen: (await import(`${v2}/generate.ts`)).generateMarathonV2,
    weekNotes: (w) =>
      w.notes.filter((n: string) => !technicalNote(n) && (n !== EASY_UNDER_NOTE || belowTargetShown(w.plannedKm, w.targetKm))).map(userText),
    planNotes: (p) => p.notes.map(userText),
    warnings: (p) => p.warnings.map((x: any) => userText(x.message)),
    goal: userText,
    title: userText,
    fns: "generate.generateMarathonV2; app/plan.ts filter (volume.technicalNote, volume.belowTargetShown, week.EASY_UNDER_NOTE) + app/format.userText",
  };
}

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
function describeInput(D: string, title: string, inp: Record<string, any>, pv: string): string[] {
  const weeks = (Date.parse(inp["raceDate"] + "T00:00:00Z") - Date.parse(inp["startDate"] + "T00:00:00Z") + 86_400_000) / (7 * 86_400_000);
  const L = [`PLAN — ${DNAME[D]} · ${pv}`, `Profil: ${title}`, ""];
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

function renderPlan(D: string, A: Adapter, title: string, inp: Record<string, any>, res: any): string {
  const clean = A.title;
  const L = describeInput(D, title, inp, res.ok ? String(res.plan.policyVersion) : "plan nije napravljen");
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
  if (p.goal) L.push(`  ${A.goal(p.goal.message)}`);
  else L.push("  Cilj nije zadat ili nije ocenjen.");
  if (pred) L.push(`  Prognoza na osnovu rezultata: ${pred >= 5400 ? hmmss(pred) : mmss(pred)}.`);
  else L.push("  Prognoza: nema pouzdanog rezultata.");
  for (const n of A.planNotes(p)) L.push(`  Napomena plana: ${n}`);
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
        L.push(`  ${WD[d.weekday].padEnd(10)} ${ddmm(d.date)}  TRKA — ${DNAME[D]}${race ? `, ${pred ? "prognoza" : "procena"} ${hmmss(race.sec)}` : ""}`);
        continue;
      }
      L.push(`  ${WD[d.weekday].padEnd(10)} ${ddmm(d.date)}  ${clean(wo.title)}`);
      L.push(`      ${f1(wo.km)} km · ${dur(wo.sec)}${workSec > 0 ? ` · radnih ${Math.round(workSec / 60)} min` : ""}${d.countsToWeek ? "" : " · ne ulazi u obim nedelje"}`);
    }
    for (const n of A.weekNotes(w)) L.push(`  Napomena: ${n}`);
  }
  const ws = A.warnings(p);
  L.push("", "=".repeat(60), "UPOZORENJA PLANA");
  if (!ws.length) L.push(D === "10K" ? "  (nema; upozorenja su u napomenama plana)" : "  (nema)");
  for (const x of ws) L.push(`  - ${x}`);
  return L.join("\n") + "\n";
}


for (const D of ["5K", "10K", "HM", "MAR"]) {
  if (only && only !== D) continue;
  const A = await adapter(D);
  mkdirSync(`${outRoot}/${D}`, { recursive: true });
  inputs[D]!.forEach((p, i) => {
    writeFileSync(`${outRoot}/${D}/p${String(i + 1).padStart(2, "0")}.txt`, renderPlan(D, A, p.title, p.input, A.gen(p.input)));
  });
  console.log(D, "ispisano", inputs[D]!.length, "|", A.fns);
}
