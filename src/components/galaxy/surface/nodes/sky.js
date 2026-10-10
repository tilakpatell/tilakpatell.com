// The sky's dome (../sky.js) as a node material: the same sum, line for
// line (the blue from the horizon up, the haze, the stars, the bodies, the
// suns, the clouds on their ceiling and, at ultra, their own shade and a
// high veil), on the far plane behind everything. The uniforms are the
// GLSL's, under its names: one a value, and the arrays (uSunDir, uSunColor,
// uSunSize, uBody…) as { value: [...] } with a node an element that shares
// the element's object, so skyfog and the scene write them as they did.
//
//   skyUniforms(site) → the uniforms (sky.js's block)
//   skyMaterial(site, { clouds, uniforms }) → { material, uniforms }
//     (`uniforms` given: those, so the cloudless copy for the reflections
//     shares every one but its own uWithClouds)
//
// The branches that hold for the whole dome (a body there or not, the
// clouds on or off) stay branches; the ones that change pixel to pixel
// (inside a body's disc, above the horizon) are worked out and then chosen
// between, so no texture is read in a branch that differs across the
// screen (WGSL forbids it).

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, If, abs, acos, cameraPosition, clamp, cos, cross, dot, exp, float, floor, fract, max, min, mix, modelWorldMatrix, normalize, positionLocal, pow, select, sin, smoothstep, sqrt, step, texture, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { noiseTexture } from '../noiseTex';
import { held, onFar, rev } from './common';

export const MAX_SUNS = 2;
export const MAX_BODIES = 3;

const dirOf = (az, el) => new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));

export function skyUniforms(site) {
  const s = site.sky;
  const col = (c, f = '#000000') => new THREE.Color(c ?? f);
  const suns = (s.suns ?? []).slice(0, MAX_SUNS);
  const bodies = (s.bodies ?? []).slice(0, MAX_BODIES);
  const sunDirs = suns.map((x) => dirOf(x.az, x.el));
  return {
    uZenith: uniform(col(s.zenith)),
    uHorizon: uniform(col(s.horizon)),
    uBelow: uniform(col(s.below, s.horizon)),
    uHaze: uniform(col(s.hazeColor, s.horizon)),
    uHazeK: uniform(s.haze ?? 0.5),
    uStars: uniform(s.stars ?? 0),
    uTime: uniform(0),
    uFlash: uniform(0),
    uSunDir: held(Array.from({ length: MAX_SUNS }, (_, i) => sunDirs[i] ?? new THREE.Vector3(0, 1, 0))),
    uSunColor: held(Array.from({ length: MAX_SUNS }, (_, i) => col(suns[i]?.color, '#ffffff'))),
    uSunSize: held(Array.from({ length: MAX_SUNS }, (_, i) => new THREE.Vector3(suns[i]?.size ?? 0.012, suns[i]?.glow ?? 1, suns[i] ? 1 : 0))),
    uBody: held(Array.from({ length: MAX_BODIES }, (_, i) => (bodies[i] ? new THREE.Vector4(...dirOf(bodies[i].az, bodies[i].el).toArray(), bodies[i].size) : new THREE.Vector4()))),
    uBodyC1: held(Array.from({ length: MAX_BODIES }, (_, i) => col(bodies[i]?.color))),
    uBodyC2: held(Array.from({ length: MAX_BODIES }, (_, i) => col(bodies[i]?.color2 ?? bodies[i]?.color))),
    uBodyBands: held(Array.from({ length: MAX_BODIES }, (_, i) => new THREE.Vector3(bodies[i]?.bands ?? 0, bodies[i]?.twist ?? 1, bodies[i]?.lit === false ? 0 : 1))),
    uCloud: uniform(new THREE.Vector4(s.clouds?.cover ?? 0, s.clouds?.scale ?? 1.1, s.clouds?.speed ?? 0.01, s.clouds?.sharp ?? 1)),
    uCloudColor: uniform(col(s.clouds?.color, '#ffffff')),
    uCloudShade: uniform(col(s.clouds?.shade, '#9aa4b4')),
    uWithClouds: uniform(1),
    uNoise: texture(noiseTexture()),
  };
}

export function skyMaterial(site, { clouds = 0, uniforms = skyUniforms(site) } = {}) {
  const u = uniforms;
  const [sunDir, sunColor, sunSize] = [u.uSunDir.nodes, u.uSunColor.nodes, u.uSunSize.nodes];
  const [body, bodyC1, bodyC2, bodyBands] = [u.uBody.nodes, u.uBodyC1.nodes, u.uBodyC2.nodes, u.uBodyBands.nodes];
  const sHash = (q) => {
    let p = fract(q.mul(vec2(123.34, 456.21)));
    p = p.add(dot(p, p.add(45.32)));
    return fract(p.x.mul(p.y));
  };
  const sNoise = (p) => u.uNoise.sample(p.mul(0.25)).b;
  const sFbm = (p) => {
    const a = u.uNoise.sample(p.mul(0.05));
    const b = u.uNoise.sample(p.mul(0.11).add(0.3));
    return a.r.mul(0.45).add(a.g.mul(0.3)).add(b.b.mul(0.15)).add(b.a.mul(0.1));
  };
  // vDir: from the camera to the dome's point, in the world
  const vDir = modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz.sub(cameraPosition).toVarying('vDir');

  const colour = Fn(() => {
    const dir = normalize(vDir).toVar();
    const el = dir.y.toVar();
    const c = mix(u.uHorizon, u.uZenith, pow(smoothstep(0, 0.75, el), 0.6)).toVar();
    c.assign(mix(c, u.uBelow, rev(0, -0.12, el)));
    // the haze along the horizon
    c.assign(mix(c, u.uHaze, exp(abs(el).mul(-9)).mul(u.uHazeK)));

    // the stars, where the sky's dark enough to show them
    If(u.uStars.greaterThan(0), () => {
      const cell = floor(dir.mul(380));
      const s = sHash(cell.xy.add(cell.z.mul(7.13)));
      const star = step(0.9965, s).mul(sin(u.uTime.mul(2).add(s.mul(80))).mul(0.4).add(0.6));
      c.addAssign(vec3(star).mul(u.uStars).mul(smoothstep(0, 0.15, el)).mul(1.4));
    });

    // what hangs in the sky
    for (let i = 0; i < MAX_BODIES; i++) {
      If(body[i].w.greaterThan(0), () => {
        const bd = normalize(body[i].xyz);
        const r = body[i].w;
        const ang = acos(clamp(dot(dir, bd), -1, 1));
        const near = ang.lessThanEqual(r.mul(1.15));
        // where on its disc: x, y across it, z out of it
        const side = normalize(cross(bd, vec3(0, 1, 0)));
        const up = cross(side, bd);
        const q = vec2(dot(dir, side), dot(dir, up)).div(sin(r)).toVar();
        const d2 = dot(q, q).toVar();
        const n = vec3(q, sqrt(max(d2.oneMinus(), 0)));
        const tw = bodyBands[i].y;
        const lat = q.y.add(sin(q.x.mul(3).add(q.y.mul(5))).mul(0.05).mul(tw)).add(sNoise(q.mul(9)).sub(0.5).mul(0.08).mul(tw)).add(sFbm(q.mul(6).add(3)).sub(0.5).mul(0.14).mul(tw));
        const band = sin(lat.mul(bodyBands[i].x).mul(3.14159)).mul(0.5).add(0.5).add(sFbm(q.mul(14).add(7)).sub(0.5).mul(0.35).mul(step(0.5, bodyBands[i].x)));
        const col = mix(bodyC1[i], bodyC2[i], clamp(band, 0, 1));
        // lit from the first sun's side (as it'd be seen from here)
        const sunLocal = vec3(dot(sunDir[0], side), dot(sunDir[0], up), dot(sunDir[0], bd).negate().add(0.35));
        const lit = mix(1, clamp(dot(n, normalize(sunLocal)).mul(0.85).add(0.25), 0.08, 1), bodyBands[i].z);
        const limb = rev(1, 0.92, d2);
        // the sky's air in front of it (fainter near the horizon)
        const seen = mix(col.mul(lit), c, exp(max(el, 0).mul(-6)).mul(0.4).add(0.25));
        const disc = near.and(d2.lessThan(1));
        c.assign(select(disc, mix(c, seen, limb), c));
        // its glow
        c.addAssign(select(near, bodyC1[i].mul(0.08).mul(rev(r.mul(1.15), r, ang)).mul(step(1, d2)), vec3(0, 0, 0)));
      });
    }

    // the suns
    for (let i = 0; i < MAX_SUNS; i++) {
      If(sunSize[i].z.greaterThan(0), () => {
        const d = dot(dir, sunDir[i]);
        const r = sunSize[i].x;
        const disc = smoothstep(cos(r), cos(r.mul(0.82)), d);
        const glow = pow(max(d, 0), 12).mul(0.32).add(pow(max(d, 0), 220).mul(0.9));
        c.addAssign(sunColor[i].mul(glow.mul(sunSize[i].y).add(disc.mul(9))));
      });
    }

    // the clouds, on a ceiling overhead (worked out under the whole sky,
    // used above the horizon)
    If(u.uWithClouds.greaterThan(0.5).and(u.uCloud.x.greaterThan(0)), () => {
      const up = max(el, 0);
      const p = dir.xz.div(up.add(0.06)).mul(u.uCloud.y).add(vec2(u.uTime.mul(u.uCloud.z), u.uTime.mul(u.uCloud.z).mul(0.4))).toVar();
      const n = sFbm(p).toVar();
      if (clouds) n.addAssign(u.uNoise.sample(p.mul(0.31).add(0.71)).g.sub(0.5).mul(0.16).add(u.uNoise.sample(p.mul(0.83).add(0.23)).r.sub(0.5).mul(0.07)));
      const cover = smoothstep(u.uCloud.x.oneMinus(), u.uCloud.x.oneMinus().add(float(0.35).div(u.uCloud.w)), n);
      const thick = smoothstep(0.4, 1, n).toVar();
      const toSun = pow(max(dot(dir, sunDir[0]), 0), 6).toVar();
      const cc = mix(u.uCloudColor, u.uCloudShade, thick.mul(0.8)).toVar();
      cc.addAssign(sunColor[0].mul(toSun).mul(0.6).mul(thick.oneMinus()));
      cc.addAssign(vec3(u.uFlash).mul(thick));
      const fade = smoothstep(0, 0.18, el);
      if (clouds) {
        // its own shade: darker where more cloud lies between it and the
        // sun (three steps toward it), the thin edges silvered near the sun
        const sunStep = normalize(sunDir[0].xz.add(vec2(1e-4, 1e-4))).mul(0.22);
        const ahead = smoothstep(0.45, 0.95, sFbm(p.add(sunStep))).add(smoothstep(0.45, 0.95, sFbm(p.add(sunStep.mul(2))))).add(smoothstep(0.45, 0.95, sFbm(p.add(sunStep.mul(3)))));
        cc.assign(mix(cc, u.uCloudShade.mul(0.85), ahead.div(3).mul(0.45).mul(toSun.oneMinus())));
        cc.addAssign(sunColor[0].mul(pow(max(dot(dir, sunDir[0]), 0), 24)).mul(thick.oneMinus()).mul(0.9));
      }
      const above = el.greaterThan(0);
      c.assign(select(above, mix(c, cc, cover.mul(fade)), c));
      if (clouds) {
        // a high veil of thin cloud, streaked along the wind, over the rest
        const p2 = dir.xz.div(up.add(0.14)).mul(u.uCloud.y).mul(0.4).add(vec2(u.uTime.mul(u.uCloud.z).mul(1.7), 0));
        const veil = smoothstep(0.52, 0.85, u.uNoise.sample(p2.mul(vec2(0.03, 0.12))).b.mul(0.7).add(u.uNoise.sample(p2.mul(0.35)).a.mul(0.3)));
        c.assign(select(above, mix(c, u.uCloudColor.add(sunColor[0].mul(toSun).mul(0.3)), veil.mul(0.22).mul(fade).mul(min(1, u.uCloud.x.mul(2)))), c));
      }
    });
    c.addAssign(u.uHaze.mul(u.uFlash).mul(0.4));
    return c;
  });

  const material = new MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  material.colorNode = colour();
  onFar(material);
  return { material, uniforms };
}
