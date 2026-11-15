/* P8-10K — sirovi planovi 12 profila P7 (10K) „posle P8" u obliku koji vidi trkač: napomene nedelje kroz
   userNotes.userWeekNotes, napomene + upozorenja plana kroz userNotes.userPlanMessages (jedna lista, u ispisu kao
   napomene plana; upozorenja prazna). Ispis: P7/render.ts sa istim ulazom za obe strane (A = B).
   Iz web/: node ../docs/generators-v2/perfection/P8-10K/dump-user.ts <izlazni folder> */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { generateTenKV2 } from "../../../../web/src/domain/generators/tenK/v2/generate.ts";
import { userPlanMessages, userWeekNotes } from "../../../../web/src/domain/generators/tenK/v2/userNotes.ts";
import { userText } from "../../../../web/src/domain/generators/tenK/v2/app/format.ts";
const out = process.argv[2]!;
const dir = new URL(".", import.meta.url).pathname;
const inputs = JSON.parse(readFileSync(`${dir}p7-inputs-10K.json`, "utf8")) as Record<string, { input: unknown }[]>;
mkdirSync(out, { recursive: true });
inputs["10K"]!.forEach((p, i) => {
  const r = generateTenKV2(p.input) as { ok: boolean; plan?: any };
  if (r.ok) {
    const plan = r.plan;
    plan.notes = userPlanMessages(plan).map(userText);
    plan.warnings = [];
    for (const w of plan.weeks) w.notes = userWeekNotes(w.notes).map(userText);
  }
  writeFileSync(`${out}/10K-${String(i + 1).padStart(2, "0")}.json`, JSON.stringify(r));
});
console.log("ok");
