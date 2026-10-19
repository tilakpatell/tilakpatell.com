// The Dead Marshes (the plan’s Task 27, on Hobbiton’s recipe): at the foot
// of the Emyn Muil’s last cliff with Sam’s rope down it, Gollum head first
// down the rock and onto them, then leading; out over the marsh in the
// mist with the candles in the pools and the dead faces under them, Frodo
// drawn down to the water and pulled back; the fell beast round over the
// marsh; and the Morannon, the Easterlings marching up to it and in as the
// gate swings, where Gollum shows the other way. This file only draws,
// each beat’s scene a function of where the walker is (`local`) and how
// long since the beat began (`since[id]`), so walking back puts it back.
//
//   build(ctx) → { group, update(local, dt, { since }), pose(id, at), dispose }
//   ctx: { road, heightAt, rt, tier, sky }

import * as THREE from 'three';
import { createTownKit } from '../../townKit';
import { addMarshes } from '../../marshesKit';
import { createWater } from '../../water';
import { createGollum } from '../../creatures/gollum';
import { createFellBeast } from '../../creatures/fellbeast';
import { CLIFF, COLUMN, buildProps } from './props';
import { BEATS } from './beats';

const MARKS = Object.fromEntries(BEATS.map((b) => [b.id, b]));
const DOWN = [0, 6]; // s into Gollum’s beat: down the last of the cliff to its foot
const DROP = 9; // m of the face he is seen coming down
const LEADS = 40; // m: from here he leads (fellowship.js’s change)
const OPEN = [3, 6, 9, 12]; // s into the Gate’s beat: swinging open, open, closing, shut
const MARCH = 1.4; // m/s the column marches
const FLIGHT = 18; // s the fell beast is over the marsh

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
const live = (t) => t != null && Number.isFinite(t);

export function build({ road, heightAt, rt, tier = 'high', sky = null }) {
  const group = new THREE.Group();
  group.name = 'stage:marshes';
  const renderer = rt?.gfx?.renderer ?? null;
  const town = createTownKit(road, renderer, { wild: true });
  const marshes = addMarshes(town, road, renderer);
  const props = buildProps({ K: town.K, heightAt, tier });
  group.add(props.group);

  // the pools, still and dark
  const waters = props.pools.map((p) => {
    const w = createWater({ area: { x0: p.at[0] - p.r * 0.9, z0: p.at[1] - p.r * 0.9, w: p.r * 1.8, d: p.r * 1.8 }, level: p.level, kind: 'still', sky, ground: heightAt });
    w.set({ sun: { el: 0.1 }, ambient: 0.15 });
    group.add(w.mesh);
    return w;
  });

  const gollum = createGollum(road, renderer);
  gollum.group.visible = false;
  group.add(gollum.group);
  const fell = createFellBeast(town.K);
  fell.group.visible = false;
  group.add(fell.group);

  // the column’s ranks along its road, `files` abreast
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(COLUMN.to[0] - COLUMN.from[0], COLUMN.to[1] - COLUMN.from[1]));
  const dir = new THREE.Vector2(COLUMN.to[0] - COLUMN.from[0], COLUMN.to[1] - COLUMN.from[1]);
  const span = dir.length();
  dir.normalize();
  const one = new THREE.Vector3(0.8, 0.8, 0.8);
  const p = new THREE.Vector3();
  const march = (t) => {
    const files = COLUMN.files;
    const n = props.column.count;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / files);
      const along = (row * 1.6 + t * MARCH) % span;
      const across = ((i % files) - (files - 1) / 2) * 1.3;
      const x = COLUMN.from[0] + dir.x * along - dir.y * across;
      const z = COLUMN.from[1] + dir.y * along + dir.x * across;
      // (a little bob, out of step rank to rank)
      p.set(x, heightAt(x, z) + Math.abs(Math.sin(t * 4 + row)) * 0.05, z);
      m.compose(p, q, one);
      props.column.setMatrixAt(i, m);
    }
    props.column.instanceMatrix.needsUpdate = true;
  };
  march(0);

  let clock = 0;
  const seen = { since: {}, local: 0 };
  const at = new THREE.Vector3();

  return {
    group,
    update(local, dt, { since = {} } = {}) {
      seen.since = since;
      seen.local = local;
      clock += dt;
      for (const w of waters) w.update(dt);
      for (const w of props.wisps) w.update(clock);
      // the faces come up pale as the walker nears the pools, strongest as Frodo looks down
      const f = since.faces;
      const near = smooth(1 - Math.abs(local - 82) / 30);
      const look = live(f) && f < MARKS.faces.hold + 2 ? smooth(f / 2) : 0;
      for (const face of props.faces) face.update(clock, near * 0.5 + look * 0.5);

      // Gollum: down the cliff on his beat, across to them, then leading (the module’s file places him; pose)
      const g = since.gollum;
      gollum.group.visible = live(g) || local >= MARKS.gollum.at;
      if (local < LEADS && gollum.group.visible) {
        const t = live(g) ? g : DOWN[1] + 1;
        const k = smooth((t - DOWN[0]) / (DOWN[1] - DOWN[0]));
        const foot = heightAt(CLIFF.x, CLIFF.z);
        if (k < 1) {
          // head first down the face, the face at his +x (the figure’s): turned to the road
          at.set(CLIFF.x - 0.7, foot + 0.3 + (1 - k) * DROP, CLIFF.z + 1.5);
          gollum.at(at.x, at.y, at.z, clock, { pose: 'climb', yaw: Math.PI });
        } else {
          const u = smooth((t - DOWN[1]) / 2.5);
          const x = CLIFF.x - 1 - u * 4;
          const z = CLIFF.z + 1.5 + u * 4;
          gollum.at(x, heightAt(x, z), z, clock, { pose: u < 1 ? 'crawl' : 'cower', yaw: -Math.PI / 2 - 0.4 });
        }
      }

      // the fell beast round over the marsh while its beat plays
      const b = since.fellbeast;
      fell.group.visible = live(b) && b < FLIGHT;
      if (fell.group.visible) fell.update(b + 3, { at: [8, MARKS.fellbeast.at + 18], r: 18, height: heightAt(8, MARKS.fellbeast.at + 18) + 15 });

      // the Gate: the column marching up, the leaves swinging in and shut again behind it
      march(clock);
      props.column.visible = local > 70;
      const d = since.gate;
      const s = d == null ? 0 : d === Infinity ? OPEN[3] : d;
      props.gate.open(smooth((s - OPEN[0]) / (OPEN[1] - OPEN[0])) * (1 - smooth((s - OPEN[2]) / (OPEN[3] - OPEN[2]))));
    },
    // Gollum on the module’s place for him once he leads (the cast has no figure for him);
    // Frodo down at the pool’s edge on the faces’ beat
    pose(id, at2) {
      if (id === 'gollum') {
        if (seen.local >= LEADS) gollum.at(at2.x, at2.y, at2.z, clock, { pose: 'crawl' });
        return { hide: true };
      }
      if (id !== 'frodo') return null;
      const t = seen.since.faces;
      if (!live(t) || t >= MARKS.faces.hold || Math.abs(seen.local - MARKS.faces.at) > 0.5) return null;
      // (drawn down to the water on his front, then Sam’s hand on him)
      const k = smooth(t / 2) * (1 - smooth((t - MARKS.faces.hold + 2) / 1.5));
      const x = at2.x + k * 4;
      const z = at2.z + k * 3;
      return { x, y: heightAt(x, z), z, yaw: Math.PI / 2, base: k > 0.3 ? 'lie.down' : undefined, speed: 0 };
    },
    dispose() {
      gollum.dispose();
      fell.dispose();
      for (const w of waters) w.dispose();
      props.dispose();
      marshes.dispose();
      town.dispose();
      group.removeFromParent();
    },
  };
}
