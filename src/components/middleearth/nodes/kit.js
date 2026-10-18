// The Middle-earth scenes' common parts on the node renderer: ../kit.js's
// three shaders (the lava, the sky dome, the particles' billboards) in TSL,
// line for line with the GLSL, and everything else ../kitParts.js's, the
// same objects. Each material keeps its uniforms under the GLSL's names on
// `material.uniforms` (uniform nodes, `.value` as before), so the scenes
// write `uTime.value` and `uFlash.value` as they did.
//
// What the node renderer does for the GLSL's chunks: the tone map and the
// output colour space are the renderer's own (a node material's output, the
// same as the chunks drew), and the lava's fog is the scene's fog on a
// node material (fog: true).

import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  Loop,
  abs,
  attribute,
  dot,
  exp,
  float,
  floor,
  fract,
  length,
  max,
  mix,
  modelViewMatrix,
  normalize,
  positionGeometry,
  positionLocal,
  positionWorld,
  pow,
  select,
  sin,
  smoothstep,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { particlePool } from "../kitParts";
import { wrap } from "../../../lib/three/hookNodes";

export * from "../kitParts";

// ../kit.js's GLSL_NOISE: a value noise and five octaves of it
const hash = Fn(
  ([p]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)),
  "float",
);
const noise = Fn(([p]) => {
  const i = floor(p);
  const f0 = fract(p);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3));
  return mix(
    mix(hash(i), hash(i.add(vec2(1, 0))), f.x),
    mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x),
    f.y,
  );
}, "float");
export const fbm = Fn(([p0]) => {
  const p = vec2(p0).toVar();
  const a = float(0.5).toVar();
  const s = float(0).toVar();
  Loop(5, () => {
    s.addAssign(a.mul(noise(p)));
    p.assign(p.mul(2.03).add(vec2(17, 9)));
    a.mulAssign(0.5);
  });
  return s;
}, "float");

// Molten rock, flowing slowly: a dark crust, bright in the channels, and
// hottest round `spot` (x, z).
export function lavaMaterial({
  scale = 0.07,
  heat = 1,
  spot = [0, 0],
  reach = 0.004,
} = {}) {
  const uniforms = {
    uTime: uniform(0),
    uScale: uniform(scale),
    uHeat: uniform(heat),
    uSpot: uniform(new THREE.Vector2(spot[0], spot[1])),
    uReach: uniform(reach),
  };
  const mat = new MeshBasicNodeMaterial({ fog: true });
  const world = varying(positionWorld, "vWorld");
  const p = world.xz.mul(uniforms.uScale);
  const flow = vec2(uniforms.uTime.mul(0.02), uniforms.uTime.mul(0.012));
  const w = fbm(p.mul(1.5).add(flow));
  const n = fbm(
    p
      .mul(3)
      .add(vec2(w.mul(1.6), w.mul(-1.2)))
      .sub(flow.mul(1.5)),
  );
  const crack = smoothstep(0.44, 0.6, n);
  const core = smoothstep(0.6, 0.78, n);
  const col = mix(
    mix(vec3(0.03, 0.01, 0.006), vec3(1.5, 0.3, 0.04), crack),
    vec3(3, 1.35, 0.3),
    core,
  );
  const d = world.xz.sub(uniforms.uSpot);
  mat.colorNode = col
    .mul(exp(dot(d, d).mul(uniforms.uReach).negate()).mul(0.95).add(0.5))
    .mul(uniforms.uHeat);
  mat.uniforms = uniforms;
  return mat;
}

// What is behind everything: three colours up the sky, and (for Mordor)
// slow cloud lit from underneath towards `glow`.
export function skyDome(
  radius,
  {
    top = 0x020101,
    horizon = 0x120704,
    bottom = 0x7a2408,
    cloud = 0,
    glow = [1, 0, 0],
    glowColor = 0xff5a14,
  } = {},
) {
  const uniforms = {
    uTop: uniform(new THREE.Color(top)),
    uHorizon: uniform(new THREE.Color(horizon)),
    uBottom: uniform(new THREE.Color(bottom)),
    uCloud: uniform(cloud),
    uGlowDir: uniform(new THREE.Vector3(...glow).normalize()),
    uGlow: uniform(new THREE.Color(glowColor)),
    uFlash: uniform(0),
    uTime: uniform(0),
  };
  const mat = new MeshBasicNodeMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const u = uniforms;
  const dir = varying(normalize(positionLocal), "vDir");
  mat.colorNode = Fn(() => {
    const d = normalize(dir);
    const col = select(
      d.y.greaterThan(0),
      mix(u.uHorizon, u.uTop, pow(max(d.y, 0), 0.55)),
      mix(u.uHorizon, u.uBottom, pow(max(d.y.negate(), 0), 0.7)),
    ).toVar();
    const p = d.xz.div(abs(d.y).add(0.22));
    const c0 = fbm(p.mul(1.4).add(vec2(u.uTime.mul(0.012), 0)));
    const c = smoothstep(
      0.34,
      0.74,
      fbm(
        p
          .mul(2.6)
          .add(c0.mul(1.8))
          .sub(vec2(u.uTime.mul(0.02), u.uTime.mul(0.006))),
      ),
    );
    const near = pow(max(0, dot(d, u.uGlowDir)), 3);
    const lit = mix(u.uHorizon.mul(1.6), u.uGlow, near).mul(
      c.mul(0.65).add(0.35),
    );
    const cloudy = mix(
      col,
      lit,
      u.uCloud.mul(smoothstep(-0.02, 0.2, d.y)).mul(c.mul(0.65).add(0.35)),
    )
      .add(u.uGlow.mul(near).mul(near).mul(0.35))
      .add(
        vec3(0.8, 0.75, 1)
          .mul(u.uFlash)
          .mul(c)
          .mul(smoothstep(0, 0.5, d.y)),
      );
    // (the GLSL's `if (uCloud > 0.0)`: the clouds only where asked for)
    return select(u.uCloud.greaterThan(0), cloudy, col);
  })();
  mat.uniforms = uniforms;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 20), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  return dome;
}

// The particles' material: a soft round billboard about its instance's
// centre (aAt.xyz, size aAt.w), its colour and alpha per instance.
const particleMaterial = ({ stretch, additive }) => {
  const uniforms = { uStretch: uniform(stretch) };
  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    fog: false,
  });
  const at = attribute("aAt", "vec4");
  const color = attribute("aColor", "vec4");
  wrap(
    mat,
    "setupPositionView",
    () =>
      modelViewMatrix
        .mul(vec4(at.xyz, 1))
        .xyz.add(
          vec3(
            positionGeometry.xy.mul(at.w).mul(vec2(1, uniforms.uStretch)),
            0,
          ),
        ),
    "middleearth:particles",
  );
  const vUv = varying(positionGeometry.xy, "vUv");
  const a = smoothstep(1, 0, length(vUv).mul(2));
  mat.colorNode = color.rgb;
  mat.opacityNode = a.mul(a).mul(color.a);
  mat.uniforms = uniforms;
  return mat;
};

export const createParticles = (max, opts) =>
  particlePool(particleMaterial, max, opts);
