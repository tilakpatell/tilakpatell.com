// Your party, remembered: kept in this browser, so a pilot who closes the
// tab and comes back is in it again (alone till the others come, and the
// roster flows again from whoever leads: partyLink.js re-forms it). Pure
// (the store is runtime/saves.js's, handed in), so it's tested in Node, as
// allies.js is, and kept as allies.js keeps allies.
//
// What's kept is the party as party.js has it, which of your keys you flew
// (`as`, its first 16 hex digits, as allies.js keeps it: the others know
// you by that key, so a party remembered under another, a guest tab's or a
// new identity's, isn't yours to re-form; partyLink.js asks) and when you
// were last in it (`seen`, touched while you are). Unseen PARTY_DAYS, it's
// forgotten; leaving, or being removed, forgets it too (clear).
//
// `tp-party` (version 1) is { party: { id, leader, epoch, members: [{ id,
// name, since }] }, as, seen }. It's read back as a stranger's roster would
// be (partyWire.js): the party's id 16 hex digits, each member's key 64 and
// there once, PARTY_MAX at most, the leader among them, a whole epoch from
// 1, a name cleaned (names.js); short of that there's no party to remember,
// since one read without a member would say they'd been removed. A save is
// kept as it would read back, so one that wouldn't (no party, or no key
// said) forgets the one kept. With no storage to be had it lasts the visit.
// Another tab's changes are heard (the storage event), so two tabs don't
// write over each other; this one's own, heard back, aren't news.
//
// createPartyStore({ saves, now }) → { get() → { party, as, seen } | null
//   (none kept, unreadable, or unseen too long), save(party, as) (`as` the
//   key you fly, whole or its first 16 hex digits), touch() (seen now),
//   clear(), on(fn) → off (another tab's change) }

import { cleanName } from './names';
import { PARTY_MAX, readPartyId } from './partyWire';

export const PARTY_KEY = 'tp-party';
export const PARTY_DAYS = 14; // unseen this long: forgotten
const VERSION = 1;
const DAY = 24 * 60 * 60 * 1000;

const ID = /^[0-9a-f]{64}$/;
const isId = (id) => typeof id === 'string' && ID.test(id);
// the key you flew, as kept: its first 16 hex digits (from a whole key, or as kept), or null
const keyOf = (k) => (typeof k === 'string' && /^[0-9a-f]{16}(?:[0-9a-f]{48})?$/.test(k) ? k.slice(0, 16) : null);
const time = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
const plainObject = (o) => Boolean(o) && typeof o === 'object' && !Array.isArray(o);

// the members as kept, or null: one that isn't a member (no key, or there
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
  // (a whole epoch, exact: it's only compared, and grows by one)
  if (!id || !members || !Number.isSafeInteger(p.epoch) || p.epoch < 1 || !members.some((m) => m.id === p.leader)) return null;
  return { id, leader: p.leader, epoch: p.epoch, members };
}
// what's kept, as it reads back, or null
function readEntry(data) {
  if (!plainObject(data)) return null;
  const party = readKeptParty(data.party);
  const as = keyOf(data.as);
  const seen = time(data.seen);
  return party && as && seen !== null ? { party, as, seen } : null;
}
// (handed out as a copy, so what a caller does with it isn't what's kept)
const copy = (e) => e && { ...e, party: { ...e.party, members: e.party.members.map((m) => ({ ...m })) } };

export function createPartyStore({ saves = null, now = () => Date.now() } = {}) {
  const read = () => {
    try {
      return saves?.get(PARTY_KEY, null) ?? null;
    } catch {
      return null;
    }
  };
  saves?.register?.({ key: PARTY_KEY, version: VERSION });
  let kept = readEntry(read());
  const listeners = new Set();

  let writing = false; // (this store's own write, heard back: not news)
  const write = (entry) => {
    writing = true;
    try {
      if (entry) saves?.set(PARTY_KEY, entry);
      else if (saves?.remove) saves.remove(PARTY_KEY);
      else saves?.set(PARTY_KEY, null);
    } catch {
      /* kept for the visit only */
    } finally {
      writing = false;
    }
  };
  // another tab's change, as the storage event tells it
  saves?.watch?.(PARTY_KEY, (data) => {
    if (writing) return;
    kept = readEntry(data);
    for (const fn of [...listeners]) fn();
  });

  const forget = () => {
    kept = null;
    write(null);
  };
  // what's kept, if it's still yours to come back to (unseen too long: forgotten, here and in the browser)
  const live = () => {
    if (kept && now() - kept.seen >= PARTY_DAYS * DAY) forget();
    return kept;
  };

  return {
    get: () => copy(live()),
    // the party as it is now, and the key you fly: kept, and seen now
    save(party, as) {
      kept = readEntry({ party, as, seen: now() });
      write(kept);
    },
    // still in it (back online, or flying on): seen now
    touch() {
      if (!live()) return;
      kept = { ...kept, seen: now() };
      write(kept);
    },
    clear: forget,
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
