import { describe, expect, it } from 'vitest';
import { createSaberSim, lungePick, saberOf, SABER_HEROES, shieldHit, strikeZone } from './saber2017';

const luke = saberOf('luke');
const q = luke.query;
const me = { x: 0, z: 0, yaw: 0 }; // facing +z
// a point `d` m ahead of the striker, `deg` round from its facing
const at = (d, deg, extra = {}) => ({ x: Math.sin((deg * Math.PI) / 180) * d, z: Math.cos((deg * Math.PI) / 180) * d, ...extra });

describe('the rules', () => {
  it('has the roster’s saber heroes, Luke standing in for one the game has none for', () => {
    expect(SABER_HEROES).toEqual(expect.arrayContaining(['luke', 'vader', 'obiwan', 'anakin', 'maul', 'dooku']));
    expect(saberOf('palpatine')).toMatchObject({ hero: 'luke', standIn: true });
    expect(saberOf('vader').damage.hit.damage).toBe(130);
    expect(saberOf('maul').damage.hit.damage).toBe(120);
  });
});

describe('the strike’s query', () => {
  it('hits ahead out to 1.5 m past the striker (the 3 m sphere round a point 1.5 m back), not past it', () => {
    expect(strikeZone(q, me, at(0.6, 0)).in).toBe(true);
    expect(strikeZone(q, me, at(1.4, 0)).in).toBe(true);
    expect(strikeZone(q, me, at(1.6, 0)).in).toBe(false);
  });
  it('keeps to the 35° cone from the anchor 1.5 m back (wide at the striker: one beside it at a metre is in) and the 45° gate', () => {
    expect(strikeZone(q, me, at(1, 20)).in).toBe(true);
    expect(strikeZone(q, me, at(1, 60)).in).toBe(true);
    expect(strikeZone(q, me, at(1.2, 100)).in).toBe(false);
    expect(strikeZone(q, me, at(1, 180)).in).toBe(false);
    expect(strikeZone(q, me, at(0.3, 180)).in).toBe(false);
  });
  it('calls a target facing within 70° of the striker’s struck from behind', () => {
    expect(strikeZone(q, me, at(1, 0, { yaw: 0 })).behind).toBe(true);
    expect(strikeZone(q, me, at(1, 0, { yaw: Math.PI })).behind).toBe(false);
    expect(strikeZone(q, me, at(1, 0, { yaw: 1.4 })).behind).toBe(false);
  });
  it('picks the lunge’s target in 8 m, past 1.8 m, within 40°, nearest and straightest first; 2 m out of stamina', () => {
    const far = { id: 'far', ...at(6, 5) };
    const near = { id: 'near', ...at(3, 25) };
    const wide = { id: 'wide', ...at(3, 60) };
    expect(lungePick(q, me, [far, near, wide])?.id).toBe('far');
    expect(lungePick(q, me, [wide])).toBe(null);
    expect(lungePick(q, me, [far], { tired: true })).toBe(null);
  });
});

describe('a strike', () => {
  const target = (x) => ({ id: 't', yaw: Math.PI, ...x });
  it('lands its damage the delay after it finds them, once a strike', () => {
    const sim = createSaberSim(luke);
    sim.strike(0, { contact: [0.1, 0.3], dur: 0.6 });
    const t = target(at(1, 0));
    expect(sim.step(0.05, 0.05, { me, targets: [t] }).filter((e) => e.type === 'hit')).toEqual([]);
    sim.step(0.05, 0.12, { me, targets: [t] });
    const later = sim.step(0.05, 0.12 + luke.damage.hit.delay, { me, targets: [t] }).filter((e) => e.type === 'hit');
    expect(later).toEqual([expect.objectContaining({ id: 't', damage: 130, behind: false })]);
    expect(sim.step(0.05, 0.25, { me, targets: [t] }).filter((e) => e.type === 'hit')).toEqual([]);
  });
  it('adds the from-behind damage', () => {
    const sim = createSaberSim(luke);
    sim.strike(0, { contact: [0, 0.3] });
    sim.step(0.05, 0.05, { me, targets: [target({ ...at(1, 0), yaw: 0 })] });
    const e = sim.step(0.1, 0.2, { me, targets: [] }).find((x) => x.type === 'hit');
    expect(e).toMatchObject({ damage: 160, behind: true });
  });
  it('costs your stamina as its window opens', () => {
    const sim = createSaberSim(luke);
    sim.strike(0, { contact: [0.1, 0.3] });
    sim.step(0.15, 0.15, { me, targets: [] });
    expect(sim.state.stamina).toBe(100 - luke.stamina.strike);
  });
});

describe('the block', () => {
  it('meets a strike from the front: no damage, their stamina drained, the striker recoils', () => {
    const a = createSaberSim(luke);
    const b = createSaberSim(saberOf('vader'), { id: 'b' });
    b.block(true, 0);
    a.strike(0, { contact: [0, 0.3] });
    const ev = a.step(0.05, 0.05, { me, targets: [{ id: 'b', ...at(1, 0), yaw: Math.PI, sim: b }] });
    expect(ev.map((e) => e.type)).toContain('blocked');
    expect(b.state.stamina).toBeCloseTo(100 - saberOf('vader').stamina.blocked);
    expect(a.state.striking).toBe(null);
    expect(a.strike(0.2)).toBe(false); // (recoiling: BlockedLightSaber's 0.5 s)
    expect(a.strike(0.6)).toBe(true);
  });
  it('doesn’t meet one from behind', () => {
    const a = createSaberSim(luke);
    const b = createSaberSim(luke);
    b.block(true, 0);
    a.strike(0, { contact: [0, 0.3] });
    a.step(0.05, 0.05, { me, targets: [{ id: 'b', ...at(1, 0), yaw: 0, sim: b }] });
    const hit = a.step(0.1, 0.2, { me, targets: [] }).find((e) => e.type === 'hit');
    expect(hit).toMatchObject({ id: 'b', damage: 130 }); // (the bonus only on one not deflecting)
  });
  it('turns a bolt from the front and not one from behind', () => {
    const front = shieldHit(luke, me, [0, 1.2, 10], [0, 1.2, -10]);
    expect(front).not.toBe(null);
    expect(front.at[2]).toBeGreaterThan(0);
    expect(shieldHit(luke, me, [0, 1.2, -10], [0, 1.2, 10])).toBe(null);
    expect(shieldHit(luke, me, [3, 1.2, 10], [3, 1.2, -10])).toBe(null);
  });
  it('drains, refills after its delay, and breaks at nothing with a stagger', () => {
    const sim = createSaberSim(luke);
    sim.block(true, 0);
    for (let i = 0; i < 9; i++) expect(sim.blockedStrike(0)).toBe(true);
    expect(sim.state.stamina).toBeCloseTo(10);
    sim.step(0.5, 0.5, {});
    expect(sim.state.stamina).toBeCloseTo(10); // (inside the regen delay)
    sim.step(0.5, 1.5, {});
    expect(sim.state.stamina).toBeGreaterThan(10);
    sim.state.stamina = 5;
    sim.block(true, 2);
    expect(sim.blockedStrike(2)).toBe(false);
    expect(sim.state.out).toBe(true);
    expect(sim.state.blocking).toBe(false);
    expect(sim.block(true, 2 + luke.hand.broken + 0.1)).toBe(false); // (out until it's back over the threshold)
  });
  it('drains a bolt by its damage over the standard bullet’s', () => {
    const sim = createSaberSim(luke);
    sim.takeBolt(45, 0);
    expect(sim.state.stamina).toBeCloseTo(100 - luke.stamina.bolt);
  });
});

describe('the dash', () => {
  it('has two charges a bar, refills over its recharge, and takes the evading share off damage', () => {
    const sim = createSaberSim(luke);
    expect(sim.dash(0)).toBe(true);
    expect(sim.taken(100, 0.1)).toBeCloseTo(100 * luke.evading.taken);
    expect(sim.taken(100, 0.5)).toBe(100);
    expect(sim.dash(0.5)).toBe(true);
    expect(sim.dash(0.6)).toBe(false);
    for (let t = 0.6; t < 0.9 + luke.evade.recharge * 0.5; t += 0.05) sim.step(0.05, t, {});
    expect(sim.view(2).dashes).toBe(1);
  });
});

describe('a clash', () => {
  it('stops both strikes when they reach each other in one step', () => {
    const a = createSaberSim(luke, { id: 'a' });
    const b = createSaberSim(luke, { id: 'b' });
    a.strike(0, { contact: [0, 0.3] });
    b.strike(0, { contact: [0, 0.3] });
    const meB = { x: 0, z: 1, yaw: Math.PI };
    const ev = a.step(0.05, 0.05, { me, targets: [{ id: 'b', ...meB, sim: b }] });
    expect(ev.map((e) => e.type).filter((t) => t !== 'drained')).toEqual(['clash']);
    expect(a.state.striking).toBe(null);
    expect(b.state.striking).toBe(null);
    expect(b.step(0.05, 0.05, { me: meB, targets: [{ id: 'a', ...me, sim: a }] }).filter((e) => e.type === 'hit')).toEqual([]);
  });
});

describe('a duel', () => {
  const run = () => {
    const a = createSaberSim(luke, { id: 'a' });
    const b = createSaberSim(saberOf('vader'), { id: 'b' });
    const A = { x: 0, z: 0, yaw: 0 };
    const B = { x: 0, z: 1.1, yaw: Math.PI };
    const log = [];
    for (let i = 0; i < 400; i++) {
      const now = i / 60;
      if (i % 50 === 0) a.strike(now, { contact: [0.14, 0.29], dur: 0.53 });
      if (i % 70 === 10) b.strike(now, { contact: [0.2, 0.35], dur: 0.6 });
      b.block(i % 120 < 50, now);
      log.push(...a.step(1 / 60, now, { me: A, targets: [{ id: 'b', ...B, sim: b }] }).map((e) => `${i}:a:${e.type}`));
      log.push(...b.step(1 / 60, now, { me: B, targets: [{ id: 'a', ...A, sim: a }] }).map((e) => `${i}:b:${e.type}`));
    }
    return log;
  };
  it('goes the same way twice', () => {
    const one = run();
    expect(one.length).toBeGreaterThan(4);
    expect(run()).toEqual(one);
  });
});
