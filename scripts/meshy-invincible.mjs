// Makes the Invincible page's hero with Meshy (meshy.ai), the site owner's
// account: a concept image, then a textured model from the image, then
// Meshy's humanoid skeleton (which the game poses: flying, punching), then
// a new atlas (scripts/reatlas.mjs) and compression for the web into
// public/models/invincible/. The output is committed, so the site never
// calls Meshy. Omni-Man and Thragg were Sketchfab models (scripts/sketchfab-characters.mjs).
//
//   node --env-file=.env.local scripts/meshy-invincible.mjs <step> [name …]
//
// Steps, in order: images (3 credits each), models (30: meshy-7.1, about 30 k
// triangles, a 4K texture), rig (5), anims (3 a clip, 10 a clip made from
// words), fetch (free). Each task's id is kept in
// scripts/meshy-invincible-tasks.json, so running a step again never pays
// twice; delete a name's entry there to make it again. MESHY_API_KEY comes
// from .env.local (git ignores it); it is never printed.
//
// Meshy turns down named characters, so he is described, not named.
//
// The figures move with motion-captured clips from Meshy's library (`CLIPS`,
// by kind of figure) and two made from words with its text to motion
// (`MOTIONS`: hovering and flying, which the library has none of); `fetch`
// puts them all in the figure's file under the game's names for them, held
// in place (the game moves the figure), and lib/three/rig plays them.
//
// A figure with a `ref` is made from the show's own character art instead of
// a generated concept image: `refs` downloads it from the Invincible wiki
// (amazon-invincible.fandom.com) into lab/meshy/invincible/ref/, which git
// ignores, so the studio's pictures are never committed; `models` sends it
// to Meshy's image-to-3D. Only the models Meshy makes from it are shipped.

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'models', 'invincible');
const REVIEW = join(ROOT, 'lab', 'meshy', 'invincible'); // concept images and thumbnails, for looking at (not shipped)
const TASKS = join(ROOT, 'scripts', 'meshy-invincible-tasks.json');
const CREDITS = join(OUT, 'credits.json');
const API = 'https://api.meshy.ai/openapi';
const REFS = join(REVIEW, 'ref');
const WIKI = 'https://amazon-invincible.fandom.com/api.php';

// In the look of the Sketchfab figures beside him (Omni-Man and Thragg are
// game models: clean painted textures, believable proportions).
const PERSON = 'A high-detail 3D video game character in the look of a modern adult animated superhero series: believable athletic proportions, clean painted textures, crisp readable shapes. Full body, front view, standing straight in an A-pose with the arms held a little away from the body, feet slightly apart. Plain neutral grey background, no text, no logo, no shadow.';

// the cast's one look, for everything made from words (spec section 8)
const STYLE = 'in the style of a modern American animated superhero series: clean cel shading, flat bold colours, strong simple shapes, matte surfaces, no photorealism; full body, A-pose, plain grey background';
const THING = 'in the style of a modern American animated superhero series: clean cel shading, flat bold colours, strong simple shapes, matte surfaces, no photorealism; the whole object in frame, plain grey background, no text';

// The clips each kind of figure moves with: [the game's name, Meshy's
// library action_id] (GET /v1/animations/library), at most ten a kind.
export const CLIPS = {
  hero: [['idle', 0], ['walk', 30], ['run', 16], ['punch', 210], ['hit', 178], ['land', 506], ['wave', 28], ['cheer', 403]],
  person: [['idle', 0], ['walk', 30], ['talk', 313], ['wave', 28], ['phone', 312], ['run', 14], ['cheer', 298], ['look', 333]],
  brute: [['idle', 0], ['walk', 30], ['charge', 512], ['swing', 198], ['throw', 239], ['hit', 178], ['down', 187], ['stomp', 255]],
  caster: [['idle', 0], ['quake', 127], ['blast', 125], ['hit', 178], ['down', 187], ['talk', 311]],
  // (a foot soldier the game hovers and aims itself: only what it can't pose, 9 credits)
  trooper: [['idle', 0], ['hit', 178], ['down', 187]],
};
// Clips made from words (text to motion, 10 credits each), for the figures
// that fly; one is made once an account and put on each of them.
export const MOTIONS = {
  hover: 'A superhero hovering in mid-air, feet off the ground: legs relaxed and slightly bent, one knee a little higher, arms loose at the sides, a slow gentle bob up and down and a small turn of the head, calm and confident.',
  fly: 'A superhero flying forward through the air, body stretched out horizontally: right fist punched straight ahead of the head, left arm held back along the side, legs straight and together trailing behind, a slight steady sway.',
};

export const ASSETS = {
  mark: {
    out: 'mark.glb',
    as: 'Invincible',
    height: 1.78,
    tex: 2048,
    ref: 'Invincible_(Mark_Grayson).png',
    clips: 'hero', motions: ['hover', 'fly'],
    prompt:
      'A fit, athletic young man of about eighteen in a skin-tight superhero suit. A bright yellow cowl covers his head and the upper half of his face, with his short spiky black hair sticking up out of the top of it, and two large oval white goggle lenses over his eyes; his mouth and chin are bare. On his chest and stomach, a bright yellow panel shaped like a long downward-pointing shield, framed by a sky-blue yoke over both shoulders. The rest of the suit (arms, sides and legs) is very dark navy, almost black. Bright yellow gloves to the middle of the forearm, and sky-blue boots to just below the knee.',
  },
  omni: { out: 'omni-man.glb', as: 'Omni-Man', clips: 'hero', motions: ['hover', 'fly'], height: 1.95, tex: 2048, ref: 'Omni-ManProfile.png' },
  // (a texture prompt overrides the picture's own colours: on meshy-7.1 it
  // turned his robe, fur and skin white, so neither he nor Cecil has one.
  // Made from the picture alone his costume still came out pale: `restyle`
  // paints the model again with the picture as its style, and as Meshy
  // makes his skin light whatever it is given, `skin` paints it his colour)
  thragg: { out: 'thragg.glb', as: 'Thragg', clips: 'hero', motions: ['hover', 'fly'], height: 2.05, tex: 2048, ref: 'GrandRegentThragg-render.png', restyle: true, skin: [112, 68, 58] },
  eve: { out: 'eve.glb', as: 'Atom Eve', clips: 'hero', motions: ['hover', 'fly'], height: 1.7, tex: 2048, ref: 'Atom-EveProfile.png' },
  cecil: { out: 'cecil.glb', as: 'Cecil Stedman', clips: 'person', height: 1.8, tex: 2048, ref: 'CecilProfile.png' },
  debbie: { out: 'debbie.glb', as: 'Debbie Grayson', clips: 'person', height: 1.68, tex: 2048, ref: 'DebbieProfile.png' },
  allen: { out: 'allen.glb', as: 'Allen the Alien', clips: 'person', motions: ['hover'], height: 2.3, tex: 2048, ref: 'Allen.png' },
  // the wiki's picture is the twins side by side: the left half is one
  mauler: { out: 'mauler.glb', as: 'a Mauler twin', clips: 'brute', height: 2.6, tex: 2048, ref: 'MaulerTwin-render.png', crop: 'left' },
  seismic: { out: 'seismic.glb', as: 'Doc Seismic', clips: 'caster', motions: ['hover'], height: 1.8, tex: 2048, ref: 'DocSeismic-render.png' },
  // the crowd, which the wiki has no art for: from words, in the show's
  // style; at 12 k triangles, as a dozen of them can be in sight at once
  civA: { out: 'civ-a.glb', as: 'a townsman', tris: 12000, clips: 'person', height: 1.75, tex: 2048, prompt: 'An ordinary man in his thirties with short brown hair and light brown skin, wearing a mustard-yellow zip jacket over a white t-shirt, dark blue jeans and white trainers.' },
  civB: { out: 'civ-b.glb', as: 'a townswoman', tris: 12000, clips: 'person', height: 1.66, tex: 2048, prompt: 'An ordinary young woman in her twenties with a black ponytail and warm brown skin, wearing a teal hoodie, grey cargo trousers and red trainers, a small backpack.' },
  civC: { out: 'civ-c.glb', as: 'an older townsman', tris: 12000, clips: 'person', height: 1.72, tex: 2048, prompt: 'An ordinary older man in his sixties with grey hair, a grey beard and pale skin, wearing a brown cardigan over a light blue shirt, beige chinos and brown shoes.' },
  // the Flaxans, as the show has them: from words (the wiki's pictures are crowds, none in an A-pose),
  // on Meshy's lighter model (15 credits), the last of account 3's (2026-10-22); the elite is it tinted
  flaxan: { out: 'flaxan.glb', as: 'a Flaxan soldier', model: 'meshy-6-lite', textureRes: '2k', tris: 10000, clips: 'trooper', height: 1.7, tex: 2048, prompt: 'A slim alien soldier with pale green skin and a long smooth hairless head, two short pale green horn spikes rising from each side of the crown, small dark eyes, a thin mouth. White rounded plated armour over the chest, the shoulders, the forearms and the shins, round disc plates on the chest, a teal-blue bodysuit under it, white boots and gloves, no weapon.' },
  // props, unrigged
  bank: { out: 'bank.glb', as: 'the bank', tex: 1024, rig: false, prompt: 'The front of a small city bank: a two-storey pale stone facade, four columns, wide steps up to big glass doors, a sign panel above the doors with no lettering. Seen from the front at a slight angle.' },
  heli: { out: 'heli.glb', as: 'the news helicopter', tex: 1024, rig: false, prompt: 'A small white and red news helicopter with a camera pod under its nose, skids, a two-blade main rotor and a tail rotor. Seen from the side at a slight angle.' },
  truck: { out: 'truck.glb', as: 'the getaway truck', tex: 1024, rig: false, prompt: 'A boxy dark green armoured cash-transport truck with a windowless cargo box, rear double doors and black wheels. Seen from the front at a three-quarter angle.' },
};

// Three Meshy accounts: MESHY_API_KEY, MESHY_API_KEY_ACC_2 and _ACC_3. A task can only
// be read with the account that made it, so each name's entry keeps its
// `acct` (none means 1); new tasks go to MESHY_ACCOUNT (default 1).
const KEYS = { 1: process.env.MESHY_API_KEY, 2: process.env.MESHY_API_KEY_ACC_2, 3: process.env.MESHY_API_KEY_ACC_3 };
const NEW = Number(process.env.MESHY_ACCOUNT ?? 1);
let key = KEYS[NEW];
const use = (entry) => {
  entry.acct ??= NEW;
  key = KEYS[entry.acct];
  if (!key) throw new Error(`no key for Meshy account ${entry.acct}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body) {
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
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
let sharp = null;

// The figure's skin, as Meshy paints it (light, a little orange, not much
// colour), painted `rgb` instead, its light and shade kept: the weight eases
// in at the edges of what counts as skin, so a border doesn't step.
async function paintSkin(doc, rgb) {
  const texture = doc.getRoot().listTextures()[0];
  const { data, info } = await sharp(texture.getImage()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const ease = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  for (let i = 0; i < data.length; i += 3) {
    const [r, g, b] = [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === 0 || max === min) continue;
    const sat = (max - min) / max;
    let hue = max === r ? ((g - b) / (max - min)) * 60 : max === g ? (2 + (b - r) / (max - min)) * 60 : (4 + (r - g) / (max - min)) * 60;
    if (hue < 0) hue += 360;
    // orange to red-orange, a little to a fair amount of colour, lit
    const near = hue <= 40 ? 1 - ease(hue, 32, 40) : hue >= 345 ? ease(hue, 345, 352) : 0;
    const w = near * ease(sat, 0.08, 0.14) * (1 - ease(sat, 0.48, 0.58)) * ease(max, 0.38, 0.5);
    if (w <= 0) continue;
    const k = max / 0.82; // (its shade: Meshy's skin is about 0.82 at its lightest)
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * (1 - w) + Math.min(255, rgb[c] * k) * w);
  }
  texture.setImage(await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer()).setMimeType('image/png');
}

const drop = (clip) => {
  for (const part of [...clip.listChannels(), ...clip.listSamplers()]) part.dispose();
  clip.dispose();
};

// A clip from another file of the same skeleton, onto this one's bones by name.
function addClip(doc, src, name) {
  const [from] = src.getRoot().listAnimations();
  if (!from) throw new Error(`${name}: no clip in its file`);
  const bones = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
  const buffer = doc.getRoot().listBuffers()[0];
  const copy = (acc) => doc.createAccessor().setType(acc.getType()).setArray(acc.getArray().slice()).setBuffer(buffer);
  const clip = doc.createAnimation(name);
  for (const ch of from.listChannels()) {
    const node = bones.get(ch.getTargetNode()?.getName());
    if (!node) continue;
    const s = ch.getSampler();
    const sampler = doc.createAnimationSampler().setInput(copy(s.getInput())).setOutput(copy(s.getOutput())).setInterpolation(s.getInterpolation());
    clip.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(ch.getTargetPath()).setSampler(sampler));
  }
}

// The hips kept over the spot they start on (the game moves the figure; a
// walk that carries itself off would slide out from under it), their height
// left to the clip, so a step still bobs. In the clips that leave the ground
// (`PINNED`: lying along a flight, a dive from on high) the hips stay where
// they stand, all three ways: the game puts the figure in the air itself.
const PINNED = new Set(['hover', 'fly', 'land']);
function inPlace(clip) {
  const pin = PINNED.has(clip.getName());
  for (const ch of clip.listChannels()) {
    const node = ch.getTargetNode();
    if (ch.getTargetPath() !== 'translation' || !/hips/i.test(node?.getName() ?? '')) continue;
    const out = ch.getSampler().getOutput();
    const v = out.getArray().slice();
    const rest = pin ? node.getTranslation() : [v[0], null, v[2]];
    for (let i = 0; i < v.length; i += 3) {
      v[i] = rest[0];
      if (pin) v[i + 1] = rest[1];
      v[i + 2] = rest[2];
    }
    out.setArray(v);
  }
}
// The skinned figure on its skeleton with its clips (`extra`: more files
// whose clips are added, each [file, name]), on a new atlas the size of the
// texture it ships with. `names` renames the base file's clips in order.
async function bake(from, to, a, { names = null, extra = [] } = {}) {
  // loaded here, so the paid steps run without the build's dependencies
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const { dedup, meshopt, prune, simplify, textureCompress, weld } = await import('@gltf-transform/functions');
  const { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } = await import('meshoptimizer');
  const { reatlas } = await import('./reatlas.mjs');
  sharp ??= (await import('sharp')).default;
  if (!io) {
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  }
  const doc = await io.read(from);
  const clips = doc.getRoot().listAnimations();
  if (names) {
    // the library's clips, in the order asked for; any other (the rig's own) goes
    clips.forEach((clip, i) => (i < names.length ? clip.setName(names[i]) : drop(clip)));
  } else for (const clip of clips) drop(clip);
  for (const [file, name] of extra) addClip(doc, await io.read(file), name);
  for (const clip of doc.getRoot().listAnimations()) inPlace(clip);
  if (a.skin) await paintSkin(doc, a.skin);
  await reatlas(doc, a.tex, { apart: true });
  // (down to its budget, when it has one: the crowd, many at a time)
  if (a.tris) {
    await MeshoptSimplifier.ready;
    const now = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
    if (now > a.tris) await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: a.tris / now, error: 0.01 }));
  }
  await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 90, resize: [a.tex, a.tex] }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  await mkdir(dirname(to), { recursive: true });
  await io.write(to, doc);
  const prims = doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives());
  return { tris: prims.reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0) };
}

const steps = {
  // the show's art from the wiki, scaled to at most 1,536 px tall (needs sharp)
  async refs(names) {
    sharp ??= (await import('sharp')).default;
    for (const n of names) {
      const a = ASSETS[n];
      if (!a.ref) continue;
      const q = await (await fetch(`${WIKI}?action=query&format=json&prop=imageinfo&iiprop=url&titles=File:${encodeURIComponent(a.ref)}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).json();
      const url = Object.values(q.query.pages)[0].imageinfo[0].url;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) throw new Error(`${n}: ${r.status}`);
      let img = sharp(Buffer.from(await r.arrayBuffer()));
      const { width, height } = await img.metadata();
      if (a.crop === 'left') img = sharp(await img.extract({ left: 0, top: 0, width: Math.floor(width / 2), height }).png().toBuffer());
      await mkdir(REFS, { recursive: true });
      await img.resize({ height: 1536, withoutEnlargement: true }).png().toFile(join(REFS, `${n}.png`));
      console.log(`ref      ${n.padEnd(8)} ${a.ref}`);
    }
  },
  async images(names, s) {
    for (const n of names) {
      if (ASSETS[n].ref) continue;
      s[n] ??= {};
      use(s[n]);
      if (!s[n].image) {
        const a = ASSETS[n];
        const figure = a.rig !== false;
        // Mark's prompt kept its own look (PERSON); the rest share STYLE
        const look = n === 'mark' ? PERSON : figure ? STYLE : THING;
        const { result } = await api('POST', '/v1/text-to-image', { ai_model: 'nano-banana', prompt: `${a.prompt} ${look}`, ...(figure && { pose_mode: 'a-pose' }), aspect_ratio: figure ? '3:4' : '4:3' });
        s[n].image = result;
        await save(s);
      }
      const t = await wait('/v1/text-to-image', s[n].image, `${n} image`);
      await download(t.image_urls[0], join(REVIEW, `${n}.png`));
      console.log(`image    ${n.padEnd(8)} ${t.consumed_credits ?? '?'} credits`);
    }
  },
  async models(names, s) {
    for (const n of names) {
      const ref = ASSETS[n].ref && join(REFS, `${n}.png`);
      if (ref && !existsSync(ref)) throw new Error(`${n}: run refs first`);
      if (!ref && !s[n]?.image) throw new Error(`${n}: no image yet`);
      s[n] ??= {};
      use(s[n]);
      if (!s[n].model) {
        const from = ref ? { image_url: `data:image/png;base64,${(await readFile(ref)).toString('base64')}` } : { input_task_id: s[n].image };
        const { result } = await api('POST', '/v1/image-to-3d', {
          ...from,
          ai_model: ASSETS[n].model ?? 'meshy-7.1',
          should_texture: true,
          enable_pbr: false,
          should_remesh: true,
          topology: 'triangle',
          target_polycount: ASSETS[n].tris ?? (ASSETS[n].rig === false ? 15000 : 30000),
          // (painted at 4K and atlased again at the size it ships at: more paint to each texel; a lighter model paints 2K)
          texture_resolution: ASSETS[n].textureRes ?? (ASSETS[n].rig === false ? '2k' : '4k'),
          ...(ASSETS[n].texture && { texture_prompt: ASSETS[n].texture }),
          ...(ASSETS[n].rig !== false && { pose_mode: 'a-pose' }),
          target_formats: ['glb'],
          enable_thumbnail: true,
        });
        s[n].model = result;
        await save(s);
      }
      const t = await wait('/v1/image-to-3d', s[n].model, `${n} model`);
      for (const [side, url] of Object.entries(t.thumbnail_urls ?? { front: t.thumbnail_url })) if (url) await download(url, join(REVIEW, `${n}-${side}.png`));
      console.log(`model    ${n.padEnd(8)} ${t.consumed_credits ?? '?'} credits`);
    }
  },
  // the model painted again with its picture as the style (4K; 10 credits)
  async retexture(names, s) {
    for (const n of names) {
      const a = ASSETS[n];
      if (!a.restyle) continue;
      if (!s[n]?.model) throw new Error(`${n}: no model yet`);
      use(s[n]);
      if (!s[n].retex) {
        const img = `data:image/png;base64,${(await readFile(join(REFS, `${n}.png`))).toString('base64')}`;
        s[n].retex = (await api('POST', '/v1/retexture', { input_task_id: s[n].model, image_style_url: img, texture_resolution: '4k', target_formats: ['glb'] })).result;
        await save(s);
      }
      const t = await wait('/v1/retexture', s[n].retex, `${n} retexture`);
      if (t.thumbnail_url) await download(t.thumbnail_url, join(REVIEW, `${n}-restyled.png`));
      console.log(`restyle  ${n.padEnd(8)} ${t.consumed_credits ?? '?'} credits`);
    }
  },
  async rig(names, s) {
    for (const n of names) {
      if (ASSETS[n].rig === false) continue;
      if (!s[n]?.model) throw new Error(`${n}: no model yet`);
      use(s[n]);
      if (!s[n].rig) {
        const { result } = await api('POST', '/v1/rigging', { input_task_id: s[n].retex ?? s[n].model, height_meters: ASSETS[n].height });
        s[n].rig = result;
        await save(s);
      }
      const t = await wait('/v1/rigging', s[n].rig, `${n} rig`);
      console.log(`rig      ${n.padEnd(8)} ${t.consumed_credits ?? '?'} credits`);
    }
  },
  async anims(names, s) {
    for (const n of names) {
      const a = ASSETS[n];
      if (a.rig === false || !a.clips) continue;
      if (!s[n]?.rig) throw new Error(`${n}: not rigged yet`);
      use(s[n]);
      s[n].anims ??= {};
      if (!s[n].anims.lib) {
        s[n].anims.lib = (await api('POST', '/v1/animations', { rig_task_id: s[n].rig, action_ids: CLIPS[a.clips].map(([, id]) => id) })).result;
        await save(s);
      }
      for (const m of a.motions ?? []) {
        if (s[n].anims[m]) continue;
        // the clip made from words: once an account, while Meshy keeps it (three days)
        const made = (s._motions ??= {})[s[n].acct]?.[m];
        if (!made || made.expires < Date.now() + 3600e3) {
          const id = (await api('POST', '/v1/text-to-motion', { prompt: MOTIONS[m], duration: 4, mode: 'prime' })).result;
          const done = await wait('/v1/text-to-motion', id, `${m} motion`);
          (s._motions[s[n].acct] ??= {})[m] = { id, expires: done.expires_at };
          console.log(`motion   ${m.padEnd(8)} ${done.consumed_credits ?? '?'} credits`);
          await save(s);
        }
        s[n].anims[m] = (await api('POST', '/v1/animations', { rig_task_id: s[n].rig, motion_task_id: s._motions[s[n].acct][m].id })).result;
        await save(s);
      }
      for (const [clip, id] of Object.entries(s[n].anims)) {
        const done = await wait('/v1/animations', id, `${n} ${clip}`);
        console.log(`anims    ${n.padEnd(8)} ${clip.padEnd(6)} ${done.consumed_credits ?? '?'} credits`);
      }
    }
  },
  async fetch(names, s) {
    // as Meshy made them, kept by task (so compressing again needs no download)
    const tmp = join(ROOT, 'node_modules', '.cache', 'meshy');
    const credits = existsSync(CREDITS) ? JSON.parse(await readFile(CREDITS, 'utf8')) : {};
    for (const n of names) {
      const a = ASSETS[n];
      const prop = a.rig === false;
      const task = prop ? s[n]?.model : s[n]?.rig;
      if (!task) throw new Error(`${n}: not ${prop ? 'modelled' : 'rigged'} yet`);
      use(s[n]);
      // the figure with its library clips when it has them, else as rigged
      const lib = s[n].anims?.lib;
      const raw = join(tmp, `${lib ?? task}-${n}.glb`);
      if (!existsSync(raw)) {
        const t = await api('GET', lib ? `/v1/animations/${lib}` : prop ? `/v1/image-to-3d/${task}` : `/v1/rigging/${task}`);
        await download(lib ? t.result.animation_glb_url : prop ? t.model_urls.glb : t.result.rigged_character_glb_url, raw);
      }
      const extra = [];
      for (const m of a.motions ?? []) {
        const id = s[n].anims?.[m];
        if (!id) continue;
        const file = join(tmp, `${id}-${n}-${m}.glb`);
        if (!existsSync(file)) await download((await api('GET', `/v1/animations/${id}`)).result.animation_glb_url, file);
        extra.push([file, m]);
      }
      const { tris } = await bake(raw, join(OUT, a.out), a, { names: lib ? CLIPS[a.clips].map(([name]) => name) : null, extra });
      const from = a.ref ? ` from the show’s character art on the Invincible wiki (${a.ref})` : '';
      credits[n] = { source: 'https://www.meshy.ai', id: s[n].model, name: `${a.as}, generated for this site with Meshy AI${from}`, authors: ['Tilak Patel, with Meshy AI'], license: 'Meshy paid-plan output, owned by the site owner' };
      console.log(`fetch    ${n.padEnd(8)} ${a.out}, ${tris} triangles`);
    }
    await mkdir(OUT, { recursive: true });
    await writeFile(CREDITS, `${JSON.stringify(credits, null, 2)}\n`);
  },
};

async function main() {
  if (!KEYS[NEW]) throw new Error('Set MESHY_API_KEY in .env.local and run with node --env-file=.env.local.');
  const [step, ...only] = process.argv.slice(2);
  if (!steps[step]) throw new Error(`step: ${Object.keys(steps).join(' | ')}`);
  const names = only.length ? only : Object.keys(ASSETS);
  for (const n of names) if (!ASSETS[n]) throw new Error(`unknown asset ${n}`);
  const s = await load();
  await steps[step](names, s);
  key = KEYS[NEW];
  const { balance } = await api('GET', '/v1/balance');
  console.log(`balance  ${balance} credits left on account ${NEW}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
