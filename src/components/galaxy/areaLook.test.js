import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { STORM, createAreaLook } from './areaLook';
import { lookOf } from './levelArea';
import { LIGHTS } from '../../data/bf2017/light';
import stages from '../../data/bf2017/maps/sb_kamino.stages.json';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('the storm’s look, from the space level’s own records', () => {
  const look = lookOf(LIGHTS.sb_kamino, { fill: stages.area.fill, probe: LIGHTS.kamino });

  it('the sun where the space level’s record puts it (216°, 20.6° up), not multiplayer Kamino’s', () => {
    expect(look.sun.dir[1]).toBeCloseTo(Math.sin((20.58 * Math.PI) / 180), 3);
    expect(LIGHTS.sb_kamino.weathers.stormy.sun).toMatchObject({ az: 216.246, el: 20.58 });
  });

  it('its fill the records’ own: a dark blue-grey sky, a near-black ground, no grade, the fog’s density from its curve', () => {
    expect(look.sky.b).toBeGreaterThan(look.sky.r);
    expect(look.sky.b).toBeCloseTo(0.4, 3);
    expect(look.ground.r).toBeCloseTo(0.05, 3);
    expect(look.lut).toBeNull();
    expect(look.fogDensity).toBeGreaterThan(0.0001);
    expect(look.fogDensity).toBeLessThan(0.001);
    // (the shine another record’s, the level’s own probe seeing a black sky)
    expect(look.probe).toBe('textures/galaxy/bf2017/light/kamino/stormy');
    expect(look.probeScale).toBeGreaterThan(0);
    expect(look.probeScale).toBeLessThan(1);
  });
});

describe('the scene under an area’s light while you’re inside it', () => {
  const make = () => {
    const scene = new THREE.Scene();
    const keys = [new THREE.DirectionalLight('#ffffff', 2.2), new THREE.DirectionalLight('#ffffff', 0)];
    keys[0].position.set(100, 0, 0);
    const ambient = new THREE.AmbientLight('#9fb0d8', 0.32);
    const space = new THREE.Texture();
    scene.environment = space;
    const probe = new THREE.Texture();
    const post = { grading: vi.fn() };
    const look = createAreaLook({ scene, post, keys, ambient, url: (p) => `https://cdn${p}`, probes: { load: vi.fn(async () => probe) }, lut: vi.fn(async () => 'lut') });
    const area = { look: lookOf(LIGHTS.sb_kamino, { fill: stages.area.fill, probe: LIGHTS.kamino }), flash: 0 };
    return { scene, keys, ambient, space, probe, post, look, area };
  };

  it('turns the galaxy’s own lights to the storm’s (the sun, the sky from above, the dark ground), and puts everything back on leaving', async () => {
    const k = make();
    k.look.apply(k.area);
    await flush();
    expect(k.keys[0].intensity).toBe(STORM.sun);
    expect(k.keys[0].position.y).toBeGreaterThan(30);
    expect(k.keys[1].intensity).toBe(STORM.sky);
    expect(k.keys[1].position.toArray()).toEqual([0, 100, 0]);
    expect(k.ambient.color.r).toBeCloseTo(0.05, 3);
    expect(k.scene.environment).toBe(k.probe);
    // (no grade: the space level's record has none)
    expect(k.post.grading).not.toHaveBeenCalled();
    // a strike lights everything from the clouds
    k.area.flash = 1;
    k.look.apply(k.area);
    expect(k.ambient.intensity).toBeGreaterThan(STORM.ground * 5);
    // out of the area: the galaxy's light as it was
    k.look.apply(null);
    expect(k.keys[0].intensity).toBe(2.2);
    expect(k.keys[0].position.x).toBe(100);
    expect(k.keys[1].intensity).toBe(0);
    expect(k.ambient.intensity).toBe(0.32);
    expect(k.ambient.color.getHexString()).toBe('9fb0d8');
    expect(k.scene.environment).toBe(k.space);
    expect(k.look.on).toBe(false);
  });
});
