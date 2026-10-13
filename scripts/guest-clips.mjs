// A guest's clip pack: Star Wars Battlefront II (2017)'s own clips at the
// size of one of the site's own cast, once it stands on the game's skeleton
// (scripts/guest-rig.mjs). The clips are the game's packs' (scripts/
// bf2017-clips.mjs): the humanoid's everyone walks on, the pistol's stance
// (stance.p.*), and the own pack of the blaster hero the guest plays as
// (Rick as Han, Morty as Lando: scripts/guests.json's host), a later pack's
// clip over an earlier one's of the same name, as the loader lays them. Every
// turn is copied to the bit; the ten or so position channels are refit to the
// body (lib/guest-clips.mjs says how), for guests only: no file of the game's
// own figures or packs is written. No UAL or Meshy clip is taken (the
// owner's ruling of 2026-10-10 about this rig).
//
// The pack is whole: the body loads it alone (src/lib/three/walrus.js's
// packUrls(hero, { whole })), since the game's packs, made for its 1.77 m
// man, must not be laid over it. It carries the fitted skeleton's nodes, as
// a game pack carries the game's, and is written without meshopt's filters,
// which would round the turns again.
//
// A pack that is only in the asset bucket (src/data/galaxyAssets.json names
// its hash) is fetched once from the base the dev server uses
// (VITE_ASSET_BASE, or .env.bucketcheck.local's), checked against that hash
// and kept under lab/assets/packs/, which git ignores. Nothing else is
// asked of any network, and the same files in give the same bytes out.
//
//   node scripts/guest-clips.mjs <who> [--host <hero>] [--packs humanoid,stance-p,<host>]
//     [--body <id>] [--only <clip>,…] [--out public/models/guests]
//
//   who     a row of scripts/guests.json; the pack is <out>/clips-<who>.glb
//   body    the fitted body the clips are sized to (<out>/<id>.glb; the
//           row's first when left out). A body other than the first is
//           written its own pack, clips-<id>.glb: one whose limbs differ
//           from the first's by more than 2 % needs one
//
// It prints each clip, the game's name for it and its frames, and the pack.
//
//   packFile(name, { root, fetch }) → the pack's file, fetched if it must be
//   packGuest(who, { host, packs, body, only, out, bodies, files, log }) → { file, bytes, clips, aliases }
//     (bodies: where the fitted bodies are, out unless said; files: { pack: file } for a pack read from elsewhere)

import { Document, Logger } from '@gltf-transform/core';
import { meshopt, prune } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { hashOf } from './lib/asset-manifest.mjs';
import { bulkProbes, refit, soleProbes } from './lib/guest-clips.mjs';
import { io, readBody, readPack } from './lib/guest-file.mjs';
import { legRatio } from './lib/guest-skeleton.mjs';
import { OUT, guestRow } from './guest-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKS = 'models/galaxy/bf2017';

// the base the dev server asks the bucket by: the shell's, or the bucket check's own file
function assetBase(root) {
  if (process.env.VITE_ASSET_BASE) return process.env.VITE_ASSET_BASE;
  const file = join(root, '.env.bucketcheck.local');
  const line = existsSync(file) ? readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('VITE_ASSET_BASE=')) : null;
  return line ? line.slice('VITE_ASSET_BASE='.length).trim() : null;
}

export async function packFile(name, { root = ROOT, fetch = globalThis.fetch } = {}) {
  const path = `${PACKS}/clips-${name}.glb`;
  const local = join(root, 'public', path);
  // (the site's own copy wins, as it does in the page: scripts/assets-manifest.mjs)
  if (existsSync(local)) return local;
  const row = JSON.parse(readFileSync(join(root, 'src', 'data', 'galaxyAssets.json'), 'utf8'))[path];
  if (!row) throw new Error(`clips-${name}: not on disk and not in the asset bucket’s manifest`);
  const kept = join(root, 'lab', 'assets', 'packs', row.hash, `clips-${name}.glb`);
  if (existsSync(kept) && hashOf(readFileSync(kept)) === row.hash) return kept;
  const base = assetBase(root);
  if (!base) throw new Error(`clips-${name} is only in the asset bucket: set VITE_ASSET_BASE, or have .env.bucketcheck.local`);
  const res = await fetch(`${base.replace(/\/+$/, '')}/${row.hash}/${path}`);
  if (!res.ok) throw new Error(`clips-${name}: the bucket answered ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (hashOf(buf) !== row.hash) throw new Error(`clips-${name}: what the bucket sent is not the file the manifest names`);
  await mkdir(dirname(kept), { recursive: true });
  await writeFile(kept, buf);
  return kept;
}

export async function packGuest(who, { host = guestRow(who).host, packs = ['humanoid', 'stance-p', host], body = Object.keys(guestRow(who).bodies)[0], only = null, out = OUT, bodies = out, files = null, log = console.log } = {}) {
  const row = guestRow(who);
  const fitted = await readBody(join(bodies, `${body}.glb`));
  const probes = { guest: soleProbes(fitted.rows, fitted.surface), bulk: bulkProbes(fitted.rows, fitted.surface) };

  // the game's clips by name, a later pack's over an earlier one's, where the first of the name stood
  const clips = new Map();
  const aliases = {};
  let game = null;
  for (const name of packs) {
    const pack = await readPack(files?.[name] ?? (await packFile(name)));
    game ??= pack.rows;
    for (const clip of pack.clips) if (!only || only.includes(clip.name)) clips.set(clip.name, { clip, rows: pack.rows });
    Object.assign(aliases, pack.aliases);
  }
  for (const [name, to] of Object.entries(aliases)) if (!clips.has(to) || clips.has(name)) delete aliases[name];

  const doc = new Document().setLogger(new Logger(Logger.Verbosity.ERROR));
  const buffer = doc.createBuffer();
  const scene = doc.createScene(`clips-${who}`);
  const nodes = new Map();
  for (const r of fitted.rows) {
    const n = doc.createNode(r.name).setTranslation(r.translation).setRotation(r.rotation);
    nodes.set(r.name, n);
    if (r.parent == null) scene.addChild(n);
    else nodes.get(r.parent).addChild(n);
  }
  const made = [];
  for (const [name, { clip, rows }] of clips) {
    const fit = refit(clip, rows, fitted.rows, { grip: row.grip, probes: { game: soleProbes(rows), ...probes } });
    const anim = doc.createAnimation(name).setExtras(fit.extras);
    // (one input for every track on the same keys, as the game's packs have them)
    const inputs = new Map();
    const inputOf = (times) => {
      const key = `${times.length}:${times[times.length - 1]}`;
      if (!inputs.has(key)) inputs.set(key, doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer));
      return inputs.get(key);
    };
    for (const t of fit.tracks) {
      const node = nodes.get(t.node);
      if (!node) continue;
      const output = doc.createAccessor().setType(t.path === 'rotation' ? 'VEC4' : 'VEC3').setArray(t.values).setNormalized(Boolean(t.normalized)).setBuffer(buffer);
      const sampler = doc.createAnimationSampler().setInput(inputOf(t.times)).setOutput(output).setInterpolation('LINEAR');
      anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(t.path).setSampler(sampler));
    }
    const frames = fit.tracks.reduce((n, t) => Math.max(n, t.times.length), 0);
    made.push({ name, source: fit.extras.source ?? '', frames });
  }
  const legs = legRatio(game, fitted.rows);
  scene.setExtras({ pack: `guest-${who}`, aliases, guest: { who, body, host, from: packs, legs: +legs.toFixed(4), grip: row.grip } });
  doc.getRoot().setDefaultScene(scene);
  // (level medium: meshopt's lossless coding alone. Its filters, the game packs' level, would round a turn's shorts again)
  await doc.transform(prune({ keepLeaves: true, keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const first = Object.keys(row.bodies)[0];
  const file = join(out, `clips-${body === first ? who : body}.glb`);
  await mkdir(dirname(file), { recursive: true });
  await (await io()).write(file, doc);
  const bytes = (await stat(file)).size;
  for (const m of made) log(`${m.name.padEnd(22)} ${m.source.padEnd(50)} ${String(m.frames).padStart(4)} frames`);
  for (const [a, b] of Object.entries(aliases)) log(`${a.padEnd(22)} = ${b}`);
  log(`${relative(ROOT, file)}: ${made.length} clips from ${packs.join(', ')} at ${legs.toFixed(4)} of the game's legs, ${(bytes / 1024).toFixed(1)} KB`);
  return { file, bytes, clips: made, aliases };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const [who] = args._;
  if (!who) {
    console.error('usage: node scripts/guest-clips.mjs <who> [--host <hero>] [--packs humanoid,stance-p,<host>] [--body <id>] [--only a,b] [--out public/models/guests]');
    process.exit(1);
  }
  try {
    const host = typeof args.host === 'string' ? args.host : guestRow(who).host;
    await packGuest(who, {
      host,
      packs: typeof args.packs === 'string' ? args.packs.split(',') : ['humanoid', 'stance-p', host],
      ...(typeof args.body === 'string' ? { body: args.body } : {}),
      only: typeof args.only === 'string' ? args.only.split(',') : null,
      out: resolve(args.out ?? OUT),
    });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
