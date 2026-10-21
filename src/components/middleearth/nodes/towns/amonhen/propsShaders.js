// ../../../towns/amonhen/propsShaders.js on the node renderer: the
// Uruk-hai’s war paint and iron, the falls of Rauros, their foam and mist,
// and the Eye, the GLSL line for line in TSL under the same names and
// arguments.
//
// The falls, the foam and the mist are given one { uTime } holder between
// them (the kit’s `fall`), as the GLSL was; here each holder is one uniform
// node, kept on every material’s `uniforms` under the GLSL’s name, so the
// kit’s one `.value` write still drives all three. The fog uniforms the
// GLSL took are the renderer’s own on a node material (fog: true), and
// the tone map too where the GLSL had the chunk; the Eye had neither.

import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import {
  Fn,
  Loop,
  abs,
  atan,
  attribute,
  clamp,
  cos,
  dot,
  exp,
  float,
  floor,
  fract,
  length,
  materialMetalness,
  materialRoughness,
  max,
  min,
  mix,
  modelViewMatrix,
  modelWorldMatrix,
  positionGeometry,
  pow,
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
import { onColor, wrap } from '../../../../../lib/three/hookNodes';

// one uniform node a { value } holder, so materials that shared a holder
// share a node (a node passed in is kept)
const NODES = new WeakMap();
const nodeOf = (h) => {
  if (h?.isNode) return h;
  if (!NODES.has(h)) NODES.set(h, uniform(h.value));
  return NODES.get(h);
};
// the GLSL’s own uniforms (its `u…`), as nodes; the fog’s are left to three
const nodesOf = (uniforms) =>
  Object.fromEntries(
    Object.entries(uniforms)
      .filter(([k]) => k.startsWith('u'))
      .map(([k, h]) => [k, nodeOf(h)]),
  );
// GLSL’s smoothstep(a, b, x) with a > b: one less the rising one (WGSL
// wants its edges in order)
const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();

// The Uruk-hai’s one material: colour in the vertices; a `metal` attribute
// says how much of each part is black iron (smoother, metallic), and `puv`
// where it falls on the war-paint sheet, whose alpha lays white paint (the
// White Hand) over the colour. Every part of every Uruk shares it.
export function urukMaterial(paint, env) {
  const m = new MeshStandardNodeMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0,
    envMap: env,
    envMapIntensity: 0.6,
  });
  const metal = attribute('metal', 'float');
  const pnt = texture(paint, attribute('puv', 'vec2'));
  m.roughnessNode = mix(materialRoughness, 0.34, metal);
  m.metalnessNode = mix(materialMetalness, 0.8, metal);
  return onColor(m, (c) => mix(c.rgb, pnt.rgb, pnt.a), 'amonhen-uruk');
}

// NOISE_GLSL
const hash = Fn(([p]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)), 'float');
const vnoise = Fn(([p]) => {
  const i = floor(p);
  const f0 = fract(p);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3));
  return mix(mix(hash(i), hash(i.add(vec2(1, 0))), f.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x), f.y);
}, 'float');
const fbm2 = Fn(([p0]) => {
  const p = vec2(p0).toVar();
  const s = float(0).toVar();
  const a = float(0.5).toVar();
  Loop(4, () => {
    s.addAssign(vnoise(p).mul(a));
    p.assign(p.mul(2.03).add(vec2(1.7, 9.2)));
    a.mulAssign(0.5);
  });
  return s.div(0.9375);
}, 'float');

// The river and the falls in one sheet: uv.y runs from -1 upstream to 0 at
// the lip and 1 at the foot, uv.x across in tens of metres. Fogged with
// the scene.
export function fallsMaterial(uniforms) {
  const u = nodesOf(uniforms);
  const mat = new MeshBasicNodeMaterial({ fog: true });
  const vUv = uv();
  mat.colorNode = Fn(() => {
    const f = vUv.y;
    const deep = vec3(0.13, 0.2, 0.19);
    const glass = vec3(0.34, 0.45, 0.42);
    const white = vec3(0.8, 0.83, 0.8);
    // above the lip: dark and glassy, sliding faster towards the edge
    const s = fbm2(vec2(vUv.x.mul(2), f.mul(9).sub(u.uTime.mul(f.add(1).mul(0.6).add(0.5)))));
    const above = mix(
      mix(deep, glass, smoothstep(-0.5, 0, f).mul(0.7).add(s.sub(0.5).mul(0.3))),
      white,
      smoothstep(0.6, 0.8, s)
        .mul(0.25)
        .add(smoothstep(-0.08, 0, f).mul(0.3)),
    );
    // over it: streaks scrolling down, breaking up whiter as they go
    const fallT = u.uTime.mul(0.9);
    const s1 = fbm2(vec2(vUv.x.mul(5), f.mul(2.6).sub(fallT)));
    const s2 = vnoise(vec2(vUv.x.mul(21), f.mul(5).sub(fallT.mul(1.7))));
    const streak = s1.mul(0.65).add(s2.mul(0.35));
    const broken = smoothstep(0, 0.5, f);
    const over = mix(glass, white, clamp(smoothstep(0.38, 0.72, streak).mul(broken.mul(0.55).add(0.45)).add(broken.mul(0.35)), 0, 1))
      .mul(s2.mul(0.18).add(0.82))
      .mul(mix(0.78, 1, smoothstep(0, 0.12, f)));
    const below = mix(over, white, smoothstep(0.8, 1, f).mul(0.85));
    return select(f.lessThan(0), above, below);
  })();
  mat.uniforms = u;
  return mat;
}

// The churned water spreading from the foot of the falls, uv.y 0 at the
// fall and 1 out where it calms: white foam in drifts, thinning away.
export function foamMaterial(uniforms) {
  const u = nodesOf(uniforms);
  const mat = new MeshBasicNodeMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
  });
  const vUv = uv();
  const n = fbm2(vec2(vUv.x.mul(3), vUv.y.mul(4).sub(u.uTime.mul(0.35))))
    .mul(0.7)
    .add(vnoise(vec2(vUv.x.mul(14).add(u.uTime.mul(0.2)), vUv.y.mul(12).sub(u.uTime.mul(0.6)))).mul(0.3));
  const a = smoothstep(0, 1, vUv.y)
    .oneMinus()
    .mul(smoothstep(0.3, 0.65, n.add(vUv.y.oneMinus().mul(0.35))))
    .mul(smoothstep(0, 0.06, vUv.x))
    .mul(fall(1, 0.94, vUv.x));
  mat.colorNode = vec3(0.9, 0.92, 0.9);
  mat.opacityNode = a.mul(0.9);
  mat.uniforms = u;
  return mat;
}

// Mist: puffs that rise and drift out from the foot of the falls, swell
// and fade, over and over, each a quad turned to the camera in the vertex
// stage (`corner` its corner, `puff` its seed, size, speed and phase), so
// all of it is one draw.
export function mistMaterial(uniforms) {
  const u = nodesOf(uniforms);
  const mat = new MeshBasicNodeMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
  });
  const corner = attribute('corner', 'vec2');
  const puff = attribute('puff', 'vec4');
  const life = fract(u.uTime.mul(puff.z).add(puff.w));
  const p = positionGeometry.add(
    vec3(
      sin(puff.x.mul(7).add(u.uTime.mul(0.15)))
        .mul(7)
        .mul(life),
      life.mul(30),
      life.mul(16),
    ),
  );
  const size = puff.y.mul(life.mul(1.2).add(0.55));
  const vA = varying(smoothstep(0, 0.18, life).mul(smoothstep(0.5, 1, life).oneMinus()), 'vA');
  wrap(
    mat,
    'setupPositionView',
    () => {
      const mv = modelViewMatrix.mul(vec4(p, 1));
      return vec3(mv.xy.add(corner.mul(size).mul(length(modelWorldMatrix.element(0).xyz))), mv.z);
    },
    'amonhen:mist',
  );
  const vUv = varying(corner.mul(0.5).add(0.5), 'vUv');
  const puffTex = texture(uniforms.uPuff.value, vUv);
  mat.colorNode = vec3(0.86, 0.87, 0.84);
  mat.opacityNode = puffTex.a.mul(vA).mul(0.62);
  mat.uniforms = { ...u, uPuff: puffTex };
  return mat;
}

// The Eye of Sauron, on a quad that turns to the camera in the vertex
// stage (scaled with its model): a lidless almond of fire. uK (0..1) is how
// fiercely it burns. Bright above 1, so the bloom takes it; no fog, so it
// reads from afar.
export function eyeMaterial(uniforms) {
  const u = nodesOf(uniforms);
  const mat = new MeshBasicNodeMaterial({
    fog: false,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  wrap(
    mat,
    'setupPositionView',
    () => {
      const c = modelViewMatrix.mul(vec4(0, 0, 0, 1));
      return vec3(c.xy.add(positionGeometry.xy.mul(vec2(length(modelWorldMatrix.element(0).xyz), length(modelWorldMatrix.element(1).xyz)))), c.z);
    },
    'amonhen:eye',
  );
  const vUv = uv();
  const shade = Fn(() => {
    const p = vUv.mul(2).sub(1);
    const k = u.uK;
    const t = u.uTime;
    // searching: the slit sliding across the iris, the fire with it
    const look = sin(t.mul(0.47))
      .mul(0.05)
      .mul(k.add(0.4))
      .add(sin(t.mul(1.31).add(1)).mul(0.012));
    const e = p.div(vec2(0.34, 0.2));
    // an almond: pointed at either end
    const r = length(
      vec2(
        e.x,
        e.y.div(
          max(
            0.12,
            pow(min(abs(e.x), 1), 1.8)
              .mul(-0.7)
              .add(1),
          ),
        ),
      ),
    );
    const rp = length(p.mul(vec2(0.8, 1)));
    const a = atan(e.y, e.x);
    // flames licking out, longest upwards
    const lick = fbm2(vec2(a.mul(2.4).add(4), rp.mul(3.4).sub(t.mul(k.add(1.2)))));
    const lick2 = vnoise(vec2(a.mul(7).add(1), rp.mul(8).sub(t.mul(k.mul(1.5).add(2.5)))));
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
    // the iris: fibres of fire, red at the rim, white-hot at the pupil
    const px = p.x.sub(look);
    const fib = vnoise(vec2(atan(p.y, px).mul(9), r.mul(3).sub(t.mul(0.5))))
      .mul(0.6)
      .add(vnoise(vec2(atan(p.y, px).mul(26), r.mul(6).add(t.mul(0.3)))).mul(0.4));
    const near = exp(abs(px).mul(-9));
    const iris = mix(vec3(1.1, 0.16, 0.02), vec3(2.3, 0.5, 0.04), fall(0.98, 0.6, r)).toVar();
    iris.assign(mix(iris, vec3(2.8, 1.35, 0.2), near.mul(fall(1, 0.25, r)).mul(0.85)));
    iris.mulAssign(fib.mul(0.65).add(0.6));
    iris.assign(mix(vec3(0.35, 0.03, 0.01), iris, fall(1, 0.85, r)));
    // the pupil: a black slit, narrower as it burns fiercer (pow(y, 2.0)
    // as y * y: WGSL has no pow of a negative)
    const py = p.y.div(0.2);
    const w = k
      .mul(-0.35)
      .add(1)
      .mul(0.04)
      .mul(sqrt(max(0, py.mul(py).oneMinus())));
    const pupil = smoothstep(w.mul(0.6), w.add(0.006), abs(px)).oneMinus();
    const fire = mix(vec3(2.2, 0.5, 0.05), vec3(0.8, 0.09, 0.015), smoothstep(1, reach, r));
    const col = mix(fire.mul(flame), iris, inside).toVar();
    col.assign(mix(col, vec3(0.02, 0, 0), pupil.mul(inside)));
    const alpha = max(inside, clamp(flame.mul(1.4), 0, 1)).toVar();
    // a red glow beyond
    const halo = exp(rp.mul(-3)).mul(k.mul(0.35).add(0.3));
    col.addAssign(vec3(1, 0.18, 0.03).mul(halo).mul(alpha.oneMinus()));
    alpha.assign(max(alpha, halo));
    const edge = fall(1, 0.8, max(abs(p.x), abs(p.y)));
    return vec4(col.mul(k.mul(0.45).add(0.75)), alpha.mul(edge));
  })();
  mat.colorNode = shade.rgb;
  mat.opacityNode = shade.a;
  mat.uniforms = u;
  return mat;
}
