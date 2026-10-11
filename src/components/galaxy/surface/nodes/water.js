// The water's two shaders (../water.js) as node materials, line for line:
// the plane (lava, a sea of cloud: PLANE_FRAG) and the sea's disc of
// Gerstner waves standing up in the shallows (SEA_VERT, SEA_FRAG), each
// taking the scene's fog as the GLSL did (and the sky's colour in it, once
// skyfog patches it). water.js keeps building the values; each factory
// makes them uniform nodes under the same names.
//
//   waterNodes(values) → { name: uniform or texture node } (a texture value a texture node)
//   planeMaterial(values, { fine }) → { material, uniforms }   (values with uFlow: the lava film over it, VIDEO's)
//   seaMaterial(values, waves, { fine }) → { material, uniforms }   (waves: ocean.js's wavesFor)
//   gerstner(p, dist, amp, uTime, waves) → { d, n, pinch }   (WAVES_GLSL's)
//   createWater(site, sunDir, sunColor, opts) → water.js's, on these materials

import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, If, abs, fract, cameraPosition, clamp, cos, dot, exp, float, length, max, mix, modelWorldMatrix, normalize, positionGeometry, pow, reflect, select, sin, smoothstep, step, texture, uniform, varyingProperty, vec2, vec3, vec4 } from 'three/tsl';
import { rev } from './common';
import { createWater as createWith } from '../waterCore';

export function waterNodes(values) {
  const out = {};
  for (const [k, v] of Object.entries(values)) out[k] = v?.isNode ? v : v?.isTexture ? texture(v) : uniform(v);
  return out;
}

// the GLSL's 1.0 - smoothstep(a, b, x), as written
const fall = (a, b, x) => smoothstep(a, b, x).oneMinus();

export function planeMaterial(values, { fine = false } = {}) {
  const u = waterNodes(values);
  const wFbm = (p) => {
    const a = u.uNoise.sample(p.mul(0.08));
    const b = u.uNoise.sample(p.mul(0.19).add(0.37));
    return a.r.mul(0.35).add(a.g.mul(0.3)).add(b.b.mul(0.2)).add(b.a.mul(0.15));
  };
  const vWorld = modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz.toVarying('vWorld');
  const colour = Fn(() => {
    const xz = vWorld.xz;
    const dist = length(vWorld.sub(cameraPosition)).toVar();
    const view = normalize(cameraPosition.sub(vWorld));
    const c = vec3(0, 0, 0).toVar();
    If(u.uKind.greaterThan(1.5), () => {
      // lava: hot channels under a crust that cracks and drifts
      const flow = wFbm(xz.mul(0.05).add(vec2(u.uTime.mul(0.02), u.uTime.mul(0.013))));
      const crust = smoothstep(0.42, 0.62, wFbm(xz.mul(0.11).sub(vec2(u.uTime.mul(0.03), 0))));
      const hot = mix(u.uColor, vec3(1, 0.85, 0.4), smoothstep(0.55, 0.8, flow));
      c.assign(mix(hot.mul(u.uGlow).mul(flow.mul(0.4).add(0.8)), u.uDeep, crust.mul(0.85)));
      if (u.uFlow) {
        // the game's lava film (MT_Volcano2), a tile every 48 m, drifting
        // with the flow; the crust keeps its dark plates over it (VIDEO)
        const f0 = fract(xz.div(48).add(vec2(u.uTime.mul(0.004), u.uTime.mul(0.0027))));
        const fuv = vec2(f0.x, select(u.uFlowFlip.greaterThan(0.5), f0.y.oneMinus(), f0.y));
        const molten = u.uFlow.sample(fuv).rgb;
        c.assign(mix(c, molten.mul(u.uGlow.mul(0.25).add(0.55)), crust.mul(0.55).oneMinus().mul(0.65)));
      }
      if (fine) {
        const near = fall(30, 260, dist);
        const plates = wFbm(xz.mul(0.42).add(vec2(u.uTime.mul(0.01), 0)));
        const crack = fall(0, 0.035, abs(plates.sub(0.5)));
        c.addAssign(mix(u.uColor, vec3(1, 0.75, 0.3), 0.4).mul(u.uGlow).mul(crack).mul(crust).mul(near).mul(0.9));
        c.mulAssign(wFbm(xz.mul(1.6)).sub(0.5).mul(0.35).mul(crust).mul(near).oneMinus());
      }
    }).Else(() => {
      // water (or cloud): waves in the light, darker looking down into it
      const e = 0.6;
      const p = xz.mul(0.09).mul(u.uWaves);
      const t = u.uTime.mul(0.6);
      const drift = vec2(t.mul(0.3), t.mul(0.2));
      const h0 = wFbm(p.add(drift)).toVar();
      const hx = wFbm(p.add(vec2(e * 0.09, 0)).add(drift)).toVar();
      const hz = wFbm(p.add(vec2(0, e * 0.09)).add(drift)).toVar();
      // (a cloud sea: a second, broader layer drifting the other way; read
      // always, weighed in for clouds alone: no reads in a branch)
      const cloud = u.uKind.greaterThan(0.5);
      const p2 = xz.mul(0.09).mul(u.uWaves2);
      const d2 = vec2(t.mul(-0.18), t.mul(-0.12));
      h0.assign(select(cloud, h0.mul(0.6).add(wFbm(p2.add(d2)).mul(0.4)), h0));
      hx.assign(select(cloud, hx.mul(0.6).add(wFbm(p2.add(vec2(e * 0.09, 0)).add(d2)).mul(0.4)), hx));
      hz.assign(select(cloud, hz.mul(0.6).add(wFbm(p2.add(vec2(0, e * 0.09)).add(d2)).mul(0.4)), hz));
      const fade = fall(80, 900, dist);
      const n = normalize(vec3(h0.sub(hx).mul(3).mul(fade), 1, h0.sub(hz).mul(3).mul(fade))).toVar();
      if (fine) {
        const q = xz.mul(0.31).mul(u.uWaves).add(vec2(t.mul(-0.4), t.mul(0.25)));
        const c0 = wFbm(q);
        n.assign(normalize(n.add(vec3(c0.sub(wFbm(q.add(vec2(0.06, 0)))), 0, c0.sub(wFbm(q.add(vec2(0, 0.06))))).mul(2).mul(fall(20, 200, dist)))));
      }
      const facing = clamp(dot(n, view), 0, 1);
      const fresnel = pow(facing.oneMinus(), 4);
      c.assign(mix(u.uDeep, u.uColor, facing.oneMinus().mul(0.65).add(0.35)));
      c.assign(mix(c, u.uSky, fresnel.mul(0.75)));
      const h = normalize(u.uSun.add(view));
      const spec = pow(max(dot(n, h), 0), select(cloud, float(40), float(220)));
      c.addAssign(u.uSunColor.mul(spec).mul(select(cloud, float(0.25), float(1.6))));
      // the cloud sea's glints: the sun's way, caught on the tops
      const glint = pow(max(dot(reflect(view.negate(), n), u.uSun), 0), 48).mul(0.8);
      c.addAssign(select(cloud, u.uSunColor.mul(glint).mul(smoothstep(0.45, 0.7, h0)), vec3(0, 0, 0)));
      // foam, in streaks
      c.assign(mix(c, vec3(0.92), smoothstep(0.72, 0.8, wFbm(p.mul(2.3).add(t.mul(0.4)))).mul(u.uFoam).mul(fade)));
    });
    return c;
  });
  const material = new MeshBasicNodeMaterial({ fog: true });
  material.colorNode = colour();
  return { material, uniforms: u };
}

// WAVES_GLSL's gerstner, one block a wave: the point's displacement, the
// surface's normal and how much the waves pinch it (whitecaps)
export function gerstner(p, dist, amp, uTime, waves) {
  let d = vec3(0, 0, 0);
  let txx = float(0);
  let tzz = float(0);
  let txz = float(0);
  let nx = float(0);
  let nz = float(0);
  for (const w of waves) {
    const fade = fall(w.len * 8, w.len * 16, dist).mul(amp);
    const f = dot(vec2(w.dx, w.dz), p).sub(uTime.mul(w.c)).mul(w.k);
    const s = sin(f);
    const co = cos(f);
    const a = fade.mul(w.amp);
    const st = fade.mul(w.steep);
    d = d.add(vec3(a.mul(co).mul(w.dx), a.mul(s), a.mul(co).mul(w.dz)));
    txx = txx.add(st.mul(s).mul(w.dx * w.dx));
    tzz = tzz.add(st.mul(s).mul(w.dz * w.dz));
    txz = txz.add(st.mul(s).mul(w.dx * w.dz));
    nx = nx.add(st.mul(co).mul(w.dx));
    nz = nz.add(st.mul(co).mul(w.dz));
  }
  return { d, n: normalize(vec3(nx.negate(), txx.add(tzz).oneMinus(), nz.negate())), pinch: txx.oneMinus().mul(tzz.oneMinus()).sub(txz.mul(txz)) };
}

export function seaMaterial(values, waves, { fine = false } = {}) {
  const u = waterNodes(values);
  const vNormal = varyingProperty('vec3', 'vNormal');
  const vPinch = varyingProperty('float', 'vPinch');
  const vDepth = varyingProperty('float', 'vDepth');
  const vCrest = varyingProperty('float', 'vCrest');
  const vShore = varyingProperty('float', 'vShore');
  const vWorld = varyingProperty('vec3', 'vWorld');

  // SEA_VERT: the disc's point under the camera, its depth, the waves on it
  const place = Fn(() => {
    const p = positionGeometry.xz.add(u.uCentre).toVar();
    // the depth there, and how far from the waterline (open sea past the map)
    const at = p.add(u.uHalf).div(u.uHalf.mul(2));
    const outside = at.x.lessThan(0).or(at.y.lessThan(0)).or(at.x.greaterThan(1)).or(at.y.greaterThan(1));
    const dw = select(outside, vec2(u.uMax, u.uReach), u.uDepth.sample(at).level(0).rg.mul(vec2(u.uMax, u.uReach))).toVar();
    const depth = dw.x;
    // (ocean.js's damp: still on the sand, standing up in the shallows)
    const shoal = select(depth.lessThanEqual(0), float(0), smoothstep(0, 1.2, depth).mul(u.uBreakers.mul(0.45).mul(fall(1.5, 9, depth)).add(1)));
    const g = gerstner(p, length(positionGeometry.xz), shoal, u.uTime, waves);
    const world = vec3(p.x, u.uLevel, p.y).add(g.d).toVar();
    vWorld.assign(world);
    vNormal.assign(g.n);
    vPinch.assign(g.pinch);
    vDepth.assign(depth);
    vCrest.assign(g.d.y);
    vShore.assign(dw.y);
    return world;
  });

  const colour = Fn(() => {
    const toEye = cameraPosition.sub(vWorld);
    const dist = length(toEye).toVar();
    const V = toEye.div(dist).toVar();
    const w = vWorld.xz;
    // fine ripples: two layers of the noise tile sliding past each other
    const near = float(1).div(dist.mul(0.01).add(1)).toVar();
    const r1 = u.uNoise.sample(w.mul(0.045).add(u.uTime.mul(vec2(0.012, 0.008))));
    const r2 = u.uNoise.sample(w.mul(0.11).sub(u.uTime.mul(vec2(0.018, 0.011)))).toVar();
    const rip = r1.rg.sub(0.5).mul(0.9).add(r2.ba.sub(0.5).mul(0.6)).mul(u.uRough).mul(near.mul(0.7).add(0.3));
    const N = normalize(vNormal.add(vec3(rip.x, 0, rip.y))).toVar();
    // mirror or water, by the angle you look at it
    const facing = max(dot(N, V), 0);
    const fresnel = pow(facing.oneMinus(), 5).mul(0.98).add(0.02);
    const R = reflect(V.negate(), N);
    const sky = mix(u.uHorizon, u.uZenith, pow(smoothstep(0, 0.8, abs(R.y)), 0.6));
    // the body: dark in the troughs, lit where a crest stands between you
    // and the sun, then the shallows' colour, then the bed showing through
    const crest = smoothstep(-0.5, 1.5, vCrest);
    const sunFlat = normalize(vec3(u.uSun.x, 0, u.uSun.z).add(vec3(1e-4)));
    const through = pow(max(dot(V, sunFlat.negate()), 0), 3).mul(crest);
    const body = mix(u.uDeep, u.uColor, crest.mul(0.4).add(through.mul(0.8)).add(0.35)).toVar();
    const shallow = exp(vDepth.negate().div(max(u.uClarity, 0.1))).toVar();
    body.assign(mix(body, u.uShallow, smoothstep(0.02, 0.6, shallow).mul(0.85)));
    body.assign(mix(body, u.uBed, pow(shallow, 4).mul(0.7)));
    // (a sea that keeps its colour out to the horizon: Scarif's)
    body.assign(mix(body, u.uFar, smoothstep(40, 500, dist).mul(u.uFarMix).mul(shallow.oneMinus())));
    const col = mix(body, sky, fresnel.mul(shallow.mul(0.4).oneMinus()).mul(u.uSkyMix)).toVar();
    // the sun's road on the water
    const H = normalize(u.uSun.add(V));
    col.addAssign(u.uSunColor.mul(pow(max(dot(N, H), 0), 260)).mul(u.uGlint).mul(near.mul(0.7).add(0.3)));
    // foam: whitecaps where the waves pinch, the crests breaking in the
    // surf, and the wash running up to the waterline in bands, laced
    const n1 = u.uNoise.sample(w.mul(0.06).add(u.uTime.mul(vec2(0.01, 0.006)))).toVar();
    const n2 = u.uNoise.sample(w.mul(0.21).sub(u.uTime.mul(vec2(0.008, 0.012)))).toVar();
    const lumpy = n1.b.mul(0.6).add(n2.a.mul(0.4)).toVar();
    const wet = step(0.001, vDepth);
    const caps = rev(0.82, 0.55, vPinch).mul(smoothstep(0.42, 0.66, lumpy)).mul(u.uCaps);
    const surf = smoothstep(3, 7, vShore).mul(fall(18, 30, vShore)).mul(wet);
    const breaking = surf.mul(smoothstep(0.05, 0.45, vCrest)).mul(u.uBreakers).mul(smoothstep(0.35, 0.62, lumpy));
    const wave = fall(2, 9, vShore).mul(sin(vShore.mul(1.15).add(u.uTime.mul(1.5)).add(lumpy.mul(2.5))).mul(0.5).add(0.5));
    const wash = smoothstep(0.62, 0.92, wave).mul(u.uShore).mul(wet);
    const lace = fall(0.4, 2.2, vShore).mul(u.uShore).mul(0.85).mul(wet);
    const foam = clamp(max(max(caps, breaking), max(wash, lace).mul(smoothstep(0.25, 0.55, lumpy.add(0.2)))), 0, 1).toVar();
    if (fine) {
      // the foam close up: bubbles and holes in it at two finer sizes, and a
      // thin bright lace where the wash's last band thins over the sand
      const f1 = u.uNoise.sample(w.mul(0.9).add(u.uTime.mul(vec2(0.03, -0.02))));
      const f2 = u.uNoise.sample(w.mul(2.7).sub(u.uTime.mul(vec2(0.02, 0.035)))).toVar();
      const cells = smoothstep(0.3, 0.7, f1.g.mul(0.6).add(f2.r.mul(0.4)));
      const nearF = fall(25, 120, dist);
      foam.mulAssign(mix(1, cells.mul(0.75).add(0.45), nearF));
      const edge = fall(0, 1.2, vShore).mul(smoothstep(0.45, 0.6, f2.b)).mul(wet).mul(u.uShore);
      foam.assign(max(foam, edge.mul(nearF)));
    }
    const foamCol = vec3(0.86, 0.9, 0.92).mul(max(dot(N, u.uSun), 0).mul(0.6).add(0.55));
    col.assign(mix(col, foamCol, foam.mul(0.92)));
    // a swamp's skin: scum and duckweed in patches
    const scum = smoothstep(0.55, 0.75, n1.r.mul(0.7).add(r2.g.mul(0.3))).mul(u.uScum);
    col.assign(mix(col, u.uBed.mul(1.4).add(vec3(0.03, 0.05, 0)), scum.mul(0.7)));
    if (fine) {
      // the shore blended: the last few centimetres clear over the bed
      const clear = fall(0, 0.35, vDepth);
      col.assign(mix(col, u.uBed.mul(0.8), clear.mul(0.55).mul(foam.oneMinus())));
    }
    return col;
  });

  const material = new MeshBasicNodeMaterial({ fog: true });
  // (the disc's vertex is the world point: the mesh stands at the origin)
  material.positionNode = place();
  material.colorNode = colour();
  return { material, uniforms: u };
}

// water.js's createWater on the node renderer: the same workings
// (../waterCore.js), these two materials for its looks
const LOOKS = {
  plane: (values, late, { fine }) => planeMaterial({ ...values, ...late }, { fine }),
  sea: (values, late, waves, { fine }) => seaMaterial({ ...values, ...late }, waves, { fine }),
};

export const createWater = (site, sunDir, sunColor, opts = {}) => createWith(site, sunDir, sunColor, opts, LOOKS);
