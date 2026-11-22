// A model for the site from a picture or a prompt, in one go:
//   picture (if a prompt)  →  raw 3D (TRELLIS.2 or, for a picture to follow
//   closely, Pixal3D)  →  baked low-poly (Blender)  →  web GLB  →  judging sheet.
//
//   node scripts/gen3d/make.mjs x-wing --image photo.png --faithful --what "an X-wing starfighter"
//   node scripts/gen3d/make.mjs x-wing --prompt "an X-wing starfighter" --what "an X-wing starfighter"
//   node scripts/gen3d/make.mjs x-wing --image front.png --left left.png --back back.png --what "…"   (several sides: Hunyuan3D multi-view)
//   options: --candidates 4 (concept pictures to choose from) --no-judge --faces 120000 --tex 4096 (the bake, the top cut; the other two cuts are scaled from it) --match OLD.glb --seed 42 --res 1024 --fov 49 --engine trelliscpp|trellis2 --no-bake --no-faithful --fresh
//            --ultra (a fourth cut, NAME.ultra.glb, for the ultra level: the bake made at its size, up to 300k faces and 8192 maps; budget.mjs ULTRA)
//
// Everything on the way lands in scripts/gen3d/cache/<name>/ ($GEN3D_CACHE
// for elsewhere); the result in public/models/gen3d/<name>.glb, credited in
// public/games/credits.json. A step whose inputs haven't changed since the
// last run (the concept picture, the raw model, the bake) is reused, so a job
// that failed at the cut starts again there; --fresh makes all of it again.
// The run's own lines go to cache/<name>/make.log and its outcome to
// result.json (what the runner puts in the pull request).

import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bake, blender } from './bake.mjs';
import { generate, pixal3dReady, lying } from './generate.mjs';
import { sheet } from './judge.mjs';
import { picture } from './picture.mjs';
import { prepare } from './prepare.mjs';
import { ready as vlmReady } from './vlm.mjs';
import { TIERS, cutsFor } from './budget.mjs';
import { upright } from './upright.mjs';
import { io, publish } from './web.mjs';
import { digest, once } from './steps.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const CACHE = process.env.GEN3D_CACHE ? resolve(process.env.GEN3D_CACHE) : join(HERE, 'cache');

// `image` is one picture (the front), or several sides { front, left, back, right }:
// with more than one, Hunyuan3D's multi-view engine is used
export async function make(name, { image, prompt, what, faces = TIERS.hq.faces, tex = TIERS.hq.tex, seed = 42, res = 1024, fov, engine, faithful = typeof image === 'string', noBake = false, match, candidates = 4, judge = true, retries = 1, fresh = false, first = true, ultra = false }) {
  const dir = join(CACHE, name);
  mkdirSync(dir, { recursive: true });
  if (first) writeFileSync(join(dir, 'make.log'), '');
  const log = (m) => {
    console.log(`[${name}] ${m}`);
    appendFileSync(join(dir, 'make.log'), `${m}\n`);
  };
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
    // several concept pictures, and the model's eyes (vlm.mjs) pick the one most like the thing
    const n = vlmReady() ? candidates : 1;
    const files = [];
    for (let i = 0; i < n; i++) {
      const file = n === 1 ? source : join(dir, `concept-${i + 1}.png`);
      const r = await once(file, digest(prompt, seed + i), () => picture(prompt, file, { seed: seed + i }), { fresh });
      files.push(file);
      log(r.reused ? `concept picture ${i + 1}/${n} from the last run` : `concept picture ${i + 1}/${n} in ${r.seconds.toFixed(0)}s`);
    }
    if (n > 1) {
      const { pick } = await import('./vlm.mjs');
      const p = await pick(what ?? prompt, files);
      copyFileSync(files[p.best], source);
      log(`picked concept ${p.best + 1}: ${p.scores.map((s) => s.score).join(' ')} of 10${p.scores[p.best].problems.length ? ` (${p.scores[p.best].problems.join('; ')})` : ''}`);
    }
  } else throw new Error('--image or --prompt');
  if (faithful && !pixal3dReady()) {
    log('Pixal3D weights are not here, so TRELLIS.2 (README.md says how to add them)');
    faithful = false;
  }
  const raw = join(dir, 'raw.glb');
  // the same pictures, seed and engine as the last run: its raw model again (the GPU's slowest step)
  const pictures = typeof source === 'string' ? [source] : Object.values(source);
  const rawKey = digest(...pictures.map((f) => readFileSync(f)), seed, res, engine ?? 'auto', faithful, fov);
  const g = await once(
    raw,
    rawKey,
    async () => {
      const r = await generate(source, raw, { seed, res, engine, faithful, fov });
      writeFileSync(join(dir, 'raw.json'), JSON.stringify({ engine: r.engine }));
      return r;
    },
    { fresh },
  );
  if (g.reused) g.engine = existsSync(join(dir, 'raw.json')) ? JSON.parse(readFileSync(join(dir, 'raw.json'), 'utf8')).engine : (engine ?? 'trelliscpp');
  log(g.reused ? `raw model from the last run (${g.engine})` : `raw model with ${g.engine}${faithful ? ' (Pixal3D)' : ''} in ${g.seconds.toFixed(0)}s`);
  // Pixal3D's model lies along Z and glTF and the site are Y up (upright.mjs): stood up before anything is made from it, or a
  // building lies on its side and a picture's relief faces the sky
  let stood = raw;
  let stoodKey = rawKey;
  if (lying(g.engine, faithful)) {
    stood = join(dir, 'upright.glb');
    stoodKey = digest(rawKey, 'y-up');
    const u = await once(stood, stoodKey, async () => {
      const nio = await io();
      await nio.write(stood, await upright(await nio.read(raw)));
    }, { fresh });
    log(u.reused ? 'stood up in the last run (Pixal3D lies along Z)' : 'stood up: Pixal3D lies along Z');
  }
  let low = stood;
  if (!noBake && blender()) {
    low = join(dir, 'baked.glb');
    // (at the top cut's size, the ultra cut's where one is asked for: the other cuts are simplified and downsampled from it)
    const top = ultra ? cutsFor(faces, tex, { ultra }).ultra : { faces, tex };
    const b = await once(low, digest(stoodKey, top.faces, top.tex), () => bake(stood, low, { faces: top.faces, tex: top.tex }), { fresh });
    log(b.reused ? `baked model from the last run (${top.faces} faces)` : `baked to ${top.faces} faces in ${b.seconds.toFixed(0)}s`);
  } else log(noBake ? 'no bake: the web cut simplifies the raw mesh' : 'no Blender here: the web cut simplifies the raw mesh');
  const made = g.engine === 'hunyuan' ? 'Hunyuan3D-2 multi-view' : g.engine === 'trellis2' ? 'TRELLIS.2' : faithful ? 'Pixal3D (trellis.cpp)' : 'TRELLIS.2 (trellis.cpp)';
  const w = await publish(low, name, { what: what ?? name, match, engine: low === stood ? made : `${made}, baked in Blender`, top: { faces, tex }, ultra });
  for (const [t, c] of Object.entries(w.cuts)) log(`${t}: ${Math.round(c.after)} triangles, ${(c.bytes / 1024).toFixed(0)} KB → ${c.out}`);
  const result = { name, what: what ?? name, engine: made, seed, cuts: Object.fromEntries(Object.entries(w.cuts).map(([t, c]) => [t, { triangles: Math.round(c.after), bytes: c.bytes, file: c.out }])) };
  writeFileSync(join(dir, 'result.json'), JSON.stringify(result, null, 2));
  if (process.env.CHROME || process.env.GEN3D_SHEET === 'fake') {
    const out = join(dir, 'sheet.png');
    await sheet(out, [stood, w.cuts?.hq?.out ?? w.out]);
    log(`judge: ${out}`);
    // the model's eyes on the sheet: a miss is made again, once, with the next seed (and the next-best concept)
    if (judge && vlmReady()) {
      const { judge: look, which } = await import('./vlm.mjs');
      let v;
      try {
        v = await look(what ?? prompt ?? name, out);
      } catch (e) {
        // Qwen's say is only a note (below), so a Qwen that fails or hangs leaves the made model unjudged, not failed
        if (which() !== 'qwen') throw e;
        log(`no verdict: Qwen3-VL failed (${e.message.slice(0, 160)})`);
        writeFileSync(join(dir, 'result.json'), JSON.stringify({ ...result, sheet: out }, null, 2));
        return { source, raw, low, out: w.out };
      }
      log(`verdict: ${v.score}/10${v.problems.length ? ` — ${v.problems.join('; ')}` : ''}${v.ok ? '' : ` — ${v.fix}`}`);
      // only Claude's verdict gates: Qwen3-VL-8B misjudges a right model often enough that its say is a note, not a veto
      // (the contract tests' fake judge stands in for Claude, so the loop is tested)
      if (!v.ok && retries > 0 && ['claude', 'fake'].includes(which())) {
        log(`not good enough: once more with seed ${seed + 1}`);
        return make(name, { image, prompt, what, faces, tex, seed: seed + 1, res, fov, engine, faithful, noBake, match, candidates, judge, retries: retries - 1, fresh, first: false, ultra });
      }
      writeFileSync(join(dir, 'result.json'), JSON.stringify({ ...result, sheet: out, verdict: v }, null, 2));
      return { source, raw, low, out: w.out, verdict: v };
    }
    writeFileSync(join(dir, 'result.json'), JSON.stringify({ ...result, sheet: out }, null, 2));
  } else log('no CHROME set, so no judging sheet (README.md, Judging)');
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
  const unfaithful = on('no-faithful'); // a picture is followed with Pixal3D unless this says not to
  const noBake = on('no-bake');
  const fresh = on('fresh');
  const ultra = on('ultra');
  const judge = !on('no-judge');
  const [image, match, fov, left, back, right] = [flag('image'), flag('match'), flag('fov'), flag('left'), flag('back'), flag('right')];
  const sides = Object.fromEntries(Object.entries({ left, back, right }).filter(([, p]) => p).map(([k, p]) => [k, resolve(p)]));
  const opts = { image: image && (Object.keys(sides).length ? { front: resolve(image), ...sides } : resolve(image)), prompt: flag('prompt'), what: flag('what'), faces: Number(flag('faces', TIERS.hq.faces)), tex: Number(flag('tex', TIERS.hq.tex)), match: match && resolve(match), seed: Number(flag('seed', 42)), res: Number(flag('res', 1024)), fov: fov && Number(fov), engine: flag('engine'), noBake, fresh, ultra, judge, candidates: Number(flag('candidates', 4)) };
  const [name] = args;
  const usage = 'usage: node scripts/gen3d/make.mjs NAME (--image FRONT [--left L --back B --right R] | --prompt "…") [--faithful | --no-faithful] [--what "…"] [--faces N] [--tex N]';
  if (!name || !(opts.image || opts.prompt)) throw new Error(usage);
  for (const f of typeof opts.image === 'object' ? Object.values(opts.image) : [opts.image].filter(Boolean)) if (!existsSync(f)) throw new Error(`no ${f}\n${usage}`);
  try {
    await make(name, { ...opts, faithful: !unfaithful && (faithful || typeof opts.image === 'string') });
  } finally {
    // (the judge's llama-server, when Qwen3-VL picked or judged: a child of this process, it kept
    // it from ever exiting, so a model made and judged waited out the runner's two hours and was
    // called hung, its pull request never opened)
    (await import('./vlm.mjs')).stop();
  }
}
