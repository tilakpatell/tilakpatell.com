import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { hullOf, segmentHit } from '../../src/lib/combat/hulls.js';
import { readHull } from '../../src/lib/physics/shapesBin.js';
import { readPhysicsGlb } from './bf2017-physics.mjs';
import { FIGHTER_PHYSICS, TIE, WAYS, assemble, boxOf, drawnPoints, facing, fitShapes, frameOf, gameToGlb, headerFile, offBy, partProperties, readHeader, resOf, rosterKinds } from './bf2017-hulls.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'bf2017', 'physics');
const readFixture = (name) => readFileSync(join(DIR, name));
const XWING = 'Gameplay/Vehicles/Air/XWing_T65/Vehicle_Air_XWing_T65_Physics_Win32';
// the X-wing's render cuts as the CLI measured them (bf2017-hulls.mjs: each
// cut's box in its GLB's frame, and the game box it was put on)
const CUTS = JSON.parse(readFixture('xwing-cuts.json'));

const I = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const pose = (scale) => ({ at0: [0, 0, 0], at1: [0, 0, 0], basis: I, scale });

// a GLB of one box (its eight corners), on a node moved by `at`, under a
// `nose` node turned by `turn` about y where one is given (as
// bf2017-fleet.mjs writes the fleet's files)
function boxDoc({ min, max }, { at = [0, 0, 0], turn = null } = {}) {
  const doc = new Document();
  const corners = [];
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) corners.push(x - at[0], y - at[1], z - at[2]);
  const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array(corners));
  const mesh = doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION', pos));
  const node = doc.createNode('box').setMesh(mesh).setTranslation(at);
  const scene = doc.createScene();
  if (turn === null) scene.addChild(node);
  else scene.addChild(doc.createNode('nose').setRotation([0, Math.sin(turn / 2), 0, Math.cos(turn / 2)]).addChild(node));
  return doc;
}

// the X-wing's shapes from the fixture GLB and header, in its plain cut's frame
async function xwing() {
  const { shapes } = await readPhysicsGlb(readFixture('Vehicle_Air_XWing_T65_Physics_Win32.glb'));
  const header = readHeader(readFixture(join('headers', headerFile(XWING))));
  const plain = CUTS.cuts[0];
  const doc = boxDoc(plain);
  const frame = frameOf(doc, plain.nose, 'xwing');
  const fitted = fitShapes(shapes, gameToGlb(doc, CUTS.game), frame);
  return { shapes, header, frame, fitted, hull: assemble(fitted, partProperties(header, XWING)) };
}

describe('the roster', () => {
  it('rosterKinds names every Star Wars kind the galaxy flies', async () => {
    const k = await rosterKinds();
    for (const kind of ['xwing', 'awing', 'ywing', 'bwing', 'uwing', 'tie', 'interceptor', 'tiebomber', 'delta7', 'vulture', 'ghost', 'destroyer', 'moncal', 'nebulon', 'corvette', 'lightcruiser', 'gozanti', 'executor', 'interdictor']) expect(k).toContain(kind);
    // (a hunter drawn as another's model brings that model: the navy's repair shuttle flies the shuttle)
    expect(k).toContain('shuttle');
    // (kinds with no model of their own aren't: Wedge flies the X-wing's, the pirates' skiff is built in code)
    expect(k).not.toContain('redleader');
    expect(k).not.toContain('skiff');
    // (the Star Wars sides only: the other wars' flagships are not this galaxy's)
    for (const kind of ['councildread', 'fedbattleship', 'superlab', 'hacienda']) expect(k).not.toContain(kind);
  }, 30000);

  it('names a flying asset for each of the game’s fighters', () => {
    expect(FIGHTER_PHYSICS.xwing).toBe('XWing_T65/Vehicle_Air_XWing_T65_Physics_Win32.glb');
    expect(FIGHTER_PHYSICS.xwing65).toBe(FIGHTER_PHYSICS.xwing);
    expect(Object.keys(FIGHTER_PHYSICS)).toHaveLength(17);
  });
});

describe('a physics asset’s header', () => {
  it('names the dump’s file by the asset’s path', () => {
    expect(resOf(`physics/${XWING}.glb`)).toBe('gameplay/vehicles/air/xwing_t65/vehicle_air_xwing_t65_physics_win32');
    expect(headerFile(XWING)).toBe('gameplay_vehicles_air_xwing_t65_vehicle_air_xwing_t65_physics_win32.bin');
  });

  it('reads the X-wing’s part slots and its table as the game does (findings/62 §2)', () => {
    const h = readHeader(readFixture(join('headers', headerFile(XWING))));
    expect(h.parts).toBe(8);
    expect(h.slots).toEqual([2, 1, 2, 2, 2, 2, 2, 2]);
    expect(h.materials).toEqual([0x088ac800, 0x00000800, 0x1100e820, 0x00000820]);
    // seven parts p68; part 1 the default slot, property 0
    expect(partProperties(h, XWING)).toEqual([68, 0, 68, 68, 68, 68, 68, 68]);
  });

  it('refuses a part whose slot is past the table, and a header with too few slots', () => {
    expect(() => partProperties({ parts: 2, slots: [0, 4], materials: [0x1100e820] }, 'a ship')).toThrow(/a ship: part 1’s slot 4 is past its table of 1/);
    expect(() => partProperties({ parts: 2, slots: [0], materials: [0x1100e820] }, 'a ship')).toThrow(/a ship: 2 parts, 1 slot/);
  });
});

describe('the frame each kind is drawn in', () => {
  it('frameOf measures as normalise does: turned, centred, one long', () => {
    // a 2 × 1 × 4 box (x 1..3, y 0..1, z 0..4) on a node moved 1 along x;
    // turned π/2 about y, x takes z and z takes −x: 4 × 1 × 2, centred at (2, 0.5, −2)
    const doc = boxDoc({ min: [1, 0, 0], max: [3, 1, 4] }, { at: [1, 0, 0] });
    const f = frameOf(doc, Math.PI / 2, 'xwing');
    expect(f.nose).toBe(Math.PI / 2);
    [2, 0.5, -2].forEach((v, k) => expect(f.centre[k]).toBeCloseTo(v, 6));
    expect(f.k).toBeCloseTo(1 / 2, 6); // (z after the turn is 2)
    // (a kind fitted by its biggest side: Slave I)
    expect(frameOf(doc, Math.PI / 2, 'slave1').k).toBeCloseTo(1 / 4, 6);
  });

  it('gameToGlb puts the game’s box on the GLB’s, through its nose node', () => {
    const game = { min: [-1, -0.5, -1], max: [1, 0.5, 3] };
    // the GLB stood on y = 0 and centred, as lane V's import does
    const m = gameToGlb(boxDoc({ min: [-1, 0, -2], max: [1, 1, 2] }), game);
    expect([m[12], m[13], m[14]].map((v) => +v.toFixed(6))).toEqual([0, 0.5, -1]);
    // turned π/2 by its nose node: the game's z is the GLB's x
    // (the box as its node holds it: x 2 wide and z 4 long, which the turn makes 4 along x)
    const turned = boxDoc({ min: [-1, 0, -2], max: [1, 1, 2] }, { turn: -Math.PI / 2 });
    const t = gameToGlb(turned, game);
    const at = (p) => [0, 1, 2].map((r) => +(t[r] * p[0] + t[4 + r] * p[1] + t[8 + r] * p[2] + t[12 + r]).toFixed(6) + 0);
    expect(at([0, -0.5, 3])).toEqual([-2, 0, 0]);
  });

  it('gameToGlb takes a scale the three sides agree on', () => {
    // (lane V's light cut of the vulture: the game's LOD3 stood at LOD0's height, 1.0183 × it)
    const m = gameToGlb(boxDoc({ min: [-1.0183, 0, -2.0366], max: [1.0183, 1.0183, 2.0366] }), { min: [-1, -0.5, -2], max: [1, 0.5, 2] });
    expect(m[0]).toBeCloseTo(1.0183, 6);
    expect(m[5]).toBeCloseTo(1.0183, 6);
  });

  it('gameToGlb refuses boxes of different sizes', () => {
    const doc = boxDoc({ min: [-1, 0, -2], max: [1, 1, 2] });
    expect(() => gameToGlb(doc, { min: [-1, -0.5, -2.5], max: [1, 0.5, 2.5] })).toThrow(/1 %/);
    // (a turn it doesn't know: x and z swapped)
    expect(() => gameToGlb(doc, { min: [-2, -0.5, -1], max: [2, 0.5, 1] })).toThrow(/1 %/);
  });
});

// A wedge, drawn as its edges: a flat back at z = −0.5 (x from −0.3 to
// `right`, y ±0.1) running to a nose edge at z = +0.5 (x = `nose`, y ±0.1).
// Its hull: its six corners and its edges' middles. Lopsided across x
// (right 0.15, nose 0.05), a turn and a mirror are told apart; even
// (right 0.3, nose 0), it is the same mirrored across x.
function wedge(right, nose) {
  const back = [[-0.3, -0.1, -0.5], [right, -0.1, -0.5], [right, 0.1, -0.5], [-0.3, 0.1, -0.5]];
  const tip = [[nose, -0.1, 0.5], [nose, 0.1, 0.5]];
  const edges = [[back[0], back[1]], [back[1], back[2]], [back[2], back[3]], [back[3], back[0]], [back[0], tip[0]], [back[1], tip[0]], [back[2], tip[1]], [back[3], tip[1]], [tip[0], tip[1]]];
  const drawn = [];
  for (const [a, b] of edges) for (let t = 0; t <= 1; t += 1 / 64) drawn.push(...a.map((v, k) => v + (b[k] - v) * t));
  const hull = [...back, ...tip].flat();
  for (const [a, b] of edges) hull.push(...a.map((v, k) => (v + b[k]) / 2));
  return { drawn: Float32Array.from(drawn), hull: Float32Array.from(hull) };
}
const moved = (points, way) => {
  const out = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 3) out.set(way(points[i], points[i + 1], points[i + 2]), i);
  return out;
};

describe('which way round', () => {
  it('a hull as placed on its drawing wins, and a ship the same mirrored ties without failing', () => {
    const { drawn, hull } = wedge(0.15, 0.05);
    const f = facing(hull, drawn);
    expect(f.better).toBeNull();
    for (const w of f.ways) expect(w.chamfer).toBeGreaterThan(f.placed + TIE);
    const even = wedge(0.3, 0);
    const g = facing(even.hull, even.drawn);
    expect(g.ways.find((w) => w.name === 'mirrored in x').chamfer).toBeCloseTo(g.placed, 6);
    expect(g.better).toBeNull();
  });

  it('a hull turned half round on its drawing fails: turned back it fits better', () => {
    const { drawn, hull } = wedge(0.15, 0.05);
    const f = facing(moved(hull, WAYS['turned π']), drawn);
    expect(f.better?.name).toBe('turned π');
    expect(f.better.chamfer).toBeLessThan(f.placed - TIE);
    // (and a mirror, and a quarter turn, each found as the way back)
    expect(facing(moved(hull, WAYS['mirrored in z']), drawn).better?.name).toBe('mirrored in z');
    expect(facing(moved(hull, WAYS['turned π/2']), drawn).better?.name).toBe('turned −π/2');
  });

  it('a NaN fails the 2 % gate, and a turn its check', () => {
    expect(Number.isNaN(offBy({ min: [NaN, 0, 0], max: [0, 0, 0] }, { size: [1, 1, 1], k: 1 }).off)).toBe(true);
    const { drawn, hull } = wedge(0.15, 0.05);
    expect(facing(Float32Array.from([NaN, 0, 0, ...hull]), drawn).better).not.toBeNull();
  });

  it('drawnPoints puts the model where frameOf says normalise does', () => {
    const doc = boxDoc({ min: [1, 0, 0], max: [3, 1, 4] }, { at: [1, 0, 0] });
    const box = boxOf([{ kind: 'hull', points: drawnPoints(doc, frameOf(doc, Math.PI / 2, 'xwing')) }]);
    [-1, -0.25, -0.5].forEach((v, k) => expect(box.min[k]).toBeCloseTo(v, 6));
    [1, 0.25, 0.5].forEach((v, k) => expect(box.max[k]).toBeCloseTo(v, 6));
  });
});

describe('the X-wing', () => {
  it('the X-wing hull sits on its render model within 2 %', async () => {
    const { fitted } = await xwing();
    const bolts = boxOf(fitted.filter((s) => s.root === 1));
    for (const cut of CUTS.cuts) {
      const { off, face } = offBy(bolts, frameOf(boxDoc(cut), cut.nose, 'xwing'));
      expect(off, `${cut.url}: ${face}`).toBeLessThan(0.02);
    }
  });

  it('the X-wing keeps root 0 for contact and root 1 for bolts, and part 7’s hulls carry property 68', async () => {
    const { hull } = await xwing();
    const roots = (r) => hull.shapes.filter((s) => s.root === r);
    expect(roots(0).map((s) => [s.kind, s.part, s.material])).toEqual([
      ['hull', 7, 68],
      ['hull', 7, 68],
    ]);
    expect(roots(1).map((s) => s.kind)).toEqual(Array(8).fill('mesh'));
    expect(roots(1).map((s) => s.material)).toEqual([68, 0, 68, 68, 68, 68, 68, 68]);
    expect(hull.parts).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({ name: `part${n}`, property: n === 1 ? 0 : 68 })));
    // (its radius reaches the farthest corner of either root)
    expect(hull.radius).toBeGreaterThan(0.65);
    expect(hull.radius).toBeLessThan(0.72);
  });

  it('the fixture is what this makes of the X-wing', async () => {
    const { hull } = await xwing();
    const bin = readHull(readFixture('xwing-hull.bin'));
    expect(bin.version).toBe(2);
    expect(bin.parts).toEqual(hull.parts);
    expect(bin.radius).toBeCloseTo(hull.radius, 4);
    expect(bin.shapes.map((s) => [s.kind, s.root, s.part, s.material])).toEqual(hull.shapes.map((s) => [s.kind, s.root, s.part, s.material]));
    bin.shapes.forEach((s, i) => s.points.forEach((v, j) => expect(Math.abs(v - hull.shapes[i].points[j])).toBeLessThan(1e-4)));
  });

  it('the X-wing: a bolt through the gap between its S-foils misses, one on a foil hits', () => {
    const x = hullOf(readFixture('xwing-hull.bin')); // Task 3’s hullOf on the fixture this task writes
    expect(segmentHit(x, pose(1), [0, 0, 2], [0, 0, -2])).not.toBeNull(); // down the fuselage
    // the slot between the foils and a point on the upper foil: their x and y read off the fitted shapes
    // when the fixture was made (the foils' inner edges from root 1's parts)
    expect(segmentHit(x, pose(1), [GAP[0], GAP[1], 2], [GAP[0], GAP[1], -2])).toBeNull();
    const foil = segmentHit(x, pose(1), [FOIL[0], FOIL[1], 2], [FOIL[0], FOIL[1], -2]);
    expect(foil).not.toBeNull();
    expect(foil.part).toBe(5); // (the upper right foil)
    expect(foil.property).toBe(68);
    // (and the lower one, as far below the slot)
    expect(segmentHit(x, pose(1), [FOIL[0], -FOIL[1], 2], [FOIL[0], -FOIL[1], -2])?.part).toBe(3);
  });

  it('answers 10,000 segment tests against the X-wing in under 50 ms', () => {
    const x = hullOf(readFixture('xwing-hull.bin'));
    // (a seeded spray of bolts through the ship's box, from every side)
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const bolts = Array.from({ length: 10000 }, () => [
      [rand(), rand() * 0.2, rand()],
      [rand(), rand() * 0.2, rand()],
    ]);
    const p = pose(1);
    for (let i = 0; i < 1000; i++) segmentHit(x, p, bolts[i][0], bolts[i][1]); // (warm)
    const t = performance.now();
    let hits = 0;
    for (const [a, b] of bolts) if (segmentHit(x, p, a, b)) hits++;
    const ms = performance.now() - t;
    expect(hits).toBeGreaterThan(0);
    expect(ms).toBeLessThan(50);
  });
});

// The X-wing is drawn with its S-foils closed (the game's static model, as
// its shapes are), so the slot between them is thin: 0.3 of the length out
// along the right wing, the upper foil's (part 5) inner edge is at
// y = 0.00133 and the lower's (part 3) at −0.00133, 3.3 cm apart on the
// 12.48 m ship, and the upper foil runs to y = 0.01289 (read off xwing-hull.bin's
// root 1 triangles crossing x = 0.3 when it was made).
const GAP = [0.3, 0];
const FOIL = [0.3, 0.007];
