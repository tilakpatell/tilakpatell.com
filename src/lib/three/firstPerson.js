// Seeing out of a 2017 figure's own eyes (lane A of docs/superpowers/specs/
// 2026-10-10-bf2017-every-asset-design.md): the camera at its Head bone, a
// little ahead, its head and hair (where they are parts of their own) taken out of sight and the rest of the
// body drawn whole (the drop has no arms-only mesh), its arms in the game's
// first-person poses (walrusSets/firstPerson.js). Not on a phone, nor in a
// seat or on a ride: there the camera stays behind (Review Focus 4).
//
//   canFirstPerson(fig, { phone, seated }) → bool
//   eyeOf(fig, forward, out) → the eye in the world (the head bone's, EYE ahead along `forward`)
//   hideHead(fig) → () => void: the head's parts hidden; the call puts them back

import * as THREE from 'three';

// metres ahead of the head bone the eye is: past the face, since most of the
// game's people come with the head joined into the body (scripts/
// bf2017-import.mjs --join: a part a material), so a helmet that can't be
// hidden is behind the camera's near plane instead
export const EYE = 0.22;

// a part of the head, by its material's name (the game's: mat_head, M_Headgear_05, *_hair_*)
const HEAD_PARTS = /(head|hair|eye|lash|teeth|tongue|face|helmet|hood|beard|mask)/i;
const headOf = (fig) => fig?.model?.getObjectByName('Head') ?? null;

export function canFirstPerson(fig, { phone = false, seated = false } = {}) {
  return !phone && !seated && fig?.rig === 'walrus' && Boolean(headOf(fig));
}

const _p = new THREE.Vector3();
export function eyeOf(fig, forward, out = new THREE.Vector3()) {
  const head = headOf(fig);
  if (!head) return null;
  head.getWorldPosition(_p);
  return out.copy(_p).addScaledVector(forward, EYE);
}

export function hideHead(fig) {
  const hid = [];
  fig?.model?.traverse((o) => {
    if (o.isMesh && o.visible && [].concat(o.material).some((m) => HEAD_PARTS.test(m?.name ?? ''))) {
      o.visible = false;
      hid.push(o);
    }
  });
  return () => hid.forEach((o) => (o.visible = true));
}
