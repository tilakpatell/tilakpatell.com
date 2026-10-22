import { describe, expect, it } from 'vitest';
import { BASE, FULL, HOUSES, TABLE, apply, misdeed, newPoints, rivalsAt, standings, toastFor, totals, winner, words } from './points';
import { QUESTS } from './quests';

const gain = (house, delta, why = 'test') => ({ type: 'points', house, delta, why });

// a term played: the quests done (each paid as the quest or its lesson pays it), and whatever else
function term({ house = 'ravenclaw', quests = QUESTS.length, extra = [], year = 1 } = {}) {
  let p = newPoints({ house, year });
  for (const q of QUESTS.slice(0, quests)) if (q.points) p = apply(p, gain(house, q.points, q.id));
  for (const e of extra) p = apply(p, e);
  return p;
}

describe('the house points', () => {
  it('count every gain and loss, and nothing that isn’t one', () => {
    let p = newPoints({ house: 'hufflepuff' });
    p = apply(p, gain('hufflepuff', 10, 'charms'));
    p = apply(p, gain('slytherin', -5, 'cauldron'));
    p = apply(p, { type: 'lesson', id: 'charms' });
    p = apply(p, gain('durmstrang', 50));
    p = apply(p, gain('hufflepuff', Number.NaN));
    expect(p.own).toEqual({ gryffindor: 0, hufflepuff: 10, ravenclaw: 0, slytherin: -5 });
    expect(p.log).toHaveLength(2);
    for (let i = 0; i < 30; i++) p = apply(p, gain('gryffindor', 1));
    expect(p.log).toHaveLength(12);
  });

  it('keep every gain and loss in one table, gains up and losses down', () => {
    for (const [id, row] of Object.entries(TABLE)) {
      expect(row.why.length, id).toBeGreaterThan(5);
      expect(row.delta, id).not.toBe(0);
    }
    expect(TABLE.curfew.delta).toBe(-20);
  });

  it('take a misdeed’s cost off your house', () => {
    const p = misdeed(newPoints({ house: 'gryffindor' }), { cost: 15, why: 'Stupefy at a prefect' });
    expect(p.own.gryffindor).toBe(-15);
    expect(p.log[0].why).toBe('Stupefy at a prefect');
  });

  it('run the rivals on by the week, never back, from nothing', () => {
    expect(Object.values(rivalsAt(1, { house: 'gryffindor' }))).toEqual([0, 0, 0]);
    const keys = Object.keys(rivalsAt(5, { house: 'gryffindor' }));
    expect(keys).not.toContain('gryffindor');
    expect(keys).toHaveLength(3);
    let was = rivalsAt(1, { house: 'gryffindor' });
    for (let w = 2; w <= 12; w++) {
      const now = rivalsAt(w, { house: 'gryffindor' });
      for (const h of keys) expect(now[h], `${h} at week ${w}`).toBeGreaterThanOrEqual(was[h]);
      was = now;
    }
    // (the leader under a full term’s quests)
    expect(Math.max(...Object.values(was))).toBeLessThan(FULL);
    // (and a different house leads in another year, now and then)
    const leaders = new Set([1, 2, 3, 4, 5, 6].map((year) => Object.entries(rivalsAt(12, { house: 'gryffindor', year })).sort((a, b) => b[1] - a[1])[0][0]));
    expect(leaders.size).toBeGreaterThan(1);
  });

  it('give the Cup to a house whose first-year does the quests, and not to one who doesn’t', () => {
    for (const house of HOUSES)
      for (const year of [1, 2, 3]) {
        expect(winner(term({ house, year }), 12), `${house} in year ${year}, every quest`).toBe(house);
        // (every quest, three Snitches, and caught twice after curfew: still the Cup)
        const busy = term({ house, year, extra: [gain(house, 10), gain(house, 10), gain(house, 10), gain(house, TABLE.curfew.delta), gain(house, TABLE.curfew.delta)] });
        expect(winner(busy, 12)).toBe(house);
        // (two-thirds of them: not enough)
        expect(winner(term({ house, year, quests: 8 }), 12), `${house} in year ${year}, eight quests`).not.toBe(house);
        // (none: last)
        expect(standings(term({ house, year, quests: 0 }), 12).at(-1).house).toBe(house);
      }
  });

  it('give every house its own students’ points, and never less than nought', () => {
    const p = misdeed(newPoints({ house: 'slytherin' }), { cost: 500 });
    const t = totals(p, 4);
    expect(t.slytherin).toBe(0);
    expect(t.gryffindor).toBeGreaterThanOrEqual(BASE * 3);
    expect(standings(p, 4)[0].you).toBe(false);
  });

  it('give a tie to your own house', () => {
    const p = newPoints({ house: 'hufflepuff' });
    expect(winner(p, 1)).toBe('hufflepuff');
  });

  it('say the points as a teacher would', () => {
    expect(toastFor(10, 'ravenclaw')).toBe('Ten points to Ravenclaw.');
    expect(toastFor(-20, 'slytherin')).toBe('Twenty points from Slytherin.');
    expect(toastFor(150, 'gryffindor')).toBe('A hundred and fifty points to Gryffindor.');
    expect(toastFor(1, 'hufflepuff')).toBe('One point to Hufflepuff.');
    expect(words(45)).toBe('forty-five');
    expect(words(312)).toBe('three hundred and twelve');
  });
});
