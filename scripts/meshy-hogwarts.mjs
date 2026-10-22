// Hogwarts' hero models made with Meshy (meshy.ai, the site owner's
// accounts) beside the ones made on the desktop (scripts/gen3d), so each
// can be judged against the other on the same sheet and the better kept.
// The pictures are reference photographs, cut out onto white on this
// machine (the step scripts/gen3d/prepare.mjs leaves to the engine) and
// kept in scripts/gen3d/cache/ref/prep/, git-ignored: the
// Invincible rule, the pictures are never committed, only the models.
//
//   node --env-file=.env.local scripts/meshy-hogwarts.mjs <step> [name …]
//
// Steps: models (30 credits each: image to 3D, or multi-image to 3D from
// two to four pictures, or text to 3D for a model with a `prompt`), remesh (each of a model's `cuts`, lighter copies
// made by Meshy from the same task), fetch (free: the raw GLB to
// scripts/gen3d/cache/meshy/<name>.glb, cut for the site afterwards by
// scripts/gen3d/web.mjs, as the desktop's models are), balance. Each task's
// id and the account that made it are kept in
// scripts/meshy-hogwarts-tasks.json, so a step run again never pays twice
// (a task is read back only with the key that made it); delete a name's
// entry there to make it again. The key is the first of MESHY_API_KEY,
// MESHY_API_KEY_ACC_2 and MESHY_API_KEY_ACC_3 with the credits for the
// step; none is ever printed.

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PREP = join(ROOT, 'scripts', 'gen3d', 'cache', 'ref', 'prep');
const RAW = join(ROOT, 'scripts', 'gen3d', 'cache', 'meshy');
const TASKS = join(ROOT, 'scripts', 'meshy-hogwarts-tasks.json');
const API = 'https://api.meshy.ai/openapi';
const ACCOUNTS = ['MESHY_API_KEY', 'MESHY_API_KEY_ACC_2', 'MESHY_API_KEY_ACC_3'];
const COST = 30;

// name → pictures (in PREP, the front first), polygons, texture size
export const MODELS = {
  'castle-m1': { from: ['castle-sw.png'], poly: 300000, texture: '4k', cuts: [120000, 60000, 20000], as: 'the castle from across the lake' },
  boathouse: { from: ['boathouse.png'], poly: 60000, texture: '2k', cuts: [20000], as: 'the boathouse under the cliff' },
  station: { from: ['station.png'], poly: 60000, texture: '2k', cuts: [20000], as: 'Hogsmeade station' },
  'hagrid-hut': { from: ['hagrid-hut.png'], poly: 60000, texture: '2k', cuts: [20000], as: 'Hagrid’s hut' },
  willow: { from: ['willow.png'], poly: 100000, texture: '2k', cuts: [40000, 12000], as: 'the Whomping Willow' },
  // (from words: nothing to photograph; a preview, then its paint)
  stand: {
    prompt: 'a tall medieval wooden spectator tower beside a sports field: a square timber frame on four tall legs braced with crossed beams, wrapped from the ground to the top in long scarlet and gold striped canvas drapes, an open viewing box with a railing at the top under a steep pointed canvas roof with a pennant',
    poly: 40000,
    cuts: [12000],
    as: 'a Quidditch stand',
  },
};

const keyOf = (account) => process.env[account];
const headersOf = (account) => ({ Authorization: `Bearer ${keyOf(account)}`, 'Content-Type': 'application/json' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(account, method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers: headersOf(account), body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
async function wait(account, path, id, label) {
  for (let i = 0; ; i++) {
    const t = await api(account, 'GET', `${path}/${id}`);
    if (t.status === 'SUCCEEDED') return t;
    if (['FAILED', 'CANCELED', 'EXPIRED'].includes(t.status)) throw new Error(`${label}: ${t.status} ${t.task_error?.message ?? ''}`);
    if (i % 6 === 0) console.log(`  ${label}: ${t.status} ${t.progress ?? 0}%`);
    await sleep(10000);
  }
}
const load = async () => (existsSync(TASKS) ? JSON.parse(await readFile(TASKS, 'utf8')) : {});
const save = (s) => writeFile(TASKS, `${JSON.stringify(s, null, 2)}\n`);
const dataUri = async (file) => `data:image/png;base64,${(await readFile(file)).toString('base64')}`;

// the first account that can pay for `credits`
async function payer(credits) {
  for (const a of ACCOUNTS) {
    if (!keyOf(a)) continue;
    const { balance } = await api(a, 'GET', '/v1/balance');
    if (balance >= credits) return a;
  }
  throw new Error(`no account has ${credits} credits`);
}

// A model from words (text to 3D): its preview (the shape), then its refine
// (the paint), each kept in the task list as it is asked, so a run cut off
// between them picks up at the refine. 30 credits in all.
async function fromWords(n, m, s) {
  if (!s[`${n}:preview`]) {
    const account = await payer(COST);
    const { result } = await api(account, 'POST', '/v2/text-to-3d', { mode: 'preview', prompt: m.prompt, art_style: 'realistic', ai_model: 'latest', should_remesh: true, topology: 'triangle', target_polycount: m.poly });
    s[`${n}:preview`] = { task: result, account };
    await save(s);
    console.log(`${n}: preview asked (${account})`);
  }
  const { task, account } = s[`${n}:preview`];
  await wait(account, '/v2/text-to-3d', task, `${n} preview`);
  const { result } = await api(account, 'POST', '/v2/text-to-3d', { mode: 'refine', preview_task_id: task, enable_pbr: true });
  s[n] = { task: result, account, words: true };
  await save(s);
  console.log(`${n}: refine asked`);
}

const steps = {
  async balance() {
    for (const a of ACCOUNTS) if (keyOf(a)) console.log(`${a}: ${(await api(a, 'GET', '/v1/balance')).balance} credits`);
  },
  async models(names, s) {
    for (const n of names) {
      if (s[n]?.task) continue;
      const m = MODELS[n];
      if (m.prompt) {
        await fromWords(n, m, s);
        continue;
      }
      const files = m.from.map((f) => join(PREP, f));
      const missing = files.filter((f) => !existsSync(f));
      if (missing.length) {
        console.log(`${n}: no ${missing.join(', ')}`);
        continue;
      }
      const account = await payer(COST);
      const multi = files.length > 1;
      const images = await Promise.all(files.map(dataUri));
      const { result } = await api(account, 'POST', multi ? '/v1/multi-image-to-3d' : '/v1/image-to-3d', {
        ...(multi ? { image_urls: images } : { image_url: images[0] }),
        ai_model: 'latest',
        should_texture: true,
        enable_pbr: true,
        should_remesh: true,
        topology: 'triangle',
        target_polycount: m.poly,
        texture_resolution: m.texture,
        target_formats: ['glb'],
        enable_thumbnail: true,
      });
      s[n] = { task: result, account, multi: multi || undefined };
      await save(s);
      console.log(`${n}: asked (${account})`);
    }
  },
  // the lighter cuts by Meshy's own remesh, which keeps the model's paint: a
  // Blender bake of a Meshy castle came out patched (its rays found the
  // wrong walls), and the simplifier stops at the atlas's seams near 90k
  async remesh(names, s) {
    for (const n of names) {
      if (!s[n]?.task) continue;
      for (const poly of MODELS[n].cuts ?? []) {
        const key = `@${poly}`;
        if (s[n][key]) continue;
        const { result } = await api(s[n].account, 'POST', '/v1/remesh', { input_task_id: s[n].task, target_polycount: poly, topology: 'triangle', target_formats: ['glb'] });
        s[n][key] = result;
        await save(s);
        console.log(`${n}: remesh to ${poly} asked`);
      }
    }
    for (const n of names)
      for (const poly of MODELS[n].cuts ?? []) {
        const id = s[n]?.[`@${poly}`];
        const out = join(RAW, `${n}@${poly}.glb`);
        if (!id || existsSync(out)) continue;
        try {
          const t = await wait(s[n].account, '/v1/remesh', id, `${n}@${poly}`);
          const r = await fetch(t.model_urls.glb);
          await writeFile(out, Buffer.from(await r.arrayBuffer()));
          console.log(`${n}@${poly}: ${out} (${t.consumed_credits ?? '?'} credits)`);
        } catch (e) {
          console.log(`${n}@${poly}: ${e.message}`);
        }
      }
  },
  async fetch(names, s) {
    for (const n of names) {
      if (!s[n]?.task) continue;
      const out = join(RAW, `${n}.glb`);
      if (existsSync(out)) continue;
      try {
        const t = await wait(s[n].account, s[n].words ? '/v2/text-to-3d' : s[n].multi ? '/v1/multi-image-to-3d' : '/v1/image-to-3d', s[n].task, n);
        await mkdir(RAW, { recursive: true });
        const r = await fetch(t.model_urls.glb);
        if (!r.ok) throw new Error(`download ${r.status}`);
        await writeFile(out, Buffer.from(await r.arrayBuffer()));
        if (t.thumbnail_url) await writeFile(join(RAW, `${n}.png`), Buffer.from(await (await fetch(t.thumbnail_url)).arrayBuffer()));
        console.log(`${n}: ${out} (${t.consumed_credits ?? '?'} credits)`);
      } catch (e) {
        console.log(`${n}: ${e.message}`);
      }
    }
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [step, ...asked] = process.argv.slice(2);
  if (!steps[step]) throw new Error(`usage: meshy-hogwarts.mjs ${Object.keys(steps).join('|')} [name …]`);
  if (!ACCOUNTS.some(keyOf)) throw new Error('Set the Meshy keys in .env.local and run with node --env-file=.env.local.');
  const names = asked.length ? asked : Object.keys(MODELS);
  const bad = names.filter((n) => !MODELS[n]);
  if (bad.length) throw new Error(`no model ${bad.join(', ')}`);
  await steps[step](names, await load());
}
