// The ground's soldiers on the game's brain: the one adapter between the
// galaxy's ground war and the Battlefront world's bot (src/lib/battlefront/
// ai/soldierBrain.js), which picks its target by the game's scores, its
// tactic by its template's tactics table, its cover by the tactics' own
// queries, fires in the game's patterns and aims inside the AI weapon's box,
// slowed and settled by the difficulty. A ground soldier (troops.js's) gets
// a body in the sim's own shape for the brain to move (soldier.js's), and
// each step the `world` the brain expects, made from the ground's own:
//
// - nav: a navgrid at 2 m (nav.js's own builder and shapes) over a window
//   round you, from the world's ground (its heights) and its solids (the
//   walker's circles and boxes, as boxes), the cells the walker can't stand
//   in (under water) shut; built again once you have gone far enough that a
//   soldier stepped near you could walk off its edge;
// - lineClear from the ground's seesThrough, shields from nav.js;
// - squad from the fight's squads (their middle, leader and posture);
// - objective and task from the soldier's errand: the post it holds, the
//   beat it walks, the post a raid is sent at, you when it hunts you
//   (director.js keeps these as its home, beat and leash);
// - enemies, others and who by the war's sides (the fight's bodies);
// - shoot into the ground's bolts (fight.js hands the shot on), at the gun's
//   own rate of fire.
// What the brain lacks and the ground adds stays in fight.js, round it.
// Pure: the brain's module comes in as `lib` (brainLib.js); tested with a
// fixture world (brain.test.js).
//
//   NAV { cell, half, again, radius }
//   navSolids(solids, heightAt) → nav.js's boxes for the walker's solids
//   createNavWindow({ lib, heightAt, standable, solids, cover })
//     → { nav, builds, ms, update(x, z) → true when it was built again }
//   familyOf(troop) → the brain's weapon family for a soldier's gun
//   taskOf(s) → { at, spot, radius, reach }: its errand, as a commander's task
//   createMinds({ lib, ai, difficulty, nav: () => nav, seesThrough })
//     → { ai, difficulty, name, taken, stats, setDifficulty(name),
//         ready(), mindOf(s, rand), frame({ bodies, soldiers, war, t }), worldFor(s, { posture, squads }),
//         sync(s), think(s, world, now), act(s, intent, world, dt, now) → the shot's aim or null,
//         suppressionOf(id) }

import { BOLT_SPEED } from '../../../../lib/combat/bolt';
import { weaponOf } from '../weaponRules';
import { relation, standingOf } from './standing';
import { GAME_GUNS, TROOPS } from './troops';

// The window's numbers, by hand (NOTES.md): the navgrid's cell is the
// Battlefront world's (2 m); it reaches `half` round where it was built,
// the brains' reach (groundScene.js's BRAINS, 120 m) and `again` more, and
// is built again once you are `again` from where it was, so a soldier being
// stepped never stands off it; a soldier's radius is the scene's (0.4 m,
// the one it is pushed out of solids by).
export const NAV = { cell: 2, half: 180, again: 60, radius: 0.4 };
// A solid with no top stands this far over the ground for the navgrid (a
// line over it is stopped by the ground's own seesThrough, not by this), by hand.
const TALL = 20;

const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const troopOf = (s) => TROOPS[s.kind] ?? TROOPS.stormtrooper;

export function navSolids(solids, heightAt) {
  const out = [];
  for (const s of solids ?? []) {
    if (s.off) continue;
    const g = heightAt(s.x, s.z);
    const bottom = s.base ?? g - 1;
    const top = s.top ?? g + TALL;
    if (top <= bottom) continue;
    const half = s.type === 'circle' ? [s.r, (top - bottom) / 2, s.r] : [s.hw, (top - bottom) / 2, s.hd];
    out.push({ at: [s.x, (top + bottom) / 2, s.z], half, yaw: s.type === 'circle' ? 0 : Math.atan2(s.s, s.c) });
  }
  return out;
}

export function createNavWindow({ lib, heightAt, standable = null, solids = null, cover = {}, half = NAV.half, cell = NAV.cell, again = NAV.again }) {
  const w = {
    nav: null,
    centre: null,
    builds: 0,
    ms: 0,
    update(x, z) {
      if (w.nav && Math.hypot(x - w.centre[0], z - w.centre[1]) < again) return false;
      const t0 = clock();
      const near = solids?.near ? [...solids.near(x, z, half)] : (solids ?? []);
      const nav = lib.buildNav({ heightAt, bounds: { min: [x - half, z - half], max: [x + half, z + half] }, cell, solids: navSolids(near, heightAt), cover, radius: NAV.radius });
      // (the walker's ground: a cell it can't stand in, the sea's, is no way)
      if (standable)
        for (let r = 0; r < nav.rows; r++)
          for (let c = 0; c < nav.cols; c++) {
            const i = r * nav.cols + c;
            if (nav.walk[i] && !standable([nav.origin[0] + (c + 0.5) * cell, nav.origin[1] + (r + 0.5) * cell])) nav.walk[i] = 0;
          }
      w.nav = nav;
      w.centre = [x, z];
      w.builds += 1;
      w.ms = clock() - t0;
      return true;
    },
  };
  return w;
}

// the brain's weapon family (its AI weapon row and its firing patterns) for a soldier's gun: the game's own where it has one
const FAMILY = { blaster: 'pistol', westar: 'pistol', dlt19: 'heavy', sniper: 'sniper' };
export const familyOf = (t) => GAME_GUNS[t.game?.gun]?.family ?? FAMILY[t.weapon] ?? 'rifle';

// seconds between a soldier's shots: its game gun's rate of fire, else the galaxy gun's
const everyOf = (t) => (GAME_GUNS[t.game?.gun] ? 60 / GAME_GUNS[t.game.gun].rof : weaponOf(t.weapon).every);

// (its radius is the soldier's reach, its leash and its gun's range, as the
// fight's leash has it: inside, the brain fights where it likes; outside, it
// makes for the place, firing on the way, as a commander's task has it)
export const taskOf = (s) => ({ at: s.home, spot: s.home, radius: (s.leash ?? 30) + troopOf(s).range, reach: 3 });

export function createMinds({ lib, ai, difficulty = 'normal', nav = () => null, seesThrough = null }) {
  const taken = new Map();
  const stats = { think: 0, act: 0, thinks: 0, acts: 0 };
  let byId = new Map();
  let bodies = [];
  let war = null;
  let others = [];
  const enemyLists = new Map();
  const humans = new Map();
  const step = lib.STEP;
  const minds = {
    ai,
    name: difficulty,
    difficulty: lib.difficultyFor(difficulty, ai),
    taken,
    stats,
    at: null, // (the clock of the frame gathered last: fight.js gathers a frame once a step)
    // (the navgrid is in: before it, nobody can be walked by the brain)
    ready: () => Boolean(nav()),
    setDifficulty(name) {
      minds.name = name;
      minds.difficulty = lib.difficultyFor(name, ai);
      for (const s of byId.values()) if (s.bot) s.bot.brain.difficulty = minds.difficulty;
    },
    // a soldier's mind: its brain on its template and tactics, and its body in the sim's shape
    mindOf(s, rand = Math.random) {
      if (s.bot) return s.bot;
      const t = troopOf(s);
      const cls = t.game?.cls ? lib.classOf(t.game.cls) : { cls: 'assault', health: t.hp };
      const body = lib.newSoldier(cls, { id: s.id, team: s.side, at: [s.b.x, 0, s.b.z], yaw: s.b.yaw, rand, bot: true, abilities: [] });
      body.weapon = { id: t.game?.gun ?? t.weapon, family: familyOf(t), range: t.range, firing: { speed: BOLT_SPEED } };
      const brain = lib.createBrain(body, { ai, role: t.template, rand, difficulty: minds.difficulty });
      // (one set of senses and beliefs: the brain's, which the fight senses with and a grudge writes to)
      if (s.me) brain.me = s.me;
      else s.me = brain.me;
      s.senses = brain.senses;
      s.bot = { brain, body, thinkAt: -Infinity, acc: 0, shotAt: -Infinity, every: everyOf(t), shot: null };
      byId.set(s.id, s);
      return s.bot;
    },
    // what every soldier's world reads this frame, gathered once
    // (soldiers: everyone who may have a mind, the population's; none, those it made minds for)
    frame({ bodies: list = [], soldiers = null, war: w = null, t = null } = {}) {
      bodies = list;
      war = w;
      minds.at = t;
      if (soldiers) {
        byId = new Map();
        for (const s of soldiers.values?.() ?? soldiers) byId.set(s.id, s);
      }
      enemyLists.clear();
      humans.clear();
      others = [];
      for (const s of byId.values()) if (s.alive && s.bot) others.push(s.bot.body);
      for (const [slot, id] of taken) if (!byId.get(id)?.alive) taken.delete(slot);
    },
    // the brain's own soldier brought up to the ground's: where it stands, its health, its nerves
    sync(s) {
      const m = s.bot;
      const n = nav();
      const b = m.body;
      b.at[0] = s.b.x;
      b.at[2] = s.b.z;
      b.at[1] = n ? lib.heightAt(n, s.b.x, s.b.z) : 0;
      b.yaw = s.b.yaw;
      b.hp = s.hp;
      b.hpMax = s.hpMax;
      b.alive = s.alive;
      b.suppressed = s.suppression ?? 0;
    },
    who,
    worldFor(s, { posture = 'hold', squads = null } = {}) {
      const q = squads?.of?.(s.id) ?? null;
      const leader = q?.members?.[0] ?? s.id;
      const lead = leader !== s.id ? byId.get(leader) : null;
      const task = taskOf(s);
      return {
        nav: nav(),
        lineClear: (a, b) => !seesThrough || seesThrough({ x: a[0], z: a[2] }, { x: b[0], z: b[2] }),
        shields: lib.shields,
        squad: { centre: q ? [q.centre.x, q.centre.z] : null, leader, posture },
        leaderAt: lead?.alive ? [lead.b.x, lead.b.z] : null,
        objective: task.at,
        task,
        enemies: enemiesOf(s.side),
        others,
        taken,
        // (its gun's rate holds the trigger the patterns press: fight.js fires what it lets through)
        shoot: (body, aim) => {
          const m = s.bot;
          if (m.now - m.shotAt < m.every - 1e-9) return false;
          m.shotAt = m.now;
          m.shot = aim;
          return true;
        },
        roll: () => false,
        who,
      };
    },
    think(s, world, now) {
      const m = s.bot;
      const was = m.brain.cover;
      const t0 = clock();
      lib.think(m.brain, world, now);
      stats.think += clock() - t0;
      stats.thinks += 1;
      if (was && was !== m.brain.cover && taken.get(was) === s.id) taken.delete(was);
      if (m.brain.cover) taken.set(m.brain.cover, s.id);
      m.thinkAt = now + lib.THINK;
      return m.brain.intent;
    },
    // a step of the brain's body: it walks every frame; its trigger is pressed
    // a sim frame at a time (the patterns' bits are the sim's frames, STEP s),
    // and between them the pattern is left where it was
    act(s, intent, world, dt, now) {
      const m = s.bot;
      m.now = now;
      m.acc += dt;
      const pressed = m.acc >= step - 1e-9;
      if (pressed) m.acc = Math.min(m.acc - step, step);
      const keep = pressed ? null : [m.brain.pattern, m.brain.frame];
      m.shot = null;
      const t0 = clock();
      lib.act(m.brain, pressed ? intent : { ...intent, fire: false }, m.body, dt, world, now);
      stats.act += clock() - t0;
      stats.acts += 1;
      if (keep) [m.brain.pattern, m.brain.frame] = keep;
      return m.shot;
    },
    // the suppression a near miss of this one's gives (its tactics'), you and your mate the player's (the Rebel soldier's tactics: bots.js)
    suppressionOf(id) {
      const s = byId.get(id);
      return (s?.bot?.brain.tactics ?? ai.tactics.AIRebelSoldierTactics)?.suppression?.value ?? 0;
    },
    drop(id) {
      for (const [slot, who] of taken) if (who === id) taken.delete(slot);
    },
  };

  // who an id is, as the brain's targeting asks: a soldier's body, or you and your mate as a human player is
  function who(id) {
    const s = byId.get(id);
    if (s) return s.bot?.body ?? null;
    if (humans.has(id)) return humans.get(id);
    const b = bodies.find((o) => o.id === id && o.you);
    const h = b ? { id, bot: false, alive: true, hp: 1, hpMax: 1, at: [b.x, b.y ?? 0, b.z], vel: Array.isArray(b.vel) ? [b.vel[0], 0, b.vel[1]] : [0, 0, 0] } : null;
    humans.set(id, h);
    return h;
  }

  // where a side's enemies stand, for the cover queries (the bodies by the war's sides; you by your oath)
  function enemiesOf(side) {
    if (enemyLists.has(side)) return enemyLists.get(side);
    const out = [];
    for (const b of bodies) {
      const foe = b.you ? standingOf(side, { side: b.side, war }) === 'enemy' : b.side && relation(side, b.side, war) === 'enemy';
      if (foe) out.push([b.x, b.z]);
    }
    enemyLists.set(side, out);
    return out;
  }

  return minds;
}
