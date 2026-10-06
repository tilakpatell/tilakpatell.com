import { describe, expect, it } from 'vitest';
import { AREAS } from './areas';
import { ENEMY_KINDS, ROBOT, VEHICLE, newEnemy, overlap } from './rules';
import { createSim } from './sim';

// Played at random, for a long while, in every area: whatever's pressed,
// however long a frame takes, nothing breaks. Optimus (or Megatron) never
// ends up inside a wall or out of the world, nothing goes NaN, health and
// boost stay in their bounds, and the Decepticons (or the Autobots) stay
// sane too.
const seeded = (seed) => {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);
};
const finite = (o, keys) => keys.every((k) => Number.isFinite(o[k]));

function play(areaId, seed, frames) {
  const rand = seeded(seed);
  const sim = createSim({ area: areaId, rand });
  const problems = [];
  let input = {};
  let hold = 0;
  const kinds = Object.keys(ENEMY_KINDS);
  for (let f = 0; f < frames && problems.length < 5; f++) {
    // (a new thing held every half second or two: walk, drive, jump, shoot)
    if ((hold -= 1) <= 0) {
      hold = 30 + Math.floor(rand() * 90);
      input = {
        moveX: rand() * 2 - 1,
        moveZ: rand() * 2 - 1,
        run: rand() < 0.4,
        jump: false,
        throttle: rand() * 2 - 0.6,
        steer: rand() * 2 - 1,
        boost: rand() < 0.3,
        fire: rand() < 0.5,
        transform: false,
        use: false,
        aimYaw: rand() * Math.PI * 2,
        aimPitch: rand() * 0.8 - 0.4,
      };
    }
    const step = { ...input, jump: rand() < 0.03, transform: rand() < 0.008 };
    // (frames as they come: steady, stuttering, and now and then a long one)
    const dt = rand() < 0.01 ? 0.25 + rand() : rand() < 0.2 ? 1 / 30 : 1 / 60;
    // (Decepticons now and then, of every kind, somewhere about)
    if (rand() < 0.004 && sim.enemies.length < 14) {
      const kind = kinds[Math.floor(rand() * kinds.length)];
      const a = rand() * Math.PI * 2;
      const e = newEnemy(kind, sim.player.x + Math.cos(a) * 60, sim.player.z + Math.sin(a) * 60, { id: `fz-${f}` });
      e.y = sim.world.floorAt(e.x, e.z, 50, 60);
      sim.enemies.push(e);
    }
    try {
      sim.step(step, dt);
      if (rand() < 0.01) sim.use();
      if (sim.exit) sim.enter(sim.exit.to, sim.exit.at);
      if (f % 50 === 0) sim.hud();
    } catch (err) {
      problems.push(`frame ${f}: threw ${err.message}`);
      break;
    }
    const p = sim.player;
    const where = `${sim.area.id} frame ${f} at ${p.x?.toFixed?.(1)},${p.y?.toFixed?.(1)},${p.z?.toFixed?.(1)} (${p.mode})`;
    if (!finite(p, ['x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'hp', 'boost', 'speed'])) problems.push(`${where}: not a number`);
    const B = sim.world.bounds;
    if (p.x < B.minX - 0.01 || p.x > B.maxX + 0.01 || p.z < B.minZ - 0.01 || p.z > B.maxZ + 0.01) problems.push(`${where}: out of bounds`);
    if (p.y < -0.01) problems.push(`${where}: below the ground`);
    if (p.hp < 0 || p.hp > p.maxHp || p.boost < -1e-6 || p.boost > 1 + 1e-6) problems.push(`${where}: hp ${p.hp} boost ${p.boost}`);
    if (!p.dead && !p.shifting) {
      const r = p.mode === 'vehicle' ? VEHICLE.radius : ROBOT.radius;
      const h = p.mode === 'vehicle' ? VEHICLE.height : ROBOT.height;
      const step2 = p.mode === 'vehicle' ? VEHICLE.step : ROBOT.step;
      for (const s of sim.world.near(p.x, p.z, r)) {
        if ((s.base ?? 0) >= p.y + h || s.top <= p.y + step2) continue;
        const o = overlap(s, p.x, p.z, r);
        if (o && o.depth > 0.05) problems.push(`${where}: ${o.depth.toFixed(2)} m inside ${s.tag ?? s.kind}`);
      }
    }
    for (const e of sim.enemies) if (!finite(e, ['x', 'y', 'z', 'hp', 'yaw'])) problems.push(`${where}: enemy ${e.kind} not a number`);
    if (sim.shots.length > 400) problems.push(`${where}: ${sim.shots.length} shots in the air`);
  }
  return problems;
}

describe('the world, played at random', () => {
  for (const id of Object.keys(AREAS))
    it(`holds together in ${id}`, () => {
      const problems = [1, 2, 3].flatMap((seed) => play(id, seed * 7919 + id.length, 9000));
      expect(problems).toEqual([]);
    });
});
