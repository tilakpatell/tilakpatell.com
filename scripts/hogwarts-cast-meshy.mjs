// A Hogwarts figure made with Meshy where the desktop's own pipeline
// (scripts/hogwarts-cast.mjs: TRELLIS.2, Blender's heat weights) made it
// badly: the same concept picture, picked the same way, given to Meshy's
// image-to-3D, rigged by Meshy's rigger on its humanoid skeleton (the one
// every library clip was made on), and Meshy's own walk and run with an
// idle from its library beside it, as scripts/meshy-middleearth.mjs made
// Middle-earth's cast. Then the same cut, credit and sheet as the rest of
// the cast, so a world loads it as it loads any of them (cast.json).
//
//   node --env-file=.env.local scripts/hogwarts-cast-meshy.mjs <step> NAME…
//   steps: model (image-to-3D from scripts/gen3d/cache/hogwarts/NAME/concept.png),
//   rig, fetch (the cuts, the clips, the credit, cast.json), all, balance (idle: Meshy's own, when one's wanted)
//   [--library walk,run]: those from the library instead of Meshy's (a walk that floats on a long skirt)
//
// Three accounts' keys (MESHY_API_KEY, MESHY_API_KEY_ACC_2, _ACC_3, never
// printed): a figure's first task goes on the first with the credits for
// it, and the rest of its tasks on that one (a task is only read by the
// account that made it). Task ids and accounts are kept in
// scripts/hogwarts-cast-meshy-tasks.json, so a step run again never pays
// twice; delete a name's entry to make it again.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUTS, MAX_BYTES, OUT, TASKS, manifest, matte, record, smooth } from './hogwarts-cast.mjs';
import { fileOf, ground, GROUND, hipsFor, LOCO, onFigure } from './rig/clips.mjs';
import { FIGURES } from './hogwarts-cast-figures.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const MESHY_TASKS = join(ROOT, 'scripts', 'hogwarts-cast-meshy-tasks.json');
const CACHE = join(ROOT, 'scripts', 'gen3d', 'cache', 'hogwarts');
const API = 'https://api.meshy.ai/openapi';
export const ACCOUNTS = ['MESHY_API_KEY', 'MESHY_API_KEY_ACC_2', 'MESHY_API_KEY_ACC_3'];
// what each step costs (credits), so a figure starts on an account that can finish it
export const COST = { model: 30, rig: 5, idle: 0 }; // (the idle is the library's: the step stays for a figure that wants Meshy's)
export const OWN_GROUND = { idle: 'each', walk: null, run: 'lowest' };
export const POLY = 14000; // (Meshy's remesh: the hq cut's size, the others simplified from it)

// The account a figure's tasks go on: the one it started on, else the first
// that can pay for all of it. (pure: the balances are given)
export function account(entry, balances) {
  if (entry?.acc) return entry.acc;
  const need = COST.model + COST.rig + COST.idle;
  return ACCOUNTS.find((a) => (balances[a] ?? 0) >= need) ?? null;
}

// The credit for a figure made with Meshy (as Middle-earth's are, the picture the desktop's own)
export const credit = (name) => ({
  source: 'https://www.meshy.ai',
  name: `${name[0].toUpperCase()}${name.slice(1)}, a big-headed toy figure for the Hogwarts world, made with Meshy AI from a concept picture drawn on the site owner's machine (FLUX.1-schnell, scripts/gen3d/picture.mjs), rigged with its walk, run and idle (scripts/hogwarts-cast-meshy.mjs)`,
  authors: ['Tilak Patel, with Meshy AI'],
  license: 'Meshy paid-plan output, owned by the site owner; FLUX.1-schnell Apache 2.0',
});

const headers = (acc) => ({ Authorization: `Bearer ${process.env[acc]}`, 'Content-Type': 'application/json' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(acc, method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers: headers(acc), body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
async function wait(acc, path, id, label) {
  for (let i = 0; ; i++) {
    const t = await api(acc, 'GET', `${path}/${id}`);
    if (t.status === 'SUCCEEDED') return t;
    if (['FAILED', 'CANCELED', 'EXPIRED'].includes(t.status)) throw new Error(`${label}: ${t.status} ${t.task_error?.message ?? ''}`);
    if (i % 6 === 0) console.log(`  ${label}: ${t.status} ${t.progress ?? 0}%`);
    await sleep(5000);
  }
}
async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}
const load = () => (existsSync(MESHY_TASKS) ? JSON.parse(readFileSync(MESHY_TASKS, 'utf8')) : {});
const save = (s) => writeFileSync(MESHY_TASKS, `${JSON.stringify(s, null, 2)}\n`);
const balances = async () => Object.fromEntries(await Promise.all(ACCOUNTS.filter((a) => process.env[a]).map(async (a) => [a, (await api(a, 'GET', '/v1/balance')).balance])));

let nio = null;
async function io() {
  if (!nio) {
    await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
    nio = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  }
  return nio;
}

const steps = {
  async model(name, s) {
    const picture = join(CACHE, name, 'concept.png');
    if (!existsSync(picture)) throw new Error(`${name}: no picked concept picture (node scripts/hogwarts-cast.mjs picture, then pick)`);
    s[name] ??= {};
    if (!s[name].model) {
      const acc = account(s[name], await balances());
      if (!acc) throw new Error(`${name}: no account has ${COST.model + COST.rig + COST.idle} credits`);
      s[name].acc = acc;
      s[name].model = (
        await api(acc, 'POST', '/v1/image-to-3d', {
          image_url: `data:image/png;base64,${readFileSync(picture).toString('base64')}`,
          ai_model: 'latest',
          should_texture: true,
          enable_pbr: false,
          should_remesh: true,
          topology: 'triangle',
          target_polycount: POLY,
          texture_resolution: '2k',
          pose_mode: 'a-pose',
          target_formats: ['glb'],
        })
      ).result;
      save(s);
    }
    const t = await wait(s[name].acc, '/v1/image-to-3d', s[name].model, `${name} model`);
    console.log(`model    ${name}: ${t.consumed_credits ?? '?'} credits`);
  },
  async rig(name, s) {
    if (!s[name]?.model) throw new Error(`${name}: no model yet`);
    if (!s[name].rig) {
      s[name].rig = (await api(s[name].acc, 'POST', '/v1/rigging', { input_task_id: s[name].model, height_meters: FIGURES[name].height })).result;
      save(s);
    }
    const t = await wait(s[name].acc, '/v1/rigging', s[name].rig, `${name} rig`);
    console.log(`rig      ${name}: ${t.consumed_credits ?? '?'} credits`);
  },
  // an idle from Meshy's animation library (action 0), on the figure's own skeleton
  async idle(name, s) {
    if (!s[name]?.rig) throw new Error(`${name}: not rigged yet`);
    if (!s[name].idle) {
      s[name].idle = (await api(s[name].acc, 'POST', '/v1/animations', { rig_task_id: s[name].rig, action_id: 0, post_process: { operation_type: 'extract_armature' } })).result;
      save(s);
    }
    const t = await wait(s[name].acc, '/v1/animations', s[name].idle, `${name} idle`);
    console.log(`idle     ${name}: ${t.consumed_credits ?? '?'} credits`);
  },
  // the three cuts from the rigged figure, its own three clips beside them, the credit and cast.json
  async fetch(name, s) {
    if (!s[name]?.rig) throw new Error(`${name}: not rigged yet`);
    const acc = s[name].acc;
    const raw = join(CACHE, name, 'meshy');
    const r = (await api(acc, 'GET', `/v1/rigging/${s[name].rig}`)).result;
    const figure = join(raw, 'rigged.glb');
    if (!existsSync(figure)) await download(r.rigged_character_glb_url, figure);
    const { webReady } = await import('./gen3d/web.mjs');
    const n = await io();
    mkdirSync(OUT, { recursive: true });
    const sizes = {};
    let hipsY = null;
    for (const [tier, c] of Object.entries(CUTS)) {
      const read = async () => {
        const d = await n.read(figure);
        for (const a of d.getRoot().listAnimations()) a.dispose();
        return smooth(matte(d));
      };
      let doc = await read();
      let { after } = await webReady(doc, { tris: c.faces, tex: c.tex });
      // (Meshy's atlas locks its seams short of a small cut: a little over is let be, where crossing
      // them would smear the robe's colour in streaks; the low cut, too small to show it, is crossed)
      const over = tier === 'lo' ? 1.05 : 1.15;
      if (after > c.faces * over) {
        doc = await read();
        ({ after } = await webReady(doc, { tris: c.faces, tex: c.tex, acrossSeams: true }));
      }
      if (after > c.faces * over) throw new Error(`${name}${c.suffix}.glb has ${Math.round(after)} triangles, over its ${c.faces}`);
      hipsY ??= doc.getRoot().listNodes().find((x) => x.getName() === 'Hips')?.getTranslation()[1] ?? null;
      const file = join(OUT, `${name}${c.suffix}.glb`);
      await n.write(file, doc);
      const bytes = statSync(file).size;
      if (bytes > MAX_BYTES) throw new Error(`${name}${c.suffix}.glb is ${(bytes / 1048576).toFixed(1)} MB, over 4 MB`);
      sizes[tier] = { triangles: Math.round(after), bytes };
      console.log(`fetch    ${name} ${tier}: ${Math.round(after)} triangles, ${(bytes / 1024).toFixed(0)} KB`);
    }
    if (hipsY == null) throw new Error(`${name}: Meshy's rig has no Hips`);
    // its own idle, walk and run: the skeleton and the motion, nothing to draw
    const fig = await n.read(join(OUT, `${name}.glb`));
    // the hips the library's clips stand on the floor with (its calm idle's, as clips.mjs finds them)
    hipsY = hipsFor(fig, onFigure(fig, await n.read(fileOf(LOCO.idle)), 'idle').doc);
    // Meshy's own walk and run (made on this rig); the idle the rest of the cast stands in, the
    // library's calm one, since Meshy's stands turned off to the side and floats a few centimetres
    // (a figure whose Meshy walk floats or slides on its skirts, rig-check says, takes the library's
    // walk and run instead, stood on its soles as the cast's own are: `library` in its task entry)
    const lib = new Set(s[name].library ?? []);
    const clips = { walk: lib.has('walk') ? 'library' : r.basic_animations?.walking_armature_glb_url, run: lib.has('run') ? 'library' : r.basic_animations?.running_armature_glb_url, idle: 'library' };
    for (const [c, url] of Object.entries(clips)) {
      if (!url) throw new Error(`${name}: Meshy gave no ${c}`);
      let doc;
      if (url === 'library') doc = onFigure(fig, await n.read(fileOf(LOCO[c])), c).doc;
      else {
        const f = join(raw, `${c}.glb`);
        if (!existsSync(f)) await download(url, f);
        doc = await n.read(f);
      }
      // (stood on this figure's own soles as clips.mjs stands the cast's; its walk plants its feet as it
      // is, and moved frame by frame it would slide)
      const how = url === 'library' ? GROUND[c] : OWN_GROUND[c];
      if (how) ground(fig, doc, how);
      for (const node of doc.getRoot().listNodes()) node.setMesh(null).setSkin(null);
      for (const p of [...doc.getRoot().listMeshes(), ...doc.getRoot().listMaterials(), ...doc.getRoot().listTextures()]) p.dispose();
      await doc.transform(dedup(), prune({ keepLeaves: true }), resample(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
      await n.write(join(OUT, `${name}-${c}.glb`), doc);
    }
    const creditsFile = join(ROOT, 'public', 'games', 'credits.json');
    const credits = JSON.parse(readFileSync(creditsFile, 'utf8'));
    credits[`hogwarts/cast/${name}`] = credit(name);
    writeFileSync(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
    // the cast's own record, so cast.json and the sheet step treat it as any figure
    const cast = existsSync(TASKS) ? JSON.parse(readFileSync(TASKS, 'utf8')) : {};
    cast[name] ??= {};
    record(cast, name, 'cut', `meshy:${s[name].rig}`, { sizes, hipsY, by: 'meshy' });
    writeFileSync(TASKS, `${JSON.stringify(cast, null, 2)}\n`);
    writeFileSync(join(OUT, 'cast.json'), `${JSON.stringify(manifest(cast), null, 2)}\n`);
  },
};
steps.all = async (name, s) => {
  for (const st of ['model', 'rig', 'fetch']) await steps[st](name, s);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [step, ...names] = process.argv.slice(2);
  if (step === 'balance') {
    for (const [a, b] of Object.entries(await balances())) console.log(`${a.replace('MESHY_API_KEY', 'account').replace('_ACC_', ' ')}: ${b} credits`);
    process.exit(0);
  }
  if (!steps[step]) throw new Error(`step: ${[...Object.keys(steps), 'balance'].join(' | ')}`);
  // --library walk,run: those clips from the library for these figures, kept in their entries
  const at = names.indexOf('--library');
  const library = at >= 0 ? names.splice(at, 2)[1].split(',') : null;
  for (const n of names) if (!FIGURES[n]) throw new Error(`no figure ${n}`);
  if (!ACCOUNTS.some((a) => process.env[a])) throw new Error('no Meshy key: run with node --env-file=.env.local');
  const s = load();
  for (const n of names) {
    if (library) {
      s[n] = { ...s[n], library };
      save(s);
    }
    await steps[step](n, s);
  }
}
