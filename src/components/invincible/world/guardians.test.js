import { describe, expect, it } from 'vitest';
import { CALL, GUARDIANS, SIG, bigFight, callCavalry, newCavalry, pick, stepCavalry } from './guardians';
import { GUARDIAN_LINES } from './lines';

const DOOR = [0, 0, 21];
const hero = [40, 2, 60];
const foe = (id, kind, p, extra = {}) => ({ id, kind, p, left: 1, live: true, ...extra });
const sense = (o = {}) => ({ hero, fight: true, foes: [], falling: null, crowd: null, home: DOOR, ...o });
function run(c, secs, s, dt = 1 / 30) {
  const ev = [];
  for (let t = 0; t < secs; t += dt) {
    const r = stepCavalry(c, typeof s === 'function' ? s(c, t) : s, dt);
    c = r.cav;
    ev.push(...r.ev);
  }
  return { cav: c, ev };
}

describe('the team', () => {
  it('is eight, each with a name, a tint, a mode and a signature', () => {
    expect(GUARDIANS).toHaveLength(8);
    for (const g of GUARDIANS) {
      expect(g.name).toBeTruthy();
      expect(['fly', 'ground']).toContain(g.mode);
      expect(['lead', 'blast', 'copies', 'blink', 'monster', 'mark', 'shield', 'catch']).toContain(g.sig);
    }
    expect(new Set(GUARDIANS.map((g) => g.id)).size).toBe(8);
  });
  it('has four lines each: thirty-two', () => {
    expect(Object.keys(GUARDIAN_LINES)).toHaveLength(8);
    for (const g of GUARDIANS) expect(GUARDIAN_LINES[g.id]).toHaveLength(4);
    expect(Object.values(GUARDIAN_LINES).flat()).toHaveLength(32);
  });
});

describe('pick', () => {
  it('sends Bulletproof for someone falling', () => expect(pick({ foes: [{ kind: 'flaxan' }], falling: true })[0]).toBe('bulletproof'));
  it('sends Black Samson for a crowd within 40 m', () => expect(pick({ foes: [{ kind: 'flaxan' }], crowd: 3 })).toContain('samson'));
  it('sends Rex for Maulers', () => expect(pick({ foes: [{ kind: 'mauler' }] })).toContain('rex'));
  it('sends Robot for a foe nobody knows', () => expect(pick({ foes: [{ kind: 'sequid' }] })).toContain('robot'));
  it('never sends the same one twice, and always two', () => {
    for (const f of [{}, { foes: [{ kind: 'mauler' }], falling: true, crowd: 2 }, { foes: [{ kind: 'flaxan' }] }]) {
      const two = pick(f);
      expect(two).toHaveLength(2);
      expect(two[0]).not.toBe(two[1]);
    }
    expect(pick({ foes: [{ kind: 'mauler' }], falling: true, crowd: 2 })).toEqual(['bulletproof', 'samson']);
  });
});

describe('a big fight', () => {
  it('is a mission fight, or four or more within 400 m', () => {
    const four = [0, 1, 2, 3].map((i) => foe(i, 'flaxan', [hero[0] + i * 10, 20, hero[2]]));
    expect(bigFight(four, hero)).toBe(true);
    expect(bigFight(four.slice(0, 3), hero)).toBe(false);
    expect(bigFight(four.slice(0, 1), hero, 'ep2')).toBe(true);
    expect(bigFight(four.map((e) => ({ ...e, p: [e.p[0] + 500, e.p[1], e.p[2]] })), hero)).toBe(false);
  });
  it('is never episode 8, which is Mark’s and Dad’s alone', () => expect(bigFight([foe(7, 'omniman', hero)], hero, 'ep8')).toBe(false));
  it('is nothing with nobody standing', () => expect(bigFight([], hero, 'ep2')).toBe(false));
});

describe('the cavalry', () => {
  it('comes from the door to the fight, and lands blows there', () => {
    const c = callCavalry(newCavalry(), ['immortal', 'kate'], DOOR);
    expect(c.on).toBe(true);
    expect(c.who.map((w) => w.state)).toEqual(['come', 'come']);
    const s = sense({ foes: [foe(1, 'flaxan', [40, 8, 100])] });
    const { cav, ev } = run(c, 12, s);
    expect(ev.filter((e) => e.type === 'arrive').map((e) => e.who).sort()).toEqual(['immortal', 'kate']);
    const hits = ev.filter((e) => e.type === 'gHit' && e.who === 'immortal');
    expect(hits.length).toBeGreaterThan(2);
    expect(hits[0].foe).toBe(1);
    for (const w of cav.who) expect(Math.hypot(w.p[0] - 40, w.p[2] - 100)).toBeLessThan(CALL.reach[w.id === 'immortal' ? 'fly' : 'ground'] + CALL.off[w.id === 'immortal' ? 'fly' : 'ground'] + 0.5);
  });
  it('Dupli-Kate’s copies hold a foe two seconds', () => {
    const c = callCavalry(newCavalry(), ['kate', 'immortal'], [40, 0, 96]);
    const { ev, cav } = run(c, 3, sense({ foes: [foe(1, 'flaxan', [40, 0, 100])] }));
    const hold = ev.find((e) => e.type === 'gHold');
    expect(hold).toMatchObject({ who: 'kate', foe: 1, for: SIG.copies.hold });
    expect(SIG.copies.hold).toBe(2);
    expect(SIG.copies.n).toBe(4);
    expect(cav.who.find((w) => w.id === 'kate').copies).toBeGreaterThanOrEqual(0);
  });
  it('Monster Girl is a monster twelve seconds, three blows a swing, then winded', () => {
    const c = callCavalry(newCavalry(), ['monster', 'immortal'], [40, 0, 96]);
    const { ev, cav } = run(c, 30, sense({ foes: [foe(1, 'mauler', [40, 0, 100])] }));
    const hers = ev.filter((e) => e.type === 'gHit' && e.who === 'monster');
    expect(hers[0].hits).toBe(3);
    expect(hers.some((e) => e.hits === 3)).toBe(true);
    expect(SIG.monster.for).toBe(12);
    const w = cav.who.find((x) => x.id === 'monster');
    expect(w.winded).toBe(true);
    expect(w.monster).toBe(0);
    // (winded: no blow in the last ten seconds)
    const late = run(cav, 10, sense({ foes: [foe(1, 'mauler', [40, 0, 100])] })).ev.filter((e) => e.type === 'gHit' && e.who === 'monster');
    expect(late).toHaveLength(0);
  });
  it('Shrinking Rae reappears behind a foe and staggers it', () => {
    const c = callCavalry(newCavalry(), ['rae', 'immortal'], [40, 2, 96]);
    const { ev, cav } = run(c, 4, sense({ foes: [foe(1, 'flaxan', [40, 8, 100])] }));
    const st = ev.find((e) => e.type === 'gStagger');
    expect(st).toMatchObject({ who: 'rae', foe: 1, for: SIG.blink.stagger });
    const rae = cav.who.find((w) => w.id === 'rae');
    // (behind it: further from Mark than it is)
    expect(rae.p[2]).toBeGreaterThan(100 - 0.5);
  });
  it('Rex’s blast is a blow on everyone near where it lands', () => {
    const c = callCavalry(newCavalry(), ['rex', 'immortal'], [40, 0, 96]);
    const { ev } = run(c, 4, sense({ foes: [foe(1, 'mauler', [40, 0, 100])] }));
    expect(ev.find((e) => e.type === 'gBlast')).toMatchObject({ who: 'rex', at: [40, 0, 100], r: SIG.blast.r });
  });
  it('Robot marks the strongest foe', () => {
    const c = callCavalry(newCavalry(), ['robot', 'immortal'], [40, 2, 96]);
    const { ev, cav } = run(c, 1, sense({ foes: [foe(1, 'flaxan', [40, 8, 100]), foe(2, 'mauler', [60, 0, 100], { left: 3 })] }));
    expect(ev.find((e) => e.type === 'gMark')).toMatchObject({ who: 'robot', foe: 2 });
    expect(cav.marked).toBe(2);
  });
  it('Black Samson stands with the crowd, his wall up', () => {
    const c = callCavalry(newCavalry(), ['samson', 'immortal'], [40, 0, 96]);
    const { ev, cav } = run(c, 6, sense({ foes: [foe(1, 'flaxan', [40, 8, 100])], crowd: [40, 0, 90] }));
    expect(ev.find((e) => e.type === 'gShield')).toMatchObject({ who: 'samson', at: [40, 0, 90], r: SIG.shield.r });
    const s = cav.who.find((w) => w.id === 'samson');
    expect(Math.hypot(s.p[0] - 40, s.p[2] - 90)).toBeLessThan(3);
  });
  it('Bulletproof goes for whoever is falling', () => {
    const c = callCavalry(newCavalry(), ['bulletproof', 'immortal'], [40, 2, 96]);
    const { ev } = run(c, 3, sense({ foes: [foe(1, 'flaxan', [40, 8, 100])], falling: [60, 40, 120] }));
    expect(ev.find((e) => e.type === 'gCatch')).toMatchObject({ who: 'bulletproof' });
  });
  it('goes home when the fight is over, and is gone at the door', () => {
    const c = callCavalry(newCavalry(), ['immortal', 'kate'], DOOR);
    const mid = run(c, 6, sense({ foes: [foe(1, 'flaxan', [40, 8, 100])] })).cav;
    const { cav, ev } = run(mid, 30, sense({ fight: false }));
    expect(cav.on).toBe(false);
    expect(cav.who).toEqual([]);
    expect(ev.at(-1).type).toBe('gone');
  });
  it('takes a minute-long step as one short one', () => {
    const c = callCavalry(newCavalry(), ['immortal', 'kate'], DOOR);
    const { cav } = stepCavalry(c, sense({ foes: [foe(1, 'flaxan', [40, 8, 100])] }), 60);
    for (const w of cav.who) expect(Math.hypot(w.p[0] - DOOR[0], w.p[2] - DOOR[2])).toBeLessThan(10);
  });
});
