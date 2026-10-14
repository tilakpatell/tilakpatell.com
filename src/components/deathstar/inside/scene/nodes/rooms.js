// The rooms’ own shaders on the node renderer (lane P1, the inside’s port by
// lane T’s method): each of ../glsl/rooms.js’s as TSL, with the same
// factories, flags, uniforms (uniform nodes under the GLSL names, which the
// rooms write through `.value`) and arithmetic.
//
//   glowMaterial({ color, base, fall, strength, rim, axis, radius, top, soft })   the shafts’ light, added
//   hazeMaterial({ color, strength, flat })   light in the air (or on a floor, flat), added
//   bayField() · ds2Field()   the magnetic field across a bay’s mouth, aboard each station
//   waterSurface(params) → { material, uniforms: { uTime, uRipple } }   the compactor’s water: a standard
//     node material whose normal is its map sampled twice, drifting, with the dianoga’s rings
//   starPoints(pos, colour, map, { size }) → Mesh   each star a quad `size` pixels across (times the
//     pixel ratio), as a PointsMaterial drew a point: a point on the node renderer is one pixel

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { Fn, abs, attribute, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, cos, dot, exp, floor, fract, length, mat3, max, mix, modelNormalMatrix, modelWorldMatrix, normalGeometry, normalView, normalWorldGeometry, normalize, positionGeometry, positionView, positionWorld, pow, screenDPR, select, sin, smoothstep, texture, uniform, uv, varying, varyingProperty, vec2, vec3, vec4, viewportSize } from 'three/tsl';

// (a ShaderMaterial has no fog unless asked; the node renderer tone-maps and
// encodes the whole frame at its end, as the bloom chain’s output pass does
// on the classic one, so the GLSL’s tone-mapping and colour-space chunks have
// nothing to do here)
const added = (params) => new MeshBasicNodeMaterial({ lights: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, ...params });

// ── the shafts’ glow ──

// Light thinning out exponentially up from its source, in slow bands
// climbing it; a haze fades towards where it is seen edge-on (its
// silhouette, where the eye passes through little of it), a disc fades
// out to its rim.
export function glowMaterial({ color = 0xbfdcff, base = 0, fall = 10, strength = 1, rim = true, axis = { x: 0, z: 0 }, radius = 0, top = Infinity, soft = 1 } = {}) {
  const u = {
    uColor: uniform(new THREE.Color(color)),
    uBase: uniform(base),
    uFall: uniform(fall),
    uStrength: uniform(strength),
    uRim: uniform(rim ? 1 : 0),
    uTime: uniform(0),
    uAxis: uniform(new THREE.Vector3(axis.x, 0, axis.z)),
    uRadius: uniform(radius),
    uTop: uniform(Number.isFinite(top) ? top : 1e9),
    uSoft: uniform(soft),
  };
  const m = added();
  const w = positionWorld;
  const h = max(0, w.y.sub(u.uBase));
  const density = exp(h.negate().div(u.uFall));
  const v = normalize(cameraPosition.sub(w));
  const face = abs(dot(normalWorldGeometry, v));
  const edge = mix(1, pow(face, 1.6), u.uRim);
  const fade = select(u.uRadius.greaterThan(0), smoothstep(0, u.uRadius, length(w.xz.sub(u.uAxis.xz))).oneMinus(), 1);
  const bands = sin(w.y.mul(0.9).sub(u.uTime.mul(2.2))).mul(0.18).add(0.82);
  const a = u.uStrength.mul(density).mul(edge).mul(fade).mul(fade).mul(bands).mul(smoothstep(u.uTop.sub(u.uSoft), u.uTop, w.y).oneMinus());
  // (alpha 1 under additive blending adds the colour times a, not times a squared)
  m.colorNode = u.uColor.mul(a);
  m.uniforms = u;
  return m;
}

// ── light in the air ──

// a hash of a point by sin (the GLSL’s: large arguments round differently
// from one graphics chip to another, here as there)
const hash3 = (p) => fract(sin(dot(p, vec3(127.1, 311.7, 74.7))).mul(43758.5453));
const noise3 = (p) => {
  const i = floor(p);
  const w = fract(p);
  const f = w.mul(w).mul(w.mul(-2).add(3));
  const h = (a, b, c) => hash3(i.add(vec3(a, b, c)));
  return mix(mix(mix(h(0, 0, 0), h(1, 0, 0), f.x), mix(h(0, 1, 0), h(1, 1, 0), f.x), f.y), mix(mix(h(0, 0, 1), h(1, 0, 1), f.x), mix(h(0, 1, 1), h(1, 1, 1), f.x), f.y), f.z);
};

// motes drifting in it, and (unless it lies flat) brightest where it is
// seen through most of its depth, so a cone or a slab has no hard edge
export function hazeMaterial({ color = 0xdfe8ff, strength = 0.2, flat = false } = {}) {
  const u = { uColor: uniform(new THREE.Color(color)), uStrength: uniform(strength), uTime: uniform(0), uFlat: uniform(flat ? 1 : 0) };
  const m = added({ name: 'ds-haze' });
  // (the GLSL’s normalMatrix × normal and −mvPosition, each normalised where it is read)
  const vN = varying(modelNormalMatrix.mul(normalGeometry), 'vHazeN');
  const face = pow(abs(dot(normalize(vN), normalize(positionView.negate()))), 1.6);
  const st = uv();
  const sides = smoothstep(0, 0.3, st.x).mul(smoothstep(0, 0.3, st.x.oneMinus()));
  const shape = mix(face, sides, u.uFlat);
  const along = smoothstep(0, 0.85, st.y);
  const motes = noise3(positionWorld.mul(2.5).add(vec3(0, u.uTime.mul(-0.12), u.uTime.mul(0.05)))).mul(0.3).add(0.7);
  const a = u.uStrength.mul(shape).mul(along).mul(along).mul(motes);
  // added as it is (blending multiplies by alpha, so alpha stays 1 or the light would count twice)
  m.colorNode = u.uColor.mul(a);
  m.uniforms = u;
  return m;
}

// ── the magnetic fields ──

// a hash of a cell by sin, and value noise over it (the fields' own)
const hash2 = (p) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
const noise2 = (p) => {
  const i = floor(p);
  const w = fract(p);
  const f = w.mul(w).mul(w.mul(-2).add(3));
  return mix(mix(hash2(i), hash2(i.add(vec2(1, 0))), f.x), mix(hash2(i.add(vec2(0, 1))), hash2(i.add(vec2(1, 1))), f.x), f.y);
};

// Slow ripples climbing a faint blue sheet, brighter at its rim where the
// emitters hold it; added over what lies beyond (its colour times its alpha,
// as the GLSL’s was), never hiding the stars. The two stations' differ only
// in their numbers.
function field(color, strength, k) {
  const u = { uTime: uniform(0), uColor: uniform(new THREE.Color(...color)), uStrength: uniform(strength) };
  const m = added({ side: THREE.DoubleSide });
  const st = uv();
  const t = u.uTime;
  const p = st.mul(vec2(...k.cells));
  const n = noise2(p.add(vec2(0, t.mul(k.climb))))
    .mul(0.6)
    .add(noise2(p.mul(k.warp).sub(vec2(t.mul(k.slide), 0))).mul(0.4));
  const bands = sin(st.y.mul(k.lines).sub(t.mul(k.run)).add(n.mul(3))).mul(0.5).add(0.5);
  const inner = smoothstep(0, k.rim[0], st.x).mul(smoothstep(0, k.rim[0], st.x.oneMinus())).mul(smoothstep(0, k.rim[1], st.y)).mul(smoothstep(0, k.rim[1], st.y.oneMinus()));
  const a = u.uStrength.mul(bands.mul(n).mul(k.ripple).add(k.floor).mul(inner.mul(k.held).add(k.loose)).add(inner.oneMinus().mul(k.edge)));
  m.colorNode = u.uColor.mul(a);
  m.opacityNode = a;
  m.uniforms = u;
  return m;
}
export const bayField = () => field([0.22, 0.52, 1], 0.22, { cells: [28, 10], climb: 0.35, warp: 2.3, slide: 0.5, lines: 60, run: 1.6, rim: [0.05, 0.08], floor: 0.3, ripple: 0.7, loose: 0.45, held: 0.55, edge: 0.6 });
export const ds2Field = () => field([0.3, 0.55, 1], 0.16, { cells: [32, 11], climb: 0.3, warp: 2.1, slide: 0.45, lines: 70, run: 1.4, rim: [0.04, 0.07], floor: 0.25, ripple: 0.75, loose: 0.4, held: 0.6, edge: 0.7 });

// ── the compactor’s water ──

// The murky water: the standard material’s surface, its normal map sampled
// twice drifting two ways, and the dianoga’s rings spreading from where it
// lies (uRipple: x, z, strength). Turned into the view by a tangent frame
// from the screen’s derivatives and the map’s own uv (its repeat and offset),
// as the GLSL’s getTangentFrame made it: three’s node one reads the mesh’s
// bare uv, which a map repeated unevenly would turn.
export function waterSurface(params) {
  const u = { uTime: uniform(0), uRipple: uniform(new THREE.Vector3(0, 0, 0)) };
  const m = new MeshStandardNodeMaterial(params);
  const map = params.normalMap;
  const t = u.uTime;
  const st = uv().mul(uniform(map.repeat)).add(uniform(map.offset));
  const sample = (at) => texture(map, at).xyz.mul(2).sub(1);
  const mapN = normalize(sample(st.add(vec2(t.mul(0.013), t.mul(0.006)))).add(sample(st.mul(1.7).add(vec2(t.mul(-0.008), t.mul(0.011))))));
  const toward = positionWorld.xz.sub(u.uRipple.xy);
  const far = length(toward);
  const ring = toward.div(max(far, 0.001)).mul(vec2(1, -1)).mul(cos(far.mul(9).sub(t.mul(3)))).mul(exp(far.mul(-0.9))).mul(u.uRipple.z);
  const bent = vec3(mapN.xy.add(ring).mul(uniform(m.normalScale)), mapN.z);
  // (getTangentFrame: the view position’s and the uv’s change across a pixel)
  const q0 = positionView.dFdx();
  const q1 = positionView.dFdy();
  const st0 = st.dFdx();
  const st1 = st.dFdy();
  const N = normalView;
  const q1perp = q1.cross(N);
  const q0perp = N.cross(q0);
  const T = q1perp.mul(st0.x).add(q0perp.mul(st1.x));
  const B = q1perp.mul(st0.y).add(q0perp.mul(st1.y));
  const det = max(dot(T, T), dot(B, B));
  const scale = select(det.equal(0), 0, det.inverseSqrt());
  m.normalNode = normalize(mat3(T.mul(scale), B.mul(scale), N).mul(bent));
  return { material: m, uniforms: u };
}

// ── the stars past a mouth ──

export function starPoints(pos, colour, map, { size = 2.2 } = {}) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  geo.setAttribute('aStar', new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute('aColour', new THREE.InstancedBufferAttribute(colour, 3));
  geo.instanceCount = pos.length / 3;
  const m = new MeshBasicNodeMaterial({ lights: false, map, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const vUv = varyingProperty('vec2', 'vStarUv');
  const vC = varyingProperty('vec3', 'vStarColour');
  m.vertexNode = Fn(() => {
    // (the point’s square, its uv as a PointsMaterial reads its map: x across, y up)
    vUv.assign(positionGeometry.xy.add(1).mul(0.5));
    vC.assign(attribute('aColour', 'vec3'));
    const clip = cameraProjectionMatrix.mul(cameraViewMatrix.mul(modelWorldMatrix.mul(vec4(attribute('aStar', 'vec3'), 1))));
    // (size pixels times the pixel ratio across, unattenuated, as three sized the point)
    const off = positionGeometry.xy.mul(size).mul(screenDPR).div(viewportSize).mul(clip.w);
    return vec4(clip.xy.add(off), clip.z, clip.w);
  })();
  const seen = texture(map, vUv);
  m.colorNode = seen.rgb.mul(vC);
  m.opacityNode = seen.a;
  return new THREE.Mesh(geo, m);
}
