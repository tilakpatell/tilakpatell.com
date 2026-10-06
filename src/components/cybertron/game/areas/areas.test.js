import { describe, expect, it } from 'vitest';
import { MODELS } from '../catalog';
import { ENEMY_KINDS, ROBOT, VEHICLE, buildWorld } from '../rules';
import { AREAS, MISSIONS, missionById } from './index';

// whether a circle at (x, z) of radius r is clear of every solid that would
// block it (taller than a step)
function clearAt(world, x, z, r) {
  for (const s of world.solids) {
    if (s.top <= ROBOT.step) continue;
    if (s.kind === 'circle') {
      if (Math.hypot(x - s.x, z - s.z) < s.r + r) return false;
      continue;
    }
    const dx = x - s.x;
    const dz = z - s.z;
    const lx = dx * s.c - dz * s.s;
    const lz = dx * s.s + dz * s.c;
    const cx = Math.max(-s.hw, Math.min(s.hw, lx));
    const cz = Math.max(-s.hd, Math.min(s.hd, lz));
    if (Math.hypot(lx - cx, lz - cz) < r) return false;
  }
  return true;
}

describe.each(Object.values(AREAS))('$name', (area) => {
  const world = buildWorld(area);

  it('starts everyone clear of the walls, robot or truck', () => {
    for (const at of [area.spawn, ...Object.values(area.spawns)]) {
      expect(clearAt(world, at.x, at.z, ROBOT.radius), `${area.id} at ${at.x},${at.z}`).toBe(true);
      expect(clearAt(world, at.x, at.z, VEHICLE.radius), `${area.id} at ${at.x},${at.z} (truck)`).toBe(true);
    }
  });

  it('has a way back through every bridge', () => {
    for (const x of area.exits) {
      const to = AREAS[x.to];
      expect(to, `${x.id} goes to ${x.to}`).toBeTruthy();
      expect(to.exits.some((y) => y.to === area.id)).toBe(true);
      expect(to.spawns[x.at], `${x.to} has a spawn ${x.at}`).toBeTruthy();
    }
  });

  it("only has models the catalogue has", () => {
    const kinds = [area.player.robot, ...(area.player.vehicle ? [area.player.vehicle] : []), ...area.people.map((p) => p.kind), ...(area.watchers ?? []).map((w) => w.kind), ...(area.stage.parked ?? []).map((p) => p.kind), ...(area.stage.flyovers ?? []), ...(area.stage.watcher ? [area.stage.watcher.kind] : [])];
    for (const k of kinds) expect(MODELS[k], k).toBeTruthy();
    for (const m of area.missions) for (const st of m.steps) for (const e of st.spawn ?? []) expect(Object.keys(ENEMY_KINDS)).toContain(e.kind);
  });

  it('gives each mission to someone who is there, and talks to people who exist', () => {
    const everyone = Object.values(AREAS).flatMap((a) => a.people.map((p) => p.id));
    for (const m of area.missions) {
      expect(area.people.map((p) => p.id)).toContain(m.giver);
      for (const st of m.steps) if (st.type === 'talk') expect(everyone).toContain(st.target);
      for (const r of m.requires ?? []) expect(missionById(r), `${m.id} needs ${r}`).toBeTruthy();
    }
  });

  it('puts every gate and goal inside the bounds, on open ground', () => {
    const B = area.bounds;
    const spots = MISSIONS.filter((m) => m.area === area.id).flatMap((m) => m.steps.flatMap((st) => [...(st.gates ?? []), ...(st.at ? [st.at] : [])]));
    for (const g of spots) {
      expect(g.x > B.minX && g.x < B.maxX && g.z > B.minZ && g.z < B.maxZ).toBe(true);
      expect(clearAt(world, g.x, g.z, 0.5), `${area.id} goal at ${g.x},${g.z}`).toBe(true);
    }
  });

  it('keeps people and pickups out of the walls', () => {
    for (const p of area.people) expect(clearAt(world, p.x, p.z, ROBOT.radius), `${p.id}`).toBe(true);
    for (const k of area.pickups) expect(clearAt(world, k.x, k.z, 0.5), `${k.id}`).toBe(true);
  });
});

it('names every pickup once', () => {
  const ids = Object.values(AREAS).flatMap((a) => a.pickups.map((k) => k.id));
  expect(new Set(ids).size).toBe(ids.length);
});

it('names every mission once, each with an achievement', () => {
  const ids = MISSIONS.map((m) => m.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const m of MISSIONS) expect(m.achievement, m.id).toBeTruthy();
});
