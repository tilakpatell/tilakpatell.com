// Bree (the plan’s Task 19, on Hobbiton’s recipe): night and rain on the
// Bree chapter’s own town; the gatekeeper’s hatch opening in the West-gate
// and his lantern, then the gate swung back; Bree men under the eaves; the
// Pony’s door open on its common room’s light, Butterbur in it and a hooded
// Ranger on the bench under the eaves with his pipe; the four Riders
// through the gate at a gallop, its leaves thrown down and the crates and
// barrels in the lane knocked flying (tumble.js, on Rapier), to the hobbits’
// room and its window burst in feathers; and at grey dawn Strider off the
// bench to lead them out the back way. This file only draws, each beat’s
// scene a function of where the walker is (`local`) and how long since the
// beat began (`since[id]`), so walking back puts it back.
//
//   build(ctx) → { group, update(local, dt, { since, speed }), dispose }
//   ctx: { road, heightAt, rt, weather, tier }

import * as THREE from 'three';
import { hot } from '../../../../../lib/three/canvasTexture';
import { walker } from '../../cast';
import { createNazgulKit } from '../../creatures/nazgul';
import { createTownKit } from '../../townKit';
import { createTumble } from '../../tumble';
import { barrelParts, parts } from '../../../shire/build';
import { GATE, PONY, WING, buildProps } from './props';
import { lampPools } from '../parts';
import { BEATS } from './beats';
import { STAGES } from '../index';
import { wearParts } from '../../partsWear';

const LENGTH = STAGES.find((s) => s.id === 'bree').length;
const MARKS = Object.fromEntries(BEATS.map((b) => [b.id, b]));
const KEEPER = { hatch: [-1.4, GATE.z + 0.6], aside: [3.6, GATE.z + 2.6] }; // the gatekeeper behind his hatch, then stood aside
const GATE_T = { peep: 1, open: 4.5, swing: 2.5 }; // seconds into the gate’s beat: the hatch, the leaves
const EAVES = [[3.9, 40, -Math.PI / 2], [-3.9, 59, Math.PI / 2], [3.9, 76, -Math.PI / 2]]; // Bree men under the eaves, facing the lane
const RIDE = { from: GATE.z - 14, to: WING.z - 1.5, seconds: 7, smash: 1.4, gone: 18 }; // the Riders: from outside the gate to the room, the gate down on the way
const STRIDER_UNTIL = MARKS.dawn.at; // m: where the line takes him up
// crates and barrels by the lane where the Riders pass: knocked flying (tumble.js); x, z, crate or barrel
const IN_THE_WAY = [[1.9, 44, 'crate'], [2.1, 45.2, 'barrel'], [-2, 58, 'barrel'], [-1.8, 59.4, 'crate'], [-2.2, 60.6, 'crate'], [2, 76, 'barrel'], [1.7, 77.3, 'crate'], [-1.9, 88, 'barrel']];
const CRATE = [0.32, 0.3, 0.32]; // its half-sizes
const BARREL = { r: 0.3, h: 0.86 };

// where rider i is, t seconds into the Riders’ beat: up the lane two by two, then by the room’s window
function riderAt(i, t, heightAt, out) {
  const k = smooth((t - (i >> 1) * 0.8) / RIDE.seconds);
  const z = RIDE.from + (RIDE.to - RIDE.from) * k - (i >> 1) * 3;
  const x = k < 1 ? (i % 2 ? -1.2 : 1.2) : WING.window[0] - 2 - (i % 2) * 1.5;
  return out.set(x, heightAt(x, z), z);
}

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

export function build({ road, heightAt, rt, weather, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'stage:bree';
  const material = wearParts(road.material({ vertexColors: true, flatShading: true }), { tier });
  // the town kit on a wet night, as the Bree chapter has it (towns/bree/props.js’s createBreeKit)
  const town = createTownKit(road, rt?.gfx?.renderer ?? null);
  const { mats } = town;
  mats.timber.color.set(0x3a2818);
  mats.plaster.color.set(0xd2c4a6);
  mats.slate.color.set(0x8a92a0);
  mats.thatch.color.set(0x8c7c5c);
  mats.stone.color.set(0xb8b0a4);
  mats.ashlar.color.set(0xc8beae);
  mats.trunk.color.set(0x8a7a66);
  mats.barnwood.color.set(0x6a5644);
  mats.window.emissive = hot(0xffa448, 2.8);
  town.setNight(1);
  const props = buildProps({ K: town.K, material, heightAt });
  group.add(props.group);
  // the lamps’ light on the wet street, a warm pool under each (no light added: see the one below)
  const pools = lampPools(props.lamps, heightAt);
  group.add(pools.mesh);
  const { gate } = props;
  const leaves = gate.leaves.map((l) => ({ l, p: l.position.clone(), r: l.rotation.clone() }));

  const figures = [];
  const stand = (name, x, z, yaw, base = null) => {
    const w = walker(name, { rt, seed: 60 + figures.length });
    w.group.position.set(x, heightAt(x, z), z);
    w.group.rotation.y = yaw;
    w.set({ base, speed: 0 });
    group.add(w.group);
    figures.push(w);
    return w;
  };
  // the gatekeeper with his lantern; Bree men under the eaves (not on low)
  const keeper = stand('breeman', ...KEEPER.hatch, Math.PI, 'lantern');
  if (tier !== 'low') for (const [x, z, yaw] of EAVES) stand('breeman', x, z, yaw);
  // at the Pony: Butterbur in his doorway, the Ranger on the bench with his pipe
  const butterbur = stand('butterbur', PONY.door[0] - 0.4, PONY.door[1], Math.PI / 2, 'talk');
  const strider = stand('aragorn', PONY.bench[0], PONY.bench[1], Math.PI / 2, 'sit.idle');
  const pipeMat = road.material({ color: 0xff7a30, emissive: hot(0xff6a20, 2), emissiveIntensity: 1 });
  const pipe = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), pipeMat);
  group.add(pipe);
  // the stage’s one point light, where the story is: the gatekeeper’s lantern at
  // the West-gate, then the common room’s light out of the Pony’s door (moved,
  // never added or taken away, so the scene’s lights compile once)
  const light = new THREE.PointLight(0xffa050, 7, 12, 2);
  const AT_GATE = new THREE.Vector3(KEEPER.hatch[0], heightAt(...KEEPER.hatch) + 2.4, KEEPER.hatch[1] - 1.4);
  const AT_PONY = new THREE.Vector3(PONY.door[0] - 1.6, heightAt(...PONY.door) + 2.2, PONY.door[1]);
  group.add(light);

  // the four Riders
  const kit = createNazgulKit(rt, road);
  const riders = [0, 1, 2, 3].map((i) => {
    const r = kit.rider({ mounted: true, seed: 20 + i });
    r.group.visible = false;
    group.add(r.group);
    return r;
  });
  // the things in the Riders’ way, and the Riders as movers through them (not on low)
  const things = IN_THE_WAY.map(([x, z, kind], i) => {
    const o = new THREE.Group();
    if (kind === 'crate') {
      o.add(new THREE.Mesh(new THREE.BoxGeometry(CRATE[0] * 2, CRATE[1] * 2, CRATE[2] * 2), mats.barnwood));
    } else {
      const inner = new THREE.Group();
      inner.position.y = -BARREL.h / 2;
      const bk = parts();
      barrelParts(bk, town.K, { h: BARREL.h, r: BARREL.r });
      bk.build(inner);
      o.add(inner);
    }
    o.position.set(x, heightAt(x, z) + (kind === 'crate' ? CRATE[1] : BARREL.h / 2), z);
    o.rotation.y = i * 0.7;
    o.traverse((m) => m.isMesh && (m.castShadow = true));
    group.add(o);
    return { object: o, kind, half: kind === 'crate' ? CRATE : BARREL };
  });
  const lift = new THREE.Vector3(0, 0.9, 0);
  const tumble = createTumble({
    items: things,
    movers: [0, 1, 2, 3].map((i) => ({ half: [0.4, 0.9, 1.1], at: (tt, out) => (tt < 0.05 ? null : riderAt(i, tt, heightAt, out).add(lift)) })),
    ground: { y: heightAt(0, 70), x: [-7, 7], z: [24, 140] },
    physical: tier !== 'low',
  });
  let rain = null;
  let feathers = null;
  let t = 0;
  const at = new THREE.Vector3();
  const head = new THREE.Vector3();

  return {
    group,
    update(local, dt, { since = {} } = {}) {
      t += dt;
      // the rain on the town, while the walker is in it
      if (local >= 0 && local < LENGTH - 4) rain ??= weather?.kind?.('rain', { follow: true }) ?? null;
      else if (rain) {
        rain.stop();
        rain = null;
      }

      // the gate: shut till the beat, the hatch, then the leaves swung back; thrown down by the Riders
      const g = since.gate;
      const r = since.riders;
      const smashed = r != null && Number.isFinite(r) && r >= RIDE.smash;
      leaves.forEach(({ l, p, r: rot }) => {
        l.position.copy(p);
        l.rotation.copy(rot);
      });
      if (smashed) {
        // (the chapter’s smash, kept here as a pose so walking back sets the gate up again)
        const [left, right] = gate.leaves;
        left.rotation.set(0.08, -2.05, 0.22);
        left.position.y = -0.25;
        right.rotation.set(Math.PI / 2 - 0.1, 0.3, 0);
        right.position.set(2.4, 0.15, 0.4);
      } else gate.open(g == null ? (local > GATE.z ? 1 : 0) : Number.isFinite(g) ? smooth((g - GATE_T.open) / GATE_T.swing) : 1);
      gate.peep(g != null && Number.isFinite(g) ? smooth(g - GATE_T.peep) * (1 - smooth(g - GATE_T.open)) : 0);
      // the gatekeeper at his hatch, then aside as the leaves swing; down under the gate when it falls
      const aside = g == null ? local > GATE.z : !Number.isFinite(g) || g > GATE_T.open;
      const [kx, kz] = aside ? KEEPER.aside : KEEPER.hatch;
      keeper.group.position.set(kx, heightAt(kx, kz), kz);
      keeper.group.rotation.y = aside ? -Math.PI / 2 : Math.PI;
      keeper.set({ base: smashed ? 'lie.down' : 'lantern', speed: 0 });

      light.position.copy(local < (GATE.z + PONY.z) / 2 ? AT_GATE : AT_PONY);
      for (const f of figures) f.tick(dt);
      strider.group.visible = local < STRIDER_UNTIL;
      butterbur.group.visible = true;
      // (his pipe at his mouth, brightening as he draws on it)
      strider.group.getWorldPosition(head);
      pipe.visible = strider.group.visible;
      pipe.position.set(head.x + 0.28, head.y + 1.25, head.z + 0.05);
      pipeMat.emissiveIntensity = 0.6 + 0.6 * Math.max(0, Math.sin(t * 0.8));

      // the Riders: through the gate at a gallop, two by two, up the lane to the room’s window
      const on = r != null && Number.isFinite(r) && r < RIDE.gone;
      riders.forEach((n, i) => {
        n.group.visible = on;
        if (!on) return;
        const k = smooth((r - (i >> 1) * 0.8) / RIDE.seconds);
        n.group.position.copy(riderAt(i, r, heightAt, at));
        n.group.rotation.y = k < 1 ? 0 : Math.PI / 2;
        n.set({ speed: k < 1 ? 9 : 0, yaw: 0, pitch: k < 1 ? 0 : 0.3 });
        n.tick(dt);
      });
      // what was in their way, knocked flying as they come (a function of the beat’s time)
      tumble.update(r);
      // the beds: a burst of feathers out of the window as the blades go in
      if (on && r > RIDE.seconds + 0.8 && !feathers) {
        feathers = weather?.kind?.('snow', { count: 160, box: [1.4, 0.4, 1.6], scale: 1.6 }) ?? null;
        feathers?.at(WING.window[0] + 0.4, heightAt(WING.x, WING.z) + WING.window[1] + 0.4, WING.window[2]);
      }
      if (feathers && (!on || r > RIDE.seconds + 2.6)) {
        feathers.stop();
        if (!on) feathers = null;
      }
    },
    dispose() {
      rain?.stop();
      feathers?.stop();
      tumble.dispose();
      for (const { object } of things) object.traverse((o) => o.geometry?.dispose());
      props.dispose();
      pools.dispose();
      kit.dispose();
      for (const f of figures) f.dispose();
      pipe.geometry.dispose();
      pipeMat.dispose();
      town.dispose();
      material.dispose();
      group.removeFromParent();
    },
  };
}
