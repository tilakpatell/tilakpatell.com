// The galaxy's worlds' buildings, made with Meshy (meshy.ai, the site owner's
// account) where nothing on Sketchfab is right (galaxy/surface/catalog/made.js
// puts them in place of the ones built in code, the same kind in the same
// places). Three ways in, by what an entry has:
//   ref     a real picture of the thing (a film still, a production
//           painting, a game render: a Wookieepedia file, fetched by
//           scripts/galaxy-refs.mjs into lab/refs/, never committed), the
//           thing lifted out of it onto a plain background (image to image),
//           then a textured model from that (image to 3D; from two or more
//           pictures, multi-image to 3D)
//   prompt  a concept image from words, then a model from it (how Theed's
//           halls were made; the owner turned the other concepts down)
//   from    one of the owner's own models (lab/uploads/glb/<from>.glb),
//           retextured from a `style` prompt
// Each is stood on y = 0 in the middle, set to its size in metres, its maps
// WebPs at `tex` (with `split`, only the colour and glow maps: the normal,
// occlusion and metal-rough ones at half that, as scripts/meshy-war.mjs
// does, since they carry less a viewer sees and were most of a file),
// meshopt-compressed, into public/models/galaxy/surface/<kind>.glb (or
// public/<out>), with a light copy beside it when it's big enough
// (scripts/galaxy-surface-lod.mjs). Two more fields choose what is paid for:
// `lifter`, the image model that lifts a picture (nano-banana unless said,
// 3 credits; nano-banana-pro, 9, keeps fine detail and paint better), and
// `texture`, the maps Meshy makes ('2k' unless said; '4k' costs the same 30
// credits and squeezes down sharper).
//
//   node scripts/meshy-galaxy-buildings.mjs <step> [kind …]
//
// Steps, in order: lift (3 credits: nano-banana, from the ref), images (6:
// nano-banana-2, from the prompt), models (30: image to 3D, 2K PBR
// textures), retexture (10), fetch (free: the result into the site), sheet
// (free: lab/meshy/buildings/<kind>-gate.jpg, the picture, the lift and the
// model side by side, for judging). Each task's id is kept in
// scripts/meshy-galaxy-buildings-tasks.json, so a step run again never pays
// twice (delete a kind's entry to make it again). MESHY_API_KEY comes from
// the environment and is never printed. Prompts never name the films (Meshy
// turns the names down; a refused task costs nothing).
//
// --ultra (models and fetch, scripts/ultra/cut.mjs): the ultra level's cut.
// `models --ultra` asks Meshy again from the same input at the cut's
// polygons, up to its most (300k), and its finest texture
// (MESHY_ULTRA_TEXTURE, 8k unless set: Meshy's top is 8k), kept as the
// kind's `ultra` task so the plain one is untouched; `fetch --ultra`
// makes <kind>.ultra.glb from it, up to four times the kind's tris with
// 8192 maps, under 24 MB, no light copy (ultra draws the whole model at
// every distance), and prints the catalogue's `ultra` line for it.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, getBounds, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REFS, fetchRef } from './galaxy-refs.mjs';
import { makeLod } from './galaxy-surface-lod.mjs';
import { recolorDoc } from './recolor.mjs';
import { MESHY_MAX_POLYCOUNT, checkUltra, mapsOf, takeUltra, ultraName, ultraSpec } from './ultra/cut.mjs';
import { BUILDINGS as BACK_LANE } from './meshy-galaxy-buildings-back.mjs';
import { BUILDINGS as FILL_LANE } from './meshy-galaxy-buildings-fill.mjs';
import { BUILDINGS as BASES_LANE } from './meshy-galaxy-buildings-bases.mjs';
import { BUILDINGS as THREE_LANE } from './meshy-galaxy-three.mjs';
import { BUILDINGS as LIBRARY_LANE } from './meshy-galaxy-library.mjs';
import { BUILDINGS as NEVARRO_LANE } from './meshy-galaxy-buildings-nevarro.mjs';
import { BUILDINGS as AUDIT_LANE } from './meshy-galaxy-audit.mjs';
import { BUILDINGS as ULTRA_LANE } from './meshy-galaxy-ultra.mjs';
import { BUILDINGS as WORLDS_LANE } from './meshy-galaxy-worlds.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'models', 'galaxy', 'surface');
const GALAXY = join(ROOT, 'public', 'models', 'galaxy');
const REVIEW = process.env.MESHY_REVIEW ?? join(ROOT, 'lab', 'meshy', 'buildings');
const TASKS = process.env.MESHY_TASKS ? join(ROOT, process.env.MESHY_TASKS) : join(ROOT, 'scripts', 'meshy-galaxy-buildings-tasks.json');
const API = 'https://api.meshy.ai/openapi';

const LOOK = 'Highly detailed realistic 3D game asset, weathered materials, film-set quality, physically based textures.';
const SHOT = 'The whole building in frame, three-quarter view from slightly above, isolated on a plain light grey background, no people, no vehicles, no text, no ground clutter.';
// lifting a thing out of a picture: the same design, nothing invented
const LIFT = 'Keep its exact design, shape, proportions, materials and colours as in the picture; invent nothing new. Render it as a clean realistic 3D game asset.';

// kind (the built one it stands in for) → where it comes from (`ref`: a
// Wookieepedia file or a list of them, `crop`: [x, y, w, h] of the first, as
// fractions, `lift`: what to lift out of it, e.g. 'the domed palace on the
// cliff'; or `prompt`; or `from` and `style`); metres: its size along
// `along` ('w' its width across x, 'h' its height); tris: triangles kept;
// tex: its maps' size on the site
export const BUILDINGS = {
  // Naboo: the halls of Theed (the built one's 35 m across)
  theed: {
    prompt: 'An elegant classical city hall of cream sandstone: tall arched colonnades on two storeys, carved balustrades, a large shallow dome of green-patinated copper on top with a small lantern, Renaissance and Italianate architecture with sleek futuristic curves.',
    metres: 35,
    along: 'w',
    tris: 30000,
    tex: 2048,
  },
  // Tatooine: the Lars homestead's domed hut over its courtyard (the built
  // one's 6 m dome and its doorway; the pit's ring stays built)
  homestead: {
    ref: 'File:YetAnotherTatooineSunset.jpg',
    crop: [0.15, 0.24, 0.73, 0.72],
    lift: 'the domed adobe hut with its arched doorway, and the machinery, pipes and crates against its walls, seen in plain midday daylight',
    // (baked from a sunset: brought to the plaster's daylight colour)
    recolor: [{ material: 'Material_0', to: '#938c86', amount: 1, band: [0.15, 1] }],
    metres: 9,
    along: 'w',
    tris: 20000,
    tex: 1024,
  },
  // Tatooine: the crime lord's palace (115 m): the owner's own model, textured here
  palace: {
    from: 'citadel',
    style: 'A desert fortress palace of weathered sun-bleached sandstone and tan adobe: sand-scoured rounded walls with faint horizontal bands, a great domed main keep, a tall cylindrical watchtower with a domed cap, dark recessed doorways and slit windows, dusty and sand-drifted at its base, rough desert rock around it. Realistic, film-set quality.',
    // (the film's rust and rosy-brown stone, not the retexture's orange)
    recolor: [{ material: '*', to: '#9d6b60', amount: 1 }],
    yaw: -Math.PI / 2,
    metres: 115,
    along: 'w',
    tris: 45000,
    tex: 2048,
  },
};

const key = process.env.MESHY_API_KEY;
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// the back lane's kinds, from their own file (scripts/meshy-galaxy-buildings-back.mjs)
Object.assign(BUILDINGS, BACK_LANE);
// and the filled worlds' (scripts/meshy-galaxy-buildings-fill.mjs)
Object.assign(BUILDINGS, FILL_LANE);
// and the bases' (Phase 2: scripts/meshy-galaxy-buildings-bases.mjs)
Object.assign(BUILDINGS, BASES_LANE);
// the three worlds' lane (scripts/meshy-galaxy-three.mjs)
Object.assign(BUILDINGS, THREE_LANE);
Object.assign(BUILDINGS, LIBRARY_LANE);
// and Nevarro's (scripts/meshy-galaxy-buildings-nevarro.mjs)
Object.assign(BUILDINGS, NEVARRO_LANE);
// and the audit's remakes (scripts/meshy-galaxy-audit.mjs): last, so a kind
// remade there takes over from its earlier lane's entry
Object.assign(BUILDINGS, AUDIT_LANE);
// and the new worlds' landmarks (scripts/meshy-galaxy-worlds.mjs)
Object.assign(BUILDINGS, WORLDS_LANE);
// and the ultra level's remakes (scripts/meshy-galaxy-ultra.mjs), last of all
Object.assign(BUILDINGS, ULTRA_LANE);

async function api(method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
async function wait(path, id, label) {
  for (let i = 0; ; i++) {
    const t = await api('GET', `${path}/${id}`);
    if (t.status === 'SUCCEEDED') return t;
    if (['FAILED', 'CANCELED', 'EXPIRED'].includes(t.status)) throw new Error(`${label}: ${t.status} ${t.task_error?.message ?? ''}`);
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
    await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  }
  return io;
}

// a model of the owner's, cut to what Meshy takes (a data: URI, a few MB):
// welded and simplified to `faces`, no compression
async function upload(from, faces) {
  const io = await getIO();
  const doc = await io.read(join(ROOT, 'lab', 'uploads', 'glb', `${from}.glb`));
  let count = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) count += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, faces / count), error: 0.002 }), prune());
  const bytes = await io.writeBinary(doc);
  return `data:application/octet-stream;base64,${Buffer.from(bytes).toString('base64')}`;
}

// For the web: flattened, stood on y = 0 in the middle, `metres` along its
// width or height, simplified to `tris`, maps to WebP at `tex`, meshopt.
async function squeeze(from, to, a) {
  const io = await getIO();
  const doc = await io.read(from);
  const root = doc.getRoot();
  for (const anim of root.listAnimations()) anim.dispose();
  await doc.transform(flatten(), weld());
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const b = getBounds(scene);
  const size = b.max.map((v, i) => v - b.min[i]);
  const k = a.metres / (a.along === 'h' ? size[1] : Math.max(size[0], size[2]));
  // (centred, stood on y = 0, scaled; then turned by `yaw` about its middle,
  // its front brought round to +z)
  // (`mirror`: flipped left for right, for one made the other way round from
  // the built one it stands over; three.js turns the faces round itself for
  // a node scaled through zero)
  const kx = a.mirror ? -k : k;
  const centre = doc.createNode(`${a.kind}-centred`).setScale([kx, k, k]).setTranslation([-((b.min[0] + b.max[0]) / 2) * kx, -b.min[1] * k, -((b.min[2] + b.max[2]) / 2) * k]);
  // (`turn`, a quaternion, in place of `yaw` for one that flies other than
  // as it was made: Slave I comes lying as it lands and flies stood on its tail)
  const yaw = a.yaw ?? 0;
  const holder = doc.createNode(a.kind).setRotation(a.turn ?? [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]).addChild(centre);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    centre.addChild(child);
  }
  scene.addChild(holder);
  const triangles = () => {
    let count = 0;
    for (const m of root.listMeshes()) for (const p of m.listPrimitives()) count += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
    return count;
  };
  // (the simplifier stops where its error bound is reached, short of the
  // ratio on a model full of thin parts: then it is asked again with a
  // looser bound, until the cut is under its budget. `error` is the first
  // bound, as a share of the model's size: at the 0.001 a building wants, a
  // ship's seam-split mesh stops a third short of its triangles)
  const first = a.error ?? 0.001;
  for (const error of [first, ...[0.005, 0.02, 0.1].filter((e) => e > first)]) {
    const count = triangles();
    if (count <= a.tris) break;
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: a.tris / count, error }));
  }
  await doc.transform(dedup(), prune());
  // (its colours to the films': a catalogue-style `recolor`, scripts/recolor.mjs)
  if (a.recolor) {
    await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'png', slots: /baseColor/, resize: [a.tex, a.tex] }));
    for (const r of await recolorDoc(doc, a.recolor)) console.log(`  recolor ${r.material}: ${r.from} → ${r.to}`);
  }
  // (`quality`: the colour map's WebP quality, for a ship whose budget a
  // sharp 2K map would break; and a `split` one's mesh is packed at
  // meshopt's high level, whose filters squeeze the normals and UVs of
  // Meshy's seam-split vertices, about a tenth of a file, where the
  // medium level leaves them as plain 16-bit numbers)
  const maps = a.split
    ? [
        textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /baseColor|emissive/, resize: [a.tex, a.tex], quality: a.quality ?? 84 }),
        textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /normal|occlusion|metallicRoughness/, resize: [a.tex / 2, a.tex / 2], quality: 80 }),
      ]
    : [textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [a.tex, a.tex] })];
  await doc.transform(...maps, meshopt({ encoder: MeshoptEncoder, level: a.split ? 'high' : 'medium' }));
  const tris = triangles();
  await mkdir(dirname(to), { recursive: true });
  await io.write(to, doc);
  return { tris, tex: await mapsOf(doc), size: size.map((v) => +(v * k).toFixed(1)) };
}

// where a kind's model goes on the site: `out` (under public/) if it says,
// else beside the galaxy's ships or its worlds' buildings
const fileOf = (n) => (BUILDINGS[n].out ? join(ROOT, 'public', BUILDINGS[n].out) : join(BUILDINGS[n].galaxy ? GALAXY : OUT, `${n}.glb`));
const prompted = (names) => names.filter((n) => BUILDINGS[n].prompt);
const owned = (names) => names.filter((n) => BUILDINGS[n].from);
const pictured = (names) => names.filter((n) => BUILDINGS[n].ref);
const refsOf = (n) => [BUILDINGS[n].ref].flat();
const dataUri = (buf, mime = 'image/jpeg') => `data:${mime};base64,${buf.toString('base64')}`;

// the kind's pictures (lab/refs/<kind>.jpg, <kind>-2.jpg, …: fetched once),
// the first one cropped to `crop`
async function pictures(n) {
  const out = [];
  for (const [i, title] of refsOf(n).entries()) {
    const file = join(REFS, `${n}${i ? `-${i + 1}` : ''}.jpg`);
    if (!existsSync(file)) {
      await mkdir(REFS, { recursive: true });
      await writeFile(file, await fetchRef(title));
    }
    let img = sharp(file);
    const crop = i === 0 ? BUILDINGS[n].crop : null;
    if (crop) {
      const { width, height } = await img.metadata();
      img = img.extract({ left: Math.round(crop[0] * width), top: Math.round(crop[1] * height), width: Math.round(crop[2] * width), height: Math.round(crop[3] * height) });
    }
    out.push(await img.resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer());
  }
  return out;
}
// what goes into image to 3D for a prompted kind: its concept picture
// (<kind>.png in the review folder, from the images step) as a data URI,
// so the model can be asked on another account than the one that drew it
// (a task is read back only with the key that made it); the task itself
// only where the picture isn't downloaded
async function concept(n, s) {
  const file = join(REVIEW, `${n}.png`);
  return existsSync(file) ? { image_url: dataUri(await readFile(file), 'image/png') } : { input_task_id: s[n].image };
}
// what goes into image to 3D for a pictured kind: each lifted picture (or
// the picture itself where it wasn't lifted)
async function inputs(n) {
  const raw = await pictures(n);
  return Promise.all(raw.map(async (buf, i) => {
    const lifted = join(REVIEW, `${n}-lift${i ? `-${i + 1}` : ''}.png`);
    return existsSync(lifted) ? dataUri(await readFile(lifted), 'image/png') : dataUri(buf);
  }));
}

const steps = {
  async lift(names, s) {
    // (every lift asked for first, then each waited for: Meshy makes them
    // side by side)
    for (const n of pictured(names)) {
      s[n] ??= {};
      const raw = await pictures(n);
      s[n].lift ??= [];
      for (const [i, buf] of raw.entries()) {
        if (!s[n].lift[i]) {
          const what = BUILDINGS[n].lift ?? 'the main building';
          const { result } = await api('POST', '/v1/image-to-image', { ai_model: BUILDINGS[n].lifter ?? 'nano-banana', prompt: `Lift ${what} out of this picture. ${LIFT} ${BUILDINGS[n].shot ?? SHOT}`, reference_image_urls: [dataUri(buf)] });
          s[n].lift[i] = result;
          await save(s);
        }
      }
    }
    for (const n of pictured(names)) {
      for (const i of s[n].lift.keys()) {
        const t = await wait('/v1/image-to-image', s[n].lift[i], `${n} lift ${i + 1}`);
        await download(t.image_urls[0], join(REVIEW, `${n}-lift${i ? `-${i + 1}` : ''}.png`));
        console.log(`lift     ${n.padEnd(13)} ${t.consumed_credits ?? '?'} credits`);
      }
    }
  },
  async images(names, s) {
    for (const n of prompted(names)) {
      s[n] ??= {};
      if (!s[n].image) {
        const { result } = await api('POST', '/v1/text-to-image', { ai_model: 'nano-banana-2', prompt: `${BUILDINGS[n].prompt} ${BUILDINGS[n].look ?? LOOK} ${BUILDINGS[n].shot ?? SHOT}` });
        s[n].image = result;
        await save(s);
      }
    }
    for (const n of prompted(names)) {
      const t = await wait('/v1/text-to-image', s[n].image, `${n} image`);
      await download(t.image_urls[0], join(REVIEW, `${n}.png`));
      console.log(`image    ${n.padEnd(13)} ${t.consumed_credits} credits`);
    }
  },
  async models(names, s, { ultra = false } = {}) {
    names = [...prompted(names), ...pictured(names)];
    // (the ultra task is kept apart from the plain one: `ultra`, `ultraMulti`)
    const [task, multiKey] = ultra ? ['ultra', 'ultraMulti'] : ['model', 'multi'];
    const { balance } = await api('GET', '/v1/balance');
    const todo = names.filter((n) => !s[n]?.[task]);
    console.log(`models: ${todo.length} to make (${todo.length * 30} credits), balance ${balance}`);
    if (todo.length * 30 > balance) throw new Error('not enough credits');
    for (const n of names) {
      if (BUILDINGS[n].prompt && !s[n]?.image) throw new Error(`${n}: no image yet`);
      // (a pictured kind that wasn't lifted has no entry yet)
      s[n] ??= {};
      if (!s[n][task]) {
        const from = BUILDINGS[n].prompt ? null : await inputs(n);
        const multi = from && from.length > 1;
        const { result } = await api('POST', multi ? '/v1/multi-image-to-3d' : '/v1/image-to-3d', {
          ...(from ? (multi ? { image_urls: from } : { image_url: from[0] }) : await concept(n, s)),
          ai_model: BUILDINGS[n].ai ?? 'latest', // (or an older model, `ai`, for one the latest turns down)
          should_texture: true,
          enable_pbr: true,
          // (`remesh: false` for one whose fine open framework is too dense
          // for Meshy's remesher, which turned the half-built station down
          // twice: its raw mesh comes back, and the squeeze simplifies it)
          should_remesh: BUILDINGS[n].remesh ?? true,
          topology: 'triangle',
          // (an ultra model at its cut's polygons, up to Meshy's most: a
          // 300k remesh can't be cut below about 90k without smearing,
          // its atlas being thousands of charts whose seams the simplifier
          // keeps, so a small kind's is remeshed at its budget by Meshy)
          target_polycount: ultra ? Math.min(MESHY_MAX_POLYCOUNT, ultraSpec(BUILDINGS[n]).tris) : BUILDINGS[n].tris,
          texture_resolution: ultra ? (process.env.MESHY_ULTRA_TEXTURE ?? '8k') : (BUILDINGS[n].texture ?? '2k'),
          target_formats: ['glb'],
          enable_thumbnail: true,
        });
        s[n][task] = result;
        s[n][multiKey] = multi || undefined;
        await save(s);
      }
    }
    for (const n of names) {
      try {
        const t = await wait(s[n][multiKey] ? '/v1/multi-image-to-3d' : '/v1/image-to-3d', s[n][task], `${n} model`);
        if (t.thumbnail_url) await download(t.thumbnail_url, join(REVIEW, `${n}-model${ultra ? '-ultra' : ''}.png`));
        console.log(`model    ${n.padEnd(13)} ${t.consumed_credits} credits`);
      } catch (e) {
        console.log(`model    ${n.padEnd(13)} ${e.message}`);
      }
    }
  },
  async retexture(names, s) {
    for (const n of owned(names)) {
      s[n] ??= {};
      if (!s[n].retexture) {
        const { result } = await api('POST', '/v1/retexture', { model_url: await upload(BUILDINGS[n].from, 150000), text_style_prompt: BUILDINGS[n].style, ai_model: 'latest', enable_pbr: true, enable_original_uv: false, target_formats: ['glb'] });
        s[n].retexture = result;
        await save(s);
      }
      const t = await wait('/v1/retexture', s[n].retexture, `${n} retexture`);
      if (t.thumbnail_url) await download(t.thumbnail_url, join(REVIEW, `${n}-model.png`));
      console.log(`retexture ${n.padEnd(12)} ${t.consumed_credits} credits`);
    }
  },
  async fetch(names, s, { ultra = false } = {}) {
    if (ultra) return fetchUltra(names, s);
    for (const n of names) {
      const a = { ...BUILDINGS[n], kind: n };
      const [path, id] = a.from ? ['/v1/retexture', s[n]?.retexture] : [s[n]?.multi ? '/v1/multi-image-to-3d' : '/v1/image-to-3d', s[n]?.model];
      if (!id) throw new Error(`${n}: nothing made yet`);
      const t = await wait(path, id, `${n}`);
      const raw = join(REVIEW, 'raw', `${n}.glb`);
      if (!existsSync(raw)) await download(t.model_urls.glb, raw);
      // (a ship of the galaxy's goes beside its others, its far-off copy made
      // by scripts/galaxy-lod.mjs)
      const to = fileOf(n);
      const { tris, size } = await squeeze(raw, to, a);
      console.log(`fetch    ${n.padEnd(13)} ${tris} triangles, ${size.join(' × ')} m, ${Math.round((await stat(to)).size / 1024)} KB`);
      const lod = a.galaxy ? null : await makeLod(to, join(OUT, `${n}.lod1.glb`));
      if (lod && !lod.skipped) console.log(`         ${''.padEnd(13)} LOD ${lod.low} triangles, ${Math.round(lod.bytes / 1024)} KB (lod: true)`);
    }
  },
  // the picture, the lift and the model, side by side, for judging
  async sheet(names, s, { ultra = false } = {}) {
    const { shoot } = await import('./glb-shot.mjs');
    for (const n of names) {
      const tiles = [];
      const tile = (buf) => sharp(buf).resize(640, 480, { fit: 'contain', background: '#202020' }).jpeg().toBuffer();
      if (BUILDINGS[n].ref) for (const buf of await pictures(n)) tiles.push(await tile(buf));
      for (const f of [`${n}-lift.png`, `${n}.png`]) if (existsSync(join(REVIEW, f))) tiles.push(await tile(await readFile(join(REVIEW, f))));
      // (with --ultra, the ultra cut's views beside the plain one's, where fetchUltra puts it)
      const files = ultra ? [fileOf(n), join(BUILDINGS[n].galaxy ? GALAXY : OUT, ultraName(n))] : [fileOf(n)];
      for (const file of files) for (const view of await shoot(file, ['three', 'close'])) tiles.push(await tile(view));
      const cols = Math.min(3, tiles.length);
      const out = join(REVIEW, `${n}-gate${ultra ? '-ultra' : ''}.jpg`);
      await sharp({ create: { width: 640 * cols, height: 480 * Math.ceil(tiles.length / cols), channels: 3, background: '#111' } })
        .composite(tiles.map((input, i) => ({ input, left: (i % cols) * 640, top: Math.floor(i / cols) * 480 })))
        .jpeg({ quality: 85 })
        .toFile(out);
      console.log(`sheet    ${n.padEnd(13)} ${out}`);
    }
  },
};

// the ultra cut of each kind, from its `ultra` task (models --ultra): beside
// the plain file, no light copy, and the catalogue line to add for it
async function fetchUltra(names, s) {
  for (const n of names) {
    const a = ultraSpec({ ...BUILDINGS[n], kind: n });
    if (a.from) throw new Error(`${n}: a retextured model of the owner's has no ultra task (its mesh is the owner's own)`);
    const id = s[n]?.ultra;
    if (!id) throw new Error(`${n}: no ultra model yet (models --ultra ${n})`);
    const t = await wait(s[n].ultraMulti ? '/v1/multi-image-to-3d' : '/v1/image-to-3d', id, `${n} ultra`);
    const raw = join(REVIEW, 'raw', ultraName(n));
    if (!existsSync(raw)) await download(t.model_urls.glb, raw);
    const to = join(a.galaxy ? GALAXY : OUT, ultraName(n));
    const { tris, tex, size } = await squeeze(raw, to, a);
    const bytes = (await stat(to)).size;
    const problems = checkUltra({ tris: a.tris, after: tris, bytes });
    if (problems.length) throw new Error(`${n} (ultra): ${problems.join('; ')}`);
    console.log(`fetch    ${n.padEnd(13)} ultra ${tris} triangles, ${tex} maps, ${size.join(' × ')} m, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
    // (the maps as they are in the file: Meshy's 8k where it gave them)
    console.log(`         ${''.padEnd(13)} catalogue: ultra: { tris: ${Math.round(tris)}, tex: ${tex} }`);
  }
}

async function main() {
  const { ultra, args } = takeUltra(process.argv.slice(2));
  const [step, ...only] = args;
  if (!steps[step]) throw new Error(`steps: ${Object.keys(steps).join(', ')}`);
  if (!key && step !== 'fetch' && step !== 'sheet') throw new Error('MESHY_API_KEY is not set');
  const names = only.length ? only : Object.keys(BUILDINGS);
  for (const n of names) if (!BUILDINGS[n]) throw new Error(`no building ${n}`);
  if (ultra && !['models', 'fetch', 'sheet'].includes(step)) throw new Error('--ultra goes with models, fetch or sheet');
  await steps[step](names, await load(), { ultra });
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
