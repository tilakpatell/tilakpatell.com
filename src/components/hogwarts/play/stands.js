// The match’s crowd, and the stands and hoops it needs until the pitch’s own
// are built (the grounds’ lane draws the pitch: world/grounds/pitch.js).
// The crowd is cards: one instanced quad a person, cut to a head and
// shoulders in the shader, in a house’s colours, every one bobbing on its
// own phase and an arm up and waving on half of them; `cheer(k)` lifts the
// whole stand (a goal), and it settles again on its own. The commentator’s
// box is on the first long stand, where his bubble goes.
//
// Everything here is in the pitch’s frame (rules/quidditch.js: x along the
// long axis, the hoops at ±PITCH.hoopX, z across, y up), under `group`,
// which the match puts where the pitch is.
//
//   createStands({ house, tier, pitch, standIn }) → { group, box (the
//     commentator’s box, a Vector3 in the pitch’s frame), cheer(k),
//     shade(k), update(dt), dispose() }
//   `standIn`: draw the stands and the hoops too (no pitch of the
//   grounds’ to stand in); else the crowd alone, on the seats `pitch.seats`
//   gives ([{ from, to, house }] rows in the pitch’s frame) or, failing
//   that, where the stand-ins’ would be.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  abs,
  float,
  instancedBufferAttribute,
  length,
  max,
  mix,
  positionLocal,
  sin,
  smoothstep,
  step,
  time,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { PITCH } from "../rules/quidditch";

// the houses’ colours, robe and trim (the crowd’s scarves and the drapes)
export const COLOURS = {
  gryffindor: ["#7f0909", "#d3a625"],
  slytherin: ["#1a472a", "#aaaaaa"],
  ravenclaw: ["#0e1a40", "#946b2d"],
  hufflepuff: ["#ecb939", "#372e29"],
  staff: ["#3a2f48", "#c8b88a"],
};
// the six stands round the oval: where (an angle round it), whose
const STANDS = [
  { a: Math.PI * 0.5 - 0.42, house: "gryffindor", box: true },
  { a: Math.PI * 0.5 + 0.42, house: "staff" },
  { a: -Math.PI * 0.5 - 0.42, house: "slytherin" },
  { a: -Math.PI * 0.5 + 0.42, house: "ravenclaw" },
  { a: 0.05, house: "hufflepuff" },
  { a: Math.PI + 0.05, house: "gryffindor" },
];
const RX = PITCH.length / 2 + 16; // the oval the stands stand on
const RZ = PITCH.width / 2 + 13;
const WIDE = 22; // a stand’s width
const TIERS = 4;
const TALL = 13; // its top tier, over the grass

// a stand at angle a: its middle on the oval, facing the pitch’s middle
function standAt(a) {
  const x = Math.cos(a) * RX;
  const z = Math.sin(a) * RZ;
  const yaw = Math.atan2(-x, -z); // (+z of the stand faces the middle)
  return { x, z, yaw };
}

function paint(g, colour) {
  const p = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(p.attributes))
    if (name !== "position" && name !== "normal") p.deleteAttribute(name);
  const c = new THREE.Color().setStyle(colour, THREE.SRGBColorSpace);
  const a = new Float32Array(p.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i);
  p.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return p;
}

// the stand-ins: a timber tower of tiers, its drapes and its pointed roof
// in the house’s colours; and the six hoops, gold on their posts
function standGeometry(colours) {
  const parts = [];
  const [robe, trim] = colours;
  for (let i = 0; i < TIERS; i++) {
    const y = 4 + i * 2.6;
    // each tier a step back and up
    parts.push(
      paint(
        new THREE.BoxGeometry(WIDE, 0.4, 2.4).translate(0, y, -i * 2.2),
        "#5a4330",
      ),
    );
    parts.push(
      paint(
        new THREE.BoxGeometry(WIDE, 2.6, 0.2).translate(
          0,
          y + 1.3,
          -i * 2.2 - 1.2,
        ),
        "#4a3626",
      ),
    );
  }
  // the drape down the front, the house’s colour, its trim along the top
  parts.push(
    paint(new THREE.BoxGeometry(WIDE, 3.8, 0.15).translate(0, 1.9, 1.1), robe),
  );
  parts.push(
    paint(
      new THREE.BoxGeometry(WIDE, 0.35, 0.18).translate(0, 3.7, 1.12),
      trim,
    ),
  );
  // the legs and the back
  for (const x of [-WIDE / 2, 0, WIDE / 2])
    parts.push(
      paint(
        new THREE.BoxGeometry(0.5, TALL + 2, 0.5).translate(
          x,
          (TALL + 2) / 2,
          -TIERS * 2.2,
        ),
        "#3e2e22",
      ),
    );
  parts.push(
    paint(
      new THREE.BoxGeometry(WIDE, TALL + 2, 0.3).translate(
        0,
        (TALL + 2) / 2,
        -TIERS * 2.2 - 0.3,
      ),
      "#4a3626",
    ),
  );
  // a banner down the back, the house's
  parts.push(
    paint(
      new THREE.BoxGeometry(WIDE * 0.3, TALL * 0.8, 0.1).translate(
        0,
        TALL * 0.55,
        -TIERS * 2.2 - 0.5,
      ),
      robe,
    ),
  );
  parts.push(
    paint(
      new THREE.BoxGeometry(WIDE * 0.3, 0.5, 0.12).translate(
        0,
        TALL * 0.95,
        -TIERS * 2.2 - 0.5,
      ),
      trim,
    ),
  );
  // the roof, a long tent in the colour
  const roof = new THREE.CylinderGeometry(0.01, 1, 1, 4, 1)
    .rotateY(Math.PI / 4)
    .scale(WIDE * 0.75, 4, TIERS * 2.2 * 0.8)
    .translate(0, TALL + 4, -TIERS * 1.1);
  parts.push(paint(roof, robe));
  return mergeGeometries(parts);
}
// the grass: an oval a little past the stands, the line round the pitch and
// the circle in its middle a paler green
function turfGeometry() {
  const oval = (rx, rz, y, colour) =>
    paint(
      new THREE.CircleGeometry(1, 64)
        .rotateX(-Math.PI / 2)
        .scale(rx, 1, rz)
        .translate(0, y, 0),
      colour,
    );
  const ring = (rx, rz, w, y, colour) =>
    paint(
      new THREE.RingGeometry(1 - w / rx, 1, 64)
        .rotateX(-Math.PI / 2)
        .scale(rx, 1, rz)
        .translate(0, y, 0),
      colour,
    );
  return mergeGeometries([
    oval(RX + 14, RZ + 12, 0, "#3f5f2c"),
    ring(PITCH.length / 2, PITCH.width / 2, 0.5, 0.02, "#8fae6a"),
    ring(9, 9, 0.4, 0.02, "#8fae6a"),
  ]);
}
function hoopsGeometry() {
  const parts = [];
  for (const end of [-1, 1])
    for (const h of PITCH.hoops) {
      const x = end * PITCH.hoopX;
      parts.push(
        paint(
          new THREE.CylinderGeometry(0.12, 0.16, h.y - h.r, 8).translate(
            x,
            (h.y - h.r) / 2,
            h.z,
          ),
          "#b48a3c",
        ),
      );
      parts.push(
        paint(
          new THREE.TorusGeometry(h.r, 0.1, 6, 28)
            .rotateY(Math.PI / 2)
            .translate(x, h.y, h.z),
          "#e0b04a",
        ),
      );
    }
  return mergeGeometries(parts);
}

// The crowd’s cards: a head and shoulders cut from the quad, an arm up on
// half of them, waving; each bobs on its own phase, higher the louder it is
function crowdMaterial(u, a) {
  const m = new MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  // (each card's own: read a card at a time, not a corner at a time)
  const phase = instancedBufferAttribute(a.phase, "float");
  const arm = instancedBufferAttribute(a.arm, "float");
  const colour = instancedBufferAttribute(a.colour, "vec3");
  // the bob, done to the quad (in the vertex stage), louder with the cheer
  const bob = sin(time.mul(float(3).add(u.cheer.mul(6))).add(phase.mul(6.283)))
    .mul(float(0.06).add(u.cheer.mul(0.45)))
    .max(0);
  m.positionNode = positionLocal.add(vec3(0, bob, 0));
  const vPhase = varying(phase);
  const vArm = varying(arm);
  const p = uv();
  const head = step(length(p.sub(vec2(0.5, 0.8))), float(0.15));
  const body = step(
    length(p.sub(vec2(0.5, 0.26)).mul(vec2(1 / 0.36, 1 / 0.42))),
    float(1),
  );
  // the arm, from the shoulder up, swinging with the cheer
  const sway = sin(time.mul(7).add(vPhase.mul(6.283))).mul(
    u.cheer.mul(0.08).add(0.01),
  );
  const ax = abs(p.x.sub(float(0.8).add(sway.mul(p.y.sub(0.5).max(0)).mul(3))));
  const armOn = step(ax, float(0.055))
    .mul(smoothstep(0.42, 0.46, p.y))
    .mul(step(p.y, float(0.98)))
    .mul(vArm);
  const shape = max(max(head, body), armOn);
  m.opacityNode = shape;
  m.alphaTest = 0.5;
  // the colour: the instance’s (robe or scarf), the head a face, all in the light there is
  const faceOn = head.mul(step(float(0.2), vPhase.fract()));
  m.colorNode = mix(varying(colour), vec3(0.85, 0.66, 0.52), faceOn).mul(
    u.shade,
  );
  m.fog = true;
  return m;
}

export function createStands({
  house = null,
  tier = "high",
  pitch = null,
  standIn = true,
} = {}) {
  const group = new THREE.Group();
  group.name = "hogwarts-stands";
  const disposables = [];
  const mat = house?.material
    ? house.material({ vertexColors: true })
    : new THREE.MeshLambertMaterial({ vertexColors: true });
  disposables.push(mat);
  let box = new THREE.Vector3(0, 14, RZ);

  // the seats: the pitch’s, or the stand-ins’ tiers
  const rows = pitch?.seats
    ? pitch.seats.map((r) => ({
        from: new THREE.Vector3(...r.from),
        to: new THREE.Vector3(...r.to),
        house: r.house,
      }))
    : [];
  for (const s of STANDS) {
    const { x, z, yaw } = standAt(s.a);
    const colours = COLOURS[s.house];
    if (standIn) {
      const g = standGeometry(colours);
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, 0, z);
      m.rotation.y = yaw;
      m.castShadow = false;
      m.receiveShadow = true;
      group.add(m);
      disposables.push(g);
    }
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    if (!pitch?.seats)
      for (let i = 0; i < TIERS; i++) {
        const mid = new THREE.Vector3(x, 4.4 + i * 2.6, z).addScaledVector(
          fwd,
          -i * 2.2 - 0.4,
        );
        rows.push({
          from: mid.clone().addScaledVector(side, -WIDE / 2 + 0.8),
          to: mid.clone().addScaledVector(side, WIDE / 2 - 0.8),
          house: s.house,
        });
      }
    if (s.box) box = new THREE.Vector3(x, TALL + 3, z).addScaledVector(fwd, 1);
  }
  if (standIn) {
    const tg = turfGeometry();
    const turf = new THREE.Mesh(tg, mat);
    turf.receiveShadow = true;
    group.add(turf);
    disposables.push(tg);
    const hg = hoopsGeometry();
    const hoops = new THREE.Mesh(hg, mat);
    hoops.castShadow = true;
    group.add(hoops);
    disposables.push(hg);
  }

  // the crowd: so many to a row by the tier, each a card facing the middle
  const per = tier === "low" ? 12 : tier === "mid" ? 20 : 28;
  const n = rows.length * per;
  const quad = new THREE.PlaneGeometry(0.62, 1.05).translate(0, 0.52, 0);
  const phase = new Float32Array(n);
  const arm = new Float32Array(n);
  const colour = new Float32Array(n * 3);
  const u = { cheer: uniform(0), shade: uniform(0.6) };
  const attrs = {
    phase: new THREE.InstancedBufferAttribute(phase, 1),
    arm: new THREE.InstancedBufferAttribute(arm, 1),
    colour: new THREE.InstancedBufferAttribute(colour, 3),
  };
  const crowd = new THREE.InstancedMesh(quad, undefined, n);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  let i = 0;
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const r of rows) {
    const [robe, trim] = COLOURS[r.house] ?? COLOURS.staff;
    const toMid = Math.atan2(
      -(r.from.x + r.to.x) / 2,
      -(r.from.z + r.to.z) / 2,
    );
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), toMid);
    for (let k = 0; k < per; k++) {
      p.lerpVectors(r.from, r.to, (k + 0.5) / per + (rand() - 0.5) * 0.02);
      sc.setScalar(0.9 + rand() * 0.25);
      m4.compose(p, q, sc);
      crowd.setMatrixAt(i, m4);
      phase[i] = rand();
      arm[i] = rand() < 0.5 ? 1 : 0;
      // robes mostly, a scarf’s colour now and then, a few in their own clothes
      const pick = rand();
      c.setStyle(
        pick < 0.55
          ? robe
          : pick < 0.85
            ? trim
            : ["#5a6a7a", "#7a5a4a", "#4a4a52"][Math.floor(rand() * 3)],
        THREE.SRGBColorSpace,
      );
      colour.set([c.r, c.g, c.b], i * 3);
      i++;
    }
  }
  const material = crowdMaterial(u, attrs);
  crowd.material = material;
  crowd.frustumCulled = false;
  group.add(crowd);
  disposables.push(quad, material);

  let cheer = 0;
  return {
    group,
    box,
    count: n,
    cheer(k = 1) {
      cheer = Math.max(cheer, k);
    },
    // how lit the crowd is (the light’s level, 0 to 1)
    shade(k) {
      u.shade.value = 0.25 + 0.75 * Math.max(0, Math.min(1, k));
    },
    update(dt) {
      cheer = Math.max(0, cheer - dt * 0.35);
      u.cheer.value = cheer;
    },
    dispose() {
      group.removeFromParent();
      for (const d of disposables) d.dispose?.();
    },
  };
}
