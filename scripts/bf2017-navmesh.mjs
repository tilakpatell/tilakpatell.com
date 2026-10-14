// A level's navmesh.bin: the game's own NavPower polygons (the chunks its
// PathfindingBlobAssets name) and the level designers' hand links
// (BattleAIPathLinkEntityData), in the level pack's frame, in the format
// src/lib/battlefront/navmesh.js reads (and documents). bf2-re findings/57 has
// the blob's layout and the proofs; scripts/lib/navpower.mjs reads it.
//
//   node scripts/bf2017-navmesh.mjs [--root C:/Users/tilak/Downloads/BF2_Extract] [--level Levels/MP/Hoth_01]
//                                   [--pack public/models/galaxy/bf2017/levels/hoth] [--map hoth] [--check] [--dry]
//
//   root   the export: root/chunks/<BlobId>.bin are the blobs (bf2export <frosty> <game> <root> chunks
//          --filter <BlobId,…>, the tool's chunks mode), root/web/data/<level>/ the level's layers
//   pack   the level pack whose frame (level.json's origin and yaw) the mesh is written in
//   check  measure the mesh against the level: the spawns of map's rows, the terrain, the pack's
//          shapes (and its inside pack's), the hand links' ends, a path across the battlefield
//   dry    measure, write nothing
//
// Every blob a PathfindingStreamEntityData of the level streams goes in, named
// by when the game streams it (NAMES; the wiring is read from the level's own
// LevelData and printed).

import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { checksOf, meshOf, readNavPower } from './lib/navpower.mjs';
import { encodeNavmesh } from '../src/lib/battlefront/navmesh.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// the names of Hoth's four streams (their PathfindingStreamEntityData guids),
// from what turns each on (the wiring below prints it): first the one that
// covers the whole Galactic Assault battlefield, the mesh load() takes unless
// told otherwise
export const NAMES = {
  'beddec53-43a7-4398-bbaf-a411feb2eb7d': 'playthrough', // PlanetaryMissions ∧ Game.ScriptedPlaythrough
  '57872075-feb6-4bf9-941f-eb5aa0cc040f': 'coop', // Mode9, ModeDefend, ModeE, ModeF; enables Pathfinding_Links
  '1cb031b1-02d9-42b9-b742-35d8b055197b': 'skirmish', // SkirmishBlast, SkirmishOnslaught, SkirmishDuel
  '30cda2d1-e1ea-40ef-9c66-932796e2ac2a': 'coopLarge', // co-op ∧ the PvE spawn wave channel (layer 1)
};
const ORDER = ['playthrough', 'coop', 'skirmish', 'coopLarge'];
// the link layers, as the file's link sources (a bit each in a mesh's links mask)
const LINK_LAYERS = ['Pathfinding', 'Pathfinding_Links'];
const SOLDIER = 'AIPathfindingLayer_Soldier_Default';

// Frostbite's event and field names are djb2-xor hashes of the plain name
export const hashName = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
};
const EVENT = { OnTrue: hashName('OnTrue'), StreamIn: hashName('StreamIn'), OnStreamedIn: hashName('OnStreamedIn'), Enable: hashName('Enable') };

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

// every object of every layer of the level, by guid; the level's own LevelData
async function levelObjects(dir) {
  const byGuid = new Map();
  let level = null;
  for (const f of (await readdir(dir)).filter((n) => n.endsWith('.json'))) {
    let j;
    try {
      j = await readJson(join(dir, f));
    } catch {
      continue;
    }
    for (const o of j.objects ?? []) if (o.$guid) byGuid.set(o.$guid, { layer: f.replace(/\.json$/, ''), o, objects: j.objects });
    if (j.type === 'LevelData') level = j.objects[j.root ?? 0];
  }
  return { byGuid, level };
}

// what streams each blob in: the bool whose OnTrue fires its StreamIn, and the
// settings and nodes feeding that bool (two hops back), as plain words
export function wiringOf({ byGuid, level }) {
  const events = level?.EventConnections ?? [];
  const props = level?.PropertyConnections ?? [];
  const word = (guid) => {
    const r = byGuid.get(guid);
    if (!r) return guid;
    const o = r.o;
    if (o.Settings) return `${o.Setting ?? 'setting'} in [${o.Settings.join(', ')}]`;
    if (o.BoolSettingName) return o.BoolSettingName;
    if (o.Channel) return o.Channel.$asset;
    return o.$type.replace(/EntityData$/, '');
  };
  const feeders = (guid, depth) => {
    if (depth > 3) return [];
    const out = [];
    for (const c of props) {
      if (c.Target?.$class !== guid) continue;
      const src = c.Source?.$class;
      const kids = feeders(src, depth + 1);
      out.push(kids.length ? `${word(src)}(${kids.join(', ')})` : word(src));
    }
    return out;
  };
  const streams = [];
  for (const [guid, r] of byGuid) {
    if (r.o.$type !== 'PathfindingStreamEntityData') continue;
    const asset = r.o.PathfindingBlobs?.$asset;
    const on = events.filter((c) => c.Target?.$class === guid && c.TargetEvent?.Id >>> 0 === EVENT.StreamIn);
    const when = on.map((c) => `${word(c.Source.$class)}.${(c.SourceEvent.Id >>> 0) === EVENT.OnTrue ? 'OnTrue' : c.SourceEvent.Name} ← ${feeders(c.Source.$class, 0).join(' + ') || 'nothing'}`);
    const enables = events.filter((c) => c.Source?.$class === guid && (c.SourceEvent?.Id >>> 0) === EVENT.OnStreamedIn && (c.TargetEvent?.Id >>> 0) === EVENT.Enable);
    const enabledLayers = [...new Set(enables.map((c) => c.Target.$asset.split('/').pop()))];
    streams.push({ guid, asset, autoload: r.o.Autoload, when, enables: enables.length, enabledLayers });
  }
  return streams;
}

// the hand links: each BattleAIPathLinkEntityData's points through its
// transform, in the pack's frame
export function linksOf(layers, frame) {
  const links = [];
  const skipped = [];
  layers.forEach(({ name, json }, source) => {
    for (const o of json.objects ?? []) {
      if (o.$type !== 'BattleAIPathLinkEntityData') continue;
      const data = o.LinkData?.$ref !== undefined ? json.objects[o.LinkData.$ref] : null;
      const T = o.Transform;
      const world = (p) => [
        T.trans.x + T.right.x * p.x + T.up.x * p.y + T.forward.x * p.z,
        T.trans.y + T.right.y * p.x + T.up.y * p.y + T.forward.y * p.z,
        T.trans.z + T.right.z * p.x + T.up.z * p.y + T.forward.z * p.z,
      ];
      const rec = {
        points: o.Points.map((p) => frame(world(p))),
        game: o.Points.map(world),
        both: o.Direction === 'PathLinkDirection_Both',
        start: o.EnableOnInit === true,
        source,
        radius: data?.BaseData?.Radius ?? 1,
        snap: data?.MaxSnapDist ?? 0,
        layer: name,
        guid: o.$guid ?? null,
      };
      if (!(data?.AffectedLayers ?? []).includes(SOLDIER)) skipped.push(rec);
      else links.push(rec);
    }
  });
  return { links, skipped };
}

const frameOf = (pack) => {
  const [ox, oy, oz] = pack.origin ?? [0, 0, 0];
  const c = Math.cos(pack.yaw ?? 0);
  const s = Math.sin(pack.yaw ?? 0);
  return ([x, y, z]) => [(x - ox) * c + (z - oz) * s, y - oy, -(x - ox) * s + (z - oz) * c];
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = typeof args.root === 'string' ? args.root : 'C:/Users/tilak/Downloads/BF2_Extract';
  const levelName = typeof args.level === 'string' ? args.level : 'Levels/MP/Hoth_01';
  const packDir = join(ROOT, typeof args.pack === 'string' ? args.pack : 'public/models/galaxy/bf2017/levels/hoth');
  const levelDir = join(root, 'web/data', levelName);
  const pack = await readJson(join(packDir, 'level.json'));
  const frame = frameOf(pack);

  const objects = await levelObjects(levelDir);
  const streams = wiringOf(objects);
  console.log(`${levelName}: ${streams.length} navmesh streams`);
  const meshes = [];
  for (const s of streams) {
    const assetFile = join(levelDir, `${s.asset.split('/').pop()}.json`);
    const asset = (await readJson(assetFile)).objects[0];
    const id = asset.Blob.BlobId;
    const bytes = await readFile(join(root, 'chunks', `${id}.bin`));
    if (bytes.length !== asset.Blob.BlobSize) throw new Error(`${id}: ${bytes.length} bytes, the asset says ${asset.Blob.BlobSize}`);
    const decoded = readNavPower(bytes);
    const checks = checksOf(decoded);
    const name = NAMES[s.guid] ?? `stream${meshes.length}`;
    const linkMask = (1 << 0) | s.enabledLayers.reduce((m, l) => m | (LINK_LAYERS.indexOf(l) >= 0 ? 1 << LINK_LAYERS.indexOf(l) : 0), 0);
    const gr = decoded.graph;
    meshes.push({ name, id, stream: s, decoded, checks, links: gr.layer === 0 ? linkMask : 0, ...meshOf(decoded, (x, y, z) => frame([x, y, z])), radius: gr.radius, step: gr.step, height: gr.height, voxel: gr.voxel, layer: gr.layer });
    console.log(`- ${name} (stream ${s.guid}, blob ${id}, ${bytes.length} bytes): layer ${gr.layer}, agent r ${gr.radius} step ${gr.step} h ${gr.height}, voxel ${gr.voxel.toFixed(3)}; ${decoded.areas.length} areas, kd ${decoded.kd.nodes} nodes ${decoded.kd.leaves} leaves depth ${decoded.kd.depth}`);
    console.log(`    streamed in by ${s.when.join('; ')}${s.enables ? `; its OnStreamedIn enables ${s.enables} entities of ${s.enabledLayers.join(', ')}` : ''}`);
    console.log(`    proofs: ${checks.twins}/${checks.portals} portals twinned (${checks.sameFlags2} with the same flags2), ${checks.planar} planar, ${checks.convex} convex, ${checks.radius} radii, ${checks.areas - checks.wound} wound one way, of ${checks.areas}`);
  }
  meshes.sort((a, b) => (ORDER.indexOf(a.name) + 1 || 99) - (ORDER.indexOf(b.name) + 1 || 99));

  const layers = [];
  for (const name of LINK_LAYERS) layers.push({ name, json: await readJson(join(levelDir, `${name}.json`)) });
  const { links, skipped } = linksOf(layers, frame);
  console.log(`hand links: ${links.length} on the soldier layer (${links.filter((l) => l.start).length} on at the start, ${links.filter((l) => l.both).length} both ways), ${skipped.length} with no soldier layer left out`);

  const out = encodeNavmesh({ origin: pack.origin, yaw: pack.yaw ?? 0, meshes, links });
  console.log(`navmesh.bin: ${out.length} bytes, ${meshes.length} meshes (${meshes.map((m) => `${m.name} ${m.verts.length / 3} verts ${m.polyEdges.length} polys`).join('; ')})`);

  if (args.check) await check({ out, meshes, links, pack, packDir, mapName: typeof args.map === 'string' ? args.map : 'hoth' });
  if (args.dry) return;
  const file = join(packDir, 'navmesh.bin');
  await writeFile(file, out);
  console.log(`wrote ${file} (${(await stat(file)).size} bytes)`);
}

// ---- the measures ----

async function check({ out, meshes, links, pack, packDir, mapName }) {
  const { checkLevel } = await import('./lib/bf2017-navmesh-check.mjs');
  await checkLevel({ out, meshes, links, pack, packDir, mapName, root: ROOT });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.stack ?? e.message);
    process.exit(1);
  });
}
