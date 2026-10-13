// Instant Action's bot logic: which command post an AutoPlayer is sent to.
// The game holds it as a logic graph, one instance a team
// (`Gameplay/GameModes/Mode8/Prefabs/Mode8_BotLogic_AttackObjectives`, 343
// nodes, wired into each Supremacy level by `PvE_BotLogic`). This is what of
// that graph can fire, read from the record's connections (NOTES.md, "The
// bot logic's graph"):
//
//   the posts    five slots, A to E. Every objective a bot is given is to
//                defend a slot: go to it (within the level's radius, 8 m)
//   a bot spawns the side's first post 20 in 100, its second 20, the side's
//                random pick 30, any of the five 30 (the split #267)
//   an orphan    the side's first post 25, its second 25, any of the five 50
//                (#262)
//   first, second the levels' own constants, the same on all thirteen: team
//                1's are A and B, team 2's D and E
//   may be gone to a post that is enabled, and the other side's or no one's,
//                or the side's own with the enemy on it (on after 2 s of it
//                being captured, off 5 s after), and not timed out. A choice
//                that may not be gone to is passed down the letters; past E,
//                any of the five. "Any of the five" checks nothing.
//   the random pick a post that may be gone to and is not the side's first
//                or second. With no progress on it past 0.2 for
//                CaptureProgress_SwitchCPTimer_Mode8 (120 s) it may not be
//                gone to for CaptureProgress_ResetTimer_Mode8 (180 s), and
//                another is picked
//   the orphans  called every TriggerOrphansTimer_Mode8 (60 s), counted from
//                half a second after the first spawn, and a second after a
//                post changes hands, that not again inside 20 s
//
// By hand: what an orphan is and whom the call orphans is the game's code,
// not the graph's (the sim sends every bot of the side through the orphan's
// split); the team numbers (none 0, team 1 and 2) and the progress's sign
// (toward team 1 positive), which the graph's thresholds imply; a random
// pick with no post to take keeps the one it had. The graph has no test of
// distance anywhere. Pure.
//
//   timersFor(gs) → { switchAfter, invalidFor, orphansEvery, …, sources }
//   createBotLogic({ team, rand, timers, priorities }) → logic
//   slots: [{ enabled, owner: 0 | 1 | 2, beingCaptured, progress }]  (A to E)
//   slotValid(logic, slots, i, now) → bool
//   pickSlot(logic, slots, now, 'spawn' | 'orphan') → the slot's index
//   stepBotLogic(logic, slots, now) → true when the orphans are called this step
//   captured(logic, now)          (a post changed hands)

// The splits' weights as the record holds them (RandomMultiEventEntityData.RandomEventWeight).
export const SPAWN = [20, 20, 30, 30];
export const ORPHAN = [25, 25, 50];
// Each team's first, second and third post, by slot: every level's constants (Team<n>_CP1..3).
export const PRIORITIES = { 1: [0, 1, 2], 2: [3, 4, 2] };
// Capture progress past this, toward the side, is progress (the graph's compare).
export const PROGRESS = 0.2;
// The enemy on a post: on after this long of it being captured, off this long after (the graph's delays), s.
export const ENEMIES_ON = 2;
export const ENEMIES_OFF = 5;
// The orphans' call: after the first spawn, after a capture, and its cool-down (the graph's stopwatches and gate), s.
export const ORPHANS_FIRST = 0.5;
export const AFTER_CAPTURE = 1;
export const CAPTURE_COOL_DOWN = 20;
// How near its post a bot is sent: every level's CapturePoint<slot>_Radius but one (Kamino's E, 2 m), m.
export const POST_RADIUS = 8;
const SLOTS = 5;

export function timersFor(gs) {
  const s = gs?.settings ?? gs ?? {};
  const sources = {};
  const get = (key, name, fallback) => {
    const has = name in s && s[name] !== null;
    sources[key] = has ? name : 'hand';
    return has ? s[name] : fallback;
  };
  return {
    switchAfter: get('switchAfter', 'CaptureProgress_SwitchCPTimer_Mode8', 120),
    invalidFor: get('invalidFor', 'CaptureProgress_ResetTimer_Mode8', 180),
    orphansEvery: get('orphansEvery', 'TriggerOrphansTimer_Mode8', 60),
    sources,
  };
}

export function createBotLogic({ team, rand = Math.random, timers = timersFor(null), priorities = PRIORITIES[team] }) {
  return {
    team,
    rand,
    timers,
    priorities,
    random: null, // the side's random pick, a slot
    watch: 0, // since when no progress on it
    invalidUntil: Array(SLOTS).fill(-Infinity),
    enemies: Array.from({ length: SLOTS }, () => ({ on: false, since: null })), // the debounced "enemy on it"
    orphansAt: Infinity, // the next timed call
    captureAt: Infinity, // the call a capture set
    coolUntil: -Infinity,
  };
}

export function slotValid(logic, slots, i, now) {
  const p = slots[i];
  if (!p?.enabled || now < logic.invalidUntil[i]) return false;
  return p.owner !== logic.team || logic.enemies[i].on;
}

const any = (logic) => Math.floor(logic.rand() * SLOTS) % SLOTS;

// a choice passed down the letters to the first post that may be gone to; past the last, any of the five
function chain(logic, slots, from, now) {
  for (let i = from; i < SLOTS; i++) if (slotValid(logic, slots, i, now)) return i;
  return any(logic);
}

// the side's random pick drawn again: a post that may be gone to and is neither its first nor its second
function reroll(logic, slots, now) {
  const [first, second] = logic.priorities;
  const open = [];
  for (let i = 0; i < SLOTS; i++) if (i !== first && i !== second && slotValid(logic, slots, i, now)) open.push(i);
  if (open.length) logic.random = open[Math.floor(logic.rand() * open.length) % open.length];
  else if (logic.random === null) logic.random = any(logic);
  logic.watch = now;
}

const weighted = (logic, weights) => {
  let r = logic.rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) < 0) return i;
  return weights.length - 1;
};

export function pickSlot(logic, slots, now, why = 'spawn') {
  const [first, second] = logic.priorities;
  if (why === 'spawn' && logic.orphansAt === Infinity) logic.orphansAt = now + ORPHANS_FIRST + logic.timers.orphansEvery;
  if (logic.random === null || !slotValid(logic, slots, logic.random, now)) reroll(logic, slots, now);
  const branch = weighted(logic, why === 'orphan' ? ORPHAN : SPAWN);
  if (branch === 0) return chain(logic, slots, first, now);
  if (branch === 1) return chain(logic, slots, second, now);
  if (why === 'spawn' && branch === 2) return chain(logic, slots, logic.random, now);
  return any(logic);
}

export function captured(logic, now) {
  if (now < logic.coolUntil || logic.captureAt !== Infinity) return;
  logic.captureAt = now + AFTER_CAPTURE;
  logic.coolUntil = now + CAPTURE_COOL_DOWN;
}

export function stepBotLogic(logic, slots, now) {
  // the enemy on a post, debounced
  for (let i = 0; i < SLOTS; i++) {
    const e = logic.enemies[i];
    const raw = !!slots[i]?.beingCaptured;
    if (raw === e.on) e.since = null;
    else {
      e.since ??= now;
      if (now - e.since + 1e-9 >= (raw ? ENEMIES_ON : ENEMIES_OFF)) [e.on, e.since] = [raw, null];
    }
  }
  // the random pick: kept while the side makes progress on it, left after too long with none
  if (logic.random === null || !slotValid(logic, slots, logic.random, now)) reroll(logic, slots, now);
  else {
    const p = slots[logic.random].progress ?? 0;
    if (logic.team === 1 ? p > PROGRESS : p < -PROGRESS) logic.watch = now;
    else if (now - logic.watch + 1e-9 >= logic.timers.switchAfter) {
      logic.invalidUntil[logic.random] = now + logic.timers.invalidFor;
      reroll(logic, slots, now);
    }
  }
  // the orphans' call: on its time, or a second after a capture (which starts the time again)
  let call = false;
  if (now + 1e-9 >= logic.captureAt) {
    logic.captureAt = Infinity;
    call = true;
  }
  if (now + 1e-9 >= logic.orphansAt) call = true;
  if (call) logic.orphansAt = now + logic.timers.orphansEvery;
  return call;
}
