import { describe, expect, it } from 'vitest';
import { MISSIONS, missionById } from './areas';
import { segmentClear } from './rules';
import { createSim } from './sim';

const still = { moveX: 0, moveZ: 0, run: false, jump: false, throttle: 0, steer: 0, boost: false, fire: false, transform: false, use: false, aimYaw: 0, aimPitch: 0 };
const tick = (sim, input = {}, seconds = 0.1) => {
  const out = [];
  for (let t = 0; t < seconds; t += 1 / 60) out.push(...sim.step({ ...still, ...input }, 1 / 60));
  return out;
};
const goTo = (sim, x, z) => {
  sim.player.x = x;
  sim.player.z = z;
  tick(sim);
};

describe('the world, played', () => {
  it('starts in Iacon with nobody hostile about', () => {
    const sim = createSim();
    expect(sim.area.id).toBe('iacon');
    expect(sim.enemies).toHaveLength(0);
    expect(sim.hud().offers.length).toBeGreaterThan(0);
  });

  it('hands out a mission when you talk to its giver, and its Decepticons come', () => {
    const sim = createSim();
    const grim = sim.area.people.find((p) => p.id === 'grimlock');
    goTo(sim, grim.x - 4, grim.z);
    const out = sim.use();
    expect(out).toContainEqual(expect.objectContaining({ type: 'start', id: 'hold-gates' }));
    expect(sim.talk.name).toBe('Grimlock');
    // the first step was talking to him: on to the barricades
    expect(sim.missions.step).toBe(1);
    goTo(sim, 0, 300);
    expect(sim.missions.step).toBe(2);
    expect(sim.enemies.length).toBe(4);
  });

  it('counts the kills toward the wave', () => {
    const sim = createSim();
    const grim = sim.area.people.find((p) => p.id === 'grimlock');
    goTo(sim, grim.x - 4, grim.z);
    sim.use();
    goTo(sim, 0, 300);
    for (const e of sim.enemies) {
      e.hp = 1;
      e.x = sim.player.x;
      e.z = sim.player.z + 30;
    }
    let out = [];
    for (let k = 0; k < 200 && sim.missions.step === 2; k++) out = out.concat(tick(sim, { fire: true, aimYaw: 0, aimPitch: -0.05 }, 1 / 30));
    expect(out.some((e) => e.type === 'kill')).toBe(true);
    expect(sim.missions.step).toBe(3);
  });

  it('takes you through the space bridge and keeps the mission going', () => {
    const sim = createSim();
    const bee = sim.area.people.find((p) => p.id === 'bumblebee');
    goTo(sim, bee.x - 4, bee.z);
    sim.use();
    expect(sim.missions.active).toBe('energon-run');
    const bridge = sim.area.exits[0];
    goTo(sim, bridge.x + 3, bridge.z);
    const out = sim.use();
    expect(out).toContainEqual(expect.objectContaining({ type: 'exit', to: 'base' }));
    sim.enter(sim.exit.to, sim.exit.at);
    expect(sim.area.id).toBe('base');
    expect(sim.missions.active).toBe('energon-run');
    // the way back is shown
    expect(sim.hud().target.label).toMatch(/Iacon/);
  });

  it('won’t talk from the truck, and says to transform', () => {
    const sim = createSim();
    const bee = sim.area.people.find((p) => p.id === 'bumblebee');
    goTo(sim, bee.x - 4, bee.z);
    tick(sim, { transform: true }, 0.05);
    tick(sim, {}, 1.2);
    expect(sim.player.mode).toBe('vehicle');
    expect(sim.hud().near).toEqual(expect.objectContaining({ type: 'shift', label: 'Bumblebee' }));
    expect(sim.use()).toEqual([]);
    expect(sim.missions.active).toBeFalsy();
  });

  it('brings Optimus through a bridge on his feet even if he went down just before', () => {
    const sim = createSim();
    sim.player.hp = 1;
    sim.shots.push({ from: 'enemy', x: sim.player.x, y: sim.player.y + 5, z: sim.player.z - 3, vx: 0, vy: 0, vz: 60, ttl: 1, damage: 20 });
    tick(sim, {}, 0.2);
    expect(sim.player.dead).toBe(true);
    sim.enter('base');
    expect(sim.player.dead).toBe(false);
    expect(sim.player.hp).toBe(sim.player.maxHp);
    // (and the respawn that was coming doesn't come later, in the wrong place)
    const later = tick(sim, {}, 3.5);
    expect(later.some((e) => e.type === 'respawn')).toBe(false);
  });

  it('picks energon up and counts it', () => {
    const sim = createSim();
    const k = sim.pickups[0];
    goTo(sim, k.x, k.z);
    expect(sim.player.energon).toBe(1);
    expect(sim.pickups[0].taken).toBe(true);
  });

  it('mends Optimus a little with every energon cube', () => {
    const sim = createSim();
    sim.player.hp = 50;
    const k = sim.pickups[0];
    goTo(sim, k.x, k.z);
    expect(sim.player.hp).toBeGreaterThanOrEqual(50 + 15);
  });

  it('gets Optimus back up after he goes down', () => {
    const sim = createSim();
    sim.player.hp = 1;
    sim.enemies.push({ id: 'x', kind: 'trooper', x: 0, y: 0, z: 0, hp: 40, r: 1, h: 7, dead: false, state: 'advance', t: 0, cooldown: 0, dir: 1, yaw: 0 });
    sim.shots.push({ from: 'enemy', x: sim.player.x, y: sim.player.y + 5, z: sim.player.z - 3, vx: 0, vy: 0, vz: 60, ttl: 1, damage: 20 });
    const out = tick(sim, {}, 0.2);
    expect(out.some((e) => e.type === 'dead')).toBe(true);
    const back = tick(sim, {}, 3.2);
    expect(back.some((e) => e.type === 'respawn')).toBe(true);
    expect(sim.player.hp).toBe(100);
  });

  // A player who does what the HUD says, start to finish: every mission in
  // the order they open up, across the bridges, the way the page plays it
  // (Optimus can't be hurt here; it's the missions being tested, not him)
  it('plays every mission through by going where the HUD points', () => {
    const sim = createSim({ rand: () => 0.5 });
    const p = () => sim.player;
    const near = (x, z) => goTo(sim, x - 4, z);
    const cross = () => {
      if (sim.exit) sim.enter(sim.exit.to, sim.exit.at);
    };
    const robot = () => {
      if (p().mode === 'robot') return;
      tick(sim, { transform: true }, 0.05);
      tick(sim, {}, 1.2);
    };
    const finished = [];
    for (const m of MISSIONS) {
      for (let turn = 0; turn < 600 && !sim.missions.done.includes(m.id); turn++) {
        p().hp = p().maxHp;
        if (p().dead) tick(sim, {}, 3.2);
        // not on yet: to whoever gives it, where they are
        if (!sim.missions.active) {
          robot();
          if (sim.area.id !== m.from) {
            const x = sim.area.exits.find((e) => e.to === m.from);
            // (the other side's capital: no bridge goes there, you pick it)
            if (!x) {
              sim.enter(m.from);
              continue;
            }
            goTo(sim, x.x + 3, x.z);
            sim.use();
            cross();
            continue;
          }
          const giver = sim.area.people.find((q) => q.id === m.giver);
          near(giver.x, giver.z);
          sim.use();
          expect(sim.missions.active, `${m.id} from ${giver.name}`).toBe(m.id);
          continue;
        }
        const active = missionById(sim.missions.active);
        const step = active.steps[sim.missions.step];
        const target = sim.hud().target;
        // somewhere else, or a bridge to take: the HUD points at the bridge
        if ((step.area ?? active.area) !== sim.area.id || step.type === 'exit') {
          expect(target, `${active.id}: the way to ${step.area ?? active.area}`).toBeTruthy();
          robot();
          goTo(sim, target.x + 3, target.z);
          sim.use();
          cross();
          continue;
        }
        if (step.type === 'talk') {
          robot();
          near(target.x, target.z);
          sim.use();
        } else if (step.type === 'transform') {
          tick(sim, { transform: true }, 0.05);
          tick(sim, {}, 1.2);
        } else if (step.type === 'clear' || step.type === 'defeat') {
          // the nearest of them, brought in front and shot down
          const e = sim.enemies.filter((x) => !x.dead).sort((a, b) => Math.hypot(a.x - p().x, a.z - p().z) - Math.hypot(b.x - p().x, b.z - p().z))[0];
          expect(e, `${active.id}: someone to fight`).toBeTruthy();
          expect(target.x).toBeCloseTo(e.x);
          robot();
          // (brought round in front of him, somewhere open he can see)
          e.hp = 1;
          const spot = Array.from({ length: 16 }, (_, k) => (k * Math.PI) / 8)
            .flatMap((a) => [26, 16, 40].map((r) => [p().x + Math.sin(a) * r, p().z + Math.cos(a) * r]))
            .find(([x, z]) => Math.abs(sim.world.floorAt(x, z, 50, 60) - p().y) < 1.5 && segmentClear(sim.world, p().x, p().y + 6, p().z, x, p().y + 3.5, z));
          expect(spot, `${active.id}: somewhere to fight ${e.kind}`).toBeTruthy();
          Object.assign(e, { x: spot[0], z: spot[1], y: sim.world.floorAt(spot[0], spot[1], 50, 60) });
          for (let k = 0; k < 60 && !e.dead; k++) tick(sim, { fire: true, aimYaw: Math.atan2(e.x - p().x, e.z - p().z), aimPitch: -0.05 }, 1 / 30);
        } else goTo(sim, target.x, target.z); // reach, collect, drive: where it points
      }
      expect(sim.missions.done, m.id).toContain(m.id);
      finished.push(m.id);
    }
    expect(finished).toHaveLength(MISSIONS.length);
  });
});
