// The host of Rohan's materials on the node renderer: ../../../towns/edoras/
// folkShaders.js's GLSL, line for line in TSL, as hooks on Lambert node
// materials. The uniforms are the kit's own { value } holders (folk.js's
// `uniforms`, which its tick writes), followed every render; each material
// keeps them on `material.uniforms` under the GLSL's names.
//
// What the node renderer does for the GLSL's chunks: the Riders' colours,
// which the GLSL multiplied into vColor in the vertex shader, are worked
// out per vertex and carried to the fragment, where three multiplies them
// into the vertex colour (the same: a piece's rig is the same at each of
// its triangle's corners).

import * as THREE from "three";
import { MeshLambertNodeMaterial } from "three/webgpu";
import {
  Fn,
  abs,
  attribute,
  cos,
  dot,
  float,
  fract,
  int,
  select,
  sin,
  smoothstep,
  uniformArray,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import {
  follow,
  instanceMatrixOf,
  onColor,
  onPosition,
} from "../../../../../lib/three/hookNodes";

const TAU = 6.2831853;

// the uniforms the frame writes, followed; the colour tables as arrays
function nodesOf(uniforms) {
  const u = {};
  for (const k of ["uTime", "uRide", "uCyc", "uReach", "uFlut"])
    u[k] = follow(uniforms[k], "float");
  for (const k of ["uCoat", "uMane", "uCloak", "uPlume"])
    u[k] = uniformArray(uniforms[k].value, "color");
  return u;
}

// each Rider out of step with the next, from where its instance stands (a
// lone mesh is one Rider, always the same)
const hostSeed = (builder) => {
  const im = instanceMatrixOf(builder);
  if (!im) return float(0.37);
  const at = im.element(3);
  return fract(
    sin(dot(vec2(at.x, at.z), vec2(12.9898, 78.233))).mul(43758.5453),
  );
};

const hostTurn = Fn(([p, c, a]) => {
  const q = p.sub(c);
  const cs = cos(a);
  const sn = sin(a);
  return c.add(
    vec2(q.x.mul(cs).sub(q.y.mul(sn)), q.x.mul(sn).add(q.y.mul(cs))),
  );
}, "vec2");

// RIG_MOVE: the legs gallop about their pivots, the body rocks and rises
const rigMove = (p0, u, seed) => {
  const rig = attribute("aRig", "vec4");
  const cyc = u.uCyc.add(seed.mul(7));
  const ride = smoothstep(0, 0.35, u.uRide);
  const leg = hostTurn(
    p0.xy,
    rig.yz,
    ride
      .mul(0.62)
      .mul(u.uReach)
      .mul(sin(cyc.add(rig.x.sub(1)).mul(TAU))),
  );
  const xy0 = select(rig.x.greaterThan(0.5), leg, p0.xy);
  const xy = hostTurn(
    xy0,
    vec2(0, 1.3),
    ride.mul(0.07).mul(sin(cyc.add(0.2).mul(TAU))),
  );
  const y = xy.y.add(
    ride.mul(
      abs(sin(cyc.add(0.1).mul(3.14159265)))
        .mul(0.14)
        .sub(0.05),
    ),
  );
  return vec3(xy.x, y, p0.z);
};

// RIG_PAINT: the coat, the cloak, the mane and the crest, picked per Rider
const rigPaint = (u, seed) => {
  const p = attribute("aRig", "vec4").w.add(0.5).floor();
  const c = int(fract(seed.mul(7.31)).mul(5.999));
  return select(
    p.equal(1),
    u.uCoat.element(c),
    select(
      p.equal(3),
      u.uMane.element(c),
      select(
        p.equal(2),
        u.uCloak.element(int(fract(seed.mul(3.71)).mul(4.999))),
        select(
          p.equal(4),
          u.uPlume.element(int(fract(seed.mul(11.3)).mul(4.999))),
          vec3(1),
        ),
      ),
    ),
  );
};

const lambert = () =>
  new MeshLambertNodeMaterial({
    vertexColors: true,
    flatShading: true,
    side: THREE.DoubleSide,
  });

export function hostMaterial(uniforms) {
  const m = lambert();
  const u = nodesOf(uniforms);
  onColor(
    m,
    (diffuse, builder) =>
      diffuse.rgb.mul(varying(rigPaint(u, hostSeed(builder)), "vHostPaint")),
    "edoras-host:paint",
  );
  onPosition(
    m,
    (p, builder) => rigMove(p, u, hostSeed(builder)),
    "edoras-host",
    u,
  );
  m.uniforms = u;
  return m;
}

// The banner's cloth waves (aRig.y how far out from the pole); with `bob`,
// it rocks and rises with its rider, as the host does.
export function bannerMaterial(uniforms, bob) {
  const m = lambert();
  const u = nodesOf(uniforms);
  onPosition(
    m,
    (p0, builder) => {
      const k = attribute("aRig", "vec4").y;
      const seed = hostSeed(builder);
      const w = smoothstep(0, 0.6, u.uRide).mul(0.65).add(0.35);
      const kw = k.mul(w);
      const p = vec3(
        p0.x.add(
          cos(u.uTime.mul(3).sub(k.mul(4)))
            .mul(0.04)
            .sub(0.03)
            .mul(kw),
        ),
        p0.y.add(
          sin(u.uTime.mul(2.1).sub(k.mul(3)).add(seed.mul(3)))
            .mul(0.05)
            .mul(kw),
        ),
        p0.z.add(
          sin(u.uFlut.sub(k.mul(4)).add(seed.mul(6)))
            .mul(0.16)
            .mul(kw),
        ),
      );
      return bob ? rigMove(p, u, seed) : p;
    },
    bob ? "edoras-banner-bob" : "edoras-banner",
    u,
  );
  m.uniforms = u;
  return m;
}
