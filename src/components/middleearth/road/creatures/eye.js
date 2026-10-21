// The Eye of Sauron, drawn: a lidless eye of fire, its iris a ring of
// flame round a black slit, as a TSL colour on a surface’s uv (the Mirror’s
// water now; the tower’s and the beam later, with eye.rules.js’s sweep).
//
//   eyeColour(uvNode, { k, time }) → vec3 node: the eye at strength k (0 none, 1 open)
//     k, time: TSL nodes (uniforms)

import { abs, float, length, mix, sin, smoothstep, vec2, vec3 } from 'three/tsl';

const FIRE = vec3(2.6, 0.7, 0.12);
const HEART = vec3(3.2, 2.2, 0.8);

export function eyeColour(uvNode, { k, time }) {
  // (an almond: wide across, narrow up and down)
  const p = uvNode.sub(0.5).mul(vec2(1, 1.7));
  const d = length(p).mul(2);
  // the iris’ flame, the slit of the pupil, its edge flickering
  const flick = sin(time.mul(7).add(d.mul(23))).mul(0.06);
  const iris = smoothstep(0.95, 0.55, d.add(flick));
  const heart = smoothstep(0.55, 0.15, d);
  const slit = smoothstep(0.035, 0.07, abs(uvNode.x.sub(0.5)).add(d.mul(d).mul(0.05)));
  const col = mix(FIRE, HEART, heart).mul(iris).mul(slit);
  return col.mul(float(k));
}
