"""Final audio mix: dialogue + music (ducked under speech) + sfx -> audio/mix.wav

Dialogue is placed from story/timeline.json. Music is side-chain ducked by a
smoothed speech envelope; everything is summed, lightly glued and limited.
"""
import json
import pathlib

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = pathlib.Path(__file__).resolve().parent.parent
SR = 48000


def load(path, dur):
    n = int(dur * SR)
    if not path.exists():
        print("missing", path)
        return np.zeros((n, 2))
    x, sr = sf.read(str(path), always_2d=True)
    assert sr == SR, (path, sr)
    if x.shape[1] == 1:
        x = np.repeat(x, 2, axis=1)
    out = np.zeros((n, 2))
    m = min(n, len(x))
    out[:m] = x[:m]
    return out


def room(x, seed, decay=0.35, mix=0.12):
    """Tiny synthetic room so voices sit in the scene instead of on top of it."""
    rng = np.random.default_rng(seed)
    n = int(decay * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / (decay / 6.9))[:, None]
    ir = sosfilt(butter(2, 5000, "low", fs=SR, output="sos"), ir, axis=0)
    ir /= np.sqrt((ir ** 2).sum(axis=0))
    wet = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)
    return x + mix * wet


def envelope(x, attack=0.03, release=0.35):
    """Peak-ish follower of a mono signal (one-pole attack/release)."""
    a = np.exp(-1 / (attack * SR))
    r = np.exp(-1 / (release * SR))
    e = np.zeros_like(x)
    prev = 0.0
    ax = np.abs(x)
    for i in range(0, len(x), 64):          # block-rate follower is plenty
        v = ax[i:i + 64].max()
        coef = a if v > prev else r
        prev = coef ** 64 * prev + (1 - coef ** 64) * v
        e[i:i + 64] = prev
    return e


def limiter(x, ceiling=0.89, look=0.005, release=0.08):
    peak = np.abs(x).max(axis=1)
    k = int(look * SR)
    # running max over look-ahead window
    from scipy.ndimage import maximum_filter1d
    pk = maximum_filter1d(peak, size=2 * k + 1)
    gain = np.minimum(1.0, ceiling / np.maximum(pk, 1e-9))
    r = np.exp(-1 / (release * SR))
    g = np.empty_like(gain)
    prev = 1.0
    for i in range(len(gain)):
        prev = gain[i] if gain[i] < prev else r * prev + (1 - r) * gain[i]
        g[i] = prev
    return x * g[:, None]


def main():
    tl = json.loads((ROOT / "story/timeline.json").read_text())
    ls = json.loads((ROOT / "audio/voice/lipsync.json").read_text())
    dur = tl["duration"]
    n = int(dur * SR)

    # --- dialogue bus
    voice = np.zeros((n, 2))
    pans = {"narrator": 0.0, "hina": -0.08, "kira": 0.1, "grandpa": 0.25, "kid": 0.35}
    for i, d in enumerate(tl["dialogue"]):
        x, sr = sf.read(str(ROOT / f"audio/voice/{d['id']}.wav"), always_2d=True)
        x = x[:, 0]
        who = ls[d["id"]]["who"]
        gain = {"narrator": 0.95, "kid": 0.8, "grandpa": 0.9}.get(who, 1.0)
        p = pans[who]
        st = np.stack([x * np.cos((p + 1) * np.pi / 4), x * np.sin((p + 1) * np.pi / 4)], axis=1) * np.sqrt(2) * gain
        s = int(d["start"] * SR)
        e = min(n, s + len(st))
        voice[s:e] += st[: e - s]
    # warm up the voices a touch (gentle presence + low cut)
    voice = sosfilt(butter(2, 90, "high", fs=SR, output="sos"), voice, axis=0)
    voice = room(voice, 7)

    music = load(ROOT / "audio/music.wav", dur)
    sfx = load(ROOT / "audio/sfx.wav", dur)

    # --- side-chain ducking of music (and a little of sfx) under speech
    env = envelope(voice.mean(axis=1), attack=0.05, release=0.6)
    env = env / (env.max() + 1e-9)
    duck_music = 1.0 - 0.55 * np.clip(env * 3, 0, 1)
    duck_sfx = 1.0 - 0.3 * np.clip(env * 3, 0, 1)

    mix = voice * 1.0 + music * 0.62 * duck_music[:, None] + sfx * 0.7 * duck_sfx[:, None]

    # --- master: gentle glue + limiter + fades
    mix = limiter(mix * 1.0)
    fade = int(0.02 * SR)
    mix[:fade] *= np.linspace(0, 1, fade)[:, None]
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    # loudness-ish normalisation to about -16 dBFS RMS in the loud parts
    rms = np.sqrt(np.mean(mix ** 2))
    print(f"mix rms {20 * np.log10(rms + 1e-9):.1f} dBFS, peak {20 * np.log10(np.abs(mix).max() + 1e-9):.1f} dBFS")
    sf.write(str(ROOT / "audio/mix.wav"), mix.astype(np.float32), SR, subtype="PCM_24")
    print("wrote audio/mix.wav")


if __name__ == "__main__":
    main()
