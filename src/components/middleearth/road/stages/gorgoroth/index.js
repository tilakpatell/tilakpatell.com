// Gorgoroth and the Mountain (the plan’s Task 30): the plain of ash under
// the pall, Mount Doom the Mount Doom chapter’s own mountain looming ahead
// (towns/doom/props.js’s kit, on the Road’s house look: its streams of
// fire, its plume, the road up its west side), the orc column on the road
// with its slave-driver’s whip, the Eye’s beam sweeping over the two under
// their cloaks (the deed: keep still); Sam carrying Frodo up the slope (the
// deed: the rhythm of his steps); a cut down into the Sammath Naur, the
// chapter’s own, its spur over the Crack: the Ring on, Gollum, his fall,
// Frodo over the edge and Sam’s hand (the deed); the Mountain breaking,
// Barad-dûr going down and the Eye out (backdrop.js’s fall); the two on
// their rock in the fire; and the Eagles. This file only draws, each
// beat’s scene a function of where the walker is (`local`) and how long
// since the beat began (`since[id]`), so walking back puts it back.
//
//   build(ctx) → { group, update(local, dt, { since }), pose(id, at), leave(), dispose }
//   ctx: { road, heightAt, rt, tier, backdrop }

import * as THREE from 'three';
import { createDoomKit } from '../../../towns/doom/props';
import { createTownKit } from '../../townKit';
import { createGollum } from '../../creatures/gollum';
import { marchColumn } from '../columns';
import { BEATS } from './beats';
import { CHAMBER, COLUMN, CRACKS, MOUNT, REFUGE, SPUR, sweep } from './place';

const MARKS = Object.fromEntries(BEATS.map((b) => [b.id, b]));
const RING_ON = [4, 10]; // s into the Cracks: the Ring on (Frodo unseen), off as Gollum takes it
const FALL = [10, 12]; // s: Gollum over the edge with it
const HANG = [11, MARKS.cracks.deed.at + MARKS.cracks.deed.seconds]; // s: Frodo hanging at the edge till Sam has him
const ERUPT = 3; // s into the eruption the Mountain is ablaze
const DOWN = MARKS.eruption.hold; // s the Tower takes to go down
const SWOOP = [0, 4, 8]; // s into the Eagles' beat: in, down to the rock, away
const CARRY_END = 120; // m: on foot again at the Sammath Naur's door (the stage's modes)
const ON_BACK = [0.28, 0.42]; // m behind Sam and up: Frodo on his back (the chapter's)
const COUNT = { high: 60, mid: 40, low: 24 };
const PBR = ['roughness', 'metalness', 'envMap', 'envMapIntensity'];

const live = (t) => t != null && Number.isFinite(t);
const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
const within = (t, [a, b]) => live(t) && t >= a && t < b;

export function build({ road, heightAt, rt, tier = 'high', backdrop = null }) {
  const group = new THREE.Group();
  group.name = 'stage:gorgoroth';
  const renderer = rt?.gfx?.renderer ?? null;
  const town = createTownKit(road, renderer, { wild: true });
  // (the chapter's kit on the Road's town kit, its plain materials the house's; its shaders its own)
  const made = [];
  const kit = createDoomKit(renderer, {
    base: town,
    material: (o) => {
      const opts = { ...o };
      for (const k of PBR) delete opts[k];
      const m = road.material(opts);
      made.push(m);
      return m;
    },
  });

  // the Mountain ahead, its west road turned to the walkers
  const mountain = kit.mountDoom();
  mountain.group.position.set(...MOUNT.at);
  mountain.group.rotation.y = MOUNT.turn;
  group.add(mountain.group);
  // the orc column on the road, and its driver with his whip
  const column = new THREE.InstancedMesh(kit.orcColumn(), road.material({ vertexColors: true }), COUNT[tier] ?? COUNT.high);
  made.push(column.material);
  column.name = 'gorgoroth:column';
  column.frustumCulled = false;
  column.userData.moves = true;
  group.add(column);
  const slaver = kit.orc(3, { slaver: true });
  group.add(slaver.group);
  // the Eye's beam down onto the plain
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.7, 0.18), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.05, 1, 12, 1, true).translate(0, -0.5, 0), beamMat);
  beam.name = 'gorgoroth:beam';
  beam.visible = false;
  group.add(beam);
  // the Sammath Naur, far under the plain: the cut takes the camera there
  const naur = kit.sammathNaur();
  naur.group.position.set(...CHAMBER.at);
  naur.group.rotation.y = CHAMBER.turn;
  naur.group.visible = false;
  group.add(naur.group);
  // the rock in the fire, and the Eagles
  const refuge = kit.refuge();
  const rockY = heightAt(...REFUGE);
  refuge.group.position.set(REFUGE[0], rockY, REFUGE[1]);
  group.add(refuge.group);
  const eagles = [kit.eagle(), kit.eagle()];
  for (const e of eagles) {
    e.group.visible = false;
    group.add(e.group);
  }
  const gollum = createGollum(road, renderer);
  gollum.group.visible = false;
  group.add(gollum.group);
  // (none of it casts into the cascades: the chapter's shaders read what the depth pass hasn't, and
  // the Mountain is past them; the rock and the chamber stand solid)
  group.traverse((o) => {
    o.castShadow = false;
  });
  refuge.group.traverse((o) => o.isMesh && (o.userData.solid = true));

  let clock = 0;
  const seen = { since: {}, local: 0 };
  const eye = new THREE.Vector3();
  const spot = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const lashAt = new THREE.Vector3();
  const inCracks = () => live(seen.since.cracks) && seen.local >= MARKS.cracks.at - 0.5 && seen.local < MARKS.eruption.at;

  return {
    group,
    update(local, dt, { since = {} } = {}) {
      seen.since = since;
      seen.local = local;
      clock += dt;
      kit.tick(clock);
      // the Mountain: smouldering, then ablaze as it breaks
      const e = since.eruption;
      const erupt = e === Infinity ? 1 : live(e) ? smooth(e / ERUPT) : 0;
      mountain.update(clock, { erupt });
      naur.update(clock, { erupt: within(since.cracks, [FALL[0], 99]) ? 0.6 : 0.15 });
      // the Tower going down and the Eye out
      backdrop?.fall?.(e === Infinity ? 1 : live(e) ? smooth(e / DOWN) : 0);
      // the column marching on the road while it's near; its driver beside it, lashing
      column.visible = local < 110;
      if (column.visible) marchColumn(column, COLUMN, heightAt, clock, { scale: 1 });
      const c = since.column;
      const lash = live(c) && c < MARKS.column.hold ? Math.max(0, Math.sin(c * 2.2)) : 0;
      lashAt.set(COLUMN.from[0] + 1.6, 0, Math.min(COLUMN.to[1], Math.max(COLUMN.from[1], local + 6)));
      slaver.group.position.set(lashAt.x, heightAt(lashAt.x, lashAt.z), lashAt.z);
      slaver.group.rotation.y = -Math.PI / 2;
      slaver.group.visible = local < 110;
      slaver.animate(clock, { marching: true, lash });
      // the beam from the Eye down onto the plain, sweeping over the two
      const b = since.beam;
      beam.visible = Boolean(backdrop?.eyeAt) && live(b) && b < MARKS.beam.hold + 1;
      if (beam.visible) {
        const at = backdrop.eyeAt(eye);
        const [sx, sz] = sweep(b);
        spot.set(sx, heightAt(sx, sz), sz);
        if (at && group.parent) {
          group.parent.worldToLocal(eye);
          dir.subVectors(spot, eye);
          const len = dir.length();
          beam.position.copy(eye);
          beam.quaternion.setFromUnitVectors(up, dir.clone().negate().normalize());
          beam.scale.set(9, len, 9);
        } else beam.visible = false;
      }
      // the chamber shown only while the cut is in it
      naur.group.visible = inCracks();
      // Gollum: on the spur at the Cracks, his fight and his fall; else not seen (the line hides him)
      const k = since.cracks;
      gollum.group.visible = inCracks() && live(k) && k < FALL[1];
      if (gollum.group.visible) {
        const [gx, gz] = CRACKS.gollum;
        const fall = smooth((k - FALL[0]) / (FALL[1] - FALL[0]));
        const lunge = smooth((k - RING_ON[0] - 1) / 2);
        gollum.at(gx, SPUR.y - fall * 30, gz + lunge * 1.6 + fall * 2, clock, { pose: fall > 0 ? 'fall' : lunge > 0 ? 'crawl' : 'crouch', yaw: 0 });
      }
      // the Eagles: down out of the smoke to the rock, and away with the two
      const a = since.eagles;
      eagles.forEach((eg, i) => {
        eg.group.visible = live(a) && a < SWOOP[2] + 4;
        if (!eg.group.visible) return;
        const t = a;
        const down = smooth(t / SWOOP[1]);
        const away = smooth((t - SWOOP[1]) / (SWOOP[2] - SWOOP[1]));
        const x = REFUGE[0] + (i ? 4 : -4) + away * 30;
        const z = REFUGE[1] - 60 * (1 - down) + away * 50;
        const y = rockY + 40 * (1 - down) + 6 + away * 40;
        eg.group.position.set(x, y, z);
        eg.group.rotation.y = -Math.PI / 2;
        eg.animate(clock + i, { flap: down < 1 ? 0.3 : away > 0 ? 1 : 0.6, glide: down < 1 ? 0.8 : 0, reach: within(t, [SWOOP[1] - 1, SWOOP[1] + 1.5]) ? 1 : 0 });
      });
      // the rock lit red from below as the fire comes round it
      refuge.glow(live(e) || e === Infinity ? 0.6 + 0.4 * erupt : 0);
    },
    pose(id, at) {
      // (Gollum's figure is this stage's own: the line's is never drawn)
      if (id === 'gollum') return { hide: true };
      // carried up the slope, as the Mount Doom chapter has it: Sam in the lead's place
      // in the line (where the shot is), bent under him, Frodo on his back
      if (seen.local >= MARKS.carry.at && seen.local < CARRY_END && (id === 'frodo' || id === 'sam')) {
        const { x, z } = at.lead ?? at;
        const y = heightAt(x, z);
        if (id === 'frodo') return { x, y: y + ON_BACK[1], z: z - ON_BACK[0], yaw: 0, base: 'sit.ground', speed: 0 };
        return { x, y, z, yaw: 0, base: 'walk.carry', speed: 0 };
      }
      // in the Sammath Naur: Frodo at the spur's tip, unseen under the Ring, then over the edge; Sam behind him
      if (inCracks() && CRACKS[id]) {
        const k = seen.since.cracks;
        const [x, z] = CRACKS[id];
        if (id === 'frodo') {
          if (within(k, RING_ON)) return { hide: true };
          if (within(k, HANG) && k < 98) return { x, y: SPUR.y - 0.9, z: z + 0.6, yaw: Math.PI, base: 'crawl', speed: 0 };
          return { x, y: SPUR.y, z, yaw: k >= HANG[1] ? Math.PI : 0, base: 'idle', speed: 0 };
        }
        return { x, y: SPUR.y, z, yaw: 0, base: within(k, HANG) ? 'crouch' : 'idle', speed: 0 };
      }
      // under the cloaks while the beam goes over
      const b = seen.since.beam;
      if (within(b, [0, MARKS.beam.hold + 0.5]) && (id === 'frodo' || id === 'sam')) return { base: 'crouch', speed: 0 };
      // the two on the rock in the fire, from their lying down till the Eagles take them
      const a = seen.since.eagles;
      if ((id === 'frodo' || id === 'sam') && seen.local >= 156) {
        if (live(a) && a > SWOOP[1]) return { hide: true };
        return { x: REFUGE[0] + (id === 'sam' ? 0.5 : -0.5), y: rockY + 3, z: REFUGE[1], yaw: Math.PI / 2, base: 'lie.down', speed: 0 };
      }
      return null;
    },
    leave() {
      naur.group.visible = false;
      backdrop?.fall?.(0);
    },
    dispose() {
      gollum.dispose();
      const done = new Set();
      group.traverse((o) => {
        o.geometry?.dispose();
        for (const m of [o.material].flat()) {
          if (!m || done.has(m)) continue;
          done.add(m);
          m.dispose();
        }
      });
      for (const m of made) m.dispose();
      for (const t of Object.values(kit.tex ?? {})) t?.dispose?.();
      town.dispose();
      group.removeFromParent();
    },
  };
}
