import { Document, NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WasmError } from '../../../../lib/wasm/load.js';
import { asColour, BARE, bareGlb, bindSlot, colourByName, createLevelLoader, gameWordOf, matchRecipes, recipeMaps, recipesIndex, sharpenPack } from './levelGltf.js';

// the KTX2 loader the pack's maps come through, as a test sets it (no
// transcoder here: a test that names no map never asks)
const ktx2 = vi.hoisted(() => ({ up: () => Promise.reject(new Error('no KTX2 loader in this test')) }));
vi.mock('../../../../lib/three/gltf.js', async (importOriginal) => ({ ...(await importOriginal()), ktx2Loader: () => ktx2.up() }));

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

// that GLB with its materials naming colour maps as the export writes them,
// beside the meshes (`maps`: a material's index → its KTX2), and the
// materials `twoSided` two-sided
async function glbNaming(maps, twoSided = []) {
  const bytes = new Uint8Array(await glbBytes());
  const len = new DataView(bytes.buffer).getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + len)));
  json.images = [];
  json.textures = [];
  for (const [i, uri] of Object.entries(maps)) {
    json.images.push({ uri, mimeType: 'image/ktx2' });
    json.textures.push({ source: json.images.length - 1 });
    json.materials[i].pbrMetallicRoughness = { ...json.materials[i].pbrMetallicRoughness, baseColorTexture: { index: json.textures.length - 1 } };
  }
  for (const i of twoSided) json.materials[i].doubleSided = true;
  const raw = new TextEncoder().encode(JSON.stringify(json));
  const text = new Uint8Array(Math.ceil(raw.length / 4) * 4).fill(0x20);
  text.set(raw);
  const rest = bytes.subarray(20 + len);
  const out = new Uint8Array(20 + text.length + rest.length);
  out.set(bytes.subarray(0, 20));
  const o = new DataView(out.buffer);
  o.setUint32(8, out.length, true);
  o.setUint32(12, text.length, true);
  out.set(text, 20);
  out.set(rest, 20 + text.length);
  return out.buffer;
}

// a KTX2 loader whose maps load, but for those named `bad` (a 404)
const some = async () => ({
  loadAsync: async (url) => {
    if (url.includes('bad')) throw new Error(`404 ${url}`);
    return new THREE.Texture();
  },
});

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
  const sizes = { t_kam_wall_01_cs: { high: 1024, srgb: false }, t_crate_01_cs: { high: 512, srgb: true }, t_old_01_c: { high: 512 }, t_lamp_01_m: { high: 256, srgb: false } };

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

  it('is overruled in a colour slot only for a map whose name says colour (the 2026-10-11 amendment)', () => {
    // (Theed’s brick, t_naboo_bricks_05_cs, the game stores BC7_UNORM: read
    // linear in the map slot it drew the palace near black, 30 32 31, and
    // read sRGB its cream stone, 210 217 213)
    const brick = gameWordOf(new THREE.Texture(), sizes, 'tex/t_kam_wall_01_cs.ktx2');
    expect(brick.colorSpace).toBe(THREE.NoColorSpace);
    const mat = new THREE.MeshStandardMaterial();
    bindSlot(mat, 'map', brick);
    expect(mat.map).toBe(brick);
    expect(brick.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(asColour(gameWordOf(new THREE.Texture(), sizes, 'tex/t_kam_wall_01_cs.ktx2'), true).colorSpace).toBe(THREE.SRGBColorSpace);
    // (in a data slot the word stands)
    const data = gameWordOf(new THREE.Texture(), sizes, 'tex/t_kam_wall_01_cs.ktx2');
    bindSlot(mat, 'normalMap', data);
    expect(data.colorSpace).toBe(THREE.NoColorSpace);
    expect(asColour(gameWordOf(new THREE.Texture(), sizes, 'tex/t_kam_wall_01_cs.ktx2'), false).colorSpace).toBe(THREE.NoColorSpace);
    // (a map no colour suffix names keeps the word, in a colour slot too: a mask the emissive slot holds)
    const mask = gameWordOf(new THREE.Texture(), sizes, 'tex/t_lamp_01_m.ktx2');
    bindSlot(mat, 'emissiveMap', mask);
    expect(mask.colorSpace).toBe(THREE.NoColorSpace);
    // (a map without the word still takes the slot rule)
    const old = gameWordOf(new THREE.Texture(), sizes, 'tex/t_old_01_c.ktx2');
    bindSlot(mat, 'emissiveMap', old);
    expect(old.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('knows a colour map by DICE’s suffixes, a numbered one and a derived map apart', () => {
    for (const slug of ['t_kam_wall_01_cs', 't_x_c', 't_x_ca', 't_x_cw', 't_nabboocopperroof_cs_01']) expect(colourByName(slug), slug).toBe(true);
    for (const slug of ['t_x_cs__orm_04e5dd3e', 't_x_n__normal', 't_x_m', 't_x_nam', 't_concrete', 't_x_e']) expect(colourByName(slug), slug).toBe(false);
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

describe('the baked bounce on the game materials (lane N3)', () => {
  // two primitives: the first with a second uv set (TEXCOORD_1), the second without
  async function glbUv1() {
    const doc = new Document();
    const buf = doc.createBuffer();
    const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])).setBuffer(buf);
    const uv = doc.createAccessor().setType('VEC2').setArray(new Float32Array([0, 0, 1, 0, 0, 1])).setBuffer(buf);
    const mesh = doc.createMesh();
    for (const [shader, uv1] of [['Shaders/SS_A', true], ['Shaders/SS_B', false]]) {
      const prim = doc.createPrimitive().setAttribute('POSITION', pos).setAttribute('TEXCOORD_0', uv).setMaterial(doc.createMaterial(shader).setExtras({ shader, textures: {} }));
      if (uv1) prim.setAttribute('TEXCOORD_1', uv);
      mesh.addPrimitive(prim);
    }
    doc.createScene().addChild(doc.createNode().setMesh(mesh));
    return (await new NodeIO().writeBinary(doc)).buffer;
  }
  const recipes = { forGlb: () => [{ shader: 'Shaders/SS_A', maps: {} }, { shader: 'Shaders/SS_B', maps: {} }], maps: {}, tex: {} };
  const materialFor = (recipe) => Object.assign(new THREE.MeshBasicMaterial({ name: recipe.shader }), { isNodeMaterial: true });

  it('only a mesh with TEXCOORD_1 and a chart takes the atlas; the one without keeps the probe term', async () => {
    const applied = [];
    const baked = { chartOf: (glb) => (glb === 'meshes/x.lod0.glb' ? [1, 1, 0, 0] : null) };
    const applyBaked = async (m, chart) => applied.push([m.name, chart]);
    const loader = createLevelLoader({ world: 'hoth', tier: 'high', renderer: null, fetchBytes: glbUv1, sizes: {}, recipes, materialFor, baked, applyBaked });
    await loader.load('meshes/x.lod0.glb');
    expect(applied).toEqual([['Shaders/SS_A', [1, 1, 0, 0]]]);
  });
  it('no chart for the mesh (lane Q3’s probe has not found them), or no atlas: nothing is applied', async () => {
    const applied = [];
    const applyBaked = async (m) => applied.push(m.name);
    await createLevelLoader({ world: 'hoth', tier: 'high', renderer: null, fetchBytes: glbUv1, sizes: {}, recipes, materialFor, baked: { chartOf: () => null }, applyBaked }).load('meshes/x.lod0.glb');
    await createLevelLoader({ world: 'hoth', tier: 'high', renderer: null, fetchBytes: glbUv1, sizes: {}, recipes, materialFor, baked: null, applyBaked }).load('meshes/y.lod0.glb');
    expect(applied).toEqual([]);
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

describe('a material that names no colour map', () => {
  const piece = (mat) => new THREE.Mesh(new THREE.BufferGeometry(), mat);
  it('takes a two-sided card out of the scene and makes a solid piece grey, not white', () => {
    const card = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
    const plate = new THREE.MeshStandardMaterial();
    const scene = new THREE.Group().add(piece(card), piece(plate));
    expect(bareGlb(scene, (m) => [card, plate].indexOf(m), new Set())).toBe(1);
    expect(scene.children.map((o) => o.material)).toEqual([plate]);
    expect(plate.color.getHex()).toBe(BARE);
  });

  it('leaves a material that named one, got one, or is coloured by its vertices', () => {
    const named = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }); // (its map not in the bucket: lod upTo's)
    const mapped = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    const painted = new THREE.MeshStandardMaterial({ vertexColors: true });
    const scene = new THREE.Group().add(piece(named), piece(mapped), piece(painted));
    expect(bareGlb(scene, (m) => [named, mapped, painted].indexOf(m), new Set([0]))).toBe(0);
    expect(scene.children).toHaveLength(3);
    expect([named, mapped, painted].map((m) => m.color.getHex())).toEqual([0xffffff, 0xffffff, 0xffffff]);
  });

  it('leaves a material that is not the GLB’s (a recipe’s game material)', () => {
    const game = new THREE.MeshStandardMaterial();
    const scene = new THREE.Group().add(piece(game));
    expect(bareGlb(scene, () => undefined, new Set())).toBe(0);
    expect(game.color.getHex()).toBe(0xffffff);
  });

  it('greys a GLB that loaded: its materials found through the parser, copies and all', async () => {
    const loader = createLevelLoader({ world: 'hoth', tier: 'high', renderer: null, fetchBytes: async () => glbBytes(), sizes: {} });
    const gltf = await loader.load('meshes/x.lod0.glb');
    const colours = [];
    gltf.scene.traverse((o) => o.isMesh && colours.push(o.material.color.getHex()));
    expect(colours).toEqual([BARE, BARE]);
  });
});

describe('a colour map named and lost', () => {
  const meshesOf = (gltf) => {
    const out = [];
    gltf.scene.traverse((o) => o.isMesh && out.push(o));
    return out;
  };
  let warn = null;
  const quiet = () => (warn = vi.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => {
    warn?.mockRestore();
    ktx2.up = () => Promise.reject(new Error('no KTX2 loader in this test'));
  });

  it('is bare, as one that named none: a solid piece grey and a two-sided card not drawn', async () => {
    quiet();
    ktx2.up = some;
    const glbs = { 'meshes/solid.lod0.glb': () => glbNaming({ 0: '../tex/good.ktx2', 1: '../tex/bad.ktx2' }), 'meshes/card.lod0.glb': () => glbNaming({ 0: '../tex/bad_card.ktx2', 1: '../tex/good.ktx2' }, [0]) };
    const loader = createLevelLoader({ world: 'hoth', tier: 'high', renderer: null, fetchBytes: async (path) => glbs[path](), sizes: {} });
    const [kept, lost] = meshesOf(await loader.load('meshes/solid.lod0.glb')).map((o) => o.material);
    expect(kept.map?.isTexture).toBe(true);
    expect(kept.color.getHex()).toBe(0xffffff);
    expect(lost.map).toBeNull();
    expect(lost.color.getHex()).toBe(BARE);
    const card = meshesOf(await loader.load('meshes/card.lod0.glb'));
    expect(card.map((o) => o.material.name)).toEqual(['Shaders/SS_B']);
  });

  it('binds a map to the loader’s copy of its material too, the one drawn (a mesh without normals or tangents)', async () => {
    ktx2.up = some;
    const loader = createLevelLoader({ world: 'hoth', tier: 'high', renderer: null, fetchBytes: async () => glbNaming({ 0: '../tex/good.ktx2', 1: '../tex/good.ktx2' }), sizes: {} });
    const gltf = await loader.load('meshes/x.lod0.glb');
    const drawn = meshesOf(gltf).map((o) => o.material);
    const parsed = await gltf.parser.getDependencies('material');
    expect(drawn[0]).not.toBe(parsed[0]);
    expect(drawn.map((m) => m.map?.isTexture)).toEqual([true, true]);
    expect(parsed.map((m) => m.map?.isTexture)).toEqual([true, true]);
  });

  it('counts the maps asked, loaded and failed, and why the first failed', async () => {
    quiet();
    ktx2.up = vi.fn(some);
    const loader = createLevelLoader({ world: 'hoth', tier: 'high', renderer: null, fetchBytes: async () => glbNaming({ 0: '../tex/good.ktx2', 1: '../tex/bad.ktx2' }), sizes: {} });
    expect(loader.counts()).toEqual({ asked: 0, loaded: 0, failed: 0, why: null });
    await loader.load('meshes/a.lod0.glb');
    // (a map is asked once, whatever names it)
    await loader.load('meshes/b.lod0.glb');
    expect(loader.counts()).toEqual({ asked: 2, loaded: 1, failed: 1, why: 'Error: 404 /models/galaxy/bf2017/levels/hoth/tex/bad.1024.ktx2' });
    // (a map that failed on its own, a 404, is not asked again)
    expect(ktx2.up).toHaveBeenCalledTimes(2);
    expect(await loader.texture('tex/bad.ktx2')).toBeNull();
    expect(ktx2.up).toHaveBeenCalledTimes(2);
  });

  it('asks again for a map the KTX2 loader failed once that loader comes up, and counts it loaded', async () => {
    quiet();
    let up = false;
    ktx2.up = () => (up ? some() : Promise.reject(new WasmError('basis', 'load')));
    const loader = createLevelLoader({ world: 'hoth', tier: 'high', renderer: null, fetchBytes: async () => glbNaming({ 0: '../tex/a.ktx2', 1: '../tex/b.ktx2' }), sizes: {} });
    await loader.load('meshes/x.lod0.glb');
    expect(loader.counts()).toEqual({ asked: 2, loaded: 0, failed: 2, why: 'WasmError (load): basis: WebAssembly failed to load' });
    up = true;
    expect((await loader.texture('tex/a.ktx2'))?.isTexture).toBe(true);
    expect(loader.counts()).toEqual({ asked: 2, loaded: 1, failed: 1, why: 'WasmError (load): basis: WebAssembly failed to load' });
    const gltf = await loader.load('meshes/y.lod0.glb');
    expect(meshesOf(gltf).map((o) => [o.material.map?.isTexture, o.material.color.getHex()])).toEqual([
      [true, 0xffffff],
      [true, 0xffffff],
    ]);
    expect(loader.counts()).toEqual({ asked: 2, loaded: 2, failed: 0, why: null });
  });

  it('says the first lost map of a world once, a warning in production too, and the rest not', async () => {
    quiet();
    ktx2.up = some;
    const loader = createLevelLoader({ world: 'hoth', tier: 'high', renderer: null, fetchBytes: async (path) => glbNaming({ 0: `../tex/bad_${path.split('/')[1]}.ktx2`, 1: '../tex/bad.ktx2' }), sizes: {} });
    await loader.load('meshes/a.lod0.glb');
    await loader.load('meshes/b.lod0.glb');
    expect(loader.counts().failed).toBe(3);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/^level hoth: a map did not load, tex\/bad\S*\.ktx2: Error: 404 /);
  });

  it('says a transcoder that would not come up once, by its WasmError’s name, and draws the level bare', async () => {
    quiet();
    ktx2.up = () => Promise.reject(new WasmError('basis', 'timeout'));
    const loader = createLevelLoader({ world: 'endor', tier: 'high', renderer: null, fetchBytes: async () => glbNaming({ 0: '../tex/a.ktx2', 1: '../tex/b.ktx2' }), sizes: {} });
    const gltf = await loader.load('meshes/x.lod0.glb');
    expect(meshesOf(gltf).map((o) => o.material.color.getHex())).toEqual([BARE, BARE]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/^level endor: the KTX2 loader did not come up.*WasmError \(timeout\)/);
    expect(loader.counts()).toEqual({ asked: 2, loaded: 0, failed: 2, why: 'WasmError (timeout): basis: WebAssembly did not come up in time' });
  });

  // (the game material's base is the GLB's colour under no map: what each
  // was handed, by shader)
  const game = () => {
    const base = {};
    const materialFor = vi.fn((recipe, maps) => {
      base[recipe.shader] = maps.glb.color.getHex();
      return new THREE.MeshBasicMaterial({ name: `game:${recipe.shader}` });
    });
    return { base, materialFor };
  };

  it('makes a recipe’s base grey where the GLB’s colour map was lost and the recipe brings none; one with a colour of its own draws it', async () => {
    quiet();
    ktx2.up = some;
    const { base, materialFor } = game();
    const recipes = {
      forGlb: (path) => [{ shader: 'Shaders/SS_A', maps: path.includes('own') ? { color: 'T_C' } : {} }, { shader: 'Shaders/SS_B', maps: {} }],
      maps: { T_C: 'tex/good_own.ktx2' },
      tex: {},
    };
    const loader = createLevelLoader({ world: 'hoth', tier: 'high', renderer: null, fetchBytes: async () => glbNaming({ 0: '../tex/bad.ktx2', 1: '../tex/good.ktx2' }), sizes: {}, recipes, materialFor });
    const drawn = meshesOf(await loader.load('meshes/x.lod0.glb')).map((o) => o.material.name);
    expect(drawn).toEqual(['game:Shaders/SS_A', 'game:Shaders/SS_B']);
    expect(base).toEqual({ 'Shaders/SS_A': BARE, 'Shaders/SS_B': 0xffffff });
    await loader.load('meshes/own.lod0.glb');
    expect(base['Shaders/SS_A']).toBe(0xffffff);
  });

  it('a recipe’s material whose GLB named no colour map and whose recipe brings none: a solid piece grey, a two-sided card not drawn', async () => {
    const { base, materialFor } = game();
    const recipes = { forGlb: () => [{ shader: 'Shaders/SS_A', maps: {} }, { shader: 'Shaders/SS_B', maps: {} }], maps: {}, tex: {} };
    const loader = createLevelLoader({ world: 'hoth', tier: 'high', renderer: null, fetchBytes: async () => glbNaming({}, [0]), sizes: {}, recipes, materialFor });
    const drawn = meshesOf(await loader.load('meshes/x.lod0.glb')).map((o) => o.material.name);
    expect(drawn).toEqual(['game:Shaders/SS_B']);
    expect(materialFor).toHaveBeenCalledTimes(1);
    expect(base).toEqual({ 'Shaders/SS_B': BARE });
  });
});

describe('sharpenPack', () => {
  const chip = (max) => ({ capabilities: { getMaxAnisotropy: () => max } });

  it('gives a pack map the tier’s anisotropy: 16 on high and ultra, 4 on mid, 1 on low', () => {
    expect(sharpenPack(new THREE.Texture(), 'ultra', chip(16)).anisotropy).toBe(16);
    expect(sharpenPack(new THREE.Texture(), 'high', chip(16)).anisotropy).toBe(16);
    expect(sharpenPack(new THREE.Texture(), 'mid', chip(16)).anisotropy).toBe(4);
    expect(sharpenPack(new THREE.Texture(), 'low', chip(16)).anisotropy).toBe(1);
  });

  it('asks no more than the chip has, and reads an unknown tier as high', () => {
    expect(sharpenPack(new THREE.Texture(), 'ultra', chip(8)).anisotropy).toBe(8);
    expect(sharpenPack(new THREE.Texture(), 'nowhere', null).anisotropy).toBe(16);
    // (the node renderer says it on itself, not on capabilities)
    expect(sharpenPack(new THREE.Texture(), 'high', { getMaxAnisotropy: () => 4 }).anisotropy).toBe(4);
  });

  it('passes a missing texture through', () => {
    expect(sharpenPack(null, 'high')).toBe(null);
  });
});
