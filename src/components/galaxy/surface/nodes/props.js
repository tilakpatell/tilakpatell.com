// The surface's props' shaders as nodes: the towers' lit windows
// (../props/windows.js, a hook on the tower's own material), the Gungans'
// shield (../props/core.js) and the light shafts under Endor's canopy
// (../props/forest.js), line for line, with the same uniform names. A
// material standing for a ShaderMaterial carries its uniforms on
// `material.uniforms` as well, so the frame code's
// `mat.uniforms.uTime.value = t` writes them as before.
//
//   litWindows(material, { seed, density, cell, warm, cool }) → the node material, dressed once
//   shieldMaterial() → material (.uniforms: uTime, uColor)
//   shaftMaterial(color, strength) → material (.uniforms: uColor, uK)

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { abs, cameraPosition, clamp, dot, float, floor, fract, length, modelWorldMatrix, normalWorldGeometry, normalize, positionGeometry, pow, select, sin, smoothstep, step, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { asNode, instanceMatrixOf, onLight, wrap } from '../../../../lib/three/hookNodes';

// ── the towers' windows ──

// (the house's full light, the look's uLookRef, says how bright the day
// is: the house puts its uniforms on the material's userData)
export function litWindows(material, { seed = 1, density = 0.55, cell = [3, 4], warm = '#ffd49a', cool = '#9ad4ff' } = {}) {
  if (!material || material.userData.windows) return material;
  const m = asNode(material);
  const uniforms = {
    uWindowGrid: uniform(new THREE.Vector2(cell[0], cell[1])),
    uWindowDensity: uniform(density),
    uWindowSeed: uniform(seed),
    uWindowWarm: uniform(new THREE.Color(warm).multiplyScalar(1.6)),
    uWindowCool: uniform(new THREE.Color(cool).multiplyScalar(1.4)),
  };
  const u = uniforms;
  const hash = (q) => {
    let p = fract(q.mul(vec2(123.34, 456.21)).add(u.uWindowSeed));
    p = p.add(dot(p, p.add(45.32)));
    return fract(p.x.mul(p.y));
  };
  // VERT: the vertex in its instance's frame (not the mesh's), and a seed
  // a tower from where it stands
  const where = new WeakMap();
  wrap(
    m,
    'setupPosition',
    (out, builder) => {
      const im = instanceMatrixOf(builder);
      const wp = im ? im.mul(vec4(positionGeometry, 1)).xyz : positionGeometry;
      const tower = im ? dot(im.mul(vec4(0, 0, 0, 1)).xyz, vec3(0.37, 0.11, 0.73)) : float(0);
      where.set(builder, { pos: wp.toVarying('vWindowPos'), tower: tower.toVarying('vWindowTower') });
      return out;
    },
    'windows:vertex',
  );
  // FRAG: after the emissive map, the windows' light added to the glow
  onLight(
    m,
    (light, builder) => {
      const { pos, tower } = where.get(builder) ?? { pos: positionGeometry, tower: float(0) };
      const wn = normalize(pos.sub(vec3(0, pos.y, 0)).add(1e-5));
      const wu = select(abs(wn.x).greaterThan(abs(wn.z)), pos.z, pos.x);
      const wc = vec2(wu, pos.y).div(u.uWindowGrid);
      const wf = fract(wc);
      const wi = floor(wc).add(tower);
      const lit = step(hash(wi), u.uWindowDensity.mul(clamp(pos.y.div(300), 0, 1).mul(-0.5).add(1.2)));
      const pane = step(0.18, wf.x).mul(step(wf.x, 0.82)).mul(step(0.25, wf.y)).mul(step(wf.y, 0.75));
      const flicker = hash(wi.add(7)).mul(0.15).add(0.85);
      const tint = select(hash(wi.add(3)).lessThan(0.7), u.uWindowWarm, u.uWindowCool);
      // (no house: the GLSL's uLookRef was never set, nought, so full night)
      const ref = m.userData.house?.uLookRef ?? vec3(0, 0, 0);
      const day = clamp(dot(ref, vec3(0.2126, 0.7152, 0.0722)).div(0.9), 0, 1);
      return light.add(tint.mul(lit).mul(pane).mul(flicker).mul(day.mul(0.85).oneMinus()));
    },
    'windows',
    uniforms,
  );
  m.userData.windows = uniforms;
  return m;
}

const shown = (material, uniforms) => {
  material.uniforms = uniforms;
  return material;
};

// ── the Gungans' shield ──

export function shieldMaterial() {
  const u = { uTime: uniform(0), uColor: uniform(new THREE.Color('#9ad6ff')) };
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
  const vW = modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz.toVarying('vW');
  const vN = normalWorldGeometry;
  const v = normalize(cameraPosition.sub(vW));
  const f = abs(dot(normalize(vN), v)).oneMinus();
  const band = sin(vW.y.mul(0.5).sub(u.uTime.mul(2.2)).add(sin(vW.x.mul(0.04).add(u.uTime.mul(0.7))).mul(3)).add(vW.z.mul(0.03))).mul(0.5).add(0.5);
  const a = pow(f, 2.2).mul(0.75).add(0.07).add(band.mul(band).mul(0.08));
  // (gl_FragColor's alpha was 1: added on, its colour already times a)
  material.colorNode = u.uColor.mul(band.mul(0.5).add(0.7)).mul(a);
  material.opacityNode = float(1);
  return shown(material, u);
}

// ── light shafts under the canopy ──

export function shaftMaterial(color, strength) {
  const u = { uColor: uniform(new THREE.Color(color)), uK: uniform(strength) };
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const vW = modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz.toVarying('vW');
  const v = normalize(cameraPosition.sub(vW));
  const d = length(cameraPosition.sub(vW));
  const edge = pow(abs(dot(normalize(normalWorldGeometry), v)), 3);
  const vY = uv().y;
  const along = smoothstep(0, 0.1, vY).mul(smoothstep(0.45, 1, vY).oneMinus());
  const fade = smoothstep(6, 30, d).mul(smoothstep(110, 260, d).oneMinus());
  material.colorNode = u.uColor.mul(edge).mul(along).mul(fade).mul(u.uK);
  material.opacityNode = float(1);
  return shown(material, u);
}
