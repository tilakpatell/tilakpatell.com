// What the portal gun does to someone it kills, for the node renderer: the
// same swallow as portalFx.js (portalFxCore.js's, whose header says what it
// does), its disc the show's swirl (swirl.js's `portal()`) as nodes, line
// for line, with the same flags and the same uniforms, t, seed, open and
// flash, on `material.uniforms`, so the swallow's `u.open.value = …`
// writes them as before.
//
// createPortalFx({ parent }) → { swallow(fig, opts), update(dt), count, dispose }
// meshyJoints(model, unit, tall) → ragdoll.js's [{ obj, len }]
// swirl(o, t, open, seed) → vec4, premultiplied: swirl.js's portal(), as nodes

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { atan, cos, dot, exp, float, floor, fract, length, max, mix, sin, smoothstep, step, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { PAD, createPortalFx as createWith, meshyJoints } from './portalFxCore';

// ── the swirl ──

// (GLSL's smoothstep with its edges reversed, as nodes)
const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();
const hash = (p) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
const noise = (p) => {
  const i = floor(p);
  let f = fract(p);
  f = f.mul(f).mul(f.mul(2).oneMinus().add(2)); // f * f * (3 - 2f)
  return mix(mix(hash(i), hash(i.add(vec2(1, 0))), f.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x), f.y);
};
// (mat2(1.6, 1.2, -1.2, 1.6) * p, GLSL's columns written out)
const turn = (p) => vec2(p.x.mul(1.6).sub(p.y.mul(1.2)), p.x.mul(1.2).add(p.y.mul(1.6)));
const fbm = (p0) => {
  let s = float(0);
  let p = p0;
  let a = 0.5;
  for (let i = 0; i < 4; i++) {
    s = s.add(noise(p).mul(a));
    p = turn(p);
    a *= 0.5;
  }
  return s;
};
const rot = (p, a) => {
  const c = cos(a);
  const s = sin(a);
  return vec2(c.mul(p.x).sub(s.mul(p.y)), s.mul(p.x).add(c.mul(p.y)));
};

export function swirl(o, t, open, seed) {
  const e = max(open, 0.001);
  const q = o.div(e);
  const r = length(q);
  const a = atan(q.y, q.x);
  // the goo's edge: slow lumps that wander round the rim, a faster ripple on them
  const ring = vec2(cos(a), sin(a));
  const lump = fbm(ring.mul(1.3).add(vec2(seed.mul(3.1), t.mul(0.28))))
    .sub(0.5)
    .mul(0.15)
    .add(sin(a.mul(13).add(t.mul(2.6))).mul(0.014));
  const edge = lump.add(1);
  const d = r.div(edge); // 0 at the eye, 1 at the lip
  // the swirl: everything turns, the middle faster, so blobs of noise shear
  // into streaks that spiral down; opening winds it up harder
  const spin = t.mul(0.85).add(e.oneMinus().mul(5));
  const nd = d.oneMinus();
  const twist = nd.mul(nd).mul(4.2).add(nd.mul(1.1));
  const w = rot(q, twist.add(spin));
  const n1 = fbm(w.mul(2.3).add(seed));
  const n2 = fbm(rot(q, twist.mul(1.35).add(spin.mul(1.3))).mul(3.4).sub(seed));
  const s = n1.mul(0.7).add(n2.mul(0.3));
  // the show's greens: a lime body, darker arms, a pale yellow-green lip, and
  // light coming up through the middle
  const arm = vec3(0.11, 0.42, 0.07);
  const body = vec3(0.42, 0.78, 0.16);
  const lime = vec3(0.64, 0.92, 0.24);
  const lip = vec3(0.86, 1.0, 0.46);
  const core = vec3(0.9, 0.95, 0.36);
  let c = mix(body, lime, smoothstep(0.55, 0.95, d).mul(0.6));
  // dark arms and light arms wound into the spiral, in a few flat tones like a cel
  c = mix(arm, c, smoothstep(0.4, 0.48, s));
  c = mix(c, lime.mul(1.06), smoothstep(0.6, 0.67, s).mul(0.8));
  // the glow at the eye
  c = mix(c, core, fall(0.42, 0.0, d).mul(smoothstep(0.35, 0.6, s).mul(0.45).add(0.55)));
  // a brushed highlight that rides round with the swirl
  c = c.add(vec3(0.1, 0.16, 0.05).mul(smoothstep(0.55, 1.0, sin(atan(w.y, w.x).mul(2).add(d.mul(6))).mul(0.5).add(0.5))).mul(d));
  // the lip: a bright band just inside the edge, brightest at the very rim
  c = mix(c, lip, smoothstep(0.8, 0.95, d));
  c = mix(c, vec3(0.96, 1.0, 0.78), smoothstep(0.955, 0.995, d).mul(0.8));
  // flecks of light, drifting inward with the swirl
  const g = rot(q, twist.mul(0.7).add(spin.mul(0.6))).mul(11);
  const id = floor(g);
  const f = fract(g)
    .sub(0.5)
    .sub(vec2(hash(id.add(3.1)), hash(id.add(7.7))).sub(0.5).mul(0.6));
  const fleck = fall(0.17, 0.07, length(f))
    .mul(step(0.64, hash(id.add(seed))))
    .mul(smoothstep(0.5, 0.93, d));
  c = mix(c, vec3(0.97, 1.0, 0.88), fleck);
  // solid inside, a short soft edge, then a green haze outside
  const inside = fall(1.02, 0.985, d);
  const haze = exp(max(d.sub(1), 0).mul(-7))
    .mul(0.55)
    .mul(inside.oneMinus())
    .mul(smoothstep(0.0, 0.3, open))
    .mul(fall(1.32, 1.04, d.mul(e)));
  const glow = vec3(0.45, 0.95, 0.25);
  return vec4(c.mul(inside).add(glow.mul(haze)), max(inside, haze));
}

// ── the disc ──

const portalMat = () => {
  const uniforms = { t: uniform(0), seed: uniform(0), open: uniform(0), flash: uniform(0) };
  const material = new MeshBasicNodeMaterial({ transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
  const c = swirl(uv().mul(2).sub(1).mul(PAD), uniforms.t, uniforms.open, uniforms.seed);
  // the flash as it shuts: the whole disc goes to the lip's light
  const rgb = mix(c.rgb, vec3(0.93, 1.0, 0.7).mul(c.a), uniforms.flash);
  // (the GLSL wrote its colour premultiplied; the node material multiplies
  // by the alpha itself where premultipliedAlpha is set, so it's divided out
  // here: nothing under 0.004 is drawn at all)
  material.colorNode = rgb.div(max(c.a, 0.004));
  material.opacityNode = c.a;
  material.maskNode = c.a.greaterThanEqual(0.004);
  material.uniforms = uniforms;
  return material;
};

export const createPortalFx = ({ parent }) => createWith({ parent, portalMat });
export { meshyJoints };
