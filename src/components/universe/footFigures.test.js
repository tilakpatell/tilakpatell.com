import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { meshyRig } from '../../lib/three/meshyRig.fixture';
import { closure, glslSites } from '../../runtime/shadingClosure';
import * as figures from './footFigures';
import * as classic from './footScene';
import { METRE } from './foot';

// every file a figure asks for, the animator's Meshy rig with a body to measure
const loader = vi.hoisted(() => ({ urls: [], loadAsync: null }));
vi.mock('../../lib/three/gltf', async (orig) => ({ ...(await orig()), gltfLoader: () => loader }));
loader.loadAsync = async (url) => {
  loader.urls.push(url);
  const r = meshyRig();
  r.model.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.3).translate(0, 0.9, 0), new THREE.MeshStandardMaterial()));
  return { scene: r.model, animations: /-(idle|walk|run)\.glb$/.test(url) ? [r.clips[url.match(/-(idle|walk|run)\.glb$/)[1]]] : [] };
};

// a wardrobe of its own, to see which one a look goes through
const wardrobe = () => {
  const seen = { dressed: [], undressed: 0, assets: [] };
  return {
    seen,
    wear: {
      bodyAsset: (look) => (seen.assets.push(look.body), '/models/albuquerque/walt.glb'),
      bodyKind: (look) => `wd:${look.body}`,
      dress: (figure, look) => {
        seen.dressed.push({ figure, look });
        return () => seen.undressed++;
      },
    },
  };
};

describe('footFigures, the crews’ figures without the ground', () => {
  it('reaches no GLSL', () => {
    const entry = fileURLToPath(new URL('./footFigures.js', import.meta.url));
    const files = closure(entry, { read: (p) => readFileSync(p, 'utf8'), exists: existsSync });
    const glsl = [...files].filter((f) => glslSites(readFileSync(f, 'utf8')).length);
    expect(glsl).toEqual([]);
    expect([...files].some((f) => f.endsWith('footScene.js'))).toBe(false);
  });

  it('is what footScene.js still hands out', () => {
    expect(classic.PARTY).toBe(figures.PARTY);
    expect(classic.loadSharedFigure).toBe(figures.loadSharedFigure);
    expect(classic.templateIn).toBe(figures.templateIn);
    expect(typeof classic.loadPartyFigure).toBe('function');
    expect(Object.keys(figures.PARTY)).toEqual(['cruiser', 'rv', 'falcon', 'xwing']);
  });

  it('dresses a look with the wardrobe it was handed, and takes it off again', async () => {
    const { seen, wear } = wardrobe();
    const { loadParty } = figures.figuresWith(wear);
    const walt = figures.PARTY.rv[0];
    const fig = await loadParty(walt, null, { walt: { body: 'heisenberg' } });
    expect(seen.assets).toEqual(['heisenberg']);
    expect(seen.dressed).toHaveLength(1);
    expect(seen.dressed[0].figure.group).toBe(fig.model);
    // (his own revolver in the hand, the look's hand gear left in the wardrobe)
    expect(seen.dressed[0].look.gear.hand).toBe('none');
    fig.dispose();
    expect(seen.undressed).toBe(1);
  });

  it('leaves the show’s own look as it is, and anyone built from shapes too', async () => {
    const { seen, wear } = wardrobe();
    const { loadParty, partyUrl } = figures.figuresWith(wear);
    const jesse = figures.PARTY.rv[1];
    const fig = await loadParty(jesse, null, {});
    expect(fig.model).toBeTruthy();
    expect(seen.dressed).toEqual([]);
    const artoo = await loadParty(figures.PARTY.xwing[1], null);
    expect(artoo.hand).toBe(null);
    expect(artoo.bones).toEqual({});
    expect(artoo.model.isGroup).toBe(true);
    expect(partyUrl(figures.PARTY.xwing[1])).toBe(null);
    expect(partyUrl(figures.PARTY.falcon[1])).toBe('/models/galaxy/crew/han.glb');
  });

  it('builds a person from shapes the height asked, standing on the ground', () => {
    const fig = figures.built({ id: 'han', tall: 1.85, src: { built: 'han' } });
    fig.update(1 / 60, 0);
    fig.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(fig.model);
    expect(fig.built).toBe(true);
    expect(box.min.y).toBeGreaterThan(-0.1 * METRE);
    expect(box.max.y).toBeGreaterThan(1.6 * METRE);
    expect(box.max.y).toBeLessThan(2.1 * METRE);
    fig.dispose();
  });
});
