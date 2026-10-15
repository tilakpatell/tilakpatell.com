import * as THREE from 'three/webgpu';
import { Fn, float, instanceIndex, instancedArray, uniform, vec3 } from 'three/tsl';
import { describe, expect, it } from 'vitest';
import { noiseWith } from '../../../lib/three/noiseNodes';
import { cratersWith } from './bodyFamilies';

// one renderer for every build, as a page has: its function cache is where a
// second planet’s program went wrong (the craters’ laid-out function read the
// seed from outside, declared only in the first program it was built into)
const r = new THREE.WebGPURenderer({ canvas: { style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null, width: 1, height: 1 } });
r.hasFeature = () => false;
r.backend.renderer = r;

const wgsl = (use) => {
  const out = instancedArray(1, 'vec4');
  const kernel = Fn(() => {
    out.element(instanceIndex).assign(use());
  })().compute(1);
  const b = new THREE.WGSLNodeBuilder(null, r);
  b.compute = kernel;
  b.build();
  return b.computeShader;
};
const uniformsOf = (code) => ({
  read: new Set(code.replace(/struct objectStruct[^}]*}/, '').match(/nodeUniform\d+/g)),
  declared: new Set(code.match(/struct objectStruct[^}]*}/)[0].match(/nodeUniform\d+/g)),
});

describe('the planets’ craters as nodes', () => {
  it('build again in a second program, the seed declared there too (one planet’s material in two programs)', () => {
    const craters = cratersWith(noiseWith(uniform(new THREE.Vector3(1, 2, 3))));
    for (let i = 0; i < 2; i++) {
      const { read, declared } = uniformsOf(wgsl(() => craters(vec3(1, 2, 3), float(0.5), float(0.01))));
      expect(read.size).toBeGreaterThan(0);
      for (const name of read) expect([...declared]).toContain(name);
    }
  });
});
