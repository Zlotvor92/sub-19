#!/usr/bin/env bash
# UGAO 3 (chains): 20 000 lanaca po distanci (seed 20261023), 2 dela po 10 000, 4 paralelno. Iz korena repoa:
#   bash docs/generators-v2/audit/chains/run.sh
set -u
ROOT=$(cd "$(dirname "$0")/../../../.." && pwd)
OUT="$ROOT/docs/generators-v2/audit/chains/out"
mkdir -p "$OUT"
SEED=${SEED:-20261023}
for D in MAR HM 10K 5K; do for P in 0 1; do echo "$D $P"; done; done |
  ROOT="$ROOT" OUT="$OUT" SEED="$SEED" xargs -P 4 -L 1 bash -c '
    cd "$ROOT/web"; t0=$(date +%s)
    node ../docs/generators-v2/audit/chains/chains.ts $0 $SEED $(( $1 * 10000 )) $(( ($1 + 1) * 10000 )) > "$OUT/$0-$1.json" 2> "$OUT/$0-$1.err"
    echo "$0-$1 rc=$? $(( $(date +%s) - t0 ))s" >> "$OUT/_status.txt"'
