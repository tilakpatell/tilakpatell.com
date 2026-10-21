// The Guardians' hall and their cavalry, as the world runs them a frame
// (./InvWorld.jsx calls these; the rules are ./hallRules.js and
// ./guardians.js, the drawing ./hall.js and ./cavalryScene.js): going in at
// the plaza's door and out again, his step in the room, what E does and who
// is near in it, and a big fight's call for two of them, their blows for
// ./foes.js and the word each arrives with. No three, no react.

import { stepHero } from './flight';
import { HALL, PLINTHS, atDoor, clampToRoom, enterHall, leaveHall, meet, nearBoard, nearDoor, nearPlinth } from './hallRules';
import { GUARDIANS, bigFight, callCavalry, guardianOf, pick, stepCavalry } from './guardians';
import { GUARDIAN_LINES } from './lines';
import { KINDS, standing } from './foes';
import { caughtBy } from './quests';
import { sfx } from './events';

// an empty world for his step inside: nothing to hit but the floor
const ROOM = { grid: new Map(), stamp: new Uint32Array(0), visit: { n: 0 }, boxes: [], buildings: [], houses: [], places: [] };
const DOOR3 = [HALL.door[0], 0, HALL.door[1]];

export const inHall = (s) => s.h.zone === 'hall';
// at the hall's door outside, on the ground: E goes in
export const atHallDoor = (s) => !inHall(s) && s.h.zone !== 'space' && atDoor(s.h.p);

export function goIn(s) {
  const r = enterHall(s.h);
  s.h = r.h;
  s.inside = r.inside;
}
export function goOut(s) {
  s.h = leaveHall(s.h);
  s.inside = null;
}
// his step in the room: the flight's own on an empty world, then the walls
// and the dome (a clamp stops him there)
export function stepInside(s, input, dt, flight) {
  const h = stepHero(s.h, input, dt, ROOM, flight);
  const p = clampToRoom(h.p);
  return p === h.p ? h : { ...h, p, v: [0, 0, 0], spd: 0 };
}
// what E does in the room: 'leave' at the door, 'board' at Cecil's, { plinth } at one of the eight, or nothing
export function hallAct(s) {
  const p = s.h.p;
  if (nearDoor(p)) return 'leave';
  const i = nearPlinth(p);
  if (i >= 0) return { plinth: i };
  if (nearBoard(p)) return 'board';
  return null;
}
// the prompt in the room: the door, the board, or one of the eight by name
export function hallNear(s) {
  const w = hallAct(s);
  if (w === 'leave') return { id: 'hall-door', name: 'Leave · the plaza' };
  if (w === 'board') return { id: 'hall-board', name: 'Cecil’s board' };
  if (w?.plinth != null) return { id: `hall-${GUARDIANS[w.plinth].id}`, name: GUARDIANS[w.plinth].name };
  return null;
}
// E at a plinth: the one there answers (the eight met once is the achievement)
export function hallTalk(s, i, { say, unlock }) {
  const g = GUARDIANS[i];
  const r = meet(s.inside, i);
  s.inside = r.inside;
  const n = (s.inside.said ??= {});
  n[g.id] = ((n[g.id] ?? -1) + 1) % GUARDIAN_LINES[g.id].length;
  sfx('ding');
  say(GUARDIAN_LINES[g.id][n[g.id]], 3600, g.id);
  if (r.all) unlock('guardians');
}
// who is near enough to talk in the room: the eight on their plinths
export function hallTalkers(h) {
  const out = [];
  PLINTHS.forEach((p, i) => {
    const g = GUARDIANS[i];
    const d = Math.hypot(h.p[0] - p[0], h.p[2] - p[2]);
    if (d < HALL.talkR + 2) out.push({ id: `g-${g.id}`, role: g.id, name: g.name, lines: GUARDIAN_LINES[g.id], head: [p[0], HALL.plinthH + 1.6, p[2]], d });
  });
  return out.sort((a, b) => a.d - b.d);
}

// ── the cavalry ──

// A big fight's call, and the two stepped through it. Returns their blows
// for ./foes.js (`cavalry` in its input); says what else happened through
// `say` and pushes the rest onto `s.events` for the scene to draw.
export function stepCavalryWorld(s, dt, { say }) {
  const foes = standing(s.foes).map((e) => ({ id: e.id, kind: e.kind ?? 'flaxan', p: e.p, left: (KINDS[e.kind ?? 'flaxan']?.hits ?? 1) - (e.hits ?? 0), live: true }));
  const big = bigFight(foes, s.h.p, s.mission?.id ?? null);
  const q = s.quests;
  const falling = q.rescue && !q.rescue.carried && (q.rescue.source ?? 'city') === 'city' && q.rescue.phase === 'fall' ? q.rescue.p : null;
  // the people nearest the fight: a place's door within 40 m of a foe
  const place = big ? s.world.places.find((p) => foes.some((e) => Math.hypot(e.p[0] - p.door[0], e.p[2] - p.door[1]) < 40)) : null;
  const crowd = place ? [place.door[0], 0, place.door[1]] : null;
  if (big && !s.cavalry.on && !s.cavalryCalled) {
    s.cavalryCalled = true;
    const two = pick({ foes, falling: Boolean(falling), crowd: crowd ? 1 : 0 });
    s.cavalry = callCavalry(s.cavalry, two, DOOR3);
    sfx('alarm');
    say(`The Guardians: ${two.map((id) => guardianOf(id).name).join(' and ')}, on their way.`, 3200);
  }
  if (!big && !foes.length) s.cavalryCalled = false;
  if (!s.cavalry.on) return [];
  const r = stepCavalry(s.cavalry, { hero: s.h.p, fight: foes.length > 0 && s.foes.on && !foes.some((e) => e.kind === 'omniman'), foes, falling, crowd, home: DOOR3 }, dt);
  s.cavalry = r.cav;
  const blows = [];
  for (const e of r.ev) {
    if (e.type === 'arrive') {
      sfx('pop');
      say(GUARDIAN_LINES[e.who][0], 3000, e.who);
    } else if (e.type === 'gCatch') {
      s.quests = caughtBy(s.quests, e.who);
      say(`${guardianOf(e.who).name} has them. Fastest one here.`, 2800);
    } else if (e.type === 'gHit' || e.type === 'gHold' || e.type === 'gStagger' || e.type === 'gBlast') {
      const foe = foes.find((f) => f.id === e.foe);
      blows.push(foe ? { ...e, at: foe.p } : e);
    }
    s.events.push(e);
  }
  return blows;
}
