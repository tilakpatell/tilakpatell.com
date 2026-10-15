// The story run over the free roam: rules/story.js decides what happens
// next; this carries it out on the game. Each effect the story asks for
// becomes a change to the station (a flag, a door, someone spawned or
// taken away, a line said, a scene played, who you are, what you carry,
// who walks with you, where you stand) and, when the story goes back to a
// beat’s checkpoint, everything is put back as the beat found it. A scene
// waits for the scene drawn to say it is done; until the cinematics are
// drawn, the game says so itself after the scene’s length, so every story
// can be finished. Pure apart from the game it changes.
//
//   startPlot(g, at?) → void       the side’s story on this station, from the saved step `at`
//   feedPlot(g, event) → void      hands the story an event; its effects are carried out at once
//   stepPlot(g, dt) → void         the step’s clock: a tick to the story, a scene timed out
//   spawnOne(g, { kind, spot, tag, role, squad, hostile, script, to }, n) → person | null   role 'lead'
//     walks you to the spot `to`
//   setHero(g, kind) → void        who you are: their gun, their blade
//   bringAlong(g) → void           those with you put beside you where you have been put
//   heldUp(g) → person | null      the father you hold up through the carry
//   holdUp(g, moved) → void        keeps him at your side, after the crew's step (moved: metres you went)
//   held(g, walk) → walk           the walk asked of you, without the run, jump and crouch while you hold him
//   storySteps(g) → [step]         the steps of the story a new game on this station and side runs
//   SCENE_SECONDS                  how long each scene lasts when nothing draws it
//
// g.plot: { story, progress } | null; g.items: Set; g.scene: { id, t } | null

import { CAST } from '../cast';
import { raise } from '../alarm';
import { addPerson, removePerson } from '../brains';
import { legsOf } from '../routines';
import { FRESH } from '../disguise';
import { WHO } from '../talk';
import { checkpointOf, startStory, storyStep } from '../story';
import { storyFor } from '../stories';

export const SCENE_SECONDS = { tractor: 8, duel: 10, swing: 4, escape: 8, arrive2: 8, tower: 6, throw: 6, mask: 10, emperor: 10, cruiser: 6, escape2: 8 };
// what each hero comes with: Han his own pistol; Luke and Leia a trooper’s rifle as they had it
// aboard; Obi-Wan a blade; a trooper his rifle; Luke on the second station his father’s keeping
const HERO_GUNS = { luke: 'e11', han: 'dl44', leia: 'e11', obiwan: null, stormtrooper: 'e11', dstrooper: 'e11' };
const BLADES = { obiwan: 'blue' };
const SPREAD = 1.1; // metres between people spawned together at one spot

const named = (who) => WHO[who] ?? CAST[who]?.name ?? who;

export function setHero(g, kind) {
  const you = g.you;
  you.hero = kind;
  you.gun = g.items?.has('saber') && kind === 'luke' && g.station === 'ds2' ? null : (HERO_GUNS[kind] ?? null);
  you.blade = BLADES[kind] ?? (g.items?.has('saber') ? 'green' : null);
  if (kind === 'stormtrooper' || kind === 'dstrooper') you.armour = you.helmet = true;
}

const roleOf = (role, spot, script, to) => {
  if (role === 'follow') return { type: 'follow', who: 'you' };
  if (role === 'lead') return { type: 'lead', spot: to, who: 'you' };
  if (role === 'scripted' || script) return { type: 'scripted' };
  if (role === 'patrol') return { type: 'patrol', spots: [spot] };
  if (role === 'work') return { type: 'work', spot };
  if (role === 'droid') return { type: 'droid' };
  return { type: 'post', spot };
};

export function spawnOne(g, { kind, spot, tag = null, role = 'post', squad = null, hostile = null, script = null, to = null }, n = 0) {
  const at = g.layout.station.spots?.[spot] ?? (g.layout.rooms.has(spot) ? { room: spot, x: g.layout.rooms.get(spot).x, z: g.layout.rooms.get(spot).z, yaw: 0 } : null);
  if (!at || !CAST[kind]) return null;
  const side = n === 0 ? 0 : (n % 2 ? 1 : -1) * Math.ceil(n / 2) * SPREAD;
  const yaw = at.yaw ?? 0;
  const [x, z] = [at.x + Math.cos(yaw) * side, at.z + Math.sin(yaw) * side];
  g.serial = (g.serial ?? 0) + 1;
  const id = `${tag ?? kind}-${g.serial}`;
  return addPerson(g.crew, { id, kind, room: at.room, x, z, yaw, role: roleOf(role, g.layout.station.spots?.[spot] ? spot : null, script, to), squad, hostile, script, tag });
}

function despawn(g, tag) {
  for (const p of [...g.crew.people]) if (p.tag === tag) removePerson(g.crew, p.id);
}

// Those who walk with you, by kind: spawned at your side to follow you, or let go where they stand.
function companion(g, kind, follow) {
  const have = g.crew.people.find((p) => p.tag === `with:${kind}`);
  if (!follow) {
    if (have) removePerson(g.crew, have.id);
    return;
  }
  if (have || !CAST[kind]) return;
  const you = g.you;
  const at = besideYou(g) ?? { x: you.x, z: you.z };
  addPerson(g.crew, { id: `with-${kind}`, kind, room: you.room, x: at.x, z: at.z, yaw: you.yaw, role: { type: 'follow', who: 'you' }, hostile: false, tag: `with:${kind}` });
}

// Free floor beside you for someone to stand on: rings out from your back and
// sides (in front is where you look), each place on your room's floor at your
// level, clear of the room's walls and furniture and a body's width from
// anyone there already. Null when the room has no such place.
const RINGS = [1.1, 1.7, 2.3, 2.9];
const AROUND = 14; // places tried on a ring
const CLEAR = 0.42; // metres a place keeps from a wall or a solid
const APART = 0.7; // metres a place keeps from anyone standing there
// whether a body may stand at x, z in your room: its floor at your level, clear of its walls and solids
function standsBy(g, x, z, solids, clear = CLEAR) {
  const you = g.you;
  const room = g.layout.rooms.get(you.room);
  if (!room) return false;
  const floor = g.layout.floorAt(you.room, x, z);
  if (floor === null || Math.abs(floor - you.y) > 0.3) return false;
  const box = room.box;
  if (box && (x < box.x0 + clear || x > box.x1 - clear || z < box.z0 + clear || z > box.z1 - clear)) return false;
  if (room.round && Math.hypot(x - room.x, z - room.z) > room.w / 2 - clear) return false;
  return !solids.some((s) => (s.box ? x > s.box.x0 - clear && x < s.box.x1 + clear && z > s.box.z0 - clear && z < s.box.z1 + clear : s.circle && Math.hypot(x - s.circle.x, z - s.circle.z) < s.circle.r + clear));
}

function besideYou(g) {
  const you = g.you;
  if (!g.layout.rooms.get(you.room)) return null;
  const solids = g.solidsOf?.(you.room) ?? [];
  const others = [you, ...g.crew.people.filter((p) => p.room === you.room && p.mode !== 'dead')];
  for (const r of RINGS) {
    for (let i = 0; i < AROUND; i++) {
      // from straight behind, out to either side in turn, and round to the front last
      const turn = Math.PI + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * ((2 * Math.PI) / AROUND);
      const a = you.yaw + turn;
      const x = you.x + Math.sin(a) * r;
      const z = you.z - Math.cos(a) * r;
      if (!standsBy(g, x, z, solids)) continue;
      if (others.some((o) => Math.hypot(o.x - x, o.z - z) < APART)) continue;
      return { x, z };
    }
  }
  return null;
}

// Those who walk with you, put where you are put (across the chasm with you, down the chute after
// you), each on free floor beside you, their old way forgotten
export function bringAlong(g) {
  for (const p of g.crew.people) {
    if (!p.tag?.startsWith('with:') || p.hp <= 0) continue;
    const at = besideYou(g) ?? { x: g.you.x, z: g.you.z };
    Object.assign(p, { x: at.x, y: g.you.y, z: at.z, room: g.you.room, vy: 0 });
    Object.assign(p.safe, { x: p.x, y: p.y, z: p.z, room: p.room });
    if (p.mind) p.mind.legs = legsOf(p);
  }
}

// Your father held up through the carry (the flag `carrying`): the one walking
// with you under `with:vader` is kept at your left side (clear of the camera
// over your right shoulder), his arm over your shoulders, facing as you face
// and limping as you walk (at your right where your left is wall, and else
// right on you); `held` says which side he leans from, for the figure to lean
// in to you (-1 your left, 1 your right). Called after the crew's step, so his
// own legs never take him from you; you walk with him, never run, jump or
// crouch (held).
const HOLD = 0.55; // metres from your middle to his
const HOLD_CLEAR = 0.25; // metres he keeps from a wall
function heldUp(g) {
  return g.flags?.has('carrying') ? (g.crew.people.find((p) => p.tag === 'with:vader' && p.hp > 0) ?? null) : null;
}

export function holdUp(g, moved) {
  const p = heldUp(g);
  for (const q of g.crew.people) if (q.held && q !== p) q.held = 0;
  if (!p) return;
  const you = g.you;
  const solids = g.solidsOf?.(you.room) ?? [];
  const [c, s] = [Math.cos(you.yaw), Math.sin(you.yaw)];
  const side = [-1, 1].find((k) => standsBy(g, you.x + c * HOLD * k, you.z + s * HOLD * k, solids, HOLD_CLEAR)) ?? 0;
  Object.assign(p, { x: you.x + c * HOLD * side, z: you.z + s * HOLD * side, y: you.y, room: you.room, yaw: you.yaw, vy: 0, held: side });
  p.anim = moved > 0.01 ? 'limp' : 'idle';
}

// the walk asked of you, while you hold him up: no run, no jump, no crouch
export const held = (g, walk) => (heldUp(g) ? { ...walk, run: false, jump: false, crouch: false } : walk);

function restore(g, cp) {
  if (!cp) return;
  for (const p of [...g.crew.people]) if (p.tag?.startsWith('with:')) removePerson(g.crew, p.id);
  g.flags = new Set([...(g.keep ?? []), ...cp.flags]);
  g.items = new Set(cp.items ?? []);
  if (cp.spot) g.teleport(cp.spot);
  setHero(g, cp.hero);
  if (cp.gun !== undefined) g.you.gun = cp.gun;
  g.you.armour = Boolean(cp.armour);
  g.you.helmet = Boolean(cp.helmet);
  g.you.hp = g.you.max ?? 100;
  g.doubt = FRESH;
  for (const kind of cp.companions ?? []) companion(g, kind, true);
}

function apply(g, e) {
  const tell = (event) => g.events.push(event);
  if ('flag' in e) g.flags.add(e.flag);
  else if ('unflag' in e) g.flags.delete(e.unflag);
  else if ('unlock' in e) {
    if (g.doors[e.unlock]) g.doors[e.unlock].locked = false;
  } else if ('lock' in e) {
    if (g.doors[e.lock]) Object.assign(g.doors[e.lock], { locked: true, want: false });
  } else if ('spawn' in e) spawnOne(g, e.spawn, g.crew.people.filter((p) => p.tag && p.tag === e.spawn.tag).length);
  else if ('despawn' in e) despawn(g, e.despawn);
  else if ('alarm' in e) raise(g.alarm, e.alarm.section, e.alarm.how, { x: g.you.x, y: g.you.y, z: g.you.z }, g.time);
  else if ('say' in e) {
    tell({ type: 'say', who: e.say.who, name: named(e.say.who), text: e.say.text });
    if (e.say.line) tell({ type: 'heard', line: e.say.line });
  } else if ('intercom' in e) {
    tell({ type: 'say', who: 'intercom', name: 'Intercom', text: e.intercom.text });
    if (e.intercom.line) tell({ type: 'heard', line: e.intercom.line });
  } else if ('scene' in e) {
    g.scene = { id: e.scene, t: 0 };
    tell({ type: 'scene', id: e.scene });
  } else if ('hero' in e) setHero(g, e.hero);
  else if ('give' in e) give(g, e.give);
  else if ('take' in e) take(g, e.take);
  else if ('companion' in e) companion(g, e.companion, e.follow !== false);
  else if ('to' in e) {
    g.teleport(e.to);
    bringAlong(g);
  }
  else if ('achievement' in e) tell({ type: 'achievement', id: e.achievement });
  else if ('music' in e) tell({ type: 'music', mood: e.music });
  else if ('walls' in e) (e.walls === 'close' ? g.flags.add('walls-closing') : g.flags.delete('walls-closing'));
  else if ('bridge' in e) (e.bridge ? g.flags.add('bridge') : g.flags.delete('bridge'));
  else if ('end' in e) {
    if (g.plot) g.plot.done = true;
    tell({ type: 'storyEnd', id: g.plot?.story.id });
  } else if ('checkpoint' in e) restore(g, e.checkpoint);
}

function give(g, item) {
  const you = g.you;
  if (item === 'armour') {
    you.armour = true;
    g.doubt = FRESH;
    g.events.push({ type: 'took', item: g.flags.has('tk421') ? 'tk421-armour' : 'armour' });
  } else if (item === 'helmet') you.helmet = true;
  else if (item.startsWith('gun:')) you.gun = item.slice(4);
  else {
    g.items.add(item);
    if (item === 'saber') you.blade = you.hero === 'obiwan' ? 'blue' : 'green';
  }
}

function take(g, item) {
  const you = g.you;
  if (item === 'armour') you.armour = you.helmet = false;
  else if (item === 'helmet') you.helmet = false;
  else if (item.startsWith('gun:')) you.gun = null;
  else {
    g.items.delete(item);
    if (item === 'saber' && you.hero !== 'obiwan') you.blade = null;
  }
}

const applyAll = (g, effects) => {
  for (const e of effects ?? []) apply(g, e);
};

export const storySteps = (g) => (g.mode === 'story' ? (storyFor(g.station, g.side)?.steps ?? []) : []);

export function startPlot(g, at = null) {
  g.items ??= new Set();
  const story = g.mode === 'story' ? storyFor(g.station, g.side) : null;
  if (!story) {
    g.plot = null;
    return;
  }
  const { progress, effects } = startStory(story, at);
  g.plot = { story, progress, done: false };
  // (a story begun again drops whatever scene or talk was going before)
  g.scene = null;
  g.talk = null;
  // the story starts from its beat’s checkpoint: where you stand, who you are and who is with you
  restore(g, checkpointOf(story, progress));
  applyAll(g, effects.filter((e) => !('checkpoint' in e)));
}

export function feedPlot(g, event) {
  if (!g.plot || g.plot.done) return;
  const { progress, effects } = storyStep(g.plot.progress, g.plot.story, event);
  g.plot.progress = progress;
  applyAll(g, effects);
}

export function stepPlot(g, dt) {
  if (g.scene) {
    g.scene.t += dt;
    if (g.scene.t >= (SCENE_SECONDS[g.scene.id] ?? 6)) {
      const id = g.scene.id;
      g.scene = null;
      feedPlot(g, { type: 'sceneDone', id });
    }
  }
  feedPlot(g, { type: 'tick', dt });
}
