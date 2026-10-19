// Weathertop (the plan’s Task 20, on Hobbiton’s recipe): the Lone-lands at
// dusk with the midges over the Midgewater, Sam’s fire in the dell with the
// four sat round it, five Nazgûl on the skyline over the crown, the Ring on:
// the five are pale kings in crowns and the Witch-king’s blade goes in, then
// Aragorn with fire in both hands and the Riders burning, and Frodo on the
// ground with Aragorn kneeling over him. This file only draws, each beat’s
// scene a function of where the walker is (`local`) and how long since the
// beat began (`since[id]`), so walking back puts it back.
//
//   build(ctx) → { group, update(local, dt, { since }), pose(id, at), dispose }
//   ctx: { road, heightAt, rt, weather, tier }

import * as THREE from 'three';
import { createNazgulKit } from '../../creatures/nazgul';
import { kingsPose } from '../../creatures/nazgul.rules';
import { FIRE, RING, buildProps } from './props';
import { BEATS } from './beats';

const MIDGES = 54; // m: the motes over the pools until here
const FIVE = [-6, -3, 0, 3, 6].map((x, i) => [x, RING.at[1] + 8 + Math.abs(x) * 0.4 + (i % 2) * 0.6]); // on the skyline at the ring’s far side
const CLOSE = 7; // m they come on through the ring while the Ring is on
const VISION = { at: 1, seconds: 12, rate: 2.5 }; // the ring beat’s (beats.js), as vision.js ramps it
const BURN = 6; // s they burn before they are gone
const SAT = ['frodo', 'sam', 'merry', 'pippin'];
const MARKS = Object.fromEntries(BEATS.map((b) => [b.id, b]));

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
// the vision’s amount t seconds into the ring beat, as the module ramps it
const visionAt = (t) => {
  const on = Math.min(Math.max(0, t - VISION.at), VISION.seconds);
  const off = Math.max(0, t - VISION.at - VISION.seconds);
  return Math.max(0, Math.min(1, on * VISION.rate) - off * VISION.rate);
};

export function build({ road, heightAt, rt, weather }) {
  const group = new THREE.Group();
  group.name = 'stage:weathertop';
  const material = road.material({ vertexColors: true, flatShading: true });
  const props = buildProps({ material, heightAt });
  group.add(props.group);

  // the fire in the dell, its light the stage’s one point light
  const fireLight = new THREE.PointLight(0xff8a3a, 0, 14, 2);
  fireLight.position.set(FIRE[0], heightAt(...FIRE) + 0.8, FIRE[1]);
  group.add(fireLight);
  const kit = createNazgulKit(rt, road);
  const five = FIVE.map((_, i) => {
    const r = kit.rider({ mounted: false, seed: 30 + i });
    r.group.visible = false;
    group.add(r.group);
    return r;
  });
  // the Witch-king’s blade, pale, in the middle one’s hand
  const bladeMat = road.material({ color: 0xc8ccd8, emissive: 0x8890a8, emissiveIntensity: 0.6 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.1), bladeMat);
  blade.position.set(0.32, 1.15, 0.5);
  five[2].group.add(blade);

  let midges = null;
  let fire = null;
  let torches = [];
  let burning = [];
  let aragorn = null; // where the line has him this frame (pose), for his torches
  let flicker = 0;
  const hand = new THREE.Vector3();
  const seen = { since: {}, local: 0 }; // (the last frame’s, for pose: the walkers are placed before the scene steps)

  const stopAll = (list) => {
    for (const h of list) h?.stop();
    return [];
  };

  return {
    group,
    update(local, dt, { since = {} } = {}) {
      seen.since = since;
      seen.local = local;
      // the midges over the Lone-lands
      if (local < MIDGES) midges ??= weather?.kind?.('motes', { follow: true, count: 120 }) ?? null;
      else if (midges) {
        midges.stop();
        midges = null;
      }
      // Sam’s fire: lit from the dell’s beat, burning on behind the walker
      const lit = since.dell != null;
      flicker += dt;
      const glow = 5 + Math.sin(flicker * 11) * 0.5 + Math.sin(flicker * 17.3) * 0.3;
      fireLight.intensity = lit ? glow : 0;
      fireLight.position.set(FIRE[0], heightAt(...FIRE) + 0.8, FIRE[1]);
      if (lit && !fire) {
        fire = weather?.kind?.('fire', { count: 60 }) ?? null;
        fire?.at(FIRE[0], heightAt(...FIRE) + 0.1, FIRE[1]);
      } else if (!lit && fire) {
        fire.stop();
        fire = null;
      }

      // the five: on the skyline from the summit’s beat, coming on through the ring
      // under the Ring, burning and gone after the fire’s
      const s = since.summit;
      const r = since.ring;
      const f = since.fire;
      const shown = s != null && !(f != null && f > BURN);
      const amount = r != null && Number.isFinite(r) ? visionAt(r) : 0;
      const pose = amount > 0 ? kingsPose(amount) : null;
      five.forEach((n, i) => {
        n.group.visible = shown;
        if (!shown) return;
        const [x0, z0] = FIVE[i];
        const on = r != null && Number.isFinite(r) ? smooth(r / 10) * CLOSE : 0;
        const back = f != null && Number.isFinite(f) ? smooth(f / BURN) * 14 : 0;
        const x = x0 * (1 - on / (CLOSE * 2.5));
        const z = z0 - on + back;
        n.group.position.set(x, heightAt(x, z), z);
        n.group.rotation.y = Math.PI;
        n.set({ king: pose, yaw: 0, pitch: 0.1 });
        n.tick(dt);
      });
      // the blade: raised as he comes, the thrust at ten seconds in
      const thrust = r != null && Number.isFinite(r) ? smooth((r - 9.5) / 0.6) : 0;
      blade.rotation.x = -1.1 + thrust * 1.1;
      blade.position.z = 0.5 + thrust * 0.5;
      blade.visible = shown && r != null;

      // Aragorn’s torches, and the five burning
      const torching = f != null && Number.isFinite(f) && f < BURN + 2;
      if (torching && !torches.length && aragorn) torches = [0, 1].map(() => weather?.kind?.('fire', { count: 30, scale: 0.5 }) ?? null);
      if (!torching && torches.length) torches = stopAll(torches);
      if (torches.length && aragorn) {
        torches.forEach((t, i) => {
          hand.set(aragorn.x + (i ? -0.45 : 0.45), aragorn.y + 1.45, aragorn.z + 0.35);
          t?.at(hand.x, hand.y, hand.z);
        });
        // (the one light goes with him: the torches light the five and the four)
        fireLight.position.set(aragorn.x, aragorn.y + 1.8, aragorn.z + 0.6);
        fireLight.intensity = glow * 1.3;
      }
      const burn = f != null && Number.isFinite(f) && f < BURN;
      if (burn && !burning.length) burning = five.map(() => weather?.kind?.('fire', { count: 40, scale: 0.6 }) ?? null);
      if (!burn && burning.length) burning = stopAll(burning);
      burning.forEach((b, i) => b?.at(five[i].group.position.x, five[i].group.position.y + 0.8, five[i].group.position.z));
    },
    // the four sat round the fire while the dell’s beat holds; Aragorn’s torches;
    // Frodo down and Aragorn knelt over him at the kingsfoil (each only on its mark:
    // a visitor walking on through a beat walks on as they are)
    pose(id, at) {
      if (id === 'aragorn') aragorn = at;
      const held = (beat) => {
        const b = MARKS[beat];
        const t = seen.since[beat];
        return t != null && Number.isFinite(t) && t < b.hold && Math.abs(seen.local - b.at) < 0.5;
      };
      if (held('dell') && SAT.includes(id)) return { base: 'sit.ground', speed: 0, yaw: id === 'sam' ? Math.PI / 2 : 0 };
      if (held('fire') && id === 'aragorn') return { base: 'torch', speed: 0 };
      if (held('kingsfoil')) {
        if (id === 'frodo') return { base: 'lie.down', speed: 0 };
        if (id === 'aragorn') return { base: 'kneel.fix', speed: 0, x: at.x > 0 ? 0.55 : 0.6, z: seen.local + 0.4, yaw: -Math.PI / 2 };
      }
      return null;
    },
    dispose() {
      midges?.stop();
      fire?.stop();
      stopAll(torches);
      stopAll(burning);
      props.dispose();
      kit.dispose();
      blade.geometry.dispose();
      bladeMat.dispose();
      material.dispose();
      group.removeFromParent();
    },
  };
}
