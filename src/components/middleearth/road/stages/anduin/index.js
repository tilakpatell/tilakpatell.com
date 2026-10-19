// The Anduin (the plan’s Task 26, on Hobbiton’s recipe): the three boats
// on the Great River between walls of rock, the Argonath rising over them;
// the lake opening out under Tol Brandir with Rauros roaring; ashore on the
// lawn of Parth Galen and up to the Seat of Seeing, where the vision takes
// Frodo across the sky (Orthanc, Edoras, the White City, the Dark Tower and
// the Eye on it); the horn, the Uruks through the trees; and the breaking:
// Frodo to a boat, Sam after him, the two across to the east bank. This file
// only draws, each beat’s scene a function of where the walker is (`local`)
// and how long since the beat began (`since[id]`), so walking back puts it
// back.
//
//   build(ctx) → { group, update(local, dt, { since }), floor(x, z), pose(id, at), dispose }
//   ctx: { road, heightAt, land, rt, weather, tier }

import * as THREE from 'three';
import { walker } from '../../cast';
import { createTownKit } from '../../townKit';
import { addLorien } from '../../lorienKit';
import { modeAt, stageById } from '../index';
import { waterOn } from '../parts';
import { createBoats } from '../boats';
import { SEAT, buildProps } from './props';
import { BEATS } from './beats';

const MARKS = Object.fromEntries(BEATS.map((b) => [b.id, b]));
const STAGE = stageById('anduin');
const VISION = [2, 4, 10, 12]; // s into the Seat’s beat: the pictures coming, all there, going, gone
const URUKS = [[-30, 128], [-34, 134], [-27, 140], [-36, 124]]; // where they break out of the trees, running at the road

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
const live = (t) => t != null && Number.isFinite(t);

export function build({ road, heightAt, land, rt, weather, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'stage:anduin';
  const renderer = rt?.gfx?.renderer ?? null;
  const town = createTownKit(road, renderer, { wild: true });
  const lorien = addLorien(town, road, renderer);
  // Amon Hen’s few of its own: moss, the woods’ leaves and trees (its stone is the town kit’s wild stone)
  const own = [];
  const M = (o) => {
    const m = road.material(o);
    own.push(m);
    return m;
  };
  Object.assign(town.K.mats, {
    moss: M({ vertexColors: true, color: 0x8aa04a }),
    leaves: M({ vertexColors: true, side: THREE.DoubleSide }),
    tree: M({ vertexColors: true }),
    statue: town.K.mats.ruin,
    stone: town.K.mats.rock,
  });
  const river = land ? waterOn(land, 0) : () => null;
  const props = buildProps({ K: town.K, road, heightAt, level: river, tier });
  group.add(props.group);
  const boats = createBoats(props.boats, river, { moorings: [[16, 101], [18, 105], [16, 109]] });

  // the Uruks out of the woods at the horn (on low, two)
  const uruks = URUKS.slice(0, tier === 'low' ? 2 : 4).map(([x, z], i) => {
    const w = walker('uruk', { rt, seed: 140 + i });
    w.group.visible = false;
    group.add(w.group);
    return { w, x, z };
  });
  let mist = null;
  let clock = 0;
  const seen = { since: {}, local: 0 };

  return {
    group,
    update(local, dt, { since = {} } = {}) {
      seen.since = since;
      seen.local = local;
      clock += dt;
      lorien.tick(clock);
      props.eye.tick(clock);
      boats.update(modeAt(STAGE, local) === 'boat');
      // the vision from the Seat: the four pictures come into the western sky, and go
      const s = since.seat;
      const v = s == null ? 0 : s === Infinity ? VISION[3] + 1 : s;
      const k = smooth((v - VISION[0]) / (VISION[1] - VISION[0])) * (1 - smooth((v - VISION[2]) / (VISION[3] - VISION[2])));
      props.vision.visible = k > 0.01;
      props.vision.children.forEach((c, i) => c.scale.setScalar(Math.max(0.01, smooth(k * 1.4 - i * 0.1))));
      props.eye.set(k);
      // the horn: the Uruks running down through the trees at the road
      const h = since.horn;
      const running = live(h) && h < 18 && local < MARKS.breaking.at + 4;
      for (const [i, u] of uruks.entries()) {
        u.w.group.visible = running;
        if (!running) continue;
        const k2 = smooth((h - i * 0.5) / 9);
        const x = u.x + (-3 - u.x) * k2;
        u.w.group.position.set(x, heightAt(x, u.z), u.z);
        u.w.group.rotation.y = Math.PI / 2;
        u.w.set({ base: null, speed: k2 < 1 ? 4.5 : 0 });
        u.w.tick(dt);
      }
      // spray off the river under the Kings and on the lake, not on low
      if (tier !== 'low' && local < 100) {
        if (!mist) {
          mist = weather?.kind?.('spray', { count: 60, box: [20, 1, 20] }) ?? null;
          mist?.at(6, (river(0, 80) ?? 0) + 0.4, 84);
        }
      } else if (mist) {
        mist.stop();
        mist = null;
      }
    },
    // on the water while afloat
    floor(x, z) {
      return boats.floor(x, z);
    },
    // Frodo on the Seat while its beat holds; each walker’s place for the boats
    pose(id, at) {
      boats.seat(id, at);
      const t = seen.since.seat;
      if (id === 'frodo' && live(t) && t < MARKS.seat.hold && Math.abs(seen.local - MARKS.seat.at) < 0.5) {
        const p = props.seat.sit;
        return { x: SEAT.at[0] + p.x, y: heightAt(...SEAT.at) + p.y - 0.5, z: SEAT.at[1] + p.z, yaw: -Math.PI / 2, base: 'sit.idle', speed: 0 };
      }
      return null;
    },
    dispose() {
      mist?.stop();
      for (const u of uruks) u.w.dispose();
      props.dispose();
      for (const m of own) m.dispose();
      lorien.dispose();
      town.dispose();
      group.removeFromParent();
    },
  };
}
