import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as glsl from './crash';
import * as nodes from './crashNodes';

const FLAGS = ['transparent', 'blending', 'side', 'depthWrite', 'depthTest', 'premultipliedAlpha', 'forceSinglePass'];
const flags = (m) => Object.fromEntries(FLAGS.map((k) => [k, m[k]]));

// (a canvas to paint the spot on, in node: the test only needs it to take the calls)
beforeAll(() => {
  const g = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} };
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => g }) });
});
afterAll(() => vi.unstubAllGlobals());

const make = (C) => {
  const parent = new THREE.Group();
  const body = new THREE.Group();
  const crash = C.createCrash(parent);
  crash.hit({ point: new THREE.Vector3(0, 0, 1), normal: new THREE.Vector3(0, 0, 1), body, radius: 1 });
  crash.arrive({ point: new THREE.Vector3(1, 0, 0), kind: 'cruiser' });
  crash.update(0.1, new THREE.PerspectiveCamera());
  return { parent, body, crash };
};

describe('crashNodes, the twin of crash', () => {
  it('exports what crash exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('makes the same things, each under a node material with the same flags', () => {
    const a = make(glsl);
    const n = make(nodes);
    const all = (w) => [...w.parent.children, ...w.body.children];
    expect(all(n).map((o) => o.type)).toEqual(all(a).map((o) => (o.isPoints ? 'Sprite' : o.type)));
    all(n).forEach((o, i) => {
      expect(o.material.isNodeMaterial).toBe(true);
      expect(flags(o.material)).toEqual(flags(all(a)[i].material));
      expect(o.visible).toBe(all(a)[i].visible);
    });
    const sparks = n.parent.children[1];
    expect(sparks.count).toBe(90);
    n.crash.dispose();
    expect(n.parent.children).toHaveLength(0);
  });

  it('keeps the shaders’ uniforms by name, written as before', () => {
    const a = make(glsl);
    const n = make(nodes);
    const shell = (w) => w.body.children[0].material;
    const portal = (w) => w.parent.children[3].material;
    expect(Object.keys(shell(n).uniforms).sort()).toEqual(Object.keys(shell(a).uniforms).sort());
    expect(Object.keys(portal(n).uniforms).sort()).toEqual(Object.keys(portal(a).uniforms).sort());
    expect(shell(n).uniforms.uAge.value).toBeCloseTo(shell(a).uniforms.uAge.value, 9);
    expect(shell(n).uniforms.uDir.value.toArray()).toEqual(shell(a).uniforms.uDir.value.toArray());
    expect(portal(n).uniforms.uOpen.value).toBeCloseTo(portal(a).uniforms.uOpen.value, 9);
    expect(portal(n).uniforms.uT.value).toBeCloseTo(portal(a).uniforms.uT.value, 9);
  });
});
