// Rivendell (the plan’s Task 22, on Hobbiton’s recipe): the valley from the
// ridge, the bridge, the Council in its garden (the company sat in the
// ring, Elrond at its head, the Ring on the plinth; Frodo on his feet when
// he speaks; Gimli up with his axe after), the shards of Narsil, Bilbo on
// his bench with his book, and the morning the nine walk out under the arch
// with Elrond and Arwen watching. This file only draws, each beat’s scene a
// function of where the walker is (`local`) and how long since the beat
// began (`since[id]`), so walking back puts it back.
//
//   build(ctx) → { group, update(local, dt, { since }), floor(x, z), pose(id, at), dispose }
//   ctx: { road, heightAt, rt, weather, tier }

import * as THREE from 'three';
import { walker } from '../../cast';
import { createTownKit } from '../../townKit';
import { ARCH, BRIDGE, FALLS, buildProps } from './props';
import { BEATS } from './beats';

const MARKS = Object.fromEntries(BEATS.map((b) => [b.id, b]));
// the court’s chairs (props.js’s, the chapter’s ten from its way in round): who sits where, Elrond at the head across from the road
const SEATS = { elrond: 5, gandalf: 4, legolas: 3, gimli: 2, boromir: 6, aragorn: 7, frodo: 9, sam: 8, merry: 0, pippin: 1 };
const GUESTS = ['elrond', 'gandalf', 'legolas', 'gimli', 'boromir']; // the scene’s own, until four of them join the line
const STANDS = 8; // s into the Council Frodo is on his feet (after Elrond’s and Boromir’s lines)
const GONE = MARKS.narsil.at; // m: the Council’s guests are left in the garden behind

export function build({ road, heightAt, rt, weather, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'stage:rivendell';
  const material = road.material({ vertexColors: true, flatShading: true });
  const town = createTownKit(road, rt?.gfx?.renderer ?? null, { elven: true });
  const props = buildProps({ K: town.K, material, heightAt, tier });
  const chairAt = (i) => props.chairs[i];
  group.add(props.group);
  const figures = new Map();
  const add = (key, name, x, z, yaw, base, y = null) => {
    const w = walker(name, { rt, seed: 90 + figures.size });
    w.group.position.set(x, y ?? heightAt(x, z), z);
    w.group.rotation.y = yaw;
    w.set({ base, speed: 0 });
    group.add(w.group);
    figures.set(key, w);
    return w;
  };
  for (const id of GUESTS) {
    const c = chairAt(SEATS[id]);
    add(id, id, c.x, c.z, c.yaw, 'sit.idle', c.y);
  }
  add('bilbo', 'bilbo', props.seat.x, props.seat.z, props.seat.yaw, 'sit.talk', props.seat.y);
  // at the arch, the morning they leave
  add('elrond:arch', 'elrond', -ARCH.w / 2 - 2.2, ARCH.z + 1.5, Math.PI / 2, null);
  add('arwen:arch', 'arwen', -ARCH.w / 2 - 3.2, ARCH.z + 0.4, Math.PI / 2, null);

  // the falls’ spray at their feet, and gold motes in the valley’s light (not on low)
  const sprays = tier === 'low' ? [] : FALLS.map(([x, z]) => ({ x, z, h: null }));
  let motes = null;
  let spin = 0;
  const seen = { since: {}, local: 0 };

  return {
    group,
    update(local, dt, { since = {} } = {}) {
      seen.since = since;
      seen.local = local;
      spin += dt;
      props.ring.rotation.z = spin * 0.4;
      // the guests in the garden while the walker is near it; Gimli up for his axe
      // (from the bridge on: a figure is never culled, and from the ridge the garden is a speck)
      const garden = local > MARKS.bridge.at - 8 && local < GONE;
      for (const id of GUESTS) {
        const w = figures.get(id);
        w.group.visible = garden;
        if (!garden) continue;
        if (id === 'gimli') w.set({ base: since.axe != null && Number.isFinite(since.axe) && since.axe < 6 ? null : 'sit.idle', speed: 0 });
        w.tick(dt);
      }
      figures.get('bilbo').tick(dt);
      const morning = local > MARKS.setout.at - 20;
      for (const k of ['elrond:arch', 'arwen:arch']) {
        const w = figures.get(k);
        w.group.visible = morning;
        if (morning) w.tick(dt);
      }
      for (const s of sprays) {
        if (!s.h) {
          s.h = weather?.kind?.('spray', { count: 80, box: [3, 0.5, 3] }) ?? null;
          s.h?.at(s.x + 6, heightAt(s.x, s.z) + 1, s.z);
        }
      }
      if (tier !== 'low' && local < MARKS.setout.at) motes ??= weather?.kind?.('motes', { follow: true, count: 80 }) ?? null;
      else if (motes) {
        motes.stop();
        motes = null;
      }
    },
    // the bridge carries the walkers over the stream
    floor(x, z) {
      return Math.abs(x) <= BRIDGE.w / 2 && z >= BRIDGE.z[0] && z <= BRIDGE.z[1] ? props.deck(z) : null;
    },
    // the company in their chairs while the Council holds (Frodo up when he speaks)
    pose(id) {
      const t = seen.since.council;
      if (t == null || !Number.isFinite(t) || t >= MARKS.council.hold || Math.abs(seen.local - MARKS.council.at) > 0.5 || SEATS[id] == null) return null;
      const c = chairAt(SEATS[id]);
      const up = id === 'frodo' && t >= STANDS;
      return { x: c.x, y: c.y, z: c.z, yaw: c.yaw, base: up ? 'idle' : 'sit.idle', speed: 0 };
    },
    dispose() {
      motes?.stop();
      for (const s of sprays) s.h?.stop();
      props.dispose();
      for (const w of figures.values()) w.dispose();
      material.dispose();
      town.dispose();
      group.removeFromParent();
    },
  };
}
