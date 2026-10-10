// A lit lightsaber in a figure's right hand. A figure on the 2017 game's rig
// holds it in the game's weapon socket (bladeInHand), swung in its hero's
// strokes by saber.js on the game's rules, as yours is: activity.js's
// duellists (duellists.js) fence with it. Any other figure holds it where the
// hand of a figure that tall hangs (heldBlade), the blade up and a little
// forward, held out: actors.js's standing Jedi and Sith (a life entry's
// `blade`), and a spawn off the game's rig given a blade, who hold it lit
// and never fence with it.
//
// heldBlade({ color, hilt }, tall) → { arm (add it to the figure's holder),
//   gun, owned (to dispose) }
// bladeInHand(fig, { color, hilt }, { parent, stance, who }) → { gun, gp,
//   saber, stand(dt, now, move), pose(dt, now, { forward, up, me, dir,
//   targets, hit, blocked, clash, capsules, eye }) (what its strokes may hit, as
//   saber.js's update has them; eye: the camera's position, its light out past
//   12 m of it: saberLight.js), out(dt, now, { forward, up, eye }) (in pose's
//   place, going down), swing(now, { heavy }), block(on, side), light(on), busy,
//   lit, dispose() }, or null for a figure off the game's rig or with no hand
//   bone (heldBlade's arm then).
//   fig: { model, bones?, hipsY?, after? }, in a holder already in the
//   scene; parent: where the blade's trail is drawn. Each frame, as the
//   party's are: the figure's update, stand (the body under the blade, for
//   a figure that lays its own bones after its clips), its after, then
//   pose (the arms on the hilt, the chest and head toward `dir`, the blade
//   at guard or through its stroke). Lit when it's made.

import * as THREE from 'three';
import { buildGun, createGunplay } from '../../universe/gunplay';
import { createSaber, dress } from './saber';

export function heldBlade({ color = '#ff3b3b', hilt = null } = {}, tall = 1.8) {
  const owned = [];
  const gun = buildGun('saber', owned);
  dress(gun, color, hilt);
  const blade = gun.getObjectByName('blade');
  if (blade) {
    blade.visible = true;
    blade.scale.y = 1;
  }
  const arm = new THREE.Group();
  arm.position.set(-0.19 * tall, 0.47 * tall, 0.08 * tall);
  arm.add(gun);
  gun.rotation.set(-0.35, 0, -0.2);
  // (the arm's rest: the blade up and a little forward; a duellist's swings
  // turn it from here, activity.js)
  arm.rotation.set(-0.2, 0, 0.25);
  return { arm, gun, owned };
}

const GUARD_AIM = 0.75; // how far up gunplay holds the hilt while it's lit (the party's)

export function bladeInHand(fig, { color = '#ff3b3b', hilt = null } = {}, { parent = null, stance = 'single', who = null } = {}) {
  if (!fig?.model?.getObjectByName('RightHand')?.isBone) return null;
  fig.model.updateMatrixWorld(true);
  const gp = createGunplay({ model: fig.model, bones: fig.bones, sockets: fig.sockets }, 'saber', { unit: 1, who });
  if (!gp) return null;
  // (its strokes are clips on the figure: played on its animator where it has one, the arms laid by saber.js)
  const saber = createSaber(gp, { color, hilt, stance, parent, fig, hero: who });
  if (!saber) {
    gp.dispose();
    return null;
  }
  saber.light(true);
  return {
    gun: gp.gun,
    gp,
    saber,
    get busy() {
      return saber.busy;
    },
    get lit() {
      return saber.lit;
    },
    stand: (dt, now, move = 0) => saber.stand(dt, now, move),
    pose(dt, now, { forward, up, me = null, dir = null, targets = [], hit = null, blocked = null, clash = null, capsules = null, eye = null }) {
      gp.set(dt, { aim: saber.lit ? GUARD_AIM : 0, look: dir ? 1 : 0, dir, forward, up });
      saber.update(dt, now, { forward, up, me, targets, hit, blocked, clash, capsules, eye });
    },
    // going down: put out, and the arms left to the clip it falls on (the
    // stroke it was in played out, the blade drawn back in)
    out(dt, now, { forward, up, eye = null }) {
      saber.light(false);
      saber.block(false);
      saber.update(dt, now, { forward, up, me: null, targets: [], eye });
    },
    swing: (now, opts) => saber.swing(now, opts),
    block: (on, side) => saber.block(on, side),
    light: (on) => saber.light(on),
    dark: () => saber.dark(),
    dispose() {
      saber.dispose();
      gp.dispose();
    },
  };
}
