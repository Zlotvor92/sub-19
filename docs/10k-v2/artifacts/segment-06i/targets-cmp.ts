// 06i: razlaganje promena CILJA nedelja (regresija pre/posle) do uzroka; pokreće se iz direktorijuma sa old.<k>.txt/new.<k>.txt (regress.ts); OLD = checkout 46e72eb.
// Razlaganje promena cilja: ponovo pokreće tokove na novom i starom kodu.
import { readFileSync, readdirSync } from "node:fs";
const OLD =
    "/tmp/claude-0/-home-user-sub-19/e05cf4f1-53cd-54fd-bf9a-3c3948d26ad8/scratchpad/base",
  NEW = "/home/user/sub-19";
const mods = async (R: string) => {
  const V = `${R}/web/src/domain/generators/tenK/v2`;
  return {
    A: await import(`${V}/adapt.ts`),
    G: await import(`${V}/generate.ts`),
    T: await import(`${V}/testInputs.ts`),
  };
};
const O = await mods(OLD),
  Nw = await mods(NEW);
const load = (pre: string) => {
  const m = new Map<string, string[]>();
  for (const f of readdirSync(".").filter(
    (x) => x.startsWith(pre + ".") && x.endsWith(".txt"),
  ))
    for (const l of readFileSync(f, "utf8").split("\n")) {
      if (!l) continue;
      const x = l.split("|");
      m.set(x.slice(0, 3).join("|"), x.slice(3));
    }
  return m;
};
const o = load("old"),
  n = load("new");
const all = [
  ...[3, 4, 5, 6].flatMap((d) => Nw.T.grid02Inputs(d)),
  ...[3, 4, 5, 6].flatMap((d) => Nw.T.feelGridInputs(d)),
  ...[3, 4].flatMap((d) => Nw.T.beginnerGridInputs(d)),
];
const byId = new Map(all.map((x: any) => [x.id, x]));
const run = (M: any, id: string, at: string, s: string) => {
  const p = M.G.generateTenKV2(byId.get(id).input).plan;
  return M.A.adaptTenKV2(p, M.T.factsOf(p, s, at), at).plan;
};
const cls: Record<string, number> = {};
const ex: Record<string, string[]> = {};
const add = (c: string, e: string) => {
  cls[c] = (cls[c] ?? 0) + 1;
  (ex[c] ??= []).length < 3 && ex[c]!.push(e);
};
for (const [k, a] of o) {
  const b = n.get(k)!;
  if (a[0] !== "ok" || b[0] !== "ok" || a[3] === b[3]) continue;
  const [id, at, s] = k.split("|") as [string, string, string];
  const po = run(O, id, at, s),
    pn = run(Nw, id, at, s);
  const N = pn.weeks.length;
  const ch = pn.weeks
    .map((w: any, i: number) =>
      w.targetKm !== po.weeks[i].targetKm ? i + 1 : 0,
    )
    .filter(Boolean);
  const p37 = pn.weeks
    .filter((w: any) => w.keptKm !== undefined)
    .map((w: any) => w.index);
  if (ch.length === 1 && ch[0] === N) {
    // trkačka: cilj = planirano (D8/D23); lagan trkačke ≤ najkraći lagan tapera — taper mešovit (pouka 37) i skraćen?
    const tp = N - 1;
    const easy = (w: any) =>
      Math.min(
        ...w.days
          .filter((d: any) => d.role === "easy")
          .map((d: any) => d.workout.km),
      );
    const dq = pn.weeks.some((w: any) =>
      w.notes.some((x: string) => x.includes("kvalitet koji ne staje otpada")),
    );
    const te = easy(pn.weeks[tp - 1]) !== easy(po.weeks[tp - 1]);
    add(
      p37.includes(tp) && easy(pn.weeks[tp - 1]) < easy(po.weeks[tp - 1])
        ? "trkačka: taper mešovit, najkraći lagan tapera kraći (D23)"
        : dq && te
          ? "trkačka: kvalitet otpao ranije → doza tapera → lagan tapera (D7/D23)"
          : "trkačka: DRUGO",
      k,
    );
  } else {
    const first = ch[0]!;
    const dq = pn.weeks
      .filter((w: any) =>
        w.notes.some((x: string) =>
          x.includes("kvalitet koji ne staje otpada"),
        ),
      )
      .map((w: any) => w.index);
    const fit = (p: any, i: number) =>
      p.weeks[i - 1].fitted !== null ||
      p.weeks[i - 1].notes.some(
        (x: string) => x.includes("(D6)") || x.includes("D11 ispred D12"),
      );
    const dqBefore = dq.some((i: number) => i < first);
    const fitted = ch
      .filter((i: number) => i !== N)
      .some((i: number) => fit(pn, i) || fit(po, i));
    add(
      `kaskada: kvalitet otpao pre ${dqBefore ? "DA" : "NE"}, D6/D12 u promenjenoj ${fitted ? "DA" : "NE"}`,
      `${k} p37 ${p37} dq ${dq} ch ${ch}`,
    );
  }
}
console.log(cls);
console.log(JSON.stringify(ex, null, 1));
