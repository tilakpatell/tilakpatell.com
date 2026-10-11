// A soldier's class weapon in hand: the game's own third-person mesh (its
// light cut, public/models/galaxy/surface/<id>.lod1.glb, imported with the
// game's origin: the grip at Wep_Root, the barrel along +z) hung at the
// body's Wep_Root in the weapon frame (walrusRig.js's WEAPON_FRAME: the
// identity, the game modelling its guns in that socket's frame), with a
// `muzzle` node where the weapon's record puts the muzzle bone
// (src/data/bf2017/held.json). Not the body's own Wep_Muzzle: that bone
// holds the weapon skeleton's shared rest, 0.28 m past the E-11's barrel,
// and a few clips key it.
//
//   weaponUrl(id) → the light cut's URL
//   heldOf(id, rows) → { id, url, muzzle, flash, stance } | null (pure)
//   createHeld({ load }) → {
//     arm(fig, id) → Promise<Object3D | null>: the gun on fig.sockets.weapon
//       (one a figure: a new id swaps it, the last asked wins a race)
//     muzzleOf(fig, out) → out at the muzzle in the world, or null
//     idOf(fig), disarm(fig), dispose()
//   }

import * as THREE from 'three';
import HELD from '../../../data/bf2017/held.json';
import { cloneScene, loadGLTF } from '../../../lib/three/gltfCache.js';
import { WEAPON_FRAME } from '../../../lib/three/walrusRig.js';

export const weaponUrl = (id) => `/models/galaxy/surface/${id}.lod1.glb`;

export function heldOf(id, rows = HELD.rows) {
  const r = id ? rows[id] : null;
  if (!r?.muzzle) return null;
  return { id, url: weaponUrl(id), muzzle: r.muzzle, flash: r.flash ?? r.muzzle, stance: r.stance ?? null };
}

const scaleOf = new THREE.Vector3();

export function createHeld({ load = (url) => loadGLTF(url) } = {}) {
  const armed = new Map(); // fig → { id, gun, muzzle, ask }

  function drop(fig) {
    const a = armed.get(fig);
    a?.gun?.removeFromParent();
    return a;
  }

  return {
    async arm(fig, id) {
      const socket = fig?.sockets?.weapon;
      const row = heldOf(id);
      if (!socket || !row) return null;
      const was = armed.get(fig);
      if (was?.id === id) return was.gun ?? was.pending;
      drop(fig);
      const a = { id, gun: null, muzzle: null, pending: null };
      armed.set(fig, a);
      a.pending = Promise.resolve(load(row.url)).then((gltf) => {
        // (another weapon asked meanwhile, or the figure gone)
        if (armed.get(fig) !== a || !gltf?.scene) return null;
        const gun = cloneScene(gltf);
        gun.name = `held.${id}`;
        gun.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.frustumCulled = false;
          }
        });
        socket.updateWorldMatrix(true, false);
        const k = 1 / (socket.getWorldScale(scaleOf).x || 1);
        gun.scale.setScalar(k);
        gun.quaternion.fromArray(WEAPON_FRAME.quaternion);
        gun.position.fromArray(WEAPON_FRAME.position).multiplyScalar(k);
        const muzzle = new THREE.Object3D();
        muzzle.name = 'muzzle';
        muzzle.position.fromArray(row.muzzle);
        gun.add(muzzle);
        socket.add(gun);
        a.gun = gun;
        a.muzzle = muzzle;
        return gun;
      });
      return a.pending;
    },
    muzzleOf(fig, out) {
      const m = armed.get(fig)?.muzzle;
      if (!m?.parent) return null;
      m.updateWorldMatrix(true, false);
      return out.setFromMatrixPosition(m.matrixWorld);
    },
    idOf: (fig) => armed.get(fig)?.id ?? null,
    disarm(fig) {
      drop(fig);
      armed.delete(fig);
    },
    dispose() {
      for (const fig of armed.keys()) drop(fig);
      armed.clear();
    },
  };
}
