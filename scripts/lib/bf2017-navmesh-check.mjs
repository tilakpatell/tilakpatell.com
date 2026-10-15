// bf2017-navmesh.mjs --check: the game's navmesh measured against the level as
// the site has it. Do its polygons lie on the floors (the pack's shapes, its
// inside pack's, the terrain), do the spawns stand on them, do the hand links'
// ends, and does a path run from the walkers' start into Echo Base?
//
//   checkLevel({ out, meshes, links, pack, packDir, mapName, root })  prints the tables

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { load } from '../../src/lib/battlefront/navmesh.js';
import { decodePng16 } from '../../src/lib/level/png16.js';
import { LAYERS, imageLayerFrom } from '../../src/lib/land/layers.js';
import { cellBodies, collidersOf, readShapes } from '../../src/lib/physics/havok.js';
import { createPhysics } from '../../src/lib/physics/world.js';
import { instancesOf } from '../../src/components/galaxy/surface/level/levelPhysics.js';

// places the game's bots must reach (the game's frame): Echo Base's hangar
// floors and its fuel rooms, from the walk on claude/hoth-map (HANDOFF-hoth-map.md)
export const PROBES = {
  hangars: { x: [170, 260], z: [-1700, -1560], y: 359 },
  fuelRooms: { x: [180, 240], z: [-1780, -1750], y: 359 },
};
export const WALKERS_START = [47, 313, -1000];
export const FUEL_ROOM = [209, 359, -1755];

async function terrainOf(dir, pack) {
  const t = pack.terrain;
  if (!t) return null;
  const [near, far] = await Promise.all([readFile(join(dir, t.near.png)).then(decodePng16), readFile(join(dir, t.far.png)).then(decodePng16)]);
  const frame = (m, img) => ({ data: img.data, w: img.w, h: img.h, minX: m.min[0], minZ: m.min[1], metresPerPixel: m.metresPerPixel });
  const layer = imageLayerFrom({ heightScale: t.scale, heightOffset: t.offset, holePixels: t.hole === null ? 0 : 1 }, frame(t.near, near), frame(t.far, far));
  return (x, z) => LAYERS.image(x, z, layer);
}

async function addPack(physics, dir) {
  const pack = JSON.parse(await readFile(join(dir, 'level.json'), 'utf8'));
  const loadBin = async (file) => {
    const b = await readFile(join(dir, file));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  };
  const section = pack.physics ?? { meshes: {}, materials: {} };
  const byMesh = {};
  for (const [mesh, rec] of Object.entries(section.meshes ?? {})) {
    const buf = await loadBin(rec.file).catch(() => null);
    if (buf) byMesh[mesh] = collidersOf(readShapes(buf), { materials: section.materials });
  }
  let bodies = 0;
  for (const key of Object.keys(pack.cells ?? {})) {
    const c = pack.cells[key];
    const bin = await loadBin(c.bin ?? `cells/${key.replace(',', '_')}.bin`).catch(() => null);
    if (!bin) continue;
    for (const desc of cellBodies(instancesOf(c.draws, bin), byMesh)) {
      try {
        physics.add(desc);
        bodies++;
      } catch {
        // (a body the engine refuses is left out, as the site does)
      }
    }
  }
  return bodies;
}

const pct = (a, b) => `${a} of ${b} (${b ? ((100 * a) / b).toFixed(1) : 0} %)`;

export async function checkLevel({ out, meshes, links, pack, packDir, mapName, root }) {
  const toPack = (p) => [p[0] - pack.origin[0], p[1] - pack.origin[1], p[2] - pack.origin[2]];
  const heightAt = await terrainOf(packDir, pack);
  const physics = await createPhysics({ gravity: 0, onError: null });
  const { RAPIER, world } = physics;
  const bodies = [await addPack(physics, packDir)];
  if (pack.inside) bodies.push(await addPack(physics, join(packDir, pack.inside)));
  else bodies.push(await addPack(physics, join(packDir, 'base')).catch(() => 0));
  world.step();
  console.log(`\nthe check: ${bodies.join(' + ')} bodies (the pack, its inside), the terrain ${heightAt ? 'read' : 'missing'}`);
  // the floor under a point: the first shape a ray down from 1 m over it meets
  // within 4 m, or the terrain when that is nearer and in the same span
  const floorUnder = (x, y, z) => {
    const hit = world.castRay(new RAPIER.Ray({ x, y: y + 1, z }, { x: 0, y: -1, z: 0 }), 4, true);
    const shapeY = hit ? y + 1 - hit.timeOfImpact : -Infinity;
    const g = heightAt ? heightAt(x, z) : NaN;
    const groundY = Number.isFinite(g) && g <= y + 1 && g >= y - 3 ? g : -Infinity;
    const top = Math.max(shapeY, groundY);
    return Number.isFinite(top) ? { y: top, by: top === shapeY ? 'shape' : 'terrain' } : null;
  };

  const map = JSON.parse(await readFile(join(root, 'src/data/bf2017/maps', `${mapName}.json`), 'utf8')).rows;
  console.log('\n| mesh | polygons on a floor within 0.5 m (by the shapes, by the terrain) | none under | median off | spawns within 0.5 m (all) | Galactic Assault | co-op | links snapped | islands |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const m of meshes) {
    const nav = load(out, { mesh: m.name, links: 'all' });
    let on = 0;
    let byShape = 0;
    let byTerrain = 0;
    let none = 0;
    const offs = [];
    for (let p = 0; p < nav.polyCount; p++) {
      const [x, y, z] = nav.centre(p);
      const f = floorUnder(x, y, z);
      if (!f) {
        none++;
        continue;
      }
      const d = Math.abs(f.y - y);
      offs.push(d);
      if (d <= 0.5) {
        on++;
        if (f.by === 'shape') byShape++;
        else byTerrain++;
      }
    }
    offs.sort((a, b) => a - b);
    const cover = (rows) => rows.filter((s) => nav.locate(...toPack(s.at), { above: 0.5, below: 0.5 }) >= 0).length;
    const ga = map.spawns.filter((s) => s.mode === 'galacticAssault');
    const coop = map.spawns.filter((s) => s.mode === 'coop');
    console.log(`| ${m.name} | ${pct(on, nav.polyCount)} (${byShape}, ${byTerrain}) | ${none} | ${(offs[offs.length >> 1] ?? 0).toFixed(3)} m | ${pct(cover(map.spawns), map.spawns.length)} | ${pct(cover(ga), ga.length)} | ${pct(cover(coop), coop.length)} | ${nav.links.length} of ${links.length} | ${nav.islands} |`);
  }

  console.log('\nthe base (a 1 m grid at the floor’s height, a polygon within 0.5 m):');
  for (const m of meshes) {
    const nav = load(out, { mesh: m.name });
    const row = [];
    for (const [name, r] of Object.entries(PROBES)) {
      let n = 0;
      let hit = 0;
      for (let x = r.x[0]; x <= r.x[1]; x++) {
        for (let z = r.z[0]; z <= r.z[1]; z++) {
          const f = floorUnder(...toPack([x, r.y + 0.5, z]));
          if (!f || Math.abs(f.y + pack.origin[1] - r.y) > 1) continue;
          n++;
          if (nav.locate(...toPack([x, f.y + pack.origin[1], z]), { above: 0.5, below: 0.5 }) >= 0) hit++;
        }
      }
      row.push(`${name}: ${pct(hit, n)} of the shapes’ floor`);
    }
    console.log(`- ${m.name}: ${row.join('; ')}`);
  }

  console.log('\nthe hand links’ ends, metres to the nearest polygon (the coop mesh):');
  const coop = load(out, { mesh: 'coop', links: 'all' });
  const far = links.map((l) => [l.points[0], l.points[l.points.length - 1]].map((q) => coop.nearest(...q, { radius: 20 })?.distance ?? Infinity));
  const ends = far.flat().sort((a, b) => a - b);
  console.log(`  median ${ends[ends.length >> 1].toFixed(2)}, worst ${ends[ends.length - 1].toFixed(2)}, within 0.5 m ${pct(ends.filter((d) => d <= 0.5).length, ends.length)}`);

  console.log('\nfrom the walkers’ start to the fuel room:');
  for (const m of meshes) {
    const nav = load(out, { mesh: m.name, links: 'all' });
    const t = performance.now();
    const r = nav.route(toPack(WALKERS_START), toPack(FUEL_ROOM), { snap: 30 });
    const ms = performance.now() - t;
    console.log(`- ${m.name}: ${r ? `${r.length.toFixed(0)} m, ${r.points.length} points, ${r.links.length} links, ${r.expanded} polygons expanded, ${ms.toFixed(0)} ms; from ${nav.toGame(r.points[0]).map((q) => q.toFixed(1)).join(', ')}` : 'no path'}`);
  }
  physics.dispose();
}
