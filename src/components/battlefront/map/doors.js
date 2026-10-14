// Galactic Assault's doors, gates and state props as the game runs them
// (bf2-re findings/58), from the mode part's mode.json (scripts/bf2017-
// level-mode.mjs: the FantasyBattle sub-world's records). Pure: no three, no
// physics; map/doorsScene.js draws and moves what this says.
//
// A door is PF_AutomaticDoor_Controller (its own record, mode.json's
// `controller`): a FloatInterpolator (Sine, EaseOut; the door's duration,
// which the door prefab and the level set) whose In is 1 while one of its
// GeometryTriggers has someone inside the door's box, or while the door has
// been opened by an OpenDoor event, and 0 after a CloseDoor; the trigger the
// door's team turns on: no team (TeamNeutral) any soldier (ATAll), a team its
// own soldiers only (ATAllies of Team1 or Team2), both teams either. An
// OpenDoor holds it open and its triggers off; a CloseDoor holds it shut.
// Each leaf is moved from where it stands along its own axis by the door's
// slide, times the interpolator's output (the controller's TransformBlend).
// On a new In the interpolator runs from where it is to In over the whole
// duration, the curve over the time (FloatInterpolatorEntity's setter at
// 0x1417f9200 takes the duration as is, UseVelocity off; the Sine curve's
// ease-in is 1 − cos(tπ/2), the game's own at 0x14820bd60, its EaseOut
// 1 − f(1 − t) = sin(tπ/2)).
//
// The hangar gates are the same controller over 70 s; when one opens is the
// main session's (lib/battlefront/gates.js: its walker at the end of its
// route, the panel held 1 s); here `gates` is Galactic Assault's view of
// them ([{ id, state, open }], `open` gates.js's eased run, the leaves'
// place) or a map, `gates[id]` { open } (0 or 1, the controller's In) or
// { fraction } (the leaves' place as given).
//
// The level's graph (mode.json's `logic`, run by lib/battlefront/spawnLogic.js
// and fed as Galactic Assault feeds its spawn graph) says when the base doors
// are opened (OpenDoor 10 s and 15 s after both hangars fall), the pickups' Enabled,
// each gate's leaves' Enabled (off: blown, a second after a walker reaches the end of its route by it; the other gate's panel is the one unlocked) and its
// ruin's IsDestroyed; the page fires its waypoint and route nodes from the
// walkers.
//
//   EASE[curve][mode](t) → 0…1;  interpolator({ duration, curve, mode, value }) → ip
//   retarget(ip, to); advance(ip, dt)
//   inBox(box, p, height) → bool  (box: { at, half, rotation }, in the pack's frame)
//   createDoors(mode, { origin }) → state
//   stepDoors(state, dt, { soldiers: [{ at, team, side, alive }], ga, gates, opened })
//     (gates: [{ id, state, open }] or { [id]: { open } | { fraction } })
//     (soldiers in the export's frame; ga: the sim's Galactic Assault state, its stage and
//      objectives; opened: the gate ids whose panel was used, gates.js's)
//   arrive(state, path): a walker at the end of its route (the graph's route node fired, once);
//   destroy(state, spawner, down = true): a vehicle spawner's vehicle down (its wreck shows) or back
//   leafAt(leaf, k) → [x, y, z]; doorFraction(state, id) → 0…1
//   shown(state, prop, part) → bool: a prop's part drawn now
//   controlled(mode) → [{ mesh, at, kind, id, leaf?, prop?, part? }]: the instances this moves or switches

import { createLogic, enabled, fireEvent, setStage, tick as tickLogic } from '../../../lib/battlefront/spawnLogic.js';
import { feed, passedOf } from '../../../lib/battlefront/modes/galacticAssault.js';

const HALF_PI = Math.PI / 2;
const base = {
  Linear: (t) => t,
  Sine: (t) => 1 - Math.cos(t * HALF_PI),
  Quad: (t) => t * t,
  Cubic: (t) => t * t * t,
};
const modes = (f) => ({
  EaseIn: f,
  EaseOut: (t) => 1 - f(1 - t),
  EaseInOut: (t) => (t < 0.5 ? f(2 * t) / 2 : 1 - f(2 - 2 * t) / 2),
  EaseOutIn: (t) => (t < 0.5 ? (1 - f(1 - 2 * t)) / 2 : 0.5 + f(2 * t - 1) / 2),
});
export const EASE = Object.fromEntries(Object.entries(base).map(([k, f]) => [k, modes(f)]));

export function interpolator({ duration = 1.5, curve = 'Sine', mode = 'EaseOut', value = 0 } = {}) {
  return { value, from: value, to: value, t: 0, duration, ease: (EASE[curve] ?? EASE.Sine)[mode] ?? EASE.Sine.EaseOut };
}

export function retarget(ip, to) {
  if (to === ip.to) return;
  ip.from = ip.value;
  ip.to = to;
  ip.t = 0;
}

export function advance(ip, dt) {
  if (ip.value === ip.to) return;
  ip.t = Math.min(ip.duration, ip.t + dt);
  ip.value = ip.duration > 1e-6 && ip.t < ip.duration ? ip.from + (ip.to - ip.from) * ip.ease(ip.t / ip.duration) : ip.to;
}

// a point in a turned box: p less the middle, turned back by the box's rotation, inside its halves;
// `height` (a soldier's): the soldier's feet to its head may cross the box's floor or roof
export function inBox(box, p, height = 0) {
  const [qx, qy, qz, qw] = box.rotation ?? [0, 0, 0, 1];
  const v = [p[0] - box.at[0], p[1] - box.at[1], p[2] - box.at[2]];
  // (the conjugate's turn: v + 2w(−q×v) + 2(−q)×(−q×v))
  const cx = -qx;
  const cy = -qy;
  const cz = -qz;
  const tx = 2 * (cy * v[2] - cz * v[1]);
  const ty = 2 * (cz * v[0] - cx * v[2]);
  const tz = 2 * (cx * v[1] - cy * v[0]);
  const l = [v[0] + qw * tx + (cy * tz - cz * ty), v[1] + qw * ty + (cz * tx - cx * tz), v[2] + qw * tz + (cx * ty - cy * tx)];
  const [hx, hy, hz] = box.half;
  return Math.abs(l[0]) <= hx && Math.abs(l[2]) <= hz && l[1] + height >= -hy && l[1] <= hy;
}

// a soldier's height for the triggers (m: feet to the top of its head; by hand, a stand's capsule)
export const SOLDIER_HEIGHT = 1.8;

// the instances the mode part's scene must not draw as still mode art (map/doorsTable.js splits them out)
export function controlled(mode) {
  const out = [];
  for (const d of [...(mode.doors ?? []), ...(mode.gates ?? [])]) for (const leaf of d.leaves) if (leaf.mesh) out.push({ mesh: leaf.mesh, at: leaf.at, kind: 'leaf', id: d.id, leaf });
  for (const p of mode.props ?? [])
    for (const part of p.parts) {
      if (still(p, part)) continue;
      for (const i of part.instances) out.push({ mesh: i.mesh, at: i.at, kind: 'prop', id: p.id, prop: p, part });
    }
  return out;
}

// a part nothing switches: it stands as the mode's art
function still(prop, part) {
  const s = part.switch ?? {};
  if (s.never || prop.kind === 'walker') return false;
  return Boolean(s.always || (s.start === true && prop.kind === 'static'));
}

// the fields and events mode.json's graph keys them by (djb2-xor hashes: PF_InteractGate_Hoth_01's
// leaves' Enabled, PF_Hoth_Destruction_Gate's IsDestroyed, the door prefabs' OpenDoor and CloseDoor)
const LEAVES_ENABLED = -1756439259;
const IS_DESTROYED = -580568228;
const OPEN = -2137689625;
const CLOSE = 632505285;

export function createDoors(mode, { origin = [0, 0, 0] } = {}) {
  const c = mode.controller ?? {};
  const mk = (d) => ({ def: d, ip: interpolator({ duration: d.duration ?? c.duration ?? 1.5, curve: c.curve ?? 'Sine', mode: c.mode ?? 'EaseOut' }), forced: null });
  const logic = mode.logic ? { spec: mode.logic, vm: createLogic(mode.logic, { stage: 1 }), lead: {} } : null;
  return {
    mode,
    origin,
    doors: (mode.doors ?? []).map(mk),
    gates: (mode.gates ?? []).map(mk),
    logic,
    stage: 0,
    seen: 0, // (how much of the graph's fired list has been read)
    passed: {}, // waypoint node → fired
    routes: {}, // route node → fired
    destroyed: new Set(), // the vehicle spawners whose vehicle is down (none the site destroys yet)
  };
}

// the door's interpolator's In, by the controller's ConditionalFloat (findings/58 §2)
function doorTarget(door, soldiers) {
  if (door.forced === 'open') return 1;
  if (door.forced === 'closed') return 0;
  const d = door.def;
  if (!d.trigger) return 0;
  const allowed = (team) => (d.bothTeams ? team === 1 || team === 2 : d.team ? team === d.team : true);
  return soldiers.some((s) => s.alive !== false && allowed(s.team) && inBox(d.trigger, s.at, SOLDIER_HEIGHT)) ? 1 : 0;
}

// the walkers' progress into the graph's waypoint and route nodes (each fires once a round)
function walkers(state, ga) {
  const L = state.logic;
  if (!L || !ga) return;
  for (const [id, n] of Object.entries(L.spec.nodes)) {
    if (n.type !== 'waypoint' && n.type !== 'route') continue;
    const done = n.type === 'waypoint' ? state.passed : state.routes;
    if (done[id]) continue;
    const o = ga.objectives?.find((x) => x.type === 'escort' && x.def?.waypoints === n.path);
    if (!o) continue;
    const hit = n.type === 'waypoint' ? o.walker.alive && n.at >= 0 && passedOf(o.path, o.walker.dist) >= n.at : o.walker.alive && o.walker.dist >= o.walker.length - 1e-6;
    if (!hit) continue;
    done[id] = true;
    fireEvent(L.vm, `${id}.${n.out}`);
  }
}

export function arrive(state, path) {
  const L = state.logic;
  if (!L) return;
  for (const [id, n] of Object.entries(L.spec.nodes)) {
    if (n.type !== 'route' || n.path !== path || state.routes[id]) continue;
    state.routes[id] = true;
    fireEvent(L.vm, `${id}.${n.out}`);
  }
}

export function destroy(state, spawner, down = true) {
  if (down) state.destroyed.add(spawner);
  else state.destroyed.delete(spawner);
}

// the events the graph fired since the last look: the doors' OpenDoor and CloseDoor
function forced(state) {
  const L = state.logic;
  if (!L) return;
  const fired = L.vm.fired;
  const fires = L.spec.fires ?? {};
  for (; state.seen < fired.length; state.seen++) {
    const ref = fired[state.seen];
    for (const [to, from] of Object.entries(fires)) {
      if (!from.includes(ref)) continue;
      const [id, ev] = [to.slice(0, to.lastIndexOf('.')), Number(to.slice(to.lastIndexOf('.') + 1))];
      const door = state.doors.find((d) => d.def.id === id);
      if (door) door.forced = ev === OPEN ? 'open' : ev === CLOSE ? 'closed' : door.forced;
    }
  }
}

// lib/battlefront/gates.js's gates as Galactic Assault's view lists them ([{ id, state, open }]: open
// its eased run) into the doors' own: each one's leaves' place, and those whose panel was used
// (fired into the graph once, as the game's `opened` port: it bars nothing here, the walkers did)
function gatesIn(state, gates) {
  if (!Array.isArray(gates)) return { map: gates ?? {}, opened: [] };
  const map = {};
  const opened = [];
  state.used ??= new Set();
  for (const g of gates) {
    map[g.id] = { fraction: g.open ?? 0 };
    if ((g.state === 'opening' || g.state === 'open') && !state.used.has(g.id)) {
      state.used.add(g.id);
      opened.push(g.id);
    }
  }
  return { map, opened };
}

export function stepDoors(state, dt, { soldiers = [], ga = null, gates: given = {}, opened: told = [] } = {}) {
  const { map: gates, opened: used } = gatesIn(state, given);
  const opened = [...told, ...used];
  const [ox, oy, oz] = state.origin;
  const here = soldiers.map((s) => ({ ...s, at: [s.at[0] - ox, s.at[1] - oy, s.at[2] - oz] }));
  const L = state.logic;
  if (L && ga) {
    // (the graph's stage, as Galactic Assault's own: 1 from the stage's start, the next at each advance)
    const stage = ga.phase === 'setup' ? 0 : ga.stage + 1;
    if (stage !== state.stage && stage > 0) setStage(L.vm, stage);
    state.stage = stage;
    for (const id of opened) if (L.spec.nodes[id]?.roles) for (const [port, r] of Object.entries(L.spec.nodes[id].roles)) if (r?.role === 'opened') fireEvent(L.vm, `${id}.${port}`);
    walkers(state, ga);
    tickLogic(L.vm, dt);
    // (the capture points' owners, the escort's lead, the charges and the triggers, as the spawn graph is fed)
    feed({ ...ga, logic: L }, soldiers);
  }
  state.ga = ga;
  forced(state);
  for (const door of state.doors) {
    retarget(door.ip, doorTarget(door, here));
    advance(door.ip, dt);
  }
  for (const gate of state.gates) {
    const g = gates[gate.def.id] ?? {};
    if (typeof g.fraction === 'number') {
      gate.ip.value = gate.ip.to = Math.max(0, Math.min(1, g.fraction));
      continue;
    }
    retarget(gate.ip, g.open ? 1 : 0);
    advance(gate.ip, dt);
  }
  return state;
}

export const leafAt = (leaf, k) => [leaf.at[0] + leaf.slide[0] * k, leaf.at[1] + leaf.slide[1] * k, leaf.at[2] + leaf.slide[2] * k];
export const doorFraction = (state, id) => (state.doors.find((d) => d.def.id === id) ?? state.gates.find((d) => d.def.id === id))?.ip.value ?? 0;

// a gate's leaves stand until the graph blows the gate (its walker, home first, arrived at it)
export function gateStands(state, id) {
  const L = state.logic;
  const key = `${id}.${LEAVES_ENABLED}`;
  if (!L || !L.spec.enables[key]) return true;
  return enabled(L.vm, key) !== false;
}

export function shown(state, prop, part) {
  if (still(prop, part)) return true;
  const s = part.switch ?? {};
  if (s.never || prop.kind === 'walker') return false;
  const L = state.logic;
  switch (prop.kind) {
    case 'wreck':
      return state.destroyed.has(prop.id);
    case 'gateRuin':
      return Boolean(L && enabled(L.vm, `${prop.id}.${IS_DESTROYED}`));
    case 'pickup':
      // (the HH-12 while the pickup is enabled: the level graph's, else the placement's own constant)
      return L && L.spec.enables[prop.id] ? Boolean(enabled(L.vm, prop.id)) : prop.enabled === true;
    case 'charge': {
      const o = state.ga?.objectives?.find((x) => x.type === 'arm' && x.def?.prefab === prop.id);
      return Boolean(o?.armed && !o.done);
    }
    default:
      return s.start === true;
  }
}
