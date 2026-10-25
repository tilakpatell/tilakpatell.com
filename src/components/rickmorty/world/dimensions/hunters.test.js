import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createNpcs } from '../npc';
import { MORTY, nearHotspot } from '../rules';
import { destinationById } from './destinations';

// A place's hunters let loose on Morty standing still wherever he stands to
// play its game (each of the game's spots, every point a stride apart from
// which E reaches it): who catches him, if anyone, inside `s` seconds.
const figure = (x, z) => {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  return { group, height: 1.7, update() {}, look() {}, react() {}, play() {}, stop() {} };
};
const inSolid = (d, x, z) => d.solids.some((o) => (o.r != null ? Math.hypot(x - o.x, z - o.z) < o.r + MORTY.radius : Math.abs(x - o.x) < o.w / 2 + MORTY.radius && Math.abs(z - o.z) < o.d / 2 + MORTY.radius));
function caughtAt(d, x, z, s = 15) {
  const N = createNpcs({ id: d.id, area: d.area, solids: d.solids, words: { caught: d.caught } });
  const all = [...d.people, ...d.extras];
  const list = all.filter((p) => p.ai).map((p, i) => N.add(figure(p.x, p.z), { x: p.x, z: p.z, face: p.face, ai: p.ai, id: p.id ?? `extra-${i}` }));
  N.hunt(true);
  let who = null;
  const state = { morty: { x, z, face: 0, speed: 0 }, done: [], fading: false, emit: (name, e) => name === 'caught' && (who ??= e.who) };
  const dt = 1 / 30;
  for (let t = dt; t <= s && !who; t += dt) for (const n of list) N.step(n, t, dt, state);
  return who;
}
// where he can stand to use spot `id`, a stride apart
function standing(d, id, step = 0.6) {
  const h = d.hotspots.find((o) => o.id === id);
  const at = [];
  for (let dx = -h.r; dx <= h.r + 1e-9; dx += step)
    for (let dz = -h.r; dz <= h.r + 1e-9; dz += step) {
      const [x, z] = [h.x + dx, h.z + dz];
      if (Math.hypot(dx, dz) <= h.r && !inSolid(d, x, z) && nearHotspot(d.id, x, z)?.id === id) at.push([x, z]);
    }
  return at;
}

describe('a place’s hunters at its game', () => {
  it('runs him down wherever he stands to lift a booth or start Heist-Con’s job, its counters no wall between them', () => {
    const d = destinationById('heistcon');
    for (const id of [d.sequence.start, ...d.sequence.items]) {
      const at = standing(d, id);
      expect(at.length, id).toBeGreaterThan(4);
      const free = at.filter(([x, z]) => !caughtAt(d, x, z)).map(([x, z]) => [+(x - d.centre.x).toFixed(1), +(z - d.centre.z).toFixed(1)]);
      expect(free, `${id}: never caught at`).toEqual([]);
    }
  });

  it('runs him down in Heist-Con’s rope lanes, so the lanes are no place to hide during the job', () => {
    // (the ropes are drawn only: steered with no path to follow, a recruit
    // pressed to a rope's far side would never get round one that stopped him)
    const d = destinationById('heistcon');
    const free = [
      [0, 0],
      [3.3, 0],
      [-3.3, 0],
      [3.3, 4],
      [-3.3, -4],
    ].filter(([dx, dz]) => !caughtAt(d, d.centre.x + dx, d.centre.z + dz));
    expect(free, 'never caught at').toEqual([]);
  });

  it('runs him down wherever he stands to wind one of Gear World’s cogs', () => {
    const d = destinationById('gearworld');
    for (const id of d.sequence.items) {
      const at = standing(d, id);
      expect(at.length, id).toBeGreaterThan(4);
      const free = at.filter(([x, z]) => !caughtAt(d, x, z)).map(([x, z]) => [+(x - d.centre.x).toFixed(1), +(z - d.centre.z).toFixed(1)]);
      expect(free, `${id}: never caught at`).toEqual([]);
    }
  });
});
