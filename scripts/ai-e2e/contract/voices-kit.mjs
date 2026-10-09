// What the voices contract tests need beyond the sandbox: a Python with
// numpy and soundfile (what the fake worker and the pipeline's shared code
// import; CI installs them for the AI job), ffmpeg (the pipeline publishes
// mp3s with it), reference recordings, and the sandbox's repository with the
// fixture src/ tree in it.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES } from './repo.mjs';

const works = (cmd, args) => {
  try {
    return String(execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 })).trim();
  } catch {
    return null;
  }
};

// A Python that has what the fakes need, as its full path (the runner checks the path exists), or null.
export function python() {
  const venv = join(homedir(), '.venvs', 'voices');
  const candidates = [process.env.VOICES_TEST_PYTHON, join(venv, 'Scripts', 'python.exe'), join(venv, 'bin', 'python'), 'python3', 'python'].filter(Boolean);
  for (const c of candidates) {
    if (c.includes('/') || c.includes('\\')) if (!existsSync(c)) continue;
    const found = works(c, ['-c', 'import numpy, soundfile, sys; print(sys.executable)']);
    if (found) return found;
  }
  return null;
}

// Why the voices tests can't run here, or null when they can.
export function missing() {
  if (!python()) return 'no Python with numpy and soundfile (pip install numpy soundfile, or set VOICES_TEST_PYTHON)';
  if (!works('ffmpeg', ['-version'])) return 'no ffmpeg on the PATH';
  return null;
}

// A mono 16-bit WAV of a tone, `seconds` long: a reference recording as far as the fakes care.
export function wav(seconds, rate = 24000) {
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 200 * i) / rate)), 44 + i * 2);
  return b;
}

// References for the speakers who have one (rick and han); luke has none, on purpose.
export function references(dir) {
  mkdirSync(dir, { recursive: true });
  for (const [who, said] of [['rick', 'Listen, Morty.'], ['han', 'Here we go again.']]) {
    writeFileSync(join(dir, `${who}.wav`), wav(2));
    writeFileSync(join(dir, `${who}.txt`), `${said}\n`);
  }
  return dir;
}

// The sandbox's repository with the voices fixture's src/ tree, the references beside it,
// and every voices fake switched on. → { repo, refs, cache, env }
export function voicesRepo(box) {
  const repo = box.repo(['scripts/voices', 'scripts/desktop', 'scripts/ai-e2e/fakes', 'src/lib/voiced.js', 'src/lib/audio.js', 'src/lib/speech.js'], { 'src/worlds': join(FIXTURES, 'voices-src', 'src', 'worlds') });
  const refs = references(join(box.dir, 'refs'));
  const cache = join(box.dir, 'voices-cache');
  Object.assign(box.env, {
    VOICES_ENGINE: 'fake',
    VOICES_JUDGE: 'fake',
    VOICES_LINES_FROM: 'voicelines',
    VOICES_REFS: refs,
    VOICES_CACHE: cache,
    VOICES_PYTHON: python(),
    PYTHONIOENCODING: 'utf-8',
  });
  return { repo, refs, cache };
}
