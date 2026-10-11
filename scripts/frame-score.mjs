#!/usr/bin/env node
// A shot scored against its reference (the GPU-first design’s G1): FLIP
// where NVIDIA’s tool is installed (`pip install flip-evaluator`, which puts
// a `flip` command on the path: the desktop and the laptop), and PSNR and
// SSIM in Node everywhere (scripts/lib/frame-metrics.mjs). FLIP is the
// quality gate every later lane beats (lower is better: 0 is the same
// picture); scripts/gpu-parity.mjs stays the regression gate between branches.
//
//   node scripts/frame-score.mjs <candidate.png> <reference.png> [--ppd 67] [--json]
//
// → { flip, psnr, ssim, ppd, size } printed (one JSON line with --json);
// flip is null where the tool is not found, and `flipWhy` says why. The
// two pictures must be the same size (a reference is shot at the
// candidate’s pixels: scripts/reference-frames.mjs --size). Exit 2 when it
// could not score (a file missing, two sizes).
//
// --ppd: the viewer’s pixels per degree, which FLIP weighs its error by;
// 67 is FLIP’s own default, a 0.7 m viewing distance from a 24-inch 4K
// monitor, near enough the laptop’s panel at arm’s length.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { psnr, ssim } from './lib/frame-metrics.mjs';

export const PPD = 67; // _source: NVIDIA FLIP’s default pixels per degree (Andersson et al. 2020, §5: 0.7 m from a 0.7 m wide 3,840-pixel monitor)

// FLIP’s command line prints its pooled values; the mean is the score
export function parseFlip(stdout) {
  const m = /Mean:\s*([0-9]*\.?[0-9]+(?:e-?\d+)?)/i.exec(String(stdout ?? ''));
  return m ? Number(m[1]) : null;
}

// the `flip` command, where pip put it; null where there is none
export function findFlip({ platform = process.platform, run = execFileSync } = {}) {
  try {
    const out = run(platform === 'win32' ? 'where' : 'which', ['flip'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split(/\r?\n/)[0];
    return out || null;
  } catch {
    return null;
  }
}

export async function score(candidate, reference, { ppd = PPD, flip = findFlip(), run = execFileSync } = {}) {
  const sharp = (await import('sharp')).default;
  const read = async (file) => {
    const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, channels: info.channels };
  };
  const [a, b] = await Promise.all([read(candidate), read(reference)]);
  const out = { flip: null, psnr: psnr(a, b), ssim: ssim(a, b), ppd, size: `${a.width}x${a.height}` };
  if (!flip) {
    out.flipWhy = 'no flip command (pip install flip-evaluator, on the desktop or the laptop)';
    return out;
  }
  // (its error map goes to a scratch folder: only the number is wanted)
  const dir = mkdtempSync(join(tmpdir(), 'frame-score-'));
  try {
    const stdout = run(flip, ['-r', resolve(reference), '-t', resolve(candidate), '-ppd', String(ppd), '-d', dir], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    out.flip = parseFlip(stdout);
    if (out.flip == null) out.flipWhy = 'flip ran but printed no mean';
  } catch (e) {
    out.flipWhy = `flip failed: ${String(e.message ?? e).split('\n')[0]}`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const [candidate, reference] = args._;
  if (!candidate || !reference) {
    console.log('usage: node scripts/frame-score.mjs <candidate.png> <reference.png> [--ppd 67] [--json]');
    process.exit(2);
  }
  try {
    const got = await score(candidate, reference, { ppd: Number(args.ppd) || PPD });
    const fmt = (n, d) => (n == null ? '–' : n === Infinity ? '∞' : n.toFixed(d));
    if (args.json) console.log(JSON.stringify(got));
    else console.log(`FLIP ${fmt(got.flip, 4)}${got.flipWhy ? ` (${got.flipWhy})` : ''} · PSNR ${fmt(got.psnr, 2)} dB · SSIM ${fmt(got.ssim, 4)} · ${got.size} at ${got.ppd} ppd`);
  } catch (e) {
    console.log(String(e.message ?? e));
    process.exit(2);
  }
}
