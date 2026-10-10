import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { dressCrew, watchCrew } from './crewSurface.js';

// a figure as crew.js has it: meshes wearing the crew pack's materials by
// the game's names, one of them shared with another figure of the kind
function figure(shared) {
  const model = new THREE.Group();
  const body = shared ?? new THREE.MeshStandardMaterial({ name: 'M_Body' });
  const head = new THREE.MeshStandardMaterial({ name: 'mat_head' });
  model.add(new THREE.Mesh(new THREE.BoxGeometry(), body), new THREE.Mesh(new THREE.BoxGeometry(), head));
  return { model, body, head };
}

const JSON_ = {
  materials: { M_Body: { family: 'character', shader: 'S', maps: { detailArray: 'TA_D', aoSlice: 'T_AOSL' }, params: {} }, M_Glb: { family: 'glb', maps: {}, params: {} } },
  maps: { TA_D: ['tex/ta_d_000.ktx2', 'tex/ta_d_001.ktx2', 'tex/ta_d_002.ktx2'], T_AOSL: 'tex/t_aosl.ktx2' },
  tex: { ta_d_000: { high: 512 }, ta_d_001: { high: 512 }, ta_d_002: { high: 512 }, t_aosl: { high: 512 } },
};

const deps = () => ({
  fetchJson: vi.fn(async () => JSON_),
  loadTexture: vi.fn(async (url) => ({ url })),
  make: vi.fn((recipe, maps) => Object.assign(new THREE.MeshBasicMaterial({ name: `game:${recipe.family}` }), { userData: { maps } })),
});

describe('dressCrew', () => {
  it('puts the game material on the materials a recipe names, at the tier’s sizes, and leaves the rest', async () => {
    const d = deps();
    const { model, head } = figure();
    const n = await dressCrew(model, 'luke', { tier: 'high', cache: new Map(), ...d });
    expect(n).toBe(1);
    const [bodyMesh, headMesh] = model.children;
    expect(bodyMesh.material.name).toBe('game:character');
    expect(headMesh.material).toBe(head);
    expect(d.fetchJson).toHaveBeenCalledWith('/models/galaxy/bf2017/crew/luke.recipes.json');
    const { maps } = bodyMesh.material.userData;
    expect(maps.detailSlices.map((t) => t.url)).toEqual(['/models/galaxy/bf2017/crew/tex/ta_d_000.512.ktx2', '/models/galaxy/bf2017/crew/tex/ta_d_001.512.ktx2', '/models/galaxy/bf2017/crew/tex/ta_d_002.512.ktx2']);
    expect(maps.aoSlice.url).toBe('/models/galaxy/bf2017/crew/tex/t_aosl.512.ktx2');
    expect(maps.glb.name).toBe('M_Body');
  });

  it('makes one game material for a material two figures share', async () => {
    const d = deps();
    const cache = new Map();
    const a = figure();
    const b = figure(a.body);
    await dressCrew(a.model, 'luke', { tier: 'high', cache, ...d });
    await dressCrew(b.model, 'luke', { tier: 'high', cache, ...d });
    expect(d.make).toHaveBeenCalledTimes(1);
    expect(b.model.children[0].material).toBe(a.model.children[0].material);
  });

  it('leaves a mesh already in its game material as it is', async () => {
    const d = deps();
    const cache = new Map();
    const { model } = figure();
    await dressCrew(model, 'luke', { tier: 'high', cache, ...d });
    const dressed = model.children[0].material;
    // (fromGlb keeps the GLB's name on the game material)
    dressed.name = 'M_Body';
    dressed.userData.game = { family: 'character' };
    expect(await dressCrew(model, 'luke', { tier: 'high', cache, ...d })).toBe(0);
    expect(model.children[0].material).toBe(dressed);
    expect(d.make).toHaveBeenCalledTimes(1);
  });

  it('changes nothing on low, or for a kind without recipes', async () => {
    const d = deps();
    const { model, body } = figure();
    expect(await dressCrew(model, 'luke', { tier: 'low', cache: new Map(), ...d })).toBe(0);
    expect(d.fetchJson).not.toHaveBeenCalled();
    d.fetchJson.mockResolvedValueOnce(null);
    expect(await dressCrew(model, 'han', { tier: 'high', cache: new Map(), ...d })).toBe(0);
    expect(model.children[0].material).toBe(body);
  });
});

describe('watchCrew', () => {
  it('dresses a figure the first time the node renderer draws it, once, then lets go', () => {
    const dress = vi.fn(async () => 1);
    const { model } = figure();
    const own = vi.fn();
    model.children[0].onBeforeRender = own;
    watchCrew(model, 'luke', { dress, tierOf: () => 'high' });
    const node = { isWebGPURenderer: true };
    model.children[0].onBeforeRender(node);
    model.children[1].onBeforeRender(node);
    expect(dress).toHaveBeenCalledTimes(1);
    expect(dress.mock.calls[0][2]).toMatchObject({ renderer: node, tier: 'high' });
    // (the mesh's own hook ran, and is its hook again)
    expect(own).toHaveBeenCalledTimes(1);
    expect(model.children[0].onBeforeRender).toBe(own);
  });

  it('dresses again when a cut brings new meshes in', async () => {
    const dress = vi.fn(async () => 1);
    const { model } = figure();
    const body = new THREE.Group();
    model.add(body);
    watchCrew(model, 'luke', { dress, tierOf: () => 'high' });
    model.children[0].onBeforeRender({ isWebGPURenderer: true });
    expect(dress).toHaveBeenCalledTimes(1);
    body.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'M_Body' })));
    await Promise.resolve();
    expect(dress).toHaveBeenCalledTimes(2);
  });

  it('never dresses a figure the classic renderer draws', () => {
    const dress = vi.fn(async () => 1);
    const { model } = figure();
    watchCrew(model, 'luke', { dress, tierOf: () => 'high' });
    for (const m of model.children) m.onBeforeRender({ isWebGLRenderer: true });
    expect(dress).not.toHaveBeenCalled();
  });
});
