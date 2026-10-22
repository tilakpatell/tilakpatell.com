// The castle near: the plan (plan.js) built from the kit (parts.js) into a
// mesh a material (mesh.js, materials.js), so all of it is eight draws;
// the covered bridge in a group of its own (grounds/bridge.js sways it);
// the clock’s hands keeping the world’s time on both its faces and its
// pendulum swinging in the bay under the east one. Past FAR metres (far.js;
// on low, always) the near castle is put away and the far one drawn in its
// place, one draw; the two are never drawn together but for the moment of
// the swap.
//
//   createCastle({ house, tier, ground }) → {
//     group (the near castle), far (the far castle’s mesh), bridge: { group, frame },
//     materials, colliders (plan.js’s footprints), floors (its decks and stairs), doors (plan.js’s DOORS),
//     update(dt, camera, { hour, night, snow, wet }), near (whether the near castle is the one drawn),
//     stats: { near: triangles, far: triangles, draws }, ready, dispose() }
//   handAngles(hour) → { hour, minute } radians clockwise from twelve (pure)
//   swing(t) → the pendulum’s angle at t seconds (pure)

import * as THREE from 'three';
import { createMesh } from './mesh';
import { PARTS, coveredFrame } from './parts';
import { CLOCK, DOORS, PLAN, floors, footprints } from './plan';
import { FAR, createFarCastle } from './far';
import { createCastleMaterials } from './materials';
import { heightAt } from '../terrain';
import { CASTLE_FLOOR, placeById } from '../../rules/places';
import { seeded } from '../../../../lib/seeded';

const MATS = ['ashlar', 'rubble', 'slate', 'lead', 'glass', 'timber', 'iron', 'pane'];
const PERIOD = 4.2; // s a swing there and back: a pendulum about four metres long
const SWING = 0.16; // radians each way
const HYSTERESIS = 25; // m: the swap back to near waits this much closer, so it never flickers on the line

export function handAngles(hour) {
  const h = ((hour % 12) + 12) % 12;
  return { hour: (h / 12) * Math.PI * 2, minute: (h % 1) * Math.PI * 2 };
}
export const swing = (t) => SWING * Math.sin((t / PERIOD) * Math.PI * 2);

export function createCastle({ house = null, tier = 'high', ground = heightAt } = {}) {
  const materials = createCastleMaterials({ house, tier });
  const group = new THREE.Group();
  group.name = 'hogwarts:castle';
  const shadows = tier !== 'low';

  // the castle, every part but the covered bridge, a mesh a material
  const mesh = createMesh();
  const ctx = { mesh, ground, far: false, rng: seeded(7) };
  for (const p of PLAN) if (p.kind !== 'covered') PARTS[p.kind](ctx, p);
  const geometries = mesh.geometries();
  let triangles = 0;
  for (const name of MATS) {
    const g = geometries[name];
    if (!g) continue;
    const m = new THREE.Mesh(g, materials[name]);
    m.name = `castle:${name}`;
    // (what glows or lets the light through casts nothing)
    m.castShadow = shadows && name !== 'glass' && name !== 'pane';
    m.receiveShadow = shadows;
    if (name === 'pane') m.renderOrder = 2;
    group.add(m);
    triangles += g.attributes.position.count / 3;
  }

  // the covered bridge, in its own group from its west gate, turned and tilted to the stone circle
  const spec = PLAN.find((p) => p.kind === 'covered');
  const frame = coveredFrame(spec);
  const bridgeMesh = createMesh();
  PARTS.covered({ mesh: bridgeMesh, ground, far: false, local: true, rng: seeded(9) }, spec);
  const bridge = new THREE.Group();
  bridge.name = 'castle:covered-bridge';
  bridge.position.set(...spec.from);
  bridge.rotation.order = 'YZX';
  bridge.rotation.set(0, frame.yaw, frame.pitch);
  for (const [name, g] of Object.entries(bridgeMesh.geometries())) {
    const m = new THREE.Mesh(g, materials[name]);
    m.castShadow = shadows;
    m.receiveShadow = shadows;
    bridge.add(m);
    triangles += g.attributes.position.count / 3;
  }
  group.add(bridge);

  // the clock’s hands on each face, and the pendulum hung in the bay under the east face
  const hands = [];
  const ironHand = (len, w) => {
    const g = new THREE.BoxGeometry(w, len, 0.12);
    g.translate(0, len / 2 - 0.4, 0);
    return g;
  };
  const handGeo = { hour: ironHand(CLOCK.face.r * 0.55, 0.32), minute: ironHand(CLOCK.face.r * 0.85, 0.2) };
  const handMat = materials.iron;
  const faceOf = (name) => {
    const turn = name === 'right' ? Math.PI / 2 : name === 'left' ? -Math.PI / 2 : name === 'front' ? 0 : Math.PI;
    const out = CLOCK.w / 2 + 0.3;
    return { turn, at: [CLOCK.at[0] + Math.sin(turn) * out, CLOCK_Y(CLOCK.face.y), CLOCK.at[1] + Math.cos(turn) * out] };
  };
  for (const name of CLOCK.face.faces) {
    const f = faceOf(name);
    const pivot = new THREE.Group();
    pivot.position.set(...f.at);
    pivot.rotation.y = f.turn;
    const hour = new THREE.Mesh(handGeo.hour, handMat);
    const minute = new THREE.Mesh(handGeo.minute, handMat);
    minute.position.z = 0.14;
    pivot.add(hour, minute);
    group.add(pivot);
    hands.push({ hour, minute, sign: 1 });
  }
  const bay = faceOf(CLOCK.bay.faces[0]);
  const pendulum = new THREE.Group();
  pendulum.position.set(bay.at[0] - Math.sin(bay.turn) * 0.6, CLOCK_Y(CLOCK.bay.y + CLOCK.bay.h - 2.2), bay.at[2] - Math.cos(bay.turn) * 0.6);
  pendulum.rotation.y = bay.turn;
  const rodLen = CLOCK.bay.h - 5.2;
  const rod = new THREE.Mesh(new THREE.BoxGeometry(0.14, rodLen, 0.14).translate(0, -rodLen / 2, 0), materials.lead);
  const bob = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.3, 24).rotateX(Math.PI / 2).translate(0, -rodLen, 0), materials.lead);
  const swinger = new THREE.Group();
  swinger.add(rod, bob);
  pendulum.add(swinger);
  group.add(pendulum);

  // the far castle, its windows on the near castle’s night
  const far = createFarCastle({ house, ground, night: materials.uniforms.uNight });
  far.mesh.castShadow = false;
  far.mesh.receiveShadow = false;
  const farTriangles = far.mesh.geometry.attributes.position.count / 3;

  const centre = placeById('castle').at;
  const reach = FAR[tier] ?? FAR.high;
  let near = reach > 0;
  let t = 0;
  const show = () => {
    group.visible = near;
    far.mesh.visible = !near;
  };
  show();

  return {
    group,
    far: far.mesh,
    bridge: { group: bridge, frame, from: spec.from, to: spec.to },
    materials,
    colliders: footprints(),
    floors: floors(),
    doors: DOORS,
    get near() {
      return near;
    },
    stats: { near: Math.round(triangles), far: Math.round(farTriangles), draws: group.children.length },
    ready: materials.ready,
    update(dt, camera, { hour = null, night = null, snow = null, wet = null } = {}) {
      t += dt;
      materials.update(dt);
      materials.set({ night, snow, wet });
      if (camera && reach > 0) {
        const d = Math.hypot(camera.position.x - centre[0], camera.position.z - centre[1]);
        const want = near ? d < reach : d < reach - HYSTERESIS;
        if (want !== near) {
          near = want;
          show();
        }
      }
      if (!near) return;
      if (hour != null) {
        const a = handAngles(hour);
        // (seen from outside, a hand turns clockwise: about the face’s outward axis, negatively)
        for (const h of hands) {
          h.hour.rotation.z = -a.hour;
          h.minute.rotation.z = -a.minute;
        }
      }
      swinger.rotation.z = swing(t);
    },
    dispose() {
      for (const g of Object.values(geometries)) g.dispose();
      bridge.traverse((o) => o.geometry?.dispose());
      handGeo.hour.dispose();
      handGeo.minute.dispose();
      rod.geometry.dispose();
      bob.geometry.dispose();
      far.dispose();
      materials.dispose();
    },
  };
}

// a height on the clock tower over the castle’s floor
const CLOCK_Y = (y) => CASTLE_FLOOR + y;

