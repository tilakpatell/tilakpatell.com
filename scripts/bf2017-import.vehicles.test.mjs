import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NATIVE_VEHICLE, VEHICLE, farCut, vehicleCuts } from './bf2017-import.mjs';
import { CAST, importArgs } from './bf2017-vehicles.mjs';
import { MODELS as SURFACE } from '../src/components/galaxy/surface/catalog/bf2017-vehicles.js';

// Lane V's flags on the 2017 import (docs/superpowers/plans/
// 2026-10-10-bf2017-phaseV-vehicles.md): a walker's far cut, a rigid walker
// bound to its game skeleton, a cockpit stood in its hull's frame. A scratch
// drop, no network.

const reader = async () => {
  await MeshoptDecoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
};

// a box from lo to hi, as a primitive
function box(doc, buffer, lo, hi) {
  const [a, b, c] = lo;
  const [x, y, z] = hi;
  const p = [a, b, c, x, b, c, x, y, c, a, y, c, a, b, z, x, b, z, x, y, z, a, y, z];
  const f = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  return doc.createPrimitive().setAttribute('POSITION', acc('VEC3', new Float32Array(p))).setIndices(acc('SCALAR', new Uint16Array(f)));
}

// a rigid walker (a body on a leg, two pieces) at two LODs, a cockpit inside
// its body, and its skeleton's one clip (Reference → AITrajectory → Hips →
// Leg → Foot)
async function walkerDrop() {
  const root = await mkdtemp(join(tmpdir(), 'bf2017-walker-'));
  const io = new NodeIO();
  const model = async (name, pieces) => {
    const doc = new Document();
    const buffer = doc.createBuffer();
    const mesh = doc.createMesh();
    for (const [lo, hi] of pieces) mesh.addPrimitive(box(doc, buffer, lo, hi));
    doc.createScene().addChild(doc.createNode(name.split('/').pop()).setMesh(mesh));
    await mkdir(join(root, 'web/models', name, '..'), { recursive: true });
    await writeFile(join(root, `web/models/${name}.glb`), await io.writeBinary(doc));
  };
  const WALKER = 'gameplay/vehicles/ground/test/walker_mesh';
  const COCKPIT = 'gameplay/vehicles/ground/test/walker_cockpit_mesh';
  const body = [
    [-1, 2, -1],
    [1, 3, 1],
  ];
  const leg = [
    [-0.2, 0, -0.2],
    [0.2, 1.9, 0.2],
  ];
  await model(WALKER, [body, leg]);
  await model(`${WALKER}_lod1`, [body, leg]);
  await model(COCKPIT, [
    [
      [-0.5, 2.2, 0],
      [0.5, 2.8, 0.9],
    ],
  ]);
  const entry = (name, lods) => ({ name, file: `models/${name}.glb`, min: [-1, 0, -1], max: [1, 3, 1], lods: lods.map((l, i) => ({ lod: i, file: `models/${l}.glb`, triangles: 24 - i })) });
  const rows = [entry(WALKER, [WALKER, `${WALKER}_lod1`]), { ...entry(COCKPIT, [COCKPIT]), min: [-0.5, 2.2, 0], max: [0.5, 2.8, 0.9] }];
  await writeFile(join(root, 'web/models.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  // the skeleton's clip: its nodes at rest
  const skel = new Document();
  skel.createBuffer();
  const n = (name, t) => skel.createNode(name).setTranslation(t);
  const [ref, traj, hips, legN, foot] = [n('Reference', [0, 0, 0]), n('AITrajectory', [0, 0, 0]), n('Hips', [0, 2.5, 0]), n('Leg', [0, -0.6, 0]), n('Foot', [0, -1.9, 0])];
  skel.createScene().addChild(ref);
  ref.addChild(traj);
  traj.addChild(hips);
  hips.addChild(legN);
  legN.addChild(foot);
  await mkdir(join(root, 'web/anims/test_ske'), { recursive: true });
  await writeFile(join(root, 'web/anims/test_ske/c_test_walk.glb'), await io.writeBinary(skel));
  await writeFile(join(root, 'web/anims.jsonl'), JSON.stringify({ name: 'C_Test_Walk', file: 'anims/test_ske/c_test_walk.glb', skeleton: 'Test/Test_Ske' }) + '\n');
  return { root, WALKER, COCKPIT };
}

async function scratch() {
  const dir = await mkdtemp(join(tmpdir(), 'bf2017-vehicle-'));
  await writeFile(join(dir, 'cat.js'), 'export const MODELS = {};\n');
  await writeFile(join(dir, 'credits.json'), '{}\n');
  return dir;
}
const run = (root, dir, name, kind, more) => execFileSync('node', ['scripts/bf2017-import.mjs', name, '--root', root, '--kind', kind, '--as', 'a test', '--out', dir, '--catalog', join(dir, 'cat.js'), '--credits', join(dir, 'credits.json'), ...more], { encoding: 'utf8' });

describe('the 2017 import, for vehicles', () => {
  // (lane S1: the galaxy's Scimitar and TIE striker, through lane V's path,
  // the drop's model and its maps in three cuts, over their Meshy remakes)
  it('lists the Scimitar and the TIE striker among the fighters, native with their three cuts, and the catalogue has their rows', () => {
    const rows = Object.fromEntries(CAST.filter((r) => ['scimitar', 'tiestriker'].includes(r[0])).map((r) => [r[0], r]));
    expect(rows.scimitar.slice(1, 3)).toEqual(['air', 'gameplay/vehicles/air/scimitar/vehicle_air_scimitar_static_donotuse_mesh']);
    expect(rows.tiestriker.slice(1, 3)).toEqual(['air', 'gameplay/vehicles/air/tiestriker/tiestriker_01_static_mesh']);
    for (const row of Object.values(rows)) {
      const a = importArgs(row);
      for (const flag of ['--vehicle', '--native', '--far', '--ultra']) expect(a, row[0]).toContain(flag);
      expect(SURFACE[row[0]], row[0]).toMatchObject({ made: 'bf2017', native: true, far: true, lod: true, from: row[2] });
      expect(SURFACE[row[0]].ultra?.tris, row[0]).toBeGreaterThanOrEqual(SURFACE[row[0]].tris); // (the striker's plain cut is its LOD0 already, 45,482 triangles)
    }
  });

  it('cuts far at the chain’s first LOD under 1,000 triangles, else its last', () => {
    const chain = (tris) => ({ lods: tris.map((t, lod) => ({ lod, triangles: t })) });
    expect(farCut(chain([108400, 50954, 25158, 12866, 6840, 870])).lod).toBe(5);
    expect(farCut(chain([116141, 61901, 20863, 9727, 4740, 1032])).lod).toBe(5);
    expect(farCut(chain([17206, 8393, 940, 400])).lod).toBe(2);
    expect(VEHICLE).toEqual({ plainMax: 25000, lod1Max: 7000, farMax: 1000 });
  });

  it('takes a native vehicle’s plain cut at the game’s first LOD under 60,000 triangles, and its ultra at LOD0 whatever it is', () => {
    const chain = (tris) => ({ lods: tris.map((t, lod) => ({ lod, triangles: t })) });
    const xwing = chain([82340, 36843, 17601, 6918, 3498, 568]);
    const tie = chain([57264, 28509, 14169, 7083, 2558, 856]);
    expect(NATIVE_VEHICLE.plainMax).toBe(60000);
    expect(vehicleCuts(xwing, { native: true, ultra: true })).toMatchObject({ plain: { lod: 1 }, lod1: { lod: 3 }, ultra: { lod: 0 } });
    expect(vehicleCuts(tie, { native: true, ultra: true })).toMatchObject({ plain: { lod: 0 }, lod1: { lod: 4 }, ultra: { lod: 0 } });
    expect(vehicleCuts(tie, { native: true }).ultra).toBe(null);
    // (the WebP cuts, for what isn't native, as they were)
    expect(vehicleCuts(xwing).plain.lod).toBe(2);
  });

  it('binds a rigid walker to its game skeleton, every bone kept, each vertex to one, and cuts it far without a skin', { timeout: 15000 }, async () => {
    const { root, WALKER } = await walkerDrop();
    const dir = await scratch();
    const said = run(root, dir, WALKER, 'walkertest', ['--vehicle', '--far', '--cuts', 'plain=0,far=1', '--bind', 'Test/Test_Ske']);
    expect(said).toMatch(/bound to its skeleton: \d+ vertices to 3 bones \(5 nodes, 2 of them the game's helpers\)/);
    const doc = await (await reader()).read(join(dir, 'surface', 'walkertest.glb'));
    const r = doc.getRoot();
    const names = r.listNodes().map((x) => x.getName());
    for (const b of ['Reference', 'AITrajectory', 'Hips', 'Leg', 'Foot']) expect(names).toContain(b);
    const skin = r.listSkins()[0];
    expect(skin.listJoints().map((j) => j.getName())).toEqual(['Hips', 'Leg', 'Foot']);
    const prims = r.listMeshes().flatMap((m) => m.listPrimitives());
    const w = [];
    for (const p of prims) {
      const weights = p.getAttribute('WEIGHTS_0');
      for (let v = 0; v < weights.getCount(); v++) expect(weights.getElement(v, w)[0]).toBeCloseTo(1);
    }
    const far = await (await reader()).read(join(dir, 'surface', 'walkertest.far.glb'));
    expect(far.getRoot().listSkins().length).toBe(0);
    const row = (await readFile(join(dir, 'cat.js'), 'utf8')).split('\n').find((l) => l.startsWith('  walkertest: '));
    expect(row).toContain('rig: true');
    expect(row).toContain('far: true');
  });

  it('stands a cockpit in its hull’s frame and says it lies inside', { timeout: 15000 }, async () => {
    const { root, WALKER, COCKPIT } = await walkerDrop();
    const dir = await scratch();
    const said = run(root, dir, COCKPIT, 'walkertestcockpit', ['--hull-frame', WALKER]);
    expect(said).toMatch(/inside walker_mesh: yes/);
    const doc = await (await reader()).read(join(dir, 'surface', 'walkertestcockpit.glb'));
    const { min, max } = (await import('./lib/surface-model.mjs')).bounds(doc, doc.getRoot().listScenes()[0]);
    // (where it is in the hull, not stood on the ground itself)
    expect(min[1]).toBeCloseTo(2.2, 2);
    expect(max[2]).toBeCloseTo(0.9, 2);
    const row = (await readFile(join(dir, 'cat.js'), 'utf8')).split('\n').find((l) => l.startsWith('  walkertestcockpit: '));
    expect(row).toContain(`hull: '${WALKER}'`);
    expect(existsSync(join(dir, 'surface', 'walkertestcockpit.far.glb'))).toBe(false);
  });
});
