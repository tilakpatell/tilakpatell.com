// ../../../towns/cirithungol/propsShaders.js on the node renderer: Cirith
// Ungol’s hooks and materials, the same names and arguments, their GLSL
// line for line in TSL. A material keeps its uniforms on
// `material.uniforms` under the GLSL’s names (uniform nodes, so a `.value`
// write still lands); what it shares (U: the clock, the beam, the glow) is
// a uniform node that reads U’s { value } every render, so the kit’s tick
// and Minas Morgul’s update go on writing U as before. A hook returns the
// node material for the classic one it was given (hookNodes’ asNode), and
// ./props.js already uses what each returns.
//
// What runs differently, and why:
// - hide is Moria’s twin’s: the GLSL was the same patch, word for word, so
//   one twin draws both; its `extra` is a function of what the hide
//   sampled, returning what it adds.
// - The beam and the splash keep a ShaderMaterial’s defaults: no fog, no
//   tone mapping (their GLSL had neither chunk), the mesh’s own vertex.
// - Each falling smoothstep is a rising one turned over (WGSL’s rules).

import * as THREE from "three";
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu";
import {
  abs,
  atan,
  clamp,
  dot,
  length,
  materialEmissive,
  max,
  modelViewMatrix,
  normalGeometry,
  normalView,
  normalize,
  positionGeometry,
  positionView,
  pow,
  sin,
  smoothstep,
  step,
  texture,
  transformNormalToView,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
  vertexColor,
} from "three/tsl";
import { follow, keyed, wrap } from "../../../../../lib/three/hookNodes";

export { hide } from "../moria/propsShaders";

// One uniform node a { value } of the kit’s, so every material reading it
// shares it (and shares a program where nothing else differs).
const SHARED = new WeakMap();
const of = (holder) => {
  if (!SHARED.has(holder)) SHARED.set(holder, follow(holder));
  return SHARED.get(holder);
};

// GLSL’s smoothstep(a, b, x) with a > b, the edges put in order
const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();

// The GLSL’s vertex: the mesh’s own position into view, nothing else moving it.
const rawVertex = (m, tag) =>
  wrap(
    m,
    "setupPositionView",
    () => modelViewMatrix.mul(vec4(positionGeometry, 1)).xyz,
    tag,
  );

// a ShaderMaterial’s defaults on a node material
const basic = (o) =>
  new MeshBasicNodeMaterial({ fog: false, toneMapped: false, ...o });

// The city's stone: pale, and glowing a sickly green from within, most at
// its edges (as if the light came through it) and in veins that crawl
// slowly up it. uGlow scales it.
export function ghostMaterial(U) {
  const m = new MeshStandardNodeMaterial({
    vertexColors: true,
    color: 0x5c6862,
    roughness: 0.82,
    metalness: 0,
  });
  const u = {
    uTime: of(U.uTime),
    uGlow: of(U.uGlow),
    uGhost: of(U.uGhost),
  };
  const noise = U.uNoise.value;
  // (the vertex as it came, in the mesh’s own space)
  const P = varying(positionGeometry, "vGhP");
  const t = u.uTime;
  const fres = abs(
    dot(normalView, normalize(positionView.negate())),
  ).oneMinus();
  const n1 = texture(
    noise,
    P.xy.mul(0.011).add(vec2(P.z.mul(0.007), t.mul(0.004))),
  ).r;
  const n2 = texture(
    noise,
    vec2(P.x.add(P.z).mul(0.021), P.y.mul(0.005).sub(t.mul(0.012))),
  ).g;
  const veins = smoothstep(0.52, 0.72, n2).mul(
    sin(t.mul(0.7).add(n1.mul(9)))
      .mul(0.4)
      .add(0.6),
  );
  const pale = dot(vertexColor().rgb, vec3(0.33));
  const rim = fres.mul(fres).mul(fres);
  const foot = smoothstep(-8, 60, P.y).mul(0.5).oneMinus();
  m.emissiveNode = materialEmissive.add(
    u.uGhost
      .mul(u.uGlow)
      .mul(rim.mul(0.5).add(0.035).add(veins.mul(0.16)))
      .mul(n1.mul(0.8).add(0.6))
      .mul(pale.mul(0.65).add(0.45))
      .mul(foot),
  );
  return keyed(m, "cirith-ghost", u);
}

// The green beam: an open column, brightest down its middle, light pouring
// up it in streaks; `uBeam` sends its front up from the tower top (0 to
// 0.7) and its light (from 0), and it dissolves into the cloud at its head.
export function beamMaterial(U, { k = 1, core = 2.2, edge = 3.0 } = {}) {
  const uniforms = {
    uTime: of(U.uTime),
    uBeam: of(U.uBeam),
    uNoise: texture(U.uNoise.value),
    uK: uniform(k),
    uCore: uniform(core),
    uEdge: uniform(edge),
  };
  const u = uniforms;
  const m = basic({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  rawVertex(m, "cirith:beam");
  const vN = varying(transformNormalToView(normalGeometry), "vN");
  const vV = varying(
    normalize(modelViewMatrix.mul(vec4(positionGeometry, 1)).xyz.negate()),
    "vV",
  );
  const vUv = uv();
  const t = u.uTime;
  const facing = abs(dot(normalize(vN), normalize(vV)));
  const mid = pow(facing, u.uEdge);
  const y = vUv.y;
  const front = smoothstep(0, 0.7, u.uBeam).mul(1.05);
  const rise = fall(front, front.sub(0.05), y);
  const on = smoothstep(0, 0.1, u.uBeam);
  const n1 = u.uNoise.sample(vec2(vUv.x.mul(2), y.mul(5).sub(t.mul(0.7)))).r;
  const n2 = u.uNoise.sample(
    vec2(vUv.x.mul(6).add(0.37), y.mul(13).sub(t.mul(1.9))),
  ).g;
  const streak = smoothstep(0.25, 0.75, n1.mul(0.6).add(n2.mul(0.6)))
    .mul(1.4)
    .add(0.45);
  const head = smoothstep(0.62, 1, y).oneMinus();
  const foot = smoothstep(0, 0.015, y);
  const a = mid.mul(streak).mul(rise).mul(head).mul(foot).mul(on).mul(u.uK);
  m.colorNode = vec3(0.34, 1.0, 0.46)
    .mul(u.uCore)
    .mul(a)
    .add(
      vec3(0.85, 1.0, 0.88)
        .mul(pow(facing, u.uEdge.mul(4)))
        .mul(rise)
        .mul(head)
        .mul(on)
        .mul(u.uK)
        .mul(1.6),
    )
    // the front of it, burning as it climbs
    .add(
      vec3(0.6, 1.0, 0.7)
        .mul(fall(0.06, 0, abs(y.sub(front))))
        .mul(step(u.uBeam, 0.72))
        .mul(mid)
        .mul(on)
        .mul(3)
        .mul(u.uK),
    );
  m.uniforms = uniforms;
  return m;
}

// Where the beam meets the cloud: a wide splash of green light, swirling,
// seen from below.
export function splashMaterial(U) {
  const uniforms = {
    uTime: of(U.uTime),
    uBeam: of(U.uBeam),
    uNoise: texture(U.uNoise.value),
  };
  const u = uniforms;
  const m = basic({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  rawVertex(m, "cirith:splash");
  const t = u.uTime;
  const q = uv().sub(0.5);
  const d = length(q).mul(2);
  const a = atan(q.y, q.x);
  const sw = u.uNoise.sample(
    vec2(
      a.mul(0.4).add(d.mul(0.6)).sub(t.mul(0.03)),
      d.mul(0.7).sub(t.mul(0.05)),
    ),
  ).r;
  const sw2 = u.uNoise.sample(vec2(a.mul(0.9).sub(t.mul(0.02)), d.mul(1.6))).g;
  const k = smoothstep(0.55, 1, u.uBeam);
  const glow = pow(clamp(d, 0, 1).oneMinus(), 2.4)
    .mul(1.3)
    .add(
      smoothstep(0.35, 0.85, sw.mul(sw2).mul(1.8)).mul(d.oneMinus()).mul(0.8),
    )
    .mul(k);
  m.colorNode = vec3(0.3, 1.0, 0.45).mul(glow).mul(1.4);
  m.uniforms = uniforms;
  return m;
}

// Shelob's rim, so she reads against the dark: what hide's `extra` adds
export function shelobRim() {
  return {
    extra: ({ hs }) => {
      // (the normal as lit: the hide’s bumps in it)
      // (held at 0, so no rounding past 1 gives pow a negative)
      const rimK = pow(
        max(
          abs(dot(normalView, normalize(positionView.negate()))).oneMinus(),
          0,
        ),
        3,
      );
      return {
        emissive: vec3(0.05, 0.055, 0.065).mul(rimK).mul(hs.g.add(0.4)),
      };
    },
  };
}
