// The Instant Action Overhaul V2's bot logic for command posts: a round may
// ask for it in place of the game's own (ai/botLogic.js). The mod empties the
// game's graph and puts a smaller one in its place (its rewritten
// `Addons/Mode1/Gameplay/PF_Bot_Logic` and the records under it, read from
// the mod's own files: NOTES.md, "The Overhaul's bot logic"). What it does:
//
//   a deal       objectives are not given a bot as it spawns: they are dealt
//                to every bot of both sides at once
//   when         8 s after the mode starts (and a tenth more), then every
//                25 s, and whenever a post changes hands; not more than once
//                in 5 s, what is asked meanwhile held to their end, once; a
//                tenth of a second after it is let through
//   the slots    a side's five slots are its near posts first: team 1's are
//                A B C D E, team 2's E D C B A
//   the table    a side's bots take, in order, X Y M M Y X M X Y F M M:
//                X  its slot 2 if that is not its own; else, by turns, its
//                   slot 4 or its slot 3 if that is not; else its slot 5
//                Y  its slot 1; else, by turns, slot 5 or slot 3; else slot 4
//                M  its slot 3; else, by turns, slot 5 (slot 4 if 5 is its
//                   own) or slot 4 (slot 5 if 4 is)
//                F  by turns its slot 5 or its slot 4, with no test
//                The turns start again at each deal. "Not its own" is the
//                only test: no one's counts, and nothing reads distance,
//                capture, the player or what a bot is.
//   the order    to the post (within 10 m), then defend it (10 m)
//   beside it    a fallen bot is back after 6 s (and none before the start:
//                here a bot's corpse and its six seconds are past it); every
//                15 s each side's aim noise is drawn again, one of ten scales
//                (its "adaptive difficulty", on unless switched off); the
//                bots' aim, reaction and dodging are each one of five steps,
//                the middle unless asked (its own options' tables)
//
// By hand: a table of twelve met by a thirteenth bot starts again from its
// first entry (the mod's layout implies it; what the game's switch does past
// its last output is its code's, not read); a bot that comes in between two
// deals takes the table's next entry (whether the mod gives it any order is
// not known); a post changing hands before the start asks for nothing. Pure.
//
//   slotOrder(team) → the posts' indices, the side's slot 1 first
//   createDealer(now) → dealer      stepDealer(dealer, now) → true when a deal is made this step
//   ownerChanged(dealer, now)       (a post changed hands)
//   dealFor(dealer, team, owners, count) → [post index a bot]   (owners: each post's team, 0 no one's)
//   nextFor(dealer, team, owners) → post index    (one more bot of the side, after its last deal)
//   tuned(ap, { aim, reaction, dodging }) → ap      (autoPlayer.js's numbers on the mod's steps)

export const TABLE = ['X', 'Y', 'M', 'M', 'Y', 'X', 'M', 'X', 'Y', 'F', 'M', 'M'];
// The deal's times, s: the hold after the start, the period, the least gap and the lag.
export const DEAL = { hold: 8, every: 25, limit: 5, lag: 0.1 };
// the tenth of a second between the hold's end and the start being told
const START_LAG = 0.1;
// How near its post a bot is sent, and then holds, m.
export const POST_RADIUS = 10;
// A fallen bot's wait, s (the mod's RespawnDelay once the round has started).
export const RESPAWN = 6;
// The difficulty's spread: every so many seconds each side's aim noise scale is one of these, drawn evenly.
export const SPREAD = { every: 15, scales: [0.15, 0.3, 0.6, 0.8, 1, 1.1, 1.35, 1.55, 1.95, 2.5] };

// The mod's five steps, and what each of its options sets on an AutoPlayer by them. Its aim's scale is
// in place of the settings' rows' (their scale and their row by side both: the side's is the spread's);
// it holds a field of view for Hard, 150, and nothing applies it.
export const STEPS = ['veryEasy', 'easy', 'medium', 'hard', 'veryHard'];
export const TUNING = {
  aim: { noiseScale: [100, 5, 1, 0.5, 0.125], fov: [40, 80, 110, null, 180] },
  reaction: { lofReaction: [0.5, 0.3, 0.1, 0.05, 0] },
  dodging: { dodgeRoll: [0, 0.01, 0.05, 0.1, 1] },
};

export function tuned(ap, steps = {}) {
  const out = { ...ap, sideScale: 1 };
  for (const [option, rows] of Object.entries(TUNING)) {
    const k = STEPS.indexOf(steps[option] ?? 'medium');
    for (const [field, values] of Object.entries(rows)) if (values[k] !== null) out[field] = values[k];
  }
  return out;
}

export const slotOrder = (team) => (team === 2 ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4]);

const fresh = () => ({ k: 0, X: 0, Y: 0, M: 0, F: 0 });

export function createDealer(now = 0) {
  return { startAt: now + DEAL.hold + START_LAG, started: false, nextPeriod: Infinity, limitUntil: -Infinity, queued: false, dealAt: Infinity, turns: { 1: fresh(), 2: fresh() } };
}

// a deal asked for: let through if none was in the last five seconds, else held
function ask(d, now) {
  if (now + 1e-9 >= d.limitUntil) {
    d.limitUntil = now + DEAL.limit;
    d.dealAt = Math.min(d.dealAt, now + DEAL.lag);
  } else d.queued = true;
}

export function ownerChanged(d, now) {
  if (d.started) ask(d, now);
}

export function stepDealer(d, now) {
  if (!d.started && now + 1e-9 >= d.startAt) {
    d.started = true;
    d.nextPeriod = d.startAt + DEAL.every;
    ask(d, now);
  }
  if (d.started && now + 1e-9 >= d.nextPeriod) {
    d.nextPeriod += DEAL.every;
    ask(d, now);
  }
  if (d.queued && now + 1e-9 >= d.limitUntil) {
    d.queued = false;
    ask(d, now);
  }
  if (now + 1e-9 >= d.dealAt) {
    d.dealAt = Infinity;
    return true;
  }
  return false;
}

// one bot's post: the table's entry for it, each entry's own turn kept in `turns`
function entry(turns, team, owners) {
  const order = slotOrder(team);
  const ours = (slot) => owners[order[slot - 1]] === team;
  const post = (slot) => order[slot - 1];
  const kind = TABLE[turns.k % TABLE.length];
  turns.k++;
  // (a two-way switch stepped at each use: its first way, then its second, then its first again)
  const turn = () => turns[kind]++ % 2;
  if (kind === 'X') {
    if (!ours(2)) return post(2);
    const then = turn() === 0 ? 4 : 3;
    return !ours(then) ? post(then) : post(5);
  }
  if (kind === 'Y') {
    if (!ours(1)) return post(1);
    const then = turn() === 0 ? 5 : 3;
    return !ours(then) ? post(then) : post(4);
  }
  if (kind === 'M') {
    if (!ours(3)) return post(3);
    const [a, b] = turn() === 0 ? [5, 4] : [4, 5];
    return !ours(a) ? post(a) : post(b);
  }
  return post(turn() === 0 ? 5 : 4);
}

export function dealFor(d, team, owners, count) {
  d.turns[team] = fresh();
  return Array.from({ length: count }, () => entry(d.turns[team], team, owners));
}

export const nextFor = (d, team, owners) => entry(d.turns[team], team, owners);
