# Nitrati i trčanje — Instagram Reel (izvorni projekat)

Vertikalni edukativni video 1080 × 1920, 30 fps, 81,0 s, srpski (ekavica, latinica).
Montaža je programska (Remotion + React + TypeScript), audio miks i mastering su u Pythonu i FFmpeg-u.
Sve animacije su vezane za vremensku liniju videa (deterministički render).

## Struktura

```
data/words_takeA.json        vremena reči naracije (ElevenLabs Scribe), tekst po scenariju
scripts/build_timeline.py    rezovi naracije u tišinama, početak scena na mreži 0,6 s (100 BPM),
                             znakovi (cue) za animaciju i zvuk, titlovi -> src/timeline.json + SRT
scripts/make_music.py        originalna muzika (sinteza) -> public/audio/music.wav
scripts/mix_audio.py         naracija + efekti + muzika sa duckingom -> build/premaster.wav
scripts/master.sh            -14 LUFS integrated, true peak <= -1 dBTP -> build/final_mix.wav
scripts/finalize.sh          finalni MP4 (H.264, yuv420p, AAC, faststart), SRT, WAV, naslovnica
src/scenes/S1..S8            osam scena
src/components/              ilustracije, trkač, tipografija, titlovi
assets/audio/                izvorna naracija (ElevenLabs Eleven v4) i izabrani zvučni efekti
assets/sources/              izvori korišćeni za proveru tvrdnji
```

## Ponovni render

Potrebno: Node 18+, Python 3 (numpy, scipy), FFmpeg, Chromium headless shell
(putanja je u `remotion.config.ts`; na drugom računaru je izbrišite i Remotion će preuzeti svoj).

```bash
npm install
python3 scripts/build_timeline.py          # samo ako se menjaju reči/rezovi
python3 scripts/make_music.py
python3 scripts/mix_audio.py && ./scripts/master.sh
npx remotion render src/index.ts NitratiReel out/video_raw.mp4
./scripts/finalize.sh                      # rezultat u deliverables/
```

Pregled u pregledaču: `npm run studio` (kompozicije `NitratiReel` i `Cover`).
Titlovi u videu su uključeni; za verziju bez upisanih titlova renderujte sa
`--props='{"subtitles":false}'`.

## Promena naracije

1. Nova naracija → `assets/audio/voiceover_elevenlabs_v4_takeA.mp3`.
2. Vremena reči (npr. ElevenLabs Scribe) → `data/words_takeA.json`.
3. U `scripts/build_timeline.py` uskladite `CUTS` (tišine između scena) i `SCENE_STARTS`.
4. Pokrenite ceo niz iznad.

## Šta nije u gitu

`public/audio/music.wav` (pravi ga `scripts/make_music.py`, seme je fiksno), finalni MP4 i WAV naracije
u `deliverables/` (pravi ih `scripts/finalize.sh`), `node_modules/`, `out/`, `build/` i lokalna kopija AIS PDF-a.
