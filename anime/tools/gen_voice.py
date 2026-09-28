"""Synthesize every dialogue line with a local VOICEVOX engine and extract
mora-level timings for lip-sync.

Usage: python3 gen_voice.py  (engine must listen on localhost:50021)
Outputs audio/voice/<id>.wav and audio/voice/lipsync.json
"""
import json
import pathlib
import urllib.parse
import urllib.request

import soundfile as sf

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENGINE = "http://127.0.0.1:50021"
OUT = ROOT / "audio" / "voice"

# per-character tuning: speed, pitch, intonation
TUNE = {
    "narrator": dict(speedScale=0.92, pitchScale=0.0, intonationScale=1.1),
    "hina": dict(speedScale=1.12, pitchScale=0.02, intonationScale=1.35),
    "kira": dict(speedScale=1.12, pitchScale=0.03, intonationScale=1.3),
    "grandpa": dict(speedScale=1.0, pitchScale=0.0, intonationScale=1.2),
    "kid": dict(speedScale=1.05, pitchScale=0.02, intonationScale=1.5),
}


def post(path, params, body=None):
    url = f"{ENGINE}{path}?{urllib.parse.urlencode(params)}"
    data = json.dumps(body).encode() if body is not None else b""
    req = urllib.request.Request(url, data=data, method="POST",
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return r.read()


def mouth_track(q):
    """Turn an audio_query into [(t_start, t_end, vowel)] in seconds."""
    speed = q["speedScale"]
    t = q["prePhonemeLength"] / speed
    track = []
    for ap in q["accent_phrases"]:
        for m in ap["moras"]:
            if m.get("consonant_length"):
                c = m["consonant_length"] / speed
                # bilabials close the mouth, other consonants keep it half open
                shape = "x" if m["consonant"] in ("m", "b", "p", "my", "by", "py") else "c"
                track.append([round(t, 3), round(t + c, 3), shape])
                t += c
            v = m["vowel_length"] / speed
            vowel = m["vowel"].lower()
            if vowel == "cl":
                vowel = "x"
            track.append([round(t, 3), round(t + v, 3), vowel])
            t += v
        if ap.get("pause_mora"):
            p = ap["pause_mora"]["vowel_length"] / speed
            track.append([round(t, 3), round(t + p, 3), "x"])
            t += p
    return track


def main():
    lines = json.loads((ROOT / "story" / "lines.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {}
    for ln in lines:
        q = json.loads(post("/audio_query", {"text": ln["text"], "speaker": ln["style"]}))
        q.update(TUNE[ln["who"]])
        q["prePhonemeLength"] = 0.05
        q["postPhonemeLength"] = 0.1
        q["outputSamplingRate"] = 48000
        wav = post("/synthesis", {"speaker": ln["style"]}, q)
        path = OUT / f"{ln['id']}.wav"
        path.write_bytes(wav)
        info = sf.info(str(path))
        meta[ln["id"]] = {
            "who": ln["who"],
            "sub": ln["sub"],
            "duration": round(info.duration, 3),
            "mouth": mouth_track(q),
        }
        print(f"{ln['id']:4s} {info.duration:5.2f}s  {ln['text']}")
    (OUT / "lipsync.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    print("total speech", round(sum(m["duration"] for m in meta.values()), 2))


if __name__ == "__main__":
    main()
