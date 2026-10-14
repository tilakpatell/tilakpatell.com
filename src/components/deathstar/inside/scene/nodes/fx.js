// The fight’s effects on the node renderer (lane P1, the inside’s port by
// lane T’s method): each of ../glsl/fx.js’s shaders as TSL, with the same
// names, flags and arithmetic, reading the same per-instance attributes fx.js
// writes, so the bolts, sparks, fire, smoke and scorches draw as they did.
//
//   spriteMaterial() → 'ds-glow'   the bolts’ glows, sparks and muzzle flashes, added
//   puffMaterial() → 'ds-puff'   fire and smoke, premultiplied
//   scorchMaterial() → 'ds-scorch'   the burns on the walls, premultiplied, pulled towards the eye
//   facing(material, size) → { vP, vCore, vHalf, vColour, vBand }   the sprites’ vertex stage (saber.js’s too):
//     size 'vec2' (core, half) or 'vec3' (and a ring’s band)

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, abs, attribute, cameraProjectionMatrix, cameraViewMatrix, cos, dot, exp, floor, fract, length, max, mix, positionGeometry, select, sin, smoothstep, varying, varyingProperty, vec2, vec3, vec4 } from 'three/tsl';

// GLSL’s smoothstep with its edges reversed (1 at a, down to 0 at b), as nodes
export const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();

// (its colour is premultiplied in the shader already, as the GLSL’s: the
// flag is for the blend alone, so the node material’s own multiply is off)
export const keepPremultiplied = (m) => {
  m.setupPremultipliedAlpha = (builder, out) => out;
  return m;
};

// (a ShaderMaterial has no fog and takes no light: a basic node material
// that took the scene’s lights, using none, would still be built again
// whenever the lamps change; the node renderer tone-maps and encodes the
// whole frame at its end, as the bloom chain’s output pass does on the
// classic one, so the GLSL’s colour-space chunk has nothing to do here)
const material = (params) => new MeshBasicNodeMaterial({ lights: false, transparent: true, depthWrite: false, toneMapped: false, fog: false, ...params });

// A sprite: a quad facing the eye, drawn out along a way (aDir) by as much
// of it as is seen across the view, so a way pointed at you is a round
// glow. Positions are the world’s (aAt), as the GLSL’s viewMatrix had them.
export function facing(m, size = 'vec2') {
  const vP = varyingProperty('vec2', 'vSpriteP');
  const vCore = varyingProperty('float', 'vSpriteCore');
  const vHalf = varyingProperty('float', 'vSpriteHalf');
  const vColour = varyingProperty('vec3', 'vSpriteColour');
  const vBand = size === 'vec3' ? varyingProperty('float', 'vSpriteBand') : null;
  m.vertexNode = Fn(() => {
    const s = attribute('aSize', size);
    const c = cameraViewMatrix.mul(vec4(attribute('aAt', 'vec3'), 1));
    const way = cameraViewMatrix.mul(vec4(attribute('aDir', 'vec3'), 0)).xy;
    const seen = length(way);
    const axis = select(seen.greaterThan(1e-4), way.div(seen), vec2(1, 0));
    const side = vec2(axis.y.negate(), axis.x);
    const core = s.x.mul(seen);
    const p = vec2(positionGeometry.x.mul(core.add(s.y)), positionGeometry.y.mul(s.y));
    vP.assign(p);
    vCore.assign(core);
    vHalf.assign(s.y);
    vColour.assign(attribute('aColour', 'vec3'));
    if (vBand) vBand.assign(s.z);
    return cameraProjectionMatrix.mul(vec4(c.xy.add(axis.mul(p.x)).add(side.mul(p.y)), c.z, c.w));
  })();
  return { vP, vCore, vHalf, vColour, vBand };
}

// how far out of its glow a sprite’s point is: 0 on its core’s line, 1 at its rim
export const reachOf = ({ vP, vCore, vHalf }) => length(vec2(max(abs(vP.x).sub(vCore), 0), vP.y)).div(vHalf);

export function spriteMaterial() {
  const m = material({ name: 'ds-glow', blending: THREE.AdditiveBlending });
  const v = facing(m);
  const r = reachOf(v);
  m.colorNode = v.vColour.mul(exp(r.mul(r).mul(-5))).mul(r.oneMinus());
  m.maskNode = r.lessThan(1);
  return m;
}

// a cheap value noise, for the ragged edges of smoke, fire and scorches
const hash = (p) => {
  const q = fract(p.mul(vec2(123.34, 456.21)));
  const r = q.add(dot(q, q.add(45.32)));
  return fract(r.x.mul(r.y));
};
const noise = (p) => {
  const i = floor(p);
  const w = fract(p);
  const f = w.mul(w).mul(w.mul(-2).add(3));
  return mix(mix(hash(i), hash(i.add(vec2(1, 0))), f.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x), f.y);
};

// A puff: a billow facing the eye, turned and sized by aShape (size, spin,
// seed); its colour premultiplied, so fire and smoke share one draw.
export function puffMaterial() {
  const m = keepPremultiplied(material({ name: 'ds-puff', premultipliedAlpha: true, blending: THREE.NormalBlending }));
  const vUv = varyingProperty('vec2', 'vPuffUv');
  const vSeed = varyingProperty('vec2', 'vPuffSeed');
  const vColour = varyingProperty('vec4', 'vPuffColour');
  m.vertexNode = Fn(() => {
    const shape = attribute('aShape', 'vec4');
    const c = cameraViewMatrix.mul(vec4(attribute('aAt', 'vec3'), 1));
    const s = sin(shape.y);
    const k = cos(shape.y);
    // (GLSL’s mat2(k, s, −s, k) × position.xy, its columns written out)
    const g = positionGeometry.xy;
    const turned = vec2(k.mul(g.x).sub(s.mul(g.y)), s.mul(g.x).add(k.mul(g.y))).mul(shape.x);
    vUv.assign(g);
    vSeed.assign(shape.zw);
    vColour.assign(attribute('aColour', 'vec4'));
    return cameraProjectionMatrix.mul(vec4(c.xy.add(turned), c.z, c.w));
  })();
  const d = length(vUv);
  const p = vUv.mul(2.2).add(vSeed);
  const n = noise(p).mul(0.65).add(noise(p.mul(2.3).add(3.1)).mul(0.35));
  const shape = fall(1, 0.25, d.add(n.sub(0.5).mul(0.6)));
  m.colorNode = vColour.rgb.mul(shape);
  m.opacityNode = vColour.a.mul(shape);
  m.maskNode = d.lessThan(1);
  return m;
}

// A scorch: soot darkening the wall, ragged at its edge, with an ember at
// its middle that glows orange and cools (aBurn: ember, soot, seed). Placed
// by its instance’s matrix, as three places any instanced mesh.
export function scorchMaterial() {
  const m = keepPremultiplied(material({ name: 'ds-scorch', premultipliedAlpha: true, blending: THREE.NormalBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  const vUv = varying(positionGeometry.xy.mul(2), 'vScorchUv');
  const burn = attribute('aBurn', 'vec3');
  const d = length(vUv);
  const n = noise(vUv.mul(3).add(burn.z));
  const soot = fall(1, 0.15, d.add(n.sub(0.5).mul(0.55))).mul(0.85).mul(burn.y);
  const ember = fall(0.45, 0, d.add(n.sub(0.5).mul(0.3))).mul(burn.x);
  m.colorNode = vec3(3, 0.9, 0.25).mul(ember);
  m.opacityNode = soot;
  m.maskNode = d.lessThan(1);
  return m;
}
