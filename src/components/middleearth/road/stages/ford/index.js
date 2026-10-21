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
import { createHorse } from '../../creatures/horse';
import { createTownKit } from '../../townKit';
import { deadTree, fallenTree, pineGeo, trolls as buildTrolls } from '../../../towns/weathertop/trollshaws';
import { rngOf } from '../../scatter';
import { createNazgulKit } from '../../creatures/nazgul';
import { BRIDGE, FORD, buildProps } from './props';
import { BEATS } from './beats';

const MARKS = Object.fromEntries(BEATS.map((b) => [b.id, b]));
const RIDE = MARKS.ride.at; // m: Frodo up behind Arwen from here
const ARWEN = { from: [24, 60], seconds: 4 }; // out of the trees, to the line
const SEAT = 1.3; // m over the ground a rider sits on a 1.75 m horse
const LEFT = new Set(['sam', 'merry', 'pippin', 'aragorn']); // left behind at the ride
const NINE = { far: 42, near: 12 }; // m behind the walker: at the ride’s start, at its end
const FLOOD = { in: 6.5, rise: 8, top: 10, swept: 9.5, gone: 14, ebb: 40 }; // seconds into the Ford’s beat
const FOAM = { n: 7, run: 9, from: -46, speed: 11 }; // the horses of foam: how many, their seconds, where they start downstream of, m/s
const CLEARING = [9.5, 40, -0.6]; // the trolls’ clearing: x, z, the three turned to the road
const WOOD = [[-7, 18, 'dead', 2], [8.5, 66, 'fallen', 3], [-9, 104, 'dead', 5], [7, 132, 'fallen', 6]]; // x, z, which, seed: by the road through the Trollshaws

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

export function build({ road, heightAt, waters = [], rt, weather, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'stage:ford';
  const material = road.material({ vertexColors: true, flatShading: true });
  const town = createTownKit(road, rt?.gfx?.renderer ?? null, { wild: true });
  const props = buildProps({ material, heightAt });
  group.add(props.group);
  const bruinen = waters[1] ?? null;

  // Bilbo’s trolls, in stone, as the Weathertop chapter carved them (a nest on Tom’s head)
  const trolls = buildTrolls(town.K);
  trolls.group.position.set(CLEARING[0], heightAt(CLEARING[0], CLEARING[1]) - 0.1, CLEARING[1]);
  trolls.group.rotation.y = CLEARING[2];
  trolls.group.scale.setScalar(1.05);
  group.add(trolls.group);
  // the Trollshaws’ own pines, as the Weathertop chapter grows them, either
  // side of the road, out of the rivers and the trolls’ clearing
  const woods = [];
  {
    const rng = rngOf(15);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const open = (x, z) => Math.abs(z - (BRIDGE.z[0] + BRIDGE.z[1]) / 2) < 10 || Math.abs(z - FORD.z) < 14 || Math.hypot(x - CLEARING[0], z - CLEARING[1]) < 8;
    // (its birches, balls on sticks, are the nature kit's now: stages/tables.js)
    for (const [geo, n] of [[pineGeo(9), tier === 'low' ? 8 : 16]]) {
      const mesh = new THREE.InstancedMesh(geo, town.mats.tree, n);
      for (let i = 0; i < n; i++) {
        let x;
        let z;
        do {
          x = (rng() < 0.5 ? -1 : 1) * (7 + rng() * 34);
          z = rng() * 200;
        } while (open(x, z));
        const s = 0.55 + rng() * 0.35;
        mesh.setMatrixAt(i, m.compose(new THREE.Vector3(x, heightAt(x, z) - 0.1, z), q.setFromAxisAngle(up, rng() * 6.28), new THREE.Vector3(s, s, s)));
      }
      mesh.castShadow = true;
      group.add(mesh);
      woods.push(mesh);
    }
  }
  // dead and fallen trees by the road through the wood
  const trees = [];
  for (const [x, z, which, seed] of WOOD) {
    const t = which === 'dead' ? deadTree(town.K, seed) : fallenTree(town.K, seed);
    t.group.position.set(x, heightAt(x, z), z);
    t.group.rotation.y = seed;
    t.group.scale.setScalar(0.8);
    group.add(t.group);
    trees.push(t);
  }

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

  // the horses of foam the river rises in: white horses, glowing a little, running down the flood
  const foam = Array.from({ length: tier === 'low' ? 3 : FOAM.n }, (_, i) => {
    const h = createHorse(rt, { coat: 'white', height: 1.9 + (i % 3) * 0.25, seed: 60 + i });
    h.group.visible = false;
    h.ready?.then?.(() =>
      h.group.traverse((o) => {
        if (!o.isMesh) return;
        o.material.transparent = true;
        o.material.opacity = 0.78;
        if (o.material.emissive) o.material.emissive.setRGB(0.55, 0.65, 0.72);
      }),
    );
    group.add(h.group);
    return h;
  });
  let spray = null;
  const horse = { x: 0, y: 0, z: 0, on: false };
  const seen = { since: {}, local: 0 };

  return {
    group,
    update(local, dt, { since = {}, speed = 0 } = {}) {
      seen.since = since;
      seen.local = local;

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
      // the horses of foam, downstream to up along the ridge, rising and falling as they run
      const run = f != null && Number.isFinite(f) ? f - FLOOD.rise + 0.4 : -1;
      foam.forEach((h, i) => {
        const on = run >= 0 && run < FOAM.run;
        h.group.visible = on;
        if (!on) return;
        const x = FOAM.from + (i - foam.length / 2) * 3.4 + run * FOAM.speed;
        const z = FORD.z - 2 + Math.sin(i * 2.1) * 3;
        const y = heightAt(0, FORD.z) + 0.6 + rise * 1.6 + Math.abs(Math.sin(run * 4 + i)) * 0.5;
        h.group.position.set(x, y, z);
        h.group.rotation.y = Math.PI / 2;
        h.set({ speed: 9 });
        h.tick(dt);
      });
      if (rise > 0.3 && !spray) {
        spray = weather?.kind?.('spray', { count: 400, box: [36, 0.5, 8] }) ?? null;
        spray?.at(0, heightAt(0, FORD.z) + 1.8, FORD.z - 2);
      } else if (rise < 0.25 && spray) {
        spray.stop();
        spray = null;
      }
    },
    // walked out of: the Bruinen back in its bed, the spray and the foam gone
    leave() {
      if (bruinen?.uniforms?.uRise) bruinen.uniforms.uRise.value = 0;
      spray?.stop();
      spray = null;
      for (const h of foam) h.group.visible = false;
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
      trolls.group.traverse((o) => o.geometry?.dispose());
      for (const t of trees) t.group.traverse((o) => o.geometry?.dispose());
      for (const w of woods) w.geometry.dispose();
      asfaloth.dispose();
      for (const h of foam) h.dispose();
      kit.dispose();
      town.dispose();
      material.dispose();
      group.removeFromParent();
    },
  };
}
