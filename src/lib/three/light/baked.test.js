import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DIRECTION_FLOOR, chartOf, createBaked, directionalIrradiance, hasUv1, pickSet, turnToGame, withBaked } from './baked';

describe('hasUv1', () => {
  it('true only where the geometry carries a second uv set of two components', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
    expect(hasUv1(g)).toBe(false);
    g.setAttribute('uv1', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
    expect(hasUv1(g)).toBe(true);
    expect(hasUv1(null)).toBe(false);
    expect(hasUv1({ attributes: { uv1: { itemSize: 3, count: 3 } } })).toBe(false);
    expect(hasUv1({ attributes: { uv1: { itemSize: 2, count: 0 } } })).toBe(false);
  });
});

describe('directionalIrradiance (the TSL twin’s CPU function)', () => {
  const flat = [0.5, 0.5, 0.5, 1]; // no direction: the half-Lambert at 0.5, rebalanced by 1
  it('a map with no direction gives half the irradiance whatever the normal (Enlighten’s rebalance w = 1)', () => {
    expect(directionalIrradiance([2, 4, 6], [flat, flat, flat], [0, 1, 0])).toEqual([1, 2, 3]);
  });
  it('a channel lit from straight above gives all of it to an up normal and none to a down one', () => {
    const up = [0.5, 1, 0.5, 1];
    expect(directionalIrradiance([1, 1, 1], [up, up, up], [0, 1, 0])).toEqual([1, 1, 1]);
    expect(directionalIrradiance([1, 1, 1], [up, up, up], [0, -1, 0])).toEqual([0, 0, 0]);
  });
  it('each colour its own direction: red from +x, blue from −x', () => {
    const fromX = [1, 0.5, 0.5, 1];
    const fromMinusX = [0, 0.5, 0.5, 1];
    const e = directionalIrradiance([1, 1, 1], [fromX, flat, fromMinusX], [1, 0, 0]);
    expect(e[0]).toBeCloseTo(1);
    expect(e[1]).toBeCloseTo(0.5);
    expect(e[2]).toBeCloseTo(0);
  });
  it('the rebalance divides, never by under DIRECTION_FLOOR; a negative half-Lambert is clamped to 0', () => {
    const weak = [0.5, 0.5, 0.5, 0.5];
    expect(directionalIrradiance([1, 1, 1], [weak, weak, weak], [0, 1, 0])).toEqual([1, 1, 1]);
    const zero = [0.5, 0.5, 0.5, 0];
    expect(directionalIrradiance([1, 0, 0], [zero, zero, zero], [0, 1, 0])[0]).toBeCloseTo(0.5 / DIRECTION_FLOOR);
    const away = [0.5, 1, 0.5, 0.1];
    expect(directionalIrradiance([1, 1, 1], [away, away, away], [0, -1, 0])).toEqual([0, 0, 0]);
  });
});

describe('turnToGame', () => {
  it('turns a site normal back by the pack’s yaw into the game’s frame (the atlas’s directions are the game’s)', () => {
    const n = turnToGame([1, 0, 0], Math.PI / 2);
    // the pack turned the level by +yaw (rebase: x' = x cos + z sin); back is −yaw
    expect(n[0]).toBeCloseTo(0);
    expect(n[2]).toBeCloseTo(1);
    expect(turnToGame([0, 1, 0], 1.3)).toEqual([0, 1, 0]);
  });
});

describe('pickSet and chartOf', () => {
  const rows = [
    { set: 'EN_Hoth_01_Static_Sunset', variant: 'Sunset', irradiance: 'a.ktx2' },
    { set: 'FL_Hoth_Cloudy_01_Static', variant: 'Cloudy', irradiance: 'b.ktx2' },
  ];
  it('the weather’s own set, else the first; none without rows', () => {
    expect(pickSet(rows, 'cloudy').set).toBe('FL_Hoth_Cloudy_01_Static');
    expect(pickSet(rows, 'sunny').set).toBe('EN_Hoth_01_Static_Sunset');
    expect(pickSet(rows).set).toBe('EN_Hoth_01_Static_Sunset');
    expect(pickSet([], 'x')).toBe(null);
    expect(pickSet(null)).toBe(null);
    // (a row without its irradiance is no set)
    expect(pickSet([{ set: 'x' }])).toBe(null);
  });
  it('a mesh’s chart: the whole atlas where the row says uv1 is the atlas’s own, the named chart, else none', () => {
    expect(chartOf({ charts: 'uv1' }, 'Rock_01')).toEqual([1, 1, 0, 0]);
    expect(chartOf({ charts: { Rock_01: [0.25, 0.5, 0.1, 0.2] } }, 'Rock_01')).toEqual([0.25, 0.5, 0.1, 0.2]);
    expect(chartOf({ charts: { Rock_01: [0.25, 0.5, 0.1, 0.2] } }, 'Crate')).toBe(null);
    // (lane Q3's probe has not found the charts: nothing is looked up)
    expect(chartOf({ charts: null }, 'Rock_01')).toBe(null);
    expect(chartOf(null, 'Rock_01')).toBe(null);
  });
  it('either road’s rows (the spec’s §11): charts game or site, each mesh’s rect as [x, y, w, h] (uv1 × rect.zw + rect.xy)', () => {
    const rects = { Rock_01: [0.1, 0.2, 0.25, 0.5] };
    expect(chartOf({ charts: 'game', rects }, 'Rock_01')).toEqual([0.25, 0.5, 0.1, 0.2]);
    expect(chartOf({ charts: 'site', rects }, 'Rock_01')).toEqual([0.25, 0.5, 0.1, 0.2]);
    expect(chartOf({ charts: 'site', rects }, 'Crate')).toBe(null);
    expect(chartOf({ charts: 'game', rects: null }, 'Rock_01')).toBe(null);
  });
});

describe('createBaked', () => {
  const tex = (name) => Object.assign(new THREE.Texture(), { name });
  const row = { set: 'fixture', irradiance: 'irr', dirR: 'r', dirG: 'g', dirB: 'b', skyVisibility: 'sky', uvSet: 1, charts: 'uv1' };
  it('null on no rows, and nothing is loaded', async () => {
    const asked = [];
    const load = async (p) => (asked.push(p), tex(p));
    expect(await createBaked(null, null, { loadTexture: load })).toBe(null);
    expect(await createBaked(null, [], { loadTexture: load })).toBe(null);
    expect(asked).toEqual([]);
  });
  it('null when the irradiance fails to load (the level keeps its probes)', async () => {
    expect(await createBaked(null, [row], { loadTexture: async (p) => (p === 'irr' ? null : tex(p)) })).toBe(null);
  });
  it('a sampler otherwise, scaled by lane S’s calibration, its five maps loaded once and freed on dispose', async () => {
    const asked = [];
    const made = [];
    const load = async (p) => {
      asked.push(p);
      const t = tex(p);
      made.push(t);
      return t;
    };
    const baked = await createBaked(null, [row], { loadTexture: load, calibrate: { gameToSite: 0.25 } });
    expect(baked).not.toBe(null);
    expect(asked.sort()).toEqual(['b', 'g', 'irr', 'r', 'sky']);
    expect(baked.scale).toBe(0.25);
    expect(baked.directional).toBe(true);
    expect(typeof baked.node).toBe('function');
    expect(typeof baked.skyVisibility).toBe('function');
    expect(baked.chartOf('anything')).toEqual([1, 1, 0, 0]);
    let disposed = 0;
    for (const t of made) t.addEventListener('dispose', () => disposed++);
    baked.dispose();
    expect(disposed).toBe(5);
  });
  it('without the direction maps it is the plain irradiance (not directional), and the scale defaults to 1', async () => {
    const baked = await createBaked(null, [row], { loadTexture: async (p) => (p === 'irr' ? tex(p) : null) });
    expect(baked.directional).toBe(false);
    expect(baked.scale).toBe(1);
  });
});

describe('withBaked', () => {
  const three = { tsl: { uv: (i) => `uv${i}`, vec3: (v) => `vec3(${v})` } };
  const baked = { set: 'fixture', node: (uv1, chart) => `atlas(${uv1},${chart})`, skyVisibility: () => 'sky' };
  const material = () => {
    const calls = [];
    return { calls, userData: {}, setupLightingModel: () => ({ indirect: (b) => calls.push(['base', b.context.irradiance.v, b.context.iblIrradiance.v]) }) };
  };
  const builder = () => {
    const slot = () => ({ v: 'lights', assign(x) { this.v = x; } });
    return { context: { irradiance: slot(), iblIrradiance: slot() } };
  };
  it('a mesh without a chart keeps its material untouched (the probe term)', () => {
    const m = material();
    const setup = m.setupLightingModel;
    expect(withBaked(m, baked, { chart: null, three })).toBe(m);
    expect(m.setupLightingModel).toBe(setup);
    expect(m.userData.baked).toBe(undefined);
  });
  it('with a chart its indirect diffuse is the atlas’s, the lights’ irradiance dropped, before the model’s own indirect term', () => {
    const m = withBaked(material(), baked, { chart: [1, 1, 0, 0], three });
    const model = m.setupLightingModel(builder());
    model.indirect(builder());
    expect(m.calls).toEqual([['base', 'vec3(0)', 'atlas(uv1,1,1,0,0)']]);
    expect(m.userData.baked).toMatchObject({ set: 'fixture', skyVisibility: 'sky' });
  });
});
