// The damage a battle does to its ships, drawn (battleScene.js and its node
// twin put it in, battleDebris.js flings the pieces): a capital's subsystem
// or battery shot off is the very piece of its model torn away
// (galaxy/capitalParts.js), tumbling off on the blast with a fire on it,
// and the hull it stood on left burning; heavy hits scorch the hull and
// burn a while; a capital worn down burns in more places the lower its hull
// gets; one that goes breaks in its three sections, each drifting and
// rolling off its own way, burning along the breaks; and everything that
// goes up throws shrapnel. Every fire on a ship rides it (fires' `follow`):
// the fleet's push and a set piece's ram carry its wounds with it.
//
// createDamage(parent, { fires, flashes, debris, models }) → { sub(cap, slot,
//   id, at, r), battery(cap, slot, index, at), hit(cap, slot, at, size),
//   worn(cap, slot), breakUp(cap, slot) → whether it broke, burst(at, size,
//   n), update(dt), clear() }
// `slot`: galaxy/models.js's (its `parts` where it's the cut); `at` in the
// parent's space; `r` a part's size in the same units.

import * as THREE from 'three';

// how hard a part is thrown off its hull: a share of its ship's length a second
const THROW = 0.012;
// how many short-lived scorches a ship carries at once, and how long each burns
const SCORCHES = 4;
const SCORCH = [6, 11];
// the shares of its hull at which a capital takes another fire that stays
const WORN = [0.66, 0.4, 0.2];
// the sections' middles, shares of the length (capitalParts.js's SECTIONS split it)
const MIDDLES = [-0.33, 0, 0.33];
const BREAKS = [-0.17, 0.17];

export function createDamage(parent, { fires, flashes, debris, models = null }) {
  const local = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  const tmp = new THREE.Vector3();
  const pt = new THREE.Vector3();
  const scorched = new WeakMap(); // a ship → its short-lived fires
  const wornTo = new WeakMap(); // a ship → how many of WORN it has passed
  const later = []; // explosions to come: { in, at, size, color }

  // `at` (the parent's space) in a slot's own frame, to burn on it
  const onSlot = (slot, at) => {
    slot.holder.updateMatrix();
    inv.copy(slot.holder.matrix).invert();
    return local.set(at.x, at.y, at.z).applyMatrix4(inv).clone();
  };
  // a point on a ship's hull: one of its spheres' surfaces (battle.js's), squashed to its height
  const onHull = (cap, out) => {
    const sp = cap.spheres[Math.floor(Math.random() * cap.spheres.length)];
    tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    return out.set(sp.c.x + tmp.x * sp.r * 0.7, sp.c.y + tmp.y * sp.r * 0.35, sp.c.z + tmp.z * sp.r * 0.7);
  };
  // a ship's direction out from its middle through `at`, with its up in it
  const outward = (cap, at, out) => {
    out.set(at.x - cap.pos.x, at.y - cap.pos.y, at.z - cap.pos.z);
    if (out.lengthSq() < 1e-6) out.set(cap.up.x, cap.up.y, cap.up.z);
    out.normalize();
    return out.add(tmp.set(cap.up.x, cap.up.y, cap.up.z).multiplyScalar(Math.sign(out.dot(tmp)) * 0.6)).normalize();
  };
  const burst = (at, size, n = 8) => debris.burst(at, { n, speed: Math.max(2, size * 6), size: Math.max(0.05, size * 0.22) });
  // a few blasts after the first, round where it was (a part doesn't go in one)
  const echo = (at, size, n, over = 1.2) => {
    for (let i = 0; i < n; i++) later.push({ in: (over * (i + 1)) / n, at: { x: at.x + (Math.random() - 0.5) * size, y: at.y + (Math.random() - 0.5) * size, z: at.z + (Math.random() - 0.5) * size }, size: size * (0.4 + Math.random() * 0.5) });
  };

  // a piece of the ship torn off and flung, burning, and the hull it stood on left burning
  const tear = (cap, slot, id, at, r) => {
    slot.gone?.add(id);
    const meshes = slot.parts?.knock(id) ?? null;
    if (meshes?.length) {
      const vel = outward(cap, at, new THREE.Vector3()).multiplyScalar(cap.size * THROW * (0.8 + Math.random() * 0.5));
      const g = debris.fling(meshes, { at, vel, spin: 0.15 + Math.random() * 0.25, life: 45 });
      fires.add({ x: 0, y: 0, z: 0 }, r * 0.7, { follow: g, life: 20 });
    }
    fires.add(onSlot(slot, at), r * 0.9, { follow: slot.holder });
    burst(at, r, meshes?.length ? 16 : 10);
    echo(at, r * 1.5, 3);
  };

  return {
    // an objective shot off (its part's id: capitalParts.js's, the sub's own)
    sub(cap, slot, id, at, r) {
      tear(cap, slot, id, at, r);
    },
    // one of its batteries
    battery(cap, slot, index, at) {
      tear(cap, slot, `battery-${index}`, at, Math.max(0.4, cap.size * 0.012));
    },
    // a heavy hit on its hull (a torpedo's, a turbolaser's): scorched, burning a while
    hit(cap, slot, at, size) {
      burst(at, size * 0.4, 3);
      const list = scorched.get(cap) ?? [];
      scorched.set(cap, list);
      for (let i = list.length - 1; i >= 0; i--) if (list[i].life <= 0) list.splice(i, 1);
      if (list.length >= SCORCHES) return;
      list.push(fires.add(onSlot(slot, at), size * 0.35, { follow: slot.holder, life: SCORCH[0] + Math.random() * (SCORCH[1] - SCORCH[0]) }));
    },
    // its hull worn down past another of WORN: another fire that stays
    worn(cap, slot) {
      const share = cap.hullMax ? cap.hull / cap.hullMax : 1;
      let n = wornTo.get(cap) ?? 0;
      while (n < WORN.length && share < WORN[n]) {
        n += 1;
        const at = onHull(cap, pt);
        fires.add(onSlot(slot, at), cap.size * 0.03, { follow: slot.holder });
        burst(at, cap.size * 0.02, 6);
      }
      wornTo.set(cap, n);
    },
    // gone: its three sections drifting apart, burning along the breaks
    // (false where its model isn't the cut, or not here: the scene's own then)
    breakUp(cap, slot) {
      if (!slot.parts && models?.withParts) models.withParts(slot);
      const sections = slot.parts?.sections();
      if (!sections?.some((s) => s.length)) return false;
      slot.holder.updateMatrixWorld(true);
      const fwd = new THREE.Vector3(cap.fwd.x, cap.fwd.y, cap.fwd.z);
      const up = new THREE.Vector3(cap.up.x, cap.up.y, cap.up.z);
      // (what's left on it of its parts goes with the middle)
      const loose = slot.parts.ids.filter((id) => slot.parts.has(id)).flatMap((id) => slot.parts.knock(id) ?? []);
      const groups = sections.map((meshes, i) => {
        const all = i === 1 ? [...meshes, ...loose] : meshes;
        if (!all.length) return null;
        const mid = new THREE.Vector3(0, 0, MIDDLES[i] * slot.size);
        slot.holder.localToWorld(mid);
        parent.worldToLocal(mid);
        const away = i - 1; // (the stern back, the bow on, the middle sinking)
        const vel = fwd.clone().multiplyScalar(away * cap.size * 0.01).addScaledVector(up, (i === 1 ? -1 : 0.5) * cap.size * 0.004);
        return debris.fling(all, { at: mid, vel, spin: 0.02 + Math.random() * 0.03, life: 90 });
      });
      slot.holder.visible = false;
      fires.unfollow(slot.holder);
      // fire along each break, on both sides of it, and the blast through the middle
      BREAKS.forEach((z, b) => {
        for (const i of [b, b + 1]) {
          const g = groups[i];
          if (!g) continue;
          const off = fwd.clone().multiplyScalar((z - MIDDLES[i]) * slot.size);
          for (let n = 0; n < 2; n++) fires.add({ x: off.x + (Math.random() - 0.5) * cap.size * 0.08, y: off.y + (Math.random() - 0.5) * cap.size * 0.03, z: off.z + (Math.random() - 0.5) * cap.size * 0.08 }, cap.size * 0.05, { follow: g, life: 70 });
        }
      });
      flashes.at(pt.set(cap.pos.x, cap.pos.y, cap.pos.z), { size: Math.min(cap.size * 0.45, 24), life: 2.6, color: [2.8, 1.4, 0.5] });
      for (const z of BREAKS) {
        const at = fwd.clone().multiplyScalar(z * cap.size).add(pt.set(cap.pos.x, cap.pos.y, cap.pos.z));
        burst(at, cap.size * 0.05, 24);
        echo(at, cap.size * 0.12, 4, 2);
      }
      return true;
    },
    burst,
    update(dt) {
      for (let i = later.length - 1; i >= 0; i--) {
        const e = later[i];
        e.in -= dt;
        if (e.in > 0) continue;
        flashes.at(pt.set(e.at.x, e.at.y, e.at.z), { size: e.size, life: 0.7 + Math.random() * 0.5, color: [2.8, 1.5, 0.55] });
        later.splice(i, 1);
      }
    },
    clear() {
      later.length = 0;
    },
  };
}
