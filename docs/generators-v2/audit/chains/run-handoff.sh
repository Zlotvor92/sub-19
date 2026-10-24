#!/usr/bin/env bash
# UGAO 3 (chains): 3 000 lanaca posle predaje (5 parova × 600, seed 20261023). Iz korena repoa:
#   bash docs/generators-v2/audit/chains/run-handoff.sh [paralelno, podrazumevano 2]
set -u
ROOT=$(cd "$(dirname "$0")/../../../.." && pwd)
OUT="$ROOT/docs/generators-v2/audit/chains/out"
mkdir -p "$OUT"
printf "%s\n" "MAR>HM" "MAR>10K" "MAR>5K" "HM>10K" "HM>5K" |
  ROOT="$ROOT" OUT="$OUT" xargs -P "${1:-2}" -I{} bash -c '
    p="{}"; f="$OUT/handoff-${p/>/-}"; cd "$ROOT/web"; t0=$(date +%s)
    node ../docs/generators-v2/audit/chains/handoff-chains.ts "$p" 20261023 0 600 > "$f.json" 2> "$f.err"
    echo "handoff-${p/>/-} rc=$? $(( $(date +%s) - t0 ))s" >> "$OUT/_status.txt"'
