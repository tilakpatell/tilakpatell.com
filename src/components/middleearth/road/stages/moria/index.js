// Moria (the plan’s Task 24, on Hobbiton’s recipe): in from the Doors in
// the black with Gandalf’s staff the one light; the Chamber of Mazarbul,
// Gimli knelt at Balin’s tomb in its shaft of grey daylight, the company
// round him; the drums and the goblins swarming down the pillars; the
// Dwarrowdelf’s hall; the broken stair down to the deep; the Bridge: the
// company across, Gandalf turned on the span, the Balrog come up behind
// them, the staff brought down, the near span gone under it, the whip and
// the fall; and out of the East-gate into the Dimrill Dale, the Mirrormere
// grey under a January sky. This file only draws, each beat’s scene a
// function of where the walker is (`local`) and how long since the beat
// began (`since[id]`), so walking back puts it back: the bridge whole and
// Gandalf on it.
//
//   build(ctx) → { group, update(local, dt, { since }), floor(x, z), pose(id, at), dispose }
//   ctx: { road, heightAt, rt, weather, tier, sky }

import * as THREE from 'three';
import { SpriteNodeMaterial } from 'three/webgpu';
import { createTownKit } from '../../townKit';
import { addMoria } from '../../moriaKit';
import { createWater } from '../../water';
import { BRIDGE_SECONDS, stance } from '../../creatures/balrog.rules';
import { CHAMBER, HALL, SPAN, STAIR, buildProps } from './props';
import { BEATS } from './beats';

const MARKS = Object.fromEntries(BEATS.map((b) => [b.id, b]));
const OUT = 128; // m: the East-gate; past it the staff is put out
const STAND = 101.5; // m: where Gandalf turns on the span
const COMES = [86, 95]; // m: the Balrog up the stair’s foot to the near span’s end, in its first seconds
const DROP = 70; // m it falls
const MERE = { area: { x0: 14, z0: 146, w: 32, d: 30 }, at: [28, 160] };
// the company in the Chamber, round Gimli at the tomb (x, z, facing the tomb)
const ROUND = {
  aragorn: [-10.4, 22.2],
  legolas: [-10.2, 26.2],
  gandalf: [-11.2, 27.4],
  boromir: [-9.6, 24.6],
  frodo: [-9.8, 21.2],
  sam: [-9.2, 22.6],
  merry: [-9.1, 26.8],
  pippin: [-8.8, 25.6],
};
// the company across the Bridge, on its far end, turned back to watch (x, z)
const ACROSS = { frodo: [-1, 121.5], sam: [-0.2, 122.4], merry: [-1.4, 123.2], pippin: [0.4, 123.6], aragorn: [-0.6, 124.4], boromir: [0.8, 124.9], legolas: [-1.2, 125.3], gimli: [0.2, 125.8] };

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
const live = (t) => t != null && Number.isFinite(t);

export function build({ road, heightAt, rt, tier = 'high', sky = null }) {
  const group = new THREE.Group();
  group.name = 'stage:moria';
  const renderer = rt?.gfx?.renderer ?? null;
  const town = createTownKit(road, renderer, { wild: true });
  const moria = addMoria(town, road, renderer, { deep: true });
  const props = buildProps({ K: town.K, road, heightAt, tier });
  group.add(props.group);

  // Gandalf’s staff: a cold light at its head, and its glow
  const staff = new THREE.PointLight(0xdfe9ff, 0, 24, 1.3);
  group.add(staff);
  const glowMat = new SpriteNodeMaterial({ map: moria.tex.glow, color: new THREE.Color(1.6, 1.8, 2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const halo = new THREE.Sprite(glowMat);
  halo.scale.setScalar(1.2);
  group.add(halo);
  // the grey daylight down the shaft onto Balin’s tomb
  const shaft = new THREE.PointLight(0xdfe6f0, 0, 14, 1.2);
  shaft.position.set(CHAMBER.at[0], props.room + 5, CHAMBER.at[1]);
  group.add(shaft);
  // the fire in the abyss, red up the span and the Balrog
  const fire = new THREE.PointLight(0xff5a1c, 0, 90, 1.2);
  fire.position.set(0, props.low - 30, (SPAN.z[0] + SPAN.z[1]) / 2);
  group.add(fire);

  // the Mirrormere in its hollow in the Dale
  const level = heightAt(...MERE.at) + 2;
  const mere = createWater({ area: MERE.area, level, kind: 'still', sky, ground: heightAt });
  mere.set({ sun: { el: 0.3 }, ambient: 0.32 });
  group.add(mere.mesh);

  let clock = 0;
  let gandalf = null; // where the line has him this frame (pose)
  const seen = { since: {}, local: 0 };

  const bridgeT = () => {
    const t = seen.since.bridge;
    return t == null ? -1 : t === Infinity ? BRIDGE_SECONDS : t;
  };

  return {
    group,
    update(local, dt, { since = {} } = {}) {
      seen.since = since;
      seen.local = local;
      clock += dt;
      moria.tick(clock);
      mere.update(dt);
      props.chamber.update(clock);

      // the staff: lit on Gandalf from the Doors to the East-gate, while he walks with them
      const lit = local < OUT && gandalf != null;
      // (in the Dwarrowdelf he risks a little more light: the staff flares and the hall shows)
      const h = since.dwarrowdelf;
      const more = live(h) && local < HALL.at[1] + HALL.d / 2 ? smooth(h / 3) : 0;
      staff.intensity = lit ? 42 + 1400 * more : 0;
      staff.distance = 24 + 70 * more;
      halo.scale.setScalar(1.2 + 2.4 * more);
      shaft.intensity = Math.abs(local - CHAMBER.at[1]) < 20 ? 60 : 0;
      halo.visible = lit;
      if (lit) {
        staff.position.set(gandalf.x + 0.35, gandalf.y + 2.1, gandalf.z + 0.2);
        halo.position.copy(staff.position);
      }
      gandalf = null;

      // the goblins down the pillars on the drums, and running on the floor after
      const d = since.drums;
      const swarm = live(d) && d < 30 && local < STAIR.head;
      props.goblins.forEach((gob, i) => {
        gob.group.visible = swarm;
        if (!swarm) return;
        const col = HALL.at[0] + (i % 2 ? -9 : 9) * (1 + (i % 3));
        const z = HALL.at[1] - 9 + (i % 3) * 9 + (i % 2 ? 1.6 : -1.6);
        const down = smooth((d - i * 0.4) / 5);
        gob.group.position.set(col + (i % 2 ? 1.5 : -1.5), props.high + (1 - down) * 14, z);
        gob.group.rotation.set(0, i % 2 ? Math.PI : 0, down < 1 ? -Math.PI / 2 : 0);
        gob.animate(clock + i, { running: down >= 1 });
      });

      // the Bridge: the Balrog come up behind them; the staff down, the near span gone,
      // the whip, the fall; Gandalf dragged over after it
      const t = bridgeT();
      const st = stance(Math.max(0, t));
      const near = local > COMES[0] - 10 && local < OUT;
      props.balrog.group.visible = near && t >= 0 && st.fall < 1;
      fire.intensity = near ? 900 : 0;
      if (props.balrog.group.visible) {
        const z = COMES[0] + (COMES[1] - COMES[0]) * smooth(t / 4);
        props.balrog.group.position.set(0, props.low - st.fall * DROP, z);
        props.balrog.update(clock, { rage: st.wings, whip: st.whip });
      }
      const drop = st.broken ? smooth((t - 11) / 3) : 0;
      props.near.group.position.y = props.low - drop * DROP;
      props.near.group.rotation.x = drop * 0.6;
      props.near.group.visible = drop < 1;
    },
    floor(x, z) {
      return props.floor(x, z, stance(Math.max(0, bridgeT())).broken);
    },
    // the company round the tomb while its beat holds; across the Bridge
    // while it holds, Gandalf on the span facing the Balrog, and over the edge
    pose(id, at) {
      if (id === 'gandalf') gandalf = at;
      const held = (beat) => {
        const b = MARKS[beat];
        const t = seen.since[beat];
        return t != null && Number.isFinite(t) && t < b.hold && Math.abs(seen.local - b.at) < 0.5;
      };
      if (held('tomb')) {
        if (id === 'gimli') return { x: CHAMBER.at[0] + 1.7, y: props.room, z: CHAMBER.at[1], yaw: -Math.PI / 2, base: 'kneel.fix', speed: 0 };
        const p = ROUND[id];
        if (p) return { x: p[0], y: props.room, z: p[1], yaw: Math.atan2(CHAMBER.at[0] - p[0], CHAMBER.at[1] - p[1]), base: 'idle', speed: 0 };
      }
      if (held('bridge')) {
        const t = seen.since.bridge;
        if (id === 'gandalf') {
          const st = stance(t);
          const pos = { x: 0, y: props.low - st.gandalf * DROP * 0.6, z: STAND - st.gandalf * 2.5, yaw: Math.PI, base: 'idle', speed: 0 };
          gandalf = pos;
          return st.gandalf >= 1 ? { ...pos, hide: true } : pos;
        }
        const p = ACROSS[id];
        if (p) return { x: p[0], y: props.low, z: p[1], yaw: Math.PI, base: 'idle', speed: 0 };
      }
      return null;
    },
    dispose() {
      mere.dispose();
      props.dispose();
      glowMat.dispose();
      moria.dispose();
      town.dispose();
      group.removeFromParent();
    },
  };
}
