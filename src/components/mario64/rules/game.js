// The game: which area Mario is in, the castle and its courses, and the
// moments between play (the title, a course's card, a dialog, a star got,
// a death, game over). One step is one frame at 30 a second; tick() runs as
// many as the time passed needs, never more than four for one frame, and
// keeps a press made on a frame with no step for the next one. What
// happened goes onto g.out for the page (sounds, the HUD, dialogs); g.out
// is the module's to empty.
//
// newGame({ save, lives }) → g; stepGame(g, inp); tick(g, dt, inp) → steps;
// drain(g) → the events since the last drain; enterArea(g, id, entry);
// enterCourse(g, id); exitCourse(g).

import { AREAS, COURSE, buildArea } from '../courses/index';
import { interact, pressB, spawn, stepActors } from './actors/index';
import { camYaw, newCam, stepCam } from './camera';
import { rest } from './collide';
import { START_LIVES, newMario, setAction, stepMario } from './mario';
import { blank, giveStar, hasStar, starTotal } from './save';

const STEP_DT = 1 / 30;
export const MAX_STEPS = 4;
const STARGET_FRAMES = 90;
const DEAD_FRAMES = 75;
const PRESSES = ['ap', 'bp', 'zp', 'start', 'zoomp', 'camL', 'camR'];

export function newGame({ save = blank(), lives = START_LIVES } = {}) {
  const g = { mode: 'title', save, lives, out: [], cursor: 0, dialogs: [], t: 0, acc: 0, alpha: 0, timer: 0, press: {}, card: null, got: null, saveDirty: false };
  g.spawn = (def) => spawn(g, def);
  enterArea(g, 'grounds', 'start');
  return g;
}

const tell = (g, type, data) => g.out.push(data ? { type, ...data } : { type });
function setMode(g, mode) {
  if (g.mode === mode) return;
  g.mode = mode;
  g.timer = 0;
  tell(g, 'mode', { mode });
}

export function enterArea(g, id, entry) {
  const { area, world } = buildArea(id);
  g.area = area;
  g.areaId = id;
  g.course = area.course;
  g.world = world;
  const e = area.entries[entry] ?? area.entries.main ?? area.entries.start ?? Object.values(area.entries)[0];
  g.entry = entry;
  g.mario = newMario(e);
  g.mario.lives = g.lives;
  g.cam = newCam(g.mario);
  g.actors = [];
  g.nextId = 1;
  g.visit = { coins: 0, reds: 0 };
  for (const def of area.actors) {
    const a = spawn(g, def);
    if (a.type === 'star') a.got = hasStar(g.save, g.course, a.index);
  }
  rest(world);
  tell(g, 'area', { id, course: g.course, name: area.name });
}

export function enterCourse(g, id) {
  const c = COURSE[id];
  if (!c?.live || !AREAS[c.area]) return false;
  enterArea(g, c.area, 'main');
  setMode(g, 'play');
  tell(g, 'course', { id, name: c.name });
  return true;
}

export function exitCourse(g) {
  const from = g.course;
  enterArea(g, 'castle', from ?? 'main');
  setMode(g, 'play');
}

const cardFor = (g, id) => {
  const c = COURSE[id];
  return { course: id, name: c?.name ?? id, live: Boolean(c?.live), stars: (c?.stars ?? []).map((name, i) => ({ name, got: hasStar(g.save, id, i) })) };
};

// the events since the last drain, for the page
export function drain(g) {
  const out = g.out;
  g.out = [];
  g.cursor = 0;
  return out;
}

// what new events change: stars, cards, warps, dialogs, deaths
function react(g) {
  while (g.cursor < g.out.length) {
    const e = g.out[g.cursor++];
    if (e.type === 'star' && g.mode === 'play') {
      const fresh = giveStar(g.save, g.course, e.index);
      g.saveDirty = true;
      g.got = { course: g.course, index: e.index, name: COURSE[g.course]?.stars[e.index] ?? 'Power Star', fresh };
      setMode(g, 'starget');
      setAction(g.mario, 'dance');
      g.mario.held = null;
      tell(g, 'starget', { ...g.got, total: starTotal(g.save) });
    } else if (e.type === 'card' && g.mode === 'play') {
      g.card = cardFor(g, e.course);
      g.cardFrom = g.actors.find((a) => a.type === 'painting' && a.def.course === e.course) ?? null;
      Object.assign(e, g.card);
      setMode(g, 'card');
    } else if (e.type === 'warp' && g.mode === 'play') {
      enterArea(g, e.area, e.entry);
    } else if ((e.type === 'dialog' || e.type === 'locked') && g.mode === 'play') {
      g.dialogs.push(e.type === 'locked' ? { title: 'Star door', text: `This door opens for ${e.need} ${e.need === 1 ? 'star' : 'stars'}. You have ${starTotal(g.save)}.` } : { title: e.title, text: e.text });
      setMode(g, 'dialog');
    } else if (e.type === 'dead' && g.mode === 'play') {
      setMode(g, 'dead');
    }
  }
}

// out of a painting's card without going in: back off the wall, falling
function backOut(g) {
  const p = g.cardFrom;
  const m = g.mario;
  if (p) {
    m.pos.x = p.pos.x + Math.sin(p.yaw) * 260;
    m.pos.z = p.pos.z + Math.cos(p.yaw) * 260;
    m.yaw = p.yaw;
  }
  m.vel.x = m.vel.z = 0;
  m.fwd = 0;
  m.airborne = true;
  setAction(m, 'freefall');
}

function respawn(g) {
  g.lives = Math.max(0, g.lives - 1);
  if (g.lives <= 0) {
    setMode(g, 'over');
    return;
  }
  const entry = g.course ? 'main' : g.entry;
  enterArea(g, g.areaId, entry);
  setMode(g, 'play');
}

export function stepGame(g, inp) {
  g.t++;
  g.timer++;
  const m = g.mario;
  const go = inp.ap || inp.start;
  // where everything was, for drawing between steps
  m.last = { x: m.pos.x, y: m.pos.y, z: m.pos.z, yaw: m.yaw };
  g.cam.last = { x: g.cam.pos.x, y: g.cam.pos.y, z: g.cam.pos.z, fx: g.cam.focus.x, fy: g.cam.focus.y, fz: g.cam.focus.z };
  for (const a of g.actors) a.last = { x: a.pos.x, y: a.pos.y, z: a.pos.z, yaw: a.yaw };
  // events not yet acted on (from outside the step, too)
  react(g);

  switch (g.mode) {
    case 'title':
      if (go) setMode(g, 'play');
      return;
    case 'pause':
      return;
    case 'dialog':
      if (g.timer > 2 && (inp.ap || inp.bp)) {
        g.dialogs.shift();
        if (!g.dialogs.length) setMode(g, 'play');
      }
      return;
    case 'card':
      if (g.timer >= 1 && go) {
        if (g.card?.live) enterCourse(g, g.card.course);
        else {
          backOut(g);
          setMode(g, 'play');
        }
      } else if (g.timer >= 1 && inp.bp) {
        backOut(g);
        setMode(g, 'play');
      }
      return;
    case 'starget':
      stepMario(m, { sx: 0, sy: 0, camYaw: camYaw(g.cam) }, g.world);
      if (g.timer > STARGET_FRAMES) exitCourse(g);
      return;
    case 'dead':
      if (g.timer > DEAD_FRAMES) respawn(g);
      return;
    case 'over':
      if (g.timer > 2 && go) {
        g.lives = START_LIVES;
        enterArea(g, 'grounds', 'start');
        setMode(g, 'title');
      }
      return;
    default:
      break;
  }

  // play
  const i = { ...inp, camYaw: camYaw(g.cam) };
  if (i.bp && pressB(g)) i.bp = false;
  const mine = stepMario(m, i, g.world);
  const seen = mine.length;
  for (const e of mine) g.out.push({ ...e, by: 'mario' });
  rest(g.world);
  stepActors(g);
  interact(g);
  // what the others did to him (a hurt, a death) comes out too
  for (let k = seen; k < m.events.length; k++) g.out.push({ ...m.events[k], by: 'mario' });
  stepCam(g.cam, m, { turn: (inp.camR ? 1 : 0) - (inp.camL ? 1 : 0), drag: inp.camDrag ?? 0, stick: inp.camStick ?? 0, zoomPress: Boolean(inp.zoomp) }, g.world);
  g.lives = m.lives;
  react(g);
}

// Runs the steps the time passed needs (at most MAX_STEPS; the rest is
// dropped, so a hidden tab coming back doesn't run away); presses wait for
// the next step that runs.
export function tick(g, dt, inp) {
  for (const k of PRESSES) if (inp[k]) g.press[k] = true;
  g.acc += Math.max(0, Math.min(dt, 1));
  let n = 0;
  while (g.acc >= STEP_DT && n < MAX_STEPS) {
    stepGame(g, n === 0 ? { ...inp, ...g.press } : { ...inp, ...Object.fromEntries(PRESSES.map((k) => [k, false])) });
    if (n === 0) g.press = {};
    g.acc -= STEP_DT;
    n++;
  }
  if (n === MAX_STEPS && g.acc > STEP_DT) g.acc = 0;
  g.alpha = Math.min(1, g.acc / STEP_DT);
  return n;
}
