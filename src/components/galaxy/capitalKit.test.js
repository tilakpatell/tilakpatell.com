import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GAME_KITS, MESH_TRIS, PANE_MEAN, WINDOW_HEIGHT, WINDOW_LIGHT, dressGameKit, kitMaterial, kitOf, lodsFor, mapSize, windowsMaterial, withPanes } from './capitalKit';

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
    const kit = GAME_KITS['endor-isd'];
    expect(kitOf('destroyer')).toBe(kit);
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

  it('has Fondor’s as its dry dock stands it, the parts its pack left out from Endor’s', () => {
    const kit = kitOf('fondor-isd');
    expect(kit.level).toBe('sb_fondor');
    expect(kit.anchor).toBe('stardestroyer_hull_01_mesh');
    expect(kit.parts.length).toBeGreaterThan(80);
    const borrowed = kit.parts.filter((p) => p[4]);
    expect(borrowed.length).toBeGreaterThan(0);
    for (const p of borrowed) expect(p[4]).toBe('sb_endor');
    expect(borrowed.some(([mesh]) => /deflectorshield/.test(mesh))).toBe(true);
    for (const [mesh] of kit.parts) expect(kit.lods[mesh], mesh).toBeGreaterThan(0);
    expect(kitOf('venator')).toBeNull();
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

  it('binds a part’s maps as its GLB does, each on its UV set: the colour, the normal, the roughness the ORM’s, its metal where its normal’s set is the ORM’s', () => {
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
    // (the metal where the ORM's blue is laid out on the normal's set, the GLB's factor on it, as the level's own ISDs take it)
    const onOne = { ...PROPS, metallic: 0.8, slots: PROPS.slots.map((x) => ({ ...x, texCoord: 1 })) };
    const metal = kitMaterial(onOne, maps);
    expect(metal.metalnessMap).toBe(metal.roughnessMap);
    // (no more of it than any capital's map keeps: at 1 a ship flared white in the sky's star)
    expect(metal.metalness).toBe(0.2);
    expect(kitMaterial({ ...onOne, metallic: undefined }, maps).metalness).toBe(0.2);
    expect(kitMaterial({ ...onOne, metallic: 0.1 }, maps).metalness).toBe(0.1);
    // (a colour map that didn't come: grey, not white)
    expect(kitMaterial(PROPS, { orm: map(), n: map() }).color.getHex()).not.toBe(0xffffff);
  });

  it('lights the windows on their own UVs’ grid in the game’s warm light, their mean far off', () => {
    const w = kitMaterial({ name: 'M_Windows', roughness: 0.7, slots: [] }, {});
    expect(w.userData.gameHull).toBe(true);
    expect(w.emissive.b).toBeLessThan(w.emissive.r);
    expect(w.emissiveIntensity).toBe(WINDOW_LIGHT.intensity);
    expect(w.defines.USE_UV).toBe('');
    const plain = windowsMaterial({ name: 'M_Windows' });
    const s = compiled(plain);
    expect(s.fragmentShader).toMatch(/vec2 kwCell = vUv \* vec2\( 2\.0, 1\.0 \);/);
    expect(s.fragmentShader).toMatch(/float kwH = texture2D\( kwHeight, vUv \)\.r;/);
    expect(s.fragmentShader).toMatch(/totalEmissiveRadiance \*= mix\( kwOn, kwMean, kwFar \);/);
    // (far off, the heightmap pane's own mean, its recess lit 0.8 at its floor, not the recess's share of the cell)
    expect(PANE_MEAN.height).toBeCloseTo(0.196, 3);
    expect(s.fragmentShader).toContain(`mix( ${PANE_MEAN.plain.toFixed(4)}, 0.1960, kwUse )`);
    // (the plain pane till the game's heightmap comes; then its shape, the same program)
    expect(s.uniforms.kwUse.value).toBe(0);
    const height = map();
    height.image = { width: 512, height: 256 };
    expect(withPanes(plain, height)).toBe(plain);
    expect(s.uniforms.kwHeight.value).toBe(height);
    expect(s.uniforms.kwUse.value).toBe(1);
    // (the blend to the mean where the map's mips still hold the panes: a mip sooner on a phone's 256)
    expect(s.uniforms.kwBlur.value.toArray()).toEqual([0.06, 0.25]);
    const small = map();
    small.image = { width: 256, height: 128 };
    withPanes(plain, small);
    expect(s.uniforms.kwBlur.value.x).toBeCloseTo(0.12, 6);
    expect(withPanes(plain, null)).toBe(plain);
    expect(s.uniforms.kwHeight.value).toBe(small);
  });

  it('asks for the game’s heightmap of the panes once a kit draws windows, and lights them by it', async () => {
    const { root, nose } = cut();
    const windows = { name: 'M_Windows', roughness: 0.7, slots: [] };
    const asked = [];
    const height = map();
    await dressGameKit(root, 'destroyer', {
      loadPart: async () => ({ prims: [PROPS, windows].map((material) => ({ geometry: tri(), matrix: new THREE.Matrix4(), material })) }),
      loadTexture: async (path, size) => (asked.push([path, size]), path === WINDOW_HEIGHT ? height : map()),
    });
    expect(asked.filter(([path]) => path === WINDOW_HEIGHT)).toEqual([[WINDOW_HEIGHT, 512]]);
    const lit = nose.children.find((o) => o.name === 'kit:M_Windows');
    expect(lit.material.userData.panes.height.value).toBe(height);
    expect(lit.material.userData.panes.use.value).toBe(1);
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
    // (and the hull's own GLB's, at its own place: what it holds beside the hull)
    expect(kitMeshes[0].geometry.getAttribute('position').count).toBe(3 * (GAME_KITS['endor-isd'].parts.length + 1));
    expect(urls).toContain('stardestroyer_hull_01_sb_endor_mesh.lod0.glb');
    expect(kitMeshes[0].geometry.getAttribute('tangent')).toBeTruthy();
    // (the tower's first corner where the level stands it)
    const at = 1 + GAME_KITS['endor-isd'].parts.findIndex(([m]) => m === 'stardestroyer_communicationstower_01_mesh');
    expect(kitMeshes[0].geometry.getAttribute('position').getY(3 * at)).toBeCloseTo(288.59, 1);
    expect(asked).toContainEqual(['cs', 512]);
  });

  it('joins a material’s parts into meshes of no more than MESH_TRIS triangles, every part whole in one', async () => {
    const { root, nose } = cut();
    // (a part of 300 triangles: 84 of them over the cap)
    const big = () => {
      const g = tri().toNonIndexed();
      const n = 300;
      for (const name of ['position', 'normal', 'tangent', 'uv', 'uv1']) {
        const a = g.getAttribute(name);
        const array = new Float32Array(a.array.length * n);
        for (let i = 0; i < n; i++) array.set(a.array, i * a.array.length);
        g.setAttribute(name, new THREE.BufferAttribute(array, a.itemSize));
      }
      return g;
    };
    await dressGameKit(root, 'destroyer', {
      loadPart: async () => ({ prims: [{ geometry: big(), matrix: new THREE.Matrix4(), material: PROPS }] }),
      loadTexture: async () => map(),
    });
    const kit = nose.children.filter((o) => o.name.startsWith('kit:'));
    const parts = GAME_KITS['endor-isd'].parts.length + 1;
    expect(kit.length).toBe(Math.ceil(parts / Math.floor(MESH_TRIS / 300)));
    for (const o of kit) expect(o.geometry.index.count / 3).toBeLessThanOrEqual(MESH_TRIS);
    expect(kit.reduce((n, o) => n + o.geometry.index.count / 3, 0)).toBe(300 * parts);
    // (one material for them all)
    expect(new Set(kit.map((o) => o.material)).size).toBe(1);
  });

  it('lights a normal on the unique set through that set’s own frame, not the parts’ tangents; leaves out the hull’s own and its damage plane', async () => {
    const { root, nose } = cut();
    const onUnique = { name: 'M_PanelTile', roughness: 1, slots: [{ slot: 'map', slug: 'cs', texCoord: 1 }, { slot: 'normalMap', slug: 'n', texCoord: 1 }] };
    const hullOwn = { name: 'M_Hull_01', roughness: 0.7, slots: [] };
    const damage = { name: 'Burning', roughness: 1, slots: [{ slot: 'map', slug: 'scorch' }] };
    const asked = [];
    await dressGameKit(root, 'destroyer', {
      loadPart: async () => ({ prims: [onUnique, hullOwn, damage].map((material) => ({ geometry: tri(), matrix: new THREE.Matrix4(), material })) }),
      loadTexture: async (path) => (asked.push(path.split('/').pop()), map()),
    });
    const kit = nose.children.filter((o) => o.name.startsWith('kit:'));
    expect(kit.map((o) => o.name)).toEqual(['kit:M_PanelTile']);
    expect(kit[0].geometry.getAttribute('tangent')).toBeUndefined();
    expect(kit[0].material.normalScale.y).toBe(-1);
    expect(asked).not.toContain('scorch');
  });

  it('takes a borrowed part, and its maps, from its own pack', async () => {
    const { root } = cut();
    const urls = [];
    const asked = [];
    const ok = await dressGameKit(root, 'fondor-isd', {
      loadPart: async (url) => (urls.push(url), part()),
      loadTexture: async (path) => (asked.push(path), map()),
    });
    expect(ok).toBe(true);
    const [dome] = kitOf('fondor-isd').parts.filter((p) => p[4] && /deflectorshield/.test(p[0]));
    expect(urls.some((u) => u.includes(`/sb_endor/meshes/${dome[0]}.lod`))).toBe(true);
    expect(urls.some((u) => u.includes('/sb_fondor/meshes/stardestroyer_hull_01_mesh.lod0'))).toBe(true);
    // (the one material, a mesh for each pack's maps)
    expect(asked.filter((p) => p.endsWith('/cs')).sort()).toEqual(['/models/galaxy/bf2017/levels/sb_endor/tex/cs', '/models/galaxy/bf2017/levels/sb_fondor/tex/cs']);
    expect(root.getObjectByName('nose').children.filter((o) => o.name.startsWith('kit:'))).toHaveLength(2);
  });

  it('leaves the cut as it came when a part or a colour map can’t be had, at the lowest detail, and for a kind with no kit', async () => {
    const { root, tower } = cut();
    expect(await dressGameKit(root, 'destroyer', { loadPart: async (url) => (url.includes('communicationstower') ? null : part()), loadTexture: async () => map() })).toBe(false);
    expect(await dressGameKit(root, 'destroyer', { loadPart: async () => part(), loadTexture: async (path) => (path.endsWith('/cs') ? null : map()) })).toBe(false);
    expect(await dressGameKit(root, 'destroyer', { detail: 'low', loadPart: async () => part(), loadTexture: async () => map() })).toBe(false);
    expect(await dressGameKit(root, 'venator', { loadPart: async () => part(), loadTexture: async () => map() })).toBe(false);
    expect(tower.parent).not.toBeNull();
  });
});
