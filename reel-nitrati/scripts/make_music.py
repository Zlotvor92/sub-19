"""Originalna instrumentalna podloga za reel (100 BPM, d-mol), sintetizovana kodom.

Bez semplova i tuđeg materijala: svi zvuci (pad, bas, bubanj, činele, arpeđo,
zvono) nastaju aditivnom/FM sintezom i filtriranim šumom. Struktura prati
vremensku liniju montaže (src/timeline.json): ulaz, puls, puni deo u sceni 4,
smirivanje u sceni 5, povratak ritma u sceni 6 i nameran završni akord.

Izlaz: public/audio/music.wav (48 kHz, stereo, 32-bit float)
"""
import json
import os

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
BPM = 100
BEAT = 60 / BPM
TL = json.load(open(os.path.join(ROOT, "src/timeline.json"), encoding="utf-8"))
DUR = TL["duration"]
N = int(DUR * SR)
rng = np.random.default_rng(20261024)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def t_of(b):
    return b * BEAT


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, "low", fs=SR, output="sos"), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def place(buf, sig, t, gain=1.0):
    i = int(round(t * SR))
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def saw_additive(freq, n, detune_cents=0.0, kmax_hz=7000, phase=0.0):
    f = freq * 2 ** (detune_cents / 1200)
    t = np.arange(n) / SR
    out = np.zeros(n)
    K = max(1, int(kmax_hz // f))
    for k in range(1, K + 1):
        out += np.sin(2 * np.pi * k * f * t + phase * k) / k
    return out * 0.55


# ---------------------------------------------------------------- harmonija
CH = {
    "Dm": {"bass": 38, "pad": [53, 57, 60, 64], "arp": [62, 65, 69, 72, 76]},
    "Bb": {"bass": 34, "pad": [53, 57, 60, 62], "arp": [62, 65, 69, 70, 74]},
    "F": {"bass": 41, "pad": [53, 57, 60, 67], "arp": [65, 69, 72, 77, 79]},
    "C": {"bass": 36, "pad": [52, 55, 60, 62], "arp": [64, 67, 72, 74, 79]},
}
BARS = ["Dm", "Bb", "F", "C"] * 4 + ["Dm", "Dm", "Bb", "Bb"] + ["Dm", "Bb", "F", "C"] * 3 + ["Bb", "Dm"]
NB = len(BARS)  # 34 takta

# sekcije po udarcima (vidi docstring)
S_A, S_B, S_C, S_BREAK, S_D, S_E, S_OUT, S_STOP, S_FINAL = 11, 25, 47, 64, 81, 103, 119, 128, 132


def chord_at_beat(b):
    return CH[BARS[min(NB - 1, int(b // 4))]]


# ---------------------------------------------------------------- bubanj
def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 48 + 95 * np.exp(-t / 0.032)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.26)
    click = hp(rng.standard_normal(n), 2500) * np.exp(-t / 0.004) * 0.25
    return np.tanh(1.4 * (body + click)) * 0.9


def clap():
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    noise = bp(rng.standard_normal(n), 900, 3200)
    env = np.zeros(n)
    for d in (0.0, 0.011, 0.022):
        env += (t >= d) * np.exp(-np.clip(t - d, 0, None) / 0.012)
    env += (t >= 0.03) * np.exp(-np.clip(t - 0.03, 0, None) / 0.16) * 0.8
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.4
    return (noise * env * 0.5 + body) * 0.55


def hat(open_=False):
    n = int((0.35 if open_ else 0.08) * SR)
    t = np.arange(n) / SR
    noise = hp(rng.standard_normal(n), 7500, 3)
    return noise * np.exp(-t / (0.16 if open_ else 0.022)) * 0.35


K, CL, HC, HO = kick(), clap(), hat(), hat(True)

drums = np.zeros(N)
kick_env = np.zeros(N)
kenv = np.exp(-np.arange(int(0.42 * SR)) / SR / 0.13)
total_beats = int(DUR / BEAT) + 1


def drums_on(b):
    return (S_A <= b < S_BREAK) or (S_D <= b < S_STOP)


for b in range(total_beats):
    t0 = t_of(b)
    if not drums_on(b):
        continue
    inbar = b % 4
    if inbar in (0, 2) or (b >= S_C and b < S_BREAK and inbar == 3 and (b // 4) % 2 == 1):
        g = 0.9 if inbar == 0 else 0.75
        place(drums, K, t0, g)
        place(kick_env, kenv, t0, 1.0)
    if (S_B <= b < S_BREAK or S_D <= b < S_STOP) and inbar in (1, 3):
        place(drums, CL, t0, 0.42)
    for s in range(4):
        vel = [0.8, 0.35, 0.6, 0.35][s]
        if b >= S_E:
            vel *= 0.8
        place(drums, HC, t0 + s * BEAT / 4, vel * 0.55)
    if S_C <= b < S_BREAK or (S_D + 4 <= b < S_E):
        place(drums, HO, t0 + BEAT / 2, 0.3)

kick_env = np.clip(kick_env, 0, 1)
duck = 1 - 0.38 * kick_env  # pumpanje pada i basa uz kik

# ---------------------------------------------------------------- pad
pad = np.zeros((N, 2))
xf = 0.9  # preklapanje akorada (s)
for bar, name in enumerate(BARS):
    c = CH[name]
    t0 = bar * 4 * BEAT
    if t0 >= DUR:
        break
    length = 4 * BEAT + xf
    if bar == NB - 1:  # završni akord zvoni do kraja
        length = DUR - t0
    n = int(length * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.5) * np.minimum(1, np.clip((length - t) / xf, 0, 1))
    if bar == NB - 1:
        env = np.minimum(1, t / 0.08) * np.exp(-t / 2.4)
    for ch, det in ((0, (-8, 0, 7)), (1, (-6, 1, 9))):
        s = np.zeros(n)
        for m in c["pad"]:
            for d in det:
                s += saw_additive(mtof(m), n, d, kmax_hz=5000, phase=rng.uniform(0, 6.28))
        b0 = bar * 4
        if b0 < S_A:
            cutoff = 700 + 900 * (b0 / S_A)
        elif S_BREAK <= b0 < S_D:
            cutoff = 900
        elif S_C <= b0 < S_BREAK:
            cutoff = 2200
        else:
            cutoff = 1700
        s = lp(s, cutoff, 2)
        place(pad[:, ch], s * env, t0, 0.055)
pad[:, 0] *= duck
pad[:, 1] *= duck

# ---------------------------------------------------------------- bas
bass = np.zeros(N)
for b in range(total_beats):
    for half in range(2):
        tt = t_of(b) + half * BEAT / 2
        if tt >= DUR:
            continue
        c = chord_at_beat(b)
        f0 = mtof(c["bass"] - 12 if c["bass"] > 36 else c["bass"])
        pulse = drums_on(b)
        if not pulse and half == 1:
            continue
        ln = BEAT / 2 * 0.86 if pulse else BEAT * 1.02
        n = int(ln * SR)
        t = np.arange(n) / SR
        env = np.minimum(1, t / 0.006) * np.minimum(1, (ln - t) / 0.02)
        if pulse:
            env *= 0.75 + 0.25 * np.exp(-t / 0.08)
        sig = np.sin(2 * np.pi * f0 * t) + 0.18 * np.sin(4 * np.pi * f0 * t) + 0.06 * np.sin(6 * np.pi * f0 * t)
        g = 0.34 if pulse else 0.22
        if b >= S_FINAL:
            continue
        place(bass, np.tanh(1.2 * sig) * env, tt, g)
final_bass_n = int((DUR - t_of(S_FINAL)) * SR)
tb = np.arange(final_bass_n) / SR
place(bass, np.sin(2 * np.pi * mtof(38 - 12 + 12) * tb) * np.exp(-tb / 1.8) * np.minimum(1, tb / 0.02), t_of(S_FINAL), 0.32)
bass *= duck

# ---------------------------------------------------------------- arpeđo (plucks)
def pluck(freq, ln=0.42):
    n = int(ln * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k in range(1, 14):
        if k * freq > 9000:
            break
        out += np.sin(2 * np.pi * k * freq * t) / k * np.exp(-t * (5 + 2.2 * k))
    return out * np.minimum(1, t / 0.003)


arp = np.zeros((N, 2))
pattern = [0, 2, 1, 3, 2, 4, 3, 1]
for b in range(total_beats):
    pulse_intro = 2 <= b < S_A
    on = (S_B <= b < S_BREAK) or (S_D <= b < S_OUT + 6)
    if not (on or pulse_intro):
        continue
    c = chord_at_beat(b)
    for s in range(4 if on else 2):
        idx = pattern[(b * 4 + s) % len(pattern)] if on else 0
        note = c["arp"][idx] if on else c["arp"][0] - 12
        tt = t_of(b) + s * (BEAT / 4 if on else BEAT / 2)
        g = 0.07 if on else 0.05
        if b >= S_E and b < S_OUT:
            g *= 0.75
        if b >= S_OUT:
            g *= max(0.0, 1 - (b - S_OUT) / 6)
        pan = 0.35 if (s % 2) else -0.35
        p = pluck(mtof(note))
        place(arp[:, 0], p, tt, g * (1 - pan) * 0.7)
        place(arp[:, 1], p, tt, g * (1 + pan) * 0.7)
# ping-pong eho (tačkasta osmina)
dly = int(0.75 * BEAT * SR)
echo = np.zeros_like(arp)
src = lp(arp.sum(axis=1), 3500)
for rep, g in ((1, 0.32), (2, 0.18), (3, 0.09)):
    ch = rep % 2
    echo[rep * dly:, ch] += src[: N - rep * dly] * g
arp += echo

# ---------------------------------------------------------------- zvona (smirivanje i kraj)
def bell(freq, ln=3.0, idx=2.2):
    n = int(ln * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * freq * 3.5 * t) * idx * np.exp(-t / 0.6)
    return np.sin(2 * np.pi * freq * t + mod) * np.exp(-t / 1.1) * np.minimum(1, t / 0.004)


bells = np.zeros((N, 2))
for b, m in ((64, 76), (66.5, 72), (68, 69), (70, 74), (72, 74), (74.5, 70), (76, 69), (78, 72)):
    s = bell(mtof(m))
    place(bells[:, 0], s, t_of(b), 0.05)
    place(bells[:, 1], s, t_of(b) + 0.012, 0.05)
for m, d in ((74, 0.0), (69, 0.03), (77, 0.06)):
    s = bell(mtof(m), ln=DUR - t_of(S_FINAL), idx=1.6)
    place(bells[:, 0], s, t_of(S_FINAL) + d, 0.045)
    place(bells[:, 1], s, t_of(S_FINAL) + d + 0.01, 0.045)

# ---------------------------------------------------------------- prelazi: šumni „swell" pred scene 4 i 6
swells = np.zeros(N)
for b_end in (S_C, S_D):
    ln = 4 * BEAT
    n = int(ln * SR)
    t = np.arange(n) / SR
    nz = bp(rng.standard_normal(n), 1500, 6000) * (t / ln) ** 2.5
    place(swells, nz, t_of(b_end) - ln, 0.07)

# ---------------------------------------------------------------- reverb i master
def make_ir(rt60=2.1, ln=2.6):
    n = int(ln * SR)
    t = np.arange(n) / SR
    env = 10 ** (-3 * t / rt60)
    irl = lp(rng.standard_normal(n), 5000) * env
    irr = lp(rng.standard_normal(n), 5000) * env
    return irl / np.sqrt(np.sum(irl ** 2)), irr / np.sqrt(np.sum(irr ** 2))


irl, irr = make_ir()
send = pad * 0.6 + arp * 0.8 + bells * 1.0
send[:, 0] += 0.15 * hp(drums, 400)
send[:, 1] += 0.15 * hp(drums, 400)
rev = np.stack([fftconvolve(send[:, 0], irl)[:N], fftconvolve(send[:, 1], irr)[:N]], axis=1)

mix = pad + arp + bells
mix[:, 0] += drums + bass + swells
mix[:, 1] += drums + bass + swells
mix += rev * 0.32

# nameran kraj: završni akord na udarcu 132 (79,2 s), tihi rep i kosinusni izlaz
fade_start = t_of(S_FINAL) + 0.25
i0 = int(fade_start * SR)
fl = N - i0
mix[i0:] *= (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, fl)))[:, None]
mix[:int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))[:, None]

mix = hp(mix.T, 28).T
mix = np.tanh(mix * 1.1) / 1.1
mix *= 10 ** (-1.0 / 20) / np.max(np.abs(mix))
os.makedirs(os.path.join(ROOT, "public/audio"), exist_ok=True)
wavfile.write(os.path.join(ROOT, "public/audio/music.wav"), SR, mix.astype(np.float32))
print("music.wav", mix.shape, "peak", np.max(np.abs(mix)))
