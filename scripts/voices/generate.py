#!/usr/bin/env python3
"""The crews' unrecorded lines, made in their own voices.

Clones each speaker's voice from clips the site already has (refs.json) with
F5-TTS and says every line in scripts/voices/lines.json with it, into
public/audio/voiced/<who>/<id>.mp3, plus the manifest.json the site looks
lines up in (src/lib/voiced.js). That folder is git-ignored: the lines stay on
this machine, or wherever you serve them from behind the sign-in, and never
go out with the public repository or the GitHub Pages build.

    npm run voices:lines                          list the lines (again after editing any)
    python scripts/voices/generate.py --check     build the references, show what was heard
    python scripts/voices/generate.py --limit 10  try a few
    python scripts/voices/generate.py             make everything that's missing

Setup is in README.md beside this file.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / "scripts" / "voices"
OUT = ROOT / "public" / "audio" / "voiced"
CACHE = HERE / "cache"
REFS = HERE / "refs"
AUDIO = {".wav", ".mp3", ".m4a", ".flac", ".ogg"}
# F5-TTS cuts a reference longer than 12 seconds, which would leave its
# transcript describing audio it no longer has
MAX_REF = 11.0


def ffmpeg_path(given):
    path = given or os.environ.get("FFMPEG") or shutil.which("ffmpeg")
    if not path or not Path(path).exists() and not shutil.which(path):
        sys.exit("ffmpeg isn't on the PATH: install it, or pass --ffmpeg C:/path/to/ffmpeg.exe")
    # F5-TTS's silence trimming (pydub) looks for it on the PATH too
    os.environ["PATH"] = str(Path(path).resolve().parent) + os.pathsep + os.environ.get("PATH", "")
    return path


def run(cmd):
    r = subprocess.run([str(c) for c in cmd], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, errors="replace")
    if r.returncode:
        raise RuntimeError(f"{Path(str(cmd[0])).name} failed:\n{r.stderr[-1500:]}")


def duration(ff, f):
    """Seconds long, from what ffmpeg says about the file (ffprobe may not be there)."""
    r = subprocess.run([ff, "-hide_banner", "-i", str(f)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, errors="replace")
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]) if m else 0.0


def isolate_voice(f):
    """The voice alone, without the score or sound effects under it (demucs)."""
    out = CACHE / "demucs" / "htdemucs" / f.stem / "vocals.wav"
    if not out.exists():
        try:
            run([sys.executable, "-m", "demucs", "--two-stems=vocals", "-o", CACHE / "demucs", f])
        except RuntimeError as e:
            sys.exit(f"--clean needs demucs (pip install demucs):\n{e}")
    return out


def reference(who, cfg, ff, clean):
    """One reference recording for a speaker, at most MAX_REF long, and the file its transcript goes in.
    Your own scripts/voices/refs/<who>.wav (or .mp3, ...) wins over the clips in refs.json."""
    own = next((p for p in sorted(REFS.glob(f"{who}.*")) if p.suffix.lower() in AUDIO), None)
    sources = [own] if own else [ROOT / c for c in cfg.get("clips", [])]
    for s in sources:
        if not s.exists():
            print(f"  ({who}: {s.relative_to(ROOT)} isn't there, going without it)")
    picked, total = [], 0.0
    for s in (s for s in sources if s.exists()):
        d = duration(ff, s) + 0.3
        if picked and total + d > MAX_REF:
            continue
        picked.append(s)
        total += d
    if not picked:
        return None, None
    CACHE.mkdir(parents=True, exist_ok=True)
    wav, meta, txt = CACHE / f"ref-{who}.wav", CACHE / f"ref-{who}.json", CACHE / f"ref-{who}.txt"
    key = json.dumps({"from": [[str(p.relative_to(ROOT)), p.stat().st_size] for p in picked], "clean": clean})
    if wav.exists() and meta.exists() and meta.read_text(encoding="utf-8") == key:
        return wav, txt
    inputs = [isolate_voice(p) if clean else p for p in picked]
    cmd = [ff, "-y", "-hide_banner"]
    for i in inputs:
        cmd += ["-i", i]
    chains = "".join(f"[{n}:a]aresample=24000,aformat=channel_layouts=mono,apad=pad_dur=0.3[a{n}];" for n in range(len(inputs)))
    joined = "".join(f"[a{n}]" for n in range(len(inputs))) + f"concat=n={len(inputs)}:v=0:a=1,atrim=0:{MAX_REF}[out]"
    run(cmd + ["-filter_complex", chains + joined, "-map", "[out]", wav])
    meta.write_text(key, encoding="utf-8")
    txt.unlink(missing_ok=True)  # a new reference has to be heard again
    return wav, txt


def heard(f5, wav, txt):
    """What's said in the reference: Whisper's transcript the first time, then the saved (and maybe corrected) one."""
    if txt.exists() and txt.read_text(encoding="utf-8").strip():
        return txt.read_text(encoding="utf-8").strip()
    text = f5.transcribe(str(wav)).strip()
    txt.write_text(text + "\n", encoding="utf-8")
    return text


def speakable(text):
    """A line as the model should read it: no bracketed asides, plain punctuation."""
    t = re.sub(r"\[[^\]]*\]", "", text)
    for a, b in (("…", "..."), ("—", ", "), ("–", ", "), ("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"')):
        t = t.replace(a, b)
    return re.sub(r"\s+", " ", t).strip(" ,")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # the lines' curly quotes, on a Windows console
    ap = argparse.ArgumentParser(description="Make the crews' unrecorded lines in their own voices.")
    ap.add_argument("--only", help="just these speakers, comma-separated (walt,jesse)")
    ap.add_argument("--limit", type=int, help="make at most this many lines, to try it out")
    ap.add_argument("--check", action="store_true", help="build the references, show what was heard in each, and stop")
    ap.add_argument("--force", action="store_true", help="make lines again even if they're already there")
    ap.add_argument("--clean", action="store_true", help="take the music and effects out of the reference clips first (pip install demucs)")
    ap.add_argument("--device", help="cuda, mps or cpu (default: the fastest there is)")
    ap.add_argument("--nfe", type=int, default=32, help="quality steps: fewer is faster (16 for a quick pass), more is a little better")
    ap.add_argument("--ffmpeg", help="ffmpeg's path, if it isn't on the PATH")
    args = ap.parse_args()

    ff = ffmpeg_path(args.ffmpeg)
    lines_file = HERE / "lines.json"
    if not lines_file.exists():
        sys.exit("No scripts/voices/lines.json yet: run  npm run voices:lines  first")
    lines = json.loads(lines_file.read_text(encoding="utf-8"))
    cfgs = json.loads((HERE / "refs.json").read_text(encoding="utf-8"))
    only = set(args.only.split(",")) if args.only else None

    try:
        from f5_tts.api import F5TTS
    except ImportError:
        sys.exit("F5-TTS isn't installed: see scripts/voices/README.md")
    f5 = F5TTS(device=args.device) if args.device else F5TTS()
    print(f"F5-TTS on {f5.device}\n")

    voices = {}
    for who in sorted({l["who"] for l in lines}):
        if only and who not in only:
            continue
        wav, txt = reference(who, cfgs.get(who, {}), ff, args.clean)
        if not wav:
            print(f"{who}: no reference yet. Put 5 to 11 seconds of them talking, with no music, at scripts/voices/refs/{who}.wav")
            continue
        text = heard(f5, wav, txt)
        voices[who] = (wav, text, float(cfgs.get(who, {}).get("speed", 1.0)))
        print(f"{who}: {duration(ff, wav):.1f}s reference, heard “{text}”")
    if args.check:
        print("\nA wrong transcript makes worse lines: fix it in scripts/voices/cache/ref-<who>.txt (it's used as written).")
        return

    def mp3(l):
        return OUT / l["who"] / f"{l['id']}.mp3"

    def write_manifest():
        made = {l["id"]: f"{l['who']}/{l['id']}.mp3" for l in lines if mp3(l).exists()}
        tmp = OUT / "manifest.json.tmp"
        tmp.write_text(json.dumps({"version": 1, "lines": made}, indent=0), encoding="utf-8")
        os.replace(tmp, OUT / "manifest.json")

    todo = [l for l in lines if l["who"] in voices and (args.force or not mp3(l).exists())]
    if args.limit:
        todo = todo[: args.limit]
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"\nMaking {len(todo)} lines into public/audio/voiced/")
    tmp = CACHE / "line.wav"
    started = time.time()
    for n, l in enumerate(todo, 1):
        wav, ref_text, speed = voices[l["who"]]
        f5.infer(
            ref_file=str(wav),
            ref_text=ref_text,
            gen_text=speakable(l["text"]),
            file_wave=str(tmp),
            remove_silence=True,
            seed=int(l["id"], 16) % 2**31,  # the same line comes out the same way each time
            nfe_step=args.nfe,
            speed=speed,
            show_info=lambda *a, **k: None,
            progress=None,
        )
        mp3(l).parent.mkdir(parents=True, exist_ok=True)
        run([ff, "-y", "-hide_banner", "-i", tmp, "-af", "highpass=f=60,loudnorm=I=-16:TP=-1.5", "-ac", "1", "-ar", "24000", "-b:a", "64k", mp3(l)])
        if n % 10 == 0:
            write_manifest()
        left = (time.time() - started) / n * (len(todo) - n)
        print(f"[{n}/{len(todo)}, ~{left / 60:.0f} min left] {l['who']}: {l['text']}")
    write_manifest()
    print("\nDone. npm run dev and fly: the crews speak these where they have no clip.")


if __name__ == "__main__":
    main()
