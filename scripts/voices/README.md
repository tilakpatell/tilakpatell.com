# The crews' voices

Most of what the crews say on the universe map, in the galaxy and in the
cockpit has no recording, so it plays as blips. These scripts make those
lines in the speakers' own voices: F5-TTS clones each voice from a few
seconds of the clips the site already has and says every unrecorded line
with it. The site plays a generated line wherever there's no clip, moves the
speaker's mouth with it, and falls back to the blips for anything not made.

Everything generated stays on this machine. `public/audio/voiced/`,
`scripts/voices/cache/`, `scripts/voices/refs/` and `lines.json` are
git-ignored, and every build leaves `public/audio/voiced/` out (see
`vite.config.js`), so neither the public repository nor GitHub Pages ever
carries the cloned voices. You hear them with `npm run dev` here, or by
serving the folder from behind the sign-in and building with
`VITE_VOICED_BASE` set to its URL path (say `/private/voiced`).

## Setup (once)

1. Python 3.10 to 3.12, and ffmpeg on the PATH (or pass `--ffmpeg`).
2. PyTorch. With an NVIDIA card, install the CUDA build first, for example
   `pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128`.
   It runs on the CPU too, just much more slowly.
3. `pip install f5-tts` (and `pip install demucs` if you'll use `--clean`).

The first run downloads the F5-TTS model and Whisper (a few GB) from Hugging Face.

## Making the lines

```
npm run clips:fetch                            # the real clips in scripts/clips/wanted.json, some used as references
npm run voices:lines                           # list the lines with no recording (again after editing any)
python scripts/voices/generate.py --check      # build each voice's reference and show what Whisper heard in it
python scripts/voices/generate.py --limit 10   # make a few and listen
python scripts/voices/generate.py              # make the rest (it skips what's already made)
```

`npm run voices` does the last two steps in one go. About 680 lines: minutes
on a recent GPU, a few hours on a CPU. `--only walt,jesse` makes just those
speakers, `--force` makes lines again, `--nfe 16` is a faster rough pass.

## Getting a voice right

- **References.** `refs.json` lists the clips each voice is cloned from;
  they're joined into one reference of up to 11 seconds. To use your own
  instead, drop 5 to 11 seconds of the character talking, with no music, at
  `scripts/voices/refs/<who>.wav` (`morty`, `hank`). Morty and Hank have no
  clips on the site yet, so they need one before they're made; Luke has only
  three seconds, so a longer one helps him most.
- **Music under a clip** bleeds into the voice: `--clean` takes the score and
  effects out of each clip first (demucs).
- **Transcripts.** The clone follows what Whisper heard in the reference. If
  `--check` shows it misheard, correct `scripts/voices/cache/ref-<who>.txt`
  and run again.
- **Pace.** `"speed"` in `refs.json` slows a voice down or speeds it up
  (Walt 0.95, Jesse 1.05).
- **A bad line.** Delete its mp3 under `public/audio/voiced/<who>/` and run
  again; or `--force --only <who>` for the whole voice.
