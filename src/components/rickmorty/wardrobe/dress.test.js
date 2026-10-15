import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BODIES, EVERYONE, SWATCHES, swatchById } from './looks';
import { KEYS, MAX_REGIONS, addZones, cloneShaded, dressColors, recolor, regionUniforms, zoneOf } from './dress';

describe('zones', () => {
  it('sorts the Meshy skeleton’s bones into head, torso and arms, legs and feet', () => {
    expect(['neck', 'Head', 'head_end', 'headfront'].map(zoneOf)).toEqual([0, 0, 0, 0]);
    expect(['Spine', 'Spine01', 'Spine02', 'LeftShoulder', 'RightArm', 'RightForeArm'].map(zoneOf)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(['LeftHand', 'RightHand'].map(zoneOf)).toEqual([5, 5]); // (skin: no region takes them)
    expect(['Hips', 'LeftUpLeg', 'RightUpLeg'].map(zoneOf)).toEqual([2, 2, 2]);
    expect(['LeftLeg', 'RightLeg'].map(zoneOf)).toEqual([3, 3]); // (the shins: boots, apart from a coat's tails)
    expect(['LeftFoot', 'RightToeBase'].map(zoneOf)).toEqual([4, 4]);
  });

  it('gives each vertex the zone of the bone that moves it most', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    // bones: 0 Head, 1 Spine, 2 LeftLeg, 3 LeftFoot
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 1, 0, 0, 1, 0, 0, 0, 2, 1, 0, 0, 3, 2, 0, 0], 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute([0.7, 0.3, 0, 0, 0.9, 0.1, 0, 0, 0.6, 0.4, 0, 0, 0.55, 0.45, 0, 0], 4));
    addZones(g, ['Head', 'Spine', 'LeftLeg', 'LeftFoot']);
    expect([...g.attributes.zone.array]).toEqual([0, 1, 3, 4]);
    // and how much of it the hips and legs move, for a line that follows the skin’s (a waist)
    expect([...g.attributes.lower.array].map((x) => +x.toFixed(2))).toEqual([0, 0, 0.6, 1]);
    // and how much the head and neck move it, for one that follows the skin’s round the neck (a collar)
    expect([...g.attributes.upper.array].map((x) => +x.toFixed(2))).toEqual([0.7, 0.1, 0, 0]);
  });

  // (a guest fitted to the 2017 game's skeleton, scripts/guest-rig.mjs: the
  // same figure, its weights on the game's bones)
  it('sorts the 2017 game’s bones into the zones their Meshy counterparts are in', () => {
    const pairs = { neck: 'Neck', Head: 'Head', Spine02: 'Spine', Spine01: 'Spine1', Spine: 'Spine2', LeftShoulder: 'LeftShoulder', RightForeArm: 'RightForeArm', RightHand: 'RightHand', Hips: 'Hips', LeftUpLeg: 'LeftUpLeg', RightLeg: 'RightLeg', LeftFoot: 'LeftFoot', RightToeBase: 'RightToeBase' };
    for (const [meshy, game] of Object.entries(pairs)) expect(zoneOf(game), game).toBe(zoneOf(meshy));
    // (the game's second neck joint and its crown, which Meshy has none for)
    expect(['Neck1', 'HeadEnd'].map(zoneOf)).toEqual([0, 0]);
  });

  it('gives a vertex on the game’s rig the zone it has on Meshy’s', () => {
    const zones = (bones) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
      // a vertex wholly on each of the four bones
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 1, 0, 0, 0, 2, 3, 0, 0, 3, 2, 0, 0], 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 0.6, 0.4, 0, 0, 0.7, 0.3, 0, 0], 4));
      const a = addZones(g, bones).attributes;
      return [[...a.zone.array], [...a.upper.array].map((x) => +x.toFixed(2))];
    };
    const meshy = zones(['LeftUpLeg', 'Spine01', 'neck', 'Spine']);
    const game = zones(['LeftUpLeg', 'Spine1', 'Neck', 'Spine2']);
    expect(game).toEqual(meshy);
    expect(game[0]).toEqual([2, 1, 0, 1]);
    expect(game[1]).toEqual([0, 0, 0.6, 0.3]);
  });
});

describe('regions', () => {
  it('has a colour key for every region of every body, Walt’s and Jesse’s too', () => {
    for (const who of EVERYONE) {
      for (const b of BODIES[who]) {
        expect(Object.keys(b.regions).length).toBeLessThanOrEqual(MAX_REGIONS);
        for (const r of Object.keys(b.regions)) {
          const k = KEYS[b.id]?.[r];
          expect(k, `${b.id} ${r}`).toBeDefined();
          expect(k.zones.length).toBeGreaterThan(0);
          for (const range of [k.sat, k.val]) expect(range[0]).toBeLessThan(range[1]);
        }
      }
    }
  });

  it('turns a look’s colours into the shader’s numbers, its body’s own fixes where nothing’s picked', () => {
    const portal = SWATCHES.find((s) => s.id === 'portalgreen');
    const u = regionUniforms('morty', { inner: 'portalgreen' });
    const i = u.order.indexOf('inner');
    expect(u.on[i]).toBe(1);
    expect(u.swatch[i].getHexString(THREE.NoColorSpace)).toBe(portal.hex.slice(1)); // (sRGB numbers, as the windows are)
    expect(u.on.filter(Boolean)).toHaveLength(1);
    // Rick's coat comes out white even untouched (the HD texture's grey patches, flattened)
    const r = regionUniforms('rick', {});
    expect(r.on[r.order.indexOf('outer')]).toBe(1);
    expect(regionUniforms('rick', {}).order).toHaveLength(MAX_REGIONS);
  });

  it('gives Mr. White and Heisenberg their own colours on Walt’s one figure, and hands where the suit has gloves', () => {
    const hex = (u, r) => u.swatch[u.order.indexOf(r)].getHexString(THREE.NoColorSpace);
    const suit = regionUniforms('walt', {});
    expect(suit.on.filter(Boolean)).toHaveLength(0); // (as the figure comes)
    const white = regionUniforms('mrwhite', {});
    expect(hex(white, 'outer')).toBe(swatchById('tanjacket').hex.slice(1));
    expect(hex(white, 'inner')).toBe(swatchById('waltgreen').hex.slice(1));
    expect(white.order).toContain('gloves'); // (not one of his regions: nobody picks it)
    expect(white.on[white.order.indexOf('gloves')]).toBe(1);
    const h = regionUniforms('heisenberg', { outer: 'bluesky' });
    expect(hex(h, 'outer')).toBe(swatchById('bluesky').hex.slice(1));
    expect(hex(h, 'legs')).not.toBe(hex(white, 'outer'));
    for (const id of ['walt', 'mrwhite', 'heisenberg', 'jesse', 'jesselab']) expect(regionUniforms(id, {}).order).toHaveLength(MAX_REGIONS);
  });

  it('gives Walt’s and Jesse’s triangles one zone each, so a wrist is never read as a shin', () => {
    const compile = (m) => {
      const s = { uniforms: {}, vertexShader: 'void main() {\n}', fragmentShader: 'void main() {\n#include <map_fragment>\n}' };
      m.onBeforeCompile(s, null);
      return s;
    };
    const bb = compile(recolor(new THREE.MeshToonMaterial(), 'jesse', {}));
    expect(bb.vertexShader).toContain('flat varying float vZone;');
    expect(bb.fragmentShader).toContain('flat varying float vZone;');
    expect(bb.fragmentShader).toContain('rgLower');
    const rm = compile(recolor(new THREE.MeshToonMaterial(), 'rick', {})); // (Rick and Morty’s keys were tuned as they blend: left so)
    expect(rm.vertexShader).not.toContain('flat');
    expect(rm.fragmentShader).not.toContain('flat');
    expect(rm.fragmentShader).not.toContain('rgLower');
  });

  it('reads a zone’s bit only for a zone there is, so a sample past a triangle’s edge is never NaN', () => {
    // (multisampled, an edge pixel's shader runs at its centre, off the
    // triangle: a blended zone goes on past its corners, far under 0 on a
    // sliver, exp2 of it is 0, and the bit read is NaN, which the bloom
    // spreads over the whole frame: the Citadel's one black frame)
    const compile = (m) => {
      const s = { uniforms: {}, vertexShader: 'void main() {\n}', fragmentShader: 'void main() {\n#include <map_fragment>\n}' };
      m.onBeforeCompile(s, null);
      return s.fragmentShader;
    };
    for (const body of ['rick', 'jesse']) {
      const fs = compile(recolor(new THREE.MeshToonMaterial(), body, {}));
      expect(fs, body).toMatch(/\(known \? mod\(floor\(rgZones\[i\] \/ exp2\(zone\)\), 2\.0\) : 0\.0\)/);
      expect(fs, body).toContain(`bool known = zone >= 0.0 && zone <= ${zoneOf('LeftHand')}.0;`);
    }
  });

  it('ends Mr. White’s jacket at his waist, where the hips start moving him', () => {
    const u = regionUniforms('mrwhite', {});
    const at = (r) => u.lower[u.order.indexOf(r)];
    expect(at('outer').y).toBeLessThanOrEqual(0.5);
    expect(at('legs').x).toBeGreaterThanOrEqual(0.5);
    expect(at('shoes').x).toBeLessThan(0); // (open: anywhere)
  });

  it('turns Mr. White’s and Heisenberg’s collars to their jackets where the head stops moving them, not a triangle at a time', () => {
    for (const body of ['mrwhite', 'heisenberg']) {
      const u = regionUniforms(body, {});
      const at = (r) => u.upper[u.order.indexOf(r)];
      const zones = (r) => u.zones[u.order.indexOf(r)];
      // (the collar and the jacket share the head's and the torso's zones, and split by `upper` alone)
      expect(zones('inner') & 0b11, body).toBe(0b11);
      expect(zones('outer') & 0b11, body).toBe(0b11);
      // (round the middle, a little over each other: no gap between for the suit's own yellow to show through)
      expect(at('inner').x, body).toBeGreaterThan(0.35);
      expect(at('outer').y, body).toBeLessThan(0.65);
      expect(at('inner').x, body).toBeLessThan(at('outer').y);
      expect(at('legs').x, body).toBeLessThan(0); // (open: anywhere)
    }
  });

  it('keys each material’s program on its body, so two bodies never share one', () => {
    const a = recolor(new THREE.MeshToonMaterial(), 'rick', {});
    const b = recolor(new THREE.MeshToonMaterial(), 'morty', {});
    expect(a.customProgramCacheKey()).not.toBe(b.customProgramCacheKey());
    expect(a.userData.regions).toBeDefined();
  });
});

describe('a dressed figure', () => {
  // a figure of one skinned mesh, its material taught a rim (meshyCast's paint)
  const figure = async () => {
    const { rimToon } = await import('../../../lib/three/ink');
    const bone = new THREE.Bone();
    bone.name = 'Spine';
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(12).fill(0), 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    const mesh = new THREE.SkinnedMesh(g, rimToon(new THREE.MeshToonMaterial()));
    mesh.add(bone);
    mesh.bind(new THREE.Skeleton([bone]));
    const group = new THREE.Group();
    group.add(mesh);
    return { group, mesh };
  };
  const compile = (m) => {
    const s = { uniforms: {}, vertexShader: 'void main() {\n#include <begin_vertex>\n}', fragmentShader: 'void main() {\n#include <map_fragment>\n#include <opaque_fragment>\n}' };
    m.onBeforeCompile(s, null);
    return s;
  };

  it('keeps the rim of light its material had, under the new colours', async () => {
    const { group, mesh } = await figure();
    dressColors({ group }, { body: 'morty', colors: { inner: 'portalgreen' } });
    const s = compile(mesh.material);
    expect(s.fragmentShader).toContain('rimColor');
    expect(s.fragmentShader).toContain('rgOn');
    expect(s.uniforms.rimColor).toBeDefined();
    expect(mesh.material.customProgramCacheKey()).toContain('rim');
  });
});

describe('a material copied with its shaders', () => {
  it('keeps the marks of what’s in them, so they aren’t put in twice', () => {
    const m = new THREE.MeshStandardMaterial();
    const house = { uLook: { value: 1 } };
    Object.defineProperty(m.userData, 'house', { value: house, enumerable: false, configurable: true });
    m.onBeforeCompile = () => {};
    const copy = cloneShaded(m);
    expect(copy.onBeforeCompile).toBe(m.onBeforeCompile);
    expect(copy.userData.house).toBe(house);
    expect(Object.keys(copy.userData)).not.toContain('house');
    expect(cloneShaded(new THREE.MeshStandardMaterial()).userData.house).toBeUndefined();
  });
});
