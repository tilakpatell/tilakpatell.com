// ../../../towns/lorien/propsShaders.js on the node renderer: Lothlórien’s
// waters and the leaves’ glow, the same names and arguments, their GLSL
// line for line in TSL. A material keeps its uniforms on
// `material.uniforms` under the GLSL’s names (uniform nodes, so a `.value`
// write still lands); what it shares with the kit (the waters’ clock, the
// night) is a uniform node that reads the kit’s { value } every render, so
// the kit’s tick and setNight go on writing it as before. glowByColour
// returns the node material for the classic one it was given (hookNodes’
// asNode), and ./props.js uses what it returns.
//
// What runs differently, and why:
// - Each falling smoothstep is a rising one turned over, a `pow` of
//   something that may be negative a product, the Mirror’s choice of
//   vision a select over all three (each worked out first, so the Shire’s
//   painting is never sampled in a branch), and the GLSL’s loops unrolled
//   (WGSL’s rules; the counts were constants).
// - The Shire’s vision samples its painting outside a shader function
//   (shireUv, the sample, shireHot): a uniform read from inside a shared
//   function is declared only in the first program it is built into, and
//   the painting is the Mirror’s own.

import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  abs,
  atan,
  cameraPosition,
  clamp,
  cos,
  dot,
  exp,
  float,
  floor,
  fract,
  length,
  materialEmissive,
  max,
  mix,
  modelViewMatrix,
  modelWorldMatrix,
  normalize,
  positionGeometry,
  pow,
  select,
  sin,
  smoothstep,
  step,
  texture,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
  vertexColor,
} from "three/tsl";
import {
  asNode,
  follow,
  keyed,
  wrap,
} from "../../../../../lib/three/hookNodes";

// One uniform node a { value } of the kit’s, so every water reading it
// shares it.
const SHARED = new WeakMap();
const of = (holder) => {
  if (!SHARED.has(holder)) SHARED.set(holder, follow(holder));
  return SHARED.get(holder);
};

// GLSL’s smoothstep(a, b, x) with a > b, the edges put in order
const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();
const sq = (x) => x.mul(x);

// The GLSL’s vertex: the mesh’s own position into view, nothing else moving it.
const rawVertex = (m, tag) =>
  wrap(
    m,
    "setupPositionView",
    () => modelViewMatrix.mul(vec4(positionGeometry, 1)).xyz,
    tag,
  );
const worldOf = () =>
  varying(modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz, "vWorld");

// ── NOISE_GLSL ──

const hash = Fn(([p0]) => {
  const p1 = fract(p0.mul(vec2(123.34, 456.21)));
  const p = p1.add(dot(p1, p1.add(45.32)));
  return fract(p.x.mul(p.y));
}, "float");
const vnoise = Fn(([p]) => {
  const i = floor(p);
  const f0 = fract(p);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3));
  return mix(
    mix(hash(i), hash(i.add(vec2(1, 0))), f.x),
    mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x),
    f.y,
  );
}, "float");
const fbm2 = Fn(([p0]) => {
  let s = float(0);
  let p = p0;
  let a = 0.5;
  for (let i = 0; i < 4; i++) {
    s = s.add(vnoise(p).mul(a));
    p = p.mul(2.03).add(vec2(1.7, 9.2));
    a *= 0.5;
  }
  return s;
}, "float");

// Still water in a basin seen from above, for the fountains: clear and
// green-dark where you look into it, the gold light of the wood on it at
// a glancing angle, rings spreading from where the water falls in; blue
// by night.
export function basinWaterMaterial(uniforms) {
  const u = { uTime: of(uniforms.uTime), uNight: of(uniforms.uNight) };
  const m = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  rawVertex(m, "lorien:basin");
  const vWorld = worldOf();
  const t = u.uTime;
  const night = u.uNight;
  const p = uv().mul(2).sub(1);
  const r = length(p);
  const V = normalize(cameraPosition.sub(vWorld));
  const fres = pow(clamp(V.y, 0, 1).oneMinus(), 2.5);
  const ring = sin(r.mul(30).sub(t.mul(3.2)))
    .mul(0.5)
    .add(0.5);
  const n = vnoise(p.mul(6).add(vec2(t.mul(0.3), t.mul(-0.2))));
  const deep = mix(vec3(0.12, 0.2, 0.17), vec3(0.01, 0.03, 0.07), night);
  const sky = mix(vec3(1.0, 0.9, 0.62), vec3(0.32, 0.46, 0.75), night);
  const col = mix(
    deep,
    sky,
    clamp(
      fres
        .mul(0.65)
        .add(0.12)
        .add(ring.mul(0.12).mul(r.oneMinus()))
        .add(n.sub(0.5).mul(0.12)),
      0,
      1,
    ),
  );
  m.colorNode = col.add(
    vec3(1)
      .mul(smoothstep(0.82, 0.98, ring.mul(n)))
      .mul(0.25)
      .mul(night.mul(0.5).oneMinus()),
  );
  m.opacityNode = fres.mul(0.16).add(0.82);
  m.uniforms = u;
  return m;
}

// A thin sheet of falling water (an open cylinder's side): bright streaks
// sliding down it, more where it breaks at the foot.
export function fallSheetMaterial(uniforms) {
  const u = { uTime: of(uniforms.uTime), uNight: of(uniforms.uNight) };
  const m = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
  rawVertex(m, "lorien:fall");
  const t = u.uTime;
  const night = u.uNight;
  const vUv = uv();
  const s = vnoise(vec2(vUv.x.mul(60), vUv.y.mul(4).add(t.mul(3))))
    .mul(0.6)
    .add(
      vnoise(vec2(vUv.x.mul(140).add(3), vUv.y.mul(9).add(t.mul(4.5)))).mul(
        0.4,
      ),
    );
  const white = smoothstep(0.45, 0.85, s).add(fall(0.25, 0, vUv.y).mul(0.6));
  const a = white
    .mul(0.5)
    .add(0.14)
    .mul(smoothstep(0, 0.06, vUv.y));
  const col0 = mix(vec3(0.72, 0.84, 0.86), vec3(1.0, 0.98, 0.92), white).mul(
    mix(1, 0.45, night),
  );
  m.colorNode = mix(col0, col0.mul(vec3(0.7, 0.85, 1.25)), night);
  m.opacityNode = a;
  m.uniforms = u;
  return m;
}

// ── the Mirror’s visions ──

// the night sky as still water holds it, Earendil bright in the west
const starsOf = Fn(([q, t]) => {
  let col = mix(
    vec3(0.05, 0.09, 0.2),
    vec3(0.008, 0.015, 0.05),
    smoothstep(0, 1.1, length(q)),
  );
  const band = exp(sq(q.y.sub(q.x.mul(0.5)).mul(2.6)).negate()).mul(
    fbm2(q.mul(4)).mul(0.6).add(0.4),
  );
  col = col.add(vec3(0.12, 0.14, 0.24).mul(band).mul(0.6));
  for (let L = 0; L < 2; L++) {
    const g = q.mul(L === 0 ? 14 : 30);
    const id = floor(g);
    const f = fract(g).sub(0.5);
    const h = hash(id.add(L * 17));
    const off = vec2(hash(id.add(3.1)), hash(id.add(7.7))).sub(0.5);
    const d = length(f.sub(off.mul(0.6)));
    const tw = sin(t.mul(h.mul(3).add(1)).add(h.mul(40)))
      .mul(0.35)
      .add(0.65);
    const s = fall(L === 0 ? 0.09 : 0.06, 0, d)
      .mul(step(L === 0 ? 0.7 : 0.8, h))
      .mul(tw);
    col = col.add(
      vec3(0.85, 0.9, 1.0)
        .mul(s)
        .mul(L === 0 ? 2.6 : 1.3),
    );
  }
  const e = length(q.sub(vec2(-0.38, 0.3)));
  return col.add(
    vec3(0.9, 0.97, 1.2).mul(
      fall(0.05, 0, e)
        .mul(4)
        .add(fall(0.3, 0, e).mul(0.35)),
    ),
  );
}, "vec3");

// the lidless Eye: an almond of fire, its iris streaked gold and red
// raying out from a black slit, flames licking out all round it
const eyeOf = Fn(([q, t]) => {
  const rr = length(q);
  const ang = atan(q.y, q.x);
  const halfH = max(sq(abs(q.x).div(0.8)).oneMinus(), 0).mul(0.36);
  const inside = fall(0.015, -0.015, abs(q.y).sub(halfH));
  const edge = abs(abs(q.y).sub(halfH));
  const f1 = fbm2(vec2(ang.mul(2.2).add(3), rr.mul(3).sub(t.mul(1.4))));
  const f2 = fbm2(vec2(ang.mul(5).add(11), rr.mul(7).sub(t.mul(2.4))));
  const reach = f1.mul(0.45).add(0.5).add(f2.mul(0.18));
  const fire = fall(reach, reach.sub(0.4), rr).mul(inside.oneMinus());
  const col = vec3(0.03, 0, 0)
    .add(
      mix(
        vec3(1.1, 0.12, 0.01),
        vec3(2.0, 0.62, 0.08),
        smoothstep(0.2, 0.8, f2),
      )
        .mul(fire)
        .mul(f2.add(0.45)),
    )
    .add(
      vec3(2.2, 0.95, 0.22)
        .mul(fall(0.05, 0, edge))
        .mul(
          sin(t.mul(3).add(ang.mul(5)))
            .mul(0.4)
            .add(0.6),
        ),
    );
  const streak = fbm2(vec2(ang.mul(12), rr.mul(2).sub(t.mul(0.5))));
  const iris0 = mix(
    vec3(1.5, 0.3, 0.03),
    vec3(2.4, 1.4, 0.35),
    fall(0.3, 0, abs(q.x)),
  ).mul(streak.mul(0.9).add(0.45));
  const pw = max(sq(q.y.div(0.38)).oneMinus(), 0).mul(0.055);
  const pupil = fall(pw.add(0.012), pw.sub(0.006), abs(q.x));
  const iris = mix(iris0, vec3(0), pupil).add(
    vec3(2.0, 0.6, 0.1)
      .mul(fall(0.03, 0, abs(abs(q.x).sub(pw))))
      .mul(pupil.oneMinus())
      .mul(step(abs(q.y), 0.36)),
  );
  return mix(col, iris, inside);
}, "vec3");

// the Shire burning: the painting, its fires flickering, its smoke
// drifting (where in the painting, then what the fire does to it)
const shireUv = Fn(([q, t]) => {
  const w = vec2(
    vnoise(q.mul(3).add(vec2(t.mul(0.2), 0))),
    vnoise(q.mul(3).add(vec2(0, t.mul(0.17)))),
  ).sub(0.5);
  const at = q.mul(0.5).add(0.5).add(w.mul(0.012));
  const y = at.y.add(smoothstep(0.55, 1, at.y).mul(w.x).mul(0.02));
  return clamp(vec2(at.x, y), 0, 1);
}, "vec2");
const shireHot = Fn(([c, q, t]) => {
  const hot = smoothstep(0.15, 0.6, c.r.sub(c.b.mul(1.2)));
  return c
    .mul(
      hot
        .mul(
          vnoise(q.mul(9).add(vec2(0, t.mul(-3))))
            .mul(1.4)
            .add(0.8),
        )
        .add(1),
    )
    .mul(1.4);
}, "vec3");

// The Mirror's water: dark and still, a sheen of the wood's light (or the
// night's) across it at a glancing angle, the faintest rings moving on it.
// And what it shows: as uK rises from 0 to 1 a vision swirls up out of its
// depth, from the middle outward: the stars (uKind 0), the Eye (1), or the
// Shire burning (2, a painting in uShire, its fires flickering).
export function mirrorWaterMaterial(uniforms) {
  const u = {
    uTime: of(uniforms.uTime),
    uNight: of(uniforms.uNight),
    uK: of(uniforms.uK),
    uKind: of(uniforms.uKind),
    uShire: texture(uniforms.uShire.value),
  };
  const m = new MeshBasicNodeMaterial({ fog: true });
  rawVertex(m, "lorien:mirror");
  const vWorld = worldOf();
  const t = u.uTime;
  const night = u.uNight;
  const p = uv().mul(2).sub(1);
  const r = length(p);
  const V = normalize(cameraPosition.sub(vWorld));
  const fres = pow(clamp(V.y, 0, 1).oneMinus(), 3);
  // the water itself
  const drift = fbm2(p.mul(2.5).add(vec2(t.mul(0.04), t.mul(-0.03))));
  const ring = sin(r.mul(34).sub(t.mul(1.2)))
    .mul(0.5)
    .add(0.5);
  const deep = mix(vec3(0.05, 0.07, 0.07), vec3(0.008, 0.016, 0.04), night);
  const sheen = mix(vec3(0.92, 0.86, 0.66), vec3(0.42, 0.58, 0.9), night);
  const col0 = mix(
    deep,
    sheen,
    clamp(
      fres
        .mul(0.75)
        .add(0.06)
        .add(drift.sub(0.5).mul(0.15))
        .add(ring.mul(0.025)),
      0,
      1,
    ),
  );
  // the vision swirls up out of the middle
  const k = clamp(u.uK, 0, 1);
  const sw = k.oneMinus().mul(4.5).mul(r.oneMinus());
  const cs = cos(sw);
  const sn = sin(sw);
  // (mat2(cs, -sn, sn, cs) * p, its columns written out)
  const q0 = vec2(
    cs.mul(p.x).add(sn.mul(p.y)),
    cs.mul(p.y).sub(sn.mul(p.x)),
  ).mul(mix(1.9, 1, k));
  const q = q0.add(
    vec2(vnoise(p.mul(3).add(t.mul(0.4))), vnoise(p.mul(3).sub(t.mul(0.37))))
      .sub(0.5)
      .mul(0.05)
      .mul(k.mul(0.6).oneMinus()),
  );
  const shire = shireHot(u.uShire.sample(shireUv(q, t)).rgb, q, t);
  // (each vision held in a variable before the select: called inside its
  // branches, the stars and the Shire drew as the bare water)
  const stars = starsOf(q, t).toVar("stars");
  const eye = eyeOf(q, t).toVar("eye");
  const vis = select(
    u.uKind.lessThan(0.5),
    stars,
    select(u.uKind.lessThan(1.5), eye, shire.toVar("shire")),
  );
  const mk = smoothstep(
    0,
    0.3,
    k
      .mul(1.7)
      .sub(r)
      .sub(
        vnoise(p.mul(4).add(t.mul(0.25)))
          .sub(0.5)
          .mul(0.45),
      ),
  );
  // darker where the water meets the silver
  m.colorNode = mix(col0, vis, mk.mul(k)).mul(
    mix(1, 0.55, smoothstep(0.8, 1, r)),
  );
  m.uniforms = u;
  return m;
}

// ── the kit ──

// Leaves (and the far trees, and the flowers) glow softly in their own
// colours, so a crown is luminous gold rather than lit lumps.
export function glowByColour(m0) {
  const m = asNode(m0);
  // (#ifdef USE_COLOR: the vertex colours are on)
  if (m.vertexColors) m.emissiveNode = materialEmissive.mul(vertexColor().rgb);
  return keyed(m, "lorien-glow");
}
