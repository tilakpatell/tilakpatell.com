import { describe, expect, it } from 'vitest';
import { BLOB_MAX, CHAT_MAX, EPOCH_MAX, PARTY_ID, PARTY_MAX, newPartyId, readEpoch, readParty, readPartyId, readQuip, readSay, writeParty } from './partyWire';
import { QUIPS } from './quips';
import { RATES, createLimiter } from './protocol';

const pilot = (n) => n.toString(16).padStart(64, '0'); // (a pilot’s id is their key: 64 hex digits)
const P = '0123456789abcdef';
const roster = (n, o = {}) => ({ t: 'ros', p: P, l: pilot(1), e: 3, m: Array.from({ length: n }, (_, i) => ({ id: pilot(i + 1), name: `Pilot ${i + 1}` })), ...o });
// a roster as it goes over the wire
const wire = (n, o = {}) => ({ t: 'ros', p: P, l: pilot(1), e: 3, m: Array.from({ length: n }, (_, i) => [pilot(i + 1), `Pilot ${i + 1}`]), ...o });

describe('the party’s numbers', () => {
  it('holds eight, says two hundred characters a line', () => {
    expect(PARTY_MAX).toBe(8);
    expect(CHAT_MAX).toBe(200);
  });
  it('lets a pilot send so much of each, as the room counts it', () => {
    expect(RATES.party).toEqual([1, 6]);
    expect(RATES.psay).toEqual([1, 4]);
    expect(RATES.quip).toEqual([0.5, 3]);
    // three quips at once, then one every two seconds
    const lim = createLimiter();
    let ok = 0;
    for (let i = 0; i < 10; i++) ok += lim.allow('quip', 1000) ? 1 : 0;
    expect(ok).toBe(3);
    expect(lim.allow('quip', 2500)).toBe(false);
    expect(lim.allow('quip', 3001)).toBe(true);
  });
});

describe('party ids', () => {
  it('reads sixteen hex digits, and nothing else', () => {
    expect(readPartyId(P)).toBe(P);
    expect(PARTY_ID.test(P)).toBe(true);
    for (const v of ['0123456789ABCDEF', '0123456789abcde', '0123456789abcdef0', ` ${P}`, 'ghijklmnopqrstuv', 12, null, undefined, {}, [P]]) expect(readPartyId(v)).toBeNull();
  });
  it('makes a new one from eight random bytes', () => {
    expect(newPartyId((a) => a.fill(0xab))).toBe('abababababababab');
    expect(
      newPartyId((a) => {
        a.forEach((_, i) => (a[i] = i));
        return a;
      }),
    ).toBe('0001020304050607');
    const a = newPartyId();
    expect(readPartyId(a)).toBe(a);
    expect(newPartyId()).not.toBe(a);
  });
});

describe('readParty', () => {
  it('reads each word of a party', () => {
    expect(readParty({ t: 'inv', p: P, l: pilot(1) })).toEqual({ t: 'inv', p: P, l: pilot(1) });
    expect(readParty({ t: 'join', p: P })).toEqual({ t: 'join', p: P });
    expect(readParty({ t: 'no', p: P })).toEqual({ t: 'no', p: P });
    expect(readParty({ t: 'left', p: P })).toEqual({ t: 'left', p: P });
    expect(readParty({ t: 'out', p: P })).toEqual({ t: 'out', p: P });
    expect(readParty({ t: 'sum', p: P, w: '/middle-earth/bree' })).toEqual({ t: 'sum', p: P, w: '/middle-earth/bree' });
    expect(readParty(wire(2))).toEqual(roster(2));
  });
  it('takes only the fields of its word', () => {
    expect(readParty({ t: 'join', p: P, l: pilot(1), m: [[pilot(9), 'Sneak']], extra: 1 })).toEqual({ t: 'join', p: P });
  });
  it('turns away a word it does not know, or no word at all', () => {
    for (const v of [null, undefined, 'inv', 3, [], ['inv', P], { p: P }, { t: 'ask', p: P }, { t: 'INV', p: P, l: pilot(1) }, { t: 'toString', p: P }]) expect(readParty(v)).toBeNull();
  });
  it('turns away a word for no party, or for one that is not an id', () => {
    for (const t of ['join', 'no', 'left', 'out']) {
      expect(readParty({ t })).toBeNull();
      expect(readParty({ t, p: P.toUpperCase() })).toBeNull();
      expect(readParty({ t, p: 7 })).toBeNull();
    }
  });
  it('turns away an invite with no leader to join', () => {
    expect(readParty({ t: 'inv', p: P })).toBeNull();
    expect(readParty({ t: 'inv', p: P, l: 'Alpha' })).toBeNull();
    expect(readParty({ t: 'inv', p: P, l: 'ab'.repeat(32) })).toEqual({ t: 'inv', p: P, l: 'ab'.repeat(32) });
    expect(readParty({ t: 'inv', p: P, l: 'AB'.repeat(32) })).toBeNull();
    expect(readParty({ t: 'inv', p: P, l: 'ab'.repeat(33) })).toBeNull();
    expect(readParty({ t: 'inv', p: 'x', l: pilot(1) })).toBeNull();
  });
  it('turns away a summons to nowhere the site has', () => {
    expect(readParty({ t: 'sum', p: P })).toBeNull();
    expect(readParty({ t: 'sum', p: P, w: 'https://elsewhere.example' })).toBeNull();
    expect(readParty({ t: 'sum', p: P, w: '/Bree' })).toBeNull();
    expect(readParty({ t: 'sum', p: P, w: `/${'a'.repeat(80)}` })).toBeNull();
  });

  describe('a roster', () => {
    it('keeps the members in the order they joined, with their names cleaned', () => {
      const r = readParty({ ...wire(3), m: [[pilot(3), '  Han ‮ Solo  '], [pilot(1), 'Leia'], [pilot(2), 'x'.repeat(40)]] });
      expect(r.m).toEqual([
        { id: pilot(3), name: 'Han Solo' },
        { id: pilot(1), name: 'Leia' },
        { id: pilot(2), name: 'x'.repeat(16) },
      ]);
    });
    it('calls a member with no readable name a pilot', () => {
      const r = readParty({ ...wire(4), m: [[pilot(1), 'Leia'], [pilot(2), ''], [pilot(3), 42], [pilot(4)]] });
      expect(r.m.map((x) => x.name)).toEqual(['Leia', 'Pilot', 'Pilot', 'Pilot']);
    });
    it('holds one to eight', () => {
      expect(readParty(wire(1))).toEqual(roster(1));
      expect(readParty(wire(PARTY_MAX))).toEqual(roster(PARTY_MAX));
      expect(readParty(wire(PARTY_MAX + 1))).toBeNull();
      expect(readParty(wire(0))).toBeNull();
    });
    it('names a leader who is in it', () => {
      expect(readParty(wire(3, { l: pilot(3) })).l).toBe(pilot(3));
      expect(readParty(wire(3, { l: pilot(9) }))).toBeNull();
      expect(readParty(wire(3, { l: null }))).toBeNull();
    });
    it('turns away a member twice, or one who is not a key', () => {
      expect(readParty({ ...wire(2), m: [[pilot(1), 'Leia'], [pilot(1), 'Leia again']] })).toBeNull();
      expect(readParty({ ...wire(2), m: [[pilot(1), 'Leia'], ['Han', 'Han']] })).toBeNull();
      expect(readParty({ ...wire(2), m: [[pilot(1), 'Leia'], { id: pilot(2), name: 'Han' }] })).toBeNull();
      expect(readParty({ ...wire(2), m: [[pilot(1), 'Leia'], null] })).toBeNull();
      expect(readParty({ ...wire(2), m: 'everyone' })).toBeNull();
    });
    it('carries a whole epoch, one or more', () => {
      expect(readParty(wire(2, { e: 1 })).e).toBe(1);
      expect(readParty(wire(2, { e: 12345 })).e).toBe(12345);
      for (const e of [0, -1, 1.5, '3', null, NaN, Infinity, 2 ** 53]) expect(readParty(wire(2, { e }))).toBeNull();
    });
    it('stops one short of the largest whole number, so an epoch can always be told apart from the next', () => {
      // (a roster at Number.MAX_SAFE_INTEGER would leave no epoch past it: the party could never change again)
      expect(EPOCH_MAX).toBe(Number.MAX_SAFE_INTEGER - 1);
      expect(readParty(wire(2, { e: EPOCH_MAX })).e).toBe(EPOCH_MAX);
      expect(readParty(wire(2, { e: Number.MAX_SAFE_INTEGER }))).toBeNull();
      expect(writeParty(roster(2, { e: Number.MAX_SAFE_INTEGER }))).toBeNull();
    });
  });
});

describe('readEpoch', () => {
  it('reads an epoch as a roster carries it (a hello’s `pe`), or null', () => {
    expect(readEpoch(1)).toBe(1);
    expect(readEpoch(EPOCH_MAX)).toBe(EPOCH_MAX);
    for (const v of [0, -1, 1.5, '3', null, undefined, NaN, Infinity, Number.MAX_SAFE_INTEGER, [1], {}]) expect(readEpoch(v)).toBeNull();
  });
});

describe('writeParty', () => {
  const words = [{ t: 'inv', p: P, l: pilot(1) }, { t: 'join', p: P }, { t: 'no', p: P }, { t: 'left', p: P }, { t: 'out', p: P }, { t: 'sum', p: P, w: '/galaxy/hoth' }, roster(1), roster(PARTY_MAX, { l: pilot(5), e: 9 })];
  it('is read back as it was written', () => {
    for (const x of words) expect(readParty(writeParty(x))).toEqual(x);
  });
  it('sends the members as [id, name] pairs', () => {
    expect(writeParty(roster(2))).toEqual(wire(2));
  });
  it('sends the fields of its word and nothing else', () => {
    expect(writeParty({ t: 'join', p: P, l: pilot(1), secret: 'x' })).toEqual({ t: 'join', p: P });
    // (a party’s member as party.js keeps one: when they joined stays here)
    expect(writeParty({ ...roster(1), m: [{ id: pilot(1), name: 'Pilot 1', since: 5 }] }).m).toEqual([[pilot(1), 'Pilot 1']]);
  });
  it('sends a name as anyone would read it', () => {
    expect(writeParty({ ...roster(2), m: [{ id: pilot(1), name: '  Leia  ' }, { id: pilot(2), name: null }] }).m).toEqual([
      [pilot(1), 'Leia'],
      [pilot(2), 'Pilot'],
    ]);
  });
  it('writes nothing for a word no one would read', () => {
    expect(writeParty({ t: 'inv', p: P })).toBeNull();
    expect(writeParty(roster(PARTY_MAX + 1))).toBeNull();
    expect(writeParty({ t: 'shout', p: P })).toBeNull();
    expect(writeParty(null)).toBeNull();
  });
});

describe('readSay', () => {
  const blob = (n = 40, c = 'A') => c.repeat(n);
  it('reads a sealed line: a blob for each mate there', () => {
    expect(readSay({ b: ['abc-_09XYZ'] })).toEqual({ b: ['abc-_09XYZ'] });
    const seven = Array.from({ length: PARTY_MAX - 1 }, (_, i) => blob(10 + i));
    expect(readSay({ b: seven })).toEqual({ b: seven });
  });
  it('keeps nothing else, and a copy of the blobs', () => {
    const b = [blob()];
    const said = readSay({ b, p: P, to: [pilot(1)] });
    expect(said).toEqual({ b });
    expect(said.b).not.toBe(b);
  });
  it('has room for the longest line, in any script', () => {
    // CHAT_MAX characters of four bytes each, in partyCrypt.js’s layout
    // (the IV, the length and the text zero-filled to 32s, the tag)
    const bytes = 12 + Math.ceil((2 + CHAT_MAX * 4) / 32) * 32 + 16;
    expect(BLOB_MAX).toBe(Math.ceil((bytes * 4) / 3));
    expect(BLOB_MAX).toBeGreaterThanOrEqual(700);
    expect(readSay({ b: [blob(BLOB_MAX)] })).not.toBeNull();
    expect(readSay({ b: [blob(BLOB_MAX + 1)] })).toBeNull();
  });
  it('turns away none, too many, or a blob that is not base64url', () => {
    expect(readSay({ b: [] })).toBeNull();
    expect(readSay({ b: Array.from({ length: PARTY_MAX }, () => blob()) })).toBeNull();
    for (const bad of ['', 'a+b', 'a/b', 'abc=', 'a b', 'é', 7, null]) expect(readSay({ b: [blob(), bad] })).toBeNull();
    for (const v of [null, undefined, 'abc', [], { b: 'abc' }, { b: null }, [['abc']]]) expect(readSay(v)).toBeNull();
  });
});

describe('readQuip', () => {
  it('reads one of the set lines, by its index', () => {
    expect(readQuip({ q: 0 })).toEqual({ q: 0 });
    expect(readQuip({ q: QUIPS.length - 1, x: 'shout' })).toEqual({ q: QUIPS.length - 1 });
  });
  it('turns away anything that is not one of them', () => {
    for (const q of [-1, QUIPS.length, 1.5, '3', null, NaN, 'Hello']) expect(readQuip({ q })).toBeNull();
    for (const v of [null, undefined, 3, [3], {}]) expect(readQuip(v)).toBeNull();
  });
});
