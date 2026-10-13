# Earl Grey's voice

The tour plays one recorded clip per chatbox line, from `public/voice/tutorial/<chapter>-<n>.ogg`
(`welcome-1`, `welcome-2`, `gems-1`…). The clips are cut from one recording of the whole script, read
in order. They ship with the site, so nothing goes to the asset server.

## Cutting a new recording

1. Put the recording here as `tutorial-raw.mp3` (or pass its path below). Raw recordings stay out of
   git.
2. Get the words and when each is said. [uv](https://docs.astral.sh/uv/) fetches
   [faster-whisper](https://github.com/SYSTRAN/faster-whisper) and its model (about 500 MB) the
   first time:

   ```sh
   uv run --no-project --with faster-whisper python -I tools/voice/transcribe.py tools/voice/tutorial-raw.mp3 tools/voice/tutorial-words.json
   ```

3. Cut it. This needs ffmpeg:

   ```sh
   node tools/voice/split.mjs
   ```

   It matches the words to the lines of `src/tutorial/script.ts` and stops if the recording says
   something else. Each cut lands in the pause between two lines. Every clip gets the same gain, so
   the loudest moment of the take sits at -16 LUFS, as for the sound effects (`docs/sounds.md`). It
   writes the clips and `src/tutorial/voice.json` (each clip's text and length).

4. Listen through the tour (**How to play**).

## Changing a line

A line plays its clip only while its text matches what was recorded (`voice.json`). A reworded line
goes silent, and `script.spec.ts` fails until it is recorded again. To fix one line, record it
again, then cut a recording of the whole script again or cut the new line by hand with ffmpeg and
update its entry in `voice.json`.

## In the tour

- Lines move on by click, as before. A new line fades the last clip out in 80 ms, so clicking
  through never stacks voices. Going back, jumping to a chapter, skipping or finishing stops him.
- The chatbox types in step with the clip, finishing just before he does. When he isn't heard
  (muted, or the effects volume at 0) it types at its usual speed.
- The voice follows the effects volume and the mute. The music dips while he speaks.
- The next line's clip loads while the current one plays.
