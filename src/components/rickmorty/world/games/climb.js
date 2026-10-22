// The climb kind (the spec's "solids with a `top` that Morty walks on, as
// the stoop is"): Fantasy World's game, past the stairs that bite and up the
// beanstalk to the giants, and later Bird World's towers. The place's ledges
// (its solids with `ledge: true`, ../dimensions/beanstalk.js) are stood on
// however high, one hop at a time (../rules.js). Some of them are a stair's
// treads, and each stair bites on its own beat: still a while, a shiver (the
// warning), then the bite, a lag apart up the flight. A tread stood on while
// its stair bites is lost, as caught is (back at the way in); standing on the
// top is the win. A fall only costs the height, and from high enough it's
// said. Pure and import-free, stepped by the place's stage
// (../dimensions/stage.js) inside its own update on Morty's own position, as
// the freeze is; tested in Node.
//
//   newClimb({ ledges, stairs, top, foot, perks }) → game
//     ledges: [{ id, kind: 'box' | 'circle', x, z, w, d, turn, r, top }] in world metres;
//     stairs: [{ id, steps: [tread ids, bottom first] }]; top: the ledge that wins it;
//     foot: { x, z }, where the stairs start (the meter comes on near it)
//   stepClimb(game, { morty }, dt) → game   morty: { x, z, y, air }
//     events: start | won | lost { why: 'bitten', stair } | fell { from }
//   standingOn(ledges, morty) → the ledge he's on, or null
//   stairPose(game, i) → { mood: 'still' | 'shiver' | 'bite', k }   k: the share of the way through it
//   moods(game) → { [stair id]: mood }
//   nextStair(game) → the stair under him, else the next one up, as an index; −1 past them
//   climbNews(game, { done, fading }) → 'done' | 'caught' | null   what the place says
//   climbReadout(snapshot, words) → { on, vitals, line }   for the HUD's meter
//
// `perks` (the shop's, P13) are taken and, until the shop decides what they
// do here, none is read.

export const TUNING = Object.freeze({
  still: 2.4, // seconds a stair keeps still
  shiver: 1.0, // then shivers: it's about to bite
  bite: 0.8, // then bites
  lag: 1.2, // seconds between one stair's beat and the next one up's
  edge: 0.1, // how far past a ledge's edge he still stands on it (the walker's, ../rules.js: a quarter of his radius)
  level: 0.02, // how near its top his feet must be
  fall: 4, // metres: a fall from this high is said
  near: 6, // metres from the stairs' foot that the meter comes on
  frame: 0.1, // the longest a frame counts for (a hidden tab, a slow one)
});

// what the HUD's line says: the mood of the stair under him or next up; past them, how high
export const WORDS = Object.freeze({
  still: "The stair’s keeping still: up you go",
  shiver: "It’s shivering: it’s about to bite",
  bite: "It’s biting: wait till it keeps still",
  up: (m, top) => `${m} m up the beanstalk: the giants are at ${top} m`,
});

const BEAT = TUNING.still + TUNING.shiver + TUNING.bite;

// (the walker's own test, rules.js's over(): a turned box in its own frame, a circle by its radius)
function over(l, x, z) {
  const dx = x - l.x;
  const dz = z - l.z;
  if (l.kind === "circle" || l.r != null)
    return Math.hypot(dx, dz) < l.r + TUNING.edge;
  const t = l.turn || 0;
  const lx = dx * Math.cos(t) - dz * Math.sin(t);
  const lz = dx * Math.sin(t) + dz * Math.cos(t);
  return (
    Math.abs(lx) < l.w / 2 + TUNING.edge && Math.abs(lz) < l.d / 2 + TUNING.edge
  );
}

export function standingOn(ledges, m) {
  if (!m || m.air) return null;
  let on = null;
  for (const l of ledges)
    if (
      Math.abs(m.y - l.top) <= TUNING.level &&
      over(l, m.x, m.z) &&
      (!on || l.top > on.top)
    )
      on = l;
  return on?.id ?? null;
}

// (the options may carry `perks`; none is read yet)
export function newClimb({
  ledges = [],
  stairs = [],
  top = null,
  foot = null,
} = {}) {
  const peak = ledges.find((l) => l.id === top)?.top ?? 0;
  return {
    phase: "idle",
    t: 0,
    on: null,
    stand: 0,
    high: 0,
    near: false,
    ledges,
    stairs,
    top,
    foot,
    peak,
    told: false,
    events: [],
  };
}

export function stairPose(g, i) {
  const tau = g.t - i * TUNING.lag;
  if (tau < 0) return { mood: "still", k: 0 };
  const c = tau % BEAT;
  if (c < TUNING.still) return { mood: "still", k: c / TUNING.still };
  if (c < TUNING.still + TUNING.shiver)
    return { mood: "shiver", k: (c - TUNING.still) / TUNING.shiver };
  return { mood: "bite", k: (c - TUNING.still - TUNING.shiver) / TUNING.bite };
}

export const moods = (g) =>
  Object.fromEntries(g.stairs.map((s, i) => [s.id, stairPose(g, i).mood]));

const topOf = (g, id) => g.ledges.find((l) => l.id === id)?.top ?? 0;
export function nextStair(g) {
  const under = g.stairs.findIndex((s) => s.steps.includes(g.on));
  if (under >= 0) return under;
  return g.stairs.findIndex((s) => topOf(g, s.steps.at(-1)) > g.stand + 1e-9);
}

export function stepClimb(prev, { morty = null } = {}, dt = 1 / 60) {
  if (prev.phase === "won" || prev.phase === "lost")
    return { ...prev, events: [] };
  const g = {
    ...prev,
    events: [],
    t: prev.t + Math.min(Math.max(dt, 0), TUNING.frame),
  };
  g.on = standingOn(g.ledges, morty);
  // (on a ledge, its top; on the ground, nothing; in the air, where he was)
  g.stand = g.on ? topOf(g, g.on) : morty && !morty.air ? 0 : prev.stand;
  g.near = Boolean(
    g.foot &&
    morty &&
    Math.hypot(morty.x - g.foot.x, morty.z - g.foot.z) <= TUNING.near,
  );
  if (g.phase === "idle" && g.on) {
    g.phase = "run";
    g.events.push({ type: "start" });
  }
  if (g.phase !== "run") return g;
  g.high = Math.max(g.high, g.stand);
  if (g.on === g.top) {
    g.phase = "won";
    g.events.push({ type: "won" });
    return g;
  }
  const bitten = g.stairs.findIndex(
    (s, i) => s.steps.includes(g.on) && stairPose(g, i).mood === "bite",
  );
  if (bitten >= 0) {
    g.phase = "lost";
    g.events.push({ type: "lost", why: "bitten", stair: g.stairs[bitten].id });
    return g;
  }
  // (back on the ground from high enough: said once, and nothing lost but the height)
  if (!g.on && morty && !morty.air && g.stand === 0) {
    if (g.high >= TUNING.fall) g.events.push({ type: "fell", from: g.high });
    g.high = 0;
  }
  return g;
}

// won: say so every frame till the task's kept (a frame in a fade is lost);
// lost: once, and not while Morty's fading
export function climbNews(g, { done, fading }) {
  if (g.phase === "won") return done ? null : "done";
  if (g.phase === "lost" && !fading && !g.told) return "caught";
  return null;
}

export function climbReadout(g, words = WORDS) {
  if (!g || !(g.phase === "run" || (g.phase === "idle" && g.near)))
    return { on: false, vitals: null, line: "" };
  const i = nextStair(g);
  const mood = i >= 0 ? stairPose(g, i).mood : null;
  const line = mood
    ? words[mood]
    : words.up(Math.round(g.stand), Math.round(g.peak));
  return {
    on: true,
    vitals: {
      value: g.peak ? Math.round((100 * g.stand) / g.peak) : 0,
      max: 100,
      low: mood === "shiver" || mood === "bite",
    },
    line,
  };
}
