import { existsSync, readFileSync, statSync } from 'node:fs';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_KINDS } from '../universe/trafficModels';
import { GALAXY_KINDS } from './fleet';
import { HUNTER_GLB, LOD_FAR, LOD_NEAR, MODELS, STAND_IN, createModels, lodLevels, lodUrl } from './models';
import { SYSTEMS, kindsIn } from './systems';

const at = (path) => new URL(`../../../public${path}`, import.meta.url);

// a GLB's primitives, counted from its JSON chunk
const primitives = (url) => {
  const b = readFileSync(url);
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  return (json.meshes ?? []).reduce((n, m) => n + m.primitives.length, 0);
};

// a model as GLTFLoader gives one: a scene of a box or two (a fighter's wings, say), off centre
const fakeModel = () => {
  const scene = new THREE.Group();
  const a = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 2), new THREE.MeshStandardMaterial());
  a.position.set(3, 0, 1);
  const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 6), new THREE.MeshStandardMaterial());
  b.position.set(3, 0.5, 1);
  scene.add(a, b);
  return { scene, animations: [] };
};
const settle = () => new Promise((r) => setTimeout(r, 0));

// (the ships' lights and panels are drawn on canvases; there isn't one here, so a canvas that takes any drawing)
const canvases = () => {
  const ctx = new Proxy(function draw() {}, { get: (_, k) => (k === 'canvas' ? null : ctx), set: () => true, apply: () => ctx });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
};

describe('the galaxy’s models', () => {
  it('are each in the site', () => {
    for (const [kind, m] of Object.entries({ ...MODELS, ...HUNTER_GLB })) expect(existsSync(at(m.url)), `${kind}: ${m.url}`).toBe(true);
  });

  it('has the ten ships from Sketchfab, each turned to fly nose first, and the Razor Crest that walks the surfaces', () => {
    const noses = { tie: 0, tiebomber: 0, tieadvanced: 0, shuttle: 0, lightcruiser: -Math.PI / 2, gozanti: 0, munificent: 0, providence: 0, nubian: 0, ghost: 0 };
    for (const [kind, nose] of Object.entries(noses)) {
      expect(MODELS[kind], kind).toEqual({ url: `/models/galaxy/${kind}.glb`, nose });
      expect(existsSync(at(MODELS[kind].url)), kind).toBe(true);
    }
    expect(MODELS.razorcrest).toEqual({ url: '/models/galaxy/surface/razorcrest.glb', nose: 0 });
    expect(existsSync(at(MODELS.razorcrest.url))).toBe(true);
  });

  it('flies the Sketchfab TIEs as the hunters, each built until it is here', () => {
    for (const kind of ['tie', 'tieadvanced']) expect(HUNTER_GLB[kind], kind).toEqual({ ...MODELS[kind], built: true });
    // (the universe's own and the droids', as they were)
    expect(HUNTER_GLB.interceptor).toBeTruthy();
    for (const kind of ['vulture', 'trifighter']) expect(HUNTER_GLB[kind].built, kind).toBe(true);
  });

  it('stands a built ship in for each of the new ones that has none, and none for one that has', () => {
    expect(STAND_IN).toMatchObject({ tiebomber: 'tie', lightcruiser: 'destroyer', gozanti: 'freighter', providence: 'munificent', ghost: 'freighter' });
    const built = [...BUILT_KINDS, ...GALAXY_KINDS];
    for (const kind of ['tie', 'tieadvanced', 'shuttle', 'munificent', 'nubian', 'razorcrest']) {
      expect(built, kind).toContain(kind);
      expect(STAND_IN[kind], kind).toBeUndefined();
    }
  });

  it('gives every loaded kind with no built version a stand-in that is built', () => {
    const built = [...BUILT_KINDS, ...GALAXY_KINDS];
    for (const k of Object.keys(MODELS)) {
      if (built.includes(k) || k === 'deathstar') continue; // (the Death Star has its own sphere in the world)
      expect(built, `${k} → ${STAND_IN[k]}`).toContain(STAND_IN[k]);
    }
  });

  it('knows every kind a system flies: a model, or one built in code', () => {
    const built = [...BUILT_KINDS, ...GALAXY_KINDS];
    for (const s of SYSTEMS) for (const k of kindsIn(s)) expect(Boolean(MODELS[k]) || built.includes(k), `${s.id}: ${k}`).toBe(true);
  });

  describe('building a stand-in', () => {
    // (the ships' lights and panels are drawn on canvases; there isn't one here, so a canvas that takes any drawing)
    beforeEach(() => {
      const ctx = new Proxy(function draw() {}, { get: (_, k) => (k === 'canvas' ? null : ctx), set: () => true, apply: () => ctx });
      vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('shows a stand-in in the slot of a kind that has no built version, until it loads', () => {
      const models = createModels();
      for (const k of Object.keys(STAND_IN)) {
        const slot = models.slot(k, 10);
        expect(slot.ready, k).toBe(true);
        expect(slot.model, k).toBeTruthy();
        expect(slot.real, k).toBe(false); // (so the model that loads swaps in)
      }
      models.dispose();
    });

    it('prebuilds the kinds it is given, a slice at a time, the ones that load as their stand-ins', async () => {
      const models = createModels();
      models.prebuild(['tie', 'destroyer', 'tie', 'venator', 'nowhere']); // (once each; a stand-in for the one with no built version, nothing for the one that doesn’t exist)
      expect(models.builtCount).toBe(0); // (not in this one)
      await new Promise((r) => setTimeout(r, 400));
      expect(models.builtCount).toBe(2); // (the venator’s stand-in is the destroyer, built already)
      const slot = models.slot('tie', 1);
      expect(slot.ready).toBe(true);
      models.dispose();
    });

    it('prebuilds nothing once disposed', async () => {
      const models = createModels();
      models.dispose();
      expect(() => models.prebuild(['tie'])).not.toThrow();
      await new Promise((r) => setTimeout(r, 40));
      expect(models.builtCount).toBe(0);
    });

    it('stops prebuilding when disposed part-way', async () => {
      const models = createModels();
      models.prebuild(['tie', 'destroyer', 'xwing', 'freighter']);
      models.dispose();
      await new Promise((r) => setTimeout(r, 400));
      expect(models.builtCount).toBe(0);
    });
  });

  describe('far off, a one-piece copy', () => {
    beforeEach(canvases);
    afterEach(() => vi.unstubAllGlobals());

    it('has a small one-piece LOD for every model but the Death Star', () => {
      for (const kind of Object.keys(MODELS)) {
        if (kind === 'deathstar') {
          expect(lodUrl(kind)).toBe(null);
          continue;
        }
        const file = at(lodUrl(kind));
        expect(existsSync(file), kind).toBe(true);
        expect(statSync(file).size, kind).toBeLessThan(120 * 1024);
        expect(primitives(file), kind).toBe(1);
      }
    });

    it('steps down at 45 and 900 times its size', () => {
      expect(LOD_NEAR).toBe(45);
      expect(LOD_FAR).toBe(900);
      expect(lodLevels(0.3).map(([d]) => d)).toEqual([0, 13.5, 270]);
      expect(lodLevels(0.3).map(([, what]) => what)).toEqual(['full', 'lod', 'none']);
    });

    // (both files "load" from a stand-in loader: the full model and its LOD the same boxes, so the two should sit exactly together)
    const loaded = async (opts, kind = 'xwing', models = null) => {
      const load = vi.fn(async () => fakeModel());
      models ??= createModels({ load });
      const slot = models.slot(kind, 0.3, opts);
      for (let i = 0; i < 5; i++) await settle();
      return { models, slot, load };
    };
    const lodIn = (slot) => slot.inner.children.find((c) => c.isLOD);

    it('swaps in an LOD of three levels once the model and its LOD are both here', async () => {
      const { models, slot, load } = await loaded();
      expect(load).toHaveBeenCalledWith(MODELS.xwing.url);
      expect(load).toHaveBeenCalledWith(lodUrl('xwing'));
      const lod = lodIn(slot);
      expect(lod).toBeTruthy();
      expect(lod.levels.map((l) => l.distance)).toEqual([0, 13.5, 270]);
      expect(lod.levels[2].object.children).toHaveLength(0); // (past the far cut, nothing)
      expect(slot.real).toBe(true);
      models.dispose();
    });

    it('puts the LOD where the model is, the same size', async () => {
      const { models, slot } = await loaded();
      const [full, far] = lodIn(slot).levels.map((l) => l.object);
      slot.holder.updateMatrixWorld(true);
      const a = new THREE.Box3().setFromObject(full);
      const b = new THREE.Box3().setFromObject(far);
      for (const k of ['min', 'max']) for (const c of ['x', 'y', 'z']) expect(b[k][c]).toBeCloseTo(a[k][c], 5);
      models.dispose();
    });

    it('draws every LOD in one shared vertex-coloured material', async () => {
      const one = await loaded();
      const two = await loaded(undefined, 'interceptor', one.models);
      const mats = (slot) => {
        const m = new Set();
        lodIn(slot).levels[1].object.traverse((o) => o.isMesh && m.add(o.material));
        return [...m];
      };
      expect(mats(one.slot)).toHaveLength(1);
      expect(mats(two.slot)).toEqual(mats(one.slot));
      const [m] = mats(one.slot);
      expect(m.vertexColors).toBe(true);
      expect(m.roughness).toBeCloseTo(0.6);
      expect(m.metalness).toBeCloseTo(0.3);
      one.models.dispose();
    });

    it('never gives a tinted slot an LOD', async () => {
      const { models, slot } = await loaded({ tint: '#888888' });
      expect(slot.real).toBe(true);
      expect(lodIn(slot)).toBeFalsy();
      models.dispose();
    });
  });
});
