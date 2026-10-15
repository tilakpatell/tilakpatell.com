// The planets’ families of ground (../bodyShaders.js’s DESERT, ICE, LUSH,
// CITY, LAVA, GAS and MOON) on the node renderer: each a surface(P, s, g)
// that fills in the surface’s albedo, relief, water and light of its own,
// written line for line from its GLSL, in the same order of operations (a
// float sum or product regrouped rounds differently, and the noise’s hashes
// turn the least difference into another cell). nodes/bodyShaders.js builds
// the main around them.
//
// What differs on the node renderer: the GLSL’s #ifdef flags (CRATERS,
// SCARS, ISLANDS, RIVERS, SWAMP) are branches taken in JS as the graph is
// built, the colour slots (#define SAND uPal[0]…) are `g.pal.SAND`, the
// globals (gFoot) and helpers (octs, fade) live on `g`, and a smoothstep
// whose edges fall (GLSL’s smoothstep(0.05, -0.3, x)) is `rev`, defined on
// every backend. The craters’ and the scars’ eight cells are unrolled; a
// `continue` is the rest of the cell under an If.
//
//   FAMILY_SURFACES: { desert, ice, lush, city, lava, gas, moon } → (P, s, g) ⇒ void
//   dss(a, b, x), spinY(p, a), whirl(p, c, w, k): the head’s helpers
//   cratersWith(noise) → craters(p, density, depth) → vec4 (height, gradient)

import { Fn, If, abs, clamp, cos, cross, dot, exp, float, floor, fract, length, max, min, mix, normalize, select, sign, sin, smoothstep, step, vec2, vec3, vec4 } from 'three/tsl';
import { rev } from '../surface/nodes/common';

// the slope of smoothstep(a, b, x) at x
export const dss = (a, b, x) => {
  const ba = float(b).sub(a);
  const t = clamp(float(x).sub(a).div(ba), 0.0, 1.0);
  return float(6.0).mul(t).mul(t.oneMinus()).div(ba);
};
// the planet’s frame turned about its own axis by angle a
export const spinY = (p, a) => {
  const c = cos(a);
  const s = sin(a);
  return vec3(c.mul(p.x).sub(s.mul(p.z)), p.y, s.mul(p.x).add(c.mul(p.z)));
};
// a whirl: p turned about the axis c by up to k radians, the most at its eye (radius w)
export const whirl = (p, c, w, k) => {
  const d = float(1.0).sub(dot(p, c));
  const a = float(k).mul(exp(d.negate().div(w)));
  const par = c.mul(dot(p, c));
  const x = p.sub(par);
  return par.add(x.mul(cos(a))).add(cross(c, x).mul(sin(a)));
};
const CELLS = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [k & 1, (k >> 1) & 1, (k >> 2) & 1]);

// craters: the 8 cells round p, a crater in some of them; height and gradient
export const cratersWith = (n) =>
  Fn(
    ([p, density, depth]) => {
      const base = floor(p.sub(0.5)).toVar();
      const acc = vec3(0.0).toVar(); // (the GLSL’s acc.yzw; accH its .x)
      const accH = float(0.0).toVar();
      for (const [x, y, z] of CELLS) {
        const cell = base.add(vec3(x, y, z)).toVar();
        const h = n.hash33(cell).toVar();
        If(h.x.lessThanEqual(density), () => {
          const c = cell.add(0.5).add(h.sub(0.5).mul(0.4));
          const rr = float(0.12).add(float(0.22).mul(h.y).mul(h.y)).toVar();
          const dv = p.sub(c).toVar();
          const dl = length(dv).add(1e-5).toVar();
          const d = dl.div(rr).toVar();
          If(d.lessThanEqual(1.8), () => {
            const inner = d.lessThan(1.0);
            const bowl = select(inner, d.mul(d).sub(1.0), 0.0);
            const dbowl = select(inner, float(2.0).mul(d), 0.0);
            const rim = float(0.35).mul(exp(d.sub(1.0).negate().mul(d.sub(1.0)).mul(14.0))).toVar();
            const drim = float(-28.0).mul(d.sub(1.0)).mul(rim);
            const fall = smoothstep(1.4, 1.8, d).oneMinus().toVar();
            const dep = depth.mul(float(0.6).add(float(0.6).mul(h.z))).toVar();
            accH.addAssign(bowl.add(rim).mul(dep).mul(fall));
            acc.addAssign(dbowl.add(drim).mul(dep).mul(fall).mul(dv).div(dl.mul(rr)));
          });
        });
      }
      return vec4(accH, acc);
    },
    { p: 'vec3', density: 'float', depth: 'float', return: 'vec4' },
  );

// (a crease’s sharpness k: the smoothstep that draws it, and its slope)
const crease = (k, r, a) => smoothstep(float(1.0).sub(k), float(1.0).sub(k.mul(0.25)), r).mul(a);
const creaseD = (k, r) => dss(float(1.0).sub(k), float(1.0).sub(k.mul(0.25)), r);
const thin = (k, r) => smoothstep(float(1.0).sub(k), float(1.0).sub(k.mul(0.3)), r);
const saw = (sp, edge, up, down) => select(sp.lessThan(edge), up, down);

// Deserts (Tatooine, Geonosis, and Mandalore’s glassed crust): sand seas of
// sharp-crested dunes bent by the land, rock country terraced into mesas and
// cut by canyons, salt pans (or glass) in the low ground, craters, scars.
// pal: sand, sand2, rock, dark, salt, crest
// uP0 = (dunes, rock threshold, craters, salt), uP1 = (scars, dune frequency, canyons, mesas)
function desert(P, s, g) {
  const { u, n, pal: C, octs, fade, gFoot, flags } = g;
  const o = octs(2.2).toVar();
  const b = n.fbmd(P.mul(2.2), o, 0.47).toVar();
  const reg = n.fbmd(P.mul(1.3).add(5.3), min(o, 4.0), 0.5).toVar();
  const rocky = smoothstep(-0.07, 0.07, reg.x.add(b.x.mul(0.3)).sub(u.uP0.y)).toVar();
  const sand = float(1.0).sub(rocky).toVar();
  // mesas: the rock country in flat-topped steps with cliffs between
  const x = b.x.mul(3.2).add(3.0).toVar();
  const st = clamp(fract(x).sub(0.55).div(0.3), 0.0, 1.0).toVar();
  const terr = floor(x).add(st.mul(st).mul(float(3.0).sub(float(2.0).mul(st)))).div(3.2).sub(1.0);
  const dst = float(6.0).mul(st).mul(float(1.0).sub(st)).div(0.3);
  const hr = mix(b.x, terr, u.uP1.w);
  const gr = b.yzw.mul(2.2).mul(mix(1.0, dst, u.uP1.w)).toVar();
  // gullies and canyons cut through it (Beggar’s Canyon), two sizes of crease
  const n1 = n.noised2(P.mul(9.0).add(vec3(b.x.mul(0.5))).add(9.1)).toVar();
  const n2 = n.noised2(P.mul(31.0).add(vec3(b.x)).add(2.7)).toVar();
  const k1 = max(0.08, gFoot.mul(9.0).mul(2.5)).toVar();
  const k2 = max(0.08, gFoot.mul(31.0).mul(2.5)).toVar();
  const r1 = float(1.0).sub(abs(n1.x)).toVar();
  const r2 = float(1.0).sub(abs(n2.x)).toVar();
  const a1 = min(1.0, float(0.08).div(k1)).toVar();
  const a2 = min(1.0, float(0.08).div(k2)).mul(0.35).mul(fade(31.0 * 2.0)).toVar();
  const can1 = crease(k1, r1, a1);
  const can2 = crease(k2, r2, a2);
  const cm = u.uP1.z.mul(smoothstep(0.3, 0.8, rocky)).toVar();
  const can = max(can1, can2).mul(cm).toVar();
  const gcan = cm.mul(creaseD(k1, r1).mul(a1).mul(sign(n1.x).negate()).mul(n1.yzw).mul(9.0).add(creaseD(k2, r2).mul(a2).mul(sign(n2.x).negate()).mul(n2.yzw).mul(31.0)));
  // salt pans in the lowest sand
  const salt = u.uP0.w.mul(rev(-0.3, -0.42, b.x.add(reg.x.mul(0.2)))).mul(sand).toVar();
  const h = mix(b.x.mul(0.35), hr, rocky).sub(can.mul(0.5)).toVar();
  const gg = mix(b.yzw.mul(2.2).mul(0.35), gr, rocky).sub(gcan.mul(0.12)).mul(float(1.0).sub(salt.mul(0.9)));
  const G = gg.mul(u.uBump).toVar();
  // dunes: crests across the sand seas, the wind’s way, bent by the land,
  // in fields and chains with flat sand between. Two sets of crests at right
  // angles, each taking over round the other’s poles (where its crests
  // would close into rings)
  const F = u.uP1.y;
  const D2 = normalize(cross(u.uDir, vec3(0.3, 0.1, -0.95))).toVar();
  const wd = smoothstep(0.55, 0.85, abs(dot(P, u.uDir))).toVar();
  const D = normalize(mix(u.uDir, D2, wd)).toVar();
  const bend = float(0.22).mul(reg.x).add(float(0.05).mul(b.x)).toVar();
  const gbend = float(0.22).mul(reg.yzw).mul(1.3).add(float(0.05).mul(b.yzw).mul(2.2)).toVar();
  const phiA = F.mul(dot(P, u.uDir).add(bend)).toVar();
  const phiB = F.mul(dot(P, D2).add(bend)).add(0.37).toVar();
  const spA = fract(phiA).toVar();
  const spB = fract(phiB).toVar();
  const duneA = saw(spA, 0.75, spA.div(0.75), float(1.0).sub(spA).div(0.25));
  const duneB = saw(spB, 0.75, spB.div(0.75), float(1.0).sub(spB).div(0.25));
  const gA = F.mul(u.uDir.add(gbend)).mul(saw(spA, 0.75, float(1.0 / 0.75), float(-1.0 / 0.25)));
  const gB = F.mul(D2.add(gbend)).mul(saw(spB, 0.75, float(1.0 / 0.75), float(-1.0 / 0.25)));
  const dune = mix(duneA, duneB, wd).toVar();
  const gdune = mix(gA, gB, wd);
  const field = n.noise(P.mul(F).mul(0.16).add(3.0)).mul(0.7).add(n.noise(P.mul(F).mul(0.05).add(7.0)).mul(0.5)).toVar();
  const damp = u.uP0.x.mul(sand).mul(float(1.0).sub(salt)).mul(smoothstep(-0.25, 0.25, field.add(0.1))).mul(smoothstep(-0.5, 0.1, reg.x.negate().sub(b.x.mul(0.3)))).toVar();
  const fd = fade(F.mul(3.0)).toVar();
  G.addAssign(gdune.mul(float(0.15).div(F)).mul(damp).mul(fd));
  // and ripples on them, up close
  const phi2 = mix(phiA, phiB, step(0.5, wd)).mul(9.0).add(n.noise(P.mul(300.0)).mul(2.0));
  const sp2 = fract(phi2).toVar();
  G.addAssign(D.mul(F).mul(9.0).mul(saw(sp2, 0.7, float(1.0 / 0.7), float(-1.0 / 0.3))).mul(float(0.04).div(F.mul(9.0))).mul(u.uP0.x).mul(sand).mul(float(1.0).sub(salt)).mul(fade(F.mul(12.0))));
  let c1 = null;
  let c2 = null;
  if (flags.CRATERS) {
    c1 = g.craters(P.mul(6.0), float(0.5).mul(u.uP0.z), 0.05 / 6.0).toVar();
    c2 = g.craters(P.mul(17.0).add(3.0), float(0.45).mul(u.uP0.z), 0.05 / 17.0).mul(fade(17.0 * 3.0)).toVar();
    G.addAssign(c1.yzw.mul(6.0).add(c2.yzw.mul(17.0)));
    h.addAssign(c1.x.add(c2.x).mul(30.0));
  }
  // colour: sand mottled paler and darker; rock in strata, darker down the cliffs and gullies
  const mott = n.fbm(P.mul(8.0).add(2.0), min(octs(8.0), 4.0)).toVar();
  const sandC = mix(C.SAND, C.SAND2, smoothstep(-0.4, 0.45, reg.x.mul(0.9).add(mott.mul(0.7)).add(b.x.mul(0.4)))).toVar();
  sandC.mulAssign(float(1.0).add(dune.sub(0.6).mul(0.3).mul(damp).mul(fd)));
  sandC.assign(mix(sandC, C.CREST, smoothstep(0.1, 0.5, field).mul(damp).mul(0.25)));
  const cliff = u.uP1.w.mul(smoothstep(0.1, 0.6, st.mul(float(1.0).sub(st)).mul(4.0)));
  const rockC = mix(C.ROCK, C.DARK, clamp(cliff.mul(0.5).add(float(0.35).mul(float(0.5).add(float(0.5).mul(sin(h.mul(24.0).add(mott.mul(3.0))))))).sub(0.12), 0.0, 1.0)).toVar();
  rockC.assign(mix(rockC, C.SAND2, smoothstep(0.2, 0.6, mott).mul(0.35)));
  rockC.mulAssign(float(0.88).add(float(0.24).mul(mott)));
  const alb = mix(sandC, rockC, rocky).toVar();
  alb.assign(mix(alb, C.DARK.mul(0.85), can.mul(0.7)));
  alb.assign(mix(alb, C.SALT.mul(float(0.93).add(float(0.1).mul(mott))), salt));
  if (flags.CRATERS) alb.assign(mix(alb, C.DARK, clamp(c1.x.mul(6.0).add(c2.x.mul(17.0)).negate().div(0.05), 0.0, 1.0).mul(0.35)));
  if (flags.SCARS) {
    // where the bombs fell: a long dark gouge ploughed into the ground, a crater at its end
    const sq = P.mul(9.0).toVar();
    const base = floor(sq.sub(0.5)).toVar();
    const scar = float(0.0).toVar();
    for (const [cx, cy, cz] of CELLS) {
      const cell = base.add(vec3(cx, cy, cz)).toVar();
      const hh = n.hash33(cell.add(41.0)).toVar();
      If(hh.x.lessThanEqual(float(0.3).mul(u.uP1.x)), () => {
        const c = cell.add(0.5).add(hh.sub(0.5).mul(0.4));
        const e = normalize(n.hash33(cell.add(77.0)).sub(0.5)).toVar();
        const dv = sq.sub(c).toVar();
        const al = dot(dv, e).toVar();
        const ac = length(dv.sub(e.mul(al)));
        const len = float(0.2).add(float(0.25).mul(hh.y)).toVar();
        const w0 = float(0.012).add(float(0.03).mul(hh.z).mul(clamp(float(1.0).add(al.div(len)), 0.0, 1.0))).toVar();
        const w = max(w0, gFoot.mul(9.0).mul(1.5)).toVar();
        const gouge = float(1.0).sub(smoothstep(w.mul(0.5), w, ac)).mul(smoothstep(len.negate(), len.negate().mul(0.7), al)).mul(step(al, 0.0)).mul(w0.div(w));
        const r0 = float(0.05).add(float(0.04).mul(hh.z)).toVar();
        const rw = max(r0, gFoot.mul(9.0).mul(1.5)).toVar();
        const pit = float(1.0).sub(smoothstep(rw.mul(0.6), rw, length(dv))).mul(r0.div(rw));
        scar.assign(max(scar, max(gouge, pit)));
      });
    }
    alb.assign(mix(alb, C.DARK.mul(0.55), scar.mul(0.9)));
  }
  s.alb.assign(alb);
  s.grad.assign(G);
}

// Ice (Hoth): snow plains, blue glacial ice and crevasses, dark rock ranges.
// pal: snow, ice, rock, deep
// uP0 = (ice, mountains, crevasses, -)
function ice(P, s, g) {
  const { u, n, pal: C, octs, fade, gFoot } = g;
  const o = octs(2.4).toVar();
  const b = n.fbmd(P.mul(2.4), o, 0.48).toVar();
  // mountain ranges: long spines along the crests of a ridged field
  const r1 = n.noised2(P.mul(2.6).add(17.0)).toVar();
  const r2 = n.noised2(P.mul(5.3).add(4.0)).toVar();
  const rv = float(1.0).sub(abs(r1.x)).mul(0.7).add(float(1.0).sub(abs(r2.x)).mul(0.3)).toVar();
  const grv = sign(r1.x).negate().mul(r1.yzw).mul(2.6).mul(0.7).sub(sign(r2.x).mul(r2.yzw).mul(5.3).mul(0.3));
  const zone = smoothstep(-0.15, 0.25, n.noise(P.mul(1.4).add(8.0))).mul(u.uP0.y).toVar();
  const spine = smoothstep(0.7, 0.95, rv).mul(zone).toVar();
  const mtn = zone.mul(smoothstep(0.55, 0.9, rv)).toVar();
  // (the GLSL’s h, never read after, is left out)
  const G = b.yzw.mul(2.4).mul(0.35).add(grv.mul(dss(0.7, 0.95, rv)).mul(zone).mul(0.9)).mul(u.uBump).toVar();
  const rock = smoothstep(0.3, 0.55, spine).mul(float(0.55).add(float(0.45).mul(smoothstep(-0.2, 0.25, b.x)))).toVar();
  G.addAssign(b.yzw.mul(2.4).mul(spine).mul(1.8).mul(u.uBump));
  // glaciers in the low ground, streaming along the wind
  const sq = P.mul(6.0).sub(u.uDir.mul(dot(P, u.uDir)).mul(4.5));
  const flow = n.fbm(sq.add(4.0), min(octs(6.0), 5.0)).toVar();
  const ic = u.uP0.x.mul(rev(0.05, -0.3, b.x.add(flow.mul(0.35)))).mul(float(1.0).sub(rock)).toVar();
  // crevasses: thin dark-blue cracks across the ice and the snow round the ranges
  const cv = n.noised2(P.mul(38.0).add(vec3(flow.mul(2.0)))).toVar();
  const kc = max(0.04, gFoot.mul(38.0).mul(2.5)).toVar();
  const crev = thin(kc, float(1.0).sub(abs(cv.x))).mul(min(1.0, float(0.04).div(kc))).mul(u.uP0.z).mul(clamp(ic.mul(1.5).add(mtn.mul(0.6)), 0.0, 1.0)).toVar();
  const cv2 = n.noised(P.mul(160.0).add(3.0)).toVar();
  crev.assign(max(crev, smoothstep(0.96, 0.99, float(1.0).sub(abs(cv2.x))).mul(fade(160.0 * 3.0)).mul(u.uP0.z).mul(clamp(ic.mul(1.5).add(mtn), 0.0, 1.0))));
  // sastrugi: wind ripples in the snow, up close
  const sp = fract(dot(P, u.uDir).mul(420.0).add(flow.mul(6.0))).toVar();
  G.addAssign(u.uDir.mul(saw(sp, 0.75, float(1.0 / 0.75), float(-1.0 / 0.25))).mul(0.012).mul(fade(420.0 * 1.5)).mul(float(1.0).sub(rock)));
  // drifts: the snow heaped and scoured, close up
  const dr = n.noised2(P.mul(120.0).sub(u.uDir.mul(dot(P, u.uDir)).mul(80.0)).add(3.0)).toVar();
  G.addAssign(dr.yzw.mul(120.0).mul(0.0007).mul(fade(120.0)).mul(float(1.0).sub(rock)));
  const sparkle = n.noise(P.mul(700.0)).mul(fade(700.0));
  const snow = mix(C.SNOW.mul(float(0.93).add(float(0.07).mul(flow)).add(float(0.04).mul(sparkle))), C.ICE, smoothstep(0.1, 0.7, dr.x.negate()).mul(0.3).mul(fade(120.0)));
  const alb = mix(snow, C.ICE, ic.mul(float(0.65).add(float(0.35).mul(smoothstep(-0.3, 0.3, flow))))).toVar();
  alb.assign(mix(alb, mix(C.ICE, C.DEEP, 0.3), smoothstep(0.1, 0.5, flow).mul(ic).mul(0.5)));
  const rockC = mix(C.ROCK, C.ROCK.mul(1.5), smoothstep(-0.3, 0.5, flow));
  // snow lies on the ledges, the rock shows on the steep faces
  const steep = smoothstep(0.08, 0.25, length(G.sub(P.mul(dot(G, P)))));
  alb.assign(mix(alb, rockC, rock.mul(mix(0.6, 1.0, steep))));
  alb.assign(mix(alb, mix(C.SNOW, C.ROCK, 0.25), mtn.mul(float(1.0).sub(rock)).mul(0.5)));
  alb.assign(mix(alb, C.DEEP, crev.mul(0.85)));
  s.alb.assign(alb);
  s.grad.assign(G);
}

// Living worlds (Endor, Yavin 4, Kashyyyk, Dagobah, Naboo, Scarif, Kamino,
// Lothal, Sorgan): oceans deep and shallow, coasts bent by a warp, forest and
// grassland by how wet it is, mountains, snow, polar caps; Scarif’s island
// chains, Dagobah’s pools and Sorgan’s ponds, Yavin’s and Lothal’s rivers.
// pal: deep, shallow, forest, grass, rock, snow, beach, murk
// uP0 = (sea level, forest, mountains, polar caps), uP1 = (island chains, swamp, rivers, scale)
function lush(P, s, g) {
  const { u, n, pal: C, octs, fade, gFoot, flags } = g;
  const F = u.uP1.w;
  const o = octs(F).toVar();
  const wq = P.mul(F).mul(0.45).toVar();
  const warp = vec3(n.noise(wq.add(1.7)), n.noise(wq.add(9.2)), n.noise(wq.add(4.4))).mul(0.4).toVar();
  const b = n.fbmd(P.mul(F).add(warp), o, 0.5).toVar();
  const h = b.x.toVar();
  const gr = b.yzw.mul(F).toVar();
  if (flags.ISLANDS) {
    // chains of islands strung along the crests of a ridged field
    const ch = n.noised2(P.mul(3.2).add(3.3).add(warp.mul(1.4))).toVar();
    const chain = float(1.0).sub(abs(ch.x)).toVar();
    const bead = n.noised2(P.mul(16.0).add(warp.mul(2.0)).add(1.0)).toVar();
    h.assign(h.mul(0.45).add(u.uP1.x.mul(chain.mul(chain).sub(0.55).mul(0.9).add(float(0.3).mul(bead.x).mul(chain)))));
    gr.assign(gr.mul(0.45).add(u.uP1.x.mul(float(0.9 * 2.0).mul(chain).mul(sign(ch.x).negate()).mul(ch.yzw).mul(3.2).add(float(0.3).mul(chain).mul(bead.yzw).mul(16.0)))));
  }
  const sea = u.uP0.x;
  const depth = sea.sub(h).toVar();
  const cw = max(0.006, gFoot.mul(length(gr)).mul(1.2)).toVar();
  const land = smoothstep(cw.negate(), cw, depth.negate()).toVar();
  const alt = max(depth.negate(), 0.0).toVar();
  const moist = n.fbm(P.mul(3.7).add(11.0), min(o, 4.0)).toVar();
  const detail = n.fbm(P.mul(40.0).add(2.0), min(octs(40.0), 4.0)).toVar();
  // the land: forest where it’s wet, grass or savanna where it isn’t
  const landC = mix(C.GRASS, C.FOREST, smoothstep(-0.2, 0.2, moist.add(u.uP0.y).sub(0.5).add(detail.mul(0.15)))).toVar();
  landC.mulAssign(float(0.88).add(float(0.24).mul(detail)));
  // seen from orbit, a forest isn’t one green: deep stands darker and
  // bluer, clearings and ridges lighter, in patches bigger than the detail
  // above and smaller than the continents
  const mott = n.fbm(P.mul(F).mul(3.0).add(warp.mul(2.0)).add(3.0), min(octs(F.mul(3.0)), 5.0)).toVar();
  const mott2 = n.noise(P.mul(F).mul(14.0).add(7.0)).toVar();
  const leafy = smoothstep(0.15, 0.6, u.uP0.y.add(moist.mul(0.3))).toVar();
  const stand = smoothstep(-0.2, 0.35, mott.add(moist.mul(0.3)).add(mott2.mul(0.15))).mul(leafy);
  const clearing = smoothstep(0.1, 0.5, mott.negate().sub(mott2.mul(0.2))).mul(leafy);
  landC.assign(mix(landC, landC.mul(vec3(0.55, 0.7, 0.62)), stand.mul(0.75)));
  landC.assign(mix(landC, landC.mul(vec3(1.3, 1.25, 0.9)), clearing.mul(0.55)));
  const canopy = n.noise(P.mul(1100.0)).mul(fade(1100.0));
  landC.mulAssign(float(1.0).add(canopy.mul(0.18)));
  const rockK = smoothstep(0.16, 0.34, alt.mul(u.uP0.z).add(detail.mul(0.04)));
  landC.assign(mix(landC, C.ROCK.mul(float(0.85).add(float(0.3).mul(detail))), rockK));
  landC.assign(mix(landC, C.SNOW, smoothstep(0.4, 0.5, alt.mul(u.uP0.z).add(detail.mul(0.05)))));
  landC.assign(mix(C.BEACH, landC, smoothstep(0.0, 0.025, alt)));
  const G = gr.mul(u.uBump).mul(float(0.15).add(float(0.85).mul(smoothstep(0.0, 0.1, alt)))).mul(land).toVar();
  const wet = float(1.0).sub(land).toVar();
  if (flags.RIVERS) {
    // rivers winding to the sea through the lowlands
    const rv = n.noised2(P.mul(7.0).add(warp.mul(2.0)).add(21.0)).toVar();
    const kr = max(0.025, gFoot.mul(7.0).mul(2.5)).toVar();
    const river = thin(kr, float(1.0).sub(abs(rv.x))).mul(min(1.0, float(0.025).div(kr))).mul(land).mul(float(1.0).sub(smoothstep(0.1, 0.3, alt))).mul(u.uP1.z).toVar();
    landC.assign(mix(landC, C.SHALLOW.mul(0.7), river));
    wet.assign(max(wet, river));
  }
  if (flags.SWAMP) {
    // Dagobah, Sorgan: the low ground all pools and channels of murky water
    const pz = n.noise(P.mul(30.0).add(warp.mul(3.0))).mul(0.6).add(n.noise(P.mul(110.0)).mul(0.4).mul(fade(110.0)));
    const pool = smoothstep(0.05, 0.2, pz).mul(float(1.0).sub(smoothstep(0.05, 0.25, alt))).mul(u.uP1.y).mul(land).toVar();
    landC.assign(mix(landC, C.MURK, pool));
    wet.assign(max(wet, pool.mul(0.6)));
    G.mulAssign(float(1.0).sub(pool));
  }
  // the sea: shallow over the shelves, deep beyond
  const shelf = float(0.06).add(float(0.25).mul(u.uP1.x)).toVar();
  const seaC = mix(C.SHALLOW, C.DEEP, smoothstep(0.0, shelf, depth)).toVar();
  seaC.assign(mix(seaC, C.DEEP.mul(0.8), smoothstep(shelf, shelf.mul(4.0), depth).mul(0.6)));
  // waves, up close
  const wv = n.noised(P.mul(700.0).add(vec3(u.uTime.mul(0.6), 0.0, u.uTime.mul(0.4)))).toVar();
  const sw = n.noised(P.mul(90.0).add(vec3(0.0, u.uTime.mul(0.05), u.uTime.mul(0.04)))).toVar();
  G.addAssign(wv.yzw.mul(700.0).mul(0.000012).mul(fade(700.0)).add(sw.yzw.mul(90.0).mul(0.00012).mul(fade(90.0))).mul(float(1.0).sub(land)));
  const alb = mix(seaC, landC, land).toVar();
  // polar caps over land and sea alike
  const cap = smoothstep(float(1.0).sub(u.uP0.w).sub(0.02), float(1.0).sub(u.uP0.w).add(0.02), abs(P.y).add(moist.mul(0.06)).add(detail.mul(0.02))).mul(step(0.001, u.uP0.w)).toVar();
  alb.assign(mix(alb, C.SNOW, cap));
  wet.mulAssign(float(1.0).sub(cap));
  s.alb.assign(alb);
  s.grad.assign(G);
  s.wet.assign(wet);
}

// The city that covers a world (Coruscant): blocks, streets and avenues on a
// grid (laid on a cube’s faces, so it’s square everywhere), districts darker
// and lighter, plazas; at night the streets a web of light.
// pal: steel, brown, dark, plaza, warm, white
// uP0 = (lights, -, districts, plazas)
// blocks of frequency f raised between streets (street: their width, of a
// cell): b.x the height 0..1, b.yz its gradient in uv; id: the block’s hash
function blocks(n, uv, f, street, seed) {
  const q = uv.mul(f).toVar();
  const e = fract(q).sub(0.5).toVar();
  const id = n.hash13(vec3(floor(q), seed)).toVar();
  const ae = abs(e).toVar();
  const d = float(0.5).sub(max(ae.x, ae.y)).toVar();
  const tall = float(0.25).add(float(0.75).mul(id).mul(id)).toVar();
  const hgt = smoothstep(0.0, street, d).mul(tall);
  const gd = select(ae.x.greaterThan(ae.y), vec2(sign(e.x).negate(), 0.0), vec2(0.0, sign(e.y).negate()));
  return { b: vec3(hgt, gd.mul(dss(0.0, street, d)).mul(tall).mul(f)).toVar(), id };
}
// a grid’s lines: 1 on a street, 0 on a block; their average when too fine to draw
const streets = (gFoot, b, f, street) => {
  const line = float(1.0).sub(smoothstep(0.0, 0.5, b.x.div(0.25 + 0.75 * 0.5)));
  return mix(line, 2.0 * street, smoothstep(0.25, 0.9, gFoot.mul(f).mul(1.5))).toVar();
};
function city(P, s, g) {
  const { u, n, pal: C, octs, fade, gFoot, gNight } = g;
  // the grid’s laid on a cube’s faces: which face, its uv, which way u and v run
  const a = abs(P).toVar();
  const onX = a.x.greaterThan(a.y).and(a.x.greaterThan(a.z));
  const onY = a.y.greaterThan(a.z);
  const uv = select(onX, P.yz.div(a.x), select(onY, P.xz.div(a.y), P.xy.div(a.z))).toVar();
  const U = select(onX, vec3(0.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0)).toVar();
  const V = select(onX, vec3(0.0, 0.0, 1.0), select(onY, vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 0.0))).toVar();
  const k = select(onX, a.x, select(onY, a.y, a.z)).toVar();
  const face = select(onX, sign(P.x), select(onY, float(3.0).add(sign(P.y)), float(6.0).add(sign(P.z)))).toVar();
  const o = octs(3.0);
  const dist = n.fbm(P.mul(3.0).add(7.0), min(o, 5.0)).toVar();
  const dist2 = n.fbm(P.mul(11.0).add(1.0), min(octs(11.0), 4.0)).toVar();
  // districts between the avenues, blocks between the streets, towers on the blocks
  const B1 = blocks(n, uv, 9.0, 0.04, face);
  const B2 = blocks(n, uv, 70.0, 0.1, face.add(10.0));
  const B3 = blocks(n, uv, 480.0, 0.16, face.add(20.0));
  const B4 = blocks(n, uv, 2600.0, 0.22, face.add(30.0));
  const [i2, i3, i4] = [B2.id, B3.id, B4.id];
  const f2 = fade(70.0 * 1.4).toVar();
  const f3 = fade(480.0 * 1.4).toVar();
  const f4 = fade(2600.0 * 1.4).toVar();
  const av = streets(gFoot, B1.b, 9.0, 0.04);
  const st = streets(gFoot, B2.b, 70.0, 0.1);
  const bl = streets(gFoot, B3.b, 480.0, 0.16);
  const gu = B2.b.yz.mul(0.0016).mul(f2).add(B3.b.yz.mul(0.0005).mul(f3)).add(B4.b.yz.mul(0.00008).mul(f4)).toVar();
  const G = gu.x.mul(U).add(gu.y.mul(V)).div(k);
  // by day: steel and brown, districts darker and lighter, each block and tower its own tone
  const alb = mix(C.STEEL, C.BROWN, smoothstep(-0.3, 0.3, dist2.add(i2.sub(0.5).mul(0.5).mul(f2)))).toVar();
  alb.mulAssign(float(0.85).add(float(0.3).mul(mix(0.5, i2, f2))));
  alb.mulAssign(float(0.8).add(float(0.4).mul(mix(0.5, i3, f3))));
  alb.mulAssign(float(0.9).add(float(0.2).mul(mix(0.5, i4, f4))));
  alb.assign(mix(alb, C.DARK, smoothstep(0.05, 0.35, dist).mul(u.uP0.z).mul(0.75)));
  const plaza = step(i3, float(0.02).mul(u.uP0.w)).mul(step(0.5, i2)).mul(f3).toVar();
  alb.assign(mix(alb, C.PLAZA, plaza.mul(0.7)));
  alb.mulAssign(float(1.0).sub(av.mul(0.3)).sub(st.mul(0.25)).sub(bl.mul(0.2)));
  // by night: avenues and streets lit, windows in the towers, districts brighter and dimmer
  const dens = smoothstep(-0.25, 0.35, dist.negate().add(dist2.mul(0.7))).toVar();
  dens.assign(dens.mul(dens).mul(float(0.3).add(float(0.7).mul(smoothstep(-0.3, 0.3, n.noise(P.mul(24.0).add(3.0)))))));
  const twinkle = float(0.75).add(float(0.25).mul(sin(u.uTime.mul(float(1.0).add(i4.mul(3.0))).add(i4.mul(40.0)))));
  const artery = av.mul(smoothstep(-0.2, 0.4, n.noise(P.mul(40.0).add(9.0)))).mul(1.3);
  const lights = artery.add(st.mul(1.0).mul(mix(0.6, step(0.25, i2), f2))).add(bl.mul(0.6).mul(mix(0.5, step(0.35, i3), f3))).toVar();
  lights.addAssign(mix(0.12, step(0.72, i4).mul(1.4).mul(twinkle), f4).mul(float(1.0).sub(bl)));
  lights.addAssign(plaza.mul(1.2));
  const lc = mix(C.WARM, C.WHITE, smoothstep(0.2, 0.9, i2.mul(0.6).add(dist2).add(0.25)));
  s.emit.assign(lc.mul(lights).mul(dens).mul(gNight).mul(u.uP0.x));
  s.alb.assign(alb);
  s.grad.assign(G);
  s.wet.assign(plaza.mul(0.15));
}

// Volcanic (Mustafar, Nevarro): black crust, rivers and lakes of lava
// glowing through it, the crust beside them lit red.
// pal: crust, ash, hot, lava, ember
// uP0 = (rivers, lakes, glow, pulse)
function lava(P, s, g) {
  const { u, n, pal: C, octs, fade, gFoot } = g;
  const o = octs(2.6);
  const b = n.fbmd(P.mul(2.6), o, 0.5).toVar();
  const rough = n.noised(P.mul(260.0).add(5.0)).toVar();
  const G = b.yzw.mul(2.6).mul(u.uBump).add(rough.yzw.mul(260.0).mul(0.00004).mul(fade(260.0))).toVar();
  const r1 = n.noised2(P.mul(4.0).add(vec3(b.x.mul(0.7)))).toVar();
  const r2 = n.noised2(P.mul(13.0).add(vec3(b.x.mul(1.3))).add(5.0)).toVar();
  const k1 = max(0.03, gFoot.mul(4.0).mul(3.0)).toVar();
  const k2 = max(0.025, gFoot.mul(13.0).mul(3.0)).toVar();
  const v1 = float(1.0).sub(abs(r1.x)).toVar();
  const v2 = float(1.0).sub(abs(r2.x)).toVar();
  const riv = thin(k1, v1).mul(min(1.0, float(0.03).div(k1))).toVar();
  riv.assign(max(riv, thin(k2, v2).mul(min(1.0, float(0.025).div(k2))).mul(smoothstep(0.6, 0.9, v1.add(b.x.mul(0.3)))).mul(0.9)));
  riv.mulAssign(u.uP0.x);
  const lake = rev(-0.44, -0.5, b.x).mul(u.uP0.y);
  // and cracks in the crust glowing through, seen close
  const r3 = n.noised2(P.mul(70.0).add(vec3(b.x.mul(2.0))).add(11.0)).toVar();
  const k3 = max(0.04, gFoot.mul(70.0).mul(3.0)).toVar();
  const crack = thin(k3, float(1.0).sub(abs(r3.x))).mul(min(1.0, float(0.04).div(k3))).mul(smoothstep(0.55, 0.9, v1.add(b.x.mul(0.2)))).mul(0.8);
  const lv = max(max(riv, lake), crack.mul(u.uP0.x)).toVar();
  // the lava’s skin: crusted rafts drifting on it
  const skin = n.noise(P.mul(60.0).add(vec3(u.uTime.mul(0.03), 0.0, u.uTime.mul(0.02)))).mul(0.5).add(n.noise(P.mul(220.0).sub(vec3(u.uTime.mul(0.05)))).mul(0.5).mul(fade(220.0)));
  const core = smoothstep(0.0, 0.7, lv).mul(float(0.75).add(float(0.25).mul(skin))).toVar();
  const pulse = float(1.0).add(u.uP0.w.mul(0.25).mul(sin(u.uTime.mul(1.3).add(n.noise(P.mul(5.0)).mul(6.0))))).toVar();
  const crust = mix(C.CRUST, C.ASH, smoothstep(-0.2, 0.5, n.fbm(P.mul(18.0).add(4.0), min(octs(18.0), 5.0)).add(b.x.mul(0.3)))).toVar();
  const near = smoothstep(0.7, 0.96, v1).mul(u.uP0.x).add(rev(-0.18, -0.3, b.x).mul(u.uP0.y)).toVar();
  crust.assign(mix(crust, C.EMBER.mul(0.4), clamp(near, 0.0, 1.0).mul(0.28)));
  s.alb.assign(mix(crust, C.EMBER.mul(0.3), lv));
  s.emit.assign(mix(C.LAVA, C.HOT, core.mul(core)).mul(lv).mul(float(1.9).add(float(1.2).mul(core))).mul(pulse).mul(u.uP0.z));
  s.emit.addAssign(C.EMBER.mul(clamp(near, 0.0, 1.0)).mul(0.1).mul(pulse).mul(u.uP0.z));
  s.grad.assign(G.mul(float(1.0).sub(lv)));
}

// Gas giants (Yavin, Endor’s giant, Bespin): bands at their own speeds,
// turbulent where they meet, a great storm.
// pal: a, b, c, d, e (the bands), storm
// uP0 = (bands, turbulence, flow, fine), uP1 = (storm size, storm latitude, storm longitude, -)
// (the GLSL’s uPal[int(v)]: v is 0…4, so its band and the next by v’s steps)
const bandCol = (pal, x) => {
  const v = clamp(float(0.5).add(float(0.26).mul(sin(x))).add(float(0.16).mul(sin(x.mul(2.31).add(1.7)))).add(float(0.08).mul(sin(x.mul(5.13).add(0.3)))), 0.0, 0.999).mul(4.0).toVar();
  const t = smoothstep(0.15, 0.85, fract(v));
  const at = (i) => select(v.lessThan(1.0), pal[i], select(v.lessThan(2.0), pal[i + 1], select(v.lessThan(3.0), pal[i + 2], pal[i + 3])));
  return mix(at(0), at(1), t);
};
function gas(P, s, g) {
  const { u, n, pal: C, octs, fade } = g;
  const lat = P.y;
  const q = spinY(P, u.uTime.mul(u.uP0.z).mul(float(0.6).add(float(0.4).mul(sin(lat.mul(9.0)))))).toVar();
  const sl = u.uP1.y;
  const S = vec3(cos(sl).mul(cos(u.uP1.z)), sin(sl), cos(sl).mul(sin(u.uP1.z))).toVar();
  const storm = float(0.0).toVar();
  If(u.uP1.x.greaterThan(0.0), () => {
    q.assign(whirl(q, S, u.uP1.x, 5.0));
    storm.assign(exp(float(1.0).sub(dot(normalize(q), S)).negate().div(u.uP1.x.mul(0.5))));
  });
  const o = octs(4.0).toVar();
  const sq = q.mul(vec3(2.0, 10.0, 2.0)).toVar();
  const w = vec3(n.noise(sq.add(4.0)), n.noise(sq.add(8.0)), n.noise(sq.mul(1.3).add(2.0))).toVar();
  const turb = n.fbm(q.mul(vec3(3.0, 12.0, 3.0)).add(w.mul(0.9)), min(o, 6.0));
  const x = q.y.mul(u.uP0.x).add(turb.mul(u.uP0.y));
  const alb = bandCol(g.palList, x).toVar();
  const fine = n.fbmd(q.mul(vec3(9.0, 30.0, 9.0)).add(w.mul(1.5)), max(o.sub(1.5), 1.0), 0.5).toVar();
  alb.mulAssign(float(1.0).add(fine.x.mul(0.18).mul(u.uP0.w)));
  // close to, the cloud tops billow
  const puff = n.fbmd(q.mul(45.0).add(w.mul(3.0)).add(vec3(0.0, u.uTime.mul(0.01), 0.0)), clamp(octs(45.0), 1.0, u.uMaxOct.sub(3.0)), 0.42).toVar();
  const fp = fade(45.0).toVar();
  alb.mulAssign(float(1.0).add(puff.x.mul(0.3).mul(fp)));
  alb.assign(mix(alb, C.STORM, smoothstep(0.35, 0.9, storm).mul(float(0.75).add(float(0.25).mul(fine.x)))));
  alb.assign(mix(alb, alb.mul(0.75), smoothstep(0.2, 0.4, storm).mul(float(1.0).sub(smoothstep(0.4, 0.6, storm)))));
  s.alb.assign(alb);
  s.grad.assign(fine.yzw.mul(vec3(9.0, 30.0, 9.0)).mul(u.uBump).add(puff.yzw.mul(45.0).mul(0.004).mul(fp)));
}

// Moons: grey, ice, dust, rust; craters on craters, darker seas, cracks in the ice.
// pal: base, dark, bright, crack
// uP0 = (craters, maria, cracks, -)
function moon(P, s, g) {
  const { u, n, pal: C, octs, fade, gFoot } = g;
  const o = octs(2.0).toVar();
  const b = n.fbmd(P.mul(2.0), o, 0.5).toVar();
  const G = b.yzw.mul(2.0).mul(u.uBump).toVar();
  const d = u.uP0.x;
  const c1 = g.craters(P.mul(3.0), float(0.7).mul(d), 0.06 / 3.0).toVar();
  const c2 = g.craters(P.mul(9.0).add(1.0), float(0.6).mul(d), 0.05 / 9.0).mul(fade(9.0 * 2.5)).toVar();
  const c3 = g.craters(P.mul(27.0).add(2.0), float(0.5).mul(d), 0.05 / 27.0).mul(fade(27.0 * 2.5)).toVar();
  const c4 = g.craters(P.mul(80.0).add(3.0), float(0.5).mul(d), 0.05 / 80.0).mul(fade(80.0 * 2.5)).toVar();
  G.addAssign(c1.yzw.mul(3.0).add(c2.yzw.mul(9.0)).add(c3.yzw.mul(27.0)).add(c4.yzw.mul(80.0)));
  const cr = c1.x.div(0.02).add(c2.x.div(0.05 / 9.0).mul(0.6)).add(c3.x.div(0.05 / 27.0).mul(0.4)).toVar();
  const mar = rev(0.05, -0.25, n.fbm(P.mul(1.6).add(3.0), min(o, 4.0))).mul(u.uP0.y);
  const mott = n.fbm(P.mul(12.0), min(octs(12.0), 4.0));
  const alb = mix(C.BASE, C.DARK, mar).mul(float(0.9).add(float(0.2).mul(mott))).toVar();
  alb.assign(mix(alb, C.BRIGHT, clamp(cr, 0.0, 1.0).mul(0.35)));
  alb.mulAssign(float(1.0).sub(clamp(cr.negate(), 0.0, 1.0).mul(0.15)));
  const ck = n.noised2(P.mul(5.0).add(2.0)).toVar();
  const kk = max(0.018, gFoot.mul(5.0).mul(2.5)).toVar();
  const crack = thin(kk, float(1.0).sub(abs(ck.x))).mul(min(1.0, float(0.018).div(kk))).toVar();
  const ck2 = n.noised2(P.mul(17.0).add(7.0)).toVar();
  const kk2 = max(0.02, gFoot.mul(17.0).mul(2.5)).toVar();
  crack.assign(max(crack, thin(kk2, float(1.0).sub(abs(ck2.x))).mul(min(1.0, float(0.02).div(kk2))).mul(0.8)));
  alb.assign(mix(alb, C.CRACK, crack.mul(u.uP0.z)));
  s.alb.assign(alb);
  s.grad.assign(G);
}

export const FAMILY_SURFACES = { desert, ice, lush, city, lava, gas, moon };
