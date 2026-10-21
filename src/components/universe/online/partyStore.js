// Your party, remembered: kept in this browser, so a pilot who closes the
// tab and comes back is in it again (alone till the others come, and the
// roster flows again from whoever leads: partyLink.js re-forms it). Pure
// (the store is runtime/saves.js’s, handed in), so it’s tested in Node, as
// allies.js is, and kept as allies.js keeps allies.
//
// What’s kept is the party as party.js has it, under the key you flew (its
// first 16 hex digits, as allies.js keeps it: the others know you by that
// key, so a party is only ever re-formed by the key that was in it), with
// when you were last in it (`seen`, touched while you are). Each key’s is its
// own: a second tab flies a guest key of its own, and its party, saved
// last, mustn’t take the place of the main key’s, which the main key would
// then come back without. Unseen PARTY_DAYS, a key’s party is forgotten;
// leaving, or being removed, forgets it too (clear). PARTY_KEYS keys at
// most (guest tabs’ come and go): the one seen longest ago goes first.
//
// `tp-party` (version 2) is { keys: { [as]: { party: { id, leader, epoch,
// members: [{ id, name, since }] }, seen } } }; version 1, one party for one
// key ({ party, as, seen }), is read as that key’s. Each is read back as a
// stranger’s roster would be (partyWire.js): the party’s id 16 hex digits,
// each member’s key 64 and there once, PARTY_MAX at most, the leader among
// them, an epoch as readEpoch takes it, a name cleaned (names.js); short of
// that the key has no party to remember, since one read without a member
// would say they’d been removed. A save is kept as it would read back, so
// one that wouldn’t (no party) forgets the one kept for that key. With no
// storage to be had it lasts the visit. Another tab’s changes are heard (the
// storage event), and each save is made over what’s stored now, so two tabs
// don’t write over each other; this one’s own, heard back, aren’t news.
//
// createPartyStore({ saves, now }) → { get(as) → { party, as, seen } | null
//   (none kept for that key, unreadable, or unseen too long), save(party, as),
//   touch(as) (seen now), clear(as) (each `as` the key you fly, whole or its
//   first 16 hex digits), follow() → bool, setFollow(on), on(fn) → off
//   (another tab’s change) }

import { cleanName } from './names';
import { PARTY_MAX, readEpoch, readPartyId } from './partyWire';

export const PARTY_KEY = 'tp-party';
export const PARTY_DAYS = 14; // unseen this long: forgotten
export const PARTY_KEYS = 4; // keys kept at most
export const FOLLOW_KEY = 'tp-party-follow';
const VERSION = 2;
const DAY = 24 * 60 * 60 * 1000;

const ID = /^[0-9a-f]{64}$/;
const isId = (id) => typeof id === 'string' && ID.test(id);
// the key you flew, as kept: its first 16 hex digits (from a whole key, or as kept), or null
const keyOf = (k) => (typeof k === 'string' && /^[0-9a-f]{16}(?:[0-9a-f]{48})?$/.test(k) ? k.slice(0, 16) : null);
const time = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
const plainObject = (o) => Boolean(o) && typeof o === 'object' && !Array.isArray(o);

// the members as kept, or null: one that isn’t a member (no key, or there
// twice) makes it no party at all, as it would on the wire
function readMembers(m) {
  if (!Array.isArray(m) || m.length < 1 || m.length > PARTY_MAX) return null;
  const out = [];
  for (const x of m) {
    if (!plainObject(x) || !isId(x.id) || out.some((o) => o.id === x.id)) return null;
    out.push({ id: x.id, name: cleanName(x.name) ?? 'Pilot', since: time(x.since) ?? 0 });
  }
  return out;
}
function readKeptParty(p) {
  if (!plainObject(p)) return null;
  const id = readPartyId(p.id);
  const members = readMembers(p.members);
  if (!id || !members || !readEpoch(p.epoch) || !members.some((m) => m.id === p.leader)) return null;
  return { id, leader: p.leader, epoch: p.epoch, members };
}
// one key’s entry as it reads back ({ party, seen }), or null
function readEntry(data) {
  if (!plainObject(data)) return null;
  const party = readKeptParty(data.party);
  const seen = time(data.seen);
  return party && seen !== null ? { party, seen } : null;
}
// What’s kept, as it reads back: a Map of key → { party, seen }, the
// unreadable left out. Version 1’s single entry is read as its key’s (an old
// tab’s write, heard, is that shape too).
function readKept(data) {
  const kept = new Map();
  if (!plainObject(data)) return kept;
  if (!('keys' in data)) {
    const as = keyOf(data.as);
    const entry = readEntry(data);
    if (as && entry) kept.set(as, entry);
    return kept;
  }
  if (!plainObject(data.keys)) return kept;
  for (const [k, v] of Object.entries(data.keys)) {
    const as = keyOf(k) === k ? k : null;
    const entry = as && readEntry(v);
    if (entry) kept.set(as, entry);
  }
  return kept;
}
const written = (kept) => ({ keys: Object.fromEntries([...kept].map(([as, e]) => [as, { party: e.party, seen: e.seen }])) });
// (handed out as a copy, so what a caller does with it isn’t what’s kept)
const copy = (as, e) => e && { party: { ...e.party, members: e.party.members.map((m) => ({ ...m })) }, as, seen: e.seen };

export function createPartyStore({ saves = null, now = () => Date.now() } = {}) {
  const read = () => {
    try {
      return saves?.get(PARTY_KEY, null) ?? null;
    } catch {
      return null;
    }
  };
  saves?.register?.({ key: PARTY_KEY, version: VERSION, migrate: (old) => written(readKept(old)) });
  let kept = readKept(read());
  const listeners = new Set();

  let writing = false; // (this store’s own write, heard back: not news)
  const write = () => {
    writing = true;
    try {
      if (kept.size) saves?.set(PARTY_KEY, written(kept));
      else if (saves?.remove) saves.remove(PARTY_KEY);
      else saves?.set(PARTY_KEY, null);
    } catch {
      /* kept for the visit only */
    } finally {
      writing = false;
    }
  };
  // another tab’s change, as the storage event tells it
  saves?.watch?.(PARTY_KEY, (data) => {
    if (writing) return;
    kept = readKept(data);
    for (const fn of [...listeners]) fn();
  });

  // What’s kept now, for a change to be made over: what’s stored, if it can
  // be read (another tab may have written since this one last heard), else
  // what this one holds. Unseen too long: forgotten.
  const fresh = () => {
    const raw = read();
    const t = now();
    const base = raw === null ? kept : readKept(raw);
    for (const [as, e] of base) if (t - e.seen >= PARTY_DAYS * DAY) base.delete(as);
    return base;
  };
  const change = (fn) => {
    kept = fresh();
    fn(kept);
    while (kept.size > PARTY_KEYS) kept.delete([...kept].reduce((a, b) => (b[1].seen < a[1].seen ? b : a))[0]);
    write();
  };

  // what’s kept for that key, if it’s still yours to come back to (unseen too long: forgotten, here and in the browser)
  const live = (as) => {
    const e = as && kept.get(as);
    if (e && now() - e.seen >= PARTY_DAYS * DAY) change((m) => m.delete(as));
    return (as && kept.get(as)) || null;
  };

  return {
    get(k) {
      const as = keyOf(k);
      return copy(as, live(as));
    },
    // the party as it is now, under the key you fly: kept, and seen now
    save(party, k) {
      const as = keyOf(k);
      if (!as) return;
      const entry = readEntry({ party, seen: now() });
      change((m) => (entry ? m.set(as, entry) : m.delete(as)));
    },
    // still in it (back online, or flying on): seen now
    touch(k) {
      const as = keyOf(k);
      if (!live(as)) return;
      change((m) => {
        const e = m.get(as);
        if (e) m.set(as, { ...e, seen: now() });
      });
    },
    clear(k) {
      const as = keyOf(k);
      if (!as || !kept.has(as)) return;
      change((m) => m.delete(as));
    },
    // Follow the leader, a switch of this browser’s (not the party’s: it
    // outlives leaving one, as a setting does)
    follow: () => {
      try {
        return saves?.get(FOLLOW_KEY, false) === true;
      } catch {
        return false;
      }
    },
    setFollow(on) {
      try {
        saves?.set(FOLLOW_KEY, Boolean(on));
      } catch {
        /* kept for the visit only */
      }
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
