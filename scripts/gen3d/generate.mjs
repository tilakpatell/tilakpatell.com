// One concept image in, one raw textured GLB out, from a local engine:
//   trelliscpp  trellis.cpp (TRELLIS.2-4B in GGML, f16 weights), CUDA, on Windows
//   trellis2    the reference microsoft/TRELLIS.2 (bf16, PyTorch), in WSL
// Both are installed as scripts/gen3d/README.md says. The raw GLB is big
// (hundreds of thousands of triangles, a 2k–4k PBR atlas); web.mjs cuts it
// to the site's budget.
//
//   node scripts/gen3d/generate.mjs IMAGE OUT.glb [--engine trelliscpp|trellis2|hunyuan] [--left L.png --back B.png --right R.png] [--seed 42] [--res 1024] [--faithful [--fov 49]]
//   generate(image, out, opts) → { engine, seconds, out }

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { live, localDir } from '../desktop/lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// (localDir: %LOCALAPPDATA%, or the Claude app's boxed copy of it, scripts/desktop/lib.mjs)
const STUDIO = localDir('trellis-studio');
export const TRELLISCPP = { exe: join(STUDIO, 'runtime', 'trellis-cli.exe'), models: join(STUDIO, 'models') };
export const WSL = { distro: process.env.GEN3D_WSL_DISTRO ?? 'Ubuntu-24.04', conda: '~/miniforge3', env: 'trellis2' };
export const ENGINES = ['trelliscpp', 'trellis2', 'hunyuan'];
// the Hunyuan3D-2 multi-view engine's conda env, in the same distro
const HY3D = { env: 'hy3d', repo: '~/Hunyuan3D-2', paintEnv: 'hy3d21', paintRepo: '~/Hunyuan3D-2.1' };
export const VIEWS = ['front', 'left', 'back', 'right'];
// GEN3D_ENGINE=fake (or --engine fake): a tiny GLB in under a second, for the contract tests; never chosen on its own
const FAKE = join(HERE, '..', 'ai-e2e', 'fakes', 'engine.mjs');

// Pictures of one thing from several sides, { front, left, back, right } (any one
// or more), or one picture (the front). TRELLIS.2 takes the front; Hunyuan takes
// them all.
export const views = (image) => (typeof image === 'string' ? { front: image } : image);

// A Windows path as WSL sees it (C:\x\y → /mnt/c/x/y).
export const wslPath = (p) => (/^[A-Za-z]:[\\/]/.test(p) ? `/mnt/${p[0].toLowerCase()}/${p.slice(3).replace(/\\/g, '/')}` : p);

// The command line for an engine, as [exe, ...args]; null if it isn't set up here.
// Pixal3D: a TRELLIS.2 fine-tune that projects each 3D cell into the picture and
// samples it there (pixel-aligned), so a photo or a drawing is followed more
// closely; its own flow weights sit beside TRELLIS.2's as pixal3d_*.gguf.
// whether Hunyuan3D-2.1's paint env is in WSL (asked once)
let hy3d21;
function hy3d21Ready() {
  if (hy3d21 !== undefined) return hy3d21;
  hy3d21 = false;
  if (process.platform !== 'win32') return false;
  try {
    hy3d21 = execFileSync('wsl.exe', ['-d', WSL.distro, '-e', 'bash', '-lc', `ls ${HY3D.paintRepo}/hy3dpaint/ckpt/RealESRGAN_x4plus.pth 2>/dev/null`], { encoding: 'utf8', timeout: 20000 }).trim().length > 0;
  } catch {
    /* no WSL: no 2.1 paint */
  }
  return hy3d21;
}

// whether an engine's raw model comes out lying along Z, to be stood up (upright.mjs) before it's baked: trellis.cpp's Pixal3D's;
// TRELLIS.2's, Hunyuan3D's and the fake's stand along Y, as glTF does
export const lying = (engine, faithful) => engine === 'trelliscpp' && Boolean(faithful);
export const pixal3dReady = () => existsSync(join(TRELLISCPP.models, 'pixal3d_shape_flow_1024.gguf'));

export function command(engine, given, out, { seed = 42, res = 1024, faces, tex, faithful = false, fov, steps = 50, asked, paint21 = engine === 'hunyuan' && hy3d21Ready() } = {}) {
  const v = views(given);
  const image = v.front ?? Object.values(v)[0];
  if (engine === 'trelliscpp') {
    if (!existsSync(TRELLISCPP.exe)) return null;
    // the default quadric simplify (300K faces @1024) and atlas (2048 @1024); PBR WebP textures
    const model = faithful ? ['--model', 'pixal3d', ...(fov ? ['--fov', String(fov)] : [])] : [];
    return [TRELLISCPP.exe, image, out, '--models', TRELLISCPP.models, '--seed', String(seed), '--res', String(res), '--require-gpu', ...model, ...(tex ? ['--atlas', String(tex)] : [])];
  }
  if (engine === 'trellis2') {
    const script = wslPath(join(HERE, 'engines', 'trellis2.py'));
    const run = `source ${WSL.conda}/bin/activate ${WSL.env} && cd ~/TRELLIS.2 && python ${q(script)} ${q(wslPath(image))} ${q(wslPath(out))} --seed ${seed} --faces ${faces ?? 1000000} --tex ${tex ?? 4096}`;
    return ['wsl.exe', '-d', WSL.distro, '-e', 'bash', '-lc', run];
  }
  if (engine === 'hunyuan') {
    const script = wslPath(join(HERE, 'engines', 'hunyuan.py'));
    const sides = VIEWS.filter((k) => v[k]).map((k) => `--${k} ${q(wslPath(v[k]))}`).join(' ');
    // the shape from every side; then 2.1's PBR paint on it from the front when that env is here (richer than 2.0's turbo paint), else 2.0's paint from every side
    const white = `${out}.white.glb`;
    const paint = wslPath(join(HERE, 'engines', 'hunyuan_paint21.py'));
    const shape = `source ${WSL.conda}/bin/activate ${HY3D.env} && cd ${HY3D.repo} && python ${q(script)} ${q(wslPath(out))} ${sides} --seed ${seed} --steps ${steps} --faces ${faces ?? 300000}`;
    const run = paint21
      ? `${shape.replace(q(wslPath(out)), q(wslPath(white)))} --white && source ${WSL.conda}/bin/activate ${HY3D.paintEnv} && cd ${HY3D.paintRepo} && python ${q(paint)} ${q(wslPath(white))} ${q(wslPath(image))} ${q(wslPath(out))}`
      : shape;
    return ['wsl.exe', '-d', WSL.distro, '-e', 'bash', '-lc', run];
  }
  // the contract tests' stand-in (scripts/ai-e2e/fakes/engine.mjs): every picture it was given, so a test can see which went where
  if (engine === 'fake') {
    const told = [['--res', res], ['--fov', fov], ['--asked', asked]].filter(([, x]) => x !== undefined).flat().map(String);
    return [process.execPath, FAKE, image, out, '--seed', String(seed), ...VIEWS.filter((k) => k !== 'front' && v[k]).flatMap((k) => [`--${k}`, v[k]]), ...told, ...(faithful ? ['--faithful'] : [])];
  }
  throw new Error(`no engine ${engine} (${ENGINES.join(', ')})`);
}

const q = (s) => `'${s.replace(/'/g, `'\\''`)}'`;

export async function generate(image, out, opts = {}) {
  // several views and no engine named: Hunyuan, the one that can use them
  // GEN3D_ENGINE=fake wins over the engine an issue asks for: a test of that issue must not run the real one
  if (process.env.GEN3D_ENGINE === 'fake') opts = { ...opts, engine: 'fake', asked: opts.engine };
  const engine = opts.engine ?? process.env.GEN3D_ENGINE ?? (Object.keys(views(image)).length > 1 ? 'hunyuan' : ENGINES.find((e) => command(e, image, out, opts))) ?? null;
  const cmd = engine && command(engine, image, out, opts);
  if (!cmd) throw new Error(`${opts.engine ?? 'no engine'} isn't set up here: see scripts/gen3d/README.md`);
  const started = Date.now();
  await live(cmd[0], cmd.slice(1), { name: engine, minutes: Number(process.env.GEN3D_ENGINE_MINUTES ?? 45) });
  if (!existsSync(out)) throw new Error(`${engine} made no ${out}`);
  return { engine, seconds: (Date.now() - started) / 1000, out };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (name, dflt) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args.splice(i, 2)[1] : dflt;
  };
  const faithful = args.includes('--faithful') && args.splice(args.indexOf('--faithful'), 1).length > 0;
  const [tex, faces, fov, left, back, right] = [flag('tex'), flag('faces'), flag('fov'), flag('left'), flag('back'), flag('right')];
  const opts = { engine: flag('engine'), seed: Number(flag('seed', 42)), res: Number(flag('res', 1024)), tex: tex && Number(tex), faces: faces && Number(faces), faithful, fov: fov && Number(fov) };
  const sides = Object.fromEntries(Object.entries({ left, back, right }).filter(([, p]) => p).map(([k, p]) => [k, resolve(p)]));
  const [image, out] = args;
  if (!image || !out) throw new Error('usage: node scripts/gen3d/generate.mjs IMAGE OUT.glb [--engine trelliscpp|trellis2] [--seed N] [--res 512|1024|1536]');
  const r = await generate(Object.keys(sides).length ? { front: resolve(image), ...sides } : resolve(image), resolve(out), opts);
  console.log(`${r.engine}: ${r.out} in ${r.seconds.toFixed(0)}s`);
}
