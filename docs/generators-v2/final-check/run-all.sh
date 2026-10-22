#!/usr/bin/env bash
# Organizator — završna provera: sve skripte final-check (+ handoff/shorter.ts) za sve 4 distance, paralelno.
# Ne povlačiti granu dok radi (mešano stanje daje lažne nalaze). Iz korena repoa:
#   bash docs/generators-v2/final-check/run-all.sh <OUT_DIR> [paralelnih poslova, podrazumevano 3] [regex imena poslova]
# Svaki posao piše <OUT_DIR>/<ime>.txt; <OUT_DIR>/_status.tsv: ime, izlazni kod, sekunde.
set -u
OUT=$(realpath -m "${1:?OUT_DIR}")
P=${2:-3}
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
mkdir -p "$OUT"
: > "$OUT/_status.tsv"
K="193 97 29"
{
  for D in HM MAR 10K 5K; do
    echo "early-$D|web|node ../docs/generators-v2/final-check/early.ts $D $K"
    echo "fatigue-repeat-$D|web|node ../docs/generators-v2/final-check/fatigue-repeat.ts $D end"
    echo "fatigue-startday-$D|web|node ../docs/generators-v2/final-check/fatigue-startday.ts $D 25"
    echo "fatigue-testweek-$D|web|node ../docs/generators-v2/final-check/fatigue-testweek.ts $D 25"
    echo "start-day-$D|web|node ../docs/generators-v2/final-check/start-day.ts $D 25"
    echo "locked-result-$D|web|node ../docs/generators-v2/final-check/locked-result.ts $D"
    echo "locked-test-$D|web|node ../docs/generators-v2/final-check/locked-test.ts $D 97"
    for s in last-weeks locked-pause result-pain two-step; do
      echo "$s-$D|web|node ../docs/generators-v2/final-check/$s.ts $D $K"
    done
  done
  for D in HM MAR; do
    echo "warnings-$D|root|node docs/generators-v2/final-check/warnings.ts $D 97"
    echo "targeted-$D|root|node docs/generators-v2/final-check/targeted.ts $D"
    echo "shorter-$D|web|node ../docs/generators-v2/handoff/shorter.ts $D $K"
  done
  for pair in "HM>5K" "HM>10K" "MAR>HM" "MAR>10K" "MAR>5K"; do
    echo "handoff-adapt-${pair/>/-}|web|node ../docs/generators-v2/final-check/handoff-adapt.ts '$pair' $K"
  done
  echo "fatigue-monday|web|node ../docs/generators-v2/final-check/fatigue-monday.ts"
  echo "mixed-deload|web|node ../docs/generators-v2/final-check/mixed-deload.ts"
  echo "prestart-chain|web|node ../docs/generators-v2/final-check/prestart-chain.ts"
} | grep -E "^(${3:-.*})\|" | OUT="$OUT" ROOT="$ROOT" xargs -P "$P" -d '\n' -n 1 bash -c '
  IFS="|" read -r name dir cmd <<< "$1"
  cd "$ROOT"; [ "$dir" = web ] && cd web
  t0=$(date +%s); bash -c "$cmd" > "$OUT/$name.txt" 2>&1; rc=$?
  printf "%s\t%s\t%s\n" "$name" "$rc" "$(( $(date +%s) - t0 ))" >> "$OUT/_status.tsv"
' _
sort "$OUT/_status.tsv" | awk -F'\t' '{ printf "%-28s rc=%s %5ss\n", $1, $2, $3 } $2 != 0 { bad++ } END { print (bad ? bad " posl(a) sa greškom" : "svi poslovi rc=0") }'
