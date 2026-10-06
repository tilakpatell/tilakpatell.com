// Makes the people of the galaxy's surfaces (src/components/universe) with
// Meshy (meshy.ai), the site owner's account: a concept image, a textured
// model from it and Meshy's humanoid skeleton, for walking about on the
// ground. They have no clips of their own: footScene.js's loadPartyFigure
// gives every figure with `src: { url }` Rick's idle, walk and run, the
// bones' turns and the hips' height (so the skeleton has to be Meshy's, with
// its `Hips`). The slug-like crime lord isn't a person: a model only, not
// rigged, standing still. Everything is compressed for the web into
// public/models/galaxy/crew/. The output is committed, so the site never
// calls Meshy.
//
//   node scripts/meshy-galaxy.mjs <step> [name …]
//
// Steps, in order: images (9 credits each), models (30), rig (5), fetch
// (free). Each task's id is kept in scripts/meshy-galaxy-tasks.json, so
// running a step again never pays twice; delete a name's entry there to
// make it again. MESHY_API_KEY comes from the environment; it is never
// printed. Concept images and thumbnails go to lab/meshy/galaxy (or
// MESHY_REVIEW), for looking at, not shipped.
//
// A person can also come from a Sketchfab model (an asset with a `uid`,
// which has no image or model step): `bake` (free; SKETCHFAB_API_TOKEN) is
// that model downloaded, its transforms baked in so it stands upright on y = 0
// facing +z, its maps JPEGs at 1024, no meshopt (Meshy can't read it), into
// <review>/in/<name>.glb; `rigurl` (5 credits) is that file sent to Meshy's
// rigger as a data: URI `model_url` (no public URL needed, nothing committed),
// whose task id goes where `rig`'s would, for `fetch` to take from there.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, getBounds, meshopt, prune, textureCompress, transformMesh } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'models', 'galaxy', 'crew');
const REVIEW = process.env.MESHY_REVIEW ?? join(ROOT, 'lab', 'meshy', 'galaxy');
const TASKS = join(ROOT, 'scripts', 'meshy-galaxy-tasks.json');
const API = 'https://api.meshy.ai/openapi';

const LOOK = 'Semi-realistic 3D video-game character, realistic proportions, clean readable shapes.';
// for those the model step turned down as too like a film's own: softer
const SOFT = 'A stylized 3D animated feature film character, soft and appealing, realistic body proportions, clean readable shapes.';
const POSE = 'Full body, front view, standing straight in an A-pose with the arms held a little away from the body, empty hands, feet slightly apart. One figure only. Plain neutral grey background, no text, no shadow.';
const CREATURE = `${LOOK} Full body, three-quarter front view, the whole creature in frame. One figure only. Plain neutral grey background, no text, no shadow.`;

// height: metres (for the rig, and the still one's size); poly: target
// triangles; tex: texture size on the site; still: not rigged. Described by
// how they look, never by name: the image step turns names down, and the
// model step has turned down a concept that looked too much like a film's own
// (scripts/meshy-cockpit.mjs).
// uid: a Sketchfab model to rig instead of generating one (see `bake`)
export const ASSETS = {
  luke: {
    uid: '84d5ed9497b5435b9a804f956ff74927',
    // (the prompt is for the Luke Meshy made, before this figure took his place:
    // a pilot in the films' kit, as the first concept, to the letter, was
    // turned down at the model step twice; its tasks are in the tasks file, as
    // `generatedRig`)
    height: 1.72,
    prompt:
      'A young adult starfighter pilot with short wavy light sandy hair and a clean-shaven friendly face, an orange flight jumpsuit with zipped pockets, a white ribbed padded vest, dark grey gloves, black flight boots and a grey belt with a holster on the right hip.',
  },
  leia: {
    uid: 'e5efdd35a5e4462cbc013db44e80d31e',
    height: 1.5,
  },
  han: {
    height: 1.85,
    prompt:
      'A roguish smuggler in his thirties, tousled brown hair, a white long-sleeved collarless shirt, an open black vest, dark navy-blue trousers with a thin red piping stripe down each outer seam, black knee-high boots, a brown gun belt with an empty holster strapped low on the right thigh.',
  },
  jabba: {
    height: 1.8,
    long: 3.9,
    still: true,
    prompt:
      'A huge slug-like alien crime lord, an enormous fat greenish-tan wrinkled glistening body ending in a long tapering tail curled behind, a wide toad-like face with orange slit-pupil eyes and a wide mouth, short stubby arms, resting upright on his belly and tail.',
  },
  mando: {
    soft: true,
    height: 1.85,
    prompt:
      'A lone armoured bounty hunter: polished silver steel armour plates on the chest, shoulders, forearms and shins over a dark grey-brown padded flight suit, a full-face rounded silver helmet with a T-shaped black visor, a brown hide cape hanging behind, a brown belt with ammo pouches.',
  },
  ahsoka: {
    height: 1.85,
    prompt:
      'An alien woman warrior with orange skin and white facial markings, tall blue-and-white striped head-tails: two horn-like montrals rising from the head and two long tails hanging down to the chest. A fitted grey-white tunic and leggings, a pale grey hooded cloak with the hood down, a belt with two short white sword hilts hanging at the hips.',
  },
  oldben: {
    soft: true,
    height: 1.82,
    prompt:
      'An old desert hermit monk with short white hair and a short white beard, layered cream and beige wrapped tunics, a long open brown robe over them, a belt with a silver cylindrical hilt hanging at the hip.',
  },
  greedo: {
    height: 1.73,
    prompt:
      'A green-skinned reptilian alien bounty hunter, large black glossy eyes, a short snout with small tendrils, a row of small spines on top of the bald head, a sleeveless olive vest over a dark tan jumpsuit, boots.',
  },
  gamorrean: {
    height: 1.8,
    prompt:
      'A huge bulky pig-faced green alien guard, a heavy warty green body with a big belly, small tusks and two small horns, a leather and fur loincloth and a leather chest harness, bare green arms, heavy boots.',
  },
  bobafett: {
    height: 1.83,
    prompt:
      'An armoured bounty hunter in a dented olive-green full-face helmet with a T-shaped black visor and a small rangefinder stalk on one side, a grey flight suit, olive-green chest armour, a big dull red armour plate on the right shoulder (and plain olive-green forearm gauntlets), a small jetpack on the back, a ragged brown cape over one shoulder.',
  },
  bith: {
    height: 1.8,
    prompt:
      'A tall thin alien jazz musician with an enormous oversized bulbous bald domed pinkish-tan head, much bigger than a human head, big glossy black eyes, no nose, heavy fleshy folds of wrinkled skin hanging at the cheeks and jaw, long thin fingers, wearing a black high-collared suit.',
  },
};
const POLY = 16000;
const TEX = 1024;

const key = process.env.MESHY_API_KEY;
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// wait for a task to finish; returns the task
async function wait(path, id, label) {
  for (let i = 0; ; i++) {
    const t = await api('GET', `${path}/${id}`);
    if (t.status === 'SUCCEEDED') return t;
    if (t.status === 'FAILED' || t.status === 'CANCELED' || t.status === 'EXPIRED') throw new Error(`${label}: ${t.status} ${t.task_error?.message ?? ''}`);
    if (i % 6 === 0) console.log(`  ${label}: ${t.status} ${t.progress ?? 0}%`);
    await sleep(5000);
  }
}

async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await r.arrayBuffer()));
}

const load = async () => (existsSync(TASKS) ? JSON.parse(await readFile(TASKS, 'utf8')) : {});
const save = (s) => writeFile(TASKS, `${JSON.stringify(s, null, 2)}\n`);

let io = null;
async function getIO() {
  if (!io) {
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  }
  return io;
}

// For the web: no clips (the figure borrows Rick's), stood on y = 0 at the
// middle, the still one scaled to its height, textures to WebP at TEX
// pixels, geometry meshopt-compressed. Returns the triangles and size.
async function squeeze(from, to, a) {
  const io = await getIO();
  const doc = await io.read(from);
  const root = doc.getRoot();
  for (const anim of root.listAnimations()) anim.dispose();
  // a skinned figure stands as the rig left it, `height` tall on y = 0 (its
  // bounds here would be the unskinned mesh's); the still one is sized and
  // stood here, by its height
  let size = null;
  if (a.still) {
    const scene = root.getDefaultScene() ?? root.listScenes()[0];
    const b = getBounds(scene);
    const k = a.height / (b.max[1] - b.min[1]);
    size = b.max.map((v, i) => (v - b.min[i]) * k);
    const holder = doc.createNode('crew').setScale([k, k, k]).setTranslation([-((b.min[0] + b.max[0]) / 2) * k, -b.min[1] * k, -((b.min[2] + b.max[2]) / 2) * k]);
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      holder.addChild(child);
    }
    scene.addChild(holder);
  }
  await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX] }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  let tris = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  await mkdir(dirname(to), { recursive: true });
  await io.write(to, doc);
  const bones = root.listNodes().filter((n) => n.getName() === 'Hips').length;
  return { tris, size, bones };
}

// the named ones that are made from a prompt, or from a Sketchfab model
const made = (names) => names.filter((n) => !ASSETS[n].uid);
const fromSketchfab = (names) => names.filter((n) => ASSETS[n].uid);

const steps = {
  async images(names, s) {
    for (const n of made(names)) {
      s[n] ??= {};
      if (!s[n].image) {
        const a = ASSETS[n];
        const { result } = await api('POST', '/v1/text-to-image', { ai_model: 'nano-banana-pro', prompt: `${a.prompt} ${a.still ? CREATURE : `${a.soft ? SOFT : LOOK} ${POSE}`}`, ...(a.still ? {} : { pose_mode: 'a-pose' }) });
        s[n].image = result;
        await save(s);
      }
      const t = await wait('/v1/text-to-image', s[n].image, `${n} image`);
      await download(t.image_urls[0], join(REVIEW, `${n}.png`));
      console.log(`image    ${n.padEnd(10)} ${t.consumed_credits} credits`);
    }
  },
  async models(names, s) {
    // all asked for first, then waited on (they take minutes each)
    names = made(names);
    for (const n of names) {
      if (!s[n]?.image) throw new Error(`${n}: no image yet`);
      if (!s[n].model) {
        const a = ASSETS[n];
        const { result } = await api('POST', '/v1/image-to-3d', {
          input_task_id: s[n].image,
          ai_model: 'latest',
          should_texture: true,
          enable_pbr: false,
          should_remesh: true,
          topology: 'triangle',
          target_polycount: POLY,
          texture_resolution: '2k',
          ...(a.still ? {} : { pose_mode: 'a-pose' }),
          target_formats: ['glb'],
          enable_thumbnail: true,
        });
        s[n].model = result;
        await save(s);
      }
    }
    const failed = [];
    for (const n of names) {
      let t;
      try {
        t = await wait('/v1/image-to-3d', s[n].model, `${n} model`);
      } catch (e) {
        // (turned down, most likely: delete its entry and remake the image)
        console.log(`model    ${n.padEnd(10)} ${e.message}`);
        failed.push(n);
        continue;
      }
      for (const [side, url] of Object.entries(t.thumbnail_urls ?? { front: t.thumbnail_url })) await download(url, join(REVIEW, `${n}-${side}.png`));
      console.log(`model    ${n.padEnd(10)} ${t.consumed_credits} credits`);
    }
    if (failed.length) console.log(`failed   ${failed.join(', ')}`);
  },
  async rig(names, s) {
    for (const n of made(names).filter((n) => !ASSETS[n].still)) {
      if (!s[n]?.model) throw new Error(`${n}: no model yet`);
      if (!s[n].rig) {
        const { result } = await api('POST', '/v1/rigging', { input_task_id: s[n].model, height_meters: ASSETS[n].height });
        s[n].rig = result;
        await save(s);
      }
      const t = await wait('/v1/rigging', s[n].rig, `${n} rig`);
      console.log(`rig      ${n.padEnd(10)} ${t.consumed_credits} credits`);
    }
  },
  // a Sketchfab model made ready for Meshy's rigger: upright, +z, on y = 0
  async bake(names) {
    for (const n of fromSketchfab(names)) {
      const token = process.env.SKETCHFAB_API_TOKEN;
      if (!token) throw new Error('Set SKETCHFAB_API_TOKEN in the environment.');
      const raw = join(REVIEW, 'in', `${n}-sketchfab.glb`);
      if (!existsSync(raw)) {
        const info = await fetch(`https://api.sketchfab.com/v3/models/${ASSETS[n].uid}/download`, { headers: { Authorization: `Token ${token}` } });
        if (!info.ok) throw new Error(`${n}: sketchfab download ${info.status}`);
        await download((await info.json()).glb.url, raw);
      }
      const io = await getIO();
      const doc = await io.read(raw);
      // (Sketchfab's own -90 degree turn about x, and any others, into the vertices)
      await doc.transform(flatten());
      for (const node of doc.getRoot().listNodes()) {
        const mesh = node.getMesh();
        if (!mesh) continue;
        transformMesh(mesh, node.getWorldMatrix());
        node.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      }
      await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [TEX, TEX], quality: 92 }));
      const b = getBounds(doc.getRoot().listScenes()[0]);
      const out = join(REVIEW, 'in', `${n}.glb`);
      await mkdir(dirname(out), { recursive: true });
      await io.write(out, doc);
      console.log(`bake     ${n.padEnd(10)} ${((await stat(out)).size / 1e6).toFixed(2)} MB, ${(b.max[1] - b.min[1]).toFixed(3)} m tall, x ${b.min[0].toFixed(2)}…${b.max[0].toFixed(2)}, z ${b.min[2].toFixed(2)}…${b.max[2].toFixed(2)}`);
    }
  },
  async rigurl(names, s) {
    for (const n of fromSketchfab(names)) {
      s[n] ??= {};
      if (!s[n].rig) {
        const file = join(REVIEW, 'in', `${n}.glb`);
        if (!existsSync(file)) throw new Error(`${n}: bake it first`);
        const { balance } = await api('GET', '/v1/balance');
        if (balance < 5) throw new Error(`${n}: only ${balance} credits`);
        const model_url = `data:application/octet-stream;base64,${(await readFile(file)).toString('base64')}`;
        const { result } = await api('POST', '/v1/rigging', { model_url, height_meters: ASSETS[n].height });
        s[n].rig = result;
        s[n].source = `sketchfab:${ASSETS[n].uid}`;
        await save(s);
      }
      const t = await wait('/v1/rigging', s[n].rig, `${n} rig`);
      console.log(`rigurl   ${n.padEnd(10)} ${t.consumed_credits} credits`);
    }
  },
  async fetch(names, s) {
    const tmp = join(REVIEW, 'raw');
    for (const n of names) {
      const a = ASSETS[n];
      let url;
      if (a.still) {
        if (!s[n]?.model) throw new Error(`${n}: no model yet`);
        url = (await api('GET', `/v1/image-to-3d/${s[n].model}`)).model_urls.glb;
      } else {
        if (!s[n]?.rig) throw new Error(`${n}: not rigged yet`);
        url = (await api('GET', `/v1/rigging/${s[n].rig}`)).result.rigged_character_glb_url;
      }
      const raw = join(tmp, `${n}.glb`);
      const out = join(OUT, `${n}.glb`);
      await download(url, raw);
      const { tris, size, bones } = await squeeze(raw, out, a);
      if (!a.still && !bones) throw new Error(`${n}: no Hips bone`);
      const mb = (await stat(out)).size / 1e6;
      console.log(`fetch    ${n.padEnd(10)} ${mb.toFixed(2)} MB, ${tris} triangles, ${size ? `${size.map((v) => v.toFixed(2)).join(' × ')} m` : `${a.height} m, rigged`}`);
    }
    await rm(tmp, { recursive: true, force: true });
  },
};

async function main() {
  if (!key) throw new Error('Set MESHY_API_KEY in the environment.');
  const [step, ...only] = process.argv.slice(2);
  if (!steps[step]) throw new Error(`step: ${Object.keys(steps).join(' | ')}`);
  const names = only.length ? only : Object.keys(ASSETS);
  for (const n of names) if (!ASSETS[n]) throw new Error(`unknown asset ${n}`);
  const s = await load();
  await steps[step](names, s);
  const { balance } = await api('GET', '/v1/balance');
  console.log(`balance  ${balance} credits left`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
