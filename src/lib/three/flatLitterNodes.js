// ./flatLitter.js on the node renderer: the same leaves on level ground,
// the same sim, arguments and returns, drawn by a MeshLambertNodeMaterial.
// The GLSL’s rewrite of a Lambert’s chunks is node hooks here
// (./hookNodes.js): each leaf stood where it is on the vertex before three
// places it, its tilted normal the vertex’s own, the leaf cut out of the
// quad (a discard, the material’s mask) and coloured its own, both faces
// lit as its front (./foliageNodes.js’s faceless). Its uniforms are
// uniform nodes under the GLSL’s names on `material.uniforms`.
// flatLitterShader, the GLSL’s strings, has no twin. The wind’s CPU
// helpers are ./windNodes.js’s (./wind.js holds GLSL); ./leafSim.js is
// numbers only, imported as the original does.
//
//   flatLeafCount(density, { max, half })
//   createFlatLitter({ max, half, spec, wind, floorAt, crowns, reduced, seed, focus, lift })
//     → { mesh, material, sim, ground, update(dt, { focus, walkers }),
//       blast(x, z, r, strength), info(), dispose() }

import * as THREE from "three";
import { MeshLambertNodeMaterial } from "three/webgpu";
import {
  Fn,
  abs,
  attribute,
  clamp,
  cos,
  float,
  fract,
  instanceIndex,
  max,
  mix,
  normalLocal,
  positionGeometry,
  pow,
  select,
  sin,
  smoothstep,
  uniform,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { seeded } from "../seeded";
import { faceless } from "./foliageNodes";
import { onPosition } from "./hookNodes";
import {
  LEAF,
  blastLeaves,
  layLeaves,
  makeLeafSim,
  shedLeaf,
  stepLeafSim,
  wrapLeaves,
} from "./leafSim";
import { sampleNoise, windOffsetAt } from "./windNodes";

// (a place’s density over its box, in 32s, never fewer than 32: litter.js’s leafCount)
export const flatLeafCount = (density, { max, half }) =>
  Math.min(
    max,
    Math.max(32, Math.round((density * (2 * half) ** 2) / 32) * 32),
  );
const FAST = 8; // m/s: no walker’s quicker (a step across the world isn’t a kick)
const MOVED = 0.01; // (metres a leaf goes before the ground under it is looked at again)

// ── the shader ──

// the GLSL’s leafTurn: v turned by a
const leafTurn = Fn(([v, a]) => {
  const c = cos(a);
  const s = sin(a);
  return vec2(c.mul(v.x).sub(s.mul(v.y)), s.mul(v.x).add(c.mul(v.y)));
}, "vec2");

function leafMaterial(u) {
  const material = new MeshLambertNodeMaterial({ side: THREE.DoubleSide });
  material.name = "leaves";
  const aLeaf = attribute("aLeaf", "vec4"); // x, its height off the ground, z (metres), its colour
  const aSeed = attribute("aLeafSeed", "vec4"); // its turn, its size, its two tilts
  const aGround = attribute("aLeafGround", "float"); // the ground’s height where it is
  const position = positionGeometry;
  onPosition(
    material,
    () => {
      // Bruno’s static random normal (Leaves.js): a leaf lying flat lit as
      // if tilted, each its own way (the GLSL’s objectNormal, (0, 1, 0)
      // turned in yz, then in xy)
      const yz = leafTurn(vec2(1, 0), aSeed.z);
      const xy = leafTurn(vec2(0, yz.x), aSeed.w);
      normalLocal.assign(vec3(xy.x, xy.y, yz.y));
      // his flutter (by how high it is: none lying down), its turn, gone
      // toward the box’s edge (no pop as it wraps), and put where it is
      // over the ground
      const lfH = max(aLeaf.y, 0);
      const lfT = u.uLeafClock
        .mul(fract(float(instanceIndex).mul(0.618)).mul(2).add(2))
        .mul(clamp(aLeaf.y.sub(LEAF.floor).mul(2), 0, 1));
      const t0 = position.mul(u.uLeafLook.x.mul(aSeed.y));
      const a1 = leafTurn(t0.xy, sin(aLeaf.x.mul(3).add(lfT)).mul(lfH));
      const t1 = vec3(a1, t0.z);
      const a2 = leafTurn(
        t1.yz,
        sin(aLeaf.z.mul(3).add(lfT.mul(1.3))).mul(lfH),
      );
      const t2 = vec3(t1.x, a2);
      const a3 = leafTurn(t2.xz, aSeed.x);
      const t3 = vec3(a3.x, t2.y, a3.y);
      const lfOff = abs(aLeaf.xz.sub(u.uLeafFocus.xy));
      const t4 = t3.mul(
        smoothstep(
          u.uLeafFocus.z.mul(0.8),
          u.uLeafFocus.z,
          max(lfOff.x, lfOff.y),
        ).oneMinus(),
      );
      return t4.add(
        vec3(aLeaf.x, aGround.add(u.uLeafLook.y).add(aLeaf.y), aLeaf.z),
      );
    },
    "flat-leaves",
    u,
  );
  const vLeafMix = varying(aLeaf.w, "vLeafMix");
  // (the quad unskewed, -0.5…0.5)
  const vLeafUv = varying(
    vec2(position.x.add(position.z.mul(0.3)), position.z.negate()),
    "vLeafUv",
  );
  // a leaf cut out of the quad (broad toward its stalk, pointed at its tip,
  // skewed with the quad), its colour its own, a little darker at its edge
  // (litter.js’s, line for line; its pow of a lfT kept off the negatives)
  const lfT = vLeafUv.x.add(0.5);
  const lfW = pow(max(sin(pow(max(lfT, 0), 0.8).mul(3.14159265)), 0), 0.8).mul(
    0.46,
  );
  const lfV = abs(vLeafUv.y);
  material.maskNode = lfV.lessThanEqual(lfW);
  material.colorNode = select(
    vLeafMix.greaterThan(1.5),
    u.uLeafC,
    mix(u.uLeafA, u.uLeafB, vLeafMix),
  ).mul(mix(1, 0.78, smoothstep(lfW.mul(0.5), lfW, lfV)));
  // both faces lit as the front
  faceless(material);
  material.uniforms = u;
  return material;
}

// ── the leaves ──

export function createFlatLitter({
  max = 512,
  half = 14,
  spec = {},
  wind = null,
  floorAt = () => 0,
  crowns = [],
  reduced = false,
  seed = 1,
  focus: start = { x: 0, z: 0 },
  lift = 0.02,
} = {}) {
  const sim = makeLeafSim(max);
  const ground = new Float32Array(max); // (the ground’s height under each leaf)
  const looked = new Float32Array(2 * max); // (where each leaf was when it was looked at)
  // Bruno’s quad: a 1 m square, skewed, lying flat
  const quad = new THREE.PlaneGeometry(1, 1);
  const qp = quad.attributes.position.array;
  qp[0] += 0.15;
  qp[3] += 0.15;
  qp[6] -= 0.15;
  qp[9] -= 0.15;
  quad.rotateX(-Math.PI / 2);
  const geometry = new THREE.InstancedBufferGeometry().copy(quad);
  quad.dispose();
  const aLeaf = new THREE.InstancedBufferAttribute(sim.p, 4).setUsage(
    THREE.DynamicDrawUsage,
  );
  const aGround = new THREE.InstancedBufferAttribute(ground, 1).setUsage(
    THREE.DynamicDrawUsage,
  );
  geometry.setAttribute("aLeaf", aLeaf);
  geometry.setAttribute(
    "aLeafSeed",
    new THREE.InstancedBufferAttribute(sim.seed, 4),
  );
  geometry.setAttribute("aLeafGround", aGround);
  const [a, b, c] = spec.colours ?? ["#8a6a2e", "#c89a3c", "#b4622c"];
  const uniforms = {
    uLeafFocus: uniform(new THREE.Vector3(start.x, start.z, half)),
    uLeafLook: uniform(new THREE.Vector2(spec.size ?? 0.2, lift)),
    uLeafClock: uniform(0),
    uLeafA: uniform(new THREE.Color(a)),
    uLeafB: uniform(new THREE.Color(b)),
    uLeafC: uniform(new THREE.Color(c ?? b)),
  };
  const material = leafMaterial(uniforms);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "leaves";
  mesh.frustumCulled = false;

  const rand = seeded(seed * 7 + 3);
  const focus = { x: start.x, z: start.z };
  const seen = new Map(); // a walker’s key → { x, z, tick }: where they were, when
  let tick = 0;
  let shed = 0;
  const kickers = [];
  const pool = []; // (kickers’ own objects, kept from frame to frame)
  const near = []; // (crowns in the box: one picked to shed)
  const off = { x: 0, z: 0, k: 0 };
  // the wind’s gate where a leaf is: its slow noise, a long way across,
  // drifting downwind (his scrolls the other way, which reads as backward
  // this close)
  const gate = (x, z) => {
    const u = wind.uniforms;
    const d = u.uWindDir.value;
    const t = u.uWindTime.value;
    return sampleNoise(
      u.uWindNoise.value.image,
      x * LEAF.wind.frequency - d.x * t,
      z * LEAF.wind.frequency - d.y * t,
    );
  };
  const gust = { strength: 0, dir: [1, 0], gate };
  // the ground under every leaf that’s moved since it was last looked at
  // (and sent, those alone)
  const settle = (all = false) => {
    let lo = -1;
    let hi = -1;
    for (let i = 0; i < sim.count; i++) {
      const x = sim.p[4 * i];
      const z = sim.p[4 * i + 2];
      if (
        !all &&
        Math.abs(x - looked[2 * i]) + Math.abs(z - looked[2 * i + 1]) < MOVED
      )
        continue;
      looked[2 * i] = x;
      looked[2 * i + 1] = z;
      ground[i] = floorAt(x, z);
      if (lo < 0) lo = i;
      hi = i;
    }
    if (lo < 0) return 0;
    aGround.clearUpdateRanges();
    aGround.addUpdateRange(lo, hi - lo + 1);
    aGround.needsUpdate = true;
    return hi - lo + 1;
  };
  const send = () => {
    uniforms.uLeafFocus.value.set(focus.x, focus.z, half);
    aLeaf.clearUpdateRanges();
    aLeaf.addUpdateRange(0, 4 * sim.count);
    aLeaf.needsUpdate = true;
    settle();
  };
  // laid round the focus, in his clumps (the wind’s own noise), at rest
  const img = wind?.uniforms.uWindNoise.value.image;
  layLeaves(sim, flatLeafCount(spec.density ?? 0.3, { max, half }), {
    half,
    focus,
    rand,
    clump: img ? (u, v) => sampleNoise(img, u, v) - 0.5 : null,
  });
  geometry.instanceCount = sim.count;
  settle(true);

  return {
    mesh,
    material,
    sim,
    ground,
    // a frame: `focus` the box’s middle ({ x, z }), who’s walking
    // ([{ key, x, z, y }])
    update(dt, { focus: f = focus, walkers = [] } = {}) {
      focus.x = f.x;
      focus.z = f.z;
      if (reduced || !(dt > 0)) {
        if (reduced) wrapLeaves(sim, focus, half);
        send();
        return;
      }
      // who’s walking, and how fast (from where they were last frame)
      kickers.length = 0;
      tick += 1;
      for (const w of walkers) {
        const was = seen.get(w.key);
        let vx = 0;
        let vz = 0;
        if (was) {
          vx = (w.x - was.x) / dt;
          vz = (w.z - was.z) / dt;
          if (
            Math.hypot(w.x - was.x, w.z - was.z) > 2 ||
            !Number.isFinite(vx + vz)
          )
            vx = vz = 0;
          const sp = Math.hypot(vx, vz);
          if (sp > FAST) {
            vx *= FAST / sp;
            vz *= FAST / sp;
          }
          was.x = w.x;
          was.z = w.z;
          was.tick = tick;
        } else seen.set(w.key, { x: w.x, z: w.z, tick });
        const k =
          pool[kickers.length] ??
          (pool[kickers.length] = { x: 0, z: 0, y: 0, vx: 0, vz: 0 });
        k.x = w.x;
        k.z = w.z;
        k.y = w.y ?? 0;
        k.vx = vx;
        k.vz = vz;
        kickers.push(k);
      }
      // (those not seen this frame forgotten)
      for (const [key, w] of seen) if (w.tick !== tick) seen.delete(key);
      if (wind) {
        const u = wind.uniforms;
        gust.strength = u.uWindStrength.value;
        gust.dir[0] = u.uWindDir.value.x;
        gust.dir[1] = u.uWindDir.value.y;
      }
      stepLeafSim(sim, dt, {
        focus,
        half,
        wind: wind ? gust : null,
        walkers: kickers,
      });
      // shed from the crowns round you, more in a gust
      if (spec.shed > 0 && crowns.length) {
        const k = wind
          ? windOffsetAt(wind.uniforms, focus.x, focus.z, off).k
          : 0;
        shed +=
          spec.shed *
          dt *
          (1 + (2 * Math.max(0, k)) / Math.max(0.05, gust.strength));
        if (shed >= 1) {
          near.length = 0;
          for (const cr of crowns)
            if (
              Math.max(Math.abs(cr.x - focus.x), Math.abs(cr.z - focus.z)) <
              half - cr.r
            )
              near.push(cr);
          if (!near.length) shed = 0;
          for (; shed >= 1 && near.length; shed -= 1)
            shedLeaf(sim, near[Math.floor(rand() * near.length)], {
              focus,
              half,
              rand,
            });
        }
      }
      uniforms.uLeafClock.value += dt;
      send();
    },
    // thrown out from (x, z) within r metres, at most `strength` m/s;
    // nothing with motion turned down, or out of the box
    blast(x, z, r, strength = LEAF.blast.strength) {
      if (reduced) return 0;
      if (!(Math.max(Math.abs(x - focus.x), Math.abs(z - focus.z)) <= half + r))
        return 0;
      return blastLeaves(sim, x, z, r, strength, rand);
    },
    // how many there are, in the air, asleep; where the box is
    info() {
      let airborne = 0;
      let asleep = 0;
      for (let i = 0; i < sim.count; i++) {
        if (sim.p[4 * i + 1] > LEAF.floor + 0.005) airborne += 1;
        if (sim.rest[i]) asleep += 1;
      }
      return {
        count: sim.count,
        half,
        airborne,
        asleep,
        focus: [focus.x, focus.z],
        reduced,
      };
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
