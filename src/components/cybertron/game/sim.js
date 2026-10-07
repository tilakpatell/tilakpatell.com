// The world's state and its turn of events, put together from rules.js: the
// area you're in, Optimus, the Decepticons about, the shots in the air, the
// energon lying around, who you're talking to and the missions. GameWorld.jsx
// steps it every frame with the controls' input and scene.js draws it; it
// knows nothing of either.
//
//   createSim({ area, spawn, done, rand, seed }) → sim  (rand: the sim's own, else seed's 'sim' stream)
//   sim.step(input, dt) → events     (move, fight, pick up, count)
//   sim.use() → what happened        (talk, or go through a bridge)
//   sim.enter(areaId, spawnId)       (a bridge's other side)
//   sim.spawn(kind, x, z, { id }) → enemy  (a Decepticon there, as a mission's step brings them)
//   sim.trace                        what each Decepticon chose and why (lib/ai/trace)
//   sim.stats() → { agents, thought, ms, last, skipped, worst: null }  the Decepticons' cost a step
//     (ms smoothed, last this step's; they're timed together, not one by one, so no worst)
//   sim.actors                       Map id → actor, for the inspector

import { AREAS, MISSIONS, areaOf } from './areas';
import { createTokens } from '../../../lib/ai/squad';
import { createTrace } from '../../../lib/ai/trace';
import { streams } from '../../../lib/seeded';
import { SHOTS_AT_ONCE } from './tactics';
import { ENEMY_KINDS, MEND, available, buildWorld, damage, feedMission, fire, hurtEnemy, newEnemy, newMissions, newPlayer, startMission, stepEnemies, stepPickups, stepPlayer, stepShots, nearby } from './rules';


const ALL = { missions: MISSIONS }; // (feedMission looks a mission up here, wherever it's played)

// which model plays which enemy, by era
const MODEL = {
  foc: { trooper: ['trooper', 'sniper', 'leaper'], vehicon: ['trooper'], megatron: ['megatron-foc'], barricade: ['barricade'], shockwave: ['shockwave-foc'] },
  tfp: { trooper: ['vehicon'], vehicon: ['vehicon'], megatron: ['megatron-tfp'], barricade: ['vehicon'] },
};

const RESPAWN = 3; // seconds down before Optimus is back on his feet

// (the clock the cost is read by, where there is one; reading it never changes what happens)
const clock = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : 0);

export function createSim({ area: areaId = 'iacon', spawn = 'start', done = [], rand = null, seed = 1 } = {}) {
  // the rules are seeded (a visit's, or ?seed=): the same fight from the same start
  rand = rand ?? streams(seed).fork('sim');
  const missions = newMissions();
  const cost = { agents: 0, thought: 0, ms: 0, last: 0, skipped: 0 };
  missions.done.push(...done);
  const sim = {
    area: null,
    world: null,
    player: null,
    enemies: [],
    tokens: createTokens({ pools: { shot: SHOTS_AT_ONCE }, timeout: 1 }), // (so many Decepticons fire at once: lib/ai/squad)
    trace: createTrace({ size: 600 }),
    actors: new Map(),
    seed,
    shots: [],
    pickups: [],
    missions,
    talk: null, // { id, name, line } while someone is speaking
    near: null, // what E would do here
    exit: null, // a bridge stepped into: { to, at } until the page takes you through
    down: 0, // seconds left lying there after being shot down
    clock: 0,
    kills: 0,
    lines: {}, // which of each person's lines is next
  };

  const missionOf = (id) => MISSIONS.find((m) => m.id === id) ?? null;
  const currentStep = () => {
    const m = missionOf(missions.active);
    return m ? m.steps[missions.step] ?? null : null;
  };

  // A step's Decepticons, and its energon put back, as it starts (if it's
  // played here)
  const begin = (step) => {
    const m = missionOf(missions.active);
    if (!step || !m || (step.area ?? m.area) !== sim.area.id) return;
    if (step.reset) for (const k of sim.pickups) if (k.kind === step.reset) k.taken = false;
    for (const [i, e] of (step.spawn ?? []).entries()) sim.spawn(e.kind, e.x, e.z, { id: e.id ?? `${missions.active}-${missions.step}-${i}`, i });
  };

  // One Decepticon (of a kind) at (x, z), on the floor there, in this place's era's model
  sim.spawn = (kind, x, z, { id = `${kind}-${Math.round(x)}-${Math.round(z)}`, i = sim.enemies.length } = {}) => {
    const models = sim.area.foes?.[kind] ?? MODEL[sim.area.era]?.[kind] ?? [kind];
    const enemy = newEnemy(kind, x, z, { id, model: models[i % models.length] });
    enemy.y = sim.world.floorAt(x, z, 50, 60);
    sim.enemies.push(enemy);
    return enemy;
  };

  const feed = (event, out) => {
    const r = feedMission(missions, ALL, { ...event, area: sim.area.id });
    if (r.gate !== undefined) out.push({ type: 'gate', i: r.gate });
    if (r.failed) out.push({ type: 'failed' });
    if (r.completed) {
      const m = missionOf(r.completed);
      out.push({ type: 'complete', id: r.completed, title: m?.title, achievement: m?.achievement });
    } else if (r.advanced) {
      out.push({ type: 'step', step: r.step });
      begin(r.step);
    }
    return r;
  };

  sim.enter = (id, spawnId = 'start') => {
    const area = areaOf(id);
    sim.area = area;
    sim.world = buildWorld(area);
    const at = area.spawns?.[spawnId] ?? area.spawn;
    const keep = sim.player;
    sim.player = newPlayer(area, at);
    // (his health and energon come with him; down, he comes through mended,
    // as he would have got up, and the getting up that was coming is off)
    if (keep) Object.assign(sim.player, { hp: keep.dead ? sim.player.maxHp : keep.hp, energon: keep.energon, boost: keep.boost });
    sim.down = 0;
    sim.player.y = sim.world.floorAt(at.x, at.z, 50, 60);
    sim.enemies = [];
    sim.actors?.clear();
    sim.shots = [];
    sim.pickups = area.pickups.map((k) => ({ ...k, taken: false }));
    sim.talk = null;
    sim.exit = null;
    // a step already under way here: its Decepticons come back
    begin(currentStep());
  };

  sim.enter(areaId, spawn);

  const targets = () => sim.enemies.filter((e) => !e.dead);
  const playerTarget = () => ({ id: 'player', x: sim.player.x, y: sim.player.y, z: sim.player.z, r: sim.player.mode === 'vehicle' ? 2.6 : 1.4, h: sim.player.mode === 'vehicle' ? 4 : 9.5, dead: sim.player.dead });

  sim.step = (input, dt) => {
    const out = [];
    const p = sim.player;
    sim.clock += dt;
    if (p.dead) {
      sim.down -= dt;
      if (sim.down <= 0) {
        // back up where the area starts, mended
        const at = sim.area.spawn;
        Object.assign(p, newPlayer(sim.area, at), { energon: p.energon });
        p.y = sim.world.floorAt(at.x, at.z, 50, 60);
        out.push({ type: 'respawn' });
      }
    }
    for (const e of stepPlayer(p, input, dt, sim.world)) {
      out.push(e);
      if (e.type === 'transformed') feed(e, out);
    }
    // the guns
    if (input.fire && !p.dead) {
      const shots = fire(p, targets(), { yaw: input.aimYaw, pitch: input.aimPitch, from: input.muzzle });
      if (shots.length) {
        sim.shots.push(...shots);
        out.push({ type: 'fire', mode: p.mode, shots });
      }
    }
    // the Decepticons
    const t0 = clock();
    const foe = stepEnemies(sim.enemies, p, dt, sim.world, rand, sim.tokens, { trace: sim.trace });
    const ms = clock() - t0;
    // (smoothed over a second or so: one frame's garbage collection isn't the AI's cost)
    cost.last = ms;
    cost.ms += (ms - cost.ms) * 0.1;
    let standing = 0;
    for (const e of sim.enemies) {
      if (e.dead) sim.actors.delete(e.id);
      else {
        standing += 1;
        if (e.actor && sim.actors.get(e.id) !== e.actor) sim.actors.set(e.id, e.actor);
      }
    }
    cost.agents = standing;
    cost.thought = standing; // (every one, every step: there's no schedule here to defer any)
    sim.shots.push(...foe.shots);
    out.push(...foe.events);
    // shots: Optimus's at them, theirs at him
    const mine = sim.shots.filter((s) => s.from === 'player');
    const theirs = sim.shots.filter((s) => s.from !== 'player');
    for (const h of stepShots(mine, dt, sim.world, targets())) {
      out.push({ type: 'hit', x: h.shot.x, y: h.shot.y, z: h.shot.z, id: h.target.id });
      for (const e of hurtEnemy(h.target, h.shot.damage)) {
        out.push({ ...e, x: h.target.x, y: h.target.y, z: h.target.z, boss: h.target.boss });
        if (e.type === 'kill') {
          sim.kills += 1;
          feed(e, out);
        }
      }
    }
    const me = playerTarget();
    for (const h of stepShots(theirs, dt, sim.world, [me])) {
      out.push({ type: 'hitMe', x: h.shot.x, y: h.shot.y, z: h.shot.z });
      for (const e of damage(p, h.shot.damage)) {
        out.push(e);
        if (e.type === 'dead') sim.down = RESPAWN;
      }
    }
    sim.shots = [...mine, ...theirs];
    // the dead fall and go after a while
    for (const e of sim.enemies) if (e.dead) e.gone = (e.gone ?? 0) + dt;
    sim.enemies = sim.enemies.filter((e) => !e.dead || e.gone < 6);
    if (sim.actors.size > standing) for (const id of sim.actors.keys()) if (!sim.enemies.some((e) => e.id === id && !e.dead)) sim.actors.delete(id);
    // energon (and a relic, while its mission is on)
    const live = sim.pickups.filter((k) => !k.mission || k.mission === missions.active);
    for (const id of stepPickups(live, p)) {
      const k = sim.pickups.find((x) => x.id === id);
      if (k.kind === 'energon' || k.kind === 'crystal') {
        p.energon += 1;
        p.hp = Math.min(p.maxHp, p.hp + MEND.energon);
      }
      out.push({ type: 'pickup', id, kind: k.kind, x: k.x, y: k.y ?? 0, z: k.z });
      feed({ type: 'pickup', kind: k.kind, id }, out);
    }
    // where he is, for the steps that are about getting somewhere
    feed({ type: 'move', x: p.x, z: p.z }, out);
    feed({ type: 'tick', dt }, out);
    // what E does here; a bridge driven into goes at once
    sim.near = nearby(p, sim.area);
    if (sim.near?.type === 'exit' && p.mode === 'vehicle' && !sim.exit) {
      const x = sim.area.exits.find((e) => e.id === sim.near.id);
      sim.exit = { to: x.to, at: x.at };
      out.push({ type: 'exit', to: x.to });
      feed({ type: 'exit', to: x.to }, out);
    }
    // a speaker stops talking once you walk away
    if (sim.talk) {
      const who = sim.area.people.find((q) => q.id === sim.talk.id);
      if (!who || Math.hypot(who.x - p.x, who.z - p.z) > 26) sim.talk = null;
    }
    return out;
  };

  sim.use = () => {
    const out = [];
    const n = nearby(sim.player, sim.area);
    if (!n || n.type === 'shift') return out;
    if (n.type === 'exit') {
      const x = sim.area.exits.find((e) => e.id === n.id);
      sim.exit = { to: x.to, at: x.at };
      out.push({ type: 'exit', to: x.to });
      feed({ type: 'exit', to: x.to }, out);
      return out;
    }
    const person = sim.area.people.find((q) => q.id === n.id);
    // a mission this person has for you, if you're free to take it
    let said = null;
    if (!missions.active) {
      const offer = available({ missions: MISSIONS.filter((m) => m.giver === person.id && m.from === sim.area.id) }, missions)[0];
      if (offer) {
        startMission(missions, offer);
        out.push({ type: 'start', id: offer.id, title: offer.title });
        said = offer.say ?? person.lines[0];
        begin(offer.steps[0]);
      }
    }
    const r = feed({ type: 'talk', id: person.id }, out);
    if (!said) {
      const k = sim.lines[person.id] ?? 0;
      said = person.lines[k % person.lines.length];
      sim.lines[person.id] = k + 1;
    }
    sim.talk = { id: person.id, name: person.name, line: said };
    out.push({ type: 'talk', id: person.id, advanced: r.advanced });
    return out;
  };

  sim.stats = () => ({ agents: cost.agents, thought: cost.thought, ms: cost.ms, last: cost.last, skipped: cost.skipped, worst: null });

  // What the HUD shows
  sim.hud = () => {
    const m = missionOf(missions.active);
    const step = m ? m.steps[missions.step] : null;
    let target = null;
    if (step) {
      const here = (step.area ?? m.area) === sim.area.id;
      if (!here) {
        // the way back to where it's played: the nearest bridge there
        const x = sim.area.exits.find((e) => e.to === (step.area ?? m.area)) ?? sim.area.exits[0];
        target = x ? { x: x.x, z: x.z, label: x.label } : null;
      } else if (step.type === 'talk') {
        const who = sim.area.people.find((q) => q.id === step.target);
        target = who ? { x: who.x, z: who.z, label: who.name } : null;
      } else if (step.type === 'reach') target = { ...step.at, label: step.text };
      else if (step.type === 'drive') target = step.gates[missions.count] ? { ...step.gates[missions.count], label: `Beacon ${missions.count + 1} of ${step.gates.length}` } : null;
      else if (step.type === 'exit') {
        const x = sim.area.exits.find((e) => e.to === step.to);
        target = x ? { x: x.x, z: x.z, label: x.label } : null;
      } else if (step.type === 'collect') {
        const p = sim.player;
        const left = sim.pickups.filter((k) => !k.taken && (!step.kind || k.kind === step.kind) && (!k.mission || k.mission === m.id));
        const best = left.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
        target = best ? { x: best.x, z: best.z, label: best.kind === 'matrix' ? 'The Matrix' : best.kind === 'relic' ? 'The relic' : 'Energon' } : null;
      } else if (step.type === 'clear' || step.type === 'defeat') {
        const p = sim.player;
        const best = sim.enemies.filter((e) => !e.dead).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
        target = best ? { x: best.x, z: best.z, label: ENEMY_KINDS[best.kind]?.name ?? 'Decepticon', foe: true } : null;
      }
    }
    const count = step && (step.type === 'collect' || step.type === 'clear') ? `${missions.count}/${step.count}` : step?.type === 'drive' ? `${missions.count}/${step.gates.length}` : null;
    const offers = available({ missions: MISSIONS.filter((x) => x.from === sim.area.id) }, missions);
    const boss = sim.enemies.find((e) => e.boss && !e.dead);
    return {
      area: sim.area.name,
      mode: sim.player.mode,
      shifting: sim.player.shifting > 0,
      hp: sim.player.hp / sim.player.maxHp,
      boost: sim.player.boost,
      energon: sim.player.energon,
      down: sim.player.dead,
      mission: m ? { title: m.title, text: step?.text, count, timer: step?.within ? Math.max(0, missions.timer) : null } : null,
      target,
      near: sim.near,
      talk: sim.talk,
      offers: missions.active ? [] : offers.map((o) => ({ title: o.title, giver: sim.area.people.find((q) => q.id === o.giver)?.name })),
      done: missions.done.length,
      total: MISSIONS.length,
      boss: boss ? { name: ENEMY_KINDS[boss.kind].name, hp: boss.hp / ENEMY_KINDS[boss.kind].hp, form: boss.form } : null,
    };
  };

  return sim;
}

export { AREAS };
