// The duel on the node renderer (lane P1, the inside’s port by lane T’s
// method): scripts/twin-parity/originals/deathstar/saber.js’s two shaders as TSL, with the same names, flags
// and arithmetic, reading the attributes saber.js writes.
//
//   bladeGlowMaterial() → 'ds-saber-glow'   the blades’ glows, the arcs, sparks, flashes and ripples, added
//   trailMaterial() → 'ds-trail'   the ribbon a swung blade leaves, added

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { attribute, exp, max, mix, step } from 'three/tsl';
import { facing, reachOf } from './fx';

// A sprite facing the eye (./fx.js’s), a soft glow; or, with a band
// (aSize.z), a thin bright ring at its edge, as a ripple in the air catches
// the light.
export function bladeGlowMaterial() {
  const m = new MeshBasicNodeMaterial({ lights: false, name: 'ds-saber-glow', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
  const v = facing(m, 'vec3');
  const r = reachOf(v);
  const glow = exp(r.mul(r).mul(-5)).mul(r.oneMinus());
  const w = max(v.vBand, 1e-3);
  const x = r.sub(1).add(w).div(w.mul(0.5));
  const ring = exp(x.mul(x).negate());
  m.colorNode = v.vColour.mul(mix(glow, ring, step(1e-4, v.vBand)));
  m.maskNode = r.lessThan(1);
  return m;
}

// A trail: the ribbon between where a blade was and where it is, brightest
// along the tip’s path (aEdge 1) and fading to nothing at the hilt’s (0).
export function trailMaterial() {
  const m = new MeshBasicNodeMaterial({ lights: false, name: 'ds-trail', transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
  const edge = attribute('aEdge', 'float');
  m.colorNode = attribute('aColour', 'vec3').mul(edge).mul(edge).mul(edge);
  return m;
}
