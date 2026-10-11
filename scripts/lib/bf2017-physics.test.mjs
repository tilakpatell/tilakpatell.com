import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { cellIndex, packShapes, physicsKey, readPhysicsGlb, readShapes, reduceHull, summarise } from './bf2017-physics.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'bf2017', 'physics');
const glb = (name) => readFileSync(join(DIR, `${name}_Physics_Win32.glb`));
const records = new Map(
  readFileSync(join(DIR, 'physics.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .map((r) => [r.name.split('/').pop().replace(/_Physics_Win32$/, ''), r]),
);

describe('readPhysicsGlb', () => {
  it('reads the snow pile as one hull the size its record says (the quantisation undone)', async () => {
    const rec = records.get('Arctic_CorridorSnowPile_01');
    const { shapes, dropped } = await readPhysicsGlb(glb('Arctic_CorridorSnowPile_01'), rec);
    expect(dropped).toEqual([]);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].kind).toBe('hull');
    expect(shapes[0].material).toBe(28);
    const { bounds } = summarise(shapes);
    for (let k = 0; k < 3; k++) {
      expect(Math.abs(bounds.min[k] - rec.min[k])).toBeLessThan(0.01);
      expect(Math.abs(bounds.max[k] - rec.max[k])).toBeLessThan(0.01);
    }
  });

  it("keeps a compound's convex root and its mesh root (statics take both)", async () => {
    const { shapes, dropped } = await readPhysicsGlb(glb('DecalPlane256_01'));
    expect(shapes.map((s) => s.kind)).toEqual(['hull', 'hull', 'mesh']);
    expect(shapes.every((s) => s.material === 107)).toBe(true);
    expect(shapes[2].indices.length).toBe(24);
    expect(dropped).toEqual([]);
  });

  it('drops a 0xFFFF0000 mesh root when asked, saying why', async () => {
    const { shapes, dropped } = await readPhysicsGlb(glb('DecalPlane256_01'), null, { dropVisual: true });
    expect(shapes.map((s) => s.kind)).toEqual(['hull', 'hull']);
    expect(dropped).toEqual([{ node: 'r1_p0_mesh', why: expect.stringMatching(/visual only/) }]);
  });

  it("reads a capsule's ends and radius from its tessellation", async () => {
    const rec = records.get('TRL_BeamWood_01_A_1024');
    const { shapes } = await readPhysicsGlb(glb('TRL_BeamWood_01_A_1024'), rec);
    expect(shapes).toHaveLength(1);
    const c = shapes[0];
    expect(c.kind).toBe('capsule');
    expect(c.radius).toBeCloseTo(0.1744, 3);
    // (a beam along z: its ends a radius inside the record's box)
    expect(Math.min(c.a[2], c.b[2])).toBeCloseTo(rec.min[2] + c.radius, 2);
    expect(Math.max(c.a[2], c.b[2])).toBeCloseTo(rec.max[2] - c.radius, 2);
    expect(c.a[0]).toBeCloseTo((rec.min[0] + rec.max[0]) / 2, 2);
  });

  // (Naboo_03's streets have a collision mesh of more points than a call may
  // take as arguments: spread into push, it threw "Maximum call stack size exceeded")
  it('reads a mesh leaf of 200,000 points', async () => {
    const doc = new Document();
    const n = 200000;
    const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array(n * 3).map((_, i) => i % 7)).setBuffer(doc.createBuffer());
    const prim = doc.createPrimitive().setAttribute('POSITION', pos);
    const leaf = doc.createNode('big').setMesh(doc.createMesh().addPrimitive(prim)).setExtras({ kind: 'mesh' });
    doc.createScene().addChild(doc.createNode('root').addChild(leaf));
    const { shapes } = await readPhysicsGlb(await new NodeIO().writeBinary(doc));
    expect(shapes).toHaveLength(1);
    expect(shapes[0].points.length).toBe(n * 3);
    expect(shapes[0].indices.length).toBe(n);
  });

  it('reads a hull and a capsule out of one compound', async () => {
    const { shapes } = await readPhysicsGlb(glb('SD_HullDetailPiece_02'));
    expect(shapes.map((s) => s.kind).sort()).toEqual(['capsule', 'hull']);
  });
});

describe('reduceHull', () => {
  it('cuts 200 points to 64 and keeps the box within 2%', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const pts = new Float32Array(600);
    for (let i = 0; i < 200; i++) {
      pts[i * 3] = rnd() * 2;
      pts[i * 3 + 1] = rnd();
      pts[i * 3 + 2] = rnd() * 3;
    }
    const vol = (p) => {
      const { bounds } = summarise([{ kind: 'hull', part: 0, points: p }]);
      return bounds.max.reduce((a, v, k) => a * (v - bounds.min[k]), 1);
    };
    const out = reduceHull(pts, 64);
    expect(out.length).toBe(64 * 3);
    expect(Math.abs(vol(out) - vol(pts)) / vol(pts)).toBeLessThan(0.02);
  });

  it('leaves a small hull as it is', () => {
    expect(reduceHull(new Float32Array([0, 0, 0, 1, 1, 1]))).toEqual(new Float32Array([0, 0, 0, 1, 1, 1]));
  });
});

describe('the bin', () => {
  it('round-trips every kind', () => {
    const shapes = [
      { kind: 'hull', part: 1, material: 14, root: 0, points: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]) },
      { kind: 'mesh', part: 0, material: 45, root: 1, points: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), indices: new Uint32Array([0, 2, 1]) },
      { kind: 'capsule', part: 2, material: 0, root: 0, a: [0, 0.5, 0], b: [0, 1.5, 0], radius: 0.25 },
      { kind: 'sphere', part: 0, material: 3, root: 2, centre: [1, 2, 3], radius: 0.5 },
    ];
    const back = readShapes(packShapes(shapes));
    expect(back).toHaveLength(4);
    expect(back[0]).toMatchObject({ kind: 'hull', part: 1, material: 14, root: 0 });
    expect([...back[0].points]).toEqual([...shapes[0].points]);
    expect([...back[1].indices]).toEqual([0, 2, 1]);
    expect(back[2]).toMatchObject({ kind: 'capsule', a: [0, 0.5, 0], b: [0, 1.5, 0], radius: 0.25 });
    expect(back[3]).toMatchObject({ kind: 'sphere', centre: [1, 2, 3], radius: 0.5 });
  });

  it('refuses what is not a shapes bin', () => {
    expect(() => readShapes(new ArrayBuffer(16))).toThrow(/not a shapes bin/);
  });

  it('round-trips the snow pile read from its GLB', async () => {
    const { shapes } = await readPhysicsGlb(glb('Arctic_CorridorSnowPile_01'));
    const back = readShapes(packShapes(shapes));
    expect(summarise(back).bounds).toEqual(summarise(shapes).bounds);
  });
});

describe('the pack', () => {
  it("names a map model's physics record", () => {
    expect(physicsKey('models/objects/architecture/hoth/corridorsystem_01/new/arctic_corridorsnowpile_01_mesh.glb')).toBe(
      'objects/architecture/hoth/corridorsystem_01/new/arctic_corridorsnowpile_01_physics_win32',
    );
  });

  it('puts four instances in their cells with their counts', () => {
    const cells = {
      '0,0': { draws: [{ mesh: 0, count: 2 }, { mesh: 2, count: 1 }] },
      '1,0': { draws: [{ mesh: 1, count: 1 }, { mesh: 0, count: 1 }] },
      '2,2': { draws: [{ mesh: 2, count: 5 }] },
    };
    const physics = { 0: { colliders: 1, meshTriangles: 0 }, 1: { colliders: 3, meshTriangles: 40 } };
    const index = cellIndex(cells, physics);
    expect(Object.keys(index)).toEqual(['0,0', '1,0']);
    expect(index['0,0']).toEqual({ colliders: 2, instances: [{ mesh: '0', count: 2 }], triangles: 0 });
    expect(index['1,0']).toEqual({ colliders: 4, instances: [{ mesh: '1', count: 1 }, { mesh: '0', count: 1 }], triangles: 40 });
  });
});
