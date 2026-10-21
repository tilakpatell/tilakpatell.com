import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import flight, { AXES, KEYS, inputOf, modelSources, placeLandmark, settle, spawnOf, tierAt, tinted } from './module';
import { SHARED_KEYS } from './shared';
import { seeded } from '../../../lib/seeded';
import { WORLD_MB } from '../../worlds/worlds';
import { planetSpecOf } from './planets';
import { createOrigin } from '../../../runtime/origin';
import { createEvents } from '../../../runtime/runtime';

function fakeRt() {
  const renderer = { toneMapping: 0, toneMappingExposure: 1, shadowMap: { enabled: true }, drawn: 0, render() {
    this.drawn++;
  } };
  const bound = { keys: null };
  const asked = [];
  return {
    renderer,
    bound,
    asked,
    gfx: { renderer },
    quality: { tier: 'mid' },
    input: { bind: (k, o) => Object.assign(bound, { keys: k, axes: o.axes }), unbind: () => (bound.keys = null), setStick() {} },
    workers: { define() {}, request: (name, msg) => (asked.push(msg), new Promise(() => {})), cancel() {}, close() {} },
    origin: createOrigin(),
    events: createEvents(),
  };
}
const snap = (axes = {}) => ({ axis: (n) => axes[n] ?? 0, stick: { x: 0, y: 0 } });

describe('the flight module', () => {
  // (on the node renderer since lane P1: every shader it reaches a TSL twin, shading.test holds its closure to it)
  it('is whole: nodes, its download as WORLD_MB says', () => {
    expect(flight).toMatchObject({ id: 'flight', shading: 'nodes', mb: WORLD_MB['/fly'] });
    expect(WORLD_MB['/fly']).toBe(22);
  });

  it('binds its keys, and flies the ship from them', async () => {
    const rt = fakeRt();
    const world = await flight.create(rt, { spec: planetSpecOf('hoth') });
    // (the flight's own, and the shared world's: build, take down, fire)
    expect(rt.bound.keys).toEqual({ ...KEYS, ...SHARED_KEYS });
    // (the planet map's markers: no one heard, nothing built, offline and with no durable layer)
    expect([world.pilots(), world.built()]).toEqual([[], []]);
    expect(rt.bound.axes).toEqual(AXES);
    const z0 = world.ship.z;
    for (let i = 0; i < 30; i++) world.step(1 / 30, snap({ throttle: 1 }));
    expect(world.ship.z).toBeLessThan(z0 - 100);
    expect(world.ship.speed).toBeGreaterThan(200);
    world.draw({});
    expect(rt.renderer.drawn).toBe(1);
    // the ground was asked for, coarse first
    expect(rt.asked.length).toBe(6);
    expect(rt.asked[0].leaf.d).toBe(0);
    world.dispose();
  });

  it('starts south of Echo Base, heading for it, well over the ground', () => {
    const s = spawnOf(planetSpecOf('hoth'), () => 12);
    expect(s).toMatchObject({ x: 1200, z: -800 + 3400, yaw: 0, y: 312 });
  });

  it('reads the stick into the axes', () => {
    expect(inputOf({ axis: (n) => (n === 'pitch' ? -1 : 0), stick: { x: 0.5, y: -0.5 } })).toEqual({ pitch: -1, roll: 0.5, yaw: 0, throttle: 0 });
  });

  it('sheds a tier as the pace steps down', () => {
    expect(tierAt('high', 0)).toBe('high');
    expect(tierAt('high', 2)).toBe('mid');
    expect(tierAt('high', 4)).toBe('low');
    expect(tierAt('low', 4)).toBe('low');
  });

  it('puts the renderer back as it found it', async () => {
    const rt = fakeRt();
    const world = await flight.create(rt, { spec: planetSpecOf('tatooine') });
    world.dispose();
    expect(rt.renderer).toMatchObject({ toneMapping: 0, toneMappingExposure: 1, shadowMap: { enabled: true } });
    expect(rt.bound.keys).toBeNull();
  });

  it('follows the origin when the ship goes far', async () => {
    const rt = fakeRt();
    const world = await flight.create(rt, { spec: planetSpecOf('hoth') });
    world.ship = { x: 120000 };
    rt.origin.check(world.anchor());
    expect(rt.origin.at[0]).toBe(100000);
    world.step(1 / 60, snap());
    world.dispose();
  });

  it('takes the site’s high-detail model on a strong machine, the light one otherwise', () => {
    const m = { url: '/models/a.lod1.glb', hq: 'models/a.ultra.glb' };
    expect(modelSources(m, { strong: true })).toEqual(['/models/a.ultra.glb', '/models/a.lod1.glb']);
    expect(modelSources(m, { strong: false })).toEqual(['/models/a.lod1.glb']);
    expect(modelSources({ url: '/models/b.glb' }, { strong: true })).toEqual(['/models/b.glb']);
  });

  it('scales a landmark to its metres along its axis, its foot where it stood', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4).translate(0, 0.5, 0)));
    placeLandmark(root, { metres: 400, along: 'z', yaw: 1 });
    const size = new THREE.Box3().setFromObject(new THREE.Group().add(root.clone().rotateY(-1))).getSize(new THREE.Vector3());
    expect(root.scale.x).toBeCloseTo(100, 6);
    expect(size.z).toBeCloseTo(400, 3);
    expect(root.rotation.y).toBe(1);
  });

  it('lays a place’s buildings out round it, the centre one in its middle, the same every visit', () => {
    const poi = { at: [900, 600], r: 260 };
    const parts = [{ url: 'a', count: 1, centre: true }, { url: 'b', count: 20 }];
    const a = settle(poi, parts, seeded(4));
    expect(a).toHaveLength(21);
    expect(a[0]).toMatchObject({ x: 900, z: 600 });
    for (const s of a.slice(1)) {
      const d = Math.hypot(s.x - 900, s.z - 600);
      expect(d).toBeGreaterThanOrEqual(0.12 * 260 - 1e-9);
      expect(d).toBeLessThanOrEqual(0.7 * 260 + 1e-9);
    }
    expect(settle(poi, parts, seeded(4))).toEqual(a);
  });

  it('scales a landmark by its longest side, asked to', () => {
    const root = new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(2, 8, 4)));
    placeLandmark(root, { metres: 40, along: 'max' });
    expect(root.scale.x).toBeCloseTo(5, 6);
  });

  it('tints a copy of a model, its materials copied once and the original left as it was', () => {
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff' });
    const root = new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(), m), new THREE.Mesh(new THREE.BoxGeometry(), m));
    const t = tinted(root, '#ff0000');
    const mats = [];
    t.traverse((o) => o.isMesh && mats.push(o.material));
    expect(mats[0]).toBe(mats[1]);
    expect(mats[0]).not.toBe(m);
    expect(mats[0].color.getHexString()).toBe('ff0000');
    expect(m.color.getHexString()).toBe('ffffff');
  });
});
