#!/usr/bin/env bash
# Završna obrada: zvuk na -14 LUFS (loudnorm, dva prolaza, true peak -1 dBTP) + H.264 za mreže (yuv420p, faststart).
# Upotreba: tools/finish.sh renders/sub20-promo-master.mp4 renders/sub20-promo.mp4 [crf]
set -euo pipefail
IN="$1"; OUT="$2"; CRF="${3:-20}"
M=$(ffmpeg -hide_banner -nostats -i "$IN" -vn -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$M" | sed -n "s/.*\"$1\" : \"\([^\"]*\)\".*/\1/p"; }
AF="loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true"
ffmpeg -hide_banner -loglevel error -y -i "$IN" -af "$AF,aresample=48000" \
  -c:v libx264 -preset slow -crf "$CRF" -maxrate 6M -bufsize 12M -pix_fmt yuv420p -profile:v high -level 4.2 \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$OUT"
echo "ulaz: I=$(get input_i) LUFS, TP=$(get input_tp) dBTP"
