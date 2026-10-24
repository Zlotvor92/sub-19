# Segment 10K-07 — pomoćne skripte (pre/posle)

„Pre" = c13c258 u zasebnom `git worktree` (`$S/base`, `web/node_modules` kao simbolička veza), „posle" = grana.
Putanje u skriptama su apsolutne (scratchpad sesije) — za ponavljanje zameni `N`/`O` (novi/stari `tenK/v2`) i `S`.

- `classify-07.ts gen|adapt` — svaki plan/tok: stari kod prema novom + `testInputs.undo07`; uzrok razlike (O-1b, F3,
  Z1, ostalo). Rezultat: gen 31 122 → O-1b 930, F3 822; adapt 2 040 → Z1 28, F3 37; ostalo 0.
- `mkfx.py <izlaz.json>` — fixture `segment07.adapt-changed-c13c258.json` iz dump-ova tokova (privremena kuka
  `DUMP07` u `level.harness.node.test.ts` → `p37FlowErrors`, pun nivo, oba stabla; kuka uklonjena posle upisa).
- `extract-chains.ts <izlaz.json>` — `segment07.chains-20261023.json` (lanci i=204, 529, 5771, 664, 218, 1885 iz
  `docs/generators-v2/audit/chains/chains.ts 10K 20261023`).
- `undo-restore.ts` — neposredno poništavanje (Z4): 2 040 tokova, odbijeno 0, nevalidno 0, sledeća adaptacija 0.
- `sabotage-07.json` — sabotaže (`web/scripts/sabotage.mjs`).
