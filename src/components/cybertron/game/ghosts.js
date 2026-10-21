// The others online in Cybertron's world (GameWorld's useTravellers), as
// the Middle-earth towns and C-137's street show theirs: each the hero of
// the area you're both in (Optimus in Iacon and on Earth, Megatron in
// Kaon), pale and shimmering, with their name over him
// (middleearth/towns/ghosts.js does the pale, the card and the ring). The
// figure is the hero's blocky stand-in (bots.js's standIn), built in code
// and baked to one mesh a form (a ghost is one pale material, so its boxes
// are one draw): a ghost downloads nothing, and a hundred triangles cost
// less than a copy of a 40,000-triangle scan. Driving, they're their
// vehicle; nothing here touches them, nor they anything here.
//
//   stepOf(player, area) → [h, flags]: what goes to the room each frame
//   ghostFigure({ robot, vehicle }) → { group, top, robot, vehicle }
//   ghostPose(figure, t, p): robot or vehicle as they are, a walk's bob

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { standIn } from './bots';
import { MODELS } from './catalog';

// where you are, to the others: the robot's ground speed, or the truck's
// (backwards counts), and the link keeps a height from the ground up
export function stepOf(p, area) {
  const speed = p.mode === 'vehicle' ? Math.abs(p.speed ?? 0) : Math.hypot(p.vx ?? 0, p.vz ?? 0);
  return [{ x: p.x, y: Math.max(0, p.y ?? 0), z: p.z, face: p.yaw, speed }, { ride: p.mode === 'vehicle', area }];
}

// a stand-in's boxes in one geometry, where it had them (and its own let go)
function baked(kind) {
  const g = standIn(kind);
  g.updateMatrixWorld(true);
  const parts = [];
  const mats = new Set();
  g.traverse((o) => {
    if (!o.isMesh) return;
    const p = new THREE.BufferGeometry();
    p.setIndex(o.geometry.index);
    p.setAttribute('position', o.geometry.attributes.position);
    p.setAttribute('normal', o.geometry.attributes.normal);
    parts.push(p.applyMatrix4(o.matrixWorld));
    o.geometry.dispose();
    mats.add(o.material);
  });
  for (const m of mats) m.dispose();
  const one = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  // (ghosts.js puts its pale material on it, and frees both)
  return new THREE.Mesh(one, new THREE.MeshBasicMaterial());
}

export function ghostFigure({ robot, vehicle = null }) {
  const group = new THREE.Group();
  const body = baked(robot);
  group.add(body);
  let car = null;
  if (vehicle) {
    car = baked(vehicle);
    car.visible = false;
    group.add(car);
  }
  return { group, top: MODELS[robot]?.metres ?? 7, robot: body, vehicle: car };
}

export function ghostPose(f, t, p) {
  const riding = Boolean(p.ride && f.vehicle);
  f.robot.visible = !riding;
  if (f.vehicle) f.vehicle.visible = riding;
  // (a big robot's weight: a slow bob as he strides, still when he stands)
  f.robot.position.y = !riding && p.moving ? Math.abs(Math.sin(t * 4.2)) * 0.18 : 0;
}
