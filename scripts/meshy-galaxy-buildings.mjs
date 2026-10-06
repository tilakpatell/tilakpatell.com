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
// WebPs at `tex`, meshopt-compressed, into
// public/models/galaxy/surface/<kind>.glb, with a light copy beside it when
// it's big enough (scripts/galaxy-surface-lod.mjs).
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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'models', 'galaxy', 'surface');
const REVIEW = process.env.MESHY_REVIEW ?? join(ROOT, 'lab', 'meshy', 'buildings');
const TASKS = join(ROOT, 'scripts', 'meshy-galaxy-buildings-tasks.json');
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
  // Tatooine: the crime lord's palace (115 m): the owner's own model, textured here
  palace: {
    from: 'citadel',
    style: 'A desert fortress palace of weathered sun-bleached sandstone and tan adobe: sand-scoured rounded walls with faint horizontal bands, a great domed main keep, a tall cylindrical watchtower with a domed cap, dark recessed doorways and slit windows, dusty and sand-drifted at its base, rough desert rock around it. Realistic, film-set quality.',
    metres: 115,
    along: 'w',
    tris: 45000,
    tex: 2048,
  },
};

const key = process.env.MESHY_API_KEY;
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const holder = doc.createNode(a.kind).setScale([k, k, k]).setTranslation([-((b.min[0] + b.max[0]) / 2) * k, -b.min[1] * k, -((b.min[2] + b.max[2]) / 2) * k]);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    holder.addChild(child);
  }
  scene.addChild(holder);
  let count = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) count += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  if (count > a.tris) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: a.tris / count, error: 0.001 }));
  await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [a.tex, a.tex] }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  let tris = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  await mkdir(dirname(to), { recursive: true });
  await io.write(to, doc);
  return { tris, size: size.map((v) => +(v * k).toFixed(1)) };
}

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
    for (const n of pictured(names)) {
      s[n] ??= {};
      const raw = await pictures(n);
      s[n].lift ??= [];
      for (const [i, buf] of raw.entries()) {
        if (!s[n].lift[i]) {
          const what = BUILDINGS[n].lift ?? 'the main building';
          const { result } = await api('POST', '/v1/image-to-image', { ai_model: 'nano-banana', prompt: `Lift ${what} out of this picture. ${LIFT} ${SHOT}`, reference_image_urls: [dataUri(buf)] });
          s[n].lift[i] = result;
          await save(s);
        }
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
        const { result } = await api('POST', '/v1/text-to-image', { ai_model: 'nano-banana-2', prompt: `${BUILDINGS[n].prompt} ${LOOK} ${SHOT}` });
        s[n].image = result;
        await save(s);
      }
      const t = await wait('/v1/text-to-image', s[n].image, `${n} image`);
      await download(t.image_urls[0], join(REVIEW, `${n}.png`));
      console.log(`image    ${n.padEnd(13)} ${t.consumed_credits} credits`);
    }
  },
  async models(names, s) {
    names = [...prompted(names), ...pictured(names)];
    const { balance } = await api('GET', '/v1/balance');
    const todo = names.filter((n) => !s[n]?.model);
    console.log(`models: ${todo.length} to make (${todo.length * 30} credits), balance ${balance}`);
    if (todo.length * 30 > balance) throw new Error('not enough credits');
    for (const n of names) {
      if (BUILDINGS[n].prompt && !s[n]?.image) throw new Error(`${n}: no image yet`);
      if (!s[n].model) {
        const from = BUILDINGS[n].prompt ? null : await inputs(n);
        const multi = from && from.length > 1;
        const { result } = await api('POST', multi ? '/v1/multi-image-to-3d' : '/v1/image-to-3d', {
          ...(from ? (multi ? { image_urls: from } : { image_url: from[0] }) : { input_task_id: s[n].image }),
          ai_model: 'latest',
          should_texture: true,
          enable_pbr: true,
          should_remesh: true,
          topology: 'triangle',
          target_polycount: BUILDINGS[n].tris,
          texture_resolution: '2k',
          target_formats: ['glb'],
          enable_thumbnail: true,
        });
        s[n].model = result;
        s[n].multi = multi || undefined;
        await save(s);
      }
    }
    for (const n of names) {
      try {
        const t = await wait(s[n].multi ? '/v1/multi-image-to-3d' : '/v1/image-to-3d', s[n].model, `${n} model`);
        if (t.thumbnail_url) await download(t.thumbnail_url, join(REVIEW, `${n}-model.png`));
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
  async fetch(names, s) {
    for (const n of names) {
      const a = { ...BUILDINGS[n], kind: n };
      const [path, id] = a.from ? ['/v1/retexture', s[n]?.retexture] : [s[n]?.multi ? '/v1/multi-image-to-3d' : '/v1/image-to-3d', s[n]?.model];
      if (!id) throw new Error(`${n}: nothing made yet`);
      const t = await wait(path, id, `${n}`);
      const raw = join(REVIEW, 'raw', `${n}.glb`);
      if (!existsSync(raw)) await download(t.model_urls.glb, raw);
      const to = join(OUT, `${n}.glb`);
      const { tris, size } = await squeeze(raw, to, a);
      console.log(`fetch    ${n.padEnd(13)} ${tris} triangles, ${size.join(' × ')} m, ${Math.round((await stat(to)).size / 1024)} KB`);
      const lod = await makeLod(to, join(OUT, `${n}.lod1.glb`));
      if (lod && !lod.skipped) console.log(`         ${''.padEnd(13)} LOD ${lod.low} triangles, ${Math.round(lod.bytes / 1024)} KB (lod: true)`);
    }
  },
  // the picture, the lift and the model, side by side, for judging
  async sheet(names) {
    const { shoot } = await import('./glb-shot.mjs');
    for (const n of names) {
      const tiles = [];
      const tile = (buf) => sharp(buf).resize(640, 480, { fit: 'contain', background: '#202020' }).jpeg().toBuffer();
      if (BUILDINGS[n].ref) for (const buf of await pictures(n)) tiles.push(await tile(buf));
      for (const f of [`${n}-lift.png`, `${n}.png`]) if (existsSync(join(REVIEW, f))) tiles.push(await tile(await readFile(join(REVIEW, f))));
      for (const view of await shoot(join(OUT, `${n}.glb`), ['three', 'close'])) tiles.push(await tile(view));
      const cols = Math.min(3, tiles.length);
      const out = join(REVIEW, `${n}-gate.jpg`);
      await sharp({ create: { width: 640 * cols, height: 480 * Math.ceil(tiles.length / cols), channels: 3, background: '#111' } })
        .composite(tiles.map((input, i) => ({ input, left: (i % cols) * 640, top: Math.floor(i / cols) * 480 })))
        .jpeg({ quality: 85 })
        .toFile(out);
      console.log(`sheet    ${n.padEnd(13)} ${out}`);
    }
  },
};

async function main() {
  const [step, ...only] = process.argv.slice(2);
  if (!steps[step]) throw new Error(`steps: ${Object.keys(steps).join(', ')}`);
  if (!key && step !== 'fetch' && step !== 'sheet') throw new Error('MESHY_API_KEY is not set');
  const names = only.length ? only : Object.keys(BUILDINGS);
  for (const n of names) if (!BUILDINGS[n]) throw new Error(`no building ${n}`);
  await steps[step](names, await load());
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
