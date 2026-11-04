// A landing's own lights (a portal's glow, music's lamps, Mordor's fires),
// shown through a few lights kept in the map from the start. three makes
// every lit shader for the number of lights in the scene: a lamp put in as
// you land, or taken out as you leave, changed that number, and every lit
// thing on the map (the planets, the ships, the landing itself) had its
// shader made again in the frame that next drew it. So the things keep
// their lights where they are, out of the count (keepDark), and each frame
// the nearest of them to the player lend their place, colour, reach and
// strength to one of the map's own (drive), which are dark otherwise, as
// footScene's muzzle flare is between shots.
//
// createLamps(parent, { n, slots }) → { slots, drive(lights, at), clear(), dispose() }
//   slots  the n PointLights in `parent` (the map), there for good
//   drive  each shown light of `lights` onto a slot, nearest `at` (a point
//          in the world) first; the rest of the slots dark
// keepDark(object) → the lights under `object`, each now out of the count
// reserveLights(parent, { small, reduced }) → { flare, slots }: the landing's
//   lights (footScene's muzzle flare, none on a phone or with motion turned
//   down, and the slots, one on a phone), dark, put in `parent` (the map)
//   before the landing code comes. The map makes them as it's made, so its
//   warm-up makes every lit shader for them: made with the landing code,
//   as a landable planet first came near, they changed the count then and
//   every lit thing in view had its shader made again in that frame (ten,
//   in a 980 ms frame in software GL). createLamps takes the slots
//   (`slots`), and footScene the flare, rather than making their own.

import * as THREE from 'three';

// (no landing has more than four lights today: music's lamps, Mordor's fires)
export const LAMPS = 4;

export function keepDark(object) {
  const out = [];
  object.traverse((o) => {
    if (!o.isLight) return;
    o.visible = false;
    out.push(o);
  });
  return out;
}

// (shown: in the same world as the slots, and everything over it shown, its
// own flag aside, which keepDark has put out)
const topOf = (o) => {
  while (o.parent) o = o.parent;
  return o;
};
const shown = (light, top) => {
  let o = light.parent;
  if (!o) return false;
  for (; o.parent; o = o.parent) if (!o.visible) return false;
  return o === top && o.visible;
};

const slot = (parent) => {
  const l = new THREE.PointLight('#ffffff', 0, 0, 2);
  l.name = 'landing-lamp';
  parent.add(l);
  return l;
};

export function reserveLights(parent, { small = false, reduced = false } = {}) {
  const flare = small || reduced ? null : new THREE.PointLight('#ffd36b', 0, 0, 2);
  if (flare) {
    flare.name = 'landing-flare';
    parent.add(flare);
  }
  return { flare, slots: Array.from({ length: small ? 1 : LAMPS }, () => slot(parent)) };
}

export function createLamps(parent, { n = LAMPS, slots: given = null } = {}) {
  const slots = given ?? Array.from({ length: n }, () => slot(parent));
  const at = new THREE.Vector3();
  const near = []; // [distance², light]
  const W = new THREE.Vector3();
  const clear = () => {
    for (const s of slots) s.intensity = 0;
  };
  return {
    slots,
    drive(lights, player) {
      near.length = 0;
      const top = topOf(parent);
      for (const l of lights) {
        if (!shown(l, top)) continue;
        W.setFromMatrixPosition(l.matrixWorld);
        near.push([W.distanceToSquared(player), l]);
      }
      near.sort((a, b) => a[0] - b[0]);
      parent.updateWorldMatrix(true, false);
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        const l = near[i]?.[1];
        if (!l) {
          s.intensity = 0;
          continue;
        }
        s.position.copy(parent.worldToLocal(at.setFromMatrixPosition(l.matrixWorld)));
        s.color.copy(l.color);
        s.intensity = l.intensity;
        s.distance = l.distance;
        s.decay = l.decay;
      }
    },
    clear,
    dispose() {
      clear();
      for (const s of slots) s.removeFromParent();
    },
  };
}
