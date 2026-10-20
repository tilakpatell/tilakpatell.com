import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import * as THREE from 'three';
import { HERDS, createHerd, herdSpots } from './herds';
import { LIFE, lifeOf } from './stages/life';
import { STAGES } from './stages/index';
import { roadFor } from './terrain';
import { distanceTo } from '../../../lib/land/paths.js';
import { PACK } from './pack';

// a beast as a loader gives one: a mesh 2 units tall standing on y = 0, an Idle clip
const beast = () => {
  const scene = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial({ color: 0x804020 }));
  mesh.position.y = 1;
  mesh.name = 'body';
  scene.add(mesh);
  // (a sway that keeps the feet where they are: the body widening and back)
  const idle = new THREE.AnimationClip('Idle', 2, [new THREE.NumberKeyframeTrack('body.scale[x]', [0, 1, 2], [1, 1.2, 1])]);
  return { scene, animations: [idle] };
};

describe('herds at graze', () => {
  it('each beast its own spot, the same for the same seed, never where it may not stand', () => {
    const away = (x) => x < 0;
    const a = herdSpots({ count: 6, at: [0, 0], spread: 8, seed: 3, away });
    expect(a).toEqual(herdSpots({ count: 6, at: [0, 0], spread: 8, seed: 3, away }));
    expect(a.length).toBeGreaterThan(3);
    for (const s of a) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(8);
    }
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) expect(Math.hypot(a[i].x - a[j].x, a[i].z - a[j].z)).toBeGreaterThanOrEqual(1.6);
  });

  it('a herd stands its beasts at their height on the ground, casting, and plays their idle', async () => {
    const herd = createHerd({ load: async () => beast(), kind: 'cow', count: 3, at: [10, 10], spread: 4, coat: 0xffffff, heightAt: () => 2 });
    expect(await herd.ready).toBe(true);
    expect(herd.group.children).toHaveLength(3);
    for (const m of herd.group.children) {
      const box = new THREE.Box3().setFromObject(m);
      expect(box.min.y).toBeCloseTo(2, 5);
      expect(box.max.y - box.min.y).toBeGreaterThan(HERDS.cow.height * 0.85);
      expect(box.max.y - box.min.y).toBeLessThan(HERDS.cow.height * 1.15);
      m.traverse((o) => o.isMesh && expect(o.castShadow).toBe(true));
    }
    // (the coat on the herd's own material, the loader's left as it was)
    const body = herd.group.children[0].getObjectByName('body');
    expect(body.material.color.r).toBeGreaterThan(0.85);
    const was = body.scale.x;
    herd.tick(0.5);
    expect(body.scale.x).not.toBe(was);
    herd.dispose();
    expect(herd.group.parent).toBe(null);
  });

  it('nothing without a loader or a kind it knows', async () => {
    expect(await createHerd({ load: null, kind: 'cow', at: [0, 0] }).ready).toBe(false);
    expect(await createHerd({ load: async () => beast(), kind: 'mumak', at: [0, 0] }).ready).toBe(false);
  });

  it('the stages’ herds: kinds the farm pack has, in the Road’s pack, off the road', () => {
    expect(lifeOf('nowhere').herds).toEqual([]);
    for (const def of Object.values(HERDS)) {
      expect(existsSync(`public${def.url}`), def.url).toBe(true);
      expect(PACK.urls, def.url).toContain(def.url);
    }
    for (const [id, life] of Object.entries(LIFE)) {
      expect(STAGES.map((s) => s.id)).toContain(id);
      for (const h of life.herds ?? []) {
        expect(HERDS[h.kind], `${id}: ${h.kind}`).toBeTruthy();
        expect(h.count, id).toBeGreaterThan(0);
        expect(h.count, id).toBeLessThanOrEqual(8);
        // (its middle well off the road: the beasts keep to the fields)
        expect(distanceTo(roadFor(id))(h.at[0], h.at[1]), `${id}: ${h.kind}`).toBeGreaterThan(h.spread + 6);
      }
    }
  });
});
