import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createDraws, groupsOf, mergeParts, sampledBy, texturesOf } from './draws.js';
import { loadGpuThree } from './three.js';

const tex = (name) => Object.assign(new THREE.Texture(), { name });
const box = () => new THREE.BoxGeometry(1, 1, 1);
const part = (material, geometry = box(), extra = {}) => ({ geometry, material, local: new THREE.Matrix4(), ...extra });

describe('groupsOf', () => {
  it('keys a group by the material’s batch key and the geometry’s attributes', () => {
    const a = new THREE.MeshStandardMaterial({ map: tex('a') });
    a.userData.batchKey = 'crate';
    const b = a.clone();
    b.userData.batchKey = 'crate';
    const c = new THREE.MeshStandardMaterial();
    const noUv = box();
    noUv.deleteAttribute('uv');
    const { groups, refused } = groupsOf([part(a), part(b), part(c), part(a, noUv)], { keyOf: (m) => m.userData.batchKey ?? m.uuid });
    expect(refused).toEqual([]);
    expect(groups.map((g) => g.parts.length).sort()).toEqual([1, 1, 2]);
    // (the first part's material draws the group)
    expect(groups.find((g) => g.parts.length === 2).material).toBe(a);
  });

  it('splits a group past 16 sampled textures and refuses one material over it (Review Focus 5)', () => {
    const many = (n, k) => {
      const m = new THREE.MeshStandardMaterial();
      m.userData.batchKey = 'k';
      // (a material's maps under their own names, as levelGltf binds them)
      ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'displacementMap', 'lightMap'].slice(0, n).forEach((slot, i) => (m[slot] = tex(`${k}${i}`)));
      return m;
    };
    const parts = [part(many(9, 'x')), part(many(9, 'y')), part(many(9, 'z'))];
    expect(texturesOf(parts[0].material).size).toBe(9);
    const { groups } = groupsOf(parts, { keyOf: (m) => m.userData.batchKey });
    expect(groups.length).toBe(3);
    expect(groups.every((g) => g.textures.size <= 16)).toBe(true);
    const small = groupsOf(parts, { keyOf: () => 'k', maxTextures: 8 });
    expect(small.groups).toEqual([]);
    expect(small.refused.length).toBe(3);
  });
});

describe('mergeParts', () => {
  it('lays each part’s vertices end to end with its local matrix baked in, and its LOD file as an attribute', () => {
    const g1 = box();
    const g2 = new THREE.PlaneGeometry(2, 2);
    g2.deleteAttribute('uv');
    g2.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g2.attributes.position.count * 2), 2));
    const local = new THREE.Matrix4().makeTranslation(0, 5, 0);
    const { geometry, ranges } = mergeParts(THREE, [
      { geometry: g1, local: new THREE.Matrix4(), file: 0, mirrored: false },
      { geometry: g2, local, file: 2, mirrored: true },
    ]);
    expect(geometry.attributes.position.count).toBe(24 + 4);
    expect(ranges[0]).toMatchObject({ baseVertex: 0, firstIndex: 0, indexCount: 36 });
    expect(ranges[1]).toMatchObject({ baseVertex: 24, firstIndex: 36, indexCount: 6 });
    // (the plane's vertices moved up by its local matrix)
    expect(geometry.attributes.position.getY(24)).toBeCloseTo(6);
    expect(geometry.attributes.gpuLod.getX(25)).toBe(2);
    expect(geometry.attributes.gpuLod.getX(3)).toBe(0);
    // the mirrored part: its triangles again, wound the other way (Review Focus 3)
    const m = ranges[1].mirrored;
    expect(m).toMatchObject({ firstIndex: 42, indexCount: 6 });
    const idx = geometry.index.array;
    for (let t = 0; t < 2; t++) {
      const fwd = [idx[36 + t * 3], idx[36 + t * 3 + 1], idx[36 + t * 3 + 2]];
      const back = [idx[42 + t * 3], idx[42 + t * 3 + 1], idx[42 + t * 3 + 2]];
      expect(back).toEqual([fwd[0], fwd[2], fwd[1]]);
    }
  });

  it('reads quantised attributes as floats (a meshopt GLB’s int16 positions)', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Int16Array([32767, 0, 0, 0, 32767, 0, 0, 0, 32767]), 3, true));
    const { geometry } = mergeParts(THREE, [{ geometry: g, local: new THREE.Matrix4(), file: 1 }]);
    expect(geometry.attributes.position.array).toBeInstanceOf(Float32Array);
    expect(geometry.attributes.position.getX(0)).toBeCloseTo(1);
    expect(geometry.index.count).toBe(3);
  });
});

describe('sampledBy', () => {
  it('finds the maps a node material reads through its nodes as well as its own fields', async () => {
    const { THREE: T, tsl } = await loadGpuThree();
    const [own, colour, normal] = ['own', 'colour', 'normal'].map((name) => Object.assign(new T.Texture(), { name }));
    const m = new T.MeshStandardNodeMaterial();
    m.map = own;
    const shared = tsl.texture(colour, tsl.uv());
    // (a game material's colour and its normal reading the same node twice)
    m.colorNode = shared.mul(tsl.vec3(0.5)).add(shared.mul(0.1));
    m.normalNode = tsl.texture(normal).xyz;
    const found = sampledBy(m);
    expect([...found].map((t) => t.name).sort()).toEqual(['colour', 'normal', 'own']);
    expect(texturesOf(m).size).toBe(1);
  });
});

describe('createDraws', () => {
  // (the vertex pull's buffers, never drawn here: the nodes are made, not built)
  async function made() {
    const three = await loadGpuThree();
    const { THREE: T, tsl } = three;
    const store = (n, item, type) => tsl.storage(new T.StorageBufferAttribute(new Uint32Array(n * item), item), type, n).toReadOnly();
    const slots = [];
    const cull = { nodes: { rows: store(4, 4, 'uvec4'), visibleRead: store(4, 1, 'uint'), stateRead: store(4, 2, 'uvec2') }, uniforms: { now: tsl.uniform(0) }, slots: 8, setSlot: (s, v) => slots.push([s, v]), indirect: new T.IndirectStorageBufferAttribute(16, 5) };
    const draws = createDraws({ library: { fromMaterial: (m) => m } }, { cull, three, parent: new T.Group(), keyOf: (m) => m.uuid });
    return { T, draws, slots };
  }

  it('records the bundle again when a texture it samples is let go (a finer row swapped in)', async () => {
    const { T, draws, slots } = await made();
    const map = new T.Texture();
    const material = new T.MeshStandardNodeMaterial();
    material.map = map;
    draws.add([{ geometry: new T.BoxGeometry(), material, local: new T.Matrix4() }], [{ key: 0, file: 0, mirrored: false }]);
    expect(slots.map(([s]) => s)).toEqual([0]);
    expect(draws.groups[0].mesh.parent).toBe(draws.bundle);
    const was = draws.bundle.version;
    // (levelGltf.js's swapInto: dispose, then the new source)
    map.dispose();
    expect(draws.bundle.version).toBe(was + 1);
    expect(draws.stats().rerecords).toBe(1);
    // (and no more once the draws are gone)
    draws.dispose();
    map.dispose();
    expect(draws.stats().rerecords).toBe(1);
  });
});
