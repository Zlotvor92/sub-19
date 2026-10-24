"""Gradi vremensku liniju montaže iz stvarnih vremena reči naracije (take A).

Naracija se seče samo u tišinama između scena. Početak svake scene je na mreži
od 0,6 s (100 BPM), pa prelazi padaju na muzičke udarce bez pomeranja ili
ubrzavanja govora. Izlaz: src/timeline.json (koriste ga Remotion i audio miks).
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30
BEAT = 0.6
DURATION = 81.0

words = json.load(open(os.path.join(ROOT, "data/words_takeA.json"), encoding="utf-8"))

# Rezovi u tišinama između scena (sekunde u originalnoj take A, -45 dB silencedetect)
CUTS = [0.0, 6.05, 13.76, 26.55, 35.91, 45.80, 58.41, 67.58, 74.449]
# Početak svake scene na video vremenskoj liniji (mreža od 0,6 s)
SCENE_STARTS = [0.0, 6.6, 15.0, 28.2, 38.4, 48.6, 61.8, 71.4]
# Prva scena: naracija kreće 0,2 s posle mekog udara
VO_OFFSETS = [0.2, 0, 0, 0, 0, 0, 0, 0]

segments = []
for i in range(8):
    src_in, src_out = CUTS[i], CUTS[i + 1]
    start = SCENE_STARTS[i] + VO_OFFSETS[i]
    end = start + (src_out - src_in)
    if i < 7:
        assert end <= SCENE_STARTS[i + 1] - 0.15, (i, end, SCENE_STARTS[i + 1])
    segments.append({"scene": i + 1, "srcIn": src_in, "srcOut": src_out,
                     "start": round(start, 3), "end": round(end, 3)})


def to_video(t):
    for s in segments:
        if s["srcIn"] <= t < s["srcOut"]:
            return s["start"] + (t - s["srcIn"])
    raise ValueError(t)


vwords = [{"w": w, "s": round(to_video(a), 3), "e": round(to_video(b), 3)} for w, a, b in words]

scenes = []
for i in range(8):
    a = SCENE_STARTS[i]
    b = SCENE_STARTS[i + 1] if i < 7 else DURATION
    scenes.append({"id": i + 1, "start": a, "end": b,
                   "from": round(a * FPS), "durationInFrames": round((b - a) * FPS)})


def first(word, after=0.0):
    for w in vwords:
        if w["w"].lower().strip(".,?:!") == word and w["s"] >= after:
            return w["s"]
    raise KeyError(word)


CUE_WORDS = {
    "trke": ("trke", 0), "odgovor": ("odgovor", 0), "nitratiS1": ("nitrati", 4.0),
    "imaIh": ("ima", 0), "cvekli": ("cvekli", 0), "zelenom": ("zelenom", 0),
    "njihov": ("njihov", 0), "preradi": ("preradi", 0),
    "bakterije": ("bakterije", 0), "pretvaranju": ("pretvaranju", 0), "nitrite": ("nitrite", 0),
    "izNjih": ("iz", 20), "azotMonoksid": ("azot-monoksid", 0), "molekul": ("molekul", 0),
    "protoka": ("protoka", 0), "radu": ("radu", 0),
    "kodNekih": ("kod", 0), "manju": ("manju", 0), "kiseonika": ("kiseonika", 0),
    "istom": ("istom", 0), "drugim": ("drugim", 0), "ekonomicnostS4": ("ekonomičnost", 0),
    "ali": ("ali", 0), "garantuje": ("garantuje", 0), "istrazivanja": ("istraživanja", 0),
    "odgovorS5": ("odgovor", 45), "osobe": ("osobe", 0),
    "jedan": ("jedan", 0), "sest": ("šest", 0), "milimola": ("milimola", 0), "dva": ("dva", 0),
    "napora": ("napora", 0), "gledaj": ("gledaj", 0), "deklarisanu": ("deklarisanu", 0),
    "samo": ("samo", 0), "soka": ("soka", 0),
    "antibakterijska": ("antibakterijska", 0), "oslabiti": ("oslabiti", 0),
    "aSok": ("sok", 66), "treningu": ("treningu", 0), "stomaku": ("stomaku", 0),
    "nitratiS8": ("nitrati", 70), "mali": ("mali", 0), "sacuvaj": ("sačuvaj", 0), "deluju": ("deluju", 0),
}
cues = {k: round(first(w, a), 3) for k, (w, a) in CUE_WORDS.items()}

# ---------- Titlovi: kratke smislene celine, najviše 2 reda ----------
MAX_EVENT = 56
MAX_LINE = 30
CLITIC = {"u", "i", "a", "od", "do", "za", "na", "pri", "iz", "se", "je", "da", "sa", "s", "o", "po", "koji", "kako", "ne", "to", "ovu", "ovaj"}


def text_of(ws):
    return " ".join(w["w"] for w in ws)


def split_event(ws):
    """Deli rečenicu na celine <= MAX_EVENT, prvo po zarezu/dvotačci najbližoj sredini."""
    if len(text_of(ws)) <= MAX_EVENT:
        return [ws]
    total = len(text_of(ws))
    best, best_score = None, None
    for i in range(1, len(ws)):
        left = len(text_of(ws[:i]))
        punct = ws[i - 1]["w"][-1] in ",:;"
        dangling = ws[i - 1]["w"].lower() in CLITIC
        fits = len(text_of(ws[:i])) <= MAX_EVENT and len(text_of(ws[i:])) <= MAX_EVENT
        score = abs(left - total / 2) - (1000 if punct else 0) + (500 if dangling else 0) - (200 if fits else 0)
        if best_score is None or score < best_score:
            best, best_score = i, score
    return split_event(ws[:best]) + split_event(ws[best:])


def split_lines(ws):
    t = text_of(ws)
    if len(t) <= MAX_LINE:
        return [t]
    best, best_score = 1, None
    for i in range(1, len(ws)):
        a, b = text_of(ws[:i]), text_of(ws[i:])
        dangling = ws[i - 1]["w"].lower() in CLITIC
        score = max(len(a), len(b)) + (0 if len(a) <= MAX_LINE and len(b) <= MAX_LINE else 100) + (40 if dangling else 0)
        if best_score is None or score < best_score:
            best, best_score = i, score
    return [text_of(ws[:best]), text_of(ws[best:])]


sentences, cur = [], []
for w in vwords:
    cur.append(w)
    if w["w"][-1] in ".?!":
        sentences.append(cur)
        cur = []
if cur:
    sentences.append(cur)

events = [e for s in sentences for e in split_event(s)]
subs = []
for i, ev in enumerate(events):
    start = ev[0]["s"] - 0.06
    end = ev[-1]["e"] + 0.32
    if i + 1 < len(events):
        end = min(end, events[i + 1][0]["s"] - 0.06)
    if end - start < 0.9 and i + 1 < len(events):
        end = min(start + 0.9, events[i + 1][0]["s"] - 0.06)
    subs.append({"start": round(start, 3), "end": round(end, 3), "lines": split_lines(ev),
                 "words": [w["w"] for w in ev]})

out = {"fps": FPS, "beat": BEAT, "duration": DURATION, "durationInFrames": round(DURATION * FPS),
       "segments": segments, "scenes": scenes, "words": vwords, "cues": cues, "subs": subs}


def srt_time(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


with open(os.path.join(ROOT, "data/nitrati_trcanje_subtitles.srt"), "w", encoding="utf-8") as f:
    for i, s in enumerate(subs, 1):
        f.write(f"{i}\n{srt_time(s['start'])} --> {srt_time(s['end'])}\n" + "\n".join(s["lines"]) + "\n\n")
for s in subs:
    print(f"{s['start']:6.2f}-{s['end']:6.2f}  " + " | ".join(s["lines"]))
with open(os.path.join(ROOT, "src/timeline.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
for s in segments:
    print(s)
print(cues)
