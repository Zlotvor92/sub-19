#!/bin/sh
# Pun fuzz: 100 000 ulaza po distanci, seed 20261023 (5K u 3 dela zbog brzine). Iz web/: sh ../docs/generators-v2/audit/fuzz/run.sh
S=20261023; F=../docs/generators-v2/audit/fuzz; mkdir -p $F/out
node $F/fuzz.ts 5K $S 0 34000 > $F/out/5K-0.json &
node $F/fuzz.ts 5K $S 34000 67000 > $F/out/5K-1.json &
node $F/fuzz.ts 5K $S 67000 100000 > $F/out/5K-2.json &
( for d in 10K HM MAR; do node $F/fuzz.ts $d $S 0 100000 > $F/out/$d.json; done ) &
wait
echo done
