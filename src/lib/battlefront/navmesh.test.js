import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import hoth from '../../data/bf2017/maps/hoth.json';
import { decodeNavmesh, encodeNavmesh, load } from './navmesh.js';

const BIN = join(import.meta.dirname, '../../../public/models/galaxy/bf2017/levels/hoth/navmesh.bin');
const bytes = readFileSync(BIN);

// two unit squares side by side at height 0 and a third over the first at 3 m (a floor above), joined to nothing
const tiny = () =>
  encodeNavmesh({
    origin: [0, 0, 0],
    yaw: 0,
    meshes: [
      {
        name: 'tiny',
        radius: 0.4,
        step: 0.3,
        height: 1.8,
        voxel: 0.2,
        layer: 0,
        verts: new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 2, 0, 0, 2, 0, 1, 0, 3, 0, 1, 3, 0, 1, 3, 1, 0, 3, 1]),
        polyEdges: new Uint8Array([4, 4, 4]),
        // (counter-clockwise seen from above: x right, z down the page)
        edgeVert: [0, 3, 2, 1, 1, 2, 5, 4, 6, 9, 8, 7],
        edgeAdj: [-1, -1, 1, -1, -1, 0, -1, -1, -1, -1, -1, -1],
      },
    ],
  });

describe('the navmesh file', () => {
  it('round-trips through its format', () => {
    const m = decodeNavmesh(tiny());
    expect(m.meshes).toHaveLength(1);
    expect(m.meshes[0].name).toBe('tiny');
    expect(Array.from(m.meshes[0].edgeAdj)).toEqual([-1, -1, 1, -1, -1, 0, -1, -1, -1, -1, -1, -1]);
  });

  it('tells two floors over one place apart by height', () => {
    const n = load(tiny(), { mesh: 'tiny' });
    expect(n.locate(0.5, 0.1, 0.5)).toBe(0);
    expect(n.locate(0.5, 3.1, 0.5)).toBe(2);
    expect(n.heightOn(2, 0.5, 0.5)).toBeCloseTo(3, 5);
  });
});

// Hoth's own (bf2-re findings/57): the playthrough stream, the mesh over the whole Galactic Assault battlefield
describe('Hoth’s NavPower mesh', () => {
  const nav = load(bytes, { mesh: 'playthrough' });
  const at = (p) => nav.toPack(p);

  it('has the fuel room’s floor under the mountain, not the snow over it', () => {
    const p = at([209, 359.5, -1755]);
    const poly = nav.locate(p[0], p[1], p[2]);
    expect(poly).toBeGreaterThanOrEqual(0);
    // (NavPower's polygons ride a little over the floor they were baked from: 0.07 to 0.62 m on Hoth; the terrain here is 436 m)
    const y = nav.toGame([p[0], nav.heightOn(poly, p[0], p[2]), p[2]])[1];
    expect(y).toBeGreaterThan(359);
    expect(y).toBeLessThan(360);
  });

  it('stands Galactic Assault’s spawn points of all three stages on it, at their height', () => {
    const spawns = hoth.rows.spawns.filter((s) => s.mode === 'galacticAssault' && !/Automation/.test(s.layer));
    let on = 0;
    for (const s of spawns) {
      const p = at(s.at);
      const poly = nav.locate(p[0], p[1] + 0.5, p[2], { above: 1, below: 1.5 });
      if (poly >= 0 && Math.abs(nav.heightOn(poly, p[0], p[2]) - p[1]) < 0.75) on++;
    }
    // (89.5%: the misses are the starfighters' far spawns, 900 m out over the ground, and the walkers' own start, which the bake left to the AT-ATs)
    expect(on / spawns.length).toBeGreaterThan(0.88);
  });

  it('keeps the base apart with the gates shut, as it was baked', () => {
    expect(nav.findPath(at([47, 313.3, -1000]), at([209, 359.5, -1755]))).toBeNull();
  });

  it('finds the way from the walkers’ start into the fuel room once the west gate opens, in by its mouth', () => {
    // (the west gate, FantasyBattle_Logic:91 at x 179.2, z −1569.3 facing +z: the doorway's link from 2 m out to 2 m in)
    const nav2 = load(bytes, { mesh: 'playthrough' });
    expect(nav2.addLink({ points: [nav2.toPack([179.2, 359.6, -1567.3]), nav2.toPack([179.2, 359.6, -1571.3])] })).toBeGreaterThanOrEqual(0);
    const path = nav2.findPath(nav2.toPack([47, 313.3, -1000]), nav2.toPack([209, 359.5, -1755]));
    expect(path).toBeTruthy();
    const game = path.map((p) => nav2.toGame(p));
    // (on the fuel room's floor, the mesh's lift over it: not the mountain's 436 m)
    expect(game[game.length - 1][1]).toBeGreaterThan(359);
    expect(game[game.length - 1][1]).toBeLessThan(360);
    // (through one of the two mouths, by the gates at x 179 and 251, z −1560…−1620)
    expect(game.some(([x, , z]) => ((x > 160 && x < 200) || (x > 230 && x < 270)) && z < -1555 && z > -1625)).toBe(true);
  });
});
