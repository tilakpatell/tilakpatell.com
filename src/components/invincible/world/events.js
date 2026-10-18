// What happens in the world, said and sounded and fed on: the mission's
// outs, and each frame's events from the things to do, the villains and
// flying (split out of ./InvWorld.jsx as a repair; it calls these with what
// they act through).

import { createHits } from './hits';
import { getawayAt, newGetaway, stopGetaway } from './getaway';
import { CALLS, HERO_LINES, RINGS_DONE } from './lines';
import { local } from '../../../lib/hooks';
import { PORTAL, spawnFoes, spawnUpTo } from './foes';
import { keepStory, missionOf, nextStory, placeOf as missionPlace } from './missions';
import { CARDS, keepQuests } from './quests';
import { applyRuin, daysSince, forceOf, hitTower, mendTower, parse, repair, serialise, stageOf } from './demolish';
import { HEROES, hero } from './heroes';
import { stepPower } from './powers';
import { dive } from './flight';

export const sfx = (name) => import('../../../lib/sfx').then((s) => s[name]?.()).catch(() => null);
// a hit's sound at the hit law's gain and pitch (./hits.js); none within its gap
export const hits = createHits();
const sfxHit = (name, key, force) => {
  const voice = hits.voice(key, force);
  if (voice) import('../../../lib/sfx').then((s) => s.play(name, voice)).catch(() => null);
};
const sound = (name, ...args) => import('./sounds').then((m) => m[name]?.(...args)).catch(() => null);
export const AT = 'tp-inv-world-at';
export const TIME = 'tp-inv-world-time';
export const QUESTS = 'tp-inv-world-quests';
export const STORY = 'tp-inv-world-story';
export const RUINS = 'tp-inv-world-ruins';
export const HERO = 'tp-inv-world-hero';
// the hero kept from last time (./heroes.js), or Mark for one it doesn't know
export const keptHero = () => {
  const id = local.get(HERO, 'mark');
  return HEROES[id] ? id : 'mark';
};
// (faster than this into a wall, he marks the tower: a Viltrumite at Mach speed takes half of it)
const CRASH = 150;
const HANGAR = missionPlace('hangar');
export const ROOF = missionPlace('roof').p;
export const CARD_MS = 2600; // the episode's title card (2.5 s, and the fade's end)

export const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
export const WHAT = { fall: 'Someone’s slipping off a roof', heli: 'A news helicopter’s lost its tail rotor' };

// What a mission's step (or its end) asks for (./missions.js's `out`),
// done in the world: who's spawned, the getaway, the wave, the hangar, the
// card and the season kept.
export function handleOut(outs, c) {
  const { s, say, speak, unlock, clear, openCard, closeCard, shakeOff } = c;
  for (const o of outs) {
    if (o.type === 'step') {
      // a step with a car: the getaway pulls out; the step after one: it's stopped where it is
      if (o.car) s.getaway = newGetaway({ from: o.car.from ?? [s.h.p[0], 0, s.h.p[2]], speed: o.car.speed, seed: 3 + o.i, away: s.h.p });
      else if (s.getaway && !s.getaway.stopped) s.getaway = stopGetaway(s.getaway);
      if (o.spawn) {
        for (const [kind, n, at] of o.spawn) s.foes = spawnFoes(s.foes, kind, n, at?.car ? (getawayAt(s.getaway) ?? [s.h.p[0], 0, s.h.p[2]]) : at);
        s.missionFoes = true;
        s.invaded = true; // (the clock's own invasion stays out of it)
        sfx('alarm');
      }
      // (as many in all as the step wants beaten: any that never came, come now)
      if (o.upto) {
        const [kind, n, at] = o.upto;
        s.foes = spawnUpTo(s.foes, kind, n, at);
        s.missionFoes = true;
      }
      s.wave = o.wave ? { ...o.wave, at: o.spawn?.[0]?.[2] ?? PORTAL.p, spawned: o.spawn?.reduce((a, q) => a + q[1], 0) ?? 0, t: 0 } : null;
      s.hangarHp = 100;
      // something to hold: the Maulers go for it while he's not about (./foes.js pickTarget)
      const def = missionOf(s.mission?.id)?.steps[o.i];
      s.guard = def?.type === 'protect' && def.what === 'hangar' ? HANGAR.door : null;
      if (o.i > 0) {
        sfx('ding');
        say(o.text, 2600);
      }
    } else if (o.type === 'shake') shakeOff(missionOf(s.mission?.id)?.steps[s.mission.step]);
    else if (o.type === 'count') sfx('coin');
    else if (o.type === 'hp') sfx('warn');
    else if (o.type === 'done') {
      const id = s.mission.id;
      const m = missionOf(id);
      sfx('fanfare');
      if (o.achievement) unlock(o.achievement);
      const best = s.story.best[id] ?? null;
      s.story = keepStory(s.story, id, o.time);
      local.set(STORY, s.story);
      speak(m.done);
      if (s.getaway) s.getaway = stopGetaway(s.getaway);
      s.wave = null;
      s.guard = null;
      s.missionFoes = false;
      s.mission = null;
      openCard({ kind: 'done', id, time: o.time, best, next: m.side ? null : nextStory(s.story.done) });
    } else if (o.type === 'fail') {
      const id = s.mission.id;
      clear();
      s.mission = null;
      if (o.why === 'abandoned') {
        closeCard();
        say('Called off.');
      } else {
        sfx('crumble');
        openCard({ kind: 'fail', id, why: o.why });
      }
    }
  }
}

// What the things to do did this frame (./quests.js's `ev`): said, sounded,
// fed to the mission, kept.
export function questEvents(s, c) {
  const { say, feed, unlock, setFound } = c;
  for (const e of s.quests.ev) {
    if (e.type === 'lesson-start') {
      sfx('ding');
      say('Dad’s rings: in order, to the Guardians’ hall. Go.');
      feed({ type: 'lesson-start' });
    } else if (e.type === 'ring') {
      sfx('coin');
      feed({ type: 'ring', i: e.n });
    } else if (e.type === 'lesson-done') {
      sfx('fanfare');
      unlock('dadsrings');
      say(`${e.best ? 'A best: ' : 'Round in '}${clock(e.time)}. “${RINGS_DONE.text}”`, 4200, RINGS_DONE.who, RINGS_DONE.text);
    } else if (e.type === 'lesson-lost') say('Dad’s given up waiting. Back to the first ring, over the street outside the house.');
    else if (e.type === 'card') {
      sfx('oneUp');
      setFound(s.quests.cards.length);
      say(`Title card: episode ${e.ep}, “${e.title}”. ${s.quests.cards.length} of ${CARDS.length}.`, 3400);
      if (e.all) unlock('titlecards');
    } else if (e.type === 'emergency') {
      sfx('alarm');
      say(`${WHAT[e.kind]}! Follow the red beacon.`, 4200);
    } else if (e.type === 'slip') sfx('warn');
    else if (e.type === 'caught') {
      sfx('ding');
      say(e.kind === 'heli' ? 'Got it. Now set it down somewhere.' : 'Got them. Now put them down gently.');
      feed({ type: 'caught', source: e.source });
    } else if (e.type === 'saved') {
      sfx('victory');
      unlock('rescue');
      say(`Safe. That’s ${e.count} ${e.count === 1 ? 'rescue' : 'rescues'}.`);
    } else if (e.type === 'missed') {
      sfx('crumble');
      say(e.kind === 'heli' ? 'Too late: the crew jumped clear, and the street has a new hole in it.' : 'Too late, but the GDA had a net out. Barely.', 4200);
    }
    if (['card', 'saved', 'lesson-done'].includes(e.type)) local.set(QUESTS, keepQuests(s.quests));
  }
}

// What the villains did this frame (./foes.js's `ev`): sounded, said, fed
// to the mission (a knock-out, the hangar hit, a quake under the school).
export function foeEvents(s, events, c) {
  const { say, feed, unlock, shakeOff, api } = c;
  for (const e of events) {
    s.events.push(e);
    if (e.type === 'punch') {
      s.punchT = 0.25;
      sfx('zip');
    } else if (e.type === 'towerHit') hitTowerIn(s, api, e.building, e.force, e.at);
    else if (e.type === 'ko') {
      sfxHit('blast', 'ko', hits.foeForce(e.kind));
      feed({ type: 'ko', kind: e.kind ?? 'flaxan', id: e.id });
    } else if (e.type === 'swing' && e.on === 'hangar' && s.mission && s.guard) {
      // a Mauler's swing at the hangar while he's away: the hangar takes it (the last-but-one episode)
      s.hangarHp = Math.max(0, s.hangarHp - 10);
      sfx('crumble');
      feed({ type: 'hurt', what: 'hangar', hp: s.hangarHp });
    } else if (e.type === 'quake' && s.mission) shakeOff(missionOf(s.mission.id)?.steps[s.mission.step]);
    else if (e.type === 'hit') sfxHit('thunk', 'foe', hits.foeForce(e.kind));
    else if (e.type === 'bolt' || e.type === 'blast') sfx('laser');
    else if (e.type === 'hurt') sfx('hit');
    else if (e.type === 'spawn') sfx('pop');
    else if (e.type === 'carAway') sfx('thunk');
    else if (e.type === 'carHit' || e.type === 'carDown') sfx('crumble');
    else if (e.type === 'quake') sfx('boom');
    else if (e.type === 'floored') {
      sfx('thunk');
      say('Off your feet. Up, before the next one.');
    } else if (e.type === 'clear' && !s.foes.foes.some((q) => (q.kind ?? 'flaxan').startsWith('flaxan'))) {
      // (the Flaxans' `won` says its own piece)
      sfx('victory');
      say('Down. Every one of them.', 3200);
    } else if (e.type === 'beaten') {
      sfx('boom');
      say('That one hurt. Get back up.');
    } else if (e.type === 'won') {
      sfx('fanfare');
      unlock('flaxans');
      say('The portal’s closed. Every last Flaxan, back where they came from.', 4200);
    }
  }
}

// The ruins kept (./demolish.js), mended for the days since, put up in the
// scene and cut into the world's boxes he collides with. `a`: the scene's api.
export function loadRuins(s, a, now = Date.now()) {
  const known = (id) => Number.isInteger(id) && id >= 0 && id < s.world.buildings.length;
  let r = parse(local.get(RUINS, null), known);
  r = repair(r, daysSince(r, now), now);
  for (const [id, d] of r.d) {
    applyRuin(s.world, id, d);
    a.setDamage(id, d);
  }
  a.setRuins(r);
  local.set(RUINS, serialise(r));
  s.ruins = r;
}

// A tower hit: its damage, drawn and cut into the world, the rubble when a
// stage turns, the collateral counted (part 3's standing reads it), kept.
export function hitTowerIn(s, a, id, force, at, glass = false) {
  if (id == null || !s.ruins) return;
  const was = stageOf(s.ruins.d.get(id) ?? 0);
  const r = hitTower(s.ruins, id, force);
  if (!r.delta) return;
  s.ruins = r.ruins;
  const d = r.ruins.d.get(id);
  applyRuin(s.world, id, d);
  a.setDamage(id, d);
  if (r.stage !== was) a.setRuins(s.ruins);
  s.collateral = (s.collateral ?? 0) + r.delta;
  s.events.push({ type: 'ruin', id, at: [...at], stage: r.stage, delta: r.delta, glass });
  sfx(r.stage === 3 && was < 3 ? 'crumble' : 'crunch');
  local.set(RUINS, serialise(s.ruins));
}

// The power he has as another hero this frame (./powers.js), done: Eve's
// wall put up or a tower mended, Omni-Man's line-break flown (each tower
// along it marked, the street floored, Cecil's call), Thragg's shout
// (returned, for ./foes.js to throw what it reaches). Her walls age here.
export function powerStep(s, a, h, look, dt, say) {
  s.walls = (s.walls ?? []).filter((w) => (w.t += dt) < w.life);
  const P = hero(s.heroId).power;
  if (!P || (!s.powerKey && !s.power.held)) return [];
  const towers = [];
  if (s.powerKey)
    for (const b of s.world.buildings) {
      if (Math.abs(b.x - h.p[0]) > 1500 || Math.abs(b.z - h.p[2]) > 1500) continue;
      towers.push({ id: b.id, x: b.x, z: b.z, w: b.w, d: b.d, h: b.h + (b.top?.h ?? 0), damage: s.ruins?.d.get(b.id) ?? 0 });
    }
  const r = stepPower(s.power, s.heroId, { power: s.powerKey }, { p: h.p, look, mode: h.mode, v: h.v }, { towers }, dt);
  s.power = r.p;
  const shout = [];
  for (const o of r.out) {
    if (o.kind === 'construct') {
      s.walls.push({ at: o.at, yaw: o.yaw, wide: o.wide, high: 8, life: o.life, t: 0 });
      sfx('repulse');
    } else if (o.kind === 'mend') {
      s.ruins = mendTower(s.ruins, o.id, o.amount);
      const d = s.ruins.d.get(o.id) ?? 0;
      applyRuin(s.world, o.id, d);
      a.setDamage(o.id, d);
      a.setRuins(s.ruins);
      local.set(RUINS, serialise(s.ruins));
      sfx('ding');
    } else if (o.kind === 'linebreak') {
      s.h = dive(s.h, o.to, o.speed);
      for (const id of o.towers) hitTowerIn(s, a, id, o.damage * 400, [s.world.buildings[id].x, s.world.buildings[id].h, s.world.buildings[id].z], true);
      s.events.push({ type: 'linebreak', from: o.from, to: o.to });
      sfx('boom');
      setTimeout(() => say(CALLS.linebreak.text, 3600, CALLS.linebreak.who), 1800);
    } else if (o.kind === 'shout') {
      shout.push(o);
      s.events.push({ type: 'brawl', kind: 'pound', at: o.at });
      sfx('roar');
    }
  }
  return shout;
}

// A line of the hero he's flying as, now and then (and as he takes one up)
export function heroLine(s, say, now = false) {
  const lines = HERO_LINES[s.heroId];
  if (!lines || (!now && s.t - (s.heroSaid ?? -1e9) < 90)) return;
  s.heroSaid = s.t;
  s.heroLine = ((s.heroLine ?? -1) + 1) % lines.length;
  say(lines[s.heroLine], 3600, s.heroId);
}

// What his brawl did this frame (./brawl.js's `out`): heard, by its force
// (./hits.js), and passed on for the scene to draw (a crater, the throw, the
// ring of a ground pound, the counter's flash).
export function brawlEvents(s, outs, a) {
  for (const o of outs) {
    if (o.kind === 'punch') continue; // (./foes.js says whether one lands)
    // (what he carried slammed into a tower's face: the tower takes it too)
    if (o.kind === 'slam' && o.tower != null) hitTowerIn(s, a, o.tower, forceOf('slam'), o.at);
    s.events.push({ ...o, type: 'brawl', at: o.at ?? [s.h.p[0], s.h.p[1] + 1, s.h.p[2]] });
    const force = hits.moveForce(o);
    if (o.kind === 'grab') sfx('thunk');
    else if (o.kind === 'throw') sfx('zip');
    else if (o.kind === 'dive') sfx('flyby');
    else sfxHit(o.kind === 'pound' || force > 80 ? 'crumble' : 'thunk', o.kind, force);
  }
}

// What flying did this frame (./flight.js's `ev`): the landing fed to the
// mission, the boom, the slam, the splash and the Moon.
export function heroEvents(s, events, c) {
  const { say, feed, unlock, api } = c;
  for (const e of events) {
    s.events.push(e);
    if (e.type === 'land' || e.type === 'slam') feed({ type: 'land', speed: e.speed, p: e.at, body: e.body ?? null });
    if (e.type === 'boom') {
      sfx('boom');
      unlock('soundbarrier');
      if (!s.boomSaid) {
        s.boomSaid = true;
        say('The sound barrier. Keep going.');
      }
    } else if (e.type === 'slam') {
      sfxHit(e.speed > 80 ? 'crumble' : 'thunk', 'slam', e.speed);
      if (e.speed > 80) sfx('boom');
    } else if (e.type === 'impact') {
      sfxHit('crumble', 'impact', e.speed);
      if (e.speed > CRASH) hitTowerIn(s, api, e.building, e.speed, e.at);
    }
    else if (e.type === 'takeoff') sfx('zip');
    else if (e.type === 'splash') {
      // a slam's sound, lighter (water gives): spray, and a thud under it
      // when he hit it hard; one at a time, however often he skims it
      if (s.t - (s.splashAt ?? -1) >= 0.4) {
        s.splashAt = s.t;
        sound('splashSound', e.speed);
        if (e.speed > 80) sfxHit('thunk', 'splash', e.speed);
      }
    } else if (e.type === 'land') {
      sfxHit(e.speed > 300 ? 'crumble' : 'thunk', 'land', e.speed);
      // on the Moon, or Mars (./orbit.js names which; a soft landing in the city names none)
      if (e.body) {
        unlock(e.body === 'moon' ? 'moonwalk' : 'redplanet');
        say(e.body === 'moon' ? 'The Moon. Neil Armstrong, eat your heart out. (Space or W to go.)' : 'Mars. A long way from home. (Space to go.)', 4200);
      }
    }
  }
}
