import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../areaWeather';
import * as nodes from './areaWeather';

// The storm as nodes against the GLSL one: the same exports, the same parts
// with the same flags and uniform names, the same strike from the same dice
const data = { glows: [[0, 0, 0, 1, 0.5, 0.2, 20]], blinkers: [[53.3, 0, 0]], strikes: [[0, 1000, 0]], clouds: [[0, 2000, 0]] };
const frame = (p) => p.map((x) => x / 53.3);
const both = (make) => [make(glsl.createAreaWeather), make(nodes.createAreaWeather)];
const build = (create) => {
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  scene.add(group);
  const w = create(group, { data, frame, at: [0, 0, 0], sea: -20, rand: () => 0.5 });
  return { scene, group, w };
};
const flags = (m) => ({ transparent: m.transparent, blending: m.blending, side: m.side, depthWrite: m.depthWrite, depthTest: m.depthTest, fog: m.fog });

describe('areaWeather’s twin', () => {
  it('exports what areaWeather exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('draws the lamps, beacons and clouds (a sprite a lamp), the rain and the bolt, as node materials with the GLSL’s flags', () => {
    const [a, n] = both(build);
    const glows = a.group.children.filter((o) => o.isPoints);
    const sprites = n.group.children.filter((o) => o.isSprite);
    expect(sprites).toHaveLength(glows.length);
    expect(sprites.map((s) => s.count)).toEqual(glows.map((p) => p.geometry.attributes.position.count));
    for (const [i, s] of sprites.entries()) {
      expect(s.material.isNodeMaterial).toBe(true);
      expect(flags(s.material)).toEqual(flags(glows[i].material));
      expect(Object.keys(s.material.uniforms).sort()).toEqual(Object.keys(glows[i].material.uniforms).sort());
      for (const k of Object.keys(s.material.uniforms)) expect(s.material.uniforms[k].value).toEqual(glows[i].material.uniforms[k].value);
      expect(s.frustumCulled).toBe(false);
    }
    const lines = (scene, group) => [scene.children.find((o) => o.isLineSegments), group.children.find((o) => o.isLineSegments)];
    const [rainA, boltA] = lines(a.scene, a.group);
    const [rainN, boltN] = lines(n.scene, n.group);
    for (const [x, y] of [[rainA, rainN], [boltA, boltN]]) {
      expect(y.material.isNodeMaterial).toBe(true);
      expect(flags(y.material)).toEqual(flags(x.material));
      expect(Object.keys(y.material.uniforms).sort()).toEqual(Object.keys(x.material.uniforms).sort());
      expect(y.frustumCulled).toBe(false);
      expect(y.visible).toBe(x.visible);
    }
    expect(rainN.geometry.attributes.position.array).toEqual(rainA.geometry.attributes.position.array);
    expect(rainN.material.uniforms.uFall.value.toArray()).toEqual(rainA.material.uniforms.uFall.value.toArray());
  });

  it('frees what it made and leaves the scene as it found it', () => {
    const { scene, group, w } = build(nodes.createAreaWeather);
    w.dispose();
    expect(group.children).toHaveLength(0);
    expect(scene.children.filter((o) => o.isLineSegments)).toHaveLength(0);
  });

  it('a space level’s area: no rain', () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    scene.add(group);
    nodes.createAreaWeather(group, { data: { glows: data.glows }, frame, at: [0, 0, 0], sea: null, rand: () => 0.5, space: true });
    expect(scene.children.find((o) => o.isLineSegments).visible).toBe(false);
  });

  it('strikes as the GLSL one does: the same bolt, the same flash, gone within half a second', () => {
    const [a, n] = both(build);
    for (const { w } of [a, n]) {
      w.strike(0);
      w.update(0.04, 0, { position: new THREE.Vector3(1, 2, 3) });
    }
    expect(n.w.flash).toBe(a.w.flash);
    expect(n.w.flash).toBeGreaterThan(0.8);
    expect(n.w.strikeAt).toEqual(a.w.strikeAt);
    const boltA = a.group.children.find((o) => o.isLineSegments);
    const boltN = n.group.children.find((o) => o.isLineSegments);
    expect(boltN.visible).toBe(true);
    expect(boltN.geometry.attributes.position.array).toEqual(boltA.geometry.attributes.position.array);
    expect(boltN.material.uniforms.uOn.value).toBe(boltA.material.uniforms.uOn.value);
    const rainN = n.scene.children.find((o) => o.isLineSegments);
    expect(rainN.material.uniforms.uCam.value.toArray()).toEqual([1, 2, 3]);
    for (let i = 0; i < 20; i++) n.w.update(0.05, i * 0.05, null);
    expect(n.w.flash).toBe(0);
    expect(boltN.visible).toBe(false);
  });
});
