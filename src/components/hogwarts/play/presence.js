// The night’s watchers where you can see them (Lane F): the night’s sim
// (play/night.js, rules/people.js) says where everyone is on the Map’s
// frame; after curfew, in the room you’re in, the ones on their rounds in
// it too are stood there as the cast’s figures and walked where the sim
// walks them (Mrs Norris ahead of him), so the footprints on the Map and the person coming down the
// hall at you are the same person. Filch carries his lantern (its light is
// the 6 m cone the curfew reads); the prefects and Snape walk their rounds.
// By day the rooms’ own lanes seat their people (the Great Hall’s crowd),
// so this keeps to the night.
//
//   WATCHERS: the ids shown, and what each carries (or is: the cat)
//   roomPose(room, person, origin, floorAt) → { at: [x, y, z], yaw } where a person on the Map stands in a room (pure)
//   createPresence({ rt, scene, house }) → { step(dt, { room, origin, floorAt, people, night, filch }), info(), dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { figure } from '../cast/figures';
import { ROSTER } from '../rules/people';
import { frameYaw, toRoom } from '../rules/paths';

export const WATCHERS = { filch: { lantern: true }, norris: { cat: true }, snape: {}, percy: {}, penelope: {} };
export const NORRIS_URL = '/models/hogwarts/creatures/norris.glb';
const CAST = new Map(ROSTER.map((r) => [r.id, r.cast]));
const PACE = 1.5; // m/s the figures are walked at when the sim has them moving (a round’s)

// where someone on the Map’s frame stands in a room built at `origin`, and the way they face
export function roomPose(room, p, origin = [0, 0, 0], floorAt = () => 0) {
  const [x, z] = toRoom(room, [p.x, p.z]);
  // (a heading on the Map turned back into the room’s frame; the figures face +z)
  const yaw = frameYaw(room);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const ux = c * (p.dx ?? 0) - s * (p.dz ?? 1);
  const uz = s * (p.dx ?? 0) + c * (p.dz ?? 1);
  return { at: [origin[0] + x, origin[1] + floorAt(x, z), origin[2] + z], yaw: Math.atan2(ux, uz) };
}

// Mrs Norris: the made cat (static: she sits and stares; on the move she
// goes in little hops), loaded once and cloned for the room she’s in
let catModel = null;
const loadCat = (rt) => (catModel ??= (rt?.assets?.gltf ? Promise.resolve(rt.assets.gltf(NORRIS_URL)) : import('../../../lib/three/gltf.js').then((g) => g.loadGltf(NORRIS_URL))).then((g) => g?.scene ?? null).catch(() => null));
function cat(rt, house) {
  const group = new THREE.Group();
  group.name = 'hogwarts:norris';
  let gone = false;
  loadCat(rt).then((scene) => {
    if (!scene || gone) return;
    group.add(scene.clone(true));
    house?.adopt?.(group);
  });
  let t = 0;
  return {
    group,
    set() {},
    tick(dt, moving = false) {
      t += dt;
      group.children[0]?.position.set(0, moving ? Math.abs(Math.sin(t * 9)) * 0.06 : 0, 0);
    },
    bone: () => null,
    dispose() {
      gone = true;
      group.removeFromParent();
    },
  };
}

// Filch’s lantern: a warm glass and its light, hung at his hand once his rig is in
function lantern() {
  const group = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.16, 8), new MeshBasicNodeMaterial({ color: new THREE.Color('#ffb45a').multiplyScalar(2.2) }));
  const light = new THREE.PointLight('#ffb060', 6, 9, 2);
  group.add(glass, light);
  return { group, dispose: () => (glass.geometry.dispose(), glass.material.dispose()) };
}

export function createPresence({ rt = null, scene, house = null }) {
  const shown = new Map(); // id → { f, lantern, hung }
  let roomOf = null;

  const drop = (id) => {
    const s = shown.get(id);
    if (!s) return;
    s.f.dispose();
    s.lantern?.group.removeFromParent();
    s.lantern?.dispose();
    shown.delete(id);
  };
  const make = (id) => {
    const f = WATCHERS[id].cat ? cat(rt, house) : figure(CAST.get(id) ?? id, { rt });
    scene.add(f.group);
    f.ready?.then((ok) => ok && house?.adopt?.(f.group));
    // (the lantern in the scene, moved to his hand each frame: under a bone it would take the rig’s centimetres)
    const s = { f, lantern: WATCHERS[id].lantern ? lantern() : null };
    if (s.lantern) scene.add(s.lantern.group);
    shown.set(id, s);
    return s;
  };

  return {
    step(dt, { room = null, origin = [0, 0, 0], floorAt = () => 0, people = [], night = false, filch = null }) {
      if (room !== roomOf) {
        for (const id of [...shown.keys()]) drop(id);
        roomOf = room;
      }
      const here = new Set();
      if (room && night)
        for (const p0 of people) {
          if (!WATCHERS[p0.id] || p0.inside !== room || p0.rest) continue;
          // (Filch’s hurry to a noise, the curfew’s, in place of his round)
          const p = p0.id === 'filch' && filch ? { ...p0, x: filch.x, z: filch.z, dx: filch.dx, dz: filch.dz, moving: true } : p0;
          here.add(p.id);
          const s = shown.get(p.id) ?? make(p.id);
          const pose = roomPose(room, p, origin, floorAt);
          s.f.group.position.set(...pose.at);
          s.f.group.rotation.y = pose.yaw;
          s.f.set({ speed: p.moving ? PACE : 0 });
          s.f.tick(dt, p.moving);
          if (s.lantern) {
            const hand = s.f.bone('RightHand');
            if (hand) {
              s.f.group.updateMatrixWorld(true);
              hand.getWorldPosition(s.lantern.group.position);
              s.lantern.group.position.y -= 0.12;
            } else s.lantern.group.position.set(pose.at[0] + Math.sin(pose.yaw) * 0.3 + Math.cos(pose.yaw) * 0.3, pose.at[1] + 0.85, pose.at[2] + Math.cos(pose.yaw) * 0.3 - Math.sin(pose.yaw) * 0.3);
          }
        }
      for (const id of [...shown.keys()]) if (!here.has(id)) drop(id);
    },
    info: () => ({ room: roomOf, shown: [...shown].map(([id, s]) => ({ id, at: s.f.group.position.toArray().map((v) => Math.round(v * 100) / 100), yaw: Math.round(s.f.group.rotation.y * 100) / 100 })) }),
    dispose() {
      for (const id of [...shown.keys()]) drop(id);
    },
  };
}
