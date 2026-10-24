import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { describe, expect, it } from 'vitest';
import { hullOf, segmentHit } from '../../src/lib/combat/hulls.js';
import { packHull, readHull } from '../../src/lib/physics/shapesBin.js';
import { FLEET } from '../bf2017-fleet.mjs';
import { physicsKey, readPhysicsGlb } from './bf2017-physics.mjs';
import {
  CAPITAL_KITS,
  FIGHTER_PHYSICS,
  OBJECTIVE,
  SITE_OVER_GAME,
  TIE,
  WAYS,
  assemble,
  bothRoots,
  boxOf,
  capitalKinds,
  cutsOf,
  drawnPoints,
  facing,
  fitShapes,
  frameOf,
  gameToGlb,
  headerFile,
  hunterCuts,
  kitShapes,
  offBy,
  partName,
  partProperties,
  readHeader,
  resOf,
  rosterKinds,
  wingEdge,
} from './bf2017-hulls.mjs';
import { capitalBudget, passThrough, sinkIn } from './bf2017-hulls-budget.mjs';
import { siteHull, subsystemParts } from './bf2017-hulls-site.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = join(REPO, 'scripts', 'fixtures', 'bf2017', 'physics');
const readFixture = (name) => readFileSync(join(DIR, name));
const HULLS = JSON.parse(readFileSync(join(REPO, 'src/data/galaxyHulls.json'), 'utf8'));
const hullBin = (key) => readFileSync(join(REPO, 'public/models/galaxy/hulls', `${key}.bin`));
// a GLB in public/ (the site's own, in git)
const readGlb = async (path) => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  return io.readBinary(new Uint8Array(readFileSync(join(REPO, 'public', path))));
};
const importRepo = (path) => import(new URL(`../../${path}`, import.meta.url).href);
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

describe('a capital’s parts’ names', () => {
  it('names a part for its module’s file, with its index where the module’s asset has more than one', () => {
    const shield = 'models/objects/props/landmarks/_galacticempire/stardestroyer_01/stardestroyer_deflectorshield_01_mesh.glb';
    expect(partName(shield, 0, 2)).toBe('stardestroyer_deflectorshield_01#0');
    expect(partName(shield, 1, 2)).toBe('stardestroyer_deflectorshield_01#1');
    expect(partName('models/gameplay/vehicles/capital/providenceclassdreadnaught/providenceclassdreadnaught_01_mesh.glb', 0, 1)).toBe('providenceclassdreadnaught_01');
    // (the module's blueprint, its physics asset and a LOD's file name it the same)
    expect(partName('Objects/Props/Landmarks/_GalacticEmpire/StarDestroyer_01/StarDestroyer_DeflectorShield_01', 1, 2)).toBe('stardestroyer_deflectorshield_01#1');
    expect(partName('objects/props/landmarks/_galacticempire/stardestroyer_01/stardestroyer_deflectorshield_01_physics_win32', 0, 2)).toBe('stardestroyer_deflectorshield_01#0');
    expect(partName('models/gameplay/vehicles/capital/mc80/mc80_largenodule_03_mesh_lod2.glb', 0, 3)).toBe('mc80_largenodule_03#0');
  });

  it('refuses a part its module hasn’t', () => {
    expect(() => partName('a_mesh.glb', 2, 2)).toThrow(/part 2 of 2/);
    expect(() => partName('a_mesh.glb', 0, 0)).toThrow(/part 0 of 0/);
  });
});

describe('the capitals’ kits', () => {
  it('CAPITAL_KITS names the kit each capital’s fleet file was made from (bf2017-fleet.mjs)', () => {
    for (const [file, , , from] of FLEET) if (from.space) expect(CAPITAL_KITS[file], file).toEqual({ space: from.space, model: from.model });
    expect(CAPITAL_KITS.destroyer).toEqual({ space: 'endor', model: 'endor-isd' });
    expect(CAPITAL_KITS.lightcruiser).toEqual({ space: 'fondor', model: 'fondor-arquitens' });
    expect(CAPITAL_KITS.nebulon.physics).toBe('Objects/Props/Landmarks/_RebelAlliance/BD_FrigateNebulonB_01/FrigateNebulonB_01_Physics_Win32');
    expect(CAPITAL_KITS['hq/nebulon'].physics).toBe(CAPITAL_KITS.nebulon.physics);
  });

  // a kit of three modules: a shield placed twice (turned a quarter about y
  // and doubled; as it is) and a window with no physics asset; the shield's
  // asset two parts (p130 and p132) on two roots
  const SHIELD = 'models/objects/props/landmarks/_galacticempire/stardestroyer_01/stardestroyer_deflectorshield_01_mesh.glb';
  const WINDOW = 'models/objects/props/landmarks/_galacticempire/stardestroyer_01/stardestroyer_windows_01_mesh.glb';
  const q = Math.SQRT1_2;
  const space = {
    models: {
      'endor-isd': {
        parts: [
          { file: SHIELD, at: [10, 0, 0], quaternion: [0, q, 0, q], scale: [2, 2, 2] },
          { file: SHIELD, at: [-10, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] },
          { file: WINDOW, at: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] },
        ],
      },
    },
  };
  const shapes = [
    { kind: 'hull', root: 0, part: 0, instance: 0, material: 3, points: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]) },
    { kind: 'sphere', root: 0, part: 0, instance: 0, material: 3, points: Float32Array.from([0, 0, 1]), centre: [0, 0, 1], radius: 0.5 },
    { kind: 'mesh', root: 1, part: 1, instance: 0, material: 3, points: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), indices: Uint32Array.from([0, 1, 2]) },
  ];
  const assets = new Map([[physicsKey(SHIELD), { shapes, properties: [130, 132] }]]);

  it('kitShapes: each module’s parts its own, named for the module and with its own property', () => {
    const kit = kitShapes(space, 'endor-isd', assets);
    expect(kit.parts).toEqual([
      { name: 'stardestroyer_deflectorshield_01#0', property: 130 },
      { name: 'stardestroyer_deflectorshield_01#1', property: 132 },
      { name: 'stardestroyer_deflectorshield_01#0', property: 130 },
      { name: 'stardestroyer_deflectorshield_01#1', property: 132 },
    ]);
    expect(kit.missing).toEqual(['stardestroyer_windows_01']);
    expect(kit.shapes.map((s) => [s.kind, s.root, s.part, s.material])).toEqual([
      ['hull', 0, 0, 130],
      ['sphere', 0, 0, 130],
      ['mesh', 1, 1, 132],
      ['hull', 0, 2, 130],
      ['sphere', 0, 2, 130],
      ['mesh', 1, 3, 132],
    ]);
  });

  it('kitShapes puts each module’s shapes where the kit places it: turned, scaled, moved', () => {
    const [hull, sphere, , moved] = kitShapes(space, 'endor-isd', assets).shapes;
    // (a quarter about y takes +x to −z, doubled, then 10 along x)
    [10, 0, -2].forEach((v, k) => expect(hull.points[k]).toBeCloseTo(v, 6));
    [12, 0, 0].forEach((v, k) => expect(sphere.centre[k]).toBeCloseTo(v, 6));
    expect(sphere.radius).toBeCloseTo(1, 6);
    [-9, 0, 0].forEach((v, k) => expect(moved.points[k]).toBeCloseTo(v, 6));
  });

  it('a module whose asset has one root is met on it both ways: bolts and contact', () => {
    const one = [
      { kind: 'hull', root: 0, part: 0, points: Float32Array.from([0, 0, 0]) },
      { kind: 'mesh', root: 0, part: 0, points: Float32Array.from([0, 0, 0]), indices: Uint32Array.from([0, 0, 0]) },
    ];
    expect(
      bothRoots(one)
        .map((s) => `${s.kind} ${s.root}`)
        .sort(),
    ).toEqual(['hull 0', 'hull 1', 'mesh 1']);
    // (one with two keeps them)
    expect(bothRoots(shapes)).toEqual(shapes);
  });

  it('capitalKinds: the kinds the battles fly as flagships and escorts', async () => {
    const k = await capitalKinds();
    for (const kind of ['destroyer', 'executor', 'interdictor', 'moncal', 'nebulon', 'corvette', 'gozanti', 'hammerhead', 'transport', 'acclamator', 'munificent', 'venator', 'providence', 'lucrehulk', 'lightcruiser']) expect(k).toContain(kind);
    for (const kind of ['xwing', 'bwing', 'delta7', 'shuttle', 'ghost', 'ig2000']) expect(k).not.toContain(kind);
  }, 30000);
});

// a flat grid of n × n squares (2n² triangles) across `size` about `at`, in
// y = at[1], as a mesh shape of `part` on root 1
function grid(n, size, at, part) {
  const points = [];
  const indices = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) points.push(at[0] + (i / n - 0.5) * size, at[1], at[2] + (j / n - 0.5) * size);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const a = i * (n + 1) + j;
      indices.push(a, a + 1, a + n + 2, a, a + n + 2, a + n + 1);
    }
  return { kind: 'mesh', root: 1, part, instance: 0, material: 0, points: Float32Array.from(points), indices: Uint32Array.from(indices) };
}
// a cube `size` across about `at`, a convex shape of `part` on root 0
function cube(size, at, part) {
  const points = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) points.push(at[0] + (x * size) / 2, at[1] + (y * size) / 2, at[2] + (z * size) / 2);
  return { kind: 'hull', root: 0, part, instance: 0, material: 0, points: Float32Array.from(points) };
}

describe('a game capital’s hull to the budget', () => {
  // three parts on root 1: a broad deck of 1,800 triangles, a smaller plate
  // of 450 and a turret of 200 a hundredth across; on root 0, 12 blocks,
  // 20 greebles a two-hundredth across and 10 small blocks among the big
  const shapes = [grid(30, 1, [0, 0, 0], 0), grid(15, 0.3, [0.2, 0.05, 0.1], 1), grid(10, 0.01, [-0.3, 0.02, -0.3], 2)];
  for (let i = 0; i < 12; i++) shapes.push(cube(0.08, [-0.44 + i * 0.08, -0.02, 0], 0));
  for (let i = 0; i < 20; i++) shapes.push(cube(0.005, [-0.4 + i * 0.04, 0.03, 0.3], 1));
  for (let i = 0; i < 10; i++) shapes.push(cube(0.02, [-0.4 + i * 0.08, -0.02, -0.2], 2));
  const hull = assemble(shapes, [132, 206, 129], ['deck', 'plate', 'turret']);

  it('cuts root 1 to its triangles, every part kept, named and hittable', async () => {
    const { hull: cut, said } = await capitalBudget(hull, { maxTris: 300, maxSolids: 16 });
    const h = hullOf(packHull(cut));
    expect(said.tris).toEqual([2450, h.rays.count]);
    expect(h.rays.count).toBeLessThanOrEqual(300);
    expect(cut.parts).toEqual(hull.parts);
    for (const part of [0, 1, 2]) expect(Array.from(h.rays.part).filter((p) => p === part).length, `part ${part}`).toBeGreaterThanOrEqual(4);
    // (a bolt down onto the turret names it)
    const hit = segmentHit(h, pose(1), [-0.3, 1, -0.3], [-0.3, -1, -0.3]);
    expect(h.parts[hit.part].name).toBe('turret');
    expect(hit.property).toBe(129);
    // (and the bolts' box is the game's)
    const before = boxOf(hull.shapes.filter((s) => s.root === 1));
    const after = boxOf(cut.shapes.filter((s) => s.root === 1));
    for (const end of ['min', 'max']) after[end].forEach((v, k) => expect(v).toBeCloseTo(before[end][k], 6));
  });

  it('drops root 0’s greebles, then merges its smallest into their neighbours', async () => {
    const { hull: cut, said } = await capitalBudget(hull, { maxTris: 300, maxSolids: 16 });
    expect(said.solids).toEqual([42, 16]);
    expect(said.greebles).toBe(20);
    expect(said.merges).toBe(6);
    expect(hullOf(packHull(cut)).solids).toHaveLength(16);
    // (every solid still a convex shape of at most 64 points, on a part of the hull)
    for (const s of cut.shapes.filter((x) => x.root === 0)) {
      expect(s.points.length / 3).toBeLessThanOrEqual(64);
      expect(s.part).toBeLessThan(3);
    }
  });

  it('leaves a hull within the budget as it is', async () => {
    const { hull: same, said } = await capitalBudget(hull, { maxTris: 5000, maxSolids: 64 });
    expect(same).toBe(hull);
    expect(said.tris).toEqual([2450, 2450]);
  });

  it('over its bytes, gives up bolt triangles before a solid’s points (contact’s fidelity last)', async () => {
    // (a deck of 1,800 triangles over twelve solids of 64 points each, 42 KB in all, to fit in 30,000 bytes)
    const round = (at, part) => {
      const points = [];
      for (let i = 0; i < 64; i++) {
        const y = 1 - (2 * (i + 0.5)) / 64;
        const r = Math.sqrt(1 - y * y);
        points.push(at[0] + 0.04 * r * Math.cos(i * 2.4), at[1] + 0.04 * y, at[2] + 0.04 * r * Math.sin(i * 2.4));
      }
      return { kind: 'hull', root: 0, part, instance: 0, material: 0, points: Float32Array.from(points) };
    };
    const heavy = assemble([grid(30, 1, [0, 0, 0], 0), ...Array.from({ length: 12 }, (_, i) => round([-0.44 + i * 0.08, -0.04, 0], 0))], [132], ['deck']);
    expect(packHull(heavy).byteLength).toBeGreaterThan(30000);
    const { hull: cut, said } = await capitalBudget(heavy, { maxTris: 1800, maxSolids: 256, maxBytes: 30000 });
    expect(packHull(cut).byteLength).toBeLessThanOrEqual(30000);
    expect(said.points).toBe(64);
    expect(said.solids).toEqual([12, 12]);
    expect(said.tris[1]).toBeLessThan(1800);
    for (const s of cut.shapes.filter((x) => x.root === 0)) expect(s.points.length / 3).toBe(64);
  });
});

// A deck on root 1 in a slab of solid on root 0, and the same deck in the
// slab split by a gap a fighter fits through (0.04 of the length; the
// X-wing flown at a hundredth): the gate that holds a cut hull's contact to
// the uncut one's
describe('a cut hull still keeps a fighter out', () => {
  const slab = (x0, x1) => {
    const points = [];
    for (const x of [x0, x1]) for (const y of [-0.02, 0.02]) for (const z of [-0.5, 0.5]) points.push(x, y, z);
    return { kind: 'hull', root: 0, part: 0, instance: 0, material: 0, points: Float32Array.from(points) };
  };
  const whole = hullOf(packHull(assemble([grid(20, 1, [0, 0, 0], 0), slab(-0.5, 0.5)], [132], ['deck'])));
  const gapped = hullOf(packHull(assemble([grid(20, 1, [0, 0, 0], 0), slab(-0.5, -0.02), slab(0.02, 0.5)], [132], ['deck'])));
  const fighter = hullOf(readFixture('xwing-hull.bin'));

  it('passThrough: a fighter goes through the gap the cut opened, and not through the whole slab', () => {
    const through = passThrough(gapped, whole, fighter, { lines: 2000 });
    expect(through.lines).toBeGreaterThan(0);
    expect(through.cut).toBeGreaterThan(through.uncut);
    expect(through.uncut).toBe(0);
    // (the whole slab against itself lets nothing more through)
    const same = passThrough(whole, whole, fighter, { lines: 2000 });
    expect(same.cut).toBe(same.uncut);
  }, 60000);

  it('sinkIn: the bolts over the gap have no solid behind them', () => {
    expect(sinkIn(whole, { lines: 4000 })).toBe(0);
    expect(sinkIn(gapped, { lines: 4000 })).toBeGreaterThan(0.01);
  });
});

// The Star Destroyer's hull as the CLI writes it (`node scripts/bf2017-hulls.mjs
// --only destroyer --fixture`: its 81 modules' shapes cut to a capital's
// budget), and the boxes of the cuts it is drawn in
describe('the Star Destroyer', () => {
  const cuts = () => JSON.parse(readFixture('destroyer-cuts.json')).cuts;
  const bin = () => readFixture('destroyer-hull.bin');

  it('is within a capital’s budget: 4,000 bolt triangles, 256 solids, about 120 KB', () => {
    const h = hullOf(bin());
    expect(h.rays.count).toBeLessThanOrEqual(4000);
    expect(h.solids.length).toBeLessThanOrEqual(256);
    expect(bin().byteLength).toBeLessThanOrEqual(125000);
    // (every module's part with bolt triangles before keeps some: 123 parts, a turret's among them)
    expect(new Set(h.rays.part).size).toBeGreaterThan(100);
    // (built in well under the 291 ms the modules' own shapes took: 20 ms on the machine that wrote it, room here for a slower one)
    const t = performance.now();
    hullOf(bin());
    expect(performance.now() - t).toBeLessThan(100);
  });

  it('has parts named for its deflector shields and its reactor, each with its module’s property', () => {
    const { parts } = readHull(bin());
    // (two domes, each its module's part 0, p130; the reactor's part 0 p206: findings/62 §7)
    expect(parts.filter((p) => p.name === 'stardestroyer_deflectorshield_01#0').map((p) => p.property)).toEqual([130, 130]);
    expect(parts.filter((p) => p.name === 'stardestroyer_solarionizationreactor_01#0').map((p) => p.property)).toEqual([206]);
    expect(parts.some((p) => p.name.startsWith('stardestroyer_hull_01_sb_endor#') && p.property === 132)).toBe(true);
  });

  it('covers its render box within 2 % on every cut', () => {
    const shapes = readHull(bin()).shapes.filter((s) => s.root === 1);
    expect(cuts().length).toBeGreaterThanOrEqual(2);
    for (const cut of cuts()) {
      const { off, face } = offBy(boxOf(shapes), frameOf(boxDoc(cut), cut.nose, 'destroyer'));
      expect(off, `${cut.url}: ${face}`).toBeLessThan(0.02);
    }
  });

  it('a point at x = ±0.27 of its length on its widest section is inside a root 0 solid', () => {
    const edges = wingEdge(hullOf(bin()), 0.27);
    expect(edges).toHaveLength(2);
    for (const e of edges) {
      expect(Math.abs(e.widest)).toBeGreaterThan(0.27);
      expect(e.inside, `${e.side} at ${e.at.map((v) => v.toFixed(4))}`).toBe(true);
    }
  });
});

describe('the ships the game never had', () => {
  it('a site hull of the B-wing: at most 600 triangles, one part, its box within 3 % of the model’s', async () => {
    const doc = await readGlb('models/galaxy/bwing.glb');
    const shapes = await siteHull(doc, 'bwing', { maxTris: 600 });
    const [mesh, ...rest] = shapes.filter((s) => s.root === 1);
    expect(rest).toHaveLength(0);
    expect(mesh.indices.length / 3).toBeLessThanOrEqual(600);
    expect(shapes.every((s) => s.part === 0)).toBe(true);
    const solids = shapes.filter((s) => s.root === 0);
    expect(solids.length).toBeGreaterThan(0);
    expect(solids.length).toBeLessThanOrEqual(8);
    for (const s of solids) expect(s.points.length / 3).toBeLessThanOrEqual(64);
    const { off, face } = offBy(boxOf([mesh]), frameOf(doc, 0, 'bwing'));
    expect(off, face).toBeLessThan(0.03);
  });

  it('subsystemParts: the war’s subsystems as small parts at their shares, named for them', () => {
    const subs = [
      { id: 'gen-port', at: [-0.1, 0.2, -0.3], r: 0.03 },
      { id: 'reactor', at: [0, -0.1, 0], r: 0.05 },
    ];
    const { parts, shapes } = subsystemParts(subs, 1);
    expect(parts).toEqual([
      { name: 'gen-port', property: OBJECTIVE },
      { name: 'reactor', property: OBJECTIVE },
    ]);
    expect(shapes.map((s) => [s.kind, s.root, s.part])).toEqual([
      ['hull', 1, 1],
      ['hull', 1, 2],
    ]);
    const box = boxOf([shapes[0]]);
    [-0.13, 0.17, -0.33].forEach((v, k) => expect(box.min[k]).toBeCloseTo(v, 6));
    [-0.07, 0.23, -0.27].forEach((v, k) => expect(box.max[k]).toBeCloseTo(v, 6));
  });

  it('the Executor’s hull names the war’s subsystems: a bolt down onto its port generator hits it', async () => {
    const { SUBSYSTEMS } = await importRepo('src/components/universe/wars.js');
    const h = hullOf(hullBin('executor'));
    expect(h.parts.map((p) => p.name)).toEqual(['hull', 'gen-port', 'gen-star', 'bridge', 'reactor']);
    const gen = SUBSYSTEMS.executor.find((s) => s.id === 'gen-port');
    const hit = segmentHit(h, pose(1), [gen.at[0], 1, gen.at[2]], [gen.at[0], -1, gen.at[2]]);
    expect(h.parts[hit.part].name).toBe('gen-port');
    expect(hit.property).toBe(OBJECTIVE);
  }, 30000);

  it('hunterCuts: the hunters whose model is not the galaxy’s cut of their kind (none since lane C2: Slave I was the universe map’s)', async () => {
    const galaxy = await importRepo('src/components/galaxy/models.js');
    expect(hunterCuts(galaxy.HUNTER_GLB, galaxy)).toEqual([]);
    expect(hunterCuts({ slave1: { url: '/models/universe/slave1.glb', nose: 0 } }, galaxy)).toEqual([{ kind: 'slave1', url: '/models/universe/slave1.glb', nose: 0 }]);
  }, 30000);

  it('hq/nebulon sits on the HQ model: its box within 2 %, and point by point the way it is drawn', async () => {
    expect(HULLS['hq/nebulon'].from).toBe('/models/galaxy/hq/nebulon.glb');
    const hq = await readGlb('models/galaxy/hq/nebulon.glb');
    const frame = frameOf(hq, Math.PI, 'nebulon'); // (drawn turned half round, nose first: models.js's HQ row)
    const shapes = readHull(hullBin('hq/nebulon')).shapes.filter((s) => s.root === 1);
    expect(offBy(boxOf(shapes), frame).off).toBeLessThan(0.02);
    const way = facing(Float32Array.from(shapes.flatMap((s) => [...s.points])), drawnPoints(hq, frame));
    expect(way.better).toBeNull();
    expect(way.placed).toBeLessThan(0.002);
  }, 30000);
});

describe('every kind the galaxy flies has a hull', () => {
  it('every roster kind but the Death Stars (the world draws their sphere) has its row in galaxyHulls.json', async () => {
    const roster = await rosterKinds();
    const missing = roster.filter((k) => !['deathstar', 'deathstar2'].includes(k) && !HULLS[k]);
    expect(missing).toEqual([]);
    // (and the close-up Nebulon-B; no hunter is drawn as another model since lane C2)
    expect(HULLS['hq/nebulon']).toBeTruthy();
    expect(Object.keys(HULLS).filter((k) => k.startsWith('hunter/'))).toEqual([]);
  }, 30000);

  it('a site hull is committed beside its model, unless its model is published only', () => {
    for (const [key, row] of Object.entries(HULLS)) {
      if (row.source !== 'site' || row.publish) continue;
      expect(existsSync(join(REPO, 'public', row.from)), `${key}: ${row.from}`).toBe(true);
      expect(hullBin(key).byteLength, key).toBe(row.bytes);
    }
  });

  it('every committed site hull sits on its model within 2 %, the way round it is drawn', async () => {
    const galaxy = await importRepo('src/components/galaxy/models.js');
    let n = 0;
    for (const [key, row] of Object.entries(HULLS)) {
      if (row.source !== 'site' || row.publish) continue;
      const kind = key.split('/').pop();
      const nose = key.startsWith('hunter/') ? (galaxy.HUNTER_GLB[kind].nose ?? 0) : key.startsWith('hq/') ? (galaxy.HQ[kind].nose ?? 0) : cutsOf(galaxy, kind)[0].nose;
      const doc = await readGlb(row.from.slice(1));
      const frame = frameOf(doc, nose, kind);
      // (the drawn hull's own part: the war's subsystems sit where the war puts them)
      const { parts, shapes } = readHull(hullBin(key));
      const own = shapes.filter((x) => x.root === 1 && parts[x.part].name === 'hull');
      const { off, face } = offBy(boxOf(own), frame);
      expect(off, `${key}: ${face}`).toBeLessThan(0.02);
      expect(facing(Float32Array.from(own.flatMap((x) => [...x.points])), drawnPoints(doc, frame)).better, key).toBeNull();
      n++;
    }
    expect(n).toBe(18);
  }, 120000);

  it('a kind the game has, drawn on the site’s hull, says why and keeps the game’s property', () => {
    expect(HULLS.interceptor).toMatchObject({ source: 'site', property: 68, publish: true });
    for (const kind of Object.keys(SITE_OVER_GAME)) {
      expect(HULLS[kind].source, kind).toBe('site');
      expect(HULLS[kind].why, kind).toBe(SITE_OVER_GAME[kind]);
    }
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
    // (the fastest of three passes: a shared runner's other workers can steal
    // one pass's time, and it is the hull's speed being held, not the runner's)
    let hits = 0;
    let ms = Infinity;
    for (let pass = 0; pass < 3; pass++) {
      const t = performance.now();
      hits = 0;
      for (const [a, b] of bolts) if (segmentHit(x, p, a, b)) hits++;
      ms = Math.min(ms, performance.now() - t);
    }
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
