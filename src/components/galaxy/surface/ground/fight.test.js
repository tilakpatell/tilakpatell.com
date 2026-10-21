import { describe, expect, test } from 'vitest';
import { createTokens } from '../../../../lib/ai/squad';
import { WEAPONS } from '../weaponRules';
import { FACING, GRUDGE, aimError, fightStep, grudge, indexBodies, squadsOf, suppress, threatOf, senseAll } from './fight';
import { flatMinds } from './fixtures/minds';
import { TROOPS, newSoldier } from './troops';

let n = 0;
const mk = (kind, side, x, z, yaw = 0, o = {}) => newSoldier({ id: o.id ?? `s${n++}`, kind, side, role: o.role ?? 'post', at: [x, z], yaw, home: o.home ?? [x, z], beat: o.beat, squad: o.squad ?? `q${n}` }, () => 0);
const bodyOf = (s) => ({ id: s.id, x: s.b.x, z: s.b.z, vel: [0, 0], side: s.side, kind: s.kind, squad: s.squad, firingAt: s.firingAt ?? null });
// (each soldier thinks with the game's brain, on flat open ground: fixtures/minds.js)
const worldOf = (soldiers, extra = [], o = {}) => {
  const seesThrough = o.seesThrough ?? (() => true);
  return { t: 0, war: 'gcw', bodies: [...soldiers.map(bodyOf), ...extra], seesThrough, tokens: o.tokens ?? createTokens({ pools: { shot: 3, melee: 1 }, timeout: 0.9 }), squads: o.squads ?? null, minds: flatMinds({ seesThrough }).minds };
};
const DT = 1 / 30;
// step every soldier for `secs`, the world's bodies kept up to date; outs by id
function run(soldiers, w, secs, { extra = () => [], moveYou = null } = {}) {
  const outs = new Map(soldiers.map((s) => [s.id, []]));
  for (let t = 0; t < secs; t += DT) {
    w.t += DT;
    w.bodies = [...soldiers.filter((s) => s.alive).map(bodyOf), ...extra(w.t)];
    for (const s of soldiers) {
      if (!s.alive) continue;
      const o = fightStep(s, w, DT, () => 0.5);
      s.b.x = o.x;
      s.b.z = o.z;
      s.b.yaw = o.yaw;
      outs.get(s.id).push({ ...o, t: w.t });
    }
    w.tokens.audit(DT);
    moveYou?.(w.t);
  }
  return outs;
}
const angleTo = (o, p) => {
  const a = Math.atan2(p.x - o.x, p.z - o.z) - o.yaw;
  return Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
};

describe('the fight', () => {
  test('no shot without a line, and none until facing within 25°', () => {
    const s = mk('stormtrooper', 'empire', 0, 0, Math.PI / 2); // (facing +x)
    const foe = { id: 'r', x: 14, z: 14, vel: [0, 0], side: 'rebel', kind: 'rebel' };
    const w = worldOf([s]);
    const outs = run([s], w, 3, { extra: () => [foe] }).get(s.id);
    const first = outs.find((o) => o.target === 'r');
    expect(first).toBeTruthy();
    expect(first.fire).toBe(false);
    expect(angleTo(first, foe)).toBeGreaterThan(FACING);
    const fired = outs.filter((o) => o.fire);
    expect(fired.length).toBeGreaterThan(0);
    for (const o of fired) expect(angleTo(o, foe)).toBeLessThanOrEqual(FACING + 1e-6);
  });
  test('a mover in sight is led: aimed where it will be when the bolt arrives', () => {
    const s = mk('stormtrooper', 'empire', 0, 0, 0); // (facing +z)
    const foe = { id: 'r', x: 0, z: 30, vel: [2.3, 0], side: 'rebel', kind: 'rebel' };
    const outs = run([s], worldOf([s]), 3, { extra: () => [foe] }).get(s.id);
    const fired = outs.filter((o) => o.fire);
    expect(fired.length).toBeGreaterThan(0);
    // (30 m at 90 m/s: a third of a second, so 0.77 m ahead of it)
    for (const o of fired) expect(o.aim.x).toBeCloseTo((2.3 * Math.hypot(o.aim.x, 30 - o.z)) / 90, 1);
    for (const o of fired) expect(o.aim.x).toBeGreaterThan(0.6);
  });
  test('a wall between: no fire; lost: one burst at the last place, then none', () => {
    const s = mk('stormtrooper', 'empire', 0, 0, 0);
    const foe = { id: 'r', x: 0, z: 20, vel: [0, 0], side: 'rebel', kind: 'rebel' };
    const walled = mk('stormtrooper', 'empire', 100, 0, 0);
    const w2 = worldOf([walled], [], { seesThrough: () => false });
    const never = run([walled], w2, 3, { extra: () => [{ ...foe, x: 100 }] }).get(walled.id);
    expect(never.some((o) => o.fire)).toBe(false);
    let wall = false;
    const w = worldOf([s], [], { seesThrough: () => !wall });
    const before = run([s], w, 2.5, { extra: () => [foe] }).get(s.id);
    expect(before.some((o) => o.fire)).toBe(true);
    wall = true;
    foe.x = 8; // (it moved behind the wall: the burst goes where it was)
    const after = run([s], w, 5, { extra: () => [foe] }).get(s.id);
    const shots = after.filter((o) => o.fire);
    expect(shots).toHaveLength(1);
    expect(shots[0].aim.x).toBeCloseTo(0, 0);
    expect(shots[0].aim.z).toBeCloseTo(20, 0);
    expect(shots[0].suppressive).toBe(true);
  });
  test('threats: whoever shoots at my squad first, then the nearest enemy, never an ally or a neutral', () => {
    const s = mk('stormtrooper', 'empire', 0, 0, 0, { squad: 'A' });
    const mate = mk('stormtrooper', 'empire', 2, 0, 0, { squad: 'A' });
    const bodies = [
      { id: 'friend', x: 0, z: 5, vel: [0, 0], side: 'empire', kind: 'stormtrooper', squad: 'B' },
      { id: 'jawa', x: 0, z: 3, vel: [0, 0], side: null, kind: 'jawa' },
      { id: 'far', x: 0, z: 30, vel: [0, 0], side: 'rebel', kind: 'rebel', firingAt: mate.id },
      { id: 'near', x: 3, z: 10, vel: [0, 0], side: 'rebel', kind: 'rebel' },
    ];
    const w = worldOf([s, mate], bodies);
    for (let t = 0; t < 3; t += DT) senseAll(s, w, DT);
    expect(threatOf(s, w).id).toBe('far');
    w.bodies = w.bodies.map((b) => (b.id === 'far' ? { ...b, firingAt: null } : b));
    s.target = null;
    expect(threatOf(s, w).id).toBe('near');
  });
  test('an unsworn you is neutral until you shoot at one, then its squad for GRUDGE seconds', () => {
    const a = mk('stormtrooper', 'empire', 0, 0, 0, { squad: 'A' });
    const b = mk('stormtrooper', 'empire', 3, 0, 0, { squad: 'A' });
    const you = { id: 'you', x: 0, z: 12, vel: [0, 0], side: null, kind: 'you', you: true };
    const w = worldOf([a, b], [you]);
    const squads = squadsOf([a, b], { reach: 18 });
    w.squads = squads;
    squads.update(0.5);
    for (let t = 0; t < 2; t += DT) {
      senseAll(a, w, DT);
      senseAll(b, w, DT);
    }
    expect(threatOf(a, w)).toBeNull();
    grudge(a, squads, w.t);
    expect(threatOf(a, w).id).toBe('you');
    expect(threatOf(b, w).id).toBe('you');
    w.t += GRUDGE + 1;
    a.target = null;
    expect(threatOf(a, w)).toBeNull();
    // (sworn to the other side, you're its enemy from the start)
    w.bodies = [bodyOf(a), { ...you, side: 'rebel' }];
    expect(threatOf(a, w).id).toBe('you');
  });
  test('aim error grows with range, crossing speed and suppression, and the first shot of a burst', () => {
    const s = mk('stormtrooper', 'empire', 0, 0);
    const spread = WEAPONS.rifle.spread;
    const range = TROOPS.stormtrooper.range;
    const t = { vel: [0, 0] };
    expect(aimError(s, t, 1, {})).toBeCloseTo(spread, 3);
    expect(aimError(s, t, range, {})).toBeCloseTo(spread * 2.2, 3);
    expect(aimError({ ...s, suppressed: 99 }, t, 1, {}) / aimError(s, t, 1, {})).toBeCloseTo(2);
    expect(aimError(s, t, 1, { first: true }) / aimError(s, t, 1, {})).toBeCloseTo(1.5);
    // (running across its view at 6 m/s doubles it; along the line, nothing)
    expect(aimError(s, { x: 0, z: 10, vel: [6, 0] }, 1, {}) / aimError(s, t, 1, {})).toBeCloseTo(2);
    expect(aimError(s, { x: 0, z: 10, vel: [0, 6] }, 1, {}) / aimError(s, t, 1, {})).toBeCloseTo(1);
    suppress(s, 10);
    expect(s.suppressed).toBeCloseTo(11.5);
  });
  test('a retreating squad takes only back and cover, a pressing one sends flankers', () => {
    const foe = { id: 'r', x: 0, z: 14, vel: [0, 0], side: 'rebel', kind: 'rebel' };
    const s = mk('stormtrooper', 'empire', 0, 0, 0);
    const w = worldOf([s], [], { squads: { postureOf: () => 'retreat', isFlanker: () => false } });
    const outs = run([s], w, 4, { extra: () => [foe] }).get(s.id).filter((o) => o.target);
    expect(outs.length).toBeGreaterThan(0);
    for (const o of outs) expect(['back', 'cover']).toContain(o.mode);
    const p = mk('stormtrooper', 'empire', 0, 0, 0);
    const wp = worldOf([p], [], { squads: { postureOf: () => 'press', isFlanker: () => true } });
    const pouts = run([p], wp, 4, { extra: () => [foe] }).get(p.id);
    expect(pouts.some((o) => o.mode === 'flank')).toBe(true);
  });
  test('the squad’s nerve: losses drive it to retreat, outnumbering to press, and droids never break', () => {
    const imps = [0, 1, 2, 3].map((i) => mk('stormtrooper', 'empire', i * 2, 0));
    const rebs = [0, 1].map((i) => mk('rebel', 'rebel', i * 2, 30));
    const all = [...imps, ...rebs];
    const sq = squadsOf(all, { reach: 18, war: 'gcw' });
    sq.update(0.5);
    expect(sq.postureOf(imps[0].id)).toBe('press');
    expect(sq.postureOf(rebs[0].id)).toBe('retreat');
    for (const s of imps.slice(0, 3)) s.alive = false;
    rebs.push(...[4, 6].map((x) => mk('rebel', 'rebel', x, 30)));
    all.push(...rebs.slice(2));
    sq.update(0.5);
    expect(sq.postureOf(imps[3].id)).toBe('retreat');
    const droids = [0, 1].map((i) => mk('battledroid', 'separatists', i * 2, 100));
    const clones = [0, 1, 2, 3, 4].map((i) => mk('clone', 'republic', i * 2, 130));
    const sq2 = squadsOf([...droids, ...clones], { reach: 18, war: 'clone' });
    sq2.update(0.5);
    expect(sq2.postureOf(droids[0].id)).not.toBe('retreat');
  });
  test('tokens are per target: three may fire at you and three more at your mate', () => {
    const tokens = createTokens({ pools: { shot: 3, melee: 1 }, timeout: 0.9 });
    const atYou = [0, 1, 2, 3].map((i) => mk('stormtrooper', 'empire', i * 3, 0));
    const atMate = [0, 1, 2].map((i) => mk('stormtrooper', 'empire', 300 + i * 3, 0));
    const you = { id: 'you', x: 4, z: 15, vel: [0, 0], side: 'rebel', kind: 'you', you: true };
    const mate = { id: 'mate', x: 304, z: 15, vel: [0, 0], side: 'rebel', kind: 'rebel', you: true };
    const all = [...atYou, ...atMate];
    const w = worldOf(all, [], { tokens });
    let most = { you: 0, mate: 0 };
    const extra = () => [you, mate];
    for (let t = 0; t < 4; t += DT) {
      run(all, w, DT, { extra });
      most = { you: Math.max(most.you, tokens.count('shot', 'you')), mate: Math.max(most.mate, tokens.count('shot', 'mate')) };
    }
    expect(most).toEqual({ you: 3, mate: 3 });
  });
  test('a soldier with no enemy walks its beat or holds its post', () => {
    const beat = [[0, 0], [20, 0], [20, 20], [0, 20]];
    const p = mk('stormtrooper', 'empire', 0, 0, 0, { role: 'patrol', beat });
    const post = mk('stormtrooper', 'empire', 50, 50, 1.2);
    const w = worldOf([p, post]);
    const outs = run([p, post], w, 12);
    expect(outs.get(p.id).every((o) => o.mode === 'patrol')).toBe(true);
    expect(Math.hypot(p.b.x, p.b.z)).toBeGreaterThan(5);
    expect(outs.get(post.id).every((o) => o.mode === 'post' && o.fire === false)).toBe(true);
    expect([post.b.x, post.b.z]).toEqual([50, 50]);
    expect(post.b.yaw).toBeCloseTo(1.2);
  });
  test('engaged, the leash is roam + range; a target beyond range is closed on', () => {
    const s = mk('stormtrooper', 'empire', 0, 0, 0);
    const range = TROOPS.stormtrooper.range;
    const foe = { id: 'r', x: 0, z: range + 8, vel: [0, 0], side: 'rebel', kind: 'rebel' };
    const w = worldOf([s]);
    const outs = run([s], w, 8, { extra: () => [foe] }).get(s.id);
    expect(outs.some((o) => o.mode === 'advance')).toBe(true);
    expect(Math.hypot(foe.x - s.b.x, foe.z - s.b.z)).toBeLessThanOrEqual(range);
    expect(Math.hypot(s.b.x, s.b.z)).toBeLessThanOrEqual(s.leash + range);
    // (never past the stretched leash, however far it's drawn)
    const t = mk('stormtrooper', 'empire', 0, 0, 0);
    const lure = { id: 'r2', x: 0, z: range + 8, vel: [0, 0], side: 'rebel', kind: 'rebel' };
    const w2 = worldOf([t]);
    run([t], w2, 30, { extra: (now) => [{ ...lure, z: range + 8 + now * 3 }] });
    expect(Math.hypot(t.b.x, t.b.z)).toBeLessThanOrEqual(t.leash + range + 0.5);
  });
  test('a body the walker holds back is a stuck brain, which finds its own way round; one let go is not', () => {
    const range = TROOPS.stormtrooper.range;
    const foe = { id: 'r', x: 0, z: range + 8, vel: [0, 0], side: 'rebel', kind: 'rebel' };
    const most = (hold) => {
      const s = mk('stormtrooper', 'empire', 0, 0, 0);
      const w = worldOf([s]);
      let top = 0;
      for (let t = 0; t < 3; t += DT) {
        w.t += DT;
        w.bodies = [bodyOf(s), foe];
        const o = fightStep(s, w, DT, () => 0.5);
        // (a wall the navgrid lacks, across its way in: the scene's walker keeps it where it was)
        if (!hold || o.z < 2) {
          s.b.x = o.x;
          s.b.z = o.z;
        }
        s.b.yaw = o.yaw;
        top = Math.max(top, s.bot?.brain.stuck ?? 0);
      }
      return { top, s };
    };
    const held = most(true);
    // (held past a second, the brain plans again: its own `stuck`)
    expect(held.top).toBeGreaterThan(1);
    expect(held.s.stuckFor).toBeGreaterThan(1);
    const free = most(false);
    expect(free.top).toBeLessThan(0.5);
    expect(free.s.b.z).toBeGreaterThan(5);
  });
});

describe('the squads over a long visit', () => {
  test('a squad all down or gone is forgotten, and so are the fallen once counted', () => {
    const list = [];
    const sq = squadsOf(list, { reach: 18, war: 'gcw' });
    for (let k = 0; k < 50; k++) {
      const a = mk('stormtrooper', 'empire', k * 100, 0);
      const b = mk('rebel', 'rebel', k * 100, 20);
      list.push(a, b);
      sq.update(0.5);
      a.alive = false;
      sq.died(a.id);
      sq.update(0.5);
      list.length = 0; // (dropped behind you)
      sq.update(0.5);
    }
    expect(sq.sizes()).toEqual({ squads: 0, fallen: 0 });
  });
});

describe('the bodies, indexed once a frame', () => {
  test('by side and by squad', () => {
    const i = indexBodies([{ id: 'a', side: 'empire', squad: 'q' }, { id: 'b', side: 'empire', squad: 'r' }, { id: 'you', side: null, you: true }]);
    expect(i.bySide.get('empire').map((b) => b.id)).toEqual(['a', 'b']);
    expect(i.bySide.get(null).map((b) => b.id)).toEqual(['you']);
    expect(i.bySquad.get('q').map((b) => b.id)).toEqual(['a']);
  });
});
