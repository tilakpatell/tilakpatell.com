import { describe, expect, it } from 'vitest';
import { createSaves } from '../../../runtime/saves';
import { PARTY_MAX } from './partyWire';
import { FOLLOW_KEY, PARTY_DAYS, PARTY_KEY, PARTY_KEYS, createPartyStore } from './partyStore';

const DAY = 24 * 60 * 60 * 1000;
const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), raw: m };
};
const broken = () => ({
  getItem() {
    throw new Error('denied');
  },
  setItem() {
    throw new Error('denied');
  },
  removeItem() {
    throw new Error('denied');
  },
});
const clock = (t = 1000) => {
  const c = { t, now: () => c.t };
  return c;
};
// (a pilot’s id is their key: 64 hex digits, each pilot’s first 16 their own)
const pilot = (n) => n.toString(16).padStart(2, '0').repeat(32);
const short = (n) => pilot(n).slice(0, 16);
const PARTY = 'c0ffee00c0ffee00';
const OTHER = 'beef0000beef0000';
const crew = (n) => Array.from({ length: n }, (_, i) => ({ id: pilot(i + 1), name: `Pilot ${i + 1}`, since: 100 * (i + 1) }));
// a party as party.js has it: pilot 1 leads, n members, at epoch n
const partyOf = (n = 3, more = {}) => ({ id: PARTY, leader: pilot(1), epoch: n, members: crew(n), ...more });
const stored = (local) => JSON.parse(local.raw.get(PARTY_KEY));
const storeOn = (local, now = () => 2000) => createPartyStore({ saves: createSaves({ local, session: memory() }), now });

describe('createPartyStore', () => {
  it('keeps your party under the key you flew, and reads it back next visit', () => {
    expect(PARTY_KEY).toBe('tp-party');
    const local = memory();
    const c = clock(5000);
    const store = storeOn(local, c.now);
    expect(store.get(pilot(2))).toBeNull();
    store.save(partyOf(3), pilot(2));
    const want = { party: partyOf(3), as: short(2), seen: 5000 };
    expect(store.get(pilot(2))).toEqual(want);
    // kept as version 2 of its key: an entry for each key flown
    expect(stored(local)).toEqual({ v: 2, data: { keys: { [short(2)]: { party: partyOf(3), seen: 5000 } } } });
    // the next visit
    expect(storeOn(local, c.now).get(pilot(2))).toEqual(want);
    // (the key said as it’s kept, its first 16 hex digits, is taken as well)
    expect(store.get(short(2))).toEqual(want);
    store.save(partyOf(4), short(2));
    expect(store.get(pilot(2)).party.epoch).toBe(4);
    // another key’s party isn’t yours, and asking with no key is asking for none
    expect(store.get(pilot(3))).toBeNull();
    expect(store.get()).toBeNull();
    expect(store.get('<b>')).toBeNull();
  });

  it('keeps each key’s apart: a guest tab’s party never takes the place of the main key’s', () => {
    const local = memory();
    const saves = createSaves({ local, session: memory() });
    const c = clock(1000);
    const main = createPartyStore({ saves, now: c.now });
    const guest = createPartyStore({ saves, now: c.now });
    main.save(partyOf(3), pilot(1));
    c.t = 2000;
    guest.save(partyOf(2, { id: OTHER, leader: pilot(9), members: [{ id: pilot(9), name: 'Guest', since: 1 }, ...crew(1)] }), pilot(9));
    // (the guest’s save, last, kept the main key’s)
    expect(storeOn(local).get(pilot(1))).toEqual({ party: partyOf(3), as: short(1), seen: 1000 });
    expect(main.get(pilot(9)).party.id).toBe(OTHER);
    guest.clear(pilot(9));
    expect(main.get(pilot(1)).party.id).toBe(PARTY);
    expect(storeOn(local).get(pilot(9))).toBeNull();
    // (the last one cleared: nothing kept at all)
    main.clear(pilot(1));
    expect(local.raw.has(PARTY_KEY)).toBe(false);
  });

  it('keeps PARTY_KEYS keys at most: the one seen longest ago goes first', () => {
    expect(PARTY_KEYS).toBe(4);
    const c = clock(1000);
    const local = memory();
    const store = storeOn(local, c.now);
    for (const n of [1, 2, 3, 4]) {
      c.t += 1000;
      store.save(partyOf(2), pilot(n));
    }
    c.t += 1000;
    store.touch(pilot(1)); // (the first, seen again: now the newest)
    c.t += 1000;
    store.save(partyOf(2), pilot(5));
    expect([1, 2, 3, 4, 5].map((n) => storeOn(local, c.now).get(pilot(n)) !== null)).toEqual([true, false, true, true, true]);
  });

  it('is seen again when touched, and forgotten after PARTY_DAYS unseen, each key on its own', () => {
    expect(PARTY_DAYS).toBe(14);
    const local = memory();
    const saves = createSaves({ local, session: memory() });
    const c = clock(0);
    const store = createPartyStore({ saves, now: c.now });
    store.touch(pilot(1)); // (nothing kept: nothing to touch)
    expect(store.get(pilot(1))).toBeNull();
    expect(local.raw.has(PARTY_KEY)).toBe(false);
    store.save(partyOf(2), pilot(1));
    store.save(partyOf(3), pilot(2));
    c.t = 10 * DAY;
    store.touch(pilot(1));
    expect(store.get(pilot(1)).seen).toBe(10 * DAY);
    expect(createPartyStore({ saves, now: c.now }).get(pilot(1)).seen).toBe(10 * DAY);
    c.t = 14 * DAY;
    expect(store.get(pilot(2))).toBeNull(); // (unseen fourteen days)
    expect(store.get(pilot(1))?.party.id).toBe(PARTY);
    c.t = 24 * DAY - 1;
    expect(store.get(pilot(1))?.party.id).toBe(PARTY);
    c.t = 24 * DAY;
    expect(store.get(pilot(1))).toBeNull();
    expect(local.raw.has(PARTY_KEY)).toBe(false); // (forgotten in the browser too)
    store.touch(pilot(1)); // (forgotten: a touch brings nothing back)
    expect(store.get(pilot(1))).toBeNull();
  });

  it('forgets a key’s party when cleared, here and next visit, and only that key’s', () => {
    const local = memory();
    const saves = createSaves({ local, session: memory() });
    const store = createPartyStore({ saves, now: () => 1000 });
    store.save(partyOf(2), pilot(1));
    store.save(partyOf(3), pilot(2));
    store.clear(pilot(1));
    expect(store.get(pilot(1))).toBeNull();
    expect(createPartyStore({ saves, now: () => 1000 }).get(pilot(1))).toBeNull();
    expect(createPartyStore({ saves, now: () => 1000 }).get(pilot(2)).party.epoch).toBe(3);
    store.clear(pilot(1)); // (nothing kept: still nothing)
    store.clear(); // (no key: nothing to clear)
    expect(store.get(pilot(2)).party.epoch).toBe(3);
  });

  it('saves only what it could read back: anything else forgets the party that key had', () => {
    const saves = createSaves({ local: memory(), session: memory() });
    const store = createPartyStore({ saves, now: () => 1000 });
    store.save(partyOf(3), pilot(2)); // (another key’s, which no bad save touches)
    for (const party of [
      null, // (no party: you left, or were removed)
      partyOf(2, { leader: pilot(9) }),
      partyOf(PARTY_MAX + 1),
      partyOf(2, { id: 'party' }),
      partyOf(2, { epoch: 0 }),
      partyOf(2, { epoch: Number.MAX_SAFE_INTEGER }),
      'a party',
    ]) {
      store.save(partyOf(2), pilot(1));
      store.save(party, pilot(1));
      expect(store.get(pilot(1))).toBeNull();
      expect(createPartyStore({ saves, now: () => 1000 }).get(pilot(1))).toBeNull();
    }
    // (no key said, or one that isn’t one: never yours to re-form, and nothing’s kept)
    for (const as of [null, '<b>', 'C'.repeat(64)]) store.save(partyOf(2), as);
    expect(createPartyStore({ saves, now: () => 1000 }).get(pilot(2)).party.epoch).toBe(3);
    // a full party is kept; names are cleaned, a time that isn’t one is 0, and nothing else is carried
    store.save(partyOf(PARTY_MAX), pilot(1));
    expect(store.get(pilot(1)).party.members).toHaveLength(PARTY_MAX);
    const members = [
      { id: pilot(1), name: 'Han‮<b>', since: 'later', ship: 'Falcon' },
      { id: pilot(2), name: 42, since: 5 },
    ];
    store.save({ ...partyOf(2), members, secret: 'x' }, pilot(1));
    expect(createPartyStore({ saves, now: () => 1000 }).get(pilot(1)).party).toEqual({
      id: PARTY,
      leader: pilot(1),
      epoch: 2,
      members: [
        { id: pilot(1), name: 'Han<b>', since: 0 },
        { id: pilot(2), name: 'Pilot', since: 5 },
      ],
    });
  });

  it('reads a corrupt or doctored save as nothing, as a stranger’s roster would be, and one bad key as only that key gone', () => {
    const good = { party: partyOf(3), seen: 1000 };
    const local = memory();
    local.setItem(PARTY_KEY, JSON.stringify({ v: 2, data: { keys: { [short(1)]: good } } }));
    expect(storeOn(local).get(pilot(1))).toEqual({ ...good, as: short(1) });
    const doctored = [
      { ...good, party: null },
      { ...good, party: [partyOf(3)] },
      { ...good, seen: undefined },
      { ...good, seen: 'yesterday' },
      { ...good, seen: -1 },
      { ...good, party: { ...good.party, id: 'C0FFEE00C0FFEE00' } },
      { ...good, party: { ...good.party, id: undefined } },
      { ...good, party: { ...good.party, epoch: 1.5 } },
      { ...good, party: { ...good.party, epoch: '3' } },
      { ...good, party: { ...good.party, epoch: -2 } },
      { ...good, party: { ...good.party, leader: pilot(9) } },
      { ...good, party: { ...good.party, leader: undefined } },
      { ...good, party: { ...good.party, members: [] } },
      { ...good, party: { ...good.party, members: 'everyone' } },
      { ...good, party: { ...good.party, members: crew(PARTY_MAX + 1) } },
      { ...good, party: { ...good.party, members: [...crew(2), crew(1)[0]] } }, // (there twice)
      { ...good, party: { ...good.party, members: [...crew(2), { id: 'not-a-pilot', name: 'Nope', since: 1 }] } },
      { ...good, party: { ...good.party, members: [...crew(2), { id: 'A'.repeat(64), name: 'Shouty', since: 1 }] } },
      { ...good, party: { ...good.party, members: [...crew(2), 7] } },
      { ...good, party: { ...good.party, members: [...crew(2), [pilot(3), 'Pilot 3']] } },
    ];
    const junk = ['not json', '[1,2,3]', '{"v":2,"data":"x"}', 'null', '{"v":2,"data":[]}', '{"v":2,"data":null}', '{"v":2,"data":{"keys":[]}}', '{"v":2,"data":{"keys":"x"}}'];
    for (const raw of [...junk, ...doctored.map((entry) => JSON.stringify({ v: 2, data: { keys: { [short(1)]: entry } } }))]) {
      const local = memory();
      local.setItem(PARTY_KEY, raw);
      expect(storeOn(local).get(pilot(1))).toBeNull();
    }
    // a doctored entry under one key, a good one under another: the good one’s kept
    const mixed = memory();
    mixed.setItem(PARTY_KEY, JSON.stringify({ v: 2, data: { keys: { [short(1)]: doctored[0], [short(2)]: good, ['C'.repeat(16)]: good, toString: good } } }));
    expect(storeOn(mixed).get(pilot(2))).toEqual({ ...good, as: short(2) });
    expect(storeOn(mixed).get(pilot(1))).toBeNull();
  });

  it('reads version 1, one party for one key, as that key’s', () => {
    // (what this browser kept before a key had its own: its `as` becomes its key)
    const v1 = { party: partyOf(3), as: short(1), seen: 1000 };
    const local = memory();
    local.setItem(PARTY_KEY, JSON.stringify({ v: 1, data: v1 }));
    const store = storeOn(local);
    expect(store.get(pilot(1))).toEqual(v1);
    expect(stored(local)).toEqual({ v: 2, data: { keys: { [short(1)]: { party: partyOf(3), seen: 1000 } } } });
    // (one kept with the whole key as `as`, too; one that can’t be read is none)
    local.setItem(PARTY_KEY, JSON.stringify({ v: 1, data: { ...v1, as: pilot(1) } }));
    expect(storeOn(local).get(pilot(1))).toEqual(v1);
    for (const data of [{ ...v1, as: 'C'.repeat(16) }, { ...v1, party: null }, null, 'x']) {
      local.setItem(PARTY_KEY, JSON.stringify({ v: 1, data }));
      expect(storeOn(local).get(pilot(1))).toBeNull();
    }
  });

  it('hears another tab’s changes, and not its own', () => {
    const saves = createSaves({ local: memory(), session: memory() });
    const c = clock(1000);
    const one = createPartyStore({ saves, now: c.now });
    const two = createPartyStore({ saves, now: c.now });
    const heard = { one: 0, two: 0 };
    one.on(() => (heard.one += 1));
    const off = two.on(() => (heard.two += 1));
    one.save(partyOf(2), pilot(1));
    expect(two.get(pilot(1))).toEqual(one.get(pilot(1)));
    c.t = 2000;
    one.touch(pilot(1));
    expect(two.get(pilot(1)).seen).toBe(2000);
    one.clear(pilot(1));
    expect(two.get(pilot(1))).toBeNull();
    expect(heard).toEqual({ one: 0, two: 3 });
    // what another tab writes is read as a stranger’s would be
    saves.set(PARTY_KEY, { keys: { [short(1)]: { party: { ...partyOf(2), leader: pilot(9) }, seen: 2000 } } });
    expect(two.get(pilot(1))).toBeNull();
    // (and a tab still on version 1 is heard as that key’s)
    saves.set(PARTY_KEY, { party: partyOf(2), as: short(1), seen: 2000 });
    expect(two.get(pilot(1)).party.epoch).toBe(2);
    expect(heard.two).toBe(5);
    off();
    one.save(partyOf(3), pilot(1));
    expect(heard.two).toBe(5);
    expect(two.get(pilot(1)).party.epoch).toBe(3); // (still heard, only not told)
  });

  it('keeps the party for the visit when there’s no storage to be had', () => {
    for (const saves of [null, createSaves({ local: broken(), session: broken() })]) {
      const store = createPartyStore({ saves, now: () => 1000 });
      expect(store.get(pilot(1))).toBeNull();
      store.save(partyOf(2), pilot(1));
      expect(store.get(pilot(1))).toEqual({ party: partyOf(2), as: short(1), seen: 1000 });
      store.touch(pilot(1));
      store.clear(pilot(1));
      expect(store.get(pilot(1))).toBeNull();
    }
  });

  it('hands out a copy: changing what it gave, or what it was given, changes nothing kept', () => {
    const store = createPartyStore({ now: () => 1000 });
    const party = partyOf(2);
    store.save(party, pilot(1));
    party.members.push({ id: pilot(3), name: 'Stowaway', since: 1 });
    party.epoch = 9;
    const got = store.get(pilot(1));
    got.party.members[0].name = 'Changed';
    got.party.members.length = 0;
    got.seen = 0;
    expect(store.get(pilot(1))).toEqual({ party: partyOf(2), as: short(1), seen: 1000 });
  });

  it('keeps Follow the leader as a setting of the browser’s, past leaving the party', () => {
    const local = memory();
    const saves = createSaves({ local, session: memory() });
    const store = createPartyStore({ saves, now: () => 1000 });
    expect(store.follow()).toBe(false);
    store.save(partyOf(2), pilot(1));
    store.setFollow(true);
    store.clear(pilot(1));
    expect(createPartyStore({ saves: createSaves({ local, session: memory() }) }).follow()).toBe(true);
    expect(local.raw.has(FOLLOW_KEY)).toBe(true);
    store.setFollow(false);
    expect(store.follow()).toBe(false);
  });

  it('a browser that keeps nothing follows no one, and doesn’t throw', () => {
    const store = createPartyStore({ saves: createSaves({ local: broken(), session: broken() }) });
    expect(() => store.setFollow(true)).not.toThrow();
    expect(store.follow()).toBe(false);
    expect(createPartyStore().follow()).toBe(false);
  });
});
