// The Black Lake: one still sheet of dark water out to the far shore, the
// Road's water's shape (copied: worlds are islands) made for a loch at
// night. A fine ripple from the noise's slope, faded with distance; the
// sky's own colours given back off it by Fresnel over a body near black;
// the moon's path laid across it in broken light; and the castle's windows
// as long warm dashes on the water between you and the crag, the way lit
// windows lie on a loch at night (not a mirror pass: read from where the
// castle stands, so it costs nothing on any tier). Foam where it laps at
// the shingle, read from how deep each vertex stands.
//
// Basic, not standard: its light is the sky's (sky.js's uniforms), so the
// water and the sky never disagree.
//
//   createLake({ sky, ground, level, castle: { at: [x, z], wide, tall } })
//     → { mesh, uniforms, set(light), update(dt), dispose }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, abs, attribute, cameraPosition, dot, float, length, max, mix, normalize, pow, reflect, smoothstep, step, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { noiseWith } from '../../../lib/three/noiseNodes';

const BODY = new THREE.Color(0.006, 0.012, 0.02);
const SHALLOW = new THREE.Color(0.05, 0.06, 0.055);
const FOAM = new THREE.Color(0.55, 0.6, 0.65);
const WARM = new THREE.Color(1.0, 0.62, 0.26);

// The sheet's rows and columns: close together where it laps at the
// shingle (its foam and its depth are read a vertex at a time), opening out
// over the open water toward the far shore
function sheet({ x0, x1, z0, z1, level, ground }) {
  const xs = [];
  for (let x = x0; x < -200; x += 40) xs.push(x);
  for (let x = -200; x < 200; x += 2) xs.push(x);
  for (let x = 200; x <= x1; x += 40) xs.push(x);
  const zs = [];
  // (from the near end out: a metre apart at the shore, each row a little further on)
  for (let z = z1, s = 1; z > z0; z -= s, s *= 1.12) zs.push(z);
  zs.push(z0);
  zs.reverse();
  const pos = [];
  const deep = [];
  for (const z of zs) {
    for (const x of xs) {
      pos.push(x, level, z);
      deep.push(ground ? level - ground(x, z) : 10);
    }
  }
  const index = [];
  const n = xs.length;
  for (let j = 0; j < zs.length - 1; j++)
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      const b = a + n;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new THREE.BufferGeometry().setIndex(index);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(deep, 1));
  g.computeBoundingSphere();
  return g;
}

export function createLake({ sky, ground = null, level = 0, area = { x0: -1600, x1: 1600, z0: -1500, z1: 40 }, castle = { at: [0, -600], wide: 300, tall: 170 } } = {}) {
  const s = sky.uniforms;
  const u = {
    uTime: uniform(0),
    uLight: uniform(0.6),
    uWindows: uniform(1),
    uCastle: uniform(new THREE.Vector3(castle.at[0], 0, castle.at[1])),
    uSeed: uniform(new THREE.Vector3(2.9, 6.1, 3.3)),
  };
  const { noise } = noiseWith(u.uSeed, { octaves: 2 });
  const depth = attribute('aDepth', 'float').toVarying('vLakeDepth');
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });

  const water = Fn(() => {
    const p = attribute('position', 'vec3').toVarying('vLakeP');
    const toEye = cameraPosition.sub(p);
    const dist = length(toEye);
    // the fine ripple, a breath of wind on it, gone to glass far out
    const q = p.xz.mul(2.2).add(vec2(u.uTime.mul(0.25), u.uTime.mul(0.1)));
    const n0 = noise(vec3(q, u.uTime.mul(0.2)), u.uSeed);
    const nx = noise(vec3(q.add(vec2(0.2, 0)), u.uTime.mul(0.2)), u.uSeed).sub(n0);
    const nz = noise(vec3(q.add(vec2(0, 0.2)), u.uTime.mul(0.2)), u.uSeed).sub(n0);
    const fine = float(0.32).mul(float(1).sub(smoothstep(20, 220, dist))).add(0.05);
    const n = normalize(vec3(nx.mul(fine).negate(), 1, nz.mul(fine).negate()));
    const view = normalize(toEye);
    const fres = pow(max(dot(n, view), 0).oneMinus(), 5).mul(0.9).add(0.04);
    const r = reflect(view.negate(), n);
    // the sky given back: the horizon low, the zenith overhead
    const skyCol = mix(s.horizon, s.zenith, pow(max(r.y, 0), 0.45));
    // the moon's path: its glint stretched into a broken road across the water
    const moonR = max(dot(r, normalize(s.moonDir)), 0);
    const moonPath = pow(moonR, 90).mul(1.6).add(pow(moonR, 900).mul(4)).mul(s.moon);
    // the sunset's glow on the water, under where it hangs in the sky
    const sunPath = pow(max(dot(r, normalize(s.sunDir)), 0), 6).mul(smoothstep(0.25, 0.0, r.y)).mul(0.9);
    // the castle's windows: a column of warm light on the water between you
    // and the crag, as wide as the castle, brighter toward it, broken into
    // the long dashes lit windows make on a loch with a breath of wind on it
    const eye = cameraPosition.xz;
    const toC = u.uCastle.xz.sub(eye);
    const far = length(toC);
    const toF = p.xz.sub(eye);
    const near = length(toF);
    const c0 = toC.div(far);
    const f0 = toF.div(near.max(0.01));
    const side = abs(c0.x.mul(f0.y).sub(c0.y.mul(f0.x)));
    const inLine = smoothstep(float(castle.wide * 0.4).div(far), 0.0, side).mul(step(0, dot(c0, f0)));
    const t = near.div(far);
    const run = smoothstep(0.03, 0.5, t).mul(float(1).sub(smoothstep(0.86, 0.97, t)));
    const broken = smoothstep(0.42, 0.72, noise(vec3(p.x.mul(0.18), p.z.mul(1.4), u.uTime.mul(0.5)), u.uSeed).mul(0.5).add(0.5));
    const lights = vec3(WARM.r, WARM.g, WARM.b).mul(inLine.mul(run).mul(broken).mul(u.uWindows).mul(2.2));
    // the body: near black out deep, a little lighter where the shingle shows through
    const sink = smoothstep(0.1, 2.2, depth);
    const body = mix(vec3(SHALLOW.r, SHALLOW.g, SHALLOW.b), vec3(BODY.r, BODY.g, BODY.b), sink).mul(u.uLight);
    const c = mix(body, skyCol, fres).add(vec3(1.0, 0.97, 0.9).mul(moonPath)).add(s.glow.mul(sunPath)).add(lights).toVar();
    // foam where it laps at the shingle, a thin broken line
    const edge = float(1).sub(smoothstep(0.02, 0.14, depth)).mul(smoothstep(0.2, 0.7, n0.mul(0.5).add(0.5)));
    c.assign(mix(c, vec3(FOAM.r, FOAM.g, FOAM.b).mul(u.uLight.add(0.2)), edge.mul(0.6)));
    // none where the shingle stands above it; soft where it meets it
    const alpha = smoothstep(0, 0.08, depth).mul(mix(0.86, 0.98, fres));
    return vec4(c, alpha);
  });

  material.colorNode = water();
  const mesh = new THREE.Mesh(sheet({ ...area, level, ground }), material);
  mesh.name = 'lake';
  // (drawn after the ground it lies over)
  mesh.renderOrder = 1;

  return {
    mesh,
    uniforms: u,
    set(light) {
      // (the water's own body lit by the sky that's left: the hemisphere's)
      u.uLight.value = 0.35 + light.hemi.intensity * 0.8;
      u.uWindows.value = light.windows;
    },
    update: (dt) => void (u.uTime.value += dt),
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
