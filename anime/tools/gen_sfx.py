#!/usr/bin/env python3
"""Procedural ambience + foley + effects for 「ほしまいご」.

Everything is synthesized (filtered noise, granular clouds, modal/bell synthesis,
pitch envelopes, equal-power panning, convolution reverb with synthesized IRs).
No samples are loaded.

Usage:  python3 tools/gen_sfx.py [--out audio/sfx.wav]
Output: audio/sfx.wav — 60.0 s, 48 kHz, stereo, 24-bit PCM, peak ≈ -3 dBFS.

RETIMING: every time below lives in SCENES / BEDS / CUES at the top of this
file. Move a number, re-run, done. Dialogue windows (used only to duck the beds
and foley a little) are read from story/timeline.json + audio/voice/lipsync.json.
"""
import argparse
import json
import os

import numpy as np
import soundfile as sf
from scipy import signal

# =============================================================================
# CUE LIST — edit here
# =============================================================================
SR = 48000
DUR = 60.0
PEAK_DBFS = -3.0

# scene boundaries (bed crossfades happen at these edges)
SCENES = [("s1", 0.0, 7.0), ("s2", 7.0, 13.5), ("s3", 13.5, 24.0), ("s4", 24.0, 31.0),
          ("s5", 31.0, 41.5), ("s6", 41.5, 53.0), ("s7", 53.0, 60.0)]
BED_XFADE = 0.9  # seconds, raised-cosine crossfade between scene bed levels

# per-scene ambience layer levels (0..1, multiplied by BED_DB below)
BEDS = {
    #       crickets  frogs  valley-wind  hill-wind  grass  town(fūrin/dog)
    "s1": dict(crickets=1.00, frogs=1.00, wind=0.60, hill=0.00, grass=0.10, town=0.0),
    "s2": dict(crickets=0.65, frogs=0.25, wind=0.20, hill=0.70, grass=0.60, town=0.0),
    "s3": dict(crickets=0.75, frogs=0.85, wind=0.45, hill=0.00, grass=0.15, town=0.0),
    "s4": dict(crickets=0.60, frogs=0.55, wind=0.35, hill=0.00, grass=0.10, town=0.0),
    "s5": dict(crickets=0.30, frogs=0.00, wind=0.30, hill=0.00, grass=0.00, town=1.0),
    "s6": dict(crickets=0.50, frogs=0.15, wind=0.10, hill=1.00, grass=1.00, town=0.0),
    "s7": dict(crickets=0.45, frogs=0.20, wind=0.20, hill=0.45, grass=0.30, town=0.0),
}
BED_DB = dict(crickets=-35.0, frogs=-40.0, wind=-37.0, hill=-31.0, grass=-40.0, town=-33.0)
BED_DIALOGUE_DUCK = 0.72  # bed gain while someone is speaking
FOLEY_DIALOGUE_DUCK = 0.8  # footsteps / small foley gain while someone is speaking

# musical key for all pitched sparkles (major pentatonic)
KEY_HZ = 587.33            # D5
PENTA = [0, 2, 4, 7, 9]

CUES = dict(
    ambience_in=dict(t0=0.0, t1=2.2),
    # s2 ---------------------------------------------------------------
    shooting_star=dict(t=7.8, dur=1.8, pan=(-0.95, 0.9)),
    star_turn=dict(t0=10.8, t1=12.6, pan=(0.65, 0.0)),
    impact=dict(t=12.6, pan=0.0),
    hush=dict(t=12.6, recover=(13.9, 17.5), frogs_recover=(17.0, 21.5), crickets_delay=0.8),
    # s3 ---------------------------------------------------------------
    crater=dict(t0=13.5, t1=20.0, pan=0.1),
    run_s3=dict(t0=13.8, t1=15.0, rate=4.4, pan=(-0.8, -0.1)),
    kneel=dict(t=15.0, pan=-0.08),
    sobs=dict(times=[14.0, 16.35, 17.7, 19.45], pan=0.12),
    hop=dict(t=23.3, land=23.42, pan=(0.15, -0.05)),
    # s4 ---------------------------------------------------------------
    lantern=dict(t0=29.9, t1=30.4, chime=30.3, pan=0.05),
    # s5 ---------------------------------------------------------------
    # step rate ramps linearly rate[0] → rate[1] steps/s (run cycle 2.3 → 3.2 cycles/s, 2 steps/cycle)
    run_s5=dict(t0=31.0, t1=41.5, rate=(4.6, 6.4),
                surfaces=[(31.0, "stone"), (34.3, "wood"), (36.9, "stone"), (39.4, "wood")]),
    shoji=dict(times=[32.00, 33.75, 36.30, 37.55, 38.65, 39.35], dur=0.4,
               pans=[0.45, 0.40, 0.35, 0.40, 0.35, 0.30]),
    # per house: gather (liftoff - gather_lead) → liftoff → float → arrival chime in the lantern
    orbs=dict(liftoff=[32.35, 34.10, 36.50, 37.80, 38.85, 39.60],
              arrive=[33.20, 35.00, 37.30, 38.60, 39.60, 40.40],
              gather_lead=0.35, pan_from=[0.40, 0.35, 0.30, 0.35, 0.30, 0.25], pan_to=0.05),
    swarm=dict(t0=39.37, t1=41.73, arrivals=46, accel=0.55, bed=(39.4, 41.5)),
    blaze=dict(t0=39.4, t1=41.3),
    flood=dict(t0=40.6, peak=41.5, tail=1.2),
    passby=dict(posts=[31.75, 35.55, 39.05], lanterns=[33.9, 37.95, 40.15, 41.0]),
    town=dict(t0=30.6, t1=42.0, furin_hz=2380.0, dog=[34.55, 34.9], pan_scroll=(0.8, -0.8)),
    # s6 ---------------------------------------------------------------
    hill_wind=dict(t=41.5, peak=42.4, end=45.0),
    kira_emerges=dict(t=42.0, dur=2.6),
    forehead_touch=dict(t=51.5, pan=0.0),
    # s7 ---------------------------------------------------------------
    launch=dict(t0=53.0, t1=54.6, pan=0.0),
    burst=dict(t=54.6, grains=700),
    shower=dict(t0=54.6, t1=58.0, whooshes=42),
    constellation=dict(t0=55.5, t1=57.5, ticks=14),
    fade_out=dict(t0=58.6, t1=60.0),
)

# =============================================================================
# DSP helpers
# =============================================================================
N = int(round(SR * DUR))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAU = 2 * np.pi


def R(seed):
    return np.random.default_rng(seed)


def secs(x):
    return int(round(x * SR))


def ts(n):
    return np.arange(n) / SR


def db(x):
    return 10 ** (x / 20)


def penta(deg, root=KEY_HZ):
    o, i = divmod(int(deg), 5)
    return root * 2 ** (o + PENTA[i] / 12)


def _sos(kind, f, order=2):
    return signal.butter(order, f, btype=kind, fs=SR, output="sos")


def lp(x, f, order=2):
    return signal.sosfilt(_sos("lowpass", min(f, SR * 0.45), order), x, axis=-1)


def hp(x, f, order=2):
    return signal.sosfilt(_sos("highpass", f, order), x, axis=-1)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(_sos("bandpass", [lo, min(hi, SR * 0.45)], order), x, axis=-1)


def fade(x, fi=0.003, fo=0.01):
    """raised-cosine fade in/out on the last axis (declick)."""
    x = np.array(x, dtype=float, copy=True)
    n = x.shape[-1]
    a, b = min(secs(fi), n // 2), min(secs(fo), n // 2)
    if a > 0:
        x[..., :a] *= 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, a))
    if b > 0:
        x[..., n - b:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, b))
    return x


def seg_env(dur, a, r):
    n = max(secs(dur), 2)
    e = np.ones(n)
    na, nr = min(secs(a), n // 2), min(secs(r), n // 2)
    if na:
        e[:na] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, na))
    if nr:
        e[n - nr:] = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, nr))
    return e


def ad_env(dur, attack, tau):
    t = ts(max(secs(dur), 2))
    e = np.exp(-t / tau) * np.clip(t / max(attack, 1e-4), 0, 1)
    return fade(e, 0, min(0.02, dur * 0.2))


def hump(n, peak_frac=0.5, p=2.0):
    """smooth 0→1→0 envelope peaking at peak_frac."""
    x = np.linspace(0, 1, n)
    k = peak_frac
    up = np.clip(x / max(k, 1e-6), 0, 1)
    dn = np.clip((1 - x) / max(1 - k, 1e-6), 0, 1)
    return (np.sin(np.pi / 2 * np.minimum(up, dn))) ** p


def smooth_rand(n, rate, rg):
    """band-limited random curve, unit std, correlation time ~1/rate s."""
    m = max(8, int(n / SR * rate * 4) + 8)
    pts = np.convolve(rg.standard_normal(m), np.hanning(9), "same")
    pts = (pts - pts.mean()) / (pts.std() + 1e-9)
    return np.interp(np.linspace(0, m - 1, n), np.arange(m), pts)


def place(buf, i0, seg):
    """add seg into buf (last axis) at sample i0, clipping to bounds."""
    n = buf.shape[-1]
    L = seg.shape[-1]
    a, b = max(i0, 0), min(i0 + L, n)
    if b <= a:
        return
    buf[..., a:b] += seg[..., a - i0:b - i0]


def pan_gains(p):
    th = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.cos(th), np.sin(th)


_FB = {}


def _bank(fmin, fmax, nb):
    key = (fmin, fmax, nb)
    if key not in _FB:
        fs = np.geomspace(fmin, fmax, nb)
        bw = np.log2(fmax / fmin) / (nb - 1) * 0.55
        _FB[key] = [(f, _sos("bandpass", [f * 2 ** -bw, min(f * 2 ** bw, SR * 0.45)], 2)) for f in fs]
    return _FB[key]


def sweep_noise(n, fc, width_oct, rg, fmin=50.0, fmax=15000.0, nb=32):
    """noise through a Gaussian (log-freq) band whose centre fc may move per-sample.
    Implemented as a constant-Q filterbank with time-varying band gains → no zipper."""
    w = rg.standard_normal(n)
    lfc = np.log2(np.maximum(np.broadcast_to(fc, (n,)), 1.0))
    out = np.zeros(n)
    for f, sos in _bank(fmin, fmax, nb):
        g = np.exp(-0.5 * ((np.log2(f) - lfc) / width_oct) ** 2)
        if g.max() < 2e-3:
            continue
        out += g * signal.sosfilt(sos, w) / np.sqrt(f / 1000.0)
    return out / (np.sqrt(np.mean(out ** 2)) + 1e-12)


def bell(f0, dur, ratios, taus, amps, rg, attack=0.0015, detune=0.0015, trem=0.0):
    """modal synthesis: inharmonic partials with independent exponential decays."""
    n = secs(dur)
    t = ts(n)
    y = np.zeros(n)
    for r, tau, a in zip(ratios, taus, amps):
        f = f0 * r * (1 + rg.uniform(-detune, detune))
        if f > SR * 0.45:
            continue
        part = np.sin(TAU * f * t + rg.uniform(0, TAU)) * np.exp(-t / tau)
        if trem:  # slow beating of the partial pair (physical bells beat)
            part *= 1 + trem * np.sin(TAU * rg.uniform(0.8, 3.0) * t + rg.uniform(0, TAU))
        y += a * part
    y *= np.clip(t / attack, 0, 1)
    return fade(y, 0, dur * 0.3)


GLASS = ([1.0, 2.756, 5.404, 8.933], [1.0, 0.45, 0.22, 0.12], [1.0, 0.32, 0.12, 0.05])
WARM = ([0.5, 1.0, 1.183, 1.506, 2.0, 2.514, 3.011], [1.6, 1.0, 0.8, 0.6, 0.45, 0.3, 0.2],
        [0.35, 1.0, 0.45, 0.3, 0.35, 0.15, 0.08])
FURIN = ([1.0, 2.32, 3.87, 5.52, 7.41], [1.0, 0.55, 0.35, 0.22, 0.14], [1.0, 0.55, 0.35, 0.2, 0.1])


def tink(f, tau, rg, kind=GLASS, attack=0.0012, maxdur=4.0, trem=0.0):
    r, tr, a = kind
    dur = min(tau * max(tr) * 5.0, maxdur)
    return bell(f, max(dur, 0.03), r, [tau * x for x in tr], a, rg, attack=attack, trem=trem)


def chirp_tone(f_curve, amp):
    """sine from a per-sample frequency curve."""
    return np.sin(TAU * np.cumsum(f_curve) / SR) * amp


# =============================================================================
# mixer with two reverb sends
# =============================================================================
class Mix:
    def __init__(self):
        self.dry = np.zeros((2, N))
        self.rs = np.zeros((2, N))   # short room / outdoor slap
        self.rl = np.zeros((2, N))   # long, dark "magic" tail

    def add(self, sig, t0, pan=0.0, gain=1.0, rs=0.0, rl=0.0):
        sig = np.asarray(sig, dtype=float)
        if sig.ndim == 1:
            gl, gr = pan_gains(np.asarray(pan) if np.ndim(pan) else pan)
            st = np.stack([sig * gl, sig * gr])
        else:
            st = sig
        st = st * gain
        i0 = secs(t0)
        place(self.dry, i0, st)
        if rs:
            place(self.rs, i0, st * rs)
        if rl:
            place(self.rl, i0, st * rl)


def make_ir(rt60, length, predelay, dark_hz, seed):
    rg = R(seed)
    n = secs(length)
    t = ts(n)
    env = np.exp(-6.91 * t / rt60)
    ir = np.zeros((2, n + secs(predelay)))
    for c in range(2):
        w = rg.standard_normal(n)
        dark = lp(w, dark_hz, 2) * 1.8
        k = np.clip(t / (length * 0.6), 0, 1)       # high frequencies die first
        x = (w * (1 - k) + dark * k) * env
        # a few early reflections
        for _ in range(6):
            i = secs(rg.uniform(0.005, 0.06))
            x[i] += rg.uniform(-1, 1) * 3.0
        x = fade(x, 0.002, length * 0.3)
        ir[c, secs(predelay):] = x
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    return ir


# =============================================================================
# dialogue windows (for gentle ducking)
# =============================================================================
def dialogue_mask():
    wins = []
    try:
        tl = json.load(open(os.path.join(ROOT, "story", "timeline.json")))
        ls = json.load(open(os.path.join(ROOT, "audio", "voice", "lipsync.json")))
        for d in tl["dialogue"]:
            dur = ls.get(d["id"], {}).get("duration", 2.0)
            wins.append((d["start"], d["start"] + dur))
    except Exception as e:  # noqa: BLE001
        print("no dialogue info:", e)
    cr = 1000
    m = np.zeros(int(DUR * cr))
    for a, b in wins:
        m[int(a * cr):int(b * cr)] = 1
    w = np.hanning(int(0.4 * cr))
    m = np.convolve(m, w / w.sum(), "same")
    return np.interp(ts(N), np.arange(len(m)) / cr, m), wins


def scene_curve(layer):
    cr = 1000
    step = np.zeros(int(DUR * cr))
    for sid, a, b in SCENES:
        step[int(a * cr):int(b * cr)] = BEDS[sid].get(layer, 0.0)
    w = np.hanning(int(BED_XFADE * cr))
    w /= w.sum()
    sm = np.convolve(np.pad(step, (len(w) // 2, len(w) - len(w) // 2 - 1), mode="edge"), w, "valid")
    return np.interp(ts(N), np.arange(len(sm)) / cr, sm)


def ramp(t, a, b):
    """0 before a, cosine rise to 1 at b."""
    x = np.clip((t - a) / max(b - a, 1e-6), 0, 1)
    return 0.5 - 0.5 * np.cos(np.pi * x)


# =============================================================================
# AMBIENCE BEDS (each returns (2, N), RMS-normalised over its active parts)
# =============================================================================
def norm_rms(x):
    r = np.sqrt(np.mean(x ** 2))
    return x / (r + 1e-12)


def bed_crickets(seed=11):
    rg = R(seed)
    t = ts(N)
    out = np.zeros((2, N))
    specs = [("A", rg.uniform(3900, 4800), rg.uniform(-0.9, 0.9), rg.uniform(0.5, 1.0)) for _ in range(4)]
    specs += [("B", rg.uniform(3200, 4300), rg.uniform(-0.95, 0.95), rg.uniform(0.35, 0.8)) for _ in range(4)]
    specs += [("C", rg.uniform(5800, 7400), rg.uniform(-0.8, 0.8), rg.uniform(0.15, 0.3)) for _ in range(2)]
    for kind, fc, pan, lvl in specs:
        env = np.zeros(N)
        tt = rg.uniform(0, 1.5)
        if kind == "A":      # suzumushi: "riiin" — long chirp with fast pulsing AM
            fam = rg.uniform(36, 55)
            while tt < DUR:
                cd = rg.uniform(0.22, 0.6)
                place(env, secs(tt), seg_env(cd, 0.03, 0.09) * rg.uniform(0.65, 1.0))
                tt += cd + rg.uniform(0.25, 1.0) + (rg.uniform(2, 6) if rg.random() < 0.07 else 0)
            am = (0.5 - 0.5 * np.cos(TAU * fam * t)) ** 2
            ph = TAU * fc * t + 0.6 * np.sin(TAU * fam * t)
            car = np.sin(ph) + 0.1 * np.sin(2 * ph)
        elif kind == "B":    # field cricket: short 3-5 pulse chirps
            prate = rg.uniform(24, 34)
            npul = int(rg.integers(3, 6))
            pulse = np.hanning(secs(0.6 / prate))
            while tt < DUR:
                for k in range(npul):
                    place(env, secs(tt + k / prate), pulse * (1 - 0.12 * k))
                tt += npul / prate + rg.uniform(0.22, 0.7) + (rg.uniform(2, 5) if rg.random() < 0.05 else 0)
            am = 1.0
            car = np.sin(TAU * fc * t)
        else:                # distant trill (katydid-ish)
            fam = rg.uniform(70, 110)
            while tt < DUR:
                on = rg.uniform(2, 7)
                place(env, secs(tt), seg_env(on, 0.4, 0.6))
                tt += on + rg.uniform(1, 5)
            am = (0.5 - 0.5 * np.cos(TAU * fam * t)) ** 3
            car = np.sin(TAU * fc * t)
        drift = 0.75 + 0.25 * np.tanh(smooth_rand(N, 0.1, rg))
        sig = lp(env * am * car * lvl * drift, rg.uniform(7000, 11000))
        gl, gr = pan_gains(pan)
        out[0] += sig * gl
        out[1] += sig * gr
    return norm_rms(out)


def bed_frogs(seed=21):
    """distant rice-paddy tree-frog chorus: buzzy pulse-train notes in bouts."""
    rg = R(seed)
    out = np.zeros((2, N))
    for _ in range(8):
        f0 = rg.uniform(150, 280)
        F1 = rg.uniform(900, 1500)
        F2 = F1 * rg.uniform(1.7, 2.2)
        nrate = rg.uniform(3.5, 6.5)
        note = ad_env(rg.uniform(0.06, 0.1), 0.008, rg.uniform(0.02, 0.035))
        env = np.zeros(N)
        tt = rg.uniform(0, 3)
        while tt < DUR:
            m = int(rg.integers(3, 12))
            for j in range(m):
                place(env, secs(tt + j / nrate + rg.uniform(-0.01, 0.01)), note * rg.uniform(0.6, 1.0))
            tt += m / nrate + rg.uniform(1.0, 5.0)
        f = f0 * (1 + 0.02 * smooth_rand(N, 3, rg))
        car = (0.5 + 0.5 * np.cos(TAU * np.cumsum(f) / SR)) ** 6
        car -= car.mean()
        sig = env * car
        sig = bp(sig, F1 * 0.8, F1 * 1.25) + 0.5 * bp(sig, F2 * 0.85, F2 * 1.2)
        sig = lp(sig, 3200) * rg.uniform(0.4, 1.0)
        gl, gr = pan_gains(rg.uniform(-0.9, 0.9))
        out[0] += sig * gl
        out[1] += sig * gr
    return norm_rms(out)


def gust_curve(seed, depth):
    rg = R(seed)
    x = 0.7 * smooth_rand(N, 0.12, rg) + 0.3 * smooth_rand(N, 0.45, rg)
    return np.exp(depth * 1.6 * np.tanh(x / 1.6))      # soft-limited so gusts never spike


def bed_wind(gust, base_fc, width, seed):
    rg = R(seed)
    fc = base_fc * gust ** 0.7
    a = sweep_noise(N, fc, width, rg)
    b = sweep_noise(N, fc, width, rg)
    rumble = lp(rg.standard_normal(N), 110, 2)
    rumble = rumble / np.std(rumble) * 0.5
    amp = gust ** 1.3
    L = (0.75 * a + 0.25 * b + rumble) * amp
    Rr = (0.25 * a + 0.75 * b + rumble) * amp
    return norm_rms(np.stack([L, Rr]))


def bed_grass(gust, seed=41):
    rg = R(seed)
    out = []
    for _ in range(2):
        x = bp(rg.standard_normal(N), 2200, 10000)
        crackle = np.tanh(np.abs(smooth_rand(N, 28, rg)) ** 2 / 1.5) + 0.15
        out.append(x * crackle * gust ** 1.6)
    return norm_rms(np.stack(out))


def dog_bark(rg):
    d = 0.2
    t = ts(secs(d))
    f0 = 420 + 260 * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.7 - 120 * (t / d)
    ph = TAU * np.cumsum(f0) / SR
    x = sum(np.sin(k * ph) / k for k in range(1, 14))
    x = bp(x, 600, 2200) + 0.3 * bp(rg.standard_normal(len(t)), 800, 3000)
    x *= ad_env(d, 0.012, 0.08)
    return lp(x, 1600)


def bed_town(seed=51):
    """fūrin (glass wind chime) + distant dog. Pans drift R→L: the camera scrolls right."""
    c = CUES["town"]
    rg = R(seed)
    out = np.zeros((2, N))
    p0, p1 = c["pan_scroll"]

    def pan_at(tt):
        return p0 + (p1 - p0) * np.clip((tt - c["t0"]) / (c["t1"] - c["t0"]), 0, 1)

    for f_base, off, lvl in [(c["furin_hz"], 0.0, 1.0), (c["furin_hz"] * 1.27, 1.3, 0.55)]:
        tt = c["t0"] + 0.4 + off
        while tt < c["t1"] - 0.8:
            for j in range(int(rg.integers(1, 4))):
                ts_ = tt + j * rg.uniform(0.08, 0.26)
                s = bell(f_base * rg.uniform(0.998, 1.002), 2.6, *FURIN, rg, attack=0.0008, trem=0.15)
                s = s * rg.uniform(0.35, 1.0) * lvl * (0.6 ** j)
                gl, gr = pan_gains(np.clip(pan_at(ts_) + rg.uniform(-0.1, 0.1) + off * 0.2, -1, 1))
                place(out, secs(ts_), np.stack([s * gl, s * gr]))
            tt += rg.uniform(1.6, 3.8)
    for td in c["dog"]:
        s = dog_bark(rg) * 0.5
        gl, gr = pan_gains(0.85)
        place(out, secs(td), np.stack([s * gl, s * gr]))
    r = np.sqrt(np.mean(out[:, secs(c["t0"]):secs(c["t1"])] ** 2))
    return out / (r + 1e-12)


# =============================================================================
# EFFECTS
# =============================================================================
def whoosh(n, fc, amp, pan, width, rg, width_oct=0.8):
    """stereo whoosh: mono panned core + decorrelated wide part (width 0..1)."""
    m = sweep_noise(n, fc, width_oct, rg) * amp
    d = sweep_noise(n, fc, width_oct, rg) * amp
    gl, gr = pan_gains(pan)
    w = np.broadcast_to(width, (n,))
    core = m * (1 - 0.5 * w)
    return np.stack([core * gl + 0.7 * w * d, core * gr - 0.7 * w * d])


def sparkle_cloud(mix, times, pans, freqs, taus, amps, rg, rs=0.2, rl=0.35, kind=GLASS):
    for t0, p, f, tau, a in zip(times, pans, freqs, taus, amps):
        mix.add(tink(f, tau, rg, kind=kind), t0, pan=float(np.clip(p, -1, 1)), gain=a, rs=rs, rl=rl)


def fx_shooting_star(mix):
    c = CUES["shooting_star"]
    rg = R(101)
    n = secs(c["dur"])
    x = np.linspace(0, 1, n)
    pan = c["pan"][0] + (c["pan"][1] - c["pan"][0]) * x
    fc = 6500 * 2 ** (-1.4 * x)                      # doppler-ish fall
    amp = hump(n, 0.4, 1.5)
    mix.add(whoosh(n, fc, amp, pan, 0.25, rg, 0.9), c["t"], gain=0.09, rs=0.2, rl=0.3)
    # thin singing tone
    tone = chirp_tone(2400 * 2 ** (-0.6 * x), amp ** 2 * 0.3)
    mix.add(fade(tone), c["t"], pan=pan, gain=0.05, rl=0.4)
    # sparkle grains trailing the head
    k = 90
    gt = np.sort(rg.beta(2.0, 2.4, k)) * c["dur"]
    gp = c["pan"][0] + (c["pan"][1] - c["pan"][0]) * (gt / c["dur"]) - 0.08
    freqs = [penta(rg.integers(10, 20)) for _ in range(k)]
    sparkle_cloud(mix, c["t"] + gt, gp + rg.uniform(-0.1, 0.1, k), freqs, rg.uniform(0.02, 0.12, k),
                  rg.uniform(0.01, 0.035, k), rg, rl=0.5)


def fx_star_turn(mix):
    c = CUES["star_turn"]
    rg = R(102)
    d = c["t1"] - c["t0"]
    n = secs(d)
    x = np.linspace(0, 1, n)
    fc = 350 * 2 ** (4.0 * x ** 1.6)
    amp = (0.08 + x ** 2.2) * seg_env(d, 0.25, 0.015)
    pan = c["pan"][0] + (c["pan"][1] - c["pan"][0]) * x ** 1.5
    width = 0.15 + 0.85 * x ** 3                           # comes at camera → wide
    mix.add(whoosh(n, fc, amp, pan, width, rg, 0.7), c["t0"], gain=0.2, rs=0.2, rl=0.2)
    # tonal riser (two detuned voices) + low rumble growing
    f = 180 * 2 ** (2.6 * x ** 1.4)
    tone = (chirp_tone(f, 1) + chirp_tone(f * 1.006, 1) + 0.4 * chirp_tone(f * 2.003, 1)) * x ** 2
    mix.add(fade(tone * seg_env(d, 0.3, 0.015)), c["t0"], pan=pan, gain=0.035, rl=0.3)
    rum = lp(rg.standard_normal(n), 90) * x ** 2.5
    mix.add(fade(rum / (np.std(rum) + 1e-9)), c["t0"], gain=0.05)
    # accelerating sparkle trail
    k = 70
    gt = d * (1 - (1 - rg.random(k)) ** 0.45)
    sparkle_cloud(mix, c["t0"] + gt, np.interp(gt / d, x, pan) + rg.uniform(-0.2, 0.2, k),
                  [penta(rg.integers(10, 19)) for _ in range(k)], rg.uniform(0.02, 0.09, k),
                  0.012 + 0.03 * (gt / d), rg, rl=0.4)


def fx_impact(mix):
    c = CUES["impact"]
    rg = R(103)
    T0 = c["t"]
    # --- deep boom: pitch-dropping sine + thump -----------------------------
    d = 4.0
    t = ts(secs(d))
    f = 32 + 70 * np.exp(-t / 0.09)
    boom = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.55) * np.clip(t / 0.002, 0, 1)
    boom += 0.25 * np.sin(2 * TAU * np.cumsum(f) / SR) * np.exp(-t / 0.3)
    sub_f = 20 + 34 * np.exp(-t / 0.6)                        # sub drop
    sub = np.sin(TAU * np.cumsum(sub_f) / SR) * np.exp(-t / 0.75) * np.clip(t / 0.02, 0, 1)
    thump = lp(rg.standard_normal(len(t)), 220, 4) * np.exp(-t / 0.12)
    thump /= np.max(np.abs(thump)) + 1e-9
    low = np.tanh(1.6 * (boom * 0.9 + sub * 0.8 + thump * 0.8)) / np.tanh(1.6)
    mix.add(fade(low, 0.0005, 1.2), T0, gain=0.95, rs=0.15, rl=0.1)
    # --- crack + blast body (falling filter, very wide) ----------------------
    crack = hp(rg.standard_normal(secs(0.15)), 900) * ad_env(0.15, 0.0005, 0.025)
    mix.add(np.stack([crack, np.roll(crack, 37)]), T0, gain=0.35, rs=0.3, rl=0.2)
    db_ = 2.6
    nb = secs(db_)
    xb = np.linspace(0, 1, nb)
    blast = whoosh(nb, 7000 * 2 ** (-5.0 * xb ** 0.6), ad_env(db_, 0.003, 0.45), 0.0, 0.9, rg, 1.2)
    mix.add(blast, T0, gain=0.28, rs=0.2, rl=0.35)
    # --- glassy shimmer tail -------------------------------------------------
    k = 55
    gt = rg.exponential(0.45, k) + 0.02
    sparkle_cloud(mix, T0 + gt, rg.uniform(-1, 1, k), [penta(rg.integers(8, 21)) for _ in range(k)],
                  rg.uniform(0.3, 1.4, k), 0.05 * np.exp(-gt / 1.2) * rg.uniform(0.4, 1, k), rg,
                  rs=0.1, rl=0.8, kind=GLASS)
    for deg, p in [(5, -0.5), (7, 0.5), (9, -0.2), (10, 0.3)]:   # sustained ringing chord
        s = bell(penta(deg), 4.5, GLASS[0], [2.2, 1.0, 0.5, 0.3], [1, 0.25, 0.1, 0.04], rg, attack=0.08, trem=0.3)
        mix.add(s, T0 + 0.05, pan=p, gain=0.035, rl=0.6)
    # --- debris: dirt clods / pebbles / water spatter ------------------------
    k = 160
    gt = 0.12 + rg.gamma(1.6, 0.45, k)
    for tt in gt:
        if rg.random() < 0.75:
            s = bp(rg.standard_normal(secs(0.03)), rg.uniform(1500, 3500), rg.uniform(4500, 9000))
            s *= ad_env(0.03, 0.0005, rg.uniform(0.003, 0.01))
        else:   # clod thud
            s = lp(rg.standard_normal(secs(0.09)), rg.uniform(250, 600)) * ad_env(0.09, 0.002, 0.025) * 2.0
        mix.add(fade(s, 0.0005, 0.005), T0 + tt, pan=rg.uniform(-0.9, 0.9),
                gain=0.07 * np.exp(-tt / 1.4) * rg.uniform(0.3, 1.0), rs=0.3)
    # --- steam hiss swell (hands over to crater bed) -------------------------
    dh = 2.2
    hiss = sweep_noise(secs(dh), 5500, 0.9, rg) * ad_env(dh, 0.15, 0.9)
    mix.add(np.stack([hiss, np.roll(hiss, 211)]), T0 + 0.1, gain=0.025, rs=0.2)


def fx_crater(mix):
    c = CUES["crater"]
    rg = R(104)
    d = c["t1"] - c["t0"]
    n = secs(d)
    x = np.linspace(0, 1, n)
    lvl = (1 - 0.75 * x) * seg_env(d, 0.4, 1.8)
    hiss = sweep_noise(n, 4800 * (1 + 0.25 * smooth_rand(n, 0.8, rg)), 0.8, rg)
    hiss *= lvl * (0.7 + 0.3 * np.tanh(smooth_rand(n, 0.7, rg)))
    hiss2 = sweep_noise(n, 5200, 0.8, rg) * lvl
    mix.add(np.stack([0.8 * hiss + 0.2 * hiss2, 0.3 * hiss + 0.7 * hiss2]), c["t0"], gain=0.009, rs=0.15)
    # embers crackle: Poisson pops, density decaying
    tt = c["t0"]
    while tt < c["t1"]:
        rate = 14 * (1 - 0.8 * (tt - c["t0"]) / d)
        tt += rg.exponential(1 / rate)
        a = rg.lognormal(0, 0.6) * (1 - 0.7 * (tt - c["t0"]) / d)
        if rg.random() < 0.7:
            s = hp(rg.standard_normal(secs(0.006)), 2500) * ad_env(0.006, 0.0002, 0.0015)
        else:
            fz = rg.uniform(1200, 3200)
            s = bp(rg.standard_normal(secs(0.02)), fz * 0.85, fz * 1.15) * ad_env(0.02, 0.0003, 0.004) * 2
        mix.add(fade(s, 0.0003, 0.002), tt, pan=c["pan"] + rg.uniform(-0.2, 0.2), gain=0.02 * min(a, 3), rs=0.2)


def step_splash(rg, big=1.0):
    d = 0.6 * big ** 0.5
    n = secs(d)
    t = ts(n)
    thud = lp(rg.standard_normal(n), 220) * np.exp(-t / 0.035) * 3.0
    thud += np.sin(TAU * 75 * t) * np.exp(-t / 0.04) * 0.5
    splash = bp(rg.standard_normal(n), 700, 6500) * np.exp(-t / (0.07 * big)) * 1.2
    wash = lp(bp(rg.standard_normal(n), 400, 5000), 2800) * np.exp(-t / (0.16 * big)) * 0.5
    y = (thud + splash + wash) * np.clip(t / 0.003, 0, 1)
    for _ in range(int(rg.integers(2, 5) * big)):      # droplets: tiny rising sine blips
        t0 = rg.uniform(0.04, 0.25 * big)
        dd = 0.05
        tt = ts(secs(dd))
        f = rg.uniform(900, 2200) * (1 + 0.8 * tt / dd)
        blip = chirp_tone(f, np.exp(-tt / 0.012) * np.clip(tt / 0.001, 0, 1))
        place(y, secs(t0), blip * rg.uniform(0.2, 0.5))
    return fade(y, 0.0005, 0.05)


def cloth(rg, d=0.2):
    n = secs(d)
    s = bp(rg.standard_normal(n), 900, 4500) * hump(n, 0.35, 1.5) * (0.6 + 0.4 * np.abs(smooth_rand(n, 30, rg)))
    return fade(s)


def fx_run_s3(mix, duck):
    c = CUES["run_s3"]
    rg = R(105)
    tt, k = c["t0"], 0
    while tt < c["t1"] - 0.05:
        x = (tt - c["t0"]) / (c["t1"] - c["t0"])
        p = c["pan"][0] + (c["pan"][1] - c["pan"][0]) * x
        g = (0.55 + 0.45 * x) * duck(tt)
        mix.add(step_splash(rg), tt + rg.uniform(-0.01, 0.01), pan=p + rg.uniform(-0.05, 0.05), gain=0.09 * g, rs=0.3)
        if k % 2 == 0:
            mix.add(cloth(rg), tt + 0.03, pan=p, gain=0.02 * g)
        k += 1
        tt += 1 / c["rate"]
    kc = CUES["kneel"]
    for off, big, a in [(0.0, 1.8, 1.0), (0.13, 1.3, 0.6)]:
        mix.add(step_splash(rg, big), kc["t"] + off, pan=kc["pan"] + (off - 0.06), gain=0.1 * a * duck(kc["t"]), rs=0.35)
    mix.add(cloth(rg, 0.45), kc["t"] - 0.05, pan=kc["pan"], gain=0.03)


def fx_sobs(mix):
    c = CUES["sobs"]
    rg = R(106)
    for t0 in c["times"]:
        for j in range(int(rg.integers(2, 4))):   # "hic-hic" little glassy whimpers
            d = rg.uniform(0.18, 0.3)
            n = secs(d)
            x = np.linspace(0, 1, n)
            f = rg.uniform(1250, 1500) * (1 + 0.08 * np.sin(np.pi * x) - 0.22 * x) * (1 + 0.012 * np.sin(TAU * 7 * x * d))
            s = chirp_tone(f, hump(n, 0.25, 1.2)) + 0.18 * chirp_tone(f * 2.756, hump(n, 0.2, 2))
            mix.add(fade(s), t0 + j * rg.uniform(0.14, 0.2), pan=c["pan"], gain=0.012 * (0.8 ** j), rl=0.35)


def fx_hop(mix):
    c = CUES["hop"]
    rg = R(107)
    d = 0.2
    n = secs(d)
    x = np.linspace(0, 1, n)
    f = 330 * 2 ** (1.4 * x ** 0.7) * (1 + 0.06 * np.sin(TAU * 22 * x * d) * (1 - x))
    boing = chirp_tone(f, ad_env(d, 0.004, 0.08)) + 0.25 * chirp_tone(2 * f, ad_env(d, 0.004, 0.05))
    pan = c["pan"][0] + (c["pan"][1] - c["pan"][0]) * x
    mix.add(fade(boing), c["t"], pan=pan, gain=0.05, rl=0.2)
    mix.add(tink(penta(12), 0.7, rg), c["land"], pan=c["pan"][1], gain=0.05, rs=0.2, rl=0.4)
    mix.add(tink(penta(14), 0.4, rg), c["land"] + 0.07, pan=c["pan"][1] + 0.1, gain=0.025, rl=0.4)
    pat = lp(rg.standard_normal(secs(0.05)), 900) * ad_env(0.05, 0.001, 0.01)
    mix.add(fade(pat), c["land"], pan=c["pan"][1], gain=0.03)


def fx_lantern(mix):
    c = CUES["lantern"]
    rg = R(108)
    d = c["t1"] - c["t0"]
    # paper crinkle: dense micro-clicks + soft paper noise
    base = bp(rg.standard_normal(secs(d)), 1500, 7000) * hump(secs(d), 0.4, 1.0)
    mix.add(fade(base), c["t0"], pan=c["pan"], gain=0.012, rs=0.2)
    for _ in range(170):
        tt = rg.beta(2, 2.5) * d
        s = bp(rg.standard_normal(secs(0.004)), 1800, 8000) * ad_env(0.004, 0.0002, 0.001)
        mix.add(s, c["t0"] + tt, pan=c["pan"] + rg.uniform(-0.25, 0.25), gain=0.03 * rg.lognormal(0, 0.5))
    # little hop in
    n = secs(0.12)
    f = 520 * 2 ** (0.9 * np.linspace(0, 1, n))
    mix.add(fade(chirp_tone(f, ad_env(0.12, 0.003, 0.04))), c["chime"] - 0.12, pan=c["pan"], gain=0.03, rl=0.2)
    # warm chime chord (root/fifth/octave) + glow swell
    for deg, p, a in [(0, -0.2, 1.0), (3, 0.2, 0.7), (5, 0.0, 0.55), (7, 0.1, 0.3)]:
        s = bell(penta(deg), 3.2, WARM[0], [x * 1.3 for x in WARM[1]], WARM[2], rg, attack=0.003, trem=0.2)
        mix.add(s, c["chime"] + deg * 0.012, pan=p, gain=0.04 * a, rs=0.15, rl=0.5)
    dg = 2.0
    tg = ts(secs(dg))
    glow = (np.sin(TAU * 146.8 * tg) + 0.5 * np.sin(TAU * 220.2 * tg)) * hump(len(tg), 0.2, 2)
    mix.add(fade(glow), c["chime"] - 0.05, gain=0.02)


def clack(rg, surface, foot):
    """geta: two-part 'kara-kon' clack. stone = bright short modes, wood = hollow lower modes."""
    if surface == "stone":
        fr, tau = [1150, 2330, 3560, 5100], [0.028, 0.018, 0.012, 0.008]
    else:
        fr, tau = [430, 990, 1680, 2650], [0.035, 0.025, 0.018, 0.01]
    k = (1.0 if foot else 0.93) * rg.uniform(0.95, 1.05)
    d = 0.25
    y = np.zeros(secs(d))
    for hit, a in [(0.0, 1.0), (rg.uniform(0.018, 0.03), 0.5)]:
        s = bell(k * fr[0], 0.2, [f / fr[0] for f in fr], tau, [1, 0.7, 0.45, 0.25], rg, attack=0.0003, detune=0.01)
        click = hp(rg.standard_normal(secs(0.004)), 3000) * ad_env(0.004, 0.0001, 0.0008) * 0.8
        s[:len(click)] += click
        if surface == "wood":
            s += lp(rg.standard_normal(len(s)), 300) * np.exp(-ts(len(s)) / 0.02) * 1.5
        place(y, secs(hit), s * a)
    return fade(y, 0.0003, 0.03)


def fx_run_s5(mix, duck):
    c = CUES["run_s5"]
    rg = R(109)
    surf = c["surfaces"]
    tt, k = c["t0"], 0
    while tt < c["t1"] - 0.05:
        s_name = [s for (t_, s) in surf if t_ <= tt + 1e-6][-1]
        p = 0.12 * np.sin(TAU * 0.25 * (tt - c["t0"])) + (0.08 if k % 2 else -0.08)
        mix.add(clack(rg, s_name, k % 2), tt + rg.uniform(-0.008, 0.008), pan=p, gain=0.12 * duck(tt) * rg.uniform(0.8, 1.0), rs=0.35)
        if k % 2 == 0:
            mix.add(cloth(rg, 0.18), tt + 0.04, pan=p, gain=0.012 * duck(tt))
        if k % 4 == 1:  # lantern handle creak/jiggle
            n = secs(0.07)
            cr = bp(rg.standard_normal(n), 700, 1600) * (0.5 - 0.5 * np.cos(TAU * 45 * ts(n))) * hump(n, 0.3)
            mix.add(fade(cr), tt + 0.06, pan=p + 0.1, gain=0.008)
        k += 1
        x = (tt - c["t0"]) / (c["t1"] - c["t0"])
        tt += 1 / (c["rate"][0] + (c["rate"][1] - c["rate"][0]) * x)


def fx_shoji(mix):
    c = CUES["shoji"]
    rg = R(110)
    for t0, p0 in zip(c["times"], c["pans"]):
        d = c["dur"] * rg.uniform(0.92, 1.05)
        n = secs(d)
        x = np.linspace(0, 1, n)
        rough = 0.55 + 0.45 * np.abs(smooth_rand(n, 45, rg))
        fr = sweep_noise(n, 1100 * rg.uniform(0.85, 1.15) * (1 + 0.25 * x), 0.7, rg) * rough * seg_env(d, 0.05, 0.06) * (1 - 0.3 * x)
        rum = lp(rg.standard_normal(n), 260) * rough * seg_env(d, 0.05, 0.05)
        rum /= np.std(rum) + 1e-9
        pan = p0 - 0.15 * x        # camera scrolls right → houses drift left
        mix.add(fade(fr + 0.6 * rum), t0, pan=pan, gain=0.022, rs=0.4)
        stop = bell(310 * rg.uniform(0.9, 1.1), 0.25, [1, 2.3, 3.9], [0.05, 0.03, 0.015], [1, 0.5, 0.3], rg, attack=0.0005)
        stop += lp(rg.standard_normal(len(stop)), 500) * np.exp(-ts(len(stop)) / 0.015)
        mix.add(fade(stop), t0 + d, pan=float(pan[-1]), gain=0.045, rs=0.4)


def fx_orbs(mix):
    c = CUES["orbs"]
    rg = R(111)
    for i, (tl, ta, p0) in enumerate(zip(c["liftoff"], c["arrive"], c["pan_from"])):
        pt = c["pan_to"]
        # gather: light pooling at the window — soft rising glints
        g0 = tl - c["gather_lead"]
        k = 10
        gt = np.sort(rg.random(k) ** 0.7) * c["gather_lead"]
        sparkle_cloud(mix, g0 + gt, p0 + rg.uniform(-0.1, 0.1, k),
                      [penta(rg.integers(11, 15) + int(4 * g / c["gather_lead"])) for g in gt],
                      rg.uniform(0.03, 0.08, k), 0.004 + 0.01 * gt / c["gather_lead"], rg, rl=0.4)
        # lift-off: tiny airy "pop" + glint
        mix.add(tink(penta(12 + i), 0.25, rg), tl, pan=p0, gain=0.018, rl=0.4)
        puff = bp(rg.standard_normal(secs(0.12)), 1500, 6000) * hump(secs(0.12), 0.2, 2)
        mix.add(puff, tl, pan=p0, gain=0.01)
        # float to the lantern: soft air + sparkle trail
        d = max(ta - tl, 0.2)
        n = secs(d)
        x = np.linspace(0, 1, n)
        pan = p0 + (pt - p0) * x
        mix.add(whoosh(n, 2200 * 2 ** (0.8 * x), hump(n, 0.6, 2), pan, 0.2, rg, 0.8), tl, gain=0.012, rl=0.3)
        k = 12
        gt = np.sort(rg.random(k)) * d
        sparkle_cloud(mix, tl + gt, p0 + (pt - p0) * gt / d, [penta(rg.integers(13, 20)) for _ in range(k)],
                      rg.uniform(0.03, 0.1, k), rg.uniform(0.005, 0.012, k), rg)
        # arrival 'thank-you' chime, rising through the scale as the lantern fills
        base = 5 + i
        for j, deg in enumerate([base, base + 2, base + 4]):
            mix.add(tink(penta(deg), 0.9 - 0.2 * j, rg, kind=GLASS, trem=0.2), ta + j * 0.085,
                    pan=pt + 0.12 * (j - 1), gain=0.05 * (0.85 ** j), rs=0.2, rl=0.5)
        glow = bell(penta(base - 5) / 2, 1.2, [1, 2, 3], [0.5, 0.3, 0.2], [1, 0.3, 0.1], rg, attack=0.03)
        mix.add(glow, ta, pan=pt, gain=0.02, rl=0.3)          # lantern pulse (warm low tone)


def fx_swarm(mix):
    """many small orbs arriving (accelerating) over a rising shimmer bed."""
    c = CUES["swarm"]
    rg = R(112)
    b0, b1 = c["bed"]
    d = b1 - b0
    n = secs(d)
    x = np.linspace(0, 1, n)
    tl = ts(n)
    pan = 0.7 * np.sin(TAU * (0.6 + 1.2 * x) * tl)
    amp = x ** 1.5 * seg_env(d, 0.3, 0.2)
    mix.add(whoosh(n, 1600 * 2 ** (2.2 * x), amp, pan, 0.6, rg, 0.9), b0, gain=0.04, rl=0.3)
    tt = 0.0
    while tt < d:                                     # shimmer grains, density rising
        xx = tt / d
        tt += rg.exponential(1 / (25 + 140 * xx ** 1.5))
        if tt >= d:
            break
        pp = 0.8 * np.sin(TAU * (0.6 + 1.2 * xx) * tt) + rg.uniform(-0.2, 0.2)
        mix.add(tink(penta(rg.integers(10, 16) + int(6 * xx)), rg.uniform(0.04, 0.15), rg), b0 + tt,
                pan=float(np.clip(pp, -1, 1)), gain=0.014 * (0.4 + 0.6 * xx) * rg.uniform(0.4, 1.0), rs=0.1, rl=0.45)
    # the arrivals: small chimes into the lantern, accelerating
    k = c["arrivals"]
    times = c["t0"] + (c["t1"] - c["t0"]) * (np.arange(k) / (k - 1)) ** c["accel"]
    for i, ta in enumerate(times):
        xx = i / (k - 1)
        deg = int(10 + 8 * xx + rg.choice([-1, 0, 0, 1]))
        mix.add(tink(penta(deg), rg.uniform(0.15, 0.35), rg), ta + rg.uniform(-0.01, 0.01),
                pan=float(CUES["orbs"]["pan_to"] + rg.uniform(-0.3, 0.3)), gain=0.022 * rg.uniform(0.6, 1.0), rs=0.15, rl=0.45)


def fx_blaze_flood(mix):
    """lantern blazing (warm swelling roar + pad) and the light flood that peaks at the scene cut."""
    rg = R(120)
    c = CUES["blaze"]
    d = c["t1"] - c["t0"] + 0.6
    n = secs(d)
    x = np.linspace(0, 1, n)
    amp = x ** 1.6 * seg_env(d, 0.2, 0.6)
    mix.add(whoosh(n, 500 * 2 ** (0.8 * x), amp, 0.05, 0.3, rg, 0.9), c["t0"], gain=0.035, rs=0.2)
    tl = ts(n)
    pad = sum(np.sin(TAU * penta(dg) / 4 * tl + rg.uniform(0, TAU)) * a_ for dg, a_ in [(0, 1), (3, 0.6), (5, 0.5), (7, 0.25)])
    mix.add(fade(pad * amp), c["t0"], pan=0.05, gain=0.012, rl=0.3)
    f = CUES["flood"]
    d = f["peak"] - f["t0"] + f["tail"]
    n = secs(d)
    x = np.linspace(0, 1, n)
    pk = (f["peak"] - f["t0"]) / d
    env = np.where(x < pk, (x / pk) ** 2.5, np.exp(-(x - pk) * d / 0.35))
    mix.add(whoosh(n, 3000 * 2 ** (1.2 * np.minimum(x / pk, 1)), fade(env, 0.01, 0.2), 0.0, 1.0, rg, 1.1),
            f["t0"], gain=0.07, rl=0.5)


def fx_passby(mix):
    """foreground objects sweeping past the side-scrolling camera (right → left)."""
    rg = R(121)
    c = CUES["passby"]
    for t0 in c["posts"]:             # telephone post: quick dark whoosh
        d = 0.5
        n = secs(d)
        x = np.linspace(0, 1, n)
        mix.add(whoosh(n, 700 * 2 ** (-0.8 * x), hump(n, 0.45, 2), 0.8 - 1.6 * x, 0.1, rg, 0.8),
                t0 - d * 0.45, gain=0.035)
    for t0 in c["lanterns"]:          # overhead lantern cluster: airy whoosh + paper/wood creak
        d = 0.7
        n = secs(d)
        x = np.linspace(0, 1, n)
        mix.add(whoosh(n, 1800 * 2 ** (-0.6 * x), hump(n, 0.45, 2), 0.7 - 1.4 * x, 0.4, rg, 0.9),
                t0 - d * 0.45, gain=0.02, rl=0.15)
        for j in range(3):
            nn = secs(0.09)
            cr = bp(rg.standard_normal(nn), 600, 1800) * (0.5 - 0.5 * np.cos(TAU * rg.uniform(30, 55) * ts(nn))) * hump(nn, 0.3)
            mix.add(fade(cr), t0 + j * 0.13 - 0.1, pan=0.3 - 0.3 * j, gain=0.01)


def fx_hill_wind(mix):
    c = CUES["hill_wind"]
    rg = R(113)
    d = c["end"] - c["t"] + 0.6
    n = secs(d)
    x = np.linspace(0, 1, n)
    pk = (c["peak"] - c["t"] + 0.6) / d
    amp = hump(n, pk, 1.6)
    fc = 280 * 2 ** (1.6 * amp)
    mix.add(whoosh(n, fc, amp, 0.2 * np.sin(TAU * 0.3 * ts(n)), 0.8, rg, 1.0), c["t"] - 0.6, gain=0.11, rs=0.1)
    gr = bp(rg.standard_normal((2, n)), 2500, 9500) * (np.abs(smooth_rand(n, 25, rg)) ** 2 + 0.2) * amp ** 2
    mix.add(gr, c["t"] - 0.6, gain=0.06)


def fx_emerge(mix):
    c = CUES["kira_emerges"]
    rg = R(114)
    for deg, p in [(10, -0.4), (12, 0.35), (13, -0.1), (15, 0.15), (17, 0.5)]:
        s = bell(penta(deg), 4.0, GLASS[0], [2.0, 0.9, 0.45, 0.25], [1, 0.2, 0.08, 0.03], rg, attack=0.5, trem=0.25)
        mix.add(s, c["t"] - 0.15 + 0.07 * (deg - 10), pan=p, gain=0.03, rl=0.6)
    k = 90
    gt = rg.beta(1.8, 3.0, k) * c["dur"]
    sparkle_cloud(mix, c["t"] - 0.1 + gt, rg.uniform(-0.8, 0.8, k), [penta(rg.integers(11, 21)) for _ in range(k)],
                  rg.uniform(0.05, 0.25, k), rg.uniform(0.01, 0.03, k), rg, rl=0.5)
    d = 3.0
    tw = ts(secs(d))
    whum = (np.sin(TAU * 73.4 * tw) + 0.4 * np.sin(TAU * 110.0 * tw)) * hump(len(tw), 0.3, 2)
    mix.add(fade(whum), c["t"] - 0.3, gain=0.03)


def fx_forehead(mix):
    c = CUES["forehead_touch"]
    rg = R(115)
    s = bell(penta(10), 4.0, WARM[0], [x * 2.4 for x in WARM[1]], WARM[2], rg, attack=0.004, trem=0.15)
    mix.add(s, c["t"], pan=c["pan"], gain=0.045, rs=0.1, rl=0.55)
    for i, deg in enumerate([15, 17, 19, 22]):
        mix.add(tink(penta(deg), 0.5, rg), c["t"] + 0.12 + 0.09 * i, pan=0.25 * (i - 1.5), gain=0.01, rl=0.5)


def fx_launch(mix):
    c = CUES["launch"]
    rg = R(116)
    d = c["t1"] - c["t0"]
    n = secs(d)
    x = np.linspace(0, 1, n)
    amp = (0.15 + 0.85 * x ** 1.8) * seg_env(d, 0.08, 0.03)
    fc = 300 * 2 ** (4.8 * x ** 1.3)
    width = 0.9 - 0.8 * np.clip(x / 0.9, 0, 1) ** 1.2      # narrows as it climbs away
    mix.add(whoosh(n, fc, amp, c["pan"], width, rg, 0.8), c["t0"], gain=0.24, rs=0.1, rl=0.3)
    f = 220 * 2 ** (3.0 * x ** 1.2)
    tone = (chirp_tone(f, 1) + chirp_tone(f * 1.5, 0.5) + chirp_tone(f * 2.004, 0.35)) * x ** 1.5 * seg_env(d, 0.2, 0.03)
    mix.add(fade(tone), c["t0"], pan=c["pan"], gain=0.035, rl=0.35)
    rum = lp(rg.standard_normal(n), 120)
    mix.add(fade(rum / np.std(rum) * (1 - x) ** 1.5 * seg_env(d, 0.05, 0.1)), c["t0"], gain=0.05)
    k = 60
    gt = d * (1 - (1 - rg.random(k)) ** 0.6)
    sparkle_cloud(mix, c["t0"] + gt, rg.uniform(-0.25, 0.25, k) * (1 - gt / d),
                  [penta(rg.integers(10, 16) + int(5 * g / d)) for g in gt], rg.uniform(0.04, 0.15, k),
                  rg.uniform(0.01, 0.025, k), rg, rl=0.5)


def fx_burst(mix):
    c = CUES["burst"]
    rg = R(117)
    T0 = c["t"]
    # soft fwumm + airy blast (much gentler than the impact)
    d = 2.0
    t = ts(secs(d))
    f = 45 + 50 * np.exp(-t / 0.12)
    fw = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.45) * np.clip(t / 0.004, 0, 1)
    mix.add(fade(fw, 0.001, 0.8), T0, gain=0.3, rl=0.2)
    nb = secs(1.8)
    xb = np.linspace(0, 1, nb)
    mix.add(whoosh(nb, 9000 * 2 ** (-2.5 * xb), ad_env(1.8, 0.004, 0.35), 0.0, 1.0, rg, 1.2), T0, gain=0.12, rs=0.2, rl=0.4)
    # hundreds of tiny bell grains, stereo-wide
    k = c["grains"]
    gt = np.concatenate([rg.exponential(0.3, int(k * 0.75)), rg.uniform(0.2, 2.0, k - int(k * 0.75))])
    degs = rg.integers(7, 24, k)
    taus = rg.uniform(0.06, 0.55, k) * np.where(degs > 17, 0.5, 1.0)
    amps = 0.03 * rg.lognormal(0, 0.45, k) * np.exp(-gt / 1.2)
    pans = np.clip(rg.normal(0, 0.65, k), -1, 1)
    sparkle_cloud(mix, T0 + gt, pans, [penta(d_) for d_ in degs], taus, amps, rg, rs=0.1, rl=0.55)


def fx_shower(mix):
    c = CUES["shower"]
    rg = R(118)
    span = c["t1"] - c["t0"]
    for _ in range(c["whooshes"]):
        t0 = c["t0"] + 0.2 + span * rg.beta(1.1, 2.0)
        d = rg.uniform(0.3, 0.8)
        n = secs(d)
        x = np.linspace(0, 1, n)
        p0 = rg.uniform(-0.9, 0.9)
        p1 = np.clip(p0 + rg.choice([-1, 1]) * rg.uniform(0.3, 0.7), -1, 1)
        fall = np.exp(-(t0 - c["t0"]) / 2.5)
        mix.add(whoosh(n, 7500 * 2 ** (-1.4 * x), hump(n, 0.35, 1.5), p0 + (p1 - p0) * x, 0.1, rg, 0.7),
                t0, gain=0.03 * (0.35 + 0.65 * fall) * rg.uniform(0.5, 1.0), rl=0.35)
        mix.add(tink(penta(rg.integers(14, 22)), rg.uniform(0.15, 0.4), rg), t0 + d * 0.8, pan=float(p1),
                gain=0.012 * (0.4 + 0.6 * fall), rl=0.5)
    # continuous twinkle bed, thinning out
    tt = c["t0"] + 0.3
    end = c["t1"] + 0.6
    while tt < end:
        xx = (tt - c["t0"]) / (end - c["t0"])
        tt += rg.exponential(1 / (30 * (1 - xx) ** 2 + 2))
        mix.add(tink(penta(rg.integers(12, 23)), rg.uniform(0.05, 0.3), rg), tt, pan=rg.uniform(-1, 1),
                gain=0.008 * (1 - 0.7 * xx) * rg.uniform(0.3, 1.0), rl=0.5)


def fx_constellation(mix):
    c = CUES["constellation"]
    rg = R(119)
    k = c["ticks"]
    times = np.linspace(c["t0"], c["t1"], k) + rg.uniform(-0.04, 0.04, k)
    deg, p = 10, -0.7
    for i, t0 in enumerate(times):
        deg = int(np.clip(deg + rg.choice([-1, 1, 1, 2]), 8, 20))
        p = float(np.clip(p + rg.uniform(-0.1, 0.3), -0.8, 0.8))
        mix.add(tink(penta(deg), rg.uniform(0.25, 0.5), rg), t0, pan=p, gain=0.035, rs=0.1, rl=0.45)
        mix.add(tink(penta(deg) * 4.01, 0.02, rg), t0, pan=p, gain=0.012)   # glassy "tick" transient
        if i < k - 1:   # thin line of light drawn to the next star
            d = times[i + 1] - t0
            n = secs(d)
            line = chirp_tone(np.full(n, penta(deg + 5)), hump(n, 0.2, 2)) * 0.3
            mix.add(fade(line), t0 + 0.02, pan=p, gain=0.004, rl=0.3)


# =============================================================================
# main
# =============================================================================
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "audio", "sfx.wav"))
    args = ap.parse_args()

    t = ts(N)
    mask, _ = dialogue_mask()
    bed_duck = 1 - (1 - BED_DIALOGUE_DUCK) * mask

    def foley_duck(tt):
        return 1 - (1 - FOLEY_DIALOGUE_DUCK) * float(np.interp(tt, t[::480], mask[::480]))

    mix = Mix()

    # ---------------- beds ----------------
    h = CUES["hush"]
    hush_all = np.where(t < h["t"], 1.0, 0.0) + ramp(t, *h["recover"]) * (t >= h["t"])
    hush_all = np.maximum(hush_all, np.clip(1 - (t - h["t"]) / 0.05, 0, 1) * (t >= h["t"]))
    hush_frogs = np.where(t < h["t"], 1.0, 0.0) + ramp(t, *h["frogs_recover"]) * (t >= h["t"])
    hush_frogs = np.maximum(hush_frogs, np.clip(1 - (t - h["t"]) / 0.05, 0, 1) * (t >= h["t"]))
    a = CUES["ambience_in"]
    f = CUES["fade_out"]
    master_bed = ramp(t, a["t0"], a["t1"]) * (1 - ramp(t, f["t0"] - 1.0, f["t1"])) * bed_duck

    print("beds: crickets"); cr = bed_crickets()
    print("beds: frogs"); fr = bed_frogs()
    print("beds: wind"); valley_gust = gust_curve(31, 0.45)
    wd = bed_wind(valley_gust, 380, 1.1, 32)
    hill_gust = gust_curve(33, 0.7)
    # stronger, gustier hill from the s6 swell onwards
    hill_gust = hill_gust * (1 + 0.5 * ramp(t, CUES["hill_wind"]["t"], CUES["hill_wind"]["peak"]))
    print("beds: hill"); hw = bed_wind(hill_gust, 520, 1.0, 34)
    print("beds: grass"); gs = bed_grass(hill_gust)
    print("beds: town"); tw = bed_town()

    cr_delay = ramp(t, h["recover"][0] + h["crickets_delay"], h["recover"][1] + h["crickets_delay"])
    cr_hush = np.where(t < h["t"], 1.0, cr_delay)
    for name, sig, hsh, rs in [("crickets", cr, cr_hush, 0.15), ("frogs", fr, hush_frogs, 0.5),
                               ("wind", wd, hush_all, 0.0), ("hill", hw, hush_all, 0.0),
                               ("grass", gs, hush_all, 0.0), ("town", tw, hush_all, 0.3)]:
        g = scene_curve(name) * hsh * master_bed * db(BED_DB[name])
        mix.add(sig * g, 0.0, rs=rs, rl=rs * 0.5)

    # ---------------- effects ----------------
    print("fx ...")
    fx_shooting_star(mix)
    fx_star_turn(mix)
    fx_impact(mix)
    fx_crater(mix)
    fx_run_s3(mix, foley_duck)
    fx_sobs(mix)
    fx_hop(mix)
    fx_lantern(mix)
    fx_run_s5(mix, foley_duck)
    fx_shoji(mix)
    fx_orbs(mix)
    fx_swarm(mix)
    fx_blaze_flood(mix)
    fx_passby(mix)
    fx_hill_wind(mix)
    fx_emerge(mix)
    fx_forehead(mix)
    fx_launch(mix)
    fx_burst(mix)
    fx_shower(mix)
    fx_constellation(mix)

    print("reverb ...")
    irs = make_ir(0.9, 1.3, 0.012, 3500, 901)
    irl = make_ir(3.4, 4.5, 0.03, 2500, 902)
    out = mix.dry.copy()
    for send, ir, g in [(mix.rs, irs, 0.5), (mix.rl, irl, 0.55)]:
        for ch in range(2):
            out[ch] += g * signal.fftconvolve(send[ch], ir[ch])[:N]

    out = hp(out, 18, 2)
    out *= 1 - ramp(t, f["t0"], f["t1"])          # everything to silence by 60.0
    out = fade(out, 0.005, 0.05)
    pk = np.max(np.abs(out))
    out *= db(PEAK_DBFS) / pk
    sf.write(args.out, out.T.astype(np.float32), SR, subtype="PCM_24")
    print(f"wrote {args.out}  {out.shape[1] / SR:.3f}s  peak {20 * np.log10(np.max(np.abs(out))):.2f} dBFS")
    print("cue list:")
    for k, v in CUES.items():
        print(f"  {k:16s} {v}")


if __name__ == "__main__":
    main()
