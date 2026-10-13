# Writes the word timings of a recording as JSON, for split.mjs to cut it into lines.
# Usage (uv fetches faster-whisper and its model the first time):
#   uv run --no-project --with faster-whisper python -I tools/voice/transcribe.py tools/voice/tutorial-raw.mp3 tools/voice/tutorial-words.json
import json
import sys

from faster_whisper import WhisperModel

model = WhisperModel("small.en", device="cpu", compute_type="int8")
segments, _ = model.transcribe(sys.argv[1], word_timestamps=True, beam_size=5)
words = [
    {"w": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)}
    for segment in segments
    for w in segment.words
]
with open(sys.argv[2], "w", encoding="utf-8") as out:
    json.dump(words, out, indent=0)
print(" ".join(w["w"] for w in words))
