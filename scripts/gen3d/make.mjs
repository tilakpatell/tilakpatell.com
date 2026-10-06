// A model for the site from a picture or a prompt, in one go:
//   picture (if a prompt)  →  raw 3D (TRELLIS.2 or, for a picture to follow
//   closely, Pixal3D)  →  baked low-poly (Blender)  →  web GLB  →  judging sheet.
//
//   node scripts/gen3d/make.mjs x-wing --image photo.png --faithful --what "an X-wing starfighter"
//   node scripts/gen3d/make.mjs x-wing --prompt "an X-wing starfighter" --what "an X-wing starfighter"
//   node scripts/gen3d/make.mjs x-wing --image front.png --left left.png --back back.png --what "…"   (several sides: Hunyuan3D multi-view)
//   options: --no-faithful (a lone picture through TRELLIS.2 proper) --faces 120000 --tex 4096 (the bake, the top cut; the other two cuts come from it) --match OLD.glb --seed 42 --res 1024 --fov 49 --engine trelliscpp|trellis2 --no-bake
//
// Everything on the way lands in scripts/gen3d/cache/<name>/; the result in
// public/models/gen3d/<name>.glb, credited in public/games/credits.json.

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bake, blender } from './bake.mjs';
import { generate, pixal3dReady } from './generate.mjs';
import { sheet } from './judge.mjs';
import { picture } from './picture.mjs';
import { prepare } from './prepare.mjs';
import { TIERS } from './budget.mjs';
import { publish } from './web.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, 'cache');

// `image` is one picture (the front), or several sides { front, left, back, right }:
// with more than one, Hunyuan3D's multi-view engine is used
export async function make(name, { image, prompt, what, faces = TIERS.hq.faces, tex = TIERS.hq.tex, seed = 42, res = 1024, fov, engine, faithful = typeof image === 'string', noBake = false, match }) {
  const dir = join(CACHE, name);
  mkdirSync(dir, { recursive: true });
  const log = (m) => console.log(`[${name}] ${m}`);
  let source = join(dir, 'concept.png');
  if (image && typeof image === 'object') {
    source = {};
    for (const [side, file] of Object.entries(image)) {
      copyFileSync(file, join(dir, `given-${side}.png`));
      source[side] = join(dir, `${side}.png`);
      await prepare(file, source[side]); // each side trimmed, squared, 1024
    }
    faithful = false;
    log(`${Object.keys(source).length} views: ${Object.keys(source).join(', ')}`);
  } else if (image) {
    copyFileSync(image, join(dir, 'given.png'));
    await prepare(image, source); // trimmed, squared, 1024: the frame the model expects
  } else if (prompt) {
    const r = await picture(prompt, source, { seed });
    log(`concept picture in ${r.seconds.toFixed(0)}s`);
  } else throw new Error('--image or --prompt');
  if (faithful && !pixal3dReady()) {
    log('Pixal3D weights are not here, so TRELLIS.2 (README.md says how to add them)');
    faithful = false;
  }
  const raw = join(dir, 'raw.glb');
  const g = await generate(source, raw, { seed, res, engine, faithful, fov });
  log(`raw model with ${g.engine}${faithful ? ' (Pixal3D)' : ''} in ${g.seconds.toFixed(0)}s`);
  let low = raw;
  if (!noBake && blender()) {
    low = join(dir, 'baked.glb');
    const b = await bake(raw, low, { faces, tex }); // at the top cut's size: the other cuts are simplified and downsampled from it
    log(`baked to ${faces} faces in ${b.seconds.toFixed(0)}s`);
  } else log(noBake ? 'no bake: the web cut simplifies the raw mesh' : 'no Blender here: the web cut simplifies the raw mesh');
  const made = g.engine === 'hunyuan' ? 'Hunyuan3D-2 multi-view' : g.engine === 'trellis2' ? 'TRELLIS.2' : faithful ? 'Pixal3D (trellis.cpp)' : 'TRELLIS.2 (trellis.cpp)';
  const w = await publish(low, name, { what: what ?? name, match, engine: low === raw ? made : `${made}, baked in Blender`, stand: g.engine === 'trelliscpp' && faithful }); // Pixal3D writes Z up
  for (const [t, c] of Object.entries(w.cuts)) log(`${t}: ${Math.round(c.after)} triangles, ${(c.bytes / 1024).toFixed(0)} KB → ${c.out}`);
  if (process.env.CHROME) {
    const out = join(dir, 'sheet.png');
    await sheet(out, [raw, w.cuts?.hq?.out ?? w.out]);
    log(`judge: ${out}`);
  }
  return { source, raw, low, out: w.out };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args.splice(i, 2)[1] : d;
  };
  const on = (n) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 && args.splice(i, 1).length > 0;
  };
  const faithful = on('faithful');
  const plain = on('no-faithful'); // a lone picture through TRELLIS.2 proper, not Pixal3D (a three-quarter render or concept)
  const noBake = on('no-bake');
  const [image, match, fov, left, back, right] = [flag('image'), flag('match'), flag('fov'), flag('left'), flag('back'), flag('right')];
  const sides = Object.fromEntries(Object.entries({ left, back, right }).filter(([, p]) => p).map(([k, p]) => [k, resolve(p)]));
  const opts = { image: image && (Object.keys(sides).length ? { front: resolve(image), ...sides } : resolve(image)), prompt: flag('prompt'), what: flag('what'), faces: Number(flag('faces', TIERS.hq.faces)), tex: Number(flag('tex', TIERS.hq.tex)), match: match && resolve(match), seed: Number(flag('seed', 42)), res: Number(flag('res', 1024)), fov: fov && Number(fov), engine: flag('engine'), noBake };
  const [name] = args;
  const usage = 'usage: node scripts/gen3d/make.mjs NAME (--image FRONT [--left L --back B --right R] | --prompt "…") [--faithful | --no-faithful] [--what "…"] [--faces N] [--tex N]';
  if (!name || !(opts.image || opts.prompt)) throw new Error(usage);
  for (const f of typeof opts.image === 'object' ? Object.values(opts.image) : [opts.image].filter(Boolean)) if (!existsSync(f)) throw new Error(`no ${f}\n${usage}`);
  await make(name, { ...opts, faithful: faithful || (typeof opts.image === 'string' && !plain) });
}
