// Hogwarts' people as figures on the site's shared skeleton, made on this
// machine's GPU (docs/superpowers/specs/2026-10-21-hogwarts-world-design.md
// §4.10; scripts/hogwarts-cast.md says how to run it and what to look for):
//
//   picture  four concept pictures from the figure's words (scripts/gen3d/picture.mjs),
//            and a contact sheet of them to choose from
//   pick     the one to model (`pick NAME SEED`, after looking at the sheet)
//   model    TRELLIS.2 from it (scripts/gen3d/generate.mjs), Y up and facing +z
//   bake     a bake for each of the three cuts (16,000, 8,000 and 2,500 faces, each
//            its own atlas: scripts/gen3d/bake.py through scripts/rig/bake.py,
//            which remeshes the low mesh into one closed skin first: Blender)
//   skin     Meshy's 24 bones put in, bound by heat (scripts/rig/skin.mjs), the
//            same skeleton in every cut
//   cut      the three cuts for the web into public/models/hogwarts/cast/ (.hq,
//            plain, .lo: web.mjs's webReady), its own idle, walk and run beside
//            it (scripts/rig/clips.mjs), its credit, and cast.json
//   sheet    the check (scripts/rig/rig-check.mjs: every bone, every clip, the
//            feet down) and four views in its idle, walk and a cast, into
//            docs/gen3d/hogwarts/NAME.webp, to be looked at before it ships
//
//   node scripts/hogwarts-cast.mjs <step | all> [--only harry,ron] [--fresh]
//   node scripts/hogwarts-cast.mjs pick harry 12
//
// What each step made, and from what, is kept in scripts/hogwarts-cast-tasks.json:
// a step whose inputs haven't changed is never made again (the GPU's
// minutes are the dear part), --fresh makes it again. The pictures and
// everything on the way stay in scripts/gen3d/cache/hogwarts/NAME/ (git
// ignores it); only the cuts, their clips, the sheet and the credit ship.

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIGURES, NAMES_NEVER, prompt } from './hogwarts-cast-figures.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TASKS = join(ROOT, 'scripts', 'hogwarts-cast-tasks.json');
export const OUT = join(ROOT, 'public', 'models', 'hogwarts', 'cast');
export const SHEETS = join(ROOT, 'docs', 'gen3d', 'hogwarts');
const CACHE = join(ROOT, 'scripts', 'gen3d', 'cache', 'hogwarts');
export const STEPS = ['picture', 'model', 'bake', 'skin', 'cut', 'sheet'];
export const CANDIDATES = 4;
// The three cuts, by lib/device's detail (budget.mjs's names and suffixes),
// each baked from the raw model at its own size (scripts/rig/bake.py) and
// its atlas painted at its own size: simplifying one bake down for the
// others, as web.mjs does a prop's, dragged its thousands of chart edges
// and painted skin on the hair. Smaller than a gen3d prop's cuts: a crowd of
// these share a scene, and the whole cast (some thirty) comes in under 30
// MB. Colour only, as Meshy's figures are: matte, no metal, no normal map (a
// toy's paint has no grain worth the bytes at a figure's size on screen).
export const CUTS = {
  hq: { suffix: '.hq', faces: 14000, tex: 1536, bake: 2048, voxel: 400 },
  mid: { suffix: '', faces: 8000, tex: 1024, bake: 1024, voxel: 300 },
  lo: { suffix: '.lo', faces: 2500, tex: 512, bake: 512, voxel: 200 },
};
export const MAX_BYTES = 4 * 1024 * 1024; // (web.mjs's cap: no model over it ships)

// ── the task state (pure) ──

// A step is due when it has never been made, or was made from something
// else (its key), or when asked afresh.
export const due = (state, name, step, key, { fresh = false } = {}) => fresh || state[name]?.[step]?.key !== key;

export function record(state, name, step, key, what = {}) {
  state[name] ??= {};
  state[name][step] = { key, ...what, at: new Date().toISOString().slice(0, 10) };
  return state;
}

// `--only a,b` → the names, each one the table has; else every figure
export function only(arg, table = FIGURES) {
  const names = arg ? arg.split(',').map((s) => s.trim()).filter(Boolean) : Object.keys(table);
  for (const n of names) if (!table[n]) throw new Error(`no figure ${n} (${Object.keys(table).join(', ')})`);
  return names;
}

// Every prompt checked before it goes anywhere: no figure's name in it.
export function clean(name) {
  const p = prompt(name);
  const hit = p.match(NAMES_NEVER);
  if (hit) throw new Error(`${name}'s words name someone ("${hit[0]}"): describe the look, never the person`);
  return p;
}

// What cast.json says of the figures that have shipped (pure: the table and the state).
export function manifest(state, table = FIGURES) {
  const figures = {};
  for (const [name, f] of Object.entries(table)) {
    if (!state[name]?.cut) continue;
    figures[name] = {
      height: f.height,
      kind: f.kind,
      ...(f.house ? { house: f.house } : {}),
      ...(f.tall ? { tall: true } : {}),
      ...(f.tint ? { tint: f.tint } : {}),
      cuts: Object.fromEntries(Object.entries(CUTS).map(([t, c]) => [t, `${name}${c.suffix}.glb`])),
      clips: Object.fromEntries(['idle', 'walk', 'run'].map((c) => [c, `${name}-${c}.glb`])),
      hipsY: state[name].skin?.hipsY ?? null,
    };
  }
  return {
    about:
      'Hogwarts’ cast on the site’s shared skeleton (Meshy’s 24 bones, under an Armature scaled to metres), made by scripts/hogwarts-cast.mjs. Load a figure as src/components/middleearth/road/cast.js loads one: NAME.glb (or the cut for the device’s detail: hq for high, plain for mid, lo for low) and its own idle, walk and run beside it; every other clip through lib/three/clipLibrary.js’s forFigure with the figure’s hips. Scale it to `height` metres, crown to sole. `tall` marks a figure far over a person’s height (2.6 m): give it the doors, seats and camera distance of its size, never squeeze it to a person’s. A `tint` is applied to the base colour as its entry says.',
    figures,
  };
}

// The credit a figure ships with (public/games/credits.json), and the one its clips share.
export const credit = (name) => ({
  source: 'https://github.com/microsoft/TRELLIS.2',
  name: `${name[0].toUpperCase()}${name.slice(1)}, a big-headed toy figure for the Hogwarts world, made on the site owner's machine from a concept picture drawn there (FLUX.1-schnell, scripts/gen3d/picture.mjs) with TRELLIS.2 (trellis.cpp), baked in Blender and skinned on Meshy's skeleton by scripts/rig/skin.mjs (scripts/hogwarts-cast.mjs)`,
  authors: ['Tilak Patel, with Microsoft TRELLIS.2'],
  license: 'Generated for this site; TRELLIS.2 is MIT, FLUX.1-schnell Apache 2.0',
});
export const CLIPS_CREDIT = {
  source: 'https://quaternius.com/packs/universalanimationlibrary.html',
  name: "The Hogwarts cast's own idle, walk and run beside each figure in public/models/hogwarts/cast/ (NAME-idle.glb, -walk.glb, -run.glb): the Universal Animation Library's calm idle, formal walk and sprint, baked on the site's skeleton and retargeted to each figure by scripts/rig/clips.mjs",
  authors: ['Quaternius'],
  license: 'CC0 1.0',
};

// ── the steps ──

const load = () => (existsSync(TASKS) ? JSON.parse(readFileSync(TASKS, 'utf8')) : {});
const save = (s) => writeFileSync(TASKS, `${JSON.stringify(s, null, 2)}\n`);
// one figure's state put back into the file as it is now (another run, on
// another figure, may have written it since this one read it)
const saveOne = (name, s) => save({ ...load(), [name]: s[name] });
const dirOf = (name) => join(CACHE, name);
const kb = (f) => `${(statSync(f).size / 1024).toFixed(0)} KB`;

async function digestOf(...parts) {
  const { digest } = await import('./gen3d/steps.mjs');
  return digest(...parts);
}

const steps = {
  // four candidates, and a sheet of them to look at
  async picture(name, s, { fresh, log }) {
    const words = clean(name);
    const seed0 = FIGURES[name].seed ?? 1;
    const key = await digestOf(words, seed0, CANDIDATES);
    if (!due(s, name, 'picture', key, { fresh })) return log('pictures as they were');
    const { picture } = await import('./gen3d/picture.mjs');
    mkdirSync(dirOf(name), { recursive: true });
    const files = [];
    for (let i = 0; i < CANDIDATES; i++) {
      const file = join(dirOf(name), `concept-${seed0 + i}.png`);
      await picture(words, file, { seed: seed0 + i });
      files.push(file);
    }
    const { default: sharp } = await import('sharp');
    const S = 512;
    await sharp({ create: { width: S * files.length, height: S, channels: 3, background: '#fff' } })
      .composite(await Promise.all(files.map(async (f, i) => ({ input: await sharp(f).resize(S, S).png().toBuffer(), left: i * S, top: 0 }))))
      .png()
      .toFile(join(dirOf(name), 'candidates.png'));
    record(s, name, 'picture', key, { seeds: files.map((_, i) => seed0 + i) });
    delete s[name].pick;
    log(`${CANDIDATES} pictures: look at ${relative(ROOT, join(dirOf(name), 'candidates.png'))}, then pick one`);
  },

  // TRELLIS.2 from the picked picture, prepared as the model wants it
  async model(name, s, { fresh, log }) {
    const seed = s[name]?.pick?.seed;
    if (!seed) throw new Error(`${name}: no picture picked (node scripts/hogwarts-cast.mjs pick ${name} SEED)`);
    const concept = join(dirOf(name), `concept-${seed}.png`);
    const key = await digestOf(readFileSync(concept), 'trelliscpp', 1024);
    const raw = join(dirOf(name), 'raw.glb');
    if (!due(s, name, 'model', key, { fresh }) && existsSync(raw)) return log('model as it was');
    const { waitForGpu } = await import('./desktop/lib.mjs');
    await waitForGpu(20000, { log });
    const { prepare } = await import('./gen3d/prepare.mjs');
    const { generate } = await import('./gen3d/generate.mjs');
    const ready = join(dirOf(name), 'prepared.png');
    await prepare(concept, ready);
    const r = await generate(ready, raw, { engine: 'trelliscpp', seed: 42, res: 1024 });
    record(s, name, 'model', key, { seconds: Math.round(r.seconds) });
    log(`raw model in ${Math.round(r.seconds)} s`);
  },

  async bake(name, s, { fresh, log }) {
    const raw = join(dirOf(name), 'raw.glb');
    const script = join(ROOT, 'scripts', 'rig', 'bake.py');
    const key = await digestOf(s[name]?.model?.key, JSON.stringify(CUTS), readFileSync(script), readFileSync(join(ROOT, 'scripts', 'gen3d', 'bake.py')));
    if (!due(s, name, 'bake', key, { fresh }) && Object.keys(CUTS).every((t) => existsSync(join(dirOf(name), `baked-${t}.glb`)))) return log('bakes as they were');
    // (scripts/gen3d's bake, its low mesh remeshed into one closed skin first: scripts/rig/bake.py says why)
    const { blenderCommand } = await import('./rig/skin.mjs');
    const { live } = await import('./desktop/lib.mjs');
    const seconds = {};
    for (const [t, c] of Object.entries(CUTS)) {
      const baked = join(dirOf(name), `baked-${t}.glb`);
      // (a coarser remesh for a smaller cut: decimating 800,000 faces to 2,500 took nine minutes)
      const cmd = await blenderCommand(script, [raw, baked, '--faces', c.faces, '--tex', c.bake, '--voxel', c.voxel]);
      if (!cmd) throw new Error('Blender is not set up here: see scripts/gen3d/README.md');
      const started = Date.now();
      await live(cmd[0], cmd.slice(1), { name: 'blender', minutes: Number(process.env.GEN3D_BAKE_MINUTES ?? 20) });
      if (!existsSync(baked)) throw new Error(`Blender made no ${baked}`);
      seconds[t] = Math.round((Date.now() - started) / 1000);
      log(`${t}: baked to ${c.faces} faces and a ${c.bake} atlas in ${seconds[t]} s`);
    }
    record(s, name, 'bake', key, { seconds });
  },

  // the top cut's joints read off its shape, and every cut skinned to them
  async skin(name, s, { fresh, log }) {
    const f = FIGURES[name];
    const key = await digestOf(s[name]?.bake?.key, f.height, JSON.stringify(f.shares ?? {}), f.turn ?? 0, ...['skin.mjs', 'skin.py', 'transfer.mjs'].map((n) => readFileSync(join(ROOT, 'scripts', 'rig', n))));
    if (!due(s, name, 'skin', key, { fresh }) && Object.keys(CUTS).every((t) => existsSync(join(dirOf(name), `skinned-${t}.glb`)))) return log('skins as they were');
    const { skin } = await import('./rig/skin.mjs');
    // (the top cut weighted by heat; the others like it, vertex by nearest vertex)
    let joints = null;
    let first = null;
    const [top] = Object.keys(CUTS);
    for (const t of Object.keys(CUTS)) {
      const like = first ? join(dirOf(name), `skinned-${top}.glb`) : null;
      const r = await skin(join(dirOf(name), `baked-${t}.glb`), join(dirOf(name), `skinned-${t}.glb`), { height: f.height, turn: f.turn ?? 0, shares: f.shares, joints, like, keep: join(dirOf(name), `skin-${t}`), log });
      joints ??= r.joints;
      first ??= r;
    }
    record(s, name, 'skin', key, { hipsY: Math.round(first.joints.hips[1] * 1000) / 10, found: first.joints.found, on: first.report?.on ?? null });
  },

  // the three cuts, the clips beside them, the credit and the manifest
  async cut(name, s, { fresh, log }) {
    const key = await digestOf(s[name]?.skin?.key, JSON.stringify(CUTS), readFileSync(join(ROOT, 'scripts', 'rig', 'clips.mjs')));
    if (!due(s, name, 'cut', key, { fresh }) && existsSync(join(OUT, `${name}.glb`))) return log('cuts as they were');
    const { io, webReady } = await import('./gen3d/web.mjs');
    const nio = await io();
    mkdirSync(OUT, { recursive: true });
    const sizes = {};
    for (const [tier, c] of Object.entries(CUTS)) {
      const doc = await nio.read(join(dirOf(name), `skinned-${tier}.glb`));
      smooth(matte(doc));
      const { after } = await webReady(doc, { tris: c.faces, tex: c.tex });
      const file = join(OUT, `${name}${c.suffix}.glb`);
      await nio.write(file, doc);
      const bytes = statSync(file).size;
      if (bytes > MAX_BYTES) throw new Error(`${name}${c.suffix}.glb is ${(bytes / 1048576).toFixed(1)} MB, over 4 MB`);
      sizes[tier] = { triangles: Math.round(after), bytes };
      log(`${tier}: ${Math.round(after)} triangles, ${kb(file)}`);
    }
    const { ownClips } = await import('./rig/clips.mjs');
    const clips = await ownClips(join(OUT, `${name}.glb`));
    for (const f of Object.values(clips)) log(`${relative(ROOT, f)}: ${kb(f)}`);
    const creditsFile = join(ROOT, 'public', 'games', 'credits.json');
    const credits = JSON.parse(readFileSync(creditsFile, 'utf8'));
    credits[`hogwarts/cast/${name}`] = credit(name);
    credits['hogwarts/cast-clips'] = CLIPS_CREDIT;
    writeFileSync(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
    record(s, name, 'cut', key, { sizes });
    writeFileSync(join(OUT, 'cast.json'), `${JSON.stringify(manifest({ ...load(), [name]: s[name] }), null, 2)}\n`);
  },

  // the check and the sheet
  async sheet(name, s, { fresh, log }) {
    const file = join(OUT, `${name}.glb`);
    const out = join(SHEETS, `${name}.webp`);
    const key = await digestOf(readFileSync(file), readFileSync(join(ROOT, 'scripts', 'rig', 'rig-check.html')));
    if (!due(s, name, 'sheet', key, { fresh }) && existsSync(out)) return log('sheet as it was');
    mkdirSync(SHEETS, { recursive: true });
    const { execFileSync } = await import('node:child_process');
    let text = '';
    let ok = true;
    try {
      text = execFileSync(process.execPath, [join(ROOT, 'scripts', 'rig', 'rig-check.mjs'), file, '--sheet', out, '--json', join(dirOf(name), 'check.json')], { encoding: 'utf8', cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      text = String(e.stdout ?? '') + String(e.stderr ?? '');
      ok = false;
    }
    log(text.trim());
    const check = existsSync(join(dirOf(name), 'check.json')) ? Object.values(JSON.parse(readFileSync(join(dirOf(name), 'check.json'), 'utf8')))[0] : null;
    record(s, name, 'sheet', key, { ok, numbers: check?.verdict?.numbers ?? null, problems: check?.verdict?.problems ?? null, bytes: existsSync(out) ? statSync(out).size : null });
    log(`${ok ? 'passed' : 'FAILED'}: look at ${relative(ROOT, out)} before it ships`);
  },
};

// A toy's paint: the colour map kept, the metal, the roughness and the
// normal maps dropped, the surface matte (Meshy's figures are drawn so;
// the Road's cast.js sets them matte as it loads them anyway).
export function matte(doc) {
  for (const m of doc.getRoot().listMaterials()) {
    m.setMetallicRoughnessTexture(null).setNormalTexture(null).setOcclusionTexture(null);
    m.setMetallicFactor(0).setRoughnessFactor(0.85);
  }
  for (const t of doc.getRoot().listTextures()) if (!t.listParents().some((p) => p.propertyType !== 'Root')) t.dispose();
  return doc;
}

export async function run(step, names, { fresh = false, log = console.log } = {}) {
  const s = load();
  const order = step === 'all' ? STEPS : [step];
  for (const name of names)
    for (const st of order) {
      if (!steps[st]) throw new Error(`no step ${st} (${[...STEPS, 'all', 'pick'].join(', ')})`);
      Object.assign(s, { [name]: load()[name] ?? s[name] });
      await steps[st](name, s, { fresh, log: (m) => log(`[${name}] ${st}: ${m}`) });
      saveOne(name, s);
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (n) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  const fresh = args.includes('--fresh') && args.splice(args.indexOf('--fresh'), 1).length > 0;
  const onlyArg = flag('only');
  const [step, ...rest] = args;
  if (step === 'pick') {
    const [name, seed] = rest;
    const s = load();
    if (!FIGURES[name] || !s[name]?.picture?.seeds?.includes(Number(seed))) throw new Error(`usage: pick NAME SEED (one of ${s[name]?.picture?.seeds?.join(', ') ?? 'its pictures: run picture first'})`);
    s[name].pick = { seed: Number(seed), at: new Date().toISOString().slice(0, 10) };
    copyFileSync(join(dirOf(name), `concept-${seed}.png`), join(dirOf(name), 'concept.png'));
    saveOne(name, s);
    console.log(`${name}: concept-${seed}.png picked`);
  } else if (step) await run(step, only(onlyArg ?? rest.join(',')), { fresh });
  else throw new Error(`usage: node scripts/hogwarts-cast.mjs <${[...STEPS, 'all'].join(' | ')}> [--only a,b] [--fresh] | pick NAME SEED`);
}

// Normals made smooth across every edge, the same at a UV seam's two sides
// (a vertex's normal is the faces' round its place, wherever its UV is),
// then the vertices that now match welded: Blender's export splits a vertex
// at every edge sharper than 35°, and a decimated figure has thousands of
// them, which a toy's rounded paint doesn't want and the bytes can't bear.
export function smooth(doc) {
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const idx = prim.getIndices();
      if (!pos || !idx) continue;
      const n = pos.getCount();
      const P = new Float32Array(n * 3);
      const e = [];
      for (let i = 0; i < n; i++) P.set(pos.getElement(i, e), i * 3);
      const place = new Map();
      const at = new Uint32Array(n);
      for (let i = 0; i < n; i++) {
        const k = `${Math.round(P[i * 3] * 1e5)},${Math.round(P[i * 3 + 1] * 1e5)},${Math.round(P[i * 3 + 2] * 1e5)}`;
        if (!place.has(k)) place.set(k, place.size);
        at[i] = place.get(k);
      }
      const sum = new Float64Array(place.size * 3);
      const ix = idx.getArray();
      for (let t = 0; t < ix.length; t += 3) {
        const [a, b, c] = [ix[t], ix[t + 1], ix[t + 2]];
        const u = [0, 1, 2].map((j) => P[b * 3 + j] - P[a * 3 + j]);
        const v = [0, 1, 2].map((j) => P[c * 3 + j] - P[a * 3 + j]);
        const f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; // (its length is twice the area: a big face counts for more)
        for (const k of [a, b, c]) for (let j = 0; j < 3; j++) sum[at[k] * 3 + j] += f[j];
      }
      const N = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const [x, y, z] = [sum[at[i] * 3], sum[at[i] * 3 + 1], sum[at[i] * 3 + 2]];
        const l = Math.hypot(x, y, z) || 1;
        N.set([x / l, y / l, z / l], i * 3);
      }
      const normal = prim.getAttribute('NORMAL');
      const acc = doc.createAccessor().setType('VEC3').setArray(N).setBuffer(pos.getBuffer());
      prim.setAttribute('NORMAL', acc);
      if (normal && !normal.listParents().some((p) => p.propertyType === 'Primitive')) normal.dispose();
    }
  return doc;
}
