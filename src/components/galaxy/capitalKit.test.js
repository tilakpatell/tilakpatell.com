import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GAME_KITS, WINDOW_LIGHT, dressGameKit, kitMaterial, lodsFor, mapSize, windowsMaterial } from './capitalKit';

const map = () => new THREE.Texture();
const compiled = (m) => {
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  m.onBeforeCompile(shader);
  return shader;
};
// a part as the pack's GLB gives it: one triangle a material, in metres, both UV sets and tangents
const tri = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  g.setAttribute('tangent', new THREE.BufferAttribute(new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]), 4));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2));
  g.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(6), 2));
  return g;
};
const PROPS = { name: 'M_StarDestroyer_CommunicationsTower_01', roughness: 1, slots: [{ slot: 'map', slug: 'cs', texCoord: 1 }, { slot: 'metalRough', slug: 'orm', texCoord: 1 }, { slot: 'normalMap', slug: 'n', texCoord: 0 }] };
const part = () => ({ prims: [{ geometry: tri(), matrix: new THREE.Matrix4(), material: PROPS }] });
// the cut as models.js has it: its parts under `nose`, the hull among them
const cut = () => {
  const root = new THREE.Group();
  const nose = new THREE.Group();
  nose.name = 'nose';
  const hull = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'M_Hull_01_lods' }));
  const tower = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'm_DetailsCommandBridge_03_lods', map: map() }));
  nose.add(hull, tower);
  root.add(nose);
  return { root, nose, hull, tower };
};

describe('capitalKit', () => {
  it('has the Star Destroyer’s kit as Endor’s level stands it round its hull, the hull left to capitalHull.js', () => {
    const kit = GAME_KITS.destroyer;
    expect(kit.level).toBe('sb_endor');
    expect(kit.anchor).toBe('stardestroyer_hull_01_sb_endor_mesh');
    expect(kit.parts.length).toBeGreaterThan(80);
    expect(kit.parts.some(([mesh]) => mesh === kit.anchor)).toBe(false);
    // (the bridge tower 288 m up and 549 m aft of the hull's middle, as the level has it)
    const tower = kit.parts.find(([mesh]) => mesh === 'stardestroyer_communicationstower_01_mesh');
    expect(tower[1][1]).toBeCloseTo(288.59, 1);
    expect(tower[1][2]).toBeCloseTo(-548.64, 1);
    for (const [mesh] of kit.parts) expect(kit.lods[mesh], mesh).toBeGreaterThan(0);
    expect(kit.tex.t_stardestroyer_communicationstower_01_cs).toEqual({ low: 512, mid: 1024, high: 1024, ultra: 2048 });
  });

  it('draws the superstructure a LOD finer than the rest, coarser down the tiers, the cut at the lowest detail', () => {
    expect(lodsFor('ultra')).toEqual([1, 2]);
    expect(lodsFor('high')).toEqual([2, 3]);
    expect(lodsFor('mid')).toEqual([3, 4]);
    expect(lodsFor('high', true)).toEqual([4, 5]);
    expect(lodsFor('low')).toBeNull();
  });

  it('takes the pack’s row for a map’s size, a roughness no finer than 512', () => {
    const row = { low: 256, mid: 512, high: 512, ultra: 2048 };
    expect(mapSize(row, 't_x_nam__normal', 'ultra')).toBe(2048);
    expect(mapSize(row, 't_x_nam__orm_811c28a1', 'ultra')).toBe(512);
    expect(mapSize(undefined, 't_x_cs', 'high')).toBe(512);
  });

  it('binds a part’s maps as its GLB does, each on its UV set: the colour, the normal, the roughness the ORM’s, a dielectric', () => {
    const maps = { cs: map(), orm: map(), n: map() };
    const m = kitMaterial(PROPS, maps);
    expect(m.userData.gameHull).toBe(true);
    expect(m.map.channel).toBe(1);
    expect(m.map.source).toBe(maps.cs.source); // (a copy on the other set, its image the same)
    expect(m.normalMap).toBe(maps.n);
    expect(m.roughnessMap.channel).toBe(1);
    expect(m.roughness).toBe(1);
    expect(m.metalness).toBe(0);
    expect(m.metalnessMap).toBeNull();
    // (a colour map that didn't come: grey, not white)
    expect(kitMaterial(PROPS, { orm: map(), n: map() }).color.getHex()).not.toBe(0xffffff);
  });

  it('lights the windows on their own UVs’ grid in the game’s warm light, their mean far off', () => {
    const w = kitMaterial({ name: 'M_Windows', roughness: 0.7, slots: [] }, {});
    expect(w.userData.gameHull).toBe(true);
    expect(w.emissive.b).toBeLessThan(w.emissive.r);
    expect(w.emissiveIntensity).toBe(WINDOW_LIGHT.intensity);
    expect(w.defines.USE_UV).toBe('');
    const s = compiled(windowsMaterial({ name: 'M_Windows' }));
    expect(s.fragmentShader).toMatch(/vec2 kwCell = vUv \* vec2\( 2\.0, 1\.0 \);/);
    expect(s.fragmentShader).toMatch(/totalEmissiveRadiance \*= mix\( kwOn, kwMean, smoothstep\( 0\.35, 1\.0, length\( fwidth\( kwCell \) \) \) \);/);
  });

  it('puts the kit’s parts in the cut’s place, a material a mesh, the cut’s own parts gone and its hull kept', async () => {
    const { root, nose, hull, tower } = cut();
    const urls = [];
    const asked = [];
    const ok = await dressGameKit(root, 'destroyer', {
      detail: 'high',
      loadPart: async (url) => (urls.push(url.split('/').pop()), part()),
      loadTexture: async (path, size) => (asked.push([path.split('/').pop(), size]), map()),
    });
    expect(ok).toBe(true);
    expect(tower.parent).toBeNull();
    expect(hull.parent).toBe(nose);
    // (the tower at the superstructure's LOD, a side part at the rest's)
    expect(urls).toContain('stardestroyer_communicationstower_01_mesh.lod2.glb');
    expect(urls).toContain('stardestroyer_detailsside_03_mesh.lod3.glb');
    // (the windows' mesh has a LOD0 alone)
    expect(urls).toContain('stardestroyer_windows_01_mesh.lod0.glb');
    // (every part one triangle here, all one material: one mesh, every placement in it)
    const kitMeshes = nose.children.filter((o) => o.name.startsWith('kit:'));
    expect(kitMeshes).toHaveLength(1);
    expect(kitMeshes[0].geometry.getAttribute('position').count).toBe(3 * GAME_KITS.destroyer.parts.length);
    expect(kitMeshes[0].geometry.getAttribute('tangent')).toBeTruthy();
    // (the tower's first corner where the level stands it)
    const at = GAME_KITS.destroyer.parts.findIndex(([m]) => m === 'stardestroyer_communicationstower_01_mesh');
    expect(kitMeshes[0].geometry.getAttribute('position').getY(3 * at)).toBeCloseTo(288.59, 1);
    expect(asked).toContainEqual(['cs', 512]);
  });

  it('leaves the cut as it came when a part can’t be had, at the lowest detail, and for a kind with no kit', async () => {
    const { root, tower } = cut();
    expect(await dressGameKit(root, 'destroyer', { loadPart: async (url) => (url.includes('communicationstower') ? null : part()), loadTexture: async () => map() })).toBe(false);
    expect(await dressGameKit(root, 'destroyer', { detail: 'low', loadPart: async () => part(), loadTexture: async () => map() })).toBe(false);
    expect(await dressGameKit(root, 'venator', { loadPart: async () => part(), loadTexture: async () => map() })).toBe(false);
    expect(tower.parent).not.toBeNull();
  });
});
