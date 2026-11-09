/* P1 — profil (a) (P0/common.ts profileA, HM) pun ispis. Iz web/: node ../docs/generators-v2/perfection/P1/profile.ts > ../docs/generators-v2/perfection/P1/profile-a-HM.txt */
import { profileA, weekly } from "../P0/common.ts";
import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
const r = generateHmV2(profileA("HM"));
console.log(r.ok ? weekly(r.plan as never) : JSON.stringify(r));
