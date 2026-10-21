import { describe, expect, it } from 'vitest';
import { HOUSES, PATRONUS, SHIELD, SPELLS, at, beat, cast, kindsFor, newBolt, newWand, pick, readyIn, release, shieldOf, shieldUp, spellById, spellByKey, stepBolt, throwBack } from './spells';

const wand = (o) => newWand({ house: 'ravenclaw', ...o });

describe('the nine', () => {
  it('are the table’s nine, on keys 1 to 9, each with every field', () => {
    expect(SPELLS.map((s) => s.word)).toEqual(['Lumos', 'Wingardium Leviosa', 'Alohomora', 'Accio', 'Incendio', 'Expelliarmus', 'Stupefy', 'Protego', 'Expecto Patronum']);
    for (const [i, s] of SPELLS.entries()) {
      expect(s.key).toBe(i + 1);
      expect(spellByKey(i + 1)).toBe(s);
      expect(spellById(s.id)).toBe(s);
      for (const k of ['id', 'word', 'colour', 'kind', 'range', 'cost', 'cooldown', 'needs']) expect(s).toHaveProperty(k);
      expect(s.colour).toMatch(/^#[0-9a-f]{6}$/);
      expect(s.cooldown).toBeGreaterThan(0);
    }
  });
  it('gives every house its own Patronus', () => {
    expect(new Set(HOUSES.map((h) => PATRONUS[h])).size).toBe(4);
  });
});

describe('cooldowns', () => {
  it('a spell cast can’t be cast again until its cooldown is out', () => {
    let w = wand();
    const a = cast(w, 'alohomora', { kind: 'door', id: 'd', locked: true, dist: 2 });
    expect(a.effects[0].type).toBe('open');
    w = a.wand;
    expect(readyIn(w, 'alohomora')).toBeCloseTo(spellById('alohomora').cooldown);
    const b = cast(at(w, 0.5), 'alohomora', { kind: 'door', id: 'e', locked: true, dist: 2 });
    expect(b.effects[0]).toMatchObject({ type: 'fizzle', why: 'cooling' });
    expect(b.wand).toEqual(at(w, 0.5)); // nothing spent
    expect(cast(at(w, 1.01), 'alohomora', { kind: 'door', id: 'e', locked: true, dist: 2 }).effects[0].type).toBe('open');
  });
  it('each spell keeps its own', () => {
    const w = cast(wand(), 'stupefy').wand;
    expect(readyIn(w, 'expelliarmus')).toBe(0);
    expect(readyIn(w, 'stupefy')).toBeGreaterThan(2);
  });
});

describe('each spell', () => {
  it('Lumos lights the wand and the next cast is Nox', () => {
    const a = cast(wand(), 'lumos');
    expect(a.wand.lit).toBe(true);
    expect(a.effects[0]).toEqual({ type: 'light', on: true, word: 'Lumos' });
    const b = cast(at(a.wand, 1), 'lumos');
    expect(b.wand.lit).toBe(false);
    expect(b.effects[0].word).toBe('Nox');
  });
  it('Leviosa lifts a light thing in range and drops it when let go', () => {
    const a = cast(wand(), 'leviosa', { kind: 'stone', id: 's1', dist: 6 });
    expect(a.effects).toEqual([{ type: 'lift', id: 's1', thing: 'stone' }]);
    expect(a.wand.held).toBe('s1');
    const b = release(a.wand);
    expect(b.effects).toEqual([{ type: 'drop', id: 's1' }]);
    expect(b.wand.held).toBe(null);
    expect(release(b.wand).effects).toEqual([]);
  });
  it('Leviosa takes hold of feathers, stones, chairs and pumpkins, and not of a door', () => {
    for (const kind of ['feather', 'stone', 'chair', 'pumpkin']) expect(cast(wand(), 'leviosa', { kind, id: kind, dist: 3 }).effects[0].type).toBe('lift');
    expect(cast(wand(), 'leviosa', { kind: 'door', id: 'd', dist: 3 }).effects[0]).toMatchObject({ type: 'fizzle', why: 'nothing' });
    expect(cast(wand(), 'leviosa', { kind: 'stone', id: 's', dist: 30 }).effects[0]).toMatchObject({ type: 'fizzle', why: 'far' });
  });
  it('Alohomora opens a locked door that is allowed and says why one isn’t', () => {
    expect(cast(wand(), 'alohomora', { kind: 'door', id: 'd', locked: true, allowed: true, dist: 1 }).effects[0]).toEqual({ type: 'open', id: 'd' });
    const no = cast(wand(), 'alohomora', { kind: 'door', id: 'charms', locked: true, allowed: false, why: 'The Charms corridor. Not today.', dist: 1 });
    expect(no.effects[0]).toEqual({ type: 'refuse', id: 'charms', say: 'The Charms corridor. Not today.' });
    expect(cast(wand(), 'alohomora', { kind: 'door', id: 'd', locked: false, dist: 1 }).effects[0].why).toBe('open');
    expect(cast(wand(), 'alohomora', { kind: 'chest', id: 'c', locked: true, dist: 1 }).effects[0].type).toBe('open');
  });
  it('Accio pulls a broom from up to 20 m and no further', () => {
    expect(cast(wand(), 'accio', { kind: 'broom', id: 'b', dist: 19.9 }).effects[0]).toEqual({ type: 'pull', id: 'b', thing: 'broom' });
    expect(cast(wand(), 'accio', { kind: 'broom', id: 'b', dist: 20.1 }).effects[0].why).toBe('far');
    expect(cast(wand(), 'accio', { kind: 'snitch', id: 'sn', dist: 8 }).effects[0].type).toBe('pull');
  });
  it('Incendio lights a torch for good and a bale for a while, and not twice', () => {
    expect(cast(wand(), 'incendio', { kind: 'torch', id: 't', dist: 3 }).effects[0]).toMatchObject({ type: 'ignite', lasts: Infinity });
    expect(cast(wand(), 'incendio', { kind: 'bale', id: 'b', dist: 3 }).effects[0].lasts).toBe(6);
    expect(cast(wand(), 'incendio', { kind: 'cauldron', id: 'c', dist: 3, lit: true }).effects[0].why).toBe('lit');
    expect(cast(wand(), 'incendio', { kind: 'fireplace', id: 'f', dist: 3 }).effects[0].type).toBe('ignite');
  });
  it('Expelliarmus and Stupefy send bolts in their own colours', () => {
    const e = cast(wand(), 'expelliarmus', null).effects[0];
    const s = cast(wand(), 'stupefy', null).effects[0];
    expect(e).toMatchObject({ type: 'bolt', spell: 'expelliarmus' });
    expect(s).toMatchObject({ type: 'bolt', spell: 'stupefy' });
    expect(e.colour).not.toBe(s.colour);
  });
  it('Protego puts a shield up for a second, its first part the beat', () => {
    const w = cast(wand({ t: 10 }), 'protego').wand;
    expect(shieldUp(w)).toBe(true);
    expect(beat(w)).toBe(true);
    expect(shieldOf(at(w, 10 + SHIELD.beat + 0.05))).toBe('up');
    expect(shieldOf(at(w, 10 + SHIELD.up + 0.01))).toBe(null);
  });
  it('Expecto Patronum runs in the house’s shape once learnt, and is a mist before', () => {
    expect(cast(wand(), 'patronum').effects[0]).toMatchObject({ type: 'wisp' });
    expect(cast(wand({ learnt: ['patronus'] }), 'patronum').effects[0]).toMatchObject({ type: 'patronus', shape: 'hare' });
    expect(cast(newWand({ house: 'gryffindor', learnt: ['patronus'] }), 'patronum').effects[0].shape).toBe('stag');
  });
});

describe('points', () => {
  const neville = { kind: 'person', id: 'neville', dist: 5 };
  it('a spell at a person outside a duel is a misdeed, costing its cost', () => {
    const r = cast(wand(), 'stupefy', neville);
    expect(r.points).toBe(-spellById('stupefy').cost);
    expect(r.why).toBe('misdeed');
    expect(r.effects.at(-1)).toMatchObject({ type: 'misdeed', at: 'neville' });
    expect(cast(wand(), 'incendio', neville).points).toBeLessThan(0);
  });
  it('the same in a duel costs nothing, and so do the harmless ones', () => {
    expect(cast({ ...wand(), duel: true }, 'stupefy', neville).points).toBe(0);
    expect(cast(wand(), 'lumos', neville).points).toBe(0);
    expect(cast(wand(), 'protego', neville).points).toBe(0);
  });
  it('no spell gains points on its own', () => {
    for (const s of SPELLS) for (const t of [null, neville, { kind: 'stone', id: 's', dist: 1 }]) expect(cast({ ...wand(), learnt: ['patronus'] }, s, t).points).toBeLessThanOrEqual(0);
  });
});

describe('bolts', () => {
  const fly = (bolt, bodies, t = 3, dt = 1 / 60) => {
    for (let s = 0; s < t; s += dt) {
      const r = stepBolt(bolt, dt, bodies);
      bolt = r.bolt;
      if (r.hit) return r;
      if (bolt.life <= 0) break;
    }
    return { bolt, hit: null };
  };
  const foe = (shield = null) => ({ id: 'foe', p: [0, 0, 10], r: 0.35, h: 1.7, shield });
  it('flies straight at its speed and hits a figure in its way', () => {
    const b = newBolt('expelliarmus', [0, 1.4, 0], [0, 1.4, 10], 'me');
    const r = fly(b, [{ id: 'me', p: [0, 0, 0], r: 0.35, h: 1.7 }, foe()]);
    expect(r.hit).toMatchObject({ id: 'foe', by: 'expelliarmus', how: 'hit' });
    expect(r.hit.p[2]).toBeGreaterThan(9);
  });
  it('misses a figure off its line', () => {
    const b = newBolt('stupefy', [0, 1.4, 0], [3, 1.4, 10], 'me');
    expect(fly(b, [foe()]).hit).toBe(null);
  });
  it('is stopped by a shield, and thrown back home on the beat', () => {
    const b = newBolt('stupefy', [0, 1.4, 0], [0, 1.4, 10], 'me');
    expect(fly(b, [foe('up')]).hit.how).toBe('blocked');
    const r = fly(b, [foe('beat')]);
    expect(r.hit.how).toBe('back');
    expect(r.bolt.owner).toBe('foe');
    expect(r.bolt.v[2]).toBeLessThan(0);
    // home it goes, and hits the one who cast it
    const home = fly(r.bolt, [{ id: 'me', p: [0, 0, 0], r: 0.35, h: 1.7 }, foe()]);
    expect(home.hit).toMatchObject({ id: 'me', how: 'hit' });
  });
  it('runs out at its range', () => {
    const b = newBolt('expelliarmus', [0, 1.4, 0], [0, 1.4, 1], 'me');
    expect(fly(b, [], 5).bolt.life).toBeLessThanOrEqual(0);
    expect(throwBack(b, 'x').back).toBe(true);
  });
});

describe('aiming', () => {
  const things = [
    { id: 'a', kind: 'stone', p: [0, 1.6, -10], r: 0.2 },
    { id: 'b', kind: 'stone', p: [3, 1.6, -10], r: 0.2 },
    { id: 'c', kind: 'pumpkin', p: [0.4, 1.6, -30], r: 0.5 },
    { id: 'd', kind: 'door', p: [0, 1.6, -5], r: 1 },
  ];
  it('takes the thing nearest the wand’s line, of the kinds the spell can hold', () => {
    expect(pick(things, [0, 1.6, 0], [0, 0, -1], { kinds: kindsFor('leviosa') }).id).toBe('a');
    expect(pick(things, [0, 1.6, 0], [0.287, 0, -0.958], { kinds: kindsFor('leviosa') }).id).toBe('b');
    expect(pick(things, [0, 1.6, 0], [0, 0, -1], { kinds: kindsFor('alohomora') }).id).toBe('d');
  });
  it('nothing off the line, or out of range', () => {
    expect(pick(things, [0, 1.6, 0], [1, 0, 0])).toBe(null);
    expect(pick(things, [0, 1.6, 0], [0, 0, -1], { range: 5, kinds: ['stone'] })).toBe(null);
    expect(pick(things, [0, 1.6, 0], [0, 0, -1], { kinds: kindsFor('lumos') })).toBe(null);
  });
  it('gives the distance', () => {
    expect(pick(things, [0, 1.6, 0], [0, 0, -1], { kinds: ['stone'] }).dist).toBeCloseTo(10);
  });
});
