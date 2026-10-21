import { describe, expect, test } from 'vitest';
import { createSolids, pushOut } from '../walker';
import { NAV, createMinds, createNavWindow, familyOf, navSolids, taskOf } from './brain';
import * as lib from './brainLib';
import { flatMinds } from './fixtures/minds';
import { TROOPS, newSoldier } from './troops';

const ai = lib.aiRows();
const DT = 1 / 30;
let n = 0;
const mk = (kind, side, x, z, yaw = 0, o = {}) => newSoldier({ id: o.id ?? `b${n++}`, kind, side, role: o.role ?? 'post', at: [x, z], yaw, home: o.home ?? [x, z], squad: o.squad ?? `q${n}` }, () => 0.5);
const bodyOf = (s) => ({ id: s.id, x: s.b.x, z: s.b.z, vel: [0, 0], side: s.side, kind: s.kind, squad: s.squad });

describe('the navgrid from the walker’s ground and solids', () => {
  test('a box and a circle of the walker’s are nav.js’s boxes, turned the same way', () => {
    const solids = createSolids();
    const box = solids.box(10, 0, 4, 1, 0.6, { top: 3 });
    const tree = solids.circle(-10, 0, 1.5);
    const [b, c] = navSolids(solids.all, () => 0);
    expect(b).toMatchObject({ at: [10, 1, 0], half: [4, 2, 1] });
    expect(b.yaw).toBeCloseTo(0.6);
    // (no top: it stands well over a soldier, from under the ground)
    expect(c.half[0]).toBe(1.5);
    expect(c.at[1] + c.half[1]).toBeGreaterThan(10);
    const w = createNavWindow({ lib, heightAt: () => 0, solids, slice: Infinity });
    w.update(0, 0);
    // every point the walker would push a soldier out of is no ground for the brain either
    for (let x = 4; x <= 16; x += 0.5)
      for (let z = -5; z <= 5; z += 0.5) if (pushOut(box, x, z, NAV.radius) && Math.hypot(x - 10, z) < 3.5) expect(lib.walkable(w.nav, x, z), `${x}, ${z}`).toBe(false);
    expect(lib.walkable(w.nav, -10, 0)).toBe(false);
    expect(lib.walkable(w.nav, 0, 0)).toBe(true);
    expect(tree.r).toBe(1.5);
  });
  test('the window: 2 m cells round where it was built, the sea shut, built again once you go far enough', () => {
    const w = createNavWindow({ lib, heightAt: (x) => (x > 50 ? -3 : 1), standable: ([x]) => x <= 50, slice: Infinity });
    expect(w.update(0, 0)).toBe(true);
    expect(w.nav.cell).toBe(2);
    expect(w.nav.cols * w.nav.cell).toBe(2 * NAV.half);
    expect(lib.walkable(w.nav, 20, 0)).toBe(true);
    expect(lib.walkable(w.nav, 80, 0)).toBe(false);
    expect(w.update(NAV.again - 1, 0)).toBe(false);
    expect(w.update(NAV.again + 1, 0)).toBe(true);
    expect(w.builds).toBe(2);
    expect(w.ms).toBeGreaterThanOrEqual(0);
  });
  test('a window is made a slice of a frame at a time, the last one walked on meanwhile', () => {
    let asked = 0;
    const heightAt = () => {
      asked += 1;
      return 0;
    };
    // (no time at all for a frame's slice: a chunk of 256 cells a frame, the least it takes)
    const w = createNavWindow({ lib, heightAt, slice: 0 });
    const cells = Math.ceil((2 * NAV.half) / NAV.cell) ** 2;
    let frames = 1;
    while (!w.update(0, 0)) frames += 1;
    expect(frames).toBe(Math.ceil(cells / 256));
    expect(w.nav).toBeTruthy();
    const first = w.nav;
    // (gone far enough: the next is begun, and the first stays the one walked on till it is in)
    expect(w.update(NAV.again + 5, 0)).toBe(false);
    expect(w.making()).toBe(true);
    expect(w.nav).toBe(first);
    while (!w.update(NAV.again + 5, 0)) frames += 1;
    expect(w.nav).not.toBe(first);
    expect(w.centre).toEqual([NAV.again + 5, 0]);
    expect(w.making()).toBe(false);
    // (each cell's height asked once a window, never again by the build)
    expect(asked).toBe(2 * cells);
  });
});

describe('a soldier’s mind', () => {
  test('its brain plays its kind’s template and tactics, its body the game’s class, its gun’s family and the ground’s bolt', () => {
    const { minds } = flatMinds();
    const s = mk('stormtrooper', 'empire', 0, 0);
    const m = minds.mindOf(s);
    expect(m.brain.template).toBe(ai.templates.rifleman);
    expect(m.brain.tactics).toBe(ai.tactics.Rifleman_Tactics);
    expect(m.body.hpMax).toBe(150);
    expect(m.body.weapon).toMatchObject({ id: 'e11', family: 'rifle', range: TROOPS.stormtrooper.range, firing: { speed: 90 } });
    expect(m.every).toBeCloseTo(0.2);
    // (one set of senses: the brain's, the game's sight)
    expect(s.senses).toBe(m.brain.senses);
    expect(s.me).toBe(m.brain.me);
    const b2 = minds.mindOf(mk('superdroid', 'separatists', 0, 0));
    expect(b2.brain.tactics).toBe(ai.tactics.Heavy_Tactics);
    expect(b2.body.hpMax).toBe(TROOPS.superdroid.hp);
    expect(familyOf(TROOPS.mercenary)).toBe('pistol');
    expect(familyOf(TROOPS.dwarfspider)).toBe('heavy');
  });
  test('its errand is a commander’s task: its post or its beat’s start, as far as it reaches', () => {
    const s = mk('rebel', 'rebel', 3, 4, 0, { home: [5, 6] });
    expect(taskOf(s)).toEqual({ at: [5, 6], spot: [5, 6], radius: s.leash + TROOPS.rebel.range, reach: 3 });
  });
  test('its world: lines by the ground’s sight, enemies by the war’s sides and your oath, you as a player', () => {
    const wall = (a, b) => !(a.x < 5 && b.x > 5);
    const { minds } = flatMinds({ seesThrough: wall });
    const s = mk('stormtrooper', 'empire', 0, 0);
    minds.mindOf(s);
    const bodies = [bodyOf(s), { id: 'r', x: 10, z: 0, side: 'rebel', kind: 'rebel' }, { id: 'j', x: 0, z: 9, side: null, kind: 'jawa' }, { id: 'you', x: -6, z: 2, vel: [1, 0], side: 'rebel', you: true }];
    minds.frame({ bodies, war: 'gcw', t: 1 });
    const w = minds.worldFor(s, { posture: 'retreat' });
    expect(w.lineClear([0, 1, 0], [10, 1, 0])).toBe(false);
    expect(w.lineClear([0, 1, 0], [0, 1, 9])).toBe(true);
    expect(w.enemies).toEqual([
      [10, 0],
      [-6, 2],
    ]);
    expect(w.who('you')).toMatchObject({ bot: false, alive: true, at: [-6, 0, 2] });
    expect(w.who(s.id)).toBe(s.bot.body);
    expect(w.squad.posture).toBe('retreat');
    expect(w.task.at).toEqual(s.home);
    expect(w.nav).toBeTruthy();
  });
});

describe('the brain on the ground', () => {
  // a step of the fight's own: senses as fight.js gives them, a think on the brain's clock, a step of the body
  function duel(a, b, secs, { seesThrough = null, solids = null } = {}) {
    const { minds } = flatMinds({ seesThrough, solids });
    const shots = { [a.id]: [], [b.id]: [] };
    const modes = new Set();
    for (const s of [a, b]) minds.mindOf(s, () => 0.5);
    for (let t = DT; t <= secs; t += DT) {
      const bodies = [a, b].map(bodyOf);
      minds.frame({ bodies, war: 'gcw', t });
      for (const [s, o] of [
        [a, b],
        [b, a],
      ]) {
        const m = s.bot;
        // (what the fight's senses would have found: it in plain sight)
        m.brain.me.beliefs[o.id] = { id: o.id, at: { x: o.b.x, y: 0, z: o.b.z }, vel: { x: 0, y: 0, z: 0 }, confidence: 1, visible: true, hostile: true, seenAt: t };
        minds.sync(s);
        const w = minds.worldFor(s);
        if (t >= m.thinkAt) minds.think(s, w, t);
        modes.add(m.brain.intent.mode);
        const shot = minds.act(s, m.brain.intent, w, DT, t);
        if (shot) shots[s.id].push(t);
        s.b.x = m.body.at[0];
        s.b.z = m.body.at[2];
        s.b.yaw = m.body.yaw;
      }
    }
    return { shots, modes, minds };
  }
  test('two soldiers in the open fight: each picks the other, strafes and fires, no faster than its gun', () => {
    const a = mk('stormtrooper', 'empire', 0, 0);
    const b = mk('rebel', 'rebel', 0, 25, Math.PI);
    const { shots, modes } = duel(a, b, 6);
    expect(a.bot.brain.target).toBe(b.id);
    expect(b.bot.brain.target).toBe(a.id);
    expect(modes.has('attack')).toBe(true);
    for (const list of Object.values(shots)) {
      expect(list.length).toBeGreaterThan(0);
      for (let i = 1; i < list.length; i++) expect(list[i] - list[i - 1]).toBeGreaterThanOrEqual(0.2 - 1e-6);
    }
    // (the normal difficulty's reaction: no first shot before it)
    expect(Math.min(...shots[a.id])).toBeGreaterThanOrEqual(lib.difficultyFor('normal', ai).reaction(25) - 1e-6);
  });
  test('with a wall to hand, the attack takes cover behind it from the tactics’ own query', () => {
    const solids = createSolids();
    solids.box(0, 6, 3, 0.4, 0, { top: 1.2 });
    const a = mk('stormtrooper', 'empire', 0, 3);
    const b = mk('rebel', 'rebel', 0, 30, Math.PI);
    const { modes } = duel(a, b, 4, { solids });
    expect(modes.has('cover')).toBe(true);
    expect(a.bot.brain.cover).toBeTruthy();
  });
  test('walking round what stands in its way: the navgrid’s path, never through the solid', () => {
    const solids = createSolids();
    const wall = solids.box(0, 10, 8, 0.5, 0, { top: 3 });
    const { minds } = flatMinds({ solids });
    const s = mk('stormtrooper', 'empire', 0, 0);
    const m = minds.mindOf(s);
    let inside = 0;
    for (let t = DT; t <= 15; t += DT) {
      minds.frame({ bodies: [bodyOf(s)], war: 'gcw', t });
      minds.sync(s);
      minds.act(s, { mode: 'objective', goal: [0, 20], stance: 'stand', fire: false, aim: null, sprint: false }, minds.worldFor(s), DT, t);
      s.b.x = m.body.at[0];
      s.b.z = m.body.at[2];
      if (pushOut(wall, s.b.x, s.b.z, 0.2)) inside += 1;
    }
    expect(inside).toBe(0);
    expect(Math.hypot(s.b.x, s.b.z - 20)).toBeLessThan(1.5);
  });
  test('the trigger is pressed a sim frame at a time, however often the ground steps', () => {
    const { minds } = flatMinds();
    const s = mk('stormtrooper', 'empire', 0, 0);
    const m = minds.mindOf(s);
    minds.frame({ bodies: [bodyOf(s)], war: 'gcw', t: 0 });
    m.brain.pattern = { bits: Array(1000).fill(false), delay: 0 };
    m.brain.frame = 0;
    for (let k = 1; k <= 120; k++) {
      minds.sync(s);
      minds.act(s, { mode: 'attack', goal: null, stance: 'stand', fire: false, aim: null }, minds.worldFor(s), 1 / 120, k / 120);
    }
    // (a second at 120 frames a second: the sim's twenty)
    expect(m.brain.frame).toBe(Math.round(1 / lib.STEP));
  });
  test('the difficulty is one setting, and every brain takes it', () => {
    const { minds } = flatMinds();
    const s = mk('stormtrooper', 'empire', 0, 0);
    minds.mindOf(s);
    expect(minds.difficulty.key).toBe('multiplayer:normal');
    minds.setDifficulty('expert');
    expect(s.bot.brain.difficulty.key).toBe('multiplayer:expert');
    expect(s.bot.brain.difficulty.reaction(30)).toBeLessThan(lib.difficultyFor('normal', ai).reaction(30));
    const r = createMinds({ lib, ai, difficulty: 'rookie', nav: () => null });
    expect(r.ready()).toBe(false);
    expect(r.difficulty.damage).toBe(0.75);
  });
  test('a near miss suppresses by the shooter’s tactics; you and your mate by the player’s', () => {
    const { minds } = flatMinds();
    const h = mk('superdroid', 'separatists', 0, 0);
    minds.mindOf(h);
    minds.frame({ bodies: [bodyOf(h)], war: 'clone', t: 0 });
    expect(minds.suppressionOf(h.id)).toBe(ai.tactics.Heavy_Tactics.suppression.value);
    expect(minds.suppressionOf('you')).toBe(ai.tactics.AIRebelSoldierTactics.suppression.value);
  });
});
