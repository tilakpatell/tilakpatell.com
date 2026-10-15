// sun.js on the node renderer: the sun in the middle of the map, its
// surface Solar System Scope’s map set boiling (pushed about by a few layers
// of slow noise, darker and redder toward the edge, drawn brighter than
// white so bloom gives it its glare) and round it the corona, a disc that
// always faces you with long streamers that slowly turn and change.
//
// What differs on the node renderer: the two ShaderMaterials are
// MeshBasicNodeMaterials with the same flags (and the ShaderMaterial’s
// defaults kept: no fog, one pass), their shaders nodes, line for line; the
// simplex noise, sun.js’s NOISE_GLSL, is `snoise`, a node function of its
// own in the shader (not written out at each of its calls). The uniforms
// are nodes under the GLSL’s names on `material.uniforms`, so the frame
// code’s `.value` writes drive them as before. With no map the surface
// samples a stand-in texel it never shows (a node texture needs a texture).
//
// buildSun(T) → { group, update(t, camera) }
// snoise(v) → float: 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT), as nodes

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, abs, atan, clamp, cos, dot, exp, float, floor, max, min, mix, normalView, normalize, pow, positionLocal, positionView, select, sin, smoothstep, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { SUN } from './layout';

// ── the noise ──

// (GLSL’s mod289, x − floor(x / 289) · 289, written out as it was)
const mod289 = (x) => x.sub(floor(x.mul(1.0 / 289.0)).mul(289.0));
const permute = (x) => mod289(x.mul(34.0).add(10.0).mul(x));
const taylorInvSqrt = (r) => float(1.79284291400159).sub(r.mul(0.85373472095314));

// 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT)
export const snoise = Fn(([v]) => {
  const C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const D = vec4(0.0, 0.5, 1.0, 2.0);
  const i0 = floor(v.add(dot(v, C.yyy)));
  const x0 = v.sub(i0).add(dot(i0, C.xxx));
  const g = step(x0.yzx, x0.xyz);
  const l = g.oneMinus();
  const i1 = min(g.xyz, l.zxy);
  const i2 = max(g.xyz, l.zxy);
  const x1 = x0.sub(i1).add(C.xxx);
  const x2 = x0.sub(i2).add(C.yyy);
  const x3 = x0.sub(D.yyy);
  const i = mod289(i0);
  const p = permute(
    permute(permute(i.z.add(vec4(0.0, i1.z, i2.z, 1.0)))
      .add(i.y)
      .add(vec4(0.0, i1.y, i2.y, 1.0)))
      .add(i.x)
      .add(vec4(0.0, i1.x, i2.x, 1.0)),
  );
  const n_ = 0.142857142857;
  const ns = D.wyz.mul(n_).sub(D.xzx);
  const j = p.sub(floor(p.mul(ns.z).mul(ns.z)).mul(49.0));
  const x_ = floor(j.mul(ns.z));
  const y_ = floor(j.sub(x_.mul(7.0)));
  const x = x_.mul(ns.x).add(ns.yyyy);
  const y = y_.mul(ns.x).add(ns.yyyy);
  const h = float(1.0).sub(abs(x)).sub(abs(y));
  const b0 = vec4(x.xy, y.xy);
  const b1 = vec4(x.zw, y.zw);
  const s0 = floor(b0).mul(2.0).add(1.0);
  const s1 = floor(b1).mul(2.0).add(1.0);
  const sh = step(h, vec4(0.0)).negate();
  const a0 = b0.xzyw.add(s0.xzyw.mul(sh.xxyy));
  const a1 = b1.xzyw.add(s1.xzyw.mul(sh.zzww));
  const p0 = vec3(a0.xy, h.x);
  const p1 = vec3(a0.zw, h.y);
  const p2 = vec3(a1.xy, h.z);
  const p3 = vec3(a1.zw, h.w);
  const norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  const q0 = p0.mul(norm.x);
  const q1 = p1.mul(norm.y);
  const q2 = p2.mul(norm.z);
  const q3 = p3.mul(norm.w);
  const m0 = max(float(0.5).sub(vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3))), 0.0);
  const m = m0.mul(m0);
  return dot(m.mul(m), vec4(dot(q0, x0), dot(q1, x1), dot(q2, x2), dot(q3, x3))).mul(105.0);
}).setLayout({ name: 'snoise', type: 'float', inputs: [{ name: 'v', type: 'vec3' }] });

// (the flags a ShaderMaterial has without being asked: no fog, one pass)
const shaderLike = (opts = {}) => new MeshBasicNodeMaterial({ fog: false, forceSinglePass: true, ...opts });

// ── the surface (SURFACE_FRAG, as nodes) ──

function surfaceMaterial(u) {
  const material = shaderLike();
  const p = normalize(positionLocal).mul(2.6);
  const t = u.uTime.mul(0.04);
  // the surface pushed about: big slow cells, then the granules on them
  const w = vec3(snoise(p.add(vec3(t, 0.0, 0.0))), snoise(p.add(vec3(5.2, t.negate(), 1.3))), snoise(p.add(vec3(9.1, 2.8, t))));
  const q = p.add(w.mul(0.45));
  const cells = snoise(q.mul(1.6).add(t.mul(1.5)));
  const gran = snoise(q.mul(7.0).sub(t.mul(4.0))).mul(0.6).add(snoise(q.mul(16.0).add(t.mul(6.0))).mul(0.4));
  const st = uv().add(w.xy.mul(0.006));
  const base = select(u.uHasMap.greaterThan(0.5), u.uMap.sample(st).rgb, vec3(1.0, 0.55, 0.15));
  let col = base.mul(cells.mul(0.32).add(0.78).add(gran.mul(0.22)));
  // hot spots where the cells peak
  col = col.add(vec3(1.0, 0.72, 0.35).mul(smoothstep(0.55, 0.95, cells.add(gran.mul(0.3)))).mul(0.5));
  // darker and redder toward the edge
  const mu = clamp(dot(normalize(normalView), normalize(positionView.negate())), 0.0, 1.0);
  col = col.mul(pow(mu, 0.55).mul(0.58).add(0.42));
  col = col.mul(mix(vec3(1.0, 0.6, 0.32), vec3(1.0), smoothstep(0.0, 0.7, mu)));
  material.colorNode = col.mul(u.uHeat);
  material.uniforms = u;
  return material;
}

// ── the corona (CORONA_FRAG, as nodes) ──

function coronaMaterial(u) {
  const material = shaderLike({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const c = uv().mul(2.0).sub(1.0).mul(u.uReach); // in the sun's radii
  const r = c.length();
  const a = atan(c.y, c.x);
  const ring = vec2(cos(a), sin(a));
  const t = u.uTime;
  // streamers: where the noise round the edge is high, the light reaches further
  const rays = snoise(vec3(ring.mul(1.8), t.mul(0.05))).mul(0.6).add(snoise(vec3(ring.mul(5.0), t.mul(0.09).add(3.0))).mul(0.4));
  const fine = snoise(vec3(ring.mul(14.0), t.mul(0.2))).mul(0.5).add(0.5);
  const d = r.sub(1.0);
  const inner = exp(d.mul(-9.0));
  const outer = exp(d.negate().mul(float(2.6).sub(clamp(rays, 0.0, 1.0).mul(1.4))));
  const glow = inner
    .mul(1.2)
    .add(outer.mul(smoothstep(-0.1, 0.8, rays).mul(0.5).add(0.22)).mul(fine.mul(0.25).add(0.75)))
    .mul(smoothstep(u.uReach.mul(0.55), u.uReach, r).oneMinus());
  // hotter and whiter close in, redder out along the streamers
  const col = mix(u.uColor.mul(vec3(1.0, 0.55, 0.3)), u.uColor, inner);
  material.colorNode = col.mul(glow);
  material.maskNode = r.greaterThanEqual(0.97);
  material.uniforms = u;
  return material;
}

const REACH = 4; // the corona's reach, in the sun's radii

// (what the surface samples when there's no map: never shown, uHasMap is 0)
const blank = () => new THREE.DataTexture(new Uint8Array([255, 140, 38, 255]), 1, 1);

export function buildSun(T = {}) {
  const group = new THREE.Group();
  group.position.set(...SUN.at);
  const map = texture(T.sun ?? blank());
  const surfaceMat = surfaceMaterial({ uMap: map, uHasMap: uniform(T.sun ? 1 : 0), uTime: uniform(0), uHeat: uniform(2.6) });
  const surface = new THREE.Mesh(new THREE.SphereGeometry(SUN.r, T.small ? 64 : 96, T.small ? 40 : 64), surfaceMat);
  const coronaMat = coronaMaterial({ uTime: uniform(0), uReach: uniform(REACH), uColor: uniform(new THREE.Color(2.4, 1.5, 0.75)) });
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(SUN.r * REACH * 2, SUN.r * REACH * 2), coronaMat);
  corona.renderOrder = 1;
  group.add(surface, corona);
  const q = new THREE.Quaternion();
  return {
    group,
    update(t, camera) {
      surface.rotation.y = t * 0.03;
      surfaceMat.uniforms.uTime.value = t;
      coronaMat.uniforms.uTime.value = t;
      if (camera) {
        // the corona faces you: undo the map's turn, then take the camera's
        group.getWorldQuaternion(q);
        corona.quaternion.copy(q.invert()).multiply(camera.quaternion);
      }
    },
  };
}
