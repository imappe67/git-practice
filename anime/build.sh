#!/usr/bin/env bash
# Build 「ほしまいご」 from source.
#   Requires: a VOICEVOX engine on localhost:50021 (only for regenerating voices),
#   python3 + numpy/scipy/soundfile, node + playwright chromium, ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"

if [[ "${VOICES:-0}" == "1" ]]; then python3 tools/gen_voice.py; fi
python3 tools/gen_music.py
python3 tools/gen_sfx.py
python3 tools/mix.py
node render/render.mjs video --workers "${WORKERS:-4}" --out out/video_noaudio.mp4
ffmpeg -y -loglevel error -i out/video_noaudio.mp4 -i audio/mix.wav \
  -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart out/hoshimaigo.mp4
echo "done: out/hoshimaigo.mp4"
