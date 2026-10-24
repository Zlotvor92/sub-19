"""Audio miks reela: naracija (take A) + originalna muzika + zvučni efekti.

- Naracija se postavlja po segmentima iz src/timeline.json (rezovi samo u tišinama,
  bez ubrzavanja), sa kratkim pretapanjem na ivicama.
- Muzika se automatski spušta ispod govora (ducking sa glatkim napadom/otpuštanjem).
- Zvučni efekti su vezani za iste znake (cue) koje koristi animacija.
Izlaz: build/premaster.wav, build/voiceover_timeline.wav (48 kHz)
Mastering (-14 LUFS, TP <= -1 dBTP) radi scripts/master.sh.
"""
import json
import os
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
TL = json.load(open(os.path.join(ROOT, "src/timeline.json"), encoding="utf-8"))
N = int(TL["duration"] * SR)
FPS = TL["fps"]
A = os.path.join(ROOT, "assets/audio")
BUILD = os.path.join(ROOT, "build")
os.makedirs(BUILD, exist_ok=True)


def load(path, ch=1):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", str(ch), "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    return x.reshape(-1, ch) if ch > 1 else x


def sos(kind, fc, order=2):
    return butter(order, fc, kind, fs=SR, output="sos")


def db(x):
    return 10 ** (x / 20)


def place(buf, sig, t, gain=1.0):
    i = int(round(t * SR))
    if i < 0:
        sig = sig[-i:]
        i = 0
    j = min(len(buf), i + len(sig))
    if j > i:
        buf[i:j] += sig[: j - i] * gain


def fade_edges(x, ms=15):
    n = int(ms / 1000 * SR)
    x = x.copy()
    x[:n] *= np.linspace(0, 1, n)
    x[-n:] *= np.linspace(1, 0, n)
    return x


def lufs_like(x):
    """Gruba procena glasnoće (RMS iznad praga), za relativno usklađivanje pre masteringa."""
    k = sosfilt(sos("high", 100), x)
    w = int(0.4 * SR)
    blocks = [np.mean(k[i:i + w] ** 2) for i in range(0, len(k) - w, w // 4)]
    blocks = np.array([b for b in blocks if b > 1e-7])
    return 10 * np.log10(np.mean(blocks)) if len(blocks) else -99


# ------------------------------------------------------------------ naracija
vo_src = load(os.path.join(A, "voiceover_elevenlabs_v4_takeA.mp3"))
vo_src = sosfilt(sos("high", 70), vo_src)
vo = np.zeros(N)
for s in TL["segments"]:
    a, b = int(s["srcIn"] * SR), int(min(len(vo_src), s["srcOut"] * SR))
    place(vo, fade_edges(vo_src[a:b]), s["start"])


def voice_chain(x):
    """Kompresor (RMS, 2,5:1, meko koleno) + limiter sa predviđanjem za vrhove suglasnika."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    x = x / (np.max(np.abs(x)) + 1e-12)
    hop = SR // 1000  # kontrolni signal na 1 ms
    rms = np.sqrt(np.maximum(uniform_filter1d(x ** 2, int(0.015 * SR)), 0.0))[::hop]
    lvl = 20 * np.log10(rms + 1e-9)
    thr, ratio, knee = -24.0, 2.5, 6.0
    over = lvl - thr
    gr = np.where(over <= -knee / 2, 0.0,
                  np.where(over >= knee / 2, over * (1 - 1 / ratio),
                           (1 - 1 / ratio) * (over + knee / 2) ** 2 / (2 * knee)))
    g = np.empty_like(gr)
    cur = 0.0
    aa, ar = np.exp(-1 / 5.0), np.exp(-1 / 120.0)
    for i, v in enumerate(gr):
        a = aa if v > cur else ar
        cur = a * cur + (1 - a) * v
        g[i] = cur
    gain = db(-np.interp(np.arange(len(x)) / hop, np.arange(len(g)), g))
    y = x * gain
    lim = db(-8.0) * np.max(np.abs(y))
    need = np.minimum(1.0, lim / (np.abs(y) + 1e-12))
    la = int(0.003 * SR)
    need = minimum_filter1d(need, 2 * la + 1)
    need = uniform_filter1d(need, la + 1)
    return y * need


vo = voice_chain(vo)
vo *= db(-16 - lufs_like(vo))

# ------------------------------------------------------------------ zvučni efekti
def sfx(name):
    x = load(os.path.join(A, "sfx", name))
    x = x / (np.max(np.abs(x)) + 1e-9)
    return x


def chime(freq, ln=1.4):
    n = int(ln * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * freq * 2.0 * t) * 1.4 * np.exp(-t / 0.25)
    s = np.sin(2 * np.pi * freq * t + mod) * np.exp(-t / 0.45)
    s += 0.35 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t / 0.2)
    return s * np.minimum(1, t / 0.003) * 0.6


def tick(freq=587.33, ln=0.3):
    n = int(ln * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.06)
    click = sosfilt(sos("high", 3000), np.random.default_rng(3).standard_normal(n)) * np.exp(-t / 0.004) * 0.3
    return (body + click) * 0.7


HIT = sfx("hit_eSaebO0Tc8dZBo80nBn6.mp3")
DROP = sfx("drop_mn73muCbpA0gN68P5LBQ.mp3")
WHOOSH = sfx("whoosh_4yrH27FCM3RxVRnADrlK.mp3")
SWISH = sfx("swish_fXLFmlukJnBNvklTrTlh.mp3")
WHOOSH_SOFT = sosfilt(sos("low", 3500), WHOOSH)
WH_PEAK = 0.17  # vrh whoosh-a u fajlu (s)

cue = TL["cues"]
sc = {s["id"]: s["start"] for s in TL["scenes"]}
fx = np.zeros(N)
events = [
    (HIT, 0.0, -9),
    (DROP, 8 / FPS - 0.10, -12),                                  # kap u čašu (S1_DROP = 8)
    (chime(880.0), cue["nitratiS1"] - 0.12, -21),                 # isticanje čestice
    (WHOOSH, sc[2] - 0.12 - WH_PEAK, -15),                        # čestica -> molekul
    (chime(659.25), cue["njihov"] + 0.05, -24),                   # pojava molekula NO3-
    (WHOOSH_SOFT, sc[3] - 0.25 - WH_PEAK, -21),                   # molekul vodi u usta
    (chime(987.77), cue["nitrite"] - 10 / FPS + 0.2, -19),       # NO3- -> NO2-
    (WHOOSH_SOFT, sc[3] + 150 / FPS - WH_PEAK, -25),              # „gutanje"
    (chime(1174.66), cue["azotMonoksid"] - 8 / FPS + 0.15, -19),  # NO2- -> NO
    (WHOOSH, sc[4] - 0.3 - WH_PEAK, -16),                         # krvni sud -> staza
    (WHOOSH_SOFT, sc[5] + 0.05 - WH_PEAK, -19),                   # povlačenje kamere (S5)
    (tick(587.33), cue["sest"] - 4 / FPS, -15),                   # 6–8 mmol
    (tick(659.25), cue["milimola"] + 8 / FPS, -15),               # ≈ 370–500 mg
    (WHOOSH_SOFT, cue["dva"] - 6 / FPS + 0.1 - WH_PEAK, -22),     # lupa -> sat
    (tick(880.0), cue["dva"] + 6 / FPS, -15),                     # 2–3 sata
    (SWISH, sc[7] + 18 / FPS, -17),                               # vodica preko bakterija
    (WHOOSH, cue["aSok"] - 12 / FPS + 0.15 - WH_PEAK, -17),       # prelaz na trening
    (WHOOSH_SOFT, sc[8] + 0.05 - WH_PEAK, -20),                   # povratak na početni kadar
]
for sig, t, g in events:
    place(fx, sig, t, db(g))
fx_level = 1.0  # nivoi efekata su zadati u dB u listi događaja

# ------------------------------------------------------------------ muzika + ducking
mus = load(os.path.join(ROOT, "public/audio/music.wav"), ch=2)[:N]
if len(mus) < N:
    mus = np.vstack([mus, np.zeros((N - len(mus), 2))])
low_shelf = sosfilt(sos("low", 90), mus, axis=0)
mus = mus - 0.45 * low_shelf  # ~-5 dB ispod 90 Hz (manje maskiranja na telefonu)
mus = sosfilt(sos("high", 35), mus, axis=0)
mus *= db(-22 - lufs_like(mus.mean(axis=1)))

w = int(0.02 * SR)
env = np.sqrt(np.convolve(vo ** 2, np.ones(w) / w, mode="same"))
speech = (env > db(-45)).astype(float)
# zadrška preko kratkih pauza unutar rečenice
hold = int(0.9 * SR)
speech = np.convolve(speech, np.ones(hold), mode="same") > 0
target = np.where(speech, db(-7.0), 1.0)
# glatko: napad ~120 ms, otpuštanje ~600 ms (jednopolni filteri, unapred i unazad)
g = np.empty(N)
a_att = np.exp(-1 / (0.15 * SR))
a_rel = np.exp(-1 / (0.7 * SR))
cur = 1.0
for i in range(N):
    tg = target[i]
    a = a_att if tg < cur else a_rel
    cur = a * cur + (1 - a) * tg
    g[i] = cur
mus *= g[:, None]

# ------------------------------------------------------------------ zbir
mix = np.zeros((N, 2))
mix += vo[:, None]
mix += fx[:, None] * fx_level
mix += mus
peak = np.max(np.abs(mix))
mix *= db(-3) / peak
wavfile.write(os.path.join(BUILD, "premaster.wav"), SR, mix.astype(np.float32))
vo_out = vo / (np.max(np.abs(vo)) + 1e-9) * db(-1)
wavfile.write(os.path.join(BUILD, "voiceover_timeline.wav"), SR, vo_out.astype(np.float32))
np.save(os.path.join(BUILD, "duck_gain.npy"), g[:: SR // 100])
print("premaster peak-normalized; duck min", g.min())
