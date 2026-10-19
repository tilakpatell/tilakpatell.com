// The Shire’s edge (the plan’s Task 18, on Hobbiton’s recipe): Maggot’s
// crop with Merry and Pippin out of it, the hollow where a Black Rider
// stands over the roots the four hide under and searches, the run in the
// rain, and Bucklebury Ferry: the raft carries them over the Brandywine
// while the Rider reins in at the landing behind. The data is the stage’s
// row (stages/index.js), its beats.js and lore.js; this file only draws,
// each beat’s scene a function of where the walker is (`local`) and how
// long since the beat began (`since[id]`), so walking back puts it back.
//
//   build(ctx) → { group, update(local, dt, { since, speed }), floor(x, z), dispose }
//   ctx: { road, heightAt, land, rt, weather, ambience, tier }

import * as THREE from 'three';
import { walker } from '../../cast';
import { createNazgulKit } from '../../creatures/nazgul';
import { search } from '../../creatures/nazgul.rules';
import { riverLevel } from '../../terrain';
import { BANK, BEECH, FAR, GAP, LANDING, RAFT, buildProps } from './props';

const RAFT_AT = { from: LANDING.z[1] + RAFT.d / 2, to: FAR.z[0] - RAFT.d / 2, lead: 2.4 }; // its middle: at the near stage, at the far, and ahead of the walker’s mark
const ROOTS = { from: 112, stop: BEECH[1] + 3, x: (BANK.x[0] + BANK.x[1]) / 2 + 0.4, come: 5, look: 11, gone: 34 }; // the Rider on the bank: from, where it stands, its seconds
const FERRY = { from: 88, stop: LANDING.z[0] + 1, ride: 5.5 }; // the Rider down the lane to the landing, in seconds
const RUN_AT = 104; // m: the rain comes on

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

export function build({ road, heightAt, land, rt, weather, ambience }) {
  const group = new THREE.Group();
  group.name = 'stage:shire-edge';
  const material = road.material({ vertexColors: true, flatShading: true });
  const river = land?.rivers?.[0] ?? null;
  const along = river ? riverLevel(heightAt, river) : null;
  // (the water under the lane at z: the river’s level where its line crosses x = 0)
  const level = (z) => (along ? along(river.line.length / 2 + (z - 150) * 0.02) : heightAt(0, z));
  const props = buildProps({ material, heightAt, level });
  group.add(props.group);
  const deck = level(150) + RAFT.deck;

  // the two from the corn: theirs until the line takes them up, two metres on
  const runners = ['merry', 'pippin'].map((name, i) => {
    const w = walker(name, { rt, seed: 40 + i });
    group.add(w.group);
    return w;
  });

  const kit = createNazgulKit(rt, road);
  const rider = kit.rider({ mounted: true, seed: 5 });
  rider.group.visible = false;
  group.add(rider.group);

  let rain = null;
  let hissed = false;
  let raftZ = RAFT_AT.from;
  let bob = 0;

  const place = (x, z, yaw, speed, y = heightAt(x, z)) => {
    rider.group.visible = true;
    rider.group.position.set(x, y, z);
    rider.group.rotation.y = yaw;
    rider.set({ speed });
  };

  return {
    group,
    update(local, dt, { since = {} } = {}) {
      // Merry and Pippin, out of the gap and into the lane while the beat holds
      const m = since.mushrooms;
      const out = m != null && local < GAP[1] + 2;
      runners.forEach((w, i) => {
        w.group.visible = out;
        if (!out) return;
        const k = smooth(m / 3.2 - i * 0.15);
        const x = GAP[0] + 2.5 - k * (GAP[0] + 2.5 - (i ? -0.45 : 0.45));
        const z = GAP[1] + 1 + i * 1.6 + k * 2;
        w.group.position.set(x, heightAt(x, z), z);
        w.group.rotation.y = k < 1 ? -Math.PI / 2 : 0;
        w.set({ base: k < 1 ? 'jog' : null, speed: k < 1 ? 2.2 : 0 });
        w.tick(dt);
      });

      // the Rider: over the roots, then down the lane to the ferry, else nowhere
      const r = since.roots;
      const f = since.ferry;
      if (f != null && Number.isFinite(f)) {
        const k = smooth(f / FERRY.ride);
        const z = FERRY.from + (FERRY.stop - FERRY.from) * k;
        place(0, z, 0, k < 1 ? 7 : 0, Math.max(heightAt(0, z), z > LANDING.z[0] ? props.decks.near : -Infinity));
        rider.set(k < 1 ? { yaw: 0, pitch: 0 } : { yaw: Math.sin(f) * 0.25, pitch: 0.15 });
      } else if (r != null && Number.isFinite(r) && r < ROOTS.gone) {
        const top = heightAt(BANK.x[0], BEECH[1]) + BANK.top - 0.1;
        if (r < ROOTS.come) {
          const z = ROOTS.from + (ROOTS.stop - ROOTS.from) * smooth(r / ROOTS.come);
          place(ROOTS.x, z, Math.PI, 1.2, top);
          rider.set({ yaw: 0, pitch: 0 });
        } else if (r < ROOTS.look) {
          place(ROOTS.x, ROOTS.stop, Math.PI, 0, top);
          const s = search(r - ROOTS.come);
          rider.set({ yaw: s.yaw, pitch: s.pitch });
          // (it breathes in over the roots: the wraith’s hiss while it searches)
          if (!hissed) {
            hissed = true;
            ambience?.beat?.('wraith');
          }
        } else {
          const z = ROOTS.stop - (r - ROOTS.look) * 2;
          place(ROOTS.x, z, Math.PI, 2, z > BANK.z[0] ? top : heightAt(ROOTS.x, z));
          rider.set({ yaw: 0, pitch: 0 });
        }
      } else rider.group.visible = false;
      if (rider.group.visible) rider.tick(dt);
      const searching = r != null && r >= ROOTS.come && r < ROOTS.look;
      if (hissed && !searching) {
        hissed = false;
        ambience?.beat?.('wraith:off');
      }

      // the rain, from the run on; gone again walking back before it
      if (local >= RUN_AT && !rain) rain = weather?.kind?.('rain', { follow: true }) ?? null;
      else if (local < RUN_AT - 6 && rain) {
        rain.stop();
        rain = null;
      }

      // the raft: at the near stage, then under the line as it crosses, then at the far
      raftZ = Math.min(RAFT_AT.to, Math.max(RAFT_AT.from, local + RAFT_AT.lead));
      bob += dt;
      props.raft.position.set(0, deck + Math.sin(bob * 1.1) * 0.03, raftZ);
    },
    // the walkers stand on the stages and the raft where they are over the water
    floor(x, z) {
      if (Math.abs(x) > RAFT.w / 2) return null;
      if (z >= LANDING.z[0] && z <= LANDING.z[1]) return props.decks.near;
      if (z >= FAR.z[0] && z <= FAR.z[1]) return props.decks.far;
      if (Math.abs(z - raftZ) <= RAFT.d / 2) return deck;
      return null;
    },
    dispose() {
      rain?.stop();
      if (hissed) ambience?.beat?.('wraith:off');
      props.dispose();
      kit.dispose();
      for (const w of runners) w.dispose();
      material.dispose();
      group.removeFromParent();
    },
  };
}
