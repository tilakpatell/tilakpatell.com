// The surface's FINAL grade as nodes (universe/post.js's last pass, line
// for line: the exposure, the grain, the toe, the neutral shoulder, the sRGB
// encoding, the saturation, the contrast, a game's LUT, the vignette, a
// hit's red edges, the rush, the aberration, the soft edge and the dither),
// apart from the passes before it, so two posts end in it: ./post.js's
// (the scene and the house's bloom, the mid level on WebGPU) and
// ./chain.js's (the game's chain, lib/three/light/post.js, before it).
//
// With `uLinear` on (the record's picture, lane Q6: its TonemapMethod_Linear)
// the shoulder is the record's linear tone map (a clamp to 0…1) and the LUT
// reads that linear picture before it is encoded, the game's order; the
// house's saturation and contrast are set aside with it, as grading() does.
//
//   finalUniforms({ small }) → { u, tNoise, noiseSize }
//   finalGrade(u, lit, { tNoise }) → the node: vec4, encoded (lit(uv) → the
//     linear colour at a screen uv, bloom and all)
//   BLANK_LUT, finite(c), shoulder(c), srgb(c)

import * as THREE from 'three';
import { Fn, If, clamp, dot, float, length, max, mix, pow, screenCoordinate, select, smoothstep, step, texture, texture3D, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { blueNoiseTexture } from '../../../../lib/three/noise';

// (a texture node needs a picture: a 2³ identity cube until a game hands one)
export const BLANK_LUT = (() => {
  const d = new Uint8Array(2 * 2 * 2 * 4);
  for (let i = 0; i < 8; i++) d.set([(i & 1) * 255, ((i >> 1) & 1) * 255, ((i >> 2) & 1) * 255, 255], i * 4);
  const t = new THREE.Data3DTexture(d, 2, 2, 2);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
})();

// finite(): NaN to black, nothing hotter than 64 (a NaN fails every
// comparison, so it's caught by asking whether it equals itself)
export const finite = (c) => clamp(select(c.x.equal(c.x).and(c.y.equal(c.y)).and(c.z.equal(c.z)), c, vec3(0, 0, 0)), 0, 64);

// the shoulder of Khronos' neutral tone map without its toe
export const shoulder = Fn(([c]) => {
  const out = vec3(c).toVar();
  const peak = max(c.x, max(c.y, c.z));
  If(peak.greaterThanEqual(0.8), () => {
    const top = float(0.04).div(peak.sub(0.6)).oneMinus();
    const s = c.mul(top.div(peak));
    out.assign(mix(s, vec3(top), float(1).div(peak.sub(top).mul(0.15).add(1)).oneMinus()));
  });
  return out;
});

export const srgb = (c) => mix(c.mul(12.92), pow(c, vec3(1 / 2.4)).mul(1.055).sub(0.055), step(0.0031308, c));

export function finalUniforms({ small = false } = {}) {
  const noiseSize = small ? 32 : 64;
  const tNoise = blueNoiseTexture(noiseSize, 1);
  const u = {
    uContrast: uniform(0.07),
    uSat: uniform(1.06),
    uVignette: uniform(0.3),
    uAspect: uniform(16 / 9),
    uRush: uniform(0),
    uCenter: uniform(new THREE.Vector2(0.5, 0.5)),
    uHit: uniform(0),
    uFrame: uniform(new THREE.Vector2()),
    uNoiseSize: uniform(noiseSize),
    uGrain: uniform(0),
    uAberration: uniform(0),
    uExposure: uniform(1),
    uToe: uniform(new THREE.Vector2(0, 0)),
    uDefocus: uniform(0),
    uTexel: uniform(new THREE.Vector2(1, 1)),
    uGlow: uniform(1), // (lite() takes the bloom off: 0)
    // a game's grading LUT (lib/three/gameLut.js), over the finished colour
    // as the game grades its own: off (mix 0) unless a world has one
    tLut: texture3D(BLANK_LUT),
    uLutSize: uniform(2),
    uLutMix: uniform(0),
    // the record's linear tone map, the LUT read before the encoding (1), or the house's shoulder (0)
    uLinear: uniform(0),
  };
  return { u, tNoise, noiseSize };
}

export function finalGrade(u, lit, { tNoise }) {
  const noise = (shift) => texture(tNoise, screenCoordinate.xy.add(shift).div(u.uNoiseSize)).r;
  const lut = (c) => {
    // (read at the texels' middles, so 0 and 1 land on the cube's ends)
    const uvw = c.mul(u.uLutSize.sub(1)).add(0.5).div(u.uLutSize);
    return mix(c, u.tLut.sample(uvw).rgb, u.uLutMix);
  };
  return Fn(() => {
    const vUv = uv();
    const lin = lit(vUv).toVar();
    If(u.uAberration.greaterThan(0), () => {
      const q0 = vUv.sub(0.5);
      const off = q0.mul(u.uAberration).mul(smoothstep(0.15, 0.75, length(q0.mul(vec2(u.uAspect, 1)))));
      lin.assign(vec3(lit(vUv.add(off)).r, lin.g, lit(vUv.sub(off)).b));
    });
    If(u.uDefocus.greaterThan(0), () => {
      const qd = vUv.sub(0.5).mul(vec2(u.uAspect, 1));
      const w = u.uDefocus.mul(smoothstep(0.55, 1, length(qd).div(length(vec2(u.uAspect, 1)).mul(0.5))));
      const o = u.uTexel.mul(1.5);
      const soft = lin.add(lit(vUv.add(vec2(o.x, 0)))).add(lit(vUv.sub(vec2(o.x, 0)))).add(lit(vUv.add(vec2(0, o.y)))).add(lit(vUv.sub(vec2(0, o.y))));
      lin.assign(mix(lin, soft.div(5), w));
    });
    If(u.uRush.greaterThan(0.001), () => {
      const d = vUv.sub(u.uCenter);
      const k = u.uRush.mul(smoothstep(0.1, 0.75, length(d.mul(vec2(u.uAspect, 1)))));
      const acc = vec3(lin).toVar();
      for (let i = 1; i <= 5; i++) acc.addAssign(lit(vUv.sub(d.mul(k.mul(0.011 * i)))));
      lin.assign(acc.div(6));
    });
    lin.mulAssign(u.uExposure);
    // grain: on the light, before the tone map, moving each frame
    lin.mulAssign(select(u.uGrain.greaterThan(0), noise(u.uFrame).sub(0.5).mul(2).mul(u.uGrain).add(1), float(1)));
    // the toe: the colour scaled by its luminance's share
    lin.mulAssign(select(u.uToe.y.greaterThan(0), smoothstep(u.uToe.x, u.uToe.y, dot(lin, vec3(0.2126, 0.7152, 0.0722))), float(1)));
    const c = vec3(0).toVar();
    If(u.uLinear.greaterThan(0), () => {
      // the record's: a linear tone map, its LUT on the linear 0…1 picture, then the encoding
      const toned = clamp(lin, 0, 1).toVar();
      If(u.uLutMix.greaterThan(0), () => toned.assign(lut(toned)));
      c.assign(srgb(toned));
    }).Else(() => {
      c.assign(srgb(clamp(shoulder(lin), 0, 1)));
      const l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c.assign(max(mix(vec3(l), c, u.uSat), 0));
      c.assign(mix(c, c.mul(c).mul(c.mul(-2).add(3)), u.uContrast));
      If(u.uLutMix.greaterThan(0), () => c.assign(lut(c)));
    });
    const q = vUv.sub(0.5).mul(vec2(u.uAspect, 1));
    c.mulAssign(u.uVignette.add(u.uRush.mul(0.22)).mul(smoothstep(u.uRush.mul(-0.1).add(0.35), 1.1, length(q).mul(1.25))).oneMinus());
    // a hit: the edges flash red
    c.assign(mix(c, vec3(1, 0.12, 0.08), u.uHit.mul(0.4).mul(smoothstep(0.45, 1.15, length(q).mul(1.3)))));
    // the dither, under a step of the 8 bits it's written at
    c.addAssign(noise(vec2(17, 31)).sub(0.5).div(255));
    return vec4(clamp(c, 0, 1), 1);
  })();
}
