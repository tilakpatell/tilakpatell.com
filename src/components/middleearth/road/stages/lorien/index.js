// Lothlórien (the plan’s Task 25, on Hobbiton’s recipe): the Nimrodel
// under the first mallorns, Haldir out of the trees, the stair up to the
// flet round the greatest tree and the Lady and the Lord on its dais; down
// to the Mirror in its hollow, where the water darkens and the Eye looks out
// of it until her light comes; and the hythe on the Silverlode, the three
// grey boats taken and away. This file only draws, each beat’s scene a
// function of where the walker is (`local`) and how long since the beat
// began (`since[id]`), so walking back puts it back.
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
import { DAIS, MIRROR, buildProps } from './props';
import { BEATS } from './beats';

const MARKS = Object.fromEntries(BEATS.map((b) => [b.id, b]));
const STAGE = stageById('lorien');
const SILVERLODE = 1; // the land’s rivers: the Nimrodel, then the Silverlode
const EYE = [2, 5, 10, 12]; // s into the Mirror’s beat: the water darkening, the Eye full, her light, the Eye gone

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
const live = (t) => t != null && Number.isFinite(t);

export function build({ road, heightAt, land, rt, weather, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'stage:lorien';
  const renderer = rt?.gfx?.renderer ?? null;
  const town = createTownKit(road, renderer);
  const lorien = addLorien(town, road, renderer);
  const props = buildProps({ K: town.K, road, heightAt, tier });
  group.add(props.group);
  const water = land ? waterOn(land, SILVERLODE) : () => null;
  const boats = createBoats(props.boats, water, { moorings: [[3.2, 129], [-3.2, 131], [3.2, 133.5]] });

  // the elves the company meets: Haldir by the Nimrodel, the Lady and the
  // Lord on the dais, the Lady again at her Mirror
  const figures = new Map();
  const add = (key, name, x, z, yaw, y = null) => {
    const w = walker(name, { rt, seed: 120 + figures.size });
    w.group.position.set(x, y ?? heightAt(x, z), z);
    w.group.rotation.y = yaw;
    w.set({ base: 'idle', speed: 0 });
    group.add(w.group);
    figures.set(key, w);
    return w;
  };
  add('haldir', 'elf', -1.6, MARKS.haldir.at + 3.4, Math.PI);
  add('galadriel', 'galadriel', -4.4, DAIS.tree[1] + 2, Math.PI / 2, props.top + 0.32);
  add('celeborn', 'elf', -4.4, DAIS.tree[1] - 0.4, Math.PI / 2, props.top + 0.32);
  add('galadriel:mirror', 'galadriel', MIRROR.at[0] + 1.4, MIRROR.at[1] + 1.8, -Math.PI / 2);
  // her light at the Mirror, and the motes of the wood
  const light = new THREE.PointLight(0xe8f0ff, 0, 16, 1.4);
  light.position.set(MIRROR.at[0] + 1.4, heightAt(...MIRROR.at) + 2.2, MIRROR.at[1] + 1.8);
  group.add(light);
  let motes = null;
  let clock = 0;
  const seen = { since: {}, local: 0 };

  // who is shown where: each elf only near its beat (a figure is never culled)
  const SHOWN = {
    haldir: (l) => l < MARKS.climb.at,
    galadriel: (l) => l > MARKS.climb.at && l < MIRROR.at[1] - 8,
    celeborn: (l) => l > MARKS.climb.at && l < MIRROR.at[1] - 8,
    'galadriel:mirror': (l) => l > MIRROR.at[1] - 14 && l < MARKS.boats.at,
  };

  return {
    group,
    update(local, dt, { since = {} } = {}) {
      seen.since = since;
      seen.local = local;
      clock += dt;
      lorien.tick(clock);
      // evening coming on: the lanterns brightening along the stairs and the flets
      lorien.setNight(smooth((local - 70) / 70));
      for (const [k, w] of figures) {
        w.group.visible = SHOWN[k](local);
        if (w.group.visible) w.tick(dt);
      }
      // the Mirror: the water darkening, the Eye in it, then her light and it is gone
      const t = since.mirror;
      const m = t == null ? 0 : t === Infinity ? EYE[3] + 1 : t;
      const eye = smooth((m - EYE[0]) / (EYE[1] - EYE[0])) * (1 - smooth((m - EYE[2]) / (EYE[3] - EYE[2])));
      props.mirror.vision(eye, 'eye');
      props.mirror.update?.(clock);
      light.intensity = live(t) && t < MARKS.mirror.hold + 2 ? 140 * smooth((m - EYE[2] + 1) / 2) : 0;
      // the boats: tied at the hythe, then under the company on the water
      boats.update(modeAt(STAGE, local) === 'boat');
      if (local < MIRROR.at[1]) motes ??= weather?.kind?.('motes', { follow: true, count: tier === 'low' ? 40 : 90 }) ?? null;
      else if (motes) {
        motes.stop();
        motes = null;
      }
    },
    // up the stair, the flet, down again; and on the Silverlode, the boats
    floor(x, z) {
      return props.floor(x, z) ?? boats.floor(x, z);
    },
    // Frodo at the basin while the Mirror holds; and each walker’s place for the boats
    pose(id, at) {
      boats.seat(id, at);
      const t = seen.since.mirror;
      if (id === 'frodo' && t != null && Number.isFinite(t) && t < MARKS.mirror.hold && Math.abs(seen.local - MARKS.mirror.at) < 0.5)
        return { x: MIRROR.at[0] + 1.6, y: heightAt(MIRROR.at[0] + 1.6, MIRROR.at[1] - 0.4), z: MIRROR.at[1] - 0.4, yaw: -Math.PI / 2, base: 'idle', speed: 0 };
      return null;
    },
    dispose() {
      motes?.stop();
      for (const w of figures.values()) w.dispose();
      props.dispose();
      lorien.dispose();
      town.dispose();
      group.removeFromParent();
    },
  };
}
