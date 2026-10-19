// The Eye of Sauron as a fire on a plane, in TSL (so it runs on WebGPU and
// on WebGL 2 under the node renderer alike): a lidless almond of flame, its
// iris streaming outward, the black slit of its pupil turned toward
// whoever looks (`look`, −1…1 each way), a corona of fire licking round it
// and, before it opens (`open` 0), only smoke turning. For the Palantír,
// held, and the night outside the window as the Ring’s dread rises.
//
//   eyeMaterial({ fog }) → { material, open, look, power } (the three uniforms)

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { abs, atan, float, length, max, mix, mx_fractal_noise_float, pow, smoothstep, time, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';

export function eyeMaterial({ fog = false, additive = false } = {}) {
  const open = uniform(0);
  const look = uniform(new THREE.Vector2(0, 0));
  const power = uniform(1);
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog, side: THREE.DoubleSide });
  if (additive) m.blending = THREE.AdditiveBlending;

  const p = uv().sub(0.5).mul(2);
  const r = length(p);
  const ang = atan(p.y, p.x);
  const t = time;
  // the fire’s grain: noise streaming outward from the middle
  const flow = mx_fractal_noise_float(vec3(ang.mul(1.6), r.mul(2.6).sub(t.mul(0.7)), t.mul(0.15)), 4, 2.0, 0.55, 1.0);
  const fine = mx_fractal_noise_float(vec3(p.x.mul(5), p.y.mul(5).sub(t.mul(1.4)), t.mul(0.4)), 3, 2.1, 0.5, 1.0);
  // the lids: an almond that opens with `open`, its edge torn by the fire
  const ax = p.x.div(0.92);
  const lid = max(float(1).sub(ax.mul(ax)), 0).mul(0.46).mul(open);
  const inside = smoothstep(lid.add(0.03), lid.sub(0.05), abs(p.y.add(flow.mul(0.05))));
  // the iris, white-hot at the pupil and darkening out to the lids, streaked
  const q = p.sub(look.mul(vec2(0.22, 0.1)));
  const qr = length(q.mul(vec2(1.0, 1.25)));
  const streak = mx_fractal_noise_float(vec3(atan(q.y, q.x).mul(5), qr.mul(6).sub(t.mul(0.9)), 2.0), 3, 2.0, 0.5, 1.0);
  const heat = pow(max(float(1).sub(qr.mul(1.15)), 0), 1.6).add(streak.mul(0.18));
  const iris = mix(mix(vec3(0.35, 0.02, 0.0), vec3(1.0, 0.32, 0.02), smoothstep(0.0, 0.45, heat)), vec3(1.0, 0.9, 0.55), smoothstep(0.55, 0.95, heat));
  // the pupil: a slit, widest at its middle, black as the pit
  const half = max(float(1).sub(pow(q.y.div(max(lid, 0.001)), 2)), 0).mul(0.075).mul(smoothstep(0.1, 0.5, open));
  const pupil = smoothstep(half.add(0.012), half.sub(0.012), abs(q.x)).mul(inside);
  const eyeColour = iris.mul(float(1).sub(pupil.mul(0.97)));
  // the corona of fire round it, and the smoke before it opens
  const flames = smoothstep(0.95, 0.15, r.add(flow.mul(0.35)).add(fine.mul(0.12))).mul(float(0.35).add(open.mul(0.65)));
  const fireColour = mix(vec3(0.5, 0.05, 0.0), vec3(1.0, 0.45, 0.05), smoothstep(0.2, 0.8, flames.add(fine.mul(0.2))));
  const smoke = smoothstep(1.0, 0.2, r.add(flow.mul(0.4))).mul(float(1).sub(open)).mul(0.85);
  const smokeColour = vec3(0.05, 0.04, 0.07).add(vec3(0.25, 0.08, 0.02).mul(fine.add(0.5).mul(open)));

  const colour = mix(mix(smokeColour, fireColour, smoothstep(0.0, 0.3, open)), eyeColour, inside);
  const alpha = max(max(inside, flames.mul(0.92)), smoke);
  m.colorNode = vec4(colour.mul(power.mul(float(1.0).add(inside.mul(0.6)))), 1);
  m.opacityNode = alpha.mul(smoothstep(1.0, 0.85, r));
  return { material: m, open, look, power };
}
