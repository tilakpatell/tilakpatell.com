// Cirith Ungol (the plan’s Task 29, on Hobbiton’s recipe): up the stair cut
// in the dark cliff, Gollum’s word in Frodo’s ear near the top and Sam sent
// back; into Shelob’s Lair with the Phial the one light, the webs catching
// it; Shelob out of her side passage, the sting, Frodo down; Sam with the
// light held up and she gives way and is gone; the orcs’ torches round
// Frodo and Sam alone; up to the Tower, Frodo found and sitting up; out
// between the Watchers. Shelob is the Cirith Ungol chapter’s own (towns/
// cirithungol/props.js’s shelob), the Phial its own (phial), on the Road’s kit.
// This file only draws, each beat’s scene a function of where the walker
// is (`local`) and how long since the beat began (`since[id]`), so walking
// back puts it back.
//
//   build(ctx) → { group, update(local, dt, { since }), pose(id, at), dispose }
//   ctx: { road, heightAt, rt, tier }

import * as THREE from 'three';
import { walker } from '../../cast';
import { createTownKit } from '../../townKit';
import { addCirith } from '../../cirithKit';
import { createGollum } from '../../creatures/gollum';
import { retreat } from '../../creatures/shelob.rules';
import { phial as buildPhial, shelob as buildShelob } from '../../../towns/cirithungol/props';
import { LAIR, buildProps } from './props';
import { BEATS } from './beats';

const MARKS = Object.fromEntries(BEATS.map((b) => [b.id, b]));
const STUNG = [0, 3, 5.5, 8, 13]; // s into Shelob’s beat: out of her passage, at Frodo, the sting, Sam’s light up, gone
const DOWN = [0.6, 83]; // where Frodo lies stung, [x, z]
const FOUND = [-1.5, 121]; // where Sam finds him in the Tower
const ORCS = [[2.4, 85], [-1.8, 86.5], [1.2, 80.5], [-2.2, 81.5]]; // round him with their torches
const SCALE = 0.75; // the chapter’s Shelob at the Road’s

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
const live = (t) => t != null && Number.isFinite(t);
const lerp = (a, b, k) => a + (b - a) * k;

export function build({ road, heightAt, rt, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'stage:cirith-ungol';
  const renderer = rt?.gfx?.renderer ?? null;
  const town = createTownKit(road, renderer, { wild: true });
  const cirith = addCirith(town, road, renderer);
  const props = buildProps({ K: town.K, road, heightAt, tier });
  group.add(props.group);

  const gollum = createGollum(road, renderer);
  group.add(gollum.group);
  // Shelob, in her passage until her beat
  const she = buildShelob(town.K);
  she.group.scale.setScalar(SCALE);
  she.group.visible = false;
  she.group.traverse((o) => o.isMesh && (o.frustumCulled = false));
  group.add(she.group);
  // the Phial in Frodo’s hand (then Sam’s), and its white-blue light, the lair’s only one
  const phial = buildPhial(town.K);
  phial.group.visible = false;
  group.add(phial.group);
  const light = new THREE.PointLight(0xdfe8ff, 0, 18, 1.6);
  group.add(light);
  // the orcs who take him, their torches
  const orcs = ORCS.slice(0, tier === 'low' ? 2 : 4).map(([x, z], i) => {
    const w = walker('orc', { rt, seed: 160 + i });
    w.group.visible = false;
    w.group.position.set(x, heightAt(x, z), z);
    w.group.rotation.y = Math.atan2(DOWN[0] - x, DOWN[1] - z);
    group.add(w.group);
    return w;
  });
  // on the stair, Minas Morgul’s green glow from the vale below: the night’s one light until the Phial
  const vale = new THREE.PointLight(0x7aff9a, 0, 60, 1.2);
  group.add(vale);
  const torch = new THREE.PointLight(0xff8a3a, 0, 16, 1.4);
  torch.position.set(DOWN[0], heightAt(...DOWN) + 2.2, DOWN[1]);
  group.add(torch);

  let clock = 0;
  const seen = { since: {}, local: 0 };
  const hand = new THREE.Vector3();

  return {
    group,
    update(local, dt, { since = {} } = {}) {
      seen.since = since;
      seen.local = local;
      clock += dt;
      cirith.tick(clock);

      const onStair = local < LAIR.from;
      vale.intensity = onStair ? 900 : 0;
      if (onStair) vale.position.set(14, heightAt(0, local) - 8, local + 10);

      // the Phial lit through the lair, held up by Sam against her
      const inLair = local > LAIR.from - 2 && local < LAIR.to + 2;
      const s = since.shelob;
      const st = s == null ? -1 : s === Infinity ? STUNG[4] + 1 : s;
      const up = smooth((st - STUNG[3]) / 1.2) * (1 - smooth((st - STUNG[4]) / 3));
      phial.group.visible = inLair;
      light.intensity = inLair ? 40 + 140 * up : 0;
      if (inLair) {
        phial.group.position.copy(hand).setY(hand.y + 0.8 + up * 0.8);
        light.position.copy(phial.group.position);
        phial.set(0.6 + 0.4 * up);
      }

      // Shelob: out of her passage, at Frodo, the sting; driven back by the light, and gone
      she.group.visible = st >= 0 && st < STUNG[4] + 3;
      if (she.group.visible) {
        const [sx, sz] = LAIR.side;
        const at = st < STUNG[1] ? smooth(st / STUNG[1]) : 1;
        const back = retreat(up) ? smooth((st - STUNG[3]) / 4) : 0;
        const x = lerp(sx + 4, DOWN[0] + 2.2, at) + back * 6;
        const z = lerp(sz + 2, DOWN[1] + 1.2, at) + back * 4;
        she.group.position.set(x, heightAt(x, z), z);
        she.group.rotation.y = Math.atan2(DOWN[0] - x, DOWN[1] - z) - Math.PI / 2 + back * Math.PI;
        const strike = smooth((st - STUNG[2] + 0.6) / 0.6) * (1 - smooth((st - STUNG[2] - 0.6) / 0.8));
        she.animate(clock, { rear: st > STUNG[1] && st < STUNG[3] ? 0.6 : 0, strike, recoil: up, light: up });
      }

      // the orcs round Frodo on their beat, gone with him
      const tk = since.taken;
      const taking = (live(tk) || tk === Infinity) && local < MARKS.tower.at - 4;
      // (and one of theirs left burning in the Tower where Sam finds him: the beat was black)
      const found = !taking && local >= MARKS.tower.at - 4 && local < MARKS.gate.at - 2 && st >= STUNG[2];
      torch.position.set(...(found ? [FOUND[0] + 1.4, heightAt(...FOUND) + 2.2, FOUND[1] - 0.8] : [DOWN[0], heightAt(...DOWN) + 2.2, DOWN[1]]));
      torch.intensity = taking ? 60 : found ? 36 : 0;
      for (const w of orcs) {
        w.group.visible = taking;
        if (taking) {
          w.set({ base: null, speed: 0 });
          w.tick(dt);
        }
      }
    },
    pose(id, at) {
      // Gollum by Frodo’s ear on the stair, then gone into the dark ahead of them
      if (id === 'gollum') {
        const gone = seen.local > MARKS.tunnel.at + 6;
        gollum.group.visible = !gone;
        if (!gone) gollum.at(at.x, at.y, at.z, clock, { pose: 'crawl' });
        return { hide: true };
      }
      if (id === 'frodo') hand.set(at.x + 0.2, at.y + 0.5, at.z + 0.3);
      if (id !== 'frodo') return null;
      const s = seen.since.shelob;
      const stung = (live(s) && s >= STUNG[2]) || s === Infinity;
      if (!stung || seen.local >= MARKS.gate.at - 2) return null;
      // stung: down on the stones; taken away by the orcs; found in the Tower, sitting up
      const tower = seen.local >= MARKS.tower.at - 0.5;
      if (tower) return { x: FOUND[0], y: heightAt(...FOUND), z: FOUND[1], yaw: Math.PI / 2, base: 'sit.ground', speed: 0 };
      if (seen.local > MARKS.taken.at + 4) return { hide: true };
      return { x: DOWN[0], y: heightAt(...DOWN), z: DOWN[1], yaw: Math.PI / 2, base: 'lie.down', speed: 0 };
    },
    dispose() {
      gollum.dispose();
      for (const w of orcs) w.dispose();
      she.group.removeFromParent();
      she.group.traverse((o) => o.geometry?.dispose());
      phial.group.removeFromParent();
      phial.group.traverse((o) => o.geometry?.dispose());
      props.dispose();
      cirith.dispose();
      town.dispose();
      group.removeFromParent();
    },
  };
}

