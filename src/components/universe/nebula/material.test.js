import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { glslMaterial } from './material';

describe('the nebulae’s one GLSL material', () => {
  it('is a ShaderMaterial of what it is given', () => {
    const m = glslMaterial({ vertexShader: 'void main() {}', fragmentShader: 'void main() {}', uniforms: { uX: { value: 1 } }, transparent: true });
    expect(m).toBeInstanceOf(THREE.ShaderMaterial);
    expect(m.vertexShader).toBe('void main() {}');
    expect(m.uniforms.uX.value).toBe(1);
    expect(m.transparent).toBe(true);
  });
});
