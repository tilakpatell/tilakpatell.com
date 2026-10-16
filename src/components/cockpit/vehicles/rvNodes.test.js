import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { uniform } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { closure, glslSites } from '../../../runtime/shadingClosure';
import * as glsl from './rv';
import * as nodes from './rvNodes';
import { hazy, landMaterial, skyMaterial } from './rvNodesLand';

const FLAGS = ['transparent', 'blending', 'side', 'depthWrite', 'depthTest', 'toneMapped', 'premultipliedAlpha', 'forceSinglePass', 'fog'];
const flags = (m) => Object.fromEntries(FLAGS.map((k) => [k, m[k]]));
const PARTS = ['rvNodes', 'rvNodesKit', 'rvNodesPaint', 'rvNodesDials', 'rvNodesLand', 'rvNodesWings', 'rvNodesCab', 'rvNodesCoach', 'rvNodesOutside'];
const here = (name) => fileURLToPath(new URL(`./${name}.js`, import.meta.url));

// the uniforms rv.js’s sky dome takes, by name, as the twin’s build makes them
const skyUniforms = () => ({
  uPhoto: { value: null },
  uHasPhoto: uniform(0),
  uShift: uniform(0.1),
  uSink: uniform(0),
  uDusk: uniform(0),
  uNight: uniform(0),
  uSunK: uniform(1),
  uLift: uniform(0),
  uTint: uniform(new THREE.Vector3(1.2, 0.82, 0.6)),
  uSun: uniform(new THREE.Vector3(0.5, 0.15, -0.8)),
  uSunCol: uniform(new THREE.Color(1, 0.72, 0.42)),
  uHaze: uniform(new THREE.Color(0.5, 0.4, 0.3)),
});

describe('rvNodes, the twin of rv', () => {
  it('exports what rv exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    expect(typeof nodes.build).toBe('function');
    expect(typeof nodes.prefetch).toBe('function');
  });

  it('reaches no GLSL, and each of its files is under the 800 lines a file may have', () => {
    const files = closure(here('rvNodes'), { read: (p) => readFileSync(p, 'utf8'), exists: existsSync });
    // (the renderer’s frame guard names onBeforeCompile to watch for it, and draws nothing)
    const own = [...files].filter((f) => !/lib\/three\/(frameGuard|renderer|gpuWork)\.js$/.test(f));
    expect(own.filter((f) => glslSites(readFileSync(f, 'utf8')).length)).toEqual([]);
    for (const p of PARTS) {
      expect(files.has(here(p))).toBe(true);
      expect([p, readFileSync(here(p), 'utf8').split('\n').length]).toSatisfy(([, n]) => n < 800);
    }
  });

  it('draws the sky dome and the land’s haze under node materials, with the GLSL’s flags and uniform names', () => {
    const u = skyUniforms();
    const sky = skyMaterial(u);
    const land = landMaterial({ uHaze: u.uHaze, uLift: u.uLift });
    // (the originals, as rv.js makes them, their shaders left out)
    const wasSky = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false });
    const wasLand = new THREE.ShaderMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false });
    expect(sky.isNodeMaterial).toBe(true);
    expect(land.isNodeMaterial).toBe(true);
    expect(flags(sky)).toEqual(flags(wasSky));
    expect(flags(land)).toEqual(flags(wasLand));
    expect(Object.keys(sky.uniforms).sort()).toEqual(Object.keys(u).sort());
    expect(Object.keys(land.uniforms).sort()).toEqual(['uHaze', 'uLift']);
    // (the land’s haze is the sky’s: one uniform, written once a frame)
    expect(land.uniforms.uHaze).toBe(sky.uniforms.uHaze);
    expect(land.uniforms.uLift).toBe(sky.uniforms.uLift);
  });

  it('hazes a node material in place, its program keyed as the GLSL’s was, the speed’s blur on the surfaces that rush by', () => {
    const haze = { color: uniform(new THREE.Color(0.6, 0.4, 0.3)), k: uniform(1 / 3200), rush: uniform(0) };
    const map = new THREE.DataTexture(new Uint8Array([200, 180, 160, 255]), 1, 1);
    const still = new MeshStandardNodeMaterial({ map, roughness: 0.9 });
    const road = new MeshStandardNodeMaterial({ map, roughness: 0.9 });
    expect(hazy(still, haze, 'marks')).toBe(still);
    expect(hazy(road, haze, 'road', null, { rush: true })).toBe(road);
    expect(still.customProgramCacheKey()).toContain('rv-haze-marks');
    expect(road.customProgramCacheKey()).toContain('rv-haze-road-rush');
    expect(still.colorNode).toBeNull();
    expect(road.colorNode?.isNode).toBe(true);
    // (and on a model’s classic material, its node twin in its place)
    const prop = hazy(new THREE.MeshStandardMaterial({ map }), haze, 'prop-brush');
    expect(prop.isMeshStandardNodeMaterial).toBe(true);
    expect(prop.map).toBe(map);
  });
});
