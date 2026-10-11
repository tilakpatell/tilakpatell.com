import { existsSync, readFileSync, statSync } from 'node:fs';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PUBLISHED from '../../data/galaxyAssets.json';
import { hitRadius } from '../universe/hunterRules';
import { BY_SPAN, fitScale } from '../universe/shipFit';
import { SHIP_MODELS } from '../universe/shipModels';
import { BUILT_KINDS } from '../universe/trafficModels';
import { GALAXY_KINDS, buildGalaxyShip } from './fleet';
import { KINDS } from './hunted';
import { ARRIVAL, HD_MAPS, HQ, HULL, HUNTER_GLB, LIGHT_CUTS, LOD_FAR, LOD_NEAR, MADE, MODELS, STAND_IN, ULTRA, createModels, lodLevels, lodUrl, modelsAt, withHq } from './models';
import { SYSTEMS, kindsIn } from './systems';

const at = (path) => new URL(`../../../public${path}`, import.meta.url);
// a file the site has: in public/, or published to the bucket (src/data/galaxyAssets.json: lane V's native cuts, the kits' ultra cuts)
const onSite = (path) => existsSync(at(path)) || Boolean(PUBLISHED[path.replace(/^\//, '')]);
const bytesOf = (path) => (existsSync(at(path)) ? statSync(at(path)).size : PUBLISHED[path.replace(/^\//, '')].bytes);
// (a published file read here only when a checkout has it: the box tests skip it otherwise)
const here = (path) => existsSync(at(path));

// a GLB's JSON chunk
const jsonOf = (url) => {
  const b = readFileSync(url);
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
};

// a GLB's primitives, counted from its JSON chunk
const primitives = (url) => (jsonOf(url).meshes ?? []).reduce((n, m) => n + m.primitives.length, 0);

// a GLB's box as it comes, from its JSON chunk: each primitive's bounds (its
// positions' min and max, a quantised one's scaled back) carried through its
// node's place, the way three's quick Box3 does it (a part turned off the
// axes comes out a little wide, never narrow)
const UNIT = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
const boxOf = (url) => {
  const json = jsonOf(url);
  const box = new THREE.Box3();
  const local = (n) => (n.matrix ? new THREE.Matrix4().fromArray(n.matrix) : new THREE.Matrix4().compose(new THREE.Vector3(...(n.translation ?? [0, 0, 0])), new THREE.Quaternion(...(n.rotation ?? [0, 0, 0, 1])), new THREE.Vector3(...(n.scale ?? [1, 1, 1]))));
  const walk = (i, parent) => {
    const n = json.nodes[i];
    const m = parent.clone().multiply(local(n));
    for (const p of n.mesh === undefined ? [] : json.meshes[n.mesh].primitives) {
      const a = json.accessors[p.attributes.POSITION];
      const k = a.normalized ? 1 / UNIT[a.componentType] : 1;
      box.union(new THREE.Box3(new THREE.Vector3(...a.min).multiplyScalar(k), new THREE.Vector3(...a.max).multiplyScalar(k)).applyMatrix4(m));
    }
    for (const c of n.children ?? []) walk(c, m);
  };
  for (const i of json.scenes[json.scene ?? 0].nodes) walk(i, new THREE.Matrix4());
  return box;
};
// and turned nose to +z, as the models are
const turnedBox = (def) => boxOf(at(def.url)).applyMatrix4(new THREE.Matrix4().makeRotationY(def.nose ?? 0)).getSize(new THREE.Vector3());

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
  it('are each in the site, or published to the bucket', () => {
    for (const [kind, m] of Object.entries({ ...MODELS, ...HUNTER_GLB })) expect(onSite(m.url), `${kind}: ${m.url}`).toBe(true);
    for (const detail of ['low', 'mid', 'high', 'ultra']) for (const [kind, m] of Object.entries(modelsAt(detail))) expect(onSite(m.url), `${detail} ${kind}: ${m.url}`).toBe(true);
  });

  // (lane S1, the galaxy-in-space design's decision 1: where the game has the
  // hull, the galaxy draws it. MODELS is this device's table, a test's at
  // ultra; the plain rows are a desktop's, modelsAt('high'))
  describe('the game’s hulls', () => {
    const HIGH = modelsAt('high');

    it('draws the war’s capitals from the space levels’ kits at the fleet’s cut, bow to +z, and the Lucrehulk and the Arquitens as before', () => {
      for (const kind of ['destroyer', 'moncal', 'venator', 'corvette', 'providence', 'lucrehulk']) expect(HIGH[kind], kind).toEqual({ url: `/models/galaxy/${kind}.glb`, nose: 0 });
      expect(HIGH.lightcruiser).toEqual({ url: '/models/galaxy/lightcruiser.glb', nose: -Math.PI / 2 });
      // (the universe map keeps its own Star Destroyer and Venator: the galaxy's rows are the game's)
      for (const detail of ['low', 'mid', 'high', 'ultra']) {
        expect(modelsAt(detail).destroyer.url, detail).not.toBe('/models/universe/star-destroyer.glb');
        expect(modelsAt(detail).venator.url, detail).not.toBe('/models/universe/venator.glb');
      }
    });

    it('flies the X-wing, the TIE interceptor, Slave I, the Scimitar and the TIE striker as lane V imported them, native, and the Falcon gear up', () => {
      // (the Falcon: the landmark Falcon with its legs, a material of their own, left out: scripts/bf2017-fleet.mjs)
      expect(HIGH.falcon).toEqual({ url: '/models/galaxy/falcon.glb', nose: 0 });
      for (const detail of ['low', 'mid', 'high', 'ultra']) expect(modelsAt(detail).falcon.url, detail).toBe('/models/galaxy/falcon.glb');
      const native = { xwing: 'xwing', interceptor: 'tieinterceptor', slave1: 'slave1', scimitar: 'scimitar', tiestriker: 'tiestriker' };
      for (const [kind, file] of Object.entries(native)) {
        expect(HIGH[kind], kind).toEqual({ url: `/models/galaxy/surface/${file}.glb`, nose: 0 });
        expect(LIGHT_CUTS[kind], kind).toBe(`/models/galaxy/surface/${file}.lod1.glb`);
        expect(onSite(LIGHT_CUTS[kind]), kind).toBe(true);
        expect(bytesOf(LIGHT_CUTS[kind]), kind).toBeLessThan(bytesOf(HIGH[kind].url));
      }
      expect(MADE).toEqual({}); // (the gen3d X-wing retired from the galaxy)
      expect(HUNTER_GLB.xwing).toEqual({ ...MODELS.xwing, built: true });
      expect(HUNTER_GLB.redleader.url).toBe(MODELS.xwing.url);
    });

    it('draws a fighter’s light cut on a phone or a laptop, the plain one on a desktop, the same far copy either way', () => {
      for (const detail of ['low', 'mid']) for (const kind of Object.keys(LIGHT_CUTS)) expect(modelsAt(detail)[kind], `${detail} ${kind}`).toEqual({ ...HIGH[kind], url: LIGHT_CUTS[kind] });
      for (const detail of ['high', 'ultra']) for (const kind of Object.keys(LIGHT_CUTS)) expect(modelsAt(detail)[kind].url, `${detail} ${kind}`).toBe(HIGH[kind].url);
      for (const detail of ['low', 'high']) expect(lodUrl('xwing', modelsAt(detail))).toBe('/models/galaxy/lod/xwing.glb');
      // (a table laid over kinds the models have, and no other)
      expect(withHq({ tie: { url: '/t.glb', nose: 0 } }, 'low')).toEqual({ tie: { url: '/t.glb', nose: 0 } });
    });

    it('draws the kits’ ultra cuts on the strongest graphics alone, the same far copies', () => {
      for (const kind of ['destroyer', 'moncal', 'venator', 'corvette', 'providence']) {
        expect(ULTRA[kind], kind).toBe(`/models/galaxy/${kind}.ultra.glb`);
        expect(modelsAt('ultra')[kind], kind).toEqual({ ...HIGH[kind], url: ULTRA[kind] });
        for (const detail of ['low', 'mid', 'high']) expect(modelsAt(detail)[kind].url, `${detail} ${kind}`).toBe(HIGH[kind].url);
        expect(lodUrl(kind, modelsAt('ultra')), kind).toBe(`/models/galaxy/lod/${kind}.glb`);
      }
    });
  });

  it('has the ten ships brought in (from Sketchfab; the Munificent since made again with Meshy, the Providence the game’s), each turned to fly nose first, and the Razor Crest that walks the surfaces', () => {
    const noses = { tie: 0, tiebomber: 0, tieadvanced: 0, shuttle: 0, lightcruiser: -Math.PI / 2, gozanti: 0, munificent: 0, providence: 0, nubian: 0, ghost: 0 };
    for (const [kind, nose] of Object.entries(noses)) {
      expect(modelsAt('high')[kind], kind).toEqual({ url: `/models/galaxy/${kind}.glb`, nose }); // (a desktop's rows: the Providence's at ultra is its ultra cut)
      expect(onSite(MODELS[kind].url), kind).toBe(true);
    }
    expect(MODELS.razorcrest).toEqual({ url: '/models/galaxy/surface/razorcrest.glb', nose: 0 });
    expect(onSite(MODELS.razorcrest.url)).toBe(true);
  });

  it('flies the Sketchfab TIEs as the hunters, each built until it is here', () => {
    for (const kind of ['tie', 'tieadvanced']) expect(HUNTER_GLB[kind], kind).toEqual({ ...MODELS[kind], built: true });
    // (the universe's own and the droids', as they were)
    expect(HUNTER_GLB.interceptor).toBeTruthy();
    for (const kind of ['vulture', 'trifighter']) expect(HUNTER_GLB[kind].built, kind).toBe(true);
  });

  it('flies the hunters’ and wingmen’s Y-wings, A-wings and TIE bombers as the whole models, not the universe map’s far-off copies', () => {
    for (const kind of ['ywing', 'awing', 'tiebomber']) {
      expect(HUNTER_GLB[kind], kind).toEqual({ ...MODELS[kind], built: true });
      expect(HUNTER_GLB[kind].url, kind).not.toMatch(/\/lod\//);
    }
  });

  it('flies the bounty hunters’ ships and the navy’s gunboats as their models, each built until it is here', () => {
    for (const kind of ['gunboat', 'ig2000', 'houndstooth', 'punishingone']) {
      expect(HUNTER_GLB[kind], kind).toEqual({ ...MODELS[kind], built: true });
      expect([...BUILT_KINDS, ...GALAXY_KINDS], kind).toContain(kind); // (its built one, to fly till then)
    }
  });

  it('flies the Star Destroyer that jumps in on you as the battles’ one, so it is the file every arrival has loaded already', () => {
    expect(HUNTER_GLB.destroyer).toEqual({ ...MODELS.destroyer, built: true });
    expect(ARRIVAL).toContain('destroyer');
  });

  it('stands a built ship in for each of the new ones that has none, and none for one that has', () => {
    expect(STAND_IN).toMatchObject({ tiebomber: 'tie', lightcruiser: 'destroyer', gozanti: 'freighter', providence: 'munificent', ghost: 'freighter' });
    const built = [...BUILT_KINDS, ...GALAXY_KINDS];
    for (const kind of ['tie', 'tieadvanced', 'shuttle', 'munificent', 'nubian', 'razorcrest']) {
      expect(built, kind).toContain(kind);
      expect(STAND_IN[kind], kind).toBeUndefined();
    }
  });

  it('flies the universe wars’ flagships Meshy made for them, each standing in as a ship of its side till it loads', () => {
    for (const kind of ['councildread', 'fedbattleship', 'superlab', 'hacienda']) {
      expect(MODELS[kind]?.url, kind).toBe(`/models/universe/war/${kind}.glb`);
      expect([...BUILT_KINDS, ...GALAXY_KINDS], kind).toContain(STAND_IN[kind]);
    }
    expect(STAND_IN).toMatchObject({ councildread: 'councilship', fedbattleship: 'fedcruiser', superlab: 'madrigal', hacienda: 'lowrider' });
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

  describe('the capitals’ close-up cut', () => {
    const base = { nebulon: { url: '/models/galaxy/nebulon.glb', nose: 0 }, tie: { url: '/t.glb', nose: 0 } };

    it('is what a high or ultra device loads, in the capitals that have one', () => {
      for (const detail of ['high', 'ultra']) {
        const m = withHq(base, detail);
        expect(m.nebulon).toEqual({ url: '/models/galaxy/hq/nebulon.glb', nose: HQ.nebulon.nose, hq: true });
        expect(m.tie).toBe(base.tie);
      }
    });

    it('is left to the desktops: a laptop or a phone keeps the lighter one', () => {
      for (const detail of ['mid', 'low']) expect(withHq(base, detail)).toEqual(base);
    });

    it('has a far-off copy of its own (the old one’s would sit wrong on the new hull)', () => {
      expect(lodUrl('nebulon', withHq(base, 'high'))).toBe('/models/galaxy/lod/hq/nebulon.glb');
      expect(lodUrl('nebulon', base)).toBe('/models/galaxy/lod/nebulon.glb');
    });

    it('is in the site, with its far-off copy, for each of them', () => {
      for (const kind of Object.keys(HQ)) {
        const m = withHq({ [kind]: { url: '/', nose: 0 } }, 'high');
        expect(existsSync(at(m[kind].url)), kind).toBe(true);
        expect(existsSync(at(lodUrl(kind, m))), kind).toBe(true);
        expect(primitives(at(lodUrl(kind, m))), kind).toBe(1);
      }
    });

    it('is what modelsAt gives a desktop, and not a laptop', () => {
      expect(modelsAt('high').nebulon.url).toBe(HQ.nebulon.url);
      expect(modelsAt('mid').nebulon.url).not.toBe(HQ.nebulon.url);
    });
  });

  describe('what every arrival loads', () => {
    it('flies the game’s X-wings and TIE interceptors, the player’s X-wing the same file on a desktop (universe/shipModels.js)', () => {
      expect(modelsAt('high').xwing.url).toBe('/models/galaxy/surface/xwing.glb');
      expect(modelsAt('high').interceptor.url).toBe('/models/galaxy/surface/tieinterceptor.glb');
      expect(HUNTER_GLB.xwing.url).toBe(MODELS.xwing.url);
      expect(HUNTER_GLB.redleader.url).toBe(MODELS.xwing.url);
      expect(HUNTER_GLB.interceptor.url).toBe(MODELS.interceptor.url);
      expect(SHIP_MODELS.xwing).toBe(modelsAt('high').xwing.url);
    });

    // (the galaxy's models come to about 8 MB, specs/2026-10-06-galaxy-phases-design.md;
    // these four were 2.3 MB on any device as the gen3d X-wing's and the
    // Meshy interceptor's light cuts over the universe map's 473 KB Star
    // Destroyer. Lane S1 (the galaxy-in-space design, decision 1), measured
    // 2026-10-11 (`_source`: the files and src/data/galaxyAssets.json): the
    // Star Destroyer's kit at the fleet's cut is 2,049 KB (50 maps at 256),
    // so a phone or a laptop with the game's light cuts comes to 3.76 MB,
    // held under 4; a desktop takes the plain cuts (the X-wing's 3,147 KB,
    // the interceptor's 2,164), 7.86 MB, held under 9, from the bucket's CDN
    // with a year's cache; at ultra the Star Destroyer's 21.6 MB ultra cut
    // and the corvette's 1.9 MB besides, 29.1 MB, held under 40)
    it('is the Star Destroyer, the corvette, the X-wing and the interceptor, with their far-off copies, under 4 MB on a phone or a laptop, 9 on a desktop, 40 at ultra', () => {
      expect(ARRIVAL).toEqual(['destroyer', 'corvette', 'xwing', 'interceptor']);
      for (const [detail, cap] of [['low', 4e6], ['mid', 4e6], ['high', 9e6], ['ultra', 40e6]]) {
        const models = modelsAt(detail);
        const bytes = ARRIVAL.flatMap((k) => [models[k].url, lodUrl(k, models)]).reduce((n, url) => n + bytesOf(url), 0);
        expect(bytes, detail).toBeLessThan(cap);
      }
    });
  });

  // (scripts/meshy-galaxy-library.mjs: the galaxy's worst models made again,
  // each over its old file, and each squeezed to its kind's budget: a capital
  // 900 KB. The corvette, the interceptor, the Providence, Slave I, the
  // Scimitar and the TIE striker were Meshy's too, and are the game's since,
  // lane S1: their Meshy credits retired with the files)
  describe('the worst ones made again with Meshy', () => {
    const REMADE = {
      interdictor: { url: '/models/galaxy/interdictor.glb', kb: 900 },
      munificent: { url: '/models/galaxy/munificent.glb', kb: 900 },
    };
    const games = JSON.parse(readFileSync(at('/games/credits.json'), 'utf8'));
    const credits = JSON.parse(readFileSync(new URL('../../data/modelCredits.json', import.meta.url), 'utf8'));

    it('are what the galaxy loads for each kind, inside its budget', () => {
      for (const [kind, { url, kb }] of Object.entries(REMADE)) {
        expect(MODELS[kind]?.url, kind).toBe(url);
        expect(statSync(at(url)).size / 1024, kind).toBeLessThan(kb);
      }
    });

    it('are each credited to Meshy, and no longer to the Sketchfab model each replaced', () => {
      for (const { url } of Object.values(REMADE)) {
        const name = url.split('/').pop().replace(/\.glb$/, '');
        expect(games[`meshy/${name}`]?.source, name).toBe('https://www.meshy.ai');
        expect(Object.values(credits).map((m) => m.file), name).not.toContain(url);
      }
    });

    it('credit the game, not Meshy or Sketchfab, for what the game’s files replaced, and keep no file of theirs', () => {
      for (const name of ['corvette', 'interceptor', 'providence', 'scimitar', 'tiestriker']) expect(games[`meshy/${name}`], name).toBeUndefined();
      for (const file of ['/models/galaxy/interceptor.glb', '/models/galaxy/scimitar.glb', '/models/galaxy/tiestriker.glb', '/models/galaxy/hq/destroyer.glb']) expect(existsSync(at(file)), file).toBe(false);
      for (const key of ['galaxy-destroyer', 'galaxy-moncal', 'galaxy-venator', 'galaxy-corvette', 'galaxy-providence', 'galaxy-nebulonhq', 'surface-xwing', 'surface-tieinterceptor', 'surface-falcon', 'surface-slave1', 'surface-scimitar', 'surface-tiestriker']) {
        expect(credits[key]?.author, key).toBe('EA DICE');
        expect(credits[key].also, key).toContain('galaxy'); // (the galaxy's panel shows it)
      }
      // (the universe map's own Star Destroyer is no longer drawn here; Daniel Andersson's MC80 and close-up ships are the game's rows since)
      expect(credits['star-destroyer'].also ?? []).not.toContain('galaxy');
      for (const key of ['galaxy-moncal', 'galaxy-nebulonhq']) expect(credits[key].author, key).not.toBe('Daniel');
    });
  });

  describe('the Death Stars’ 4096-pixel maps', () => {
    const base = { deathstar: { url: '/models/universe/death-star.glb', nose: 0 }, deathstar2: { url: '/models/galaxy/deathstar2.glb', nose: 0 } };

    it('are what only an ultra device loads (a quarter of a gigabyte of graphics memory), turned as the lighter cut is', () => {
      const m = withHq(base, 'ultra');
      expect(m.deathstar).toEqual({ url: HD_MAPS.deathstar, nose: 0 });
      expect(m.deathstar2).toEqual({ url: HD_MAPS.deathstar2, nose: 0 });
      for (const detail of ['high', 'mid', 'low']) {
        const n = withHq(base, detail);
        expect(n.deathstar, detail).toEqual(base.deathstar);
        expect(n.deathstar2, detail).toEqual(base.deathstar2);
      }
    });

    it('are in the site, and keep the lighter cut’s far-off copy (the same hull)', () => {
      for (const url of Object.values(HD_MAPS)) expect(existsSync(at(url)), url).toBe(true);
      const m = withHq(base, 'high');
      expect(lodUrl('deathstar2', m)).toBe('/models/galaxy/lod/deathstar2.glb');
      expect(lodUrl('deathstar', m)).toBe(null);
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
      // (the kits' plain and ultra cuts and the fighters' light and plain cuts
      // share one far copy a kind: the same hull)
      for (const kind of [...Object.keys(ULTRA), ...Object.keys(LIGHT_CUTS)]) for (const detail of ['low', 'high', 'ultra']) expect(lodUrl(kind, modelsAt(detail)), `${detail} ${kind}`).toBe(`/models/galaxy/lod/${kind}.glb`);
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

  describe('a bare hull', () => {
    beforeEach(canvases);
    afterEach(() => vi.unstubAllGlobals());

    // (the MC80's main hull: its maps are bound in its shader graph, which the drop's GLB does not name)
    it('is drawn the game’s hull grey, as the space levels draw theirs, where the export gave it no colour map', async () => {
      const load = async () => {
        const scene = new THREE.Group();
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 4), new THREE.MeshStandardMaterial({ name: 'MC_80_Met', color: 0xffffff, metalness: 0, roughness: 1 })));
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ name: 'M_MC80_Engine', color: 0xffffff, map: new THREE.Texture() })));
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ name: 'tinted', color: 0xa62a1f })));
        return { scene, animations: [] };
      };
      const models = createModels({ load });
      const slot = models.slot('moncal', 1);
      for (let i = 0; i < 5; i++) await settle();
      const byName = {};
      slot.inner.traverse((o) => o.isMesh && (byName[o.material.name] = o.material));
      expect(byName.MC_80_Met.color.getHex()).toBe(HULL.getHex());
      expect(byName.MC_80_Met.metalness).toBeGreaterThanOrEqual(0.45);
      expect(byName.MC_80_Met.roughness).toBeLessThanOrEqual(0.6);
      expect(byName.M_MC80_Engine.color.getHex()).toBe(0xffffff); // (a mapped one as it comes)
      expect(byName.tinted.color.getHex()).toBe(0xa62a1f); // (a coloured one too)
      models.dispose();
    });
  });

  describe('fitted by length', () => {
    beforeEach(canvases);
    afterEach(() => vi.unstubAllGlobals());

    // a model twice as wide as it is long, off centre
    const wide = () => {
      const scene = new THREE.Group();
      const a = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 2), new THREE.MeshStandardMaterial());
      a.position.set(3, 0, 1);
      scene.add(a);
      return { scene, animations: [] };
    };
    const sizeOf = (o) => new THREE.Box3().setFromObject(o, true).getSize(new THREE.Vector3());
    const levels = async (kind, size) => {
      const models = createModels({ load: async () => wide() });
      const slot = models.slot(kind, size);
      for (let i = 0; i < 5; i++) await settle();
      slot.holder.updateMatrixWorld(true);
      return { models, levels: slot.inner.children.find((c) => c.isLOD).levels.map((l) => sizeOf(l.object)) };
    };

    it('fits a loaded ship by its length, nose to tail, its wings out past it, and its far-off copy the same', async () => {
      const { models, levels: [full, far] } = await levels('xwing', 0.3);
      for (const s of [full, far]) {
        expect(s.z).toBeCloseTo(0.3, 5);
        expect(s.x).toBeCloseTo(0.6, 5);
      }
      models.dispose();
    });

    it('fits a station by its biggest side, as the world’s solids are', async () => {
      const { models, levels: [full, far] } = await levels('deathstar2', 10);
      for (const s of [full, far]) {
        expect(s.x).toBeCloseTo(10, 5);
        expect(s.z).toBeCloseTo(5, 5);
      }
      models.dispose();
    });

    it('fits the built stand-ins the same way, so a ship keeps its length when its model comes', () => {
      const models = createModels({ load: () => new Promise(() => {}) }); // (nothing ever loads)
      const vulture = models.slot('vulture', 1); // (built wider than it is long)
      vulture.holder.updateMatrixWorld(true);
      expect(sizeOf(vulture.holder).z).toBeCloseTo(1, 5);
      expect(sizeOf(vulture.holder).x).toBeGreaterThan(1.5);
      const bwing = models.slot('bwing', 1); // (flies upright: its biggest side)
      bwing.holder.updateMatrixWorld(true);
      const b = sizeOf(bwing.holder);
      expect(Math.max(b.x, b.y, b.z)).toBeCloseTo(1, 5);
      models.dispose();
    });

    it('turns no ship it fits by length so that it is more than twice as wide or tall as it is long (as a nose turned the wrong way would be)', () => {
      let read = 0;
      for (const models of [modelsAt('mid'), modelsAt('high'), modelsAt('ultra'), HUNTER_GLB]) {
        for (const [kind, def] of Object.entries(models)) {
          if (BY_SPAN.has(kind) || !here(def.url)) continue; // (a published file is measured where the checkout has it)
          read++;
          const s = turnedBox(def);
          expect(Math.max(s.x, s.y, s.z) / s.z, `${kind}: ${def.url}`).toBeLessThanOrEqual(2);
        }
      }
      expect(read).toBeGreaterThan(60); // (the committed fleet at least: the kits, the TIEs, the Sketchfab ships)
    });

    it('keeps every hunter’s hit radius round its widest side, loaded or built', () => {
      const built = new Set([...BUILT_KINDS, ...GALAXY_KINDS]);
      for (const [kind, type] of Object.entries(KINDS)) {
        const boxes = HUNTER_GLB[kind] && here(HUNTER_GLB[kind].url) ? [turnedBox(HUNTER_GLB[kind])] : [];
        if (built.has(kind)) {
          const m = buildGalaxyShip(kind);
          boxes.push(m.size.clone());
          m.dispose();
        }
        for (const box of boxes) expect((type.size * fitScale(kind, box) * Math.max(box.x, box.y, box.z)) / 2, kind).toBeLessThanOrEqual(hitRadius(type));
      }
    });
  });
});
