import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BREATH, breathing, standing } from './crowdPaint';

// a figure as scripts/crowd.mjs writes it: positions quantized to
// normalized Int16 in [-1, 1], with the node's matrix carrying the real
// scale and offset
function quantized() {
  const geo = new THREE.BufferGeometry();
  const pos = new Int16Array([-16000, -32767, 0, 16000, -32767, 0, 0, 32767, 4000, 0, 0, -4000]);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3, true));
  const nor = new Int8Array([0, 127, 0, 0, 127, 0, 0, 127, 0, 0, 127, 0]);
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true));
  const m = new THREE.Matrix4().compose(new THREE.Vector3(0.1, 0.861, 0), new THREE.Quaternion(), new THREE.Vector3(0.86, 0.86, 0.86));
  return { geo, m };
}

describe('a crowd figure’s geometry', () => {
  it('stands its quantized figure on the floor at its full height', () => {
    const { geo, m } = quantized();
    const g = standing(geo, m, 1.85);
    g.computeBoundingBox();
    expect(g.boundingBox.min.y).toBeCloseTo(0, 3);
    expect(g.boundingBox.max.y).toBeCloseTo(1.85, 3);
    // centred over its feet
    expect((g.boundingBox.min.x + g.boundingBox.max.x) / 2).toBeCloseTo(0, 3);
    expect((g.boundingBox.min.z + g.boundingBox.max.z) / 2).toBeCloseTo(0, 3);
  });
  it('keeps every point in order, none wrapped round', () => {
    const { geo, m } = quantized();
    const g = standing(geo, m, 1.85);
    const y = g.attributes.position;
    // the top vertex (index 2) is the highest, the feet (0, 1) the lowest
    expect(y.getY(2)).toBeCloseTo(1.85, 3);
    expect(y.getY(0)).toBeCloseTo(0, 3);
    expect(y.getY(3)).toBeGreaterThan(y.getY(0));
    expect(y.getY(3)).toBeLessThan(y.getY(2));
  });
});

describe('a crowd figure’s breath', () => {
  it('rises and falls in its vertex shader, on a clock shared by all and a phase of its own', () => {
    const clock = { value: 0 };
    const mat = breathing(new THREE.MeshToonMaterial(), clock, 1.85);
    const shader = { uniforms: {}, vertexShader: ['void main() {', '#include <begin_vertex>', '#include <project_vertex>', '}'].join('\n') };
    mat.onBeforeCompile(shader);
    expect(shader.uniforms.crowdTime).toBe(clock);
    expect(shader.uniforms.crowdTall.value).toBe(1.85);
    expect(shader.vertexShader).toContain('uniform float crowdTime;');
    // (after the vertex is begun, before it's placed: so the instance's matrix takes it where it stands)
    const at = shader.vertexShader.indexOf('crowdBreath');
    expect(at).toBeGreaterThan(shader.vertexShader.indexOf('#include <begin_vertex>'));
    expect(at).toBeLessThan(shader.vertexShader.indexOf('#include <project_vertex>'));
    // (its phase from where it stands, each copy its own)
    expect(BREATH).toContain('instanceMatrix[3]');
    // one program for every kind
    expect(mat.customProgramCacheKey()).toBe(breathing(new THREE.MeshToonMaterial(), clock, 1.5).customProgramCacheKey());
  });
});
