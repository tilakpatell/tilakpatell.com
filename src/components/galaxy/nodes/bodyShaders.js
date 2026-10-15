// The planets’ shaders (../bodyShaders.js) on the node renderer: the one
// surface shader, its families of ground (./bodyFamilies.js), its clouds,
// the scans up close, the game’s skin from orbit (../bodySkin.js’s SKIN_FRAG),
// the light of one or two suns and the atmosphere’s haze, then Scarif’s
// shield (../bodyShield.js), each line for line from its GLSL as TSL.
// nodes/bodies.js builds the meshes and feeds them, as bodies.js does.
//
// What differs on the node renderer: no GLSL text, so NOISE, ATMO, the shell,
// SURFACE_VERT, SURFACE_HEAD, CLOUDS, SHIELD_VERT and SHIELD_FRAG are gone.
// The noise is lib/three/noiseNodes’s noiseWith (each material its own set,
// over its own uSeed), the march lib/three/atmosphereNodes’s inscatter, the
// vertex stage the node material’s own (vObj is positionLocal, vWorld
// positionWorld). surfaceFrag takes, beside the family and its slots, the
// uniforms (nodes, under the GLSL’s names) and the #defines the
// ShaderMaterial carried, and gives the surface’s colour; shieldFrag(uniforms)
// gives the shield’s. #ifdefs are branches taken in JS as the graph is built,
// FBM_OCT noiseWith’s `octaves`. A texture read under a branch is a
// textureGrad with its slopes taken before it (the skin already did; the
// scans now do too): WGSL samples only in uniform control flow.
//
//   surfaceFrag(family, slots, { skin, uniforms, defines }) → the colour node (vec3)
//   shieldFrag(uniforms) → the colour node (vec3): uShield, uTime, uHit, uHitAt
//   noiseWith, inscatter: re-exported, as the original re-exported NOISE and ATMO
//
// Everything’s in linear light: lit ground tops out ~1.0–1.4, the things
// that glow (lava, city lights) go well past the bloom’s 1.7.

import { Fn, If, abs, acos, atan, cameraPosition, clamp, cross, dFdx, dFdy, dot, exp, exp2, float, floor, fract, fwidth, length, log2, max, min, mix, modelWorldMatrix, normalize, positionLocal, positionWorld, pow, select, sin, smoothstep, sqrt, transpose, varying, vec2, vec3, vec4 } from 'three/tsl';
import { noiseWith } from '../../../lib/three/noiseNodes';
import { inscatter } from '../../../lib/three/atmosphereNodes';
import { FAMILY_SURFACES, cratersWith, spinY, whirl } from './bodyFamilies';

export { noiseWith, inscatter };

const FBM_OCT = 10;
const pairOf = (h) => h.nodes ?? h;

// clouds, drawn inside the surface shader: drifting, wind-stretched,
// warped; uCloud = (cover, sharpness, drift, scale). → { cover, thick } (the
// GLSL’s return and its gCloudThick)
function cloudAt(g, P, nOct) {
  const { u, n, flags } = g;
  const q = spinY(P, u.uTime.mul(u.uCloud.z)).toVar();
  if (flags.STORMS) {
    // Kamino: cyclones, their arms wound round them
    q.assign(whirl(q, normalize(vec3(0.6, 0.45, 0.66)), 0.06, 3.2));
    q.assign(whirl(q, normalize(vec3(-0.7, -0.35, 0.6)), 0.05, -2.8));
    q.assign(whirl(q, normalize(vec3(-0.2, 0.55, -0.8)), 0.045, 3.0));
    q.assign(whirl(q, normalize(vec3(0.5, -0.6, -0.6)), 0.04, -2.6));
  }
  q.mulAssign(u.uCloud.w);
  q.assign(vec3(q.x, q.y.mul(1.8), q.z));
  const w = vec3(n.noise(q.mul(0.7).add(3.1)), n.noise(q.mul(0.7).add(7.7)), n.noise(q.mul(0.7).add(1.3))).toVar();
  const big = n.noise(q.mul(0.3).add(5.0));
  const v = n.fbm(q.mul(1.3).add(w.mul(1.2)).add(vec3(0.0, u.uTime.mul(u.uCloud.z).mul(0.3), 0.0)), nOct).add(big.mul(0.3)).toVar();
  const th = mix(0.42, -0.42, u.uCloud.x).toVar();
  return {
    cover: smoothstep(th.sub(0.05), th.add(float(0.4).div(u.uCloud.y)), v).mul(0.95),
    thick: smoothstep(th, th.add(float(1.2).div(u.uCloud.y)), v),
  };
}

// ── The scans up close (the GLSL’s DETAIL): uDetK = (frequency in tiles a
// radius, colour strength, normal strength, on 0…1) ──
const LUMA = vec3(0.2126, 0.7152, 0.0722);
// a triplanar read of t at q (its slopes dq: { x, y }), each face weighted by w
const tri = (t, q, dq) => [
  t.sample(q.yz).grad(dq.x.yz, dq.y.yz),
  t.sample(q.zx).grad(dq.x.zx, dq.y.zx),
  t.sample(q.xy).grad(dq.x.xy, dq.y.xy),
];
const triLum = (t, q, dq, w) => {
  const [a, b, c] = tri(t, q, dq);
  return dot(a.rgb, LUMA).mul(w.x).add(dot(b.rgb, LUMA).mul(w.y)).add(dot(c.rgb, LUMA).mul(w.z));
};
// the normal map’s tilt, carried onto the sphere’s axes (a tangential push)
const triTilt = (t, q, dq, w) => {
  const [ta, tb, tc] = tri(t, q, dq);
  const a = ta.xy.mul(2.0).sub(1.0);
  const b = tb.xy.mul(2.0).sub(1.0);
  const c = tc.xy.mul(2.0).sub(1.0);
  return vec3(0.0, a.x, a.y).mul(w.x).add(vec3(b.y, 0.0, b.x).mul(w.y)).add(vec3(c.x, c.y, 0.0).mul(w.z));
};
// the points the scans are read at, and their slopes across the pixel (taken
// here, before any branch, as the GLSL’s implicit ones were)
function detailAt(g, P) {
  const f = g.u.uDetK.x;
  const q1 = P.mul(f).toVar();
  const q2 = P.mul(f).mul(6.5).add(0.37).toVar();
  const q1b = q1.mul(0.6).toVar();
  const q2b = q2.mul(0.6).toVar();
  const d = (q) => ({ x: dFdx(q), y: dFdy(q) });
  return { q1, q2, q1b, q2b, d1: d(q1), d2: d(q2), d1b: d(q1b), d2b: d(q2b) };
}
function detail(g, P, s, at) {
  const { u, gFoot } = g;
  const f = u.uDetK.x;
  // (none of it from further off: no fetches; its weight’s already 0 at that edge)
  If(u.uDetK.w.greaterThan(0.0).and(gFoot.mul(f).lessThan(0.05)), () => {
    const k1 = float(1.0).sub(smoothstep(0.012, 0.05, gFoot.mul(f))).mul(u.uDetK.w).toVar();
    const k2 = float(1.0).sub(smoothstep(0.012, 0.05, gFoot.mul(f).mul(6.5))).mul(u.uDetK.w).toVar();
    const w = pow(abs(P), vec3(4.0)).toVar();
    w.divAssign(w.x.add(w.y).add(w.z));
    const Gt = s.grad.sub(P.mul(dot(s.grad, P)));
    const steep = smoothstep(0.18, 0.55, length(Gt)).toVar();
    const a1 = triLum(u.uDetA, at.q1, at.d1, w).div(u.uDetMean.x);
    const a2 = triLum(u.uDetA, at.q2, at.d2, w).div(u.uDetMean.x);
    const b1 = triLum(u.uDetB, at.q1b, at.d1b, w).div(u.uDetMean.y);
    const b2 = triLum(u.uDetB, at.q2b, at.d2b, w).div(u.uDetMean.y);
    const d1 = mix(a1, b1, steep);
    const d2 = mix(a2, b2, steep);
    const land = float(1.0).sub(clamp(s.wet, 0.0, 1.0)).toVar();
    const d = mix(1.0, clamp(d1, 0.2, 2.2), k1.mul(u.uDetK.y).mul(land)).mul(mix(1.0, clamp(d2, 0.2, 2.2), k2.mul(u.uDetK.y).mul(0.8).mul(land)));
    s.alb.mulAssign(d);
    const tilt = mix(triTilt(u.uDetAN, at.q1, at.d1, w), triTilt(u.uDetBN, at.q1b, at.d1b, w), steep).mul(k1).add(mix(triTilt(u.uDetAN, at.q2, at.d2, w), triTilt(u.uDetBN, at.q2b, at.d2b, w), steep).mul(k2).mul(0.7));
    s.grad.subAssign(tilt.mul(u.uDetK.z).mul(land));
  });
}
// From orbit (uNearOct, eased in by bodies.js once the world’s over 300
// pixels tall), a fine grain in the ground’s relief, its slope by finite
// differences (two taps past the one here), so the land catches the sun the
// way the universe map’s planets’ normal maps do, and shaded a little by it.
// Gone again as the scans come in up close, and never on water.
function nearRelief(g, P, s) {
  const { u, n, octs, fade, gFoot } = g;
  const f = 48.0;
  const land = float(1.0).sub(clamp(s.wet, 0.0, 1.0));
  const k = clamp(u.uNearOct.sub(0.25).div(1.5), 0.0, 1.0).mul(fade(f)).mul(land).mul(smoothstep(0.012, 0.05, gFoot.mul(u.uDetK.x))).mul(clamp(u.uBump.div(0.02), 0.2, 1.5)).toVar();
  If(k.greaterThan(0.0), () => {
    const o = min(octs(f), 3.0).toVar();
    const t1 = normalize(cross(P, select(abs(P.y).lessThan(0.9), vec3(0.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0)))).toVar();
    const t2 = cross(P, t1).toVar();
    const e = float(0.25).div(float(f).mul(exp2(o.sub(1.0)))).toVar();
    const q = P.mul(f).add(13.7).toVar();
    const h0 = n.fbm(q, o).toVar();
    const h1 = n.fbm(q.add(t1.mul(e.mul(f))), o);
    const h2 = n.fbm(q.add(t2.mul(e.mul(f))), o);
    s.grad.addAssign(t1.mul(h1.sub(h0)).add(t2.mul(h2.sub(h0))).div(e).mul(0.1 / f).mul(k));
    // (and a touch in its colour: a canopy’s crowns, the grit in the sand,
    // which show front-lit too, where a slope doesn’t)
    s.alb.mulAssign(float(1.0).add(h0.mul(0.22).mul(k)));
  });
}

// ── The game’s skin from orbit (../bodySkin.js’s SKIN_FRAG): uSkinK = (times
// round, normal strength, the normal’s green sign, the colour’s alpha at
// which the ground is water); uSkinC = (the clouds’ times round, the
// coverage under which there’s no cloud, -, -) ──
// three’s sphere UVs for a point on the unit sphere (u from the seam at -x, v up)
const skinUv = (P) => vec2(atan(P.z, P.x.negate()).div(6.2831853), float(1.0).sub(acos(clamp(P.y, -1.0, 1.0)).div(3.14159265)));
// and their slopes across the pixel: the u that doesn’t jump at the seam
// lends its slope, so the seam’s pixels take the mip their neighbours do
function skinUvs(P) {
  const uv = skinUv(P).toVar();
  const a = uv.x;
  const b = fract(a.add(0.5));
  const ua = vec2(dFdx(a), dFdy(a)).toVar();
  const ub = vec2(dFdx(b), dFdy(b)).toVar();
  const du = select(dot(ua, ua).lessThan(dot(ub, ub)), ua, ub).toVar();
  return { uv, dx: vec2(du.x, dFdx(uv.y)).toVar(), dy: vec2(du.y, dFdy(uv.y)).toVar() };
}
// a map at uv, n times round, turned that much of the way round
const skinAt = (t, sk, uv, turn, nRound) => {
  const k = vec2(nRound, 1.0);
  return t.sample(uv.add(vec2(turn, 0.0)).mul(k)).grad(sk.dx.mul(k), sk.dy.mul(k));
};
function skin(g, P, s, sk) {
  const { u, flags } = g;
  const k = u.uSkinMix;
  If(k.greaterThan(0.0), () => {
    const c = skinAt(u.uSkinColor, sk, sk.uv, 0.0, u.uSkinK.x).toVar();
    s.alb.assign(mix(s.alb, c.rgb, k));
    // (the game’s smoothness, kept in the alpha: its seas are the smooth part)
    if (flags.SKIN_SEAS) s.wet.assign(mix(s.wet, smoothstep(u.uSkinK.w.sub(0.06), u.uSkinK.w.add(0.06), c.a), k));
    else s.wet.mulAssign(float(1.0).sub(k));
    s.emit.mulAssign(float(1.0).sub(k));
    let gr = vec3(0.0);
    if (flags.SKIN_NORMAL) {
      // the map’s tilt along the map’s east and north (east: the way u grows)
      const nm = skinAt(u.uSkinNormal, sk, sk.uv, 0.0, u.uSkinK.x).xyz.mul(2.0).sub(1.0).toVar();
      const east = normalize(vec3(P.z, 0.0, P.x.negate()).add(vec3(1e-5, 0.0, 0.0))).toVar();
      gr = east.mul(nm.x).add(cross(P, east).mul(nm.y).mul(u.uSkinK.z)).negate().mul(u.uSkinK.y);
    }
    s.grad.assign(mix(s.grad, gr, k));
  });
}
// the game’s clouds as the cover (their light stays the site’s), drifting
// at the look’s own rate, and their shadow a little toward the sun
function skinClouds(g, P, s, thick, sk) {
  const { u, flags, gSunObj } = g;
  if (!flags.SKIN_CLOUDS) return;
  const k = u.uSkinMix;
  If(k.greaterThan(0.0), () => {
    const turn = u.uTime.mul(u.uCloud.z).div(6.2831853).toVar();
    const cov = smoothstep(u.uSkinC.y, 1.0, skinAt(u.uSkinClouds, sk, sk.uv, turn, u.uSkinC.x).r).toVar();
    s.cloud.assign(mix(s.cloud, cov, k));
    s.shade.assign(mix(s.shade, smoothstep(u.uSkinC.y, 1.0, skinAt(u.uSkinClouds, sk, skinUv(normalize(P.add(gSunObj.mul(0.015)))), turn, u.uSkinC.x).r).mul(0.7), k));
    thick.assign(mix(thick, cov, k));
  });
}

// relief, clouds, sunlight (one or two suns), the sea’s glint, a faint
// light on the night side, the look’s own light, then the haze
export function surfaceFrag(family, slots, { skin: painted = false, uniforms: u, defines = {} } = {}) {
  // (each #define a flag that’s true: the GLSL’s are empty strings)
  const flags = Object.fromEntries(Object.keys(defines).map((k) => [k, true]));
  const n = noiseWith(u.uSeed, { octaves: Number(defines.FBM_OCT ?? FBM_OCT) });
  const palList = pairOf(u.uPal);
  const pal = Object.fromEntries(slots.map((name, i) => [name.toUpperCase(), palList[i]]));
  const [sunDir0, sunDir1] = pairOf(u.uSunDir);
  const [sunCol0, sunCol1] = pairOf(u.uSunCol);
  const craters = cratersWith(n);
  const march = 'ATMO' in flags ? inscatter(u, { steps: 7 }) : null;
  return Fn(() => {
    const P = normalize(positionLocal).toVar();
    // how much of the unit sphere this pixel covers (whatever the screen’s size)
    const lx = length(dFdx(P));
    const ly = length(dFdy(P));
    const gFoot = max(max(sqrt(lx.mul(ly)), float(0.4).mul(max(lx, ly))), 1e-7).toVar();
    const R = u.uRot;
    const Ng = normalize(R.mul(P)).toVar();
    const gSunObj = normalize(transpose(R).mul(sunDir0)).toVar();
    const gNight = float(1.0).sub(smoothstep(-0.14, 0.1, max(dot(Ng, sunDir0), dot(Ng, sunDir1)))).toVar();
    // octaves of an fbm starting at frequency f this pixel can show (and from
    // orbit on a strong device, uNearOct more: bodies.js’s nearOctaves)
    const octs = (f) => clamp(log2(float(0.45).div(gFoot.mul(f))).add(u.uNearOct), 1.0, u.uMaxOct.add(u.uNearOct));
    // 1 while a pattern of frequency f is resolved here, fading to 0 before it’d alias
    const fade = (f) => float(1.0).sub(smoothstep(0.1, 0.45, gFoot.mul(f)));
    const g = { u, n, pal, palList, flags, gFoot, gNight, gSunObj, octs, fade, craters };
    // (the slopes a branch reads its textures with, taken out here)
    const sk = painted ? skinUvs(P) : null;
    const at = 'DETAIL' in flags ? detailAt(g, P) : null;
    const s = { alb: vec3(0.5).toVar(), grad: vec3(0.0).toVar(), wet: float(0.0).toVar(), emit: vec3(0.0).toVar(), cloud: float(0.0).toVar(), shade: float(0.0).toVar() };
    FAMILY_SURFACES[family](P, s, g);
    if (sk) skin(g, P, s, sk);
    if (at) {
      If(u.uNearOct.greaterThan(0.01), () => nearRelief(g, P, s));
      detail(g, P, s, at);
    }
    const thick = float(0.0).toVar();
    if ('CLOUDS' in flags) {
      // (down under them, skimming the ground, they’re overhead: only their shadows show)
      const under = smoothstep(0.03, 0.12, length(cameraPosition.sub(u.uCenter)).div(u.uR).sub(1.0)).toVar();
      const co = min(octs(u.uCloud.w), select(u.uMaxOct.greaterThan(6.0), 6.0, 4.0)).toVar();
      If(under.greaterThan(0.0), () => {
        const c = cloudAt(g, P, co);
        s.cloud.assign(c.cover.mul(under));
        thick.assign(c.thick);
      });
      s.shade.assign(cloudAt(g, normalize(P.add(gSunObj.mul(0.015))), min(co, 3.0)).cover.mul(0.7));
    }
    if (sk) skinClouds(g, P, s, thick, sk);
    const Gt = s.grad.sub(P.mul(dot(s.grad, P)));
    const N = normalize(R.mul(normalize(P.sub(Gt)))).toVar();
    const V = normalize(cameraPosition.sub(positionWorld)).toVar();
    const nv = max(dot(N, V), 0.0).toVar();
    const col = vec3(0.0).toVar();
    const ccol = vec3(0.0).toVar();
    for (const [L, C] of [[sunDir0, sunCol0], [sunDir1, sunCol1]]) {
      const mu = dot(Ng, L).toVar();
      const sunC = C.mul(mix(mix(u.uSunset, vec3(1.0), 0.45), vec3(1.0), smoothstep(-0.02, 0.2, mu))).toVar();
      const lit = smoothstep(-0.05, 0.12, mu);
      const ndl = max(dot(N, L), 0.0);
      const H = normalize(L.add(V).add(Ng.mul(1e-4)));
      const nh = max(dot(N, H), 0.0).toVar();
      const spec = pow(nh, 900.0).mul(3.0).add(pow(nh, 90.0).mul(0.25)).add(pow(nh, 12.0).mul(0.015)).mul(float(0.04).add(float(0.96).mul(pow(float(1.0).sub(nv), 5.0))).add(0.3));
      col.addAssign(sunC.mul(lit).mul(float(1.0).sub(s.shade)).mul(s.alb.mul(ndl).add(s.wet.mul(spec))));
      ccol.addAssign(sunC.mul(smoothstep(-0.15, 0.45, mu)).mul(float(0.4).add(float(0.6).mul(smoothstep(-0.05, 0.7, mu)))));
    }
    col.addAssign(s.alb.mul(0.018));
    col.assign(mix(col, u.uCloudCol.mul(ccol.mul(float(0.62).add(float(0.38).mul(thick))).add(0.012)), s.cloud));
    col.addAssign(s.emit.mul(float(1.0).sub(s.cloud.mul(0.75))));
    if (march) {
      const ro = cameraPosition.sub(u.uCenter).div(u.uR).toVar();
      const rd = positionWorld.sub(u.uCenter).div(u.uR).sub(ro).toVar();
      const tm = length(rd).toVar();
      const sc = march(ro, rd.div(tm), tm).toVar();
      // (the ground right under you stays clear: the haze is for the distance)
      const near = mix(0.35, 1.0, smoothstep(0.0, 0.25, tm)).toVar();
      col.assign(col.mul(mix(1.0, sc.w, near)).add(sc.xyz.mul(near)));
    }
    return col;
  }, 'vec3')();
}

// ── Scarif’s shield (../bodyShield.js): a faint blue shell of hexagons,
// brighter edge-on, and a ship’s bump into it (uHit: 1 as it lands, dying
// away; uHitAt: where, on the unit sphere, object space) ──
const hash12 = Fn(
  ([p]) => {
    const p3 = fract(vec3(p.xyx).mul(0.1031)).toVar();
    p3.addAssign(dot(p3, p3.yzx.add(33.33)));
    return fract(p3.x.add(p3.y).mul(p3.z));
  },
  { p: 'vec2', return: 'float' },
);
// (GLSL’s mod: floored, whatever the backend’s % does)
const fmod = (a, b) => a.sub(b.mul(floor(a.div(b))));

export function shieldFrag(u) {
  const vN = varying(modelWorldMatrix.mul(vec4(normalize(positionLocal), 0.0)).xyz);
  return Fn(() => {
    const P = normalize(positionLocal).toVar();
    const a = abs(P).toVar();
    const uv = select(a.x.greaterThan(a.y).and(a.x.greaterThan(a.z)), P.yz.div(a.x), select(a.y.greaterThan(a.z), P.xz.div(a.y), P.xy.div(a.z))).toVar();
    const q = uv.mul(9.0).toVar();
    const r = vec2(1.0, 1.7320508);
    const hr = r.mul(0.5);
    const ga = fmod(q, r).sub(hr).toVar();
    const gb = fmod(q.sub(hr), r).sub(hr).toVar();
    const gv = select(dot(ga, ga).lessThan(dot(gb, gb)), ga, gb).toVar();
    const id = q.sub(gv).toVar();
    const ap = abs(gv).toVar();
    const hd = max(dot(ap, normalize(r)), ap.x);
    const y = float(0.5).sub(hd).toVar();
    const w = fwidth(y).mul(1.5).toVar();
    const edge = float(1.0).sub(smoothstep(0.0, w.add(0.035), y)).mul(float(0.035).div(w.add(0.035))).toVar();
    const hcell = hash12(id.add(floor(P.x.mul(3.0).add(P.y.mul(5.0)).add(P.z.mul(7.0))))).toVar();
    const glint = smoothstep(0.92, 1.0, sin(u.uTime.mul(hcell.add(0.6)).add(hcell.mul(40.0)))).mul(0.6).toVar();
    const V = normalize(cameraPosition.sub(positionWorld));
    const fres = pow(max(float(1.0).sub(abs(dot(normalize(vN), V))), 0), 3.0).toVar(); // (a dot a hair over 1 at the limb: no pow of a negative)
    const shimmer = float(0.75).add(float(0.25).mul(sin(u.uTime.mul(1.7).add(dot(P, vec3(9.0, 13.0, 7.0))))));
    const col = vec3(0.3, 0.6, 1.0).mul(float(0.003).add(edge.mul(glint.add(0.07)).mul(shimmer).mul(fres.add(0.4))).add(fres.mul(0.08)).add(glint.mul(0.03))).mul(u.uShield).toVar();
    // the bump: a flash where the ship hit, the cells round it lit up, and a
    // ring running out from it across the shell as the flash dies
    If(u.uHit.greaterThan(0.001), () => {
      const ang = acos(clamp(dot(P, u.uHitAt), -1.0, 1.0)).toVar();
      const age = float(1.0).sub(u.uHit).toVar();
      const ring = float(1.0).sub(smoothstep(0.0, float(0.05).add(age.mul(0.08)), abs(ang.sub(age.mul(0.9)))));
      const flash = exp(ang.negate().mul(14.0)).mul(u.uHit);
      const cells = exp(ang.negate().mul(5.0)).mul(edge).mul(6.0).mul(u.uHit);
      col.addAssign(vec3(0.55, 0.8, 1.0).mul(flash.mul(1.6).add(ring.mul(u.uHit).mul(0.9)).add(cells)).mul(u.uShield));
    });
    return col;
  }, 'vec3')();
}
