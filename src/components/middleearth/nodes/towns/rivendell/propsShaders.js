// ../../../towns/rivendell/propsShaders.js on the node renderer: the falls’
// sheet, mist and foam, their GLSL line for line in TSL, the same names,
// arguments and returns. waterfallUniforms is uniform nodes under the
// GLSL’s names (the fog’s left to the scene), so the kit’s `.value` writes
// land and the three materials share them; a material handed plain
// { value }s follows them instead. Fog is the scene’s, as fog_fragment’s
// was, and the three are tone mapped, their GLSL having the chunk.

import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  attribute,
  clamp,
  cos,
  dot,
  floor,
  fract,
  length,
  max,
  mix,
  modelViewMatrix,
  normalize,
  positionGeometry,
  positionLocal,
  positionView,
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
} from "three/tsl";
import { follow, wrap } from "../../../../../lib/three/hookNodes";

// The uniforms a waterfall’s three materials share: the clock, the light
// on it, its deep colour, how bright, how far it falls (uFall, the sheet’s
// length) and how thick the mist.
export function waterfallUniforms() {
  return {
    uTime: uniform(0),
    uLight: uniform(new THREE.Color(1.0, 0.92, 0.8)),
    uDeep: uniform(new THREE.Color(0.36, 0.5, 0.58)),
    uBright: uniform(1),
    uFall: uniform(1),
    uMist: uniform(1),
  };
}

// (a node kept, a { value } followed, one node a holder so the three
// materials still share it)
const SHARED = new WeakMap();
const of = (holder) => {
  if (holder?.isNode) return holder;
  if (!SHARED.has(holder)) SHARED.set(holder, follow(holder));
  return SHARED.get(holder);
};
const nodesOf = (uniforms) => {
  const out = {};
  for (const [k, v] of Object.entries(uniforms))
    if (k.startsWith("u")) out[k] = of(v);
  return out;
};

// GLSL’s smoothstep(a, b, x) with a > b, the edges put in order
const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();

const hash = Fn(([p0]) => {
  const p = fract(p0.mul(vec2(123.34, 456.21))).toVar();
  p.addAssign(dot(p, p.add(45.32)));
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

// The falling sheet's shader: streaks of white water sliding down it,
// faster as they fall (their phase goes as the root of the fall), over a
// translucent blue-white body; ragged at its sides, foam where it pours
// over the lip and where it breaks at the foot. Finer streaks fade with
// distance so it doesn't shimmer far off.
export function fallMaterial(uniforms) {
  const u = nodesOf(uniforms);
  const m = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
  const aLayer = attribute("aLayer", "float");
  const vUv = uv();
  m.positionNode = positionLocal.add(
    vec3(
      sin(vUv.y.mul(0.35).add(u.uTime.mul(1.3)).add(aLayer.mul(2)))
        .mul(0.06)
        .mul(vUv.y)
        .div(10),
      0,
      0,
    ),
  );
  const vLayer = varying(aLayer, "vLayer");
  const vDist = varying(positionView.z.negate(), "vDist");
  const across = vUv.x;
  const fallen = vUv.y.div(u.uFall);
  const ph = sqrt(max(vUv.y, 0))
    .mul(2.4)
    .sub(u.uTime.mul(vLayer.mul(0.25).add(1.5)))
    .add(vLayer.mul(7));
  const far = smoothstep(40, 160, vDist);
  const s1 = vnoise(vec2(across.mul(34).add(vLayer.mul(5)), ph.mul(2.2)));
  const s2 = mix(
    vnoise(vec2(across.mul(90).add(13), ph.mul(5).add(3))),
    0.5,
    far,
  );
  const body = vnoise(vec2(across.mul(9).add(vLayer.mul(3)), ph.mul(0.8)));
  const streak = smoothstep(0.42, 0.9, s1.mul(0.62).add(s2.mul(0.48)));
  // ragged sides
  const rag = vnoise(vec2(ph.mul(3), across.mul(4).add(vLayer))).mul(0.12);
  const side = smoothstep(0, rag.add(0.1), across).mul(
    fall(1, rag.negate().add(0.9), across),
  );
  const lip = smoothstep(0, 0.06, fallen).oneMinus();
  const foot = smoothstep(0.78, 1, fallen);
  const white = clamp(
    streak
      .mul(fallen.mul(0.3).add(0.75))
      .add(body.mul(0.25))
      .add(lip.mul(0.6))
      .add(foot.mul(0.85)),
    0,
    1,
  );
  // the sheet thins into strands as it falls
  const strands = mix(
    1,
    smoothstep(0.25, 0.6, s1).mul(0.55).add(0.45),
    smoothstep(0.15, 0.7, fallen).mul(foot.oneMinus()),
  );
  const alpha = side
    .mul(strands)
    .mul(white.mul(0.55).add(0.42))
    .mul(vLayer.mul(0.25).oneMinus());
  m.colorNode = mix(u.uDeep, vec3(1), white).mul(u.uLight).mul(u.uBright);
  m.opacityNode = alpha;
  m.uniforms = u;
  return m;
}

// Mist and spray at the foot of the falls: camera-facing puffs that rise,
// swell and thin away on their own clocks, from a few metres to many.
export function mistMaterial(uniforms, map) {
  const u = { ...nodesOf(uniforms), uMap: texture(map) };
  const m = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  const corner = attribute("corner", "vec2");
  const seed = attribute("seed", "vec4");
  const life = fract(u.uTime.mul(seed.y).add(seed.x));
  // (the GLSL’s vertex: the puff’s place in the view, turned and swollen)
  wrap(
    m,
    "setupPositionView",
    () => {
      const up = seed.z.mul(life);
      const p = vec3(
        positionGeometry.x,
        positionGeometry.y.add(up.mul(1.6)),
        positionGeometry.z,
      );
      const out = normalize(p.xz.add(vec2(0.001))).mul(up.mul(0.6));
      const at = vec3(p.x.add(out.x), p.y, p.z.add(out.y));
      const size = seed.z.mul(life.mul(0.9).add(0.55));
      const mv = modelViewMatrix.mul(vec4(at, 1)).xyz;
      const a = seed.w.mul(6.2831).add(life.mul(1.5));
      const c = cos(a);
      const s = sin(a);
      // (GLSL’s mat2(c, -s, s, c) is by columns)
      const turned = vec2(
        c.mul(corner.x).add(s.mul(corner.y)),
        s.negate().mul(corner.x).add(c.mul(corner.y)),
      );
      return vec3(mv.xy.add(turned.mul(size)), mv.z);
    },
    "rivendell:mist",
  );
  const vUv = varying(corner.mul(0.5).add(0.5), "vUv");
  const vA = varying(smoothstep(0, 0.15, life).mul(life.oneMinus()), "vA");
  const a = u.uMap.sample(vUv).a.mul(vA).mul(u.uMist).mul(0.3);
  m.colorNode = u.uLight.mul(u.uBright).mul(0.95);
  m.opacityNode = a;
  m.uniforms = u;
  return m;
}

// The foam where it lands: a churned ring on the water, `w` the falls’
// width (the ring’s radii as the GLSL wrote them, to two places).
export function foamMaterial(uniforms, w) {
  const u = nodesOf(uniforms);
  const m = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  const vP = varying(positionGeometry.xy, "vP");
  const r = length(vP);
  const t = u.uTime;
  const n = vnoise(vP.mul(1.6).add(vec2(t.mul(0.7), t.mul(-0.4))))
    .mul(0.6)
    .add(vnoise(vP.mul(4).sub(vec2(t.mul(1.1), t.mul(0.6)))).mul(0.4));
  const ring = fall(
    Number((w * 1.6).toFixed(2)),
    Number((w * 0.3).toFixed(2)),
    r,
  );
  const a = ring.mul(smoothstep(0.3, 0.75, n.add(ring.mul(0.35))));
  m.colorNode = u.uLight.mul(u.uBright);
  m.opacityNode = a.mul(0.9);
  m.uniforms = u;
  return m;
}
