import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYSTEMS, systemById } from '../systems';
import * as glsl from '../world';
import * as nodes from './world';

// the planets stood in for on both sides (bodies.js and its twin have their
// own tests): these are about what's built round them, and what draws it
const stubBody = (look, { r }) => ({ group: new THREE.Group(), radius: r, reach: r * 1.08, update() {}, setSuns() {}, set() {}, setDetail() {}, dispose() {} });
vi.mock('../bodies', () => ({ buildBody: (...a) => stubBody(...a) }));
vi.mock('./bodies', () => ({ buildBody: (...a) => stubBody(...a) }));

const kit = () => ({
  models: { slot: (kind, size) => ({ kind, size, holder: new THREE.Group(), real: false }), drop: () => {} },
  bolts: { fire: vi.fn(() => true) },
  flashes: { at: vi.fn() },
});
const T0 = 1_790_000_000;
const camera = new THREE.PerspectiveCamera();

// the same dice for both sides: Math.random from a seed, reset before each
let seed = 1;
const dice = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const rolling = () => {
  seed = 1;
  return vi.spyOn(Math, 'random').mockImplementation(dice);
};
afterEach(() => vi.restoreAllMocks());

const flags = ['transparent', 'blending', 'side', 'depthWrite', 'depthTest', 'toneMapped', 'opacity', 'roughness', 'metalness'];
const shape = (o) => ({ name: o.name, type: o.type === 'Sprite' ? 'Points' : o.type, visible: o.visible, at: o.position.toArray(), q: o.quaternion.toArray(), s: o.scale.toArray(), kids: o.children.length });
const solidsOf = (w) => w.solids.map((o) => ({ ...o, at: [...o.at] }));
// every material the system made itself (not the stand-in ships' or the helpers' own)
const materials = (w) => {
  const list = [];
  w.group.traverse((o) => o.material && list.push([o, o.material]));
  return list;
};

describe('nodes/world, the twin of world', () => {
  it('exports what world.js exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('builds every system as world.js does, and plays a few minutes of it the same', () => {
    for (const sys of SYSTEMS) {
      const ka = kit();
      const kn = kit();
      let spy = rolling();
      const a = glsl.buildSystem(sys, { ...ka, small: false, ratio: 1.5 });
      spy.mockRestore();
      spy = rolling();
      const n = nodes.buildSystem(sys, { ...kn, small: false, ratio: 1.5 });
      spy.mockRestore();
      expect(Object.keys(n).sort(), sys.id).toEqual(Object.keys(a).sort());
      expect(Object.keys(n.war).sort()).toEqual(Object.keys(a.war).sort());
      expect(solidsOf(n), sys.id).toEqual(solidsOf(a));
      expect(n.goals.map((g) => g.id)).toEqual(a.goals.map((g) => g.id));
      expect(n.group.name).toBe(a.group.name);
      expect(n.group.children.length, sys.id).toBe(a.group.children.length);
      for (const step of [0, 1, 7, 40, 95, 160, 230, 300]) {
        for (const w of [a, n]) {
          const s = rolling();
          w.busy = w.update(T0 + step, 0.5, camera, null);
          s.mockRestore();
        }
        expect(n.busy, `${sys.id} @${step}`).toBe(a.busy);
        expect(solidsOf(n), `${sys.id} @${step}`).toEqual(solidsOf(a));
        expect(n.events).toEqual(a.events);
        expect(n.group.children.map(shape), `${sys.id} @${step}`).toEqual(a.group.children.map(shape));
      }
      expect(kn.bolts.fire.mock.calls.length).toBe(ka.bolts.fire.mock.calls.length);
      expect(kn.flashes.at.mock.calls.length).toBe(ka.flashes.at.mock.calls.length);
      a.dispose();
      n.dispose();
    }
  });

  it('draws with node materials only, the same flags as the originals', () => {
    for (const sys of SYSTEMS) {
      const a = glsl.buildSystem(sys, { ...kit(), small: false });
      const n = nodes.buildSystem(sys, { ...kit(), small: false });
      const ma = materials(a);
      const mn = materials(n);
      expect(mn.length, sys.id).toBe(ma.length);
      mn.forEach(([o, m], i) => {
        const g = ma[i][1];
        expect(m.isShaderMaterial && !m.isNodeMaterial, `${sys.id} ${o.name} ${m.type}`).toBeFalsy();
        expect(m.onBeforeCompile.toString(), `${sys.id} ${m.type}`).toBe(THREE.Material.prototype.onBeforeCompile.toString());
        // (a ShaderMaterial had no tone-mapping chunk: its twin is not tone mapped, whatever its flag said)
        for (const k of flags) if (k in g && !(g.isShaderMaterial && k === 'toneMapped')) expect(m[k], `${sys.id} ${i} ${g.type} ${k}`).toBe(g[k]);
        if (g.isShaderMaterial) expect(m.toneMapped).toBe(false);
        if (g.uniforms) {
          expect(Object.keys(m.uniforms).sort()).toEqual(Object.keys(g.uniforms).sort());
          for (const k of Object.keys(g.uniforms)) expect(m.uniforms[k].value, k).toEqual(g.uniforms[k].value);
        }
      });
      a.dispose();
      n.dispose();
    }
  });

  it('draws the second Death Star’s shield on a node material, lit where it was hit', () => {
    const a = glsl.buildSystem(systemById('endor'), { ...kit(), small: false });
    const n = nodes.buildSystem(systemById('endor'), { ...kit(), small: false });
    const m = n.dsShield.mat;
    expect(m.isNodeMaterial).toBe(true);
    expect(n.dsShield.R).toBe(a.dsShield.R);
    expect(Object.keys(m.uniforms).sort()).toEqual(['uHit', 'uOn']);
    for (const k of ['transparent', 'blending', 'depthWrite', 'side']) expect(m[k], k).toBe(a.dsShield.mat[k]);
    n.shieldHit();
    a.shieldHit();
    expect(m.uniforms.uHit.value).toBe(1);
    for (const w of [a, n]) w.update(T0, 0.2, camera, null);
    expect(m.uniforms.uHit.value).toBeCloseTo(a.dsShield.mat.uniforms.uHit.value, 10);
    expect(m.uniforms.uOn.value).toBeCloseTo(a.dsShield.mat.uniforms.uOn.value, 10);
    // (and the flash as it fails, up then down, the same on both)
    for (const w of [a, n]) {
      w.war.holdShield(true);
      w.update(T0 + 0.2, 0.2, camera, null);
      w.war.holdShield(false);
      w.update(T0 + 0.4, 0.2, camera, null);
      w.update(T0 + 0.6, 0.2, camera, null);
    }
    expect(m.uniforms.uHit.value).toBeCloseTo(1 - 0.2 * 1.5, 10);
    expect(m.uniforms.uHit.value).toBeCloseTo(a.dsShield.mat.uniforms.uHit.value, 10);
    expect(m.uniforms.uOn.value).toBeCloseTo(a.dsShield.mat.uniforms.uOn.value, 10);
    a.dispose();
    n.dispose();
  });

  it('draws Coruscant’s skylanes on a node material, sized for the pixel ratio it is told', () => {
    const lanesOf = (w) => {
      const found = [];
      w.group.traverse((o) => o.material?.uniforms?.uDpr && found.push(o.material));
      return found;
    };
    const n = nodes.buildSystem(systemById('coruscant'), { ...kit(), small: false, ratio: 0.75 });
    const [m] = lanesOf(n);
    expect(m.isNodeMaterial).toBe(true);
    expect(m.uniforms.uDpr.value).toBe(0.75);
    n.setRatio(1.25);
    expect(m.uniforms.uDpr.value).toBe(1.25);
    n.update(T0, 0, camera, null);
    expect(m.uniforms.uTime.value).toBe(T0 % 7200);
    n.dispose();
  });
});
