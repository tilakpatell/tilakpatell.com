import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { houseShader } from '../../../lib/three/house';
import { METRE } from '../foot';
import { aimCanopy, bakeCanopy, canopy, canopyShader, cardGroups, crownMaterial, familyOf, placeCanopy, seeCanopy, sunCanopy, tickCanopy } from './canopy';

// (a crown as the GLBs have one: cards of 4 vertices in a shell, quantized,
// a third of them facing in; and a card at its middle)
const crownGeometry = ({ cards = 120, seed = 3 } = {}) => {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const P = [];
  const N = [];
  const I = [];
  const quad = (cx, cy, cz, nx, ny, nz) => {
    const b = P.length / 3;
    for (const [du, dv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.push(cx + du * 0.04, cy + dv * 0.04, cz + (du + dv) * 0.01);
    for (let k = 0; k < 4; k++) N.push(nx, ny, nz);
    // (indexed out of order, as a rebuild might leave them)
    I.push(b + 2, b, b + 1, b + 1, b + 3, b + 2);
  };
  quad(0, 0, 0, 0, 1, 0);
  for (let i = 0; i < cards; i++) {
    const z = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    const o = [r * Math.cos(a) * 0.9, z * 0.9, r * Math.sin(a) * 0.9];
    const inward = i % 3 === 0 ? -1 : 1;
    quad(...o, (o[0] / 0.9) * inward, (o[1] / 0.9) * inward, (o[2] / 0.9) * inward);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(Int16Array.from(P, (v) => Math.round(v * 32767)), 3, true));
  g.setAttribute('normal', new THREE.BufferAttribute(Int8Array.from(N, (v) => Math.round(v * 127)), 3, true));
  g.setIndex(I);
  return g;
};
const outward = (g) => {
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  let sum = 0;
  const pos = g.attributes.position;
  for (let i = 4; i < pos.count; i++) sum += n.fromBufferAttribute(g.attributes.normal, i).normalize().dot(p.fromBufferAttribute(pos, i).normalize());
  return sum / (pos.count - 4);
};
const count = (s, re) => (s.match(re) ?? []).length;

describe('the canopy’s kinds of foliage', () => {
  it('knows a model’s family by its name, and a crown’s cards by their material', () => {
    expect(['CommonTree_3', 'Bush_Long_1', 'Pine_5', 'Grass_Common_Short', 'Fern_2', 'Rock_1'].map(familyOf)).toEqual(['tree', 'bush', 'pine', 'grass', 'flower', 'other']);
    expect(crownMaterial({ name: 'Leaves_Pine' })).toBe(true);
    expect(crownMaterial({ name: 'Leaves_NormalTree.001' })).toBe(true);
    expect(crownMaterial({ name: 'Flowers' })).toBe(false);
  });

  it('finds the cards a geometry is made of, whatever order their vertices are in', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(36), 3));
    // (three quads, their vertices shuffled: 0 4 8 a quad, 1 5 9 …)
    g.setIndex([0, 4, 8, 8, 4, 11, 1, 5, 9, 9, 5, 10, 2, 6, 7, 7, 6, 3]);
    const groups = cardGroups(g);
    const by = new Map();
    groups.forEach((k, i) => by.set(k, [...(by.get(k) ?? []), i]));
    expect(by.size).toBe(3);
    expect([...by.values()].map((v) => v.length)).toEqual([4, 4, 4]);
    expect(groups[0]).toBe(groups[11]);
    expect(groups[2]).toBe(groups[3]);
  });
});

describe('a crown baked for the canopy', () => {
  it('knows how high up and how deep in each card is, one middle a card', () => {
    const g = crownGeometry();
    const was = outward(g);
    expect(was).toBeLessThan(0.5);
    bakeCanopy(g, { foot: -0.9, top: 0.9, family: 'tree', crown: true });
    const c = g.attributes.aCrown;
    expect(c.array).toBeInstanceOf(Uint8Array);
    expect(c.itemSize).toBe(4);
    expect(c.normalized).toBe(true);
    // (height: nought at the foot, one at the top)
    const pos = g.attributes.position;
    let lo = 0;
    let hi = 0;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < pos.getY(lo)) lo = i;
      if (pos.getY(i) > pos.getY(hi)) hi = i;
    }
    expect(c.getX(lo)).toBeLessThan(0.02);
    expect(c.getX(hi)).toBeGreaterThan(0.98);
    // (depth: the middle card deep in, the shell's at the skin; a crown's tone on)
    expect(c.getY(0)).toBeGreaterThan(0.6);
    for (let i = 4; i < pos.count; i += 4) expect(c.getY(i)).toBeLessThan(0.2);
    expect(c.getZ(5)).toBe(1);
    // (every vertex of a card the card's middle)
    const card = g.attributes.aCard;
    for (let i = 4; i < pos.count; i += 4) for (let k = 1; k < 4; k++) for (let j = 0; j < 4; j++) expect(card.array[4 * (i + k) + j]).toBe(card.array[4 * i + j]);
    // (its normals out from its middle)
    expect(outward(g)).toBeGreaterThan(0.9);
    // (and done once)
    const attrs = [g.attributes.aCard, g.attributes.aCrown];
    const normals = g.attributes.normal.array.slice();
    bakeCanopy(g, { foot: 0, top: 1, family: 'tree', crown: true });
    expect([g.attributes.aCard, g.attributes.aCrown]).toEqual(attrs);
    expect(g.attributes.aCard).toBe(attrs[0]);
    expect(g.attributes.normal.array).toEqual(normals);
  });

  it('leaves what isn’t a crown’s normals as they were, and its tone off', () => {
    const g = crownGeometry();
    const normals = g.attributes.normal.array.slice();
    bakeCanopy(g, { foot: -0.9, top: 0.9, family: 'flower', crown: false });
    expect(g.attributes.normal.array).toEqual(normals);
    for (let i = 0; i < g.attributes.position.count; i++) {
      expect(g.attributes.aCrown.getY(i)).toBe(0);
      expect(g.attributes.aCrown.getZ(i)).toBe(0);
    }
  });
});

describe('the canopy’s shader', () => {
  const standard = () => ({ vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader });
  it('moves each card where three has stood it, tones it once it’s lit, and opens it before the cut', () => {
    const out = canopyShader(standard(), { level: 'full' });
    expect(out.swapped).toEqual({ motion: true, keep: true, tone: true });
    const vs = out.vertexShader;
    const fs = out.fragmentShader;
    expect(count(vs, /vec2 windOffset\(/g)).toBe(1);
    const motion = vs.indexOf('transformed += cnDir');
    expect(motion).toBeGreaterThan(vs.indexOf('#include <begin_vertex>'));
    expect(vs.lastIndexOf('#if defined(USE_INSTANCING)', motion)).toBeGreaterThan(vs.indexOf('#include <begin_vertex>'));
    expect(vs.indexOf('#endif', motion)).toBeGreaterThan(motion);
    const uv = vs.indexOf('vMapUv =', vs.indexOf('#include <begin_vertex>'));
    expect(vs.lastIndexOf('#ifdef USE_MAP', uv)).toBeGreaterThan(motion);
    const tone = fs.indexOf('cnTone');
    expect(tone).toBeGreaterThan(fs.indexOf('#include <normal_fragment_maps>'));
    expect(tone).toBeLessThan(fs.indexOf('#include <lights_physical_fragment>'));
    expect(fs.indexOf('cnKeep')).toBeLessThan(fs.indexOf('#include <alphatest_fragment>'));
    for (const name of ['uWindHeight', 'uWindTrunk', 'uWindLeaf']) expect(vs).not.toContain(name);
  });

  it('reads the wind once on a middling device, and not at all on a weak one', () => {
    expect(count(canopyShader(standard(), { level: 'lite' }).vertexShader, /texture2D\(uWindNoise/g)).toBe(1);
    const still = canopyShader(standard(), { level: 'still' }).vertexShader;
    expect(still).toContain('#define CANOPY_STILL');
    expect(still).not.toContain('windOffset');
  });

  it('declares nothing twice beside the house look', () => {
    const out = canopyShader(standard(), { level: 'full' });
    const both = houseShader(out, { fog: false });
    for (const s of [both.vertexShader, both.fragmentShader]) {
      const names = [...s.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*;/gm)].map((m) => m[1]);
      expect(names.length).toBeGreaterThan(5);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('leaves a shader without its lines as it was', () => {
    const odd = { vertexShader: 'void main() {}', fragmentShader: 'void main() {}' };
    const out = canopyShader(odd, { level: 'full' });
    expect(out.vertexShader).toBe(odd.vertexShader);
    expect(out.fragmentShader).toBe(odd.fragmentShader);
    expect(out.swapped).toEqual({ motion: false, keep: false, tone: false });
  });
});

describe('the page’s one canopy', () => {
  it('is made once, aimed on a landing’s frame, and moved on by the clock', () => {
    expect(canopy()).toBe(canopy());
    const u = canopy().uniforms;
    const n = [0.6, 0.8, 0];
    const f = [0, 0, 1];
    aimCanopy({ n, f, R: 55.44 });
    const e1 = u.uCanopyE1.value;
    const e2 = u.uCanopyE2.value;
    expect(e1.length()).toBeCloseTo(1, 9);
    expect(e2.length()).toBeCloseTo(1, 9);
    expect(e1.dot(e2)).toBeCloseTo(0, 9);
    const want = new THREE.Vector3(...n).cross(new THREE.Vector3(...f));
    expect(e1.distanceTo(want)).toBeLessThan(1e-9);
    expect(u.uCanopyRm.value).toBeCloseTo(55.44 / METRE, 9);
    // (the wind's way along the ground there)
    expect(u.uCanopyWind.value.dot(new THREE.Vector3(...n))).toBeCloseTo(0, 9);
    const t = u.uWindTime.value;
    const c = u.uCanopyClock.value;
    tickCanopy(0.5);
    expect(u.uWindTime.value).toBeGreaterThan(t);
    expect(u.uCanopyClock.value).toBeCloseTo(c + 0.5, 9);
    tickCanopy(0);
    expect(u.uCanopyClock.value).toBeCloseTo(c + 0.5, 9);
    for (let i = 0; i < 1300; i++) tickCanopy(0.5);
    expect(u.uCanopyClock.value).toBeLessThan(200 * Math.PI);
    sunCanopy(new THREE.Vector3(0, 0, 0));
    expect(u.uCanopySun.value.length()).toBeCloseTo(1, 9);
    seeCanopy(new THREE.Vector3(1, 2, 3));
    expect(u.uCanopySee.value.toArray()).toEqual([1, 2, 3, 1]);
    seeCanopy(null);
    expect(u.uCanopySee.value.w).toBe(0);
  });

  it('opens round you where you are as a crown is drawn, round the camera (relative.js)', () => {
    const u = canopy().uniforms;
    const map = new THREE.Group();
    const root = new THREE.Group(); // (the landing's, at the planet's middle)
    root.position.set(6326, -520, -14653);
    map.add(root);
    map.updateMatrixWorld();
    seeCanopy(new THREE.Vector3(1, 2, 3), root);
    // drawn(): the map moved by minus the camera, for the draw alone
    map.position.set(-6000, 500, 14000);
    map.updateMatrixWorld();
    placeCanopy();
    expect(u.uCanopySee.value.toArray()).toEqual([327, -18, -650, 1]);
    seeCanopy(null, root);
    placeCanopy();
    expect(u.uCanopySee.value.w).toBe(0);
  });
});
