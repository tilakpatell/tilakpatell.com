// ../../../towns/weathertop/propsShaders.js on the node renderer: the flood
// horses’ water, the churn at their feet and their spray, the embers’ glow
// and the hair lit from both sides, the GLSL line for line in TSL under the
// same names and arguments. Each material keeps its uniforms under the
// GLSL’s names on `material.uniforms` (uniform nodes), so a horse’s update
// writes `.value` as it did.
//
// The node renderer draws a point one pixel wide, so the spray is a sprite
// instanced once a drop (PointsNodeMaterial on a Sprite with a count), its
// size the GLSL’s gl_PointSize; the drops’ seeds, starts and flights come
// off the geometry the horse filled, as instance attributes. The water and
// the churn take the scene’s fog (fog: true) and the renderer’s tone map,
// as their chunks did; the spray had neither. The two hooks take a classic
// material and give back its node twin (asNode): the caller uses what
// comes back.

import * as THREE from 'three';
import { MeshBasicNodeMaterial, PointsNodeMaterial } from 'three/webgpu';
import {
  Discard,
  Fn,
  Loop,
  abs,
  atan,
  attribute,
  cameraPosition,
  clamp,
  dot,
  float,
  floor,
  fract,
  instancedBufferAttribute,
  length,
  materialEmissive,
  max,
  mix,
  modelViewMatrix,
  modelWorldMatrix,
  normalGeometry,
  normalViewGeometry,
  normalize,
  positionGeometry,
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
  vertexColor,
} from 'three/tsl';
import { asNode, keyed, onNormal, wrap } from '../../../../../lib/three/hookNodes';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// NOISE_GLSL: value noise in three dimensions
const wHash = Fn(([p0]) => {
  const p = fract(p0.mul(0.3183099).add(0.1)).mul(17);
  return fract(p.x.mul(p.y).mul(p.z).mul(p.x.add(p.y).add(p.z)));
}, 'float');
const wNoise = Fn(([x]) => {
  const i = floor(x);
  const f0 = fract(x);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3));
  return mix(
    mix(mix(wHash(i), wHash(i.add(vec3(1, 0, 0))), f.x), mix(wHash(i.add(vec3(0, 1, 0))), wHash(i.add(vec3(1, 1, 0))), f.x), f.y),
    mix(mix(wHash(i.add(vec3(0, 0, 1))), wHash(i.add(vec3(1, 0, 1))), f.x), mix(wHash(i.add(vec3(0, 1, 1))), wHash(i.add(vec3(1, 1, 1))), f.x), f.y),
    f.z,
  );
}, 'float');
const wFbm = Fn(([p0]) => {
  const p = vec3(p0).toVar();
  const s = float(0).toVar();
  const a = float(0.5).toVar();
  Loop(4, () => {
    s.addAssign(a.mul(wNoise(p)));
    p.assign(p.mul(2.03).add(vec3(1.7, 9.2, 3.1)));
    a.mulAssign(0.5);
  });
  return s;
}, 'float');

// The water a flood horse is made of: clear and dark where you look into
// it, bright at its edges, streaked with foam that runs up it, lit by the
// moon, churning; nothing below the river’s surface (uWater, in the world).
export function floodWaterMaterial() {
  const u = {
    uTime: uniform(0),
    uWater: uniform(0),
    uMoon: uniform(V3(-0.45, 0.75, 0.5).normalize()),
    uOpacity: uniform(1),
  };
  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  const aWave = attribute('aWave', 'float');
  // the surface churns: pushed in and out, the bumps running upward
  const c = wFbm(positionGeometry.mul(1.6).add(vec3(0, u.uTime.mul(-1.8), u.uTime.mul(0.4))));
  const p = positionGeometry.add(normalGeometry.mul(c.sub(0.5)).mul(mix(0.1, 0.3, aWave)));
  const vLocal = varying(positionGeometry, 'vLocal');
  const vWave = varying(aWave, 'vWave');
  const vWorld = varying(modelWorldMatrix.mul(vec4(p, 1)).xyz, 'vWorld');
  const vNormalW = varying(normalize(modelWorldMatrix.mul(vec4(normalGeometry, 0)).xyz), 'vNormalW');
  wrap(mat, 'setupPositionView', () => modelViewMatrix.mul(vec4(p, 1)).xyz, 'middleearth:flood-water');
  const shade = Fn(() => {
    const above = vWorld.y.sub(u.uWater);
    Discard(above.lessThan(0));
    const n = normalize(vNormalW);
    const v = normalize(cameraPosition.sub(vWorld));
    const facing = abs(dot(n, v));
    const fres = pow(facing.oneMinus(), 2.5);
    // foam: long streaks running up the form, and boiling patches
    const q = vLocal.mul(vec3(1.6, 0.5, 1.6)).add(vec3(0, u.uTime.mul(-1.6), 0));
    const streak = abs(wFbm(q).mul(2).sub(1)).oneMinus();
    const boil = wFbm(vLocal.mul(3.4).add(vec3(u.uTime.mul(0.3), u.uTime.mul(-2.4), 0)));
    const foam = smoothstep(0.8, 0.96, streak)
      .mul(0.7)
      .add(smoothstep(0.64, 0.8, boil).mul(0.5))
      .toVar();
    // the wave: white only along its curling lip, and where it meets the river
    const lip = vWave.mul(smoothstep(1.35, 1.9, vLocal.y)).mul(smoothstep(-0.6, 0.4, vLocal.x));
    foam.assign(mix(foam, foam.mul(0.8).add(lip.mul(smoothstep(0.3, 0.55, boil))), vWave));
    // (smoothstep(0.3, 0.0, above), falling: one less the rising)
    foam.addAssign(smoothstep(0, 0.3, above).oneMinus().mul(0.7));
    foam.assign(clamp(foam, 0, 1));
    const lit = max(dot(n, u.uMoon), 0).mul(0.8).add(0.4);
    const deep = vec3(0.01, 0.04, 0.07);
    const body = vec3(0.16, 0.32, 0.44).mul(lit);
    const col = mix(deep, body, fres.mul(0.75).add(0.25)).toVar();
    col.assign(mix(col, vec3(0.82, 0.9, 0.98).mul(lit.mul(0.4).add(0.65)), foam));
    col.addAssign(
      vec3(0.4, 0.62, 0.8)
        .mul(fres)
        .mul(mix(1.1, 0.5, vWave)),
    );
    const a = mix(0.14, 0.1, vWave)
      .add(fres.mul(mix(0.6, 0.35, vWave)))
      .add(foam.mul(0.55));
    return vec4(
      col,
      clamp(a, 0, 0.9)
        .mul(u.uOpacity)
        .mul(smoothstep(0, 0.06, above)),
    );
  })();
  mat.colorNode = shade.rgb;
  mat.opacityNode = shade.a;
  mat.uniforms = u;
  return mat;
}

// White water churning on the river round a horse’s foot.
export function churnMaterial() {
  const u = { uTime: uniform(0), uRise: uniform(0) };
  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  const vLocal = varying(positionGeometry, 'vLocal');
  const shade = Fn(() => {
    const p = vLocal.xz;
    const r = length(p.mul(vec2(0.55, 0.42)));
    const ang = atan(p.y, p.x);
    const f = wFbm(vec3(p.mul(1.6).add(vec2(u.uTime.mul(-1.2), 0)), u.uTime.mul(0.7)));
    const g = wFbm(vec3(ang.mul(2), r.mul(3).sub(u.uTime.mul(1.5)), u.uTime.mul(0.4)));
    const foam = smoothstep(0.42, 0.7, f.mul(0.6).add(g.mul(0.5))).mul(smoothstep(0.55, 1.35, r).oneMinus());
    const a = foam.mul(u.uRise).mul(0.6);
    Discard(a.lessThan(0.01));
    return vec4(vec3(0.75, 0.85, 0.95).mul(foam.mul(0.4).add(0.6)), a);
  })();
  mat.colorNode = shade.rgb;
  mat.opacityNode = shade.a;
  mat.uniforms = u;
  return mat;
}

// Spray, flung from the wave’s crest, streaming off the mane and bursting
// at the chest: drops that rise, fly back and fall, all on the GPU.
export function sprayPoints(pg) {
  const u = {
    uTime: uniform(0),
    uRise: uniform(0),
    uWater: uniform(0),
    uScale: uniform(400),
  };
  const mat = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    toneMapped: false,
    sizeAttenuation: false,
  });
  const at = (name) => instancedBufferAttribute(new THREE.InstancedBufferAttribute(pg.getAttribute(name).array, pg.getAttribute(name).itemSize));
  const aSeed = at('aSeed');
  const aFrom = at('aFrom');
  const aVel = at('aVel');
  const life = fract(u.uTime.mul(aSeed.w.mul(0.5).add(0.45)).add(aSeed.x));
  const p0 = aFrom.add(aVel.mul(life).mul(aSeed.y.mul(0.8).add(0.6))).add(vec3(0, -2.6, 0).mul(life).mul(life));
  const p = vec3(
    p0.x,
    p0.y,
    p0.z.add(
      sin(u.uTime.mul(2).add(aSeed.z.mul(20)))
        .mul(0.15)
        .mul(life),
    ),
  );
  mat.positionNode = p;
  const vY = varying(modelWorldMatrix.mul(vec4(p, 1)).y, 'vY');
  const mvz = modelViewMatrix.mul(vec4(p, 1)).z;
  const size = mix(0.05, 0.34, life).mul(aSeed.z.add(0.45));
  // gl_PointSize, in the canvas’s pixels (three’s sprite multiplies by the DPR again)
  mat.sizeNode = size.mul(u.uScale).div(max(0.5, mvz.negate())).div(screenDPR);
  const vFade = varying(sin(life.mul(3.14159)).mul(u.uRise), 'vFade');
  mat.colorNode = vec3(0.85, 0.95, 1.05);
  mat.opacityNode = Fn(() => {
    Discard(vY.lessThan(u.uWater));
    const c = uv().sub(0.5);
    const d = clamp(dot(c, c).mul(-4).add(1), 0, 1);
    const a = d.mul(d).mul(d).mul(vFade).mul(0.36);
    Discard(a.lessThan(0.01));
    return a;
  })();
  mat.uniforms = u;
  const spray = new THREE.Sprite(mat);
  spray.count = pg.getAttribute('aSeed').count;
  return spray;
}

// an ember’s vertex colour dims its glow too (the GLSL’s USE_COLOR: only
// where the material takes vertex colours)
export function emberGlow(m) {
  const n = asNode(m);
  if (n.vertexColors) n.emissiveNode = materialEmissive.mul(vertexColor().rgb);
  return keyed(n, 'wt-ember');
}

// hair in ribbons, lit by the normals it was given from either side (the
// view normal unturned on a back face; the GLSL dropped the same flip)
export function hairBothSides(m) {
  const n = asNode(m);
  return onNormal(n, () => normalViewGeometry, 'wt-hair');
}
