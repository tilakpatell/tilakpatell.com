// Bree (the plan’s Task 19, on Hobbiton’s recipe): night and rain on the
// Bree chapter’s own town; the gatekeeper’s hatch opening in the West-gate
// and his lantern, then the gate swung back; Bree men under the eaves; the
// Pony’s door open on its common room’s light, Butterbur in it and a hooded
// Ranger on the bench under the eaves with his pipe; the four Riders
// through the gate at a gallop, its leaves thrown down, to the hobbits’
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
import { GATE, PONY, WING, buildProps } from './props';
import { BEATS } from './beats';
import { STAGES } from '../index';

const LENGTH = STAGES.find((s) => s.id === 'bree').length;
const MARKS = Object.fromEntries(BEATS.map((b) => [b.id, b]));
const KEEPER = { hatch: [-1.4, GATE.z + 0.6], aside: [3.6, GATE.z + 2.6] }; // the gatekeeper behind his hatch, then stood aside
const GATE_T = { peep: 1, open: 4.5, swing: 2.5 }; // seconds into the gate’s beat: the hatch, the leaves
const EAVES = [[3.9, 40, -Math.PI / 2], [-3.9, 59, Math.PI / 2], [3.9, 76, -Math.PI / 2]]; // Bree men under the eaves, facing the lane
const RIDE = { from: GATE.z - 14, to: WING.z - 1.5, seconds: 7, smash: 1.4, gone: 18 }; // the Riders: from outside the gate to the room, the gate down on the way
const STRIDER_UNTIL = MARKS.dawn.at; // m: where the line takes him up

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

export function build({ road, heightAt, rt, weather, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'stage:bree';
  const material = road.material({ vertexColors: true, flatShading: true });
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
  // the common room’s light out of the open door: the stage’s one point light
  const room = new THREE.PointLight(0xffa050, 7, 12, 2);
  room.position.set(PONY.door[0] - 1.6, heightAt(...PONY.door) + 2.2, PONY.door[1]);
  group.add(room);

  // the four Riders
  const kit = createNazgulKit(rt, road);
  const riders = [0, 1, 2, 3].map((i) => {
    const r = kit.rider({ mounted: true, seed: 20 + i });
    r.group.visible = false;
    group.add(r.group);
    return r;
  });
  let rain = null;
  let feathers = null;
  let t = 0;
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
        const z = RIDE.from + (RIDE.to - RIDE.from) * k - (i >> 1) * 3;
        const x = k < 1 ? (i % 2 ? -1.2 : 1.2) : WING.window[0] - 2 - (i % 2) * 1.5;
        n.group.position.set(x, heightAt(x, z), z);
        n.group.rotation.y = k < 1 ? 0 : Math.PI / 2;
        n.set({ speed: k < 1 ? 9 : 0, yaw: 0, pitch: k < 1 ? 0 : 0.3 });
        n.tick(dt);
      });
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
      props.dispose();
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
