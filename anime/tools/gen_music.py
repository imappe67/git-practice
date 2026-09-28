#!/usr/bin/env python3
"""Score for 「ほしまいご」 — fully synthesized, no samples.

Usage: python3 tools/gen_music.py [--no-stems]
Outputs:
  audio/music.wav               60.0 s, 48 kHz, stereo, 24-bit, peak -3 dBFS
  audio/music_stems/<bus>.wav   per-bus stems (same master processing; they sum to music.wav)
Prints a cue sheet.

Key: D-flat major (star theme = sol-do-re-mi-re-do), finale modulates up to E-flat.
Tempo ~76 BPM rubato; montage (31-41.5 s) at 114.3 BPM = exactly 5 bars.

Synthesis: additive piano with inharmonic partials + detuned string pairs,
modal music box / celesta / glockenspiel / chimes, Karplus-Strong (with
fractional-delay allpass tuning) koto / harp / pizzicato, polyBLEP saw
ensembles + chorus for strings and pads, formant-filtered saw choir,
breath-noise flute, synthesized taiko / shime / shaker / cymbals, and a
stereo 3-band exponentially-decaying noise-IR convolution reverb.
"""
import argparse
import pathlib
import re
import time

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import maximum_filter1d, minimum_filter1d

ROOT = pathlib.Path(__file__).resolve().parent.parent
SR = 48000
DUR = 60.0
N = int(SR * DUR)
RNG = np.random.default_rng(20260928)
TWOPI = 2 * np.pi

# dialogue windows (start, end) from story/timeline.json + audio/voice/lipsync.json
DIALOGUE = [(3.0, 6.34), (8.2, 12.51), (14.3, 19.39), (20.0, 22.19), (24.2, 27.82),
            (28.6, 29.96), (32.2, 34.46), (36.5, 37.38), (42.0, 45.21), (46.0, 47.63),
            (48.2, 52.45), (53.8, 54.45)]

# ----------------------------------------------------------------------------- utils
_NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def m(name):
    """'Db4' -> midi number (C4 = 60)."""
    mt = re.fullmatch(r"([A-G])([b#]?)(-?\d)", name)
    if not mt:
        raise ValueError(name)
    v = _NOTE[mt.group(1)] + {"": 0, "b": -1, "#": 1}[mt.group(2)]
    return v + 12 * (int(mt.group(3)) + 1)


def hz(x):
    if isinstance(x, str):
        x = m(x)
    return 440.0 * 2 ** ((x - 69) / 12)


def sos_lp(fc, order=2):
    return signal.butter(order, min(fc, SR * 0.45), "low", fs=SR, output="sos")


def sos_hp(fc, order=2):
    return signal.butter(order, fc, "high", fs=SR, output="sos")


def sos_bp(lo, hi, order=2):
    return signal.butter(order, [lo, min(hi, SR * 0.45)], "band", fs=SR, output="sos")


def adsr(L, a, d, s, r, hold):
    """Envelope of L samples: attack a, decay d to sustain s, release r after hold (s)."""
    t = np.arange(L) / SR
    env = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = np.clip((t - hold) / max(r, 1e-4), 0, None)
    env = env * np.exp(-4.0 * rel) * (t < hold + r * 1.6)
    # smooth the attack corner
    return env


def fade_edges(y, a=0.002, r=0.01):
    na, nr = int(a * SR), int(r * SR)
    if na > 0:
        y[:na] *= np.linspace(0, 1, na)
    if nr > 0 and len(y) > nr:
        y[-nr:] *= np.linspace(1, 0, nr)
    return y


def interp_env(points, t):
    """piecewise-linear automation: points = [(time, value), ...]"""
    p = np.array(points, dtype=float)
    return np.interp(t, p[:, 0], p[:, 1])


# ----------------------------------------------------------------------------- buses
class Bus:
    def __init__(self, name, send, width=1.0):
        self.name = name
        self.send = send
        self.buf = np.zeros((2, N))
        self.width = width

    def add(self, y, t0, pan=0.0, gain=1.0):
        """y mono (L,) or stereo (2, L). pan -1..1 equal power."""
        i0 = int(round(t0 * SR))
        if y.ndim == 1:
            th = (pan * self.width + 1) * np.pi / 4
            y = np.vstack([y * np.cos(th), y * np.sin(th)]) * np.sqrt(2)
        L = y.shape[1]
        s0 = max(i0, 0)
        s1 = min(i0 + L, N)
        if s1 <= s0:
            return
        self.buf[:, s0:s1] += gain * y[:, s0 - i0:s1 - i0]


BUSES = {}


def bus(name):
    return BUSES[name]


def make_buses():
    for name, send, width in [("pad", 0.55, 1.0), ("strings", 0.38, 1.0), ("piano", 0.30, 0.8),
                              ("bells", 0.55, 1.0), ("plucks", 0.28, 1.0), ("flute", 0.32, 0.6),
                              ("choir", 0.55, 1.0), ("perc", 0.14, 1.0)]:
        BUSES[name] = Bus(name, send, width)


# ----------------------------------------------------------------------------- oscillators
def blep_saw(freq, phase0=None):
    """Band-limited sawtooth via polyBLEP, freq is per-sample array (Hz)."""
    dt = freq / SR
    ph = np.cumsum(dt) + (RNG.random() if phase0 is None else phase0)
    ph %= 1.0
    y = 2 * ph - 1
    msk = ph < dt
    x = ph[msk] / dt[msk]
    y[msk] -= x + x - x * x - 1
    msk = ph > 1 - dt
    x = (ph[msk] - 1) / dt[msk]
    y[msk] -= x * x + x + x + 1
    return y


def vibrato(L, rate, depth_semi, delay=0.35, ramp=0.6, drift=3.0):
    t = np.arange(L) / SR
    dep = depth_semi * np.clip((t - delay) / ramp, 0, 1)
    ratej = rate * (1 + 0.04 * np.sin(TWOPI * 0.23 * t + RNG.random() * 6))
    ph = np.cumsum(TWOPI * ratej / SR) + RNG.random() * 6
    # slow random pitch drift (cents)
    nd = RNG.standard_normal(L // 2400 + 3)
    dr = np.interp(t, np.arange(len(nd)) * 0.05, nd) * drift
    return 2 ** ((dep * np.sin(ph)) / 12 + dr / 1200)


# ----------------------------------------------------------------------------- instruments
def modal(f0, partials, length, attack=0.0015, click=0.0):
    L = int(length * SR)
    t = np.arange(L) / SR
    y = np.zeros(L)
    for r, a, tau in partials:
        f = f0 * r
        if f > 17000:
            continue
        y += a * np.sin(TWOPI * f * t + RNG.random() * 6) * np.exp(-t / tau)
    na = max(int(attack * SR), 2)
    y[:na] *= np.linspace(0, 1, na) ** 1.5
    if click > 0:
        nc = int(0.004 * SR)
        c = signal.sosfilt(sos_hp(3000), RNG.standard_normal(nc)) * np.exp(-np.arange(nc) / (0.0008 * SR))
        y[:nc] += click * c
    return fade_edges(y, 0, 0.02)


def music_box(f0, vel=0.6):
    p = [(1, 1.0, 2.4), (1.0016, 0.35, 2.0), (2.0, 0.22, 0.9), (3.0, 0.05, 0.5),
         (5.4, 0.12, 0.14), (8.93, 0.06, 0.05)]
    return vel * modal(f0, p, 3.2, 0.001, click=0.25)


def celesta(f0, vel=0.5):
    p = [(1, 1.0, 1.3), (1.0023, 0.25, 1.1), (2, 0.12, 0.6), (3, 0.04, 0.3), (4, 0.28, 0.35)]
    return vel * modal(f0, p, 2.2, 0.002, click=0.08)


def glock(f0, vel=0.5):
    p = [(1, 1.0, 1.8), (2.76, 0.30, 0.5), (5.40, 0.16, 0.18), (8.93, 0.08, 0.07)]
    return vel * modal(f0, p, 2.6, 0.0012, click=0.12)


def chime(f0, vel=0.5, length=5.0):
    p = [(0.5, 0.08, 3.5), (1, 1.0, 3.6), (1.0012, 0.4, 3.2), (2.0, 0.45, 2.2), (3.0, 0.2, 1.2),
         (4.16, 0.16, 0.8), (5.43, 0.12, 0.45), (6.79, 0.06, 0.25)]
    return vel * modal(f0, p, length, 0.002, click=0.05)


def piano(f0, hold, vel=0.5):
    tail = 0.45
    L = int((hold + tail) * SR)
    t = np.arange(L) / SR
    B = 0.00012 * (f0 / 130.0) ** 1.2
    bright = 0.6 + 2.2 * vel
    tau_base = float(np.clip(5.5 * (220 / f0) ** 0.65, 0.5, 11))
    y = np.zeros(L)
    nmax = int(min(28, 11000 / f0))
    for n in range(1, nmax + 1):
        fn = n * f0 * np.sqrt(1 + B * n * n)
        if fn > 15000:
            break
        a = (1.0 / n) * np.exp(-(n - 1) / bright) * (abs(np.sin(np.pi * n / 7.3)) + 0.15)
        tau1 = tau_base / (1 + 0.35 * (n - 1))
        env = 0.65 * np.exp(-t / (tau1 * 0.28)) + 0.35 * np.exp(-t / (tau1 * 1.6))
        d = 1 + (0.00035 + 0.00004 * n) * (1 if n % 2 else -1)
        ph = RNG.random() * 6
        y += a * env * (np.sin(TWOPI * fn * t + ph) + 0.8 * np.sin(TWOPI * fn * d * t + ph + 0.3))
    # soundboard-ish body: gentle low-mid resonance via small lowpassed copy
    y += 0.15 * signal.sosfilt(sos_lp(600), y)
    # hammer thump
    nh = int(0.012 * SR)
    ham = signal.sosfilt(sos_bp(200, 2500), RNG.standard_normal(nh)) * np.exp(-np.arange(nh) / (0.002 * SR))
    y[:nh] += 0.35 * vel * ham
    na = int(0.0015 * SR)
    y[:na] *= np.linspace(0, 1, na)
    # damper
    rel = t > hold
    y[rel] *= np.exp(-(t[rel] - hold) / 0.09)
    return fade_edges(y * (0.25 + vel) * 0.35, 0, 0.02)


def ks_pluck(f0, length, decay, bright=0.5, pos=0.18, exc_lp=6000, body=None):
    """Karplus-Strong with 2-tap loop filter + allpass fractional delay (via lfilter)."""
    L = int(length * SR)
    P = SR / f0
    s = 0.5 + 0.45 * bright          # loop lowpass: s + (1-s) z^-1
    ld = 1 - s                       # its low-freq delay
    Nd = int(np.floor(P - ld - 0.1))
    dfr = P - ld - Nd                # in [0.1, 1.1)
    c = (1 - dfr) / (1 + dfr)
    g = 10 ** (-3 * P / (SR * decay))
    a = np.zeros(Nd + 3)
    a[0] = 1
    a[1] += c
    a[Nd] -= g * s * c
    a[Nd + 1] -= g * (s + (1 - s) * c)
    a[Nd + 2] -= g * (1 - s)
    b = np.array([1.0, c])
    ne = max(int(P), 4)
    exc = RNG.uniform(-1, 1, ne)
    exc = signal.sosfilt(sos_lp(exc_lp, 1), exc)
    k = max(int(pos * P), 1)
    exc2 = exc.copy()
    exc2[k:] -= exc[:-k]
    x = np.zeros(L)
    x[:ne] = exc2
    y = signal.lfilter(b, a, x)
    if body is not None:
        y = y + body[1] * signal.sosfilt(sos_bp(body[0] * 0.8, body[0] * 1.25), y)
    y /= (np.max(np.abs(y[: int(0.05 * SR)])) + 1e-9)
    return fade_edges(y, 0.0005, 0.03)


def koto(f0, vel=0.5):
    y = ks_pluck(f0, 2.6, 2.4, bright=0.75, pos=0.12, exc_lp=9000, body=(700, 0.6))
    # tsume (plectrum) click
    nc = int(0.003 * SR)
    y[:nc] += 0.3 * signal.sosfilt(sos_hp(2500), RNG.standard_normal(nc))
    return vel * y


def harp(f0, vel=0.5):
    return vel * ks_pluck(f0, 3.5, 3.0, bright=0.55, pos=0.3, exc_lp=4000)


def pizz(f0, vel=0.5):
    y = ks_pluck(f0, 0.9, 0.42, bright=0.25, pos=0.22, exc_lp=2200, body=(350, 0.8))
    return vel * y


def taiko(vel=0.7, f_hi=110, f_lo=58, decay=0.55, length=1.6):
    L = int(length * SR)
    t = np.arange(L) / SR
    f = f_lo + (f_hi - f_lo) * np.exp(-t / 0.045)
    ph = np.cumsum(TWOPI * f / SR)
    y = np.sin(ph) * np.exp(-t / decay) + 0.35 * np.sin(1.59 * ph) * np.exp(-t / (decay * 0.45)) \
        + 0.18 * np.sin(2.14 * ph) * np.exp(-t / (decay * 0.3))
    nz = signal.sosfilt(sos_lp(900), RNG.standard_normal(L)) * np.exp(-t / 0.035)
    y += 0.9 * nz
    y = np.tanh(1.4 * y) / np.tanh(1.4)
    return fade_edges(vel * y, 0.0008, 0.05)


def shime(vel=0.4):
    L = int(0.35 * SR)
    t = np.arange(L) / SR
    f = 330 + 120 * np.exp(-t / 0.01)
    y = np.sin(np.cumsum(TWOPI * f / SR)) * np.exp(-t / 0.07)
    y += 0.5 * signal.sosfilt(sos_bp(1500, 6000), RNG.standard_normal(L)) * np.exp(-t / 0.012)
    return fade_edges(vel * y, 0.0005, 0.02)


def shaker(vel=0.3):
    L = int(0.12 * SR)
    t = np.arange(L) / SR
    env = (1 - np.exp(-t / 0.006)) * np.exp(-t / 0.035)
    y = signal.sosfilt(sos_bp(4500, 13000), RNG.standard_normal(L)) * env
    return fade_edges(vel * y, 0.0005, 0.01)


def cymbal(length, vel=0.5, swell=False, tone=1.0):
    L = int(length * SR)
    t = np.arange(L) / SR
    nz = RNG.standard_normal(L)
    y = signal.sosfilt(sos_hp(3500 * tone), nz) + 0.4 * signal.sosfilt(sos_bp(6000, 12000), nz)
    # metallic FM shimmer
    for fr in (421.0, 587.3, 811.1, 1103.7):
        y += 0.05 * np.sin(TWOPI * fr * 5.3 * t + 3 * np.sin(TWOPI * fr * 1.41 * t))
    if swell:
        env = (t / length) ** 3.2
        env[-int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))
    else:
        env = np.exp(-t / (length * 0.3)) * (1 - np.exp(-t / 0.002))
    return fade_edges(vel * y * env * 0.4, 0.001, 0.02)


def boom(vel=1.0, length=3.0):
    L = int(length * SR)
    t = np.arange(L) / SR
    f = 34 + 60 * np.exp(-t / 0.08)
    y = np.sin(np.cumsum(TWOPI * f / SR)) * np.exp(-t / 0.9)
    return fade_edges(vel * y, 0.001, 0.05)


def string_voice(f0, hold, vel_pts, attack=0.35, release=0.8, voices=4, tremolo=False,
                 bright=0.5, cents=7.0, vib_depth=0.13, pan=0.0, spread=0.6):
    """Ensemble section note -> stereo array. vel_pts: scalar or [(t_rel, v), ...]."""
    L = int((hold + release * 1.6 + 0.05) * SR)
    t = np.arange(L) / SR
    env = adsr(L, attack, 0.5, 0.85, release, hold)
    if np.isscalar(vel_pts):
        ve = np.full(L, float(vel_pts))
    else:
        ve = interp_env(vel_pts, t)
    out = np.zeros((2, L))
    for v in range(voices):
        det = RNG.normal(0, cents)
        fr = f0 * 2 ** (det / 1200) * vibrato(L, 5.0 + RNG.random() * 0.8, vib_depth,
                                               delay=0.25 + RNG.random() * 0.3, drift=2.5)
        y = blep_saw(fr)
        if tremolo:
            rate = 7.0 + RNG.random() * 0.8
            ph = np.cumsum(TWOPI * rate * (1 + 0.1 * np.sin(TWOPI * 0.7 * t + v)) / SR) + RNG.random() * 6
            tr = np.abs(np.sin(ph)) ** 0.6
            y *= 0.35 + 0.65 * tr
        p = np.clip(pan + spread * ((v / max(voices - 1, 1)) * 2 - 1), -1, 1)
        th = (p + 1) * np.pi / 4
        out[0] += y * np.cos(th)
        out[1] += y * np.sin(th)
    # dynamic brightness: crossfade dark/bright filtered copies by velocity*env
    fc_dark = min(900 + f0 * 2.0, 5000)
    fc_bright = min(2500 + f0 * 6 * (0.5 + bright), 11000)
    dark = signal.sosfilt(sos_lp(fc_dark, 2), out, axis=1)
    brt = signal.sosfilt(sos_lp(fc_bright, 2), out, axis=1)
    w = np.clip(ve * env * (0.6 + bright * 0.6), 0, 1)
    y = dark * (1 - w) + brt * w
    y = signal.sosfilt(sos_hp(max(f0 * 0.6, 40), 1), y, axis=1)
    y *= env * ve * (1.0 / np.sqrt(voices)) * 0.22
    return y


def pad_voice(f0, hold, vel, attack=1.8, release=2.0, cutoff=1600, pan=0.0):
    L = int((hold + release * 1.6 + 0.05) * SR)
    t = np.arange(L) / SR
    env = adsr(L, attack, 1.0, 0.9, release, hold)
    env = env ** 1.5
    out = np.zeros((2, L))
    for v in range(4):
        det = (v - 1.5) * 5 + RNG.normal(0, 2)
        fr = f0 * 2 ** (det / 1200) * vibrato(L, 0.3 + 0.2 * RNG.random(), 0.04, delay=0, ramp=0.1, drift=2)
        y = blep_saw(fr) * 0.6 + 0.8 * np.sin(np.cumsum(TWOPI * fr / SR))
        th = (np.clip(pan + (v - 1.5) * 0.4, -1, 1) + 1) * np.pi / 4
        out[0] += y * np.cos(th)
        out[1] += y * np.sin(th)
    # breathing filter (slow LFO on brightness)
    lfo = 0.5 + 0.5 * np.sin(TWOPI * 0.13 * t + RNG.random() * 6)
    a = signal.sosfilt(sos_lp(cutoff * 0.6, 2), out, axis=1)
    b = signal.sosfilt(sos_lp(cutoff * 1.6, 2), out, axis=1)
    y = a * (1 - lfo * 0.6) + b * lfo * 0.6
    return y * env * vel * 0.12


FORMANTS = {"a": [(800, 1.0, 80), (1150, 0.5, 90), (2800, 0.12, 120)],
            "o": [(450, 1.0, 70), (800, 0.4, 80), (2830, 0.06, 100)],
            "u": [(325, 1.0, 50), (700, 0.2, 60), (2530, 0.04, 100)]}


def choir_voice(f0, hold, vel, vowel="a", attack=0.6, release=1.2, pan=0.0):
    L = int((hold + release * 1.6 + 0.05) * SR)
    t = np.arange(L) / SR
    env = adsr(L, attack, 1.0, 0.9, release, hold)
    src = np.zeros((2, L))
    for v in range(5):
        fr = f0 * 2 ** (RNG.normal(0, 9) / 1200) * vibrato(L, 5.2 + RNG.random(), 0.12, 0.2, 0.5, 4)
        y = blep_saw(fr)
        th = (np.clip(pan + (v - 2) * 0.3, -1, 1) + 1) * np.pi / 4
        src[0] += y * np.cos(th)
        src[1] += y * np.sin(th)
    src += 0.03 * RNG.standard_normal((2, L))  # breath
    out = np.zeros_like(src)
    for fc, g, bw in FORMANTS[vowel]:
        out += g * signal.sosfilt(sos_bp(fc - bw, fc + bw, 2), src, axis=1)
    return out * env * vel * 0.35


def flute(f0, hold, vel=0.5, attack=0.07, release=0.18):
    L = int((hold + release * 1.6 + 0.05) * SR)
    t = np.arange(L) / SR
    env = adsr(L, attack, 0.3, 0.9, release, hold)
    fr = f0 * vibrato(L, 5.3, 0.16, delay=0.25, ramp=0.4, drift=3)
    ph = np.cumsum(TWOPI * fr / SR)
    y = np.sin(ph) + 0.28 * np.sin(2 * ph + 0.4) + 0.1 * np.sin(3 * ph + 1.1) + 0.035 * np.sin(4 * ph)
    # amplitude flutter
    y *= 1 + 0.04 * np.sin(TWOPI * 5.3 * t)
    br = signal.sosfilt(sos_bp(1200, 9000), RNG.standard_normal(L)) * 0.035
    br += signal.sosfilt(sos_bp(f0 * 0.9, f0 * 1.15), RNG.standard_normal(L)) * 0.25
    # chiff
    nc = int(0.05 * SR)
    ch = signal.sosfilt(sos_bp(f0 * 1.8, f0 * 2.4), RNG.standard_normal(nc)) * np.exp(-np.arange(nc) / (0.012 * SR))
    y[:nc] += 0.6 * ch
    y = (y + br) * env * vel * 0.3
    return y


# ----------------------------------------------------------------------------- effects
def make_ir(rt=3.0, length=3.6, seed=3):
    r = np.random.default_rng(seed)
    L = int(length * SR)
    t = np.arange(L) / SR
    irs = []
    for ch in range(2):
        nz = r.standard_normal(L)
        ir = np.zeros(L)
        for sos, rtb in [(sos_lp(450, 2), rt * 1.15), (sos_bp(450, 4000, 2), rt), (sos_hp(4000, 2), rt * 0.45)]:
            ir += signal.sosfilt(sos, nz) * np.exp(-6.9 * t / rtb)
        ir *= 1 - np.exp(-t / 0.012)  # diffuse build-up
        pre = int(0.018 * SR)
        ir = np.concatenate([np.zeros(pre), ir])[:L]
        # early reflections
        for d, g in [(0.011, 0.5), (0.019, -0.35), (0.027, 0.3), (0.041, -0.22), (0.053, 0.18)]:
            k = int((d + 0.003 * ch * r.random()) * SR)
            ir[k] += g * 0.6
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    return np.array(irs)


def chorus(x, depth_ms=2.5, base_ms=11, rates=(0.31, 0.43), mix=0.35):
    out = x.copy()
    n = np.arange(x.shape[1])
    for c in range(2):
        d = (base_ms + depth_ms * np.sin(TWOPI * rates[c] * n / SR + c)) * SR / 1000
        out[c] = (1 - mix) * x[c] + mix * np.interp(n - d, n, x[1 - c])
    return out


def reverse_swell(notes, length=1.6, ir=None):
    """Reversed reverberant bell cluster -> a rising shimmer that ends abruptly."""
    L = int(3.5 * SR)
    y = np.zeros(L)
    for nm in notes:
        s = celesta(hz(nm), 0.5)
        y[: len(s)] += s
        s = glock(hz(nm) * 2, 0.2)
        y[: len(s)] += s
    wet = np.array([signal.oaconvolve(y, ir[c])[:L] for c in range(2)]) + 0.3 * y
    wet = wet[:, ::-1]
    k = int(length * SR)
    wet = wet[:, -k:]
    tt = np.linspace(0, 1, k)
    return wet * tt ** 3


# ----------------------------------------------------------------------------- score
CUES = []


def cue(t0, t1, name, desc):
    CUES.append((t0, t1, name, desc))


def jit(s=0.008):
    return float(RNG.normal(0, s))


def pad_chord(t0, t1, notes, vel, **kw):
    for i, nm in enumerate(notes):
        pan = (i / max(len(notes) - 1, 1)) * 1.2 - 0.6
        bus("pad").add(pad_voice(hz(nm), t1 - t0, vel, pan=pan, **kw), t0)


def str_chord(t0, t1, notes, vel, **kw):
    for i, nm in enumerate(notes):
        pan = (i / max(len(notes) - 1, 1)) * 1.3 - 0.65
        f = hz(nm)
        vp = vel
        if not np.isscalar(vel):
            vp = [(a - t0, b) for a, b in vel]
        bus("strings").add(string_voice(f, t1 - t0, vp, pan=pan, **kw), t0)


def choir_chord(t0, t1, notes, vel, vowel="a", **kw):
    for i, nm in enumerate(notes):
        pan = (i / max(len(notes) - 1, 1)) * 1.2 - 0.6
        bus("choir").add(choir_voice(hz(nm), t1 - t0, vel, vowel, pan=pan, **kw), t0)


def pno(t, nm, hold, vel, pan=None):
    f = hz(nm)
    if pan is None:
        pan = np.clip((m(nm) - 62) / 30, -0.7, 0.7) if isinstance(nm, str) else 0
    bus("piano").add(piano(f, hold, vel), t + jit(0.006), pan=pan)


def mbox(t, nm, vel, pan=0.15):
    bus("bells").add(music_box(hz(nm), vel), t + jit(0.005), pan=pan)


def cel(t, nm, vel, pan=0.0):
    bus("bells").add(celesta(hz(nm), vel), t, pan=pan)


def glk(t, nm, vel, pan=0.0):
    bus("bells").add(glock(hz(nm), vel), t, pan=pan)


def chm(t, nm, vel, pan=0.0, length=5.0):
    bus("bells").add(chime(hz(nm), vel, length), t, pan=pan)


def harp_run(t0, t1, notes, vel, pan0=-0.5, pan1=0.5):
    n = len(notes)
    for i, nm in enumerate(notes):
        tt = t0 + (t1 - t0) * (i / max(n - 1, 1)) ** 0.9
        bus("plucks").add(harp(hz(nm), vel * (0.8 + 0.4 * i / n)), tt, pan=pan0 + (pan1 - pan0) * i / max(n - 1, 1))


def compose(ir):
    # ============ S1 0-7 : ethereal pad + music box star theme ============
    cue(0.0, 7.0, "M1 Hoshi no Yoru", "ethereal pad Db add9 -> Gbmaj7/Db, music-box star theme, celesta sparkles")
    pad_chord(0.0, 4.3, ["Db3", "Ab3", "Eb4", "F4"], 0.6, attack=2.6, release=1.8)
    pad_chord(4.0, 7.2, ["Db3", "Gb3", "Bb3", "F4"], 0.45, attack=1.5, release=1.5)
    pad_chord(0.3, 7.0, ["Db2"], 0.9, attack=3.0, release=1.2, cutoff=500)
    # star theme on music box: sol do re mi(long) re do | la sol mi sol(long)
    theme1 = [(0.90, "Ab5", 0.55), (1.26, "Db6", 0.6), (1.62, "Eb6", 0.62), (1.98, "F6", 0.7),
              (3.02, "Eb6", 0.5), (3.38, "Db6", 0.5), (4.10, "Bb5", 0.45), (4.46, "Ab5", 0.42),
              (4.84, "F5", 0.42), (5.30, "Ab5", 0.5)]
    for t, nm, v in theme1:
        mbox(t, nm, v)
    # music box "comb" bass notes
    for t, nm, v in [(0.90, "Db5", 0.25), (1.98, "Ab4", 0.22), (3.02, "Gb4", 0.2), (4.10, "Gb4", 0.2),
                     (5.30, "Db5", 0.22), (6.20, "Eb6", 0.2), (6.45, "Db6", 0.18)]:
        mbox(t, nm, v, pan=-0.15)
    penta = ["Db", "Eb", "F", "Ab", "Bb"]
    t = 0.5
    while t < 7.0:
        nm = penta[RNG.integers(5)] + str(RNG.integers(6, 8))
        cel(t, nm, 0.08 + 0.06 * RNG.random(), pan=RNG.uniform(-0.8, 0.8))
        t += RNG.uniform(0.35, 0.9)

    # ============ S2 7-13.5 : tension rising -> impact 12.6 -> hush -> reverse swell ============
    cue(7.0, 12.6, "M2 Nagareboshi", "harp gliss (7.8 star), tremolo strings rising Gbmaj7-Ab-Bbm7-Cbmaj7-C7, crescendo")
    harp_run(7.55, 8.05, ["Db4", "Eb4", "F4", "Ab4", "Bb4", "Db5", "Eb5", "F5", "Ab5", "Bb5", "Db6"], 0.35)
    chords = [(7.0, 8.7, ["Gb2", "Db3", "Bb3", "F4"], 0.30),
              (8.6, 9.9, ["Ab2", "Eb3", "C4", "Eb4"], 0.32),
              (9.8, 10.9, ["Bb2", "F3", "Db4", "Ab4"], 0.36),
              (10.8, 11.8, ["Cb3", "Gb3", "Bb3", "Eb4"], 0.42),
              (11.7, 12.62, ["C3", "G3", "Bb3", "E4"], [(11.7, 0.42), (12.6, 0.95)])]
    for t0, t1, notes, v in chords:
        str_chord(t0, t1, notes, v, tremolo=True, attack=0.25, release=0.25, bright=0.6)
    top = [(7.0, 8.7, "F5", 0.14), (8.6, 9.9, "Ab5", 0.16), (9.8, 10.9, "Bb5", 0.18),
           (10.8, 11.8, "Cb6", 0.22), (11.7, 12.62, "C6", [(11.7, 0.26), (12.6, 0.6)])]
    for t0, t1, nm, v in top:
        str_chord(t0, t1, [nm], v, tremolo=True, attack=0.3, release=0.25, voices=5, bright=0.7)
    # low pulse accelerating into impact
    for tt, v in [(10.8, 0.25), (11.35, 0.3), (11.75, 0.35), (12.05, 0.4), (12.28, 0.45), (12.45, 0.5)]:
        bus("perc").add(taiko(v, 95, 55, 0.4), tt, pan=0)
    bus("perc").add(cymbal(1.4, 0.55, swell=True), 12.6 - 1.4)
    # IMPACT 12.6: F major hit
    cue(12.6, 13.5, "Impact", "12.6 orchestral F-major hit + boom + crash, hush, reverse shimmer swell into 13.5")
    str_chord(12.6, 12.95, ["F2", "C3", "F3", "A3", "C4", "F4", "A4", "C5"], 1.0, attack=0.008,
              release=0.28, bright=1.0, voices=4)
    choir_chord(12.6, 12.9, ["F3", "A3", "C4", "F4"], 0.8, "a", attack=0.02, release=0.35)
    bus("perc").add(taiko(1.0, 120, 45, 0.9, 2.5), 12.6)
    bus("perc").add(boom(1.1), 12.6)
    bus("perc").add(cymbal(1.2, 0.8), 12.6)
    for nm in ["F2", "C3", "F3"]:
        pno(12.6, nm, 0.4, 0.9, pan=0)
    sw = reverse_swell(["Bb5", "C6", "Db6", "F6", "Ab6"], 0.95, ir)
    bus("bells").add(sw * 1.8, 13.5 - sw.shape[1] / SR)

    # ============ S3 13.5-24 : tender, sad (Bb minor) ============
    cue(13.5, 24.0, "M3 Naku Hoshi", "solo piano Bbm(add9)-Gbmaj7-Db/F-Ebm7-Absus-Ab, soft string pad; flute rises 22.2-24")
    chm(13.5, "Bb5", 0.25, pan=-0.3)
    chm(13.52, "F6", 0.18, pan=0.3)
    sad = [(13.5, 16.75, ["Bb2", "F3", "Db4"], "Bb1", ["Bb2", "F3", "C4", "Db4"]),
           (16.7, 19.95, ["Gb2", "Db3", "Bb3"], "Gb1", ["Gb2", "Db3", "F3", "Bb3"]),
           (19.9, 21.55, ["F2", "Ab3", "Db4"], "F1", ["F2", "C3", "Ab3", "Db4"]),
           (21.5, 22.95, ["Eb2", "Gb3", "Db4"], "Eb2", ["Eb2", "Bb2", "Gb3", "Db4"]),
           (22.9, 24.2, ["Ab2", "Eb3", "Db4"], "Ab1", ["Ab2", "Eb3", "Ab3", "C4"])]
    for t0, t1, strn, _bass, arp in sad:
        str_chord(t0, t1 + 0.1, strn, 0.14, attack=0.9, release=1.0, bright=0.2, vib_depth=0.08)
    beat = 0.80
    for t0, t1, _s, bass_n, arp in sad:
        pno(t0, bass_n.replace("1", "2") if bass_n.endswith("1") else bass_n, min(t1 - t0 + 0.2, 3.3), 0.30)
        k = 1
        tt = t0 + beat
        while tt < t1 - 0.2:
            pno(tt, arp[k % len(arp)], min(t1 - tt + 0.2, 2.5), 0.2 + 0.03 * (k % 2))
            k += 1
            tt += beat + jit(0.02)
    # sparse right-hand melody (minor star theme fragments) — mostly in the gaps
    for t, nm, hold, v in [(13.9, "F5", 1.2, 0.26), (15.1, "Db5", 0.8, 0.22), (15.9, "C5", 0.9, 0.2),
                           (16.8, "Db5", 1.5, 0.22), (18.4, "Bb4", 1.0, 0.18),
                           (19.42, "Ab5", 0.3, 0.3), (19.62, "F5", 0.5, 0.28),
                           (20.3, "Eb5", 1.2, 0.17), (21.6, "Db5", 1.2, 0.17)]:
        pno(t, nm, hold, v)
    for t, nm, hold, v in [(22.3, "Db5", 0.42, 0.34), (22.74, "Eb5", 0.42, 0.38), (23.18, "F5", 0.4, 0.42),
                           (23.6, "Ab5", 0.95, 0.46)]:
        bus("flute").add(flute(hz(nm), hold, v), t, pan=0.1)

    # ============ S4 24-31 : hope (Db major) ============
    cue(24.0, 31.0, "M4 Arigatou no Hikari", "major lift Gbadd9-Ab-Fm7-Bbm7-Ebm7-Ab7sus, pizzicato; warm Db resolution 29.9; build to 31")
    hope = [(24.0, 25.65, ["Gb2", "Db3", "Bb3", "Ab4"], "Gb2"),
            (25.6, 27.25, ["Ab2", "Eb3", "C4", "Eb4"], "Ab2"),
            (27.2, 27.95, ["F2", "C3", "Ab3", "Eb4"], "F2"),
            (27.9, 28.65, ["Bb2", "F3", "Db4", "Ab4"], "Bb2"),
            (28.6, 29.25, ["Eb2", "Bb2", "Gb3", "Db4"], "Eb2"),
            (29.2, 29.95, ["Ab2", "Eb3", "Gb3", "Db4"], "Ab2")]
    for t0, t1, notes, _b in hope:
        str_chord(t0, t1 + 0.05, notes, 0.24, attack=0.45, release=0.6, bright=0.4)
    beat = 60 / 76
    pat = [0, 7, 12, 7]
    for t0, t1, notes, b in hope:
        tt, k = t0, 0
        while tt < t1 - 0.05:
            base = m(b) + (12 if m(b) < m("C3") else 0)
            bus("plucks").add(pizz(hz(base + pat[k % 4]), 0.5 if k % 4 == 0 else 0.36), tt + jit(0.006),
                              pan=-0.3 + 0.2 * (k % 2))
            tt += beat / 2 if t1 - t0 < 1.0 else beat
            k += 1
    for t0, _t1, notes, _b in hope[::2]:
        glk(t0 + 0.02, "Db6" if "Db4" in notes else "Eb6", 0.1, pan=0.4)
    # 29.9 warm resolution
    str_chord(29.9, 31.2, ["Db2", "Ab2", "F3", "C4", "Eb4"], [(29.9, 0.34), (30.5, 0.3), (31.0, 0.45)],
              attack=0.3, release=0.6, bright=0.5)
    pad_chord(29.9, 31.0, ["Db3", "Ab3", "F4"], 0.5, attack=0.4, release=0.8)
    harp_run(29.9, 30.35, ["Db3", "Ab3", "Db4", "F4", "Ab4", "Db5", "F5", "Ab5"], 0.38)
    chm(29.92, "Ab5", 0.3, pan=-0.2)
    chm(29.94, "Db6", 0.24, pan=0.25)
    cel(30.0, "F6", 0.2, 0.3)
    # build into montage
    for i, nm in enumerate(["Ab3", "Bb3", "Db4", "Eb4", "F4", "Ab4", "Bb4", "Db5"]):
        bus("plucks").add(pizz(hz(nm), 0.25 + 0.03 * i), 30.45 + i * 0.066, pan=-0.4 + 0.1 * i)
    for i in range(8):
        bus("perc").add(shime(0.12 + 0.05 * i), 30.45 + i * 0.066, pan=0.2)
    bus("perc").add(cymbal(0.9, 0.35, swell=True), 30.1)

    # ============ S5 31-41.5 : joyful montage, 114.3 BPM, 5 bars ============
    cue(31.0, 41.5, "M5 Machi wo Kakeru", "114 BPM: koto 8ths, shaker 16ths, taiko, pizz bass; flute star theme 34.5 & 37.4; build to 41.5")
    b = 10.5 / 20
    prog = [("Db", ["Db", "Ab", "Db", "Eb", "F"], "Db2"), ("Ab/C", ["C", "Ab", "Eb", "Ab", "C"], "C2"),
            ("Bbm", ["Bb", "F", "Bb", "C", "Db"], "Bb1"), ("Gb", ["Gb", "Db", "Gb", "Ab", "Bb"], "Gb1"),
            ("Db/F", ["F", "Db", "Ab", "Eb", "F"], "F1"), ("Gb", ["Gb", "Db", "Gb", "Ab", "Bb"], "Gb1"),
            ("Ebm7", ["Eb", "Bb", "Db", "F", "Gb"], "Eb2"), ("Ab", ["Ab", "Eb", "Ab", "Bb", "C"], "Ab1"),
            ("Gb", ["Gb", "Db", "Gb", "Ab", "Bb"], "Gb1"), ("Ab", ["Ab", "Eb", "Ab", "Bb", "C"], "Ab1")]
    koto_oct = [4, 4, 5, 5, 5]
    koto_pat = [0, 1, 2, 4, 3, 1, 2, 1]
    for ci, (_nm, tones, bass_n) in enumerate(prog):
        t0 = 31.0 + ci * 2 * b
        prog_v = ci / 9
        for k in range(4):
            idx = koto_pat[(k + 4 * (ci % 2)) % 8]
            nm = tones[idx] + str(koto_oct[idx])
            v = (0.32 if k == 0 else 0.22) + 0.12 * prog_v
            bus("plucks").add(koto(hz(nm), v), t0 + k * b / 2 + jit(0.004), pan=0.35 if k % 2 else -0.1)
        # pizz / bass
        for k in range(2):
            bf = hz(bass_n) * (2 if k else 1) * 2
            bus("plucks").add(pizz(bf, 0.42 + 0.1 * prog_v), t0 + k * b, pan=-0.15)
        # strings pad joins from chord 4, growing
        if ci >= 4:
            root = m(tones[0] + "3")
            notes = [root - 12, root, root + 7, root + 12 + (4 if ci not in (6,) else 3)]
            vel = 0.14 + 0.28 * (ci - 4) / 5
            str_chord(t0, t0 + 2 * b + 0.05, [_mname(x) for x in notes], vel,
                      attack=0.25, release=0.5, bright=0.5)
    # shaker 16ths
    for i in range(80):
        tt = 31.0 + i * b / 4
        acc = 1.0 if i % 4 == 2 else (0.6 if i % 2 == 0 else 0.45)
        gain = 0.10 + 0.12 * (i / 80)
        bus("perc").add(shaker(acc * gain), tt + jit(0.003), pan=0.45)
    # taiko + shime
    for beat_i in range(20):
        tt = 31.0 + beat_i * b
        prog_v = beat_i / 19
        if beat_i % 2 == 0 or beat_i >= 12:
            bus("perc").add(taiko(0.30 + 0.25 * prog_v + (0.08 if beat_i % 4 == 0 else 0)), tt, pan=-0.1)
        if beat_i >= 4:
            bus("perc").add(shime(0.12 + 0.12 * prog_v), tt + b / 2, pan=0.3)
        if beat_i >= 8 and beat_i % 4 == 3:
            bus("perc").add(shime(0.1 + 0.1 * prog_v), tt + b * 0.75, pan=0.3)
    # fill 40.45-41.5
    for i in range(8):
        bus("perc").add(taiko(0.35 + 0.06 * i, 130 - 5 * i, 70, 0.3), 40.45 + i * b / 4, pan=-0.3 + 0.08 * i)
    bus("perc").add(cymbal(1.05, 0.45, swell=True), 40.45)
    bus("perc").add(cymbal(2.5, 0.35), 41.5)
    bus("perc").add(taiko(0.55, 90, 45, 0.9, 2.0), 41.5)
    # flute star theme (Db) + later glock doubling
    fl = [(34.50, "Ab5", 0.25), (34.76, "Db6", 0.26), (35.03, "Eb6", 0.26), (35.29, "F6", 0.76),
          (36.08, "Eb6", 0.25), (36.34, "Db6", 0.8),
          (37.40, "Bb5", 0.25), (37.66, "Ab5", 0.26), (37.93, "F5", 0.25), (38.19, "Ab5", 0.5),
          (38.72, "Bb5", 0.25), (38.98, "Db6", 0.26), (39.25, "Eb6", 0.24), (39.50, "F6", 0.9),
          (40.45, "Eb6", 0.24), (40.70, "F6", 0.26), (40.97, "Ab6", 0.75)]
    for i, (t, nm, hold) in enumerate(fl):
        v = 0.36 + 0.2 * (t - 34.5) / 7
        if 36.45 < t < 37.4:
            v *= 0.7
        bus("flute").add(flute(hz(nm), hold, v, attack=0.04), t, pan=0.15)
        if t >= 38.3:
            glk(t, nm, 0.12 + 0.05 * (t - 38.3), pan=-0.35)
    # counter line on koto (low register) at 38.35+
    for i, nm in enumerate(["Ab3", "C4", "Eb4", "Ab4", "Gb3", "Bb3", "Db4", "Gb4", "Ab3", "C4", "Eb4", "Ab4"]):
        bus("plucks").add(koto(hz(nm), 0.2 + 0.015 * i), 38.35 + 0.2625 * 2 * i + b / 4, pan=-0.5)

    # ============ S6 41.5-53 : farewell, very soft under dialogue ============
    cue(41.5, 53.0, "M6 Yakusoku", "string pad Gbmaj7-Fm7-Ebm9-Db/F-Gbmaj7-Absus-Ab-Bbm7-Bb7sus->Bb7, sparse piano; motif hints in gaps")
    fare = [(41.5, 44.0, ["Gb2", "Db3", "Bb3", "F4"]),
            (43.9, 45.3, ["F2", "C3", "Ab3", "Eb4"]),
            (45.2, 46.9, ["Eb2", "Bb2", "Gb3", "F4"]),
            (46.8, 48.3, ["F2", "Db3", "Ab3", "C4"]),
            (48.2, 49.9, ["Gb2", "Db3", "Bb3", "F4"]),
            (49.8, 50.7, ["Ab2", "Eb3", "Db4"]),
            (50.6, 51.6, ["Ab2", "Eb3", "C4"]),
            (51.5, 52.35, ["Bb2", "F3", "Db4", "Ab4"]),
            (52.3, 52.75, ["Bb2", "F3", "Ab3", "Eb4"])]
    for t0, t1, notes in fare:
        str_chord(t0, t1 + 0.1, notes, 0.2, attack=1.0, release=1.2, bright=0.25, vib_depth=0.1, voices=5)
    pad_chord(41.5, 52.7, ["Db4"], 0.35, attack=2.5, release=1.0, cutoff=900)
    str_chord(52.7, 53.05, ["Bb2", "F3", "Ab3", "D4"], [(52.7, 0.3), (53.0, 0.55)], attack=0.2, release=0.2)
    # sparse piano (low-mid) broken chords
    fp = [(41.5, "Gb2"), (42.3, "Db3"), (43.1, "Bb3"), (43.9, "F2"), (44.7, "C3"),
          (45.2, "Eb2"), (46.0, "Bb2"), (46.8, "F2"), (47.6, "Db3"), (48.2, "Gb2"), (49.0, "Db3"),
          (49.8, "Ab2"), (50.6, "Eb3"), (51.5, "Bb2")]
    for t, nm in fp:
        pno(t, nm, 1.6, 0.15)
    # motif hints in dialogue gaps
    for t, nm, hold, v in [(45.28, "Ab4", 0.3, 0.3), (45.52, "Db5", 0.3, 0.32), (45.76, "Eb5", 0.3, 0.33),
                           (46.0, "F5", 1.2, 0.2), (47.66, "Eb5", 0.3, 0.3), (47.92, "Db5", 0.8, 0.26),
                           (52.5, "Bb4", 0.3, 0.3), (52.72, "D5", 0.4, 0.36)]:
        pno(t, nm, hold, v)
    for i, nm in enumerate(["Ab6", "Db7", "F6", "Eb7", "Bb6"]):
        cel(42.0 + i * 0.13, nm, 0.09, pan=-0.5 + 0.25 * i)
    chm(51.5, "F6", 0.14, pan=0.2)
    chm(51.53, "Db6", 0.08, pan=-0.2)

    # ============ S7 53-60 : climax in Eb major ============
    cue(53.0, 54.6, "M7a Tabidachi", "launch: violins rising Bb4->Bb5, timpani roll, choir & cymbal swell into 54.6")
    rise = ["Bb4", "C5", "D5", "Eb5", "F5", "G5", "Ab5", "A5", "Bb5"]
    for i, nm in enumerate(rise):
        t0 = 53.0 + i * 0.2
        str_chord(t0, t0 + 0.22, [nm], 0.32 + 0.05 * i, attack=0.03, release=0.12, voices=5, bright=0.7)
    str_chord(53.0, 54.62, ["Bb1", "Bb2", "F3", "Ab3", "D4"], [(53.0, 0.3), (54.6, 0.85)], tremolo=True,
              attack=0.15, release=0.15, bright=0.6)
    choir_chord(53.1, 54.6, ["Bb3", "D4", "F4", "Ab4"], 0.35, "o", attack=1.2, release=0.3)
    for i in range(22):
        tt = 53.0 + i * 0.0727
        bus("perc").add(taiko(0.12 + 0.02 * i, 100, 60, 0.25), tt, pan=0.1 * np.sin(i))
    bus("perc").add(cymbal(1.6, 0.7, swell=True), 53.0)

    cue(54.6, 57.5, "M7b Hoshi no Uta (theme)", "54.6 burst: full star theme in Eb on strings+piano+bells, choir; glitter arps 55.5-57.5")
    theme = [(54.60, "Bb4", 0.36), (54.95, "Eb5", 0.36), (55.30, "F5", 0.36), (55.65, "G5", 0.82),
             (56.45, "F5", 0.42), (56.85, "Eb5", 0.32), (57.15, "D5", 0.36), (57.50, "Eb5", 1.6)]
    for t, nm, hold in theme:
        v = 0.75 if t < 57.5 else 0.7
        str_chord(t, t + hold, [nm, _mname(m(nm) + 12)], v, attack=0.05, release=0.5, voices=5, bright=0.8)
        pno(t, _mname(m(nm) + 12), hold, 0.6, pan=0.1)
        pno(t, nm, hold, 0.5, pan=-0.1)
        glk(t, _mname(m(nm) + 12), 0.28, pan=0.3)
    harm = [(54.6, 55.7, ["Eb2", "Bb2", "G3", "Eb4"], "Eb1", ["Eb4", "G4", "Bb4"]),
            (55.65, 56.5, ["Ab2", "Eb3", "C4", "G4"], "Ab1", ["Eb4", "Ab4", "C5"]),
            (56.45, 57.2, ["Bb2", "F3", "Bb3", "Eb4"], "Bb1", ["F4", "Bb4", "Eb5"]),
            (57.15, 57.55, ["Bb2", "F3", "Ab3", "D4"], "Bb1", ["F4", "Ab4", "D5"])]
    for t0, t1, notes, bass_n, ch in harm:
        str_chord(t0, t1, notes, 0.6, attack=0.06, release=0.5, bright=0.7)
        str_chord(t0, t1, [bass_n], 0.7, attack=0.05, release=0.5, bright=0.5)
        choir_chord(t0, t1, ch, 0.55, "a", attack=0.12, release=0.6)
        pno(t0, bass_n.replace("1", "2"), t1 - t0, 0.5, pan=-0.3)
    bus("perc").add(taiko(1.0, 110, 45, 1.0, 2.5), 54.6)
    bus("perc").add(boom(0.6), 54.6)
    bus("perc").add(cymbal(3.0, 0.75), 54.6)
    chm(54.6, "Eb6", 0.35, pan=-0.3)
    chm(54.62, "Bb5", 0.3, pan=0.3)
    # glitter arpeggios 55.5-57.5 (Eb pentatonic, up/down)
    pent = ["Eb", "F", "G", "Bb", "C"]
    seq = [p + o for o in ("6", "7") for p in pent]
    seq = seq + seq[-2:0:-1]
    for i in range(20):
        tt = 55.5 + i * 0.1
        nm = seq[i % len(seq)]
        cel(tt, nm, 0.2 + 0.1 * np.sin(i * 0.4) ** 2, pan=np.sin(i * 0.9) * 0.8)
        if i % 2 == 0:
            glk(tt + 0.05, nm, 0.1, pan=-np.sin(i * 0.9) * 0.7)

    cue(57.5, 60.0, "M7c Coda", "final Eb add9 chord 57.5, harp roll + chimes, ring-out, fade to silence by 60.0")
    final = ["Eb1", "Eb2", "Bb2", "G3", "Bb3", "F4", "G4", "Bb4"]
    str_chord(57.5, 59.3, final, [(57.5, 0.75), (58.5, 0.5), (59.3, 0.3)], attack=0.06, release=1.2, bright=0.6)
    choir_chord(57.5, 59.2, ["Eb4", "G4", "Bb4", "Eb5"], 0.55, "a", attack=0.12, release=1.0)
    pad_chord(57.5, 59.5, ["Eb3", "Bb3", "G4", "D5"], 0.6, attack=0.3, release=1.0)
    for nm in ["Eb2", "Bb2", "G3", "Eb4"]:
        pno(57.5, nm, 2.2, 0.55, pan=-0.1)
    harp_run(57.5, 57.95, ["Eb3", "Bb3", "Eb4", "G4", "Bb4", "Eb5", "F5", "G5", "Bb5", "Eb6"], 0.4)
    chm(57.52, "Eb6", 0.35, pan=-0.3, length=3)
    chm(57.55, "G6", 0.22, pan=0.3, length=3)
    chm(57.58, "Bb5", 0.25, pan=0.0, length=3)
    bus("perc").add(taiko(0.6, 90, 42, 1.2, 2.5), 57.5)
    bus("perc").add(cymbal(2.4, 0.4), 57.5)
    for i, nm in enumerate(["Bb6", "G6", "Eb7", "F6", "Bb6", "Eb6"]):
        cel(58.0 + i * 0.22, nm, 0.12 - 0.012 * i, pan=0.6 - 0.24 * i)


def _mname(x):
    names = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
    return names[x % 12] + str(x // 12 - 1)


# ----------------------------------------------------------------------------- mixing
BUS_GAIN = {"pad": 2.7, "strings": 4.0, "piano": 1.0, "bells": 0.5, "plucks": 2.0,
            "flute": 1.1, "choir": 2.2, "perc": 0.65}


def hush_curve(t):
    """12.6 impact -> sudden hush (everything but the reverse-swell bells) -> back at 13.5"""
    return interp_env([(0, 1), (12.72, 1), (12.98, 0.1), (13.42, 0.1), (13.5, 1), (60, 1)], t)


def dialogue_curve(t, depth_db=-3.5, ramp=0.25, skip=(53.8,)):
    g = np.zeros_like(t)
    for s, e in DIALOGUE:
        if s in skip:
            continue
        g = np.maximum(g, np.clip(np.minimum((t - (s - ramp)) / ramp, ((e + ramp) - t) / ramp), 0, 1))
    return 10 ** (depth_db * g / 20)


def master(stems):
    t = np.arange(N) / SR
    mix = sum(stems.values())
    # --- dynamic mid dip under dialogue (complementary zero-phase band split, 300 Hz - 3.5 kHz)
    mid_g = dialogue_curve(t, -4.0)
    sos = sos_bp(300, 3500, 2)

    def dyn_eq(x):
        mid = signal.sosfiltfilt(sos, x, axis=1)
        return x - mid + mid * mid_g
    mix = dyn_eq(mix)
    # --- glue compressor (RMS detect, 2:1 above threshold)
    det = np.sqrt(signal.lfilter([1 - np.exp(-1 / (0.05 * SR))], [1, -np.exp(-1 / (0.05 * SR))],
                                 np.mean(mix ** 2, axis=0)) + 1e-12)
    peak_lvl = np.max(np.abs(mix))
    thr = peak_lvl * 10 ** (-16 / 20)
    over = np.maximum(det / thr, 1.0)
    gc = over ** (1 / 2.0 - 1)
    gc = signal.filtfilt(np.ones(int(0.08 * SR)) / int(0.08 * SR), [1], gc)
    # --- lookahead brickwall limiter (min-filter + smoothing)
    y = mix * gc
    pk = maximum_filter1d(np.max(np.abs(y), axis=0), int(0.01 * SR))
    ceil_ = np.percentile(pk, 99.7)  # soft ceiling: only the top transients get limited
    gl = np.minimum(1.0, ceil_ / (pk + 1e-12))
    W = int(0.012 * SR)
    gl = minimum_filter1d(gl, 2 * W)
    win = np.hanning(W)
    gl = np.convolve(gl, win / win.sum(), mode="same")
    # --- end fade: ring out 57.5-58.4, fade to silence by 60.0 (cosine)
    fade = np.ones(N)
    k0, k1 = int(58.4 * SR), int(59.92 * SR)
    fade[k0:k1] = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, k1 - k0))
    fade[k1:] = 0
    fade[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
    g_total = gc * gl * fade
    out = mix * g_total
    norm = 10 ** (-3 / 20) / np.max(np.abs(out))
    # stems get identical processing -> they sum to the master exactly
    stems_out = {k: dyn_eq(v) * g_total * norm for k, v in stems.items()}
    return out * norm, stems_out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-stems", action="store_true")
    args = ap.parse_args()
    t_start = time.time()
    make_buses()
    ir = make_ir(3.0, 3.6)
    compose(ir)
    print(f"[gen_music] composed in {time.time() - t_start:.1f}s")
    # per-bus processing
    stems = {}
    for name, b in BUSES.items():
        x = b.buf * BUS_GAIN[name]
        if name == "strings":
            x = chorus(x, mix=0.3)
            # tame 2-4 kHz rasp a touch
            x = x - 0.25 * signal.sosfilt(sos_bp(2500, 5000, 1), x, axis=1)
        if name == "pad":
            x = chorus(x, depth_ms=4, base_ms=15, rates=(0.17, 0.23), mix=0.4)
        if name == "perc":
            x = signal.sosfilt(sos_hp(30, 2), x, axis=1)
        mono_send = (x[0] + x[1]) * 0.5 * b.send
        wet = np.array([signal.oaconvolve(mono_send, ir[c])[:N] for c in range(2)])
        stems[name] = x + wet * 0.9
        if name != "bells":
            stems[name] = stems[name] * hush_curve(np.arange(N) / SR)
    out, stems_out = master(stems)
    out_path = ROOT / "audio" / "music.wav"
    sf.write(out_path, out.T.astype(np.float32), SR, subtype="PCM_24")
    if not args.no_stems:
        sd = ROOT / "audio" / "music_stems"
        sd.mkdir(parents=True, exist_ok=True)
        for k, v in stems_out.items():
            sf.write(sd / f"{k}.wav", v.T.astype(np.float32), SR, subtype="PCM_24")
    print(f"[gen_music] wrote {out_path} ({N / SR:.3f}s, peak {20 * np.log10(np.max(np.abs(out))):.2f} dBFS) "
          f"in {time.time() - t_start:.1f}s")
    print("\nCUE SHEET — ほしまいご (Db major -> Eb major finale)")
    print(f"{'in':>6} {'out':>6}  {'cue':<28} description")
    for t0, t1, name, desc in CUES:
        print(f"{t0:6.2f} {t1:6.2f}  {name:<28} {desc}")
    print("\nsection loudness (RMS dBFS, post-master):")
    for t0, t1, name, _ in CUES:
        seg = out[:, int(t0 * SR):int(t1 * SR)]
        print(f"  {t0:5.1f}-{t1:5.1f}  {name:<28} {20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-12):6.1f}")


if __name__ == "__main__":
    main()
