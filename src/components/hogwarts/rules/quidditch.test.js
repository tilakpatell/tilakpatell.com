import { describe, expect, it } from 'vitest';
import { BLUDGER, CATCH, FOES, GOAL, LINES, PITCH, SNITCH, SNITCH_POINTS, fixtures, lineFor, newMatch, playersAt, quaffleAt, result, seekerBot, stepMatch } from './quidditch';
import { BROOM } from './flight';

const DT = 1 / 60;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// play a match through with an input a step, gathering its events
function play(m, input, until = 600, dt = DT) {
  const ev = [];
  while (!m.over && m.t < until) {
    m = stepMatch(m, typeof input === 'function' ? input(m) : input, dt);
    ev.push(...m.ev);
  }
  return { m, ev };
}

describe('the term’s matches', () => {
  it('are Slytherin, Ravenclaw and Hufflepuff, Gryffindor standing in for your own', () => {
    expect(fixtures('gryffindor')).toEqual(['slytherin', 'ravenclaw', 'hufflepuff']);
    expect(fixtures('slytherin')).toEqual(['gryffindor', 'ravenclaw', 'hufflepuff']);
    expect(newMatch({ n: 2, house: 'hufflepuff' }).against).toBe('ravenclaw');
  });
  it('the other Seeker is worse at the first and better by the third', () => {
    expect(FOES[0].top).toBeLessThan(FOES[2].top);
    expect(FOES[0].lag).toBeGreaterThan(FOES[2].lag);
    expect(FOES[0].sight).toBeLessThan(FOES[2].sight);
    // left to it, it gets there: slowly at the first, quickly at the third
    const t1 = play(newMatch({ n: 1, seed: 3 }), {}, 1200, 1 / 30).m;
    const t3 = play(newMatch({ n: 3, seed: 3 }), {}, 1200, 1 / 30).m;
    expect(t1.caught).toBe('them');
    expect(t3.caught).toBe('them');
    expect(t3.t).toBeLessThan(t1.t / 3);
  });
});

describe('the twelve and the score', () => {
  it('twelve fly their loops: three Chasers, two Beaters and a Keeper a side', () => {
    const ps = playersAt(newMatch({ seed: 2 }));
    expect(ps).toHaveLength(12);
    for (const team of ['us', 'them']) {
      const mine = ps.filter((p) => p.team === team);
      expect(mine.filter((p) => p.role === 'chaser')).toHaveLength(3);
      expect(mine.filter((p) => p.role === 'beater')).toHaveLength(2);
      const k = mine.find((p) => p.role === 'keeper');
      expect(Math.abs(Math.abs(k.p[0]) - PITCH.hoopX)).toBeLessThan(4);
    }
  });
  it('the score runs on its own, ten a goal, the same for the same seed', () => {
    const a = play(newMatch({ seed: 5 }), {}, 180, 1 / 30);
    const b = play(newMatch({ seed: 5 }), {}, 180, 1 / 30);
    const goals = a.ev.filter((e) => e.type === 'goal');
    expect(goals.length).toBeGreaterThan(3);
    expect(a.m.score.us + a.m.score.them).toBe(goals.length * GOAL);
    expect(b.m.score).toEqual(a.m.score);
    // the Quaffle is in the scorer’s hands at the hoop as it goes in
    const m = newMatch({ seed: 5 });
    const g = m.goals[0];
    const at = play(m, {}, g.t - 0.05, 1 / 30).m;
    expect(Math.abs(quaffleAt(at)[0])).toBeGreaterThan(PITCH.hoopX - 6);
  });
});

describe('the Bludgers', () => {
  it('hunt the nearest and cost you two seconds of tumble and some height', () => {
    let m = newMatch({ seed: 1 });
    // one Bludger just off your shoulder, coming in, and nobody with a bat near
    m = { ...m, you: { ...m.you, p: [0, 20, 0] }, bludgers: [{ p: [6, 20, 0], v: [-BLUDGER.speed, 0, 0], rest: 0 }], foe: { ...m.foe, p: [60, 9, 0] } };
    m.t = 1000; // (the loops elsewhere)
    const y0 = m.you.p[1];
    let hit = null;
    for (let i = 0; i < 120 && !hit; i++) {
      m = stepMatch(m, {}, DT);
      hit = m.ev.find((e) => e.type === 'bludger');
    }
    // (your Beater may have got to it first: that is the Beaters’ job)
    if (hit) {
      expect(m.you.tumble).toBeGreaterThan(BROOM.tumble - 0.1);
      const later = play(m, { up: 1 }, m.t + 1.5).m;
      expect(later.you.p[1]).toBeLessThan(y0);
    } else expect(m.bludgers[0].rest).toBeGreaterThan(0);
  });
  it('are batted off by the Beaters', () => {
    const { ev } = play(newMatch({ seed: 4 }), {}, 120, 1 / 30);
    expect(ev.some((e) => e.type === 'batted')).toBe(true);
  });
});

describe('the Snitch', () => {
  it('keeps its distance from a Seeker coming at it, and darts when one is near', () => {
    let m = newMatch({ n: 1, seed: 7 });
    m = { ...m, foe: { ...m.foe, p: [70, 30, 30] }, you: { ...m.you, p: [m.snitch.p[0] - 10, m.snitch.p[1], m.snitch.p[2]], yaw: Math.PI / 2 } };
    const before = dist(m.you.p, m.snitch.p);
    let darted = false;
    // (a Seeker who comes at it and never reaches for it)
    for (let i = 0; i < 60 * 40 && !darted; i++) {
      m = stepMatch(m, { ...seekerBot(m), catch: false }, DT);
      darted = m.ev.some((e) => e.type === 'dart');
    }
    expect(before).toBeLessThan(SNITCH.keep);
    expect(darted).toBe(true);
  });
  it('is caught with E within 1.5 m, and not from further', () => {
    let m = newMatch({ seed: 2 });
    const near = { ...m, you: { ...m.you, p: [m.snitch.p[0] + CATCH - 0.3, m.snitch.p[1], m.snitch.p[2]] } };
    expect(stepMatch(near, { catch: true }, DT).caught).toBe('you');
    expect(stepMatch(near, { catch: false }, DT).over).toBe(false);
    const far = { ...m, you: { ...m.you, p: [m.snitch.p[0] + CATCH + 1, m.snitch.p[1], m.snitch.p[2]] } };
    expect(stepMatch(far, { catch: true }, DT).over).toBe(false);
  });
  it('is worth 150, and the score decides it by the book’s rule', () => {
    const m = newMatch({ seed: 2, house: 'ravenclaw', n: 1 });
    const behind = { ...m, score: { us: 0, them: 160 + SNITCH_POINTS }, you: { ...m.you, p: [...m.snitch.p] } };
    const lost = stepMatch(behind, { catch: true }, DT);
    expect(lost.score.us).toBe(SNITCH_POINTS);
    expect(result(lost)).toMatchObject({ type: 'match', n: 1, house: 'ravenclaw', against: 'slytherin', caught: 'you', won: false });
    const ahead = stepMatch({ ...behind, score: { us: 30, them: 40 } }, { catch: true }, DT);
    expect(result(ahead)).toMatchObject({ us: 180, them: 40, won: true, draw: false });
    expect(result(m)).toBe(null);
  });
});

describe('the bot', () => {
  // the spec’s bar: a Seeker who knows the game catches it inside four
  // minutes at the first match, and wins
  for (const seeds of [
    [1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10],
  ]) {
    it(`catches the Snitch in under four minutes at the first match (seeds ${seeds.join(', ')})`, () => {
      for (const seed of seeds) {
        const { m } = play(newMatch({ n: 1, seed }), seekerBot, 240);
        expect(m.caught, `seed ${seed}`).toBe('you');
        expect(m.t).toBeLessThan(240);
        expect(result(m).won).toBe(true);
      }
    });
  }
  it('wins most of the third, which is harder, and not all of it', () => {
    let won = 0;
    for (let seed = 1; seed <= 20; seed++) if (play(newMatch({ n: 3, seed }), seekerBot, 240).m.caught === 'you') won++;
    expect(won).toBeGreaterThanOrEqual(12);
    expect(won).toBeLessThan(20);
  });
});

describe('practice and the commentator', () => {
  it('practice is the Snitch alone: nobody else, no score, no result', () => {
    const m = newMatch({ practice: true, seed: 3 });
    expect(m.foe).toBe(null);
    expect(m.bludgers).toEqual([]);
    expect(playersAt(m)).toEqual([]);
    const done = play(m, seekerBot, 240).m;
    expect(done.caught).toBe('you');
    expect(done.score).toEqual({ us: 0, them: 0 });
    expect(result(done)).toBe(null);
  });
  it('has a line for each event, with the houses’ names in', () => {
    const m = newMatch({ house: 'hufflepuff', n: 1 });
    for (const e of [{ type: 'start' }, { type: 'goal', side: 'us' }, { type: 'goal', side: 'them' }, { type: 'bludger' }, { type: 'batted' }, { type: 'knock' }, { type: 'dart' }, { type: 'near' }, { type: 'caught', by: 'you' }, { type: 'caught', by: 'them' }]) {
      const l = lineFor(e, m, 1);
      expect(l).toBeTruthy();
      expect(l).not.toMatch(/[{}]/);
    }
    expect(lineFor({ type: 'goal', side: 'us' }, m, 0)).toContain('Hufflepuff');
    expect(lineFor({ type: 'nothing' }, m)).toBe(null);
    for (const set of Object.values(LINES)) for (const l of set) expect(l).not.toMatch(/'/);
  });
});
