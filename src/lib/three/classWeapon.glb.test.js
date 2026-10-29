// The class weapons' committed light cuts, against their records: small,
// held by a `grip` at the game's origin (Wep_Root), the barrel along +z, and
// the muzzle the record names just inside the barrel's end (the research's
// gaps, 0.001 to 0.085 m, measured on these cuts).
import { statSync } from 'node:fs';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import HELD from '../../data/bf2017/held.json';
import { glbJson, parseGlb } from './fixtures/glb.js';
import { weaponUrl } from './classWeapon.js';

const IDS = Object.keys(HELD.rows);
const file = (id) => `public${weaponUrl(id)}`;
const got = {};
beforeAll(async () => {
  for (const id of IDS) got[id] = await parseGlb(file(id));
}, 30000);

describe('the class weapons’ light cuts', () => {
  it('are the eight Hoth class weapons', () => {
    expect(IDS.sort()).toEqual(['a280', 'dh17', 'dlt19', 'dlt19x', 'dlt20a', 'e11', 'rk3', 'rt97c']);
  });
  it.each(IDS)('%s is at most 300 KB', (id) => {
    expect(statSync(file(id)).size).toBeLessThanOrEqual(300 * 1024);
  });
  it.each(IDS)('%s is held by its grip at the game’s origin', (id) => {
    const grip = got[id].scene.getObjectByName('grip');
    expect(grip).toBeTruthy();
    expect(grip.position.length()).toBeLessThan(1e-6);
  });
  // (the game's Walrus weapon preset: metal from the NAM's blue and
  // smoothness from the colour's alpha on one ORM, no occlusion, and a
  // reflectance of 0.5, which is F0 0.04: glTF's own dielectric, so three
  // lights it as a MeshStandardMaterial would, whatever the loader makes)
  it.each(IDS)('%s carries the game’s channels: an ORM, no occlusion, F0 0.04', (id) => {
    const json = glbJson(file(id));
    for (const m of json.materials) {
      // (a scope's glass carries no maps at all)
      if (m.pbrMetallicRoughness?.baseColorTexture) {
        expect(m.pbrMetallicRoughness.metallicRoughnessTexture, m.name).toBeTruthy();
        expect(m.pbrMetallicRoughness.metallicFactor ?? 1, m.name).toBe(1); // × the map
      }
      expect(m.occlusionTexture, m.name).toBeUndefined();
      expect(m.extensions?.KHR_materials_specular, m.name).toBeUndefined();
    }
    got[id].scene.traverse((o) => {
      if (!o.isMesh) return;
      const mat = o.material;
      const ior = mat.ior ?? 1.5;
      const f0 = ((ior - 1) / (ior + 1)) ** 2 * (mat.specularIntensity ?? 1);
      expect(f0, mat.name).toBeCloseTo(0.04, 3);
    });
  });
  it.each(IDS)('%s has its muzzle just inside the barrel’s end, along +z', (id) => {
    const box = new THREE.Box3().setFromObject(got[id].scene);
    const [x, y, z] = HELD.rows[id].muzzle;
    const gap = box.max.z - z;
    expect(gap, `${id}: ${gap.toFixed(3)} m`).toBeGreaterThan(-0.005);
    expect(gap).toBeLessThan(0.09);
    expect(box.max.z).toBeGreaterThan(-box.min.z);
    expect(x).toBeGreaterThan(box.min.x);
    expect(x).toBeLessThan(box.max.x);
    expect(y).toBeGreaterThan(box.min.y);
    expect(y).toBeLessThan(box.max.y);
  });
});
