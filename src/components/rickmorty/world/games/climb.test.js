import { describe, expect, it } from "vitest";
import {
  TUNING,
  WORDS,
  climbNews,
  climbReadout,
  moods,
  newClimb,
  nextStair,
  stairPose,
  standingOn,
  stepClimb,
} from "./climb";
import { METER_OFF } from "./meter";

// a stair of one tread (g1) and one of two (g2), a landing between, and the top: in world metres
const LEDGES = [
  { id: "g1-low", kind: "box", x: 0, z: 0, w: 2, d: 1, top: 0.5, ledge: true },
  {
    id: "landing",
    kind: "box",
    x: 0,
    z: -1.5,
    w: 2,
    d: 2,
    top: 1.2,
    ledge: true,
  },
  {
    id: "g2-low",
    kind: "box",
    x: 0,
    z: -3,
    w: 2,
    d: 1,
    turn: Math.PI / 4,
    top: 1.9,
    ledge: true,
  },
  { id: "g2-top", kind: "box", x: 0, z: -4, w: 2, d: 1, top: 2.6, ledge: true },
  { id: "shoot", kind: "circle", x: 3, z: -5, r: 0.8, top: 3.0, ledge: true },
  { id: "crown", kind: "circle", x: 0, z: -6, r: 1, top: 3.4, ledge: true },
];
const STAIRS = [
  { id: "g1", steps: ["g1-low"] },
  { id: "g2", steps: ["g2-low", "g2-top"] },
];
const FOOT = { x: 0, z: 3 };
const climb = (o = {}) =>
  newClimb({ ledges: LEDGES, stairs: STAIRS, top: "crown", foot: FOOT, ...o });
const on = (id, more = {}) => {
  const l = LEDGES.find((o) => o.id === id);
  return { morty: { x: l.x, z: l.z, y: l.top, air: false, ...more } };
};
const ground = (x = 0, z = 1.5) => ({ morty: { x, z, y: 0, air: false } });
const air = (x = 0, z = 0, y = 3) => ({ morty: { x, z, y, air: true } });
const BEAT = TUNING.still + TUNING.shiver + TUNING.bite;
// stepped a whole frame at a time (the stage steps it a frame at a time, never more than TUNING.frame)
const wait = (g, s, input = ground()) => {
  for (let t = 0; t < s - 1e-9; t += 0.05)
    g = stepClimb(g, input, Math.min(0.05, s - t));
  return g;
};

describe("the climb kind: up the stairs while they keep still, and on to the top", () => {
  it("keeps each stair’s beat: still, a shiver, then the bite, a lag apart up the flight", () => {
    expect(BEAT).toBeCloseTo(4.2, 9);
    const at = (t, i) => stairPose({ t }, i);
    expect(at(0, 0)).toEqual({ mood: "still", k: 0 });
    expect(at(1.2, 0)).toMatchObject({ mood: "still", k: 0.5 });
    expect(at(2.39, 0).mood).toBe("still");
    expect(at(2.4, 0)).toMatchObject({ mood: "shiver", k: 0 });
    expect(at(2.9, 0)).toMatchObject({ mood: "shiver" });
    expect(at(2.9, 0).k).toBeCloseTo(0.5, 9);
    expect(at(3.4, 0).mood).toBe("bite");
    expect(at(4.19, 0).mood).toBe("bite");
    expect(at(4.2, 0).mood).toBe("still");
    // (the next stair up a lag behind: still for its first lag, then on the same beat)
    expect(at(1.1, 1)).toEqual({ mood: "still", k: 0 });
    expect(at(TUNING.lag + 2.39, 1).mood).toBe("still");
    expect(at(TUNING.lag + 2.401, 1).mood).toBe("shiver");
    expect(at(TUNING.lag + 3.401, 1).mood).toBe("bite");
    expect(moods({ t: 3.5, stairs: STAIRS })).toEqual({
      g1: "bite",
      g2: "still",
    });
  });

  it("stands Morty on a ledge as the walker does: over its footprint by a hand, at its height, on his feet", () => {
    const m = (x, z, y, more = {}) => ({ x, z, y, air: false, ...more });
    expect(TUNING.edge).toBe(0.1);
    // an unturned box: a hand past its edge counts, a little more doesn't
    expect(standingOn(LEDGES, m(1.09, 0, 0.5))).toBe("g1-low");
    expect(standingOn(LEDGES, m(1.11, 0, 0.5))).toBe(null);
    expect(standingOn(LEDGES, m(0, 0.59, 0.5))).toBe("g1-low");
    expect(standingOn(LEDGES, m(0, 0.61, 0.5))).toBe(null);
    // at its height, give or take two centimetres
    expect(standingOn(LEDGES, m(0, 0, 0.519))).toBe("g1-low");
    expect(standingOn(LEDGES, m(0, 0, 0.53))).toBe(null);
    // a box turned a quarter of a half turn: along its own width, not the world's x
    const c = Math.SQRT1_2;
    expect(standingOn(LEDGES, m(1.05 * c, -3 - 1.05 * c, 1.9))).toBe("g2-low");
    expect(standingOn(LEDGES, m(1.15 * c, -3 - 1.15 * c, 1.9))).toBe(null);
    expect(standingOn(LEDGES, m(1.05 * c, -3 + 1.05 * c, 1.9))).toBe(null);
    // a circle
    expect(standingOn(LEDGES, m(1.09, -6, 3.4))).toBe("crown");
    expect(standingOn(LEDGES, m(1.11, -6, 3.4))).toBe(null);
    // in the air over it, or on the ground under it: on nothing
    expect(standingOn(LEDGES, m(0, 0, 0.5, { air: true }))).toBe(null);
    expect(standingOn(LEDGES, m(0, 0, 0))).toBe(null);
    // two footprints that meet: the one at his height
    expect(standingOn(LEDGES, m(0, -0.55, 0.5))).toBe("g1-low");
    expect(standingOn(LEDGES, m(0, -0.55, 1.2))).toBe("landing");
  });

  it("waits for him to get on, and is won on the top", () => {
    const g = climb({ perks: { stun: 1 } });
    expect(g).toMatchObject({
      phase: "idle",
      t: 0,
      on: null,
      stand: 0,
      high: 0,
      near: false,
      top: "crown",
      peak: 3.4,
      told: false,
      events: [],
    });
    const idle = stepClimb(g, ground(), 0.5);
    expect(idle).toMatchObject({ phase: "idle", on: null, stand: 0 });
    const started = stepClimb(idle, on("landing"), 1 / 60);
    expect(started).toMatchObject({
      phase: "run",
      on: "landing",
      stand: 1.2,
      high: 1.2,
    });
    expect(started.events).toEqual([{ type: "start" }]);
    const topped = stepClimb(started, on("crown"), 1 / 60);
    expect(topped).toMatchObject({ phase: "won", on: "crown", stand: 3.4 });
    expect(topped.events).toEqual([{ type: "won" }]);
  });

  it("is lost on a tread while its stair bites, and not in the air over it, while it shivers, or on the landing beside it", () => {
    // g1 bites at 3.4 s
    const biting = wait(climb(), 3.45);
    expect(stairPose(biting, 0).mood).toBe("bite");
    const lost = stepClimb(biting, on("g1-low"), 1 / 60);
    expect(lost).toMatchObject({ phase: "lost", on: "g1-low" });
    expect(lost.events).toEqual([
      { type: "start" },
      { type: "lost", why: "bitten", stair: "g1" },
    ]);
    expect(stepClimb(biting, air(0, 0, 0.9), 1 / 60).phase).toBe("idle");
    expect(stepClimb(biting, on("landing"), 1 / 60).phase).toBe("run");
    const shivering = wait(climb(), 2.5);
    expect(stairPose(shivering, 0).mood).toBe("shiver");
    expect(stepClimb(shivering, on("g1-low"), 1 / 60).phase).toBe("run");
    // (g2's top tread, while g2 bites: a lag after g1)
    const later = wait(climb(), 3.45 + TUNING.lag);
    expect(stairPose(later, 1).mood).toBe("bite");
    expect(stepClimb(later, on("g2-top"), 1 / 60).events.at(-1)).toEqual({
      type: "lost",
      why: "bitten",
      stair: "g2",
    });
  });

  it("says a fall from four metres or more once, back on the ground, and isn’t lost by it", () => {
    const high = [
      { id: "up", kind: "circle", x: 0, z: 0, r: 1, top: 4, ledge: true },
    ];
    let g = stepClimb(
      newClimb({ ledges: [...high, ...LEDGES], stairs: STAIRS, top: "crown" }),
      { morty: { x: 0, z: 0, y: 4, air: false } },
      1 / 60,
    );
    expect(g).toMatchObject({ phase: "run", high: 4 });
    g = stepClimb(g, air(3, 3, 2), 1 / 60);
    expect(g).toMatchObject({ phase: "run", stand: 4, events: [] });
    g = stepClimb(g, ground(3, 3), 1 / 60);
    expect(g).toMatchObject({ phase: "run", stand: 0, high: 0 });
    expect(g.events).toEqual([{ type: "fell", from: 4 }]);
    expect(stepClimb(g, ground(3, 3), 1 / 60).events).toEqual([]);
    // (from 3.9 m: nothing said)
    const lower = [
      { id: "up", kind: "circle", x: 0, z: 0, r: 1, top: 3.9, ledge: true },
    ];
    let h = stepClimb(
      newClimb({ ledges: [...lower, ...LEDGES], stairs: STAIRS, top: "crown" }),
      { morty: { x: 0, z: 0, y: 3.9, air: false } },
      1 / 60,
    );
    h = stepClimb(h, ground(3, 3), 1 / 60);
    expect(h).toMatchObject({ phase: "run", events: [] });
  });

  it("keeps a game won or lost as it is", () => {
    const won = stepClimb(
      stepClimb(climb(), on("crown"), 1 / 60),
      ground(),
      1 / 60,
    );
    expect(won).toMatchObject({ phase: "won", events: [] });
    const lost = stepClimb(
      stepClimb(wait(climb(), 3.45), on("g1-low"), 1 / 60),
      on("crown"),
      1 / 60,
    );
    expect(lost).toMatchObject({ phase: "lost", events: [] });
  });

  it("moves nothing at no time, and counts a long frame as a tenth of a second", () => {
    const g = wait(climb(), 2);
    expect(stepClimb(g, on("g1-low"), 0)).toMatchObject({ t: g.t });
    expect(stepClimb(g, ground(), 5).t).toBeCloseTo(g.t + TUNING.frame, 9);
    // (held at no time on a tread just short of its bite: still not bitten)
    let held = stepClimb(wait(climb(), 3.39), on("g1-low"), 1 / 600);
    for (let i = 0; i < 100; i++) held = stepClimb(held, on("g1-low"), 0);
    expect(held.phase).toBe("run");
  });

  it("says the news once: the win till it’s kept, a bite once and not in a fade", () => {
    const won = stepClimb(climb(), on("crown"), 1 / 60);
    expect(climbNews(won, { done: false, fading: false })).toBe("done");
    expect(climbNews(won, { done: true, fading: false })).toBe(null);
    const lost = stepClimb(wait(climb(), 3.45), on("g1-low"), 1 / 60);
    expect(climbNews(lost, { done: false, fading: false })).toBe("caught");
    expect(climbNews(lost, { done: false, fading: true })).toBe(null);
    expect(
      climbNews({ ...lost, told: true }, { done: false, fading: false }),
    ).toBe(null);
    expect(climbNews(climb(), { done: false, fading: false })).toBe(null);
  });

  it("names the stair under him, else the next one up, and none once he’s past them", () => {
    expect(nextStair(climb())).toBe(0);
    expect(nextStair(stepClimb(climb(), on("g1-low"), 1 / 60))).toBe(0);
    expect(nextStair(stepClimb(climb(), on("landing"), 1 / 60))).toBe(1);
    expect(nextStair(stepClimb(climb(), on("g2-low"), 1 / 60))).toBe(1);
    expect(nextStair(stepClimb(climb(), on("g2-top"), 1 / 60))).toBe(1);
    expect(nextStair(stepClimb(climb(), on("shoot"), 1 / 60))).toBe(-1);
  });

  it("reads the meter: off away from the stairs, the next stair’s mood near them and on them, then how high", () => {
    expect(climbReadout(null)).toEqual(METER_OFF);
    expect(climbReadout(climb())).toEqual(METER_OFF);
    // near the foot (within TUNING.near), the first stair's mood
    const near = stepClimb(
      climb(),
      { morty: { x: 0, z: 3 + TUNING.near - 0.1, y: 0, air: false } },
      1 / 60,
    );
    expect(near.near).toBe(true);
    expect(climbReadout(near)).toEqual({
      on: true,
      vitals: { value: 0, max: 100, low: false },
      line: WORDS.still,
    });
    const far = stepClimb(
      climb(),
      { morty: { x: 0, z: 3 + TUNING.near + 0.1, y: 0, air: false } },
      1 / 60,
    );
    expect(climbReadout(far)).toEqual(METER_OFF);
    // the warning while it shivers or bites
    const shivering = stepClimb(wait(climb(), 2.5), on("g1-low"), 1 / 60);
    expect(climbReadout(shivering)).toEqual({
      on: true,
      vitals: { value: 15, max: 100, low: true },
      line: WORDS.shiver,
    });
    const biting = stepClimb(wait(climb(), 3.45), ground(0, 3), 1 / 60);
    expect(climbReadout(biting)).toMatchObject({
      on: true,
      line: WORDS.bite,
      vitals: { low: true },
    });
    // past the stairs: how high, of the top
    const up = stepClimb(climb(), on("shoot"), 1 / 60);
    expect(climbReadout(up)).toEqual({
      on: true,
      vitals: { value: 88, max: 100, low: false },
      line: WORDS.up(3, 3),
    });
    expect(WORDS.up(14, 21)).toBe(
      "14 m up the beanstalk: the giants are at 21 m",
    );
    // and off once it's won or lost
    expect(climbReadout(stepClimb(up, on("crown"), 1 / 60))).toEqual(METER_OFF);
  });

  it("takes perks and reads none", () => {
    expect(climb({ perks: { stun: 1, slow: 1 } })).toEqual(climb());
  });
});
