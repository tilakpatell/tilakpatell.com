// Bree (the plan’s Task 19, on Hobbiton’s recipe): night and rain; the
// gatekeeper at the West-gate with his lantern, Bree men under the eaves,
// the Pony’s common room through its window (Butterbur at the bar, a hooded
// Ranger in the corner with his pipe), the four Riders through the gate at
// a gallop to the hobbits’ room and its window burst in feathers, and at
// grey dawn Strider out of the corner to lead them out the back way. This
// file only draws, each beat’s scene a function of where the walker is
// (`local`) and how long since the beat began (`since[id]`).
//
//   build(ctx) → { group, update(local, dt, { since, speed }), dispose }
//   ctx: { road, heightAt, rt, weather, tier }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { walker } from '../../cast';
import { createNazgulKit } from '../../creatures/nazgul';
import { GATE, PONY, ROOM, WING, buildProps } from './props';
import { STAGES } from '../index';

const LENGTH = STAGES.find((s) => s.id === 'bree').length;
const KEEPER = [GATE.half + 1.2, GATE.z + 4.5]; // the gatekeeper at his lodge door
const EAVES = [[4.6, 40, -Math.PI / 2], [-4.6, 57, Math.PI / 2], [4.6, 76, -Math.PI / 2]]; // Bree men under the eaves, facing the lane
const RIDE = { from: GATE.z - 6, to: WING.z - 1, seconds: 7, gone: 18 }; // the Riders: from outside the gate to the room, and how long they stay
const STRIDER_UNTIL = 134; // m: the dawn’s beat, where the line takes him up

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

export function build({ road, heightAt, rt, weather, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'stage:bree';
  const material = road.material({ vertexColors: true, flatShading: true });
  const props = buildProps({ material, heightAt });
  group.add(props.group);
  const figures = [];
  const stand = (name, x, z, yaw, base = null, seed = figures.length) => {
    const w = walker(name, { rt, seed: 60 + seed });
    w.group.position.set(x, heightAt(x, z), z);
    w.group.rotation.y = yaw;
    w.set({ base, speed: 0 });
    group.add(w.group);
    figures.push(w);
    return w;
  };

  // the gatekeeper and his lantern (its light the one point light the stage keeps)
  stand('breeman', KEEPER[0], KEEPER[1], -Math.PI / 2);
  const lampMat = road.material({ color: 0xffc070, emissive: 0xffa040, emissiveIntensity: 2 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), lampMat);
  lamp.position.set(KEEPER[0] - 0.45, heightAt(...KEEPER) + 1.75, KEEPER[1] - 0.2);
  group.add(lamp);
  const lantern = new THREE.PointLight(0xffb060, 6, 9, 2);
  lantern.position.copy(lamp.position);
  group.add(lantern);
  if (tier !== 'low') for (const [x, z, yaw] of EAVES) stand('breeman', x, z, yaw);
  // in the Pony: Butterbur behind the bar, the Ranger at the corner table, his pipe
  const roomY = heightAt(PONY.x, PONY.window[2]);
  const butterbur = stand('butterbur', ROOM.x[0] + 3.3, PONY.window[2], Math.PI / 2);
  butterbur.group.position.y = roomY - 0.2;
  const strider = stand('aragorn', ROOM.x[1] - 2, ROOM.z[1] - 1.2, Math.PI, 'sit.idle');
  strider.group.position.y = roomY - 0.2;
  const pipeMat = new MeshBasicNodeMaterial({ color: 0xff7a30 });
  const pipe = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), pipeMat);
  pipe.position.set(ROOM.x[1] - 2.2, roomY + 1.2, ROOM.z[1] - 1.6);
  group.add(pipe);
  const room = new THREE.PointLight(0xffa050, 5, 10, 2);
  room.position.set(ROOM.x[0] + 4, roomY + 2.4, PONY.window[2]);
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
      for (const f of figures) if (f.group.visible) f.tick(dt);
      // (his pipe brightens as he draws on it)
      pipeMat.color.setRGB(1, 0.35 + 0.25 * Math.max(0, Math.sin(t * 0.8)), 0.1);
      strider.group.visible = local < STRIDER_UNTIL;
      pipe.visible = strider.group.visible;

      // the Riders: up the lane at a gallop, two by two, to the room’s window
      const s = since.riders;
      const on = s != null && Number.isFinite(s) && s < RIDE.gone;
      riders.forEach((r, i) => {
        r.group.visible = on;
        if (!on) return;
        const k = smooth((s - (i >> 1) * 0.8) / RIDE.seconds);
        const z = RIDE.from + (RIDE.to - RIDE.from) * k - (i >> 1) * 3;
        const x = k < 1 ? (i % 2 ? -1.4 : 1.4) : WING.x - 2.4 - (i % 2) * 1.6;
        r.group.position.set(x, heightAt(x, z), z);
        r.group.rotation.y = k < 1 ? 0 : Math.PI / 2;
        r.set({ speed: k < 1 ? 9 : 0, yaw: 0, pitch: k < 1 ? 0 : 0.3 });
        r.tick(dt);
      });
      // the beds: a burst of feathers out of the window as the blades go in
      if (on && s > RIDE.seconds + 0.8 && !feathers) {
        feathers = weather?.kind?.('snow', { count: 160, box: [1.4, 0.4, 1.6], scale: 1.6 }) ?? null;
        feathers?.at(WING.window[0] + 0.6, heightAt(WING.x, WING.z) + WING.window[1] + 0.4, WING.window[2]);
      }
      if (feathers && (!on || s > RIDE.seconds + 2.6)) {
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
      lamp.geometry.dispose();
      lampMat.dispose();
      pipe.geometry.dispose();
      pipeMat.dispose();
      material.dispose();
      group.removeFromParent();
    },
  };
}
