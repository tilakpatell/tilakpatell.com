// rock.js on the node renderer: one material for every rock on the
// universe map, pitted by 3D noise in the rock's own space on `high` and
// `mid` (the pits darker and a little rougher, the light catching their
// edges), now a node material and hooks (./hookNodes.js) over the noise's
// TSL twin (./noiseNodes.js), with the same names, arguments and uniforms.
// What differs on the node renderer: ROCK_RELIEF is a uniform node (the
// pace still writes its .value), and rockHook returns the material's node
// twin (asNode), the one to draw with; on `low` it leaves the material be,
// as rock.js does.
//
// rng and rock (and mergeByPosition) are rock.js's, copied: rock.js holds
// its GLSL beside them, so importing them would bring it into a 'nodes'
// world's closure (FL4 deletes the original, and this copy is the one left).
//
// rockMaterial({ tier, scale }) → a MeshStandardNodeMaterial in two tones
// ROCK_RELIEF: a uniform node, 1; every rock's relief at once
// rockHook(material, { tier, scale }) → the node material, pitted after any hook on it
// rock(seed, { craters }) → a lumpy rock's geometry, about a unit across; rng(seed)

import * as THREE from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import {
  abs,
  cross,
  dFdx,
  dFdy,
  dot,
  float,
  fwidth,
  length,
  materialRoughness,
  min,
  modelWorldMatrix,
  normalize,
  positionGeometry,
  positionView,
  sign,
  smoothstep,
  uniform,
  varying,
  vec3,
  vec4,
} from "three/tsl";
import {
  asNode,
  instanceMatrixOf,
  keyed,
  onColor,
  onNormal,
} from "./hookNodes";
import { noiseWith } from "./noiseNodes";

// a deterministic "random", so a rock is the same every visit
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// a lumpy rock: an icosphere with its points pushed in and out by a few
// waves, squashed a little; a boulder (`craters`) is finer, its points
// shared so it's smooth, with eight craters pressed in, each with a rim
export function rock(seed, { craters = false } = {}) {
  const rand = rng(seed);
  let g = new THREE.IcosahedronGeometry(1, craters ? 2 : 1);
  if (craters) {
    // (the faces' copies of a point made one, so it shades smooth)
    g.deleteAttribute("normal");
    g.deleteAttribute("uv");
    g = mergeByPosition(g);
  }
  const pos = g.attributes.position;
  const waves = Array.from({ length: 5 }, () => [
    new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
    1.5 + rand() * 3.5,
    rand() * 6,
    0.06 + rand() * 0.1,
  ]);
  const v = new THREE.Vector3();
  const squash = new THREE.Vector3(1, 0.65 + rand() * 0.3, 0.8 + rand() * 0.25);
  const pits = craters
    ? Array.from({ length: 8 }, () => [
        new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
        0.3 + rand() * 0.3,
        0.08 + rand() * 0.07,
      ])
    : [];
  // the same point on every face that shares it moves the same way
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let k = 1;
    for (const [dir, f, ph, amp] of waves)
      k += Math.sin(v.dot(dir) * f + ph) * (craters ? amp * 0.5 : amp);
    if (!craters) k -= Math.max(0, v.dot(waves[0][0]) - 0.6) * 0.5; // a flat, broken side
    for (const [dir, a, depth] of pits) {
      const d = Math.acos(Math.min(1, Math.max(-1, v.dot(dir))));
      if (d < a) k -= depth * (1 - (d / a) ** 2);
      k += depth * 0.35 * Math.exp(-(((d - a) / (0.3 * a)) ** 2)); // its rim
    }
    v.multiplyScalar(k).multiply(craters ? squash.set(1, 0.85, 0.92) : squash);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// one copy of each point, the faces indexed into them
function mergeByPosition(g) {
  const pos = g.attributes.position;
  const keys = new Map();
  const out = [];
  const index = [];
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
    let k = keys.get(key);
    if (k === undefined) {
      k = out.length / 3;
      keys.set(key, k);
      out.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    }
    index.push(k);
  }
  g.dispose();
  const m = new THREE.BufferGeometry();
  m.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  m.setIndex(index);
  return m;
}

// GLSL's smoothstep(a, b, x) with a > b (falling), as the GLSL read it
const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();

export const ROCK_RELIEF = uniform(1);

export function rockMaterial({ tier = "high", scale = 1 } = {}) {
  return rockHook(
    new MeshStandardNodeMaterial({
      roughness: 0.92,
      metalness: 0.05,
      flatShading: true,
      envMapIntensity: 0.4,
    }),
    { tier, scale },
  );
}

export function rockHook(mat, { tier = "high", scale = 1 } = {}) {
  if (tier === "low") return mat;
  const m = asNode(mat);
  // (the pits shade it: its faces needn't be flat to read as rock)
  m.flatShading = false;
  const u = {
    uRockScale: uniform(4 * scale),
    uSeed: uniform(new THREE.Vector3(17, 3, 41)),
    uRockRelief: ROCK_RELIEF,
  };
  m.userData.rock = u;
  const { noise } = noiseWith(u.uSeed);
  const rockPits = (p) =>
    noise(p.mul(u.uRockScale))
      .mul(0.7)
      .add(noise(p.mul(u.uRockScale).mul(2.7).add(11.0)).mul(0.3));

  // what the color, roughness and normal steps share, made once a build
  // (the instance's matrix is the builder's to give)
  const builds = new WeakMap();
  const parts = (builder) => {
    let k = builds.get(builder);
    if (k) return k;
    // where on the noise: the rock's own space, each instance moved along
    // it by where it is, so no two rocks of a shape are pitted the same
    // (and how big the rock is in the world, so the pits' slope is the same at any size)
    const im = instanceMatrixOf(builder);
    const obj = varying(
      im
        ? positionGeometry.add(im.mul(vec4(0, 0, 0, 1)).xyz.mul(0.37))
        : positionGeometry,
      "vRockObj",
    );
    const size = varying(
      length(
        modelWorldMatrix.mul(
          vec4(im ? im.mul(vec4(1, 0, 0, 0)).xyz : vec3(1, 0, 0), 0),
        ).xyz,
      ),
      "vRockSize",
    );
    const h = rockPits(obj).toVar("rockH");
    const pit = fall(0.05, -0.45, h).toVar("rockPit");
    const show = fall(0.6, 0.2, length(fwidth(obj)).mul(u.uRockScale))
      .mul(u.uRockRelief)
      .toVar("rockShow");
    k = { h, pit, show, size };
    builds.set(builder, k);
    return k;
  };

  // the pits: darker, as far as they're fine enough on the screen to show
  // (none where one's under a pixel)
  onColor(
    m,
    (diffuse, builder) => {
      const { pit, show } = parts(builder);
      return diffuse.rgb.mul(
        float(1.0).sub(
          float(0.45)
            .mul(pit)
            .mul(float(0.4).add(float(0.6).mul(show))),
        ),
      );
    },
    "rock",
    u,
  );
  // a little rougher: roughnessmap_fragment's factor, before three clamps
  // it and adds the geometry's own (as lights_physical_fragment did after)
  const variants = m.setupVariants;
  m.setupVariants = function (builder) {
    const own = this.roughnessNode;
    this.roughnessNode = min(
      1.0,
      (own ? float(own) : materialRoughness).add(
        float(0.05).mul(parts(builder).pit),
      ),
    );
    try {
      return variants.call(this, builder);
    } finally {
      this.roughnessNode = own;
    }
  };
  // the light catching the pits' edges: a bump from the noise's slope
  onNormal(
    m,
    (normal, builder) => {
      const { h: rockH, show, size } = parts(builder);
      const h = rockH.mul(0.6).mul(show).mul(size).div(u.uRockScale);
      const sx = dFdx(positionView);
      const sy = dFdy(positionView);
      const r1 = cross(sy, normal);
      const r2 = cross(normal, sx);
      const det = dot(sx, r1);
      const grad = sign(det).mul(dFdx(h).mul(r1).add(dFdy(h).mul(r2)));
      return normalize(abs(det).mul(normal).sub(grad));
    },
    "rock-bump",
  );
  return keyed(m, "rock-rough");
}
