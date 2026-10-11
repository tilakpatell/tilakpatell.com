import { Document, NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { asColour, bindSlot, createLevelLoader, gameWordOf, matchRecipes, recipeMaps, recipesIndex } from './levelGltf.js';

// a GLB with one mesh of two primitives, their materials naming the game's
// shaders in their extras as the export writes them
async function glbBytes() {
  const doc = new Document();
  const buf = doc.createBuffer();
  const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])).setBuffer(buf);
  const mesh = doc.createMesh();
  for (const shader of ['Shaders/SS_A', 'Shaders/SS_B']) {
    const mat = doc.createMaterial(shader).setExtras({ shader, textures: {} });
    mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION', pos).setMaterial(mat));
  }
  doc.createScene().addChild(doc.createNode().setMesh(mesh));
  return (await new NodeIO().writeBinary(doc)).buffer;
}

describe('matchRecipes', () => {
  it('matches a GLB material to the first unused recipe of its shader', () => {
    const a = { shader: 'S/A' };
    const a2 = { shader: 'S/A' };
    const lod = { shader: 'S/A_LOD' };
    const b = { shader: 'S/B' };
    expect(matchRecipes(['S/A', 'S/B', 'S/A'], [a, lod, b, a2])).toEqual([a, b, a2]);
  });

  it('falls back to the same index when the GLB names no shader', () => {
    const a = { shader: 'S/A' };
    expect(matchRecipes([null, 'S/X'], [a, { shader: 'S/B' }])).toEqual([a, null]);
  });

  it('never gives one recipe to two materials', () => {
    const a = { shader: 'S/A' };
    const b = { shader: 'S/B' };
    expect(matchRecipes(['S/B', null], [a, b])).toEqual([b, null]);
  });
});

describe('recipeMaps', () => {
  it('resolves the maps of a recipe through the pack: an array to its slices, a missing map to null', async () => {
    const texture = vi.fn(async (path) => ({ path }));
    const recipe = { maps: { detailArray: 'TA_D', aoSlice: 'T_AOSL', weathering: 'T_W', grunge: 'T_G' } };
    const maps = { TA_D: ['tex/ta_d_000.ktx2', 'tex/ta_d_001.ktx2', 'tex/ta_d_002.ktx2'], T_AOSL: 'tex/t_aosl.ktx2', T_W: null };
    const got = await recipeMaps(recipe, { maps, texture, keys: ['detail', 'aoSlice', 'weathering'] });
    expect(got.detailSlices.map((t) => t.path)).toEqual(maps.TA_D);
    expect(got.detail).toBeUndefined();
    expect(got.aoSlice.path).toBe('tex/t_aosl.ktx2');
    expect(got.weathering).toBeNull();
    expect('grunge' in got).toBe(false);
  });

  it('reads a recipe’s emissive map as sRGB whatever its file said, and leaves a data map as it came', async () => {
    const texture = vi.fn(async (path) => Object.assign(new THREE.Texture(), { path }));
    const recipe = { maps: { emissive: 'T_E', detail: 'T_D' } };
    const maps = { T_E: 'tex/t_x_e.ktx2', T_D: 'tex/t_x_ns.ktx2' };
    const got = await recipeMaps(recipe, { maps, texture });
    expect(got.emissive.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(got.detail.colorSpace).toBe(THREE.NoColorSpace);
  });
});

describe('the pack’s word on a map', () => {
  const sizes = { t_kam_wall_01_cs: { high: 1024, srgb: false }, t_crate_01_cs: { high: 512, srgb: true }, t_old_01_c: { high: 512 } };

  it('reads a map as the game reads it, sRGB or linear, and marks the texture so', () => {
    const wall = gameWordOf(new THREE.Texture(), sizes, 'tex/t_kam_wall_01_cs.ktx2');
    expect(wall.colorSpace).toBe(THREE.NoColorSpace);
    expect(wall.userData.gameSrgb).toBe(false);
    const crate = gameWordOf(new THREE.Texture(), sizes, '../tex/t_crate_01_cs.ktx2');
    expect(crate.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(crate.userData.gameSrgb).toBe(true);
    const old = gameWordOf(new THREE.Texture(), sizes, 'tex/t_old_01_c.ktx2');
    expect(old.userData.gameSrgb).toBeUndefined();
    expect(gameWordOf(null, sizes, 'tex/t_old_01_c.ktx2')).toBeNull();
  });

  it('is never overruled by the slot rule or a recipe’s colour key', () => {
    const wall = gameWordOf(new THREE.Texture(), sizes, 'tex/t_kam_wall_01_cs.ktx2');
    const mat = new THREE.MeshStandardMaterial();
    bindSlot(mat, 'map', wall);
    expect(mat.map).toBe(wall);
    expect(wall.colorSpace).toBe(THREE.NoColorSpace);
    expect(asColour(wall, true).colorSpace).toBe(THREE.NoColorSpace);
    // (a map without the word still takes the slot rule)
    const old = gameWordOf(new THREE.Texture(), sizes, 'tex/t_old_01_c.ktx2');
    bindSlot(mat, 'emissiveMap', old);
    expect(old.colorSpace).toBe(THREE.SRGBColorSpace);
  });
});

describe('asColour', () => {
  it('turns a colour map to sRGB once, and passes a data map, a null or a non-texture through', () => {
    const t = new THREE.Texture();
    expect(asColour(t, true)).toBe(t);
    expect(t.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(asColour(new THREE.Texture(), false).colorSpace).toBe(THREE.NoColorSpace);
    expect(asColour(null, true)).toBeNull();
    expect(asColour({ path: 'x' }, true)).toEqual({ path: 'x' });
  });
});

describe('recipesIndex', () => {
  it('gives each of a mesh’s LOD files its recipes, with the maps and their sizes', () => {
    const pack = { meshes: [{ glb: ['meshes/a.lod0.glb', null, 'meshes/a.lod2.glb'] }, { glb: [null] }] };
    const json = { meshes: { 0: [{ shader: 'S' }] }, maps: { D: 'tex/d.ktx2' }, tex: { d: { high: 512 } } };
    const r = recipesIndex(pack, json);
    expect(r.forGlb('meshes/a.lod2.glb')).toEqual([{ shader: 'S' }]);
    expect(r.forGlb('meshes/b.lod0.glb')).toBeNull();
    expect(r.maps).toEqual({ D: 'tex/d.ktx2' });
    expect(r.tex).toEqual({ d: { high: 512 } });
    expect(recipesIndex(pack, null)).toBeNull();
  });
});

describe('createLevelLoader', () => {
  const sizes = {};
  const fetchBytes = async () => glbBytes();

  it('without recipes the GLB keeps its own materials', async () => {
    const loader = createLevelLoader({ world: 'hoth', tier: 'high', renderer: null, fetchBytes, sizes });
    const gltf = await loader.load('meshes/x.lod0.glb');
    const mats = [];
    gltf.scene.traverse((o) => o.isMesh && mats.push(o.material));
    expect(mats.map((m) => m.type)).toEqual(['MeshStandardMaterial', 'MeshStandardMaterial']);
  });

  it('with recipes each material is materialFor’s and the GLB’s is disposed', async () => {
    const made = [];
    const materialFor = vi.fn((recipe, maps) => {
      const m = new THREE.MeshBasicMaterial({ name: `game:${recipe.shader}` });
      m.userData.dispose = vi.spyOn(maps.glb, 'dispose');
      made.push(m);
      return m;
    });
    const recipes = {
      forGlb: (path) => (path === 'meshes/x.lod0.glb' ? [{ shader: 'Shaders/SS_B', maps: {} }, { shader: 'Shaders/SS_A', maps: { detail: 'T_D' } }] : null),
      maps: { T_D: null },
      tex: {},
    };
    const loader = createLevelLoader({ world: 'hoth', tier: 'high', renderer: null, fetchBytes, sizes, recipes, materialFor });
    const gltf = await loader.load('meshes/x.lod0.glb');
    const mats = [];
    gltf.scene.traverse((o) => o.isMesh && mats.push(o.material));
    expect(mats.map((m) => m.name)).toEqual(['game:Shaders/SS_A', 'game:Shaders/SS_B']);
    expect(materialFor).toHaveBeenCalledTimes(2);
    // (a map the pack has not got comes as null)
    expect(materialFor.mock.calls.find(([r]) => r.shader === 'Shaders/SS_A')[1].detail).toBeNull();
    for (const m of made) expect(m.userData.dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps the GLB material where materialFor throws, and the rest swapped', async () => {
    const materialFor = vi.fn((recipe) => {
      if (recipe.shader === 'Shaders/SS_A') throw new Error('bad recipe');
      return new THREE.MeshBasicMaterial({ name: 'game' });
    });
    const recipes = { forGlb: () => [{ shader: 'Shaders/SS_A', maps: {} }, { shader: 'Shaders/SS_B', maps: {} }], maps: {}, tex: {} };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loader = createLevelLoader({ world: 'hoth', tier: 'high', renderer: null, fetchBytes, sizes, recipes, materialFor });
    const gltf = await loader.load('meshes/t.lod0.glb');
    warn.mockRestore();
    const mats = [];
    gltf.scene.traverse((o) => o.isMesh && mats.push(o.material));
    expect(mats.map((m) => m.name)).toEqual(['Shaders/SS_A', 'game']);
  });

  it("draws each mesh in the game's variation: its recipe takes the variation and its own colour map", async () => {
    const materialFor = vi.fn(() => new THREE.MeshBasicMaterial());
    const recipes = { forGlb: () => [{ family: 'props', shader: 'Shaders/SS_A', maps: {} }, { family: 'props', shader: 'Shaders/SS_B', maps: {} }], maps: {}, tex: {} };
    const variation = {
      name: 'Container_L_01_Red',
      defaults: [{ textures: { _CS: 'textures/a_cs.ktx2' } }, { textures: {} }],
      materials: [{ textures: { _CS: 'textures/a_red_cs.ktx2' } }, { textures: {}, vectors: { PaintColour: [1, 0, 0, 1] } }],
    };
    const variations = { forGlb: (path) => (path === 'meshes/v.lod0.glb' ? variation : null), maps: { 'textures/a_red_cs.ktx2': null } };
    const loader = createLevelLoader({ world: 'hoth', tier: 'high', renderer: null, fetchBytes, sizes, recipes, materialFor, variations });
    await loader.load('meshes/v.lod0.glb');
    const byShader = Object.fromEntries(materialFor.mock.calls.map(([r, maps]) => [r.shader, { r, maps }]));
    expect(byShader['Shaders/SS_A'].r.variation.name).toBe('Container_L_01_Red');
    expect(byShader['Shaders/SS_A'].r.maps.color).toBe('textures/a_red_cs.ktx2');
    // (a map the pack has not got comes as null: the GLB's own colour is drawn)
    expect(byShader['Shaders/SS_A'].maps.color).toBeNull();
    expect(byShader['Shaders/SS_B'].r.variation.vectors.PaintColour).toEqual([1, 0, 0, 1]);
    // (another mesh draws its recipes as they are)
    materialFor.mockClear();
    await loader.load('meshes/w.lod0.glb');
    for (const [r] of materialFor.mock.calls) expect(r.variation).toBeUndefined();
  });

  it('hands hair and heads their strand and scattering maps', async () => {
    const materialFor = vi.fn(() => new THREE.MeshBasicMaterial());
    const recipes = { forGlb: () => [{ shader: 'Shaders/SS_A', maps: { hairStrand: 'T_H', sss: 'T_S' } }], maps: { T_H: null, T_S: null }, tex: {} };
    const loader = createLevelLoader({ world: 'hoth', tier: 'high', renderer: null, fetchBytes, sizes, recipes, materialFor });
    await loader.load('meshes/h.lod0.glb');
    const maps = materialFor.mock.calls[0][1];
    expect('hairStrand' in maps && 'sss' in maps).toBe(true);
  });

  it('after dispose a load asks for nothing and gives null', async () => {
    const fetch = vi.fn(fetchBytes);
    const loader = createLevelLoader({ world: 'hoth', tier: 'high', renderer: null, fetchBytes: fetch, sizes });
    await loader.dispose();
    expect(await loader.load('meshes/late.lod0.glb')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches only the maps the tier draws (mapKeys)', async () => {
    const materialFor = vi.fn(() => new THREE.MeshBasicMaterial());
    const recipes = { forGlb: () => [{ shader: 'Shaders/SS_A', maps: { detail: 'T_D', grunge: 'T_G' } }], maps: { T_D: null, T_G: null }, tex: {} };
    const loader = createLevelLoader({ world: 'hoth', tier: 'mid', renderer: null, fetchBytes, sizes, recipes, materialFor, mapKeys: ['detail', 'emissive'] });
    await loader.load('meshes/y.lod0.glb');
    const maps = materialFor.mock.calls[0][1];
    expect('detail' in maps).toBe(true);
    expect('grunge' in maps).toBe(false);
  });
});

describe('a level pack’s textures bound to their materials', () => {
  it('reads a colour or emissive map as sRGB, whatever its file says (the game’s colour maps are BC7_SRGB)', () => {
    const mat = new THREE.MeshStandardMaterial();
    const colour = new THREE.Texture();
    colour.colorSpace = THREE.NoColorSpace; // (a KTX2 labelled linear)
    bindSlot(mat, 'map', colour);
    expect(mat.map).toBe(colour);
    expect(colour.colorSpace).toBe(THREE.SRGBColorSpace);
    const glow = new THREE.Texture();
    bindSlot(mat, 'emissiveMap', glow);
    expect(glow.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('leaves the data maps linear: normals, roughness and metal', () => {
    const mat = new THREE.MeshStandardMaterial();
    const normal = new THREE.Texture();
    const orm = new THREE.Texture();
    bindSlot(mat, 'normalMap', normal);
    bindSlot(mat, 'metalRough', orm);
    expect(normal.colorSpace).toBe(THREE.NoColorSpace);
    expect(mat.roughnessMap).toBe(orm);
    expect(mat.metalnessMap).toBe(orm);
    expect(orm.colorSpace).toBe(THREE.NoColorSpace);
  });
});
