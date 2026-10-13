// A bot given the AutoPlayers' numbers (an Instant Action round's) is run by
// the game's own rules, read from its code (NOTES.md, "The AutoPlayers"): the
// tracker's target, the noisy aim point, the trigger's tolerance and cadence,
// the line of fire's flag, the strafe. A bot given none is the bot it was.
import { describe, expect, it } from 'vitest';
import gs from '../../../data/bf2017/gameSettings.json';
import { seeded } from '../../seeded.js';
import { aiOf, classOf, loadRulebook, weaponOf } from '../rulebook.js';
import { buildNav, lineClear, shields } from '../nav.js';
import { hothFlatNav } from '../fixtures/hothFlat.js';
import { roundFor, startInstantAction } from '../instantAction.js';
import { chestOf, newSoldier } from '../soldier.js';
import { STEP, THINK } from '../core.js';
import { autoPlayerFor } from './autoPlayer.js';
import { CONE, act, createBrain, engaging, think } from './soldierBrain.js';

const rb = loadRulebook();
const ai = aiOf(rb);
const open = buildNav({ heightAt: () => 0, bounds: { min: [-600, -600], max: [600, 600] }, cell: 4, solids: [], cover: ai.cover.constants });
const normal = () => autoPlayerFor(gs, { mode: 'instantAction', difficulty: 'normal', side: 'Enemies' });

function bot(at, over = {}) {
  const cls = classOf(rb, 'l-orig-assault');
  const s = newSoldier(cls, { id: 'me', team: 1, at, weapon: weaponOf(rb, cls.weapon), rand: seeded(1) });
  return createBrain(s, { ai, rand: seeded(1), ...over });
}

// an enemy soldier, facing back down −z (toward a bot south of it) unless told
function enemy(id, at, over = {}) {
  const cls = classOf(rb, 'd-orig-assault');
  const e = newSoldier(cls, { id, team: 2, at, yaw: Math.PI, weapon: weaponOf(rb, cls.weapon), rand: seeded(2) });
  return Object.assign(e, over);
}

function world(enemies = [], extra = {}) {
  const shots = [];
  const by = new Map(enemies.map((e) => [e.id, e]));
  const v = (p) => ({ x: p[0], y: p[1], z: p[2] });
  return {
    shots,
    nav: open,
    lineClear: (a, b) => lineClear(open, a, b),
    shields,
    squad: null,
    objective: null,
    enemies: enemies.map((e) => [e.at[0], e.at[2]]),
    taken: new Map(),
    // (as the sim gathers them each step: every living enemy, where its chest is)
    get targets() {
      return [...by.values()].filter((e) => e.alive).map((e) => ({ id: e.id, at: v(chestOf(e)), vel: { x: e.vel[0], y: 0, z: e.vel[2] }, hostile: true }));
    },
    who: (id) => by.get(id) ?? null,
    shoot: (s, aim) => shots.push(aim),
    ...extra,
  };
}

// the bot thinks every THINK and acts every step for `seconds`; the times of its shots
function run(b, w, seconds, from = 0) {
  const at = [];
  let next = from;
  for (let t = from; t < from + seconds - 1e-9; t += STEP) {
    if (t + 1e-9 >= next) {
      b.intent = think(b, w, t);
      next += THINK;
    }
    const n = w.shots.length;
    act(b, b.intent, b.s, STEP, w, t);
    if (w.shots.length > n) at.push(Math.round(t * 1000) / 1000);
  }
  return at;
}

describe('a bot with no numbers', () => {
  it('carries none and sees by its own cone', () => {
    const b = bot([0, 0, -50]);
    expect(b.ap).toBeNull();
    expect(b.apAim).toBeNull();
    expect(b.senses.sight.cone).toBe(CONE);
  });
});

describe('the tracker’s target', () => {
  it('reaches as far as the scale times the gun’s own range', () => {
    const b = bot([0, 0, 0], { ap: normal() });
    expect(engaging(b, b.s.weapon.range)).toBe(2.5 * b.s.weapon.range);
  });

  it('is the nearest enemy inside the field of view whose line of fire it has, taken once that line has been clear the reaction', () => {
    const b = bot([0, 0, -50], { ap: normal() });
    const w = world([enemy('far', [0, 0, 40]), enemy('near', [5, 0, -20])]);
    expect(think(b, w, 0).target).toBe(null);
    expect(think(b, w, THINK).target).toBe('near');
  });

  it('is an enemy far past its sight, inside the engaging distance', () => {
    const b = bot([0, 0, -50], { ap: normal() });
    const w = world([enemy('far', [0, 0, 300])]);
    think(b, w, 0);
    expect(think(b, w, THINK).target).toBe('far');
    const c = bot([0, 0, -50], { ap: normal() });
    const out = world([enemy('out', [0, 0, 500])]);
    think(c, out, 0);
    expect(think(c, out, THINK).target).toBe(null);
  });

  it('is kept two seconds, then picked again every time: the nearest now', () => {
    const b = bot([0, 0, -50], { ap: normal() });
    const near = enemy('near', [5, 0, -20]);
    const w = world([near]);
    think(b, w, 0);
    expect(think(b, w, THINK).target).toBe('near');
    const nearer = enemy('nearer', [-3, 0, -35]);
    const w2 = world([near, nearer]);
    expect(think(b, w2, THINK + 1).target).toBe('near');
    // (past its two seconds: the nearer one is looked at, its line not yet clear the reaction, so none; then it)
    expect(think(b, w2, THINK + 2.2).target).toBe(null);
    expect(think(b, w2, THINK + 2.2 + THINK).target).toBe('nearer');
  });

  it('is none when the nearest in view has no line of fire, though a farther one stands in the open', () => {
    const b = bot([0, 0, -50], { ap: normal() });
    const near = enemy('near', [0, 0, -20]);
    const far = enemy('far', [30, 0, 0]);
    const w = world([near, far], { lineClear: (a, c) => Math.abs(c[2] - chestOf(near)[2]) > 1 });
    for (let t = 0; t < 2; t += THINK) expect(think(b, w, t).target).toBe(null);
  });

  it('is not one behind it past the field of view, 140° either side', () => {
    const ap = normal();
    expect(ap.fov).toBe(140);
    const b = bot([0, 0, -50], { ap });
    // (the bot faces +z: an enemy straight behind is 180° off)
    const w = world([enemy('behind', [0, 0, -90])]);
    think(b, w, 0);
    expect(think(b, w, THINK).target).toBe(null);
    const side = world([enemy('side', [40, 0, -70])]);
    think(b, side, 0);
    expect(think(b, side, THINK).target).toBe('side');
    expect(b.senses.sight.cone).toBeCloseTo(Math.cos((140 * Math.PI) / 180), 9);
  });
});

describe('the trigger', () => {
  it('waits for the line of fire, then fires in the weapon’s bursts: 0.2 s held, 0.1 s let go', () => {
    const ap = { ...normal(), noise: { blaster: 0, lmg: 0, shotgun: 0, sniper: 0, launcher: 0 } };
    const b = bot([0, 0, -50], { ap });
    const shots = run(b, world([enemy('them', [0, 0, -30])]), 2);
    expect(shots[0]).toBeGreaterThanOrEqual(THINK - 1e-9);
    // (four steps held, two let go)
    const first = shots[0];
    const steps = shots.filter((t) => t < first + 0.6 - 1e-9).map((t) => Math.round((t - first) / STEP));
    expect(steps).toEqual([0, 1, 2, 3, 6, 7, 8, 9]);
  });

  it('fires at where the target is for the timeout after its line is lost, then stops', () => {
    const ap = { ...normal(), lofTimeout: 0.5, noise: { blaster: 0, lmg: 0, shotgun: 0, sniper: 0, launcher: 0 } };
    const b = bot([0, 0, -50], { ap });
    const them = enemy('them', [0, 0, -30]);
    let hidden = false;
    const w = world([them], { lineClear: () => !hidden });
    run(b, w, 1);
    expect(w.shots.length).toBeGreaterThan(0);
    hidden = true;
    them.at[0] = 3; // (it moves behind its wall: the bot's aim goes with it)
    const after = run(b, w, 2, 1);
    expect(after.length).toBeGreaterThan(0);
    expect(after.at(-1)).toBeLessThan(1.5 + 0.2 + STEP);
    expect(w.shots.at(-1)[0]).toBeGreaterThan(1.5);
  });

  it('a rookie’s shots go wider than an expert’s', () => {
    const spread = (difficulty) => {
      const b = bot([0, 0, -50], { ap: autoPlayerFor(gs, { mode: 'instantAction', difficulty, side: 'Enemies' }) });
      const w = world([enemy('them', [0, 0, -20])]);
      run(b, w, 20);
      expect(w.shots.length).toBeGreaterThan(20);
      return w.shots.reduce((n, a) => n + Math.abs(a[0]), 0) / w.shots.length;
    };
    expect(spread('rookie')).toBeGreaterThan(spread('expert') * 1.5);
  });

  it('fires nothing where its mode holds its fire', () => {
    const b = bot([0, 0, -50], { ap: normal() });
    const w = world([enemy('them', [0, 0, -30])]);
    think(b, w, 0);
    for (let t = THINK; t < 1.5; t += STEP) {
      if (Math.abs(t / THINK - Math.round(t / THINK)) < 1e-6) b.intent = { ...think(b, w, t), fire: false };
      if (b.intent) act(b, b.intent, b.s, STEP, w, t);
    }
    expect(w.shots).toHaveLength(0);
  });
});

describe('its way', () => {
  it('has no hiding, fleeing or closing in: hurt and under fire it keeps its target and its way', () => {
    const b = bot([0, 0, -50], { ap: normal() });
    const w = world([enemy('them', [0, 0, -30], { yaw: 0 })], { objective: [0, 100], squad: { centre: [0, -60], posture: 'retreat' } });
    b.s.suppressed = 1;
    b.s.hp = b.s.hpMax * 0.1;
    think(b, w, 0);
    for (let t = THINK; t < 3; t += THINK) {
      const i = think(b, w, t);
      expect(i.mode).toBe('attack');
      expect(i.target).toBe('them');
      expect(i.fire).toBe(true);
      expect(i.goal).toEqual([0, 100]);
    }
  });

  it('goes to the post it was sent to and round it inside its radius, sprinting with no target while far', () => {
    const b = bot([0, 0, -50], { ap: normal() });
    const task = { key: 'post1', at: [0, 80], spot: [0, 80], role: 'defend', radius: 8, reach: 0, interact: false };
    const far = think(b, world([], { task }), 0);
    expect(far).toMatchObject({ mode: 'objective', target: null, fire: false, sprint: true });
    expect(Math.hypot(far.goal[0] - 0, far.goal[1] - 80)).toBeLessThanOrEqual(8 + 6);
    const there = bot([0, 0, 79], { ap: normal() });
    expect(think(there, world([], { task }), 0).sprint).toBe(false);
  });
});

describe('the strafe', () => {
  const open2 = (b, w, seconds) => {
    const goals = [];
    for (let t = 0; t < seconds; t += THINK) {
      const i = think(b, w, t);
      if (i.target) goals.push({ t, mode: i.mode, goal: i.goal, stance: i.stance });
    }
    return goals;
  };

  it('runs when the bot and its target face each other, one way then the other for the settings’ time', () => {
    const ap = normal();
    const b = bot([0, 0, -50], { ap });
    const goals = open2(b, world([enemy('them', [0, 0, -30])]), 24).filter((g) => g.mode === 'attack');
    const sides = goals.map((g) => Math.sign(g.goal[0]));
    expect(new Set(sides)).toEqual(new Set([-1, 1]));
    const flips = goals.filter((g, k) => k > 0 && Math.sign(g.goal[0]) !== Math.sign(goals[k - 1].goal[0])).map((g) => g.t);
    expect(flips.length).toBeGreaterThanOrEqual(4);
    const [lo, hi] = ap.strafeInvert;
    for (let k = 1; k < flips.length; k++) {
      expect(flips[k] - flips[k - 1]).toBeGreaterThanOrEqual(lo - THINK - 1e-9);
      expect(flips[k] - flips[k - 1]).toBeLessThanOrEqual(hi + THINK + 1e-9);
    }
    // (a third of the legs go forward with it, a third back: the goal is not always dead abeam)
    const along = new Set(goals.map((g) => Math.sign(Math.round((g.goal[1] + 50) * 100) / 100)));
    expect(along).toEqual(new Set([-1, 0, 1]));
    // (crouched on some legs, upright on others)
    expect(new Set(goals.map((g) => g.stance))).toEqual(new Set(['stand', 'crouch']));
  });

  it('does not run at a target that looks away: the bot keeps to its way', () => {
    const b = bot([0, 0, -50], { ap: normal() });
    const away = enemy('them', [0, 0, -30], { yaw: 0 });
    const goals = open2(b, world([away], { objective: [0, 100] }), 6).filter((g) => g.mode === 'attack');
    expect(goals.length).toBeGreaterThan(0);
    for (const g of goals) expect(g.goal).toEqual([0, 100]);
  });

  it('opens a leg with a roll the way its stick points when the leg’s draw says so, once a leg', () => {
    const rolled = (dodgeRoll) => {
      const b = bot([0, 0, -50], { ap: { ...normal(), dodgeRoll } });
      const rolls = [];
      const w = world([enemy('them', [0, 0, -30])], { roll: (s, dir) => rolls.push(dir) });
      run(b, w, 1.2);
      return rolls;
    };
    const yes = rolled(1);
    expect(yes).toHaveLength(1);
    expect(Math.abs(yes[0][0])).toBeGreaterThan(0.5);
    expect(Math.hypot(yes[0][0], yes[0][1])).toBeCloseTo(1, 6);
    expect(rolled(0)).toHaveLength(0);
  });

  it('turns back from ground it cannot stand on', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      // (at the grid's edge: the ground to the +x side, the check's 2.5 m off, is outside it)
      const b = bot([598.5, 0, -50], { ap: normal(), rand: seeded(seed) });
      const w = world([enemy('them', [598.5, 0, -30])]);
      think(b, w, 0);
      const i = think(b, w, THINK);
      expect(i.mode).toBe('attack');
      expect(i.goal[0]).toBeLessThan(598.5);
    }
  });
});

describe('an Instant Action round’s bots', () => {
  it('each side’s brains carry its row: the Enemies’ facing the player, the Friendlies’ beside them', () => {
    const { sim, round } = startInstantAction({ rulebook: rb, gs, nav: hothFlatNav(rb), seed: 2, mode: 'galacticAssault', difficulty: 'rookie', bots: { friendly: 2, enemy: 2 } });
    const of = (team) => [...sim.entities.values()].filter((e) => e.bot && e.team === team).map((e) => e.brain.ap);
    expect(of(round.team).every((ap) => ap === round.ap[round.team])).toBe(true);
    expect(of(3 - round.team).every((ap) => ap === round.ap[3 - round.team])).toBe(true);
    expect(round.ap[3 - round.team].sources.sideScale).toBe('AP_AimNoiseScale_Enemies_Rookie_Mode8');
    expect(roundFor(gs, {}).ap[1]).not.toBe(round.ap[1]);
  });
});
