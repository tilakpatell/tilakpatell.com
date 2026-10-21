// Mount Doom’s node twins, the second part (./propsShaders.js re-exports
// them): the Eye and its beam, the cavern’s underglow, haze and sparks, the
// Ring’s letters and the orcs’ iron.

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  abs,
  atan,
  attribute,
  cameraViewMatrix,
  clamp,
  cos,
  dot,
  exp,
  fract,
  length,
  materialMetalness,
  materialRoughness,
  max,
  min,
  mix,
  modelViewMatrix,
  modelWorldMatrix,
  modelNormalMatrix,
  normalLocal,
  normalize,
  positionGeometry,
  positionView,
  positionWorld,
  pow,
  screenDPR,
  select,
  sin,
  smoothstep,
  sqrt,
  texture,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { asNode, follow, onColor, onLight } from '../../../../../lib/three/hookNodes';
import { V3, basic, capFog, fall, placeAt, pointSprite, pointsMaterial, sample, shared } from './propsShared';

// The Eye of Sauron, on a quad that turns to the camera in the vertex
// shader (scaled with its model): a lidless almond of fire, its rim a dark
// red, its iris fibres of orange going white-hot about the black slit of
// its pupil, flames licking out all round it and a glow beyond. uK (0..1)
// is how fiercely it burns; its pupil turns towards uGazeAt (a point in
// the world) by uFix, else it searches. No fog: it reads from afar.
export function eyeMaterial(U) {
  const u = {
    uK: uniform(1),
    uFix: uniform(0.5),
    uGazeAt: uniform(V3()),
    uTime: shared(U, 'uTime'),
    uNoise: shared(U, 'uNoise'),
  };
  const m = basic({ transparent: true, depthWrite: false });
  const c = modelViewMatrix.mul(vec4(0, 0, 0, 1));
  const g = cameraViewMatrix.mul(vec4(u.uGazeAt, 1));
  const d = g.xy.div(max(1, g.z.negate())).sub(c.xy.div(max(1, c.z.negate())));
  const l = length(d);
  const vGaze = varying(select(l.greaterThan(1e-5), d.div(max(l, 1e-5)).mul(min(1, l.mul(6))), vec2(0)), 'vGaze');
  placeAt(m, () => vec3(c.xy.add(positionGeometry.xy.mul(vec2(length(modelWorldMatrix[0].xyz), length(modelWorldMatrix[1].xyz)))), c.z), 'doom-eye');
  const nz = (at) => sample(u.uNoise, at).r;
  const nz2 = (at) => sample(u.uNoise, at).g;
  const p = uv().mul(2).sub(1);
  const k = u.uK;
  const t = u.uTime;
  const sway = sin(t.mul(0.47))
    .mul(0.05)
    .mul(k.add(0.4))
    .add(sin(t.mul(1.31).add(1)).mul(0.012));
  const look = mix(sway, vGaze.x.mul(0.1), u.uFix);
  const lookY = vGaze.y.mul(0.045).mul(u.uFix);
  const e = p.div(vec2(0.34, 0.2));
  const r = length(
    vec2(
      e.x,
      e.y.div(
        max(
          0.12,
          pow(min(abs(e.x), 1), 1.8)
            .mul(0.7)
            .oneMinus(),
        ),
      ),
    ),
  );
  const rp = length(p.mul(vec2(0.8, 1)));
  const a = atan(e.y, e.x);
  const lick = nz(vec2(a.mul(0.38).add(0.6), rp.mul(0.55).sub(t.mul(k.mul(0.16).add(0.19)))));
  const lick2 = nz2(vec2(a.mul(1.1).add(0.2), rp.mul(1.3).sub(t.mul(k.mul(0.24).add(0.4)))));
  const up = max(sin(a), 0);
  const reach = k
    .mul(0.9)
    .add(0.5)
    .mul(lick.mul(1.2).add(lick2.mul(0.5)))
    .mul(
      up
        .mul(1.1)
        .add(0.5)
        .add(abs(cos(a)).mul(0.3)),
    )
    .add(1.1);
  const inside = smoothstep(0.93, 1, r).oneMinus();
  const flame = smoothstep(0.9, reach, r).oneMinus().mul(lick2.mul(0.5).add(0.5)).mul(inside.oneMinus());
  const px = p.x.sub(look);
  const py = p.y.sub(lookY);
  const fa = atan(py, px);
  const fib = nz(vec2(fa.mul(1.4), r.mul(0.5).sub(t.mul(0.08))))
    .mul(0.6)
    .add(nz2(vec2(fa.mul(4.1), r.add(t.mul(0.05)))).mul(0.4));
  const near = exp(abs(px).mul(-9));
  const i0 = mix(vec3(1.1, 0.16, 0.02), vec3(2.3, 0.5, 0.04), fall(0.98, 0.6, r));
  const i1 = mix(i0, vec3(2.8, 1.35, 0.2), near.mul(fall(1, 0.25, r)).mul(0.85)).mul(fib.mul(0.75).add(0.55));
  const iris = mix(vec3(0.35, 0.03, 0.01), i1, fall(1, 0.85, r));
  // (the GLSL’s pow(py / 0.2, 2.0), a square: WGSL has no pow of a negative)
  const pq = py.div(0.2);
  const w = k
    .mul(0.35)
    .oneMinus()
    .mul(0.04)
    .mul(sqrt(max(0, pq.mul(pq).oneMinus())));
  const pupil = smoothstep(w.mul(0.6), w.add(0.006), abs(px)).oneMinus();
  const fire = mix(vec3(2.2, 0.5, 0.05), vec3(0.8, 0.09, 0.015), smoothstep(1, reach, r));
  const col0 = mix(fire.mul(flame), iris, inside);
  const col1 = mix(col0, vec3(0.02, 0, 0), pupil.mul(inside));
  const alpha0 = max(inside, clamp(flame.mul(1.4), 0, 1));
  const halo = exp(rp.mul(-3)).mul(k.mul(0.35).add(0.3));
  const col = col1.add(vec3(1.0, 0.18, 0.03).mul(halo).mul(alpha0.oneMinus()));
  const alpha = max(alpha0, halo);
  const edge = fall(1, 0.8, max(abs(p.x), abs(p.y)));
  m.colorNode = col.mul(k.mul(0.4).add(0.55));
  m.opacityNode = alpha.mul(edge);
  m.uniforms = u;
  return m;
}

// The Eye’s searchlight: a long cone of yellow-orange light, brightest
// down its middle and towards the Eye, dust drifting in it. Added.
export function beamMaterial(U) {
  const u = {
    uFogCap: uniform(0.5),
    uK: uniform(1),
    uTime: shared(U, 'uTime'),
    uNoise: shared(U, 'uNoise'),
  };
  const m = basic({
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  // (GLSL’s normalMatrix, in the view: three’s modelNormalMatrix is the world’s)
  const vN = varying(normalize(cameraViewMatrix.mul(vec4(modelNormalMatrix.mul(normalLocal), 0)).xyz), 'vN');
  const vV = varying(positionView.negate(), 'vV');
  const vUv = uv();
  const along = vUv.y;
  const face = abs(dot(normalize(vN), normalize(vV)));
  const core = pow(face, 2.2);
  const n = sample(u.uNoise, vec2(vUv.x.mul(2), along.mul(5).sub(u.uTime.mul(0.12)))).r;
  const n2 = sample(u.uNoise, vec2(vUv.x.mul(5).add(0.3), along.mul(13).sub(u.uTime.mul(0.35)))).g;
  m.opacityNode = core
    .mul(n.mul(n2).mul(1.3).add(0.35))
    .mul(smoothstep(0, 0.02, along))
    .mul(fall(1, 0.88, along))
    .mul(along.mul(0.45).oneMinus())
    .mul(0.32)
    .mul(u.uK);
  m.colorNode = mix(vec3(2.6, 1.5, 0.45), vec3(1.9, 0.75, 0.16), along);
  capFog(m, u.uFogCap, true, 'doom-beam');
  m.uniforms = u;
  return m;
}

// Rock lit from below by fire: faces turned down glow red, more so the
// nearer they hang over it (uLavaY, in the world; uDepth how far up it
// reaches); flickering. uFire 0..: how bright.
export function underglow(m, U, key) {
  const n = asNode(m);
  n.userData.fire = { value: 1 };
  n.userData.lavaY = { value: 0 };
  n.userData.depth = { value: 45 };
  const uFire = follow(n.userData.fire);
  const uLavaY = follow(n.userData.lavaY);
  const uDepth = follow(n.userData.depth);
  const uTime = shared(U, 'uTime');
  const vUgW = positionWorld;
  const vUgN = varying(normalize(modelWorldMatrix.mul(vec4(normalLocal, 0)).xyz), 'vUgN');
  const un = vUgN.div(max(length(vUgN), 1e-4));
  const down = max(un.y.negate(), 0);
  const side = abs(un.y).oneMinus();
  const near = fall(uDepth, 0, vUgW.y.sub(uLavaY));
  const flick = sample(shared(U, 'uNoise'), vUgW.xz.mul(0.03).add(vec2(uTime.mul(0.02), vUgW.y.mul(0.02).sub(uTime.mul(0.03)))))
    .r.mul(0.9)
    .add(0.55);
  const glow = vec3(1.0, 0.24, 0.05)
    .mul(uFire)
    .mul(flick)
    .mul(near)
    .mul(
      pow(down, 1.2)
        .mul(near.mul(1.1).add(0.25))
        .add(side.mul(near.mul(near).mul(0.4).add(0.04)))
        .add(0.03),
    );
  return onLight(n, (light) => light.add(glow), key, {
    uFire,
    uLavaY,
    uDepth,
  });
}

// Haze rising off the fire: tall cards, glowing at their feet, wavering.
export function hazeMaterial(U) {
  const u = {
    uK: uniform(1),
    uTime: shared(U, 'uTime'),
    uNoise: shared(U, 'uNoise'),
  };
  const m = basic({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const vUv = uv();
  const v = vUv.y;
  const sides = smoothstep(0, 0.3, vUv.x).mul(fall(1, 0.7, vUv.x));
  const n = sample(u.uNoise, vec2(vUv.x.mul(1.5), v.mul(0.8).sub(u.uTime.mul(0.03)))).r;
  const n2 = sample(u.uNoise, vec2(vUv.x.mul(3).add(0.3), v.mul(1.6).sub(u.uTime.mul(0.06)))).g;
  const lo = max(v.oneMinus(), 0);
  m.opacityNode = pow(lo, 1.6).mul(sides).mul(n.mul(n2).mul(1.1).add(0.4)).mul(0.22).mul(u.uK);
  m.colorNode = mix(vec3(0.5, 0.05, 0.01), vec3(2.0, 0.6, 0.1), pow(lo, 2.5).mul(n.add(0.5)));
  m.uniforms = u;
  return m;
}

// Sparks going up out of the fire, wavering, fading as they rise.
export function sparkMaterial(U) {
  const u = {
    uK: uniform(1),
    uScale: uniform(600),
    uSpan: uniform(V3(30, 40, 30)),
    uTime: shared(U, 'uTime'),
  };
  const m = pointsMaterial();
  const aSeed = attribute('aSeed', 'vec4');
  const t = u.uTime;
  const life = fract(t.mul(aSeed.y.mul(0.04).add(0.03)).add(aSeed.x));
  const p = vec3(
    aSeed.z
      .sub(0.5)
      .mul(u.uSpan.x)
      .add(
        sin(t.mul(0.7).add(aSeed.w.mul(30)))
          .mul(1.5)
          .mul(life),
      ),
    life.mul(u.uSpan.y),
    aSeed.w
      .sub(0.5)
      .mul(u.uSpan.z)
      .add(
        cos(t.mul(0.5).add(aSeed.z.mul(20)))
          .mul(1.2)
          .mul(life),
      ),
  );
  m.positionNode = attribute('aPoint', 'vec3').add(p);
  // gl_PointSize, in the canvas’s pixels (three’s sprite multiplies by the DPR again)
  m.sizeNode = aSeed.y.mul(0.09).add(0.07).mul(u.uScale).div(max(0.5, positionView.z.negate())).div(screenDPR);
  const vA = varying(
    sin(life.mul(3.14159)).mul(
      sin(t.mul(9).add(aSeed.x.mul(60)))
        .mul(0.5)
        .add(0.5),
    ),
    'vA',
  );
  const c = uv().sub(0.5);
  const a = fall(0.25, 0, dot(c, c)).mul(vA).mul(u.uK);
  m.colorNode = vec3(2.8, 1.1, 0.3).mul(a);
  m.opacityNode = a;
  m.uniforms = u;
  return m;
}

// The sparks’ points, from a geometry of positions and aSeed: one sprite,
// a point an instance.
export function sparkPoints(geo, material) {
  const pos = geo.getAttribute('position');
  return pointSprite(material, pos.array, geo.getAttribute('aSeed').array, pos.count);
}

// Gold, and the letters of the Black Speech in the Elvish hand round its
// outer face, burning as fire when uK says (0 none): emissive, flickering.
export function ringMaterial(env, letters, U) {
  const m = new MeshStandardNodeMaterial({
    color: 0xf6c45a,
    metalness: 1,
    roughness: 0.22,
    envMap: env,
    envMapIntensity: 3,
  });
  m.userData.k = { value: 0 };
  const uK = follow(m.userData.k);
  const uTime = shared(U, 'uTime');
  const vRingUv = uv();
  const bv = fract(vRingUv.y.add(0.5)).sub(0.5);
  const band = smoothstep(0.15, 0.2, abs(bv)).oneMinus();
  const L = texture(letters, vec2(vRingUv.x.mul(2), bv.div(0.38).add(0.5))).r.mul(band);
  const flick = sin(uTime.mul(7).add(vRingUv.x.mul(40)))
    .mul(0.15)
    .add(0.85);
  onLight(m, (light) => light.add(vec3(3.4, 1.2, 0.2).mul(L).mul(uK).mul(flick)), 'doom-ring', { uK });
  return onColor(m, (dc) => mix(dc.rgb, vec3(1.0, 0.4, 0.08), L.mul(uK).mul(0.6)), 'doom-ring:gold');
}

// Orc-hide and black iron in one material: a vertex’s `metal` (0..1)
// makes it iron.
export function orcMaterial(env) {
  const m = new MeshStandardNodeMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0,
    envMap: env,
    envMapIntensity: 0.9,
  });
  const vMetal = varying(attribute('metal', 'float'), 'vMetal');
  m.roughnessNode = mix(materialRoughness, 0.38, vMetal);
  m.metalnessNode = mix(materialMetalness, 0.85, vMetal);
  return m;
}
