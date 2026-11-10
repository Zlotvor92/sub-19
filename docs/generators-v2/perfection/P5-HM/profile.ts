/* P5-HM — profil (a) (P0/common.ts profileA, HM) pun ispis. Iz web/:
   node ../docs/generators-v2/perfection/P5-HM/profile.ts [web/ na 8e87fd4] > ../docs/generators-v2/perfection/P5-HM/profile-a-HM-<pre|posle>.txt */
import { profileA, weekly } from "../P0/common.ts";
const root = process.argv[2] ? `${process.argv[2]}/src` : "../../../../web/src";
const { generateHmV2 } = await import(`${root}/domain/generators/halfMarathon/v2/generate.ts`);
const r = generateHmV2(profileA("HM"));
console.log(r.ok ? weekly(r.plan as never) : JSON.stringify(r));
