import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildNav, toBin } from '../../../lib/battlefront/nav.js';
import { createLevel, toPack, volumeOf } from './level.js';
import { LEVELS, hiddenFor, layerShown, levelKeyOf, wholePackOf } from './levels.js';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const ROAM = { origin: [205, 362.3, -1540], yaw: 0, cell: 128, tex: {}, terrain: { near: {}, far: {} }, cull: {} };
const WHOLE = { whole: true, origin: [0, 0, 0], yaw: 0, cell: 128, tex: {}, terrain: { near: {}, far: {} }, cull: { high: { K: 1000, dropped: [] } }, modeOnly: { fantasybattle: [3], heroarena: [4, 5], teamdeathmatch: [5] }, nav: { file: 'nav.bin' } };
const NAV = toBin(buildNav({ heightAt: () => 1, bounds: { min: [0, 0], max: [8, 8] } }));

// lane L's pieces as fakes: what each was asked, in order
function fakes({ published = true, parts = {} } = {}) {
  const log = [];
  const deps = {
    packOf: async (world) => {
      log.push(['pack', world]);
      if (world.includes('/game/')) {
        if (!published) throw new Error('404 level.json');
        return WHOLE;
      }
      return ROAM;
    },
    partOf: async (world, file, empty) => (log.push(['part', world, file]), parts[file] ?? empty),
    bytesOf: async (world, path) => (log.push(['bytes', world, path]), path === 'nav.bin' ? NAV : new ArrayBuffer(0)),
    imageLayer: async () => ({ type: 'image', near: { data: new Float32Array([2, 2, 2, 2]), w: 2, h: 2, minX: -10, minZ: -10, metresPerPixel: 20 }, far: null }),
    createLevelLoader: () => ({ load: async () => null, dispose() {} }),
    createLevelScene: ({ scene, pack }) => ((deps.into = scene), (deps.drawn = pack), { setTable: () => log.push('far'), setHorizon() {}, update: (p) => log.push(['scene', ...p]), stats: () => ({ tris: 0, calls: 0, instances: 0 }), dispose() {} }),
    createLevelStream: ({ onFar }) => ({
      update: (p) => {
        log.push(['stream', ...p]);
        onFar(new ArrayBuffer(0));
      },
      ready: () => true,
      progress: () => 1,
      dispose() {},
    }),
    createPlaced: ({ rows }) => ((deps.placed = rows), { count: () => rows.length, dispose() {} }),
  };
  return { log, deps };
}

describe('a level of the game, by its key (lane G2)', () => {
  it('knows the game’s levels and their worlds, and a world’s first', () => {
    expect(Object.keys(LEVELS)).toHaveLength(23);
    expect(levelKeyOf('hoth')).toBe('hoth_01');
    expect(levelKeyOf('Endor_02')).toBe('endor_02');
    expect(levelKeyOf('nowhere')).toBe(null);
    expect(wholePackOf('deathstar02_01')).toBe('deathstar/game/deathstar02_01');
  });

  it('loads the whole pack by key, in the map’s frame: its group at 0', async () => {
    const { deps, log } = fakes();
    const scene = new THREE.Scene();
    const level = createLevel({ scene, tier: 'high', level: 'hoth_01', deps, ground: false });
    await level.ready;
    expect(log[0]).toEqual(['pack', 'hoth/game/hoth_01']);
    expect(level.whole).toBe(true);
    expect(level.note).toBe(null);
    expect(deps.into.position.toArray()).toEqual([0, 0, 0]);
    expect(toPack(WHOLE, [215, 0, -1530])).toEqual([215, -1530]);
  });

  it('hides the other modes’ own props, never a mesh the mode’s own layer places too', async () => {
    expect(hiddenFor(WHOLE, 'galacticAssault')).toEqual([4, 5]);
    expect(hiddenFor(WHOLE, 'hvv')).toEqual([3]);
    expect(hiddenFor(WHOLE, 'blast')).toEqual([3, 4]);
    expect(hiddenFor(WHOLE, null)).toEqual([]);
    expect(hiddenFor(ROAM, 'hvv')).toEqual([]);
    expect(layerShown('gamemodes', 'hvv')).toBe(true);
    expect(layerShown('teamdeathmatch_online', 'blast')).toBe(true);
    expect(layerShown('mode9', 'blast')).toBe(false);
    const { deps } = fakes();
    const level = createLevel({ scene: new THREE.Scene(), level: 'hoth_01', mode: 'galacticAssault', deps, ground: false });
    await level.ready;
    expect(deps.drawn.cull.high.dropped).toEqual([4, 5]);
  });

  it('brings the parts: the lights, the probes as the light stack’s boxes, the mode’s actors and vehicles, the navgrid', async () => {
    const lights = { format: 1, cell: 128, cells: { '0,0': [{ pos: [1, 2, 3] }] } };
    const probes = { probes: [{ id: 'p', faces: 'probes/p', centre: [10, 5, 10], axes: [[4, 0, 0], [0, 2, 0], [0, 0, 6]] }] };
    const vehicles = { rides: [{ kind: 'tauntaun', at: [1, 2], yaw: 0, layer: 'mode9' }], things: [{ kind: 'atat', at: [5, 5], yaw: 1, layer: 'fantasybattle' }] };
    const { deps } = fakes({ parts: { 'lights.json': lights, 'probes.json': probes, 'vehicles.json': vehicles } });
    const level = createLevel({ scene: new THREE.Scene(), level: 'hoth_01', mode: 'galacticAssault', deps, ground: false });
    await level.ready;
    expect(level.parts.lights).toBe(lights);
    expect(level.parts.volumes).toEqual([{ id: 'p', faces: 'probes/p', min: [8, 4, 7], max: [12, 6, 13] }]);
    expect(level.parts.rides).toEqual([]);
    expect(level.parts.things.map((t) => t.kind)).toEqual(['atat']);
    expect(deps.placed.map((r) => r.kind)).toEqual(['atat']);
    expect(level.nav.cols).toBe(4);
    expect(level.stats().placed).toBe(1);
    // (a probe turned is held by the box round it)
    expect(volumeOf({ id: 'q', faces: 'f', centre: [0, 0, 0], axes: [[2, 0, 2], [0, 2, 0], [-2, 0, 2]] })).toMatchObject({ min: [-2, -1, -2], max: [2, 1, 2] });
  });

  it('falls back to the world’s roam pack when the whole one is not published, and says so', async () => {
    const { deps, log } = fakes({ published: false });
    const level = createLevel({ scene: new THREE.Scene(), level: 'hoth_01', deps, ground: false });
    await level.ready;
    expect(log.slice(0, 2)).toEqual([
      ['pack', 'hoth/game/hoth_01'],
      ['pack', 'hoth'],
    ]);
    expect(level.whole).toBe(false);
    expect(level.note).toMatch(/not published yet/);
    expect(deps.into.position.toArray()).toEqual(ROAM.origin);
    expect(level.nav).toBe(null);
  });

  it('loads every committed whole level.json by its key, in the map’s frame', () => {
    const built = Object.keys(LEVELS).filter((k) => existsSync(join(ROOT, 'public', 'models', 'galaxy', 'bf2017', 'levels', wholePackOf(k), 'level.json')));
    for (const k of built) {
      const j = JSON.parse(readFileSync(join(ROOT, 'public', 'models', 'galaxy', 'bf2017', 'levels', wholePackOf(k), 'level.json'), 'utf8'));
      expect(j.whole, k).toBe(true);
      expect(j.origin, k).toEqual([0, 0, 0]);
      expect(j.yaw, k).toBe(0);
      expect(j.horizon, k).toBe(null);
      expect(j.world, k).toBe(wholePackOf(k));
      expect(j.nav?.file, k).toBe('nav.bin');
    }
  });
});

describe('a roam pack, as lane 5 drew Hoth', () => {
  it('takes the map frame to the pack’s by the origin, and back', () => {
    expect(toPack(ROAM, [215, 0, -1530])).toEqual([10, 10]);
    expect(toPack({ ...ROAM, yaw: Math.PI / 2 }, [205, 0, -1530]).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([10, 0]);
  });

  it('streams round the player in the pack’s frame, the far list first', async () => {
    const { deps, log } = fakes({ published: false });
    const level = createLevel({ scene: new THREE.Scene(), tier: 'high', world: 'hoth', deps, ground: false });
    level.update([215, 380, -1530]);
    await level.ready;
    const after = log.filter((l) => l === 'far' || l[0] === 'stream' || l[0] === 'scene');
    expect(after[0]).toEqual(['stream', 10, 10]);
    expect(after[1]).toBe('far');
    expect(after[2]).toEqual(['scene', 10, 10]);
  });

  it('reads the ground from the image layer, in the export’s heights', async () => {
    const { deps } = fakes({ published: false });
    const level = createLevel({ scene: new THREE.Scene(), tier: 'high', world: 'hoth', deps, ground: false });
    expect(level.heightAt(205, -1540)).toBe(0);
    await level.ready;
    expect(level.heightAt(205, -1540)).toBeCloseTo(364.3, 5);
  });
});
