// Caradhras and the Doors (the plan’s Task 23, on Hobbiton’s recipe):
// Hollin’s holly under a hard sky, the crebain coming over the ridge and
// back, the white-out on the Redhorn’s shoulder with Saruman on the wind and
// the slab that slides, then down at dusk to the black lake under the Walls
// of Moria: the Doors come up in silver as the moon finds them and open on
// the word, the Watcher’s arms come out of the water and lift Frodo, and the
// Doors shut behind the company. This file only draws, each beat’s scene a
// function of where the walker is (`local`) and how long since the beat
// began (`since[id]`), so walking back puts it back.
//
//   build(ctx) → { group, update(local, dt, { since }), pose(id, at), dispose }
//   ctx: { road, heightAt, rt, weather, tier, sky }

import * as THREE from 'three';
import { createTownKit } from '../../townKit';
import { addMoria } from '../../moriaKit';
import { createWater } from '../../water';
import { STORMS } from '../../daylight';
import { createCrebain } from '../../creatures/crebain';
import { ARMS, GRAB, arm } from '../../creatures/watcher.rules';
import { tentacle } from '../../../towns/moria/gate';
import { GATE_AT, LAKE, SLAB, buildProps } from './props';
import { BEATS } from './beats';

const MARKS = Object.fromEntries(BEATS.map((b) => [b.id, b]));
const STORM = STORMS.caradhras.at; // m: the white-out over the shoulder (daylight.js’s, its fog)
const RISE = 5; // s the ithildin takes to come out under the moon
const OPEN = [9, 13]; // s into the Doors’ beat they swing open
const FLIGHT = 16; // s the crebain are about
const SHUT = GATE_AT + 3; // m: past here the Doors are shut behind the company
const ARM_SCALE = 1.5; // the chapter’s arms, at the Road’s scale

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
const live = (t) => t != null && Number.isFinite(t);

export function build({ road, heightAt, rt, weather, tier = 'high', sky = null }) {
  const group = new THREE.Group();
  group.name = 'stage:caradhras';
  const renderer = rt?.gfx?.renderer ?? null;
  const town = createTownKit(road, renderer, { wild: true });
  const moria = addMoria(town, road, renderer, { gate: true });
  const props = buildProps({ K: town.K, road, heightAt, tier });
  group.add(props.group);

  // the lake under the Walls, black and still
  const level = heightAt(-14, LAKE.at[1]) - 0.6;
  const lake = createWater({ area: LAKE.area, level, kind: 'still', sky, ground: heightAt });
  lake.set({ sun: { el: -0.05 }, ambient: 0.12 });
  group.add(lake.mesh);

  // the Watcher’s arms, under the water by the shore until their beat; the
  // first rises where Frodo stands, the rest along the shore behind it
  const arms = Array.from({ length: tier === 'low' ? ARMS / 2 : ARMS }, (_, i) => {
    const a = tentacle(town.K, i + 1);
    const x = i === 0 ? -8 : -14 - (i % 4) * 4;
    const z = i === 0 ? MARKS.watcher.at - 1 : LAKE.area.z0 + 18 + ((i * 7) % 12) * 2.4;
    a.group.position.set(x, level, z);
    a.group.scale.setScalar(ARM_SCALE);
    a.group.rotation.y = Math.atan2(-(MARKS.watcher.at - z), -x) + Math.PI;
    a.group.visible = false;
    a.group.traverse((o) => o.isSkinnedMesh && (o.frustumCulled = false));
    group.add(a.group);
    return a;
  });

  // the Doors’ silver light over the shore and the water, as the ithildin comes up
  // (the stage’s one point light; the moon alone leaves the arms black on black)
  const glow = new THREE.PointLight(0xa8bcff, 0, 46, 1.4);
  glow.position.set(0, heightAt(0, GATE_AT - 8) + 7, GATE_AT - 8);
  group.add(glow);

  // the crebain
  const crebain = createCrebain({ count: tier === 'low' ? 120 : 300 });
  crebain.mesh.visible = false;
  group.add(crebain.mesh);
  const over = (x, z, up) => [x, heightAt(x, z) + up, z];
  const FLY = { from: over(70, 50, 24), over: over(0, MARKS.crebain.at + 6, 12), back: over(48, 64, 22), away: over(150, 96, 40) };

  // the top of the first arm, in the stage’s frame: Frodo hangs from it
  const tip = new THREE.Vector3();
  const bone = new THREE.Vector3();
  const bones = arms[0].mesh.skeleton.bones;

  let storm = null;
  let burst = null;
  let clock = 0;
  const seen = { since: {}, local: 0 };

  return {
    group,
    update(local, dt, { since = {} } = {}) {
      seen.since = since;
      seen.local = local;
      clock += dt;
      moria.tick(clock);
      lake.update(dt);

      // the crebain: over the ridge and the walkers, back, and away
      const c = since.crebain;
      const flying = live(c) && c < FLIGHT;
      if (flying && !crebain.mesh.visible) crebain.start(FLY.from);
      crebain.mesh.visible = flying;
      if (flying) crebain.update(dt, c < 3.5 ? FLY.over : c < 8 ? FLY.back : FLY.away);

      // the storm on the shoulder: snow coming on, at full by the slab, gone over the top
      const k = smooth((local - STORM[0]) / 14) * (1 - smooth((local - STORM[1]) / 12));
      if (k > 0.01) {
        storm ??= weather?.kind?.('snow', { follow: true, scale: 2.4 }) ?? null;
        storm?.rate(k);
      } else if (storm) {
        storm.stop();
        storm = null;
      }

      // the avalanche: the slab off the shoulder, a burst of white where it comes down
      const a = since.avalanche;
      const slide = a == null ? 0 : a === Infinity ? 1 : smooth((a - 0.6) / 2.5);
      const sx = SLAB.from[0] + (SLAB.to[0] - SLAB.from[0]) * slide;
      const sz = SLAB.from[1] + (SLAB.to[1] - SLAB.from[1]) * slide;
      props.slab.position.set(sx, heightAt(sx, sz) + 0.5 - slide * 0.5, sz);
      props.slab.rotation.set(slide * 0.12, 0.3, -0.25 * (1 - slide));
      const bursting = live(a) && a > 2 && a < 4.5;
      if (bursting && !burst) {
        burst = weather?.kind?.('spray', { count: 160, box: [SLAB.w, 1, SLAB.d], scale: 3 }) ?? null;
        burst?.at(SLAB.to[0], heightAt(...SLAB.to) + 0.5, SLAB.to[1]);
      } else if (!bursting && burst) {
        burst.stop();
        burst = null;
      }

      // the Doors: the ithildin out under the moon, the word, the leaves swinging in;
      // shut again behind the company
      const d = since.doors;
      const ith = d == null ? 0.05 : d === Infinity ? 1 : smooth(d / RISE);
      moria.setIthildin(local > SHUT ? 0 : ith);
      glow.intensity = local > SHUT || local < MARKS.walls.at ? 0 : 320 * ith;
      const open = d == null ? 0 : d === Infinity ? 1 : smooth((d - OPEN[0]) / (OPEN[1] - OPEN[0]));
      props.gate.open(local > SHUT ? 0 : open);

      // the Watcher: its arms out of the lake by turns while its beat runs, then back under
      const w = since.watcher;
      const t = w == null ? -1 : w === Infinity ? 99 : w;
      for (let i = 0; i < arms.length; i++) {
        const r = arm(t, i);
        arms[i].group.visible = r.reach > 0.01;
        if (arms[i].group.visible) arms[i].update(clock + i, r.reach, 0);
      }
      // (the arm’s crown, the highest of its bones: its tip curls over and down)
      if (arms[0].group.visible) {
        tip.set(0, -Infinity, 0);
        for (const b of bones) {
          b.getWorldPosition(bone);
          if (bone.y > tip.y) tip.copy(bone);
        }
        group.worldToLocal(tip);
      }
    },
    // Frodo taken up by the ankle and dropped when the arm is cut (on the Watcher’s mark only)
    pose(id, at) {
      if (id !== 'frodo') return null;
      const t = seen.since.watcher;
      if (!live(t) || t >= GRAB.back + 2 || Math.abs(seen.local - MARKS.watcher.at) > 0.5) return null;
      const lift = arm(t, 0).lift;
      if (lift <= 0.01) return null;
      // (hung by the ankle from the arm’s crown)
      return { x: at.x + (tip.x - at.x) * lift, y: at.y + (tip.y - 1.2 - at.y) * lift, z: at.z + (tip.z - at.z) * lift, base: 'lifted', speed: 0, yaw: -Math.PI / 2 };
    },
    dispose() {
      storm?.stop();
      burst?.stop();
      crebain.dispose();
      for (const a of arms) a.group.traverse((o) => o.geometry?.dispose());
      lake.dispose();
      props.dispose();
      moria.dispose();
      town.dispose();
      group.removeFromParent();
    },
  };
}
