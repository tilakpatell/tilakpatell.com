import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KIT_KINDS, dressKit } from './spaceKits';
import { createSpacePieces } from './spacePieces';

// a kit as the space level's file has it: in metres, its bow to −z (a
// Venator's), a bare hull and an engine at its stern
const kit = () => {
  const scene = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(500, 100, 1100), new THREE.MeshStandardMaterial({ name: 'M_VenatorStarDestroyer_Hull_01_lods' }));
  hull.position.set(0, 60, -10);
  const engine = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 40, 12).rotateX(Math.PI / 2).translate(0, 60, 560), new THREE.MeshStandardMaterial({ name: 'M_VenatorStarDestroyer_Engine_01_lods', map: new THREE.Texture() }));
  scene.add(hull, engine);
  return { scene };
};
const corners = (o) => {
  o.updateMatrixWorld(true);
  const out = [];
  o.traverse((m) => m.isMesh && !m.userData.glows && out.push(new THREE.Box3().setFromObject(m).min.toArray().map((v) => Math.round(v * 1000) / 1000)));
  return out;
};

describe('spaceKits', () => {
  it('knows the kind and the turn of every capital kit the space levels place', () => {
    for (const [slug, [kind, turn]] of Object.entries(KIT_KINDS)) {
      expect(typeof kind, slug).toBe('string');
      expect(Number.isFinite(turn), slug).toBe(true);
    }
    expect(KIT_KINDS['endor-isd'][0]).toBe('destroyer');
    expect(KIT_KINDS['kamino-venator'][1]).toBeCloseTo(Math.PI, 6);
  });

  it('dresses the Republic’s Arquitens as the war’s, with its own game hull', async () => {
    const asked = [];
    const stub = (what) => async (root, kind) => (asked.push([what, kind]), false);
    for (const slug of ['naboo-jedicruiser', 'kamino-jedicruiser']) await dressKit(kit(), slug, { hull: stub('hull'), maps: stub('maps') });
    expect(asked).toEqual([['hull', 'jedicruiser'], ['maps', 'lightcruiser'], ['hull', 'jedicruiser'], ['maps', 'lightcruiser']]);
  });

  it('draws a kit the pack has whole as its own level stands it, any other by its kind', async () => {
    const asked = [];
    const parts = async (root, key) => (asked.push(key), false);
    const stub = async () => false;
    for (const slug of ['fondor-isd', 'endor-isd', 'naboo-jedicruiser']) await dressKit(kit(), slug, { hull: stub, maps: stub, parts });
    expect(asked).toEqual(['fondor-isd', 'endor-isd', 'jedicruiser']);
  });

  it('dresses a kit as the war’s ship of its kind, and hands it back where the level stood it', async () => {
    const gltf = kit();
    const asked = [];
    const stub = async (root, kind) => (asked.push(kind), false);
    const dressed = await dressKit(gltf, 'kamino-venator', { detail: 'high', phone: false, aniso: 4, hull: stub, maps: stub });
    expect(asked).toEqual(['venator', 'venator']);
    // (the same place to the millimetre, the cache's own untouched)
    expect(corners(dressed)).toEqual(corners(gltf.scene));
    const meshes = [];
    dressed.traverse((o) => o.isMesh && !o.userData.glows && meshes.push(o));
    const hull = meshes.find((m) => /Hull/.test(m.material.name));
    const engine = meshes.find((m) => /Engine/.test(m.material.name));
    expect(hull.material.userData.plated).toBe(true);
    expect(gltf.scene.children[0].material.userData.plated).toBeUndefined();
    // (its engine alight aft: the stern, at +z in the kit, is the stern in the ship's frame)
    expect(engine.material.userData.burning).toBe(true);
    let glows = 0;
    dressed.traverse((o) => o.userData.glows && (glows += 1));
    expect(glows).toBe(1);
    expect(hull.castShadow && hull.receiveShadow).toBe(true);
    // (a kit it has no kind for: as it came)
    const plain = await dressKit(kit(), 'debrisfield-02', { hull: stub, maps: stub });
    plain.traverse((o) => o.isMesh && expect(o.material.userData.plated).toBeUndefined());
  });

  it('draws a level’s capitals as the dresser hands them, once a file', async () => {
    const files = [];
    const load = async () => kit();
    const dress = async (gltf, slug) => {
      files.push(slug);
      const g = new THREE.Group();
      g.userData.dressed = slug;
      return g;
    };
    const level = createSpacePieces('endor', { detail: 'high', load, dress });
    await level.ready;
    const shown = [];
    level.group.traverse((o) => o.userData.dressed && shown.push(o.userData.dressed));
    expect(new Set(files).size).toBe(files.length);
    expect(files).toContain('endor-isd');
    expect(shown).toContain('endor-isd');
    level.dispose();
  });
});
