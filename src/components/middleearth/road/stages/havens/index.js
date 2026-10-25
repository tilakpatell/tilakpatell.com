// The Grey Havens (the plan’s Task 32): the beach down into the Gulf of
// Lune at sunset, the long grey quay out over the water and the white ship
// at its end (props.js), Bilbo, Gandalf, Elrond and Galadriel waiting
// aboard her; the four hobbits walk out along the quay, and by the ship
// Frodo turns to Sam, Merry and Pippin (the deed), and goes up into her.
// She casts off and swings out onto the lane, carrying the visitor with
// those aboard, the three left small at the quay’s end, and away into the
// light. This file only draws, each beat’s scene a function of where the
// walker is (`local`) and how long since the beat began (`since[id]`), so
// walking back puts it back.
//
//   build(ctx) → { group, update(local, dt, { since }), floor(x, z), pose(id, at), dispose }
//   ctx: { road, heightAt, sky, tier }

import * as THREE from 'three';
import { createWater } from '../../water';
import { buildProps } from './props';
import { BEATS } from './beats';
import { DECK, FAREWELL, QUAY, SAIL, SHIP, STAYING, WATER, boarding, floorAt, shipAt } from './place';

const MARKS = Object.fromEntries(BEATS.map((b) => [b.id, b]));
const ABOARD = ['bilbo', 'gandalfwhite', 'elrond', 'galadriel'];
const BOARD = [MARKS.farewell.deed.at + 1.5, 5]; // s into the farewell Frodo starts up into her, and how long it takes
const BOB = 0.05; // m she rides up and down at her moorings

const live = (t) => t != null && Number.isFinite(t);
const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
const facing = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]);

export function build({ road, heightAt, sky = null, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'stage:havens';
  const props = buildProps({ road, tier });
  group.add(props.group);

  // the sea, the whole Gulf: the beach stands over it where it rises (rows
  // 5 m apart: a still sea's swell is a centimetre, and the shore's depth
  // reads as well between them on a beach this gentle)
  const water = createWater({ area: { x0: -420, z0: -40, w: 840, d: 860 }, level: WATER, kind: 'still', sky, ground: heightAt, step: 5 });
  water.set({ sun: { el: 0.08 }, ambient: 0.3 });
  group.add(water.mesh);

  let clock = 0;
  const seen = { since: {}, local: 0 };
  const ship = { x: SHIP.moor[0], z: SHIP.moor[1], y: SHIP.deck };
  // a place aboard, from her middle, in the stage's frame
  const onDeck = (id) => [ship.x + DECK[id][0], ship.z + DECK[id][1]];
  // how far Frodo is up into her (0 on the quay … 1 aboard)
  const boarded = () => {
    if (seen.local >= SAIL) return 1;
    const t = seen.since.farewell;
    if (t === Infinity) return 1;
    return live(t) ? smooth((t - BOARD[0]) / BOARD[1]) : 0;
  };

  return {
    group,
    update(local, dt, { since = {} } = {}) {
      seen.since = since;
      seen.local = local;
      clock += dt;
      water.update(dt);
      const s = shipAt(local);
      ship.x = s.x;
      ship.z = s.z;
      ship.y = SHIP.deck + Math.sin(clock * 0.9) * BOB;
      props.ship.position.set(s.x, WATER + (ship.y - SHIP.deck), s.z);
      props.ship.rotation.z = Math.sin(clock * 0.7) * 0.012;
      // (a little more wind in the sail once she's out)
      props.sail.scale.z = 1 + 0.25 * s.k + Math.sin(clock * 1.3) * 0.04;
      // (the gangway taken in as she casts off)
      props.gangway.visible = local < SAIL;
    },
    // the quay under the walkers, and her deck once she sails under them
    floor: (x, z) => floorAt(x, z, seen.local),
    pose(id) {
      // the four who sail: aboard from the start, looking back to the quay
      if (ABOARD.includes(id)) {
        const [x, z] = onDeck(id);
        return { x, y: ship.y, z, yaw: Math.PI, base: 'idle', speed: 0 };
      }
      const t = seen.since.farewell;
      const atFarewell = live(t) || t === Infinity || seen.local >= MARKS.farewell.at - 0.5;
      if (!atFarewell) return null;
      if (id === 'frodo') {
        const k = boarded();
        // (aboard: at her stern, looking back, with her as she sails)
        if (k >= 1) {
          const [x, z] = onDeck('frodo');
          return { x, y: ship.y, z, yaw: Math.PI, base: 'idle', speed: 0 };
        }
        // (turned to the three, then along the quay, up the gangway and down onto her deck)
        const [x, y, z] = boarding(k);
        const yaw = k <= 0 ? facing(FAREWELL.frodo, FAREWELL.sam) : Math.PI / 2;
        return { x, y, z, yaw, base: k > 0 ? 'walk' : 'idle', speed: k > 0 ? 1 : 0 };
      }
      const place = (seen.local >= SAIL ? STAYING : FAREWELL)[id];
      if (!place) return null;
      // (by the ship, turned to Frodo; at the quay's end, watching her go)
      const yaw = seen.local >= SAIL ? 0 : facing(place, FAREWELL.frodo);
      return { x: place[0], y: QUAY.top, z: place[1], yaw, base: 'idle', speed: 0 };
    },
    dispose() {
      water.dispose();
      props.dispose();
      group.removeFromParent();
    },
  };
}
