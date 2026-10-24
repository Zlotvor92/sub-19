#!/usr/bin/env bash
# Spaja video (Remotion) i master audio u finalni MP4 za Instagram Reels i priprema isporuku.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p deliverables
OUT=deliverables/nitrati_trcanje_reel_final.mp4
ffmpeg -v error -y -i out/video_raw.mp4 -i build/final_mix.wav \
  -map 0:v:0 -map 1:a:0 \
  -c:v libx264 -preset slow -crf 12 -tune animation -x264-params aq-mode=3 -profile:v high -level 4.2 -pix_fmt yuv420p -r 30 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -movflags +faststart -shortest -metadata title="Nitrati i trčanje" "$OUT"
# naracija: izvorni ElevenLabs fajl (MP3 128 kb/s, 44,1 kHz) + WAV poravnat sa montažom
cp assets/audio/voiceover_elevenlabs_v4_takeA.mp3 deliverables/nitrati_trcanje_voiceover_izvorni.mp3
ffmpeg -v error -y -i build/voiceover_timeline.wav -c:a pcm_s24le deliverables/nitrati_trcanje_voiceover.wav
cp data/nitrati_trcanje_subtitles.srt deliverables/
# naslovnica
npx remotion still src/index.ts Cover out/cover.png --log=error
ffmpeg -v error -y -i out/cover.png -q:v 2 deliverables/nitrati_trcanje_cover.jpg
echo "Gotovo: $OUT"
