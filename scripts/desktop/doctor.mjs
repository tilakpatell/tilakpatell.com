// Is this machine ready to make the desktop's jobs? Every thing a gen3d,
// voices or motion job needs (and, as "no" rather than red, what the
// bf2017 picture jobs need: scripts/desktop/bf2017-desk.mjs), checked from
// where this runs (run it from the runner's side, outside the Claude app,
// to see what the runner sees), each with
// what to do when it's missing. Exits 1 when something a job can't do
// without is missing.
//
//   node scripts/desktop/doctor.mjs [--json]

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCAL, ghCommand, gpuFree, mainRepo, repoName } from './lib.mjs';

const quiet = (cmd, args, timeout = 20000) => {
  try {
    return { ok: true, out: execFileSync(cmd, args, { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim() };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? ''}`.trim() || e.message };
  }
};

// Inside the Claude desktop app (MSIX), a file written to %LOCALAPPDATA%
// lands in the app's boxed copy instead: what this process sees is not
// what the runner, outside the app, will see.
export function boxed() {
  if (process.platform !== 'win32') return false;
  const name = `desktop-jobs-probe-${process.pid}`;
  try {
    writeFileSync(join(LOCAL, name), '');
    const pkgs = join(LOCAL, 'Packages');
    const inBox = existsSync(pkgs) && readdirSync(pkgs).filter((d) => /^Claude_/i.test(d)).some((d) => existsSync(join(pkgs, d, 'LocalCache', 'Local', name)));
    rmSync(join(LOCAL, name), { force: true });
    return inBox;
  } catch {
    return false;
  }
}

export async function checks() {
  const list = [];
  const add = (group, name, ok, detail, fix, need = true) => list.push({ group, name, ok: Boolean(ok), detail, fix: ok ? undefined : fix, need });
  const inBox = boxed();
  add('machine', 'where this runs', true, inBox ? 'inside the Claude app: paths under AppData are its boxed copy, not what the runner sees (run me from a normal terminal for the runner\'s view)' : 'outside the Claude app (the runner\'s view)');
  add('machine', 'node', true, process.version);
  const gh = quiet(...ghCommand(['api', 'user', '-q', '.login']));
  add('machine', 'gh signed in', gh.ok, gh.ok ? `as ${gh.out}` : gh.out.split('\n')[0], 'gh auth login (in a normal terminal), then gh auth setup-git');
  const helper = quiet('git', ['config', '--get-urlmatch', 'credential.helper', 'https://github.com']);
  add('machine', 'git can push to GitHub', helper.ok && helper.out, helper.out || 'no credential helper for github.com', 'gh auth setup-git (git then pushes with gh\'s login)');
  const gpu = gpuFree();
  add('machine', 'GPU', gpu, gpu ? `${(gpu.free / 1024).toFixed(1)} of ${(gpu.total / 1024).toFixed(1)} GB free` : 'no nvidia-smi', 'an NVIDIA driver (CUDA 13: 610+)');
  let repo = null;
  try {
    repo = repoName();
  } catch {
    /* gh not signed in: said above */
  }
  if (repo && gh.ok) {
    const r = quiet(...ghCommand(['api', `repos/${repo}/actions/runners`, '-q', '[.runners[] | select(.labels[].name == "gpu") | "\\(.name) \\(.status)"] | join(", ")']));
    add('machine', 'Actions runner (label gpu)', r.ok && /online/.test(r.out), r.ok ? r.out || 'none registered' : r.out.split('\n')[0], 'powershell -ExecutionPolicy Bypass -File scripts\\desktop\\setup-runner.ps1 (from a normal terminal)', false);
  }
  let root = null;
  try {
    root = mainRepo();
  } catch {
    /* not in a checkout */
  }
  if (root) for (const s of ['gen3d', 'voices', 'motion']) add('machine', `${s} checkout`, existsSync(join(`${root}-${s}`, '.git')), `${root}-${s}`, 'made by the first job (git worktree add)', false);
  const edge = process.env.CHROME ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  add('gen3d', 'Edge or Chrome (judging sheets)', existsSync(edge), edge, 'set CHROME to a Chromium browser', false);

  const { TRELLISCPP, pixal3dReady } = await import('../gen3d/generate.mjs');
  add('gen3d', 'trellis.cpp (TRELLIS.2)', existsSync(TRELLISCPP.exe), TRELLISCPP.exe, 'scripts/gen3d/README.md, trellis.cpp (Windows)');
  add('gen3d', 'Pixal3D weights (--faithful)', pixal3dReady(), TRELLISCPP.models, 'scripts/gen3d/README.md, Pixal3D', false);
  const { SDCPP, ready: pictureReady } = await import('../gen3d/picture.mjs');
  add('gen3d', 'concept pictures (FLUX or Z-Image)', pictureReady('flux') || pictureReady('zimage'), pictureReady('flux') ? 'FLUX.1-schnell' : pictureReady('zimage') ? 'Z-Image-Turbo' : SDCPP.exe, 'scripts/gen3d/README.md, Concept images (needed for prompt jobs)', false);
  const { blender } = await import('../gen3d/bake.mjs');
  const b = blender();
  add('gen3d', 'Blender (the bake)', b, b ? `${b.kind}: ${b.exe}` : 'none', 'scripts/gen3d/README.md, Blender (without it the cut simplifies the raw mesh)', false);
  const claude = quiet(process.platform === 'win32' ? 'where' : 'which', ['claude']);
  const { LLAMA } = await import('../gen3d/vlm.mjs');
  const qwen = existsSync(LLAMA.exe) && existsSync(LLAMA.model);
  add('gen3d', "the judge's eyes (Claude Code or Qwen3-VL)", claude.ok || qwen, [claude.ok && 'claude on PATH (signed in? run `claude` once and /login)', qwen && 'Qwen3-VL'].filter(Boolean).join('; ') || 'neither', 'scripts/gen3d/README.md, The model\'s eyes (without one, no concept picking or verdict)', false);

  const { PYTHON, STORE } = await import('../voices/runner.mjs');
  add('voices', 'the voices venv', existsSync(PYTHON), PYTHON, 'scripts/voices/README.md, Setup');
  add('voices', 'reference voices', existsSync(join(STORE.refs, 'rick.wav')), STORE.refs, 'scripts/voices/README.md, References (or set VOICES_REFS)');

  const motion = await import('../motion/runner.mjs');
  const hy = motion.ready();
  add('motion', 'HY-Motion 1.0 in WSL (env, weights, skeleton)', hy, hy ?? `${motion.WSL.distro}: ${motion.WSL.repo} in the ${motion.WSL.env} env`, 'scripts/motion/README.md, Setting it up', false);

  // the bf2017 picture jobs (bf2017-desktop.yml, lane W): none needed by the jobs above
  const { bf2017Checks, desk, webgpuCheck } = await import('./bf2017-desk.mjs');
  for (const c of bf2017Checks()) add('bf2017', c.name, c.ok, c.detail, c.fix, false);
  if (existsSync(desk().chrome)) {
    const w = await webgpuCheck(desk().chrome, root ?? undefined);
    add('bf2017', 'WebGPU in that Chrome', w.ok, w.detail, 'a driver with WebGPU (Chrome 113+ on D3D12); chrome://gpu says why not', false);
  }

  return list;
}

export function render(list) {
  const lines = [];
  let group = null;
  for (const c of list) {
    if (c.group !== group) lines.push('', c.group);
    group = c.group;
    lines.push(`  ${c.ok ? 'ok  ' : c.need ? 'MISSING' : 'no  '} ${c.name}: ${c.detail}${c.fix ? `\n         fix: ${c.fix}` : ''}`);
  }
  return lines.join('\n').trim();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const list = await checks();
  console.log(process.argv.includes('--json') ? JSON.stringify(list, null, 2) : render(list));
  if (list.some((c) => c.need && !c.ok)) process.exitCode = 1;
}
