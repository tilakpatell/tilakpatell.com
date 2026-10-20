// Moria’s landmarks, built with the Moria chapter’s own builders
// (towns/moria/{chamber,halls,bridge,balrog,orcs}.js) on the Road’s Moria
// kit: the way in from the Doors between walls of dark stone; the Chamber of
// Mazarbul off it on the right, Balin’s tomb in its shaft of grey light; the
// Dwarrowdelf, a grid of the great carved pillars under a roof lost in the
// dark; the broken stair down; the Bridge of Khazad-dûm over the abyss in
// two spans, the near one to break under the Balrog; Durin’s Bane; and the
// goblins on the pillars. In the stage’s frame: the road along +z from 0,
// +x on the walker’s left.
//
//   buildProps({ K, road, heightAt, tier }) → { group, chamber, near, balrog, goblins, floor(x, z, broken), low, high, room, dispose }
//   CHAMBER, HALL, STAIR, SPAN: where they stand, for the beats and the scene

import * as THREE from 'three';
import { chamber as buildChamber } from '../../../towns/moria/chamber';
import { hall as buildHall, stairs as buildStairs } from '../../../towns/moria/halls';
import { bridge as buildBridge } from '../../../towns/moria/bridge';
import { balrog as buildBalrog } from '../../../towns/moria/balrog';
import { goblin as buildGoblin } from '../../../towns/moria/orcs';
import { mergeStatics } from '../parts';

export const CHAMBER = { at: [-14, 24], door: 7.5 }; // Mazarbul, its doorway to the road (+x)
export const HALL = { at: [4.5, 56], w: 45, d: 36, top: 22 }; // the Dwarrowdelf, z 38 to 74, its pillars clear of the road
export const STAIR = { head: 76, foot: 90.4 }; // the broken stair, down along +z
export const SPAN = { z: [92, 124], near: [92, 100] }; // the Bridge; the near span breaks
const WAY = { z: [-2, 38], half: 4.5, h: 7 }; // the way in from the Doors

export function buildProps({ K, road, heightAt, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'moria:props';
  const high = heightAt(HALL.at[0], HALL.at[1]); // the halls’ floor (levelled under them)
  const room = heightAt(CHAMBER.at[0], CHAMBER.at[1]); // the Chamber’s, levelled under it
  const low = heightAt(0, 130); // the deep: the Bridge, the stair’s foot

  // the way in: walls of dark stone either side and a roof, the right wall
  // opening onto the passage to the Chamber
  const stone = road.material({ color: 0x3e4446, flatShading: true });
  const wall = (x, z0, z1) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, WAY.h, z1 - z0), stone);
    m.position.set(x, heightAt(x, (z0 + z1) / 2) + WAY.h / 2 - 0.5, (z0 + z1) / 2);
    group.add(m);
  };
  wall(WAY.half, WAY.z[0], WAY.z[1]);
  wall(-WAY.half, WAY.z[0], CHAMBER.at[1] - 3.5);
  wall(-WAY.half, CHAMBER.at[1] + 3.5, WAY.z[1]);
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.5, WAY.h, 0.8), stone);
    m.position.set(-WAY.half - 1.2, room + WAY.h / 2 - 0.5, CHAMBER.at[1] + s * 3.5);
    group.add(m);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(WAY.half * 2 + 1, 0.8, WAY.z[1] - WAY.z[0]), stone);
  roof.position.set(0, heightAt(0, (WAY.z[0] + WAY.z[1]) / 2) + WAY.h - 0.5, (WAY.z[0] + WAY.z[1]) / 2);
  group.add(roof);

  // the Chamber of Mazarbul, its doorway (the chapter’s +z) to the road
  const chamber = buildChamber(K);
  chamber.group.position.set(CHAMBER.at[0], room, CHAMBER.at[1]);
  chamber.group.rotation.y = Math.PI / 2;
  chamber.doors?.open?.(1);
  // (the dust in the beam is the chapter shader’s to place: none here)
  chamber.group.traverse((o) => {
    if (o.isPoints) o.visible = false;
  });
  group.add(chamber.group);

  // the Dwarrowdelf (on low a narrower bay of it)
  const hall = buildHall(K, { w: tier === 'low' ? 27 : HALL.w, d: HALL.d, step: 9, top: HALL.top });
  hall.group.position.set(HALL.at[0], high, HALL.at[1]);
  group.add(hall.group);

  // the broken stair, its head at the hall’s floor and its foot in the deep
  // (the chapter’s goes down along -x: turned to go down along +z)
  const stair = buildStairs(K);
  stair.group.position.set(0, low, STAIR.foot);
  stair.group.rotation.y = Math.PI / 2;
  stair.group.scale.set((STAIR.foot - STAIR.head) / stair.run, (high - low) / stair.rise, 1);
  group.add(stair.group);

  // the Bridge: the far span with the abyss and its fire under it, and the
  // near span alone (the one that breaks), its own abyss left out
  const along = (b, z0, z1) => {
    b.group.position.set(0, low, (z0 + z1) / 2);
    b.group.rotation.y = Math.PI / 2;
    group.add(b.group);
    return b;
  };
  const far = along(buildBridge(K, SPAN.z[1] - SPAN.near[1]), SPAN.near[1], SPAN.z[1]);
  far.glow.set(1);
  const near = along(buildBridge(K, SPAN.near[1] - SPAN.near[0]), SPAN.near[0], SPAN.near[1]);
  near.group.traverse((o) => {
    if (o.isPoints || o.material?.uniforms) o.visible = false;
  });
  // (the sparks’ points are the chapter shader’s to place: none here)
  far.group.traverse((o) => {
    if (o.isPoints) o.visible = false;
  });

  // Durin’s Bane, facing up the span toward Gandalf
  const balrog = buildBalrog(K);
  balrog.group.rotation.y = -Math.PI / 2;
  balrog.group.visible = false;
  group.add(balrog.group);

  // the goblins on the pillars (on low, three)
  const goblins = Array.from({ length: tier === 'low' ? 3 : 6 }, (_, i) => {
    const gob = buildGoblin(K, i + 1);
    gob.group.visible = false;
    group.add(gob.group);
    return gob;
  });

  // (the still parts one a material: the moving and the breaking left)
  mergeStatics(group, { keep: [near.group, balrog.group, ...goblins.map((g) => g.group), far.group] });

  // what carries the walkers: the stair down, the spans over the abyss (the near one until it breaks)
  const floor = (x, z, broken = false) => {
    if (Math.abs(x) <= 1.6 && z >= STAIR.head && z <= STAIR.foot) return high - ((z - STAIR.head) / (STAIR.foot - STAIR.head)) * (high - low);
    if (Math.abs(x) <= 1.1 && z >= SPAN.z[0] && z <= SPAN.z[1]) return broken && z < SPAN.near[1] ? null : low;
    return null;
  };

  return {
    group,
    chamber,
    near,
    far,
    balrog,
    goblins,
    floor,
    low,
    high,
    room,
    dispose() {
      group.removeFromParent();
      group.traverse((o) => o.geometry?.dispose());
      stone.dispose();
    },
  };
}
