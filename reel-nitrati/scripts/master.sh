#!/usr/bin/env bash
# Mastering: cilj -14 LUFS integrated, true peak <= -1 dBTP.
# Pojačanje + limiter na 4x nadsemplovanom signalu, zatim provera (ebur128, true peak).
set -euo pipefail
cd "$(dirname "$0")/.."
IN=build/premaster.wav
OUT=build/final_mix.wav
TARGET=-14.0
measure() { ffmpeg -hide_banner -nostats -i "$1" -af ebur128=peak=true -f null - 2>&1 | awk '/Integrated loudness/{f=1} f&&/I:/{print $2; exit}'; }
tpeak() { ffmpeg -hide_banner -nostats -i "$1" -af ebur128=peak=true -f null - 2>&1 | awk '/True peak/{f=1} f&&/Peak:/{print $2; exit}'; }
I0=$(measure "$IN")
GAIN=$(python3 -c "print(round($TARGET - ($I0), 2))")
for pass in 1 2 3; do
  ffmpeg -v error -y -i "$IN" -af "aresample=192000,volume=${GAIN}dB,alimiter=limit=0.80:attack=2:release=80:level=disabled,aresample=48000" -c:a pcm_f32le "$OUT"
  I=$(measure "$OUT"); TP=$(tpeak "$OUT")
  echo "pass $pass: gain=${GAIN} dB -> I=${I} LUFS, TP=${TP} dBTP"
  OK=$(python3 -c "print(1 if abs($I - ($TARGET)) <= 0.3 and $TP <= -1.0 else 0)")
  [ "$OK" = "1" ] && break
  GAIN=$(python3 -c "print(round($GAIN + ($TARGET - ($I)), 2))")
done
