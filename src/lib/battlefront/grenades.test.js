import { describe, expect, it } from 'vitest';
import { FLIGHT, GRENADES, SURFACE_OFFSET, THROW, blastDamage, createGrenade, explode, release, stepGrenade, throwFrom } from './grenades.js';

const flat = { heightAt: () => 0 };
const fly = (g, seconds, world = flat, step = 0.05) => {
  const out = [];
  for (let t = step; t <= seconds + 1e-9; t += step) out.push(...stepGrenade(g, step, { ...world, now: g.born + t }));
  return out;
};

describe('the grenades (finding 33)', () => {
  it('leaves on the release, 0.3 to 3.2 s after the press, at 25 m/s along the aim plus 3.5 up from beside the eye', () => {
    expect(release(0)).toBe(THROW.hold[0]);
    expect(release(1)).toBe(1);
    expect(release(9)).toBe(THROW.hold[1]);
    const { at, vel } = throwFrom([0, 1.75, 0], 0, 0);
    expect(at).toEqual([-0.3, 1.95, 0.15]);
    expect(vel).toEqual([0, 3.5, 25]);
    expect(Math.hypot(...vel)).toBeCloseTo(25.24, 2);
    expect(Math.atan2(vel[1], vel[2]) * (180 / Math.PI)).toBeCloseTo(7.97, 1);
  });

  // (the finding's "≈ 20 m in 1.0 s" does not follow from its own numbers: 25 m/s for the
  // 1.08 s a 3.5 m/s rise from 1.95 m takes to come down is 27 m)
  it('flies the detonator 27 m on flat ground in 1.08 s, bounces at a quarter speed, rests under 3 m/s, and goes off 0.7 s after', () => {
    const { at, vel } = throwFrom([0, 1.75, 0], 0, 0);
    const g = createGrenade(GRENADES.thermal, { at, vel, owner: 'p', team: 1, now: 0 });
    const ev = fly(g, 3, flat, 0.01);
    const first = ev.find((e) => e.type === 'bounce');
    expect(first.at[2]).toBeGreaterThan(26.5);
    expect(first.at[2]).toBeLessThan(27.5);
    const rest = ev.find((e) => e.type === 'rest');
    expect(rest).toBeTruthy();
    expect(ev.filter((e) => e.type === 'bounce')).toHaveLength(1);
    const boom = ev.find((e) => e.type === 'explode');
    expect(boom).toBeTruthy();
    expect(boom.at[1]).toBeCloseTo(SURFACE_OFFSET, 9);
    expect(g.fuseAt - g.restAt).toBeCloseTo(0.7, 9);
    expect(FLIGHT).toEqual({ gravity: -9.8, bounce: 0.25, minBounce: 3, tumble: 180 });
  });

  it('goes off on contact as the impact grenade, splits 3 s after its first contact as the flash, and 1.2 s after resting as the shock', () => {
    const throwIt = (row) => createGrenade(row, { ...throwFrom([0, 1.75, 0], 0, -0.6), owner: 'p', team: 1, now: 0 });
    const impact = throwIt(GRENADES.impact);
    const ie = fly(impact, 2);
    expect(ie.map((e) => e.type)).toEqual(['bounce', 'explode']);
    const flash = throwIt(GRENADES.flash);
    const fe = fly(flash, 6);
    const hit = fe.find((e) => e.type === 'bounce');
    expect(hit).toBeTruthy();
    const split = fe.find((e) => e.type === 'split');
    expect(split.count).toBe(5);
    expect(flash.fuseAt - flash.collided).toBeGreaterThan(0);
    const shock = throwIt(GRENADES.shock);
    fly(shock, 6);
    expect(shock.fuseAt - shock.restAt).toBeCloseTo(1.2, 9);
    expect(GRENADES.shock.field).toEqual({ radius: 2, perSecond: 10, tick: 0.1, apply: 1.1, seconds: 3.7 });
  });

  it('bounces off a wall and detonates on the backstop fuse when it never rests', () => {
    const g = createGrenade(GRENADES.thermal, { at: [0, 1, 0], vel: [0, 0, 20], owner: 'p', team: 1, now: 0 });
    const wall = (a, b) => (b[2] >= 5 && a[2] < 5 ? { t: (5 - a[2]) / (b[2] - a[2]), solid: 3, at: [a[0], a[1], 5] } : null);
    const ev = fly(g, 0.5, { heightAt: () => -100, solid: wall });
    expect(ev[0].type).toBe('bounce');
    expect(g.vel[2]).toBeLessThan(0);
    expect(Math.abs(g.vel[2])).toBeCloseTo(5, 6);
    const rest = fly(g, 7);
    expect(rest.at(-1).type).toBe('explode');
    expect(g.dead).toBe(true);
  });

  it('drops down a wall’s face when too slow to bounce off it, and lies where it is when it starts inside a solid', () => {
    const wall = (a, b) => (b[2] >= 5 && a[2] < 5 ? { t: (5 - a[2]) / (b[2] - a[2]), solid: 3, at: [a[0], a[1], 5] } : null);
    const slow = createGrenade(GRENADES.thermal, { at: [0, 2, 4.5], vel: [0, 0, 8], owner: 'p', team: 1, now: 0 });
    const ev = fly(slow, 3, { heightAt: () => 0, solid: wall });
    // (8 m/s into it keeps 2: under the 3 a bounce needs)
    expect(ev[0].type).toBe('bounce');
    expect(ev.find((e) => e.type === 'rest').at[2]).toBeLessThan(5);
    expect(ev.find((e) => e.type === 'rest').at[1]).toBe(0);
    expect(ev.at(-1).type).toBe('explode');
    const inside = createGrenade(GRENADES.thermal, { at: [0, 2, 4.5], vel: [0, 0, 8], owner: 'p', team: 1, now: 0 });
    const stuck = fly(inside, 1, { heightAt: () => 0, solid: () => ({ t: 0, solid: -2, at: [0, 2, 4.5] }) });
    expect(stuck.map((e) => e.type)).toEqual(['rest', 'explode']);
    expect(inside.fuseAt - inside.restAt).toBeCloseTo(0.7, 9);
  });

  it('deals the blast in full inside the inner radius and linearly to nothing at BlastRadius × 0.84', () => {
    const t = GRENADES.thermal;
    expect(blastDamage(t, 0)).toBe(200);
    expect(blastDamage(t, 2)).toBe(200);
    expect(blastDamage(t, 6 * 0.84)).toBe(0);
    expect(blastDamage(t, (2 + 6 * 0.84) / 2)).toBeCloseTo(100, 9);
    expect(blastDamage(GRENADES.botThermal, 0)).toBe(100);
    expect(blastDamage(GRENADES.botThermal, 5)).toBe(0);
  });

  it('hurts enemies and the thrower, never the thrower’s team, and not through a wall', () => {
    const bodies = [
      { id: 'e1', team: 2, at: [0, 1, 1], alive: true },
      { id: 'e2', team: 2, at: [0, 1, 4], alive: true },
      { id: 'mate', team: 1, at: [0, 1, 1], alive: true },
      { id: 'p', team: 1, at: [0, 1, 3], alive: true },
      { id: 'far', team: 2, at: [0, 1, 9], alive: true },
    ];
    const hits = explode(GRENADES.thermal, [0, 0.2, 0], bodies, { owner: 'p', team: 1, occluded: (a, b) => b[2] > 3.5 });
    expect(hits.map((h) => h.id)).toEqual(['e1', 'p']);
    expect(hits[0].damage).toBe(200);
    expect(hits[1].damage).toBeGreaterThan(0);
    expect(hits[1].damage).toBeLessThan(200);
    // the impact and shock grenades go through props (DisableStaticEntityOcclusion)
    expect(explode(GRENADES.impact, [0, 0.2, 0], bodies, { owner: 'p', team: 1, occluded: () => true }).map((h) => h.id)).toEqual(['e1', 'e2', 'p']);
  });
});
