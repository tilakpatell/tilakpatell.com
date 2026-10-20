// A tongue of fire on a card that faces the eye, in TSL (WebGPU and WebGL 2
// alike): narrow at the top, its edge torn by noise rising through it,
// white-gold at the root, orange, then red where it thins to nothing. Each
// flame its own `seed`, so a hearth of them never moves as one; `heat` (a
// uniform, 0–2) is the fire’s, higher after a stir.
//
//   flameMaterial({ seed, heat }) → a sprite material, added to what is behind

import * as THREE from 'three';
import { SpriteNodeMaterial } from 'three/webgpu';
import { abs, float, mix, mx_fractal_noise_float, pow, smoothstep, time, uv, vec3, vec4 } from 'three/tsl';

export function flameMaterial({ seed = 0, heat }) {
  const m = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const p = uv();
  const x = p.x.sub(0.5).mul(2);
  const y = p.y;
  const t = time.mul(1.0 + seed * 0.07);
  const rise = mx_fractal_noise_float(vec3(x.mul(2.4), y.mul(3.2).sub(t.mul(2.6)), t.mul(0.35).add(seed * 3.1)), 3, 2.0, 0.5, 1.0);
  const lick = mx_fractal_noise_float(vec3(x.mul(5), y.mul(6).sub(t.mul(4.1)), seed * 1.7), 2, 2.0, 0.5, 1.0);
  // its width at each height: widest a little above the root, to a point
  const width = pow(float(1).sub(y), 0.75).mul(0.62).mul(smoothstep(0.0, 0.16, y).mul(0.5).add(0.5)).add(0.02);
  const sway = rise.mul(0.32).mul(y).add(lick.mul(0.06));
  const inside = smoothstep(width, width.mul(0.35), abs(x.add(sway)));
  const top = smoothstep(1.0, 0.3, y.add(rise.mul(0.28)).add(lick.mul(0.1)));
  const root = smoothstep(0.0, 0.08, y);
  const k = inside.mul(top).mul(root).mul(heat.mul(0.35).add(0.75));
  const colour = mix(mix(vec3(0.55, 0.06, 0.0), vec3(1.0, 0.42, 0.06), smoothstep(0.08, 0.45, k)), vec3(1.0, 0.86, 0.52), smoothstep(0.55, 1.0, k));
  m.colorNode = vec4(colour.mul(1.4), 1);
  m.opacityNode = k.min(1);
  return m;
}
