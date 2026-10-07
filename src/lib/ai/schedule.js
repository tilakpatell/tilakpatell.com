// When each brain senses and thinks, so a world can hold sixty of them and
// still keep its frame: the brains' twin of lib/three/animBudget.js. Each
// agent gets a score for how much a visitor would notice it, a rank by that
// score every half second, and a rate by its rank; and the frame's share of
// milliseconds is spent from the top, the rest left for the next frame.
// (docs/superpowers/specs/2026-10-07-npc-architecture-design.md, schedule.js)
//
// createSchedule({ rates = { sense: 20, think: 10, ambient: 4 },
//   budget = { ms: 1 }, significance = byDistance, tiers = [1, 0.5, 0.25, 0],
//   rank = { every: 0.5, slices: [0.25, 0.5, 0.25] }, seed = 1, now = null })
//   → { add(agent, { lane = 'think', sense = true, id }), drop(agent),
//       frame(dt, view, t) → { due: [{ agent, sense, think, dt }], stats },
//       done(agent), stats() → { agents, sensed, thought, ms, skipped, worst, sig } }
//   rates: merged over the defaults, so { think: 5 } still senses at 20 Hz;
//   sig: { [id]: 0..1 }, each agent's significance as of the last rank;
//   agent: anything with `pos` ({ x, y, z }) and `id` (or the id given to add);
//   lane: which rate it thinks at ('think' or 'ambient', or any key of rates);
//     one with no rate throws, as it would otherwise never think;
//   sense: whether it senses too, at rates.sense.
//   view: { at: { x, y, z }, dir?, range }, or null when there's none to judge
//   by, and then every agent runs at the full rate; t: the world's time,
//   passed on to significance(agent, view, t) → 0..1.
//   frame hands out the agents due this frame, most significant first. An
//   entry's dt is the real time its step stands for: the lane's step (0.1 s
//   at 10 Hz) over its tier's share, so an agent thinking at half rate is
//   given 0.2 s and keeps time with one at full rate. The world senses and
//   thinks each, then calls done(agent), which is how the scheduler learns
//   what each costs. `stats` is the frame's own record, filled in as done()
//   is called; stats() is a copy of it.
//
// Ranks: the agents are sorted by significance and each takes the share of
// the total significance above it; the slices cut that share into tiers
// (the top quarter full rate, the next half at half, the last quarter at a
// quarter), and an agent with nothing to notice (significance 0) is past
// every slice, so paused. Weighting by significance, not by head count, is
// the LOD Trader's: four agents at 1, 10, 50 and 1000 of a range of 100 run
// at full, half, quarter and not at all, where a head count would have put
// two of them at half. A paused agent accrues nothing and, when it ranks
// again, is due at once, one step's worth, never a backlog.
//
// Budget: each due agent's cost is guessed from what it cost last time (the
// mean of those measured for one not measured yet, else 0.05 ms), and the
// list is cut where the guesses pass budget.ms; at least one runs every
// frame. The ones cut are counted in `skipped` and go first next frame.
// `now` is the clock in ms (performance.now where it exists); with no clock
// nothing is measured and the budget is a count of 0.05 ms guesses.
//
// Phases: each agent draws a phase from seeded(seed ^ hash(id)), the same
// whatever order it was added in. When it joins a tier, it takes a point of
// its step by that phase among the tier's newcomers, evenly spaced, so a
// crowd at one rate doesn't all think on one frame (twenty random points
// would clump four or five to a frame; spaced, a tier puts one).
//
// Pure: no three.js; nothing random but the seed.
import { seeded } from '../seeded';

const GUESS = 0.05; // ms, for an agent's cost before anything is measured
const EPS = 1e-9;

export function byDistance(agent, view) {
  if (!view?.at || !(view.range > 0)) return 1;
  const p = agent.pos;
  const d = Math.hypot(p.x - view.at.x, (p.y ?? 0) - (view.at.y ?? 0), p.z - view.at.z);
  return 1 - Math.min(1, d / view.range);
}

// FNV-1a, so an agent's phase is its id's, not its turn's
function hash(id) {
  const s = String(id);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h | 0;
}

const clockOf = (now) => {
  if (now) return now;
  const p = globalThis.performance;
  return p && typeof p.now === 'function' ? () => p.now() : () => undefined;
};

const RATES = { sense: 20, think: 10, ambient: 4 };

export function createSchedule({
  rates: given = {},
  budget = { ms: 1 },
  significance = byDistance,
  tiers = [1, 0.5, 0.25, 0],
  rank = { every: 0.5, slices: [0.25, 0.5, 0.25] },
  seed = 1,
  now = null,
} = {}) {
  // a lane left out keeps its default, not a NaN step that never comes due
  const rates = { ...RATES, ...given };
  const clock = clockOf(now);
  const entries = new Map(); // agent → its record
  const cuts = [];
  for (const s of rank.slices) cuts.push((cuts.at(-1) ?? 0) + s);
  const paused = tiers.length - 1;
  let sinceRank = Infinity; // rank on the first frame
  let open = new Set(); // agents handed out and not yet done
  let mark;
  let sig = {}; // id → significance at the last rank, for the inspector
  let current = blank(0);

  function blank(agents) {
    return { agents, sensed: 0, thought: 0, ms: 0, skipped: 0, worst: null, sig };
  }

  const add = (agent, { lane = 'think', sense = true, id = agent.id } = {}) => {
    if (!(rates[lane] > 0)) throw new Error(`schedule: no rate for lane '${lane}'`);
    const rand = seeded(seed ^ hash(id));
    const think = 1 / rates[lane];
    const feel = sense ? 1 / rates.sense : 0;
    entries.set(agent, {
      agent,
      id,
      think,
      feel,
      acc: { think: 0, sense: 0 },
      phase: rand(),
      tier: null, // unranked until the next frame
      fresh: false,
      sig: 0,
      cost: null,
      waited: false,
    });
    sinceRank = Infinity;
  };

  const drop = (agent) => {
    entries.delete(agent);
    open.delete(agent);
  };

  const ranks = (view, t) => {
    const list = [...entries.values()];
    sig = {};
    for (const e of list) {
      e.sig = Math.max(0, Math.min(1, significance(e.agent, view, t) || 0));
      sig[e.id] = e.sig;
    }
    list.sort((a, b) => b.sig - a.sig || a.phase - b.phase);
    const total = list.reduce((s, e) => s + e.sig, 0);
    const groups = tiers.map(() => []);
    let above = 0;
    for (const e of list) {
      const start = total > 0 ? above / total : 1;
      let tier = view ? cuts.findIndex((c) => start < c - EPS) : 0;
      if (view && (tier < 0 || e.sig <= 0)) tier = paused;
      above += e.sig;
      groups[tier].push(e);
      if (e.tier === tier) continue;
      if (e.tier === paused) {
        // back from a pause: due now, one step, no backlog
        e.acc.think = e.think;
        e.acc.sense = e.feel;
      } else e.fresh = true;
      e.tier = tier;
    }
    // a tier's newcomers take evenly spaced points of its step, in phase
    // order, so a crowd that ranks together doesn't think together
    for (const g of groups) {
      g.forEach((e, i) => {
        if (!e.fresh) return;
        const slot = (i + 0.5) / g.length;
        e.acc.think = slot * e.think;
        e.acc.sense = slot * e.feel;
        e.fresh = false;
      });
    }
  };

  const frame = (dt, view, t) => {
    dt = dt > 0 ? dt : 0;
    sinceRank += dt;
    if (sinceRank >= rank.every) {
      sinceRank = 0;
      ranks(view, t);
    }
    const due = [];
    for (const e of entries.values()) {
      const share = tiers[e.tier] ?? 0;
      if (!(share > 0)) continue;
      e.acc.think += dt * share;
      if (e.feel) e.acc.sense += dt * share;
      const think = e.acc.think >= e.think - EPS;
      const sense = e.feel > 0 && e.acc.sense >= e.feel - EPS;
      if (think || sense) due.push({ e, think, sense, share });
      else e.waited = false;
    }
    due.sort((a, b) => b.e.waited - a.e.waited || b.e.sig - a.e.sig || a.e.phase - b.e.phase);

    const known = [...entries.values()].filter((e) => e.cost != null);
    const mean = known.length ? known.reduce((s, e) => s + e.cost, 0) / known.length : GUESS;
    current = blank(entries.size);
    open = new Set();
    const out = [];
    let spent = 0;
    for (const d of due) {
      const guess = d.e.cost ?? mean;
      if (out.length && spent + guess > budget.ms + EPS) {
        d.e.waited = true;
        current.skipped++;
        continue;
      }
      spent += guess;
      d.e.waited = false;
      // take one step from each lane due, and drop anything past a second
      // (a long frame runs a step, never a backlog)
      if (d.think) d.e.acc.think = (d.e.acc.think - d.e.think) % d.e.think;
      if (d.sense) d.e.acc.sense = (d.e.acc.sense - d.e.feel) % d.e.feel;
      if (d.think) current.thought++;
      if (d.sense) current.sensed++;
      open.add(d.e.agent);
      out.push({ agent: d.e.agent, sense: d.sense, think: d.think, dt: (d.think ? d.e.think : d.e.feel) / d.share });
    }
    mark = clock();
    return { due: out, stats: current };
  };

  const done = (agent) => {
    if (!open.delete(agent)) return;
    const e = entries.get(agent);
    const at = clock();
    if (typeof at !== 'number' || typeof mark !== 'number') return;
    const ms = Math.max(0, at - mark);
    mark = at;
    if (!e) return;
    e.cost = ms;
    current.ms += ms;
    if (!current.worst || ms > current.worst.ms) current.worst = { id: e.id, ms };
  };

  const stats = () => ({ ...current, agents: entries.size, worst: current.worst && { ...current.worst }, sig: { ...current.sig } });

  return { add, drop, frame, done, stats };
}
