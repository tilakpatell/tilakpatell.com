// The galaxy's war's battle in the system you're in, flown in (gcw.js says
// what's on where; battles.js lays it out at the planet; universe/battle.js
// fights it; universe/battleScene.js draws it). Not a game you start: the
// war you fight in (allegiance.js's theatre) is on, on the clock every pilot
// shares, and if there's a battle in this system when you drop in (or one
// starts while you're here) it's there in front of you, and you're in it on
// the side you swore to; unsworn, you're in nobody's sights and score
// nothing, and the crew asks you which it's to be. The crew calls it out
// (crews.js's battle lines, each with the side, the war and the system); the
// system's own fleets stand aside while it's on (world.js's quiet).
//
// Shared: the battle is the one every pilot in the system sees. What the
// pilots here have done is a tally (universe/tally.js, its epoch the
// battle's id) sent to the others in the system (the client's `fight`), and
// the battle's course is worked out from it, the battle's seed and the
// clock everyone shares (universe/battleDirector.js, running the battle's
// plan, universe/battlePlan.js): its objectives' hp, its stages, its
// runners, the capital ships it loses, and its end, so a shield generator
// one pilot takes down goes down for all of them, a pilot dropping in late
// sees what one who's been there all along does, and the battle's won by
// one side for everyone in it. The dogfight round you (universe/battle.js)
// is your own: the spectacle, and your part in it. You're known in that
// tally by a tally id of your own, kept with your shares in the battle's
// save (BATTLE_KEY, written as your word goes out), as warState.js keeps
// the war's: a reload, or a new identity, is a new peer id telling the same
// again, and the others count you once; and a page back in the battle picks
// up what it had done.
//
// What you did counts in the war (warState.js: points for each objective
// and fighter you take down, the battle won by the side that won it,
// counted once for everyone in it), sent to everyone online (`war`), and
// for your side: the attacker's objectives are only the attacker's to take
// (a defender's shots at their own flagship are nobody's business), and a
// defender scores the attacker's fighters down, a bomber as an intercept,
// which shores up the objective the attacker's AI is on (`g:<id>`). Each
// pilot counts itself in once, on its side (`here:a`, `here:d`), and the
// more pilots a side has, the less each one's damage counts (the director's
// scale). A set piece's target that's one side's to take whoever attacks
// (an enemy Star Destroyer's reactor, Endor's generator) counts only that
// side's shots (ctx.mineAs).
//
// And the set pieces (warpieces/: Endor's shield generator, superlaser and
// reactor run, Hoth's ion cannon and transports, Scarif's ram onto the gate,
// a hangar run into any Star Destroyer), run alongside the battle with its
// context (`ctx`); what they say of the ship (kept inside a tunnel, slowed,
// caught in a blast) goes back to the scene in what update returns.
//
// And a space level's Starfighter Assault (surface/missions/starfighter.js,
// the flow design's decision 4), asked for by the page (`?battle=
// starfighter`): starfighter({ level, side, draw }) stands the war's battle
// here aside and fights the level's in its place, laid by battles.js's
// layStarfighter, run by its own plan on the director, on your side (the
// oath's, or the one asked for); `draw(laid)` draws the level's pack
// round it (dispose() when it goes). It counts nothing in the war: it's a
// game you start, not the war's battle.
//
// createWarFront(scene, { models, small, reduced, tier, emit, makeScene,
//   now, allegiance, saves }) → { enter(sys, world), update(dt, t, camera, live, you) → { busy, hurt,
//   ship?, speedCap?, kill? },
//   hit(from, to, damage), targets, solids, bodies (shipHits.js's: the other side's fighters), setNet(client), onNet(e), battle,
//   director, info, win(team), respawn() → { x, y, z, heading } | null, dispose() }
// `allegiance()` → { war, side } (allegiance.js's current). `saves`: the
// browser's (runtime/saves.js), for the battle's save. `live`: the ship ({ x, y, z }) while it's flying, or null;
// `you`: { shield, down } (your shields, and whether you're shot down), for the
// fight round you's difficulty (universe/battleDifficulty.js). `solids`: the
// capital ships' hulls, for the ship to bump into (ship.js's, like the
// world's), changed when a battle starts or ends (onSolids is told).
// What you score is paid for too: { type: 'earn', what: 'warPoints' | 'warWin',
// n, side: 'galaxy' } to emit (universe/economy.js's EARN keys).
// The crews' ship powers: update takes a fifth, `you`, what the scene says
// of the ship, and a power's hold on the battle is in it ({ slow, ghost,
// magnet, pull }: universe/battlePowers.js's stepBattle, which steps the
// battle); pull(at, r, secs, daze) is Walt's magnet on it, and a power's
// damage is a shot's, through hit().

import { createBattle } from '../universe/battle';
import { createDirector } from '../universe/battleDirector';
import { difficulty, statsOf } from '../universe/battleDifficulty';
import { TYPES } from '../universe/battleObjectives';
import { createBattleScene } from '../universe/battleScene';
import { createCarry } from '../universe/earnRules';
import { createTally } from '../universe/tally';
import { holdFighters, stepBattle } from '../universe/battlePowers';
import { GCW, battleAt, campaignAt, history, seeded, teamsOf } from './gcw';
import { teamFor } from './allegiance';
import { DEFAULT_WAR, WARS, otherSide, warOfSide } from './sides';
import { layBattle, layStarfighter } from './battles';
import { sideShips, starfighterPlan } from './surface/missions/starfighter';
import { planOf } from './battlePlans';
import { piecesFor } from './warpieces';
import { addPoints, addWin, receiveWar, warMessage, warTally, warVersion } from './warState';
import { localSaves } from '../../runtime/local';

// the battle's save: its tally as you told it (its id, your shares, the totals you knew)
const BATTLE_KEY = 'tp-gcw-battle';
const newId = () => [...globalThis.crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');

export const FRONT = {
  metres: 53.3, // a map unit in the galaxy
  fightEvery: 0.4, // seconds between your word on the battle's objectives, at most
  fightAgain: 5, // and every this often anyway, while it's on
  judge: 2, // seconds between the fight round you's difficulty being weighed again
  warEvery: 2, // seconds between your word on the war, at most
  warAgain: 30, // and every this often anyway
  near: 1.5, // within this many of its radii, you're in it
  cover: 25, // a kill within this of one of your side's runners covers it
};
const UNSWORN = Object.freeze({ war: DEFAULT_WAR, side: null });

export function createWarFront(scene, { models, small = false, reduced = false, tier = 'high', emit = () => {}, makeScene = createBattleScene, now = () => Date.now(), onSolids = () => {}, allegiance = () => UNSWORN, saves = localSaves() } = {}) {
  const draw = makeScene(scene, { models, small, reduced, metres: FRONT.metres });
  let sys = null;
  let world = null;
  let battle = null; // battle.js's
  let on = null; // gcw.js's battleAt: which battle it is, and its clock
  let laid = null; // battles.js's layBattle
  let director = null; // battleDirector.js's: the battle every pilot here shares
  let skew = 0; // seconds the dev hooks have run the shared clock on by
  let version = 0; // (the fight tally's changes, so the director's state is worked out again only when it's changed)
  let sharedAt = null;
  let sharedKey = '';
  const here = new Set(); // the sides you've counted yourself in on, this battle
  let saidRunners = false; // (the runners' line, said once a battle)
  let saidStage = -1; // the last stage whose line's been said (as it opened)
  const saidSide = new Set(); // and the side objectives' (a wave in, an ace up)
  let planned = new Set(); // the tally keys the battle's plan reads (yours on them count for less the more of you)
  let shown = false;
  let joined = false; // in among it (said once a battle)
  let tookPart = false; // you were in it at some point (a win's yours too)
  let ended = false; // its end's been counted
  let team = null; // your side's in it (allegiance.js's teamFor), or nobody's
  let asked = false; // (unsworn: which side, asked once a battle)
  let state = null; // gcw.js's history, worked out once a step (or when the war's tally changes)
  let stateKey = '';
  let solids = [];
  let pieces = []; // the set pieces of the battle on
  let forced = false; // (a dev hook's battle, or a Starfighter Assault, kept till the system's left)
  let level = null; // (a Starfighter Assault's pack, drawn while it's on)
  const last = { t: 0, camera: null }; // (the last frame's, for the dev hook that runs it on)
  const said = new Map(); // a set piece's line, by id: when it was last said (seconds on the battle's clock)
  const held = new Map(); // a world solid let go of (a run's way in): its r and reach
  // (your tally id: this page's, or the battle's save's once you're back in the battle it was told in)
  const fight = createTally('none', { cap: 4000, id: newId() });
  let net = null;
  let fightDirty = false;
  let fightSent = -1e9;
  let warDirty = false;
  let warSent = -1e9;
  let clock = 0;
  // how you're doing in it (battleDifficulty.js: how hard the fight round you
  // is, yours alone): your kills and deaths, on the shared clock, since you came
  const yours = { kills: [], deaths: [], since: null, down: false, shield: 100, judged: -1e9 };
  // and what you did in it, for its end card (BattleEnd.jsx), and how it ended
  const part = { kills: 0, objectives: 0, intercepts: 0, points: 0 };
  let result = null;

  const side = () => allegiance()?.side ?? null;
  // (with the side the battle's against, from yours: the other of its two, or its defender while you're nobody's)
  const against = () => (!on ? null : side() ? (on.sides?.find((x) => x !== side()) ?? null) : (on.defender ?? null));
  const say = (sub) => emit({ type: 'event', id: 'battle', sub, side: side(), against: against(), war: on?.war ?? allegiance()?.war ?? DEFAULT_WAR, sys: sys?.id ?? null });
  // the attacker's objectives count only when you're the attacker
  const attacking = () => team !== null && team === on?.attackerTeam;
  // and the wallet's pay for them (universe/economy.js's warPoints, per
  // point): the scene's page earns it. A fighter is a tenth of a point, so
  // the fractions are kept till they make a whole one (earnRules.js).
  const carry = createCarry();
  const score = (n, ms = now()) => {
    if (team === null || !sys || !on) return;
    // (a Starfighter Assault is yours, not the war's: its points are its end card's)
    if (on.starfighter) {
      part.points += n;
      return;
    }
    const v = warVersion();
    addPoints(side(), sys.id, on.step, n, ms);
    part.points += n;
    warDirty = true;
    if (warVersion() === v) return; // (not counted: nothing to pay)
    const whole = carry.add(n);
    if (whole) emit({ type: 'earn', what: 'warPoints', n: whole, side: 'galaxy' });
  };
  // a set piece's line (the galaxy's own: lines.js), not again within a while
  const sayEvent = (id) => {
    const at = battle?.clock ?? 0;
    if (said.has(id) && at - said.get(id) < 25) return;
    said.set(id, at);
    emit({ type: 'event', id });
  };

  // the set pieces' hold on the battle and the world round it
  const ctx = {
    scene,
    small,
    reduced,
    get battle() {
      return battle;
    },
    get laid() {
      return laid;
    },
    get sys() {
      return sys;
    },
    get world() {
      return world;
    },
    get on() {
      return on;
    },
    // (the drawing's set-piece hooks, safe to call whatever's drawing)
    draw: {
      flash: (at, o) => draw.flash?.(at, o),
      burn: (at, size) => draw.burn?.(at, size),
      setVisible: (ship, there) => draw.setVisible?.(ship, there),
    },
    shared: (key) => fight.value(key),
    // your shots on a set piece's target, shared with the pilots here: `mine`
    // counts them only while you're the attacker (the battle's objectives),
    // `mineAs(team)` only while you're on that team (a target that's one
    // side's to take whoever attacks: an enemy Star Destroyer's reactor,
    // Endor's generator)
    mine: (key, damage) => {
      if (attacking()) addFight(key, planned.has(key) ? damage / scale() : damage);
    },
    mineAs: (theirs, key, damage) => {
      if (team !== null && team === theirs) addFight(key, planned.has(key) ? damage / scale() : damage);
    },
    // one of the battle's plan's objectives a set piece holds (Endor's
    // generator and reactor, Scarif's gate, Hoth's cannon), as the director
    // has it: its hp, whether it's down, whether its stage is open, and the one on now
    objective: (id) => {
      const st = shared();
      const o = st?.objectives.find((x) => x.id === id);
      return o ? { ...o, open: Boolean(st.stages[o.stage]?.open), active: st.stage === o.stage } : null;
    },
    // the shared clock, and the capital ships the director loses on it (a
    // set piece plays out its own, `by` it: Endor's superlaser), so a set
    // piece's moments are the same for every pilot, not timed from when you came
    clock: () => sharedT(),
    losses: () => shared()?.losses ?? null,
    // when the battle every pilot here shares ended, on the shared clock (or
    // null), and a second on that clock as a wall second (world.js's: Scarif's Death Star in)
    endedAt: () => shared()?.endsAt ?? null,
    wallAt: (s) => (on ? on.start / 1000 + s - skew : null),
    event: (id) => sayEvent(id),
    points: (n) => score(n),
    tookPart: () => tookPart,
    // a capital ship's hull, there to bump into or not (a run's way in through it)
    setHull: (id, there) => {
      for (const o of solids)
        if (o.cap.id === id) {
          o.r = o.reach = there && !o.cap.gone ? o.sr : 0;
        }
    },
    // and moved with it (the Scarif ram, the Executor's dive)
    moveHull: (cap) => {
      for (const o of solids)
        if (o.cap === cap) {
          const sp = cap.spheres[o.i];
          o.at[0] = sp.c.x;
          o.at[1] = sp.c.y;
          o.at[2] = sp.c.z;
        }
    },
    // one of the world's solids let go of, or put back (the Death Star's, at its run's way in)
    solid: (id, there) => {
      const o = world?.solids.find((x) => x.id === id);
      if (!o) return;
      if (!there && !held.has(id)) {
        held.set(id, { r: o.r, reach: o.reach });
        o.r = o.reach = 0;
      } else if (there && held.has(id)) {
        const h = held.get(id);
        o.r = h.r;
        o.reach = h.reach;
        held.delete(id);
      }
    },
  };

  // what you've done, in the tally the pilots here share
  const addFight = (key, n) => {
    fight.add(key, n);
    fightDirty = true;
    version += 1;
  };
  // the shared clock: seconds since the battle began (and what the dev hooks have run it on by)
  const sharedT = (ms = now()) => (on ? (ms - on.start) / 1000 + skew : 0);
  // the director's state now, worked out again only when the clock or the tally's moved
  const shared = () => {
    if (!director) return null;
    const t = sharedT();
    const key = `${t}:${version}`;
    if (key !== sharedKey) {
      sharedAt = director.state(t, fight.value);
      sharedKey = key;
    }
    return sharedAt;
  };
  // what each of your side's damage counts for, by how many of you there are
  const scale = () => (director && team !== null ? director.scale(team, fight.value) : 1);
  // a capital ship of the director's losses: its side's `index`th
  const lost = (l) => battle?.capitals.filter((c) => c.team === l.team)[l.index] ?? null;

  // the shared state's stage, its objectives and what's next, for the HUD (warText.js says them)
  const stageOf = (st) => {
    const s = director.plan.stages[st.stage];
    return { index: st.stage, count: director.plan.stages.length, open: st.open, opensIn: +st.opensIn.toFixed(1), need: s ? (s.need ?? s.objectives.length) : 0, id: s?.id ?? null, type: s?.type ?? null, ...(s?.name ? { title: attacking() ? s.name : s.nameDefend } : {}) };
  };
  const objectivesOf = (st) => {
    const s = director.plan.stages[st.stage];
    if (!s) return [];
    return s.objectives.map((o) => {
      const x = st.objectives.find((y) => y.id === o.id);
      return { id: o.id, name: o.name, type: o.type, ...(o.verbs ? { verbs: o.verbs } : {}), hp: x?.hp ?? o.hp, hpMax: o.hp, down: Boolean(x?.down) };
    });
  };
  const nextOf = (st) => {
    const e = (director.plan.escalations ?? []).find((x) => x.at > st.t);
    return e ? { type: e.type, at: e.at, in: +(e.at - st.t).toFixed(1), name: e.name ?? null } : null;
  };

  const hulls = () => {
    const out = [];
    for (const cap of battle?.capitals ?? [])
      cap.spheres.forEach((sp, i) => out.push({ id: `war-${cap.id}-${i}`, at: [sp.c.x, sp.c.y, sp.c.z], r: sp.r, reach: sp.r, sr: sp.r, i, hull: `war-${cap.id}`, cap }));
    return out;
  };

  const stop = () => {
    level?.dispose?.();
    level = null;
    for (const p of pieces) p.dispose();
    pieces = [];
    said.clear();
    for (const id of [...held.keys()]) ctx.solid(id, true);
    if (shown) draw.hide();
    shown = false;
    battle = null;
    on = null;
    laid = null;
    director = null;
    sharedAt = null;
    sharedKey = '';
    skew = 0;
    here.clear();
    saidRunners = false;
    saidStage = -1;
    saidSide.clear();
    planned = new Set();
    joined = false;
    tookPart = false;
    ended = false;
    team = null;
    asked = false;
    Object.assign(yours, { kills: [], deaths: [], since: null, down: false, shield: 100, judged: -1e9 });
    Object.assign(part, { kills: 0, objectives: 0, intercepts: 0, points: 0 });
    result = null;
    world?.quiet?.(false);
    if (solids.length) {
      solids = [];
      onSolids(solids);
    }
  };

  // (your team in it: a Starfighter Assault's is the side it was asked for)
  const teamIn = (b) => (b?.starfighter ? b.sides.indexOf(b.starfighter.side) : teamFor(side(), b));
  const start = (b, ms) => {
    const sf = b.starfighter ?? null;
    laid = sf ? layStarfighter(sys, b, sf.level, { now: ms, tier }) : layBattle(sys, b, { now: ms, tier });
    fight.reset(b.id);
    // (back in a battle this browser told of before a reload: the same id, and what was done)
    fight.load(saves?.get(BATTLE_KEY, null));
    version += 1;
    on = b;
    director = createDirector({ plan: sf ? starfighterPlan(sf.level, laid.frame, { id: b.id }) : planOf(sys, b, laid), seed: b.id });
    planned = new Set(director.keys());
    const aces = director.plan.side.filter((o) => o.type === 'ace');
    battle = createBattle({
      ...laid,
      rand: seeded(b.id),
      plan: director.plan,
      director: { state: shared },
      // (its fighters flown with tactics, in flights, and its capital ships as
      // fleets: the push at the plan's time on the shared clock, each ship's
      // hull you bump into moved with it)
      tactics: { push: director.plan.escalations?.find((e) => e.type === 'push')?.at ?? 480, clock: () => sharedT(), onMove: (cap) => ctx.moveHull(cap) },
      // (the plan's aces, launched at their time: battleStages.js)
      ace: Object.fromEntries(aces.map((a) => [a.team, { kind: a.kind, name: a.name, hp: a.hp }])),
      // your shot on an objective (the attacker's to take), on one of the
      // other side's runners or on their ace (whoever's they are), each
      // pilot's worth less the more of them there are
      onMine: (id, damage) => {
        if (attacking() || id.startsWith('r:') || id.startsWith('ace:')) addFight(id, damage / scale());
      },
    });
    team = teamIn(b);
    battle.setYou(team);
    // (the capital ships lost long before you came: gone already)
    for (const l of shared().losses) {
      const cap = l.dead && sharedT(ms) - l.at > 10 ? lost(l) : null;
      if (cap) Object.assign(cap, { alive: false, gone: true, hull: 0 });
    }
    draw.show(battle, laid.war);
    for (const cap of battle.capitals) if (cap.gone) draw.setVisible?.(cap, false);
    // (a Starfighter Assault's ships the level's pack draws are drawn once: the game's)
    // (and drawn by the battle again where the pack's tier leaves the ship out: Kamino's on low)
    const capOf = sf ? new Map([0, 1].flatMap((t) => battle.capitals.filter((c) => c.team === t).map((cap, i) => [sideShips(sf.level, t)[i]?.id, cap]))) : null;
    for (const s of sf?.level.ships ?? []) if (s.pack && capOf.get(s.id)) draw.setVisible?.(capOf.get(s.id), false);
    shown = true;
    world?.quiet?.(true);
    // (and the stations a level stands in place of, its Death Star's shield with it: quiet(false) puts them back)
    for (const k of sf?.level.hides ?? []) world?.war?.station?.(k, false);
    if (sf?.level.hides?.includes('deathstar2')) world?.war?.holdShield?.(false);
    solids = hulls();
    onSolids(solids);
    // (the set pieces are the films' own, the Civil War's; a Starfighter Assault's is the level's, its pack)
    pieces = b.war === 'gcw' && !sf ? piecesFor(sys.id).map((make) => make(ctx)) : [];
    level = sf?.draw?.(laid, { unhide: (id) => capOf.get(id) && draw.setVisible?.(capOf.get(id), true) }) ?? null;
    say('front');
    if (team === null) {
      asked = true;
      say('ask');
    }
  };

  // the war as it stands (a step's worth at a time, or when what the players did changes)
  const warState = (ms) => {
    const c = campaignAt(ms);
    const war = allegiance()?.war ?? DEFAULT_WAR;
    const key = `${war}:${c.n}:${c.step}:${warVersion()}`;
    if (key !== stateKey) {
      const t = warTally(ms);
      state = history(war, c.n, ms, (k) => t.value(k));
      stateKey = key;
    }
    return state;
  };

  const sendNet = (dt) => {
    clock += dt;
    if (!net) return;
    if (battle && !battle.over && (fightDirty ? clock - fightSent > FRONT.fightEvery : clock - fightSent > FRONT.fightAgain)) {
      net.fight?.(fight.message());
      fightSent = clock;
      fightDirty = false;
      saves?.set(BATTLE_KEY, fight.save()); // (kept with the shares it told)
    }
    // (the war goes a page at a time: soon again while someone's owed the
    // rest of it; and once anyway, so the others know to tell you it)
    const war = warTally(now());
    if (warDirty || war.owing() ? clock - warSent > FRONT.warEvery : clock - warSent > FRONT.warAgain && (war.keys().length || warSent < 0)) {
      net.war?.(warMessage(now()));
      warSent = clock;
      warDirty = false;
    }
  };

  const front = {
    // a system entered (and its world), or left (null)
    enter(next, w = null) {
      forced = false;
      stop();
      sys = next;
      world = w;
    },

    update(dt, t, camera, live, you = null) {
      last.t = t;
      last.camera = camera;
      sendNet(dt);
      if (!sys) return { busy: false, hurt: 0 };
      const ms = now();
      const b = forced ? on : battleAt(warState(ms), sys.id, ms);
      if (b?.id !== on?.id) {
        stop();
        // (not in its lull: the next one's along when the step's up)
        if (b?.fighting) start(b, ms);
      }
      if (!battle) return { busy: false, hurt: 0 };
      // sworn (or sworn again) while it's on: in it on that side
      const now2 = teamIn(on);
      if (now2 !== team) {
        team = now2;
        battle.setYou(team);
      }
      let hurt = 0;
      // the battle as the director has it: its end, and the capital ships it's lost by now
      const st = shared();
      // (a pilot arriving after the end sees the losing fleet gone already: how long ago it ended)
      if (st.winner !== null && !battle.over) battle.end(st.winner, st.why, Math.max(0, sharedT(ms) - st.endsAt));
      for (const l of st.losses) {
        const cap = l.dead ? lost(l) : null;
        if (cap?.alive && cap.dying <= 0 && !battle.over) battle.wreck(cap.id);
      }
      const events = stepBattle(battle, dt, live ? { x: live.x, y: live.y, z: live.z, alive: true } : null, you ?? {});
      if (live) {
        const d = Math.hypot(live.x - laid.at[0], live.y - laid.at[1], live.z - laid.at[2]);
        if (d < laid.radius * FRONT.near) {
          tookPart = true;
          if (!joined && !battle.over && team !== null) {
            joined = true;
            say('join');
          }
        }
      }
      // how you're doing (your shields, and whether you've just been shot
      // down), and so how hard the fight round you is, now and then
      if (you) {
        yours.shield = you.shield ?? 100;
        if (you.down && !yours.down && tookPart) yours.deaths.push(sharedT(ms));
        yours.down = Boolean(you.down);
      }
      if (tookPart && yours.since === null) yours.since = sharedT(ms);
      if (team !== null && yours.since !== null && clock - yours.judged >= FRONT.judge) {
        yours.judged = clock;
        battle.setDifficulty(difficulty(statsOf({ ...yours, now: sharedT(ms) })));
      }
      // in it: counted in, once, on your side
      if (tookPart && team !== null && !here.has(team) && !battle.over) {
        here.add(team);
        addFight(team === on.attackerTeam ? 'here:a' : 'here:d', 1);
      }
      // the runners off: said as the first of them goes (a blockade's run, or an evacuation's)
      if (!saidRunners && st.runners?.some((r) => r.launched && !r.out && !r.down)) {
        saidRunners = true;
        say(laid.kind === 'blockade' ? 'blockade' : 'runners');
      }
      // each stage's line as it opens (the gravity wells, a zone to hold, a ship to board…), and a wave's and an ace's as they come
      const stage = director.plan.stages[st.stage];
      if (stage && st.open && st.stage > saidStage && !battle.over && team !== null) {
        saidStage = st.stage;
        const key = stage.crew ?? TYPES[stage.type]?.crew;
        if (key) say(key);
      }
      director.plan.side.forEach((o, i) => {
        const up = o.type === 'wave' ? st.waves.find((w) => w.id === o.id)?.launched && !st.waves.find((w) => w.id === o.id)?.arrived : st.aces.find((a) => a.id === o.id)?.launched;
        if (!up || saidSide.has(i) || battle.over || team === null) return;
        saidSide.add(i);
        say(TYPES[o.type].crew);
      });
      // a zone of the stage that's open, held: the seconds you're in it, for your side
      if (live && team !== null && !battle.over)
        for (const o of battle.objectives ?? []) {
          if (!o.zone || !o.alive || !battle.isOpen?.(o)) continue;
          if (Math.hypot(live.x - o.pos.x, live.y - o.pos.y, live.z - o.pos.z) < o.zone) addFight(`${o.key}:${attacking() ? 'a' : 'd'}`, dt / scale());
        }
      for (const e of events) {
        if (e.type === 'hurt') hurt += e.damage;
        else if (e.type === 'down' && e.mine && team !== null && e.team !== team) {
          yours.kills.push(sharedT(ms));
          if (e.role === 'bomber' && !attacking() && !e.ace) part.intercepts += 1;
          else part.kills += 1;
          if (e.ace) {
            score(GCW.points.ace, ms);
            say('ace');
            // (the attacker's ace brought down by a defender: five intercepts' worth on the objective under attack)
            const target = shared()?.target;
            if (!attacking() && target && !battle.over) addFight(`g:${target}`, 5 / scale());
          } else if (e.role === 'bomber' && !attacking()) {
            score(GCW.points.intercept, ms);
            say('intercept');
            // (and the objective the attacker's AI is on, shored up; a wave's, one fewer of it to strike)
            const target = shared()?.target;
            if (target && !battle.over) addFight(`g:${target}`, 1 / scale());
            if (e.wave && !battle.over) addFight(e.wave, 1 / scale());
          } else score(GCW.points.kill, ms);
          // (and one of your side's runners near it, covered)
          const r = !battle.over && battle.runners.find((x) => x.shared && x.alive && x.team === team && Math.hypot(x.pos.x - e.at.x, x.pos.y - e.at.y, x.pos.z - e.at.z) < FRONT.cover);
          if (r) addFight(`c:${r.slot}`, 1 / scale());
        } else if (e.type === 'runner' && e.mine && team !== null && e.team !== team) {
          part.intercepts += 1;
          score(GCW.points.intercept, ms);
          say('intercept');
        } else if (e.type === 'sub') {
          if (e.mine && attacking()) {
            part.objectives += 1;
            score(GCW.points.objective, ms);
          }
          if (tookPart && e.kind === 'bridge') say('bridge');
          else if (tookPart && e.kind === 'reactor') say('reactor');
        } else if (e.type === 'turret' && e.mine) {
          if (battle.capitals.find((c) => c.id === e.cap)?.team !== team) score(GCW.points.turret, ms);
        } else if (e.type === 'shield' && tookPart) say('gens');
        else if (e.type === 'capital' || e.type === 'jumped') {
          // a capital ship gone (or jumped out): its hull's not there to hit any more
          for (const o of solids) if (o.cap.id === e.id) o.r = o.reach = 0;
        } else if (e.type === 'over' && !ended) {
          ended = true;
          if (tookPart && team !== null) {
            if (e.winner === team && on.starfighter) part.points += GCW.points.win;
            else if (e.winner === team) {
              const v = warVersion();
              addWin(side(), sys.id, on.step, ms);
              part.points += GCW.points.win;
              warDirty = true;
              if (warVersion() !== v) emit({ type: 'earn', what: 'warWin', n: 1, side: 'galaxy' }); // (the first time it's counted)
            }
            say(e.winner === team ? 'won' : 'lost');
          }
          // how it ended, for the end card and the line over the galaxy (the director's, the same for every pilot)
          const now3 = shared();
          const runs = now3?.runners && director.plan.runners;
          result = {
            winner: e.winner,
            why: e.why,
            at: now3?.endsAt ?? sharedT(ms),
            runners: runs ? { kind: runs.kind, team: runs.team, out: now3.runners.filter((r) => r.out).length, down: now3.runners.filter((r) => r.down).length, need: runs.need } : null,
            yours: { ...part, points: +part.points.toFixed(2) },
          };
        }
      }
      // the set pieces
      const res = { busy: true, hurt };
      const marks = [];
      for (const p of pieces) {
        const r = p.update(dt, t, live, events) ?? {};
        if (r.hurt) res.hurt += r.hurt;
        if (r.ship) res.ship = r.ship;
        if (r.speedCap) res.speedCap = Math.min(res.speedCap ?? Infinity, r.speedCap);
        if (r.kill) res.kill = true;
        marks.push(...p.markers(live));
      }
      draw.update(dt, t, camera, camera?.position ?? { x: 0, y: 0, z: 0 }, events, team, marks);
      level?.update?.(camera?.position ?? null);
      return res;
    },

    hit(from, to, damage) {
      if (!battle || battle.over) return null;
      for (const p of pieces) {
        const h = p.hit(from, to, damage);
        if (h) return h;
      }
      return battle.hit(from, to, damage);
    },
    // Walt's magnet: the other side's fighters within `r` of `at` held for
    // `secs` with their guns quiet, `daze` more (battlePowers.js); how many
    pull(at, r, secs, daze = 0) {
      return battle ? holdFighters(battle, at, r, secs, daze) : 0;
    },
    get targets() {
      if (!battle || battle.over) return [];
      if (!pieces.length) return battle.targets;
      return [...battle.targets, ...pieces.flatMap((p) => p.targets)];
    },
    get solids() {
      return solids;
    },
    // the other side's fighters, while you're in it on a side, as
    // shipHits.js's bodies (a ram on one the battle's strike; the hulls are solids)
    get bodies() {
      if (!battle || battle.over || team === null) return [];
      const out = [];
      for (const f of battle.fighters) {
        if (!f.alive || f.team === team) continue;
        out.push({ key: `f:${f.id}`, id: f.id, kind: f.kind, at: f.seen, vel: f.vel, size: f.size, side: 'foe', hit: (punch) => battle?.strike(f.id, punch) ?? null });
      }
      return out;
    },
    // where you come back after a death here: behind your side's line
    // (battle.js's homeFor), while the battle's on and you've been in it on
    // a side, as an arrival ({ x, y, z, heading }); else null (the system's own)
    respawn() {
      if (!battle || battle.over || !tookPart || team === null) return null;
      const { pos, fwd } = battle.homeFor(team);
      return { x: pos.x, y: pos.y, z: pos.z, heading: Math.atan2(-fwd.x, -fwd.z) };
    },
    get battle() {
      return battle;
    },
    get director() {
      return director;
    },
    // (an Interdictor's gravity wells standing: nobody's boosting out of this one)
    get interdicted() {
      return Boolean(battle?.interdicted && !battle.over);
    },
    get on() {
      return on;
    },
    get info() {
      const t = warTally(now());
      // (mine: what you've done in the war this campaign, in points)
      const mine = +t.keys().reduce((sum, k) => sum + (k.startsWith('win:') ? 0 : t.mine(k)), 0).toFixed(2);
      const st = shared();
      return {
        sys: sys?.id ?? null,
        on,
        laid: laid ? { at: laid.at, axis: laid.axis, lines: laid.lines, radius: laid.radius, name: laid.war.name, attacker: laid.attacker, kind: laid.kind, objectivesOn: laid.objectivesOn } : null,
        battle: battle?.info ?? null,
        // (the battle every pilot here shares: where it's got to, and how it ended)
        shared: st
          ? {
              t: +st.t.toFixed(1),
              stage: st.stage,
              open: st.open,
              opensIn: st.opensIn,
              target: st.target,
              winner: st.winner,
              why: st.why,
              endsAt: st.endsAt,
              runners: st.runners ? { launched: st.runners.filter((r) => r.launched).length, out: st.runners.filter((r) => r.out).length, down: st.runners.filter((r) => r.down).length, need: director.plan.runners.need, count: st.runners.length } : null,
            }
          : null,
        joined,
        tookPart,
        mine,
        // (how hard the fight round you is: yours alone)
        difficulty: battle?.difficulty ?? null,
        // the stage it's at, that stage's objectives (their hp the director's,
        // every pilot's), what's next on its clock, and how it ended
        stage: st ? stageOf(st) : null,
        objectives: st ? objectivesOf(st) : [],
        next: st ? nextOf(st) : null,
        result: result && { ...result, ago: Math.max(0, +(sharedT() - result.at).toFixed(1)) },
        team,
        asked,
        side: side(),
        war: on?.war ?? allegiance()?.war ?? DEFAULT_WAR,
      };
    },

    setNet(client) {
      net = client ?? null;
    },
    // what the other pilots say: the war (from anywhere), the battle here
    onNet(e) {
      if (e.type === 'war') receiveWar(e.from, e.msg, now());
      else if (e.type === 'fight' && battle && e.msg.e === fight.epoch && fight.receive(e.from, e.msg)) version += 1;
    },

    // (dev hooks: end the battle now, `winner` the team that wins; a battle
    // here now, whatever the war says, `attacker` a side of the war you fight
    // in (its liberator, unless it's said) or the Hutts, and `kind` a kind of
    // battle (battles.js's BATTLE_KINDS) or the system's own, for the checks)
    win(winner) {
      battle?.end?.(winner);
    },
    force(attacker, kind = null) {
      if (!sys) return;
      const ms = now();
      const war = warOfSide(attacker) ?? allegiance()?.war ?? DEFAULT_WAR;
      const w = WARS[war];
      const by = attacker === 'hutt' || warOfSide(attacker) ? attacker : w.liberator;
      const defender = by === 'hutt' ? w.liberator : otherSide(by);
      const sides = teamsOf(by, defender);
      stop();
      forced = true;
      start({ id: `dev.${war}.${sys.id}.${Math.floor(ms / 1000)}`, war, sys: sys.id, step: campaignAt(ms).step, seed: Math.floor(ms / 1000), attacker: by, defender, sides, attackerTeam: sides.indexOf(by), ...(kind ? { kind } : {}), start: ms, fightEnd: ms + GCW.fight, end: ms + GCW.step, fighting: true }, ms);
    },
    // a space level's Starfighter Assault here, now, in place of the war's
    // battle: `level` (starfighter.js's levelOf), on `side` (the oath's, or
    // the attacker's if you're nobody's), its pack drawn by `draw(laid)`
    starfighter({ level: lv, side: want = null, draw = null, name = null }) {
      if (!sys || !lv) return false;
      const ms = now();
      const sides = teamsOf(...lv.sides);
      const pick = [want, side()].find((x) => sides.includes(x)) ?? sides[lv.attacker];
      stop();
      forced = true;
      start({ id: `sf.${sys.id}.${Math.floor(ms / 1000)}`, war: warOfSide(sides[0]) ?? DEFAULT_WAR, sys: sys.id, step: campaignAt(ms).step, seed: Math.floor(ms / 1000), attacker: sides[lv.attacker], defender: sides[lv.defender], sides, attackerTeam: lv.attacker, start: ms, fightEnd: ms + 600000, end: ms + 660000, fighting: true, starfighter: { level: { ...lv, name: name ?? lv.name }, side: pick, draw } }, ms);
      return true;
    },
    // whether a point's inside a level's area of its own (Kamino's storm):
    // the scene hides the galaxy's sky and names while the camera is
    enclosed(p) {
      return Boolean(level?.area?.inside(p));
    },
    // (and the area itself: its light, its flash, for the scene's look, areaLook.js)
    get area() {
      return level?.area ?? null;
    },
    get pieces() {
      return pieces;
    },
    // (and the battle run on `seconds`, a tenth at a time, without the ship,
    // the shared clock with it: software GL in the browser checks runs it at
    // a crawl; or the shared clock alone moved on, to get past a stage's gate)
    skip(seconds) {
      for (let k = 0; k < seconds * 10 && battle && !battle.over; k++) {
        skew += 0.1;
        front.update(0.1, last.t + k * 0.1, last.camera, null);
      }
    },
    jump(seconds) {
      if (battle) skew += seconds;
    },
    dispose() {
      stop();
      draw.dispose();
    },
  };
  return front;
}
