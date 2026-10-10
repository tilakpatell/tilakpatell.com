import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { uniform } from 'three/tsl';
import { createSky } from '../sky';
import { MAX_BODIES, MAX_SUNS, skyMaterial, skyUniforms } from './sky';
import { SITE as BESPIN } from '../sites/bespin';

// The node dome against the GLSL one: its flags, and its uniforms under the
// same names with the same values (an array's elements shared with its nodes)
const plain = (v) => (v?.toArray ? v.toArray() : Array.isArray(v) ? v.map(plain) : v);

describe('the sky as nodes', () => {
  it('the dome’s flags: inside of the sphere, no depth written, no fog', () => {
    const glsl = createSky(BESPIN).mesh.material;
    const { material } = skyMaterial(BESPIN);
    expect(material.isNodeMaterial).toBe(true);
    for (const k of ['side', 'depthWrite', 'fog', 'transparent']) expect(material[k]).toBe(glsl[k]);
    expect(material.vertexNode?.isNode).toBe(true); // (on the far plane)
  });

  it('the same uniforms, by name and value', () => {
    const glsl = createSky(BESPIN).uniforms;
    const u = skyUniforms(BESPIN);
    expect(Object.keys(u).sort()).toEqual(Object.keys(glsl).sort());
    for (const k of Object.keys(glsl).filter((k) => k !== 'uNoise')) expect(plain(u[k].value)).toEqual(plain(glsl[k].value));
    expect(u.uNoise.value).toBe(glsl.uNoise.value);
    expect(u.uSunDir.nodes).toHaveLength(MAX_SUNS);
    expect(u.uBody.nodes).toHaveLength(MAX_BODIES);
    // (an array element written in place reaches its node)
    u.uSunDir.value[0].set(0, 0, 1);
    expect(u.uSunDir.nodes[0].value).toBe(u.uSunDir.value[0]);
  });

  it('the cloudless copy for reflections shares every uniform but its own clouds switch', () => {
    const a = skyMaterial(BESPIN, { clouds: 1 });
    const b = skyMaterial(BESPIN, { uniforms: { ...a.uniforms, uWithClouds: uniform(0) } });
    expect(b.uniforms.uZenith).toBe(a.uniforms.uZenith);
    expect(b.uniforms.uWithClouds).not.toBe(a.uniforms.uWithClouds);
    expect(b.material).not.toBe(a.material);
    expect(b.material.side).toBe(THREE.BackSide);
  });
});
