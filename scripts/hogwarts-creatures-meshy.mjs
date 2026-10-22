// Hogwarts’ creatures that aren’t people, made with Meshy from a written
// description: the dementors over the Black Lake and Mrs Norris (the
// design’s §4.10). Neither is on the cast’s skeleton: a dementor drifts
// and its rags stir (world/grounds/dementorFigure.js moves the mesh on the
// node renderer), the cat sits and stares. So each is one static model:
// text-to-3D’s preview (the shape), its refine (the texture), then the web
// cut every model on the site gets (scripts/gen3d/web.mjs’s webReady:
// simplified to a budget, WebP textures, meshopt), stood on its base at
// y 0, centred, at its height in metres, into public/models/hogwarts/creatures/,
// and credited in public/games/credits.json.
//
//   node --env-file=.env.local scripts/hogwarts-creatures-meshy.mjs <step> NAME…
//   steps: preview, refine, fetch, all, balance
//
// The three accounts’ keys (Lane B’s, scripts/hogwarts-cast-meshy.mjs’s
// ACCOUNTS; never printed): a creature’s first task goes on the first
// account that can pay for both its tasks, and its refine on that one too
// (a task is only read by the account that made it). Task ids are kept in
// scripts/hogwarts-creatures-meshy-tasks.json, so a step run again never
// pays twice; delete a name’s entry to make it again.
//
//   CREATURES: { name: { height, prompt, texture, tris, tex } }
//   COST: { preview, refine } credits; accountFor(entry, balances) → the account, or null
//   fit(box, height) → { scale, offset: [x, y, z] }: the transform that stands a model on its base at y 0, centred, `height` tall
//   creditFor(name) → its row in credits.json
//   marks({ positions, uvs, indices, lumAt, hollow }) → { black, dim }: the triangles whose
//     texture the cut repaints (the face text-to-3D sculpts in a hood the design keeps empty, and
//     the rags it bleaches pale), by height and brightness
//   paint(image, width, height, uvs, indices, tris, op): those triangles filled in the texture’s
//     RGBA, a pixel round them too, each pixel once

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCOUNTS } from './hogwarts-cast-meshy.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TASKS = join(ROOT, 'scripts', 'hogwarts-creatures-meshy-tasks.json');
export const OUT = join(ROOT, 'public', 'models', 'hogwarts', 'creatures');
const CACHE = join(ROOT, 'scripts', 'gen3d', 'cache', 'hogwarts', 'creatures');
const API = 'https://api.meshy.ai/openapi';
const MAX_BYTES = 1.6 * 1024 * 1024; // (a creature is one model, seen at a few metres: well under a figure’s)

// What each is: described by its look, never by a name from the books or the films
export const CREATURES = {
  dementor: {
    height: 2.9,
    prompt:
      'A tall floating hooded wraith in a tattered ragged black cloak, the deep hood empty and dark with no face inside it, two long thin grey scabbed hands with long fingers reaching forward out of wide sleeves, the hem of the cloak shredded into long trailing rags that hang below it, no feet, hovering upright, gaunt and menacing, slightly stylised like a collectible toy figure, full body',
    texture: 'black tattered cloth cloak worn thin and shredded at the hem, grey decayed scabbed skin only on the two hands, the opening of the hood completely black shadow inside, empty, no skull, no face, no eyes, no teeth',
    tris: 18000,
    tex: 1024,
    // (the shares of its height: above `head` a bright texel is the face in the hood, painted out;
    // below `rags` a bright one is a bleached rag, darkened to the cloak’s black)
    hollow: { head: 0.76, rags: 0.34, bright: 0.3 },
  },
  norris: {
    height: 0.32,
    prompt: 'A scrawny thin dust-grey cat sitting upright on its haunches, staring straight ahead with large pale lamp-like yellow eyes, bony shoulders, a thin tail curled round its feet, scruffy patchy fur, slightly stylised like a collectible toy figure, full body',
    texture: 'dusty grey patchy fur, pale glowing yellow eyes, pink nose',
    tris: 9000,
    tex: 1024,
  },
};

// (text-to-3D’s preview and refine, as Meshy charges them)
export const COST = { preview: 20, refine: 10 };

export function accountFor(entry, balances) {
  if (entry?.acc) return entry.acc;
  const need = COST.preview + COST.refine;
  return ACCOUNTS.find((a) => (balances[a] ?? 0) >= need) ?? null;
}

// a model stood on its base at y 0, centred over the origin, scaled to its height
export function fit(box, height) {
  const tall = box.max[1] - box.min[1];
  const scale = tall > 0 ? height / tall : 1;
  return { scale, offset: [-((box.min[0] + box.max[0]) / 2) * scale, -box.min[1] * scale, -((box.min[2] + box.max[2]) / 2) * scale] };
}

export function marks({ positions, uvs, indices, lumAt, hollow }) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 1; i < positions.length; i += 3) {
    lo = Math.min(lo, positions[i]);
    hi = Math.max(hi, positions[i]);
  }
  const tall = hi - lo || 1;
  const black = [];
  const dim = [];
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    const k = ((positions[a * 3 + 1] + positions[b * 3 + 1] + positions[c * 3 + 1]) / 3 - lo) / tall;
    if (k < hollow.head && k > hollow.rags) continue;
    // (bright at its middle or at any corner: a triangle half on the face is the face)
    const at = [a, b, c].map((v) => lumAt(uvs[v * 2], uvs[v * 2 + 1]));
    at.push(lumAt((uvs[a * 2] + uvs[b * 2] + uvs[c * 2]) / 3, (uvs[a * 2 + 1] + uvs[b * 2 + 1] + uvs[c * 2 + 1]) / 3));
    if (Math.max(...at) <= hollow.bright) continue;
    (k >= hollow.head ? black : dim).push(t / 3);
  }
  return { black, dim };
}

// each pixel a triangle covers (and those a pixel off its edges) marked once, then `op` run on it
export function paint(image, width, height, uvs, indices, tris, op) {
  const marked = new Uint8Array(width * height);
  const PAD = 1.5; // px past the edges, so the seam’s blend never shows the old colour
  for (const tri of tris) {
    const v = [0, 1, 2].map((k) => indices[tri * 3 + k]);
    const p = v.map((i) => [uvs[i * 2] * width, uvs[i * 2 + 1] * height]);
    const x0 = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]) - PAD));
    const x1 = Math.min(width - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0]) + PAD));
    const y0 = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]) - PAD));
    const y1 = Math.min(height - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1]) + PAD));
    // (signed distance to each edge, in pixels, positive inside for either winding)
    const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
    const sign = area < 0 ? -1 : 1;
    const edge = (a, b, x, y) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return (sign * ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]))) / len;
    };
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const cx = x + 0.5;
        const cy = y + 0.5;
        if (edge(p[0], p[1], cx, cy) >= -PAD && edge(p[1], p[2], cx, cy) >= -PAD && edge(p[2], p[0], cx, cy) >= -PAD) marked[y * width + x] = 1;
      }
  }
  let n = 0;
  for (let i = 0; i < marked.length; i++) {
    if (!marked[i]) continue;
    op(image, i * 4);
    n++;
  }
  return n;
}

// the face painted out and the rags darkened, in the base colour texture itself
async function hollowOut(doc, hollow) {
  const { default: sharp } = await import('sharp');
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const tex = prim.getMaterial()?.getBaseColorTexture() ?? doc.getRoot().listTextures()[0];
  const { data, info } = await sharp(tex.getImage()).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const lumAt = (u, v) => {
    const x = Math.min(info.width - 1, Math.max(0, Math.floor(u * info.width)));
    const y = Math.min(info.height - 1, Math.max(0, Math.floor(v * info.height)));
    const i = (y * info.width + x) * 4;
    return (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  };
  const uvs = prim.getAttribute('TEXCOORD_0').getArray();
  const indices = prim.getIndices().getArray();
  const { black, dim } = marks({ positions: prim.getAttribute('POSITION').getArray(), uvs, indices, lumAt, hollow });
  const blacked = paint(data, info.width, info.height, uvs, indices, black, (d, i) => {
    d[i] = 5;
    d[i + 1] = 5;
    d[i + 2] = 7;
  });
  // (the rags keep their weave, at the cloak’s darkness)
  const dimmed = paint(data, info.width, info.height, uvs, indices, dim, (d, i) => {
    d[i] = Math.round(d[i] * 0.22 + 4);
    d[i + 1] = Math.round(d[i + 1] * 0.22 + 4);
    d[i + 2] = Math.round(d[i + 2] * 0.24 + 6);
  });
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .removeAlpha()
    .png()
    .toBuffer();
  tex.setImage(new Uint8Array(png)).setMimeType('image/png');
  console.log(`hollow: ${black.length} triangles of face painted out (${blacked} px), ${dim.length} of rag darkened (${dimmed} px)`);
}

export const creditFor = (name) => ({
  source: 'https://www.meshy.ai',
  name: `${name === 'norris' ? 'Mrs Norris, the caretaker’s cat' : 'A dementor'} for the Hogwarts world, made with Meshy AI from a written description of its look (scripts/hogwarts-creatures-meshy.mjs)`,
  authors: ['Tilak Patel, with Meshy AI'],
  license: 'Meshy paid-plan output, owned by the site owner',
});

const headers = (acc) => ({ Authorization: `Bearer ${process.env[acc]}`, 'Content-Type': 'application/json' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(acc, method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers: headers(acc), body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
async function wait(acc, id, label) {
  for (let i = 0; ; i++) {
    const t = await api(acc, 'GET', `/v2/text-to-3d/${id}`);
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
const load = () => (existsSync(TASKS) ? JSON.parse(readFileSync(TASKS, 'utf8')) : {});
const save = (s) => writeFileSync(TASKS, `${JSON.stringify(s, null, 2)}\n`);
const balances = async () => Object.fromEntries(await Promise.all(ACCOUNTS.filter((a) => process.env[a]).map(async (a) => [a, (await api(a, 'GET', '/v1/balance')).balance])));

// the bounds of every position in the scene, through the node transforms
async function boundsOf(doc) {
  const { getBounds } = await import('@gltf-transform/core');
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  return getBounds(scene);
}

const steps = {
  async preview(name, s) {
    const c = CREATURES[name];
    s[name] ??= {};
    if (!s[name].preview) {
      const acc = accountFor(s[name], await balances());
      if (!acc) throw new Error(`${name}: no account has ${COST.preview + COST.refine} credits`);
      s[name].acc = acc;
      s[name].preview = (await api(acc, 'POST', '/v2/text-to-3d', { mode: 'preview', prompt: c.prompt, art_style: 'realistic', ai_model: 'latest', topology: 'triangle', target_polycount: 30000, should_remesh: true, symmetry_mode: 'auto' })).result;
      save(s);
    }
    const t = await wait(s[name].acc, s[name].preview, `${name} preview`);
    const file = join(CACHE, name, 'preview.glb');
    if (!existsSync(file)) await download(t.model_urls.glb, file);
    if (t.thumbnail_url && !existsSync(join(CACHE, name, 'preview.png'))) await download(t.thumbnail_url, join(CACHE, name, 'preview.png'));
    console.log(`preview  ${name}: ${file}`);
  },
  async refine(name, s) {
    if (!s[name]?.preview) throw new Error(`${name}: no preview yet`);
    if (!s[name].refine) {
      s[name].refine = (await api(s[name].acc, 'POST', '/v2/text-to-3d', { mode: 'refine', preview_task_id: s[name].preview, enable_pbr: false, texture_prompt: CREATURES[name].texture, ai_model: 'latest' })).result;
      save(s);
    }
    const t = await wait(s[name].acc, s[name].refine, `${name} refine`);
    const file = join(CACHE, name, 'refined.glb');
    if (!existsSync(file)) await download(t.model_urls.glb, file);
    if (t.thumbnail_url && !existsSync(join(CACHE, name, 'refined.png'))) await download(t.thumbnail_url, join(CACHE, name, 'refined.png'));
    console.log(`refine   ${name}: ${file}`);
  },
  // the web cut: stood up, centred, to its height, simplified, WebP, meshopt; and its credit
  async fetch(name) {
    const c = CREATURES[name];
    const raw = join(CACHE, name, 'refined.glb');
    if (!existsSync(raw)) throw new Error(`${name}: not refined yet`);
    const { io, webReady } = await import('./gen3d/web.mjs');
    const n = await io();
    const doc = await n.read(raw);
    for (const a of doc.getRoot().listAnimations()) a.dispose();
    if (c.hollow) await hollowOut(doc, c.hollow);
    const { scale, offset } = fit(await boundsOf(doc), c.height);
    // (one node over the scene’s roots carries the stand: the cut keeps its transform)
    const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
    const stand = doc.createNode(name).setScale([scale, scale, scale]).setTranslation(offset);
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      stand.addChild(child);
    }
    scene.addChild(stand);
    const { after } = await webReady(doc, { tris: c.tris, tex: c.tex });
    if (after > c.tris * 1.15) throw new Error(`${name}.glb has ${Math.round(after)} triangles, over its ${c.tris}`);
    mkdirSync(OUT, { recursive: true });
    const file = join(OUT, `${name}.glb`);
    await n.write(file, doc);
    const bytes = statSync(file).size;
    if (bytes > MAX_BYTES) throw new Error(`${name}.glb is ${(bytes / 1048576).toFixed(2)} MB, over ${(MAX_BYTES / 1048576).toFixed(1)} MB`);
    const creditsFile = join(ROOT, 'public', 'games', 'credits.json');
    const credits = JSON.parse(readFileSync(creditsFile, 'utf8'));
    credits[`hogwarts/creatures/${name}`] = creditFor(name);
    writeFileSync(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
    console.log(`fetch    ${name}: ${Math.round(after)} triangles, ${(bytes / 1024).toFixed(0)} KB → ${file}`);
  },
};
steps.all = async (name, s) => {
  for (const st of ['preview', 'refine', 'fetch']) await steps[st](name, s);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [step, ...names] = process.argv.slice(2);
  // (the cut is made from what’s on disk: only the other steps talk to Meshy)
  if (step !== 'fetch' && !ACCOUNTS.some((a) => process.env[a])) throw new Error('no Meshy key: run with node --env-file=.env.local');
  if (step === 'balance') {
    for (const [a, b] of Object.entries(await balances())) console.log(`${a.replace('MESHY_API_KEY', 'account').replace('_ACC_', ' ')}: ${b} credits`);
    process.exit(0);
  }
  if (!steps[step]) throw new Error(`step: ${[...Object.keys(steps), 'balance'].join(' | ')}`);
  for (const n of names) if (!CREATURES[n]) throw new Error(`no creature ${n}`);
  const s = load();
  for (const n of names) await steps[step](n, s);
}
