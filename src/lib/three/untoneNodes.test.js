import { describe, expect, it } from 'vitest';
import { uniform, vec3 } from 'three/tsl';
import { untoned } from './untoneNodes';

// The arithmetic is the parity check's to prove (scripts/twin-parity's
// flight:sky:direct: the dome drawn straight to the canvas under the house's
// Neutral, against the GLSL dome that skips tone mapping); here, the face.
describe('untoned', () => {
  it('wraps a colour node in a node, a uniform colour as well as a constant', () => {
    expect(untoned(vec3(0.2, 0.4, 0.8)).isNode).toBe(true);
    expect(untoned(uniform(vec3(0.5))).isNode).toBe(true);
  });

  it('is a new node a call, so two materials never share a build', () => {
    const c = vec3(0.3);
    expect(untoned(c)).not.toBe(untoned(c));
  });
});
