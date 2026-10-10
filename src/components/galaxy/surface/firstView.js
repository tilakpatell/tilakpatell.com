// Your own eyes on the surface (lib/three/firstPerson.js): P puts the camera
// in a 2017 figure's head and back out over its shoulder. Seen from there
// the body is drawn whole, its head and hair hidden where they are parts of
// their own, and its arms take the game's first-person poses for the gun it
// holds (walrusSets/firstPerson.js, the `1p` pack, fetched the first time):
// at ease, sprinting, down the sights. Not on a phone, nor on a ride or in a
// seat: there it stays behind you (Review Focus 4). Wiring beside scene.js,
// kept apart so that file doesn't grow. (lane C's camera stack, when it is
// on main, takes this as its first-person pose.)
//
// createFirstView({ camera, phone }) → {
//   on (seeing out of the figure now),
//   toggle(fig, { seated }) → on: in, if it may; else out
//   leave(fig): back over the shoulder (a swap, a ride, a fall)
//   place(fig, yaw, pitch) → whether it put the camera (call after the
//     shoulder camera; on, it overrides it)
//   pose(fig, { gun, ads, sprint }): the arms' pose for the gun's class }

import * as THREE from 'three';
import { canFirstPerson, eyeOf, hideHead } from '../../../lib/three/firstPerson';
import { fpClip } from '../../../lib/three/walrusSets/firstPerson';
import { stanceFor, weaponClassOf } from '../../../lib/three/walrusSets/stance';

const _fwd = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _look = new THREE.Vector3();

export function createFirstView({ camera, phone = false }) {
  const st = { on: false, fig: null, unhide: null, posed: null };
  const leave = (fig = st.fig) => {
    if (!st.on) return;
    st.unhide?.();
    if (st.posed) fig?.anim?.stop?.('upper');
    Object.assign(st, { on: false, fig: null, unhide: null, posed: null });
  };
  return {
    get on() {
      return st.on;
    },
    toggle(fig, { seated = false } = {}) {
      if (st.on) {
        leave(fig);
        return false;
      }
      if (!canFirstPerson(fig, { phone, seated })) return false;
      Object.assign(st, { on: true, fig, unhide: hideHead(fig), posed: null });
      fig.takePack?.('1p');
      return true;
    },
    leave,
    place(fig, yaw, pitch) {
      if (!st.on || fig !== st.fig) return false;
      _fwd.set(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      if (!eyeOf(fig, _fwd.clone().setY(0).normalize(), _eye)) return false;
      camera.position.copy(_eye);
      camera.lookAt(_look.copy(_eye).add(_fwd));
      return true;
    },
    pose(fig, { gun = null, ads = false, sprint = false } = {}) {
      if (!st.on || fig !== st.fig || !fig.anim) return;
      const key = stanceFor(weaponClassOf(gun));
      const want = key === 'humanoid' ? null : fpClip(fig.clips, key, ads ? 'aim' : sprint ? 'sprint' : 'idle');
      if (want === st.posed) return;
      if (want) fig.anim.play(want, { layer: 'upper', hold: true, fade: 0.15 });
      else fig.anim.stop('upper', 0.15);
      st.posed = want;
    },
  };
}
