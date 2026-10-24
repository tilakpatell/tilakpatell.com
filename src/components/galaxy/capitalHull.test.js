import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GAME_HULLS, dressGameHull, hullMaterial, inFrame, sizesFor } from './capitalHull';

// a texture as the loader gives one (the sheets tile)
const map = () => new THREE.Texture();
const sheets = () => ({ atlas: map(), orm: map(), panels: map(), panelsNormal: map(), details: map(), detailsNormal: map() });
// a material as three compiles it
const compiled = (m) => {
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  m.onBeforeCompile(shader);
  return shader;
};
// a ship as models.js has it before it's fitted: its hull bare, a part beside it
const ship = () => {
  const root = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshStandardMaterial({ name: 'M_Hull_01_lods' }));
  hull.position.set(0, 0.5, 0);
  hull.scale.setScalar(0.5);
  const part = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ name: 'M_Details_lods', map: map() }));
  root.add(hull, part);
  return { root, hull, part };
};
// the pack's hull: quantized as its GLB is (whole-number positions its node's scale makes metres)
const packHull = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Uint16Array([0, 0, 0, 100, 0, 0, 0, 100, 0]), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Int16Array([0, 0, 32767, 0, 0, 32767, 0, 0, 32767]), 3, true));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 25, 0, 0, 25]), 2));
  g.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1]), 2));
  return { geometry: g, matrix: new THREE.Matrix4().makeScale(0.02, 0.02, 0.02) };
};

describe('capitalHull', () => {
  it('names the Star Destroyer’s hull in the space level’s pack, its map and the game’s sheets', () => {
    const d = GAME_HULLS.destroyer;
    expect(d.material.test('M_Hull_01_lods')).toBe(true);
    expect(d.material.test('M_Hull_lods')).toBe(false);
    expect(d.mesh).toMatch(/levels\/sb_endor\/meshes\/stardestroyer_hull_01_sb_endor_mesh\.lod0\.glb$/);
    expect(d.atlas.colour).toMatch(/t_stardestroyer_hull_01_cs$/);
    expect(d.panels.colour).toMatch(/t_stardestroyerpanels_01_cs$/);
    expect(d.details.normal).toMatch(/t_stardestroyerdetails_01_nw__normal$/);
  });

  it('takes the sheets whole on a computer at mid and up, smaller on a phone, and the hull’s map alone at the lowest detail', () => {
    for (const detail of ['mid', 'high', 'ultra']) expect(sizesFor(detail).colour, detail).toBe(2048);
    expect(sizesFor('mid', true)).toEqual({ atlas: 1024, orm: 512, colour: 1024, normal: 512 });
    expect(sizesFor('low')).toEqual({ atlas: 512, orm: 0, colour: 0, normal: 0 });
    expect(sizesFor('ultra').atlas).toBe(2048);
  });

  it('paints the hull’s map on UV1 and lays the sheets on UV0, their colour by their mean and the details’ relief over the panels’', () => {
    const maps = sheets();
    const m = hullMaterial(maps, GAME_HULLS.destroyer);
    expect(m.userData.gameHull).toBe(true);
    expect(m.metalness).toBe(0);
    expect([maps.atlas.channel, maps.orm.channel, maps.panelsNormal.channel]).toEqual([1, 1, 0]);
    expect(m.normalMap).toBe(maps.panelsNormal);
    expect(m.customProgramCacheKey()).toBe('|gamehull');
    const s = compiled(m);
    expect(s.uniforms.uGhDetails.value).toBe(maps.details);
    expect(s.fragmentShader).toMatch(/diffuseColor\.rgb \*= clamp\( ghPanel \* ghDetail, 0\.0, 2\.0 \)/);
    expect(s.fragmentShader).toMatch(/texture2D\( uGhDetails, vNormalMapUv \* 4\.0000 \)/);
    expect(s.fragmentShader).toMatch(/#include <normal_fragment_maps>/); // (three's own, for any other case)
    expect(s.fragmentShader).toMatch(/mapN = normalize\( vec3\( mapN\.xy \+ ghDn\.xy/);
  });

  it('draws the hull’s map alone where the sheets aren’t to be had', () => {
    const m = hullMaterial({ atlas: map(), orm: null }, GAME_HULLS.destroyer);
    expect(m.normalMap).toBeNull();
    expect(Object.hasOwn(m, 'customProgramCacheKey')).toBe(false); // (three's own program: no patch)
  });

  it('widens a quantized mesh to floats before moving it into another frame', () => {
    const { geometry, matrix } = packHull();
    const to = new THREE.Matrix4().makeScale(0.5, 0.5, 0.5);
    const g = inFrame(geometry, matrix, to);
    expect(g.attributes.position.array).toBeInstanceOf(Float32Array);
    // (100 × 0.02 = 2 metres, in a frame of halves: 4)
    expect(g.attributes.position.getX(1)).toBeCloseTo(4, 6);
    expect(g.attributes.normal.getZ(0)).toBeCloseTo(1, 4);
    expect(Array.from(g.attributes.uv1.array)).toEqual(Array.from(geometry.attributes.uv1.array));
    expect(geometry.attributes.position.array).toBeInstanceOf(Uint16Array); // (the pack's own left as it was)
  });

  it('puts the pack’s hull in the bare one’s place, in its frame, and leaves the rest of the ship alone', async () => {
    const { root, hull, part } = ship();
    const partMaterial = part.material;
    const asked = [];
    const ok = await dressGameHull(root, 'destroyer', { detail: 'high', loadMesh: async () => packHull(), loadTexture: async (path, size) => (asked.push([path.split('/').pop(), size]), map()) });
    expect(ok).toBe(true);
    expect(hull.material.userData.gameHull).toBe(true);
    expect(part.material).toBe(partMaterial);
    // (the pack's corner at 2 m on x, in the hull's frame of halves, 4)
    expect(hull.geometry.attributes.position.getX(1)).toBeCloseTo(4, 6);
    expect(asked).toContainEqual(['t_stardestroyerpanels_01_cs', 2048]);
  });

  it('leaves the ship as it came when the pack’s hull or its map can’t be had, and a kind it has none for', async () => {
    const { root, hull } = ship();
    const before = hull.material;
    expect(await dressGameHull(root, 'destroyer', { loadMesh: async () => null, loadTexture: async () => map() })).toBe(false);
    expect(await dressGameHull(root, 'destroyer', { loadMesh: async () => packHull(), loadTexture: async () => null })).toBe(false);
    expect(await dressGameHull(root, 'xwing')).toBe(false);
    expect(hull.material).toBe(before);
  });

  it('asks the lowest detail for the hull’s map alone', async () => {
    const { root, hull } = ship();
    const asked = [];
    await dressGameHull(root, 'destroyer', { detail: 'low', loadMesh: async () => packHull(), loadTexture: async (path) => (asked.push(path.split('/').pop()), map()) });
    expect(asked).toEqual(['t_stardestroyer_hull_01_cs']);
    expect(hull.material.normalMap).toBeNull();
  });
});
