import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GCW, history, pointsKey, winKey } from './gcw';
import { readAllegiance, swear } from './allegiance';
import { systemById } from './systems';
import { createWarFront } from './warfront';
import { resetWar, warTally } from './warState';
import { shotAt } from '../universe/shipPowers';
import { createSaves } from '../../runtime/saves';

// a moment in the first campaign with a battle on at its first front, a minute in
const MS = GCW.start + 24 * 60e3 + 60e3;
const STATE = history('gcw', 0, MS, () => 0);
const FRONT_ID = STATE.fronts[0];
const QUIET_ID = Object.keys(STATE.owner).find((id) => !STATE.fronts.includes(id) && !STATE.attacks.some((a) => a.sys === id));
const sworn = (side) => {
  const a = side ? swear(readAllegiance(null, { now: MS }), side, MS) : readAllegiance(null, { now: MS });
  return { war: a.war, side: a.oaths[a.war]?.side ?? null };
};

const kit = (side = 'rebel', opts = {}) => {
  let allegiance = sworn(side);
  const drawn = { show: vi.fn(), hide: vi.fn(), update: vi.fn(), dispose: vi.fn() };
  const said = [];
  const sent = { fight: [], war: [] };
  const world = { quiet: vi.fn() };
  let ms = MS;
  const solids = [];
  const front = createWarFront(null, {
    models: null,
    makeScene: () => drawn,
    emit: (e) => said.push(e),
    now: () => ms,
    onSolids: (s) => solids.push(s.length),
    allegiance: () => allegiance,
    ...opts,
  });
  front.setNet({ fight: (m) => sent.fight.push(m), war: (m) => sent.war.push(m) });
  return { front, drawn, said, sent, world, solids, at: (v) => (ms = v), swear: (x) => (allegiance = sworn(x)), get ms() { return ms; } };
};
const camera = { position: { x: 0, y: 0, z: 0 } };
const shoot = (front, p, damage = 1) => front.hit({ x: p.x, y: p.y + 2, z: p.z }, { x: p.x, y: p.y - 0.01, z: p.z }, damage);
const flagOf = (b) => b.capitals.find((c) => c.team === b.defender && c.role === 'flagship');
// (each battle's objectives are its plan's, drawn from its kind's menu, not
// always the flagship's generators: the first of them open to be shot, and
// the tally that has the whole of a stage done)
const firstOpen = (b) => b.objectives.find((o) => o.alive && !o.zone && b.isOpen(o));
const stageDone = (plan, i) => Object.fromEntries(plan.stages[i].objectives.map((o) => [o.type === 'zone' ? `${o.id}:a` : o.id, 1e4]));

beforeEach(() => resetWar());
afterEach(() => resetWar());

describe('the war’s battle in the system you’re in', () => {
  it('is there as you drop in, you’re in it on the Rebels’ side, and the system’s own fleets stand aside', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    expect(k.front.battle).toBeTruthy();
    expect(k.front.battle.you.team).toBe(0);
    expect(k.front.battle.attacker).toBe(0);
    expect(k.drawn.show).toHaveBeenCalledTimes(1);
    expect(k.world.quiet).toHaveBeenLastCalledWith(true);
    expect(k.said.some((e) => e.id === 'battle' && e.sub === 'front')).toBe(true);
    expect(k.front.solids.length).toBeGreaterThan(0);
    // its clock is the shared one: a minute in already
    expect(k.front.battle.clock).toBeGreaterThanOrEqual(59);
  });
  it('has nothing where there’s no fighting', () => {
    const k = kit();
    k.front.enter(systemById(QUIET_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    expect(k.front.battle).toBeNull();
  });
  it('says you’re in it once you’re in among it', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    const at = k.front.info.laid.at;
    k.front.update(1 / 30, 0, camera, { x: at[0], y: at[1], z: at[2] });
    expect(k.said.filter((e) => e.sub === 'join')).toHaveLength(1);
    k.front.update(1 / 30, 0, camera, { x: at[0], y: at[1], z: at[2] });
    expect(k.said.filter((e) => e.sub === 'join')).toHaveLength(1);
  });
  it('shares your damage on an objective with the pilots here, and counts it in the war when it goes', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    const g = firstOpen(k.front.battle);
    for (let i = 0; i < 200 && g.alive; i++) shoot(k.front, g.pos, 3);
    k.front.update(1, 0, camera, null);
    expect(g.alive).toBe(false);
    expect(k.sent.fight.at(-1).m[g.key]).toBeGreaterThan(0);
    expect(k.sent.fight.at(-1).e).toBe(k.front.on.id);
    expect(warTally(k.ms).mine(pointsKey('rebel', FRONT_ID, k.front.on.step))).toBe(GCW.points.objective);
  });
  it('takes an objective down when the other pilots here have', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    const id = k.front.on.id;
    k.front.onNet({ type: 'fight', from: 'p', msg: { e: id, m: stageDone(k.front.director.plan, 0), t: {} } });
    k.front.update(1 / 30, 0, camera, null);
    expect(k.front.battle.phase).toBe(2);
    // (and another battle's word is ignored)
    k.front.onNet({ type: 'fight', from: 'p', msg: { e: 'c0.elsewhere.1', m: { bridge: 500 }, t: {} } });
    k.front.update(1 / 30, 0, camera, null);
    expect(k.front.battle.phase).toBe(2);
  });
  it('counts the battle won in the war, once, if you were in it', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    const at = k.front.info.laid.at;
    k.front.update(1 / 30, 0, camera, { x: at[0], y: at[1], z: at[2] });
    k.front.win(0);
    k.front.update(1 / 30, 0, camera, null);
    k.front.update(1 / 30, 0, camera, null);
    expect(warTally(k.ms).value(winKey('rebel', FRONT_ID, k.front.on.step))).toBe(1);
    expect(k.said.filter((e) => e.sub === 'won')).toHaveLength(1);
  });
  it('hears the war from other pilots, and tells them of it', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.onNet({ type: 'war', from: 'p', msg: { e: 'c0', m: { [pointsKey('rebel', FRONT_ID, 2)]: 5 }, t: {} } });
    expect(warTally(k.ms).value(pointsKey('rebel', FRONT_ID, 2))).toBe(5);
    for (let i = 0; i < 40; i++) k.front.update(1, 0, camera, null);
    expect(k.sent.war.length).toBeGreaterThan(0);
  });
  it('moves on to the next battle when the step’s up, and lets the system’s fleets back when there’s none', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    const first = k.front.on.id;
    k.at(MS + GCW.step);
    k.front.update(1 / 30, 0, camera, null);
    expect(k.front.on?.id ?? null).not.toBe(first);
    k.front.enter(systemById(QUIET_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    expect(k.world.quiet).toHaveBeenLastCalledWith(false);
    expect(k.drawn.hide).toHaveBeenCalled();
  });
});

describe('coming back after a death', () => {
  it('is behind your side’s line once you’ve been in the battle, and the system’s own arrival before', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    expect(k.front.respawn()).toBeNull(); // (not in it yet)
    const at = k.front.info.laid.at;
    k.front.update(1 / 30, 0, camera, { x: at[0], y: at[1], z: at[2] });
    const r = k.front.respawn();
    const home = k.front.battle.homeFor(k.front.battle.you.team);
    expect(r).toMatchObject({ x: home.pos.x, y: home.pos.y, z: home.pos.z });
    // facing the way it says (scene.js's heading for a look along (x, z) is atan2(-x, -z))
    expect(r.heading).toBeCloseTo(Math.atan2(-home.fwd.x, -home.fwd.z), 6);
  });

  it('is the system’s own arrival unsworn, and once the battle’s over', () => {
    const k = kit(null);
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    const at = k.front.info.laid.at;
    k.front.update(1 / 30, 0, camera, { x: at[0], y: at[1], z: at[2] });
    expect(k.front.respawn()).toBeNull();
    const s = kit();
    s.front.enter(systemById(FRONT_ID), s.world);
    s.front.update(1 / 30, 0, camera, { x: at[0], y: at[1], z: at[2] });
    expect(s.front.respawn()).not.toBeNull();
    s.front.battle.end(0, 'test');
    expect(s.front.respawn()).toBeNull();
  });
});

describe('a pilot who reloads', () => {
  // a browser's storage in memory, for the battle's save
  const memory = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  };
  const into = (k) => {
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    return k;
  };
  const hpOf = (k, key) => {
    k.front.update(1 / 30, 0, camera, null);
    return k.front.battle.objectives.find((o) => o.key === key).hp;
  };

  it('is counted once: a new peer id telling the same again is the same pilot, by the tally id kept with the battle’s save', () => {
    const saves = createSaves({ local: memory(), session: memory() });
    const pilot = into(kit('rebel', { saves }));
    const other = into(kit('rebel')); // (a pilot who stays)
    const g = firstOpen(pilot.front.battle);
    for (let i = 0; i < 5; i++) shoot(pilot.front, g.pos, 3);
    pilot.front.update(1, 0, camera, null);
    const told = pilot.sent.fight.at(-1);
    expect(told.m[g.key]).toBeGreaterThan(0);
    const before = hpOf(other, g.key);
    other.front.onNet({ type: 'fight', from: 'peer-1', msg: told });
    const once = hpOf(other, g.key);
    expect(once).toBeLessThan(before);
    // the same word again, from a new peer id (a reload; a new identity): the same pilot
    other.front.onNet({ type: 'fight', from: 'peer-2', msg: told });
    expect(hpOf(other, g.key)).toBe(once);
    // and the page made again on the same save tells what it did under the same id
    const back = into(kit('rebel', { saves }));
    back.front.update(1, 0, camera, null);
    const again = back.sent.fight.at(-1);
    expect(again.i).toBeTruthy();
    expect(again.i).toBe(told.i);
    expect(again.m[g.key]).toBe(told.m[g.key]);
    other.front.onNet({ type: 'fight', from: 'peer-3', msg: again });
    expect(hpOf(other, g.key)).toBe(once);
  });
});

describe('the side you swore to', () => {
  const into = (k) => {
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    const at = k.front.info.laid.at;
    return { x: at[0], y: at[1], z: at[2] };
  };
  const downOne = (k, team, role) => {
    const f = k.front.battle.fighters.find((x) => x.alive && x.team === team && (!role || x.role === role));
    for (let i = 0; i < 40 && f.alive; i++) shoot(k.front, f.pos, 5);
    k.front.update(1 / 30, 0, camera, null);
    return f;
  };
  it('unsworn, the battle asks once and scores nothing', () => {
    const k = kit(null);
    const here = into(k);
    expect(k.front.battle.you.team).toBeNull();
    k.front.update(1 / 30, 0, camera, here);
    k.front.update(1 / 30, 0, camera, here);
    expect(k.said.filter((e) => e.id === 'battle' && e.sub === 'ask')).toHaveLength(1);
    expect(k.said.some((e) => e.sub === 'join')).toBe(false);
    downOne(k, 1);
    expect(warTally(k.ms).keys()).toEqual([]);
    expect(k.front.info.team).toBeNull();
    expect(k.front.info.asked).toBe(true);
  });
  const paid = (k, what) => k.said.filter((e) => e.type === 'earn' && e.what === what);
  it('pays the wallet for the war’s points you score, a whole point at a time', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    // (whichever objective of the battle's plan is open first: since the
    // director it isn't always the flagship's generators)
    const g = firstOpen(k.front.battle);
    for (let i = 0; i < 400 && g.alive; i++) shoot(k.front, g.pos, 3);
    k.front.update(1, 0, camera, null);
    expect(paid(k, 'warPoints').reduce((n, e) => n + e.n, 0)).toBe(GCW.points.objective);
    expect(paid(k, 'warPoints').every((e) => e.side === 'galaxy' && Number.isInteger(e.n) && e.n > 0)).toBe(true);
    // fighters are a tenth of a point each: paid once they add up to a whole one
    const here = { x: k.front.info.laid.at[0], y: k.front.info.laid.at[1], z: k.front.info.laid.at[2] };
    k.front.update(1 / 30, 0, camera, here);
    for (let i = 0; i < 12 && k.front.battle.fighters.some((x) => x.alive && x.team === 1); i++) downOne(k, 1);
    const mine = warTally(k.ms).mine(pointsKey('rebel', FRONT_ID, k.front.on.step));
    expect(mine).toBeGreaterThan(GCW.points.objective);
    expect(paid(k, 'warPoints').reduce((n, e) => n + e.n, 0)).toBe(Math.floor(mine + 1e-6));
  });
  it('pays the wallet for a battle won, once, and nothing unsworn', () => {
    const k = kit();
    const here = into(k);
    k.front.update(1 / 30, 0, camera, here);
    k.front.win(0);
    k.front.update(1 / 30, 0, camera, null);
    k.front.update(1 / 30, 0, camera, null);
    expect(paid(k, 'warWin')).toEqual([{ type: 'earn', what: 'warWin', n: 1, side: 'galaxy' }]);
    const u = kit(null);
    const there = into(u);
    u.front.update(1 / 30, 0, camera, there);
    downOne(u, 1);
    u.front.win(0);
    u.front.update(1 / 30, 0, camera, null);
    expect(u.said.some((e) => e.type === 'earn')).toBe(false);
  });
  it('swearing in the middle of it puts you in it', () => {
    const k = kit(null);
    const here = into(k);
    k.front.update(1 / 30, 0, camera, here);
    k.swear('rebel');
    k.front.update(1 / 30, 0, camera, here);
    expect(k.front.battle.you.team).toBe(0);
    expect(k.said.filter((e) => e.sub === 'join')).toHaveLength(1);
  });
  it('an Imperial pilot at a liberation is on the defence, sends no damage to objectives, and scores for the Empire', () => {
    const k = kit('empire');
    const here = into(k);
    k.front.update(1 / 30, 0, camera, here);
    expect(k.front.battle.you.team).toBe(1);
    expect(k.front.info.team).toBe(1);
    // its own flagship's generator, shot at: not the Empire's to take down
    const g = flagOf(k.front.battle).subs.find((s) => s.id === 'gen-port');
    for (let i = 0; i < 30; i++) shoot(k.front, g.pos, 3);
    downOne(k, 0, 'fighter');
    for (let i = 0; i < 10; i++) k.front.update(1, 0, camera, null);
    // (a defender's in the shared battle too since the director: it counts
    // itself in, here:d, and only an intercept would shore anything up; a
    // fighter down is no intercept, and its own flagship's not its to hurt)
    for (const m of k.sent.fight) expect(Object.keys(m.m).filter((key) => key !== 'here:d')).toEqual([]);
    expect(k.sent.fight.some((m) => m.m['here:d'] === 1)).toBe(true);
    expect(warTally(k.ms).mine(pointsKey('empire', FRONT_ID, k.front.on.step))).toBeGreaterThan(0);
    expect(warTally(k.ms).mine(pointsKey('rebel', FRONT_ID, k.front.on.step))).toBe(0);
    expect(Object.keys(k.sent.war.at(-1).m).some((key) => key.startsWith('imp:'))).toBe(true);
  });
  it('a bomber of the attacker’s brought down by a defender is an intercept, and shores up the objective the attacker’s AI is on', () => {
    const k = kit('empire');
    const here = into(k);
    k.front.update(1 / 30, 0, camera, here);
    const target = k.front.info.shared.target;
    expect(target).toBeTruthy();
    downOne(k, 0, 'bomber');
    expect(warTally(k.ms).mine(pointsKey('empire', FRONT_ID, k.front.on.step))).toBeCloseTo(GCW.points.intercept, 5);
    expect(k.said.filter((e) => e.sub === 'intercept')).toHaveLength(1);
    for (let i = 0; i < 3; i++) k.front.update(1, 0, camera, null);
    expect(k.sent.fight.at(-1).m[`g:${target}`]).toBeGreaterThan(0);
  });
  it('the battle won is the side’s that won it', () => {
    const k = kit('empire');
    const here = into(k);
    k.front.update(1 / 30, 0, camera, here);
    k.front.win(1);
    k.front.update(1 / 30, 0, camera, null);
    expect(warTally(k.ms).value(winKey('empire', FRONT_ID, k.front.on.step))).toBe(1);
    expect(warTally(k.ms).value(winKey('rebel', FRONT_ID, k.front.on.step))).toBe(0);
    expect(k.said.filter((e) => e.sub === 'won')).toHaveLength(1);
  });
  it('says the battle’s side, war and system with each line', () => {
    const k = kit('rebel');
    into(k);
    const e = k.said.find((x) => x.sub === 'front');
    expect(e).toMatchObject({ side: 'rebel', war: 'gcw', sys: FRONT_ID, against: STATE.owner[FRONT_ID] });
  });
  it('fights the war you fight in: another war’s battle at another system', () => {
    const clone = history('clone', 0, MS, () => 0);
    const k = kit('republic');
    k.front.enter(systemById(clone.fronts[0]), k.world);
    k.front.update(1 / 30, 0, camera, null);
    expect(k.front.on.war).toBe('clone');
    expect(k.front.battle.you.team).toBe(0);
  });
  it('the set pieces are the Civil War’s', () => {
    const k = kit('republic');
    k.front.enter(systemById('endor'), k.world);
    k.front.update(1 / 30, 0, camera, null);
    k.front.force('separatists');
    expect(k.front.on.war).toBe('clone');
    expect(k.front.pieces).toEqual([]);
    const g = kit('rebel');
    g.front.enter(systemById('endor'), g.world);
    g.front.update(1 / 30, 0, camera, null);
    g.front.force('empire');
    expect(g.front.pieces.length).toBeGreaterThan(0);
  });
  // the crews' ship powers (universe/battlePowers.js, shipPowers.js) on the battle
  it('hands a ship power’s slowed time and its ghost to the battle, its clock still on real time', () => {
    const k = kit();
    const here = into(k);
    const spy = vi.spyOn(k.front.battle, 'update');
    const clock = k.front.battle.clock;
    for (let i = 0; i < 30; i++) expect(k.front.update(1 / 30, 0, camera, here, { slow: 0.35, ghost: true }).hurt).toBe(0);
    expect(spy.mock.calls[0][0]).toBeCloseTo(0.35 / 30, 6);
    expect(k.front.battle.clock - clock).toBeCloseTo(1, 1);
    expect(k.front.battle.ghost).toBe(false);
    spy.mockRestore();
  });
  it('holds the other side’s fighters with Walt’s magnet, and nobody’s while you’re nobody’s', () => {
    const k = kit();
    into(k);
    const f = k.front.battle.fighters.find((x) => x.alive && x.team !== k.front.battle.you.team);
    expect(k.front.pull(f.pos, 22, 4, 1)).toBeGreaterThan(0);
    expect(f.held).toBeGreaterThan(0);
    const u = kit(null);
    into(u);
    const g = u.front.battle.fighters.find((x) => x.alive);
    expect(u.front.pull(g.pos, 22, 4, 1)).toBe(0);
    const none = kit();
    none.front.enter(systemById(QUIET_ID), none.world);
    expect(none.front.pull({ x: 0, y: 0, z: 0 }, 22, 4, 1)).toBe(0);
  });
  it('scores a fighter a power brings down (its shot through hit(), aimed at it) as yours', () => {
    const k = kit();
    const here = into(k);
    k.front.update(1 / 30, 0, camera, here);
    const t = k.front.targets.find((x) => x.kind !== 'turret' && x.kind !== 'subsystem');
    let r = null;
    for (let i = 0; i < 40 && !r?.down; i++) {
      const s = shotAt(t, here);
      r = k.front.hit(s.from, s.to, 5);
    }
    expect(r).toMatchObject({ id: t.id, down: true });
    k.front.update(1 / 30, 0, camera, null);
    expect(warTally(k.ms).mine(pointsKey('rebel', FRONT_ID, k.front.on.step))).toBeCloseTo(GCW.points.kill, 5);
  });
});

describe('the battle every pilot shares (the director)', () => {
  // a pilot at the front, flying in among the battle
  const at = (side, ms) => {
    const k = kit(side);
    k.at(ms);
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    const p = k.front.info.laid.at;
    k.front.update(1 / 30, 0, camera, { x: p[0], y: p[1], z: p[2] });
    return k;
  };
  const objectives = (k) => k.front.battle.objectives.map((o) => [o.key, +o.hp.toFixed(6), o.alive]);
  const allDown = (k) => {
    const plan = k.front.director.plan;
    const m = Object.assign({}, ...plan.stages.map((_, i) => stageDone(plan, i)));
    return { type: 'fight', from: 'p3', msg: { e: k.front.on.id, m, t: {} } };
  };

  it('counts each pilot in once, on its side (here:a, here:d)', () => {
    const k = at('rebel', MS);
    for (let i = 0; i < 4; i++) k.front.update(1, 0, camera, { x: k.front.info.laid.at[0], y: k.front.info.laid.at[1], z: k.front.info.laid.at[2] });
    expect(k.sent.fight.at(-1).m['here:a']).toBe(1);
  });

  it('two pilots, one on each side, hearing the same, see the same battle end the same way, and only the winners score it', () => {
    const rebel = at('rebel', MS);
    const empire = at('empire', MS);
    const start = rebel.front.on.start;
    for (const k of [rebel, empire]) {
      k.front.onNet(allDown(k));
      k.at(start + 301e3);
      k.front.update(1 / 30, 0, camera, null);
      k.front.update(1 / 30, 0, camera, null);
    }
    expect(rebel.front.battle.over).toMatchObject({ winner: 0 });
    expect(empire.front.battle.over).toMatchObject({ winner: 0 });
    expect(warTally(rebel.ms).value(winKey('rebel', FRONT_ID, rebel.front.on.step))).toBe(1);
    expect(warTally(rebel.ms).value(winKey('empire', FRONT_ID, rebel.front.on.step))).toBe(0);
    expect(rebel.said.filter((e) => e.sub === 'won')).toHaveLength(1);
    expect(empire.said.filter((e) => e.sub === 'lost')).toHaveLength(1);
  });

  it('a pilot joining at nine minutes sees the same objectives as one who’s been there since the start', () => {
    const from = at('rebel', MS);
    const start = from.front.on.start;
    const [one, two] = from.front.director.plan.stages[0].objectives;
    const word = { type: 'fight', from: 'p3', msg: { e: from.front.on.id, m: { [one.id]: 90, [`g:${(two ?? one).id}`]: 2 }, t: {} } };
    from.front.onNet(word);
    for (let s = 90; s <= 540; s += 30) {
      from.at(start + s * 1000);
      from.front.update(1 / 30, 0, camera, null);
    }
    const late = at('rebel', start + 540e3);
    late.front.onNet(word);
    late.front.update(1 / 30, 0, camera, null);
    // (the late one counted itself in, here:a, and the other never flew in after; that's no damage either way)
    expect(objectives(late).length).toBeGreaterThan(0);
    expect(objectives(late)).toEqual(objectives(from));
    expect(late.front.battle.phase).toBe(from.front.battle.phase);
  });

  it('a pilot arriving five minutes into an evacuation sees the runners one there from the start does', () => {
    const atHoth = (ms) => {
      const k = kit('rebel');
      k.at(ms);
      k.front.enter(systemById('hoth'), k.world);
      k.front.update(1 / 30, 0, camera, null);
      return k;
    };
    const probe = atHoth(MS);
    probe.front.force('empire');
    const start = probe.front.on.start;
    const flying = (k) => k.front.battle.runners.filter((r) => r.alive).map((r) => [r.slot, +r.hp.toFixed(6)]);
    for (let s = 1; s <= 300; s += 1) {
      probe.front.jump(1);
      probe.front.update(1 / 30, 0, camera, null);
    }
    // (the same battle forced again at the same second: the late pilot's, five minutes on)
    const late = atHoth(start);
    late.front.force('empire');
    late.front.jump(300);
    late.front.update(1 / 30, 0, camera, null);
    expect(late.front.on.id).toBe(probe.front.on.id);
    expect(flying(late)).toEqual(flying(probe));
    const R = late.front.director.plan.runners;
    expect(late.front.info.shared.runners.launched).toBe(Math.floor((300 - R.startAt) / R.every) + 1);
    expect(late.front.info.shared.runners).toEqual(probe.front.info.shared.runners);
  });

  it('flies its fighters with tactics (battleTactics.js): each side in flights of three of a kind', () => {
    const k = at('rebel', MS);
    for (const team of [0, 1]) {
      const own = k.front.battle.fighters.filter((f) => f.team === team && !f.ace);
      for (let i = 0; i + 2 < own.length; i += 3) expect(new Set(own.slice(i, i + 3).map((f) => f.kind)).size).toBe(1);
    }
  });

  it('fights the battle’s own plan: drawn for it from its kind’s menu, the same for every pilot', () => {
    const a = at('rebel', MS);
    const b = at('empire', MS);
    expect(a.front.director.plan).toEqual(b.front.director.plan);
    expect(a.front.director.plan.stages[0].objectives.length).toBeGreaterThan(0);
    // (Coruscant's a siege: its first stage one of the siege's)
    expect(['platforms', 'cannon', 'shield', 'battery', 'board']).toContain(a.front.director.plan.stages[0].id);
  });

  it('counts the seconds you hold a zone of the stage that’s open, for your side', () => {
    const k = kit('rebel');
    k.front.enter(systemById('yavin'), k.world);
    k.front.update(1 / 30, 0, camera, null);
    // (forced till a battle's drawn with a zone to hold: an evacuation's data beacon)
    let zone = null;
    for (let n = 0; n < 40 && !zone; n++) {
      k.at(MS + n * 1000);
      k.front.force('empire', 'evacuation');
      zone = k.front.battle.objectives.find((o) => o.zone);
    }
    expect(zone).toBeTruthy();
    // (its stage open: what's before it down, its gate passed)
    const before = k.front.director.plan.stages.slice(0, zone.phase - 1).flatMap((s) => s.objectives.map((o) => o.id));
    k.front.onNet({ type: 'fight', from: 'p3', msg: { e: k.front.on.id, m: Object.fromEntries(before.map((id) => [id, 1e4])), t: {} } });
    k.front.jump(k.front.director.plan.stages[zone.phase - 1].opensAt + 1);
    k.front.update(1 / 30, 0, camera, null);
    expect(k.front.battle.phase).toBe(zone.phase);
    expect(k.front.battle.stageOpen).toBe(true);
    for (let i = 0; i < 10; i++) k.front.update(0.5, 0, camera, { ...zone.pos });
    // (the Rebels defend Yavin here: theirs is the defenders' side of it)
    expect(k.sent.fight.at(-1).m[`${zone.key}:d`]).toBeGreaterThan(3);
  });

  it('a defender who brings down the attacker’s ace shores up the objective under attack five intercepts’ worth', () => {
    const k = kit('empire');
    k.front.enter(systemById('hoth'), k.world);
    k.front.update(1 / 30, 0, camera, null);
    k.front.force('rebel', 'assault');
    const ace = k.front.director.plan.side.find((o) => o.type === 'ace' && o.team === 0);
    expect(ace).toBeTruthy();
    k.front.jump(ace.at + 1);
    const p = k.front.info.laid.at;
    k.front.update(1 / 30, 0, camera, { x: p[0], y: p[1], z: p[2] });
    const target = k.front.info.shared.target;
    const f = k.front.battle.fighters.find((x) => x.ace && x.team === 0);
    expect(f.alive).toBe(true);
    for (let i = 0; i < 400 && f.alive; i++) shoot(k.front, f.seen, 5);
    k.front.update(1 / 30, 0, camera, null);
    for (let i = 0; i < 3; i++) k.front.update(1, 0, camera, null);
    const m = k.sent.fight.at(-1).m;
    expect(m['ace:0']).toBeGreaterThan(0);
    expect(m[`g:${target}`]).toBeGreaterThanOrEqual(5 - 1e-9);
  });

  it('says the crew’s line for the stage as it opens: the gravity wells at an interdiction', () => {
    const k = kit('rebel');
    k.front.enter(systemById('mandalore'), k.world);
    k.front.update(1 / 30, 0, camera, null);
    let wells = false;
    for (let n = 0; n < 30 && !wells; n++) {
      k.at(MS + n * 1000);
      k.front.force('rebel', 'interdiction');
      wells = k.front.director.plan.stages[0].id === 'wells';
    }
    expect(wells).toBe(true);
    k.front.update(1 / 30, 0, camera, null);
    expect(k.said.filter((e) => e.sub === 'interdictor').length).toBeGreaterThanOrEqual(1);
    expect(k.front.interdicted).toBe(true);
  });

  it('brings the attacker’s escorts forward at the final push, their hulls you bump into with them', () => {
    const k = at('rebel', MS);
    const esc = k.front.battle.capitals.find((c) => c.team === k.front.battle.attacker && c.role === 'escort' && !c.held);
    const was = { ...esc.pos };
    k.front.jump(480 + 45 - k.front.info.shared.t);
    k.front.update(0.1, 0, camera, null);
    expect(esc.advanced).toBeGreaterThan(30);
    expect(Math.hypot(esc.pos.x - was.x, esc.pos.z - was.z)).toBeGreaterThan(30);
    const solid = k.front.solids.find((o) => o.cap === esc && o.i === 0);
    expect(solid.at[0]).toBeCloseTo(esc.spheres[0].c.x, 6);
    expect(solid.at[2]).toBeCloseTo(esc.spheres[0].c.z, 6);
  });

  it('once it’s over, the losing fleet jumps out, and its hulls aren’t there to bump into', () => {
    const k = at('rebel', MS);
    k.front.onNet(allDown(k));
    k.at(k.front.on.start + 301e3);
    k.front.update(1 / 30, 0, camera, null);
    expect(k.front.battle.over).toMatchObject({ winner: 0 });
    const losers = k.front.battle.capitals.filter((c) => c.team === 1 && c.alive && c.dying <= 0);
    expect(losers.length).toBeGreaterThan(0);
    // (the shared clock running on with the frames: it's what the jump-outs are timed on)
    for (let i = 0; i < (losers.length * 3 + 2) * 10; i++) {
      k.at(k.ms + 100);
      k.front.update(0.1, 0, camera, null);
    }
    for (const c of losers) {
      expect(c.jumped, c.kind).toBe(true);
      for (const o of k.front.solids.filter((x) => x.cap === c)) expect(o.r).toBe(0);
    }
  });

  it('sets how hard the fight round you is from your own kills, deaths and shields, and tells the tally nothing of it', () => {
    const k = at('empire', MS);
    const p = k.front.info.laid.at;
    const here = { x: p[0], y: p[1], z: p[2] };
    for (let i = 0; i < 3; i++) k.front.update(1, 0, camera, here, { shield: 100, down: false });
    expect(k.front.info.difficulty).toBeCloseTo(1, 1); // (just come in: at par)
    // shot down twice, and low on shields
    for (let n = 0; n < 2; n++) {
      k.front.update(1, 0, camera, null, { shield: 0, down: true });
      k.front.update(1, 0, camera, here, { shield: 20, down: false });
    }
    for (let i = 0; i < 3; i++) k.front.update(1, 0, camera, here, { shield: 20, down: false });
    expect(k.front.info.difficulty).toBe(0.6);
    for (const m of k.sent.fight) for (const key of Object.keys(m.m)) expect(key).toBe('here:d');
  });

  it('says where the battle’s got to: its stage, that stage’s objectives with the hp every pilot sees, and what’s next on its clock', () => {
    const k = at('rebel', MS);
    const info = k.front.info;
    const plan = k.front.director.plan;
    expect(info.stage).toMatchObject({ index: 0, count: plan.stages.length, open: true });
    expect(info.objectives.map((o) => o.id)).toEqual(plan.stages[0].objectives.map((o) => o.id));
    const st = k.front.director.state(info.shared.t, () => 0);
    for (const o of info.objectives) {
      expect(typeof o.name).toBe('string');
      expect(o.hp).toBeCloseTo(st.objectives.find((x) => x.id === o.id).hp, 6);
    }
    const next = plan.escalations.find((e) => e.at > info.shared.t);
    expect(info.next).toMatchObject({ type: next.type, at: next.at });
    expect(info.next.in).toBeCloseTo(next.at - info.shared.t, 1);
    expect(info.result).toBeNull();
  });

  it('sets its result once, when the director decides it: who won, why, and what you did in it', () => {
    const k = at('rebel', MS);
    const g = firstOpen(k.front.battle);
    for (let i = 0; i < 400 && g.alive; i++) shoot(k.front, g.pos, 3);
    k.front.update(1 / 30, 0, camera, null);
    k.front.onNet(allDown(k));
    k.at(k.front.on.start + 301e3);
    k.front.update(1 / 30, 0, camera, null);
    k.front.update(1 / 30, 0, camera, null);
    const r = k.front.info.result;
    expect(r).toMatchObject({ winner: 0, why: k.front.battle.over.why });
    expect(typeof r.why).toBe('string');
    expect(r.yours.objectives).toBeGreaterThanOrEqual(1);
    expect(r.yours.points).toBeGreaterThanOrEqual(GCW.points.objective + GCW.points.win);
    expect(r.ago).toBeLessThan(2);
    k.front.update(1, 0, camera, null);
    expect(k.front.info.result.yours).toEqual(r.yours);
    expect(k.front.info.result.at).toBe(r.at);
  });

  it('ends a battle only when the director says, not on the battle’s own clock', () => {
    const k = at('rebel', MS);
    k.front.battle.clock = 650;
    for (let i = 0; i < 20; i++) k.front.update(0.1, 0, camera, null);
    expect(k.front.battle.over).toBeNull();
  });
});

describe('a set piece’s target that’s one side’s to take, whoever attacks (ctx.mineAs)', () => {
  const atEndor = (side) => {
    const k = kit(side);
    k.front.enter(systemById('endor'), k.world);
    k.front.update(1 / 30, 0, camera, null);
    k.front.force('empire');
    const gen = k.front.pieces[0].targets.find((t) => t.kind === 'shieldgen');
    for (let i = 0; i < 10; i++) shoot(k.front, gen.at, 1);
    k.front.update(1, 0, camera, null);
    return k;
  };
  it('counts a Rebel defender’s shots on Endor’s moon generator, and sends them', () => {
    const k = atEndor('rebel');
    expect(k.front.battle.attacker).toBe(1);
    expect(k.sent.fight.at(-1).m['moon-gen']).toBeGreaterThan(0);
  });
  it('sends nothing of an Imperial attacker’s: the generator’s theirs', () => {
    const k = atEndor('empire');
    for (const m of k.sent.fight) expect(m.m['moon-gen'] ?? 0).toBe(0);
  });
});

describe('the Death Star’s superlaser at Endor (ctx.clock, ctx.losses)', () => {
  it('fires at the cruiser the plan loses when the shared clock says, not on a timer from when you came', () => {
    const k = kit('rebel');
    k.front.enter(systemById('endor'), k.world);
    k.front.update(1 / 30, 0, camera, null);
    k.front.force('empire');
    const shot = k.front.director.plan.losses.find((l) => l.by === 'superlaser');
    expect(shot).toBeTruthy();
    const fired = () => k.said.some((e) => e.type === 'event' && e.id === 'gcw-superlaser');
    k.front.skip(20);
    expect(fired()).toBe(false);
    k.front.jump(shot.at - 1 - 20);
    k.front.update(0.1, 0, camera, null);
    expect(fired()).toBe(true);
    const cap = k.front.battle.capitals.filter((c) => c.team === shot.team)[shot.index];
    expect(cap.alive && cap.dying <= 0).toBe(true);
    k.front.skip(2);
    expect(cap.alive && cap.dying <= 0).toBe(false);
  });
});

describe('every kind of battle', () => {
  it('a battle of each kind, in each war, starts and runs ten seconds without throwing', async () => {
    const { BATTLE_KINDS } = await import('./battles');
    const { WARS } = await import('./sides');
    const { WAR_SYSTEMS, warInfo } = await import('./gcw');
    for (const kind of Object.keys(BATTLE_KINDS)) {
      const id = WAR_SYSTEMS.find((x) => warInfo(x).kind === kind) ?? 'tatooine';
      for (const war of Object.values(WARS))
        for (const attacker of [war.liberator, war.raider, 'hutt']) {
          const k = kit(war.liberator);
          k.front.enter(systemById(id), k.world);
          k.front.update(1 / 30, 0, camera, null);
          k.front.force(attacker === 'hutt' ? 'hutt' : attacker);
          expect(k.front.info.laid, `${kind} ${war.id} ${attacker}`).toBeTruthy();
          for (let i = 0; i < 100; i++) k.front.update(0.1, i * 0.1, camera, null);
        }
    }
    // (54 battles of 64 fighters or more, each frame of a tenth three of the
    // battle's fixed steps of 1/30 s since it stopped stepping by the frame:
    // about 2.7 s alone, so more room than the default 5 s on a busy machine)
  }, 20000);
  it('the dev hook forces a battle of the kind asked for, wherever it is', () => {
    const k = kit('rebel');
    k.front.enter(systemById('scarif'), k.world);
    k.front.update(1 / 30, 0, camera, null);
    k.front.force('empire', 'evacuation');
    expect(k.front.info.laid.kind).toBe('evacuation');
    expect(k.front.battle.runners.length + 1).toBeGreaterThan(0);
    k.front.force('rebel', 'nonsense');
    expect(k.front.info.laid.kind).toBe('siege');
  });
  it('a runner of the other side’s, shot down, is an intercept, and the runners’ line is said as the first of them launches', () => {
    const k = kit('empire');
    k.front.enter(systemById('naboo'), k.world);
    k.front.update(1 / 30, 0, camera, null);
    k.front.force('rebel');
    expect(k.front.info.laid.kind).toBe('blockade');
    const at = k.front.info.laid.at;
    k.front.update(1 / 30, 0, camera, { x: at[0], y: at[1], z: at[2] });
    // (the runners launch at their own seconds of the battle, not as you
    // come: the first of the blockade's some minutes in)
    expect(k.front.battle.runners).toHaveLength(0);
    expect(k.said.some((e) => e.sub === 'blockade')).toBe(false);
    k.front.jump(k.front.director.plan.runners.startAt + 3);
    k.front.update(1 / 30, 0, camera, null);
    expect(k.said.filter((e) => e.sub === 'blockade')).toHaveLength(1);
    const r = k.front.battle.runners[0];
    for (let i = 0; i < 40 && r.alive; i++) shoot(k.front, r.seen, 5);
    k.front.update(1 / 30, 0, camera, null);
    expect(r.alive).toBe(false);
    expect(warTally(k.ms).mine(pointsKey('empire', 'naboo', k.front.on.step))).toBeCloseTo(GCW.points.intercept, 5);
    expect(k.said.filter((e) => e.sub === 'intercept')).toHaveLength(1);
    for (let i = 0; i < 3; i++) k.front.update(1, 0, camera, null);
    expect(k.sent.fight.at(-1).m['r:0']).toBeGreaterThan(0);
  });
  it('says the evacuation’s line, not the blockade’s, as its transports start to run', () => {
    const k = kit('rebel');
    k.front.enter(systemById('hoth'), k.world);
    k.front.update(1 / 30, 0, camera, null);
    k.front.force('empire');
    k.front.jump(k.front.director.plan.runners.startAt + 1);
    k.front.update(1 / 30, 0, camera, null);
    expect(k.said.filter((e) => e.sub === 'runners')).toHaveLength(1);
    expect(k.said.some((e) => e.sub === 'blockade')).toBe(false);
  });
  it('a kill near one of your side’s runners covers it', () => {
    const k = kit('rebel');
    k.front.enter(systemById('hoth'), k.world);
    k.front.update(1 / 30, 0, camera, null);
    k.front.force('empire');
    k.front.jump(k.front.director.plan.runners.startAt + 10);
    const at = k.front.info.laid.at;
    k.front.update(1 / 30, 0, camera, { x: at[0], y: at[1], z: at[2] });
    const r = k.front.battle.runners.find((x) => x.alive);
    const f = k.front.battle.fighters.find((x) => x.alive && x.team === 1);
    Object.assign(f.pos, { x: r.pos.x + 5, y: r.pos.y, z: r.pos.z });
    Object.assign(f.seen, f.pos);
    f.vel.x = f.vel.y = f.vel.z = 0;
    for (let i = 0; i < 40 && f.alive; i++) shoot(k.front, f.seen, 5);
    for (let i = 0; i < 3; i++) k.front.update(1, 0, camera, null);
    expect(k.sent.fight.at(-1).m[`c:${r.slot}`]).toBeGreaterThan(0);
  });
});

describe('the battle, as bodies for ship contact', () => {
  it('answers the other side’s fighters, never a hull (those are solids), a ram on one the battle’s strike', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    const b = k.front.battle;
    const bodies = k.front.bodies;
    const theirs = b.fighters.filter((f) => f.alive && f.team !== b.you.team);
    expect(bodies.map((o) => o.key).sort()).toEqual(theirs.map((f) => `f:${f.id}`).sort());
    expect(bodies.every((o) => o.side === 'foe')).toBe(true);
    const capitals = new Set(b.capitals.map((c) => c.kind));
    expect(bodies.some((o) => capitals.has(o.kind) && o.size > 2)).toBe(false);
    const one = bodies.find((o) => !theirs.find((f) => f.id === o.id).ace);
    const f = theirs.find((o) => o.id === one.id);
    expect(one.at).toBe(f.seen);
    expect(one.hit(f.hp)).toMatchObject({ id: f.id, down: true });
    expect(k.front.bodies.some((o) => o.key === one.key)).toBe(false);
  });
  it('answers nothing for one who’s sworn to nobody', () => {
    const k = kit(null);
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    expect(k.front.bodies).toEqual([]);
  });
});

describe('a space level’s Starfighter Assault in place of the war’s battle', () => {
  it('stands the war’s battle aside, lays the level’s, draws its pack, and counts nothing in the war', async () => {
    const { levelOf } = await import('./surface/missions/starfighter');
    const map = (await import('../../data/bf2017/maps/sb_endor.json')).default;
    const stages = (await import('../../data/bf2017/maps/sb_endor.stages.json')).default;
    const level = levelOf(map, stages);
    const k = kit(null);
    const pack = { update: vi.fn(), dispose: vi.fn() };
    const draw = vi.fn(() => pack);
    const world = { quiet: vi.fn(), war: { station: vi.fn(), holdShield: vi.fn() } };
    k.front.enter(systemById('endor'), world);
    expect(k.front.starfighter({ level, draw })).toBe(true);
    // (the level is the second Death Star's wreckage: the galaxy's Death Star and its shield stand aside)
    expect(world.war.station).toHaveBeenCalledWith('deathstar2', false);
    expect(world.war.holdShield).toHaveBeenCalledWith(false);
    expect(world.quiet).toHaveBeenLastCalledWith(true);
    const b = k.front.battle;
    expect(k.front.info.laid.kind).toBe('starfighter');
    expect(draw).toHaveBeenCalledWith(expect.objectContaining({ kind: 'starfighter', layout: expect.any(Object) }), expect.objectContaining({ unhide: expect.any(Function) }));
    // (unsworn: you fly for the attacker, the Empire, from its Star Destroyer)
    expect(k.front.info.team).toBe(1);
    expect(b.attacker).toBe(1);
    expect(k.front.director.plan.stages.map((s) => s.id)).toEqual(['corvettes', 'mines', 'top', 'beneath', 'engines']);
    expect(k.front.info.stage.title).toBe('Destroy the corvettes');
    expect(k.front.pieces).toEqual([]);
    k.front.update(1 / 30, 0, camera, null);
    expect(pack.update).toHaveBeenCalled();
    expect(k.front.battle).toBe(b);
    // a corvette shot down by you, the attacker: the end card's points, none of the war's
    const o = firstOpen(b);
    k.front.update(1 / 30, 0, camera, { x: o.pos.x, y: o.pos.y + 2, z: o.pos.z });
    for (let i = 0; i < 400 && o.alive; i++) {
      shoot(k.front, o.pos, 5);
      k.front.update(1 / 30, i / 30, camera, { x: o.pos.x, y: o.pos.y + 2, z: o.pos.z });
    }
    expect(warTally(k.ms).keys().filter((x) => !x.startsWith('here'))).toEqual([]);
    // (Endor's is fought in orbit: no area of its own to be inside)
    expect(k.front.enclosed({ x: 0, y: 0, z: 0 })).toBe(false);
    // the system left: the pack goes with it, and the world's own put back
    k.front.enter(null);
    expect(pack.dispose).toHaveBeenCalled();
    expect(world.quiet).toHaveBeenLastCalledWith(false);
  });

  it('flies on the side it was asked for', async () => {
    const { levelOf } = await import('./surface/missions/starfighter');
    const map = (await import('../../data/bf2017/maps/sb_endor.json')).default;
    const stages = (await import('../../data/bf2017/maps/sb_endor.stages.json')).default;
    const k = kit('empire');
    k.front.enter(systemById('endor'), k.world);
    k.front.starfighter({ level: levelOf(map, stages), side: 'rebel' });
    expect(k.front.info.team).toBe(0);
    expect(k.front.info.stage.title).toBe('Protect the corvettes');
  });
});

describe('a space level fought in an area of its own (Kamino’s)', () => {
  it('is inside its area where the pack’s area says so, and not once it’s gone', async () => {
    const { levelOf } = await import('./surface/missions/starfighter');
    const map = (await import('../../data/bf2017/maps/sb_kamino.json')).default;
    const stages = (await import('../../data/bf2017/maps/sb_kamino.stages.json')).default;
    const k = kit(null);
    const inside = vi.fn((p) => p.x === 1);
    k.drawn.setVisible = vi.fn();
    let unhide = null;
    k.front.enter(systemById('kamino'), k.world);
    k.front.starfighter({ level: levelOf(map, stages), draw: (laid, o) => ((unhide = o.unhide), { update: vi.fn(), dispose: vi.fn(), area: { inside } }) });
    // (the ships the pack draws hidden from the battle's drawing, and given back where the pack's tier leaves one out)
    const venator = k.front.battle.capitals.find((c) => c.kind === 'venator' && c.role === 'flagship');
    expect(k.drawn.setVisible).toHaveBeenCalledWith(venator, false);
    unhide('venator-return');
    expect(k.drawn.setVisible).toHaveBeenLastCalledWith(venator, true);
    expect(k.front.info.team).toBe(1);
    expect(k.front.director.plan.stages.map((s) => s.id)).toEqual(['bridges', 'cruisers', 'engines', 'beam']);
    expect(k.front.enclosed({ x: 1, y: 0, z: 0 })).toBe(true);
    expect(k.front.enclosed({ x: 2, y: 0, z: 0 })).toBe(false);
    k.front.enter(null);
    expect(k.front.enclosed({ x: 1, y: 0, z: 0 })).toBe(false);
  });
});
