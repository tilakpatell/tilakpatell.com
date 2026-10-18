// ../../../towns/doom/propsShaders.js on the node renderer: Mount Doom’s
// shaders line for line in TSL, the same names, arguments and returns. The
// ShaderMaterials are node materials keeping their uniforms under the
// GLSL’s names on `material.uniforms` (uniform nodes, so the scene’s
// `.value` writes land); the kit’s shared clock, eruption and noise (`U`,
// plain { value }s) are followed, read every render. The patches on a
// standard material are node hooks (hookNodes.js): each returns the node
// material, and the kit uses what it returns.
//
// What runs differently: the node renderer draws a point one pixel wide,
// so the bombs and the sparks are sprites, one instance a point, their size
// the GLSL’s gl_PointSize; the fog held back (uFogCap) is three’s factor
// for the scene’s fog, times the cap, in the material’s fog step; the
// ShaderMaterials had no tone-mapping chunk, so their twins aren’t tone
// mapped either.
//
// The Mountain’s are here; the Eye’s, the cavern’s, the Ring’s and the
// orcs’ in ./propsEyeAndCavern.js, re-exported; what both use in
// ./propsShared.js.

import * as THREE from 'three';
import {
  abs,
  attribute,
  cameraViewMatrix,
  clamp,
  cos,
  dot,
  float,
  fract,
  length,
  max,
  mix,
  modelViewMatrix,
  modelWorldMatrix,
  positionGeometry,
  positionLocal,
  positionView,
  positionWorld,
  pow,
  screenDPR,
  sin,
  smoothstep,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { asNode, follow, onColor, onLight } from '../../../../../lib/three/hookNodes';
import { TAU, V3, basic, capFog, fall, placeAt, pointSprite, pointsMaterial, rng, sample, shared } from './propsShared';

export { rng } from './propsShared';
export * from './propsEyeAndCavern';

// A standard material whose fog is capped at uFogCap, and (with `glow`)
// whose vertices’ `heat` (0..1) glows red, flickering: rock by the lava.
export function emberish(m, U, { cap = 1, glow = null, key }) {
  const n = asNode(m);
  n.userData.fogCap = { value: cap };
  if (glow) n.userData.glow = glow;
  capFog(n, follow(n.userData.fogCap), false, `${key}:fog`);
  if (glow) {
    const uGlow = follow(glow);
    const uTime = shared(U, 'uTime');
    const vHeat = varying(attribute('heat', 'float'), 'vHeat');
    const f = sample(shared(U, 'uNoise'), positionWorld.xz.mul(0.004).add(vec2(uTime.mul(0.01), uTime.mul(-0.017)))).r;
    const h = vHeat.mul(vHeat).mul(uGlow).mul(f.mul(0.9).add(0.55));
    onLight(n, (light) => light.add(mix(vec3(0.5, 0.05, 0.01), vec3(1.6, 0.36, 0.05), clamp(h, 0, 1)).mul(h)), `${key}:glow`, { uGlow });
    onColor(n, (dc) => dc.rgb.mul(clamp(vHeat.mul(0.6), 0, 0.6).oneMinus()), `${key}:heat`);
  }
  return n;
}

// Molten rock, flowing: plates of black crust drifting along +v (the uv in
// metres) with the white-hot rock showing in the seams between, brighter
// where the crust has broken. RIBBON: a stream down a gully, its `aEdge` 0
// at the middle and 1 at the banks, crusted and cooler there.
export function lavaMaterial(U, { ribbon = false, swell = 0, scale = 1, heat = 1, flow = 1, cap = 1 } = {}) {
  const u = {
    uFogCap: uniform(cap),
    uHeat: uniform(heat),
    uFlow: uniform(flow),
    uScale: uniform(scale),
    uSwell: uniform(swell),
    uTime: shared(U, 'uTime'),
    uNoise: shared(U, 'uNoise'),
    uErupt: shared(U, 'uErupt'),
  };
  const m = basic({ fog: true });
  const uvA = uv();
  m.positionNode = positionLocal.add(
    vec3(
      0,
      sin(uvA.x.mul(0.23).add(u.uTime.mul(0.5)))
        .mul(sin(uvA.y.mul(0.19).sub(u.uTime.mul(0.4))))
        .mul(u.uSwell),
      0,
    ),
  );
  const vEdge = ribbon ? varying(attribute('aEdge', 'float'), 'vEdge') : float(0);
  const p = uv().mul(u.uScale);
  const t = u.uTime.mul(u.uFlow).mul(u.uErupt.mul(1.5).add(1));
  const q = p.sub(vec2(0, t.mul(0.8)));
  const n1 = sample(u.uNoise, q.mul(vec2(0.07, 0.045))).r;
  const n2 = sample(u.uNoise, q.mul(vec2(0.16, 0.11)).add(n1.mul(0.3))).g;
  const n3 = sample(u.uNoise, p.mul(0.013).add(vec2(0, t.mul(-0.006)))).b;
  const plates = n1.mul(0.6).add(n2.mul(0.55));
  const crust = smoothstep(0.48, 0.6, plates.add(vEdge.mul(0.5)).sub(u.uErupt.mul(0.3)).add(n3.sub(0.5).mul(0.3)));
  const seam = smoothstep(0, 0.06, abs(n2.sub(0.5))).oneMinus();
  const hot = mix(seam.mul(0.35).add(0.85), seam.mul(0.6), crust)
    .mul(n3.mul(0.8).add(0.45))
    .mul(u.uHeat)
    .mul(smoothstep(0.65, 1, vEdge).mul(0.9).oneMinus())
    .mul(u.uErupt.mul(0.5).add(1));
  const c0 = mix(vec3(0.03, 0.016, 0.012), vec3(0.6, 0.06, 0.01), smoothstep(0.03, 0.28, hot));
  const c1 = mix(c0, vec3(2.0, 0.42, 0.05), smoothstep(0.28, 0.75, hot));
  m.colorNode = mix(c1, vec3(3.6, 1.8, 0.5), smoothstep(1.0, 1.45, hot));
  capFog(m, u.uFogCap, false, 'doom-lava');
  m.uniforms = u;
  return m;
}

// Smoke going up: dark soft puffs on cards turned to the camera, rising
// `uRise` and swelling to `uSize`, bent over by uWind, lit red from beneath
// while they are low (and more so in eruption). Each card is born at its
// aEmit and lives its own time (aSeed).
export function smokeMaterial(U, { size = 100, rise = 400, spread = 120, wind = [0.4, 0, -0.1], cap = 1, alpha = 0.6, speed = 0.012 } = {}) {
  const u = {
    uFogCap: uniform(cap),
    uSize: uniform(size),
    uRise: uniform(rise),
    uSpread: uniform(spread),
    uWind: uniform(V3(...wind)),
    uAlpha: uniform(alpha),
    uSpeed: uniform(speed),
    uLit: uniform(1),
    uTime: shared(U, 'uTime'),
    uNoise: shared(U, 'uNoise'),
    uErupt: shared(U, 'uErupt'),
    uPuff: shared(U, 'uPuff'),
  };
  const m = basic({ fog: true, transparent: true, depthWrite: false });
  const aEmit = attribute('aEmit', 'vec3');
  const aSeed = attribute('aSeed', 'vec4');
  const life = fract(u.uTime.mul(u.uSpeed).mul(aSeed.y.mul(0.6).add(0.7)).mul(u.uErupt.mul(1.4).add(1)).add(aSeed.x));
  const h = u.uRise.mul(aSeed.z.mul(0.55).add(0.6)).mul(u.uErupt.mul(0.4).add(1));
  const a0 = aSeed.w.mul(6.283);
  const p = aEmit
    .add(vec3(0, h.mul(pow(life, 0.75)), 0))
    .add(u.uWind.mul(life).mul(life).mul(h))
    .add(vec3(cos(a0), 0, sin(a0)).mul(u.uSpread.mul(life).mul(aSeed.z.add(0.3))));
  const s = u.uSize.mul(life.mul(1.5).add(0.3)).mul(aSeed.z.mul(0.6).add(0.7)).mul(u.uErupt.mul(0.35).add(1)).mul(length(modelWorldMatrix[0].xyz));
  const a = a0.add(u.uTime.mul(0.03).mul(aSeed.z.sub(0.5)));
  const pg = positionGeometry;
  const qr = vec2(cos(a).mul(pg.x).sub(sin(a).mul(pg.y)), sin(a).mul(pg.x).add(cos(a).mul(pg.y)));
  placeAt(
    m,
    () => {
      const mv = modelViewMatrix.mul(vec4(p, 1));
      return vec3(mv.xy.add(qr.mul(s)), mv.z);
    },
    'doom-smoke',
  );
  const vUv = varying(pg.xy.add(0.5), 'vUv');
  const vLife = varying(life, 'vLife');
  const vSeed = varying(aSeed.w, 'vSeed');
  const pf = sample(u.uPuff, vUv);
  const n = sample(u.uNoise, vUv.mul(0.6).add(vec2(vSeed.mul(3), u.uTime.mul(-0.01)))).r;
  m.opacityNode = pf.a
    .mul(smoothstep(0.25, 0.6, pf.a.add(n.sub(0.5).mul(0.5))))
    .mul(smoothstep(0, 0.1, vLife))
    .mul(smoothstep(0.55, 1, vLife).oneMinus())
    .mul(u.uAlpha);
  // lit from the fire below: the young puffs, their undersides
  const low = pow(max(vLife.oneMinus(), 0), 2.2).mul(fall(0.75, 0.15, vUv.y).mul(0.65).add(0.35));
  const dark = vec3(0.014, 0.0105, 0.0095).mul(pf.r.mul(0.4).add(0.8).add(n.mul(0.4)));
  const lit = vec3(0.7, 0.13, 0.025).mul(u.uErupt.mul(1.6).add(0.5));
  m.colorNode = mix(dark, lit, clamp(low.mul(u.uLit).mul(u.uErupt.mul(0.8).add(0.6)), 0, 1));
  capFog(m, u.uFogCap, false, 'doom-smoke');
  m.uniforms = u;
  return m;
}

// Flames as soft tongues on camera-facing cards, each born at its aEmit and
// rising, wavering, white-yellow through orange to a dull red, gone. uK how
// much: 0 none. Added, so their order doesn’t matter.
export function flameMaterial(U, { size = 1, rise = 2, rate = 1, cap = 1 } = {}) {
  const u = {
    uFogCap: uniform(cap),
    uSize: uniform(size),
    uRise: uniform(rise),
    uRate: uniform(rate),
    uK: uniform(1),
    uTime: shared(U, 'uTime'),
    uNoise: shared(U, 'uNoise'),
  };
  const m = basic({
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const aEmit = attribute('aEmit', 'vec3');
  const aSeed = attribute('aSeed', 'vec4');
  const life = fract(u.uTime.mul(aSeed.y.mul(0.9).add(0.6)).mul(u.uRate).add(aSeed.x));
  const sc = length(modelWorldMatrix[0].xyz);
  const h = u.uRise.mul(aSeed.z.mul(0.8).add(0.6)).mul(u.uK.mul(0.5).add(0.7)).mul(sc);
  const wp0 = modelWorldMatrix.mul(vec4(aEmit, 1));
  const wp = vec4(
    wp0.x.add(
      sin(u.uTime.mul(2.7).add(aSeed.w.mul(40)).add(life.mul(3)))
        .mul(0.12)
        .mul(h)
        .mul(life),
    ),
    wp0.y.add(life.mul(h)),
    wp0.z.add(
      cos(u.uTime.mul(2.3).add(aSeed.x.mul(30)).add(life.mul(2)))
        .mul(0.12)
        .mul(h)
        .mul(life),
    ),
    wp0.w,
  );
  const s = u.uSize
    .mul(sc)
    .mul(aSeed.z.mul(0.9).add(0.55))
    .mul(u.uK.mul(0.5).add(0.6))
    .mul(life.mul(0.55).oneMinus())
    .mul(smoothstep(0, 0.12, life));
  placeAt(
    m,
    () => {
      const mv = cameraViewMatrix.mul(wp);
      return vec3(mv.xy.add(positionGeometry.xy.mul(vec2(s, s.mul(1.6)))), mv.z);
    },
    'doom-flame',
  );
  const vUv = varying(positionGeometry.xy.add(0.5), 'vUv');
  const vLife = varying(life, 'vLife');
  const vSeed = varying(aSeed.w, 'vSeed');
  const n = sample(u.uNoise, vec2(vUv.x.mul(0.7).add(vSeed.mul(3.7)), vUv.y.mul(0.5).sub(u.uTime.mul(1.1)).sub(vSeed))).r;
  const n2 = sample(u.uNoise, vec2(vUv.x.mul(1.5).add(vSeed), vUv.y.mul(1.1).sub(u.uTime.mul(1.9)))).g;
  const w = mix(0.42, 0.05, clamp(vUv.y, 0, 1));
  const x = abs(vUv.x.sub(0.5).add(n.sub(0.5).mul(0.25).mul(vUv.y)));
  const shape = fall(w, w.mul(0.2), x.add(n2.sub(0.5).mul(0.12)))
    .mul(smoothstep(0, 0.2, vUv.y))
    .mul(fall(1, 0.5, vUv.y.add(n.sub(0.5).mul(0.4))));
  const hot = shape.mul(vLife.mul(0.85).oneMinus()).mul(smoothstep(0, 0.08, vLife));
  const c0 = mix(vec3(0.7, 0.07, 0.01), vec3(2.6, 0.85, 0.16), smoothstep(0.08, 0.5, hot));
  m.colorNode = mix(c0, vec3(3.0, 1.6, 0.5), smoothstep(0.7, 1, hot));
  m.opacityNode = clamp(hot.mul(1.2), 0, 1).mul(clamp(u.uK, 0, 1.5));
  capFog(m, u.uFogCap, true, 'doom-flame');
  m.uniforms = u;
  return m;
}

// Molten gobbets thrown up and falling: points on arcs from aEmit, each its
// own speed, heading and time. uK how many show (0 none).
export function bombMaterial(U, { speed = 60, cap = 1 } = {}) {
  const u = {
    uFogCap: uniform(cap),
    uSpeed: uniform(speed),
    uK: uniform(0),
    uScale: uniform(700),
    uSize: uniform(3),
    uTime: shared(U, 'uTime'),
  };
  const m = pointsMaterial({ fog: true });
  const aSeed = attribute('aSeed', 'vec4');
  const T = aSeed.y.mul(4).add(5);
  const life = fract(u.uTime.div(T).add(aSeed.x));
  const tt = life.mul(T);
  const a = aSeed.w.mul(6.283);
  const out0 = u.uSpeed.mul(aSeed.z.mul(0.35).add(0.12));
  const v0 = vec3(cos(a).mul(out0), u.uSpeed.mul(aSeed.y.mul(0.5).add(0.6)), sin(a).mul(out0));
  m.positionNode = attribute('aPoint', 'vec3')
    .add(v0.mul(tt))
    .add(vec3(0, -4.9, 0).mul(tt).mul(tt));
  // gl_PointSize, in the canvas’s pixels (three’s sprite multiplies by the DPR again)
  m.sizeNode = u.uSize.mul(length(modelWorldMatrix[0].xyz)).mul(u.uScale).div(max(1, positionView.z.negate())).div(screenDPR);
  const vA = varying(smoothstep(0, 0.05, life).mul(smoothstep(0.6, 1, life).oneMinus()), 'vA');
  const c = uv().sub(0.5);
  m.colorNode = vec3(3.2, 1.2, 0.3);
  m.opacityNode = fall(0.25, 0.02, dot(c, c)).mul(vA).mul(u.uK);
  capFog(m, u.uFogCap, true, 'doom-bombs');
  m.uniforms = u;
  m.userData.fit = (renderer) => {
    if (!renderer) return;
    const v = new THREE.Vector2();
    renderer.getDrawingBufferSize(v);
    m.uniforms.uScale.value = v.y * 0.9;
  };
  return m;
}

// Points for the bomb material, all born at `at`, spread over `r`: one
// sprite, a point an instance.
export function bombCloud(material, count, at, r0, seed = 1) {
  const r = rng(seed);
  const pos = new Float32Array(count * 3);
  const sd = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * r0;
    pos.set([at.x + Math.cos(a) * d, at.y, at.z + Math.sin(a) * d], i * 3);
    sd.set([r(), r(), r(), r()], i * 4);
  }
  const p = pointSprite(material, pos, sd, count);
  p.frustumCulled = false;
  p.renderOrder = 7;
  return p;
}
