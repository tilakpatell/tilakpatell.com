import { Document, NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createLevelLoader, matchRecipes, recipesIndex } from './levelGltf.js';

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
