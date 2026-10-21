import { describe, expect, it } from 'vitest';
import { DUEL, FOE, FOE_LINES, duelBot, newDuel, result, stepDuel } from './duel';
import { SHIELD, spellById } from './spells';

const DT = 1 / 60;
function run(d, input, until = 120) {
  const ev = [];
  while (!d.over && d.t < until) {
    d = stepDuel(d, typeof input === 'function' ? input(d) : input, DT);
    ev.push(...d.ev.map((e) => ({ ...e, t: d.t })));
  }
  return { d, ev };
}
// a duel with the foe kept quiet (its next cast far off), to test one bolt at a time
const quiet = (seed = 1) => {
  const d = newDuel({ seed });
  return { ...d, foe: { ...d.foe, next: 1e9 } };
};
const flight = (id) => (DUEL.gap - 2 * DUEL.reach) / spellById(id).bolt.speed;

describe('a round', () => {
  it('Expelliarmus that lands wins it for its caster', () => {
    // (the foe never shields: its guard is luck, and this is its unlucky day)
    let d = { ...quiet(), rand: 0 };
    d = stepDuel(d, { cast: 'expelliarmus' }, DT);
    const { ev } = run(d, {}, d.t + flight('expelliarmus') + 0.2);
    const over = ev.find((e) => e.type === 'roundOver');
    if (over) expect(over).toMatchObject({ winner: 'you', spell: 'expelliarmus' });
    else expect(ev.some((e) => e.type === 'blocked' || e.type === 'back' || e.type === 'dodged')).toBe(true);
  });
  it('a Stupefy that lands loses it for the one it hits, who goes down', () => {
    const d = stepDuel({ ...quiet(), bolts: [{ spell: 'stupefy', x: 3, dir: -1, owner: 'foe', back: false }] }, {}, DT);
    const { ev } = run(d, {}, 1);
    expect(ev.find((e) => e.type === 'roundOver')).toMatchObject({ winner: 'foe', spell: 'stupefy' });
    expect(ev.find((e) => e.type === 'knockdown')).toMatchObject({ on: 'you' });
  });
  it('Protego blocks a bolt, and on the beat throws it back along its line', () => {
    const coming = (x) => ({ ...quiet(), bolts: [{ spell: 'expelliarmus', x, dir: -1, owner: 'foe', back: false }] });
    const speed = spellById('expelliarmus').bolt.speed;
    // up on the beat: the bolt arrives in the shield’s first part
    const onBeat = run(stepDuel(coming(DUEL.reach + speed * 0.15), { cast: 'protego' }, DT), {}, 0.5);
    expect(onBeat.ev.find((e) => e.type === 'back')).toMatchObject({ by: 'you' });
    expect(onBeat.d.bolts[0]).toMatchObject({ dir: 1, owner: 'you', back: true });
    // up too early: it only stops it
    const early = run(stepDuel(coming(DUEL.reach + speed * (SHIELD.beat + 0.3)), { cast: 'protego' }, DT), {}, 1);
    expect(early.ev.some((e) => e.type === 'blocked')).toBe(true);
    expect(early.d.bolts).toEqual([]);
    expect(early.ev.some((e) => e.type === 'roundOver')).toBe(false);
  });
  it('a spell cooling can’t be cast again', () => {
    let d = stepDuel(quiet(), { cast: 'stupefy' }, DT);
    d = stepDuel(d, { cast: 'stupefy' }, DT);
    expect(d.bolts.filter((b) => b.owner === 'you')).toHaveLength(1);
  });
});

describe('the foe', () => {
  it('winds up every cast long enough to be read, and casts sooner each round', () => {
    const { ev } = run(newDuel({ seed: 3 }), {}, 30);
    const windups = ev.filter((e) => e.type === 'windup');
    const casts = ev.filter((e) => e.type === 'cast' && e.who === 'foe' && e.spell !== 'protego');
    expect(windups.length).toBeGreaterThan(0);
    for (const c of casts) {
      const w = windups.filter((x) => x.t <= c.t).at(-1);
      expect(c.t - w.t).toBeGreaterThanOrEqual(DUEL.windup - 1e-9);
    }
    expect(FOE[0].every).toBeGreaterThan(FOE[2].every);
    expect(FOE[0].react[0]).toBeGreaterThan(FOE[2].react[0]);
    // the first round’s foe never catches a bolt on the beat; the third’s often does
    expect(FOE[0].react[0]).toBeGreaterThanOrEqual(SHIELD.beat);
    expect(FOE[2].react[0]).toBeLessThan(SHIELD.beat);
  });
  it('shields your bolts more often than not, and throws some back by the third round', () => {
    let shielded = 0;
    let shot = 0;
    let back = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const { ev } = run(newDuel({ seed }), { cast: 'expelliarmus' }, 60);
      shot += ev.filter((e) => e.type === 'cast' && e.who === 'you').length;
      shielded += ev.filter((e) => (e.type === 'blocked' || e.type === 'back') && e.by === 'foe').length;
      back += ev.filter((e) => e.type === 'back' && e.by === 'foe').length;
    }
    expect(shielded / shot).toBeGreaterThan(0.4);
    expect(back).toBeGreaterThan(0);
  });
  it('beats a duellist who never lifts a wand, two rounds to none', () => {
    const { d } = run(newDuel({ seed: 5 }), {});
    expect(d.winner).toBe('foe');
    expect(d.wins).toEqual({ you: 0, foe: 2 });
    expect(result(d)).toEqual({ type: 'duel', won: false, wins: { you: 0, foe: 2 }, points: 0 });
  });
});

describe('the duel', () => {
  it('is the first to two rounds, with a pause between', () => {
    const { d, ev } = run(newDuel({ seed: 2 }), duelBot);
    expect(d.over).toBe(true);
    expect(Math.max(d.wins.you, d.wins.foe)).toBe(DUEL.toWin);
    expect(ev.filter((e) => e.type === 'roundOver').length).toBeLessThanOrEqual(3);
    expect(ev.some((e) => e.type === 'round' && e.round === 2)).toBe(true);
    expect(newDuel().ev[0]).toMatchObject({ type: 'line', who: 'foe', text: FOE_LINES.start });
    expect(Object.values(FOE_LINES).every((l) => !l.includes("'"))).toBe(true);
  });
  it('the bot, shielding on the beat, wins nine in ten or better, for twenty points each', () => {
    let won = 0;
    let backs = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { d, ev } = run(newDuel({ seed }), duelBot);
      backs += ev.filter((e) => e.type === 'back' && e.by === 'you').length;
      if (result(d).won) {
        won++;
        expect(result(d).points).toBe(20);
      }
    }
    expect(won).toBeGreaterThanOrEqual(18);
    expect(backs).toBeGreaterThan(20);
  });
  it('a duellist who only fires and never shields wins less than a third', () => {
    let won = 0;
    for (let seed = 1; seed <= 20; seed++) if (run(newDuel({ seed }), { cast: 'expelliarmus' }).d.winner === 'you') won++;
    expect(won).toBeLessThan(7);
  });
  it('is pure: the duel it is given is never changed', () => {
    const d = { ...newDuel({ seed: 9 }), bolts: [{ spell: 'expelliarmus', x: 3, dir: 1, owner: 'you', back: false }] };
    const copy = JSON.stringify(d);
    stepDuel(d, { cast: 'protego' }, 0.1);
    expect(JSON.stringify(d)).toBe(copy);
  });
});
