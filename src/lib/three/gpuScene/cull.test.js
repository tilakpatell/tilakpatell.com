import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { NONE, cameraOf, chooseFile, cullCpu, meshTable, planesOf, sphereRect } from './cull.js';
import { ROW_U32, packInstances } from './pack.js';
import { reduceDepth } from './hzb.js';
import { createGpuScene } from './scene.js';
import { lodIndex } from './lodRule.js';

const W = 64;
const H = 64;
// the camera at the origin looking down −z, WebGPU's depth range
function cam(pos = [0, 0, 0], at = [0, 0, -1]) {
  const c = new THREE.PerspectiveCamera(60, W / H, 0.5, 2000);
  c.coordinateSystem = THREE.WebGPUCoordinateSystem;
  c.position.set(...pos);
  c.lookAt(...at);
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  return cameraOf(c, W, H);
}

// two meshes: a 1 m crate (three LOD files, the middle one not loaded yet) and a 4 m hut
const PACK = {
  meshes: [
    { radius: 1, bounds: [-1, -1, -1, 1, 1, 1], lods: [4000, 1200, 300], glb: ['crate0.glb', 'crate1.glb', 'crate2.glb'] },
    { radius: 4, bounds: [-4, 0, -4, 4, 8, 4], lods: [9000], glb: ['hut.glb'] },
  ],
};

function world(rows, { loaded = ['crate0.glb', 'crate2.glb', 'hut.glb'], tier = 'ultra' } = {}) {
  const scene = createGpuScene({ capacity: 16 });
  const out = new Uint32Array(rows.length * ROW_U32);
  packInstances(rows.map((r) => ({ quaternion: [0, 0, 0, 1], scale: [1, 1, 1], ...r })), out);
  const range = scene.append(out, rows.length);
  const table = meshTable(PACK, tier, { mirrored: new Set([0]) });
  for (const glb of loaded) table.load(glb);
  return { scene, table, range };
}

describe('planesOf and sphereRect', () => {
  it('keeps a sphere in front and drops one behind the camera', () => {
    const c = cam();
    const planes = planesOf(c.viewProj);
    const inside = (p, r) => planes.every(([a, b, cc, d]) => a * p[0] + b * p[1] + cc * p[2] + d >= -r);
    expect(inside([0, 0, -10], 1)).toBe(true);
    expect(inside([0, 0, 10], 1)).toBe(false);
    expect(inside([0, 0, 0.4], 1)).toBe(true); // (it reaches over the near plane, at 0.5)
  });

  it('gives a sphere’s screen rect in pixels and its nearest depth, none when it crosses the near plane', () => {
    const c = cam();
    const s = sphereRect([0, 0, -10], 1, c);
    expect(s.rect.x0).toBeLessThan(W / 2);
    expect(s.rect.x1).toBeGreaterThan(W / 2);
    expect(s.near).toBeGreaterThan(0);
    expect(s.near).toBeLessThan(1);
    const far = sphereRect([0, 0, -100], 1, c);
    expect(far.near).toBeGreaterThan(s.near);
    expect(far.rect.x1 - far.rect.x0).toBeLessThan(s.rect.x1 - s.rect.x0);
    expect(sphereRect([0, 0, -0.8], 1, c)).toBe(null);
  });
});

describe('chooseFile (Review Focus 2)', () => {
  const loaded = (set) => (k) => set.has(k);
  it('the wanted file when it is loaded', () => expect(chooseFile(1, NONE, loaded(new Set([0, 1, 2])))).toBe(1));
  it('else the one drawn last frame, so nothing blinks while a file comes', () => expect(chooseFile(1, 0, loaded(new Set([0, 2])))).toBe(0));
  it('else the nearest coarser one loaded, then the nearest finer', () => {
    expect(chooseFile(1, NONE, loaded(new Set([0, 2])))).toBe(2);
    expect(chooseFile(2, NONE, loaded(new Set([0])))).toBe(0);
    expect(chooseFile(1, NONE, loaded(new Set()))).toBe(NONE);
  });
});

describe('cullCpu', () => {
  it('passes everything in view when there is no pyramid (Review Focus 4), and drops what is behind', () => {
    const { scene, table } = world([
      { position: [0, 0, -10], mesh: 0 },
      { position: [3, 0, -30], mesh: 1 },
      { position: [0, 0, 40], mesh: 0 },
    ]);
    const r = cullCpu({ scene, table, camera: cam(), tier: 'ultra' });
    expect(r.stats).toEqual({ tested: 3, culled: 1, occluded: 0, drawn: 2 });
    expect([...r.lists.values()].flat().sort()).toEqual([0, 1]);
  });

  it('culls a sphere behind a wall and keeps one in front of it', () => {
    const c = cam();
    // the wall: the depth of a plane at 20 m over the whole screen
    const wallDepth = sphereRect([0, 0, -21], 1, c).near;
    const depth = new Float32Array(W * H).fill(wallDepth);
    const mips = reduceDepth(depth, W, H);
    const { scene, table } = world([
      { position: [0, 0, -10], mesh: 0 },
      { position: [0, 0, -60], mesh: 0 },
      { position: [0, 0, -20.5], mesh: 0 }, // (through the wall's plane: its front pokes out)
    ]);
    const r = cullCpu({ scene, table, camera: c, tier: 'ultra', hzb: mips });
    expect([...r.lists.values()].flat().sort()).toEqual([0, 2]);
    expect(r.stats.occluded).toBe(1);
  });

  it('skips dead rows', () => {
    const { scene, table, range } = world([
      { position: [0, 0, -10], mesh: 0 },
      { position: [0, 0, -12], mesh: 0 },
    ]);
    scene.free({ start: range.start + 1, count: 1 });
    const r = cullCpu({ scene, table, camera: cam(), tier: 'ultra' });
    expect(r.stats.tested).toBe(1);
    expect([...r.lists.values()].flat()).toEqual([0]);
  });

  it('cuts the LOD as lodAt does, and holds a row at a loaded file while its own comes', () => {
    const at = (z) => cam([0, 0, z], [0, 0, z - 100]);
    const rows = [1.2, 5, 10].map((d) => ({ position: [0, 0, -d], mesh: 0 }));
    const all = world(rows, { loaded: ['crate0.glb', 'crate1.glb', 'crate2.glb'] });
    const r = cullCpu({ scene: all.scene, table: all.table, camera: at(0), tier: 'ultra' });
    // (the radius lodAt reads is the pack's, scaled by the row's largest axis)
    [1.2, 5, 10].forEach((d, i) => expect(r.lods[i]).toBe(all.table.fileOf(0, lodIndex(d, 1, PACK.meshes[0].lods, 'ultra'))));
    expect(Array.from(r.lods)).toEqual([0, 1, 2]);
    // the middle file not loaded: a row drawn at file 0 stays there as it steps back
    const part = world([{ position: [0, 0, -1.2], mesh: 0 }]);
    const first = cullCpu({ scene: part.scene, table: part.table, camera: at(0), tier: 'ultra' });
    expect(first.lods[0]).toBe(0);
    const held = cullCpu({ scene: part.scene, table: part.table, camera: at(3.8), tier: 'ultra', state: first.state });
    expect(held.lods[0]).toBe(0);
    // with nothing drawn before it, the nearest coarser file
    expect(cullCpu({ scene: part.scene, table: part.table, camera: at(3.8), tier: 'ultra' }).lods[0]).toBe(2);
  });

  it('draws a mirrored row from the mirrored key (its copy wound the other way)', () => {
    const { scene, table } = world([{ position: [0, 0, -10], mesh: 0, scale: [-1, 1, 1], mirrored: true }]);
    const r = cullCpu({ scene, table, camera: cam(), tier: 'ultra' });
    const [key] = [...r.lists.keys()];
    expect(table.keyInfo(key).mirrored).toBe(true);
  });

  it('lists a row in both files for 0.3 s after its LOD changes, then in its new one only', () => {
    const { scene, table } = world([{ position: [0, 0, -10], mesh: 0 }], { loaded: ['crate0.glb', 'crate1.glb', 'crate2.glb'] });
    const near = cullCpu({ scene, table, camera: cam([0, 0, -9], [0, 0, -1000]), tier: 'ultra', now: 0 });
    const far = cullCpu({ scene, table, camera: cam([0, 0, 200], [0, 0, -1000]), tier: 'ultra', now: 1, state: near.state });
    expect(far.lods[0]).not.toBe(near.lods[0]);
    expect(far.lists.size).toBe(2);
    const later = cullCpu({ scene, table, camera: cam([0, 0, 200], [0, 0, -1000]), tier: 'ultra', now: 1.31, state: far.state });
    expect(later.lists.size).toBe(1);
  });

  it('keeps every caster within the shadow reach, in view or not, occluded or not', () => {
    const { scene, table } = world([
      { position: [0, 0, 30], mesh: 1 }, // behind the camera, 30 m off
      { position: [0, 0, 600], mesh: 1 }, // behind, past the reach
    ]);
    const r = cullCpu({ scene, table, camera: cam(), tier: 'ultra', shadowReach: 260 });
    expect(r.stats).toMatchObject({ culled: 2, drawn: 0 });
    expect([...r.shadow.values()].flat()).toEqual([0]);
  });

  it('drops what lies past K radii, as seenAt does', () => {
    const { scene, table } = world([{ position: [0, 0, -50], mesh: 0 }]);
    const r = cullCpu({ scene, table, camera: cam(), tier: 'ultra', K: 10 });
    expect(r.stats.culled).toBe(1);
  });
});
