import { describe, expect, it } from 'vitest';
import { createSaves } from '../../../runtime/saves';
import { PARTY_MAX } from './partyWire';
import { PARTY_DAYS, PARTY_KEY, createPartyStore } from './partyStore';

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
// (a pilot's id is their key: 64 hex digits, each pilot's first 16 their own)
const pilot = (n) => n.toString(16).padStart(2, '0').repeat(32);
const short = (n) => pilot(n).slice(0, 16);
const PARTY = 'c0ffee00c0ffee00';
const crew = (n) => Array.from({ length: n }, (_, i) => ({ id: pilot(i + 1), name: `Pilot ${i + 1}`, since: 100 * (i + 1) }));
// a party as party.js has it: pilot 1 leads, n members, at epoch n
const partyOf = (n = 3, more = {}) => ({ id: PARTY, leader: pilot(1), epoch: n, members: crew(n), ...more });
const kept = (raw) => createPartyStore({ saves: createSaves({ local: raw, session: memory() }), now: () => 2000 }).get();

describe('createPartyStore', () => {
  it('keeps your party and the key you flew, and reads them back next visit', () => {
    expect(PARTY_KEY).toBe('tp-party');
    const local = memory();
    const c = clock(5000);
    const store = createPartyStore({ saves: createSaves({ local, session: memory() }), now: c.now });
    expect(store.get()).toBeNull();
    store.save(partyOf(3), pilot(2));
    const want = { party: partyOf(3), as: short(2), seen: 5000 };
    expect(store.get()).toEqual(want);
    // kept as version 1 of its key
    expect(JSON.parse(local.raw.get(PARTY_KEY))).toEqual({ v: 1, data: want });
    // the next visit
    expect(createPartyStore({ saves: createSaves({ local, session: memory() }), now: c.now }).get()).toEqual(want);
    // (the key said as it's kept, its first 16 hex digits, is taken as well)
    store.save(partyOf(4), short(3));
    expect(store.get()).toEqual({ party: partyOf(4), as: short(3), seen: 5000 });
  });

  it('is seen again when touched, and forgotten after PARTY_DAYS unseen', () => {
    expect(PARTY_DAYS).toBe(14);
    const local = memory();
    const saves = createSaves({ local, session: memory() });
    const c = clock(0);
    const store = createPartyStore({ saves, now: c.now });
    store.touch(); // (nothing kept: nothing to touch)
    expect(store.get()).toBeNull();
    expect(local.raw.has(PARTY_KEY)).toBe(false);
    store.save(partyOf(2), pilot(1));
    c.t = 10 * DAY;
    store.touch();
    expect(store.get().seen).toBe(10 * DAY);
    expect(createPartyStore({ saves, now: c.now }).get().seen).toBe(10 * DAY);
    c.t = 24 * DAY - 1;
    expect(store.get()?.party.id).toBe(PARTY);
    c.t = 24 * DAY;
    expect(store.get()).toBeNull();
    expect(local.raw.has(PARTY_KEY)).toBe(false); // (forgotten in the browser too)
    store.touch(); // (forgotten: a touch brings nothing back)
    expect(store.get()).toBeNull();
  });

  it('forgets it when cleared, here and next visit', () => {
    const local = memory();
    const saves = createSaves({ local, session: memory() });
    const store = createPartyStore({ saves, now: () => 1000 });
    store.save(partyOf(2), pilot(1));
    store.clear();
    expect(store.get()).toBeNull();
    expect(local.raw.has(PARTY_KEY)).toBe(false);
    expect(createPartyStore({ saves, now: () => 1000 }).get()).toBeNull();
    store.clear(); // (nothing kept: still nothing)
    expect(store.get()).toBeNull();
  });

  it('saves only what it could read back: anything else forgets the party it had', () => {
    const saves = createSaves({ local: memory(), session: memory() });
    const store = createPartyStore({ saves, now: () => 1000 });
    for (const [party, as] of [
      [null, pilot(1)], // (no party: you left, or were removed)
      [partyOf(2), null], // (no key said: never yours to re-form)
      [partyOf(2), '<b>'],
      [partyOf(2), 'C'.repeat(64)],
      [partyOf(2, { leader: pilot(9) }), pilot(1)],
      [partyOf(PARTY_MAX + 1), pilot(1)],
      [partyOf(2, { id: 'party' }), pilot(1)],
      [partyOf(2, { epoch: 0 }), pilot(1)],
      ['a party', pilot(1)],
    ]) {
      store.save(partyOf(2), pilot(1));
      store.save(party, as);
      expect(store.get()).toBeNull();
      expect(createPartyStore({ saves, now: () => 1000 }).get()).toBeNull();
    }
    // a full party is kept; names are cleaned, a time that isn't one is 0, and nothing else is carried
    store.save(partyOf(PARTY_MAX), pilot(1));
    expect(store.get().party.members).toHaveLength(PARTY_MAX);
    const members = [
      { id: pilot(1), name: 'Han‮<b>', since: 'later', ship: 'Falcon' },
      { id: pilot(2), name: 42, since: 5 },
    ];
    store.save({ ...partyOf(2), members, secret: 'x' }, pilot(1));
    expect(createPartyStore({ saves, now: () => 1000 }).get().party).toEqual({
      id: PARTY,
      leader: pilot(1),
      epoch: 2,
      members: [
        { id: pilot(1), name: 'Han<b>', since: 0 },
        { id: pilot(2), name: 'Pilot', since: 5 },
      ],
    });
  });

  it('reads a corrupt or doctored save as nothing, as a stranger’s roster would be', () => {
    const good = { party: partyOf(3), as: short(1), seen: 1000 };
    const local = memory();
    local.setItem(PARTY_KEY, JSON.stringify({ v: 1, data: good }));
    expect(kept(local)).toEqual(good);
    const doctored = [
      { ...good, party: null },
      { ...good, party: [partyOf(3)] },
      { ...good, as: undefined },
      { ...good, as: 'C'.repeat(16) },
      { ...good, as: 1234 },
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
    const junk = ['not json', '[1,2,3]', '{"v":1,"data":"x"}', 'null', '{"v":1,"data":[]}', '{"v":1,"data":null}'];
    for (const raw of [...junk, ...doctored.map((data) => JSON.stringify({ v: 1, data }))]) {
      const local = memory();
      local.setItem(PARTY_KEY, raw);
      expect(kept(local)).toBeNull();
    }
    // a whole key where the first 16 digits are kept: those
    local.setItem(PARTY_KEY, JSON.stringify({ v: 1, data: { ...good, as: pilot(1) } }));
    expect(kept(local)?.as).toBe(short(1));
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
    expect(two.get()).toEqual(one.get());
    c.t = 2000;
    one.touch();
    expect(two.get().seen).toBe(2000);
    one.clear();
    expect(two.get()).toBeNull();
    expect(heard).toEqual({ one: 0, two: 3 });
    // what another tab writes is read as a stranger's would be
    saves.set(PARTY_KEY, { party: { ...partyOf(2), leader: pilot(9) }, as: short(1), seen: 2000 });
    expect(two.get()).toBeNull();
    expect(heard.two).toBe(4);
    off();
    one.save(partyOf(3), pilot(1));
    expect(heard.two).toBe(4);
    expect(two.get().party.epoch).toBe(3); // (still heard, only not told)
  });

  it('keeps the party for the visit when there’s no storage to be had', () => {
    for (const saves of [null, createSaves({ local: broken(), session: broken() })]) {
      const store = createPartyStore({ saves, now: () => 1000 });
      expect(store.get()).toBeNull();
      store.save(partyOf(2), pilot(1));
      expect(store.get()).toEqual({ party: partyOf(2), as: short(1), seen: 1000 });
      store.touch();
      store.clear();
      expect(store.get()).toBeNull();
    }
  });

  it('hands out a copy: changing what it gave, or what it was given, changes nothing kept', () => {
    const store = createPartyStore({ now: () => 1000 });
    const party = partyOf(2);
    store.save(party, pilot(1));
    party.members.push({ id: pilot(3), name: 'Stowaway', since: 1 });
    party.epoch = 9;
    const got = store.get();
    got.party.members[0].name = 'Changed';
    got.party.members.length = 0;
    got.seen = 0;
    expect(store.get()).toEqual({ party: partyOf(2), as: short(1), seen: 1000 });
  });
});
