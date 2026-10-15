// The high-poly raw model baked onto a low-poly one, through Blender in the
// background (bake.py has the how and why).
//
//   node scripts/gen3d/bake.mjs RAW.glb OUT.glb [--faces 24000] [--tex 2048]
//   bake(raw, out, opts) → { out, seconds }
//
// Blender runs here on Windows ($BLENDER, a portable copy under
// %LOCALAPPDATA%\blender, or an installed one) or, failing that, a Linux
// Blender in WSL ($BLENDER_WSL, else ~/blender/blender-*/blender in the
// same distro as the trellis2 engine). Cycles bakes on the GPU either way.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { live, localDir } from '../desktop/lib.mjs';
import { WSL, wslPath } from './generate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// what a Linux Blender tarball lacks on a bare WSL Ubuntu (libSM, libICE), from conda-forge
const WSL_LIBS = `~/${'miniforge3'}/envs/x11libs/lib`;

function blenderWindows() {
  if (process.env.BLENDER && existsSync(process.env.BLENDER)) return process.env.BLENDER;
  for (const root of [localDir('blender'), 'C:\\Program Files\\Blender Foundation']) {
    if (!existsSync(root)) continue;
    const dirs = readdirSync(root).filter((d) => /^blender/i.test(d)).sort().reverse();
    for (const d of dirs) {
      const exe = join(root, d, 'blender.exe');
      if (existsSync(exe)) return exe;
    }
  }
  return null;
}

let wslBlender;
function blenderWsl() {
  if (wslBlender !== undefined) return wslBlender;
  wslBlender = null;
  if (process.platform !== 'win32') return null;
  try {
    const found = execFileSync('wsl.exe', ['-d', WSL.distro, '-e', 'bash', '-lc', 'ls -d ${BLENDER_WSL:-~/blender/blender-*/blender} 2>/dev/null | tail -1'], { encoding: 'utf8', timeout: 20000 }).trim();
    if (found) wslBlender = found;
  } catch {
    /* no WSL, or no distro: no Blender there */
  }
  return wslBlender;
}

// Where Blender is: { kind: 'windows', exe } or { kind: 'wsl', exe }, else null.
export function blender() {
  const exe = blenderWindows();
  if (exe) return { kind: 'windows', exe };
  const wsl = blenderWsl();
  return wsl ? { kind: 'wsl', exe: wsl } : null;
}

// The command line for one bake, given where Blender is (so it is testable without one).
export function command(raw, out, { faces = 24000, tex = 2048, where = blender() } = {}) {
  if (!where) return null;
  const args = ['--background', '--python', join(HERE, 'bake.py'), '--', raw, out, '--faces', String(faces), '--tex', String(tex)];
  // a script standing in for Blender (scripts/ai-e2e/fakes/blender.mjs) runs under node
  if (where.kind === 'windows') return /\.mjs$/i.test(where.exe) ? [process.execPath, where.exe, ...args] : [where.exe, ...args];
  const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
  const run = `export LD_LIBRARY_PATH=${WSL_LIBS}:$LD_LIBRARY_PATH; ${q(where.exe)} ${args.map((a) => q(/^[A-Za-z]:[\\/]/.test(a) ? wslPath(a) : a)).join(' ')}`;
  return ['wsl.exe', '-d', WSL.distro, '-e', 'bash', '-lc', run];
}

export async function bake(raw, out, opts = {}) {
  const cmd = command(raw, out, opts);
  if (!cmd) throw new Error('Blender is not set up here: see scripts/gen3d/README.md');
  const started = Date.now();
  await live(cmd[0], cmd.slice(1), { name: 'blender', minutes: Number(process.env.GEN3D_BAKE_MINUTES ?? 20) });
  if (!existsSync(out)) throw new Error(`blender made no ${out}`);
  return { out, seconds: (Date.now() - started) / 1000 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args.splice(i, 2)[1] : d;
  };
  const opts = { faces: Number(flag('faces', 24000)), tex: Number(flag('tex', 2048)) };
  const [raw, out] = args;
  if (!raw || !out) throw new Error('usage: node scripts/gen3d/bake.mjs RAW.glb OUT.glb [--faces N] [--tex N]');
  const r = await bake(resolve(raw), resolve(out), opts);
  console.log(`${r.out} in ${r.seconds.toFixed(0)}s`);
}
