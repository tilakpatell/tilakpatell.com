// The Eye of Sauron as a fire on a plane, in TSL (so it runs on WebGPU and
// on WebGL 2 under the node renderer alike): a lidless almond of flame,
// wider than it is tall, its tongues streaming out and up; the iris
// streaked from white-hot at the pupil to blood red at the lids; the pupil a
// black slit with a burning rim, turned toward whoever looks (`look`, −1…1
// each way) and narrowing as it fixes on them (`focus`); and before it opens
// (`open` 0) only smoke turning. With `tower`, Barad-dûr stands black under
// it, the Eye held between its horns, a few windows lit.
//
//   eyeMaterial({ fog, additive, tower }) → { material, open, look, power, focus }
//   towerArt(px) → a canvas: the tower’s silhouette, for `tower`

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { abs, atan, float, length, max, mix, mx_fractal_noise_float, pow, smoothstep, texture, time, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { makeCanvas } from '../../../lib/paint';

// Barad-dûr, black: its body rising to the two horns that hold the Eye
export function towerArt(px = 256) {
  const c = makeCanvas(px, px);
  const ctx = c.getContext('2d');
  const P = (x, y) => [x * px, y * px];
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(...P(0.3, 1));
  ctx.lineTo(...P(0.36, 0.78));
  ctx.lineTo(...P(0.33, 0.74));
  ctx.lineTo(...P(0.4, 0.66));
  // the left horn, up and round the Eye
  ctx.quadraticCurveTo(...P(0.2, 0.55), ...P(0.24, 0.3));
  ctx.lineTo(...P(0.29, 0.38));
  ctx.quadraticCurveTo(...P(0.3, 0.56), ...P(0.46, 0.62));
  ctx.lineTo(...P(0.54, 0.62));
  ctx.quadraticCurveTo(...P(0.7, 0.56), ...P(0.71, 0.38));
  ctx.lineTo(...P(0.76, 0.3));
  ctx.quadraticCurveTo(...P(0.8, 0.55), ...P(0.6, 0.66));
  ctx.lineTo(...P(0.67, 0.74));
  ctx.lineTo(...P(0.64, 0.78));
  ctx.lineTo(...P(0.7, 1));
  ctx.closePath();
  ctx.fill();
  // a few windows, lit by the fires inside
  ctx.fillStyle = 'rgba(255, 90, 20, 0.9)';
  for (const [x, y] of [[0.48, 0.72], [0.52, 0.8], [0.47, 0.88], [0.53, 0.94], [0.5, 0.68]]) ctx.fillRect(x * px - px * 0.006, y * px - px * 0.008, px * 0.012, px * 0.016);
  return c;
}

export function eyeMaterial({ fog = false, additive = false, tower = null } = {}) {
  const open = uniform(0);
  const look = uniform(new THREE.Vector2(0, 0));
  const power = uniform(1);
  const focus = uniform(0);
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog, side: THREE.DoubleSide });
  if (additive) m.blending = THREE.AdditiveBlending;

  // (with the tower, the Eye sits up between its horns, a little smaller)
  const lift = tower ? 0.42 : 0;
  const scale = tower ? 1.45 : 1;
  const raw = uv().sub(0.5).mul(2);
  const p = vec2(raw.x, raw.y.sub(lift)).mul(scale);
  const r = length(p);
  const t = time;
  // the fire’s grain: noise streaming outward from the middle, and up
  const ang = atan(p.y, p.x);
  const flow = mx_fractal_noise_float(vec3(ang.mul(1.6), r.mul(2.6).sub(t.mul(0.7)), t.mul(0.15)), 4, 2.0, 0.55, 1.0);
  const rising = mx_fractal_noise_float(vec3(p.x.mul(3.2), p.y.mul(2.2).sub(t.mul(1.6)), t.mul(0.3)), 4, 2.0, 0.5, 1.0);
  const fine = mx_fractal_noise_float(vec3(p.x.mul(7), p.y.mul(7).sub(t.mul(2.1)), t.mul(0.5)), 3, 2.1, 0.5, 1.0);
  // the lids: an almond that opens with `open`, torn at its edge by the fire
  const ax = p.x.div(0.9);
  const lid = max(float(1).sub(ax.mul(ax)), 0).mul(0.42).mul(open);
  const inside = smoothstep(lid.add(0.03), lid.sub(0.05), abs(p.y.add(flow.mul(0.05))));
  // the iris, white-hot at the pupil and darkening to blood at the lids, streaked
  const q = p.sub(look.mul(vec2(0.2, 0.08)));
  const qr = length(q.mul(vec2(1.0, 1.3)));
  const streak = mx_fractal_noise_float(vec3(atan(q.y, q.x).mul(6), qr.mul(7).sub(t.mul(1.1)), 2.0), 3, 2.0, 0.5, 1.0);
  const heat = pow(max(float(1).sub(qr.mul(1.2)), 0), 1.4).add(streak.mul(0.22)).add(focus.mul(0.15));
  const iris = mix(mix(vec3(0.3, 0.01, 0.0), vec3(1.0, 0.3, 0.02), smoothstep(0.0, 0.42, heat)), vec3(1.0, 0.93, 0.62), smoothstep(0.55, 0.95, heat));
  // the pupil: a slit, widest at its middle, narrowing as it fixes on you
  const half = max(float(1).sub(pow(q.y.div(max(lid, 0.001)), 2)), 0).mul(float(0.07).sub(focus.mul(0.035))).mul(smoothstep(0.1, 0.5, open));
  const pupil = smoothstep(half.add(0.01), half.sub(0.01), abs(q.x)).mul(inside);
  const burn = smoothstep(half.add(0.07), half.add(0.005), abs(q.x)).mul(inside).sub(pupil).max(0);
  const eyeColour = iris.add(vec3(1.0, 0.85, 0.4).mul(burn.mul(0.8)));
  // the corona: wider than tall, its tongues going out and up
  const wide = length(p.mul(vec2(0.72, 1.35)));
  const tongues = smoothstep(0.95, 0.12, wide.add(flow.mul(0.3)).add(rising.mul(0.28)).sub(max(p.y, 0).mul(rising.add(0.5).mul(0.35)))).mul(float(0.3).add(open.mul(0.7)));
  const fireColour = mix(mix(vec3(0.35, 0.02, 0.0), vec3(0.95, 0.3, 0.02), smoothstep(0.15, 0.6, tongues.add(fine.mul(0.15)))), vec3(1.0, 0.75, 0.25), smoothstep(0.7, 1.0, tongues.add(fine.mul(0.2))));
  const smoke = smoothstep(1.0, 0.15, r.add(flow.mul(0.45))).mul(float(1).sub(open)).mul(0.9);
  const smokeColour = vec3(0.04, 0.03, 0.06).add(vec3(0.3, 0.07, 0.02).mul(fine.add(0.5).mul(open.add(0.15))));

  let colour = mix(mix(smokeColour, fireColour, smoothstep(0.0, 0.3, open)), eyeColour, inside).mul(float(1).sub(pupil));
  let alpha = max(max(inside, tongues.mul(0.95)), smoke);
  if (tower) {
    const tex = texture(tower, uv());
    const body = tex.a.mul(smoothstep(0.0, 0.25, open.add(0.1)));
    // (black against the fire; its windows glow)
    colour = mix(colour, tex.rgb.mul(1.8), body);
    alpha = max(alpha, body);
  }
  m.colorNode = vec4(colour.mul(power.mul(float(1.0).add(inside.mul(0.6)))), 1);
  m.opacityNode = alpha.mul(smoothstep(1.0, 0.86, length(raw)));
  return { material: m, open, look, power, focus };
}
