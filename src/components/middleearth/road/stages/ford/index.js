// The Ford (the plan’s Task 21, on Hobbiton’s recipe): the three trolls in
// stone in their clearing, the Last Bridge over the Hoarwell, Arwen out of
// the trees on Asfaloth, the ride (Frodo behind her on the white horse, the
// rest left behind, the Nine gaining through the wood), and the Ford:
// across, the Nine at the water, the Bruinen rising in horses of foam and
// taking them. This file only draws, each beat’s scene a function of where
// the walker is (`local`) and how long since the beat began (`since[id]`),
// so walking back puts it back.
//
//   build(ctx) → { group, update(local, dt, { since, speed }), floor(x, z), pose(id, at), dispose }
//   ctx: { road, heightAt, waters, rt, weather, tier }

import * as THREE from 'three';
import { walker } from '../../cast';
import { createHorse } from '../../creatures/horse';
import { createNazgulKit } from '../../creatures/nazgul';
import { BRIDGE, FORD, TROLLS, buildProps } from './props';
import { BEATS } from './beats';

const MARKS = Object.fromEntries(BEATS.map((b) => [b.id, b]));
const RIDE = MARKS.ride.at; // m: Frodo up behind Arwen from here
const ARWEN = { from: [24, 60], seconds: 4 }; // out of the trees, to the line
const SEAT = 1.3; // m over the ground a rider sits on a 1.75 m horse
const LEFT = new Set(['sam', 'merry', 'pippin', 'aragorn']); // left behind at the ride
const NINE = { far: 42, near: 12 }; // m behind the walker: at the ride’s start, at its end
const FLOOD = { in: 6.5, rise: 8, top: 10, swept: 9.5, gone: 14, ebb: 40 }; // seconds into the Ford’s beat

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

export function build({ road, heightAt, waters = [], rt, weather, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'stage:ford';
  const material = road.material({ vertexColors: true, flatShading: true });
  const props = buildProps({ material, heightAt });
  group.add(props.group);
  const bruinen = waters[1] ?? null;

  // Bilbo’s trolls, in stone: three orc figures at troll size, each held in a pose
  const stone = road.material({ color: 0x8e8574, flatShading: true });
  const trolls = TROLLS.map(([x, z, yaw], i) => {
    const t = walker('orc', { rt, seed: 70 + i, height: 4.4 });
    t.group.position.set(x, heightAt(x, z) - 0.1, z);
    t.group.rotation.y = yaw;
    t.set({ base: ['kneel.fix', 'idle', 'sit.ground'][i], speed: 0 });
    // (the body turned to stone; the ink line round it kept)
    t.ready?.then?.(() => t.group.traverse((o) => o.isMesh && !o.userData.ink && (o.material = stone)));
    group.add(t.group);
    return { t, posed: 0 };
  });

  const asfaloth = createHorse(rt, { coat: 'white', height: 1.75, seed: 9 });
  asfaloth.group.visible = false;
  group.add(asfaloth.group);
  const kit = createNazgulKit(rt, road);
  const nine = Array.from({ length: tier === 'low' ? 5 : 9 }, (_, i) => {
    const r = kit.rider({ mounted: true, seed: 40 + i });
    r.group.visible = false;
    group.add(r.group);
    return r;
  });

  let spray = null;
  const horse = { x: 0, y: 0, z: 0, on: false };
  const seen = { since: {}, local: 0 };

  return {
    group,
    update(local, dt, { since = {}, speed = 0 } = {}) {
      seen.since = since;
      seen.local = local;
      // the trolls: each held a moment into its clip, then still as stone
      for (const tr of trolls) {
        if (tr.posed < 0.6) {
          tr.t.tick(dt);
          tr.posed += dt;
        }
      }

      // Asfaloth: out of the trees, then beside the line, then under the two riders
      const a = since.arwen;
      horse.on = a != null;
      asfaloth.group.visible = horse.on;
      if (horse.on) {
        let gait = speed;
        if (Number.isFinite(a) && a < ARWEN.seconds && local < RIDE) {
          const k = smooth(a / ARWEN.seconds);
          horse.x = ARWEN.from[0] + (1.6 - ARWEN.from[0]) * k;
          horse.z = ARWEN.from[1] + (MARKS.arwen.at + 3 - ARWEN.from[1]) * k;
          gait = k < 1 ? 7 : 0;
          asfaloth.group.rotation.y = Math.atan2(1.6 - ARWEN.from[0], MARKS.arwen.at + 3 - ARWEN.from[1]) * (1 - k);
        } else if (local < RIDE) {
          horse.x = 1.6;
          horse.z = local + 3;
          asfaloth.group.rotation.y = 0;
        } else {
          horse.x = 0;
          horse.z = local + 0.4;
          asfaloth.group.rotation.y = 0;
        }
        horse.y = heightAt(horse.x, horse.z);
        if (horse.z > BRIDGE.z[0] && horse.z < BRIDGE.z[1]) horse.y = props.deck;
        asfaloth.group.position.set(horse.x, horse.y, horse.z);
        asfaloth.set({ speed: gait });
        asfaloth.tick(dt);
      }

      // the Nine: through the wood behind the ride, then at the water, then gone in it
      const f = since.ford;
      const riding = local >= RIDE && f == null;
      const fording = f != null && Number.isFinite(f) && f < FLOOD.gone;
      nine.forEach((r, i) => {
        r.group.visible = riding || fording;
        if (!r.group.visible) return;
        const lane = (i - (nine.length - 1) / 2) * 2.3;
        let x = lane;
        let z;
        let y;
        let gait = speed;
        if (riding) {
          const k = Math.min(1, (local - RIDE) / (MARKS.ford.at - RIDE));
          z = local - (NINE.far + (NINE.near - NINE.far) * k) - Math.abs(lane) * 0.8;
          y = heightAt(x, z);
        } else {
          // (to the near bank, a pause, into the water, then the flood takes them downstream)
          const bank = FORD.z - 13 - Math.abs(lane) * 0.4;
          const k = smooth(f / 2.5);
          z = bank - 20 * (1 - k) + smooth((f - FLOOD.in) / 1.5) * 5;
          gait = k < 1 ? 7 : f > FLOOD.in && f < FLOOD.in + 1.5 ? 1.5 : 0;
          const swept = Math.max(0, f - FLOOD.swept);
          x = lane + swept * swept * 2.2;
          y = heightAt(x, z) - swept * 0.6;
          r.set({ yaw: f > FLOOD.rise ? 0.4 : 0, pitch: 0.2 });
        }
        r.group.position.set(x, y, z);
        r.group.rotation.y = 0;
        r.set({ speed: gait });
        r.tick(dt);
      });

      // the Bruinen rises at the Nine: the ridge of the water and its manes of spray
      const rise = f == null || !Number.isFinite(f) ? 0 : smooth((f - FLOOD.rise) / (FLOOD.top - FLOOD.rise)) * (1 - 0.8 * smooth((f - FLOOD.gone) / (FLOOD.ebb - FLOOD.gone)));
      if (bruinen?.uniforms?.uRise) bruinen.uniforms.uRise.value = rise;
      if (rise > 0.3 && !spray) {
        spray = weather?.kind?.('spray', { count: 400, box: [36, 0.5, 8] }) ?? null;
        spray?.at(0, heightAt(0, FORD.z) + 1.8, FORD.z - 2);
      } else if (rise < 0.25 && spray) {
        spray.stop();
        spray = null;
      }
    },
    // the bridge carries the walkers over the Hoarwell
    floor(x, z) {
      return Math.abs(x) <= BRIDGE.w / 2 && z >= BRIDGE.z[0] && z <= BRIDGE.z[1] ? props.deck : null;
    },
    // Arwen on Asfaloth; Frodo up behind her from the ride, on foot till then;
    // the rest left behind
    pose(id, at) {
      if (id === 'arwen' && horse.on) return { x: horse.x, y: horse.y + SEAT, z: horse.z + 0.25 };
      if (id === 'frodo' && seen.local >= RIDE && horse.on) return { x: horse.x, y: horse.y + SEAT - 0.05, z: horse.z - 0.4 };
      if (id === 'frodo' && at.state === 'riding') return { base: null };
      if (LEFT.has(id) && seen.local >= RIDE) return { hide: true };
      return null;
    },
    dispose() {
      spray?.stop();
      if (bruinen?.uniforms?.uRise) bruinen.uniforms.uRise.value = 0;
      props.dispose();
      for (const tr of trolls) tr.t.dispose();
      asfaloth.dispose();
      kit.dispose();
      stone.dispose();
      material.dispose();
      group.removeFromParent();
    },
  };
}
