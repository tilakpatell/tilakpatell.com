// The command, run: the same file in gives the same bytes out, and what it
// writes is a body the site's own loader takes (src/lib/three/walrus.js).
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseGlb } from '../src/components/battlefront/figures/fixtures/glb.js';
import { usedJoints } from '../src/lib/three/skinPrune.js';
import { clearGLTFCache } from '../src/lib/three/gltfCache.js';
import { loadWalrusBody } from '../src/lib/three/walrus.js';
import { BODY, SOCKETS } from '../src/lib/three/walrusRig.js';
import { glbJson } from './lib/bf2017-paths.mjs';
import { guestRow, rigGuest, sourceOf } from './guest-rig.mjs';

let dir;
let made;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'guest-rig-'));
  made = [await rigGuest('rick', { out: join(dir, 'a'), log: () => {} }), await rigGuest('rick', { out: join(dir, 'b'), log: () => {} })];
}, 60000);
afterAll(() => {
  clearGLTFCache();
  rmSync(dir, { recursive: true, force: true });
});

describe('scripts/guests.json', () => {
  it('has a row a person, each with its bodies’ files, its host hero and a grip placed by hand', () => {
    for (const who of ['rick', 'morty']) {
      const row = guestRow(who);
      expect(row.who).toBe(who);
      expect(Object.keys(row.bodies)).toContain(who);
      expect(row.grip.length).toBe(3);
      expect(row.source).toBe('hand');
      expect(typeof row.host).toBe('string');
    }
    expect(sourceOf('rick', 'rick')).toBe('public/games/meshy/rick.glb');
    expect(() => guestRow('nobody')).toThrow(/nobody/);
    expect(() => sourceOf('rick', 'nothing')).toThrow(/nothing/);
  });
});

describe('node scripts/guest-rig.mjs rick', () => {
  it('writes the same bytes twice', () => {
    const [a, b] = made.map((m) => readFileSync(m.file));
    expect(a.length).toBeGreaterThan(100000);
    expect(a.equals(b)).toBe(true);
  });

  it('writes the body under its Wardrobe id, in metres, with no scale on any node', () => {
    expect(made[0].file.replace(/\\/g, '/')).toMatch(/\/a\/rick\.glb$/);
    const json = glbJson(readFileSync(made[0].file));
    expect(json.scenes[0].nodes.map((i) => json.nodes[i].name).sort()).toEqual(['Reference', 'rick']);
    for (const n of json.nodes) expect(n.scale, n.name).toBeUndefined();
    expect(json.nodes.length).toBe(257);
    expect(json.animations).toBeUndefined();
    // (the source's one picture, as the source has it)
    const source = glbJson(readFileSync('public/games/meshy/rick.glb'));
    expect(json.images.length).toBe(1);
    expect(json.images[0].mimeType).toBe(source.images[0].mimeType);
    expect(json.bufferViews[json.images[0].bufferView].byteLength).toBe(source.bufferViews[source.images[0].bufferView].byteLength);
  });

  it('is a body the site’s loader takes: the game’s rig whole, its sockets found', async () => {
    const loader = { loadAsync: (url) => parseGlb(url) };
    const { model, sockets } = await loadWalrusBody(made[0].file, { packs: [], loader });
    for (const k of Object.keys(SOCKETS)) expect(sockets[k]?.name, k).toBe(SOCKETS[k]);
    const meshes = [];
    model.traverse((o) => o.isSkinnedMesh && meshes.push(o));
    expect(meshes.length).toBe(1);
    const bones = meshes[0].skeleton.bones.map((b) => b.name);
    for (const n of [...BODY, 'head_end', 'headfront']) expect(bones).toContain(n);
    // (what pruneSkin would leave: the joints its vertices use)
    expect(usedJoints(meshes[0].geometry).length).toBeLessThan(60);
    // it stands on the ground at its own height, as the loader poses it
    model.updateMatrixWorld(true);
    meshes[0].skeleton.update();
    const box = new THREE.Box3();
    const p = new THREE.Vector3();
    const at = meshes[0].geometry.attributes.position;
    for (let v = 0; v < at.count; v += 7) box.expandByPoint(meshes[0].getVertexPosition(v, p).applyMatrix4(meshes[0].matrixWorld));
    expect(Math.abs(box.min.y)).toBeLessThan(0.01);
    expect(Math.abs(box.max.y - 1.8)).toBeLessThan(0.02);
    expect(made[0].measured.height).toBeCloseTo(1.8, 2);
  });
});
