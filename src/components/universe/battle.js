// A battle at the front: Battlefront 2's Fleet Assault, as plain rules.
// Pure (no three.js), so it's tested in Node; battleScene.js draws it and
// front.js runs it on the map. The design:
// docs/superpowers/specs/2026-10-06-fleet-war-design.md.
//
// Two fleets face each other across the front, the attacker's line on one
// side of the middle and the defender's on the other, along `axis`. Each
// side has its capital ships (wars.js: a flagship and its escorts) and its
// fighters, as many as the device can draw a side (perSide), brought back
// from the side's tickets when they're shot down.
//
// - The fighters (battleAi.js flies them): a fighter dogfights the nearest
//   of the other side's, an interceptor goes after bombers first, a bomber
//   flies torpedo runs at the defender's objectives or, for the defender,
//   at the attacker's ships.
// - The capital ships (battleCapitals.js lays them out and fights them):
//   every battery fires turbolasers at the other side's capital ships, and
//   point-defence at fighters (you too) that come close.
// - The objectives: the defender's flagship has two shield generators
//   (phase 1: its shield holds everything else off), then its bridge
//   (phase 2), then its reactor (phase 3). When the reactor goes, the
//   flagship breaks up and the attacker has won. Your shots on them count
//   `youShare` times, the AI's `aiShare`: a battle left to itself still
//   moves, slowly, and you're what decides it.
// - The end: the attacker wins when the defender's flagship goes; the
//   defender wins when the attacker's flagship goes, when the attacker's out
//   of tickets and fighters, or when the clock runs out.
//
// This file keeps the wiring, the bolts, what they and your shots hit, the
// clock, what your guns lock on to and the end; battleKit.js has the
// numbers (BATTLE) and the vector bits all of them share.
//
// In the galaxy (galaxy/warfront.js) a battle is sized to its ships (`lines`,
// `radius`), kept off its planet and out of a Death Star's shield (`avoid`:
// spheres its fighters steer clear of), on the clock every pilot shares
// (`clock` its length, `elapsed` how far in it is already), with the damage
// other pilots did to its objectives counted (`shared(id)` → theirs) and
// yours told (`onMine(id, damage)`), and no side that can run out of
// tickets (`tickets: false`: the fighters keep coming, the count's only a
// count, and it's fought to its clock or its objectives).
//
// The galaxy's set pieces (galaxy/warpieces/) reach in: an ion cannon
// disables a capital ship a while (disable: its guns quiet, hits on it count
// more), its batteries are targets of their own (a run down its hull shoots
// them out), a capital ship can be moved and turned (a Hammerhead's ram:
// moveCapital, turnCapital), and runners fly for the jump through the battle
// (addRunner, battleRunners.js: gone after by the other side, and by you).
//
// The galaxy's kinds of battle (galaxy/battles.js) ask for three more: the
// defender's objectives on an Interdictor among its escorts instead of its
// flagship (`objectivesOn: 'interdictor'`: its fall wins the battle, the
// flagship keeps its hull), an ace on either side (`ace: { [team]: { kind,
// name, hp } }`: one fighter flown as that kind, named on its bracket, gone
// for good once down), and runners that decide the battle (`runners`: an
// evacuation's or a blockade's, launched through it, `need` of them out
// winning it for their side, all of them down losing it).
//
// And in the galaxy, the battle every pilot there shares: with a `plan`
// (battlePlan.js: its objectives stage by stage) and a `director`
// (battleDirector.js's state, now), the battle doesn't decide itself. Its
// objectives' hp and stage, its shield and its end are the director's
// (battleStages.js takes them in); your shots on an objective count a punch
// each and are told (onMine); the AI's fire on an objective only lights it
// up, and on a capital ship's hull wears it down but never sinks it; and it
// ends only when it's told to (end).
//
// And a space level's own battle (galaxy/surface/missions/starfighter.js,
// Starfighter Assault): its capital ships where the level has them, not in
// lines (`layout`: by team, each ship's { at, fwd }, battleCapitals.js's
// placeCapitals), its plan's objectives at the level's own points
// (battleStages.js's `on.point`).
//
// createBattle({ war, attacker, at, axis, perSide, rand, lines, radius,
//   avoid, clock, elapsed, shared, onMine, tickets, objectivesOn, ace,
//   runners, plan, director, layout }) → battle (with
//   runners, disable(id, s), wreck(id), moveCapital(cap, d), turnCapital(cap, axis, a),
//   addRunner({ team, kind, size, hp, from, to, speed })):
//   { teams, capitals, fighters, bolts, phase, clock, over, you, defender, lines, radius, length,
//   attacker, ahead, stageOpen, opensIn, setYou(team | null), update(dt, you) → events, hit(from, to,
//   damage) → hit | null, strike(id, damage) → hit | null (a ram on a fighter), fire(team, from, dir, kind, target), targets,
//   info, end(winner, why, ago), setDifficulty(d), tactics, fleet }
// `you`: { x, y, z, alive } (the ship, as the scene has it), or null.
// update(dt) steps the battle BATTLE.step at a time, whatever the frame
// rate, so the same seed fights the same battle on any screen; `ahead` is
// how far the frame's past the last step, and each fighter's and runner's
// `seen` is where it is by then (drawn there, locked on to there).
// Events: { type: 'down', team, kind, role, at, mine, ace? }, { type: 'hurt', damage,
// kind }, { type: 'sub', sub, kind, phase, at, mine }, { type: 'phase',
// phase }, { type: 'shield', down: true }, { type: 'capital', id, kind,
// team, at }, { type: 'arrive', team, kind, at }, { type: 'impact', at,
// size, shield }, { type: 'over', winner, why }, { type: 'turret', id, cap,
// at, mine }, { type: 'disabled', id, at, size }, { type: 'escaped', id,
// team, kind, at }, { type: 'runner', id, team, kind, at, mine? } (one shot down),
// { type: 'jumped', id, kind, team, at, size, late? } (a capital ship gone to
// hyperspace, battleFleet.js: not destroyed).

import { sweptHit } from './targeting';
import { NAMES } from './wars';
import { BATTLE, UP, ZERO, copy, cross, dist2, len, norm, set, turnToward, v3 } from './battleKit';
import { flyFighter, muster, spawn } from './battleAi';
import { ageCapitals, fireBatteries, holdCapitals, hullHit, layCapitals, placeCapitals } from './battleCapitals';
import { createRunners } from './battleRunners';
import { createStages } from './battleStages';
import { createTactics } from './battleTactics';
import { createFleet } from './battleFleet';
import { homeFor } from './battleHome';
import { pressureOf } from './battleDifficulty';

export { BATTLE, WIDTH, inSights, perSide, turnToward } from './battleKit';

export function createBattle({ war, attacker = 0, at = [0, 0, 0], axis = [1, 0], perSide: n = 20, rand = Math.random, lines = BATTLE.lines, radius = BATTLE.radius, avoid = [], clock = BATTLE.clock, elapsed = 0, shared = null, onMine = null, tickets = true, objectivesOn = 'flagship', ace = {}, runners = null, plan = null, director = null, planet = null, tactics = false, layout = null }) {
  const defender = 1 - attacker;
  const C = v3(...at);
  const A = norm(v3(axis[0], 0, axis[1])); // from the first side's line to the second's
  const S = cross(UP, A); // across the lines
  const between = ([a, b]) => a + rand() * (b - a);
  let nextId = 2e6; // (numbered apart from the hunters' and the skirmish's: the lock follows a number)
  const events = [];
  const pending = []; // what your shots did, told on the next update

  const b = {
    teams: war.sides.map((side) => ({ side, tickets: BATTLE.tickets })),
    capitals: [],
    fighters: [],
    bolts: Array.from({ length: 320 }, () => ({ on: false, team: 0, kind: 'laser', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, damage: 0, target: null })),
    phase: 1,
    clock: elapsed,
    length: clock,
    lines,
    radius,
    over: null,
    attacker,
    defender,
    you: { pos: v3(), prev: v3(), vel: v3(), alive: false, team: null, on: 0 },
    runners: [],
    stageOpen: true, // (with a director: whether the stage's open yet, and if not, how long till it is)
    opensIn: 0,
  };

  // ── the battle's inner context, for its parts (battleAi, battleCapitals, battleRunners) ──
  const flagOf = (team) => b.capitals.find((c) => c.team === team && c.role === 'flagship');
  const objOf = () => b.capitals.find((c) => c.objective);
  const youIn = () => b.you.alive && b.you.team !== null && dist2(b.you.pos, C) < (radius * 1.4) ** 2;
  const finish = (winner, why, out) => {
    if (b.over) return;
    b.over = { winner, why };
    b.since = 0; // (seconds since it ended: the losing fleet jumps out on it, battleFleet.js)
    out.push({ type: 'over', winner, why });
  };
  const subDown = (s, mine) => {
    s.alive = false;
    return { type: 'sub', sub: s.id, kind: s.kind, phase: s.phase, at: copy(v3(), s.pos), mine };
  };
  // (with the galaxy's director it's the director that decides the battle:
  // the battle never ends itself, and the AI's fire sinks no capital ship)
  const decides = !(plan && director);
  const k = { b, rand, between, C, A, S, lines, radius, avoid, planet, attacker, defender, pending, newId: () => nextId++, flagOf, objOf, youIn, finish, decides, onMine, subDown };
  // (the galaxy's fighters flown with tactics, in flights: battleTactics.js, battleFlights.js)
  k.spawn = (f, first) => spawn(k, f, first);
  k.tactics = tactics ? createTactics(k) : null;
  b.tactics = k.tactics;

  // the capital ships in their lines (fought as fleets, with tactics: battleFleet.js), the fighters up, the runners ready
  layCapitals(k, objectivesOn);
  if (layout) placeCapitals(k, layout);
  k.fleet = tactics ? createFleet(k, typeof tactics === 'object' ? tactics : {}) : null;
  b.fleet = k.fleet;
  muster(k, n, ace);
  k.tactics?.form();
  holdCapitals(k);
  const stages = decides ? null : createStages(k, plan, director);
  if (stages) b.isOpen = stages.open; // (whether a plan's objective is open to be taken now: warfront.js's zones)
  const runs = createRunners(k, runners, stages && plan.runners ? { plan: plan.runners, state: director.state } : null);

  // ── the bolts ──
  let cursor = 0;
  b.fire = (team, from, dir, kind, target = null) => {
    const spec = BATTLE.bolts[kind];
    let o = null;
    for (let i = 0; i < b.bolts.length && !o; i++) {
      const c = b.bolts[(cursor + i) % b.bolts.length];
      if (!c.on) o = c;
    }
    if (!o) return null; // (all in flight: this one's lost in the din)
    cursor = (b.bolts.indexOf(o) + 1) % b.bolts.length;
    const l = len(dir) || 1;
    o.on = true;
    o.team = team;
    o.kind = kind;
    o.x = from.x;
    o.y = from.y;
    o.z = from.z;
    o.vx = (dir.x / l) * spec.speed;
    o.vy = (dir.y / l) * spec.speed;
    o.vz = (dir.z / l) * spec.speed;
    o.life = spec.life;
    o.damage = spec.damage;
    o.target = target;
    return o;
  };

  // ── what's hit ──
  const kill = (f, mine) => {
    f.alive = false;
    const t = b.teams[f.team];
    if (f.ace || f.wave) f.respawn = Infinity; // (an ace down is gone for the battle, and a wave's bombers have one life each)
    else if (t.tickets > 0 || !tickets) {
      // (without tickets the count's only a count: it stops at nothing, and the fighters keep coming)
      t.tickets = Math.max(0, t.tickets - 1);
      // (with tactics it waits for its side's next wave: battleFlights.js)
      if (k.tactics) {
        f.respawn = Infinity;
        f.waiting = true;
      } else f.respawn = between(BATTLE.respawn);
    } else f.respawn = Infinity;
    if (b.you.on && f.target === b.you) b.you.on -= 1;
    k.tactics?.drop(f);
    return { type: 'down', team: f.team, kind: f.kind, role: f.role, at: copy(v3(), f.pos), mine, ...(f.ace ? { ace: true } : {}), ...(f.wave ? { wave: f.wave } : {}) };
  };
  const shielded = (cap) => cap.objective && (stages ? b.shieldUp : b.phase === 1);

  // the first of the other side's capital ships (its objectives, then its
  // hull) a segment from p0 to p1 meets: { cap, sub, k, at } or null
  const capitalHit = (p0, p1, team) => {
    let best = null;
    for (const cap of b.capitals) {
      if (cap.team === team || !cap.alive) continue;
      if (dist2(cap.pos, p1) > (cap.reach + 30) ** 2 && dist2(cap.pos, p0) > (cap.reach + 30) ** 2) continue;
      for (const s of cap.subs) {
        if (!s.alive || s.hidden) continue;
        const k = sweptHit(p0, p1, s.pos, s.pos, s.r);
        if (k !== null && (!best || k < best.k)) best = { cap, sub: s, k };
      }
      for (const sp of cap.spheres) {
        const k = sweptHit(p0, p1, sp.c, sp.c, sp.r);
        if (k !== null && (!best || k < best.k)) best = { cap, sub: null, k };
      }
    }
    if (best) best.at = v3(p0.x + (p1.x - p0.x) * best.k, p0.y + (p1.y - p0.y) * best.k, p0.z + (p1.z - p0.z) * best.k);
    return best;
  };
  // a hit on an objective: only those of the phase, and only once the shield's down for the rest
  // (its hp: what it started with, less what's been dealt it here and what other pilots did: shared)
  const subHp = (s) => s.hpMax - s.dealt - (shared ? shared(s.id) : 0);
  const subHit = (s, dmg, mine, out) => {
    if (stages) return stages.hit(s, dmg, mine, out);
    if (s.phase !== b.phase) return false;
    if (s.cap.disabled > 0) dmg *= BATTLE.ionSubs;
    s.dealt += dmg;
    if (mine) onMine?.(s.id, dmg);
    s.hp = Math.max(0, subHp(s));
    if (s.hp <= 0) out.push(subDown(s, mine));
    return true;
  };
  // what other pilots have done, as it's heard of
  const sharedSubs = (out) => {
    if (!shared) return;
    for (const cap of b.capitals)
      for (const s of cap.subs) {
        if (!s.alive) continue;
        s.hp = Math.max(0, subHp(s));
        if (s.hp <= 0 && s.phase <= b.phase) out.push(subDown(s, false));
      }
  };

  // ── you ──
  // how hard the fight round you is (battleDifficulty.js: from your own
  // stats, galaxy/warfront.js's), which changes only what shoots at you
  k.pressure = null;
  b.difficulty = null;
  b.setDifficulty = (d) => {
    k.pressure = pressureOf(d);
    b.difficulty = k.pressure.d;
    k.tactics?.pressure();
  };
  // where a pilot of `team` comes back after a death (battleHome.js)
  b.homeFor = (team) => homeFor(k, team);
  b.setYou = (team) => {
    b.you.team = team === 0 || team === 1 ? team : null;
    for (const f of b.fighters) if (f.target === b.you) f.target = null;
    b.you.on = 0;
  };

  // ── the bolts in flight ──
  const p0 = v3();
  const p1 = v3();
  const tmp = v3();
  const way = v3();
  const moveBolts = (dt, out) => {
    const youOk = youIn() && !b.over && !b.ghost; // (a ghost, a ship power's: battlePowers.js sets it while it steps)
    for (const o of b.bolts) {
      if (!o.on) continue;
      o.life -= dt;
      if (o.life <= 0) {
        o.on = false;
        continue;
      }
      // a torpedo homes in a little on what it was fired at
      if (o.kind === 'torpedo' && o.target?.pos && (o.target.alive ?? true)) {
        const tp = o.target.pos;
        set(tmp, tp.x - o.x, tp.y - o.y, tp.z - o.z);
        norm(tmp);
        const sp = BATTLE.bolts.torpedo.speed;
        const nd = turnToward(norm(set(way, o.vx, o.vy, o.vz)), tmp, 1.2 * dt);
        o.vx = nd.x * sp;
        o.vy = nd.y * sp;
        o.vz = nd.z * sp;
      }
      set(p0, o.x, o.y, o.z);
      set(p1, o.x + o.vx * dt, o.y + o.vy * dt, o.z + o.vz * dt);
      const step = Math.sqrt(dist2(p0, p1));
      let done = false;
      // a fighter of the other side (not the capitals' turbolasers: they're after ships)
      if (o.kind !== 'turbo') {
        let hitF = null;
        let first = Infinity;
        for (const f of b.fighters) {
          if (!f.alive || f.team === o.team) continue;
          if (dist2(f.pos, p1) > (step + 3) ** 2) continue;
          const k = sweptHit(p0, p1, f.prev, f.pos, f.size * 0.6);
          if (k !== null && k < first) {
            first = k;
            hitF = f;
          }
        }
        if (hitF) {
          // (a planned ace's hull is the director's: the AI's fire only lights it up)
          if (!stages?.isAce(hitF)) {
            hitF.hp -= o.damage;
            if (hitF.hp <= 0) out.push(kill(hitF, false));
          }
          done = true;
        }
      }
      // a runner of the other side (the director's: lit up, its fate the director's)
      if (!done) {
        for (const r of b.runners) {
          if (!r.alive || r.team === o.team) continue;
          if (sweptHit(p0, p1, r.prev, r.pos, r.size * 0.5) === null) continue;
          done = true;
          if (r.shared) {
            r.hitBy += 1;
            if (o.kind !== 'laser' && o.kind !== 'flak') out.push({ type: 'impact', at: copy(v3(), r.pos), size: 0.5, shield: false });
            break;
          }
          r.hp -= o.damage;
          r.hitBy += 1;
          if (r.hp <= 0) {
            r.alive = false;
            out.push({ type: 'runner', id: r.id, team: r.team, kind: r.kind, at: copy(v3(), r.pos) });
          }
          break;
        }
      }
      // you
      if (!done && youOk && o.team !== b.you.team && sweptHit(p0, p1, b.you.prev, b.you.pos, 0.3) !== null) {
        out.push({ type: 'hurt', damage: BATTLE.youHurt[o.kind], kind: o.kind });
        done = true;
      }
      // a battery a fighter's strafing (one of the plan's only lights up: its hp's the director's)
      if (!done && o.target?.battery && o.target.alive && sweptHit(p0, p1, o.target.at, o.target.at, o.target.r + 0.4) !== null) {
        const tu = o.target;
        done = true;
        if (tu.planned) out.push({ type: 'impact', at: copy(v3(), tu.at), size: 0.5, shield: false });
        else {
          tu.hp -= o.damage;
          if (tu.hp <= 0) {
            tu.alive = false;
            out.push({ type: 'turret', id: tu.num, cap: tu.cap.id, at: copy(v3(), tu.at), mine: false });
          }
        }
      }
      // an objective the plan's laid out in the open (the AI's fire on it only lands)
      if (!done && stages && o.kind !== 'turbo') {
        const fo = stages.free(p0, p1);
        if (fo) {
          done = true;
          if (o.kind === 'torpedo') out.push({ type: 'impact', at: copy(v3(), fo.o.pos), size: 0.8, shield: false });
        }
      }
      // a capital ship of the other side: an objective, or its hull
      if (!done) {
        const h = capitalHit(p0, p1, o.team);
        if (h) {
          done = true;
          if (h.cap.objective) k.tactics?.struck(); // (its threat, for its defenders)
          if (h.sub && subHit(h.sub, o.damage * BATTLE.aiShare, false, out)) {
            // (counted on the objective)
          } else if (shielded(h.cap)) out.push({ type: 'impact', at: h.at, size: o.kind === 'turbo' ? 1.6 : 0.6, shield: true });
          else {
            hullHit(h.cap, o.damage * BATTLE.hullShare[o.kind], out, !decides);
            if (o.kind !== 'laser' && o.kind !== 'flak') out.push({ type: 'impact', at: h.at, size: o.kind === 'turbo' ? 1.4 : 1, shield: false });
          }
        }
      }
      if (done) o.on = false;
      else {
        o.x = p1.x;
        o.y = p1.y;
        o.z = p1.z;
      }
    }
  };

  // ── the phases ──
  const checkPhase = (out) => {
    const flag = objOf();
    if (!flag) return;
    // (other pilots may have taken more than one phase's down since the last frame)
    while (b.phase <= 3 && !flag.subs.some((s) => s.phase === b.phase && s.alive)) {
      b.phase += 1;
      if (b.phase === 2) out.push({ type: 'shield', down: true });
      if (b.phase <= 3) out.push({ type: 'phase', phase: b.phase });
      else if (flag.dying <= 0) flag.dying = BATTLE.dying;
    }
  };

  // ── the clock: a fixed step, whatever the frame rate ──
  // A turn's limit, a head-on pass's window and a burst's timing all play out
  // differently in big steps than in small ones, so a battle stepped by the
  // frame went one way on a 144 Hz screen and another on a phone. It moves on
  // BATTLE.step at a time instead, each frame's time owed carried over to the
  // next; what each step said is told together.
  let owed = 0; // seconds of frames not stepped yet (less than a step)
  let frame = 0; // the last frame's length (what a fighter's drawn doing over it, for your shots)
  const youFrom = v3();
  const youTo = v3();
  const lerp = (o, p, q, s) => set(o, p.x + (q.x - p.x) * s, p.y + (q.y - p.y) * s, p.z + (q.z - p.z) * s);
  b.ahead = 0; // (how far past the last step the frame is: the drawing carries everything on by it)
  b.update = (dt, you) => {
    const out = events;
    out.length = 0;
    out.push(...pending);
    pending.length = 0;
    frame = Math.min(Math.max(0, dt), BATTLE.step * BATTLE.steps);
    owed += Math.max(0, dt);
    const steps = Math.min(BATTLE.steps, Math.floor(owed / BATTLE.step + 1e-6));
    owed = Math.max(0, owed - steps * BATTLE.step);
    if (owed >= BATTLE.step) owed = 0; // (a long frame's rest: the battle slows, rather than leaping)
    // where you are, and how fast you're going (and at each step, that share of the way across the frame)
    if (you) {
      copy(youFrom, b.you.alive ? b.you.pos : you);
      set(youTo, you.x, you.y, you.z);
      const per = 1 / Math.max(dt, 1e-4);
      set(b.you.vel, (youTo.x - youFrom.x) * per, (youTo.y - youFrom.y) * per, (youTo.z - youFrom.z) * per);
      b.you.alive = you.alive !== false;
    } else b.you.alive = false;
    for (let i = 0; i < steps; i++) {
      if (you) {
        lerp(b.you.prev, youFrom, youTo, i / steps);
        lerp(b.you.pos, youFrom, youTo, (i + 1) / steps);
      }
      step(BATTLE.step, out);
    }
    if (you) copy(b.you.pos, youTo);
    // where each fighter and runner is drawn (and locked on to): on from its last step by the time owed
    b.ahead = owed;
    for (const f of b.fighters) if (f.alive) set(f.seen, f.pos.x + f.vel.x * owed, f.pos.y + f.vel.y * owed, f.pos.z + f.vel.z * owed);
    for (const r of b.runners) if (r.alive) set(r.seen, r.pos.x + r.vel.x * owed, r.pos.y + r.vel.y * owed, r.pos.z + r.vel.z * owed);
    return out;
  };

  // one step of the battle, `dt` long
  const step = (dt, out) => {
    if (!b.over) b.clock += dt;
    else b.since += dt;
    for (const f of b.fighters) {
      if (f.alive) flyFighter(k, f, dt);
      else if (!k.tactics && Number.isFinite(f.respawn) && !b.over) {
        f.respawn -= dt;
        if (f.respawn <= 0) {
          spawn(k, f, false);
          out.push({ type: 'arrive', team: f.team, kind: f.kind, at: copy(v3(), f.pos) });
        }
      }
    }
    // (the flights: the threat, their nerve, home and back, the waves)
    k.tactics?.step(dt, out);
    for (const cap of b.capitals) if (cap.disabled > 0) cap.disabled = Math.max(0, cap.disabled - dt);
    runs.launch(dt);
    const before = out.length;
    runs.fly(dt, out);
    runs.sync(out);
    runs.judge(out, before);
    k.fleet?.step(dt, out);
    if (!b.over) for (const cap of b.capitals) fireBatteries(k, cap, dt);
    moveBolts(dt, out);
    if (stages) stages.sync(out);
    else {
      if (!b.over) sharedSubs(out);
      checkPhase(out);
    }
    ageCapitals(k, dt, out);
    if (!b.over && decides) {
      const t = b.teams[attacker];
      if (tickets && t.tickets <= 0 && !b.fighters.some((f) => f.alive && f.team === attacker)) finish(defender, 'tickets', out);
      else if (b.clock >= clock) finish(defender, 'clock', out);
    }
  };

  // your shot, from `from` to `to` this frame: the first of the other side's
  // fighters, objectives or hulls it meets (a fighter or a runner where it's
  // drawn, over the frame: back along its way from there by the frame's length)
  const back = v3();
  const drawnBack = (o) => set(back, o.seen.x - o.vel.x * frame, o.seen.y - o.vel.y * frame, o.seen.z - o.vel.z * frame);
  // one of the other side's fighters hit by you, worth `damage`
  const hitFighter = (f, damage) => {
    if (stages?.isAce(f)) return { id: f.id, kind: f.kind, at: copy(v3(), f.seen), size: f.size, down: stages.hitAce(f, damage, pending) };
    f.hp -= damage;
    const down = f.hp <= 0;
    if (down) pending.push(kill(f, true));
    return { id: f.id, kind: f.kind, at: copy(v3(), f.seen), size: f.size, down };
  };
  // the same for one you rammed (shipHits.js), by its id
  b.strike = (id, damage = 1) => {
    if (b.you.team === null || b.over) return null;
    const f = b.fighters.find((o) => o.id === id && o.alive && o.team !== b.you.team);
    return f ? hitFighter(f, damage) : null;
  };
  b.hit = (from, to, damage = 1) => {
    if (b.you.team === null || b.over) return null;
    let hitF = null;
    let first = Infinity;
    for (const f of b.fighters) {
      if (!f.alive || f.team === b.you.team) continue;
      const k = sweptHit(from, to, drawnBack(f), f.seen, Math.max(0.35, f.size * 0.9));
      if (k !== null && k < first) {
        first = k;
        hitF = f;
      }
    }
    // (or a runner of the other side's, nearer)
    let hitR = null;
    for (const r of b.runners) {
      if (!r.alive || r.team === b.you.team) continue;
      const k = sweptHit(from, to, drawnBack(r), r.seen, Math.max(0.5, r.size * 0.5));
      if (k !== null && k < first) {
        first = k;
        hitR = r;
        hitF = null;
      }
    }
    const h = capitalHit(from, to, b.you.team);
    // one of the plan's objectives out in the open (a satellite, a platform…), if it's the nearest
    const fo = stages?.free(from, to);
    let tu = null;
    let tk = Infinity;
    for (const cap of b.capitals) {
      if (cap.team === b.you.team || !cap.alive || cap.dying > 0) continue;
      if (dist2(cap.pos, to) > (cap.reach + 10) ** 2) continue;
      for (const t of cap.turrets) {
        if (!t.alive) continue;
        const k = sweptHit(from, to, t.at, t.at, t.r);
        if (k !== null && k < tk) {
          tk = k;
          tu = t;
        }
      }
    }
    if (fo && fo.k <= first && fo.k <= tk && (!h || fo.k <= h.k)) {
      const at = v3(from.x + (to.x - from.x) * fo.k, from.y + (to.y - from.y) * fo.k, from.z + (to.z - from.z) * fo.k);
      if (stages.hit(fo.o, damage, true, pending)) return { id: fo.o.num, kind: 'subsystem', sub: fo.o.key, at, size: fo.o.r, down: !fo.o.alive };
      pending.push({ type: 'impact', at, size: 0.6, shield: true });
      return { id: fo.o.num, kind: 'shield', at, size: 0.4, down: false, shield: true };
    }
    if (tu && tk <= first && (!h || tk <= h.k)) {
      // (one the plan has: its hp the director's, and only while its stage is open)
      if (tu.planned) {
        if (stages.hit(tu, damage, true, pending)) return { id: tu.num, kind: 'turret', sub: tu.key, at: copy(v3(), tu.at), size: tu.r, down: !tu.alive, turret: true };
        pending.push({ type: 'impact', at: copy(v3(), tu.at), size: 0.6, shield: true });
        return { id: tu.num, kind: 'shield', at: copy(v3(), tu.at), size: 0.4, down: false, shield: true };
      }
      tu.hp -= damage;
      const down = tu.hp <= 0;
      if (down) {
        tu.alive = false;
        pending.push({ type: 'turret', id: tu.num, cap: tu.cap.id, at: copy(v3(), tu.at), mine: true });
      }
      return { id: tu.num, kind: 'turret', at: copy(v3(), tu.at), size: tu.r, down, turret: true };
    }
    if (hitR && (!h || first <= h.k)) {
      hitR.hitBy += 1;
      if (hitR.shared) return { id: hitR.id, kind: hitR.kind, at: copy(v3(), hitR.seen), size: hitR.size, down: runs.hit(hitR, damage, pending) };
      hitR.hp -= damage;
      const down = hitR.hp <= 0;
      if (down) {
        hitR.alive = false;
        pending.push({ type: 'runner', id: hitR.id, team: hitR.team, kind: hitR.kind, at: copy(v3(), hitR.pos), mine: true });
      }
      return { id: hitR.id, kind: hitR.kind, at: copy(v3(), hitR.seen), size: hitR.size, down };
    }
    if (hitF && (!h || first <= h.k)) return hitFighter(hitF, damage);
    if (!h) return null;
    // (with a director a hit's a punch of the objective's hp: what it's worth is shared out by the director)
    if (h.sub && subHit(h.sub, damage * (stages ? 1 : BATTLE.youShare), true, pending)) return { id: h.sub.num, kind: 'subsystem', sub: h.sub.id, at: h.at, size: 1, down: !h.sub.alive };
    if (shielded(h.cap)) {
      pending.push({ type: 'impact', at: h.at, size: 0.6, shield: true });
      return { id: h.cap.id, kind: 'shield', at: h.at, size: 0.4, down: false, shield: true };
    }
    hullHit(h.cap, damage * BATTLE.youShare * BATTLE.youHull, pending);
    return { id: h.cap.id, kind: h.cap.kind, at: h.at, size: 0.4, down: false, capital: true };
  };

  // what your guns can lock on to: the other side's fighters, then the
  // objectives of the phase (when you're the attacker)
  const targets = [];
  const near = [];
  Object.defineProperty(b, 'targets', {
    get() {
      targets.length = 0;
      if (b.you.team === null || b.over) return targets;
      for (const f of b.fighters) {
        if (!f.alive || f.team === b.you.team) continue;
        f.tgt.hp = f.hp;
        f.tgt.threat = f.target === b.you ? 1 : 0;
        targets.push(f.tgt);
      }
      // the other side's runners, and the batteries near you (a run down a hull)
      for (const r of b.runners) if (r.alive && r.team !== b.you.team) targets.push(Object.assign(r.tgt, { hp: r.hp }));
      if (b.you.alive) {
        near.length = 0;
        for (const cap of b.capitals) {
          if (cap.team === b.you.team || !cap.alive || cap.dying > 0 || dist2(cap.pos, b.you.pos) > (cap.reach + BATTLE.turretsNear) ** 2) continue;
          for (const t of cap.turrets) {
            if (!t.alive || t.planned) continue; // (the plan's are among its objectives)
            const d = dist2(t.at, b.you.pos);
            if (d < BATTLE.turretsNear ** 2) near.push([d, t]);
          }
        }
        near.sort((p, q) => p[0] - q[0]);
        for (const [, t] of near.slice(0, 10)) {
          t.tgt ??= { id: t.num, at: t.at, vel: ZERO, size: t.r, kind: 'turret', name: NAMES.turret ?? 'Turbolaser battery', threat: 0, hp: 0, hpMax: BATTLE.turretHp };
          t.tgt.hp = t.hp;
          targets.push(t.tgt);
        }
      }
      if (b.you.team === attacker && stages) {
        // the plan's objectives open to be taken now, wherever they are (not a zone: that's held, not shot)
        for (const o of b.objectives) {
          if (!o.alive || o.zone || o.hidden || !stages.open(o)) continue;
          o.tgt ??= { id: o.num, at: o.pos, vel: ZERO, size: o.r, kind: 'subsystem', name: o.name, sub: o.key, threat: 0, hp: 0, hpMax: o.hpMax };
          o.tgt.hp = o.hp;
          targets.push(o.tgt);
        }
      } else if (b.you.team === attacker) {
        const flag = objOf();
        for (const s of flag?.subs ?? []) {
          if (!s.alive || s.hidden || s.phase !== b.phase || !b.stageOpen) continue;
          s.tgt ??= { id: s.num, at: s.pos, vel: ZERO, size: s.r, kind: 'subsystem', name: NAMES[s.kind], sub: s.id, threat: 0, hp: 0, hpMax: s.hpMax };
          s.tgt.hp = s.hp;
          targets.push(s.tgt);
        }
      }
      return targets;
    },
  });

  // for the HUD and for checking from a browser
  Object.defineProperty(b, 'info', {
    get() {
      const flag = objOf();
      const own = flagOf(attacker);
      return {
        phase: b.phase,
        clock: +b.clock.toFixed(1),
        left: Math.max(0, clock - b.clock),
        tickets: b.teams.map((t) => t.tickets),
        fighters: [0, 1].map((team) => b.fighters.filter((f) => f.alive && f.team === team).length),
        objectives: (stages ? b.objectives.map((o) => ({ id: o.key, kind: o.kind, phase: o.phase, hp: o.hp / o.hpMax })) : (flag?.subs ?? []).map((s) => ({ id: s.id, kind: s.kind, phase: s.phase, hp: s.hp / s.hpMax }))),
        hull: [own ? own.hull / own.hullMax : 0, flag ? (flag.alive ? 1 - (b.phase - 1) / 3 : 0) : 0],
        over: b.over,
      };
    },
  });

  // (`ago`: how long since it ended, for a pilot arriving after: the losing fleet gone already)
  b.end = (winner, why = 'forced', ago = 0) => {
    finish(winner, why, pending);
    if (ago > 0 && b.over?.winner === winner) b.since = Math.max(b.since, ago);
  };
  return b;
}
